// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero (mouse drag, two fingers, keys); the stick is
// camera-relative (StepInput.yaw = orbit.viewYaw). The card: "the camera orbits with you, so the pole
// stays centred and the world turns" — after 1.2 s without a manual turn the yaw eases out behind the
// hero's own angle round his pole (followPole), with the card's motion-sickness fixes: a lag, a level
// horizon and a capped yaw speed. Any drag, key or pinch wins at once.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, wrapAngle, type OrbitSettings, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { helixTop, type Course } from "./course";
import { GLB_SIZE } from "./assets";
import type { SpinRun } from "./rules";

const DEG = Math.PI / 180;
export const FOV = 52;
export const FOV_PORTRAIT = 64;
/** the follow starts after this long without a manual turn (s), eases at FOLLOW_RATE, never faster than FOLLOW_MAX */
export const FOLLOW_DELAY = 1.2;
export const FOLLOW_RATE = 2.4;
export const FOLLOW_MAX = 1.6;

/** The orbit's tuning: a little above, 7.5 m out, zoom 4-16 m; the shared auto-follow is off (followPole does it). */
export function spinOrbit(course: Course): Partial<OrbitSettings> {
   const a = course.start.at;
   return { yaw: a, pitch: (course.cfg.boss ? 14 : 18) * DEG, distance: course.cfg.tower ? 9.5 : 7.5, minDistance: 4, maxDistance: 16, autoFollow: false };
}

/** The camera swings out behind the hero's angle round his pole once the player leaves it alone. */
export function followPole(o: OrbitState, heroAngle: number, dt: number): void {
   if (o.idle < FOLLOW_DELAY || o.recentering) return;
   const err = wrapAngle(heroAngle - o.yaw);
   const step = Math.max(-FOLLOW_MAX * dt, Math.min(FOLLOW_MAX * dt, err * (1 - Math.exp(-FOLLOW_RATE * dt))));
   o.yaw = wrapAngle(o.yaw + step);
}

/** How much farther the orbit stands on a portrait screen (the climb is tall, the screen narrow). */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.35 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.5 + 0.6 * portrait;
}

/** The pivot: the hero's chest, led a little up (the next steps above are in view). */
export function heroPivot(h: { x: number; y: number; z: number; vy: number }, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = h.x;
   out.y = h.y + 1.2 + Math.max(-1, Math.min(1.2, h.vy * 0.06));
   out.z = h.z;
   return out;
}

/** The orbit's first pose: out behind the hero at the foot of the first pole (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const o = spinOrbit(course);
   const d = (o.distance ?? 7.5) * orbitScale(aspect);
   const h = course.helices[course.start.helix];
   const p = course.poles[h.pole];
   const a = course.start.at;
   const pv = heroPivot({ x: p.x + p.walk * Math.sin(a), y: h.y0, z: p.z + p.walk * Math.cos(a), vy: 0 }, { x: 0, y: 0, z: 0 });
   const cam = orbitPosition(pv.x, pv.y, pv.z, o.yaw ?? 0, o.pitch ?? 0, d, { x: 0, y: 0, z: 0 });
   return { position: [cam.x, cam.y, cam.z], lookAt: [pv.x, pv.y + orbitLookUp(aspect), pv.z] };
}

/** The fly-through: high over the field (the goal cap), spiralling down past the poles, to the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   let cx = 0;
   let cz = 0;
   for (const p of course.poles) {
      cx += p.x;
      cz += p.z;
   }
   cx /= course.poles.length;
   cz /= course.poles.length;
   const top = course.top;
   return [
      { position: [cx + 14, top + 8, cz + 14], lookAt: [cx, top - 2, cz] },
      { position: [cx - 12, top * 0.55 + 3, cz + 10], lookAt: [cx, top * 0.45, cz] },
      { position: [cx + 4, 4, cz + 13], lookAt: [cx, 2, cz] },
   ];
}

const SOLID_REACH = 22;

/**
 * Fills `out` with what stands near the camera as boxes (the camera pulls in front of one between it
 * and the hero): every other pole's core, and every cap (the hero's own pole's too: a turn or a
 * two-finger drag must not leave the camera inside a mushroom dome or under a platform). A cap's box
 * is the dome's upper part only (the stair runs under the rest), and a box the pivot starts inside
 * never counts (menu2/camera rayBoxDistance).
 */
export function courseSolids(run: SpinRun, x: number, _y: number, z: number, out: AABB[]): number {
   let n = 0;
   const c = run.course;
   const own = c.helices[run.hero.helix].pole;
   for (const h of c.helices) {
      if (n >= out.length) break;
      const p = c.poles[h.pole];
      if (p.ghost || Math.hypot(p.x - x, p.z - z) > SOLID_REACH) continue;
      const r = p.walk + 0.35;
      const top = helixTop(h);
      const depth = p.mushroom && !h.goal ? 0.4 * (r * 2) * (GLB_SIZE.mushroom.y / GLB_SIZE.mushroom.x) : 0.3;
      const b = out[n++];
      b.min.x = p.x - r;
      b.max.x = p.x + r;
      b.min.y = top - depth;
      b.max.y = top;
      b.min.z = p.z - r;
      b.max.z = p.z + r;
   }
   for (const p of c.poles) {
      if (n >= out.length) break;
      // the hero's own pole is behind him: the camera never needs it, and it would squeeze the view on a turn
      if (p.id === own || p.ghost) continue;
      if (Math.hypot(p.x - x, p.z - z) > SOLID_REACH) continue;
      let top = 0;
      for (const h of c.helices) if (h.pole === p.id) top = Math.max(top, helixTop(h));
      const r = p.core * 0.8;
      const b = out[n++];
      b.min.x = p.x - r;
      b.max.x = p.x + r;
      b.min.y = -1;
      b.max.y = top;
      b.min.z = p.z - r;
      b.max.z = p.z + r;
   }
   return n;
}
