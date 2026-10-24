import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng } from "@/arcade3d/core/math";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { launchForTime, landingPoint } from "@/arcade3d/core/ballistics";
import { MUZZLE } from "./assets";
import { VIEW } from "./camera";
import { castleDefenderMeta } from "./meta";
import { AIM, BALLISTICS, COUNTS, LANES, LANE_X, ROCK_FLIGHT, STARTS, TUNING, TYPES, chooseUpgrade, createInput, createRun, flightTime, generateArmy, impact, predict, reload, runScore, snapAim, splash, stepRun, threatenedCrew, type CastleRun } from "./rules";

const idle = createInput();
const advanceTo = (run: CastleRun, at: number) => stepRun(run, idle, at - run.time);
function isolated(kind: "walker" | "shield" | "runner" | "crew" = "walker") {
   const run = createRun(1);
   for (const g of run.goblins) g.status = "dead";
   const g = run.goblins[0];
   g.status = "ground"; g.kind = kind; g.hp = TYPES[kind].hp; g.x = 0; g.z = 0;
   return { run, g };
}

describe("literal tuning and schedules", () => {
   it("pins approved values, not self-derived limits", () => {
      expect(STARTS).toEqual([0, 28, 56, 84, 112]);
      expect(COUNTS).toEqual([[8, 0, 0, 0], [10, 4, 0, 0], [10, 4, 6, 0], [10, 4, 6, 6], [12, 6, 6, 6]]);
      expect(TYPES).toEqual({ walker: { hp: 1, speed: 0.7, damage: 5 }, shield: { hp: 2, speed: 0.7, damage: 8 }, runner: { hp: 1, speed: 1.2, damage: 5 }, crew: { hp: 1, speed: 0.7, damage: 5 } });
      expect(TUNING).toMatchObject({ hp: 100, repair: 25, reload: 0.8, radius: 2, gravity: 9.81, climb: 2, rockCooldown: 8, rockBuffer: 1, rearOffset: 0.8, lateral: 0.65, safety: 139.9 });
      expect(AIM).toEqual({ x: { min: -5, max: 5, step: 0.5, rate: 6, dragGain: 0 }, y: { min: -2, max: 6, step: 0.5, rate: 6, dragGain: 0 }, holdDelay: 0.25 });
      expect(castleDefenderMeta.scoring).toMatchObject({ maxScore: 3210, minDurationMs: 39000, maxDurationMs: 140000, base: 160, maxPointsPerSec: 25 });
      expect(LANES.map((p) => p.total)).toEqual([8.8, 8.8, 8.8]);
      expect(ROCK_FLIGHT).toBeCloseTo(0.782061887, 7);
      expect(TUNING.snap).toBe(1.5);
      // stepAimKeys maps screen axes directly because the fitted camera cannot turn.
      expect(VIEW.yaws).toEqual([0]);
   });
   it("generates valid deterministic armies over 1,000 seeds", () => {
      for (let seed = 0; seed < 1000; seed++) {
         const a = generateArmy(seed), b = generateArmy(seed);
         expect(a).toEqual(b);
         expect(a.goblins.map((g) => g.id)).toEqual(Array.from({ length: 98 }, (_, i) => i));
         expect(a.crews).toHaveLength(4);
         for (let wave = 0; wave < 5; wave++) {
            const row = a.goblins.filter((g) => g.wave === wave);
            expect(["walker", "shield", "runner", "crew"].map((k) => row.filter((g) => g.kind === k).length)).toEqual(COUNTS[wave]);
            expect(Math.min(...row.map((g) => g.spawn))).toBe(STARTS[wave]);
            expect(Math.max(...row.map((g) => g.spawn))).toBe(STARTS[wave] + 8);
            const crewLanes = a.crews.filter((c) => c.wave === wave).map((c) => c.lane);
            expect(new Set(crewLanes).size).toBe(crewLanes.length);
            for (const g of row) {
               expect(g.z).toBeCloseTo(g.initialS === 0.8 ? -6 : -6.8, 8);
               expect(g.spawn + (8.8 - g.initialS) / TYPES[g.kind].speed + (g.crew >= 0 ? 2 : 0)).toBeLessThanOrEqual(STARTS[wave] + 22.571429);
               for (const other of row) if (other.pack === g.pack && other.id !== g.id) {
                  expect(Math.abs(other.x - g.x) >= 1.184 || Math.abs(other.z - g.z) >= 0.637819).toBe(true);
                  expect(Math.hypot(other.x - g.x, other.z - g.z)).toBeLessThan(2);
               }
            }
         }
         for (const c of a.crews) expect(a.goblins.filter((g) => g.crew === c.id)).toHaveLength(3);
      }
   });
});

