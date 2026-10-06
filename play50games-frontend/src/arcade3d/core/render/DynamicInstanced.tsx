"use client";

// Moving instanced props: a fixed pool of copies whose matrices are rewritten every frame (coins,
// obstacles, vehicles), one draw call per mesh for the whole pool.
//
//    const place = (i: number, m: Matrix4) => {                 // called for every copy, every frame
//       const car = run.cars[i];
//       if (!car.active) return false;                            // hide an unused pool slot
//       m.makeTranslation(car.x, 0, car.z);
//    };
//    <DynamicInstanced count={run.cars.length} update={place}>  // one mesh: children = geometry + material
//       <boxGeometry args={[1.8, 1, 0.9]} />
//       <meshStandardMaterial color="#ef4444" />
//    </DynamicInstanced>
//    <DynamicInstanced count={24} update={place} parts={deskParts} />   // several meshes / pieces per copy
//
// - `update` runs in a FRAME_PRIORITY.visuals useFrame (after useRunFrame and the camera), so it
//   draws this frame's state. It may be a new function every render (kept in a ref).
// - Copies are not frustum culled (a moving pool has no fixed bounds); hidden copies are not drawn.
// - `parts` belong to the caller (build them once, dispose of what you created); children are
//   disposed by R3F as usual.
// - A prop that may become a GLB uses <DynamicInstancedModel> (core/assets.tsx), which draws the GLB's
//   meshes with the same `update`.
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { DynamicDrawUsage, InstancedMesh, Matrix4, type Color } from "three";
import { FRAME_PRIORITY } from "../frameLoop";
import { piecesOf, writeDynamicInstances, type InstancePart, type InstanceTarget, type InstanceUpdate } from "./dynamicInstances";

export interface DynamicInstancedProps {
   /** the most copies drawn at once (the pool size); keep it fixed (a change rebuilds the meshes) */
   count: number;
   /** where copy `index` stands this frame (write `matrix`), or false to hide it (core/render/dynamicInstances.ts) */
   update: InstanceUpdate;
   /** the meshes: one InstancedMesh per part, each drawing its pieces for every copy. Keep the array stable. */
   parts?: readonly InstancePart[];
   /** without `parts`: the geometry and material(s) of the one InstancedMesh */
   children?: ReactNode;
   name?: string;
}

/**
 * Frees a pool mesh's instance buffers (the renderer drops them on its "dispose" event). R3F's
 * dispose={null} prop sets mesh.dispose = null to keep the shared geometry and material, so the
 * method is called from the prototype: mesh.dispose() would throw on unmount (every Retry).
 */
export function releaseInstanceBuffers(mesh: InstancedMesh): void {
   InstancedMesh.prototype.dispose.call(mesh);
}

/** Ready for per-frame writes: nothing drawn before the first frame, a dynamic buffer, piece colours. */
function prepare(mesh: InstancedMesh, capacity: number, pieces: number, colors: readonly Color[] | null | undefined): void {
   mesh.count = 0;
   mesh.instanceMatrix.setUsage(DynamicDrawUsage);
   if (colors && colors.length > 0) {
      for (let k = 0; k < capacity; k++) for (let j = 0; j < pieces; j++) mesh.setColorAt(k * pieces + j, colors[j % colors.length]);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
   }
}

function PartMesh({ part, target, capacity }: { part: InstancePart; target: InstanceTarget; capacity: number }) {
   const ref = useRef<InstancedMesh>(null);
   const pieces = piecesOf(part.locals);
   useLayoutEffect(() => {
      const mesh = ref.current;
      if (!mesh) return;
      prepare(mesh, capacity, pieces, part.colors);
      target.mesh = mesh;
      return () => {
         if (target.mesh === mesh) target.mesh = null;
         // frees the instance buffers; the geometry and material belong to the caller (dispose={null})
         releaseInstanceBuffers(mesh);
      };
   }, [part, target, capacity, pieces]);
   return (
      <instancedMesh
         ref={ref}
         args={[part.geometry, part.material, Math.max(1, capacity * pieces)]}
         frustumCulled={false}
         dispose={null}
      />
   );
}

function ChildrenMesh({ target, capacity, name, children }: { target: InstanceTarget; capacity: number; name?: string; children?: ReactNode }) {
   const ref = useRef<InstancedMesh>(null);
   useLayoutEffect(() => {
      const mesh = ref.current;
      if (!mesh) return;
      prepare(mesh, capacity, 1, null);
      target.mesh = mesh;
      return () => {
         if (target.mesh === mesh) target.mesh = null;
      };
   }, [target, capacity]);
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, capacity)]} frustumCulled={false} name={name}>
         {children}
      </instancedMesh>
   );
}

/** A pool of `count` moving copies; `update` places (or hides) each one every frame. */
export function DynamicInstanced({ count, update, parts, children, name }: DynamicInstancedProps) {
   const updateRef = useRef(update);
   updateRef.current = update;
   const capacity = count > 0 ? Math.floor(count) : 0;
   const targets = useMemo<InstanceTarget[]>(
      () => (parts ? parts.map((part) => ({ mesh: null, locals: part.locals ?? null })) : [{ mesh: null, locals: null }]),
      [parts]
   );
   const [scratch] = useState(() => ({ matrix: new Matrix4(), piece: new Matrix4() }));

   // after useRunFrame and the camera: every copy is drawn where the simulation left it this frame
   useFrame(() => {
      writeDynamicInstances(targets, capacity, updateRef.current, scratch.matrix, scratch.piece);
   }, FRAME_PRIORITY.visuals);

   if (!parts) {
      return (
         <ChildrenMesh target={targets[0]} capacity={capacity} name={name}>
            {children}
         </ChildrenMesh>
      );
   }
   return (
      <group name={name}>
         {parts.map((part, i) => (
            <PartMesh key={i} part={part} target={targets[i]} capacity={capacity} />
         ))}
      </group>
   );
}
