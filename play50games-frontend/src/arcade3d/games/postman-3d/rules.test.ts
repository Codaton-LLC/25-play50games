import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { createInputController } from "@/arcade3d/core/inputController";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { createRun, step, targetFor, OFFICE, REACH, SPEED, PROPOSED_LEVEL_LIMITS, type Run } from "./rules";

const idle = { moveX: 0, moveY: 0, yaw: 0, actionPressed: false };

// A walking bot: no teleport, one fresh press every 0.35 s, 0.3 s to read each new item.
export function play(run: Run) {
   let wait = 0.3;
   let previous = -1;
   let waypoints: { x: number; z: number }[] = [];
   for (let frame = 0; frame < run.level.durationMs / 1000 * 60 && !run.over; frame++) {
      const item = run.items.find((i) => !i.delivered);
      if (!item) break;
      const destination = item.loaded ? targetFor(run, item) : OFFICE;
      const key = item.house * 2 + (item.loaded ? 1 : 0);
      if (key !== previous) {
         previous = key;
         const street = Math.round(run.hero.z / 20) * 20;
         const destStreet = Math.round(destination.z / 20) * 20;
         const pavement = street + (run.hero.z >= street ? 4 : -4);
         const destPavement = destStreet + (destination.z >= destStreet ? 4 : -4);
         waypoints = pavement === destPavement
            ? [{ x: run.hero.x, z: pavement }, { x: destination.x, z: pavement }, destination]
            : [{ x: run.hero.x, z: pavement }, { x: -5, z: pavement }, { x: -5, z: destPavement }, { x: destination.x, z: destPavement }, destination];
      }
      while (waypoints.length > 1 && Math.hypot(waypoints[0].x - run.hero.x, waypoints[0].z - run.hero.z) < 0.3) waypoints.shift();
      const at = waypoints[0];
      const dx = at.x - run.hero.x;
      const dz = at.z - run.hero.z;
      const distance = Math.hypot(dx, dz);
      wait -= 1 / 60;
      const delivered = run.delivered;
      step(run, { ...idle, moveX: wait > 0 ? 0 : dx / Math.max(1, distance), moveY: wait > 0 ? 0 : dz / Math.max(1, distance), actionPressed: waypoints.length === 1 && distance < 0.95 && wait <= 0 }, 1 / 60);
      if (run.delivered > delivered) wait = 0.3;
      else if (waypoints.length === 1 && distance < 0.95 && wait <= 0) wait = 0.35;
   }
   return run;
}

