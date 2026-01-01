"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
   ArrowLeftIcon,
   ArrowRightIcon,
   ArrowUpIcon,
   ArrowDownIcon,
   CheckCircleIcon,
   XCircleIcon,
   ArrowPathIcon,
   TrophyIcon,
   LightBulbIcon,
} from "@heroicons/react/24/outline";

function SequenceArrows({
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
   onComplete?: (finalScore?: number) => void;
   onRoundComplete?: () => void;
}) {
   const rounds = config?.rounds || maxRounds;
   const round = Math.min(currentRound, rounds);
   const score = currentScore;

   // Get sequence length from config or use default (increases with round)
   const getSequenceLength = useCallback(() => {
      if (config?.sequenceLength) return config.sequenceLength;
      // Progressive difficulty: rounds 1-5 = 3, 6-10 = 4, 11-15 = 5, 16-20 = 6
      if (round > 15) return 6;
      if (round > 10) return 5;
      if (round > 5) return 4;
      return 3;
   }, [round, config?.sequenceLength]);

   const [sequence, setSequence] = useState<string[]>([]);
   const [options, setOptions] = useState<string[]>([]);
   const [correctIndex, setCorrectIndex] = useState(0);
   const [selected, setSelected] = useState<number | null>(null);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isRoundComplete, setIsRoundComplete] = useState(false);
   const [showHint, setShowHint] = useState(false);
   const [patternType, setPatternType] = useState<string>("");
   const completionCalledRef = useRef(false);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);
   const onRoundCompleteRef = useRef(onRoundComplete);
   const handleSelectRef = useRef<(index: number) => void>();

   // Update refs when callbacks change
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
      onRoundCompleteRef.current = onRoundComplete;
   }, [onScoreUpdate, onComplete, onRoundComplete]);

   const arrowMap: Record<string, JSX.Element> = {
      up: (
         <ArrowUpIcon
            style={{ width: 40, height: 40, color: "var(--accent)" }}
         />
      ),
      down: (
         <ArrowDownIcon
            style={{ width: 40, height: 40, color: "var(--accent)" }}
         />
      ),
      left: (
         <ArrowLeftIcon
            style={{ width: 40, height: 40, color: "var(--accent)" }}
         />
      ),
      right: (
         <ArrowRightIcon
            style={{ width: 40, height: 40, color: "var(--accent)" }}
         />
      ),
   };

   // Detect pattern type from sequence
   const detectPattern = useCallback(
      (pattern: string[]): { type: string; description: string } => {
         if (pattern.length < 2)
            return { type: "random", description: "Random sequence" };

         const arrowOrder = ["up", "right", "down", "left"];
         const arrowOrderReverse = ["up", "left", "down", "right"];

         // Check for clockwise rotation
         let isClockwise = true;
         for (let i = 0; i < pattern.length - 1; i++) {
            const currentIndex = arrowOrder.indexOf(pattern[i]);
            const nextIndex = arrowOrder.indexOf(pattern[i + 1]);
            if (nextIndex !== (currentIndex + 1) % 4) {
               isClockwise = false;
               break;
            }
         }
         if (isClockwise) {
            return {
               type: "clockwise",
               description: "Clockwise rotation: ↑ → ↓ ←",
            };
         }

         // Check for counter-clockwise rotation
         let isCounterClockwise = true;
         for (let i = 0; i < pattern.length - 1; i++) {
            const currentIndex = arrowOrderReverse.indexOf(pattern[i]);
            const nextIndex = arrowOrderReverse.indexOf(pattern[i + 1]);
            if (nextIndex !== (currentIndex + 1) % 4) {
               isCounterClockwise = false;
               break;
            }
         }
         if (isCounterClockwise) {
            return {
               type: "counter-clockwise",
               description: "Counter-clockwise rotation: ↑ ← ↓ →",
            };
         }

         // Check for repeating loops (same arrow repeated)
         let isRepeating = true;
         const firstArrow = pattern[0];
         for (let i = 1; i < pattern.length; i++) {
            if (pattern[i] !== firstArrow) {
               isRepeating = false;
               break;
            }
         }
         if (isRepeating) {
            const arrowSymbol =
               firstArrow === "up"
                  ? "↑"
                  : firstArrow === "down"
                  ? "↓"
                  : firstArrow === "left"
                  ? "←"
                  : "→";
            return {
               type: "repeating",
               description: `Repeating loops: ${arrowSymbol} ${arrowSymbol} ...`,
            };
         }

         // Check for alternating directions
         if (pattern.length >= 2) {
            const first = pattern[0];
            const second = pattern[1];
            let isAlternating = true;
            for (let i = 2; i < pattern.length; i++) {
               if (i % 2 === 0 && pattern[i] !== first) {
                  isAlternating = false;
                  break;
               }
               if (i % 2 === 1 && pattern[i] !== second) {
                  isAlternating = false;
                  break;
               }
            }
            if (isAlternating) {
               const firstSymbol =
                  first === "up"
                     ? "↑"
                     : first === "down"
                     ? "↓"
                     : first === "left"
                     ? "←"
                     : "→";
               const secondSymbol =
                  second === "up"
                     ? "↑"
                     : second === "down"
                     ? "↓"
                     : second === "left"
                     ? "←"
                     : "→";
               return {
                  type: "alternating",
                  description: `Alternating directions: ${firstSymbol} ${secondSymbol} ${firstSymbol} ${secondSymbol} ...`,
               };
            }
         }

         // Check for step jumps (skipping one direction)
         let isStepJump = true;
         for (let i = 0; i < pattern.length - 1; i++) {
            const currentIndex = arrowOrder.indexOf(pattern[i]);
            const nextIndex = arrowOrder.indexOf(pattern[i + 1]);
            if (nextIndex !== (currentIndex + 2) % 4) {
               isStepJump = false;
               break;
            }
         }
         if (isStepJump) {
            return {
               type: "step-jump",
               description: "Step jumps: skipping one direction each time",
            };
         }

         return { type: "random", description: "Random sequence" };
      },
      []
   );

   // Generate pattern based on pattern type
   const generatePattern = useCallback(
      (patternType: string, length: number): string[] => {
         const arrowKeys = ["up", "down", "left", "right"];
         const arrowOrder = ["up", "right", "down", "left"]; // Clockwise
         const arrowOrderReverse = ["up", "left", "down", "right"]; // Counter-clockwise

         switch (patternType) {
            case "clockwise": {
               const startIndex = Math.floor(Math.random() * 4);
               const pattern: string[] = [];
               for (let i = 0; i < length; i++) {
                  pattern.push(arrowOrder[(startIndex + i) % 4]);
               }
               return pattern;
            }
            case "counter-clockwise": {
               const startIndex = Math.floor(Math.random() * 4);
               const pattern: string[] = [];
               for (let i = 0; i < length; i++) {
                  pattern.push(arrowOrderReverse[(startIndex + i) % 4]);
               }
               return pattern;
            }
            case "repeating": {
               const arrow =
                  arrowKeys[Math.floor(Math.random() * arrowKeys.length)];
               return Array.from({ length }, () => arrow);
            }
            case "alternating": {
               const first =
                  arrowKeys[Math.floor(Math.random() * arrowKeys.length)];
               let second =
                  arrowKeys[Math.floor(Math.random() * arrowKeys.length)];
               while (second === first) {
                  second =
                     arrowKeys[Math.floor(Math.random() * arrowKeys.length)];
               }
               const pattern: string[] = [];
               for (let i = 0; i < length; i++) {
                  pattern.push(i % 2 === 0 ? first : second);
               }
               return pattern;
            }
            case "step-jump": {
               const startIndex = Math.floor(Math.random() * 4);
               const pattern: string[] = [];
               for (let i = 0; i < length; i++) {
                  pattern.push(arrowOrder[(startIndex + i * 2) % 4]);
               }
               return pattern;
            }
            default:
               // Random
               return Array.from(
                  { length },
                  () => arrowKeys[Math.floor(Math.random() * arrowKeys.length)]
               );
         }
      },
      []
   );

   // Get next arrow based on pattern type
   const getNextArrow = useCallback(
      (pattern: string[], patternType: string): string => {
         const arrowOrder = ["up", "right", "down", "left"];
         const arrowOrderReverse = ["up", "left", "down", "right"];

         switch (patternType) {
            case "clockwise": {
               const lastArrow = pattern[pattern.length - 1];
               const lastIndex = arrowOrder.indexOf(lastArrow);
               return arrowOrder[(lastIndex + 1) % 4];
            }
            case "counter-clockwise": {
               const lastArrow = pattern[pattern.length - 1];
               const lastIndex = arrowOrderReverse.indexOf(lastArrow);
               return arrowOrderReverse[(lastIndex + 1) % 4];
            }
            case "repeating": {
               return pattern[0]; // Same as first
            }
            case "alternating": {
               return pattern.length % 2 === 0 ? pattern[0] : pattern[1];
            }
            case "step-jump": {
               const lastArrow = pattern[pattern.length - 1];
               const lastIndex = arrowOrder.indexOf(lastArrow);
               return arrowOrder[(lastIndex + 2) % 4];
            }
            default:
               // Random - just pick a random arrow
               const arrowKeys = ["up", "down", "left", "right"];
               return arrowKeys[Math.floor(Math.random() * arrowKeys.length)];
         }
      },
      []
   );

   // Initialize round
   useEffect(() => {
      setSelected(null);
      setFeedback(null);
      setIsRoundComplete(false);
      setShowHint(false);
      completionCalledRef.current = false;

      const arrowKeys = ["up", "down", "left", "right"];
      const sequenceLength = getSequenceLength();

      // Choose a random pattern type
      const patternTypes = [
         "clockwise",
         "counter-clockwise",
         "repeating",
         "alternating",
         "step-jump",
         "random",
      ];
      const selectedPatternType =
         patternTypes[Math.floor(Math.random() * patternTypes.length)];

      // Generate pattern based on type
      const pattern = generatePattern(selectedPatternType, sequenceLength);

      // Detect pattern type (should match selectedPatternType)
      const detectedPattern = detectPattern(pattern);
      setPatternType(detectedPattern.description);

      // Get next arrow based on pattern
      const next = getNextArrow(pattern, selectedPatternType);
      const allOptions = [...arrowKeys].sort(() => Math.random() - 0.5);

      setSequence([...pattern, "?"]);
      setOptions(allOptions);
      setCorrectIndex(allOptions.indexOf(next));
   }, [round, getSequenceLength, generatePattern, getNextArrow, detectPattern]);

   const handleSelect = useCallback(
      (index: number) => {
         if (isRoundComplete) return;

         setSelected(index);
         const isCorrect = index === correctIndex;
         setFeedback(isCorrect ? "correct" : "wrong");
         setIsRoundComplete(true);

         if (isCorrect) {
            const roundScore = 5;
            onScoreUpdateRef.current(roundScore);

            setTimeout(() => {
               if (round >= rounds) {
                  if (!completionCalledRef.current) {
                     completionCalledRef.current = true;
                     const finalScore = Math.min(100, score + roundScore);
                     setTimeout(() => {
                        onCompleteRef.current?.(finalScore);
                     }, 1000);
                  }
               } else {
                  if (onRoundCompleteRef.current) {
                     onRoundCompleteRef.current();
                  }
               }
               setFeedback(null);
            }, 1500);
         } else {
            setTimeout(() => {
               if (round >= rounds) {
                  if (!completionCalledRef.current) {
                     completionCalledRef.current = true;
                     const finalScore = Math.min(100, score);
                     setTimeout(() => {
                        onCompleteRef.current?.(finalScore);
                     }, 1000);
                  }
               } else {
                  if (onRoundCompleteRef.current) {
                     onRoundCompleteRef.current();
                  }
               }
               setFeedback(null);
            }, 1000);
         }
      },
      [round, rounds, score, isRoundComplete, correctIndex]
   );

   // Update handleSelect ref
   useEffect(() => {
      handleSelectRef.current = handleSelect;
   }, [handleSelect]);

   // Keyboard controls - Support both number keys (1-4) and arrow keys/WASD
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         if (isRoundComplete) return;

         const key = e.key;
         const keyLower = key.toLowerCase();
         let index = -1;

         // Number keys 1-4 for direct selection
         if (keyLower >= "1" && keyLower <= "4") {
            index = parseInt(keyLower) - 1; // 1-4 → 0-3
         }
         // Arrow keys or WASD for arrow direction selection
         else {
            let arrowDirection: string | null = null;

            // Arrow keys (case-sensitive check)
            if (key === "ArrowUp") arrowDirection = "up";
            else if (key === "ArrowDown") arrowDirection = "down";
            else if (key === "ArrowLeft") arrowDirection = "left";
            else if (key === "ArrowRight") arrowDirection = "right";
            // WASD keys
            else if (keyLower === "w") arrowDirection = "up";
            else if (keyLower === "s") arrowDirection = "down";
            else if (keyLower === "a") arrowDirection = "left";
            else if (keyLower === "d") arrowDirection = "right";

            // Find the index of the option that matches the arrow direction
            if (arrowDirection !== null) {
               index = options.findIndex((arrow) => arrow === arrowDirection);
            }
         }

         if (index >= 0 && index < options.length && handleSelectRef.current) {
            e.preventDefault();
            handleSelectRef.current(index);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [options, isRoundComplete]);

   // Progress calculation
   const progress = (round / rounds) * 100;

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
         {/* Header with Round and Score - Same as Match the Shapes */}
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
                  Round {round} / {rounds}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <TrophyIcon
                     style={{ width: 16, height: 16, color: "var(--ok)" }}
                  />
                  Score: {score} / {rounds * 5}
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
                     width: `${progress}%`,
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

         {/* Main Content */}
         <div
            style={{
               width: "100%",
               display: "flex",
               flexDirection: "column",
               gap: "32px",
            }}
         >
            {/* Sequence Display */}
            <div
               style={{
                  background: "var(--card)",
                  border: "2px solid var(--stroke)",
                  borderRadius: "20px",
                  padding: "40px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "24px",
                  position: "relative",
               }}
            >
               <div
                  style={{
                     fontSize: "1.1rem",
                     fontWeight: 700,
                     color: "var(--accent)",
                     marginBottom: "8px",
                  }}
               >
                  Find the Next Arrow
               </div>
               {/* Hint Button */}
               <button
                  onClick={() => setShowHint(!showHint)}
                  disabled={isRoundComplete}
                  style={{
                     position: "absolute",
                     top: "16px",
                     right: "16px",
                     background: showHint
                        ? "rgba(125, 211, 252, 0.2)"
                        : "rgba(125, 211, 252, 0.1)",
                     border: "2px solid var(--accent)",
                     borderRadius: "12px",
                     padding: "8px 16px",
                     fontSize: "0.875rem",
                     fontWeight: 600,
                     color: "var(--accent)",
                     cursor: isRoundComplete ? "not-allowed" : "pointer",
                     display: "flex",
                     alignItems: "center",
                     gap: "6px",
                     transition: "all 0.3s ease",
                     opacity: isRoundComplete ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                     if (!isRoundComplete) {
                        e.currentTarget.style.background =
                           "rgba(125, 211, 252, 0.3)";
                     }
                  }}
                  onMouseLeave={(e) => {
                     if (!isRoundComplete) {
                        e.currentTarget.style.background = showHint
                           ? "rgba(125, 211, 252, 0.2)"
                           : "rgba(125, 211, 252, 0.1)";
                     }
                  }}
               >
                  <LightBulbIcon style={{ width: 16, height: 16 }} />
                  {showHint ? "Hide Hint" : "Show Hint"}
               </button>
               {/* Hint Display */}
               {showHint && (
                  <div
                     style={{
                        width: "100%",
                        background: "rgba(125, 211, 252, 0.1)",
                        border: "1px solid var(--accent)",
                        borderRadius: "12px",
                        padding: "12px",
                        fontSize: "0.875rem",
                        color: "var(--text)",
                        marginTop: "-16px",
                        marginBottom: "8px",
                        textAlign: "center",
                        fontWeight: 600,
                     }}
                  >
                     <span style={{ color: "var(--accent)" }}>Pattern: </span>
                     {patternType}
                  </div>
               )}
               <div
                  style={{
                     display: "flex",
                     gap: "16px",
                     justifyContent: "center",
                     alignItems: "center",
                     flexWrap: "wrap",
                  }}
               >
                  {sequence.map((arrow, i) => (
                     <div
                        key={i}
                        style={{
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           width: "64px",
                           height: "64px",
                           background:
                              arrow === "?"
                                 ? "rgba(125, 211, 252, 0.2)"
                                 : "rgba(255, 255, 255, 0.05)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "12px",
                           fontSize: arrow === "?" ? "1.5rem" : "inherit",
                           fontWeight: arrow === "?" ? 700 : 400,
                           color:
                              arrow === "?" ? "var(--accent)" : "var(--text)",
                        }}
                     >
                        {arrow === "?" ? "?" : arrowMap[arrow]}
                     </div>
                  ))}
               </div>
            </div>

            {/* Options */}
            <div
               style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "16px",
               }}
            >
               {options.map((arrow, i) => {
                  const isSelectedOption = selected === i;
                  const showFeedback = isSelectedOption && feedback !== null;

                  return (
                     <button
                        key={i}
                        onClick={() => handleSelect(i)}
                        disabled={isRoundComplete}
                        style={{
                           background:
                              showFeedback && feedback === "correct"
                                 ? "linear-gradient(135deg, rgba(134,239,172,0.3) 0%, rgba(134,239,172,0.1) 100%)"
                                 : showFeedback && feedback === "wrong"
                                 ? "linear-gradient(135deg, rgba(252,165,165,0.3) 0%, rgba(252,165,165,0.1) 100%)"
                                 : "var(--card)",
                           border:
                              showFeedback && feedback === "correct"
                                 ? "2px solid var(--ok)"
                                 : showFeedback && feedback === "wrong"
                                 ? "2px solid var(--warn)"
                                 : "2px solid var(--stroke)",
                           borderRadius: "16px",
                           cursor: isRoundComplete ? "not-allowed" : "pointer",
                           transition: "all 0.3s ease",
                           transform: isSelectedOption
                              ? "scale(0.95)"
                              : "scale(1)",
                           boxShadow: isSelectedOption
                              ? "0 8px 20px rgba(125, 211, 252, 0.4)"
                              : "0 4px 12px rgba(0, 0, 0, 0.2)",
                           opacity:
                              isRoundComplete && !isSelectedOption ? 0.5 : 1,
                           padding: "20px",
                           position: "relative",
                           display: "flex",
                           flexDirection: "column",
                           alignItems: "center",
                           gap: "8px",
                        }}
                        onMouseEnter={(e) => {
                           if (!isRoundComplete) {
                              e.currentTarget.style.transform = "scale(1.05)";
                              e.currentTarget.style.boxShadow =
                                 "0 8px 20px rgba(125, 211, 252, 0.4)";
                           }
                        }}
                        onMouseLeave={(e) => {
                           if (!isRoundComplete) {
                              e.currentTarget.style.transform = isSelectedOption
                                 ? "scale(0.95)"
                                 : "scale(1)";
                              e.currentTarget.style.boxShadow = isSelectedOption
                                 ? "0 8px 20px rgba(125, 211, 252, 0.4)"
                                 : "0 4px 12px rgba(0, 0, 0, 0.2)";
                           }
                        }}
                     >
                        <div
                           style={{
                              position: "absolute",
                              top: "8px",
                              right: "8px",
                              background: "rgba(125, 211, 252, 0.2)",
                              borderRadius: "50%",
                              width: "24px",
                              height: "24px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "var(--accent)",
                           }}
                        >
                           {i + 1}
                        </div>
                        <div
                           style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                           }}
                        >
                           {arrowMap[arrow]}
                        </div>
                        {showFeedback && feedback === "correct" && (
                           <CheckCircleIcon
                              style={{
                                 width: 24,
                                 height: 24,
                                 color: "var(--ok)",
                                 position: "absolute",
                                 top: "8px",
                                 left: "8px",
                              }}
                           />
                        )}
                        {showFeedback && feedback === "wrong" && (
                           <XCircleIcon
                              style={{
                                 width: 24,
                                 height: 24,
                                 color: "var(--warn)",
                                 position: "absolute",
                                 top: "8px",
                                 left: "8px",
                              }}
                           />
                        )}
                     </button>
                  );
               })}
            </div>
         </div>

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
                  position: "fixed",
                  bottom: "24px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 1000,
                  backdropFilter: "blur(10px)",
                  boxShadow:
                     feedback === "correct"
                        ? "0 6px 24px rgba(134, 239, 172, 0.4)"
                        : "0 6px 24px rgba(252, 165, 165, 0.4)",
               }}
            >
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon style={{ width: 24, height: 24 }} />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon style={{ width: 24, height: 24 }} />
                     <span>Try again!</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
}

export default SequenceArrows;
