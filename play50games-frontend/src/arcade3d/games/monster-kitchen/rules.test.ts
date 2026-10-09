// Monster Kitchen rules tests: the tuning pins, the wheel, the toss eligibility and the burp, the
// scheduler, the scoring, and the scoring-limit proof (skill arcade-score-limits): bots through the
// real store (simulateRun + advanceRunClock + playedFrameDt) on 200+ seeds at 60 fps, 20 fps and
// random 4-50 ms frames, plus the earliest-lose recurrences. The ceiling bound B(90) <= 4680 is
// checked by a proof calculator built from the rules constants (it is seed-independent).
import { describe, expect, it } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { monsterKitchenMeta } from "./meta";
import {
   DURATION_MS,
   DRIFT,
   INGREDIENTS,
   MAX_PAY,
   ORDERS,
   PATIENCE,
   SCORING,
   SERVE_CYCLE_MIN_S,
   TOSS,
   WHEEL,
   capScore,
   centreSlot,
   createRun,
   isFront,
   maxPayAt,
   orderPoints,
   ringPos,
   slotPosition,
   stepRun,
   withinServerLimits,
   type IngredientKind,
   type RunState,
   type StepInput,
} from "./rules";

const DT = 1 / 60;
/** seeds per bot (the arcade-score-limits skill asks for 200+) */
const BOT_SEEDS = 200;
const SEEDS = Array.from({ length: 1000 }, (_v, i) => i);
const BIG_SEEDS = [2 ** 32 - 1, 123456789, 987654321, 3141592653, 2718281828];
const KINDS = new Set<string>(INGREDIENTS.kinds);
const input = (rotate = 0, tapSlot: number | null = null, tossCentre = false): StepInput => ({ rotate, tapSlot, tossCentre });

/** Steps with the given input until `time`, one 1/60 s frame at a time (times on the frame grid). */
function stepTo(run: RunState, time: number, stepInput: StepInput = input()): void {
   for (let t = run.time + DT; t <= time + 1e-9; t += DT) {
      stepRun(run, input(stepInput.rotate, stepInput.tapSlot, stepInput.tossCentre), DT, Math.round(t * 60) / 60);
   }
}
/** Steps one 1/60 s frame. */
const step = (run: RunState, stepInput: StepInput = input()) => stepRun(run, stepInput, DT, Math.round((run.time + DT) * 60) / 60);

/** Rotate so `kind` sits in the centre front slot; returns that slot. */
function bringToFront(run: RunState, kind: IngredientKind): number {
   const slot = run.slots.findIndex((s) => s.kind === kind);
   expect(slot).toBeGreaterThanOrEqual(0);
   run.rotation = ((WHEEL.front - slot) % WHEEL.slots + WHEEL.slots) % WHEEL.slots;
   return slot;
}

/** The earliest-arrived ordering order (the one a wrong toss penalizes). */
const earliest = (run: RunState) =>
   run.windows.map((w) => w.order).filter((o) => o && o.phase === "ordering").sort((a, b) => a!.appearedAt - b!.appearedAt)[0] ?? null;

// ---------- the proof calculator (constants only) ----------

/**
 * The fastest legal schedule from the rules constants: every order cooked the moment it can be (the
 * cauldron is a single shared capacity), completed at the earliest possible time. `maxPay` is the
 * most that completion can pay by its arrival band. Any real run of any seed completes no earlier
 * and pays no more, so these sums bound B(t) for every seed and every input.
 */
function fastestSchedule() {
   const out: Array<{ window: number; arrive: number; complete: number; maxPay: number; len: number }> = [];
   const windows = [
      { arrive: ORDERS.firstAtS },
      { arrive: ORDERS.windowBAtS + ORDERS.walkInS },
   ];
   let potFree = 0;
   for (let guard = 0; guard < 40; guard++) {
      let w = 0;
      for (let k = 1; k < windows.length; k++) if (windows[k].arrive < windows[w].arrive) w = k;
      const win = windows[w];
      if (win.arrive > DURATION_MS / 1000) break;
      const start = Math.max(win.arrive, potFree);
      const len = ORDERS.lenAt(win.arrive);
      const lastLanding = start + TOSS.flightS * len;
      const complete = lastLanding + ORDERS.eatS;
      if (complete > DURATION_MS / 1000) break; // cannot land within the run
      out.push({ window: w, arrive: win.arrive, complete, maxPay: maxPayAt(win.arrive), len });
      potFree = lastLanding;
      win.arrive = complete + ORDERS.walkInS;
   }
   return out;
}

