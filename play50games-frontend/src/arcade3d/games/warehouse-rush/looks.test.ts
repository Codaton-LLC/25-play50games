import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import { fitView } from "@/arcade3d/core/view";
import { scaledCount } from "@/arcade3d/core/quality";
import { FOV, VIEW } from "./camera";
import {
   COLORS,
   DECOR,
   FOG,
   GROUND,
   LEVEL_LOOKS,
   PLAY_BOUNDS,
   VIEW_CAMERAS,
   contrastRatio,
   decorOf,
   inPlayBounds,
   type DecorSpot,
} from "./looks";
import { PALLET_SLOTS, RACK, ROBOT_START, ZONE, cornerSignX, cornerSignZ } from "./rules";

/** Axis-aligned bounding box of a decor spot. */
function decorBox(spot: DecorSpot, margin = 0) {
   const hx = (spot.sx / 2) + margin;
   const hz = (spot.sz / 2) + margin;
   return {
      minX: spot.x - hx,
      maxX: spot.x + hx,
      minY: spot.y - spot.sy / 2,
      maxY: spot.y + spot.sy / 2,
      minZ: spot.z - hz,
      maxZ: spot.z + hz,
   };
}

/** Check if a ray from origin to target intersects an axis-aligned box. */
function rayIntersectsBox(
   ro: Vector3,
   rd: Vector3,
   maxDist: number,
   box: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
): boolean {
   let tmin = (box.minX - ro.x) / (rd.x === 0 ? 1e-8 : rd.x);
   let tmax = (box.maxX - ro.x) / (rd.x === 0 ? 1e-8 : rd.x);
   if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

   let tymin = (box.minY - ro.y) / (rd.y === 0 ? 1e-8 : rd.y);
   let tymax = (box.maxY - ro.y) / (rd.y === 0 ? 1e-8 : rd.y);
   if (tymin > tymax) [tymin, tymax] = [tymax, tymin];

   if (tmin > tymax || tymin > tmax) return false;
   if (tymin > tmin) tmin = tymin;
   if (tymax < tmax) tmax = tymax;

   let tzmin = (box.minZ - ro.z) / (rd.z === 0 ? 1e-8 : rd.z);
   let tzmax = (box.maxZ - ro.z) / (rd.z === 0 ? 1e-8 : rd.z);
   if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];

   if (tmin > tzmax || tzmin > tmax) return false;
   if (tzmin > tmin) tmin = tzmin;
   if (tzmax < tmax) tmax = tzmax;

   return tmin >= 0 && tmin < maxDist;
}

/** Sets up a Three.js PerspectiveCamera matching fitView at a given screen resolution. */
function cameraFor(width: number, height: number): { camera: PerspectiveCamera; distance: number; yaw: number } {
   const fit = fitView({ ...VIEW, width, height, fov: FOV, avoid: [] });
   const camera = new PerspectiveCamera(FOV, width / height, 0.1, 400);
   camera.position.set(fit.offset[0], fit.offset[1], fit.offset[2]);
   camera.lookAt(0, 0, 0);
   camera.updateMatrixWorld(true);
   camera.updateProjectionMatrix();
   return { camera, distance: fit.distance, yaw: fit.yaw };
}

