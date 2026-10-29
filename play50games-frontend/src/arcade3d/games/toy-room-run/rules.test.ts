// Toy Room Run rules: the domino wave and its bridges, stalls, forks, drums and cars, the hero routes,
// Jack Wobble, the server-limit proof (README "Score limits"): the per-ms travel cap and the boost
// budget the proof rests on, the pinned limits, and the honest, idle and spam bots, driven through
// the real store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { toyRoomRunMeta } from "./meta";
import { LEDGE_Y, LEVELS, SHELF_Y } from "./levels";
import { DASH_BOOST, HEROES, type HeroId } from "./heroes";
import { botRun, createBot, botInput } from "./bot";
import { BRIDGE_MS, PENCIL_H, PIECE_SPACING } from "./room";
import { JACK } from "./progression";
import {
   ORB_BONUS_MS,
   PROPOSED_LEVEL_LIMITS,
   STAT,
   V_AIR,
   V_JUMP,
   V_RUN,
   boostBudgetMetres,
   bossMinMs,
   comboSpecOf,
   courseFor,
   createRun,
   createStepInput,
   finalScore,
   minDurationMsOf,
   minFinishMs,
   pieceBridge,
   pieceStanding,
   proposeLimits,
   runTimeMs,
   step,
   travelMetres,
   type StepInput,
   type ToyRun,
} from "./rules";

const submitted = (run: ToyRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);
const apex = (v: number) => (v * v) / 60;

function hold(run: ToyRun, ms: number, input: StepInput, frame = 16): void {
   let left = ms;
   while (left > 0 && run.ended === null) {
      const d = Math.min(frame, left);
      step(run, d, input);
      input.jumpPressed = false;
      input.actionPressed = false;
      left -= d;
   }
}

function at(level: LevelId, x: number, z: number, hero: HeroId = "zuno"): ToyRun {
   const run = createRun(1, level, hero);
   run.hero.x = x;
   run.hero.z = z;
   return run;
}

const go = (dx: number, dz: number): StepInput => ({ ...createStepInput(), moveX: dx, moveZ: dz });

describe("the domino wave", () => {
   it("walking into a starter starts its chain; each piece falls when the wave reaches it (s / speed)", () => {
      const run = at(1, 0, 9);
      const c = run.course;
      hold(run, 1200, go(0, 1));
      expect(run.status[0]).toBe(1);
      const ch = c.chains[0];
      const t0 = run.fallAt[ch.first];
      for (let k = 1; k < ch.count; k++) expect(run.fallAt[ch.first + k] - t0).toBeCloseTo((c.pieces[ch.first + k].s * 1000) / ch.speed, 6);
   });

   it("a fallen piece over a gap is a bridge; a timed one slides off after BRIDGE_MS (L1's first chain never does)", () => {
      const run = at(1, 0, 9);
      hold(run, 1000, go(0, 1));
      hold(run, 8000, createStepInput());
      const c = run.course;
      const gapPieces = c.pieces.map((p, i) => ({ p, i })).filter((q) => q.p.chain === 0 && q.p.gap);
      expect(gapPieces.length).toBeGreaterThan(4);
      for (const q of gapPieces) expect(pieceBridge(run, q.i)).toBe(true);
      // chain 1 is timed
      const r2 = at(1, -2.5, 33);
      hold(r2, 1000, go(0, 1));
      const ch = c.chains[1];
      const last = ch.first + ch.count - 1;
      hold(r2, Math.max(0, r2.fallAt[last] - r2.simMs) + 10, createStepInput());
      expect(pieceBridge(r2, last)).toBe(true);
      hold(r2, BRIDGE_MS + 50, createStepInput());
      expect(pieceBridge(r2, last)).toBe(false);
   });

   it("running into a standing piece bounces you back", () => {
      const run = at(1, -2.5, 30);
      const c = run.course;
      const p = c.pieces[c.chains[1].first + 3];
      run.hero.x = p.x + 3;
      run.hero.z = p.z;
      hold(run, 1200, go(-1, 0));
      expect(run.bounces).toBeGreaterThan(0);
      expect(run.hero.x).toBeGreaterThan(p.x);
      expect(pieceStanding(run, c.chains[1].first + 3)).toBe(true);
   });

   it("an empty slot stalls the wave until a spare is pushed in; Zuno's magnet pulls it from 5 m", () => {
      for (const hero of ["riko", "zuno"] as const) {
         const run = at(2, 0, 6, hero);
         const c = run.course;
         hold(run, 800, go(0, 1));
         hold(run, 2500, createStepInput());
         const ch = c.chains[0];
         const slot = ch.spec.missing![0];
         expect(run.fallAt[ch.first + slot]).toBe(Infinity);
         expect(run.fallAt[ch.first + slot + 1]).toBe(Infinity);
         const sp = run.spares[0];
         run.hero.x = sp.x + 4;
         run.hero.z = sp.z;
         const p = createStepInput();
         p.actionPressed = hero === "zuno";
         hold(run, 300, p);
         expect(run.spareUsed[0], hero).toBe(hero === "zuno" ? 1 : 0);
         if (hero === "riko") {
            hold(run, 1200, go(-1, 0));
            expect(run.spareUsed[0]).toBe(1);
         }
         hold(run, 3000, createStepInput());
         expect(run.fallAt[ch.first + slot + 1]).toBeLessThan(Infinity);
      }
   });

   it("a fork starts when its parent's piece falls", () => {
      const run = at(2, 0, 36);
      const c = run.course;
      hold(run, 800, go(0, 1));
      hold(run, 4000, createStepInput());
      expect(run.status[1]).toBeGreaterThan(0);
      expect(run.status[2]).toBeGreaterThan(0);
      expect(run.status[3]).toBeGreaterThan(0);
      const parent = c.chains[1];
      expect(run.fallAt[c.chains[3].first]).toBeCloseTo(run.fallAt[parent.first + 8], 6);
   });

   it("the drum throws whoever stands on it as the wave hits it, up to the shelf (a plain jump never gets there)", () => {
      expect(apex(V_JUMP)).toBeLessThan(SHELF_Y);
      const run = createRun(1, 1);
      const c = run.course;
      const d = c.drums[0];
      const starter = c.pieces[c.chains[2].first];
      run.hero.x = starter.x;
      run.hero.z = starter.z - 1.2;
      hold(run, 400, go(0, 1));
      run.hero.x = d.x;
      run.hero.z = d.z;
      run.hero.y = 0.7;
      let top = 0;
      for (let f = 0; f < 600 && top < SHELF_Y + 0.5; f++) {
         step(run, 16, createStepInput());
         top = Math.max(top, run.hero.y);
      }
      expect(top).toBeGreaterThan(SHELF_Y);
   });
});