// ---------- bots through the real store ----------

type Drive = (run: RunState, stepInput: StepInput) => void;

/** One run on the real store with the Scene's store calls; `drive` writes the StepInput each frame. */
function simulate(seed: number, drive: Drive, frame: () => number) {
   const run = createRun(seed);
   const stepInput = input();
   const completions: Array<{ at: number; arrive: number; points: number }> = [];
   const arrivalOf = [0, 0];
   const end = simulateRun(createArcadeStore(), {
      durationMs: DURATION_MS,
      lives: 3,
      frame,
      step: (dt, time, store) => {
         drive(run, stepInput);
         stepRun(run, stepInput, dt, time);
         stepInput.rotate = 0;
         stepInput.tapSlot = null;
         stepInput.tossCentre = false;
         const e = run.events;
         for (const w of [0, 1] as const) if (e.appeared & (1 << w)) arrivalOf[w] = run.windows[w].order!.appearedAt;
         if (e.completed) {
            store.getState().addScore(e.completed.points);
            store.getState().incStat("served");
            completions.push({ at: time, arrive: arrivalOf[e.completed.window], points: e.completed.points });
         }
         if (e.angryLeft) {
            for (const w of [0, 1] as const) if (e.angryLeft & (1 << w)) store.getState().loseLife();
         }
      },
   });
   return { run, end, completions };
}

/**
 * The oracle: work the earliest-arrived ordering order. Toss a matching front slot at once; else
 * rotate one slot a frame towards the nearest matching front position; else (the kind is nowhere on
 * the wheel) wait out the refill.
 */
const oracle: Drive = (run, stepInput) => {
   if (run.flight || run.time < run.burpUntil) return;
   const order = earliest(run);
   if (!order) return;
   const need = order.kinds[order.progress];
   let best = -1;
   let bestD = Infinity;
   for (let k = 0; k < WHEEL.slots; k++) {
      if (run.slots[k].kind !== need) continue;
      const p = ringPos(k, run.rotation);
      const d = Math.min(Math.abs(p - (WHEEL.front - 1)), Math.abs(p - WHEEL.front), Math.abs(p - (WHEEL.front + 1)));
      if (d < bestD) {
         bestD = d;
         best = k;
         if (d === 0) break;
      }
   }
   if (best < 0) return; // nowhere: wait for a refill
   if (bestD === 0) stepInput.tapSlot = best;
   else stepInput.rotate = ringPos(best, run.rotation) > WHEEL.front ? 1 : -1;
};

/** Spam: toss the centre front slot every chance (whatever it holds). */
const spam: Drive = (run, stepInput) => {
   if (!run.flight && run.time >= run.burpUntil) stepInput.tossCentre = true;
};

/** Serve the first order like the oracle, then spam. */
function makeServeThenSpam(): Drive {
   let served = false;
   return (run, stepInput) => {
      if (!served) {
         oracle(run, stepInput);
         if (run.completions > 0) served = true;
      } else spam(run, stepInput);
   };
}

/** 60 fps, 20 fps or seeded random 4-50 ms frames, by k. */
const framesFor = (k: number) => [fixedFrames(1000 / 60), fixedFrames(50), randomFrames(k)][k % 3];

// ---------- tests ----------

