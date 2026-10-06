// Runtime contracts for 3D Arcade games. Owned by Claude.
// Type-only imports of three/R3F are fine here (erased at build time).
//
// Time and frame order (core/README.md has the full list of helpers):
// - Game logic runs in useRunFrame((state, dt, time) => …). It runs only while "playing"; dt is
//   exactly the play time the run clock counted this frame (also the rest of the frame in which the
//   countdown ends), so the game never moves for time elapsedMs does not include.
// - Visuals animate with useGameTime().now (stops while paused, restarts at 0 every run).
//   NEVER use state.clock.elapsedTime or getElapsedTime(): GameShell pauses by switching the R3F
//   frameloop, and R3F resets that clock on every switch.
// - One frame: input latch -> run clock -> game time -> useRunFrame -> CameraRig -> useFrame
//   visuals -> render (FRAME_PRIORITY in core/frameLoop.ts). useRunFrame runs before the camera and
//   every plain useFrame wherever it is mounted, so a visual never draws the previous frame's state
//   or camera. A custom useRunFrame priority must lie in (FRAME_PRIORITY.gameTime, 0] = (-0.75, 0].
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

/** One-frame direction presses (InputState.pressed). */
export interface DirectionPresses {
   left: boolean;
   right: boolean;
   up: boolean;
   down: boolean;
}

/**
 * Unified input, read from a ref inside useRunFrame (non-reactive).
 * Keyboard, joystick, touch buttons, swipes and canvas taps all land here.
 * The `*Pressed`, `pressed`, `swipe` and `tap` fields are one-frame events: they are set at the
 * start of the frame after the event and cleared at the start of the next one. An event is never
 * lost, however short: a key pressed and released between two frames still shows up once.
 */
export interface InputState {
   /** -1..1 (left = -1) */
   moveX: number;
   /** -1..1, up = -1 */
   moveY: number;
   /** held: Space or the touch Jump button */
   jump: boolean;
   /** held: E / Enter or the touch Action button */
   action: boolean;
   /** true only on the frame the jump started */
   jumpPressed: boolean;
   /** true only on the frame the action started */
   actionPressed: boolean;
   /**
    * One frame: a direction was pressed. Set by every new keydown of an arrow or WASD key
    * (auto-repeat does not count) and by a swipe in that direction. Use it for discrete moves
    * (lane changes, grid hops): moveX/moveY are sampled once per frame and miss a key tapped
    * between two frames. The object is mutated in place (never replaced).
    *
    * `pressed` already includes swipes: a swipe sets `swipe` and the same direction here on the
    * same frame. Handle a move from `pressed` only, and do not act on `swipe` for the same move,
    * or every swipe moves twice. Read `swipe` only for meanings `pressed` does not carry.
    */
   pressed: DirectionPresses;
   /**
    * One frame: a quick swipe on the canvas (touch or mouse drag), by its dominant axis. It fires
    * while the pointer is still moving, as soon as it has travelled SWIPE_MIN_PX within
    * SWIPE_MAX_MS (once per gesture), or on release for a flick no move event reported.
    *
    * Every swipe also sets `pressed[direction]` on the same frame. A game that moves on `pressed`
    * must not move on `swipe` too (one swipe would move twice); read `swipe` only for meanings
    * `pressed` does not carry (for example "this came from touch").
    */
   swipe: "up" | "down" | "left" | "right" | null;
   /** one frame: a short tap/click on the canvas, in pointer coordinates */
   tap: { x: number; y: number } | null;
   /** normalised -1..1 canvas coordinates (x right = 1, y up = 1, like R3F) */
   pointer: { x: number; y: number; down: boolean };
}

export type PrimitiveFallback = "box" | "capsule" | "sphere" | "cylinder";

/** A GLB model (or a coloured primitive until the GLB exists). */
export interface ModelAsset {
   id: string;
   /** /models/3d/<slug|shared>/<id>.glb; fetched only once it is listed in core/modelManifest.ts */
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
   /**
    * Optional extra HUD over the canvas (plain DOM). Mounted, hidden, once the stage is up and shown
    * during countdown, playing and paused. Mark panels the camera fit must keep clear of with
    * `data-arcade-safe-area` (they join useSafeArea().hud).
    */
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
   /**
    * How long (ms) the scene keeps playing on screen after a run ends, before the result panel
    * appears, so a crash or a win animation can be seen. Default 800 (DEFAULT_RESULT_DELAY_MS),
    * 0 = at once, at most RESULT_DELAY_MAX_MS. Counted in rendered frames (a hidden tab waits).
    * The score is submitted at the end of the run either way; "quit" exits at once.
    */
   resultDelayMs?: number;
   /** override how the final score/duration is computed (default: store score + elapsedMs) */
   finalScore?(state: RunState): { score: number; durationMs: number };
}

export interface GameShellProps {
   meta: ArcadeGameMeta;
   definition: GameDefinition;
   /** defaults to "/3d" */
   exitHref?: string;
}
