// Each level is its own lobby (theme → LOOKS + set pieces + decorFor). Set pieces never enter the
// play lane; level 1 solids stay today's layout; start / desk / pad / doors stay clear.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   LOOKS,
   SET_PIECE_CLEAR_Y,
   fogOf,
   lookFor,
   setPieceSpots,
} from "./looks";
import {
   DESK_POINT,
   DOOR_X,
   PAD_POINT,
   RADIUS,
   START,
   USE_RANGE,
   createRun,
   decorFor,
   doorZ,
   standable,
} from "./rules";

describe("hotel-bellboy-rush level looks", () => {
   it("every level has its own theme, carpet and set kit; level 1 is today's lobby", () => {
      expect(new Set(LEVEL_IDS.map((id) => LEVELS[id].theme)).size).toBe(5);
      expect(LEVELS[1].theme).toBe("lobby");
      expect(lookFor(LEVELS[1])).toEqual(LOOKS.lobby);
      expect(LOOKS.lobby.carpet).toBe("#7f1d1d");
      expect(LOOKS.lobby.set).toBe("none");
      expect(LOOKS.lobby.fogNear).toBe(16);
      expect(LOOKS.lobby.fogFar).toBe(38);
      const carpets = LEVEL_IDS.map((id) => LOOKS[LEVELS[id].theme].carpet);
      expect(new Set(carpets).size).toBe(5);
      const sets = LEVEL_IDS.map((id) => LOOKS[LEVELS[id].theme].set);
      expect(new Set(sets).size).toBe(5);
      expect(LEVEL_IDS.map((id) => fogOf(LEVELS[id])[0])).toEqual(LEVEL_IDS.map((id) => LEVELS[id].background));
   });

   it("level 1 solids match today's lobby (one sofa, planters on door gaps, guests at doors 1 and 3)", () => {
      const solids = decorFor(LEVELS[1]);
      const of = (kind: string) => solids.filter((s) => s.kind === kind);
      expect(of("sofa")).toEqual([
         expect.objectContaining({ kind: "sofa", x: expect.closeTo(-2 + 0.82 / 2, 6), z: 3.2 }),
      ]);
      expect(of("planter")).toHaveLength(4);
      expect(of("guest")).toHaveLength(2);
      expect(of("guest").map((g) => g.z)).toEqual([
         expect.closeTo(doorZ(0) + 0.9, 6),
         expect.closeTo(doorZ(2) + 0.9, 6),
      ]);
   });

   it("each theme's solids differ (sofa / planter / guest counts or placement)", () => {
      const keys = LEVEL_IDS.map((id) => {
         const s = decorFor(LEVELS[id]);
         return JSON.stringify({
            sofas: s.filter((x) => x.kind === "sofa").map((x) => [+x.x.toFixed(2), +x.z.toFixed(2)]),
            planters: s.filter((x) => x.kind === "planter").length,
            guests: s.filter((x) => x.kind === "guest").length,
            theme: LEVELS[id].theme,
         });
      });
      expect(new Set(keys).size).toBe(5);
   });

   it("set pieces match the level name: L1 none, L2 directory, L3 chandelier, L4 glass, L5 grand", () => {
      const l1 = setPieceSpots(LEVELS[1]);
      expect(l1.chandeliers).toHaveLength(0);
      expect(l1.columns).toHaveLength(0);
      expect(l1.panels).toHaveLength(0);
      expect(l1.boards).toHaveLength(0);
      expect(l1.strips).toHaveLength(0);

      const floors3 = setPieceSpots(LEVELS[2]);
      expect(floors3.boards.length).toBeGreaterThan(0);
      expect(floors3.strips.length).toBeGreaterThan(0);
      expect(floors3.chandeliers).toHaveLength(0);

      const luxury = setPieceSpots(LEVELS[3]);
      expect(luxury.chandeliers.length).toBeGreaterThan(0);
      expect(luxury.panels).toHaveLength(0);

      const business = setPieceSpots(LEVELS[4]);
      expect(business.panels.length).toBeGreaterThan(0);
      expect(business.strips.length).toBeGreaterThan(0);
      expect(business.chandeliers).toHaveLength(0);

      const grand = setPieceSpots(LEVELS[5]);
      expect(grand.chandeliers.length).toBeGreaterThan(0);
      expect(grand.columns.length).toBeGreaterThan(0);
      expect(grand.boards.length).toBeGreaterThan(0);

      const signatures = LEVEL_IDS.map((id) => {
         const p = setPieceSpots(LEVELS[id]);
         return JSON.stringify({
            chandeliers: p.chandeliers.length,
            columns: p.columns.length,
            panels: p.panels.length,
            boards: p.boards.length,
            strips: p.strips.length,
            theme: LEVELS[id].theme,
         });
      });
      expect(new Set(signatures).size).toBe(5);
   });

   it("overhead chandeliers and ceiling strips hang above walk height", () => {
      for (const id of LEVEL_IDS) {
         const pieces = setPieceSpots(LEVELS[id]);
         for (const spot of [...pieces.chandeliers, ...pieces.strips.filter((s) => (s.y ?? 0) > 2)]) {
            expect(spot.y ?? 0, `L${id} set piece y`).toBeGreaterThanOrEqual(SET_PIECE_CLEAR_Y - 0.15);
            const bottom = (spot.y ?? 0) - (spot.sy ?? 1) / 2;
            expect(bottom, `L${id} set piece bottom`).toBeGreaterThan(1.85);
         }
      }
   });

   it("set-piece columns and panels sit on or outside the wall face (|x| >= hall half-width - 0.08)", () => {
      for (const id of LEVEL_IDS) {
         const pieces = setPieceSpots(LEVELS[id]);
         for (const spot of [...pieces.columns, ...pieces.panels, ...pieces.boards]) {
            expect(Math.abs(spot.x), `L${id} wall piece x`).toBeGreaterThanOrEqual(2 - 0.08);
         }
      }
   });

   it("props stay off the start, desk, elevator pad and every door Use point", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const run = createRun(1, level);
         expect(standable(run, START.x, START.z, RADIUS)).toBe(true);
         expect(standable(run, DESK_POINT.x, DESK_POINT.z + 0.5, RADIUS)).toBe(true);
         expect(standable(run, PAD_POINT.x - 0.25, PAD_POINT.z, RADIUS)).toBe(true);
         for (let i = 0; i < level.doors; i++) {
            expect(standable(run, DOOR_X - 1.05, doorZ(i), RADIUS), `L${id} door ${i}`).toBe(true);
         }
         // no solid centre sits inside the Use disc of desk / pad / doors
         for (const s of run.solids) {
            expect(Math.hypot(s.x - DESK_POINT.x, s.z - (DESK_POINT.z + 0.45))).toBeGreaterThan(USE_RANGE);
            expect(Math.hypot(s.x - PAD_POINT.x, s.z - PAD_POINT.z)).toBeGreaterThan(USE_RANGE);
            for (let i = 0; i < level.doors; i++) {
               expect(Math.hypot(s.x - (DOOR_X - 0.75), s.z - doorZ(i))).toBeGreaterThan(USE_RANGE);
            }
            expect(Math.hypot(s.x - START.x, s.z - START.z)).toBeGreaterThan(RADIUS + 0.5);
         }
         // centre lane stays walkable past the desk (desk front is z 0.9; radius 0.4)
         for (let z = 1.5; z < run.length - 1; z += 1.5) {
            expect(standable(run, 0, z, RADIUS), `L${id} lane z=${z}`).toBe(true);
         }
      }
   });
});
