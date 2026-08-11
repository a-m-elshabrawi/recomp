-- =============================================================================
-- Recomp — Migration 0006: AI Coach conversation persistence
-- =============================================================================
-- Run the same way as the other migrations in this folder (or via
-- SUPABASE_DB_URL + psql). Additive only, safe to run more than once —
-- every statement is guarded.
--
-- Two new tables:
--   - coach_conversations: one row per conversation thread.
--   - coach_messages: one row per message in a thread. No user_id column
--     of its own — ownership is via conversation_id -> coach_conversations
--     .user_id, same pattern already used for exercise_logs -> workout_logs
--     elsewhere in this schema.
-- =============================================================================

create table if not exists coach_conversations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists coach_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references coach_conversations(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_coach_conversations_user
  on coach_conversations(user_id, updated_at desc);

create index if not exists idx_coach_messages_conversation
  on coach_messages(conversation_id, created_at);

alter table coach_conversations enable row level security;
alter table coach_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'coach_conversations'
      and policyname = 'Users can manage their own coach conversations'
  ) then
    create policy "Users can manage their own coach conversations"
      on coach_conversations
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'coach_messages'
      and policyname = 'Users can manage their own coach messages'
  ) then
    create policy "Users can manage their own coach messages"
      on coach_messages
      for all
      using (
        exists (
          select 1 from coach_conversations
          where coach_conversations.id = coach_messages.conversation_id
            and coach_conversations.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from coach_conversations
          where coach_conversations.id = coach_messages.conversation_id
            and coach_conversations.user_id = auth.uid()
        )
      );
  end if;
end $$;
