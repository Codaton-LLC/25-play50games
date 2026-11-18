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
import { registerShare, getShareStatus } from "@/lib/api/share";
import { TOUCH_SURFACE, useRevealOnPlay, useViewport } from "./touch";
import fx from "./speedFx.module.css";
import styles from "./WhackShape.module.css";
import { whackArenaHeight, whackShapeBase } from "./WhackShape.layout";

/** The arena in CSS px as last measured (the classic desktop numbers until the first measurement). */
interface ArenaSize {
   width: number;
   height: number;
}

interface Floater {
   id: number;
   x: number;
   y: number;
   text: string;
   ok: boolean;
}

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
   const viewport = useViewport();
   const { isMobile, isTouch } = viewport;
   const arenaHeight = whackArenaHeight(viewport);
   const shapeBase = whackShapeBase(viewport);
   const shapeBaseRef = useRef(shapeBase);
   shapeBaseRef.current = shapeBase;
   // The arena's live size (spawn bounds and wall bounces follow the drawn box, never a fixed 800 px).
   const arenaRef = useRef<HTMLDivElement | null>(null);
   const arenaSizeRef = useRef<ArenaSize>({ width: 800, height: 380 });
   const rootRef = useRef<HTMLDivElement | null>(null);
   useRevealOnPlay(rootRef, isPlaying);
   // Hit / miss feedback (visual only): floating "+1" at the whacked shape and a flash on the arena edge.
   const [floaters, setFloaters] = useState<Floater[]>([]);
   const floaterIdRef = useRef(0);
   const [flashSeq, setFlashSeq] = useState(0);
   const lastPressRef = useRef(0);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   // the 15 s "link copied" timeouts, cleared on unmount so none fires on an unmounted game
   const shareMsgTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
   useEffect(() => {
      const timers = shareMsgTimersRef.current;
      return () => {
         timers.forEach((id) => clearTimeout(id));
         timers.clear();
      };
   }, []);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max replays: 5 for Shape Pop, unlimited if shared
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

   // Measure the arena whenever it is on screen or resizes (orientation change, banner, keyboard).
   const measureArena = useCallback(() => {
      const el = arenaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
         arenaSizeRef.current = { width: rect.width, height: rect.height };
      }
   }, []);

   const arenaVisible = gameState === "playing" || gameState === "paused";
   useEffect(() => {
      if (!arenaVisible) return;
      measureArena();
      const el = arenaRef.current;
      if (!el || typeof ResizeObserver === "undefined") {
         window.addEventListener("resize", measureArena);
         return () => window.removeEventListener("resize", measureArena);
      }
      const ro = new ResizeObserver(() => measureArena());
      ro.observe(el);
      return () => ro.disconnect();
   }, [arenaVisible, arenaHeight, measureArena]);

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

         // Random position in the arena as drawn (avoid edges); x/y is the shape's centre
         measureArena();
         const { width: arenaWidth, height: arenaHeightNow } = arenaSizeRef.current;
         const x = Math.random() * Math.max(1, arenaWidth - 100) + 50;
         const y = Math.random() * Math.max(1, arenaHeightNow - 100) + 50;

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
   }, [gameState, requirementsMet, currentLevel, getItemTTL, measureArena]);

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
            const { width: arenaWidth, height: arenaHeight } = arenaSizeRef.current;
            const itemSize = shapeBaseRef.current;

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
               title: "Shape Spotter Game",
               text: "Check out this awesome Shape Spotter game!",
               url: shareableLink,
            });
            setShareSuccess(true);
            shareMsgTimersRef.current.add(setTimeout(() => setShareSuccess(false), 15000));
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
         shareMsgTimersRef.current.add(setTimeout(() => setShareSuccess(false), 15000));
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
            shareMsgTimersRef.current.add(setTimeout(() => setShareSuccess(false), 15000));
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

         // Visual feedback at the whacked shape (no effect on the rules)
         const ok = shape.type === targetShape;
         const floaterId = floaterIdRef.current++;
         setFloaters((prev) => [
            ...prev,
            { id: floaterId, x: shape.x, y: shape.y, text: ok ? "+1" : "x", ok },
         ]);
         setTimeout(() => {
            setFloaters((prev) => prev.filter((f) => f.id !== floaterId));
         }, 700);
         setFlashSeq((prev) => prev + 1);

         if (ok) {
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

   // Instant activation: the whack is measured on pointerdown (touch, pen and mouse alike), and the click
   // that follows is swallowed; a keyboard activation (click with no pointer first) still works.
   const pressShape = useCallback(
      (e: React.PointerEvent<HTMLButtonElement>, id: number) => {
         if (e.pointerType === "mouse" && e.button !== 0) return;
         e.preventDefault();
         lastPressRef.current = performance.now();
         handleShapeClick(id);
      },
      [handleShapeClick]
   );
   const clickShape = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>, id: number) => {
         if (performance.now() - lastPressRef.current < 600) {
            e.preventDefault();
            return;
         }
         handleShapeClick(id);
      },
      [handleShapeClick]
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
      borderRadius: "16px",
      textAlign: "center",
   });

   // The success strings stay exactly as they were: the final games recolour them gold by matching them.
   const getNoticeBadgeStyle = (tone: "success" | "danger") => {
      const bgFrom =
         tone === "success"
            ? "rgba(134, 239, 172, 0.25)"
            : "color-mix(in srgb, var(--warn) 22%, transparent)";
      const bgTo =
         tone === "success"
            ? "rgba(134, 239, 172, 0.12)"
            : "color-mix(in srgb, var(--warn) 12%, transparent)";
      const borderColor =
         tone === "success"
            ? "rgba(134, 239, 172, 0.6)"
            : "color-mix(in srgb, var(--warn) 60%, transparent)";
      const textColor = tone === "success" ? "var(--ok)" : "var(--warn)";

      return {
         display: "flex",
         alignItems: "center",
         gap: "8px",
         padding: isMobile ? "10px 16px" : "12px 20px",
         background: `linear-gradient(135deg, ${bgFrom}, ${bgTo})`,
         border: `2px solid ${borderColor}`,
         borderRadius: "999px",

         color: textColor,
         fontSize: isMobile ? "0.95rem" : "1rem",
         fontWeight: 700,
      };
   };

   // Press and hover feedback come from the module (fx.pressable, .btnOk): no inline transition here.
   const getActionButtonStyle = (tone: "success" | "danger") => {
      const bgFrom =
         tone === "success"
            ? "rgba(134, 239, 172, 0.25)"
            : "color-mix(in srgb, var(--warn) 22%, transparent)";
      const bgTo =
         tone === "success"
            ? "rgba(134, 239, 172, 0.12)"
            : "color-mix(in srgb, var(--warn) 12%, transparent)";
      const borderColor =
         tone === "success"
            ? "rgba(134, 239, 172, 0.6)"
            : "color-mix(in srgb, var(--warn) 60%, transparent)";

      return {
         padding: isMobile ? "12px 24px" : "14px 28px",
         background: `linear-gradient(135deg, ${bgFrom}, ${bgTo})`,
         border: `2px solid ${borderColor}`,

         fontSize: isMobile ? "1rem" : "1.05rem",
         fontWeight: 700,
         display: "inline-flex",
         alignItems: "center",
         gap: "8px",
      } as React.CSSProperties;
   };

   return (
      <>
         <div
            ref={rootRef}
            className={styles.root}
            style={{
               ...TOUCH_SURFACE,
               // Phones / tablets: room below the game so the page can scroll the engine's score bar to the
               // top (useRevealOnPlay) and the controls clear the fixed cookie banner (live innerHeight, no 100vh).
               minHeight:
                  viewport.width < 1024
                     ? `${Math.max(0, viewport.height - 110)}px`
                     : undefined,
               gap: isMobile ? "12px" : "20px",
               padding: isMobile ? "12px 12px 0" : "24px 24px 0",
               // Wide screens (incl. a landscape tablet): the page ends right under the game, so leave the
               // fixed cookie banner's height (~85 px there) below the Replay / Share row.
               // A short viewport (landscape phone) cannot show the whole game above the banner (~170 px):
               // leave that much room so the Replay / Share row can still be scrolled clear of it.
               paddingBottom: viewport.isShort
                  ? "calc(env(safe-area-inset-bottom) + 180px)"
                  : viewport.width >= 1024
                    ? "calc(env(safe-area-inset-bottom) + 96px)"
                    : undefined,
            }}
         >
            {/* Header */}
            <div
               className={styles.header}
               style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: isMobile ? "8px" : "12px",
                  padding: isMobile ? "12px 14px" : "20px",
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
               <div className={styles.progress}>
                  <div
                     className={styles.progressFill}
                     style={{ transform: `scaleX(${Math.min(1, progress / 100)})` }}
                  />
               </div>
            </div>

            {/* Target Shape Indicator (its own bar, so it never hides a shape) */}
            {(gameState === "playing" || gameState === "paused") && (
               <div
                  className={styles.legend}
                  style={{
                     fontSize: isMobile ? "0.95rem" : "1.2rem",
                     padding: isMobile ? "6px 14px" : "10px 22px",
                  }}
               >
                  <span>{isTouch ? "Tap the" : "Click the"}</span>
                  <div
                     style={{
                        width: isMobile ? "28px" : "40px",
                        height: isMobile ? "28px" : "40px",
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
                                 isMobile ? "14px" : "20px"
                              } solid transparent`,
                              borderRight: `${
                                 isMobile ? "14px" : "20px"
                              } solid transparent`,
                              borderBottom: `${
                                 isMobile ? "24px" : "35px"
                              } solid #3b82f6`,
                           }}
                        />
                     )}
                  </div>
                  <span>shape!</span>
               </div>
            )}

            {/* Game Area */}
            {(gameState === "playing" || gameState === "paused") && (
               <div
                  ref={arenaRef}
                  className={styles.arena}
                  style={{
                     ...TOUCH_SURFACE,
                     height: `${arenaHeight}px`,
                     pointerEvents: requirementsMet ? "none" : "auto",
                  }}
               >
                  {/* Hit / miss flash on the arena edge (re-keyed so it replays on every whack) */}
                  {flashSeq > 0 && feedback && (
                     <div
                        key={flashSeq}
                        className={`${styles.flash} ${
                           feedback === "correct" ? styles.flashOk : styles.flashBad
                        }`}
                     />
                  )}

                  {/* Shapes */}
                  {shapes.map((shape) => (
                     <button
                        key={shape.id}
                        type="button"
                        aria-label={`${shape.type} shape`}
                        className={`${styles.shape} ${
                           shape.clicked
                              ? shape.type === targetShape
                                 ? styles.shapeHit
                                 : styles.shapeMiss
                              : ""
                        }`}
                        onPointerDown={(e) => pressShape(e, shape.id)}
                        onClick={(e) => clickShape(e, shape.id)}
                        onContextMenu={(e) => e.preventDefault()}
                        disabled={shape.clicked || requirementsMet}
                        style={{
                           ...TOUCH_SURFACE,
                           left: `${shape.x}px`,
                           top: `${shape.y}px`,
                           width: `${shapeBase * shape.size}px`,
                           height: `${shapeBase * shape.size}px`,
                           cursor:
                              shape.clicked || requirementsMet
                                 ? "default"
                                 : "pointer",
                           transform: `translate(-50%, -50%) rotate(${shape.rotation}deg)`,
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
                                    shapeBase * 0.5 * shape.size
                                 }px solid transparent`,
                                 borderRight: `${
                                    shapeBase * 0.5 * shape.size
                                 }px solid transparent`,
                                 borderBottom: `${
                                    shapeBase * 0.87 * shape.size
                                 }px solid #3b82f6`,
                                 filter:
                                    "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))",
                              }}
                           />
                        )}
                     </button>
                  ))}

                  {/* Floating "+1" / "x" at the whacked shape */}
                  {floaters.map((f) => (
                     <span
                        key={f.id}
                        className={`${fx.floatScore} ${styles.floater} ${
                           f.ok ? styles.floaterOk : styles.floaterBad
                        }`}
                        style={{ left: `${f.x}px`, top: `${f.y - shapeBase / 2}px` }}
                        aria-hidden="true"
                     >
                        {f.text}
                     </span>
                  ))}

                  {/* Feedback chip, inside the arena so the layout below never jumps */}
                  {feedback === "correct" && gameState === "playing" && (
                     <div
                        className={`${styles.chip} ${styles.chipOk} ${fx.fadeUp}`}
                        role="status"
                     >
                        <CheckCircleIcon style={{ width: 18, height: 18 }} />
                        +1 Correct!
                     </div>
                  )}
                  {feedback === "wrong" && gameState === "playing" && (
                     <div
                        className={`${styles.chip} ${styles.chipBad} ${fx.fadeUp}`}
                        role="status"
                     >
                        <XCircleIcon style={{ width: 18, height: 18 }} />
                        -1 Mistake!
                     </div>
                  )}
               </div>
            )}

            {/* Paused Message (Requirements Met, Waiting for Timer) */}
            {gameState === "paused" && (
               <div style={getNoticeStyle()} className={`${styles.notice} ${fx.staggerIn}`}>
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
               <div style={getNoticeStyle()} className={`${styles.notice} ${fx.staggerIn}`}>
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
                     type="button"
                     onClick={handleNextRound}
                     className={`${styles.btn} ${styles.btnOk} ${fx.pressable}`}
                     style={{ ...getActionButtonStyle("success"), ...TOUCH_SURFACE }}
                  >
                     Next Round
                  </button>
               </div>
            )}

            {/* Game Complete Message */}
            {gameState === "ready" && currentLevel + 1 >= maxLevels && (
               <div style={getNoticeStyle()} className={`${styles.notice} ${fx.staggerIn}`}>
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
               <div style={getNoticeStyle()} className={`${styles.notice} ${fx.staggerIn}`}>
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
                  className={styles.actions}
                  style={{
                     display: "flex",
                     gap: isMobile ? "10px" : "12px",
                     justifyContent: "center",
                     flexWrap: "wrap",
                     padding: isMobile ? "10px" : "16px",
                     background: "var(--card)",
                     borderRadius: "16px",
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
                           borderRadius: "10px",
                           boxSizing: "border-box",
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
                        className={styles.msgInfo}
                        style={{
                           gap: isMobile ? "6px" : "8px",
                           padding: isMobile ? "10px 14px" : "8px 16px",
                           fontSize: isMobile ? "0.85rem" : "0.9rem",
                           marginBottom: "8px",
                        }}
                     >
                        <CheckCircleIcon
                           style={{
                              width: isMobile ? 16 : 18,
                              height: isMobile ? 16 : 18,
                              color: "var(--accent)",
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
                     type="button"
                     onClick={handleReplay}
                     disabled={maxReplays > 0 && replaysUsed >= maxReplays}
                     className={`${styles.btn} ${styles.btnTint} ${fx.pressable}`}
                     style={{
                        ...TOUCH_SURFACE,
                        display: "flex",
                        alignItems: "center",
                        gap: isMobile ? "6px" : "8px",
                        padding: isMobile ? "10px 14px" : "10px 20px",
                        flex: isMobile ? "1 1 0" : "0 0 auto",
                        minWidth: isMobile ? "120px" : undefined,
                        fontSize: isMobile ? "0.9rem" : "0.95rem",
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
                        Replay{" "}
                        {maxReplays === 0
                           ? "(∞)"
                           : `(${maxReplays - replaysUsed}/${maxReplays})`}
                     </span>
                  </button>

                  <button
                     type="button"
                     onClick={handleShare}
                     className={`${styles.btn} ${styles.btnTint} ${fx.pressable}`}
                     style={{
                        ...TOUCH_SURFACE,
                        display: "flex",
                        alignItems: "center",
                        gap: isMobile ? "6px" : "8px",
                        padding: isMobile ? "10px 14px" : "10px 20px",
                        flex: isMobile ? "1 1 0" : "0 0 auto",
                        minWidth: isMobile ? "120px" : undefined,
                        fontSize: isMobile ? "0.9rem" : "0.95rem",
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
