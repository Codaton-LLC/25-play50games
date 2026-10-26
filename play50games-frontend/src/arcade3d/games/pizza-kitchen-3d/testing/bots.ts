// Test-only bots for Pizza Kitchen 3D (never imported by runtime code). They play through the real
// rules and a fresh store exactly like the canvas (core/testing/botHarness simulateRun).
import { createRng } from "@/arcade3d/core/math";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { TUNING, createRun, frame, type Run } from "../rules";

export type BotKind = "oracle" | "oracleTight" | "honest" | "idle" | "spam";
export type Frames = 30 | 60 | 144 | "random";

export interface BotResult {
   run: Run;
   store: ArcadeStore;
   score: number;
   elapsedMs: number;
   endReason: ArcadeStore["endReason"];
   /** the run used both ovens at once at least once */
   bothOvens: boolean;
}

const SPOT_Z = TUNING.minZ + 0.04;

/** Which station the cook heads for now (both kitchen bots share it; `react` = the take-out lag). */
function targetOf(r: Run, react: number, slack: number): string {
   const speed = TUNING.speed;
   if (r.carried) return r.level.boxStep && !r.carried.boxed ? "box" : "serve";
   let urgent = -1;
   let soonest = -1;
   let soonestAge = -Infinity;
   for (let i = 0; i < r.ovens.length; i++) {
      const o = r.ovens[i];
      if (!o) continue;
      const s = r.stations.find((x) => x.id === `oven${i}`)!;
      const age = r.time - o.startedAt;
      // head back so the cook arrives `slack` s into the golden window (perfect lasts its first 1.5 s)
      if (age + Math.abs(s.x - r.player.x) / speed >= r.level.bakeS + react + slack) urgent = i;
      if (age > soonestAge) {
         soonestAge = age;
         soonest = i;
      }
   }
   if (urgent >= 0) return `oven${urgent}`;
   // a detour to `id` must still reach every loaded oven before its pizza burns
   const safe = (id: string) => {
      const t = r.stations.find((x) => x.id === id)!;
      for (let i = 0; i < r.ovens.length; i++) {
         const o = r.ovens[i];
         if (!o) continue;
         const ov = r.stations.find((x) => x.id === `oven${i}`)!;
         const eta = r.time + (Math.abs(t.x - r.player.x) + Math.abs(ov.x - t.x)) / speed + 0.6;
         if (eta > o.startedAt + r.level.bakeS + r.level.goldenS - 0.4) return false;
      }
      return true;
   };
   const wait = () => `oven${soonest}`;
   if (r.prep) {
      const next = r.tickets[r.prep.ticket].ingredients[r.prep.added];
      if (next) return safe(next) ? next : wait();
      const free = r.ovens.findIndex((o) => !o);
      return `oven${free >= 0 ? free : soonest}`;
   }
   const busy = (id: number) => r.carried?.ticket === id || r.ovens.some((o) => o?.pizza.ticket === id);
   if (r.tickets.some((t) => t.state === "open" && !busy(t.id)) && r.ovens.some((o) => !o)) return soonest < 0 || safe("dough") ? "dough" : wait();
   return soonest >= 0 ? `oven${soonest}` : "dough";
}

function makeDriver(r: Run, kind: BotKind, seed: number) {
   const out = { x: 0, z: 0, use: false };
   if (kind === "idle") return () => out;
   if (kind === "spam") {
      const rng = createRng(seed ^ 0xbeef);
      return () => {
         out.x = rng() * 2 - 1;
         out.z = rng() * 2 - 1;
         out.use = rng() < 0.5;
         return out;
      };
   }
   // oracle: presses on the cooldown and takes out on the first golden frame; honest: 0.30 s between
   // presses and a 0.18 s reaction to the golden ring, the pace of a quick human
   // oracleTight heads back to arrive on the first golden frame (faster on L3-L4), oracle within the
   // perfect window (faster on L5): the limits take the faster of the two on every seed
   const oracle = kind === "oracle" || kind === "oracleTight";
   const gap = oracle ? TUNING.useCooldown : 0.3;
   const react = oracle ? 0 : 0.18;
   const slack = kind === "oracleTight" ? 0 : 0.9;
   let nextPress = 0;
   return () => {
      const id = targetOf(r, react, slack);
      const s = r.stations.find((x) => x.id === id)!;
      const dx = s.x - r.player.x;
      const dz = SPOT_Z - r.player.z;
      const d = Math.hypot(dx, dz);
      // arrive: full stick far away, easing in over the last 0.6 m (the mover brakes at 28 m/s²)
      const k = d > 0.02 ? Math.min(1, d / 0.6) / d : 0;
      out.x = dx * k;
      out.z = dz * k;
      let press = d < 0.3 && r.time >= nextPress;
      if (id.startsWith("oven")) {
         const o = r.ovens[Number(id.slice(4))];
         if (o && r.time - o.startedAt < r.level.bakeS + react) press = false;
         if (!o && !(r.prep && r.prep.added === r.tickets[r.prep.ticket].ingredients.length)) press = false;
      }
      if (id === "dough" && r.prep) press = false;
      out.use = press;
      if (press) nextPress = r.time + gap;
      return out;
   };
}

const framesOf = (f: Frames, seed: number) => (f === "random" ? randomFrames(seed) : fixedFrames(1000 / f));

export function playBot(id: LevelId, seed: number, kind: BotKind, frames: Frames = 60): BotResult {
   const level = LEVELS[id];
   const run = createRun(seed, level);
   const drive = makeDriver(run, kind, seed);
   let bothOvens = false;
   const end = simulateRun(createArcadeStore(), {
      durationMs: level.durationMs,
      resultDelayMs: TUNING.resultDelayMs,
      frame: framesOf(frames, seed),
      step: (dt, _time, store) => {
         const input = drive();
         frame(run, dt, input.x, input.z, input.use, store);
         if (run.ovens.length > 1 && run.ovens.every((o) => o)) bothOvens = true;
      },
   });
   return { run, store: end, score: end.score, elapsedMs: end.elapsedMs, endReason: end.endReason, bothOvens };
}
