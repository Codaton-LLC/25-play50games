// The five places (levels.ts site + kinds, looks.ts THEMES): each level has its own light, sky, snow,
// bank scenery and obstacle mix; level 1 is today's pick (one draw, floor(u * 3)); the mix only picks
// the kind for a slot the generator already placed, so every chunk still keeps the reserved corridor
// (validChunk) and the proof's inputs; the bank scenery stands clear of the track.
import { describe, expect, it, vi } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import definition from "./index";
import { LEVELS, kindIndex } from "./levels";
import { BANK_LATERAL, THEMES, type BankProp } from "./looks";
import { COURSE, generateChunk, validChunk, type Entry } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const ENTRY: Entry = { x: 0, y: 0, z: 0, heading: 0, grade: 0.05, corridor: 0 };
const KINDS = ["ice", "snowman", "crack"] as const;

describe("penguin-slide places", () => {
   it("level 1 picks the obstacle kind exactly as before: floor(u * 3) from the same draw", () => {
      const rng = createRng(11);
      for (let i = 0; i < 2000; i++) {
         const u = rng();
         expect(kindIndex(LEVELS[1], u)).toBe(Math.floor(u * 3));
      }
      for (const id of LEVEL_IDS) for (const u of [0, 0.3333, 0.5, 0.9999]) expect(kindIndex(LEVELS[id], u)).toBeGreaterThanOrEqual(0);
   });

   for (const id of LEVEL_IDS) {
      it(`L${id} (${LEVELS[id].site}): the obstacle mix follows its weights and every chunk keeps the corridor`, () => {
         const level = LEVELS[id];
         const count = [0, 0, 0];
         let total = 0;
         let chunks = 0;
         for (let seed = 1; seed <= 200; seed++) {
            for (const elapsed of [20, 90, 170]) {
               const c = generateChunk(seed, 3, ENTRY, elapsed, 0, validChunk, level);
               chunks++;
               // the reserved corridor, spacing, budgets: an accepted chunk or the tested fallback
               expect(c.fallback || validChunk(c)).toBe(true);
               for (const o of c.obstacles) {
                  count[KINDS.indexOf(o.kind)]++;
                  total++;
               }
            }
         }
         expect(chunks).toBe(600);
         const w = level.kinds;
         const sum = w[0] + w[1] + w[2];
         for (let k = 0; k < 3; k++) expect(Math.abs(count[k] / total - w[k] / sum), `${KINDS[k]}`).toBeLessThan(0.05);
      });
   }

   it("the five levels are five different places: light, sky, snow, scenery and obstacle mix", () => {
      const sites = LEVEL_IDS.map((id) => LEVELS[id].site);
      expect(new Set(sites).size).toBe(5);
      expect(new Set(sites.map((s) => THEMES[s].skyTop)).size).toBe(5);
      expect(new Set(sites.map((s) => THEMES[s].lighting)).size).toBeGreaterThanOrEqual(3);
      expect(new Set(sites.map((s) => THEMES[s].bank)).size).toBeGreaterThanOrEqual(4);
      expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(LEVELS[id].kinds))).size).toBe(5);
      // level 1 keeps today's look; the others carry their own environment on the start card
      expect(THEMES.snowHill).toMatchObject({ lighting: "snow", bank: "pine", snow: 1 });
      expect(definition.levels![0].environment).toBeUndefined();
      for (const spec of definition.levels!.slice(1)) {
         const t = THEMES[LEVELS[spec.id].site];
         expect(spec.environment).toEqual({ background: t.skyBottom, fog: [t.fog, 25, 56], lighting: t.lighting });
      }
      expect(THEMES.auroraRun.aurora && THEMES.auroraRun.stars).toBe(true);
      expect(THEMES.iceCave.snow).toBe(0);
   });

   it("each new bank prop stands clear of the widest track (3.5 m half-width) by half a metre at its largest size", () => {
      const radius: Record<Exclude<BankProp, "pine">, number> = {
         auroraCrystal: 0,
         rock: (EXPANSION_GLB_SIZE.rock.width * (ASSETS.rock.scale ?? 1)) / 2,
         glacierChunk: 1.4,
      };
      // the crystal's fitted width from its asset (2.4 m tall spire)
      radius.auroraCrystal = (1.62 / 1.9114) * 2.4 / 2;
      for (const prop of ["auroraCrystal", "rock", "glacierChunk"] as const) {
         const largest = radius[prop] * 1.2;
         expect(BANK_LATERAL[prop] - largest, prop).toBeGreaterThanOrEqual(COURSE.width + 0.5);
      }
      expect(BANK_LATERAL.pine).toBe(5.2);
   });
});
