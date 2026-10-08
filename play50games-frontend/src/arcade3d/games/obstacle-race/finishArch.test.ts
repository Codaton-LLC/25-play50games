// The finish arch GLB (group D v2) as the Scene draws it: assets.ts scale x stretch on the real,
// meshopt-decoded mesh, no turn, no offset (core <Model>). Collision is the rules' two post circles
// (ARCH), never the mesh, so the drawn legs must stand on them and nothing else may hang in the
// runner's way. README "Assets".
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BackSide, Box3, DoubleSide, FrontSide, MeshStandardMaterial, Vector3, type Material } from "three";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ARCH_GLB, ASSETS } from "./assets";
import { LANDSCAPE, PORTRAIT } from "./camera";
import { fadeCopy } from "./finishLooks";
import { ARCH, RUNNER } from "./rules";

const asset: ModelAsset = ASSETS.finishArch;

/** Every vertex as drawn (metres, the arch's own frame: the finish line at z 0, the runner coming from +z). */
async function drawnPoints(): Promise<Vector3[]> {
   const { cloud } = await readCharacterGlb(asset.url);
   const s = asset.scale ?? 1;
   const k = asset.stretch ?? [1, 1, 1];
   const points: Vector3[] = [];
   for (let i = 0; i < cloud.length; i += 3) points.push(new Vector3(cloud[i] * s * k[0], cloud[i + 1] * s * k[1], cloud[i + 2] * s * k[2]));
   return points;
}

const boxOf = (points: Vector3[]) => new Box3().setFromPoints(points);
/** The legs' straight part: below the banner and the bend (the red legs reach 1.9 m). */
const LEG_TOP = 1.5;
/** How far a leg may stand out round its post: a runner stopped by a post touches the leg it sees. */
const SLEEVE = 0.16;

describe("obstacle-race finish arch GLB", () => {
   it("is listed, within the prop budget, and drawn by scale and stretch alone (no turn, no offset)", async () => {
      expect(hasModel(asset.url)).toBe(true);
      expect(asset.rotationY ?? 0).toBe(0);
      expect(asset.yOffset ?? 0).toBe(0);
      expect(asset.budget).toEqual(PROP_BUDGET);
      const { indices } = await readCharacterGlb(asset.url);
      expect(indices.length / 3).toBeLessThanOrEqual(asset.budget.tris);
      expect(statSync(path.join(process.cwd(), "public", asset.url)).size).toBeLessThanOrEqual(asset.budget.bytes);
      // x and z alike (round legs), y stretched a little to reach ARCH.height
      const k = asset.stretch ?? [1, 1, 1];
      expect(k[0]).toBe(1);
      expect(k[2]).toBe(1);
      expect(k[1]).toBeGreaterThan(1);
      expect(k[1]).toBeLessThan(1.15);
   });

   it("stands on the pad, centred on the finish line, as tall as ARCH (4.2 m)", async () => {
      const box = boxOf(await drawnPoints());
      expect(box.min.y).toBeGreaterThanOrEqual(-1e-3);
      expect(box.min.y).toBeLessThan(0.01);
      expect(Math.abs(box.max.y - ARCH.height)).toBeLessThan(0.01);
      expect(Math.abs(box.min.x + box.max.x)).toBeLessThan(0.02);
      expect(Math.abs(box.min.z + box.max.z)).toBeLessThan(0.01);
      // the measured GLB numbers assets.ts derives the fit from
      expect(Math.abs(box.max.y / ((asset.scale ?? 1) * (asset.stretch?.[1] ?? 1)) - ARCH_GLB.top)).toBeLessThan(1e-3);
   });

   it("puts each leg on its post: centred on x ±ARCH.postX, covering the post circle, at most a 0.16 m sleeve round it", async () => {
      const low = (await drawnPoints()).filter((p) => p.y < LEG_TOP);
      for (const side of [-1, 1]) {
         const leg = boxOf(low.filter((p) => p.x * side > 0));
         const centre = leg.getCenter(new Vector3());
         expect(Math.abs(centre.x - side * ARCH.postX), `leg ${side} x`).toBeLessThan(0.01);
         expect(Math.abs(centre.z), `leg ${side} z`).toBeLessThan(0.01);
         const half = leg.getSize(new Vector3()).multiplyScalar(0.5);
         for (const axis of ["x", "z"] as const) {
            // the post is inside the leg (no invisible wall) and the leg no fatter than the sleeve
            expect(half[axis], `leg ${side} ${axis}`).toBeGreaterThanOrEqual(ARCH.postRadius);
            expect(half[axis] - ARCH.postRadius, `leg ${side} ${axis}`).toBeLessThanOrEqual(SLEEVE);
         }
      }
   });

   it("keeps the runway clear: nothing low between the legs, the banner over a walked finish and its cheer", async () => {
      const points = await drawnPoints();
      // below the legs' tops every vertex belongs to a leg
      const inner = ARCH.postX - ARCH.postRadius - SLEEVE;
      for (const p of points) if (p.y < LEG_TOP) expect(Math.abs(p.x)).toBeGreaterThanOrEqual(inner);
      // up to the widest a runner's centre gets at the line (pushed off a post: 2.85 m), the lowest
      // point (the banner's lower edge, 2.16 m) is over the 1.5 m runner walking over the line and
      // hopping 0.32 m with its hands up in its cheer (Scene.tsx). Not over a jump across the line
      // (apex 1.445 m, the head up to about 2.95 m): it passes through the banner, which has no
      // collision, for a few frames (README "Known issues")
      const lane = ARCH.postX - ARCH.postRadius - RUNNER.radius;
      const lowest = Math.min(...points.filter((p) => Math.abs(p.x) <= lane).map((p) => p.y));
      expect(lowest).toBeGreaterThan(RUNNER.height + 0.6);
   });

   it("shows the checkered banner's front to the runner and the follow camera (+z, camera yaw 0)", async () => {
      // the camera never turns (yaw 0, behind the runner, looking towards -z down the course)
      expect(PORTRAIT.yaws).toEqual([0]);
      expect(LANDSCAPE.yaws).toEqual([0]);
      // the banner between the legs, under the top tube: a flat slab across x, thin in z, so its faces
      // look along ±z, and with no turn its front (the GLB's +z) faces the runner coming from +z
      const banner = boxOf((await drawnPoints()).filter((p) => Math.abs(p.x) < 2 && p.y > 2.2 && p.y < 2.8));
      expect(banner.isEmpty()).toBe(false);
      expect(banner.max.x - banner.min.x).toBeGreaterThan(3.9);
      expect(banner.max.z - banner.min.z).toBeLessThan(0.35);
      expect(Math.abs(banner.min.z + banner.max.z)).toBeLessThan(0.05);
   });
});