describe("delivery rules", () => {
   it("is seeded, has unique addresses, and loads only bagCap letters", () => {
      const a = createRun(123, LEVELS[5]);
      expect(a).toEqual(createRun(123, LEVELS[5]));
      expect(a.houses).toHaveLength(30);
      expect(new Set(a.items.map((i) => i.house))).toHaveProperty("size", 14);
      expect(a.items.filter((i) => i.loaded && i.kind === "letter")).toHaveLength(5);
      expect(a.items.filter((i) => i.loaded && i.kind === "parcel")).toHaveLength(1);
   });
   it("wrong mailbox stuns exactly 0.40 s without consuming mail", () => {
      const r = createRun(1, LEVELS[1]);
      const wrong = r.houses.find((h) => !r.items.some((i) => i.house === h.number))!;
      Object.assign(r.hero, { x: wrong.x, z: wrong.mailZ });
      step(r, { ...idle, actionPressed: true }, 1 / 60);
      expect(r.hero.stun).toBe(0.4);
      expect(r.delivered).toBe(0);
      expect(r.items.filter((i) => i.loaded)).toHaveLength(4);
   });
   it("letters use mailboxes and parcels use doors; each pays once", () => {
      const r = createRun(3, LEVELS[2]);
      const item = r.items[0];
      const h = r.houses.find((h) => h.number === item.house)!;
      Object.assign(r.hero, { x: h.x, z: h.doorZ });
      step(r, { ...idle, actionPressed: true }, 0.02);
      expect(r.delivered).toBe(0);
      r.hero.stun = 0;
      Object.assign(r.hero, targetFor(r, item));
      step(r, { ...idle, actionPressed: true }, 0.02);
      expect(r.score).toBe(140);
      r.hero.stun = 0;
      step(r, { ...idle, actionPressed: true }, 0.02);
      expect(r.score).toBe(140);
      const parcel = r.items.find((i) => i.kind === "parcel")!;
      const ph = r.houses.find((h) => h.number === parcel.house)!;
      Object.assign(r.hero, { x: ph.x, z: ph.mailZ, stun: 0 });
      step(r, { ...idle, actionPressed: true }, 0.02);
      expect(parcel.delivered).toBe(false);
      Object.assign(r.hero, targetFor(r, parcel), { stun: 0 });
      step(r, { ...idle, actionPressed: true }, 0.02);
      expect(parcel.delivered).toBe(true);
      expect(r.score).toBe(240);
   });
   it("refills only undelivered mail and carries one parcel", () => {
      const r = createRun(1, LEVELS[5]);
      for (const i of r.items) if (i.loaded) { i.loaded = false; i.delivered = true; }
      Object.assign(r.hero, OFFICE);
      step(r, { ...idle, actionPressed: true }, 0.02);
      expect(r.items.filter((i) => i.loaded && i.kind === "letter").length).toBeLessThanOrEqual(5);
      expect(r.items.filter((i) => i.loaded && i.kind === "parcel")).toHaveLength(1);
   });
   it("dogs apply 0.60 s stun and 0.80 s mercy without spending a life", () => {
      const r = createRun(1, LEVELS[3]);
      const d = r.dogs[0];
      Object.assign(r.hero, { x: d.x, z: d.z });
      step(r, idle, 0.02);
      expect(r.hero.stun).toBe(0.6); expect(r.hero.mercy).toBe(0.8);
      expect(r.lives).toBeNull(); expect(r.event.lifeLost).toBe(false);
      step(r, idle, 0.02);
      expect(r.hero.mercy).toBeCloseTo(0.78);
   });
   it("traffic yields before the zebra and retains swept collision while stopped", () => {
      const r = createRun(1, LEVELS[4]);
      const c = r.cars[0];
      Object.assign(c, { x: -10, z: 1, direction: 1, street: 0 });
      Object.assign(r.hero, { x: -5, z: -4 });
      step(r, idle, 0.05);
      expect(c.stopped).toBe(true); expect(c.x).toBe(-10); expect(r.lives).toBe(3);
      // A stopped vehicle's bumper still collides when approached from its side.
      Object.assign(c, { x: -7.7, z: 1 });
      Object.assign(r.hero, { x: -6.35, z: 1 });
      step(r, idle, 0.05);
      expect(c.stopped).toBe(true); expect(r.lives).toBe(2);
      expect(r.hero.stun).toBe(0.6);
   });
   it("wins pay the time bonus once, and terminal runs ignore further inputs", () => {
      const r = createRun(1, LEVELS[1]);
      r.elapsed = 50;
      for (const item of r.items.slice(0, -1)) { item.delivered = true; item.loaded = false; r.delivered++; r.score += 140; }
      const item = r.items[r.items.length - 1];
      Object.assign(r.hero, targetFor(r, item));
      step(r, { ...idle, actionPressed: true }, 0.02);
      expect(r.over).toBe("win"); expect(r.score).toBe(560 + 5 * 69);
      const score = r.score, elapsed = r.elapsed;
      step(r, { ...idle, actionPressed: true }, 0.05);
      expect(r.score).toBe(score); expect(r.elapsed).toBe(elapsed);
   });
   for (const id of LEVEL_IDS) {
      it(`L${id}: human-paced seeded routes finish; idle and spam cannot score`, () => {
         for (let seed = 0; seed < 12; seed++) {
            const r = play(createRun(seed, LEVELS[id]));
            expect(r.over, `seed ${seed}, delivered ${r.delivered}, elapsed ${r.elapsed}`).toBe("win");
            expect(r.score).toBeGreaterThanOrEqual(r.items.length * 140);
            expect(withinServerLimits(r.score, r.elapsed * 1000, PROPOSED_LEVEL_LIMITS[id]), `score ${r.score} at ${r.elapsed}`).toBe(true);
         }
         for (const spam of [false, true]) {
            const r = createRun(4, LEVELS[id]);
            for (let i = 0; i < LEVELS[id].durationMs / 50; i++) step(r, { ...idle, actionPressed: spam }, 0.05);
            expect(r.score).toBe(0);
            expect(r.over).toBe("timeup");
         }
      });
      it(`L${id}: keyboard and touch use identical timing and results`, () => {
         const keyboard = createInputController(), touch = createInputController();
         const a = createRun(42, LEVELS[id]), b = createRun(42, LEVELS[id]);
         const target = targetFor(a, a.items[0]);
         Object.assign(a.hero, target); Object.assign(b.hero, target);
         keyboard.keyDown("Enter"); touch.setButton("action", true);
         keyboard.latch(); touch.latch();
         step(a, { ...keyboard.state.current, yaw: 0 }, 1 / 60);
         step(b, { ...touch.state.current, yaw: 0 }, 1 / 60);
         expect(a.score).toBe(140); expect(a).toEqual(b);
         for (let f = 0; f < 60; f++) {
            keyboard.latch(); touch.latch();
            step(a, { ...keyboard.state.current, yaw: 0 }, 1 / 60);
            step(b, { ...touch.state.current, yaw: 0 }, 1 / 60);
         }
         expect(a.score).toBe(140); expect(a).toEqual(b);
      });
      it(`L${id}: geometric proof bounds every order without clipping scores`, () => {
         let minimum = Infinity;
         for (let seed = 0; seed < 200; seed++) minimum = Math.min(minimum, minimumTravelSeconds(createRun(seed, LEVELS[id])));
         const base = (LEVELS[id].letters + LEVELS[id].parcels) * 140;
         const bonus = 5 * Math.floor(LEVELS[id].durationMs / 1000 - minimum);
         console.info(`L${id} proof: minimum ${minimum.toFixed(4)}, maxScore ${base + bonus}, pps ${Math.ceil(bonus / minimum)}`);
         expect(base + bonus).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore);
         expect(bonus / minimum).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxPointsPerSec);
      });
      it(`L${id}: list order stays close to the shortest legal inventory tour`, () => {
         const seen = new Set<string>();
         for (let seed = 0; seed < 20; seed++) {
            const r = createRun(seed, LEVELS[id]);
            const key = r.items.map((i) => i.house).join(",");
            if (seen.has(key)) continue;
            seen.add(key);
            const comparison = compareTours(r);
            expect(comparison.list / comparison.optimal).toBeLessThan(1.6);
         }
         expect(seen.size).toBe(2);
      });
   }
});

