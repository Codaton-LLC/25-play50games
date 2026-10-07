// Clean the City decor (decorSpots.ts, Decor.tsx): pure decoration that never meets the game.
// Every footprint is measured on the mesh as it is drawn (the car GLBs with assets.ts scale /
// stretch / rotationY, then the spot; the pigeon's code-built parts in every pose its animation
// takes), and checked against the rules data: the floor, every obstacle square, every litter spawn
// spot and every reachable runner position of all three maps.
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Euler, Material, Matrix4, Quaternion, Vector3 } from "three";
import { aabbOverlap, distanceToBoxXZ, type AABB } from "@/arcade3d/core/collision";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { spotMatrix, type InstanceSpot } from "@/arcade3d/core/render";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import { createPigeonParts, disposePigeonParts } from "./Decor";
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
   PIGEON_REACH,
   SCARE_FAR,
   SCARE_NEAR,
   SURROUND_SPOTS,
   TAXI_SPOTS,
   VAN_SPOTS,
   createPigeonPose,
   pigeonPose,
   stepScare,
   yawFacing,
   type PigeonPose,
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
const square = (half: number): AABB => ({ min: { x: -half, y: -10, z: -half }, max: { x: half, y: 10, z: half } });

/** The floor content's square (runner body, litter glows), tall. */
const KEEP_OUT: AABB = square(DECOR_KEEP_OUT);

// Scene.tsx's pickup burst: ringGeometry(0.35, 0.5) at the runner's centre (|x|, |z| <= SPAWN_HALF),
// scaled 0.4 + 1.6 k and faded to opacity 0.85 (1 - k) over k = 0..1. Mirrored here (as LITTER_GLOW).
const BURST_OUTER = 0.5;
const burstReach = (k: number): number => SPAWN_HALF + BURST_OUTER * (0.4 + 1.6 * k);
const burstOpacity = (k: number): number => 0.85 * (1 - k);
/** Everything the burst can touch, at its widest: no car or pigeon footprint may reach in. */
const BURST_SQUARE: AABB = square(burstReach(1));
/** Scene.tsx's litter pop-in easing (the glow's scale), mirrored. */
const easeOutBack = (k: number): number => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;

/** The pigeon's vertices in its own frame (feet at the origin, head at -z), every piece as Decor.tsx draws it. */
function pigeonPoints(): Vector3[] {
   const parts = createPigeonParts();
   const points: Vector3[] = [];
   for (const part of parts) {
      const positions = part.geometry.getAttribute("position");
      for (const local of part.locals ?? [new Matrix4()]) {
         for (let i = 0; i < positions.count; i++) points.push(new Vector3().fromBufferAttribute(positions, i).applyMatrix4(local));
      }
   }
   disposePigeonParts(parts);
   return points;
}
const PIGEON_POINTS = pigeonPoints();
const PIGEON_BOX = new Box3().setFromPoints(PIGEON_POINTS);
const PIGEON_CORNERS: readonly Vector3[] = [0, 1, 2, 3, 4, 5, 6, 7].map(
   (i) => new Vector3(i & 1 ? PIGEON_BOX.max.x : PIGEON_BOX.min.x, i & 2 ? PIGEON_BOX.max.y : PIGEON_BOX.min.y, i & 4 ? PIGEON_BOX.max.z : PIGEON_BOX.min.z)
);

/** Where Decor.tsx's update places a pigeon in `pose` (position, then Euler(pitch, yaw, 0, "YXZ"), unit scale). */
function poseMatrix(pose: PigeonPose, x = pose.x, z = pose.z): Matrix4 {
   return new Matrix4().compose(new Vector3(x, pose.y, z), new Quaternion().setFromEuler(new Euler(pose.pitch, pose.yaw, 0, "YXZ")), new Vector3(1, 1, 1));
}

