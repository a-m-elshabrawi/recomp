const TITLE_MAX_LENGTH = 60;
// Below this, a word-boundary cut would chop off too much of the message
// to be useful, so a hard cut at TITLE_MAX_LENGTH is used instead.
const MIN_WORD_BOUNDARY_LENGTH = 20;

/**
 * Derives a conversation title from the first user message via truncation
 * — not a follow-up Gemini call. Chosen over an LLM-generated title
 * because it's free, instant, and has no extra failure mode to handle;
 * a title is a low-stakes sidebar label, not worth doubling the API calls
 * (and doubling time-to-first-response) on every new conversation for.
 * Set once here when the conversation is created — never regenerated.
 */
export function deriveConversationTitle(message: string): string {
  const collapsed = message.replace(/\s+/g, " ").trim();

  if (collapsed.length <= TITLE_MAX_LENGTH) {
    return collapsed;
  }

  const truncated = collapsed.slice(0, TITLE_MAX_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  const base =
    lastSpace >= MIN_WORD_BOUNDARY_LENGTH ? truncated.slice(0, lastSpace) : truncated;

  return `${base}…`;
}
