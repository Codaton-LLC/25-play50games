"use client";

import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import theme from "./theme.module.css";
import css from "./SequenceArrows.module.css";
import {
   ArrowLeftIcon,
   ArrowRightIcon,
   ArrowUpIcon,
   ArrowDownIcon,
   CheckCircleIcon,
   XCircleIcon,
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
   // round-end timers: cleared if the game unmounts mid-delay (they used to fire after leaving)
   const timersRef = useRef<number[]>([]);
   const later = useCallback((fn: () => void, ms: number) => {
      timersRef.current.push(window.setTimeout(fn, ms));
   }, []);
   useEffect(
      () => () => {
         timersRef.current.forEach((id) => window.clearTimeout(id));
         timersRef.current = [];
      },
      []
   );

   // Update refs when callbacks change
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
      onRoundCompleteRef.current = onRoundComplete;
   }, [onScoreUpdate, onComplete, onRoundComplete]);

   const arrowMap: Record<string, JSX.Element> = {
      up: <ArrowUpIcon className={css.arrow} aria-hidden="true" />,
      down: <ArrowDownIcon className={css.arrow} aria-hidden="true" />,
      left: <ArrowLeftIcon className={css.arrow} aria-hidden="true" />,
      right: <ArrowRightIcon className={css.arrow} aria-hidden="true" />,
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

            later(() => {
               if (round >= rounds) {
                  if (!completionCalledRef.current) {
                     completionCalledRef.current = true;
                     const finalScore = Math.min(100, score + roundScore);
                     later(() => {
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
            later(() => {
               if (round >= rounds) {
                  if (!completionCalledRef.current) {
                     completionCalledRef.current = true;
                     const finalScore = Math.min(100, score);
                     later(() => {
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
      [round, rounds, score, isRoundComplete, correctIndex, later]
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
   const correctArrow = options[correctIndex];

   return (
      <div className={`${theme.game} ${css.root}`}>
         <div className={theme.header}>
            <h3 className={theme.title}>Find the Next Arrow</h3>
            <div className={theme.chips}>
               <span className={theme.chip}>
                  Round <strong>{round} / {rounds}</strong>
               </span>
               <span className={theme.chip}>
                  Score <strong>{score} / {rounds * 5}</strong>
               </span>
            </div>
            <div
               className={css.progress}
               role="progressbar"
               aria-label="Round progress"
               aria-valuemin={0}
               aria-valuemax={rounds}
               aria-valuenow={round}
            >
               <div
                  className={css.progressFill}
                  style={{ transform: `scaleX(${Math.min(1, progress / 100)})` }}
               />
            </div>
         </div>

         {/* Sequence */}
         <div className={`${theme.panel} ${css.panel}`}>
            <div className={css.panelTop}>
               <span className={css.panelLabel}>What comes next?</span>
               <button
                  type="button"
                  className={`${theme.btn} ${css.hint} ${showHint ? css.hintOn : ""}`}
                  onClick={() => setShowHint(!showHint)}
                  disabled={isRoundComplete}
                  aria-pressed={showHint}
               >
                  <LightBulbIcon className={css.hintIcon} aria-hidden="true" />
                  {showHint ? "Hide hint" : "Show hint"}
               </button>
            </div>
            {showHint && (
               <div className={`${css.hintText} ${theme.fadeUp}`}>
                  <span className={css.hintLabel}>Pattern: </span>
                  {patternType}
               </div>
            )}
            <div
               key={`seq-${round}`}
               className={`${css.sequence} ${theme.stagger}`}
               style={{ "--n": sequence.length } as CSSProperties}
               role="list"
               aria-label="Arrow sequence"
            >
               {sequence.map((arrow, i) => {
                  const isGap = arrow === "?";
                  const revealed = isGap && feedback !== null && !!correctArrow;
                  return (
                     <div
                        key={i}
                        role="listitem"
                        className={`${css.tile} ${isGap ? css.tileGap : ""} ${
                           revealed ? css.tileSolved : ""
                        }`}
                        style={{ "--i": i } as CSSProperties}
                        aria-label={isGap ? (revealed ? `next: ${correctArrow}` : "missing arrow") : arrow}
                     >
                        {isGap ? (
                           revealed ? (
                              <span key="solved" className={`${css.tileInner} ${theme.reveal}`}>
                                 {arrowMap[correctArrow]}
                              </span>
                           ) : (
                              <span className={css.question}>?</span>
                           )
                        ) : (
                           arrowMap[arrow]
                        )}
                     </div>
                  );
               })}
            </div>
         </div>

         {/* Options */}
         <div
            key={`opts-${round}`}
            className={`${theme.options} ${css.options} ${css.enter}`}
            role="group"
            aria-label="Answer choices"
         >
            {options.map((arrow, i) => {
               const isSelectedOption = selected === i;
               const showFeedback = isSelectedOption && feedback !== null;
               const cls = [
                  theme.option,
                  css.option,
                  showFeedback && feedback === "correct" ? `${css.optCorrect} ${css.fx} ${theme.pop}` : "",
                  showFeedback && feedback === "wrong" ? `${css.optWrong} ${css.fx} ${theme.shake}` : "",
                  isRoundComplete && !isSelectedOption ? css.optDim : "",
               ]
                  .filter(Boolean)
                  .join(" ");

               return (
                  <button
                     key={i}
                     type="button"
                     className={cls}
                     style={{ "--i": i } as CSSProperties}
                     onClick={() => handleSelect(i)}
                     disabled={isRoundComplete}
                     aria-label={`Option ${i + 1}: ${arrow}`}
                  >
                     <span className={css.keyBadge} aria-hidden="true">
                        {i + 1}
                     </span>
                     {arrowMap[arrow]}
                     {showFeedback && feedback === "correct" && (
                        <CheckCircleIcon className={css.mark} aria-hidden="true" />
                     )}
                     {showFeedback && feedback === "wrong" && (
                        <XCircleIcon className={css.mark} aria-hidden="true" />
                     )}
                  </button>
               );
            })}
         </div>

         {/* Feedback (in flow, fixed height: nothing jumps and nothing hides under a bottom bar) */}
         <div className={theme.feedbackSlot} aria-live="polite">
            {feedback !== null && (
               <div
                  className={`${theme.feedback} ${
                     feedback === "correct" ? theme.feedbackOk : theme.feedbackWarn
                  }`}
               >
                  {feedback === "correct" ? "Correct, well read." : "Not quite. The answer is shown above."}
               </div>
            )}
         </div>
      </div>
   );
}

export default SequenceArrows;
