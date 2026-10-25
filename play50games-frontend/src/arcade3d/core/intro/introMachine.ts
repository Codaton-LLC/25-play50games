// Opt-in intro for a 3D Arcade game (Menu 2 opens on one; nothing turns it on by itself).
// Pure: no React, no three.js. GameIntro advances a session from the canvas; the shell reads
// `ready` and only then starts the run, so the intro never counts toward elapsedMs.
//
// Phases: fly-through -> hero-landing -> title -> done.
// Full is 7 s (inside the 5–8 s bar). Short is 1.5 s: title plus a camera settle, after the first
// view of this slug and level, and whenever the player prefers reduced motion.
import { swallowIntroInput, type IntroInputLatch } from "./introInput";

export type { IntroInputLatch } from "./introInput";
export { swallowIntroInput } from "./introInput";

export const INTRO_PHASES = ["fly-through", "hero-landing", "title", "done"] as const;
export type IntroPhase = (typeof INTRO_PHASES)[number];
export type IntroVariant = "full" | "short";
export type IntroSkipSource = "key" | "tap" | "button";
export type QualityTierName = "low" | "mid" | "high";

/** Full intro: fly the level, the hero lands, then the title. 7 s. */
export const FULL_INTRO = { flyThrough: 4000, heroLanding: 1600, title: 1400 } as const;
/** Seen before, or reduced motion: the title stays up and the camera settles. 1.5 s. */
export const SHORT_INTRO = { flyThrough: 500, heroLanding: 0, title: 1000 } as const;

export interface IntroDurations {
   readonly flyThrough: number;
   readonly heroLanding: number;
   readonly title: number;
}

const SCHEDULE: Record<IntroVariant, Record<QualityTierName, IntroDurations>> = {
   full: { low: FULL_INTRO, mid: FULL_INTRO, high: FULL_INTRO },
   short: { low: SHORT_INTRO, mid: SHORT_INTRO, high: SHORT_INTRO },
};

/**
 * Phase lengths in ms. `tier` is accepted so a caller can pass the quality tier through: low and
 * mid play the same schedule as high (no shorter timeline, no extra pass).
 */
export function introDurations(variant: IntroVariant, tier: QualityTierName = "high"): IntroDurations {
   return SCHEDULE[variant][tier];
}

export function introTotalMs(variant: IntroVariant): number {
   const d = introDurations(variant);
   return d.flyThrough + d.heroLanding + d.title;
}

export interface IntroState {
   variant: IntroVariant;
   phase: IntroPhase;
   /** ms spent in `phase` (0 in `done`) */
   phaseMs: number;
   /** ms since the intro started, capped at the variant's total once `done` */
   elapsedMs: number;
   skipped: boolean;
   skipSource: IntroSkipSource | null;
}

function phaseMsOf(variant: IntroVariant, phase: IntroPhase): number {
   if (phase === "done") return 0;
   const d = introDurations(variant);
   if (phase === "fly-through") return d.flyThrough;
   if (phase === "hero-landing") return d.heroLanding;
   return d.title;
}

function nextPhase(phase: IntroPhase): IntroPhase {
   if (phase === "fly-through") return "hero-landing";
   if (phase === "hero-landing") return "title";
   return "done";
}

/** Walk off phases whose length is 0 (the short intro has no landing). */
function settle(state: IntroState): void {
   while (state.phase !== "done" && phaseMsOf(state.variant, state.phase) <= 0) {
      state.phase = nextPhase(state.phase);
      state.phaseMs = 0;
   }
}

export function createIntro(variant: IntroVariant): IntroState {
   const state: IntroState = {
      variant,
      phase: "fly-through",
      phaseMs: 0,
      elapsedMs: 0,
      skipped: false,
      skipSource: null,
   };
   settle(state);
   return state;
}

/** Move `state` forward by `dtMs`. A non-positive or non-finite step does nothing. Mutates. */
export function stepIntro(state: IntroState, dtMs: number): void {
   if (state.phase === "done") return;
   let left = dtMs > 0 && Number.isFinite(dtMs) ? dtMs : 0;
   if (left === 0) return;
   while (left > 0 && state.phase !== "done") {
      const dur = phaseMsOf(state.variant, state.phase);
      if (dur <= 0) {
         state.phase = nextPhase(state.phase);
         state.phaseMs = 0;
         continue;
      }
      const room = dur - state.phaseMs;
      if (left < room) {
         state.phaseMs += left;
         state.elapsedMs += left;
         left = 0;
      } else {
         state.elapsedMs += room;
         left -= room;
         state.phase = nextPhase(state.phase);
         state.phaseMs = 0;
      }
   }
   settle(state);
   if (state.phase === "done") {
      state.phaseMs = 0;
      state.elapsedMs = introTotalMs(state.variant);
   }
}

