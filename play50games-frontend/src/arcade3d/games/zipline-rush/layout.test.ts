import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "../../types";
import { LEVELS } from "./levels";
import { cablePoint, deckPoint } from "./rules";
import { ANCHOR_DZ, ANCHOR_X, GANTRY_X, HANG, TOWER_DZ, insideStack, SEA_Y, bossLighthouse, corridorClearance, riderPath, scenery, stations } from "./layout";
import { lookFor, lightningFlash, LOOKS } from "./look";
import { coachLine } from "./Hud";

describe("stations stand where the rules launch and land", () => {
   for (const id of LEVEL_IDS) {
      const c = LEVELS[id];
      const sts = stations(c);
      it(`L${id}: one station per span end, floors at the launch and the landing`, () => {
         expect(sts).toHaveLength(c.sections + 1);
         for (let s = 0; s < c.sections; s++) {
            const p = cablePoint(c, s, 0, 0);
            expect(sts[s].startY).toBeCloseTo(p.y - HANG, 6);
            const d = deckPoint(c, s, 0);
            expect(sts[s + 1].landY).toBeCloseTo(d.y, 6);
            expect(sts[s + 1].land!.z).toBeCloseTo(d.z, 6);
         }
         expect(sts[c.sections].final).toBe(true);
      });
      it(`L${id}: the stack top covers the launch and the mat, and no rider hangs into it`, () => {
         for (const st of sts) {
            const floor = Math.min(st.startY, st.landY);
            if (st.start) expect(Math.abs(st.start.z - st.cz)).toBeLessThan(st.rz);
            if (st.land) expect(Math.abs(st.land.z - st.cz) + 2.3).toBeLessThanOrEqual(st.rz + 0.01);
            // every rider point over the stack's footprint hangs above its floor (feet = cable - HANG)
            for (const p of riderPath(c)) {
               const inside = insideStack(st, p.x, p.z);
               if (inside) expect(p.y - HANG).toBeGreaterThan(floor - 0.6);
            }
         }
      });
      it(`L${id}: no prop stands in the riders' corridor and the sea is under every rider`, () => {
         const path = riderPath(c);
         const sc = scenery(id);
         for (const spot of [...sc.pines, ...sc.boulders, ...sc.cliffs, ...sc.buoys, ...sc.lighthouses, ...sc.farStacks]) {
            expect(corridorClearance(c, spot, path)).toBeGreaterThan(0.5);
         }
         for (const p of path) expect(p.y - HANG).toBeGreaterThan(SEA_Y + 0.5);
         // the gantry towers stand outside every lane at the launch
         // the gantry towers and the anchor posts stand outside every lane, on the stack top
         const towerHalf = 1.8;
         expect(GANTRY_X - towerHalf).toBeGreaterThan(1.25 + 0.8);
         // the moving deck (4.6 m wide, sways 1.6 m) clears the anchor posts
         expect(ANCHOR_X - 0.2).toBeGreaterThan(2.3 + 1.6);
         for (const st of sts) {
            if (st.start) expect(insideStack(st, GANTRY_X, st.start.z + TOWER_DZ)).toBe(true);
            if (st.land) expect(insideStack(st, ANCHOR_X, st.land.z + ANCHOR_DZ)).toBe(true);
         }
      });
   }
   it("L5's boss lighthouse stands beside the spiral's landing, its gallery over the landing floor", () => {
      const lh = bossLighthouse(LEVELS[5])!;
      const st = stations(LEVELS[5])[4];
      expect(lh.y + lh.height).toBeGreaterThan(st.landY);
      expect(bossLighthouse(LEVELS[1])).toBeNull();
   });
});

describe("the look", () => {
   it("gives every level its own palette; night levels are dark with stars, L5 storms", () => {
      expect(new Set(LEVEL_IDS.map((id) => LOOKS[id].sky.top)).size).toBe(5);
      expect(lookFor(4).stars).toBeGreaterThan(0);
      expect(lookFor(5).lightning && lookFor(5).rain).toBe(true);
      expect(lookFor(1).lightning).toBe(false);
      expect(lightningFlash(0)).toBe(0);
      const samples = Array.from({ length: 2000 }, (_, i) => lightningFlash(i * 0.01));
      expect(Math.max(...samples)).toBeGreaterThan(0.5);
      expect(samples.filter((v) => v > 0).length).toBeLessThan(400);
   });
});

describe("the coach teaches by playing", () => {
   it("walks L1 through grab, the speed build, brake, tuck and the hop", () => {
      const c = LEVELS[1];
      expect(coachLine(c, { mode: 0, section: 0 })).toMatch(/grab/i);
      expect(coachLine(c, { mode: 1, section: 0, t: 20, speed: 80 })).toMatch(/speed build/i);
      expect(coachLine(c, { mode: 1, section: 0, t: 60, speed: 110 })).toMatch(/brake/i);
      expect(coachLine(c, { mode: 1, section: 1, t: 50, speed: 60 })).toMatch(/tuck/i);
      expect(coachLine(c, { mode: 1, section: 2, t: 30, speed: 80 })).toMatch(/hop/i);
      expect(coachLine(c, { mode: 1, section: 0, t: 90, speed: 70 })).toMatch(/release/i);
      expect(coachLine(c, { mode: 1, section: 0, t: 90, speed: 120 })).toMatch(/too fast/i);
      expect(coachLine(c, { mode: 3 })).toMatch(/bell/i);
   });
   it("calls the Volt Eel's windows", () => {
      const c = LEVELS[5];
      expect(coachLine(c, { mode: 1, section: 2, hp: 5, telegraph: 1, lane: 0 })).toMatch(/LEFT/);
      expect(coachLine(c, { mode: 1, section: 2, hp: 4, open: 1 })).toMatch(/head/i);
      expect(coachLine(c, { mode: 1, section: 3, t: 80 })).toMatch(/gill/i);
   });
});
