import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import {
   BELT,
   DURATION_MS,
   GAP,
   HALL,
   PATHS,
   PHASE_D3,
   PHASE_D4,
   POOL,
   SEG,
   SHORTEST_M,
   SPINE_PATH,
   STRIKE_LIMIT,
   aliveCount,
   beltSpeed,
   capScore,
   comboMult,
   createRun,
   deliveryPoints,
   diverterLocked,
   gapAhead,
   intervalAt,
   oracleCeiling,
   outgoing,
   ROLL,
   rollKind,
   placeBag,
   stepRun,
   travelTime,
   withinServerLimits,
   type RunState,
   type StepInput,
} from "./rules";

const flip = (i = -1): StepInput => ({ flip: [i === 0, i === 1, i === 2, i === 3] });
/** Tests that place bags themselves must not also roll the spawn clock. */
const manual = (seed = 1): RunState => {
   const run = createRun(seed);
   run.nextSpawn = 1e9;
   return run;
};

function ride(run: RunState, dt: number, until: number, input: StepInput = flip()): number {
   let t = 0;
   while (t < until - 1e-9) {
      const step = Math.min(dt, until - t);
      t += step;
      stepRun(run, input, step, t);
      if (run.lost) break;
   }
   return t;
}

describe("luggage-rush rules", () => {
   it("is the same run for the same seed", () => {
      const a = createRun(11);
      const b = createRun(11);
      ride(a, 0.05, 40);
      ride(b, 0.05, 40);
      expect(a.score).toBe(b.score);
      expect(a.strikes).toBe(b.strikes);
      expect(a.bags.map((bag) => [bag.alive, bag.flight, bag.vip, bag.s])).toEqual(
         b.bags.map((bag) => [bag.alive, bag.flight, bag.vip, bag.s])
      );
   });

   it("builds the belt lengths, with the green route lying on toD3", () => {
      expect(PATHS[SEG.entry].total + PATHS[SEG.chuteR].total).toBeCloseTo(SHORTEST_M, 6);
      expect(PATHS[SEG.toD3].total + PATHS[SEG.chuteG].total).toBeCloseTo(7.2, 6);
      expect(PATHS[SEG.hold].total).toBeCloseTo(3, 6);
      expect(PATHS[SEG.overflow].total).toBeCloseTo(2.8, 6);
      expect(SPINE_PATH.total).toBeCloseTo(4.4 + 3.6 + 3.2 + 3, 6);
      const sum = PATHS.reduce((n, path) => n + path.total, 0);
      expect(sum).toBeCloseTo(33, 6);
      expect(sum / GAP).toBeLessThanOrEqual(POOL);
      expect(PATHS[SEG.toD3].points[0]).toEqual(PATHS[SEG.mid].points[1]);
   });

   it("ramps the belt seven times and the spawn interval from 2.2 s to 0.9 s", () => {
      expect(beltSpeed(0)).toBeCloseTo(1.35, 6);
      expect(beltSpeed(14.9)).toBeCloseTo(1.35, 6);
      expect(beltSpeed(15)).toBeCloseTo(1.35 * 1.03, 6);
      expect(beltSpeed(105)).toBeCloseTo(1.66, 2);
      expect(beltSpeed(110)).toBeCloseTo(beltSpeed(105), 8);
      expect(intervalAt(0)).toBeCloseTo(2.2, 6);
      expect(intervalAt(20)).toBeCloseTo(1.9833, 3);
      expect(intervalAt(120)).toBeCloseTo(0.9, 6);
      expect(intervalAt(200)).toBeCloseTo(0.9, 6);
   });

   it("samples the junction on the crossing line, for every diverter", () => {
      const cases = [
         { seg: SEG.entry, s: 4.4, which: 0, before: SEG.mid, after: SEG.chuteR, at: 1 },
         { seg: SEG.mid, s: 3.6, which: 1, before: SEG.toD3, after: SEG.chuteB, at: 1 },
         { seg: SEG.toD3, s: 3.2, which: 2, before: SEG.hold, after: SEG.chuteG, at: 80 },
         { seg: SEG.hold, s: 3, which: 3, before: SEG.overflow, after: SEG.chuteY, at: 80 },
      ];
      for (const c of cases) {
         const speed = beltSpeed(c.at);
         const early = manual();
         placeBag(early, 0, false, false, c.seg, c.s - speed * 0.0004);
         stepRun(early, flip(c.which), 0.001, c.at);
         expect(early.bags.find((bag) => bag.alive)?.segment, `before ${c.which}`).toBe(c.before);

         const late = manual();
         const id = placeBag(late, 0, false, false, c.seg, c.s - speed * 0.0004);
         stepRun(late, flip(), 0.001, c.at);
         expect(late.bags[id].segment).toBe(c.after);
         stepRun(late, flip(c.which), 0.001, c.at + 0.001);
         expect(late.bags[id].segment, `after ${c.which}`).toBe(c.after);
      }
   });

   it("keeps D3 on the green chute until 40 s and the overflow shut until 70 s", () => {
      const run = createRun(1);
      run.choices[2] = 1;
      run.time = 39;
      expect(diverterLocked(2, 39)).toBe(true);
      expect(outgoing(run, SEG.toD3)).toBe(SEG.chuteG);
      run.time = 40;
      expect(outgoing(run, SEG.toD3)).toBe(SEG.hold);
      run.time = 69;
      expect(diverterLocked(3, 69)).toBe(true);
      expect(outgoing(run, SEG.hold)).toBe(SEG.chuteY);
      run.time = 70;
      run.choices[3] = 1;
      expect(outgoing(run, SEG.hold)).toBe(SEG.overflow);
   });

   it("does not move a bag already on toD3 or chuteG when D3 unlocks", () => {
      const run = createRun(1);
      const onSpine = placeBag(run, 2, false, false, SEG.toD3, 1);
      const onGreen = placeBag(run, 2, false, false, SEG.chuteG, 1);
      stepRun(run, flip(), 0.016, PHASE_D3);
      expect(run.bags[onSpine].segment).toBe(SEG.toD3);
      expect(run.bags[onGreen].segment).toBe(SEG.chuteG);
      expect(run.bags[onSpine].s).toBeGreaterThan(1);
   });

   it("strikes a hold route before 70 s on the D3 line and removes the bag", () => {
      const run = manual();
      run.choices[2] = 1;
      const id = placeBag(run, 3, false, false, SEG.toD3, 3.2 - 0.01);
      stepRun(run, flip(), 0.02, 50);
      expect(run.bags[id].alive).toBe(false);
      expect(run.bags[id].segment).toBe(SEG.toD3);
      expect(run.strikes).toBe(1);
      expect(run.score).toBe(0);
      expect(run.lost).toBe(false);
   });

   it("strikes a wrong chute at the chute end, so the third strike is past 10 s", () => {
      const run = manual();
      // three blue bags, released one gap apart, default D1 into the red chute
      placeBag(run, 1, false, false, SEG.entry, 0);
      let t = 0;
      const dt = 0.001;
      let placed = 1;
      const releases = [2.2, 4.376];
      while (!run.lost && t < 20) {
         t += dt;
         if (placed < 3 && t >= releases[placed - 1]) {
            placeBag(run, 1, false, false, SEG.entry, 0);
            placed++;
         }
         stepRun(run, flip(), dt, t);
      }
      expect(run.strikes).toBe(STRIKE_LIMIT);
      expect(t).toBeGreaterThan(10.5);
      expect(t).toBeLessThan(10.7);
      // striking at the chute entrance (4.4 m) would have ended near 7.64 s
      expect(t).toBeGreaterThan(7.64);
   });

   it("scores a correct bag at the chute end and builds the combo, VIP included", () => {
      expect(comboMult(1)).toBe(1);
      expect(deliveryPoints(1, false)).toBe(20);
      expect(deliveryPoints(2, false)).toBe(25);
      expect(deliveryPoints(9, false)).toBe(60);
      expect(deliveryPoints(12, false)).toBe(60);
      expect(deliveryPoints(9, true)).toBe(120);
      const run = manual();
      placeBag(run, 0, false, false, SEG.chuteR, 0);
      ride(run, 0.01, travelTime(4, 0) + 0.05);
      expect(run.score).toBe(20);
      expect(run.streak).toBe(1);
      placeBag(run, 0, false, true, SEG.chuteR, 0);
      ride(run, 0.01, travelTime(4, 0) + 0.05);
      expect(run.score).toBe(20 + 50);
      const miss = manual();
      miss.streak = 4;
      placeBag(miss, 1, false, false, SEG.chuteR, 3.99);
      stepRun(miss, flip(), 0.02, 1);
      expect(miss.score).toBe(0);
      expect(miss.streak).toBe(0);
      expect(miss.strikes).toBe(1);
   });

   it("measures the queue gap on the follower's branch and never lets a heavy bag be passed", () => {
      const run = manual();
      run.choices[0] = 1;
      const leader = placeBag(run, 0, false, false, SEG.mid, 0.2);
      const follower = placeBag(run, 0, false, false, SEG.entry, 4.4 - 0.2);
      expect(gapAhead(run, follower)).toBeCloseTo(0.2 + 0.2, 5);
      run.choices[0] = 0;
      expect(gapAhead(run, follower)).toBe(Infinity);

      const queue = manual();
      placeBag(queue, 0, true, false, SEG.entry, 1.1);
      placeBag(queue, 0, false, false, SEG.entry, 0);
      ride(queue, 0.05, 5);
      const [a, b] = queue.bags.filter((bag) => bag.alive);
      const along = (bag: (typeof queue.bags)[0]) => {
         let s = bag.s;
         if (bag.segment === SEG.chuteR) s += PATHS[SEG.entry].total;
         return s;
      };
      expect(Math.abs(along(a) - along(b))).toBeGreaterThanOrEqual(GAP - 1e-6);
   });

   it("waits to spawn while a bag is inside 1.1 m on the entry, and keeps the pool at 40", () => {
      const run = createRun(4);
      placeBag(run, 0, false, false, SEG.entry, 0.5);
      const before = aliveCount(run);
      stepRun(run, flip(), 0.05, 0);
      expect(aliveCount(run)).toBe(before);
      expect(run.nextSpawn).toBe(0);
      ride(run, 0.05, 3);
      expect(aliveCount(run)).toBeGreaterThan(before);
      expect(aliveCount(run)).toBeLessThanOrEqual(POOL);
   });

   it("pins the VIP and heavy roll rates", () => {
      expect(ROLL.vip).toBe(0.12);
      expect(ROLL.heavyLate).toBe(0.3);
      expect(ROLL.heavyEarly).toBe(0.2);
      expect(rollKind(50, 0.119)).toBe("vip");
      expect(rollKind(50, 0.12)).toBe("heavy");
      expect(rollKind(50, 0.299)).toBe("heavy");
      expect(rollKind(50, 0.3)).toBe("normal");
      expect(rollKind(30, 0.199)).toBe("heavy");
      expect(rollKind(30, 0.2)).toBe("normal");
      expect(rollKind(29.9, 0)).toBe("normal");
   });

   it("rolls VIP only from 50 s, heavy from 30 s, and never both", () => {
      let vipEarly = 0;
      let both = 0;
      for (let seed = 1; seed <= 40; seed++) {
         const run = createRun(seed);
         ride(run, 0.05, 80);
         for (const bag of run.bags) {
            if (bag.vip && bag.heavy) both++;
         }
         const early = createRun(seed);
         ride(early, 0.05, 49);
         if (early.bags.some((bag) => bag.vip)) vipEarly++;
      }
      expect(vipEarly).toBe(0);
      expect(both).toBe(0);
   });

   it("caps the analytic oracle at 77 bags and 7500 points", () => {
      const oracle = oracleCeiling();
      expect(oracle.bags).toBe(77);
      expect(oracle.score).toBe(7500);
      expect(oracle.last).toBeLessThan(120);
      expect(oracle.missed).toBeGreaterThan(120);
      expect(oracle.peak).toBeCloseTo(62.82, 1);
      expect(oracle.peak).toBeLessThan(64);
      expect(travelTime(SHORTEST_M, 0)).toBeCloseTo(8.4 / 1.35, 3);
      let score = 0;
      let t = 0;
      let streak = 0;
      for (let i = 0; i < oracle.bags; i++) {
         const arrive = t + travelTime(SHORTEST_M, t);
         streak++;
         score += deliveryPoints(streak, t >= 50);
         const ms = arrive * 1000;
         expect(score * 1000).toBeLessThanOrEqual(64 * ms);
         if (ms >= 10_000) expect(withinServerLimits(score, ms)).toBe(true);
         expect(capScore(score, Math.max(ms, 10_000))).toBe(score);
         t += intervalAt(t);
      }
      expect(withinServerLimits(7621, 120_000)).toBe(false);
      expect(withinServerLimits(7500, 9_999)).toBe(false);
   });
});

