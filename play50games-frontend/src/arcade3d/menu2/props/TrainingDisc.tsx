"use client";

// Solid jade training disc, face in XY, spin axis Z. Two batches, shared geometry.
import { useEffect, useMemo } from "react";
import { CylinderGeometry, MeshStandardMaterial, TorusGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const TRAINING_DISC_SIZE = { w: 0.5, h: 0.5, d: 0.08 } as const;

function merge(parts: BufferGeometry[]): BufferGeometry {
   const flat = parts.map((part) => part.index ? part.toNonIndexed() : part);
   const result = mergeGeometries(flat);
   flat.forEach((part) => part.dispose());
   parts.forEach((part) => part.dispose());
   if (!result) throw new Error("training disc: merge failed");
   return result;
}

/** Closed central body with a smooth, thicker protective rim, symmetric on both faces. */
export function buildTrainingDiscGeometry(): BufferGeometry {
   const body = new CylinderGeometry(0.225, 0.225, 0.042, 32);
   body.rotateX(Math.PI / 2);
   const rim = new TorusGeometry(0.21, 0.04, 8, 32);
   return merge([body, rim]);
}

/** Bronze inlay and twelve shallow rune marks repeated on BOTH faces for balanced throws. */
export function buildTrainingDiscInlayGeometry(): BufferGeometry {
   const parts: BufferGeometry[] = [];
   for (const side of [-1, 1]) {
      const ring = new TorusGeometry(0.172, 0.006, 4, 24);
      ring.translate(0, 0, side * 0.022);
      parts.push(ring);
      const rim = new TorusGeometry(0.228, 0.005, 4, 24);
      rim.translate(0, 0, side * 0.032);
      parts.push(rim);
      for (let i = 0; i < 12; i++) {
         const angle = i * Math.PI / 6;
         const rune = new TorusGeometry(0.017, 0.003, 3, 4, Math.PI);
         rune.rotateZ(angle);
         rune.translate(Math.cos(angle) * 0.125, Math.sin(angle) * 0.125, side * 0.023);
         parts.push(rune);
      }
   }
   return merge(parts);
}

let shared: { body: BufferGeometry; inlay: BufferGeometry } | undefined;
export function getSharedTrainingDiscGeometry() {
   return shared ??= { body: buildTrainingDiscGeometry(), inlay: buildTrainingDiscInlayGeometry() };
}
const JADE = new MeshStandardMaterial({ color: "#278f76", roughness: 0.48, metalness: 0.08 });

export interface TrainingDiscProps {
   color?: string;
   /** Bronze rim/rune emission, clamped to 0..1. Default 0. */
   glow?: number;
}

/** Parent owns throwing/spin transforms; this prop deliberately has no autonomous rotation. */
export function TrainingDisc({ color, glow = 0 }: TrainingDiscProps) {
   const geometry = getSharedTrainingDiscGeometry();
   const body = useMemo(() => color ? new MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.08 }) : JADE, [color]);
   const inlay = useMemo(() => new MeshStandardMaterial({ color: "#c49a50", roughness: 0.4, metalness: 0.72, emissive: "#ffbe62" }), []);
   useEffect(() => () => { if (body !== JADE) body.dispose(); }, [body]);
   useEffect(() => () => inlay.dispose(), [inlay]);
   useEffect(() => { inlay.emissiveIntensity = Math.max(0, Math.min(1, glow)) * 1.5; }, [inlay, glow]);
   return (
      <group name="training-disc" dispose={null}>
         <mesh geometry={geometry.body} material={body} castShadow receiveShadow />
         <mesh geometry={geometry.inlay} material={inlay} />
      </group>
   );
}
