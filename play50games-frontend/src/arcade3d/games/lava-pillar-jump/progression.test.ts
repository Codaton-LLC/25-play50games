// Menu 2 systems in Lava Pillar Jump: stars, the flow meter's bound, the secrets and their hero gates,
// the level end into progress, and Kalder the Magma Golem (menu2/boss) fought on level 5.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { bossProblems, createBoss, phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { starSpecProblems, STAR_BIT } from "@/arcade3d/menu2/stars/stars";
import { memoryProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { createBot, botInput } from "./bot";
import { COMBO_BASE_MS, KALDER, SECRETS, STAR_TARGET_MS, starSpecFor } from "./progression";
import { levelEndStats, runStars } from "./levelEnd";
import {
   NONE,
   V_RUN,
   bossMinMs,
   comboSpecOf,
   courseFor,
   createRun,
   createStepInput,
   lavaAt,
   minFinishMs,
   minArrivalMs,
   runTimeMs,
   step,
   zoneActive,
   type LavaRun,
} from "./rules";

const runs = new Map<string, LavaRun>();
function botRun(level: LevelId, fps = 60): LavaRun {
   const key = `${level}:${fps}`;
   const hit = runs.get(key);
   if (hit) return hit;
   const run = createRun(1, level);
   const bot = createBot(run, 1000 / fps);
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, 1000 / fps, input);
   }
   runs.set(key, run);
   return run;
}

describe("stars and the flow meter", () => {
   it("every level has a valid star spec over its embers, and the target sits over the honest bot", () => {
      for (const id of LEVEL_IDS) {
         const spec = starSpecFor(id, courseFor(id).orbs.length);
         expect(starSpecProblems(spec)).toEqual([]);
         const run = botRun(id);
         const t = runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);
         expect(STAR_TARGET_MS[id], `L${id} bot ${t}`).toBeGreaterThan(t);
         expect(STAR_TARGET_MS[id]).toBeLessThan(t * 2.4);
      }
   });

   it("the honest bot's flow bonus never passes the level's bound, and the bound counts embers and first landings only", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const spec = comboSpecOf(c);
         expect(spec.sources).toEqual([
            { count: c.orbs.length, base: COMBO_BASE_MS.ember },
            { count: c.supports.length - 1, base: COMBO_BASE_MS.pillar },
         ]);
         for (const fps of [30, 60, 144]) expect(botRun(id, fps).combo.bonusTotal).toBeLessThanOrEqual(comboMaxBonus(spec));
         expect(botRun(id).combo.bonusTotal).toBeGreaterThan(0);
      }
   });

   it("a clear records stars, no-hit and secrets into progress (memory storage, never localStorage here)", () => {
      const run = botRun(1);
      const r = runStars(run);
      expect(r.clear).toBe(true);
      expect(r.mask & STAR_BIT.clear).toBeTruthy();
      const storage = memoryProgressStorage();
      const stats = levelEndStats(run, null, storage);
      expect(stats.stars).toBe(r.mask);
      expect(stats.xp).toBeGreaterThan(0);
      const again = levelEndStats(run, null, storage);
      expect(again.xp).toBe(0);
   });
});

/** Put the hero in the air at a spot (feet 0.6 under it), at rest. */
function hoverAt(run: LavaRun, x: number, y: number, z: number): void {
   const h = run.hero;
   h.x = x;
   h.z = z;
   h.y = y - 0.6;
   h.grounded = false;
   h.support = NONE;
   h.arcStart = run.simMs;
   h.arcY0 = y - 0.6;
   h.arcV = 0;
   h.lastTop = y;
}

describe("secrets: 1 to 3 per level, each behind its hero's gate", () => {
   it("valid lists, every spot off the plain route's reach unless its power is up", () => {
      for (const id of LEVEL_IDS) {
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(courseFor(id).secrets).toHaveLength(SECRETS[id].length);
      }
      // every hero has a gate somewhere in the game
      const heroes = new Set(LEVEL_IDS.flatMap((id) => SECRETS[id].map((s) => s.hero).filter(Boolean)));
      expect([...heroes].sort()).toEqual(["kiro", "nami", "riko", "vexa", "zuno"]);
   });

   for (const id of LEVEL_IDS) {
      it(`level ${id}: a power-gated secret is taken with its power and not without`, () => {
         const c = courseFor(id);
         c.secrets.forEach((spot, i) => {
            if (spot.need === null || spot.need === "magnet") return;
            const plain = createRun(1, id);
            hoverAt(plain, spot.x, spot.y, spot.z);
            step(plain, 1, createStepInput());
            expect(plain.secrets.found[i], `${SECRETS[id][i].id} without`).toBe(0);
            const gated = createRun(1, id);
            hoverAt(gated, spot.x, spot.y, spot.z);
            const h = gated.hero;
            if (spot.need === "dash") h.dashUntil = 10_000;
            if (spot.need === "phase") h.phaseUntil = 10_000;
            if (spot.need === "shield") h.shieldUntil = 10_000;
            if (spot.need === "doubleJump") h.airJump = false;
            step(gated, 1, createStepInput());
            expect(gated.secrets.found[i], `${SECRETS[id][i].id} with ${spot.need}`).toBe(1);
         });
      });
   }

   it("Zuno's lava shard is out of a normal reach from the pillar's edge and inside the magnet's", () => {
      for (const id of LEVEL_IDS) {
         courseFor(id).secrets.forEach((spot) => {
            if (spot.need !== "magnet") return;
            const s = courseFor(id).supports[spot.support];
            const edgeX = s.cx + Math.sign(spot.x - s.cx) * (s.hw + 0.15);
            const d = Math.hypot(spot.x - edgeX, spot.y - (s.top + 0.6), spot.z - s.cz);
            expect(d).toBeGreaterThan(0.95 + 1);
            expect(d).toBeLessThan(4.2);
         });
      }
   });
});

