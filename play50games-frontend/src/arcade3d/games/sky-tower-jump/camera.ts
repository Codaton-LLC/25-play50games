// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero; it starts (and recenters) behind and
// above the hero (the route climbs towards -z), its pivot leads a little towards the next platform,
// and it stands farther back on a portrait screen. The intro's fly-through (core/intro) ends exactly
// on playCamera, the orbit's first pose. cameraGoal is the old fixed follow camera's goal, kept for
// its tests and as the reference the orbit's start pose was tuned against.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { AABB } from "@/arcade3d/core/collision";
import { supportX, supportZ, type Course, type SkyRun } from "./rules";

const DEG = Math.PI / 180;

/** The orbit camera's tuning for this game (menu2/camera createOrbit). */
export const SKY_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 22 * DEG,
   distance: 7.2,
   minDistance: 4,
   maxDistance: 15,
};

/** How much farther the orbit stands on a portrait screen (aspect < 1): OrbitCamera distanceScale. */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.45 * portrait;
}

/** The camera looks this far above the pivot (less on a portrait phone, where the controls take the bottom). */
export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   // landscape: the hero's feet about two thirds of the way down the screen with the next platform above;
   // portrait: about a third of the way down, above the joystick and the buttons
   return 0.15 + 0.05 * portrait;
}

/**
 * The orbit's pivot: the hero's chest, led a third of the way towards the next platform's top (so the
 * next jump is on screen), and never behind the hero along the route (only ever ahead, -z).
 */
export function orbitPivot(hx: number, hy: number, hz: number, nx: number, ny: number, nz: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const k = 0.35;
   out.x = hx + (nx - hx) * k * 0.5;
   out.y = hy + 1.1 + Math.max(0, ny - hy) * k;
   out.z = hz + Math.min(0, Math.max(-6, (nz - hz) * k)) * 0.5;
   return out;
}

export const FOV = 55;
export const FOV_PORTRAIT = 66;

export interface CameraGoal {
   px: number;
   py: number;
   pz: number;
   lx: number;
   ly: number;
   lz: number;
}

/** Behind and above the focus: wider and higher on a portrait screen (aspect < 1). */
export function cameraOffset(aspect: number): { up: number; back: number } {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return { up: 2.9 + 1.6 * portrait, back: 5.6 + 2.8 * portrait };
}

/**
 * Where the camera wants to be: the focus is the hero's chest pulled a third of the way to the next
 * platform's top (so the next jump is on screen), the camera behind it on +z and above it.
 */
export function cameraGoal(
   hx: number,
   hy: number,
   hz: number,
   nx: number,
   ny: number,
   nz: number,
   aspect: number,
   out: CameraGoal,
): CameraGoal {
   const k = 0.35;
   const fx = hx + (nx - hx) * k * 0.5;
   const fy = hy + 1.1 + Math.max(0, ny - hy) * k;
   // only ever ahead (-z) of the hero, never behind it
   const fz = hz + Math.min(0, Math.max(-6, (nz - hz) * k));
   const { up, back } = cameraOffset(aspect);
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   // look past the hero and a little up, so the hero sits in the lower third with the next jump above
   // it (on a portrait phone less high: the touch controls and the cookie banner take the bottom)
   out.lx = fx;
   out.ly = fy + 0.9 - 0.8 * portrait;
   out.lz = fz - 4.5;
   // the camera keeps its distance to the hero (not to the look-ahead point), rising with the next top
   out.px = hx * 0.6 + fx * 0.25;
   out.py = hy + 1.1 + up + Math.max(0, ny - hy) * 0.15;
   out.pz = hz + back;
   return out;
}

/** Where the hero stands at the start (rules createRun: the start platform's centre, 1.5 m back). */
export function startSpot(course: Course): { x: number; y: number; z: number } {
   const start = course.supports[course.checkpoints[0]];
   return { x: start.cx, y: start.top, z: start.cz + 1.5 };
}

/**
 * The orbit camera's first pose on the start platform, at its start yaw, pitch and distance (the
 * intro ends on it, so the hand-over to the orbit is seamless).
 */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const s = startSpot(course);
   const next = course.supports[1];
   const p = orbitPivot(s.x, s.y, s.z, next.cx, next.top, next.cz, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, SKY_ORBIT.yaw ?? 0, SKY_ORBIT.pitch ?? 0, (SKY_ORBIT.distance ?? 7) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/**
 * The fly-through: from the sky gate at the top, down along the tower past the checkpoints, to the
 * start (then playCamera). World-space shots built from the course, so a level's layout keeps them.
 */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const goal = course.supports[course.goal];
   const cps = course.checkpoints.slice(1).map((i) => course.supports[i]);
   const shots: IntroKeyframe[] = [
      // establishing: the gate and the sky tower from out in the sky, then down along the route
      { position: [goal.cx + 34, goal.top + 16, goal.cz + 26], lookAt: [goal.cx, goal.top + 4, goal.cz - 4] },
      { position: [goal.cx + 12, goal.top + 6, goal.cz + 14], lookAt: [goal.cx, goal.top + 2, goal.cz - 3] },
   ];
   let side = -1;
   for (let i = cps.length - 1; i >= 0; i--) {
      const c = cps[i];
      shots.push({ position: [c.cx + side * 22, c.top + 11, c.cz + 12], lookAt: [c.cx, c.top + 1, c.cz - 3] });
      side = -side;
   }
   return shots;
}

/** Supports within this distance (m) of the camera are the orbit camera's solids. */
const SOLID_REACH = 22;

/**
 * Fills `out` with the platforms near (x, y, z) at visual time `ms` as solid boxes (the moving ones
 * where they are now) for the orbit camera's collision; returns how many.
 */
export function courseSolids(run: SkyRun, ms: number, x: number, y: number, z: number, out: AABB[]): number {
   let n = 0;
   const supports = run.course.supports;
   for (let i = 0; i < supports.length && n < out.length; i++) {
      const s = supports[i];
      const cx = supportX(s, ms);
      const cz = supportZ(s, ms);
      const dx = cx - x;
      const dy = s.top - y;
      const dz = cz - z;
      const reach = SOLID_REACH + s.hw + s.hd;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      const b = out[n++];
      b.min.x = cx - s.hw;
      b.max.x = cx + s.hw;
      b.min.z = cz - s.hd;
      b.max.z = cz + s.hd;
      b.min.y = s.bottom;
      b.max.y = s.top;
   }
   return n;
}
