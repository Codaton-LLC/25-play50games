import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { camperInput, exposePlayer, idleInput, oracle, spammerInput, spinnerInput, witness } from "./bots";
import {
   AI, CAMP_FLUSH_S, EARLIEST, FORT, KID, PINE, POCKET_OUT, PROPOSED_LIMITS, RELOCATE_MIN_S,
   SCORE, SCOOP, SCOOP_S, THROW, YARD, checkYard, createRun, dodgeDelay, earliestScore,
   fallbackYard, flightTime, lineOfSight, pickTap, pocketsConnected, runScore,
   stepRun, type Run, type StepInput, type Yard,
} from "./rules";

const ZERO: StepInput = { moveX: 0, moveY: 0, camYaw: 0, scoop: false, fire: false, tapId: -1, aimYaw: Math.PI };

function hold(scoop: boolean, fire = false, aim = Math.PI, tap = -1): StepInput {
   return { moveX: 0, moveY: 0, camYaw: 0, scoop, fire, tapId: tap, aimYaw: aim };
}

function openField(run: Run): void {
   for (let i = 0; i < run.forts.length; i++) run.forts[i].hp = 0;
}

function finger(seed: number): string {
   const run = createRun(seed, false);
   let text = (run.fallback ? "F" : "G") + run.forts.length;
   for (let i = 0; i < run.forts.length; i++) text += `${run.forts[i].x.toFixed(4)},${run.forts[i].z.toFixed(4)};`;
   stepRun(run, 1 / 60, ZERO);
   text += run.kids[1].x.toFixed(3) + run.time.toFixed(4);
   return text;
}

describe("yard", () => {
   it("pins the layout constants", () => {
      expect(YARD.minX).toBe(-12); expect(YARD.maxX).toBe(12);
      expect(YARD.minZ).toBe(-9); expect(YARD.maxZ).toBe(9); expect(YARD.inset).toBe(0.35);
      expect(YARD.snowHalf).toBe(0.7); expect(YARD.snowHeight).toBe(1.6);
      expect(YARD.startX).toBe(0); expect(YARD.startZ).toBe(6.2); expect(YARD.startYaw).toBe(Math.PI);
      expect(FORT.count).toBe(7); expect(FORT.gap).toBe(3.6); expect(FORT.snowGap).toBe(3.2);
      expect(FORT.half).toBe(0.9); expect(PINE.count).toBe(10); expect(PINE.trunk).toBe(0.3); expect(PINE.gap).toBe(2.2);
      expect(POCKET_OUT).toBe(0.45);
      expect(checkYard(fallbackYard())).toBeNull();
   });

   it("is deterministic, connected and fair across 200 seeds, and does not need the fallback", () => {
      for (let seed = 1; seed <= 200; seed++) {
         const run = createRun(seed, false);
         expect(run.fallback, String(seed)).toBe(false);
         expect(run.forts).toHaveLength(7);
         expect(run.pines).toHaveLength(10);
         expect(checkYard(run)).toBeNull();
         expect(finger(seed)).toBe(finger(seed));
      }
   });

   it("rejects one broken yard per rule", () => {
      const base = fallbackYard();
      const few: Yard = { forts: base.forts.slice(0, 6), pines: base.pines };
      expect(checkYard(few)).toBe("count");
      const bounds = fallbackYard(); bounds.forts[0] = { x: 9, z: 0, hp: 3 };
      expect(checkYard(bounds)).toBe("bounds");
      const snow = fallbackYard(); snow.forts[0] = { x: 1, z: 1, hp: 3 };
      expect(checkYard(snow)).toBe("snowman");
      const gap = fallbackYard();
      gap.forts[0] = { x: 6, z: 0, hp: 3 }; gap.forts[1] = { x: 6, z: 2, hp: 3 };
      expect(checkYard(gap)).toBe("gap");
      const pines = fallbackYard(); pines.pines = pines.pines.slice(0, 9);
      expect(checkYard(pines)).toBe("pine-count");
      const band = fallbackYard(); band.pines[0] = { ...band.pines[0], x: 0, z: 0 };
      expect(checkYard(band)).toBe("pine-band");
      const close = fallbackYard();
      close.pines[0] = { x: 10.5, z: 0, scale: 1, rotY: 0 };
      close.pines[1] = { x: 11.2, z: 0, scale: 1, rotY: 0 };
      expect(checkYard(close)).toBe("pine-gap");
      const lost = fallbackYard(); lost.forts[0] = { x: 40, z: 0, hp: 3 };
      expect(pocketsConnected(lost)).toBe(false);
      expect(lineOfSight([{ x: 0, z: 3, hp: 3 }], -3, 3, 3, 3)).toBe(false);
      expect(lineOfSight([{ x: 0, z: 3, hp: 0 }], -3, 3, 3, 3)).toBe(true);
   });
});

