import { render, screen, fireEvent, act } from '@testing-library/react';
import AuthGate, { PENDING_SIGN_IN_KEY, SESSION_NOT_KEPT_MESSAGE } from './AuthGate';

// vi.hoisted so the mock factory (which is hoisted above imports) can reach it.
const h = vi.hoisted(() => ({
  session: { isPending: false, data: null as any },
  allowed: true,
  verifyError: null as null | { message: string },
  verifyThrows: '' as string,
}));

vi.mock('./neonClient', () => ({
  neon: {
    auth: {
      useSession: () => h.session,
      signOut: () => Promise.resolve(),
      emailOtp: { sendVerificationOtp: async () => ({ error: null }) },
      signIn: {
        emailOtp: async () => {
          if (h.verifyThrows) throw new Error(h.verifyThrows);
          return { error: h.verifyError };
        },
      },
    },
    rpc: async () => ({ data: h.allowed, error: null }),
  },
}));

const signedIn = { isPending: false, data: { user: { id: 'u1', email: 'coach@example.com' } } };
const signedOut = { isPending: false, data: null };

beforeEach(() => {
  h.session = signedOut;
  h.allowed = true;
  h.verifyError = null;
  h.verifyThrows = '';
  localStorage.clear();
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

  test('comes back on the code step after a reload (e.g. iOS home-screen app)', async () => {
    const { unmount } = render(<AuthGate><div>App</div></AuthGate>);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'coach@example.com' },
    });
    fireEvent.click(screen.getByText('Send code'));
    await screen.findByPlaceholderText('123456');

    // The page is reloaded while the coach reads the email.
    unmount();
    render(<AuthGate><div>App</div></AuthGate>);
    expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
    expect(screen.getByText(/coach@example\.com/)).toBeInTheDocument();
  });

  test('forgets a pending code that is too old to still be valid', () => {
    localStorage.setItem(PENDING_SIGN_IN_KEY, JSON.stringify({
      email: 'coach@example.com', sentAt: Date.now() - 60 * 60 * 1000,
    }));
    render(<AuthGate><div>App</div></AuthGate>);
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  test('explains a wrong code in plain words and offers a new one', async () => {
    h.verifyError = { message: 'Invalid OTP' };
    render(<AuthGate><div>App</div></AuthGate>);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'coach@example.com' },
    });
    fireEvent.click(screen.getByText('Send code'));
    fireEvent.change(await screen.findByPlaceholderText('123456'), { target: { value: '111111' } });
    fireEvent.click(screen.getByText('Verify'));

    expect(await screen.findByText(/Use the code from the most recent email/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Send a new code'));
    expect(await screen.findByText('New code sent. Earlier codes no longer work.')).toBeInTheDocument();
  });

  test('"Use a different email" forgets the pending code', async () => {
    render(<AuthGate><div>App</div></AuthGate>);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'coach@example.com' },
    });
    fireEvent.click(screen.getByText('Send code'));
    await screen.findByPlaceholderText('123456');
    fireEvent.click(screen.getByText('Use a different email'));
    expect(localStorage.getItem(PENDING_SIGN_IN_KEY)).toBeNull();
  });

  test('explains a wrong code even when the client throws the rejection', async () => {
    h.verifyThrows = 'Invalid OTP';
    render(<AuthGate><div>App</div></AuthGate>);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'coach@example.com' },
    });
    fireEvent.click(screen.getByText('Send code'));
    fireEvent.change(await screen.findByPlaceholderText('123456'), { target: { value: '111111' } });
    fireEvent.click(screen.getByText('Verify'));
    expect(await screen.findByText(/Use the code from the most recent email/)).toBeInTheDocument();
  });

  test('explains when the code is accepted but no session is kept (iOS home-screen app)', async () => {
    render(<AuthGate><div>App</div></AuthGate>);
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'coach@example.com' },
    });
    fireEvent.click(screen.getByText('Send code'));
    fireEvent.change(await screen.findByPlaceholderText('123456'), { target: { value: '123456' } });

    vi.useFakeTimers();
    try {
      await act(async () => { fireEvent.click(screen.getByText('Verify')); });
      // Verify stays disabled while waiting, so it can't be tapped again.
      expect(screen.getByText('Verifying…').closest('button')).toBeDisabled();
      await act(async () => { vi.advanceTimersByTime(4100); });
    } finally {
      vi.useRealTimers();
    }
    expect(screen.getByText(SESSION_NOT_KEPT_MESSAGE)).toBeInTheDocument();
  });
});
