// Each level is its own farm (theme → LOOKS + apron scenery). Apron props never enter the
// play yard; level 1 keeps today's decor and empty apron; mud pits are drawn when mud > 0.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   APRON_GAP,
   LOOKS,
   COLORS,
   decorAt,
   fogFor,
   inPlayYard,
   lookFor,
   mudPitSpots,
   scenerySpots,
} from "./looks";
import { createRun } from "./rules";

describe("farm-tractor-challenge level looks", () => {
   it("every level has its own theme, ground tones and scenery; level 1 is today's yard", () => {
      expect(new Set(LEVEL_IDS.map((id) => LEVELS[id].theme)).size).toBe(5);
      expect(LEVELS[1].theme).toBe("yard");
      expect(lookFor(LEVELS[1])).toEqual(LOOKS.yard);
      expect(LOOKS.yard.grass).toBe(COLORS.grass);
      expect(LOOKS.yard.soil).toBe(COLORS.soil);
      expect(LOOKS.yard.scenery).toBe("yard");
      const soils = LEVEL_IDS.map((id) => LOOKS[LEVELS[id].theme].soil);
      expect(new Set(soils).size).toBe(5);
      const scenery = LEVEL_IDS.map((id) => LOOKS[LEVELS[id].theme].scenery);
      expect(new Set(scenery).size).toBe(5);
      expect(LEVEL_IDS.map((id) => fogFor(LEVELS[id])[0])).toEqual(LEVEL_IDS.map((id) => LEVELS[id].background));
   });

   it("level 1 fog and decor match today's Farm Yard", () => {
      const level = LEVELS[1];
      const halfW = level.width / 2;
      const halfD = level.depth / 2;
      expect(fogFor(level)).toEqual(["#bae6fd", 48, 120 + Math.max(level.width, level.depth)]);
      expect(decorAt(level)).toEqual({
         silo: { x: -halfW - 2.6, z: halfD - 0.4 },
         trough: { x: halfW + 2.4, z: halfD - 1.6 },
         scarecrow: { x: halfW + 2.3, z: halfD - 5.2 },
         crate: { x: -halfW - 2.4, z: halfD - 4.4 },
         barn: { x: 0, z: halfD - 0.8 },
      });
      const apron = scenerySpots(level);
      expect(apron.wheatStems).toHaveLength(0);
      expect(apron.wheatHeads).toHaveLength(0);
      expect(apron.trees).toHaveLength(0);
      expect(apron.hayStacks).toHaveLength(0);
      expect(apron.crates).toHaveLength(0);
      expect(apron.silos).toHaveLength(0);
      expect(apron.scarecrows).toHaveLength(0);
      expect(apron.troughs).toHaveLength(0);
      expect(apron.planks).toHaveLength(0);
   });

   it("set pieces match the level name: wheat rows, orchard trees, mud planks, mega densifies", () => {
      const wheat = scenerySpots(LEVELS[2]);
      expect(wheat.wheatStems.length).toBeGreaterThan(40);
      expect(wheat.wheatHeads.length).toBe(wheat.wheatStems.length);
      expect(wheat.hayStacks.length).toBeGreaterThan(0);
      expect(wheat.trees).toHaveLength(0);

      const orchard = scenerySpots(LEVELS[3]);
      expect(orchard.trees.length).toBeGreaterThanOrEqual(6);
      expect(orchard.crates.length).toBeGreaterThan(0);
      expect(orchard.wheatStems).toHaveLength(0);

      const mud = scenerySpots(LEVELS[4]);
      expect(mud.planks.length).toBeGreaterThan(0);
      expect(mud.wheatStems).toHaveLength(0);
      expect(mud.trees).toHaveLength(0);

      const mega = scenerySpots(LEVELS[5]);
      expect(mega.wheatStems.length).toBeGreaterThan(wheat.wheatStems.length);
      expect(mega.trees.length).toBeGreaterThan(0);
      expect(mega.silos.length).toBeGreaterThan(0);
      expect(mega.planks.length).toBeGreaterThan(0);
      expect(mega.hayStacks.length).toBeGreaterThan(wheat.hayStacks.length);

      const signatures = LEVEL_IDS.map((id) => {
         const s = scenerySpots(LEVELS[id]);
         return JSON.stringify({
            wheat: s.wheatStems.length,
            trees: s.trees.length,
            planks: s.planks.length,
            silos: s.silos.length,
            crates: s.crates.length,
            theme: LEVELS[id].theme,
         });
      });
      expect(new Set(signatures).size).toBe(5);
   });

   it("mud pits draw bed + wet + rim when the level has mud; none on L1–L3", () => {
      for (const id of [1, 2, 3] as const) {
         const run = createRun(1, LEVELS[id]);
         const pits = mudPitSpots(run.mud);
         expect(pits.beds).toHaveLength(0);
         expect(pits.wet).toHaveLength(0);
         expect(pits.rims).toHaveLength(0);
      }
      for (const id of [4, 5] as const) {
         const run = createRun(1, LEVELS[id]);
         expect(run.mud.length).toBe(LEVELS[id].mud);
         const pits = mudPitSpots(run.mud);
         expect(pits.beds.length).toBe(run.mud.length);
         expect(pits.wet.length).toBe(run.mud.length);
         expect(pits.rims.length).toBe(run.mud.length * 4);
      }
   });

   it("apron scenery stays outside the fenced yard by APRON_GAP", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const decor = decorAt(level);
         for (const spot of [decor.silo, decor.trough, decor.scarecrow, decor.crate]) {
            // barn sits on the bay strip (inside the north fence by design); other props are apron
            expect(
               inPlayYard(level, spot.x, spot.z, APRON_GAP - 0.05),
               `L${id} decor at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) inside play`,
            ).toBe(false);
         }
         // barn is on the bay (inside): only check it is near the north fence
         expect(Math.abs(decor.barn.x)).toBeLessThan(1);
         expect(decor.barn.z).toBeGreaterThan(level.depth / 2 - 2);

         const scenery = scenerySpots(level);
         const all = [
            ...scenery.wheatStems,
            ...scenery.wheatHeads,
            ...scenery.trees,
            ...scenery.hayStacks,
            ...scenery.crates,
            ...scenery.silos,
            ...scenery.scarecrows,
            ...scenery.troughs,
            ...scenery.planks,
         ];
         for (const spot of all) {
            expect(
               inPlayYard(level, spot.x, spot.z, APRON_GAP - 0.05),
               `L${id} apron at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) inside play`,
            ).toBe(false);
         }
      }
   });

   it("level 1 play rules stay identical (width, trips, lives, no mud/trees, hay cargo)", () => {
      const l1 = LEVELS[1];
      expect(l1).toMatchObject({
         width: 28, depth: 22, trips: 2, balesPerTrip: 1, mud: 0, trees: 0,
         cargo: "hay", durationMs: 120_000, lives: 6, lighting: "day", background: "#bae6fd", theme: "yard",
      });
      const run = createRun(7, l1);
      expect(run.mud).toHaveLength(0);
      expect(run.trees).toHaveLength(0);
      expect(run.bales).toHaveLength(2);
      expect(run.lives).toBe(6);
   });
});
