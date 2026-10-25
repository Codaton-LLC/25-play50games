// Level 1 replay driver (tests only): plays one seed with seeded inputs through a rules module and
// hashes every frame's exact float bits. The digests pinned in l1Replay.test.ts were recorded from
// main's rules.ts before levels (2026-10-25). Level 1 still ends every finished run in a win.
import { createRng } from "@/arcade3d/core/math";

interface ReplayRun {
   elapsedMs: number; phase: string; phaseMs: number; aimMs: number; col: number; row: number; weights: number[];
   shotsDone: number; goals: number; streak: number; score: number; ended: string | null; reticlePhase: number;
   reticle: number; targetX: number; targetY: number; keeperIndex: number; lastResult: string | null;
}
type Input = { pressed?: { left?: boolean; right?: boolean; up?: boolean; down?: boolean } | null; jumpPressed?: boolean; zoneId?: string | null };
export interface ReplayApi<R extends ReplayRun> {
   createRun(seed: number): R;
   step(run: R, dtMs: number, input: Input): unknown;
   reticleOffset(aimMs: number, phase: number): number;
}

const ZONES = ["top-left", "top-centre", "top-right", "bottom-left", "bottom-centre", "bottom-right"];
const PHASES = ["aim", "runup", "flight", "hold"];
const RESULTS = ["goal", "saved", "wide", "timeout"];

/** "random": random presses and taps; "timed": shoot a seeded zone once the ring is in the band; "idle": every shot times out. */
export function replayDigest<R extends ReplayRun>(api: ReplayApi<R>, seed: number, mode: "random" | "timed" | "idle"): string {
   const run = api.createRun(seed);
   const rng = createRng(seed * 131 + mode.length);
   const buf = new DataView(new ArrayBuffer(8));
   let h1 = 0x811c9dc5 | 0;
   let h2 = 0x01000193 | 0;
   const mix = (v: number) => {
      buf.setFloat64(0, v);
      for (let i = 0; i < 8; i++) {
         const b = buf.getUint8(i);
         h1 = Math.imul(h1 ^ b, 16777619);
         h2 = Math.imul(h2 ^ b, 2246822519);
      }
   };
   let zone = ZONES[0];
   let aimed = -1;
   for (let f = 0; f < 100_000 && !run.ended; f++) {
      const dt = 1000 / 144 + rng() * (1000 / 20 - 1000 / 144);
      const input: Input = {};
      if (mode === "random") {
         const r = rng();
         if (r < 0.02) input.zoneId = ZONES[Math.floor(rng() * 6)];
         else if (r < 0.06) input.pressed = { left: rng() < 0.5, right: rng() < 0.5, up: rng() < 0.5, down: rng() < 0.5 };
         else if (r < 0.07) input.jumpPressed = true;
      } else if (mode === "timed" && run.phase === "aim") {
         if (aimed !== run.shotsDone) { aimed = run.shotsDone; zone = ZONES[Math.floor(rng() * 6)]; }
         if (Math.abs(api.reticleOffset(run.aimMs, run.reticlePhase)) <= 0.2) input.zoneId = zone;
      }
      api.step(run, dt, input);
      for (const v of [run.elapsedMs, run.phaseMs, run.aimMs, run.col, run.row, run.shotsDone, run.goals, run.streak, run.score, run.reticlePhase, run.reticle, run.targetX, run.targetY, run.keeperIndex, PHASES.indexOf(run.phase), RESULTS.indexOf(run.lastResult ?? ""), run.ended ? 1 : 0]) mix(v);
      for (const w of run.weights) mix(w);
   }
   return `${(h1 >>> 0).toString(16)}:${(h2 >>> 0).toString(16)}:${run.score}:${run.goals}:${Math.round(run.elapsedMs)}`;
}
