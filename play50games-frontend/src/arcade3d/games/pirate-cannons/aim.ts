// The lob aim of the aim-and-release family (README "Aim-drag tuning"): yaw + elevation from a
// relative canvas drag, keyboard nudges and sweeps (core stepKeyboardAim), and the fire triggers
// (a drag release, a tap, Space). Pure: no three.js, React or DOM. It moves to core/aim.ts before
// the second lob game (castle-defender or snowball-battle) starts.
import { stepKeyboardAim, type KeyboardAim } from "@/arcade3d/core/inputController";
import type { AimDrag } from "@/arcade3d/core/types";

const DEG = Math.PI / 180;

export const AIM = {
   /** yaw 0 = straight out to sea (-z), + = right; radians */
   yawMax: 45 * DEG,
   elMin: 0,
   elMax: 35 * DEG,
   /** drag gains per CSS px: sideways turns, pulling down raises (shoots farther) */
   yawPerPx: 0.25 * DEG,
   elPerPx: 0.15 * DEG,
   /** one fresh arrow press; keyboard values snap to this grid */
   keyStep: 0.5 * DEG,
   /** a held arrow sweeps only after this long (s) */
   holdDelay: 0.25,
   /** stepKeyboardAim rates (rad/s of yaw, share of elMax per s) */
   turnRate: 0.45,
   powerRate: 0.35,
   startYaw: 0,
   startEl: 10 * DEG,
} as const;

const KEY_OPTIONS = {
   turnRate: AIM.turnRate,
   powerRate: AIM.powerRate,
   minAngle: Math.PI / 2 - AIM.yawMax,
   maxAngle: Math.PI / 2 + AIM.yawMax,
   minPower: 0,
} as const;

export interface AimState {
   yaw: number;
   elevation: number;
   /** a drag is being followed; yaw0 / el0 = the aim when it started */
   dragging: boolean;
   yaw0: number;
   el0: number;
   /** how long each keyboard axis has been held (s) */
   holdX: number;
   holdY: number;
   /** the unsnapped keyboard sweep (core's KeyboardAim: angle = PI/2 - yaw, power = el / elMax) */
   sweep: KeyboardAim;
   sweepX: boolean;
   sweepY: boolean;
   /** scratch input for stepKeyboardAim (one axis at a time) */
   axes: { moveX: number; moveY: number };
}

/** The input fields the aim reads (a subset of useInput().current). */
export interface AimInput {
   drag: AimDrag;
   tap: unknown;
   jumpPressed: boolean;
   pressed: { left: boolean; right: boolean; up: boolean; down: boolean };
   moveX: number;
   moveY: number;
}

export function createAim(): AimState {
   return {
      yaw: AIM.startYaw,
      elevation: AIM.startEl,
      dragging: false,
      yaw0: 0,
      el0: 0,
      holdX: 0,
      holdY: 0,
      sweep: { angle: Math.PI / 2, power: 0 },
      sweepX: false,
      sweepY: false,
      axes: { moveX: 0, moveY: 0 },
   };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const clampYaw = (v: number) => clamp(v, -AIM.yawMax, AIM.yawMax);
export const clampEl = (v: number) => clamp(v, AIM.elMin, AIM.elMax);
/** Snap to the 0.5° grid (keyboard values). */
export const snap = (v: number) => Math.round(v / AIM.keyStep) * AIM.keyStep;

/** The aim a drag gives from its start aim (canvas width x height CSS px; pointer coordinates -1..1, y up). */
function followDrag(aim: AimState, drag: AimDrag, width: number, height: number): void {
   const dxPx = ((drag.current.x - drag.start.x) * width) / 2;
   const dyPx = ((drag.current.y - drag.start.y) * height) / 2;
   aim.yaw = clampYaw(aim.yaw0 + AIM.yawPerPx * dxPx);
   aim.elevation = clampEl(aim.el0 - AIM.elPerPx * dyPx);
}

/**
 * One frame of aiming. Returns true when this frame fires: a drag released over 16 px (core's
 * `cancelled` = shorter: it only adjusted), a tap (fires the current aim) or Space. At most one fire.
 */
export function stepAim(aim: AimState, input: AimInput, dt: number, width: number, height: number): boolean {
   const { drag } = input;
   if (drag.active || drag.released) {
      if (!aim.dragging) {
         aim.dragging = true;
         aim.yaw0 = aim.yaw;
         aim.el0 = aim.elevation;
      }
      followDrag(aim, drag, width, height);
      if (!drag.active) aim.dragging = false;
   } else aim.dragging = false;

   if (!aim.dragging) stepKeys(aim, input, dt);

   return (drag.released && !drag.cancelled) || !!input.tap || input.jumpPressed;
}

function stepKeys(aim: AimState, input: AimInput, dt: number): void {
   const { pressed } = input;
   if (pressed.left) aim.yaw = clampYaw(snap(aim.yaw) - AIM.keyStep);
   if (pressed.right) aim.yaw = clampYaw(snap(aim.yaw) + AIM.keyStep);
   if (pressed.up) aim.elevation = clampEl(snap(aim.elevation) + AIM.keyStep);
   if (pressed.down) aim.elevation = clampEl(snap(aim.elevation) - AIM.keyStep);

   aim.holdX = input.moveX !== 0 ? aim.holdX + dt : 0;
   aim.holdY = input.moveY !== 0 ? aim.holdY + dt : 0;
   const sx = aim.holdX > AIM.holdDelay;
   const sy = aim.holdY > AIM.holdDelay;
   // a sweep starts from the current aim; an axis that is not sweeping follows the aim
   if (!sx || !aim.sweepX) aim.sweep.angle = Math.PI / 2 - aim.yaw;
   if (!sy || !aim.sweepY) aim.sweep.power = aim.elevation / AIM.elMax;
   aim.sweepX = sx;
   aim.sweepY = sy;
   if (!sx && !sy) return;
   aim.axes.moveX = sx ? input.moveX : 0;
   aim.axes.moveY = sy ? input.moveY : 0;
   stepKeyboardAim(aim.sweep, aim.axes, dt, KEY_OPTIONS);
   if (sx) aim.yaw = clampYaw(snap(Math.PI / 2 - aim.sweep.angle));
   if (sy) aim.elevation = clampEl(snap(aim.sweep.power * AIM.elMax));
}
