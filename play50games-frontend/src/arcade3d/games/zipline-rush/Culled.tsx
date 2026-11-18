"use client";

// Static scenery spots drawn through one <DynamicInstancedModel> that skips the copies far up or down
// the course from the camera: the course is up to 450 m long and only ~200 m of it is ever in view
// (fog), so towers, boulders, cliffs and buoys never send the whole level's triangles.
import { Euler, Vector3 } from "three";
import { useThree } from "@react-three/fiber";
import { DynamicInstancedModel } from "../../core/assets";
import { useGameTime } from "../../core/gameTime";
import type { ModelAsset } from "../../core/types";

export interface CullSpot {
   x: number;
   y: number;
   z: number;
   scale?: number;
   sx?: number;
   sy?: number;
   sz?: number;
   rotY?: number;
   /** bob on the sea (m), 0 = still */
   bob?: number;
}

const E = new Euler();
const S = new Vector3();

export function CulledModel({ asset, spots, ahead = 230, behind = 60 }: { asset: ModelAsset; spots: readonly CullSpot[]; ahead?: number; behind?: number }) {
   const camera = useThree((s) => s.camera);
   const time = useGameTime();
   if (spots.length === 0) return null;
   return (
      <DynamicInstancedModel
         asset={asset}
         count={spots.length}
         update={(i, matrix) => {
            const s = spots[i];
            // the run travels along -z: keep what lies ahead of the camera, a little behind it
            const dz = camera.position.z - s.z;
            if (dz > ahead || dz < -behind) return false;
            const bob = s.bob ?? 0;
            if (bob > 0) {
               const t = time.now + i * 1.7;
               matrix.makeRotationFromEuler(E.set(Math.sin(t * 1.3) * 0.12, s.rotY ?? 0, Math.cos(t * 1.1) * 0.12));
               matrix.scale(S.set(s.sx ?? s.scale ?? 1, s.sy ?? s.scale ?? 1, s.sz ?? s.scale ?? 1));
               matrix.setPosition(s.x, s.y + Math.sin(t * 1.6) * bob, s.z);
               return;
            }
            matrix.makeRotationY(s.rotY ?? 0);
            matrix.scale(S.set(s.sx ?? s.scale ?? 1, s.sy ?? s.scale ?? 1, s.sz ?? s.scale ?? 1));
            matrix.setPosition(s.x, s.y, s.z);
         }}
      />
   );
}
