"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   ArrowPathIcon,
   TrophyIcon,
   ClockIcon,
} from "@heroicons/react/24/outline";

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

      const gameType = config.gameType || "click-green";
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
         clicked: boolean;
         timeoutId: NodeJS.Timeout;
      }>
   >([]);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

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
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
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
   const handleRepeatRound = useCallback(() => {
      // Restart same level
      startLevel();
   }, [startLevel]);

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
   const getActionButtonStyle = (tone: "success" | "danger") => {
      const color =
         tone === "success"
            ? "rgba(34, 197, 94, 0.6)"
            : "rgba(239, 68, 68, 0.6)";
      const bgFrom =
         tone === "success"
            ? "rgba(34, 197, 94, 0.25)"
            : "rgba(239, 68, 68, 0.25)";
      const bgTo =
         tone === "success"
            ? "rgba(34, 197, 94, 0.12)"
            : "rgba(239, 68, 68, 0.12)";

      return {
         padding: isMobile ? "12px 24px" : "14px 28px",
         background: `linear-gradient(135deg, ${bgFrom}, ${bgTo})`,
         border: `2px solid ${color}`,
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
      const color =
         tone === "success"
            ? "rgba(34, 197, 94, 0.8)"
            : "rgba(239, 68, 68, 0.8)";
      const bgFrom =
         tone === "success"
            ? "rgba(34, 197, 94, 0.35)"
            : "rgba(239, 68, 68, 0.35)";
      const bgTo =
         tone === "success"
            ? "rgba(34, 197, 94, 0.2)"
            : "rgba(239, 68, 68, 0.2)";

      target.style.background = isEnter
         ? `linear-gradient(135deg, ${bgFrom}, ${bgTo})`
         : `linear-gradient(135deg, ${
              tone === "success"
                 ? "rgba(34, 197, 94, 0.25)"
                 : "rgba(239, 68, 68, 0.25)"
           }, ${
              tone === "success"
                 ? "rgba(34, 197, 94, 0.12)"
                 : "rgba(239, 68, 68, 0.12)"
           })`;
      target.style.borderColor = color;
      target.style.transform = isEnter ? "translateY(-2px)" : "translateY(0)";
      target.style.boxShadow = isEnter
         ? `0 6px 14px ${
              tone === "success"
                 ? "rgba(34, 197, 94, 0.35)"
                 : "rgba(239, 68, 68, 0.35)"
           }`
         : "none";
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
      maxWidth: "640px",
   });

   const getNoticeBadgeStyle = (tone: "success" | "danger") => ({
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 14px",
      borderRadius: "999px",
      fontWeight: 800,
      fontSize: isMobile ? "0.95rem" : "1.05rem",
      background:
         tone === "success"
            ? "linear-gradient(135deg, rgba(34, 197, 94, 0.25), rgba(34, 197, 94, 0.1))"
            : "linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(239, 68, 68, 0.1))",
      border:
         tone === "success"
            ? "2px solid rgba(34, 197, 94, 0.6)"
            : "2px solid rgba(239, 68, 68, 0.6)",
      color: "var(--text)",
   });

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
                        "linear-gradient(135deg, rgba(34, 197, 94, 0.25), rgba(34, 197, 94, 0.12))",
                     border: "2px solid rgba(34, 197, 94, 0.6)",
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
                        "linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(239, 68, 68, 0.12))",
                     border: "2px solid rgba(239, 68, 68, 0.6)",
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
               {items.map((item) => (
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
                           ? "translate(-50%, -50%) scale(0.9)"
                           : "translate(-50%, -50%) scale(1)",
                        width: isMobile ? "48px" : "54px",
                        height: isMobile ? "48px" : "54px",
                        borderRadius: "16px",
                        border: `2px solid ${
                           item.color === "green"
                              ? "rgba(54, 211, 153, 0.55)"
                              : "rgba(251, 113, 133, 0.55)"
                        }`,
                        background:
                           item.color === "green"
                              ? item.clicked
                                 ? "rgba(54, 211, 153, 0.4)"
                                 : "rgba(54, 211, 153, 0.18)"
                              : item.clicked
                              ? "rgba(251, 113, 133, 0.4)"
                              : "rgba(251, 113, 133, 0.16)",
                        color: "white",
                        fontSize: isMobile ? "20px" : "24px",
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: item.clicked ? "not-allowed" : "pointer",
                        transition: "all 0.15s ease",
                        opacity: item.clicked ? 0.5 : 1,
                     }}
                  >
                     {item.clicked ? (
                        item.color === "green" ? (
                           <CheckCircleIcon style={{ width: 24, height: 24 }} />
                        ) : (
                           <XCircleIcon style={{ width: 24, height: 24 }} />
                        )
                     ) : item.color === "green" ? (
                        "✓"
                     ) : (
                        "✕"
                     )}
                  </button>
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
                     Try again?
                  </div>
                  <button
                     onClick={handleRepeatRound}
                     style={getActionButtonStyle("danger")}
                     onMouseEnter={(e) => applyActionHover(e, "danger", true)}
                     onMouseLeave={(e) => applyActionHover(e, "danger", false)}
                  >
                     Repeat the Round
                  </button>
               </div>
            )}
         </div>
      </div>
   );
}

