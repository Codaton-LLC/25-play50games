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

interface StackBlocksProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

interface Block {
   x: number; // pixel position from left
   w: number; // width in pixels
   y: number; // y position from top
}

export default function StackBlocks({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: StackBlocksProps) {
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

   // Get minimum blocks to place for current level
   const getMinBlocks = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].minBlocks || 5;
         }
         // Progressive difficulty: 5 at level 1, 12 at level 15
         return 5 + Math.floor((level / maxLevels) * 7);
      },
      [levelRequirements, maxLevels]
   );

   // Get block speed for current level (higher = harder)
   const getBlockSpeed = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].blockSpeed || 0.5;
         }
         // Progressive difficulty: 0.5 at level 1, 1.5 at level 15
         return 0.5 + (level / maxLevels) * 1.0;
      },
      [levelRequirements, maxLevels]
   );

   // Get initial block width for current level (smaller = harder)
   const getInitialBlockWidth = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].initialBlockWidth || 50;
         }
         // Progressive difficulty: 50% at level 1, 30% at level 15
         return Math.max(30, 50 - Math.floor((level / maxLevels) * 20));
      },
      [levelRequirements, maxLevels]
   );

   // Get block width reduction per placement
   const getWidthReduction = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].widthReduction || 2;
         }
         // Progressive difficulty: 2% at level 1, 1.5% at level 15
         return Math.max(1.5, 2 - (level / maxLevels) * 0.5);
      },
      [levelRequirements, maxLevels]
   );

   // Get level config
   const getLevelConfig = useCallback(
      (level: number) => {
         return {
            duration: getLevelDuration(level),
            minBlocks: getMinBlocks(level),
            blockSpeed: getBlockSpeed(level),
            initialBlockWidth: getInitialBlockWidth(level),
            widthReduction: getWidthReduction(level),
         };
      },
      [
         getLevelDuration,
         getMinBlocks,
         getBlockSpeed,
         getInitialBlockWidth,
         getWidthReduction,
      ]
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

   // Game state
   const BLOCK_H = 28; // block height in pixels
   const PERFECT_EPS = 6; // pixel tolerance for "perfect" snap
   const TOTAL_VISIBLE_ROWS = 10;

   const [stack, setStack] = useState<Block[]>([]);
   const [currentBlock, setCurrentBlock] = useState<{
      x: number;
      w: number;
      y: number;
      vx: number;
   } | null>(null);
   const stackRef = useRef<Block[]>([]);
   const currentBlockRef = useRef<{
      x: number;
      w: number;
      y: number;
      vx: number;
   } | null>(null);
   const blockDirectionRef = useRef<1 | -1>(1);
   const [blocksPlaced, setBlocksPlaced] = useState(0);
   const [perfectSnaps, setPerfectSnaps] = useState(0);

   const canvasRef = useRef<HTMLCanvasElement>(null);
   const lastTimestampRef = useRef<number>(0);
   const setBlockDirectionSafe = useCallback((direction: 1 | -1) => {
      blockDirectionRef.current = direction;
   }, []);

   useEffect(() => {
      stackRef.current = stack;
   }, [stack]);

   useEffect(() => {
      currentBlockRef.current = currentBlock;
   }, [currentBlock]);

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
   const gameStateRef = useRef<"playing" | "ready" | "failed" | "paused">(
      "playing"
   );
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<((level: number) => void) | null>(null);
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   const lastCompletedLevelRef = useRef<number | null>(null);
   const nextRoundClickedRef = useRef(false);
   const [nextRoundLocked, setNextRoundLocked] = useState(false);
   const arenaRef = useRef<HTMLDivElement>(null);

   // Draw function (defined first so it can be used in resizeCanvas)
   const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Use actual canvas dimensions
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      // Clear entire canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Subtle grid
      ctx.strokeStyle = "rgba(255,255,255,.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
         ctx.beginPath();
         ctx.moveTo(x, 0);
         ctx.lineTo(x, h);
         ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
         ctx.beginPath();
         ctx.moveTo(0, y);
         ctx.lineTo(w, y);
         ctx.stroke();
      }

      // Draw stack (last N visible rows)
      const visibleStack = stackRef.current.slice(
         Math.max(0, stackRef.current.length - TOTAL_VISIBLE_ROWS)
      );
      for (let i = 0; i < visibleStack.length; i++) {
         const b = visibleStack[i];
         ctx.fillStyle = "rgba(110,168,255,.28)";
         ctx.fillRect(b.x, b.y - BLOCK_H, b.w, BLOCK_H);
         ctx.strokeStyle = "rgba(255,255,255,.10)";
         ctx.strokeRect(b.x, b.y - BLOCK_H, b.w, BLOCK_H);
      }

      // Draw current moving block
      const activeBlock = currentBlockRef.current;
      if (activeBlock) {
         ctx.fillStyle = "rgba(54,211,153,.75)";
         ctx.fillRect(
            activeBlock.x,
            activeBlock.y - BLOCK_H,
            activeBlock.w,
            BLOCK_H
         );
         ctx.strokeStyle = "rgba(255,255,255,.14)";
         ctx.strokeRect(
            activeBlock.x,
            activeBlock.y - BLOCK_H,
            activeBlock.w,
            BLOCK_H
         );
      }

      // Floor label
      ctx.fillStyle = "rgba(166,179,209,.55)";
      ctx.font = "12px system-ui";
      ctx.fillText("Tap / Click to drop", 14, 18);
   }, []);

   // Canvas resize handler
   const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const arena = arenaRef.current;
      if (!canvas || !arena) return;

      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
         const rect = arena.getBoundingClientRect();
         if (rect.width === 0 || rect.height === 0) return;

         // Get computed styles to account for padding
         const computedStyle = window.getComputedStyle(arena);
         const paddingX =
            parseFloat(computedStyle.paddingLeft) +
            parseFloat(computedStyle.paddingRight);
         const paddingY =
            parseFloat(computedStyle.paddingTop) +
            parseFloat(computedStyle.paddingBottom);

         // Calculate actual canvas size (excluding padding)
         const canvasWidth = rect.width - paddingX;
         const canvasHeight = rect.height - paddingY;

         if (canvasWidth <= 0 || canvasHeight <= 0) return;

         const dpr = Math.max(1, window.devicePixelRatio || 1);
         const width = Math.floor(canvasWidth * dpr);
         const height = Math.floor(canvasHeight * dpr);

         // Only resize if dimensions changed
         if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            canvas.style.width = canvasWidth + "px";
            canvas.style.height = canvasHeight + "px";

            const ctx = canvas.getContext("2d");
            if (ctx) {
               ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }

            // Redraw after resize
            draw();
         }
      });
   }, [draw]);

   // Get base Y position (near bottom)
   const getBaseY = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const h = canvas.height / dpr;
      return h - 52;
   }, []);

   // Spawn next block
   const spawnNext = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Get current stack from state (we'll use a ref or callback)
      setStack((currentStack) => {
         if (currentStack.length === 0) {
            // Should not happen, but handle it
            return currentStack;
         }

         const top = currentStack[currentStack.length - 1];
         const y = top.y - BLOCK_H;
         const levelConfig = getLevelConfig(currentLevel);

         // Use blockSpeed from config as multiplier for base speed (240 pixels/second)
         const baseSpeed = 240;
         const speed = baseSpeed * levelConfig.blockSpeed;

         // Start from random side
         const dpr = Math.max(1, window.devicePixelRatio || 1);
         const canvasWidth = canvas.width / dpr;
         const fromLeft = Math.random() > 0.5;
         const x = fromLeft ? 30 : canvasWidth - 30 - top.w;

         setCurrentBlock({ x, w: top.w, y, vx: speed });
         setBlockDirectionSafe(fromLeft ? 1 : -1);

         return currentStack;
      });
   }, [currentLevel, getLevelConfig]);

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
   }, []);

   useEffect(() => {
      if (!isPlaying) {
         clearAll();
         return;
      }

      // Resize canvas on mount and window resize
      let resizeTimeout: NodeJS.Timeout;
      const handleResize = () => {
         clearTimeout(resizeTimeout);
         resizeTimeout = setTimeout(() => {
            resizeCanvas();
         }, 100);
      };

      // Initial resize
      resizeCanvas();
      window.addEventListener("resize", handleResize);
      return () => {
         window.removeEventListener("resize", handleResize);
         clearTimeout(resizeTimeout);
      };
   }, [isPlaying, clearAll, resizeCanvas]);

   useEffect(() => {
      if (gameState !== "playing") return;
      const raf = requestAnimationFrame(() => {
         resizeCanvas();
         draw();
      });
      return () => cancelAnimationFrame(raf);
   }, [gameState, resizeCanvas, draw]);

   // Start level
   const startLevel = useCallback(
      (level: number) => {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
         }

         // Reset all state before starting new level
         setStack([]);
         setBlocksPlaced(0);
         setPerfectSnaps(0);
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         lastCompletedLevelRef.current = null;
         nextRoundClickedRef.current = false;
         setNextRoundLocked(false);
         setCurrentBlock(null);
         lastTimestampRef.current = 0;

         const levelConfig = getLevelConfig(level);
         const levelDur = levelConfig.duration;
         setTimeLeft(levelDur);

         // Resize canvas
         resizeCanvas();

         // Initialize first block at bottom
         setTimeout(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const dpr = Math.max(1, window.devicePixelRatio || 1);
            const canvasWidth = canvas.width / dpr;
            const levelConfig = getLevelConfig(level);

            // Use initialBlockWidth from config as percentage
            const initialWidthPercent = levelConfig.initialBlockWidth;
            const w = (canvasWidth * initialWidthPercent) / 100;
            const x = (canvasWidth - w) / 2;
            const baseY = getBaseY();

            const initialStack: Block[] = [{ x, w, y: baseY }];
            setStack(initialStack);

            // Spawn first moving block
            const y = baseY - BLOCK_H;
            // Use blockSpeed from config as multiplier for base speed (240 pixels/second)
            const baseSpeed = 240;
            const speed = baseSpeed * levelConfig.blockSpeed;
            const fromLeft = Math.random() > 0.5;
            const startX = fromLeft ? 30 : canvasWidth - 30 - w;

            setCurrentBlock({ x: startX, w, y, vx: speed });
            setBlockDirectionSafe(fromLeft ? 1 : -1);

            // Draw immediately
            setTimeout(() => {
               draw();
            }, 50);
         }, 100);

         // Set game state to playing AFTER resetting timeLeft
         gameStateRef.current = "playing";
         setGameState("playing");

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

         // Start animation loop
         const loop = (ts: number) => {
            if (
               gameStateRef.current !== "playing" ||
               requirementsMetRef.current
            ) {
               return;
            }

            if (!lastTimestampRef.current) lastTimestampRef.current = ts;
            const dt = Math.min(0.033, (ts - lastTimestampRef.current) / 1000);
            lastTimestampRef.current = ts;

            // Move current block
            setCurrentBlock((prev) => {
               if (!prev) return null;

               const canvas = canvasRef.current;
               if (!canvas) return prev;

               const dpr = Math.max(1, window.devicePixelRatio || 1);
               const canvasWidth = canvas.width / dpr;
               const direction = blockDirectionRef.current;
               const newX = prev.x + direction * prev.vx * dt;
               const minX = 20;
               const maxX = canvasWidth - 20 - prev.w;

               if (newX <= minX) {
                  setBlockDirectionSafe(1);
               } else if (newX >= maxX) {
                  setBlockDirectionSafe(-1);
               }

               return {
                  ...prev,
                  x: Math.max(minX, Math.min(maxX, newX)),
               };
            });

            // Draw immediately
            draw();

            animationFrameRef.current = requestAnimationFrame(loop);
         };

         // Start loop immediately
         lastTimestampRef.current = 0;
         animationFrameRef.current = requestAnimationFrame(loop);
      },
      [
         getLevelConfig,
         resizeCanvas,
         getBaseY,
         spawnNext,
         draw,
         setBlockDirectionSafe,
      ]
   );

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Handle block placement (drop)
   const handlePlace = useCallback(() => {
      if (
         gameState !== "playing" ||
         requirementsMet ||
         !currentBlock ||
         stack.length === 0
      )
         return;

      const below = stack[stack.length - 1];
      let newX = currentBlock.x;

      // Perfect snap if nearly aligned
      if (Math.abs(currentBlock.x - below.x) <= PERFECT_EPS) {
         newX = below.x;
         setPerfectSnaps((prev) => prev + 1);
      }

      // Compute overlap
      const left = Math.max(newX, below.x);
      const right = Math.min(newX + currentBlock.w, below.x + below.w);
      const overlap = right - left;

      // Game over if no overlap
      if (overlap <= 0) {
         setGameState("failed");
         gameStateRef.current = "failed";
         clearAll();
         return;
      }

      // Place new block with only overlap part
      const baseY = getBaseY();
      const newBlock: Block = {
         x: left,
         w: overlap,
         y: below.y - BLOCK_H,
      };

      const newStack = [...stack, newBlock];
      setBlocksPlaced((prev) => prev + 1);

      // Check if requirements are met (only based on blocks count)
      const levelConfig = getLevelConfig(currentLevel);
      const minBlocks = levelConfig.minBlocks;

      // Check requirements with current values
      // newStack.length includes the base block, so placed blocks = newStack.length - 1
      const placedBlocksCount = newStack.length - 1; // Subtract base block

      if (placedBlocksCount >= minBlocks && !requirementsMetRef.current) {
         requirementsMetRef.current = true;
         setRequirementsMet(true);
         clearAll();
         gameStateRef.current = "ready";
         setGameState("ready");
         lastCompletedLevelRef.current = currentLevel;
         setStack(newStack);
         return;
      }

      // Spawn next block (only if block is not too small)
      if (overlap < 24) {
         // Clamp to minimum width
         newBlock.w = 24;
         newBlock.x = below.x + (below.w - 24) / 2; // Center it
      }

      // Update stack and spawn next block
      setStack(newStack);

      // Spawn next block after state update
      setTimeout(() => {
         const canvas = canvasRef.current;
         if (!canvas || newStack.length === 0) return;

         const dpr = Math.max(1, window.devicePixelRatio || 1);
         const canvasWidth = canvas.width / dpr;
         const top = newStack[newStack.length - 1];
         const y = top.y - BLOCK_H;
         const levelConfig = getLevelConfig(currentLevel);
         // Use blockSpeed from config as multiplier for base speed (240 pixels/second)
         const baseSpeed = 240;
         const speed = baseSpeed * levelConfig.blockSpeed;
         const fromLeft = Math.random() > 0.5;
         const x = fromLeft ? 30 : canvasWidth - 30 - top.w;

         setCurrentBlock({ x, w: top.w, y, vx: speed });
         setBlockDirectionSafe(fromLeft ? 1 : -1);
      }, 50);
   }, [
      gameState,
      requirementsMet,
      currentBlock,
      stack,
      currentLevel,
      getLevelConfig,
      clearAll,
      getBaseY,
      spawnNext,
      setBlockDirectionSafe,
   ]);

   // Handle keyboard input
   const handlePlaceRef = useRef<() => void>(() => {});
   useEffect(() => {
      handlePlaceRef.current = handlePlace;
   }, [handlePlace]);

   useEffect(() => {
      if (!isPlaying || gameState !== "playing") return;

      const handleKeyPress = (e: KeyboardEvent) => {
         if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (
               gameStateRef.current === "playing" &&
               !requirementsMetRef.current &&
               currentBlockRef.current &&
               stackRef.current.length > 0
            ) {
               handlePlaceRef.current();
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => {
         window.removeEventListener("keydown", handleKeyPress);
      };
   }, [isPlaying, gameState]);

   // End level when time runs out
   useEffect(() => {
      if (
         timeLeft === 0 &&
         gameState === "playing" &&
         !requirementsMetRef.current
      ) {
         const levelConfig = getLevelConfig(currentLevel);
         const minBlocks = levelConfig.minBlocks;

         if (blocksPlaced >= minBlocks) {
            requirementsMetRef.current = true;
            setRequirementsMet(true);
            gameStateRef.current = "ready";
            setGameState("ready");
            lastCompletedLevelRef.current = currentLevel;
            clearAll();
         } else {
            gameStateRef.current = "failed";
            setGameState("failed");
            clearAll();
         }
      }
   }, [
      timeLeft,
      gameState,
      currentLevel,
      blocksPlaced,
      getLevelConfig,
      clearAll,
   ]);

   // Handle level completion
   useEffect(() => {
      if (prevLevelRef.current === null) return;

      if (gameState === "ready" && !requirementsMetRef.current) {
         return;
      }
      if (
         gameState === "ready" &&
         lastCompletedLevelRef.current !== currentLevel
      ) {
         return;
      }

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
      if (gameState !== "ready") return;
      if (nextRoundClickedRef.current || nextRoundLocked) return;
      if (currentLevel < maxLevels - 1) {
         nextRoundClickedRef.current = true;
         setNextRoundLocked(true);
         setCurrentLevel((prev) => prev + 1);
      }
   }, [gameState, currentLevel, maxLevels, nextRoundLocked]);

   // Handle replay
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setRequirementsMet(false);
      requirementsMetRef.current = false;
      lastCompletedLevelRef.current = null;
      setGameState("playing");
      gameStateRef.current = "playing";
      setStack([]);
      setBlocksPlaced(0);
      setPerfectSnaps(0);
      setCurrentBlock(null);
      lastTimestampRef.current = 0;
      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      clearAll();
      setTimeout(() => {
         startLevel(currentLevel);
      }, 100);
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

   // Share functionality
   const getShareableLink = useCallback((): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   }, []);

   const registerShareLink = useCallback(async (shareId: string) => {
      try {
         await registerShare(shareId, "stack-blocks");
         const gameKey = "play50games_shared_stack-blocks";
         const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes
         localStorage.setItem(
            gameKey,
            JSON.stringify({
               share_id: shareId,
               shared: false,
               expiry: expiry,
            })
         );
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
               title: "Stack Blocks - Play50Games",
               text: "Check out this stacking challenge!",
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
         const gameKey = "play50games_shared_stack-blocks";
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
      const gameKey = "play50games_shared_stack-blocks";
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

   // Start level when currentLevel changes
   useEffect(() => {
      if (!isPlaying) return;

      // Don't start if we're already on this level (unless forced)
      if (
         prevLevelRef.current === currentLevel &&
         forceStartLevelRef.current !== currentLevel
      ) {
         return;
      }

      prevLevelRef.current = currentLevel;
      if (forceStartLevelRef.current === currentLevel) {
         forceStartLevelRef.current = null;
      }

      // Reset state before starting new level
      setStack([]);
      setBlocksPlaced(0);
      setPerfectSnaps(0);
      setRequirementsMet(false);
      requirementsMetRef.current = false;
      lastCompletedLevelRef.current = null;
      nextRoundClickedRef.current = false;

      // Don't set gameState to "playing" here - let startLevel do it after resetting timeLeft
      gameStateRef.current = "ready";
      setGameState("ready");

      if (currentLevel === 0) {
         setTimeout(() => {
            if (startLevelRef.current) {
               startLevelRef.current(0);
            }
         }, 0);
      } else {
         setTimeout(() => {
            if (startLevelRef.current) {
               startLevelRef.current(currentLevel);
            }
         }, 1200);
      }
   }, [currentLevel, isPlaying, startLevel]);

   // Progress percentage for header
   const progressPercentage = ((currentLevel + 1) / maxLevels) * 100;

   const levelConfig = getLevelConfig(currentLevel);
   const minBlocks = levelConfig.minBlocks;

   return (
      <>
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               alignItems: "center",
               gap: isMobile ? "16px" : "20px",
               width: "100%",
               maxWidth: "800px",
               margin: "0 auto",
               padding: isMobile ? "12px" : "16px",
            }}
         >
            {/* Header Section */}
            <div
               style={{
                  width: "100%",
                  maxWidth: "800px",
                  background: "var(--card)",
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
                     {requirementsMet &&
                     lastCompletedLevelRef.current === currentLevel &&
                     currentLevel + 1 >= maxLevels
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

            {/* Stats Display */}
            {gameState === "playing" && (
               <div
                  style={{
                     display: "flex",
                     gap: isMobile ? "8px" : "12px",
                     flexWrap: "wrap",
                     justifyContent: "center",
                     width: "100%",
                     maxWidth: "800px",
                  }}
               >
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                        border: "1px solid rgba(59, 130, 246, 0.4)",

                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                     }}
                  >
                     <span
                        style={{
                           fontSize: "1rem",
                           fontWeight: 600,
                           color: "var(--text)",
                        }}
                     >
                        Blocks: {blocksPlaced}/{minBlocks}
                     </span>
                  </div>
               </div>
            )}

            {/* Game Arena */}
            {gameState === "playing" ? (
               <div
                  ref={arenaRef}
                  onClick={handlePlace}
                  tabIndex={0}
                  onKeyDown={(e) => {
                     if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handlePlace();
                     }
                  }}
                  style={{
                     position: "relative",
                     width: "100%",
                     maxWidth: "800px",
                     height: isMobile ? "400px" : "500px",
                     borderRadius: "var(--radius)",
                     border: "1px solid var(--border)",
                     background:
                        "radial-gradient(320px 220px at 30% 30%, rgba(59, 130, 246, 0.1), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                     boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
                     overflow: "hidden",
                     userSelect: "none",
                     touchAction: "manipulation",
                     padding: "10px",
                     cursor: "pointer",
                     outline: "none",
                  }}
               >
                  <canvas
                     ref={canvasRef}
                     style={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                     }}
                  />
               </div>
            ) : null}

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
                     Blocks placed: {blocksPlaced}/{minBlocks}
                  </div>
                  <button
                     onClick={handleNextRound}
                     disabled={nextRoundLocked}
                     style={{
                        padding: isMobile ? "12px 24px" : "14px 28px",
                        background: nextRoundLocked
                           ? "rgba(100, 100, 100, 0.2)"
                           : "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.12))",
                        border: nextRoundLocked
                           ? "1px solid rgba(100, 100, 100, 0.4)"
                           : "2px solid rgba(134, 239, 172, 0.6)",

                        color: "var(--text)",
                        fontSize: isMobile ? "1rem" : "1.05rem",
                        fontWeight: 700,
                        cursor: nextRoundLocked ? "not-allowed" : "pointer",
                        opacity: nextRoundLocked ? 0.5 : 1,
                        transition: "all 0.3s ease",
                     }}
                  >
                     Next Round
                  </button>
               </div>
            )}

            {/* Level Failed Message */}
            {gameState === "failed" &&
               (() => {
                  const levelConfig = getLevelConfig(currentLevel);
                  const minBlocks = levelConfig.minBlocks;
                  const blocksMet = blocksPlaced >= minBlocks;

                  let failureReason = "";
                  if (!blocksMet) {
                     failureReason = "Blocks requirement not met";
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
                        <div
                           style={{
                              marginBottom: "16px",
                              color: "var(--warn)",
                           }}
                        >
                           Level {currentLevel + 1} Failed
                        </div>
                        <div
                           style={{
                              fontSize: isMobile ? "0.9rem" : "1rem",
                              fontWeight: 600,
                              marginBottom: "12px",
                              color: "var(--warn)",
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
                                 justifyContent: "center",
                              }}
                           >
                              <span>
                                 Blocks: Need {minBlocks} | You placed{" "}
                                 {blocksPlaced}
                              </span>
                              {blocksMet ? (
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
            {gameState === "ready" &&
               currentLevel === maxLevels - 1 &&
               requirementsMet &&
               lastCompletedLevelRef.current === currentLevel && (
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

            {/* Action Buttons: Replay, Share */}
            <div
               style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  padding: isMobile ? "12px" : "16px",
                  background: "var(--card)",

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
         </div>
      </>
   );
}
