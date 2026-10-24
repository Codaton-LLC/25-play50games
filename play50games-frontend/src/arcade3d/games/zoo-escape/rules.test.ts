// Zoo Escape rules: pinned constants, vision / hearing / suspicion, toss, searchlight, stages,
// catches, the clock, scoring, determinism, the seeded layout, and the score-limit proof with bots
// driving the real store (advanceRunClock + playedFrameDt via botHarness.simulateRun).
// The fairness proofs (periodic solver, respawn and entry safety, the solver and novice bots) are in
// fairness.test.ts.
import { describe, expect, it } from "vitest";
import { hasLineOfSightXZ, inViewCone, stepPatrol } from "@/arcade3d/core/ai";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createGrid, findPath, fixedFrames, freeGrid, nearestFree, randomFrames, simulateRun, steer } from "@/arcade3d/core/testing/botHarness";
import { createRng } from "@/arcade3d/core/math";
import { BLOCKERS, BUSHES, CYCLES, KEEPERS, SNACK_CANDIDATES, SOLIDS, STAGES, STAGE_KEEPERS, type StageIndex } from "./level";
import { zooEscapeMeta } from "./meta";
import {
   CATCH, CLOCK, HEARING, KEEPER, PANDA, PROPOSED_LIMITS, ROUTES, SCORE, SEARCHLIGHT, SNACK, SUSPICION, TOSS, VISION,
   applyToStore, bushAt, clearSight, createRun, finalScore, hears, keeperSees, liveScore, placeOnSchedule, searchlightSees, searchlightYaw, seedLayout, sendKeeper, stepRun, tossLanding,
   type RunState, type StepInput,
} from "./rules";
import { followPlan, oraclePlan, stageRouteBound } from "./testkit";

const DT = 1 / 60;
const STILL: StepInput = { dirX: 0, dirZ: 0, sneak: false, toss: false };
const fresh = (seed = 7) => { const r = createRun(seed); r.grace = 0; return r; };
const steps = (run: RunState, n: number, input = STILL, dt = DT) => { for (let i = 0; i < n && !run.over; i++) stepRun(run, input, dt); };
const p = (x: number, z: number) => ({ x, y: 0, z });

describe("constants (pinned)", () => {
   it("keeps every gameplay number", () => {
      expect(PANDA).toEqual({ radius: 0.5, walk: 3.2, sneak: 1.6, accel: 20, brake: 28, turn: 12, moving: 0.2 });
      expect({ ...KEEPER, waits: { ...KEEPER.waits } }).toEqual({ radius: 0.35, speed: 1.3, investigateSpeed: 2, wait: 1.2, lookAngle: 0.6, investigateLook: 0.7, lookSpeed: 2.2, offsets: 6, waits: { seen: 2.5, heard: 2, bamboo: 3, radio: 2.5 } });
      expect(VISION.halfAngle).toBeCloseTo(Math.PI / 6, 12);
      expect(VISION.range).toEqual([7, 7, 9]);
      expect(HEARING).toEqual({ walk: 3, sneak: 1.2, cooldown: 2 });
      expect(SUSPICION).toEqual({ catchS: 1.35, decay: 0.5 });
      expect(TOSS).toEqual({ perStage: 2, distance: 4, march: 0.1, clearance: 0.3, flight: 0.6, launchHeight: 0.6, gravity: 9.81, lureRange: 10 });
      expect(CATCH).toEqual({ penalty: 5, max: 3, cardS: 1.2, graceS: 1 });
      expect(CLOCK.startS).toBe(180);
      expect({ ...SEARCHLIGHT, halfAngle: +SEARCHLIGHT.halfAngle.toFixed(6) }).toEqual({ x: 10.8, z: -31, baseYaw: -Math.PI / 2, sweep: 0.95, period: 9, halfAngle: 0.20944, range: 14, radioRange: 12 });
      expect(SNACK).toEqual({ perStage: 4, reach: 0.8, minGap: 3 });
      expect(SCORE).toEqual({ win: 1000, perSecond: 10, snack: 50, catch: 100 });
      expect(CYCLES).toEqual([27, 24, 18]);
      expect(STAGE_KEEPERS).toEqual([[0], [1, 2], [3, 4, 5]]);
   });

   it("walks every route in exactly its stage cycle and back to its start state", () => {
      for (let i = 0; i < KEEPERS.length; i++) {
         const c = CYCLES[KEEPERS[i].stage];
         const a = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0 }, b = { ...a };
         const pa = { index: 1, wait: 0, mode: "patrol" as const, target: p(0, 0) }, pb = { ...pa, target: p(0, 0) };
         placeOnSchedule(a, pa, i, 0);
         placeOnSchedule(b, pb, i, 0);
         const frames = Math.round(c / DT);
         for (let f = 0; f < frames; f++) stepPatrol(b, pb, ROUTES[i], DT, { speed: KEEPER.speed, wait: KEEPER.wait, lookAngle: KEEPER.lookAngle, lookSpeed: KEEPER.lookSpeed });
         expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1e-6);
         // the route's walk + its corner waits is the cycle
         expect(ROUTES[i].total / KEEPER.speed + KEEPERS[i].route.length * KEEPER.wait).toBeCloseTo(c, 9);
      }
   });
});

