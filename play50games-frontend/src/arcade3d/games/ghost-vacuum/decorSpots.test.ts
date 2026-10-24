// Ghost Vacuum surroundings decor verification:
// Checks that every decor spot lies strictly outside the mansion play area,
// ensures ghosts keep >= 3:1 contrast against the floor (night readability),
// and verifies that no decor occludes the hunter or ghosts from the fitted camera at 1280x800, 390x844 and 844x390.
import { describe, expect, it } from "vitest";
import { fitView } from "@/arcade3d/core/view";
import { viewFor } from "./camera";
import { COLORS, contrastRatio, DECOR, decorOf, inMansion, MANSION_BOUNDS, type DecorSpot } from "./looks";
import { MANSION, ROOMS } from "./rules";

interface BoundingBox {
   minX: number;
   maxX: number;
   minY: number;
   maxY: number;
   minZ: number;
   maxZ: number;
}

/** Computes the 3D bounding box of a decor spot. */
function decorBox(spot: DecorSpot): BoundingBox {
   let hx = spot.sx / 2;
   let hz = spot.sz / 2;
   let hy = spot.sy;

   if (spot.kind === "tree") {
      hx = 1.2 * spot.sx;
      hz = 1.2 * spot.sz;
      hy = 3.6 * spot.sy;
   } else if (spot.kind === "hedge") {
      if (Math.abs(spot.rotY - Math.PI / 2) < 0.1) {
         const t = hx;
         hx = hz;
         hz = t;
      }
   } else if (spot.kind === "hill") {
      hx = spot.sx;
      hz = spot.sz;
      hy = spot.sy;
   } else if (spot.kind === "moon") {
      hx = spot.sx;
      hz = spot.sz;
      hy = spot.sy;
      return {
         minX: spot.x - hx,
         maxX: spot.x + hx,
         minY: spot.y - hy,
         maxY: spot.y + hy,
         minZ: spot.z - hz,
         maxZ: spot.z + hz,
      };
   }

   return {
      minX: spot.x - hx,
      maxX: spot.x + hx,
      minY: spot.y,
      maxY: spot.y + hy,
      minZ: spot.z - hz,
      maxZ: spot.z + hz,
   };
}

