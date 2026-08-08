import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

// Mock Neon: an authenticated session (so AuthGate renders the app) and a
// chainable, awaitable query builder (plain functions so mock resets won't wipe
// them). The app's flows are driven by in-memory React state, so the data layer
// being a no-op here is fine for these UI tests.
vi.mock('./neonClient', () => {
  const q: any = {};
  for (const m of ['select', 'order', 'upsert', 'insert', 'delete', 'eq', 'not']) {
    q[m] = () => q;
  }
  q.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: [], error: null });
  return {
    neon: {
      from: () => q,
      auth: {
        useSession: () => ({
          isPending: false,
          data: { user: { id: 'test-user', email: 'test@example.com' } },
        }),
        signOut: () => Promise.resolve(),
        emailOtp: { sendVerificationOtp: async () => ({ error: null }) },
        signIn: { emailOtp: async () => ({ error: null }) },
      },
    },
  };
});

vi.mock('./UserManual', () => ({
  UserManual: () => <div>User Manual Mock</div>
}));

// Mock scrollIntoView (not implemented in jsdom)
window.HTMLElement.prototype.scrollIntoView = function() {};

beforeEach(() => {
  window.confirm = vi.fn(() => true);
  window.alert = vi.fn();
});

describe('SoccerTimeTracker Substitution Tests', () => {
  const createTeamAndStartGame = async () => {
    render(<App />);

    // Wait for the auth gate to resolve and the home screen to render.
    const teamNameInput = await screen.findByPlaceholderText('Team name');

    // 1. Create Team
    fireEvent.change(teamNameInput, { target: { value: 'Test Team' } });
    fireEvent.click(screen.getByText('Create'));
    // The team is only opened once the save resolves, so wait for that view.
    await screen.findByPlaceholderText('First name');

    // 2. Add Players for 1-4-4-2 (GK, RB, CBx2, LB, RM, CMx2, LM, CFx2)
    const positions = ['GK', 'RB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CM', 'LM', 'CF', 'CF'];

    const addPlayer = (firstName: string, number: string, position: string) => {
      fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: firstName } });
      fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Doe' } });
      fireEvent.change(screen.getByPlaceholderText('Number'), { target: { value: number } });
      const positionSelect = screen.getByRole('combobox', { name: "Player Position" });
      fireEvent.change(positionSelect, { target: { value: position } });
      fireEvent.click(screen.getByRole('button', { name: /Add/i }));
    };

    positions.forEach((pos, index) => {
      addPlayer(`Player${index}`, `${index + 1}`, pos);
    });

    // Add a Bench Player
    addPlayer('BenchPlayer', '99', 'CF');

    // 3. Go to Formation
    fireEvent.click(screen.getByText('Set Formation & Start Game'));

    // 4. Auto Assign
    fireEvent.click(screen.getByText('Auto-Assign Players'));

    // 5. Start Game
    fireEvent.change(screen.getByPlaceholderText('Enter game name...'), { target: { value: 'Test Game' } });
    fireEvent.click(screen.getByText('Start Game'));
  };

  test('performs substitution correctly using click interaction', async () => {
    await createTeamAndStartGame();

    // Verify we are in game view
    expect(screen.getByText('Test Game')).toBeInTheDocument();

    // Locate Bench Player (BenchPlayer #99)
    const benchPlayerNumber = screen.getByText('#99');
    const benchPlayerCard = benchPlayerNumber.closest('div.relative');
    expect(benchPlayerCard).toBeInTheDocument();

    // Locate a Field Player (Player0 #1 - GK)
    const fieldPlayerNumber = screen.getByText('#1');
    const fieldPlayerCard = fieldPlayerNumber.closest('div.bg-white');
    expect(fieldPlayerCard).toBeInTheDocument();

    // --- Step 1: Select Bench Player ---
    fireEvent.click(benchPlayerCard!);
    expect(benchPlayerCard?.className).toContain('ring-green-500');

    // --- Step 2: Select Field Player ---
    fireEvent.click(fieldPlayerCard!);
    expect(fieldPlayerCard?.className).toContain('ring-red-500');

    // --- Step 3: Verify Substitute Button Appears ---
    const subButton = screen.getByText(/Substitute \(1\)/i);
    expect(subButton).toBeInTheDocument();

    // --- Step 4: Perform Substitution ---
    fireEvent.click(subButton);

    // --- Step 5: Verify Swap ---
    const substitutesSection = screen.getByTestId('substitutes-container');
    expect(substitutesSection).not.toHaveTextContent('#99');
    expect(substitutesSection).toHaveTextContent('#1');
  });

  test('can cancel substitution selection', async () => {
    await createTeamAndStartGame();

    const benchPlayerNumber = screen.getByText('#99');
    const benchPlayerCard = benchPlayerNumber.closest('div.relative');

    // Select bench player
    fireEvent.click(benchPlayerCard!);
    expect(benchPlayerCard?.className).toContain('ring-green-500');

    // Cancel button should appear
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Selection should be cleared
    expect(benchPlayerCard?.className).not.toContain('ring-green-500');
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  test('deselects bench player on second click', async () => {
    await createTeamAndStartGame();

    const benchPlayerNumber = screen.getByText('#99');
    const benchPlayerCard = benchPlayerNumber.closest('div.relative');

    // Select
    fireEvent.click(benchPlayerCard!);
    expect(benchPlayerCard?.className).toContain('ring-green-500');

    // Deselect
    fireEvent.click(benchPlayerCard!);
    expect(benchPlayerCard?.className).not.toContain('ring-green-500');
  });
});

