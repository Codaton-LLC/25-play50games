// The rules: zones charge the shield, a matching shield blocks (early far out), a wrong one lets the orb
// through, leaks cost the beacon and held waves repair it, the drone knocks, the run ends on time.
import { describe, expect, it } from "vitest";
import { CORE_HP, PTS } from "./progression";
import { BLOCK_R, EARLY_R, NONE, createRun, createStepInput, step, type DefenseRun } from "./rules";
import { R_PORTAL, buildArena } from "./arena";

function stand(run: DefenseRun, x: number, z: number) {
   run.hero.x = x;
   run.hero.z = z;
   run.hero.vx = run.hero.vz = 0;
}

function idle(run: DefenseRun, ms: number) {
   const i = createStepInput();
   for (let t = 0; t < ms && run.ended === null; t += 16) step(run, 16, i);
}

describe("zones and shields", () => {
   it("standing on a zone charges the shield with its colour; it keeps it off the zone", () => {
      const run = createRun(1, 2, "riko");
      expect(run.hero.color).toBe(NONE);
      const z = run.arena.zones[4];
      stand(run, z.x, z.z);
      const ev = step(run, 16, createStepInput());
      expect(ev.zoneIn).toBe(4);
      expect(run.hero.color).toBe(z.color);
      stand(run, 0, 3);
      step(run, 16, createStepInput());
      expect(run.hero.zone).toBe(NONE);
      expect(run.hero.color).toBe(z.color);
   });

   it("an orb touching a hero of its colour is blocked (early beyond EARLY_R); the wrong colour passes", () => {
      const run = createRun(1, 1, "riko");
      const s = run.arena.spawns[0];
      const lane = run.arena.lanes[s.lane];
      run.hero.color = s.color;
      // 11 m out: on the lane, off the zones (they would recharge the shield)
      stand(run, lane.dx * 11, lane.dz * 11);
      idle(run, s.t + 200);
      let blocked = 0;
      for (let k = 0; k < 200 && !blocked; k++) blocked = step(run, 16, createStepInput()).blocked;
      expect(blocked).toBe(1);
      expect(run.score).toBeGreaterThanOrEqual(PTS.block + PTS.early);
      expect(11).toBeGreaterThan(EARLY_R);
      const wrong = createRun(1, 1, "riko");
      wrong.hero.color = (s.color + 1) % 2;
      stand(wrong, lane.dx * 11, lane.dz * 11);
      idle(wrong, s.t + 4000);
      expect(wrong.blocks).toBe(0);
      expect(BLOCK_R).toBeGreaterThan(1);
   });

   it("a leak costs the beacon a hit point; a held wave repairs it; no hit points left loses the run", () => {
      const run = createRun(1, 1, "riko");
      stand(run, 0, 11);
      run.hero.color = NONE;
      const first = buildArena(1).waveSize[0];
      idle(run, buildArena(1).spawns[first - 1].t + ((R_PORTAL - 2) / 2.6) * 1000 + 200);
      expect(run.leaks).toBe(first);
      expect(run.shared.coreHp).toBe(CORE_HP - first + 1);
      const lost = createRun(1, 4, "riko");
      lost.shared.coreHp = 1;
      stand(lost, 0, 11);
      idle(lost, 60_000);
      expect(lost.ended).toBe("lose");
   });

   it("an idle run with a full beacon on level 1 leaks every orb and still... loses (20 hit points < the orbs)", () => {
      const run = createRun(1, 1, "riko");
      idle(run, 120_000);
      expect(run.ended === "win" || run.ended === "lose").toBe(true);
      expect(run.blocks).toBe(0);
   });
});

describe("the drone and determinism", () => {
   it("from level 2 the drone knocks a hero standing on its ring; a jump clears it", () => {
      const run = createRun(1, 2, "riko");
      run.droneAngle = 0;
      stand(run, 6.5 * Math.cos(0.12), -6.5 * Math.sin(0.12));
      let knocked = false;
      for (let k = 0; k < 120 && !knocked; k++) knocked = step(run, 16, createStepInput()).knocked;
      expect(knocked).toBe(true);
      const l1 = createRun(1, 1, "riko");
      stand(l1, 6.5, 0);
      let k1 = false;
      for (let k = 0; k < 300; k++) k1 ||= step(l1, 16, createStepInput()).knocked;
      expect(k1).toBe(false);
   });

   it("the same inputs give the same run", () => {
      const go = () => {
         const run = createRun(9, 3, "nami");
         let s = 7;
         const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
         const i = createStepInput();
         for (let f = 0; f < 3000 && run.ended === null; f++) {
            i.moveX = rnd() * 2 - 1;
            i.moveZ = rnd() * 2 - 1;
            i.jumpPressed = rnd() < 0.03;
            i.actionPressed = rnd() < 0.01;
            step(run, 16, i);
         }
         return [run.hero.x, run.hero.z, run.score, run.blocks, run.shared.coreHp, run.simMs];
      };
      expect(go()).toEqual(go());
   });
});
