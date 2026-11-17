// The score proof's bound (README "Server limits and why they hold"). Pure, three-free.
//
// A win's submitted time is the finish less 0.1 s an orb and the flow bonus. The floor on a finish
// (levels 1-4) is, for each hero, the quickest way through the portal graph measured in HORIZONTAL
// travel (falling is free; only the horizontal reach of the entries and the goal ring matters); the
// level's floor is the least over the five heroes:
//   - WALKING: on the ground the hero runs at V_RUN; Riko's dash adds (V_DASH - V_RUN) for 0.35 s every
//     6 s (one at t = 0 and one per cooldown after: the allowance in minFinishMs). In the air, unless he
//     was just flung out of an exit, rules.ts clamps the horizontal speed to V_RUN (after a dash), and a
//     landing STICKS (clamps it to V_RUN), so walking, jumping and falling off ledges never beat it;
//   - FLYING out of an exit: the only way to move faster. The exit's speed is what went in. Into an
//     entry a hero brings at most: a run-in (Riko +DASH_PORTAL_BONUS on the ground), a jump into a
//     frame, a fall from an island top (or a crystal on it) whose rim he can walk off within the fall's
//     own time, or the speed of an earlier flight that can reach the entry plus what gravity adds; the
//     fixed point over the pairs gives each exit's speed S (never over V_CAP). A flight then moves at
//     most hypot(S cos(pitch), V_RUN) (the stick's air control) for at most its longest time (straight
//     up, with Nami's second jump, down to the lowest surface of the level); the rest of the leg is walked.
// A leg ends at an entry (a free jump to any of its pair's exits) or at the goal ring; each node keeps
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
import { DASH_PORTAL_BONUS, POWER_MS, V_DASH, heroById, type HeroId } from "./heroes";
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

/** What a hero brings to the bound: Riko's dash (+4 into a portal on a grounded run-in, its walk allowance), Nami's second jump. */
export interface HeroCaps {
   dash: boolean;
   jump2: boolean;
}

export const HERO_CAPS: Record<HeroId, HeroCaps> = {
   riko: { dash: true, jump2: false },
   nami: { dash: false, jump2: true },
   kiro: { dash: false, jump2: false },
   zuno: { dash: false, jump2: false },
   vexa: { dash: false, jump2: false },
};

interface Node {
   x: number;
   z: number;
   /** the horizontal reach round it a body may cut (m) */
   reach: number;
   /** an orbiting anchor's exit: anywhere on this circle round (x, z) */
   ring: number;
}

export interface Flight {
   /** the exit's horizontal position, and the way it faces (an orbiting anchor: its ring, any way out) */
   x: number;
   z: number;
   dx: number;
   dz: number;
   ring: number;
   /** the pair it belongs to, and the exit centre's height */
   pair: number;
   y: number;
   /** the exit's horizontal speed, the flight's longest time, and the most height it climbs over the exit */
   vh: number;
   t: number;
   rise: number;
}

const SAMPLES = 96;

/** How far (horizontally) node n is from the flight's ballistic point at time t (s). */
function offLine(f: Flight, n: Node, t: number): number {
   const run = f.vh * t;
   if (f.ring > 0) return Math.abs(Math.hypot(n.x - f.x, n.z - f.z) - (f.ring + run));
   return Math.hypot(n.x - (f.x + f.dx * run), n.z - (f.z + f.dz * run));
}

/**
 * The least time (s) out of flight f to reach node n: in the air the stick drifts the body at most
 * V_RUN t off the ballistic line; after landing it walks at V_RUN. So the time is at least
 * min over t in [0, T] of t + max(0, off(t) - reach - V_RUN t) / V_RUN.
 */
function flightLeg(f: Flight, n: Node): number {
   let best = Infinity;
   for (let k = 0; k <= SAMPLES; k++) {
      const t = (f.t * k) / SAMPLES;
      // a sample may land between two others: take the off-line distance less what one sample step can move
      const slack = ((f.vh + V_RUN) * f.t) / SAMPLES;
      const d = Math.max(0, offLine(f, n, t) - n.reach - V_RUN * t - slack);
      best = Math.min(best, t + d / V_RUN);
   }
   return best;
}

function gap(a: Node, b: Node): number {
   return Math.max(0, Math.hypot(a.x - b.x, a.z - b.z) - a.ring - b.ring - a.reach - b.reach);
}

/** The centre height a body crosses an entry at. */
function entryHeight(c: Course, pair: number): number {
   const e = c.pairs[pair].entry;
   return e.kind === "wall" ? e.y + EXIT_UP : e.y + BODY_MID;
}

function entryNodes(c: Course): Node[] {
   return c.pairs.map((p) => ({ x: p.entry.x, z: p.entry.z, reach: p.entry.kind === "wall" ? FRAME_HALF_W + BODY_R : p.entry.r + BODY_R, ring: 0 }));
}

/** The hero's most horizontal speed walking (Riko's dash V_DASH while it lasts). */
const walkV = (h: HeroCaps): number => (h.dash ? V_DASH : V_RUN);
/** The most height a hero's own legs lift him over where he stands. */
const legRise = (h: HeroCaps): number => (V_JUMP * V_JUMP) / (2 * GRAV) + (h.jump2 ? (V_JUMP2 * V_JUMP2) / (2 * GRAV) : 0);

