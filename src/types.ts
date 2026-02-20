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
  players: Player[];
}

export type GameAction = { type: 'goal'; playerId: string } | { type: 'redCard'; playerId: string; fromSlot?: string };