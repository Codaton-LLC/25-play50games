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

interface OneHandModeProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function OneHandMode({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: OneHandModeProps) {
   const defaultLevelDuration = 6; // seconds per level
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
         // Progressive difficulty: 6s at level 1, 3.8s at level 15
         return Math.max(3.8, defaultLevelDuration - level * 0.15);
      },
      [levelRequirements, defaultLevelDuration]
   );

   // Get speed for current level
   const getLevelSpeed = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].speed || 260;
         }
         // Progressive difficulty: 260px/s at level 1, 680px/s at level 15
         return 260 + level * 30;
      },
      [levelRequirements]
   );

   // Get spawn interval for current level
   const getSpawnInterval = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].spawnInterval || 1.1;
         }
         // Progressive difficulty: 1.1s at level 1, 0.6s at level 15
         return Math.max(0.6, 1.1 - level * 0.033);
      },
      [levelRequirements]
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

   // Canvas and game state
   const canvasRef = useRef<HTMLCanvasElement>(null);
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
   const lastTimestampRef = useRef<number>(0);
   const spawnTimerRef = useRef<number>(0);
   const levelStartTimeRef = useRef<number>(0);
   const nextRoundClickedRef = useRef(false);
   const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   const [nextRoundLocked, setNextRoundLocked] = useState(false);

   // Player state
   const playerRef = useRef({
      x: 90,
      y: 0,
      w: 26,
      h: 26,
      vy: 0,
      onGround: true,
   });

   // Obstacles state
   const obstaclesRef = useRef<
      Array<{
         x: number;
         w: number;
         h: number;
         id: number;
         type: "normal" | "boost";
      }>
   >([]);
   const obstacleIdCounterRef = useRef(0);
   const groundYRef = useRef(0);
   const currentLevelRef = useRef(0);
   const lastJumpTimeRef = useRef(0);
   const jumpsUsedRef = useRef(0);
   const boostEffectUntilRef = useRef(0);

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

   // Resize canvas
   const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) {
         ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      groundYRef.current = canvas.clientHeight - 60;
      playerRef.current.y = groundYRef.current - playerRef.current.h;
   }, []);

   useEffect(() => {
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      return () => window.removeEventListener("resize", resizeCanvas);
   }, [resizeCanvas]);

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
   }, []);

   // Collision detection
   const checkCollision = useCallback(
      (
         a: { x: number; y: number; w: number; h: number },
         b: { x: number; y: number; w: number; h: number }
      ) => {
         return (
            a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y
         );
      },
      []
   );

   // Jump function
   const jump = useCallback(() => {
      if (gameStateRef.current !== "playing" || requirementsMetRef.current) {
         return;
      }

      const player = playerRef.current;
      const level = currentLevelRef.current;
      const now = performance.now();
      const baseJump = level >= 8 ? -720 : -620;
      const boostedJump = -900;
      const maxJumps = level >= 8 ? 2 : 1;
      const boostWindowMs = 350;
      const canBoost =
         level >= 8 &&
         !player.onGround &&
         now - lastJumpTimeRef.current <= boostWindowMs;

      if (canBoost && jumpsUsedRef.current < maxJumps) {
         player.vy = boostedJump;
         player.onGround = false;
         lastJumpTimeRef.current = 0;
         jumpsUsedRef.current += 1;
         boostEffectUntilRef.current = performance.now() + 220;
         return;
      }

      if (player.onGround || jumpsUsedRef.current < maxJumps) {
         const isAirJump = !player.onGround && jumpsUsedRef.current > 0;
         player.vy = baseJump;
         player.onGround = false;
         lastJumpTimeRef.current = now;
         jumpsUsedRef.current += 1;
         if (isAirJump) {
            boostEffectUntilRef.current = performance.now() + 180;
         }
      }
   }, []);

   // Update game logic
   const update = useCallback(
      (dt: number, level: number) => {
         const player = playerRef.current;
         const obstacles = obstaclesRef.current;
         const speed = getLevelSpeed(level);
         const spawnInterval = getSpawnInterval(level);

         // Physics
         player.vy += 1600 * dt;
         player.y += player.vy * dt;

         if (player.y + player.h >= groundYRef.current) {
            player.y = groundYRef.current - player.h;
            player.vy = 0;
            player.onGround = true;
            jumpsUsedRef.current = 0;
         }

         // Spawn obstacles
         spawnTimerRef.current += dt;
         if (spawnTimerRef.current >= spawnInterval) {
            const isBoost = level >= 11 && Math.random() < 0.2;
            obstacles.push({
               x: (canvasRef.current?.clientWidth || 800) + 30,
               w: 30,
               h: 30,
               id: obstacleIdCounterRef.current++,
               type: isBoost ? "boost" : "normal",
            });
            spawnTimerRef.current = 0;
         }

         // Move obstacles
         for (const obstacle of obstacles) {
            obstacle.x -= speed * dt;
         }

         // Remove off-screen obstacles
         obstaclesRef.current = obstacles.filter((o) => o.x + o.w > -40);

         // Check collisions
         const playerRect = {
            x: player.x,
            y: player.y,
            w: player.w,
            h: player.h,
         };

         const consumedBoosts = new Set<number>();
         for (const obstacle of obstacles) {
            const obstacleRect = {
               x: obstacle.x,
               y: groundYRef.current - obstacle.h,
               w: obstacle.w,
               h: obstacle.h,
            };

            if (checkCollision(playerRect, obstacleRect)) {
               if (obstacle.type === "boost") {
                  // Collect boost: give an instant upward kick and allow another jump
                  player.vy = -900;
                  player.onGround = false;
                  jumpsUsedRef.current = 0;
                  lastJumpTimeRef.current = 0;
                  boostEffectUntilRef.current = performance.now() + 260;
                  consumedBoosts.add(obstacle.id);
                  continue;
               }

               // Collision detected - game over
               gameStateRef.current = "failed";
               setGameState("failed");
               clearAll();
               return;
            }
         }

         // Remove off-screen or consumed boost obstacles
         obstaclesRef.current = obstacles.filter(
            (o) => o.x + o.w > -40 && !consumedBoosts.has(o.id)
         );
      },
      [getLevelSpeed, getSpawnInterval, checkCollision, clearAll]
   );

   // Draw function
   const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      ctx.clearRect(0, 0, w, h);

      // Draw ground
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.fillRect(0, groundYRef.current, w, 4);

      // Draw player
      ctx.fillStyle = "#6ea8ff";
      if (performance.now() < boostEffectUntilRef.current) {
         const px = playerRef.current.x + playerRef.current.w / 2;
         const py = playerRef.current.y + playerRef.current.h / 2;
         const glow = playerRef.current.w * 1.6;
         const gradient = ctx.createRadialGradient(px, py, 2, px, py, glow);
         gradient.addColorStop(0, "rgba(255, 200, 120, 0.45)");
         gradient.addColorStop(1, "rgba(255, 120, 80, 0)");
         ctx.fillStyle = gradient;
         ctx.beginPath();
         ctx.arc(px, py, glow, 0, Math.PI * 2);
         ctx.fill();
         ctx.fillStyle = "#6ea8ff";
      }
      ctx.fillRect(
         playerRef.current.x,
         playerRef.current.y,
         playerRef.current.w,
         playerRef.current.h
      );

      // Draw obstacles
      for (const obstacle of obstaclesRef.current) {
         ctx.fillStyle = obstacle.type === "boost" ? "#60a5fa" : "#fb7185";
         ctx.fillRect(
            obstacle.x,
            groundYRef.current - obstacle.h,
            obstacle.w,
            obstacle.h
         );
         if (obstacle.type === "boost") {
            const cx = obstacle.x + obstacle.w / 2;
            const cy = groundYRef.current - obstacle.h / 2;
            ctx.fillStyle = "#f97316";
            ctx.beginPath();
            ctx.moveTo(cx, cy - 8);
            ctx.lineTo(cx - 6, cy + 6);
            ctx.lineTo(cx + 6, cy + 6);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#fde047";
            ctx.beginPath();
            ctx.moveTo(cx, cy - 5);
            ctx.lineTo(cx - 4, cy + 4);
            ctx.lineTo(cx + 4, cy + 4);
            ctx.closePath();
            ctx.fill();
         }
      }
   }, []);

   // Start level
   const startLevel = useCallback(
      (level: number) => {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }

         clearAll();

         // Reset state
         const levelDur = getLevelDuration(level);
         setTimeLeft(levelDur);
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         lastCompletedLevelRef.current = null;
         nextRoundClickedRef.current = false;
         setNextRoundLocked(false);

         // Reset player
         playerRef.current = {
            x: 90,
            y: 0,
            w: 26,
            h: 26,
            vy: 0,
            onGround: true,
         };
         jumpsUsedRef.current = 0;
         boostEffectUntilRef.current = 0;

         // Reset obstacles
         obstaclesRef.current = [];
         obstacleIdCounterRef.current = 0;
         spawnTimerRef.current = 0;

         // Set game state to playing
         gameStateRef.current = "playing";
         setGameState("playing");

         // Resize canvas
         resizeCanvas();

         // Set ground position
         const canvas = canvasRef.current;
         if (canvas) {
            groundYRef.current = canvas.clientHeight - 60;
            playerRef.current.y = groundYRef.current - playerRef.current.h;
         }

         // Defer a second resize to ensure layout is stable after state changes
         requestAnimationFrame(() => {
            resizeCanvas();
            const updatedCanvas = canvasRef.current;
            if (updatedCanvas) {
               groundYRef.current = updatedCanvas.clientHeight - 60;
               playerRef.current.y = groundYRef.current - playerRef.current.h;
            }
         });

         // Start timer
         levelStartTimeRef.current = performance.now();
         countdownTimerRef.current = setInterval(() => {
            setTimeLeft((prev: number) => {
               const newTime = Math.max(0, prev - 0.1);
               if (newTime <= 0) {
                  return 0;
               }
               return newTime;
            });
         }, 100);

         // Start game loop
         lastTimestampRef.current = 0;
         const loop = (timestamp: number) => {
            if (gameStateRef.current !== "playing") {
               return;
            }

            if (!lastTimestampRef.current) {
               lastTimestampRef.current = timestamp;
            }

            const dt = Math.min(
               0.033,
               (timestamp - lastTimestampRef.current) / 1000
            );
            lastTimestampRef.current = timestamp;

            update(dt, level);
            draw();

            if (gameStateRef.current === "playing") {
               animationFrameRef.current = requestAnimationFrame(loop);
            }
         };

         animationFrameRef.current = requestAnimationFrame(loop);
      },
      [getLevelDuration, clearAll, resizeCanvas, update, draw]
   );

   // Check if level is complete
   useEffect(() => {
      if (
         gameState !== "playing" ||
         requirementsMet ||
         timeLeft > 0 ||
         gameStateRef.current !== "playing"
      ) {
         return;
      }

      // Time ran out - level complete
      const roundScore = Math.round(100 / maxLevels);
      const completedLevels = currentLevel + 1;
      const newScore = Math.min(100, completedLevels * roundScore);

      setCurrentScore(newScore);
      setTimeout(() => {
         onScoreUpdate(newScore);
      }, 0);

      requirementsMetRef.current = true;
      setRequirementsMet(true);
      lastCompletedLevelRef.current = currentLevel;
      gameStateRef.current = "ready";
      setGameState("ready");
      clearAll();
   }, [
      timeLeft,
      gameState,
      requirementsMet,
      currentLevel,
      maxLevels,
      onScoreUpdate,
      clearAll,
   ]);

   // Handle level completion
   useEffect(() => {
      if (
         gameState === "ready" &&
         currentLevel < maxLevels - 1 &&
         !completionCalledRef.current
      ) {
         return;
      }

      if (
         gameState === "ready" &&
         currentLevel === maxLevels - 1 &&
         requirementsMet &&
         lastCompletedLevelRef.current === currentLevel &&
         !completionCalledRef.current
      ) {
         completionCalledRef.current = true;
         const finalScore = 100;
         setTimeout(() => {
            onComplete(finalScore);
         }, 1000);
      }
   }, [gameState, currentLevel, maxLevels, requirementsMet, onComplete]);

   // Initialize game
   useEffect(() => {
      if (!isPlaying) {
         clearAll();
         return;
      }

      prevLevelRef.current = -1;
      forceStartLevelRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      completionCalledRef.current = false;
      setCurrentLevel(0);
      setCurrentScore(0);
      setRequirementsMet(false);
      lastCompletedLevelRef.current = null;
      currentLevelRef.current = 0;
      setGameState("playing");
   }, [isPlaying, clearAll]);

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
      currentLevelRef.current = currentLevel;
      if (forceStartLevelRef.current === currentLevel) {
         forceStartLevelRef.current = null;
      }

      // Reset state before starting new level
      setRequirementsMet(false);
      requirementsMetRef.current = false;
      lastCompletedLevelRef.current = null;
      nextRoundClickedRef.current = false;
      setNextRoundLocked(false);
      setGameState("playing");
      gameStateRef.current = "playing";

      if (startLevelRef.current) {
         startLevelRef.current(currentLevel);
      }
   }, [isPlaying, currentLevel]);

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Auto-start level 0
   useEffect(() => {
      if (isPlaying && currentLevel === 0 && !startTimeoutRef.current) {
         startTimeoutRef.current = setTimeout(() => {
            if (startLevelRef.current) {
               startLevelRef.current(0);
            }
         }, 0);
      }

      return () => {
         if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
         }
      };
   }, [isPlaying, currentLevel]);

   // Handle next round
   const handleNextRound = useCallback(() => {
      if (nextRoundLocked || nextRoundClickedRef.current) return;
      if (gameState !== "ready" || currentLevel >= maxLevels - 1) return;

      nextRoundClickedRef.current = true;
      setNextRoundLocked(true);

      setTimeout(() => {
         setCurrentLevel((prev) => prev + 1);
         nextRoundClickedRef.current = false;
         setNextRoundLocked(false);
      }, 100);
   }, [gameState, currentLevel, maxLevels]);

   // Handle replay
   const handleReplay = useCallback(() => {
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setRequirementsMet(false);
      requirementsMetRef.current = false;
      lastCompletedLevelRef.current = null;
      nextRoundClickedRef.current = false;
      setNextRoundLocked(false);
      setGameState("playing");
      gameStateRef.current = "playing";

      clearAll();
      setTimeout(() => {
         if (startLevelRef.current) {
            startLevelRef.current(currentLevel);
         }
      }, 100);

      if (maxReplays > 0) {
         setReplaysUsed((prev) => prev + 1);
      }
   }, [maxReplays, replaysUsed, currentLevel, clearAll]);

   // Share functionality
   const gameKey = "play50games_shared_one-hand-mode";

   const getShareableLink = useCallback((): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   }, []);

   const registerShareLink = useCallback(async (shareId: string) => {
      try {
         await registerShare(shareId, "one-hand-mode");
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {
         console.error("Error registering share:", error);
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
               title: "One-Hand Mode",
               text: "Check out this awesome game!",
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

   // Keyboard and mouse controls
   useEffect(() => {
      if (gameState !== "playing" || !isPlaying) return;

      const handleKeyPress = (e: KeyboardEvent) => {
         if (e.code === "Space") {
            e.preventDefault();
            jump();
         }
      };

      const canvas = canvasRef.current;
      const handleClick = () => {
         jump();
      };

      const handleTouch = (e: TouchEvent) => {
         e.preventDefault();
         jump();
      };

      window.addEventListener("keydown", handleKeyPress);
      if (canvas) {
         canvas.addEventListener("click", handleClick);
         canvas.addEventListener("touchstart", handleTouch, { passive: false });
      }

      return () => {
         window.removeEventListener("keydown", handleKeyPress);
         if (canvas) {
            canvas.removeEventListener("click", handleClick);
            canvas.removeEventListener("touchstart", handleTouch);
         }
      };
   }, [gameState, isPlaying, jump]);

   const progressPercentage = ((currentLevel + 1) / maxLevels) * 100;

   return (
      <div
         style={{
            width: "100%",
            maxWidth: "800px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? "16px" : "20px",
            padding: isMobile ? "12px" : "16px",
         }}
      >
         {/* Header */}
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
                  currentLevel + 1 >= maxLevels &&
                  gameState === "ready"
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
                  {Math.max(0, Math.ceil(timeLeft))}s
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

         {/* Game Arena */}
         {gameState === "playing" || gameState === "failed" ? (
            <div
               style={{
                  width: "100%",
                  background: "var(--card)",
                  borderRadius: isMobile ? "16px" : "20px",
                  padding: isMobile ? "12px" : "16px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                  position: "relative",
               }}
            >
               {currentLevel >= 8 && (
                  <div
                     style={{
                        position: "absolute",
                        top: "26px",
                        left: "26px",
                        display: "flex",
                        gap: "8px",
                        zIndex: 2,
                        flexWrap: "wrap",
                     }}
                  >
                     <span
                        style={{
                           padding: "6px 10px",
                           borderRadius: "999px",
                           background: "rgba(59, 130, 246, 0.2)",
                           border: "1px solid rgba(59, 130, 246, 0.5)",
                           color: "var(--text)",
                           fontSize: "0.75rem",
                           fontWeight: 700,
                        }}
                     >
                        Double click activated
                     </span>
                     {currentLevel >= 11 && (
                        <span
                           style={{
                              padding: "6px 10px",
                              borderRadius: "999px",
                              background: "rgba(96, 165, 250, 0.2)",
                              border: "1px solid rgba(96, 165, 250, 0.5)",
                              color: "var(--text)",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                           }}
                        >
                           Boost obstacles activated
                        </span>
                     )}
                  </div>
               )}
               <canvas
                  ref={canvasRef}
                  style={{
                     width: "100%",
                     height: isMobile ? "300px" : "420px",
                     background: "#0f1b33",
                     borderRadius: "14px",
                     display: "block",
                     cursor: "pointer",
                  }}
               />
               <div
                  style={{
                     marginTop: "12px",
                     fontSize: isMobile ? "0.85rem" : "0.9rem",
                     color: "var(--muted)",
                     textAlign: "center",
                  }}
               >
                  Click / Tap / Space = Jump
                  {currentLevel >= 9 && (
                     <div style={{ marginTop: "6px" }}>
                        Level 10+: double click to jump higher
                     </div>
                  )}
               </div>
            </div>
         ) : null}

         {/* Level Complete Message */}
         {gameState === "ready" && currentLevel < maxLevels - 1 && (
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
                     textAlign: "center" as const,
                     boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
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
                  width: "100%",
                  padding: isMobile ? "20px 24px" : "24px 32px",
                  background: "var(--card)",
                  borderRadius: "var(--radius)",
                  color: "var(--text)",
                  fontSize: isMobile ? "1rem" : "1.1rem",
                  fontWeight: 700,
                  textAlign: "center" as const,
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
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
                        "linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(239, 68, 68, 0.1))",
                     border: "2px solid rgba(239, 68, 68, 0.6)",
                     color: "var(--text)",
                     margin: "0 auto",
                  }}
               >
                  <XCircleIcon style={{ width: 20, height: 20 }} />
                  Level {currentLevel + 1} Failed
               </div>
               <div
                  style={{
                     fontSize: isMobile ? "0.95rem" : "1rem",
                     color: "var(--muted)",
                  }}
               >
                  You hit an obstacle! Try again to continue.
               </div>
            </div>
         )}

         {/* Replay and Share Buttons */}
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               gap: "12px",
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
                  }}
               >
                  Link copied! Unlimited replay will unlock when someone opens
                  your link!
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
                     🎉 Someone opened your link! Unlimited replay is now active
                     for 15 minutes!
                  </span>
               </div>
            )}

            <div
               style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  width: "100%",
               }}
            >
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
                        color: "var(--accent)",
                     }}
                  />
                  <span>Share for unlimited</span>
               </button>
            </div>
         </div>
      </div>
   );
}
