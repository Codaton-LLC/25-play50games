import type { AABB } from "@/arcade3d/core/collision";
import { MAPS, hazardX } from "./rules";
import { EXTRA_BINS, HAZARDS, LEVELS, type CleanLevel } from "./levels";
import { CAR_SPOTS, TAXI_SPOTS, VAN_SPOTS } from "./decorSpots";

/**
 * Portrait follows the cleaner from this far (m). Tuned for the 1.75 m cleaner (real-world scale,
 * README "Real-world scale") so it stands about a quarter of a 390 x 844 screen; it was 4 for the
 * old 0.95 cleaner (1.75 / 0.95 x 4 = 7.4).
 */
export const PHONE_DISTANCE = 7.4;

/** Portrait follows the cleaner closely; landscape keeps the existing level overview. */
export function phoneOffset(offset: [number, number, number], aspect: number): [number, number, number] {
   const scale = aspect < 1 ? PHONE_DISTANCE / Math.hypot(...offset) : 1;
   return [offset[0] * scale, offset[1] * scale, offset[2] * scale];
}

/** The chosen camera views' framing of the 1.75 m cleaner (was 3.5 / 3 / 3.5 for the 0.95 one), aimed at its chest. */
export const CHARACTER_FRAMING = {
   chase: { distance: 6.4, lookUp: 0 },
   front: { distance: 5.5, lookUp: 0 },
   free: { distance: 6.4, lookUp: 0 },
   top: { distance: 35 },
} as const;
export const CHARACTER_TARGET_Y = 0.9;

/** Each kind's drawn height and a little more (assets.ts, Primitives.tsx TREE): the camera stops short of these boxes. */
const HEIGHT = { tree: 3.65, bench: 1.1, bin: 1.25, building: 2.82, lamp: 3.7, palm: 3.3, pole: 3.1 };
const BIN_HEIGHT = 1.25;

export function cameraSolids(map: number, out: AABB[], level: CleanLevel = LEVELS[1], simMs = 0): number {
   const props = MAPS[map].obstacles;
   const count = Math.min(props.length, out.length);
   for (let i = 0; i < count; i++) {
      const p = props[i], box = out[i];
      const rim = p.kind === "building" ? 0.125 : 0;
      box.min.x = p.x - p.halfX - rim;
      box.max.x = p.x + p.halfX + rim;
      box.min.y = 0;
      box.max.y = HEIGHT[p.kind];
      box.min.z = p.z - p.halfZ - rim;
      box.max.z = p.z + p.halfZ + rim;
   }
   let n = count;
   const put = (x: number, z: number, hx: number, hz: number, height: number) => {
      if (n >= out.length) return;
      const box = out[n++];
      box.min.x = x - hx; box.max.x = x + hx;
      box.min.y = 0; box.max.y = height;
      box.min.z = z - hz; box.max.z = z + hz;
   };
   for (let i = 0; i < level.extraBins; i++) put(EXTRA_BINS[i].x, EXTRA_BINS[i].z, 0.7, 0.7, BIN_HEIGHT);
   for (let i = 0; i < level.hazards; i++) put(hazardX(i, simMs), HAZARDS[i].z, 0.7, 0.7, BIN_HEIGHT);
   // Cars face across the far street; their long axis is world x.
   if (map === 1) {
      for (const p of CAR_SPOTS) put(p.x, p.z, 2.13, 0.89, 1.5);
      for (const p of TAXI_SPOTS) put(p.x, p.z, 2.36, 0.92, 1.56);
      for (const p of VAN_SPOTS) put(p.x, p.z, 2.92, 1.0, 2.07);
   }
   return n;
}
