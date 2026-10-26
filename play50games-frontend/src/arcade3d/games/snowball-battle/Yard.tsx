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
import { ASSETS, IGLOO_DRAWN, IGLOO_SPOTS, SNOWMAN_BIG_DRAWN, SNOWMAN_BIG_SPOTS, VILLAGE_LEVEL_IDS } from "./assets";
import { COLORS, SnowmanStandIn, drawSnow } from "./Primitives";
import { useSnowLevel } from "./useSnowLevel";
import {
   FORT_BLOCKS,
   FORT_CONTACT,
   FORT_ICICLES,
   ICICLE_COLOR,
   bankSpots,
   fortBlockColor,
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

const BLOCK_COLORS = FORT_BLOCKS.map((block) => new Color(fortBlockColor(block)));
const ICICLE = new Color(ICICLE_COLOR);
const BLOCK_COUNT = FORT.count * FORT_BLOCKS.length;
const ICICLE_COUNT = FORT.count * FORT_ICICLES.length;
const SHADOW_R = 1.2;

function Forts({ run }: { run: Run }) {
   const blocks = useRef<InstancedMesh>(null);
   const icicles = useRef<InstancedMesh>(null);
   const shadows = useRef<InstancedMesh>(null);
   const dummy = useMemo(() => new Object3D(), []);
   useLayoutEffect(() => {
      const body = blocks.current;
      const ice = icicles.current;
      if (body) {
         for (let f = 0; f < FORT.count; f++) {
            for (let b = 0; b < FORT_BLOCKS.length; b++) body.setColorAt(f * FORT_BLOCKS.length + b, BLOCK_COLORS[b]);
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
      const shade = shadows.current;
      if (!body || !ice || !shade) return;
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
         dummy.position.set(fort.x, 0.02, fort.z);
         dummy.scale.set(SHADOW_R, SHADOW_R, 1);
         dummy.rotation.set(-Math.PI / 2, 0, 0);
         dummy.updateMatrix();
         shade.setMatrixAt(f, dummy.matrix);
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
      shade.instanceMatrix.needsUpdate = true;
   });
   return (
      <group>
         <instancedMesh ref={shadows} args={[undefined, undefined, FORT.count]} frustumCulled={false}>
            <circleGeometry args={[1, 16]} />
            <meshBasicMaterial color={FORT_CONTACT} transparent opacity={0.45} depthWrite={false} />
         </instancedMesh>
         <instancedMesh ref={blocks} args={[undefined, undefined, BLOCK_COUNT]} frustumCulled={false}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#ffffff" roughness={0.72} />
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

/** Igloo stand-in: a half-buried hemisphere at the drawn footprint, used until the GLB is fetched. */
const IGLOO_FALLBACK_SPOTS = IGLOO_SPOTS.map((s) => ({
   ...s,
   sx: IGLOO_DRAWN.width / 2,
   sy: IGLOO_DRAWN.height,
   sz: IGLOO_DRAWN.depth / 2,
}));

function IglooFallback() {
   return (
      <Instanced spots={IGLOO_FALLBACK_SPOTS}>
         <sphereGeometry args={[1, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2]} />
         <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
      </Instanced>
   );
}

/** Big-snowman stand-in: one stacked sphere lump centred on the drawn height. */
const SNOWMAN_BIG_FALLBACK_SPOTS = SNOWMAN_BIG_SPOTS.map((s) => ({
   ...s,
   y: s.y + SNOWMAN_BIG_DRAWN.height / 2,
   sx: SNOWMAN_BIG_DRAWN.width / 2,
   sy: SNOWMAN_BIG_DRAWN.height / 2,
   sz: SNOWMAN_BIG_DRAWN.depth / 2,
}));

function SnowmanBigFallback() {
   return (
      <Instanced spots={SNOWMAN_BIG_FALLBACK_SPOTS}>
         <sphereGeometry args={[1, 10, 8]} />
         <meshStandardMaterial color="#f8fafc" roughness={0.85} />
      </Instanced>
   );
}

/** Levels 4-5 only: igloos and big snowmen behind the far fence, framing the village theme. */
function Village() {
   return (
      <group>
         <InstancedModel asset={ASSETS.igloo} spots={[...IGLOO_SPOTS]} fallback={<IglooFallback />} />
         <InstancedModel asset={ASSETS.snowmanBig} spots={[...SNOWMAN_BIG_SPOTS]} fallback={<SnowmanBigFallback />} />
      </group>
   );
}

export default function Yard({ run, view }: { run: Run; view: FittedView }) {
   const snow = useCanvasTexture(512, 512, drawSnow);
   const pines = useMemo(() => pineSpots(run.pines), [run]);
   const banks = useMemo(() => bankSpots(run.pines), [run]);
   const { id } = useSnowLevel();
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
         {VILLAGE_LEVEL_IDS.includes(id) && <Village />}
      </group>
   );
}