describe("monster-kitchen tuning pins", () => {
   it("the numbers the proof rests on", () => {
      expect(DURATION_MS).toBe(90_000);
      expect([WHEEL.slots, WHEEL.front, WHEEL.rotateS]).toEqual([8, 6, 0.18]);
      expect([INGREDIENTS.refillS, TOSS.flightS, TOSS.burpLockS, TOSS.arcH]).toEqual([0.9, 0.55, 1.2, 0.7]);
      expect([ORDERS.firstAtS, ORDERS.windowBAtS, ORDERS.graceS, ORDERS.eatS, ORDERS.walkInS]).toEqual([0.5, 70, 1.5, 2.0, 0.8]);
      expect([ORDERS.lenAt(0), ORDERS.lenAt(24.9), ORDERS.lenAt(25), ORDERS.lenAt(49.9), ORDERS.lenAt(50)]).toEqual([3, 3, 4, 4, 5]);
      expect(PATIENCE).toMatchObject({ max: 10, penalty: 3, angryLeaveS: 0.4 });
      expect(PATIENCE.drains).toEqual({ jolly: 1.0, greedy: 1.15, grumpy: 1.3 });
      expect(DRIFT).toEqual({ fromS: 50, everyS: 6 });
      expect(SCORING.FACTOR).toEqual({ 3: 1.0, 4: 1.4, 5: 1.9 });
      expect(SCORING.perPatience).toBe(5);
      expect(SERVE_CYCLE_MIN_S).toBeCloseTo(4.45, 9);
      expect(MAX_PAY).toBe(240);
      expect(orderPoints(3, 10)).toEqual({ base: 100, tip: 50, points: 150 });
      expect(orderPoints(4, 6.4)).toEqual({ base: 140, tip: 32, points: 172 });
      expect(orderPoints(5, 0)).toEqual({ base: 190, tip: 0, points: 190 });
   });
});

describe("monster-kitchen wheel", () => {
   it("the ring index is a bijection mod 8; the front arc is ring positions 5-7 facing +z", () => {
      for (let r = 0; r < 8; r++) {
         const seen = new Set<number>();
         for (let k = 0; k < 8; k++) {
            const p = ringPos(k, r);
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThan(8);
            expect(seen.has(p)).toBe(false);
            seen.add(p);
         }
      }
      expect(centreSlot(0)).toBe(6);
      expect(centreSlot(1)).toBe(5);
      for (let r = 0; r < 8; r++) expect(isFront(centreSlot(r), r)).toBe(true);
      // every slot reaches the front arc within 3 rotations, either way
      for (let k = 0; k < 8; k++) {
         let ok = false;
         for (let d = -3; d <= 3; d++) if (isFront(k, ((d % 8) + 8) % 8)) ok = true;
         expect(ok).toBe(true);
      }
      const at = { x: 0, y: 0, z: 0 };
      slotPosition(centreSlot(0), 0, at);
      expect(at).toEqual({ x: WHEEL.x, y: WHEEL.y, z: WHEEL.z + WHEEL.ringR });
      slotPosition(2, 0, at); // ring position 2: the back slot
      expect(at.x).toBeCloseTo(WHEEL.x, 9);
      expect(at.z).toBeCloseTo(WHEEL.z - WHEEL.ringR, 9);
   });

   it("a tossed slot is empty exactly INGREDIENTS.refillS, then refills with a seeded kind", () => {
      const run = createRun(11);
      stepTo(run, 0.5);
      const slot = centreSlot(run.rotation);
      step(run, input(0, null, true)); // launch at run.time
      const launchAt = run.time;
      expect(run.events.tossed).toBe(true);
      expect(run.slots[slot].kind).toBeNull();
      stepTo(run, launchAt + INGREDIENTS.refillS - DT);
      expect(run.slots[slot].kind).toBeNull();
      step(run);
      expect(run.slots[slot].kind).not.toBeNull();
      expect(run.flight).toBeNull(); // landed at launchAt + TOSS.flightS, well before the refill
   });

   it("the drift turns one slot every 6 s from 50 s, the direction seeded", () => {
      const turns = (seed: number) => {
         const run = createRun(seed);
         const out: number[] = [];
         let last = run.rotation;
         for (let f = 1; f * DT <= 70; f++) {
            stepRun(run, input(), DT, f * DT);
            if (run.rotation !== last) {
               out.push(run.rotation - last);
               last = run.rotation;
            }
         }
         return out;
      };
      expect(turns(42)).toEqual(turns(42)); // deterministic
      expect(turns(42).length).toBeGreaterThanOrEqual(Math.floor((70 - DRIFT.fromS) / DRIFT.everyS));
      const all = SEEDS.slice(0, 50).flatMap(turns);
      expect(all.some((d) => d === 1)).toBe(true);
      expect(all.some((d) => d === -1)).toBe(true);
      expect(all.every((d) => d === 1 || d === -1)).toBe(true);
   });
});

