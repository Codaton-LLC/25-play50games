// Color Rail Grind rules (rules.ts): the network (network.ts), the switches (lit, thrown, the skip window,
// frozen ones and the stomp), the branches (orb, dead end and its buffer stop, merges), the hops (only
// between parallel grid rails), the gaps and the hook, the hazards and the hero gates, the toy trains,
// the Clockwork Express, the z guard, the bound and the pinned limits, and the honest bot driven through
// the real store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { comboConfigProblems } from "@/arcade3d/menu2/combo/combo";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { starSpecProblems } from "@/arcade3d/menu2/stars/stars";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { LEVELS } from "./levels";
import { CLOCKWORK, COMBO, SECRETS, starSpecFor } from "./progression";
import { colorRailGrindMeta } from "./meta";
import {
   BONK_MS,
   BRANCH,
   END,
   GRID,
   HAZ,
   HIGHLIGHT_MS,
   HOOK_MS,
   NONE,
   PROPOSED_LEVEL_LIMITS,
   SKIP_MS,
   STAT,
   SWITCHED,
   courseFor,
   createRun,
   createStepInput,
   finalScore,
   laneDirection,
   laneX,
   litSwitch,
   minDurationMsOf,
   pieceAt,
   runTimeMs,
   step,
   type RailRun,
} from "./rules";
import type { HeroId } from "./heroes";

const idle = createStepInput();

function runUntil(run: RailRun, until: (r: RailRun) => boolean, max = 200_000, input = idle): void {
   for (let i = 0; i < max && run.ended === null && !until(run); i++) step(run, 1, input);
}

/** Puts the hero grinding at z on a grid lane. */
function placeAt(run: RailRun, z: number, lane: number): void {
   const h = run.hero;
   const p = pieceAt(run.course, lane, 0, z, true);
   if (!p) throw new Error(`no grid rail on lane ${lane} at ${z}`);
   h.z = z;
   h.lane = lane;
   h.x = laneX(lane);
   h.piece = p.index;
   h.tier = 0;
   h.y = 0;
   h.grounded = true;
}

function botRun(level: LevelId, fps = 60, hero: HeroId = "zuno", seed = 3, mash = false): RailRun {
   const fms = 1000 / fps;
   const run = createRun(seed, level, hero);
   const bot = createBot(run, fms);
   bot.mash = mash;
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}

const press = (k: Partial<ReturnType<typeof createStepInput>>) => ({ ...createStepInput(), ...k });

describe("the network", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: no two pieces overlap on a rail, every switch opens a branch beside its rail, the card's main orbs, the secrets placed`, () => {
         const c = courseFor(id);
         for (const a of c.pieces) for (const b of c.pieces) if (a.index < b.index && a.lane === b.lane && a.tier === b.tier) expect(a.z1 >= b.z0 || b.z1 >= a.z0, `L${id} lane ${a.lane}`).toBe(true);
         for (const j of c.junctions) {
            const p = c.pieces[j.piece];
            expect(p.lane).toBe(j.to);
            expect(p.z0).toBe(j.z);
            expect(p.side).not.toBe(0);
            expect(pieceAt(c, j.lane, 0, j.z - 0.5), `L${id} switch ${j.index} keeps its straight rail`).not.toBeNull();
         }
         for (const p of c.pieces) if (p.end === END.merge) expect(pieceAt(c, p.mergeTo, 0, p.z1 - 0.01) ?? pieceAt(c, p.mergeTo, 0, p.z1 + 0.01), `L${id} merge of ${p.index}`).not.toBeNull();
         expect(c.mainOrbs).toBe(LEVELS[id].orbs);
         expect(c.secrets).toHaveLength(SECRETS[id].length);
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, c.mainOrbs))).toEqual([]);
      });
   }

   it("the card's twists: level 2 has dead ends and the golden caboose; level 3 frozen rails and switches; level 4 toy trains; every level a ghost spur and Zuno's loop", () => {
      const has = (id: LevelId, b: number) => courseFor(id).pieces.some((p) => p.branch === b);
      expect(has(2, BRANCH.dead)).toBe(true);
      expect(has(2, BRANCH.caboose)).toBe(true);
      expect(courseFor(3).pieces.every((p) => p.frozen)).toBe(true);
      expect(courseFor(3).junctions.some((j) => j.frozen)).toBe(true);
      expect(courseFor(3).slopes).toHaveLength(0);
      expect(courseFor(4).trains.length).toBeGreaterThanOrEqual(3);
      for (const id of LEVEL_IDS) {
         expect(has(id, BRANCH.ghost)).toBe(true);
         expect(courseFor(id).loops.length).toBeGreaterThan(0);
         expect(courseFor(id).hazards.some((q) => q.kind === HAZ.icicles)).toBe(true);
      }
   });

   it("the boss and the combo are valid (menu2/boss, menu2/combo)", () => {
      expect(bossProblems(CLOCKWORK)).toEqual([]);
      expect(comboConfigProblems(COMBO)).toEqual([]);
   });
});