describe("vision", () => {
   const feet = p(0, 10);
   it("sees the cone's edge at exactly 30° and at range, never past them", () => {
      const r = 6.99;
      const edge = p(feet.x + Math.sin(VISION.halfAngle) * r, feet.z + Math.cos(VISION.halfAngle) * r);
      expect(inViewCone(feet, 0, VISION.halfAngle, VISION.range[0], edge)).toBe(true);
      const past = p(feet.x + Math.sin(VISION.halfAngle + 1e-3) * r, feet.z + Math.cos(VISION.halfAngle + 1e-3) * r);
      expect(inViewCone(feet, 0, VISION.halfAngle, VISION.range[0], past)).toBe(false);
      expect(inViewCone(feet, 0, VISION.halfAngle, 7, p(0, 17))).toBe(true);
      expect(inViewCone(feet, 0, VISION.halfAngle, 7, p(0, 17.01))).toBe(false);
      expect(inViewCone(feet, 0, VISION.halfAngle, VISION.range[2], p(0, 19))).toBe(true);
   });

   it("is stopped by rocks, kiosks, cars, trunks, bamboo and bushes, not by benches, bins, lamps or fences", () => {
      // a stage-2 kiosk between, a car in stage 3, a bush; a bench and a lamp do not block
      expect(clearSight(p(2, -6), p(2, 0.5 - 1.5))).toBe(false);
      expect(clearSight(p(-5, -27.4), p(-1.5, -27.4))).toBe(false);
      expect(clearSight(p(-5.3, 14), p(-5.3, 9))).toBe(false);
      expect(clearSight(p(-3, -3), p(-3, 0.2 - 0.5))).toBe(true);
      expect(clearSight(p(-1.6, -12), p(-1.6, -8))).toBe(true);
      expect(clearSight(p(-6.5, 10), p(-6.5, 17))).toBe(true);
   });

   it("never sees a hidden panda: a centre in a bush has no clear sight from any outside eye (2,000 poses)", () => {
      const rng = createRng(3);
      for (let n = 0; n < 2000; n++) {
         const b = BUSHES[Math.floor(rng() * BUSHES.length)].box;
         const target = p(b.min.x + rng() * (b.max.x - b.min.x), b.min.z + rng() * (b.max.z - b.min.z));
         const a = rng() * Math.PI * 2, d = 0.9 + rng() * 6;
         const eye = p(target.x + Math.sin(a) * d, target.z + Math.cos(a) * d);
         if (bushAt(eye.x, eye.z) >= 0) continue;
         expect(clearSight(eye, target)).toBe(false);
      }
   });

   it("keeperSees = inViewCone ∧ hasLineOfSightXZ without the eye's own bush (20,000 random pairs)", () => {
      const rng = createRng(11);
      let seen = 0;
      for (let n = 0; n < 20000; n++) {
         const stage = Math.floor(rng() * 3) as StageIndex;
         const b = STAGES[stage].bounds;
         const eye = p(b.x0 + rng() * (b.x1 - b.x0), b.z0 + rng() * (b.z1 - b.z0));
         const t = p(eye.x + (rng() - 0.5) * 18, eye.z + (rng() - 0.5) * 18);
         const yaw = rng() * Math.PI * 2;
         const blockers = BLOCKERS.filter((x) => !(eye.x >= x.min.x && eye.x <= x.max.x && eye.z >= x.min.z && eye.z <= x.max.z));
         const want = inViewCone(eye, yaw, VISION.halfAngle, VISION.range[stage], t) && hasLineOfSightXZ(eye, t, blockers);
         expect(keeperSees(eye, yaw, stage, t)).toBe(want);
         if (want) seen++;
      }
      expect(seen).toBeGreaterThan(500);
   });
});

