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
   InformationCircleIcon,
   ArrowLeftIcon,
   ArrowRightIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

import touch from "./skillTouch.module.css";
import ui from "./skillUi.module.css";
import bb from "./BallBalance.module.css";
import { usePlayAreaInView } from "./usePlayAreaInView";

interface BallBalanceProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function BallBalance({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: BallBalanceProps) {
   const defaultLevelDuration = 20; // seconds per level
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

   const [currentLevel, setCurrentLevel] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "playing" | "ready" | "failed" | "paused"
   >("playing");
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [timeLeft, setTimeLeft] = useState(() => {
      return getLevelDuration(0);
   });
   const [timeInCenter, setTimeInCenter] = useState(0);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Ball physics state
   const [ballX, setBallX] = useState(0); // relative to platform center, px
   const [ballV, setBallV] = useState(0); // velocity
   const [targetAngle, setTargetAngle] = useState(0); // target platform angle
   const [angle, setAngle] = useState(0); // current platform angle
   const [isInteracting, setIsInteracting] = useState(false);

   // Special features state
   const [currentPlatformWidth, setCurrentPlatformWidth] = useState(320); // For shrinking platform
   const [initialPlatformWidth, setInitialPlatformWidth] = useState(320);
   const [platformScale, setPlatformScale] = useState(1);
   const [redZones, setRedZones] = useState<
      Array<{ start: number; end: number }>
   >([]); // Red danger zones
   const [timeInRedZone, setTimeInRedZone] = useState(0); // Time spent in red zone
   const [platformShake, setPlatformShake] = useState(0); // Shake intensity
   const [windZones, setWindZones] = useState<
      Array<{ start: number; end: number; force: number }>
   >([]); // Wind force zones
   const [activeWindIndex, setActiveWindIndex] = useState<number | null>(null);
   const levelStartTimeRef = useRef<number>(0); // For time-based features

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   // Hides the "shared" notice after 15 s; cleared on unmount
   const shareSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
   );
   useEffect(
      () => () => {
         if (shareSuccessTimeoutRef.current) {
            clearTimeout(shareSuccessTimeoutRef.current);
         }
      },
      []
   );
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
   const lastTimestampRef = useRef<number>(0);
   const currentPlatformWidthRef = useRef<number>(320);
   const initialPlatformWidthRef = useRef<number>(320);
   const platformShakeRef = useRef<number>(0);
   const platformShakeAngleRef = useRef<number>(0);
   const lastShakeCycleRef = useRef<number>(-1);
   const shakeBiasRef = useRef<number>(0);
   const activeWindIndexRef = useRef<number | null>(null);
   const nextWindSwitchTimeRef = useRef<number>(0);
   const ballXRef = useRef<number>(0);
   const ballVRef = useRef<number>(0);
   const angleRef = useRef<number>(0);
   const targetAngleRef = useRef<number>(0);
   const keyRepeatDelayRef = useRef<{ [key: string]: number }>({});
   const lastKeyPressRef = useRef<{ [key: string]: number }>({});

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

   // Mobile/tablet: bring the panel and the play area (or the level card) on screen at every state change
   const rootRef = useRef<HTMLDivElement>(null);
   const pad = usePlayAreaInView(rootRef, arenaRef, true, `${gameState}-${currentLevel}`);

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

   // Leaving the page (or a final game switching mini-game) mid-round: stop the frame loop and timers
   useEffect(() => () => clearAll(), [clearAll]);

   useEffect(() => {
      if (!isPlaying) {
         // Game stopped - clear everything
         clearAll();
         return;
      }

      // Game started - reset state
      prevLevelRef.current = -1; // Set to -1 so it's different from 0
      forceStartLevelRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      completionCalledRef.current = false;
      setCurrentLevel(0);
      setCurrentScore(0);
      setRequirementsMet(false);
      setGameState("playing");
      setTimeInCenter(0);
      setTimeInRedZone(0);
      setPlatformShake(0);
      platformShakeRef.current = 0;
      platformShakeAngleRef.current = 0;
      lastShakeCycleRef.current = -1;
      shakeBiasRef.current = 0;
      activeWindIndexRef.current = null;
      setActiveWindIndex(null);
      setPlatformScale(1);
      setBallX(0);
      setBallV(0);
      setTargetAngle(0);
      setAngle(0);
   }, [isPlaying, clearAll]);

   // Get base physics configuration (hardcoded fallback)
   const getBasePhysicsConfig = useCallback((level: number) => {
      // Base config with special features
      const baseConfig = {
         maxAngle: 12,
         gravity: 800,
         friction: 0.96,
         platformWidth: 320,
         centerZoneSize: 80,
         minTimeInCenter: 3,
         // Special features
         shrinkingPlatform: false,
         redZones: [] as Array<{ start: number; end: number }>,
         platformShake: false,
         shakeInterval: 0,
         shakeIntensity: 6,
         shakeDuration: 0.8,
         shakeFrequency: 10,
         shakeAngle: 3,
         windZones: [] as Array<{ start: number; end: number; force: number }>,
         shrinkMinScale: 0.6,
         shrinkDelay: 0,
      };

      switch (level) {
         case 0: // Level 1: Easy - slow, large platform, gentle physics
            return {
               ...baseConfig,
               maxAngle: 12,
               gravity: 800,
               friction: 0.96,
               platformWidth: 320,
               centerZoneSize: 80,
               minTimeInCenter: 3,
            };
         case 1: // Level 2
            return {
               ...baseConfig,
               maxAngle: 14,
               gravity: 900,
               friction: 0.955,
               platformWidth: 310,
               centerZoneSize: 75,
               minTimeInCenter: 4,
            };
         case 2: // Level 3
            return {
               ...baseConfig,
               maxAngle: 16,
               gravity: 1000,
               friction: 0.95,
               platformWidth: 300,
               centerZoneSize: 70,
               minTimeInCenter: 5,
            };
         case 3: // Level 4
            return {
               ...baseConfig,
               maxAngle: 18,
               gravity: 1100,
               friction: 0.945,
               platformWidth: 290,
               centerZoneSize: 65,
               minTimeInCenter: 6,
            };
         case 4: // Level 5
            return {
               ...baseConfig,
               maxAngle: 20,
               gravity: 1200,
               friction: 0.94,
               platformWidth: 280,
               centerZoneSize: 60,
               minTimeInCenter: 7,
            };
         case 5: // Level 6 - Shrinking Platform
            return {
               ...baseConfig,
               maxAngle: 22,
               gravity: 1300,
               friction: 0.935,
               platformWidth: 270,
               centerZoneSize: 55,
               minTimeInCenter: 8,
               shrinkingPlatform: true,
            };
         case 6: // Level 7 - Shrinking Platform
            return {
               ...baseConfig,
               maxAngle: 24,
               gravity: 1400,
               friction: 0.93,
               platformWidth: 260,
               centerZoneSize: 50,
               minTimeInCenter: 9,
               shrinkingPlatform: true,
            };
         case 7: // Level 8 - Red Zones
            return {
               ...baseConfig,
               maxAngle: 26,
               gravity: 1500,
               friction: 0.925,
               platformWidth: 250,
               centerZoneSize: 45,
               minTimeInCenter: 10,
               redZones: [
                  { start: -100, end: -60 },
                  { start: 60, end: 100 },
               ],
            };
         case 8: // Level 9 - Red Zones
            return {
               ...baseConfig,
               maxAngle: 28,
               gravity: 1600,
               friction: 0.92,
               platformWidth: 240,
               centerZoneSize: 40,
               minTimeInCenter: 11,
               redZones: [
                  { start: -90, end: -50 },
                  { start: 50, end: 90 },
               ],
            };
         case 9: // Level 10 - Red Zones + Shrinking
            return {
               ...baseConfig,
               maxAngle: 30,
               gravity: 1700,
               friction: 0.915,
               platformWidth: 230,
               centerZoneSize: 35,
               minTimeInCenter: 12,
               shrinkingPlatform: true,
               redZones: [
                  { start: -85, end: -45 },
                  { start: 45, end: 85 },
               ],
            };
         case 10: // Level 11 - Platform Shake
            return {
               ...baseConfig,
               maxAngle: 32,
               gravity: 1800,
               friction: 0.91,
               platformWidth: 220,
               centerZoneSize: 30,
               minTimeInCenter: 13,
               platformShake: true,
               shakeInterval: 8, // seconds
            };
         case 11: // Level 12 - Platform Shake
            return {
               ...baseConfig,
               maxAngle: 34,
               gravity: 1900,
               friction: 0.905,
               platformWidth: 210,
               centerZoneSize: 25,
               minTimeInCenter: 14,
               platformShake: true,
               shakeInterval: 6, // seconds
            };
         case 12: // Level 13 - Wind Zones
            return {
               ...baseConfig,
               maxAngle: 36,
               gravity: 2000,
               friction: 0.9,
               platformWidth: 200,
               centerZoneSize: 20,
               minTimeInCenter: 15,
               windZones: [
                  { start: -80, end: -40, force: 50 },
                  { start: 40, end: 80, force: -50 },
               ],
            };
         case 13: // Level 14 - Wind Zones + Shake
            return {
               ...baseConfig,
               maxAngle: 38,
               gravity: 2100,
               friction: 0.895,
               platformWidth: 190,
               centerZoneSize: 15,
               minTimeInCenter: 16,
               platformShake: true,
               shakeInterval: 5,
               windZones: [
                  { start: -75, end: -35, force: 60 },
                  { start: 35, end: 75, force: -60 },
               ],
            };
         case 14: // Level 15: Ultimate challenge - All features
            return {
               ...baseConfig,
               maxAngle: 40,
               gravity: 2200,
               friction: 0.89,
               platformWidth: 180,
               centerZoneSize: 10,
               minTimeInCenter: 18,
               shrinkingPlatform: true,
               redZones: [
                  { start: -70, end: -30 },
                  { start: 30, end: 70 },
               ],
               platformShake: true,
               shakeInterval: 4,
               windZones: [
                  { start: -65, end: -25, force: 70 },
                  { start: 25, end: 65, force: -70 },
               ],
            };
         default:
            return {
               ...baseConfig,
               maxAngle: 18,
               gravity: 1200,
               friction: 0.94,
               platformWidth: 320,
               centerZoneSize: 60,
               minTimeInCenter: 5,
            };
      }
   }, []);

   // Get level configuration based on level number
   const getLevelConfig = useCallback(
      (level: number) => {
         // Try to get config from levelRequirements first
         if (levelRequirements && levelRequirements[level]) {
            const req = levelRequirements[level];
            // Get base physics config from hardcoded values
            const basePhysics = getBasePhysicsConfig(level);
            return {
               ...basePhysics,
               minTimeInCenter:
                  req.minTimeInCenter || basePhysics.minTimeInCenter,
               // Special features from config
               shrinkingPlatform:
                  req.shrinkingPlatform !== undefined
                     ? req.shrinkingPlatform
                     : basePhysics.shrinkingPlatform,
               redZones:
                  req.redZones && req.redZones.length > 0
                     ? req.redZones
                     : basePhysics.redZones,
               platformShake:
                  req.platformShake !== undefined
                     ? req.platformShake
                     : basePhysics.platformShake,
               shakeInterval: req.shakeInterval || basePhysics.shakeInterval,
               shakeIntensity:
                  req.shakeIntensity !== undefined
                     ? req.shakeIntensity
                     : basePhysics.shakeIntensity,
               shakeDuration:
                  req.shakeDuration !== undefined
                     ? req.shakeDuration
                     : basePhysics.shakeDuration,
               shakeFrequency:
                  req.shakeFrequency !== undefined
                     ? req.shakeFrequency
                     : basePhysics.shakeFrequency,
               shakeAngle:
                  req.shakeAngle !== undefined
                     ? req.shakeAngle
                     : basePhysics.shakeAngle,
               windZones:
                  req.windZones && req.windZones.length > 0
                     ? req.windZones
                     : basePhysics.windZones,
               shrinkMinScale:
                  req.shrinkMinScale !== undefined
                     ? req.shrinkMinScale
                     : basePhysics.shrinkMinScale,
               shrinkDelay:
                  req.shrinkDelay !== undefined
                     ? req.shrinkDelay
                     : basePhysics.shrinkDelay,
            };
         }

         // Fallback to hardcoded config
         return getBasePhysicsConfig(level);
      },
      [levelRequirements, getBasePhysicsConfig]
   );

   // Get minimum time in center required for current level
   const getMinTimeInCenter = useCallback(() => {
      if (levelRequirements && levelRequirements[currentLevel]) {
         return (
            levelRequirements[currentLevel].minTimeInCenter ||
            getLevelConfig(currentLevel).minTimeInCenter
         );
      }
      return getLevelConfig(currentLevel).minTimeInCenter;
   }, [currentLevel, levelRequirements, getLevelConfig]);

   // End level (failed)
   const endLevel = useCallback(() => {
      clearAll();
      gameStateRef.current = "failed";
      setGameState("failed");
   }, [clearAll]);

   // Start level
   const startLevel = useCallback(() => {
      clearAll();

      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      setTimeInCenter(0);
      setTimeInRedZone(0);
      setPlatformShake(0);
      platformShakeRef.current = 0;
      platformShakeAngleRef.current = 0;
      lastShakeCycleRef.current = -1;
      shakeBiasRef.current = 0;
      activeWindIndexRef.current = null;
      setActiveWindIndex(null);
      setPlatformScale(1);
      const startTime = Date.now();
      levelStartTimeRef.current = startTime;

      const config = getLevelConfig(currentLevel);
      // More challenging: slower response (lower lerp = more inertia/delay)
      // Level 1: 0.12, Level 15: 0.08 (more challenging at higher levels)
      const ANGLE_LERP = Math.max(0.08, 0.12 - currentLevel * 0.003);
      const BALL_RADIUS = 14;

      // Initialize platform width (will shrink if enabled)
      const initialPlatformWidth = config.platformWidth;
      initialPlatformWidthRef.current = initialPlatformWidth;
      currentPlatformWidthRef.current = initialPlatformWidth;
      setCurrentPlatformWidth(initialPlatformWidth);
      setInitialPlatformWidth(initialPlatformWidth);
      const PLATFORM_HALF_WIDTH = initialPlatformWidth / 2;

      // Initialize special features
      setRedZones(config.redZones || []);
      const initialWindZones = config.windZones || [];
      setWindZones(initialWindZones);
      if (initialWindZones.length > 0) {
         const startIndex = Math.floor(Math.random() * initialWindZones.length);
         activeWindIndexRef.current = startIndex;
         setActiveWindIndex(startIndex);
         nextWindSwitchTimeRef.current =
            Date.now() + 1500 + Math.random() * 1500;
      } else {
         activeWindIndexRef.current = null;
         setActiveWindIndex(null);
      }

      // Random starting position - more challenging, not always in center
      // At higher levels, start further from center for more challenge
      const maxOffset = PLATFORM_HALF_WIDTH - BALL_RADIUS - 10; // Leave some margin
      const difficultyMultiplier = 0.3 + (currentLevel / 15) * 0.5; // 0.3 at L1, 0.8 at L15
      const randomOffset =
         (Math.random() * 2 - 1) * maxOffset * difficultyMultiplier;

      // Also add small random initial velocity for extra challenge
      const initialVelocity = (Math.random() * 2 - 1) * (10 + currentLevel * 2); // -10 to +10 at L1, -40 to +40 at L15

      ballXRef.current = randomOffset;
      ballVRef.current = initialVelocity;
      targetAngleRef.current = 0;
      angleRef.current = 0;
      setBallX(randomOffset);
      setBallV(initialVelocity);
      setTargetAngle(0);
      setAngle(0);
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      setGameState("playing");
      setRequirementsMet(false);
      lastTimestampRef.current = 0;

      // Start countdown timer
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

      // Start animation loop
      const animate = (ts: number) => {
         if (gameStateRef.current !== "playing" || requirementsMetRef.current) {
            return;
         }

         if (!lastTimestampRef.current) lastTimestampRef.current = ts;
         const dt = Math.min(0.032, (ts - lastTimestampRef.current) / 1000);
         lastTimestampRef.current = ts;

         // Get current config (may have changed due to shrinking)
         const currentConfig = getLevelConfig(currentLevel);

         // Update platform width if shrinking
         if (currentConfig.shrinkingPlatform) {
            const elapsed = (Date.now() - levelStartTimeRef.current) / 1000;
            const levelDur = getLevelDuration(currentLevel);
            const shrinkDelay = Math.max(0, currentConfig.shrinkDelay || 0);
            const effectiveElapsed = Math.max(0, elapsed - shrinkDelay);
            const shrinkProgress = Math.min(1, effectiveElapsed / levelDur);
            const baseWidth =
               initialPlatformWidthRef.current || currentConfig.platformWidth;
            const minScale =
               currentConfig.shrinkMinScale !== undefined
                  ? currentConfig.shrinkMinScale
                  : 0.6;
            const minWidth = baseWidth * minScale;
            const newWidth =
               baseWidth - (baseWidth - minWidth) * shrinkProgress;
            currentPlatformWidthRef.current = newWidth;
            setCurrentPlatformWidth(newWidth);
            setPlatformScale(baseWidth > 0 ? newWidth / baseWidth : 1);
         }

         // Platform shake effect
         if (currentConfig.platformShake && currentConfig.shakeInterval) {
            const elapsed = (Date.now() - levelStartTimeRef.current) / 1000;
            const shakeDuration = Math.min(
               currentConfig.shakeDuration,
               currentConfig.shakeInterval
            );
            const cycleTime = elapsed % currentConfig.shakeInterval;
            const cycleIndex = Math.floor(
               elapsed / currentConfig.shakeInterval
            );
            if (cycleIndex !== lastShakeCycleRef.current) {
               lastShakeCycleRef.current = cycleIndex;
               shakeBiasRef.current = Math.random() * 2 - 1;
            }
            let shakeOffset = 0;
            let shakeAngle = 0;

            if (cycleTime <= shakeDuration) {
               const fadeOut = 1 - cycleTime / shakeDuration;
               const primaryWave =
                  Math.sin(
                     elapsed * currentConfig.shakeFrequency * Math.PI * 2
                  ) * 0.7;
               const secondaryWave =
                  Math.sin(elapsed * currentConfig.shakeFrequency * Math.PI) *
                  0.3;
               shakeOffset =
                  (primaryWave + secondaryWave) *
                  currentConfig.shakeIntensity *
                  fadeOut;
               shakeAngle =
                  (primaryWave + secondaryWave) *
                     currentConfig.shakeAngle *
                     fadeOut +
                  shakeBiasRef.current *
                     currentConfig.shakeAngle *
                     0.6 *
                     fadeOut;
            }

            platformShakeRef.current = shakeOffset;
            platformShakeAngleRef.current = shakeAngle;
            setPlatformShake(shakeOffset);
         } else if (platformShakeRef.current !== 0) {
            platformShakeRef.current = 0;
            platformShakeAngleRef.current = 0;
            lastShakeCycleRef.current = -1;
            shakeBiasRef.current = 0;
            setPlatformShake(0);
         }

         // Get current platform half width (may have shrunk)
         const currentHalfWidth = currentPlatformWidthRef.current / 2;

         // Smooth angle toward target (with shake)
         const shakeAngle = platformShakeAngleRef.current;
         angleRef.current +=
            (targetAngleRef.current - angleRef.current) * ANGLE_LERP;
         const effectiveAngle = angleRef.current + shakeAngle;
         setAngle(effectiveAngle);

         // Update ball physics
         // Acceleration along platform from gravity component
         const a =
            Math.sin((effectiveAngle * Math.PI) / 180) * currentConfig.gravity;
         ballVRef.current = ballVRef.current + a * dt;
         ballVRef.current =
            ballVRef.current * Math.pow(currentConfig.friction, dt * 60);

         // Wind zones effect
         const windConfig = currentConfig.windZones || [];
         if (windConfig.length > 0) {
            const now = Date.now();
            if (now >= nextWindSwitchTimeRef.current) {
               const nextIndex =
                  windConfig.length === 1
                     ? 0
                     : Math.floor(Math.random() * windConfig.length);
               activeWindIndexRef.current = nextIndex;
               setActiveWindIndex(nextIndex);
               nextWindSwitchTimeRef.current =
                  now + 1500 + Math.random() * 1500;
            }
         } else if (activeWindIndexRef.current !== null) {
            activeWindIndexRef.current = null;
            setActiveWindIndex(null);
         }

         let windForce = 0;
         const activeIndex = activeWindIndexRef.current;
         if (activeIndex !== null && windConfig[activeIndex]) {
            windForce = windConfig[activeIndex].force;
         }
         ballVRef.current = ballVRef.current + windForce * dt;

         ballXRef.current = ballXRef.current + ballVRef.current * dt;
         setBallX(ballXRef.current);
         setBallV(ballVRef.current);

         // Check if ball is in center zone
         if (Math.abs(ballXRef.current) <= currentConfig.centerZoneSize / 2) {
            setTimeInCenter((prev) => prev + dt);
         }

         // Check red zones (danger zones)
         let inRedZone = false;
         for (const zone of currentConfig.redZones || []) {
            if (
               ballXRef.current >= zone.start &&
               ballXRef.current <= zone.end
            ) {
               inRedZone = true;
               setTimeInRedZone((prev) => {
                  const newTime = prev + dt;
                  if (newTime >= 1.0) {
                     // Game over if in red zone for 1 second
                     endLevel();
                  }
                  return newTime;
               });
               break;
            }
         }
         if (!inRedZone) {
            setTimeInRedZone(0);
         }

         // Bounds check: if ball leaves platform, lose
         if (
            ballXRef.current < -(currentHalfWidth - BALL_RADIUS) ||
            ballXRef.current > currentHalfWidth - BALL_RADIUS
         ) {
            endLevel();
            return;
         }

         animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);
   }, [currentLevel, getLevelDuration, getLevelConfig, clearAll, endLevel]);

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Check if requirements are met
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const minTimeInCenter = getMinTimeInCenter();

      if (timeInCenter >= minTimeInCenter) {
         // IMMEDIATELY freeze game
         clearAll();
         setTimeLeft(0);

         requirementsMetRef.current = true;
         setRequirementsMet(true);
         setGameState("paused");
      }
   }, [timeInCenter, gameState, requirementsMet, getMinTimeInCenter, clearAll]);

   // When timer reaches 0 and requirements are met
   useEffect(() => {
      if (timeLeft === 0 && requirementsMet && gameState === "paused") {
         setGameState("ready");
         if (currentLevel + 1 < maxLevels) {
            const roundScore = Math.round(100 / maxLevels);
            const completedLevels = currentLevel + 1;
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            onScoreUpdate(newScore);
         }
      }
   }, [
      timeLeft,
      requirementsMet,
      gameState,
      currentLevel,
      maxLevels,
      onScoreUpdate,
   ]);

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

   // Auto-complete when final level is ready
   useEffect(() => {
      if (
         gameState === "ready" &&
         currentLevel + 1 >= maxLevels &&
         !completionCalledRef.current
      ) {
         finalizeGame();
      }
   }, [gameState, currentLevel, maxLevels, finalizeGame]);

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
         requirementsMetRef.current = false;
         setRequirementsMet(false);
         gameStateRef.current = "playing";
         setGameState("playing");
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
      setTimeInCenter(0);
      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      clearAll();
      startLevel();
      setReplaysUsed((prev) => prev + 1);
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

   // Handle mouse/touch input for platform tilt
   // More challenging: add deadzone, reduce sensitivity, and add smoothing
   const setTiltFromClientX = useCallback(
      (clientX: number) => {
         if (!arenaRef.current || gameState !== "playing" || requirementsMet)
            return;

         const rect = arenaRef.current.getBoundingClientRect();
         const normalizedX =
            (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
         const config = getLevelConfig(currentLevel);

         // More challenging: deadzone in center (small movements ignored)
         // Higher levels = larger deadzone = more challenging
         const deadzone = 0.05 + currentLevel * 0.003; // 5% at level 1, ~10% at level 15
         let x = normalizedX;

         // Apply deadzone (ignore small movements near center)
         if (Math.abs(x) < deadzone) {
            x = 0; // No tilt for small movements
         } else {
            // Scale remaining movement after deadzone
            const sign = x > 0 ? 1 : -1;
            x = sign * ((Math.abs(x) - deadzone) / (1 - deadzone));
         }

         // More challenging: reduce sensitivity (multiply by 0.75-0.90 based on level)
         const sensitivity = Math.max(0.7, 0.9 - currentLevel * 0.015);
         const targetAngleValue = x * config.maxAngle * sensitivity;

         const clampedAngle = Math.max(
            -config.maxAngle,
            Math.min(config.maxAngle, targetAngleValue)
         );

         // Smooth transition to target (adds challenge via inertia)
         targetAngleRef.current = clampedAngle;
         setTargetAngle(clampedAngle);
      },
      [gameState, requirementsMet, currentLevel, getLevelConfig]
   );

   // Mouse events
   useEffect(() => {
      if (!arenaRef.current) return;
      const arena = arenaRef.current;

      const handleMouseMove = (e: MouseEvent) => {
         if (gameState !== "playing" || requirementsMet) return;
         setTiltFromClientX(e.clientX);
      };

      const handleMouseDown = (e: MouseEvent) => {
         if (gameState !== "playing" || requirementsMet) return;
         setIsInteracting(true);
         setTiltFromClientX(e.clientX);
      };

      const handleMouseUp = () => {
         setIsInteracting(false);
      };

      const handleMouseLeave = () => {
         setIsInteracting(false);
      };

      arena.addEventListener("mousemove", handleMouseMove);
      arena.addEventListener("mousedown", handleMouseDown);
      arena.addEventListener("mouseup", handleMouseUp);
      arena.addEventListener("mouseleave", handleMouseLeave);

      return () => {
         arena.removeEventListener("mousemove", handleMouseMove);
         arena.removeEventListener("mousedown", handleMouseDown);
         arena.removeEventListener("mouseup", handleMouseUp);
         arena.removeEventListener("mouseleave", handleMouseLeave);
      };
   }, [gameState, requirementsMet, setTiltFromClientX]);

   // Touch events
   useEffect(() => {
      if (!arenaRef.current) return;
      const arena = arenaRef.current;

      const handleTouchStart = (e: TouchEvent) => {
         if (gameState !== "playing" || requirementsMet) return;
         if (e.touches && e.touches[0]) {
            setIsInteracting(true);
            setTiltFromClientX(e.touches[0].clientX);
         }
      };

      const handleTouchMove = (e: TouchEvent) => {
         if (gameState !== "playing" || requirementsMet) return;
         if (e.touches && e.touches[0]) {
            setTiltFromClientX(e.touches[0].clientX);
         }
      };

      const handleTouchEnd = () => {
         setIsInteracting(false);
      };

      arena.addEventListener("touchstart", handleTouchStart, { passive: true });
      arena.addEventListener("touchmove", handleTouchMove, { passive: true });
      arena.addEventListener("touchend", handleTouchEnd, { passive: true });

      return () => {
         arena.removeEventListener("touchstart", handleTouchStart);
         arena.removeEventListener("touchmove", handleTouchMove);
         arena.removeEventListener("touchend", handleTouchEnd);
      };
   }, [gameState, requirementsMet, setTiltFromClientX]);

   // Keyboard controls for arrow keys
   // More challenging: smaller steps and key repeat delay
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const handleKeyPress = (e: KeyboardEvent) => {
         // Prevent default for game controls
         if (
            e.key.startsWith("Arrow") ||
            ["a", "A", "d", "D"].includes(e.key)
         ) {
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
               e.preventDefault();
            }
         }

         const config = getLevelConfig(currentLevel);
         // More challenging: smaller steps (6-10% instead of 15%)
         // Higher levels = smaller steps = more challenging
         const baseStep = 0.1 - currentLevel * 0.0025;
         const angleStep = config.maxAngle * Math.max(0.05, baseStep);

         // Key repeat delay for more challenge (prevents spam)
         // Higher levels = longer delay = more challenging
         const now = Date.now();
         const key = e.key.toLowerCase();
         const lastPress = lastKeyPressRef.current[key] || 0;
         const minDelay = 100 + currentLevel * 5; // 100ms at level 1, 170ms at level 15

         if (now - lastPress < minDelay) {
            return; // Ignore rapid key presses
         }

         lastKeyPressRef.current[key] = now;

         if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
            // Tilt left
            const newAngle = Math.max(
               -config.maxAngle,
               targetAngleRef.current - angleStep
            );
            targetAngleRef.current = newAngle;
            setTargetAngle(newAngle);
         } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
            // Tilt right
            const newAngle = Math.min(
               config.maxAngle,
               targetAngleRef.current + angleStep
            );
            targetAngleRef.current = newAngle;
            setTargetAngle(newAngle);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [gameState, requirementsMet, currentLevel, getLevelConfig]);

   // Share functionality
   // Share functionality
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "ball-balance");
         const gameKey = "play50games_shared_ball-balance";
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
               title: "Ball Balance Game",
               text: "Check out this awesome Ball Balance game!",
               url: shareableLink,
            });
            setShareSuccess(true);
            if (shareSuccessTimeoutRef.current) {
               clearTimeout(shareSuccessTimeoutRef.current);
            }
            shareSuccessTimeoutRef.current = setTimeout(
               () => setShareSuccess(false),
               15000
            );
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
         if (shareSuccessTimeoutRef.current) {
            clearTimeout(shareSuccessTimeoutRef.current);
         }
         shareSuccessTimeoutRef.current = setTimeout(
            () => setShareSuccess(false),
            15000
         );
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
            if (shareSuccessTimeoutRef.current) {
               clearTimeout(shareSuccessTimeoutRef.current);
            }
            shareSuccessTimeoutRef.current = setTimeout(
               () => setShareSuccess(false),
               15000
            );
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
         const gameKey = "play50games_shared_ball-balance";
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
      const gameKey = "play50games_shared_ball-balance";
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

   const levelConfig = getLevelConfig(currentLevel);
   const progress = ((currentLevel + 1) / maxLevels) * 100;
   const minTimeInCenter = getMinTimeInCenter();
   const activeWind =
      activeWindIndex !== null ? windZones[activeWindIndex] : null;
   const windStatus = activeWind
      ? activeWind.force < 0
         ? "Wind Left Active"
         : "Wind Right Active"
      : null;

   const replayLocked = maxReplays > 0 && replaysUsed >= maxReplays;
   const ballInCenter = Math.abs(ballX) <= levelConfig.centerZoneSize / 2;

   return (
      <div ref={rootRef} className={ui.root}>
         {/* Header Section */}
         <div className={ui.hud}>
            <div className={ui.hudRow}>
               <span className={ui.hudStat}>
                  <ArrowPathIcon className={ui.hudIcon} />
                  Level {currentLevel + 1} / {maxLevels}
               </span>
               <span className={ui.hudStat}>
                  <TrophyIcon className={ui.hudIconOk} />
                  Score:{" "}
                  <span key={currentScore} className={ui.bump}>
                     {currentLevel + 1 >= maxLevels && gameState === "ready"
                        ? 100
                        : currentScore}
                  </span>{" "}
                  / 100
               </span>
               <span
                  className={`${ui.hudStat} ${gameState === "playing" && timeLeft <= 5 ? ui.hudLow : ""}`}
               >
                  <ClockIcon className={ui.hudIconAccent} />
                  Time: {timeLeft}s
               </span>
            </div>
            <div className={ui.progressTrack}>
               <div
                  className={ui.progressFill}
                  style={{ transform: `scaleX(${progress / 100})` }}
               />
            </div>
         </div>

         {/* Arena */}
         {(gameState === "playing" || gameState === "paused") && (
            <div
               ref={arenaRef}
               className={`${ui.arena} ${bb.arena} ${touch.playArea}`}
               data-play-area=""
               style={{
                  height: isMobile ? "300px" : "380px",
                  touchAction: "none",
                  cursor:
                     gameState === "playing" && !requirementsMet
                        ? isInteracting
                           ? "grabbing"
                           : "grab"
                        : "default",
                  pointerEvents:
                     gameState === "playing" && !requirementsMet
                        ? "auto"
                        : "none",
               }}
            >
               {windStatus && <div className={bb.windPill}>{windStatus}</div>}

               {/* Red Zones (Danger Zones) */}
               {redZones.map((zone, idx) => (
                  <div
                     key={`red-zone-${idx}`}
                     className={timeInRedZone > 0.5 ? bb.dangerZoneHot : bb.dangerZone}
                     style={{
                        width: `${zone.end - zone.start}px`,
                        transform: `translate(calc(-50% + ${
                           (zone.start + zone.end) / 2
                        }px), -50%)`,
                     }}
                  />
               ))}

               {/* Wind Zones */}
               {windZones.map((zone, idx) => (
                  <div
                     key={`wind-zone-${idx}`}
                     className={idx === activeWindIndex ? bb.windZoneActive : bb.windZone}
                     style={{
                        width: `${zone.end - zone.start}px`,
                        transform: `translate(calc(-50% + ${
                           (zone.start + zone.end) / 2
                        }px), -50%)`,
                     }}
                  >
                     {/* Wind arrow indicator */}
                     <div
                        className={bb.windArrow}
                        style={{
                           transform: `translateX(-50%) rotate(${
                              zone.force > 0 ? 0 : 180
                           }deg)`,
                        }}
                     >
                        →
                     </div>
                  </div>
               ))}

               {/* Center Zone */}
               <div
                  className={ballInCenter ? bb.centerZoneIn : bb.centerZone}
                  style={{
                     width: `${levelConfig.centerZoneSize}px`,
                     transform: "translate(-50%, -50%)",
                  }}
               />

               {/* Platform (width follows the physics ref at once: no width transition) */}
               <div
                  className={bb.platform}
                  style={{
                     width: `${currentPlatformWidth}px`,
                     transform: `translate(calc(-50% + ${platformShake}px), -50%) rotate(${angle}deg) scaleX(${platformScale})`,
                  }}
               />

               {/* Ball */}
               <div
                  className={bb.ball}
                  style={{
                     transform: `translate(calc(-50% + ${ballX}px), calc(-50% - 22px))`,
                  }}
               />

               {/* Game State Message */}
               {gameState === "playing" && (
                  <div className={bb.message}>Keep ball in center zone!</div>
               )}

               {/* Paused Message (Requirements Met, Waiting for Timer) */}
               {gameState === "paused" && (
                  <div className={bb.overlay}>
                     <div className={ui.card}>
                        <div className={`${ui.cardTitleOk} ${bb.titleRow}`}>
                           <CheckCircleIcon className={bb.titleIcon} />
                           Requirements Met
                        </div>
                        <div className={ui.cardBody}>
                           Waiting for timer... <strong>{timeLeft}s</strong> remaining
                        </div>
                     </div>
                  </div>
               )}
            </div>
         )}

         {/* Ready for Next Round Message */}
         {gameState === "ready" && currentLevel + 1 < maxLevels && (
            <div className={ui.card}>
               <div className={`${ui.cardTitleOk} ${bb.titleRow}`}>
                  <CheckCircleIcon className={bb.titleIcon} />
                  Level {currentLevel + 1} Complete
               </div>
               <div className={ui.cardBody}>Are you ready for next round?</div>
               <button className={ui.buttonPrimary} onClick={handleNextRound}>
                  Next Round
               </button>
            </div>
         )}

         {/* Game Complete Message */}
         {gameState === "ready" && currentLevel + 1 >= maxLevels && (
            <div className={ui.card}>
               <div className={`${ui.cardTitleOk} ${bb.titleRow}`}>
                  <TrophyIcon className={bb.titleIcon} />
                  Game Complete!
               </div>
               <div className={ui.cardBody}>All {maxLevels} levels completed!</div>
               <div className={ui.cardBody}>
                  Final Score:{" "}
                  <strong>{currentLevel + 1 >= maxLevels ? 100 : currentScore}</strong>
               </div>
            </div>
         )}

         {/* Level Failed Message */}
         {gameState === "failed" && (
            <div className={ui.card}>
               <div className={`${ui.cardTitleWarn} ${bb.titleRow}`}>
                  <XCircleIcon className={bb.titleIcon} />
                  Level {currentLevel + 1} Failed
               </div>
               <div className={ui.cardBody}>
                  Need: <strong>{minTimeInCenter}s</strong> in center zone
               </div>
               <div className={ui.cardBody}>
                  You had: <strong>{timeInCenter.toFixed(1)}s</strong>
               </div>
            </div>
         )}

         {/* Stats */}
         {(gameState === "playing" || gameState === "paused") && (
            <div className={ui.statRow}>
               <div className={ballInCenter ? ui.statOk : ui.stat}>
                  Center Time: {timeInCenter.toFixed(1)}s / {minTimeInCenter}s
               </div>
               <div className={ui.stat}>Angle: {Math.round(angle)}°</div>
            </div>
         )}

         {/* Action Buttons: Replay, Share */}
         {(gameState === "playing" || gameState === "failed") && (
            <div className={ui.actions}>
               {/* Share Success Message */}
               {shareSuccess && !unlimitedActivated && (
                  <div className={ui.notice}>
                     Link copied! Unlimited replay will unlock when someone
                     opens your link!
                  </div>
               )}

               {/* Unlimited Activated Message */}
               {unlimitedActivated && (
                  <div className={ui.notice}>
                     <CheckCircleIcon className={ui.noticeIcon} />
                     <span>
                        Someone opened your link! Unlimited replay is now
                        active for 15 minutes!
                     </span>
                  </div>
               )}

               <button
                  className={ui.button}
                  onClick={handleReplay}
                  disabled={replayLocked}
               >
                  <ArrowPathRoundedSquareIcon className={ui.buttonIcon} />
                  <span>
                     {"Replay "}
                     {maxReplays === 0
                        ? "(∞)"
                        : `(${maxReplays - replaysUsed}/${maxReplays})`}
                  </span>
               </button>

               <button className={ui.button} onClick={handleShare}>
                  <ShareIcon className={ui.buttonIcon} />
                  <span>Share for unlimited</span>
               </button>
            </div>
         )}
         {pad > 0 && <div aria-hidden="true" style={{ height: pad, flexShrink: 0 }} />}
      </div>
   );
}
