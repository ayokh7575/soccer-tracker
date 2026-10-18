import { migrateLocalData, hasLocalDataToMigrate, hasPartialMigration, MigrationIncompleteError } from './migrateLocalData';

// Each table's next insert can be made to fail; every successful insert is recorded.
const inserted: Record<string, any[]> = { teams: [], players: [], games: [] };
const failNext: Record<string, boolean> = {};
vi.mock('./neonClient', () => ({
  neon: {
    from: (table: string) => ({
      insert: async (rows: any) => {
        if (failNext[table]) {
          failNext[table] = false;
          return { error: { message: 'network down' } };
        }
        inserted[table].push(...(Array.isArray(rows) ? rows : [rows]));
        return { error: null };
      },
    }),
  },
}));

const seedLocalData = () => {
  localStorage.setItem('teams', JSON.stringify([
    { id: 'old1', name: 'U12', players: [{ firstName: 'A', lastName: 'B', number: '1', position: 'GK' }] },
    { id: 'old2', name: 'U14', players: [{ firstName: 'C', lastName: 'D', number: '2', position: 'CB' }] },
  ]));
  localStorage.setItem('gameHistory', JSON.stringify([
    { name: 'G1', teamName: 'U12', date: '2025-01-01T00:00:00Z', teamScore: 1, opponentScore: 0, totalTime: 10, playerStats: [] },
  ]));
};

describe('migrateLocalData', () => {
  beforeEach(() => {
    localStorage.clear();
    for (const k of Object.keys(inserted)) inserted[k] = [];
    for (const k of Object.keys(failNext)) delete failNext[k];
    seedLocalData();
  });

  test('imports everything and marks the device as migrated', async () => {
    await expect(migrateLocalData()).resolves.toEqual({ teams: 2, players: 2, games: 1 });
    expect(hasLocalDataToMigrate()).toBe(false);
    expect(hasPartialMigration()).toBe(false);
    expect(inserted.games[0].team_id).toBe(inserted.teams[0].id);
  });

  test('a failure leaves the import retryable, and the retry does not duplicate', async () => {
    failNext.players = true; // U12's players fail; U14 and the games succeed

    await expect(migrateLocalData()).rejects.toBeInstanceOf(MigrationIncompleteError);
    expect(hasLocalDataToMigrate()).toBe(true);
    expect(hasPartialMigration()).toBe(true);
    expect(inserted.teams).toHaveLength(2);

    await expect(migrateLocalData()).resolves.toEqual({ teams: 0, players: 1, games: 0 });
    expect(inserted.teams).toHaveLength(2);
    expect(inserted.players).toHaveLength(2);
    expect(inserted.games).toHaveLength(1);
    // The retried players went into the team created the first time.
    expect(inserted.players.map(p => p.team_id).sort()).toEqual(inserted.teams.map(t => t.id).sort());
    expect(hasLocalDataToMigrate()).toBe(false);
  });

  test('games that failed are retried and still linked to their team', async () => {
    failNext.games = true;
    await expect(migrateLocalData()).rejects.toThrow(/game history/);
    await migrateLocalData();
    expect(inserted.teams).toHaveLength(2);
    expect(inserted.games).toHaveLength(1);
    expect(inserted.games[0].team_id).toBe(inserted.teams[0].id);
  });
});
