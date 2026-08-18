import { NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
} from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { buildCoachContext } from "@/lib/coach/context";
import { deriveConversationTitle } from "@/lib/coach/title";
import { isDemoUser } from "@/lib/demo";

// Pinned per explicit request rather than the "-latest" alias. Note for
// future-you: Gemini model versions do get deprecated/shut down over time
// (verified while building this — "gemini-2.0-flash" no longer exists) —
// if this one ever starts 404ing, that's why.
const MODEL_NAME = "gemini-3.6-flash";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 50;

const SYSTEM_PROMPT_INTRO = `You are Recomp's AI coach — a knowledgeable, encouraging personal trainer and nutrition coach for the user described below. Use their actual profile, program, and recent history to give specific, personalized, actionable advice, rather than generic tips. Be warm and motivating, but honest — don't just tell them what they want to hear. Keep responses conversational and reasonably concise unless they ask for depth. Reference their real data naturally (e.g. "you hit 3 of 4 sessions this week") instead of dumping raw numbers back at them.

You do not have the ability to log workouts, update their program, or change any of their data — you can only see it and talk about it. If they describe symptoms of injury or illness, encourage them to consult a medical professional rather than trying to diagnose it yourself.

Here is what you know about this user right now:`;

type CoachApiResponse =
  | { ok: true; message: string; conversationId: string; title: string | null }
  | { ok: false; error: string };

export async function POST(request: Request): Promise<NextResponse<CoachApiResponse>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "The AI coach isn't configured yet (missing API key).",
      },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not signed in." },
      { status: 401 }
    );
  }

  // The public demo account can read its seeded coach conversations but
  // can't start new ones. Its credentials are in README.md, so anyone at
  // all can sign into it — leaving live sends open would put an unmetered,
  // unauthenticated hole straight through to the project's single Gemini
  // key, and every message would also write into the demo's conversation
  // list for the next visitor. Blocking here (rather than in the UI) is
  // what actually enforces it, since the endpoint is reachable directly.
  // Real accounts are unaffected.
  if (isDemoUser(user.email)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The demo account's coach is read-only. Open a saved conversation on the left to see how it responds using this account's real training history — or sign up for your own account to chat live.",
      },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const { message, conversationId: requestedConversationId } = parseBody(body);
  if (message === null) {
    return NextResponse.json(
      { ok: false, error: "A message is required." },
      { status: 400 }
    );
  }

  // ---- Resolve or create the conversation (WRITE) --------------------------
  // This route writes to exactly two tables — coach_conversations and
  // coach_messages — for conversation persistence. Every other Supabase
  // call in this route (and everything in buildCoachContext) is read-only.
  let conversationId: string;
  let title: string | null;

  if (requestedConversationId) {
    const { data: existing, error } = await supabase
      .from("coach_conversations")
      .select("id, title")
      .eq("id", requestedConversationId)
      .maybeSingle();

    // RLS already scopes this select to the caller's own rows, so a
    // conversation id that isn't found here means either it doesn't exist
    // or it isn't this user's — same response either way.
    if (error || !existing) {
      return NextResponse.json(
        { ok: false, error: "Conversation not found." },
        { status: 404 }
      );
    }
    conversationId = existing.id;
    title = existing.title;
  } else {
    title = deriveConversationTitle(message);
    const { data: created, error } = await supabase
      .from("coach_conversations")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    conversationId = created.id;
  }

  // ---- Load prior messages for Gemini's multi-turn context (READ) ----------
  const { data: priorMessages, error: historyError } = await supabase
    .from("coach_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY_MESSAGES);

  if (historyError) {
    return NextResponse.json(
      { ok: false, error: historyError.message },
      { status: 500 }
    );
  }

  // ---- Save the user's message (WRITE) --------------------------------------
  const { error: saveUserError } = await supabase.from("coach_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });
  if (saveUserError) {
    return NextResponse.json(
      { ok: false, error: saveUserError.message },
      { status: 500 }
    );
  }

  // READ-ONLY: buildCoachContext only ever selects from Supabase to
  // assemble context for the prompt below — it never writes anything.
  const context = await buildCoachContext(supabase, user.id);
  const systemInstruction = `${SYSTEM_PROMPT_INTRO}\n\n${context}`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction,
  });

  let replyText: string;
  try {
    const chat = model.startChat({
      // coach_messages stores "assistant" (matching the schema's CHECK
      // constraint); Gemini's SDK expects "model". Map at the boundary.
      history: (priorMessages ?? []).map((entry) => ({
        role: entry.role === "assistant" ? "model" : "user",
        parts: [{ text: entry.content }],
      })),
    });
    const result = await chat.sendMessage(message);
    replyText = result.response.text();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: describeGeminiError(error) },
      { status: 502 }
    );
  }

  // ---- Save the assistant's reply and touch the conversation (WRITE) -------
  const { error: saveAssistantError } = await supabase.from("coach_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: replyText,
  });
  if (saveAssistantError) {
    return NextResponse.json(
      { ok: false, error: saveAssistantError.message },
      { status: 500 }
    );
  }

  await supabase
    .from("coach_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return NextResponse.json({ ok: true, message: replyText, conversationId, title });
}

function parseBody(body: unknown): {
  message: string | null;
  conversationId: string | null;
} {
  if (typeof body !== "object" || body === null) {
    return { message: null, conversationId: null };
  }
  const raw = body as { message?: unknown; conversationId?: unknown };

  const message =
    typeof raw.message === "string" && raw.message.trim().length > 0
      ? raw.message.trim().slice(0, MAX_MESSAGE_LENGTH)
      : null;

  const conversationId =
    typeof raw.conversationId === "string" && raw.conversationId.length > 0
      ? raw.conversationId
      : null;

  return { message, conversationId };
}

function describeGeminiError(error: unknown): string {
  if (error instanceof GoogleGenerativeAIFetchError) {
    if (error.status === 429) {
      return "The AI coach is getting a lot of requests right now. Please wait a moment and try again.";
    }
    if (error.status === 401 || error.status === 403) {
      return "The AI coach can't authenticate right now. Please contact the app owner.";
    }
    if (error.status && error.status >= 500) {
      return "The AI coach service is temporarily unavailable. Please try again shortly.";
    }
  }
  return "Something went wrong talking to the AI coach. Please try again.";
}
