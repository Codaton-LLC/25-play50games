"use client";

// The Neon Cosmos void: a violet sky dome, a cyan grid far below that scrolls slowly toward the
// horizon, neon city towers (m2NeonCityBg, instanced) rising out of the grid round the field, a ringed
// planet in the sky (space-pod-jump's m2RingedPlanetBg, reused by url) and a field of stars.
// Everything here is scenery: nothing collides.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, CanvasTexture, Float32BufferAttribute, RepeatWrapping, SRGBColorSpace, type Group, type Material, type Mesh } from "three";
import { InstancedModel, useModel } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { SkyDome } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE } from "./assets";
import type { Course } from "./course";
import { COLORS, levelLook } from "./look";

const GRID_Y = -46;

const rnd = (a: number, b: number): number => {
   const h = Math.imul(a * 2654435761 + b * 40503, 2246822519) >>> 0;
   return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

function bounds(c: Course) {
   let minX = Infinity;
   let maxX = -Infinity;
   let minZ = Infinity;
   let maxZ = -Infinity;
   for (const q of c.cubes) {
      minX = Math.min(minX, q.x);
      maxX = Math.max(maxX, q.x);
      minZ = Math.min(minZ, q.z);
      maxZ = Math.max(maxZ, q.z);
   }
   return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, r: Math.max(maxX - minX, maxZ - minZ) / 2 };
}

function gridTexture(): CanvasTexture | null {
   if (typeof document === "undefined") return null;
   const c = document.createElement("canvas");
   c.width = 128;
   c.height = 128;
   const g = c.getContext("2d");
   if (!g) return null;
   g.fillStyle = "#07031a";
   g.fillRect(0, 0, 128, 128);
   g.strokeStyle = COLORS.grid;
   g.globalAlpha = 0.85;
   g.lineWidth = 2;
   g.strokeRect(0, 0, 128, 128);
   g.globalAlpha = 0.25;
   g.lineWidth = 1;
   g.beginPath();
   g.moveTo(64, 0);
   g.lineTo(64, 128);
   g.moveTo(0, 64);
   g.lineTo(128, 64);
   g.stroke();
   const t = new CanvasTexture(c);
   t.wrapS = RepeatWrapping;
   t.wrapT = RepeatWrapping;
   t.repeat.set(60, 60);
   t.colorSpace = SRGBColorSpace;
   return t;
}

function Grid({ course }: { course: Course }) {
   const tex = useMemo(gridTexture, []);
   useEffect(() => () => tex?.dispose(), [tex]);
   const time = useGameTime();
   const look = levelLook(course.level);
   const b = bounds(course);
   useFrame(() => {
      if (tex) tex.offset.y = time.now * 0.02;
   });
   return (
      <mesh rotation-x={-Math.PI / 2} position={[b.cx, GRID_Y, b.cz]}>
         <planeGeometry args={[600, 600]} />
         <meshBasicMaterial map={tex ?? undefined} color={tex ? "#ffffff" : COLORS.void} transparent opacity={0.4 + 0.6 * look.grid} toneMapped={false} />
      </mesh>
   );
}

function City({ course }: { course: Course }) {
   const spots = useMemo(() => {
      const b = bounds(course);
      const out: InstanceSpot[] = [];
      const n = 34;
      for (let k = 0; k < n; k++) {
         const a = (k / n) * Math.PI * 2 + rnd(k, 1) * 0.15;
         const r = b.r + 38 + rnd(k, 2) * 40;
         const h = 30 + rnd(k, 3) * 45;
         const w = 6 + rnd(k, 4) * 8;
         out.push({ x: b.cx + Math.cos(a) * r, y: GRID_Y, z: b.cz + Math.sin(a) * r, rotY: rnd(k, 5) * 6.28, sx: w / GLB_SIZE.city.x, sy: h / GLB_SIZE.city.y, sz: w / GLB_SIZE.city.z });
      }
      return out;
   }, [course]);
   return (
      <InstancedModel
         asset={ASSETS.city}
         spots={spots}
         fallback={
            <Instanced spots={spots}>
               <boxGeometry args={[GLB_SIZE.city.x, GLB_SIZE.city.y, GLB_SIZE.city.z]} />
               <meshStandardMaterial color="#312e81" emissive="#4c1d95" emissiveIntensity={0.4} />
            </Instanced>
         }
      />
   );
}

/**
 * The ringed planet (space-pod-jump's m2RingedPlanetBg, reused by url): a background far out in the sky,
 * so its materials are cloned with fog off (the fog would swallow it; the shared GLB keeps its own).
 */
function PlanetGlb({ width }: { width: number }) {
   const { scene } = useModel(ASSETS.planet);
   const obj = useMemo(() => {
      if (!scene) return null;
      scene.traverse((o) => {
         const m = o as Mesh;
         if (!m.isMesh) return;
         const one = (mat: Material) => {
            const c = mat.clone();
            (c as Material & { fog?: boolean }).fog = false;
            return c;
         };
         m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
      });
      return scene;
   }, [scene]);
   if (!obj) return null;
   const s = width / GLB_SIZE.planet.x;
   return <primitive object={obj} scale={s} position={[0, (-GLB_SIZE.planet.y * s) / 2, 0]} />;
}

function Planet({ course }: { course: Course }) {
   const ref = useRef<Group>(null);
   const time = useGameTime();
   const b = bounds(course);
   useFrame(() => {
      if (ref.current) ref.current.rotation.y = time.now * 0.02;
   });
   return (
      <group position={[b.cx - 70, 55, b.cz - 120]}>
         <group ref={ref}>
            <PlanetGlb width={60} />
         </group>
      </group>
   );
}

function Stars() {
   const geo = useMemo(() => {
      const g = new BufferGeometry();
      const pts: number[] = [];
      for (let k = 0; k < 600; k++) {
         const a = rnd(k, 11) * Math.PI * 2;
         const e = 0.08 + rnd(k, 12) * 1.3;
         const r = 160;
         pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
      }
      g.setAttribute("position", new Float32BufferAttribute(pts, 3));
      return g;
   }, []);
   useEffect(() => () => geo.dispose(), [geo]);
   return (
      <points geometry={geo}>
         <pointsMaterial color="#e9d5ff" size={0.9} sizeAttenuation fog={false} />
      </points>
   );
}

export default function World({ course }: { course: Course }) {
   const look = levelLook(course.level);
   return (
      <group>
         <SkyDome top={look.skyTop} bottom={look.skyBottom} />
         <Stars />
         <Planet course={course} />
         <Grid course={course} />
         <City course={course} />
      </group>
   );
}
