// Mini Golf's putt aim (README "Aim-drag tuning"): core's polar pull (drag.angle / drag.power) turned
// into a heading on the felt, the shared keyboard stepper (core/aim.ts: 1 deg / 2 % nudges that
// sweep when held) and the Space charge meter. Pure: no three.js, React or DOM.
//
// The aim's x is the putt's SCREEN heading theta (0 = straight up the screen, + = clockwise, so
// "right" turns right whatever the camera's yaw); the world heading is psi = theta - yaw (rules.ts:
// 0 = -z, + = towards +x), because inputToWorld(sin theta, -cos theta, yaw) = (sin psi, -cos psi).
import { AIM_HOLD_DELAY_S, aimFired, createAxisAim, createHoldTimer, stepAimKeys, stepHold, type AxisAim, type AxisAimOptions, type HoldTimer } from "@/arcade3d/core/aim";
import { needlePosition } from "@/arcade3d/core/hud/timingMath";
import { AIM_DRAG_FULL_PX, AIM_DRAG_MIN_PX } from "@/arcade3d/core/inputController";
import type { AimDrag } from "@/arcade3d/core/types";
import { POWER_MIN } from "./rules";

const DEG = Math.PI / 180;

export const PUTT = {
   /** one fresh arrow press: 1 deg of heading, 2 % of power */
   turnStep: DEG,
   powerStep: 0.02,
   /** a held arrow sweeps after AIM_HOLD_DELAY_S at these rates (rad/s, power/s) */
   turnRate: 1.05,
   powerRate: 0.5,
   /** each stroke starts aimed at the cup at this power */
   startPower: 0.5,
   /** the Space charge meter: 0 -> 1 -> 0 every this many seconds */
   chargePeriod: 2.0,
   /** the shortest pull that sets the aim (a shorter release only cancels) */
   minPull: AIM_DRAG_MIN_PX / AIM_DRAG_FULL_PX,
} as const;

const OPTIONS: AxisAimOptions = {
   x: { min: -Infinity, max: Infinity, step: PUTT.turnStep, rate: PUTT.turnRate, dragGain: 0 },
   y: { min: POWER_MIN, max: 1, step: PUTT.powerStep, rate: PUTT.powerRate, dragGain: 0 },
   holdDelay: AIM_HOLD_DELAY_S,
};

export interface PuttAim {
   /** x = screen heading theta (rad), y = power 0.1-1 */
   axes: AxisAim;
   charge: HoldTimer;
   /** the power shown now (the charge meter's while Space is held) */
   shown: number;
   /** a drag is being followed (the dots follow the finger) */
   dragging: boolean;
}

/** The fields the aim reads (a subset of useInput().current). */
export interface PuttInput {
   drag: AimDrag;
   pressed: { left: boolean; right: boolean; up: boolean; down: boolean };
   moveX: number;
   moveY: number;
   jump: boolean;
   actionPressed: boolean;
}

export function createPuttAim(): PuttAim {
   return { axes: createAxisAim(0, PUTT.startPower), charge: createHoldTimer(), shown: PUTT.startPower, dragging: false };
}

/**
 * The screen heading of a pull: core's drag angle (screen, y up, of start - current) with its
 * forward part un-foreshortened by the camera's pitch, so the putt goes where the pull points on
 * the felt (a pull straight down the screen putts straight up the lane).
 */
export function headingFromDrag(angle: number, pitch: number): number {
   return Math.atan2(Math.cos(angle), Math.sin(angle) / Math.sin(pitch));
}

/** The world heading (rules.ts psi) of a screen heading for a camera at `yaw`. */
export const worldHeading = (theta: number, yaw: number): number => theta - yaw;
/** The screen heading that putts towards world heading psi. */
export const screenHeading = (psi: number, yaw: number): number => psi + yaw;
/** The world heading from (x, z) towards (tx, tz). */
export const headingTo = (x: number, z: number, tx: number, tz: number): number => Math.atan2(tx - x, -(tz - z));

/** A new stroke: aimed at the cup, power 0.5, no charge. */
export function resetPuttAim(aim: PuttAim, psiToCup: number, yaw: number): void {
   aim.axes.x = screenHeading(psiToCup, yaw);
   aim.axes.y = PUTT.startPower;
   aim.axes.holdX = 0;
   aim.axes.holdY = 0;
   aim.shown = PUTT.startPower;
   aim.charge.down = false;
   aim.charge.held = 0;
}

/** The charge meter's power after `held` seconds of Space. */
export const chargePower = (held: number): number => Math.max(POWER_MIN, needlePosition(held, PUTT.chargePeriod, "pingpong"));

/**
 * One frame of aiming. Returns true when this frame putts: a pull released over 16 px, Enter / E
 * (the power shown) or Space released (the charge meter's power). The aim to putt with is
 * aim.axes.x (screen heading) and aim.axes.y (power).
 */
export function stepPuttAim(aim: PuttAim, input: PuttInput, dt: number, pitch: number): boolean {
   const { drag } = input;
   const a = aim.axes;
   aim.dragging = drag.active;
   if ((drag.active || drag.released) && drag.power >= PUTT.minPull) {
      a.x = headingFromDrag(drag.angle, pitch);
      a.y = Math.max(POWER_MIN, Math.min(1, drag.power));
   } else if (!drag.active) {
      stepAimKeys(a, input, dt, OPTIONS);
   }
   const charged = stepHold(aim.charge, input.jump, dt);
   if (aim.charge.down) aim.shown = chargePower(aim.charge.held);
   else aim.shown = a.y;
   if (charged) {
      a.y = chargePower(aim.charge.held);
      aim.shown = a.y;
      return true;
   }
   return aimFired(input, { release: true, action: true });
}
