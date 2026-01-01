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
import FastMath from "./speedgames-parts/FastMath";

interface SpeedGamesProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}

export default function SpeedGames({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: SpeedGamesProps) {
   const [currentGame, setCurrentGame] = useState<string>("");

   useEffect(() => {
      if (!isPlaying) return;

      const gameType = config.gameType;

      if (!gameType) {
         return;
      }

      setCurrentGame(gameType);
   }, [isPlaying, config]);

   const gameComponents: Record<string, JSX.Element> = {
      "click-green": (
         <ClickGreen
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "avoid-red": (
         <AvoidRed
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "reaction-test": (
         <ReactionTest
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "fast-math": (
         <FastMath
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
            passingScore={70}
         />
      ),
      "whack-shape": (
         <WhackShape
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "typing-sprint": (
         <TypingSprint
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "quick-compare": (
         <QuickCompare
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "falling-objects": (
         <FallingObjects
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "tap-counter": (
         <TapCounter
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "reflex-arrows": (
         <ReflexArrows
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
   };

   return (
      gameComponents[currentGame] || (
         <div>Speed game "{currentGame}" not found.</div>
      )
   );
}

// Click the Green Game (26) - Modern version with levels
function ClickGreen({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}) {
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
   }, [levelDuration, clearAll, spawnItems, getSpawnInterval]);

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
      startLevel,
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
      [gameState, items]
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

// Avoid the Red Game (27) - Modern version with levels
function AvoidRed({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}) {
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
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

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
      const roundScore = Math.round(100 / maxLevels);
      const newScore = nextLevel * roundScore;
      currentLevelRef.current = nextLevel;
      setCurrentLevel(nextLevel);
      setCurrentScore(newScore);
      onScoreUpdate(newScore);
      startLevel(nextLevel);
   }, [currentLevel, maxLevels, onScoreUpdate, onComplete, startLevel]);

   // Handle repeat round
   const handleRepeatRound = useCallback(() => {
      startLevel(currentLevelRef.current);
   }, [startLevel]);

   // Mouse control
   const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
         if (gameState !== "playing" || requirementsMetRef.current) return;
         if (!arenaRef.current) return;

         const r = arenaRef.current.getBoundingClientRect();
         const x = clamp(e.clientX - r.left, 7, r.width - 7);
         const y = clamp(e.clientY - r.top, 7, r.height - 7);
         playerPosRef.current = { x, y };
         setPlayerPos({ x, y });
      },
      [gameState]
   );

   const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
         if (gameState !== "playing" || requirementsMetRef.current) return;
         if (!arenaRef.current) return;

         const r = arenaRef.current.getBoundingClientRect();
         const x = clamp(e.clientX - r.left, 7, r.width - 7);
         const y = clamp(e.clientY - r.top, 7, r.height - 7);
         playerPosRef.current = { x, y };
         setPlayerPos({ x, y });
      },
      [gameState]
   );

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
   const hitsLabel = maxHitsValue >= 999999 ? "∞" : hits;
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
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
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
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
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
                        "linear-gradient(90deg, var(--accent), var(--ok))",
                     borderRadius: "999px",
                     transition: "width 0.3s ease",
                  }}
               />
            </div>
         </div>

         {/* Stats Section */}
         <div
            style={{
               display: "flex",
               gap: isMobile ? "12px" : "16px",
               width: "100%",
               maxWidth: "800px",
               justifyContent: "center",
               flexWrap: "wrap",
            }}
         >
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
               Hits left: {hitsLabel} / {maxHitsLabel}
            </div>
            <div
               style={{
                  padding: isMobile ? "8px 12px" : "10px 16px",
                  background:
                     "linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(59, 130, 246, 0.12))",
                  border: "2px solid rgba(59, 130, 246, 0.6)",
                  borderRadius: "12px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
               }}
            >
               Obstacles: {obstacles.length}
            </div>
         </div>

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
                     Link copied! Unlimited hits and replays will unlock when
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
                           ? "🎉 Someone opened your link! Unlimited hits and replays are now active for 15 minutes!"
                           : "🎉 Someone opened your link! Unlimited hits and replays are now active for 15 minutes!"}
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
                  onMouseEnter={(e) => {
                     if (!(maxReplays > 0 && replaysUsed >= maxReplays)) {
                        e.currentTarget.style.background =
                           "linear-gradient(135deg, rgba(125, 211, 252, 0.3), rgba(125, 211, 252, 0.2))";
                        e.currentTarget.style.borderColor =
                           "rgba(125, 211, 252, 0.8)";
                        e.currentTarget.style.transform = "translateY(-2px)";
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
                        color: "rgba(59, 130, 246, 0.9)",
                     }}
                  />
                  <span>{isMobile ? "Share" : "Share for unlimited"}</span>
               </button>
            </div>
         )}

         {/* Arena */}
         <div
            ref={arenaRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            style={{
               position: "relative",
               width: "100%",
               maxWidth: "800px",
               height: isMobile ? "300px" : "380px",
               borderRadius: "var(--radius)",
               border: "1px solid var(--border)",
               background:
                  "radial-gradient(320px 220px at 30% 30%, rgba(59, 130, 246, 0.1), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
               boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
               overflow: "hidden",
               cursor:
                  gameState === "playing" && !requirementsMetRef.current
                     ? "crosshair"
                     : "default",
               pointerEvents:
                  gameState === "playing" && !requirementsMetRef.current
                     ? "auto"
                     : "none",
            }}
         >
            {/* Player */}
            <div
               style={{
                  position: "absolute",
                  left: `${playerPos.x}px`,
                  top: `${playerPos.y}px`,
                  transform: "translate(-50%, -50%)",
                  width: "14px",
                  height: "14px",
                  borderRadius: "999px",
                  background: "rgba(110, 168, 255, 0.95)",
                  boxShadow: "0 0 18px rgba(110, 168, 255, 0.45)",
                  pointerEvents: "none",
                  zIndex: 10,
               }}
            />

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
                     borderRadius: "12px",
                     background: "rgba(251, 113, 133, 0.9)",
                     boxShadow: "0 0 16px rgba(251, 113, 133, 0.35)",
                     pointerEvents: "none",
                  }}
               />
            ))}

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
                  Avoid red obstacles!
               </div>
            )}
         </div>

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
                  onMouseEnter={(e) => applyActionHover(e, "success", true)}
                  onMouseLeave={(e) => applyActionHover(e, "success", false)}
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
                  Final Score: 100
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
                  A red obstacle touched you!
               </div>
            </div>
         )}
      </div>
   );
}