describe("pins", () => {
   it("pins scoop, throw, kid, AI and score numbers", () => {
      expect(KID.radius).toBe(0.35); expect(KID.speed).toBe(4.5); expect(KID.accel).toBe(22); expect(KID.brake).toBe(30);
      expect(KID.turn).toBe(10); expect(KID.height).toBe(1.3);
      expect(KID.standBodyY).toBe(0.62); expect(KID.standBodyR).toBe(0.32);
      expect(KID.standHeadY).toBe(1.05); expect(KID.standHeadR).toBe(0.2);
      expect(KID.crouchBodyY).toBe(0.42); expect(KID.crouchHeadY).toBe(0.72); expect(KID.crouchHeadR).toBe(0.18);
      expect(KID.crouchSpeed).toBe(0.25); expect(KID.crouchBand).toBe(0.5);
      expect(SCOOP.min).toBe(0.5); expect(SCOOP.max).toBe(1.5); expect(SCOOP.maxAmmo).toBe(3); expect(SCOOP.throwGap).toBe(0.4);
      expect(SCOOP.playerStart).toBe(0); expect(SCOOP.rivalStart).toBe(1); expect(SCOOP.rivalMax).toBe(2);
      expect(SCOOP_S).toBe(0.5); expect(RELOCATE_MIN_S).toBe(0.9); expect(CAMP_FLUSH_S).toBe(6);
      expect(THROW.flightNear).toBe(0.65); expect(THROW.flightFar).toBe(0.85);
      expect(THROW.distNear).toBe(6); expect(THROW.distFar).toBe(14);
      expect(THROW.ballR).toBe(0.25); expect(THROW.coarseR).toBe(0.33); expect(THROW.tapPx).toBe(56);
      expect(THROW.rollerR).toBe(0.45); expect(THROW.rollerSpeed).toBe(6); expect(THROW.rollerLife).toBe(2.2);
      expect(THROW.halfAngle).toBeCloseTo((38 * Math.PI) / 180, 12);
      expect(AI.cover).toBe(0.8); expect(AI.peek).toBe(0.4); expect(AI.windup).toBe(1.2); expect(AI.recover).toBe(0.3);
      expect(AI.stagger).toBe(0.45); expect(AI.knockdown).toBe(1.5); expect(AI.sneakerAt).toBe(10); expect(AI.openLimit).toBe(2);
      expect(AI.dodgeAt[0]).toBe(0.35); expect(AI.dodgeAt[1]).toBe(0.27); expect(AI.dodgeAt[2]).toBe(0.2);
      expect(SCORE.hit).toBe(100); expect(SCORE.out).toBe(300); expect(SCORE.win).toBe(500); expect(SCORE.health).toBe(50);
      expect(SCORE.tagsOut).toBe(3); expect(SCORE.tagsLose).toBe(5); expect(SCORE.duration).toBe(90);
      expect(FORT.hp).toBe(3); expect(FORT.heights[0]).toBe(1.4); expect(FORT.heights[1]).toBe(0.95); expect(FORT.heights[2]).toBe(0.55);
      expect(PROPOSED_LIMITS.maxScore).toBe(2550);
      expect(PROPOSED_LIMITS.minDurationMs).toBe(10000);
      expect(PROPOSED_LIMITS.maxDurationMs).toBe(92000);
      expect(PROPOSED_LIMITS.base).toBe(600);
      expect(PROPOSED_LIMITS.maxPointsPerSec).toBe(190);
   });

   it("pins the chain and the any-hit bound as arithmetic", () => {
      expect(0.8 + 0.4 + 1.2).toBeCloseTo(2.4, 10);
      expect(2.4 + 0.65).toBeCloseTo(3.05, 10);
      expect(0.3 + 0.4 + 1.2).toBeCloseTo(1.9, 10);
      expect(3.05 + 1.9 * 4).toBeCloseTo(10.65, 10);
      expect(0.45 + 0.9 + 0.8 + 0.4).toBeCloseTo(2.55, 10);
      expect(9 * 100 + 3 * 300 + 500 + 5 * 50).toBe(2550);
      expect(flightTime(6)).toBe(0.65); expect(flightTime(0)).toBe(0.65);
      expect(flightTime(14)).toBe(0.85); expect(flightTime(20)).toBe(0.85);
      expect(flightTime(10)).toBeCloseTo(0.75, 10);
      expect(dodgeDelay(0)).toBe(0.35); expect(dodgeDelay(30)).toBe(0.27); expect(dodgeDelay(60)).toBe(0.2);
      expect(runScore(9, 3, true, 0)).toBe(2550);
      expect(runScore(2, 0, false, 5)).toBe(200);
      for (let i = 0; i < EARLIEST.length; i++) {
         const ms = Math.round(EARLIEST[i].t * 1000);
         const allowed = (PROPOSED_LIMITS.base * 1000 + PROPOSED_LIMITS.maxPointsPerSec * ms) / 1000;
         expect(earliestScore(EARLIEST[i].t)).toBe(EARLIEST[i].score);
         expect(EARLIEST[i].score).toBeLessThanOrEqual(allowed);
         expect(EARLIEST[i].score).toBeLessThanOrEqual(PROPOSED_LIMITS.maxScore);
      }
      expect(withinServerLimits(2550, 10900, PROPOSED_LIMITS)).toBe(true);
      expect(withinServerLimits(2550, 10000, PROPOSED_LIMITS)).toBe(false);
      expect(capScore(2550, 10900, PROPOSED_LIMITS)).toBe(2550);
      expect(capScore(1200, 6700, PROPOSED_LIMITS)).toBe(1200);
   });
});

