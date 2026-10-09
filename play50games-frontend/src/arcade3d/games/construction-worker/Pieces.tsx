"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Quaternion, Vector3 } from "three";
import type { Mesh } from "three";
import { DynamicInstanced } from "@/arcade3d/core/render/DynamicInstanced";
import { FLOOR, PLAN, SLOT_A, SLOT_R, type Run } from "./rules";
import {
   GUIDE_COLOR, KIND_COLOR, KIND_SCALE, blobGeo, flashMat, guideMat, pieceGeo, pieceMat, ringGeo, slotMat,
} from "./Primitives";

const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();
const slot = { x: 0, z: 0 };

function slotXZ(index: number): { x: number; z: number } {
   slot.x = SLOT_R * Math.sin(SLOT_A[index] ?? 0);
   slot.z = SLOT_R * Math.cos(SLOT_A[index] ?? 0);
   return slot;
}

/** Placed floors, the piece on the hook, the landing guide and the glowing slot. */
export function Pieces({ run }: { run: Run }) {
   const parts = useMemo(() => [{ geometry: pieceGeo, material: pieceMat }], []);
   const carried = useRef<Mesh>(null);
   const guide = useRef<Mesh>(null);
   const blob = useRef<Mesh>(null);
   const ring = useRef<Mesh>(null);
   const flash = useRef<Mesh>(null);

   useFrame(() => {
      const step = PLAN[run.planIndex];
      const mesh = carried.current;
      if (mesh) {
         if (run.carried < 0) mesh.visible = false;
         else {
            mesh.visible = true;
            const size = KIND_SCALE[run.carried];
            mesh.scale.set(size[0], size[1], size[2]);
            mesh.position.set(run.hookX, run.hookY - size[1] / 2, run.hookZ);
            const mat = mesh.material;
            if (!Array.isArray(mat) && mat && "color" in mat) (mat as { color: Color }).color.copy(KIND_COLOR[run.carried]);
         }
      }
      const show = !!step && run.carried >= 0;
      const top = step ? step.floor * FLOOR : 0;
      const xz = step ? slotXZ(step.slot) : slot;
      const g = guide.current;
      if (g) {
         g.visible = show;
         g.position.set(run.landX, top + 0.09, run.landZ);
         guideMat.color.copy(GUIDE_COLOR[run.guide] ?? GUIDE_COLOR[0]);
      }
      const b = blob.current;
      if (b) {
         b.visible = show;
         b.position.set(run.hookX, top + 0.05, run.hookZ);
      }
      const r = ring.current;
      if (r && step) r.position.set(xz.x, top + 0.07, xz.z);
      const f = flash.current;
      if (f) {
         const where = slotXZ(run.flashSlot);
         f.position.set(where.x, 0.08, where.z);
         flashMat.opacity = run.flash > 0 ? Math.min(0.85, run.flash * 2) : 0;
      }
   });

   return (
      <group>
         <DynamicInstanced count={16} tinted parts={parts} update={(index, matrix, color) => {
               const piece = run.pieces[index];
               if (!piece?.on) return false;
               const size = KIND_SCALE[piece.kind];
               const at = slotXZ(piece.slot);
               pos.set(at.x, piece.floor * FLOOR + size[1] / 2, at.z);
               scl.set(size[0], size[1], size[2]);
               matrix.compose(pos, quat, scl);
               color.copy(KIND_COLOR[piece.kind]);
            }}
         />
         <mesh ref={carried} geometry={pieceGeo} dispose={null}>
            <meshStandardMaterial color="#ffffff" roughness={0.7} />
         </mesh>
         <mesh ref={ring} geometry={ringGeo} material={slotMat} rotation-x={-Math.PI / 2} dispose={null} />
         <mesh ref={guide} geometry={ringGeo} material={guideMat} rotation-x={-Math.PI / 2} dispose={null} />
         <mesh ref={blob} geometry={blobGeo} material={guideMat} rotation-x={-Math.PI / 2} dispose={null} />
         <mesh ref={flash} geometry={ringGeo} material={flashMat} rotation-x={-Math.PI / 2} dispose={null} />
      </group>
   );
}
