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
// - One frame: input latch -> run clock -> game time -> useRunFrame -> CameraRig -> humanoid pose
//   drivers -> useFrame visuals -> render (FRAME_PRIORITY in core/frameLoop.ts). useRunFrame runs before the camera and
//   every plain useFrame wherever it is mounted, so a visual never draws the previous frame's state
//   or camera. A custom useRunFrame priority must lie in (FRAME_PRIORITY.gameTime, 0] = (-0.75, 0].
import type { ComponentType } from "react";
import type { ArcadeGameMeta, ArcadeSlug } from "../types";
import type { HumanoidLandmarks } from "./rig/humanoid";

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
 * Keyboard, joystick, touch buttons, swipes and canvas taps and presses all land here.
 * The `*Pressed`, `pressed`, `swipe`, `tap` and `tapDown` fields are one-frame events: they are
 * set at the start of the frame after the event and cleared at the start of the next one. An event
 * is never lost, however short: a key pressed and released between two frames still shows up once.
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
   /**
    * One frame: a short tap/click on the canvas, in pointer coordinates (the press position).
    * Reported on release, and only for a press without travel (never for a drag or a swipe).
    */
   tap: { x: number; y: number } | null;
   /**
    * One frame: the canvas's primary pointer went down (a finger touched the canvas, the main
    * mouse button was pressed), at that position, in pointer coordinates like `tap`. Reported on
    * the press itself, before the release and whatever the gesture turns into (tap, hold, drag,
    * swipe), so every tap and swipe starts with one. A press and release between two frames
    * still reports it, on the same frame as its `tap`. Never set by a pointer that starts on the
    * touch controls, nor by a second finger while the canvas pointer is down.
    *
    * Read `tap` or `tapDown` for one action, not both, or a short press acts twice.
    */
   tapDown: { x: number; y: number } | null;
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
   /**
    * Per-axis factors on top of `scale`, in the GLB's own x / y / z (before rotationY). Rodin
    * normalises every model to a longest side of about 1.9, so a prop sometimes needs its
    * proportions fixed, e.g. a desk made lower without making it narrower. Keep them near 1.
    */
   stretch?: readonly [number, number, number];
   rotationY?: number;
   yOffset?: number;
   /** a GLB with its own skeleton (skinned meshes): cloned with SkeletonUtils */
   rigged?: boolean;
   /**
    * A static T-pose character (Hyper3D Rodin: arms out along ±x, facing +z, no skeleton). The core
    * auto-rig (core/rig) builds a skeleton in code: <Model> draws it with its arms down and
    * <HumanoidModel pose> animates it (walk, carry, cheer...). `landmarks` are measured joint
    * positions in GLB units; any field left out is estimated from the mesh (core/README.md
    * "Characters: the auto-rig").
    */
   humanoid?: { landmarks?: Partial<HumanoidLandmarks> };
   /** logical name -> clip name in the GLB, e.g. { run: "Run" } */
   animations?: Record<string, string>;
   fallback: PrimitiveFallback;
   fallbackColor?: string;
   budget: { tris: number; bytes: number };
}

export type TouchControl = "joystick" | "jump" | "action" | "swipe" | "tap";

/**
 * The lights ShellStage sets up (core/README.md "Lighting presets"): day, indoor, night, and for
 * the expansion worlds sunset (warm, low sun), snow (bright, cool, soft shadows) and space (one hard
 * white sun, almost no fill).
 */
export type LightingPreset = "day" | "indoor" | "night" | "sunset" | "snow" | "space";

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
      lighting: LightingPreset;
   };
   touchControls: TouchControl[];
   /** Labels of the touch Jump / Action buttons (default "Jump" / "Action"), e.g. { action: "Throw" }. */
   touchLabels?: { jump?: string; action?: string };
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
