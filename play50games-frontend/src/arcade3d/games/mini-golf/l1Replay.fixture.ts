// Level 1 replay driver (tests only): plays one seed with seeded inputs through a rules module and
// hashes every frame's exact float bits. The digests pinned in l1Replay.test.ts were recorded from
// main's rules.ts / physics.ts / course.ts before levels (2026-10-25), so level 1 must stay bit-exact.
import { createRng } from "@/arcade3d/core/math";
import { PAR_LINES, linePsi } from "./solver";
import type { Hole } from "./course";

interface ReplayRun {
   hole: number;
   phase: string;
   strokes: number;
   total: number;
   time: number;
   holeTicks: number;
   topSpeed: number;
   over: boolean;
   won: boolean;
   card: number[];
   course: Hole[];
   ball: { x: number; z: number; vx: number; vz: number; y?: number };
   events: { win: boolean; timeup: boolean; water?: boolean; captured?: boolean; pickedUp: boolean };
}

export interface ReplayApi<R extends ReplayRun> {
   createRun(seed: number): R;
   advanceRun(run: R, dt: number, psi: number, power: number, putt: boolean): void;
   canPutt(run: R): boolean;
}

const PHASES = ["aim", "moving", "holeOut", "done"];

/** "spam": random putts (water, pick-ups, the run cap); "par": today's par lines at a random frame rate. */
export function replayDigest<R extends ReplayRun>(api: ReplayApi<R>, seed: number, mode: "spam" | "par"): string {
   const run = api.createRun(seed);
   const rng = createRng(seed * 31 + (mode === "par" ? 7 : 3));
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
   let hole = -1;
   let next = 0;
   for (let f = 0; f < 40_000 && !run.over; f++) {
      const dt = 0.004 + rng() * 0.046;
      let psi = (rng() - 0.5) * 2 * Math.PI;
      let power = rng();
      let putt = rng() < 0.4;
      if (mode === "par") {
         if (hole !== run.hole) { hole = run.hole; next = 0; }
         const q = PAR_LINES[hole]?.[next];
         putt = false;
         if (q && api.canPutt(run) && run.holeTicks >= q.w) {
            putt = true; psi = linePsi(run.course[run.hole], q); power = q.p; next++;
         }
      }
      api.advanceRun(run, dt, psi, power, putt);
      const b = run.ball;
      for (const v of [b.x, b.z, b.vx, b.vz, b.y ?? 0, run.total, run.strokes, run.hole, run.holeTicks, run.time, run.topSpeed, PHASES.indexOf(run.phase)]) mix(v);
      mix((run.over ? 1 : 0) + (run.won ? 2 : 0) + (run.events.win ? 4 : 0) + (run.events.timeup ? 8 : 0) + (run.events.pickedUp ? 16 : 0));
   }
   return `${(h1 >>> 0).toString(16)}:${(h2 >>> 0).toString(16)}:${run.total}:${run.card.join(",")}:${run.won ? "W" : run.over ? "O" : "-"}`;
}