describe("warehouse-rush modern-look: surroundings outside play area", () => {
   it("every decor spot stands strictly outside the play bounds with clearance >= 0.4 m", () => {
      expect(DECOR.length).toBeGreaterThan(20);
      for (const spot of DECOR) {
         // The spot center must be outside
         const centerOutside = !inPlayBounds(spot.x, spot.z, 0.4);
         expect(
            centerOutside,
            `spot ${spot.kind} at (${spot.x}, ${spot.z}) must sit outside play bounds`
         ).toBe(true);

         // Its bounding box must not overlap PLAY_BOUNDS
         const box = decorBox(spot);
         const overlapsPlayBounds =
            box.minX < PLAY_BOUNDS.x1 &&
            box.maxX > PLAY_BOUNDS.x0 &&
            box.minZ < PLAY_BOUNDS.z1 &&
            box.maxZ > PLAY_BOUNDS.z0;

         expect(
            overlapsPlayBounds,
            `spot ${spot.kind} box [${box.minX.toFixed(1)}, ${box.maxX.toFixed(1)}] x [${box.minZ.toFixed(1)}, ${box.maxZ.toFixed(1)}] overlaps play bounds`
         ).toBe(false);
      }
   });

   it("the ground covers the full view at all three screen sizes with no void showing below the scene", () => {
      const halfW = GROUND.width / 2;
      const halfD = GROUND.depth / 2;
      const raycaster = new Raycaster();

      for (const [name, size] of Object.entries(VIEW_CAMERAS)) {
         const { camera } = cameraFor(size.width, size.height);

         // Check the bottom screen corners (ndc y = -1) and middle: they must hit the ground plane within GROUND boundaries
         for (const ndcX of [-0.98, 0, 0.98]) {
            for (const ndcY of [-0.98, -0.5, 0]) {
               raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);
               const ray = raycaster.ray;
               if (ray.direction.y < -1e-4) {
                  // Ray points down towards ground plane y = 0
                  const t = (0 - ray.origin.y) / ray.direction.y;
                  const hitX = ray.origin.x + ray.direction.x * t;
                  const hitZ = ray.origin.z + ray.direction.z * t;

                  expect(
                     Math.abs(hitX),
                     `${name}: ground hit X ${hitX.toFixed(1)} must be within ground halfWidth ${halfW}`
                  ).toBeLessThan(halfW);
                  expect(
                     Math.abs(hitZ),
                     `${name}: ground hit Z ${hitZ.toFixed(1)} must be within ground halfDepth ${halfD}`
                  ).toBeLessThan(halfD);
               }
            }
         }
      }
   });

   it("no decor mesh sits between the camera and any play area point at any of the three sizes", () => {
      // Key target points in the play area
      const targets: Vector3[] = [
         new Vector3(ROBOT_START.x, 0, ROBOT_START.z),
         new Vector3(ROBOT_START.x, 1.2, ROBOT_START.z),
         // The 4 pallet slots
         ...PALLET_SLOTS.map((s) => new Vector3(s.x, 0.5, s.z)),
         // The 4 drop zone centers
         ...[0, 1, 2, 3].map((c) => {
            const x = (cornerSignX(c) * (ZONE.innerX + PLAY_BOUNDS.x1)) / 2;
            const z = (cornerSignZ(c) * (ZONE.innerZ + PLAY_BOUNDS.z1)) / 2;
            return new Vector3(x, 0.1, z);
         }),
         // The 2 shelf rack centers
         new Vector3(-2.8, 0.5, 0),
         new Vector3(2.8, 0.5, 0),
         // Play area boundary corners
         new Vector3(PLAY_BOUNDS.x0, 0, PLAY_BOUNDS.z0),
         new Vector3(PLAY_BOUNDS.x1, 0, PLAY_BOUNDS.z0),
         new Vector3(PLAY_BOUNDS.x0, 0, PLAY_BOUNDS.z1),
         new Vector3(PLAY_BOUNDS.x1, 0, PLAY_BOUNDS.z1),
      ];

      for (const [name, size] of Object.entries(VIEW_CAMERAS)) {
         const { camera } = cameraFor(size.width, size.height);
         const camPos = camera.position;

         for (const target of targets) {
            const dir = new Vector3().subVectors(target, camPos);
            const dist = dir.length();
            dir.normalize();

            for (const spot of DECOR) {
               const box = decorBox(spot);
               const hit = rayIntersectsBox(camPos, dir, dist - 0.1, box);
               expect(
                  hit,
                  `${name}: decor ${spot.kind} at (${spot.x}, ${spot.z}, y=${spot.y}) occludes target at (${target.x}, ${target.z})`
               ).toBe(false);
            }
         }
      }
   });
});

describe("warehouse-rush modern-look: lighting, fog, and readability", () => {
   it("the play area stays strictly unfogged from every fitted camera distance", () => {
      // Distance from camera to farthest play area corner must always be less than FOG.near
      for (const [, size] of Object.entries(VIEW_CAMERAS)) {
         const { camera, distance } = cameraFor(size.width, size.height);
         for (const x of [PLAY_BOUNDS.x0, PLAY_BOUNDS.x1]) {
            for (const z of [PLAY_BOUNDS.z0, PLAY_BOUNDS.z1]) {
               const cornerDist = camera.position.distanceTo(new Vector3(x, 0, z));
               expect(
                  cornerDist,
                  `camera at distance ${distance.toFixed(1)} to corner (${x}, ${z}): cornerDist ${cornerDist.toFixed(1)} must be < fog near ${FOG.near}`
               ).toBeLessThan(FOG.near);
            }
         }
      }
   });

   it("level looks define valid lighting presets and colors for all 5 levels", () => {
      for (let levelId = 1; levelId <= 5; levelId++) {
         const look = LEVEL_LOOKS[levelId as 1 | 2 | 3 | 4 | 5];
         expect(look).toBeDefined();
         expect(["indoor", "day", "sunset", "night"]).toContain(look.lighting);
         expect(look.skyTop).toMatch(/^#[0-9a-f]{6}$/i);
         expect(look.sky).toMatch(/^#[0-9a-f]{6}$/i);
         expect(look.fog).toMatch(/^#[0-9a-f]{6}$/i);
      }
   });

   it("key gameplay colors achieve crisp contrast against the polished concrete floor", () => {
      // Floor color vs zone colors and robot
      const contrastZoneA = contrastRatio(COLORS.zoneA, COLORS.floor);
      const contrastZoneB = contrastRatio(COLORS.zoneB, COLORS.floor);
      const contrastRobot = contrastRatio(COLORS.robot, COLORS.floor);
      const contrastRack = contrastRatio(COLORS.rackUpright, COLORS.floor);

      expect(contrastZoneA).toBeGreaterThan(1.5);
      expect(contrastZoneB).toBeGreaterThan(1.5);
      expect(contrastRobot).toBeGreaterThan(1.2);
      expect(contrastRack).toBeGreaterThan(1.2);

      // Contrast of white letters against dark hazard border
      expect(contrastRatio("#ffffff", COLORS.hazard)).toBeGreaterThan(10.0);
   });

   it("decor counts scale correctly with quality tiers", () => {
      const walls = decorOf("wall");
      expect(scaledCount(walls.length, 1.0)).toBe(walls.length);
      expect(scaledCount(walls.length, 0.8)).toBeLessThanOrEqual(walls.length);
      expect(scaledCount(walls.length, 0.5)).toBeLessThan(walls.length);
   });
});
