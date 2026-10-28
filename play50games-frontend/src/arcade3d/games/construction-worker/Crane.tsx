"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Group, Mesh } from "three";
import { Model } from "@/arcade3d/core/assets";
import { ASSETS, JIB_DRAWN } from "./assets";
import { JIB_Y } from "./rules";
import type { Run } from "./rules";
import {
   cableGeo,
   craneLatticeMat,
   hookGeo,
   hookMat,
   jibGeo,
   jibMat,
   mastGeo,
   steel,
   trolleyGeo,
   trolleyMat,
} from "./Primitives";

const UP = new Vector3(0, 1, 0);
const A = new Vector3();
const B = new Vector3();
const DIR = new Vector3();

/**
 * Tower crane: yellow lattice mast, rotating truss jib with counterweight and cab,
 * traveling trolley carriage, steel hoist cable, and authentic pulley hook block.
 */
export function Crane({ run }: { run: Run }) {
   const jib = useRef<Group>(null);
   const cable = useRef<Mesh>(null);
   const hook = useRef<Group>(null);
   const trolley = useRef<Mesh>(null);

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
      if (block) block.position.set(run.hookX, run.hookY, run.hookZ);

      const car = trolley.current;
      if (car) car.position.set(0, -0.05, trolleyZ);
   });

   return (
      <group name="construction-crane">
         <mesh geometry={mastGeo} material={craneLatticeMat} dispose={null} name="crane-mast" />
         <group ref={jib} name="crane-jib-group">
            {/* Hyper3D lattice jib (centre of its z span at the code jib's); the code truss is the fallback */}
            <group position={[0, JIB_DRAWN.yMin, JIB_DRAWN.zMin + JIB_DRAWN.length / 2]}>
               <Model asset={ASSETS.craneJib} fallback={<mesh geometry={jibGeo} material={jibMat} dispose={null} name="crane-jib" position={[0, -JIB_DRAWN.yMin, -(JIB_DRAWN.zMin + JIB_DRAWN.length / 2)]} />} />
            </group>
            <mesh ref={trolley} geometry={trolleyGeo} material={trolleyMat} dispose={null} name="crane-trolley" />
         </group>
         <mesh ref={cable} geometry={cableGeo} material={steel} dispose={null} name="crane-cable" />
         <group ref={hook} name="crane-hook">
            <Model asset={ASSETS.craneHook} fallback={<mesh geometry={hookGeo} material={hookMat} dispose={null} position-y={0.6} />} />
         </group>
      </group>
   );
}
