"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
                  const updated = prev.filter((t) => t.id !== newTarget.id);
                  if (!newTarget.clicked) {
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

      setTimeout(() => {
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
                                 shared: true,
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
               padding: isMobile ? "16px" : isTablet ? "20px" : "24px",
               gap: isMobile ? "16px" : "20px",
            }}
         >
            {/* Header */}
            <div
               style={{
                  width: "100%",
                  maxWidth: "800px",
                  background: "var(--card)",
                  border: "1px solid var(--stroke)",
                  borderRadius: isMobile ? "16px" : "20px",
                  padding: isMobile ? "16px" : "20px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                  display: "flex",
                  flexDirection: "column",
                  gap: isMobile ? "12px" : "16px",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "space-between",
                     flexWrap: "wrap",
                     gap: isMobile ? "8px" : "12px",
                  }}
               >
                  <span
                     style={{
                        fontSize: isMobile ? "0.875rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                     }}
                  >
                     Level {currentLevel + 1}/{maxLevels}
                  </span>
                  <span
                     style={{
                        fontSize: isMobile ? "0.875rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
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
                     {requirementsMet && currentLevel + 1 >= maxLevels
                        ? 100
                        : currentScore}{" "}
                     / 100
                  </span>
                  <span
                     style={{
                        fontSize: isMobile ? "0.875rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
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
                     {timeLeft}s
                  </span>
               </div>
               {/* Progress Bar */}
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

            {/* Hit and Missed Stats */}
            {(gameState === "playing" || gameState === "paused") && (
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     gap: "16px",
                     flexWrap: "wrap",
                     width: "100%",
                     maxWidth: "800px",
                  }}
               >
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(134, 239, 172, 0.2), rgba(34, 197, 94, 0.1))",
                        border: "1px solid rgba(134, 239, 172, 0.4)",
                        borderRadius: "12px",
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                     }}
                  >
                     <CheckCircleIcon
                        style={{
                           width: 18,
                           height: 18,
                           color: "var(--ok)",
                        }}
                     />
                     <span
                        style={{
                           fontSize: "1rem",
                           fontWeight: 600,
                           color: "var(--text)",
                        }}
                     >
                        Hit: {targetsHit} / {minTargetsHit}
                     </span>
                  </div>
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(252, 165, 165, 0.2), rgba(239, 68, 68, 0.1))",
                        border: "1px solid rgba(252, 165, 165, 0.4)",
                        borderRadius: "12px",
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                     }}
                  >
                     <XCircleIcon
                        style={{
                           width: 18,
                           height: 18,
                           color: "var(--warn)",
                        }}
                     />
                     <span
                        style={{
                           fontSize: "1rem",
                           fontWeight: 600,
                           color: "var(--text)",
                        }}
                     >
                        Missed: {targetsMissed}
                     </span>
                  </div>
               </div>
            )}

            {/* Game Arena */}
            {gameState === "playing" || gameState === "paused" ? (
               <div
                  ref={arenaRef}
                  onMouseMove={(e) => {
                     // No viewport movement needed - arena is same size as viewport
                  }}
                  style={{
                     position: "relative",
                     width: "100%",
                     maxWidth: "800px",
                     height: isMobile ? "300px" : "380px",
                     borderRadius: "var(--radius)",
                     border: "1px solid var(--border)",
                     background:
                        "radial-gradient(320px 220px at 30% 30%, rgba(59, 130, 246, 0.1), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                     boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
                     overflow: "hidden",
                     userSelect: "none",
                     cursor: "crosshair", // Crosshair cursor (plus sign)
                  }}
               >
                  <div
                     style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        transition: "none",
                     }}
                  >
                     {targets.map((target) => (
                        <div
                           key={target.id}
                           onClick={(e) => {
                              e.stopPropagation();
                              handleTargetClick(target.id);
                           }}
                           onMouseDown={(e) => {
                              e.stopPropagation();
                           }}
                           style={{
                              position: "absolute",
                              left: `${target.x}px`,
                              top: `${target.y}px`,
                              width: `${target.size}px`,
                              height: `${target.size}px`,
                              borderRadius: "50%",
                              background:
                                 "radial-gradient(circle, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))",
                              border: "3px solid rgba(255, 255, 255, 0.8)",
                              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.6)",
                              cursor: "pointer",
                              transition: target.clicked
                                 ? "all 0.2s ease"
                                 : "none",
                              transform: target.clicked
                                 ? "scale(0)"
                                 : "scale(1)",
                              opacity: target.clicked ? 0 : 1,
                              pointerEvents: target.clicked ? "none" : "auto",
                           }}
                        />
                     ))}
                  </div>
                  {/* Target Icon (Sheja) - moves with keyboard or mouse */}
                  <div
                     style={{
                        position: "absolute",
                        left: `calc(50% + ${targetIconX}px)`,
                        top: `calc(50% + ${targetIconY}px)`,
                        transform: "translate(-50%, -50%)",
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
                           left: "50%",
                           top: "50%",
                           transform: "translate(-50%, -50%)",
                           width: "24px",
                           height: "24px",
                           borderRadius: "50%",
                           border: "2px solid rgba(255, 255, 255, 0.9)",
                           boxShadow: "rgba(255, 255, 255, 0.8) 0px 0px 12px",
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
                           background: "rgba(255, 255, 255, 0.9)",
                           boxShadow: "rgba(255, 255, 255, 0.6) 0px 0px 4px",
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
                           background: "rgba(255, 255, 255, 0.9)",
                           boxShadow: "rgba(255, 255, 255, 0.6) 0px 0px 4px",
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
                           background: "rgba(255, 255, 255, 0.9)",
                           boxShadow: "rgba(255, 255, 255, 0.8) 0px 0px 8px",
                        }}
                     />
                  </div>
               </div>
            ) : null}

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
                     border: "1px solid var(--stroke)",
                     width: "100%",
                     maxWidth: "800px",
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
                        borderRadius: "12px",
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
            {gameState === "ready" &&
               currentLevel + 1 >= maxLevels &&
               requirementsMet && (
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
                        border: "1px solid var(--stroke)",
                        width: "100%",
                        maxWidth: "800px",
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
                     <div
                        style={{
                           fontSize: isMobile ? "1rem" : "1.05rem",
                           fontWeight: 500,
                           color: "var(--muted)",
                        }}
                     >
                        Final Score: 100
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
                     border: "1px solid var(--stroke)",
                     width: "100%",
                     maxWidth: "800px",
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
                        fontSize: isMobile ? "1.05rem" : "1.1rem",
                        fontWeight: 600,
                        marginBottom: "20px",
                        marginTop: "16px",
                     }}
                  >
                     Need: {minTargetsHit} targets hit
                  </div>
                  <div
                     style={{
                        fontSize: isMobile ? "0.95rem" : "1rem",
                        fontWeight: 500,
                        color: "var(--muted)",
                     }}
                  >
                     You hit: {targetsHit} targets
                  </div>
               </div>
            )}

            {/* Action Buttons: Replay, Share */}
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
                  width: "100%",
                  maxWidth: "800px",
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
                        🎉 Someone opened your link! Unlimited replay is now
                        active for 15 minutes!
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
                        maxReplays > 0 && replaysUsed >= maxReplays ? 0.5 : 1,
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
                     border: "2px solid rgba(59, 130, 246, 0.6)",
                     borderRadius: "12px",
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
                        color: "var(--accent)",
                     }}
                  />
                  <span>Share for unlimited</span>
               </button>
            </div>
         </div>
      </>
   );
}
