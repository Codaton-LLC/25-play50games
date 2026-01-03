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

interface LineTracerProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

interface PathPoint {
   x: number;
   y: number;
}

export default function LineTracer({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: LineTracerProps) {
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

   // Get minimum accuracy for current level
   const getMinAccuracy = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].minAccuracy || 60;
         }
         // Progressive difficulty: 60% at level 1, 85% at level 15
         return 60 + Math.floor((level / maxLevels) * 25);
      },
      [levelRequirements, maxLevels]
   );

   // Get minimum progress for current level
   const getMinProgress = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].minProgress || 90;
         }
         return 90; // Default 90% progress required
      },
      [levelRequirements]
   );

   // Get level config
   const getLevelConfig = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level];
         }
         return {
            minAccuracy: getMinAccuracy(level),
            minProgress: getMinProgress(level),
            duration: getLevelDuration(level),
         };
      },
      [levelRequirements, getMinAccuracy, getMinProgress, getLevelDuration]
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

   // Path and tracing state
   const [targetPath, setTargetPath] = useState<PathPoint[]>([]);
   const [playerPath, setPlayerPath] = useState<PathPoint[]>([]);
   const [isDrawing, setIsDrawing] = useState(false);
   const [currentAccuracy, setCurrentAccuracy] = useState(0);
   const [progress, setProgress] = useState(0);
   const [pathCompleted, setPathCompleted] = useState(false);

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
   const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   const gameStateRef = useRef<"playing" | "ready" | "failed" | "paused">(
      "playing"
   );
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<() => void>(() => {});
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   const arenaRef = useRef<HTMLDivElement>(null);
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const lastPointRef = useRef<PathPoint | null>(null);
   const startedAtStartRef = useRef(false);

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
      if (startTimeoutRef.current) {
         clearTimeout(startTimeoutRef.current);
         startTimeoutRef.current = null;
      }
   }, []);

   useEffect(() => {
      if (!isPlaying) {
         clearAll();
         return;
      }
   }, [isPlaying, clearAll]);

   // Generate path based on level
   const generatePath = useCallback(
      (level: number): PathPoint[] => {
         const levelConfig = getLevelConfig(level);
         const complexity = levelConfig.complexity || Math.min(5 + level, 15);
         const pathLength = levelConfig.pathLength || Math.max(8, 20 - level);
         const pathType = levelConfig.pathType || "smooth";

         const points: PathPoint[] = [];
         const centerX = 50;
         const centerY = 50;
         const radius = 30;

         if (pathType === "spiral") {
            // Spiral path
            for (let i = 0; i < pathLength; i++) {
               const angle = (i / pathLength) * Math.PI * 4;
               const r = (i / pathLength) * radius;
               points.push({
                  x: centerX + Math.cos(angle) * r,
                  y: centerY + Math.sin(angle) * r,
               });
            }
         } else if (pathType === "zigzag") {
            // Zigzag path
            for (let i = 0; i < pathLength; i++) {
               const x = 20 + (i / pathLength) * 60;
               const y =
                  centerY +
                  Math.sin((i / pathLength) * Math.PI * complexity) * 25;
               points.push({ x, y });
            }
         } else if (pathType === "circle") {
            // Circular path
            for (let i = 0; i < pathLength; i++) {
               const angle = (i / pathLength) * Math.PI * 2;
               points.push({
                  x: centerX + Math.cos(angle) * radius,
                  y: centerY + Math.sin(angle) * radius,
               });
            }
         } else {
            // Smooth curved path (default)
            for (let i = 0; i < pathLength; i++) {
               const t = i / (pathLength - 1);
               const x = 20 + t * 60;
               const y =
                  centerY +
                  Math.sin(t * Math.PI * complexity) * 20 +
                  Math.cos(t * Math.PI * complexity * 0.7) * 15;
               points.push({ x, y });
            }
         }

         return points;
      },
      [getLevelConfig]
   );

   const getMaxAllowedDistance = useCallback((level: number) => {
      if (level <= 4) return 12;
      if (level <= 9) return 10;
      return 8;
   }, []);

   const getSnapDistance = useCallback((level: number) => {
      if (level <= 4) return 3;
      if (level <= 9) return 2.5;
      return 2;
   }, []);

   const getStartThreshold = useCallback((level: number) => {
      if (level <= 4) return 6;
      if (level <= 9) return 5;
      return 4;
   }, []);

   // Calculate accuracy and progress
   const calculateMetrics = useCallback(
      (playerPoints: PathPoint[], targetPoints: PathPoint[], level: number) => {
         if (playerPoints.length === 0 || targetPoints.length === 0) {
            return { accuracy: 0, progress: 0 };
         }

         let totalDistance = 0;
         let maxDistance = 0;
         let progressIndex = 0;

         // Calculate average distance from player path to target path
         playerPoints.forEach((playerPoint) => {
            let minDist = Infinity;
            let nearestIndex = 0;

            targetPoints.forEach((targetPoint, idx) => {
               const dist = Math.sqrt(
                  Math.pow(playerPoint.x - targetPoint.x, 2) +
                     Math.pow(playerPoint.y - targetPoint.y, 2)
               );
               if (dist < minDist) {
                  minDist = dist;
                  nearestIndex = idx;
               }
            });

            totalDistance += minDist;
            maxDistance = Math.max(maxDistance, minDist);
            progressIndex = Math.max(progressIndex, nearestIndex);
         });

         const avgDistance = totalDistance / playerPoints.length;
         const maxAllowedDistance = getMaxAllowedDistance(level);
         const accuracy = Math.max(
            0,
            Math.min(100, 100 - (avgDistance / maxAllowedDistance) * 100)
         );

         const progress = (progressIndex / targetPoints.length) * 100;

         return { accuracy, progress };
      },
      [getMaxAllowedDistance]
   );

   // Start level
   const startLevel = useCallback(
      (level: number) => {
         if (completionCalledRef.current) return;

         const levelConfig = getLevelConfig(level);
         const newPath = generatePath(level);

         setTargetPath(newPath);
         setPlayerPath([]);
         setIsDrawing(false);
         setCurrentAccuracy(0);
         setProgress(0);
         setPathCompleted(false);
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         startedAtStartRef.current = false;
         lastPointRef.current = null;

         const levelDur = getLevelDuration(level);
         setTimeLeft(levelDur);

         // Mark that we've started a level (so completion useEffect knows we've actually started)
         if (prevLevelRef.current === null) {
            prevLevelRef.current = level;
         }

         gameStateRef.current = "playing";
         setGameState("playing");

         // Start countdown timer
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
         }

         countdownTimerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
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
      [getLevelConfig, generatePath, getLevelDuration]
   );

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Update accuracy/progress while drawing
   useEffect(() => {
      if (gameState !== "playing" || playerPath.length === 0) return;
      if (!startedAtStartRef.current) return;

      const levelConfig = getLevelConfig(currentLevel);
      const minAccuracy = levelConfig.minAccuracy || 60;
      const minProgress = levelConfig.minProgress || 90;

      const metrics = calculateMetrics(playerPath, targetPath, currentLevel);
      setCurrentAccuracy(metrics.accuracy);
      setProgress(metrics.progress);

      // Check if path is completed
      if (metrics.progress >= minProgress) {
         setPathCompleted(true);
      }
   }, [
      playerPath,
      targetPath,
      gameState,
      currentLevel,
      getLevelConfig,
      calculateMetrics,
   ]);

   // End level when time runs out
   useEffect(() => {
      if (timeLeft === 0 && gameState === "playing") {
         const levelConfig = getLevelConfig(currentLevel);
         const minAccuracy = levelConfig.minAccuracy || 60;
         const minProgress = levelConfig.minProgress || 90;

         if (currentAccuracy >= minAccuracy && progress >= minProgress) {
            setGameState("ready");
         } else {
            setGameState("failed");
         }
      }
   }, [
      timeLeft,
      gameState,
      currentLevel,
      currentAccuracy,
      progress,
      getLevelConfig,
   ]);

   // Handle level completion
   useEffect(() => {
      // Don't execute if we haven't started any level yet (prevLevelRef is null)
      // or if we're in the initial "ready" state before level starts
      if (prevLevelRef.current === null) return;
      
      // Only update score when level is actually completed (not at start)
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
      if (currentLevel < maxLevels - 1) {
         const roundScore = Math.round(100 / maxLevels);
         const completedLevels = currentLevel + 1;
         const newScore = Math.min(100, completedLevels * roundScore);
         setCurrentScore(newScore);
         setTimeout(() => {
            onScoreUpdate(newScore);
         }, 0);

         // Clear all timers and reset state
         clearAll();
         setPlayerPath([]);
         setCurrentAccuracy(0);
         setProgress(0);
         setPathCompleted(false);
         setRequirementsMet(false);
         requirementsMetRef.current = false;

         // Set next level
         forceStartLevelRef.current = currentLevel + 1;
         setCurrentLevel((prev) => prev + 1);

         // Reset game state - will be set to "playing" when startLevel is called
         gameStateRef.current = "ready";
         setGameState("ready");
      }
   }, [currentLevel, maxLevels, onScoreUpdate, clearAll]);

   // Handle replay
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setRequirementsMet(false);
      requirementsMetRef.current = false;
      setGameState("playing");
      gameStateRef.current = "playing";
      setPlayerPath([]);
      setCurrentAccuracy(0);
      setProgress(0);
      setPathCompleted(false);
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

   // Start level when currentLevel changes
   useEffect(() => {
      if (!isPlaying) return;

      const hasActivePath = targetPath.length > 1;

      // Don't start if we're already on this level (unless forced) and we already have a path
      if (
         prevLevelRef.current === currentLevel &&
         forceStartLevelRef.current !== currentLevel &&
         hasActivePath
      ) {
         return;
      }

      // Reset state before starting new level
      setPlayerPath([]);
      setCurrentAccuracy(0);
      setProgress(0);
      setPathCompleted(false);
      setRequirementsMet(false);
      requirementsMetRef.current = false;

      // Don't set gameState to "playing" here - let startLevel do it after resetting timeLeft
      // Only set to "ready" if we're transitioning between levels, not on first start
      if (prevLevelRef.current !== null) {
         gameStateRef.current = "ready";
         setGameState("ready");
      }

      // Mark that we're starting this level (before calling startLevel)
      const wasFirstStart = prevLevelRef.current === null;
      prevLevelRef.current = currentLevel;
      
      // Clear force start flag if it matches
      if (forceStartLevelRef.current === currentLevel) {
         forceStartLevelRef.current = null;
      }

      // Start the level
      if (wasFirstStart) {
         // First time starting - start immediately without setting to "ready"
         startTimeoutRef.current = setTimeout(() => {
            startLevelRef.current(0);
         }, 0);
      } else if (currentLevel === 0) {
         // Restarting level 0
         startTimeoutRef.current = setTimeout(() => {
            startLevelRef.current(0);
         }, 0);
      } else {
         // Starting a new level
         startTimeoutRef.current = setTimeout(() => {
            startLevelRef.current(currentLevel);
         }, 1200);
      }

      return () => {
         if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
         }
      };
   }, [currentLevel, isPlaying, startLevel, targetPath]);

   const drawCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = arenaRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, rect.width, rect.height);

      // Draw target path
      if (targetPath && targetPath.length > 1) {
         // Draw target path glow first (behind)
         ctx.strokeStyle = "rgba(59, 130, 246, 0.2)";
         ctx.lineWidth = 10;
         ctx.lineCap = "round";
         ctx.lineJoin = "round";
         ctx.beginPath();
         ctx.moveTo(
            (targetPath[0].x / 100) * rect.width,
            (targetPath[0].y / 100) * rect.height
         );
         for (let i = 1; i < targetPath.length; i++) {
            ctx.lineTo(
               (targetPath[i].x / 100) * rect.width,
               (targetPath[i].y / 100) * rect.height
            );
         }
         ctx.stroke();

         // Draw target path (on top)
         ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
         ctx.lineWidth = 4;
         ctx.lineCap = "round";
         ctx.lineJoin = "round";
         ctx.beginPath();
         ctx.moveTo(
            (targetPath[0].x / 100) * rect.width,
            (targetPath[0].y / 100) * rect.height
         );
         for (let i = 1; i < targetPath.length; i++) {
            ctx.lineTo(
               (targetPath[i].x / 100) * rect.width,
               (targetPath[i].y / 100) * rect.height
            );
         }
         ctx.stroke();

         const startPoint = targetPath[0];
         const endPoint = targetPath[targetPath.length - 1];

         // Start/end markers
         ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
         ctx.beginPath();
         ctx.arc(
            (startPoint.x / 100) * rect.width,
            (startPoint.y / 100) * rect.height,
            6,
            0,
            Math.PI * 2
         );
         ctx.fill();

         ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
         ctx.beginPath();
         ctx.arc(
            (endPoint.x / 100) * rect.width,
            (endPoint.y / 100) * rect.height,
            6,
            0,
            Math.PI * 2
         );
         ctx.fill();
      }

      // Draw player path
      if (playerPath.length > 1) {
         ctx.strokeStyle =
            currentAccuracy >= 60
               ? "rgba(34, 197, 94, 0.8)"
               : "rgba(239, 68, 68, 0.8)";
         ctx.lineWidth = 3;
         ctx.lineCap = "round";
         ctx.lineJoin = "round";
         ctx.beginPath();
         ctx.moveTo(
            (playerPath[0].x / 100) * rect.width,
            (playerPath[0].y / 100) * rect.height
         );
         for (let i = 1; i < playerPath.length; i++) {
            ctx.lineTo(
               (playerPath[i].x / 100) * rect.width,
               (playerPath[i].y / 100) * rect.height
            );
         }
         ctx.stroke();
      }
   }, [targetPath, playerPath, currentAccuracy]);

   // Draw paths on canvas
   useEffect(() => {
      drawCanvas();
   }, [drawCanvas]);

   // Redraw when arena size changes (initial layout + resize)
   useEffect(() => {
      const arena = arenaRef.current;
      if (!arena) return;

      const handleResize = () => drawCanvas();

      window.addEventListener("resize", handleResize);

      let observer: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined") {
         observer = new ResizeObserver(handleResize);
         observer.observe(arena);
      }

      return () => {
         window.removeEventListener("resize", handleResize);
         if (observer) {
            observer.disconnect();
         }
      };
   }, [drawCanvas]);

   // Handle mouse/touch events
   const handlePointerDown = useCallback(
      (e: React.PointerEvent) => {
         if (gameState !== "playing" || requirementsMet) return;

         const rect = arenaRef.current?.getBoundingClientRect();
         if (!rect) return;

         const x = ((e.clientX - rect.left) / rect.width) * 100;
         const y = ((e.clientY - rect.top) / rect.height) * 100;

         let isAtStart = false;
         if (targetPath.length > 1) {
            const startPoint = targetPath[0];
            const dx = x - startPoint.x;
            const dy = y - startPoint.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            isAtStart = dist <= getStartThreshold(currentLevel);
         }

         startedAtStartRef.current = isAtStart;

         if (!isAtStart) return;

         setIsDrawing(true);
         setPlayerPath([{ x, y }]);
         lastPointRef.current = { x, y };
      },
      [gameState, requirementsMet, targetPath, currentLevel, getStartThreshold]
   );

   const handlePointerMove = useCallback(
      (e: React.PointerEvent) => {
         if (!isDrawing || gameState !== "playing" || requirementsMet) return;
         if (!startedAtStartRef.current) return;

         const rect = arenaRef.current?.getBoundingClientRect();
         if (!rect) return;

         let x = ((e.clientX - rect.left) / rect.width) * 100;
         let y = ((e.clientY - rect.top) / rect.height) * 100;

         if (targetPath.length > 1) {
            const snapDistance = getSnapDistance(currentLevel);
            let nearestIndex = 0;
            let minDist = Infinity;

            for (let i = 0; i < targetPath.length; i++) {
               const dx = x - targetPath[i].x;
               const dy = y - targetPath[i].y;
               const dist = Math.sqrt(dx * dx + dy * dy);
               if (dist < minDist) {
                  minDist = dist;
                  nearestIndex = i;
               }
            }

            if (minDist <= snapDistance) {
               x = targetPath[nearestIndex].x;
               y = targetPath[nearestIndex].y;
            }
         }

         // Only add point if it's far enough from last point
         if (lastPointRef.current) {
            const dist = Math.sqrt(
               Math.pow(x - lastPointRef.current.x, 2) +
                  Math.pow(y - lastPointRef.current.y, 2)
            );
            if (dist < 0.5) return; // Skip if too close
         }

         setPlayerPath((prev) => [...prev, { x, y }]);
         lastPointRef.current = { x, y };
      },
      [isDrawing, gameState, requirementsMet, targetPath, currentLevel, getSnapDistance]
   );

   const handlePointerUp = useCallback(() => {
      setIsDrawing(false);

      if (gameState !== "playing" || playerPath.length === 0) return;
      if (!startedAtStartRef.current) return;

      const levelConfig = getLevelConfig(currentLevel);
      const minAccuracy = levelConfig.minAccuracy || 60;
      const minProgress = levelConfig.minProgress || 90;
      const metrics = calculateMetrics(playerPath, targetPath, currentLevel);

      setCurrentAccuracy(metrics.accuracy);
      setProgress(metrics.progress);

      if (metrics.progress >= minProgress) {
         setPathCompleted(true);
      }

      if (metrics.accuracy >= minAccuracy && metrics.progress >= minProgress) {
         requirementsMetRef.current = true;
         setRequirementsMet(true);
         clearAll();
         setGameState("ready");
      }
   }, [
      gameState,
      playerPath,
      currentLevel,
      getLevelConfig,
      calculateMetrics,
      targetPath,
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
         await registerShare(shareId, "line-tracer");
         const gameKey = "play50games_shared_line-tracer";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
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
               title: "Line Tracer Game",
               text: "Check out this awesome Line Tracer game!",
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
         const gameKey = "play50games_shared_line-tracer";
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
      const gameKey = "play50games_shared_line-tracer";
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

   const progressPercentage = ((currentLevel + 1) / maxLevels) * 100;

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

            {/* Accuracy and Progress Stats Display */}
         {(gameState === "playing" || gameState === "paused") && (
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                  width: "100%",
                  maxWidth: "800px",
               }}
            >
               <div
                  style={{
                     background:
                        "linear-gradient(135deg, rgba(134, 239, 172, 0.2), rgba(34, 197, 94, 0.1))",
                     border: "1px solid rgba(134, 239, 172, 0.4)",
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
                     Accuracy: {Math.round(currentAccuracy)}%
                  </span>
               </div>
               <div
                  style={{
                     background:
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                     border: "1px solid rgba(59, 130, 246, 0.4)",
                     borderRadius: "12px",
                     padding: "10px 16px",
                     display: "flex",
                     alignItems: "center",
                     gap: "8px",
                  }}
               >
                  <ClockIcon
                     style={{
                        width: 18,
                        height: 18,
                        color: "var(--primary)",
                     }}
                  />
                  <span
                     style={{
                        fontSize: "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                     }}
                  >
                     Progress: {Math.round(progress)}%
                  </span>
               </div>
            </div>
         )}

         {/* Game Arena */}
         {gameState === "playing" || gameState === "paused" ? (
            <div
               ref={arenaRef}
               onPointerDown={handlePointerDown}
               onPointerMove={handlePointerMove}
               onPointerUp={handlePointerUp}
               onPointerLeave={handlePointerUp}
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
                  userSelect: "none",
                  cursor: isDrawing ? "crosshair" : "default",
                  touchAction: "none",
                  pointerEvents: gameState === "paused" ? "none" : "auto",
               }}
            >
               <div
                  style={{
                     position: "absolute",
                     top: "12px",
                     left: "12px",
                     display: "flex",
                     gap: "8px",
                     zIndex: 5,
                     flexWrap: "wrap",
                  }}
               >
                  <span
                     style={{
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background: "rgba(59, 130, 246, 0.18)",
                        border: "1px solid rgba(59, 130, 246, 0.4)",
                        color: "var(--text)",
                        fontSize: "12px",
                        fontWeight: 600,
                     }}
                  >
                     Need Accuracy: {Math.round(getMinAccuracy(currentLevel))}%
                  </span>
                  <span
                     style={{
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background: "rgba(34, 197, 94, 0.18)",
                        border: "1px solid rgba(34, 197, 94, 0.4)",
                        color: "var(--text)",
                        fontSize: "12px",
                        fontWeight: 600,
                     }}
                  >
                     Need Progress: {Math.round(getMinProgress(currentLevel))}%
                  </span>
               </div>
               <canvas
                  ref={canvasRef}
                  style={{
                     position: "absolute",
                     top: 0,
                     left: 0,
                     width: "100%",
                     height: "100%",
                  }}
               />
            </div>
         ) : null}

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
                  Accuracy: {Math.round(currentAccuracy)}% | Progress:{" "}
                  {Math.round(progress)}%
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
         {gameState === "failed" && (() => {
            const minAccuracy = getMinAccuracy(currentLevel);
            const minProgress = getMinProgress(currentLevel);
            const accuracyMet = currentAccuracy >= minAccuracy;
            const progressMet = progress >= minProgress;
            
            let failureReason = "";
            if (!accuracyMet && !progressMet) {
               failureReason = "Both accuracy and progress requirements not met";
            } else if (!accuracyMet) {
               failureReason = "Accuracy requirement not met";
            } else if (!progressMet) {
               failureReason = "Progress requirement not met";
            }
            
            return (
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
                        marginBottom: "12px",
                        color: "var(--warn)",
                        fontWeight: 600,
                     }}
                  >
                     {failureReason}
                  </div>
                  <div
                     style={{
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 400,
                        marginBottom: "8px",
                        color: "var(--text-secondary)",
                     }}
                  >
                     <div
                        style={{
                           marginBottom: "4px",
                           display: "flex",
                           alignItems: "center",
                           gap: "4px",
                        }}
                     >
                        <span>
                           Accuracy: Need {Math.round(minAccuracy)}% | You achieved{" "}
                           {Math.round(currentAccuracy)}%
                        </span>
                        {accuracyMet ? (
                           <CheckCircleIcon
                              style={{
                                 width: isMobile ? 16 : 18,
                                 height: isMobile ? 16 : 18,
                                 color: "var(--ok)",
                                 flexShrink: 0,
                              }}
                           />
                        ) : (
                           <XCircleIcon
                              style={{
                                 width: isMobile ? 16 : 18,
                                 height: isMobile ? 16 : 18,
                                 color: "var(--warn)",
                                 flexShrink: 0,
                              }}
                           />
                        )}
                     </div>
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "4px",
                        }}
                     >
                        <span>
                           Progress: Need {Math.round(minProgress)}% | You achieved{" "}
                           {Math.round(progress)}%
                        </span>
                        {progressMet ? (
                           <CheckCircleIcon
                              style={{
                                 width: isMobile ? 16 : 18,
                                 height: isMobile ? 16 : 18,
                                 color: "var(--ok)",
                                 flexShrink: 0,
                              }}
                           />
                        ) : (
                           <XCircleIcon
                              style={{
                                 width: isMobile ? 16 : 18,
                                 height: isMobile ? 16 : 18,
                                 color: "var(--warn)",
                                 flexShrink: 0,
                              }}
                           />
                        )}
                     </div>
                  </div>
               </div>
            );
         })()}

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
         </div>
      </>
   );
}
