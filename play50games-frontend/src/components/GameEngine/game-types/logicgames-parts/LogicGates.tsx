"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   ArrowPathIcon,
   TrophyIcon,
   LightBulbIcon,
} from "@heroicons/react/24/outline";

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
         setTimeout(() => {
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
                  setTimeout(() => {
                     onCompleteRef.current?.(finalScore);
                  }, 1000);
               }
            } else {
               onRoundCompleteRef.current?.();
            }
         }, 1500);
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
                     transition: "width 0.3s",
                     boxShadow: "rgba(125, 211, 252, 0.5) 0px 0px 10px",
                  }}
               />
            </div>
         </div>

         {/* Game Content */}
         <div className="logic-gates-content">
            {/* Circuit Display */}
            <div
               style={{
                  background: "var(--card)",
                  border: "2px solid var(--stroke)",
                  borderRadius: "20px",
                  padding: "40px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                  marginBottom: "32px",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     gap: "40px",
                     flexWrap: "wrap",
                  }}
               >
                  {/* Input 1 */}
                  <div
                     style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                     }}
                  >
                     <div
                        style={{
                           fontSize: "14px",
                           fontWeight: 600,
                           color: "var(--muted)",
                        }}
                     >
                        Input A
                     </div>
                     <div
                        style={{
                           width: "80px",
                           height: "80px",
                           borderRadius: "12px",
                           background:
                              input1 === 1
                                 ? "linear-gradient(135deg, rgba(134,239,172,0.3) 0%, rgba(134,239,172,0.1) 100%)"
                                 : "rgba(255, 255, 255, 0.05)",
                           border: `2px solid ${
                              input1 === 1 ? "var(--ok)" : "var(--stroke)"
                           }`,
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           fontSize: "32px",
                           fontWeight: 700,
                           color: input1 === 1 ? "var(--ok)" : "var(--muted)",
                        }}
                     >
                        {input1}
                     </div>
                  </div>

                  {/* Gate */}
                  <div
                     style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                     }}
                  >
                     <div
                        style={{
                           fontSize: "14px",
                           fontWeight: 600,
                           color: "var(--muted)",
                        }}
                     >
                        Gate
                     </div>
                     <div
                        style={{
                           padding: "16px 32px",
                           borderRadius: "12px",
                           background:
                              "linear-gradient(135deg, rgba(125, 211, 252, 0.2) 0%, rgba(125, 211, 252, 0.1) 100%)",
                           border: "2px solid var(--accent)",
                           fontSize: "24px",
                           fontWeight: 700,
                           color: "var(--accent)",
                        }}
                     >
                        {gate}
                     </div>
                  </div>

                  {/* Input 2 (only for AND/OR) */}
                  {gate !== "NOT" && (
                     <div
                        style={{
                           display: "flex",
                           flexDirection: "column",
                           alignItems: "center",
                           gap: "12px",
                        }}
                     >
                        <div
                           style={{
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "var(--muted)",
                           }}
                        >
                           Input B
                        </div>
                        <div
                           style={{
                              width: "80px",
                              height: "80px",
                              borderRadius: "12px",
                              background:
                                 input2 === 1
                                    ? "linear-gradient(135deg, rgba(134,239,172,0.3) 0%, rgba(134,239,172,0.1) 100%)"
                                    : "rgba(255, 255, 255, 0.05)",
                              border: `2px solid ${
                                 input2 === 1 ? "var(--ok)" : "var(--stroke)"
                              }`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "32px",
                              fontWeight: 700,
                              color:
                                 input2 === 1 ? "var(--ok)" : "var(--muted)",
                           }}
                        >
                           {input2}
                        </div>
                     </div>
                  )}

                  {/* Arrow */}
                  <div
                     style={{
                        fontSize: "32px",
                        color: "var(--accent)",
                        fontWeight: 700,
                     }}
                  >
                     →
                  </div>

                  {/* Output Lamp */}
                  <div
                     style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                     }}
                  >
                     <div
                        style={{
                           fontSize: "14px",
                           fontWeight: 600,
                           color: "var(--muted)",
                        }}
                     >
                        Output
                     </div>
                     <div
                        style={{
                           width: "100px",
                           height: "100px",
                           borderRadius: "50%",
                           background:
                              selected !== null && selected === correctOutput
                                 ? selected === 1
                                    ? "radial-gradient(circle, rgba(251, 191, 36, 0.8) 0%, rgba(251, 191, 36, 0.4) 50%, rgba(251, 191, 36, 0.2) 100%)"
                                    : "rgba(255, 255, 255, 0.05)"
                                 : "rgba(255, 255, 255, 0.05)",
                           border: `3px solid ${
                              selected !== null && selected === correctOutput
                                 ? selected === 1
                                    ? "#fbbf24"
                                    : "var(--stroke)"
                                 : "var(--stroke)"
                           }`,
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           boxShadow:
                              selected !== null &&
                              selected === correctOutput &&
                              selected === 1
                                 ? "0 0 30px rgba(251, 191, 36, 0.6), inset 0 0 20px rgba(251, 191, 36, 0.3)"
                                 : "none",
                           transition: "all 0.3s ease",
                           position: "relative",
                        }}
                     >
                        {selected !== null && selected === correctOutput ? (
                           selected === 1 ? (
                              <LightBulbIcon
                                 style={{
                                    width: 50,
                                    height: 50,
                                    color: "#fbbf24",
                                 }}
                              />
                           ) : (
                              <LightBulbIcon
                                 style={{
                                    width: 50,
                                    height: 50,
                                    color: "var(--muted)",
                                    opacity: 0.3,
                                 }}
                              />
                           )
                        ) : (
                           <span
                              style={{
                                 fontSize: "24px",
                                 fontWeight: 700,
                                 color: "var(--muted)",
                              }}
                           >
                              ?
                           </span>
                        )}
                     </div>
                  </div>
               </div>
            </div>

            {/* Output Options */}
            <div
               style={{
                  display: "flex",
                  gap: "24px",
                  justifyContent: "center",
                  flexWrap: "wrap",
               }}
            >
               <button
                  onClick={() => handleSelect(0)}
                  disabled={isRoundComplete}
                  style={{
                     background:
                        selected === 0
                           ? feedback === "correct"
                              ? "linear-gradient(135deg, rgba(134,239,172,0.3) 0%, rgba(134,239,172,0.1) 100%)"
                              : "linear-gradient(135deg, rgba(252,165,165,0.3) 0%, rgba(252,165,165,0.1) 100%)"
                           : "var(--card)",
                     border: `2px solid ${
                        selected === 0
                           ? feedback === "correct"
                              ? "var(--ok)"
                              : "var(--warn)"
                           : "var(--stroke)"
                     }`,
                     borderRadius: "16px",
                     padding: "32px 48px",
                     fontSize: "48px",
                     fontWeight: 700,
                     color:
                        selected === 0
                           ? feedback === "correct"
                              ? "var(--ok)"
                              : "var(--warn)"
                           : "var(--text)",
                     cursor: isRoundComplete ? "not-allowed" : "pointer",
                     transition: "all 0.3s ease",
                     transform: selected === 0 ? "scale(0.95)" : "scale(1)",
                     boxShadow:
                        selected === 0
                           ? "0 8px 20px rgba(125, 211, 252, 0.4)"
                           : "0 4px 12px rgba(0, 0, 0, 0.2)",
                     opacity: isRoundComplete && selected !== 0 ? 0.5 : 1,
                     position: "relative",
                  }}
               >
                  {selected === 0 && feedback === "correct" && (
                     <div
                        style={{
                           position: "absolute",
                           top: "-8px",
                           right: "-8px",
                           background: "var(--ok)",
                           borderRadius: "50%",
                           padding: "4px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           zIndex: 10,
                           boxShadow: "0 4px 12px rgba(134, 239, 172, 0.5)",
                        }}
                     >
                        <CheckCircleIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--bg)",
                           }}
                        />
                     </div>
                  )}
                  {selected === 0 && feedback === "wrong" && (
                     <div
                        style={{
                           position: "absolute",
                           top: "-8px",
                           right: "-8px",
                           background: "var(--warn)",
                           borderRadius: "50%",
                           padding: "4px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           zIndex: 10,
                           boxShadow: "0 4px 12px rgba(252, 165, 165, 0.5)",
                        }}
                     >
                        <XCircleIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--bg)",
                           }}
                        />
                     </div>
                  )}
                  0
               </button>

               <button
                  onClick={() => handleSelect(1)}
                  disabled={isRoundComplete}
                  style={{
                     background:
                        selected === 1
                           ? feedback === "correct"
                              ? "linear-gradient(135deg, rgba(134,239,172,0.3) 0%, rgba(134,239,172,0.1) 100%)"
                              : "linear-gradient(135deg, rgba(252,165,165,0.3) 0%, rgba(252,165,165,0.1) 100%)"
                           : "var(--card)",
                     border: `2px solid ${
                        selected === 1
                           ? feedback === "correct"
                              ? "var(--ok)"
                              : "var(--warn)"
                           : "var(--stroke)"
                     }`,
                     borderRadius: "16px",
                     padding: "32px 48px",
                     fontSize: "48px",
                     fontWeight: 700,
                     color:
                        selected === 1
                           ? feedback === "correct"
                              ? "var(--ok)"
                              : "var(--warn)"
                           : "var(--text)",
                     cursor: isRoundComplete ? "not-allowed" : "pointer",
                     transition: "all 0.3s ease",
                     transform: selected === 1 ? "scale(0.95)" : "scale(1)",
                     boxShadow:
                        selected === 1
                           ? "0 8px 20px rgba(125, 211, 252, 0.4)"
                           : "0 4px 12px rgba(0, 0, 0, 0.2)",
                     opacity: isRoundComplete && selected !== 1 ? 0.5 : 1,
                     position: "relative",
                  }}
               >
                  {selected === 1 && feedback === "correct" && (
                     <div
                        style={{
                           position: "absolute",
                           top: "-8px",
                           right: "-8px",
                           background: "var(--ok)",
                           borderRadius: "50%",
                           padding: "4px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           zIndex: 10,
                           boxShadow: "0 4px 12px rgba(134, 239, 172, 0.5)",
                        }}
                     >
                        <CheckCircleIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--bg)",
                           }}
                        />
                     </div>
                  )}
                  {selected === 1 && feedback === "wrong" && (
                     <div
                        style={{
                           position: "absolute",
                           top: "-8px",
                           right: "-8px",
                           background: "var(--warn)",
                           borderRadius: "50%",
                           padding: "4px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           zIndex: 10,
                           boxShadow: "0 4px 12px rgba(252, 165, 165, 0.5)",
                        }}
                     >
                        <XCircleIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--bg)",
                           }}
                        />
                     </div>
                  )}
                  1
               </button>
            </div>

            {/* Feedback Notification */}
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
                     color:
                        feedback === "correct" ? "var(--ok)" : "var(--warn)",
                     display: "flex",
                     alignItems: "center",
                     gap: "10px",
                     marginTop: "24px",
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
                        <span>Try again! You can do it!</span>
                     </>
                  )}
               </div>
            )}
         </div>
      </div>
   );
}

export default LogicGates;
