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

import touch from "./skillTouch.module.css";
import ui from "./skillUi.module.css";
import { usePlayAreaInView } from "./usePlayAreaInView";

// One 60 Hz frame. The bar moves by elapsed time scaled to this, so it runs
// at the same speed on every refresh rate (and exactly as before at 60 Hz).
const FRAME_MS = 1000 / 60;
// Cap one step (tab switch, long stall) so the bar never jumps far.
const MAX_STEP_MS = 100;

interface TimingBarProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function TimingBar({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: TimingBarProps) {
   const defaultLevelDuration = 30; // seconds per level
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

   // Get minimum successful stops for current level
   const getMinStops = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].minStops || 3;
         }
         // Progressive difficulty: 3 at level 1, 8 at level 15
         return 3 + Math.floor((level / maxLevels) * 5);
      },
      [levelRequirements, maxLevels]
   );

   // Get target zone width for current level (smaller = harder)
   const getTargetZoneWidth = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].targetZoneWidth || 20;
         }
         // Progressive difficulty: 20% at level 1, 8% at level 15
         return Math.max(8, 20 - Math.floor((level / maxLevels) * 12));
      },
      [levelRequirements, maxLevels]
   );

   // Get bar speed for current level (higher = harder)
   const getBarSpeed = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].barSpeed || 1.2;
         }
         // Progressive difficulty: 1.2 at level 1, 2.5 at level 15
         return 1.2 + (level / maxLevels) * 1.3;
      },
      [levelRequirements, maxLevels]
   );

   // Get level config
   const getLevelConfig = useCallback(
      (level: number) => {
         return {
            duration: getLevelDuration(level),
            minStops: getMinStops(level),
            targetZoneWidth: getTargetZoneWidth(level),
            barSpeed: getBarSpeed(level),
         };
      },
      [getLevelDuration, getMinStops, getTargetZoneWidth, getBarSpeed]
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
   const [barPosition, setBarPosition] = useState(0); // 0-100 (percentage)
   const [barDirection, setBarDirection] = useState<1 | -1>(1); // 1 = right, -1 = left
   const [targetZone, setTargetZone] = useState({ start: 40, end: 60 }); // percentage
   const [successfulStops, setSuccessfulStops] = useState(0);
   const [failedStops, setFailedStops] = useState(0);
   const [isStopped, setIsStopped] = useState(false);
   const [lastStop, setLastStop] = useState<"hit" | "miss" | null>(null); // feedback only
   const [nextRoundLocked, setNextRoundLocked] = useState(false);

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
   const gameStateRef = useRef<"playing" | "ready" | "failed" | "paused">(
      "playing"
   );
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<(level: number) => void>((level: number) => {});
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   const lastCompletedLevelRef = useRef<number | null>(null);
   const barDirectionRef = useRef<1 | -1>(1);
   const isStoppedRef = useRef(false);
   const arenaRef = useRef<HTMLDivElement>(null);
   const trackRef = useRef<HTMLDivElement>(null);
   const zoneRef = useRef<HTMLDivElement>(null);
   const barRef = useRef<HTMLDivElement>(null);
   const nextRoundClickedRef = useRef(false);
   const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

   // A delayed start must not run once the game has exited (unmounted or
   // stopped), or it would restart the countdown and animation after cleanup.
   const mountedRef = useRef(true);
   const isPlayingRef = useRef(isPlaying);
   isPlayingRef.current = isPlaying;
   useEffect(() => {
      mountedRef.current = true;
      return () => {
         mountedRef.current = false;
         clearAll();
      };
   }, [clearAll]);

   useEffect(() => {
      if (!isPlaying) {
         clearAll();
         return;
      }
   }, [isPlaying, clearAll]);

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

         // A pending 700 ms restart from the previous attempt must not start
         // a second bar loop on top of this level's loop.
         if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
            restartTimeoutRef.current = null;
         }

         // Reset all state before starting new level
         setSuccessfulStops(0);
         setFailedStops(0);
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         setIsStopped(false);
         nextRoundClickedRef.current = false;
         setNextRoundLocked(false);
         lastCompletedLevelRef.current = null;

         const levelConfig = getLevelConfig(level);
         const levelDur = levelConfig.duration;
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

         // Initialize target zone and bar position
         const zoneWidth = levelConfig.targetZoneWidth;
         const zoneStart = Math.random() * (100 - zoneWidth);
         const zoneEnd = zoneStart + zoneWidth;
         setTargetZone({ start: zoneStart, end: zoneEnd });
         const initialPos = Math.random();
         setBarPosition(initialPos * 100);
         const initialDirection = Math.random() > 0.5 ? 1 : -1;
         setBarDirection(initialDirection);
         barDirectionRef.current = initialDirection;
         isStoppedRef.current = false;

         // Start bar animation (similar to HTML version)
         let pos = initialPos; // 0..1
         let lastTs: number | null = null;
         const animate = (ts: number) => {
            if (
               gameStateRef.current !== "playing" ||
               requirementsMetRef.current ||
               isStoppedRef.current
            ) {
               return;
            }

            const speed = levelConfig.barSpeed;
            const direction = barDirectionRef.current;
            const dt =
               lastTs === null ? FRAME_MS : Math.min(ts - lastTs, MAX_STEP_MS);
            lastTs = ts;
            pos += direction * speed * 0.006 * (dt / FRAME_MS);

            if (pos >= 1) {
               pos = 1;
               barDirectionRef.current = -1;
               setBarDirection(-1);
            }
            if (pos <= 0) {
               pos = 0;
               barDirectionRef.current = 1;
               setBarDirection(1);
            }

            setBarPosition(pos * 100);
            animationFrameRef.current = requestAnimationFrame(animate);
         };

         animationFrameRef.current = requestAnimationFrame(animate);
      },
      [getLevelConfig]
   );

   startLevelRef.current = startLevel;

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Handle stop (click on arena)
   const handleStop = useCallback(() => {
      if (gameState !== "playing" || requirementsMet || isStoppedRef.current)
         return;

      isStoppedRef.current = true;
      setIsStopped(true);
      if (animationFrameRef.current) {
         cancelAnimationFrame(animationFrameRef.current);
         animationFrameRef.current = null;
      }

      // Check if bar is in target zone (similar to HTML version)
      const bar = barRef.current;
      const zone = zoneRef.current;
      if (!bar || !zone) return;

      const barLeft = bar.offsetLeft;
      const barRight = barLeft + bar.offsetWidth;
      const zoneLeft = zone.offsetLeft;
      const zoneRight = zoneLeft + zone.offsetWidth;

      const hit = barLeft >= zoneLeft && barRight <= zoneRight;
      setLastStop(hit ? "hit" : "miss");

      if (hit) {
         setSuccessfulStops((prev) => {
            const newCount = prev + 1;
            const levelConfig = getLevelConfig(currentLevel);
            const minStops = levelConfig.minStops;

            if (newCount >= minStops && !requirementsMetRef.current) {
               requirementsMetRef.current = true;
               setRequirementsMet(true);
               clearAll();
               gameStateRef.current = "ready";
               setGameState("ready");
               lastCompletedLevelRef.current = currentLevel;
            }

            return newCount;
         });
      } else {
         setFailedStops((prev) => prev + 1);
      }

      // Reset for next attempt after delay (similar to HTML version - 700ms)
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = setTimeout(() => {
         restartTimeoutRef.current = null;
         if (
            mountedRef.current &&
            isPlayingRef.current &&
            gameStateRef.current === "playing" &&
            !requirementsMetRef.current
         ) {
            isStoppedRef.current = false;
            setIsStopped(false);
            setLastStop(null);
            const levelConfig = getLevelConfig(currentLevel);
            const zoneWidth = levelConfig.targetZoneWidth;
            const zoneStart = Math.random() * (100 - zoneWidth);
            const zoneEnd = zoneStart + zoneWidth;
            setTargetZone({ start: zoneStart, end: zoneEnd });
            const newPos = Math.random();
            setBarPosition(newPos * 100);
            const newDirection = Math.random() > 0.5 ? 1 : -1;
            setBarDirection(newDirection);
            barDirectionRef.current = newDirection;

            // Restart animation
            let pos = newPos;
            let lastTs: number | null = null;
            const animate = (ts: number) => {
               if (
                  gameStateRef.current !== "playing" ||
                  requirementsMetRef.current ||
                  isStoppedRef.current
               ) {
                  return;
               }

               const speed = levelConfig.barSpeed;
               const direction = barDirectionRef.current;
               const dt =
                  lastTs === null ? FRAME_MS : Math.min(ts - lastTs, MAX_STEP_MS);
               lastTs = ts;
               pos += direction * speed * 0.006 * (dt / FRAME_MS);

               if (pos >= 1) {
                  pos = 1;
                  barDirectionRef.current = -1;
                  setBarDirection(-1);
               }
               if (pos <= 0) {
                  pos = 0;
                  barDirectionRef.current = 1;
                  setBarDirection(1);
               }

               setBarPosition(pos * 100);
               animationFrameRef.current = requestAnimationFrame(animate);
            };

            animationFrameRef.current = requestAnimationFrame(animate);
         }
      }, 700);
   }, [gameState, requirementsMet, currentLevel, getLevelConfig]);

   // End level when time runs out
   useEffect(() => {
      if (timeLeft === 0 && gameState === "playing") {
         const levelConfig = getLevelConfig(currentLevel);
         const minStops = levelConfig.minStops;

         if (successfulStops >= minStops) {
            requirementsMetRef.current = true;
            setRequirementsMet(true);
            setGameState("ready");
            lastCompletedLevelRef.current = currentLevel;
         } else {
            setGameState("failed");
         }
      }
   }, [timeLeft, gameState, currentLevel, successfulStops, getLevelConfig]);

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
         // Game complete
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
      setGameState("playing");
      gameStateRef.current = "playing";
      setSuccessfulStops(0);
      setFailedStops(0);
      setIsStopped(false);
      isStoppedRef.current = false;
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
   const getShareableLink = useCallback((): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   }, []);

   const registerShareLink = useCallback(async (shareId: string) => {
      try {
         await registerShare(shareId, "timing-bar");
         const gameKey = "play50games_shared_timing-bar";
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
               title: "Timing Bar - Play50Games",
               text: "Check out this timing challenge!",
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
         const gameKey = "play50games_shared_timing-bar";
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
      const gameKey = "play50games_shared_timing-bar";
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

      // Don't start if we're already on this level (unless forced)
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

      // Reset state before starting new level
      setSuccessfulStops(0);
      setFailedStops(0);
      setRequirementsMet(false);
      requirementsMetRef.current = false;
      setIsStopped(false);
      isStoppedRef.current = false;
      nextRoundClickedRef.current = false;
      lastCompletedLevelRef.current = null;

      // Don't set gameState to "playing" here - let startLevel do it after resetting timeLeft
      gameStateRef.current = "ready";
      setGameState("ready");

      if (currentLevel === 0) {
         setTimeout(() => {
            if (!mountedRef.current || !isPlayingRef.current) return;
            startLevelRef.current(0);
         }, 0);
      } else {
         setTimeout(() => {
            if (!mountedRef.current || !isPlayingRef.current) return;
            startLevelRef.current(currentLevel);
         }, 1200);
      }
   }, [currentLevel, isPlaying, startLevel]);

   // Progress percentage for header
   const progressPercentage = ((currentLevel + 1) / maxLevels) * 100;

   const levelConfig = getLevelConfig(currentLevel);
   const minStops = levelConfig.minStops;

   const replayLocked = maxReplays > 0 && replaysUsed >= maxReplays;

   return (
      <>
         <div ref={rootRef} className={ui.root}>
            {/* Header Section */}
            <div className={ui.hud}>
               <div className={ui.hudRow}>
                  <span className={ui.hudStat}>
                     <ArrowPathIcon className={ui.hudIcon} />
                     Level {currentLevel + 1}/{maxLevels}
                  </span>
                  <span className={ui.hudStat}>
                     <TrophyIcon className={ui.hudIconOk} />
                     Score:{" "}
                     {requirementsMet &&
                     lastCompletedLevelRef.current === currentLevel &&
                     currentLevel + 1 >= maxLevels
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
                     style={{ transform: `scaleX(${progressPercentage / 100})` }}
                  />
               </div>
            </div>

            {/* Stats Display */}
            {gameState === "playing" && (
               <div className={ui.statRow}>
                  <div className={ui.statOk}>
                     <CheckCircleIcon className={ui.statIconOk} />
                     <span>
                        Successful:{" "}
                        <span key={successfulStops} className={ui.bump}>
                           {successfulStops}
                        </span>
                        /{minStops}
                     </span>
                  </div>
                  <div className={ui.statWarn}>
                     <XCircleIcon className={ui.statIconWarn} />
                     <span>
                        Failed:{" "}
                        <span key={failedStops} className={ui.bump}>
                           {failedStops}
                        </span>
                     </span>
                  </div>
               </div>
            )}

            {/* Game Arena */}
            {gameState === "playing" ? (
               <div
                  ref={arenaRef}
                  className={`${ui.arena} ${touch.tapArea}`}
                  data-play-area=""
                  onClick={handleStop}
                  style={{
                     height: "220px",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     cursor: !requirementsMet ? "pointer" : "default",
                  }}
               >
                  {/* Track */}
                  <div
                     ref={trackRef}
                     className={lastStop === "miss" ? touch.shake : undefined}
                     style={{
                        width: "80%",
                        height: "16px",
                        borderRadius: "999px",
                        background: "rgba(255, 255, 255, 0.08)",
                        position: "relative",
                        overflow: "visible",
                     }}
                  >
                     {/* Target Zone (its green strings are matched by globals.css for the final games) */}
                     <div
                        ref={zoneRef}
                        style={{
                           position: "absolute",
                           top: 0,
                           bottom: 0,
                           left: `${targetZone.start}%`,
                           width: `${targetZone.end - targetZone.start}%`,
                           background:
                              lastStop === "hit"
                                 ? "rgba(34, 197, 94, 0.75)"
                                 : "rgba(34, 197, 94, 0.45)",
                           transition: "background-color 0.15s ease",
                           borderRadius: "999px",
                        }}
                     />

                     {/* Moving Bar: drawn exactly where the hit test reads it (offsetLeft .. + offsetWidth) */}
                     <div
                        ref={barRef}
                        style={{
                           position: "absolute",
                           top: "-6px",
                           left: `${barPosition}%`,
                           width: "12px",
                           height: "28px",
                           borderRadius: "6px",
                           background:
                              lastStop === "hit"
                                 ? "var(--ok)"
                                 : lastStop === "miss"
                                   ? "var(--warn)"
                                   : "rgb(59, 130, 246)",
                           pointerEvents: "none",
                        }}
                     />
                  </div>
                  {/* hint: the whole arena is the button */}
                  <span aria-hidden="true" className={ui.arenaHint}>
                     {isMobile || isTablet ? "Tap anywhere to stop" : "Click anywhere to stop"}
                  </span>
               </div>
            ) : null}

            {/* Ready for Next Round Message */}
            {gameState === "ready" && currentLevel + 1 < maxLevels && (
               <div className={ui.card}>
                  <div className={ui.cardTitle}>Level {currentLevel + 1} Complete!</div>
                  <div className={ui.cardBody}>
                     Successful stops: <strong>{successfulStops}/{minStops}</strong>
                  </div>
                  <button
                     className={ui.buttonPrimary}
                     onClick={handleNextRound}
                     disabled={nextRoundLocked}
                  >
                     Next Round
                  </button>
               </div>
            )}

            {/* Level Failed Message */}
            {gameState === "failed" && (
               <div className={ui.card}>
                  <div className={ui.cardTitleWarn}>Level {currentLevel + 1} Failed</div>
                  <div className={ui.cardBody}>
                     Need: <strong>{minStops}</strong> successful stops
                     <br />
                     You achieved: <strong>{successfulStops}</strong> successful stops
                  </div>
               </div>
            )}

            {/* Game Complete Message */}
            {gameState === "ready" &&
               currentLevel === maxLevels - 1 &&
               requirementsMet &&
               lastCompletedLevelRef.current === currentLevel && (
                  <div className={ui.card}>
                     <div className={ui.cardTitleOk}>Game Complete!</div>
                     <div className={ui.cardBody}>
                        All {maxLevels} levels completed!
                        <br />
                        Final Score: <strong>{currentScore}</strong>
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
