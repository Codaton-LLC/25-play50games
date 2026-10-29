// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): a 3/4 view from behind the hero (the factory floor reads like a board), the player
// turns it freely; movement is camera-relative through StepInput.yaw.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { H, K, W, at, tileX, tileZ, type Floor } from "./factory";
import type { FactoryRun } from "./rules";

const DEG = Math.PI / 180;

export const FACTORY_ORBIT: Partial<OrbitSettings> = { yaw: 0, pitch: 44 * DEG, distance: 11.5, minDistance: 5, maxDistance: 24 };

export const FOV = 52;
export const FOV_PORTRAIT = 66;

export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.55 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.3 + 0.3 * portrait;
}

/** The pivot: the hero's chest, led a little towards the board's middle so the line stays in view. */
export function orbitPivot(x: number, y: number, z: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = x * 0.8;
   out.y = y + 0.9;
   out.z = z - 1.5;
   return out;
}

export function playCamera(floor: Floor, aspect: number): IntroKeyframe {
   const [sc, sr] = floor.spec.start;
   const p = orbitPivot(tileX(sc), 0, tileZ(sr), { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, FACTORY_ORBIT.yaw ?? 0, FACTORY_ORBIT.pitch ?? 0, (FACTORY_ORBIT.distance ?? 10) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** The fly-through: over the charger (or M-8), along the line, down to the start. */
export function introKeyframes(floor: Floor): IntroKeyframe[] {
   const [cc, cr] = floor.charger;
   const [dc, dr] = floor.dispenser;
   return [
      { position: [tileX(cc) + 7, 9, tileZ(cr) - 4], lookAt: [tileX(cc), 1, tileZ(cr)] },
      { position: [tileX(dc) - 6, 6.5, tileZ(dr) + 3], lookAt: [tileX(dc) + 2, 0.5, tileZ(dr) - 2] },
      { position: [0, 16, 13], lookAt: [0, 0, 0] },
   ];
}

/** The solid machinery near (x, y, z), for the orbit camera's collision. */
export function factorySolids(run: FactoryRun, x: number, y: number, z: number, out: AABB[]): number {
   const f = run.floor;
   let n = 0;
   for (let r = 0; r < H && n < out.length; r++) {
      for (let c = 0; c < W && n < out.length; c++) {
         const t = f.tiles[at(c, r)];
         if (t.k !== K.Wall && t.k !== K.Boss && t.k !== K.Charger) continue;
         const cx = tileX(c);
         const cz = tileZ(r);
         if (Math.abs(cx - x) > 14 || Math.abs(cz - z) > 14) continue;
         const b = out[n++];
         b.min.x = cx - 1;
         b.max.x = cx + 1;
         b.min.y = 0;
         b.max.y = t.top;
         b.min.z = cz - 1;
         b.max.z = cz + 1;
      }
   }
   void y;
   return n;
}
