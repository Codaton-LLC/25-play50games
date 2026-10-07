// Clean the City decor (decorSpots.ts, Decor.tsx): pure decoration that never meets the game.
// Every footprint is measured on the real GLB as it is drawn (assets.ts scale / stretch / rotationY,
// then the spot), and checked against the rules data: the floor, every obstacle square, every litter
// spawn spot and every reachable runner position of all three maps.
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Euler, Material, Matrix4, Quaternion, Vector3 } from "three";
import { aabbOverlap, distanceToBoxXZ, type AABB } from "@/arcade3d/core/collision";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { spotMatrix, type InstanceSpot } from "@/arcade3d/core/render";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import { createPigeonStandIn, disposePigeonStandIn } from "./Decor";
import {
   CAR_SPOTS,
   DASH_SPOTS,
   DECOR_KEEP_OUT,
   FLEE_DISTANCE,
   FLEE_HEIGHT,
   FLOOR_CONTENT_HALF,
   KERB,
   KERB_SPOTS,
   PIGEON_CYCLE,
   PIGEON_HEIGHT,
   PIGEON_HOMES,
   PIGEON_RADIUS,
   SCARE_FAR,
   SCARE_NEAR,
   SURROUND_SPOTS,
   TAXI_SPOTS,
   VAN_SPOTS,
   createPigeonPose,
   pigeonPose,
   stepScare,
   yawFacing,
} from "./decorSpots";
import { FLOOD_N, FLOOD_STEP, FLOOR_HALF, MAPS, RUNNER, SPAWN_HALF, START_PAD, buildMapCache, obstacleBox, spotX, spotZ, type MapCache } from "./rules";

/** Scene.tsx draws a litter piece's glow as a circle of this radius around its centre. */
const LITTER_GLOW = 0.72;
const UP = new Vector3(0, 1, 0);

/** The GLB's vertices placed like <InstancedModel> / <DynamicInstancedModel> draw them at `place`. */
async function drawnPoints(asset: ModelAsset, place: Matrix4): Promise<Vector3[]> {
   const { cloud } = await readCharacterGlb(asset.url);
   const s = asset.scale ?? 1;
   const k = asset.stretch ?? [1, 1, 1];
   const local = new Matrix4().compose(
      new Vector3(0, asset.yOffset ?? 0, 0),
      new Quaternion().setFromAxisAngle(UP, asset.rotationY ?? 0),
      new Vector3(s * k[0], s * k[1], s * k[2])
   );
   const m = place.clone().multiply(local);
   const points: Vector3[] = [];
   for (let i = 0; i < cloud.length; i += 3) points.push(new Vector3(cloud[i], cloud[i + 1], cloud[i + 2]).applyMatrix4(m));
   return points;
}

const toAabb = (box: Box3): AABB => ({ min: { x: box.min.x, y: box.min.y, z: box.min.z }, max: { x: box.max.x, y: box.max.y, z: box.max.z } });

/** The floor content's square (runner body, litter glows), tall. */
const KEEP_OUT: AABB = { min: { x: -DECOR_KEEP_OUT, y: -10, z: -DECOR_KEEP_OUT }, max: { x: DECOR_KEEP_OUT, y: 10, z: DECOR_KEEP_OUT } };

/** Outside the keep-out square, and on the far side or beside the floor: never beyond the near edge. */
function expectDecorPlace(box: Box3, label: string): void {
   expect(aabbOverlap(toAabb(box), KEEP_OUT), `${label} overlaps the floor content`).toBe(false);
   expect(box.max.z, `${label} beyond the near edge`).toBeLessThanOrEqual(FLOOR_HALF);
}

const caches: MapCache[] = [];
/** rules.ts's cache of map `map` (obstacle squares, reachable runner cells, clear litter spots), built once. */
const cacheOf = (map: number): MapCache => (caches[map] ??= buildMapCache(map));

