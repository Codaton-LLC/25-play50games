// Each level is its own canyon (audit levels-variety): the five decorSpots outputs, the sky/river
// palettes and the set pieces differ per level; every prop stays out of the play area; level 1 is
// byte-identical to the map it shipped with (sha256 of the original spot lists, pinned here).
import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { GLB_SIZE } from "./assets";
import { LEVELS } from "./levels";
import { DECOR_CLEAR_X, DECOR_PERIOD, WATER_Y, backdropFor, decorSpots } from "./looks";

/** The six spot lists level 1 shipped with, hashed in their original key order. */
function legacyHash(d: ReturnType<typeof decorSpots>): string {
   const legacy = { rocks: d.rocks, trees: d.trees, ferns: d.ferns, plants: d.plants, vines: d.vines, stilts: d.stilts };
   return createHash("sha256").update(JSON.stringify(legacy)).digest("hex").slice(0, 16);
}

describe("jungle-bridge-run canyon themes", () => {
   const decor = Object.fromEntries(LEVEL_IDS.map((id) => [id, decorSpots(id, LEVELS[id])])) as Record<LevelId, ReturnType<typeof decorSpots>>;

   it("level 1 is the map it shipped with: the original six spot lists, no set pieces", () => {
      expect(legacyHash(decor[1])).toBe("c1aae2bc4a4d3d65");
      expect(LEVELS[1].canyon).toBe("path");
      for (const key of ["ropeBridges", "falls", "mist", "colonnade", "lavafalls", "embers"] as const) expect(decor[1][key]).toEqual([]);
   });

   it("every level's canyon, sky and river palette differ from every other level's", () => {
      for (let a = 0; a < LEVEL_IDS.length; a++) {
         for (let b = a + 1; b < LEVEL_IDS.length; b++) {
            const idA = LEVEL_IDS[a];
            const idB = LEVEL_IDS[b];
            expect(JSON.stringify(decor[idA]), `L${idA} vs L${idB}`).not.toBe(JSON.stringify(decor[idB]));
            expect(`${LEVELS[idA].canyon}|${LEVELS[idA].skyTop}|${LEVELS[idA].water}`).not.toBe(`${LEVELS[idB].canyon}|${LEVELS[idB].skyTop}|${LEVELS[idB].water}`);
         }
      }
      expect(new Set(LEVEL_IDS.map((id) => LEVELS[id].canyon)).size).toBe(5);
   });

   it("each themed level carries its own set pieces", () => {
      expect(decor[2].ropeBridges.length).toBeGreaterThan(0);
      expect(decor[3].falls.length).toBeGreaterThan(0);
      expect(decor[3].mist.length).toBe(decor[3].falls.length);
      expect(decor[4].colonnade.length).toBeGreaterThan(0);
      expect(decor[5].lavafalls.length).toBeGreaterThan(0);
      expect(decor[5].embers.length).toBeGreaterThan(0);
      // and no level borrows another's set piece
      expect(decor[1].ropeBridges.length + decor[3].ropeBridges.length + decor[4].ropeBridges.length + decor[5].ropeBridges.length).toBe(0);
      expect(decor[4].colonnade.every((p) => p.rotY === 0)).toBe(true);
   });

   it("the set pieces stay out of the play area: nothing new above the deck within DECOR_CLEAR_X", () => {
      const pillarHalfW = (s: number) => (GLB_SIZE.templePillarV2.width / GLB_SIZE.templePillarV2.height) * s * 0.5;
      for (const id of LEVEL_IDS) {
         const d = decor[id];
         for (const list of Object.values(d)) for (const spot of list) {
            expect(spot.z).toBeGreaterThanOrEqual(0);
            expect(spot.z).toBeLessThan(DECOR_PERIOD);
         }
         // the below-deck rope bridges never reach the deck's level
         for (const r of d.ropeBridges) expect(r.y + 0.95).toBeLessThanOrEqual(-0.3);
         // tall sheets (falls, lava streams) stand beyond the clear strip, like the backdrop
         for (const f of [...d.falls, ...d.lavafalls]) expect(Math.abs(f.x) - (f.sx ?? 1) / 2).toBeGreaterThanOrEqual(DECOR_CLEAR_X - 0.5);
         // mist hugs the water
         for (const m of d.mist) expect(m.y + (m.sy ?? 1) / 2).toBeLessThanOrEqual(-0.3);
         // the colonnade and the embers keep the clear strip too
         for (const p of d.colonnade) expect(Math.abs(p.x) - pillarHalfW(p.scale ?? 1)).toBeGreaterThanOrEqual(DECOR_CLEAR_X - 0.5);
         for (const e of d.embers) expect(Math.abs(e.x) - (e.scale ?? 1) / 2).toBeGreaterThanOrEqual(DECOR_CLEAR_X - 0.5);
         // nothing peeks above the deck near the water line
         for (const m of [...d.mist]) expect(m.y).toBeGreaterThanOrEqual(WATER_Y - 1);
      }
   });

   it("the backdrops stay level-specific", () => {
      expect(LEVEL_IDS.map((id) => backdropFor(LEVELS[id])?.kind ?? null)).toEqual([null, null, "waterfall", null, "volcano"]);
   });
});
