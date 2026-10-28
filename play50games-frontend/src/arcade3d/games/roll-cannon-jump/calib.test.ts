// THROWAWAY auto-cannon calibration. Deleted after use.
import { describe, expect, it } from "vitest";
import { courseFor } from "./course";
import { G, V_MAX } from "./rules";

/** find (pitchDeg, v) so the descending arc from (0,0,0) hits (dist, dH) */
function calib(dist: number, dH: number): { pitch: number; v: number; t: number } | null {
   let best: { pitch: number; v: number; t: number; err: number } | null = null;
   for (let deg = 20; deg <= 70; deg += 1) {
      const th = (deg * Math.PI) / 180;
      for (let v = 9; v <= V_MAX; v += 0.1) {
         const t = dist / (v * Math.cos(th));
         const y = v * Math.sin(th) * t - (G / 2) * t * t;
         const err = Math.abs(y - dH);
         const vy = v * Math.sin(th) - G * t;
         if (vy > 0) continue;
         if (!best || err < best.err) best = { pitch: deg, v, t, err };
      }
   }
   return best && best.err < 0.5 ? best : null;
}

describe("calib", () => {
   it("auto chains", () => {
      // L3: a1 (0,9.5,-59) -> a2 (-1,10,-67); a2 -> c4 (0,10,-75)
      for (const [name, dist, dH] of [
         ["L3 a1->a2", Math.hypot(1, 8), 0.5],
         ["L3 a2->c4", Math.hypot(1, 8), 0],
         ["L5 cC->ac0", Math.hypot(5, 4), 6.5],
         ["L5 ac0->ac1", Math.hypot(10, 12), 3],
         ["L5 ac1->ac2", Math.hypot(10, 12), 3],
         ["L5 ac2->ac3", Math.hypot(8, 10), 3],
         ["L5 ac3->valve", Math.hypot(3, 4), 0.6],
      ] as const) {
         const c = calib(dist, dH);
         if (!c) {
            console.log(`${name}: NO SOLUTION dist=${dist.toFixed(1)} dH=${dH}`);
            continue;
         }
         const power = 0.6 + 0.4 * ((c.v - 9) / (V_MAX - 9));
         console.log(`${name}: dist=${dist.toFixed(1)} dH=${dH} -> pitch=${c.pitch} v=${c.v.toFixed(1)} power=${power.toFixed(3)} t=${c.t.toFixed(2)} err=${c.err.toFixed(2)}`);
      }
   }, 60_000);
});