/** Every rules position of every map stays clear of `box`: obstacles, litter spots (with their glow), reachable runner bodies. */
function expectClearOfRules(box: Box3, label: string): void {
   const decor = toAabb(box);
   for (let map = 0; map < MAPS.length; map++) {
      for (const o of MAPS[map].obstacles) expect(aabbOverlap(decor, obstacleBox(o)), `${label} vs ${o.kind}`).toBe(false);
      const cache = cacheOf(map);
      let nearestSpot = Infinity;
      for (const s of cache.spots) nearestSpot = Math.min(nearestSpot, distanceToBoxXZ(spotX(s), spotZ(s), decor));
      expect(nearestSpot, `${label}: litter spot on map ${map}`).toBeGreaterThan(LITTER_GLOW);
      let nearestRunner = Infinity;
      for (let c = 0; c < FLOOD_N * FLOOD_N; c++) {
         if (!cache.reachable[c]) continue;
         const x = (Math.floor(c / FLOOD_N) - (FLOOD_N - 1) / 2) * FLOOD_STEP;
         const z = ((c % FLOOD_N) - (FLOOD_N - 1) / 2) * FLOOD_STEP;
         nearestRunner = Math.min(nearestRunner, distanceToBoxXZ(x, z, decor));
      }
      expect(nearestRunner, `${label}: runner on map ${map}`).toBeGreaterThan(RUNNER.radius);
   }
}

describe("clean-city decor: the keep-out square", () => {
   it("holds everything the run draws on the floor", () => {
      expect(FLOOR_CONTENT_HALF).toBeGreaterThanOrEqual(SPAWN_HALF + RUNNER.radius);
      expect(FLOOR_CONTENT_HALF).toBeGreaterThanOrEqual(SPAWN_HALF + LITTER_GLOW);
      expect(FLOOR_CONTENT_HALF).toBeGreaterThanOrEqual(FLOOR_HALF);
      expect(DECOR_KEEP_OUT).toBeGreaterThan(FLOOR_CONTENT_HALF);
      // every obstacle square lies inside it
      for (const map of MAPS) {
         for (const o of map.obstacles) {
            expect(Math.abs(o.x) + o.halfX).toBeLessThan(DECOR_KEEP_OUT);
            expect(Math.abs(o.z) + o.halfZ).toBeLessThan(DECOR_KEEP_OUT);
         }
      }
      expect(Math.abs(START_PAD.z) + 1.12).toBeLessThan(DECOR_KEEP_OUT);
   });
});

