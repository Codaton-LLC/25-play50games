"use client";

// The <Canvas> part of GameShell: renderer settings, adaptive resolution, environment, run clock,
// input latch, lazy Rapier physics and the game's Scene (remounted for every run via runId).
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import type { GameDefinition } from "./types";
import { arcadeStore, useArcadeStore } from "./useArcadeStore";
import { clampFrameDt } from "./useRunFrame";
import { InputLatch } from "./input";
import CameraRig from "./CameraRig";

/** Rapier (and its WASM) is a separate chunk, fetched only by games with `physics: true`. */
const RapierPhysics = lazy(() => import("@react-three/rapier").then((mod) => ({ default: mod.Physics })));

const MAX_DPR = 1.75;
const LOW_DPR = 1;

type Environment = NonNullable<GameDefinition["environment"]>;
const DEFAULT_ENVIRONMENT: Environment = { background: "#0b1020", lighting: "day" };

/** Advances the countdown and the run timer once per frame (before game callbacks). */
function RunClock() {
   useFrame((_state, delta) => arcadeStore.getState().tick(clampFrameDt(delta) * 1000), -1);
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
         <PerformanceMonitor
            flipflops={3}
            onDecline={() => setMaxDpr(LOW_DPR)}
            onIncline={() => setMaxDpr(MAX_DPR)}
            onFallback={() => setMaxDpr(LOW_DPR)}
         />
         <SceneEnvironment environment={environment} />
         <CameraRig camera={camera} />
         <InputLatch />
         <RunClock />
         <Suspense fallback={null}>
            <PhysicsGate enabled={!!physics}>
               <Scene key={runId} />
            </PhysicsGate>
            <ReadySignal />
         </Suspense>
      </Canvas>
   );
}