describe("the switches", () => {
   it("a switch lights up 1.5 s before the hero reaches it; thrown, the hero takes its branch; untouched, it goes straight on", () => {
      const c = courseFor(1);
      const j = c.junctions[0];
      const a = createRun(1, 1);
      placeAt(a, j.z + (c.speed * HIGHLIGHT_MS) / 1000 + 3, j.lane);
      expect(litSwitch(a)).toBe(NONE);
      runUntil(a, (r) => litSwitch(r) !== NONE);
      expect(a.hero.z - j.z).toBeLessThanOrEqual((c.speed * HIGHLIGHT_MS) / 1000 + 0.1);
      step(a, 1, press({ switchPressed: true }));
      expect(a.board.thrown[j.index]).toBe(1);
      runUntil(a, (r) => r.junctionResult[j.index] !== SWITCHED.pending);
      expect(a.junctionResult[j.index]).toBe(SWITCHED.branch);
      expect(a.hero.lane).toBe(j.to);
      expect(a.hero.piece).toBe(j.piece);
      const b = createRun(1, 1);
      placeAt(b, j.z + 8, j.lane);
      runUntil(b, (r) => r.junctionResult[j.index] !== SWITCHED.pending);
      expect(b.junctionResult[j.index]).toBe(SWITCHED.straight);
      expect(b.hero.lane).toBe(j.lane);
   });

   it("a second press within SKIP_MS goes to the next switch on the path (level 2's golden caboose); later it throws the first one back", () => {
      const c = courseFor(2);
      const j2 = c.junctions.find((q) => c.pieces[q.piece].branch === BRANCH.caboose)!;
      const j1 = c.junctions.find((q) => q.to === j2.lane && q.z > j2.z && q.z - j2.z < 20)!;
      const run = createRun(1, 2);
      // both lit at once: within HIGHLIGHT_MS of the second switch (13 m after the first)
      placeAt(run, j1.z + 5, j1.lane);
      step(run, 1, press({ switchPressed: true }));
      step(run, 200, idle);
      step(run, 1, press({ switchPressed: true }));
      expect(run.board.thrown[j1.index]).toBe(1);
      expect(run.board.thrown[j2.index]).toBe(1);
      runUntil(run, (r) => r.hero.piece === j2.piece);
      const si = SECRETS[2].findIndex((s) => s.id === "caboose");
      runUntil(run, (r) => !!r.secrets.found[si] || r.hero.lane !== 4, 6000);
      expect(run.secrets.found[si]).toBeTruthy();
      // a press after the skip window toggles the first lit switch back
      const back = createRun(1, 2);
      placeAt(back, j1.z + 14, j1.lane);
      step(back, 1, press({ switchPressed: true }));
      for (let k = 0; k < SKIP_MS + 50; k += 10) step(back, 10, idle);
      step(back, 1, press({ switchPressed: true }));
      expect(back.board.thrown[j1.index]).toBe(0);
   });

   it("a frozen switch (level 3) only throws with a jump-stomp: a press on the rail clunks", () => {
      const c = courseFor(3);
      const j = c.junctions.find((q) => q.frozen)!;
      const run = createRun(1, 3);
      placeAt(run, j.z + 10, j.lane);
      const ev = step(run, 1, press({ switchPressed: true }));
      expect(ev.frozenClunk).toBe(true);
      expect(run.board.thrown[j.index]).toBe(0);
      step(run, 1, press({ jumpPressed: true }));
      step(run, 120, idle);
      step(run, 1, press({ switchPressed: true }));
      expect(run.board.thrown[j.index]).toBe(1);
      expect(run.hero.vy).toBeLessThan(0);
   });

   it("a dead end's buffer stop bonks the hero: stopped for 3 s, then back on its grid rail", () => {
      const c = courseFor(2);
      const j = c.junctions.find((q) => c.pieces[q.piece].branch === BRANCH.dead)!;
      const run = createRun(1, 2);
      placeAt(run, j.z + 8, j.lane);
      step(run, 1, press({ switchPressed: true }));
      runUntil(run, (r) => r.bonks > 0);
      const at = run.simMs;
      const z = run.hero.z;
      runUntil(run, (r) => r.simMs >= at + BONK_MS.buffer - 5);
      expect(run.hero.z).toBeCloseTo(z, 5);
      expect(run.hero.lane).toBe(j.lane);
      expect(c.pieces[run.hero.piece].side).toBe(0);
   });
});

