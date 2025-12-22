export const GAME_TYPES = {
  LOGIC: 'logic',
  MEMORY: 'memory',
  SPEED: 'speed',
  SKILL: 'skill',
} as const;

export type GameType = typeof GAME_TYPES[keyof typeof GAME_TYPES];

export interface GameConfig {
  gameType: GameType;
  [key: string]: any;
}

