
import { 
  BUBBLE_RADIUS, 
  BUBBLE_DIAMETER, 
  ROW_HEIGHT, 
  GRID_COLS, 
  CANVAS_WIDTH 
} from '../constants';
import { GridPos, Point, BubbleColor } from '../types';

export const getBubbleCenter = (row: number, col: number): Point => {
  const isOffset = row % 2 !== 0;
  const x = col * BUBBLE_DIAMETER + BUBBLE_RADIUS + (isOffset ? BUBBLE_RADIUS : 0);
  const y = row * ROW_HEIGHT + BUBBLE_RADIUS;
  return { x, y };
};

export const getGridPos = (x: number, y: number): GridPos => {
  const row = Math.floor(y / ROW_HEIGHT);
  const isOffset = row % 2 !== 0;
  const col = Math.floor((x - (isOffset ? BUBBLE_RADIUS : 0)) / BUBBLE_DIAMETER);
  return { row, col };
};

export const getNeighbors = (row: number, col: number): GridPos[] => {
  const neighbors: GridPos[] = [];
  const isOffset = row % 2 !== 0;

  const offsets = isOffset 
    ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]
    : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];

  for (const [dr, dc] of offsets) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nc >= 0 && nc < (nr % 2 === 0 ? GRID_COLS : GRID_COLS - 0)) {
       // Note: Bubble shooter grids usually alternate between N and N-1 columns
       // but for simplicity we'll handle the boundary check strictly.
       if (nc < GRID_COLS) neighbors.push({ row: nr, col: nc });
    }
  }
  return neighbors;
};

export const findCluster = (
  grid: (BubbleColor | null)[][], 
  startRow: number, 
  startCol: number, 
  matchColor: BubbleColor | null = null
): GridPos[] => {
  const color = matchColor || grid[startRow][startCol];
  if (!color) return [];

  const cluster: GridPos[] = [];
  const queue: GridPos[] = [{ row: startRow, col: startCol }];
  const visited = new Set<string>();
  visited.add(`${startRow},${startCol}`);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    cluster.push(curr);

    const neighbors = getNeighbors(curr.row, curr.col);
    for (const neighbor of neighbors) {
      const key = `${neighbor.row},${neighbor.col}`;
      if (!visited.has(key) && grid[neighbor.row] && grid[neighbor.row][neighbor.col] === color) {
        visited.add(key);
        queue.push(neighbor);
      }
    }
  }
  return cluster;
};

export const findFloatingBubbles = (grid: (BubbleColor | null)[][]): GridPos[] => {
  const connectedToTop = new Set<string>();
  const queue: GridPos[] = [];

  // Start BFS from the top row
  for (let col = 0; col < GRID_COLS; col++) {
    if (grid[0][col]) {
      queue.push({ row: 0, col });
      connectedToTop.add(`0,${col}`);
    }
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = getNeighbors(curr.row, curr.col);
    for (const neighbor of neighbors) {
      const key = `${neighbor.row},${neighbor.col}`;
      if (!connectedToTop.has(key) && grid[neighbor.row] && grid[neighbor.row][neighbor.col]) {
        connectedToTop.add(key);
        queue.push(neighbor);
      }
    }
  }

  const floating: GridPos[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c] && !connectedToTop.has(`${r},${c}`)) {
        floating.push({ row: r, col: c });
      }
    }
  }
  return floating;
};
