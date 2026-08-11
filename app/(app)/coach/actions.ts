"use server";

import { createClient } from "@/lib/supabase/server";
import type { ConversationMessage, ConversationSummary } from "@/lib/coach/types";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function listConversations(): Promise<
  ActionResult<ConversationSummary[]>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase
    .from("coach_conversations")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

/**
 * RLS already scopes coach_messages to conversations the caller owns (via
 * conversation_id -> coach_conversations.user_id), so a conversationId
 * belonging to someone else — or that doesn't exist — just resolves to an
 * empty list rather than an error or a leak.
 */
export async function getConversationMessages(
  conversationId: string
): Promise<ActionResult<ConversationMessage[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase
    .from("coach_messages")
    .select("id, role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as ConversationMessage[] };
}