/** A copy of `state` advanced by `dtMs`. `state` itself is left as it was. */
export function advanceIntro(state: IntroState, dtMs: number): IntroState {
   const next: IntroState = { ...state };
   stepIntro(next, dtMs);
   return next;
}

/** End the intro on this call. The camera is at the play pose and the hero timeline is 1. */
export function skipIntro(state: IntroState, source: IntroSkipSource = "button"): void {
   if (state.phase === "done") return;
   state.phase = "done";
   state.phaseMs = 0;
   state.elapsedMs = introTotalMs(state.variant);
   state.skipped = true;
   state.skipSource = source;
}

/**
 * Skip, and clear a latched input so the key or tap that skipped cannot also move the game.
 * Already-done: the input is left alone (the run may be using it). Returns a new state.
 */
export function requestIntroSkip(state: IntroState, source: IntroSkipSource, input?: IntroInputLatch): IntroState {
   if (state.phase === "done") return state;
   if (input) swallowIntroInput(input);
   const next: IntroState = { ...state };
   skipIntro(next, source);
   return next;
}

/** Smoothstep. 0 and 1 stay put, so a fly-through starts and ends at rest. */
export function easeIntro(t: number): number {
   const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
   return x * x * (3 - 2 * x);
}

/** 0 at the start of the fly, 1 once the fly phase has ended (eased while it runs). */
export function cameraProgress(state: Pick<IntroState, "variant" | "phase" | "phaseMs">): number {
   if (state.phase !== "fly-through") return 1;
   const dur = phaseMsOf(state.variant, "fly-through");
   if (!(dur > 0)) return 1;
   return easeIntro(state.phaseMs / dur);
}

/**
 * 0 before the landing, then 0..1 through it, then 1. The short intro is already landed (the
 * title is the whole short version; the camera only settles).
 */
export function heroProgress(state: Pick<IntroState, "variant" | "phase" | "phaseMs">): number {
   if (state.variant === "short") return 1;
   if (state.phase === "fly-through") return 0;
   if (state.phase !== "hero-landing") return 1;
   const dur = phaseMsOf(state.variant, "hero-landing");
   if (!(dur > 0)) return 1;
   const t = state.phaseMs / dur;
   if (t <= 0) return 0;
   if (t >= 1) return 1;
   return t;
}

/** Full: the title card is the last phase. Short: the title is up the whole time. */
export function introShowsTitle(state: Pick<IntroState, "variant" | "phase">): boolean {
   if (state.phase === "done") return false;
   if (state.variant === "short") return true;
   return state.phase === "title";
}

export function introReady(state: Pick<IntroState, "phase">): boolean {
   return state.phase === "done";
}

/**
 * Ms the run clock may consume this frame. 0 for the whole intro, including the frame that
 * finishes it (advance the intro first, then ask). After `done`, `dtMs` passes through.
 */
export function gatedRunDt(state: Pick<IntroState, "phase">, dtMs: number): number {
   if (state.phase !== "done") return 0;
   return dtMs > 0 && Number.isFinite(dtMs) ? dtMs : 0;
}

export interface GatedClock {
   elapsedMs: number;
}

/**
 * One frame of the shell's gate. While the intro runs, `dtMs` moves the intro and this clock
 * stays. The frame that reaches `done` is still intro time. Later frames add `dtMs`.
 */
export function stepGatedClock(
   clock: GatedClock,
   intro: IntroState,
   dtMs: number
): { clock: GatedClock; intro: IntroState } {
   if (!introReady(intro)) return { clock, intro: advanceIntro(intro, dtMs) };
   return { clock: { elapsedMs: clock.elapsedMs + gatedRunDt(intro, dtMs) }, intro };
}

// ---------- first view (localStorage) and reduced motion ----------

export const INTRO_SEEN_PREFIX = "play50games_3d_intro:";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export interface IntroStorage {
   getItem(key: string): string | null;
   setItem(key: string, value: string): void;
}