describe("luggage-rush scoring limit proof", () => {
   function play(frame: () => number, policy: "idle" | "oracle" | "spam"): { score: number; elapsedMs: number; reason: string } {
      const store = createArcadeStore();
      store.getState().configure({ durationMs: DURATION_MS });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(policy === "oracle" ? 1 : 7);
      if (policy === "oracle") run.nextSpawn = 1e9;
      let next = 0;
      const input = flip();
      while (store.getState().phase !== "over") {
         advanceRunClock(store, frame());
         const dt = playedFrameDt(store.getState());
         if (dt === 0) continue;
         const time = store.getState().elapsedMs / 1000;
         input.flip[0] = input.flip[1] = input.flip[2] = input.flip[3] = false;
         if (policy === "spam") {
            input.flip[0] = input.flip[1] = input.flip[2] = input.flip[3] = true;
            stepRun(run, input, dt, time);
         } else if (policy === "oracle") {
            if (time >= next && !run.bags.some((bag) => bag.alive && bag.segment === SEG.entry && bag.s < GAP)) {
               if (placeBag(run, 0, false, time >= 50) >= 0) next = time + intervalAt(time);
            }
            stepRun(run, input, dt, time);
         } else stepRun(run, input, dt, time);
         for (let i = 0; i < run.eventCount; i++) {
            const event = run.events[i];
            if (event.kind === "deliver") store.getState().addScore(event.points);
         }
         store.getState().setStat("strikes", run.strikes);
         if (run.lost) store.getState().end("lose");
      }
      const done = store.getState();
      return { score: done.score, elapsedMs: done.elapsedMs, reason: done.endReason ?? "" };
   }

   it("routes the oracle through the store inside the proposed limits", () => {
      for (const frame of [() => 1 / 60, () => 0.05]) {
         const sim = play(frame, "oracle");
         expect(sim.reason).toBe("timeup");
         expect(sim.score).toBeLessThanOrEqual(7500);
         expect(sim.score).toBeGreaterThan(0.9 * 7620);
         expect(withinServerLimits(sim.score, sim.elapsedMs)).toBe(true);
         expect(capScore(sim.score, sim.elapsedMs)).toBe(sim.score);
         expect(sim.elapsedMs).toBeGreaterThanOrEqual(10_000);
         expect(sim.elapsedMs).toBeLessThanOrEqual(122_000);
      }
   });

   it("keeps an idle run, a mashing run and a three-strike lose inside the limits", () => {
      const lose = manual();
      placeBag(lose, 1, false, false);
      let t = 0;
      while (!lose.lost && t < 30) {
         t += 0.05;
         if (t > 2.2 && aliveCount(lose) < 2) placeBag(lose, 1, false, false);
         if (t > 4.4 && aliveCount(lose) < 3) placeBag(lose, 1, false, false);
         stepRun(lose, flip(), 0.05, t);
      }
      expect(lose.lost).toBe(true);
      expect(t * 1000).toBeGreaterThanOrEqual(10_000);

      const idle = play(() => 1 / 30, "idle");
      const spam = play(() => 0.02 + ((idle.score % 7) * 0.004), "spam");
      for (const sim of [idle, spam]) {
         expect(withinServerLimits(sim.score, sim.elapsedMs)).toBe(true);
         expect(capScore(sim.score, sim.elapsedMs)).toBe(sim.score);
         expect(sim.score).toBeLessThanOrEqual(7500);
      }
   });

   it("stays inside the limits across seeds and frame sizes", () => {
      const frames = [1 / 60, 1 / 20, 0.037];
      for (let seed = 1; seed <= 12; seed++) {
         for (const frameS of frames) {
            const store = createArcadeStore();
            store.getState().configure({ durationMs: DURATION_MS });
            store.getState().markReady();
            store.getState().start();
            const run = createRun(seed);
            const input = flip();
            while (store.getState().phase !== "over") {
               advanceRunClock(store, frameS);
               const dt = playedFrameDt(store.getState());
               if (dt === 0) continue;
               const time = store.getState().elapsedMs / 1000;
               if ((seed + Math.floor(time * 10)) % 5 === 0) input.flip[(seed + Math.floor(time)) % 4] = true;
               stepRun(run, input, dt, time);
               input.flip[0] = input.flip[1] = input.flip[2] = input.flip[3] = false;
               for (let i = 0; i < run.eventCount; i++) if (run.events[i].kind === "deliver") store.getState().addScore(run.events[i].points);
               if (run.lost) store.getState().end("lose");
            }
            const done = store.getState();
            expect(withinServerLimits(done.score, done.elapsedMs), `seed ${seed} @ ${frameS}`).toBe(true);
            expect(capScore(done.score, done.elapsedMs)).toBe(done.score);
         }
      }
   });
});