// Reaction Test Game (28) - 10 Variants
function ReactionTest({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}) {
   const maxLevels = config.levels || 10;
   const levelRequirements = config.levelRequirements || [];

   // Debug: Log config to verify it's being received correctly
   useEffect(() => {
      // Config loaded
   }, [isPlaying, config, levelRequirements, maxLevels]);

   // Game state
   const [currentLevel, setCurrentLevel] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<"ready" | "playing" | "failed">(
      "ready"
   );
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Reaction test specific state
   const [waiting, setWaiting] = useState(true);
   const [greenShown, setGreenShown] = useState(false);
   const [reactionTime, setReactionTime] = useState(0);
   const [penalties, setPenalties] = useState(0);
   const [attempts, setAttempts] = useState<number[]>([]);
   const [attemptCount, setAttemptCount] = useState(0);
   const [showFeedback, setShowFeedback] = useState(false);

   // Mini-game specific states
   const [currentColor, setCurrentColor] = useState<
      "red" | "blue" | "orange" | "green" | null
   >(null);
   const [greenCircleIndex, setGreenCircleIndex] = useState<number | null>(
      null
   );
   const [targetPosition, setTargetPosition] = useState({ x: 50, y: 50 });
   const [countdown, setCountdown] = useState<number | "GO" | null>(null);
   const [targetShape, setTargetShape] = useState<
      "circle" | "square" | "triangle" | null
   >(null);
   const [shapeOptions, setShapeOptions] = useState<
      Array<{
         id: number;
         shape: "circle" | "square" | "triangle";
         isCorrect: boolean;
      }>
   >([]);
   const [movingObjects, setMovingObjects] = useState<
      Array<{
         id: number;
         x: number;
         y: number;
         color: "green" | "red";
         vx: number;
         vy: number;
      }>
   >([]);
   const [patternSequence, setPatternSequence] = useState<string[]>([]);
   const [patternIndex, setPatternIndex] = useState(0);
   const [multiTargets, setMultiTargets] = useState<
      Array<{ id: number; x: number; y: number; color: "green" | "red" }>
   >([]);
   const [progressBar, setProgressBar] = useState(0);
   const [memorySequence, setMemorySequence] = useState<number[]>([]);
   const [memoryIndex, setMemoryIndex] = useState(0);
   const [memorySequenceVisible, setMemorySequenceVisible] = useState(true);
   const [clickedSequence, setClickedSequence] = useState<number[]>([]);
   const [shuffledNumbers, setShuffledNumbers] = useState<number[]>([]);
   const [distractionActive, setDistractionActive] = useState(false);
   const [safeZoneActive, setSafeZoneActive] = useState(false);
   const [greenWindowRemaining, setGreenWindowRemaining] = useState(0);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max replays: 5 for Reaction Test, unlimited if shared
   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited

   // Refs
   const currentLevelRef = useRef(0);
   const gameStateRef = useRef<"ready" | "playing" | "failed">("ready");
   const requirementsMetRef = useRef(false);
   const completionCalledRef = useRef(false);
   const waitTimerRef = useRef<NodeJS.Timeout | null>(null);
   const greenTimerRef = useRef<NodeJS.Timeout | null>(null);
   const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
   const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
   const startTimeRef = useRef(0);
   const greenStartTimeRef = useRef(0);
   const animationFrameRef = useRef<number | null>(null);
   const objectIdCounterRef = useRef(0);

   // Mobile/Tablet detection
   useEffect(() => {
      const checkSize = () => {
         setIsMobile(window.innerWidth < 768);
         setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
      };
      checkSize();
      window.addEventListener("resize", checkSize);
      return () => window.removeEventListener("resize", checkSize);
   }, []);

   // Start level ref
   const startLevelRef = useRef<((levelIndex?: number) => void) | null>(null);

   // Get variant type for current level (0-9 maps to variants 1-10)
   const getVariant = useCallback(() => {
      return currentLevel; // Level 0 = Variant 1, Level 9 = Variant 10
   }, [currentLevel]);

   // Calculate wait time based on variant
   const getWaitTime = useCallback(() => {
      const variant = getVariant();
      if (variant === 1) {
         // Random Delay: 0.8-4s
         return Math.random() * 3200 + 800;
      } else if (variant === 5) {
         // Fatigue: delay zvogëlohet me çdo provë
         const baseDelay = 2000 - attemptCount * 150;
         return Math.max(800, baseDelay);
      } else {
         // Classic: 1-3s
         return Math.random() * 2000 + 1000;
      }
   }, [getVariant, attemptCount]);

   // Calculate green window duration based on variant
   const getGreenWindow = useCallback(() => {
      const variant = getVariant();
      if (variant === 2) {
         // Short Window: 600-800ms
         return Math.random() * 200 + 600;
      } else {
         // Default: unlimited
         return null;
      }
   }, [getVariant]);

   // Get maxTime for current level and format it
   const getMaxTimeDisplay = useCallback(() => {
      const levelReq = levelRequirements[currentLevel] || {};
      if (levelReq.maxTime === undefined) return null;

      let maxTimeMs: number | null = null;
      if (typeof levelReq.maxTime === "number") {
         maxTimeMs = levelReq.maxTime;
      } else if (typeof levelReq.maxTime === "string") {
         const timeStr = levelReq.maxTime.toLowerCase().trim();
         if (timeStr.endsWith("ms")) {
            maxTimeMs = parseFloat(timeStr.replace("ms", ""));
         } else if (timeStr.endsWith("s") || timeStr.endsWith("sec")) {
            maxTimeMs = parseFloat(timeStr.replace(/s(ec)?$/, "")) * 1000;
         } else {
            maxTimeMs = parseFloat(timeStr);
         }
      }

      if (maxTimeMs === null) return null;

      // Format: show as ms if < 1000ms, otherwise as seconds
      if (maxTimeMs < 1000) {
         return `${Math.round(maxTimeMs)}ms`;
      } else {
         return `${(maxTimeMs / 1000).toFixed(1)}s`;
      }
   }, [levelRequirements, currentLevel]);

   // Initialize mini-game based on variant
   const initializeMiniGame = useCallback((variant: number) => {
      // Clear all previous state
      setWaiting(true);
      setGreenShown(false);
      setReactionTime(0);
      setPenalties(0);
      setShowFeedback(false);
      setCurrentColor(null);
      setGreenCircleIndex(null);
      setTargetPosition({ x: 50, y: 50 });
      setCountdown(null);
      setTargetShape(null);
      setShapeOptions([]);
      setMovingObjects([]);
      setPatternSequence([]);
      setPatternIndex(0);
      setMultiTargets([]);
      setProgressBar(0);
      setMemorySequence([]);
      setMemoryIndex(0);
      setMemorySequenceVisible(true);
      setClickedSequence([]);
      setShuffledNumbers([]);
      objectIdCounterRef.current = 0;

      if (animationFrameRef.current) {
         cancelAnimationFrame(animationFrameRef.current);
         animationFrameRef.current = null;
      }

      // Initialize based on variant
      switch (variant) {
         case 0: // Color Flash Reaction
            // Randomly select which circle (0-3) will turn green
            const selectedCircle = Math.floor(Math.random() * 4);
            setGreenCircleIndex(selectedCircle);

            // Wait random time (1-3 seconds), then turn selected circle green
            const waitTime = Math.random() * 2000 + 1000;
            waitTimerRef.current = setTimeout(() => {
               if (gameStateRef.current === "playing") {
                  setCurrentColor("green");
                  greenStartTimeRef.current = Date.now();
                  setGreenShown(true);

                  // Green circle stays visible for at least 1 second
                  // After 1 second, if player hasn't clicked, circle remains visible
                  // Player has minimum 1 second to click
                  greenTimerRef.current = setTimeout(() => {
                     // Minimum 1 second has passed - circle can still be clicked
                     // No action needed, just ensures minimum visibility time
                  }, 1000);
               }
            }, waitTime);
            break;

         case 1: // Moving Target Reaction
            setTargetPosition({ x: 20, y: 50 });
            const moveInterval = setInterval(() => {
               if (gameStateRef.current !== "playing") {
                  clearInterval(moveInterval);
                  return;
               }
               setTargetPosition((prev) => {
                  const newX = prev.x + 2;
                  if (newX > 80) {
                     clearInterval(moveInterval);
                     const waitTime = Math.random() * 2000 + 1000;
                     setTimeout(() => {
                        setTargetPosition({ x: 20, y: 50 });
                        setGreenShown(true);
                        greenStartTimeRef.current = Date.now();
                     }, waitTime);
                     return { x: 20, y: 50 };
                  }
                  if (newX > 40 && !greenShown) {
                     setGreenShown(true);
                     greenStartTimeRef.current = Date.now();
                  }
                  return { x: newX, y: prev.y };
               });
            }, 50);
            break;

         case 2: // Countdown Reaction
            setCountdown(3);
            let count = 3;
            const countInterval = setInterval(() => {
               if (gameStateRef.current !== "playing") {
                  clearInterval(countInterval);
                  return;
               }
               count--;
               if (count > 0) {
                  setCountdown(count);
               } else if (count === 0) {
                  setCountdown("GO");
                  setGreenShown(true);
                  greenStartTimeRef.current = Date.now();
                  setTimeout(() => {
                     setCountdown(null);
                  }, 2000);
                  clearInterval(countInterval);
               }
            }, 1000);
            break;

         case 3: // Shape Match Reaction
            const shapes: ("circle" | "square" | "triangle")[] = [
               "circle",
               "square",
               "triangle",
            ];
            const target = shapes[Math.floor(Math.random() * shapes.length)];
            setTargetShape(target);

            // Create 6 shape options (one correct, 5 wrong)
            const shapeOptionsArray: Array<{
               id: number;
               shape: "circle" | "square" | "triangle";
               isCorrect: boolean;
            }> = [];
            // Add correct shape
            shapeOptionsArray.push({
               id: objectIdCounterRef.current++,
               shape: target,
               isCorrect: true,
            });
            // Add wrong shapes
            const wrongShapes = shapes.filter((s) => s !== target);
            for (let i = 0; i < 5; i++) {
               const wrongShape =
                  wrongShapes[Math.floor(Math.random() * wrongShapes.length)];
               shapeOptionsArray.push({
                  id: objectIdCounterRef.current++,
                  shape: wrongShape,
                  isCorrect: false,
               });
            }
            // Shuffle options
            const shuffledShapes = shapeOptionsArray.sort(
               () => Math.random() - 0.5
            );
            setShapeOptions(shuffledShapes);

            const shapeWait = Math.random() * 2000 + 1000;
            waitTimerRef.current = setTimeout(() => {
               setGreenShown(true);
               greenStartTimeRef.current = Date.now();
            }, shapeWait);
            break;

         case 4: // Speed Reaction
            const spawnSpeedObjects = () => {
               if (gameStateRef.current !== "playing") return;
               const id = objectIdCounterRef.current++;
               const isGreen = Math.random() < 0.3;
               const obj = {
                  id,
                  x: Math.random() * 80 + 10,
                  y: Math.random() * 80 + 10,
                  color: isGreen ? ("green" as const) : ("red" as const),
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 4,
               };
               setMovingObjects((prev) => [...prev, obj]);
               if (isGreen) {
                  greenStartTimeRef.current = Date.now();
                  setGreenShown(true);
               }
               setTimeout(() => {
                  setMovingObjects((prev) => prev.filter((o) => o.id !== id));
               }, 2000);
            };
            const speedWait = Math.random() * 2000 + 1000;
            waitTimerRef.current = setTimeout(() => {
               spawnSpeedObjects();
               const speedInterval = setInterval(() => {
                  if (gameStateRef.current !== "playing") {
                     clearInterval(speedInterval);
                     return;
                  }
                  spawnSpeedObjects();
               }, 800);
               gameTimerRef.current = setTimeout(
                  () => clearInterval(speedInterval),
                  10000
               );
            }, speedWait);
            break;

         case 5: // Pattern Reaction
            const pattern = ["red", "blue", "green"];
            setPatternSequence(pattern);
            setPatternIndex(0); // Start at 0 to show first circle (red)
            let patternIdx = 0;
            // Show first circle immediately
            const patternInterval = setInterval(() => {
               if (gameStateRef.current !== "playing") {
                  clearInterval(patternInterval);
                  return;
               }
               patternIdx++;
               setPatternIndex(patternIdx);
               // When we reach the last index (green), enable clicking
               if (patternIdx === pattern.length - 1) {
                  setGreenShown(true);
                  greenStartTimeRef.current = Date.now();
                  clearInterval(patternInterval);
               }
            }, 800);
            break;

         case 6: // Multi-Target Reaction
            const spawnMultiTargets = () => {
               const targets = [];
               // Ensure at least 1-2 green targets out of 5
               const greenCount = Math.floor(Math.random() * 2) + 1; // 1 or 2 green targets
               let greenAdded = 0;

               for (let i = 0; i < 5; i++) {
                  // Add green targets first, then fill with red
                  const isGreen = greenAdded < greenCount;
                  targets.push({
                     id: objectIdCounterRef.current++,
                     x: Math.random() * 70 + 15,
                     y: Math.random() * 70 + 15,
                     color: isGreen ? ("green" as const) : ("red" as const),
                  });
                  if (isGreen) greenAdded++;
               }

               // Shuffle targets to randomize positions
               const shuffled = targets.sort(() => Math.random() - 0.5);
               setMultiTargets(shuffled);

               // Always set greenShown since we guarantee at least 1 green target
               greenStartTimeRef.current = Date.now();
               setGreenShown(true);
            };
            const multiWait = Math.random() * 2000 + 1000;
            waitTimerRef.current = setTimeout(spawnMultiTargets, multiWait);
            break;

         case 7: // Timing Reaction
            setProgressBar(0);
            const progressInterval = setInterval(() => {
               if (gameStateRef.current !== "playing") {
                  clearInterval(progressInterval);
                  return;
               }
               setProgressBar((prev) => {
                  const newProgress = prev + 2;
                  if (newProgress >= 100) {
                     setGreenShown(true);
                     greenStartTimeRef.current = Date.now();
                     clearInterval(progressInterval);
                     return 100;
                  }
                  return newProgress;
               });
            }, 50);
            break;

         case 8: // Memory Reaction
            // Generate random sequence of 3-4 numbers
            const seqLength = Math.floor(Math.random() * 2) + 3; // 3 or 4 numbers
            const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
            const shuffled = [...numbers].sort(() => Math.random() - 0.5);
            const sequence = shuffled.slice(0, seqLength);
            setMemorySequence(sequence);
            setMemoryIndex(0);
            setMemorySequenceVisible(true);
            setClickedSequence([]);
            // Create shuffled version of sequence for display (random order)
            const shuffledForDisplay = [...sequence].sort(
               () => Math.random() - 0.5
            );
            setShuffledNumbers(shuffledForDisplay);

            // Show sequence for 3-4 seconds, then hide it
            const showTime = Math.random() * 1000 + 3000; // 3-4 seconds
            waitTimerRef.current = setTimeout(() => {
               setMemorySequenceVisible(false);
               // Wait a bit more, then show green
               const memWait = Math.random() * 1000 + 1000; // 1-2 seconds
               waitTimerRef.current = setTimeout(() => {
                  setGreenShown(true);
                  greenStartTimeRef.current = Date.now();
               }, memWait);
            }, showTime);
            break;

         case 9: // Master Reaction (combination)
            // Combination of random delay + short window
            const masterWait = Math.random() * 2000 + 1000;
            waitTimerRef.current = setTimeout(() => {
               setGreenShown(true);
               greenStartTimeRef.current = Date.now();
               const shortWindow = 800;
               greenTimerRef.current = setTimeout(() => {
                  if (
                     gameStateRef.current === "playing" &&
                     !requirementsMetRef.current
                  ) {
                     setGameState("failed");
                     gameStateRef.current = "failed";
                  }
               }, shortWindow);
            }, masterWait);
            break;
      }
   }, []);

   // Start level
   const startLevel = useCallback(
      (levelIndex?: number) => {
         const targetLevel = levelIndex ?? currentLevelRef.current;
         currentLevelRef.current = targetLevel;

         // Clear all timers
         if (waitTimerRef.current) {
            clearTimeout(waitTimerRef.current);
            waitTimerRef.current = null;
         }
         if (greenTimerRef.current) {
            clearTimeout(greenTimerRef.current);
            greenTimerRef.current = null;
         }
         if (feedbackTimerRef.current) {
            clearTimeout(feedbackTimerRef.current);
            feedbackTimerRef.current = null;
         }
         if (gameTimerRef.current) {
            clearTimeout(gameTimerRef.current);
            gameTimerRef.current = null;
         }

         // Reset state
         setGameState("playing");
         gameStateRef.current = "playing";
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         setReactionTime(0);
         setPenalties(0);
         setShowFeedback(false);
         startTimeRef.current = 0;
         greenStartTimeRef.current = 0;

         // Initialize the specific mini-game
         initializeMiniGame(targetLevel);
      },
      [initializeMiniGame]
   );

   // Store startLevel in ref
   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Initialize game
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
      if (startLevelRef.current) {
         startLevelRef.current(0);
      }
   }, [isPlaying]);

   // Handle click - different logic for each mini-game
   const handleClick = useCallback(
      (e?: React.MouseEvent, targetId?: number) => {
         if (gameStateRef.current !== "playing") return;

         const variant = getVariant();
         const now = Date.now();

         // Variant-specific click handling
         switch (variant) {
            case 0: // Color Flash - click when green appears
               if (!greenShown || currentColor !== "green") {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               // Green circle stays visible for at least 1 second
               // Player can click anytime after green appears
               break;

            case 1: // Moving Target - click the green target
               if (!greenShown) {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 2: // Countdown - click when GO appears
               if (!greenShown || countdown !== "GO") {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 3: // Shape Match - click the shape that matches target
               if (!greenShown) {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               // Check if clicked shape matches target
               if (targetId !== undefined) {
                  const clickedShape = shapeOptions.find(
                     (s) => s.id === targetId
                  );
                  if (!clickedShape || !clickedShape.isCorrect) {
                     setPenalties((prev) => prev + 1);
                     return;
                  }
               } else {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 4: // Speed Reaction - click green moving object
               if (targetId !== undefined) {
                  const obj = movingObjects.find((o) => o.id === targetId);
                  if (!obj || obj.color !== "green") {
                     setPenalties((prev) => prev + 1);
                     return;
                  }
               } else {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 5: // Pattern Reaction - click when green in pattern
               // Only allow click when green is shown AND patternIndex is at the last index (green)
               if (!greenShown || patternIndex !== patternSequence.length - 1) {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 6: // Multi-Target - click only green targets
               if (targetId !== undefined) {
                  const target = multiTargets.find((t) => t.id === targetId);
                  if (!target || target.color !== "green") {
                     setPenalties((prev) => prev + 1);
                     return;
                  }
               } else {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 7: // Timing Reaction - click when progress bar reaches green zone
               if (!greenShown || progressBar < 90) {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 8: // Memory Reaction - click numbers in correct sequence
               if (!greenShown) {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               // Check if clicked number is correct
               if (targetId !== undefined) {
                  const expectedNumber = memorySequence[clickedSequence.length];
                  if (targetId !== expectedNumber) {
                     // Wrong number clicked
                     setPenalties((prev) => prev + 1);
                     setClickedSequence([]); // Reset sequence
                     return;
                  }
                  // Correct number clicked
                  const newClicked = [...clickedSequence, targetId];
                  setClickedSequence(newClicked);

                  // Check if sequence is complete
                  if (newClicked.length === memorySequence.length) {
                     // All numbers clicked in correct order - proceed to calculate score
                     // Don't return, let it continue to calculate reaction time
                  } else {
                     // Sequence not complete yet, wait for next click
                     return;
                  }
               } else {
                  // Clicked outside numbers
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;

            case 9: // Master Reaction - standard click
               if (!greenShown) {
                  setPenalties((prev) => prev + 1);
                  return;
               }
               break;
         }

         // Calculate reaction time
         const reaction = now - greenStartTimeRef.current;
         setReactionTime(reaction);

         // Check level requirements - only maxTime is required
         const levelReq = levelRequirements[currentLevel] || {};

         // Check if maxTime is specified in config (in ms or seconds)
         // Supports: maxTime: 700, maxTime: "700ms", maxTime: "1.2s", maxTime: "1.2sec"
         let maxTimeMs: number | null = null;
         if (levelReq.maxTime !== undefined) {
            if (typeof levelReq.maxTime === "number") {
               maxTimeMs = levelReq.maxTime; // Assume milliseconds
            } else if (typeof levelReq.maxTime === "string") {
               const timeStr = levelReq.maxTime.toLowerCase().trim();
               if (timeStr.endsWith("ms")) {
                  maxTimeMs = parseFloat(timeStr.replace("ms", ""));
               } else if (timeStr.endsWith("s") || timeStr.endsWith("sec")) {
                  maxTimeMs = parseFloat(timeStr.replace(/s(ec)?$/, "")) * 1000;
               } else {
                  maxTimeMs = parseFloat(timeStr); // Assume milliseconds
               }
            }
         }

         // maxTime is required - if not specified, fail the level
         if (maxTimeMs === null) {
            setGameState("failed");
            gameStateRef.current = "failed";
            return;
         }

         // Calculate score based on reaction time
         // Score = 100 if reaction <= maxTime, decreases linearly after
         let score: number;
         if (reaction <= maxTimeMs) {
            score = 100;
         } else {
            // After maxTime, score decreases: 100 - ((reaction - maxTime) / divisor)
            const divisor = variant === 8 ? 60 : 20;
            score = Math.max(0, 100 - (reaction - maxTimeMs) / divisor);
         }

         // Level passes if reaction time is within maxTime (score = 100)
         if (reaction <= maxTimeMs) {
            const roundScore = Math.round(100 / maxLevels);
            const completedLevels = currentLevel + 1;
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            onScoreUpdate(newScore);
            setRequirementsMet(true);
            requirementsMetRef.current = true;
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
            }
         } else {
            setGameState("failed");
            gameStateRef.current = "failed";
         }
      },
      [
         getVariant,
         greenShown,
         currentColor,
         countdown,
         movingObjects,
         multiTargets,
         progressBar,
         patternSequence,
         patternIndex,
         memorySequence,
         clickedSequence,
         levelRequirements,
         currentLevel,
         maxLevels,
         onScoreUpdate,
         onComplete,
      ]
   );

   // Finalize game
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
         setCurrentLevel((prev) => prev + 1);
         currentLevelRef.current = currentLevel + 1;
         setRequirementsMet(false);
         setAttemptCount(0); // Reset for Best of 3
         startLevel(currentLevel + 1);
      }
   }, [currentLevel, maxLevels, onScoreUpdate, finalizeGame, startLevel]);

   // Handle repeat round
   const handleRepeatRound = useCallback(() => {
      setAttemptCount(0); // Reset for Best of 3
      startLevel(currentLevelRef.current);
   }, [startLevel]);

   // Replay mini-game - with limit of 1 use (unlimited if shared)
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return; // No replays left

      // Reset state and restart the mini-game
      setPenalties(0);
      setAttemptCount(0);
      setAttempts([]);
      setShowFeedback(false);
      setReactionTime(0);
      setRequirementsMet(false);
      requirementsMetRef.current = false;

      // Restart the level
      startLevel(currentLevelRef.current);
      setReplaysUsed((prev) => prev + 1);
   }, [gameState, maxReplays, replaysUsed, startLevel]);

   // Share functionality
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "reaction-test");
         const gameKey = "play50games_shared_reaction-test";
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
               title: "Reaction Test Game",
               text: "Check out this awesome Reaction Test game!",
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
         const gameKey = "play50games_shared_reaction-test";
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
      const gameKey = "play50games_shared_reaction-test";
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
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           // Set timeout to expire after remaining time
                           const remainingTime = data.expiry - Date.now();
                           if (remainingTime > 0) {
                              setTimeout(() => {
                                 setUnlimitedActivated(false);
                                 setHasShared(false);
                                 localStorage.removeItem(gameKey);
                              }, remainingTime);
                           }
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
            // Invalid data, clean up
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
         if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
         if (greenTimerRef.current) clearTimeout(greenTimerRef.current);
         if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, []);

   const variant = getVariant();
   const variantNames = [
      "Color Flash Reaction",
      "Moving Target Reaction",
      "Countdown Reaction",
      "Shape Match Reaction",
      "Speed Reaction",
      "Pattern Reaction",
      "Multi-Target Reaction",
      "Timing Reaction",
      "Memory Reaction",
      "Master Reaction",
   ];

   const variantDescriptions = [
      "Watch for the green flash among colored circles. Click when green appears!",
      "A target moves across the screen. Click it when it turns green!",
      "Watch the countdown (3...2...1...GO!). Click exactly when it reaches GO!",
      "Match the green shape with the target shape shown. Click when they match!",
      "Fast-moving objects appear. Click the green one before it disappears!",
      "Follow the pattern (red→blue→green). Click when the green signal appears!",
      "Multiple targets appear. Click only the green ones, avoid the red ones!",
      "A progress bar fills up. Click exactly when it reaches the green zone!",
      "Remember the sequence, then click in the correct order when green appears!",
      "Ultimate challenge combining all mechanics. Can you master them all?",
   ];

   const progress = ((currentLevel + 1) / maxLevels) * 100;

   // Styling functions (same as other games)
   // Theme colors: --ok: #86efac, --warn: #fca5a5
   const getActionButtonStyle = (tone: "success" | "danger") => {
      // Using theme colors with rgba for opacity
      // --ok: #86efac (rgb: 134, 239, 172)
      // --warn: #fca5a5 (rgb: 252, 165, 165)
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
      // --ok: #86efac (rgb: 134, 239, 172)
      // --warn: #fca5a5 (rgb: 252, 165, 165)
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
      // --ok: #86efac (rgb: 134, 239, 172)
      // --warn: #fca5a5 (rgb: 252, 165, 165)
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
      <React.Fragment>
         <style>{`
            @keyframes pulse {
               0%, 100% {
                  opacity: 1;
                  transform: scale(1);
               }
               50% {
                  opacity: 0.7;
                  transform: scale(1.05);
               }
            }
            @keyframes glow {
               0%, 100% {
                  box-shadow: 0 0 20px rgba(134, 239, 172, 0.5);
               }
               50% {
                  box-shadow: 0 0 40px rgba(134, 239, 172, 0.8);
               }
            }
            @keyframes shake {
               0%, 100% { transform: translateX(0); }
               25% { transform: translateX(-5px); }
               75% { transform: translateX(5px); }
            }
         `}</style>
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               gap: isMobile ? "16px" : "20px",
               padding: isMobile ? "16px" : "24px",
               maxWidth: "900px",
               margin: "0 auto",
            }}
         >
            {/* Header */}
            <div
               style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: isMobile ? "12px" : "16px",
                  padding: isMobile ? "14px" : "18px",
                  background: "var(--card)",
                  border: "1px solid var(--stroke)",
                  borderRadius: "16px",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     justifyContent: "space-between",
                     alignItems: "center",
                     flexWrap: "wrap",
                     gap: isMobile ? "8px" : "12px",
                  }}
               >
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: isMobile ? "12px" : "16px",
                        flexWrap: "wrap",
                     }}
                  >
                     <span
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "6px",
                           fontSize: isMobile ? "0.9rem" : "1rem",
                           fontWeight: 600,
                           color: "var(--text)",
                        }}
                     >
                        <ArrowPathIcon
                           style={{
                              width: isMobile ? 14 : 16,
                              height: isMobile ? 14 : 16,
                           }}
                        />
                        Level {currentLevel + 1} / {maxLevels}
                     </span>
                     {getMaxTimeDisplay() && (
                        <span
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: isMobile ? "0.85rem" : "0.9rem",
                              fontWeight: 600,
                              color: "var(--accent)",
                              padding: "4px 10px",
                              background: "rgba(125, 211, 252, 0.15)",
                              border: "1px solid rgba(125, 211, 252, 0.3)",
                              borderRadius: "6px",
                           }}
                        >
                           <ClockIcon
                              style={{
                                 width: isMobile ? 12 : 14,
                                 height: isMobile ? 12 : 14,
                              }}
                           />
                           Max: {getMaxTimeDisplay()}
                        </span>
                     )}
                  </div>
                  <span
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                     }}
                  >
                     <TrophyIcon
                        style={{
                           width: isMobile ? 14 : 16,
                           height: isMobile ? 14 : 16,
                           color: "var(--ok)",
                        }}
                     />
                     {currentLevel + 1 >= maxLevels && gameState === "ready"
                        ? 100
                        : currentScore}{" "}
                     / 100
                  </span>
               </div>
               <div
                  style={{
                     width: "100%",
                     height: "8px",
                     background: "var(--stroke)",
                     borderRadius: "4px",
                     overflow: "hidden",
                  }}
               >
                  <div
                     style={{
                        width: `${progress}%`,
                        height: "100%",
                        background:
                           "linear-gradient(90deg, var(--accent), var(--ok))",
                        transition: "width 0.3s ease",
                     }}
                  />
               </div>
            </div>

            {/* Variant Name and Description */}
            <div
               style={{
                  textAlign: "center",
                  padding: isMobile ? "12px" : "16px",
                  background: "var(--card)",
                  border: "1px solid var(--stroke)",
                  borderRadius: "12px",
               }}
            >
               <div
                  style={{
                     fontSize: isMobile ? "1rem" : "1.1rem",
                     fontWeight: 600,
                     color: "var(--text)",
                     marginBottom: isMobile ? "6px" : "8px",
                  }}
               >
                  {variantNames[variant]}
               </div>
               <div
                  style={{
                     fontSize: isMobile ? "0.85rem" : "0.9rem",
                     color: "var(--muted)",
                     lineHeight: "1.4",
                     fontStyle: "italic",
                  }}
               >
                  {variantDescriptions[variant]}
               </div>
            </div>

            {/* Game Area - Different UI for each mini-game */}
            <div
               style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16/9",
                  minHeight: isMobile ? "250px" : "400px",
                  background: "var(--stroke)",
                  border: "2px solid var(--stroke)",
                  borderRadius: "16px",
                  overflow: "hidden",
               }}
            >
               {/* Variant 0: Color Flash Reaction */}
               {variant === 0 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "20px",
                        flexWrap: "wrap",
                        cursor: "pointer",
                     }}
                     onClick={() => handleClick()}
                  >
                     {[0, 1, 2, 3].map((index) => {
                        const isGreen =
                           greenShown &&
                           currentColor === "green" &&
                           greenCircleIndex === index;
                        return (
                           <div
                              key={index}
                              style={{
                                 width: isMobile ? "60px" : "80px",
                                 height: isMobile ? "60px" : "80px",
                                 borderRadius: "50%",
                                 background: isGreen
                                    ? "var(--ok)"
                                    : "rgba(255, 255, 255, 0.1)",
                                 border: isGreen
                                    ? "3px solid rgba(134, 239, 172, 0.8)"
                                    : "2px solid var(--stroke)",
                                 transition: "all 0.3s ease",
                                 boxShadow: isGreen
                                    ? "0 0 20px rgba(134, 239, 172, 0.6)"
                                    : "none",
                                 animation: isGreen
                                    ? "pulse 1s infinite"
                                    : "none",
                              }}
                           />
                        );
                     })}
                  </div>
               )}

               {/* Variant 1: Moving Target Reaction */}
               {variant === 1 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        position: "relative",
                        cursor: "pointer",
                     }}
                     onClick={() => handleClick()}
                  >
                     <div
                        style={{
                           position: "absolute",
                           left: `${targetPosition.x}%`,
                           top: `${targetPosition.y}%`,
                           transform: "translate(-50%, -50%)",
                           width: isMobile ? "60px" : "80px",
                           height: isMobile ? "60px" : "80px",
                           borderRadius: "50%",
                           background: greenShown
                              ? "var(--ok)"
                              : "var(--stroke)",
                           border: greenShown
                              ? "3px solid rgba(134, 239, 172, 0.8)"
                              : "2px solid var(--stroke)",
                           transition: "all 0.1s linear",
                           boxShadow: greenShown
                              ? "0 0 20px rgba(134, 239, 172, 0.6)"
                              : "none",
                           animation: greenShown ? "pulse 1s infinite" : "none",
                        }}
                     />
                  </div>
               )}

               {/* Variant 2: Countdown Reaction */}
               {variant === 2 && gameState === "playing" && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                     }}
                     onClick={() => handleClick()}
                  >
                     <div
                        style={{
                           fontSize: isMobile ? "4rem" : "6rem",
                           fontWeight: 900,
                           color:
                              countdown === "GO"
                                 ? "var(--ok)"
                                 : countdown !== null
                                 ? "var(--accent)"
                                 : "var(--text)",
                           textShadow:
                              countdown === "GO"
                                 ? "0 0 30px rgba(134, 239, 172, 0.8)"
                                 : "none",
                           transition: "all 0.3s ease",
                           transform:
                              countdown === "GO" ? "scale(1.2)" : "scale(1)",
                        }}
                     >
                        {countdown === null
                           ? "WAIT..."
                           : countdown === "GO"
                           ? "GO!"
                           : countdown}
                     </div>
                  </div>
               )}

               {/* Variant 3: Shape Match Reaction */}
               {variant === 3 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: isMobile ? "20px" : "30px",
                        position: "relative",
                     }}
                  >
                     {/* Target Shape in Center */}
                     <div
                        style={{
                           display: "flex",
                           flexDirection: "column",
                           alignItems: "center",
                           gap: "12px",
                        }}
                     >
                        <div
                           style={{
                              fontSize: isMobile ? "0.85rem" : "0.95rem",
                              color: "var(--muted)",
                              fontWeight: 600,
                           }}
                        >
                           Match this shape:
                        </div>
                        <div
                           style={{
                              width: isMobile ? "70px" : "90px",
                              height: isMobile ? "70px" : "90px",
                              borderRadius:
                                 targetShape === "circle"
                                    ? "50%"
                                    : targetShape === "triangle"
                                    ? "0"
                                    : "12px",
                              clipPath:
                                 targetShape === "triangle"
                                    ? "polygon(50% 0%, 0% 100%, 100% 100%)"
                                    : "none",
                              background: "var(--accent)",
                              border: "3px solid var(--accent)",
                              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                           }}
                        />
                     </div>

                     {/* Shape Options Grid */}
                     {greenShown && shapeOptions.length > 0 && (
                        <div
                           style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(3, 1fr)",
                              gap: isMobile ? "12px" : "16px",
                              width: "100%",
                              maxWidth: isMobile ? "280px" : "360px",
                              padding: isMobile ? "12px" : "16px",
                           }}
                        >
                           {shapeOptions.map((option) => {
                              const isCorrect = option.isCorrect;
                              return (
                                 <div
                                    key={option.id}
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       handleClick(e, option.id);
                                    }}
                                    style={{
                                       width: isMobile ? "70px" : "90px",
                                       height: isMobile ? "70px" : "90px",
                                       borderRadius:
                                          option.shape === "circle"
                                             ? "50%"
                                             : option.shape === "triangle"
                                             ? "0"
                                             : "12px",
                                       clipPath:
                                          option.shape === "triangle"
                                             ? "polygon(50% 0%, 0% 100%, 100% 100%)"
                                             : "none",
                                       background: isCorrect
                                          ? "var(--ok)"
                                          : "var(--warn)",
                                       border: `3px solid ${
                                          isCorrect
                                             ? "rgba(134, 239, 172, 0.8)"
                                             : "rgba(252, 165, 165, 0.8)"
                                       }`,
                                       cursor: "pointer",
                                       boxShadow: isCorrect
                                          ? "0 0 20px rgba(134, 239, 172, 0.6)"
                                          : "0 0 15px rgba(252, 165, 165, 0.4)",
                                       animation: isCorrect
                                          ? "pulse 1s infinite"
                                          : "none",
                                       transition: "all 0.3s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                       e.currentTarget.style.transform =
                                          "scale(1.1)";
                                    }}
                                    onMouseLeave={(e) => {
                                       e.currentTarget.style.transform =
                                          "scale(1)";
                                    }}
                                 />
                              );
                           })}
                        </div>
                     )}
                  </div>
               )}

               {/* Variant 4: Speed Reaction */}
               {variant === 4 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        position: "relative",
                     }}
                  >
                     {movingObjects.map((obj) => (
                        <div
                           key={obj.id}
                           onClick={(e) => {
                              e.stopPropagation();
                              handleClick(e, obj.id);
                           }}
                           style={{
                              position: "absolute",
                              left: `${obj.x}%`,
                              top: `${obj.y}%`,
                              transform: "translate(-50%, -50%)",
                              width: isMobile ? "40px" : "50px",
                              height: isMobile ? "40px" : "50px",
                              borderRadius: "50%",
                              background:
                                 obj.color === "green"
                                    ? "var(--ok)"
                                    : "var(--warn)",
                              border: `3px solid ${
                                 obj.color === "green"
                                    ? "rgba(134, 239, 172, 0.8)"
                                    : "rgba(252, 165, 165, 0.8)"
                              }`,
                              cursor: "pointer",
                              boxShadow:
                                 obj.color === "green"
                                    ? "0 0 15px rgba(134, 239, 172, 0.6)"
                                    : "0 0 15px rgba(252, 165, 165, 0.6)",
                              animation: "pulse 1s infinite",
                           }}
                        />
                     ))}
                  </div>
               )}

               {/* Variant 5: Pattern Reaction */}
               {variant === 5 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "20px",
                        cursor: "pointer",
                     }}
                     onClick={() => handleClick()}
                  >
                     {patternSequence.map((color, idx) => (
                        <div
                           key={idx}
                           style={{
                              width: isMobile ? "60px" : "80px",
                              height: isMobile ? "60px" : "80px",
                              borderRadius: "50%",
                              background:
                                 idx <= patternIndex
                                    ? color === "green"
                                       ? "var(--ok)"
                                       : color === "red"
                                       ? "var(--warn)"
                                       : "var(--accent)"
                                    : "rgba(255, 255, 255, 0.1)",
                              border:
                                 idx <= patternIndex
                                    ? `3px solid ${
                                         color === "green"
                                            ? "rgba(134, 239, 172, 0.8)"
                                            : color === "red"
                                            ? "rgba(252, 165, 165, 0.8)"
                                            : "rgba(125, 211, 252, 0.8)"
                                      }`
                                    : "2px solid var(--stroke)",
                              transition: "all 0.3s ease",
                              boxShadow:
                                 idx === patternIndex && color === "green"
                                    ? "0 0 20px rgba(134, 239, 172, 0.6)"
                                    : "none",
                              animation:
                                 idx === patternIndex && color === "green"
                                    ? "pulse 1s infinite"
                                    : "none",
                           }}
                        />
                     ))}
                  </div>
               )}

               {/* Variant 6: Multi-Target Reaction */}
               {variant === 6 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        position: "relative",
                     }}
                  >
                     {multiTargets.map((target) => (
                        <div
                           key={target.id}
                           onClick={(e) => {
                              e.stopPropagation();
                              handleClick(e, target.id);
                           }}
                           style={{
                              position: "absolute",
                              left: `${target.x}%`,
                              top: `${target.y}%`,
                              transform: "translate(-50%, -50%)",
                              width: isMobile ? "50px" : "60px",
                              height: isMobile ? "50px" : "60px",
                              borderRadius: "50%",
                              background:
                                 target.color === "green"
                                    ? "var(--ok)"
                                    : "var(--warn)",
                              border: `3px solid ${
                                 target.color === "green"
                                    ? "rgba(134, 239, 172, 0.8)"
                                    : "rgba(252, 165, 165, 0.8)"
                              }`,
                              cursor: "pointer",
                              boxShadow:
                                 target.color === "green"
                                    ? "0 0 15px rgba(134, 239, 172, 0.6)"
                                    : "0 0 15px rgba(252, 165, 165, 0.6)",
                              animation: "pulse 1s infinite",
                           }}
                        />
                     ))}
                  </div>
               )}

               {/* Variant 7: Timing Reaction */}
               {variant === 7 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "30px",
                        cursor: "pointer",
                        padding: "40px",
                     }}
                     onClick={() => handleClick()}
                  >
                     <div
                        style={{
                           width: "100%",
                           height: "20px",
                           background: "rgba(255, 255, 255, 0.1)",
                           borderRadius: "999px",
                           overflow: "hidden",
                           position: "relative",
                        }}
                     >
                        <div
                           style={{
                              width: `${progressBar}%`,
                              height: "100%",
                              background:
                                 progressBar >= 90
                                    ? "linear-gradient(90deg, var(--ok), rgba(134, 239, 172, 0.8))"
                                    : "linear-gradient(90deg, var(--accent), rgba(125, 211, 252, 0.8))",
                              borderRadius: "999px",
                              transition:
                                 "width 0.05s linear, background 0.3s ease",
                              boxShadow:
                                 progressBar >= 90
                                    ? "0 0 15px rgba(134, 239, 172, 0.6)"
                                    : "none",
                           }}
                        />
                     </div>
                     {greenShown && (
                        <div
                           style={{
                              fontSize: isMobile ? "2rem" : "3rem",
                              fontWeight: 700,
                              color: "var(--ok)",
                              textShadow: "0 0 20px rgba(134, 239, 172, 0.8)",
                           }}
                        >
                           CLICK NOW!
                        </div>
                     )}
                  </div>
               )}

               {/* Variant 8: Memory Reaction */}
               {variant === 8 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "20px",
                     }}
                  >
                     {memorySequenceVisible && !greenShown && (
                        <div
                           style={{
                              fontSize: isMobile ? "2rem" : "3rem",
                              fontWeight: 700,
                              color: "var(--accent)",
                              textAlign: "center",
                           }}
                        >
                           {memorySequence.join(" → ")}
                        </div>
                     )}

                     {!memorySequenceVisible && !greenShown && (
                        <div
                           style={{
                              fontSize: isMobile ? "1.2rem" : "1.5rem",
                              color: "var(--muted)",
                              fontWeight: 600,
                           }}
                        >
                           Remember the sequence...
                        </div>
                     )}

                     {greenShown && (
                        <div
                           style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "20px",
                              width: "100%",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: isMobile ? "1rem" : "1.2rem",
                                 color: "var(--ok)",
                                 fontWeight: 600,
                                 marginBottom: "10px",
                              }}
                           >
                              Click numbers in order:{" "}
                              {memorySequence.join(" → ")}
                           </div>
                           <div
                              style={{
                                 display: "flex",
                                 flexWrap: "wrap",
                                 gap: "12px",
                                 justifyContent: "center",
                                 maxWidth: "400px",
                              }}
                           >
                              {shuffledNumbers.map((num) => {
                                 const isClicked =
                                    clickedSequence.includes(num);
                                 const isNext =
                                    clickedSequence.length <
                                       memorySequence.length &&
                                    memorySequence[clickedSequence.length] ===
                                       num;
                                 return (
                                    <button
                                       key={num}
                                       onClick={(e) => {
                                          e.stopPropagation();
                                          handleClick(e, num);
                                       }}
                                       disabled={isClicked}
                                       style={{
                                          width: isMobile ? "50px" : "60px",
                                          height: isMobile ? "50px" : "60px",
                                          fontSize: isMobile
                                             ? "1.2rem"
                                             : "1.5rem",
                                          fontWeight: 700,
                                          borderRadius: "12px",
                                          border: isNext
                                             ? "3px solid var(--ok)"
                                             : isClicked
                                             ? "2px solid var(--ok)"
                                             : "2px solid var(--stroke)",
                                          background: isClicked
                                             ? "var(--ok)"
                                             : isNext
                                             ? "rgba(134, 239, 172, 0.2)"
                                             : "var(--card)",
                                          color: isClicked
                                             ? "white"
                                             : "var(--text)",
                                          cursor: isClicked
                                             ? "not-allowed"
                                             : "pointer",
                                          opacity: isClicked ? 0.6 : 1,
                                          transition: "all 0.2s ease",
                                       }}
                                    >
                                       {num}
                                    </button>
                                 );
                              })}
                           </div>
                        </div>
                     )}
                  </div>
               )}

               {/* Variant 9: Master Reaction */}
               {variant === 9 && (
                  <div
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        background: greenShown ? "var(--ok)" : "var(--stroke)",
                        transition: "background 0.3s ease",
                        animation: greenShown
                           ? "glow 1.5s ease-in-out infinite"
                           : "none",
                        boxShadow: greenShown
                           ? "0 0 30px rgba(134, 239, 172, 0.4), inset 0 0 50px rgba(134, 239, 172, 0.2)"
                           : "none",
                     }}
                     onClick={() => handleClick()}
                  >
                     <div
                        style={{
                           fontSize: isMobile ? "1.5rem" : "2.5rem",
                           fontWeight: 700,
                           color: greenShown ? "white" : "var(--text)",
                           textAlign: "center",
                           transition: "all 0.3s ease",
                           transform: greenShown ? "scale(1.1)" : "scale(1)",
                           textShadow: greenShown
                              ? "0 0 20px rgba(255, 255, 255, 0.5)"
                              : "none",
                        }}
                     >
                        {greenShown ? "CLICK NOW!" : "WAIT..."}
                     </div>
                  </div>
               )}

               {/* Penalty indicator */}
               {penalties > 0 && (
                  <div
                     style={{
                        position: "absolute",
                        top: "20px",
                        right: "20px",
                        padding: "6px 12px",
                        background: "rgba(252, 165, 165, 0.2)",
                        border: "2px solid rgba(252, 165, 165, 0.6)",
                        borderRadius: "999px",
                        fontSize: isMobile ? "0.8rem" : "0.9rem",
                        fontWeight: 700,
                        color: "var(--warn)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                     }}
                  >
                     ⚠️ {penalties}
                  </div>
               )}

               {/* Reaction time display */}
               {reactionTime > 0 && !showFeedback && (
                  <div
                     style={{
                        position: "absolute",
                        bottom: "20px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: isMobile ? "1.2rem" : "1.5rem",
                        fontWeight: 700,
                        color: "white",
                        background: "rgba(0, 0, 0, 0.6)",
                        padding: "12px 24px",
                        borderRadius: "12px",
                        border: "2px solid rgba(255, 255, 255, 0.3)",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                     }}
                  >
                     {reactionTime}ms
                  </div>
               )}
            </div>

            {/* Stats */}
            {(penalties > 0 || attempts.length > 0) && (
               <div
                  style={{
                     display: "flex",
                     gap: "16px",
                     justifyContent: "center",
                     flexWrap: "wrap",
                  }}
               >
                  {penalties > 0 && (
                     <div
                        style={{
                           padding: "8px 16px",
                           background: "var(--card)",
                           border: "1px solid var(--stroke)",
                           borderRadius: "8px",
                           fontSize: isMobile ? "0.9rem" : "1rem",
                           fontWeight: 600,
                           color: "var(--warn)",
                        }}
                     >
                        Penalties: {penalties}
                     </div>
                  )}
                  {variant === 4 && attempts.length > 0 && (
                     <div
                        style={{
                           padding: "8px 16px",
                           background: "var(--card)",
                           border: "1px solid var(--stroke)",
                           borderRadius: "8px",
                           fontSize: isMobile ? "0.9rem" : "1rem",
                           fontWeight: 600,
                           color: "var(--text)",
                        }}
                     >
                        Attempts: {attempts.length} / 3
                     </div>
                  )}
               </div>
            )}

            {/* Feedback */}
            {showFeedback && (
               <div
                  style={{
                     padding: "16px 24px",
                     borderRadius: "12px",
                     fontSize: "1.1rem",
                     fontWeight: 600,
                     background: "rgba(134, 239, 172, 0.2)",
                     border: "1px solid var(--ok)",
                     color: "var(--ok)",
                     textAlign: "center",
                  }}
               >
                  Reaction: {reactionTime}ms
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
                           {isMobile
                              ? "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!"
                              : "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!"}
                        </span>
                     </div>
                  )}

                  {/* Replay Button */}
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
                           e.currentTarget.style.transform = "translateY(-2px)";
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

                  {/* Share Button */}
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
                           color: "rgba(59, 130, 246, 0.9)",
                        }}
                     />
                     <span>
                        {isMobile ? "Share" : "Share for Unlimited Replay"}
                     </span>
                  </button>
               </div>
            )}

            {/* Level Complete Message */}
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
                     onMouseEnter={(e) => applyActionHover(e, "success", true)}
                     onMouseLeave={(e) => applyActionHover(e, "success", false)}
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
                     Final Score: 100
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
                        fontSize: isMobile ? "1.05rem" : "1.1rem",
                        fontWeight: 600,
                        marginTop: "16px",
                        color: "var(--text)",
                     }}
                  >
                     Score too low.
                  </div>
               </div>
            )}
         </div>
      </React.Fragment>
   );
}

