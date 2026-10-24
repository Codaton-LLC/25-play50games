"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Object3D, type Group } from "three";
import type { InstancedMesh } from "three";
import type { FittedView } from "@/arcade3d/core/view";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { SkyDome } from "@/arcade3d/core/env/SkyDome";
import { SnowFall } from "@/arcade3d/core/env/SnowFall";
import { Fence } from "@/arcade3d/core/kit/Fence";
import { createPath } from "@/arcade3d/core/path";
import { Instanced } from "@/arcade3d/core/render/Instanced";
import type { InstanceSpot } from "@/arcade3d/core/render/useInstanceMatrices";
import { BlobShadow } from "@/arcade3d/core/render/BlobShadow";
import { useCanvasTexture } from "@/arcade3d/core/render/useCanvasTexture";
import { ASSETS } from "./assets";
import { COLORS, SnowmanStandIn, drawSnow } from "./Primitives";
import {
   FORT_BLOCKS,
   FORT_ICICLES,
   FORT_TONES,
   ICICLE_COLOR,
   bankSpots,
   fortBlockScale,
   fortVisualScale,
   fortYaw,
   pineSpots,
   snowmanCovers,
} from "./looks";
import { FORT, type Run } from "./rules";

const FENCE = createPath(
   [
      { x: -12, y: 0, z: -9 },
      { x: 12, y: 0, z: -9 },
      { x: 12, y: 0, z: 9 },
      { x: -12, y: 0, z: 9 },
   ],
   { closed: true },
);

const TONES = FORT_TONES.map((hex) => new Color(hex));
const ICICLE = new Color(ICICLE_COLOR);
const BLOCK_COUNT = FORT.count * FORT_BLOCKS.length;
const ICICLE_COUNT = FORT.count * FORT_ICICLES.length;

function Forts({ run }: { run: Run }) {
   const blocks = useRef<InstancedMesh>(null);
   const icicles = useRef<InstancedMesh>(null);
   const dummy = useMemo(() => new Object3D(), []);
   useLayoutEffect(() => {
      const body = blocks.current;
      const ice = icicles.current;
      if (body) {
         for (let f = 0; f < FORT.count; f++) {
            for (let b = 0; b < FORT_BLOCKS.length; b++) body.setColorAt(f * FORT_BLOCKS.length + b, TONES[FORT_BLOCKS[b].tone]);
         }
         if (body.instanceColor) body.instanceColor.needsUpdate = true;
      }
      if (ice) {
         for (let i = 0; i < ICICLE_COUNT; i++) ice.setColorAt(i, ICICLE);
         if (ice.instanceColor) ice.instanceColor.needsUpdate = true;
      }
   }, []);
   useFrame(() => {
      const body = blocks.current;
      const ice = icicles.current;
      if (!body || !ice) return;
      for (let f = 0; f < run.forts.length; f++) {
         const fort = run.forts[f];
         const yaw = fortYaw(fort.x, fort.z);
         const c = Math.cos(yaw);
         const s = Math.sin(yaw);
         const wall = fort.hp > 0 ? fortVisualScale(fort.hp) : 0;
         for (let b = 0; b < FORT_BLOCKS.length; b++) {
            const block = FORT_BLOCKS[b];
            const k = fortBlockScale(fort.hp, block.tier);
            const i = f * FORT_BLOCKS.length + b;
            if (k <= 0) {
               dummy.position.set(0, -8, 0);
               dummy.scale.set(0, 0, 0);
               dummy.rotation.set(0, 0, 0);
            } else {
               dummy.position.set(fort.x + block.x * c + block.z * s, block.y * k, fort.z - block.x * s + block.z * c);
               dummy.scale.set(block.r, block.r * block.sy * k, block.r);
               dummy.rotation.set(0, 0, 0);
            }
            dummy.updateMatrix();
            body.setMatrixAt(i, dummy.matrix);
         }
         const showIce = fort.hp >= 2 ? wall : 0;
         for (let b = 0; b < FORT_ICICLES.length; b++) {
            const spike = FORT_ICICLES[b];
            const i = f * FORT_ICICLES.length + b;
            if (showIce <= 0) {
               dummy.position.set(0, -8, 0);
               dummy.scale.set(0, 0, 0);
               dummy.rotation.set(0, 0, 0);
            } else {
               dummy.position.set(
                  fort.x + spike.x * c + spike.z * s,
                  (spike.y - spike.len / 2) * showIce,
                  fort.z - spike.x * s + spike.z * c,
               );
               dummy.scale.set(spike.r, spike.len * showIce, spike.r);
               dummy.rotation.set(Math.PI, yaw, 0);
            }
            dummy.updateMatrix();
            ice.setMatrixAt(i, dummy.matrix);
         }
      }
      body.instanceMatrix.needsUpdate = true;
      ice.instanceMatrix.needsUpdate = true;
   });
   return (
      <group>
         <instancedMesh ref={blocks} args={[undefined, undefined, BLOCK_COUNT]} frustumCulled={false}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#ffffff" roughness={0.78} emissive={COLORS.ice} emissiveIntensity={0.22} />
         </instancedMesh>
         <instancedMesh ref={icicles} args={[undefined, undefined, ICICLE_COUNT]} frustumCulled={false}>
            <coneGeometry args={[1, 1, 5]} />
            <meshStandardMaterial color={ICICLE_COLOR} roughness={0.35} emissive={ICICLE_COLOR} emissiveIntensity={0.35} />
         </instancedMesh>
      </group>
   );
}