export function introStorageKey(slug: string, level: number): string {
   return `${INTRO_SEEN_PREFIX}${slug}:${level}`;
}

/** False when storage is missing or throws: the caller plays the full intro. */
export function readIntroSeen(storage: IntroStorage | null | undefined, slug: string, level: number): boolean {
   try {
      if (!storage) return false;
      return storage.getItem(introStorageKey(slug, level)) === "1";
   } catch {
      return false;
   }
}

/** Remember a finished intro. A throw is ignored: the next visit plays the full intro again. */
export function markIntroSeen(storage: IntroStorage | null | undefined, slug: string, level: number): void {
   try {
      storage?.setItem(introStorageKey(slug, level), "1");
   } catch {
      // storage blocked
   }
}

export function browserIntroStorage(): IntroStorage | null {
   try {
      if (typeof window === "undefined") return null;
      return window.localStorage;
   } catch {
      return null;
   }
}

export function readReducedMotion(
   matchMedia: ((query: string) => { matches: boolean } | null | undefined) | null | undefined
): boolean {
   try {
      if (!matchMedia) return false;
      return matchMedia(REDUCED_MOTION_QUERY)?.matches === true;
   } catch {
      return false;
   }
}

/** Reduced motion wins, then a remembered view. Otherwise the full fly-through. */
export function resolveIntroVariant(seen: boolean, reducedMotion: boolean): IntroVariant {
   if (reducedMotion || seen) return "short";
   return "full";
}

export function loadIntroVariant(
   storage: IntroStorage | null | undefined,
   slug: string,
   level: number,
   reducedMotion: boolean
): IntroVariant {
   return resolveIntroVariant(readIntroSeen(storage, slug, level), reducedMotion);
}

// ---------- skip keys and taps (so they do not also act in the game) ----------

const MODIFIER_CODES = new Set([
   "ShiftLeft",
   "ShiftRight",
   "ControlLeft",
   "ControlRight",
   "AltLeft",
   "AltRight",
   "MetaLeft",
   "MetaRight",
]);

export interface IntroKeyEvent {
   repeat?: boolean;
   code?: string;
   ctrlKey?: boolean;
   metaKey?: boolean;
   altKey?: boolean;
}

/** Any key except a repeat, a modifier by itself, or a ctrl/meta/alt chord. */
export function keySkipsIntro(event: IntroKeyEvent): boolean {
   if (event.repeat) return false;
   if (event.ctrlKey || event.metaKey || event.altKey) return false;
   if (event.code !== undefined && MODIFIER_CODES.has(event.code)) return false;
   return true;
}

/** Primary pointer only (a right-click is not a skip). */
export function tapSkipsIntro(event: { button?: number }): boolean {
   return (event.button ?? 0) === 0;
}

export interface IntroEventTarget {
   /** event target is inside the intro overlay */
   inIntro: boolean;
   /** the Skip button itself: its click skips, the pointer does not also count as a tap */
   onSkipControl: boolean;
   /** a button, link or field outside the intro (the cookie banner) */
   outsideControl: boolean;
   editable: boolean;
}

/**
 * Keys skip from anywhere except a text field or a control outside the intro.
 * Taps skip on the intro overlay. The Skip button's own pointer is left for its click.
 */
export function introTargetAllowsSkip(kind: "key" | "tap", target: IntroEventTarget): boolean {
   if (target.editable) return false;
   if (target.onSkipControl && kind === "tap") return false;
   if (kind === "tap") return target.inIntro;
   if (target.outsideControl && !target.onSkipControl) return false;
   return true;
}

export type IntroGateAction = "skip" | "swallow" | "pass";

export interface IntroKeyGate {
   /** codes that already skipped; repeats and the matching keyup stay swallowed */
   held: Set<string>;
}

export interface IntroPointerGate {
   down: boolean;
}

/**
 * `skip`: end the intro and stop the event. `swallow`: the intro already took this key
 * (a repeat, or the keyup); stop it so it never becomes a held jump. `pass`: the game may have it.
 */
export function gateIntroKey(gate: IntroKeyGate, phase: IntroPhase, event: IntroKeyEvent & { type: "down" | "up" }): IntroGateAction {
   const code = event.code ?? "";
   if (event.type === "up") return code !== "" && gate.held.delete(code) ? "swallow" : "pass";
   if (code !== "" && gate.held.has(code)) return "swallow";
   if (phase === "done" || !keySkipsIntro(event)) return "pass";
   if (code !== "") gate.held.add(code);
   return "skip";
}

