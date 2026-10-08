"use client";

// The <Canvas> part of GameShell: renderer settings, adaptive resolution, environment, run clock,
// input latch, lazy Rapier physics and the game's Scene (remounted for every run via runId, with
// a fresh useGameTime clock and a fresh effects layer, core/fx), the quality tier (core/quality.ts)
// and, with ?perf=1 in the URL, the perf probe (core/perfProbe.tsx). Frame order: core/frameLoop.ts
// FRAME_PRIORITY.
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import type { GameDefinition } from "./types";
import { arcadeStore, useArcadeStore } from "./useArcadeStore";
import { FRAME_PRIORITY, advanceRunClock } from "./frameLoop";
import { GameTimeProvider } from "./gameTime";
import { InputLatch } from "./input";
import CameraRig from "./CameraRig";
import { QualityProvider, qualityFor } from "./quality";
import { useCoarsePointer } from "./TouchControls";
import { FxLayer } from "./fx/FxLayer";
import PerfProbe, { perfProbeRequested } from "./perfProbe";

/** Rapier (and its WASM) is a separate chunk, fetched only by games with `physics: true`. */
const RapierPhysics = lazy(() => import("@react-three/rapier").then((mod) => ({ default: mod.Physics })));

const MAX_DPR = 1.75;
const LOW_DPR = 1;
/**
 * After this many slow periods the device stays at LOW_DPR (no more resizes back and forth).
 * Counted here because drei's own `flipflops` also counts inclines, so a steady 60/120 fps device
 * would hit its fallback after ~11 s and be locked to the low resolution.
 */
const MAX_DECLINES = 3;

type Environment = NonNullable<GameDefinition["environment"]>;
const DEFAULT_ENVIRONMENT: Environment = { background: "#0b1020", lighting: "day" };

/** Advances the countdown and the run timer once per frame (before game callbacks). */
function RunClock() {
   useFrame((_state, delta) => advanceRunClock(arcadeStore, delta), FRAME_PRIORITY.clock);
   return null;
}

/** Mounted once the scene (and every model it suspends on) has loaded: "loading" -> "ready". */
function ReadySignal() {
   useEffect(() => {
      arcadeStore.getState().markReady();
      // GameShell may re-configure (back to "loading") after the scene is already up
      return arcadeStore.subscribe((state) => {
         if (state.phase === "loading") state.markReady();
      });
   }, []);
   return null;
}

function Lights({ preset }: { preset: Environment["lighting"] }) {
   switch (preset) {
      case "indoor":
         return (
            <>
               <ambientLight intensity={0.35} />
               <hemisphereLight args={["#fff7ed", "#1e293b", 0.9]} />
               <directionalLight position={[3, 8, 2]} intensity={1.1} color="#fde68a" />
            </>
         );
      case "night":
         return (
            <>
               <ambientLight intensity={0.15} />
               <hemisphereLight args={["#1e3a8a", "#020617", 0.55]} />
               <directionalLight position={[-4, 8, 2]} intensity={0.75} color="#c7d2fe" />
            </>
         );
      case "sunset":
         return (
            <>
               <ambientLight intensity={0.25} />
               <hemisphereLight args={["#fed7aa", "#3b0764", 0.85]} />
               <directionalLight position={[-8, 4, 3]} intensity={1.5} color="#fdba74" />
            </>
         );
      case "snow":
         return (
            <>
               <ambientLight intensity={0.35} />
               <hemisphereLight args={["#f0f9ff", "#94a3b8", 1.05]} />
               <directionalLight position={[4, 9, 3]} intensity={1.2} color="#e0f2fe" />
            </>
         );
      case "space":
         return (
            <>
               <ambientLight intensity={0.1} />
               <hemisphereLight args={["#a5b4fc", "#020617", 0.35]} />
               <directionalLight position={[6, 6, 8]} intensity={2} color="#ffffff" />
            </>
         );
      case "day":
      default:
         return (
            <>
               <ambientLight intensity={0.2} />
               <hemisphereLight args={["#e0f2fe", "#334155", 1.1]} />
               <directionalLight position={[6, 10, 4]} intensity={1.6} />
            </>
         );
   }
}

