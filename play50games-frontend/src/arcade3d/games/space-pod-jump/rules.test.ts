// Space Pod Jump rules (rules.ts): the systems (system.ts), patched-conic gravity (only the dominant body
// pulls; a jump always comes back down; a full pod launch escapes), walking, pods and their aim, the jets,
// landing and captures, lost in space, the hazards and the hero gates, the Orbit Warden, the speed guard,
// the bound and the pinned limits, and the honest bot driven through the real store like the shell does.
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
import { COMBO, SECRETS, WARDEN, starSpecFor } from "./progression";
import { spacePodJumpMeta } from "./meta";
import { G_SURF, SOI_K } from "./system";
import {
   CHORD_V,
   JETS,
   LOST_MS,
   NONE,
   POD,
   PROPOSED_LEVEL_LIMITS,
   STAT,
   V_JUMP,
   V_MAX,
   bodyAt,
   courseFor,
   createArcResult,
   createRun,
   createStepInput,
   dominantAt,
   finalScore,
   launchSpeed,
   minDurationMsOf,
   minFinishMs,
   predictArc,
   runTimeMs,
   step,
   type PodRun,
} from "./rules";
import type { HeroId } from "./heroes";

const idle = createStepInput();

function botRun(level: LevelId, fps = 60, hero: HeroId = "vexa", mash = false): PodRun {
   const fms = 1000 / fps;
   const run = createRun(3, level, hero);
   const bot = createBot(run, fms);
   bot.mash = mash;
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}

