import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   CALM_POINTS,
   CLOSE_POINTS,
   CLOSE_R,
   DROP_POINTS,
   DWELL_S,
   LIVES,
   PAD_R,
   PROPOSED_LEVEL_LIMITS,
   STOP_SPEED,
   STRIKE,
   TIME_POINTS,
   TOP_SPEED,
   activePad,
   carsClearBuildings,
   createRun,
   idleInput,
   lightIndexAt,
   padsReachable,
   signalRed,
   step,
   streetX,
   streetZ,
   type Run,
   type TaxiInput,
} from "./rules";

type Style = "oracle" | "human" | "idle" | "spam";

function wrap(angle: number): number {
   let value = angle;
   while (value > Math.PI) value -= Math.PI * 2;
   while (value < -Math.PI) value += Math.PI * 2;
   return value;
}

function clamp(value: number, min: number, max: number): number {
   return value < min ? min : value > max ? max : value;
}

function nearestStreet(run: Run): { x: number; z: number; d: number } {
   let best = { x: run.x, z: run.z, d: Infinity };
   for (let i = 0; i <= run.level.blocksX; i++) {
      const x = streetX(i);
      const d = Math.abs(run.x - x);
      if (d < best.d) best = { x, z: run.z, d };
   }
   for (let j = 0; j <= run.level.blocksZ; j++) {
      const z = streetZ(j);
      const d = Math.abs(run.z - z);
      if (d < best.d) best = { x: run.x, z, d };
   }
   best.x = Math.min(run.width - 2, Math.max(2, best.x));
   best.z = Math.min(run.depth - 2, Math.max(2, best.z));
   return best;
}

function closestNode(run: Run): { i: number; j: number } {
   let bi = 0;
   let bj = 0;
   let best = Infinity;
   for (let j = 0; j <= run.level.blocksZ; j++) {
      for (let i = 0; i <= run.level.blocksX; i++) {
         const d = (streetX(i) - run.x) ** 2 + (streetZ(j) - run.z) ** 2;
         if (d < best) {
            best = d;
            bi = i;
            bj = j;
         }
      }
   }
   return { i: bi, j: bj };
}

function bfs(run: Run, sx: number, sz: number, tx: number, tz: number): { i: number; j: number }[] {
   const w = run.level.blocksX + 1;
   const prev = new Int16Array(w * (run.level.blocksZ + 1)).fill(-1);
   const start = sz * w + sx;
   const goal = tz * w + tx;
   const queue = [start];
   prev[start] = -2;
   let qi = 0;
   while (qi < queue.length) {
      const k = queue[qi++];
      if (k === goal) break;
      const i = k % w;
      const j = (k / w) | 0;
      const tryNode = (ni: number, nj: number) => {
         if (ni < 0 || nj < 0 || ni > run.level.blocksX || nj > run.level.blocksZ) return;
         const nk = nj * w + ni;
         if (prev[nk] !== -1) return;
         prev[nk] = k;
         queue.push(nk);
      };
      tryNode(i + 1, j);
      tryNode(i - 1, j);
      tryNode(i, j + 1);
      tryNode(i, j - 1);
   }
   if (prev[goal] === -1) return [{ i: tx, j: tz }];
   const path: { i: number; j: number }[] = [];
   let k = goal;
   while (k !== -2) {
      path.push({ i: k % w, j: (k / w) | 0 });
      k = prev[k];
   }
   path.reverse();
   return path;
}

interface Memory { stuck: number; side: number }

const wait = { red: 0, block: 0 };

