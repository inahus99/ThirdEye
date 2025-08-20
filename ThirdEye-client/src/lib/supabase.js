import { createClient } from "@supabase/supabase-js";

const url = (process.env.REACT_APP_SUPABASE_URL || "").trim();
const key = (process.env.REACT_APP_SUPABASE_ANON_KEY || "").trim();

if (!url || !key) {
  console.warn(
    "[supabase] Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY in .env"
  );
}

export const supabase = createClient(url, key, {
  auth: {
    // persist session in localStorage and auto-refresh tokens
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
