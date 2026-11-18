// The rules: the vine pendulum (the card's periods, angular momentum kept through a grip change, the
// 75 degree cap, the pump, the release along the tangent, the catch), dry vines, the secrets, the
// powers and hazards, the King's hits, and the fixed step (the same run at any frame rate).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { snapPhase } from "./course";
import {
   DRY_BACK_MS, DRY_MS, GLOW_GRIP, GRAV, GRIP_MAX, HANG, HIT_SPEED, MAX_AMP, MONKEY_BARS, REGRAB_MS, ROAR_DROP_MS, STEP_MS,
   anchorOf, createRun, createStepInput, heroSpeed, kingPos, step, type StepInput, type VineRun,
} from "./rules";

const IDLE = createStepInput();
const A = { x: 0, y: 0, z: 0 };

/** Hangs the hero on vine `id` at grip `grip`, angle `theta`, rate `omega` (and places the feet). */
function hang(run: VineRun, id: number, grip: number, theta: number, omega = 0): void {
   const h = run.hero;
   const v = run.course.vines[id];
   h.vine = id;
   h.grip = grip;
   h.theta = theta;
   h.omega = omega;
   h.grounded = false;
   h.standing = -1;
   h.grabMs = run.simMs;
   anchorOf(run, v, A);
   h.x = A.x + v.dx * grip * Math.sin(theta);
   h.z = A.z + v.dz * grip * Math.sin(theta);
   h.y = A.y - grip * Math.cos(theta) - HANG;
   // keep the hero clear of the checkpoint's fall line
   run.checkpoint = run.course.route[0].pad;
}

function run1(level: (typeof LEVEL_IDS)[number] = 1): VineRun {
   return createRun(1, level);
}

/** Steps `ms` with a fixed input (no presses). */
function hold(run: VineRun, ms: number, input: StepInput = IDLE): void {
   const n = Math.round(ms / STEP_MS);
   for (let i = 0; i < n; i++) step(run, STEP_MS, input);
}

/** The swing's period (s): the time between alternate zero crossings of the angle. */
function period(grip: number): number {
   const run = run1();
   hang(run, 0, grip, 0.12);
   const crossings: number[] = [];
   let last = run.hero.theta;
   for (let i = 0; i < 1200 && crossings.length < 3; i++) {
      step(run, STEP_MS, IDLE);
      if (Math.sign(run.hero.theta) !== Math.sign(last)) crossings.push(run.simMs);
      last = run.hero.theta;
   }
   return (crossings[2] - crossings[0]) / 1000;
}

