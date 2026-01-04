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
   PencilIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

interface SpeedDrawingProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

interface Point {
   x: number;
   y: number;
}

type ShapeType =
   | "circle"
   | "square"
   | "triangle"
   | "star"
   | "heart"
   | "wave"
   | "curve"
   | "zigzag"
   | "spiral";

export default function SpeedDrawing({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: SpeedDrawingProps) {
   const defaultLevelDuration = 20; // seconds per level
   const levelDefinitions = config?.levelDefinitions || null;
   const configuredLevels = config?.levels ? Number(config.levels) : 0;
   const definitionsCount = Array.isArray(levelDefinitions)
      ? levelDefinitions.length
      : 0;
   const maxLevels = Math.max(configuredLevels, definitionsCount) || 1;

   // Get level config
   const getLevelConfig = useCallback(
      (level: number) => {
         if (levelDefinitions && levelDefinitions[level]) {
            const def = levelDefinitions[level];
            return {
               duration:
                  typeof def.duration === "number"
                     ? def.duration
                     : typeof def.duration === "string" &&
                       !isNaN(Number(def.duration))
                     ? Number(def.duration)
                     : defaultLevelDuration,
               targetShape: def.targetShape || getDefaultShape(level),
               minAccuracy:
                  typeof def.minAccuracy === "number"
                     ? def.minAccuracy
                     : typeof def.minAccuracy === "string" &&
                       !isNaN(Number(def.minAccuracy))
                     ? Number(def.minAccuracy)
                     : getDefaultMinAccuracy(level),
            };
         }
         return {
            duration: defaultLevelDuration,
            targetShape: getDefaultShape(level),
            minAccuracy: getDefaultMinAccuracy(level),
         };
      },
      [levelDefinitions, defaultLevelDuration]
   );

   // Get default shape for level
   const getDefaultShape = useCallback(
      (level: number): ShapeType => {
         // Special shape for last level
         if (level === maxLevels - 1) {
            return "spiral";
         }
         const shapes: ShapeType[] = [
            "circle",
            "square",
            "triangle",
            "star",
            "heart",
            "wave",
            "curve",
            "zigzag",
         ];
         return shapes[level % shapes.length];
      },
      [maxLevels]
   );

   // Get default min accuracy (progressive difficulty)
   const getDefaultMinAccuracy = useCallback(
      (level: number): number => {
         // 60% at level 1, 85% at level 15
         return Math.min(85, 60 + Math.floor((level / maxLevels) * 25));
      },
      [maxLevels]
   );

   const [currentLevel, setCurrentLevel] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "playing" | "ready" | "failed" | "paused"
   >("playing");
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [timeLeft, setTimeLeft] = useState(() => {
      return getLevelConfig(0).duration;
   });
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Drawing state
   const [targetShape, setTargetShape] = useState<ShapeType>("circle");
   const [playerPath, setPlayerPath] = useState<Point[]>([]);
   const [isDrawing, setIsDrawing] = useState(false);
   const [currentAccuracy, setCurrentAccuracy] = useState(0);
   const [drawingComplete, setDrawingComplete] = useState(false);
   const [drawingCompletionProgress, setDrawingCompletionProgress] =
      useState(0);
   const [startPoint, setStartPoint] = useState<Point | null>(null);
   const [endPoint, setEndPoint] = useState<Point | null>(null);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited

   // Refs
   const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
   const gameStateRef = useRef<"playing" | "ready" | "failed" | "paused">(
      "playing"
   );
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<((level: number) => void) | null>(null);
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   const scoreCalculatedForLevelRef = useRef<number | null>(null);
   const lastCompletedLevelRef = useRef<number | null>(null);
   const nextRoundClickedRef = useRef(false);
   const [nextRoundLocked, setNextRoundLocked] = useState(false);
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const arenaRef = useRef<HTMLDivElement>(null);
   const lastPointRef = useRef<Point | null>(null);
   const drawingCompletionProgressRef = useRef(0);
   const startDirectionLockedRef = useRef(false);
   const allowedDirectionRef = useRef<Point | null>(null);

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
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }
   }, []);

   // Get start and end points for a shape
   const getStartAndEndPoints = useCallback(
      (
         shape: ShapeType,
         width: number,
         height: number
      ): { start: Point; end: Point | null; direction?: Point } => {
         const centerX = width / 2;
         const centerY = height / 2;
         const size = Math.min(width, height) * 0.3;

         switch (shape) {
            case "circle":
               return {
                  start: { x: centerX + size, y: centerY },
                  end: null, // Closed shape - no end point
                  direction: { x: 0, y: -1 }, // Start going up (counter-clockwise)
               };
            case "square":
               return {
                  start: { x: centerX - size, y: centerY - size },
                  end: null, // Closed shape
                  direction: { x: 1, y: 0 }, // Start going right
               };
            case "triangle":
               return {
                  start: { x: centerX, y: centerY - size },
                  end: null, // Closed shape
                  direction: { x: 0.866, y: 0.5 }, // Start going down-right
               };
            case "star":
               return {
                  start: { x: centerX, y: centerY - size },
                  end: null, // Closed shape
                  direction: { x: 0.588, y: 0.809 }, // Start going down-right
               };
            case "heart":
               // Calculate actual start point from heart parametric equations
               // Heart starts at t=0: x = centerX, y = centerY - scale*5
               // But we want to start at the bottom point (t=Math.PI) for better UX
               const heartScale = size / 20;
               const heartStartT = Math.PI; // Bottom of heart
               const heartStartX =
                  centerX +
                  heartScale * 16 * Math.pow(Math.sin(heartStartT), 3);
               const heartStartY =
                  centerY -
                  heartScale *
                     (13 * Math.cos(heartStartT) -
                        5 * Math.cos(2 * heartStartT) -
                        2 * Math.cos(3 * heartStartT) -
                        Math.cos(4 * heartStartT));
               // Calculate direction from start point (going counter-clockwise)
               const heartDirT = heartStartT + 0.1; // Small step forward
               const heartDirX =
                  centerX + heartScale * 16 * Math.pow(Math.sin(heartDirT), 3);
               const heartDirY =
                  centerY -
                  heartScale *
                     (13 * Math.cos(heartDirT) -
                        5 * Math.cos(2 * heartDirT) -
                        2 * Math.cos(3 * heartDirT) -
                        Math.cos(4 * heartDirT));
               const heartDir = {
                  x: heartDirX - heartStartX,
                  y: heartDirY - heartStartY,
               };
               const heartDirLen = Math.sqrt(
                  heartDir.x * heartDir.x + heartDir.y * heartDir.y
               );
               return {
                  start: { x: heartStartX, y: heartStartY },
                  end: null, // Closed shape
                  direction:
                     heartDirLen > 0
                        ? {
                             x: heartDir.x / heartDirLen,
                             y: heartDir.y / heartDirLen,
                          }
                        : { x: -1, y: -1 },
               };
            case "wave":
               return {
                  start: { x: centerX - size, y: centerY },
                  end: null, // Closed shape
                  direction: { x: 1, y: 0 }, // Start going right
               };
            case "curve":
               return {
                  start: { x: centerX - size * 1.5, y: centerY + size * 0.7 },
                  end: { x: centerX + size * 1.5, y: centerY - size * 0.7 }, // Open shape - has end
                  direction: { x: 0.707, y: -0.707 }, // Going up-right
               };
            case "zigzag":
               // Zigzag starts at bottom-left, ends at top-right
               return {
                  start: { x: centerX - size, y: centerY + size * 0.4 },
                  end: { x: centerX + size, y: centerY - size * 0.4 }, // Open shape - has end
                  direction: { x: 1, y: -1 }, // Going up-right
               };
            case "spiral":
               // Spiral starts from a small radius, not from exact center
               const spiralStartRadius = size * 0.05;
               return {
                  start: { x: centerX + spiralStartRadius, y: centerY },
                  end: null, // Closed shape
                  direction: { x: 1, y: 0 }, // Start going right
               };
            default:
               return {
                  start: { x: centerX, y: centerY },
                  end: null,
               };
         }
      },
      []
   );

   // Generate target shape path for comparison
   const generateTargetPath = useCallback(
      (shape: ShapeType, width: number, height: number): Point[] => {
         const centerX = width / 2;
         const centerY = height / 2;
         const size = Math.min(width, height) * 0.3;
         const points: Point[] = [];

         switch (shape) {
            case "circle":
               for (let i = 0; i < 64; i++) {
                  const angle = (i / 64) * Math.PI * 2;
                  points.push({
                     x: centerX + Math.cos(angle) * size,
                     y: centerY + Math.sin(angle) * size,
                  });
               }
               break;
            case "square":
               const halfSize = size;
               for (let i = 0; i < 4; i++) {
                  const side = Math.floor(16);
                  for (let j = 0; j < side; j++) {
                     const t = j / side;
                     let x, y;
                     if (i === 0) {
                        x = centerX - halfSize + halfSize * 2 * t;
                        y = centerY - halfSize;
                     } else if (i === 1) {
                        x = centerX + halfSize;
                        y = centerY - halfSize + halfSize * 2 * t;
                     } else if (i === 2) {
                        x = centerX + halfSize - halfSize * 2 * t;
                        y = centerY + halfSize;
                     } else {
                        x = centerX - halfSize;
                        y = centerY + halfSize - halfSize * 2 * t;
                     }
                     points.push({ x, y });
                  }
               }
               break;
            case "triangle":
               for (let i = 0; i < 3; i++) {
                  const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
                  const x1 = centerX + Math.cos(angle) * size;
                  const y1 = centerY + Math.sin(angle) * size;
                  const nextAngle = ((i + 1) / 3) * Math.PI * 2 - Math.PI / 2;
                  const x2 = centerX + Math.cos(nextAngle) * size;
                  const y2 = centerY + Math.sin(nextAngle) * size;
                  const steps = 20;
                  for (let j = 0; j <= steps; j++) {
                     const t = j / steps;
                     points.push({
                        x: x1 + (x2 - x1) * t,
                        y: y1 + (y2 - y1) * t,
                     });
                  }
               }
               break;
            case "star":
               const starPoints = 5;
               const outerRadius = size;
               const innerRadius = size * 0.4;
               for (let i = 0; i < starPoints * 2; i++) {
                  const angle =
                     (i / (starPoints * 2)) * Math.PI * 2 - Math.PI / 2;
                  const radius = i % 2 === 0 ? outerRadius : innerRadius;
                  points.push({
                     x: centerX + Math.cos(angle) * radius,
                     y: centerY + Math.sin(angle) * radius,
                  });
               }
               // Close the star
               points.push(points[0]);
               break;
            case "heart":
               // Better heart shape using parametric equations
               for (let i = 0; i < 100; i++) {
                  const t = (i / 100) * Math.PI * 2;
                  const scale = size / 20; // Scale factor to fit canvas properly
                  const x = centerX + scale * 16 * Math.pow(Math.sin(t), 3);
                  const y =
                     centerY -
                     scale *
                        (13 * Math.cos(t) -
                           5 * Math.cos(2 * t) -
                           2 * Math.cos(3 * t) -
                           Math.cos(4 * t));
                  points.push({ x, y });
               }
               // Close the heart
               if (points.length > 0) {
                  points.push(points[0]);
               }
               break;
            case "wave":
               // Closed wave shape (sinusoidal)
               const waveSize = size;
               const waveCycles = 2; // Number of complete waves
               for (let i = 0; i <= 80; i++) {
                  const t = (i / 80) * Math.PI * 2;
                  const x = centerX + Math.cos(t) * waveSize;
                  const y =
                     centerY +
                     Math.sin(t) * waveSize * 0.5 +
                     Math.sin(t * waveCycles) * waveSize * 0.3;
                  points.push({ x, y });
               }
               // Close the wave
               if (points.length > 0) {
                  points.push(points[0]);
               }
               break;
            case "curve":
               // Open S-curve (smooth curve from start to end) - longer version
               const curveSize = size * 1.5; // Make it 50% longer
               for (let i = 0; i <= 80; i++) {
                  const t = i / 80;
                  // S-curve using cubic bezier-like function
                  const x = centerX - curveSize + curveSize * 2 * t;
                  const curveFactor = t * (1 - t); // Creates smooth S-curve
                  const y =
                     centerY +
                     curveSize * 0.47 -
                     curveSize * 0.93 * t +
                     curveFactor * curveSize * 0.93;
                  points.push({ x, y });
               }
               break;
            case "zigzag":
               // Open zigzag pattern from bottom-left to top-right
               const zigzagSize = size;
               const zigzagPoints = 6; // Number of zigzag segments (even number for proper end)
               const startX = centerX - zigzagSize;
               const startY = centerY + zigzagSize * 0.4;
               const endX = centerX + zigzagSize;
               const endY = centerY - zigzagSize * 0.4;

               for (let i = 0; i <= zigzagPoints; i++) {
                  const t = i / zigzagPoints;
                  const x = startX + (endX - startX) * t;
                  // Alternate: start at bottom, go up, then down, etc. (creating upward zigzag)
                  const baseY = startY + (endY - startY) * t;
                  const offset = i % 2 === 0 ? 0 : zigzagSize * 0.3;
                  const y = baseY + (i % 2 === 0 ? 0 : -offset);
                  points.push({ x, y });
               }
               break;
            case "spiral":
               // Closed spiral shape (Archimedean spiral)
               // Start from a small radius, not from center (to avoid immediate high accuracy)
               const spiralSize = size;
               const spiralTurns = 3; // Number of complete turns
               const spiralPoints = 120; // More points for smoother spiral
               const minRadius = spiralSize * 0.05; // Start from small radius, not center
               for (let i = 0; i <= spiralPoints; i++) {
                  const t = (i / spiralPoints) * Math.PI * 2 * spiralTurns;
                  const radius =
                     minRadius +
                     (t / (Math.PI * 2 * spiralTurns)) *
                        (spiralSize - minRadius);
                  const x = centerX + Math.cos(t) * radius;
                  const y = centerY + Math.sin(t) * radius;
                  points.push({ x, y });
               }
               // Close the spiral by connecting back to start (don't go to center)
               if (points.length > 0) {
                  points.push(points[0]);
               }
               break;
         }

         return points;
      },
      []
   );

   // Calculate accuracy by comparing player path to target shape
   const calculateAccuracy = useCallback(
      (
         playerPoints: Point[],
         targetPoints: Point[],
         canvasWidth: number,
         canvasHeight: number
      ): number => {
         if (playerPoints.length < 3 || targetPoints.length < 3) return 0;

         // Normalize points to 0-100 range
         const normalizePlayer = playerPoints.map((p) => ({
            x: (p.x / canvasWidth) * 100,
            y: (p.y / canvasHeight) * 100,
         }));

         const normalizeTarget = targetPoints.map((p) => ({
            x: (p.x / canvasWidth) * 100,
            y: (p.y / canvasHeight) * 100,
         }));

         // Calculate center of mass for both paths
         const playerCenter = {
            x:
               normalizePlayer.reduce((sum, p) => sum + p.x, 0) /
               normalizePlayer.length,
            y:
               normalizePlayer.reduce((sum, p) => sum + p.y, 0) /
               normalizePlayer.length,
         };
         const targetCenter = {
            x:
               normalizeTarget.reduce((sum, p) => sum + p.x, 0) /
               normalizeTarget.length,
            y:
               normalizeTarget.reduce((sum, p) => sum + p.y, 0) /
               normalizeTarget.length,
         };

         // Align centers
         const alignedPlayer = normalizePlayer.map((p) => ({
            x: p.x - playerCenter.x + targetCenter.x,
            y: p.y - playerCenter.y + targetCenter.y,
         }));

         // Calculate average distance with stricter matching
         let totalDistance = 0;
         let matchedPoints = 0;
         let closePoints = 0;
         let pathFollowingScore = 0;

         // Check if player path follows the target path direction
         if (alignedPlayer.length > 1 && normalizeTarget.length > 1) {
            let followingCount = 0;
            for (let i = 0; i < alignedPlayer.length - 1; i++) {
               const playerDir = {
                  x: alignedPlayer[i + 1].x - alignedPlayer[i].x,
                  y: alignedPlayer[i + 1].y - alignedPlayer[i].y,
               };

               // Find closest target segment
               let bestMatch = 0;
               let bestDist = Infinity;
               for (let j = 0; j < normalizeTarget.length - 1; j++) {
                  const targetDir = {
                     x: normalizeTarget[j + 1].x - normalizeTarget[j].x,
                     y: normalizeTarget[j + 1].y - normalizeTarget[j].y,
                  };

                  const dist = Math.sqrt(
                     Math.pow(alignedPlayer[i].x - normalizeTarget[j].x, 2) +
                        Math.pow(alignedPlayer[i].y - normalizeTarget[j].y, 2)
                  );

                  if (dist < bestDist) {
                     bestDist = dist;
                     bestMatch = j;
                  }
               }

               // Check if direction is similar
               if (bestMatch < normalizeTarget.length - 1) {
                  const targetDir = {
                     x:
                        normalizeTarget[bestMatch + 1].x -
                        normalizeTarget[bestMatch].x,
                     y:
                        normalizeTarget[bestMatch + 1].y -
                        normalizeTarget[bestMatch].y,
                  };

                  const playerLen = Math.sqrt(
                     playerDir.x * playerDir.x + playerDir.y * playerDir.y
                  );
                  const targetLen = Math.sqrt(
                     targetDir.x * targetDir.x + targetDir.y * targetDir.y
                  );

                  if (playerLen > 0 && targetLen > 0) {
                     const dotProduct =
                        (playerDir.x * targetDir.x +
                           playerDir.y * targetDir.y) /
                        (playerLen * targetLen);
                     if (dotProduct > 0.7) followingCount++; // Direction similarity threshold
                  }
               }
            }
            pathFollowingScore =
               (followingCount / (alignedPlayer.length - 1)) * 100;
         }

         for (const playerPoint of alignedPlayer) {
            let minDist = Infinity;
            for (const targetPoint of normalizeTarget) {
               const dist = Math.sqrt(
                  Math.pow(playerPoint.x - targetPoint.x, 2) +
                     Math.pow(playerPoint.y - targetPoint.y, 2)
               );
               if (dist < minDist) minDist = dist;
            }
            totalDistance += minDist;
            if (minDist < 3) matchedPoints++; // Stricter: 3% tolerance (was 5%)
            if (minDist < 5) closePoints++; // Close but not perfect
         }

         const avgDistance = totalDistance / alignedPlayer.length;
         const matchRatio = matchedPoints / alignedPlayer.length;
         const closeRatio = closePoints / alignedPlayer.length;

         // If average distance is too far (more than 15% of canvas), return 0 accuracy
         if (avgDistance > 15) {
            return 0;
         }

         // Convert to accuracy percentage (0-100)
         // Stricter calculation: more weight on distance, stricter tolerance, path following
         const distanceScore = Math.max(0, 100 - avgDistance * 3.5); // Stricter: was 2, now 3.5
         const matchScore = matchRatio * 100;
         const closeScore = closeRatio * 50; // Partial credit for close points

         // Weighted average: more emphasis on exact matches, distance, and path following
         const accuracy =
            distanceScore * 0.4 +
            matchScore * 0.35 +
            pathFollowingScore * 0.15 +
            closeScore * 0.1;

         return Math.min(100, Math.max(0, accuracy));
      },
      []
   );

   // Draw on canvas
   const drawCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Set canvas size
      canvas.width = width;
      canvas.height = height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw target shape outline (faded)
      const levelConfig = getLevelConfig(currentLevel);
      const targetPath = generateTargetPath(
         levelConfig.targetShape,
         width,
         height
      );

      ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      if (targetPath.length > 0) {
         ctx.moveTo(targetPath[0].x, targetPath[0].y);
         for (let i = 1; i < targetPath.length; i++) {
            ctx.lineTo(targetPath[i].x, targetPath[i].y);
         }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw start and end points
      const points = getStartAndEndPoints(
         levelConfig.targetShape,
         width,
         height
      );

      // Draw start point (green circle)
      ctx.fillStyle = "rgba(34, 197, 94, 0.8)";
      ctx.beginPath();
      ctx.arc(points.start.x, points.start.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(34, 197, 94, 1)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw direction arrow for closed shapes
      if (points.end === null && points.direction) {
         const canvasSize = Math.min(width, height) * 0.3;
         const arrowLength = canvasSize * 0.3;
         const arrowHeadSize = 10;
         const endX = points.start.x + points.direction.x * arrowLength;
         const endY = points.start.y + points.direction.y * arrowLength;

         // Draw direction line
         ctx.strokeStyle = "rgba(34, 197, 94, 0.6)";
         ctx.lineWidth = 3;
         ctx.beginPath();
         ctx.moveTo(points.start.x, points.start.y);
         ctx.lineTo(endX, endY);
         ctx.stroke();

         // Draw arrow head
         const angle = Math.atan2(points.direction.y, points.direction.x);
         ctx.fillStyle = "rgba(34, 197, 94, 0.8)";
         ctx.beginPath();
         ctx.moveTo(endX, endY);
         ctx.lineTo(
            endX - arrowHeadSize * Math.cos(angle - Math.PI / 6),
            endY - arrowHeadSize * Math.sin(angle - Math.PI / 6)
         );
         ctx.lineTo(
            endX - arrowHeadSize * Math.cos(angle + Math.PI / 6),
            endY - arrowHeadSize * Math.sin(angle + Math.PI / 6)
         );
         ctx.closePath();
         ctx.fill();
      }

      // Draw end point (red circle) only for open shapes
      if (points.end !== null) {
         ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
         ctx.beginPath();
         ctx.arc(points.end.x, points.end.y, 12, 0, Math.PI * 2);
         ctx.fill();
         ctx.strokeStyle = "rgba(239, 68, 68, 1)";
         ctx.lineWidth = 2;
         ctx.stroke();
      }

      // Draw labels
      ctx.fillStyle = "var(--text)";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("START", points.start.x, points.start.y - 18);
      if (points.end !== null) {
         ctx.fillText("END", points.end.x, points.end.y - 18);
      } else if (points.direction) {
         ctx.textBaseline = "top";
         const canvasSize = Math.min(width, height) * 0.3;
         const dirX = points.start.x + points.direction.x * canvasSize * 0.35;
         const dirY = points.start.y + points.direction.y * canvasSize * 0.35;
         ctx.fillText("→", dirX, dirY + 5);
      }

      // Draw player path
      if (playerPath.length > 1) {
         ctx.strokeStyle = "var(--accent)";
         ctx.lineWidth = 6;
         ctx.lineCap = "round";
         ctx.lineJoin = "round";
         ctx.beginPath();
         ctx.moveTo(playerPath[0].x, playerPath[0].y);
         for (let i = 1; i < playerPath.length; i++) {
            ctx.lineTo(playerPath[i].x, playerPath[i].y);
         }
         ctx.stroke();
      }
   }, [
      playerPath,
      currentLevel,
      getLevelConfig,
      generateTargetPath,
      getStartAndEndPoints,
   ]);

   useEffect(() => {
      drawCanvas();
   }, [drawCanvas]);

   // Start level
   const startLevel = useCallback(
      (level: number) => {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }

         // Reset state
         setPlayerPath([]);
         setIsDrawing(false);
         setDrawingComplete(false);
         setCurrentAccuracy(0);
         setDrawingCompletionProgress(0);
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         nextRoundClickedRef.current = false;
         setNextRoundLocked(false);
         lastPointRef.current = null;
         setStartPoint(null);
         setEndPoint(null);
         startDirectionLockedRef.current = false;
         allowedDirectionRef.current = null;
         // Reset score calculation for new level
         scoreCalculatedForLevelRef.current = null;
         lastCompletedLevelRef.current = null;

         const levelConfig = getLevelConfig(level);
         setTargetShape(levelConfig.targetShape);
         const levelDur = levelConfig.duration;
         setTimeLeft(levelDur);

         // Set game state to playing
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
      },
      [getLevelConfig]
   );

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Handle drawing start
   const handleDrawingStart = useCallback(
      (
         e:
            | React.MouseEvent<HTMLCanvasElement>
            | React.TouchEvent<HTMLCanvasElement>
      ) => {
         if (gameState !== "playing") return;

         const canvas = canvasRef.current;
         if (!canvas) return;

         const rect = canvas.getBoundingClientRect();
         let clientX: number, clientY: number;

         if ("touches" in e) {
            // Touch event
            if (e.touches.length === 0) return;
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
            e.preventDefault();
         } else {
            // Mouse event
            clientX = e.clientX;
            clientY = e.clientY;
         }

         const x = clientX - rect.left;
         const y = clientY - rect.top;

         // Check if starting near the start point
         const levelConfig = getLevelConfig(currentLevel);
         const points = getStartAndEndPoints(
            levelConfig.targetShape,
            rect.width,
            rect.height
         );
         const startDist = Math.sqrt(
            Math.pow(x - points.start.x, 2) + Math.pow(y - points.start.y, 2)
         );
         const maxStartDist = Math.min(rect.width, rect.height) * 0.1; // 10% tolerance

         // If starting near start point, lock direction
         if (startDist <= maxStartDist && points.direction) {
            startDirectionLockedRef.current = true;
            allowedDirectionRef.current = points.direction;
         } else {
            startDirectionLockedRef.current = false;
            allowedDirectionRef.current = null;
         }

         setIsDrawing(true);
         setPlayerPath([{ x, y }]);
         lastPointRef.current = { x, y };
      },
      [gameState, currentLevel, getLevelConfig, getStartAndEndPoints]
   );

   // Handle drawing move
   const handleDrawingMove = useCallback(
      (
         e:
            | React.MouseEvent<HTMLCanvasElement>
            | React.TouchEvent<HTMLCanvasElement>
      ) => {
         if (!isDrawing || gameState !== "playing") return;

         const canvas = canvasRef.current;
         if (!canvas) return;

         const rect = canvas.getBoundingClientRect();
         let clientX: number, clientY: number;

         if ("touches" in e) {
            // Touch event
            if (e.touches.length === 0) return;
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
            e.preventDefault();
         } else {
            // Mouse event
            clientX = e.clientX;
            clientY = e.clientY;
         }

         const x = clientX - rect.left;
         const y = clientY - rect.top;

         // Only add point if it's far enough from last point (reduce noise)
         if (lastPointRef.current) {
            const dist = Math.sqrt(
               Math.pow(x - lastPointRef.current.x, 2) +
                  Math.pow(y - lastPointRef.current.y, 2)
            );
            if (dist < 3) return; // Skip if too close (increased for thicker lines)

            // If direction is locked, check if movement follows allowed direction
            // But only enforce for the first few points (first 10% of expected path)
            // After that, allow free movement
            if (
               startDirectionLockedRef.current &&
               allowedDirectionRef.current &&
               playerPath.length < 20 // Only enforce direction lock for first 20 points
            ) {
               const canvas = canvasRef.current;
               if (canvas) {
                  const rect = canvas.getBoundingClientRect();
                  const levelConfig = getLevelConfig(currentLevel);
                  const points = getStartAndEndPoints(
                     levelConfig.targetShape,
                     rect.width,
                     rect.height
                  );

                  // Check distance from start point - if far enough, unlock direction
                  const currentDist = Math.sqrt(
                     Math.pow(x - points.start.x, 2) +
                        Math.pow(y - points.start.y, 2)
                  );
                  const maxStartDist = Math.min(rect.width, rect.height) * 0.15; // 15% tolerance

                  // If moved far enough from start, unlock direction
                  if (currentDist > maxStartDist) {
                     startDirectionLockedRef.current = false;
                     allowedDirectionRef.current = null;
                  } else {
                     // Still near start, enforce direction
                     const movement = {
                        x: x - lastPointRef.current.x,
                        y: y - lastPointRef.current.y,
                     };
                     const movementLen = Math.sqrt(
                        movement.x * movement.x + movement.y * movement.y
                     );

                     if (movementLen > 0) {
                        const normalizedMovement = {
                           x: movement.x / movementLen,
                           y: movement.y / movementLen,
                        };
                        const directionLen = Math.sqrt(
                           allowedDirectionRef.current.x *
                              allowedDirectionRef.current.x +
                              allowedDirectionRef.current.y *
                                 allowedDirectionRef.current.y
                        );
                        const normalizedDirection = {
                           x: allowedDirectionRef.current.x / directionLen,
                           y: allowedDirectionRef.current.y / directionLen,
                        };

                        // Check if movement is in the same direction (dot product > 0.3 means somewhat similar direction - more lenient)
                        const dotProduct =
                           normalizedMovement.x * normalizedDirection.x +
                           normalizedMovement.y * normalizedDirection.y;

                        // Only allow if moving in the correct direction (more lenient threshold)
                        if (dotProduct < 0.3) {
                           return; // Block movement that goes against the direction
                        }
                     }
                  }
               }
            }
         }

         setPlayerPath((prev) => [...prev, { x, y }]);
         lastPointRef.current = { x, y };
      },
      [isDrawing, gameState, currentLevel, getLevelConfig, getStartAndEndPoints]
   );

   // Handle drawing end
   const handleDrawingEnd = useCallback(() => {
      if (!isDrawing) return;
      setIsDrawing(false);
      setDrawingComplete(true);

      // Check if both requirements are met when drawing ends
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const levelConfig = getLevelConfig(currentLevel);
      const minAccuracy =
         typeof levelConfig.minAccuracy === "number"
            ? levelConfig.minAccuracy
            : Number(levelConfig.minAccuracy) || 0;
      const minCompletion = 70; // Minimum drawing completion percentage

      // Calculate current accuracy and completion
      const targetPath = generateTargetPath(
         levelConfig.targetShape,
         width,
         height
      );
      const accuracy = calculateAccuracy(playerPath, targetPath, width, height);
      setCurrentAccuracy(accuracy);

      const points = getStartAndEndPoints(
         levelConfig.targetShape,
         width,
         height
      );
      const maxDist = Math.min(width, height) * 0.1;

      let finalCompletion = 0;

      if (points.end === null) {
         // Closed shape - only check start point and direction
         const startDist =
            playerPath.length > 0
               ? Math.sqrt(
                    Math.pow(playerPath[0].x - points.start.x, 2) +
                       Math.pow(playerPath[0].y - points.start.y, 2)
                 )
               : Infinity;
         const startProgress = Math.max(0, 100 - (startDist / maxDist) * 100);

         // Check if path follows direction (for first few points)
         let directionScore = 0;
         if (points.direction && playerPath.length > 1) {
            const firstSegment = {
               x: playerPath[1].x - playerPath[0].x,
               y: playerPath[1].y - playerPath[0].y,
            };
            const firstLen = Math.sqrt(
               firstSegment.x * firstSegment.x + firstSegment.y * firstSegment.y
            );
            if (firstLen > 0) {
               const dotProduct =
                  (firstSegment.x * points.direction.x +
                     firstSegment.y * points.direction.y) /
                  firstLen;
               directionScore = Math.max(0, dotProduct * 100);
            }
         }

         // Check if shape is closed (last point is close to start point)
         let closureScore = 0;
         if (playerPath.length > 10) {
            // Only check closure if we have enough points
            const lastPoint = playerPath[playerPath.length - 1];
            const closureDist = Math.sqrt(
               Math.pow(lastPoint.x - points.start.x, 2) +
                  Math.pow(lastPoint.y - points.start.y, 2)
            );
            closureScore = Math.max(0, 100 - (closureDist / maxDist) * 100);
         }

         // Weight: start (40%), direction (20%), closure (40%)
         finalCompletion =
            startProgress * 0.4 + directionScore * 0.2 + closureScore * 0.4;
      } else {
         // Open shape - check both start and end points
         const startDist =
            playerPath.length > 0
               ? Math.sqrt(
                    Math.pow(playerPath[0].x - points.start.x, 2) +
                       Math.pow(playerPath[0].y - points.start.y, 2)
                 )
               : Infinity;
         const endDist =
            playerPath.length > 0
               ? Math.sqrt(
                    Math.pow(
                       playerPath[playerPath.length - 1].x - points.end.x,
                       2
                    ) +
                       Math.pow(
                          playerPath[playerPath.length - 1].y - points.end.y,
                          2
                       )
                 )
               : Infinity;

         const startProgress = Math.max(0, 100 - (startDist / maxDist) * 100);
         const endProgress = Math.max(0, 100 - (endDist / maxDist) * 100);
         finalCompletion = (startProgress + endProgress) / 2;
      }

      finalCompletion = Math.min(100, Math.max(0, finalCompletion));
      setDrawingCompletionProgress(finalCompletion);
      drawingCompletionProgressRef.current = finalCompletion;

      // If both requirements are met when drawing ends, set game to ready for next round
      if (accuracy >= minAccuracy && finalCompletion >= minCompletion) {
         requirementsMetRef.current = true;
         setRequirementsMet(true);
         // Set game to ready immediately so user can proceed to next round
         if (gameState === "playing") {
            clearAll();
            gameStateRef.current = "ready";
            setGameState("ready");
            lastCompletedLevelRef.current = currentLevel;
         }
      }
   }, [
      isDrawing,
      currentLevel,
      playerPath,
      gameState,
      getLevelConfig,
      generateTargetPath,
      calculateAccuracy,
      getStartAndEndPoints,
      clearAll,
   ]);

   // Calculate accuracy and drawing completion in real-time during drawing
   useEffect(() => {
      if (playerPath.length < 3) {
         if (gameState === "playing") {
            setDrawingCompletionProgress(0);
         }
         return;
      }

      if (gameState !== "playing") {
         return; // Don't reset if gameState is ready/failed, keep the last value
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const levelConfig = getLevelConfig(currentLevel);
      const targetPath = generateTargetPath(
         levelConfig.targetShape,
         width,
         height
      );
      const accuracy = calculateAccuracy(playerPath, targetPath, width, height);
      setCurrentAccuracy(accuracy);

      // Calculate drawing completion (start and end point proximity)
      const points = getStartAndEndPoints(
         levelConfig.targetShape,
         width,
         height
      );
      const startDist =
         playerPath.length > 0
            ? Math.sqrt(
                 Math.pow(playerPath[0].x - points.start.x, 2) +
                    Math.pow(playerPath[0].y - points.start.y, 2)
              )
            : Infinity;
      const endDist =
         points.end !== null && playerPath.length > 0
            ? Math.sqrt(
                 Math.pow(
                    playerPath[playerPath.length - 1].x - points.end.x,
                    2
                 ) +
                    Math.pow(
                       playerPath[playerPath.length - 1].y - points.end.y,
                       2
                    )
              )
            : Infinity;

      // Calculate completion percentage
      const maxDist = Math.min(width, height) * 0.1; // 10% of canvas size
      let completion = 0;

      if (points.end === null) {
         // Closed shape - check start point, direction, and if shape is closed
         const startProgress = Math.max(0, 100 - (startDist / maxDist) * 100);

         // Check if path follows direction (for first few points)
         let directionScore = 0;
         if (points.direction && playerPath.length > 1) {
            const firstSegment = {
               x: playerPath[1].x - playerPath[0].x,
               y: playerPath[1].y - playerPath[0].y,
            };
            const firstLen = Math.sqrt(
               firstSegment.x * firstSegment.x + firstSegment.y * firstSegment.y
            );
            if (firstLen > 0) {
               const dotProduct =
                  (firstSegment.x * points.direction.x +
                     firstSegment.y * points.direction.y) /
                  firstLen;
               directionScore = Math.max(0, dotProduct * 100);
            }
         }

         // Check if shape is closed (last point is close to start point)
         let closureScore = 0;
         if (playerPath.length > 10) {
            // Only check closure if we have enough points
            const lastPoint = playerPath[playerPath.length - 1];
            const closureDist = Math.sqrt(
               Math.pow(lastPoint.x - points.start.x, 2) +
                  Math.pow(lastPoint.y - points.start.y, 2)
            );
            closureScore = Math.max(0, 100 - (closureDist / maxDist) * 100);
         }

         // Weight: start (40%), direction (20%), closure (40%)
         completion =
            startProgress * 0.4 + directionScore * 0.2 + closureScore * 0.4;
      } else {
         // Open shape - check both start and end points
         const startProgress = Math.max(0, 100 - (startDist / maxDist) * 100);
         const endProgress = Math.max(0, 100 - (endDist / maxDist) * 100);
         completion = (startProgress + endProgress) / 2;
      }

      const finalCompletion = Math.min(100, Math.max(0, completion));
      setDrawingCompletionProgress(finalCompletion);
      drawingCompletionProgressRef.current = finalCompletion;

      // Update start and end points for display
      setStartPoint(points.start);
      setEndPoint(points.end);

      // Don't set requirementsMet here - let it be set only when both requirements are met and drawing is complete
   }, [
      playerPath,
      gameState,
      currentLevel,
      getLevelConfig,
      generateTargetPath,
      calculateAccuracy,
      getStartAndEndPoints,
   ]);

   // Check if both requirements are met (accuracy and drawing completion)
   useEffect(() => {
      if (gameState !== "playing" || !drawingComplete) return;

      const levelConfig = getLevelConfig(currentLevel);
      const minAccuracy =
         typeof levelConfig.minAccuracy === "number"
            ? levelConfig.minAccuracy
            : Number(levelConfig.minAccuracy) || 0;
      const minCompletion = 70; // Minimum drawing completion percentage

      // Both accuracy and drawing completion must be met
      if (
         currentAccuracy >= minAccuracy &&
         drawingCompletionProgress >= minCompletion
      ) {
         requirementsMetRef.current = true;
         setRequirementsMet(true);
         // Don't change gameState yet, wait for timer to finish
      }
   }, [
      drawingComplete,
      currentAccuracy,
      drawingCompletionProgress,
      gameState,
      currentLevel,
      getLevelConfig,
   ]);

   // End level when time runs out
   useEffect(() => {
      if (timeLeft === 0 && gameState === "playing") {
         const levelConfig = getLevelConfig(currentLevel);
         const minAccuracy =
            typeof levelConfig.minAccuracy === "number"
               ? levelConfig.minAccuracy
               : Number(levelConfig.minAccuracy) || 0;
         const minCompletion = 70; // Minimum drawing completion percentage

         clearAll();

         // Both accuracy and drawing completion must be met
         if (
            currentAccuracy >= minAccuracy &&
            drawingCompletionProgress >= minCompletion &&
            drawingComplete
         ) {
            requirementsMetRef.current = true;
            setRequirementsMet(true);
            gameStateRef.current = "ready";
            setGameState("ready");
            lastCompletedLevelRef.current = currentLevel;
         } else {
            gameStateRef.current = "failed";
            setGameState("failed");
         }
      }
   }, [
      timeLeft,
      gameState,
      currentLevel,
      currentAccuracy,
      drawingCompletionProgress,
      drawingComplete,
      getLevelConfig,
      clearAll,
   ]);

   // Handle level completion
   useEffect(() => {
      if (prevLevelRef.current === null) return;

      // Don't complete if game failed
      if (gameState === "failed") {
         return;
      }

      // Don't complete if we just started a level (gameState is "ready" but we haven't played yet)
      // Only complete if requirements were actually met AND drawing is complete
      if (gameState === "ready" && !requirementsMetRef.current) {
         return;
      }

      if (gameState === "ready" && lastCompletedLevelRef.current !== currentLevel) {
         return;
      }

      // Additional check: don't complete if drawing is not complete (for level 15)
      if (
         gameState === "ready" &&
         currentLevel === maxLevels - 1 &&
         !drawingComplete
      ) {
         return;
      }

      // Only calculate score when level actually changes (not when clicking next)
      // Check if we've already calculated score for this level
      if (
         gameState === "ready" &&
         currentLevel < maxLevels - 1 &&
         scoreCalculatedForLevelRef.current !== currentLevel
      ) {
         const rawScore = Math.round(
            ((currentLevel + 1) / maxLevels) * 100
         );
         const newScore = Math.min(99, rawScore);
         setCurrentScore(newScore);
         onScoreUpdate(newScore);
         scoreCalculatedForLevelRef.current = currentLevel;
      } else if (
         gameState === "ready" &&
         currentLevel === maxLevels - 1 &&
         requirementsMetRef.current &&
         drawingComplete &&
         scoreCalculatedForLevelRef.current !== currentLevel
      ) {
         const finalScore = 100;
         setCurrentScore(finalScore);
         onScoreUpdate(finalScore);
         scoreCalculatedForLevelRef.current = currentLevel;
         if (!completionCalledRef.current) {
            completionCalledRef.current = true;
            setTimeout(() => {
               onComplete(finalScore);
            }, 1500);
         }
      }
   }, [
      gameState,
      currentLevel,
      maxLevels,
      drawingComplete,
      onScoreUpdate,
      onComplete,
   ]);

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
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setRequirementsMet(false);
      requirementsMetRef.current = false;
      lastCompletedLevelRef.current = null;
      setGameState("playing");
      gameStateRef.current = "playing";
      setPlayerPath([]);
      setIsDrawing(false);
      setDrawingComplete(false);
      setCurrentAccuracy(0);
      setDrawingCompletionProgress(0);
      lastPointRef.current = null;
      nextRoundClickedRef.current = false;
      setNextRoundLocked(false);
      setStartPoint(null);
      setEndPoint(null);
      const levelDur = getLevelConfig(currentLevel).duration;
      setTimeLeft(levelDur);
      clearAll();
      setTimeout(() => {
         if (startLevelRef.current) {
            startLevelRef.current(currentLevel);
         }
      }, 100);
      if (maxReplays > 0) {
         setReplaysUsed((prev) => prev + 1);
      }
   }, [maxReplays, replaysUsed, currentLevel, getLevelConfig, clearAll]);

   // Share functionality
   const getShareableLink = useCallback((): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   }, []);

   const registerShareLink = useCallback(async (shareId: string) => {
      try {
         await registerShare(shareId, "speed-drawing");
         const gameKey = "play50games_shared_speed-drawing";
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
               title: "Speed Drawing - Play50Games",
               text: "Check out this drawing challenge!",
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
         const gameKey = "play50games_shared_speed-drawing";
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
      const gameKey = "play50games_shared_speed-drawing";
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

   useEffect(() => {
      if (!isPlaying) {
         clearAll();
         return;
      }

      // Game started - reset state
      prevLevelRef.current = -1;
      forceStartLevelRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      completionCalledRef.current = false;
      scoreCalculatedForLevelRef.current = null;
      lastCompletedLevelRef.current = null;
      setCurrentLevel(0);
      setCurrentScore(0);
      setRequirementsMet(false);
      setGameState("playing");
      setPlayerPath([]);
      setIsDrawing(false);
      setDrawingComplete(false);
      setCurrentAccuracy(0);
      setDrawingCompletionProgress(0);
      setStartPoint(null);
      setEndPoint(null);
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

      // Reset state
      setPlayerPath([]);
      setIsDrawing(false);
      setDrawingComplete(false);
      setCurrentAccuracy(0);
      setDrawingCompletionProgress(0);
      setRequirementsMet(false);
      requirementsMetRef.current = false;
      lastCompletedLevelRef.current = null;
      nextRoundClickedRef.current = false;
      setStartPoint(null);
      setEndPoint(null);

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
   const minAccuracy =
      typeof levelConfig.minAccuracy === "number"
         ? levelConfig.minAccuracy
         : Number(levelConfig.minAccuracy) || 0;

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
                     {currentScore}{" "}
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
                        borderRadius: "12px",
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                     }}
                  >
                     <PencilIcon
                        style={{
                           width: isMobile ? 18 : 20,
                           height: isMobile ? 18 : 20,
                           color: "var(--accent)",
                        }}
                     />
                     <span
                        style={{
                           fontSize: "1rem",
                           fontWeight: 600,
                           color: "var(--text)",
                        }}
                     >
                        Draw: {targetShape}
                     </span>
                  </div>
                  {playerPath.length >= 3 && (
                     <>
                        <div
                           style={{
                              background:
                                 currentAccuracy >= minAccuracy
                                    ? "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))"
                                    : "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))",
                              border: `1px solid ${
                                 currentAccuracy >= minAccuracy
                                    ? "rgba(34, 197, 94, 0.4)"
                                    : "rgba(239, 68, 68, 0.4)"
                              }`,
                              borderRadius: "12px",
                              padding: "10px 16px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                           }}
                        >
                           {currentAccuracy >= minAccuracy ? (
                              <CheckCircleIcon
                                 style={{
                                    width: isMobile ? 18 : 20,
                                    height: isMobile ? 18 : 20,
                                    color: "var(--ok)",
                                 }}
                              />
                           ) : (
                              <XCircleIcon
                                 style={{
                                    width: isMobile ? 18 : 20,
                                    height: isMobile ? 18 : 20,
                                    color: "var(--warn)",
                                 }}
                              />
                           )}
                           <span
                              style={{
                                 fontSize: "1rem",
                                 fontWeight: 600,
                                 color: "var(--text)",
                              }}
                           >
                              Accuracy: {Math.round(currentAccuracy)}% /{" "}
                              {minAccuracy}%
                           </span>
                        </div>
                        <div
                           style={{
                              background:
                                 drawingCompletionProgress >= 70
                                    ? "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))"
                                    : "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))",
                              border: `1px solid ${
                                 drawingCompletionProgress >= 70
                                    ? "rgba(34, 197, 94, 0.4)"
                                    : "rgba(239, 68, 68, 0.4)"
                              }`,
                              borderRadius: "12px",
                              padding: "10px 16px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                           }}
                        >
                           {drawingCompletionProgress >= 70 ? (
                              <CheckCircleIcon
                                 style={{
                                    width: isMobile ? 18 : 20,
                                    height: isMobile ? 18 : 20,
                                    color: "var(--ok)",
                                 }}
                              />
                           ) : (
                              <XCircleIcon
                                 style={{
                                    width: isMobile ? 18 : 20,
                                    height: isMobile ? 18 : 20,
                                    color: "var(--warn)",
                                 }}
                              />
                           )}
                           <span
                              style={{
                                 fontSize: "1rem",
                                 fontWeight: 600,
                                 color: "var(--text)",
                              }}
                           >
                              Completion:{" "}
                              {Math.round(
                                 drawingCompletionProgressRef.current ||
                                    drawingCompletionProgress
                              )}
                              % / 70%
                           </span>
                        </div>
                     </>
                  )}
               </div>
            )}

            {/* Game Arena */}
            {gameState === "playing" || gameState === "paused" ? (
               <div
                  ref={arenaRef}
                  style={{
                     width: "100%",
                     maxWidth: "800px",
                     background: "var(--card)",
                     border: "1px solid var(--stroke)",
                     borderRadius: "var(--radius)",
                     padding: isMobile ? "16px" : "20px",
                     boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                     position: "relative",
                     pointerEvents: "auto",
                  }}
               >
                  <canvas
                     ref={canvasRef}
                     onMouseDown={handleDrawingStart}
                     onMouseMove={handleDrawingMove}
                     onMouseUp={handleDrawingEnd}
                     onMouseLeave={handleDrawingEnd}
                     onTouchStart={handleDrawingStart}
                     onTouchMove={handleDrawingMove}
                     onTouchEnd={handleDrawingEnd}
                     style={{
                        width: "100%",
                        height: isMobile ? "300px" : "400px",
                        cursor: isDrawing ? "crosshair" : "default",
                        touchAction: "none",
                        borderRadius: "8px",
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
                     Accuracy: {Math.round(currentAccuracy)}% / {minAccuracy}%
                     <br />
                     Completion: {Math.round(drawingCompletionProgress)}% / 70%
                     <br />
                     Great drawing!
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
                        borderRadius: "12px",
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
                  const minAccuracy =
                     typeof levelConfig.minAccuracy === "number"
                        ? levelConfig.minAccuracy
                        : Number(levelConfig.minAccuracy) || 0;
                  const accuracyMet = currentAccuracy >= minAccuracy;

                  let failureReason = "";
                  if (!accuracyMet) {
                     failureReason = "Accuracy too low";
                  } else if (timeLeft === 0) {
                     failureReason = "Time ran out";
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
                                 Accuracy: Need {minAccuracy}% | You got{" "}
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
