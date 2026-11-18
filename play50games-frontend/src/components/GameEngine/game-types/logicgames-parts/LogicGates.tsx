"use client";

import { useState, useEffect, useRef, useMemo, useCallback, type CSSProperties } from "react";
import theme from "./theme.module.css";
import css from "./LogicGates.module.css";
import { CheckCircleIcon, XCircleIcon, LightBulbIcon } from "@heroicons/react/24/outline";

function LogicGates({
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

   // Get gates from config or use defaults
   const availableGates = useMemo(() => {
      return config?.gates || ["AND", "OR", "NOT"];
   }, [config?.gates]);

   const [gate, setGate] = useState<"AND" | "OR" | "NOT">("AND");
   const [input1, setInput1] = useState(0);
   const [input2, setInput2] = useState<number | null>(null); // null for NOT gate
   const [selected, setSelected] = useState<number | null>(null);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isRoundComplete, setIsRoundComplete] = useState(false);
   const completionCalledRef = useRef(false);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);
   const onRoundCompleteRef = useRef(onRoundComplete);
   // round-end timers: cleared if the game unmounts mid-delay (they used to fire after leaving)
   const timersRef = useRef<number[]>([]);
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

   // Calculate output based on gate type
   const getOutput = useCallback(() => {
      if (gate === "AND") {
         return input1 === 1 && input2 === 1 ? 1 : 0;
      } else if (gate === "OR") {
         return input1 === 1 || input2 === 1 ? 1 : 0;
      } else if (gate === "NOT") {
         return input1 === 0 ? 1 : 0;
      }
      return 0;
   }, [gate, input1, input2]);

   // Initialize round
   useEffect(() => {
      // Reset state
      setSelected(null);
      setFeedback(null);
      setIsRoundComplete(false);
      completionCalledRef.current = false;

      // Select random gate
      const randomGate = availableGates[
         Math.floor(Math.random() * availableGates.length)
      ] as "AND" | "OR" | "NOT";
      setGate(randomGate);

      // Generate random inputs
      setInput1(Math.floor(Math.random() * 2));
      if (randomGate === "NOT") {
         setInput2(null);
      } else {
         setInput2(Math.floor(Math.random() * 2));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [round, availableGates]);

   const handleSelect = useCallback(
      (output: number) => {
         if (isRoundComplete) return;

         setSelected(output);
         setIsRoundComplete(true);

         const correctOutput = getOutput();
         const isCorrect = output === correctOutput;

         setFeedback(isCorrect ? "correct" : "wrong");

         // Update score - send incremental score (5 points) to parent
         if (isCorrect) {
            onScoreUpdateRef.current(5);
         }

         // Move to next round or complete game
         timersRef.current.push(window.setTimeout(() => {
            if (round >= rounds) {
               // Game complete
               if (!completionCalledRef.current) {
                  completionCalledRef.current = true;
                  // Calculate final score: score is already accumulated in parent (0-100)
                  // score is currentScore prop, and we just added 5 if correct
                  // So finalScore = score + (isCorrect ? 5 : 0), capped at 100
                  const finalScore = Math.min(
                     100,
                     isCorrect ? score + 5 : score
                  );
                  // Don't call onScoreUpdate again - parent already has the updated score
                  timersRef.current.push(window.setTimeout(() => {
                     onCompleteRef.current?.(finalScore);
                  }, 1000));
               }
            } else {
               onRoundCompleteRef.current?.();
            }
         }, 1500));
      },
      [round, rounds, score, isRoundComplete, getOutput]
   );

   // Keyboard controls
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         if (isRoundComplete) return;

         if (e.key === "0") {
            handleSelect(0);
            e.preventDefault();
         } else if (e.key === "1") {
            handleSelect(1);
            e.preventDefault();
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [isRoundComplete, handleSelect]);

   // Calculate correct output and progress
   const correctOutput = getOutput();
   const progress = (round / rounds) * 100;
   const answered = selected !== null;

   const bit = (label: string, value: number | null) => (
      <div className={css.part}>
         <div className={css.partLabel}>{label}</div>
         <div
            className={`${css.bit} ${value === 1 ? css.bitOn : ""}`}
            aria-label={`${label}: ${value}`}
         >
            {value}
         </div>
      </div>
   );

   const answerBtn = (value: 0 | 1) => {
      const isSel = selected === value;
      const cls = [
         theme.option,
         css.answer,
         isSel && feedback === "correct" ? `${css.ansCorrect} ${theme.pop}` : "",
         isSel && feedback === "wrong" ? `${css.ansWrong} ${theme.shake}` : "",
         isRoundComplete && !isSel ? css.ansDim : "",
      ]
         .filter(Boolean)
         .join(" ");
      return (
         <button
            type="button"
            onClick={() => handleSelect(value)}
            disabled={isRoundComplete}
            className={cls}
            aria-label={`Output ${value}`}
         >
            {isSel && feedback === "correct" && (
               <CheckCircleIcon className={css.mark} aria-hidden="true" />
            )}
            {isSel && feedback === "wrong" && (
               <XCircleIcon className={css.mark} aria-hidden="true" />
            )}
            {value}
         </button>
      );
   };

   return (
      <div className={`${theme.game} ${css.root}`}>
         <div className={theme.header}>
            <h3 className={theme.title}>What does the gate output?</h3>
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

         {/* Game Content (global class name kept) */}
         <div className={`logic-gates-content ${css.content}`}>
            {/* Circuit Display: one line, every part scales with the panel */}
            <div className={`${theme.panel} ${css.circuit}`}>
               <div key={`row-${round}`} className={`${css.row} ${theme.stagger}`}>
                  <div style={{ "--i": 0 } as CSSProperties}>{bit("Input A", input1)}</div>

                  <div style={{ "--i": 1 } as CSSProperties} className={css.part}>
                     <div className={css.partLabel}>Gate</div>
                     <div className={css.gate}>{gate}</div>
                  </div>

                  {gate !== "NOT" && (
                     <div style={{ "--i": 2 } as CSSProperties}>{bit("Input B", input2)}</div>
                  )}

                  <div style={{ "--i": 3 } as CSSProperties} className={css.arrow} aria-hidden="true">
                     →
                  </div>

                  <div style={{ "--i": 4 } as CSSProperties} className={css.part}>
                     <div className={css.partLabel}>Output</div>
                     <div
                        className={`${css.lamp} ${answered && correctOutput === 1 ? css.lampOn : ""}`}
                        aria-label={answered ? `Output ${correctOutput}` : "Output unknown"}
                     >
                        {answered ? (
                           <LightBulbIcon
                              key="bulb"
                              className={`${css.bulb} ${theme.reveal}`}
                              aria-hidden="true"
                           />
                        ) : (
                           <span className={css.lampQ}>?</span>
                        )}
                     </div>
                  </div>
               </div>
            </div>

            {/* Output Options */}
            <div className={css.options} role="group" aria-label="Choose the output">
               {answerBtn(0)}
               {answerBtn(1)}
            </div>

            {/* Feedback (fixed-height slot: nothing below jumps) */}
            <div className={theme.feedbackSlot} aria-live="polite">
               {feedback !== null && (
                  <div
                     className={`${theme.feedback} ${
                        feedback === "correct" ? theme.feedbackOk : theme.feedbackWarn
                     }`}
                  >
                     {feedback === "correct"
                        ? "Correct, the lamp agrees."
                        : `Not quite. The output is ${correctOutput}.`}
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}

export default LogicGates;
