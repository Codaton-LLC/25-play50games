"use client";

// Per-level scenery for knight-arena (looks.ts): code-built, bevelled low-poly props outside the
// fence, drawn as three static instanced batches (unit box / cylinder / cone, tinted per part with
// instanceColor, like ArenaBanners) plus one instanced canvas tent and one animated flame batch.
// A level mounts once (Scene keys on the level id), so every batch composes its matrices once.
import type React from "react";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   Color,
   ConeGeometry,
   ExtrudeGeometry,
   type InstancedMesh,
   Matrix4,
   Quaternion,
   Shape,
   Vector3,
   Euler,
} from "three";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { COLORS } from "./rules";
import type { DecorKind, DecorSpot, KnightLook } from "./looks";

interface Part {
   shape: "box" | "cylinder" | "cone";
   pos: readonly [number, number, number];
   rot?: readonly [number, number, number];
   /** box: (w, h, d); cylinder/cone: (diameter, height, diameter) */
   size: readonly [number, number, number];
   color: string;
}

/** Local-space parts per prop kind. Unit geometries: box 1³, cylinder/cone radius 0.5 height 1. */
function partsFor(kind: DecorKind, banner: string): Part[] {
   const wood = COLORS.wood;
   const woodLight = COLORS.woodLight;
   const steelDark = COLORS.steelDark;
   const steel = COLORS.steel;
   const gold = COLORS.gold;
   const stone = COLORS.stone;
   switch (kind) {
      case "hayBale":
         return [
            { shape: "cylinder", pos: [0, 0.42, 0], rot: [0, 0, Math.PI / 2], size: [0.84, 0.85, 0.84], color: "#d9b45c" },
            { shape: "box", pos: [-0.2, 0.42, 0], size: [0.05, 0.8, 0.8], color: "#a8813c" },
            { shape: "box", pos: [0.2, 0.42, 0], size: [0.05, 0.8, 0.8], color: "#a8813c" },
         ];
      case "tent":
         return [];
      case "spearRack": {
         const parts: Part[] = [
            { shape: "cylinder", pos: [0, 0.82, 0], rot: [0, 0, Math.PI / 2], size: [0.07, 0.95, 0.07], color: wood },
            { shape: "cylinder", pos: [-0.42, 0.36, 0], rot: [0, 0, 0.32], size: [0.08, 0.8, 0.08], color: wood },
            { shape: "cylinder", pos: [0.42, 0.36, 0], rot: [0, 0, -0.32], size: [0.08, 0.8, 0.08], color: wood },
            { shape: "cylinder", pos: [-0.42, 0.36, 0.28], rot: [0.32, 0, 0.32], size: [0.08, 0.8, 0.08], color: wood },
            { shape: "cylinder", pos: [0.42, 0.36, 0.28], rot: [0.32, 0, -0.32], size: [0.08, 0.8, 0.08], color: wood },
         ];
         for (const x of [-0.26, 0, 0.26]) {
            parts.push(
               { shape: "cylinder", pos: [x, 1.05, 0.16], rot: [0.38, 0, 0], size: [0.045, 2.1, 0.045], color: steel },
               { shape: "cone", pos: [x, 2.0, 0.52], rot: [0.38, 0, 0], size: [0.1, 0.22, 0.1], color: steelDark },
            );
         }
         return parts;
      }
      case "roundel":
         return [
            { shape: "cylinder", pos: [0, 0.55, 0], size: [0.09, 1.1, 0.09], color: wood },
            { shape: "cylinder", pos: [0, 1.28, 0], rot: [Math.PI / 2, 0, 0], size: [0.82, 0.07, 0.82], color: "#f8fafc" },
            { shape: "cylinder", pos: [0, 1.28, 0.05], rot: [Math.PI / 2, 0, 0], size: [0.36, 0.08, 0.36], color: COLORS.tomato },
         ];
      case "torch":
         return [
            { shape: "cylinder", pos: [0, 0.8, 0], size: [0.1, 1.6, 0.1], color: wood },
            { shape: "cylinder", pos: [0, 1.66, 0], size: [0.24, 0.14, 0.24], color: steelDark },
         ];
      case "hourglass":
         return [
            { shape: "cylinder", pos: [0, 0.06, 0], size: [0.9, 0.12, 0.9], color: wood },
            { shape: "cylinder", pos: [0, 1.78, 0], size: [0.9, 0.12, 0.9], color: wood },
            { shape: "cylinder", pos: [-0.34, 0.92, -0.34], size: [0.08, 1.84, 0.08], color: wood },
            { shape: "cylinder", pos: [0.34, 0.92, -0.34], size: [0.08, 1.84, 0.08], color: wood },
            { shape: "cylinder", pos: [-0.34, 0.92, 0.34], size: [0.08, 1.84, 0.08], color: wood },
            { shape: "cylinder", pos: [0.34, 0.92, 0.34], size: [0.08, 1.84, 0.08], color: wood },
            { shape: "cone", pos: [0, 0.92, 0], rot: [Math.PI, 0, 0], size: [0.56, 0.72, 0.56], color: "#93c5fd" },
            { shape: "cone", pos: [0, 0.2, 0], size: [0.56, 0.72, 0.56], color: "#93c5fd" },
            { shape: "cone", pos: [0, 0.22, 0], size: [0.3, 0.24, 0.3], color: gold },
         ];
      case "bannerPole":
         return [
            { shape: "cylinder", pos: [0, 1.6, 0], size: [0.12, 3.2, 0.12], color: wood },
            { shape: "cone", pos: [0, 3.32, 0], size: [0.2, 0.26, 0.2], color: gold },
            { shape: "box", pos: [0.31, 2.55, 0], size: [0.56, 0.95, 0.04], color: banner },
         ];
      case "brazier": {
         const parts: Part[] = [
            { shape: "cylinder", pos: [0, 0.55, 0], size: [0.66, 0.22, 0.66], color: steelDark },
            { shape: "cylinder", pos: [0, 0.63, 0], size: [0.74, 0.08, 0.74], color: steel },
         ];
         for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
            parts.push({
               shape: "cylinder",
               pos: [Math.cos(a) * 0.22, 0.26, Math.sin(a) * 0.22],
               rot: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3],
               size: [0.09, 0.56, 0.09],
               color: steelDark,
            });
         }
         return parts;
      }
      case "barrel":
         return [
            { shape: "cylinder", pos: [0, 0.44, 0], size: [0.68, 0.88, 0.68], color: wood },
            { shape: "cylinder", pos: [0, 0.2, 0], size: [0.72, 0.07, 0.72], color: steelDark },
            { shape: "cylinder", pos: [0, 0.68, 0], size: [0.72, 0.07, 0.72], color: steelDark },
         ];
      case "chest":
         return [
            { shape: "box", pos: [0, 0.25, 0], size: [0.72, 0.5, 0.48], color: wood },
            { shape: "box", pos: [0, 0.54, 0], size: [0.76, 0.14, 0.52], color: woodLight },
            { shape: "box", pos: [-0.22, 0.3, 0], size: [0.06, 0.52, 0.54], color: gold },
            { shape: "box", pos: [0.22, 0.3, 0], size: [0.06, 0.52, 0.54], color: gold },
         ];
      case "throne":
         return [
            { shape: "box", pos: [0, 0.07, 0.1], size: [2.7, 0.14, 2.3], color: stone },
            { shape: "box", pos: [0, 0.28, -0.05], size: [2.3, 0.28, 1.9], color: COLORS.stoneDark },
            { shape: "box", pos: [0, 0.72, -0.35], size: [0.95, 0.6, 0.8], color: COLORS.royalBlue },
            { shape: "box", pos: [0, 1.55, -0.7], size: [1.0, 1.75, 0.2], color: COLORS.royalBlue },
            { shape: "box", pos: [0, 2.62, -0.45], size: [1.7, 0.16, 1.4], color: gold },
            { shape: "cylinder", pos: [-0.75, 1.7, -0.95], size: [0.11, 1.9, 0.11], color: gold },
            { shape: "cylinder", pos: [0.75, 1.7, -0.95], size: [0.11, 1.9, 0.11], color: gold },
            { shape: "cone", pos: [0, 2.82, -0.45], size: [0.3, 0.3, 0.3], color: gold },
         ];
   }
}