describe("hearing", () => {
   it("hears a moving panda within 3.0 m walking and 1.2 m sneaking, never a still one", () => {
      const k = p(0, 0);
      expect(hears(k, { x: 3, z: 0, speed: 3.2, sneaking: false })).toBe(true);
      expect(hears(k, { x: 3.01, z: 0, speed: 3.2, sneaking: false })).toBe(false);
      expect(hears(k, { x: 1.2, z: 0, speed: 1.6, sneaking: true })).toBe(true);
      expect(hears(k, { x: 1.21, z: 0, speed: 1.6, sneaking: true })).toBe(false);
      expect(hears(k, { x: 0.5, z: 0, speed: 0.2, sneaking: false })).toBe(false);
      expect(hears(k, { x: 0.5, z: 0, speed: 0.21, sneaking: false })).toBe(true);
   });

   it("sends the keeper to the sound once per 2 s, also from inside a bush", () => {
      const run = fresh();
      const k = run.keepers[0];
      // the panda rustles inside the bush at (3, 15.6); the keeper stands 2 m away (waiting)
      run.panda.x = 3; run.panda.z = 15.6;
      k.agent.x = 3; k.agent.z = 13.4; k.patrol.wait = 100; k.patrol.mode = "patrol";
      const wiggle: StepInput = { dirX: 1, dirZ: 0, sneak: false, toss: false };
      let heard = 0;
      for (let f = 0; f < 60 * 3; f++) {
         wiggle.dirX = f % 20 < 10 ? 0.6 : -0.6;
         stepRun(run, wiggle, DT);
         if (run.events.heard === 0) heard++;
         if (run.events.caught) break;
      }
      expect(heard).toBeGreaterThanOrEqual(1);
      expect(heard).toBeLessThanOrEqual(2);
   });
});

/** Keeper 0 walks south towards the panda at 2 m/s (investigating ahead of it): it sees the panda all the way. */
function staring(): RunState {
   const run = fresh();
   run.panda.x = 2; run.panda.z = 15;
   const k = run.keepers[0];
   k.agent.x = 2; k.agent.z = 8.5; k.agent.yaw = 0;
   sendKeeper(k, { x: 2, z: 13.5 }, "heard");
   return run;
}

describe("suspicion", () => {
   it("catches after exactly 1.35 s of continuous sight", () => {
      const run = staring();
      let t = 0;
      while (!run.events.caught && t < 3) { stepRun(run, STILL, DT); t += DT; }
      expect(run.events.caught).toBe("seen");
      expect(t).toBeGreaterThanOrEqual(1.35 - 1e-9);
      expect(t).toBeLessThan(1.35 + 2 * DT);
   });

   it("decays at 0.5/s out of sight, investigates the last seen point (in its zone), waits 2.5 s, returns", () => {
      const run = staring();
      steps(run, 36); // 0.6 s seen
      const k = run.keepers[0];
      expect(k.meter).toBeCloseTo(0.6 / 1.35, 6);
      run.panda.x = 3; run.panda.z = 15.6; // into the bush
      steps(run, 1);
      expect(run.panda.hidden).toBeGreaterThanOrEqual(0);
      expect(k.kind).toBe("seen");
      expect(k.patrol.target.z).toBeCloseTo(KEEPERS[0].zone.max.z, 9);
      const m = k.meter;
      steps(run, 30);
      expect(k.meter).toBeCloseTo(m - 0.5 * 0.5, 6);
      let wait = 0;
      while (k.patrol.mode !== "return" && wait < 10) { stepRun(run, STILL, DT); if (k.patrol.wait > 0) wait += DT; }
      expect(k.patrol.mode).toBe("return");
      expect(wait).toBeCloseTo(KEEPER.waits.seen, 1);
      expect(run.catches).toBe(0);
   });

   it("bumping a keeper or being found in the bush it touches is caught at once", () => {
      const run = fresh();
      run.keepers[0].agent.x = run.panda.x + 0.8; run.keepers[0].agent.z = run.panda.z;
      // stage 1's keeper is far from the start: bring it next to the panda
      stepRun(run, STILL, DT);
      expect(run.lastCatch).toBe("bump");
      const r2 = fresh();
      r2.panda.x = -5.3; r2.panda.z = 11.6;
      r2.keepers[0].agent.x = -5.3 + 0.9 + 0.3; r2.keepers[0].agent.z = 11.6;
      stepRun(r2, STILL, DT);
      expect(r2.lastCatch).toBe("found");
   });
});

