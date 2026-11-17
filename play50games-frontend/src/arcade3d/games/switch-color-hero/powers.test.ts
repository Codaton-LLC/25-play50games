// Each hero's power (the card) and the secrets: Nami's second jump reaches the high prism, Kiro's shield
// shrugs off a hazard and a wrong gate's heart (never the bounce), Zuno's magnet pulls pickups from 6 m,
// Vexa's phase takes her to the ghost lane shard; the colour streak sticker after 8 true gates.
import { describe, expect, it } from "vitest";
import { MAGNET_REACH } from "./heroes";
import { HEARTS, createRun, createStepInput, step, vCap, type SwitchRun } from "./rules";
import { LANES, START_Z } from "./track";

function place(run: SwitchRun, z: number, lane = 1) {
   run.hero.z = z;
   run.hero.lane = lane;
   run.hero.x = LANES[lane];
   run.gateIdx = run.track.gates.findIndex((g) => g.z < z);
   // the pace bound: a hero this far down the track has been running at least this long
   run.simMs = Math.ceil(((START_Z - z) / vCap(run.level)) * 1000) + 500;
}

describe("powers", () => {
   it("Nami double jumps (higher than anyone else) and reaches the high prism over a gap", () => {
      const peak = (hero: "nami" | "riko") => {
         const run = createRun(1, 4, hero);
         const t = run.track;
         place(run, t.high.z + 5.5, 1);
         const j = createStepInput();
         j.jumpPressed = true;
         step(run, 16, j);
         let top = 0;
         for (let k = 0; k < 60; k++) {
            step(run, 16, k === 12 ? j : createStepInput());
            top = Math.max(top, run.hero.y);
         }
         return { top, found: run.secrets.found[0] };
      };
      const nami = peak("nami");
      const riko = peak("riko");
      expect(nami.top).toBeGreaterThan(riko.top + 0.8);
      expect(nami.found).toBe(1);
      expect(riko.found).toBe(0);
   });

   it("Kiro: the shield passes a hazard and keeps the heart on a wrong gate (he still bounces)", () => {
      const run = createRun(1, 1, "kiro");
      const g = run.track.gates[0];
      place(run, g.z + 3);
      run.gateIdx = 0;
      const p = createStepInput();
      p.actionPressed = true;
      p.colorPick = (g.colors[1] + 1) % 2;
      let wrong = false;
      for (let k = 0; k < 30 && !wrong; k++) wrong = step(run, 16, k === 0 ? p : createStepInput()).wrong;
      expect(wrong).toBe(true);
      expect(run.hearts).toBe(HEARTS);
      expect(run.hero.z).toBeGreaterThan(g.z);
   });

   it("Zuno: the magnet pulls a pickup from MAGNET_REACH, a plain hero only takes it in reach", () => {
      for (const [hero, want] of [["zuno", 1], ["riko", 0]] as const) {
         const run = createRun(1, 2, hero);
         const p = run.track.pickups[0];
         place(run, p.z + 1, p.x === LANES[0] ? 2 : 0);
         const m = createStepInput();
         m.actionPressed = true;
         step(run, 16, m);
         expect(Math.abs(run.hero.x - p.x)).toBeLessThan(MAGNET_REACH);
         expect(run.collected[0], hero).toBe(want);
      }
   });

   it("Vexa phases through the ghost lane block to its shard; others bounce off", () => {
      for (const [hero, want] of [["vexa", 1], ["kiro", 0]] as const) {
         const run = createRun(1, 2, hero);
         const o = run.track.obstacles[run.track.ghostBlock];
         place(run, o.z + 2.5, o.lane);
         const p = createStepInput();
         p.actionPressed = hero === "vexa";
         for (let k = 0; k < 30; k++) step(run, 16, k === 0 ? p : createStepInput());
         expect(run.secrets.found[2], hero).toBe(want);
      }
   });

   it("the colour streak: 8 true gates in a row", () => {
      const run = createRun(1, 2, "riko");
      const input = createStepInput();
      for (let f = 0; f < 6000 && run.passed < 8 && run.ended === null; f++) {
         Object.assign(input, createStepInput());
         const g = run.track.gates[run.gateIdx];
         if (g) input.colorPick = g.colors[run.hero.lane];
         const o = run.track.obstacles.find((q) => (q.kind === "block" || q.kind === "wall") && run.hero.z - q.z < 14 && run.hero.z - q.z > -1 && q.lane === run.hero.lane);
         if (o) {
            if (o.lane < 2) input.right = true;
            else input.left = true;
         }
         step(run, 1000 / 60, input);
      }
      expect(run.passed).toBeGreaterThanOrEqual(8);
      expect(run.secrets.found[1]).toBe(1);
   });
});
