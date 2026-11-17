// The rules: switching colour, true and wrong gates, split and blink gates, hazards and hearts, gaps and
// respawns, lanes (camera-relative), the finish, determinism.
import { describe, expect, it } from "vitest";
import { BOUNCE, HEARTS, NONE, createRun, createStepInput, laneStep, step, vCap, type SwitchRun } from "./rules";
import { LANES, START_Z, gateColor, gatesToPass, type Gate } from "./track";

function ahead(run: SwitchRun, z: number) {
   run.hero.z = z;
   run.simMs = Math.ceil(((START_Z - z) / vCap(run.level)) * 1000) + 500;
}

function runUntil(run: SwitchRun, done: (r: SwitchRun) => boolean, set?: (i: ReturnType<typeof createStepInput>, r: SwitchRun) => void, frames = 6000) {
   const input = createStepInput();
   for (let f = 0; f < frames && run.ended === null && !done(run); f++) {
      Object.assign(input, createStepInput());
      set?.(input, run);
      step(run, 1000 / 60, input);
   }
}

describe("colours and gates", () => {
   it("1-5 pick a colour directly, a tap cycles through the level's colours", () => {
      const run = createRun(1, 3, "riko");
      const i = createStepInput();
      i.colorPick = 2;
      step(run, 16, i);
      expect(run.hero.color).toBe(2);
      const c = createStepInput();
      c.cycle = true;
      step(run, 16, c);
      expect(run.hero.color).toBe(3);
      step(run, 16, c);
      expect(run.hero.color).toBe(0);
      const bad = createStepInput();
      bad.colorPick = 4;
      step(run, 16, bad);
      expect(run.hero.color).toBe(0);
   });

   it("the gate's colour passes and surges; the wrong one bounces back, stuns and costs a heart", () => {
      const run = createRun(1, 1, "riko");
      const g = run.track.gates[0];
      runUntil(run, (r) => r.hero.z < g.z + 1.5, (i) => (i.colorPick = (g.colors[1] + 1) % 2));
      runUntil(run, (r) => r.events.wrong, () => undefined, 60);
      expect(run.hearts).toBe(HEARTS - 1);
      expect(run.hero.z).toBeGreaterThanOrEqual(g.z + BOUNCE - 0.01);
      expect(run.gateIdx).toBe(0);
      runUntil(run, (r) => r.gateIdx > 0, (i) => (i.colorPick = g.colors[1]));
      expect(run.passed).toBe(1);
      expect(run.hearts).toBe(HEARTS - 1);
   });

   it("split gates read the lane; blink gates read the moment", () => {
      const split: Gate = { z: -10, kind: "split", colors: [0, 1, 2], alt: 0, periodMs: 0 };
      expect([0, 1, 2].map((l) => gateColor(split, l, 0))).toEqual([0, 1, 2]);
      const blink: Gate = { z: -10, kind: "blink", colors: [1, 1, 1], alt: 3, periodMs: 1000 };
      expect(gateColor(blink, 1, 500)).toBe(1);
      expect(gateColor(blink, 1, 1500)).toBe(3);
      expect(gateColor(blink, 0, 2100)).toBe(1);
   });

   it("three wrong gates end the run lost", () => {
      const run = createRun(1, 1, "riko");
      const g = run.track.gates[0];
      runUntil(run, () => false, (i) => (i.colorPick = (g.colors[1] + 1) % 2), 4000);
      expect(run.ended).toBe("lose");
      expect(run.hits).toBe(HEARTS);
   });
});

describe("lanes, hazards, the finish", () => {
   it("a lane press is camera-relative", () => {
      expect(laneStep(true, 0)).toBe(1);
      expect(laneStep(true, Math.PI)).toBe(-1);
      const run = createRun(1, 1, "riko");
      const i = createStepInput();
      i.right = true;
      step(run, 16, i);
      expect(run.hero.lane).toBe(2);
      for (let k = 0; k < 20; k++) step(run, 16, createStepInput());
      expect(run.hero.x).toBeCloseTo(LANES[2], 5);
   });

   it("an energy block in the lane bounces the hero; Riko's dash smashes it; Vexa's phase passes it", () => {
      for (const [hero, power, expectHit] of [["kiro", false, true], ["riko", true, false], ["vexa", true, false]] as const) {
         const run = createRun(1, 1, hero);
         const bi = run.track.obstacles.findIndex((o) => o.kind === "block");
         const o = run.track.obstacles[bi];
         run.hero.lane = o.lane;
         run.hero.x = LANES[o.lane];
         ahead(run, o.z + 3);
         run.gateIdx = run.track.gates.findIndex((g) => g.z < o.z);
         const i = createStepInput();
         i.actionPressed = power;
         let hit = false;
         for (let k = 0; k < 30; k++) {
            hit = step(run, 16, k === 0 ? i : createStepInput()).hit || hit;
         }
         expect(hit, hero).toBe(expectHit);
         if (hero === "riko") expect(run.smashed[bi]).toBe(1);
      }
   });

   it("a gap without a jump drops the hero; it respawns at the checkpoint a heart down", () => {
      const run = createRun(1, 4, "kiro");
      const gap = run.track.obstacles.find((o) => o.kind === "gap")!;
      ahead(run, gap.z + 2);
      run.gateIdx = run.track.gates.findIndex((g) => g.z < gap.z);
      let fell = false;
      let back = false;
      for (let k = 0; k < 200 && !back; k++) {
         const ev = step(run, 16, createStepInput());
         fell ||= ev.fell;
         back ||= ev.respawned;
      }
      expect(fell && back).toBe(true);
      expect(run.hearts).toBe(HEARTS - 1);
      expect(run.hero.z).toBe(run.checkpoint);
   });

   it("every gate is required: the bot-free finish line counts only after the last gate", () => {
      expect(gatesToPass(1)).toBe(8);
      expect(gatesToPass(5)).toBe(25);
      const run = createRun(1, 1, "riko");
      runUntil(run, (r) => r.ended !== null, (i, r) => {
         const g = r.track.gates[r.gateIdx];
         i.colorPick = g ? g.colors[1] : NONE;
         // dodge blocks in the middle lane by staying out of their lane
         const o = r.track.obstacles.find((q) => q.kind === "block" && r.hero.z - q.z < 14 && r.hero.z - q.z > -1);
         if (o && r.hero.lane === o.lane) i.right = o.lane < 2;
         if (o && r.hero.lane === o.lane && o.lane === 2) i.left = true;
      }, 20000);
      expect(run.ended).toBe("win");
      expect(run.passed).toBe(8);
   });

   it("the same inputs give the same run", () => {
      const go = () => {
         const run = createRun(9, 4, "nami");
         let s = 7;
         const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
         runUntil(run, () => false, (i) => {
            i.colorPick = rnd() < 0.2 ? Math.floor(rnd() * 4) : NONE;
            i.left = rnd() < 0.05;
            i.right = rnd() < 0.05;
            i.jumpPressed = rnd() < 0.05;
            i.slidePressed = rnd() < 0.03;
            i.actionPressed = rnd() < 0.02;
         }, 2400);
         return [run.hero.x, run.hero.z, run.passed, run.hearts, run.simMs];
      };
      expect(go()).toEqual(go());
   });
});
