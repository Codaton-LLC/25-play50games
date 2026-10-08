// Clean the City obstacle props (group D GLBs: bench, bin, lamp, palm, umbrella), each one as it is
// drawn: the real mesh, assets.ts scale / stretch, propSpots.ts spot and turn (GLB_PROPS is what
// Primitives.tsx GlbProps renders, entry by entry), with the primitive bases under the palms and the
// umbrella poles (propSpots.ts BASE_SETS, also drawn entry by entry). Checked against the rules data
// (rules.ts MAPS squares, the litter spots, the runner) and against the fitted cameras' view of every
// litter piece. Collision never comes from a mesh: the squares are the truth.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Box3, CylinderGeometry, Matrix4, Quaternion, Ray, Vector3 } from "three";
import { distanceToBoxXZ } from "@/arcade3d/core/collision";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { spotMatrix, type InstanceSpot } from "@/arcade3d/core/render";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { fitView, followAim } from "@/arcade3d/core/view";
import { ASSETS, LITTER_DRAW } from "./assets";
import { FOCUS, FOV, LOOK_AT, VIEW, cameraFor, type CameraSetup } from "./camera";
import { BASE_SETS, GLB_PROPS, PROP_BASE, obstacleCentres, type BasePart, type GlbKind, type PropSet } from "./propSpots";
import { MAPS, RUNNER, buildMapCache, spotX, spotZ, type MapCache } from "./rules";

const UP = new Vector3(0, 1, 0);
const QUARTER = Math.PI / 2;
const GLB_KINDS: readonly GlbKind[] = ["bench", "bin", "lamp", "palm", "pole"];
/** The documented drawn sizes (assets.ts, README "Obstacle props"): width x height x depth at rotY 0. */
const DRAWN: Record<string, readonly [number, number, number]> = {
   bench: [2.4, 0.84, 0.8],
   bin: [1.4, 1.25, 1.4],
   lamp: [0.6, 2.0, 0.58],
   palm: [1.2, 1.7, 1.2],
   umbrella: [1.5, 1.6, 1.46],
};
/** The middle of a drawn litter piece (they are 0.78-0.90 tall): the point that must stay in view. */
const LITTER_MID = 0.4;
/**
 * At the runner's height (every vertex below its head, the bases included), the widest gap between a
 * copy and any edge of its square, measured on the real meshes plus about 0.01 (bench 0.0002, bin
 * 0.00003, lamp 0.046, palm 0, pole 0). Below the head the palm trunk (about 0.3 across, off the crown's
 * centre) and the umbrella pole (0.07) alone left 0.570 and 0.231 (the runner stopped that far short
 * of them); their bases now meet every edge of the square, as the bench, the bin and the lamp's base do.
 */
const BODY_GAP: Record<GlbKind, number> = { bench: 0.01, bin: 0.01, lamp: 0.05, palm: 0.01, pole: 0.01 };
/** The palm's widest body-height gap (0.57 without its planter, the GLB's -z side) never faces the camera (+z) or the floor's middle. */
const PALM_SHOWN_GAP = 0.45;
/** How much of its square a base covers at the ground, at least (the octagonal planter 83 %, the round stand 78 %). */
const BASE_COVER: Partial<Record<GlbKind, number>> = { palm: 0.8, pole: 0.75 };

interface Mesh {
   cloud: Float32Array;
   indices: Uint32Array;
}
const meshes = new Map<string, Promise<Mesh>>();
const meshOf = (url: string): Promise<Mesh> => {
   if (!meshes.has(url)) meshes.set(url, readCharacterGlb(url));
   return meshes.get(url)!;
};

/** The GLB's local transform as <InstancedModel> draws it (modelParts: yOffset, rotationY, scale x stretch). */
function assetMatrix(asset: ModelAsset): Matrix4 {
   const s = asset.scale ?? 1;
   const k = asset.stretch ?? [1, 1, 1];
   return new Matrix4().compose(
      new Vector3(0, asset.yOffset ?? 0, 0),
      new Quaternion().setFromAxisAngle(UP, asset.rotationY ?? 0),
      new Vector3(s * k[0], s * k[1], s * k[2])
   );
}

