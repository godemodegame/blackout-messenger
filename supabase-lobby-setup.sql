-- ===================================================================
-- Supabase setup for "The Lobby" (public unencrypted chat)
-- blackout-messenger
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase project → SQL Editor
-- 2. Click "New query"
-- 3. Delete everything in the editor
-- 4. Paste this entire file
-- 5. Click "Run" (or Cmd/Ctrl + Enter)
-- ===================================================================

-- 1. Create the table (safe to re-run)
create table if not exists public.lobby_messages (
  id uuid primary key default gen_random_uuid(),
  sender text not null,                    -- wallet address (lowercase, 0x...)
  payload jsonb not null,                  -- MessagePayload shape from the app
  created_at timestamptz not null default now()
);

-- 2. Index that matches how the app actually queries (ascending time order)
create index if not exists idx_lobby_messages_created_at
  on public.lobby_messages (created_at asc);

-- Optional: composite index if you later add filtering by sender
-- create index if not exists idx_lobby_messages_sender_created_at
--   on public.lobby_messages (sender, created_at);

-- 3. Enable Row Level Security
alter table public.lobby_messages enable row level security;

-- 4. Policies — anyone can read and post (same trust model as the old on-chain version)
--    The app itself validates that `sender` matches the connected Privy wallet.

drop policy if exists "Anyone can read the lobby" on public.lobby_messages;
create policy "Anyone can read the lobby"
  on public.lobby_messages
  for select
  using (true);

drop policy if exists "Anyone can post to the lobby" on public.lobby_messages;
create policy "Anyone can post to the lobby"
  on public.lobby_messages
  for insert
  with check (true);

-- 5. CRITICAL: Enable Realtime for this table
--    Without this line, the usePublicLobby hook will never receive live messages.
alter publication supabase_realtime add table public.lobby_messages;

-- (If you get "already member of publication" error, that's fine — just ignore it.)

-- 6. Optional: add a comment for future humans
comment on table public.lobby_messages is
  'Public unencrypted Lobby chat for blackout-messenger. Uses Supabase Realtime for instant delivery.';

-- Done. After running this, hard-refresh your app (or restart `npm run dev`).
-- The Lobby should now load history and receive live messages.
