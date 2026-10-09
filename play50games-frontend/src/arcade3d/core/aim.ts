// Shared aim of the aim-and-release family (pirate-cannons, mini-golf, castle-defender,
// snowball-battle): a two-axis aim (x, y) in the game's own units, moved by a relative canvas drag,
// by keyboard nudges that sweep when held and snap to a grid, plus the fire triggers, the
// buffered-fire contract and a hold timer for charge meters. Pure: no three.js, React or DOM; no
// allocation per call (state objects are made once); deterministic.
//
// Axes: x grows with "right" (→, moveX > 0, a drag to the right), y grows with "up" (↑,
// moveY < 0) and with a drag pulled DOWN (pull back = more). A game maps x / y to its own meaning
// (pirate-cannons: yaw / elevation; mini-golf: putt direction / power) through the axis options.
import type { AimDrag } from "./types";

export interface AimAxisOptions {
   /** clamp of the value (use -Infinity / Infinity for none, e.g. a putt direction) */
   min: number;
   max: number;
   /** one fresh arrow press moves exactly this much; keyboard values snap to this grid */
   step: number;
   /** sweep speed while the arrow is held past `holdDelay` (units per second at full input) */
   rate: number;
   /** relative drag gain (units per CSS px: x per px right, y per px pulled down); 0 = none */
   dragGain: number;
}

export interface AxisAimOptions {
   x: AimAxisOptions;
   y: AimAxisOptions;
   /** a held arrow sweeps only after this long (s); the family uses 0.25 */
   holdDelay: number;
}

/** The family's hold delay before a held arrow sweeps (s). */
export const AIM_HOLD_DELAY_S = 0.25;

export interface AxisAim {
   x: number;
   y: number;
   /** a drag is being followed; x0 / y0 = the aim when it started */
   dragging: boolean;
   x0: number;
   y0: number;
   /** how long each keyboard axis has been held (s) */
   holdX: number;
   holdY: number;
   /** the unsnapped keyboard sweep of each axis (the snapped value is x / y) */
   sweepX: number;
   sweepY: number;
   sweepingX: boolean;
   sweepingY: boolean;
}

/** The input fields the aim reads (a subset of useInput().current). */
export interface AxisAimInput {
   drag: AimDrag;
   pressed: { left: boolean; right: boolean; up: boolean; down: boolean };
   moveX: number;
   moveY: number;
}

/** The input fields the fire triggers read. */
export interface AimFireInput {
   drag: AimDrag;
   tap?: unknown;
   jumpPressed?: boolean;
   actionPressed?: boolean;
}

/** Which presses fire (default: none, so each game names its own). */
export interface AimFireTriggers {
   /** a drag released over AIM_DRAG_MIN_PX (`released && !cancelled`) */
   release?: boolean;
   /** a tap fires the current aim (a short press gives `tap` and a cancelled release: fires once) */
   tap?: boolean;
   /** Space / touch Jump, on the press */
   jump?: boolean;
   /** E / Enter / touch Action, on the press */
   action?: boolean;
}

export function createAxisAim(x: number, y: number): AxisAim {
   return { x, y, dragging: false, x0: 0, y0: 0, holdX: 0, holdY: 0, sweepX: x, sweepY: y, sweepingX: false, sweepingY: false };
}

export const clampTo = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Snap to a grid of `step` (keyboard values). */
export const snapTo = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Follow a drag relative to where it started: on its first frame the aim is stored (x0 / y0), then
 * x = x0 + gain · px right, y = y0 + gain · px pulled down, clamped. Returns true while a drag is
 * followed (including its release frame), when the keyboard must not move the aim.
 */
export function followRelativeDrag(aim: AxisAim, drag: AimDrag, width: number, height: number, o: AxisAimOptions): boolean {
   if (!drag.active && !drag.released) {
      aim.dragging = false;
      return false;
   }
   if (!aim.dragging) {
      aim.dragging = true;
      aim.x0 = aim.x;
      aim.y0 = aim.y;
   }
   const dxPx = ((drag.current.x - drag.start.x) * width) / 2;
   const dyPx = ((drag.current.y - drag.start.y) * height) / 2;
   aim.x = clampTo(aim.x0 + o.x.dragGain * dxPx, o.x.min, o.x.max);
   aim.y = clampTo(aim.y0 - o.y.dragGain * dyPx, o.y.min, o.y.max);
   if (!drag.active) aim.dragging = false;
   return true;
}