/** Every vertex of `asset` drawn at `spot` (world space). */
async function drawnPoints(asset: ModelAsset, spot: InstanceSpot): Promise<Vector3[]> {
   const { cloud } = await meshOf(asset.url);
   const m = spotMatrix(spot).multiply(assetMatrix(asset));
   const points: Vector3[] = [];
   for (let i = 0; i < cloud.length; i += 3) points.push(new Vector3(cloud[i], cloud[i + 1], cloud[i + 2]).applyMatrix4(m));
   return points;
}

/** The obstacle of `set` under `spot` (same centre): its square. */
function obstacleAt(set: PropSet, spot: InstanceSpot) {
   const o = MAPS[set.map].obstacles.find((q) => q.kind === set.kind && q.x === spot.x && q.z === spot.z);
   expect(o, `${set.kind} at (${spot.x}, ${spot.z})`).toBeDefined();
   return o!;
}

/** Every copy every GLB_PROPS entry draws, with its index in the entry and its obstacle. */
const copies = () => GLB_PROPS.flatMap((set) => set.spots.map((spot, index) => ({ set, spot, index, o: obstacleAt(set, spot) })));

const partGeometries = new Map<BasePart, CylinderGeometry>();
/** A base part's geometry, as Primitives.tsx builds it (three's cylinderGeometry, centred on its spot). */
const partGeometry = (part: BasePart): CylinderGeometry => {
   if (!partGeometries.has(part)) partGeometries.set(part, new CylinderGeometry(part.radiusTop, part.radiusBottom, part.height, part.sides));
   return partGeometries.get(part)!;
};

/** The base parts drawn under copy `index` of `set` (BASE_SETS, the entries Primitives.tsx draws), with their world matrices. */
const basesOf = (set: PropSet, index: number) =>
   BASE_SETS.filter((b) => b.map === set.map && b.kind === set.kind).map((b) => ({ part: b.part, spot: b.spots[index], matrix: spotMatrix(b.spots[index]) }));

/** Every vertex of the bases under copy `index` of `set` (world space). */
function basePoints(set: PropSet, index: number): Vector3[] {
   const points: Vector3[] = [];
   for (const { part, matrix } of basesOf(set, index)) {
      const pos = partGeometry(part).getAttribute("position");
      for (let i = 0; i < pos.count; i++) points.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(matrix));
   }
   return points;
}

/** The bases' triangles under copy `index` of `set` (world space, three per triangle). */
function baseTriangles(set: PropSet, index: number): Vector3[] {
   const tri: Vector3[] = [];
   for (const { part, matrix } of basesOf(set, index)) {
      const geometry = partGeometry(part);
      const pos = geometry.getAttribute("position");
      const idx = geometry.getIndex()!;
      for (let i = 0; i < idx.count; i++) tri.push(new Vector3().fromBufferAttribute(pos, idx.getX(i)).applyMatrix4(matrix));
   }
   return tri;
}

/** Is (x, z) inside the footprint of base part `part` drawn at `spot` (the regular polygon of its wider end)? */
function inPart(part: BasePart, spot: InstanceSpot, x: number, z: number): boolean {
   const r = Math.max(part.radiusBottom, part.radiusTop);
   // three's cylinder puts its corners at angles 2πk / sides from +z, turned by the spot's rotY
   const angle = Math.atan2(x - spot.x, z - spot.z) - (spot.rotY ?? 0);
   const sector = (2 * Math.PI) / part.sides;
   const within = ((angle % sector) + sector) % sector;
   // the polygon's edge at that angle: apothem / cos(angle from the edge's middle)
   const edge = (r * Math.cos(sector / 2)) / Math.cos(within - sector / 2);
   return Math.hypot(x - spot.x, z - spot.z) <= edge + 1e-9;
}

