import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

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

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = function() {};

describe('SoccerTimeTracker Substitution Tests', () => {
  beforeEach(() => {
    window.localStorage.clear();
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
      fireEvent.change(screen.getByRole('combobox'), { target: { value: position } });
      fireEvent.click(screen.getByText('Add'));
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
    
    const substitutesSection = screen.getByText('Substitutes - Drag to pitch').nextElementSibling;
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