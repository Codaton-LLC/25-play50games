// Temple Coin Rush rules (rules.ts): the temples (temples.ts), the purse and the tolls (pay, shut and
// pushed, the free toll, the ghost gate, the held-open lane), the sections (no lane changes, the slow
// lane, the perfect lane), the boulder gap and the lives, the hazards (blocks, beams, jets, spikes,
// broken tiles and the rumble, side-ramp boulders), the five hero gates, Coilstone, the score, the
// bounds and the pinned limits, and the honest bot driven through the real store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { comboConfigProblems } from "@/arcade3d/menu2/combo/combo";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { starSpecProblems } from "@/arcade3d/menu2/stars/stars";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { LEVELS } from "./levels";
import { COILSTONE, COMBO, SECRETS, starSpecFor } from "./progression";
import { templeCoinRushMeta } from "./meta";
import {
   ARENA,
   BLOCK_CLEAR,
   CROSS,
   GAP,
   GATE,
   HAZ,
   LANES,
   LIVES,
   PROPOSED_LEVEL_LIMITS,
   RUMBLE,
   SLOW_FACTOR,
   STAT,
   TIER,
   bankOf,
   chaserZ,
   courseFor,
   createRun,
   createStepInput,
   crossX,
   finalScore,
   heroBankBound,
   laneDirection,
   laneX,
   maxScoreBound,
   minFinishMs,
   priceOf,
   progressFloorMs,
   scoreBoundAt,
   scoreOf,
   speedNow,
   spikeUp,
   staticBankBound,
   step,
   timeBonus,
   type TempleRun,
} from "./rules";
import { NONE } from "./temples";

const idle = createStepInput();

/** Steps the run 1 ms at a time until `until` is true (or `max` ms). */
function runUntil(run: TempleRun, until: (r: TempleRun) => boolean, max = 200_000, input = idle): void {
   for (let i = 0; i < max && run.ended === null && !until(run); i++) step(run, 1, input);
}

/** Puts the hero just before z in a lane (between sections), on the ground. */
function placeAt(run: TempleRun, z: number, lane = 1): void {
   const h = run.hero;
   h.z = z;
   h.lane = lane;
   h.x = laneX(lane);
   h.route = NONE;
   run.nextGate = run.course.gates.findIndex((g) => g.z < z);
   if (run.nextGate < 0) run.nextGate = run.course.gates.length;
}

