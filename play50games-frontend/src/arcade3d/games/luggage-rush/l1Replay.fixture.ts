// Level 1 replay driver (tests only): plays one seed with seeded inputs through a rules module and
// hashes every frame's exact float bits. The digests pinned in l1Replay.test.ts were recorded from
// main's rules.ts before levels (2026-10-25), so level 1 must stay bit-exact.
import { createRng } from "@/arcade3d/core/math";

interface ReplayBag { alive: boolean; tumble: number; segment: number; s: number; flight: number; vip: boolean; heavy: boolean; x: number; y: number; z: number }
interface ReplayRun { choices: number[]; bags: ReplayBag[]; nextSpawn: number; streak: number; strikes: number; score: number; lost: boolean; eventCount: number }
export interface ReplayApi<R extends ReplayRun> {
   createRun(seed: number): R;
   stepRun(run: R, input: { flip: [boolean, boolean, boolean, boolean] }, dt: number, time: number): void;
}

/** Segment a diverter reads (entry, mid, toD3, hold) and the choice each flight wants there. */
const APPROACH = [0, 1, 2, 3];
const wanted = (d: number, flight: number) => (d === 0 ? (flight === 0 ? 0 : 1) : d === 1 ? (flight === 1 ? 0 : 1) : d === 2 ? (flight === 3 ? 1 : 0) : 0);

/** "random": seeded flips (strikes, the three-strike end); "greedy": set every diverter for its frontmost bag, with seeded slips. */
export function replayDigest<R extends ReplayRun>(api: ReplayApi<R>, seed: number, mode: "random" | "greedy"): string {
   const run = api.createRun(seed);
   const rng = createRng(seed * 977 + (mode === "greedy" ? 5 : 1));
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
   const input = { flip: [false, false, false, false] as [boolean, boolean, boolean, boolean] };
   let t = 0;
   while (t < 120 && !run.lost) {
      const dt = 1 / 144 + rng() * (1 / 20 - 1 / 144);
      t += dt;
      for (let d = 0; d < 4; d++) {
         if (mode === "random") { input.flip[d] = rng() < 0.02; continue; }
         let best = -1;
         for (let i = 0; i < run.bags.length; i++) {
            const b = run.bags[i];
            if (b.alive && b.segment === APPROACH[d] && (best < 0 || b.s > run.bags[best].s)) best = i;
         }
         const slip = rng() < 0.004;
         input.flip[d] = best >= 0 && (wanted(d, run.bags[best].flight) !== run.choices[d]) !== slip;
      }
      api.stepRun(run, input, dt, t);
      mix(t); mix(run.score); mix(run.streak); mix(run.strikes); mix(run.nextSpawn); mix(run.eventCount); mix(run.lost ? 1 : 0);
      for (const c of run.choices) mix(c);
      for (const b of run.bags) {
         if (!b.alive) { mix(-1); continue; }
         mix(b.segment); mix(b.s); mix(b.flight); mix(b.tumble); mix(b.x); mix(b.y); mix(b.z); mix((b.vip ? 1 : 0) + (b.heavy ? 2 : 0));
      }
   }
   return `${(h1 >>> 0).toString(16)}:${(h2 >>> 0).toString(16)}:${run.score}:${run.strikes}:${t.toFixed(2)}`;
}
