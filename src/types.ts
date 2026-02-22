export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  number: string;
  position: string;
  secondaryPositions?: string[];
  isUnavailable?: boolean;
}

export interface Team {
  id: string;
  name: string;
  defaultGameDuration?: number;
  players: Player[];
}

export type GameAction = 
  | { type: 'goal'; playerId: string } 
  | { type: 'opponentGoal' }
  | { type: 'redCard'; playerId: string; fromSlot?: string }
  | { type: 'yellowCard'; playerId: string; resultedInRed?: boolean; fromSlot?: string };