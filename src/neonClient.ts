import { createClient } from '@neondatabase/neon-js';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL;

if (!authUrl || !dataApiUrl) {
  // Fail loudly with a clear message instead of a cryptic runtime error.
  throw new Error(
    'Missing VITE_NEON_AUTH_URL / VITE_NEON_DATA_API_URL. ' +
    'Copy .env.example to .env.local, fill in your Neon project values, and restart the dev server.'
  );
}

// One client for both auth and data: the Data API calls automatically carry the
// signed-in user's JWT, and Row-Level Security in Postgres is what actually
// protects each user's rows. Both URLs are public client config, not secrets.
export const neon = createClient({
  auth: {
    adapter: BetterAuthReactAdapter(),
    url: authUrl,
  },
  dataApi: {
    url: dataApiUrl,
  },
});