function drive(run: Run, input: TaxiInput, _dt: number, style: Style, rng: () => number, _mem: Memory): void {
   input.moveX = 0;
   input.moveY = 0;
   if (style === "idle" || run.over || run.phase === 2) return;
   if (style === "spam") {
      input.moveX = rng() > 0.5 ? 1 : -1;
      input.moveY = rng() > 0.45 ? -1 : 1;
      return;
   }
   const pad = activePad(run);
   if (!pad) return;
   const stick = style === "human" ? 0.85 : 1;
   const here = closestNode(run);
   const endA = { i: pad.i, j: pad.j0 };
   const endB = { i: pad.i, j: pad.j0 + 1 };
   const da = (streetX(endA.i) - run.x) ** 2 + (streetZ(endA.j) - run.z) ** 2;
   const db = (streetX(endB.i) - run.x) ** 2 + (streetZ(endB.j) - run.z) ** 2;
   const goal = da <= db ? endA : endB;
   const path = bfs(run, here.i, here.j, goal.i, goal.j);
   let gate = path.length > 1 ? path[1] : path[0];
   const gateDist = Math.hypot(streetX(gate.i) - run.x, streetZ(gate.j) - run.z);
   if (path.length > 2 && gateDist < 1.8) gate = path[2];
   const distPad = Math.hypot(pad.x - run.x, pad.z - run.z);
   const onPadStreet = Math.abs(run.x - pad.x) < 1.35;
   const line = nearestStreet(run);
   const recover = line.d > 1.15;
   let tx = streetX(gate.i);
   let tz = streetZ(gate.j);
   const aimPad = !recover && onPadStreet && distPad < 16;
   if (recover) {
      tx = line.x;
      tz = line.z;
   } else if (aimPad) {
      tx = pad.x;
      tz = pad.z;
   }
   const dx = tx - run.x;
   const dz = tz - run.z;
   const heading = Math.atan2(dx, dz);
   let err = wrap(heading - run.yaw);
   if (aimPad && distPad <= 0.8 && Math.abs(run.speed) < STOP_SPEED + 0.1) {
      if (run.speed > 0.06) input.moveY = stick;
      else if (run.speed < -0.06) input.moveY = -stick;
      return;
   }
   const fx = Math.sin(run.yaw);
   const fz = Math.cos(run.yaw);
   let blocked = false;
   let dodgeX = tx;
   let dodgeZ = tz;
   let dodge = false;
   const pace = run.level.trafficSpeed;
   for (let i = 0; i < run.cars.length; i++) {
      const car = run.cars[i];
      if (car.pin) continue;
      const along = (car.x - run.x) * fx + (car.z - run.z) * fz;
      const side = Math.abs((car.x - run.x) * fz - (car.z - run.z) * fx);
      const dist = Math.hypot(car.x - run.x, car.z - run.z);
      const inLane = (car.axis === 1 && Math.abs(car.x - run.x) < 2.2) || (car.axis === 0 && Math.abs(car.z - run.z) < 2.2);
      if (!aimPad && inLane && dist < 8 && along > -2) {
         const inward = car.axis === 1 ? (car.x < run.width * 0.5 ? 1 : -1) : (car.z < run.depth * 0.5 ? 1 : -1);
         dodgeX = car.axis === 1 ? car.x + inward * 2.05 : run.x;
         dodgeZ = car.axis === 0 ? car.z + inward * 2.05 : run.z;
         dodgeX = Math.min(run.width - 2.4, Math.max(2.4, dodgeX));
         dodgeZ = Math.min(run.depth - 2.4, Math.max(2.4, dodgeZ));
         dodge = true;
      }
      void pace;
      void along;
      void side;
   }
   if (dodge) {
      tx = dodgeX;
      tz = dodgeZ;
      blocked = false;
      err = wrap(Math.atan2(tx - run.x, tz - run.z) - run.yaw);
   }
   let redHold = false;
   {
      for (let i = 0; i < run.stops.length; i++) {
         const stop = run.stops[i];
         const ahead = stop.axis === 1 ? (stop.coord - run.z) * stop.into : (stop.coord - run.x) * stop.into;
         if (!signalRed(stop.light, run.time + 0.35, stop.ns)) continue;
         if (ahead < 0.5 || ahead > 6.2) continue;
         const span = stop.axis === 1 ? run.x : run.z;
         if (span < stop.span0 - 0.5 || span > stop.span1 + 0.5) continue;
         const toward = stop.axis === 1 ? fz * stop.into : fx * stop.into;
         if (toward < 0.35) continue;
         redHold = true;
         break;
      }
   }
   const alongStreet = Math.hypot(dx, dz);
   let want = Math.abs(err) > 1.05 ? 2.4 : TOP_SPEED;
   if (recover) want = Math.min(want, 2.2);
   if (!aimPad && !recover && alongStreet < 6.5) want = Math.min(want, 2.4);
   if (dodge) want = Math.min(want, 2.4);
   if (blocked || redHold) want = 0;
   if (aimPad && distPad < 6) {
      if (distPad < 0.72) want = 0;
      else if (distPad < 2.2) want = Math.min(want, 1.25);
      else want = Math.min(want, 4);
   }
   input.moveX = clamp(err / 0.55, -1, 1) * stick;
   if (Math.abs(err) < 0.07) input.moveX = 0;
   if (run.speed > want + 0.25) input.moveY = stick;
   else if (run.speed < want - 0.16 && !(blocked || redHold)) input.moveY = -stick;
   if (redHold) wait.red += _dt;
   if (blocked) wait.block += _dt;
}

