// Runtime contracts for 3D Arcade games. Owned by Claude.
// Type-only imports of three/R3F are fine here (erased at build time).
import type { ComponentType } from "react";
import type { ArcadeGameMeta, ArcadeSlug } from "../types";

export type RunPhase = "loading" | "ready" | "countdown" | "playing" | "paused" | "over";
export type EndReason = "win" | "lose" | "timeup" | "quit";

export interface RunState {
   phase: RunPhase;
   score: number;
   level: number;
   /** null = game has no lives */
   lives: number | null;
   elapsedMs: number;
   /** null = no countdown timer */
   timeLeftMs: number | null;
   endReason: EndReason | null;
   /** free-form HUD counters, e.g. { batteries: 7 } */
   stats: Record<string, number>;
   /** increments on every restart; use it as a React key to reset a scene */
   runId: number;
}

export interface RunActions {
   start(): void;
   pause(): void;
   resume(): void;
   restart(): void;
   /** safe to call twice (React strict mode) */
   reset(): void;
   addScore(delta: number): void;
   setScore(value: number): void;
   setStat(key: string, value: number): void;
   incStat(key: string, delta?: number): void;
   setLevel(level: number): void;
   loseLife(): void;
   /** idempotent: only the first call ends the run */
   end(reason: EndReason): void;
}

/** Unified input, read from a ref inside useRunFrame (non-reactive). */
export interface InputState {
   /** -1..1 */
   moveX: number;
   /** -1..1, up = -1 */
   moveY: number;
   jump: boolean;
   action: boolean;
   /** true only on the frame the jump started */
   jumpPressed: boolean;
   swipe: "up" | "down" | "left" | "right" | null;
   /** normalised -1..1 canvas coordinates */
   pointer: { x: number; y: number; down: boolean };
}

export type PrimitiveFallback = "box" | "capsule" | "sphere" | "cylinder";

/** A GLB model (or a coloured primitive until the GLB exists). */
export interface ModelAsset {
   id: string;
   /** /models/3d/<slug|shared>/<id>.glb */
   url: string;
   scale?: number;
   rotationY?: number;
   yOffset?: number;
   rigged?: boolean;
   /** logical name -> clip name in the GLB, e.g. { run: "Run" } */
   animations?: Record<string, string>;
   fallback: PrimitiveFallback;
   fallbackColor?: string;
   budget: { tris: number; bytes: number };
}

export type TouchControl = "joystick" | "jump" | "action" | "swipe" | "tap";

export interface GameDefinition {
   slug: ArcadeSlug;
   /** rendered inside the <Canvas> */
   Scene: ComponentType;
   /** optional extra HUD rendered over the canvas (plain DOM) */
   Hud?: ComponentType;
   assets: Record<string, ModelAsset>;
   /** true = wrap the scene in lazy-loaded Rapier <Physics> */
   physics?: boolean;
   /** countdown length; omit for untimed games */
   durationMs?: number;
   lives?: number;
   camera: {
      position: [number, number, number];
      fov?: number;
      lookAt?: [number, number, number];
   };
   environment?: {
      background: string;
      fog?: [color: string, near: number, far: number];
      lighting: "day" | "indoor" | "night";
   };
   touchControls: TouchControl[];
   hudStats?: Array<{ key: string; label: string; max?: number }>;
   /** short lines shown on the start screen */
   instructions: string[];
   /** override how the final score/duration is computed (default: store score + elapsedMs) */
   finalScore?(state: RunState): { score: number; durationMs: number };
}

export interface GameShellProps {
   meta: ArcadeGameMeta;
   definition: GameDefinition;
   /** defaults to "/3d" */
   exitHref?: string;
}
