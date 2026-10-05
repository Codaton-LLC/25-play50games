"use client";

// Static instancing: one InstancedMesh (one draw call) for every copy of a repeated prop.
//
//    const mesh = useRef<InstancedMesh>(null);
//    useInstanceMatrices(mesh, CRATE_SPOTS);   // a module-level constant (or memoised) array
//    <instancedMesh ref={mesh} args={[undefined, undefined, CRATE_SPOTS.length]}>…</instancedMesh>
//
// Writes the matrices once, before the first frame, and again only when `spots` changes.
// For things that move every frame, set matrices yourself in useFrame instead.
import { useLayoutEffect, type RefObject } from "react";
import { Object3D, type InstancedMesh } from "three";

/** Where one instance sits: position, optional turn around +y, uniform or per-axis scale. */
export interface InstanceSpot {
   x: number;
   y: number;
   z: number;
   rotY?: number;
   /** uniform scale, or per axis with sx/sy/sz */
   scale?: number;
   sx?: number;
   sy?: number;
   sz?: number;
}

export function useInstanceMatrices(ref: RefObject<InstancedMesh>, spots: readonly InstanceSpot[]): void {
   useLayoutEffect(() => {
      const mesh = ref.current;
      if (!mesh) return;
      const o = new Object3D();
      spots.forEach((spot, i) => {
         o.position.set(spot.x, spot.y, spot.z);
         o.rotation.set(0, spot.rotY ?? 0, 0);
         const s = spot.scale ?? 1;
         o.scale.set(spot.sx ?? s, spot.sy ?? s, spot.sz ?? s);
         o.updateMatrix();
         mesh.setMatrixAt(i, o.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
   }, [ref, spots]);
}
