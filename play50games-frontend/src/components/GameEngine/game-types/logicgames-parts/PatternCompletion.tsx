"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
   HomeIcon,
   StarIcon,
   HeartIcon,
   CircleStackIcon,
   CubeIcon,
   PlusIcon,
   SparklesIcon,
   XCircleIcon,
   ArrowPathIcon,
   TrophyIcon,
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

   // Update refs when callbacks change
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
      onRoundCompleteRef.current = onRoundComplete;
   }, [onScoreUpdate, onComplete, onRoundComplete]);

   // Heroicons mapping
   const getShapeIcon = (shapeName: string, size: number = 80) => {
      const iconProps = {
         width: size,
         height: size,
         className: "pattern-icon",
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
            setTimeout(() => {
               setRound(round + 1);
               startNewRound();
            }, 1500);
         } else {
            // All rounds completed
            setTimeout(() => {
               if (onCompleteRef.current && !completionCalledRef.current) {
                  completionCalledRef.current = true;
                  onCompleteRef.current(newScore);
               }
            }, 1500);
         }
      } else {
         // Wrong answer - allow retry after feedback
         setTimeout(() => {
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

   return (
      <div className="pattern-completion-game">
         {/* Header */}
         <div className="game-header">
            <div className="header-stats">
               <div className="stat-item">
                  <ArrowPathIcon className="stat-icon" />
                  <span>
                     Round {round} / {rounds}
                  </span>
               </div>
               <div className="stat-item">
                  <TrophyIcon className="stat-icon" />
                  <span>
                     Score: {score} / {rounds * 5}
                  </span>
               </div>
            </div>
            <div className="progress-bar-container">
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

         {/* Pattern Display */}
         <div
            className={`pattern-display ${pattern.length > 6 ? "compact" : ""}`}
         >
            {pattern.map((shape, i) => {
               // Reduce icon size if pattern has more than 6 elements
               const iconSize = pattern.length > 6 ? 60 : 100;
               return (
                  <div
                     key={i}
                     className={`pattern-shape ${
                        shape === "?" ? "missing" : ""
                     } ${pattern.length > 6 ? "small" : ""}`}
                  >
                     {shape !== "?" ? (
                        getShapeIcon(shape, iconSize)
                     ) : (
                        <div className="missing-shape">
                           <SparklesIcon
                              width={iconSize}
                              height={iconSize}
                              className="pattern-icon"
                           />
                           <span className="question-mark">?</span>
                        </div>
                     )}
                  </div>
               );
            })}
         </div>

         {/* Options */}
         <div className="pattern-options">
            {options.map((shape, i) => (
               <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  className={`option-btn ${
                     selected === i ? (correct ? "correct" : "incorrect") : ""
                  }`}
                  disabled={selected !== null}
               >
                  {getShapeIcon(shape, 80)}
                  <span className="option-number">{i + 1}</span>
               </button>
            ))}
         </div>

         {/* Feedback */}
         {feedback && (
            <div className={`game-feedback ${feedback}`}>
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon className="feedback-icon" />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon className="feedback-icon" />
                     <span>Wrong! Try again.</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
}

export default PatternCompletion;
