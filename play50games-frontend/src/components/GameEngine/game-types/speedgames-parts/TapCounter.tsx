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
         return levelRequirements[currentLevel].minTaps || 20 + currentLevel * 5;
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
   const startLevelRef = useRef<() => void>(() => {});
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   const lastTapTimeRef = useRef<number>(0);
   const tapRateRef = useRef<number>(0);

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
      return maxLevels > 0 ? Math.min(100, (currentLevel / maxLevels) * 100) : 0;
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
   }, [replaysUsed, maxReplays, unlimitedActivated, currentLevel, getLevelDuration]);

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
         setCurrentShareId(sharedBy);
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
   }, [isPlaying, gameState, currentLevel, taps, timeLeft, getLevelDuration, startLevel]);

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
      const roundScore = Math.round(100 / maxLevels);
      const completedLevels = currentLevel + 1;
      const newScore = Math.min(100, completedLevels * roundScore);

      if (completedLevels >= maxLevels) {
         const finalScore = 100;
         if (!completionCalledRef.current) {
            completionCalledRef.current = true;
            onComplete(finalScore);
         }
      } else {
         setCurrentScore(newScore);
         onScoreUpdate(newScore);
         startLevel(currentLevel + 1);
      }
   }, [currentLevel, maxLevels, startLevel, onScoreUpdate, onComplete]);

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
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                     }}
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
                     style={{
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
               style={{
                  width: "100%",
                  maxWidth: "800px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: isMobile ? "16px" : "24px",
               }}
            >
               {/* Stats */}
               {gameState === "playing" && (
                  <div
                     style={{
                        display: "flex",
                        gap: isMobile ? "12px" : "16px",
                        width: "100%",
                        justifyContent: "center",
                        flexWrap: "wrap",
                     }}
                  >
                     <div
                        style={{
                           padding: isMobile ? "8px 12px" : "10px 16px",
                           background:
                              "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.12))",
                           border: "2px solid rgba(134, 239, 172, 0.6)",
                           borderRadius: "12px",
                           fontSize: isMobile ? "0.85rem" : "0.95rem",
                           fontWeight: 700,
                           color: "var(--text)",
                           display: "flex",
                           alignItems: "center",
                           gap: "6px",
                        }}
                     >
                        <HandRaisedIcon style={{ width: 18, height: 18 }} />
                        Taps: {taps}
                     </div>
                     <div
                        style={{
                           padding: isMobile ? "8px 12px" : "10px 16px",
                           background:
                              "linear-gradient(135deg, rgba(125, 211, 252, 0.25), rgba(125, 211, 252, 0.12))",
                           border: "2px solid rgba(125, 211, 252, 0.6)",
                           borderRadius: "12px",
                           fontSize: isMobile ? "0.85rem" : "0.95rem",
                           fontWeight: 700,
                           color: "var(--text)",
                           display: "flex",
                           alignItems: "center",
                           gap: "6px",
                        }}
                     >
                        <BoltIcon style={{ width: 18, height: 18 }} />
                        Rate: {tapRateRef.current.toFixed(1)}/s
                     </div>
                     <div
                        style={{
                           padding: isMobile ? "8px 12px" : "10px 16px",
                           background:
                              "linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(59, 130, 246, 0.12))",
                           border: "2px solid rgba(59, 130, 246, 0.6)",
                           borderRadius: "12px",
                           fontSize: isMobile ? "0.85rem" : "0.95rem",
                           fontWeight: 700,
                           color: "var(--text)",
                           display: "flex",
                           alignItems: "center",
                           gap: "6px",
                        }}
                     >
                        <TrophyIcon style={{ width: 18, height: 18 }} />
                        Need: {minTaps}
                     </div>
                  </div>
               )}

               {/* Game Area */}
               {gameState === "playing" && (
                  <div
                     style={{
                        width: "100%",
                        minHeight: isMobile ? "400px" : "500px",
                        background:
                           "radial-gradient(320px 220px at 30% 30%, rgba(59, 130, 246, 0.1), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                        border: "2px solid var(--stroke)",
                        borderRadius: "var(--radius)",
                        padding: isMobile ? "24px" : "32px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "24px",
                        boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
                        position: "relative",
                        overflow: "hidden",
                     }}
                  >
               {/* Tap Target with Circular Progress */}
               <div
                  style={{
                     position: "relative",
                     width: isMobile ? "200px" : "280px",
                     height: isMobile ? "200px" : "280px",
                  }}
               >
                  {/* Circular Progress SVG */}
                  <svg
                     width={isMobile ? "200" : "280"}
                     height={isMobile ? "200" : "280"}
                     style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        transform: "rotate(-90deg)",
                     }}
                  >
                     {/* Background circle */}
                     <circle
                        cx={isMobile ? "100" : "140"}
                        cy={isMobile ? "100" : "140"}
                        r={isMobile ? "96" : "134"}
                        fill="none"
                        stroke="rgba(59, 130, 246, 0.2)"
                        strokeWidth={isMobile ? "8" : "12"}
                     />
                     {/* Progress circle */}
                     <circle
                        cx={isMobile ? "100" : "140"}
                        cy={isMobile ? "100" : "140"}
                        r={isMobile ? "96" : "134"}
                        fill="none"
                        stroke={
                           tapProgress >= 100
                              ? "var(--ok)"
                              : "var(--accent)"
                        }
                        strokeWidth={isMobile ? "8" : "12"}
                        strokeLinecap="round"
                        strokeDasharray={
                           isMobile
                              ? `${2 * Math.PI * 96}`
                              : `${2 * Math.PI * 134}`
                        }
                        strokeDashoffset={
                           isMobile
                              ? `${
                                   2 * Math.PI * 96 * (1 - tapProgress / 100)
                                }`
                              : `${
                                   2 * Math.PI * 134 * (1 - tapProgress / 100)
                                }`
                        }
                        style={{
                           transition: "stroke-dashoffset 0.3s ease, stroke 0.3s ease",
                        }}
                     />
                  </svg>
                  {/* Tap Button */}
                  <button
                     onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleTap();
                     }}
                     disabled={requirementsMet}
                     style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        border: tapFeedback
                           ? "4px solid var(--ok)"
                           : "4px solid transparent",
                        background: tapFeedback
                           ? "rgba(134, 239, 172, 0.2)"
                           : "rgba(59, 130, 246, 0.15)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "16px",
                        cursor: requirementsMet ? "not-allowed" : "pointer",
                        transition: "all 0.1s ease",
                        transform: tapFeedback ? "scale(0.95)" : "scale(1)",
                        boxShadow: tapFeedback
                           ? "0 8px 24px rgba(134, 239, 172, 0.4)"
                           : "0 8px 24px rgba(59, 130, 246, 0.3)",
                        userSelect: "none",
                        touchAction: "manipulation",
                        WebkitTapHighlightColor: "transparent",
                        position: "relative",
                        zIndex: 1,
                     }}
                  >
                     <div
                        style={{
                           fontSize: isMobile ? "4rem" : "5rem",
                           fontWeight: 800,
                           color: "var(--text)",
                           lineHeight: 1,
                        }}
                     >
                        {taps}
                     </div>
                     <div
                        style={{
                           fontSize: isMobile ? "0.875rem" : "1rem",
                           fontWeight: 600,
                           color: "var(--muted)",
                           textAlign: "center",
                        }}
                     >
                        Taps
                     </div>
                  </button>
               </div>

               {/* Requirements */}
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     gap: "12px",
                     width: "100%",
                     maxWidth: "400px",
                  }}
               >
                  <div
                     style={{
                        fontSize: isMobile ? "0.875rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                        textAlign: "center",
                     }}
                  >
                     Target: {minTaps} taps in {getLevelDuration(currentLevel)}s
                  </div>
                  <div
                     style={{
                        fontSize: isMobile ? "0.75rem" : "0.875rem",
                        fontWeight: 500,
                        color: "var(--muted)",
                        textAlign: "center",
                     }}
                  >
                     {tapsRemaining > 0
                        ? `${tapsRemaining} more taps needed`
                        : "Level Complete!"}
                  </div>
               </div>
            </div>
         )}

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
               {gameState === "ready" && currentLevel + 1 >= maxLevels && (
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
                           marginTop: "12px",
                           fontSize: isMobile ? "0.95rem" : "1.05rem",
                           fontWeight: 600,
                           color: "var(--text)",
                           marginBottom: "18px",
                        }}
                     >
                        Need: {minTaps} taps
                     </div>
                  </div>
               )}

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
                           Link copied! Unlimited replay will unlock when
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
                              🎉 Someone opened your link! Unlimited replay is
                              now active for 15 minutes!
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
                              maxReplays > 0 && replaysUsed >= maxReplays
                                 ? 0.5
                                 : 1,
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
                           }}
                        />
                        <span>
                           {isMobile ? "Share" : "Share for unlimited"}
                        </span>
                     </button>
                  </div>
               )}
            </div>
         </div>
      </>
   );
}
