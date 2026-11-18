import { describe, expect, it } from "vitest";
import { createBossEvents, stepBoss } from "@/arcade3d/menu2/boss/boss";
import { GLOOM_NIMBUS } from "./progression";
import { bossVulnerable, createRun, type CloudRun } from "./rules";

/** Steps the boss machine alone (no hero) until `until` holds; fails after 60 s. */
function stepUntil(run: CloudRun, until: (r: CloudRun) => boolean): void {
   const ev = createBossEvents();
   for (let ms = 0; ms < 60_000; ms++) {
      if (until(run)) return;
      stepBoss(run.boss!, GLOOM_NIMBUS, 1, ev);
   }
   throw new Error("boss never reached the step");
}

describe("Gloom Nimbus eye glints (bossVulnerable)", () => {
   it("level 1-4 runs have no boss: never gold", () => {
      expect(bossVulnerable(createRun(1, 1))).toBe(false);
   });

   it("stay violet through the whole chase cycle when the hero has no charge", () => {
      const run = createRun(1, 5);
      run.charges = 0;
      const ev = createBossEvents();
      const seen = new Set<string>();
      for (let ms = 0; ms < 20_000 && run.boss!.phase === 0; ms++) {
         stepBoss(run.boss!, GLOOM_NIMBUS, 1, ev);
         seen.add(run.boss!.step);
         expect(bossVulnerable(run)).toBe(false);
      }
      // the chase did open its window (the old step check turned the eyes gold here)
      expect(seen.has("vulnerable")).toBe(true);
   });

   it("turn gold in a chase window only with a lightning-rod charge to spend", () => {
      const run = createRun(1, 5);
      stepUntil(run, (r) => r.boss!.step === "telegraph");
      run.charges = 1;
      expect(bossVulnerable(run)).toBe(false);
      stepUntil(run, (r) => r.boss!.step === "vulnerable");
      expect(bossVulnerable(run)).toBe(true);
      run.charges = 0;
      expect(bossVulnerable(run)).toBe(false);
   });

   it("later phases: gold in the vulnerable window while the eye ring is open", () => {
      const run = createRun(1, 5);
      run.boss!.phase = 1;
      stepUntil(run, (r) => r.boss!.step === "vulnerable");
      run.eye.live = true;
      expect(bossVulnerable(run)).toBe(true);
      run.eye.live = false;
      expect(bossVulnerable(run)).toBe(false);
      run.eye.live = true;
      stepUntil(run, (r) => r.boss!.step !== "vulnerable");
      expect(bossVulnerable(run)).toBe(false);
   });
});