/** Flame anchor (local y = flame base, w = width, h = height) for kinds that burn. */
function flameFor(kind: DecorKind): { y: number; w: number; h: number } | null {
   if (kind === "torch") return { y: 1.74, w: 0.3, h: 0.55 };
   if (kind === "brazier") return { y: 0.68, w: 0.5, h: 0.85 };
   return null;
}

interface BakedPart extends Part {
   spot: DecorSpot;
}

const scratchMat = new Matrix4();
const scratchLocal = new Matrix4();
const scratchPos = new Vector3();
const scratchQuat = new Quaternion();
const scratchEuler = new Euler();
const scratchScale = new Vector3();
const scratchColor = new Color();
const UP = new Vector3(0, 1, 0);

function composeInto(mesh: InstancedMesh, index: number, part: BakedPart): void {
   scratchQuat.setFromAxisAngle(UP, part.spot.rotY);
   scratchPos.set(part.spot.x, 0, part.spot.z);
   scratchScale.set(1, 1, 1);
   scratchMat.compose(scratchPos, scratchQuat, scratchScale);
   const [px, py, pz] = part.pos;
   const [rx, ry, rz] = part.rot ?? [0, 0, 0];
   scratchEuler.set(rx, ry, rz);
   scratchQuat.setFromEuler(scratchEuler);
   scratchPos.set(px, py, pz);
   scratchScale.set(part.size[0], part.size[1], part.size[2]);
   scratchLocal.compose(scratchPos, scratchQuat, scratchScale);
   scratchMat.multiply(scratchLocal);
   mesh.setMatrixAt(index, scratchMat);
   mesh.setColorAt(index, scratchColor.set(part.color));
}