/** Each pair's most speed in (m/s) for one hero, and every exit's flight (header). */
export function entrySpeeds(c: Course, h: HeroCaps): { speed: number[]; flights: Flight[][] } {
   let low = Infinity;
   for (const i of c.islands) low = Math.min(low, i.y);
   for (const p of c.pairs) if (p.entry.kind === "floor") low = Math.min(low, p.entry.y);
   const crate = c.blocks.length > 0 ? 1.2 : 0;
   const entries = entryNodes(c);
   const speed = c.pairs.map((p) => {
      const ye = entryHeight(c, p.id);
      const e = entries[p.id];
      // a jump into it from the ground, or a run-in (Riko's dash adds its bonus on the ground)
      let v = Math.hypot(walkV(h), V_JUMP);
      if (p.entry.kind === "wall" && h.dash) v = Math.max(v, V_DASH + DASH_PORTAL_BONUS);
      // a fall from an island top whose rim a walker covers within the fall
      for (const i of c.islands) {
         const fall = i.y + crate + legRise(h) + BODY_MID - ye;
         if (fall <= 0) continue;
         const t = Math.sqrt((2 * fall) / GRAV) + (2 * V_JUMP) / GRAV + (h.jump2 ? (2 * V_JUMP2) / GRAV : 0);
         const rim = Math.max(0, Math.hypot(i.x - e.x, i.z - e.z) - i.r - e.reach);
         if (rim <= walkV(h) * t) v = Math.max(v, Math.hypot(walkV(h), Math.sqrt(2 * GRAV * fall)));
      }
      return Math.min(V_CAP, v);
   });
   const flights: Flight[][] = [];
   const build = () => {
      flights.length = 0;
      for (const p of c.pairs) {
         flights.push(
            p.anchors.map((id) => {
               const a = c.anchors[id];
               exitPose(c, a, 0, POSE);
               const s = speed[p.id];
               const vh = s * Math.cos(a.pitch);
               const vyUp = Math.max(0, s * Math.sin(a.pitch));
               const rise = (vyUp * vyUp) / (2 * GRAV) + (h.jump2 ? (V_JUMP2 * V_JUMP2) / (2 * GRAV) : 0);
               const up = Math.sqrt(2 * GRAV * rise);
               const drop = Math.max(0, POSE.y - (low + BODY_MID));
               const t = (up + Math.sqrt(up * up + 2 * GRAV * drop)) / GRAV;
               const len = Math.hypot(POSE.dx, POSE.dz) || 1;
               if (a.orbit) return { x: a.orbit.cx, z: a.orbit.cz, dx: 0, dz: 0, ring: a.orbit.r + EXIT_OUT, pair: p.id, y: POSE.y, vh, t, rise };
               return { x: POSE.x, z: POSE.z, dx: POSE.dx / len, dz: POSE.dz / len, ring: 0, pair: p.id, y: POSE.y, vh, t, rise };
            }),
         );
      }
   };
   for (let iter = 0; iter < 64; iter++) {
      build();
      let changed = false;
      for (const p of c.pairs) {
         const ye = entryHeight(c, p.id);
         for (const fs of flights)
            for (const f of fs) {
               // reachable within the flight (the stick's drift counted), with what gravity and the drift add
               if (flightLeg(f, entries[p.id]) > f.t + 1e-9) continue;
               const sIn = Math.min(V_CAP, Math.sqrt(speed[f.pair] ** 2 + V_RUN * V_RUN + Math.max(0, 2 * GRAV * (f.y + f.rise - ye))));
               if (sIn > speed[p.id] + 1e-9) {
                  speed[p.id] = sIn;
                  changed = true;
               }
            }
      }
      if (!changed) break;
   }
   build();
   return { speed, flights };
}


/** min over routes of (flight time + walked distance / V_RUN) for one hero, in s (the header's B). */
export function routeFloor(c: Course, h: HeroCaps): number {
   if (!c.goal) return 0;
   const { flights } = entrySpeeds(c, h);
   const start: Node = { x: c.start.x, z: c.start.z, reach: 0, ring: 0 };
   const goal: Node = { x: c.goal.x, z: c.goal.z, reach: c.goal.r + BODY_R, ring: 0 };
   const entries = entryNodes(c);
   const n = entries.length;
   const dist = new Array<number>(n + 1).fill(Infinity);
   const done = new Array<boolean>(n + 1).fill(false);
   for (let e = 0; e < n; e++) dist[e] = gap(start, entries[e]) / V_RUN;
   dist[n] = gap(start, goal) / V_RUN;
   for (let iter = 0; iter <= n; iter++) {
      let u = -1;
      for (let k = 0; k <= n; k++) if (!done[k] && (u < 0 || dist[k] < dist[u])) u = k;
      if (u < 0 || u === n) break;
      done[u] = true;
      for (const f of flights[u]) {
         for (let e = 0; e < n; e++) dist[e] = Math.min(dist[e], dist[u] + flightLeg(f, entries[e]));
         dist[n] = Math.min(dist[n], dist[u] + flightLeg(f, goal));
      }
   }
   return dist[n];
}

/** The least play time (ms) any run can finish level `id` in. */
export function minFinishMs(id: LevelId): number {
   if (LEVELS[id].boss) return bossMinMs();
   const c = courseFor(id);
   let best = Infinity;
   for (const hero of Object.keys(HERO_CAPS) as HeroId[]) {
      const caps = HERO_CAPS[hero];
      const b = routeFloor(c, caps);
      if (!caps.dash) {
         best = Math.min(best, b);
         continue;
      }
      // Riko's dashes: walked distance W <= V_RUN T_w + x (1 + T / cooldown), x the extra metres of one
      // dash, so T (1 + x / (V_RUN cooldown)) >= B - x / V_RUN
      const x = (V_DASH - V_RUN) * (POWER_MS.dash / 1000);
      const cd = heroById("riko").cooldownMs / 1000;
      best = Math.min(best, Math.max(0, b - x / V_RUN) / (1 + x / (V_RUN * cd)));
   }
   return best * 1000;
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
