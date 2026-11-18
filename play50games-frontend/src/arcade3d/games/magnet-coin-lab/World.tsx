"use client";

// Around the rooms: the workshop hall they stand in (a long timber floor in front, the dark rafters
// behind, snow drifting past the far windows), the lighting per level and the hall's warm lamps. The
// rooms themselves: Room.tsx; the coins: Coins.tsx.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D } from "three";
import { useGameTime } from "../../core/gameTime";
import type { World as RunWorld } from "./rules";
import { lookFor } from "./look";
import { DEPTH, ROOM_GAP, roomX } from "./space";

const O = new Object3D();
const FLAKES = 160;

export function World({ world }: { world: RunWorld }) {
   const look = lookFor(world.level);
   const span = roomX(world.rooms.length - 1) + 24;
   const snow = useRef<InstancedMesh>(null);
   const time = useGameTime();
   const seeds = useMemo(() => Array.from({ length: FLAKES }, (_, i) => ({ x: ((i * 97.13) % 1) * (span + 20) - 10, y: ((i * 53.71) % 1) * 14, z: -6 - ((i * 31.7) % 1) * 10, s: 0.04 + ((i * 17.3) % 1) * 0.05 })), [span]);
   useFrame(() => {
      const m = snow.current;
      if (!m) return;
      const t = time.now;
      seeds.forEach((f, i) => {
         const y = ((f.y - t * (0.5 + f.s * 6)) % 14 + 14) % 14 - 1;
         O.position.set(f.x + Math.sin(t * 0.7 + i) * 0.4, y, f.z);
         O.scale.setScalar(f.s);
         O.updateMatrix();
         m.setMatrixAt(i, O.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
   });
   return (
      <>
         {/* the hall floor in front of the rooms and the dark beyond them */}
         <mesh position={[span / 2, -0.5, DEPTH / 2 + 3]} receiveShadow>
            <boxGeometry args={[span + 40, 1, 6]} />
            <meshStandardMaterial color={look.wallDark} roughness={0.9} />
         </mesh>
         <mesh position={[span / 2, 5, -DEPTH / 2 - 4]}>
            <boxGeometry args={[span + 60, 30, 1]} />
            <meshStandardMaterial color={look.background} roughness={1} />
         </mesh>
         {/* the gaps between rooms: timber posts so the hall reads as one workshop */}
         {world.rooms.slice(0, -1).map((_, k) => (
            <mesh key={k} position={[roomX(k) + 24 + (ROOM_GAP - 24) / 2, 5, 0]}>
               <boxGeometry args={[ROOM_GAP - 24, 10, DEPTH]} />
               <meshStandardMaterial color={look.wallDark} roughness={0.85} />
            </mesh>
         ))}
         <instancedMesh ref={snow} args={[undefined, undefined, FLAKES]} frustumCulled={false}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial color={look.snow} transparent opacity={0.7} />
         </instancedMesh>
         <hemisphereLight args={[look.light, look.wallDark, look.ambient]} />
         <directionalLight position={[10, 20, 18]} intensity={world.level === 5 ? 0.5 : 0.9} color={look.light} />
         <ambientLight intensity={look.ambient * 0.4} />
      </>
   );
}
