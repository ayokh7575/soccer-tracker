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

  test('allows toggling player availability', () => {
    render(<App />);
    createTeamAndNavigate('Availability FC');

    // Add a player
    addPlayer('Test', 'Player', '1', 'GK');

    // Verify initial state (Available)
    expect(screen.queryByText('(Unavailable)')).not.toBeInTheDocument();
    const toggleButton = screen.getByRole('button', { name: /Mark as unavailable/i });
    expect(toggleButton).toBeInTheDocument();

    // Toggle to Unavailable
    fireEvent.click(toggleButton);

    // Verify unavailable state
    expect(screen.getByText('(Unavailable)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark as available/i })).toBeInTheDocument();

    // Toggle back to Available
    fireEvent.click(screen.getByRole('button', { name: /Mark as available/i }));

    // Verify available state again
    expect(screen.queryByText('(Unavailable)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark as unavailable/i })).toBeInTheDocument();
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
    expect(screen.getByText('History FC History')).toBeInTheDocument();
    expect(screen.getByText('Championship Final')).toBeInTheDocument();
    expect(screen.getAllByText(/History FC/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('01:00').length).toBeGreaterThan(0);
    
    confirmSpy.mockRestore();
  });

  test('allows importing a team from CSV', async () => {
    const fileContent = 'First Name, Last Name, Number, Position\nImported, Player, 99, GK';
    const file = new File([fileContent], 'Imported Team.csv', { type: 'text/csv' });

    // Mock FileReader
    const originalFileReader = window.FileReader;
    const mockFileReader = class {
      onload: any = null;
      readAsText() {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: fileContent } });
          }
        }, 0);
      }
    } as any;
    
    Object.defineProperty(window, 'FileReader', {
      value: mockFileReader,
      writable: true
    });

    render(<App />);
    
    const input = screen.getByLabelText(/Import Team CSV/i);
    
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('Imported Team')).toBeInTheDocument();
    expect(screen.getByText('Imported Player')).toBeInTheDocument();
    expect(screen.getByText('#99')).toBeInTheDocument();

    // Restore
    Object.defineProperty(window, 'FileReader', {
      value: originalFileReader,
      writable: true
    });
  });

  test('allows exporting game history to CSV', () => {
    // Mock URL.createObjectURL
    const originalCreateObjectURL = window.URL.createObjectURL;
    window.URL.createObjectURL = jest.fn(() => 'blob:mock');

    // Mock HTMLAnchorElement.prototype.click to prevent JSDOM navigation error
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = jest.fn();
    
    // Setup history data
    const gameRecord = {
      id: 'g1',
      date: new Date().toISOString(),
      name: 'Export Match',
      teamName: 'Export FC',
      totalTime: 3600,
      playerStats: [
        { id: 'p1', name: 'Player One', number: '1', time: 3600 }
      ]
    };
    const team = {
      id: 't_export',
      name: 'Export FC',
      players: []
    };
    window.localStorage.setItem('teams', JSON.stringify([team]));
    window.localStorage.setItem('gameHistory', JSON.stringify([gameRecord]));

    render(<App />);
    
    // Navigate to history via team
    fireEvent.click(screen.getByText('Export FC'));
    fireEvent.click(screen.getByText('History'));
    
    // Check if export button exists
    const exportButton = screen.getByText('Export CSV');
    expect(exportButton).toBeInTheDocument();
    
    // Click export
    fireEvent.click(exportButton);
    
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    
    // Restore
    if (originalCreateObjectURL) {
      window.URL.createObjectURL = originalCreateObjectURL;
    } else {
      // @ts-ignore
      delete window.URL.createObjectURL;
    }
    HTMLAnchorElement.prototype.click = originalClick;
  });

  test('displays aggregated player stats for a team', async () => {
    // Setup history data with two games
    const team = {
      id: 't_stats',
      name: 'Stats FC',
      players: [
        { id: 'p1', firstName: 'Player', lastName: 'One', number: '1', position: 'GK' },
        { id: 'p2', firstName: 'Player', lastName: 'Two', number: '2', position: 'CB' }
      ]
    };
    const game1 = {
      id: 'g1',
      date: new Date().toISOString(),
      name: 'Game 1',
      teamName: 'Stats FC',
      totalTime: 3600,
      playerStats: [
        { id: 'p1', name: 'Player One', number: '1', time: 3600 },
        { id: 'p2', name: 'Player Two', number: '2', time: 1800 }
      ]
    };
    const game2 = {
      id: 'g2',
      date: new Date().toISOString(),
      name: 'Game 2',
      teamName: 'Stats FC',
      totalTime: 3600,
      playerStats: [
        { id: 'p1', name: 'Player One', number: '1', time: 3600 }, // Total 7200 (120:00)
        { id: 'p2', name: 'Player Two', number: '2', time: 0 }    // Total 1800 (30:00), 1 game played
      ]
    };
    window.localStorage.setItem('teams', JSON.stringify([team]));
    window.localStorage.setItem('gameHistory', JSON.stringify([game1, game2]));

    render(<App />);
    
    // Navigate to team then stats
    fireEvent.click(await screen.findByText('Stats FC'));
    fireEvent.click(screen.getByText('Team Stats'));
    
    // Check Player One
    const row1 = screen.getByText(/Player One/).closest('tr');
    expect(within(row1!).getByText('2')).toBeInTheDocument(); // 2 games
    expect(within(row1!).getByText('120:00')).toBeInTheDocument(); // Total time

    // Check Player Two
    const row2 = screen.getByText(/Player Two/).closest('tr');
    expect(within(row2!).getByText('1')).toBeInTheDocument(); // 1 game (since time was 0 in second game)
    expect(within(row2!).getByText('30:00')).toBeInTheDocument(); // Total time
  });

  test('allows undoing a recorded goal', async () => {
    jest.useFakeTimers();
    const confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true);
    
    const team = {
      id: 't_goals',
      name: 'Goals FC',
      players: [
        { id: 'p1', firstName: 'Striker', lastName: 'One', number: '9', position: 'CF' },
        { id: 'p2', firstName: 'P', lastName: '2', number: '1', position: 'GK' },
        { id: 'p3', firstName: 'P', lastName: '3', number: '2', position: 'CB' },
        { id: 'p4', firstName: 'P', lastName: '4', number: '3', position: 'CB' },
        { id: 'p5', firstName: 'P', lastName: '5', number: '4', position: 'LB' },
        { id: 'p6', firstName: 'P', lastName: '6', number: '5', position: 'RB' },
        { id: 'p7', firstName: 'P', lastName: '7', number: '6', position: 'CM' },
        { id: 'p8', firstName: 'P', lastName: '8', number: '7', position: 'CM' },
        { id: 'p9', firstName: 'P', lastName: '9', number: '8', position: 'LM' },
        { id: 'p10', firstName: 'P', lastName: '10', number: '10', position: 'RM' },
        { id: 'p11', firstName: 'P', lastName: '11', number: '11', position: 'CF' },
      ]
    };
    window.localStorage.setItem('teams', JSON.stringify([team]));

    render(<App />);
    
    // Start game
    fireEvent.click(await screen.findByText('Goals FC'));
    fireEvent.click(screen.getByText('Set Formation & Start Game'));
    fireEvent.click(screen.getByText('Auto-Assign Players'));
    fireEvent.change(screen.getByPlaceholderText('Enter game name...'), { target: { value: 'Goal Match' } });
    fireEvent.click(screen.getByText('Start Game'));

    // Score a goal
    fireEvent.click(screen.getByText('S. One'));

    expect(confirmSpy).toHaveBeenCalledWith('Goal scored by S. One?');
    expect(screen.getByText('⚽ 1')).toBeInTheDocument();

    // Undo goal
    fireEvent.click(screen.getByLabelText('Undo Last Goal'));
    expect(confirmSpy).toHaveBeenCalledWith('Undo last goal by S. One?');
    expect(screen.queryByText('⚽ 1')).not.toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  test('filters game history by team', async () => {
    const teamA = {
      id: 't_a',
      name: 'Team A',
      players: []
    };
    const teamB = {
      id: 't_b',
      name: 'Team B',
      players: []
    };
    
    const gameA = {
      id: 'g_a',
      date: new Date().toISOString(),
      name: 'Match A',
      teamName: 'Team A',
      totalTime: 3600,
      playerStats: []
    };
    const gameB = {
      id: 'g_b',
      date: new Date().toISOString(),
      name: 'Match B',
      teamName: 'Team B',
      totalTime: 3600,
      playerStats: []
    };

    window.localStorage.setItem('teams', JSON.stringify([teamA, teamB]));
    window.localStorage.setItem('gameHistory', JSON.stringify([gameA, gameB]));

    render(<App />);
    
    fireEvent.click(await screen.findByText('Team A'));
    fireEvent.click(screen.getByText('History'));
    
    expect(screen.getByText('Match A')).toBeInTheDocument();
    expect(screen.queryByText('Match B')).not.toBeInTheDocument();
  });

  test('sorts player stats', async () => {
    const team = {
      id: 't_sort',
      name: 'Sort FC',
      players: [
        { id: 'p1', firstName: 'A', lastName: 'Player', number: '1', position: 'GK' },
        { id: 'p2', firstName: 'B', lastName: 'Player', number: '2', position: 'CB' }
      ]
    };
    
    // Game where P1 plays 10s, P2 plays 20s
    const game = {
      id: 'g_sort',
      date: new Date().toISOString(),
      name: 'Sort Match',
      teamName: 'Sort FC',
      totalTime: 60,
      playerStats: [
        { id: 'p1', name: 'A. Player', number: '1', time: 10, goals: 0 },
        { id: 'p2', name: 'B. Player', number: '2', time: 20, goals: 1 }
      ]
    };

    window.localStorage.setItem('teams', JSON.stringify([team]));
    window.localStorage.setItem('gameHistory', JSON.stringify([game]));

    render(<App />);
    
    fireEvent.click(await screen.findByText('Sort FC'));
    fireEvent.click(screen.getByText('Team Stats'));

    // Default sort is Total Time DESC -> P2 (20s) should be before P1 (10s)
    const rows = screen.getAllByRole('row');
    // rows[0] is header
    expect(rows[1]).toHaveTextContent('B. Player');
    expect(rows[2]).toHaveTextContent('A. Player');

    // Sort by Number ASC
    fireEvent.click(screen.getByText(/Number/));
    const rowsAsc = screen.getAllByRole('row');
    expect(rowsAsc[1]).toHaveTextContent('A. Player'); // #1
    expect(rowsAsc[2]).toHaveTextContent('B. Player'); // #2

    // Sort by Number DESC
    fireEvent.click(screen.getByText(/Number/));
    const rowsDesc = screen.getAllByRole('row');
    expect(rowsDesc[1]).toHaveTextContent('B. Player'); // #2
    expect(rowsDesc[2]).toHaveTextContent('A. Player'); // #1
  });
});