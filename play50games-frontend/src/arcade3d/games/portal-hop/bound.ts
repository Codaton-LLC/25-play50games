// The score proof's bound (README "Server limits and why they hold"). Pure, three-free.
//
// A win's submitted time is the finish less 0.1 s an orb and the flow bonus. The floor on a finish
// (levels 1-4) is the quickest way through the portal graph, measured in HORIZONTAL travel (falling is
// free; nothing but the horizontal reach of the entries and the goal ring matters):
//   - WALKING: on the ground the hero runs at V_RUN; Riko's dash adds (V_DASH - V_RUN) for 0.35 s every
//     6 s (at most one at t = 0 and one per cooldown after: the global allowance below). In the air the
//     stick only steers up to V_RUN, and a landing STICKS (rules.ts clamps the horizontal speed to V_RUN),
//     so walking, jumping and falling off a ledge never go faster than that;
//   - FLYING out of an exit: the only way to move faster. The exit's speed is what went in, which the
//     level's energy bounds: on the ground E <= g (highest top) + (V_DASH^2 + V_JUMP^2 + V_JUMP2^2) / 2, a
//     teleport adds g (exit height - entry height), a grounded dash adds DASH_PORTAL_BONUS, and no speed
//     passes V_CAP; the fixed point over every pair gives each exit's speed S. The flight then moves at
//     most S cos(pitch) + V_RUN (the stick's air control) for at most the longest flight it can make
//     (straight up with Nami's second jump, down to the lowest surface of the level); the rest of the leg
//     is walking.
// A leg ends at an entry (a free jump to any of its pair's exits) or at the goal ring; each node has
// the reach a body may cut (the ring's radius, a frame's half width, a pad's radius, the hero's radius).
// Level 5: the win is the Wyrm's defeat: bossMinMs() runs menu2/boss with a perfect hitter that lands a
// hit in the first ms of every vulnerable window, the fastest the machine allows.
// The limits row is that floor less the largest bonus (orbs + the flow meter's most), less 6 %,
// rounded down to 100 ms.
import type { LevelId } from "../../types";
import { createBoss, createBossEvents, hitBoss, stepBoss } from "@/arcade3d/menu2/boss/boss";
import { EXIT_OUT, EXIT_UP, FRAME_HALF_W, courseFor, exitPose, type Course, type ExitPose } from "./course";
import { LEVELS } from "./levels";
import { WYRM } from "./progression";
import { DASH_PORTAL_BONUS, POWER_MS, V_DASH, heroById } from "./heroes";
import { BODY_MID, BODY_R, GRAV, V_CAP, V_JUMP, V_JUMP2, V_RUN, maxBonusMs, type LevelLimits } from "./rules";

/** The Wyrm's least defeat time (ms) from the start: a hit in the first ms of every vulnerable window. */
export function bossMinMs(): number {
   const b = createBoss(WYRM);
   const ev = createBossEvents();
   let ms = 0;
   for (let guard = 0; guard < 400_000; guard++) {
      stepBoss(b, WYRM, 1, ev);
      ms += 1;
      if (b.step === "vulnerable" && hitBoss(b, WYRM, 1, ev) === "defeated") return ms;
   }
   return ms;
}

const POSE: ExitPose = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, ax: 0, az: 0, yaw: 0 };

/** The centre height a body crosses an entry at. */
function entryHeight(c: Course, pair: number): number {
   const e = c.pairs[pair].entry;
   return e.kind === "wall" ? e.y + EXIT_UP : e.y + BODY_MID;
}

/** Each pair's most speed in (m/s): the energy fixed point (header). */
export function entrySpeeds(c: Course): number[] {
   let top = -Infinity;
   for (const i of c.islands) top = Math.max(top, i.y);
   let energy = GRAV * top + (V_DASH * V_DASH + V_JUMP * V_JUMP + V_JUMP2 * V_JUMP2) / 2;
   const capK = (V_CAP * V_CAP) / 2;
   const dashK = ((V_DASH + DASH_PORTAL_BONUS) ** 2) / 2;
   const kinIn = (pair: number): number => {
      let k = Math.min(capK, Math.max(0, energy - GRAV * entryHeight(c, pair)));
      if (c.pairs[pair].entry.kind === "wall") k = Math.max(k, Math.min(capK, dashK));
      return k;
   };
   for (let iter = 0; iter < 64; iter++) {
      let next = energy;
      for (const p of c.pairs) {
         const k = kinIn(p.id);
         for (const id of p.anchors) {
            const a = c.anchors[id];
            next = Math.max(next, GRAV * (a.y + EXIT_UP) + k);
         }
      }
      if (next <= energy + 1e-9) break;
      energy = next;
   }
   return c.pairs.map((p) => Math.min(V_CAP, Math.sqrt(2 * kinIn(p.id))));
}