function play(id: LevelId, seed: number, hz: number, style: Style) {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const store = createArcadeStore();
   store.getState().configure({ durationMs: level.durationMs, lives: LIVES, resultDelayMs: 900 });
   store.getState().markReady();
   store.getState().start();
   const input = idleInput();
   const mem: Memory = { stuck: 0, side: 1 };
   const rng = createRng((seed + 1) * 10007 + id * 17 + (style === "spam" ? 3 : 0));
   const cap = Math.ceil((level.durationMs / 1000 + 4) * hz);
   let slow = 0;
   let hits = 0;
   let reds = 0;
   let misses = 0;
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
      for (let n = 0; n < ev.lives; n++) state.loseLife();
      if (ev.won) state.end("win");
      state.setStat("rides", run.dropoffs);
      state.setStat("fare", Math.round(Math.max(0, run.patience) * 100));
      if (ev.hit) hits += 1;
      if (ev.red) reds += 1;
      if (ev.miss) misses += 1;
      if (Math.abs(run.speed) < 0.6) slow += dt;
      if (run.over) break;
   }
   const state = store.getState();
   return { score: state.score, ms: state.elapsedMs, reason: state.endReason, run, slow, hits, reds, misses };
}

function hold(run: Run, seconds: number, timeLeft: number) {
   const n = Math.max(1, Math.round(seconds * 60));
   let ev = step(run, idleInput(), 1 / 60, timeLeft);
   for (let i = 1; i < n; i++) ev = step(run, idleInput(), 1 / 60, timeLeft);
   return ev;
}

describe("taxi layout", () => {
   it("is the same run for the same seed, and every fare is on a reachable centreline", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 1; seed <= 200; seed++) {
            const a = createRun(seed, LEVELS[id]);
            const b = createRun(seed, LEVELS[id]);
            expect(a.pads.map((pad) => [pad.x, pad.z])).toEqual(b.pads.map((pad) => [pad.x, pad.z]));
            expect(a.fares).toEqual(b.fares);
            expect(padsReachable(a)).toBe(true);
            expect(carsClearBuildings(a)).toBe(true);
            expect(a.fares.length).toBe(LEVELS[id].rides);
            expect(a.lights.length).toBe(LEVELS[id].lights);
            expect(a.cars.length).toBe(LEVELS[id].traffic);
         }
      }
   });
});