/** `skip` on the pointer down, `swallow` on its pointer up, so the canvas never sees the gesture. */
export function gateIntroPointer(
   gate: IntroPointerGate,
   phase: IntroPhase,
   event: { type: "down" | "up"; button?: number }
): IntroGateAction {
   if (event.type === "up") {
      if (!gate.down) return "pass";
      gate.down = false;
      return "swallow";
   }
   if (phase === "done" || !tapSkipsIntro(event)) return "pass";
   gate.down = true;
   return "skip";
}

// ---------- session (one intro, shared by the overlay and the canvas) ----------

export interface IntroSnapshot {
   ready: boolean;
   phase: IntroPhase;
   variant: IntroVariant;
   showsTitle: boolean;
}

export interface IntroSession {
   readonly state: IntroState;
   advance(dtMs: number): void;
   skip(source: IntroSkipSource): void;
   subscribe(listener: () => void): () => void;
   getSnapshot(): IntroSnapshot;
}

function takeSnapshot(state: IntroState): IntroSnapshot {
   return {
      ready: state.phase === "done",
      phase: state.phase,
      variant: state.variant,
      showsTitle: introShowsTitle(state),
   };
}

/** Mutable intro the canvas advances and the overlay subscribes to. `onDone` runs once, on `done`. */
export function createIntroSession(variant: IntroVariant, onDone?: () => void): IntroSession {
   const state = createIntro(variant);
   const listeners = new Set<() => void>();
   let snapshot = takeSnapshot(state);
   let finished = false;

   const publish = () => {
      const next = takeSnapshot(state);
      const changed =
         next.ready !== snapshot.ready ||
         next.phase !== snapshot.phase ||
         next.showsTitle !== snapshot.showsTitle ||
         next.variant !== snapshot.variant;
      if (!changed) return;
      snapshot = next;
      for (const listener of listeners) listener();
      if (next.ready && !finished) {
         finished = true;
         onDone?.();
      }
   };

   return {
      state,
      advance(dtMs) {
         if (state.phase === "done") return;
         const phase = state.phase;
         const shows = introShowsTitle(state);
         stepIntro(state, dtMs);
         if (state.phase !== phase || introShowsTitle(state) !== shows) publish();
      },
      skip(source) {
         if (state.phase === "done") return;
         skipIntro(state, source);
         publish();
      },
      subscribe(listener) {
         listeners.add(listener);
         return () => {
            listeners.delete(listener);
         };
      },
      getSnapshot() {
         return snapshot;
      },
   };
}

// ---------- camera spline ----------

export interface IntroKeyframe {
   position: readonly [number, number, number];
   lookAt: readonly [number, number, number];
}

export interface IntroCameraPose {
   position: { x: number; y: number; z: number };
   lookAt: { x: number; y: number; z: number };
}

export interface IntroSpline {
   positions: Float64Array;
   lookAts: Float64Array;
   count: number;
   /** keyframe the short settle starts from (the one before the play camera) */
   settleFrom: number;
   endX: number;
   endY: number;
   endZ: number;
   endLx: number;
   endLy: number;
   endLz: number;
}

const KEY_EPS = 1e-4;

function nearTuple(a: readonly [number, number, number], b: readonly [number, number, number]): boolean {
   return Math.abs(a[0] - b[0]) <= KEY_EPS && Math.abs(a[1] - b[1]) <= KEY_EPS && Math.abs(a[2] - b[2]) <= KEY_EPS;
}

function nearKeyframe(a: IntroKeyframe, b: IntroKeyframe): boolean {
   return nearTuple(a.position, b.position) && nearTuple(a.lookAt, b.lookAt);
}

/**
 * Keyframes in world space, then the play camera as the last point (a last keyframe that is
 * already the play camera is kept as that pose, not duplicated). `t = 1` copies `play` exactly.
 */
