// Looks, decor bounds, camera occlusion, and ground coverage tests for luggage-rush.
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import { fitView } from "@/arcade3d/core/view";
import {
   BELT_MARKERS,
   COLORS,
   DECOR_SPOTS,
   FLOOR,
   FOG_RANGE,
   PLAY_AREA,
   inPlayArea,
} from "./looks";
import { DIVERTER_AT, FLIGHTS } from "./rules";

const AREA = {
   min: { x: PLAY_AREA.minX, y: PLAY_AREA.minY, z: PLAY_AREA.minZ },
   max: { x: PLAY_AREA.maxX, y: PLAY_AREA.maxY, z: PLAY_AREA.maxZ },
};
const LOOK = [(AREA.min.x + AREA.max.x) / 2, 0, (AREA.min.z + AREA.max.z) / 2];

const VIEW_BASE = {
   area: AREA,
   pitch: (50 * Math.PI) / 180,
   margin: { top: 0.1, bottom: 0.08, left: 0.02, right: 0.02 },
   padding: 8,
   shift: true as const,
   fov: 50,
   maxDistance: 90,
};

const VIEWPORTS = [
   { name: "1280x800", w: 1280, h: 800, yaws: [0.55] },
   { name: "390x844", w: 390, h: 844, yaws: [0] },
   { name: "844x390", w: 844, h: 390, yaws: [Math.PI / 2] },
] as const;

function channel(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(a: string, b: string): number {
   const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
   };
   const hi = Math.max(lum(a), lum(b));
   const lo = Math.min(lum(a), lum(b));
   return (hi + 0.05) / (lo + 0.05);
}

function getCamera(vp: (typeof VIEWPORTS)[number]): { cam: PerspectiveCamera; pos: Vector3; distance: number } {
   const fitted = fitView({ ...VIEW_BASE, width: vp.w, height: vp.h, yaws: vp.yaws });
   const cam = new PerspectiveCamera(50, vp.w / vp.h, 0.1, 1000);
   const pos = new Vector3(LOOK[0] + fitted.offset[0], LOOK[1] + fitted.offset[1], LOOK[2] + fitted.offset[2]);
   cam.position.copy(pos);
   cam.lookAt(LOOK[0], LOOK[1], LOOK[2]);
   if (fitted.shift) {
      cam.setViewOffset(vp.w, vp.h, -fitted.shift[0] * vp.w * 0.5, fitted.shift[1] * vp.h * 0.5, vp.w, vp.h);
   }
   cam.updateMatrixWorld();
   cam.updateProjectionMatrix();
   return { cam, pos, distance: fitted.distance };
}

