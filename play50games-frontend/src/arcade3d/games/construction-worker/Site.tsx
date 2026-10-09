"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { Model, InstancedModel } from "@/arcade3d/core/assets";
import { BlobShadow } from "@/arcade3d/core/render/BlobShadow";
import { useCanvasTexture } from "@/arcade3d/core/render/useCanvasTexture";
import { Fence } from "@/arcade3d/core/kit";
import { createPath } from "@/arcade3d/core/path";
import { HumanoidModel, useHumanoidPose, bodyLift } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useQuality } from "@/arcade3d/core/quality";
import { ASSETS, WORKER_SCALE } from "./assets";
import { workerPose } from "./poses";
import { PILE_A, PILE_R, type Run } from "./rules";
import { drawPad, groundGeo, pileGeo, pileMats } from "./Primitives";

const FENCE = createPath(
   [
      { x: -8, y: 0, z: -2 },
      { x: 8, y: 0, z: -2 },
      { x: 8, y: 0, z: 12 },
      { x: -8, y: 0, z: 12 },
   ],
   { closed: true },
);

const PALLETS = [
   { x: 5.4, y: 0, z: 0.4, rotY: 0.3 },
   { x: 6.2, y: 0, z: 1.6, rotY: -0.2 },
];

const CRATES = [
   { x: 5.4, y: 0, z: 0.4 },
   { x: 6.2, y: 0, z: 1.6 },
   { x: 4.6, y: 0, z: 1.5 },
   { x: -6.2, y: 0, z: 4.2 },
];

const PILES = PILE_A.map((angle) => ({ x: PILE_R * Math.sin(angle), z: PILE_R * Math.cos(angle) }));

function Worker({ run }: { run: Run }) {
   const time = useGameTime();
   const pose = useHumanoidPose((p) => {
      workerPose(run.carried >= 0, run.cheer, run.phase === "win", time.now, p);
   });
   const group = useRef<Group>(null);
   useFrame(() => {
      const g = group.current;
      if (g) g.position.y = bodyLift(pose, RUNNER_LANDMARKS) * WORKER_SCALE;
   }, -0.05);
   return (
      <group ref={group} position={[2.6, 0, 5.35]}>
         <HumanoidModel
            asset={ASSETS.worker}
            pose={pose}
            applyLift={false}
            fallback={<WorkerFallback />}
            attach={{
               head: (
                  <mesh position={[0, 0.02, 0]}>
                     <cylinderGeometry args={[0.11, 0.13, 0.08, 8]} />
                     <meshStandardMaterial color="#fbbf24" />
                  </mesh>
               ),
            }}
         />
         <BlobShadow radius={0.32} />
      </group>
   );
}

function WorkerFallback() {
   return (
      <group>
         <mesh position={[0, 0.78, 0]}>
            <capsuleGeometry args={[0.22, 0.7, 4, 8]} />
            <meshStandardMaterial color="#f97316" />
         </mesh>
         <mesh position={[0, 1.45, 0]}>
            <cylinderGeometry args={[0.16, 0.18, 0.1, 8]} />
            <meshStandardMaterial color="#fbbf24" />
         </mesh>
      </group>
   );
}

function VanFallback() {
   return (
      <mesh position={[0, 0.8, 0]}>
         <boxGeometry args={[4.5, 1.6, 1.9]} />
         <meshStandardMaterial color="#e9edf3" />
      </mesh>
   );
}

/** Ground, fence, piles, the worker, and the props that drop out on the low tier. */
export function Site({ run }: { run: Run }) {
   const pad = useCanvasTexture(128, 128, drawPad);
   const decor = useQuality().tier !== "low";
   return (
      <group>
         <mesh geometry={groundGeo} rotation-x={-Math.PI / 2} position={[0, 0, 5]} dispose={null}>
            <meshStandardMaterial map={pad} color="#d6d3d1" roughness={1} />
         </mesh>
         <Fence path={FENCE} spacing={1.8} height={0.9} color="#a16207" />
         {PILES.map((p, i) => (
            <mesh key={i} geometry={pileGeo} material={pileMats[i]} position={[p.x, 0.25, p.z]} dispose={null} />
         ))}
         <Worker run={run} />
         {decor && (
            <group position={[-5.4, 0, 1]} rotation={[0, Math.PI / 2, 0]}>
               <Model asset={ASSETS.van} fallback={<VanFallback />} />
            </group>
         )}
         <InstancedModel
            asset={ASSETS.pallet}
            spots={PALLETS}
            fallback={
               <mesh position={[5.4, 0.08, 0.4]}>
                  <boxGeometry args={[1.2, 0.15, 0.8]} />
                  <meshStandardMaterial color="#b45309" />
               </mesh>
            }
         />
         {decor && (
            <InstancedModel
               asset={ASSETS.crate}
               spots={CRATES}
               fallback={
                  <mesh position={[5.4, 0.4, 0.4]}>
                     <boxGeometry args={[0.8, 0.8, 0.8]} />
                     <meshStandardMaterial color="#b45309" />
                  </mesh>
               }
            />
         )}
      </group>
   );
}