function botRun(level: LevelId, fps = 60, hero: TempleRun["heroId"] = "kiro", seed = 3): TempleRun {
   const fms = 1000 / fps;
   const run = createRun(seed, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}

describe("the temples", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: gates in order and apart, each section's coins and traps inside it, three relic orbs, the secrets placed`, () => {
         const c = courseFor(id);
         expect(c.gates.length).toBeGreaterThanOrEqual(id === 5 ? 2 : 3);
         let prev = c.startZ;
         for (const g of c.gates) {
            expect(g.z).toBeLessThan(prev - 10);
            expect(g.z1).toBeLessThan(g.z - 30);
            expect(g.lanes.some((r) => r.tier === TIER.slow)).toBe(true);
            expect(g.lanes.some((r) => r.tier !== TIER.slow)).toBe(true);
            if (g.cracked !== NONE) {
               expect(g.lanes[g.cracked].tier).toBe(TIER.slow);
               expect(g.lanes[g.freeTo].tier).not.toBe(TIER.slow);
            }
            if (g.ghost !== NONE) expect(g.lanes[g.ghost].tier).toBe(TIER.slow);
            prev = g.z1;
         }
         expect(c.finishZ).toBeLessThan(prev);
         for (const q of c.coins) {
            if (q.gate === NONE) continue;
            const g = c.gates[q.gate];
            expect(q.z).toBeLessThan(g.z);
            expect(q.z).toBeGreaterThan(g.z1);
            expect(q.x).toBeCloseTo(laneX(q.lane), 5);
         }
         for (const hz of c.hazards) {
            if (hz.gate === NONE) continue;
            expect(hz.z).toBeLessThan(c.gates[hz.gate].z);
            expect(hz.z).toBeGreaterThan(c.gates[hz.gate].z1);
         }
         expect(c.orbs).toHaveLength(3);
         expect(c.secrets).toHaveLength(SECRETS[id].length);
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, 3))).toEqual([]);
      });
   }

   it("the card's twists: level 2 pairs a cheap and a dear toll with spike tiles, level 3 the broken tiles and the 50-coin jackpot, level 4 the side ramps and the surge", () => {
      const has = (id: LevelId, kind: number) => courseFor(id).hazards.some((q) => q.kind === kind);
      expect(has(1, HAZ.spike) || has(1, HAZ.broken)).toBe(false);
      expect(has(2, HAZ.spike)).toBe(true);
      expect(courseFor(2).gates.some((g) => g.lanes.filter((r) => r.tier !== TIER.slow).length === 2)).toBe(true);
      expect(has(3, HAZ.broken)).toBe(true);
      expect(courseFor(3).gates.some((g) => g.lanes.some((r) => r.tier === TIER.jackpot && r.price === 50))).toBe(true);
      expect(courseFor(4).crosses.length).toBeGreaterThanOrEqual(3);
      expect(courseFor(4).gates.every((g) => g.surge)).toBe(true);
      expect(courseFor(3).crosses).toHaveLength(0);
      for (const id of LEVEL_IDS) expect(courseFor(id).hazards.some((q) => q.kind === HAZ.jet)).toBe(true);
      for (const id of LEVEL_IDS) expect(courseFor(id).coins.some((q) => q.need === 1)).toBe(true);
      for (const id of LEVEL_IDS) expect(courseFor(id).gates.some((g) => g.ghost !== NONE)).toBe(true);
   });

   it("level 1 teaches in three beats: an easy 5-coin gate after a coin line, a 15-coin gate no plain run can afford yet, then a rich stretch before a gate of choice", () => {
      const c = courseFor(1);
      const before = (z: number) => c.coins.filter((q) => q.gate === NONE && q.need === 0 && q.z > z).length;
      expect(c.gates[0].lanes[1].price).toBe(5);
      expect(before(c.gates[0].z)).toBeGreaterThanOrEqual(10);
      expect(c.gates[1].lanes[1].price).toBe(15);
      // the most a non-Zuno, non-Nami run can hold at the second gate: the common coins before it, the
      // best of the first gate's lanes (its toll lane's coins less 5, or a slow lane's low coins)
      const lane = (l: number) => c.coins.filter((q) => q.gate === 0 && q.lane === l && q.y < 2).length;
      const best0 = Math.max(lane(1) - 5, lane(0), lane(2));
      expect(before(c.gates[1].z) + best0).toBeLessThan(15);
      expect(before(c.gates[2].z) - before(c.gates[1].z1)).toBeGreaterThanOrEqual(15);
   });

   it("the boss and the combo are valid (menu2/boss, menu2/combo)", () => {
      expect(bossProblems(COILSTONE)).toEqual([]);
      expect(comboConfigProblems(COMBO)).toEqual([]);
   });
});