describe("hops, gaps and the hook", () => {
   it("a hop goes only between parallel grid rails; never onto a missing rail nor off a branch", () => {
      const run = createRun(1, 1);
      placeAt(run, -5, 1);
      expect(step(run, 16, press({ left: true })).hopBlocked).toBe(true);
      expect(run.hero.lane).toBe(1);
      step(run, 16, press({ right: true }));
      expect(run.hero.lane).toBe(2);
      expect(laneDirection(false, true, Math.PI)).toBe(-1);
      expect(GRID).toBe(4);
   });

   it("a jump clears a gap; a missed gap drops the hero into the hook: carried across in at least 2 s, never faster than the level's speed", () => {
      const c = courseFor(1);
      const p = c.pieces.find((q) => q.end === END.gap && q.side === 0 && q.lane === 1)!;
      const a = createRun(1, 1);
      placeAt(a, p.z1 + 2, 1);
      runUntil(a, (r) => r.hero.z < p.z1 - 1);
      step(a, 1, press({ jumpPressed: true }));
      const b = createRun(1, 1);
      placeAt(b, p.z1 + c.speed * 0.08, 1);
      step(b, 1, press({ jumpPressed: true }));
      runUntil(b, (r) => r.hero.grounded && r.hero.z < p.z1 - 6, 5000);
      expect(b.falls).toBe(0);
      const h = createRun(1, 1);
      placeAt(h, p.z1 + 1, 1);
      runUntil(h, (r) => r.falls > 0, 3000);
      const t0 = h.simMs;
      let top = 0;
      runUntil(h, (r) => {
         top = Math.max(top, r.hero.v);
         return r.simMs >= r.hero.hookUntil;
      });
      expect(h.simMs - t0).toBeGreaterThanOrEqual(HOOK_MS - 1);
      expect(top).toBeLessThanOrEqual(c.speed + 1e-6);
      expect(h.hero.piece).not.toBe(NONE);
   });
});

describe("the hero gates", () => {
   const gate = (level: LevelId, hero: HeroId, kind: number, power: boolean) => {
      const c = courseFor(level);
      const j = c.junctions.find((q) => c.pieces[q.piece].branch === kind)!;
      const run = createRun(1, level, hero);
      placeAt(run, j.z + 6, j.lane);
      step(run, 1, press({ switchPressed: true }));
      const hz = c.hazards.find((q) => q.piece === j.piece)!;
      runUntil(run, (r) => r.hero.z < hz.z0 + (c.speed * 0.2), 3000);
      if (power) step(run, 1, press({ actionPressed: true }));
      runUntil(run, (r) => r.hero.z < hz.z0 - 2 || r.bonks > 0, 3000);
      return { run, j };
   };

   it("Riko's dash breaks a side spur's wooden barrier; without it, a bump back onto the grid", () => {
      const ok = gate(2, "riko", BRANCH.barrier, true);
      expect(ok.run.bonks).toBe(0);
      expect(ok.run.hero.piece).toBe(ok.j.piece);
      const no = gate(2, "kiro", BRANCH.barrier, false);
      expect(no.run.bonks).toBe(1);
      expect(no.run.hero.lane).toBe(no.j.lane);
   });

   it("Vexa's phase goes through the ghost door to the hidden spur and its shard", () => {
      const ok = gate(1, "vexa", BRANCH.ghost, true);
      expect(ok.run.bonks).toBe(0);
      const si = SECRETS[1].findIndex((s) => s.id === "hidden");
      runUntil(ok.run, (r) => !!r.secrets.found[si] || r.hero.piece !== ok.j.piece, 8000);
      expect(ok.run.secrets.found[si]).toBeTruthy();
      expect(gate(1, "riko", BRANCH.ghost, false).run.bonks).toBe(1);
   });

   it("Kiro's shield crosses an icicle tunnel; anyone else stumbles", () => {
      const c = courseFor(1);
      const hz = c.hazards.find((q) => q.kind === HAZ.icicles)!;
      const a = createRun(1, 1, "kiro");
      placeAt(a, hz.z0 + 2, hz.lane);
      step(a, 1, press({ actionPressed: true }));
      runUntil(a, (r) => r.hero.z < hz.z1);
      expect(a.stumbles).toBe(0);
      const b = createRun(1, 1, "riko");
      placeAt(b, hz.z0 + 2, hz.lane);
      runUntil(b, (r) => r.hero.z < hz.z1);
      expect(b.stumbles).toBe(1);
   });

   it("Zuno's magnet takes him round the loop (a boost and the shard); Nami's double jump reaches the high rails", () => {
      const c = courseFor(1);
      const lp = c.loops[0];
      const z = createRun(1, 1, "zuno");
      placeAt(z, lp.z0 + 3, lp.lane);
      step(z, 1, press({ actionPressed: true }));
      runUntil(z, (r) => r.hero.z < lp.z0 - 1);
      expect(z.hero.loopUntil).toBeGreaterThan(z.simMs);
      expect(z.secrets.found[SECRETS[1].findIndex((s) => s.id === "loop")]).toBeTruthy();
      const nami = botRun(1, 60, "nami");
      const zuno = botRun(1, 60, "zuno");
      const high = (r: RailRun) => r.course.orbs.filter((o, i) => o.y > 3 && r.collected[i]).length;
      expect(high(nami)).toBeGreaterThan(0);
      expect(high(zuno)).toBe(0);
   });
});

