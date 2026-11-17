// The camera and the intro's shots. Play uses the shared Menu 2 orbit (menu2/camera): behind and
// above the hero, steep enough to read the train's shape on the floor (the whole game is path shape).
// The vault and pocket walls, the cracked wall, the pedestals and the Glutton are its solids. On
// level 5, while the orbit is idle, the yaw swings to keep the Glutton in shot (as in Toy Room Run).
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, wrapAngle, yawBehind, type OrbitSettings, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import type { ClipOptions } from "@/arcade3d/menu2/camera/orbitCollision";
import { guidePoint, type GemRun } from "./rules";
import type { Arena } from "./arena";

const DEG = Math.PI / 180;

export function vaultOrbit(arena: Arena): Partial<OrbitSettings> {
   return { yaw: arena.startYaw, pitch: (arena.spec.boss ? 46 : 42) * DEG, distance: arena.spec.boss ? 13 : 11.5, minDistance: 5, maxDistance: 26 };
}

export const VAULT_COLLISION: ClipOptions = { radius: 0.35, minDistance: 1.6, squeeze: 0.45, liftTo: 64 * DEG };

export const FOV = 52;
export const FOV_PORTRAIT = 62;

export function portraitAmount(aspect: number): number {
   return Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
}

export function orbitScale(aspect: number): number {
   return 1 + 0.3 * portraitAmount(aspect);
}

export function orbitLookUp(aspect: number): number {
   return 0.3 + 0.3 * portraitAmount(aspect);
}

const guide = { x: 0, y: 0, z: 0 };

/** The hero's chest, led a little toward the next thing to do (a gem, a beacon, the Glutton). */
export function orbitPivot(run: GemRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const h = run.hero;
   guidePoint(run, guide);
   const dx = guide.x - h.x;
   const dz = guide.z - h.z;
   const d = Math.hypot(dx, dz);
   const lead = Math.min(2, d * 0.15);
   out.x = h.x + (d > 0.01 ? (dx / d) * lead : 0);
   out.y = Math.max(h.y, -1) + 1;
   out.z = h.z + (d > 0.01 ? (dz / d) * lead : 0);
   return out;
}

/** Level 5: with no recent manual input the yaw eases to look from the hero toward the Glutton. */
export const BOSS_FRAME = { yawRate: 2, minGap: 3 } as const;

export function steerBossFraming(orbit: OrbitState, run: GemRun, dt: number): boolean {
   const b = run.boss;
   if (!(dt > 0) || !b || b.hp <= 0) return false;
   if (orbit.recentering || orbit.idle < orbit.settings.autoFollowDelay) return false;
   const g = run.glutton;
   const dx = g.x - run.hero.x;
   const dz = g.z - run.hero.z;
   if (Math.hypot(dx, dz) < BOSS_FRAME.minGap) return false;
   const err = wrapAngle(yawBehind(dx, dz) - orbit.yaw);
   orbit.yaw = wrapAngle(orbit.yaw + err * (1 - Math.exp(-BOSS_FRAME.yawRate * dt)));
   return true;
}

export function playCamera(arena: Arena, aspect: number): IntroKeyframe {
   const o = vaultOrbit(arena);
   const p = { x: arena.startX, y: 1, z: arena.startZ };
   const c = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, (o.distance ?? 11) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** High over the vault, round the rim, down onto the start. */
export function introKeyframes(arena: Arena): IntroKeyframe[] {
   const r = arena.radius;
   return [
      { position: [0, r * 1.8, r * 1.1], lookAt: [0, 0, 0] },
      { position: [-r * 1.1, r * 0.7, -r * 0.2], lookAt: [0, 0, 0] },
      { position: [arena.startX + 3, 6, arena.startZ - 7], lookAt: [arena.startX, 1, arena.startZ + 8] },
   ];
}

/** The solid boxes near the camera: walls (an unbroken cracked wall), pedestals, the Glutton. */
export function arenaSolids(run: GemRun, x: number, z: number, out: AABB[]): number {
   let n = 0;
   const a = run.arena;
   const add = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
      if (n >= out.length) return;
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      if ((mx - x) ** 2 + (mz - z) ** 2 > 30 * 30) return;
      const b = out[n++];
      b.min.x = x0;
      b.max.x = x1;
      b.min.y = y0;
      b.max.y = y1;
      b.min.z = z0;
      b.max.z = z1;
   };
   for (const s of a.solids) {
      if (s.kind === "cracked" && run.wallBroken[s.index]) continue;
      add(s.x0, s.x1, 0, 2.6, s.z0, s.z1);
   }
   for (const p of a.pedestals) add(p.x - 0.8, p.x + 0.8, 0, p.h, p.z - 0.8, p.z + 0.8);
   if (run.boss && run.boss.hp > 0 && run.boss.phase !== 1) add(run.glutton.x - 1.1, run.glutton.x + 1.1, 0, 2.8, run.glutton.z - 1.1, run.glutton.z + 1.1);
   return n;
}
