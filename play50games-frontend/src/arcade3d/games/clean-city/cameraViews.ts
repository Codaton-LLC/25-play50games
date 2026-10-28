import type { AABB } from "@/arcade3d/core/collision";
import { MAPS, hazardX } from "./rules";
import { EXTRA_BINS, HAZARDS, LEVELS, type CleanLevel } from "./levels";
import { CAR_SPOTS, TAXI_SPOTS, VAN_SPOTS } from "./decorSpots";

/** Portrait follows the cleaner closely; landscape keeps the existing level overview. */
export function phoneOffset(offset: [number, number, number], aspect: number): [number, number, number] {
   const scale = aspect < 1 ? 3 / Math.hypot(...offset) : 1;
   return [offset[0] * scale, offset[1] * scale, offset[2] * scale];
}

const HEIGHT = { tree: 2.4, bench: 1.1, bin: 1.5, building: 2.82, lamp: 2.6, palm: 3.5, pole: 2.8 };

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
   for (let i = 0; i < level.extraBins; i++) put(EXTRA_BINS[i].x, EXTRA_BINS[i].z, 0.7, 0.7, 1.5);
   for (let i = 0; i < level.hazards; i++) put(hazardX(i, simMs), HAZARDS[i].z, 0.7, 0.7, 1.5);
   // Cars face across the far street; their long axis is world x.
   if (map === 1) {
      for (const p of CAR_SPOTS) put(p.x, p.z, 1.09, 0.455, 0.8);
      for (const p of TAXI_SPOTS) put(p.x, p.z, 1.21, 0.475, 0.9);
      for (const p of VAN_SPOTS) put(p.x, p.z, 1.5, 0.515, 1);
   }
   return n;
}