function PineFallback({ spots }: { spots: InstanceSpot[] }) {
   return (
      <group>
         <Instanced spots={spots}>
            <cylinderGeometry args={[0.18, 0.28, 1.2, 6]} />
            <meshStandardMaterial color={COLORS.trunk} />
         </Instanced>
         <Instanced spots={spots.map((s) => ({ ...s, y: 2.2 }))}>
            <coneGeometry args={[1.1, 3.2, 7]} />
            <meshStandardMaterial color={COLORS.pine} />
         </Instanced>
      </group>
   );
}

function Snowman({ run, view }: { run: Run; view: FittedView }) {
   const ref = useRef<Group>(null);
   useFrame((state) => {
      const g = ref.current;
      if (!g) return;
      g.visible = !snowmanCovers(run, view, state.size.width, state.size.height);
   });
   return (
      <group ref={ref}>
         <Model asset={ASSETS.snowman} fallback={<SnowmanStandIn />} />
         <BlobShadow radius={0.85} opacity={0.28} y={0.02} />
      </group>
   );
}

export default function Yard({ run, view }: { run: Run; view: FittedView }) {
   const snow = useCanvasTexture(512, 512, drawSnow);
   const pines = useMemo(() => pineSpots(run.pines), [run]);
   const banks = useMemo(() => bankSpots(run.pines), [run]);
   return (
      <group>
         <SkyDome top={COLORS.skyTop} bottom={COLORS.skyBottom} />
         <SnowFall count={360} />
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
            <circleGeometry args={[16, 24]} />
            <meshStandardMaterial color={COLORS.shade} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[24, 18]} />
            <meshStandardMaterial map={snow} color={COLORS.snow} roughness={0.95} />
         </mesh>
         <Fence path={FENCE} spacing={1.7} height={1.1} color={COLORS.fence} railColor={COLORS.rail} />
         <Forts run={run} />
         {banks.length > 0 && (
            <Instanced spots={banks}>
               <sphereGeometry args={[1, 8, 6]} />
               <meshStandardMaterial color={COLORS.snow} roughness={0.9} emissive={COLORS.ice} emissiveIntensity={0.12} />
            </Instanced>
         )}
         <InstancedModel asset={ASSETS.pine} spots={pines} fallback={<PineFallback spots={pines} />} />
         <Snowman run={run} view={view} />
      </group>
   );
}
