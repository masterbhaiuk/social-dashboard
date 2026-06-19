import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in dev rather than silently breaking every fetch.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy frontend/.env.example to frontend/.env and fill in your Supabase project values.'
  )
}

// Public, read-only anon client. All write operations go through PIN-gated RPC
// functions defined in the database (see supabase/migrations/0001_init.sql) — the
// anon key alone can never mutate data, by design (RLS has no insert/update/delete
// policies for the anon role on any table).
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Local key used to persist the admin session token issued after a successful PIN check.
export const ADMIN_SESSION_KEY = 'social-dashboard-admin-session'
