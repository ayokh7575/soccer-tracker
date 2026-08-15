import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AuthGate from './AuthGate';

// vi.hoisted so the mock factory (which is hoisted above imports) can reach it.
const h = vi.hoisted(() => ({
  session: { isPending: false, data: null as any },
  allowed: true,
}));

vi.mock('./neonClient', () => ({
  neon: {
    auth: {
      useSession: () => h.session,
      signOut: () => Promise.resolve(),
      emailOtp: { sendVerificationOtp: async () => ({ error: null }) },
      signIn: { emailOtp: async () => ({ error: null }) },
    },
    rpc: async () => ({ data: h.allowed, error: null }),
  },
}));

const signedIn = { isPending: false, data: { user: { id: 'u1', email: 'coach@example.com' } } };
const signedOut = { isPending: false, data: null };

beforeEach(() => {
  h.session = signedOut;
  h.allowed = true;
});

describe('AuthGate', () => {
  test('starts at the email prompt', () => {
    render(<AuthGate><div>App</div></AuthGate>);
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  test('moves to the code step after requesting a code', async () => {
    render(<AuthGate><div>App</div></AuthGate>);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'coach@example.com' },
    });
    fireEvent.click(screen.getByText('Send code'));
    expect(await screen.findByPlaceholderText('123456')).toBeInTheDocument();
  });

  test('returns to the email prompt after signing out, not the code step', async () => {
    const { rerender } = render(<AuthGate><div>App</div></AuthGate>);

    // Request a code so the gate is showing the code step...
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'coach@example.com' },
    });
    fireEvent.click(screen.getByText('Send code'));
    await screen.findByPlaceholderText('123456');

    // ...then sign in and back out again.
    h.session = signedIn;
    rerender(<AuthGate><div>App</div></AuthGate>);
    expect(await screen.findByText('App')).toBeInTheDocument();

    h.session = signedOut;
    rerender(<AuthGate><div>App</div></AuthGate>);

    expect(await screen.findByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('123456')).not.toBeInTheDocument();
  });

  test('renders the app when the account is on the allowlist', async () => {
    h.session = signedIn;
    render(<AuthGate><div>App</div></AuthGate>);
    expect(await screen.findByText('App')).toBeInTheDocument();
  });

  // Denial is only concluded after the retries that cover a database cold
  // start, so this needs longer than the default timeout.
  test('explains when the account is not on the allowlist', async () => {
    h.session = signedIn;
    h.allowed = false;
    render(<AuthGate><div>App</div></AuthGate>);
    expect(
      await screen.findByText('Access not enabled', undefined, { timeout: 15000 })
    ).toBeInTheDocument();
    expect(screen.queryByText('App')).not.toBeInTheDocument();
  }, 20000);

  test('allows access when a retry succeeds after a cold start', async () => {
    h.session = signedIn;
    h.allowed = false; // first call fails as it would while the database wakes
    render(<AuthGate><div>App</div></AuthGate>);
    h.allowed = true;
    expect(await screen.findByText('App', undefined, { timeout: 15000 })).toBeInTheDocument();
    expect(screen.queryByText('Access not enabled')).not.toBeInTheDocument();
  }, 20000);
});
