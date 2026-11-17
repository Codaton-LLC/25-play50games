// Per-level look tests: the five levels must look like five departments (pairwise-distinct
// environments, palettes, wall art and decor), level 1 must keep the live layout, and every decor
// prop and set piece must stay out of the play area (|x| - half-width >= LANE_EDGE), so nothing
// the runner can legally touch ever hides an obstacle or shrinks a lane.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { CORRIDOR_DECOR, LANE_EDGE, type CorridorVariant, type SetPiece } from "./decor";
import { BACKDROP_PALETTES, FLOOR_PALETTES } from "./corridorArt";
import { LEVEL_LOOKS, LEVEL_VARIANTS } from "./looks";

const VARIANTS = LEVEL_IDS.map((id) => LEVEL_VARIANTS[id]);

function pieceSpots(piece: SetPiece): Array<{ x: number; half: number; name: string }> {
   // conservative half-width: unit geometries are 1 m across (box/cylinder diameter), spheres and
   // icosahedra have a 0.5 m radius; a rotY turn can only widen the footprint, so take the max axis
   return piece.spots.map((s) => ({ x: Math.abs(s.x), half: (Math.max(s.sx ?? s.scale ?? 1, s.sz ?? s.scale ?? 1) / 2), name: piece.name }));
}

describe("office-escape level looks", () => {
   it("maps each level to its own department and keeps level 1's live environment", () => {
      expect(new Set(VARIANTS).size).toBe(5);
      expect(LEVEL_VARIANTS[1]).toBe("openOffice");
      expect(LEVEL_LOOKS[1]).toEqual({ background: "#dbeafe", fog: ["#dbeafe", 40, 75], lighting: "indoor" });
      expect(LEVEL_IDS.map((id) => LEVEL_LOOKS[id].lighting)).toEqual(["indoor", "day", "indoor", "night", "sunset"]);
   });

   it("gives every level a pairwise-distinct environment", () => {
      const envs = LEVEL_IDS.map((id) => JSON.stringify(LEVEL_LOOKS[id]));
      expect(new Set(envs).size).toBe(5);
   });

   it("gives every department a pairwise-distinct palette and decor", () => {
      const floors = VARIANTS.map((v) => JSON.stringify(FLOOR_PALETTES[v]));
      const backdrops = VARIANTS.map((v) => JSON.stringify(BACKDROP_PALETTES[v]));
      const decor = VARIANTS.map((v) => JSON.stringify(CORRIDOR_DECOR[v]));
      expect(new Set(floors).size).toBe(5);
      expect(new Set(backdrops).size).toBe(5);
      expect(new Set(decor).size).toBe(5);
   });

   it("keeps level 1's corridor exactly the live layout", () => {
      const decor = CORRIDOR_DECOR.openOffice;
      expect(decor.setPieces).toEqual([]);
      expect(decor.pillars.length).toBe(22);
      expect(decor.pillarBands.length).toBe(44);
      expect(decor.pots.length).toBe(20);
      expect(decor.leaves.length).toBe(40);
      expect(decor.cabinets.length).toBe(20);
   });

   it("gives levels 2-5 their own set pieces", () => {
      const byVariant = Object.fromEntries(LEVEL_IDS.map((id) => [LEVEL_VARIANTS[id], CORRIDOR_DECOR[LEVEL_VARIANTS[id]].setPieces.length]));
      expect(byVariant.openOffice).toBe(0);
      expect(byVariant.meeting).toBeGreaterThan(0);
      expect(byVariant.copyRoom).toBeGreaterThan(0);
      expect(byVariant.executive).toBeGreaterThan(0);
      expect(byVariant.afterHours).toBeGreaterThan(0);
   });

   it("keeps every decor prop and set piece out of the play area on every level", () => {
      for (const variant of new Set<CorridorVariant>(VARIANTS)) {
         const decor = CORRIDOR_DECOR[variant];
         const groups: Array<{ name: string; spots: Array<{ x: number; half: number }> }> = [
            { name: "pillars", spots: decor.pillars.map((s) => ({ x: Math.abs(s.x), half: Math.max(s.sx ?? 1, s.sz ?? 1) / 2 })) },
            { name: "pillarBands", spots: decor.pillarBands.map((s) => ({ x: Math.abs(s.x), half: Math.max(s.sx ?? 1, s.sz ?? 1) / 2 })) },
            { name: "pots", spots: decor.pots.map((s) => ({ x: Math.abs(s.x), half: (s.sx ?? 1) / 2 })) },
            { name: "leaves", spots: decor.leaves.map((s) => ({ x: Math.abs(s.x), half: (s.scale ?? 1) / 2 })) },
            { name: "cabinets", spots: decor.cabinets.map((s) => ({ x: Math.abs(s.x), half: Math.max(s.sx ?? 1, s.sz ?? 1) / 2 })) },
            ...decor.setPieces.map((piece) => ({ name: piece.name, spots: pieceSpots(piece) })),
         ];
         for (const group of groups) {
            for (const spot of group.spots) {
               expect(spot.x - spot.half, `${variant}/${group.name} x=${spot.x} half=${spot.half}`).toBeGreaterThanOrEqual(LANE_EDGE);
            }
         }
      }
   });
});
