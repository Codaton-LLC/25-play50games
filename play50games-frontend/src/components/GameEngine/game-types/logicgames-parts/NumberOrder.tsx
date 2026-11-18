"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import theme from "./theme.module.css";
import css from "./NumberOrder.module.css";

function NumberOrder({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const maxRounds = config.rounds || 20;
   const [shuffled, setShuffled] = useState<number[]>([]);
   const [selected, setSelected] = useState<number[]>([]);
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [currentNumbers, setCurrentNumbers] = useState(3); // Start with 3 numbers
   const [isLoading, setIsLoading] = useState(true); // Prevent showing old numbers during transition
   // look only: a new id per dealt round keys the board so its tiles stagger in once per round
   const [roundId, setRoundId] = useState(0);
   // every pending timeout, cleared on unmount so no state update or callback fires after leaving
   const timersRef = useRef<Set<number>>(new Set());
   const later = useCallback((fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
         timersRef.current.delete(id);
         fn();
      }, ms);
      timersRef.current.add(id);
   }, []);
   useEffect(() => {
      const timers = timersRef.current;
      return () => {
         timers.forEach((id) => window.clearTimeout(id));
         timers.clear();
      };
   }, []);

   const startNewRound = useCallback(
      (roundNumber: number) => {
         // Hide numbers during transition - clear immediately
         setIsLoading(true);
         setShuffled([]); // Clear old numbers immediately
         setSelected([]);
         setFeedback(null);

         // Determine number count based on round
         let numCount = 3; // Rounds 1-5: 3 numbers
         if (roundNumber > 10) {
            numCount = 10; // Rounds 11-20: 10 numbers
         } else if (roundNumber > 5) {
            numCount = 5; // Rounds 6-10: 5 numbers
         }

         // Update currentNumbers and shuffle in the same batch
         const nums = Array.from({ length: numCount }, (_, i) => i + 1);
         // Create shuffled array once and store it
         const newShuffled = [...nums].sort(() => Math.random() - 0.5);

         // Set everything in one batch to prevent double update
         later(() => {
            setCurrentNumbers(numCount);
            setShuffled(newShuffled);
            setIsLoading(false);
            setRoundId((id) => id + 1);
         }, 100);
      },
      [later] // stable: later never changes
   );

   useEffect(() => {
      // Start first round only once
      startNewRound(1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []); // Empty dependency array - only run once on mount

   const handleNumberClick = useCallback(
      (num: number) => {
         if (selected.includes(num)) return;
         const newSelected = [...selected, num];
         setSelected(newSelected);

         if (newSelected.length === currentNumbers) {
            const isCorrect = newSelected.every((n, i) => n === i + 1);
            setFeedback(isCorrect ? "correct" : "wrong");

            const nextRound = currentRound + 1;
            const points = isCorrect ? 5 : 0; // 5 points per correct round
            const newScore = currentScore + points;

            setCurrentScore(newScore);
            setCurrentRound(nextRound);
            onScoreUpdate(newScore);

            later(() => {
               if (nextRound >= maxRounds) {
                  // Game complete
                  onComplete(newScore);
               } else {
                  // Continue to next round - pass nextRound to calculate correct number count
                  startNewRound(nextRound);
               }
            }, 800); // Faster transition
         }
      },
      [
         selected,
         currentNumbers,
         currentRound,
         currentScore,
         maxRounds,
         onScoreUpdate,
         onComplete,
         startNewRound,
         later,
      ]
   );

   // Remove last selected number (undo)
   const handleUndo = useCallback(() => {
      if (selected.length > 0) {
         setSelected((prev) => prev.slice(0, -1));
         setFeedback(null);
      }
   }, [selected.length]);

   // Keyboard controls for Number Order
   // Note: Keyboard selects by POSITION in grid, not value (e.g., press "1" to select first number in grid, press "2" to select second number in grid)
   // For positions 1-9: press 1-9
   // For position 10: press 0
   // Backspace/Delete: Remove last selected number
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         const key = e.key;

         // Backspace or Delete: Remove last selected number
         if (key === "Backspace" || key === "Delete") {
            if (selected.length > 0) {
               e.preventDefault();
               handleUndo();
            }
            return;
         }

         let position = -1;

         // Positions 1-9: press 1-9
         if (key >= "1" && key <= "9") {
            position = parseInt(key) - 1; // Convert to 0-based index
         }
         // Position 10: press 0
         else if (key === "0" && currentNumbers >= 10) {
            position = 9; // 10th position is index 9
         }

         // Select the number by its POSITION in the grid, not value
         if (
            position >= 0 &&
            position < shuffled.length &&
            !selected.includes(shuffled[position])
         ) {
            e.preventDefault();
            handleNumberClick(shuffled[position]);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [selected, currentNumbers, shuffled, handleNumberClick, handleUndo]);

   const roundOver = feedback !== null;
   const shownRound = Math.min(currentRound + 1, maxRounds);
   const progress = Math.min(1, (currentRound + 1) / maxRounds);
   // 3 and 5 numbers sit in one row, 10 in two rows of five
   const cols = currentNumbers >= 10 ? 5 : currentNumbers;

   return (
      <div className={`${theme.game} ${css.root}`}>
         <div className={`${theme.header} ${css.header}`}>
            <h3 className={theme.title}>Number Order</h3>
            <p className={theme.subtitle}>
               Tap the {currentNumbers} numbers from smallest to largest.
            </p>
            <div className={theme.chips}>
               <span className={theme.chip}>
                  Round <strong>{shownRound}</strong> / {maxRounds}
               </span>
               <span className={theme.chip}>
                  Score <strong>{currentScore}</strong> / {maxRounds * 5}
               </span>
            </div>
            <div
               className={css.progress}
               role="progressbar"
               aria-valuemin={0}
               aria-valuemax={maxRounds}
               aria-valuenow={shownRound}
               aria-label="Round progress"
            >
               <div className={css.progressFill} style={{ transform: `scaleX(${progress})` }} />
            </div>
         </div>

         <div
            key={isLoading ? "dealing" : `round-${roundId}`}
            className={`${theme.board} ${css.board} ${isLoading ? "" : css.dealt}`}
            style={{ ["--cols" as any]: cols }}
            role="group"
            aria-label="Numbers"
            aria-busy={isLoading || shuffled.length === 0}
         >
            {isLoading || shuffled.length === 0
               ? Array.from({ length: currentNumbers }, (_, i) => (
                    <div key={i} className={`${theme.cell} ${css.placeholder}`} aria-hidden="true" />
                 ))
               : shuffled.map((num, index) => {
                    const selectionIndex = selected.indexOf(num);
                    const isSelected = selectionIndex >= 0;
                    const isCorrectOrder = isSelected && selected[selectionIndex] === selectionIndex + 1;

                    const cls = [
                       theme.cell,
                       css.tile,
                       isSelected ? (isCorrectOrder ? theme.correct : theme.wrong) : "",
                       isSelected ? css.picked : "",
                    ]
                       .filter(Boolean)
                       .join(" ");

                    return (
                       <button
                          key={num}
                          type="button"
                          onClick={() => handleNumberClick(num)}
                          disabled={isSelected}
                          className={cls}
                          style={{ ["--i" as any]: index }}
                          aria-label={`${num}${
                             isSelected ? `, picked ${selectionIndex + 1}${isCorrectOrder ? "" : ", out of order"}` : ""
                          }`}
                       >
                          {/* keyed by state: a right pick pops, a wrong one shakes, once */}
                          <span
                             key={isSelected ? "picked" : "open"}
                             className={`${css.tileText} ${
                                isSelected ? (isCorrectOrder ? theme.pop : theme.shake) : ""
                             }`}
                          >
                             {num}
                          </span>
                          {isSelected && (
                             <span className={css.order} aria-hidden="true">
                                {selectionIndex + 1}
                             </span>
                          )}
                       </button>
                    );
                 })}
         </div>

         <div className={`${theme.panel} ${css.tray}`}>
            <div className={css.trayHead}>
               <span className={css.trayLabel}>Your order</span>
               <button
                  type="button"
                  className={`${theme.btn} ${css.undo}`}
                  onClick={handleUndo}
                  disabled={selected.length === 0 || roundOver}
               >
                  Undo
               </button>
            </div>
            <div className={css.slots}>
               {Array.from({ length: currentNumbers }, (_, i) => {
                  const num = selected[i];
                  const filled = num !== undefined;
                  const ok = filled && num === i + 1;
                  return (
                     <span
                        key={i}
                        className={`${css.slot} ${filled ? (ok ? css.slotOk : css.slotWarn) : ""}`}
                     >
                        {filled ? (
                           <span key={num} className={theme.reveal}>
                              {num}
                           </span>
                        ) : null}
                     </span>
                  );
               })}
            </div>
         </div>

         <div className={theme.feedbackSlot} aria-live="polite">
            {feedback !== null && (
               <div
                  className={`${theme.feedback} ${
                     feedback === "correct"
                        ? `${theme.feedbackOk} ${theme.pop}`
                        : `${theme.feedbackWarn} ${theme.shake}`
                  }`}
               >
                  {feedback === "correct" ? "Correct order. +5 points" : "Out of order. On to the next round."}
               </div>
            )}
         </div>
      </div>
   );
}

export default NumberOrder;