describe("clean-city decor: parked cars (city)", () => {
   const kinds = [
      ["car", ASSETS.car, CAR_SPOTS],
      ["taxi", ASSETS.taxi, TAXI_SPOTS],
      ["van", ASSETS.van, VAN_SPOTS],
   ] as const;

   it("2-4 cars, each wholly outside the floor content, on the far street, clear of every rules position", async () => {
      const total = CAR_SPOTS.length + TAXI_SPOTS.length + VAN_SPOTS.length;
      expect(total).toBeGreaterThanOrEqual(2);
      expect(total).toBeLessThanOrEqual(4);
      const boxes: Box3[] = [];
      for (const [name, asset, spots] of kinds) {
         for (const spot of spots) {
            const box = new Box3().setFromPoints(await drawnPoints(asset, spotMatrix(spot)));
            const label = `${name} at (${spot.x}, ${spot.z})`;
            expectDecorPlace(box, label);
            expectClearOfRules(box, label);
            // beyond the far kerb, not on it
            expect(box.max.z, label).toBeLessThan(-(KERB.inner + KERB.width));
            expect(box.min.y, label).toBeCloseTo(0, 2);
            boxes.push(box);
         }
      }
      // parked cars never overlap each other
      for (let i = 0; i < boxes.length; i++) for (let j = 0; j < i; j++) expect(boxes[i].intersectsBox(boxes[j])).toBe(false);
   });

   it("are pigeon-crossing's GLBs (listed in the manifest), at life size next to the 0.95 runner", async () => {
      const runnerHeight = 0.95;
      const metresPerUnit = 1.75 / runnerHeight;
      const want = { car: [2.18, 0.91, 0.93], taxi: [2.42, 0.95, 1.06], van: [3.0, 1.03, 1.06] } as const;
      for (const [name, asset] of kinds) {
         expect(asset.url).toBe(`/models/3d/pigeon-crossing/${name}.glb`);
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(ASSETS[name]).toBe(asset);
         const size = new Box3().setFromPoints(await drawnPoints(asset, new Matrix4())).getSize(new Vector3());
         const [length, width, height] = want[name];
         expect(size.z, `${name} length`).toBeCloseTo(length, 1);
         expect(size.x, `${name} width`).toBeCloseTo(width, 1);
         expect(size.y, `${name} height`).toBeCloseTo(height, 1);
         if (name === "car") {
            expect(size.z * metresPerUnit).toBeGreaterThan(3.7);
            expect(size.z * metresPerUnit).toBeLessThan(4.3);
         }
      }
   });

   it("the kerb and the street line stay outside the floor content and off the near side", () => {
      for (const spot of [...KERB_SPOTS, ...DASH_SPOTS]) {
         const hx = (spot.sx ?? 1) / 2;
         const hz = (spot.sz ?? 1) / 2;
         const box = new Box3(new Vector3(spot.x - hx, 0, spot.z - hz), new Vector3(spot.x + hx, 0.1, spot.z + hz));
         expectDecorPlace(box, `strip at (${spot.x}, ${spot.z})`);
      }
   });

   it("the ground around the floor touches its edges, never lies under it, and stays below the litter glows", () => {
      for (const spot of SURROUND_SPOTS) {
         const hx = (spot.sx ?? 1) / 2;
         const hz = (spot.sz ?? 1) / 2;
         const inside = spot.x + hx > -FLOOR_HALF + 1e-9 && spot.x - hx < FLOOR_HALF - 1e-9 && spot.z + hz > -FLOOR_HALF + 1e-9 && spot.z - hz < FLOOR_HALF - 1e-9;
         expect(inside, `surround at (${spot.x}, ${spot.z})`).toBe(false);
         expect(spot.y + (spot.sy ?? 1) / 2).toBeLessThan(0);
      }
   });
});

