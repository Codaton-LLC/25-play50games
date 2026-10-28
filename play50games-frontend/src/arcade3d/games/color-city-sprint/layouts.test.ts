import { describe, expect, it } from "vitest";
import { SIGNATURE, LEVELS } from "./levels";
import { allowAll, courseFor, pathMetres } from "./city";
import { LEVEL_IDS } from "@/arcade3d/types";

describe("level layouts", () => {
   it("is route-making laps, and level 1's alley beats the avenue", () => {
      expect(SIGNATURE).toBe("route-making laps");
      const c = courseFor(1);
      expect(c.nx).toBe(3);
      expect(c.laps).toBe(2);
      expect(pathMetres(c, 2, 6, allowAll)).toBeLessThan(pathMetres(c, 2, 6, (e) => e.kind === "street"));
   });

   it("each level adds its own twist", () => {
      expect(LEVELS[2].busNodes).not.toBeNull();
      expect(LEVELS[3].gates.length).toBeGreaterThan(0);
      expect(LEVELS[4].night).toBe(true);
      expect(LEVELS[4].ring).toBe(true);
      expect(LEVELS[4].laps).toBe(3);
      expect(LEVELS[5].boss).toBe(true);
      for (const id of LEVEL_IDS) expect(courseFor(id).beacons.length).toBeGreaterThan(0);
   });

   it("a hero-gated route or secret exists for each power", () => {
      const c = courseFor(1);
      expect(c.cut).not.toBeNull();
      expect(c.blocks.some((b) => b.ghost)).toBe(true);
      expect(c.orbs.some((o) => o.y < 0.5)).toBe(true);
      expect(c.secrets[0].y).toBeGreaterThan(5);
   });
});