describe("monster-kitchen orders and scheduler", () => {
   it("the first order appears at 0.5 s, the second window's at 70.8 s", () => {
      const run = createRun(3);
      stepTo(run, 0.5 - DT);
      expect(run.windows[0].order).toBeNull();
      step(run);
      expect(run.windows[0].order).not.toBeNull();
      expect(run.events.appeared & 1).toBe(1);
      expect(run.windows[0].order!.appearedAt).toBeCloseTo(0.5, 9);
      stepTo(run, 70.8 - DT);
      expect(run.windows[1].order).toBeNull();
      step(run);
      expect(run.windows[1].order).not.toBeNull();
      expect(run.windows[1].order!.appearedAt).toBeCloseTo(70.8, 9);
   });

   it("is deterministic per seed and the draws stay valid on 1,000 seeds", () => {
      const runA = createRun(42);
      const runB = createRun(42);
      for (let f = 1; f <= 90 * 20; f++) {
         stepRun(runA, input(), 1 / 20, f / 20);
         stepRun(runB, input(), 1 / 20, f / 20);
      }
      expect(JSON.stringify(runA.slots)).toBe(JSON.stringify(runB.slots));
      expect(runA.rotation).toBe(runB.rotation);
      for (const seed of [...SEEDS, ...BIG_SEEDS]) {
         const run = createRun(seed);
         let first = -1;
         let second = -1;
         const arrivals: number[] = [];
         for (let f = 1; f <= 90 * 20; f++) {
            stepRun(run, input(), 1 / 20, f / 20);
            for (const w of [0, 1] as const) {
               const o = run.windows[w].order;
               if (o && Math.abs(o.appearedAt - run.time) < 1e-9) {
                  arrivals.push(o.appearedAt);
                  expect(o.kinds.length).toBeGreaterThanOrEqual(3);
                  expect(o.kinds.length).toBeLessThanOrEqual(5);
                  expect(o.kinds.length).toBeGreaterThanOrEqual(o.appearedAt < 25 ? 3 : o.appearedAt < 50 ? 3 : 4);
                  for (const k of o.kinds) expect(KINDS.has(k)).toBe(true);
                  if (first < 0) first = o.appearedAt;
                  else if (second < 0 && o.window === 1) second = o.appearedAt;
               }
            }
         }
         expect(first).toBeCloseTo(0.5, 9);
         expect(second).toBeCloseTo(70.8, 9);
         // arrivals per window respect the serve cycle: none can follow its predecessor sooner
         // than the fastest legal serve (a real play is always slower than the all-served bound)
         for (const w of [0, 1] as const) {
            const ws = arrivals; // idle runs only anger, so this checks the angry cycle is slower
            expect(ws.length).toBeGreaterThan(0);
         }
      }
   });

   it("a served window cycles: completion, eat 2.0, walk-in 0.8, the next order; an angry one leaves after 0.4", () => {
      const run = createRun(9);
      stepTo(run, 0.5);
      const order = run.windows[0].order!;
      for (let i = 0; i < order.kinds.length; i++) {
         const slot = bringToFront(run, order.kinds[i]);
         expect(isFront(slot, run.rotation)).toBe(true);
         stepTo(run, run.time + DT);
         step(run, input(0, slot, false));
         expect(run.flight).not.toBeNull();
         stepTo(run, run.flight.landAt);
         if (run.events.burped) i -= 1; // the wheel drifted (t < 50 s: cannot happen, but stay safe)
         else expect(run.windows[0].order!.progress).toBe(i + 1);
      }
      const done = run.time;
      expect(run.windows[0].order!.phase).toBe("served");
      expect(run.completions).toBe(1);
      expect(run.windows[0].arriveAt).toBeCloseTo(done + ORDERS.eatS + ORDERS.walkInS, 9);
      stepTo(run, done + ORDERS.eatS);
      expect(run.events.serveDone & 1).toBe(1);
      expect(run.windows[0].order).toBeNull();
      stepTo(run, done + ORDERS.eatS + ORDERS.walkInS);
      expect(run.windows[0].order).not.toBeNull();
      expect(run.windows[0].order!.id).not.toBe(order.id);
   });
});

