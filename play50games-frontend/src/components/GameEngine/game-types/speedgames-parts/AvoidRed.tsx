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
import { useInstantPress, useRevealOnPlay, useViewport } from "./touch";
import { arenaHeightFor } from "./AvoidRed.layout";
import fx from "./speedFx.module.css";
import s from "./AvoidRed.module.css";

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
   const vp = useViewport();
   const isMobile = vp.isMobile;
   const arenaHeight = arenaHeightFor(vp.width, vp.height);
   // feedback beats (visual only): bumped on every hit so the keyed flash / "-1" replays
   const [hitFx, setHitFx] = useState(0);
   const rootRef = useRef<HTMLDivElement>(null);
   useRevealOnPlay(rootRef, isPlaying);

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
                  setHitFx((n) => n + 1);

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
         } else {
            const roundScore = Math.round(100 / maxLevels);
            const completedLevels = currentLevel + 1;
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            onScoreUpdate(newScore);
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
      currentLevelRef.current = nextLevel;
      setCurrentLevel(nextLevel);
      if (!requirementsMetRef.current) {
         const roundScore = Math.round(100 / maxLevels);
         const newScore = nextLevel * roundScore;
         setCurrentScore(newScore);
         onScoreUpdate(newScore);
      }
      startLevel(nextLevel);
   }, [currentLevel, maxLevels, onScoreUpdate, onComplete, startLevel]);

   // Handle repeat round
   const handleRepeatRound = useCallback(() => {
      startLevel(currentLevelRef.current);
   }, [startLevel]);

   // Pointer control. Mouse: the dot sits under the cursor (hover, as before). Touch / pen: a 1:1 drag
   // from wherever the finger lands, so the dot stays visible beside the finger and never teleports
   // into an obstacle. Same clamp, same arena, same speed (the finger's own).
   const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);

   const movePlayerTo = useCallback((x: number, y: number) => {
      if (!arenaRef.current) return;
      const r = arenaRef.current.getBoundingClientRect();
      const nx = clamp(x, 7, r.width - 7);
      const ny = clamp(y, 7, r.height - 7);
      playerPosRef.current = { x: nx, y: ny };
      setPlayerPos({ x: nx, y: ny });
   }, []);

   const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
         if (gameState !== "playing" || requirementsMetRef.current) return;
         if (!arenaRef.current) return;
         if (e.pointerType === "mouse") {
            const r = arenaRef.current.getBoundingClientRect();
            movePlayerTo(e.clientX - r.left, e.clientY - r.top);
            return;
         }
         e.preventDefault();
         dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
         try {
            e.currentTarget.setPointerCapture(e.pointerId);
         } catch {
            // capture is best effort
         }
      },
      [gameState, movePlayerTo]
   );

   const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
         if (gameState !== "playing" || requirementsMetRef.current) return;
         if (!arenaRef.current) return;
         if (e.pointerType === "mouse") {
            const r = arenaRef.current.getBoundingClientRect();
            movePlayerTo(e.clientX - r.left, e.clientY - r.top);
            return;
         }
         const drag = dragRef.current;
         if (!drag || drag.id !== e.pointerId) return;
         e.preventDefault();
         const dx = e.clientX - drag.x;
         const dy = e.clientY - drag.y;
         drag.x = e.clientX;
         drag.y = e.clientY;
         movePlayerTo(playerPosRef.current.x + dx, playerPosRef.current.y + dy);
      },
      [gameState, movePlayerTo]
   );

   const handlePointerEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      if (dragRef.current && dragRef.current.id === e.pointerId) {
         dragRef.current = null;
         try {
            e.currentTarget.releasePointerCapture(e.pointerId);
         } catch {
            // already released
         }
      }
   }, []);

   const replayDisabled = maxReplays > 0 && replaysUsed >= maxReplays;
   const replayPress = useInstantPress<HTMLButtonElement>(handleReplay, !replayDisabled);
   const nextRoundPress = useInstantPress<HTMLButtonElement>(handleNextRound);

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
   const hitsLabel = maxHitsValue >= 999999 ? "∞" : Math.max(0, hits); // the rule stores -1 on the fatal hit; the label stays at 0
   const progress = ((currentLevel + 1) / maxLevels) * 100;
   const inPlay = gameState === "playing" && !requirementsMet;
   const iconSize = isMobile ? 15 : 16;

   // Styling helpers - theme colors
   // --ok: #86efac (rgb 134, 239, 172), --warn: #fca5a5 (rgb 252, 165, 165)
   const toneRgb = (tone: "success" | "danger" | "info") =>
      tone === "success" ? "134, 239, 172" : tone === "danger" ? "252, 165, 165" : "59, 130, 246";

   const getActionButtonStyle = (tone: "success" | "danger" | "info", disabled = false): React.CSSProperties => {
      const rgb = toneRgb(tone);
      return {
         padding: isMobile ? "12px 20px" : "12px 24px",
         background: disabled
            ? "rgba(100, 100, 100, 0.2)"
            : `linear-gradient(135deg, rgba(${rgb}, 0.25), rgba(${rgb}, 0.12))`,
         border: disabled ? "1px solid rgba(100, 100, 100, 0.4)" : `2px solid rgba(${rgb}, 0.6)`,
         fontSize: isMobile ? "1rem" : "1.05rem",
         opacity: disabled ? 0.5 : 1,
      };
   };

   const applyActionHover = (
      e: React.MouseEvent<HTMLButtonElement>,
      tone: "success" | "danger" | "info",
      isEnter: boolean
   ) => {
      const target = e.currentTarget;
      if (target.disabled) return;
      const rgb = toneRgb(tone);
      if (isEnter) {
         target.style.background = `linear-gradient(135deg, rgba(${rgb}, 0.35), rgba(${rgb}, 0.2))`;
         target.style.borderColor = `rgba(${rgb}, 0.8)`;
         target.style.boxShadow = `0 6px 14px rgba(${rgb}, 0.35)`;
      } else {
         target.style.background = `linear-gradient(135deg, rgba(${rgb}, 0.25), rgba(${rgb}, 0.12))`;
         target.style.borderColor = `rgba(${rgb}, 0.6)`;
         target.style.boxShadow = "none";
      }
   };

   const getNoticeBadgeStyle = (tone: "success" | "danger"): React.CSSProperties => {
      const rgb = toneRgb(tone);
      return {
         display: "inline-flex",
         alignItems: "center",
         gap: "8px",
         padding: "8px 14px",
         borderRadius: "999px",
         fontWeight: 800,
         fontSize: isMobile ? "0.95rem" : "1.05rem",
         background: `linear-gradient(135deg, rgba(${rgb}, 0.25), rgba(${rgb}, 0.1))`,
         border: `2px solid rgba(${rgb}, 0.6)`,
         color: "var(--text)",
      };
   };

   const replayLabel = maxReplays === 0 ? "(∞)" : `(${maxReplays - replaysUsed}/${maxReplays})`;

   const replayButton = (grow: boolean) => (
      <button
         type="button"
         {...replayPress}
         disabled={replayDisabled}
         className={`${s.btn} ${grow ? s.btnGrow : ""} ${fx.pressable}`}
         style={{
            background: replayDisabled
               ? "rgba(100, 100, 100, 0.2)"
               : "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))",
            border: replayDisabled
               ? "1px solid rgba(100, 100, 100, 0.4)"
               : "1px solid rgba(125, 211, 252, 0.6)",
            opacity: replayDisabled ? 0.5 : 1,
         }}
         onMouseEnter={(e) => {
            if (replayDisabled) return;
            e.currentTarget.style.background =
               "linear-gradient(135deg, rgba(125, 211, 252, 0.3), rgba(125, 211, 252, 0.2))";
            e.currentTarget.style.borderColor = "rgba(125, 211, 252, 0.8)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(125, 211, 252, 0.3)";
         }}
         onMouseLeave={(e) => {
            if (replayDisabled) return;
            e.currentTarget.style.background =
               "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))";
            e.currentTarget.style.borderColor = "rgba(125, 211, 252, 0.6)";
            e.currentTarget.style.boxShadow = "none";
         }}
      >
         <ArrowPathRoundedSquareIcon
            style={{
               width: 20,
               height: 20,
               color: replayDisabled ? "var(--muted)" : "var(--accent)",
            }}
         />
         <span>Replay {replayLabel}</span>
      </button>
   );

   return (
      <div ref={rootRef} className={`${s.root} ${vp.isMobile || vp.isShort ? s.rootCompact : ""}`}>
         {/* HUD: level / score / time, progress, hits + obstacles */}
         <div className={s.hud}>
            <div className={s.hudRow}>
               <span className={s.hudItem}>
                  <ArrowPathIcon style={{ width: iconSize, height: iconSize, color: "var(--accent)" }} />
                  Level {currentLevel + 1} / {maxLevels}
               </span>
               <span className={s.hudItem}>
                  <TrophyIcon style={{ width: iconSize, height: iconSize, color: "var(--ok)" }} />
                  Score:{" "}
                  {currentLevel + 1 >= maxLevels && gameState === "ready"
                     ? 100
                     : currentScore}{" "}
                  / 100
               </span>
               <span className={s.hudItem}>
                  <ClockIcon style={{ width: iconSize, height: iconSize, color: "var(--accent)" }} />
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
            <div className={s.chips}>
               <div
                  key={`hits-${hitFx}`}
                  className={`${s.chip} ${hitFx > 0 ? fx.missShake : ""}`}
                  style={{
                     background:
                        "linear-gradient(135deg, rgba(252, 165, 165, 0.25), rgba(252, 165, 165, 0.12))",
                     border: "2px solid rgba(252, 165, 165, 0.6)",
                  }}
               >
                  Hits left: {hitsLabel} / {maxHitsLabel}
               </div>
               <div
                  className={s.chip}
                  style={{
                     background:
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(59, 130, 246, 0.12))",
                     border: "2px solid rgba(59, 130, 246, 0.6)",
                  }}
               >
                  Obstacles: {obstacles.length}
               </div>
            </div>
         </div>

         {/* Arena (+ overlays for the level results) */}
         <div className={s.arenaWrap} style={{ height: `${arenaHeight}px` }}>
            <div
               ref={arenaRef}
               className={s.arena}
               onPointerDown={handlePointerDown}
               onPointerMove={handlePointerMove}
               onPointerUp={handlePointerEnd}
               onPointerCancel={handlePointerEnd}
               style={{
                  height: `${arenaHeight}px`,
                  cursor: inPlay ? "crosshair" : "default",
                  pointerEvents: inPlay ? "auto" : "none",
               }}
            >
               {/* Player (14 px hit box, as the rules define; the halo is visual only) */}
               <div
                  style={{
                     position: "absolute",
                     left: `${playerPos.x}px`,
                     top: `${playerPos.y}px`,
                     transform: "translate(-50%, -50%)",
                     width: "14px",
                     height: "14px",
                     pointerEvents: "none",
                     zIndex: 10,
                  }}
               >
                  <div
                     key={`dot-${hitFx}`}
                     className={hitFx > 0 ? fx.missShake : undefined}
                     style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "999px",
                        background: "rgba(110, 168, 255, 0.95)",
                        boxShadow: vp.isTouch
                           ? "0 0 0 8px rgba(110, 168, 255, 0.14), 0 0 18px rgba(110, 168, 255, 0.45)"
                           : "0 0 18px rgba(110, 168, 255, 0.45)",
                     }}
                  />
               </div>

               {/* Floating "-1" on a hit */}
               {hitFx > 0 && gameState !== "ready" && (
                  <div
                     key={`float-${hitFx}`}
                     className={fx.floatScore}
                     style={{
                        left: `${playerPos.x}px`,
                        top: `${playerPos.y - 16}px`,
                        color: "var(--warn)",
                        fontSize: "1.1rem",
                        zIndex: 12,
                     }}
                  >
                     -1
                  </div>
               )}

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
                        borderRadius: "3px",
                        background: "rgba(251, 113, 133, 0.9)",
                        boxShadow: "0 0 16px rgba(251, 113, 133, 0.35)",
                        pointerEvents: "none",
                     }}
                  />
               ))}

               {/* Game State Message */}
               {gameState === "playing" && (
                  <div key={`hint-${currentLevel}-${replaysUsed}`} className={s.hint}>
                     {vp.isTouch ? "Drag anywhere to dodge the red!" : "Avoid red obstacles!"}
                  </div>
               )}
            </div>

            {/* Hit flash (keyed so it replays per hit) */}
            {hitFx > 0 && <div key={`flash-${hitFx}`} className={`${s.flash} ${fx.flashBad}`} />}
            {gameState === "ready" && <div key={`ok-${currentLevel}`} className={`${s.flash} ${fx.flashOk}`} />}

            {/* Ready for Next Round */}
            {gameState === "ready" && currentLevel + 1 < maxLevels && (
               <div className={`${s.overlay} ${fx.fadeUp}`}>
                  <div className={s.card}>
                     <div style={getNoticeBadgeStyle("success")}>
                        <CheckCircleIcon style={{ width: 20, height: 20 }} />
                        Level {currentLevel + 1} Complete
                     </div>
                     <div className={s.cardText}>Are you ready for next round?</div>
                     <button
                        type="button"
                        {...nextRoundPress}
                        className={`${s.btn} ${fx.pressable}`}
                        style={getActionButtonStyle("success")}
                        onMouseEnter={(e) => applyActionHover(e, "success", true)}
                        onMouseLeave={(e) => applyActionHover(e, "success", false)}
                     >
                        Next Round
                     </button>
                  </div>
               </div>
            )}

            {/* Game Complete */}
            {gameState === "ready" && currentLevel + 1 >= maxLevels && (
               <div className={`${s.overlay} ${fx.fadeUp}`}>
                  <div className={s.card}>
                     <div style={getNoticeBadgeStyle("success")}>
                        <TrophyIcon style={{ width: 20, height: 20 }} />
                        Game Complete!
                     </div>
                     <div className={s.cardText}>All {maxLevels} levels completed!</div>
                     <div style={{ fontSize: "0.95rem", opacity: 0.8 }}>Final Score: 100</div>
                  </div>
               </div>
            )}

            {/* Level Failed */}
            {gameState === "failed" && (
               <div className={`${s.overlay} ${fx.fadeUp}`}>
                  <div className={s.card}>
                     <div style={getNoticeBadgeStyle("danger")}>
                        <XCircleIcon style={{ width: 20, height: 20 }} />
                        Level {currentLevel + 1} Failed
                     </div>
                     <div className={s.cardText}>A red obstacle touched you!</div>
                     {replayButton(false)}
                     {replayDisabled && (
                        <div style={{ marginTop: "10px", fontSize: "0.875rem", color: "var(--muted)", fontWeight: 600 }}>
                           No replays left. Share for unlimited replays.
                        </div>
                     )}
                  </div>
               </div>
            )}
         </div>

         {/* Action Buttons: Replay, Share */}
         {(gameState === "playing" || gameState === "failed") && (
            <div className={s.actions}>
               {/* Share Success Message */}
               {shareSuccess && !unlimitedActivated && (
                  <div
                     className={`${s.note} ${fx.fadeUp}`}
                     style={{
                        background: "rgba(134, 239, 172, 0.2)",
                        border: "2px solid rgba(134, 239, 172, 0.6)",
                        color: "var(--ok)",
                     }}
                  >
                     Link copied! Unlimited hits and replays will unlock when
                     someone opens your link!
                  </div>
               )}

               {/* Unlimited Activated Message */}
               {unlimitedActivated && (
                  <div
                     className={`${s.note} ${fx.fadeUp}`}
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                        border: "2px solid rgba(59, 130, 246, 0.6)",
                        color: "var(--text)",
                     }}
                  >
                     <CheckCircleIcon
                        style={{
                           width: 18,
                           height: 18,
                           color: "rgba(59, 130, 246, 0.9)",
                           flexShrink: 0,
                        }}
                     />
                     <span>
                        🎉 Someone opened your link! Unlimited hits and replays are now active for 15 minutes!
                     </span>
                  </div>
               )}

               {/* on a failed level the Replay sits in the arena's overlay (above the banner) */}
               {gameState !== "failed" && replayButton(true)}

               <button
                  type="button"
                  onClick={handleShare}
                  className={`${s.btn} ${s.btnGrow} ${fx.pressable}`}
                  style={{
                     background:
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                     border: "1px solid rgba(59, 130, 246, 0.6)",
                  }}
                  onMouseEnter={(e) => {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.2))";
                     e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.8)";
                     e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))";
                     e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.6)";
                     e.currentTarget.style.boxShadow = "none";
                  }}
               >
                  <ShareIcon style={{ width: 20, height: 20, color: "rgba(59, 130, 246, 0.9)" }} />
                  <span>Share for unlimited</span>
               </button>
            </div>
         )}
      </div>
   );
}
