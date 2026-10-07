// The football GLB (group D) as Scene.tsx draws it: <Model asset={ASSETS.ball}> in the ball's spin
// group, in place of BallPrimitive (its fallback). assets.ts scale / stretch / yOffset on the real,
// meshopt-decoded mesh: the stand-in's 0.22 m sphere, centred on the spin group's pivot, so the
// ball rests on the grass at BALL_SPOT and spins in place, as the stand-in did.
import { statSync } from "node:fs";
import path from "node:path";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { Box3, Matrix4, Quaternion, SphereGeometry, Vector3 } from "three";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, BALL_RADIUS } from "./assets";
import { BallMesh } from "./Primitives";
import { BALL_SPOT } from "./rules";

const UP = new Vector3(0, 1, 0);

/** core <Model>: yOffset, then rotationY, then scale x stretch in the GLB's own axes */
function modelMatrix(asset: ModelAsset): Matrix4 {
   const s = asset.scale ?? 1, k = asset.stretch ?? [1, 1, 1];
   return new Matrix4().compose(
      new Vector3(0, asset.yOffset ?? 0, 0),
      new Quaternion().setFromAxisAngle(UP, asset.rotationY ?? 0),
      new Vector3(s * k[0], s * k[1], s * k[2]),
   );
}

/** The GLB's vertices where <Model> draws them in the spin group (its origin = the ball's centre). */
async function drawnBall(): Promise<Vector3[]> {
   const { cloud } = await readCharacterGlb(ASSETS.ball.url);
   const m = modelMatrix(ASSETS.ball);
   const points: Vector3[] = [];
   for (let i = 0; i < cloud.length; i += 3) points.push(new Vector3(cloud[i], cloud[i + 1], cloud[i + 2]).applyMatrix4(m));
   return points;
}

/** The stand-in's sphere (BallMesh's <sphereGeometry> args), as the spin group holds it. */
function standInBox(): { radius: number; box: Box3 } {
   type Props = { children?: unknown; args?: unknown };
   const mesh = BallMesh({ map: null }) as ReactElement<Props>;
   const children = (Array.isArray(mesh.props.children) ? mesh.props.children : [mesh.props.children]) as Array<ReactElement<Props>>;
   const sphere = children.find((c) => c.type === "sphereGeometry")!;
   const [radius, widthSegments, heightSegments] = sphere.props.args as [number, number, number];
   const geometry = new SphereGeometry(radius, widthSegments, heightSegments);
   geometry.computeBoundingBox();
   const box = geometry.boundingBox!.clone();
   geometry.dispose();
   return { radius, box };
}

describe("penalty-hero ball GLB", () => {
   it("is listed and inside the prop budget", async () => {
      expect(hasModel(ASSETS.ball.url)).toBe(true);
      expect(ASSETS.ball.budget).toEqual(PROP_BUDGET);
      const bytes = statSync(path.join(process.cwd(), "public", ASSETS.ball.url)).size;
      expect(bytes).toBeLessThanOrEqual(PROP_BUDGET.bytes);
      const { indices } = await readCharacterGlb(ASSETS.ball.url);
      expect(indices.length / 3).toBeLessThanOrEqual(PROP_BUDGET.tris);
      // a ball has no front: nothing turns it
      expect((ASSETS.ball as ModelAsset).rotationY ?? 0).toBe(0);
   });

   it("replaces the stand-in in place: the same 0.22 m box on every axis, centred on the spin pivot", async () => {
      const standIn = standInBox();
      expect(standIn.radius).toBe(BALL_RADIUS);
      const box = new Box3().setFromPoints(await drawnBall());
      const size = box.getSize(new Vector3()).toArray();
      const want = standIn.box.getSize(new Vector3()).toArray();
      for (let a = 0; a < 3; a++) expect(Math.abs(size[a] / want[a] - 1), `axis ${a}: ${size[a]} vs ${want[a]}`).toBeLessThan(0.005);
      const centre = box.getCenter(new Vector3());
      expect(centre.length(), `centre ${centre.toArray()}`).toBeLessThan(0.001);
      // the stretch only rounds Rodin's slightly flat ball
      for (const k of ASSETS.ball.stretch) expect(Math.abs(k - 1)).toBeLessThan(0.05);
   });

   it("is round about its centre, so it spins without a wobble: every vertex at 92-103 % of BALL_RADIUS", async () => {
      // measured: 93.2 % (between the raised panels) to 102.2 %, median 98.2 %
      const radii = (await drawnBall()).map((p) => p.length()).sort((a, b) => a - b);
      const median = radii[radii.length >> 1];
      expect(Math.abs(median / BALL_RADIUS - 1)).toBeLessThan(0.025);
      expect(radii[0] / BALL_RADIUS).toBeGreaterThan(0.92);
      expect(radii[radii.length - 1] / BALL_RADIUS).toBeLessThan(1.03);
   });

   it("rests on the grass at the spot and never sinks into it more than 3 mm, whatever its spin", async () => {
      // Scene.tsx puts the spin group's origin at BALL_SPOT.y on the spot and through the hold
      expect(BALL_SPOT.y).toBe(BALL_RADIUS);
      const points = await drawnBall();
      const lowest = (spin: number): number => {
         const turn = new Matrix4().makeRotationX(spin);
         const p = new Vector3();
         let min = Infinity;
         for (const q of points) min = Math.min(min, p.copy(q).applyMatrix4(turn).y);
         return BALL_SPOT.y + min;
      };
      // unspun (the aim and the run-up): the sole on the grass
      expect(Math.abs(lowest(0))).toBeLessThan(0.001);
      // spun (Scene.tsx turns it about x by up to -18 rad in the flight and the hold)
      for (let i = 0; i < 72; i++) expect(lowest((i / 72) * Math.PI * 2)).toBeGreaterThan(-0.003);
   });
});