describe('SoccerTimeTracker Player Management', () => {
  const createTeam = async () => {
    render(<App />);
    const teamNameInput = await screen.findByPlaceholderText('Team name');
    fireEvent.change(teamNameInput, { target: { value: 'Test Team' } });
    fireEvent.click(screen.getByText('Create'));
    // The team is only opened once the save resolves, so wait for that view.
    await screen.findByPlaceholderText('First name');
  };

  test('creates a player with a secondary position', async () => {
    await createTeam();

    // Fill player form
    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByPlaceholderText('Number'), { target: { value: '10' } });

    fireEvent.change(screen.getByRole('combobox', { name: "Player Position" }), { target: { value: 'CF' } });

    const secondaryPositionButton = screen.getByLabelText('Secondary Positions');
    fireEvent.click(secondaryPositionButton);

    fireEvent.click(screen.getByRole('checkbox', { name: 'AM' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'RW' }));

    // Click Add
    fireEvent.click(screen.getByRole('button', { name: /Add/i }));

    // Verify player is in the list with both positions
    const playerRow = screen.getByTestId('player-row');
    expect(playerRow).toHaveTextContent('John Doe');
    expect(playerRow).toHaveTextContent('CF / AM / RW');
  });

  test('edits a player to add a secondary position', async () => {
    await createTeam();

    // Add a player without secondary position first
    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Smith' } });
    fireEvent.change(screen.getByPlaceholderText('Number'), { target: { value: '9' } });
    const positionSelect = screen.getByRole('combobox', { name: "Player Position" });
    fireEvent.change(positionSelect, { target: { value: 'CF' } });
    fireEvent.click(screen.getByRole('button', { name: /Add/i }));

    const playerRow = screen.getByTestId('player-row');
    expect(playerRow).toHaveTextContent('Jane Smith');
    expect(playerRow).not.toHaveTextContent('/');

    // Click edit
    fireEvent.click(screen.getByLabelText('Edit player'));

    const secondaryPositionButton = screen.getByLabelText('Secondary Positions');
    fireEvent.click(secondaryPositionButton);
    fireEvent.click(screen.getByRole('checkbox', { name: 'LW' }));

    fireEvent.click(screen.getByRole('button', { name: /Update/i }));

    expect(playerRow).toHaveTextContent('CF / LW');
  });

  test('auto-assigns players using secondary position if primary does not match', async () => {
    await createTeam();

    // Add a Goalkeeper (Primary match)
    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Goalie' } });
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'McGoal' } });
    fireEvent.change(screen.getByPlaceholderText('Number'), { target: { value: '1' } });
    let positionSelect = screen.getByRole('combobox', { name: "Player Position" });
    fireEvent.change(positionSelect, { target: { value: 'GK' } });
    fireEvent.click(screen.getByRole('button', { name: /Add/i }));

    // Add a Striker (Secondary match) - Primary RW (not in 1-4-4-2), Secondary CF
    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Striker' } });
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'McStrike' } });
    fireEvent.change(screen.getByPlaceholderText('Number'), { target: { value: '9' } });
    fireEvent.change(screen.getByRole('combobox', { name: "Player Position" }), { target: { value: 'RW' } });

    const secondaryPositionButton = screen.getByLabelText('Secondary Positions');
    fireEvent.click(secondaryPositionButton);
    fireEvent.click(screen.getByRole('checkbox', { name: 'CF' }));

    fireEvent.click(screen.getByRole('button', { name: /Add/i }));

    // Go to Formation
    fireEvent.click(screen.getByText('Set Formation & Start Game'));

    // Auto Assign
    fireEvent.click(screen.getByText('Auto-Assign Players'));

    // Verify assignments
    expect(screen.getByText('G. McGoal')).toBeInTheDocument();
    expect(screen.getByText('S. McStrike')).toBeInTheDocument();
  });
});