function StaticBatch({ shape, parts }: { shape: Part["shape"]; parts: readonly BakedPart[] }): React.ReactElement | null {
   const ref = useRef<InstancedMesh>(null);
   useLayoutEffect(() => {
      const mesh = ref.current;
      if (!mesh) return;
      for (let i = 0; i < parts.length; i++) composeInto(mesh, i, parts[i]);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
   }, [parts]);
   if (parts.length === 0) return null;
   return (
      <instancedMesh
         key={`${shape}-${parts.length}`}
         ref={ref}
         args={[undefined, undefined, parts.length]}
         castShadow
         receiveShadow
      >
         {shape === "box" ? <boxGeometry args={[1, 1, 1]} /> : null}
         {shape === "cylinder" ? <cylinderGeometry args={[0.5, 0.5, 1, 10]} /> : null}
         {shape === "cone" ? <coneGeometry args={[0.5, 1, 10]} /> : null}
         <meshStandardMaterial roughness={0.8} metalness={0.1} />
      </instancedMesh>
   );
}

function Tents({ spots }: { spots: readonly DecorSpot[] }): React.ReactElement | null {
   const ref = useRef<InstancedMesh>(null);
   const geometry = useMemo(() => {
      const s = new Shape();
      s.moveTo(-1.05, 0);
      s.lineTo(1.05, 0);
      s.lineTo(0, 1.35);
      s.closePath();
      const g = new ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: false });
      g.translate(0, 0, -0.95);
      return g;
   }, []);
   useLayoutEffect(() => () => geometry.dispose(), [geometry]);
   useLayoutEffect(() => {
      const mesh = ref.current;
      if (!mesh) return;
      for (let i = 0; i < spots.length; i++) {
         scratchQuat.setFromAxisAngle(UP, spots[i].rotY);
         scratchPos.set(spots[i].x, 0, spots[i].z);
         scratchScale.set(1, 1, 1);
         scratchMat.compose(scratchPos, scratchQuat, scratchScale);
         mesh.setMatrixAt(i, scratchMat);
      }
      mesh.instanceMatrix.needsUpdate = true;
   }, [spots]);
   if (spots.length === 0) return null;
   return (
      <instancedMesh key={`tent-${spots.length}`} ref={ref} args={[geometry, undefined, spots.length]} castShadow>
         <meshStandardMaterial color="#e8dcc0" roughness={0.9} />
      </instancedMesh>
   );
}