function SceneEnvironment({ environment }: { environment?: GameDefinition["environment"] }) {
   const env = environment ?? DEFAULT_ENVIRONMENT;
   return (
      <>
         <color attach="background" args={[env.background]} />
         {env.fog && <fog attach="fog" args={env.fog} />}
         <Lights preset={env.lighting} />
      </>
   );
}

function PhysicsGate({ enabled, children }: { enabled: boolean; children: ReactNode }) {
   const paused = useArcadeStore((state) => state.phase !== "playing");
   if (!enabled) return <>{children}</>;
   return <RapierPhysics paused={paused}>{children}</RapierPhysics>;
}

export interface ShellStageProps {
   definition: GameDefinition;
   /** "demand" while paused (still redraws on resize), "never" after a lost context */
   frameloop: "always" | "demand" | "never";
   onContextLost: () => void;
   label: string;
}

export default function ShellStage({ definition, frameloop, onContextLost, label }: ShellStageProps) {
   const { Scene, camera, environment, physics } = definition;
   const runId = useArcadeStore((state) => state.runId);
   const [maxDpr, setMaxDpr] = useState(MAX_DPR);
   const declinesRef = useRef(0);
   // the quality tier only goes down: every decline counts, inclines do not undo it
   const [declines, setDeclines] = useState(0);
   const coarsePointer = useCoarsePointer();
   const quality = useMemo(() => qualityFor({ declines, coarsePointer }), [declines, coarsePointer]);
   // ?perf=1, read once (ShellStage mounts on the client only)
   const [perf] = useState(perfProbeRequested);
   const onDecline = useCallback(() => {
      declinesRef.current += 1;
      setMaxDpr(LOW_DPR);
      setDeclines(declinesRef.current);
   }, []);
   const onIncline = useCallback(() => {
      if (declinesRef.current < MAX_DECLINES) setMaxDpr(MAX_DPR);
   }, []);

   const lostRef = useRef(onContextLost);
   lostRef.current = onContextLost;
   const canvasRef = useRef<HTMLCanvasElement | null>(null);
   const onLost = useCallback((event: Event) => {
      event.preventDefault();
      lostRef.current();
   }, []);

   const handleCreated = useCallback(
      (state: RootState) => {
         canvasRef.current = state.gl.domElement;
         state.gl.domElement.addEventListener("webglcontextlost", onLost);
      },
      [onLost]
   );

   useEffect(
      () => () => {
         canvasRef.current?.removeEventListener("webglcontextlost", onLost);
      },
      [onLost]
   );

   return (
      <Canvas
         dpr={[1, maxDpr]}
         camera={{ position: camera.position, fov: camera.fov ?? 50, near: 0.1, far: 400 }}
         gl={{ antialias: true, powerPreference: "high-performance" }}
         frameloop={frameloop}
         onCreated={handleCreated}
         aria-label={label}
         role="img"
      >
         <PerformanceMonitor onDecline={onDecline} onIncline={onIncline} />
         {perf && <PerfProbe />}
         <SceneEnvironment environment={environment} />
         <CameraRig camera={camera} />
         <InputLatch />
         <RunClock />
         <QualityProvider value={quality}>
            <Suspense fallback={null}>
               <PhysicsGate enabled={!!physics}>
                  <GameTimeProvider key={runId}>
                     {/* mounts nothing until the Scene uses an effect (core/fx) */}
                     <FxLayer>
                        <Scene />
                     </FxLayer>
                  </GameTimeProvider>
               </PhysicsGate>
               <ReadySignal />
            </Suspense>
         </QualityProvider>
      </Canvas>
   );
}