describe("Kalder, the Magma Golem (level 5)", () => {
   it("is a valid boss: three readable phases (3, 2 and 1 hits), a slow-mo finish inside the defeat", () => {
      expect(bossProblems(KALDER)).toEqual([]);
      expect(KALDER.phases.map((p) => p.id)).toEqual(["slams", "tear", "heart"]);
      expect(phaseMarks(KALDER)).toHaveLength(2);
      const s = createBoss(KALDER);
      expect(s.hp).toBe(6);
   });

   it("the least fight is part of the level's least finish (a ring pillar's arrival plus bossMinMs)", () => {
      const c = courseFor(5);
      const a = c.arena!;
      const arrive = minArrivalMs(c);
      const ring = Math.min(...a.ring.map((k) => arrive[k]));
      expect(bossMinMs(KALDER)).toBeGreaterThan(10_000);
      expect(minFinishMs(c)).toBeCloseTo(ring + bossMinMs(KALDER), 6);
   });

   it("his hit zones are solid only in their phase; before the fight none is", () => {
      const run = createRun(1, 5);
      const a = run.course.arena!;
      for (const z of a.zones) expect(zoneActive(run, z)).toBe(false);
      run.bossStartMs = 0;
      expect(zoneActive(run, a.zones[0])).toBe(true);
      expect(zoneActive(run, a.zones[1])).toBe(false);
      run.boss!.phase = 1;
      expect(zoneActive(run, a.zones[1])).toBe(true);
      expect(zoneActive(run, a.zones[0])).toBe(false);
   });

   for (const fps of [30, 60, 144]) {
      it(`the honest bot beats him at ${fps} Hz: six hits through three phases, the run won on the defeat`, () => {
         const run = botRun(5, fps);
         expect(run.ended).toBe("win");
         expect(run.boss!.hp).toBe(0);
         expect(run.boss!.hits).toBe(6);
         expect(run.finishMs - run.bossStartMs).toBeGreaterThanOrEqual(bossMinMs(KALDER));
      });
   }

   it("the arena's lava (slam surges, the standing tide, the heart surge) never reaches the ring's top", () => {
      const run = createRun(1, 5);
      const bot = createBot(run);
      const input = createStepInput();
      const top = run.course.arena!.top;
      let peak = -Infinity;
      for (let f = 0; f < 400_000 && run.ended === null; f++) {
         botInput(bot, run, input);
         step(run, 1000 / 60, input);
         if (run.bossStartMs !== NONE) peak = Math.max(peak, lavaAt(run, run.simMs));
      }
      expect(peak).toBeLessThan(top - 1);
      // and the cap holds it under the ring however long the fight lasts
      expect(run.course.lavaCap + 2.0).toBeLessThan(top - 1);
   });

   it("a hit throws the hero back towards a ring vent at no more than the run speed", () => {
      const run = createRun(1, 5);
      const a = run.course.arena!;
      const zone = run.course.supports[a.zones[0]];
      run.bossStartMs = 0;
      const b = run.boss!;
      b.step = "vulnerable";
      b.stepMs = 0;
      const h = run.hero;
      h.x = zone.cx + 0.5;
      h.z = zone.cz;
      h.y = zone.top;
      h.grounded = true;
      h.support = a.zones[0];
      const ev = step(run, 1, createStepInput());
      expect(ev.bossHit).toBe(true);
      expect(b.hp).toBe(5);
      expect(h.shrug).toBe(true);
      expect(Math.hypot(h.vx, h.vz)).toBeLessThanOrEqual(V_RUN + 1e-9);
      let landed = NONE;
      for (let t = 0; t < 3000 && landed === NONE && run.ended === null; t++) landed = step(run, 1, createStepInput()).landedOn;
      expect(a.ring.slice(1)).toContain(landed);
   });
});
