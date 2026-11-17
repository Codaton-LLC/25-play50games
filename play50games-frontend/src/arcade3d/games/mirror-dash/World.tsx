"use client";

// The hall around the runways: a dark violet floor far below the track, the m2MirrorHallBg arches
// standing along both sides (they follow the run in a loop of copies), a starfield in violet space, and
// the level's light. The course itself: Track.tsx.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D } from "three";
import { DynamicInstancedModel } from "../../core/assets";
import { ASSETS } from "./assets";
import { lookFor } from "./look";
import type { Pair, World as RunWorld } from "./rules";

const O = new Object3D();
const STARS = 220;
const HALL_STEP = 26;

export function World({ world, lead, span }: { world: RunWorld; lead: Pair; span: number }) {
   const look = lookFor(world.level);
   const stars = useRef<InstancedMesh>(null);
   const seeds = useMemo(() => Array.from({ length: STARS }, (_, i) => ({ x: (((i * 97.13) % 1) - 0.5) * 220, y: 6 + ((i * 53.71) % 1) * 70, z: ((i * 31.7) % 1) * 260, s: 0.08 + ((i * 17.3) % 1) * 0.16 })), []);
   useFrame(() => {
      const m = stars.current;
      if (!m) return;
      const base = lead.s;
      seeds.forEach((f, i) => {
         O.position.set(f.x, f.y, -(base + ((f.z - base * 0.3) % 260 + 260) % 260 - 40));
         O.scale.setScalar(f.s);
         O.updateMatrix();
         m.setMatrixAt(i, O.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
   });
   return (
      <>
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[span / 2, -6, -(lead.s + 60)]}>
            <planeGeometry args={[300, 400]} />
            <meshStandardMaterial color={look.floor} roughness={0.9} />
         </mesh>
         <DynamicInstancedModel
            asset={ASSETS.hall}
            count={12}
            update={(i, m) => {
               const side = i % 2 === 0 ? -1 : 1;
               const n = Math.floor(lead.s / HALL_STEP) - 1 + Math.floor(i / 2);
               O.position.set(span / 2 + side * (span / 2 + 12), -6, -n * HALL_STEP);
               O.rotation.set(0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
               O.scale.set(1, 1, 1);
               O.updateMatrix();
               m.copy(O.matrix);
            }}
         />
         <instancedMesh ref={stars} args={[undefined, undefined, STARS]} frustumCulled={false}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial color="#e9d5ff" />
         </instancedMesh>
         <hemisphereLight args={["#e9d5ff", look.floor, look.ambient]} />
         <directionalLight position={[6, 18, 10]} intensity={0.9} color="#f5f3ff" />
         <ambientLight intensity={look.ambient * 0.4} />
      </>
   );
}