interface FlameAnchor {
   x: number;
   y: number;
   z: number;
   w: number;
   h: number;
}

function Flames({ anchors }: { anchors: readonly FlameAnchor[] }): React.ReactElement | null {
   const ref = useRef<InstancedMesh>(null);
   const geometry = useMemo(() => {
      const g = new ConeGeometry(0.5, 1, 8);
      g.translate(0, 0.5, 0);
      return g;
   }, []);
   useLayoutEffect(() => () => geometry.dispose(), [geometry]);

   useFrame((state) => {
      const mesh = ref.current;
      if (!mesh) return;
      const t = state.clock.elapsedTime;
      for (let i = 0; i < anchors.length; i++) {
         const a = anchors[i];
         const flicker = 0.82 + 0.26 * Math.sin(t * 11 + i * 2.17) + 0.08 * Math.sin(t * 23 + i * 5.1);
         scratchPos.set(a.x, a.y, a.z);
         scratchQuat.identity();
         scratchScale.set(a.w * (1.15 - 0.15 * flicker), a.h * flicker, a.w * (1.15 - 0.15 * flicker));
         scratchMat.compose(scratchPos, scratchQuat, scratchScale);
         mesh.setMatrixAt(i, scratchMat);
      }
      mesh.instanceMatrix.needsUpdate = true;
   }, FRAME_PRIORITY.visuals);

   if (anchors.length === 0) return null;
   return (
      <instancedMesh key={`flame-${anchors.length}`} ref={ref} args={[geometry, undefined, anchors.length]}>
         <meshStandardMaterial
            color="#f97316"
            emissive="#fb923c"
            emissiveIntensity={2.2}
            roughness={0.6}
            toneMapped={false}
         />
      </instancedMesh>
   );
}

export function Decor({ look }: { look: KnightLook }): React.ReactElement {
   const { boxes, cylinders, cones, tents, flames } = useMemo(() => {
      const boxes: BakedPart[] = [];
      const cylinders: BakedPart[] = [];
      const cones: BakedPart[] = [];
      const tents: DecorSpot[] = [];
      const flames: FlameAnchor[] = [];
      for (const s of look.decor) {
         if (s.kind === "tent") {
            tents.push(s);
         } else {
            for (const part of partsFor(s.kind, look.banner)) {
               const baked: BakedPart = { ...part, spot: s };
               if (part.shape === "box") boxes.push(baked);
               else if (part.shape === "cylinder") cylinders.push(baked);
               else cones.push(baked);
            }
         }
         const flame = flameFor(s.kind);
         if (flame) {
            flames.push({ x: s.x, y: flame.y, z: s.z, w: flame.w, h: flame.h });
         }
      }
      return { boxes, cylinders, cones, tents, flames };
   }, [look]);

   return (
      <group>
         <StaticBatch shape="box" parts={boxes} />
         <StaticBatch shape="cylinder" parts={cylinders} />
         <StaticBatch shape="cone" parts={cones} />
         <Tents spots={tents} />
         <Flames anchors={flames} />
      </group>
   );
}