describe("hero routes", () => {
   it("only Nami's second jump off the pencil ramp reaches the high ledge", () => {
      expect(PENCIL_H + apex(V_JUMP)).toBeLessThan(LEDGE_Y);
      expect(PENCIL_H + apex(V_JUMP) + apex(V_AIR)).toBeGreaterThan(LEDGE_Y + 0.5);
      expect(apex(V_JUMP) + apex(V_AIR)).toBeLessThan(LEDGE_Y);
   });

   it("Riko's dash breaks the cracked block wall; anyone else just bumps it", () => {
      const c = courseFor(1);
      const w = c.walls[0];
      for (const hero of ["riko", "kiro"] as const) {
         const run = at(1, w.x0 - 2, (w.z0 + w.z1) / 2, hero);
         const inp = go(1, 0);
         inp.actionPressed = hero === "riko";
         hold(run, 900, inp);
         expect(run.wallBroken[0], hero).toBe(hero === "riko" ? 1 : 0);
      }
   });

   it("Vexa phases through the castle's ghost doorway; it is a wall for everyone else", () => {
      const c = courseFor(1);
      const g = c.ghosts[0];
      for (const hero of ["vexa", "zuno"] as const) {
         const run = at(1, g.x1 + 1.5, (g.z0 + g.z1) / 2, hero);
         const inp = go(-1, 0);
         inp.actionPressed = hero === "vexa";
         hold(run, 1500, inp);
         if (hero === "vexa") expect(run.hero.x).toBeLessThan(g.x0);
         else expect(run.hero.x).toBeGreaterThan(g.x1);
      }
   });

   it("a toy-block cascade knocks you, never Kiro behind his shield", () => {
      const c = courseFor(1);
      const z = c.cascades[0];
      for (const hero of ["zuno", "kiro"] as const) {
         const run = at(1, (z.x0 + z.x1) / 2, (z.z0 + z.z1) / 2, hero);
         const p = createStepInput();
         p.actionPressed = hero === "kiro";
         hold(run, 2900, p);
         if (hero === "kiro") expect(run.strikes).toBe(0);
         else expect(run.strikes).toBeGreaterThan(0);
      }
   });
});

describe("Jack Wobble (level 5)", () => {
   it("the boss config is valid and its least defeat time is its windows back to back", () => {
      expect(bossProblems(JACK)).toEqual([]);
      const p = JACK.phases;
      const least = JACK.introMs + 3 * (p[0].attacks[0].telegraphMs + p[0].attacks[0].attackMs) + JACK.transitionMs + 2 * (p[1].attacks[0].telegraphMs + p[1].attacks[0].attackMs) + JACK.transitionMs + (p[2].attacks[0].telegraphMs + p[2].attacks[0].attackMs);
      expect(bossMinMs()).toBe(least);
   });

   it("the honest bot beats all three phases at 30, 60 and 144 fps, never under the floor", () => {
      for (const fps of [30, 60, 144]) {
         const run = botRun(5, fps);
         expect(run.ended, `${fps}`).toBe("win");
         expect(run.boss!.hp).toBe(0);
         expect(run.finishMs).toBeGreaterThanOrEqual(bossMinMs());
         expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[5].minDurationMs);
      }
   }, 60_000);
});

