// Admin / service-role Supabase client. Bypasses Row Level Security.
// NEVER import this from a "use client" file or send the key to the browser.
// Used by:
//   - /api/strava/webhook  (no user session — receives Strava callbacks)
//   - /admin queries that need to read all users' data

import { createClient } from "@supabase/supabase-js";

let _admin = null;

export function adminClient() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (set in Vercel env vars + .env.local)");
  }
  _admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}
