// The models: listed in the manifest, on disk, within budget, GLB_SIZE equal to the real (meshopt-decoded)
// meshes; the definition's levels; the progression data (stars, secrets, the Keeper); the level end
// through the progress adapter; the hero motion writer; the floor's look (a fall is the ball-roll, the
// wrong tiles fade at the warning, every colour has its symbol).
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Color } from "three";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { definitionLevelProblems } from "@/arcade3d/core/levels";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { comboConfigProblems } from "@/arcade3d/menu2/combo/combo";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { starSpecProblems } from "@/arcade3d/menu2/stars/stars";
import { memoryProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { createHeroMotion } from "@/arcade3d/menu2/heroAnim";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE } from "./assets";
import definition from "./index";
import { colorArenaSurvivalMeta } from "./meta";
import { COMBO, KEEPER, SECRETS, starSpecFor } from "./progression";
import { levelEndStats } from "./levelEnd";
import { createHeroAnim, createMotionMemo, writeHeroMotion } from "./Hero";
import { tileLook } from "./ArenaView";
import { SYMBOLS, TILE_COLORS } from "./look";
import { COLOUR_COUNT, START_MS, STEP_MS, WARN_MS, createRun, stepArena, tileSafe } from "./rules";

const PUBLIC = fileURLToPath(new URL("../../../../public", import.meta.url));
const GLB_KEY: Record<keyof typeof GLB_SIZE, string> = { keeper: "keeper", beacon: "beacon", tile: "tile", safe: "safe", gate: "gate", orb: "orb", islandB: "islandB", islandC: "islandC", islandD: "islandD" };

describe("color-arena-survival models", () => {
   for (const [key, asset] of Object.entries(ASSETS)) {
      it(`${key}: listed, on disk, within its byte budget`, () => {
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(statSync(path.join(PUBLIC, asset.url)).size).toBeLessThanOrEqual(asset.budget.bytes);
      });
   }
   for (const [key, size] of Object.entries(GLB_SIZE)) {
      it(`${key}: GLB_SIZE is the real mesh (feet on 0, centred)`, async () => {
         const { cloud } = await readCharacterGlb(ASSETS[GLB_KEY[key as keyof typeof GLB_SIZE]].url);
         const min = [Infinity, Infinity, Infinity];
         const max = [-Infinity, -Infinity, -Infinity];
         for (let i = 0; i < cloud.length; i += 3)
            for (let k = 0; k < 3; k++) {
               min[k] = Math.min(min[k], cloud[i + k]);
               max[k] = Math.max(max[k], cloud[i + k]);
            }
         expect(max[0] - min[0]).toBeCloseTo(size.x, 2);
         expect(max[1] - min[1]).toBeCloseTo(size.y, 2);
         expect(max[2] - min[2]).toBeCloseTo(size.z, 2);
         expect(min[1]).toBeCloseTo(0, 2);
      });
   }

   it("the definition's five levels match meta", () => {
      expect(definitionLevelProblems(colorArenaSurvivalMeta, definition)).toEqual([]);
      expect(definition.levels).toHaveLength(5);
   });
});

describe("progression", () => {
   it("the Keeper, the combo, the secrets and the star specs are valid", () => {
      expect(bossProblems(KEEPER)).toEqual([]);
      expect(KEEPER.phases).toHaveLength(3);
      expect(comboConfigProblems(COMBO)).toEqual([]);
      for (const id of LEVEL_IDS) {
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(starSpecProblems(starSpecFor(id))).toEqual([]);
      }
   });

   it("the level end records the run through the progress adapter", () => {
      const run = createRun(1, 1);
      run.ended = "win";
      run.finishMs = 30_000;
      const stats = levelEndStats(run, null, memoryProgressStorage());
      expect(stats.stars & 1).toBe(1);
      expect(stats.xp).toBeGreaterThan(0);
   });

   it("the hero motion writer turns a fall into the pit into the ball-roll", () => {
      const run = createRun(1, 1);
      const m = createHeroMotion();
      run.hero.grounded = false;
      run.hero.state = "fall";
      writeHeroMotion(m, createMotionMemo(), run, createHeroAnim(), 0);
      expect(m.rolling).toBe(true);
      expect(m.grounded).toBe(false);
   });
});

describe("the floor's look", () => {
   it("every colour has its symbol, and over the warning the wrong tiles fade while the called ones stay bright", () => {
      expect(SYMBOLS).toHaveLength(COLOUR_COUNT);
      const run = createRun(2, 2);
      const a = run.arena;
      while (a.simMs < START_MS + 20) stepArena(a, STEP_MS);
      while (a.phaseMs < a.callLen - WARN_MS * 0.2) stepArena(a, STEP_MS);
      const out = new Color();
      let wrong = -1;
      let safe = -1;
      for (let i = 0; i < a.colour.length; i++) {
         if (tileSafe(a, i) && safe < 0) safe = i;
         if (!tileSafe(a, i) && !a.crack[i] && !a.hole[i] && wrong < 0) wrong = i;
      }
      const base = new Color(TILE_COLORS[a.colour[wrong]]);
      tileLook(a, wrong, 0, out);
      expect(out.r + out.g + out.b).toBeLessThan(base.r + base.g + base.b);
      tileLook(a, safe, 0, out);
      const sb = new Color(TILE_COLORS[a.colour[safe]]);
      expect(out.r + out.g + out.b).toBeGreaterThanOrEqual(sb.r + sb.g + sb.b - 1e-6);
   });
});
