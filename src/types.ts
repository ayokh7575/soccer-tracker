export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  number: string;
  position: string;
  isUnavailable?: boolean;
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
}