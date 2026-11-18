// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero; it starts (and recenters) behind and
// above the hero (the escape heads towards -z, down the chambers), a little higher than a platformer
// camera so the water in a trench and the tide below read; it stands farther back on a portrait
// screen. The chamber walls are its solids, so it pulls in rather than looking through stone. The
// intro's fly-through (core/intro) ends exactly on playCamera, the orbit's first pose.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { solidBoxes, type Course, type RuinRun, type SolidBox } from "./rules";

const DEG = Math.PI / 180;

export const FOV = 55;
export const FOV_PORTRAIT = 66;

/** The orbit camera's tuning for this game (menu2/camera createOrbit). Yaw 0: straight behind the escape (-z). */
export const RUIN_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 28 * DEG,
   distance: 7.4,
   minDistance: 3.5,
   maxDistance: 16,
};

/** How much farther the orbit stands on a portrait screen (aspect < 1): OrbitCamera distanceScale. */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.45 * portrait;
}

/** The camera looks this far above the pivot (a little more on a portrait phone, over the controls). */
export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.15 + 0.05 * portrait;
}

/**
 * The orbit's pivot: the hero's chest, led a little ahead along the escape (-z), so the next ledge
 * or lever is on screen. While swimming the pivot stays at the surface's height band (the head).
 */
export function orbitPivot(hx: number, hy: number, hz: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = hx;
   out.y = hy + 1.1;
   out.z = hz - 1.2;
   return out;
}

/** Where the hero stands at the start (rules createRun: the start block's centre, up to 1.5 m back). */
export function startSpot(course: Course): { x: number; y: number; z: number } {
   const start = course.supports[course.checkpoints[0]];
   return { x: start.cx, y: start.top, z: start.cz + Math.min(1.5, start.hd * 0.5) };
}

/**
 * The orbit camera's first pose at the start, at its start yaw, pitch and distance (the intro ends
 * on it, so the hand-over to the orbit is seamless).
 */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const s = startSpot(course);
   const p = orbitPivot(s.x, s.y, s.z, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, RUIN_ORBIT.yaw ?? 0, RUIN_ORBIT.pitch ?? 0, (RUIN_ORBIT.distance ?? 7) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/**
 * The fly-through: from the exit gate (high, out over the ruin), back along the checkpoints, to the
 * start (then playCamera). World-space shots built from the course, so a level's layout keeps them.
 */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const goal = course.supports[course.goal];
   const cps = course.checkpoints.slice(1).map((i) => course.supports[i]);
   const shots: IntroKeyframe[] = [
      // establishing: the flood gate from out over the ruin
      { position: [goal.cx + 26, goal.top + 16, goal.cz - 14], lookAt: [goal.cx, goal.top + 2, goal.cz] },
      { position: [goal.cx + 10, goal.top + 10, goal.cz + 12], lookAt: [goal.cx, goal.top + 1, goal.cz - 2] },
   ];
   let side = -1;
   for (let i = cps.length - 1; i >= 0; i--) {
      const c = cps[i];
      shots.push({ position: [c.cx + side * 16, c.top + 11, c.cz + 12], lookAt: [c.cx, c.top + 1, c.cz - 3] });
      side = -side;
   }
   return shots;
}

/** Blocks within this distance (m) of the camera are the orbit camera's solids. */
const SOLID_REACH = 24;
const BOXES: SolidBox[] = [];

/**
 * Fills `out` with the stone blocks near (x, y, z) at rules ms `ms` (crates where they float now,
 * broken brick left out) as AABBs for the orbit camera's collision; returns how many.
 */
export function courseSolids(run: RuinRun, ms: number, x: number, y: number, z: number, out: AABB[]): number {
   const total = solidBoxes(run, Math.max(0, ms), BOXES);
   let n = 0;
   for (let i = 0; i < total && n < out.length; i++) {
      const b = BOXES[i];
      const dx = Math.max(b.minX - x, 0, x - b.maxX);
      const dy = Math.max(b.minY - y, 0, y - b.maxY);
      const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
      if (dx * dx + dy * dy + dz * dz > SOLID_REACH * SOLID_REACH) continue;
      const o = out[n++];
      o.min.x = b.minX;
      o.max.x = b.maxX;
      o.min.y = b.minY;
      o.max.y = b.maxY;
      o.min.z = b.minZ;
      o.max.z = b.maxZ;
   }
   return n;
}
