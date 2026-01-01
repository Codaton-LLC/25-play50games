"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
   ArrowPathIcon,
   TrophyIcon,
   BoltIcon,
   CheckCircleIcon,
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
      <div className="maze-escape-game">
         {/* Header */}
         <div className="game-header">
            <div className="header-stats">
               <div className="stat-item">
                  <ArrowPathIcon className="stat-icon" />
                  <span>
                     Round {currentRound} / {maxRounds}
                  </span>
               </div>
               <div className="stat-item">
                  <TrophyIcon className="stat-icon" />
                  <span>
                     Score: {displayScore} / {maxScore}
                  </span>
               </div>
               <div className="stat-item">
                  <BoltIcon className="stat-icon" />
                  <span>Path: {trail.size}</span>
               </div>
            </div>
            <div className="progress-bar-container">
               <div
                  style={{
                     width: `${progress}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "4px",
                     transition: "width 0.3s",
                     boxShadow: "rgba(125, 211, 252, 0.5) 0px 0px 10px",
                  }}
               />
            </div>
         </div>

         {/* Maze Grid */}
         <div className="maze-container">
            <div
               className="maze-grid"
               style={{
                  gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                  gridTemplateRows: `repeat(${gridSize}, 1fr)`,
               }}
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
                  const isPath =
                     !isWall && !isPlayer && !isExit && !isTrail && !isStart;

                  // Check if cell is adjacent to player (for mouse click)
                  const dx = Math.abs(x - playerPos.x);
                  const dy = Math.abs(y - playerPos.y);
                  const isAdjacent =
                     !isWall &&
                     !isPlayer &&
                     ((dx === 1 && dy === 0) || (dx === 0 && dy === 1));
                  const isClickable = isAdjacent && !isCompleted;

                  return (
                     <div
                        key={i}
                        className={`maze-cell ${isWall ? "wall" : ""} ${
                           isPlayer ? "player" : ""
                        } ${isExit ? "exit" : ""} ${isStart ? "start" : ""} ${
                           isTrail ? "trail" : ""
                        } ${isPath ? "path" : ""} ${
                           isClickable ? "clickable" : ""
                        }`}
                        onClick={() => handleCellClick(x, y)}
                        onMouseEnter={() => handleCellHover(x, y)}
                        style={{ cursor: isClickable ? "pointer" : "default" }}
                     >
                        {isPlayer && (
                           <div className="player-marker">
                              <BoltIcon className="player-icon" />
                           </div>
                        )}
                        {isExit && (
                           <div className="exit-marker">
                              <TrophyIcon className="exit-icon" />
                           </div>
                        )}
                        {isStart && <div className="start-marker" />}
                        {isTrail && <div className="trail-dot" />}
                     </div>
                  );
               })}
            </div>
         </div>

         {/* Success Message - positioned below the maze like Circuit Path */}
         {showSuccess && (
            <div className="game-feedback correct">
               <CheckCircleIcon className="feedback-icon" />
               <span>
                  Round {currentRound} Complete! Score: {roundScore} points
               </span>
            </div>
         )}
      </div>
   );
}

export default MazeEscape;
