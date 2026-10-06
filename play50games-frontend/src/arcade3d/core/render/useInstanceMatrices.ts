"use client";

// Static instancing: one InstancedMesh (one draw call) for every copy of a repeated prop.
//
//    <Instanced spots={CRATE_SPOTS}><boxGeometry /><meshStandardMaterial /></Instanced>   // core/render
//
// or by hand:
//
//    const mesh = useRef<InstancedMesh>(null);
//    useInstanceMatrices(mesh, CRATE_SPOTS);   // a module-level constant (or memoised) array
//    <instancedMesh ref={mesh} args={[undefined, undefined, CRATE_SPOTS.length]}>…</instancedMesh>
//
// Writes the matrices once, before the first frame, and again only when `spots` changes.
// For things that move every frame, use <DynamicInstanced> (core/render) or, for a prop that may
// become a GLB, <DynamicInstancedModel> (core/assets.tsx).
// A static prop that may become a GLB uses <InstancedModel> (core/assets.tsx) instead.
import { useLayoutEffect, type RefObject } from "react";
import { Euler, Matrix4, Quaternion, Vector3, type InstancedMesh } from "three";

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

const scratch = { position: new Vector3(), rotation: new Euler(), quaternion: new Quaternion(), scale: new Vector3() };

/** The matrix of one spot (translate, turn around +y, scale), written into `out`. */
export function spotMatrix(spot: InstanceSpot, out: Matrix4 = new Matrix4()): Matrix4 {
   const s = spot.scale ?? 1;
   scratch.position.set(spot.x, spot.y, spot.z);
   scratch.quaternion.setFromEuler(scratch.rotation.set(0, spot.rotY ?? 0, 0));
   scratch.scale.set(spot.sx ?? s, spot.sy ?? s, spot.sz ?? s);
   return out.compose(scratch.position, scratch.quaternion, scratch.scale);
}

/**
 * Writes one matrix per spot into the mesh. `local` (optional) is applied inside each spot, e.g.
 * a GLB mesh's own transform (InstancedModel).
 */
export function useInstanceMatrices(ref: RefObject<InstancedMesh>, spots: readonly InstanceSpot[], local?: Matrix4): void {
   useLayoutEffect(() => {
      const mesh = ref.current;
      if (!mesh) return;
      const m = new Matrix4();
      spots.forEach((spot, i) => {
         spotMatrix(spot, m);
         if (local) m.multiply(local);
         mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
   }, [ref, spots, local]);
}
