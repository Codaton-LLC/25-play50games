"use client";

import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties } from "react";
import theme from "./theme.module.css";
import css from "./MazeEscape.module.css";
import {
   TrophyIcon,
   BoltIcon,
   CheckCircleIcon,
   ChevronUpIcon,
   ChevronDownIcon,
   ChevronLeftIcon,
   ChevronRightIcon,
} from "@heroicons/react/24/outline";

function MazeEscape({
   config,
   currentRound = 1,
   maxRounds = 20,
   currentScore = 0,
   onScoreUpdate,
   onComplete,
   onRoundComplete,
}: {
   config: Record<string, any>;
   currentRound?: number;
   maxRounds?: number;
   currentScore?: number;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   onRoundComplete?: () => void;
}) {
   // Dynamic grid size based on rounds (fallback if not in config)
   const getGridSize = () => {
      // Check if grid sizes are configured in config
      if (config.gridSizes && Array.isArray(config.gridSizes)) {
         // Sort by rounds to ensure correct order (ascending)
         const sortedGridSizes = [...config.gridSizes].sort(
            (a, b) => a.rounds - b.rounds
         );

         // Find the appropriate size based on current round
         // Find the first entry where currentRound <= rounds
         for (let i = 0; i < sortedGridSizes.length; i++) {
            const { rounds, size } = sortedGridSizes[i];
            if (currentRound <= rounds) {
               return size;
            }
         }
         // If no match (currentRound > all configured rounds), use the last configured size
         const lastSize = sortedGridSizes[sortedGridSizes.length - 1].size;
         return lastSize;
      }

      // Fallback to default progression
      let size;
      if (currentRound <= 5) {
         size = 10; // 10x10 for rounds 1-5
      } else if (currentRound <= 15) {
         size = 20; // 20x20 for rounds 6-15
      } else {
         size = 45; // 45x45 for rounds 16-20
      }
      return size;
   };

   // Grid size from config or dynamic based on rounds - recalculate when currentRound changes
   const gridSize = useMemo(() => {
      if (config.size) {
         // Fixed size from config
         return config.size;
      }
      // Dynamic size based on current round
      return getGridSize();
   }, [config.size, currentRound, config.gridSizes]);
   const [maze, setMaze] = useState<number[][]>([]);
   const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
   const [exitPos, setExitPos] = useState({ x: 0, y: 0 });
   const [moves, setMoves] = useState(0);
   const [trail, setTrail] = useState<Set<string>>(new Set());
   const [isCompleted, setIsCompleted] = useState(false);
   const [showSuccess, setShowSuccess] = useState(false);
   const [roundScore, setRoundScore] = useState(0);
   const completionCalledRef = useRef(false);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);
   const onRoundCompleteRef = useRef(onRoundComplete);
   const roundTimeoutRef = useRef<NodeJS.Timeout | null>(null);

   // the round-end timer is also cleared if the game unmounts mid-delay (it used to fire after leaving)
   useEffect(
      () => () => {
         if (roundTimeoutRef.current) {
            clearTimeout(roundTimeoutRef.current);
            roundTimeoutRef.current = null;
         }
      },
      []
   );

   // Keep refs updated
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
      onRoundCompleteRef.current = onRoundComplete;
   }, [onScoreUpdate, onComplete, onRoundComplete]);

   // Generate maze using Recursive Backtracker algorithm
   const generateMaze = useCallback((size: number): number[][] => {
      // Initialize maze: 0 = wall, 1 = path
      const maze: number[][] = Array(size)
         .fill(null)
         .map(() => Array(size).fill(0));

      // Start from top-left
      const start = { x: 0, y: 0 };
      const stack: { x: number; y: number }[] = [start];
      maze[start.y][start.x] = 1;

      const directions = [
         { dx: 0, dy: -1 }, // up
         { dx: 1, dy: 0 }, // right
         { dx: 0, dy: 1 }, // down
         { dx: -1, dy: 0 }, // left
      ];

      while (stack.length > 0) {
         const current = stack[stack.length - 1];
         const neighbors: {
            x: number;
            y: number;
            dir: { dx: number; dy: number };
         }[] = [];

         for (const dir of directions) {
            const nx = current.x + dir.dx * 2;
            const ny = current.y + dir.dy * 2;

            if (
               nx >= 0 &&
               nx < size &&
               ny >= 0 &&
               ny < size &&
               maze[ny][nx] === 0
            ) {
               neighbors.push({ x: nx, y: ny, dir });
            }
         }

         if (neighbors.length > 0) {
            const next =
               neighbors[Math.floor(Math.random() * neighbors.length)];
            const wallX = current.x + next.dir.dx;
            const wallY = current.y + next.dir.dy;

            maze[wallY][wallX] = 1; // Carve wall
            maze[next.y][next.x] = 1; // Carve cell
            stack.push({ x: next.x, y: next.y });
         } else {
            stack.pop();
         }
      }

      // Ensure exit is reachable (bottom-right or far corner)
      const exitCandidates = [
         { x: size - 1, y: size - 1 },
         { x: size - 1, y: size - 2 },
         { x: size - 2, y: size - 1 },
      ];

      for (const exit of exitCandidates) {
         if (maze[exit.y] && maze[exit.y][exit.x] === 1) {
            return maze;
         }
      }

      // If exit not reachable, create path to bottom-right
      maze[size - 1][size - 1] = 1;
      if (size > 1) {
         maze[size - 2][size - 1] = 1;
         maze[size - 1][size - 2] = 1;
      }

      return maze;
   }, []);

   // Initialize maze for new round - only when round changes
   useEffect(() => {
      // Reset everything for new round
      const newMaze = generateMaze(gridSize);
      setMaze(newMaze);
      setPlayerPos({ x: 0, y: 0 });
      setExitPos({ x: gridSize - 1, y: gridSize - 1 });
      setMoves(0);
      setTrail(new Set(["0,0"])); // Start position is always in trail
      setIsCompleted(false);
      setShowSuccess(false);
      setRoundScore(0);
      completionCalledRef.current = false;
      // Clear any pending timeout when starting new round
      if (roundTimeoutRef.current) {
         clearTimeout(roundTimeoutRef.current);
         roundTimeoutRef.current = null;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [currentRound, gridSize]); // Depend on currentRound and gridSize

   // Check win condition
   useEffect(() => {
      // Only check if maze is initialized and player reached exit
      if (
         maze.length === 0 ||
         !maze[playerPos.y] ||
         !maze[playerPos.y][playerPos.x]
      ) {
         return; // Maze not ready
      }

      if (
         !isCompleted &&
         playerPos.x === exitPos.x &&
         playerPos.y === exitPos.y &&
         !completionCalledRef.current
      ) {
         setIsCompleted(true);
         completionCalledRef.current = true;

         // Calculate score: 100 points minus 1 point per move (min 0)
         const baseScore = 100;
         const movePenalty = Math.min(moves, 100);
         const calculatedRoundScore = Math.max(0, baseScore - movePenalty);

         setRoundScore(calculatedRoundScore);
         setShowSuccess(true);
         onScoreUpdateRef.current(calculatedRoundScore);

         // Move to next round after delay
         // Clear any existing timeout first
         if (roundTimeoutRef.current) {
            clearTimeout(roundTimeoutRef.current);
         }

         roundTimeoutRef.current = setTimeout(() => {
            setShowSuccess(false);
            if (currentRound >= maxRounds) {
               const finalScore = currentScore + calculatedRoundScore;
               onCompleteRef.current(finalScore);
            } else {
               // Trigger next round only once
               if (onRoundCompleteRef.current) {
                  try {
                     onRoundCompleteRef.current();
                  } catch (error) {
                     // Error calling onRoundComplete
                  }
               }
            }
            roundTimeoutRef.current = null;
         }, 2000);
      }
   }, [
      playerPos,
      exitPos,
      isCompleted,
      moves,
      currentRound,
      maxRounds,
      currentScore,
      maze,
   ]); // Removed callbacks from dependencies - using refs instead

   const handleKeyPress = useCallback(
      (e: KeyboardEvent) => {
         if (isCompleted) return;

         let newPos = { ...playerPos };
         let moved = false;

         if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
            if (playerPos.y > 0) {
               newPos.y--;
               moved = true;
            }
         } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
            if (playerPos.y < gridSize - 1) {
               newPos.y++;
               moved = true;
            }
         } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
            if (playerPos.x > 0) {
               newPos.x--;
               moved = true;
            }
         } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
            if (playerPos.x < gridSize - 1) {
               newPos.x++;
               moved = true;
            }
         }

         if (moved) {
            // Check if new position is valid (not a wall)
            if (
               newPos.x >= 0 &&
               newPos.x < gridSize &&
               newPos.y >= 0 &&
               newPos.y < gridSize &&
               maze[newPos.y] &&
               maze[newPos.y][newPos.x] === 1
            ) {
               setPlayerPos(newPos);
               setMoves((prev) => prev + 1);
               // Add to trail
               setTrail((prev) => {
                  const newTrail = new Set(prev);
                  newTrail.add(`${newPos.x},${newPos.y}`);
                  return newTrail;
               });
            }
         }
      },
      [playerPos, gridSize, maze, isCompleted]
   );

   // Handle mouse click on maze cell
   const handleCellClick = useCallback(
      (x: number, y: number) => {
         if (isCompleted) return;

         // Check if clicked cell is adjacent to player (up, down, left, right)
         const dx = Math.abs(x - playerPos.x);
         const dy = Math.abs(y - playerPos.y);
         const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);

         if (!isAdjacent) return; // Only allow adjacent cells

         // Check if clicked cell is valid (not a wall)
         if (
            x >= 0 &&
            x < gridSize &&
            y >= 0 &&
            y < gridSize &&
            maze[y] &&
            maze[y][x] === 1
         ) {
            setPlayerPos({ x, y });
            setMoves((prev) => prev + 1);
            // Add to trail
            setTrail((prev) => {
               const newTrail = new Set(prev);
               newTrail.add(`${x},${y}`);
               return newTrail;
            });
         }
      },
      [playerPos, gridSize, maze, isCompleted]
   );

   // Touch: one step per swipe on the maze, or the D-pad; both go through the cell click (walls,
   // moves and the trail exactly as a tap on the neighbouring cell)
   const swipeStart = useRef<{ x: number; y: number } | null>(null);
   const step = (dx: number, dy: number) => handleCellClick(playerPos.x + dx, playerPos.y + dy);

   // Handle mouse hover on maze cell - auto-move to valid adjacent cells
   const handleCellHover = useCallback(
      (x: number, y: number) => {
         if (isCompleted) return;

         // Check if hovered cell is adjacent to player (up, down, left, right)
         const dx = Math.abs(x - playerPos.x);
         const dy = Math.abs(y - playerPos.y);
         const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);

         if (!isAdjacent) return; // Only allow adjacent cells

         // Check if hovered cell is valid (not a wall) and not already in trail
         if (
            x >= 0 &&
            x < gridSize &&
            y >= 0 &&
            y < gridSize &&
            maze[y] &&
            maze[y][x] === 1 &&
            !trail.has(`${x},${y}`) // Don't move to cells already visited
         ) {
            setPlayerPos({ x, y });
            setMoves((prev) => prev + 1);
            // Add to trail
            setTrail((prev) => {
               const newTrail = new Set(prev);
               newTrail.add(`${x},${y}`);
               return newTrail;
            });
         }
      },
      [playerPos, gridSize, maze, isCompleted, trail]
   );

   useEffect(() => {
      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [handleKeyPress]);

   // Calculate progress based on rounds (like other games - Balance Scale uses currentRound / maxRounds)
   // Calculate progress based on rounds - use useMemo to update when currentRound changes
   const progress = useMemo(() => {
      return maxRounds > 0
         ? Math.min(100, Math.max(0, (currentRound / maxRounds) * 100))
         : 0;
   }, [currentRound, maxRounds]);
   const maxScore = maxRounds * 100;
   const displayScore = currentScore;

   return (
      <div className={`maze-escape-game ${theme.game} ${css.root}`}>
         {/* Header */}
         <div className={`${theme.header} ${css.head}`}>
            <div className={theme.chips}>
               <span className={theme.chip}>
                  Round <strong>{currentRound} / {maxRounds}</strong>
               </span>
               <span className={theme.chip}>
                  Score <strong>{displayScore} / {maxScore}</strong>
               </span>
               <span className={theme.chip}>
                  Path <strong>{trail.size}</strong>
               </span>
            </div>
            <div
               className={css.progress}
               role="progressbar"
               aria-label="Round progress"
               aria-valuemin={0}
               aria-valuemax={maxRounds}
               aria-valuenow={currentRound}
            >
               <div className={css.progressFill} style={{ transform: `scaleX(${progress / 100})` }} />
            </div>
         </div>

         {/* Maze Grid: N equal 1fr tracks, square cells, gap 0 (walls are whole cells, so they line up) */}
         <div className={css.container}>
            <div
               key={`maze-${currentRound}-${gridSize}`}
               className={`${css.grid} ${theme.reveal}`}
               role="grid"
               aria-label={`Maze, ${gridSize} by ${gridSize}`}
               onTouchStart={(e) => {
                  const t = e.touches[0];
                  swipeStart.current = t ? { x: t.clientX, y: t.clientY } : null;
               }}
               onTouchEnd={(e) => {
                  const st = swipeStart.current;
                  swipeStart.current = null;
                  const t = e.changedTouches[0];
                  if (!st || !t) return;
                  const dx = t.clientX - st.x;
                  const dy = t.clientY - st.y;
                  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; // a tap: the cell's own click
                  if (Math.abs(dx) > Math.abs(dy)) step(dx > 0 ? 1 : -1, 0);
                  else step(0, dy > 0 ? 1 : -1);
               }}
               style={{ "--n": gridSize } as CSSProperties}
            >
               {Array.from({ length: gridSize * gridSize }).map((_, i) => {
                  const x = i % gridSize;
                  const y = Math.floor(i / gridSize);
                  const isWall = !maze[y] || maze[y][x] === 0;
                  const isPlayer = playerPos.x === x && playerPos.y === y;
                  const isExit =
                     exitPos.x === x && exitPos.y === y && !isPlayer;
                  const isStart = x === 0 && y === 0 && !isPlayer && !isExit;
                  const isTrail =
                     trail.has(`${x},${y}`) && !isPlayer && !isExit && !isStart;

                  // Check if cell is adjacent to player (for mouse click)
                  const dx = Math.abs(x - playerPos.x);
                  const dy = Math.abs(y - playerPos.y);
                  const isAdjacent =
                     !isWall &&
                     !isPlayer &&
                     ((dx === 1 && dy === 0) || (dx === 0 && dy === 1));
                  const isClickable = isAdjacent && !isCompleted;

                  const cls = [
                     css.cell,
                     isWall ? css.wall : css.path,
                     isTrail ? css.trail : "",
                     isStart ? css.start : "",
                     isExit ? css.exit : "",
                     isPlayer ? css.playerCell : "",
                     isPlayer && isCompleted ? css.won : "",
                     isClickable ? css.clickable : "",
                  ]
                     .filter(Boolean)
                     .join(" ");

                  return (
                     <div
                        key={i}
                        className={cls}
                        onClick={() => handleCellClick(x, y)}
                        onMouseEnter={() => handleCellHover(x, y)}
                     >
                        {isPlayer && (
                           // keyed by position: the marker steps in where it lands (no top/left animation)
                           <span key={`p-${x}-${y}`} className={css.player}>
                              <BoltIcon className={css.playerIcon} aria-hidden="true" />
                           </span>
                        )}
                        {isExit && <TrophyIcon className={css.exitIcon} aria-hidden="true" />}
                        {isTrail && <span className={css.trailDot} />}
                     </div>
                  );
               })}
            </div>
         </div>

         {/* Touch D-pad (touch screens only, see MazeEscape.module.css) */}
         <div className={css.pad} role="group" aria-label="Move">
            <button type="button" className={css.up} aria-label="Up" onClick={() => step(0, -1)} disabled={isCompleted}>
               <ChevronUpIcon className={css.padIcon} aria-hidden="true" />
            </button>
            <button type="button" className={css.left} aria-label="Left" onClick={() => step(-1, 0)} disabled={isCompleted}>
               <ChevronLeftIcon className={css.padIcon} aria-hidden="true" />
            </button>
            <button type="button" className={css.down} aria-label="Down" onClick={() => step(0, 1)} disabled={isCompleted}>
               <ChevronDownIcon className={css.padIcon} aria-hidden="true" />
            </button>
            <button type="button" className={css.right} aria-label="Right" onClick={() => step(1, 0)} disabled={isCompleted}>
               <ChevronRightIcon className={css.padIcon} aria-hidden="true" />
            </button>
         </div>

         {/* Success message: a fixed-height slot under the maze, so nothing jumps */}
         <div className={`${theme.feedbackSlot} ${css.feedback}`} aria-live="polite">
            {showSuccess && (
               <div className={`${theme.feedback} ${theme.feedbackOk} ${theme.pop}`}>
                  <CheckCircleIcon className={css.fbIcon} aria-hidden="true" />
                  <span>
                     Round {currentRound} complete: {roundScore} points
                  </span>
               </div>
            )}
         </div>
      </div>
   );
}

export default MazeEscape;
