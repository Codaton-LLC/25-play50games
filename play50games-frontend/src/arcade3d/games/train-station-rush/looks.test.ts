// Each level is its own station (theme → LOOKS + apron + solids). Apron props never enter the play
// area; level 1 solids stay today's layout; start / spots / pads stay clear of concourse blockers.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { APRON_GAP, LOOKS, decorSpots, fogOf, inPlayStation, lookFor } from "./looks";
import {
   CONCOURSE_DEPTH,
   RADIUS,
   SPOTS,
   START,
   USE_RANGE,
   padPoint,
   solidsFor,
   standable,
   createRun,
} from "./rules";

describe("train-station-rush level looks", () => {
   it("every level has its own theme, floor tones and scenery; level 1 is today's local station", () => {
      expect(new Set(LEVEL_IDS.map((id) => LEVELS[id].theme)).size).toBe(5);
      expect(LEVELS[1].theme).toBe("local");
      expect(lookFor(LEVELS[1])).toEqual(LOOKS.local);
      expect(LOOKS.local.concourse).toBe("#e2e8f0");
      expect(LOOKS.local.platform).toBe("#cbd5e1");
      expect(LOOKS.local.scenery).toBe("sparse");
      const floors = LEVEL_IDS.map((id) => LOOKS[LEVELS[id].theme].platform);
      expect(new Set(floors).size).toBe(5);
      const scenery = LEVEL_IDS.map((id) => LOOKS[LEVELS[id].theme].scenery);
      expect(new Set(scenery).size).toBe(5);
      expect(LEVEL_IDS.map((id) => fogOf(LEVELS[id])[0])).toEqual(LEVEL_IDS.map((id) => LEVELS[id].background));
   });

   it("level 1 solids match today's branch layout (two tickets, two benches, one trolley)", () => {
      const solids = solidsFor(LEVELS[1]);
      const of = (kind: string) => solids.filter((s) => s.kind === kind);
      expect(of("ticket")).toEqual([
         { kind: "ticket", x: -3.4, z: 0.45, hx: 0.46, hz: 0.44, rotY: 0 },
         { kind: "ticket", x: 3.4, z: 0.45, hx: 0.46, hz: 0.44, rotY: 0 },
      ]);
      expect(of("trolley")).toHaveLength(1);
      expect(of("bench")).toHaveLength(2);
      expect(of("lamp")).toHaveLength(2);
      expect(of("canopy")).toHaveLength(1);
      expect(of("sign")).toHaveLength(2);
   });

   it("each theme's solids differ (ticket / bench / trolley counts or placement)", () => {
      const keys = LEVEL_IDS.map((id) => {
         const s = solidsFor(LEVELS[id]);
         return JSON.stringify({
            tickets: s.filter((x) => x.kind === "ticket").map((x) => [x.x, x.z]),
            benches: s.filter((x) => x.kind === "bench").length,
            trolleys: s.filter((x) => x.kind === "trolley").length,
            theme: LEVELS[id].theme,
         });
      });
      expect(new Set(keys).size).toBe(5);
   });

   it("apron decor stays outside the walkable station by APRON_GAP", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const decor = decorSpots(level);
         const all = [...decor.buildings, ...decor.trees, ...decor.signals, ...decor.pillars, ...decor.boards, ...decor.neon];
         expect(all.length, `L${id} apron`).toBeGreaterThan(0);
         for (const spot of all) {
            expect(
               inPlayStation(level, spot.x, spot.z, APRON_GAP - 0.05),
               `L${id} apron at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) inside play`,
            ).toBe(false);
         }
      }
   });

   it("concourse props stay off the start, entrance spots and boarding pads", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const run = createRun(1, level);
         expect(standable(run, START.x, START.z, RADIUS, false)).toBe(true);
         const spots = SPOTS[level.parallel] ?? SPOTS[1];
         for (const s of spots) {
            expect(standable(run, s.x, s.z, RADIUS, false)).toBe(true);
            // Use reach from a step toward the spot still clear of props
            expect(standable(run, s.x, s.z + 0.5, RADIUS, false)).toBe(true);
         }
         for (let p = 0; p < level.platforms; p++) {
            const pad = padPoint(level, p);
            expect(standable(run, pad.x, pad.z, RADIUS, false)).toBe(true);
            expect(standable(run, pad.x, pad.z - 0.5, RADIUS, false)).toBe(true);
         }
         // no solid centre sits inside the Use disc of a spot or pad
         const blockers = run.solids.filter((s) => s.kind === "bench" || s.kind === "ticket" || s.kind === "trolley");
         for (const s of blockers) {
            for (const spot of spots) {
               expect(Math.hypot(s.x - spot.x, s.z - spot.z)).toBeGreaterThan(USE_RANGE + RADIUS);
            }
            for (let p = 0; p < level.platforms; p++) {
               const pad = padPoint(level, p);
               expect(Math.hypot(s.x - pad.x, s.z - pad.z)).toBeGreaterThan(USE_RANGE);
            }
            expect(Math.hypot(s.x - START.x, s.z - START.z)).toBeGreaterThan(RADIUS + 0.6);
         }
         // bot edge lane along the platform lip stays walkable at centre
         expect(standable(run, 0, CONCOURSE_DEPTH - 0.7, RADIUS, false)).toBe(true);
      }
   });
});
