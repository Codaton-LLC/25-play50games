// The score proof (README "Server limits and why they hold"): the least finish any run can reach.
// Pure; the tests and the limits table use it, the page never runs it (rules.ts pins the limits).
//
// Levels 1-4 end when the charger holds N cells and you stand in the exit. The N charged cells are
// N different cells (a charged cell is gone), so the latest-emitted of them left the dispenser no
// earlier than firstMs + (N - 1) * cadence: the dispenser lets a cell out only on its fixed beat,
// and skips the beat when the line is full. That cell then rode at most 2.5 m/s, tile centre to
// tile centre, so it needed at least d tiles * 0.8 s, where d is the fewest tile steps from the
// dispenser to the charger over every tile a cell can sit on, in ANY direction (turntables, klaxon
// reversals and wiring ignored), with each robot arm a free jump from its pad to its drop. The only
// other ways a cell moves are Riko's flick and Zuno's magnet: one tile each, once per power use, so
// a journey of T ms gets at most 1 + T / cooldown free tiles: T >= 0.8 s * (d - 1 - T / cooldown).
// Holds, waits, presses and the hero's own walk only add time. Level 5 ends at M-8's defeat: its
// windows are time-driven from the start (menu2/boss), so it falls no earlier than every window
// hit at its first ms. Then the least submitted time takes off every orb and the most flow bonus.
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss } from "@/arcade3d/menu2/boss/boss";
import type { LevelId } from "@/arcade3d/types";
import { HEROES } from "./heroes";
import { OVERSEER } from "./progression";
import { BELT_V, ORB, comboSpecOf, type LevelLimits } from "./rules";
import { DC, DR, H, K, TILE, W, at, inside, type Floor } from "./factory";

/** The fewest tile steps a cell can take from the dispenser to the charger (any direction, arms free). */
export function cellSteps(floor: Floor): number {
   const ok = (i: number) => {
      const k = floor.tiles[i].k;
      return k === K.Belt || k === K.Turn || k === K.Disp || k === K.Pad || k === K.Charger;
   };
   const dist = new Array<number>(W * H).fill(Infinity);
   const [sc, sr] = floor.dispenser;
   const queue: number[] = [at(sc, sr)];
   dist[queue[0]] = 0;
   // 0-1 BFS: an arm is a free edge
   while (queue.length > 0) {
      const i = queue.shift()!;
      const c = i % W;
      const r = Math.floor(i / W);
      for (const a of floor.spec.arms) {
         if (a.pad[0] !== c || a.pad[1] !== r) continue;
         const j = at(a.drop[0], a.drop[1]);
         if (dist[j] > dist[i]) {
            dist[j] = dist[i];
            queue.unshift(j);
         }
      }
      for (let d = 0; d < 4; d++) {
         const nc = c + DC[d];
         const nr = r + DR[d];
         if (!inside(nc, nr)) continue;
         const j = at(nc, nr);
         if (!ok(j) || dist[j] <= dist[i] + 1) continue;
         dist[j] = dist[i] + 1;
         if (floor.tiles[j].k !== K.Charger) queue.push(j);
      }
   }
   const [cc, cr] = floor.charger;
   return dist[at(cc, cr)];
}

const STEP_MS = (TILE / BELT_V) * 1000;

/** The least ms a cell's journey can take: the steps at belt speed, less the flicks / hops a power can give. */
export function travelFloorMs(floor: Floor): number {
   const d = cellSteps(floor);
   let best = d * STEP_MS;
   for (const h of HEROES) {
      if (h.power !== "dash" && h.power !== "magnet") continue;
      // T >= STEP * (d - 1 - T / cd)  =>  T >= STEP * (d - 1) / (1 + STEP / cd)
      const t = (STEP_MS * Math.max(0, d - 1)) / (1 + STEP_MS / h.cooldownMs);
      best = Math.min(best, t);
   }
   return Math.floor(best);
}

/** M-8's least defeat time from the start: every window hit at its first ms. */
export function bossMinMs(): number {
   const s = createBoss(OVERSEER);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, OVERSEER, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, OVERSEER, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

/** The proven least finish ms. */
export function minFinishMs(floor: Floor): number {
   if (floor.spec.boss) return bossMinMs();
   const spec = floor.spec;
   return spec.firstMs + (spec.cells - 1) * spec.cadenceMs + travelFloorMs(floor);
}

export function minDurationMsOf(floor: Floor): number {
   return minFinishMs(floor) - floor.spec.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(floor));
}

/** minDurationMs = the bound less about 4.5 %, rounded down to 100 ms (94-100 % of it). */
export function proposeLimits(id: LevelId, floor: Floor, durationMs: number): LevelLimits {
   const lb = minDurationMsOf(floor);
   let minDurationMs = Math.floor((lb * 0.955) / 100) * 100;
   if (minDurationMs < lb * 0.94) minDurationMs = Math.ceil((lb * 0.94) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb / 100) * 100;
   void id;
   return { kind: "time", maxScore: Math.floor((durationMs - minDurationMs) / 10), minDurationMs, maxDurationMs: durationMs, timeBaseMs: durationMs };
}
