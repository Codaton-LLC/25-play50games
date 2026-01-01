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

interface ClickGreenProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function ClickGreen({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: ClickGreenProps) {
   const maxLevels = config.levels || 10;
   const levelDuration = config.levelDuration || 20; // seconds per level

   // Level requirements from config (optional, falls back to default progression)
   const levelRequirements = config.levelRequirements || null;
   const [currentLevel, setCurrentLevel] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "playing" | "correct" | "wrong" | "paused" | "ready" | "failed"
   >("playing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [timeLeft, setTimeLeft] = useState(levelDuration);
   const [correctClicks, setCorrectClicks] = useState(0);
   const [wrongClicks, setWrongClicks] = useState(0);
   const [items, setItems] = useState<
      Array<{
         id: number;
         color: "green" | "red";
         x: number;
         y: number;
         vx: number; // velocity x
         vy: number; // velocity y
         size: number; // size multiplier (0.8-1.2)
         shape: "circle" | "square" | "triangle"; // shape type
         rotation: number; // rotation angle
         clicked: boolean;
         timeoutId: NodeJS.Timeout;
      }>
   >([]);
   const animationFrameRef = useRef<number | null>(null);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max replays: 5 for Click the Green, unlimited if shared
   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited

   const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
   const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
   const itemIdCounterRef = useRef(0);
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

   // Clear all items and timers
   const clearAll = useCallback(() => {
      setItems((prevItems) => {
         prevItems.forEach((item) => {
            if (item.timeoutId) clearTimeout(item.timeoutId);
         });
         return [];
      });
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
   }, []);

   // Get spawn interval based on level (faster with higher levels)
   const getSpawnInterval = useCallback(() => {
      // Level 1: 600ms, Level 5: 400ms, Level 10: 250ms
      return Math.max(250, 600 - currentLevel * 35);
   }, [currentLevel]);

   // Get item TTL based on level (shorter with higher levels)
   const getItemTTL = useCallback(() => {
      // Level 1: 2000ms, Level 5: 1200ms, Level 10: 800ms
      return Math.max(800, 2000 - currentLevel * 120);
   }, [currentLevel]);

   // Spawn items
   const spawnItems = useCallback(() => {
      // IMMEDIATELY stop spawning if game is not playing or requirements are met
      if (gameStateRef.current !== "playing" || requirementsMetRef.current) {
         // Clear spawn timer if it exists
         if (spawnTimerRef.current) {
            clearInterval(spawnTimerRef.current);
            spawnTimerRef.current = null;
         }
         return;
      }

      // Sometimes spawn 2 items to increase difficulty (more likely at higher levels)
      const spawnCount = Math.random() < 0.15 + currentLevel * 0.02 ? 2 : 1;

      for (let k = 0; k < spawnCount; k++) {
         const id = itemIdCounterRef.current++;
         const isGreen = Math.random() < 0.65; // 65% green, 35% red
         const color: "green" | "red" = isGreen ? "green" : "red";

         // Random position in arena (avoid edges)
         const arenaWidth = isMobile ? window.innerWidth - 48 : 800;
         const arenaHeight = isMobile ? 300 : 380;
         const x = Math.random() * (arenaWidth - 100) + 50;
         const y = Math.random() * (arenaHeight - 100) + 50;

         // Random velocity (faster at higher levels)
         const speed = 0.3 + currentLevel * 0.05; // 0.3-0.8 px/frame
         const angle = Math.random() * Math.PI * 2;
         const vx = Math.cos(angle) * speed;
         const vy = Math.sin(angle) * speed;

         // Random size (0.8-1.2x)
         const size = 0.8 + Math.random() * 0.4;

         // Random shape
         const shapes: ("circle" | "square" | "triangle")[] = [
            "circle",
            "square",
            "triangle",
         ];
         const shape = shapes[Math.floor(Math.random() * shapes.length)];

         // Random rotation
         const rotation = Math.random() * 360;

         const ttl = getItemTTL();
         const timeoutId = setTimeout(() => {
            setItems((prev) => prev.filter((item) => item.id !== id));
         }, ttl);

         setItems((prev) => [
            ...prev,
            {
               id,
               color,
               x,
               y,
               vx,
               vy,
               size,
               shape,
               rotation,
               clicked: false,
               timeoutId,
            },
         ]);
      }
   }, [gameState, requirementsMet, currentLevel, getItemTTL, isMobile]);

   // Start level
   const startLevel = useCallback(() => {
      clearAll();
      setTimeLeft(levelDuration);
      setCorrectClicks(0);
      setWrongClicks(0);
      levelScoreRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      requirementsMetRef.current = false;
      setGameState("playing");
      setFeedback(null);
      setRequirementsMet(false);
      setItems([]);
      itemIdCounterRef.current = 0;

      // Start spawning
      spawnItems();
      spawnTimerRef.current = setInterval(spawnItems, getSpawnInterval());

      // Start animation loop for moving items
      const animate = () => {
         if (gameStateRef.current !== "playing" || requirementsMetRef.current) {
            return;
         }

         setItems((prevItems) => {
            const arenaWidth = isMobile ? window.innerWidth - 48 : 800;
            const arenaHeight = isMobile ? 300 : 380;
            const itemSize = isMobile ? 48 : 54;

            return prevItems.map((item) => {
               if (item.clicked) return item;

               let newX = item.x + item.vx;
               let newY = item.y + item.vy;
               let newVx = item.vx;
               let newVy = item.vy;

               // Bounce off walls
               if (newX < itemSize / 2 || newX > arenaWidth - itemSize / 2) {
                  newVx = -newVx;
                  newX = Math.max(
                     itemSize / 2,
                     Math.min(arenaWidth - itemSize / 2, newX)
                  );
               }
               if (newY < itemSize / 2 || newY > arenaHeight - itemSize / 2) {
                  newVy = -newVy;
                  newY = Math.max(
                     itemSize / 2,
                     Math.min(arenaHeight - itemSize / 2, newY)
                  );
               }

               // Update rotation
               const newRotation = item.rotation + 2;

               return {
                  ...item,
                  x: newX,
                  y: newY,
                  vx: newVx,
                  vy: newVy,
                  rotation: newRotation,
               };
            });
         });

         animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);

      // Start countdown
      countdownTimerRef.current = setInterval(() => {
         setTimeLeft((prev: number) => {
            if (requirementsMetRef.current) {
               return prev;
            }
            if (prev <= 1) {
               // Only end level if not paused (requirements not met yet)
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
   }, [levelDuration, clearAll, spawnItems, getSpawnInterval, isMobile]);

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Get minimum required correct clicks for level
   const getMinCorrectClicks = useCallback(() => {
      // Check if custom requirements are provided in config
      if (levelRequirements && levelRequirements[currentLevel]) {
         return (
            levelRequirements[currentLevel].minCorrectClicks || 3 + currentLevel
         );
      }
      // Default progression: Level 1: 3 clicks, Level 2: 4 clicks, Level 3: 5 clicks, etc.
      return 3 + currentLevel;
   }, [currentLevel, levelRequirements]);

   const getMinScore = useCallback(() => {
      if (levelRequirements && levelRequirements[currentLevel]) {
         return (
            levelRequirements[currentLevel].minScore || 20 + currentLevel * 5
         );
      }
      return 20 + currentLevel * 5;
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
      // Calculate score based on completed levels
      // Level 1 = 10 points, Level 2 = 20 points, Level 3 = 30 points, etc.
      const roundScore = Math.round(100 / maxLevels);
      // When this is called, we just completed currentLevel + 1
      const completedLevels = currentLevel + 1; // Current level is 0-indexed, so +1 for completed
      const newScore = Math.min(100, completedLevels * roundScore);

      // Check if game is complete (if we just completed the last level)
      if (completedLevels >= maxLevels) {
         finalizeGame();
      } else {
         // Advance to next level
         setCurrentScore(newScore);
         onScoreUpdate(newScore);

         forceStartLevelRef.current = currentLevel + 1;
         setCurrentLevel((prev) => prev + 1);
         setRequirementsMet(false);
      }
   }, [currentLevel, maxLevels, onScoreUpdate, finalizeGame]);

   // Handle repeat round button click
   // Replay functionality
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return; // No replays left

      // Reset state and restart the level
      setRequirementsMet(false);
      requirementsMetRef.current = false;
      setGameState("playing");
      gameStateRef.current = "playing";
      setFeedback(null);
      setCorrectClicks(0);
      setWrongClicks(0);
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
         await registerShare(shareId, "click-green");
         const gameKey = "play50games_shared_click-green";
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
               title: "Click the Green Game",
               text: "Check out this awesome Click the Green game!",
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
         const gameKey = "play50games_shared_click-green";
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
      const gameKey = "play50games_shared_click-green";
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
      clearAll();

      // Calculate level score: based on correct clicks and mistakes
      const levelScore = Math.max(0, correctClicks * 10 - wrongClicks * 5);
      levelScoreRef.current = levelScore;

      // Check if level passed (only check correct clicks, no minScore)
      const minCorrectClicks = getMinCorrectClicks();
      const minScore = getMinScore();
      const levelPassed =
         correctClicks >= minCorrectClicks && levelScore >= minScore;

      if (levelPassed && !requirementsMet) {
         // Requirements met but timer already ended - proceed normally
         handleNextRound();
      } else if (!levelPassed) {
         // Level failed - pause and show repeat button
         setGameState("failed");
         setFeedback("wrong");
      }
   }, [
      clearAll,
      correctClicks,
      wrongClicks,
      requirementsMet,
      getMinCorrectClicks,
      getMinScore,
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

   // Check if level requirements are met during gameplay (pause and wait for timer)
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const minCorrectClicks = getMinCorrectClicks();
      const minScore = getMinScore();

      if (
         correctClicks >= minCorrectClicks &&
         Math.max(0, correctClicks * 10 - wrongClicks * 5) >= minScore
      ) {
         // Requirements met - IMMEDIATELY freeze game
         const levelScore = Math.max(0, correctClicks * 10 - wrongClicks * 5);
         levelScoreRef.current = levelScore;

         clearAll();
         setTimeLeft(0);

         // Set state to pause (freeze game)
         requirementsMetRef.current = true;
         setRequirementsMet(true);
         setGameState("ready");
         setFeedback(null); // Clear feedback to avoid clash

         if (currentLevel + 1 >= maxLevels) {
            finalizeGame();
         }
      }
   }, [
      correctClicks,
      wrongClicks,
      gameState,
      requirementsMet,
      getMinCorrectClicks,
      getMinScore,
      clearAll,
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

   // When timer reaches 0 and requirements are met, show "ready" message
   useEffect(() => {
      if (timeLeft === 0 && requirementsMet && gameState === "paused") {
         setGameState("ready");
      }
   }, [timeLeft, requirementsMet, gameState]);

   // Handle item click
   const handleItemClick = useCallback(
      (id: number) => {
         // IMMEDIATELY block if game is not playing or requirements are met
         if (gameState !== "playing" || requirementsMet) {
            return;
         }

         const item = items.find((i) => i.id === id);
         if (!item || item.clicked) return;

         // Mark as clicked
         setItems((prev) =>
            prev.map((i) => (i.id === id ? { ...i, clicked: true } : i))
         );

         // Clear timeout
         clearTimeout(item.timeoutId);

         if (item.color === "green") {
            // Correct click
            setCorrectClicks((prev) => prev + 1);
            setFeedback("correct");
            setTimeout(() => setFeedback(null), 500);
         } else {
            // Wrong click
            setWrongClicks((prev) => prev + 1);
            setFeedback("wrong");
            setTimeout(() => setFeedback(null), 500);
         }

         // Remove item after short delay
         setTimeout(() => {
            setItems((prev) => prev.filter((i) => i.id !== id));
         }, 200);
      },
      [gameState, items, requirementsMet]
   );

   // Handle arena click (miss)
   const handleArenaClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
         // IMMEDIATELY block if game is not playing or requirements are met
         if (gameState !== "playing" || requirementsMet) {
            return;
         }
         // Only count as miss if clicking directly on arena, not on items
         if (
            (e.target as HTMLElement).classList.contains("click-green-arena")
         ) {
            setWrongClicks((prev) => prev + 1);
         }
      },
      [gameState, requirementsMet]
   );

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
      <>
         <style>{`
            @keyframes itemPulse {
               0%, 100% {
                  transform: translate(-50%, -50%) scale(1);
                  opacity: 1;
               }
               50% {
                  transform: translate(-50%, -50%) scale(1.08);
                  opacity: 0.85;
               }
            }
         `}</style>
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
            {/* Header Section - Same as Memory Games */}
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
                     Correct: {correctClicks} / {getMinCorrectClicks()}
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
                     Mistakes: {wrongClicks}
                  </div>
               </div>

               {/* Arena */}
               <div
                  className="click-green-arena"
                  onClick={handleArenaClick}
                  style={{
                     position: "relative",
                     width: "100%",
                     height: isMobile ? "300px" : "380px",
                     borderRadius: "var(--radius)",
                     border: "1px solid var(--border)",
                     background:
                        "radial-gradient(320px 220px at 30% 30%, rgba(59, 130, 246, 0.1), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                     boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
                     overflow: "hidden",
                     cursor:
                        gameState === "playing" && !requirementsMet
                           ? "pointer"
                           : "default",
                     pointerEvents:
                        gameState === "playing" && !requirementsMet
                           ? "auto"
                           : "none",
                  }}
               >
                  {/* Items */}
                  {items.map((item) => {
                     const baseSize = isMobile ? 48 : 54;
                     const size = baseSize * item.size;
                     const colorValue =
                        item.color === "green"
                           ? "134, 239, 172"
                           : "252, 165, 165";
                     const borderColor = `rgba(${colorValue}, 0.7)`;
                     const bgColor = item.clicked
                        ? `rgba(${colorValue}, 0.4)`
                        : `rgba(${colorValue}, 0.2)`;
                     const glowColor = `rgba(${colorValue}, 0.5)`;

                     // Shape-specific styling
                     let borderRadius = "16px";
                     let clipPath = "none";
                     if (item.shape === "square") {
                        borderRadius = "8px";
                     } else if (item.shape === "triangle") {
                        borderRadius = "0";
                        clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
                     }

                     return (
                        <button
                           key={item.id}
                           onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick(item.id);
                           }}
                           disabled={
                              item.clicked ||
                              gameState !== "playing" ||
                              requirementsMet
                           }
                           style={{
                              pointerEvents:
                                 gameState === "playing" &&
                                 !requirementsMet &&
                                 !item.clicked
                                    ? "auto"
                                    : "none",
                              position: "absolute",
                              left: `${item.x}px`,
                              top: `${item.y}px`,
                              transform: item.clicked
                                 ? `translate(-50%, -50%) scale(0.9) rotate(${item.rotation}deg)`
                                 : `translate(-50%, -50%) scale(1) rotate(${item.rotation}deg)`,
                              width: `${size}px`,
                              height: `${size}px`,
                              borderRadius,
                              clipPath,
                              border: `2px solid ${borderColor}`,
                              background: bgColor,
                              color: "white",
                              fontSize: `${size * 0.45}px`,
                              fontWeight: 900,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: item.clicked ? "not-allowed" : "pointer",
                              transition: item.clicked
                                 ? "all 0.2s ease"
                                 : "none",
                              opacity: item.clicked ? 0.5 : 1,
                              boxShadow: item.clicked
                                 ? "none"
                                 : `0 0 ${
                                      size * 0.3
                                   }px ${glowColor}, 0 4px 8px rgba(0, 0, 0, 0.2)`,
                              animation: item.clicked
                                 ? "none"
                                 : "itemPulse 2s ease-in-out infinite",
                           }}
                        >
                           {item.clicked ? (
                              item.color === "green" ? (
                                 <CheckCircleIcon
                                    style={{
                                       width: size * 0.5,
                                       height: size * 0.5,
                                    }}
                                 />
                              ) : (
                                 <XCircleIcon
                                    style={{
                                       width: size * 0.5,
                                       height: size * 0.5,
                                    }}
                                 />
                              )
                           ) : item.color === "green" ? (
                              "✓"
                           ) : (
                              "✕"
                           )}
                        </button>
                     );
                  })}

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
                        Click only green items!
                     </div>
                  )}
               </div>

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
                     +1 Correct!
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
                     -1 Mistake!
                  </div>
               )}

               {/* Paused Message (Requirements Met, Waiting for Timer) */}
               {gameState === "paused" && (
                  <div style={getNoticeStyle()}>
                     <div style={getNoticeBadgeStyle("success")}>
                        <CheckCircleIcon style={{ width: 20, height: 20 }} />
                        Requirements Met
                     </div>
                     <div
                        style={{
                           fontSize: "0.9rem",
                           opacity: 0.8,
                           marginTop: "12px",
                        }}
                     >
                        Waiting for timer... {timeLeft}s remaining
                     </div>
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
                        Need: {getMinCorrectClicks()} correct clicks
                     </div>
                     <div
                        style={{
                           fontSize: isMobile ? "1.05rem" : "1.1rem",
                           fontWeight: 600,
                           marginBottom: "20px",
                        }}
                     >
                        Score too low.
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
