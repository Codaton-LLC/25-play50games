"use client";

import { useState, useEffect } from "react";
import {
   ScaleIcon,
   ArrowPathIcon,
   TrophyIcon,
   ArrowLeftIcon,
   ArrowRightIcon,
   CheckCircleIcon,
   XCircleIcon,
} from "@heroicons/react/24/outline";
import {
   useKeyboardControls,
   createKeyboardMapping,
} from "@/hooks/useKeyboardControls";

function BalanceScale({
   config,
   currentRound = 1,
   maxRounds = 20,
   currentScore = 0,
   onScoreUpdate,
}: {
   config: Record<string, any>;
   currentRound?: number;
   maxRounds?: number;
   currentScore?: number;
   onScoreUpdate: (score: number) => void;
}) {
   const [leftWeight, setLeftWeight] = useState(0);
   const [rightWeight, setRightWeight] = useState(0);
   const [selected, setSelected] = useState<"left" | "right" | "equal" | null>(
      null
   );
   const [correct, setCorrect] = useState<boolean | null>(null);
   const [isAnimating, setIsAnimating] = useState(false);

   // Initialize weights when component mounts or resets
   useEffect(() => {
      const left = Math.floor(Math.random() * 10) + 1;
      const right = Math.floor(Math.random() * 10) + 1;
      setLeftWeight(left);
      setRightWeight(right);
      setSelected(null);
      setCorrect(null);
      setIsAnimating(false);
   }, []);

   const handleSelect = (choice: "left" | "right" | "equal") => {
      if (selected !== null) return; // Prevent multiple clicks

      setSelected(choice);
      setIsAnimating(true);

      let isCorrect = false;
      if (choice === "left") isCorrect = leftWeight > rightWeight;
      else if (choice === "right") isCorrect = rightWeight > leftWeight;
      else isCorrect = leftWeight === rightWeight;

      setCorrect(isCorrect);

      // Faster animation for balance scale (0.5s instead of 1.5s) to allow 20 rounds in 60 seconds
      const animationDelay = 500;

      setTimeout(() => {
         setIsAnimating(false);
         // Send score for this round (5 points if correct, 0 if wrong)
         // Using 5 points per round so 20 rounds = 100 points max
         onScoreUpdate(isCorrect ? 5 : 0);

         // Reset for next round (will be triggered by parent component)
         const left = Math.floor(Math.random() * 10) + 1;
         const right = Math.floor(Math.random() * 10) + 1;
         setLeftWeight(left);
         setRightWeight(right);
         setSelected(null);
         setCorrect(null);
      }, animationDelay);
   };

   // Keyboard event handlers using general hook
   useKeyboardControls({
      mappings: createKeyboardMapping([
         { keys: ["ArrowLeft", "a", "A"], action: () => handleSelect("left") },
         {
            keys: ["ArrowRight", "d", "D"],
            action: () => handleSelect("right"),
         },
         {
            keys: ["Enter", " ", "e", "E"],
            action: () => handleSelect("equal"),
         },
      ]),
      enabled: selected === null && !isAnimating,
   });

   const getScaleRotation = () => {
      if (!isAnimating) return 0;
      if (leftWeight > rightWeight) return -8;
      if (rightWeight > leftWeight) return 8;
      return 0;
   };

   const getLeftPosition = () => {
      if (!isAnimating) return 0;
      if (leftWeight > rightWeight) return -15;
      if (rightWeight > leftWeight) return 15;
      return 0;
   };

   const getRightPosition = () => {
      if (!isAnimating) return 0;
      if (leftWeight > rightWeight) return 15;
      if (rightWeight > leftWeight) return -15;
      return 0;
   };

   return (
      <div
         className="balance-scale-game"
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem",
            padding: "2rem",
            minHeight: "400px",
            justifyContent: "center",
         }}
      >
         {/* Modern Header with Round Info */}
         <div
            style={{
               width: "100%",
               maxWidth: "600px",
               display: "flex",
               flexDirection: "column",
               alignItems: "center",
               gap: "0.75rem",
               marginBottom: "0.5rem",
            }}
         >
            <h3
               style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  margin: 0,
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
               }}
            >
               <ScaleIcon
                  style={{ width: 28, height: 28, color: "var(--accent)" }}
               />
               Balance the Scale
            </h3>

            {/* Round Progress Bar */}
            <div
               style={{
                  width: "100%",
                  maxWidth: "400px",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.75rem 1.25rem",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "16px",
                  backdropFilter: "blur(10px)",
               }}
            >
               <div
                  style={{
                     flex: 1,
                     display: "flex",
                     flexDirection: "column",
                     gap: "0.5rem",
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
                     }}
                  >
                     <span
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "6px",
                        }}
                     >
                        <ArrowPathIcon
                           style={{
                              width: 16,
                              height: 16,
                              color: "var(--accent)",
                           }}
                        />
                        Round {currentRound} / {maxRounds}
                     </span>
                     <span
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "6px",
                        }}
                     >
                        <TrophyIcon
                           style={{ width: 16, height: 16, color: "var(--ok)" }}
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
                           width: `${(currentRound / maxRounds) * 100}%`,
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
            </div>
         </div>

         <div
            style={{
               position: "relative",
               width: "100%",
               maxWidth: "500px",
               height: "250px",
               display: "flex",
               alignItems: "center",
               justifyContent: "center",
            }}
         >
            {/* Scale Base */}
            <div
               style={{
                  position: "absolute",
                  bottom: "0",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "80px",
                  height: "20px",
                  background:
                     "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
                  borderRadius: "4px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
               }}
            />

            {/* Scale Pole */}
            <div
               style={{
                  position: "absolute",
                  bottom: "20px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "6px",
                  height: "120px",
                  background:
                     "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)",
                  borderRadius: "3px",
                  zIndex: 1,
               }}
            />

            {/* Scale Beam */}
            <div
               style={{
                  position: "absolute",
                  top: "60px",
                  left: "50%",
                  transform: `translateX(-50%) rotate(${getScaleRotation()}deg)`,
                  transformOrigin: "center center",
                  width: "400px",
                  height: "8px",
                  background:
                     "linear-gradient(90deg, rgba(125,211,252,0.3) 0%, rgba(134,239,172,0.3) 50%, rgba(125,211,252,0.3) 100%)",
                  borderRadius: "4px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                  zIndex: 2,
               }}
            />

            {/* Left Weight */}
            <div
               style={{
                  position: "absolute",
                  top: "40px",
                  left: "50%",
                  transform: `translate(calc(-50% - 200px + ${getLeftPosition()}px), 0)`,
                  transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  zIndex: 3,
               }}
            >
               <div
                  style={{
                     width: "60px",
                     height: "60px",
                     background: `linear-gradient(135deg, rgba(125,211,252,0.4) 0%, rgba(125,211,252,0.2) 100%)`,
                     border: "2px solid var(--accent)",

                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     fontSize: "1.8rem",
                     fontWeight: 700,
                     color: "var(--accent)",
                     boxShadow: "0 6px 20px rgba(125,211,252,0.3)",
                     transition: "all 0.3s ease",
                  }}
               >
                  {leftWeight}
               </div>
               <div
                  style={{
                     width: "4px",
                     height: "30px",
                     background: "var(--accent)",
                     borderRadius: "2px",
                     boxShadow: "0 2px 8px rgba(125,211,252,0.4)",
                  }}
               />
            </div>

            {/* Right Weight */}
            <div
               style={{
                  position: "absolute",
                  top: "40px",
                  left: "50%",
                  transform: `translate(calc(-50% + 200px + ${getRightPosition()}px), 0)`,
                  transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  zIndex: 3,
               }}
            >
               <div
                  style={{
                     width: "60px",
                     height: "60px",
                     background: `linear-gradient(135deg, rgba(134,239,172,0.4) 0%, rgba(134,239,172,0.2) 100%)`,
                     border: "2px solid var(--ok)",

                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     fontSize: "1.8rem",
                     fontWeight: 700,
                     color: "var(--ok)",
                     boxShadow: "0 6px 20px rgba(134,239,172,0.3)",
                     transition: "all 0.3s ease",
                  }}
               >
                  {rightWeight}
               </div>
               <div
                  style={{
                     width: "4px",
                     height: "30px",
                     background: "var(--ok)",
                     borderRadius: "2px",
                     boxShadow: "0 2px 8px rgba(134,239,172,0.4)",
                  }}
               />
            </div>
         </div>

         <div
            style={{
               display: "flex",
               gap: "1rem",
               flexWrap: "wrap",
               justifyContent: "center",
               marginTop: "1rem",
               width: "100%",
               maxWidth: "600px",
            }}
         >
            <button
               onClick={() => handleSelect("left")}
               disabled={selected !== null}
               style={{
                  padding: "14px 28px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  borderRadius: "14px",
                  border: "2px solid",
                  cursor: selected === null ? "pointer" : "not-allowed",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  background:
                     selected === "left"
                        ? correct
                           ? "linear-gradient(135deg, rgba(134,239,172,0.25) 0%, rgba(134,239,172,0.15) 100%)"
                           : "linear-gradient(135deg, rgba(252,165,165,0.25) 0%, rgba(252,165,165,0.15) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
                  borderColor:
                     selected === "left"
                        ? correct
                           ? "var(--ok)"
                           : "var(--warn)"
                        : "var(--stroke)",
                  color:
                     selected === "left"
                        ? correct
                           ? "var(--ok)"
                           : "var(--warn)"
                        : "var(--text)",
                  opacity: selected !== null && selected !== "left" ? 0.4 : 1,
                  transform: selected === "left" ? "scale(1.05)" : "scale(1)",
                  boxShadow:
                     selected === "left"
                        ? correct
                           ? "0 6px 20px rgba(134,239,172,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                           : "0 6px 20px rgba(252,165,165,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                        : "0 2px 8px rgba(0,0,0,0.2)",
                  backdropFilter: "blur(10px)",
               }}
               onMouseEnter={(e) => {
                  if (selected === null) {
                     e.currentTarget.style.transform = "scale(1.02)";
                     e.currentTarget.style.borderColor = "var(--accent)";
                  }
               }}
               onMouseLeave={(e) => {
                  if (selected === null) {
                     e.currentTarget.style.transform = "scale(1)";
                     e.currentTarget.style.borderColor = "var(--stroke)";
                  }
               }}
            >
               <ArrowLeftIcon
                  style={{ width: 20, height: 20, marginRight: 8 }}
               />
               Left is Heavier
            </button>
            <button
               onClick={() => handleSelect("equal")}
               disabled={selected !== null}
               style={{
                  padding: "14px 28px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  borderRadius: "14px",
                  border: "2px solid",
                  cursor: selected === null ? "pointer" : "not-allowed",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  background:
                     selected === "equal"
                        ? correct
                           ? "linear-gradient(135deg, rgba(134,239,172,0.25) 0%, rgba(134,239,172,0.15) 100%)"
                           : "linear-gradient(135deg, rgba(252,165,165,0.25) 0%, rgba(252,165,165,0.15) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
                  borderColor:
                     selected === "equal"
                        ? correct
                           ? "var(--ok)"
                           : "var(--warn)"
                        : "var(--stroke)",
                  color:
                     selected === "equal"
                        ? correct
                           ? "var(--ok)"
                           : "var(--warn)"
                        : "var(--text)",
                  opacity: selected !== null && selected !== "equal" ? 0.4 : 1,
                  transform: selected === "equal" ? "scale(1.05)" : "scale(1)",
                  boxShadow:
                     selected === "equal"
                        ? correct
                           ? "0 6px 20px rgba(134,239,172,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                           : "0 6px 20px rgba(252,165,165,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                        : "0 2px 8px rgba(0,0,0,0.2)",
                  backdropFilter: "blur(10px)",
               }}
               onMouseEnter={(e) => {
                  if (selected === null) {
                     e.currentTarget.style.transform = "scale(1.02)";
                     e.currentTarget.style.borderColor = "var(--accent)";
                  }
               }}
               onMouseLeave={(e) => {
                  if (selected === null) {
                     e.currentTarget.style.transform = "scale(1)";
                     e.currentTarget.style.borderColor = "var(--stroke)";
                  }
               }}
            >
               <ScaleIcon style={{ width: 20, height: 20, marginRight: 8 }} />
               Equal
            </button>
            <button
               onClick={() => handleSelect("right")}
               disabled={selected !== null}
               style={{
                  padding: "14px 28px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  borderRadius: "14px",
                  border: "2px solid",
                  cursor: selected === null ? "pointer" : "not-allowed",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  background:
                     selected === "right"
                        ? correct
                           ? "linear-gradient(135deg, rgba(134,239,172,0.25) 0%, rgba(134,239,172,0.15) 100%)"
                           : "linear-gradient(135deg, rgba(252,165,165,0.25) 0%, rgba(252,165,165,0.15) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
                  borderColor:
                     selected === "right"
                        ? correct
                           ? "var(--ok)"
                           : "var(--warn)"
                        : "var(--stroke)",
                  color:
                     selected === "right"
                        ? correct
                           ? "var(--ok)"
                           : "var(--warn)"
                        : "var(--text)",
                  opacity: selected !== null && selected !== "right" ? 0.4 : 1,
                  transform: selected === "right" ? "scale(1.05)" : "scale(1)",
                  boxShadow:
                     selected === "right"
                        ? correct
                           ? "0 6px 20px rgba(134,239,172,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                           : "0 6px 20px rgba(252,165,165,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                        : "0 2px 8px rgba(0,0,0,0.2)",
                  backdropFilter: "blur(10px)",
               }}
               onMouseEnter={(e) => {
                  if (selected === null) {
                     e.currentTarget.style.transform = "scale(1.02)";
                     e.currentTarget.style.borderColor = "var(--accent)";
                  }
               }}
               onMouseLeave={(e) => {
                  if (selected === null) {
                     e.currentTarget.style.transform = "scale(1)";
                     e.currentTarget.style.borderColor = "var(--stroke)";
                  }
               }}
            >
               Right is Heavier
               <ArrowRightIcon
                  style={{ width: 20, height: 20, marginLeft: 8 }}
               />
            </button>
         </div>

         {correct !== null && (
            <div
               style={{
                  padding: "1rem 2rem",
                  borderRadius: "16px",
                  fontSize: "1.2rem",
                  fontWeight: 600,
                  background: correct
                     ? "linear-gradient(135deg, rgba(134,239,172,0.2) 0%, rgba(134,239,172,0.1) 100%)"
                     : "linear-gradient(135deg, rgba(252,165,165,0.2) 0%, rgba(252,165,165,0.1) 100%)",
                  border: `2px solid ${correct ? "#86efac" : "#fca5a5"}`,
                  color: correct ? "#86efac" : "#fca5a5",
                  boxShadow: correct
                     ? "0 6px 24px rgba(134,239,172,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                     : "0 6px 24px rgba(252,165,165,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
                  animation: "fadeIn 0.3s ease",
                  animationFillMode: "forwards",
                  backdropFilter: "blur(10px)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
               }}
            >
               {correct ? (
                  <>
                     <CheckCircleIcon style={{ width: 28, height: 28 }} />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon style={{ width: 28, height: 28 }} />
                     <span>Wrong! Try again.</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
}

export default BalanceScale;