describe("snowballs", () => {
   it("pockets a small ball only inside the hold window and stops at 3", () => {
      const cancel = createRun(1, false);
      stepRun(cancel, 0.49, hold(true));
      stepRun(cancel, 1 / 120, hold(false));
      expect(cancel.kids[0].ammo).toBe(0);
      const small = createRun(1, false);
      stepRun(small, 0.5, hold(true));
      stepRun(small, 1 / 120, hold(false));
      expect(small.kids[0].ammo).toBe(1);
      const late = createRun(1, false);
      stepRun(late, 1.49, hold(true));
      stepRun(late, 1 / 120, hold(false));
      expect(late.kids[0].ammo).toBe(1);
      expect(late.balls.some((ball) => ball.roller)).toBe(false);
      const big = createRun(1, false);
      stepRun(big, 1.5, hold(true));
      stepRun(big, 1 / 120, hold(false));
      expect(big.kids[0].ammo).toBe(0);
      expect(big.balls.some((ball) => ball.alive && ball.roller)).toBe(true);
      const full = createRun(1, false);
      full.kids[0].ammo = 3;
      stepRun(full, 0.5, hold(true));
      stepRun(full, 1 / 120, hold(false));
      expect(full.kids[0].ammo).toBe(3);
   });

   it("throws only with ammo, a target and the gap, and a planted scoop cannot throw", () => {
      const run = createRun(3, false);
      openField(run);
      run.kids[0].x = 3; run.kids[0].z = 3; run.kids[0].yaw = Math.PI; run.kids[0].ammo = 1;
      run.kids[1].x = 3; run.kids[1].z = -1; run.kids[1].present = true; run.kids[1].alive = true;
      stepRun(run, 1 / 60, hold(true, true));
      expect(run.kids[0].ammo).toBe(1);
      expect(run.balls.some((ball) => ball.alive)).toBe(false);
      stepRun(run, 1 / 60, hold(false));
      const aimed = createRun(3, false);
      openField(aimed);
      aimed.kids[0].x = 3; aimed.kids[0].z = 3; aimed.kids[0].yaw = Math.PI; aimed.kids[0].ammo = 2;
      aimed.kids[1].x = 3; aimed.kids[1].z = -1; aimed.kids[1].present = true; aimed.kids[1].alive = true;
      stepRun(aimed, 1 / 60, hold(false, true, 0));
      expect(aimed.kids[0].ammo).toBe(2);
      stepRun(aimed, 1 / 60, hold(false, true, Math.PI));
      expect(aimed.kids[0].ammo).toBe(1);
      stepRun(aimed, 0.39, hold(false, true, Math.PI));
      expect(aimed.kids[0].ammo).toBe(1);
      stepRun(aimed, 0.02, hold(false, true, Math.PI));
      expect(aimed.kids[0].ammo).toBe(0);
      const impact = (dt: number) => {
         const shot = createRun(3, false);
         openField(shot);
         shot.kids[0].x = 3; shot.kids[0].z = 3; shot.kids[0].ammo = 1; shot.kids[0].yaw = Math.PI;
         shot.kids[1].x = 3; shot.kids[1].z = -1; shot.kids[1].vx = 0; shot.kids[1].vz = 0;
         shot.kids[1].present = true; shot.kids[1].alive = true;
         stepRun(shot, dt, hold(false, true, Math.PI));
         const ball = shot.balls.find((item) => item.alive)!;
         return [ball.ix, ball.iz, ball.flight];
      };
      const at60 = impact(1 / 60);
      expect(impact(1 / 30)).toEqual(at60);
      expect(impact(1 / 144)).toEqual(at60);
      expect(at60[2]).toBeCloseTo(0.65, 6);
   });

   it("a coarse tap ignores the cone, still needs line of sight, and does not widen a rival ball", () => {
      const run = createRun(4, true);
      openField(run);
      run.kids[0].x = 3; run.kids[0].z = 3; run.kids[0].ammo = 1; run.kids[0].yaw = Math.PI;
      run.kids[1].x = 3; run.kids[1].z = 6; run.kids[1].present = true; run.kids[1].alive = true;
      stepRun(run, 1 / 60, hold(false, false, Math.PI, 1));
      expect(run.kids[0].ammo).toBe(0);
      const blocked = createRun(4, true);
      blocked.kids[0].ammo = 1;
      blocked.kids[0].x = blocked.forts[0].x;
      blocked.kids[0].z = blocked.forts[0].z + 2.4;
      blocked.kids[1].x = blocked.forts[0].x;
      blocked.kids[1].z = blocked.forts[0].z - 2.4;
      expect(lineOfSight(blocked.forts, blocked.kids[0].x, blocked.kids[0].z, blocked.kids[1].x, blocked.kids[1].z)).toBe(false);
      stepRun(blocked, 1 / 60, hold(false, false, 0, 1));
      expect(blocked.kids[0].ammo).toBe(1);
      expect(pickTap(10, 10, [{ id: 2, x: 90, y: 10, live: true }, { id: 1, x: 10, y: 40, live: true }])).toBe(1);
      expect(pickTap(0, 0, [{ id: 1, x: 80, y: 0, live: true }])).toBe(-1);
      const fine = graze(false);
      const coarse = graze(true);
      expect(fine).toBe(0);
      expect(coarse).toBe(1);
      const vsPlayer = createRun(5, true);
      openField(vsPlayer);
      vsPlayer.kids[0].x = 4.6; vsPlayer.kids[0].z = 0;
      const ball = vsPlayer.balls[0];
      ball.alive = true; ball.owner = 1; ball.roller = false; ball.r = 0.25;
      ball.x0 = 4; ball.y0 = 0.62; ball.z0 = 0; ball.vx = 0; ball.vy = 0; ball.vz = 0;
      ball.age = 0; ball.flight = 5; ball.x = 4; ball.y = 0.62; ball.z = 0;
      stepRun(vsPlayer, 1 / 120, ZERO);
      expect(vsPlayer.playerTags).toBe(0);
   });
});

