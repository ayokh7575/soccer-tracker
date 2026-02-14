import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import App from './App';

// Mock localStorage since the App relies on it for persistence
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('SoccerTimeTracker App UI', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createTeamAndNavigate = (teamName: string) => {
    const input = screen.getByPlaceholderText(/Team name/i);
    const createButton = screen.getByRole('button', { name: /Create/i });

    fireEvent.change(input, { target: { value: teamName } });
    fireEvent.click(createButton);
  };

  const addPlayer = (firstName: string, lastName: string, number: string, position: string) => {
    fireEvent.change(screen.getByPlaceholderText(/First name/i), { target: { value: firstName } });
    fireEvent.change(screen.getByPlaceholderText(/Last name/i), { target: { value: lastName } });
    fireEvent.change(screen.getByPlaceholderText(/Number/i), { target: { value: number } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: position } });
    fireEvent.click(screen.getByRole('button', { name: /Add/i }));
  };

  test('renders the home screen correctly', () => {
    render(<App />);
    expect(screen.getByText(/Soccer Time Tracker/i)).toBeInTheDocument();
    expect(screen.getByText(/Create New Team/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Team name/i)).toBeInTheDocument();
  });

  test('allows creating a team and navigating to details', () => {
    render(<App />);
    createTeamAndNavigate('Tigers FC');

    // Verify we are on the detail page
    expect(screen.getByText('Tigers FC')).toBeInTheDocument();
    expect(screen.getByText(/Add Player/i)).toBeInTheDocument();
  });

  test('allows adding a player to a team', () => {
    render(<App />);
    createTeamAndNavigate('Lions FC');

    // Add a player
    addPlayer('Lionel', 'Messi', '10', 'CF');

    // Verify player is added
    expect(screen.getByText('Lionel Messi')).toBeInTheDocument();
    expect(screen.getByText('#10')).toBeInTheDocument();
    expect(screen.getByText('CF', { selector: 'span' })).toBeInTheDocument();
  });

  test('allows deleting a player from a team', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);
    render(<App />);
    createTeamAndNavigate('Bears FC');

    // Add player
    addPlayer('John', 'Doe', '99', 'GK');

    expect(screen.getByText('John Doe')).toBeInTheDocument();

    // Find the delete button in the player row and click it
    const playerRow = screen.getByText('John Doe').closest('[data-testid="player-row"]') as HTMLElement;
    const deleteButton = within(playerRow).getByRole('button', { name: /remove player/i });
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  test('allows clearing all players from a team', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);
    render(<App />);
    createTeamAndNavigate('Panthers FC');

    // Add player 1
    addPlayer('Player', 'One', '1', 'GK');

    // Add player 2
    addPlayer('Player', 'Two', '2', 'CB');

    expect(screen.getByText('Player One')).toBeInTheDocument();
    expect(screen.getByText('Player Two')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear All Players'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.queryByText('Player One')).not.toBeInTheDocument();
    expect(screen.queryByText('Player Two')).not.toBeInTheDocument();
    
    confirmSpy.mockRestore();
  });

  test('allows editing an existing player', () => {
    render(<App />);
    createTeamAndNavigate('Edit FC');

    // Add initial player
    addPlayer('Original', 'Name', '10', 'CF');
    expect(screen.getByText('Original Name')).toBeInTheDocument();

    // Find the edit button and click it
    const playerRow = screen.getByText('Original Name').closest('[data-testid="player-row"]') as HTMLElement;
    const editButton = within(playerRow).getByRole('button', { name: /edit player/i });
    fireEvent.click(editButton);

    // Update details
    fireEvent.change(screen.getByPlaceholderText(/First name/i), { target: { value: 'Updated' } });
    fireEvent.change(screen.getByPlaceholderText(/Last name/i), { target: { value: 'Player' } });
    fireEvent.change(screen.getByPlaceholderText(/Number/i), { target: { value: '99' } });
    
    // Click Update button
    fireEvent.click(screen.getByRole('button', { name: /Update/i }));

    // Verify updates
    expect(screen.getByText('Updated Player')).toBeInTheDocument();
    expect(screen.getByText('#99')).toBeInTheDocument();
    expect(screen.queryByText('Original Name')).not.toBeInTheDocument();
  });

  test('starts and cancels the game correctly', async () => {
    jest.useFakeTimers();
    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => false); // Deny save to history
    
    // Pre-populate a team with enough players for 1-4-3-3 formation
    const team = {
      id: 't1',
      name: 'Timer FC',
      players: [
        { id: 'p1', firstName: 'P', lastName: '1', number: '1', position: 'GK' },
        { id: 'p2', firstName: 'P', lastName: '2', number: '2', position: 'RB' },
        { id: 'p3', firstName: 'P', lastName: '3', number: '3', position: 'CB' },
        { id: 'p4', firstName: 'P', lastName: '4', number: '4', position: 'CB' },
        { id: 'p5', firstName: 'P', lastName: '5', number: '5', position: 'LB' },
        { id: 'p6', firstName: 'P', lastName: '6', number: '6', position: 'DM' },
        { id: 'p7', firstName: 'P', lastName: '7', number: '7', position: 'CM' },
        { id: 'p8', firstName: 'P', lastName: '8', number: '8', position: 'CM' },
        { id: 'p9', firstName: 'P', lastName: '9', number: '9', position: 'RW' },
        { id: 'p10', firstName: 'P', lastName: '10', number: '10', position: 'CF' },
        { id: 'p11', firstName: 'P', lastName: '11', number: '11', position: 'LW' },
      ]
    };
    window.localStorage.setItem('teams', JSON.stringify([team]));

    render(<App />);
    
    // Navigate to team and formation
    fireEvent.click(await screen.findByText('Timer FC'));
    fireEvent.click(screen.getByText('Set Formation & Start Game'));
    
    // Change formation to 1-4-3-3 to match our players
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1-4-3-3' } });
    
    // Auto assign and start
    fireEvent.click(screen.getByText('Auto-Assign Players'));
    fireEvent.change(screen.getByPlaceholderText('Enter game name...'), { target: { value: 'Finals' } });
    fireEvent.click(screen.getByText('Start Game'));
    
    // Verify initial state
    expect(screen.getByTestId('game-timer')).toHaveTextContent('00:00');
    
    // Advance time by 10 seconds
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(screen.getByTestId('game-timer')).toHaveTextContent('00:10');
    
    // Verify Cancel works
    const stopButton = screen.getByLabelText('End Game');
    fireEvent.click(stopButton);

    expect(screen.getByText(/Formation Setup/i)).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  test('allows substituting players during a game', async () => {
    jest.useFakeTimers();
    
    const team = {
      id: 't1',
      name: 'Sub FC',
      players: [
        { id: 'p1', firstName: 'GK', lastName: 'One', number: '1', position: 'GK' },
        { id: 'p2', firstName: 'RB', lastName: 'Two', number: '2', position: 'RB' },
        { id: 'p3', firstName: 'CB', lastName: 'Three', number: '3', position: 'CB' },
        { id: 'p4', firstName: 'CB', lastName: 'Four', number: '4', position: 'CB' },
        { id: 'p5', firstName: 'LB', lastName: 'Five', number: '5', position: 'LB' },
        { id: 'p6', firstName: 'RM', lastName: 'Six', number: '6', position: 'RM' },
        { id: 'p7', firstName: 'CM', lastName: 'Seven', number: '7', position: 'CM' },
        { id: 'p8', firstName: 'CM', lastName: 'Eight', number: '8', position: 'CM' },
        { id: 'p9', firstName: 'LM', lastName: 'Nine', number: '9', position: 'LM' },
        { id: 'p10', firstName: 'CF', lastName: 'Ten', number: '10', position: 'CF' },
        { id: 'p11', firstName: 'CF', lastName: 'Eleven', number: '11', position: 'CF' },
        { id: 'p12', firstName: 'Sub', lastName: 'Player', number: '12', position: 'CM' },
      ]
    };
    window.localStorage.setItem('teams', JSON.stringify([team]));

    render(<App />);
    
    // Navigate to game
    fireEvent.click(await screen.findByText('Sub FC'));
    fireEvent.click(screen.getByText('Set Formation & Start Game'));
    fireEvent.click(screen.getByText('Auto-Assign Players'));
    fireEvent.change(screen.getByPlaceholderText('Enter game name...'), { target: { value: 'Match 1' } });
    fireEvent.click(screen.getByText('Start Game'));

    // Find elements
    const starterName = 'G. One';
    const subName = 'S. Player';
    
    const subElement = screen.getByText(subName).closest('div[draggable="true"]');
    const starterElement = screen.getByText(starterName).closest('div[draggable="true"]');
    const targetSlot = starterElement?.parentElement;
    
    if (!subElement || !targetSlot) throw new Error('Elements not found');

    // Perform drag and drop
    const mockDataTransfer = {
      setData: jest.fn(),
      getData: jest.fn().mockReturnValue('p12'), // ID of the sub player
      types: ['text/plain'],
    };

    fireEvent.dragStart(subElement, { dataTransfer: mockDataTransfer });
    fireEvent.dragOver(targetSlot, { dataTransfer: mockDataTransfer });
    fireEvent.drop(targetSlot, { dataTransfer: mockDataTransfer });

    // Verify substitution
    const substitutesSection = screen.getByText('Substitutes - Drag to pitch').nextElementSibling as HTMLElement;
    const pitchSection = screen.getByText('Playing XI - Drag to substitute').nextElementSibling as HTMLElement;

    expect(within(substitutesSection).getByText(starterName)).toBeInTheDocument();
    expect(within(pitchSection).getByText(subName)).toBeInTheDocument();
  });

  test('saves finished game to history', async () => {
    jest.useFakeTimers();
    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);
    
    const team = {
      id: 't_history',
      name: 'History FC',
      players: [
        { id: 'p1', firstName: 'P', lastName: '1', number: '1', position: 'GK' },
        { id: 'p2', firstName: 'P', lastName: '2', number: '2', position: 'RB' },
        { id: 'p3', firstName: 'P', lastName: '3', number: '3', position: 'CB' },
        { id: 'p4', firstName: 'P', lastName: '4', number: '4', position: 'CB' },
        { id: 'p5', firstName: 'P', lastName: '5', number: '5', position: 'LB' },
        { id: 'p6', firstName: 'P', lastName: '6', number: '6', position: 'DM' },
        { id: 'p7', firstName: 'P', lastName: '7', number: '7', position: 'CM' },
        { id: 'p8', firstName: 'P', lastName: '8', number: '8', position: 'CM' },
        { id: 'p9', firstName: 'P', lastName: '9', number: '9', position: 'RW' },
        { id: 'p10', firstName: 'P', lastName: '10', number: '10', position: 'CF' },
        { id: 'p11', firstName: 'P', lastName: '11', number: '11', position: 'LW' },
      ]
    };
    window.localStorage.setItem('teams', JSON.stringify([team]));

    render(<App />);
    
    fireEvent.click(await screen.findByText('History FC'));
    fireEvent.click(screen.getByText('Set Formation & Start Game'));
    
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1-4-3-3' } });
    fireEvent.click(screen.getByText('Auto-Assign Players'));
    fireEvent.change(screen.getByPlaceholderText('Enter game name...'), { target: { value: 'Championship Final' } });
    fireEvent.click(screen.getByText('Start Game'));
    
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    
    const stopButton = screen.getByLabelText('End Game');
    fireEvent.click(stopButton);
    
    expect(confirmSpy).toHaveBeenCalledWith('Game ended. Save to history?');
    expect(screen.getByText('Game History')).toBeInTheDocument();
    expect(screen.getByText('Championship Final')).toBeInTheDocument();
    expect(screen.getByText(/History FC/)).toBeInTheDocument();
    expect(screen.getAllByText('01:00').length).toBeGreaterThan(0);
    
    confirmSpy.mockRestore();
  });
});