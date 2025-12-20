
export type BubbleColor = 'pink' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'bomb';

export interface Bubble {
  color: BubbleColor;
  id: string;
}

export interface GridPos {
  row: number;
  col: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface LevelData {
  name: string;
  grid: (BubbleColor | null)[][];
  description: string;
}

export enum GameStatus {
  START = 'START',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAMEOVER = 'GAMEOVER',
  WON = 'WON'
}