describe("combat and scoring", () => {
   it("pays each death once, includes radius edge and rejects epsilon outside", () => {
      const { run, g } = isolated();
      impact(run, 2 + 1e-6, 0); expect(g.hp).toBe(1);
      impact(run, 2, 0); expect(g.status).toBe("dead"); expect(run.score).toBe(20);
      impact(run, 0, 0); expect(run.score).toBe(20); expect(run.killed).toBe(1);
   });
   it("retains fractional shield HP; front/coincident half, rear full", () => {
      const { run, g } = isolated("shield");
      impact(run, 0, 0); expect(g.hp).toBe(1.5);
      impact(run, 0, 0.1); expect(g.hp).toBe(1);
      impact(run, 0, -0.1); expect(g.hp).toBe(0); expect(run.rearHits).toBe(1); expect(run.score).toBe(20);
   });
   it("uses analytic launches with less than 1e-6 landing error", () => {
      for (const t of [0.6, 1]) {
         const to = { x: 5, y: 0, z: -6 }, v = launchForTime(MUZZLE, to, t, BALLISTICS);
         const p = landingPoint({ ...MUZZLE, vx: v.x, vy: v.y, vz: v.z }, BALLISTICS)!;
         expect(Math.hypot(p.x - 5, p.y, p.z + 6)).toBeLessThan(1e-6);
      }
      expect(flightTime(MUZZLE.x, MUZZLE.z)).toBe(0.6);
      expect(flightTime(MUZZLE.x + 10, MUZZLE.z)).toBe(1);
      expect(flightTime(MUZZLE.x + 20, MUZZLE.z)).toBe(1);
   });
   it("replaces one buffered aim and launches it at exact reload boundary", () => {
      const run = createRun(0), i = createInput();
      i.point = true; i.fire = true; i.x = 5; i.z = -6;
      stepRun(run, i, 0.05); expect(run.launches).toBe(1);
      i.x = -5; i.z = -1; stepRun(run, i, 0.05);
      i.x = 3; i.z = -4; stepRun(run, i, 0.05);
      advanceTo(run, 0.8);
      expect(run.launches).toBe(2);
      const b = run.balls.find((p) => p.id === 1)!;
      expect(b.launched).toBeCloseTo(0.8, 9); expect(b.tx).toBeCloseTo(3, 9); expect(b.tz).toBeCloseTo(-4, 9);
   });
   it("double pays corpses once and consumes one reload", () => {
      const run = createRun(0), i = createInput(); run.stacks[3] = 1;
      i.fire = true; stepRun(run, i, 0.01);
      expect(run.balls.filter((p) => p.active)).toHaveLength(2); expect(run.ready).toBe(0.8);
      const { run: r } = isolated(); impact(r, 0, 0); impact(r, 0, 0); expect(r.score).toBe(20);
   });
   it("arrival escapes once and reduces integral HP without kill points", () => {
      const { run, g } = isolated("shield"); g.s = 8.8; g.x = 0; g.z = 2;
      stepRun(run, idle, 0.01); expect(run.hp).toBe(92); expect(g.status).toBe("escaped"); expect(run.killed).toBe(0);
      stepRun(run, idle, 0.01); expect(run.hp).toBe(92);
   });
   it("opens offers early, awards at24 even with escapes, defaults once at28", () => {
      const run = createRun(10);
      advanceTo(run, 23); expect(run.offer).toBe(true); expect(run.score).toBe(0); expect(run.hp).toBe(60);
      advanceTo(run, 24); expect(run.score).toBe(200); expect(run.cleared).toBe(1);
      const before = [...run.stacks], left = run.cards[0];
      advanceTo(run, 28); expect(run.wave).toBe(1); expect(run.offer).toBe(false);
      before[left]++;
      expect(run.stacks).toEqual(before); expect(run.chosen).toBe(0);
   });
   it("drops a shot buffered just before the last arrival opens an offer", () => {
      const { run, g } = isolated(), i = createInput();
      g.s = 8.8 - 0.7 * 0.02; run.ready = 0.5; i.fire = true;
      stepRun(run, i, 0.01);
      expect(run.offer).toBe(false); expect(run.fire.pending).toBe(true);
      advanceTo(run, 0.03);
      expect(run.offer).toBe(true); expect(run.fire.pending).toBe(false);
      advanceTo(run, 0.6); expect(run.launches).toBe(0);
   });
   it("never launches a ready buffered shot or accepts fire during an offer", () => {
      const run = createRun(0), i = createInput();
      run.offer = true; run.offered = 0; run.fire.pending = true; run.ready = 0;
      stepRun(run, idle, 0.01);
      expect(run.launches).toBe(0); expect(run.balls.some((b) => b.active)).toBe(false);
      run.fire.pending = false; i.fire = true;
      stepRun(run, i, 0.01);
      expect(run.launches).toBe(0); expect(run.fire.pending).toBe(false);
   });
   it("caps a repair from 110 HP at 125 current and maximum HP", () => {
      const run = createRun(0); run.offer = true; run.cards[0] = 2; run.hp = 110;
      chooseUpgrade(run, 1);
      expect(run.hp).toBe(125); expect(run.maxHP).toBe(125);
   });
   it("latches cards, caps capacity, additive repair and reload/splash magnitudes", () => {
      const run = createRun(0); run.offer = true; run.cards[0] = 2; run.cards[1] = 3; run.hp = 40;
      chooseUpgrade(run, 1); chooseUpgrade(run, 2);
      expect(run.hp).toBe(65); expect(run.maxHP).toBe(125); expect(run.stacks).toEqual([0, 0, 1, 0]);
      run.stacks[0] = 2; run.stacks[1] = 2;
      expect(reload(run)).toBeCloseTo(0.512, 9); expect(splash(run)).toBeCloseTo(3.38, 9);
      expect(runScore(98, 5, true, 125)).toBe(3210);
   });
   it("coarse ignores swipes; keyboard nudges once; snap leads shields behind", () => {
      const run = createRun(0), i = createInput(); i.pressed.left = true; i.coarse = true;
      stepRun(run, i, 0.01); expect(run.aim.x).toBe(0);
      i.coarse = false; stepRun(run, i, 0.01); expect(run.aim.x).toBe(-0.5);
      const { run: r, g } = isolated("shield"); g.s = 4; g.x = g.position.x; g.z = -2.8;
      snapAim(r, g.x, g.z);
      const predicted = { x: 0, y: 0, z: 0 }; predict(g, flightTime(g.x, g.z), predicted);
      expect(-r.aim.y).toBeLessThan(predicted.z); expect(predicted.z + r.aim.y).toBeGreaterThan(0.6);
   });
   it("touch stepRun snaps at 1.5 metres but keeps an exact tap at 1.6", () => {
      for (const distance of [1.5, 1.6]) {
         const { run, g } = isolated("runner"), i = createInput();
         // Flight prediction clamps to the lane end (0, 2), with no derived threshold.
         g.path = LANES[1]; g.lateral = 0; g.s = 8.7;
         i.coarse = true; i.point = true; i.fire = true; i.x = distance; i.z = 2;
         stepRun(run, i, 0.001);
         const expectedX = distance === 1.5 ? 0 : 1.6;
         expect(run.aim.x).toBe(expectedX); expect(-run.aim.y).toBe(2);
         expect(run.launches).toBe(1);
         expect(run.balls[0].tx).toBeCloseTo(expectedX, 9); expect(run.balls[0].tz).toBeCloseTo(2, 9);
      }
   });
   it("touch stepRun breaks an equal-distance prediction tie by lower goblin id", () => {
      const { run, g } = isolated("runner"), other = run.goblins[1], i = createInput();
      // Symmetric predictions at (-1, 2) and (1, 2); the lower id is on the left.
      g.path = LANES[0]; g.lateral = 2; g.s = 8.7;
      other.status = "ground"; other.kind = "runner"; other.hp = 1;
      other.path = LANES[2]; other.lateral = -2; other.s = 8.7;
      i.coarse = true; i.point = true; i.fire = true; i.x = 0; i.z = 2;
      stepRun(run, i, 0.001);
      expect(run.aim.x).toBe(-1); expect(-run.aim.y).toBe(2);
      expect(run.balls[0].tx).toBeCloseTo(-1, 9);
   });
});

