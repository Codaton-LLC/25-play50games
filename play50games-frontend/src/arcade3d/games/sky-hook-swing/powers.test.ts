// The card's hero roles, one action press each. Any hero can finish; these only open a shortcut.
import { describe, expect, it } from "vitest";
import { DEFAULT_HERO, HEROES, MAGNET_REACH, V_DASH } from "./heroes";
import { BODY_R, V_JUMP, createRun, createStepInput, step } from "./rules";

function press() {
   const input = createStepInput();
   input.actionPressed = true;
   return input;
}

describe("hero roles", () => {
   it("lists the five powers and preselects Nami", () => {
      expect(HEROES.map((h) => h.power)).toEqual(["dash", "doubleJump", "shield", "magnet", "phase"]);
      expect(DEFAULT_HERO).toBe("nami");
      expect(V_DASH).toBe(15);
      expect(MAGNET_REACH).toBe(6);
   });

   it("Riko's dash smashes the cracked crate", () => {
      const run = createRun(1, 1, "riko");
      const h = run.hero;
      h.mode = "air";
      h.grounded = false;
      h.x = 0;
      h.y = 6;
      h.z = 30;
      expect(step(run, 16, press()).dashed).toBe(true);
      const crate = run.course.blocks.find((b) => b.kind === "crate")!;
      h.x = (crate.x0 + crate.x1) / 2;
      h.y = (crate.y0 + crate.y1) / 2 - 0.55;
      h.z = (crate.z0 + crate.z1) / 2;
      const ev = step(run, 16, createStepInput());
      expect(ev.smashed).toBeGreaterThanOrEqual(0);
      expect(run.broken[ev.smashed]).toBe(1);
   });

   it("Nami jumps again after a release", () => {
      const run = createRun(1, 1, "nami");
      const h = run.hero;
      h.mode = "air";
      h.grounded = false;
      h.airJump = true;
      h.y = 6;
      const input = createStepInput();
      input.jumpPressed = true;
      const ev = step(run, 16, input);
      expect(ev.airJumped).toBe(true);
      expect(h.vy).toBe(V_JUMP);
   });

   it("Kiro's shield walks through a spark the others cannot", () => {
      const spark = createRun(1).course.hazards[0];
      const bare = createRun(1, 1, "nami");
      bare.hero.mode = "air";
      bare.hero.x = spark.x;
      bare.hero.y = spark.y;
      bare.hero.z = spark.z;
      expect(step(bare, 16, createStepInput()).lost).toBe(true);
      const kiro = createRun(1, 1, "kiro");
      kiro.hero.mode = "air";
      kiro.hero.x = 0;
      kiro.hero.y = 6;
      kiro.hero.z = 30;
      expect(step(kiro, 16, press()).powered).toBe(true);
      kiro.hero.x = spark.x;
      kiro.hero.y = spark.y;
      kiro.hero.z = spark.z;
      expect(step(kiro, 16, createStepInput()).lost).toBe(false);
      expect(kiro.hero.mode).toBe("air");
   });

   it("Zuno pulls an orb from under the arc", () => {
      const run = createRun(1, 1, "zuno");
      run.hero.mode = "air";
      run.hero.x = 0;
      run.hero.y = 6;
      run.hero.z = 30;
      expect(step(run, 16, press()).powered).toBe(true);
      const orb = run.course.orbs.find((o) => o.kind === "magnet")!;
      run.hero.x = orb.x;
      run.hero.y = orb.y + 4;
      run.hero.z = orb.z;
      const ev = step(run, 16, createStepInput());
      expect(ev.orbCount).toBeGreaterThanOrEqual(1);
      expect(run.orbs).toBeGreaterThanOrEqual(1);
      const far = Math.hypot(0, 4.7, 0);
      expect(far).toBeGreaterThan(1.15);
      expect(far).toBeLessThan(MAGNET_REACH);
   });

   it("Vexa phases through a ghost panel", () => {
      const ghost = createRun(1).course.blocks.find((b) => b.kind === "ghost")!;
      const x = (ghost.x0 + ghost.x1) / 2;
      const y = (ghost.y0 + ghost.y1) / 2 - 0.55;
      const z = (ghost.z0 + ghost.z1) / 2;
      const stuck = createRun(1, 1, "nami");
      stuck.hero.mode = "air";
      stuck.hero.x = x;
      stuck.hero.y = y;
      stuck.hero.z = z;
      step(stuck, 16, createStepInput());
      const pushed = Math.abs(stuck.hero.x - x) > BODY_R * 0.5 || Math.abs(stuck.hero.z - z) > BODY_R * 0.5 || Math.abs(stuck.hero.y - y) > BODY_R * 0.5;
      expect(pushed).toBe(true);
      const vexa = createRun(1, 1, "vexa");
      vexa.hero.mode = "air";
      vexa.hero.x = 0;
      vexa.hero.y = 6;
      vexa.hero.z = 30;
      expect(step(vexa, 16, press()).powered).toBe(true);
      vexa.hero.x = x;
      vexa.hero.y = y;
      vexa.hero.z = z;
      step(vexa, 16, createStepInput());
      expect(vexa.hero.x).toBeCloseTo(x, 5);
      expect(vexa.hero.z).toBeCloseTo(z, 5);
   });
});