const caches: MapCache[] = [];
const cacheOf = (map: number): MapCache => (caches[map] ??= buildMapCache(map));

/** The runner as Scene draws it (the cleaner): its GLB's top times assets.ts scale (0.95). */
async function runnerHeight(): Promise<number> {
   const { cloud } = await readCharacterGlb(ASSETS.cleaner.url);
   let top = 0;
   for (let i = 1; i < cloud.length; i += 3) top = Math.max(top, cloud[i]);
   return top * (ASSETS.cleaner.scale ?? 1);
}

describe("clean-city obstacle props: the GLBs", () => {
   it("every bench, bin, lamp, palm and umbrella pole of the three maps is drawn by exactly one GLB copy, on its square's centre", () => {
      for (let map = 0; map < MAPS.length; map++) {
         for (const kind of GLB_KINDS) {
            const want = obstacleCentres(map, kind).map((s) => `${s.x},${s.z}`).sort();
            const drawn = GLB_PROPS.filter((set) => set.map === map && set.kind === kind).flatMap((set) => set.spots.map((s) => `${s.x},${s.z}`)).sort();
            expect(drawn, `map ${map} ${kind}`).toEqual(want);
         }
      }
      for (const { spot } of copies()) expect(spot.y).toBe(0);
   });

   it("are listed in the manifest (trees and buildings are not: they stay primitives), plain meshes, one mesh of one primitive each (one draw call per map)", () => {
      for (const asset of [ASSETS.bench, ASSETS.bin, ASSETS.lamp, ASSETS.palm, ASSETS.umbrella]) {
         expect(asset.url).toBe(`/models/3d/clean-city/${asset.id}.glb`);
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(asset.humanoid).toBeUndefined();
         expect(asset.rigged ?? false).toBe(false);
         const glb = readFileSync(path.join(process.cwd(), "public", asset.url));
         const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8")) as {
            meshes: Array<{ primitives: unknown[] }>;
            nodes: Array<{ rotation?: number[]; scale?: number[]; matrix?: number[] }>;
         };
         expect(json.meshes.length, asset.id).toBe(1);
         expect(json.meshes[0].primitives.length, asset.id).toBe(1);
         // readCharacterGlb (this file's point cloud) applies a node's translation only, <InstancedModel>
         // its whole matrix: with no rotation or scale on any node, the cloud is what is drawn
         for (const node of json.nodes) {
            expect(node.rotation, `${asset.id} node rotation`).toBeUndefined();
            expect(node.scale, `${asset.id} node scale`).toBeUndefined();
            expect(node.matrix, `${asset.id} node matrix`).toBeUndefined();
         }
      }
      for (const asset of [ASSETS.tree, ASSETS.building]) expect(hasModel(asset.url), asset.url).toBe(false);
      for (const set of GLB_PROPS) expect(set.asset).toBe(set.kind === "pole" ? ASSETS.umbrella : ASSETS[set.kind as "bench" | "bin" | "lamp" | "palm"]);
   });

   it("are drawn at the documented sizes, feet on y = 0, never taller than the camera fit allows for", async () => {
      for (const [id, [w, h, d]] of Object.entries(DRAWN)) {
         const asset = ASSETS[id as keyof typeof ASSETS];
         const box = new Box3().setFromPoints(await drawnPoints(asset, { x: 0, y: 0, z: 0 }));
         const size = box.getSize(new Vector3());
         expect(size.x, `${id} width`).toBeCloseTo(w, 2);
         expect(size.y, `${id} height`).toBeCloseTo(h, 2);
         expect(size.z, `${id} depth`).toBeCloseTo(d, 2);
         expect(box.min.y, id).toBeCloseTo(0, 3);
         expect(box.max.y, `${id}: VIEW.area keeps props up to ${VIEW.area.max.y} in frame`).toBeLessThanOrEqual(VIEW.area.max.y);
      }
   });

   it("are turned by quarter turns only, and never a half turn for the palms and umbrella poles", () => {
      for (const { set, spot } of copies()) {
         const rotY = spot.rotY ?? 0;
         const label = `${set.asset.id} at (${spot.x}, ${spot.z}) rotY ${rotY}`;
         expect(Math.abs(rotY / QUARTER - Math.round(rotY / QUARTER)), label).toBeLessThan(1e-9);
         // a half turn shows the umbrella canopy's underside and the palm's widest gap to the camera
         if (set.kind === "pole" || set.kind === "palm") expect(Math.cos(rotY), label).toBeGreaterThan(-1 + 1e-6);
      }
   });
});