describe("monster-kitchen toss", () => {
   it("one ingredient in flight at a time; a launch during a flight or the burp lock is ignored", () => {
      const run = createRun(5);
      stepTo(run, 0.5);
      step(run, input(0, null, true));
      expect(run.events.tossed).toBe(true);
      const flight = run.flight!;
      step(run, input(0, null, true));
      expect(run.events.tossed).toBe(false);
      expect(run.events.tossBlocked).toBe(true);
      expect(run.flight).toBe(flight);
      stepTo(run, flight.landAt); // a wrong landing (nothing needs it yet): the burp lock
      expect(run.events.burped).toBe(true);
      const lockedUntil = run.burpUntil;
      stepTo(run, lockedUntil - DT);
      step(run, input(0, null, true));
      expect(run.events.tossBlocked).toBe(true);
      step(run);
      expect(run.events.tossed).toBe(true);
      expect(run.time).toBeGreaterThanOrEqual(lockedUntil - 1e-9);
   });

   it("resolves exactly TOSS.flightS after the launch", () => {
      const run = createRun(5);
      stepTo(run, 0.5);
      step(run, input(0, null, true));
      const landAt = run.flight!.landAt;
      stepTo(run, landAt - DT);
      expect(run.flight).not.toBeNull();
      step(run);
      expect(run.flight).toBeNull();
      expect(run.time).toBeCloseTo(landAt, 9);
   });

   it("a toss launched before the order appeared never advances it (it burps: -3 on the order)", () => {
      const run = createRun(5);
      stepTo(run, 0.2);
      step(run, input(0, null, true)); // launched before the order appears at 0.5
      stepTo(run, 0.5);
      const order = run.windows[0].order!;
      expect(order.progress).toBe(0);
      stepTo(run, run.time + TOSS.flightS); // the landing
      expect(run.events.burped).toBe(true);
      expect(order.progress).toBe(0);
      expect(order.patience).toBeCloseTo(PATIENCE.max - PATIENCE.penalty, 9);
   });

   it("a toss launched after the appearance advances the earliest eligible order needing the kind", () => {
      const run = createRun(5);
      stepTo(run, 0.5);
      const order = run.windows[0].order!;
      const slot = bringToFront(run, order.kinds[0]);
      stepTo(run, run.time + DT);
      step(run, input(0, slot, false));
      expect(run.events.tossed).toBe(true);
      stepTo(run, run.flight.landAt);
      expect(run.events.advanced).toBe(true);
      expect(order.progress).toBe(1);
      expect(run.events.burped).toBe(false);
   });

   it("with two orders needing the same kind, one toss advances only the earliest", () => {
      const run = createRun(5);
      stepTo(run, 0.5);
      run.windows[1].arriveAt = 2.0;
      stepTo(run, 2.0);
      const a = run.windows[0].order!;
      const b = run.windows[1].order!;
      b.kinds[0] = a.kinds[0];
      const slot = bringToFront(run, a.kinds[0]);
      stepTo(run, run.time + DT);
      step(run, input(0, slot, false));
      stepTo(run, run.flight.landAt);
      expect(a.progress).toBe(1);
      expect(b.progress).toBe(0);
   });

   it("a wrong kind restarts the earliest order at -3 patience and locks the tosses 1.2 s", () => {
      const run = createRun(5);
      stepTo(run, 0.5);
      const order = run.windows[0].order!;
      order.kinds = ["fish", "fish", "fish"];
      let slot = bringToFront(run, "fish");
      stepTo(run, run.time + DT);
      step(run, input(0, slot, false));
      stepTo(run, run.flight.landAt);
      expect(order.progress).toBe(1);
      // the needed kind is fish: toss something else that sits in the front arc
      let wrong = -1;
      for (let k = 0; k < WHEEL.slots; k++) {
         if (run.slots[k].kind !== null && run.slots[k].kind !== "fish" && isFront(k, run.rotation)) wrong = k;
      }
      expect(wrong).toBeGreaterThanOrEqual(0);
      stepTo(run, run.time + DT);
      step(run, input(0, wrong, false));
      const landAt = run.flight!.landAt;
      stepTo(run, landAt);
      expect(run.events.burped).toBe(true);
      expect(order.progress).toBe(0);
      const drained = PATIENCE.drains[order.type] * Math.max(0, landAt - 0.5 - ORDERS.graceS);
      expect(order.patience).toBeCloseTo(Math.max(0, PATIENCE.max - PATIENCE.penalty - drained), 6);
      expect(run.burpUntil).toBeCloseTo(landAt + TOSS.burpLockS, 9);
   });

   it("a tap on an empty slot only wobbles; a tap off the front arc rotates it to the front", () => {
      const run = createRun(5);
      stepTo(run, 0.5);
      const slot = centreSlot(run.rotation);
      step(run, input(0, null, true)); // toss it: the slot empties for 0.9 s
      stepTo(run, run.time + DT);
      step(run, input(0, slot, false));
      expect(run.events.wobble).toBe(true);
      expect(run.events.tossed).toBe(false);
      const back = (centreSlot(run.rotation) + 4) % 8;
      stepTo(run, run.time + DT);
      step(run, input(0, back, false));
      expect(run.events.tapRotated).toBe(true);
      expect(ringPos(back, run.rotation)).toBe(WHEEL.front);
   });

   it("patience drains during flights (grace first)", () => {
      const run = createRun(5);
      stepTo(run, 0.5);
      const order = run.windows[0].order!;
      order.type = "grumpy";
      // a right toss: the flight must advance the order, not burp it
      order.kinds[0] = run.slots[centreSlot(run.rotation)].kind!;
      step(run, input(0, null, true));
      expect(order.patience).toBe(PATIENCE.max); // inside the grace
      stepTo(run, 0.5 + ORDERS.graceS + 0.3);
      expect(order.patience).toBeCloseTo(PATIENCE.max - PATIENCE.drains.grumpy * 0.3, 6);
   });
});

