// The drawn island against the rules: the waterline is the rules' shore through the tide,
// the follow camera's window per screen, decor crabs, palette contrast and readability,
// and verification that surroundings decor stays strictly outside the play area and never
// occludes the explorer or any treasure from the fitted camera at 1280x800, 390x844, and 844x390.
import { describe, expect, it } from "vitest";
import { fitView } from "@/arcade3d/core/view";
import {
   COLORS,
   FOV,
   OUTER_PALMS,
   OUTER_ROCKS,
   PITCH,
   PLAY_LIMITS,
   SHIPWRECK,
   WINDOW,
   contrastRatio,
   crabAngles,
   distanceToSegmentXZ,
   groundHeight,
   inPlayArea,
   viewFor,
   waterLevel,
   windowHalf,
} from "./looks";
import { FALLBACK_ISLAND, ISLAND, TIDE, clearance, generateIsland, rho, shoreAt } from "./rules";

describe("treasure-island looks", () => {
   it("draws the waterline exactly at the rules' shore through the whole tide", () => {
      for (let t = 0; t <= 95; t += 0.5) {
         const shore = shoreAt(t);
         expect(groundHeight(shore)).toBeCloseTo(waterLevel(shore), 9);
      }
      expect(waterLevel(1)).toBeCloseTo(-0.3, 9);
      expect(waterLevel(TIDE.finalShore)).toBeCloseTo(0, 9);
      // flat sand inland, then down, steeper past the full-tide shore
      expect(groundHeight(0.5)).toBe(0);
      expect(groundHeight(ISLAND.sandFlat)).toBe(0);
      expect(groundHeight(1.1)).toBeLessThan(groundHeight(1));
   });

   it("fits a closer window on a phone and about 60 % of the island on a desktop", () => {
      expect(windowHalf(390, 844)).toEqual({ hx: 3.75, hz: 5.25 });
      expect(windowHalf(844, 390)).toEqual({ hx: 8, hz: 5 });
      expect(windowHalf(1280, 800)).toEqual({ hx: WINDOW.maxHalfX, hz: WINDOW.maxHalfZ });
      const desk = windowHalf(1280, 800);
      const share = (4 * desk.hx * desk.hz) / (Math.PI * ISLAND.rx * ISLAND.rz);
      expect(share).toBeGreaterThan(0.55);
      expect(share).toBeLessThan(0.65);
      // one cached object per window size: useFittedView refits only when it changes
      expect(viewFor(390, 844)).toBe(viewFor(391, 845));
      expect(viewFor(390, 844)).not.toBe(viewFor(1280, 800));
      // with no HUD, the phone draws about 42 px per metre at the explorer
      const scale = (w: number, h: number) => {
         const v = viewFor(w, h);
         const fit = fitView({ ...v, width: w, height: h, fov: FOV });
         return h / (2 * fit.distance * Math.tan((FOV * Math.PI) / 360));
      };
      // the explorer (1.556 m, about 1 m on screen at this pitch) is drawn about 40 px tall
      expect(scale(390, 844) * 1.556 * Math.cos(PITCH)).toBeGreaterThan(38);
      const phone = windowHalf(390, 844);
      expect(desk.hx * desk.hz).toBeGreaterThan(3 * phone.hx * phone.hz);
      expect(PITCH).toBeCloseTo((50 * Math.PI) / 180, 9);
   });

   it("puts three crabs on the beach clear of every prop on most islands", () => {
      expect(crabAngles(FALLBACK_ISLAND)).toHaveLength(3);
      let three = 0;
      for (let seed = 0; seed < 200; seed++) {
         const island = generateIsland(seed);
         const angles = crabAngles(island);
         if (angles.length === 3) three++;
         for (const a of angles) {
            expect(clearance(island, ISLAND.rx * 0.94 * Math.cos(a), ISLAND.rz * 0.94 * Math.sin(a))).toBeGreaterThanOrEqual(1.5);
         }
      }
      expect(three).toBeGreaterThan(190);
   });

   it("guarantees high contrast and readability across key gameplay elements", () => {
      // Explorer teal shirt on dry sand and wet sand
      expect(contrastRatio(COLORS.shirt, COLORS.sand)).toBeGreaterThan(3.5);
      expect(contrastRatio(COLORS.shirt, COLORS.wetSand)).toBeGreaterThan(2.0);
      // Explorer on green grass
      expect(contrastRatio(COLORS.shirt, COLORS.grassSun)).toBeGreaterThan(2.5);
      // Gold detector pulse on dark hole, and detector dark rim on sand
      expect(contrastRatio(COLORS.gold, COLORS.hole)).toBeGreaterThan(4.0);
      expect(contrastRatio("#0d1b2a", COLORS.sand)).toBeGreaterThan(8.0);
      // Dug hole dark earth on sand
      expect(contrastRatio(COLORS.hole, COLORS.sand)).toBeGreaterThan(6.0);
      expect(contrastRatio(COLORS.hole, COLORS.sandSun)).toBeGreaterThan(6.5);
      // Sea shallows vs deep ocean
      expect(contrastRatio(COLORS.sea, COLORS.deep)).toBeGreaterThan(2.0);
      expect(contrastRatio(COLORS.sea, COLORS.oceanBed)).toBeGreaterThan(5.0);
   });

   it("places all outer decor strictly outside the play area bounds with safe clearance", () => {
      // Play area is rho <= 1.12 plus dock. Check every outer rock, palm and shipwreck.
      for (const rock of OUTER_ROCKS) {
         expect(inPlayArea(rock.x, rock.z, 0.5), `rock at (${rock.x}, ${rock.z}) must be outside play area`).toBe(false);
         expect(rho(rock.x, rock.z)).toBeGreaterThanOrEqual(1.5);
      }
      for (const palm of OUTER_PALMS) {
         expect(inPlayArea(palm.x, palm.z, 0.5), `palm at (${palm.x}, ${palm.z}) must be outside play area`).toBe(false);
         expect(rho(palm.x, palm.z)).toBeGreaterThanOrEqual(1.5);
      }
      expect(inPlayArea(SHIPWRECK.x, SHIPWRECK.z, 0.5), "shipwreck must be outside play area").toBe(false);
      expect(rho(SHIPWRECK.x, SHIPWRECK.z)).toBeGreaterThanOrEqual(2.0);
   });

   it("guarantees zero occlusion of the explorer and treasures from the fitted camera across all 3 resolutions", () => {
      const resolutions = [
         { w: 1280, h: 800 },
         { w: 390, h: 844 },
         { w: 844, h: 390 },
      ];

      // Collect all decor obstacles with their conservative 2D XZ collision radius
      const decorItems = [
         ...OUTER_ROCKS.map((r) => ({ x: r.x, z: r.z, radius: r.scale * 0.9 })),
         ...OUTER_PALMS.map((p) => ({ x: p.x, z: p.z, radius: p.scale * 1.5 })),
         { x: SHIPWRECK.x, z: SHIPWRECK.z, radius: SHIPWRECK.radius },
      ];

      for (const { w, h } of resolutions) {
         const view = viewFor(w, h);
         const fit = fitView({ ...view, width: w, height: h, fov: FOV });
         // Camera offset in world frame (yaw is 0, looking north from the south)
         const camOffsetX = 0;
         const camOffsetZ = fit.distance * Math.cos(PITCH);

         // Sample explorer positions across the playable area (rho <= 1.12)
         for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
            for (let r = 0; r <= PLAY_LIMITS.maxRho; r += 0.35) {
               const ex = ISLAND.rx * r * Math.cos(angle);
               const ez = ISLAND.rz * r * Math.sin(angle);
               const camX = ex + camOffsetX;
               const camZ = ez + camOffsetZ;

               // Check ray from camera to explorer
               for (const item of decorItems) {
                  const dist = distanceToSegmentXZ(item.x, item.z, camX, camZ, ex, ez);
                  expect(dist, `decor at (${item.x}, ${item.z}) must not occlude explorer at (${ex}, ${ez}) at ${w}x${h}`).toBeGreaterThan(
                     item.radius
                  );
               }
            }
         }

         // Sample treasure positions on 50 island seeds
         for (let seed = 0; seed < 50; seed++) {
            const island = generateIsland(seed);
            for (const t of island.treasures) {
               // When explorer is near or walking to this treasure, check visibility
               const camX = t.x + camOffsetX;
               const camZ = t.z + camOffsetZ;

               for (const item of decorItems) {
                  const dist = distanceToSegmentXZ(item.x, item.z, camX, camZ, t.x, t.z);
                  expect(dist, `decor at (${item.x}, ${item.z}) must not occlude treasure at (${t.x}, ${t.z}) at ${w}x${h}`).toBeGreaterThan(
                     item.radius
                  );
               }
            }
         }
      }
   });

   it("ensures the ocean seabed and water cover the entire camera view at all three sizes without gaps", () => {
      const oceanHalf = 90; // Water and sea-bed are 180x180 (semi-extent 90 m)
      for (const { w, h } of [
         { w: 1280, h: 800 },
         { w: 390, h: 844 },
         { w: 844, h: 390 },
      ]) {
         const { hx, hz } = windowHalf(w, h);
         const fit = fitView({ ...viewFor(w, h), width: w, height: h, fov: FOV });
         // Furthest extent seen by the camera from the most extreme explorer position
         const maxCamDist = fit.distance;
         const maxExplorerX = ISLAND.rx * PLAY_LIMITS.maxRho;
         const maxExplorerZ = ISLAND.rz * PLAY_LIMITS.maxRho;
         expect(maxExplorerX + hx + maxCamDist).toBeLessThan(oceanHalf);
         expect(maxExplorerZ + hz + maxCamDist).toBeLessThan(oceanHalf);
      }
   });
});
