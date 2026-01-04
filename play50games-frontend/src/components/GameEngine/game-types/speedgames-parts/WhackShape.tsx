"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
   getShareStatus,
} from "@/lib/api/share";

interface WhackShapeProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function WhackShape({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: WhackShapeProps) {
   const maxLevels = config?.levels ? Number(config.levels) : 10;
   const defaultLevelDuration = config?.levelDuration
      ? Number(config.levelDuration)
      : 20; // seconds per level (fallback)

   // Level requirements from config (optional, falls back to default progression)
   const levelRequirements = config?.levelRequirements || null;

   // Get duration for current level (defined early to avoid hoisting issues)
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
      "playing" | "correct" | "wrong" | "paused" | "ready" | "failed"
   >("playing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [timeLeft, setTimeLeft] = useState(() => {
      // Initialize with first level duration
      return getLevelDuration(0);
   });
   const [correctClicks, setCorrectClicks] = useState(0);
   const [wrongClicks, setWrongClicks] = useState(0);
   const [targetShape, setTargetShape] = useState<
      "circle" | "square" | "triangle"
   >("circle");
   const [shapes, setShapes] = useState<
      Array<{
         id: number;
         type: "circle" | "square" | "triangle";
         x: number;
         y: number;
         vx: number; // velocity x
         vy: number; // velocity y
         size: number; // size multiplier (0.8-1.2)
         rotation: number; // rotation angle
         clicked: boolean;
         timeoutId: NodeJS.Timeout | null;
      }>
   >([]);
   const animationFrameRef = useRef<number | null>(null);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max replays: 5 for Whack-a-Shape, unlimited if shared
   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited

   const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
   const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
   const itemIdCounterRef = useRef(0);
   const levelScoreRef = useRef(0);
   const gameStateRef = useRef<
      "playing" | "correct" | "wrong" | "paused" | "ready" | "failed"
   >("playing");
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<() => void>(() => {});
   const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);

   // Check for shared link on mount
   useEffect(() => {
      if (!isPlaying) return;

      const urlParams = new URLSearchParams(window.location.search);
      const sharedId = urlParams.get("shared");
      if (sharedId) {
         setCurrentShareId(sharedId);
         const gameKey = "play50games_shared_whack-shape";
         const stored = localStorage.getItem(gameKey);
         if (stored) {
            try {
               const data = JSON.parse(stored);
               if (data.shared && data.expiry && Date.now() < data.expiry) {
                  setHasShared(true);
                  setUnlimitedActivated(true);
               }
            } catch (e) {
               // Invalid stored data
            }
         }
      }
   }, [isPlaying]);

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
   }, [isPlaying]);

   // Clear all items and timers
   const clearAll = useCallback(() => {
      setShapes((prevShapes) => {
         prevShapes.forEach((shape) => {
            if (shape.timeoutId) clearTimeout(shape.timeoutId);
         });
         return [];
      });
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
   }, []);

   // Get spawn interval based on level (faster with higher levels)
   const getSpawnInterval = useCallback(() => {
      // Level 1: 800ms, Level 5: 500ms, Level 10: 300ms
      return Math.max(300, 800 - currentLevel * 50);
   }, [currentLevel]);

   // Get item TTL based on level (shorter with higher levels)
   const getItemTTL = useCallback(() => {
      // Level 1: 2500ms, Level 5: 1500ms, Level 10: 1000ms
      return Math.max(1000, 2500 - currentLevel * 150);
   }, [currentLevel]);

   // Spawn shapes
   const spawnShapes = useCallback(() => {
      // IMMEDIATELY stop spawning if game is not playing or requirements are met
      if (gameStateRef.current !== "playing" || requirementsMetRef.current) {
         if (spawnTimerRef.current) {
            clearInterval(spawnTimerRef.current);
            spawnTimerRef.current = null;
         }
         return;
      }

      // Sometimes spawn 2 shapes to increase difficulty (more likely at higher levels)
      const spawnCount = Math.random() < 0.1 + currentLevel * 0.02 ? 2 : 1;

      const shapeTypes: ("circle" | "square" | "triangle")[] = [
         "circle",
         "square",
         "triangle",
      ];

      for (let k = 0; k < spawnCount; k++) {
         const id = itemIdCounterRef.current++;
         const shapeType =
            shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

         // Random position in arena (avoid edges)
         const arenaWidth = isMobile ? window.innerWidth - 48 : 800;
         const arenaHeight = isMobile ? 300 : 380;
         const x = Math.random() * (arenaWidth - 100) + 50;
         const y = Math.random() * (arenaHeight - 100) + 50;

         // Random velocity (faster at higher levels)
         const speed = 0.2 + currentLevel * 0.04; // 0.2-0.6 px/frame
         const angle = Math.random() * Math.PI * 2;
         const vx = Math.cos(angle) * speed;
         const vy = Math.sin(angle) * speed;

         // Random size (0.8-1.2x)
         const size = 0.8 + Math.random() * 0.4;

         // Random rotation
         const rotation = Math.random() * 360;

         const ttl = getItemTTL();
         const timeoutId = setTimeout(() => {
            setShapes((prev) => prev.filter((shape) => shape.id !== id));
         }, ttl);

         setShapes((prev) => [
            ...prev,
            {
               id,
               type: shapeType,
               x,
               y,
               vx,
               vy,
               size,
               rotation,
               clicked: false,
               timeoutId,
            },
         ]);
      }
   }, [gameState, requirementsMet, currentLevel, getItemTTL, isMobile]);

   // Get minimum required correct clicks for level
   const getMinCorrectClicks = useCallback(() => {
      if (levelRequirements && levelRequirements[currentLevel]) {
         return (
            levelRequirements[currentLevel].minCorrectClicks || 3 + currentLevel
         );
      }
      return 3 + currentLevel;
   }, [currentLevel, levelRequirements]);

   // Finalize game - defined early to avoid hoisting issues
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

   // End level
   const endLevel = useCallback(() => {
      // Only clear all if requirements are NOT met (failed level)
      const minCorrectClicks = getMinCorrectClicks();
      if (correctClicks < minCorrectClicks) {
         // Failed - clear everything
         clearAll();
         setGameState("failed");
         gameStateRef.current = "failed";
      } else {
         // Passed - just stop timers but keep shapes visible
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
         // Clear timeouts for shapes to prevent them from disappearing, keep shapes visible
         setShapes((prevShapes) => {
            const updatedShapes = prevShapes.map((shape) => {
               if (shape.timeoutId) {
                  clearTimeout(shape.timeoutId);
               }
               // Return shape without timeoutId so it won't disappear
               return {
                  ...shape,
                  timeoutId: null, // Clear timeout but keep shape
               };
            });
            return updatedShapes; // Keep all shapes visible
         });

         setGameState("ready");
         gameStateRef.current = "ready";

         // If this is the last level, finalize game completion
         if (currentLevel + 1 >= maxLevels) {
            finalizeGame();
         }
      }
   }, [
      clearAll,
      getMinCorrectClicks,
      correctClicks,
      currentLevel,
      maxLevels,
      finalizeGame,
   ]);

   // Start level
   const startLevel = useCallback(() => {
      clearAll();
      const currentLevelDuration = getLevelDuration(currentLevel);
      setTimeLeft(currentLevelDuration);
      setCorrectClicks(0);
      setWrongClicks(0);
      levelScoreRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      setGameState("playing");
      setFeedback(null);
      setRequirementsMet(false);
      setShapes([]);
      itemIdCounterRef.current = 0;

      // Set target shape
      const shapeTypes: ("circle" | "square" | "triangle")[] = [
         "circle",
         "square",
         "triangle",
      ];
      const target = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
      setTargetShape(target);

      // Start spawning
      spawnShapes();
      spawnTimerRef.current = setInterval(spawnShapes, getSpawnInterval());

      // Start animation loop for moving shapes
      const animate = () => {
         if (gameStateRef.current !== "playing" || requirementsMetRef.current) {
            return;
         }

         setShapes((prevShapes) => {
            const arenaWidth = isMobile ? window.innerWidth - 48 : 800;
            const arenaHeight = isMobile ? 300 : 380;
            const itemSize = isMobile ? 48 : 54;

            return prevShapes.map((shape) => {
               if (shape.clicked) return shape;

               let newX = shape.x + shape.vx;
               let newY = shape.y + shape.vy;
               let newVx = shape.vx;
               let newVy = shape.vy;

               // Bounce off walls
               if (newX < itemSize / 2 || newX > arenaWidth - itemSize / 2) {
                  newVx = -newVx;
                  newX = Math.max(
                     itemSize / 2,
                     Math.min(arenaWidth - itemSize / 2, newX)
                  );
               }
               if (newY < itemSize / 2 || newY > arenaHeight - itemSize / 2) {
                  newVy = -newVy;
                  newY = Math.max(
                     itemSize / 2,
                     Math.min(arenaHeight - itemSize / 2, newY)
                  );
               }

               // Update rotation
               const newRotation = shape.rotation + 2;

               return {
                  ...shape,
                  x: newX,
                  y: newY,
                  vx: newVx,
                  vy: newVy,
                  rotation: newRotation,
               };
            });
         });

         animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);

      // Start countdown
      countdownTimerRef.current = setInterval(() => {
         setTimeLeft((prev: number) => {
            if (requirementsMetRef.current) {
               return prev;
            }
            if (prev <= 1) {
               if (
                  gameStateRef.current !== "paused" &&
                  gameStateRef.current !== "ready"
               ) {
                  endLevel();
               }
               return 0;
            }
            return prev - 1;
         });
      }, 1000);
   }, [
      clearAll,
      spawnShapes,
      getSpawnInterval,
      isMobile,
      getLevelDuration,
      currentLevel,
      endLevel,
   ]);

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Check if requirements are met
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const minCorrectClicks = getMinCorrectClicks();

      if (correctClicks >= minCorrectClicks) {
         // IMMEDIATELY freeze game (stop spawning and timers, but keep shapes visible)
         // Stop spawning
         if (spawnTimerRef.current) {
            clearInterval(spawnTimerRef.current);
            spawnTimerRef.current = null;
         }
         // Stop countdown timer
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         // Stop animation
         if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
         }
         // Clear timeouts for shapes to prevent them from disappearing, keep shapes visible
         setShapes((prevShapes) => {
            const updatedShapes = prevShapes.map((shape) => {
               if (shape.timeoutId) {
                  clearTimeout(shape.timeoutId);
               }
               // Return shape without timeoutId so it won't disappear
               return {
                  ...shape,
                  timeoutId: null, // Clear timeout but keep shape
               };
            });
            return updatedShapes; // Keep all shapes visible
         });

         setTimeLeft(0);
         requirementsMetRef.current = true;
         setRequirementsMet(true);
         setGameState("paused");
         gameStateRef.current = "paused";
         setFeedback(null);

         // If this is the last level, finalize game completion
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
      correctClicks,
      gameState,
      requirementsMet,
      getMinCorrectClicks,
      currentLevel,
      maxLevels,
      onScoreUpdate,
      finalizeGame,
   ]);

   // When timer reaches 0 and requirements are met
   useEffect(() => {
      if (timeLeft === 0 && requirementsMet && gameState === "paused") {
         setGameState("ready");
         gameStateRef.current = "ready";
      }
   }, [timeLeft, requirementsMet, gameState]);

   // Check if all levels are completed and finalize game
   useEffect(() => {
      if (
         gameState === "ready" &&
         currentLevel + 1 >= maxLevels &&
         !completionCalledRef.current
      ) {
         // Ensure finalizeGame is called when all levels are completed
         finalizeGame();
      }
   }, [gameState, currentLevel, maxLevels, finalizeGame]);

   // Start level when currentLevel changes
   useEffect(() => {
      if (!isPlaying) return;

      if (
         forceStartLevelRef.current !== null &&
         forceStartLevelRef.current === currentLevel
      ) {
         forceStartLevelRef.current = null;
         startTimeoutRef.current = setTimeout(() => {
            startLevel();
         }, 100);
      } else if (prevLevelRef.current === null && currentLevel === 0) {
         prevLevelRef.current = 0;
         startTimeoutRef.current = setTimeout(() => {
            startLevel();
         }, 100);
      }
   }, [currentLevel, isPlaying, startLevel]);

   // Cleanup on unmount
   useEffect(() => {
      return () => {
         clearAll();
         if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
         }
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [clearAll]);

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
   const handleRepeatRound = useCallback(() => {
      setRequirementsMet(false);
      requirementsMetRef.current = false;
      setGameState("playing");
      gameStateRef.current = "playing";
      setFeedback(null);
      setCorrectClicks(0);
      setWrongClicks(0);
      const currentLevelDuration = getLevelDuration(currentLevel);
      setTimeLeft(currentLevelDuration);
      clearAll();
      startLevel();
   }, [startLevel, clearAll, getLevelDuration, currentLevel]);

   // Replay functionality
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setRequirementsMet(false);
      requirementsMetRef.current = false;
      setGameState("playing");
      gameStateRef.current = "playing";
      setFeedback(null);
      setCorrectClicks(0);
      setWrongClicks(0);
      const currentLevelDuration = getLevelDuration(currentLevel);
      setTimeLeft(currentLevelDuration);
      clearAll();
      startLevel();
      setReplaysUsed((prev) => prev + 1);
   }, [
      gameState,
      maxReplays,
      replaysUsed,
      startLevel,
      clearAll,
      getLevelDuration,
      currentLevel,
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
         await registerShare(shareId, "whack-shape");
         const gameKey = "play50games_shared_whack-shape";
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
               title: "Whack-a-Shape Game",
               text: "Check out this awesome Whack-a-Shape game!",
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
         const gameKey = "play50games_shared_whack-shape";
         try {
            const status = await getShareStatus(currentShareId);
            const hasClicks = status.has_clicks || status.clicks > 0;
            if (hasClicks && !hasShared) {
               setHasShared(true);
               setUnlimitedActivated(true);
               setReplaysUsed(0);

               const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes
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
               errorMessage.includes("not found") ||
               errorMessage.includes("404")
            ) {
               // Share doesn't exist, deactivate unlimited
               setHasShared(false);
               setUnlimitedActivated(false);
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
            }
         }
      };

      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000); // Check every 10 seconds

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
            shareCheckIntervalRef.current = null;
         }
      };
   }, [currentShareId, hasShared]);

   // Handle shape click
   const handleShapeClick = useCallback(
      (id: number) => {
         if (gameState !== "playing" || requirementsMet) return;

         const shape = shapes.find((s) => s.id === id);
         if (!shape || shape.clicked) return;

         if (shape.type === targetShape) {
            // Correct click
            setCorrectClicks((prev) => prev + 1);
            levelScoreRef.current += 5;
            setFeedback("correct");
            setTimeout(() => setFeedback(null), 500);
            setShapes((prev) =>
               prev.map((s) => (s.id === id ? { ...s, clicked: true } : s))
            );
            setTimeout(() => {
               setShapes((prev) => prev.filter((s) => s.id !== id));
            }, 200);
         } else {
            // Wrong click
            setWrongClicks((prev) => prev + 1);
            setFeedback("wrong");
            setTimeout(() => setFeedback(null), 500);
            setShapes((prev) =>
               prev.map((s) => (s.id === id ? { ...s, clicked: true } : s))
            );
            setTimeout(() => {
               setShapes((prev) => prev.filter((s) => s.id !== id));
            }, 200);
         }
      },
      [gameState, requirementsMet, shapes, targetShape]
   );

   const progress = ((currentLevel + 1) / maxLevels) * 100;
   const minCorrectClicks = getMinCorrectClicks();

   // Styling functions - using theme colors
   const getNoticeStyle = (): React.CSSProperties => ({
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "12px",
      padding: isMobile ? "24px" : "32px",
      background: "var(--card)",
      border: "1px solid var(--stroke)",
      borderRadius: "16px",
      textAlign: "center",
   });

   const getNoticeBadgeStyle = (tone: "success" | "danger") => {
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
      const textColor = tone === "success" ? "var(--ok)" : "var(--warn)";

      return {
         display: "flex",
         alignItems: "center",
         gap: "8px",
         padding: isMobile ? "10px 16px" : "12px 20px",
         background: `linear-gradient(135deg, ${bgFrom}, ${bgTo})`,
         border: `2px solid ${borderColor}`,
         borderRadius: "12px",
         color: textColor,
         fontSize: isMobile ? "0.95rem" : "1rem",
         fontWeight: 700,
      };
   };

   const getActionButtonStyle = (tone: "success" | "danger") => {
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
         borderRadius: "12px",
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
            ? "rgba(134, 239, 172, 0.4)"
            : "rgba(252, 165, 165, 0.4)";

      if (isEnter) {
         target.style.background = `linear-gradient(135deg, ${bgFrom}, ${bgTo})`;
         target.style.borderColor = borderColor;
         target.style.transform = "translateY(-2px)";
         target.style.boxShadow = `0 4px 12px ${shadowColor}`;
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

   return (
      <>
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               gap: "20px",
               width: "100%",
               maxWidth: "900px",
               margin: "0 auto",
               padding: isMobile ? "16px" : "24px",
            }}
         >
            {/* Header */}
            <div
               style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  padding: isMobile ? "16px" : "20px",
                  background: "var(--card)",
                  border: "1px solid var(--stroke)",
                  borderRadius: "16px",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     justifyContent: "space-between",
                     alignItems: "center",
                     flexWrap: "wrap",
                     gap: "12px",
                  }}
               >
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                     }}
                  >
                     <ArrowPathIcon
                        style={{
                           width: isMobile ? 18 : 20,
                           height: isMobile ? 18 : 20,
                           color: "var(--accent)",
                        }}
                     />
                     Level {currentLevel + 1} / {maxLevels}
                  </div>
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                     }}
                  >
                     <TrophyIcon
                        style={{
                           width: isMobile ? 18 : 20,
                           height: isMobile ? 18 : 20,
                           color: "var(--accent)",
                        }}
                     />
                     Score:{" "}
                     {currentLevel + 1 >= maxLevels && gameState === "ready"
                        ? 100
                        : currentScore}{" "}
                     / 100
                  </div>
               </div>
               <div
                  style={{
                     display: "flex",
                     justifyContent: "space-between",
                     alignItems: "center",
                     flexWrap: "wrap",
                     gap: "8px",
                     fontSize: isMobile ? "0.85rem" : "0.9rem",
                     color: "var(--text)",
                     opacity: 0.8,
                  }}
               >
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                     }}
                  >
                     <ClockIcon
                        style={{
                           width: isMobile ? 16 : 18,
                           height: isMobile ? 16 : 18,
                        }}
                     />
                     Time: {timeLeft}s
                  </div>
                  <div>
                     Correct: {correctClicks} / {minCorrectClicks}
                  </div>
                  <div>Wrong: {wrongClicks}</div>
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
                           "linear-gradient(90deg, var(--accent), #3b82f6)",
                        transition: "width 0.3s ease",
                     }}
                  />
               </div>
            </div>

            {/* Game Area */}
            {(gameState === "playing" || gameState === "paused") && (
               <div
                  style={{
                     position: "relative",
                     width: "100%",
                     height: isMobile ? "300px" : "380px",
                     background: "var(--card)",
                     border: "1px solid var(--stroke)",
                     borderRadius: "16px",
                     overflow: "hidden",
                     pointerEvents: requirementsMet ? "none" : "auto",
                  }}
               >
                  {/* Target Shape Indicator */}
                  <div
                     style={{
                        position: "absolute",
                        top: "16px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        padding: "12px 24px",
                        background:
                           "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                        border: "2px solid rgba(59, 130, 246, 0.6)",
                        borderRadius: "12px",
                        fontSize: isMobile ? "1rem" : "1.2rem",
                        fontWeight: 700,
                        color: "var(--text)",
                        zIndex: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                     }}
                  >
                     <span>Click the</span>
                     <div
                        style={{
                           width: isMobile ? "32px" : "40px",
                           height: isMobile ? "32px" : "40px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                        }}
                     >
                        {targetShape === "circle" && (
                           <div
                              style={{
                                 width: "100%",
                                 height: "100%",
                                 borderRadius: "50%",
                                 background:
                                    "linear-gradient(135deg, #3b82f6, #2563eb)",
                                 border: "2px solid rgba(255, 255, 255, 0.3)",
                              }}
                           />
                        )}
                        {targetShape === "square" && (
                           <div
                              style={{
                                 width: "100%",
                                 height: "100%",
                                 background:
                                    "linear-gradient(135deg, #3b82f6, #2563eb)",
                                 border: "2px solid rgba(255, 255, 255, 0.3)",
                                 borderRadius: "4px",
                              }}
                           />
                        )}
                        {targetShape === "triangle" && (
                           <div
                              style={{
                                 width: 0,
                                 height: 0,
                                 borderLeft: `${
                                    isMobile ? "16px" : "20px"
                                 } solid transparent`,
                                 borderRight: `${
                                    isMobile ? "16px" : "20px"
                                 } solid transparent`,
                                 borderBottom: `${
                                    isMobile ? "28px" : "35px"
                                 } solid #3b82f6`,
                              }}
                           />
                        )}
                     </div>
                     <span>shape!</span>
                  </div>

                  {/* Shapes */}
                  {shapes.map((shape) => (
                     <button
                        key={shape.id}
                        onClick={() => handleShapeClick(shape.id)}
                        disabled={shape.clicked || requirementsMet}
                        style={{
                           position: "absolute",
                           left: `${shape.x}px`,
                           top: `${shape.y}px`,
                           width: `${(isMobile ? 48 : 54) * shape.size}px`,
                           height: `${(isMobile ? 48 : 54) * shape.size}px`,
                           background: "transparent",
                           border: "none",
                           cursor:
                              shape.clicked || requirementsMet
                                 ? "default"
                                 : "pointer",
                           transform: `rotate(${shape.rotation}deg)`,
                           transition: shape.clicked ? "all 0.2s ease" : "none",
                           opacity: shape.clicked ? 0 : 1,
                           zIndex: 5,
                           padding: 0,
                        }}
                     >
                        {shape.type === "circle" && (
                           <div
                              style={{
                                 width: "100%",
                                 height: "100%",
                                 borderRadius: "50%",
                                 background:
                                    "linear-gradient(135deg, #3b82f6, #2563eb)",
                                 border: "2px solid rgba(255, 255, 255, 0.3)",
                                 boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                              }}
                           />
                        )}
                        {shape.type === "square" && (
                           <div
                              style={{
                                 width: "100%",
                                 height: "100%",
                                 background:
                                    "linear-gradient(135deg, #3b82f6, #2563eb)",
                                 border: "2px solid rgba(255, 255, 255, 0.3)",
                                 borderRadius: "8px",
                                 boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                              }}
                           />
                        )}
                        {shape.type === "triangle" && (
                           <div
                              style={{
                                 width: 0,
                                 height: 0,
                                 borderLeft: `${
                                    (isMobile ? 24 : 27) * shape.size
                                 }px solid transparent`,
                                 borderRight: `${
                                    (isMobile ? 24 : 27) * shape.size
                                 }px solid transparent`,
                                 borderBottom: `${
                                    (isMobile ? 42 : 47) * shape.size
                                 }px solid #3b82f6`,
                                 filter:
                                    "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))",
                              }}
                           />
                        )}
                     </button>
                  ))}
               </div>
            )}

            {/* Feedback Messages */}
            {feedback === "correct" && gameState === "playing" && (
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "8px",
                     padding: isMobile ? "10px 16px" : "12px 20px",
                     background:
                        "linear-gradient(135deg, rgba(134, 239, 172, 0.2), rgba(134, 239, 172, 0.1))",
                     border: "2px solid rgba(134, 239, 172, 0.6)",
                     borderRadius: "var(--radius)",
                     color: "var(--ok)",
                     fontSize: isMobile ? "0.9rem" : "1rem",
                     fontWeight: 600,
                     width: "100%",
                     justifyContent: "center",
                  }}
               >
                  <CheckCircleIcon style={{ width: 20, height: 20 }} />
                  +1 Correct!
               </div>
            )}

            {feedback === "wrong" && gameState === "playing" && (
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "8px",
                     padding: isMobile ? "10px 16px" : "12px 20px",
                     background:
                        "linear-gradient(135deg, rgba(252, 165, 165, 0.2), rgba(252, 165, 165, 0.1))",
                     border: "2px solid rgba(252, 165, 165, 0.6)",
                     borderRadius: "var(--radius)",
                     color: "var(--warn)",
                     fontSize: isMobile ? "0.9rem" : "1rem",
                     fontWeight: 600,
                     width: "100%",
                     justifyContent: "center",
                  }}
               >
                  <XCircleIcon style={{ width: 20, height: 20 }} />
                  -1 Mistake!
               </div>
            )}

            {/* Paused Message (Requirements Met, Waiting for Timer) */}
            {gameState === "paused" && (
               <div style={getNoticeStyle()}>
                  <div style={getNoticeBadgeStyle("success")}>
                     <CheckCircleIcon style={{ width: 20, height: 20 }} />
                     Requirements Met
                  </div>
                  <div
                     style={{
                        fontSize: "0.9rem",
                        opacity: 0.8,
                        marginTop: "12px",
                     }}
                  >
                     Waiting for timer... {timeLeft}s remaining
                  </div>
               </div>
            )}

            {/* Ready for Next Round Message */}
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
                     Final Score:{" "}
                     {currentLevel + 1 >= maxLevels ? 100 : currentScore}
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
                        marginTop: "12px",
                        fontSize: isMobile ? "0.95rem" : "1.05rem",
                        fontWeight: 600,
                        color: "var(--text)",
                        marginBottom: "18px",
                     }}
                  >
                     Need: {minCorrectClicks} correct clicks
                  </div>
                  <div
                     style={{
                        fontSize: isMobile ? "1.05rem" : "1.1rem",
                        fontWeight: 600,
                        marginBottom: "20px",
                     }}
                  >
                     Score too low.
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
                     border: "1px solid var(--stroke)",
                     borderRadius: "12px",
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
                        borderRadius: "12px",
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
                        borderRadius: "12px",
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
                        }}
                     />
                     <span>{isMobile ? "Share" : "Share for unlimited"}</span>
                  </button>
               </div>
            )}
         </div>
      </>
   );
}
