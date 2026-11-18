"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import theme from "./theme.module.css";
import css from "./CircuitPath.module.css";
import {
   XMarkIcon,
   ArrowLeftIcon,
   ArrowUpIcon,
   ArrowDownIcon,
   ArrowRightIcon,
} from "@heroicons/react/24/outline";

function CircuitPath({
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
   // Dynamic grid size based on round
   const getGridSize = (roundNum: number) => {
      if (roundNum <= 5) return 3; // Rounds 1-5: 3x3
      if (roundNum <= 10) return 5; // Rounds 6-10: 5x5
      return 10; // Rounds 11+: 10x10
   };

   const [gridSize, setGridSize] = useState(getGridSize(1));
   const rounds = config.rounds || maxRounds;

   const [startNode, setStartNode] = useState<{
      row: number;
      col: number;
   } | null>(null);
   const [endNode, setEndNode] = useState<{ row: number; col: number } | null>(
      null
   );
   const [obstacles, setObstacles] = useState<Set<string>>(new Set());
   const [path, setPath] = useState<Array<{ row: number; col: number }>>([]);
   const round = currentRound;
   const score = currentScore;
   const [selectedRow, setSelectedRow] = useState<number | null>(null);
   const [selectedCol, setSelectedCol] = useState<number | null>(null);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isAnimating, setIsAnimating] = useState(false);
   const completionCalledRef = useRef(false);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);
   const onRoundCompleteRef = useRef(onRoundComplete);

   // every delayed step goes through later(): the timers are cleared if the game unmounts
   const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
   const later = useCallback((fn: () => void, ms: number) => {
      const id = setTimeout(() => {
         timersRef.current.delete(id);
         fn();
      }, ms);
      timersRef.current.add(id);
   }, []);
   useEffect(() => {
      const timers = timersRef.current;
      return () => {
         timers.forEach((id) => clearTimeout(id));
         timers.clear();
      };
   }, []);

   // Update refs when callbacks change
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
      onRoundCompleteRef.current = onRoundComplete;
   }, [onScoreUpdate, onComplete, onRoundComplete]);

   // Initialize new round with random start and end nodes
   const startNewRound = useCallback((roundNum: number) => {
      const currentGridSize = getGridSize(roundNum);
      setGridSize(currentGridSize);

      const total = currentGridSize * currentGridSize;

      // Helper function to get adjacent positions
      const getAdjacentPositions = (row: number, col: number): number[] => {
         const positions: number[] = [];
         if (row > 0) positions.push((row - 1) * currentGridSize + col);
         if (row < currentGridSize - 1)
            positions.push((row + 1) * currentGridSize + col);
         if (col > 0) positions.push(row * currentGridSize + (col - 1));
         if (col < currentGridSize - 1)
            positions.push(row * currentGridSize + (col + 1));
         return positions;
      };

      // Helper function to check if position is too close to another
      const isTooClose = (
         row1: number,
         col1: number,
         row2: number,
         col2: number
      ): boolean => {
         const rowDiff = Math.abs(row1 - row2);
         const colDiff = Math.abs(col1 - col2);
         return rowDiff <= 1 && colDiff <= 1; // Within 1 cell distance
      };

      // Generate random start position
      let startIndex = Math.floor(Math.random() * total);
      let startRow = Math.floor(startIndex / currentGridSize);
      let startCol = startIndex % currentGridSize;

      // Generate end position that is not too close to start (at least 2 cells away)
      let endIndex: number;
      let endRow: number;
      let endCol: number;
      let endAttempts = 0;
      do {
         endIndex = Math.floor(Math.random() * total);
         endRow = Math.floor(endIndex / currentGridSize);
         endCol = endIndex % currentGridSize;
         endAttempts++;
         // Prevent infinite loop
         if (endAttempts > 100) break;
      } while (
         endIndex === startIndex ||
         isTooClose(startRow, startCol, endRow, endCol)
      );

      setStartNode({ row: startRow, col: startCol });
      setEndNode({ row: endRow, col: endCol });

      // Get positions that must be free (adjacent to start - at least 2 free)
      const startAdjacent = getAdjacentPositions(startRow, startCol);
      const endAdjacent = getAdjacentPositions(endRow, endCol);
      const protectedPositions = new Set<number>([
         startIndex,
         endIndex,
         ...startAdjacent,
         ...endAdjacent,
      ]);

      // Generate obstacles (more for larger grids)
      // 3x3: 10-15%, 5x5: 15-25%, 10x10: 20-30%
      let obstaclePercentage = 0.1;
      if (currentGridSize >= 10)
         obstaclePercentage = 0.2 + (roundNum - 1) * 0.01;
      else if (currentGridSize >= 5)
         obstaclePercentage = 0.15 + (roundNum - 1) * 0.01;
      else obstaclePercentage = 0.1 + (roundNum - 1) * 0.005;

      const obstacleCount = Math.max(1, Math.floor(total * obstaclePercentage));

      // Helper function to check if path exists using BFS
      const pathExists = (obstaclesSet: Set<string>): boolean => {
         const visited = new Set<string>();
         const queue: Array<{ row: number; col: number }> = [
            { row: startRow, col: startCol },
         ];
         visited.add(`${startRow},${startCol}`);

         while (queue.length > 0) {
            const current = queue.shift()!;

            // Check if we reached the end
            if (current.row === endRow && current.col === endCol) {
               return true;
            }

            // Check all adjacent cells
            const directions = [
               { row: -1, col: 0 }, // up
               { row: 1, col: 0 }, // down
               { row: 0, col: -1 }, // left
               { row: 0, col: 1 }, // right
            ];

            for (const dir of directions) {
               const newRow = current.row + dir.row;
               const newCol = current.col + dir.col;

               if (
                  newRow >= 0 &&
                  newRow < currentGridSize &&
                  newCol >= 0 &&
                  newCol < currentGridSize
               ) {
                  const key = `${newRow},${newCol}`;

                  if (!visited.has(key) && !obstaclesSet.has(key)) {
                     visited.add(key);
                     queue.push({ row: newRow, col: newCol });
                  }
               }
            }
         }

         return false;
      };

      // Generate obstacles with path validation
      let newObstacles = new Set<string>();
      const availablePositions = new Set<number>();

      // Create set of available positions (excluding protected positions)
      for (let i = 0; i < total; i++) {
         if (!protectedPositions.has(i)) {
            availablePositions.add(i);
         }
      }

      // Try multiple times to generate valid obstacles
      let attempts = 0;
      const maxAttempts = 50;

      while (attempts < maxAttempts) {
         newObstacles = new Set<string>();
         const positionsArray = Array.from(availablePositions);

         // Randomly select obstacle positions
         for (
            let i = 0;
            i < Math.min(obstacleCount, positionsArray.length);
            i++
         ) {
            const randomIndex = Math.floor(
               Math.random() * positionsArray.length
            );
            const pos = positionsArray[randomIndex];
            positionsArray.splice(randomIndex, 1);

            const row = Math.floor(pos / currentGridSize);
            const col = pos % currentGridSize;
            newObstacles.add(`${row},${col}`);
         }

         // Check if path exists with these obstacles
         if (pathExists(newObstacles)) {
            break; // Valid configuration found
         }

         attempts++;
      }

      // If still no valid path after max attempts, reduce obstacles
      if (attempts >= maxAttempts) {
         // Try with fewer obstacles
         for (
            let reducedCount = obstacleCount - 1;
            reducedCount >= 1;
            reducedCount--
         ) {
            newObstacles = new Set<string>();
            const positionsArray = Array.from(availablePositions);

            for (
               let i = 0;
               i < Math.min(reducedCount, positionsArray.length);
               i++
            ) {
               const randomIndex = Math.floor(
                  Math.random() * positionsArray.length
               );
               const pos = positionsArray[randomIndex];
               positionsArray.splice(randomIndex, 1);

               const row = Math.floor(pos / currentGridSize);
               const col = pos % currentGridSize;
               newObstacles.add(`${row},${col}`);
            }

            if (pathExists(newObstacles)) {
               break;
            }
         }
      }

      setObstacles(newObstacles);
      setPath([]);
      setSelectedRow(null);
      setSelectedCol(null);
      setFeedback(null);
      completionCalledRef.current = false;
   }, []);

   // Initialize first round
   useEffect(() => {
      startNewRound(currentRound);
   }, [startNewRound, currentRound]);

   // Check if path is complete (connects start to end)
   useEffect(() => {
      if (!startNode || !endNode || path.length === 0) return;
      if (completionCalledRef.current) return;

      const firstNode = path[0];
      const lastNode = path[path.length - 1];

      // Check if path starts at start node and ends at end node
      const startsCorrectly =
         firstNode.row === startNode.row && firstNode.col === startNode.col;
      const endsCorrectly =
         lastNode.row === endNode.row && lastNode.col === endNode.col;

      // Check if path is continuous (each node is adjacent to previous)
      let isContinuous = true;
      for (let i = 1; i < path.length; i++) {
         const prev = path[i - 1];
         const curr = path[i];
         const rowDiff = Math.abs(curr.row - prev.row);
         const colDiff = Math.abs(curr.col - prev.col);
         if (
            !(
               (rowDiff === 1 && colDiff === 0) ||
               (rowDiff === 0 && colDiff === 1)
            )
         ) {
            isContinuous = false;
            break;
         }
      }

      if (startsCorrectly && endsCorrectly && isContinuous && path.length > 1) {
         completionCalledRef.current = true;

         // Calculate round score: 5 points per round (max 100 for 20 rounds)
         const roundScore = 5;
         const newScore = score + roundScore;
         setFeedback("correct");

         // Update parent score
         onScoreUpdateRef.current(newScore);

         // Move to next round or complete
         if (round < rounds) {
            later(() => {
               if (onRoundCompleteRef.current) {
                  onRoundCompleteRef.current();
               }
            }, 1500);
         } else {
            // All rounds completed
            later(() => {
               onCompleteRef.current(newScore);
            }, 1500);
         }
      } else if (path.length > 0 && !isContinuous) {
         setFeedback("wrong");
         later(() => {
            setFeedback(null);
            setPath([]);
         }, 1000);
      }
   }, [path, startNode, endNode, round, rounds, score]);

   // Reset completion flag when round changes
   useEffect(() => {
      completionCalledRef.current = false;
   }, [round]);

   const handleNodeClick = useCallback(
      (row: number, col: number) => {
         if (isAnimating || completionCalledRef.current) return;

         // Check if node is an obstacle
         if (obstacles.has(`${row},${col}`)) {
            setFeedback("wrong");
            later(() => {
               setFeedback(null);
            }, 1000);
            return;
         }

         setIsAnimating(true);

         // If path is empty, must start from start node
         if (path.length === 0) {
            if (row === startNode?.row && col === startNode?.col) {
               setPath([{ row, col }]);
               setFeedback(null);
            } else {
               setFeedback("wrong");
               later(() => {
                  setFeedback(null);
               }, 1000);
            }
         } else {
            const lastNode = path[path.length - 1];
            const rowDiff = Math.abs(row - lastNode.row);
            const colDiff = Math.abs(col - lastNode.col);

            // Check if clicked node is adjacent to last node in path
            if (
               (rowDiff === 1 && colDiff === 0) ||
               (rowDiff === 0 && colDiff === 1)
            ) {
               // Check if node is already in path (allow backtracking by removing from path)
               const nodeIndex = path.findIndex(
                  (n) => n.row === row && n.col === col
               );
               if (nodeIndex >= 0) {
                  // Remove from this point onwards (backtracking)
                  setPath(path.slice(0, nodeIndex + 1));
               } else {
                  // Add to path
                  setPath([...path, { row, col }]);
               }
               setFeedback(null);
            } else {
               setFeedback("wrong");
               later(() => {
                  setFeedback(null);
               }, 1000);
            }
         }

         later(() => {
            setIsAnimating(false);
         }, 200);
      },
      [path, startNode, obstacles, isAnimating]
   );

   // Calculate progress based on rounds (like other games)
   // Use useMemo to recalculate when round changes
   const progress = useMemo(() => {
      // Progress based on rounds completed, same as Match Shapes and Balance Scale
      // round starts at 1, so for round 1, progress should be 1/20 = 5%
      return rounds > 0
         ? Math.min(100, Math.max(0, (round / rounds) * 100))
         : 0;
   }, [round, rounds]);

   // Check if node is in path
   const isInPath = (row: number, col: number) => {
      return path.some((node) => node.row === row && node.col === col);
   };

   // Get path index for visual ordering
   const getPathIndex = (row: number, col: number) => {
      return path.findIndex((node) => node.row === row && node.col === col);
   };

   // Keyboard controls
   useEffect(() => {
      if (!startNode || !endNode) return;

      const handleKeyPress = (e: KeyboardEvent) => {
         if (isAnimating || completionCalledRef.current) return;

         // Arrow keys for navigation
         if (selectedRow === null || selectedCol === null) {
            // Initialize selection at start node
            if (
               e.key === "ArrowUp" ||
               e.key === "ArrowDown" ||
               e.key === "ArrowLeft" ||
               e.key === "ArrowRight"
            ) {
               setSelectedRow(startNode.row);
               setSelectedCol(startNode.col);
               return;
            }
         }

         let newRow = selectedRow ?? startNode.row;
         let newCol = selectedCol ?? startNode.col;

         switch (e.key) {
            case "ArrowUp":
            case "w":
            case "W":
               e.preventDefault();
               newRow = Math.max(0, (selectedRow ?? startNode.row) - 1);
               setSelectedRow(newRow);
               setSelectedCol(selectedCol ?? startNode.col);
               break;
            case "ArrowDown":
            case "s":
            case "S":
               e.preventDefault();
               newRow = Math.min(
                  gridSize - 1,
                  (selectedRow ?? startNode.row) + 1
               );
               setSelectedRow(newRow);
               setSelectedCol(selectedCol ?? startNode.col);
               break;
            case "ArrowLeft":
            case "a":
            case "A":
               e.preventDefault();
               newCol = Math.max(0, (selectedCol ?? startNode.col) - 1);
               setSelectedRow(selectedRow ?? startNode.row);
               setSelectedCol(newCol);
               break;
            case "ArrowRight":
            case "d":
            case "D":
               e.preventDefault();
               newCol = Math.min(
                  gridSize - 1,
                  (selectedCol ?? startNode.col) + 1
               );
               setSelectedRow(selectedRow ?? startNode.row);
               setSelectedCol(newCol);
               break;
            case "Enter":
            case " ":
            case "e":
            case "E":
               e.preventDefault();
               if (selectedRow !== null && selectedCol !== null) {
                  handleNodeClick(selectedRow, selectedCol);
               }
               break;
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [
      startNode,
      endNode,
      isAnimating,
      selectedRow,
      selectedCol,
      gridSize,
      handleNodeClick,
   ]);

   const compact = gridSize >= 10;
   const isWin = feedback === "correct";

   return (
      <div className={`${theme.game} ${css.root}`}>
         <div className={theme.header}>
            <p className={theme.subtitle}>
               Tap Start, then step up, down, left or right to reach End. Tap a
               node on your path to back up.
            </p>
            <div className={theme.chips}>
               <span className={theme.chip}>
                  Round <strong>{round}</strong> / {rounds}
               </span>
               <span className={theme.chip}>
                  Score <strong>{score}</strong> / {rounds * 5}
               </span>
               <span className={theme.chip}>
                  Path <strong>{path.length}</strong>
               </span>
            </div>
            <div className={css.progress} aria-hidden="true">
               <div
                  className={css.progressFill}
                  style={{ transform: `scaleX(${progress / 100})` }}
               />
            </div>
         </div>

         {/* keyed by round: a new board fades in; a wrong move shakes it, a finished circuit pops */}
         <div
            key={`board-${round}-${gridSize}`}
            className={`${css.boardWrap} ${theme.fadeUp}`}
         >
            <div
               className={`${theme.board} ${css.board} ${
                  compact ? css.compact : ""
               } ${
                  feedback === "wrong"
                     ? theme.shake
                     : isWin
                     ? theme.pop
                     : ""
               }`}
               style={{ "--cols": gridSize } as CSSProperties}
               role="group"
               aria-label={`Circuit board, ${gridSize} by ${gridSize}`}
            >
               {Array(gridSize)
                  .fill(null)
                  .map((_, ri) =>
                     Array(gridSize)
                        .fill(null)
                        .map((_, ci) => {
                           const isStart =
                              startNode?.row === ri && startNode?.col === ci;
                           const isEnd =
                              endNode?.row === ri && endNode?.col === ci;
                           const isObstacle = obstacles.has(`${ri},${ci}`);
                           const isSelected =
                              selectedRow === ri && selectedCol === ci;
                           const inPath = isInPath(ri, ci);
                           const pathIndex = getPathIndex(ri, ci);

                           // Determine arrow direction for path nodes
                           let arrowDirection:
                              | "up"
                              | "down"
                              | "left"
                              | "right"
                              | null = null;
                           if (inPath && pathIndex > 0) {
                              const prevNode = path[pathIndex - 1];
                              const rowDiff = ri - prevNode.row;
                              const colDiff = ci - prevNode.col;

                              if (rowDiff < 0) arrowDirection = "up";
                              else if (rowDiff > 0) arrowDirection = "down";
                              else if (colDiff < 0) arrowDirection = "left";
                              else if (colDiff > 0) arrowDirection = "right";
                           }

                           const cls = [
                              theme.cell,
                              css.node,
                              isStart ? css.start : "",
                              isEnd ? css.end : "",
                              isObstacle ? css.obstacle : "",
                              inPath && !isStart && !isEnd
                                 ? isWin
                                    ? css.pathDone
                                    : css.inPath
                                 : "",
                              isSelected && !isObstacle ? `${theme.selected} ${css.sel}` : "",
                           ]
                              .filter(Boolean)
                              .join(" ");

                           const label = isStart
                              ? "Start"
                              : isEnd
                              ? "End"
                              : isObstacle
                              ? "Blocked"
                              : inPath
                              ? `Path step ${pathIndex + 1}`
                              : "Node";

                           const ArrowIcon =
                              arrowDirection === "up"
                                 ? ArrowUpIcon
                                 : arrowDirection === "down"
                                 ? ArrowDownIcon
                                 : arrowDirection === "left"
                                 ? ArrowLeftIcon
                                 : arrowDirection === "right"
                                 ? ArrowRightIcon
                                 : null;

                           return (
                              <button
                                 key={`${ri}-${ci}`}
                                 type="button"
                                 onClick={() => {
                                    if (!isObstacle) {
                                       handleNodeClick(ri, ci);
                                       setSelectedRow(ri);
                                       setSelectedCol(ci);
                                    }
                                 }}
                                 className={cls}
                                 disabled={isAnimating || isObstacle}
                                 aria-label={`${label}, row ${ri + 1}, column ${
                                    ci + 1
                                 }`}
                                 title={label}
                              >
                                 {isStart && (
                                    <span className={css.nodeLabel}>
                                       {compact ? "S" : "Start"}
                                    </span>
                                 )}
                                 {isEnd && !isStart && (
                                    <span className={css.nodeLabel}>
                                       {compact ? "E" : "End"}
                                    </span>
                                 )}
                                 {!isStart && !isEnd && inPath && (
                                    // keyed by step: a new step lights up once
                                    <span
                                       key={`step-${pathIndex}`}
                                       className={`${css.step} ${theme.reveal}`}
                                    >
                                       {ArrowIcon && !compact && (
                                          <ArrowIcon
                                             className={css.arrow}
                                             aria-hidden="true"
                                          />
                                       )}
                                       <span className={css.stepNum}>
                                          {pathIndex + 1}
                                       </span>
                                    </span>
                                 )}
                                 {!isStart && !isEnd && !inPath && !isObstacle && (
                                    <span className={css.dot} aria-hidden="true" />
                                 )}
                                 {isObstacle && (
                                    <XMarkIcon
                                       className={css.blockIcon}
                                       aria-hidden="true"
                                    />
                                 )}
                              </button>
                           );
                        })
                  )}
            </div>
         </div>

         <div className={theme.feedbackSlot} aria-live="polite">
            {feedback === "correct" && (
               <div
                  className={`${theme.feedback} ${theme.feedbackOk} ${theme.pop}`}
               >
                  Circuit complete. +5 points
               </div>
            )}
            {feedback === "wrong" && (
               <div
                  className={`${theme.feedback} ${theme.feedbackWarn} ${theme.shake}`}
               >
                  That move does not connect. Try again.
               </div>
            )}
         </div>
      </div>
   );
}

export default CircuitPath;