// Every completion contains a connected path through all interaction discs.
// The MST of pairwise disc distances is <= that path's length, even when
// delivering out of order. Ignore collisions, parcels, dog stuns and refills:
// all can only make the real route longer. There are just two position layouts.
export function minimumTravelSeconds(run: Run) {
   const points = [OFFICE, ...run.items.map((i) => targetFor(run, i))];
   const used = points.map(() => false);
   const distance = points.map(() => Infinity);
   distance[0] = 0;
   let length = 0;
   for (let n = 0; n < points.length; n++) {
      let k = -1;
      for (let i = 0; i < points.length; i++) if (!used[i] && (k < 0 || distance[i] < distance[k])) k = i;
      used[k] = true; length += distance[k];
      for (let j = 0; j < points.length; j++) {
         const gap = Math.max(0, Math.hypot(points[k].x - points[j].x, points[k].z - points[j].z) - (k === 0 || j === 0 ? REACH : 2 * REACH));
         if (!used[j]) distance[j] = Math.min(distance[j], gap);
      }
   }
   return length / SPEED;
}

// Exact geometry oracle, not a bot. Held–Karp finds every possible delivery
// trip; the outer subset DP permits refilling after ANY subset. Each trip is
// limited to the actual first bagCap remaining letters and next single parcel.
// This accounts for compulsory post-office returns rather than pretending a
// courier can carry all parcels at once. Neither tour adds artificial waits.
function compareTours(run: Run) {
   const n = run.items.length, total = (1 << n) - 1;
   const points = run.items.map((i) => targetFor(run, i));
   const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
   const start = points.map((p) => dist(OFFICE, p));
   const edges = points.map((a) => points.map((b) => dist(a, b)));
   const dp = new Float64Array((total + 1) * n).fill(Infinity);
   const closed = new Float64Array(total + 1).fill(Infinity);
   const open = new Float64Array(total + 1).fill(Infinity);
   for (let j = 0; j < n; j++) dp[(1 << j) * n + j] = start[j];
   for (let mask = 1; mask <= total; mask++) {
      for (let last = 0; last < n; last++) {
         if (!(mask & (1 << last))) continue;
         const previous = mask ^ (1 << last);
         if (previous) {
            let best = Infinity;
            for (let k = 0; k < n; k++) if (previous & (1 << k)) best = Math.min(best, dp[previous * n + k] + edges[k][last]);
            dp[mask * n + last] = best;
         }
         open[mask] = Math.min(open[mask], dp[mask * n + last]);
         closed[mask] = Math.min(closed[mask], dp[mask * n + last] + start[last]);
      }
   }
   const inventoryAt = (delivered: number) => {
      let bag = 0, parcel = false, inventory = 0;
      for (let i = 0; i < n; i++) {
         if (delivered & (1 << i)) continue;
         if (run.items[i].kind === "letter" && bag < run.level.bagCap) { inventory |= 1 << i; bag++; }
         if (run.items[i].kind === "parcel" && !parcel) { inventory |= 1 << i; parcel = true; }
      }
      return inventory;
   };
   const best = new Float64Array(total + 1).fill(Infinity); best[0] = 0;
   for (let delivered = 0; delivered < total; delivered++) {
      if (!Number.isFinite(best[delivered])) continue;
      const inventory = inventoryAt(delivered);
      for (let trip = inventory; trip; trip = (trip - 1) & inventory) {
         const after = delivered | trip;
         best[after] = Math.min(best[after], best[delivered] + (after === total ? open[trip] : closed[trip]));
      }
   }
   let delivered = 0, inventory = inventoryAt(0), list = 0, at = OFFICE;
   for (let i = 0; i < n; i++) {
      if (!(inventory & (1 << i))) { list += dist(at, OFFICE); at = OFFICE; inventory = inventoryAt(delivered); }
      list += dist(at, points[i]); at = points[i]; delivered |= 1 << i; inventory &= ~(1 << i);
   }
   return { list, optimal: best[total] };
}
