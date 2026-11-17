import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   DEBRIS_HALF,
   EXIT_AT,
   HOP_S,
   LIVES,
   RADIUS,
   SPRAY_FIRE_S,
   SPRAY_RANGE,
   SPRAY_TALK_S,
   STUN_S,
   TIME_BONUS_PER_SECOND,
   createRun,
   debrisPose,
   doorClosed,
   doorPoint,
   idleInput,
   nearestFreePoint,
   objectivesReachable,
   reachWith,
   roomOf,
   step,
   timeBonus,
   PROPOSED_LEVEL_LIMITS,
   type FireInput,
   type Run,
} from "./rules";

type Style = "oracle" | "human" | "idle" | "spam";

function route(run: Run, x: number, z: number, room: number): number {
   const here = roomOf(run.level, run.hero.x, run.hero.z);
   if (room >= 0 && doorClosed(run, room) && here !== room) return Infinity;
   let d = 0;
   let x0 = run.hero.x;
   let z0 = run.hero.z;
   if (room >= 0 && here !== room) {
      const door = doorPoint(run.level, room);
      d += Math.hypot(door.x - x0, door.z - z0);
      x0 = door.x;
      z0 = door.z;
   } else if (here >= 0 && room < 0) {
      const door = doorPoint(run.level, here);
      d += Math.hypot(door.x - x0, door.z - z0);
      x0 = door.x;
      z0 = door.z;
   }
   return d + Math.hypot(x - x0, z - z0);
}

function goal(run: Run): { x: number; z: number; room: number } | null {
   if (run.follower >= 0) return { x: EXIT_AT.x, z: EXIT_AT.z, room: -1 };
   let best: { x: number; z: number; room: number; d: number } | null = null;
   const consider = (x: number, z: number, room: number) => {
      const d = route(run, x, z, room);
      if (!best || d < best.d) best = { x, z, room, d };
   };
   for (const fire of run.fires) if (!fire.out) consider(fire.x, fire.z, fire.door ? -1 : fire.room);
   if (best) return best;
   for (const civ of run.civilians) if (!civ.saved) consider(civ.x, civ.z, civ.room);
   return best;
}

function via(run: Run, at: { x: number; z: number; room: number }): { x: number; z: number } {
   const here = roomOf(run.level, run.hero.x, run.hero.z);
   // Leave the room through its own door. Aiming at the next door cuts the wall.
   if (here >= 0 && here !== at.room) return doorPoint(run.level, here);
   if (at.room >= 0 && here !== at.room) {
      const door = doorPoint(run.level, at.room);
      if (Math.hypot(run.hero.x - door.x, run.hero.z - door.z) > 0.55) return door;
   }
   return at;
}

function nearestSpray(run: Run): number {
   let best = Infinity;
   for (const fire of run.fires) {
      if (fire.out) continue;
      best = Math.min(best, Math.hypot(fire.x - run.hero.x, fire.z - run.hero.z));
   }
   if (run.follower < 0) {
      for (const civ of run.civilians) {
         if (civ.saved) continue;
         best = Math.min(best, Math.hypot(civ.x - run.hero.x, civ.z - run.hero.z));
      }
   }
   return best;
}

const DEBRIS_BODY = DEBRIS_HALF.x + RADIUS + 0.05;

/** Parked boxes sit at the hall edge. Pass on the open side instead of clipping them. */
function debrisLane(run: Run): number | null {
   let best: { dz: number; x: number } | null = null;
   for (const debris of run.debris) {
      const pose = debrisPose(debris.phase);
      if (pose.moving) continue;
      const dz = Math.abs(run.hero.z - debris.z);
      if (dz > 1.7) continue;
      const open = pose.x >= 0 ? -0.72 : 0.72;
      if (!best || dz < best.dz) best = { dz, x: open };
   }
   return best ? best.x : null;
}

/** Hop as a moving box enters the hero's slice. One 0.40 s arc covers a full-speed crossing. */
function debrisHop(run: Run): boolean {
   if (run.hero.hop > 0) return false;
   for (const debris of run.debris) {
      const pose = debrisPose(debris.phase);
      if (!pose.moving) continue;
      const dz = Math.abs(run.hero.z - debris.z);
      const dx = Math.abs(run.hero.x - pose.x);
      if (dz < 0.95 && dx < DEBRIS_BODY + 0.35) return true;
   }
   return false;
}

