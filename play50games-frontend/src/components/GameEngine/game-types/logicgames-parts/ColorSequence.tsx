"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties } from "react";
import theme from "./theme.module.css";
import css from "./ColorSequence.module.css";

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
   // timers live in refs so leaving the game mid-round never fires a callback on an unmounted game
   const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   useEffect(
      () => () => {
         if (showTimerRef.current) clearTimeout(showTimerRef.current);
         if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      },
      []
   );

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
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      showTimerRef.current = setTimeout(() => {
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

            if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
            nextTimerRef.current = setTimeout(() => {
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
            colorIndex = parseInt(key) - 1; // keys 1-4 pick colours 0-3
         }

         if (colorIndex >= 0 && colorIndex < colors.length) {
            e.preventDefault();
            handleColorClick(colors[colorIndex]);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [showingSequence, colors, handleColorClick]);

   // the pad colours are game content (unchanged hues); the chrome around them uses the theme tokens
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

   const padVars = (color: string, i?: number) => {
      const c = getColorStyle(color);
      return {
         "--pad-bg": c.bg,
         "--pad-ring": "rgba(var(--board-ov, 255, 255, 255), 0.28)",
         "--pad-glow": c.shadow,
         ...(i !== undefined ? { "--i": i } : {}),
      } as CSSProperties;
   };

   const lastPick = playerSequence[playerSequence.length - 1];
   const slotCount = Math.max(sequence.length, playerSequence.length);
   const progress = maxRounds > 0 ? Math.min(1, currentRound / maxRounds) : 0;

   return (
      <div className={`${theme.game} ${css.root}`}>
         <div className={theme.header}>
            <h3 className={theme.title}>Color Sequence</h3>
            <div className={theme.chips}>
               <span className={theme.chip}>
                  Round <strong>{currentRound}</strong> / {maxRounds}
               </span>
               <span className={theme.chip}>
                  Score <strong>{currentScore}</strong> / {maxRounds * 5}
               </span>
            </div>
            <div className={css.progress} aria-hidden="true">
               <div
                  className={css.progressFill}
                  style={{ transform: `scaleX(${progress})` }}
               />
            </div>
         </div>

         {showingSequence ? (
            <div
               key="watch"
               className={`${theme.panel} ${css.stage} ${theme.fadeUp}`}
            >
               <p className={css.hint}>Watch the sequence</p>
               <p className={css.hintSub}>
                  Round {currentRound + 1}: {sequence.length}{" "}
                  {sequence.length === 1 ? "colour" : "colours"} to remember
               </p>
               <div
                  className={css.playback}
                  style={{ "--n": Math.max(1, sequence.length) } as CSSProperties}
                  aria-label={`Sequence of ${sequence.length} colours`}
               >
                  {sequence.map((color, index) => (
                     <div
                        key={index}
                        className={css.tile}
                        style={padVars(color, index)}
                     >
                        <span className={css.tileNum}>{index + 1}</span>
                     </div>
                  ))}
               </div>
            </div>
         ) : (
            <div
               key="repeat"
               className={`${theme.panel} ${css.stage} ${theme.fadeUp}`}
            >
               <p className={css.hint}>Repeat the sequence</p>
               <p className={css.hintSub}>
                  Tap the colours in the same order. Keys 1 to 4 work too.
               </p>
               <div className={css.pads}>
                  {colors.map((color: string, index: number) => (
                     <button
                        key={color}
                        type="button"
                        onClick={() => handleColorClick(color)}
                        disabled={showingSequence}
                        className={css.pad}
                        style={padVars(color, index)}
                        aria-label={`${color}, key ${index + 1}`}
                     >
                        {lastPick === color && playerSequence.length > 0 && (
                           <span
                              key={playerSequence.length}
                              className={css.flash}
                              aria-hidden="true"
                           />
                        )}
                        <span className={css.padLabel}>
                           <span className={css.padKey}>{index + 1}</span>
                           {color}
                        </span>
                     </button>
                  ))}
               </div>
               <div
                  key={`picks-${feedback ?? "none"}`}
                  className={`${css.picks} ${
                     feedback === "correct"
                        ? theme.pop
                        : feedback === "wrong"
                        ? theme.shake
                        : ""
                  }`}
                  aria-label={`${playerSequence.length} of ${sequence.length} picked`}
               >
                  {Array.from({ length: slotCount }).map((_, index) => {
                     const picked = playerSequence[index];
                     return picked ? (
                        <span
                           key={`p-${index}`}
                           className={`${css.pick} ${theme.reveal}`}
                           style={padVars(picked)}
                        />
                     ) : (
                        <span key={`s-${index}`} className={css.slot} />
                     );
                  })}
               </div>
            </div>
         )}

         <div className={theme.feedbackSlot} aria-live="polite">
            {feedback !== null && (
               <div
                  key={`${feedback}-${currentRound}`}
                  className={`${theme.feedback} ${
                     feedback === "correct"
                        ? `${theme.feedbackOk} ${theme.pop}`
                        : `${theme.feedbackWarn} ${theme.shake}`
                  }`}
               >
                  {feedback === "correct"
                     ? "Correct. +5 points"
                     : "Not quite. Watch the next one."}
               </div>
            )}
         </div>
      </div>
   );
}

export default ColorSequence;
