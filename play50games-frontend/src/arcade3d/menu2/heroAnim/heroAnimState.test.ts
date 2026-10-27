// The hero animator's state machine, its pose blend and its body transform (pure, no mesh).
import { describe, expect, it } from "vitest";
import { bodyLift, footPoint } from "@/arcade3d/core/rig/gait";
import { createPose } from "@/arcade3d/core/rig/poses";
import { HERO_LANDMARKS, HERO_SCALE, M2_HERO_IDS } from "@/arcade3d/menu2/heroModels";
import {
   HERO_ANIM_STATES,
   HERO_FADE,
   HERO_STATE_COUNT,
   HERO_TIMING,
   HS,
   createHeroAnimState,
   createHeroMotion,
   heroStateName,
   pickHeroState,
   stepHeroAnimState,
   type HeroAnimState,
   type HeroMotion,
} from "./heroAnimState";
import { advanceHeroGait, composeHeroPose, landDepth } from "./heroAnimPose";
import { createHeroBody, stepHeroBody } from "./heroBody";
import { HERO_BALL_RADIUS, HERO_CURL, heroBallFit } from "./heroAnimLandmarks";

const DT = 1 / 60;
const run = (s: HeroAnimState, m: HeroMotion, seconds: number) => {
   for (let t = 0; t < seconds - 1e-9; t += DT) stepHeroAnimState(s, m, DT);
};
const sum = (w: Float32Array) => w.reduce((a, b) => a + b, 0);