describe("clean-city obstacle props: the squares the runner collides with", () => {
   it("each copy (its base included) stays inside its square and spans it (the umbrella canopy: past it only above the runner's head, only where its centre cannot go)", async () => {
      const head = await runnerHeight();
      expect(head).toBeGreaterThan(0.9);
      for (const { set, spot, index, o } of copies()) {
         const label = `${set.asset.id} at (${o.x}, ${o.z})`;
         const points = [...(await drawnPoints(set.asset, spot)), ...basePoints(set, index)];
         const box = new Box3().setFromPoints(points);
         const outside = points.filter((p) => Math.abs(p.x - o.x) > o.halfX + 1e-3 || Math.abs(p.z - o.z) > o.halfZ + 1e-3);
         if (set.kind !== "pole") {
            expect(outside.length, `${label}: points outside the square`).toBe(0);
            // seen from the camera the prop marks its square: the bench and the bin span it at every
            // height, the lamp with its base (below 0.2) and its globe, the palm with its planter
            // (below 0.25) and its crown (above the runner's head). Between, the lamp post and the
            // palm trunk are narrower (next tests): the runner stops at a drawn part, never inside one.
            expect(box.max.x - box.min.x, `${label} x`).toBeGreaterThan(0.95 * 2 * o.halfX);
            expect(box.max.z - box.min.z, `${label} z`).toBeGreaterThan(0.95 * 2 * o.halfZ);
         } else {
            // the pole stands in its square; the canopy overhangs only above the runner's head, out to
            // where the runner's centre stops along an axis (half + RUNNER.radius), and fills that reach
            expect(outside.length, `${label}: a canopy overhangs the pole square`).toBeGreaterThan(0);
            for (const p of outside) {
               expect(p.y, `${label}: overhang below the runner's head`).toBeGreaterThanOrEqual(head);
               expect(Math.abs(p.x - o.x), label).toBeLessThanOrEqual(o.halfX + RUNNER.radius + 1e-3);
               expect(Math.abs(p.z - o.z), label).toBeLessThanOrEqual(o.halfZ + RUNNER.radius + 1e-3);
            }
            expect(Math.max(box.max.x - o.x, o.x - box.min.x, box.max.z - o.z, o.z - box.min.z), label).toBeGreaterThan(0.95 * (o.halfX + RUNNER.radius));
         }
         expect(box.min.y, label).toBeCloseTo(0, 3);
      }
   });

   it("at the runner's height, each copy (its base included) reaches every edge of its square within BODY_GAP: the runner, pushed into it, stops at a drawn part", async () => {
      const head = await runnerHeight();
      for (const { set, spot, index, o } of copies()) {
         const label = `${set.asset.id} at (${o.x}, ${o.z}) rotY ${spot.rotY ?? 0}`;
         let minX = Infinity;
         let maxX = -Infinity;
         let minZ = Infinity;
         let maxZ = -Infinity;
         for (const p of [...(await drawnPoints(set.asset, spot)), ...basePoints(set, index)]) {
            if (p.y >= head) continue;
            minX = Math.min(minX, p.x - o.x);
            maxX = Math.max(maxX, p.x - o.x);
            minZ = Math.min(minZ, p.z - o.z);
            maxZ = Math.max(maxZ, p.z - o.z);
         }
         const gap = { "+x": o.halfX - maxX, "-x": o.halfX + minX, "+z": o.halfZ - maxZ, "-z": o.halfZ + minZ };
         for (const [side, g] of Object.entries(gap)) expect(g, `${label}: ${side} gap`).toBeLessThanOrEqual(BODY_GAP[set.kind]);
         if (set.kind === "palm") {
            expect(gap["+z"], `${label}: the gap facing the camera`).toBeLessThanOrEqual(PALM_SHOWN_GAP);
            expect(o.x > 0 ? gap["-x"] : gap["+x"], `${label}: the gap facing the floor's middle`).toBeLessThanOrEqual(PALM_SHOWN_GAP);
         }
      }
   });

   it("the palms stand in an octagonal planter, the umbrella poles in a round stand with a sleeve: on y = 0, inside the square, low (under the crown and the canopy), one <Instanced> per part on every copy", async () => {
      expect(Object.keys(PROP_BASE).sort()).toEqual(["palm", "pole"]);
      expect(PROP_BASE.palm!.map((p) => p.sides)).toEqual([8, 8]);
      // the umbrella's sleeve thickens the pole (0.07 in the GLB) to over 0.12 across, up to 0.6 or more
      const sleeve = PROP_BASE.pole!.find((p) => p.y > 0);
      expect(sleeve).toBeDefined();
      expect(2 * Math.min(sleeve!.radiusTop, sleeve!.radiusBottom) * Math.cos(Math.PI / sleeve!.sides)).toBeGreaterThan(0.12);
      expect(sleeve!.y + sleeve!.height).toBeGreaterThanOrEqual(0.6);
      for (const set of GLB_PROPS) {
         const parts = PROP_BASE[set.kind] ?? [];
         const sets = BASE_SETS.filter((b) => b.map === set.map && b.kind === set.kind);
         expect(sets.map((b) => b.part), `${set.kind} on map ${set.map}`).toEqual(parts);
         for (const b of sets) {
            expect(b.spots.length).toBe(set.spots.length);
            b.spots.forEach((s, i) => {
               expect([s.x, s.z]).toEqual([set.spots[i].x, set.spots[i].z]);
               // centred (cylinderGeometry), the part's own turn on top of the copy's
               expect(s.y).toBeCloseTo(b.part.y + b.part.height / 2, 12);
               expect(s.rotY).toBeCloseTo((set.spots[i].rotY ?? 0) + b.part.turn, 12);
            });
         }
         if (!parts.length) continue;
         // the lowest part stands on the floor; every part ends under the crown / canopy (from 0.9 up)
         expect(Math.min(...parts.map((p) => p.y))).toBe(0);
         for (const p of parts) expect(p.y + p.height, set.kind).toBeLessThanOrEqual(0.7);
         for (const { spot, index, o } of copies().filter((c) => c.set === set)) {
            const box = new Box3().setFromPoints(basePoints(set, index));
            expect(box.min.y, `${set.kind} at (${o.x}, ${o.z})`).toBeCloseTo(0, 6);
            // the wider end spans the square along both axes
            expect(box.max.x - box.min.x, `${set.kind} at (${o.x}, ${o.z}) x`).toBeGreaterThan(2 * o.halfX - 0.01);
            expect(box.max.z - box.min.z, `${set.kind} at (${o.x}, ${o.z}) z`).toBeGreaterThan(2 * o.halfZ - 0.01);
            expect(spot.y).toBe(0);
         }
      }
   });

   it("at the runner's height, the palm's and the pole's drawn footprint covers most of the square (with the trunk 84 %, the stand 78 %; the trunk and the pole alone 5 % and 2 %)", async () => {
      const head = await runnerHeight();
      const N = 61;
      for (const { set, spot, index, o } of copies()) {
         const want = BASE_COVER[set.kind];
         if (want === undefined) continue;
         // the GLB's triangles below the runner's head, seen from above
         const { indices } = await meshOf(set.asset.url);
         const points = await drawnPoints(set.asset, spot);
         const tris: number[][] = [];
         for (let t = 0; t < indices.length; t += 3) {
            const [a, b, c] = [points[indices[t]], points[indices[t + 1]], points[indices[t + 2]]];
            if (a.y < head && b.y < head && c.y < head) tris.push([a.x, a.z, b.x, b.z, c.x, c.z]);
         }
         const inTri = (x: number, z: number, [ax, az, bx, bz, cx, cz]: number[]) => {
            const d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz);
            const d2 = (x - cx) * (bz - cz) - (bx - cx) * (z - cz);
            const d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az);
            return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
         };
         const bases = basesOf(set, index);
         let covered = 0;
         let glbOnly = 0;
         for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
               const x = o.x - o.halfX + ((i + 0.5) / N) * 2 * o.halfX;
               const z = o.z - o.halfZ + ((j + 0.5) / N) * 2 * o.halfZ;
               const glb = tris.some((t) => inTri(x, z, t));
               if (glb) glbOnly++;
               if (glb || bases.some((b) => inPart(b.part, b.spot, x, z))) covered++;
            }
         }
         const label = `${set.kind} at (${o.x}, ${o.z})`;
         expect(covered / (N * N), label).toBeGreaterThan(want);
         // the reason for the base: the trunk / the pole alone cover little of it
         expect(glbOnly / (N * N), label).toBeLessThan(0.1);
      }
   });

   it("no copy reaches within half a drawn litter piece of a litter spot on its map (seen from above)", async () => {
      const reach = LITTER_DRAW / 2;
      for (const { set, spot, index, o } of copies()) {
         const points = [...(await drawnPoints(set.asset, spot)), ...basePoints(set, index)];
         const box = new Box3().setFromPoints(points);
         const aabb = { min: { x: box.min.x, y: box.min.y, z: box.min.z }, max: { x: box.max.x, y: box.max.y, z: box.max.z } };
         let nearest = Infinity;
         for (const s of cacheOf(set.map).spots) {
            const x = spotX(s);
            const z = spotZ(s);
            // the box is a lower bound; only spots near it need the mesh (the round canopy is smaller than its box)
            if (distanceToBoxXZ(x, z, aabb) > reach) continue;
            for (const p of points) nearest = Math.min(nearest, Math.hypot(p.x - x, p.z - z));
         }
         expect(nearest, `${set.asset.id} at (${o.x}, ${o.z})`).toBeGreaterThan(reach);
      }
   });
});

