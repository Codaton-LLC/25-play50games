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
   HandRaisedIcon,
   BoltIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";
import { TOUCH_SURFACE, useViewport, useRevealOnPlay, useInstantPress } from "./touch";
import { tapButtonSize, ringStroke } from "./TapCounter.layout";
import fx from "./speedFx.module.css";
import styles from "./TapCounter.module.css";

interface TapCounterProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function TapCounter({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: TapCounterProps) {
   const maxLevels = config?.levels ? Number(config.levels) : 15;
   const defaultLevelDuration = 10; // 10 seconds per level
   const levelRequirements = config?.levelRequirements || null;

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

   // Get minimum taps required for current level
   const getMinTaps = useCallback(() => {
      if (levelRequirements && levelRequirements[currentLevel]) {
         return (
            levelRequirements[currentLevel].minTaps || 20 + currentLevel * 5
         );
      }
      // Default progression: 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90
      return 20 + currentLevel * 5;
   }, [levelRequirements, currentLevel]);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "playing" | "ready" | "failed" | "paused"
   >("playing");
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [timeLeft, setTimeLeft] = useState(() => {
      return getLevelDuration(0);
   });
   const [taps, setTaps] = useState(0);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);
   const [tapFeedback, setTapFeedback] = useState(false);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5;

   const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
   const gameStateRef = useRef<"playing" | "ready" | "failed" | "paused">(
      "playing"
   );
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<(level: number) => void>((level: number) => {});
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   const lastTapTimeRef = useRef<number>(0);
   const tapRateRef = useRef<number>(0);

   // Layout plumbing (mobile/tablet pass): live viewport for the button size, reveal on play.
   const vp = useViewport();
   const rootRef = useRef<HTMLDivElement>(null);
   useRevealOnPlay(rootRef, isPlaying);

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
      setTaps(0);
      lastTapTimeRef.current = 0;
      tapRateRef.current = 0;
   }, [isPlaying]);

   // Start level function
   const startLevel = useCallback(
      (level: number) => {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }

         setCurrentLevel(level);
         setTaps(0);
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         gameStateRef.current = "playing";
         setGameState("playing");
         lastTapTimeRef.current = 0;
         tapRateRef.current = 0;

         const levelDur = getLevelDuration(level);
         setTimeLeft(levelDur);

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
      },
      [getLevelDuration]
   );

   startLevelRef.current = startLevel;

   // Check if requirements are met
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const minTaps = getMinTaps();
      if (taps >= minTaps) {
         setRequirementsMet(true);
         requirementsMetRef.current = true;
         setGameState("ready");
         gameStateRef.current = "ready";

         // Calculate score based on completed levels (not performance)
         const roundScore = Math.round(100 / maxLevels);
         const completedLevels = currentLevel + 1;
         const newScore = Math.min(100, completedLevels * roundScore);

         setCurrentScore(newScore);
         onScoreUpdate(newScore);

         // Complete game if last level
         if (currentLevel === maxLevels - 1) {
            const finalScore = 100;
            setTimeout(() => {
               if (!completionCalledRef.current) {
                  completionCalledRef.current = true;
                  onComplete(finalScore);
               }
            }, 1000);
         }
      }
   }, [
      taps,
      gameState,
      requirementsMet,
      currentLevel,
      maxLevels,
      getMinTaps,
      onScoreUpdate,
      onComplete,
   ]);

   // Handle time expiration - show failed state
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet || timeLeft > 0) return;

      const minTaps = getMinTaps();
      if (taps < minTaps) {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         setGameState("failed");
         gameStateRef.current = "failed";
      }
   }, [timeLeft, gameState, requirementsMet, taps, getMinTaps]);

   useEffect(() => {
      requirementsMetRef.current = requirementsMet;
   }, [requirementsMet]);

   useEffect(() => {
      gameStateRef.current = gameState;
   }, [gameState]);

   // Handle tap
   const handleTap = useCallback(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;

      // Calculate tap rate (taps per second)
      if (timeSinceLastTap > 0 && timeSinceLastTap < 2000) {
         // Only update if reasonable time difference
         const currentRate = 1000 / timeSinceLastTap;
         tapRateRef.current = tapRateRef.current * 0.7 + currentRate * 0.3; // Smooth average
      }

      lastTapTimeRef.current = now;

      setTaps((prev) => prev + 1);
      setTapFeedback(true);
      setTimeout(() => setTapFeedback(false), 100);
   }, [gameState, requirementsMet]);

   // Keyboard support - Space or Enter to tap
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const handleKeyPress = (e: KeyboardEvent) => {
         if (
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement
         ) {
            return;
         }

         if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            handleTap();
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [gameState, requirementsMet, handleTap]);

   // Progress calculation - based on completed levels
   const progress = useMemo(() => {
      return maxLevels > 0
         ? Math.min(100, (currentLevel / maxLevels) * 100)
         : 0;
   }, [currentLevel, maxLevels]);

   // Share functionality
   // Share functionality
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "tap-counter");
         const gameKey = "play50games_shared_tap-counter";
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
               title: "Tap Counter Game",
               text: "Check out this awesome Tap Counter game!",
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

   // Replay functionality
   const handleReplay = useCallback(() => {
      if (replaysUsed >= maxReplays && !unlimitedActivated) {
         return;
      }

      if (replaysUsed < maxReplays) {
         setReplaysUsed((prev) => prev + 1);
      }

      setGameState("playing");
      gameStateRef.current = "playing";
      setRequirementsMet(false);
      requirementsMetRef.current = false;
      setTaps(0);
      lastTapTimeRef.current = 0;
      tapRateRef.current = 0;
      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);

      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
      }

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
   }, [
      replaysUsed,
      maxReplays,
      unlimitedActivated,
      currentLevel,
      getLevelDuration,
   ]);

   // Check if share has clicks
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         const gameKey = "play50games_shared_tap-counter";
         try {
            const status = await getShareStatus(currentShareId);
            const hasClicks = status.has_clicks || status.clicks > 0;
            if (hasClicks && !hasShared) {
               // Share has clicks - activate unlimited replays with expiry
               setHasShared(true);
               setUnlimitedActivated(true);
               setReplaysUsed(0); // Reset replay count

               const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes
               localStorage.setItem(
                  gameKey,
                  JSON.stringify({
                     share_id: currentShareId,
                     shared: true,
                     expiry: expiry,
                  })
               );

               // Set timeout to expire after 15 minutes
               setTimeout(() => {
                  setUnlimitedActivated(false);
                  setHasShared(false);
                  localStorage.removeItem(gameKey);
               }, 15 * 60 * 1000);

               // Stop checking once activated
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
            }
         } catch (error) {
            // Error checking share status - share doesn't exist, deactivate unlimited
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
      const gameKey = "play50games_shared_tap-counter";
      const stored = localStorage.getItem(gameKey);
      if (stored) {
         try {
            const data = JSON.parse(stored);
            // Check if share has expired
            if (data.expiry && Date.now() > data.expiry) {
               // Share expired - clean up
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
                           setReplaysUsed(0);

                           // Set timeout to expire after remaining time
                           const remainingTime = data.expiry - Date.now();
                           if (remainingTime > 0) {
                              setTimeout(() => {
                                 setUnlimitedActivated(false);
                                 setHasShared(false);
                                 localStorage.removeItem(gameKey);
                              }, remainingTime);
                           }
                        } else {
                           // Has clicks but not activated yet - activate now
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           setReplaysUsed(0);
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
                     // Error checking share (404 or other) - clean up
                     localStorage.removeItem(gameKey);
                     setCurrentShareId(null);
                  }
               };
               verifyShare();
            }
         } catch (error) {
            // Error parsing stored data - clean up
            localStorage.removeItem(gameKey);
         }
      }

      // Check URL for shared parameter
      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
         // Track the share click when someone opens the link
         trackShareClick(sharedBy);
         // Only set currentShareId if this is the share we created (exists in localStorage)
         // This prevents the person opening the link from activating unlimited for themselves
         const stored = localStorage.getItem(gameKey);
         if (stored) {
            try {
               const data = JSON.parse(stored);
               if (data.share_id === sharedBy) {
                  // This is our share - set it to check for clicks
                  setCurrentShareId(sharedBy);
               }
            } catch (error) {
               // Error parsing stored data
            }
         }
      }
   }, []);

   // Cleanup on unmount
   useEffect(() => {
      return () => {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
         }
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, []);

   // Auto-start first level when isPlaying becomes true
   useEffect(() => {
      if (
         isPlaying &&
         gameState === "playing" &&
         currentLevel === 0 &&
         taps === 0 &&
         timeLeft === getLevelDuration(0)
      ) {
         if (prevLevelRef.current === null) {
            prevLevelRef.current = -1;
            startLevel(0);
         }
      }
   }, [
      isPlaying,
      gameState,
      currentLevel,
      taps,
      timeLeft,
      getLevelDuration,
      startLevel,
   ]);

   // Force start level if needed
   useEffect(() => {
      if (
         forceStartLevelRef.current !== null &&
         forceStartLevelRef.current === currentLevel &&
         prevLevelRef.current !== currentLevel
      ) {
         startLevel(forceStartLevelRef.current);
         prevLevelRef.current = currentLevel;
         forceStartLevelRef.current = null;
      }
   }, [currentLevel, startLevel]);

   const minTaps = getMinTaps();
   const tapsRemaining = Math.max(0, minTaps - taps);
   const tapProgress = useMemo(() => {
      if (minTaps <= 0) return 0;
      return Math.min(100, (taps / minTaps) * 100);
   }, [taps, minTaps]);

   // Handle next round
   const handleNextRound = useCallback(() => {
      const completedLevels = currentLevel + 1;

      if (completedLevels >= maxLevels) {
         const finalScore = 100;
         if (!completionCalledRef.current) {
            completionCalledRef.current = true;
            onComplete(finalScore);
         }
      } else {
         if (!requirementsMetRef.current) {
            const roundScore = Math.round(100 / maxLevels);
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            onScoreUpdate(newScore);
         }
         startLevel(currentLevel + 1);
      }
   }, [currentLevel, maxLevels, startLevel, onScoreUpdate, onComplete]);

   // Press plumbing (mobile/tablet pass): Next Round and Replay fire on pointerdown. Share keeps the click,
   // because navigator.share / the clipboard need the user activation a touch pointerdown does not grant.
   const noReplays = maxReplays > 0 && replaysUsed >= maxReplays;
   const nextPress = useInstantPress<HTMLButtonElement>(handleNextRound);
   const replayPress = useInstantPress<HTMLButtonElement>(handleReplay, !noReplays);

   // Layout from the live viewport: the ring's diameter and stroke (rules untouched).
   const size = tapButtonSize(vp);
   const stroke = ringStroke(size);
   const radius = size / 2 - stroke / 2;
   const circumference = 2 * Math.PI * radius;
   // Compact spacing on phones and on any viewport under 900 px tall (landscape tablets, short windows);
   // the classic 500 px play-area floor stays only on tall desktop windows.
   const compact = isMobile || vp.height < 900;
   const canTap = gameState === "playing" && !requirementsMet;
   const nearGoal = canTap && tapProgress >= 75 && tapProgress < 100;

   const chipStyle: React.CSSProperties = {
      padding: isMobile ? "7px 12px" : "9px 16px",
      fontSize: isMobile ? "13px" : "0.95rem",
   };
   const headerIcon = {
      width: isMobile ? 14 : 16,
      height: isMobile ? 14 : 16,
      flexShrink: 0,
   };

   // Replay + Share row: under the play area while playing, inside the level-failed notice otherwise
   // (one implementation, the same handlers).
   const renderActions = () => (
      <div className={styles.actions}>
         {/* Share Success Message */}
         {shareSuccess && !unlimitedActivated && (
            <div
               style={{
                  width: "100%",
                  padding: "10px 12px",
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
                  padding: isMobile ? "10px 12px" : "8px 16px",
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

         <button
            type="button"
            className={`${styles.btn} ${styles.btnGrow} ${styles.btnReplay} ${fx.pressable}`}
            {...replayPress}
            disabled={noReplays}
            style={{
               ...TOUCH_SURFACE,
               padding: isMobile ? "10px 10px" : "10px 20px",
               fontSize: isMobile ? "0.9rem" : "0.95rem",
            }}
         >
            <ArrowPathRoundedSquareIcon
               style={{
                  width: isMobile ? 18 : 20,
                  height: isMobile ? 18 : 20,
                  color: noReplays ? "var(--muted)" : "var(--accent)",
                  flexShrink: 0,
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
            className={`${styles.btn} ${styles.btnGrow} ${styles.btnShare} ${fx.pressable}`}
            onClick={handleShare}
            style={{
               ...TOUCH_SURFACE,
               padding: isMobile ? "10px 10px" : "10px 20px",
               fontSize: isMobile ? "0.9rem" : "0.95rem",
            }}
         >
            <ShareIcon
               style={{
                  width: isMobile ? 18 : 20,
                  height: isMobile ? 18 : 20,
                  flexShrink: 0,
               }}
            />
            <span>{isMobile ? "Share" : "Share for unlimited"}</span>
         </button>
      </div>
   );

   return (
      <div
         ref={rootRef}
         className={styles.root}
         style={{
            ...TOUCH_SURFACE,
            padding: isMobile ? "10px 12px" : "20px",
            // The game is the last thing on the page: this room lets it scroll above the
            // fixed cookie banner (~190 px on a 360 px phone, ~90 px on tablets).
            paddingBottom: `calc(env(safe-area-inset-bottom) + ${
               isMobile ? 190 : 110
            }px)`,
            gap: isMobile ? "12px" : isTablet ? "16px" : "24px",
         }}
      >
         {/* Header card: level / score / time + level progress */}
         <div
            className={styles.card}
            style={{
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "12px 14px" : "16px 20px",
            }}
         >
            <div
               style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: isMobile ? "13px" : "0.875rem",
                  color: "var(--muted)",
                  fontWeight: 500,
                  marginBottom: isMobile ? "8px" : "12px",
                  flexWrap: "wrap",
                  gap: isMobile ? "6px 8px" : "6px 10px",
               }}
            >
               <span
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "6px",
                  }}
               >
                  <ArrowPathIcon
                     style={{ ...headerIcon, color: "var(--accent)" }}
                  />
                  {isMobile
                     ? `Level ${currentLevel + 1}/${maxLevels}`
                     : `Level ${currentLevel + 1} / ${maxLevels}`}
               </span>
               <span
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "6px",
                  }}
               >
                  <TrophyIcon style={{ ...headerIcon, color: "var(--ok)" }} />
                  {isMobile ? "Score " : "Score: "}
                  {currentLevel + 1 >= maxLevels && gameState === "ready"
                     ? 100
                     : currentScore}
                  {isMobile ? "/100" : " / 100"}
               </span>
               <span
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "6px",
                  }}
               >
                  <ClockIcon
                     style={{ ...headerIcon, color: "var(--accent)" }}
                  />
                  {isMobile ? "Time " : "Time: "}
                  {timeLeft}s
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
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "999px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Game Board */}
         <div
            className={styles.board}
            style={{ gap: isMobile ? "12px" : isTablet ? "16px" : "24px" }}
         >
            {/* Stats */}
            <div
               className={styles.chips}
               style={{ gap: isMobile ? "8px" : "12px" }}
            >
               <div className={`${styles.chip} ${styles.chipTaps}`} style={chipStyle}>
                  <HandRaisedIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                  Taps: {taps}
               </div>
               <div className={`${styles.chip} ${styles.chipRate}`} style={chipStyle}>
                  <BoltIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                  Rate: {tapRateRef.current.toFixed(1)}/s
               </div>
               <div className={`${styles.chip} ${styles.chipNeed}`} style={chipStyle}>
                  <TrophyIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                  Need: {minTaps}
               </div>
            </div>

            {/* Play area: sized by the ring, the level notices sit over it (above the cookie banner) */}
            <div className={styles.areaWrap}>
               <div
                  className={styles.area}
                  style={{
                     padding: compact ? "16px" : "32px",
                     gap: compact ? "12px" : "24px",
                     minHeight:
                        isMobile || isTablet || vp.height < 1000 ? undefined : "500px",
                  }}
               >
                  {/* Tap Target with Circular Progress */}
                  <div
                     className={`${styles.ringWrap} ${nearGoal ? fx.pulse : ""}`}
                     style={{ width: `${size}px`, height: `${size}px` }}
                  >
                     <svg
                        className={styles.ring}
                        width={size}
                        height={size}
                        aria-hidden="true"
                     >
                        {/* Background circle */}
                        <circle
                           cx={size / 2}
                           cy={size / 2}
                           r={radius}
                           fill="none"
                           stroke="rgba(59, 130, 246, 0.2)"
                           strokeWidth={stroke}
                        />
                        {/* Progress circle */}
                        <circle
                           className={styles.ringProgress}
                           cx={size / 2}
                           cy={size / 2}
                           r={radius}
                           fill="none"
                           stroke={
                              tapProgress >= 100 ? "var(--ok)" : "var(--accent)"
                           }
                           strokeWidth={stroke}
                           strokeLinecap="round"
                           strokeDasharray={`${circumference}`}
                           strokeDashoffset={`${
                              circumference * (1 - tapProgress / 100)
                           }`}
                        />
                     </svg>
                     {/* Tap Button: every pointerdown (each thumb) counts once; nothing dedupes */}
                     <button
                        type="button"
                        className={`${styles.tapBtn} ${
                           tapFeedback ? styles.tapBtnHit : ""
                        }`}
                        onPointerDown={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           handleTap();
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        disabled={!canTap}
                     >
                        <div
                           key={`count-${taps}`}
                           className={`${styles.count} ${
                              taps > 0 ? fx.hitPop : ""
                           }`}
                           style={{ fontSize: `${Math.round(size * 0.32)}px` }}
                        >
                           {taps}
                        </div>
                        <div className={styles.countLabel}>Taps</div>
                     </button>
                     {/* Per-tap ripple + floating "+1", keyed on the count so they replay every tap */}
                     {taps > 0 && canTap && (
                        <>
                           <span
                              key={`ripple-${taps}`}
                              className={styles.ripple}
                              aria-hidden="true"
                           />
                           <span
                              key={`plus-${taps}`}
                              className={`${fx.floatScore} ${styles.plusOne}`}
                              aria-hidden="true"
                           >
                              +1
                           </span>
                        </>
                     )}
                  </div>

                  {/* Requirements */}
                  <div className={styles.goal}>
                     <div className={styles.goalMain}>
                        Target: {minTaps} taps in {getLevelDuration(currentLevel)}s
                     </div>
                     <div className={styles.goalSub}>
                        {tapsRemaining > 0
                           ? `${tapsRemaining} more taps needed`
                           : "Level Complete!"}
                     </div>
                  </div>
               </div>

               {/* Level notices (ready / complete / failed) over the play area */}
               {gameState !== "playing" && (
                  <div className={`${styles.overlay} ${fx.fadeUp}`}>
                     <div
                        className={styles.notice}
                        style={{ fontSize: isMobile ? "1rem" : "1.1rem" }}
                     >
                        {/* Ready for Next Round Message */}
                        {gameState === "ready" && currentLevel + 1 < maxLevels && (
                           <>
                              <div
                                 className={`${styles.badge} ${styles.badgeOk}`}
                                 style={{ fontSize: isMobile ? "0.95rem" : "1.05rem" }}
                              >
                                 <CheckCircleIcon style={{ width: 20, height: 20 }} />
                                 Level {currentLevel + 1} Complete
                              </div>
                              <div
                                 style={{
                                    fontSize: isMobile ? "1.05rem" : "1.1rem",
                                    fontWeight: 600,
                                    marginTop: isMobile ? "12px" : "16px",
                                    marginBottom: isMobile ? "14px" : "20px",
                                 }}
                              >
                                 Are you ready for next round?
                              </div>
                              <button
                                 type="button"
                                 className={`${styles.btn} ${styles.btnNext} ${fx.pressable}`}
                                 {...nextPress}
                                 style={{ ...TOUCH_SURFACE }}
                              >
                                 Next Round
                              </button>
                           </>
                        )}

                        {/* Game Complete Message */}
                        {gameState === "ready" && currentLevel + 1 >= maxLevels && (
                           <>
                              <div
                                 className={`${styles.badge} ${styles.badgeOk}`}
                                 style={{ fontSize: isMobile ? "0.95rem" : "1.05rem" }}
                              >
                                 <TrophyIcon style={{ width: 20, height: 20 }} />
                                 Game Complete!
                              </div>
                              <div
                                 style={{
                                    fontSize: isMobile ? "1.05rem" : "1.1rem",
                                    fontWeight: 600,
                                    marginTop: isMobile ? "12px" : "16px",
                                    marginBottom: isMobile ? "8px" : "12px",
                                 }}
                              >
                                 All {maxLevels} levels completed!
                              </div>
                           </>
                        )}

                        {/* Level Failed Message */}
                        {gameState === "failed" && (
                           <>
                              <div
                                 className={`${styles.badge} ${styles.badgeBad}`}
                                 style={{ fontSize: isMobile ? "0.95rem" : "1.05rem" }}
                              >
                                 <XCircleIcon style={{ width: 20, height: 20 }} />
                                 Level {currentLevel + 1} Failed
                              </div>
                              <div
                                 style={{
                                    marginTop: isMobile ? "10px" : "12px",
                                    fontSize: isMobile ? "0.95rem" : "1.05rem",
                                    fontWeight: 600,
                                    color: "var(--text)",
                                    marginBottom: isMobile ? "12px" : "16px",
                                 }}
                              >
                                 Need: {minTaps} taps
                              </div>
                              {renderActions()}
                           </>
                        )}
                     </div>
                  </div>
               )}
            </div>

            {/* Action Buttons: Replay, Share (while playing; the failed notice carries them) */}
            {gameState === "playing" && renderActions()}
         </div>
      </div>
   );
}