function erectedFixture() {
   const run = createRun(0);
   for (const g of run.goblins) g.status = "dead";
   run.wave = 3; run.cleared = 3; run.time = 100;
   const c = run.crews[0]; c.erected = 100;
   let rail = 0;
   for (const g of run.goblins) if (g.crew === c.id) {
      g.status = "climb"; g.hp = 1; g.y = 0.08; g.z = 2;
      g.x = LANE_X[c.lane] + (rail++ % 2 ? 0.45 : -0.45);
   }
   return run;
}
describe("ladders, rocks and terminal boundaries", () => {
   it("rock snapshots crew, kills three climbers and cooldown lasts8s", () => {
      const run = erectedFixture(), i = createInput(); i.rock = true;
      stepRun(run, i, 0.01); expect(run.rock.crew).toBe(0); expect(run.rock.ready).toBe(108);
      advanceTo(run, 100 + ROCK_FLIGHT); expect(run.killed).toBe(3); expect(run.score).toBe(60); expect(run.crews[0].destroyed).toBe(true);
      stepRun(run, i, 0.01); expect(run.drops).toBe(1);
   });
   it("climbers are immune to cannon and each independently damages at2s", () => {
      const run = erectedFixture(), climbers = run.goblins.filter((g) => g.crew === 0);
      expect(climbers).toHaveLength(3);
      impact(run, LANE_X[run.crews[0].lane], 2); expect(run.killed).toBe(0);
      expect(climbers.map((g) => g.hp)).toEqual([1, 1, 1]);
      advanceTo(run, 101.99); expect(run.hp).toBe(100);
      advanceTo(run, 102); expect(run.hp).toBe(85); expect(run.killed).toBe(0);
   });
   it("ignores a second Rock press on a fresh ladder before the eight-second cooldown", () => {
      const run = erectedFixture(), i = createInput(); i.rock = true;
      for (const g of run.goblins) if (g.crew === 1) { g.status = "ground"; g.hp = 1; g.s = 8.1; }
      stepRun(run, i, 0.01); advanceTo(run, 101.01);
      expect(run.crews[1].erected).toBeCloseTo(101, 8); expect(threatenedCrew(run)).toBe(1);
      expect(run.offer).toBe(false); expect(run.rock.active).toBe(false);
      expect(run.time).toBeLessThan(run.rock.ready); expect(run.rock.ready).toBe(108);
      stepRun(run, i, 0.01);
      expect(run.drops).toBe(1); expect(run.rock.active).toBe(false); expect(run.rock.pending).toBe(false);
      expect(run.crews[1].destroyed).toBe(false);
      expect(run.goblins.filter((g) => g.crew === 1).map((g) => g.hp)).toEqual([1, 1, 1]);
   });
   it("a buffered rock never drops on its destroyed target", () => {
      const run = erectedFixture(); run.crews[0].destroyed = true;
      run.rock.pending = true; run.rock.target = 0; run.rock.expires = 101;
      stepRun(run, idle, 0.01);
      expect(run.drops).toBe(0); expect(run.rock.active).toBe(false);
      advanceTo(run, 101.01);
      expect(run.drops).toBe(0); expect(run.rock.pending).toBe(false); expect(run.rock.ready).toBe(0);
      expect(run.killed).toBe(0);
   });
   it("nextCrew skips a destroyed earlier crew and leaves no buffer if all are destroyed", () => {
      for (const allDestroyed of [false, true]) {
         const run = createRun(0), i = createInput(); run.wave = 3; run.cleared = 3; run.time = 84;
         for (const g of run.goblins) {
            g.status = g.crew === 0 || g.crew === 1 ? "waiting" : "dead";
            if (g.crew >= 0) { g.spawn = 84; g.initialS = 0; g.s = 0; }
         }
         run.crews[0].destroyed = true; run.crews[1].destroyed = allDestroyed;
         i.rock = true; stepRun(run, i, 0.01);
         expect(run.rock.target).toBe(allDestroyed ? -1 : 1);
         expect(run.rock.pending).toBe(!allDestroyed); expect(run.drops).toBe(0);
      }
   });
   it("same-time fatal arrival wins over a rescuing rock", () => {
      const run = erectedFixture(); run.hp = 5;
      run.rock.active = true; run.rock.crew = 0; run.rock.impact = 102;
      advanceTo(run, 102); expect(run.end).toBe("lose"); expect(run.killed).toBe(0); expect(run.score).toBe(0);
   });
   it("buffers one rock before erection, expires without consumption", () => {
      const run = createRun(1), i = createInput(); run.wave = 3; run.cleared = 3; run.time = 84;
      for (const g of run.goblins) if (g.wave < 3) g.status = "escaped";
      i.rock = true;
      stepRun(run, i, 0.01); expect(run.rock.pending).toBe(true); expect(run.rock.ready).toBe(0);
      advanceTo(run, 85.1); expect(run.rock.pending).toBe(false); expect(run.drops).toBe(0);
   });
   it("chooses greatest climb fraction then crew id", () => {
      const run = erectedFixture(); run.crews[1].erected = 99.9;
      for (const g of run.goblins) if (g.crew === 1) g.status = "climb";
      expect(threatenedCrew(run)).toBe(1); run.crews[1].erected = 100; expect(threatenedCrew(run)).toBe(0);
   });
   it("erects when last survivor arrives, moves bodies onto visible rails", () => {
      const run = createRun(0); run.wave = 3; run.cleared = 3; run.time = 90;
      for (const g of run.goblins) g.status = "dead";
      const members = run.goblins.filter((g) => g.crew === 0);
      for (const g of members) { g.status = "ground"; g.s = 8.8; }
      members[2].s = 8.73;
      stepRun(run, idle, 0.05); expect(run.crews[0].erected).toBe(-1);
      stepRun(run, idle, 0.05); expect(run.crews[0].erected).toBeCloseTo(90.1, 8);
      expect(members.every((g) => g.status === "climb" && g.z === 2 && g.y >= 0.08)).toBe(true);
   });
   it("accepts a buffered rock at erection and never transfers its snapshot", () => {
      const run = erectedFixture(), i = createInput(); run.crews[0].erected = -1;
      const members = run.goblins.filter((g) => g.crew === 0);
      for (const g of members) { g.status = "ground"; g.s = 8.8; }
      members[2].s = 8.45; i.rock = true;
      stepRun(run, i, 0.01); expect(run.rock.pending).toBe(true);
      advanceTo(run, 100.5); expect(run.rock.active).toBe(true); expect(run.rock.launched).toBeCloseTo(100.5, 8);
      expect(run.rock.crew).toBe(0); expect(run.rock.ready).toBeCloseTo(108.5, 8);
      run.crews[1].erected = 100.4;
      for (const g of run.goblins) if (g.crew === 1) { g.status = "climb"; g.hp = 1; }
      advanceTo(run, 100.5 + ROCK_FLIGHT);
      expect(run.goblins.filter((g) => g.crew === 1 && g.status === "climb")).toHaveLength(3);
      expect(run.goblins.filter((g) => g.crew === 0 && g.status === "dead")).toHaveLength(3);
   });
   it("the exact rescue window is1.217938s; later rocks cannot rescue", () => {
      expect(2 - ROCK_FLIGHT).toBeCloseTo(1.217938113, 7);
      const early = erectedFixture(), late = erectedFixture(), i = createInput(); i.rock = true;
      advanceTo(early, 101.21); stepRun(early, i, 0.001); advanceTo(early, 102);
      expect(early.hp).toBe(100); expect(early.killed).toBe(3);
      advanceTo(late, 101.22); stepRun(late, i, 0.001); advanceTo(late, 102.01);
      expect(late.hp).toBe(85); expect(late.killed).toBe(0);
   });
   it("pays final clear plus HP bonus at136 and freezes the final score", () => {
      const run = createRun(1); run.wave = 4; run.cleared = 4; run.killed = 98; run.score = 2760;
      run.hp = run.maxHP = 125; run.time = 135.99;
      for (const g of run.goblins) g.status = "dead";
      stepRun(run, idle, 0.01);
      expect(run.end).toBe("win"); expect(run.time).toBeCloseTo(136, 8); expect(run.score).toBe(3210);
      stepRun(run, idle, 1); expect(run.score).toBe(3210);
   });
   it("wave 5 resolution never opens an upgrade offer, including before the final clear", () => {
      const run = createRun(0); run.wave = 4; run.cleared = 4; run.offered = 3; run.time = 130;
      for (const g of run.goblins) g.status = "dead";
      stepRun(run, idle, 0.01);
      expect(run.offer).toBe(false); expect(run.chosen).toBe(-1); expect(run.end).toBe(null);
      advanceTo(run, 136);
      expect(run.end).toBe("win"); expect(run.offer).toBe(false); expect(run.upgrades).toBe(0);
   });
   it("no lost remainder, freeze after over, safety only for incomplete fixture", () => {
      const a = createRun(3), b = createRun(3);
      stepRun(a, idle, 1.037); for (let n = 0; n < 1037; n++) stepRun(b, idle, 0.001);
      expect(a.time).toBeCloseTo(1.037, 9); expect(a.goblins[0].s).toBeCloseTo(b.goblins[0].s, 8);
      const run = erectedFixture(); run.wave = 4; run.cleared = 4; run.time = 139.85;
      const g = run.goblins[97]; g.status = "waiting"; g.spawn = 200;
      stepRun(run, idle, 0.05); expect(run.end).toBe("timeup"); expect(run.time).toBeCloseTo(139.9, 8);
      const json = JSON.stringify(run); stepRun(run, createInput(), 1); expect(JSON.stringify(run)).toBe(json);
   });
   it("real store pause does not advance the run clock", () => {
      const store = createArcadeStore(); store.getState().configure({ durationMs: null }); store.getState().markReady(); store.getState().start();
      for (let n = 0; n < 61; n++) advanceRunClock(store, 0.05);
      store.getState().pause(); const at = store.getState().elapsedMs;
      advanceRunClock(store, 0.05); expect(playedFrameDt(store.getState())).toBe(0); expect(store.getState().elapsedMs).toBe(at);
   });
});