/**
 * One frame of keyboard aim: each fresh `pressed` arrow nudges exactly one `step` from the value
 * snapped to the grid; an arrow held past `holdDelay` sweeps at `rate` from the current aim (an
 * unsnapped sweep keeps the fractions, so slow frames still move) and the value snaps to the grid.
 */
export function stepAimKeys(aim: AxisAim, input: AxisAimInput, dt: number, o: AxisAimOptions): void {
   const { pressed } = input;
   const ox = o.x;
   const oy = o.y;
   if (pressed.left) aim.x = clampTo(snapTo(aim.x, ox.step) - ox.step, ox.min, ox.max);
   if (pressed.right) aim.x = clampTo(snapTo(aim.x, ox.step) + ox.step, ox.min, ox.max);
   if (pressed.up) aim.y = clampTo(snapTo(aim.y, oy.step) + oy.step, oy.min, oy.max);
   if (pressed.down) aim.y = clampTo(snapTo(aim.y, oy.step) - oy.step, oy.min, oy.max);

   aim.holdX = input.moveX !== 0 ? aim.holdX + dt : 0;
   aim.holdY = input.moveY !== 0 ? aim.holdY + dt : 0;
   const sx = aim.holdX > o.holdDelay;
   const sy = aim.holdY > o.holdDelay;
   // a sweep starts from the current aim; an axis that is not sweeping follows the aim
   if (!sx || !aim.sweepingX) aim.sweepX = aim.x;
   if (!sy || !aim.sweepingY) aim.sweepY = aim.y;
   aim.sweepingX = sx;
   aim.sweepingY = sy;
   if (sx) {
      aim.sweepX = clampTo(aim.sweepX + input.moveX * ox.rate * dt, ox.min, ox.max);
      aim.x = clampTo(snapTo(aim.sweepX, ox.step), ox.min, ox.max);
   }
   if (sy) {
      aim.sweepY = clampTo(aim.sweepY - input.moveY * oy.rate * dt, oy.min, oy.max);
      aim.y = clampTo(snapTo(aim.sweepY, oy.step), oy.min, oy.max);
   }
}

/** True when this frame fires, by the game's triggers. At most one fire a frame. */
export function aimFired(input: AimFireInput, t: AimFireTriggers): boolean {
   return (
      (!!t.release && input.drag.released && !input.drag.cancelled) ||
      (!!t.tap && !!input.tap) ||
      (!!t.jump && !!input.jumpPressed) ||
      (!!t.action && !!input.actionPressed)
   );
}

/**
 * One frame of the relative two-axis aim (a lob: drag, keys, fire): the drag first, the keyboard
 * only while no drag is followed. Returns `aimFired(input, triggers)`.
 */
export function stepAxisAim(aim: AxisAim, input: AxisAimInput & AimFireInput, dt: number, width: number, height: number, o: AxisAimOptions, triggers: AimFireTriggers): boolean {
   followRelativeDrag(aim, input.drag, width, height, o);
   if (!aim.dragging) stepAimKeys(aim, input, dt, o);
   return aimFired(input, triggers);
}

/**
 * The buffered-fire contract: a fire pressed while the weapon is not ready waits (one at a time)
 * with the aim of ITS press; a later drag or press does not move it. The rules launch it when ready
 * (`fire.pending`, then `fire.pending = false`).
 */
export interface BufferedFire {
   pending: boolean;
   x: number;
   y: number;
}

export function createBufferedFire(): BufferedFire {
   return { pending: false, x: 0, y: 0 };
}

/** Buffer a fire with this frame's aim unless one already waits. Returns true when it was taken. */
export function bufferFire(buf: BufferedFire, fire: boolean, x: number, y: number): boolean {
   if (!fire || buf.pending) return false;
   buf.pending = true;
   buf.x = x;
   buf.y = y;
   return true;
}

/** A held key or button timed for a charge meter (hold Space, release to fire). */
export interface HoldTimer {
   down: boolean;
   /** seconds held so far; on the release frame, the whole hold */
   held: number;
}

export function createHoldTimer(): HoldTimer {
   return { down: false, held: 0 };
}

/**
 * One frame of a hold: returns true on the frame it is released (read `h.held` then); a new press
 * starts again from 0.
 */
export function stepHold(h: HoldTimer, down: boolean, dt: number): boolean {
   if (down) {
      h.held = h.down ? h.held + dt : 0;
      h.down = true;
      return false;
   }
   const released = h.down;
   h.down = false;
   return released;
}