interface Memory { wait: number; still: number; threat: boolean; side: number }

function drive(run: Run, input: FireInput, dt: number, style: Style, rng: () => number, mem: Memory): void {
   input.moveX = 0;
   input.moveY = 0;
   input.action = false;
   input.jumpPressed = false;
   input.yaw = 0;
   if (style === "idle" || run.over) return;
   if (style === "spam") {
      input.moveX = rng() * 2 - 1;
      input.moveY = rng() * 2 - 1;
      input.action = rng() > 0.35;
      input.jumpPressed = rng() > 0.85;
      return;
   }
   const at = goal(run);
   if (!at) return;
   const point = via(run, at);
   const lane = debrisLane(run);
   if (lane !== null) point.x = lane;
   const dx = point.x - run.hero.x;
   const dz = point.z - run.hero.z;
   const len = Math.hypot(dx, dz) || 1;
   const stick = style === "human" ? 0.9 : 1;
   input.moveX = (dx / len) * stick;
   input.moveY = (dz / len) * stick;
   const spray = nearestSpray(run);
   if (spray <= SPRAY_RANGE) {
      mem.wait += dt;
      input.action = style === "oracle" || mem.wait >= 0.18;
      if (spray < 0.85) {
         input.moveX = 0;
         input.moveY = 0;
      }
   } else mem.wait = 0;
   const speed = Math.hypot(run.hero.vx, run.hero.vz);
   if (speed < 0.12 && spray > SPRAY_RANGE) mem.still += dt;
   else mem.still = 0;
   if (mem.still > 0.45) {
      input.moveX = mem.side;
      input.moveY = 0.35 * mem.side;
      if (mem.still > 0.7) mem.side = -mem.side;
   }
   const hop = debrisHop(run);
   if (hop) mem.still = 0;
   input.jumpPressed = hop;
   mem.threat = hop;
}

function play(id: LevelId, seed: number, hz: number, style: Style) {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const store = createArcadeStore();
   store.getState().configure({ durationMs: level.durationMs, lives: LIVES, resultDelayMs: 900 });
   store.getState().markReady();
   store.getState().start();
   const input = idleInput();
   const mem: Memory = { wait: 0, still: 0, threat: false, side: 1 };
   const rng = createRng((seed + 1) * 10007 + id * 17 + (style === "spam" ? 3 : 0));
   const cap = Math.ceil((level.durationMs / 1000 + 4) * hz);
   for (let i = 0; i < cap; i++) {
      advanceRunClock(store, 1 / hz);
      const state = store.getState();
      if (state.phase === "over") break;
      const dt = playedFrameDt(state);
      if (!dt) continue;
      drive(run, input, dt, style, rng, mem);
      const before = run.score;
      const ev = step(run, input, dt, state.timeLeftMs ?? 0);
      if (ev.score) state.addScore(ev.score);
      if (run.score !== before + ev.score) throw new Error("score delta");
      if (ev.lifeLost) state.loseLife();
      if (ev.won) state.end("win");
      if (run.over) break;
   }
   const final = store.getState();
   return { run, score: final.score, ms: final.elapsedMs, reason: final.endReason ?? run.over };
}

describe("firefighter layout", () => {
   it("is the same run for the same seed and reaches every objective", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 40; seed++) {
            const a = createRun(seed, LEVELS[id]);
            const b = createRun(seed, LEVELS[id]);
            expect(objectivesReachable(a)).toBe(true);
            expect(a.fires.map((f) => [f.x, f.z, f.door])).toEqual(b.fires.map((f) => [f.x, f.z, f.door]));
            expect(a.civilians.map((c) => [c.x, c.z])).toEqual(b.civilians.map((c) => [c.x, c.z]));
            expect(a.fires).toHaveLength(LEVELS[id].fires);
            expect(a.civilians).toHaveLength(LEVELS[id].civilians);
            expect(a.debris).toHaveLength(LEVELS[id].debris);
         }
      }
   });

   it("keeps a blocked door shut in the fill until that fire is out", () => {
      const run = createRun(4, LEVELS[2]);
      const door = run.fires.findIndex((fire) => fire.door);
      expect(door).toBeGreaterThanOrEqual(0);
      const room = run.fires[door].room;
      const civ = run.civilians.findIndex((c) => c.room === room);
      expect(civ).toBeGreaterThanOrEqual(0);
      const shut = reachWith(run, run.fires.map(() => false));
      expect(shut.fires[door]).toBe(true);
      expect(shut.civilians[civ]).toBe(false);
      expect(doorClosed(run, room)).toBe(true);
      const gone = run.fires.map(() => false);
      gone[door] = true;
      expect(doorClosed(run, room, gone)).toBe(false);
      expect(reachWith(run, gone).civilians[civ]).toBe(true);
   });
});

