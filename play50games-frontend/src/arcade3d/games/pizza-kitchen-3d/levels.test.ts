import { describe, expect, it } from "vitest";
import { LEVELS, TITLES } from "./levels";
import { LIMITS, pizzaKitchen3dMeta } from "./meta";
import { withinServerLimits, capScore } from "@/arcade3d/core/limits";
import { createRun, step, stations, type Run } from "./rules";

// Human-paced controller: 50 ms frames, 300 ms between presses, real 4.2 m/s walking,
// 180 ms reaction after golden. Never teleports or injects a pizza/score.
export function human(seed: number, id: 1 | 2 | 3 | 4 | 5) {
   const r = createRun(seed, LEVELS[id]);
   const list = stations(r.level);
   let nextPress = 0;
   let usedBoth = false;
   let maxOccupied = 0;
   for (let frame = 0; frame < r.level.durationMs / 50 + 2 && !r.end; frame++) {
      let target = "dough";
      const occupied = r.ovens.map((o, i) => ({ o, i })).filter(v => v.o);
      maxOccupied = Math.max(maxOccupied, occupied.length);
      if (r.carried) target = r.level.boxStep && !r.carried.boxed ? "box" : "serve";
      else {
         const urgent = occupied.find(({ o, i }) => {
            const s = list.find(s => s.id === `oven${i}`)!;
            return r.time - o!.startedAt + Math.hypot(r.player.x - s.x, r.player.z + 0.6) / 4.2 >= r.level.bakeS + 1.2;
         });
         if (urgent) target = `oven${urgent.i}`;
         else if (r.prep) {
            const ticket = r.tickets[r.prep.ticket];
            target = ticket.ingredients[r.prep.added] ?? `oven${r.ovens.findIndex(o => !o)}`;
         } else if (occupied.length === r.level.ovens || r.tickets.filter(t => t.state === "open").every(t => occupied.some(v => v.o!.pizza.ticket === t.id))) {
            target = `oven${occupied[0]?.i ?? 0}`;
         }
      }
      const s = list.find(s => s.id === target)!;
      if (!s) throw new Error(`No station ${target}`);
      const dx = s.x - r.player.x;
      const dz = -0.6 - r.player.z;
      const distance = Math.hypot(dx, dz);
      let press = distance < 0.06 && r.time >= nextPress;
      if (target.startsWith("oven")) {
         const o = r.ovens[Number(target.slice(4))];
         if (o && r.time - o.startedAt < r.level.bakeS + 0.18) press = false;
      }
      if (press) nextPress = r.time + 0.3;
      step(r, 0.05, distance > 0.06 ? dx / Math.max(0.21, distance) : 0, distance > 0.06 ? dz / Math.max(0.21, distance) : 0, press);
      usedBoth ||= maxOccupied === 2;
      expect(r.score).toBeLessThanOrEqual(r.end === "win" ? LIMITS[id].maxScore : LIMITS[id].base);
      if (r.end === "win") break;
   }
   return { r, usedBoth };
}
describe("five level contracts and score proofs", () => {
   it("has the exact five configurations and tile titles", () => {
      expect(Object.values(LEVELS).map(l => l.orders)).toEqual([3, 4, 6, 8, 10]);
      expect(pizzaKitchen3dMeta.levels?.map(l => l.title)).toEqual(TITLES);
      expect(pizzaKitchen3dMeta.owner).toBe("claude");
      expect(pizzaKitchen3dMeta.status).toBe("dev");
   });
   for (const id of [1, 2, 3, 4, 5] as const) {
      it(`L${id}: human bot wins within uncapped server limits`, () => {
         for (const seed of [1, 7, 42, 138]) {
            const { r, usedBoth } = human(seed, id);
            expect(r.end, JSON.stringify({ seed, id, time: r.time, served: r.served, expired: r.expired })).toBe("win");
            expect(withinServerLimits(r.score, r.time * 1000, LIMITS[id])).toBe(true);
            expect(capScore(r.score, r.time * 1000, LIMITS[id])).toBe(r.score);
            if (id >= 3) expect(usedBoth).toBe(true);
         }
      });
      it(`L${id}: analytical bound includes every award and early runs`, () => {
         const l = LEVELS[id];
         expect(LIMITS[id].maxScore).toBe(230 * l.orders + 4 * l.durationMs / 1000);
         // Even an impossible zero-walking oracle needs ceil(orders/ovens) bake waves.
         const floor = Math.ceil(l.orders / l.ovens) * l.bakeS;
         const maximumBonus = 4 * Math.floor(l.durationMs / 1000 - floor);
         expect(maximumBonus).toBeLessThanOrEqual(LIMITS[id].maxPointsPerSec * floor);
      });
   }
});