describe("toss", () => {
   it("lands 4 m ahead, short of solids and the stage edge", () => {
      const out = { x: 0, z: 0 };
      expect(tossLanding(0, -4, 9.0 + 0.6, Math.PI / 2, out)).toEqual({ x: expect.closeTo(0, 9), z: 9.6 });
      // north from below the moat: stops 0.3 m before it (moat z 3..5)
      tossLanding(0, -4, 7, Math.PI, out);
      expect(out.z).toBeGreaterThanOrEqual(5.3 - 1e-9);
      expect(out.z).toBeLessThan(5.4 + 1e-9);
      // west into the fence at x = -7
      tossLanding(0, -5, 14, -Math.PI / 2, out);
      expect(out.x).toBeGreaterThanOrEqual(-7 + 0.3 - 1e-9);
   });

   it("flies 0.6 s, lures the nearest calm keeper within 10 m to it, 2 per stage, reset on a catch", () => {
      const run = fresh();
      run.panda.x = -4.6; run.panda.z = 6.4; run.panda.facing = Math.PI / 2; // hidden in a bush
      const toss: StepInput = { ...STILL, toss: true };
      stepRun(run, toss, DT);
      expect(run.events.thrown).toBe(true);
      expect(run.bundlesLeft).toBe(1);
      let t = 0;
      while (!run.events.landed) { stepRun(run, STILL, DT); t += DT; }
      expect(t).toBeCloseTo(TOSS.flight, 6);
      expect(run.events.lured).toBe(0);
      expect(run.keepers[0].kind).toBe("bamboo");
      stepRun(run, toss, DT); stepRun(run, STILL, DT);
      steps(run, 40);
      stepRun(run, toss, DT);
      expect(run.bundlesLeft).toBe(0);
      expect(run.events.thrown).toBe(false);
      // a suspicious keeper ignores bamboo
      const r2 = fresh();
      r2.panda.x = -4.6; r2.panda.z = 6.4; r2.panda.facing = Math.PI / 2;
      r2.keepers[0].meter = 0.5;
      stepRun(r2, toss, DT);
      steps(r2, 40);
      expect(r2.keepers[0].kind).not.toBe("bamboo");
   });
});

describe("searchlight", () => {
   it("sweeps base ± 0.95 rad over 9 s and sees with the same rule; cars block it", () => {
      expect(searchlightYaw(0, 0)).toBeCloseTo(-Math.PI / 2, 12);
      expect(searchlightYaw(9 / 4, 0)).toBeCloseTo(-Math.PI / 2 + 0.95, 12);
      expect(searchlightYaw(3, 6)).toBeCloseTo(searchlightYaw(0, 0), 12);
      const t = p(-1, -31);
      const yaw = Math.atan2(t.x - SEARCHLIGHT.x, t.z - SEARCHLIGHT.z);
      expect(searchlightSees(yaw, t)).toBe(true);
      expect(searchlightSees(yaw + 0.3, t)).toBe(false);
      const hid = p(3.4, -24.9);
      expect(searchlightSees(Math.atan2(hid.x - SEARCHLIGHT.x, hid.z - SEARCHLIGHT.z), p(3.4, -27.4))).toBe(false);
   });
});