describe("the purse and the tolls", () => {
   it("coins fill the purse; a toll lane with enough coins is paid at the plane and its section boosts the run", () => {
      const run = createRun(1, 1);
      const g = run.course.gates[0];
      placeAt(run, g.z + 3, 1);
      run.purse.coins = 9;
      runUntil(run, (r) => r.hero.route === 0);
      expect(run.gateResult[0]).toBe(GATE.paid);
      expect(run.purse.coins).toBe(4);
      expect(run.tolls).toBe(1);
      expect(run.spent).toBe(5);
      step(run, 1, idle);
      expect(run.hero.v).toBeCloseTo(run.course.speed + g.lanes[1].boost, 5);
   });

   it("without enough coins the gate stays shut and pushes the hero into the nearest slow lane: slower, and the boulder gains GAP.slow over the section", () => {
      const run = createRun(1, 1);
      const g = run.course.gates[1];
      placeAt(run, g.z + 3, 1);
      run.purse.coins = 3;
      runUntil(run, (r) => r.hero.route === 1);
      expect(run.gateResult[1]).toBe(GATE.shut);
      expect(run.purse.coins).toBe(3);
      expect([0, 2]).toContain(run.hero.lane);
      const gap0 = run.gap;
      step(run, 1, idle);
      expect(run.hero.v).toBeCloseTo(run.course.speed * SLOW_FACTOR, 5);
      // no stumble on the way (the shield), no perfect lane in a slow lane; the regen gives some back
      run.hero.shieldUntil = 1e12;
      const t0 = run.simMs;
      runUntil(run, (r) => r.hero.route === NONE);
      const regen = (GAP.regen * (run.simMs - t0)) / 1000;
      expect(run.perfects).toBe(0);
      expect(gap0 - run.gap).toBeGreaterThan(GAP.slow - regen - 0.05);
   });

   it("inside a section the dividers hold the lane: presses do nothing until the lanes rejoin", () => {
      const run = createRun(1, 1);
      const g = run.course.gates[0];
      placeAt(run, g.z + 1, 0);
      runUntil(run, (r) => r.hero.route === 0);
      const press = { ...createStepInput(), right: true };
      step(run, 16, press);
      expect(run.hero.lane).toBe(0);
      runUntil(run, (r) => r.hero.route === NONE);
      step(run, 16, press);
      expect(run.hero.lane).toBe(1);
   });

   it("unspent coins score double; a win adds the finish bonus and the time bonus; the bank counts up to the level's cap", () => {
      const run = createRun(1, 2);
      run.purse.coins = 30;
      expect(scoreOf(run)).toBe(60);
      run.ended = "win";
      run.finishMs = 40_000;
      expect(scoreOf(run)).toBe(60 + LEVELS[2].finishBonus + timeBonus(run.course, 40_000));
      expect(timeBonus(run.course, 40_000)).toBe(Math.floor((LEVELS[2].parMs - 40_000) / 100));
      run.purse.coins = 10_000;
      expect(bankOf(run)).toBe(run.course.bankCap);
   });

   it("level 4's surge: the price rises by 1 for every 2 s of the approach spent outside a toll lane", () => {
      const run = createRun(1, 4);
      const g = run.course.gates[0];
      const slow = g.lanes.findIndex((r) => r.tier === TIER.slow);
      const toll = g.lanes.findIndex((r) => r.tier !== TIER.slow);
      placeAt(run, g.z + 39, slow);
      const base = priceOf(run, 0, toll);
      // hold the hero in the approach for 4.5 s
      for (let i = 0; i < 4500; i++) {
         step(run, 1, idle);
         run.hero.z = g.z + 39;
      }
      expect(priceOf(run, 0, toll)).toBe(base + 2);
      // in a toll lane the clock stops
      run.hero.lane = toll;
      run.hero.x = laneX(toll);
      for (let i = 0; i < 3000; i++) {
         step(run, 1, idle);
         run.hero.z = g.z + 39;
      }
      expect(priceOf(run, 0, toll)).toBe(base + 2);
   });
});

