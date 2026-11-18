"use client";

import { useState, useEffect, useRef } from "react";
import theme from "./theme.module.css";
import css from "./Sudoku4x4.module.css";
import { bottomObstruction } from "./useMobileFit";
import NumberKeypad from "../../NumberKeypad";

function Sudoku4x4({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}) {
   const [grid, setGrid] = useState<(number | null)[][]>([]);
   const [initialGrid, setInitialGrid] = useState<(number | null)[][]>([]);
   const [selected, setSelected] = useState<{
      row: number;
      col: number;
   } | null>(null);
   // phones: the keypad opens under the grid; bring it into view when a cell is picked
   const keypadRef = useRef<HTMLDivElement>(null);
   useEffect(() => {
      if (!selected) return;
      const id = window.setTimeout(() => {
         const el = keypadRef.current;
         if (!el) return;
         // above the bottom edge and any bottom bar (the cookie banner)
         const limit = window.innerHeight - bottomObstruction() - 12;
         const r = el.getBoundingClientRect();
         if (r.bottom > limit) window.scrollBy({ top: r.bottom - limit, behavior: "smooth" });
      }, 30);
      return () => window.clearTimeout(id);
   }, [selected]);
   const [errors, setErrors] = useState<Set<string>>(new Set());
   const [isComplete, setIsComplete] = useState(false);
   const [feedback, setFeedback] = useState<string>("");
   const completionCalledRef = useRef(false);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);

   // Update refs when callbacks change
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
   }, [onScoreUpdate, onComplete]);

   // Generate a random valid 4x4 Sudoku puzzle
   const generateSudokuPuzzle = (): (number | null)[][] => {
      // Helper function to check if a number can be placed
      const isValid = (
         grid: (number | null)[][],
         row: number,
         col: number,
         num: number
      ): boolean => {
         // Check row
         for (let c = 0; c < 4; c++) {
            if (grid[row][c] === num) return false;
         }

         // Check column
         for (let r = 0; r < 4; r++) {
            if (grid[r][col] === num) return false;
         }

         // Check 2x2 box
         const boxRow = Math.floor(row / 2) * 2;
         const boxCol = Math.floor(col / 2) * 2;
         for (let r = boxRow; r < boxRow + 2; r++) {
            for (let c = boxCol; c < boxCol + 2; c++) {
               if (grid[r][c] === num) return false;
            }
         }

         return true;
      };

      // Helper function to solve Sudoku using backtracking
      const solveSudoku = (grid: (number | null)[][]): boolean => {
         for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
               if (grid[r][c] === null) {
                  // Try numbers 1-4 in random order
                  const numbers = [1, 2, 3, 4];
                  for (let i = numbers.length - 1; i > 0; i--) {
                     const j = Math.floor(Math.random() * (i + 1));
                     [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
                  }

                  for (const num of numbers) {
                     if (isValid(grid, r, c, num)) {
                        grid[r][c] = num;
                        if (solveSudoku(grid)) {
                           return true;
                        }
                        grid[r][c] = null;
                     }
                  }
                  return false;
               }
            }
         }
         return true;
      };

      // Start with empty grid
      const solution: (number | null)[][] = Array(4)
         .fill(null)
         .map(() => Array(4).fill(null));

      // Generate a random valid solution
      solveSudoku(solution);

      // Create puzzle by removing some cells
      const puzzle: (number | null)[][] = solution.map((row) => [...row]);

      // Remove 6-8 cells randomly (keeping 8-10 clues for a solvable puzzle)
      const cellsToRemove = 6 + Math.floor(Math.random() * 3); // 6, 7, or 8
      const positions: Array<[number, number]> = [];
      for (let r = 0; r < 4; r++) {
         for (let c = 0; c < 4; c++) {
            positions.push([r, c]);
         }
      }

      // Shuffle positions
      for (let i = positions.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [positions[i], positions[j]] = [positions[j], positions[i]];
      }

      // Remove cells
      for (let i = 0; i < cellsToRemove && i < positions.length; i++) {
         const [r, c] = positions[i];
         puzzle[r][c] = null;
      }

      return puzzle;
   };

   // Generate a new puzzle when game starts
   useEffect(() => {
      if (isPlaying) {
         const newPuzzle = generateSudokuPuzzle();
         setGrid(newPuzzle);
         setInitialGrid(newPuzzle.map((row) => [...row]));
         setIsComplete(false);
         setFeedback("");
         setSelected(null);
         setErrors(new Set());
         completionCalledRef.current = false; // Reset completion flag
      }
   }, [isPlaying]);

   // Keyboard navigation for Sudoku
   useEffect(() => {
      if (!isPlaying) return;

      const handleKeyPress = (e: KeyboardEvent) => {
         // Arrow keys to navigate
         if (selected) {
            let newRow = selected.row;
            let newCol = selected.col;

            if (e.key === "ArrowUp" && newRow > 0) {
               e.preventDefault();
               newRow--;
            } else if (e.key === "ArrowDown" && newRow < 3) {
               e.preventDefault();
               newRow++;
            } else if (e.key === "ArrowLeft" && newCol > 0) {
               e.preventDefault();
               newCol--;
            } else if (e.key === "ArrowRight" && newCol < 3) {
               e.preventDefault();
               newCol++;
            }

            // Move to the new cell if it's not an initial clue
            // Allow navigation to any cell (empty or filled) as long as it's not an initial clue
            if (
               (newRow !== selected.row || newCol !== selected.col) &&
               initialGrid[newRow]?.[newCol] === null
            ) {
               setSelected({ row: newRow, col: newCol });
            } else if (
               (newRow !== selected.row || newCol !== selected.col) &&
               initialGrid[newRow]?.[newCol] !== null
            ) {
               // If target cell is an initial clue, try to find next available cell in that direction
               let found = false;
               if (e.key === "ArrowUp") {
                  for (let r = newRow - 1; r >= 0; r--) {
                     if (initialGrid[r]?.[newCol] === null) {
                        setSelected({ row: r, col: newCol });
                        found = true;
                        break;
                     }
                  }
               } else if (e.key === "ArrowDown") {
                  for (let r = newRow + 1; r < 4; r++) {
                     if (initialGrid[r]?.[newCol] === null) {
                        setSelected({ row: r, col: newCol });
                        found = true;
                        break;
                     }
                  }
               } else if (e.key === "ArrowLeft") {
                  for (let c = newCol - 1; c >= 0; c--) {
                     if (initialGrid[newRow]?.[c] === null) {
                        setSelected({ row: newRow, col: c });
                        found = true;
                        break;
                     }
                  }
               } else if (e.key === "ArrowRight") {
                  for (let c = newCol + 1; c < 4; c++) {
                     if (initialGrid[newRow]?.[c] === null) {
                        setSelected({ row: newRow, col: c });
                        found = true;
                        break;
                     }
                  }
               }
            }
         } else {
            // If no cell selected, select first available cell
            if (e.key.startsWith("Arrow")) {
               e.preventDefault();
               for (let r = 0; r < 4; r++) {
                  for (let c = 0; c < 4; c++) {
                     if (initialGrid[r]?.[c] === null) {
                        setSelected({ row: r, col: c });
                        return;
                     }
                  }
               }
            }
         }

         // Backspace/Delete to clear selected cell
         if (
            (e.key === "Backspace" || e.key === "Delete") &&
            selected &&
            initialGrid[selected.row]?.[selected.col] === null
         ) {
            e.preventDefault();
            // Clear the selected cell
            const newGrid = grid.map((r, ri) =>
               r.map((c, ci) =>
                  ri === selected.row && ci === selected.col ? null : c
               )
            );
            setGrid(newGrid);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [isPlaying, selected, initialGrid, grid]);

   // Check for errors and update error set
   useEffect(() => {
      if (grid.length === 0) return;

      const validateCell = (
         row: number,
         col: number,
         value: number | null
      ): boolean => {
         if (value === null) return true;

         // Check row
         for (let c = 0; c < 4; c++) {
            if (c !== col && grid[row] && grid[row][c] === value) return false;
         }

         // Check column
         for (let r = 0; r < 4; r++) {
            if (r !== row && grid[r] && grid[r][col] === value) return false;
         }

         // Check 2x2 box
         const boxRow = Math.floor(row / 2) * 2;
         const boxCol = Math.floor(col / 2) * 2;
         for (let r = boxRow; r < boxRow + 2; r++) {
            for (let c = boxCol; c < boxCol + 2; c++) {
               if (r !== row && c !== col && grid[r] && grid[r][c] === value)
                  return false;
            }
         }

         return true;
      };

      const newErrors = new Set<string>();
      for (let r = 0; r < 4; r++) {
         for (let c = 0; c < 4; c++) {
            if (
               grid[r] &&
               grid[r][c] !== null &&
               !validateCell(r, c, grid[r][c])
            ) {
               newErrors.add(`${r}-${c}`);
            }
         }
      }
      setErrors(newErrors);
   }, [grid]);

   // Check if puzzle is complete and valid
   useEffect(() => {
      if (grid.length === 0) return;

      const allFilled = grid.every((row) => row.every((cell) => cell !== null));
      if (allFilled && errors.size === 0 && !completionCalledRef.current) {
         setIsComplete(true);
         setFeedback("Solved. Every row, column and box checks out.");
         const score = 100;
         completionCalledRef.current = true; // Prevent multiple calls
         onScoreUpdateRef.current(score);
         setTimeout(() => {
            onCompleteRef.current(score);
         }, 1500);
      } else if (allFilled && errors.size > 0) {
         setFeedback("Some numbers clash. Fix the marked cells.");
      } else if (!allFilled) {
         setFeedback("");
      }
   }, [grid, errors]);

   const handleCellClick = (row: number, col: number) => {
      // Can't edit initial clues
      if (initialGrid[row]?.[col] !== null) return;

      // Allow clicking on any cell (including cells with errors)
      // If clicking on the same cell, deselect it
      if (selected?.row === row && selected?.col === col) {
         setSelected(null);
      } else {
         setSelected({ row, col });
      }
   };

   const handleNumberSelect = (num: number) => {
      if (!selected) return;
      if (initialGrid[selected.row]?.[selected.col] !== null) return;

      const newGrid = grid.map((r, ri) =>
         r.map((c, ci) =>
            ri === selected.row && ci === selected.col ? num : c
         )
      );
      setGrid(newGrid);
      // Keep selection active so user can continue editing or move to next cell
      // User can click another cell or press a number to change it
   };

   const handleClear = () => {
      if (!selected) return;
      if (initialGrid[selected.row]?.[selected.col] !== null) return;

      const newGrid = grid.map((r, ri) =>
         r.map((c, ci) =>
            ri === selected.row && ci === selected.col ? null : c
         )
      );
      setGrid(newGrid);
      // Keep selection active so user can continue editing
   };

   const isInitialCell = (row: number, col: number) => {
      return initialGrid[row]?.[col] !== null;
   };

   // boxes 0-1 and 1-0 get a tint so the four 2x2 boxes read without uneven gaps
   const isAltBox = (row: number, col: number) =>
      (Math.floor(row / 2) + Math.floor(col / 2)) % 2 === 1;

   return (
      <div className={`${theme.game} ${css.root}`}>
         <div className={theme.header}>
            <h3 className={theme.title}>Number Grid 4x4</h3>
            <p className={theme.subtitle}>
               Fill each row, column and 2x2 box with 1 to 4.
            </p>
         </div>

         <div className={theme.feedbackSlot} aria-live="polite">
            {feedback && (
               <div
                  key={feedback}
                  className={`${theme.feedback} ${
                     isComplete ? `${theme.feedbackOk} ${theme.pop}` : theme.feedbackWarn
                  }`}
               >
                  {feedback}
               </div>
            )}
         </div>

         <div
            className={`${theme.board} ${css.board} ${isComplete ? theme.pop : ""}`}
            role="group"
            aria-label="Number grid"
         >
            {grid.map((row, ri) =>
               row.map((cell, ci) => {
                  const cellKey = `${ri}-${ci}`;
                  const isError = errors.has(cellKey);
                  const isInitial = isInitialCell(ri, ci);
                  const isSelected =
                     selected?.row === ri && selected?.col === ci;

                  const cls = [
                     theme.cell,
                     isInitial ? css.given : css.entered,
                     !isInitial && !isSelected && !isError && isAltBox(ri, ci) ? css.altBox : "",
                     isSelected ? theme.selected : "",
                     isError ? `${theme.wrong} ${css.wrongCell}` : "",
                  ]
                     .filter(Boolean)
                     .join(" ");

                  return (
                     <button
                        key={cellKey}
                        type="button"
                        onClick={() => handleCellClick(ri, ci)}
                        className={cls}
                        disabled={isInitial}
                        aria-label={`Row ${ri + 1}, column ${ci + 1}${
                           cell ? `, ${cell}` : ", empty"
                        }${isInitial ? ", given" : ""}${isError ? ", conflict" : ""}`}
                        aria-pressed={isInitial ? undefined : isSelected}
                        title={
                           isError
                              ? "This cell has an error. Click to select and fix it."
                              : isInitial
                              ? "This is a clue and cannot be changed"
                              : "Click to select this cell"
                        }
                     >
                        {cell ? (
                           // keyed by value: a new number pops in, a conflicting one shakes once
                           <span
                              key={`${cell}-${isError ? "x" : "o"}`}
                              className={`${css.cellText} ${
                                 isInitial ? "" : isError ? theme.shake : theme.reveal
                              }`}
                           >
                              {cell}
                           </span>
                        ) : null}
                     </button>
                  );
               })
            )}
         </div>

         {selected && (
            <div className={css.keypad} ref={keypadRef}>
               <NumberKeypad
                  onNumberSelect={handleNumberSelect}
                  onClear={handleClear}
                  minNumber={1}
                  maxNumber={4}
                  showClear={true}
               />
            </div>
         )}
      </div>
   );
}

export default Sudoku4x4;