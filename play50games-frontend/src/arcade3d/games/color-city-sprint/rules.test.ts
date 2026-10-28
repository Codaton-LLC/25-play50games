import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS } from "@/arcade3d/types";
import { botRun } from "./bot";
import { HEROES } from "./heroes";
import { colorCitySprintMeta } from "./meta";
import {
   PROPOSED_LEVEL_LIMITS,
   STAT,
   V_RED,
   V_RUN,
   createRun,
   createStepInput,
   finalScore,
   minDurationMsOf,
   runTimeMs,
   step,
} from "./rules";
import { allowAll, courseFor, pathMetres } from "./city";

const submitted = (run: ReturnType<typeof createRun>) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

describe("streets", () => {
   it("a red lane is exactly 30% faster and the cap is V_RED", () => {
      const run = createRun(1, 1);
      const e = run.course.edges.find((g) => g.kind === "street" && g.a === 0 && g.b === 1)!;
      const index = run.course.edges.indexOf(e);
      run.painted[index] = 1;
      run.lap = 1;
      run.hero.x = e.mx;
      run.hero.z = e.mz;
      const input = createStepInput();
      input.moveX = 1;
      for (let i = 0; i < 40; i++) step(run, 16, input);
      const speed = Math.hypot(run.hero.vx, run.hero.vz);
      expect(speed).toBeGreaterThan(V_RED * 0.95);
      expect(speed).toBeLessThanOrEqual(V_RED + 1e-6);
      expect(V_RED / V_RUN).toBeCloseTo(1.3, 5);
   });

   it("the same inputs paint the same streets", () => {
      const a = createRun(4, 1);
      const b = createRun(4, 1);
      const input = createStepInput();
      input.moveX = 1;
      for (let i = 0; i < 80; i++) {
         step(a, 16, input);
         step(b, 16, input);
      }
      expect(a.hero.x).toBeCloseTo(b.hero.x, 6);
      expect(Array.from(a.leg)).toEqual(Array.from(b.leg));
   });

   it("the alley is the short way from the east beacon to the north-west", () => {
      const c = courseFor(1);
      expect(pathMetres(c, 2, 6, allowAll)).toBeLessThan(pathMetres(c, 2, 6, (e) => e.kind === "street"));
   });

   it("an idle hero times out on the timer, exactly", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(1, id);
         const none = createStepInput();
         for (let f = 0; f < 20_000 && run.ended === null; f++) step(run, 50, none);
         expect(run.ended).toBe("timeup");
         expect(run.simMs).toBe(run.course.timerMs);
      }
   });
});

describe("honest bot", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id} wins above the floor`, () => {
         const run = botRun(id, 60);
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(run.ended).toBe("win");
         const d = submitted(run);
         expect(d).toBeGreaterThanOrEqual(lim.minDurationMs);
         expect(d).toBeLessThanOrEqual(lim.maxDurationMs);
         expect(lim).toEqual({
            kind: "time",
            maxScore: Math.floor((run.course.timerMs - lim.minDurationMs) / 10),
            minDurationMs: lim.minDurationMs,
            maxDurationMs: run.course.timerMs,
            timeBaseMs: run.course.timerMs,
         });
         expect(minDurationMsOf(run.course)).toBeGreaterThanOrEqual(lim.minDurationMs);
      });
   }

   it("spam on level 1 never beats the floor", () => {
      const lim = PROPOSED_LEVEL_LIMITS[1];
      for (let seed = 1; seed <= 24; seed++) {
         const rng = createRng(seed * 7919);
         const run = createRun(seed, 1, HEROES[seed % 5].id);
         const input = createStepInput();
         for (let f = 0; f < 2500 && run.ended === null; f++) {
            if (f % 8 === 0) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = rng() * 2 - 1;
               input.yaw = rng() * Math.PI * 2;
            }
            input.jumpPressed = rng() < 0.35;
            input.actionPressed = rng() < 0.2;
            step(run, 8 + rng() * 30, input);
         }
         if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
      }
   });

   it("the honest bot through the real store is a ranked win inside the limits", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1400 });
      store.getState().markReady();
      store.getState().start();
      const run = botRun(1, 60);
      expect(run.ended).toBe("win");
      store.getState().setStat(STAT.orbs, run.orbs);
      store.getState().setStat(STAT.finishMs, run.finishMs);
      store.getState().setStat(STAT.comboMs, run.combo.bonusTotal);
      store.getState().end("win");
      const fin = finalScore(store.getState());
      const rules = colorCitySprintMeta.scoring;
      const sent = normalizeRun({ slug: "color-city-sprint", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-28T00:00:00Z" }, rules);
      expect(isRankedRun(rules, "win")).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
      expect(advanceRunClock).toBeTypeOf("function");
      expect(playedFrameDt).toBeTypeOf("function");
   });
});
