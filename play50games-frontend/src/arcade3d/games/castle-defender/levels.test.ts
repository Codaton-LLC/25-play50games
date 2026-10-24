// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = today's game,
// monotone difficulty, the analytic limit proof per level and the rules that must hold on every level.
// The bot proofs are in rules.levels.test.ts.
import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { definitionLevelProblems, levelEnvironment, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { LEVELS } from "./levels";
import { LEVEL_LOOKS } from "./looks";
import { castleDefenderMeta as meta } from "./meta";
import definition from "./index";
import { visibleGoblin } from "./Goblins";
import { COUNTS, PROPOSED_LEVEL_LIMITS, PROPOSED_LIMITS, ROCK_FLIGHT, STARTS, TUNING, TYPES, createInput, createRun, impact, stepRun } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const KINDS = ["walker", "shield", "runner", "crew"] as const;
const total = (id: (typeof LEVEL_IDS)[number]) => LEVELS[id].counts.flat().reduce((a, b) => a + b, 0);

describe("castle-defender levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LIMITS);
      // a level clears on a win only: no score target
      expect(meta.levels!.every((level) => level.clearScore === undefined)).toBe(true);
      // decision 3 guard: level 5 at most ~3 x level 1
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("level 1 is today's game: same waves, timing, look and start card", () => {
      const l1 = LEVELS[1], run = createRun(7, l1);
      expect(l1.counts).toEqual([[8, 0, 0, 0], [10, 4, 0, 0], [10, 4, 6, 0], [10, 4, 6, 6], [12, 6, 6, 6]]);
      expect(l1.counts).toBe(COUNTS);
      expect([l1.speed, l1.period, l1.clearAt]).toEqual([1, TUNING.period, TUNING.clearAt]);
      expect(run.starts).toEqual([...STARTS]);
      expect(run.safety).toBe(TUNING.safety);
      expect(run.goblins.every((g) => g.speed === TYPES[g.kind].speed)).toBe(true);
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      expect(definition.environment).toEqual({ background: "#f6c59a", fog: ["#f6c59a", 46, 86], lighting: "sunset" });
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: undefined, lives: undefined, resultDelayMs: TUNING.resultDelayMs });
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
   });

   it("only the environment changes per level: same run config and instructions on every level", () => {
      for (const id of LEVEL_IDS) {
         expect(levelRunConfig(definition, id)).toEqual(levelRunConfig(definition, 1));
         expect(levelInstructions(definition, id)).toEqual(definition.instructions);
      }
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)!.lighting)).toEqual(["sunset", "indoor", "sunset", "night", "sunset"]);
      // scenery only: level 1 keeps today's untinted ground and no torches; the night level has its torchlight
      expect(LEVEL_LOOKS[1].ground).toBeUndefined();
      expect(LEVEL_LOOKS[1].torches).toBeUndefined();
      expect(LEVEL_LOOKS[4].torches).toBeGreaterThan(0);
   });
});

describe("castle-defender levels: difficulty", () => {
   it("is monotone: goblins, waves and speed never fall, gaps never grow, and each level adds pressure", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = LEVELS[(id - 1) as 1 | 2 | 3 | 4], b = LEVELS[id];
         expect(total(id)).toBeGreaterThan(total((id - 1) as 1 | 2 | 3 | 4));
         expect(b.counts.length).toBeGreaterThanOrEqual(a.counts.length);
         expect(b.speed).toBeGreaterThan(a.speed);
         expect(b.period).toBeLessThanOrEqual(a.period);
         expect(b.clearAt).toBeLessThanOrEqual(a.clearAt);
      }
      expect(LEVEL_IDS.map((id) => LEVELS[id].counts.length)).toEqual([5, 5, 6, 7, 8]);
   });

   it("every wave fits the pools and resolves before its clear; wave 1 can never lose the gate", () => {
      for (const id of LEVEL_IDS) {
         const c = LEVELS[id];
         const damage = c.counts[0].reduce((sum, n, k) => sum + n * TYPES[KINDS[k]].damage, 0);
         expect(damage).toBeLessThan(TUNING.hp);
         for (const wave of c.counts) {
            expect(wave.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(40); // goblin + marker pools
            expect(wave[3] % 3).toBe(0); // crews are triples
            expect(wave[3] / 3).toBeLessThanOrEqual(3); // one ladder per lane
         }
         // the slowest goblin spawns last (8 s), walks the lane and climbs 2 s, all before the clear
         expect(TUNING.spawnSpan + 8.8 / (0.7 * c.speed) + TUNING.climb).toBeLessThan(c.clearAt);
         const run = createRun(19, c);
         for (let wave = 0; wave < run.waves.length; wave++) {
            run.wave = wave;
            expect(run.waves[wave].map((_, slot) => visibleGoblin(run, slot)?.id)).toEqual(run.waves[wave].map((g) => g.id));
            for (const g of run.waves[wave]) expect(g.spawn + (8.8 - g.initialS) / g.speed + (g.crew >= 0 ? 2 : 0)).toBeLessThan(run.starts[wave] + c.clearAt);
         }
         expect(run.goblins.length).toBe(total(id));
         expect(run.goblins.every((g) => g.speed === TYPES[g.kind].speed * c.speed)).toBe(true);
      }
   });
});

