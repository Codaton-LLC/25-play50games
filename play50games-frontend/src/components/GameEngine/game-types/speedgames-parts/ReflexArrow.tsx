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
import { TOUCH_SURFACE, useViewport, useRevealOnPlay, useInstantPress, eatDefault } from "./touch";
import { reflexLayout } from "./ReflexArrow.layout";
import fx from "./speedFx.module.css";
import styles from "./ReflexArrow.module.css";

// Per-direction colours (the classic ones), as CSS vars for the pad buttons.
const DIR_COLORS: Record<ArrowDirection, { color: string; bg: string; bgHot: string }> = {
   up: { color: "#10b981", bg: "rgba(16, 185, 129, 0.15)", bgHot: "rgba(16, 185, 129, 0.3)" },
   down: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", bgHot: "rgba(245, 158, 11, 0.3)" },
   left: { color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.15)", bgHot: "rgba(139, 92, 246, 0.3)" },
   right: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)", bgHot: "rgba(59, 130, 246, 0.3)" },
};

interface Floater {
   id: number;
   text: string;
   tone: "ok" | "bad";
}

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

   // Layout and feedback plumbing (mobile/tablet pass): live viewport, reveal on play, the pressed
   // direction, the last reaction time and a floating "+1 · N ms". None of it touches the rules.
   const vp = useViewport();
   const isMobile = vp.isMobile;
   const isTablet = vp.isTablet;
   const rootRef = useRef<HTMLDivElement>(null);
   useRevealOnPlay(rootRef, isPlaying);
   const [pressedDir, setPressedDir] = useState<ArrowDirection | null>(null);
   const [lastReactionMs, setLastReactionMs] = useState<number | null>(null);
   const [floater, setFloater] = useState<Floater | null>(null);
   const floaterIdRef = useRef(0);
   const lastPointerRef = useRef(0);

   const showFloater = useCallback((text: string, tone: "ok" | "bad") => {
      const id = ++floaterIdRef.current;
      setFloater({ id, text, tone });
      setTimeout(() => {
         setFloater((prev) => (prev && prev.id === id ? null : prev));
      }, 700);
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

         // display only: how long since this arrow appeared (keyboard and touch both land here)
         const reactionMs = Math.max(0, Date.now() - lastArrowTimeRef.current);
         setPressedDir(selectedArrow);

         if (selectedArrow === targetArrow) {
            // Correct
            setCorrectAnswers((prev) => prev + 1);
            setFeedback("correct");
            setLastReactionMs(reactionMs);
            showFloater(`+1 · ${reactionMs} ms`, "ok");
            setTimeout(() => {
               setFeedback(null);
               setPressedDir(null);
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
            showFloater("✕ wrong", "bad");
            setTimeout(() => {
               setFeedback(null);
               setPressedDir(null);
            }, 300);
         }
      },
      [gameState, requirementsMet, targetArrow, generateArrow, showFloater]
   );

   // Pad press: fires on pointerdown (touch, pen, mouse) exactly where the old handler did, so touch and
   // keyboard measure the same window; the click that follows is swallowed, while a keyboard activation
   // of the focused button (a click with no pointer first) still counts.
   const pressDir = useCallback(
      (e: React.PointerEvent<HTMLButtonElement>, dir: ArrowDirection) => {
         if (e.pointerType === "mouse" && e.button !== 0) return;
         eatDefault(e);
         e.stopPropagation();
         lastPointerRef.current = performance.now();
         handleArrowSelect(dir);
      },
      [handleArrowSelect]
   );

   const clickDir = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>, dir: ArrowDirection) => {
         e.stopPropagation();
         if (performance.now() - lastPointerRef.current < 600) {
            e.preventDefault();
            return;
         }
         handleArrowSelect(dir);
      },
      [handleArrowSelect]
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
      const completedLevels = currentLevel + 1;

      if (completedLevels >= maxLevels) {
         finalizeGame();
      } else {
         if (!requirementsMetRef.current) {
            const roundScore = Math.round(100 / maxLevels);
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            onScoreUpdate(newScore);
         }
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

   // Sizes from the live viewport (pure helper, tested): the pad has priority, the prompt takes the rest;
   // on a short screen the prompt moves beside the pad. Short viewports also get a one-line header.
   const layout = reflexLayout(vp);
   const compact = vp.isShort;
   const noReplays = maxReplays > 0 && replaysUsed >= maxReplays;
   const padDisabled = !targetArrow || requirementsMet;
   // Replay and Next Round fire on pointerdown (instant on touch); Share keeps its click for the user activation.
   const replayPress = useInstantPress<HTMLButtonElement>(handleReplay, !noReplays);
   const nextRoundPress = useInstantPress<HTMLButtonElement>(handleNextRound);
   const rootPad = isMobile ? 12 : isTablet ? 20 : 24;
   const cardPad = isMobile ? 12 : isTablet ? 16 : 24;
   const chipStyle: React.CSSProperties = {
      padding: compact ? "6px 10px" : isMobile ? "7px 11px" : "9px 14px",
      fontSize: compact ? "13px" : isMobile ? "13px" : "0.95rem",
   };

   const renderDir = (dir: ArrowDirection, column: number, row: number) => {
      const c = DIR_COLORS[dir];
      const isHit = feedback === "correct" && pressedDir === dir;
      const isMiss = feedback === "wrong" && pressedDir === dir;
      const cls = [
         styles.dir,
         isHit ? `${styles.dirOk} ${fx.flashOk}` : "",
         isMiss ? `${styles.dirBad} ${fx.missShake}` : "",
      ]
         .filter(Boolean)
         .join(" ");
      return (
         <button
            type="button"
            aria-label={`${dir} arrow`}
            className={cls}
            onPointerDown={(e) => pressDir(e, dir)}
            onClick={(e) => clickDir(e, dir)}
            disabled={padDisabled}
            style={
               {
                  ...TOUCH_SURFACE,
                  gridColumn: column,
                  gridRow: row,
                  width: `${layout.cell}px`,
                  height: `${layout.cell}px`,
                  "--dir-color": c.color,
                  "--dir-bg": c.bg,
                  "--dir-bg-hot": c.bgHot,
               } as React.CSSProperties
            }
         >
            {renderArrowIcon(dir, layout.cellIcon)}
         </button>
      );
   };

   const statChips = (
      <>
         <div
            key={`ok-${correctAnswers}`}
            className={`${styles.chip} ${styles.chipOk} ${correctAnswers > 0 ? fx.hitPop : ""}`}
            style={chipStyle}
         >
            <CheckCircleIcon style={{ width: 16, height: 16, color: "var(--ok)", flexShrink: 0 }} />
            <span>
               {compact ? "" : "Correct: "}
               {correctAnswers}/{minCorrect}
            </span>
         </div>
         <div
            key={`bad-${wrongAnswers}`}
            className={`${styles.chip} ${styles.chipBad} ${wrongAnswers > 0 ? fx.missShake : ""}`}
            style={chipStyle}
         >
            <XCircleIcon style={{ width: 16, height: 16, color: "var(--warn)", flexShrink: 0 }} />
            <span>
               {compact ? "" : "Wrong: "}
               {wrongAnswers}
            </span>
         </div>
         {lastReactionMs !== null && (
            <div
               key={`ms-${correctAnswers}`}
               className={`${styles.chip} ${styles.chipMs} ${fx.hitPop}`}
               style={chipStyle}
               aria-label="Last reaction time"
            >
               ⚡ {lastReactionMs} ms
            </div>
         )}
      </>
   );

   // Replay + Share row: under the board while playing, under the failed notice otherwise (same handlers).
   const renderActions = () => (
      <div className={`${styles.actions} ${fx.fadeUp}`} style={{ padding: isMobile ? "10px" : "12px" }}>
         {shareSuccess && !unlimitedActivated && (
            <div className={`${styles.msg} ${styles.msgOk}`} style={{ fontSize: isMobile ? "0.9rem" : "1rem" }}>
               Link copied! Unlimited replay will unlock when someone opens your link!
            </div>
         )}

         {unlimitedActivated && (
            <div className={`${styles.msg} ${styles.msgInfo}`} style={{ fontSize: isMobile ? "0.85rem" : "0.9rem" }}>
               <CheckCircleIcon
                  style={{ width: 18, height: 18, color: "rgba(59, 130, 246, 0.9)", flexShrink: 0 }}
               />
               <span>🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!</span>
            </div>
         )}

         <button
            type="button"
            className={`${styles.btn} ${styles.btnGrow} ${fx.pressable}`}
            {...replayPress}
            disabled={noReplays}
            style={{
               ...TOUCH_SURFACE,
               padding: isMobile ? "10px 10px" : "10px 20px",
               background: noReplays
                  ? "rgba(100, 100, 100, 0.2)"
                  : "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))",
               border: noReplays
                  ? "1px solid rgba(100, 100, 100, 0.4)"
                  : "1px solid rgba(125, 211, 252, 0.6)",
               fontSize: isMobile ? "0.9rem" : "0.95rem",
               opacity: noReplays ? 0.5 : 1,
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
            className={`${styles.btn} ${styles.btnGrow} ${fx.pressable}`}
            onClick={handleShare}
            style={{
               ...TOUCH_SURFACE,
               padding: isMobile ? "10px 10px" : "10px 20px",
               background:
                  "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
               border: "1px solid rgba(59, 130, 246, 0.6)",
               fontSize: isMobile ? "0.9rem" : "0.95rem",
            }}
         >
            <ShareIcon style={{ width: isMobile ? 18 : 20, height: isMobile ? 18 : 20, flexShrink: 0 }} />
            <span>{isMobile ? "Share" : "Share for unlimited"}</span>
         </button>
      </div>
   );

   const noticeStyle: React.CSSProperties = {
      padding: isMobile ? "18px 16px" : "24px 32px",
      fontSize: isMobile ? "1rem" : "1.1rem",
   };
   const badgeStyle: React.CSSProperties = { fontSize: isMobile ? "0.95rem" : "1.05rem" };

   return (
      <>
         <div
            ref={rootRef}
            className={styles.root}
            style={{
               ...TOUCH_SURFACE,
               // The game is the last thing on the page: the bottom room lets the pad and the Replay / Share
               // row scroll above the fixed cookie banner (~190 px on phones, ~110 px elsewhere).
               padding: `${rootPad}px ${rootPad}px calc(env(safe-area-inset-bottom) + ${isMobile ? 190 : 110}px)`,
               gap: compact ? "8px" : isMobile ? "10px" : "20px",
            }}
         >
            {/* Header card: level / score / time (+ the chips on a short screen), progress */}
            <div
               className={styles.card}
               style={{
                  padding: compact ? "8px 12px" : isMobile ? "12px 14px" : "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: compact ? "6px" : isMobile ? "10px" : "14px",
               }}
            >
               <div className={styles.headerRow} style={{ fontSize: isMobile ? "13px" : "1rem" }}>
                  <span className={styles.headerItem}>
                     <ArrowPathIcon style={{ width: isMobile ? 14 : 16, height: isMobile ? 14 : 16, color: "var(--accent)" }} />
                     Level {currentLevel + 1}/{maxLevels}
                  </span>
                  <span className={styles.headerItem}>
                     <TrophyIcon style={{ width: isMobile ? 14 : 16, height: isMobile ? 14 : 16, color: "var(--ok)" }} />
                     Score:{" "}
                     {currentLevel + 1 >= maxLevels && gameState === "ready" ? 100 : currentScore} / 100
                  </span>
                  <span className={styles.headerItem}>
                     <ClockIcon style={{ width: isMobile ? 14 : 16, height: isMobile ? 14 : 16, color: "var(--accent)" }} />
                     {timeLeft}s
                  </span>
                  {compact && gameState === "playing" && statChips}
               </div>
               <div className={styles.progress} style={{ height: isMobile ? "6px" : "8px" }}>
                  <div className={styles.progressFill} style={{ width: `${progress}%` }} />
               </div>
            </div>

            {/* Game Board */}
            {gameState === "playing" && (
               <div
                  className={`${styles.card} ${styles.board}`}
                  style={{
                     padding: `${cardPad}px`,
                     gap: compact ? "0px" : isMobile ? "10px" : "16px",
                  }}
               >
                  {/* Stats */}
                  {!compact && (
                     <div className={styles.stats} style={{ gap: isMobile ? "8px" : "12px" }}>
                        {statChips}
                     </div>
                  )}

                  {/* Prompt + pad */}
                  <div
                     className={`${styles.stage} ${
                        layout.arrangement === "row" ? styles.stageRow : styles.stageStack
                     }`}
                     style={{ gap: `${layout.stageGap}px`, width: "100%" }}
                  >
                     <div className={styles.promptWrap}>
                        <div
                           className={`${styles.prompt} ${
                              !targetArrow
                                 ? styles.promptIdle
                                 : feedback === "correct"
                                 ? `${styles.promptOk} ${fx.hitPop}`
                                 : feedback === "wrong"
                                 ? `${styles.promptBad} ${fx.missShake}`
                                 : ""
                           }`}
                           style={{ width: `${layout.promptSize}px`, height: `${layout.promptSize}px` }}
                           aria-live="polite"
                           aria-label={targetArrow ? `Target: ${targetArrow}` : "Get ready"}
                        >
                           {targetArrow ? (
                              renderArrowIcon(targetArrow, layout.promptIcon)
                           ) : (
                              <span className={styles.promptHint}>Get ready…</span>
                           )}
                        </div>
                        {floater && (
                           <span
                              key={floater.id}
                              className={`${fx.floatScore} ${styles.floater} ${
                                 floater.tone === "ok" ? styles.floaterOk : styles.floaterBad
                              }`}
                           >
                              {floater.text}
                           </span>
                        )}
                     </div>

                     <div
                        className={styles.pad}
                        role="group"
                        aria-label="Direction buttons"
                        style={{
                           gridTemplateColumns: `repeat(3, ${layout.cell}px)`,
                           gridTemplateRows: `repeat(3, ${layout.cell}px)`,
                           gap: `${layout.gap}px`,
                           width: `${layout.padSize}px`,
                           height: `${layout.padSize}px`,
                        }}
                     >
                        {renderDir("up", 2, 1)}
                        {renderDir("left", 1, 2)}
                        <div className={styles.centre} style={{ gridColumn: 2, gridRow: 2 }}>
                           {isMobile || isTablet ? "Tap arrow" : "Tap or use arrow keys / WASD"}
                        </div>
                        {renderDir("right", 3, 2)}
                        {renderDir("down", 2, 3)}
                     </div>
                  </div>

                  {/* Level Description (phones have the goal in the Correct chip) */}
                  {!isMobile && !compact && (
                     <div className={styles.desc}>
                        Level {currentLevel + 1}: Match {minCorrect} arrows correctly
                        {!isTablet && " (Use Arrow Keys, WASD, or click buttons)"}
                     </div>
                  )}
               </div>
            )}

            {/* Ready for Next Round Message */}
            {gameState === "ready" && currentLevel < maxLevels - 1 && (
               <div className={`${styles.card} ${styles.notice} ${fx.fadeUp}`} style={noticeStyle}>
                  <div className={`${styles.badge} ${styles.badgeOk}`} style={badgeStyle}>
                     <CheckCircleIcon style={{ width: 20, height: 20 }} />
                     Level {currentLevel + 1} Complete
                  </div>
                  <div
                     style={{
                        fontSize: isMobile ? "1.05rem" : "1.1rem",
                        fontWeight: 600,
                        marginBottom: isMobile ? "16px" : "20px",
                        marginTop: "16px",
                     }}
                  >
                     Are you ready for next round?
                  </div>
                  <button
                     type="button"
                     className={`${styles.btn} ${fx.pressable}`}
                     {...nextRoundPress}
                     style={{
                        ...TOUCH_SURFACE,
                        minHeight: "48px",
                        padding: isMobile ? "12px 24px" : "14px 28px",
                        background:
                           "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.12))",
                        border: "2px solid rgba(134, 239, 172, 0.6)",
                        borderRadius: "12px",
                        fontSize: isMobile ? "1rem" : "1.05rem",
                        fontWeight: 700,
                     }}
                  >
                     Next Round
                  </button>
               </div>
            )}

            {/* Level Failed Message */}
            {gameState === "failed" && (
               <div className={`${styles.card} ${styles.notice} ${fx.fadeUp}`} style={noticeStyle}>
                  <div className={`${styles.badge} ${styles.badgeBad}`} style={badgeStyle}>
                     <XCircleIcon style={{ width: 20, height: 20 }} />
                     Level {currentLevel + 1} Failed
                  </div>
                  <div
                     style={{
                        marginTop: "12px",
                        fontSize: isMobile ? "0.95rem" : "1.05rem",
                        fontWeight: 600,
                        color: "var(--text)",
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
               <div className={`${styles.card} ${styles.notice} ${fx.fadeUp}`} style={noticeStyle}>
                  <div className={`${styles.badge} ${styles.badgeOk}`} style={badgeStyle}>
                     <TrophyIcon style={{ width: 20, height: 20 }} />
                     Game Complete!
                  </div>
                  <div
                     style={{
                        fontSize: isMobile ? "1.05rem" : "1.1rem",
                        fontWeight: 600,
                        marginTop: "16px",
                     }}
                  >
                     All {maxLevels} levels completed!
                  </div>
               </div>
            )}

            {/* Action Buttons: Replay, Share */}
            {(gameState === "playing" || gameState === "failed") && renderActions()}
         </div>
      </>
   );
}