// Fast Math Game (29) - Now imported from speedgames-parts/FastMath.tsx
// The implementation has been moved to a separate file for better organization

// Whack-a-Shape Game (30)
function WhackShape({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}) {
   const rounds = config.rounds || 20;
   const [targetShape, setTargetShape] = useState<string>("");
   const [shapes, setShapes] = useState<
      Array<{ id: number; type: string; x: number; y: number }>
   >([]);
   const [round, setRound] = useState(0);
   const [score, setScore] = useState(0);

   useEffect(() => {
      if (round >= rounds) {
         const finalScore = Math.round((score / rounds) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }

      const shapeTypes = ["circle", "square", "triangle"];
      const target = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
      setTargetShape(target);

      const newShapes = Array.from({ length: 9 }, (_, i) => ({
         id: i,
         type: shapeTypes[Math.floor(Math.random() * shapeTypes.length)],
         x: (i % 3) * 33,
         y: Math.floor(i / 3) * 33,
      }));
      setShapes(newShapes);
   }, [round, rounds, score, onScoreUpdate, onComplete]);

   const handleShapeClick = (id: number) => {
      const shape = shapes.find((s) => s.id === id);
      if (shape?.type === targetShape) {
         setScore(score + 5);
         setRound(round + 1);
      } else {
         setScore(Math.max(0, score - 2));
      }
   };

   return (
      <div className="whack-shape-game">
         <h3>
            Whack-a-Shape - Round {round + 1}/{rounds}
         </h3>
         <p>Click the {targetShape}!</p>
         <div className="whack-grid">
            {shapes.map((shape) => (
               <button
                  key={shape.id}
                  onClick={() => handleShapeClick(shape.id)}
                  className={`whack-item ${shape.type}`}
               >
                  <div className={`shape ${shape.type}`}></div>
               </button>
            ))}
         </div>
      </div>
   );
}

// Typing Sprint Game (31)
function TypingSprint({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}) {
   const words = config.words || 10;
   const [currentWord, setCurrentWord] = useState("");
   const [input, setInput] = useState("");
   const [wordIndex, setWordIndex] = useState(0);
   const [score, setScore] = useState(0);
   const wordList = [
      "apple",
      "banana",
      "cherry",
      "date",
      "elderberry",
      "fig",
      "grape",
      "honeydew",
      "kiwi",
      "lemon",
   ];

   useEffect(() => {
      if (wordIndex >= words) {
         const finalScore = Math.round((score / words) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }
      setCurrentWord(wordList[wordIndex % wordList.length]);
      setInput("");
   }, [wordIndex, words, score, onScoreUpdate, onComplete]);

   useEffect(() => {
      if (input === currentWord && currentWord) {
         setScore(score + 10);
         setWordIndex(wordIndex + 1);
      }
   }, [input, currentWord, wordIndex, score]);

   return (
      <div className="typing-sprint-game">
         <h3>
            Typing Sprint - Word {wordIndex + 1}/{words}
         </h3>
         <div className="word-display">{currentWord}</div>
         <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="typing-input"
            autoFocus
         />
         <p>Type the word as fast as you can!</p>
      </div>
   );
}

// Quick Compare Game (32)
function QuickCompare({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}) {
   const rounds = config.rounds || 15;
   const [numbers, setNumbers] = useState<{ a: number; b: number } | null>(
      null
   );
   const [round, setRound] = useState(0);
   const [score, setScore] = useState(0);

   useEffect(() => {
      if (round >= rounds) {
         const finalScore = Math.round((score / rounds) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }

      setNumbers({
         a: Math.floor(Math.random() * 100),
         b: Math.floor(Math.random() * 100),
      });
   }, [round, rounds, score, onScoreUpdate, onComplete]);

   const handleSelect = (choice: "greater" | "less" | "equal") => {
      if (!numbers) return;

      let isCorrect = false;
      if (choice === "greater") isCorrect = numbers.a > numbers.b;
      else if (choice === "less") isCorrect = numbers.a < numbers.b;
      else isCorrect = numbers.a === numbers.b;

      if (isCorrect) {
         setScore(score + 6);
      }
      setRound(round + 1);
   };

   return (
      <div className="quick-compare-game">
         <h3>
            Quick Compare - Round {round + 1}/{rounds}
         </h3>
         {numbers && (
            <div>
               <div className="compare-numbers">
                  <div className="number">{numbers.a}</div>
                  <div className="vs">vs</div>
                  <div className="number">{numbers.b}</div>
               </div>
               <div className="compare-options">
                  <button onClick={() => handleSelect("greater")}>
                     A &gt; B
                  </button>
                  <button onClick={() => handleSelect("equal")}>A = B</button>
                  <button onClick={() => handleSelect("less")}>A &lt; B</button>
               </div>
            </div>
         )}
      </div>
   );
}

// Falling Objects Game (33)
function FallingObjects({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}) {
   const duration = config.duration || 30;
   const [objects, setObjects] = useState<
      Array<{ id: number; type: "good" | "bad"; y: number }>
   >([]);
   const [timeLeft, setTimeLeft] = useState(duration);
   const [score, setScore] = useState(0);
   const [missed, setMissed] = useState(0);

   useEffect(() => {
      if (!isPlaying) return;

      const timer = setInterval(() => {
         setTimeLeft((prev: number) => {
            if (prev <= 1) {
               const finalScore = Math.max(0, 100 - missed * 5);
               onScoreUpdate(finalScore);
               setTimeout(() => onComplete(finalScore), 1000);
               return 0;
            }
            return prev - 1;
         });
      }, 1000);

      const objectTimer = setInterval(() => {
         setObjects((prev) => [
            ...prev,
            {
               id: Date.now(),
               type: Math.random() > 0.5 ? "good" : "bad",
               y: 0,
            },
         ]);
      }, 1000);

      const fallTimer = setInterval(() => {
         setObjects((prev) =>
            prev
               .map((obj) => ({ ...obj, y: obj.y + 2 }))
               .filter((obj) => {
                  if (obj.y > 100) {
                     if (obj.type === "good") setMissed(missed + 1);
                     return false;
                  }
                  return true;
               })
         );
      }, 50);

      return () => {
         clearInterval(timer);
         clearInterval(objectTimer);
         clearInterval(fallTimer);
      };
   }, [isPlaying, duration, missed, onScoreUpdate, onComplete]);

   const handleObjectClick = (id: number, type: "good" | "bad") => {
      setObjects((prev) => prev.filter((obj) => obj.id !== id));
      if (type === "good") {
         setScore(score + 5);
      } else {
         setScore(Math.max(0, score - 3));
      }
   };

   return (
      <div className="falling-objects-game">
         <h3>Falling Objects</h3>
         <p>
            Time: {timeLeft}s | Score: {score}
         </p>
         <div className="falling-area">
            {objects.map((obj) => (
               <button
                  key={obj.id}
                  onClick={() => handleObjectClick(obj.id, obj.type)}
                  className={`falling-object ${obj.type}`}
                  style={{
                     top: `${obj.y}%`,
                     left: `${Math.random() * 80 + 10}%`,
                  }}
               >
                  {obj.type === "good" ? (
                     <CheckCircleIcon style={{ width: 20, height: 20 }} />
                  ) : (
                     <XCircleIcon style={{ width: 20, height: 20 }} />
                  )}
               </button>
            ))}
         </div>
         <p
            style={{
               display: "flex",
               alignItems: "center",
               gap: "8px",
               justifyContent: "center",
            }}
         >
            Catch good items (
            <CheckCircleIcon
               style={{ width: 16, height: 16, display: "inline" }}
            />
            ), avoid bad ones (
            <XCircleIcon style={{ width: 16, height: 16, display: "inline" }} />
            )
         </p>
      </div>
   );
}

// Tap Counter Game (34)
function TapCounter({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}) {
   const duration = config.duration || 10;
   const [taps, setTaps] = useState(0);
   const [timeLeft, setTimeLeft] = useState(duration);

   useEffect(() => {
      if (!isPlaying) return;

      const timer = setInterval(() => {
         setTimeLeft((prev: number) => {
            if (prev <= 1) {
               const finalScore = Math.min(100, taps * 2);
               onScoreUpdate(finalScore);
               setTimeout(() => onComplete(finalScore), 1000);
               return 0;
            }
            return prev - 1;
         });
      }, 1000);

      return () => clearInterval(timer);
   }, [isPlaying, duration, taps, onScoreUpdate, onComplete]);

   const handleTap = () => {
      setTaps(taps + 1);
   };

   return (
      <div className="tap-counter-game">
         <h3>Tap Counter</h3>
         <p>Time: {timeLeft}s</p>
         <div className="tap-area" onClick={handleTap}>
            <div className="tap-count">{taps}</div>
            <p>Tap as fast as you can!</p>
         </div>
      </div>
   );
}

// Reflex Arrows Game (35)
function ReflexArrows({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}) {
   const rounds = config.rounds || 15;
   const [targetArrow, setTargetArrow] = useState<string>("");
   const [round, setRound] = useState(0);
   const [score, setScore] = useState(0);
   const [startTime, setStartTime] = useState(0);

   useEffect(() => {
      if (round >= rounds) {
         const finalScore = Math.round((score / rounds) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }

      const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      const arrow = arrows[Math.floor(Math.random() * arrows.length)];
      setTargetArrow(arrow);
      setStartTime(Date.now());
   }, [round, rounds, score, onScoreUpdate, onComplete]);

   const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === targetArrow) {
         const reactionTime = Date.now() - startTime;
         const roundScore = Math.max(0, 100 - reactionTime / 10);
         setScore(score + roundScore);
         setRound(round + 1);
      }
   };

   const arrowSymbols: Record<string, string> = {
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
   };

   return (
      <div
         className="reflex-arrows-game"
         onKeyDown={handleKeyPress}
         tabIndex={0}
      >
         <h3>
            Reflex Arrows - Round {round + 1}/{rounds}
         </h3>
         <div className="arrow-display">
            <div className="target-arrow">{arrowSymbols[targetArrow]}</div>
         </div>
         <p>Press the arrow key shown!</p>
      </div>
   );
}
