// Each level is its own reef (theme → LOOKS + apron decor). Apron props never enter the play box.
import { describe, expect, it, vi } from "vitest";
import { levelEnvironment } from "@/arcade3d/core/levels";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS } from "./levels";
import { APRON_GAP, LOOKS, decorSpots, fogOf, inPlayReef } from "./looks";
import { createRun } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

describe("submarine levels: five reefs", () => {
   it("every level has its own theme, sand and water; level 1 is today's shallow reef", () => {
      expect(new Set(LEVEL_IDS.map((id) => LEVELS[id].theme)).size).toBe(5);
      expect(LEVELS[1].theme).toBe("shallow");
      expect(LEVELS[1].background).toBe("#0891b2");
      expect(LEVELS[1].lighting).toBe("day");
      expect(LEVELS[1].drain).toBe(0.55);
      expect(LEVELS[1].treasures).toBe(3);
      expect(LOOKS.shallow.scenery).toBe("sparse");
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      const sands = new Set<string>();
      const skies = new Set<string>();
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const look = LOOKS[level.theme];
         sands.add(look.sand);
         skies.add(level.background);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelEnvironment(definition, id)?.fog).toEqual(fogOf(level));
         expect(look.scenery).toBeTruthy();
      }
      expect(sands.size).toBe(5);
      expect(skies.size).toBe(5);
   });

   it("apron decor stays outside the playable reef", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const d = decorSpots(id);
         const all = [...d.rocks, ...d.coral, ...d.kelp, ...d.arches, ...d.wrecks, ...d.columns, ...d.anchors];
         expect(all.length).toBeGreaterThan(0);
         for (const spot of all) {
            expect(inPlayReef(level, spot.x, spot.z, APRON_GAP - 0.05)).toBe(false);
         }
      }
   });

   it("L3–L5 place landmark wrecks or columns inside the reef; L1 has none", () => {
      const l1 = createRun(1, LEVELS[1]);
      expect(l1.boxes.filter((b) => b.kind === "wreck")).toHaveLength(0);
      expect(l1.boxes.filter((b) => b.kind === "column")).toHaveLength(0);

      const ship = createRun(1, LEVELS[3]);
      expect(ship.boxes.some((b) => b.kind === "wreck")).toBe(true);
      // landmark hull sits on the east flank, north of the dock
      const hull = ship.boxes.find((b) => b.kind === "wreck")!;
      expect(hull.z).toBeGreaterThan(ship.dock.z + 4);
      expect(Math.abs(hull.x)).toBeGreaterThan(levelHalf(LEVELS[3]).hx * 0.3);

      const cave = createRun(1, LEVELS[4]);
      expect(cave.boxes.filter((b) => b.kind === "column").length).toBeGreaterThanOrEqual(2);
      const northCols = cave.boxes.filter((b) => b.kind === "column" && b.z > levelHalf(LEVELS[4]).hz * 0.5);
      expect(northCols.length).toBeGreaterThanOrEqual(2);

      const ruins = createRun(1, LEVELS[5]);
      // L5 keeps random in-play boxes (score proof); the temple colonnade is apron-only
      expect(ruins.boxes.filter((b) => b.kind === "column").length).toBe(5);
      expect(ruins.boxes.filter((b) => b.kind === "wreck").length).toBe(2);
      expect(decorSpots(5).columns.length).toBeGreaterThanOrEqual(4);
   });

   it("level twists match the plan: jellies from L3, current from L4", () => {
      expect(LEVELS[1].jellies).toBe(0);
      expect(LEVELS[2].jellies).toBe(0);
      expect(LEVELS[3].jellies).toBeGreaterThan(0);
      expect(LEVELS[4].current).toBeGreaterThan(0);
      expect(LEVELS[5].current).toBeGreaterThan(0);
      expect(LEVELS[2].coral).toBeGreaterThan(LEVELS[1].coral);
      expect(LEVELS[5].treasures).toBe(8);
   });
});

function levelHalf(level: (typeof LEVELS)[1]): { hx: number; hz: number } {
   return { hx: level.width / 2, hz: level.depth / 2 };
}