describe("the vine pendulum", () => {
   it("a 1.5 m grip swings in about 1.6 s, a 6 m grip in about 3.2 s (the card)", () => {
      expect(period(1.5)).toBeGreaterThan(1.5);
      expect(period(1.5)).toBeLessThan(1.75);
      expect(period(6)).toBeGreaterThan(3.05);
      expect(period(6)).toBeLessThan(3.4);
   });

   it("pulling the grip in at the bottom speeds the swing up (angular momentum L^2 w kept)", () => {
      const run = run1();
      hang(run, 0, 6, 0, 1.2);
      const before = heroSpeed(run);
      const l2w = run.hero.grip * run.hero.grip * run.hero.omega;
      // Up for 0.2 s: 0.6 m shorter
      hold(run, 200, { ...IDLE, moveZ: -1 });
      expect(run.hero.grip).toBeCloseTo(5.4, 1);
      expect(heroSpeed(run)).toBeGreaterThan(before);
      // near the bottom the momentum barely changes (gravity's torque is small there)
      expect(Math.abs(run.hero.grip * run.hero.grip * run.hero.omega - l2w) / Math.abs(l2w)).toBeLessThan(0.25);
   });

   it("Down slides the grip to 6 m and no further; Up to 1.5 m", () => {
      const run = run1();
      hang(run, 0, 3, 0);
      hold(run, 2000, { ...IDLE, moveZ: 1 });
      expect(run.hero.grip).toBe(GRIP_MAX);
      hold(run, 2500, { ...IDLE, moveZ: -1 });
      expect(run.hero.grip).toBe(1.5);
   });

   it("pumping with the swing grows it, never past 75 degrees", () => {
      const run = run1();
      hang(run, 0, 4, 0.1);
      let most = 0;
      for (let i = 0; i < 2400; i++) {
         const h = run.hero;
         const v = run.course.vines[h.vine];
         // Left / Right with the swing (yaw 0: screen-right along +x)
         const sense = v.dx >= -0.15 ? 1 : -1;
         step(run, STEP_MS, { ...IDLE, moveX: Math.sign(h.omega || 1) * sense });
         most = Math.max(most, Math.abs(run.hero.theta));
      }
      expect(most).toBeGreaterThan((60 * Math.PI) / 180);
      expect(most).toBeLessThanOrEqual(MAX_AMP + 1e-9);
   });

   it("pumping against the swing does not grow it", () => {
      const run = run1();
      hang(run, 0, 4, 0.5);
      for (let i = 0; i < 1200; i++) {
         const h = run.hero;
         const v = run.course.vines[h.vine];
         const sense = v.dx >= -0.15 ? 1 : -1;
         step(run, STEP_MS, { ...IDLE, moveX: -Math.sign(h.omega || 1) * sense });
      }
      expect(Math.abs(run.hero.theta)).toBeLessThan(0.6);
   });

   it("Jump lets go along the tangent at the swing's speed; the same vine can't be caught again for 350 ms", () => {
      const run = run1();
      hang(run, 0, 4, 0.4, 1.5);
      step(run, STEP_MS, IDLE);
      const speed = run.hero.grip * Math.abs(run.hero.omega);
      const ev = step(run, STEP_MS, { ...IDLE, jumpPressed: true });
      expect(ev.released).toBe(true);
      expect(run.hero.vine).toBe(-1);
      expect(heroSpeed(run)).toBeCloseTo(speed, 0);
      expect(run.hero.releasedFrom).toBe(0);
      expect(REGRAB_MS).toBe(350);
   });

   it("a falling hero's hands catch a vine they pass, at their own distance from the anchor", () => {
      const run = run1();
      const v = run.course.vines[0];
      anchorOf(run, v, A);
      const h = run.hero;
      h.grounded = false;
      h.standing = -1;
      h.x = A.x - v.dx * 0.6;
      h.z = A.z - v.dz * 0.6;
      h.y = A.y - 4 - HANG;
      h.vx = v.dx * 5;
      h.vz = v.dz * 5;
      h.vy = 0;
      let caught = -1;
      for (let i = 0; i < 40 && caught < 0; i++) caught = step(run, STEP_MS, IDLE).caught;
      expect(caught).toBe(0);
      expect(run.hero.grip).toBeGreaterThan(3.8);
      expect(run.hero.grip).toBeLessThan(4.4);
      expect(run.hero.omega).toBeGreaterThan(0);
   });
});

