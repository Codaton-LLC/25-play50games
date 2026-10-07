// The finish arch GLB (group D v2) as the Scene draws it: assets.ts scale x stretch on the real,
// meshopt-decoded mesh, no turn, no offset (core <Model>). Collision is the rules' two post circles
// (ARCH), never the mesh, so the drawn legs must stand on them and nothing else may hang in the
// runner's way. README "Assets".
import { statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ARCH_GLB, ASSETS } from "./assets";
import { LANDSCAPE, PORTRAIT } from "./camera";
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

   it("keeps the runway clear: nothing low between the legs, the banner over the runner and its cheer", async () => {
      const points = await drawnPoints();
      // below the legs' tops every vertex belongs to a leg
      const inner = ARCH.postX - ARCH.postRadius - SLEEVE;
      for (const p of points) if (p.y < LEG_TOP) expect(Math.abs(p.x)).toBeGreaterThanOrEqual(inner);
      // up to the widest a runner's centre gets at the line (pushed off a post: 2.85 m), the lowest
      // point (the banner's lower edge, 2.16 m) is over the 1.5 m runner hopping 0.32 m with its
      // hands up in its cheer (Scene.tsx), anywhere on the line
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
