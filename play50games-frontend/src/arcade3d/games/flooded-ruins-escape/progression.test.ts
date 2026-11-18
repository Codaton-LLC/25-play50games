// Flooded Ruins Escape's Menu 2 structure: stars, the flow meter, secrets and Umbra Roller (menu2/*).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { comboConfigProblems, comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { starSpecProblems } from "@/arcade3d/menu2/stars/stars";
import { bossProblems, hitsToDefeat } from "@/arcade3d/menu2/boss/boss";
import { COMBO, COMBO_BASE_MS, SECRETS, STAR_TARGET_MS, UMBRA_ROLLER, starSpecFor } from "./progression";
import { ORB, comboSpecOf, courseFor, createRun, createStepInput, runTimeMs, step, zoneLevel, type RuinRun } from "./rules";
import { createBot, botInput } from "./bot";

function botRun(level: LevelId): RuinRun {
   const run = createRun(1, level);
   const bot = createBot(run);
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, 1000 / 60, input);
   }
   return run;
}

describe("Flooded Ruins Escape: Menu 2 structure", () => {
   it("configs are valid: combo, stars (the card's L1 80 s ... L5 210 s), secrets, Umbra Roller (3 phases, 1 hit each)", () => {
      expect(comboConfigProblems(COMBO)).toEqual([]);
      expect(bossProblems(UMBRA_ROLLER)).toEqual([]);
      expect(UMBRA_ROLLER.phases).toHaveLength(3);
      expect(hitsToDefeat(UMBRA_ROLLER, 1)).toBe(3);
      for (const id of LEVEL_IDS) {
         expect(secretProblems(SECRETS[id]), `level ${id}`).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, courseFor(id).mainOrbs))).toEqual([]);
         // the card's 15-28 orbs per level
         expect(courseFor(id).orbs.length).toBeGreaterThanOrEqual(15);
         expect(courseFor(id).orbs.length).toBeLessThanOrEqual(28);
      }
      expect(LEVEL_IDS.map((id) => STAR_TARGET_MS[id])).toEqual([80_000, 120_000, 150_000, 165_000, 210_000]);
   });

   for (const id of LEVEL_IDS) {
      it(`level ${id}: every secret sits in the open (not inside a solid block), and each sunken one in its chamber`, () => {
         const c = courseFor(id);
         expect(c.secrets).toHaveLength(SECRETS[id].length);
         c.secrets.forEach((p, k) => {
            expect(p.id).toBe(SECRETS[id][k].id);
            for (const s of c.supports) {
               const inside = Math.abs(p.x - s.cx) < s.hw && Math.abs(p.z - s.cz) < s.hd && p.y < s.top - 0.05 && p.y > s.bottom;
               if (!s.ghost) expect(inside, `${p.id}`).toBe(false);
            }
            if (p.sunken >= 0) {
               const z = c.zones[p.sunken];
               expect(p.x >= z.minX && p.x <= z.maxX && p.z >= z.minZ && p.z <= z.maxZ).toBe(true);
            }
         });
      });
   }

   for (const id of LEVEL_IDS) {
      it(`level ${id}: the bot's flow bonus stays within comboMaxBonus, and the star target is above the bot's time`, () => {
         const run = botRun(id);
         expect(run.ended).toBe("win");
         const bound = comboMaxBonus(comboSpecOf(run.course));
         expect(run.combo.bonusTotal).toBeGreaterThan(0);
         expect(run.combo.bonusTotal).toBeLessThanOrEqual(bound);
         expect(runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal)).toBeLessThan(STAR_TARGET_MS[id]);
         expect(run.hits).toBe(0);
      }, 60_000);
   }

   it("the flow sources the proof counts: each orb 40, each first landing 20, each lever's first pull 40, each boss hit 80", () => {
      const c = courseFor(5);
      expect(comboSpecOf(c).sources).toEqual([
         { count: c.orbs.length, base: COMBO_BASE_MS.orb },
         { count: c.supports.length - 1, base: COMBO_BASE_MS.block },
         { count: c.levers.length, base: COMBO_BASE_MS.lever },
         { count: 3, base: COMBO_BASE_MS.boss },
      ]);
      expect(COMBO_BASE_MS).toEqual({ orb: 40, block: 20, lever: 40, boss: 80 });
      expect(ORB.bonusMs).toBe(300);
   });

   it("the sunken shard shows only after its chamber was fully flooded and then drained in the same run", () => {
      const c = courseFor(1);
      const k = c.secrets.findIndex((s) => s.id === "sunken");
      const p = c.secrets[k];
      const floor = c.supports.findIndex((s) => s.kind === "floor");
      const put = (run: RuinRun) => Object.assign(run.hero, { x: p.x, y: c.supports[floor].top, z: p.z, vx: 0, vz: 0, vy: 0, grounded: true, swim: false, support: floor, lastTop: c.supports[floor].top });
      const dry = createRun(1, 1, "riko");
      put(dry);
      step(dry, 50, createStepInput());
      expect(dry.secrets.found[k]).toBe(0);
      // flood the trench to the top, then drain it (both by the rules' water)
      const run = createRun(1, 1, "riko");
      run.water.target[p.sunken] = c.zones[p.sunken].levels[1];
      for (let i = 0; i < 400 && zoneLevel(run.water, p.sunken, run.simMs) < c.zones[p.sunken].levels[1]; i++) step(run, 50, createStepInput());
      expect(run.water.cycle[p.sunken]).toBe(1);
      run.water.fromY[p.sunken] = zoneLevel(run.water, p.sunken, run.simMs);
      run.water.fromMs[p.sunken] = run.simMs;
      run.water.target[p.sunken] = c.zones[p.sunken].levels[0];
      for (let i = 0; i < 400 && run.water.cycle[p.sunken] !== 2; i++) step(run, 50, createStepInput());
      expect(run.water.cycle[p.sunken]).toBe(2);
      put(run);
      step(run, 50, createStepInput());
      expect(run.secrets.found[k]).toBe(1);
   });

   it("level 5: the honest bot beats Umbra Roller (land on its back, the geyser, the floodgate), and the Tide Bell rings only after", () => {
      const run = botRun(5);
      expect(run.boss?.step === "defeat" || run.boss?.step === "done").toBe(true);
      expect(run.boss?.hits).toBe(3);
      // a run that never beats it cannot ring the bell: put the hero on the bell's ledge with the boss alive
      const fresh = createRun(1, 5);
      const g = fresh.course.supports[fresh.course.goal];
      Object.assign(fresh.hero, { x: g.cx, y: g.top, z: g.cz, grounded: true, support: fresh.course.goal, lastTop: g.top });
      step(fresh, 200, createStepInput());
      expect(fresh.ended).toBeNull();
   }, 60_000);
});
