/** ISO timestamp -> "Just now" / "5m ago" / "3h ago" / "Yesterday" / "4d ago" / "Jan 5". */
export function formatRelativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  const diffMs = Date.now() - then;
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(isoString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