describe("clean-city decor: pigeons (park)", () => {
   it("3-5 pigeons; every pose they take (pecking, hopping, flying off and back) stays outside the floor content", () => {
      expect(PIGEON_HOMES.length).toBeGreaterThanOrEqual(3);
      expect(PIGEON_HOMES.length).toBeLessThanOrEqual(5);
      const pose = createPigeonPose();
      for (const home of PIGEON_HOMES) {
         expect(Math.hypot(home.awayX, home.awayZ)).toBeCloseTo(1, 9);
         for (const scare of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
            for (const fleeing of [true, false]) {
               for (let t = 0; t < 3 * PIGEON_CYCLE; t += 0.02) {
                  pigeonPose(home, t, scare, fleeing, pose);
                  const box = new Box3(
                     new Vector3(pose.x - PIGEON_RADIUS, pose.y, pose.z - PIGEON_RADIUS),
                     new Vector3(pose.x + PIGEON_RADIUS, pose.y + PIGEON_HEIGHT, pose.z + PIGEON_RADIUS)
                  );
                  expect(aabbOverlap(toAabb(box), KEEP_OUT)).toBe(false);
                  expect(box.max.z).toBeLessThanOrEqual(FLOOR_HALF);
                  expect(pose.y).toBeGreaterThanOrEqual(0);
                  expect(pose.y).toBeLessThanOrEqual(FLEE_HEIGHT + 0.1);
               }
            }
         }
         // the home and the landing spot FLEE_DISTANCE out, with their footprints, clear of every rules position
         for (const out of [0, FLEE_DISTANCE]) {
            const x = home.x + home.awayX * out;
            const z = home.z + home.awayZ * out;
            const box = new Box3(new Vector3(x - PIGEON_RADIUS, 0, z - PIGEON_RADIUS), new Vector3(x + PIGEON_RADIUS, PIGEON_HEIGHT, z + PIGEON_RADIUS));
            expectClearOfRules(box, `pigeon at (${x}, ${z})`);
         }
      }
   });

   it("pigeons keep their distance from each other", () => {
      for (let i = 0; i < PIGEON_HOMES.length; i++) {
         for (let j = 0; j < i; j++) {
            const a = PIGEON_HOMES[i];
            const b = PIGEON_HOMES[j];
            expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(4 * PIGEON_RADIUS);
         }
      }
   });

   it("peck and hop in place: no jump in heading or position between frames, the head never dips through the ground", async () => {
      const a = createPigeonPose();
      const b = createPigeonPose();
      for (const home of PIGEON_HOMES) {
         for (let t = 0; t < 4 * PIGEON_CYCLE; t += 1 / 60) {
            pigeonPose(home, t, 0, false, a);
            pigeonPose(home, t + 1 / 60, 0, false, b);
            expect(Math.abs(b.yaw - a.yaw)).toBeLessThan(0.15);
            expect(Math.abs(b.y - a.y)).toBeLessThan(0.03);
            expect(Math.hypot(b.x - a.x, b.z - a.z)).toBe(0);
         }
      }
      // every peck on the real mesh, placed as Decor.tsx places it: nothing below the ground
      let deepest = 0;
      let lowest = Infinity;
      const points = await drawnPoints(ASSETS.pigeon, new Matrix4());
      const place = new Matrix4();
      const p = new Vector3();
      for (let t = 0; t < PIGEON_CYCLE; t += 0.01) {
         const pose = pigeonPose(PIGEON_HOMES[0], t, 0, false, a);
         if (pose.pitch === 0) continue;
         deepest = Math.min(deepest, pose.pitch);
         place.makeRotationFromEuler(new Euler(pose.pitch, pose.yaw, 0, "YXZ")).setPosition(0, pose.y, 0);
         for (const q of points) lowest = Math.min(lowest, p.copy(q).applyMatrix4(place).y);
      }
      expect(deepest).toBeLessThan(-0.3);
      expect(lowest).toBeGreaterThan(-0.01);
   });

   it("is pigeon-crossing's pigeon GLB (listed in the manifest), a plain mesh about 0.30 tall facing -z at yaw 0", async () => {
      expect(ASSETS.pigeon.url).toBe("/models/3d/pigeon-crossing/pigeon.glb");
      expect(hasModel(ASSETS.pigeon.url)).toBe(true);
      expect(ASSETS.pigeon.rigged).toBe(false);
      expect("humanoid" in ASSETS.pigeon).toBe(false);
      const points = await drawnPoints(ASSETS.pigeon, new Matrix4());
      const box = new Box3().setFromPoints(points);
      const size = box.getSize(new Vector3());
      expect(size.y).toBeCloseTo(PIGEON_HEIGHT, 2);
      expect(Math.max(size.x, size.z) / 2).toBeLessThanOrEqual(PIGEON_RADIUS);
      // the head (the top tenth) is at -z: yawFacing(0, -1) = 0 faces it away from the camera
      const top = points.filter((p) => p.y > box.max.y - 0.1 * size.y);
      expect(top.reduce((sum, p) => sum + p.z, 0) / top.length).toBeLessThan(0);
      expect(yawFacing(0, -1)).toBeCloseTo(0, 9);
      // flying out faces the away direction: the drawn forward (-z) turned by the yaw
      for (const home of PIGEON_HOMES) {
         const yaw = yawFacing(home.awayX, home.awayZ);
         const forward = new Vector3(0, 0, -1).applyAxisAngle(UP, yaw);
         expect(forward.x).toBeCloseTo(home.awayX, 9);
         expect(forward.z).toBeCloseTo(home.awayZ, 9);
      }
   });

   it("fly off when the runner comes within SCARE_NEAR, land FLEE_DISTANCE out, come back once it is past SCARE_FAR", () => {
      let s = 0;
      for (let i = 0; i < 60; i++) s = stepScare(s, SCARE_NEAR - 0.1, 1 / 60);
      expect(s).toBe(1);
      for (let i = 0; i < 600; i++) s = stepScare(s, (SCARE_NEAR + SCARE_FAR) / 2, 1 / 60);
      expect(s).toBe(1);
      // comes back over more than a second, not in one frame
      for (let i = 0; i < 60; i++) s = stepScare(s, SCARE_FAR + 0.1, 1 / 60);
      expect(s).toBeGreaterThan(0);
      for (let i = 0; i < 600; i++) s = stepScare(s, SCARE_FAR + 0.1, 1 / 60);
      expect(s).toBe(0);
      // paused (dt 0): nothing moves
      expect(stepScare(0.4, 0, 0)).toBe(0.4);
      const home = PIGEON_HOMES[0];
      const pose = pigeonPose(home, 0, 1, true, createPigeonPose());
      expect(Math.hypot(pose.x - home.x, pose.z - home.z)).toBeCloseTo(FLEE_DISTANCE, 9);
      expect(pose.y).toBeLessThan(0.1);
      // can the runner reach a home at all? Each one is within SCARE_NEAR of a reachable park position
      const cache = cacheOf(0);
      for (const h of PIGEON_HOMES) {
         let nearest = Infinity;
         for (let c = 0; c < FLOOD_N * FLOOD_N; c++) {
            if (!cache.reachable[c]) continue;
            const x = (Math.floor(c / FLOOD_N) - (FLOOD_N - 1) / 2) * FLOOD_STEP;
            const z = ((c % FLOOD_N) - (FLOOD_N - 1) / 2) * FLOOD_STEP;
            nearest = Math.min(nearest, Math.hypot(x - h.x, z - h.z));
         }
         expect(nearest).toBeLessThan(SCARE_NEAR);
      }
   });

   it("the stand-in is built per mount at the drawn size and frees its geometry and material", () => {
      const live = new Set<BufferGeometry | Material>();
      for (let mount = 0; mount < 5; mount++) {
         const parts = createPigeonStandIn();
         for (const part of parts) {
            for (const item of [part.geometry, ...(Array.isArray(part.material) ? part.material : [part.material])]) {
               expect(live.has(item)).toBe(false);
               live.add(item);
               item.addEventListener("dispose", () => live.delete(item));
            }
            const box = new Box3();
            const p = new Vector3();
            const positions = part.geometry.getAttribute("position");
            for (const local of part.locals ?? []) {
               for (let i = 0; i < positions.count; i++) box.expandByPoint(p.fromBufferAttribute(positions, i).applyMatrix4(local));
            }
            expect(box.min.y).toBeGreaterThanOrEqual(0);
            expect(box.max.y).toBeLessThanOrEqual(PIGEON_HEIGHT + 0.01);
            expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThanOrEqual(PIGEON_RADIUS);
         }
         expect(live.size).toBe(2);
         disposePigeonStandIn(parts);
         expect(live.size).toBe(0);
      }
   });
});

describe("clean-city decor: assets", () => {
   it("every decor asset points at a GLB in the manifest and is a plain mesh; the cars stand on y = 0", () => {
      const decor: readonly ModelAsset[] = [ASSETS.car, ASSETS.taxi, ASSETS.van, ASSETS.pigeon];
      for (const asset of decor) {
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(asset.humanoid).toBeUndefined();
         expect(asset.rigged ?? false).toBe(false);
      }
      const spots: readonly InstanceSpot[][] = [[...CAR_SPOTS], [...TAXI_SPOTS], [...VAN_SPOTS]];
      for (const list of spots) for (const spot of list) expect(spot.y).toBe(0);
   });
});
