// Positions and formation layouts (x/y are % of the pitch, GK at the bottom).

export const POSITIONS = ['GK', 'CB', 'RB', 'LB', 'DM', 'CM', 'RM', 'LM', 'AM', 'LW', 'RW', 'CF'];
export const FORMATIONS_BY_SIDE: Record<9 | 11, string[]> = {
  11: ['1-4-4-2', '1-4-3-3'],
  9:  ['1-3-3-2', '1-4-3-1'],
};

export type SlotPosition = { x: number; y: number };

export const FORMATION_LAYOUTS: Record<string, Record<string, SlotPosition>> = {
  '1-4-4-2': {
    GK:  { x: 50, y: 88 },
    RB:  { x: 85, y: 65 },
    CB:  { x: 65, y: 75 },
    CB2: { x: 35, y: 75 },
    LB:  { x: 15, y: 65 },
    RM:  { x: 88, y: 42 },
    CM:  { x: 65, y: 42 },
    CM2: { x: 35, y: 42 },
    LM:  { x: 12, y: 42 },
    CF:  { x: 65, y: 15 },
    CF2: { x: 35, y: 15 }
  },
  '1-4-3-3': {
    GK:  { x: 50, y: 88 },
    RB:  { x: 88, y: 65 },
    CB:  { x: 68, y: 75 },
    CB2: { x: 32, y: 75 },
    LB:  { x: 12, y: 65 },
    DM:  { x: 50, y: 52 },
    CM:  { x: 75, y: 40 },
    CM2: { x: 25, y: 40 },
    RW:  { x: 85, y: 18 },
    CF:  { x: 50, y: 12 },
    LW:  { x: 15, y: 18 }
  },
  '1-3-3-2': {
    GK:  { x: 50, y: 88 },
    LB:  { x: 25, y: 63 },
    CB:  { x: 50, y: 63 },
    RB:  { x: 75, y: 63 },
    LM:  { x: 20, y: 37 },
    CM:  { x: 50, y: 37 },
    RM:  { x: 80, y: 37 },
    CF:  { x: 35, y: 12 },
    CF2: { x: 65, y: 12 }
  },
  '1-4-3-1': {
    GK:  { x: 50, y: 88 },
    LB:  { x: 15, y: 63 },
    CB:  { x: 38, y: 63 },
    CB2: { x: 62, y: 63 },
    RB:  { x: 85, y: 63 },
    LM:  { x: 20, y: 37 },
    CM:  { x: 50, y: 37 },
    RM:  { x: 80, y: 37 },
    CF:  { x: 50, y: 12 }
  }
};
