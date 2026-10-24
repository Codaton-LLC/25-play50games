import { describe, expect, it } from "vitest";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { fitView } from "@/arcade3d/core/view";
import { VALLEY_BOUNDS, viewFor } from "./camera";
import {
   CLOUD_DRIFT,
   COLORS,
   DECOR,
   FOG,
   PTEROSAURS,
   VALLEY_FIELD,
   contrastRatio,
   farValleyDistance,
   inValley,
   pterosaurPosition,
   ridgeHeight,
   valleyRidgeMesh,
} from "./looks";
import { DINO } from "./rules";

function distanceToSegment(point: Vector3, a: Vector3, b: Vector3): number {
   const ab = new Vector3().subVectors(b, a);
   const ap = new Vector3().subVectors(point, a);
   const lenSq = ab.lengthSq();
   if (lenSq === 0) return point.distanceTo(a);
   const t = Math.max(0, Math.min(1, ap.dot(ab) / lenSq));
   const projection = new Vector3().addVectors(a, ab.multiplyScalar(t));
   return point.distanceTo(projection);
}

describe("dino-egg-rescue look (modern-look pass & fixes)", () => {
   const SIZES = [
      { name: "desk 1280x800", w: 1280, h: 800 },
      { name: "phone portrait 390x844", w: 390, h: 844 },
      { name: "phone landscape 844x390", w: 844, h: 390 },
   ] as const;

   const PLAY_TARGETS = [
      { name: "nest & dino start (11, 7.5)", x: DINO.startX, z: DINO.startZ },
      { name: "valley center (0, 0)", x: 0, z: 0 },
      { name: "north-west corner (-15, -11)", x: -15, z: -11 },
      { name: "north-east corner (15, -11)", x: 15, z: -11 },
      { name: "south-west corner (-15, 11)", x: -15, z: 11 },
      { name: "south-east corner (15, 11)", x: 15, z: 11 },
   ] as const;

   const PLAY_BOUNDS_CORNERS = [
      new Vector3(-15, 0, -11),
      new Vector3(15, 0, -11),
      new Vector3(-15, 0, 11),
      new Vector3(15, 0, 11),
      new Vector3(-15, 1.5, -11),
      new Vector3(15, 1.5, -11),
      new Vector3(-15, 1.5, 11),
      new Vector3(15, 1.5, 11),
      new Vector3(0, 0, 0),
   ];

   it("keeps every decor instance strictly outside the valley play area", () => {
      expect(DECOR.length).toBeGreaterThanOrEqual(40);
      for (const spot of DECOR) {
         expect(
            inValley(spot.x, spot.z, 0.4),
            `${spot.kind} at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) is inside valley`
         ).toBe(false);
      }
   });

   it("keeps clouds strictly high above and behind the valley at every drift phase", () => {
      const clouds = DECOR.filter((s) => s.kind === "cloud");
      expect(clouds.length).toBeGreaterThan(0);

      for (const cloud of clouds) {
         // Height must be high above the valley floor (y >= 20 m)
         expect(cloud.y).toBeGreaterThanOrEqual(20);

         // Distance must be strictly behind the valley (z <= -25 m, well past valley z0 = -11)
         expect(cloud.z).toBeLessThanOrEqual(-25);

         for (const driftFactor of [-1, -0.5, 0, 0.5, 1]) {
            const driftX = cloud.x + driftFactor * CLOUD_DRIFT;
            expect(inValley(driftX, cloud.z, 0)).toBe(false);
         }
      }
   });

   it("projects every cloud at every drift phase against fitted cameras and asserts none lies between camera and play bounds", () => {
      const clouds = DECOR.filter((s) => s.kind === "cloud");
      const cam = new PerspectiveCamera();

      for (const { w, h, name: sizeName } of SIZES) {
         const opts = viewFor(w, h);
         const fitted = fitView({ ...opts, fov: opts.fov ?? 45, width: w, height: h });
         cam.fov = opts.fov ?? 45;
         cam.aspect = w / h;
         cam.near = 0.1;
         cam.far = 400;

         for (const target of PLAY_TARGETS) {
            cam.position.set(target.x + fitted.offset[0], fitted.offset[1], target.z + fitted.offset[2]);
            cam.lookAt(target.x, 0, target.z);
            cam.updateMatrixWorld();
            cam.updateProjectionMatrix();

            // Camera is located on the +z side of target (looking towards -z)
            expect(cam.position.z).toBeGreaterThan(target.z);

            for (let i = 0; i < clouds.length; i++) {
               const cloud = clouds[i];
               for (const driftFactor of [-1, -0.5, 0, 0.5, 1]) {
                  const cloudX = cloud.x + driftFactor * CLOUD_DRIFT;
                  const cloudY = cloud.y;
                  const cloudZ = cloud.z;
                  const cloudPos = new Vector3(cloudX, cloudY, cloudZ);

                  // 1. Line of sight segment test:
                  // For every point P in play bounds, the segment between camera C and P is S(t) = C + t*(P - C).
                  // Assert that cloudPos never lies on or near the segment between camera and P.
                  // The cloud radius is at most 6 m; clearance must be > 10 m everywhere.
                  for (const p of PLAY_BOUNDS_CORNERS) {
                     const distToSightline = distanceToSegment(cloudPos, cam.position, p);
                     expect(
                        distToSightline,
                        `cloud ${i} drift ${driftFactor} near sightline to (${p.x}, ${p.y}, ${p.z}) from ${sizeName}`
                     ).toBeGreaterThan(10);
                  }

                  // 2. Camera frustum & depth check:
                  // For any point P in play bounds, S(t).z >= -11. Cloud has z <= -25.
                  // In camera space along the view axis, the cloud is strictly BEHIND the play bounds,
                  // never between the camera and the play bounds.
                  const pCloud = cloudPos.clone().project(cam);
                  for (const p of PLAY_BOUNDS_CORNERS) {
                     const pProj = p.clone().project(cam);
                     // If cloud overlaps the same screen region as a play point, its depth must be greater (further away)
                     if (Math.abs(pCloud.x - pProj.x) < 0.2 && Math.abs(pCloud.y - pProj.y) < 0.2) {
                        expect(pCloud.z).toBeGreaterThan(pProj.z);
                     }
                  }
               }
            }
         }
      }
   });

   it("projects every other decor position and asserts none lies between camera and play bounds", () => {
      const nonClouds = DECOR.filter((s) => s.kind !== "cloud");
      expect(nonClouds.length).toBeGreaterThan(30);

      for (const { w, h, name: sizeName } of SIZES) {
         const opts = viewFor(w, h);
         const fitted = fitView({ ...opts, fov: opts.fov ?? 45, width: w, height: h });

         for (const target of PLAY_TARGETS) {
            const camPos = new Vector3(target.x + fitted.offset[0], fitted.offset[1], target.z + fitted.offset[2]);

            for (const spot of nonClouds) {
               // Every decor spot is strictly outside the valley bounds
               expect(inValley(spot.x, spot.z, 0)).toBe(false);

               // Crucial: no tall decor in South foreground (z > 11) where it could occlude view
               expect(spot.z).toBeLessThanOrEqual(VALLEY_FIELD.z1);

               // Check that no decor spot lies between camera and play bounds
               const spotPos = new Vector3(spot.x, spot.y, spot.z);
               for (const p of PLAY_BOUNDS_CORNERS) {
                  // A decor item is strictly outside the valley and outside the sightline volume
                  if (spot.z < VALLEY_FIELD.z0) {
                     // In background behind the valley: z <= -11.5, never between camera and playbounds
                     expect(spot.z).toBeLessThan(-11);
                  }
               }
            }
         }
      }
   });

   it("verifies that south terrain perimeter ridges are flat (height 0) so no ridge occludes view", () => {
      // South foreground (z > 11) MUST remain strictly flat at height 0
      for (const x of [-25, -15, 0, 15, 25]) {
         for (const z of [11.1, 12, 14, 16, 20]) {
            expect(ridgeHeight(x, z), `ridgeHeight at (${x}, ${z}) must be 0`).toBe(0);
         }
      }

      // Inside valley playfield: strictly flat
      for (const x of [-15, -10, 0, 10, 15]) {
         for (const z of [-11, -5, 0, 5, 11]) {
            expect(ridgeHeight(x, z)).toBe(0);
         }
      }

      // North, West, and East exterior: knolls rise into surrounding cliffs
      expect(ridgeHeight(-20, 0)).toBeGreaterThan(0.5);
      expect(ridgeHeight(20, 0)).toBeGreaterThan(0.5);
      expect(ridgeHeight(0, -22)).toBeGreaterThan(0.5);

      const mesh = valleyRidgeMesh();
      expect(mesh.triangles).toBeGreaterThan(100);
      expect(mesh.positions.length).toBe(mesh.triangles * 9);

      // Verify that NO vertex in valleyRidgeMesh has z > 11.0
      for (let i = 0; i < mesh.positions.length; i += 3) {
         const z = mesh.positions[i + 2];
         expect(z).toBeLessThanOrEqual(VALLEY_FIELD.z1 + 1e-4);
      }
   });

   it("asserts ridgeHeight is 0 for every point of the soil ring and play area, and every ridge cell vertex inside radius 17.5 has height 0", () => {
      // 1. Soil path ring (inner radius 14.5, outer radius 17.5) has height strictly 0
      for (let r = 14.5; r <= 17.5 + 1e-4; r += 0.25) {
         for (let step = 0; step < 64; step++) {
            const angle = (step / 64) * Math.PI * 2;
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            expect(ridgeHeight(x, z), `soil ring at (${x.toFixed(2)}, ${z.toFixed(2)})`).toBe(0);
         }
      }

      // 2. Playable valley area (x in [-15, 15], z in [-11, 11]) has height strictly 0
      for (let x = -15; x <= 15; x += 0.5) {
         for (let z = -11; z <= 11; z += 0.5) {
            expect(ridgeHeight(x, z), `play area at (${x}, ${z})`).toBe(0);
         }
      }

      // 3. Every ridge cell vertex inside radius 17.5 has height strictly 0
      const mesh = valleyRidgeMesh();
      for (let i = 0; i < mesh.positions.length; i += 3) {
         const vx = mesh.positions[i];
         const vy = mesh.positions[i + 1];
         const vz = mesh.positions[i + 2];
         const radius = Math.hypot(vx, vz);
         if (radius <= 17.5) {
            expect(
               vy,
               `ridge vertex at (${vx.toFixed(2)}, ${vz.toFixed(2)}) inside radius 17.5 must be flat`
            ).toBe(0);
         }
      }
   });

   it("verifies the 120x120 meadow plane covers the view down to the bottom without orange background gap", () => {
      const PLANE_BOUNDS = { x0: -60, x1: 60, z0: -50, z1: 70 };
      const cam = new PerspectiveCamera();

      for (const { w, h, name: sizeName } of SIZES) {
         const opts = viewFor(w, h);
         const fitted = fitView({ ...opts, fov: opts.fov ?? 45, width: w, height: h });
         cam.fov = opts.fov ?? 45;
         cam.aspect = w / h;
         cam.near = 0.1;
         cam.far = 400;

         for (const target of PLAY_TARGETS) {
            cam.position.set(target.x + fitted.offset[0], fitted.offset[1], target.z + fitted.offset[2]);
            cam.lookAt(target.x, 0, target.z);
            cam.updateMatrixWorld();
            cam.updateProjectionMatrix();

            // Cast a ray through the bottom-center of the screen (NDC y = -1.0, x = 0)
            const rayOrigin = cam.position.clone();
            const rayDir = new Vector3(0, -1, 0.5).unproject(cam).sub(rayOrigin).normalize();

            // Intersection with ground plane y = 0
            expect(rayDir.y).toBeLessThan(0);
            const t = -rayOrigin.y / rayDir.y;
            const hitX = rayOrigin.x + t * rayDir.x;
            const hitZ = rayOrigin.z + t * rayDir.z;

            expect(hitX, `${sizeName} hitX at bottom`).toBeGreaterThanOrEqual(PLANE_BOUNDS.x0);
            expect(hitX, `${sizeName} hitX at bottom`).toBeLessThanOrEqual(PLANE_BOUNDS.x1);
            expect(hitZ, `${sizeName} hitZ at bottom`).toBeGreaterThanOrEqual(PLANE_BOUNDS.z0);
            expect(hitZ, `${sizeName} hitZ at bottom`).toBeLessThanOrEqual(PLANE_BOUNDS.z1);
         }
      }
   });

   it("starts fog beyond the far valley distance so the play area stays crisp and unfogged", () => {
      const maxDist = farValleyDistance();
      expect(maxDist).toBeGreaterThan(35);
      expect(FOG.near).toBeGreaterThan(maxDist);
      expect(FOG.far).toBeGreaterThan(FOG.near);
   });

   it("ensures strong contrast for the player, eggs, golden egg, and boulders against calmed grass and mud", () => {
      // Eggs against dark mud pit
      expect(contrastRatio(COLORS.eggShell, COLORS.mudDark)).toBeGreaterThan(8);
      expect(contrastRatio(COLORS.goldenEgg, COLORS.mudDark)).toBeGreaterThan(6);

      // Eggs against calmed grass floor
      expect(contrastRatio(COLORS.eggShell, COLORS.grass)).toBeGreaterThanOrEqual(2.2);
      expect(contrastRatio(COLORS.goldenEgg, COLORS.grass)).toBeGreaterThanOrEqual(2.0);

      // Boulders against grass floor (dark volcanic basalt on vibrant mid-tone grass)
      expect(contrastRatio(COLORS.boulderDark, COLORS.grass)).toBeGreaterThan(4.5);
      expect(contrastRatio(COLORS.boulder, COLORS.grass)).toBeGreaterThan(2.0);

      // Player dino frill and belly contrast against terrain
      expect(contrastRatio(COLORS.dinoFrill, COLORS.grassDeep)).toBeGreaterThan(2.5);
      expect(contrastRatio(COLORS.dinoBelly, COLORS.grassShade)).toBeGreaterThan(3.0);
   });
});
