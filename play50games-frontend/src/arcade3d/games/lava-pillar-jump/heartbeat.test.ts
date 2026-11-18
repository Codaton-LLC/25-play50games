// The signature mechanic (World 1 card "4 Lava Pillar Jump"): the lava surges on the volcano's
// heartbeat (telegraphed 1 s ahead), pillar tops heat under the feet and crumble, geyser vents fire on
// the beat (Kiro's shield rides them off-beat), and rocks are shaken loose by the beat.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import {
   H_VENT,
   HEAT,
   NONE,
   SURGE,
   VENT_HALF,
   VENT_OPEN_MS,
   beatIndex,
   courseFor,
   createRun,
   createStepInput,
   heatAt,
   lavaBase,
   lavaY,
   minFinishMs,
   step,
   strikeLive,
   surgeTelegraph,
   ventOpen,
   type LavaRun,
} from "./rules";

/** Stand the hero on support `i` (its centre), at rest. */
function standOn(run: LavaRun, i: number): void {
   const s = run.course.supports[i];
   const h = run.hero;
   h.x = s.cx;
   h.z = s.cz;
   h.y = s.top;
   h.grounded = true;
   h.support = i;
   h.lastTop = s.top;
   h.vx = 0;
   h.vz = 0;
}

function idleFor(run: LavaRun, ms: number): void {
   const none = createStepInput();
   for (let t = 0; t < ms && run.ended === null; t++) step(run, 1, none);
}

describe("the heartbeat surge", () => {
   it("rides on the tide: nothing before the first beat, +1.2 m 1.5 s after each beat, gone 3 s after", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const P = c.beatMs;
         expect(lavaY(c, P - 1)).toBeCloseTo(lavaBase(c, P - 1), 9);
         expect(lavaY(c, P + SURGE.riseMs) - lavaBase(c, P + SURGE.riseMs)).toBeCloseTo(SURGE.height, 6);
         expect(lavaY(c, P + SURGE.riseMs + SURGE.ebbMs) - lavaBase(c, P + SURGE.riseMs + SURGE.ebbMs)).toBeCloseTo(0, 6);
         expect(lavaY(c, 2 * P + 700)).toBeGreaterThan(lavaBase(c, 2 * P + 700));
      }
      expect([1, 2, 3, 4, 5].map((id) => courseFor(id as 1).beatMs)).toEqual([6000, 5000, 5000, 4000, 4000]);
   });

   it("is telegraphed 1 s ahead (a pure 0..1 ramp for the walls and the kick drum), and the run reports the telegraph and the beat once each", () => {
      const c = courseFor(1);
      expect(surgeTelegraph(c, 4999)).toBe(0);
      expect(surgeTelegraph(c, 5000)).toBe(0);
      expect(surgeTelegraph(c, 5500)).toBeCloseTo(0.5, 9);
      expect(surgeTelegraph(c, 5999)).toBeGreaterThan(0.99);
      expect(beatIndex(c, 5999)).toBe(0);
      expect(beatIndex(c, 6000)).toBe(1);
      const run = createRun(1, 1);
      const none = createStepInput();
      const tele: number[] = [];
      const beats: number[] = [];
      for (let t = 0; t < 12_500 && run.ended === null; t++) {
         const ev = step(run, 1, none);
         if (ev.telegraph) tele.push(run.simMs);
         if (ev.beat) beats.push(run.simMs);
      }
      expect(tele).toEqual([5000, 11000]);
      expect(beats).toEqual([6000, 12000]);
   });
});

describe("hot-foot", () => {
   it("a top glows orange at 1.2 s, white at 2.4 s and crumbles at 3.0 s under the feet, then re-forms after 4 s", () => {
      const run = createRun(1, 1);
      const k = 1;
      expect(run.course.supports[k].heat).toBe(true);
      standOn(run, k);
      idleFor(run, 1);
      const t0 = run.simMs;
      idleFor(run, HEAT.orangeMs);
      expect(heatAt(run, k, run.simMs)).toBeGreaterThanOrEqual(HEAT.orangeMs - 1);
      let crumbledAt = -1;
      const none = createStepInput();
      for (let t = 0; t < 3000 && crumbledAt < 0; t++) {
         const ev = step(run, 1, none);
         if (ev.crumbled === k) crumbledAt = run.simMs;
      }
      expect(crumbledAt - t0).toBeGreaterThanOrEqual(HEAT.crumbleMs - 2);
      expect(crumbledAt - t0).toBeLessThanOrEqual(HEAT.crumbleMs + 1);
      expect(run.crumbles).toBe(1);
      expect(run.crumbleUntil[k]).toBe(crumbledAt + HEAT.reformMs);
      // the hero drops through
      idleFor(run, 30);
      expect(run.hero.grounded && run.hero.support === k).toBe(false);
   });

   it("cools back to 0 over 4 s once left, and the start, checkpoints, goal and vents never heat", () => {
      const run = createRun(1, 1);
      standOn(run, 1);
      idleFor(run, 2000);
      const hot = heatAt(run, 1, run.simMs);
      standOn(run, 0);
      run.hero.z = 1.5;
      idleFor(run, 2);
      const left = run.simMs;
      expect(heatAt(run, 1, left + 2000)).toBeCloseTo(Math.max(0, hot - (HEAT.crumbleMs / HEAT.coolMs) * 2000), 0);
      expect(heatAt(run, 1, left + HEAT.coolMs)).toBe(0);
      const c = run.course;
      for (const i of [0, ...c.checkpoints.slice(1), c.goal]) expect(c.supports[i].heat).toBe(false);
      for (const s of c.supports) if (s.vent) expect(s.heat).toBe(false);
   });

   it("a magma slug's top (level 4) heats twice as fast", () => {
      const c = courseFor(4);
      const k = c.supports.findIndex((s) => s.heatRate === 2);
      expect(k).toBeGreaterThan(0);
      const run = createRun(1, 4);
      standOn(run, k);
      let at = -1;
      const none = createStepInput();
      for (let t = 0; t < 3000 && at < 0; t++) if (step(run, 1, none).crumbled === k) at = run.simMs;
      expect(at).toBeGreaterThan(HEAT.crumbleMs / 2 - 3);
      expect(at).toBeLessThan(HEAT.crumbleMs / 2 + 3);
   });
});

