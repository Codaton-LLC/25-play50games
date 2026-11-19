"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useGameTimers } from "../useGameTimers";
import {
   CheckCircleIcon,
   XCircleIcon,
   ArrowPathIcon,
   TrophyIcon,
   ClockIcon,
   ShareIcon,
   ArrowPathRoundedSquareIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

import touch from "./skillTouch.module.css";
import ui from "./skillUi.module.css";
import { usePlayAreaInView } from "./usePlayAreaInView";
import { useRipples } from "./useRipples";

interface TargetAimProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function TargetAim({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: TargetAimProps) {
   const defaultLevelDuration = 20; // seconds per level
   const levelRequirements = config?.levelRequirements || null;
   const configuredLevels = config?.levels ? Number(config.levels) : 0;
   const requirementsCount = Array.isArray(levelRequirements)
      ? levelRequirements.length
      : 0;
   const maxLevels = Math.max(configuredLevels, requirementsCount) || 15;

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
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   type Target = {
      id: number;
      x: number;
      y: number;
      size: number;
      speed: number;
      vx: number;
      vy: number;
      clicked: boolean;
      createdAt: number;
      initialSize: number;
   };

   // Target state
   const [targets, setTargets] = useState<Target[]>([]);
   const [targetsHit, setTargetsHit] = useState(0);
   const [targetsMissed, setTargetsMissed] = useState(0);

   // Target icon (sheja) position - moves with keyboard or mouse
   const [targetIconX, setTargetIconX] = useState(0); // relative to arena center
   const [targetIconY, setTargetIconY] = useState(0); // relative to arena center
   const targetIconSpeed = 8; // pixels per frame
   const keysPressedRef = useRef<Set<string>>(new Set());
   const arenaRef = useRef<HTMLDivElement>(null);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   // Hides the "shared" notice after 15 s; cleared on unmount
   const shareSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
   );
   useEffect(
      () => () => {
         if (shareSuccessTimeoutRef.current) {
            clearTimeout(shareSuccessTimeoutRef.current);
         }
      },
      []
   );
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited

   const animationFrameRef = useRef<number | null>(null);
   const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
   const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
   const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   const gameStateRef = useRef<"playing" | "ready" | "failed" | "paused">(
      "playing"
   );
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<((level: number) => void) | null>(null);
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   // Completion and "unlimited replays" timers that must not outlive the game
   const { completeLater, expireLater } = useGameTimers();
   const lastTimestampRef = useRef<number>(0);
   const lastSpawnTimeRef = useRef<number>(0);
   const nextRoundClickedRef = useRef(false);

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

   // Mobile/tablet: bring the panel and the play area on screen when a round starts
   const rootRef = useRef<HTMLDivElement>(null);
   const pad = usePlayAreaInView(rootRef, arenaRef, true, `${gameState}-${currentLevel}`);
   const { addRipple, rippleLayer } = useRipples();

   // Clear all timers
   const clearAll = useCallback(() => {
      if (animationFrameRef.current) {
         cancelAnimationFrame(animationFrameRef.current);
         animationFrameRef.current = null;
      }
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }
      if (spawnTimerRef.current) {
         clearInterval(spawnTimerRef.current);
         spawnTimerRef.current = null;
      }
      if (startTimeoutRef.current) {
         clearTimeout(startTimeoutRef.current);
         startTimeoutRef.current = null;
      }
   }, []);

   useEffect(() => {
      if (!isPlaying) {
         clearAll();
         return;
      }

      // Game started - reset state
      prevLevelRef.current = -1;
      forceStartLevelRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      completionCalledRef.current = false;
      setCurrentLevel(0);
      setCurrentScore(0);
      setRequirementsMet(false);
      setGameState("playing");
      setTargets([]);
      setTargetsHit(0);
      setTargetsMissed(0);
   }, [isPlaying, clearAll]);

   // Get level configuration
   const getLevelConfig = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            const req = levelRequirements[level];
            return {
               minTargetsHit: req.minTargetsHit || 5 + level * 2,
               targetSize: req.targetSize || Math.max(40, 60 - level * 2),
               targetSpeed: req.targetSpeed || 0.5 + level * 0.1,
               spawnInterval:
                  req.spawnInterval || Math.max(800, 1500 - level * 50),
               targetLifetime:
                  req.targetLifetime || Math.max(2000, 4000 - level * 150),
               movingTargets:
                  req.movingTargets !== undefined
                     ? req.movingTargets
                     : level >= 5,
               multipleTargets:
                  req.multipleTargets !== undefined
                     ? req.multipleTargets
                     : level >= 8,
               shrinkingTargets:
                  req.shrinkingTargets !== undefined
                     ? req.shrinkingTargets
                     : level >= 10,
            };
         }
         // Default progression
         return {
            minTargetsHit: 5 + level * 2,
            targetSize: Math.max(40, 60 - level * 2),
            targetSpeed: 0.5 + level * 0.1,
            spawnInterval: Math.max(800, 1500 - level * 50),
            targetLifetime: Math.max(2000, 4000 - level * 150),
            movingTargets: level >= 5,
            multipleTargets: level >= 8,
            shrinkingTargets: level >= 10,
         };
      },
      [levelRequirements]
   );

   // Get minimum targets hit required for current level
   const getMinTargetsHit = useCallback(() => {
      const config = getLevelConfig(currentLevel);
      return config.minTargetsHit;
   }, [currentLevel, getLevelConfig]);

   // Start level
   const startLevel = useCallback(
      (level: number) => {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         if (spawnTimerRef.current) {
            clearInterval(spawnTimerRef.current);
            spawnTimerRef.current = null;
         }

         // Reset all state before starting new level
         setTargetsHit(0);
         setTargetsMissed(0);
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         nextRoundClickedRef.current = false;
         setTargets([]);
         setTargetIconX(0);
         setTargetIconY(0);
         keysPressedRef.current.clear();

         const levelDur = getLevelDuration(level);
         setTimeLeft(levelDur);

         // Set game state to playing AFTER resetting timeLeft
         gameStateRef.current = "playing";
         setGameState("playing");

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

         const levelConfig = getLevelConfig(level);
         lastSpawnTimeRef.current = Date.now();

         // Start spawning targets
         const spawnTarget = () => {
            if (
               gameStateRef.current !== "playing" ||
               requirementsMetRef.current
            ) {
               return;
            }

            const arena = arenaRef.current;
            if (!arena) return;

            // Use arena size same as visible game area
            const rect = arena.getBoundingClientRect();
            const arenaWidth = rect.width;
            const arenaHeight = rect.height;

            const targetSize = levelConfig.targetSize;
            const speed = levelConfig.targetSpeed;
            const isMoving = levelConfig.movingTargets;

            // Random starting position
            const x = Math.random() * (arenaWidth - targetSize);
            const y = Math.random() * (arenaHeight - targetSize);

            // Random velocity for moving targets
            const vx = isMoving ? (Math.random() * 2 - 1) * speed : 0;
            const vy = isMoving ? (Math.random() * 2 - 1) * speed : 0;

            const now = Date.now();
            const newTarget = {
               id: now + Math.random(),
               x,
               y,
               size: targetSize,
               speed,
               vx,
               vy,
               clicked: false,
               createdAt: now,
               initialSize: targetSize,
            };

            setTargets((prev) => [...prev, newTarget]);

            // Remove target after lifetime
            setTimeout(() => {
               setTargets((prev) => {
                  // Inspect the current target: a click replaces the object,
                  // so newTarget.clicked would always be false here.
                  const current = prev.find((t) => t.id === newTarget.id);
                  if (!current) return prev;
                  const updated = prev.filter((t) => t.id !== newTarget.id);
                  if (!current.clicked) {
                     setTargetsMissed((prevMissed) => prevMissed + 1);
                  }
                  return updated;
               });
            }, levelConfig.targetLifetime);
         };

         // Initial spawn
         spawnTarget();

         // Spawn multiple targets if enabled
         if (levelConfig.multipleTargets) {
            setTimeout(() => spawnTarget(), levelConfig.spawnInterval / 2);
         }

         // Spawn timer
         spawnTimerRef.current = setInterval(() => {
            if (
               gameStateRef.current === "playing" &&
               !requirementsMetRef.current
            ) {
               spawnTarget();
               if (levelConfig.multipleTargets) {
                  setTimeout(
                     () => spawnTarget(),
                     levelConfig.spawnInterval / 2
                  );
               }
            }
         }, levelConfig.spawnInterval);
      },
      [getLevelDuration, getLevelConfig]
   );

   startLevelRef.current = startLevel;

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Handle keyboard input for WASD and Arrow keys movement
   useEffect(() => {
      if (gameState !== "playing" || !isPlaying) return;

      const handleKeyDown = (e: KeyboardEvent) => {
         const key = e.key.toLowerCase();
         // WASD keys
         if (key === "w" || key === "a" || key === "s" || key === "d") {
            keysPressedRef.current.add(key);
            e.preventDefault();
         }
         // Arrow keys
         else if (e.key === "ArrowUp") {
            keysPressedRef.current.add("w");
            e.preventDefault();
         } else if (e.key === "ArrowLeft") {
            keysPressedRef.current.add("a");
            e.preventDefault();
         } else if (e.key === "ArrowDown") {
            keysPressedRef.current.add("s");
            e.preventDefault();
         } else if (e.key === "ArrowRight") {
            keysPressedRef.current.add("d");
            e.preventDefault();
         }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
         const key = e.key.toLowerCase();
         // WASD keys
         if (key === "w" || key === "a" || key === "s" || key === "d") {
            keysPressedRef.current.delete(key);
         }
         // Arrow keys
         else if (e.key === "ArrowUp") {
            keysPressedRef.current.delete("w");
         } else if (e.key === "ArrowLeft") {
            keysPressedRef.current.delete("a");
         } else if (e.key === "ArrowDown") {
            keysPressedRef.current.delete("s");
         } else if (e.key === "ArrowRight") {
            keysPressedRef.current.delete("d");
         }
      };

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      return () => {
         window.removeEventListener("keydown", handleKeyDown);
         window.removeEventListener("keyup", handleKeyUp);
      };
   }, [gameState, isPlaying]);

   // Handle target click
   const handleTargetClick = useCallback(
      (targetId: number) => {
         if (gameState !== "playing" || requirementsMet) return;

         setTargets((prev) =>
            prev.map((target) =>
               target.id === targetId ? { ...target, clicked: true } : target
            )
         );

         setTargetsHit((prev) => {
            const newCount = prev + 1;
            const minTargetsHit = getMinTargetsHit();
            if (newCount >= minTargetsHit && !requirementsMetRef.current) {
               // IMMEDIATELY freeze game
               clearAll();
               setTimeLeft(0);
               requirementsMetRef.current = true;
               setRequirementsMet(true);
               setGameState("paused");
            }
            return newCount;
         });

         // Remove target after click animation
         setTimeout(() => {
            setTargets((prev) => prev.filter((t) => t.id !== targetId));
         }, 200);
      },
      [gameState, requirementsMet, getMinTargetsHit, clearAll]
   );

   // Handle Enter/Space to hit nearest target
   useEffect(() => {
      if (gameState !== "playing" || !isPlaying || requirementsMet) return;

      const handleKeyPress = (e: KeyboardEvent) => {
         if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();

            const arena = arenaRef.current;
            if (!arena) return;

            const rect = arena.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // Target icon position (relative to center)
            const targetIconPosX = centerX + targetIconX;
            const targetIconPosY = centerY + targetIconY;

            // Find nearest target to target icon position
            let nearestTarget: Target | null = null;
            let minDistance = Infinity;

            for (const target of targets) {
               if (target.clicked) continue;

               // Calculate target center position
               const targetCenterX = target.x + target.size / 2;
               const targetCenterY = target.y + target.size / 2;

               // Calculate distance from target icon position
               const distance = Math.sqrt(
                  Math.pow(targetCenterX - targetIconPosX, 2) +
                     Math.pow(targetCenterY - targetIconPosY, 2)
               );

               // Check if target is within clickable range (target size)
               if (distance < target.size && distance < minDistance) {
                  minDistance = distance;
                  nearestTarget = target;
               }
            }

            if (nearestTarget) {
               const targetId: number = nearestTarget.id;
               handleTargetClick(targetId);
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [
      gameState,
      isPlaying,
      requirementsMet,
      targets,
      targetIconX,
      targetIconY,
      handleTargetClick,
   ]);

   // Animation loop
   useEffect(() => {
      if (gameState !== "playing" || !isPlaying) {
         if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
         }
         return;
      }

      const animate = (timestamp: number) => {
         if (!animationFrameRef.current) return;

         const dt = (timestamp - lastTimestampRef.current) / 1000;
         lastTimestampRef.current = timestamp;

         if (dt > 0.1) {
            animationFrameRef.current = requestAnimationFrame(animate);
            return;
         }

         const levelConfig = getLevelConfig(currentLevel);

         // Update target icon (sheja) position based on WASD keys
         const arena = arenaRef.current;
         if (arena) {
            const rect = arena.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            let deltaX = 0;
            let deltaY = 0;

            // Keyboard movement
            if (keysPressedRef.current.has("a")) {
               deltaX -= targetIconSpeed;
            }
            if (keysPressedRef.current.has("d")) {
               deltaX += targetIconSpeed;
            }
            if (keysPressedRef.current.has("w")) {
               deltaY -= targetIconSpeed;
            }
            if (keysPressedRef.current.has("s")) {
               deltaY += targetIconSpeed;
            }

            // Apply movement and clamp to arena bounds
            if (deltaX !== 0 || deltaY !== 0) {
               setTargetIconX((prev) => {
                  const newX = prev + deltaX;
                  const maxX = centerX - 20; // Keep icon within bounds
                  return Math.max(-maxX, Math.min(maxX, newX));
               });

               setTargetIconY((prev) => {
                  const newY = prev + deltaY;
                  const maxY = centerY - 20; // Keep icon within bounds
                  return Math.max(-maxY, Math.min(maxY, newY));
               });
            }
         }

         // Update targets position
         setTargets((prev) =>
            prev.map((target) => {
               if (target.clicked) return target;

               const arena = arenaRef.current;
               if (!arena) return target;

               // Use arena size same as visible game area
               const rect = arena.getBoundingClientRect();
               const arenaWidth = rect.width;
               const arenaHeight = rect.height;

               let newX = target.x + target.vx * dt * 100;
               let newY = target.y + target.vy * dt * 100;
               let newVx = target.vx;
               let newVy = target.vy;

               // Bounce off walls
               if (newX <= 0 || newX >= arenaWidth - target.size) {
                  newVx = -newVx;
                  newX = Math.max(0, Math.min(arenaWidth - target.size, newX));
               }
               if (newY <= 0 || newY >= arenaHeight - target.size) {
                  newVy = -newVy;
                  newY = Math.max(0, Math.min(arenaHeight - target.size, newY));
               }

               // Shrinking targets
               let newSize = target.size;
               if (levelConfig.shrinkingTargets) {
                  const age = Date.now() - target.createdAt;
                  const shrinkRate = 0.3; // Shrink to 30% of original size
                  const shrinkTime = levelConfig.targetLifetime * 0.7; // Start shrinking at 70% of lifetime
                  if (age > shrinkTime) {
                     const shrinkProgress = Math.min(
                        1,
                        (age - shrinkTime) /
                           (levelConfig.targetLifetime - shrinkTime)
                     );
                     newSize =
                        target.initialSize *
                        (1 - shrinkProgress * (1 - shrinkRate));
                  }
               }

               return {
                  ...target,
                  x: newX,
                  y: newY,
                  vx: newVx,
                  vy: newVy,
                  size: newSize,
               };
            })
         );

         animationFrameRef.current = requestAnimationFrame(animate);
      };

      lastTimestampRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(animate);

      return () => {
         if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
         }
      };
   }, [gameState, isPlaying, currentLevel, getLevelConfig, targetIconSpeed]);

   // End level
   const endLevel = useCallback(() => {
      if (requirementsMetRef.current) return;
      if (gameStateRef.current !== "playing") return; // Don't end if already in ready/failed state
      // Don't end level if timeLeft is still at initial value (level just started)
      if (timeLeft >= getLevelDuration(currentLevel) - 1) return;
      clearAll();

      const minTargetsHit = getMinTargetsHit();
      const levelPassed = targetsHit >= minTargetsHit;

      if (levelPassed) {
         requirementsMetRef.current = true;
         setRequirementsMet(true);
         const roundScore = Math.round(100 / maxLevels);
         const completedLevels = currentLevel + 1;
         const newScore = Math.min(100, completedLevels * roundScore);
         setCurrentScore(newScore);
         setTimeout(() => {
            onScoreUpdate(newScore);
         }, 0);

         if (completedLevels >= maxLevels) {
            setGameState("ready");
         } else {
            setGameState("ready");
         }
      } else {
         setGameState("failed");
      }
   }, [
      clearAll,
      targetsHit,
      getMinTargetsHit,
      currentLevel,
      maxLevels,
      onScoreUpdate,
      timeLeft,
      getLevelDuration,
   ]);

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Check if requirements are met
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const minTargetsHit = getMinTargetsHit();

      if (targetsHit >= minTargetsHit) {
         // IMMEDIATELY freeze game
         clearAll();
         setTimeLeft(0);

         requirementsMetRef.current = true;
         setRequirementsMet(true);
         setGameState("paused");
      }
   }, [targetsHit, gameState, requirementsMet, getMinTargetsHit, clearAll]);

   // When timer reaches 0 and requirements are met
   useEffect(() => {
      if (timeLeft === 0 && requirementsMet && gameState === "paused") {
         setGameState("ready");
         if (currentLevel + 1 < maxLevels) {
            const roundScore = Math.round(100 / maxLevels);
            const completedLevels = currentLevel + 1;
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            setTimeout(() => {
               onScoreUpdate(newScore);
            }, 0);
         }
      } else if (
         timeLeft === 0 &&
         !requirementsMet &&
         gameState === "playing" &&
         gameStateRef.current === "playing" &&
         targetsHit > 0
      ) {
         // Only end level if we're actually playing, timer ran out, AND we've hit at least one target
         // This prevents "failed" from showing when level just started
         endLevel();
      }
   }, [
      timeLeft,
      requirementsMet,
      gameState,
      endLevel,
      targetsHit,
      currentLevel,
      maxLevels,
      onScoreUpdate,
   ]);

   const finalizeGame = useCallback(() => {
      if (completionCalledRef.current) return;
      completionCalledRef.current = true;

      const finalScore = 100;
      setCurrentScore(finalScore);
      setGameState("ready");
      onScoreUpdate(finalScore);

      completeLater(() => {
         onComplete(finalScore);
      }, 1000);
   }, [onComplete, onScoreUpdate]);

   // Auto-complete when final level is ready
   useEffect(() => {
      if (
         gameState === "ready" &&
         currentLevel + 1 >= maxLevels &&
         requirementsMet &&
         !completionCalledRef.current
      ) {
         finalizeGame();
      }
   }, [gameState, currentLevel, maxLevels, requirementsMet, finalizeGame]);

   // Handle next round button click
   const handleNextRound = useCallback(() => {
      if (gameState !== "ready") return;
      if (nextRoundClickedRef.current) return;
      if (currentLevel + 1 < maxLevels) {
         nextRoundClickedRef.current = true;
         if (!requirementsMetRef.current) {
            const roundScore = Math.round(100 / maxLevels);
            const completedLevels = currentLevel + 1;
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            setTimeout(() => {
               onScoreUpdate(newScore);
            }, 0);
         }

         // Clear all timers and reset state
         clearAll();
         setTargets([]);
         setTargetsHit(0);
         setTargetsMissed(0);
         setRequirementsMet(false);
         requirementsMetRef.current = false;

         // Set next level
         forceStartLevelRef.current = currentLevel + 1;
         setCurrentLevel((prev) => prev + 1);

         // Reset game state - will be set to "playing" when startLevel is called
         gameStateRef.current = "ready";
         setGameState("ready");
      }
   }, [
      gameState,
      currentLevel,
      maxLevels,
      onScoreUpdate,
      finalizeGame,
      clearAll,
   ]);

   // Handle replay
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setRequirementsMet(false);
      requirementsMetRef.current = false;
      setGameState("playing");
      gameStateRef.current = "playing";
      setTargets([]);
      setTargetsHit(0);
      setTargetsMissed(0);
      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      clearAll();
      startLevel(currentLevel);
      if (maxReplays > 0) {
         setReplaysUsed((prev) => prev + 1);
      }
   }, [
      gameState,
      maxReplays,
      replaysUsed,
      startLevel,
      currentLevel,
      getLevelDuration,
      clearAll,
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
         await registerShare(shareId, "target-aim");
         const gameKey = "play50games_shared_target-aim";
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
               title: "Target Aim Game",
               text: "Check out this awesome Target Aim game!",
               url: shareableLink,
            });
            setShareSuccess(true);
            if (shareSuccessTimeoutRef.current) {
               clearTimeout(shareSuccessTimeoutRef.current);
            }
            shareSuccessTimeoutRef.current = setTimeout(
               () => setShareSuccess(false),
               15000
            );
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
         if (shareSuccessTimeoutRef.current) {
            clearTimeout(shareSuccessTimeoutRef.current);
         }
         shareSuccessTimeoutRef.current = setTimeout(
            () => setShareSuccess(false),
            15000
         );
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
            if (shareSuccessTimeoutRef.current) {
               clearTimeout(shareSuccessTimeoutRef.current);
            }
            shareSuccessTimeoutRef.current = setTimeout(
               () => setShareSuccess(false),
               15000
            );
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
         const gameKey = "play50games_shared_target-aim";
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

               expireLater(() => {
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
                  shareCheckIntervalRef.current = null;
               }
            }
         }
      };

      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000);

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
            shareCheckIntervalRef.current = null;
         }
      };
   }, [currentShareId, hasShared]);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_target-aim";
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
                              expireLater(() => {
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
                                 shared: true,
                              })
                           );
                           expireLater(() => {
                              setUnlimitedActivated(false);
                              setHasShared(false);
                              localStorage.removeItem(gameKey);
                           }, 15 * 60 * 1000);
                        }
                     }
                  } catch (error) {
                     localStorage.removeItem(gameKey);
                     setCurrentShareId(null);
                  }
               };
               verifyShare();
            }
         } catch (error) {
            localStorage.removeItem(gameKey);
         }
      }

      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
         trackShareClick(sharedBy);
         const stored = localStorage.getItem(gameKey);
         if (stored) {
            try {
               const data = JSON.parse(stored);
               if (data.share_id === sharedBy) {
                  setCurrentShareId(sharedBy);
               }
            } catch (error) {
               // Error parsing stored data
            }
         }
      }
   }, []);

   // Start level when currentLevel changes
   useEffect(() => {
      if (!isPlaying) return;

      if (prevLevelRef.current === currentLevel) return;

      prevLevelRef.current = currentLevel;

      // Reset state before starting new level
      setTargets([]);
      setTargetsHit(0);
      setTargetsMissed(0);
      setRequirementsMet(false);
      requirementsMetRef.current = false;

      // Don't set gameState to "playing" here - let startLevel do it after resetting timeLeft
      // This prevents endLevel from being called with timeLeft = 0
      gameStateRef.current = "ready";
      setGameState("ready");

      if (currentLevel === 0) {
         startTimeoutRef.current = setTimeout(() => {
            if (startLevelRef.current) {
               startLevelRef.current(0);
            }
         }, 0);
      } else {
         startTimeoutRef.current = setTimeout(() => {
            if (startLevelRef.current) {
               startLevelRef.current(currentLevel);
            }
         }, 1200);
      }

      return () => {
         if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
         }
      };
   }, [currentLevel, isPlaying]);

   const levelConfig = getLevelConfig(currentLevel);
   const progress = ((currentLevel + 1) / maxLevels) * 100;
   const minTargetsHit = getMinTargetsHit();

   const replayLocked = maxReplays > 0 && replaysUsed >= maxReplays;

   return (
      <>
         <div ref={rootRef} className={ui.root}>
            {/* Header */}
            <div className={ui.hud}>
               <div className={ui.hudRow}>
                  <span className={ui.hudStat}>
                     Level {currentLevel + 1}/{maxLevels}
                  </span>
                  <span className={ui.hudStat}>
                     <TrophyIcon className={ui.hudIconOk} />
                     Score:{" "}
                     {requirementsMet && currentLevel + 1 >= maxLevels
                        ? 100
                        : currentScore}{" "}
                     / 100
                  </span>
                  <span
                     className={`${ui.hudStat} ${gameState === "playing" && timeLeft <= 5 ? ui.hudLow : ""}`}
                  >
                     <ClockIcon className={ui.hudIconAccent} />
                     {timeLeft}s
                  </span>
               </div>
               {/* Progress Bar */}
               <div className={ui.progressTrack}>
                  <div
                     className={ui.progressFill}
                     style={{ transform: `scaleX(${progress / 100})` }}
                  />
               </div>
            </div>

            {/* Hit and Missed Stats */}
            {(gameState === "playing" || gameState === "paused") && (
               <div className={ui.statRow}>
                  <div className={ui.statOk}>
                     <CheckCircleIcon className={ui.statIconOk} />
                     <span>
                        Hit:{" "}
                        <span key={targetsHit} className={ui.bump}>
                           {targetsHit}
                        </span>{" "}
                        / {minTargetsHit}
                     </span>
                  </div>
                  <div className={ui.statWarn}>
                     <XCircleIcon className={ui.statIconWarn} />
                     <span>
                        Missed:{" "}
                        <span key={targetsMissed} className={ui.bump}>
                           {targetsMissed}
                        </span>
                     </span>
                  </div>
               </div>
            )}

            {/* Game Arena */}
            {gameState === "playing" || gameState === "paused" ? (
               <div
                  ref={arenaRef}
                  className={`${ui.arena} ${touch.tapArea}`}
                  data-play-area=""
                  onPointerDown={(e) => addRipple(e)}
                  style={{
                     height: isMobile ? "300px" : "380px",
                     /* the frame is an inset ring, not a border: the targets bounce inside the
                        arena's full bounding box, so a border would cover their edges */
                     border: "none",
                     boxShadow: "inset 0 0 0 1px rgba(var(--board-ov, 255, 255, 255), 0.12)",
                     cursor: "crosshair", // Crosshair cursor (plus sign)
                  }}
               >
                  <div
                     style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                     }}
                  >
                     {targets.map((target) => (
                        <div
                           key={target.id}
                           className={touch.hitSlop}
                           onPointerDown={(e) => {
                              // hit on press: a moving target can slip away before a tap's release
                              e.stopPropagation();
                              if (!target.clicked) handleTargetClick(target.id);
                           }}
                           style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              width: `${target.size}px`,
                              height: `${target.size}px`,
                              borderRadius: "50%",
                              background: target.clicked
                                 ? "var(--ok)"
                                 : "radial-gradient(circle, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))",
                              border: "3px solid rgba(var(--board-ov, 255, 255, 255), 0.8)",
                              boxShadow: "0 3px 8px rgba(var(--board-shade, 0, 0, 0), calc(0.35 * var(--board-shade-k, 1)))",
                              cursor: "pointer",
                              transition: target.clicked
                                 ? "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease"
                                 : "none",
                              /* moved by transform (no layout per frame); the pointer hit follows it */
                              transform: `translate3d(${target.x}px, ${target.y}px, 0) scale(${target.clicked ? 1.35 : 1})`,
                              opacity: target.clicked ? 0 : 1,
                              pointerEvents: target.clicked ? "none" : "auto",
                           }}
                        />
                     ))}
                  </div>
                  {rippleLayer}
                  {/* Target Icon (Sheja) - moves with keyboard or mouse */}
                  <div
                     style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        transform: `translate(calc(${targetIconX}px - 50%), calc(${targetIconY}px - 50%))`,
                        width: "24px",
                        height: "24px",
                        pointerEvents: "none",
                        zIndex: 10,
                     }}
                  >
                     {/* Outer circle */}
                     <div
                        style={{
                           position: "absolute",
                           inset: 0,
                           borderRadius: "50%",
                           border: "2px solid rgba(var(--board-ov, 255, 255, 255), 0.9)",
                           boxShadow: "0 0 0 1px rgba(var(--board-shade, 0, 0, 0), calc(0.35 * var(--board-shade-k, 1)))",
                        }}
                     />
                     {/* Inner crosshair */}
                     <div
                        style={{
                           position: "absolute",
                           left: "50%",
                           top: "50%",
                           transform: "translate(-50%, -50%)",
                           width: "2px",
                           height: "12px",
                           background: "rgba(var(--board-ov, 255, 255, 255), 0.9)",
                        }}
                     />
                     <div
                        style={{
                           position: "absolute",
                           left: "50%",
                           top: "50%",
                           transform: "translate(-50%, -50%) rotate(90deg)",
                           width: "2px",
                           height: "12px",
                           background: "rgba(var(--board-ov, 255, 255, 255), 0.9)",
                        }}
                     />
                     {/* Center dot */}
                     <div
                        style={{
                           position: "absolute",
                           left: "50%",
                           top: "50%",
                           transform: "translate(-50%, -50%)",
                           width: "4px",
                           height: "4px",
                           borderRadius: "50%",
                           background: "rgba(var(--board-ov, 255, 255, 255), 0.9)",
                        }}
                     />
                  </div>
               </div>
            ) : null}

            {/* Ready for Next Round Message */}
            {gameState === "ready" && currentLevel + 1 < maxLevels && (
               <div className={ui.card}>
                  <div className={ui.cardTitleOk} style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                     <CheckCircleIcon style={{ width: 20, height: 20 }} />
                     Level {currentLevel + 1} Complete
                  </div>
                  <div className={ui.cardBody}>Are you ready for next round?</div>
                  <button className={ui.buttonPrimary} onClick={handleNextRound}>
                     Next Round
                  </button>
               </div>
            )}

            {/* Game Complete Message */}
            {gameState === "ready" &&
               currentLevel + 1 >= maxLevels &&
               requirementsMet && (
                  <div className={ui.card}>
                     <div className={ui.cardTitleOk} style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                        <TrophyIcon style={{ width: 20, height: 20 }} />
                        Game Complete!
                     </div>
                     <div className={ui.cardBody}>All {maxLevels} levels completed!</div>
                     <div className={ui.cardBody}>
                        Final Score: <strong>100</strong>
                     </div>
                  </div>
               )}

            {/* Level Failed Message */}
            {gameState === "failed" && (
               <div className={ui.card}>
                  <div className={ui.cardTitleWarn} style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                     <XCircleIcon style={{ width: 20, height: 20 }} />
                     Level {currentLevel + 1} Failed
                  </div>
                  <div className={ui.cardBody}>
                     Need: <strong>{minTargetsHit}</strong> targets hit
                  </div>
                  <div className={ui.cardBody}>
                     You hit: <strong>{targetsHit}</strong> targets
                  </div>
               </div>
            )}

            {/* Action Buttons: Replay, Share */}
            <div className={ui.actions}>
               {/* Share Success Message */}
               {shareSuccess && !unlimitedActivated && (
                  <div className={ui.notice}>
                     Link copied! Unlimited replay will unlock when someone
                     opens your link!
                  </div>
               )}

               {/* Unlimited Activated Message */}
               {unlimitedActivated && (
                  <div className={ui.notice}>
                     <CheckCircleIcon className={ui.noticeIcon} />
                     <span>
                        Someone opened your link! Unlimited replay is now
                        active for 15 minutes!
                     </span>
                  </div>
               )}

               <button
                  className={ui.button}
                  onClick={handleReplay}
                  disabled={replayLocked}
               >
                  <ArrowPathRoundedSquareIcon className={ui.buttonIcon} />
                  <span>
                     {"Replay "}
                     {maxReplays === 0
                        ? "(∞)"
                        : `(${maxReplays - replaysUsed}/${maxReplays})`}
                  </span>
               </button>

               <button className={ui.button} onClick={handleShare}>
                  <ShareIcon className={ui.buttonIcon} />
                  <span>Share for unlimited</span>
               </button>
            </div>
            {pad > 0 && <div aria-hidden="true" style={{ height: pad, flexShrink: 0 }} />}
         </div>
      </>
   );
}