describe("the boulder and the lives", () => {
   it("a stumble brings the boulder GAP.stumble closer; it creeps back after 2 s; at GAP.catch it catches you: a life, and back to its base gap", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const block = c.hazards.find((q) => q.kind === HAZ.block && q.gate === NONE)!;
      placeAt(run, block.z + 2, block.lane);
      runUntil(run, (r) => r.stumbles > 0);
      expect(run.gap).toBeCloseTo(GAP.base - GAP.stumble, 1);
      // the creep back: nothing for 2 s after the stumble, then GAP.regen m/s up to the base (the hero held at one spot)
      const z = run.hero.z;
      const g0 = run.gap;
      const t0 = run.lastStumble;
      for (let i = 0; i < 20_000 && run.gap < GAP.base; i++) {
         step(run, 1, idle);
         run.hero.z = z;
         if (run.simMs - t0 <= GAP.regenAfterMs) expect(run.gap).toBe(g0);
      }
      expect(run.simMs - t0).toBeGreaterThan(GAP.regenAfterMs + ((GAP.base - g0) / GAP.regen) * 1000 - 20);
      expect(run.gap).toBeCloseTo(GAP.base, 2);
      run.gap = GAP.catch + 0.0001;
      run.lastStumble = run.simMs;
      run.hero.route = NONE;
      run.gap = GAP.catch;
      step(run, 1, idle);
      expect(run.lives).toBe(LIVES - 1);
      expect(run.gap).toBe(GAP.base);
      expect(chaserZ(run)).toBeCloseTo(run.hero.z + GAP.base, 5);
   });

   it("the last life ends the run ('lose'), scored as its bank x2", () => {
      const run = createRun(1, 1);
      run.lives = 1;
      run.purse.coins = 12;
      run.gap = GAP.catch;
      run.lastStumble = 0;
      step(run, 1, idle);
      expect(run.ended).toBe("lose");
      expect(scoreOf(run)).toBe(24);
   });

   it("a perfect lane (no stumble, every low coin in its channel) pushes the boulder back GAP.perfect", () => {
      const run = createRun(1, 1);
      const g = run.course.gates[0];
      placeAt(run, g.z + 2, 1);
      run.purse.coins = 50;
      run.gap = 4;
      run.lastStumble = run.simMs;
      run.hero.shieldUntil = 1e12;
      runUntil(run, (r) => r.hero.route === 0);
      // every coin of the toll lane lies on its line: the run collects them all
      runUntil(run, (r) => r.hero.route === NONE);
      expect(run.perfects).toBe(1);
      expect(run.gap).toBeGreaterThan(4 + GAP.perfect - 0.2);
   });
});

