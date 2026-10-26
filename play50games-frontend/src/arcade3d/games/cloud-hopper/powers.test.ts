// Hero powers: one action press (keyboard E/Enter and the touch Power button both set actionPressed),
// the plan's cooldowns, and each power's effect. No device gets a different timer.
import { describe, expect, it } from "vitest";
import { HEROES, MAGNET_REACH, POWER_MS, V_DASH, pickedHero, selectHero } from "./heroes";
import {
   H_JUMP,
   NONE,
   ORB,
   V_RUN,
   courseFor,
   createRun,
   createStepInput,
   step,
   strikeLive,
   supportX,
   supportZ,
   type RoofRun,
   type StepInput,
} from "./rules";
import type { RoofStrike } from "./rules";

function hold(run: RoofRun, ms: number, input: StepInput): void {
   let left = ms;
   while (left > 0 && run.ended === null) {
      const d = Math.min(50, left);
      step(run, d, input);
      left -= d;
   }
}

function liveMs(st: RoofStrike): number {
   for (let t = 40; t < 12_000; t++) if (strikeLive(st, t)) return t;
   return 40;
}

describe("hero powers", () => {
   it("lists the five heroes and the plan's cooldowns; Riko is the default run", () => {
      expect(HEROES.map((h) => h.power)).toEqual(["dash", "doubleJump", "shield", "magnet", "phase"]);
      expect(HEROES.map((h) => h.cooldownMs)).toEqual([15_000, 10_000, 20_000, 20_000, 20_000]);
      expect(HEROES.map((h) => h.color)).toEqual(["#EF4444", "#2563EB", "#22C55E", "#FACC15", "#8B5CF6"]);
      expect(createRun(1).heroId).toBe("riko");
      expect(createRun(4, 3, "vexa").heroId).toBe("vexa");
      expect(POWER_MS.dash).toBe(280);
      expect(V_DASH).toBeGreaterThan(V_RUN);
   });

   it("the picker is a run option: selectHero changes the next run, not localStorage", () => {
      selectHero("nami");
      expect(pickedHero()).toBe("nami");
      selectHero("riko");
      expect(pickedHero()).toBe("riko");
   });

   it("Dash (Riko) outruns a normal step, then the 15 s cooldown blocks a second dash", () => {
      const dash = createRun(1, 1, "riko");
      const input = createStepInput();
      input.moveZ = -1;
      input.actionPressed = true;
      step(dash, 1, input);
      expect(dash.events.powered).toBe(true);
      expect(dash.powerReadyAt).toBe(dash.simMs + 15_000);
      input.actionPressed = false;
      hold(dash, POWER_MS.dash, input);
      const plain = createRun(1, 1, "riko");
      const walk = createStepInput();
      walk.moveZ = -1;
      hold(plain, POWER_MS.dash + 1, walk);
      const travelled = (run: RoofRun) => Math.hypot(run.hero.x, run.hero.z - 1.5);
      expect(travelled(dash)).toBeGreaterThan(travelled(plain) + 0.5);
      const until = dash.hero.dashUntil;
      input.actionPressed = true;
      step(dash, 1, input);
      expect(dash.events.powered).toBe(false);
      expect(dash.hero.dashUntil).toBe(until);
   });

   it("a jump press does not fire the power, and touch and keyboard are the same action press", () => {
      const jumper = createRun(1, 1, "riko");
      const j = createStepInput();
      j.jumpPressed = true;
      step(jumper, 1, j);
      expect(jumper.events.jumped).toBe(true);
      expect(jumper.events.powered).toBe(false);
      expect(jumper.hero.dashUntil).toBe(NONE);
      const touch = createRun(2, 1, "riko");
      const key = createRun(2, 1, "riko");
      const a = createStepInput();
      const b = createStepInput();
      a.moveZ = b.moveZ = -1;
      a.actionPressed = b.actionPressed = true;
      step(touch, 16, a);
      step(key, 16, b);
      a.actionPressed = b.actionPressed = false;
      for (let i = 0; i < 12; i++) {
         step(touch, 16, a);
         step(key, 16, b);
      }
      expect(touch.hero).toEqual(key.hero);
      expect(touch.powerReadyAt).toBe(key.powerReadyAt);
   });

   it("Double Jump (Nami) lifts a falling hero and stays under the single-jump apex", () => {
      const run = createRun(1, 1, "nami");
      const input = createStepInput();
      // off the start ledge's open end (the course runs the other way): a fall to double-jump out of
      input.moveX = -1;
      hold(run, 900, input);
      expect(run.hero.grounded).toBe(false);
      const before = run.hero.y;
      const cap = run.hero.apexCap;
      input.moveX = 0;
      input.actionPressed = true;
      step(run, 1, input);
      expect(run.events.powered).toBe(true);
      expect(run.powerReadyAt).toBe(run.simMs + 10_000);
      input.actionPressed = false;
      let peak = run.hero.y;
      for (let i = 0; i < 40 && run.ended === null; i++) {
         step(run, 20, input);
         peak = Math.max(peak, run.hero.y);
      }
      expect(peak).toBeGreaterThan(before + 0.4);
      expect(peak).toBeLessThanOrEqual(cap + 0.02);
      expect(cap).toBeCloseTo(H_JUMP, 5);
      // still in the air, the extra jump is spent
      input.actionPressed = true;
      step(run, 1, input);
      expect(run.events.powered).toBe(false);
   });

   it("Nami's power on the ground does not start the cooldown", () => {
      const run = createRun(1, 1, "nami");
      const input = createStepInput();
      input.actionPressed = true;
      step(run, 1, input);
      expect(run.events.powered).toBe(false);
      expect(run.powerReadyAt).toBe(0);
      expect(run.hero.grounded).toBe(true);
   });

   it("Shield (Kiro) and Phase (Vexa) ignore a rim strike; the open centre does not strike", () => {
      const course = courseFor(4);
      const st = course.strikes[0];
      const t = liveMs(st);
      const s = course.supports[st.support];
      const place = (run: RoofRun, ox: number, oz: number) => {
         run.simMs = t - 1;
         run.remainder = 0;
         run.hero.state = "play";
         run.hero.grounded = true;
         run.hero.support = st.support;
         run.hero.y = s.top;
         run.hero.lastTop = s.top;
         run.hero.vx = 0;
         run.hero.vz = 0;
         run.hero.x = supportX(s, t) + ox;
         run.hero.z = supportZ(s, t) + oz;
      };
      const bare = createRun(1, 4, "riko");
      place(bare, st.ox, st.oz);
      step(bare, 1, createStepInput());
      expect(bare.events.lost).toBe(true);

      const shielded = createRun(1, 4, "kiro");
      shielded.hero.shieldUntil = t + 500;
      place(shielded, st.ox, st.oz);
      step(shielded, 1, createStepInput());
      expect(shielded.events.lost).toBe(false);

      const phased = createRun(1, 4, "vexa");
      phased.hero.phaseUntil = t + 500;
      place(phased, st.ox, st.oz);
      step(phased, 1, createStepInput());
      expect(phased.events.lost).toBe(false);

      const centre = createRun(1, 4, "riko");
      place(centre, 0, 0);
      step(centre, 1, createStepInput());
      expect(centre.events.lost).toBe(false);

      const cast = createRun(1, 4, "kiro");
      const input = createStepInput();
      input.actionPressed = true;
      step(cast, 1, input);
      expect(cast.events.powered).toBe(true);
      expect(cast.hero.shieldUntil).toBe(cast.simMs + POWER_MS.shield);
      expect(cast.powerReadyAt).toBe(cast.simMs + 20_000);
   });

   it("Magnet (Zuno) picks up an orb the normal radius misses", () => {
      const far = createRun(1, 1, "zuno");
      const orb = far.course.orbs[0];
      far.hero.x = orb.x + 2;
      far.hero.y = orb.y - ORB.centerY;
      far.hero.z = orb.z;
      far.hero.grounded = false;
      far.hero.support = NONE;
      far.hero.arcStart = 0;
      far.hero.arcY0 = far.hero.y;
      far.hero.arcV = 0;
      far.hero.magnetUntil = 5_000;
      step(far, 1, createStepInput());
      expect(far.orbs).toBe(1);
      expect(MAGNET_REACH).toBeGreaterThan(ORB.pickup);

      const near = createRun(1, 1, "riko");
      near.hero.x = orb.x + 2;
      near.hero.y = orb.y - ORB.centerY;
      near.hero.z = orb.z;
      near.hero.grounded = false;
      near.hero.support = NONE;
      near.hero.arcStart = 0;
      near.hero.arcY0 = near.hero.y;
      near.hero.arcV = 0;
      step(near, 1, createStepInput());
      expect(near.orbs).toBe(0);

      const cast = createRun(1, 1, "zuno");
      const input = createStepInput();
      input.actionPressed = true;
      step(cast, 1, input);
      expect(cast.events.powered).toBe(true);
      expect(cast.hero.magnetUntil).toBe(cast.simMs + POWER_MS.magnet);
      expect(cast.powerReadyAt).toBe(cast.simMs + 20_000);
   });
});