function graze(coarse: boolean): number {
   const run = createRun(5, coarse);
   openField(run);
   const rival = run.kids[1];
   rival.x = 4; rival.z = 0; rival.vx = 0; rival.vz = 0;
   rival.present = true; rival.alive = true; rival.state = "recover"; rival.timer = 0.3; rival.immune = 0;
   const ball = run.balls[0];
   ball.alive = true; ball.owner = 0; ball.roller = false; ball.r = coarse ? THROW.coarseR : THROW.ballR;
   ball.x0 = 4.6; ball.y0 = 0.62; ball.z0 = 0; ball.vx = 0; ball.vy = 0; ball.vz = 0;
   ball.age = 0; ball.flight = 5; ball.x = ball.x0; ball.y = ball.y0; ball.z = ball.z0;
   stepRun(run, 1 / 120, ZERO);
   return run.hits;
}

describe("fight", () => {
   it("scores any hit, cancels a wind-up, and lets the player's ball win the same substep", () => {
      const run = createRun(6, false);
      openField(run);
      run.kids[0].x = 0; run.kids[0].z = 5; run.playerTags = 4;
      run.hits = 8; run.outs = 2; run.bank = 800 + 600;
      const last = run.kids[3];
      last.present = true; last.alive = true; last.tags = 2; last.state = "windup"; last.timer = 1; last.ammo = 1; last.immune = 0;
      last.x = 3; last.z = -2; last.vx = 0; last.vz = 0;
      const ours = run.balls[0];
      ours.alive = true; ours.owner = 0; ours.roller = false; ours.r = 0.25;
      ours.x0 = last.x; ours.y0 = 0.62; ours.z0 = last.z; ours.vx = 0; ours.vy = 0; ours.vz = 0;
      ours.age = 0; ours.flight = 5; ours.x = ours.x0; ours.y = ours.y0; ours.z = ours.z0;
      const theirs = run.balls[1];
      theirs.alive = true; theirs.owner = 1; theirs.roller = false; theirs.r = 0.25;
      theirs.x0 = 0; theirs.y0 = 0.62; theirs.z0 = 5; theirs.vx = 0; theirs.vy = 0; theirs.vz = 0;
      theirs.age = 0; theirs.flight = 5; theirs.x = 0; theirs.y = 0.62; theirs.z = 5;
      stepRun(run, 1 / 120, ZERO);
      expect(run.endReason).toBe("win");
      expect(run.playerTags).toBe(4);
      expect(run.score).toBe(runScore(9, 3, true, 4));
      expect(last.alive).toBe(false);
      expect(last.ammo).toBe(1);
   });

   it("a fifth tag loses, a time-up keeps the bank, and a fort volley flushes a camper", () => {
      const lose = createRun(6, false);
      openField(lose);
      lose.kids[0].x = 2; lose.kids[0].z = 2; lose.playerTags = 4; lose.bank = 100; lose.hits = 1;
      const ball = lose.balls[0];
      ball.alive = true; ball.owner = 2; ball.roller = false; ball.r = 0.25;
      ball.x0 = 2; ball.y0 = 0.62; ball.z0 = 2; ball.vx = 0; ball.vy = 0; ball.vz = 0;
      ball.age = 0; ball.flight = 5; ball.x = 2; ball.y = 0.62; ball.z = 2;
      stepRun(lose, 1 / 120, ZERO);
      expect(lose.endReason).toBe("lose");
      expect(lose.score).toBe(100);
      const time = createRun(7, false);
      for (let i = 1; i < 4; i++) { time.kids[i].present = false; time.kids[i].alive = false; }
      time.hits = 1; time.bank = 100; time.time = 89.5;
      stepRun(time, 0.6, ZERO);
      expect(time.endReason).toBe("timeup");
      expect(time.score).toBe(100);
      const camp = createRun(8, false);
      const fort = camp.forts[0];
      camp.kids[0].x = fort.x + 1.35; camp.kids[0].z = fort.z;
      stepRun(camp, 6.05, ZERO);
      expect(fort.hp).toBe(2);
   });

   it("keeps relocate, knockdown, the sneaker and a crumbled fort on their clocks", () => {
      const run = createRun(9, false);
      const rival = run.kids[1];
      rival.state = "relocate"; rival.timer = 0; rival.destX = rival.x; rival.destZ = rival.z;
      stepRun(run, 0.89, ZERO);
      expect(rival.state).toBe("relocate");
      stepRun(run, 0.02, ZERO);
      expect(rival.state).toBe("cover");
      const down = createRun(9, false);
      openField(down);
      const knocked = down.kids[1];
      knocked.x = 4; knocked.z = 4; knocked.state = "knockdown"; knocked.timer = 1.5; knocked.immune = 1.5; knocked.openT = 0;
      stepRun(down, 1, ZERO);
      expect(knocked.openT).toBe(0);
      expect(knocked.state).toBe("knockdown");
      const wind = createRun(9, false);
      openField(wind);
      wind.kids[1].x = 4; wind.kids[1].z = 4; wind.kids[1].state = "windup"; wind.kids[1].timer = 1.2; wind.kids[1].ammo = 1;
      stepRun(wind, 0.5, ZERO);
      expect(wind.kids[1].state).toBe("windup");
      const sneak = createRun(9, false);
      stepRun(sneak, 9.99, ZERO);
      expect(sneak.kids[3].present).toBe(false);
      stepRun(sneak, 0.02, ZERO);
      expect(sneak.kids[3].present).toBe(true);
      expect(sneak.kids[3].ammo).toBe(1);
      const rubble = createRun(10, false);
      rubble.forts[0].hp = 0;
      const before = rubble.kids[0].x;
      rubble.kids[0].x = rubble.forts[0].x; rubble.kids[0].z = rubble.forts[0].z;
      stepRun(rubble, 1 / 60, { ...ZERO, moveX: 1, moveY: 0 });
      expect(rubble.kids[0].x).not.toBe(before);
      const dead = rubble.forts[0];
      expect(lineOfSight([dead], dead.x - 3, dead.z, dead.x + 3, dead.z)).toBe(true);
      expect(lineOfSight([{ x: dead.x, z: dead.z, hp: 3 }], dead.x - 3, dead.z, dead.x + 3, dead.z)).toBe(false);
   });
});

