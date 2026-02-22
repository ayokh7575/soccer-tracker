import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { ACCESS_CODE_HASH } from './accessConfig';

// Mock window.confirm
window.confirm = jest.fn(() => true);
window.alert = jest.fn();

// Mock localStorage
const localStorageMock = (function() {
  let store: Record<string, string> = {};
  return {
    getItem: function(key: string) {
      return store[key] || null;
    },
    setItem: function(key: string, value: string) {
      store[key] = value.toString();
    },
    clear: function() {
      store = {};
    },
    removeItem: function(key: string) {
      delete store[key];
    },
    key: function(index: number) {
      return Object.keys(store)[index] || null;
    },
    length: 0
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = (function() {
  let store: Record<string, string> = {};
  return {
    getItem: function(key: string) {
      return store[key] || null;
    },
    setItem: function(key: string, value: string) {
      store[key] = value.toString();
    },
    clear: function() {
      store = {};
    },
    removeItem: function(key: string) {
      delete store[key];
    },
    key: function(index: number) {
      return Object.keys(store)[index] || null;
    },
    length: 0
  };
})();
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = function() {};

describe('SoccerTimeTracker Substitution Tests', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem('soccer_tracker_auth', ACCESS_CODE_HASH);
    jest.clearAllMocks();
  });

  const createTeamAndStartGame = () => {
    render(<App />);

    // 1. Create Team
    const teamNameInput = screen.getByPlaceholderText('Team name');
    fireEvent.change(teamNameInput, { target: { value: 'Test Team' } });
    fireEvent.click(screen.getByText('Create'));

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

  test('performs substitution correctly using click interaction', () => {
    createTeamAndStartGame();

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
    
    // Check for Green Ring
    expect(benchPlayerCard?.className).toContain('ring-green-500');

    // --- Step 2: Select Field Player ---
    fireEvent.click(fieldPlayerCard!);

    // Check for Red Ring
    expect(fieldPlayerCard?.className).toContain('ring-red-500');

    // --- Step 3: Verify Substitute Button Appears ---
    const subButton = screen.getByText(/Substitute \(1\)/i);
    expect(subButton).toBeInTheDocument();

    // --- Step 4: Perform Substitution ---
    fireEvent.click(subButton);

    // --- Step 5: Verify Swap ---
    // Bench player (#99) should now be on the field (not in substitutes section)
    // Field player (#1) should now be in the substitutes section
    
    const substitutesSection = screen.getByText('Substitutes - Drag to pitch').closest('div')?.nextElementSibling;
    expect(substitutesSection).not.toHaveTextContent('#99');
    expect(substitutesSection).toHaveTextContent('#1');
  });

  test('can cancel substitution selection', () => {
    createTeamAndStartGame();

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

  test('deselects bench player on second click', () => {
    createTeamAndStartGame();

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
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem('soccer_tracker_auth', ACCESS_CODE_HASH);
    jest.clearAllMocks();
  });

  const createTeam = () => {
    render(<App />);
    const teamNameInput = screen.getByPlaceholderText('Team name');
    fireEvent.change(teamNameInput, { target: { value: 'Test Team' } });
    fireEvent.click(screen.getByText('Create'));
  };

  test('creates a player with a secondary position', () => {
    createTeam();

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

  test('edits a player to add a secondary position', () => {
    createTeam();

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

  test('auto-assigns players using secondary position if primary does not match', () => {
    createTeam();

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