describe("the lower bound (README 'Score limits')", () => {
   it("the proof's invariant: per ms, never more than V_RUN / 1000 m plus an active boost, and the boost metres stay in the budget", () => {
      for (const level of LEVEL_IDS) {
         for (let seed = 1; seed <= 3; seed++) {
            const rng = createRng(seed * 7 + level);
            const run = createRun(seed, level, HEROES[(seed + level) % 5].id);
            const inp = createStepInput();
            for (let ms = 0; ms < 25_000 && run.ended === null; ms++) {
               if (ms % 200 === 0) {
                  inp.moveX = rng() * 2 - 1;
                  inp.moveZ = rng() * 2 - 0.6;
                  inp.yaw = rng() * 6.3;
               }
               inp.jumpPressed = rng() < 0.01;
               inp.actionPressed = rng() < 0.005;
               const x = run.hero.x;
               const z = run.hero.z;
               const lost = run.hero.lostUntil >= 0;
               step(run, 1, inp);
               if (lost || run.events.respawned) continue;
               expect(Math.hypot(run.hero.x - x, run.hero.z - z)).toBeLessThanOrEqual((V_RUN + DASH_BOOST + 3) / 1000 + 1e-9);
               expect(run.extraMetres).toBeLessThanOrEqual(boostBudgetMetres(run.course) + 1e-6);
            }
         }
      }
   }, 60_000);

   it("the least duration takes off every orb and the most flow bonus; level 5's is Jack's least defeat time", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(minDurationMsOf(c)).toBeCloseTo(minFinishMs(c) - c.orbs.length * ORB_BONUS_MS - comboMaxBonus(comboSpecOf(c)), 6);
         if (!c.boss) expect(minFinishMs(c)).toBeCloseTo(((travelMetres(c) - boostBudgetMetres(c)) / V_RUN) * 1000, 6);
      }
      expect(minFinishMs(courseFor(5))).toBe(bossMinMs());
   });

   it("every level's minDurationMs is 94-100 % of its bound; the limits are pinned and shipped by meta", () => {
      for (const id of LEVEL_IDS) {
         const lb = minDurationMsOf(courseFor(id));
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(id, courseFor(id)));
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.94);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.timeBaseMs).toBe(LEVELS[id].timerMs);
         expect(toyRoomRunMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(toyRoomRunMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
      void PIECE_SPACING;
   });
});

/** minDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [0, 0, 0],
   [0, 0, 0],
   [0, 0, 0],
   [0, 0, 0],
   [0, 0, 0],
];

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot wins at 30, 60 and 144 fps, inside the limits`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const fps of [30, 60, 144]) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            const d = submitted(run);
            expect(d).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(d).toBeLessThanOrEqual(lim.maxDurationMs);
         }
      }, 60_000);
   }

   it("idle never wins: the level's timer runs out ('timeup', unranked)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, id);
         const none = createStepInput();
         for (let f = 0; f < 10_000 && run.ended === null; f++) step(run, 50, none);
         expect(run.ended).toBe("timeup");
      }
      expect(isRankedRun(toyRoomRunMeta.scoring, "timeup")).toBe(false);
   });

   it("200 spam runs on level 1 (random stick, jump and power, random frame times, any hero) never beat the floor", () => {
      const lim = PROPOSED_LEVEL_LIMITS[1];
      for (let seed = 1; seed <= 200; seed++) {
         const rng = createRng(seed * 7919);
         const run = createRun(seed, 1, HEROES[seed % 5].id);
         const inp = createStepInput();
         for (let f = 0; f < 4000 && run.ended === null; f++) {
            if (f % 10 === 0) {
               inp.moveX = rng() * 2 - 1;
               inp.moveZ = rng() * 2 - 0.5;
            }
            inp.jumpPressed = rng() < 0.3;
            inp.actionPressed = rng() < 0.1;
            step(run, 4 + rng() * 46, inp);
         }
         if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
      }
   });

   it("the honest bot through the real store with ragged frames: a ranked win inside the limits, the score from the time", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1500 });
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
         if (ev.finished) {
            store.getState().setStat(STAT.orbs, run.orbs);
            store.getState().setStat(STAT.finishMs, run.finishMs);
            store.getState().setStat(STAT.comboMs, run.combo.bonusTotal);
            store.getState().end("win");
         }
      }
      const s = store.getState();
      expect(s.endReason).toBe("win");
      const fin = finalScore(s);
      const rules = toyRoomRunMeta.scoring;
      const sent = normalizeRun({ slug: "toy-room-run", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-29T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   });
});