// Avoid the Red Game (27)
function AvoidRed({
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
   const [playerPos, setPlayerPos] = useState({ x: 50, y: 50 });
   const [obstacles, setObstacles] = useState<
      Array<{ id: number; x: number; y: number }>
   >([]);
   const [timeLeft, setTimeLeft] = useState(duration);
   const [score, setScore] = useState(0);

   useEffect(() => {
      if (!isPlaying) return;

      const timer = setInterval(() => {
         setTimeLeft((prev: number) => {
            if (prev <= 1) {
               onScoreUpdate(score);
               setTimeout(() => onComplete(score), 1000);
               return 0;
            }
            return prev - 1;
         });
      }, 1000);

      const obstacleTimer = setInterval(() => {
         setObstacles((prev) =>
            [
               ...prev,
               {
                  id: Date.now(),
                  x: Math.random() * 100,
                  y: Math.random() * 100,
               },
            ].slice(-10)
         );
      }, 2000);

      return () => {
         clearInterval(timer);
         clearInterval(obstacleTimer);
      };
   }, [isPlaying, duration, score, onScoreUpdate, onComplete]);

   useEffect(() => {
      if (!isPlaying) return;

      const checkCollision = () => {
         const collision = obstacles.some((obs) => {
            const dist = Math.sqrt(
               Math.pow(playerPos.x - obs.x, 2) +
                  Math.pow(playerPos.y - obs.y, 2)
            );
            return dist < 10;
         });
         if (collision) {
            onScoreUpdate(score);
            setTimeout(() => onComplete(score), 1000);
         }
      };

      const interval = setInterval(checkCollision, 100);
      return () => clearInterval(interval);
   }, [obstacles, playerPos, isPlaying, score, onScoreUpdate, onComplete]);

   const handleKeyPress = (e: React.KeyboardEvent) => {
      let newPos = { ...playerPos };
      if (e.key === "ArrowUp") newPos.y = Math.max(0, newPos.y - 5);
      if (e.key === "ArrowDown") newPos.y = Math.min(100, newPos.y + 5);
      if (e.key === "ArrowLeft") newPos.x = Math.max(0, newPos.x - 5);
      if (e.key === "ArrowRight") newPos.x = Math.min(100, newPos.x + 5);
      setPlayerPos(newPos);
      setScore(score + 1);
   };

   return (
      <div className="avoid-red-game" onKeyDown={handleKeyPress} tabIndex={0}>
         <h3>Avoid the Red</h3>
         <p>
            Time: {timeLeft}s | Score: {score}
         </p>
         <div className="avoid-area">
            <div
               className="player"
               style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%` }}
            >
               P
            </div>
            {obstacles.map((obs) => (
               <div
                  key={obs.id}
                  className="red-obstacle"
                  style={{ left: `${obs.x}%`, top: `${obs.y}%` }}
               ></div>
            ))}
         </div>
         <p>Use arrow keys to avoid red obstacles</p>
      </div>
   );
}

// Reaction Test Game (28)
function ReactionTest({
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
   const rounds = config.rounds || 10;
   const [waiting, setWaiting] = useState(true);
   const [startTime, setStartTime] = useState(0);
   const [reactionTime, setReactionTime] = useState(0);
   const [round, setRound] = useState(0);
   const [scores, setScores] = useState<number[]>([]);

   useEffect(() => {
      if (round >= rounds) {
         const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
         onScoreUpdate(avgScore);
         setTimeout(() => onComplete(avgScore), 1000);
         return;
      }

      const waitTime = Math.random() * 3000 + 1000;
      const timer = setTimeout(() => {
         setWaiting(false);
         setStartTime(Date.now());
      }, waitTime);

      return () => clearTimeout(timer);
   }, [round, rounds, scores, onScoreUpdate, onComplete]);

   const handleClick = () => {
      if (waiting) {
         onScoreUpdate(0);
         setRound(round + 1);
         setWaiting(true);
         return;
      }

      const time = Date.now() - startTime;
      setReactionTime(time);
      const score = Math.max(0, 100 - time / 10);
      setScores([...scores, score]);
      setRound(round + 1);
      setWaiting(true);
   };

   return (
      <div className="reaction-test-game">
         <h3>
            Reaction Test - Round {round + 1}/{rounds}
         </h3>
         <div
            className={`reaction-area ${waiting ? "waiting" : "click-now"}`}
            onClick={handleClick}
         >
            {waiting ? "Wait..." : "CLICK NOW!"}
         </div>
         {reactionTime > 0 && <p>Reaction time: {reactionTime}ms</p>}
      </div>
   );
}

// Fast Math Game (29)
function FastMath({
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
   const rounds = config.rounds || 10;
   const [problem, setProblem] = useState<{
      a: number;
      b: number;
      op: string;
      answer: number;
   } | null>(null);
   const [input, setInput] = useState("");
   const [round, setRound] = useState(0);
   const [score, setScore] = useState(0);

   useEffect(() => {
      if (round >= rounds) {
         const finalScore = Math.round((score / rounds) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }
      generateProblem();
   }, [round, rounds, score, onScoreUpdate, onComplete]);

   const generateProblem = () => {
      const a = Math.floor(Math.random() * 20) + 1;
      const b = Math.floor(Math.random() * 20) + 1;
      const op = Math.random() > 0.5 ? "+" : "-";
      const answer = op === "+" ? a + b : a - b;
      setProblem({ a, b, op, answer });
      setInput("");
   };

   const handleSubmit = () => {
      if (parseInt(input) === problem?.answer) {
         setScore(score + 10);
      }
      setRound(round + 1);
   };

   return (
      <div className="fast-math-game">
         <h3>
            Fast Math - Round {round + 1}/{rounds}
         </h3>
         {problem && (
            <div>
               <div className="math-problem">
                  {problem.a} {problem.op} {problem.b} = ?
               </div>
               <input
                  type="number"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
                  className="math-input"
                  autoFocus
               />
               <button onClick={handleSubmit}>Submit</button>
            </div>
         )}
      </div>
   );
}

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
