"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Object3D } from "three";
import type { InstancedMesh } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { SkyDome } from "@/arcade3d/core/env/SkyDome";
import { SnowFall } from "@/arcade3d/core/env/SnowFall";
import { Fence } from "@/arcade3d/core/kit/Fence";
import { createPath } from "@/arcade3d/core/path";
import { Instanced } from "@/arcade3d/core/render/Instanced";
import { BlobShadow } from "@/arcade3d/core/render/BlobShadow";
import { useCanvasTexture } from "@/arcade3d/core/render/useCanvasTexture";
import { ASSETS } from "./assets";
import { COLORS, SnowmanStandIn, drawSnow } from "./Primitives";
import { fortHeight, type Run } from "./rules";

const FENCE = createPath(
   [
      { x: -12, y: 0, z: -9 },
      { x: 12, y: 0, z: -9 },
      { x: 12, y: 0, z: 9 },
      { x: -12, y: 0, z: 9 },
   ],
   { closed: true },
);

function Forts({ run }: { run: Run }) {
   const body = useRef<InstancedMesh>(null);
   const cap = useRef<InstancedMesh>(null);
   const dummy = useMemo(() => new Object3D(), []);
   useFrame(() => {
      const a = body.current;
      const b = cap.current;
      if (!a || !b) return;
      for (let i = 0; i < run.forts.length; i++) {
         const fort = run.forts[i];
         const h = Math.max(0.06, fortHeight(fort.hp));
         dummy.position.set(fort.x, h / 2, fort.z);
         dummy.scale.set(1, h, 1);
         dummy.rotation.set(0, 0, 0);
         dummy.updateMatrix();
         a.setMatrixAt(i, dummy.matrix);
         dummy.position.set(fort.x, h + 0.03, fort.z);
         dummy.scale.set(1.08, 0.08, 1.08);
         dummy.updateMatrix();
         b.setMatrixAt(i, dummy.matrix);
      }
      a.instanceMatrix.needsUpdate = true;
      b.instanceMatrix.needsUpdate = true;
   });
   return (
      <group>
         <instancedMesh ref={body} args={[undefined, undefined, run.forts.length]} frustumCulled={false}>
            <cylinderGeometry args={[0.9, 0.98, 1, 8]} />
            <meshStandardMaterial color={COLORS.fort} roughness={0.82} />
         </instancedMesh>
         <instancedMesh ref={cap} args={[undefined, undefined, run.forts.length]} frustumCulled={false}>
            <cylinderGeometry args={[0.9, 0.9, 1, 8]} />
            <meshStandardMaterial color={COLORS.fortCap} roughness={0.7} emissive={COLORS.ice} emissiveIntensity={0.15} />
         </instancedMesh>
      </group>
   );
}

function PineFallback({ spots }: { spots: { x: number; y: number; z: number; rotY: number; scale: number }[] }) {
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

export default function Yard({ run }: { run: Run }) {
   const snow = useCanvasTexture(512, 512, drawSnow);
   const pines = useMemo(
      () => run.pines.map((p) => ({ x: p.x, y: 0, z: p.z, rotY: p.rotY, scale: p.scale })),
      [run],
   );
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
         <InstancedModel asset={ASSETS.pine} spots={pines} fallback={<PineFallback spots={pines} />} />
         <Model asset={ASSETS.snowman} fallback={<SnowmanStandIn />} />
         <BlobShadow radius={0.85} opacity={0.28} y={0.02} />
      </group>
   );
}