function play(seed: number, coarse: boolean, brain: (run: Run) => StepInput, frame: () => number) {
   const store = createArcadeStore();
   const run = createRun(seed, coarse);
   let breach = 0;
   simulateRun(store, {
      frame,
      step: (dt) => {
         stepRun(run, dt, brain(run));
         const state = store.getState();
         if (run.scoreDelta) state.addScore(run.scoreDelta);
         const shown = run.endReason ? run.score : run.bank;
         const allowed = (PROPOSED_LIMITS.base * 1000 + PROPOSED_LIMITS.maxPointsPerSec * Math.round(state.elapsedMs)) / 1000;
         if (shown > allowed) breach = Math.max(breach, shown - allowed);
         if (run.endReason) {
            state.setScore(run.score);
            state.end(run.endReason);
         }
      },
   });
   const state = store.getState();
   return { run, state, breach };
}

function legal(result: ReturnType<typeof play>): void {
   expect(result.breach).toBe(0);
   expect(result.state.score).toBeLessThanOrEqual(2550);
   expect(withinServerLimits(result.state.score, result.state.elapsedMs, PROPOSED_LIMITS)).toBe(true);
   expect(capScore(result.state.score, result.state.elapsedMs, PROPOSED_LIMITS)).toBe(result.state.score);
}

