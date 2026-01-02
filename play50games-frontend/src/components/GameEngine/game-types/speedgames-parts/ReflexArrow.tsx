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
   ArrowUpIcon,
   ArrowDownIcon,
   ArrowLeftIcon,
   ArrowRightIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

interface ReflexArrowProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

type ArrowDirection = "up" | "down" | "left" | "right";

export default function ReflexArrow({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: ReflexArrowProps) {
   const maxLevels = config?.levels ? Number(config.levels) : 15;
   const defaultLevelDuration = 30;
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
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "playing" | "ready" | "failed" | "paused"
   >("playing");
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [timeLeft, setTimeLeft] = useState(() => {
      return getLevelDuration(0);
   });
   const [targetArrow, setTargetArrow] = useState<ArrowDirection | null>(null);
   const [correctAnswers, setCorrectAnswers] = useState(0);
   const [wrongAnswers, setWrongAnswers] = useState(0);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5;

   const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
   const arrowTimerRef = useRef<NodeJS.Timeout | null>(null);
   const gameStateRef = useRef<"playing" | "ready" | "failed" | "paused">(
      "playing"
   );
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<(level: number) => void>(() => {});
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   const lastArrowTimeRef = useRef<number>(0);

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
      setCorrectAnswers(0);
      setWrongAnswers(0);
      setTargetArrow(null);
   }, [isPlaying]);

   // Get level configuration
   const getLevelConfig = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return {
               minCorrect: levelRequirements[level].minCorrect || 10,
               arrowInterval: levelRequirements[level].arrowInterval || 2000,
            };
         }

         // Default progression
         switch (level) {
            case 0: // Level 1: Slow, easy
               return { minCorrect: 8, arrowInterval: 2500 };
            case 1: // Level 2
               return { minCorrect: 9, arrowInterval: 2300 };
            case 2: // Level 3
               return { minCorrect: 10, arrowInterval: 2100 };
            case 3: // Level 4
               return { minCorrect: 11, arrowInterval: 1900 };
            case 4: // Level 5
               return { minCorrect: 12, arrowInterval: 1700 };
            case 5: // Level 6
               return { minCorrect: 13, arrowInterval: 1500 };
            case 6: // Level 7
               return { minCorrect: 14, arrowInterval: 1300 };
            case 7: // Level 8
               return { minCorrect: 15, arrowInterval: 1200 };
            case 8: // Level 9
               return { minCorrect: 16, arrowInterval: 1100 };
            case 9: // Level 10
               return { minCorrect: 17, arrowInterval: 1000 };
            case 10: // Level 11
               return { minCorrect: 18, arrowInterval: 900 };
            case 11: // Level 12
               return { minCorrect: 19, arrowInterval: 800 };
            case 12: // Level 13
               return { minCorrect: 20, arrowInterval: 700 };
            case 13: // Level 14
               return { minCorrect: 21, arrowInterval: 600 };
            case 14: // Level 15: Master level
               return { minCorrect: 22, arrowInterval: 500 };
            default:
               return { minCorrect: 10, arrowInterval: 2000 };
         }
      },
      [levelRequirements]
   );

   // Get minimum correct answers required
   const getMinCorrectAnswers = useCallback(() => {
      const levelConfig = getLevelConfig(currentLevel);
      return levelConfig.minCorrect;
   }, [currentLevel, getLevelConfig]);

   // Generate random arrow
   const generateArrow = useCallback(() => {
      const arrows: ArrowDirection[] = ["up", "down", "left", "right"];
      const randomArrow = arrows[Math.floor(Math.random() * arrows.length)];
      setTargetArrow(randomArrow);
      lastArrowTimeRef.current = Date.now();
   }, []);

   // Start level function
   const startLevel = useCallback(
      (level: number) => {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         if (arrowTimerRef.current) {
            clearInterval(arrowTimerRef.current);
            arrowTimerRef.current = null;
         }

         setCurrentLevel(level);
         setCorrectAnswers(0);
         setWrongAnswers(0);
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         gameStateRef.current = "playing";
         setGameState("playing");
         setTargetArrow(null);
         setFeedback(null);

         const levelDur = getLevelDuration(level);
         setTimeLeft(levelDur);

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

         // Generate first arrow after a short delay
         setTimeout(() => {
            if (gameStateRef.current === "playing") {
               generateArrow();
               const levelConfig = getLevelConfig(level);
               startArrowTimer(levelConfig.arrowInterval);
            }
         }, 500);
      },
      [getLevelDuration, generateArrow, getLevelConfig]
   );

   // Start arrow timer
   const startArrowTimer = useCallback(
      (interval: number) => {
         if (arrowTimerRef.current) {
            clearInterval(arrowTimerRef.current);
         }
         arrowTimerRef.current = setInterval(() => {
            if (
               gameStateRef.current === "playing" &&
               !requirementsMetRef.current
            ) {
               generateArrow();
            } else {
               if (arrowTimerRef.current) {
                  clearInterval(arrowTimerRef.current);
                  arrowTimerRef.current = null;
               }
            }
         }, interval);
      },
      [generateArrow]
   );

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

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

   // Check if requirements are met
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const minCorrect = getMinCorrectAnswers();
      if (correctAnswers >= minCorrect) {
         setRequirementsMet(true);
         requirementsMetRef.current = true;
         setGameState("ready");
         gameStateRef.current = "ready";

         // Calculate score based on completed levels
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
      correctAnswers,
      gameState,
      requirementsMet,
      currentLevel,
      maxLevels,
      getMinCorrectAnswers,
      onScoreUpdate,
      onComplete,
   ]);

   // Handle too many wrong answers - show failed state
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      if (wrongAnswers > 5) {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         if (arrowTimerRef.current) {
            clearInterval(arrowTimerRef.current);
            arrowTimerRef.current = null;
         }
         setGameState("failed");
         gameStateRef.current = "failed";
         setTargetArrow(null);
      }
   }, [wrongAnswers, gameState, requirementsMet]);

   // Handle time expiration - show failed state
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet || timeLeft > 0) return;

      const minCorrect = getMinCorrectAnswers();
      if (correctAnswers < minCorrect) {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         if (arrowTimerRef.current) {
            clearInterval(arrowTimerRef.current);
            arrowTimerRef.current = null;
         }
         setGameState("failed");
         gameStateRef.current = "failed";
         setTargetArrow(null);
      }
   }, [
      timeLeft,
      gameState,
      requirementsMet,
      correctAnswers,
      getMinCorrectAnswers,
   ]);

   useEffect(() => {
      requirementsMetRef.current = requirementsMet;
   }, [requirementsMet]);

   useEffect(() => {
      gameStateRef.current = gameState;
   }, [gameState]);

   // Auto-start level when isPlaying changes
   useEffect(() => {
      if (!isPlaying) return;
      if (forceStartLevelRef.current !== null) {
         startLevel(forceStartLevelRef.current);
         forceStartLevelRef.current = null;
      } else if (prevLevelRef.current === null) {
         startLevel(0);
      }
   }, [isPlaying, startLevel]);

   // Handle arrow selection
   const handleArrowSelect = useCallback(
      (selectedArrow: ArrowDirection) => {
         if (gameState !== "playing" || requirementsMet || !targetArrow) return;

         if (selectedArrow === targetArrow) {
            // Correct
            setCorrectAnswers((prev) => prev + 1);
            setFeedback("correct");
            setTimeout(() => {
               setFeedback(null);
               if (
                  gameStateRef.current === "playing" &&
                  !requirementsMetRef.current
               ) {
                  generateArrow();
               }
            }, 300);
         } else {
            // Wrong
            setWrongAnswers((prev) => prev + 1);
            setFeedback("wrong");
            setTimeout(() => {
               setFeedback(null);
            }, 300);
         }
      },
      [gameState, requirementsMet, targetArrow, generateArrow]
   );

   // Keyboard controls
   useEffect(() => {
      if (
         !isPlaying ||
         gameState !== "playing" ||
         requirementsMet ||
         !targetArrow
      ) {
         return;
      }

      const handleKeyPress = (e: KeyboardEvent) => {
         if (
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement
         ) {
            return;
         }

         let selectedArrow: ArrowDirection | null = null;

         if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") {
            selectedArrow = "up";
         } else if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") {
            selectedArrow = "down";
         } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
            selectedArrow = "left";
         } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
            selectedArrow = "right";
         }

         if (selectedArrow) {
            e.preventDefault();
            handleArrowSelect(selectedArrow);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => {
         window.removeEventListener("keydown", handleKeyPress);
      };
   }, [isPlaying, gameState, requirementsMet, targetArrow, handleArrowSelect]);

   // Handle next round
   const handleNextRound = useCallback(() => {
      const roundScore = Math.round(100 / maxLevels);
      const completedLevels = currentLevel + 1;
      const newScore = Math.min(100, completedLevels * roundScore);

      if (completedLevels >= maxLevels) {
         finalizeGame();
      } else {
         setCurrentScore(newScore);
         onScoreUpdate(newScore);
         startLevel(currentLevel + 1);
      }
   }, [currentLevel, maxLevels, startLevel, onScoreUpdate, finalizeGame]);

   // Handle repeat round button click
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setRequirementsMet(false);
      requirementsMetRef.current = false;
      setGameState("playing");
      gameStateRef.current = "playing";
      setCorrectAnswers(0);
      setWrongAnswers(0);
      setTargetArrow(null);
      setFeedback(null);
      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }
      if (arrowTimerRef.current) {
         clearInterval(arrowTimerRef.current);
         arrowTimerRef.current = null;
      }
      startLevel(currentLevel);
      setReplaysUsed((prev) => prev + 1);
   }, [
      gameState,
      maxReplays,
      replaysUsed,
      startLevel,
      currentLevel,
      getLevelDuration,
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
         await registerShare(shareId, "reflex-arrow");
         const gameKey = "play50games_shared_reflex-arrow";
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
               title: "Reflex Arrow Game",
               text: "Check out this awesome Reflex Arrow game!",
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
         const gameKey = "play50games_shared_reflex-arrow";
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
      const gameKey = "play50games_shared_reflex-arrow";
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
         if (arrowTimerRef.current) {
            clearInterval(arrowTimerRef.current);
         }
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, []);

   // Progress calculation
   const progress = useMemo(() => {
      return maxLevels > 0
         ? Math.min(100, (currentLevel / maxLevels) * 100)
         : 0;
   }, [currentLevel, maxLevels]);

   const minCorrect = getMinCorrectAnswers();
   const levelConfig = getLevelConfig(currentLevel);

   // Render arrow icon with different colors
   const renderArrowIcon = (direction: ArrowDirection, size: number = 24) => {
      const getArrowColor = (dir: ArrowDirection) => {
         switch (dir) {
            case "up":
               return "#10b981"; // Green
            case "down":
               return "#f59e0b"; // Orange/Amber
            case "left":
               return "#8b5cf6"; // Purple
            case "right":
               return "#3b82f6"; // Blue
            default:
               return "currentColor";
         }
      };

      const iconProps = {
         width: size,
         height: size,
         style: { color: getArrowColor(direction) },
      };

      switch (direction) {
         case "up":
            return <ArrowUpIcon {...iconProps} />;
         case "down":
            return <ArrowDownIcon {...iconProps} />;
         case "left":
            return <ArrowLeftIcon {...iconProps} />;
         case "right":
            return <ArrowRightIcon {...iconProps} />;
      }
   };

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
            {gameState === "playing" && (
               <div
                  style={{
                     width: "100%",
                     maxWidth: "800px",
                     background: "var(--card)",
                     border: "1px solid var(--stroke)",
                     borderRadius: isMobile ? "16px" : "20px",
                     padding: isMobile ? "20px" : "32px",
                     boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     gap: isMobile ? "20px" : "32px",
                  }}
               >
                  {/* Stats */}
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: isMobile ? "12px" : "16px",
                        flexWrap: "wrap",
                        width: "100%",
                     }}
                  >
                     <div
                        style={{
                           background:
                              "linear-gradient(135deg, rgba(134, 239, 172, 0.2), rgba(34, 197, 94, 0.1))",
                           border: "1px solid rgba(134, 239, 172, 0.4)",
                           borderRadius: "12px",
                           padding: isMobile ? "8px 12px" : "10px 16px",
                           display: "flex",
                           alignItems: "center",
                           gap: "8px",
                        }}
                     >
                        <CheckCircleIcon
                           style={{
                              width: isMobile ? 16 : 18,
                              height: isMobile ? 16 : 18,
                              color: "var(--ok)",
                           }}
                        />
                        <span
                           style={{
                              fontSize: isMobile ? "0.875rem" : "1rem",
                              fontWeight: 600,
                              color: "var(--text)",
                           }}
                        >
                           Correct: {correctAnswers}/{minCorrect}
                        </span>
                     </div>
                     <div
                        style={{
                           background:
                              "linear-gradient(135deg, rgba(252, 165, 165, 0.2), rgba(239, 68, 68, 0.1))",
                           border: "1px solid rgba(252, 165, 165, 0.4)",
                           borderRadius: "12px",
                           padding: isMobile ? "8px 12px" : "10px 16px",
                           display: "flex",
                           alignItems: "center",
                           gap: "8px",
                        }}
                     >
                        <XCircleIcon
                           style={{
                              width: isMobile ? 16 : 18,
                              height: isMobile ? 16 : 18,
                              color: "var(--warn)",
                           }}
                        />
                        <span
                           style={{
                              fontSize: isMobile ? "0.875rem" : "1rem",
                              fontWeight: 600,
                              color: "var(--text)",
                           }}
                        >
                           Wrong: {wrongAnswers}
                        </span>
                     </div>
                  </div>

                  {/* Target Arrow Display */}
                  {targetArrow && (
                     <div
                        style={{
                           width: isMobile ? "120px" : "160px",
                           height: isMobile ? "120px" : "160px",
                           borderRadius: "50%",
                           border:
                              feedback === "correct"
                                 ? "4px solid var(--ok)"
                                 : feedback === "wrong"
                                 ? "4px solid var(--warn)"
                                 : "4px solid var(--accent)",
                           background:
                              feedback === "correct"
                                 ? "rgba(134, 239, 172, 0.2)"
                                 : feedback === "wrong"
                                 ? "rgba(252, 165, 165, 0.2)"
                                 : "rgba(59, 130, 246, 0.15)",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           transition: "all 0.3s ease",
                           boxShadow:
                              feedback === "correct"
                                 ? "0 8px 24px rgba(134, 239, 172, 0.4)"
                                 : feedback === "wrong"
                                 ? "0 8px 24px rgba(252, 165, 165, 0.4)"
                                 : "0 8px 24px rgba(59, 130, 246, 0.3)",
                        }}
                     >
                        <div
                           style={{
                              fontSize: isMobile ? "4rem" : "5rem",
                              color: "var(--text)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                           }}
                        >
                           {renderArrowIcon(targetArrow, isMobile ? 64 : 80)}
                        </div>
                     </div>
                  )}

                  {/* Arrow Buttons */}
                  <div
                     style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gridTemplateRows: "repeat(3, 1fr)",
                        gap: isMobile ? "12px" : isTablet ? "14px" : "16px",
                        width: "100%",
                        maxWidth: isMobile
                           ? "280px"
                           : isTablet
                           ? "320px"
                           : "360px",
                        aspectRatio: "1",
                     }}
                  >
                     {/* Empty top-left */}
                     <div></div>
                     {/* Up Arrow */}
                     <button
                        onPointerDown={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           handleArrowSelect("up");
                        }}
                        disabled={!targetArrow || requirementsMet}
                        style={{
                           gridColumn: "2",
                           gridRow: "1",
                           background:
                              feedback === "correct" && targetArrow === "up"
                                 ? "rgba(16, 185, 129, 0.3)"
                                 : feedback === "wrong" && targetArrow !== "up"
                                 ? "rgba(252, 165, 165, 0.3)"
                                 : "rgba(16, 185, 129, 0.15)",
                           border:
                              feedback === "correct" && targetArrow === "up"
                                 ? "2px solid #10b981"
                                 : feedback === "wrong" && targetArrow !== "up"
                                 ? "2px solid var(--warn)"
                                 : "2px solid #10b981",
                           borderRadius: "12px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           cursor:
                              !targetArrow || requirementsMet
                                 ? "not-allowed"
                                 : "pointer",
                           transition: "all 0.2s ease",
                           transform:
                              feedback === "correct" && targetArrow === "up"
                                 ? "scale(0.95)"
                                 : "scale(1)",
                           userSelect: "none",
                           touchAction: "manipulation",
                           WebkitTapHighlightColor: "transparent",
                           padding: isMobile
                              ? "8px"
                              : isTablet
                              ? "10px"
                              : "12px",
                        }}
                     >
                        {renderArrowIcon(
                           "up",
                           isMobile ? 32 : isTablet ? 36 : 44
                        )}
                     </button>
                     {/* Empty top-right */}
                     <div></div>
                     {/* Left Arrow */}
                     <button
                        onPointerDown={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           handleArrowSelect("left");
                        }}
                        disabled={!targetArrow || requirementsMet}
                        style={{
                           gridColumn: "1",
                           gridRow: "2",
                           background:
                              feedback === "correct" && targetArrow === "left"
                                 ? "rgba(139, 92, 246, 0.3)"
                                 : feedback === "wrong" &&
                                   targetArrow !== "left"
                                 ? "rgba(252, 165, 165, 0.3)"
                                 : "rgba(139, 92, 246, 0.15)",
                           border:
                              feedback === "correct" && targetArrow === "left"
                                 ? "2px solid #8b5cf6"
                                 : feedback === "wrong" &&
                                   targetArrow !== "left"
                                 ? "2px solid var(--warn)"
                                 : "2px solid #8b5cf6",
                           borderRadius: "12px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           cursor:
                              !targetArrow || requirementsMet
                                 ? "not-allowed"
                                 : "pointer",
                           transition: "all 0.2s ease",
                           transform:
                              feedback === "correct" && targetArrow === "left"
                                 ? "scale(0.95)"
                                 : "scale(1)",
                           userSelect: "none",
                           touchAction: "manipulation",
                           WebkitTapHighlightColor: "transparent",
                           padding: isMobile
                              ? "8px"
                              : isTablet
                              ? "10px"
                              : "12px",
                        }}
                     >
                        {renderArrowIcon(
                           "left",
                           isMobile ? 32 : isTablet ? 36 : 44
                        )}
                     </button>
                     {/* Center (empty or can show target) */}
                     <div
                        style={{
                           gridColumn: "2",
                           gridRow: "2",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           fontSize: isMobile ? "0.75rem" : "0.875rem",
                           fontWeight: 600,
                           color: "var(--muted)",
                           textAlign: "center",
                        }}
                     >
                        Tap arrow
                     </div>
                     {/* Right Arrow */}
                     <button
                        onPointerDown={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           handleArrowSelect("right");
                        }}
                        disabled={!targetArrow || requirementsMet}
                        style={{
                           gridColumn: "3",
                           gridRow: "2",
                           background:
                              feedback === "correct" && targetArrow === "right"
                                 ? "rgba(59, 130, 246, 0.3)"
                                 : feedback === "wrong" &&
                                   targetArrow !== "right"
                                 ? "rgba(252, 165, 165, 0.3)"
                                 : "rgba(59, 130, 246, 0.15)",
                           border:
                              feedback === "correct" && targetArrow === "right"
                                 ? "2px solid #3b82f6"
                                 : feedback === "wrong" &&
                                   targetArrow !== "right"
                                 ? "2px solid var(--warn)"
                                 : "2px solid #3b82f6",
                           borderRadius: "12px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           cursor:
                              !targetArrow || requirementsMet
                                 ? "not-allowed"
                                 : "pointer",
                           transition: "all 0.2s ease",
                           transform:
                              feedback === "correct" && targetArrow === "right"
                                 ? "scale(0.95)"
                                 : "scale(1)",
                           userSelect: "none",
                           touchAction: "manipulation",
                           WebkitTapHighlightColor: "transparent",
                           padding: isMobile
                              ? "8px"
                              : isTablet
                              ? "10px"
                              : "12px",
                        }}
                     >
                        {renderArrowIcon(
                           "right",
                           isMobile ? 32 : isTablet ? 36 : 44
                        )}
                     </button>
                     {/* Empty bottom-left */}
                     <div></div>
                     {/* Down Arrow */}
                     <button
                        onPointerDown={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           handleArrowSelect("down");
                        }}
                        disabled={!targetArrow || requirementsMet}
                        style={{
                           gridColumn: "2",
                           gridRow: "3",
                           background:
                              feedback === "correct" && targetArrow === "down"
                                 ? "rgba(245, 158, 11, 0.3)"
                                 : feedback === "wrong" &&
                                   targetArrow !== "down"
                                 ? "rgba(252, 165, 165, 0.3)"
                                 : "rgba(245, 158, 11, 0.15)",
                           border:
                              feedback === "correct" && targetArrow === "down"
                                 ? "2px solid #f59e0b"
                                 : feedback === "wrong" &&
                                   targetArrow !== "down"
                                 ? "2px solid var(--warn)"
                                 : "2px solid #f59e0b",
                           borderRadius: "12px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           cursor:
                              !targetArrow || requirementsMet
                                 ? "not-allowed"
                                 : "pointer",
                           transition: "all 0.2s ease",
                           transform:
                              feedback === "correct" && targetArrow === "down"
                                 ? "scale(0.95)"
                                 : "scale(1)",
                           userSelect: "none",
                           touchAction: "manipulation",
                           WebkitTapHighlightColor: "transparent",
                           padding: isMobile
                              ? "8px"
                              : isTablet
                              ? "10px"
                              : "12px",
                        }}
                     >
                        {renderArrowIcon(
                           "down",
                           isMobile ? 32 : isTablet ? 36 : 44
                        )}
                     </button>
                     {/* Empty bottom-right */}
                     <div></div>
                  </div>

                  {/* Level Description */}
                  <div
                     style={{
                        fontSize: isMobile ? "0.75rem" : "0.875rem",
                        fontWeight: 500,
                        color: "var(--muted)",
                        textAlign: "center",
                     }}
                  >
                     Level {currentLevel + 1}: Match {minCorrect} arrows
                     correctly
                     {!isMobile &&
                        !isTablet &&
                        " (Use Arrow Keys, WASD, or click buttons)"}
                  </div>
               </div>
            )}

            {/* Ready for Next Round Message */}
            {gameState === "ready" && currentLevel < maxLevels - 1 && (
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
                     {wrongAnswers > 5
                        ? `Too many wrong answers (${wrongAnswers} > 5)`
                        : `Need: ${minCorrect} correct answers matched`}
                  </div>
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
                     <span>{isMobile ? "Share" : "Share for unlimited"}</span>
                  </button>
               </div>
            )}
         </div>
      </>
   );
}