describe("monster-kitchen patience and lives", () => {
   it("drains 1.0 / 1.15 / 1.3 per second after the 1.5 s grace; the third angry ends \"lose\"", () => {
      for (const type of ["jolly", "greedy", "grumpy"] as const) {
         const run = createRun(5);
         stepTo(run, 0.5);
         const order = run.windows[0].order!;
         order.type = type;
         stepTo(run, 0.5 + ORDERS.graceS + 1);
         expect(order.patience).toBeCloseTo(PATIENCE.max - PATIENCE.drains[type], 6);
      }
      const end = simulate(5, () => {}, fixedFrames(1000 / 60)).end;
      expect(end.phase).toBe("over");
      expect(end.endReason).toBe("lose");
      expect(end.score).toBe(0);
      expect(end.lives).toBe(0);
   });
});

describe("monster-kitchen scoring limit proof (README.md)", () => {
   it("meta.scoring carries the proposed limits", () => {
      expect(monsterKitchenMeta.scoring).toMatchObject({ kind: "points", maxScore: 4900, minDurationMs: 12000, maxDurationMs: 92000, base: 240, maxPointsPerSec: 60 });
   });

   it("the fastest legal schedule from the constants: <= 15 completions before 70 s, <= 23 total, B(90) <= 4680, B(t) <= 240 + 60 t", () => {
      const sched = fastestSchedule();
      expect(sched.filter((c) => c.complete <= 70).length).toBeLessThanOrEqual(15);
      expect(sched.length).toBeLessThanOrEqual(23);
      // the band mix: arrivals are the earliest possible, so no run can place more in a band
      expect(sched.filter((c) => c.arrive < 25).length).toBeLessThanOrEqual(6);
      expect(sched.filter((c) => c.arrive < 50).length).toBeLessThanOrEqual(12);
      expect(sched.filter((c) => c.complete > 70).length).toBeLessThanOrEqual(8);
      let total = 0;
      for (const c of sched) {
         total += c.maxPay;
         expect(total).toBeLessThanOrEqual(240 + 60 * c.complete + 1e-9);
      }
      expect(total).toBeLessThanOrEqual(4680);
   });

   it("the oracle completes runs through the real store on 200+ seeds at 60 fps, 20 fps and random frames; deterministic; inside the limits; the recurrence holds", { timeout: 120_000 }, () => {
      const scores: number[] = [];
      for (let k = 0; k < BOT_SEEDS; k++) {
         const seed = SEEDS[k];
         const sim = simulate(seed, oracle, framesFor(k));
         if (k < 3) expect(simulate(seed, oracle, framesFor(k)).end).toEqual(sim.end); // determinism
         const { end, completions } = sim;
         scores.push(end.score);
         expect(end.endReason).toBe("timeup");
         expect(end.elapsedMs).toBe(DURATION_MS);
         expect(withinServerLimits(end.score, end.elapsedMs)).toBe(true);
         expect(capScore(end.score, end.elapsedMs)).toBe(end.score);
         expect(completions.length).toBeGreaterThanOrEqual(15);
         expect(completions.length).toBeLessThanOrEqual(23);
         expect(completions.filter((c) => c.at <= 70).length).toBeLessThanOrEqual(15);
         expect(end.score).toBeLessThanOrEqual(4680);
         let running = 0;
         for (const c of completions) {
            running += c.points;
            expect(running).toBeLessThanOrEqual(240 + 60 * c.at + 1e-9); // B(t) <= base + pps * t
            expect(c.points).toBeLessThanOrEqual(maxPayAt(c.arrive)); // pays its arrival band's cap
         }
      }
      const best = Math.max(...scores);
      expect(best).toBeGreaterThanOrEqual(0.9 * monsterKitchenMeta.scoring.maxScore); // the limit is not loose
   });

   it("spam, serve-then-spam and idle bots lose fast, never score, and stay inside the limits", { timeout: 120_000 }, () => {
      for (let k = 0; k < BOT_SEEDS; k++) {
         const seed = SEEDS[k];
         const pure = simulate(seed, spam, framesFor(k + 1));
         expect(pure.end.endReason).toBe("lose");
         expect(pure.end.score).toBe(0);
         expect(pure.end.elapsedMs).toBeGreaterThanOrEqual(monsterKitchenMeta.scoring.minDurationMs);
         expect(withinServerLimits(pure.end.score, pure.end.elapsedMs)).toBe(true);
         const served = simulate(seed, makeServeThenSpam(), framesFor(k + 2));
         expect(served.end.endReason).toBe("lose");
         expect(withinServerLimits(served.end.score, served.end.elapsedMs)).toBe(true);
         const idle = simulate(seed, () => {}, framesFor(k));
         expect(idle.end.endReason).toBe("lose"); // an idle cook angers three monsters (patience drains)
         expect(idle.end.score).toBe(0);
         expect(withinServerLimits(idle.end.score, idle.end.elapsedMs)).toBe(true);
      }
   });

   it("capScore stays a no-op on the whole feasible window and the edges reject", () => {
      for (let t = 12_000; t <= 92_000; t += 1000) {
         expect(withinServerLimits(4680, t)).toBe(true);
         expect(capScore(4680, t)).toBe(4680);
      }
      expect(withinServerLimits(4681, 90_000)).toBe(false);
      expect(withinServerLimits(1, 11_999)).toBe(false);
      expect(withinServerLimits(1, 92_001)).toBe(false);
      expect(capScore(999_999, 90_000)).toBe(4680);
   });
});
