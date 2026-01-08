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

interface CursorMazeProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

interface MazeCell {
   v: boolean; // visited
   w: [boolean, boolean, boolean, boolean]; // walls: top, right, bottom, left
}

interface Maze {
   cells: MazeCell[];
   start: { x: number; y: number };
   exit: { x: number; y: number };
   wallsCv: HTMLCanvasElement;
   wallsCtx: CanvasRenderingContext2D;
   gridSize: number;
   cellSize: number;
}

export default function CursorMaze({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: CursorMazeProps) {
   const defaultLevelDuration = 60; // seconds per level
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
         // Progressive difficulty: 60s at level 1, 30s at level 15
         return Math.max(30, defaultLevelDuration - level * 2);
      },
      [levelRequirements, defaultLevelDuration]
   );

   // Get grid size for current level (progressive difficulty)
   const getGridSize = useCallback((level: number) => {
      // Levels 1-5: smaller grids (12-14)
      // Levels 6-10: medium grids (15-17)
      // Levels 11-15: larger grids (18-20)
      if (level < 5) {
         return 12 + level; // 13, 14, 15, 16, 17
      } else if (level < 10) {
         return 15 + (level - 5); // 15, 16, 17, 18, 19
      } else {
         return 18 + (level - 10); // 18, 19, 20, 21, 22
      }
   }, []);

   const [currentLevel, setCurrentLevel] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "playing" | "ready" | "failed" | "paused"
   >("playing");
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [timeLeft, setTimeLeft] = useState(() => {
      return getLevelDuration(0);
   });
   const [fails, setFails] = useState(0);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Canvas and game state
   const canvasRef = useRef<HTMLCanvasElement>(null);
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
   const levelStartTimeRef = useRef<number>(0);
   const nextRoundClickedRef = useRef(false);
   const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   const lastTimestampRef = useRef<number>(0);
   const [nextRoundLocked, setNextRoundLocked] = useState(false);

   // Player state
   const playerRef = useRef({
      x: 0,
      y: 0,
   });
   const pointerActiveRef = useRef(false);
   const keysPressedRef = useRef<Set<string>>(new Set());
   const moveSpeedRef = useRef(3); // pixels per frame
   const trailRef = useRef<Array<{ x: number; y: number }>>([]);

   // Maze state
   const mazeRef = useRef<Maze | null>(null);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited

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

   // Resize canvas
   const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Use fixed size for consistency
      const canvasWidth = 560;
      const canvasHeight = 560;
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      canvas.width = canvasWidth * dpr;
      canvas.height = canvasHeight * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) {
         ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // Note: Maze will be rebuilt when level starts
   }, []);

   useEffect(() => {
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      return () => window.removeEventListener("resize", resizeCanvas);
   }, [resizeCanvas]);

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

   // Maze generation using DFS
   const makeMaze = useCallback((n: number): MazeCell[] => {
      const cells: MazeCell[] = Array.from({ length: n * n }, () => ({
         v: false,
         w: [true, true, true, true], // top, right, bottom, left
      }));

      const idx = (x: number, y: number) => y * n + x;
      const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n;

      const dirs = [
         { dx: 0, dy: -1, a: 0, b: 2 }, // top
         { dx: 1, dy: 0, a: 1, b: 3 }, // right
         { dx: 0, dy: 1, a: 2, b: 0 }, // bottom
         { dx: -1, dy: 0, a: 3, b: 1 }, // left
      ];

      const stack = [{ x: 0, y: 0 }];
      cells[idx(0, 0)].v = true;

      while (stack.length) {
         const cur = stack[stack.length - 1];
         const options: Array<{
            nx: number;
            ny: number;
            d: (typeof dirs)[0];
         }> = [];

         for (const d of dirs) {
            const nx = cur.x + d.dx;
            const ny = cur.y + d.dy;
            if (inb(nx, ny) && !cells[idx(nx, ny)].v) {
               options.push({ nx, ny, d });
            }
         }

         if (!options.length) {
            stack.pop();
            continue;
         }

         const pick = options[Math.floor(Math.random() * options.length)];
         const c = cells[idx(cur.x, cur.y)];
         const ncell = cells[idx(pick.nx, pick.ny)];

         c.w[pick.d.a] = false;
         ncell.w[pick.d.b] = false;
         ncell.v = true;
         stack.push({ x: pick.nx, y: pick.ny });
      }

      return cells;
   }, []);

   // Build maze for level
   const buildMazeForLevel = useCallback(
      (level: number): Maze | null => {
         const canvas = canvasRef.current;
         if (!canvas) return null;

         // Use fixed canvas size for consistency
         const canvasWidth = 560;
         const canvasHeight = 560;

         const gridSize = getGridSize(level);
         const cellSize = Math.floor(canvasWidth / gridSize);

         const cells = makeMaze(gridSize);
         const start = { x: 0, y: 0 };
         const exit = { x: gridSize - 1, y: gridSize - 1 };

         // Create walls canvas
         const wallsCv = document.createElement("canvas");
         wallsCv.width = canvasWidth;
         wallsCv.height = canvasHeight;
         const wallsCtx = wallsCv.getContext("2d");
         if (!wallsCtx) return null;

         // Fill background
         wallsCtx.fillStyle = "rgba(15, 27, 51, 1)";
         wallsCtx.fillRect(0, 0, wallsCv.width, wallsCv.height);

         // Draw walls - thicker and more visible
         wallsCtx.strokeStyle = "#ffffff";
         wallsCtx.lineWidth = Math.max(10, Math.floor(cellSize * 0.2));
         wallsCtx.lineCap = "square";
         wallsCtx.lineJoin = "miter";

         const idx = (x: number, y: number) => y * gridSize + x;

         for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
               const w = cells[idx(x, y)].w;
               const x0 = x * cellSize;
               const y0 = y * cellSize;
               const x1 = x0 + cellSize;
               const y1 = y0 + cellSize;

               wallsCtx.beginPath();
               if (w[0]) {
                  // top
                  wallsCtx.moveTo(x0, y0);
                  wallsCtx.lineTo(x1, y0);
               }
               if (w[1]) {
                  // right
                  wallsCtx.moveTo(x1, y0);
                  wallsCtx.lineTo(x1, y1);
               }
               if (w[2]) {
                  // bottom
                  wallsCtx.moveTo(x0, y1);
                  wallsCtx.lineTo(x1, y1);
               }
               if (w[3]) {
                  // left
                  wallsCtx.moveTo(x0, y0);
                  wallsCtx.lineTo(x0, y1);
               }
               wallsCtx.stroke();
            }
         }

         return {
            cells,
            start,
            exit,
            wallsCv,
            wallsCtx,
            gridSize,
            cellSize,
         };
      },
      [makeMaze, getGridSize]
   );

   // Check if point hits wall - check multiple points for better collision detection
   const pointHitsWall = useCallback((x: number, y: number): boolean => {
      const maze = mazeRef.current;
      if (!maze) return false;

      // Check multiple points around the player position for better collision detection
      const checkPoints = [
         { x, y }, // center
         { x: x - 3, y }, // left
         { x: x + 3, y }, // right
         { x, y: y - 3 }, // top
         { x, y: y + 3 }, // bottom
      ];

      for (const point of checkPoints) {
         const xi = Math.max(
            0,
            Math.min(Math.floor(point.x), maze.wallsCv.width - 1)
         );
         const yi = Math.max(
            0,
            Math.min(Math.floor(point.y), maze.wallsCv.height - 1)
         );

         const img = maze.wallsCtx.getImageData(xi, yi, 1, 1).data;
         // Check if pixel is white (wall)
         if (img[0] > 200 && img[1] > 200 && img[2] > 200) {
            return true;
         }
      }

      return false;
   }, []);

   // Check if point is in exit
   const pointInExit = useCallback((x: number, y: number): boolean => {
      const maze = mazeRef.current;
      if (!maze) return false;

      const pad = Math.floor(maze.cellSize * 0.25);
      const ex = maze.exit.x * maze.cellSize + pad;
      const ey = maze.exit.y * maze.cellSize + pad;
      const sz = maze.cellSize - pad * 2;

      return x >= ex && x <= ex + sz && y >= ey && y <= ey + sz;
   }, []);

   // Reset player to start
   const resetToStart = useCallback(() => {
      const maze = mazeRef.current;
      if (!maze) return;

      const pad = Math.floor(maze.cellSize * 0.5);
      playerRef.current.x = maze.start.x * maze.cellSize + pad;
      playerRef.current.y = maze.start.y * maze.cellSize + pad;
      pointerActiveRef.current = false;
   }, []);

   const addTrailPoint = useCallback((x: number, y: number) => {
      const trail = trailRef.current;
      const last = trail.length > 0 ? trail[trail.length - 1] : null;
      if (last) {
         const dx = x - last.x;
         const dy = y - last.y;
         if (dx * dx + dy * dy < 4) {
            return;
         }
      }
      trail.push({ x, y });
      if (trail.length > 600) {
         trail.splice(0, trail.length - 600);
      }
   }, []);

   // Draw function
   const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const maze = mazeRef.current;
      if (!maze) {
         // Render idle state
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         ctx.fillStyle = "rgba(15, 27, 51, 1)";
         ctx.fillRect(0, 0, canvas.width, canvas.height);
         ctx.fillStyle = "rgba(166, 179, 209, 0.85)";
         ctx.font = "14px system-ui";
         ctx.fillText("Maze will be generated when level starts.", 14, 22);
         return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw walls
      ctx.globalAlpha = 0.92;
      ctx.drawImage(maze.wallsCv, 0, 0);
      ctx.globalAlpha = 1;

      // Draw start and exit pads
      const pad = Math.floor(maze.cellSize * 0.25);
      const sx = maze.start.x * maze.cellSize + pad;
      const sy = maze.start.y * maze.cellSize + pad;
      const ex = maze.exit.x * maze.cellSize + pad;
      const ey = maze.exit.y * maze.cellSize + pad;
      const sz = maze.cellSize - pad * 2;

      // Start pad (blue)
      ctx.fillStyle = "rgba(110, 168, 255, 0.25)";
      ctx.fillRect(sx, sy, sz, sz);
      ctx.strokeStyle = "rgba(110, 168, 255, 0.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, sz, sz);

      // Exit pad (green) - more visible
      ctx.fillStyle = "rgba(54, 211, 153, 0.5)";
      ctx.fillRect(ex, ey, sz, sz);
      ctx.strokeStyle = "rgba(54, 211, 153, 1)";
      ctx.lineWidth = 3;
      ctx.strokeRect(ex, ey, sz, sz);

      // Add exit indicator
      ctx.fillStyle = "rgba(54, 211, 153, 1)";
      ctx.font = `${Math.max(12, Math.floor(maze.cellSize * 0.4))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("EXIT", ex + sz / 2, ey + sz / 2);

      // Draw player trail
      if (trailRef.current.length > 1) {
         ctx.strokeStyle = "rgba(110, 168, 255, 0.25)";
         ctx.lineWidth = Math.max(2, Math.floor(maze.cellSize * 0.08));
         ctx.lineCap = "round";
         ctx.lineJoin = "round";
         ctx.beginPath();
         ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y);
         for (let i = 1; i < trailRef.current.length; i++) {
            ctx.lineTo(trailRef.current[i].x, trailRef.current[i].y);
         }
         ctx.stroke();
      }

      // Draw player square
      const s = Math.max(10, Math.floor(maze.cellSize * 0.3));
      ctx.fillStyle = pointerActiveRef.current
         ? "rgba(110, 168, 255, 0.95)"
         : "rgba(110, 168, 255, 0.55)";
      ctx.fillRect(
         playerRef.current.x - s / 2,
         playerRef.current.y - s / 2,
         s,
         s
      );
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
         playerRef.current.x - s / 2,
         playerRef.current.y - s / 2,
         s,
         s
      );
   }, []);

   const scheduleCanvasSync = useCallback(() => {
      let tries = 0;
      const trySync = () => {
         const canvas = canvasRef.current;
         if (!canvas) return;
         const rect = canvas.getBoundingClientRect();
         if (rect.width > 0 && rect.height > 0) {
            resizeCanvas();
            draw();
            return;
         }
         if (tries < 3) {
            tries += 1;
            requestAnimationFrame(trySync);
         }
      };
      requestAnimationFrame(trySync);
   }, [resizeCanvas, draw]);

   useEffect(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      scheduleCanvasSync();
   }, [gameState, currentLevel, scheduleCanvasSync]);

   // Move player with keyboard
   const movePlayerWithKeyboard = useCallback(() => {
      if (gameStateRef.current !== "playing" || !mazeRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      let deltaX = 0;
      let deltaY = 0;

      // Check which keys are pressed
      if (
         keysPressedRef.current.has("w") ||
         keysPressedRef.current.has("ArrowUp")
      ) {
         deltaY -= moveSpeedRef.current;
      }
      if (
         keysPressedRef.current.has("s") ||
         keysPressedRef.current.has("ArrowDown")
      ) {
         deltaY += moveSpeedRef.current;
      }
      if (
         keysPressedRef.current.has("a") ||
         keysPressedRef.current.has("ArrowLeft")
      ) {
         deltaX -= moveSpeedRef.current;
      }
      if (
         keysPressedRef.current.has("d") ||
         keysPressedRef.current.has("ArrowRight")
      ) {
         deltaX += moveSpeedRef.current;
      }

      if (deltaX === 0 && deltaY === 0) return;

      const newX = playerRef.current.x + deltaX;
      const newY = playerRef.current.y + deltaY;

      // Clamp to canvas bounds
      const clampedX = Math.max(0, Math.min(newX, canvas.width));
      const clampedY = Math.max(0, Math.min(newY, canvas.height));

      // Check wall collision BEFORE moving
      if (pointHitsWall(clampedX, clampedY)) {
         // Don't move if hitting wall - keep player at current position
         setFails((prev) => prev + 1);
         return;
      }

      // Update player position
      playerRef.current.x = clampedX;
      playerRef.current.y = clampedY;
      addTrailPoint(clampedX, clampedY);

      // Check exit
      if (pointInExit(clampedX, clampedY)) {
         // Level complete
         gameStateRef.current = "ready";
         setGameState("ready");
         setRequirementsMet(true);
         requirementsMetRef.current = true;
         lastCompletedLevelRef.current = currentLevel;
         clearAll();
         resetToStart();

         // Update score
         const roundScore = Math.round(100 / maxLevels);
         const completedLevels = currentLevel + 1;
         const newScore = Math.min(100, completedLevels * roundScore);
         setCurrentScore(newScore);
         setTimeout(() => {
            onScoreUpdate(newScore);
         }, 0);
      } else {
         // Redraw on move
         draw();
      }
   }, [
      pointHitsWall,
      pointInExit,
      clearAll,
      maxLevels,
      currentLevel,
      onScoreUpdate,
      onComplete,
      draw,
      addTrailPoint,
   ]);

   // Update game logic
   const update = useCallback(
      (dt: number, level: number) => {
         if (gameStateRef.current !== "playing") return;

         // Move player with keyboard
         movePlayerWithKeyboard();
      },
      [movePlayerWithKeyboard]
   );

   // Start level
   const startLevel = useCallback(
      (level: number) => {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }

         clearAll();

         // Reset state
         const levelDur = getLevelDuration(level);
         setTimeLeft(levelDur);
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         lastCompletedLevelRef.current = null;
         nextRoundClickedRef.current = false;
         setNextRoundLocked(false);
         setFails(0);
         trailRef.current = [];

         // Build maze
         const maze = buildMazeForLevel(level);
         if (!maze) return;

         mazeRef.current = maze;
         resetToStart();

         // Set game state to playing
         gameStateRef.current = "playing";
         setGameState("playing");

         // Resize canvas
         resizeCanvas();

         // Start timer
         levelStartTimeRef.current = performance.now();
         countdownTimerRef.current = setInterval(() => {
            setTimeLeft((prev: number) => {
               const newTime = Math.max(0, prev - 0.1);
               if (newTime <= 0) {
                  if (gameStateRef.current === "playing") {
                     gameStateRef.current = "failed";
                     setGameState("failed");
                     clearAll();
                  }
                  return 0;
               }
               return newTime;
            });
         }, 100);

         // Start game loop
         lastTimestampRef.current = 0;
         const loop = (timestamp: number) => {
            if (gameStateRef.current !== "playing") {
               return;
            }

            if (!lastTimestampRef.current) {
               lastTimestampRef.current = timestamp;
            }

            const dt = Math.min(
               0.033,
               (timestamp - lastTimestampRef.current) / 1000
            );
            lastTimestampRef.current = timestamp;

            update(dt, level);
            draw();

            if (gameStateRef.current === "playing") {
               animationFrameRef.current = requestAnimationFrame(loop);
            }
         };

         animationFrameRef.current = requestAnimationFrame(loop);
      },
      [
         getLevelDuration,
         clearAll,
         resizeCanvas,
         update,
         draw,
         buildMazeForLevel,
         resetToStart,
      ]
   );

   // Handle pointer events
   const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
         if (gameStateRef.current !== "playing" || !mazeRef.current) return;

         const canvas = canvasRef.current;
         if (!canvas) return;

         const rect = canvas.getBoundingClientRect();
         const scaleX = canvas.width / rect.width;
         const scaleY = canvas.height / rect.height;
         const newX = (e.clientX - rect.left) * scaleX;
         const newY = (e.clientY - rect.top) * scaleY;

         // Clamp to canvas bounds
         const clampedX = Math.max(0, Math.min(newX, canvas.width));
         const clampedY = Math.max(0, Math.min(newY, canvas.height));

         // Step through movement to prevent skipping through walls
         const prevX = playerRef.current.x;
         const prevY = playerRef.current.y;
         const dx = clampedX - prevX;
         const dy = clampedY - prevY;
         const dist = Math.hypot(dx, dy);
         const step = 2;
         const steps = Math.max(1, Math.ceil(dist / step));

         let nextX = prevX;
         let nextY = prevY;
         for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const sx = prevX + dx * t;
            const sy = prevY + dy * t;
            if (pointHitsWall(sx, sy)) {
               break;
            }
            nextX = sx;
            nextY = sy;
         }

         // If movement is fully blocked, keep player in place
         if (nextX === prevX && nextY === prevY) {
            return;
         }

         playerRef.current.x = nextX;
         playerRef.current.y = nextY;
         addTrailPoint(nextX, nextY);
         pointerActiveRef.current = true;

         // Check exit
         if (pointInExit(nextX, nextY)) {
            // Level complete
            gameStateRef.current = "ready";
            setGameState("ready");
            setRequirementsMet(true);
            requirementsMetRef.current = true;
            lastCompletedLevelRef.current = currentLevel;
            clearAll();
            resetToStart();

            // Update score
            const roundScore = Math.round(100 / maxLevels);
            const completedLevels = currentLevel + 1;
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            setTimeout(() => {
               onScoreUpdate(newScore);
            }, 0);
         } else {
            // Redraw on move
            draw();
         }
      },
      [
         pointHitsWall,
         pointInExit,
         clearAll,
         maxLevels,
         currentLevel,
         onScoreUpdate,
         onComplete,
         draw,
         addTrailPoint,
      ]
   );

   const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
         const canvas = canvasRef.current;
         if (canvas && canvas.setPointerCapture) {
            canvas.setPointerCapture(e.pointerId);
         }
         handlePointerMove(e);
      },
      [handlePointerMove]
   );

   const handlePointerUp = useCallback(() => {
      pointerActiveRef.current = false;
   }, []);

   // Handle next round
   const handleNextRound = useCallback(() => {
      if (nextRoundLocked || nextRoundClickedRef.current) return;
      if (gameState !== "ready" || currentLevel >= maxLevels - 1) return;

      nextRoundClickedRef.current = true;
      setNextRoundLocked(true);

      setTimeout(() => {
         setCurrentLevel((prev) => prev + 1);
         nextRoundClickedRef.current = false;
         setNextRoundLocked(false);
      }, 100);
   }, [gameState, currentLevel, maxLevels]);

   // Handle replay
   const handleReplay = useCallback(() => {
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setRequirementsMet(false);
      requirementsMetRef.current = false;
      lastCompletedLevelRef.current = null;
      trailRef.current = [];
      nextRoundClickedRef.current = false;
      setNextRoundLocked(false);
      setGameState("playing");
      gameStateRef.current = "playing";

      clearAll();
      setTimeout(() => {
         if (startLevelRef.current) {
            startLevelRef.current(currentLevel);
         }
      }, 100);

      if (maxReplays > 0) {
         setReplaysUsed((prev) => prev + 1);
      }
   }, [maxReplays, replaysUsed, currentLevel, clearAll]);

   // Share functionality
   const gameKey = "play50games_shared_cursor-maze";

   const getShareableLink = useCallback((): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   }, []);

   const registerShareLink = useCallback(async (shareId: string) => {
      try {
         await registerShare(shareId, "cursor-maze");
         const stored = localStorage.getItem(gameKey);
         if (stored) {
            const data = JSON.parse(stored);
            localStorage.setItem(
               gameKey,
               JSON.stringify({
                  ...data,
                  share_id: shareId,
                  shared: false,
               })
            );
         } else {
            localStorage.setItem(
               gameKey,
               JSON.stringify({
                  share_id: shareId,
                  shared: false,
               })
            );
         }
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
               title: "Cursor Maze",
               text: "Check out this awesome game!",
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

   // Check share status
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
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

   // Check completion
   useEffect(() => {
      if (
         gameState === "ready" &&
         currentLevel === maxLevels - 1 &&
         requirementsMet &&
         lastCompletedLevelRef.current === currentLevel &&
         !completionCalledRef.current
      ) {
         completionCalledRef.current = true;
         const finalScore = 100;
         setTimeout(() => {
            onComplete(finalScore);
         }, 1000);
      }
   }, [gameState, currentLevel, maxLevels, requirementsMet, onComplete]);

   // Initialize game
   useEffect(() => {
      if (!isPlaying) {
         clearAll();
         return;
      }

      prevLevelRef.current = -1;
      forceStartLevelRef.current = 0;
      requirementsMetRef.current = false;
      lastCompletedLevelRef.current = null;
      gameStateRef.current = "playing";
      completionCalledRef.current = false;
      setCurrentLevel(0);
      setCurrentScore(0);
      setRequirementsMet(false);
      lastCompletedLevelRef.current = null;
      trailRef.current = [];
      setGameState("playing");
   }, [isPlaying, clearAll]);

   // Start level when currentLevel changes
   useEffect(() => {
      if (!isPlaying) return;

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
      setRequirementsMet(false);
      requirementsMetRef.current = false;
      lastCompletedLevelRef.current = null;
      trailRef.current = [];
      nextRoundClickedRef.current = false;
      setNextRoundLocked(false);
      setGameState("playing");
      gameStateRef.current = "playing";

      if (startLevelRef.current) {
         requestAnimationFrame(() => {
            startLevelRef.current?.(currentLevel);
         });
      }
   }, [isPlaying, currentLevel]);

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Auto-start level 0
   useEffect(() => {
      if (isPlaying && currentLevel === 0 && !startTimeoutRef.current) {
         startTimeoutRef.current = setTimeout(() => {
            if (startLevelRef.current) {
               startLevelRef.current(0);
            }
         }, 0);
      }

      return () => {
         if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
         }
      };
   }, [isPlaying, currentLevel]);

   // Handle keyboard input for WASD and Arrow keys
   useEffect(() => {
      if (gameState !== "playing" || !isPlaying) {
         keysPressedRef.current.clear();
         return;
      }

      const handleKeyDown = (e: KeyboardEvent) => {
         const key = e.key.toLowerCase();
         // WASD keys
         if (key === "w" || key === "a" || key === "s" || key === "d") {
            keysPressedRef.current.add(key);
            e.preventDefault();
         }
         // Arrow keys
         else if (e.key === "ArrowUp") {
            keysPressedRef.current.add("w");
            e.preventDefault();
         } else if (e.key === "ArrowLeft") {
            keysPressedRef.current.add("a");
            e.preventDefault();
         } else if (e.key === "ArrowDown") {
            keysPressedRef.current.add("s");
            e.preventDefault();
         } else if (e.key === "ArrowRight") {
            keysPressedRef.current.add("d");
            e.preventDefault();
         }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
         const key = e.key.toLowerCase();
         // WASD keys
         if (key === "w" || key === "a" || key === "s" || key === "d") {
            keysPressedRef.current.delete(key);
         }
         // Arrow keys
         else if (e.key === "ArrowUp") {
            keysPressedRef.current.delete("w");
         } else if (e.key === "ArrowLeft") {
            keysPressedRef.current.delete("a");
         } else if (e.key === "ArrowDown") {
            keysPressedRef.current.delete("s");
         } else if (e.key === "ArrowRight") {
            keysPressedRef.current.delete("d");
         }
      };

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      return () => {
         window.removeEventListener("keydown", handleKeyDown);
         window.removeEventListener("keyup", handleKeyUp);
         keysPressedRef.current.clear();
      };
   }, [gameState, isPlaying]);

   const progressPercentage = ((currentLevel + 1) / maxLevels) * 100;

   return (
      <div
         style={{
            width: "100%",
            maxWidth: "800px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? "16px" : "20px",
            padding: isMobile ? "12px" : "16px",
         }}
      >
         {/* Header */}
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
                  {currentLevel + 1 >= maxLevels &&
                  gameState === "ready" &&
                  requirementsMet &&
                  lastCompletedLevelRef.current === currentLevel
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
                  {Math.max(0, Math.ceil(timeLeft))}s
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

         {/* Level Complete Message */}
         {gameState === "ready" && currentLevel < maxLevels - 1 && (
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

         {/* Game Complete Message */}
         {gameState === "ready" &&
            currentLevel === maxLevels - 1 &&
            requirementsMet && (
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
                     display: "flex",
                     flexDirection: "column",
                     gap: "16px",
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
                        margin: "0 auto",
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
                  <div
                     style={{
                        fontSize: isMobile ? "1rem" : "1.05rem",
                        fontWeight: 500,
                        color: "var(--muted)",
                     }}
                  >
                     Final Score: 100
                  </div>
               </div>
            )}

         {/* Level Failed Message */}
         {gameState === "failed" && (
            <div
               style={{
                  width: "100%",
                  padding: isMobile ? "20px 24px" : "24px 32px",
                  background: "var(--card)",
                  borderRadius: "var(--radius)",
                  color: "var(--text)",
                  fontSize: isMobile ? "1rem" : "1.1rem",
                  fontWeight: 700,
                  textAlign: "center" as const,
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
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
                        "linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(239, 68, 68, 0.1))",
                     border: "2px solid rgba(239, 68, 68, 0.6)",
                     color: "var(--text)",
                     margin: "0 auto",
                  }}
               >
                  <XCircleIcon style={{ width: 20, height: 20 }} />
                  Level {currentLevel + 1} Failed
               </div>
               <div
                  style={{
                     fontSize: isMobile ? "0.95rem" : "1rem",
                     color: "var(--muted)",
                  }}
               >
                  Time ran out! Try again to continue.
               </div>
            </div>
         )}

         {/* Game Arena */}
         {(gameState === "playing" || gameState === "failed") && (
            <div
               style={{
                  width: "100%",
                  background: "var(--card)",
                  borderRadius: isMobile ? "16px" : "20px",
                  padding: isMobile ? "12px" : "16px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
               }}
            >
               <canvas
                  ref={canvasRef}
                  style={{
                     width: "100%",
                     maxWidth: "560px",
                     height: "auto",
                     aspectRatio: "1 / 1",

                     cursor: "crosshair",
                     touchAction: "none",
                     display: "block",
                     margin: "0 auto",
                     background: "rgba(15, 27, 51, 1)",
                  }}
                  onPointerMove={handlePointerMove}
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  tabIndex={0}
               />
               <div
                  style={{
                     marginTop: "12px",
                     display: "flex",
                     gap: "8px",
                     flexWrap: "wrap",
                     justifyContent: "center",
                  }}
               >
                  <div
                     style={{
                        padding: "6px 12px",
                        background: "rgba(110, 168, 255, 0.1)",
                        border: "1px solid rgba(110, 168, 255, 0.3)",
                        borderRadius: "8px",
                        fontSize: isMobile ? "0.75rem" : "0.85rem",
                        color: "var(--text)",
                        fontWeight: 600,
                     }}
                  >
                     Fails: {fails}
                  </div>
                  <div
                     style={{
                        padding: "6px 12px",
                        background: "rgba(54, 211, 153, 0.1)",
                        border: "1px solid rgba(54, 211, 153, 0.3)",
                        borderRadius: "8px",
                        fontSize: isMobile ? "0.75rem" : "0.85rem",
                        color: "var(--text)",
                        fontWeight: 600,
                     }}
                  >
                     Blue = START
                  </div>
                  <div
                     style={{
                        padding: "6px 12px",
                        background: "rgba(54, 211, 153, 0.1)",
                        border: "1px solid rgba(54, 211, 153, 0.3)",
                        borderRadius: "8px",
                        fontSize: isMobile ? "0.75rem" : "0.85rem",
                        color: "var(--text)",
                        fontWeight: 600,
                     }}
                  >
                     Green = EXIT
                  </div>
               </div>
            </div>
         )}

         {/* Replay and Share Buttons */}
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               gap: "12px",
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
                  }}
               >
                  Link copied! Unlimited replay will unlock when someone opens
                  your link!
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
                     🎉 Someone opened your link! Unlimited replay is now active
                     for 15 minutes!
                  </span>
               </div>
            )}

            <div
               style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  width: "100%",
               }}
            >
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
                     border: "1px solid rgba(59, 130, 246, 0.6)",

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
      </div>
   );
}
