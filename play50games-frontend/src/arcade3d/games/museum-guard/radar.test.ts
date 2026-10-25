// The radar rewrites SVG only when the guard's aim or a statue's pose changed.
import { describe, expect, it } from "vitest";
import { COLORS } from "./looks";
import { createRadarStamp, paintRadar } from "./Hud";
import { createRun, RING } from "./rules";

interface Node {
   setAttribute(name: string, value: string): void;
   names: string[];
   values: Map<string, string>;
}

function node(): Node {
   const names: string[] = [];
   const values = new Map<string, string>();
   return {
      names,
      values,
      setAttribute(name: string, value: string) {
         names.push(name);
         values.set(name, value);
      },
   };
}

describe("museum-guard radar", () => {
   it("paints a static scene once and builds no path strings after that", () => {
      const run = createRun(1);
      const stamp = createRadarStamp();
      const beam = node();
      const blips = Array.from({ length: RING.count }, () => node());
      expect(paintRadar(beam, blips, run, stamp)).toBe(true);
      expect(beam.names).toEqual(["d"]);
      expect(beam.values.get("d")).toContain("M 50 50");
      for (const blip of blips) {
         expect(blip.names).toEqual(["d", "fill", "stroke", "stroke-width", "opacity"]);
         expect(blip.values.get("fill")).toBe(COLORS.still);
         expect(blip.values.get("opacity")).toBe("0.4");
      }
      beam.names.length = 0;
      for (const blip of blips) blip.names.length = 0;
      for (let i = 0; i < 30; i++) expect(paintRadar(beam, blips, run, stamp)).toBe(false);
      expect(beam.names).toEqual([]);
      for (const blip of blips) expect(blip.names).toEqual([]);
   });

   it("rewrites only the beam when the guard turns, and only that blip when a statue moves", () => {
      const run = createRun(1);
      const stamp = createRadarStamp();
      const beam = node();
      const blips = Array.from({ length: RING.count }, () => node());
      paintRadar(beam, blips, run, stamp);
      beam.names.length = 0;
      for (const blip of blips) blip.names.length = 0;

      run.yaw += 0.2;
      expect(paintRadar(beam, blips, run, stamp)).toBe(true);
      expect(beam.names).toEqual(["d"]);
      for (const blip of blips) expect(blip.names).toEqual([]);

      beam.names.length = 0;
      run.exhibits[3].x += 0.4;
      expect(paintRadar(beam, blips, run, stamp)).toBe(true);
      expect(beam.names).toEqual([]);
      expect(blips[3].names).toEqual(["d"]);
      for (let i = 0; i < RING.count; i++) if (i !== 3) expect(blips[i].names).toEqual([]);

      blips[3].names.length = 0;
      run.exhibits[3].mode = "sneaking";
      expect(paintRadar(beam, blips, run, stamp)).toBe(true);
      expect(blips[3].names).toEqual(["fill", "stroke", "stroke-width", "opacity"]);
      expect(blips[3].values.get("fill")).toBe("none");
      expect(blips[3].values.get("stroke")).toBe(COLORS.sneak);
      expect(paintRadar(beam, blips, run, stamp)).toBe(false);
   });
});
