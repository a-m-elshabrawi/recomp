import type { Metadata } from "next";
import { CoachChat } from "@/components/coach/coach-chat";
import { listConversations } from "@/app/(app)/coach/actions";

export const metadata: Metadata = { title: "Coach — Recomp" };

export default async function CoachPage() {
  const result = await listConversations();
  const initialConversations = result.ok ? result.data : [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Coach</h1>
      <CoachChat initialConversations={initialConversations} />
    </div>
  );
}
