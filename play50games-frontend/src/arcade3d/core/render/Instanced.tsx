"use client";

// One InstancedMesh (one draw call) for every copy of a repeated primitive. The children are its
// geometry and material(s):
//
//    <Instanced spots={BARREL_SPOTS}>
//       <cylinderGeometry args={[0.4, 0.4, 1, 20]} />
//       <meshStandardMaterial color="#2f6fe4" />
//    </Instanced>
//
// Keep `spots` stable (module level or memoised). For a prop that may become a GLB, pass this as
// <InstancedModel fallback> (core/assets.tsx), so the GLB is instanced too once it exists.
import { useRef, type ReactNode } from "react";
import type { InstancedMesh } from "three";
import { useInstanceMatrices, type InstanceSpot } from "./useInstanceMatrices";

export interface InstancedProps {
   spots: readonly InstanceSpot[];
   /** the geometry and material(s) */
   children: ReactNode;
   name?: string;
}

export function Instanced({ spots, children, name }: InstancedProps) {
   const mesh = useRef<InstancedMesh>(null);
   useInstanceMatrices(mesh, spots);
   return (
      <instancedMesh ref={mesh} args={[undefined, undefined, spots.length]} name={name}>
         {children}
      </instancedMesh>
   );
}
