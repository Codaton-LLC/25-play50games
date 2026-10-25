"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BoxGeometry,
   BufferAttribute,
   BufferGeometry,
   Color,
   CylinderGeometry,
   type Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { BlobShadow } from "@/arcade3d/core/render/BlobShadow";
import { useCanvasTexture } from "@/arcade3d/core/render/useCanvasTexture";
import { Fence } from "@/arcade3d/core/kit";
import { createPath } from "@/arcade3d/core/path";
import { bodyLift, HumanoidModel, useHumanoidPose } from "@/arcade3d/core/rig";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useQuality } from "@/arcade3d/core/quality";
import { ASSETS, MIXER, MIXER_HEIGHT, MIXER_SPOTS, WORKER_HAT, WORKER_LANDMARKS, WORKER_SCALE } from "./assets";
import { COLORS } from "./looks";
import { workerPose } from "./poses";
import { PILE_A, PILE_R, type Run } from "./rules";
import {
   drawPad,
   groundGeo,
   hatGeo,
   hatMat,
   pileGeos,
   pileMats,
} from "./Primitives";
import { useCraneLevel } from "./useCraneLevel";
import { Decor } from "./Decor";

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

function withColor(raw: BufferGeometry, hex: string): BufferGeometry {
   const geo = raw.index ? raw.toNonIndexed() : raw;
   const count = geo.attributes.position.count;
   const colors = new Float32Array(count * 3);
   const color = new Color(hex);
   for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
   }
   geo.setAttribute("color", new BufferAttribute(colors, 3));
   return geo;
}

function Worker({ run }: { run: Run }) {
   const time = useGameTime();
   const pose = useHumanoidPose((p) => {
      workerPose(run.carried >= 0, run.cheer, run.phase === "win", time.now, p);
   });
   const group = useRef<Group>(null);
   useFrame(() => {
      const g = group.current;
      if (g) g.position.y = bodyLift(pose, WORKER_LANDMARKS) * WORKER_SCALE;
   }, -0.05);

   return (
      <group ref={group} position={[2.6, 0, 5.35]} name="construction-worker-group">
         <HumanoidModel
            asset={ASSETS.worker}
            pose={pose}
            applyLift={false}
            fallback={<WorkerFallback />}
            attach={{
               head: (
                  <mesh geometry={hatGeo} material={hatMat} position={[0, WORKER_HAT.y, WORKER_HAT.z]} scale={WORKER_HAT.scale} dispose={null} />
               ),
            }}
         />
         <BlobShadow radius={0.34} />
      </group>
   );
}

function WorkerFallback() {
   return (
      <group name="worker-fallback">
         <mesh position={[0, 0.78, 0]}>
            <capsuleGeometry args={[0.22, 0.7, 4, 8]} />
            <meshStandardMaterial color={COLORS.craneOrange} />
         </mesh>
         <mesh position={[0, 1.48, 0]} geometry={hatGeo} material={hatMat} dispose={null} />
      </group>
   );
}

function VanFallback() {
   const vanGeo = useMemo(() => {
      const body = withColor(new RoundedBoxGeometry(4.2, 1.4, 1.8, 2, 0.08).translate(0, 0.8, 0), COLORS.concrete);
      const cabGlass = withColor(new RoundedBoxGeometry(1.4, 0.65, 1.82, 2, 0.04).translate(1.1, 1.15, 0), COLORS.craneDark);
      const bumper = withColor(new BoxGeometry(0.2, 0.3, 1.85).translate(2.15, 0.25, 0), COLORS.craneDark);
      const w1 = withColor(new CylinderGeometry(0.35, 0.35, 0.25, 12).rotateX(Math.PI / 2).translate(1.2, 0.35, 0.95), COLORS.craneDark);
      const w2 = withColor(new CylinderGeometry(0.35, 0.35, 0.25, 12).rotateX(Math.PI / 2).translate(1.2, 0.35, -0.95), COLORS.craneDark);
      const w3 = withColor(new CylinderGeometry(0.35, 0.35, 0.25, 12).rotateX(Math.PI / 2).translate(-1.2, 0.35, 0.95), COLORS.craneDark);
      const w4 = withColor(new CylinderGeometry(0.35, 0.35, 0.25, 12).rotateX(Math.PI / 2).translate(-1.2, 0.35, -0.95), COLORS.craneDark);
      const merged = mergeGeometries([body, cabGlass, bumper, w1, w2, w3, w4]);
      body.dispose();
      cabGlass.dispose();
      bumper.dispose();
      w1.dispose();
      w2.dispose();
      w3.dispose();
      w4.dispose();
      return merged;
   }, []);

   useEffect(() => () => vanGeo?.dispose(), [vanGeo]);

   return (
      <mesh geometry={vanGeo ?? undefined} name="van-fallback">
         <meshStandardMaterial vertexColors roughness={0.6} />
      </mesh>
   );
}

function MixerFallback() {
   return (
      <group name="mixer-fallback">
         <mesh position={[0, MIXER_HEIGHT * 0.2, 0]}>
            <boxGeometry args={[0.9, MIXER_HEIGHT * 0.4, 1]} />
            <meshStandardMaterial color={COLORS.craneYellow} />
         </mesh>
         <mesh position={[0, MIXER_HEIGHT * 0.62, 0]} rotation={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.45, 0.4, MIXER_HEIGHT * 0.6, 12]} />
            <meshStandardMaterial color={COLORS.craneOrange} />
         </mesh>
      </group>
   );
}

/** Ground, fence, 5 material piles, worker, props, and surroundings decor. */
export function Site({ run, levelId }: { run: Run; levelId?: number }) {
   const { id: contextLevelId } = useCraneLevel();
   const effectiveLevel = levelId ?? contextLevelId;
   const isCommercial = effectiveLevel === 4 || effectiveLevel === 5;
   const pad = useCanvasTexture(512, 512, drawPad);
   const decor = useQuality().tier !== "low";

   return (
      <group name="construction-site">
         <mesh geometry={groundGeo} rotation-x={-Math.PI / 2} position={[0, 0, 5]} dispose={null} name="site-ground">
            <meshStandardMaterial map={pad} roughness={0.95} />
         </mesh>
         <Fence path={FENCE} spacing={1.8} height={0.9} color={COLORS.craneOrange} railColor={COLORS.safetyYellow} />
         {PILES.map((p, i) => (
            <mesh
               key={i}
               geometry={pileGeos[i] ?? pileGeos[0]}
               material={pileMats[i] ?? pileMats[0]}
               position={[p.x, 0, p.z]}
               dispose={null}
               name={`site-pile-${i}`}
            />
         ))}
         <Worker run={run} />
         {/* Instanced surroundings decor outside the play area */}
         <Decor />
         {/* Cement mixers outside the play area (levels 4 & 5 only: Shop Front & Mini Tower) */}
         {decor && isCommercial && (
            <InstancedModel asset={ASSETS.cementMixer} spots={MIXER_SPOTS} fallback={<MixerFallback />} />
         )}
         {decor && (
            <group position={[-5.4, 0, 1]} rotation={[0, Math.PI / 2, 0]} name="van-group">
               <Model asset={ASSETS.van} fallback={<VanFallback />} />
            </group>

         )}
         <InstancedModel
            asset={ASSETS.pallet}
            spots={PALLETS}
            fallback={
               <mesh position={[5.4, 0.08, 0.4]}>
                  <boxGeometry args={[1.2, 0.15, 0.8]} />
                  <meshStandardMaterial color={COLORS.woodPallet} />
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
                     <meshStandardMaterial color={COLORS.woodPallet} />
                  </mesh>
               }
            />
         )}
      </group>
   );
}
