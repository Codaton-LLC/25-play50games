// Per-level look: the five parks must read as five different places, and nothing the player runs
// into (solid props) or chases (landing toys) may collide with the scenery. Pure: looks + rules data.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { PALETTES, decorSpots } from "./looks";
import { DOG_R, PROP_GAP, blanketOf, createRun, landingOk, propsOf } from "./rules";

/** A level's whole look as one comparable signature. */
function lookSignature(id: (typeof LEVEL_IDS)[number]): string {
   const level = LEVELS[id];
   const d = decorSpots(id);
   const counts = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.length]));
   return JSON.stringify({ palette: PALETTES[id], lighting: level.lighting, background: level.background, counts, d });
}

describe("dog park per-level look and play area", () => {
   it("every level has its own look: palette, sky, lighting and decor all differ from the other four", () => {
      const signatures = LEVEL_IDS.map((id) => lookSignature(id));
      for (let i = 0; i < signatures.length; i++)
         for (let j = i + 1; j < signatures.length; j++) expect(signatures[i] === signatures[j], `L${i + 1} vs L${j + 1}`).toBe(false);
      // and the difference is not just the lawn size: each level's own set piece kinds are unique to it
      for (const id of LEVEL_IDS) {
         const d = decorSpots(id);
         expect(d.lamps.length + d.blocks.length > 0, `L${id} city pieces`).toBe(id === 2);
         expect(d.stumps.length > 0, `L${id} forest pieces`).toBe(id === 3);
         expect(d.umbrellasA.length + d.umbrellasB.length > 0, `L${id} beach pieces`).toBe(id === 4);
         expect(d.flagLines.length + d.balloonsA.length > 0, `L${id} festival pieces`).toBe(id === 5);
      }
      expect(PALETTES[3].parkGrass).not.toBe(PALETTES[4].parkGrass);
   });

   it("decor stays out of the play area on every level: outside the fence, throws and dog clear of props", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const hw = level.width / 2;
         const hd = level.depth / 2;
         const props = propsOf(level);
         // solid props sit fully inside the fence, so the dog can always get around them
         for (const p of props) {
            expect(Math.abs(p.x) + p.r, `L${id} prop x`).toBeLessThanOrEqual(hw - 0.3);
            expect(Math.abs(p.z) + p.r, `L${id} prop z`).toBeLessThanOrEqual(hd - 0.3);
         }
         // the blanket (home) is inside the lawn, off the south fence
         const b = blanketOf(level);
         expect(Math.abs(b.x)).toBeLessThan(hw);
         expect(b.z).toBeLessThan(hd);
         // every drawn decor piece of every kind stands outside the fence
         for (const [kind, spots] of Object.entries(decorSpots(id))) {
            for (const s of spots) {
               expect(Math.abs(s.x) > hw + 0.6 || Math.abs(s.z) > hd + 0.6, `L${id} ${kind} ${s.x},${s.z}`).toBe(true);
            }
         }
         // throws land inside the fence and clear of every prop (the dog's own radius fits too)
         for (let seed = 0; seed < 50; seed++) {
            const run = createRun(seed, level);
            for (const p of run.plan) {
               expect(landingOk(level, props, p.lx, p.lz)).toBe(true);
               for (const prop of props) expect(Math.hypot(p.lx - prop.x, p.lz - prop.z)).toBeGreaterThanOrEqual(prop.r + PROP_GAP);
            }
            // the start on the blanket is never inside a prop
            for (const prop of props) expect(Math.hypot(b.x - prop.x, b.z - prop.z)).toBeGreaterThan(prop.r + DOG_R);
         }
      }
   });
});