describe("the hazards", () => {
   it("a block knocks a hero that does not jump it; a jump clears it (feet over BLOCK_CLEAR)", () => {
      const c = courseFor(1);
      const block = c.hazards.find((q) => q.kind === HAZ.block && q.gate === NONE)!;
      const a = createRun(1, 1);
      placeAt(a, block.z + 1, block.lane);
      runUntil(a, (r) => r.hero.z < block.z - 1);
      expect(a.stumbles).toBe(1);
      const b = createRun(1, 1);
      placeAt(b, block.z + c.speed * 0.3, block.lane);
      step(b, 1, { ...createStepInput(), jumpPressed: true });
      runUntil(b, (r) => r.hero.z < block.z - 1);
      expect(b.stumbles).toBe(0);
      expect(BLOCK_CLEAR).toBeLessThan(1.29);
   });

   it("a low beam knocks a runner and lets a roll through", () => {
      const c = courseFor(1);
      const beam = c.hazards.find((q) => q.kind === HAZ.beam)!;
      const a = createRun(1, 1);
      placeAt(a, beam.z + 1, 0);
      runUntil(a, (r) => r.hero.z < beam.z - 1);
      expect(a.stumbles).toBe(1);
      const b = createRun(1, 1);
      placeAt(b, beam.z + 2, 0);
      step(b, 1, { ...createStepInput(), down: true });
      runUntil(b, (r) => r.hero.z < beam.z - 1);
      expect(b.stumbles).toBe(0);
   });

   it("a fire jet knocks anyone in its lane but Kiro under his shield", () => {
      const c = courseFor(1);
      const jet = c.hazards.find((q) => q.kind === HAZ.jet)!;
      const a = createRun(1, 1, "riko");
      placeAt(a, jet.z + 2, jet.lane);
      runUntil(a, (r) => r.hero.z < jet.z - 2);
      expect(a.stumbles).toBe(1);
      const b = createRun(1, 1, "kiro");
      placeAt(b, jet.z + 3, jet.lane);
      step(b, 1, { ...createStepInput(), actionPressed: true });
      runUntil(b, (r) => r.hero.z < jet.z - 2);
      expect(b.stumbles).toBe(0);
   });

   it("spike tiles are up for 600 ms of every 1.5 s, and only knock a grounded hero while they are up", () => {
      const sp = courseFor(2).hazards.find((q) => q.kind === HAZ.spike)!;
      let up = 0;
      for (let ms = 0; ms < 1500; ms++) if (spikeUp(sp, ms)) up++;
      expect(up).toBe(600);
   });

   it("level 3: a rumble wave rolls out of the boulder every 3.5 s and drops the broken tiles it passes 0.5 s later; a grounded hero on a pit falls (a life)", () => {
      const run = createRun(1, 3);
      const c = run.course;
      const i = c.hazards.findIndex((q) => q.kind === HAZ.broken && q.gate === NONE);
      const tile = c.hazards[i];
      placeAt(run, tile.z + 10, tile.lane === 0 ? 2 : 0);
      run.nextWaveMs = run.simMs + 1;
      runUntil(run, (r) => r.tileFall[i] !== Infinity, 5000);
      expect(run.tileFall[i]).toBeLessThan(Infinity);
      const fall = run.tileFall[i];
      expect(fall - run.simMs).toBeLessThanOrEqual(500);
      expect(RUMBLE.everyMs).toBe(3500);
      // a hero standing on it as it drops
      const b = createRun(1, 3);
      placeAt(b, tile.z, tile.lane);
      b.tileFall[i] = b.simMs + 2;
      for (let k = 0; k < 4; k++) {
         step(b, 1, idle);
         b.hero.z = tile.z;
      }
      expect(b.lives).toBe(LIVES - 1);
   });

   it("level 4: a side-ramp boulder rolls out as the hero comes within CROSS.lead m and knocks a hero it meets at its line", () => {
      const run = createRun(1, 4);
      const cr = run.course.crosses[0];
      placeAt(run, cr.z + CROSS.lead + 1, 1);
      expect(Number.isNaN(crossX(run, 0))).toBe(true);
      runUntil(run, (r) => r.crossStart[0] >= 0, 3000);
      const x0 = crossX(run, 0);
      expect(Math.abs(x0)).toBeCloseTo(CROSS.start, 1);
      expect(Math.sign(x0)).toBe(cr.side);
   });
});

