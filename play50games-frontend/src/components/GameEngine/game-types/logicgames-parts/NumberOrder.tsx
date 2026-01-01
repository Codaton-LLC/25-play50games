"use client";

import { useState, useEffect, useCallback } from "react";
import {
   SparklesIcon,
   ArrowPathIcon,
   TrophyIcon,
   XMarkIcon,
   CheckCircleIcon,
   XCircleIcon,
} from "@heroicons/react/24/outline";

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
         setTimeout(() => {
            setCurrentNumbers(numCount);
            setShuffled(newShuffled);
            setIsLoading(false);
         }, 100);
      },
      [] // Empty dependencies - function never changes
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

            setTimeout(() => {
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

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            padding: "24px",
            maxWidth: "600px",
            margin: "0 auto",
         }}
      >
         {/* Modern Header */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: "16px",
               padding: "20px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            <h3
               style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  margin: "0 0 16px 0",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
               }}
            >
               <SparklesIcon
                  style={{ width: 28, height: 28, color: "var(--accent)" }}
               />
               Number Order
            </h3>

            <div
               style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.875rem",
                  color: "var(--muted)",
                  fontWeight: 500,
                  marginBottom: "12px",
               }}
            >
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <ArrowPathIcon
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                  />
                  Round {currentRound + 1} / {maxRounds}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <TrophyIcon
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                  />
                  Score: {currentScore} / {maxRounds * 5}
               </span>
            </div>

            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  position: "relative",
               }}
            >
               <div
                  style={{
                     width: `${((currentRound + 1) / maxRounds) * 100}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "4px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Instructions */}
         <div
            style={{
               background: "var(--card)",
               border: "2px solid var(--stroke)",
               borderRadius: "16px",
               padding: "20px",
               boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
               width: "100%",
               textAlign: "center",
            }}
         >
            <div
               style={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "var(--muted)",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
               }}
            >
               <SparklesIcon style={{ width: 18, height: 18 }} />
               Click numbers from smallest to largest
            </div>
            <div
               style={{
                  fontSize: "0.875rem",
                  color: "var(--accent)",
                  fontWeight: 500,
               }}
            >
               Select {currentNumbers} numbers in order (1, 2, 3...)
            </div>
         </div>

         {/* Number Grid */}
         {isLoading || shuffled.length === 0 ? (
            <div
               style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "16px",
                  width: "100%",
                  maxWidth: "500px",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: "100px",
               }}
            >
               <div
                  style={{
                     fontSize: "0.875rem",
                     color: "var(--muted)",
                     fontWeight: 500,
                  }}
               >
                  Loading next round...
               </div>
            </div>
         ) : (
            <div
               style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "16px",
                  width: "100%",
                  maxWidth: "500px",
                  justifyContent: "center",
                  alignItems: "center",
               }}
            >
               {shuffled.map((num) => {
                  const isSelected = selected.includes(num);
                  const selectionIndex = selected.indexOf(num);
                  const isCorrectOrder =
                     selectionIndex >= 0 &&
                     selected[selectionIndex] === selectionIndex + 1;

                  return (
                     <button
                        key={num}
                        onClick={() => handleNumberClick(num)}
                        disabled={isSelected}
                        style={{
                           width: "60px",
                           height: "60px",
                           borderRadius: "12px",
                           background: isSelected
                              ? isCorrectOrder
                                 ? "linear-gradient(135deg, rgba(134,239,172,0.4) 0%, rgba(134,239,172,0.2) 100%)"
                                 : "linear-gradient(135deg, rgba(252,165,165,0.4) 0%, rgba(252,165,165,0.2) 100%)"
                              : "linear-gradient(135deg, rgba(125, 211, 252, 0.4) 0%, rgba(125, 211, 252, 0.2) 100%)",
                           border: isSelected
                              ? isCorrectOrder
                                 ? "2px solid var(--ok)"
                                 : "2px solid var(--warn)"
                              : "2px solid var(--accent)",
                           boxShadow: isSelected
                              ? isCorrectOrder
                                 ? "rgba(134, 239, 172, 0.3) 0px 6px 20px"
                                 : "rgba(252, 165, 165, 0.3) 0px 6px 20px"
                              : "rgba(125, 211, 252, 0.3) 0px 6px 20px",
                           cursor: isSelected ? "not-allowed" : "pointer",
                           transition: "0.3s",
                           transform: isSelected ? "scale(0.95)" : "scale(1)",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           position: "relative",
                           fontSize: "1.8rem",
                           fontWeight: 700,
                           color: isSelected
                              ? isCorrectOrder
                                 ? "var(--ok)"
                                 : "var(--warn)"
                              : "var(--accent)",
                        }}
                        onMouseEnter={(e) => {
                           if (!isSelected) {
                              e.currentTarget.style.transform = "scale(1.05)";
                              e.currentTarget.style.boxShadow =
                                 "rgba(125, 211, 252, 0.5) 0px 8px 24px";
                           }
                        }}
                        onMouseLeave={(e) => {
                           if (!isSelected) {
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.boxShadow =
                                 "rgba(125, 211, 252, 0.3) 0px 6px 20px";
                           }
                        }}
                     >
                        {num}
                     </button>
                  );
               })}
            </div>
         )}

         {/* Selected Numbers Preview */}
         {selected.length > 0 && (
            <div
               style={{
                  background: "var(--card)",
                  border: "2px solid var(--stroke)",
                  borderRadius: "16px",
                  padding: "16px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                  width: "100%",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     justifyContent: "space-between",
                     alignItems: "center",
                     marginBottom: "12px",
                  }}
               >
                  <div
                     style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--muted)",
                     }}
                  >
                     Your selection:
                  </div>
                  <button
                     onClick={handleUndo}
                     style={{
                        background: "var(--warn)",
                        border: "1px solid var(--warn)",
                        borderRadius: "8px",
                        padding: "6px 12px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "white",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                     }}
                     onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--warn)";
                        e.currentTarget.style.opacity = "0.9";
                        e.currentTarget.style.transform = "scale(1.05)";
                     }}
                     onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--warn)";
                        e.currentTarget.style.opacity = "1";
                        e.currentTarget.style.transform = "scale(1)";
                     }}
                  >
                     <XMarkIcon style={{ width: 14, height: 14 }} />
                     Undo
                  </button>
               </div>
               <div
                  style={{
                     display: "flex",
                     gap: "8px",
                     justifyContent: "center",
                     flexWrap: "wrap",
                  }}
               >
                  {selected.map((num, index) => {
                     const isCorrect = num === index + 1;
                     return (
                        <div
                           key={index}
                           style={{
                              width: "50px",
                              height: "50px",
                              borderRadius: "12px",
                              background: isCorrect
                                 ? "linear-gradient(135deg, var(--ok) 0%, #10b981 100%)"
                                 : "linear-gradient(135deg, var(--warn) 0%, #ef4444 100%)",
                              border: `2px solid ${
                                 isCorrect ? "var(--ok)" : "var(--warn)"
                              }`,
                              boxShadow: isCorrect
                                 ? "0 4px 12px rgba(134, 239, 172, 0.4)"
                                 : "0 4px 12px rgba(252, 165, 165, 0.4)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "1.25rem",
                              fontWeight: 700,
                              color: "white",
                           }}
                        >
                           {num}
                        </div>
                     );
                  })}
               </div>
            </div>
         )}

         {/* Feedback Message */}
         {feedback !== null && (
            <div
               style={{
                  padding: "16px 24px",
                  borderRadius: "12px",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  animation: "slideIn 0.3s ease-out",
                  background:
                     feedback === "correct"
                        ? "rgba(134, 239, 172, 0.2)"
                        : "rgba(252, 165, 165, 0.2)",
                  border: `1px solid ${
                     feedback === "correct" ? "var(--ok)" : "var(--warn)"
                  }`,
                  color: feedback === "correct" ? "var(--ok)" : "var(--warn)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
               }}
            >
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon style={{ width: 24, height: 24 }} />
                     <span>Correct! Great job! +5 points</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon style={{ width: 24, height: 24 }} />
                     <span>Wrong order! Try again next round!</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
}

export default NumberOrder;