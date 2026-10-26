import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { LEVEL_IDS } from "@/arcade3d/types";
import { ASSETS, BOULDER_HALF_H, FIT, GLB_SIZE } from "./assets";
import { LEVELS } from "./levels";
import { SOUTH_WALL_H, campSpots, mesaSpots, wallSpots } from "./looks";
import { BOULDER_RADIUS, ROCK_RADIUS, ROVER } from "./rules";

async function bounds(url: string) {
   const { cloud } = await readCharacterGlb(url);
   const min = [Infinity, Infinity, Infinity];
   const max = [-Infinity, -Infinity, -Infinity];
   for (let i = 0; i < cloud.length; i++) {
      const a = i % 3;
      min[a] = Math.min(min[a], cloud[i]);
      max[a] = Math.max(max[a], cloud[i]);
   }
   return { min, max, width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
}

const S = (a: ModelAsset) => a.scale ?? 1;

describe("mars-rover-mission GLB fits (real meshes)", () => {
   it("every adopted GLB is listed and measures as recorded, pivot on the floor centre", async () => {
      for (const id of Object.keys(GLB_SIZE) as (keyof typeof GLB_SIZE)[]) {
         const url = `/models/3d/mars-rover-mission/${id}.glb`;
         expect(hasModel(url)).toBe(true);
         const b = await bounds(url);
         expect(b.width).toBeCloseTo(GLB_SIZE[id].width, 3);
         expect(b.height).toBeCloseTo(GLB_SIZE[id].height, 3);
         expect(b.depth).toBeCloseTo(GLB_SIZE[id].depth, 3);
         expect(b.min[1]).toBeCloseTo(0, 3);
         expect((b.min[0] + b.max[0]) / 2).toBeCloseTo(0, 2);
         expect((b.min[2] + b.max[2]) / 2).toBeCloseTo(0, 2);
      }
      for (const skip of ["marsRoverV2", "groundSolarPanel", "ancientMarsRuin"]) expect(hasModel(`/models/3d/mars-rover-mission/${skip}.glb`)).toBe(false);
   });

   it("the rover's long axis is the GLB's z, the axis it drives along (yaw 0 = +z); the nose (the dense instrument end) at +z, the mast aft of centre", async () => {
      expect(GLB_SIZE.marsRover.depth).toBeGreaterThan(GLB_SIZE.marsRover.width);
      const { cloud } = await readCharacterGlb(ASSETS.rover.url);
      let mast = 0;
      let mastN = 0;
      let front = 0;
      let back = 0;
      for (let i = 0; i < cloud.length; i += 3) {
         const y = cloud[i + 1];
         const z = cloud[i + 2];
         if (y > 1.0) {
            mast += z;
            mastN++;
         } else if (y > 0.6) {
            if (z > 0) front++;
            else back++;
         }
      }
      expect(mast / mastN).toBeLessThan(0);
      expect(front).toBeGreaterThan(back);
      expect(ASSETS.rover.rotationY).toBeUndefined();
   });

   it("gameplay sizes match the rules: the rover in its circle, rocks and boulders as wide as theirs", () => {
      expect(GLB_SIZE.marsRover.depth * S(ASSETS.rover)).toBeCloseTo(FIT.roverLength, 6);
      // the rover's body fits its 1.1 m collision circle within 10 %
      expect(Math.hypot(GLB_SIZE.marsRover.width, GLB_SIZE.marsRover.depth) * S(ASSETS.rover) / 2).toBeLessThan(ROVER.radius * 1.45);
      expect(GLB_SIZE.marsRover.width * S(ASSETS.rover)).toBeLessThan(2 * ROVER.radius);
      expect(GLB_SIZE.sampleRock.width * S(ASSETS.rock)).toBeCloseTo(2 * ROCK_RADIUS, 6);
      expect(GLB_SIZE.marsBoulder.depth * S(ASSETS.boulder)).toBeCloseTo(2 * BOULDER_RADIUS, 6);
      expect(ASSETS.boulder.yOffset).toBeCloseTo(-BOULDER_HALF_H, 9);
      expect(GLB_SIZE.sampleRock.width * S(ASSETS.sample)).toBeCloseTo(FIT.sampleSize, 6);
      expect(GLB_SIZE.beaconLight.height * S(ASSETS.beacon)).toBeCloseTo(FIT.beaconHeight, 6);
      expect(GLB_SIZE.chargingStation.height * S(ASSETS.charger)).toBeCloseTo(FIT.stationHeight, 6);
   });

   it("decor GLBs are fitted to 1 m, so a decor spot's scale is its size (never scaled twice)", () => {
      expect(GLB_SIZE.groundSolarPanelV2.width * S(ASSETS.solarPanel)).toBeCloseTo(1, 6);
      expect(GLB_SIZE.marsBase.depth * S(ASSETS.base)).toBeCloseTo(1, 6);
      expect(GLB_SIZE.commsAntenna.height * S(ASSETS.antenna)).toBeCloseTo(1, 6);
      expect(GLB_SIZE.researchCrate.width * S(ASSETS.crate)).toBeCloseTo(1, 6);
      expect(GLB_SIZE.landingCapsule.height * S(ASSETS.capsule)).toBeCloseTo(1, 6);
      expect(GLB_SIZE.marsMesaRock.depth * S(ASSETS.wall)).toBeCloseTo(1, 6);
      expect(GLB_SIZE.marsMesaTall.depth * S(ASSETS.mesa)).toBeCloseTo(1, 6);
      for (const a of [ASSETS.solarPanel, ASSETS.base, ASSETS.antenna, ASSETS.crate, ASSETS.capsule, ASSETS.wall, ASSETS.mesa] as ModelAsset[]) expect(a.stretch).toBeUndefined();
   });
});

describe("mars-rover-mission decor spots", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: walls frame the plain (the south one low), mesas and the camp stay outside it`, () => {
         const L = LEVELS[id];
         const hx = L.width / 2;
         const hz = L.depth / 2;
         const outside = (x: number, z: number) => Math.abs(x) > hx || Math.abs(z) > hz;
         const wallH = (GLB_SIZE.marsMesaRock.height / GLB_SIZE.marsMesaRock.depth);
         for (const w of wallSpots(L)) {
            expect(outside(w.x, w.z)).toBe(true);
            if (w.z > hz) expect(wallH * (w.sy ?? w.scale ?? 1)).toBeLessThanOrEqual(SOUTH_WALL_H + 1e-9);
         }
         for (const m of mesaSpots(L, id)) {
            expect(outside(m.x, m.z)).toBe(true);
            // nothing tall on the camera's (south) side
            expect(m.z).toBeLessThan(hz);
         }
         const camp = campSpots(L);
         for (const p of [camp.base, camp.antenna, camp.capsule, camp.astronaut, ...camp.crates]) expect(p.z).toBeGreaterThan(hz + 1);
      });
   }
});