/** Checks whether a 3D line segment from A to B intersects a 3D bounding box (slab method). */
function segmentIntersectsBox(
   ax: number,
   ay: number,
   az: number,
   bx: number,
   by: number,
   bz: number,
   box: BoundingBox
): boolean {
   let tmin = 0;
   let tmax = 1;

   // X slab
   const dx = bx - ax;
   if (Math.abs(dx) < 1e-9) {
      if (ax < box.minX || ax > box.maxX) return false;
   } else {
      const invD = 1 / dx;
      let t1 = (box.minX - ax) * invD;
      let t2 = (box.maxX - ax) * invD;
      if (t1 > t2) {
         const temp = t1;
         t1 = t2;
         t2 = temp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
   }

   // Y slab
   const dy = by - ay;
   if (Math.abs(dy) < 1e-9) {
      if (ay < box.minY || ay > box.maxY) return false;
   } else {
      const invD = 1 / dy;
      let t1 = (box.minY - ay) * invD;
      let t2 = (box.maxY - ay) * invD;
      if (t1 > t2) {
         const temp = t1;
         t1 = t2;
         t2 = temp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
   }

   // Z slab
   const dz = bz - az;
   if (Math.abs(dz) < 1e-9) {
      if (az < box.minZ || az > box.maxZ) return false;
   } else {
      const invD = 1 / dz;
      let t1 = (box.minZ - az) * invD;
      let t2 = (box.maxZ - az) * invD;
      if (t1 > t2) {
         const temp = t1;
         t1 = t2;
         t2 = temp;
      }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
   }

   return true;
}

describe("ghost-vacuum decor: bounds and surroundings", () => {
   it("contains all 5 required surrounding decor kinds", () => {
      expect(decorOf("hedge").length).toBeGreaterThanOrEqual(10);
      expect(decorOf("gravestone").length).toBeGreaterThanOrEqual(8);
      expect(decorOf("tree").length).toBeGreaterThanOrEqual(8);
      expect(decorOf("hill").length).toBeGreaterThanOrEqual(6);
      expect(decorOf("moon").length).toBe(1);
   });

   it("every decor spot lies strictly outside the mansion play area", () => {
      const bad: string[] = [];
      for (const spot of DECOR) {
         if (inMansion(spot.x, spot.z)) {
            bad.push(`${spot.kind} at (${spot.x}, ${spot.z}): inside mansion`);
         }
         // Footprint check
         const box = decorBox(spot);
         const insideX = box.maxX > MANSION_BOUNDS.x0 + 0.1 && box.minX < MANSION_BOUNDS.x1 - 0.1;
         const insideZ = box.maxZ > MANSION_BOUNDS.z0 + 0.1 && box.minZ < MANSION_BOUNDS.z1 - 0.1;
         if (insideX && insideZ) {
            bad.push(`${spot.kind} footprint [${box.minX}, ${box.maxX}]x[${box.minZ}, ${box.maxZ}] touches mansion interior`);
         }
      }
      expect(bad).toEqual([]);
   });

   it("uses one coherent COLORS palette with valid hex colors", () => {
      const hexPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
      for (const [key, color] of Object.entries(COLORS)) {
         expect(color, `COLORS.${key}`).toMatch(hexPattern);
      }
   });

   it("ensures ghosts keep >= 3:1 contrast against the floor for night readability", () => {
      // Normal ghost against readable floor base
      expect(contrastRatio(COLORS.ghost, COLORS.floor)).toBeGreaterThanOrEqual(3.0);
      // Gold ghost against readable floor base
      expect(contrastRatio(COLORS.ghostGold, COLORS.floor)).toBeGreaterThanOrEqual(3.0);
      // Big ghost against readable floor base
      expect(contrastRatio(COLORS.ghostBig, COLORS.floor)).toBeGreaterThanOrEqual(3.0);
   });

   it("populates the south garden band below the mansion with low decor outside the house bounds", () => {
      const southHedges = DECOR.filter((s) => s.kind === "hedge" && s.z > MANSION_BOUNDS.z1);
      const southGraves = DECOR.filter((s) => s.kind === "gravestone" && s.z > MANSION_BOUNDS.z1);
      expect(southHedges.length).toBeGreaterThanOrEqual(10);
      expect(southGraves.length).toBeGreaterThanOrEqual(6);

      // Verify all south decor is low (y + sy <= 1.0m) and strictly outside house bounds
      for (const s of [...southHedges, ...southGraves]) {
         expect(s.z).toBeGreaterThan(MANSION_BOUNDS.z1);
         expect(s.y + s.sy).toBeLessThanOrEqual(1.0);
      }
   });
});

describe("ghost-vacuum decor: camera occlusion check", () => {
   const viewports = [
      { name: "desktop 1280x800", w: 1280, h: 800 },
      { name: "mobile portrait 390x844", w: 390, h: 844 },
      { name: "mobile landscape 844x390", w: 844, h: 390 },
   ];

   it("never occludes the hunter or a ghost from the fitted camera across all 3 viewports", () => {
      const bad: string[] = [];
      const decorBoxes = DECOR.map((s) => ({ spot: s, box: decorBox(s) }));

      for (const vp of viewports) {
         const options = viewFor(vp.w, vp.h);
         const fitted = fitView({ ...options, width: vp.w, height: vp.h, fov: options.fov ?? 45 });
         const [camOffsetX, camOffsetY, camOffsetZ] = fitted.offset;

         // Sample hunter positions across the mansion play area
         const hunterPositions = [
            // Center hall
            { x: 0, z: 8 },
            { x: 0, z: 0 },
            { x: 0, z: -8 },
            // North-West Library
            { x: -10, z: -7 },
            { x: -13, z: -9 },
            // South-West Study
            { x: -10, z: 7 },
            { x: -13, z: 9 },
            // North-East Kitchen
            { x: 10, z: -7 },
            { x: 13, z: -9 },
            // South-East Ballroom
            { x: 10, z: 7 },
            { x: 13, z: 9 },
         ];

         for (const hp of hunterPositions) {
            const camX = hp.x + camOffsetX;
            const camY = camOffsetY;
            const camZ = hp.z + camOffsetZ;

            // Targets: hunter's head (y=1.56) and feet (y=0)
            const targets = [
               { x: hp.x, y: 1.56, z: hp.z, desc: "hunter head" },
               { x: hp.x, y: 0.1, z: hp.z, desc: "hunter feet" },
            ];

            // Plus ghost positions in all 4 rooms
            for (const r of ROOMS) {
               targets.push(
                  { x: r.x, y: 1.2, z: r.z, desc: `ghost at room (${r.x}, ${r.z})` },
                  { x: r.x + r.side * 2, y: 0.8, z: r.z, desc: `ghost near room (${r.x}, ${r.z})` }
               );
            }

            for (const target of targets) {
               for (const { spot, box } of decorBoxes) {
                  if (segmentIntersectsBox(camX, camY, camZ, target.x, target.y, target.z, box)) {
                     bad.push(
                        `${vp.name}: ${spot.kind} at (${spot.x}, ${spot.z}) occludes ${target.desc} from camera (${camX.toFixed(1)}, ${camY.toFixed(1)}, ${camZ.toFixed(1)})`
                     );
                  }
               }
            }
         }
      }

      expect(bad).toEqual([]);
   });
});
