import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. The public Lobby will not work.",
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? "",
  supabaseAnonKey ?? "",
  {
    auth: {
      persistSession: false, // We don't use Supabase Auth (we use Privy wallets)
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  },
);

export type LobbyMessageRow = {
  id: string;
  sender: string;
  payload: Record<string, unknown>;
  created_at: string;
};
