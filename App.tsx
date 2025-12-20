
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  BUBBLE_RADIUS, 
  COLORS, 
  COLOR_LIST, 
  SPECIAL_LIST,
  SHOT_SPEED, 
  GRID_ROWS, 
  GRID_COLS,
  BUBBLE_DIAMETER,
  DANGER_ROW,
  ROW_HEIGHT
} from './constants';
import { BubbleColor, GameStatus, Point, GridPos } from './types';
import { 
  getBubbleCenter, 
  getGridPos, 
  findCluster, 
  findFloatingBubbles,
  getNeighbors
} from './utils/gameLogic';
import { generateLevel, getCommentary } from './services/geminiService';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<(BubbleColor | null)[][]>(() => 
    Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null))
  );
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [score, setScore] = useState(0);
  const [commentary, setCommentary] = useState("准备好了吗？");
  const [loading, setLoading] = useState(false);
  
  const [nextColor, setNextColor] = useState<BubbleColor>(COLOR_LIST[0]);
  const [currentColor, setCurrentColor] = useState<BubbleColor>(COLOR_LIST[1]);
  
  const [cannonAngle, setCannonAngle] = useState(Math.PI / 2);
  const [shot, setShot] = useState<{ pos: Point, velocity: Point, color: BubbleColor } | null>(null);

  const gridRef = useRef(grid);
  gridRef.current = grid;

  const keysPressed = useRef<Set<string>>(new Set());

  const getNextBubble = () => {
    // 10% chance to get a bomb as a special shot
    if (Math.random() < 0.1) return 'bomb' as BubbleColor;
    return COLOR_LIST[Math.floor(Math.random() * COLOR_LIST.length)];
  };

  const initLevel = async () => {
    setLoading(true);
    try {
      const level = await generateLevel(1);
      const newGrid = Array(GRID_ROWS).fill(null).map((_, r) => 
        Array(GRID_COLS).fill(null).map((_, c) => (level.grid[r]?.[c] as BubbleColor) || null)
      );
      setGrid(newGrid);
      setStatus(GameStatus.PLAYING);
      setScore(0);
      setCurrentColor(getNextBubble());
      setNextColor(getNextBubble());
    } catch (e) {
      console.error(e);
      const fallbackGrid = Array(GRID_ROWS).fill(null).map((_, r) => 
        r < 6 ? Array(GRID_COLS).fill(null).map(() => COLOR_LIST[Math.floor(Math.random() * COLOR_LIST.length)]) : Array(GRID_COLS).fill(null)
      );
      setGrid(fallbackGrid);
      setStatus(GameStatus.PLAYING);
    } finally {
      setLoading(false);
    }
  };

  const handleShoot = useCallback(() => {
    if (status !== GameStatus.PLAYING || shot) return;
    
    const velocity = {
      x: Math.cos(cannonAngle) * SHOT_SPEED,
      y: -Math.sin(cannonAngle) * SHOT_SPEED
    };
    
    setShot({
      pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 60 },
      velocity,
      color: currentColor
    });
    
    setCurrentColor(nextColor);
    setNextColor(getNextBubble());
  }, [status, shot, cannonAngle, currentColor, nextColor]);

  const swapBubbles = useCallback(() => {
    const temp = currentColor;
    setCurrentColor(nextColor);
    setNextColor(temp);
  }, [currentColor, nextColor]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);
      if (e.code === 'ArrowUp' || e.code === 'Space') {
        handleShoot();
      }
      if (e.code === 'ArrowDown') {
        swapBubbles();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleShoot, swapBubbles]);

  useEffect(() => {
    let frameId: number;
    const rotateSpeed = 0.05; // Slightly faster rotation to match faster shots

    const updateRotation = () => {
      if (status === GameStatus.PLAYING) {
        if (keysPressed.current.has('ArrowLeft')) {
          setCannonAngle(prev => Math.min(prev + rotateSpeed, Math.PI - 0.2));
        }
        if (keysPressed.current.has('ArrowRight')) {
          setCannonAngle(prev => Math.max(prev - rotateSpeed, 0.2));
        }
      }
      frameId = requestAnimationFrame(updateRotation);
    };

    frameId = requestAnimationFrame(updateRotation);
    return () => cancelAnimationFrame(frameId);
  }, [status]);

  const resolveCollision = useCallback(async (pos: Point, shotColor: BubbleColor) => {
    const { row, col } = getGridPos(pos.x, pos.y);
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return;

    const newGrid = [...gridRef.current.map(r => [...r])];
    
    let targetRow = row;
    let targetCol = col;
    // If the space is occupied, find an adjacent space
    if (newGrid[targetRow][targetCol]) {
      targetRow++; 
    }

    if (targetRow < GRID_ROWS) {
      const isBombHit = newGrid[targetRow][targetCol] === 'bomb' || shotColor === 'bomb';
      
      if (isBombHit) {
        // Bomb Logic: Clear radius of 2
        const toExplode: GridPos[] = [{ row: targetRow, col: targetCol }];
        const firstNeighbors = getNeighbors(targetRow, targetCol);
        toExplode.push(...firstNeighbors);
        
        firstNeighbors.forEach(n => {
          const secondNeighbors = getNeighbors(n.row, n.col);
          toExplode.push(...secondNeighbors);
        });

        // Remove duplicates and out-of-bounds
        const uniqueToExplode = Array.from(new Set(toExplode.map(p => `${p.row},${p.col}`)))
          .map(s => {
            const [r, c] = s.split(',').map(Number);
            return { row: r, col: c };
          })
          .filter(p => p.row >= 0 && p.row < GRID_ROWS && p.col >= 0 && p.col < GRID_COLS);

        uniqueToExplode.forEach(p => newGrid[p.row][p.col] = null);
        
        const floating = findFloatingBubbles(newGrid);
        floating.forEach(p => newGrid[p.row][p.col] = null);
        
        setScore(s => s + (uniqueToExplode.length + floating.length) * 15);
        setCommentary("BOOM! 威力惊人!");
      } else {
        newGrid[targetRow][targetCol] = shotColor;
        const cluster = findCluster(newGrid, targetRow, targetCol);
        if (cluster.length >= 3) {
          cluster.forEach(p => newGrid[p.row][p.col] = null);
          const floating = findFloatingBubbles(newGrid);
          floating.forEach(p => newGrid[p.row][p.col] = null);
          setScore(s => s + (cluster.length + floating.length) * 10);
        }
      }
    }

    setGrid(newGrid);
    setShot(null);

    if (newGrid.slice(DANGER_ROW).some(row => row.some(cell => cell !== null))) {
      setStatus(GameStatus.GAMEOVER);
    }
  }, []);

  useEffect(() => {
    if (status !== GameStatus.PLAYING || !shot) return;

    const animate = () => {
      setShot(prev => {
        if (!prev) return null;
        
        let newX = prev.pos.x + prev.velocity.x;
        let newY = prev.pos.y + prev.velocity.y;
        let newVelX = prev.velocity.x;

        if (newX < BUBBLE_RADIUS || newX > CANVAS_WIDTH - BUBBLE_RADIUS) {
          newVelX *= -1;
          newX = newX < BUBBLE_RADIUS ? BUBBLE_RADIUS : CANVAS_WIDTH - BUBBLE_RADIUS;
        }

        const currentGrid = gridRef.current;
        let collided = false;
        
        if (newY < BUBBLE_RADIUS) {
          collided = true;
        } else {
          for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
              if (currentGrid[r][c]) {
                const center = getBubbleCenter(r, c);
                const dist = Math.sqrt((newX - center.x)**2 + (newY - center.y)**2);
                if (dist < BUBBLE_DIAMETER * 0.9) {
                  collided = true;
                  break;
                }
              }
            }
            if (collided) break;
          }
        }

        if (collided) {
          resolveCollision({ x: newX, y: newY }, prev.color);
          return null;
        }

        return { pos: { x: newX, y: newY }, velocity: { x: newVelX, y: prev.velocity.y }, color: prev.color };
      });
    };

    const interval = setInterval(animate, 1000 / 60);
    return () => clearInterval(interval);
  }, [status, shot, resolveCollision]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      skyGrad.addColorStop(0, '#7dd3fc');
      skyGrad.addColorStop(0.7, '#e0f2fe');
      skyGrad.addColorStop(1, '#60a5fa');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.strokeStyle = '#ef4444';
      ctx.setLineDash([10, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, DANGER_ROW * ROW_HEIGHT + BUBBLE_RADIUS);
      ctx.lineTo(CANVAS_WIDTH, DANGER_ROW * ROW_HEIGHT + BUBBLE_RADIUS);
      ctx.stroke();
      ctx.setLineDash([]);

      grid.forEach((row, r) => {
        row.forEach((color, c) => {
          if (color) {
            const center = getBubbleCenter(r, c);
            ctx.beginPath();
            ctx.arc(center.x, center.y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
            ctx.fillStyle = COLORS[color];
            ctx.fill();

            if (color === 'bomb') {
              // Bomb icon
              ctx.fillStyle = 'white';
              ctx.font = '14px Arial';
              ctx.textAlign = 'center';
              ctx.fillText('💣', center.x, center.y + 5);
            } else {
              ctx.beginPath();
              ctx.arc(center.x - 6, center.y - 6, 6, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(255,255,255,0.4)';
              ctx.fill();
            }
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.stroke();
          }
        });
      });

      if (shot) {
        ctx.beginPath();
        ctx.arc(shot.pos.x, shot.pos.y, BUBBLE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[shot.color];
        ctx.fill();
        if (shot.color === 'bomb') {
          ctx.fillStyle = 'white';
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('💣', shot.pos.x, shot.pos.y + 5);
        }
      }

      const launcherX = CANVAS_WIDTH / 2;
      const launcherY = CANVAS_HEIGHT - 60;
      ctx.beginPath();
      ctx.arc(launcherX, launcherY, 40, 0, Math.PI * 2);
      ctx.fillStyle = '#92400e';
      ctx.fill();

      ctx.save();
      ctx.translate(launcherX, launcherY);
      ctx.rotate(-cannonAngle + Math.PI / 2);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(-10, -50);
      ctx.lineTo(10, -50);
      ctx.lineTo(15, -45);
      ctx.lineTo(0, -70);
      ctx.lineTo(-15, -45);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(launcherX, launcherY, BUBBLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[currentColor];
      ctx.fill();
      if (currentColor === 'bomb') {
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('💣', launcherX, launcherY + 5);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('NEXT', 30, CANVAS_HEIGHT - 80);
      ctx.beginPath();
      ctx.arc(50, CANVAS_HEIGHT - 50, BUBBLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[nextColor];
      ctx.fill();
      if (nextColor === 'bomb') {
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('💣', 50, CANVAS_HEIGHT - 45);
      }

      ctx.font = '40px serif';
      ctx.fillText('🐰', CANVAS_WIDTH - 80, CANVAS_HEIGHT - 40);

      requestAnimationFrame(render);
    };

    const animFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrame);
  }, [grid, shot, cannonAngle, currentColor, nextColor, status]);

  return (
    <div className="flex h-screen w-full bg-[#34d399] items-center justify-center font-sans">
      <div className="flex flex-col md:flex-row bg-[#065f46] p-4 rounded-3xl shadow-2xl border-8 border-[#34d399] relative">
        
        <div className="w-full md:w-64 p-4 flex flex-col text-white">
          <h1 className="text-2xl font-black italic tracking-tighter text-yellow-300 mb-2">火拼泡泡龙</h1>
          <p className="text-[10px] text-teal-100 uppercase font-bold mb-6 tracking-widest">AI SINGLE PLAYER</p>
          
          <div className="bg-[#047857] p-4 rounded-2xl mb-4 border border-teal-600 shadow-inner">
            <span className="text-[10px] text-teal-300 font-bold block mb-1">SCORE</span>
            <span className="text-3xl font-mono text-yellow-400">{score.toLocaleString()}</span>
          </div>

          <div className="bg-[#047857] p-4 rounded-2xl border border-teal-600">
            <span className="text-[10px] text-teal-300 font-bold block mb-2">CONTROLS</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-teal-900/50 p-2 rounded">← / → 瞄准</div>
              <div className="bg-teal-900/50 p-2 rounded">↑ / Space 发射</div>
              <div className="bg-teal-900/50 p-2 rounded">↓ 切换</div>
              <div className="bg-teal-900/50 p-2 rounded text-yellow-300">💣 炸弹</div>
            </div>
          </div>

          <div className="mt-auto p-4 bg-yellow-400 text-teal-900 rounded-2xl font-bold text-center">
            {commentary}
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden border-4 border-[#047857] shadow-xl">
          <canvas 
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block"
          />

          {status === GameStatus.START && (
            <div className="absolute inset-0 bg-teal-900/40 backdrop-blur-sm flex items-center justify-center">
              <button 
                onClick={initLevel}
                disabled={loading}
                className="group relative flex flex-col items-center"
              >
                <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform border-4 border-white">
                  <span className="text-teal-900 font-black text-2xl tracking-tighter">开始</span>
                </div>
                {loading && <p className="mt-4 text-white font-bold animate-pulse">AI 生成关卡中...</p>}
              </button>
            </div>
          )}

          {status === GameStatus.GAMEOVER && (
            <div className="absolute inset-0 bg-red-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white text-center">
              <h2 className="text-5xl font-black italic mb-2 text-yellow-300">GAME OVER</h2>
              <p className="text-xl mb-8">分 数: {score}</p>
              <button 
                onClick={initLevel}
                className="px-8 py-3 bg-white text-red-900 font-black rounded-full hover:bg-yellow-400 transition-colors"
              >
                重 试
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