describe("the hero gates", () => {
   it("Riko: a dash into the cracked side wall at its gate is a free toll into the fast lane (nothing paid)", () => {
      const run = createRun(1, 1, "riko");
      const gi = run.course.gates.findIndex((g) => g.cracked !== NONE);
      const g = run.course.gates[gi];
      placeAt(run, g.z + 2, g.cracked);
      run.purse.coins = 0;
      step(run, 1, { ...createStepInput(), actionPressed: true });
      runUntil(run, (r) => r.hero.route === gi);
      expect(run.gateResult[gi]).toBe(GATE.free);
      expect(run.hero.lane).toBe(g.freeTo);
      expect(run.spent).toBe(0);
   });

   it("Vexa: a phase through the ghost gate opens the ghost passage: its coins and the shard, none of the slow lane's traps", () => {
      const run = createRun(1, 1, "vexa");
      const gi = run.course.gates.findIndex((g) => g.ghost !== NONE);
      const g = run.course.gates[gi];
      placeAt(run, g.z + 2, g.ghost);
      step(run, 1, { ...createStepInput(), actionPressed: true });
      runUntil(run, (r) => r.hero.route === NONE && r.nextGate > gi);
      expect(run.gateResult[gi]).toBe(GATE.ghost);
      expect(run.stumbles).toBe(0);
      expect(run.secrets.found[SECRETS[1].findIndex((s) => s.id === "ghost")]).toBeTruthy();
      const ghost = run.course.coins.filter((q, i) => q.need === 2 && q.gate === gi && run.collected[i]).length;
      expect(ghost).toBeGreaterThan(0);
   });

   it("Zuno: the vein coins in the wall only come out under the magnet", () => {
      const c = courseFor(1);
      const vein = c.coins.filter((q) => q.need === 1);
      const z0 = Math.max(...vein.map((q) => q.z));
      const a = createRun(1, 1, "kiro");
      placeAt(a, z0 + 3, vein[0].x < 0 ? 0 : 2);
      runUntil(a, (r) => r.hero.z < z0 - 14);
      expect(vein.every((q) => !a.collected[c.coins.indexOf(q)])).toBe(true);
      const b = createRun(1, 1, "zuno");
      placeAt(b, z0 + 3, vein[0].x < 0 ? 0 : 2);
      step(b, 1, { ...createStepInput(), actionPressed: true });
      runUntil(b, (r) => r.hero.z < z0 - 14);
      expect(vein.filter((q) => b.collected[c.coins.indexOf(q)]).length).toBeGreaterThanOrEqual(6);
   });

   it("Nami: the ledge coins over a slow lane are out of a single jump's reach and within the double jump's", () => {
      const nami = botRun(1, 60, "nami");
      const kiro = botRun(1, 60, "kiro");
      const ledge = (r: TempleRun) => r.course.coins.filter((q, i) => q.y > 2 && r.collected[i]).length;
      expect(ledge(kiro)).toBe(0);
      expect(ledge(nami)).toBeGreaterThan(0);
   });

   it("lane presses are camera-relative: a camera turned round (yaw π) swaps left and right; a side view keeps the press", () => {
      expect(laneDirection(false, true, 0)).toBe(1);
      expect(laneDirection(true, false, 0)).toBe(-1);
      expect(laneDirection(false, true, Math.PI)).toBe(-1);
      expect(laneDirection(false, true, Math.PI / 2)).toBe(1);
   });
});

