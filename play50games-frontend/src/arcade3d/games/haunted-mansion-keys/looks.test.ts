// The camera window, the fog measured from the fitted camera, and the grounds decor (pure fitView).
import { describe, expect, it } from "vitest";
import { fitView } from "@/arcade3d/core/view";
import { LEVEL_IDS } from "@/arcade3d/types";
import { FIT } from "./assets";
import { LEVELS } from "./levels";
import { FOG_NEAR, FOV, HEDGE_GAP, SOUTH_DECOR_MAX_H, TREE_GAP, aimBounds, fogFor, groundsSpots, viewFor, viewWindow } from "./looks";
import { ROOM_D, ROOM_W } from "./rules";

const SCREENS = [
   { w: 390, h: 844, portrait: true },
   { w: 1280, h: 800, portrait: false },
] as const;

describe("haunted-mansion-keys camera and fog", () => {
   it("at 390 x 844 and 1280 x 800 on every level the fog starts past the aim and the whole window is in front of full fog", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (const s of SCREENS) {
            const { distance } = fitView({ ...viewFor(id, s.portrait), width: s.w, height: s.h, fov: FOV });
            const win = viewWindow(level, s.portrait);
            const fog = fogFor(level, distance, s.portrait);
            expect(fog.near, `L${id} ${s.w}x${s.h}`).toBeGreaterThanOrEqual(distance + win.z * 0.5 - 1e-9);
            expect(fog.near).toBeGreaterThanOrEqual(FOG_NEAR);
            // the far edge of the window is still short of full fog (L5's black screen on a phone)
            expect(fog.far, `L${id} ${s.w}x${s.h}`).toBeGreaterThan(distance + win.z + 4);
            expect(fog.far - fog.near).toBeCloseTo(level.fogFar - FOG_NEAR, 9);
         }
      }
   });

   it("portrait comes in close: the detective is at least 45 px tall on a 390 x 844 phone, a third taller than with the wide window", () => {
      for (const id of LEVEL_IDS) {
         const px = (portrait: boolean) => {
            const { distance } = fitView({ ...viewFor(id, portrait), width: 390, height: 844, fov: FOV });
            return (FIT.detective / (2 * distance * Math.tan(((FOV / 2) * Math.PI) / 180))) * 844;
         };
         expect(px(true), `L${id}`).toBeGreaterThanOrEqual(45);
         expect(px(true)).toBeGreaterThan(px(false) * 1.3);
      }
   });

   it("the aim stays over the house on both window shapes", () => {
      for (const id of LEVEL_IDS) {
         const w = LEVELS[id].cols * ROOM_W;
         const d = LEVELS[id].rows * ROOM_D;
         for (const portrait of [false, true]) {
            const a = aimBounds(LEVELS[id], portrait);
            expect(a.min.x).toBeGreaterThanOrEqual(-1);
            expect(a.max.x).toBeLessThanOrEqual(w + 1);
            expect(a.min.z).toBeGreaterThanOrEqual(-1);
            expect(a.max.z).toBeLessThanOrEqual(d + 1);
         }
      }
   });
});

describe("haunted-mansion-keys grounds decor", () => {
   it("the hedge rings the grounds past the gravel and stays low; trees stand on three sides, never on the camera side", () => {
      for (const id of LEVEL_IDS) {
         const w = LEVELS[id].cols * ROOM_W;
         const d = LEVELS[id].rows * ROOM_D;
         const g = groundsSpots(id);
         expect(g.hedges.length).toBe(5);
         for (const h of g.hedges) {
            expect(h.sy ?? 1).toBeLessThanOrEqual(SOUTH_DECOR_MAX_H);
            const inside = h.x > -HEDGE_GAP + 0.3 && h.x < w + HEDGE_GAP - 0.3 && h.z > -HEDGE_GAP + 0.3 && h.z < d + HEDGE_GAP - 0.3;
            expect(inside).toBe(false);
         }
         expect(g.trees.length).toBeGreaterThan(10);
         for (const t of g.trees) {
            expect(t.z).toBeLessThanOrEqual(d);
            const out = t.x <= -TREE_GAP + 1e-9 || t.x >= w + TREE_GAP - 1e-9 || t.z <= -TREE_GAP + 1e-9;
            expect(out, `L${id} tree ${t.x},${t.z}`).toBe(true);
            // sized once, by the spot (the asset is fitted to 1 m)
            expect(t.scale).toBeGreaterThanOrEqual(3);
            expect(t.scale).toBeLessThanOrEqual(5);
         }
      }
   });
});
