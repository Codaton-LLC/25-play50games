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

interface PrecisionDropProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

interface ObjectState {
   x: number;
   y: number;
   vy: number;
   state: "aim" | "fall" | "land";
}

interface TargetState {
   x: number;
   w: number;
   y: number;
   h: number;
}

export default function PrecisionDrop({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: PrecisionDropProps) {
   const defaultLevelDuration = 30; // seconds per level
   const levelRequirements = config?.levelRequirements || null;
   const configuredLevels = config?.levels ? Number(config.levels) : 0;
   const requirementsCount = Array.isArray(levelRequirements)
      ? levelRequirements.length
      : 0;
   const maxLevels = Math.max(configuredLevels, requirementsCount) || 15;

   // Constants from HTML
   const OBJ_R = 14; // object radius
   const GRAVITY = 1400; // px/s^2
   const FLOOR_PAD = 64;
   const TARGET_MARGIN = 20;
   const SHAKE_AMPLITUDE = 6; // px
   const SHAKE_FREQ = 22; // Hz

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

   // Get number of drops (mini levels) for current level
   const getDropsForLevel = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].drops || 1;
         }
         // Progressive: 1 drop at level 1, 3 at level 5, 5 at level 10+
         if (level < 5) return 1;
         if (level < 10) return 3;
         return 5;
      },
      [levelRequirements]
   );

   // Get target width for current level (smaller = harder)
   const getTargetWidth = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].targetWidth || 100;
         }
         // Progressive: starts at 160px, decreases by 12px per level, min 24px
         const canvas = canvasRef.current;
         if (!canvas) return 100;
         const dpr = Math.max(1, window.devicePixelRatio || 1);
         const w = canvas.width / dpr;
         const minW = 24;
         const maxW = Math.min(160, w * 0.35);
         return Math.max(minW, maxW - level * 12);
      },
      [levelRequirements]
   );

   // Get target speed for current level (0 = static, >0 = moving)
   const getTargetSpeed = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].targetSpeed || 0;
         }
         // Progressive: static until level 5, then moving
         if (level < 5) return 0;
         return 120 + level * 18; // px/s
      },
      [levelRequirements]
   );

   // Check if shake is enabled for current level
   const getShakeEnabled = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].shakeEnabled || false;
         }
         // Shake enabled from level 10+
         return level >= 10;
      },
      [levelRequirements]
   );

   // Get minimum hits required for current level
   const getMinHits = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].minHits || 1;
         }
         // Progressive: need at least 1 hit at level 1, more at higher levels
         const drops = getDropsForLevel(level);
         return Math.max(1, Math.floor(drops * 0.6)); // 60% of drops
      },
      [levelRequirements, getDropsForLevel]
   );

   // Get level config
   const getLevelConfig = useCallback(
      (level: number) => {
         return {
            duration: getLevelDuration(level),
            drops: getDropsForLevel(level),
            targetWidth: getTargetWidth(level),
            targetSpeed: getTargetSpeed(level),
            shakeEnabled: getShakeEnabled(level),
            minHits: getMinHits(level),
         };
      },
      [
         getLevelDuration,
         getDropsForLevel,
         getTargetWidth,
         getTargetSpeed,
         getShakeEnabled,
         getMinHits,
      ]
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

   // Game state
   const [obj, setObj] = useState<ObjectState | null>(null);
   const [target, setTarget] = useState<TargetState | null>(null);
   const [dropsLeft, setDropsLeft] = useState(1);
   const [hits, setHits] = useState(0);
   const [misses, setMisses] = useState(0);
   const [targetVel, setTargetVel] = useState(0);
   const [targetDir, setTargetDir] = useState<1 | -1>(1);
   const [shakeActive, setShakeActive] = useState(false);

   // Refs
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const arenaRef = useRef<HTMLDivElement>(null);
   const animationFrameRef = useRef<number | null>(null);
   const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
   const gameStateRef = useRef<"playing" | "ready" | "failed" | "paused">(
      "playing"
   );
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<((level: number) => void) | null>(null);
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   const lastCompletedLevelRef = useRef<number | null>(null);
   const nextRoundClickedRef = useRef(false);
   const [nextRoundLocked, setNextRoundLocked] = useState(false);
   const lastTimestampRef = useRef<number>(0);
   const objRef = useRef<ObjectState | null>(null);
   const targetRef = useRef<TargetState | null>(null);
   const targetVelRef = useRef(0);
   const targetDirRef = useRef<1 | -1>(1);
   const shakeActiveRef = useRef(false);
   const dropsLeftRef = useRef(1);
   const hitsRef = useRef(0);
   const dropLockRef = useRef(false);
   const landingHandledRef = useRef(false);
   const targetVelBaseRef = useRef(0);
   const targetFlashRef = useRef(false);
   const targetPauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited

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

   // Sync refs with state
   useEffect(() => {
      objRef.current = obj;
   }, [obj]);

   useEffect(() => {
      targetRef.current = target;
   }, [target]);

   useEffect(() => {
      targetVelRef.current = targetVel;
   }, [targetVel]);

   useEffect(() => {
      targetDirRef.current = targetDir;
   }, [targetDir]);

   useEffect(() => {
      shakeActiveRef.current = shakeActive;
   }, [shakeActive]);

   useEffect(() => {
      dropsLeftRef.current = dropsLeft;
   }, [dropsLeft]);

   useEffect(() => {
      hitsRef.current = hits;
   }, [hits]);

   useEffect(() => {
      if (gameState === "playing") {
         arenaRef.current?.focus();
      }
   }, [gameState]);

   // Helper functions
   const clamp = useCallback((n: number, a: number, b: number) => {
      return Math.max(a, Math.min(b, n));
   }, []);

   const rand = useCallback((min: number, max: number) => {
      return min + Math.random() * (max - min);
   }, []);

   // Get floor Y position
   const getFloorY = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      return canvas.height / dpr - FLOOR_PAD;
   }, []);

   // Draw function (defined before resizeCanvas so it can be used there)
   const draw = useCallback(
      (shakeOffset: number) => {
         const canvas = canvasRef.current;
         if (!canvas) return;
         const ctx = canvas.getContext("2d");
         if (!ctx) return;

         const dpr = Math.max(1, window.devicePixelRatio || 1);
         const w = canvas.width / dpr;
         const h = canvas.height / dpr;

         ctx.clearRect(0, 0, canvas.width, canvas.height);

         // Subtle grid
         ctx.strokeStyle = "rgba(255,255,255,.04)";
         ctx.lineWidth = 1;
         for (let x = 0; x < w; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
         }
         for (let y = 0; y < h; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
         }

         // Floor
         const floorY = getFloorY();
         ctx.fillStyle = "rgba(255,255,255,.06)";
         ctx.fillRect(0, floorY, w, 4);

         // Target (with shake offset)
         const currentTarget = targetRef.current;
         if (currentTarget) {
            const minX = TARGET_MARGIN;
            const maxX = w - TARGET_MARGIN - currentTarget.w;
            const tX = clamp(currentTarget.x + shakeOffset, minX, maxX);

            if (targetFlashRef.current) {
               ctx.fillStyle = "rgba(34,197,94,.45)";
               ctx.fillRect(
                  tX,
                  currentTarget.y,
                  currentTarget.w,
                  currentTarget.h
               );
               ctx.strokeStyle = "rgba(34,197,94,.95)";
               ctx.strokeRect(
                  tX,
                  currentTarget.y,
                  currentTarget.w,
                  currentTarget.h
               );
            } else {
               ctx.fillStyle = "rgba(54,211,153,.22)";
               ctx.fillRect(
                  tX,
                  currentTarget.y,
                  currentTarget.w,
                  currentTarget.h
               );
               ctx.strokeStyle = "rgba(54,211,153,.65)";
               ctx.strokeRect(
                  tX,
                  currentTarget.y,
                  currentTarget.w,
                  currentTarget.h
               );
            }
         }

         // Aiming guide line
         const currentObj = objRef.current;
         if (currentObj && currentObj.state === "aim") {
            ctx.strokeStyle = "rgba(110,168,255,.25)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(currentObj.x, currentObj.y + OBJ_R + 4);
            ctx.lineTo(currentObj.x, floorY);
            ctx.stroke();
         }

         // Object
         if (currentObj) {
            ctx.fillStyle = "rgba(110,168,255,.25)";
            ctx.beginPath();
            ctx.arc(currentObj.x, currentObj.y, OBJ_R + 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "rgba(110,168,255,.85)";
            ctx.beginPath();
            ctx.arc(currentObj.x, currentObj.y, OBJ_R, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = "rgba(255,255,255,.14)";
            ctx.stroke();
         }

         // Helper text
         ctx.fillStyle = "rgba(166,179,209,.55)";
         ctx.font = "12px system-ui";
         ctx.fillText("Move left/right • Tap to drop", 14, 18);
      },
      [getFloorY, clamp]
   );

   // Canvas resize handler
   const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const arena = arenaRef.current;
      if (!canvas || !arena) return;

      requestAnimationFrame(() => {
         const rect = arena.getBoundingClientRect();
         if (rect.width === 0 || rect.height === 0) return;

         const computedStyle = window.getComputedStyle(arena);
         const paddingX =
            parseFloat(computedStyle.paddingLeft) +
            parseFloat(computedStyle.paddingRight);
         const paddingY =
            parseFloat(computedStyle.paddingTop) +
            parseFloat(computedStyle.paddingBottom);

         const canvasWidth = rect.width - paddingX;
         const canvasHeight = rect.height - paddingY;

         if (canvasWidth <= 0 || canvasHeight <= 0) return;

         const dpr = Math.max(1, window.devicePixelRatio || 1);
         const width = Math.floor(canvasWidth * dpr);
         const height = Math.floor(canvasHeight * dpr);

         if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            canvas.style.width = canvasWidth + "px";
            canvas.style.height = canvasHeight + "px";

            const ctx = canvas.getContext("2d");
            if (ctx) {
               ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }

            draw(0);
         }
      });
   }, [draw]);

   // Current shake offset
   const getCurrentShakeOffset = useCallback((ts: number) => {
      if (!shakeActiveRef.current) return 0;
      const t = ts / 1000;
      return Math.sin(t * Math.PI * 2 * SHAKE_FREQ) * SHAKE_AMPLITUDE;
   }, []);

   // Check landing
   const checkLanding = useCallback(
      (shakeOffset: number) => {
         const currentObj = objRef.current;
         const currentTarget = targetRef.current;
         if (!currentObj || !currentTarget) return;

         const canvas = canvasRef.current;
         if (!canvas) return;
         const dpr = Math.max(1, window.devicePixelRatio || 1);
         const w = canvas.width / dpr;

         const minX = TARGET_MARGIN;
         const maxX = w - TARGET_MARGIN - currentTarget.w;
         const tX = clamp(currentTarget.x + shakeOffset, minX, maxX);

         const left = currentObj.x - OBJ_R;
         const right = currentObj.x + OBJ_R;
         const tLeft = tX;
         const tRight = tX + currentTarget.w;

         const inside = left >= tLeft && right <= tRight;

         if (landingHandledRef.current) return;
         landingHandledRef.current = true;

         if (inside) {
            setHits((prev) => {
               const newHits = prev + 1;
               hitsRef.current = newHits;
               return newHits;
            });
         } else {
            setMisses((prev) => prev + 1);
         }

         // Check if more drops left
         if (dropsLeftRef.current > 0) {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const dpr = Math.max(1, window.devicePixelRatio || 1);
            const w = canvas.width / dpr;
            const pauseMs = 1200;

            targetFlashRef.current = true;
            if (targetPauseTimeoutRef.current) {
               clearTimeout(targetPauseTimeoutRef.current);
            }

            if (targetVelRef.current !== 0) {
               targetVelRef.current = 0;
               setTargetVel(0);
            }

            targetPauseTimeoutRef.current = setTimeout(() => {
               if (gameStateRef.current !== "playing") return;
               setObj({ x: w / 2, y: 70, vy: 0, state: "aim" });
               setShakeActive(false);
               dropLockRef.current = false;
               landingHandledRef.current = false;
               targetFlashRef.current = false;
               if (targetVelBaseRef.current > 0) {
                  targetVelRef.current = targetVelBaseRef.current;
                  setTargetVel(targetVelBaseRef.current);
               }
            }, pauseMs);
         } else {
            // All drops completed, check if level passed
            setTimeout(() => {
               const levelConfig = getLevelConfig(currentLevel);
               const minHits = levelConfig.minHits;
               if (hitsRef.current >= minHits) {
                  requirementsMetRef.current = true;
                  setRequirementsMet(true);
                  clearAll();
                  gameStateRef.current = "ready";
                  setGameState("ready");
                  lastCompletedLevelRef.current = currentLevel;
               } else {
                  gameStateRef.current = "failed";
                  setGameState("failed");
                  clearAll();
               }
            }, 700);
         }
      },
      [currentLevel, getLevelConfig, clamp]
   );

   // Clear all timers
   const clearAll = useCallback(() => {
      if (animationFrameRef.current) {
         cancelAnimationFrame(animationFrameRef.current);
         animationFrameRef.current = null;
      }
      if (targetPauseTimeoutRef.current) {
         clearTimeout(targetPauseTimeoutRef.current);
         targetPauseTimeoutRef.current = null;
      }
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }
   }, []);

   useEffect(() => {
      if (!isPlaying) {
         clearAll();
         return;
      }

      let resizeTimeout: NodeJS.Timeout;
      const handleResize = () => {
         clearTimeout(resizeTimeout);
         resizeTimeout = setTimeout(() => {
            resizeCanvas();
         }, 100);
      };

      resizeCanvas();
      window.addEventListener("resize", handleResize);
      return () => {
         window.removeEventListener("resize", handleResize);
         clearTimeout(resizeTimeout);
      };
   }, [isPlaying, clearAll, resizeCanvas]);

   useEffect(() => {
      if (gameState !== "playing") return;
      const raf = requestAnimationFrame(() => {
         resizeCanvas();
         draw(0);
      });
      return () => cancelAnimationFrame(raf);
   }, [gameState, resizeCanvas, draw]);

   // Start level
   const startLevel = useCallback(
      (level: number) => {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
         }

         // Reset all state
         setObj(null);
         setTarget(null);
         setDropsLeft(0);
         setHits(0);
         setMisses(0);
         setTargetVel(0);
         setTargetDir(1);
         setShakeActive(false);
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         lastCompletedLevelRef.current = null;
         nextRoundClickedRef.current = false;
         setNextRoundLocked(false);
         lastTimestampRef.current = 0;
         dropLockRef.current = false;
         landingHandledRef.current = false;
         targetFlashRef.current = false;

         const levelConfig = getLevelConfig(level);
         const levelDur = levelConfig.duration;
         setTimeLeft(levelDur);

         // Resize canvas
         resizeCanvas();

         // Initialize round
         setTimeout(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            requestAnimationFrame(() => {
               const dpr = Math.max(1, window.devicePixelRatio || 1);
               const w = canvas.width / dpr;
               const floorY = getFloorY();

               const drops = levelConfig.drops;
               setDropsLeft(drops);
               dropsLeftRef.current = drops;

               const tW = levelConfig.targetWidth;
               const tX = rand(40, w - 40 - tW);
               const newTarget: TargetState = {
                  x: tX,
                  w: tW,
                  y: floorY + 6,
                  h: 14,
               };
               setTarget(newTarget);

               const targetSpeed = levelConfig.targetSpeed;
               setTargetVel(targetSpeed);
               targetVelRef.current = targetSpeed;
               targetVelBaseRef.current = targetSpeed;
               const initialDir = Math.random() > 0.5 ? 1 : -1;
               setTargetDir(initialDir);
               targetDirRef.current = initialDir;

               const newObj: ObjectState = {
                  x: w / 2,
                  y: 70,
                  vy: 0,
                  state: "aim",
               };
               setObj(newObj);
               setShakeActive(false);

               draw(0);
            });
         }, 100);

         // Set game state to playing
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

         // Start animation loop
         const loop = (ts: number) => {
            if (
               gameStateRef.current !== "playing" ||
               requirementsMetRef.current
            ) {
               return;
            }

            if (!lastTimestampRef.current) lastTimestampRef.current = ts;
            const dt = Math.min(0.033, (ts - lastTimestampRef.current) / 1000);
            lastTimestampRef.current = ts;

            // Move target horizontally if speed > 0
            setTarget((prev) => {
               if (!prev || targetVelRef.current <= 0) return prev;

               const canvas = canvasRef.current;
               if (!canvas) return prev;
               const dpr = Math.max(1, window.devicePixelRatio || 1);
               const w = canvas.width / dpr;

               const newX =
                  prev.x + targetDirRef.current * targetVelRef.current * dt;
               const minX = TARGET_MARGIN;
               const maxX = w - TARGET_MARGIN - prev.w;

               let newDir = targetDirRef.current;
               if (newX <= minX) {
                  newDir = 1;
                  setTargetDir(1);
               } else if (newX >= maxX) {
                  newDir = -1;
                  setTargetDir(-1);
               }

               return {
                  ...prev,
                  x: clamp(newX, minX, maxX),
               };
            });

            const shakeOffset = getCurrentShakeOffset(ts);

            // Physics for falling object
            setObj((prev) => {
               if (!prev || prev.state !== "fall") return prev;

               const newVy = prev.vy + GRAVITY * dt;
               const newY = prev.y + newVy * dt;
               const floorY = getFloorY();
               const landY = floorY - OBJ_R;

               if (newY >= landY) {
                  const landed: ObjectState = {
                     ...prev,
                     y: landY,
                     state: "land",
                  };
                  checkLanding(shakeOffset);
                  return landed;
               }

               return {
                  ...prev,
                  y: newY,
                  vy: newVy,
               };
            });

            draw(shakeOffset);
            animationFrameRef.current = requestAnimationFrame(loop);
         };

         lastTimestampRef.current = 0;
         animationFrameRef.current = requestAnimationFrame(loop);
      },
      [
         getLevelConfig,
         resizeCanvas,
         getFloorY,
         rand,
         clamp,
         getCurrentShakeOffset,
         checkLanding,
         draw,
      ]
   );

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Handle drop
   const handleDrop = useCallback(() => {
      if (
         gameState !== "playing" ||
         !obj ||
         obj.state !== "aim" ||
         dropsLeft <= 0
      )
         return;
      if (dropLockRef.current) return;
      dropLockRef.current = true;
      landingHandledRef.current = false;

      setObj((prev) => {
         if (!prev) return null;
         return { ...prev, state: "fall", vy: 0 };
      });
      setDropsLeft((prev) => {
         const newVal = prev - 1;
         dropsLeftRef.current = newVal;
         return newVal;
      });

      // Activate shake if enabled for this level
      const levelConfig = getLevelConfig(currentLevel);
      if (levelConfig.shakeEnabled) {
         setShakeActive(true);
      }
   }, [gameState, obj, dropsLeft, currentLevel, getLevelConfig]);

   // Handle mouse/touch move
   const handleMove = useCallback(
      (clientX: number) => {
         if (gameState !== "playing" || !obj || obj.state !== "aim") return;

         const canvas = canvasRef.current;
         const arena = arenaRef.current;
         if (!canvas || !arena) return;

         const rect = arena.getBoundingClientRect();
         const dpr = Math.max(1, window.devicePixelRatio || 1);
         const w = canvas.width / dpr;
         const relativeX = clientX - rect.left;
         const newX = clamp(relativeX, OBJ_R + 6, w - OBJ_R - 6);

         setObj((prev) => {
            if (!prev) return null;
            return { ...prev, x: newX };
         });
      },
      [gameState, obj, clamp]
   );

   // End level when time runs out
   useEffect(() => {
      if (
         timeLeft === 0 &&
         gameState === "playing" &&
         !requirementsMetRef.current
      ) {
         const levelConfig = getLevelConfig(currentLevel);
         const minHits = levelConfig.minHits;

         if (hits >= minHits) {
            requirementsMetRef.current = true;
            setRequirementsMet(true);
            gameStateRef.current = "ready";
            setGameState("ready");
            lastCompletedLevelRef.current = currentLevel;
            clearAll();
         } else {
            gameStateRef.current = "failed";
            setGameState("failed");
            clearAll();
         }
      }
   }, [timeLeft, gameState, currentLevel, hits, getLevelConfig, clearAll]);

   // Handle level completion
   useEffect(() => {
      if (prevLevelRef.current === null) return;

      if (gameState === "ready" && !requirementsMetRef.current) {
         return;
      }
      if (
         gameState === "ready" &&
         lastCompletedLevelRef.current !== currentLevel
      ) {
         return;
      }

      if (gameState === "ready" && currentLevel < maxLevels - 1) {
         const newScore = Math.round(((currentLevel + 1) / maxLevels) * 100);
         setCurrentScore(newScore);
         onScoreUpdate(newScore);
      } else if (gameState === "ready" && currentLevel === maxLevels - 1) {
         const finalScore = 100;
         setCurrentScore(finalScore);
         onScoreUpdate(finalScore);
         if (!completionCalledRef.current) {
            completionCalledRef.current = true;
            setTimeout(() => {
               onComplete(finalScore);
            }, 1500);
         }
      }
   }, [gameState, currentLevel, maxLevels, onScoreUpdate, onComplete]);

   // Handle next round
   const handleNextRound = useCallback(() => {
      if (gameState !== "ready") return;
      if (nextRoundClickedRef.current || nextRoundLocked) return;
      if (currentLevel < maxLevels - 1) {
         nextRoundClickedRef.current = true;
         setNextRoundLocked(true);
         setCurrentLevel((prev) => prev + 1);
      }
   }, [gameState, currentLevel, maxLevels, nextRoundLocked]);

   // Handle replay
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setRequirementsMet(false);
      requirementsMetRef.current = false;
      lastCompletedLevelRef.current = null;
      setGameState("playing");
      gameStateRef.current = "playing";
      setObj(null);
      setTarget(null);
      setDropsLeft(0);
      setHits(0);
      setMisses(0);
      setTargetVel(0);
      setTargetDir(1);
      setShakeActive(false);
      dropLockRef.current = false;
      landingHandledRef.current = false;
      targetFlashRef.current = false;
      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      clearAll();
      setTimeout(() => {
         if (startLevelRef.current) {
            startLevelRef.current(currentLevel);
         }
      }, 100);
      if (maxReplays > 0) {
         setReplaysUsed((prev) => prev + 1);
      }
   }, [
      gameState,
      maxReplays,
      replaysUsed,
      currentLevel,
      getLevelDuration,
      clearAll,
   ]);

   // Share functionality
   const getShareableLink = useCallback((): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   }, []);

   const registerShareLink = useCallback(async (shareId: string) => {
      try {
         await registerShare(shareId, "precision-drop");
         const gameKey = "play50games_shared_precision-drop";
         const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes
         localStorage.setItem(
            gameKey,
            JSON.stringify({
               share_id: shareId,
               shared: false,
               expiry: expiry,
            })
         );
         setCurrentShareId(shareId);
      } catch (error) {
         // Error registering share
      }
   }, []);

   const handleShare = useCallback(async () => {
      const shareableLink = getShareableLink();
      const shareId = new URL(shareableLink).searchParams.get("shared") || "";

      if (!shareId) return;

      await registerShareLink(shareId);

      if (navigator.share) {
         try {
            await navigator.share({
               title: "Precision Drop - Play50Games",
               text: "Check out this precision challenge!",
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
   }, [getShareableLink, registerShareLink]);

   const handleCopyLink = useCallback(async (shareId: string) => {
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
   }, []);

   // Check if share has clicks
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         const gameKey = "play50games_shared_precision-drop";
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
      const gameKey = "play50games_shared_precision-drop";
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

      if (
         prevLevelRef.current === currentLevel &&
         forceStartLevelRef.current !== currentLevel
      ) {
         return;
      }

      prevLevelRef.current = currentLevel;
      if (forceStartLevelRef.current === currentLevel) {
         forceStartLevelRef.current = null;
      }

      // Reset state
      setObj(null);
      setTarget(null);
      setDropsLeft(0);
      setHits(0);
      setMisses(0);
      setTargetVel(0);
      setTargetDir(1);
      setShakeActive(false);
      setRequirementsMet(false);
      requirementsMetRef.current = false;
      lastCompletedLevelRef.current = null;
      nextRoundClickedRef.current = false;
      dropLockRef.current = false;

      gameStateRef.current = "ready";
      setGameState("ready");

      if (currentLevel === 0) {
         setTimeout(() => {
            if (startLevelRef.current) {
               startLevelRef.current(0);
            }
         }, 0);
      } else {
         setTimeout(() => {
            if (startLevelRef.current) {
               startLevelRef.current(currentLevel);
            }
         }, 1200);
      }
   }, [currentLevel, isPlaying, startLevel]);

   // Progress percentage for header
   const progressPercentage = ((currentLevel + 1) / maxLevels) * 100;

   const levelConfig = getLevelConfig(currentLevel);
   const minHits = levelConfig.minHits;

   return (
      <>
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               alignItems: "center",
               gap: isMobile ? "16px" : "20px",
               width: "100%",
               maxWidth: "800px",
               margin: "0 auto",
               padding: isMobile ? "12px" : "16px",
            }}
         >
            {/* Header Section */}
            <div
               style={{
                  width: "100%",
                  maxWidth: "800px",
                  background: "var(--card)",
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
                     <ArrowPathIcon
                        style={{
                           width: isMobile ? 14 : 16,
                           height: isMobile ? 14 : 16,
                        }}
                     />
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
                     {requirementsMet &&
                     lastCompletedLevelRef.current === currentLevel &&
                     currentLevel + 1 >= maxLevels
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
                        width: `${progressPercentage}%`,
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

            {/* Stats Display */}
            {gameState === "playing" && (
               <div
                  style={{
                     display: "flex",
                     gap: isMobile ? "8px" : "12px",
                     flexWrap: "wrap",
                     justifyContent: "center",
                     width: "100%",
                     maxWidth: "800px",
                  }}
               >
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                        border: "1px solid rgba(59, 130, 246, 0.4)",

                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                     }}
                  >
                     <span
                        style={{
                           fontSize: "1rem",
                           fontWeight: 600,
                           color: "var(--text)",
                        }}
                     >
                        Hits: {hits}/{minHits}
                     </span>
                  </div>
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))",
                        border: "1px solid rgba(34, 197, 94, 0.4)",

                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                     }}
                  >
                     <span
                        style={{
                           fontSize: "1rem",
                           fontWeight: 600,
                           color: "var(--text)",
                        }}
                     >
                        Drops left: {dropsLeft}
                     </span>
                  </div>
               </div>
            )}

            {/* Game Arena */}
            {gameState === "playing" ? (
               <div
                  ref={arenaRef}
                  onClick={handleDrop}
                  onMouseDown={() => arenaRef.current?.focus()}
                  onMouseMove={(e) => handleMove(e.clientX)}
                  onTouchMove={(e) => {
                     if (e.touches[0]) {
                        handleMove(e.touches[0].clientX);
                     }
                  }}
                  onTouchStart={(e) => {
                     arenaRef.current?.focus();
                     if (e.touches[0]) {
                        handleMove(e.touches[0].clientX);
                     }
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                     if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleDrop();
                     } else if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        const canvas = canvasRef.current;
                        if (canvas && obj) {
                           const dpr = Math.max(
                              1,
                              window.devicePixelRatio || 1
                           );
                           const w = canvas.width / dpr;
                           setObj((prev) => {
                              if (!prev) return null;
                              return {
                                 ...prev,
                                 x: clamp(
                                    prev.x - 10,
                                    OBJ_R + 6,
                                    w - OBJ_R - 6
                                 ),
                              };
                           });
                        }
                     } else if (e.key === "ArrowRight") {
                        e.preventDefault();
                        const canvas = canvasRef.current;
                        if (canvas && obj) {
                           const dpr = Math.max(
                              1,
                              window.devicePixelRatio || 1
                           );
                           const w = canvas.width / dpr;
                           setObj((prev) => {
                              if (!prev) return null;
                              return {
                                 ...prev,
                                 x: clamp(
                                    prev.x + 10,
                                    OBJ_R + 6,
                                    w - OBJ_R - 6
                                 ),
                              };
                           });
                        }
                     }
                  }}
                  style={{
                     position: "relative",
                     width: "100%",
                     maxWidth: "800px",
                     height: isMobile ? "400px" : "500px",
                     borderRadius: "var(--radius)",
                     border: "1px solid var(--border)",
                     background:
                        "radial-gradient(320px 220px at 30% 30%, rgba(59, 130, 246, 0.1), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                     boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
                     overflow: "hidden",
                     userSelect: "none",
                     touchAction: "manipulation",
                     padding: "10px",
                     cursor: "pointer",
                     outline: "none",
                     boxSizing: "border-box",
                  }}
               >
                  <canvas
                     ref={canvasRef}
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                        maxWidth: "100%",
                        maxHeight: "100%",
                     }}
                  />
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
                     textAlign: "center",
                     border: "1px solid var(--border)",
                  }}
               >
                  <div style={{ marginBottom: "16px" }}>
                     Level {currentLevel + 1} Complete!
                  </div>
                  <div
                     style={{
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 400,
                        marginBottom: "20px",
                        color: "var(--text-secondary)",
                     }}
                  >
                     Hits: {hits}/{minHits}
                     <br />
                     Drops completed: {levelConfig.drops - dropsLeft}/
                     {levelConfig.drops}
                  </div>
                  <button
                     onClick={handleNextRound}
                     disabled={nextRoundLocked}
                     style={{
                        padding: isMobile ? "12px 24px" : "14px 28px",
                        background: nextRoundLocked
                           ? "rgba(100, 100, 100, 0.2)"
                           : "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.12))",
                        border: nextRoundLocked
                           ? "1px solid rgba(100, 100, 100, 0.4)"
                           : "2px solid rgba(134, 239, 172, 0.6)",

                        color: "var(--text)",
                        fontSize: isMobile ? "1rem" : "1.05rem",
                        fontWeight: 700,
                        cursor: nextRoundLocked ? "not-allowed" : "pointer",
                        opacity: nextRoundLocked ? 0.5 : 1,
                        transition: "all 0.3s ease",
                     }}
                  >
                     Next Round
                  </button>
               </div>
            )}

            {/* Level Failed Message */}
            {gameState === "failed" &&
               (() => {
                  const levelConfig = getLevelConfig(currentLevel);
                  const minHits = levelConfig.minHits;
                  const hitsMet = hits >= minHits;

                  let failureReason = "";
                  if (!hitsMet) {
                     failureReason = "Hits requirement not met";
                  }

                  return (
                     <div
                        style={{
                           padding: isMobile ? "20px 24px" : "24px 32px",
                           background: "var(--card)",
                           borderRadius: "var(--radius)",
                           color: "var(--text)",
                           fontSize: isMobile ? "1rem" : "1.1rem",
                           fontWeight: 700,
                           textAlign: "center",
                           border: "1px solid var(--border)",
                        }}
                     >
                        <div
                           style={{
                              marginBottom: "16px",
                              color: "var(--warn)",
                           }}
                        >
                           Level {currentLevel + 1} Failed
                        </div>
                        <div
                           style={{
                              fontSize: isMobile ? "0.9rem" : "1rem",
                              fontWeight: 600,
                              marginBottom: "12px",
                              color: "var(--warn)",
                           }}
                        >
                           {failureReason}
                        </div>
                        <div
                           style={{
                              fontSize: isMobile ? "0.9rem" : "1rem",
                              fontWeight: 400,
                              marginBottom: "8px",
                              color: "var(--text-secondary)",
                           }}
                        >
                           <div
                              style={{
                                 marginBottom: "4px",
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "4px",
                                 justifyContent: "center",
                              }}
                           >
                              <span>
                                 Hits: Need {minHits} | You got {hits}
                              </span>
                              {hitsMet ? (
                                 <CheckCircleIcon
                                    style={{
                                       width: isMobile ? 16 : 18,
                                       height: isMobile ? 16 : 18,
                                       color: "var(--ok)",
                                       flexShrink: 0,
                                    }}
                                 />
                              ) : (
                                 <XCircleIcon
                                    style={{
                                       width: isMobile ? 16 : 18,
                                       height: isMobile ? 16 : 18,
                                       color: "var(--warn)",
                                       flexShrink: 0,
                                    }}
                                 />
                              )}
                           </div>
                        </div>
                     </div>
                  );
               })()}

            {/* Game Complete Message */}
            {gameState === "ready" &&
               currentLevel === maxLevels - 1 &&
               requirementsMet &&
               lastCompletedLevelRef.current === currentLevel && (
                  <div
                     style={{
                        padding: isMobile ? "20px 24px" : "24px 32px",
                        background: "var(--card)",
                        borderRadius: "var(--radius)",
                        color: "var(--text)",
                        fontSize: isMobile ? "1rem" : "1.1rem",
                        fontWeight: 700,
                        textAlign: "center",
                        border: "1px solid var(--border)",
                     }}
                  >
                     <div style={{ marginBottom: "16px", color: "var(--ok)" }}>
                        Game Complete!
                     </div>
                     <div
                        style={{
                           fontSize: isMobile ? "0.9rem" : "1rem",
                           fontWeight: 400,
                           marginBottom: "20px",
                           color: "var(--text-secondary)",
                        }}
                     >
                        All {maxLevels} levels completed!
                        <br />
                        Final Score: {currentScore}
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