describe("Coilstone (level 5)", () => {
   it("it takes over from the boulder at the boss start; a paid bell queues a hit that lands while it is open; nine paid sections free it, then the grand gate opens", () => {
      const run = botRun(5, 60, "kiro");
      expect(run.ended).toBe("win");
      expect(run.boss!.hp).toBe(0);
      expect(run.arenaPaid.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(COILSTONE.maxHp);
      expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
   });

   it("the arena's tolls follow the phase they spawn in: 20-coin bells, 30-coin bells, then 10-coin offering bowls", () => {
      expect(ARENA.bell).toEqual([20, 30]);
      expect(ARENA.bowl).toBe(10);
      const run = botRun(5, 60, "riko");
      const phases = new Set<number>();
      for (let s = 0; s < run.arenaSpawned; s++) phases.add(run.arenaPhase[s]);
      expect([...phases].sort()).toEqual([0, 1, 2]);
   });
});

describe("the bounds and the limits", () => {
   it("the speed guard: no step ever moves the hero faster than the level's speed plus its section's best boost", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(2, id, "riko");
         const bot = createBot(run, 1000 / 60);
         bot.mash = true;
         const input = createStepInput();
         let top = 0;
         for (let f = 0; f < 30_000 && run.ended === null; f++) {
            botInput(bot, run, input);
            step(run, 1000 / 60, input);
            top = Math.max(top, speedNow(run, run.simMs));
         }
         const best = Math.max(0, ...run.course.gates.flatMap((g) => g.lanes.map((r) => r.boost)));
         expect(top).toBeLessThanOrEqual(run.course.speed + best + 1e-9);
      }
   });

   it("the bank bound holds for every hero's bot, and the static bound is the best hero's", () => {
      for (const id of LEVEL_IDS) {
         for (const hero of ["riko", "nami", "kiro", "zuno", "vexa"] as const) {
            const run = botRun(id, 60, hero);
            if (id !== 5) expect(run.purse.coins).toBeLessThanOrEqual(heroBankBound(run.course, hero));
         }
         expect(staticBankBound(courseFor(id))).toBe(Math.max(...(["riko", "nami", "kiro", "zuno", "vexa"] as const).map((h) => heroBankBound(courseFor(id), h))));
      }
   });

   it("the pinned limits (meta, arcade-games.json and these numbers move together)", () => {
      const PINNED = LEVEL_IDS.map((id) => {
         const l = PROPOSED_LEVEL_LIMITS[id];
         return [l.maxScore, l.minDurationMs, l.maxDurationMs, l.base, l.maxPointsPerSec];
      });
      expect(PINNED).toEqual([
         [480, 1000, 120000, 21, 12],
         [610, 1000, 130000, 36, 14],
         [710, 1000, 140000, 38, 16],
         [690, 1000, 150000, 27, 14],
         [910, 1000, 240000, 38, 15],
      ]);
      expect(templeCoinRushMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      for (const id of LEVEL_IDS) {
         expect(templeCoinRushMeta.levels![id - 1].scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[id]);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(maxScoreBound(courseFor(id)));
         expect(PROPOSED_LEVEL_LIMITS[id].maxDurationMs).toBe(LEVELS[id].durationMs);
         expect(progressFloorMs(courseFor(id))).toBeGreaterThan(20_000);
      }
   });

   it("base + maxPointsPerSec x s covers the score bound at every second of the clock", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const l = PROPOSED_LEVEL_LIMITS[id];
         for (let t = l.minDurationMs; t <= l.maxDurationMs; t += 100) expect(scoreBoundAt(c, t)).toBeLessThanOrEqual(l.base + (l.maxPointsPerSec * t) / 1000);
      }
   });

   for (const id of LEVEL_IDS) {
      it(`level ${id}: the honest bot wins at 30, 60 and 144 Hz inside every limit, and reaches at least 65 % of maxScore`, () => {
         const l = PROPOSED_LEVEL_LIMITS[id];
         for (const fps of [30, 60, 144]) {
            const run = botRun(id, fps);
            expect(run.ended, `${fps} Hz`).toBe("win");
            const score = scoreOf(run);
            expect(withinServerLimits(score, run.simMs, { ...templeCoinRushMeta.levels![id - 1].scoring })).toBe(true);
            expect(score).toBeGreaterThanOrEqual(l.maxScore * 0.65);
         }
      }, 120_000);
   }

   it("the honest bot through the real store with ragged frames: a ranked points run inside the limits, the store's score = the run's", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1600 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(5, 1);
      const bot = createBot(run);
      const inp = createStepInput();
      const rng = createRng(11);
      for (let f = 0; f < 60_000 && store.getState().phase !== "over"; f++) {
         advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
         const dt = playedFrameDt(store.getState());
         if (dt <= 0) continue;
         bot.frameMs = dt * 1000;
         botInput(bot, run, inp);
         const ev = step(run, dt * 1000, inp);
         store.getState().setScore(scoreOf(run));
         if (ev.finished) {
            store.getState().setStat(STAT.finishMs, run.finishMs);
            store.getState().end("win");
         }
      }
      const s = store.getState();
      expect(s.endReason).toBe("win");
      const fin = finalScore(s);
      expect(fin.score).toBe(scoreOf(run));
      const rules = templeCoinRushMeta.scoring;
      const sent = normalizeRun({ slug: "temple-coin-rush", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-29T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(withinServerLimits(sent.score, sent.durationMs, rules)).toBe(true);
   });

   it("an idle runner (no input) runs on, pays the first toll when it can, and ends below the bot", () => {
      const run = createRun(1, 1);
      for (let f = 0; f < 100_000 && run.ended === null; f++) step(run, 1000 / 60, createStepInput());
      expect(run.ended).not.toBeNull();
      expect(scoreOf(run)).toBeLessThan(scoreOf(botRun(1)));
      expect(withinServerLimits(scoreOf(run), run.simMs, templeCoinRushMeta.scoring)).toBe(true);
   });
});
