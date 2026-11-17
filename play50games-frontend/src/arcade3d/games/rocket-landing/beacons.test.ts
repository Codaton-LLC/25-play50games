// The pad's rim beacons are small round lights on every planet: they ride in the pad group, whose
// scale.x is the planet's pad width, so each beacon cancels that stretch (beaconScaleX). Before,
// they were drawn 4-6 times wider than deep and read as thin floating bars.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BEACON_LIGHTS, BEACON_SIZE, beaconScaleX } from "./assets";
import { PLANETS, createRun } from "./rules";

vi.mock("@react-three/fiber", () => ({ useFrame: () => undefined }));
vi.mock("@/arcade3d/core/assets", async (importOriginal) => ({
   ...(await importOriginal<typeof import("@/arcade3d/core/assets")>()),
   useModel: () => ({ scene: null, animations: [], failed: false }),
}));

describe("rocket-landing rim beacons", () => {
   it("are drawn as round as they are deep on every planet's pad width", () => {
      for (const planet of PLANETS) {
         const drawnWidth = 2 * BEACON_SIZE.bottom * planet.width * beaconScaleX(planet.width);
         expect(drawnWidth).toBeCloseTo(2 * BEACON_SIZE.bottom, 12);
         // small: a light, never a bar across the rim
         expect(drawnWidth).toBeLessThanOrEqual(0.06 + 1e-12);
         expect(BEACON_SIZE.height).toBeLessThanOrEqual(2 * BEACON_SIZE.bottom);
      }
      expect(beaconScaleX(0)).toBe(1);
   });

   it("Planet renders every beacon with the counter-scale of the current planet", { timeout: 60_000 }, async () => {
      const { default: Planet } = await import("./Planet");
      for (let p = 0; p < PLANETS.length; p++) {
         const run = createRun(7);
         run.planet = p;
         const error = vi.spyOn(console, "error").mockImplementation(() => {});
         let html: string;
         try { html = renderToString(createElement(Planet, { run })).toLowerCase(); } finally { error.mockRestore(); }
         const beacons = html.match(/<mesh[^>]*scale-x="([^"]+)"[^>]*><cylindergeometry/g) ?? [];
         expect(beacons).toHaveLength(BEACON_LIGHTS.length);
         for (const tag of beacons) {
            const sx = Number(/scale-x="([^"]+)"/.exec(tag)![1]);
            expect(sx * PLANETS[p].width).toBeCloseTo(1, 12);
         }
      }
   });
});
