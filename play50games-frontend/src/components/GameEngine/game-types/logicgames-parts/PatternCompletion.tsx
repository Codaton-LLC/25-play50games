"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import theme from "./theme.module.css";
import css from "./PatternCompletion.module.css";
import {
   HomeIcon,
   StarIcon,
   HeartIcon,
   CircleStackIcon,
   CubeIcon,
   PlusIcon,
   SparklesIcon,
   XCircleIcon,
   CheckCircleIcon,
} from "@heroicons/react/24/outline";

function PatternCompletion({
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
   // Debug: Log config to see what we're receiving
   useEffect(() => {}, [config]);

   const rounds = config?.totalRounds || config?.rounds || maxRounds;
   const [pattern, setPattern] = useState<string[]>([]);
   const [options, setOptions] = useState<string[]>([]);
   const [correctIndex, setCorrectIndex] = useState(0);
   const [selected, setSelected] = useState<number | null>(null);
   const [correct, setCorrect] = useState<boolean | null>(null);
   const [round, setRound] = useState(1);
   const [score, setScore] = useState(0);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const completionCalledRef = useRef(false);
   const roundCompleteRef = useRef<number | null>(null);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);
   const onRoundCompleteRef = useRef(onRoundComplete);
   // round / retry / completion timers, cleared on unmount
   const timersRef = useRef<number[]>([]);
   const later = (fn: () => void, ms: number) => {
      timersRef.current.push(window.setTimeout(fn, ms));
   };
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

   // Heroicons mapping
   // icons fill their slot; the slot size comes from CSS (no fixed pixel sizes)
   const getShapeIcon = (shapeName: string) => {
      const iconProps = {
         "aria-hidden": true as const,
      };
      switch (shapeName) {
         case "Home":
            return <HomeIcon {...iconProps} />;
         case "Star":
            return <StarIcon {...iconProps} />;
         case "Heart":
            return <HeartIcon {...iconProps} />;
         case "Circle":
         case "circle":
            return <CircleStackIcon {...iconProps} />;
         case "Square":
         case "square":
            return <CubeIcon {...iconProps} />;
         case "Triangle":
         case "triangle":
            return (
               <PlusIcon
                  {...iconProps}
                  style={{ transform: "rotate(45deg)" }}
               />
            );
         default:
            return <SparklesIcon {...iconProps} />;
      }
   };

   // Get pattern rules based on round
   const getPatternRules = useCallback(
      (roundNum: number): { patternLength: number; repeatSize: number } => {
         // Check if patternRules is configured in game_config
         if (config?.patternRules && Array.isArray(config.patternRules)) {
            // Sort by rounds ascending to find the first match
            const sorted = [...config.patternRules].sort(
               (a, b) => a.rounds - b.rounds
            );

            // Find the matching pattern rules based on rounds
            for (let i = 0; i < sorted.length; i++) {
               const {
                  rounds: maxRounds,
                  patternLength,
                  repeatSize,
               } = sorted[i];
               if (roundNum <= maxRounds) {
                  return { patternLength, repeatSize };
               }
            }
            // Default to last configured rules if round exceeds all
            const lastRule = sorted[sorted.length - 1];

            return {
               patternLength: lastRule.patternLength,
               repeatSize: lastRule.repeatSize,
            };
         }
         // Default pattern rules based on rounds

         if (roundNum <= 5) {
            return { patternLength: 6, repeatSize: 3 }; // Rounds 1-5: 6 shapes, 3 repeat
         }
         if (roundNum <= 10) {
            return { patternLength: 9, repeatSize: 3 }; // Rounds 6-10: 9 shapes, 3 repeat
         }
         return { patternLength: 13, repeatSize: 4 }; // Rounds 11+: 13 shapes, 4 repeat
      },
      [config?.patternRules]
   );

   // Initialize new round
   const startNewRound = useCallback(() => {
      // Use Heroicons instead of CSS shapes
      const shapes = config?.shapes || ["Home", "Star", "Heart", "Circle"];
      const { patternLength, repeatSize } = getPatternRules(round);

      const repeatLength = repeatSize;

      // Generate repeating sequence
      // Select random shapes for the repeating sequence
      const availableShapes = [...shapes];
      const repeatingSequence: string[] = [];

      // Ensure we have enough unique shapes for the repeating sequence
      for (let i = 0; i < repeatLength; i++) {
         if (availableShapes.length > 0) {
            const randomIndex = Math.floor(
               Math.random() * availableShapes.length
            );
            repeatingSequence.push(availableShapes[randomIndex]);
            // Remove the selected shape to avoid duplicates if possible
            availableShapes.splice(randomIndex, 1);
         } else {
            // If we run out of unique shapes, reuse from the sequence
            repeatingSequence.push(
               repeatingSequence[i % repeatingSequence.length]
            );
         }
      }

      // "[PatternCompletion] Repeating sequence:", repeatingSequence);

      // Generate full pattern by repeating the sequence
      // First, generate the complete pattern with all shapes
      const fullPattern: string[] = [];
      for (let i = 0; i < patternLength; i++) {
         fullPattern.push(repeatingSequence[i % repeatLength]);
      }

      // Determine which position should be the missing one (random position)
      const missingPosition = Math.floor(Math.random() * patternLength);

      // Calculate what the missing shape should be based on the repeating pattern
      const missingShape = repeatingSequence[missingPosition % repeatLength];

      // Create pattern with "?" at the missing position
      const patternWithMissing: string[] = [...fullPattern];
      patternWithMissing[missingPosition] = "?";

      const allOptions = [...shapes].sort(() => Math.random() - 0.5);

      setPattern(patternWithMissing);
      setOptions(allOptions);
      setCorrectIndex(allOptions.indexOf(missingShape));
      setSelected(null);
      setCorrect(null);
      setFeedback(null);
      completionCalledRef.current = false; // Reset completion flag when round changes
   }, [config?.shapes, round, getPatternRules]);

   // Initialize first round
   useEffect(() => {
      startNewRound();
   }, [startNewRound]);

   // Calculate progress
   const progress = useMemo(() => {
      return rounds > 0
         ? Math.min(100, Math.max(0, (round / rounds) * 100))
         : 0;
   }, [round, rounds]);

   const handleSelect = (index: number) => {
      if (selected !== null) return; // Prevent multiple selections

      setSelected(index);
      const isCorrect = index === correctIndex;
      setCorrect(isCorrect);
      setFeedback(isCorrect ? "correct" : "wrong");

      if (isCorrect) {
         const roundScore = 5;
         const newScore = score + roundScore;
         setScore(newScore);
         onScoreUpdateRef.current(newScore);

         // Move to next round or complete
         if (round < rounds) {
            later(() => {
               setRound(round + 1);
               startNewRound();
            }, 1500);
         } else {
            // All rounds completed
            later(() => {
               if (onCompleteRef.current && !completionCalledRef.current) {
                  completionCalledRef.current = true;
                  onCompleteRef.current(newScore);
               }
            }, 1500);
         }
      } else {
         // Wrong answer - allow retry after feedback
         later(() => {
            setSelected(null);
            setCorrect(null);
            setFeedback(null);
         }, 1000);
      }
   };

   // Keyboard controls (1-4 for options)
   const handleKeyPress = useCallback(
      (e: KeyboardEvent) => {
         if (selected !== null) return; // Don't allow keyboard input if already selected

         const key = e.key;
         if (key >= "1" && key <= "4") {
            const index = parseInt(key) - 1;
            if (index < options.length) {
               handleSelect(index);
            }
         }
      },
      [options.length, selected]
   );

   useEffect(() => {
      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [handleKeyPress]);

   // a new pattern staggers in once per round (the board is keyed by round)
   // columns: one row up to 9 shapes on wide screens (13 reads 7 + 6); phones one row up to 6
   const len = Math.max(1, pattern.length);
   const cols = len <= 9 ? len : 7;
   const colsSm = len <= 6 ? len : len <= 9 ? 5 : 7;
   const optionCols = Math.max(1, Math.min(options.length, 4));
   const solved = correct === true;

   return (
      <div className={`${theme.game} ${css.root}`}>
         <div className={theme.header}>
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
               aria-valuemin={0}
               aria-valuemax={100}
               aria-valuenow={Math.round(progress)}
               aria-label="Rounds played"
            >
               <div
                  className={css.progressFill}
                  style={{ transform: `scaleX(${progress / 100})` }}
               />
            </div>
            <p className={theme.subtitle}>Pick the shape that fills the gap.</p>
         </div>

         <div className={`${theme.panel} ${css.panel}`}>
            <div
               key={round}
               className={`${css.pattern} ${theme.stagger}`}
               style={
                  {
                     "--cols": cols,
                     "--cols-sm": colsSm,
                  } as React.CSSProperties
               }
               role="list"
               aria-label="Pattern"
            >
               {pattern.map((shape, i) => {
                  const missing = shape === "?";
                  return (
                     <div
                        key={i}
                        role="listitem"
                        style={{ "--i": i } as React.CSSProperties}
                        className={`${css.slot} ${
                           missing ? css.missing : ""
                        } ${missing && solved ? css.filled : ""}`}
                        aria-label={missing ? "Missing shape" : shape}
                     >
                        {missing ? (
                           solved && selected !== null ? (
                              <span className={`${css.icon} ${theme.pop}`}>
                                 {getShapeIcon(options[selected])}
                              </span>
                           ) : (
                              <span className={css.question}>?</span>
                           )
                        ) : (
                           <span className={css.icon}>{getShapeIcon(shape)}</span>
                        )}
                     </div>
                  );
               })}
            </div>
         </div>

         <div className={theme.feedbackSlot} aria-live="polite">
            {feedback && (
               <div
                  className={`${theme.feedback} ${
                     feedback === "correct"
                        ? `${theme.feedbackOk} ${theme.pop}`
                        : `${theme.feedbackWarn} ${theme.shake}`
                  }`}
               >
                  {feedback === "correct" ? (
                     <>
                        <CheckCircleIcon className={css.feedbackIcon} aria-hidden />
                        <span>Correct, that completes the pattern.</span>
                     </>
                  ) : (
                     <>
                        <XCircleIcon className={css.feedbackIcon} aria-hidden />
                        <span>Not that one. Try again.</span>
                     </>
                  )}
               </div>
            )}
         </div>

         <div
            className={css.options}
            style={{ "--cols": optionCols } as React.CSSProperties}
         >
            {options.map((shape, i) => {
               const isPicked = selected === i;
               const state = isPicked
                  ? correct
                     ? `${css.optCorrect} ${theme.pop}`
                     : `${css.optWrong} ${theme.shake}`
                  : selected !== null
                  ? css.optIdle
                  : "";
               return (
                  <button
                     key={i}
                     type="button"
                     onClick={() => handleSelect(i)}
                     className={`${css.option} ${state}`}
                     disabled={selected !== null}
                     aria-label={`Option ${i + 1}: ${shape}`}
                  >
                     <span className={css.optIcon}>{getShapeIcon(shape)}</span>
                     <span className={css.optKey} aria-hidden>
                        {i + 1}
                     </span>
                  </button>
               );
            })}
         </div>
      </div>
   );
}

export default PatternCompletion;