describe("firefighter spray, breath, hop and follow", () => {
   it("resets the spray when action is released, on keyboard and on touch", () => {
      const fireAt = (label: string) => {
         const run = createRun(2, LEVELS[1]);
         const fire = run.fires[0];
         run.hero.x = fire.x;
         run.hero.z = fire.z + 0.5;
         const input = idleInput();
         input.action = true;
         let held = 0;
         for (let i = 0; i < 24; i++) {
            step(run, input, 1 / 60, 120_000);
            held += 1 / 60;
         }
         expect(held).toBeLessThan(SPRAY_FIRE_S);
         expect(run.fires[0].out).toBe(false);
         expect(run.holdTime).toBeGreaterThan(0.3);
         input.action = false;
         step(run, input, 1 / 60, 120_000);
         expect(run.holdTime).toBe(0);
         input.action = true;
         let until = 0;
         while (!run.fires[0].out && until < 2) {
            step(run, input, 1 / 60, 120_000);
            until += 1 / 60;
         }
         expect(run.fires[0].out).toBe(true);
         expect(until).toBeGreaterThanOrEqual(SPRAY_FIRE_S - 1 / 60);
         expect(until).toBeLessThan(SPRAY_FIRE_S + 1 / 30);
         return until;
      };
      expect(fireAt("keyboard")).toBeCloseTo(fireAt("touch"), 5);
   });

   it("talks in 0.30 s and ignores a second neighbour while someone follows", () => {
      const run = createRun(1, LEVELS[5]);
      const civ = run.civilians[0];
      run.hero.x = civ.x;
      run.hero.z = civ.z + 0.4;
      const input = idleInput();
      input.action = true;
      let t = 0;
      while (run.follower < 0 && t < 1) {
         step(run, input, 1 / 60, 210_000);
         t += 1 / 60;
      }
      expect(t).toBeGreaterThanOrEqual(SPRAY_TALK_S - 1 / 60);
      expect(t).toBeLessThan(SPRAY_TALK_S + 1 / 30);
      expect(run.follower).toBe(0);
      const other = run.civilians[1];
      run.hero.x = other.x;
      run.hero.z = other.z;
      for (let i = 0; i < 40; i++) step(run, input, 1 / 60, 210_000);
      expect(run.follower).toBe(0);
      expect(other.following).toBe(false);
   });

   it("breath hitting 0 snaps only the follower home and spends their clean bonus", () => {
      const run = createRun(6, LEVELS[2]);
      const disc = run.smoke[0];
      const lead = run.civilians[0];
      const other = run.civilians[1];
      lead.following = true;
      run.follower = 0;
      run.hero.x = disc.x;
      run.hero.z = disc.z;
      lead.x = disc.x + 0.2;
      lead.z = disc.z;
      const homeX = lead.homeX;
      const homeZ = lead.homeZ;
      const input = idleInput();
      let guard = 0;
      while (!run.ev.breathBreak && guard++ < 400) step(run, input, 1 / 30, 150_000);
      expect(run.ev.breathBreak).toBe(true);
      expect(run.lives).toBe(LIVES - 1);
      expect(run.hero.breath).toBe(1);
      expect(lead.following).toBe(false);
      expect(lead.clean).toBe(false);
      expect(lead.x).toBe(homeX);
      expect(lead.z).toBe(homeZ);
      expect(other.clean).toBe(true);
      expect(other.x).toBe(other.homeX);
      expect(run.follower).toBe(-1);
   });

   it("debris during a hop spends no life, and a hit outside the hop stuns for 0.50 s", () => {
      const hopped = createRun(1, LEVELS[4]);
      const debris = hopped.debris[0];
      const pose = debrisPose(debris.phase);
      hopped.hero.x = pose.x;
      hopped.hero.z = debris.z;
      hopped.hero.hop = HOP_S;
      step(hopped, idleInput(), 1 / 60, 180_000);
      expect(hopped.lives).toBe(LIVES);
      expect(hopped.ev.debris).toBe(false);

      const hit = createRun(1, LEVELS[4]);
      const box = hit.debris[0];
      const at = debrisPose(box.phase);
      hit.hero.x = at.x;
      hit.hero.z = box.z;
      hit.hero.hop = 0;
      step(hit, idleInput(), 1 / 60, 180_000);
      expect(hit.lives).toBe(LIVES - 1);
      expect(hit.hero.stun).toBe(STUN_S);
      expect(hit.ev.debris).toBe(true);
   });

   it("places a follower stuck behind a sofa on the free point toward the hero", () => {
      const run = createRun(3, LEVELS[1]);
      run.hero.x = 0;
      run.hero.z = 8;
      run.hero.vx = 0;
      run.hero.vz = 0;
      const civ = run.civilians[0];
      civ.following = true;
      civ.x = 0;
      civ.z = 2;
      civ.vx = 0;
      civ.vz = 0;
      run.follower = 0;
      run.solids.push({
         box: { min: { x: -1.3, y: 0, z: 4.3 }, max: { x: 1.3, y: 1.2, z: 5.5 } },
         on: true,
         room: -1,
      });
      const point = { x: 0, z: 0 };
      expect(nearestFreePoint(run, civ.x, civ.z, run.hero.x, run.hero.z, point)).toBe(true);
      expect(point.z).toBeGreaterThan(5.5);
      const input = idleInput();
      for (let i = 0; i < 160; i++) step(run, input, 1 / 60, 120_000);
      expect(civ.z).toBeGreaterThan(5.5);
      expect(Math.hypot(civ.x - run.hero.x, civ.z - run.hero.z)).toBeLessThan(Math.hypot(0 - run.hero.x, 2 - run.hero.z));
   });
});

