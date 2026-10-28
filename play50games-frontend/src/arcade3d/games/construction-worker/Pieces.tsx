"use client";

import { useMemo, useRef } from "react";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, LineDashedMaterial, Line, Color, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import type { Group, Mesh } from "three";
import { DynamicInstanced } from "@/arcade3d/core/render/DynamicInstanced";
import { BlobShadow } from "@/arcade3d/core/render/BlobShadow";
import { landingMarker, markerColor, shadowTop, VISUAL_EXTENSION } from "./dropGuide";
import { PIECE_ASSETS } from "./assets";
import { cableGeo, steel } from "./Primitives";
import { FLOOR, PLAN, SLOT_A, SLOT_R, type Run } from "./rules";
import {
   flashMat,
   guideMat,
   KIND_COLOR,
   KIND_SCALE,
   pieceGeo,
   pieceMat,
   ringGeo,
   slotMat,
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

const MODEL_KINDS = [0, 1, 2, 3] as const;

/** Placed floors, the piece on the hook, the landing guide and the glowing slot. */
export function Pieces({ run }: { run: Run }) {
   const parts = useMemo(() => [{ geometry: pieceGeo, material: pieceMat }], []);
   // stand-ins for the four GLB piece kinds: the coloured rounded box at the piece's size, feet on the origin
   const standIns = useMemo(
      () =>
         MODEL_KINDS.map((kind) => {
            const size = KIND_SCALE[kind];
            const material = new MeshStandardMaterial({ color: KIND_COLOR[kind], roughness: 0.65 });
            return [{ geometry: pieceGeo, material, locals: [new Matrix4().compose(new Vector3(0, size[1] / 2, 0), new Quaternion(), new Vector3(size[0], size[1], size[2]))] }];
         }),
      []
   );
   const carriedModels = useRef<(Group | null)[]>([]);
   const carried = useRef<Mesh>(null);
   const guide = useRef<Mesh>(null);
   const blob = useRef<Group>(null);
   const extension = useRef<Mesh>(null);
   const marker = useRef({ x: 0, y: 0, z: 0 });
   const shadowAt = useRef({ x: 0, z: 0 });
   const [dash] = useMemo(() => {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));
      const line = new Line(geometry, new LineDashedMaterial({ color: "#ffffff", dashSize: 0.12, gapSize: 0.09, transparent: true, opacity: 0.75, depthWrite: false }));
      geometry.setAttribute("lineDistance", new Float32BufferAttribute([0, 1], 1));
      return [line];
   }, []);
   const ring = useRef<Mesh>(null);
   const flash = useRef<Mesh>(null);

   useFrame(() => {
      const step = PLAN[run.planIndex];
      for (const kind of MODEL_KINDS) {
         const g = carriedModels.current[kind];
         if (!g) continue;
         g.visible = run.carried === kind;
         if (g.visible) g.position.set(run.hookX, run.hookY - VISUAL_EXTENSION - KIND_SCALE[kind][1], run.hookZ);
      }
      const mesh = carried.current;
      if (mesh) {
         if (run.carried !== 4) mesh.visible = false;
         else {
            mesh.visible = true;
            const size = KIND_SCALE[run.carried];
            mesh.scale.set(size[0], size[1], size[2]);
            mesh.position.set(run.hookX, run.hookY - VISUAL_EXTENSION - size[1] / 2, run.hookZ);
            const mat = mesh.material;
            if (!Array.isArray(mat) && mat && "color" in mat) {
               (mat as { color: Color }).color.copy(KIND_COLOR[run.carried]);
            }
         }
      }
      const show = !!step && run.carried >= 0;
      const top = step ? step.floor * FLOOR : 0;
      const xz = step ? slotXZ(step.slot) : slot;
      const rating = landingMarker(run, marker.current);
      const end = marker.current;
      const e = extension.current;
      if (e) {
         e.visible = show;
         e.position.set(run.hookX, run.hookY - VISUAL_EXTENSION / 2, run.hookZ);
      }
      dash.visible = show;
      if (show) {
         const positions = dash.geometry.attributes.position;
         positions.setXYZ(0, run.hookX, run.hookY - VISUAL_EXTENSION, run.hookZ);
         positions.setXYZ(1, end.x, end.y, end.z);
         positions.needsUpdate = true;
         const distances = dash.geometry.attributes.lineDistance;
         distances.setX(1, Math.hypot(end.x - run.hookX, end.y - run.hookY + VISUAL_EXTENSION, end.z - run.hookZ));
         distances.needsUpdate = true;
         dash.material.color.set(markerColor(rating));
      }
      const g = guide.current;
      if (g) {
         g.visible = show;
         g.position.set(end.x, end.y, end.z);
         guideMat.color.set(markerColor(rating));
      }
      const b = blob.current;
      if (b) {
         b.visible = run.phase === "play";
         const surface = shadowTop(run, shadowAt.current);
         b.position.set(run.hookX, surface + 0.035, run.hookZ);
         b.scale.setScalar(1 + Math.max(0, run.hookY - surface) * 0.035);
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
      <group name="construction-pieces">
         {MODEL_KINDS.map((kind) => (
            <DynamicInstancedModel
               key={kind}
               asset={PIECE_ASSETS[kind]}
               count={16}
               name={`placed-pieces-${kind}`}
               fallbackParts={standIns[kind]}
               update={(index, matrix) => {
                  const piece = run.pieces[index];
                  if (!piece?.on || piece.kind !== kind) return false;
                  const at = slotXZ(piece.slot);
                  pos.set(at.x, piece.floor * FLOOR, at.z);
                  scl.set(1, 1, 1);
                  matrix.compose(pos, quat, scl);
               }}
            />
         ))}
         <DynamicInstanced
            count={16}
            tinted
            parts={parts}
            name="placed-pieces"
            update={(index, matrix, color) => {
               const piece = run.pieces[index];
               if (!piece?.on || piece.kind !== 4) return false;
               const size = KIND_SCALE[piece.kind];
               const at = slotXZ(piece.slot);
               pos.set(at.x, piece.floor * FLOOR + size[1] / 2, at.z);
               scl.set(size[0], size[1], size[2]);
               matrix.compose(pos, quat, scl);
               color.copy(KIND_COLOR[piece.kind]);
            }}
         />
         <mesh ref={carried} geometry={pieceGeo} dispose={null} name="carried-piece">
            <meshStandardMaterial color="#ffffff" roughness={0.65} />
         </mesh>
         {MODEL_KINDS.map((kind) => (
            <group key={kind} ref={(el) => { carriedModels.current[kind] = el; }} visible={false} name={`carried-piece-${kind}`}>
               <Model
                  asset={PIECE_ASSETS[kind]}
                  fallback={
                     <mesh geometry={pieceGeo} dispose={null} position-y={KIND_SCALE[kind][1] / 2} scale={[KIND_SCALE[kind][0], KIND_SCALE[kind][1], KIND_SCALE[kind][2]]}>
                        <meshStandardMaterial color={KIND_COLOR[kind]} roughness={0.65} />
                     </mesh>
                  }
               />
            </group>
         ))}
         <mesh ref={ring} geometry={ringGeo} material={slotMat} rotation-x={-Math.PI / 2} dispose={null} name="slot-ring" />
         <mesh ref={guide} geometry={ringGeo} material={guideMat} rotation-x={-Math.PI / 2} dispose={null} name="guide-ring" />
         <group ref={blob} name="hook-shadow">
            <BlobShadow radius={0.5} opacity={0.16} />
            <BlobShadow radius={0.4} opacity={0.16} y={0.014} />
            <BlobShadow radius={0.3} opacity={0.16} y={0.016} />
         </group>
         <mesh ref={extension} geometry={cableGeo} material={steel} scale-y={VISUAL_EXTENSION} dispose={null} name="visual-extension-cable" />
         <primitive object={dash} frustumCulled={false} name="landing-dashed-guide" />
         <mesh ref={flash} geometry={ringGeo} material={flashMat} rotation-x={-Math.PI / 2} dispose={null} name="miss-flash" />
      </group>
   );
}
