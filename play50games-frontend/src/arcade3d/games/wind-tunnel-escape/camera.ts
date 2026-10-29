// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero; it starts (and recenters) behind and above
// the hero (the tunnel runs towards -z), its pivot leads a little along the travel and rises with the
// current, and it stands farther back on a portrait screen. The tunnel's walls, ledges and lifts are its
// collision boxes (rules.ts solidBoxes), so it pulls in rather than looking through a wall. The intro's
// fly-through (core/intro) runs from the exit back over the rooms and ends exactly on playCamera.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { fanX, solidBoxes, type Course, type SolidBox, type WindRun } from "./rules";

const DEG = Math.PI / 180;

/** The orbit camera's tuning (menu2/camera createOrbit): yaw 0 = straight behind the run. */
export const WIND_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 25 * DEG,
   distance: 7.2,
   minDistance: 3.6,
   maxDistance: 16,
};

export const FOV = 56;
export const FOV_PORTRAIT = 68;

/** How much farther the orbit stands on a portrait screen (aspect < 1): OrbitCamera distanceScale. */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.45 * portrait;
}

/** The camera looks this far above the pivot (a little more on a portrait phone). */
export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.15 + 0.1 * portrait;
}

/**
 * The orbit's pivot: the hero's chest, led along the travel (at most 2.5 m, never backwards along the
 * run), and a little higher while an up-current lifts (so the ledge it lifts to is on screen).
 */
export function orbitPivot(hx: number, hy: number, hz: number, vx: number, vz: number, rising: boolean, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = hx + Math.max(-1.2, Math.min(1.2, vx * 0.12));
   out.y = hy + 1.1 + (rising ? 0.8 : 0);
   out.z = hz + Math.max(-2.5, Math.min(0, vz * 0.22));
   return out;
}

/** The orbit camera's first pose at the start (the intro ends on it, so the hand-over is seamless). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const s = course.start;
   const p = orbitPivot(s.x, s.y, s.z, 0, 0, false, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, WIND_ORBIT.yaw ?? 0, WIND_ORBIT.pitch ?? 0, (WIND_ORBIT.distance ?? 7) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/**
 * The fly-through: from high over the exit (or the Gale Engine on level 5), back over the rooms (the
 * roofless tunnel seen from above, each shot a little lower), to the start (then playCamera).
 */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const g = course.goal;
   const gx = (g.x0 + g.x1) / 2;
   const gz = (g.z0 + g.z1) / 2;
   const gy = g.y0 + 0.5;
   const shots: IntroKeyframe[] = [{ position: [gx + 18, gy + 20, gz - 14], lookAt: [gx, gy + 2, gz] }];
   const rooms = course.rooms.filter((r) => r.setup || r.name.startsWith("Gale"));
   const picks = rooms.length <= 3 ? rooms.slice() : [rooms[rooms.length - 1], rooms[Math.floor(rooms.length / 2)], rooms[0]];
   picks.sort((a, b) => a.z1 - b.z1);
   let side = -1;
   picks.forEach((r, k) => {
      const z = (r.z0 + r.z1) / 2;
      shots.push({ position: [side * 9, r.top + 13 - 2 * k, z + 10], lookAt: [0, r.floor + 2, z - 4] });
      side = -side;
   });
   return shots;
}

/** Solids within this distance (m) of the camera are the orbit camera's collision boxes. */
const SOLID_REACH = 24;
const SCRATCH: SolidBox[] = [];

/** Fills `out` with the solid boxes near (x, y, z) for the orbit camera's collision; returns how many. */
export function courseSolids(run: WindRun, x: number, y: number, z: number, out: AABB[]): number {
   const all = solidBoxes(run, SCRATCH);
   let n = 0;
   for (let i = 0; i < all && n < out.length; i++) {
      const s = SCRATCH[i];
      const dx = Math.max(s.minX - x, 0, x - s.maxX);
      const dy = Math.max(s.minY - y, 0, y - s.maxY);
      const dz = Math.max(s.minZ - z, 0, z - s.maxZ);
      if (dx * dx + dy * dy + dz * dz > SOLID_REACH * SOLID_REACH) continue;
      const b = out[n++];
      b.min.x = s.minX;
      b.max.x = s.maxX;
      b.min.y = s.minY;
      b.max.y = s.maxY;
      b.min.z = s.minZ;
      b.max.z = s.maxZ;
   }
   // the fan models are wider than their solid housings (the grille is 2.1 m across): camera-only boxes
   // round each fan, so the camera never sits behind a grille with the hero hidden
   const fans = run.course.fans;
   for (let i = 0; i < fans.length && n < out.length; i++) {
      const f = fans[i];
      if (f.kind !== "fan") continue;
      const fx = fanX(f, run.ms);
      const dx = Math.max(Math.abs(x - fx) - FAN_CAM_HALF, 0);
      const dz = Math.max(Math.abs(z - f.z) - FAN_CAM_HALF, 0);
      if (dx * dx + dz * dz > SOLID_REACH * SOLID_REACH) continue;
      const b = out[n++];
      b.min.x = fx - FAN_CAM_HALF;
      b.max.x = fx + FAN_CAM_HALF;
      b.min.y = f.y;
      b.max.y = f.y + 2.6;
      b.min.z = f.z - FAN_CAM_HALF;
      b.max.z = f.z + FAN_CAM_HALF;
   }
   void y;
   return n;
}

/** Half the size of a fan's camera-only box (m). */
export const FAN_CAM_HALF = 1.0;
