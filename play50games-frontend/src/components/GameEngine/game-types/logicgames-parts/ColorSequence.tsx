"use client";

import { useState, useEffect, useCallback } from "react";
import {
   SparklesIcon,
   ArrowPathIcon,
   TrophyIcon,
   ClockIcon,
   CheckCircleIcon,
   XCircleIcon,
} from "@heroicons/react/24/outline";

function ColorSequence({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const colors = config.colors || ["red", "blue", "green", "yellow"];
   const maxRounds = config.rounds || 20;
   const [sequence, setSequence] = useState<string[]>([]);
   const [playerSequence, setPlayerSequence] = useState<string[]>([]);
   const [showingSequence, setShowingSequence] = useState(true);
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

   useEffect(() => {
      // Start first round
      startNewRound();
   }, []);

   const startNewRound = () => {
      // Sequence length increases gradually: round 1-5 = 2 colors, 6-10 = 3, 11-15 = 4, 16-20 = 5
      const roundNumber = currentRound + 1;
      let sequenceLength = 2;
      if (roundNumber > 15) sequenceLength = 5;
      else if (roundNumber > 10) sequenceLength = 4;
      else if (roundNumber > 5) sequenceLength = 3;

      const newSequence = [];
      for (let i = 0; i < sequenceLength; i++) {
         newSequence.push(colors[Math.floor(Math.random() * colors.length)]);
      }
      setSequence(newSequence);
      setPlayerSequence([]);
      setShowingSequence(true);
      setFeedback(null);

      // Show sequence - each color flashes for 800ms
      setTimeout(() => {
         setShowingSequence(false);
      }, sequenceLength * 800 + 500); // 800ms per color + 500ms buffer
   };

   const handleColorClick = useCallback(
      (color: string) => {
         if (showingSequence) return;

         const newPlayerSequence = [...playerSequence, color];
         setPlayerSequence(newPlayerSequence);

         // Check if sequence is complete
         if (newPlayerSequence.length === sequence.length) {
            const isCorrect = newPlayerSequence.every(
               (c, i) => c === sequence[i]
            );
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
                  // Continue to next round
                  startNewRound();
               }
            }, 1500);
         }
      },
      [
         showingSequence,
         playerSequence,
         sequence,
         currentRound,
         currentScore,
         maxRounds,
         onScoreUpdate,
         onComplete,
      ]
   );

   // Keyboard controls for Color Sequence
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         if (showingSequence) return;

         const key = e.key;
         let colorIndex = -1;

         if (key >= "1" && key <= "4") {
            colorIndex = parseInt(key) - 1; // 1-4 → 0-3
         }

         if (colorIndex >= 0 && colorIndex < colors.length) {
            e.preventDefault();
            handleColorClick(colors[colorIndex]);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [showingSequence, colors, handleColorClick]);

   const getColorStyle = (color: string) => {
      const colorMap: Record<
         string,
         { bg: string; border: string; shadow: string }
      > = {
         red: {
            bg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            border: "#ef4444",
            shadow: "rgba(239, 68, 68, 0.4)",
         },
         blue: {
            bg: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            border: "#3b82f6",
            shadow: "rgba(59, 130, 246, 0.4)",
         },
         green: {
            bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            border: "#10b981",
            shadow: "rgba(16, 185, 129, 0.4)",
         },
         yellow: {
            bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            border: "#f59e0b",
            shadow: "rgba(245, 158, 11, 0.4)",
         },
      };
      return colorMap[color] || colorMap.red;
   };

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
               Color Sequence
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
                  Round {currentRound} / {maxRounds}
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

         {/* Sequence Display or Color Options */}
         {showingSequence ? (
            <div
               style={{
                  background: "var(--card)",
                  borderRadius: "20px",
                  padding: "40px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                  minHeight: "200px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "24px",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "12px",
                     fontSize: "1.1rem",
                     fontWeight: 600,
                     color: "var(--muted)",
                  }}
               >
                  <ClockIcon style={{ width: 20, height: 20 }} />
                  Watch the sequence carefully...
               </div>
               <div
                  style={{
                     fontSize: "0.875rem",
                     color: "var(--accent)",
                     fontWeight: 600,
                     marginTop: "8px",
                  }}
               >
                  Round {currentRound + 1} - {sequence.length}{" "}
                  {sequence.length === 1 ? "color" : "colors"} to remember
               </div>
               <div
                  style={{
                     display: "flex",
                     gap: "16px",
                     flexWrap: "wrap",
                     justifyContent: "center",
                  }}
               >
                  {sequence.map((color, index) => {
                     const colorStyle = getColorStyle(color);
                     return (
                        <div
                           key={index}
                           style={{
                              width: "80px",
                              height: "80px",
                              borderRadius: "16px",
                              background: colorStyle.bg,
                              border: `3px solid ${colorStyle.border}`,
                              boxShadow: `0 8px 20px ${colorStyle.shadow}`,
                              animation: `pulse 0.6s ease-in-out ${
                                 index * 0.6
                              }s`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "white",
                              textTransform: "uppercase",
                              letterSpacing: "1px",
                           }}
                        >
                           {index + 1}
                        </div>
                     );
                  })}
               </div>
            </div>
         ) : (
            <div
               style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "24px",
                  width: "100%",
               }}
            >
               <div
                  style={{
                     background: "var(--card)",
                     borderRadius: "20px",
                     padding: "24px",
                     boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        fontSize: "1rem",
                        fontWeight: 600,
                        color: "var(--muted)",
                        marginBottom: "20px",
                        textAlign: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                     }}
                  >
                     <SparklesIcon style={{ width: 18, height: 18 }} />
                     Repeat the sequence
                  </div>
                  <div
                     style={{
                        fontSize: "0.875rem",
                        color: "var(--accent)",
                        fontWeight: 500,
                     }}
                  >
                     Click colors in the same order
                  </div>
                  <div
                     style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "20px",
                        maxWidth: "400px",
                        margin: "0 auto",
                     }}
                  >
                     {colors.map((color: string, index: number) => {
                        const colorStyle = getColorStyle(color);
                        const isSelected =
                           playerSequence.length > 0 &&
                           playerSequence[playerSequence.length - 1] === color;
                        return (
                           <button
                              key={color}
                              onClick={() => handleColorClick(color)}
                              disabled={showingSequence}
                              style={{
                                 width: "100%",
                                 aspectRatio: "1",
                                 borderRadius: "16px",
                                 background: colorStyle.bg,
                                 border: `3px solid ${colorStyle.border}`,
                                 boxShadow: isSelected
                                    ? `0 12px 30px ${colorStyle.shadow}`
                                    : `0 4px 12px ${colorStyle.shadow}`,
                                 cursor: showingSequence
                                    ? "not-allowed"
                                    : "pointer",
                                 transition: "all 0.3s ease",
                                 transform: isSelected
                                    ? "scale(0.95)"
                                    : "scale(1)",
                                 display: "flex",
                                 flexDirection: "column",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 gap: "8px",
                                 position: "relative",
                              }}
                              onMouseEnter={(e) => {
                                 if (!showingSequence) {
                                    e.currentTarget.style.transform =
                                       "scale(1.05)";
                                    e.currentTarget.style.boxShadow = `0 12px 30px ${colorStyle.shadow}`;
                                 }
                              }}
                              onMouseLeave={(e) => {
                                 if (!showingSequence) {
                                    e.currentTarget.style.transform =
                                       "scale(1)";
                                    e.currentTarget.style.boxShadow = `0 4px 12px ${colorStyle.shadow}`;
                                 }
                              }}
                           >
                              <span
                                 style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 500,
                                    color: "white",
                                    background: "rgba(0, 0, 0, 0.2)",
                                    border:
                                       "1px solid rgba(255, 255, 255, 0.3)",
                                    borderRadius: "4px",
                                    padding: "2px 8px",
                                    fontFamily: "monospace",
                                 }}
                              >
                                 {index + 1}
                              </span>
                              <span
                                 style={{
                                    fontSize: "0.875rem",
                                    fontWeight: 700,
                                    color: "white",
                                    textTransform: "uppercase",
                                    letterSpacing: "1px",
                                 }}
                              >
                                 {color}
                              </span>
                           </button>
                        );
                     })}
                  </div>
                  {playerSequence.length > 0 && (
                     <div
                        style={{
                           marginTop: "20px",
                           display: "flex",
                           gap: "8px",
                           justifyContent: "center",
                           flexWrap: "wrap",
                        }}
                     >
                        {playerSequence.map((color, index) => {
                           const colorStyle = getColorStyle(color);
                           return (
                              <div
                                 key={index}
                                 style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "8px",
                                    background: colorStyle.bg,
                                    border: `2px solid ${colorStyle.border}`,
                                    boxShadow: `0 4px 12px ${colorStyle.shadow}`,
                                 }}
                              />
                           );
                        })}
                     </div>
                  )}
               </div>
            </div>
         )}

         {/* Feedback Message */}
         {feedback !== null && (
            <div
               style={{
                  padding: "16px 24px",

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
                     <span>Try again! You can do it!</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
}

export default ColorSequence;