describe("firefighter score limits", () => {
   it("time bonus is 6 per full second left and only the win adds it", () => {
      expect(timeBonus(120_000)).toBe(TIME_BONUS_PER_SECOND * 120);
      expect(timeBonus(119_999)).toBe(TIME_BONUS_PER_SECOND * 119);
      expect(timeBonus(0)).toBe(0);
   });

   it("an honest bot, an idle bot and a spam bot stay inside each level's limits", () => {
      for (const id of LEVEL_IDS) {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         let best = 0;
         let bestMs = Infinity;
         let wins = 0;
         for (let seed = 0; seed < 12; seed++) {
            for (const hz of [30, 60]) {
               const oracle = play(id, seed, hz, "oracle");
               expect(withinServerLimits(oracle.score, oracle.ms, limits)).toBe(true);
               expect(oracle.score).toBe(oracle.run.score);
               if (oracle.reason === "win") {
                  wins += 1;
                  if (oracle.score > best) {
                     best = oracle.score;
                     bestMs = oracle.ms;
                  }
               }
            }
            const human = play(id, seed, 30, "human");
            expect(withinServerLimits(human.score, human.ms, limits)).toBe(true);
            const idle = play(id, seed, 20, "idle");
            expect(idle.score).toBe(0);
            expect(idle.reason).not.toBe("win");
            expect(withinServerLimits(idle.score, idle.ms, limits)).toBe(true);
            const spam = play(id, seed, 30, "spam");
            expect(spam.score).toBe(spam.run.score);
            expect(withinServerLimits(spam.score, spam.ms, limits)).toBe(true);
         }
         const fast = play(id, 1, 144, "oracle");
         expect(withinServerLimits(fast.score, fast.ms, limits)).toBe(true);
         console.log(`L${id} oracle wins ${wins}/24 best ${best} at ${bestMs} ms (max ${limits.maxScore})`);
         expect(wins).toBeGreaterThan(0);
         expect(best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
      }
   }, 180_000);
});
