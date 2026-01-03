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
   const startLevelRef = useRef<() => void>(() => {});
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   const barDirectionRef = useRef<1 | -1>(1);
   const isStoppedRef = useRef(false);
   const arenaRef = useRef<HTMLDivElement>(null);
   const trackRef = useRef<HTMLDivElement>(null);
   const zoneRef = useRef<HTMLDivElement>(null);
   const barRef = useRef<HTMLDivElement>(null);
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
   }, []);

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

         // Reset all state before starting new level
         setSuccessfulStops(0);
         setFailedStops(0);
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         setIsStopped(false);
         nextRoundClickedRef.current = false;
         setNextRoundLocked(false);

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
         const animate = () => {
            if (
               gameStateRef.current !== "playing" ||
               requirementsMetRef.current ||
               isStoppedRef.current
            ) {
               return;
            }

            const speed = levelConfig.barSpeed;
            const direction = barDirectionRef.current;
            pos += direction * speed * 0.006;

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
            }

            return newCount;
         });
      } else {
         setFailedStops((prev) => prev + 1);
      }

      // Reset for next attempt after delay (similar to HTML version - 700ms)
      setTimeout(() => {
         if (
            gameStateRef.current === "playing" &&
            !requirementsMetRef.current
         ) {
            isStoppedRef.current = false;
            setIsStopped(false);
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
            const animate = () => {
               if (
                  gameStateRef.current !== "playing" ||
                  requirementsMetRef.current ||
                  isStoppedRef.current
               ) {
                  return;
               }

               const speed = levelConfig.barSpeed;
               const direction = barDirectionRef.current;
               pos += direction * speed * 0.006;

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
            setGameState("ready");
         } else {
            setGameState("failed");
         }
      }
   }, [timeLeft, gameState, currentLevel, successfulStops, getLevelConfig]);

   // Handle level completion
   useEffect(() => {
      if (prevLevelRef.current === null) return;

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

      // Don't set gameState to "playing" here - let startLevel do it after resetting timeLeft
      gameStateRef.current = "ready";
      setGameState("ready");

      if (currentLevel === 0) {
         setTimeout(() => {
            startLevelRef.current(0);
         }, 0);
      } else {
         setTimeout(() => {
            startLevelRef.current(currentLevel);
         }, 1200);
      }
   }, [currentLevel, isPlaying, startLevel]);

   // Progress percentage for header
   const progressPercentage = ((currentLevel + 1) / maxLevels) * 100;

   const levelConfig = getLevelConfig(currentLevel);
   const minStops = levelConfig.minStops;

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
                     {currentLevel + 1 >= maxLevels && gameState === "ready"
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
                           "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))",
                        border: "1px solid rgba(34, 197, 94, 0.4)",
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
                        Successful: {successfulStops}/{minStops}
                     </span>
                  </div>
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
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
                        Failed: {failedStops}
                     </span>
                  </div>
               </div>
            )}

            {/* Game Arena */}
            {gameState === "playing" ? (
               <div
                  ref={arenaRef}
                  onClick={handleStop}
                  style={{
                     position: "relative",
                     width: "100%",
                     maxWidth: "800px",
                     height: isMobile ? "220px" : "220px",
                     borderRadius: "var(--radius)",
                     border: "1px solid var(--border)",
                     background:
                        "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                     boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
                     overflow: "hidden",
                     userSelect: "none",
                     touchAction: "manipulation",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     cursor:
                        gameState === "playing" && !requirementsMet
                           ? "pointer"
                           : "default",
                  }}
               >
                  {/* Track */}
                  <div
                     ref={trackRef}
                     style={{
                        width: "80%",
                        height: "16px",
                        borderRadius: "999px",
                        background: "rgba(255, 255, 255, 0.08)",
                        position: "relative",
                        overflow: "visible",
                     }}
                  >
                     {/* Target Zone */}
                     <div
                        ref={zoneRef}
                        style={{
                           position: "absolute",
                           top: 0,
                           bottom: 0,
                           left: `${targetZone.start}%`,
                           width: `${targetZone.end - targetZone.start}%`,
                           background: "rgba(34, 197, 94, 0.45)",
                           borderRadius: "999px",
                        }}
                     />

                     {/* Moving Bar */}
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
                              "linear-gradient(180deg, rgba(59, 130, 246, 0.9), rgba(59, 130, 246, 0.55))",
                           boxShadow: "0 6px 14px rgba(0, 0, 0, 0.35)",
                           transform: "translateX(-50%)",
                           pointerEvents: "none",
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
                     Successful stops: {successfulStops}/{minStops}
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
                        borderRadius: "12px",
                        color: "var(--text)",
                        fontSize: isMobile ? "1rem" : "1.05rem",
                        fontWeight: 700,
                        cursor: nextRoundLocked
                           ? "not-allowed"
                           : "pointer",
                        opacity: nextRoundLocked ? 0.5 : 1,
                        transition: "all 0.3s ease",
                     }}
                  >
                     Next Round
                  </button>
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
                     textAlign: "center",
                     border: "1px solid var(--border)",
                  }}
               >
                  <div style={{ marginBottom: "16px", color: "var(--warn)" }}>
                     Level {currentLevel + 1} Failed
                  </div>
                  <div
                     style={{
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 400,
                        marginBottom: "20px",
                        color: "var(--text-secondary)",
                     }}
                  >
                     Need: {minStops} successful stops
                     <br />
                     You achieved: {successfulStops} successful stops
                  </div>
               </div>
            )}

            {/* Game Complete Message */}
            {gameState === "ready" && currentLevel === maxLevels - 1 && (
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
