import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loudly with a clear message instead of a cryptic runtime error.
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Copy .env.example to .env.local, fill in your Supabase project values, and restart the dev server.'
  );
}

// The anon key is safe to ship to the browser — Row-Level Security in the
// database is what actually protects each user's data.
export const supabase = createClient(url, anonKey);