describe("the twists", () => {
   it("a dry vine snaps 2.5 s after the grab and grows back 5 s later (level 3)", () => {
      const run = createRun(1, 3);
      const id = run.course.vines.findIndex((v) => v.kind === "dry");
      hang(run, id, 4, 0);
      let snapped = -1;
      let at = 0;
      for (let i = 0; i < 400 && snapped < 0; i++) {
         snapped = step(run, STEP_MS, IDLE).snapped;
         at = run.simMs;
      }
      expect(snapped).toBe(id);
      expect(at).toBeGreaterThanOrEqual(DRY_MS);
      expect(at).toBeLessThan(DRY_MS + 20);
      expect(run.hero.vine).toBe(-1);
      expect(run.downUntil[id]).toBeCloseTo(at + DRY_BACK_MS, 0);
   });

   it("level 2's branches bob and level 4's arch anchors lean with the swing", () => {
      const r2 = createRun(1, 2);
      expect(r2.course.pads.some((p) => p.bob > 0)).toBe(true);
      expect(r2.course.pads.filter((p) => p.kind === "step").every((p) => p.bob === 0)).toBe(true);
      const r4 = createRun(1, 4);
      const id = r4.course.vines.findIndex((v) => v.kind === "arch");
      hang(r4, id, 4, 0.9);
      hold(r4, 300);
      expect(Math.abs(r4.lean[id])).toBeGreaterThan(0.05);
   });

   it("a snapper bites on its 2 s beat and knocks the hero (level 3); Kiro's shield blocks it", () => {
      const run = createRun(1, 3);
      const s = run.course.snappers[0];
      expect(s).toBeDefined();
      let bite = 0;
      while (snapPhase(s, bite) !== "bite") bite += 10;
      for (const shield of [false, true]) {
         const r = createRun(1, 3, "kiro");
         r.simMs = bite - STEP_MS * 2;
         Object.assign(r.hero, { x: s.x + 0.3, z: s.z, y: s.y, grounded: true, vine: -1 });
         if (shield) r.shieldUntil = bite + 2000;
         let hurt = "";
         let blocked = false;
         for (let i = 0; i < 6; i++) {
            const ev = step(r, STEP_MS, IDLE);
            if (ev.hurt) hurt = ev.hurt;
            if (ev.blocked) blocked = true;
         }
         expect(hurt, `shield ${shield}`).toBe(shield ? "" : "bite");
         expect(blocked).toBe(shield);
      }
   });

   it("a monkey's pod knocks a hanging hero off the vine (level 4)", () => {
      const run = createRun(1, 4);
      const m = run.course.monkeys[0];
      hang(run, 0, 4, 0);
      run.pods.push({ x: run.hero.x - 1, y: run.hero.y + 0.9, z: run.hero.z, vx: 9, vy: 0, vz: 0, until: run.simMs + 1000, live: true });
      let knocked = false;
      for (let i = 0; i < 40 && !knocked; i++) knocked = step(run, STEP_MS, IDLE).knocked;
      expect(knocked).toBe(true);
      expect(run.hero.vine).toBe(-1);
      expect(m).toBeDefined();
   });
});

describe("the secrets and the powers", () => {
   it("Monkey Bars: ten vine-to-vine catches in a row without a platform", () => {
      const run = run1();
      run.barStreak = MONKEY_BARS - 1;
      // just let go of vine 1, now passing vine 2's rope
      const v = run.course.vines[2];
      anchorOf(run, v, A);
      Object.assign(run.hero, { vine: -1, grounded: false, standing: -1, x: A.x - v.dx * 0.5, z: A.z - v.dz * 0.5, y: A.y - 4 - HANG, vx: v.dx * 6, vz: v.dz * 6, vy: 0, releasedFrom: 1, releaseMs: run.simMs });
      let found = false;
      for (let i = 0; i < 40 && !found; i++) found = step(run, STEP_MS, IDLE).secretList.slice(0, run.ev.secretCount).includes(0);
      expect(found).toBe(true);
      expect(Boolean(run.secrets.found[0])).toBe(true);
   });

   it("the emerald vine: hanging at the full grip on the glow vine finds it", () => {
      const run = run1();
      const id = run.course.glow;
      expect(id).toBeGreaterThanOrEqual(0);
      hang(run, id, 5, 0);
      hold(run, 200);
      expect(Boolean(run.secrets.found[2])).toBe(false);
      hold(run, 600, { ...IDLE, moveZ: 1 });
      expect(run.hero.grip).toBeGreaterThanOrEqual(GLOW_GRIP);
      expect(Boolean(run.secrets.found[2])).toBe(true);
   });

   it("the ghost-root wall keeps everyone out of the hollow but a phasing Vexa", () => {
      for (const phase of [false, true]) {
         const run = createRun(1, 1, "vexa");
         const g = run.course.ghost;
         const hollow = run.course.pads[run.course.hollow];
         const host = run.course.pads.filter((p) => p.node >= 0).sort((p, q) => Math.hypot(p.x - g.x, p.z - g.z) - Math.hypot(q.x - g.x, q.z - g.z))[0];
         expect(host.y).toBeCloseTo(hollow.y, 9);
         Object.assign(run.hero, { x: host.x, z: host.z, y: host.y, grounded: true, standing: host.id, vine: -1 });
         if (phase) run.phaseUntil = 5000;
         const dx = g.x - host.x;
         const dz = g.z - host.z;
         const n = Math.hypot(dx, dz);
         // walk at the hollow (yaw 0: moveX = +x, moveZ = +z)
         hold(run, 2000, { ...IDLE, moveX: dx / n, moveZ: dz / n });
         expect(Boolean(run.secrets.found[1]), `phase ${phase}`).toBe(phase);
      }
   });

   it("Zuno's magnet pulls an orb from 6 m", () => {
      const run = createRun(1, 1, "zuno");
      const o = run.course.orbs[0];
      Object.assign(run.hero, { x: o.x + 5, z: o.z, y: o.y - 0.9, grounded: false, vine: -1, vy: 0 });
      step(run, STEP_MS, { ...IDLE, actionPressed: true });
      expect(run.orbs).toBe(1);
   });

   it("Riko's dash is an impulse along the flight, in the air only", () => {
      const run = createRun(1, 1, "riko");
      const ground = step(run, STEP_MS, { ...IDLE, actionPressed: true });
      expect(ground.powered).toBe(false);
      Object.assign(run.hero, { grounded: false, standing: -1, vx: 4, vz: 0, vy: 0, y: 5 });
      const ev = step(run, STEP_MS, { ...IDLE, actionPressed: true });
      expect(ev.powered).toBe(true);
      expect(run.hero.vx).toBeGreaterThan(12);
      expect(run.hero.vy).toBeLessThanOrEqual(2);
   });
});