describe("the toy trains (level 4) and the Clockwork Express (level 5)", () => {
   it("a toy train follows the switches: thrown into a dead end, it crashes at the buffer stop", () => {
      const c = courseFor(4);
      const run = createRun(1, 4);
      const ti = 0;
      const t = run.trains[ti];
      const j = c.junctions.find((q) => q.lane === t.lane && q.z < t.z && c.pieces[q.piece].branch === BRANCH.dead)!;
      run.board.thrown[j.index] = 1;
      placeAt(run, t.z + 60, t.lane === 1 ? 2 : 1);
      runUntil(run, (r) => !r.trains[ti].live, 30_000);
      expect(run.trains[ti].live).toBe(false);
      expect(run.trains[ti].lane).toBe(j.to);
   });

   it("the honest bot routes the Express into its buffers, charges on rings and stomps its key: down, and the finish", () => {
      const run = botRun(5);
      expect(run.ended).toBe("win");
      expect(run.boss!.hp).toBe(0);
      expect(run.finishMs).toBeGreaterThan(0);
   });
});

describe("the bounds and the limits", () => {
   it("the z guard: no ms moves the hero more than vMax / 1000 m, for any hero with its power mashed", () => {
      for (const id of LEVEL_IDS) {
         for (const hero of ["riko", "zuno"] as HeroId[]) {
            const run = createRun(2, id, hero);
            const bot = createBot(run, 1);
            bot.mash = true;
            const input = createStepInput();
            for (let ms = 0; ms < 40_000 && run.ended === null; ms++) {
               botInput(bot, run, input);
               const z0 = run.hero.z;
               step(run, 1, input);
               expect(z0 - run.hero.z).toBeLessThanOrEqual(run.course.vMax / 1000 + 1e-9);
            }
         }
      }
   }, 120_000);

   it("the pinned limits (meta, arcade-games.json and these numbers move together)", () => {
      const PINNED = LEVEL_IDS.map((id) => {
         const l = PROPOSED_LEVEL_LIMITS[id];
         return [l.minDurationMs, l.maxDurationMs, l.timeBaseMs, l.maxScore];
      });
      expect(PINNED).toEqual([
         [22000, 120000, 120000, 9800],
         [25600, 150000, 150000, 12440],
         [17700, 170000, 170000, 15230],
         [26000, 180000, 180000, 15400],
         [24900, 260000, 260000, 23510],
      ]);
      expect(colorRailGrindMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      for (const id of LEVEL_IDS) {
         expect(colorRailGrindMeta.levels![id - 1].scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[id]);
         const lb = minDurationMsOf(courseFor(id));
         expect(PROPOSED_LEVEL_LIMITS[id].minDurationMs).toBeLessThanOrEqual(lb);
         expect(PROPOSED_LEVEL_LIMITS[id].minDurationMs).toBeGreaterThanOrEqual(lb * 0.94);
      }
   });

   for (const id of LEVEL_IDS) {
      it(`level ${id}: the honest bot wins at 30, 60 and 144 Hz (every main orb with Zuno), and never beats the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[id];
         for (const fps of [30, 60, 144]) {
            const run = botRun(id, fps);
            expect(run.ended, `${fps} Hz`).toBe("win");
            expect(runTimeMs(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
            if (fps === 60) expect(run.mainOrbs).toBe(courseFor(id).mainOrbs);
         }
      }, 120_000);
   }

   it("the honest bot through the real store with ragged frames: a ranked win inside the limits, the score from the time", () => {
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
         if (ev.finished) {
            store.getState().setStat(STAT.finishMs, run.finishMs);
            store.getState().setStat(STAT.submitted, runTimeMs(run));
            store.getState().end("win");
         }
      }
      const s = store.getState();
      expect(s.endReason).toBe("win");
      expect(run.finishMs).toBeLessThanOrEqual(s.elapsedMs + 1);
      const fin = finalScore(s);
      const rules = colorRailGrindMeta.scoring;
      const sent = normalizeRun({ slug: "color-rail-grind", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-29T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   });

   it("an idle grinder (no input) still finishes level 1 (nothing is fatal), slower than the bot", () => {
      const run = createRun(1, 1);
      for (let f = 0; f < 100_000 && run.ended === null; f++) step(run, 1000 / 60, createStepInput());
      expect(run.ended).toBe("win");
      expect(runTimeMs(run)).toBeGreaterThan(runTimeMs(botRun(1)));
   });
});
