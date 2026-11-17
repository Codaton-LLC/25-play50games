// Each level's airport (TarmacSets.tsx): every parked plane stands beyond the north window, outside
// the play area; the five levels differ (level 1 is today's hall).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { GATE_PLANES } from "./TarmacSets";
import { PLAY_AREA } from "./looks";
import { ASSETS } from "./assets";

describe("luggage-rush level airports", () => {
   it("every parked plane stands beyond the north window wall (z -2.5), clear of the play area", () => {
      const base = Math.max(EXPANSION_GLB_SIZE.plane.width, EXPANSION_GLB_SIZE.plane.depth) * (ASSETS.plane.scale ?? 1);
      for (const id of LEVEL_IDS) for (const p of GATE_PLANES[id]) {
         const r = (base * p.scale) / 2;
         expect(p.z + r, `L${id} plane at (${p.x}, ${p.z})`).toBeLessThan(-2.8);
         expect(p.z + r).toBeLessThan(PLAY_AREA.minZ);
      }
   });
   it("the five levels differ: level 1 has none, then 2, 4, 4 and 5 planes", () => {
      expect(LEVEL_IDS.map((id) => GATE_PLANES[id].length)).toEqual([0, 2, 4, 4, 5]);
      expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(GATE_PLANES[id]))).size).toBe(5);
   });
});
