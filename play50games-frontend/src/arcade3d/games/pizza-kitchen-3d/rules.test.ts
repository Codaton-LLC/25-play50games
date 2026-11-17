import { describe, expect, it } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVELS } from "./levels";
import { TUNING, applyStation, bakeGrade, createRun, frame, nearestStation, step, type Run } from "./rules";

/** Put the cook in front of a station and press it once (after the cooldown and any stun). */
function use(r: Run, id: string) {
   const s = r.stations.find((x) => x.id === id)!;
   r.player.x = s.x;
   r.player.z = TUNING.minZ;
   r.time = Math.max(r.time, r.nextUse, r.stunUntil);
   applyStation(r, id);
}
/** Build the next open ticket's whole pizza and put it in `oven`. */
function build(r: Run, oven = "oven0") {
   use(r, "dough");
   const t = r.tickets[r.prep!.ticket];
   for (const ing of t.ingredients) use(r, ing);
   use(r, oven);
}

describe("pizza-kitchen-3d rules", () => {
   it("is deterministic per seed, and L1 tickets are cheese pizzas", () => {
      expect(createRun(7, LEVELS[3]).tickets).toEqual(createRun(7, LEVELS[3]).tickets);
      expect(createRun(7, LEVELS[3]).tickets).not.toEqual(createRun(8, LEVELS[3]).tickets);
      for (let seed = 1; seed < 50; seed++) expect(createRun(seed, LEVELS[1]).tickets.every((t) => t.ingredients.join() === "sauce,cheese")).toBe(true);
      for (let seed = 1; seed < 200; seed++) {
         for (const id of [2, 3, 4, 5] as const) {
            for (const t of createRun(seed, LEVELS[id]).tickets) {
               const tops = t.ingredients.slice(2);
               expect(tops.length).toBeLessThanOrEqual(LEVELS[id].maxToppings);
               expect(new Set(tops).size).toBe(tops.length);
               for (const x of tops) expect(["pepperoni", "mushroom", "olive", "tomato", "onion"].indexOf(x)).toBeLessThan(LEVELS[id].toppingTypes);
            }
         }
      }
   });

   it("same inputs, same result (a scripted replay)", () => {
      const play = () => {
         const r = createRun(11, LEVELS[3]);
         for (let i = 0; i < 2000; i++) step(r, 1 / 60, Math.sin(i / 40), Math.cos(i / 55), i % 17 === 0);
         return { p: r.player, s: r.score, t: r.tickets.map((t) => t.state), m: r.message };
      };
      expect(play()).toEqual(play());
   });

   it("grades the bake: raw, perfect for the first 1.5 s of golden, good, burnt", () => {
      const l = LEVELS[1];
      expect(bakeGrade(l.bakeS - 0.01, l)).toBe("raw");
      expect(bakeGrade(l.bakeS, l)).toBe("perfect");
      expect(bakeGrade(l.bakeS + 1.49, l)).toBe("perfect");
      expect(bakeGrade(l.bakeS + 1.5, l)).toBe("good");
      expect(bakeGrade(l.bakeS + l.goldenS - 0.01, l)).toBe("good");
      expect(bakeGrade(l.bakeS + l.goldenS, l)).toBe("burnt");
   });

   it("a wrong or out-of-order ingredient spoils the pizza and stuns 0.50 s", () => {
      const r = createRun(1, LEVELS[1]);
      use(r, "dough");
      use(r, "cheese");
      expect(r.prep).toBeNull();
      expect(r.stunUntil - r.time).toBeCloseTo(TUNING.wrongStun, 10);
      expect(r.score).toBe(0);
      const x = r.player.x;
      step(r, 0.05, 1, 0, true);
      expect(r.player.x).toBe(x);
      let checked = false;
      for (let seed = 1; seed < 400 && !checked; seed++) {
         const q = createRun(seed, LEVELS[3]);
         const t = q.tickets[0];
         if (t.ingredients.length < 4) continue;
         use(q, "dough");
         use(q, "sauce");
         use(q, "cheese");
         use(q, t.ingredients[3]);
         expect(q.prep).toBeNull();
         checked = true;
      }
      expect(checked).toBe(true);
   });

   it("scores 150 + 50 perfect + 30 fresh once per ticket; a good bake 180; burnt pays 0 and keeps the ticket", () => {
      const r = createRun(3, LEVELS[1]);
      build(r);
      r.time = r.ovens[0]!.startedAt + LEVELS[1].bakeS;
      use(r, "oven0");
      expect(r.carried?.perfect).toBe(true);
      use(r, "serve");
      expect(r.score).toBe(230);
      expect(r.lastPoints).toBe(230);
      use(r, "serve");
      expect(r.score).toBe(230);
      build(r);
      r.time = r.ovens[0]!.startedAt + LEVELS[1].bakeS + 2;
      use(r, "oven0");
      use(r, "serve");
      expect(r.score).toBe(230 + 180);
      build(r);
      const ticket = r.ovens[0]!.pizza.ticket;
      r.time = r.ovens[0]!.startedAt + LEVELS[1].bakeS + LEVELS[1].goldenS;
      use(r, "oven0");
      expect(r.carried).toBeNull();
      expect(r.ovens[0]).toBeNull();
      expect(r.tickets[ticket].state).toBe("open");
      expect(r.score).toBe(410);
   });

   it("a raw take-out does nothing; two ovens bake independently", () => {
      const r = createRun(5, LEVELS[3]);
      build(r, "oven0");
      const a = r.ovens[0]!.startedAt;
      r.time += 2;
      build(r, "oven1");
      const b = r.ovens[1]!.startedAt;
      expect(b - a).toBeGreaterThan(1.9);
      r.time = a + LEVELS[3].bakeS - 0.1;
      use(r, "oven0");
      expect(r.ovens[0]).not.toBeNull();
      r.time = a + LEVELS[3].bakeS;
      use(r, "oven0");
      expect(r.carried?.perfect).toBe(true);
      expect(bakeGrade(r.time - b, LEVELS[3])).toBe("raw");
      expect(r.ovens[1]).not.toBeNull();
   });

   it("L5 needs the box before the hatch", () => {
      const r = createRun(9, LEVELS[5]);
      build(r);
      r.time = r.ovens[0]!.startedAt + LEVELS[5].bakeS;
      use(r, "oven0");
      use(r, "serve");
      expect(r.served).toBe(0);
      expect(r.message).toBe("Box it first");
      use(r, "box");
      use(r, "serve");
      expect(r.served).toBe(1);
   });

   it("patience: an expired ticket pays 0; a second expiry loses on L4; L3 tickets wait; fresh pays only before half", () => {
      const r = createRun(2, LEVELS[4]);
      for (let i = 0; i < 45 * 20 + 2; i++) step(r, 0.05, 0, 0, false);
      expect(r.expired).toBe(2);
      expect(r.end).toBe("lose");
      expect(r.score).toBe(0);
      const q = createRun(2, LEVELS[3]);
      for (let i = 0; i < 170 * 20; i++) step(q, 0.05, 0, 0, false);
      expect(q.expired).toBe(0);
      expect(q.end).toBeNull();
      const f = createRun(4, LEVELS[4]);
      build(f);
      f.time = f.ovens[0]!.startedAt + LEVELS[4].bakeS;
      use(f, "oven0");
      use(f, "serve");
      expect(f.lastPoints).toBe(230);
      build(f);
      f.time = 23;
      f.ovens[0]!.startedAt = 23 - LEVELS[4].bakeS;
      use(f, "oven0");
      use(f, "serve");
      expect(f.lastPoints).toBe(200);
   });

   it("wins after every ticket with +4 per full second left, and the store ends with win", () => {
      const store = createArcadeStore();
      store.getState().configure({ durationMs: LEVELS[1].durationMs });
      store.getState().markReady();
      store.getState().start();
      for (let i = 0; i < 70; i++) store.getState().tick(50);
      expect(store.getState().phase).toBe("playing");
      const r = createRun(6, LEVELS[1]);
      for (let k = 0; k < 3; k++) {
         build(r);
         r.time = r.ovens[0]!.startedAt + LEVELS[1].bakeS;
         use(r, "oven0");
         use(r, "serve");
      }
      expect(r.end).toBe("win");
      expect(r.score).toBe(690 + 4 * Math.floor(120 - r.time));
      frame(r, 0.016, 0, 0, false, store);
      expect(store.getState().endReason).toBe("win");
      expect(store.getState().score).toBe(r.score);
   });

   it("the nearest station within 1.2 m is the one a Use reaches", () => {
      const r = createRun(1, LEVELS[5]);
      for (const s of r.stations) {
         r.player.x = s.x + 0.7;
         r.player.z = TUNING.minZ;
         expect(nearestStation(r)?.id).toBe(s.id);
      }
      r.player.z = TUNING.maxZ;
      expect(nearestStation(r)).toBeUndefined();
   });

   it("one Use per press: the 0.22 s cooldown is the same on every device", () => {
      const r = createRun(1, LEVELS[1]);
      use(r, "dough");
      const t = r.time;
      r.player.x = r.stations[1].x;
      applyStation(r, "sauce");
      expect(r.prep?.added).toBe(0);
      r.time = t + TUNING.useCooldown;
      applyStation(r, "sauce");
      expect(r.prep?.added).toBe(1);
   });

   it("the mover tops out at 4.2 m/s and stays on the floor", () => {
      const r = createRun(1, LEVELS[2]);
      for (let i = 0; i < 400; i++) step(r, 1 / 60, 1, 1, false);
      expect(Math.hypot(r.player.vx, r.player.vz)).toBeLessThanOrEqual(TUNING.speed + 1e-9);
      expect(r.player.z).toBeLessThanOrEqual(TUNING.maxZ);
      for (let i = 0; i < 400; i++) step(r, 1 / 60, -1, -1, false);
      expect(r.player.z).toBeGreaterThanOrEqual(TUNING.minZ);
   });

   it("probes: refilled tickets keep `parallel` open, maxToppings caps the count, the win bonus counts this level's clock", () => {
      const r = createRun(12, LEVELS[3]);
      build(r);
      r.time = r.ovens[0]!.startedAt + LEVELS[3].bakeS;
      use(r, "oven0");
      use(r, "serve");
      expect(r.tickets.filter((t) => t.state === "open").length).toBe(LEVELS[3].parallel);
      let most = 0;
      for (let seed = 1; seed < 300; seed++) for (const t of createRun(seed, { ...LEVELS[3], maxToppings: 1 }).tickets) most = Math.max(most, t.ingredients.length - 2);
      expect(most).toBe(1);
      const w = createRun(6, LEVELS[2]);
      for (let k = 0; k < LEVELS[2].orders; k++) {
         build(w);
         w.time = w.ovens[0]!.startedAt + LEVELS[2].bakeS;
         use(w, "oven0");
         use(w, "serve");
      }
      expect(w.end).toBe("win");
      expect(w.score).toBe(230 * LEVELS[2].orders + 4 * Math.floor(LEVELS[2].durationMs / 1000 - w.time));
   });
});