describe("the state machine", () => {
   it("starts idle with all the weight there; 12 states, one fade speed each", () => {
      const s = createHeroAnimState();
      expect(HERO_STATE_COUNT).toBe(12);
      expect(heroStateName(s)).toBe("idle");
      expect(s.weights[HS.idle]).toBe(1);
      for (const name of HERO_ANIM_STATES) expect(HERO_FADE[name]).toBeGreaterThan(0);
   });

   it("runs when the ground speed passes 0.35 m/s and stands again when it stops; the run amount follows the speed", () => {
      const s = createHeroAnimState({ topSpeed: 6.5 });
      const m = createHeroMotion();
      m.vx = 6.5;
      run(s, m, 0.6);
      expect(heroStateName(s)).toBe("run");
      expect(s.runAmount).toBeGreaterThan(0.95);
      expect(s.weights[HS.run]).toBeGreaterThan(0.98);
      m.vx = 2;
      run(s, m, 0.6);
      expect(s.runAmount).toBeCloseTo(2 / 6.5, 2);
      m.vx = 0.2;
      run(s, m, 0.8);
      expect(heroStateName(s)).toBe("idle");
      expect(s.weights[HS.idle]).toBeGreaterThan(0.98);
   });

   it("a jump: takeoff for 0.16 s, then rise while vy > 0, fall after the apex, land on touchdown, then back to idle", () => {
      const s = createHeroAnimState();
      const m = createHeroMotion();
      m.grounded = false;
      m.vy = 14;
      m.events.jumped = true;
      stepHeroAnimState(s, m, DT);
      expect(heroStateName(s)).toBe("takeoff");
      expect(m.events.jumped).toBe(false); // the animator clears the events it read
      run(s, m, HERO_TIMING.takeoff);
      expect(heroStateName(s)).toBe("rise");
      m.vy = -3;
      stepHeroAnimState(s, m, DT);
      expect(heroStateName(s)).toBe("fall");
      m.grounded = true;
      m.vy = 0;
      m.events.landed = true;
      m.events.landSpeed = 18;
      stepHeroAnimState(s, m, DT);
      expect(heroStateName(s)).toBe("land");
      expect(s.landImpact).toBeGreaterThan(0.8);
      run(s, m, HERO_TIMING.land);
      expect(heroStateName(s)).toBe("idle");
   });

   it("the double jump flips for 0.5 s, then the flight goes on", () => {
      const s = createHeroAnimState();
      const m = createHeroMotion();
      m.grounded = false;
      m.vy = 8;
      m.events.airJumped = true;
      stepHeroAnimState(s, m, DT);
      expect(heroStateName(s)).toBe("flip");
      run(s, m, HERO_TIMING.flip - 2 * DT);
      expect(heroStateName(s)).toBe("flip");
      run(s, m, 3 * DT);
      expect(heroStateName(s)).toBe("rise");
   });

   it("priorities: defeat > hurt > cheer > ball > dash > flip > the air > land > run", () => {
      const s = createHeroAnimState();
      const m = createHeroMotion();
      m.grounded = false;
      s.sinceAirJump = 0;
      s.sinceLand = 0;
      expect(pickHeroState(s, m)).toBe(HS.flip);
      m.power = "dash";
      expect(pickHeroState(s, m)).toBe(HS.dash);
      m.rolling = true;
      expect(pickHeroState(s, m)).toBe(HS.ball);
      m.celebrating = true;
      expect(pickHeroState(s, m)).toBe(HS.cheer);
      s.sinceHurt = 0.1;
      expect(pickHeroState(s, m)).toBe(HS.hurt);
      m.defeated = true;
      expect(pickHeroState(s, m)).toBe(HS.defeat);
      // on the ground, landing beats running until the landing is over
      const g = createHeroAnimState();
      const n = createHeroMotion();
      n.vx = 3;
      g.speed = 3;
      g.sinceLand = 0.05;
      expect(pickHeroState(g, n)).toBe(HS.land);
      g.sinceLand = 1;
      expect(pickHeroState(g, n)).toBe(HS.run);
   });

   it("a hit: hurt for 0.45 s with the push direction kept (unit), then back", () => {
      const s = createHeroAnimState();
      const m = createHeroMotion();
      m.events.hurt = true;
      m.events.hurtX = 3;
      m.events.hurtZ = -4;
      stepHeroAnimState(s, m, DT);
      expect(heroStateName(s)).toBe("hurt");
      expect(s.hurtX).toBeCloseTo(0.6, 6);
      expect(s.hurtZ).toBeCloseTo(-0.8, 6);
      run(s, m, HERO_TIMING.hurt + DT);
      expect(heroStateName(s)).toBe("idle");
   });

   it("the weights always sum to 1 and cross-fade (no snap) through a whole scripted run", () => {
      const s = createHeroAnimState();
      const m = createHeroMotion();
      let last = s.weights[HS.idle];
      let maxStep = 0;
      const script: Array<[number, (m: HeroMotion) => void]> = [
         [0.5, (x) => (x.vx = 5)],
         [0.3, (x) => {
            x.grounded = false;
            x.vy = 12;
            x.events.jumped = true;
         }],
         [0.3, (x) => (x.vy = -6)],
         [0.2, (x) => (x.events.airJumped = true)],
         [0.4, (x) => (x.rolling = true)],
         [0.3, (x) => {
            x.rolling = false;
            x.power = "dash";
         }],
         [0.3, (x) => {
            x.power = null;
            x.grounded = true;
            x.vy = 0;
            x.events.landed = true;
            x.events.landSpeed = 10;
         }],
         [0.5, (x) => {
            x.events.hurt = true;
            x.events.hurtX = 1;
         }],
         [1, (x) => (x.celebrating = true)],
         [1, (x) => {
            x.celebrating = false;
            x.defeated = true;
         }],
      ];
      for (const [seconds, set] of script) {
         set(m);
         for (let t = 0; t < seconds; t += DT) {
            stepHeroAnimState(s, m, DT);
            expect(sum(s.weights)).toBeCloseTo(1, 5);
            for (const w of s.weights) expect(w).toBeGreaterThanOrEqual(0);
            maxStep = Math.max(maxStep, Math.abs(s.weights[HS.idle] - last));
            last = s.weights[HS.idle];
         }
      }
      expect(heroStateName(s)).toBe("defeat");
      // a fade, not a cut: no weight jumps from 1 to 0 in a frame
      expect(maxStep).toBeLessThan(0.5);
   });

   it("dt 0 (paused) changes nothing and keeps the events for the next frame", () => {
      const s = createHeroAnimState();
      const m = createHeroMotion();
      m.events.jumped = true;
      m.grounded = false;
      const before = Array.from(s.weights);
      stepHeroAnimState(s, m, 0);
      expect(Array.from(s.weights)).toEqual(before);
      expect(m.events.jumped).toBe(true);
   });

   it("allocates nothing per step: the same weights array, the same state object", () => {
      const s = createHeroAnimState();
      const m = createHeroMotion();
      const w = s.weights;
      m.vx = 4;
      run(s, m, 1);
      expect(s.weights).toBe(w);
   });
});

