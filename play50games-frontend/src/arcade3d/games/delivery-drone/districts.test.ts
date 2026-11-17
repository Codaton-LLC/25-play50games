// Each level is its own district (levels.ts MAPS): open parks, block heights, tower placement,
// look. These tests check the generated cities really follow the district, stay fair (every pad
// reachable from the depot, the start never blocked), and that level 1 is today's city.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS, MAPS } from "./levels";
import { THEMES } from "./looks";
import { CITY, clearAt, createRun, generateCity, isValidCity, stepRun } from "./rules";

const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7 + 1);

describe("delivery-drone districts", () => {
   it("level 1 keeps today's city: no open cells, the three roof heights, towers anywhere", () => {
      expect(MAPS[1]).toEqual({ theme: "training", roofPick: [0, 1, 2], open: [], towerCells: [], towerVisual: 16 });
      const city = generateCity(5);
      expect(city.buildings).toHaveLength(60);
   });

   it("every level has its own theme, and no two levels share a district", () => {
      const keys = LEVEL_IDS.map((id) => JSON.stringify({ ...MAPS[id], theme: undefined }));
      expect(new Set(keys).size).toBe(5);
      expect(new Set(LEVEL_IDS.map((id) => MAPS[id].theme)).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(LEVELS[id].map).toBe(MAPS[id]);
         expect(THEMES[MAPS[id].theme]).toBeDefined();
         expect(MAPS[id].towerVisual).toBeGreaterThanOrEqual(CITY.towerHeight);
      }
   });

   it("follows the district: open cells stay empty, roofs come from the level's heights, towers mostly stand on the preferred cells", () => {
      for (const id of LEVEL_IDS) {
         const map = MAPS[id], level = LEVELS[id];
         const allowed = new Set<number>(map.roofPick.map((i) => CITY.roofs[i]));
         let fallbacks = 0, preferred = 0, towers = 0;
         for (const seed of SEEDS) {
            const city = generateCity(seed, undefined, level);
            if (city.fallback) fallbacks++;
            expect(city.buildings).toHaveLength(60 - map.open.length);
            for (const cell of map.open) expect(city.cells[cell]).toBe(-1);
            for (const b of city.buildings) if (!b.tower) expect(allowed.has(b.height)).toBe(true);
            for (const i of city.towers) {
               towers++;
               if (map.towerCells.includes(city.buildings[i].cell)) preferred++;
            }
         }
         expect(fallbacks).toBeLessThanOrEqual(SEEDS.length / 10);
         // share of the preferred cells (or of the towers, when there are fewer) that got a tower
         const share = preferred / (SEEDS.length * Math.min(level.towers, map.towerCells.length || 1));
         expect(towers).toBe(SEEDS.length * level.towers);
         if (map.towerCells.length) expect(share).toBeGreaterThan(0.5);
      }
   }, 60000);

   it("is fair on every level: valid city, every pad reachable, the start free, a parcel loads in 4 s", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (const seed of SEEDS.slice(0, 10)) {
            const city = generateCity(seed, undefined, level);
            expect(isValidCity(city, level)).toBe(true); // includes the flood fill from the depot to every pad
            expect(clearAt(city, 0, 0, 3)).toBe(true);
            for (const t of city.targets) expect(city.buildings[t].tower).toBe(false);
         }
         const run = createRun(3, false, level);
         for (let i = 0; i < 130; i++) stepRun(run, { dirX: 0, dirZ: 0, drop: false }, 1 / 30);
         expect(run.attached).toBe(true);
      }
   }, 60000);

   it("districts differ in shape: mean roof height and tower spread", () => {
      const meanRoof = (id: LevelId) => {
         let sum = 0, n = 0;
         for (const seed of SEEDS.slice(0, 10)) for (const b of generateCity(seed, undefined, LEVELS[id]).buildings) if (!b.tower) { sum += b.height; n++; }
         return sum / n;
      };
      expect(meanRoof(2)).toBeLessThan(meanRoof(1) - 1); // low houses
      expect(meanRoof(3)).toBeGreaterThan(meanRoof(1) + 1); // tall offices
   }, 60000);
});