/** three.js WebGLRenderer renderObject: a transparent double-sided material is drawn in two passes a frame. */
const twoPass = (m: Material) => m.transparent && m.side === DoubleSide && !m.forceSinglePass;

describe("obstacle-race finish arch: the fade copies draw in one pass", () => {
   it("the GLB is a closed solid wound outward, so drawn front-sided it shows what double-sided showed", async () => {
      const { cloud, indices } = await readCharacterGlb(asset.url);
      // vertices welded by position (UV seams split them)
      const weld = new Map<string, number>();
      const id = (i: number) => {
         const key = `${Math.round(cloud[i * 3] * 1e4)},${Math.round(cloud[i * 3 + 1] * 1e4)},${Math.round(cloud[i * 3 + 2] * 1e4)}`;
         if (!weld.has(key)) weld.set(key, weld.size);
         return weld.get(key)!;
      };
      // every edge is shared by exactly two triangles that run along it in opposite directions
      // (closed, one consistent winding), and the signed volume is positive (that winding faces out)
      const edges = new Map<string, { n: number; dir: number }>();
      let volume = 0;
      const a = new Vector3();
      const b = new Vector3();
      const c = new Vector3();
      for (let t = 0; t < indices.length; t += 3) {
         const [i, j, k] = [indices[t], indices[t + 1], indices[t + 2]];
         a.fromArray(cloud, i * 3);
         b.fromArray(cloud, j * 3);
         c.fromArray(cloud, k * 3);
         volume += a.dot(b.clone().cross(c)) / 6;
         for (const [u, v] of [
            [id(i), id(j)],
            [id(j), id(k)],
            [id(k), id(i)],
         ]) {
            const key = u < v ? `${u},${v}` : `${v},${u}`;
            const edge = edges.get(key) ?? { n: 0, dir: 0 };
            edge.n += 1;
            edge.dir += u < v ? 1 : -1;
            edges.set(key, edge);
         }
      }
      expect(edges.size).toBeGreaterThan(1000);
      for (const edge of edges.values()) {
         expect(edge.n).toBe(2);
         expect(edge.dir).toBe(0);
      }
      expect(volume).toBeGreaterThan(0.01);
   });

   it("fadeCopy: transparent, opaque until the fade, front-sided; the GLB's shared material untouched", () => {
      // the GLB's material is double-sided: made transparent as it is, three.js would draw it twice a frame
      const glb = readFileSync(path.join(process.cwd(), "public", asset.url));
      const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8")) as { materials: Array<{ doubleSided?: boolean }> };
      expect(json.materials.length).toBeGreaterThan(0);
      expect(json.materials.every((m) => m.doubleSided === true)).toBe(true);
      const naive = new MeshStandardMaterial({ side: DoubleSide }).clone();
      naive.transparent = true;
      expect(twoPass(naive)).toBe(true);
      // the copies the Scene fades: one pass, whatever side the original had (the stand-in's are front and double)
      for (const side of [FrontSide, BackSide, DoubleSide]) {
         const original = new MeshStandardMaterial({ side, color: "#ff0000" });
         const copy = fadeCopy(original);
         expect(copy).not.toBe(original);
         expect(copy.transparent).toBe(true);
         expect(copy.opacity).toBe(1);
         expect(copy.side).toBe(FrontSide);
         expect(twoPass(copy)).toBe(false);
         expect(copy.color.getHexString()).toBe("ff0000");
         expect(original.side).toBe(side);
         expect(original.transparent).toBe(false);
      }
      // and the Scene's FinishArch makes its copies with it
      const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      expect(scene).toMatch(/const c = fadeCopy\(m\);/);
   });
});