describe("luggage-rush look", () => {
   it("keeps every decor spot strictly outside the play area", () => {
      expect(DECOR_SPOTS.length).toBeGreaterThanOrEqual(12);
      for (const spot of DECOR_SPOTS) {
         expect(
            inPlayArea(spot.x, spot.z),
            `spot ${spot.kind} at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) must be outside play area`
         ).toBe(false);
      }
   });

   it("covers the entire ground view at 1280x800, 390x844, and 844x390 (no void below the scene)", () => {
      const halfW = FLOOR.width / 2;
      const halfD = FLOOR.depth / 2;
      const minFloorX = FLOOR.centerX - halfW;
      const maxFloorX = FLOOR.centerX + halfW;
      const minFloorZ = FLOOR.centerZ - halfD;
      const maxFloorZ = FLOOR.centerZ + halfD;

      for (const vp of VIEWPORTS) {
         const { cam } = getCamera(vp);
         const raycaster = new Raycaster();
         // Test bottom edge samples and lower corners of the viewport
         const points = [
            [-1, -1],
            [-0.5, -1],
            [0, -1],
            [0.5, -1],
            [1, -1],
            [-1, -0.5],
            [1, -0.5],
         ];

         for (const [ndcX, ndcY] of points) {
            raycaster.setFromCamera(new Vector2(ndcX, ndcY), cam);
            // Ray must point down towards the floor y=0
            expect(raycaster.ray.direction.y, `${vp.name} ndc(${ndcX}, ${ndcY}) ray must point down`).toBeLessThan(-1e-4);
            const t = -raycaster.ray.origin.y / raycaster.ray.direction.y;
            const hit = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, t);

            expect(
               hit.x,
               `${vp.name} ndc(${ndcX}, ${ndcY}) hit.x ${hit.x.toFixed(1)} must be on floor`
            ).toBeGreaterThanOrEqual(minFloorX);
            expect(
               hit.x,
               `${vp.name} ndc(${ndcX}, ${ndcY}) hit.x ${hit.x.toFixed(1)} must be on floor`
            ).toBeLessThanOrEqual(maxFloorX);
            expect(
               hit.z,
               `${vp.name} ndc(${ndcX}, ${ndcY}) hit.z ${hit.z.toFixed(1)} must be on floor`
            ).toBeGreaterThanOrEqual(minFloorZ);
            expect(
               hit.z,
               `${vp.name} ndc(${ndcX}, ${ndcY}) hit.z ${hit.z.toFixed(1)} must be on floor`
            ).toBeLessThanOrEqual(maxFloorZ);
         }
      }
   });

   it("ensures no decor spot occludes any diverter or play target from the fitted camera", () => {
      for (const vp of VIEWPORTS) {
         const { pos: camPos } = getCamera(vp);

         for (const diverter of DIVERTER_AT) {
            const targetPos = new Vector3(diverter.x, diverter.y + 0.55, diverter.z);
            const toTarget = new Vector3().subVectors(targetPos, camPos);
            const rayLen = toTarget.length();
            const rayDir = toTarget.clone().normalize();

            // Decor spots have bounding radius of at most 0.8 m
            for (const spot of DECOR_SPOTS) {
               const spotPos = new Vector3(spot.x, spot.y + 0.5, spot.z);
               const toSpot = new Vector3().subVectors(spotPos, camPos);
               const proj = toSpot.dot(rayDir);
               // If spot is between camera and target (0 < proj < rayLen):
               if (proj > 0.5 && proj < rayLen - 0.5) {
                  const perp = new Vector3().subVectors(toSpot, rayDir.clone().multiplyScalar(proj));
                  const distToRay = perp.length();
                  // Must stay clear by at least 0.6 m
                  expect(
                     distToRay,
                     `${vp.name}: spot ${spot.kind} at (${spot.x}, ${spot.z}) must not occlude diverter at (${diverter.x}, ${diverter.z})`
                  ).toBeGreaterThan(0.6);
               }
            }
         }
      }
   });

   it("starts fog beyond the furthest play area corner for all three viewports", () => {
      // The furthest corner of the play area from any camera must be closer than FOG_RANGE.near (36 m)
      const playCorners = [
         new Vector3(PLAY_AREA.minX, 0, PLAY_AREA.minZ),
         new Vector3(PLAY_AREA.maxX, 0, PLAY_AREA.minZ),
         new Vector3(PLAY_AREA.minX, 0, PLAY_AREA.maxZ),
         new Vector3(PLAY_AREA.maxX, 0, PLAY_AREA.maxZ),
         new Vector3(PLAY_AREA.minX, PLAY_AREA.maxY, PLAY_AREA.minZ),
         new Vector3(PLAY_AREA.maxX, PLAY_AREA.maxY, PLAY_AREA.maxZ),
      ];

      for (const vp of VIEWPORTS) {
         const { pos: camPos } = getCamera(vp);
         for (const corner of playCorners) {
            const dist = camPos.distanceTo(corner);
            expect(
               dist,
               `${vp.name} distance to play corner (${corner.x}, ${corner.z}) is ${dist.toFixed(1)}m, fog starts at ${FOG_RANGE.near}m`
            ).toBeLessThan(FOG_RANGE.near);
         }
      }
      expect(FOG_RANGE.far).toBeGreaterThan(FOG_RANGE.near);
   });

   it("maintains high contrast for all flight colours against the belt and floor", () => {
      // Diverter arrow against conveyor belt:
      expect(contrastRatio(COLORS.diverterArrow, COLORS.beltSlat)).toBeGreaterThan(4.5);

      // Flight tag colours against conveyor belt:
      for (const [name, color] of Object.entries(COLORS.flights)) {
         const ratio = contrastRatio(color, COLORS.beltSlat);
         expect(ratio, `flight ${name} (${color}) against belt (${COLORS.beltSlat})`).toBeGreaterThanOrEqual(2.5);
      }
   });

   it("ensures each belt marker is at least a minimum on-screen size and its colour matches its destination", () => {
      expect(BELT_MARKERS).toHaveLength(4);

      for (let i = 0; i < BELT_MARKERS.length; i++) {
         const marker = BELT_MARKERS[i];
         const flight = FLIGHTS[i];

         // 1. Colour and symbol match the destination flight exactly:
         expect(marker.flight).toBe(i);
         expect(marker.color.toLowerCase()).toBe(flight.color.toLowerCase());
         expect(marker.symbol).toBe(flight.symbol);

         // 2. High contrast against the dark belt slat:
         const contrast = contrastRatio(marker.color, COLORS.beltSlat);
         expect(contrast, `marker ${i} (${marker.color}) against belt (${COLORS.beltSlat})`).toBeGreaterThanOrEqual(2.5);

         // 3. On-screen projected size across all three viewports:
         for (const vp of VIEWPORTS) {
            const { cam } = getCamera(vp);

            // Center of the marker
            const center = new Vector3(marker.x, marker.y, marker.z);

            // Two points spanning the marker height facing the camera
            const camUp = new Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
            const top = center.clone().addScaledVector(camUp, marker.size / 2).project(cam);
            const bot = center.clone().addScaledVector(camUp, -marker.size / 2).project(cam);

            // Screen pixel height
            const screenH = Math.abs((top.y - bot.y) * 0.5 * vp.h);

            // Must be at least 32 px on-screen for instant mobile readability
            expect(
               screenH,
               `${vp.name}: marker ${i} size (${screenH.toFixed(1)} px) must be >= 32 px`
            ).toBeGreaterThanOrEqual(32);

            // Center must be within visible viewport bounds
            const proj = center.clone().project(cam);
            expect(proj.x, `${vp.name} marker ${i} NDC x`).toBeGreaterThan(-1);
            expect(proj.x, `${vp.name} marker ${i} NDC x`).toBeLessThan(1);
            expect(proj.y, `${vp.name} marker ${i} NDC y`).toBeGreaterThan(-1);
            expect(proj.y, `${vp.name} marker ${i} NDC y`).toBeLessThan(1);
         }
      }
   });

   it("ensures scene elements against the dark belt are not near-black", () => {
      // Diverter base & puck on the belt slat:
      expect(contrastRatio(COLORS.diverterBase, COLORS.beltSlat)).toBeGreaterThanOrEqual(2.0);
      expect(contrastRatio(COLORS.diverterPuck, COLORS.beltSlat)).toBeGreaterThanOrEqual(3.0);

      // Rubber bumper trim next to the belt is not near-black:
      expect(contrastRatio(COLORS.rubberBumper, "#000000")).toBeGreaterThanOrEqual(2.0);
   });
});