interface Node {
   x: number;
   z: number;
   /** the horizontal reach round it a body may cut (m) */
   reach: number;
   /** an orbiting anchor's exit: anywhere on this circle round (x, z) */
   ring: number;
}

interface Flight {
   node: Node;
   /** the most horizontal speed in the flight and its longest time */
   vh: number;
   t: number;
}

function gap(a: Node, b: Node): number {
   return Math.max(0, Math.hypot(a.x - b.x, a.z - b.z) - a.ring - b.ring - a.reach - b.reach);
}

/** The least time (s) to cover d horizontally out of a flight (then walking at V_RUN). */
function legTime(d: number, f: Flight | null): number {
   if (!f) return d / V_RUN;
   const far = f.vh * f.t;
   return d <= far ? d / f.vh : f.t + (d - far) / V_RUN;
}

/** min over routes of (flight time + walked distance / V_RUN), in s (the header's B). */
export function routeFloor(c: Course): number {
   if (!c.goal) return 0;
   let low = Infinity;
   for (const i of c.islands) low = Math.min(low, i.y);
   for (const p of c.pairs) if (p.entry.kind === "floor") low = Math.min(low, p.entry.y);
   const speeds = entrySpeeds(c);
   const start: Node = { x: c.start.x, z: c.start.z, reach: 0, ring: 0 };
   const goal: Node = { x: c.goal.x, z: c.goal.z, reach: c.goal.r + BODY_R, ring: 0 };
   const entries: Node[] = c.pairs.map((p) => ({ x: p.entry.x, z: p.entry.z, reach: p.entry.kind === "wall" ? FRAME_HALF_W + BODY_R : p.entry.r + BODY_R, ring: 0 }));
   const flights: Flight[][] = c.pairs.map((p) =>
      p.anchors.map((id) => {
         const a = c.anchors[id];
         exitPose(c, a, 0, POSE);
         const s = speeds[p.id];
         const vh = s * Math.cos(a.pitch) + V_RUN;
         const up = Math.max(0, s * Math.sin(a.pitch)) + V_JUMP2;
         const drop = Math.max(0, POSE.y - (low + BODY_MID));
         const t = (up + Math.sqrt(up * up + 2 * GRAV * drop)) / GRAV;
         const node: Node = a.orbit ? { x: a.orbit.cx, z: a.orbit.cz, reach: BODY_R, ring: a.orbit.r + EXIT_OUT } : { x: POSE.x, z: POSE.z, reach: BODY_R, ring: 0 };
         return { node, vh, t };
      }),
   );
   const n = entries.length;
   const dist = new Array<number>(n + 1).fill(Infinity);
   const done = new Array<boolean>(n + 1).fill(false);
   for (let e = 0; e < n; e++) dist[e] = legTime(gap(start, entries[e]), null);
   dist[n] = legTime(gap(start, goal), null);
   for (let iter = 0; iter <= n; iter++) {
      let u = -1;
      for (let k = 0; k <= n; k++) if (!done[k] && (u < 0 || dist[k] < dist[u])) u = k;
      if (u < 0 || u === n) break;
      done[u] = true;
      for (const f of flights[u]) {
         for (let e = 0; e < n; e++) dist[e] = Math.min(dist[e], dist[u] + legTime(gap(f.node, entries[e]), f));
         dist[n] = Math.min(dist[n], dist[u] + legTime(gap(f.node, goal), f));
      }
   }
   return dist[n];
}

/** The least play time (ms) any run can finish level `id` in. */
export function minFinishMs(id: LevelId): number {
   if (LEVELS[id].boss) return bossMinMs();
   // Riko's dashes: walked distance W <= V_RUN T_w + x (1 + T / cooldown), x the extra metres of one dash,
   // so T (1 + x / (V_RUN cooldown)) >= B - x / V_RUN
   const x = (V_DASH - V_RUN) * (POWER_MS.dash / 1000);
   const cd = heroById("riko").cooldownMs / 1000;
   const b = routeFloor(courseFor(id));
   return (Math.max(0, b - x / V_RUN) / (1 + x / (V_RUN * cd))) * 1000;
}

export function minDurationMsOf(id: LevelId): number {
   return Math.max(0, minFinishMs(id) - maxBonusMs(id));
}

/** The level's limits row: the bound less 6 %, to the 100 ms below; maxScore the best possible time score. */
export function proposeLimits(id: LevelId): LevelLimits {
   const minDurationMs = Math.floor((minDurationMsOf(id) * 0.94) / 100) * 100;
   const timeBaseMs = LEVELS[id].durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: timeBaseMs, timeBaseMs };
}
