import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/coach/format";
import type { ConversationSummary } from "@/lib/coach/types";

export function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
}: {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
}) {
  if (conversations.length === 0) {
    return (
      <p className="px-2 py-4 text-sm text-muted-foreground">
        No past conversations yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5 overflow-y-auto">
      {conversations.map((conversation) => {
        const isActive = conversation.id === activeConversationId;
        return (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="truncate text-sm font-medium">
                {conversation.title ?? "New conversation"}
              </span>
              <span className="stat-caption">
                {formatRelativeTime(conversation.updated_at)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
