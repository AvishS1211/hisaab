import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// A single browser client, created only if the env vars are present. When they
// aren't (e.g. local dev with no project), `supabase` is null and the app runs
// on the in-memory seed instead of persisting.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: false } })
  : null;