describe("taxi pads, patience and lights", () => {
   it("completes a stop after 0.50 s under 0.5 m/s, and the same window on a full stick", () => {
      const run = createRun(3, LEVELS[1]);
      const pad = activePad(run)!;
      run.x = pad.x;
      run.z = pad.z;
      run.speed = 0.4;
      const early = hold(run, DWELL_S - 1 / 60, 100_000);
      expect(early.pickup).toBe(false);
      const done = step(run, idleInput(), 1 / 30, 100_000);
      expect(done.pickup).toBe(true);
      const touch = createRun(3, LEVELS[1]);
      const key = createRun(3, LEVELS[1]);
      const stick = { moveX: 0.4, moveY: -1 };
      for (let i = 0; i < 90; i++) {
         step(touch, stick, 1 / 60, 100_000);
         step(key, stick, 1 / 60, 100_000);
      }
      expect(touch.x).toBeCloseTo(key.x, 6);
      expect(touch.z).toBeCloseTo(key.z, 6);
      expect(touch.score).toBe(key.score);
      expect(touch.speed).toBeCloseTo(key.speed, 6);
   });

   it("scores a drop-off, the close bonus and the calm bonus, and skips a bonus that was missed", () => {
      const run = createRun(4, LEVELS[1]);
      const timeLeft = 90_000;
      const pickup = activePad(run)!;
      run.x = pickup.x;
      run.z = pickup.z;
      run.speed = 0;
      run.dwell = DWELL_S - 1 / 120;
      expect(step(run, idleInput(), 1 / 60, timeLeft).pickup).toBe(true);
      const drop = activePad(run)!;
      run.x = drop.x + 1.8;
      run.z = drop.z;
      run.speed = 0;
      run.patience = 0.4;
      run.dwell = DWELL_S - 1 / 120;
      expect(Math.hypot(1.8, 0)).toBeGreaterThan(CLOSE_R);
      expect(Math.hypot(1.8, 0)).toBeLessThan(PAD_R);
      const wide = step(run, idleInput(), 1 / 60, timeLeft);
      expect(wide.drop).toBe(true);
      expect(wide.close).toBe(false);
      expect(wide.calm).toBe(false);
      expect(wide.score).toBe(DROP_POINTS);
      const next = activePad(run)!;
      run.x = next.x;
      run.z = next.z;
      run.speed = 0;
      run.dwell = DWELL_S - 1 / 120;
      step(run, idleInput(), 1 / 60, timeLeft);
      const dest = activePad(run)!;
      run.x = dest.x;
      run.z = dest.z;
      run.speed = 0;
      run.patience = 0.8;
      run.dwell = DWELL_S - 1 / 120;
      const close = step(run, idleInput(), 1 / 60, timeLeft);
      expect(close.score).toBe(DROP_POINTS + CLOSE_POINTS + CALM_POINTS);
   });

   it("adds the time bonus only on the winning drop-off", () => {
      const run = createRun(5, LEVELS[1]);
      const timeLeft = 85_000;
      for (let i = 0; i < LEVELS[1].rides; i++) {
         const pad = activePad(run)!;
         run.x = pad.x;
         run.z = pad.z;
         run.speed = 0;
         run.patience = 1;
         run.dwell = DWELL_S - 1 / 120;
         const ev = step(run, idleInput(), 1 / 60, timeLeft);
         if (i < LEVELS[1].rides - 1) expect(ev.won).toBe(false);
         if (ev.pickup) i--;
      }
      expect(run.over).toBe("win");
      expect(run.dropoffs).toBe(3);
      expect(run.fares.length).toBe(3);
      expect(activePad(run)).toBeNull();
      const bonus = TIME_POINTS * Math.floor(timeLeft / 1000);
      expect(run.score).toBe(3 * (DROP_POINTS + CLOSE_POINTS + CALM_POINTS) + bonus);
      const after = run.fares.length;
      step(run, idleInput(), 1 / 60, timeLeft);
      expect(run.fares.length).toBe(after);
      expect(run.dropoffs).toBe(3);
   });

   it("spends patience once per fare and does not open a fare past the quota", () => {
      const run = createRun(6, LEVELS[1]);
      run.patience = 0.00001;
      const ev = step(run, idleInput(), 1 / 60, 100_000);
      expect(ev.miss).toBe(true);
      expect(ev.lives).toBe(1);
      expect(run.misses).toBe(1);
      expect(run.fare).toBe(1);
      expect(run.patience).toBeGreaterThan(0.9);
      hold(run, 1, 100_000);
      expect(run.misses).toBe(1);
      expect(run.livesLost).toBe(1);
      run.fare = run.fares.length - 1;
      run.phase = 0;
      run.patience = 0.00001;
      run.over = null;
      step(run, idleInput(), 1 / 60, 100_000);
      expect(run.phase).toBe(2);
      expect(run.fares.length).toBe(LEVELS[1].rides);
      expect(activePad(run)).toBeNull();
   });

   it("a red light 1 ms before the line is still green, and 1 ms after spends a life", () => {
      let host: { id: LevelId; seed: number; light: number; coord: number } | null = null;
      for (const id of LEVEL_IDS) {
         if (host) break;
         for (let seed = 1; seed <= 20 && !host; seed++) {
            const probe = createRun(seed, LEVELS[id]);
            const line = probe.stops.find((item) => item.ns && item.into === 1 && item.coord > 8 && item.coord < probe.depth - 8 && item.span0 > 4);
            if (line) host = { id, seed, light: line.light, coord: line.coord };
         }
      }
      if (!host) throw new Error("no interior stop line");
      const h = 1 / 120;
      const speed = 5;
      const coast = speed - 0.4 * h;
      const frac = 0.03 / (coast * h);
      const cross = (phase: number) => {
         const sample = createRun(host.seed, LEVELS[host.id]);
         for (const car of sample.cars) {
            car.pin = true;
            car.x = -30;
            car.z = -30;
         }
         const line = sample.stops.find((item) => item.ns && item.into === 1 && item.light === host.light && item.coord === host.coord)!;
         sample.x = (line.span0 + line.span1) / 2;
         sample.z = line.coord - 0.03;
         sample.yaw = 0;
         sample.speed = speed;
         sample.lock = 0;
         sample.time = phase - frac * h - line.light * 1.7;
         return step(sample, idleInput(), h, 100_000);
      };
      expect(cross(3.999).lives).toBe(0);
      const red = cross(4.001);
      expect(red.red).toBe(true);
      expect(red.lives).toBe(1);
   });

   it("a strike above 3 m/s spends a life and a slower hit only nudges", () => {
      const fast = createRun(1, LEVELS[1]);
      for (const car of fast.cars) {
         car.pin = true;
         car.x = -40;
         car.z = -40;
      }
      fast.x = 5.05;
      fast.z = 13;
      fast.yaw = Math.PI / 2;
      fast.speed = 5;
      fast.lock = 0;
      let spent = 0;
      for (let i = 0; i < 8 && spent === 0; i++) spent += step(fast, idleInput(), 1 / 60, 100_000).lives;
      expect(spent).toBe(1);
      expect(fast.speed).toBeLessThan(0);
      expect(fast.x).toBeLessThan(6.4 - RADIUS + 0.05);

      const slow = createRun(1, LEVELS[1]);
      for (const car of slow.cars) {
         car.pin = true;
         car.x = -40;
         car.z = -40;
      }
      slow.x = 5.05;
      slow.z = 13;
      slow.yaw = Math.PI / 2;
      slow.speed = 2;
      slow.lock = 0;
      for (let i = 0; i < 8; i++) step(slow, idleInput(), 1 / 60, 100_000);
      expect(slow.livesLost).toBe(0);
      expect(slow.x).toBeLessThan(6.4);

      const crash = createRun(1, LEVELS[1]);
      for (const car of crash.cars) {
         car.pin = true;
         car.x = -40;
         car.z = -40;
      }
      crash.cars[0].x = 12;
      crash.cars[0].z = 3;
      crash.cars[0].hx = 0.7;
      crash.cars[0].hz = 0.7;
      crash.x = 10;
      crash.z = 3;
      crash.yaw = Math.PI / 2;
      crash.speed = 6;
      crash.lock = 0;
      let lives = 0;
      for (let i = 0; i < 6 && lives === 0; i++) lives += step(crash, idleInput(), 1 / 30, 100_000).lives;
      expect(lives).toBe(1);
      expect(Math.abs(crash.speed)).toBeLessThan(STRIKE);
   });

   it("30 Hz and 60 Hz steering matches, and 144 Hz stays on the same road", () => {
      const coast = (hz: number) => {
         const run = createRun(8, LEVELS[1]);
         const input = { moveX: 0.25, moveY: -1 };
         for (let i = 0; i < hz; i++) step(run, input, 1 / hz, 120_000);
         return run;
      };
      const a = coast(30);
      const b = coast(60);
      const c = coast(144);
      expect(a.x).toBeCloseTo(b.x, 4);
      expect(a.z).toBeCloseTo(b.z, 4);
      expect(a.yaw).toBeCloseTo(b.yaw, 4);
      expect(a.speed).toBeCloseTo(b.speed, 4);
      expect(Math.hypot(a.x - c.x, a.z - c.z)).toBeLessThan(0.05);
   });
});