describe("geyser vents", () => {
   it("fire only on the beat (the first VENT_OPEN_MS after it), launching twice a jump's height: level 1's exit ledge", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const v = c.supports.findIndex((s) => s.vent?.lift);
      expect(v).toBe(8);
      standOn(run, v);
      const none = createStepInput();
      let launchedAt = -1;
      let apex = -Infinity;
      for (let t = 0; t < 9000 && run.ended === null; t++) {
         const ev = step(run, 1, none);
         if (ev.vented && launchedAt < 0) launchedAt = run.simMs;
         if (launchedAt > 0) apex = Math.max(apex, run.hero.y);
      }
      expect(launchedAt).toBe(c.beatMs);
      expect(apex).toBeGreaterThan(c.supports[v].top + H_VENT - 0.02);
      expect(apex).toBeLessThanOrEqual(c.supports[v].top + H_VENT + 1e-9);
      // closed between beats, open through the window after one
      expect(ventOpen(run, v, c.beatMs - 1)).toBe(false);
      expect(ventOpen(run, v, c.beatMs + VENT_OPEN_MS - 1)).toBe(true);
      expect(ventOpen(run, v, c.beatMs + VENT_OPEN_MS)).toBe(false);
      expect(VENT_HALF).toBeGreaterThan(0.5);
   });

   it("Kiro's shield rides a vent off the beat", () => {
      const run = createRun(1, 1, "kiro");
      const v = run.course.supports.findIndex((s) => s.vent?.lift);
      standOn(run, v);
      const input = createStepInput();
      input.actionPressed = true;
      let vented = step(run, 1, input).vented;
      input.actionPressed = false;
      for (let t = 0; t < 20 && !vented; t++) vented = step(run, 1, input).vented;
      expect(vented).toBe(true);
      expect(run.simMs).toBeLessThan(run.course.beatMs);
   });

   it("level 3's secret vent fires on every third beat only", () => {
      const run = createRun(1, 3);
      const c = run.course;
      const v = c.supports.findIndex((s) => s.vent?.every === 3);
      expect(v).toBeGreaterThan(0);
      const open = [1, 2, 3, 4, 5, 6].map((b) => ventOpen(run, v, b * c.beatMs + 10));
      expect(open).toEqual([false, false, true, false, false, true]);
   });

   it("the proof takes every vent as open at once (the fastest any hero rides it)", () => {
      for (const id of LEVEL_IDS) expect(Number.isFinite(minFinishMs(courseFor(id)))).toBe(true);
   });
});

describe("rocks shaken loose by the beat", () => {
   it("never fall before the first beat, and only fall a few hundred ms after a beat", () => {
      for (const id of [3, 4, 5] as const) {
         const c = courseFor(id);
         expect(c.strikes.length).toBeGreaterThan(0);
         for (const st of c.strikes) {
            for (let ms = 0; ms < c.beatMs; ms++) expect(strikeLive(st, ms)).toBe(false);
            let first = -1;
            for (let ms = c.beatMs; ms < 2 * c.beatMs && first < 0; ms++) if (strikeLive(st, ms)) first = ms;
            expect(first - c.beatMs).toBeGreaterThanOrEqual(300);
            expect(first - c.beatMs).toBeLessThan(700);
         }
      }
   });
});

describe("the lava ends a run whose crystal it covers", () => {
   it("an idle hero on the start shelf is swallowed by a surge", () => {
      const run = createRun(1, 1);
      idleFor(run, 90_000);
      expect(run.ended).toBe("lose");
      expect(run.hero.support === NONE || run.hero.state === "lost").toBe(true);
   });
});
