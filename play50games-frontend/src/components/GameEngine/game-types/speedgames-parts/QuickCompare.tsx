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

interface QuickCompareProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function QuickCompare({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: QuickCompareProps) {
   const maxLevels = config?.levels ? Number(config.levels) : 15;
   const defaultLevelDuration = 30; // Fallback duration if not specified in levelRequirements
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
   const [correctAnswers, setCorrectAnswers] = useState(0);
   const [wrongAnswers, setWrongAnswers] = useState(0);
   const [currentPair, setCurrentPair] = useState<{
      left: number;
      right: number;
      displayLeft: string;
      displayRight: string;
   } | null>(null);
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
   const levelScoreRef = useRef(0);
   const gameStateRef = useRef<"playing" | "ready" | "failed" | "paused">(
      "playing"
   );
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<() => void>(() => {});
   const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);

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
   }, [isPlaying]);

   // Generate number pair based on level
   const generatePair = useCallback(
      (
         level: number
      ): {
         left: number;
         right: number;
         displayLeft: string;
         displayRight: string;
      } => {
         let left: number, right: number;

         switch (level) {
            case 0: // Level 1: Simple integers (1-50)
               left = Math.floor(Math.random() * 50) + 1;
               right = Math.floor(Math.random() * 50) + 1;
               while (left === right) {
                  right = Math.floor(Math.random() * 50) + 1;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toString(),
                  displayRight: right.toString(),
               };

            case 1: // Level 2: Medium integers (10-100)
               left = Math.floor(Math.random() * 91) + 10;
               right = Math.floor(Math.random() * 91) + 10;
               while (left === right) {
                  right = Math.floor(Math.random() * 91) + 10;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toString(),
                  displayRight: right.toString(),
               };

            case 2: // Level 3: Larger integers (50-200)
               left = Math.floor(Math.random() * 151) + 50;
               right = Math.floor(Math.random() * 151) + 50;
               while (left === right) {
                  right = Math.floor(Math.random() * 151) + 50;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toString(),
                  displayRight: right.toString(),
               };

            case 3: // Level 4: Large integers (100-1000)
               left = Math.floor(Math.random() * 901) + 100;
               right = Math.floor(Math.random() * 901) + 100;
               while (left === right) {
                  right = Math.floor(Math.random() * 901) + 100;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toString(),
                  displayRight: right.toString(),
               };

            case 4: // Level 5: Very large integers (500-5000)
               left = Math.floor(Math.random() * 4501) + 500;
               right = Math.floor(Math.random() * 4501) + 500;
               while (left === right) {
                  right = Math.floor(Math.random() * 4501) + 500;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toLocaleString(),
                  displayRight: right.toLocaleString(),
               };

            case 5: // Level 6: Huge integers (1000-10000)
               left = Math.floor(Math.random() * 9001) + 1000;
               right = Math.floor(Math.random() * 9001) + 1000;
               while (left === right) {
                  right = Math.floor(Math.random() * 9001) + 1000;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toLocaleString(),
                  displayRight: right.toLocaleString(),
               };

            case 6: // Level 7: Decimals (0.1-10, 1 decimal)
               left = Math.round((Math.random() * 9.9 + 0.1) * 10) / 10;
               right = Math.round((Math.random() * 9.9 + 0.1) * 10) / 10;
               while (left === right) {
                  right = Math.round((Math.random() * 9.9 + 0.1) * 10) / 10;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toFixed(1),
                  displayRight: right.toFixed(1),
               };

            case 7: // Level 8: Decimals (0.01-100, 2 decimals)
               left = Math.round((Math.random() * 99.99 + 0.01) * 100) / 100;
               right = Math.round((Math.random() * 99.99 + 0.01) * 100) / 100;
               while (left === right) {
                  right =
                     Math.round((Math.random() * 99.99 + 0.01) * 100) / 100;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toFixed(2),
                  displayRight: right.toFixed(2),
               };

            case 8: // Level 9: Mixed decimals (0.1-1000, varying precision)
               const precision = Math.random() > 0.5 ? 1 : 2;
               left =
                  Math.round(
                     (Math.random() * 999.9 + 0.1) * Math.pow(10, precision)
                  ) / Math.pow(10, precision);
               right =
                  Math.round(
                     (Math.random() * 999.9 + 0.1) * Math.pow(10, precision)
                  ) / Math.pow(10, precision);
               while (left === right) {
                  right =
                     Math.round(
                        (Math.random() * 999.9 + 0.1) * Math.pow(10, precision)
                     ) / Math.pow(10, precision);
               }
               return {
                  left,
                  right,
                  displayLeft: left.toFixed(precision),
                  displayRight: right.toFixed(precision),
               };

            case 9: // Level 10: Negative and positive (-50 to 50)
               left = Math.floor(Math.random() * 101) - 50;
               right = Math.floor(Math.random() * 101) - 50;
               while (left === right) {
                  right = Math.floor(Math.random() * 101) - 50;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toString(),
                  displayRight: right.toString(),
               };

            case 10: // Level 11: Negative decimals (-10 to 10, 1 decimal)
               left = Math.round((Math.random() * 20 - 10) * 10) / 10;
               right = Math.round((Math.random() * 20 - 10) * 10) / 10;
               while (left === right) {
                  right = Math.round((Math.random() * 20 - 10) * 10) / 10;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toFixed(1),
                  displayRight: right.toFixed(1),
               };

            case 11: // Level 12: Mixed negative/positive large (-1000 to 1000)
               left = Math.floor(Math.random() * 2001) - 1000;
               right = Math.floor(Math.random() * 2001) - 1000;
               while (left === right) {
                  right = Math.floor(Math.random() * 2001) - 1000;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toLocaleString(),
                  displayRight: right.toLocaleString(),
               };

            case 12: // Level 13: Scientific notation style (10000-100000)
               left = Math.floor(Math.random() * 90001) + 10000;
               right = Math.floor(Math.random() * 90001) + 10000;
               while (left === right) {
                  right = Math.floor(Math.random() * 90001) + 10000;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toLocaleString(),
                  displayRight: right.toLocaleString(),
               };

            case 13: // Level 14: Very large with decimals (1000-10000, 1 decimal)
               left = Math.round((Math.random() * 9000 + 1000) * 10) / 10;
               right = Math.round((Math.random() * 9000 + 1000) * 10) / 10;
               while (left === right) {
                  right = Math.round((Math.random() * 9000 + 1000) * 10) / 10;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toLocaleString(undefined, {
                     minimumFractionDigits: 1,
                     maximumFractionDigits: 1,
                  }),
                  displayRight: right.toLocaleString(undefined, {
                     minimumFractionDigits: 1,
                     maximumFractionDigits: 1,
                  }),
               };

            case 14: // Level 15: Master challenge - Complex mix (all types)
               const type = Math.floor(Math.random() * 4);
               if (type === 0) {
                  // Large integers
                  left = Math.floor(Math.random() * 99999) + 1000;
                  right = Math.floor(Math.random() * 99999) + 1000;
                  while (left === right) {
                     right = Math.floor(Math.random() * 99999) + 1000;
                  }
                  return {
                     left,
                     right,
                     displayLeft: left.toLocaleString(),
                     displayRight: right.toLocaleString(),
                  };
               } else if (type === 1) {
                  // Decimals
                  left = Math.round((Math.random() * 9999.9 + 0.1) * 10) / 10;
                  right = Math.round((Math.random() * 9999.9 + 0.1) * 10) / 10;
                  while (left === right) {
                     right =
                        Math.round((Math.random() * 9999.9 + 0.1) * 10) / 10;
                  }
                  return {
                     left,
                     right,
                     displayLeft: left.toLocaleString(undefined, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                     }),
                     displayRight: right.toLocaleString(undefined, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                     }),
                  };
               } else if (type === 2) {
                  // Negative
                  left = Math.floor(Math.random() * 20001) - 10000;
                  right = Math.floor(Math.random() * 20001) - 10000;
                  while (left === right) {
                     right = Math.floor(Math.random() * 20001) - 10000;
                  }
                  return {
                     left,
                     right,
                     displayLeft: left.toLocaleString(),
                     displayRight: right.toLocaleString(),
                  };
               } else {
                  // Negative decimals
                  left = Math.round((Math.random() * 2000 - 1000) * 10) / 10;
                  right = Math.round((Math.random() * 2000 - 1000) * 10) / 10;
                  while (left === right) {
                     right =
                        Math.round((Math.random() * 2000 - 1000) * 10) / 10;
                  }
                  return {
                     left,
                     right,
                     displayLeft: left.toFixed(1),
                     displayRight: right.toFixed(1),
                  };
               }

            default:
               left = Math.floor(Math.random() * 100) + 1;
               right = Math.floor(Math.random() * 100) + 1;
               while (left === right) {
                  right = Math.floor(Math.random() * 100) + 1;
               }
               return {
                  left,
                  right,
                  displayLeft: left.toString(),
                  displayRight: right.toString(),
               };
         }
      },
      []
   );

   // Get minimum correct answers for current level
   const getMinCorrectAnswers = useCallback(() => {
      if (levelRequirements && levelRequirements[currentLevel]) {
         return (
            levelRequirements[currentLevel].minCorrectAnswers ||
            5 + currentLevel
         );
      }
      return 5 + currentLevel;
   }, [currentLevel, levelRequirements]);

   // Start level
   const startLevel = useCallback(() => {
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }

      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      setCorrectAnswers(0);
      setWrongAnswers(0);
      levelScoreRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      setGameState("playing");
      setRequirementsMet(false);
      setFeedback(null);
      generateNextPair();

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
   }, [currentLevel, getLevelDuration]);

   // Generate next pair
   const generateNextPair = useCallback(() => {
      const pair = generatePair(currentLevel);
      setCurrentPair(pair);
   }, [currentLevel, generatePair]);

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

   // Handle next round button click
   const handleNextRound = useCallback(() => {
      const roundScore = Math.round(100 / maxLevels);
      const completedLevels = currentLevel + 1;
      const newScore = Math.min(100, completedLevels * roundScore);

      if (completedLevels >= maxLevels) {
         finalizeGame();
      } else {
         setCurrentScore(newScore);
         onScoreUpdate(newScore);

         forceStartLevelRef.current = currentLevel + 1;
         setCurrentLevel((prev) => prev + 1);
         setRequirementsMet(false);
      }
   }, [currentLevel, maxLevels, onScoreUpdate, finalizeGame]);

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
      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }
      startLevel();
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
         await registerShare(shareId, "quick-compare");
         const gameKey = "play50games_shared_quick-compare";
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
               title: "Quick Compare Game",
               text: "Check out this awesome Quick Compare game!",
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
         const gameKey = "play50games_shared_quick-compare";
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
      const gameKey = "play50games_shared_quick-compare";
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

   // End level
   const endLevel = useCallback(() => {
      if (requirementsMetRef.current) {
         return;
      }
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }

      const minCorrectAnswers = getMinCorrectAnswers();
      const levelPassed = correctAnswers >= minCorrectAnswers;

      if (levelPassed && !requirementsMet) {
         handleNextRound();
      } else if (!levelPassed) {
         setGameState("failed");
      }
   }, [correctAnswers, requirementsMet, getMinCorrectAnswers, handleNextRound]);

   useEffect(() => {
      if (!isPlaying || currentLevel >= maxLevels) {
         prevLevelRef.current = null;
         if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
         }
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         return;
      }

      if (prevLevelRef.current === currentLevel) {
         return;
      }

      prevLevelRef.current = currentLevel;
      const isForcedStart = forceStartLevelRef.current === currentLevel;
      if (isForcedStart) {
         forceStartLevelRef.current = null;
      }
      const delay = isForcedStart || currentLevel === 0 ? 0 : 1200;

      if (startTimeoutRef.current) {
         clearTimeout(startTimeoutRef.current);
      }

      if (delay === 0) {
         startLevelRef.current();
      } else {
         startTimeoutRef.current = setTimeout(() => {
            startLevelRef.current();
            startTimeoutRef.current = null;
         }, delay);
      }
   }, [isPlaying, currentLevel, maxLevels]);

   // Check if level requirements are met during gameplay
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const minCorrectAnswers = getMinCorrectAnswers();

      if (correctAnswers >= minCorrectAnswers) {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         setTimeLeft(0);

         requirementsMetRef.current = true;
         setRequirementsMet(true);
         setGameState("ready");
         setCurrentPair(null);

         if (currentLevel + 1 >= maxLevels) {
            finalizeGame();
         }
      }
   }, [
      correctAnswers,
      gameState,
      requirementsMet,
      getMinCorrectAnswers,
      currentLevel,
      maxLevels,
      finalizeGame,
   ]);

   useEffect(() => {
      requirementsMetRef.current = requirementsMet;
   }, [requirementsMet]);

   useEffect(() => {
      gameStateRef.current = gameState;
   }, [gameState]);

   // Check if time runs out and requirements are not met
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet || timeLeft > 0) return;

      const minCorrectAnswers = getMinCorrectAnswers();
      if (correctAnswers < minCorrectAnswers) {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         setGameState("failed");
         gameStateRef.current = "failed";
         setCurrentPair(null);
      }
   }, [
      timeLeft,
      gameState,
      requirementsMet,
      correctAnswers,
      getMinCorrectAnswers,
   ]);

   // Handle comparison choice
   const handleComparison = useCallback(
      (choice: "<" | ">") => {
         if (gameState !== "playing" || requirementsMet || !currentPair) return;

         const isCorrect =
            choice === "<"
               ? currentPair.left < currentPair.right
               : currentPair.left > currentPair.right;

         if (isCorrect) {
            setCorrectAnswers((prev) => prev + 1);
            setFeedback("correct");
         } else {
            setWrongAnswers((prev) => prev + 1);
            setFeedback("wrong");
         }

         setTimeout(() => {
            setFeedback(null);
            if (
               gameStateRef.current === "playing" &&
               !requirementsMetRef.current
            ) {
               generateNextPair();
            }
         }, 300);
      },
      [gameState, requirementsMet, currentPair, generateNextPair]
   );

   // Keyboard controls
   useEffect(() => {
      if (
         !isPlaying ||
         gameState !== "playing" ||
         requirementsMet ||
         !currentPair
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

         if (e.key === "," || e.key === "<") {
            e.preventDefault();
            handleComparison("<");
         } else if (e.key === "." || e.key === ">") {
            e.preventDefault();
            handleComparison(">");
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => {
         window.removeEventListener("keydown", handleKeyPress);
      };
   }, [isPlaying, gameState, requirementsMet, currentPair, handleComparison]);

   // Progress calculation - based on completed levels, not correct answers
   const progress = useMemo(() => {
      return maxLevels > 0
         ? Math.min(100, (currentLevel / maxLevels) * 100)
         : 0;
   }, [currentLevel, maxLevels]);

   // Get level description
   const getLevelDescription = (level: number): string => {
      const descriptions = [
         "Simple Integers (1-50)",
         "Medium Integers (10-100)",
         "Larger Integers (50-200)",
         "Large Integers (100-1000)",
         "Very Large Integers (500-5000)",
         "Huge Integers (1000-10000)",
         "Decimals (0.1-10, 1 decimal)",
         "Decimals (0.01-100, 2 decimals)",
         "Mixed Decimals (0.1-1000, varying)",
         "Negative & Positive (-50 to 50)",
         "Negative Decimals (-10 to 10)",
         "Mixed Negative/Large (-1000 to 1000)",
         "Scientific Style (10000-100000)",
         "Large with Decimals (1000-10000)",
         "Master Challenge (All Types)",
      ];
      return descriptions[level] || "Number Comparison";
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
                        color: "var(--text)",
                        fontSize: isMobile ? "0.85rem" : "0.95rem",
                        fontWeight: 600,
                     }}
                  >
                     Correct: {correctAnswers} / {getMinCorrectAnswers()}
                  </div>
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
                     Wrong: {wrongAnswers}
                  </div>
               </div>

               {/* Level Description */}
               <div
                  style={{
                     padding: isMobile ? "8px 12px" : "10px 16px",
                     background: "var(--card)",
                     border: "1px solid var(--stroke)",
                     borderRadius: "12px",
                     color: "var(--text)",
                     fontSize: isMobile ? "0.9rem" : "1rem",
                     fontWeight: 600,
                     textAlign: "center",
                  }}
               >
                  {getLevelDescription(currentLevel)}
               </div>

               {/* Comparison Area */}
               {gameState === "playing" && currentPair && (
                  <div
                     style={{
                        width: "100%",
                        maxWidth: "600px",
                        padding: isMobile ? "24px" : "32px",
                        background: "var(--card)",
                        border: "1px solid var(--stroke)",
                        borderRadius: "var(--radius)",
                        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.2)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "24px",
                     }}
                  >
                     {/* Numbers Display */}
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           gap: isMobile ? "20px" : "32px",
                           fontSize: isMobile ? "2rem" : "3rem",
                           fontWeight: 900,
                           color: "var(--text)",
                           minHeight: isMobile ? "80px" : "120px",
                        }}
                     >
                        <span
                           style={{
                              padding: isMobile ? "16px 24px" : "20px 32px",
                              background: "var(--background)",
                              border: "2px solid var(--stroke)",
                              borderRadius: "16px",
                              minWidth: isMobile ? "100px" : "150px",
                              textAlign: "center",
                           }}
                        >
                           {currentPair.displayLeft}
                        </span>
                        <span
                           style={{
                              fontSize: isMobile ? "1.5rem" : "2rem",
                              color: "var(--muted)",
                           }}
                        >
                           ?
                        </span>
                        <span
                           style={{
                              padding: isMobile ? "16px 24px" : "20px 32px",
                              background: "var(--background)",
                              border: "2px solid var(--stroke)",
                              borderRadius: "16px",
                              minWidth: isMobile ? "100px" : "150px",
                              textAlign: "center",
                           }}
                        >
                           {currentPair.displayRight}
                        </span>
                     </div>

                     {/* Comparison Buttons */}
                     <div
                        style={{
                           display: "flex",
                           gap: isMobile ? "16px" : "24px",
                           width: "100%",
                           justifyContent: "center",
                        }}
                     >
                        <button
                           onClick={() => handleComparison("<")}
                           disabled={gameState !== "playing" || requirementsMet}
                           style={{
                              padding: isMobile ? "16px 32px" : "20px 40px",
                              fontSize: isMobile ? "1.5rem" : "2rem",
                              fontWeight: 800,
                              background:
                                 feedback === "wrong" && gameState === "playing"
                                    ? "linear-gradient(135deg, rgba(252, 165, 165, 0.3), rgba(252, 165, 165, 0.15))"
                                    : feedback === "correct" &&
                                      gameState === "playing"
                                    ? "linear-gradient(135deg, rgba(134, 239, 172, 0.3), rgba(134, 239, 172, 0.15))"
                                    : "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))",
                              border:
                                 feedback === "wrong" && gameState === "playing"
                                    ? "2px solid rgba(252, 165, 165, 0.8)"
                                    : feedback === "correct" &&
                                      gameState === "playing"
                                    ? "2px solid rgba(134, 239, 172, 0.8)"
                                    : "2px solid rgba(125, 211, 252, 0.6)",
                              borderRadius: "16px",
                              color: "var(--text)",
                              cursor:
                                 gameState !== "playing" || requirementsMet
                                    ? "not-allowed"
                                    : "pointer",
                              transition: "all 0.2s ease",
                              opacity:
                                 gameState !== "playing" || requirementsMet
                                    ? 0.5
                                    : 1,
                           }}
                        >
                           &lt;
                        </button>
                        <button
                           onClick={() => handleComparison(">")}
                           disabled={gameState !== "playing" || requirementsMet}
                           style={{
                              padding: isMobile ? "16px 32px" : "20px 40px",
                              fontSize: isMobile ? "1.5rem" : "2rem",
                              fontWeight: 800,
                              background:
                                 feedback === "wrong" && gameState === "playing"
                                    ? "linear-gradient(135deg, rgba(252, 165, 165, 0.3), rgba(252, 165, 165, 0.15))"
                                    : feedback === "correct" &&
                                      gameState === "playing"
                                    ? "linear-gradient(135deg, rgba(134, 239, 172, 0.3), rgba(134, 239, 172, 0.15))"
                                    : "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))",
                              border:
                                 feedback === "wrong" && gameState === "playing"
                                    ? "2px solid rgba(252, 165, 165, 0.8)"
                                    : feedback === "correct" &&
                                      gameState === "playing"
                                    ? "2px solid rgba(134, 239, 172, 0.8)"
                                    : "2px solid rgba(125, 211, 252, 0.6)",
                              borderRadius: "16px",
                              color: "var(--text)",
                              cursor:
                                 gameState !== "playing" || requirementsMet
                                    ? "not-allowed"
                                    : "pointer",
                              transition: "all 0.2s ease",
                              opacity:
                                 gameState !== "playing" || requirementsMet
                                    ? 0.5
                                    : 1,
                           }}
                        >
                           &gt;
                        </button>
                     </div>

                     {/* Feedback Message */}
                     {feedback && (
                        <div
                           style={{
                              padding: isMobile ? "12px 20px" : "16px 24px",
                              background:
                                 feedback === "correct"
                                    ? "rgba(134, 239, 172, 0.2)"
                                    : "rgba(252, 165, 165, 0.2)",
                              border: `2px solid ${
                                 feedback === "correct"
                                    ? "rgba(134, 239, 172, 0.6)"
                                    : "rgba(252, 165, 165, 0.6)"
                              }`,
                              borderRadius: "12px",
                              color:
                                 feedback === "correct"
                                    ? "var(--ok)"
                                    : "var(--warn)",
                              fontSize: isMobile ? "0.9rem" : "1rem",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                           }}
                        >
                           {feedback === "correct" ? (
                              <>
                                 <CheckCircleIcon
                                    style={{ width: 20, height: 20 }}
                                 />
                                 <span>Correct!</span>
                              </>
                           ) : (
                              <>
                                 <XCircleIcon
                                    style={{ width: 20, height: 20 }}
                                 />
                                 <span>Wrong!</span>
                              </>
                           )}
                        </div>
                     )}

                     {/* Instructions */}
                     <p
                        style={{
                           fontSize: isMobile ? "0.85rem" : "0.95rem",
                           color: "var(--muted)",
                           textAlign: "center",
                        }}
                     >
                        Click &lt; if left is smaller, &gt; if left is larger.
                        <br />
                        Keyboard: <kbd>,</kbd> for &lt; or <kbd>.</kbd> for &gt;
                     </p>
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
                        Need: {getMinCorrectAnswers()} correct answers
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