describe("taxi debug", () => {
   it("prints one oracle", () => {
      for (const id of [5] as LevelId[]) {
         let best = 0;
         let wins = 0;
         let bestMs = 0;
         for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
            const result = play(id, seed, 60, "oracle");
            if (result.reason === "win" && result.score > best) {
               best = result.score;
               bestMs = result.ms;
            }
            if (result.reason === "win") wins += 1;
            if (id === 5) console.log(`s${seed} ${result.reason} ${result.score} drop ${result.run.dropoffs} lives ${result.run.livesLost} hit ${result.hits} red ${result.reds} miss ${result.misses} ${Math.round(result.ms)}`);
         }
         console.log(`L${id} wins ${wins}/8 best ${best} at ${Math.round(bestMs)} ms`);
      }
      expect(true).toBe(true);
   });
});

describe("taxi score limits", () => {
   it("an honest bot, an idle bot and a spam bot stay inside each level's limits", () => {
      for (const id of LEVEL_IDS) {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         let best = 0;
         let bestMs = 0;
         let wins = 0;
         for (const hz of [30, 60]) {
            for (let seed = 1; seed <= 8; seed++) {
               const oracle = play(id, seed, hz, "oracle");
               expect(withinServerLimits(oracle.score, oracle.ms, limits)).toBe(true);
               expect(capScore(oracle.score, oracle.ms, limits)).toBe(oracle.score);
               if (oracle.reason === "win") {
                  wins += 1;
                  if (oracle.score > best) {
                     best = oracle.score;
                     bestMs = oracle.ms;
                  }
               }
               const human = play(id, seed, hz, "human");
               expect(withinServerLimits(human.score, human.ms, limits)).toBe(true);
               expect(capScore(human.score, human.ms, limits)).toBe(human.score);
               const idle = play(id, seed, 20, "idle");
               expect(idle.score).toBe(0);
               expect(idle.reason).not.toBe("win");
               expect(withinServerLimits(idle.score, idle.ms, limits)).toBe(true);
               const spam = play(id, seed, 30, "spam");
               expect(withinServerLimits(spam.score, spam.ms, limits)).toBe(true);
               expect(capScore(spam.score, spam.ms, limits)).toBe(spam.score);
            }
         }
         const fast = play(id, 1, 144, "oracle");
         expect(withinServerLimits(fast.score, fast.ms, limits)).toBe(true);
         console.log(`L${id} oracle wins ${wins}/16 best ${best} at ${bestMs} ms (max ${limits.maxScore})`);
         expect(best).toBeGreaterThanOrEqual(limits.maxScore * 0.9);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });
});
