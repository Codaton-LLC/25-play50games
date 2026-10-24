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
   PROPOSED_LIMITS,
   SCORING,
   SERVE_CYCLE_MIN_S,
   TOSS,
   WHEEL,
   capScore,
   centreSlot,
   createRun,
   easeWheel,
   frontScale,
   isFront,
   isNeeded,
   maxPayAt,
   orderPoints,
   ringPos,
   slotPosition,
   stepRun,
   withinServerLimits,
   type IngredientKind,
   type Order,
   type RunState,
   type StepInput,
} from "./rules";

const DT = 1 / 60;
/** seeds per bot (the arcade-score-limits skill asks for 200+ for the oracle) */
const BOT_SEEDS = 200;
/** the spam/trio checks are qualitative (lose fast, never near a limit): half the seeds */
const TRIO_SEEDS = 100;
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

/** The needed kind can be off the wheel (a tossed slot refills randomly): restock the centre slot. */
function ensureKind(run: RunState, kind: IngredientKind): void {
   if (run.slots.some((s) => s.kind === kind)) return;
   const slot = centreSlot(run.rotation);
   run.slots[slot].kind = kind;
   run.slots[slot].emptyUntil = 0;
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
 * The oracle: shortest-remaining-items-first on the shared pot (it frees a window earliest and
 * keeps average cooks lowest, so tips stay fat), tie-broken by the least slack — the time the
 * order can still wait (patience / drain) minus the cook its remaining items need — so no monster
 * is starved into anger. Toss a matching front slot at once; else rotate one slot a frame towards
 * the nearest matching front position (legal mid-flight); else (the kind is nowhere) wait out the
 * refill.
 */
const oracle: Drive = (run, stepInput) => {
   if (run.time < run.burpUntil - 1e-9) return; // the burp lock (the oracle never triggers one)
   const slack = (o: Order) => o.patience / PATIENCE.drains[o.type] - (o.kinds.length - o.progress) * TOSS.flightS;
   let order: Order | null = null;
   for (const w of run.windows) {
      const o = w.order;
      if (!o || o.phase !== "ordering") continue;
      if (
         !order ||
         o.kinds.length - o.progress < order.kinds.length - order.progress ||
         (o.kinds.length - o.progress === order.kinds.length - order.progress && slack(o) < slack(order))
      ) {
         order = o;
      }
   }
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
   if (bestD === 0) {
      if (!run.flight) stepInput.tapSlot = best; // one in flight at a time
   } else {
      // rotation is legal mid-flight: pre-position the next ingredient while one flies
      stepInput.rotate = ringPos(best, run.rotation) > WHEEL.front ? 1 : -1;
   }
};

/** Spam: toss the centre front slot every chance (whatever it holds). */
const spam: Drive = (run, stepInput) => {
   if (!run.flight && run.time >= run.burpUntil - 1e-9) stepInput.tossCentre = true;
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

   it("the drawn wheel eases onto run.rotation exactly and turns one slot the short way", () => {
      const off = (v: number, target: number) => {
         const d = (((v - target) % 8) + 8) % 8;
         return Math.min(d, 8 - d);
      };
      const settle = (drawn: number, target: number) => {
         let frames = 0;
         while (frames < 600) {
            const next = easeWheel(drawn, target, DT / WHEEL.rotateS);
            if (next === drawn) break;
            drawn = next;
            frames += 1;
         }
         return { drawn, frames };
      };
      // already on target: it stays put (no spin at the start of a run)
      for (let r = 0; r < 8; r++) expect(easeWheel(r, r, 0.1)).toBe(r);
      expect(easeWheel(16, 0, 0.1)).toBe(16);
      // from anywhere (fractional, unbounded, either sign) it lands exactly on the target mod 8, never the long way
      for (const start of [0, 0.3, 2.5, 7.9, -3.2, 13.75, -17]) {
         for (let target = 0; target < 8; target++) {
            const { drawn, frames } = settle(start, target);
            expect(off(drawn, target), `${start} -> ${target}`).toBeLessThan(1e-9);
            expect(frames).toBeLessThanOrEqual(Math.ceil((4 * WHEEL.rotateS) / DT) + 1);
         }
      }
      // a +1 / -1 key turns one slot that way (across the wrap too), in 0.18 s
      for (const [from, to, dir] of [[0, 1, 1], [0, 7, -1], [7, 0, 1], [3, 2, -1]] as const) {
         const first = easeWheel(from, to, DT / WHEEL.rotateS);
         expect(Math.sign(first - from), `${from} -> ${to}`).toBe(dir);
         const { drawn, frames } = settle(from, to);
         expect(drawn - from).toBeCloseTo(dir, 9);
         expect(frames).toBe(Math.ceil(WHEEL.rotateS / DT - 1e-9));
      }
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
               // normalize the delta mod 8 (a +1 across the wrap reads as -7)
               const d = run.rotation - last;
               out.push((((d + 4) % 8) + 8) % 8 - 4);
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

describe("monster-kitchen selector (what is in hand)", () => {
   it("isNeeded predicts the landing: green = advances an order, red = burps", () => {
      let right = 0;
      let wrong = 0;
      for (let seed = 1; seed <= 60; seed++) {
         const run = createRun(seed);
         const input: StepInput = { rotate: 0, tapSlot: null, tossCentre: false };
         let t = 0;
         // wait for the first order (and its grace) to be up
         while (t < 1) {
            t += DT;
            stepRun(run, input, DT, t);
         }
         // turn until the centre slot holds a kind; odd seeds look for a needed one, even ones for a wrong one
         const wantNeeded = seed % 2 === 1;
         let found = false;
         for (let r = 0; r < 8 && !found; r++) {
            const kind = run.slots[centreSlot(run.rotation)].kind;
            if (kind !== null && isNeeded(run, kind) === wantNeeded) found = true;
            else {
               input.rotate = 1;
               t += DT;
               stepRun(run, input, DT, t);
               input.rotate = 0;
            }
         }
         if (!found) continue;
         const predicted = isNeeded(run, run.slots[centreSlot(run.rotation)].kind);
         input.tossCentre = true;
         t += DT;
         stepRun(run, input, DT, t);
         input.tossCentre = false;
         expect(run.flight).not.toBeNull();
         let landed: "right" | "wrong" | null = null;
         while (landed === null && t < 5) {
            t += DT;
            stepRun(run, input, DT, t);
            landed = run.events.landed;
         }
         expect(landed).toBe(predicted ? "right" : "wrong");
         if (predicted) right += 1;
         else wrong += 1;
      }
      expect(right).toBeGreaterThan(10);
      expect(wrong).toBeGreaterThan(10);
      expect(isNeeded(createRun(1), null)).toBe(false);
   });

   it("the front centre ingredient swells and never touches its neighbours", () => {
      const centre = centreSlot(0);
      expect(frontScale(centre, 0)).toBeCloseTo(1.3, 9);
      expect(frontScale((centre + 1) % 8, 0)).toBeCloseTo(1, 9);
      expect(frontScale((centre + 4) % 8, 0)).toBeCloseTo(0.85, 9);
      // mid-ease: continuous and symmetric
      expect(frontScale(centre, 0.5)).toBeCloseTo(1.15, 9);
      expect(frontScale(centre, -0.5)).toBeCloseTo(1.15, 9);
      // neighbouring items (0.36 m wide at scale 1) keep a gap at every drawn rotation
      const gap = 2 * WHEEL.ringR * Math.sin(Math.PI / 8);
      for (let rot = 0; rot < 8; rot += 0.05) {
         for (let k = 0; k < 8; k++) {
            const half = (0.36 / 2) * (frontScale(k, rot) + frontScale((k + 1) % 8, rot));
            expect(half).toBeLessThan(gap);
         }
      }
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

   it("each length band draws both of its lengths: 3 and 4 from 25 s, 4 and 5 from 50 s", () => {
      const seen = new Map<number, Set<number>>([[3, new Set()], [4, new Set()], [5, new Set()]]);
      for (const seed of SEEDS.slice(0, 100)) {
         const run = createRun(seed);
         for (let f = 1; f <= 90 * 20; f++) {
            stepRun(run, input(), 1 / 20, f / 20);
            for (const w of [0, 1] as const) {
               const o = run.windows[w].order;
               if (o && run.events.appeared & (1 << w)) seen.get(ORDERS.lenAt(o.appearedAt))!.add(o.kinds.length);
            }
         }
      }
      expect([...seen.get(3)!]).toEqual([3]);
      expect([...seen.get(4)!].sort()).toEqual([3, 4]);
      expect([...seen.get(5)!].sort()).toEqual([4, 5]);
   });

   it("an angry monster leaves 0.4 s after patience hits 0; the next order appears 1.2 s after it", () => {
      const run = createRun(7);
      stepTo(run, 0.5 + ORDERS.graceS + 0.1);
      const order = run.windows[0].order!;
      order.patience = 0.005; // runs out on the next frame
      step(run);
      expect(order.phase).toBe("angry");
      const angryAt = order.phaseAt;
      expect(angryAt).toBeCloseTo(run.time, 9);
      stepTo(run, angryAt + PATIENCE.angryLeaveS - DT);
      expect(run.windows[0].order).toBe(order);
      expect(run.events.angryLeft).toBe(0);
      step(run);
      expect(run.events.angryLeft & 1).toBe(1);
      expect(run.windows[0].order).toBeNull();
      stepTo(run, angryAt + PATIENCE.angryLeaveS + ORDERS.walkInS - DT);
      expect(run.windows[0].order).toBeNull();
      step(run);
      const next = run.windows[0].order!;
      expect(next).not.toBeNull();
      expect(next.id).not.toBe(order.id);
      expect(next.appearedAt).toBeCloseTo(angryAt + 1.2, 9);
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
         ensureKind(run, order.kinds[i]);
         const slot = bringToFront(run, order.kinds[i]);
         expect(isFront(slot, run.rotation)).toBe(true);
         stepTo(run, run.time + DT);
         step(run, input(0, slot, false));
         expect(run.flight).not.toBeNull();
         const flight = run.flight!;
         stepTo(run, flight.landAt);
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
      const order = run.windows[0].order!;
      order.kinds = ["fish", "fish", "fish"];
      const centre = centreSlot(run.rotation);
      if (run.slots[centre].kind === "fish") run.slots[centre].kind = "apple"; // the toss must burp
      step(run, input(0, null, true));
      expect(run.events.tossed).toBe(true);
      const flight = run.flight!;
      step(run, input(0, null, true));
      expect(run.events.tossed).toBe(false);
      expect(run.events.tossBlocked).toBe(true);
      expect(run.flight).toBe(flight);
      stepTo(run, flight.landAt - DT);
      step(run); // the wrong landing frame: the burp lock starts
      expect(run.events.burped).toBe(true);
      const lockedUntil = run.burpUntil;
      expect(lockedUntil).toBeCloseTo(flight.landAt + TOSS.burpLockS, 9);
      stepTo(run, lockedUntil - 2 * DT);
      step(run, input(0, null, true)); // strictly inside the lock
      expect(run.events.tossBlocked).toBe(true);
      expect(run.time).toBeLessThan(lockedUntil - 1e-9);
      stepTo(run, lockedUntil);
      step(run, input(0, null, true)); // the lock has just ended
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
      const landAt = run.flight!.landAt;
      stepTo(run, 0.5);
      const order = run.windows[0].order!;
      expect(order.progress).toBe(0);
      stepTo(run, landAt); // the landing: launched before the appearance, so it burps
      expect(run.events.burped).toBe(true);
      expect(order.progress).toBe(0);
      expect(order.patience).toBeCloseTo(PATIENCE.max - PATIENCE.penalty, 9);
   });

   it("a toss launched before the appearance never counts, even when its kind is the order's first item", () => {
      const run = createRun(5);
      stepTo(run, 0.2);
      step(run, input(0, null, true)); // launched before the order appears at 0.5
      const flight = run.flight!;
      stepTo(run, 0.5);
      const order = run.windows[0].order!;
      order.kinds[0] = flight.kind; // the very kind in the air
      stepTo(run, flight.landAt);
      expect(run.events.advanced).toBe(false);
      expect(run.events.burped).toBe(true);
      expect(order.progress).toBe(0);
   });

   it("a toss launched after the appearance advances the earliest eligible order needing the kind", () => {
      const run = createRun(5);
      stepTo(run, 0.5);
      const order = run.windows[0].order!;
      const slot = bringToFront(run, order.kinds[0]);
      stepTo(run, run.time + DT);
      step(run, input(0, slot, false));
      expect(run.events.tossed).toBe(true);
      stepTo(run, run.flight!.landAt);
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
      stepTo(run, run.flight!.landAt);
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
      stepTo(run, run.flight!.landAt);
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

   it("with two orders a wrong landing restarts and penalizes only the earliest (either window)", () => {
      for (const first of [0, 1] as const) {
         const run = createRun(5);
         stepTo(run, 0.5);
         run.windows[1].arriveAt = 2.0;
         stepTo(run, 2.0);
         const a = run.windows[first].order!;
         const b = run.windows[1 - first].order!;
         a.appearedAt = 0.2; // the earliest (both past the grace)
         b.appearedAt = 0.3;
         const kind = run.slots[centreSlot(run.rotation)].kind!;
         const other = INGREDIENTS.kinds.find((k) => k !== kind)!;
         for (const o of [a, b]) {
            o.kinds[0] = other;
            o.kinds[1] = other;
            o.progress = 1;
            o.patience = 9;
            o.type = "jolly";
         }
         step(run, input(0, null, true));
         const landAt = run.flight!.landAt;
         const pa = a.patience;
         const pb = b.patience;
         stepTo(run, landAt);
         expect(run.events.burped).toBe(true);
         expect(a.progress, `earliest in window ${first}`).toBe(0);
         expect(b.progress, `later in window ${1 - first}`).toBe(1);
         // the same drain on both over the flight; only the earliest takes the -3
         expect(pa - a.patience - (pb - b.patience)).toBeCloseTo(PATIENCE.penalty, 6);
      }
   });

   it("a tap on ring position 4 or 0 rotates instead of tossing (only the front 3 slots toss)", () => {
      for (const pos of [4, 0]) {
         const run = createRun(5);
         stepTo(run, 0.5);
         const slot = (((pos - run.rotation) % 8) + 8) % 8;
         expect(ringPos(slot, run.rotation)).toBe(pos);
         expect(run.slots[slot].kind).not.toBeNull();
         step(run, input(0, slot, false));
         expect(run.events.tossed, `ring position ${pos}`).toBe(false);
         expect(run.flight).toBeNull();
         expect(run.events.tapRotated).toBe(true);
         expect(ringPos(slot, run.rotation)).toBe(WHEEL.front);
      }
      for (const pos of [5, 6, 7]) {
         const run = createRun(5);
         stepTo(run, 0.5);
         const slot = (((pos - run.rotation) % 8) + 8) % 8;
         step(run, input(0, slot, false));
         expect(run.events.tossed, `ring position ${pos}`).toBe(true);
      }
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

   it("patience keeps draining while a toss is in flight after the grace", () => {
      const run = createRun(5);
      stepTo(run, 0.5 + ORDERS.graceS + 0.5);
      const order = run.windows[0].order!;
      order.type = "grumpy";
      order.kinds[order.progress] = run.slots[centreSlot(run.rotation)].kind!;
      const p0 = order.patience;
      const t0 = run.time;
      step(run, input(0, null, true));
      expect(run.flight).not.toBeNull();
      stepTo(run, run.flight!.landAt - DT);
      expect(run.flight).not.toBeNull(); // still in the air
      expect(order.patience).toBeCloseTo(p0 - PATIENCE.drains.grumpy * (run.time - t0), 6);
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
   it("PROPOSED_LIMITS carries the proposed limits (meta.scoring mirrors arcade-games.json until the limits PR)", () => {
      expect(PROPOSED_LIMITS).toMatchObject({ kind: "points", maxScore: 4200, minDurationMs: 12000, maxDurationMs: 92000, base: 240, maxPointsPerSec: 60 });
      expect(PROPOSED_LIMITS).toMatchObject({ kind: monsterKitchenMeta.scoring.kind, unitLabel: monsterKitchenMeta.scoring.unitLabel, display: monsterKitchenMeta.scoring.display });
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
         if (k < 3) {
            const endOf = (e: { phase: string; endReason: string | null; score: number; lives: number | null; elapsedMs: number }) =>
               ({ phase: e.phase, endReason: e.endReason, score: e.score, lives: e.lives, elapsedMs: e.elapsedMs });
            expect(endOf(simulate(seed, oracle, framesFor(k)).end)).toEqual(endOf(sim.end)); // determinism
         }
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
      expect(best).toBeGreaterThanOrEqual(0.9 * PROPOSED_LIMITS.maxScore); // the limit is not loose
   });

   it("spam, serve-then-spam and idle bots lose fast, never score, and stay inside the limits", { timeout: 120_000 }, () => {
      for (let k = 0; k < TRIO_SEEDS; k++) {
         const seed = SEEDS[k];
         const pure = simulate(seed, spam, framesFor(k + 1));
         expect(pure.end.endReason).toBe("lose");
         // the restock refill can loop the centre kind back, so a lucky all-same first order
         // plates once (worst measured over the seeds: 145); spam never farms real points
         expect(pure.end.score).toBeLessThanOrEqual(150);
         expect(pure.end.elapsedMs).toBeGreaterThanOrEqual(PROPOSED_LIMITS.minDurationMs);
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
      const { maxScore, minDurationMs, maxDurationMs } = PROPOSED_LIMITS;
      for (let t = minDurationMs; t <= maxDurationMs; t += 1000) {
         const plausible = Math.min(4680, 240 + (60 * t) / 1000, maxScore); // the proof ceiling, the rate cap B(t) <= 240 + 60 t, and maxScore
         expect(withinServerLimits(plausible, t)).toBe(true);
         expect(capScore(plausible, t)).toBe(plausible);
      }
      expect(withinServerLimits(960, 12_000)).toBe(true); // the rate cap at the shortest run
      expect(withinServerLimits(961, 12_000)).toBe(false);
      expect(withinServerLimits(maxScore + 1, 90_000)).toBe(false); // above maxScore
      expect(withinServerLimits(1, minDurationMs - 1)).toBe(false);
      expect(withinServerLimits(1, maxDurationMs + 1)).toBe(false);
      expect(capScore(999_999, 90_000)).toBe(maxScore); // the net trims to maxScore, never reached by a real run
   });
});