export function createIntroSpline(keyframes: readonly IntroKeyframe[], play: IntroKeyframe): IntroSpline {
   const points: IntroKeyframe[] = [];
   for (let i = 0; i < keyframes.length; i++) points.push(keyframes[i]);
   const last = points[points.length - 1];
   if (!last || !nearKeyframe(last, play)) points.push(play);
   const count = points.length;
   const positions = new Float64Array(count * 3);
   const lookAts = new Float64Array(count * 3);
   for (let i = 0; i < count; i++) {
      const p = i === count - 1 ? play : points[i];
      positions[i * 3] = p.position[0];
      positions[i * 3 + 1] = p.position[1];
      positions[i * 3 + 2] = p.position[2];
      lookAts[i * 3] = p.lookAt[0];
      lookAts[i * 3 + 1] = p.lookAt[1];
      lookAts[i * 3 + 2] = p.lookAt[2];
   }
   return {
      positions,
      lookAts,
      count,
      settleFrom: Math.max(0, count - 2),
      endX: play.position[0],
      endY: play.position[1],
      endZ: play.position[2],
      endLx: play.lookAt[0],
      endLy: play.lookAt[1],
      endLz: play.lookAt[2],
   };
}

function at(data: Float64Array, index: number, axis: number): number {
   return data[index * 3 + axis];
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
   const t2 = t * t;
   const t3 = t2 * t;
   return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function sampleAxis(data: Float64Array, count: number, index: number, t: number, axis: number): number {
   if (t <= 0) return at(data, index, axis);
   const i2 = index + 1 < count ? index + 1 : count - 1;
   if (t >= 1) return at(data, i2, axis);
   const i0 = index > 0 ? index - 1 : index;
   const i3 = i2 + 1 < count ? i2 + 1 : i2;
   return catmull(at(data, i0, axis), at(data, index, axis), at(data, i2, axis), at(data, i3, axis), t);
}

function writeEnd(spline: IntroSpline, out: IntroCameraPose): void {
   out.position.x = spline.endX;
   out.position.y = spline.endY;
   out.position.z = spline.endZ;
   out.lookAt.x = spline.endLx;
   out.lookAt.y = spline.endLy;
   out.lookAt.z = spline.endLz;
}

function lerpTo(data: Float64Array, i0: number, i1: number, t: number, out: { x: number; y: number; z: number }): void {
   const o0 = i0 * 3;
   const o1 = i1 * 3;
   out.x = data[o0] + (data[o1] - data[o0]) * t;
   out.y = data[o0 + 1] + (data[o1 + 1] - data[o0 + 1]) * t;
   out.z = data[o0 + 2] + (data[o1 + 2] - data[o0 + 2]) * t;
}

/**
 * `t` is 0..1 along the fly (already eased). Full: Catmull-Rom through every keyframe.
 * Short: a straight settle from the previous keyframe onto the play camera.
 * `t >= 1` (and a single-point path) writes the play camera's own numbers into `out`.
 */
export function sampleIntroCamera(spline: IntroSpline, variant: IntroVariant, t: number, out: IntroCameraPose): IntroCameraPose {
   const u = t <= 0 ? 0 : t >= 1 ? 1 : t;
   if (u >= 1 || spline.count <= 1) {
      writeEnd(spline, out);
      return out;
   }
   if (variant === "short") {
      const from = spline.settleFrom;
      const to = spline.count - 1;
      if (from === to) writeEnd(spline, out);
      else {
         lerpTo(spline.positions, from, to, u, out.position);
         lerpTo(spline.lookAts, from, to, u, out.lookAt);
      }
      return out;
   }
   const segments = spline.count - 1;
   const scaled = u * segments;
   let index = Math.floor(scaled);
   let local = scaled - index;
   if (index >= segments) {
      index = segments - 1;
      local = 1;
   }
   if (local <= 0) {
      out.position.x = at(spline.positions, index, 0);
      out.position.y = at(spline.positions, index, 1);
      out.position.z = at(spline.positions, index, 2);
      out.lookAt.x = at(spline.lookAts, index, 0);
      out.lookAt.y = at(spline.lookAts, index, 1);
      out.lookAt.z = at(spline.lookAts, index, 2);
      return out;
   }
   out.position.x = sampleAxis(spline.positions, spline.count, index, local, 0);
   out.position.y = sampleAxis(spline.positions, spline.count, index, local, 1);
   out.position.z = sampleAxis(spline.positions, spline.count, index, local, 2);
   out.lookAt.x = sampleAxis(spline.lookAts, spline.count, index, local, 0);
   out.lookAt.y = sampleAxis(spline.lookAts, spline.count, index, local, 1);
   out.lookAt.z = sampleAxis(spline.lookAts, spline.count, index, local, 2);
   return out;
}