describe("stages, gates and catches", () => {
   it("crossing a gate switches the stage once, the bar falls 1.2 m past the line and stops a return", () => {
      const run = fresh();
      run.panda.x = 4; run.panda.z = 1.5; run.bundlesLeft = 0;
      const north: StepInput = { dirX: 0, dirZ: -1, sneak: false, toss: false };
      let entered = 0;
      while (run.panda.z > -1.6) { stepRun(run, north, DT); if (run.events.stage === 1) entered++; }
      expect(entered).toBe(1);
      expect(run.stage).toBe(1);
      expect(run.bundlesLeft).toBe(2);
      expect(run.bars[0]).toBe(true);
      steps(run, 120, { dirX: 0, dirZ: 1, sneak: false, toss: false });
      expect(run.panda.z).toBeLessThanOrEqual(-0.6 + 1e-9);
      expect(run.stage).toBe(1);
   });

   it("a catch costs 5 s, shows the card 1.2 s, respawns at the stage start, puts the keepers on schedule, then 1 s of grace", () => {
      const run = fresh();
      run.keepers[0].agent.x = run.panda.x + 0.5; run.keepers[0].agent.z = run.panda.z;
      run.keepers[0].meter = 0.4; run.bundlesLeft = 0;
      stepRun(run, STILL, DT);
      expect(run.catches).toBe(1);
      expect(run.timeLeft).toBeCloseTo(CLOCK.startS - DT - CATCH.penalty, 9);
      expect(run.card).toBe(CATCH.cardS);
      expect([run.panda.x, run.panda.z]).toEqual([STAGES[0].start.x, STAGES[0].start.z]);
      const want = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0 };
      placeOnSchedule(want, { index: 1, wait: 0, mode: "patrol", target: p(0, 0) }, 0, run.time + run.keepers[0].offset);
      expect(run.keepers[0].agent.x).toBeCloseTo(want.x, 9);
      expect(run.keepers[0].agent.z).toBeCloseTo(want.z, 9);
      expect(run.keepers[0].meter).toBe(0);
      expect(run.bundlesLeft).toBe(2);
      let card = 0;
      while (run.card > 0) { stepRun(run, { dirX: 1, dirZ: 0, sneak: false, toss: false }, DT); card += DT; }
      expect(card).toBeCloseTo(CATCH.cardS, 1);
      expect([run.panda.x, run.panda.z]).toEqual([STAGES[0].start.x, STAGES[0].start.z]);
      expect(run.grace).toBe(CATCH.graceS);
      // grace: a bump right away is not a catch
      run.keepers[0].agent.x = run.panda.x + 0.5; run.keepers[0].agent.z = run.panda.z;
      stepRun(run, STILL, DT);
      expect(run.catches).toBe(1);
   });

   it("the 3rd catch loses; a catch that empties the clock is a time-up; the clock goes first", () => {
      const bump = (run: RunState) => { run.keepers[0].agent.x = run.panda.x + 0.5; run.keepers[0].agent.z = run.panda.z; run.grace = 0; run.card = 0; stepRun(run, STILL, DT); };
      const run = fresh();
      bump(run); bump(run); bump(run);
      expect(run.over).toBe("lose");
      expect(run.events.end).toBe("lose");
      const r2 = fresh();
      r2.timeLeft = 3;
      bump(r2);
      expect(r2.over).toBe("timeup");
      const r3 = fresh();
      r3.catches = 2; r3.timeLeft = 3;
      bump(r3);
      expect(r3.over).toBe("lose");
      // on the last frame the clock wins over the exit crossing
      const r4 = fresh();
      r4.stage = 2; r4.reached = 2; r4.panda.x = 6.5; r4.panda.z = -41.98; r4.timeLeft = DT / 2;
      stepRun(r4, { dirX: 0, dirZ: -1, sneak: false, toss: false }, DT);
      expect(r4.over).toBe("timeup");
      const r5 = fresh();
      r5.stage = 2; r5.reached = 2; r5.panda.x = 6.5; r5.panda.z = -41.98; r5.panda.vz = -3.2;
      stepRun(r5, { dirX: 0, dirZ: -1, sneak: false, toss: false }, DT);
      expect(r5.over).toBe("win");
   });
});