describe("the blended pose", () => {
   const L = HERO_LANDMARKS.riko;
   const FOOT = new Float64Array(4);
   it("keeps every sole on or over the floor through the scripted motion, for every hero", () => {
      for (const id of M2_HERO_IDS) {
         const l = HERO_LANDMARKS[id];
         const s = createHeroAnimState();
         const m = createHeroMotion();
         const pose = createPose();
         const extras = { surge: 0 };
         const steps: Array<(m: HeroMotion) => void> = [
            (x) => (x.vx = 6.5),
            (x) => {
               x.grounded = false;
               x.vy = 14;
               x.events.jumped = true;
            },
            (x) => (x.vy = -10),
            (x) => (x.events.airJumped = true),
            (x) => (x.rolling = true),
            (x) => {
               x.rolling = false;
               x.grounded = true;
               x.vy = 0;
               x.events.landed = true;
               x.events.landSpeed = 20;
            },
            (x) => (x.power = "dash"),
            (x) => {
               x.power = null;
               x.events.hurt = true;
            },
            (x) => (x.celebrating = true),
            (x) => {
               x.celebrating = false;
               x.defeated = true;
            },
         ];
         for (const set of steps) {
            set(m);
            for (let k = 0; k < 30; k++) {
               stepHeroAnimState(s, m, DT);
               advanceHeroGait(s, l, HERO_SCALE[id], DT);
               composeHeroPose(s, l, pose, extras);
               const lift = bodyLift(pose, l);
               const low = Math.min(footPoint(pose, l, 1, FOOT)[3], footPoint(pose, l, -1, FOOT)[3]) + lift;
               expect(low, `${id} ${heroStateName(s)}`).toBeGreaterThan(-1e-6);
               for (const v of pose.q) expect(Number.isFinite(v)).toBe(true);
               expect(Math.abs(extras.surge)).toBeLessThan(0.1);
            }
         }
      }
   });

   it("advances the stride phase by the ground speed over heroStride (only while running)", () => {
      const s = createHeroAnimState();
      const m = createHeroMotion();
      advanceHeroGait(s, L, HERO_SCALE.riko, DT);
      expect(s.phase).toBe(0);
      m.vx = 6.5;
      run(s, m, 0.5);
      const before = s.phase;
      advanceHeroGait(s, L, HERO_SCALE.riko, 0.01);
      expect(s.phase).toBeGreaterThan(before);
   });

   it("the landing crouch: in by 60 ms, out by 0.5 s, deeper on a hard landing", () => {
      expect(landDepth(0, 1)).toBe(0);
      expect(landDepth(0.06, 1)).toBeCloseTo(1, 6);
      expect(landDepth(0.06, 0)).toBeCloseTo(0.45, 6);
      expect(landDepth(0.6, 1)).toBeLessThan(0.05);
      expect(landDepth(Infinity, 1)).toBe(0);
   });
});