// All bots use the actual input, aim, reload, flight and store. The "human" bot uses exact
// prediction (an oracle), despite delayed, imperfect inputs and a >=1.2s fire interval;
// keyboard aim has the same hold delay as the game. Measured player profiles are in README.
function bot(seed: number, human: boolean, coarse: boolean, spam = false) {
   const run = createRun(seed), input = createInput(), rng = createRng(seed ^ 0xba7);
   input.coarse = coarse;
   const aim = { x: 0, y: 0, z: 0 };
   let target = -1, decision = 0, fireAt = 0, lastX = 0, lastY = 0;
   const frame = spam ? fixedFrames(50) : seed % 3 === 0 ? fixedFrames(1000 / 60) : seed % 3 === 1 ? fixedFrames(50) : randomFrames(seed, 0.004, 0.05);
   let boundsOK = true, hpOK = true;
   const final = simulateRun(createArcadeStore(), { frame, step(dt, _time, store) {
      input.fire = false; input.rock = false; input.point = false; input.choice = 0;
      input.pressed.left = input.pressed.right = input.pressed.up = input.pressed.down = false;
      if (run.offer) {
         // Lowest eligible card: capped reload/splash/repair, never double on the human route.
         input.choice = 1;
      } else if (spam) {
         input.point = true; input.x = rng() * 10 - 5; input.z = rng() * 8 - 6; input.fire = true; input.rock = true;
      } else {
         if (run.time >= decision) {
            target = -1; let urgency = -Infinity;
            for (const g of run.goblins) if (g.status === "ground") {
               const u = -(8.8 - g.s) / TYPES[g.kind].speed + (g.kind === "crew" ? 0.5 : 0);
               if (u > urgency) { urgency = u; target = g.id; }
            }
            decision = run.time + (human ? 0.35 : 0.05);
            if (target >= 0) {
               const g = run.goblins[target];
               const t = flightTime(g.x, g.z) + (human ? 0.1 : 0);
               predict(g, t, aim); aim.x -= g.lateral;
               if (g.kind === "shield") aim.z -= 0.65;
               if (human) { aim.x += (rng() * 2 - 1) * 0.6; aim.z += (rng() * 2 - 1) * 0.6; }
            }
         }
         if (coarse || !human) {
            input.x = aim.x; input.z = aim.z;
         } else {
            const dx = aim.x - run.aim.x, dy = aim.z + run.aim.y;
            input.moveX = Math.abs(dx) > 0.25 ? Math.sign(dx) : 0;
            input.moveY = Math.abs(dy) > 0.25 ? Math.sign(dy) : 0;
            input.pressed.left = input.moveX < 0 && lastX !== input.moveX;
            input.pressed.right = input.moveX > 0 && lastX !== input.moveX;
            input.pressed.up = input.moveY < 0 && lastY !== input.moveY;
            input.pressed.down = input.moveY > 0 && lastY !== input.moveY;
            lastX = input.moveX; lastY = input.moveY;
         }
         if (target >= 0 && run.goblins[target].status === "ground" && run.time >= fireAt && (coarse || !human || Math.hypot(run.aim.x - aim.x, -run.aim.y - aim.z) < 0.8)) {
            input.fire = true; input.point = coarse || !human; fireAt = run.time + (human ? 1.2 : reload(run));
         }
         const c = threatenedCrew(run);
         if (c >= 0 && run.time - run.crews[c].erected >= (human ? 0.35 : 0)) input.rock = true;
      }
      const before = run.score;
      stepRun(run, input, dt);
      const s = store.getState(); s.addScore(run.score - before); s.setStat("hp", run.hp);
      if (run.end) { if (run.end === "win") s.setScore(run.score); s.end(run.end); }
      boundsOK &&= run.score <= 160 + 25 * s.elapsedMs / 1000 + 1e-6;
      hpOK &&= Number.isInteger(run.hp) && run.hp >= 0 && run.hp <= 125;
   } });
   expect(boundsOK).toBe(true); expect(hpOK).toBe(true);
   expect(withinServerLimits(final.score, final.elapsedMs, castleDefenderMeta.scoring)).toBe(true);
   expect(capScore(final.score, final.elapsedMs, castleDefenderMeta.scoring)).toBe(final.score);
   expect(run.end).not.toBe("timeup");
   return { run, final };
}
describe("real-store score envelope and human feasibility", () => {
   it("pins every unrestricted wave-prefix bound and final bonus", () => {
      const kills = [160, 640, 1240, 1960, 2760], clears = [360, 840, 1440, 2160, 2960];
      for (let n = 0; n < 5; n++) {
         expect(kills[n]).toBeLessThanOrEqual(160 + 25 * STARTS[n]);
         expect(clears[n]).toBeLessThanOrEqual(160 + 25 * (STARTS[n] + 24));
      }
      expect(3210).toBeLessThanOrEqual(3560);
   });
   // Bound runtime on this shared machine; retain 3–4 seeds per input/frame combination.
   it("20 legal seeds, 20 oracle human-paced seeds and10 spam seeds meet the envelope", () => {
      const started = performance.now();
      let wins = 0, best = 0, minHP = 125;
      let fastestMs = Infinity, slowestMs = 0, lost = 0, lowHP = 0, missedPacks = 0;
      for (let seed = 0; seed < 20; seed++) {
         const legal = bot(seed, false, seed % 2 === 0);
         expect(legal.run.end).toBe("win"); best = Math.max(best, legal.final.score);
         const human = bot(seed, true, seed % 2 === 0);
         if (human.run.end === "win" && human.run.hp >= 20) wins++;
         if (human.run.end === "lose") lost++;
         if (human.run.hp < 20) lowHP++;
         fastestMs = Math.min(fastestMs, legal.final.elapsedMs, human.final.elapsedMs);
         slowestMs = Math.max(slowestMs, legal.final.elapsedMs, human.final.elapsedMs);
         missedPacks += new Set(human.run.goblins.filter((g) => g.status === "escaped").map((g) => g.wave * 32 + g.pack)).size;
         minHP = Math.min(minHP, human.run.hp);
         expect(human.run.stacks[3]).toBe(0);
      }
      for (let seed = 0; seed < 10; seed++) bot(seed, false, true, true);
      console.info("castle-defender bots", { legal: 20, human: 20, spam: 10, humanWinsWith20HP: wins, minHumanHP: minHP, bestScore: best, fastestMs, slowestMs, lost, lowHP, missedPacks, runtimeMs: Math.round(performance.now() - started) });
      expect(wins).toBeGreaterThanOrEqual(19);
      expect(best).toBeGreaterThanOrEqual(2889);
   }, 60000);
   it("idle loses after39s and never earns kill or bonus points", () => {
      const run = createRun(9);
      const final = simulateRun(createArcadeStore(), { frame: fixedFrames(50), step(dt, _t, store) {
         const score = run.score; stepRun(run, idle, dt); store.getState().addScore(run.score - score);
         if (run.end) store.getState().end(run.end);
      } });
      expect(final.endReason).toBe("lose"); expect(final.elapsedMs).toBeGreaterThanOrEqual(39000);
      expect(run.killed).toBe(0); expect(withinServerLimits(final.score, final.elapsedMs, castleDefenderMeta.scoring)).toBe(true);
   });
   it("replays identical seed and inputs", () => {
      const a = bot(42, false, true), b = bot(42, false, true);
      expect([a.run.score, a.run.hp, a.run.time]).toEqual([b.run.score, b.run.hp, b.run.time]);
   });
});
