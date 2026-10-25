// Decor stays behind the play column, and the mountain wall covers the lower view at the
// three review sizes. The fitted cameras are the same fit the scene uses.
import { describe, expect, it } from "vitest";
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, Vector3 } from "three";
import { fitView, setLensShift, type ScreenRect } from "@/arcade3d/core/view";
import { FOV, VIEW } from "./camera";
import {
   BACKDROP, BIRD_BOB, BIRD_RADIUS, BIRDS, CLOUD_DRIFT, CLOUDS, COLORS, DECOR, FIELD_Z, FOG, PLAY, ROCKS, SKY_RADIUS,
   birdAabb, buildBackdrop, contrastRatio, decorAabb, mountainHeight, overlapsPlay, segmentHitsBox,
} from "./looks";

const SIZES = [
   { name: "1280x800", w: 1280, h: 800, touch: false },
   { name: "390x844", w: 390, h: 844, touch: true },
   { name: "844x390", w: 844, h: 390, touch: true },
] as const;

function avoidFor(width: number, height: number, banner: number, touch: boolean): ScreenRect[] {
   const avoid: ScreenRect[] = [{ left: 0, top: 0, right: width, bottom: 64 }];
   if (touch) {
      avoid.push(
         { left: 20, right: 152, top: height - banner - 152, bottom: height - banner - 20 },
         { left: width - 92, right: width - 20, top: height - banner - 92, bottom: height - banner - 20 },
      );
   } else {
      avoid.push(
         { left: 10, top: 10, right: 220, bottom: 52 },
         { left: width - 104, top: 10, right: width - 10, bottom: 54 },
      );
   }
   if (banner) avoid.push({ left: 0, right: width, top: height - banner, bottom: height });
   return avoid;
}

function fittedCamera(width: number, height: number, focusY: number, banner: number, touch: boolean): PerspectiveCamera {
   const fit = fitView({ ...VIEW, fov: FOV, width, height, avoid: avoidFor(width, height, banner, touch) });
   const camera = new PerspectiveCamera(FOV, width / height, 0.1, 400);
   setLensShift(camera, fit.shift[0], fit.shift[1], width, height);
   camera.position.set(fit.offset[0], fit.offset[1] + focusY, fit.offset[2]);
   camera.lookAt(0, focusY, 0);
   camera.updateMatrixWorld(true);
   camera.updateProjectionMatrix();
   return camera;
}

const CAMERAS = SIZES.flatMap((size) => [0, 140].flatMap((banner) => [0.5, 1].map((focus) => ({
   name: `${size.name} banner ${banner} focus ${focus}`,
   camera: fittedCamera(size.w, size.h, focus, banner, size.touch),
}))));

const TARGETS = [
   { x: 0, y: 0, z: 0 },
   { x: -1.98, y: 0.2, z: 0 },
   { x: 1.98, y: 0.55, z: 0 },
   { x: -1.5, y: 1, z: 0 },
   { x: 1.5, y: 1, z: 0 },
   { x: -1.9, y: 0.8, z: 0 },
   { x: 1.9, y: 0.8, z: 0 },
];
for (const x of [PLAY.x0, 0, PLAY.x1]) {
   for (const y of [PLAY.y0, 1, PLAY.y1]) {
      for (const z of [PLAY.z0, 0, PLAY.z1]) TARGETS.push({ x, y, z });
   }
}

const COVER_RAYS = [
   { name: "bottom-left", x: -1, y: -1 },
   { name: "bottom-right", x: 1, y: -1 },
   { name: "bottom-center", x: 0, y: -1 },
   { name: "mid-left", x: -1, y: 0 },
   { name: "mid-right", x: 1, y: 0 },
   { name: "lower-left", x: -1, y: -0.35 },
   { name: "lower-right", x: 1, y: -0.35 },
] as const;

function rayThrough(camera: PerspectiveCamera, nx: number, ny: number): { dirZ: number; t: number; x: number; y: number } {
   const origin = camera.position.clone();
   const dir = new Vector3(nx, ny, 0.5).unproject(camera).sub(origin).normalize();
   const t = (BACKDROP.z - origin.z) / dir.z;
   return { dirZ: dir.z, t, x: origin.x + t * dir.x, y: origin.y + t * dir.y };
}

