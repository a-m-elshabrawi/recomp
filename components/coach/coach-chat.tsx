"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Menu, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getConversationMessages } from "@/app/(app)/coach/actions";
import { ConversationList } from "@/components/coach/conversation-list";
import type {
  ConversationSummary,
  MessageRole,
} from "@/lib/coach/types";

type DisplayMessage = {
  id: string;
  role: MessageRole;
  content: string;
};

type CoachApiResponse =
  | { ok: true; message: string; conversationId: string; title: string | null }
  | { ok: false; error: string };

export function CoachChat({
  initialConversations,
}: {
  initialConversations: ConversationSummary[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  function upsertConversation(summary: ConversationSummary) {
    setConversations((prev) => [
      summary,
      ...prev.filter((conversation) => conversation.id !== summary.id),
    ]);
  }

  async function handleSelectConversation(id: string) {
    if (id === activeConversationId) {
      setMobileListOpen(false);
      return;
    }

    setError(null);
    setIsLoadingConversation(true);
    setActiveConversationId(id);
    setMobileListOpen(false);

    const result = await getConversationMessages(id);
    if (result.ok) {
      setMessages(
        result.data.map((entry) => ({
          id: entry.id,
          role: entry.role,
          content: entry.content,
        }))
      );
    } else {
      setError(result.error);
      setMessages([]);
    }
    setIsLoadingConversation(false);
  }

  function handleNewChat() {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setMobileListOpen(false);
  }

  async function sendToCoach(userMessage: string) {
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationId: activeConversationId,
        }),
      });

      const result = (await response.json()) as CoachApiResponse;

      if (!response.ok || !result.ok) {
        setError(
          !result.ok ? result.error : "Something went wrong. Please try again."
        );
        return;
      }

      setActiveConversationId(result.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.message,
        },
      ]);
      upsertConversation({
        id: result.conversationId,
        title: result.title,
        updated_at: new Date().toISOString(),
      });
    } catch {
      setError(
        "Couldn't reach the AI coach. Check your connection and try again."
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (trimmed === "" || isSending) return;

    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    void sendToCoach(trimmed);
  }

  function handleRetry() {
    // A pending error only ever follows the user's own message being
    // appended with no coach reply yet, so the last message is always the
    // one to retry, and everything before it is already-saved history.
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") return;
    void sendToCoach(lastMessage.content);
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[420px] gap-4">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col gap-3 rounded-lg border p-3 md:flex">
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewChat}
          className="justify-start gap-2"
        >
          <Plus className="size-4" />
          New chat
        </Button>
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelect={handleSelectConversation}
        />
      </aside>

      {/* Chat panel */}
      <div className="flex flex-1 flex-col rounded-lg border">
        <div className="flex items-center justify-between gap-2 border-b p-2 md:hidden">
          <Sheet open={mobileListOpen} onOpenChange={setMobileListOpen}>
            <SheetTrigger render={<Button variant="outline" size="icon" />}>
              <Menu className="size-5" />
              <span className="sr-only">Conversations</span>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <SheetHeader>
                <SheetTitle>Conversations</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewChat}
                  className="justify-start gap-2"
                >
                  <Plus className="size-4" />
                  New chat
                </Button>
                <ConversationList
                  conversations={conversations}
                  activeConversationId={activeConversationId}
                  onSelect={handleSelectConversation}
                />
              </div>
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewChat}
            className="gap-2"
          >
            <Plus className="size-4" />
            New chat
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {isLoadingConversation ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Loading conversation...
            </div>
          ) : messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          {isSending && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="border-t px-4 py-2">
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{error}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRetry}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t p-3"
        >
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask your coach..."
            aria-label="Message"
            className="h-11 flex-1 text-base"
            disabled={isSending}
          />
          <Button
            type="submit"
            disabled={isSending || input.trim() === ""}
            className="h-11"
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-lg bg-muted px-3 py-2.5">
        <span className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-bounce [animation-delay:-0.3s]" />
        <span className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-bounce [animation-delay:-0.15s]" />
        <span className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-bounce" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 py-12 text-center">
      <p className="text-sm font-medium">Your AI coach is ready.</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Ask about your program, nutrition targets, or how your recent
        progress looks.
      </p>
    </div>
  );
}
