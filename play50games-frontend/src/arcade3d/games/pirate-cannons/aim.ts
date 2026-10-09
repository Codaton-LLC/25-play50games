// The lob aim of pirate-cannons (README "Aim-drag tuning"): its yaw / elevation tuning (`AIM`) on
// the shared core aim (core/aim.ts: relative drag, keyboard nudge / sweep / snap, fire triggers).
// Pure: no three.js, React or DOM.
import { AIM_HOLD_DELAY_S, clampTo, createAxisAim, snapTo, stepAxisAim, type AimFireTriggers, type AxisAim, type AxisAimOptions } from "@/arcade3d/core/aim";
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
   holdDelay: AIM_HOLD_DELAY_S,
   /** sweep rates: rad/s of yaw, share of elMax per s */
   turnRate: 0.45,
   powerRate: 0.35,
   startYaw: 0,
   startEl: 10 * DEG,
} as const;

/** The core aim's axes: x = yaw, y = elevation. */
const OPTIONS: AxisAimOptions = {
   x: { min: -AIM.yawMax, max: AIM.yawMax, step: AIM.keyStep, rate: AIM.turnRate, dragGain: AIM.yawPerPx },
   y: { min: AIM.elMin, max: AIM.elMax, step: AIM.keyStep, rate: AIM.powerRate * AIM.elMax, dragGain: AIM.elPerPx },
   holdDelay: AIM.holdDelay,
};
/** A drag release, a tap (fires the current aim) or Space. */
const TRIGGERS: AimFireTriggers = { release: true, tap: true, jump: true };

export interface AimState {
   yaw: number;
   elevation: number;
   /** the core aim (x = yaw, y = elevation) */
   axes: AxisAim;
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
   return { yaw: AIM.startYaw, elevation: AIM.startEl, axes: createAxisAim(AIM.startYaw, AIM.startEl) };
}

export const clampYaw = (v: number) => clampTo(v, -AIM.yawMax, AIM.yawMax);
export const clampEl = (v: number) => clampTo(v, AIM.elMin, AIM.elMax);
/** Snap to the 0.5° grid (keyboard values). */
export const snap = (v: number) => snapTo(v, AIM.keyStep);

/**
 * One frame of aiming. Returns true when this frame fires: a drag released over 16 px (core's
 * `cancelled` = shorter: it only adjusted), a tap (fires the current aim) or Space. At most one fire.
 */
export function stepAim(aim: AimState, input: AimInput, dt: number, width: number, height: number): boolean {
   const a = aim.axes;
   a.x = aim.yaw;
   a.y = aim.elevation;
   const fire = stepAxisAim(a, input, dt, width, height, OPTIONS, TRIGGERS);
   aim.yaw = a.x;
   aim.elevation = a.y;
   return fire;
}
