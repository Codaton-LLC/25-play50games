"use client";

import React, {
   useState,
   useEffect,
   useCallback,
   useRef,
   useMemo,
} from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   ArrowPathIcon,
   ArrowPathRoundedSquareIcon,
   TrophyIcon,
   ClockIcon,
   ShareIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

interface ReactionTestProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function ReactionTest({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: ReactionTestProps) {
   const maxLevels = config.levels || 10;
   const levelRequirements = config.levelRequirements || [];

   // Debug: Log config to verify it's being received correctly
   useEffect(() => {
      // Config loaded
   }, [isPlaying, config, levelRequirements, maxLevels]);

   // Game state
   const [currentLevel, setCurrentLevel] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<"ready" | "playing" | "failed">(
      "ready"
   );
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Reaction test specific state
   const [waiting, setWaiting] = useState(true);
   const [greenShown, setGreenShown] = useState(false);
   const [reactionTime, setReactionTime] = useState(0);
   const [penalties, setPenalties] = useState(0);
   const [attempts, setAttempts] = useState<number[]>([]);
   const [attemptCount, setAttemptCount] = useState(0);
   const [showFeedback, setShowFeedback] = useState(false);

   // Mini-game specific states
   const [currentColor, setCurrentColor] = useState<
      "red" | "blue" | "orange" | "green" | null
   >(null);
   const [greenCircleIndex, setGreenCircleIndex] = useState<number | null>(
      null
   );
   const [targetPosition, setTargetPosition] = useState({ x: 50, y: 50 });
   const [countdown, setCountdown] = useState<number | "GO" | null>(null);
   const [targetShape, setTargetShape] = useState<
      "circle" | "square" | "triangle" | null
   >(null);
   const [shapeOptions, setShapeOptions] = useState<
      Array<{
         id: number;
         shape: "circle" | "square" | "triangle";
         isCorrect: boolean;
      }>
   >([]);
   const [movingObjects, setMovingObjects] = useState<
      Array<{
         id: number;
         x: number;
         y: number;
         color: "green" | "red";
         vx: number;
         vy: number;
      }>
   >([]);
   const [patternSequence, setPatternSequence] = useState<string[]>([]);
   const [patternIndex, setPatternIndex] = useState(0);
   const [multiTargets, setMultiTargets] = useState<
      Array<{ id: number; x: number; y: number; color: "green" | "red" }>
   >([]);
   const [progressBar, setProgressBar] = useState(0);
   const [memorySequence, setMemorySequence] = useState<number[]>([]);
   const [memoryIndex, setMemoryIndex] = useState(0);
   const [memorySequenceVisible, setMemorySequenceVisible] = useState(true);
   const [clickedSequence, setClickedSequence] = useState<number[]>([]);
   const [shuffledNumbers, setShuffledNumbers] = useState<number[]>([]);
   const [distractionActive, setDistractionActive] = useState(false);
   const [safeZoneActive, setSafeZoneActive] = useState(false);
   const [greenWindowRemaining, setGreenWindowRemaining] = useState(0);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max replays: 5 for Reaction Test, unlimited if shared
   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited

   // Refs
   const currentLevelRef = useRef(0);
   const gameStateRef = useRef<"ready" | "playing" | "failed">("ready");
   const requirementsMetRef = useRef(false);
   const completionCalledRef = useRef(false);
   const waitTimerRef = useRef<NodeJS.Timeout | null>(null);
   const greenTimerRef = useRef<NodeJS.Timeout | null>(null);
   const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
   const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
   const startTimeRef = useRef(0);
   const greenStartTimeRef = useRef(0);
   const animationFrameRef = useRef<number | null>(null);
   const objectIdCounterRef = useRef(0);

   // Mobile/Tablet detection
   useEffect(() => {
      const checkSize = () => {
         setIsMobile(window.innerWidth < 768);
         setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
      };
      checkSize();
      window.addEventListener("resize", checkSize);
      return () => window.removeEventListener("resize", checkSize);
   }, []);

   // Start level ref
   const startLevelRef = useRef<((levelIndex?: number) => void) | null>(null);

   // Get variant type for current level (0-9 maps to variants 1-10)
   const getVariant = useCallback(() => {
      return currentLevel; // Level 0 = Variant 1, Level 9 = Variant 10
   }, [currentLevel]);

   // Calculate wait time based on variant
   const getWaitTime = useCallback(() => {
      const variant = getVariant();
      if (variant === 1) {
         // Random Delay: 0.8-4s
         return Math.random() * 3200 + 800;
      } else if (variant === 5) {
         // Fatigue: delay zvogëlohet me çdo provë
         const baseDelay = 2000 - attemptCount * 150;
         return Math.max(800, baseDelay);
      } else {
         // Classic: 1-3s
         return Math.random() * 2000 + 1000;
      }
   }, [getVariant, attemptCount]);

   // Calculate green window duration based on variant
   const getGreenWindow = useCallback(() => {
      const variant = getVariant();
      if (variant === 2) {
         // Short Window: 600-800ms
         return Math.random() * 200 + 600;
      } else {
         // Default: unlimited
         return null;
      }
   }, [getVariant]);

   // Get maxTime for current level and format it
   const getMaxTimeDisplay = useCallback(() => {
      const levelReq = levelRequirements[currentLevel] || {};
      if (levelReq.maxTime === undefined) return null;

      let maxTimeMs: number | null = null;
      if (typeof levelReq.maxTime === "number") {
         maxTimeMs = levelReq.maxTime;
      } else if (typeof levelReq.maxTime === "string") {
         const timeStr = levelReq.maxTime.toLowerCase().trim();
         if (timeStr.endsWith("ms")) {
            maxTimeMs = parseFloat(timeStr.replace("ms", ""));
         } else if (timeStr.endsWith("s") || timeStr.endsWith("sec")) {
            maxTimeMs = parseFloat(timeStr.replace(/s(ec)?$/, "")) * 1000;
         } else {
            maxTimeMs = parseFloat(timeStr);
         }
      }

      if (maxTimeMs === null) return null;

      // Format: show as ms if < 1000ms, otherwise as seconds
      if (maxTimeMs < 1000) {
         return `${Math.round(maxTimeMs)}ms`;
      } else {
         return `${(maxTimeMs / 1000).toFixed(1)}s`;
      }
   }, [levelRequirements, currentLevel]);

   // Initialize mini-game based on variant
   const initializeMiniGame = useCallback((variant: number) => {
      // Clear all previous state
      setWaiting(true);
      setGreenShown(false);
      setReactionTime(0);
      setPenalties(0);
      setShowFeedback(false);
      setCurrentColor(null);
      setGreenCircleIndex(null);
      setTargetPosition({ x: 50, y: 50 });
      setCountdown(null);
      setTargetShape(null);
      setShapeOptions([]);
      setMovingObjects([]);
      setPatternSequence([]);
      setPatternIndex(0);
      setMultiTargets([]);
      setProgressBar(0);
      setMemorySequence([]);
      setMemoryIndex(0);
      setMemorySequenceVisible(true);
      setClickedSequence([]);
      setShuffledNumbers([]);
      objectIdCounterRef.current = 0;

      if (animationFrameRef.current) {
         cancelAnimationFrame(animationFrameRef.current);
         animationFrameRef.current = null;
      }

      // Initialize based on variant
      switch (variant) {
         case 0: // Color Flash Reaction
            // Randomly select which circle (0-3) will turn green
            const selectedCircle = Math.floor(Math.random() * 4);
            setGreenCircleIndex(selectedCircle);

            // Wait random time (1-3 seconds), then turn selected circle green
            const waitTime = Math.random() * 2000 + 1000;
            waitTimerRef.current = setTimeout(() => {
               if (gameStateRef.current === "playing") {
                  setCurrentColor("green");
                  greenStartTimeRef.current = Date.now();
                  setGreenShown(true);

                  // Green circle stays visible for at least 1 second
                  // After 1 second, if player hasn't clicked, circle remains visible
                  // Player has minimum 1 second to click
                  greenTimerRef.current = setTimeout(() => {
                     // Minimum 1 second has passed - circle can still be clicked
                     // No action needed, just ensures minimum visibility time
                  }, 1000);
               }
            }, waitTime);
            break;

         case 1: // Moving Target Reaction
            setTargetPosition({ x: 20, y: 50 });
            const moveInterval = setInterval(() => {
               if (gameStateRef.current !== "playing") {
                  clearInterval(moveInterval);
                  return;
               }
               setTargetPosition((prev) => {
                  const newX = prev.x + 2;
                  if (newX > 80) {
                     clearInterval(moveInterval);
                     const waitTime = Math.random() * 2000 + 1000;
                     setTimeout(() => {
                        setTargetPosition({ x: 20, y: 50 });
                        setGreenShown(true);
                        greenStartTimeRef.current = Date.now();
                     }, waitTime);
                     return { x: 20, y: 50 };
                  }
                  if (newX > 40 && !greenShown) {
                     setGreenShown(true);
                     greenStartTimeRef.current = Date.now();
                  }
                  return { x: newX, y: prev.y };
               });
            }, 50);
            break;

         case 2: // Countdown Reaction
            setCountdown(3);
            let count = 3;
            const countInterval = setInterval(() => {
               if (gameStateRef.current !== "playing") {
                  clearInterval(countInterval);
                  return;
               }
               count--;
               if (count > 0) {
                  setCountdown(count);
               } else if (count === 0) {
                  setCountdown("GO");
                  setGreenShown(true);
                  greenStartTimeRef.current = Date.now();
                  setTimeout(() => {
                     setCountdown(null);
                  }, 2000);
                  clearInterval(countInterval);
               }
            }, 1000);
            break;

         case 3: // Shape Match Reaction
            const shapes: ("circle" | "square" | "triangle")[] = [
               "circle",
               "square",
               "triangle",
            ];
            const target = shapes[Math.floor(Math.random() * shapes.length)];
            setTargetShape(target);

            // Create 6 shape options (one correct, 5 wrong)
            const shapeOptionsArray: Array<{
               id: number;
               shape: "circle" | "square" | "triangle";
               isCorrect: boolean;
            }> = [];
            // Add correct shape
            shapeOptionsArray.push({
               id: objectIdCounterRef.current++,
               shape: target,
               isCorrect: true,
            });
            // Add wrong shapes
            const wrongShapes = shapes.filter((s) => s !== target);
            for (let i = 0; i < 5; i++) {
               const wrongShape =
                  wrongShapes[Math.floor(Math.random() * wrongShapes.length)];
               shapeOptionsArray.push({
                  id: objectIdCounterRef.current++,
                  shape: wrongShape,
                  isCorrect: false,
               });
            }
            // Shuffle options
            const shuffledShapes = shapeOptionsArray.sort(
               () => Math.random() - 0.5
            );
            setShapeOptions(shuffledShapes);

            const shapeWait = Math.random() * 2000 + 1000;
            waitTimerRef.current = setTimeout(() => {
               setGreenShown(true);
               greenStartTimeRef.current = Date.now();
            }, shapeWait);
            break;

         case 4: // Speed Reaction
            const spawnSpeedObjects = () => {
               if (gameStateRef.current !== "playing") return;
               const id = objectIdCounterRef.current++;
               const isGreen = Math.random() < 0.3;
               const obj = {
                  id,
                  x: Math.random() * 80 + 10,
                  y: Math.random() * 80 + 10,
                  color: isGreen ? ("green" as const) : ("red" as const),
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 4,
               };
               setMovingObjects((prev) => [...prev, obj]);
               if (isGreen) {
                  greenStartTimeRef.current = Date.now();
                  setGreenShown(true);
               }
               setTimeout(() => {
                  setMovingObjects((prev) => prev.filter((o) => o.id !== id));
               }, 2000);
            };
            const speedWait = Math.random() * 2000 + 1000;
            waitTimerRef.current = setTimeout(() => {
               spawnSpeedObjects();
               const speedInterval = setInterval(() => {
                  if (gameStateRef.current !== "playing") {
                     clearInterval(speedInterval);
                     return;
                  }
                  spawnSpeedObjects();
               }, 800);
               gameTimerRef.current = setTimeout(
                  () => clearInterval(speedInterval),
                  10000
               );
            }, speedWait);
            break;

         case 5: // Pattern Reaction
            const pattern = ["red", "blue", "green"];
            setPatternSequence(pattern);
            setPatternIndex(0); // Start at 0 to show first circle (red)
            let patternIdx = 0;
            // Show first circle immediately
            const patternInterval = setInterval(() => {
               if (gameStateRef.current !== "playing") {
                  clearInterval(patternInterval);
                  return;
               }
               patternIdx++;
               setPatternIndex(patternIdx);
               // When we reach the last index (green), enable clicking
               if (patternIdx === pattern.length - 1) {
                  setGreenShown(true);
                  greenStartTimeRef.current = Date.now();
                  clearInterval(patternInterval);
               }
            }, 800);
            break;

         case 6: // Multi-Target Reaction
            const spawnMultiTargets = () => {
               const targets = [];
               // Ensure at least 1-2 green targets out of 5
               const greenCount = Math.floor(Math.random() * 2) + 1; // 1 or 2 green targets
               let greenAdded = 0;

               for (let i = 0; i < 5; i++) {
                  // Add green targets first, then fill with red
                  const isGreen = greenAdded < greenCount;
                  targets.push({
                     id: objectIdCounterRef.current++,
                     x: Math.random() * 70 + 15,
                     y: Math.random() * 70 + 15,
                     color: isGreen ? ("green" as const) : ("red" as const),
                  });
                  if (isGreen) greenAdded++;
               }

               // Shuffle targets to randomize positions
               const shuffled = targets.sort(() => Math.random() - 0.5);
               setMultiTargets(shuffled);

               // Always set greenShown since we guarantee at least 1 green target
               greenStartTimeRef.current = Date.now();
               setGreenShown(true);
            };
            const multiWait = Math.random() * 2000 + 1000;
            waitTimerRef.current = setTimeout(spawnMultiTargets, multiWait);
            break;

         case 7: // Timing Reaction
            setProgressBar(0);
            const progressInterval = setInterval(() => {
               if (gameStateRef.current !== "playing") {
                  clearInterval(progressInterval);
                  return;
               }
               setProgressBar((prev) => {
                  const newProgress = prev + 2;
                  if (newProgress >= 100) {
                     setGreenShown(true);
                     greenStartTimeRef.current = Date.now();
                     clearInterval(progressInterval);
                     return 100;
                  }
                  return newProgress;
               });
            }, 50);
            break;

         case 8: // Memory Reaction
            // Generate random sequence of 3-4 numbers
            const seqLength = Math.floor(Math.random() * 2) + 3; // 3 or 4 numbers
            const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
            const shuffled = [...numbers].sort(() => Math.random() - 0.5);
            const sequence = shuffled.slice(0, seqLength);
            setMemorySequence(sequence);
            setMemoryIndex(0);
            setMemorySequenceVisible(true);
            setClickedSequence([]);
            // Create shuffled version of sequence for display (random order)
            const shuffledForDisplay = [...sequence].sort(
               () => Math.random() - 0.5
            );
            setShuffledNumbers(shuffledForDisplay);

            // Show sequence for 3-4 seconds, then hide it
            const showTime = Math.random() * 1000 + 3000; // 3-4 seconds
            waitTimerRef.current = setTimeout(() => {
               setMemorySequenceVisible(false);
               // Wait a bit more, then show green
               const memWait = Math.random() * 1000 + 1000; // 1-2 seconds
               waitTimerRef.current = setTimeout(() => {
                  setGreenShown(true);
                  greenStartTimeRef.current = Date.now();
               }, memWait);
            }, showTime);
            break;

         case 9: // Master Reaction (combination)
            // Combination of random delay + short window
            const masterWait = Math.random() * 2000 + 1000;
            waitTimerRef.current = setTimeout(() => {
               setGreenShown(true);
               greenStartTimeRef.current = Date.now();
               const shortWindow = 800;
               greenTimerRef.current = setTimeout(() => {
                  if (
                     gameStateRef.current === "playing" &&
                     !requirementsMetRef.current
                  ) {
                     setGameState("failed");
                     gameStateRef.current = "failed";
                  }
               }, shortWindow);
            }, masterWait);
            break;
      }
   }, []);

   // Start level
   const startLevel = useCallback(
      (levelIndex?: number) => {
         const targetLevel = levelIndex ?? currentLevelRef.current;
         currentLevelRef.current = targetLevel;

         // Clear all timers
         if (waitTimerRef.current) {
            clearTimeout(waitTimerRef.current);
            waitTimerRef.current = null;
         }
         if (greenTimerRef.current) {
            clearTimeout(greenTimerRef.current);
            greenTimerRef.current = null;
         }
         if (feedbackTimerRef.current) {
            clearTimeout(feedbackTimerRef.current);
            feedbackTimerRef.current = null;
         }
         if (gameTimerRef.current) {
            clearTimeout(gameTimerRef.current);
            gameTimerRef.current = null;
         }

         // Reset state
         setGameState("playing");
         gameStateRef.current = "playing";
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         setReactionTime(0);
         setPenalties(0);
         setShowFeedback(false);
         startTimeRef.current = 0;
         greenStartTimeRef.current = 0;

         // Initialize the specific mini-game
         initializeMiniGame(targetLevel);
      },
      [initializeMiniGame]
   );

   // Store startLevel in ref
   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Initialize game
   useEffect(() => {
      if (!isPlaying) return;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      completionCalledRef.current = false;
      currentLevelRef.current = 0;
      setCurrentLevel(0);
      setCurrentScore(0);
      setRequirementsMet(false);
      setGameState("playing");
      if (startLevelRef.current) {
         startLevelRef.current(0);
      }
   }, [isPlaying]);

   // Handle click - different logic for each mini-game
   const handleClick = useCallback(
      (e?: React.MouseEvent, targetId?: number) => {
         if (gameStateRef.current !== "playing") return;

         const variant = getVariant();
         const now = Date.now();

         // Variant-specific click handling
         switch (variant) {
            case 0: // Color Flash - click when green appears
               if (!greenShown || currentColor !== "green") {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               // Green circle stays visible for at least 1 second
               // Player can click anytime after green appears
               break;

            case 1: // Moving Target - click the green target
               if (!greenShown) {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 2: // Countdown - click when GO appears
               if (!greenShown || countdown !== "GO") {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 3: // Shape Match - click the shape that matches target
               if (!greenShown) {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               // Check if clicked shape matches target
               if (targetId !== undefined) {
                  const clickedShape = shapeOptions.find(
                     (s) => s.id === targetId
                  );
                  if (!clickedShape || !clickedShape.isCorrect) {
                     setPenalties((prev) => prev + 1);
                     return;
                  }
               } else {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 4: // Speed Reaction - click green moving object
               if (targetId !== undefined) {
                  const obj = movingObjects.find((o) => o.id === targetId);
                  if (!obj || obj.color !== "green") {
                     setPenalties((prev) => prev + 1);
                     return;
                  }
               } else {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 5: // Pattern Reaction - click when green in pattern
               // Only allow click when green is shown AND patternIndex is at the last index (green)
               if (!greenShown || patternIndex !== patternSequence.length - 1) {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 6: // Multi-Target - click only green targets
               if (targetId !== undefined) {
                  const target = multiTargets.find((t) => t.id === targetId);
                  if (!target || target.color !== "green") {
                     setPenalties((prev) => prev + 1);
                     return;
                  }
               } else {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 7: // Timing Reaction - click when progress bar reaches green zone
               if (!greenShown || progressBar < 90) {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 8: // Memory Reaction - click numbers in correct sequence
               if (!greenShown) {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               // Check if clicked number is correct
               if (targetId !== undefined) {
                  const expectedNumber = memorySequence[clickedSequence.length];
                  if (targetId !== expectedNumber) {
                     // Wrong number clicked
                     setPenalties((prev) => prev + 1);
                     setClickedSequence([]); // Reset sequence
                     return;
                  }
                  // Correct number clicked
                  const newClicked = [...clickedSequence, targetId];
                  setClickedSequence(newClicked);

                  // Check if sequence is complete
                  if (newClicked.length === memorySequence.length) {
                     // All numbers clicked in correct order - proceed to calculate score
                     // Don't return, let it continue to calculate reaction time
                  } else {
                     // Sequence not complete yet, wait for next click
                     return;
                  }
               } else {
                  // Clicked outside numbers
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 9: // Master Reaction - standard click
               if (!greenShown) {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;
         }

         // Calculate reaction time
         const reaction = now - greenStartTimeRef.current;
         setReactionTime(reaction);

         // Check level requirements - only maxTime is required
         const levelReq = levelRequirements[currentLevel] || {};

         // Check if maxTime is specified in config (in ms or seconds)
         // Supports: maxTime: 700, maxTime: "700ms", maxTime: "1.2s", maxTime: "1.2sec"
         let maxTimeMs: number | null = null;
         if (levelReq.maxTime !== undefined) {
            if (typeof levelReq.maxTime === "number") {
               maxTimeMs = levelReq.maxTime; // Assume milliseconds
            } else if (typeof levelReq.maxTime === "string") {
               const timeStr = levelReq.maxTime.toLowerCase().trim();
               if (timeStr.endsWith("ms")) {
                  maxTimeMs = parseFloat(timeStr.replace("ms", ""));
               } else if (timeStr.endsWith("s") || timeStr.endsWith("sec")) {
                  maxTimeMs = parseFloat(timeStr.replace(/s(ec)?$/, "")) * 1000;
               } else {
                  maxTimeMs = parseFloat(timeStr); // Assume milliseconds
               }
            }
         }

         // maxTime is required - if not specified, fail the level
         if (maxTimeMs === null) {
            setGameState("failed");
            gameStateRef.current = "failed";
            return;
         }

         // Calculate score based on reaction time
         // Score = 100 if reaction <= maxTime, decreases linearly after
         let score: number;
         if (reaction <= maxTimeMs) {
            score = 100;
         } else {
            // After maxTime, score decreases: 100 - ((reaction - maxTime) / divisor)
            const divisor = variant === 8 ? 60 : 20;
            score = Math.max(0, 100 - (reaction - maxTimeMs) / divisor);
         }

         // Level passes if reaction time is within maxTime (score = 100)
         if (reaction <= maxTimeMs) {
            const roundScore = Math.round(100 / maxLevels);
            const completedLevels = currentLevel + 1;
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            onScoreUpdate(newScore);
            setRequirementsMet(true);
            requirementsMetRef.current = true;
            setGameState("ready");
            gameStateRef.current = "ready";

            // If this is the last level, finalize game completion
            if (currentLevel + 1 >= maxLevels) {
               const finalScore = 100;
               setCurrentScore(finalScore);
               onScoreUpdate(finalScore);
               if (!completionCalledRef.current) {
                  completionCalledRef.current = true;
                  setTimeout(() => {
                     onComplete(finalScore);
                  }, 1000);
               }
            }
         } else {
            setGameState("failed");
            gameStateRef.current = "failed";
         }
      },
      [
         getVariant,
         greenShown,
         currentColor,
         countdown,
         movingObjects,
         multiTargets,
         progressBar,
         patternSequence,
         patternIndex,
         memorySequence,
         clickedSequence,
         levelRequirements,
         currentLevel,
         maxLevels,
         onScoreUpdate,
         onComplete,
      ]
   );

   // Finalize game
   const finalizeGame = useCallback(() => {
      if (completionCalledRef.current) return;
      completionCalledRef.current = true;

      const finalScore = 100;
      setCurrentScore(finalScore);
      setGameState("ready");
      onScoreUpdate(finalScore);

      setTimeout(() => {
         onComplete(finalScore);
      }, 1000);
   }, [onComplete, onScoreUpdate]);

   // Handle next round
   const handleNextRound = useCallback(() => {
      const completedLevels = currentLevel + 1;

      if (completedLevels >= maxLevels) {
         finalizeGame();
      } else {
         if (!requirementsMetRef.current) {
            const roundScore = Math.round(100 / maxLevels);
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            onScoreUpdate(newScore);
         }
         setCurrentLevel((prev) => prev + 1);
         currentLevelRef.current = currentLevel + 1;
         setRequirementsMet(false);
         setAttemptCount(0); // Reset for Best of 3
         startLevel(currentLevel + 1);
      }
   }, [currentLevel, maxLevels, onScoreUpdate, finalizeGame, startLevel]);

   // Handle repeat round
   const handleRepeatRound = useCallback(() => {
      setAttemptCount(0); // Reset for Best of 3
      startLevel(currentLevelRef.current);
   }, [startLevel]);

   // Replay mini-game - with limit of 1 use (unlimited if shared)
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return; // No replays left

      // Reset state and restart the mini-game
      setPenalties(0);
      setAttemptCount(0);
      setAttempts([]);
      setShowFeedback(false);
      setReactionTime(0);
      setRequirementsMet(false);
      requirementsMetRef.current = false;

      // Restart the level
      startLevel(currentLevelRef.current);
      setReplaysUsed((prev) => prev + 1);
   }, [gameState, maxReplays, replaysUsed, startLevel]);

   // Share functionality
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "reaction-test");
         const gameKey = "play50games_shared_reaction-test";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {
         // Error registering share
      }
   };

   const handleShare = async () => {
      const shareableLink = getShareableLink();
      const shareId = new URL(shareableLink).searchParams.get("shared") || "";

      if (!shareId) return;

      await registerShareLink(shareId);

      if (navigator.share) {
         try {
            await navigator.share({
               title: "Reaction Test Game",
               text: "Check out this awesome Reaction Test game!",
               url: shareableLink,
            });
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000);
         } catch (error: any) {
            if (error.name !== "AbortError") {
               handleCopyLink(shareId);
            }
         }
      } else {
         handleCopyLink(shareId);
      }
   };

   const handleCopyLink = async (shareId: string) => {
      const currentUrl = window.location.href.split("?")[0];
      const shareableLink = `${currentUrl}?shared=${shareId}`;

      try {
         await navigator.clipboard.writeText(shareableLink);
         setShareSuccess(true);
         setTimeout(() => setShareSuccess(false), 15000);
      } catch (error) {
         const textArea = document.createElement("textarea");
         textArea.value = shareableLink;
         textArea.style.position = "fixed";
         textArea.style.opacity = "0";
         document.body.appendChild(textArea);
         textArea.select();
         try {
            document.execCommand("copy");
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000);
         } catch (err) {
            // Failed to copy
         }
         document.body.removeChild(textArea);
      }
   };

   // Check if share has clicks
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         const gameKey = "play50games_shared_reaction-test";
         try {
            const status = await getShareStatus(currentShareId);
            const hasClicks = status.has_clicks || status.clicks > 0;
            if (hasClicks && !hasShared) {
               // Share has clicks - activate unlimited replays with expiry
               setHasShared(true);
               setUnlimitedActivated(true);
               setReplaysUsed(0); // Reset replay count

               const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes
               localStorage.setItem(
                  gameKey,
                  JSON.stringify({
                     share_id: currentShareId,
                     shared: true,
                     expiry: expiry,
                  })
               );

               // Set timeout to expire after 15 minutes
               setTimeout(() => {
                  setUnlimitedActivated(false);
                  setHasShared(false);
                  localStorage.removeItem(gameKey);
               }, 15 * 60 * 1000);

               // Stop checking once activated
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
            }
         } catch (error) {
            // Error checking share status - share doesn't exist, deactivate unlimited
            const errorMessage =
               error instanceof Error ? error.message : String(error);
            if (
               errorMessage.includes("404") ||
               errorMessage.includes("not found") ||
               errorMessage.includes("expired")
            ) {
               setUnlimitedActivated(false);
               setHasShared(false);
               localStorage.removeItem(gameKey);
               setCurrentShareId(null);
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
               }
            }
         }
      };

      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000);

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, hasShared]);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_reaction-test";
      const stored = localStorage.getItem(gameKey);
      if (stored) {
         try {
            const data = JSON.parse(stored);
            // Check if share has expired
            if (data.expiry && Date.now() > data.expiry) {
               // Share expired - clean up
               localStorage.removeItem(gameKey);
               return;
            }
            if (data.share_id) {
               setCurrentShareId(data.share_id);
               // Verify with backend before activating unlimited
               const verifyShare = async () => {
                  try {
                     const status = await getShareStatus(data.share_id);
                     const hasClicks = status.has_clicks || status.clicks > 0;
                     if (hasClicks) {
                        // Share exists in backend and has clicks - activate unlimited
                        if (
                           data.shared &&
                           data.expiry &&
                           Date.now() < data.expiry
                        ) {
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           // Set timeout to expire after remaining time
                           const remainingTime = data.expiry - Date.now();
                           if (remainingTime > 0) {
                              setTimeout(() => {
                                 setUnlimitedActivated(false);
                                 setHasShared(false);
                                 localStorage.removeItem(gameKey);
                              }, remainingTime);
                           }
                        }
                     }
                  } catch (error) {
                     // Error checking share - clean up
                     localStorage.removeItem(gameKey);
                     setCurrentShareId(null);
                  }
               };
               verifyShare();
            }
         } catch (error) {
            // Invalid data, clean up
            localStorage.removeItem(gameKey);
         }
      }

      // Check URL for shared parameter
      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
         // Track the share click when someone opens the link
         trackShareClick(sharedBy);
         // Only set currentShareId if this is the share we created (exists in localStorage)
         // This prevents the person opening the link from activating unlimited for themselves
         const stored = localStorage.getItem(gameKey);
         if (stored) {
            try {
               const data = JSON.parse(stored);
               if (data.share_id === sharedBy) {
                  // This is our share - set it to check for clicks
                  setCurrentShareId(sharedBy);
               }
            } catch (error) {
               // Error parsing stored data
            }
         }
      }
   }, []);

   // Cleanup on unmount
   useEffect(() => {
      return () => {
         if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
         if (greenTimerRef.current) clearTimeout(greenTimerRef.current);
         if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, []);

   const variant = getVariant();
   const variantNames = [
      "Color Flash Reaction",
      "Moving Target Reaction",
      "Countdown Reaction",
      "Shape Match Reaction",
      "Speed Reaction",
      "Pattern Reaction",
      "Multi-Target Reaction",
      "Timing Reaction",
      "Memory Reaction",
      "Master Reaction",
   ];

   const variantDescriptions = [
      "Watch for the green flash among colored circles. Click when green appears!",
      "A target moves across the screen. Click it when it turns green!",
      "Watch the countdown (3...2...1...GO!). Click exactly when it reaches GO!",
      "Match the green shape with the target shape shown. Click when they match!",
      "Fast-moving objects appear. Click the green one before it disappears!",
      "Follow the pattern (red→blue→green). Click when the green signal appears!",
      "Multiple targets appear. Click only the green ones, avoid the red ones!",
      "A progress bar fills up. Click exactly when it reaches the green zone!",
      "Remember the sequence, then click in the correct order when green appears!",
      "Ultimate challenge combining all mechanics. Can you master them all?",
   ];

   const progress = ((currentLevel + 1) / maxLevels) * 100;

   // Styling functions (same as other games)
   // Theme colors: --ok: #86efac, --warn: #fca5a5
   const getActionButtonStyle = (tone: "success" | "danger") => {
      // Using theme colors with rgba for opacity
      // --ok: #86efac (rgb: 134, 239, 172)
      // --warn: #fca5a5 (rgb: 252, 165, 165)
      const bgFrom =
         tone === "success"
            ? "rgba(134, 239, 172, 0.25)"
            : "rgba(252, 165, 165, 0.25)";
      const bgTo =
         tone === "success"
            ? "rgba(134, 239, 172, 0.12)"
            : "rgba(252, 165, 165, 0.12)";
      const borderColor =
         tone === "success"
            ? "rgba(134, 239, 172, 0.6)"
            : "rgba(252, 165, 165, 0.6)";

      return {
         padding: isMobile ? "12px 24px" : "14px 28px",
         background: `linear-gradient(135deg, ${bgFrom}, ${bgTo})`,
         border: `2px solid ${borderColor}`,

         color: "var(--text)",
         fontSize: isMobile ? "1rem" : "1.05rem",
         fontWeight: 700,
         cursor: "pointer",
         transition: "all 0.3s ease",
         display: "inline-flex",
         alignItems: "center",
         gap: "8px",
      } as React.CSSProperties;
   };

   const applyActionHover = (
      e: React.MouseEvent<HTMLButtonElement>,
      tone: "success" | "danger",
      isEnter: boolean
   ) => {
      const target = e.currentTarget;
      // --ok: #86efac (rgb: 134, 239, 172)
      // --warn: #fca5a5 (rgb: 252, 165, 165)
      const borderColor =
         tone === "success"
            ? "rgba(134, 239, 172, 0.8)"
            : "rgba(252, 165, 165, 0.8)";
      const bgFrom =
         tone === "success"
            ? "rgba(134, 239, 172, 0.35)"
            : "rgba(252, 165, 165, 0.35)";
      const bgTo =
         tone === "success"
            ? "rgba(134, 239, 172, 0.2)"
            : "rgba(252, 165, 165, 0.2)";
      const defaultBgFrom =
         tone === "success"
            ? "rgba(134, 239, 172, 0.25)"
            : "rgba(252, 165, 165, 0.25)";
      const defaultBgTo =
         tone === "success"
            ? "rgba(134, 239, 172, 0.12)"
            : "rgba(252, 165, 165, 0.12)";
      const shadowColor =
         tone === "success"
            ? "rgba(134, 239, 172, 0.35)"
            : "rgba(252, 165, 165, 0.35)";

      if (isEnter) {
         target.style.background = `linear-gradient(135deg, ${bgFrom}, ${bgTo})`;
         target.style.borderColor = borderColor;
         target.style.transform = "translateY(-2px)";
         target.style.boxShadow = `0 6px 14px ${shadowColor}`;
      } else {
         target.style.background = `linear-gradient(135deg, ${defaultBgFrom}, ${defaultBgTo})`;
         target.style.borderColor =
            tone === "success"
               ? "rgba(134, 239, 172, 0.6)"
               : "rgba(252, 165, 165, 0.6)";
         target.style.transform = "translateY(0)";
         target.style.boxShadow = "none";
      }
   };

   const getNoticeStyle = () => ({
      padding: isMobile ? "20px 24px" : "24px 32px",
      background: "var(--card)",
      borderRadius: "var(--radius)",
      color: "var(--text)",
      fontSize: isMobile ? "1rem" : "1.1rem",
      fontWeight: 700,
      textAlign: "center" as const,
      boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
      width: "100%",
   });

   const getNoticeBadgeStyle = (tone: "success" | "danger") => {
      // --ok: #86efac (rgb: 134, 239, 172)
      // --warn: #fca5a5 (rgb: 252, 165, 165)
      const bgFrom =
         tone === "success"
            ? "rgba(134, 239, 172, 0.25)"
            : "rgba(252, 165, 165, 0.25)";
      const bgTo =
         tone === "success"
            ? "rgba(134, 239, 172, 0.1)"
            : "rgba(252, 165, 165, 0.1)";
      const borderColor =
         tone === "success"
            ? "rgba(134, 239, 172, 0.6)"
            : "rgba(252, 165, 165, 0.6)";
      return {
         display: "inline-flex",
         alignItems: "center",
         gap: "8px",
         padding: "8px 14px",
         borderRadius: "999px",
         fontWeight: 800,
         fontSize: isMobile ? "0.95rem" : "1.05rem",
         background: `linear-gradient(135deg, ${bgFrom}, ${bgTo})`,
         border: `2px solid ${borderColor}`,
         color: "var(--text)",
      };
   };

   return (
      <React.Fragment>
         <style>{`
             @keyframes pulse {
                0%, 100% {
                   opacity: 1;
                   transform: scale(1);
                }
                50% {
                   opacity: 0.7;
                   transform: scale(1.05);
                }
             }
             @keyframes glow {
                0%, 100% {
                   box-shadow: 0 0 20px rgba(134, 239, 172, 0.5);
                }
                50% {
                   box-shadow: 0 0 40px rgba(134, 239, 172, 0.8);
                }
             }
             @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
             }
          `}</style>
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               gap: isMobile ? "16px" : "20px",
               padding: isMobile ? "16px" : "24px",
               maxWidth: "900px",
               margin: "0 auto",
            }}
         >
            {/* Header */}
            <div
               style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: isMobile ? "12px" : "16px",
                  padding: isMobile ? "14px" : "18px",
                  background: "var(--card)",
                  borderRadius: "16px",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     justifyContent: "space-between",
                     alignItems: "center",
                     flexWrap: "wrap",
                     gap: isMobile ? "8px" : "12px",
                  }}
               >
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: isMobile ? "12px" : "16px",
                        flexWrap: "wrap",
                     }}
                  >
                     <span
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "6px",
                           fontSize: isMobile ? "0.9rem" : "1rem",
                           fontWeight: 600,
                           color: "var(--text)",
                        }}
                     >
                        <ArrowPathIcon
                           style={{
                              width: isMobile ? 14 : 16,
                              height: isMobile ? 14 : 16,
                           }}
                        />
                        Level {currentLevel + 1} / {maxLevels}
                     </span>
                     {getMaxTimeDisplay() && (
                        <span
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: isMobile ? "0.85rem" : "0.9rem",
                              fontWeight: 600,
                              color: "var(--accent)",
                              padding: "4px 10px",
                              background: "rgba(125, 211, 252, 0.15)",
                              border: "1px solid rgba(125, 211, 252, 0.3)",
                              borderRadius: "6px",
                           }}
                        >
                           <ClockIcon
                              style={{
                                 width: isMobile ? 12 : 14,
                                 height: isMobile ? 12 : 14,
                              }}
                           />
                           Max: {getMaxTimeDisplay()}
                        </span>
                     )}
                  </div>
                  <span
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                     }}
                  >
                     <TrophyIcon
                        style={{
                           width: isMobile ? 14 : 16,
                           height: isMobile ? 14 : 16,
                           color: "var(--ok)",
                        }}
                     />
                     {currentLevel + 1 >= maxLevels && gameState === "ready"
                        ? 100
                        : currentScore}{" "}
                     / 100
                  </span>
               </div>
               <div
                  style={{
                     width: "100%",
                     height: "8px",
                     background: "var(--stroke)",
                     borderRadius: "4px",
                     overflow: "hidden",
                  }}
               >
                  <div
                     style={{
                        width: `${progress}%`,
                        height: "100%",
                        background:
                           "linear-gradient(90deg, var(--accent), var(--ok))",
                        transition: "width 0.3s ease",
                     }}
                  />
               </div>
            </div>

            {/* Variant Name and Description */}
            <div
               style={{
                  textAlign: "center",
                  padding: isMobile ? "12px" : "16px",
                  background: "var(--card)",
               }}
            >
               <div
                  style={{
                     fontSize: isMobile ? "1rem" : "1.1rem",
                     fontWeight: 600,
                     color: "var(--text)",
                     marginBottom: isMobile ? "6px" : "8px",
                  }}
               >
                  {variantNames[variant]}
               </div>
               <div
                  style={{
                     fontSize: isMobile ? "0.85rem" : "0.9rem",
                     color: "var(--muted)",
                     lineHeight: "1.4",
                     fontStyle: "italic",
                  }}
               >
                  {variantDescriptions[variant]}
               </div>
            </div>

            {/* Game Area - Different UI for each mini-game */}
            <div
               style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16/9",
                  minHeight: isMobile ? "250px" : "400px",
                  background: "var(--stroke)",
                  borderRadius: "16px",
                  overflow: "hidden",
               }}
            >
               {/* Variant 0: Color Flash Reaction */}
               {variant === 0 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "20px",
                        flexWrap: "wrap",
                        cursor: "pointer",
                     }}
                     onClick={() => handleClick()}
                  >
                     {[0, 1, 2, 3].map((index) => {
                        const isGreen =
                           greenShown &&
                           currentColor === "green" &&
                           greenCircleIndex === index;
                        return (
                           <div
                              key={index}
                              style={{
                                 width: isMobile ? "60px" : "80px",
                                 height: isMobile ? "60px" : "80px",
                                 borderRadius: "50%",
                                 background: isGreen
                                    ? "var(--ok)"
                                    : "rgba(255, 255, 255, 0.1)",
                                 border: isGreen
                                    ? "3px solid rgba(134, 239, 172, 0.8)"
                                    : "2px solid var(--stroke)",
                                 transition: "all 0.3s ease",
                                 boxShadow: isGreen
                                    ? "0 0 20px rgba(134, 239, 172, 0.6)"
                                    : "none",
                                 animation: isGreen
                                    ? "pulse 1s infinite"
                                    : "none",
                              }}
                           />
                        );
                     })}
                  </div>
               )}

               {/* Variant 1: Moving Target Reaction */}
               {variant === 1 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        position: "relative",
                        cursor: "pointer",
                     }}
                     onClick={() => handleClick()}
                  >
                     <div
                        style={{
                           position: "absolute",
                           left: `${targetPosition.x}%`,
                           top: `${targetPosition.y}%`,
                           transform: "translate(-50%, -50%)",
                           width: isMobile ? "60px" : "80px",
                           height: isMobile ? "60px" : "80px",
                           borderRadius: "50%",
                           background: greenShown
                              ? "var(--ok)"
                              : "var(--stroke)",
                           border: greenShown
                              ? "3px solid rgba(134, 239, 172, 0.8)"
                              : "2px solid var(--stroke)",
                           transition: "all 0.1s linear",
                           boxShadow: greenShown
                              ? "0 0 20px rgba(134, 239, 172, 0.6)"
                              : "none",
                           animation: greenShown ? "pulse 1s infinite" : "none",
                        }}
                     />
                  </div>
               )}

               {/* Variant 2: Countdown Reaction */}
               {variant === 2 && gameState === "playing" && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                     }}
                     onClick={() => handleClick()}
                  >
                     <div
                        style={{
                           fontSize: isMobile ? "4rem" : "6rem",
                           fontWeight: 900,
                           color:
                              countdown === "GO"
                                 ? "var(--ok)"
                                 : countdown !== null
                                 ? "var(--accent)"
                                 : "var(--text)",
                           textShadow:
                              countdown === "GO"
                                 ? "0 0 30px rgba(134, 239, 172, 0.8)"
                                 : "none",
                           transition: "all 0.3s ease",
                           transform:
                              countdown === "GO" ? "scale(1.2)" : "scale(1)",
                        }}
                     >
                        {countdown === null
                           ? "WAIT..."
                           : countdown === "GO"
                           ? "GO!"
                           : countdown}
                     </div>
                  </div>
               )}

               {/* Variant 3: Shape Match Reaction */}
               {variant === 3 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: isMobile ? "20px" : "30px",
                        position: "relative",
                     }}
                  >
                     {/* Target Shape in Center */}
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
                              fontSize: isMobile ? "0.85rem" : "0.95rem",
                              color: "var(--muted)",
                              fontWeight: 600,
                           }}
                        >
                           Match this shape:
                        </div>
                        <div
                           style={{
                              width: isMobile ? "70px" : "90px",
                              height: isMobile ? "70px" : "90px",
                              borderRadius:
                                 targetShape === "circle"
                                    ? "50%"
                                    : targetShape === "triangle"
                                    ? "0"
                                    : "12px",
                              clipPath:
                                 targetShape === "triangle"
                                    ? "polygon(50% 0%, 0% 100%, 100% 100%)"
                                    : "none",
                              background: "var(--accent)",
                              border: "3px solid var(--accent)",
                              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                           }}
                        />
                     </div>

                     {/* Shape Options Grid */}
                     {greenShown && shapeOptions.length > 0 && (
                        <div
                           style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(3, 1fr)",
                              gap: isMobile ? "12px" : "16px",
                              width: "100%",
                              maxWidth: isMobile ? "280px" : "360px",
                              padding: isMobile ? "12px" : "16px",
                           }}
                        >
                           {shapeOptions.map((option) => {
                              const isCorrect = option.isCorrect;
                              return (
                                 <div
                                    key={option.id}
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       handleClick(e, option.id);
                                    }}
                                    style={{
                                       width: isMobile ? "70px" : "90px",
                                       height: isMobile ? "70px" : "90px",
                                       borderRadius:
                                          option.shape === "circle"
                                             ? "50%"
                                             : option.shape === "triangle"
                                             ? "0"
                                             : "12px",
                                       clipPath:
                                          option.shape === "triangle"
                                             ? "polygon(50% 0%, 0% 100%, 100% 100%)"
                                             : "none",
                                       background: isCorrect
                                          ? "var(--ok)"
                                          : "var(--warn)",
                                       border: `3px solid ${
                                          isCorrect
                                             ? "rgba(134, 239, 172, 0.8)"
                                             : "rgba(252, 165, 165, 0.8)"
                                       }`,
                                       cursor: "pointer",
                                       boxShadow: isCorrect
                                          ? "0 0 20px rgba(134, 239, 172, 0.6)"
                                          : "0 0 15px rgba(252, 165, 165, 0.4)",
                                       animation: isCorrect
                                          ? "pulse 1s infinite"
                                          : "none",
                                       transition: "all 0.3s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                       e.currentTarget.style.transform =
                                          "scale(1.1)";
                                    }}
                                    onMouseLeave={(e) => {
                                       e.currentTarget.style.transform =
                                          "scale(1)";
                                    }}
                                 />
                              );
                           })}
                        </div>
                     )}
                  </div>
               )}

               {/* Variant 4: Speed Reaction */}
               {variant === 4 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        position: "relative",
                     }}
                  >
                     {movingObjects.map((obj) => (
                        <div
                           key={obj.id}
                           onClick={(e) => {
                              e.stopPropagation();
                              handleClick(e, obj.id);
                           }}
                           style={{
                              position: "absolute",
                              left: `${obj.x}%`,
                              top: `${obj.y}%`,
                              transform: "translate(-50%, -50%)",
                              width: isMobile ? "40px" : "50px",
                              height: isMobile ? "40px" : "50px",
                              borderRadius: "50%",
                              background:
                                 obj.color === "green"
                                    ? "var(--ok)"
                                    : "var(--warn)",
                              border: `3px solid ${
                                 obj.color === "green"
                                    ? "rgba(134, 239, 172, 0.8)"
                                    : "rgba(252, 165, 165, 0.8)"
                              }`,
                              cursor: "pointer",
                              boxShadow:
                                 obj.color === "green"
                                    ? "0 0 15px rgba(134, 239, 172, 0.6)"
                                    : "0 0 15px rgba(252, 165, 165, 0.6)",
                              animation: "pulse 1s infinite",
                           }}
                        />
                     ))}
                  </div>
               )}

               {/* Variant 5: Pattern Reaction */}
               {variant === 5 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "20px",
                        cursor: "pointer",
                     }}
                     onClick={() => handleClick()}
                  >
                     {patternSequence.map((color, idx) => (
                        <div
                           key={idx}
                           style={{
                              width: isMobile ? "60px" : "80px",
                              height: isMobile ? "60px" : "80px",
                              borderRadius: "50%",
                              background:
                                 idx <= patternIndex
                                    ? color === "green"
                                       ? "var(--ok)"
                                       : color === "red"
                                       ? "var(--warn)"
                                       : "var(--accent)"
                                    : "rgba(255, 255, 255, 0.1)",
                              border:
                                 idx <= patternIndex
                                    ? `3px solid ${
                                         color === "green"
                                            ? "rgba(134, 239, 172, 0.8)"
                                            : color === "red"
                                            ? "rgba(252, 165, 165, 0.8)"
                                            : "rgba(125, 211, 252, 0.8)"
                                      }`
                                    : "2px solid var(--stroke)",
                              transition: "all 0.3s ease",
                              boxShadow:
                                 idx === patternIndex && color === "green"
                                    ? "0 0 20px rgba(134, 239, 172, 0.6)"
                                    : "none",
                              animation:
                                 idx === patternIndex && color === "green"
                                    ? "pulse 1s infinite"
                                    : "none",
                           }}
                        />
                     ))}
                  </div>
               )}

               {/* Variant 6: Multi-Target Reaction */}
               {variant === 6 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        position: "relative",
                     }}
                  >
                     {multiTargets.map((target) => (
                        <div
                           key={target.id}
                           onClick={(e) => {
                              e.stopPropagation();
                              handleClick(e, target.id);
                           }}
                           style={{
                              position: "absolute",
                              left: `${target.x}%`,
                              top: `${target.y}%`,
                              transform: "translate(-50%, -50%)",
                              width: isMobile ? "50px" : "60px",
                              height: isMobile ? "50px" : "60px",
                              borderRadius: "50%",
                              background:
                                 target.color === "green"
                                    ? "var(--ok)"
                                    : "var(--warn)",
                              border: `3px solid ${
                                 target.color === "green"
                                    ? "rgba(134, 239, 172, 0.8)"
                                    : "rgba(252, 165, 165, 0.8)"
                              }`,
                              cursor: "pointer",
                              boxShadow:
                                 target.color === "green"
                                    ? "0 0 15px rgba(134, 239, 172, 0.6)"
                                    : "0 0 15px rgba(252, 165, 165, 0.6)",
                              animation: "pulse 1s infinite",
                           }}
                        />
                     ))}
                  </div>
               )}

               {/* Variant 7: Timing Reaction */}
               {variant === 7 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "30px",
                        cursor: "pointer",
                        padding: "40px",
                     }}
                     onClick={() => handleClick()}
                  >
                     <div
                        style={{
                           width: "100%",
                           height: "20px",
                           background: "rgba(255, 255, 255, 0.1)",
                           borderRadius: "999px",
                           overflow: "hidden",
                           position: "relative",
                        }}
                     >
                        <div
                           style={{
                              width: `${progressBar}%`,
                              height: "100%",
                              background:
                                 progressBar >= 90
                                    ? "linear-gradient(90deg, var(--ok), rgba(134, 239, 172, 0.8))"
                                    : "linear-gradient(90deg, var(--accent), rgba(125, 211, 252, 0.8))",
                              borderRadius: "999px",
                              transition:
                                 "width 0.05s linear, background 0.3s ease",
                              boxShadow:
                                 progressBar >= 90
                                    ? "0 0 15px rgba(134, 239, 172, 0.6)"
                                    : "none",
                           }}
                        />
                     </div>
                     {greenShown && (
                        <div
                           style={{
                              fontSize: isMobile ? "2rem" : "3rem",
                              fontWeight: 700,
                              color: "var(--ok)",
                              textShadow: "0 0 20px rgba(134, 239, 172, 0.8)",
                           }}
                        >
                           CLICK NOW!
                        </div>
                     )}
                  </div>
               )}

               {/* Variant 8: Memory Reaction */}
               {variant === 8 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "20px",
                     }}
                  >
                     {memorySequenceVisible && !greenShown && (
                        <div
                           style={{
                              fontSize: isMobile ? "2rem" : "3rem",
                              fontWeight: 700,
                              color: "var(--accent)",
                              textAlign: "center",
                           }}
                        >
                           {memorySequence.join(" → ")}
                        </div>
                     )}

                     {!memorySequenceVisible && !greenShown && (
                        <div
                           style={{
                              fontSize: isMobile ? "1.2rem" : "1.5rem",
                              color: "var(--muted)",
                              fontWeight: 600,
                           }}
                        >
                           Remember the sequence...
                        </div>
                     )}

                     {greenShown && (
                        <div
                           style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "20px",
                              width: "100%",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: isMobile ? "1rem" : "1.2rem",
                                 color: "var(--ok)",
                                 fontWeight: 600,
                                 marginBottom: "10px",
                              }}
                           >
                              Click numbers in order:{" "}
                              {memorySequence.join(" → ")}
                           </div>
                           <div
                              style={{
                                 display: "flex",
                                 flexWrap: "wrap",
                                 gap: "12px",
                                 justifyContent: "center",
                                 maxWidth: "400px",
                              }}
                           >
                              {shuffledNumbers.map((num) => {
                                 const isClicked =
                                    clickedSequence.includes(num);
                                 const isNext =
                                    clickedSequence.length <
                                       memorySequence.length &&
                                    memorySequence[clickedSequence.length] ===
                                       num;
                                 return (
                                    <button
                                       key={num}
                                       onClick={(e) => {
                                          e.stopPropagation();
                                          handleClick(e, num);
                                       }}
                                       disabled={isClicked}
                                       style={{
                                          width: isMobile ? "50px" : "60px",
                                          height: isMobile ? "50px" : "60px",
                                          fontSize: isMobile
                                             ? "1.2rem"
                                             : "1.5rem",
                                          fontWeight: 700,

                                          border: isNext
                                             ? "3px solid var(--ok)"
                                             : isClicked
                                             ? "2px solid var(--ok)"
                                             : "2px solid var(--stroke)",
                                          background: isClicked
                                             ? "var(--ok)"
                                             : isNext
                                             ? "rgba(134, 239, 172, 0.2)"
                                             : "var(--card)",
                                          color: isClicked
                                             ? "white"
                                             : "var(--text)",
                                          cursor: isClicked
                                             ? "not-allowed"
                                             : "pointer",
                                          opacity: isClicked ? 0.6 : 1,
                                          transition: "all 0.2s ease",
                                       }}
                                    >
                                       {num}
                                    </button>
                                 );
                              })}
                           </div>
                        </div>
                     )}
                  </div>
               )}

               {/* Variant 9: Master Reaction */}
               {variant === 9 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        background: greenShown ? "var(--ok)" : "var(--stroke)",
                        transition: "background 0.3s ease",
                        animation: greenShown
                           ? "glow 1.5s ease-in-out infinite"
                           : "none",
                        boxShadow: greenShown
                           ? "0 0 30px rgba(134, 239, 172, 0.4), inset 0 0 50px rgba(134, 239, 172, 0.2)"
                           : "none",
                     }}
                     onClick={() => handleClick()}
                  >
                     <div
                        style={{
                           fontSize: isMobile ? "1.5rem" : "2.5rem",
                           fontWeight: 700,
                           color: greenShown ? "white" : "var(--text)",
                           textAlign: "center",
                           transition: "all 0.3s ease",
                           transform: greenShown ? "scale(1.1)" : "scale(1)",
                           textShadow: greenShown
                              ? "0 0 20px rgba(255, 255, 255, 0.5)"
                              : "none",
                        }}
                     >
                        {greenShown ? "CLICK NOW!" : "WAIT..."}
                     </div>
                  </div>
               )}

               {/* Penalty indicator */}
               {penalties > 0 && (
                  <div
                     style={{
                        position: "absolute",
                        top: "20px",
                        right: "20px",
                        padding: "6px 12px",
                        background: "rgba(252, 165, 165, 0.2)",
                        border: "2px solid rgba(252, 165, 165, 0.6)",
                        borderRadius: "999px",
                        fontSize: isMobile ? "0.8rem" : "0.9rem",
                        fontWeight: 700,
                        color: "var(--warn)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                     }}
                  >
                     ⚠️ {penalties}
                  </div>
               )}

               {/* Reaction time display */}
               {reactionTime > 0 && !showFeedback && (
                  <div
                     style={{
                        position: "absolute",
                        bottom: "20px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: isMobile ? "1.2rem" : "1.5rem",
                        fontWeight: 700,
                        color: "white",
                        background: "rgba(0, 0, 0, 0.6)",
                        padding: "12px 24px",

                        border: "2px solid rgba(255, 255, 255, 0.3)",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                     }}
                  >
                     {reactionTime}ms
                  </div>
               )}
            </div>

            {/* Stats */}
            {(penalties > 0 || attempts.length > 0) && (
               <div
                  style={{
                     display: "flex",
                     gap: "16px",
                     justifyContent: "center",
                     flexWrap: "wrap",
                  }}
               >
                  {penalties > 0 && (
                     <div
                        style={{
                           padding: "8px 16px",
                           background: "var(--card)",
                           borderRadius: "8px",
                           fontSize: isMobile ? "0.9rem" : "1rem",
                           fontWeight: 600,
                           color: "var(--warn)",
                        }}
                     >
                        Penalties: {penalties}
                     </div>
                  )}
                  {variant === 4 && attempts.length > 0 && (
                     <div
                        style={{
                           padding: "8px 16px",
                           background: "var(--card)",
                           borderRadius: "8px",
                           fontSize: isMobile ? "0.9rem" : "1rem",
                           fontWeight: 600,
                           color: "var(--text)",
                        }}
                     >
                        Attempts: {attempts.length} / 3
                     </div>
                  )}
               </div>
            )}

            {/* Feedback */}
            {showFeedback && (
               <div
                  style={{
                     padding: "16px 24px",

                     fontSize: "1.1rem",
                     fontWeight: 600,
                     background: "rgba(134, 239, 172, 0.2)",
                     border: "1px solid var(--ok)",
                     color: "var(--ok)",
                     textAlign: "center",
                  }}
               >
                  Reaction: {reactionTime}ms
               </div>
            )}

            {/* Action Buttons: Replay, Share */}
            {(gameState === "playing" || gameState === "failed") && (
               <div
                  style={{
                     display: "flex",
                     gap: "12px",
                     justifyContent: "center",
                     flexWrap: "wrap",
                     padding: isMobile ? "12px" : "16px",
                     background: "var(--card)",
                  }}
               >
                  {/* Share Success Message */}
                  {shareSuccess && !unlimitedActivated && (
                     <div
                        style={{
                           width: "100%",
                           padding: "12px",
                           background: "rgba(134, 239, 172, 0.2)",
                           border: "2px solid rgba(134, 239, 172, 0.6)",
                           borderRadius: "8px",
                           fontSize: isMobile ? "0.9rem" : "1rem",
                           fontWeight: 600,
                           color: "var(--ok)",
                           textAlign: "center",
                           marginBottom: "8px",
                        }}
                     >
                        Link copied! Unlimited replay will unlock when someone
                        opens your link!
                     </div>
                  )}

                  {/* Unlimited Activated Message */}
                  {unlimitedActivated && (
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: isMobile ? "6px" : "8px",
                           padding: isMobile ? "10px 14px" : "8px 16px",
                           background:
                              "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                           border: "2px solid rgba(59, 130, 246, 0.6)",
                           borderRadius: isMobile ? "10px" : "8px",
                           color: "var(--text)",
                           fontSize: isMobile ? "0.85rem" : "0.9rem",
                           fontWeight: 500,
                           width: "100%",
                           justifyContent: "center",
                           textAlign: "center",
                           flexWrap: "wrap",
                           marginBottom: "8px",
                        }}
                     >
                        <CheckCircleIcon
                           style={{
                              width: isMobile ? 16 : 18,
                              height: isMobile ? 16 : 18,
                              color: "rgba(59, 130, 246, 0.9)",
                              flexShrink: 0,
                           }}
                        />
                        <span>
                           {isMobile
                              ? "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!"
                              : "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!"}
                        </span>
                     </div>
                  )}

                  {/* Replay Button */}
                  <button
                     onClick={handleReplay}
                     disabled={maxReplays > 0 && replaysUsed >= maxReplays}
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: isMobile ? "6px" : "8px",
                        padding: isMobile ? "10px 16px" : "10px 20px",
                        width: isMobile ? "100%" : "auto",
                        background:
                           maxReplays > 0 && replaysUsed >= maxReplays
                              ? "rgba(100, 100, 100, 0.2)"
                              : "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))",
                        border:
                           maxReplays > 0 && replaysUsed >= maxReplays
                              ? "1px solid rgba(100, 100, 100, 0.4)"
                              : "1px solid rgba(125, 211, 252, 0.6)",

                        color: "var(--text)",
                        fontSize: isMobile ? "0.85rem" : "0.95rem",
                        fontWeight: 600,
                        cursor:
                           maxReplays > 0 && replaysUsed >= maxReplays
                              ? "not-allowed"
                              : "pointer",
                        opacity:
                           maxReplays > 0 && replaysUsed >= maxReplays
                              ? 0.5
                              : 1,
                        transition: "all 0.3s ease",
                     }}
                     onMouseEnter={(e) => {
                        if (!(maxReplays > 0 && replaysUsed >= maxReplays)) {
                           e.currentTarget.style.background =
                              "linear-gradient(135deg, rgba(125, 211, 252, 0.3), rgba(125, 211, 252, 0.2))";
                           e.currentTarget.style.borderColor =
                              "rgba(125, 211, 252, 0.8)";
                           e.currentTarget.style.transform = "translateY(-2px)";
                           e.currentTarget.style.boxShadow =
                              "0 4px 12px rgba(125, 211, 252, 0.3)";
                        }
                     }}
                     onMouseLeave={(e) => {
                        if (!(maxReplays > 0 && replaysUsed >= maxReplays)) {
                           e.currentTarget.style.background =
                              maxReplays > 0 && replaysUsed >= maxReplays
                                 ? "rgba(100, 100, 100, 0.2)"
                                 : "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))";
                           e.currentTarget.style.borderColor =
                              maxReplays > 0 && replaysUsed >= maxReplays
                                 ? "rgba(100, 100, 100, 0.4)"
                                 : "rgba(125, 211, 252, 0.6)";
                           e.currentTarget.style.transform = "translateY(0)";
                           e.currentTarget.style.boxShadow = "none";
                        }
                     }}
                  >
                     <ArrowPathRoundedSquareIcon
                        style={{
                           width: isMobile ? 18 : 20,
                           height: isMobile ? 18 : 20,
                           color:
                              maxReplays > 0 && replaysUsed >= maxReplays
                                 ? "var(--muted)"
                                 : "var(--accent)",
                        }}
                     />
                     <span>
                        {isMobile ? "" : "Replay "}
                        {maxReplays === 0
                           ? "(∞)"
                           : `(${maxReplays - replaysUsed}/${maxReplays})`}
                     </span>
                  </button>

                  {/* Share Button */}
                  <button
                     onClick={handleShare}
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: isMobile ? "6px" : "8px",
                        padding: isMobile ? "10px 16px" : "10px 20px",
                        width: isMobile ? "100%" : "auto",
                        background:
                           "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                        border: "1px solid rgba(59, 130, 246, 0.6)",

                        color: "var(--text)",
                        fontSize: isMobile ? "0.85rem" : "0.95rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                     }}
                     onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                           "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.2))";
                        e.currentTarget.style.borderColor =
                           "rgba(59, 130, 246, 0.8)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow =
                           "0 4px 12px rgba(59, 130, 246, 0.3)";
                     }}
                     onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                           "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))";
                        e.currentTarget.style.borderColor =
                           "rgba(59, 130, 246, 0.6)";
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                     }}
                  >
                     <ShareIcon
                        style={{
                           width: isMobile ? 18 : 20,
                           height: isMobile ? 18 : 20,
                           color: "rgba(59, 130, 246, 0.9)",
                        }}
                     />
                     <span>
                        {isMobile ? "Share" : "Share for Unlimited Replay"}
                     </span>
                  </button>
               </div>
            )}

            {/* Level Complete Message */}
            {gameState === "ready" && currentLevel + 1 < maxLevels && (
               <div style={getNoticeStyle()}>
                  <div style={getNoticeBadgeStyle("success")}>
                     <CheckCircleIcon style={{ width: 20, height: 20 }} />
                     Level {currentLevel + 1} Complete
                  </div>
                  <div
                     style={{
                        fontSize: isMobile ? "1.05rem" : "1.1rem",
                        fontWeight: 600,
                        marginBottom: "20px",
                        marginTop: "16px",
                     }}
                  >
                     Are you ready for next round?
                  </div>
                  <button
                     onClick={handleNextRound}
                     style={getActionButtonStyle("success")}
                     onMouseEnter={(e) => applyActionHover(e, "success", true)}
                     onMouseLeave={(e) => applyActionHover(e, "success", false)}
                  >
                     Next Round
                  </button>
               </div>
            )}

            {/* Game Complete Message */}
            {gameState === "ready" && currentLevel + 1 >= maxLevels && (
               <div style={getNoticeStyle()}>
                  <div style={getNoticeBadgeStyle("success")}>
                     <TrophyIcon style={{ width: 20, height: 20 }} />
                     Game Complete!
                  </div>
                  <div
                     style={{
                        fontSize: isMobile ? "1.05rem" : "1.1rem",
                        fontWeight: 600,
                        marginTop: "16px",
                        marginBottom: "20px",
                     }}
                  >
                     All {maxLevels} levels completed!
                  </div>
                  <div
                     style={{
                        fontSize: isMobile ? "0.95rem" : "1rem",
                        opacity: 0.8,
                        marginTop: "8px",
                     }}
                  >
                     Final Score: 100
                  </div>
               </div>
            )}

            {/* Level Failed Message */}
            {gameState === "failed" && (
               <div style={getNoticeStyle()}>
                  <div style={getNoticeBadgeStyle("danger")}>
                     <XCircleIcon style={{ width: 20, height: 20 }} />
                     Level {currentLevel + 1} Failed
                  </div>
                  <div
                     style={{
                        fontSize: isMobile ? "1.05rem" : "1.1rem",
                        fontWeight: 600,
                        marginTop: "16px",
                        color: "var(--text)",
                     }}
                  >
                     Score too low.
                  </div>
               </div>
            )}
         </div>
      </React.Fragment>
   );
}