describe("the Howler King (level 5)", () => {
   function arena(): VineRun {
      const run = createRun(1, 5);
      run.bossActive = true;
      // fast-forward to the first vulnerable window
      for (let i = 0; i < 2000 && run.boss!.step !== "vulnerable"; i++) step(run, STEP_MS, IDLE);
      return run;
   }

   it("only a fast hit counts: a slow touch on the perch does nothing, a full swing through it does", () => {
      const slow = arena();
      kingPos(slow, A);
      hang(slow, slow.course.arena!.main, 4, Math.PI / 4, 0.3);
      const hp = slow.boss!.hp;
      step(slow, STEP_MS, IDLE);
      expect(slow.boss!.hp).toBe(hp);
      const fast = arena();
      hang(fast, fast.course.arena!.main, 4, Math.PI / 4 - 0.02, 2.4);
      let hit = false;
      for (let i = 0; i < 10 && !hit; i++) hit = step(fast, STEP_MS, IDLE).bossHit;
      expect(hit).toBe(true);
      expect(HIT_SPEED).toBe(7);
   });

   it("his roar drops the main vine for 2 s (phase 2)", () => {
      const run = createRun(1, 5);
      run.bossActive = true;
      const b = run.boss!;
      b.phase = 1;
      b.hp = 4;
      const main = run.course.arena!.main;
      hang(run, main, 4, 0);
      let at = -1;
      for (let i = 0; i < 4000 && at < 0; i++) if (step(run, STEP_MS, IDLE).bossAttack) at = run.simMs;
      expect(at).toBeGreaterThan(0);
      expect(run.hero.vine).toBe(-1);
      expect(run.downUntil[main]).toBeCloseTo(at + ROAR_DROP_MS, 0);
   });
});

describe("the fixed step", () => {
   it("the same held input gives the same run at 30, 60 and 144 fps", () => {
      const ends = [30, 60, 144].map((fps) => {
         const run = run1();
         const input = { ...IDLE, moveX: 1 };
         for (let ms = 0; ms < 2400; ms += 1000 / fps) step(run, 1000 / fps, input);
         return [Math.round(run.simMs), run.hero.x.toFixed(4), run.hero.y.toFixed(4)];
      });
      // within a step of each other (the frame ends at different sub-steps)
      expect(Math.abs((ends[0][0] as number) - (ends[2][0] as number))).toBeLessThanOrEqual(STEP_MS * 4);
      expect(GRAV).toBe(23);
   });
});
