"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Group, Mesh } from "three";
import { JIB_Y } from "./rules";
import type { Run } from "./rules";
import { cableGeo, hookGeo, hookMat, jibGeo, jibMat, mastGeo, steel } from "./Primitives";

const UP = new Vector3(0, 1, 0);
const A = new Vector3();
const B = new Vector3();
const DIR = new Vector3();

const MAST: ReadonlyArray<readonly [number, number, number]> = [
   [-0.22, 5, -0.22],
   [0.22, 5, -0.22],
   [-0.22, 5, 0.22],
   [0.22, 5, 0.22],
];

/** Mast, rotating jib, cable and the 1.2 m hook block above the bob. */
export function Crane({ run }: { run: Run }) {
   const jib = useRef<Group>(null);
   const cable = useRef<Mesh>(null);
   const hook = useRef<Mesh>(null);

   useFrame(() => {
      const arm = jib.current;
      if (arm) {
         arm.rotation.y = -run.angle;
         arm.position.set(0, JIB_Y, 0);
      }
      const trolleyZ = run.radius;
      A.set(trolleyZ * Math.sin(run.angle), JIB_Y, trolleyZ * Math.cos(run.angle));
      B.set(run.hookX, run.hookY, run.hookZ);
      const line = cable.current;
      if (line) {
         line.position.copy(A).add(B).multiplyScalar(0.5);
         DIR.copy(B).sub(A);
         const len = DIR.length() || 1;
         line.scale.y = len;
         DIR.multiplyScalar(1 / len);
         line.quaternion.setFromUnitVectors(UP, DIR);
      }
      const block = hook.current;
      if (block) block.position.set(run.hookX, run.hookY + 0.6, run.hookZ);
   });

   return (
      <group>
         {MAST.map((p, i) => (
            <mesh key={i} geometry={mastGeo} material={steel} position={[p[0], p[1], p[2]]} scale={[1, 10, 1]} dispose={null} />
         ))}
         <group ref={jib}>
            <mesh geometry={jibGeo} material={jibMat} position={[0, 0, 5]} scale={[1, 1, 10]} dispose={null} />
            <mesh geometry={mastGeo} material={steel} position={[0, -0.15, 0]} scale={[1.4, 0.4, 1.4]} dispose={null} />
         </group>
         <mesh ref={cable} geometry={cableGeo} material={steel} dispose={null} />
         <mesh ref={hook} geometry={hookGeo} material={hookMat} dispose={null} />
      </group>
   );
}