describe("clean-city obstacle props: litter stays in view", () => {
   it("from every fitted camera and follow position, no prop covers the middle of any litter piece", async () => {
      // The closest fits (no HUD or banner rects: those only push the camera back) at desktop, wide,
      // phone and landscape sizes, plus a far camera (rays near 56° everywhere, as a phone with the
      // banner open). Each looks from a 3 x 3 grid over the follow range (camera.ts FOCUS).
      const distances = new Set<number>();
      for (const [width, height] of [[1280, 800], [1920, 1080], [390, 844], [375, 812], [844, 390], [768, 1024]]) {
         distances.add(+fitView({ ...VIEW, width, height, fov: FOV }).distance.toFixed(3));
      }
      distances.add(400);
      const xs = FOCUS.map((f) => f.x);
      const zs = FOCUS.map((f) => f.z);
      const aims: Vector3[] = [];
      for (const ax of [Math.min(...xs), 0, Math.max(...xs)]) for (const az of [Math.min(...zs), 0, Math.max(...zs)]) aims.push(new Vector3(ax, 0, az));
      const cameras: Vector3[] = [];
      for (const d of distances) for (const aim of aims) cameras.push(new Vector3(aim.x, aim.y + Math.sin(VIEW.pitch) * d, aim.z + Math.cos(VIEW.pitch) * d));
      expect(cameras.length).toBeGreaterThanOrEqual(5 * 9);

      // A litter piece more than NEAR (horizontally) from a prop's box is never behind it: the shallowest
      // ray (to a far floor corner) still climbs above the tallest prop within that distance.
      const NEAR = 3;
      let tallest = 0;
      for (const set of GLB_PROPS) tallest = Math.max(tallest, new Box3().setFromPoints(await drawnPoints(set.asset, set.spots[0])).max.y);
      let slope = Infinity;
      for (const c of cameras) {
         for (const [x, z] of [[-13.5, -13.5], [13.5, -13.5], [-13.5, 13.5], [13.5, 13.5]]) slope = Math.min(slope, c.y / Math.hypot(c.x - x, c.z - z));
      }
      expect(LITTER_MID + NEAR * slope).toBeGreaterThan(tallest);

      const ray = new Ray();
      const hit = new Vector3();
      const target = new Vector3();
      let rays = 0;
      for (let map = 0; map < MAPS.length; map++) {
         // every GLB copy on this map, as world triangles with a box to skip by
         const solids: { label: string; tri: Vector3[]; box: Box3 }[] = [];
         for (const set of GLB_PROPS.filter((s) => s.map === map)) {
            const { indices } = await meshOf(set.asset.url);
            for (let index = 0; index < set.spots.length; index++) {
               const spot = set.spots[index];
               const points = await drawnPoints(set.asset, spot);
               // the GLB and its base (the palm planters, the umbrella stands)
               const tri = [...Array.from(indices, (i) => points[i]), ...baseTriangles(set, index)];
               solids.push({ label: `${set.asset.id} at (${spot.x}, ${spot.z})`, tri, box: new Box3().setFromPoints(tri) });
            }
         }
         const blocked: string[] = [];
         for (const s of cacheOf(map).spots) {
            const lx = spotX(s);
            const lz = spotZ(s);
            target.set(lx, LITTER_MID, lz);
            for (const solid of solids) {
               if (Math.max(solid.box.min.x - lx, lx - solid.box.max.x, solid.box.min.z - lz, lz - solid.box.max.z) > NEAR) continue;
               for (const c of cameras) {
                  rays++;
                  const length = c.distanceTo(target);
                  ray.origin.copy(c);
                  ray.direction.copy(target).sub(c).normalize();
                  if (!ray.intersectBox(solid.box, hit)) continue;
                  for (let t = 0; t < solid.tri.length; t += 3) {
                     if (ray.intersectTriangle(solid.tri[t], solid.tri[t + 1], solid.tri[t + 2], false, hit) && hit.distanceTo(c) < length) {
                        blocked.push(`map ${map}: litter (${lx}, ${lz}) behind ${solid.label}`);
                        break;
                     }
                  }
               }
            }
         }
         expect(blocked.slice(0, 5), `${blocked.length} blocked rays`).toEqual([]);
      }
      expect(rays).toBeGreaterThan(10_000);
   });

   it("from the phone cameras, no prop covers a litter piece the cleaner stands near", async () => {
      // camera.ts cameraFor on phones: a window around the cleaner, closer than the whole-floor fits,
      // so its rays to the screen's top are shallower. The closest fits (no HUD or banner rects)
      // in portrait and landscape; the cleaner within PHONE_NEAR of the piece (a 3 x 3 grid), the
      // aim clamped to the window's bounds as CameraRig does (followFraction 1).
      const PHONE_NEAR = 2;
      const views: { setup: CameraSetup; distance: number }[] = [];
      for (const [width, height] of [[360, 740], [375, 812], [390, 844], [740, 360], [812, 375], [844, 390]]) {
         const setup = cameraFor(width, height);
         expect(setup.kind).toBe("phone");
         views.push({ setup, distance: fitView({ ...setup.view, width, height, fov: FOV }).distance });
      }
      const ray = new Ray();
      const hit = new Vector3();
      const target = new Vector3();
      const cam = new Vector3();
      const aim = { x: 0, y: 0, z: 0 };
      let rays = 0;
      let middles = 0;
      const middleBy = new Map<string, number>();
      for (let map = 0; map < MAPS.length; map++) {
         const solids: { label: string; tri: Vector3[]; box: Box3 }[] = [];
         for (const set of GLB_PROPS.filter((s) => s.map === map)) {
            const { indices } = await meshOf(set.asset.url);
            for (let index = 0; index < set.spots.length; index++) {
               const spot = set.spots[index];
               const points = await drawnPoints(set.asset, spot);
               const tri = [...Array.from(indices, (i) => points[i]), ...baseTriangles(set, index)];
               solids.push({ label: `${set.asset.id} at (${spot.x}, ${spot.z})`, tri, box: new Box3().setFromPoints(tri) });
            }
         }
         /** Is the segment from `cam` to `target` blocked by a near solid? Names it, or null. */
         const blocker = (near: typeof solids): string | null => {
            const length = cam.distanceTo(target);
            ray.origin.copy(cam);
            ray.direction.copy(target).sub(cam).normalize();
            for (const solid of near) {
               if (!ray.intersectBox(solid.box, hit)) continue;
               for (let t = 0; t < solid.tri.length; t += 3) {
                  if (ray.intersectTriangle(solid.tri[t], solid.tri[t + 1], solid.tri[t + 2], false, hit) && hit.distanceTo(cam) < length) return solid.label;
               }
            }
            return null;
         };
         // the piece's middle and four points of its ground ring (radius 0.42-0.62): hidden only if all five are
         const MARKS: [number, number, number][] = [[0, LITTER_MID, 0], [0.55, 0.04, 0], [-0.55, 0.04, 0], [0, 0.04, 0.55], [0, 0.04, -0.55]];
         const hidden: string[] = [];
         for (const s of cacheOf(map).spots) {
            const lx = spotX(s);
            const lz = spotZ(s);
            const near = solids.filter((solid) => Math.max(solid.box.min.x - lx, lx - solid.box.max.x, solid.box.min.z - lz, lz - solid.box.max.z) <= 3);
            if (near.length === 0) continue;
            for (const { setup, distance } of views) {
               for (const dx of [-PHONE_NEAR, 0, PHONE_NEAR]) {
                  for (const dz of [-PHONE_NEAR, 0, PHONE_NEAR]) {
                     followAim({ x: lx + dx, y: 0, z: lz + dz }, LOOK_AT, setup.followFraction, setup.bounds, aim);
                     cam.set(aim.x, Math.sin(setup.view.pitch) * distance, aim.z + Math.cos(setup.view.pitch) * distance);
                     let by: string | null = null;
                     let seen = false;
                     for (const [mx, my, mz] of MARKS) {
                        target.set(lx + mx, my, lz + mz);
                        rays++;
                        const b = blocker(near);
                        if (b === null) {
                           seen = true;
                           break;
                        }
                        by ??= b;
                        if (mx === 0 && mz === 0) {
                           middles++;
                           middleBy.set(b.split(" ")[0], (middleBy.get(b.split(" ")[0]) ?? 0) + 1);
                        }
                     }
                     if (!seen) hidden.push(`map ${map}: litter (${lx}, ${lz}) behind ${by}, cleaner at (${lx + dx}, ${lz + dz})`);
                  }
               }
            }
         }
         expect(hidden.slice(0, 5), `${hidden.length} hidden pieces`).toEqual([]);
      }
      expect(rays).toBeGreaterThan(10_000);
      // the middle alone may be crossed by a thin lamp post or an umbrella canopy's rim (36 and 33 of about
      // 150,000 views), never the whole piece: its ring shows past them
      expect(middles).toBeLessThan(100);
      expect([...middleBy.keys()].sort()).toEqual(["lamp", "umbrella"]);
   });
});