describe("scoring", () => {
   it("follows the formula with the floor at 0, and sets the score before every end", () => {
      expect(liveScore({ eaten: 3, catches: 1 })).toBe(50);
      expect(liveScore({ eaten: 1, catches: 2 })).toBe(0);
      expect(finalScore({ eaten: 12, catches: 0, over: "win", timeLeft: 120.9 })).toBe(1000 + 1200 + 600);
      expect(finalScore({ eaten: 0, catches: 2, over: "win", timeLeft: 10.5 })).toBe(1000 + 100 - 200);
      expect(finalScore({ eaten: 5, catches: 0, over: "lose", timeLeft: 50 })).toBe(250);
      expect(finalScore({ eaten: 5, catches: 1, over: "timeup", timeLeft: 0 })).toBe(150);
      const calls: string[] = [];
      const store = { setScore: (v: number) => calls.push(`score ${v}`), setStat: () => undefined, setLevel: () => undefined, end: (r: string) => calls.push(`end ${r}`) };
      const run = fresh();
      run.eaten = 4; run.over = "win"; run.events.end = "win"; run.timeLeft = 100.2;
      applyToStore(run, store, { time: -1, bamboo: -1 });
      expect(calls).toEqual([`score ${1000 + 1000 + 200}`, "end win"]);
   });

   it("is deterministic: the same seed and inputs give the same run", () => {
      const go = () => {
         const run = createRun(99), rng = createRng(5), input = { ...STILL };
         for (let f = 0; f < 3000 && !run.over; f++) {
            if (f % 15 === 0) { input.dirX = rng() * 2 - 1; input.dirZ = rng() * 2 - 1; input.sneak = rng() < 0.5; input.toss = rng() < 0.05; }
            stepRun(run, input, DT);
         }
         return JSON.stringify({ ...run, events: null });
      };
      expect(go()).toBe(go());
   });

   it("seeds 1,000 layouts: whole offset steps, 4 snacks per stage >= 3 m apart, none in a bush or a solid", () => {
      for (let seed = 0; seed < 1000; seed++) {
         const L = seedLayout(seed * 7919 + 13);
         expect(L.offsets.every((k) => Number.isInteger(k) && k >= 0 && k < 6)).toBe(true);
         L.snacks.forEach((picks, s) => {
            expect(picks).toHaveLength(4);
            for (const i of picks) for (const j of picks) if (i < j) expect(Math.hypot(SNACK_CANDIDATES[s][i].x - SNACK_CANDIDATES[s][j].x, SNACK_CANDIDATES[s][i].z - SNACK_CANDIDATES[s][j].z)).toBeGreaterThanOrEqual(3);
         });
      }
      for (const cands of SNACK_CANDIDATES) for (const c of cands) {
         expect(bushAt(c.x, c.z)).toBe(-1);
         expect(SOLIDS.every((b) => c.x < b.min.x || c.x > b.max.x || c.z < b.min.z || c.z > b.max.z)).toBe(true);
      }
   });
});

// ---------- the score-limit proof ----------

/** Runs one seed through the real store; `brain` writes the input before each step. */
function play(seed: number, frame: () => number, brain: (run: RunState, input: StepInput, dt: number) => void) {
   const run = createRun(seed);
   const input: StepInput = { ...STILL };
   const shown = { time: -1, bamboo: -1 };
   const end = simulateRun(createArcadeStore(), { frame, step: (dt, _t, store) => {
      brain(run, input, dt);
      stepRun(run, input, dt);
      applyToStore(run, store.getState(), shown);
   } });
   return { end, run };
}
const FRAMES = [() => fixedFrames(1000 / 30), () => fixedFrames(1000 / 60), () => fixedFrames(1000 / 144), (s: number) => randomFrames(s)] as const;
const frameFor = (seed: number) => FRAMES[seed % 4](seed);
const lawful = (score: number, ms: number) => withinServerLimits(score, ms, PROPOSED_LIMITS) && capScore(score, ms, PROPOSED_LIMITS) === score;

