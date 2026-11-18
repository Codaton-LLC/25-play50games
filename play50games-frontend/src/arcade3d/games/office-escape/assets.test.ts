// Office Escape's fits on the real, meshopt-decoded GLBs (through core modelParts, what
// <InstancedProp> / <InstancedModel> draw): every model is in the manifest and its file exists;
// the execDesk decor (levels 4-5 only) is drawn at its real size and its spots sit outside the lanes.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, EXEC_DESK_GLB, EXEC_DESK_LEVELS, EXEC_DESK_PATTERN, EXEC_DESK_PATTERNS } from "./assets";
import { CORRIDOR_DECOR } from "./decor";
import { LEVEL_VARIANTS } from "./looks";
import { execDeskSpots } from "./Primitives";
import { LANES } from "./rules";

async function drawnBox(asset: ModelAsset): Promise<Box3> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   expect(parts).toHaveLength(1);
   const box = new Box3();
   const v = new Vector3();
   for (let i = 0; i < local.length; i += 3) box.expandByPoint(v.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   geometry.dispose();
   return box;
}

const rawBox = (asset: ModelAsset) => drawnBox({ ...asset, scale: 1, stretch: undefined, rotationY: 0, yOffset: 0 });

describe("office-escape models", () => {
   it("are all in the manifest and every file this game owns exists", () => {
      for (const asset of Object.values(ASSETS)) {
         expect(hasModel(asset.url), asset.url).toBe(true);
         if (asset.url.startsWith("/models/3d/office-escape/")) {
            expect(existsSync(resolve("public", asset.url.slice(1))), asset.url).toBe(true);
         }
      }
      expect(ASSETS.execDesk.url).toBe("/models/3d/office-escape/execDesk.glb");
   });

   it("measures the execDesk GLB as committed and draws it at its real size", async () => {
      expect(ASSETS.execDesk.scale).toBe(1);
      const raw = await rawBox(ASSETS.execDesk);
      expect(raw.min.y).toBeCloseTo(0, 3);
      expect(raw.max.x - raw.min.x).toBeCloseTo(EXEC_DESK_GLB.width, 3);
      expect(raw.max.y - raw.min.y).toBeCloseTo(EXEC_DESK_GLB.height, 3);
      expect(raw.max.z - raw.min.z).toBeCloseTo(EXEC_DESK_GLB.depth, 3);
      // scale 1, no yOffset: the drawn box is the raw one, the feet on y = 0
      const drawn = await drawnBox(ASSETS.execDesk);
      expect(drawn.min.y).toBeCloseTo(0, 3);
      expect(drawn.max.x - drawn.min.x).toBeCloseTo(EXEC_DESK_GLB.width, 3);
      expect(drawn.max.y - drawn.min.y).toBeCloseTo(EXEC_DESK_GLB.height, 3);
      expect(drawn.max.z - drawn.min.z).toBeCloseTo(EXEC_DESK_GLB.depth, 3);
   });

   it("lines only levels 4 and 5 with exec desks", () => {
      expect(EXEC_DESK_LEVELS).toEqual([4, 5]);
   });
});

describe("exec desk spots", () => {
   // the play area is the three lanes: the outer lane centres +/- 1 m (rules.ts LANES); the corridor
   // walls are at +/- 4.6 (Primitives.tsx CORRIDOR.halfWidth). The spots turn the desk 90°, so its
   // depth is its across-track extent.
   const LANE_EDGE = LANES[LANES.length - 1] / 1000 + 1;
   const WALL_X = 4.6;

   it("places 2-4 desks per period, every one outside the play bounds", () => {
      expect(EXEC_DESK_PATTERN.length).toBeGreaterThanOrEqual(2);
      expect(EXEC_DESK_PATTERN.length).toBeLessThanOrEqual(4);
      for (const spot of [...EXEC_DESK_PATTERN, ...EXEC_DESK_PATTERNS[5]!]) {
         const inner = Math.abs(spot.x) - EXEC_DESK_GLB.depth / 2;
         const outer = Math.abs(spot.x) + EXEC_DESK_GLB.depth / 2;
         expect(inner).toBeGreaterThan(LANE_EDGE);
         expect(outer).toBeLessThanOrEqual(WALL_X);
      }
   });

   it("levels 4 and 5: no desk overlaps its level's corridor decor (set pieces, plants, cabinets)", () => {
      for (const level of EXEC_DESK_LEVELS) {
         const decor = CORRIDOR_DECOR[LEVEL_VARIANTS[level]];
         const others = [...decor.pots, ...decor.cabinets, ...decor.setPieces.flatMap((p) => p.spots)];
         for (const d of execDeskSpots(level)) {
            // the desk is turned 90°: depth across, width along
            const dx = EXEC_DESK_GLB.depth / 2;
            const dz = EXEC_DESK_GLB.width / 2;
            for (const o of others) {
               const ox = ((o.sx ?? o.scale ?? 0.3) as number) / 2;
               const oz = ((o.sz ?? o.scale ?? 0.3) as number) / 2;
               // monitors stand on the desk top (y >= its height): not a clash
               if (o.y - ((o.sy ?? 0) as number) / 2 >= EXEC_DESK_GLB.height - 0.05) continue;
               const apart = Math.abs(o.x - d.x) >= dx + ox || Math.abs(o.z - d.z) >= dz + oz;
               expect(apart, `L${level} desk at ${d.x},${d.z.toFixed(1)} vs ${o.x},${o.z.toFixed(1)}`).toBe(true);
            }
         }
      }
   });
});