describe("tower-climb look", () => {
   it("keeps every decor spot, and clouds at every drift, strictly outside the play column", () => {
      expect(DECOR.length).toBeGreaterThan(15);
      expect(CLOUDS.length).toBeGreaterThanOrEqual(5);
      expect(ROCKS.length).toBeGreaterThanOrEqual(10);
      for (const spot of DECOR) {
         for (const drift of spot.kind === "cloud" ? [-CLOUD_DRIFT, 0, CLOUD_DRIFT] : [0]) {
            const box = decorAabb(spot, drift);
            expect(box.max.z, `${spot.kind} z`).toBeLessThan(PLAY.z0 - 1);
            expect(overlapsPlay(box), `${spot.kind} at ${spot.x},${spot.z} drift ${drift}`).toBe(false);
         }
      }
      for (let i = 0; i < BIRDS.count; i++) {
         for (let k = 0; k < 8; k++) {
            for (const bob of [-BIRD_BOB, 0, BIRD_BOB]) {
               const box = birdAabb(i, (k / 8) * Math.PI * 2, bob);
               expect(box.max.z).toBeLessThan(PLAY.z0 - 1);
               expect(overlapsPlay(box)).toBe(false);
            }
         }
      }
      // the flock's own radius stays inside the tested box
      expect(BIRD_RADIUS).toBeGreaterThan(0.3);
   });

   it("keeps the mountain mesh behind the column and low under the route", () => {
      const mesh = buildBackdrop();
      for (let i = 2; i < mesh.positions.length; i += 3) {
         expect(mesh.positions[i]).toBeLessThanOrEqual(FIELD_Z + 1e-6);
      }
      expect(FIELD_Z).toBeLessThan(PLAY.z0 - 1);
      for (const x of [-6, -2.3, 0, 2.3, 6]) expect(mountainHeight(x, FIELD_Z)).toBeLessThan(PLAY.y0);
      expect(mesh.positions.length / 9).toBeLessThan(2500);
   });

   it("starts the fog past the fitted column and keeps the sky inside the far plane", () => {
      let farthest = 0;
      const corner = new Vector3();
      for (const { camera } of CAMERAS) {
         expect(camera.position.z).toBeGreaterThan(5);
         for (const x of [PLAY.x0, PLAY.x1]) for (const y of [PLAY.y0, PLAY.y1]) for (const z of [PLAY.z0, PLAY.z1]) {
            farthest = Math.max(farthest, corner.set(x, y, z).distanceTo(camera.position));
         }
      }
      expect(FOG.near).toBeGreaterThan(farthest);
      expect(FOG.far).toBeGreaterThan(FOG.near + 20);
      expect(SKY_RADIUS).toBeLessThan(400);
      expect(SKY_RADIUS).toBeGreaterThan(40);
   });

   it("covers the lower and side edges with the mountain wall and leaves sky at the top", () => {
      for (const { name, camera } of CAMERAS) {
         for (const ray of COVER_RAYS) {
            const hit = rayThrough(camera, ray.x, ray.y);
            expect(hit.dirZ, name).toBeLessThan(0);
            expect(hit.t, `${name} ${ray.name}`).toBeGreaterThan(0);
            expect(hit.x, `${name} ${ray.name} x ${hit.x.toFixed(1)}`).toBeGreaterThanOrEqual(BACKDROP.x0);
            expect(hit.x, `${name} ${ray.name} x ${hit.x.toFixed(1)}`).toBeLessThanOrEqual(BACKDROP.x1);
            expect(hit.y, `${name} ${ray.name} y ${hit.y.toFixed(1)}`).toBeGreaterThanOrEqual(BACKDROP.y0);
            expect(hit.y, `${name} ${ray.name} y ${hit.y.toFixed(1)}`).toBeLessThanOrEqual(BACKDROP.y1);
         }
         const sky = rayThrough(camera, 0, 1);
         expect(sky.t, name).toBeGreaterThan(0);
         expect(sky.y, `${name} top y ${sky.y.toFixed(1)}`).toBeGreaterThan(BACKDROP.y1);
      }
   });

   it("puts no decor and no mountain in front of the ledges, coins, flag or runner", () => {
      const data = buildBackdrop();
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(data.positions, 3));
      geometry.computeBoundingSphere();
      const mountains = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
      const raycaster = new Raycaster();
      const origin = new Vector3();
      const dir = new Vector3();
      const drifts = [-CLOUD_DRIFT, -0.5 * CLOUD_DRIFT, 0, 0.5 * CLOUD_DRIFT, CLOUD_DRIFT];
      try {
         for (const { name, camera } of CAMERAS) {
            const cam = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
            for (const target of TARGETS) {
               for (const spot of DECOR) {
                  for (const drift of spot.kind === "cloud" ? drifts : [0]) {
                     expect(
                        segmentHitsBox(cam, target, decorAabb(spot, drift)),
                        `${name} ${spot.kind} drift ${drift} blocks ${target.x},${target.y},${target.z}`,
                     ).toBe(false);
                  }
               }
               for (let i = 0; i < BIRDS.count; i++) {
                  for (let k = 0; k < 8; k++) {
                     for (const bob of [-BIRD_BOB, BIRD_BOB]) {
                        expect(segmentHitsBox(cam, target, birdAabb(i, (k / 8) * Math.PI * 2, bob))).toBe(false);
                     }
                  }
               }
               origin.copy(camera.position);
               dir.set(target.x - origin.x, target.y - origin.y, target.z - origin.z);
               const dist = dir.length();
               dir.multiplyScalar(1 / dist);
               raycaster.set(origin, dir);
               raycaster.far = dist - 0.05;
               const hits = raycaster.intersectObject(mountains);
               expect(hits, `${name} mountain blocks ${target.x},${target.y},${target.z}`).toHaveLength(0);
            }
         }
      } finally {
         geometry.dispose();
         (mountains.material as MeshBasicMaterial).dispose();
      }
   });

   it("keeps the route, the coin, the hazard and the runner readable against the shaft and the sky", () => {
      expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
      for (const color of [COLORS.slab, COLORS.moving, COLORS.spur, COLORS.gold, COLORS.hazard, COLORS.hoodie]) {
         expect(contrastRatio(color, COLORS.shaft), color).toBeGreaterThanOrEqual(2.4);
      }
      expect(contrastRatio(COLORS.slab, COLORS.sky)).toBeGreaterThanOrEqual(1.6);
      expect(contrastRatio(COLORS.moving, COLORS.sky)).toBeGreaterThanOrEqual(1.6);
      expect(contrastRatio(COLORS.hazard, COLORS.sky)).toBeGreaterThanOrEqual(2);
      // the gold stripe sits on the checkpoint's stone face; the coin hangs in front of the shaft
      expect(contrastRatio(COLORS.gold, COLORS.ledge)).toBeGreaterThanOrEqual(2.4);
      expect(contrastRatio(COLORS.slabCap, COLORS.slab)).toBeGreaterThanOrEqual(1.8);
      expect(contrastRatio(COLORS.crack, COLORS.cracked)).toBeGreaterThanOrEqual(2);
   });
});
