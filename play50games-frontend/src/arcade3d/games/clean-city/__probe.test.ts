import { expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";

it("probe festivalStall bounds", async () => {
   const { cloud, node } = await readCharacterGlb("/models/3d/clean-city/festivalStall.glb");
   const box = new Box3();
   const v = new Vector3();
   for (let i = 0; i < cloud.length; i += 3) box.expandByPoint(v.set(cloud[i], cloud[i + 1], cloud[i + 2]));
   const raw = box.getSize(new Vector3());
   const rawMin = box.min.clone();
   box.makeEmpty();
   for (let i = 0; i < cloud.length; i += 3) box.expandByPoint(v.set(cloud[i] + node[0], cloud[i + 1] + node[1], cloud[i + 2] + node[2]));
   const size = box.getSize(new Vector3());
   console.log(JSON.stringify({ node, rawMin, raw, min: box.min, max: box.max, size }));
   expect(size.x).toBeGreaterThan(0);
});
