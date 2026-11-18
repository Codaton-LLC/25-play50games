// Each hero's power (the card) and the secrets: Riko's dash outruns everyone, Nami's double jump reaches
// the pillar beacon, Kiro's shield keeps the beacon whole, Zuno's magnet blocks from farther, Vexa phases
// through the drone; the rainbow chain and the perfect wave.
import { describe, expect, it } from "vitest";
import { BLOCK_R, MAGNET_BLOCK_R, NONE, createRun, createStepInput, step, type DefenseRun } from "./rules";
import { buildArena } from "./arena";
import { CORE_HP } from "./progression";

function at(run: DefenseRun, x: number, z: number) {
   run.hero.x = x;
   run.hero.z = z;
   run.hero.vx = run.hero.vz = 0;
}

function power(run: DefenseRun) {
   const i = createStepInput();
   i.actionPressed = true;
   return step(run, 16, i);
}

describe("powers", () => {
   it("Riko's dash covers more ground in 0.3 s than a run", () => {
      const go = (hero: "riko" | "kiro") => {
         const run = createRun(1, 1, hero);
         at(run, 0, 6);
         const i = createStepInput();
         i.moveZ = -1;
         i.actionPressed = true;
         step(run, 16, i);
         i.actionPressed = false;
         for (let k = 0; k < 18; k++) step(run, 16, i);
         return 6 - run.hero.z;
      };
      expect(go("riko")).toBeGreaterThan(go("kiro") + 1);
   });

   it("Nami's double jump reaches the pillar beacon; a single jump does not", () => {
      for (const [hero, want] of [["nami", 1], ["riko", 0]] as const) {
         const run = createRun(1, 1, hero);
         const b = run.arena.beacon;
         at(run, b.x, b.z);
         const j = createStepInput();
         j.jumpPressed = true;
         step(run, 16, j);
         for (let k = 0; k < 60; k++) step(run, 16, k === 14 ? j : createStepInput());
         expect(run.secrets.found[2], hero).toBe(want);
      }
   });

   it("Kiro's shield keeps the beacon whole while it is up", () => {
      const run = createRun(1, 1, "kiro");
      at(run, 0, 11);
      const s = buildArena(1).spawns[0];
      const travel = ((13.5 - 2.2) / 2.6) * 1000;
      for (let t = 0; t < s.t + travel - 1000; t += 16) step(run, 16, createStepInput());
      expect(power(run).powered).toBe(true);
      let leaked = 0;
      let shielded = false;
      for (let k = 0; k < 120; k++) {
         const ev = step(run, 16, createStepInput());
         leaked += ev.leaked;
         shielded ||= ev.shielded;
      }
      expect(leaked).toBeGreaterThan(0);
      expect(shielded).toBe(true);
      expect(run.shared.coreHp).toBe(CORE_HP);
   });

   it("Zuno's magnet blocks a matching orb from MAGNET_BLOCK_R; others need BLOCK_R", () => {
      expect(MAGNET_BLOCK_R).toBeGreaterThan(BLOCK_R + 1.5);
      for (const [hero, want] of [["zuno", 1], ["riko", 0]] as const) {
         const run = createRun(1, 1, hero);
         const s = run.arena.spawns[0];
         const lane = run.arena.lanes[s.lane];
         run.hero.color = s.color;
         // 2.2 m off the lane, beside the path
         at(run, lane.dx * 7 - lane.dz * 2.2, lane.dz * 7 + lane.dx * 2.2);
         for (let t = 0; t < s.t + 500; t += 16) step(run, 16, createStepInput());
         if (hero === "zuno") power(run);
         let blocked = 0;
         for (let k = 0; k < 200; k++) blocked += step(run, 16, createStepInput()).blocked;
         expect(blocked, hero).toBe(want);
      }
   });

   it("Vexa phases through the drone", () => {
      for (const [hero, want] of [["vexa", false], ["kiro", true]] as const) {
         const run = createRun(1, 2, hero);
         run.droneAngle = 0;
         at(run, 6.5 * Math.cos(0.1), -6.5 * Math.sin(0.1));
         if (hero === "vexa") power(run);
         let knocked = false;
         for (let k = 0; k < 40; k++) knocked ||= step(run, 16, createStepInput()).knocked;
         expect(knocked, hero).toBe(want);
      }
   });
});

describe("secrets", () => {
   it("the rainbow chain: a block of every colour of the level in a row", () => {
      const run = createRun(1, 1, "riko");
      run.chainMask = 1;
      run.hero.color = 1;
      const a = run.arena;
      const i = a.spawns.findIndex((s) => s.color === 1);
      const s = a.spawns[i];
      const lane = a.lanes[s.lane];
      at(run, lane.dx * 11, lane.dz * 11);
      run.nextSpawn = i;
      run.simMs = s.t - 16;
      for (let k = 0; k < 200 && !run.secrets.found[1]; k++) step(run, 16, createStepInput());
      expect(run.secrets.found[1]).toBe(1);
      expect(NONE).toBe(-1);
   });
});
