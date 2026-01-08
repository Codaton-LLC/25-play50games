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
   StarIcon,
   HeartIcon,
   BoltIcon,
   FireIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

interface FallingObjectsProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

interface FallingObject {
   id: number;
   type: "good" | "bad";
   x: number; // horizontal position (0-100%)
   y: number; // vertical position (0-100%)
   speed: number; // falling speed (pixels per frame)
   size: number; // size multiplier (0.7-1.3)
   icon: "star" | "heart" | "bolt" | "check" | "x" | "fire";
   rotation: number; // rotation angle
   clicked: boolean;
}

export default function FallingObjects({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: FallingObjectsProps) {
   const maxLevels = config?.levels ? Number(config.levels) : 15;
   const defaultLevelDuration = 30;
   const levelRequirements = config?.levelRequirements || null;

   // Get duration for current level
   const getLevelDuration = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].duration || defaultLevelDuration;
         }
         return defaultLevelDuration;
      },
      [levelRequirements, defaultLevelDuration]
   );

   const [currentLevel, setCurrentLevel] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "playing" | "ready" | "failed" | "paused"
   >("playing");
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [timeLeft, setTimeLeft] = useState(() => {
      return getLevelDuration(0);
   });
   const [caughtGood, setCaughtGood] = useState(0);
   const [caughtBad, setCaughtBad] = useState(0);
   const [missedGood, setMissedGood] = useState(0);
   const [objects, setObjects] = useState<FallingObject[]>([]);
   const [feedback, setFeedback] = useState<"good" | "bad" | null>(null);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5;

   const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
   const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
   const animationFrameRef = useRef<number | null>(null);
   const objectIdCounterRef = useRef(0);
   const levelScoreRef = useRef(0);
   const gameStateRef = useRef<"playing" | "ready" | "failed" | "paused">(
      "playing"
   );
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<() => void>(() => {});
   const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   const clickedObjectsRef = useRef<Set<number>>(new Set());
   const processingClickRef = useRef<Set<number>>(new Set());
   const scoredObjectsRef = useRef<Set<number>>(new Set());

   // Responsive design
   useEffect(() => {
      const checkResponsive = () => {
         setIsMobile(window.innerWidth < 640);
         setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024);
      };
      checkResponsive();
      window.addEventListener("resize", checkResponsive);
      return () => window.removeEventListener("resize", checkResponsive);
   }, []);

   useEffect(() => {
      if (!isPlaying) return;
      prevLevelRef.current = null;
      forceStartLevelRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      completionCalledRef.current = false;
      setCurrentLevel(0);
      setCurrentScore(0);
      setRequirementsMet(false);
      setGameState("playing");
      scoredObjectsRef.current.clear();
   }, [isPlaying]);

   // Get level configuration based on level number
   const getLevelConfig = useCallback((level: number) => {
      switch (level) {
         case 0: // Level 1: Slow falling, large objects, mostly good
            return {
               spawnInterval: 1200,
               fallSpeed: 0.8,
               goodRatio: 0.8,
               minSize: 0.9,
               maxSize: 1.1,
               minCatch: 8,
            };
         case 1: // Level 2: Slightly faster, medium objects
            return {
               spawnInterval: 1100,
               fallSpeed: 1.0,
               goodRatio: 0.75,
               minSize: 0.85,
               maxSize: 1.15,
               minCatch: 10,
            };
         case 2: // Level 3: Medium speed, mixed sizes
            return {
               spawnInterval: 1000,
               fallSpeed: 1.2,
               goodRatio: 0.7,
               minSize: 0.8,
               maxSize: 1.2,
               minCatch: 12,
            };
         case 3: // Level 4: Faster, smaller objects
            return {
               spawnInterval: 900,
               fallSpeed: 1.4,
               goodRatio: 0.65,
               minSize: 0.75,
               maxSize: 1.25,
               minCatch: 14,
            };
         case 4: // Level 5: Fast, varied sizes
            return {
               spawnInterval: 800,
               fallSpeed: 1.6,
               goodRatio: 0.6,
               minSize: 0.7,
               maxSize: 1.3,
               minCatch: 16,
            };
         case 5: // Level 6: Very fast, more bad objects
            return {
               spawnInterval: 700,
               fallSpeed: 1.8,
               goodRatio: 0.55,
               minSize: 0.7,
               maxSize: 1.3,
               minCatch: 18,
            };
         case 6: // Level 7: Ultra fast, small objects
            return {
               spawnInterval: 600,
               fallSpeed: 2.0,
               goodRatio: 0.5,
               minSize: 0.65,
               maxSize: 1.3,
               minCatch: 20,
            };
         case 7: // Level 8: Extreme speed, mixed difficulty
            return {
               spawnInterval: 550,
               fallSpeed: 2.2,
               goodRatio: 0.5,
               minSize: 0.6,
               maxSize: 1.3,
               minCatch: 22,
            };
         case 8: // Level 9: Maximum speed, tiny objects
            return {
               spawnInterval: 500,
               fallSpeed: 2.4,
               goodRatio: 0.45,
               minSize: 0.6,
               maxSize: 1.3,
               minCatch: 24,
            };
         case 9: // Level 10: Master speed, varied sizes
            return {
               spawnInterval: 450,
               fallSpeed: 2.6,
               goodRatio: 0.45,
               minSize: 0.55,
               maxSize: 1.3,
               minCatch: 26,
            };
         case 10: // Level 11: Extreme challenge, fast spawn
            return {
               spawnInterval: 400,
               fallSpeed: 2.8,
               goodRatio: 0.4,
               minSize: 0.55,
               maxSize: 1.3,
               minCatch: 28,
            };
         case 11: // Level 12: Ultra challenge, very fast
            return {
               spawnInterval: 350,
               fallSpeed: 3.0,
               goodRatio: 0.4,
               minSize: 0.5,
               maxSize: 1.3,
               minCatch: 30,
            };
         case 12: // Level 13: Insane speed, rapid spawn
            return {
               spawnInterval: 300,
               fallSpeed: 3.2,
               goodRatio: 0.35,
               minSize: 0.5,
               maxSize: 1.3,
               minCatch: 32,
            };
         case 13: // Level 14: Maximum difficulty
            return {
               spawnInterval: 250,
               fallSpeed: 3.4,
               goodRatio: 0.35,
               minSize: 0.45,
               maxSize: 1.3,
               minCatch: 35,
            };
         case 14: // Level 15: Ultimate challenge
            return {
               spawnInterval: 200,
               fallSpeed: 3.6,
               goodRatio: 0.3,
               minSize: 0.4,
               maxSize: 1.3,
               minCatch: 40,
            };
         default:
            return {
               spawnInterval: 1000,
               fallSpeed: 1.0,
               goodRatio: 0.7,
               minSize: 0.8,
               maxSize: 1.2,
               minCatch: 10,
            };
      }
   }, []);

   // Get minimum caught good objects for current level
   const getMinCaughtGood = useCallback(() => {
      if (levelRequirements && levelRequirements[currentLevel]) {
         return (
            levelRequirements[currentLevel].minCaughtGood ||
            8 + currentLevel * 2
         );
      }
      const config = getLevelConfig(currentLevel);
      return config.minCatch;
   }, [currentLevel, levelRequirements, getLevelConfig]);

   // Spawn a new falling object
   const spawnObject = useCallback(() => {
      if (gameStateRef.current !== "playing" || requirementsMetRef.current) {
         return;
      }

      const config = getLevelConfig(currentLevel);
      const id = objectIdCounterRef.current++;
      const isGood = Math.random() < config.goodRatio;
      const type: "good" | "bad" = isGood ? "good" : "bad";

      // Random horizontal position (10% to 90% of width)
      const x = Math.random() * 80 + 10;

      // Start from top (y = 0)
      const y = 0;

      // Random size
      const size =
         config.minSize + Math.random() * (config.maxSize - config.minSize);

      // Random icon for good objects
      const goodIcons: ("star" | "heart" | "bolt" | "check")[] = [
         "star",
         "heart",
         "bolt",
         "check",
      ];
      const badIcons: ("x" | "fire")[] = ["x", "fire"];
      const icon = isGood
         ? goodIcons[Math.floor(Math.random() * goodIcons.length)]
         : badIcons[Math.floor(Math.random() * badIcons.length)];

      // Random rotation
      const rotation = Math.random() * 360;

      const newObject: FallingObject = {
         id,
         type,
         x,
         y,
         speed: config.fallSpeed,
         size,
         icon,
         rotation,
         clicked: false,
      };

      setObjects((prev) => [...prev, newObject]);
   }, [currentLevel, getLevelConfig]);

   // Start level
   const startLevel = useCallback(() => {
      if (spawnTimerRef.current) {
         clearInterval(spawnTimerRef.current);
         spawnTimerRef.current = null;
      }
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }
      if (animationFrameRef.current) {
         cancelAnimationFrame(animationFrameRef.current);
         animationFrameRef.current = null;
      }

      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      setCaughtGood(0);
      setCaughtBad(0);
      setMissedGood(0);
      setObjects([]);
      levelScoreRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      setGameState("playing");
      setRequirementsMet(false);
      setFeedback(null);
      objectIdCounterRef.current = 0;
      clickedObjectsRef.current.clear();
      processingClickRef.current.clear();
      scoredObjectsRef.current.clear();

      const config = getLevelConfig(currentLevel);

      // Start spawn timer
      spawnTimerRef.current = setInterval(() => {
         spawnObject();
      }, config.spawnInterval);

      // Start animation loop
      const animate = () => {
         if (gameStateRef.current !== "playing" || requirementsMetRef.current) {
            return;
         }

         setObjects((prevObjects) => {
            return prevObjects
               .map((obj) => {
                  if (obj.clicked) return null;

                  // Update position (falling down)
                  const newY = obj.y + obj.speed;

                  // Check if object reached bottom
                  if (newY >= 100) {
                     if (obj.type === "good") {
                        setMissedGood((prev) => prev + 1);
                     }
                     return null; // Remove object
                  }

                  // Update rotation
                  const newRotation = obj.rotation + 2;

                  return {
                     ...obj,
                     y: newY,
                     rotation: newRotation,
                  };
               })
               .filter((obj): obj is FallingObject => obj !== null);
         });

         animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);

      // Start countdown timer
      countdownTimerRef.current = setInterval(() => {
         setTimeLeft((prev: number) => {
            if (prev <= 1) {
               if (countdownTimerRef.current) {
                  clearInterval(countdownTimerRef.current);
                  countdownTimerRef.current = null;
               }
               return 0;
            }
            return prev - 1;
         });
      }, 1000);
   }, [currentLevel, getLevelDuration, getLevelConfig, spawnObject]);

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

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

   // Handle next round button click
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

         forceStartLevelRef.current = currentLevel + 1;
         setCurrentLevel((prev) => prev + 1);
         setRequirementsMet(false);
      }
   }, [currentLevel, maxLevels, onScoreUpdate, finalizeGame]);

   // Handle repeat round button click
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setRequirementsMet(false);
      requirementsMetRef.current = false;
      setGameState("playing");
      gameStateRef.current = "playing";
      setCaughtGood(0);
      setCaughtBad(0);
      setMissedGood(0);
      setObjects([]);
      clickedObjectsRef.current.clear();
      processingClickRef.current.clear();
      scoredObjectsRef.current.clear();
      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }
      if (spawnTimerRef.current) {
         clearInterval(spawnTimerRef.current);
         spawnTimerRef.current = null;
      }
      if (animationFrameRef.current) {
         cancelAnimationFrame(animationFrameRef.current);
         animationFrameRef.current = null;
      }
      startLevel();
      setReplaysUsed((prev) => prev + 1);
   }, [
      gameState,
      maxReplays,
      replaysUsed,
      startLevel,
      currentLevel,
      getLevelDuration,
   ]);

   // Share functionality
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "falling-objects");
         const gameKey = "play50games_shared_falling-objects";
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
               title: "Falling Objects Game",
               text: "Check out this Falling Objects game!",
               url: shareableLink,
            });
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000);
         } catch (error) {
            // User cancelled or error
         }
      } else {
         try {
            await navigator.clipboard.writeText(shareableLink);
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000);
         } catch (error) {
            // Clipboard error
         }
      }

      try {
         await trackShareClick(shareId);
      } catch (error) {
         // Error tracking
      }
   };

   // Check share status
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         try {
            const status = await getShareStatus(currentShareId);
            const hasClicks = status.has_clicks || status.clicks > 0;

            if (hasClicks && !hasShared) {
               setHasShared(true);
               setUnlimitedActivated(true);
               setReplaysUsed(0);

               const expiry = Date.now() + 15 * 60 * 1000;
               localStorage.setItem(
                  gameKey,
                  JSON.stringify({
                     share_id: currentShareId,
                     shared: true,
                     expiry: expiry,
                  })
               );

               setTimeout(() => {
                  setUnlimitedActivated(false);
                  setHasShared(false);
                  localStorage.removeItem(gameKey);
               }, 15 * 60 * 1000);

               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
            }
         } catch (error) {
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

      const gameKey = "play50games_shared_falling-objects";
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
      const gameKey = "play50games_shared_falling-objects";
      const stored = localStorage.getItem(gameKey);
      if (stored) {
         try {
            const data = JSON.parse(stored);
            if (data.expiry && Date.now() > data.expiry) {
               localStorage.removeItem(gameKey);
               return;
            }
            if (data.share_id) {
               setCurrentShareId(data.share_id);
               const verifyShare = async () => {
                  try {
                     const status = await getShareStatus(data.share_id);
                     const hasClicks = status.has_clicks || status.clicks > 0;
                     if (hasClicks) {
                        if (
                           data.shared &&
                           data.expiry &&
                           Date.now() < data.expiry
                        ) {
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           setReplaysUsed(0);

                           const remainingTime = data.expiry - Date.now();
                           if (remainingTime > 0) {
                              setTimeout(() => {
                                 setUnlimitedActivated(false);
                                 setHasShared(false);
                                 localStorage.removeItem(gameKey);
                              }, remainingTime);
                           }
                        } else {
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           setReplaysUsed(0);
                           const expiryTime = Date.now() + 15 * 60 * 1000;
                           localStorage.setItem(
                              gameKey,
                              JSON.stringify({
                                 share_id: data.share_id,
                                 expiry: expiryTime,
                              })
                           );

                           setTimeout(() => {
                              setUnlimitedActivated(false);
                              setHasShared(false);
                              localStorage.removeItem(gameKey);
                           }, 15 * 60 * 1000);
                        }
                     }
                  } catch (error) {
                     // Error checking status
                  }
               };
               verifyShare();
            }
         } catch (error) {
            // Error parsing stored data
         }
      }
   }, []);

   // End level
   const endLevel = useCallback(() => {
      if (requirementsMetRef.current) {
         return;
      }
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }
      if (spawnTimerRef.current) {
         clearInterval(spawnTimerRef.current);
         spawnTimerRef.current = null;
      }
      if (animationFrameRef.current) {
         cancelAnimationFrame(animationFrameRef.current);
         animationFrameRef.current = null;
      }

      const minCaughtGood = getMinCaughtGood();
      const levelPassed = caughtGood >= minCaughtGood;

      if (levelPassed && !requirementsMet) {
         handleNextRound();
      } else if (!levelPassed) {
         setGameState("failed");
      }
   }, [caughtGood, requirementsMet, getMinCaughtGood, handleNextRound]);

   useEffect(() => {
      if (!isPlaying || currentLevel >= maxLevels) {
         prevLevelRef.current = null;
         if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
         }
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         if (spawnTimerRef.current) {
            clearInterval(spawnTimerRef.current);
            spawnTimerRef.current = null;
         }
         if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
         }
         return;
      }

      if (prevLevelRef.current === currentLevel) {
         return;
      }

      prevLevelRef.current = currentLevel;
      const isForcedStart = forceStartLevelRef.current === currentLevel;
      if (isForcedStart) {
         forceStartLevelRef.current = null;
      }
      const delay = isForcedStart || currentLevel === 0 ? 0 : 1200;

      if (startTimeoutRef.current) {
         clearTimeout(startTimeoutRef.current);
      }

      if (delay === 0) {
         startLevelRef.current();
      } else {
         startTimeoutRef.current = setTimeout(() => {
            startLevelRef.current();
            startTimeoutRef.current = null;
         }, delay);
      }
   }, [isPlaying, currentLevel, maxLevels]);

   // Check if level requirements are met during gameplay
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const minCaughtGood = getMinCaughtGood();

      if (caughtGood >= minCaughtGood) {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         if (spawnTimerRef.current) {
            clearInterval(spawnTimerRef.current);
            spawnTimerRef.current = null;
         }
         if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
         }
         setTimeLeft(0);

         requirementsMetRef.current = true;
         setRequirementsMet(true);
         setGameState("ready");
         setObjects([]);

         if (currentLevel + 1 >= maxLevels) {
            finalizeGame();
         } else {
            const roundScore = Math.round(100 / maxLevels);
            const completedLevels = currentLevel + 1;
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            onScoreUpdate(newScore);
         }
      }
   }, [
      caughtGood,
      gameState,
      requirementsMet,
      getMinCaughtGood,
      currentLevel,
      maxLevels,
      onScoreUpdate,
      finalizeGame,
   ]);

   // Check if time runs out and requirements are not met
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet || timeLeft > 0) return;

      const minCaughtGood = getMinCaughtGood();
      if (caughtGood < minCaughtGood) {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         if (spawnTimerRef.current) {
            clearInterval(spawnTimerRef.current);
            spawnTimerRef.current = null;
         }
         if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
         }
         setGameState("failed");
         gameStateRef.current = "failed";
         setObjects([]);
      }
   }, [timeLeft, gameState, requirementsMet, caughtGood, getMinCaughtGood]);

   useEffect(() => {
      requirementsMetRef.current = requirementsMet;
   }, [requirementsMet]);

   useEffect(() => {
      gameStateRef.current = gameState;
   }, [gameState]);

   // Handle object click - using refs for better performance
   const handleObjectClick = useCallback((objectId: number) => {
      // IMMEDIATELY block if game is not playing or requirements are met
      if (gameStateRef.current !== "playing" || requirementsMetRef.current) {
         return;
      }

      // Check if object was already clicked or is being processed (prevent double counting)
      if (
         clickedObjectsRef.current.has(objectId) ||
         processingClickRef.current.has(objectId)
      ) {
         return;
      }

      if (scoredObjectsRef.current.has(objectId)) {
         return;
      }

      // Mark as being processed immediately to prevent double clicks
      processingClickRef.current.add(objectId);
      clickedObjectsRef.current.add(objectId);

      setObjects((prev) => {
         const obj = prev.find((o) => o.id === objectId);
         if (!obj || obj.clicked) {
            processingClickRef.current.delete(objectId);
            return prev;
         }

         // Mark as clicked immediately
         const updated = prev.map((o) =>
            o.id === objectId ? { ...o, clicked: true } : o
         );

         // Update scores (only once even under StrictMode)
         if (!scoredObjectsRef.current.has(objectId)) {
            scoredObjectsRef.current.add(objectId);
            if (obj.type === "good") {
               setCaughtGood((prev) => prev + 1);
               setFeedback("good");
            } else {
               setCaughtBad((prev) => prev + 1);
               setFeedback("bad");
            }
         }

         // Remove object after short delay
         setTimeout(() => {
            setObjects((current) => {
               const filtered = current.filter((o) => o.id !== objectId);
               clickedObjectsRef.current.delete(objectId);
               processingClickRef.current.delete(objectId);
               return filtered;
            });
         }, 200);

         return updated;
      });

      setTimeout(() => {
         setFeedback(null);
      }, 300);
   }, []);

   // Progress calculation - based on completed levels, not caught objects
   const progress = useMemo(() => {
      return maxLevels > 0
         ? Math.min(100, (currentLevel / maxLevels) * 100)
         : 0;
   }, [currentLevel, maxLevels]);

   // Get level description
   const getLevelDescription = (level: number): string => {
      const descriptions = [
         "Slow & Steady (Large objects, mostly good)",
         "Picking Up Speed (Medium objects)",
         "Getting Faster (Mixed sizes)",
         "Speed Challenge (Smaller objects)",
         "Fast Falling (Varied sizes)",
         "Very Fast (More bad objects)",
         "Ultra Speed (Tiny objects)",
         "Extreme Speed (Mixed difficulty)",
         "Maximum Speed (Tiny objects)",
         "Master Speed (Varied sizes)",
         "Extreme Challenge (Fast spawn)",
         "Ultra Challenge (Very fast)",
         "Insane Speed (Rapid spawn)",
         "Maximum Difficulty",
         "Ultimate Challenge (Fastest)",
      ];
      return descriptions[level] || "Falling Objects";
   };

   // Render icon component
   const renderIcon = (icon: FallingObject["icon"], size: number) => {
      const iconSize = isMobile ? 20 * size : 24 * size;
      const commonProps = {
         style: { width: iconSize, height: iconSize },
      };

      switch (icon) {
         case "star":
            return <StarIcon {...commonProps} />;
         case "heart":
            return <HeartIcon {...commonProps} />;
         case "bolt":
            return <BoltIcon {...commonProps} />;
         case "check":
            return <CheckCircleIcon {...commonProps} />;
         case "x":
            return <XCircleIcon {...commonProps} />;
         case "fire":
            return <FireIcon {...commonProps} />;
         default:
            return <StarIcon {...commonProps} />;
      }
   };

   return (
      <>
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               alignItems: "center",
               justifyContent: "center",
               minHeight: "100%",
               width: "100%",
               padding: isMobile ? "12px" : "20px",
               gap: isMobile ? "16px" : "24px",
            }}
         >
            {/* Header Section */}
            <div
               style={{
                  width: "100%",
                  maxWidth: "800px",
                  background: "var(--card)",
                  borderRadius: isMobile ? "14px" : "16px",
                  padding: isMobile ? "16px" : "20px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     justifyContent: "space-between",
                     alignItems: "center",
                     fontSize: isMobile ? "0.75rem" : "0.875rem",
                     color: "var(--muted)",
                     fontWeight: 500,
                     marginBottom: isMobile ? "10px" : "12px",
                     flexWrap: isMobile ? "wrap" : "nowrap",
                     gap: isMobile ? "8px" : "0",
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
                           width: isMobile ? 14 : 16,
                           height: isMobile ? 14 : 16,
                           color: "var(--accent)",
                        }}
                     />
                     Level {currentLevel + 1} / {maxLevels}
                  </span>
                  <span
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                     }}
                  >
                     <TrophyIcon
                        style={{
                           width: isMobile ? 14 : 16,
                           height: isMobile ? 14 : 16,
                           color: "var(--ok)",
                        }}
                     />
                     Score:{" "}
                     {currentLevel + 1 >= maxLevels && gameState === "ready"
                        ? 100
                        : currentScore}{" "}
                     / 100
                  </span>
                  <span
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                     }}
                  >
                     <ClockIcon
                        style={{
                           width: isMobile ? 14 : 16,
                           height: isMobile ? 14 : 16,
                           color: "var(--accent)",
                        }}
                     />
                     Time: {timeLeft}s
                  </span>
               </div>
               <div
                  style={{
                     width: "100%",
                     height: isMobile ? "6px" : "8px",
                     background: "rgba(255, 255, 255, 0.1)",
                     borderRadius: "999px",
                     overflow: "hidden",
                  }}
               >
                  <div
                     style={{
                        width: `${progress}%`,
                        height: "100%",
                        background:
                           "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                        borderRadius: "999px",
                        transition: "width 0.3s ease",
                        boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                     }}
                  />
               </div>
            </div>

            {/* Game Board */}
            <div
               style={{
                  width: "100%",
                  maxWidth: "800px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: isMobile ? "16px" : "24px",
               }}
            >
               {/* Stats */}
               <div
                  style={{
                     display: "flex",
                     gap: isMobile ? "12px" : "16px",
                     width: "100%",
                     justifyContent: "center",
                     flexWrap: "wrap",
                  }}
               >
                  <div
                     style={{
                        padding: isMobile ? "8px 12px" : "10px 16px",
                        background:
                           "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.12))",
                        border: "2px solid rgba(134, 239, 172, 0.6)",

                        color: "var(--text)",
                        fontSize: isMobile ? "0.85rem" : "0.95rem",
                        fontWeight: 600,
                     }}
                  >
                     Caught Good: {caughtGood} / {getMinCaughtGood()}
                  </div>
                  <div
                     style={{
                        padding: isMobile ? "8px 12px" : "10px 16px",
                        background:
                           "linear-gradient(135deg, rgba(252, 165, 165, 0.25), rgba(252, 165, 165, 0.12))",
                        border: "2px solid rgba(252, 165, 165, 0.6)",

                        color: "var(--text)",
                        fontSize: isMobile ? "0.85rem" : "0.95rem",
                        fontWeight: 600,
                     }}
                  >
                     Caught Bad: {caughtBad}
                  </div>
                  <div
                     style={{
                        padding: isMobile ? "8px 12px" : "10px 16px",
                        background:
                           "linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(251, 191, 36, 0.12))",
                        border: "2px solid rgba(251, 191, 36, 0.6)",

                        color: "var(--text)",
                        fontSize: isMobile ? "0.85rem" : "0.95rem",
                        fontWeight: 600,
                     }}
                  >
                     Missed Good: {missedGood}
                  </div>
               </div>

               {/* Level Description */}
               <div
                  style={{
                     padding: isMobile ? "8px 12px" : "10px 16px",
                     background: "var(--card)",

                     color: "var(--text)",
                     fontSize: isMobile ? "0.9rem" : "1rem",
                     fontWeight: 600,
                     textAlign: "center",
                  }}
               >
                  {getLevelDescription(currentLevel)}
               </div>

               {/* Falling Area */}
               {gameState === "playing" && (
                  <div
                     style={{
                        position: "relative",
                        width: "100%",
                        minHeight: isMobile ? "400px" : "500px",
                        maxHeight: isMobile ? "400px" : "500px",
                        borderRadius: "var(--radius)",
                        background:
                           "radial-gradient(320px 220px at 30% 30%, rgba(59, 130, 246, 0.1), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                        boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
                        overflow: "hidden",
                     }}
                  >
                     {objects.map((obj) => {
                        const handleInteraction = (
                           e: React.PointerEvent<HTMLButtonElement>
                        ) => {
                           e.preventDefault();
                           e.stopPropagation();

                           // Prevent double clicks - check all conditions
                           if (
                              obj.clicked ||
                              clickedObjectsRef.current.has(obj.id) ||
                              processingClickRef.current.has(obj.id)
                           ) {
                              return;
                           }

                           handleObjectClick(obj.id);
                        };

                        return (
                           <button
                              key={obj.id}
                              onPointerDown={handleInteraction}
                              disabled={obj.clicked}
                              style={{
                                 position: "absolute",
                                 left: `${obj.x}%`,
                                 top: `${obj.y}%`,
                                 transform: `translate(-50%, -50%) rotate(${obj.rotation}deg) scale(${obj.size})`,
                                 width: isMobile ? "64px" : "72px",
                                 height: isMobile ? "64px" : "72px",
                                 minWidth: isMobile ? "64px" : "72px",
                                 minHeight: isMobile ? "64px" : "72px",
                                 borderRadius: "16px",
                                 border:
                                    obj.type === "good"
                                       ? "2px solid rgba(134, 239, 172, 0.55)"
                                       : "2px solid rgba(252, 165, 165, 0.55)",
                                 background:
                                    obj.type === "good"
                                       ? "rgba(134, 239, 172, 0.18)"
                                       : "rgba(252, 165, 165, 0.16)",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 color: "white",
                                 cursor: obj.clicked
                                    ? "not-allowed"
                                    : "pointer",
                                 opacity: obj.clicked ? 0.3 : 1,
                                 transition: "opacity 0.1s ease",
                                 boxShadow:
                                    obj.type === "good"
                                       ? "0 4px 12px rgba(134, 239, 172, 0.3)"
                                       : "0 4px 12px rgba(252, 165, 165, 0.3)",
                                 zIndex: 10,
                                 touchAction: "manipulation",
                                 WebkitTapHighlightColor: "transparent",
                                 userSelect: "none",
                                 padding: 0,
                                 margin: 0,
                              }}
                           >
                              {renderIcon(obj.icon, obj.size)}
                           </button>
                        );
                     })}

                     {/* Feedback Message */}
                     {feedback && (
                        <div
                           style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              padding: isMobile ? "12px 20px" : "16px 24px",
                              background:
                                 feedback === "good"
                                    ? "rgba(134, 239, 172, 0.2)"
                                    : "rgba(252, 165, 165, 0.2)",
                              border: `2px solid ${
                                 feedback === "good"
                                    ? "rgba(134, 239, 172, 0.6)"
                                    : "rgba(252, 165, 165, 0.6)"
                              }`,

                              color:
                                 feedback === "good"
                                    ? "var(--ok)"
                                    : "var(--warn)",
                              fontSize: isMobile ? "1.2rem" : "1.5rem",
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              zIndex: 100,
                              pointerEvents: "none",
                           }}
                        >
                           {feedback === "good" ? (
                              <>
                                 <CheckCircleIcon
                                    style={{ width: 24, height: 24 }}
                                 />
                                 <span>+1 Good!</span>
                              </>
                           ) : (
                              <>
                                 <XCircleIcon
                                    style={{ width: 24, height: 24 }}
                                 />
                                 <span>-1 Bad!</span>
                              </>
                           )}
                        </div>
                     )}
                  </div>
               )}

               {/* Ready for Next Round Message */}
               {gameState === "ready" && currentLevel + 1 < maxLevels && (
                  <div
                     style={{
                        padding: isMobile ? "20px 24px" : "24px 32px",
                        background: "var(--card)",
                        borderRadius: "var(--radius)",
                        color: "var(--text)",
                        fontSize: isMobile ? "1rem" : "1.1rem",
                        fontWeight: 700,
                        textAlign: "center" as const,
                        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                        width: "100%",
                     }}
                  >
                     <div
                        style={{
                           display: "inline-flex",
                           alignItems: "center",
                           gap: "8px",
                           padding: "8px 14px",
                           borderRadius: "999px",
                           fontWeight: 800,
                           fontSize: isMobile ? "0.95rem" : "1.05rem",
                           background:
                              "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.1))",
                           border: "2px solid rgba(134, 239, 172, 0.6)",
                           color: "var(--text)",
                           marginBottom: "16px",
                        }}
                     >
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
                        style={{
                           padding: isMobile ? "12px 24px" : "14px 28px",
                           background:
                              "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.12))",
                           border: "2px solid rgba(134, 239, 172, 0.6)",

                           color: "var(--text)",
                           fontSize: isMobile ? "1rem" : "1.05rem",
                           fontWeight: 700,
                           cursor: "pointer",
                           transition: "all 0.3s ease",
                        }}
                     >
                        Next Round
                     </button>
                  </div>
               )}

               {/* Game Complete Message */}
               {gameState === "ready" && currentLevel + 1 >= maxLevels && (
                  <div
                     style={{
                        padding: isMobile ? "20px 24px" : "24px 32px",
                        background: "var(--card)",
                        borderRadius: "var(--radius)",
                        color: "var(--text)",
                        fontSize: isMobile ? "1rem" : "1.1rem",
                        fontWeight: 700,
                        textAlign: "center" as const,
                        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                        width: "100%",
                     }}
                  >
                     <div
                        style={{
                           display: "inline-flex",
                           alignItems: "center",
                           gap: "8px",
                           padding: "8px 14px",
                           borderRadius: "999px",
                           fontWeight: 800,
                           fontSize: isMobile ? "0.95rem" : "1.05rem",
                           background:
                              "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.1))",
                           border: "2px solid rgba(134, 239, 172, 0.6)",
                           color: "var(--text)",
                           marginBottom: "16px",
                        }}
                     >
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
                  </div>
               )}

               {/* Level Failed Message */}
               {gameState === "failed" && (
                  <div
                     style={{
                        padding: isMobile ? "20px 24px" : "24px 32px",
                        background: "var(--card)",
                        borderRadius: "var(--radius)",
                        color: "var(--text)",
                        fontSize: isMobile ? "1rem" : "1.1rem",
                        fontWeight: 700,
                        textAlign: "center" as const,
                        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                        width: "100%",
                     }}
                  >
                     <div
                        style={{
                           display: "inline-flex",
                           alignItems: "center",
                           gap: "8px",
                           padding: "8px 14px",
                           borderRadius: "999px",
                           fontWeight: 800,
                           fontSize: isMobile ? "0.95rem" : "1.05rem",
                           background:
                              "linear-gradient(135deg, rgba(252, 165, 165, 0.25), rgba(252, 165, 165, 0.1))",
                           border: "2px solid rgba(252, 165, 165, 0.6)",
                           color: "var(--text)",
                           marginBottom: "16px",
                        }}
                     >
                        <XCircleIcon style={{ width: 20, height: 20 }} />
                        Level {currentLevel + 1} Failed
                     </div>
                     <div
                        style={{
                           marginTop: "12px",
                           fontSize: isMobile ? "0.95rem" : "1.05rem",
                           fontWeight: 600,
                           color: "var(--text)",
                           marginBottom: "18px",
                        }}
                     >
                        Need: {getMinCaughtGood()} good objects caught
                     </div>
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

                        width: "100%",
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
                           Link copied! Unlimited replay will unlock when
                           someone opens your link!
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
                              🎉 Someone opened your link! Unlimited replay is
                              now active for 15 minutes!
                           </span>
                        </div>
                     )}

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
                     >
                        <ShareIcon
                           style={{
                              width: isMobile ? 18 : 20,
                              height: isMobile ? 18 : 20,
                           }}
                        />
                        <span>
                           {isMobile ? "Share" : "Share for unlimited"}
                        </span>
                     </button>
                  </div>
               )}
            </div>
         </div>
      </>
   );
}