describe("the systems", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: bodies with mu = 6 R^2 and SOI = 2.5 R, pods on static bodies, the dock past the start, the secrets placed`, () => {
         const c = courseFor(id);
         for (const b of c.bodies) {
            expect(b.mu).toBeCloseTo(G_SURF * b.R * b.R, 9);
            expect(b.soi).toBeCloseTo(SOI_K * b.R, 9);
         }
         expect(c.dock.x).toBeGreaterThan(c.startX + 20);
         expect(c.secrets).toHaveLength(SECRETS[id].length);
         expect(secretProblems(SECRETS[id])).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, c.mainOrbs))).toEqual([]);
         expect(c.mainOrbs).toBeGreaterThanOrEqual(10);
      });
   }

   it("the card's twists: level 3 moving moons, gates and debris; level 4 floating crates and a gap with no body; level 5 the Warden", () => {
      expect(courseFor(3).bodies.some((b) => b.kind === "moon")).toBe(true);
      expect(courseFor(3).gates.length).toBeGreaterThan(0);
      expect(courseFor(3).debris.length).toBeGreaterThan(0);
      expect(courseFor(4).crates.length).toBeGreaterThanOrEqual(3);
      expect(dominantAt(courseFor(4), 47, 0, 0)).toBe(NONE);
      expect(courseFor(5).warden).toBeGreaterThanOrEqual(0);
      expect(bossProblems(WARDEN)).toEqual([]);
      expect(comboConfigProblems(COMBO)).toEqual([]);
   });
});

describe("patched-conic gravity", () => {
   it("a jump (4.5 m/s) always comes back down; a full pod launch (9 m/s) escapes an R = 4 planetoid (escape about 6.9 m/s)", () => {
      const c = courseFor(1);
      const b = c.bodies[0];
      const esc = Math.sqrt((2 * b.mu) / b.R);
      expect(esc).toBeCloseTo(6.93, 1);
      expect(V_JUMP).toBeLessThan(esc);
      expect(launchSpeed(POD.chargeMs)).toBeGreaterThan(esc);
      const run = createRun(1, 1);
      const res = createArcResult();
      // straight up from the top of body 0
      predictArc(run, b.x, b.y + b.R, 0, V_JUMP, 0, 6000, null, res, null, 1, 0);
      expect(res.kind).toBe(1);
      expect(res.body).toBe(0);
   });

   it("only the dominant SOI pulls: between two overlapping bodies the nearer one (by distance / SOI) wins", () => {
      const c = courseFor(1);
      expect(dominantAt(c, 4.5, 0, 0)).toBe(0);
      expect(dominantAt(c, 7.5, 0, 0)).toBe(1);
      expect(dominantAt(c, 0, 40, 0)).toBe(NONE);
   });

   it("level 1, beat 2: a jump straight towards the second planetoid lands on it", () => {
      const run = createRun(1, 1);
      const res = createArcResult();
      predictArc(run, 4, 0, V_JUMP, 0, 0, 6000, null, res, null, 1, 0);
      expect(res.kind).toBe(1);
      expect(res.body).toBe(1);
   });
});

describe("walking, pods, jets, landing, lost", () => {
   it("on a pod Jump held charges up to 0.8 s; let go, it launches at 5-9 m/s", () => {
      const run = createRun(1, 1);
      const h = run.hero;
      h.body = 1;
      h.angle = 0;
      const press = { ...createStepInput(), jump: true, jumpPressed: true };
      step(run, 16, press);
      expect(h.pod).toBe(0);
      const hold = { ...createStepInput(), jump: true };
      for (let k = 0; k < 60; k++) step(run, 16, hold);
      expect(h.chargeMs).toBe(POD.chargeMs);
      const ev = step(run, 16, idle);
      expect(ev.launched).toBe(true);
      expect(ev.launchSpeed).toBeCloseTo(POD.max, 6);
      expect(h.grounded).toBe(false);
   });

   it("the jets fire only after Jump was let go once in the flight; 1.2 s of fuel, refilled on landing", () => {
      const run = createRun(1, 1);
      const h = run.hero;
      step(run, 16, { ...createStepInput(), jump: true, jumpPressed: true });
      expect(h.grounded).toBe(false);
      const ev1 = step(run, 16, { ...createStepInput(), jump: true });
      expect(ev1.jets).toBe(false);
      step(run, 16, idle);
      let used = 0;
      for (let k = 0; k < 200 && !h.grounded; k++) {
         const ev = step(run, 10, { ...createStepInput(), jump: true });
         if (ev.jets) used += 10;
      }
      expect(run.jetsUsedMs).toBeLessThanOrEqual(JETS.fuelMs);
      expect(used).toBeGreaterThan(0);
      for (let k = 0; k < 400 && !h.grounded; k++) step(run, 16, idle);
      expect(h.grounded).toBe(true);
      expect(h.fuelMs).toBe(JETS.fuelMs);
   });

   it("lost in space: outside every SOI and the map for 1 s, back to the last planetoid", () => {
      const run = createRun(1, 1);
      const h = run.hero;
      h.grounded = false;
      h.x = run.course.bounds.maxX + 5;
      h.y = 0;
      h.vx = 5;
      h.vy = 0;
      for (let k = 0; k < LOST_MS + 50 && run.losts === 0; k++) step(run, 1, idle);
      expect(run.losts).toBe(1);
      expect(h.grounded).toBe(true);
      expect(h.body).toBe(0);
   });

   it("Vexa's phase on a planetoid is a straight chord to its far side at 6 m/s, and opens the ghost hatch", () => {
      const run = createRun(1, 1, "vexa");
      const h = run.hero;
      const hatch = run.course.secrets[0];
      h.angle = hatch.angle;
      step(run, 1, { ...createStepInput(), actionPressed: true });
      expect(h.chordFrom).not.toBe(NONE);
      const R = run.course.bodies[0].R;
      for (let k = 0; k < 3000 && h.chordFrom !== NONE; k++) step(run, 1, idle);
      expect(run.simMs).toBeGreaterThanOrEqual(Math.floor(((2 * R) / CHORD_V) * 1000));
      expect(Math.abs(Math.cos(h.angle - (hatch.angle + Math.PI)) - 1)).toBeLessThan(1e-6);
      expect(run.secrets.found[0]).toBeTruthy();
   });
});

describe("the bounds and the limits", () => {
   it("the speed guard: no ms moves the hero more than V_MAX / 1000 m (bar a respawn to a point it reached), any hero, power mashed", () => {
      for (const id of LEVEL_IDS) {
         for (const hero of ["riko", "nami"] as HeroId[]) {
            const run = createRun(2, id, hero);
            const bot = createBot(run, 1);
            bot.mash = true;
            const input = createStepInput();
            for (let ms = 0; ms < 20_000 && run.ended === null; ms++) {
               botInput(bot, run, input);
               const x0 = run.hero.x;
               const y0 = run.hero.y;
               const ev = step(run, 1, input);
               if (ev.respawned) continue;
               expect(Math.hypot(run.hero.x - x0, run.hero.y - y0)).toBeLessThanOrEqual(V_MAX / 1000 + 1e-9);
            }
         }
      }
   }, 180_000);

   it("the pinned limits (meta, arcade-games.json and these numbers move together)", () => {
      const PINNED = LEVEL_IDS.map((id) => {
         const l = PROPOSED_LEVEL_LIMITS[id];
         return [l.minDurationMs, l.maxDurationMs, l.timeBaseMs, l.maxScore];
      });
      expect(PINNED).toEqual([
         [1900, 120000, 120000, 11810],
         [7800, 150000, 150000, 14220],
         [6300, 160000, 160000, 15370],
         [7800, 170000, 170000, 16220],
         [16000, 260000, 260000, 24400],
      ]);
      expect(spacePodJumpMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      for (const id of LEVEL_IDS) {
         expect(spacePodJumpMeta.levels![id - 1].scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[id]);
         const lb = minDurationMsOf(courseFor(id));
         expect(PROPOSED_LEVEL_LIMITS[id].minDurationMs).toBeLessThanOrEqual(lb);
         expect(PROPOSED_LEVEL_LIMITS[id].minDurationMs).toBeGreaterThanOrEqual(lb * 0.94);
         expect(PROPOSED_LEVEL_LIMITS[id].timeBaseMs).toBe(LEVELS[id].durationMs);
      }
   });

   for (const id of LEVEL_IDS) {
      it(`level ${id}: the honest bot wins at 30, 60 and 144 Hz and never beats the floor`, () => {
         for (const fps of [30, 60, 144]) {
            const run = botRun(id, fps);
            expect(run.ended, `${fps} Hz`).toBe("win");
            expect(runTimeMs(run)).toBeGreaterThanOrEqual(minFinishMs(run.course));
            expect(runTimeMs(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[id].minDurationMs);
         }
      }, 180_000);
   }

   it("level 5: the bot brings the Warden down before docking", () => {
      const run = botRun(5);
      expect(run.boss!.hp).toBe(0);
      expect(run.ended).toBe("win");
   }, 60_000);

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
      const fin = finalScore(s);
      const rules = spacePodJumpMeta.scoring;
      const sent = normalizeRun({ slug: "space-pod-jump", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-29T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   });

   it("spam (random walking, jumps, holds, power, frame times, rolls) never beats the floor on any level", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 1; seed <= 12; seed++) {
            const rng = createRng(seed * 7919 + id);
            const run = createRun(seed, id, (["riko", "nami", "kiro", "zuno", "vexa"] as HeroId[])[seed % 5]);
            const input = createStepInput();
            for (let f = 0; f < 12_000 && run.ended === null; f++) {
               input.moveX = rng() * 2 - 1;
               input.up = rng() < 0.2;
               input.jump = rng() < 0.4;
               input.jumpPressed = rng() < 0.2;
               input.actionPressed = rng() < 0.2;
               input.roll = rng() * 6.3;
               step(run, 4 + rng() * 46, input);
            }
            if (run.ended === "win") expect(runTimeMs(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[id].minDurationMs);
         }
      }
   }, 180_000);

   it("every hero with its power mashed clears level 1 and never beats the floor", () => {
      for (const hero of ["riko", "nami", "kiro", "zuno", "vexa"] as HeroId[]) {
         const run = botRun(1, 60, hero, true);
         expect(run.ended, hero).toBe("win");
         expect(runTimeMs(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].minDurationMs);
      }
   }, 120_000);

   it("a moon's motion stays under the speed cap (a grounded hero is carried at most moon + walk speed)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         for (const b of c.bodies) if (b.orbit) expect(Math.abs(b.orbit.r * b.orbit.w) + 4).toBeLessThan(V_MAX);
         const B = { x: 0, y: 0, vx: 0, vy: 0 };
         if (c.bodies[0]) bodyAt(c, 0, 0, B);
      }
   });
});
