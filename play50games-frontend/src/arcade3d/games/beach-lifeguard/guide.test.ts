// guide.ts: the beacons go to the alerted swimmer, then to the dry sand; read-only.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { beachHint, hintCode, lowAlert, nextGoal, type Goal } from "./guide";
import { SAFE_SAND_Z, createRun } from "./rules";

const fresh = (): Goal => ({ kind: 0, x: 0, z: 0 });

describe("beach-lifeguard guide", () => {
   it("points at the alerted swimmer, then at the dry sand while towing, and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(11, LEVELS[id], id);
         const before = JSON.stringify(run);
         const g = nextGoal(run, fresh());
         expect(JSON.stringify(run)).toBe(before);
         const s = run.swimmers[run.activeSwimmer];
         expect(g).toMatchObject({ kind: 1, x: s.x, z: s.z });
         run.carrying = true;
         const c = nextGoal(run, fresh());
         expect(c.kind).toBe(2);
         expect(c.x).toBe(run.hero.x);
         expect(c.z).toBeGreaterThan(SAFE_SAND_Z);
         run.over = "win";
         expect(nextGoal(run, fresh()).kind).toBe(0);
         expect(hintCode(run)).toBe(0);
      }
   });

   it("says swim, tow or hurry, with the right button", () => {
      const run = createRun(3, LEVELS[4], 4);
      const swim = beachHint(run, hintCode(run), false);
      expect(swim.text).toMatch(/pink ring/);
      expect(swim.text).toMatch(/press E/);
      expect(swim.text).toMatch(/jet ski/);
      expect(beachHint(run, hintCode(run), true).text).toMatch(/tap Grab/);
      run.onJetSki = true;
      expect(beachHint(run, hintCode(run), false).text).toMatch(/^Ride/);
      run.onJetSki = false;
      run.carrying = true;
      expect(beachHint(run, hintCode(run), false).tone).toBe("carry");
      run.alertTime = run.level.alertS * 0.1;
      expect(lowAlert(run)).toBe(true);
      expect(beachHint(run, hintCode(run), false)).toMatchObject({ tone: "warn", sticky: true });
      run.carrying = false;
      expect(beachHint(run, hintCode(run), false).tone).toBe("warn");
   });

   it("gives each alerted swimmer its own hint key, so the line shows again", () => {
      const run = createRun(5, LEVELS[2], 2);
      const a = beachHint(run, hintCode(run), false).key;
      run.activeSwimmer = 1;
      expect(beachHint(run, hintCode(run), false).key).not.toBe(a);
   });
});
