"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

interface AvoidRedProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function AvoidRed({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: AvoidRedProps) {
   const maxLevels = config.levels || 10;

   // Level requirements from config (required - each level must have minSurvivalTime)
   const levelRequirements = config.levelRequirements || null;

   const [currentLevel, setCurrentLevel] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "playing" | "paused" | "ready" | "failed"
   >("playing");
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [timeLeft, setTimeLeft] = useState(20); // Will be set from minSurvivalTime
   const [hits, setHits] = useState(0);
   const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
   const [obstacles, setObstacles] = useState<
      Array<{
         id: number;
         x: number;
         y: number;
         vx: number;
         vy: number;
         size: number;
         alive: boolean;
      }>
   >([]);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max replays: 5 for Avoid the Red, unlimited if shared
   const maxReplays = useMemo(() => (hasShared ? 0 : 5), [hasShared]); // 0 = unlimited

   const arenaRef = useRef<HTMLDivElement>(null);
   const playerPosRef = useRef({ x: 0, y: 0 });
   const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
   const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
   const animationFrameRef = useRef<number | null>(null);
   const lastTRef = useRef<number>(0);
   const spawnTRef = useRef<number>(0);
   const gameStateRef = useRef<"playing" | "paused" | "ready" | "failed">(
      "playing"
   );
   const currentLevelRef = useRef(0);
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<() => void>(() => {});
   const completionCalledRef = useRef(false);
   const obstacleIdCounterRef = useRef(0);
   const levelStartTimeRef = useRef<number>(0);
   const timeLeftRef = useRef<number>(20); // Will be set from minSurvivalTime
   const collisionDetectedRef = useRef(false);
   const hitsRef = useRef(0);
   const lastHitRef = useRef(0);
   const obstaclesRef = useRef<
      Array<{
         id: number;
         x: number;
         y: number;
         vx: number;
         vy: number;
         size: number;
         alive: boolean;
      }>
   >([]);

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

   // Share functionality helpers
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0]; // Remove existing params
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5); // Unique share ID
      return `${currentUrl}?shared=${shareId}`;
   };

   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "avoid-red");
         // Store share_id to monitor for clicks (but DON'T activate unlimited hits yet)
         const gameKey = "play50games_shared_avoid-red";
         // Only store share_id, don't set hasShared to true yet
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
         // Note: hasShared remains false until someone clicks the link
      } catch (error) {
         // Error sharing
      }
   };

   // Handle share via Web Share API or fallback
   const handleShare = useCallback(async () => {
      const shareableLink = getShareableLink();
      const shareId = new URL(shareableLink).searchParams.get("shared") || "";

      if (!shareId) return;

      // Register share link in backend (but don't activate unlimited hits yet)
      await registerShareLink(shareId);

      if (navigator.share) {
         try {
            await navigator.share({
               title: "Avoid the Red",
               text: "Check out this game! Share to unlock unlimited hits!",
               url: shareableLink,
            });
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
         } catch (error) {
            // User cancelled or error occurred
         }
      } else {
         // Fallback: copy to clipboard
         try {
            await navigator.clipboard.writeText(shareableLink);
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
         } catch (error) {
            // Failed to copy to clipboard
         }
      }
   }, []);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_avoid-red";
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
                           // Already activated and not expired
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           setTimeout(() => {
                              setUnlimitedActivated(false);
                              setHasShared(false);
                              localStorage.removeItem(gameKey);
                           }, data.expiry - Date.now());
                        } else {
                           // Has clicks but not activated yet - activate now
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           const expiryTime = Date.now() + 15 * 60 * 1000; // 15 minutes
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
                     // Error checking share - clean up
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

      // Check URL for shared parameter
      const urlParams = new URLSearchParams(window.location.search);
      const sharedId = urlParams.get("shared");
      if (sharedId) {
         trackShareClick(sharedId);
      }
   }, []);

   // Periodically check if share has clicks (every 10 seconds)
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         const gameKey = "play50games_shared_avoid-red";
         const stored = localStorage.getItem(gameKey);
         if (stored) {
            try {
               const data = JSON.parse(stored);
               if (data.expiry && Date.now() > data.expiry) {
                  localStorage.removeItem(gameKey);
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  setCurrentShareId(null);
                  setHasShared(false);
                  setUnlimitedActivated(false);
                  return;
               }
            } catch (error) {
               localStorage.removeItem(gameKey);
            }
         }

         try {
            const status = await getShareStatus(currentShareId);
            const hasClicks = status.has_clicks || status.clicks > 0;
            if (hasClicks) {
               // Check if unlimited is not already activated or if it needs to be reactivated
               if (!hasShared) {
                  setUnlimitedActivated(true);
                  setHasShared(true);
                  const expiryTime = Date.now() + 15 * 60 * 1000; // 15 minutes
                  localStorage.setItem(
                     gameKey,
                     JSON.stringify({
                        share_id: currentShareId,
                        expiry: expiryTime,
                        shared: true,
                     })
                  );
                  // Expire after 15 minutes
                  setTimeout(() => {
                     setUnlimitedActivated(false);
                     setHasShared(false);
                     localStorage.removeItem(gameKey);
                  }, 15 * 60 * 1000);
               } else if (hasShared && !unlimitedActivated) {
                  // Reactivate message if hasShared is true but message was hidden
                  setUnlimitedActivated(true);
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
               // Share doesn't exist - deactivate unlimited
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

      // Check immediately, then every 10 seconds
      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000);

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, unlimitedActivated, hasShared]);

   // Helper functions
   const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v));

   const rand = (min: number, max: number) => Math.random() * (max - min) + min;

   const pickEdgeSpawn = (w: number, h: number) => {
      const edge = Math.floor(Math.random() * 4); // 0 top, 1 right, 2 bottom, 3 left
      const pad = 18;
      if (edge === 0)
         return {
            x: rand(pad, w - pad),
            y: -pad,
            vx: rand(-30, 30),
            vy: rand(120, 220),
         };
      if (edge === 1)
         return {
            x: w + pad,
            y: rand(pad, h - pad),
            vx: rand(-220, -120),
            vy: rand(-30, 30),
         };
      if (edge === 2)
         return {
            x: rand(pad, w - pad),
            y: h + pad,
            vx: rand(-30, 30),
            vy: rand(-220, -120),
         };
      return {
         x: -pad,
         y: rand(pad, h - pad),
         vx: rand(120, 220),
         vy: rand(-30, 30),
      };
   };

   const rectsOverlap = (
      ax: number,
      ay: number,
      as: number,
      bx: number,
      by: number,
      bs: number
   ) => {
      const aL = ax - as / 2,
         aR = ax + as / 2,
         aT = ay - as / 2,
         aB = ay + as / 2;
      const bL = bx - bs / 2,
         bR = bx + bs / 2,
         bT = by - bs / 2,
         bB = by + bs / 2;
      return !(aR < bL || aL > bR || aB < bT || aT > bB);
   };

   const stopTimers = useCallback(() => {
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
      lastTRef.current = 0;
      spawnTRef.current = 0;
   }, []);

   // Clear all obstacles and timers
   const clearAll = useCallback(() => {
      setObstacles([]);
      stopTimers();
   }, [stopTimers]);

   // Spawn obstacle
   const spawnObstacle = useCallback(() => {
      if (!arenaRef.current) return;
      const r = arenaRef.current.getBoundingClientRect();
      const p = pickEdgeSpawn(r.width, r.height);
      const size = rand(18, 30);

      const newObstacle = {
         id: obstacleIdCounterRef.current++,
         x: p.x,
         y: p.y,
         vx: p.vx,
         vy: p.vy,
         size,
         alive: true,
      };

      setObstacles((prev) => [...prev, newObstacle]);
   }, []);

   // Get level requirements (must be declared before startLevel)
   const getMinSurvivalTime = useCallback(
      (levelIndex: number = currentLevelRef.current) => {
         if (levelRequirements && levelRequirements[levelIndex]) {
            return levelRequirements[levelIndex].minSurvivalTime || 20;
         }
         return 20; // Default: 20 seconds if no levelRequirements
      },
      [levelRequirements]
   );

   const getMaxHits = useCallback(
      (levelIndex: number = currentLevelRef.current) => {
         // If shared, unlimited hits (return very large number)
         if (hasShared) {
            return 999999; // Unlimited hits
         }
         if (levelRequirements && levelRequirements[levelIndex]) {
            return levelRequirements[levelIndex].maxHits ?? 0;
         }
         return 0; // Default: 0 hits allowed
      },
      [levelRequirements, hasShared]
   );

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
      const initialHits = getMaxHits(0);
      setHits(initialHits);
      hitsRef.current = initialHits;
   }, [isPlaying, getMaxHits]);

   useEffect(() => {
      obstaclesRef.current = obstacles;
   }, [obstacles]);

   // Start level
   const startLevel = useCallback(
      (levelIndex?: number) => {
         const targetLevel = levelIndex ?? currentLevelRef.current;
         currentLevelRef.current = targetLevel;
         clearAll();
         setGameState("playing");
         gameStateRef.current = "playing";
         setRequirementsMet(false);
         requirementsMetRef.current = false;

         // Use minSurvivalTime instead of levelDuration
         const minSurvivalTime = getMinSurvivalTime(targetLevel);
         const maxHits = getMaxHits(targetLevel);
         setTimeLeft(minSurvivalTime);
         setHits(maxHits);
         hitsRef.current = maxHits;
         setObstacles([]);

         // Initialize player position to center
         if (arenaRef.current) {
            const r = arenaRef.current.getBoundingClientRect();
            const centerX = r.width / 2;
            const centerY = r.height / 2;
            playerPosRef.current = { x: centerX, y: centerY };
            setPlayerPos({ x: centerX, y: centerY });
         }

         // Initialize level start time
         levelStartTimeRef.current = performance.now();
         timeLeftRef.current = minSurvivalTime;

         // Start countdown timer
         countdownTimerRef.current = setInterval(() => {
            timeLeftRef.current = Math.max(0, timeLeftRef.current - 1);
            setTimeLeft(timeLeftRef.current);
            if (timeLeftRef.current <= 0) {
               if (countdownTimerRef.current) {
                  clearInterval(countdownTimerRef.current);
                  countdownTimerRef.current = null;
               }
            }
         }, 1000);

         // Start game loop
         const gameLoop = (t: number) => {
            // Always schedule next frame first to ensure loop continues
            animationFrameRef.current = requestAnimationFrame(gameLoop);

            if (
               gameStateRef.current !== "playing" ||
               requirementsMetRef.current
            ) {
               return;
            }

            if (lastTRef.current === 0) {
               lastTRef.current = t;
               return; // Skip first frame to get proper dt
            }
            const dt = t - lastTRef.current;
            lastTRef.current = t;

            // Progressive spawn rate based on elapsed time
            const elapsed =
               (performance.now() - levelStartTimeRef.current) / 1000;
            const spawnEvery = Math.max(140, 360 - elapsed * 8);

            spawnTRef.current += dt;
            if (spawnTRef.current >= spawnEvery) {
               spawnTRef.current = 0;
               const count = Math.random() < 0.18 ? 2 : 1;
               for (let i = 0; i < count; i++) {
                  spawnObstacle();
               }
            }

            // Update obstacles
            if (arenaRef.current) {
               const r = arenaRef.current.getBoundingClientRect();
               const px = playerPosRef.current.x;
               const py = playerPosRef.current.y;

               // Check for collision BEFORE updating obstacles (immediate detection)
               collisionDetectedRef.current = false;
               let hitDetected = false;

               // First pass: check for collisions with current obstacle positions
               const currentObstacles = obstaclesRef.current;
               for (const o of currentObstacles) {
                  if (!o.alive || hitDetected) continue;

                  // Calculate next position
                  const dx = px - o.x;
                  const dy = py - o.y;
                  const len = Math.max(1, Math.hypot(dx, dy));
                  const homing = 14;
                  const newVx = o.vx + (dx / len) * homing * (dt / 1000);
                  const newVy = o.vy + (dy / len) * homing * (dt / 1000);
                  const newX = o.x + newVx * (dt / 1000);
                  const newY = o.y + newVy * (dt / 1000);

                  // Allow collision as soon as any part of obstacle enters the arena
                  const pad = o.size / 2;
                  if (
                     newX < -pad ||
                     newX > r.width + pad ||
                     newY < -pad ||
                     newY > r.height + pad
                  ) {
                     continue;
                  }

                  // Immediate collision detection
                  if (rectsOverlap(px, py, 14, newX, newY, o.size)) {
                     hitDetected = true;
                     collisionDetectedRef.current = true;
                     break; // Stop checking once collision is found
                  }
               }

               // Handle collision immediately (before state updates)
               if (hitDetected && gameStateRef.current === "playing") {
                  const now = performance.now();
                  if (now - lastHitRef.current < 300) {
                     return;
                  }
                  lastHitRef.current = now;

                  // Get current hits and maxHits
                  const maxHits = getMaxHits();
                  const newHits = hitsRef.current - 1;

                  // Update hits immediately
                  hitsRef.current = newHits;
                  setHits(newHits);

                  // Check if hits exceed maxHits
                  if (newHits < 0) {
                     // Game failed - too many hits
                     gameStateRef.current = "failed";
                     setGameState("failed");
                     // Stop timers but keep obstacles visible
                     stopTimers();
                     return; // Stop game loop immediately
                  }
                  // If hits <= maxHits, game continues normally
               }

               // Update obstacles only if no collision detected
               if (!hitDetected) {
                  setObstacles((prev) => {
                     const updated = prev.map((o) => {
                        if (!o.alive) return o;

                        // Homing behavior
                        const dx = px - o.x;
                        const dy = py - o.y;
                        const len = Math.max(1, Math.hypot(dx, dy));
                        const homing = 14;
                        const newVx = o.vx + (dx / len) * homing * (dt / 1000);
                        const newVy = o.vy + (dy / len) * homing * (dt / 1000);

                        const newX = o.x + newVx * (dt / 1000);
                        const newY = o.y + newVy * (dt / 1000);

                        // Remove if far outside
                        const pad = 60;
                        if (
                           newX < -pad ||
                           newX > r.width + pad ||
                           newY < -pad ||
                           newY > r.height + pad
                        ) {
                           return { ...o, alive: false };
                        }

                        return {
                           ...o,
                           x: newX,
                           y: newY,
                           vx: newVx,
                           vy: newVy,
                        };
                     });

                     return updated.filter((o) => o.alive);
                  });
               }
            }
         };

         animationFrameRef.current = requestAnimationFrame(gameLoop);
      },
      [clearAll, spawnObstacle, getMinSurvivalTime, getMaxHits, stopTimers]
   );

   startLevelRef.current = startLevel;

   // Initialize level when isPlaying changes
   useEffect(() => {
      if (isPlaying && currentLevel === 0) {
         startLevel(0);
      }
   }, [isPlaying, currentLevel, startLevel]);

   // Check if level is complete (survived full duration)
   useEffect(() => {
      const minSurvivalTime = getMinSurvivalTime();
      const maxHits = getMaxHits();
      const minSurvivalTimeValue = getMinSurvivalTime();
      const elapsed = minSurvivalTimeValue - timeLeftRef.current;

      if (
         gameState === "playing" &&
         elapsed >= minSurvivalTime &&
         hits >= 0 &&
         !requirementsMetRef.current
      ) {
         // Level complete!
         clearAll();
         requirementsMetRef.current = true;
         setRequirementsMet(true);
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
      }
   }, [
      timeLeft,
      hits,
      gameState,
      clearAll,
      getMinSurvivalTime,
      getMaxHits,
      currentLevel,
      maxLevels,
      onScoreUpdate,
      onComplete,
   ]);

   // Handle level failure
   useEffect(() => {
      if (gameState === "failed") {
         stopTimers();
      }
   }, [gameState, stopTimers]);

   // Update hits when hasShared changes (unlimited activated)
   useEffect(() => {
      if (hasShared) {
         const maxHits = getMaxHits();
         setHits(maxHits);
         hitsRef.current = maxHits;
      }
   }, [hasShared, getMaxHits]);

   // Replay functionality
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return; // No replays left

      // Reset state and restart the level
      setRequirementsMet(false);
      requirementsMetRef.current = false;
      setGameState("playing");
      gameStateRef.current = "playing";
      setHits(0);
      clearAll();
      startLevel(currentLevelRef.current);
      setReplaysUsed((prev) => prev + 1);
   }, [gameState, maxReplays, replaysUsed, startLevel, clearAll]);

   // Handle next round
   const handleNextRound = useCallback(() => {
      if (currentLevel + 1 >= maxLevels) {
         // Game complete
         const finalScore = 100;
         setCurrentScore(finalScore);
         onScoreUpdate(finalScore);
         if (!completionCalledRef.current) {
            completionCalledRef.current = true;
            setTimeout(() => {
               onComplete(finalScore);
            }, 1000);
         }
         return;
      }

      // Advance to next level
      const nextLevel = currentLevel + 1;
      const roundScore = Math.round(100 / maxLevels);
      const newScore = nextLevel * roundScore;
      currentLevelRef.current = nextLevel;
      setCurrentLevel(nextLevel);
      setCurrentScore(newScore);
      onScoreUpdate(newScore);
      startLevel(nextLevel);
   }, [currentLevel, maxLevels, onScoreUpdate, onComplete, startLevel]);

   // Handle repeat round
   const handleRepeatRound = useCallback(() => {
      startLevel(currentLevelRef.current);
   }, [startLevel]);

   // Mouse control
   const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
         if (gameState !== "playing" || requirementsMetRef.current) return;
         if (!arenaRef.current) return;

         const r = arenaRef.current.getBoundingClientRect();
         const x = clamp(e.clientX - r.left, 7, r.width - 7);
         const y = clamp(e.clientY - r.top, 7, r.height - 7);
         playerPosRef.current = { x, y };
         setPlayerPos({ x, y });
      },
      [gameState]
   );

   const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
         if (gameState !== "playing" || requirementsMetRef.current) return;
         if (!arenaRef.current) return;

         const r = arenaRef.current.getBoundingClientRect();
         const x = clamp(e.clientX - r.left, 7, r.width - 7);
         const y = clamp(e.clientY - r.top, 7, r.height - 7);
         playerPosRef.current = { x, y };
         setPlayerPos({ x, y });
      },
      [gameState]
   );

   // Cleanup on unmount
   useEffect(() => {
      return () => {
         clearAll();
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [clearAll]);

   const maxHitsValue = getMaxHits();
   const maxHitsLabel = maxHitsValue >= 999999 ? "∞" : maxHitsValue;
   const hitsLabel = maxHitsValue >= 999999 ? "∞" : hits;
   const progress = ((currentLevel + 1) / maxLevels) * 100;
   // Styling functions - using theme colors
   // Theme colors: --ok: #86efac (rgb: 134, 239, 172), --warn: #fca5a5 (rgb: 252, 165, 165)
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
      border: "1px solid var(--stroke)",
      width: "100%",
   });

   const getNoticeBadgeStyle = (tone: "success" | "danger") => {
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
               border: "1px solid var(--stroke)",
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
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
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
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
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
                        "linear-gradient(90deg, var(--accent), var(--ok))",
                     borderRadius: "999px",
                     transition: "width 0.3s ease",
                  }}
               />
            </div>
         </div>

         {/* Stats Section */}
         <div
            style={{
               display: "flex",
               gap: isMobile ? "12px" : "16px",
               width: "100%",
               maxWidth: "800px",
               justifyContent: "center",
               flexWrap: "wrap",
            }}
         >
            <div
               style={{
                  padding: isMobile ? "8px 12px" : "10px 16px",
                  background:
                     "linear-gradient(135deg, rgba(252, 165, 165, 0.25), rgba(252, 165, 165, 0.12))",
                  border: "2px solid rgba(252, 165, 165, 0.6)",
                  borderRadius: "12px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
               }}
            >
               Hits left: {hitsLabel} / {maxHitsLabel}
            </div>
            <div
               style={{
                  padding: isMobile ? "8px 12px" : "10px 16px",
                  background:
                     "linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(59, 130, 246, 0.12))",
                  border: "2px solid rgba(59, 130, 246, 0.6)",
                  borderRadius: "12px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
               }}
            >
               Obstacles: {obstacles.length}
            </div>
         </div>

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
                     Link copied! Unlimited hits and replays will unlock when
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
                        {isMobile
                           ? "🎉 Someone opened your link! Unlimited hits and replays are now active for 15 minutes!"
                           : "🎉 Someone opened your link! Unlimited hits and replays are now active for 15 minutes!"}
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
                        color: "rgba(59, 130, 246, 0.9)",
                     }}
                  />
                  <span>{isMobile ? "Share" : "Share for unlimited"}</span>
               </button>
            </div>
         )}

         {/* Arena */}
         <div
            ref={arenaRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
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
               cursor:
                  gameState === "playing" && !requirementsMetRef.current
                     ? "crosshair"
                     : "default",
               pointerEvents:
                  gameState === "playing" && !requirementsMetRef.current
                     ? "auto"
                     : "none",
            }}
         >
            {/* Player */}
            <div
               style={{
                  position: "absolute",
                  left: `${playerPos.x}px`,
                  top: `${playerPos.y}px`,
                  transform: "translate(-50%, -50%)",
                  width: "14px",
                  height: "14px",
                  borderRadius: "999px",
                  background: "rgba(110, 168, 255, 0.95)",
                  boxShadow: "0 0 18px rgba(110, 168, 255, 0.45)",
                  pointerEvents: "none",
                  zIndex: 10,
               }}
            />

            {/* Obstacles */}
            {obstacles.map((obs) => (
               <div
                  key={obs.id}
                  style={{
                     position: "absolute",
                     left: `${obs.x}px`,
                     top: `${obs.y}px`,
                     transform: "translate(-50%, -50%)",
                     width: `${obs.size}px`,
                     height: `${obs.size}px`,
                     borderRadius: "12px",
                     background: "rgba(251, 113, 133, 0.9)",
                     boxShadow: "0 0 16px rgba(251, 113, 133, 0.35)",
                     pointerEvents: "none",
                  }}
               />
            ))}

            {/* Game State Message */}
            {gameState === "playing" && (
               <div
                  style={{
                     position: "absolute",
                     top: "18px",
                     left: "50%",
                     transform: "translateX(-50%)",
                     padding: "8px 16px",
                     background: "rgba(15, 27, 51, 0.72)",
                     border: "1px solid rgba(255, 255, 255, 0.12)",
                     borderRadius: "999px",
                     fontSize: isMobile ? "0.75rem" : "0.85rem",
                     fontWeight: 700,
                     color: "var(--text)",
                     pointerEvents: "none",
                  }}
               >
                  Avoid red obstacles!
               </div>
            )}
         </div>

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
                     marginTop: "12px",
                     fontSize: isMobile ? "0.95rem" : "1.05rem",
                     fontWeight: 600,
                     color: "var(--text)",
                     marginBottom: "18px",
                  }}
               >
                  A red obstacle touched you!
               </div>
            </div>
         )}
      </div>
   );
}
