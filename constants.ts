
import { BubbleColor } from './types';

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 720; 
export const BUBBLE_RADIUS = 20;
export const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
export const ROW_HEIGHT = BUBBLE_RADIUS * Math.sqrt(3);
export const GRID_COLS = 12;
export const GRID_ROWS = 17;

export const COLORS: Record<BubbleColor, string> = {
  pink: '#f472b6',
  orange: '#fb923c',
  yellow: '#facc15',
  green: '#4ade80',
  cyan: '#22d3ee',
  blue: '#3b82f6',
  bomb: '#1e293b', // Deep slate for bomb
};

export const COLOR_LIST: BubbleColor[] = ['pink', 'orange', 'yellow', 'green', 'cyan', 'blue'];
export const SPECIAL_LIST: BubbleColor[] = ['bomb'];

export const SHOT_SPEED = 22; // Faster ejection speed as requested
export const DANGER_ROW = 12; 