describe("score-limit proof", () => {
   it("derives the proposed limits from the shortest conceivable route (straight lines touching the snacks)", () => {
      const per = [0, 1, 2].map((s) => [0, 1, 2, 3, 4].map((m) => stageRouteBound(s as StageIndex, m, SNACK.reach, SNACK.minGap, PANDA.radius)));
      let best = 0, pps = 0;
      for (let k = 0; k <= 12; k++) {
         let L = Infinity;
         for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) { const c = k - a - b; if (c >= 0 && c <= 4) L = Math.min(L, per[0][a] + per[1][b] + per[2][c]); }
         const t = L / PANDA.walk;
         const score = SCORE.win + SCORE.snack * k + SCORE.perSecond * Math.floor(CLOCK.startS - t);
         best = Math.max(best, score);
         pps = Math.max(pps, score / t);
      }
      expect(best).toBe(3190);
      expect(pps).toBeGreaterThan(157.5);
      expect(pps).toBeLessThan(158.5);
      // + 3 % margin, rounded up
      expect(PROPOSED_LIMITS).toMatchObject({ kind: "points", maxScore: 3290, minDurationMs: 5000, maxDurationMs: 182000, base: 0, maxPointsPerSec: 163 });
      expect(Math.ceil((best * 1.03) / 10) * 10).toBe(PROPOSED_LIMITS.maxScore);
      expect(Math.ceil(pps * 1.03)).toBe(PROPOSED_LIMITS.maxPointsPerSec);
      // the earliest end is a lose: three catches, each after >= 1 s of play, two 1.2 s cards between
      expect(3 * CATCH.graceS + 2 * CATCH.cardS).toBeCloseTo(5.4, 9);
      // meta.scoring stays provisional on this branch (Claude sets both at go-live)
      expect(zooEscapeMeta.scoring.maxScore).toBe(4500);
   });

   it("never moves the panda faster than the walk (20,000 random steps, collisions, clamps, gates)", () => {
      const run = createRun(5), rng = createRng(8), input = { ...STILL };
      for (let n = 0; n < 20000; n++) {
         if (run.over) break;
         if (n % 20 === 0) { input.dirX = rng() * 2 - 1; input.dirZ = rng() * 2 - 1.4; input.sneak = rng() < 0.3; }
         const dt = 0.004 + rng() * 0.046, x = run.panda.x, z = run.panda.z, card = run.card, catches = run.catches;
         stepRun(run, input, dt);
         if (run.catches !== catches || card > 0) continue;
         expect(Math.hypot(run.panda.x - x, run.panda.z - z)).toBeLessThanOrEqual(PANDA.walk * dt + 1e-9);
      }
   });

   it("the oracle (earliest-arrival plan, all 12 snacks) reaches >= 90 % of maxScore, at every frame rate", () => {
      let best = 0;
      const results: string[] = [];
      for (const seed of [65, 46, 43]) {
         const L = seedLayout(seed);
         const plan = oraclePlan(L.offsets, 0, STAGES[0].start.x, STAGES[0].start.z, 0, L.snacks.map((ps, s) => ps.map((i) => SNACK_CANDIDATES[s][i])))!;
         for (let f = 0; f < FRAMES.length; f++) {
            const { end, run } = play(seed, FRAMES[f](seed), (r, input, dt) => { followPlan(plan, r.panda.x, r.panda.z, r.time + dt, input); });
            expect(lawful(end.score, end.elapsedMs)).toBe(true);
            if (end.endReason === "win") best = Math.max(best, end.score);
            results.push(`#${seed}@${f}: ${end.endReason} ${end.score} ${(end.elapsedMs / 1000).toFixed(2)}s`);
            if (f === 1) expect(run.eaten).toBe(12);
         }
      }
      console.log(`oracle: ${results.join(", ")}`);
      expect(best).toBeGreaterThanOrEqual(0.9 * PROPOSED_LIMITS.maxScore);
      expect(best).toBeLessThanOrEqual(PROPOSED_LIMITS.maxScore);
   });

   it("idle, toss-spam and bush-camping bots never score and stay within the limits", () => {
      for (let seed = 1; seed <= 12; seed++) {
         const idle = play(seed, fixedFrames(1000 / 30), () => undefined);
         expect(idle.end.endReason).toBe("timeup");
         expect(idle.end.score).toBe(0);
         expect(idle.run.catches).toBe(0);
         expect(lawful(idle.end.score, idle.end.elapsedMs)).toBe(true);
         const spam = play(seed, frameFor(seed), (_r, input) => { input.toss = true; input.dirX = 0; input.dirZ = 0; });
         expect(spam.end.score).toBe(0);
         expect(spam.run.bundlesLeft).toBe(0);
         expect(lawful(spam.end.score, spam.end.elapsedMs)).toBe(true);
         // camper: into the nearest bush and stay
         const camp = play(seed, fixedFrames(1000 / 30), (r, input) => { const b = BUSHES[0].box; const dx = (b.min.x + b.max.x) / 2 - r.panda.x, dz = (b.min.z + b.max.z) / 2 - r.panda.z, d = Math.hypot(dx, dz); input.sneak = true; input.dirX = d > 0.1 ? dx / d : 0; input.dirZ = d > 0.1 ? dz / d : 0; });
         expect(camp.end.endReason).not.toBe("win");
         expect(camp.end.score).toBeLessThanOrEqual(camp.run.eaten * SCORE.snack);
         expect(lawful(camp.end.score, camp.end.elapsedMs)).toBe(true);
      }
   });

   // the rusher and the farmer walk shortest paths on a botHarness grid round the solids
   const grid = createGrid({ cell: 0.4, halfX: 10, halfZ: 44 });
   const free = freeGrid(grid, (x, z) => z <= 18 && SOLIDS.every((b) => Math.max(b.min.x - x, 0, x - b.max.x) ** 2 + Math.max(b.min.z - z, 0, z - b.max.z) ** 2 > (PANDA.radius + 0.15) ** 2));
   const follower = (x: number, z: number, gx: number, gz: number) => ({ goalX: gx, goalZ: gz, path: findPath(grid, free, nearestFree(grid, free, x, z), nearestFree(grid, free, gx, gz)), k: 0 });
   const out = { dirX: 0, dirZ: 0 };

   it("a catch farmer (walks into the keepers) only loses points and loses by its 3rd catch", () => {
      for (let seed = 1; seed <= 8; seed++) {
         let f = follower(0, 0, 0, 0), next = 0;
         const { end } = play(seed, frameFor(seed + 1), (r, input, dt) => {
            next -= dt;
            const k = r.keepers[STAGE_KEEPERS[r.stage][0]].agent;
            if (next <= 0) { f = follower(r.panda.x, r.panda.z, k.x, k.z); next = 1; }
            steer(grid, f, r.panda.x, r.panda.z, out);
            input.dirX = out.dirX; input.dirZ = out.dirZ; input.sneak = false;
         });
         expect(end.endReason).toBe("lose");
         expect(end.score).toBe(0);
         expect(end.elapsedMs).toBeGreaterThanOrEqual(PROPOSED_LIMITS.minDurationMs);
         expect(lawful(end.score, end.elapsedMs)).toBe(true);
      }
   });

   it("a rusher (shortest path, walking, ignoring keepers) wins at most 20 % of seeds and stays within the limits", () => {
      const goals = STAGES.map((s) => ({ x: (s.gate.x0 + s.gate.x1) / 2, z: s.gate.z - 1.6 }));
      let wins = 0;
      const N = 40;
      for (let seed = 1; seed <= N; seed++) {
         let f = follower(STAGES[0].start.x, STAGES[0].start.z, goals[0].x, goals[0].z), last = 0, carded = false;
         const { end } = play(seed, frameFor(seed), (r, input) => {
            const respawned = carded && r.card === 0;
            carded = r.card > 0;
            if (respawned || r.stage !== last) { f = follower(r.panda.x, r.panda.z, goals[r.stage].x, goals[r.stage].z); last = r.stage; }
            steer(grid, f, r.panda.x, r.panda.z, out);
            input.dirX = out.dirX; input.dirZ = out.dirZ; input.sneak = false;
         });
         if (end.endReason === "win") wins++;
         expect(lawful(end.score, end.elapsedMs)).toBe(true);
      }
      console.log(`rusher: ${wins}/${N} wins`);
      expect(wins / N).toBeLessThanOrEqual(0.2);
   });
});
