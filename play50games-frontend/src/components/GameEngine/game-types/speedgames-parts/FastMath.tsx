"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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

interface FastMathProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function FastMath({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: FastMathProps) {
   // Parse levels from config - ensure it's a number
   const maxLevels = config?.levels ? Number(config.levels) : 20;
   const levelDuration = config?.levelDuration
      ? Number(config.levelDuration)
      : 30; // seconds per level

   // Level requirements from config (optional, falls back to default progression)
   const levelRequirements = config?.levelRequirements || null;
   const [currentLevel, setCurrentLevel] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "playing" | "correct" | "wrong" | "paused" | "ready" | "failed"
   >("playing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [timeLeft, setTimeLeft] = useState(levelDuration);
   const [correctAnswers, setCorrectAnswers] = useState(0);
   const [wrongAnswers, setWrongAnswers] = useState(0);
   const [problem, setProblem] = useState<{
      a: number;
      b: number;
      op: string;
      answer: number;
   } | null>(null);
   const [options, setOptions] = useState<number[]>([]);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max replays: 5 for Fast Math, unlimited if shared
   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited

   const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
   const levelScoreRef = useRef(0);
   const gameStateRef = useRef<
      "playing" | "correct" | "wrong" | "paused" | "ready" | "failed"
   >("playing");
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

   // Clear all timers
   const clearAll = useCallback(() => {
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }
   }, []);

   // Generate math problem based on level difficulty
   const generateProblem = useCallback(() => {
      const level = currentLevel;
      let a: number, b: number, op: string, answer: number;

      // Progressive difficulty
      if (level < 5) {
         // Levels 1-5: Simple addition/subtraction (1-20)
         a = Math.floor(Math.random() * 20) + 1;
         b = Math.floor(Math.random() * 20) + 1;
         op = Math.random() > 0.5 ? "+" : "-";
      } else if (level < 10) {
         // Levels 6-10: Addition/subtraction (1-50), introduce multiplication
         if (Math.random() > 0.3) {
            a = Math.floor(Math.random() * 50) + 1;
            b = Math.floor(Math.random() * 50) + 1;
            op = Math.random() > 0.5 ? "+" : "-";
         } else {
            a = Math.floor(Math.random() * 10) + 1;
            b = Math.floor(Math.random() * 10) + 1;
            op = "*";
         }
      } else if (level < 15) {
         // Levels 11-15: All operations, larger numbers
         const ops = ["+", "-", "*"];
         op = ops[Math.floor(Math.random() * ops.length)];
         if (op === "*") {
            a = Math.floor(Math.random() * 12) + 1;
            b = Math.floor(Math.random() * 12) + 1;
         } else {
            a = Math.floor(Math.random() * 100) + 1;
            b = Math.floor(Math.random() * 100) + 1;
         }
      } else {
         // Levels 16-20: All operations including division, complex numbers
         const ops = ["+", "-", "*", "/"];
         op = ops[Math.floor(Math.random() * ops.length)];
         if (op === "/") {
            b = Math.floor(Math.random() * 10) + 2;
            const quotient = Math.floor(Math.random() * 10) + 1;
            a = b * quotient;
         } else if (op === "*") {
            a = Math.floor(Math.random() * 15) + 1;
            b = Math.floor(Math.random() * 15) + 1;
         } else {
            a = Math.floor(Math.random() * 200) + 1;
            b = Math.floor(Math.random() * 200) + 1;
         }
      }

      // Calculate answer
      switch (op) {
         case "+":
            answer = a + b;
            break;
         case "-":
            answer = a - b; // Allow negative results
            break;
         case "*":
            answer = a * b;
            break;
         case "/":
            answer = a / b;
            break;
         default:
            answer = a + b;
      }

      // Generate 4 options: 1 correct + 3 wrong
      const wrongOptions: number[] = [];
      const usedValues = new Set<number>([answer]);

      // Generate 3 wrong options that are different from the correct answer
      while (wrongOptions.length < 3) {
         let wrongAnswer: number;
         if (op === "/") {
            // For division, generate wrong answers close to the correct one
            const offset = Math.floor(Math.random() * 10) + 1;
            wrongAnswer = answer + (Math.random() > 0.5 ? offset : -offset);
            // Ensure division answers are positive
            wrongAnswer = Math.abs(wrongAnswer);
         } else {
            // For other operations, generate wrong answers within a range
            const range = Math.max(10, Math.abs(answer) * 0.5);
            wrongAnswer = Math.round(
               answer + (Math.random() * range * 2 - range)
            );
         }

         // Ensure wrong answer is different (allow negative for subtraction)
         if (!usedValues.has(wrongAnswer)) {
            wrongOptions.push(wrongAnswer);
            usedValues.add(wrongAnswer);
         }
      }

      // Combine correct and wrong answers, then shuffle
      const allOptions = [answer, ...wrongOptions];
      const shuffled = allOptions.sort(() => Math.random() - 0.5);

      setProblem({ a, b, op, answer });
      setOptions(shuffled);
   }, [currentLevel]);

   // Start level
   const startLevel = useCallback(() => {
      clearAll();
      setTimeLeft(levelDuration);
      setCorrectAnswers(0);
      setWrongAnswers(0);
      levelScoreRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      setGameState("playing");
      setFeedback(null);
      setRequirementsMet(false);
      generateProblem();

      // Start countdown
      countdownTimerRef.current = setInterval(() => {
         setTimeLeft((prev: number) => {
            if (requirementsMetRef.current) {
               return prev;
            }
            if (prev <= 1) {
               if (
                  gameStateRef.current !== "paused" &&
                  gameStateRef.current !== "ready"
               ) {
                  endLevel();
               }
               return 0;
            }
            return prev - 1;
         });
      }, 1000);
   }, [levelDuration, clearAll, generateProblem]);

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Get minimum required correct answers for level
   const getMinCorrectAnswers = useCallback(() => {
      if (levelRequirements && levelRequirements[currentLevel]) {
         return (
            levelRequirements[currentLevel].minCorrectAnswers ||
            5 + currentLevel
         );
      }
      return 5 + currentLevel;
   }, [currentLevel, levelRequirements]);

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
      setFeedback(null);
      setCorrectAnswers(0);
      setWrongAnswers(0);
      setTimeLeft(levelDuration);
      clearAll();
      startLevel();
      setReplaysUsed((prev) => prev + 1);
   }, [
      gameState,
      maxReplays,
      replaysUsed,
      startLevel,
      levelDuration,
      clearAll,
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
         await registerShare(shareId, "fast-math");
         const gameKey = "play50games_shared_fast-math";
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
               title: "Fast Math Game",
               text: "Check out this awesome Fast Math game!",
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
         const gameKey = "play50games_shared_fast-math";
         try {
            const status = await getShareStatus(currentShareId);
            const hasClicks = status.has_clicks || status.clicks > 0;
            if (hasClicks && !hasShared) {
               setHasShared(true);
               setUnlimitedActivated(true);
               setReplaysUsed(0);

               const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes
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
               }
            }
         }
      };

      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000);

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, hasShared]);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_fast-math";
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

      // Check URL for shared parameter
      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
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

   // End level
   const endLevel = useCallback(() => {
      if (requirementsMetRef.current) {
         return;
      }
      clearAll();

      const minCorrectAnswers = getMinCorrectAnswers();
      const levelPassed = correctAnswers >= minCorrectAnswers;

      if (levelPassed && !requirementsMet) {
         handleNextRound();
      } else if (!levelPassed) {
         setGameState("failed");
         setFeedback("wrong");
      }
   }, [
      clearAll,
      correctAnswers,
      requirementsMet,
      getMinCorrectAnswers,
      handleNextRound,
   ]);

   useEffect(() => {
      if (!isPlaying || currentLevel >= maxLevels) {
         prevLevelRef.current = null;
         if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
         }
         clearAll();
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
   }, [isPlaying, currentLevel, maxLevels, clearAll]);

   // Check if level requirements are met during gameplay
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const minCorrectAnswers = getMinCorrectAnswers();

      if (correctAnswers >= minCorrectAnswers) {
         clearAll();
         setTimeLeft(0);

         requirementsMetRef.current = true;
         setRequirementsMet(true);
         setGameState("ready");
         setFeedback(null);

         if (currentLevel + 1 >= maxLevels) {
            finalizeGame();
         } else {
            const roundScore = Math.round(100 / maxLevels);
            const completedLevels = currentLevel + 1;
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            onScoreUpdate(newScore);
         }
      }
   }, [
      correctAnswers,
      gameState,
      requirementsMet,
      getMinCorrectAnswers,
      clearAll,
      currentLevel,
      maxLevels,
      onScoreUpdate,
      finalizeGame,
   ]);

   useEffect(() => {
      requirementsMetRef.current = requirementsMet;
   }, [requirementsMet]);

   useEffect(() => {
      gameStateRef.current = gameState;
   }, [gameState]);

   // Handle answer selection from button
   const handleAnswerClick = useCallback(
      (selectedAnswer: number) => {
         if (gameState !== "playing" || requirementsMet || !problem) return;

         // For division, allow floating point tolerance
         const isCorrect =
            problem.op === "/"
               ? Math.abs(selectedAnswer - problem.answer) < 0.01
               : selectedAnswer === problem.answer;

         if (isCorrect) {
            setCorrectAnswers((prev) => prev + 1);
            setFeedback("correct");
            setTimeout(() => setFeedback(null), 500);
         } else {
            setWrongAnswers((prev) => prev + 1);
            setFeedback("wrong");
            setTimeout(() => setFeedback(null), 500);
         }

         // Generate new problem after short delay
         setTimeout(() => {
            if (
               gameStateRef.current === "playing" &&
               !requirementsMetRef.current
            ) {
               generateProblem();
            }
         }, 600);
      },
      [gameState, requirementsMet, problem, generateProblem]
   );

   // Keyboard support for 1, 2, 3, 4
   useEffect(() => {
      if (
         !isPlaying ||
         gameState !== "playing" ||
         requirementsMet ||
         !problem ||
         !options.length
      ) {
         return;
      }

      const handleKeyPress = (e: KeyboardEvent) => {
         // Only handle if not typing in an input field
         if (
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement
         ) {
            return;
         }

         const key = e.key;
         if (key === "1" || key === "2" || key === "3" || key === "4") {
            const index = parseInt(key) - 1;
            if (index >= 0 && index < options.length) {
               e.preventDefault();
               handleAnswerClick(options[index]);
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => {
         window.removeEventListener("keydown", handleKeyPress);
      };
   }, [
      isPlaying,
      gameState,
      requirementsMet,
      problem,
      options,
      handleAnswerClick,
   ]);

   const progress = ((currentLevel + 1) / maxLevels) * 100;

   // Styling functions
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

                        color: "var(--text)",
                        fontSize: isMobile ? "0.85rem" : "0.95rem",
                        fontWeight: 600,
                     }}
                  >
                     Wrong: {wrongAnswers}
                  </div>
               </div>

               {/* Math Problem */}
               {gameState === "playing" && problem && (
                  <div
                     style={{
                        width: "100%",
                        maxWidth: "600px",
                        padding: isMobile ? "24px" : "32px",
                        background: "var(--card)",
                        borderRadius: "var(--radius)",
                        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.2)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "24px",
                     }}
                  >
                     <div
                        style={{
                           fontSize: isMobile ? "2rem" : "3rem",
                           fontWeight: 800,
                           color: "var(--text)",
                           textAlign: "center",
                           marginBottom: isMobile ? "24px" : "32px",
                        }}
                     >
                        {problem.a}{" "}
                        {problem.op === "*"
                           ? "×"
                           : problem.op === "/"
                           ? "÷"
                           : problem.op}{" "}
                        {problem.b} = ?
                     </div>
                     <div
                        style={{
                           display: "grid",
                           gridTemplateColumns: isMobile
                              ? "1fr 1fr"
                              : "1fr 1fr",
                           gap: isMobile ? "12px" : "16px",
                           width: "100%",
                        }}
                     >
                        {options.map((option, index) => (
                           <button
                              key={index}
                              onClick={() => handleAnswerClick(option)}
                              disabled={
                                 gameState !== "playing" || requirementsMet
                              }
                              style={{
                                 padding: isMobile ? "20px 16px" : "24px 20px",
                                 fontSize: isMobile ? "1.5rem" : "2rem",
                                 fontWeight: 700,
                                 background:
                                    gameState !== "playing" || requirementsMet
                                       ? "rgba(100, 100, 100, 0.2)"
                                       : "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))",
                                 border:
                                    gameState !== "playing" || requirementsMet
                                       ? "2px solid rgba(100, 100, 100, 0.4)"
                                       : "2px solid rgba(125, 211, 252, 0.6)",

                                 color: "var(--text)",
                                 cursor:
                                    gameState !== "playing" || requirementsMet
                                       ? "not-allowed"
                                       : "pointer",
                                 opacity:
                                    gameState !== "playing" || requirementsMet
                                       ? 0.5
                                       : 1,
                                 transition: "all 0.3s ease",
                                 fontFamily: "monospace",
                                 position: "relative",
                              }}
                              onMouseEnter={(e) => {
                                 if (
                                    gameState === "playing" &&
                                    !requirementsMet
                                 ) {
                                    e.currentTarget.style.background =
                                       "linear-gradient(135deg, rgba(125, 211, 252, 0.3), rgba(125, 211, 252, 0.2))";
                                    e.currentTarget.style.borderColor =
                                       "rgba(125, 211, 252, 0.8)";
                                    e.currentTarget.style.transform =
                                       "translateY(-2px)";
                                    e.currentTarget.style.boxShadow =
                                       "0 6px 16px rgba(125, 211, 252, 0.4)";
                                 }
                              }}
                              onMouseLeave={(e) => {
                                 if (
                                    gameState === "playing" &&
                                    !requirementsMet
                                 ) {
                                    e.currentTarget.style.background =
                                       "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))";
                                    e.currentTarget.style.borderColor =
                                       "rgba(125, 211, 252, 0.6)";
                                    e.currentTarget.style.transform =
                                       "translateY(0)";
                                    e.currentTarget.style.boxShadow = "none";
                                 }
                              }}
                           >
                              {/* Number indicator badge */}
                              <div
                                 style={{
                                    position: "absolute",
                                    top: isMobile ? "4px" : "6px",
                                    left: isMobile ? "4px" : "6px",
                                    width: isMobile ? "20px" : "24px",
                                    height: isMobile ? "20px" : "24px",
                                    background:
                                       gameState !== "playing" ||
                                       requirementsMet
                                          ? "rgba(100, 100, 100, 0.4)"
                                          : "rgba(59, 130, 246, 0.8)",
                                    borderRadius: "6px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: isMobile ? "0.7rem" : "0.8rem",
                                    fontWeight: 800,
                                    color: "white",
                                    boxShadow:
                                       gameState !== "playing" ||
                                       requirementsMet
                                          ? "none"
                                          : "0 2px 6px rgba(59, 130, 246, 0.4)",
                                 }}
                              >
                                 {index + 1}
                              </div>
                              {/* Answer value */}
                              <span
                                 style={{
                                    display: "block",
                                    marginTop: isMobile ? "8px" : "10px",
                                 }}
                              >
                                 {problem.op === "/"
                                    ? option.toFixed(1)
                                    : option.toString()}
                              </span>
                           </button>
                        ))}
                     </div>
                  </div>
               )}

               {/* Feedback Messages */}
               {feedback === "correct" && gameState === "playing" && (
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: isMobile ? "10px 16px" : "12px 20px",
                        background: "var(--ok)",
                        border: "1px solid var(--ok)",
                        borderRadius: "var(--radius)",
                        color: "white",
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 600,
                     }}
                  >
                     <CheckCircleIcon style={{ width: 20, height: 20 }} />
                     Correct!
                  </div>
               )}

               {feedback === "wrong" && gameState === "playing" && (
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: isMobile ? "10px 16px" : "12px 20px",
                        background: "var(--warn)",
                        border: "1px solid var(--warn)",
                        borderRadius: "var(--radius)",
                        color: "white",
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 600,
                     }}
                  >
                     <XCircleIcon style={{ width: 20, height: 20 }} />
                     Wrong! Try again.
                  </div>
               )}

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
                        onMouseEnter={(e) =>
                           applyActionHover(e, "success", true)
                        }
                        onMouseLeave={(e) =>
                           applyActionHover(e, "success", false)
                        }
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
                        Final Score:{" "}
                        {currentLevel + 1 >= maxLevels ? 100 : currentScore}
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
                              {isMobile
                                 ? "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!"
                                 : "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!"}
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
                        onMouseEnter={(e) => {
                           if (!(maxReplays > 0 && replaysUsed >= maxReplays)) {
                              e.currentTarget.style.background =
                                 "linear-gradient(135deg, rgba(125, 211, 252, 0.3), rgba(125, 211, 252, 0.2))";
                              e.currentTarget.style.borderColor =
                                 "rgba(125, 211, 252, 0.8)";
                              e.currentTarget.style.transform =
                                 "translateY(-2px)";
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