describe("the body transform", () => {
   const fit = heroBallFit("riko");

   it("each hero's ball: the curl's centre and the body's scale from its measured curl, the body inside the shell", () => {
      for (const id of M2_HERO_IDS) {
         const f = heroBallFit(id);
         expect(f.radius).toBe(HERO_BALL_RADIUS);
         expect(f.curlCenterY).toBeCloseTo(HERO_CURL[id].centerY * HERO_SCALE[id], 9);
         expect(f.bodyScale * HERO_CURL[id].radius * HERO_SCALE[id]).toBeCloseTo(0.92 * HERO_BALL_RADIUS, 9);
         expect(f.bodyScale).toBeGreaterThan(0.6);
         expect(f.bodyScale).toBeLessThan(1);
      }
   });

   it("turns to the travel; keeps its facing standing still", () => {
      const s = createHeroAnimState();
      const m = createHeroMotion();
      const b = createHeroBody(0);
      m.vx = 4;
      for (let k = 0; k < 60; k++) {
         stepHeroAnimState(s, m, DT);
         stepHeroBody(b, s, m, fit, 0, DT);
      }
      expect(b.yaw).toBeCloseTo(Math.PI / 2, 2);
      m.vx = 0;
      for (let k = 0; k < 30; k++) stepHeroBody(b, s, m, fit, 0, DT);
      expect(b.yaw).toBeCloseTo(Math.PI / 2, 2);
   });

   it("the ball: the shell closes, the body shrinks to its fit, the pivot rises to the ball's centre, and it rolls with the travel speed", () => {
      const s = createHeroAnimState();
      const m = createHeroMotion();
      const b = createHeroBody(0);
      m.rolling = true;
      m.vz = 5;
      for (let k = 0; k < 60; k++) {
         stepHeroAnimState(s, m, DT);
         stepHeroBody(b, s, m, fit, 0, DT);
      }
      expect(b.shell).toBeGreaterThan(0.99);
      expect(b.bodyScale).toBeCloseTo(fit.bodyScale, 2);
      expect(b.pivotY).toBeCloseTo(fit.radius, 2);
      const spin = b.spin;
      stepHeroAnimState(s, m, DT);
      stepHeroBody(b, s, m, fit, 0, DT);
      expect(b.spin - spin).toBeCloseTo((5 / fit.radius) * DT, 6);
      // unrolled: the shell opens, the roll settles upright (a whole number of turns)
      m.rolling = false;
      for (let k = 0; k < 90; k++) {
         stepHeroAnimState(s, m, DT);
         stepHeroBody(b, s, m, fit, 0, DT);
      }
      expect(b.shell).toBe(0);
      expect(b.bodyScale).toBeCloseTo(1, 3);
      expect(b.spin).toBe(0);
   });

   it("the double jump turns the body once round (2π) about its middle", () => {
      const s = createHeroAnimState();
      const m = createHeroMotion();
      const b = createHeroBody(0);
      m.grounded = false;
      m.events.airJumped = true;
      let most = 0;
      for (let k = 0; k < 40; k++) {
         stepHeroAnimState(s, m, DT);
         stepHeroBody(b, s, m, fit, 0, DT);
         most = Math.max(most, b.roll);
      }
      expect(most).toBeGreaterThan(Math.PI * 1.9);
      expect(b.roll).toBe(0);
      expect(b.pivotY).toBeCloseTo(fit.curlCenterY, 9);
   });

   it("squash on landing (volume kept), stretch in the air, a forward stretch while dashing", () => {
      const s = createHeroAnimState();
      const m = createHeroMotion();
      const b = createHeroBody(0);
      m.events.landed = true;
      m.events.landSpeed = 20;
      let low = 1;
      for (let k = 0; k < 20; k++) {
         stepHeroAnimState(s, m, DT);
         stepHeroBody(b, s, m, fit, 0, DT);
         low = Math.min(low, b.scale.y);
         expect(b.scale.x * b.scale.y * b.scale.z).toBeCloseTo(1, 5);
      }
      expect(low).toBeLessThan(0.85);
      m.grounded = false;
      m.vy = -12;
      for (let k = 0; k < 60; k++) {
         stepHeroAnimState(s, m, DT);
         stepHeroBody(b, s, m, fit, 0, DT);
      }
      expect(b.scale.y).toBeGreaterThan(1.08);
      m.power = "dash";
      for (let k = 0; k < 30; k++) {
         stepHeroAnimState(s, m, DT);
         stepHeroBody(b, s, m, fit, 0, DT);
      }
      expect(b.streak).toBeGreaterThan(0.99);
      expect(b.scale.z).toBeGreaterThan(1.15);
   });

   it("a hit pushes the top along the push (in the facing's frame) and hops; a cheer hops; the aura fades in with a lasting power", () => {
      const s = createHeroAnimState();
      const m = createHeroMotion();
      const b = createHeroBody(0);
      m.events.hurt = true;
      m.events.hurtX = 0;
      m.events.hurtZ = 1; // pushed forward (the hero faces +z)
      let tilt = 0;
      let hop = 0;
      for (let k = 0; k < 15; k++) {
         stepHeroAnimState(s, m, DT);
         stepHeroBody(b, s, m, fit, 0, DT);
         tilt = Math.max(tilt, b.tiltX);
         hop = Math.max(hop, b.hop);
         expect(Math.abs(b.tiltZ)).toBeLessThan(1e-9);
      }
      expect(tilt).toBeGreaterThan(0.3);
      expect(hop).toBeGreaterThan(0.1);
      m.celebrating = true;
      let cheer = 0;
      for (let k = 0; k < 60; k++) {
         stepHeroAnimState(s, m, DT);
         stepHeroBody(b, s, m, fit, 0, DT);
         cheer = Math.max(cheer, b.hop);
      }
      expect(cheer).toBeGreaterThan(0.2);
      m.power = "shield";
      for (let k = 0; k < 40; k++) stepHeroBody(b, s, m, fit, 0, DT);
      expect(b.aura).toBeGreaterThan(0.95);
   });
});