/** A box round the pigeon in `pose` that holds the whole mesh: its own box's 8 corners, placed. */
const pigeonBoxAt = (pose: PigeonPose): Box3 => {
   const m = poseMatrix(pose);
   return new Box3().setFromPoints(PIGEON_CORNERS.map((c) => c.clone().applyMatrix4(m)));
};

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
   it("holds everything the run collides with or spawns", () => {
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
      // a litter glow at the top of its pop-in overshoot still fits
      let overshoot = 0;
      for (let k = 0; k <= 1; k += 0.001) overshoot = Math.max(overshoot, easeOutBack(k));
      expect(overshoot).toBeGreaterThan(1.09);
      expect(SPAWN_HALF + LITTER_GLOW * overshoot).toBeLessThan(DECOR_KEEP_OUT);
   });

   it("the pickup burst is the one effect past it: faint there (it may slip under the city kerb), short of every car and pigeon", () => {
      expect(burstReach(1)).toBeCloseTo(14.5, 9);
      expect(burstReach(1)).toBeGreaterThan(DECOR_KEEP_OUT);
      // from the moment its edge passes the keep-out it is at most 0.21 opaque
      const k = (DECOR_KEEP_OUT - SPAWN_HALF) / BURST_OUTER / 1.6 - 0.4 / 1.6;
      expect(burstReach(k)).toBeCloseTo(DECOR_KEEP_OUT, 9);
      expect(burstOpacity(k)).toBeLessThanOrEqual(0.215);
      // it can reach the kerb (KERB.inner is inside its reach), but no further decor: the car and
      // pigeon tests check their footprints against BURST_SQUARE
      expect(KERB.inner).toBeLessThan(burstReach(1));
      expect(BURST_SQUARE.max.x).toBeCloseTo(14.5, 9);
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
            expect(aabbOverlap(toAabb(box), BURST_SQUARE), `${label} within the pickup burst's reach`).toBe(false);
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
   it("3-5 pigeons; every pose they take (pecking, hopping, flying off and back) keeps the whole bird outside the floor content", () => {
      expect(PIGEON_HOMES.length).toBeGreaterThanOrEqual(3);
      expect(PIGEON_HOMES.length).toBeLessThanOrEqual(5);
      const pose = createPigeonPose();
      const bad: string[] = [];
      let tipped = 0;
      for (const home of PIGEON_HOMES) {
         expect(Math.hypot(home.awayX, home.awayZ)).toBeCloseTo(1, 9);
         for (const scare of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
            for (const fleeing of [true, false]) {
               for (let t = 0; t < 3 * PIGEON_CYCLE; t += 0.02) {
                  pigeonPose(home, t, scare, fleeing, pose);
                  if (pose.pitch < -0.3) tipped += 1;
                  // the bird's own box turned and placed as Decor.tsx places it: holds every vertex
                  const box = toAabb(pigeonBoxAt(pose));
                  const where = `pigeon (${home.x}, ${home.z}) t ${t.toFixed(2)} scare ${scare}`;
                  if (aabbOverlap(box, KEEP_OUT)) bad.push(`${where}: in the floor content`);
                  if (aabbOverlap(box, BURST_SQUARE)) bad.push(`${where}: within the pickup burst's reach`);
                  if (box.max.z > FLOOR_HALF) bad.push(`${where}: beyond the near edge`);
                  if (pose.y < 0 || pose.y > FLEE_HEIGHT + 0.1) bad.push(`${where}: y ${pose.y}`);
               }
            }
         }
         // the home and the landing spot FLEE_DISTANCE out, with the footprint of any pose, clear of every rules position
         for (const out of [0, FLEE_DISTANCE]) {
            const x = home.x + home.awayX * out;
            const z = home.z + home.awayZ * out;
            const box = new Box3(new Vector3(x - PIGEON_REACH, 0, z - PIGEON_REACH), new Vector3(x + PIGEON_REACH, PIGEON_HEIGHT, z + PIGEON_REACH));
            expectClearOfRules(box, `pigeon at (${x}, ${z})`);
         }
      }
      expect(bad.slice(0, 5)).toEqual([]);
      // the sweep did see the deep pecks
      expect(tipped).toBeGreaterThan(0);
   });

   it("the footprint radii hold on the drawn bird: PIGEON_RADIUS standing level, PIGEON_REACH in every pose (a peck reaches further)", () => {
      const reachIn = (m: Matrix4): number => {
         let reach = 0;
         const p = new Vector3();
         for (const q of PIGEON_POINTS) {
            p.copy(q).applyMatrix4(m);
            reach = Math.max(reach, Math.hypot(p.x, p.z));
         }
         return reach;
      };
      const pose = createPigeonPose();
      const rest = reachIn(poseMatrix(pigeonPose(PIGEON_HOMES[0], 0.5 * PIGEON_CYCLE, 0, false, pose), 0, 0));
      expect(pose.pitch).toBe(0);
      expect(rest).toBeLessThanOrEqual(PIGEON_RADIUS);
      let any = 0;
      for (const home of PIGEON_HOMES) {
         for (let t = 0; t < 2 * PIGEON_CYCLE; t += 0.005) any = Math.max(any, reachIn(poseMatrix(pigeonPose(home, t, 0, false, pose), 0, 0)));
      }
      expect(any).toBeLessThanOrEqual(PIGEON_REACH);
      // the peck is what reaches further (measured 0.264 level, 0.363 pecking)
      expect(any).toBeGreaterThan(rest + 0.05);
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

   it("peck and hop in place: no jump in heading or position between frames, the head never dips through the ground", () => {
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
      // every peck on the drawn bird, placed as Decor.tsx places it: nothing below the ground
      let deepest = 0;
      let lowest = Infinity;
      const p = new Vector3();
      for (let t = 0; t < PIGEON_CYCLE; t += 0.01) {
         const pose = pigeonPose(PIGEON_HOMES[0], t, 0, false, a);
         if (pose.pitch === 0) continue;
         deepest = Math.min(deepest, pose.pitch);
         const place = poseMatrix(pose, 0, 0);
         for (const q of PIGEON_POINTS) lowest = Math.min(lowest, p.copy(q).applyMatrix4(place).y);
      }
      expect(deepest).toBeLessThan(-0.3);
      expect(lowest).toBeGreaterThan(-0.01);
   });

   it("is drawn in code, not a GLB: PIGEON_HEIGHT (0.48) tall, feet on y = 0, head at -z (facing away at yaw 0), 3,000 triangles for the flock in one draw call", () => {
      // pigeon-crossing's pigeon.glb (12,000 triangles) is never fetched by this game
      for (const asset of Object.values(ASSETS) as ModelAsset[]) expect(asset.url).not.toMatch(/pigeon\.glb$/);
      const size = PIGEON_BOX.getSize(new Vector3());
      expect(size.y).toBeCloseTo(PIGEON_HEIGHT, 3);
      expect(PIGEON_BOX.min.y).toBeCloseTo(0, 3);
      // about as long as tall, wider than nothing: reads as a bird side on and from above
      expect(size.z).toBeGreaterThan(0.4);
      expect(size.z).toBeLessThan(0.55);
      // the head (the top tenth) is at -z: yawFacing(0, -1) = 0 faces it away from the camera
      const top = PIGEON_POINTS.filter((p) => p.y > PIGEON_BOX.max.y - 0.1 * size.y);
      expect(top.reduce((sum, p) => sum + p.z, 0) / top.length).toBeLessThan(-0.05);
      expect(yawFacing(0, -1)).toBeCloseTo(0, 9);
      // flying out faces the away direction: the drawn forward (-z) turned by the yaw
      for (const home of PIGEON_HOMES) {
         const yaw = yawFacing(home.awayX, home.awayZ);
         const forward = new Vector3(0, 0, -1).applyAxisAngle(UP, yaw);
         expect(forward.x).toBeCloseTo(home.awayX, 9);
         expect(forward.z).toBeCloseTo(home.awayZ, 9);
      }
      // one part (one InstancedMesh, one draw call), its pieces all instances of it
      const parts = createPigeonParts();
      expect(parts).toHaveLength(1);
      let perBird = 0;
      for (const part of parts) {
         const index = part.geometry.getIndex();
         const triangles = (index ? index.count : part.geometry.getAttribute("position").count) / 3;
         perBird += triangles * Math.max(1, part.locals?.length ?? 0);
         expect(part.colors?.length).toBe(part.locals?.length);
      }
      disposePigeonParts(parts);
      expect(perBird).toBe(600);
      expect(perBird * PIGEON_HOMES.length).toBeLessThanOrEqual(3000);
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

   it("its geometry and material are built per mount and freed on dispose", () => {
      const live = new Set<BufferGeometry | Material>();
      for (let mount = 0; mount < 5; mount++) {
         const parts = createPigeonParts();
         for (const part of parts) {
            for (const item of [part.geometry, ...(Array.isArray(part.material) ? part.material : [part.material])]) {
               expect(live.has(item)).toBe(false);
               live.add(item);
               item.addEventListener("dispose", () => live.delete(item));
            }
         }
         expect(live.size).toBe(2);
         disposePigeonParts(parts);
         expect(live.size).toBe(0);
      }
   });
});

describe("clean-city decor: assets", () => {
   it("every decor asset points at a GLB in the manifest and is a plain mesh; the cars stand on y = 0", () => {
      const decor: readonly ModelAsset[] = [ASSETS.car, ASSETS.taxi, ASSETS.van];
      for (const asset of decor) {
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(asset.humanoid).toBeUndefined();
         expect(asset.rigged ?? false).toBe(false);
      }
      const spots: readonly InstanceSpot[][] = [[...CAR_SPOTS], [...TAXI_SPOTS], [...VAN_SPOTS]];
      for (const list of spots) for (const spot of list) expect(spot.y).toBe(0);
   });
});
