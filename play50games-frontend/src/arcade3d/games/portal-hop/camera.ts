// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero (mouse drag, two fingers, keys); the stick is
// camera-relative (StepInput.yaw = orbit.viewYaw); left alone it swings in behind the hero's travel (the
// shared auto-follow). The card's fix for "spatial confusion after teleporting": through a portal the
// camera keeps your facing, turning at most 90 degrees towards the exit's way (afterTeleport), never a
// flip; the Scene adds a 0.15 s swirl.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, wrapAngle, yawBehind, type OrbitSettings, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { islandOn, type Course, type ExitPose } from "./course";
import { ISLAND_SY } from "./assets";
import type { PortalRun } from "./rules";

const DEG = Math.PI / 180;
export const FOV = 55;
export const FOV_PORTRAIT = 66;
/** a teleport turns the camera this far at most (rad) */
export const TELEPORT_TURN = Math.PI / 2;

/** The orbit's tuning: behind and above the hero, 8.5 m out, zoom 4-20 m; the shared auto-follow on. */
export function portalOrbit(course: Course): Partial<OrbitSettings> {
   return { yaw: 0, pitch: (course.cfg.boss ? 30 : 22) * DEG, distance: course.cfg.boss ? 12 : 8.5, minDistance: 4, maxDistance: 20, autoFollow: true, autoFollowDelay: 1.6 };
}

/** After a teleport: swing the target yaw towards behind the exit's way, at most TELEPORT_TURN. */
export function afterTeleport(o: OrbitState, vx: number, vz: number): void {
   if (Math.hypot(vx, vz) < 0.5) return;
   const want = yawBehind(vx, vz);
   const err = wrapAngle(want - o.yaw);
   const turn = Math.max(-TELEPORT_TURN, Math.min(TELEPORT_TURN, err));
   o.yaw = wrapAngle(o.yaw + turn);
   o.recentering = true;
}

/** How much farther the orbit stands on a portrait screen. */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.4 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.6 + 0.5 * portrait;
}

/** The pivot: the hero's chest, led a little along a fast flight (the landing comes into view). */
export function heroPivot(h: { x: number; y: number; z: number; vx: number; vz: number; grounded: boolean }, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const lead = h.grounded ? 0 : 0.12;
   out.x = h.x + h.vx * lead;
   out.y = h.y + 1.1;
   out.z = h.z + h.vz * lead;
   return out;
}

/** The orbit's first pose: behind the hero at the start (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const o = portalOrbit(course);
   const d = (o.distance ?? 8.5) * orbitScale(aspect);
   const s = course.start;
   const cam = orbitPosition(s.x, s.y + 1.1, s.z, o.yaw ?? 0, o.pitch ?? 0, d, { x: 0, y: 0, z: 0 });
   return { position: [cam.x, cam.y, cam.z], lookAt: [s.x, s.y + 1.1 + orbitLookUp(aspect), s.z] };
}

/** The fly-through: high over the island chain, down along it, to behind the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   let x0 = Infinity;
   let x1 = -Infinity;
   let z0 = Infinity;
   let z1 = -Infinity;
   for (const i of course.islands) {
      x0 = Math.min(x0, i.x);
      x1 = Math.max(x1, i.x);
      z0 = Math.min(z0, i.z);
      z1 = Math.max(z1, i.z);
   }
   const cx = (x0 + x1) / 2;
   const cz = (z0 + z1) / 2;
   const span = Math.max(x1 - x0, z1 - z0);
   const s = course.start;
   return [
      { position: [cx + span * 0.35, span * 0.45 + 12, z0 - 12], lookAt: [cx, 2, cz] },
      { position: [cx - span * 0.4, span * 0.3 + 8, cz + span * 0.2], lookAt: [cx, 2, (cz + s.z) / 2] },
      { position: [s.x + 3, s.y + 6, s.z + 12], lookAt: [s.x, s.y + 1, s.z - 4] },
   ];
}

const SOLID_REACH = 26;

/** Fills `out` with the island slabs near the camera (the camera pulls in front of a ledge between it and the hero). */
export function courseSolids(run: PortalRun, x: number, _y: number, z: number, out: AABB[]): number {
   let n = 0;
   for (const i of run.course.islands) {
      if (n >= out.length) break;
      if (!islandOn(i, run.gates) || Math.hypot(i.x - x, i.z - z) > SOLID_REACH + i.r) continue;
      // the slab, and under a plateau or a pillar its whole glass column (CourseView draws it that deep)
      const column = i.look === "plateau" || i.look === "pillar";
      const r = i.r * (column ? 0.82 : 0.85);
      const b = out[n++];
      b.min.x = i.x - r;
      b.max.x = i.x + r;
      b.min.y = i.y - (column ? ISLAND_SY * 0.6 + Math.min(14, i.y + 6) : ISLAND_SY * 0.8);
      b.max.y = i.y - 0.05;
      b.min.z = i.z - r;
      b.max.z = i.z + r;
   }
   return n;
}

/**
 * Is this anchor (its obelisk and an exit on it) between the camera and the hero? True while the camera
 * stands behind the exit (its back half) and the hero is close in front of it: just out of the portal,
 * the chase camera would look through solid stone. The anchor is hidden then.
 */
export function anchorBlocksView(pose: Pick<ExitPose, "ax" | "az" | "dx" | "dz">, cam: { x: number; z: number }, hero: { x: number; z: number }): boolean {
   const len = Math.hypot(pose.dx, pose.dz) || 1;
   const fx = pose.dx / len;
   const fz = pose.dz / len;
   const camAlong = (cam.x - pose.ax) * fx + (cam.z - pose.az) * fz;
   const heroAlong = (hero.x - pose.ax) * fx + (hero.z - pose.az) * fz;
   const heroNear = Math.hypot(hero.x - pose.ax, hero.z - pose.az) < 9;
   return camAlong < 0.6 && heroAlong > 0 && heroNear && Math.hypot(cam.x - pose.ax, cam.z - pose.az) < 14;
}