describe("castle-defender levels: limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) it(`L${id}: B(t) <= base + pps t, maxScore, and the duration window`, () => {
      const c = LEVELS[id], limits = PROPOSED_LEVEL_LIMITS[id], n = c.counts.length;
      const env = (t: number) => limits.base! + limits.maxPointsPerSec! * t;
      // every wave's kills (all at x3) at its start, its clear at start + clearAt, the HP bonus on the last
      let kills = 0, slope = 0;
      for (let wave = 0; wave < n; wave++) {
         kills += c.counts[wave].reduce((a, b) => a + b, 0) * TUNING.kill * 3;
         const start = wave * c.period, atStart = kills + 200 * wave, atClear = kills + 200 * (wave + 1) + (wave === n - 1 ? 250 : 0);
         expect(atStart).toBeLessThanOrEqual(env(start));
         expect(atClear).toBeLessThanOrEqual(env(start + c.clearAt));
         if (wave > 0) slope = Math.max(slope, (atStart - limits.base!) / start);
         slope = Math.max(slope, (atClear - limits.base!) / (start + c.clearAt));
      }
      expect(limits.base).toBe(c.counts[0].reduce((a, b) => a + b, 0) * 60);
      expect(limits.maxScore).toBe(total(id) * 60 + 200 * n + 2 * 125);
      // pps is the steepest slope plus at most 5 % (level 1's original limits: 1.2 %)
      expect(limits.maxPointsPerSec!).toBeGreaterThanOrEqual(slope);
      expect(limits.maxPointsPerSec!).toBeLessThanOrEqual(Math.ceil(slope * 1.05));
      // the earliest possible end: wave 1 cannot lose, so a wave-2 goblin must arrive first
      const fastest = Math.max(...c.counts[1].map((count, k) => (count > 0 ? TYPES[KINDS[k]].speed : 0)));
      expect(limits.minDurationMs).toBeLessThanOrEqual((c.period + 8 / (fastest * c.speed)) * 1000);
      expect(limits.minDurationMs).toBeGreaterThan((c.period + 8 / (fastest * c.speed)) * 1000 - 1000);
      // the latest end: the safety timeup plus one 50 ms frame
      const run = createRun(1, c);
      expect(run.safety + 0.05).toBeLessThan(limits.maxDurationMs / 1000);
      expect(run.safety).toBeGreaterThan((n - 1) * c.period + c.clearAt);
   });
});

describe("castle-defender levels: the rules hold on every level", () => {
   it("shields take half damage from the front, each goblin pays once", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(17, LEVELS[id]);
         for (const g of run.goblins) g.status = "dead";
         const g = run.goblins[0]; g.status = "ground"; g.kind = "shield"; g.hp = 2; g.x = g.z = 0;
         impact(run, 0, 0); expect(g.hp).toBe(1.5);
         impact(run, 0, 0.1); expect(g.hp).toBe(1);
         impact(run, 0, -0.1); expect(g.status).toBe("dead"); expect(run.score).toBe(20);
         impact(run, 0, -0.1); expect(run.score).toBe(20);
      }
   });

   it("the last configured wave pays one clear and the HP bonus, then the run is won", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(9, LEVELS[id]), last = run.waves.length - 1;
         run.wave = run.cleared = last; run.time = run.starts[last] + run.config.clearAt - 0.01;
         run.hp = run.maxHP = 125; run.score = 0;
         for (const g of run.goblins) g.status = "dead";
         stepRun(run, createInput(), 0.02);
         expect(run.end).toBe("win"); expect(run.score).toBe(450);
         expect(run.cleared).toBe(run.waves.length); expect(run.offer).toBe(false);
         stepRun(run, createInput(), 1); expect(run.score).toBe(450);
      }
   });

   it("four upgrade offers at most, also in the added waves", () => {
      for (const id of [3, 4, 5] as const) {
         const run = createRun(9, LEVELS[id]);
         for (const g of run.goblins) g.status = "dead";
         run.wave = run.cleared = 4; run.time = run.starts[4]; run.offered = 3;
         run.stacks = [2, 1, 1, 0]; run.upgrades = 4;
         stepRun(run, createInput(), run.safety - run.time);
         expect(run.end).toBe("win"); expect(run.upgrades).toBe(4);
         expect(run.offer).toBe(false); expect(run.stacks).toEqual([2, 1, 1, 0]);
      }
   });

   for (const id of LEVEL_IDS) it(`L${id}: touch and keyboard get the same timing (reload, flight, rock)`, () => {
      const fine = createRun(37, LEVELS[id]), touch = createRun(37, LEVELS[id]);
      const a = createInput(), b = createInput(); b.coarse = true;
      a.point = b.point = true; a.x = b.x = 5; a.z = b.z = -6; a.fire = b.fire = true;
      stepRun(fine, a, 0.05); stepRun(touch, b, 0.05);
      stepRun(fine, a, 0.05); stepRun(touch, b, 0.05); a.fire = b.fire = false;
      for (let n = 0; n < 25; n++) { stepRun(fine, a, 0.05); stepRun(touch, b, 0.05); }
      expect(fine.launches).toBe(2); expect(touch.launches).toBe(2);
      expect(touch.ready).toBe(fine.ready); expect(touch.impacts).toBe(fine.impacts);
      expect(touch.goblins).toEqual(fine.goblins);
      const crew = fine.crews[0];
      for (const run of [fine, touch]) {
         for (const g of run.goblins) g.status = "dead";
         run.wave = crew.wave; run.cleared = crew.wave; run.time = run.starts[crew.wave] + 16;
         run.offer = false; run.crews[crew.id].erected = run.time;
         for (const g of run.waves[crew.wave]) if (g.crew === crew.id) { g.status = "climb"; g.hp = 1; }
      }
      a.point = b.point = false; a.rock = b.rock = true;
      stepRun(fine, a, 0.01); stepRun(touch, b, 0.01);
      expect(touch.rock).toEqual(fine.rock);
      expect(touch.rock.impact - touch.rock.launched).toBeCloseTo(ROCK_FLIGHT, 9);
   });
});
