-- ============================================
-- Supabase setup for "The Lobby" (public chat)
-- Run this in the Supabase SQL Editor (one time)
-- ============================================

create table if not exists public.lobby_messages (
  id uuid primary key default gen_random_uuid(),
  sender text not null,                    -- wallet address (lowercase)
  payload jsonb not null,                  -- same MessagePayload shape used everywhere else
  created_at timestamptz not null default now()
);

-- Helpful index for the "load last N messages" query
create index if not exists idx_lobby_messages_created_at
  on public.lobby_messages (created_at desc);

-- Enable Row Level Security
alter table public.lobby_messages enable row level security;

-- Anyone (including anonymous browsers) can READ the Lobby
create policy "Anyone can read the lobby"
  on public.lobby_messages
  for select
  using (true);

-- Anyone can WRITE to the Lobby (we trust the client to send their real wallet address,
-- same trust model as the previous on-chain version)
create policy "Anyone can post to the lobby"
  on public.lobby_messages
  for insert
  with check (true);

-- (Optional but recommended later) Add a simple rate limit via a trigger or Edge Function.
-- For v1 this is intentionally open, just like the old on-chain public messages.

comment on table public.lobby_messages is 'Public unencrypted Lobby chat for blackout-messenger. Centralized via Supabase Realtime.';