describe("bots", () => {
   it("the oracle reaches 2550 and wins at least 10 of 16 seeds", () => {
      let best = 0;
      let wins = 0;
      for (let seed = 1; seed <= 16; seed++) {
         const result = play(seed, false, oracle(), fixedFrames(1000 / 60));
         legal(result);
         best = Math.max(best, result.state.score);
         if (result.run.endReason !== "win") continue;
         wins += 1;
         expect(result.state.score).toBe(runScore(result.run.hits, result.run.outs, true, result.run.playerTags));
         expect(result.run.time).toBeGreaterThanOrEqual(10.8);
      }
      expect(best).toBe(2550);
      expect(wins).toBeGreaterThanOrEqual(10);
   }, 120000);

   it("spam, idle, camper and spinner stay inside the line and do not win", () => {
      for (let seed = 1; seed <= 2; seed++) {
         const spam = play(seed, false, spammerInput, fixedFrames(1000 / 60));
         legal(spam);
         expect(spam.state.score).toBeLessThan(1800);
         expect(spam.run.endReason).not.toBe("win");
         for (const brain of [idleInput, camperInput, spinnerInput]) {
            const result = play(seed, false, brain, fixedFrames(1000 / 60));
            legal(result);
            expect(result.state.score).toBe(0);
            expect(result.run.endReason).not.toBe("win");
         }
      }
   }, 180000);

   it("frame-rate splits stay inside the line", () => {
      const frames = [fixedFrames(1000 / 30), fixedFrames(1000 / 60), fixedFrames(1000 / 144), randomFrames(7)];
      for (let seed = 1; seed <= 1; seed++) {
         for (let f = 0; f < frames.length; f++) {
            legal(play(seed, false, oracle(), frames[f]));
            legal(play(seed, false, spammerInput, frames[f]));
            legal(play(seed, false, idleInput, frames[f]));
         }
      }
   }, 180000);

   it("the witness wins on keyboard and on touch", () => {
      for (let seed = 1; seed <= 2; seed++) {
         for (const coarse of [false, true]) {
            const result = play(seed, coarse, witness(coarse), fixedFrames(1000 / 60));
            legal(result);
            expect(result.run.endReason, `${seed} coarse=${coarse}`).toBe("win");
            expect(result.run.time).toBeLessThanOrEqual(85);
            expect(SCORE.healthMax - result.run.playerTags).toBeGreaterThanOrEqual(1);
         }
      }
   }, 180000);

   it("an exposed player is not tagged before the loss chain", () => {
      const run = createRun(11, false);
      exposePlayer(run);
      const input = idleInput(run);
      while (!run.endReason && run.time < 25) stepRun(run, 1 / 60, input);
      expect(run.playerTags).toBeGreaterThanOrEqual(5);
      expect(run.time).toBeGreaterThanOrEqual(10.5);
   });
});
