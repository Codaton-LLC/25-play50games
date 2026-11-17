"use client";

// The Prism Fortress round the courtyard: a sky dome, a misty sea of cloud far below, a ring of
// floating slate islands (menu2 islandB) carrying the fortress's stone towers (menu2 stoneTower), both
// tinted to the fortress's smoked grey, and glass shards in the five hero colours drifting between them
// (code: the light sources). Scenery only: nothing collides.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, type Group } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { SkyDome } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE } from "./assets";
import { arenaBounds } from "./camera";
import type { Course } from "./course";
import { COLORS, levelLook } from "./look";

const rnd = (a: number, b: number): number => {
   const h = Math.imul(a * 2654435761 + b * 40503, 2246822519) >>> 0;
   return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

function centre(c: Course) {
   const b = arenaBounds(c);
   return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, span: Math.max(b.maxX - b.minX, b.maxZ - b.minZ) };
}

function Fortress({ course }: { course: Course }) {
   const { islands, towers } = useMemo(() => {
      const m = centre(course);
      const islands: InstanceSpot[] = [];
      const towers: InstanceSpot[] = [];
      const n = 14;
      for (let k = 0; k < n; k++) {
         const a = (k / n) * Math.PI * 2 + rnd(k, 1) * 0.3;
         const r = m.span * 0.5 + 26 + rnd(k, 2) * 18;
         const x = m.x + Math.sin(a) * r;
         const z = m.z + Math.cos(a) * r;
         const y = -14 + rnd(k, 3) * 10;
         const s = 7 + rnd(k, 4) * 6;
         islands.push({ x, y, z, rotY: rnd(k, 5) * 6, sx: s / GLB_SIZE.island.x, sy: (s * 0.8) / GLB_SIZE.island.y, sz: s / GLB_SIZE.island.z });
         if (k % 2 === 0) {
            const h = 14 + rnd(k, 6) * 16;
            towers.push({ x, y: y + s * 0.55, z, rotY: rnd(k, 7) * 6, sx: (s * 0.45) / GLB_SIZE.tower.x, sy: h / GLB_SIZE.tower.y, sz: (s * 0.45) / GLB_SIZE.tower.z });
         }
      }
      return { islands, towers };
   }, [course]);
   return (
      <>
         <InstancedModel
            asset={ASSETS.island}
            spots={islands}
            fallback={
               <Instanced spots={islands}>
                  <dodecahedronGeometry args={[0.9, 0]} />
                  <meshStandardMaterial color={COLORS.rim} roughness={0.9} flatShading />
               </Instanced>
            }
         />
         <InstancedModel
            asset={ASSETS.tower}
            spots={towers}
            fallback={
               <Instanced spots={towers}>
                  <cylinderGeometry args={[0.6, 0.8, 1.9, 8]} />
                  <meshStandardMaterial color={COLORS.rim} roughness={0.8} />
               </Instanced>
            }
         />
      </>
   );
}

function Shards({ course }: { course: Course }) {
   const g = useRef<Group>(null);
   const time = useGameTime();
   const spots = useMemo(() => {
      const m = centre(course);
      return COLORS.paint.map((_c, i) =>
         Array.from({ length: 4 }, (_x, k): InstanceSpot => {
            const a = ((i * 4 + k) / 20) * Math.PI * 2;
            const r = m.span * 0.5 + 14 + rnd(i, k) * 10;
            const s = 0.8 + rnd(k, i + 3) * 1.4;
            return { x: m.x + Math.sin(a) * r, y: 2 + rnd(i + 7, k) * 12, z: m.z + Math.cos(a) * r, rotY: rnd(i, k + 9) * 6, sx: s * 0.6, sy: s * 1.7, sz: s * 0.6 };
         }),
      );
   }, [course]);
   useFrame(() => {
      if (g.current) g.current.position.y = Math.sin(time.now * 0.6) * 0.6;
   });
   return (
      <group ref={g}>
         {COLORS.paint.map((c, i) => (
            <Instanced key={c} spots={spots[i]}>
               <octahedronGeometry args={[0.5, 0]} />
               <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.9} roughness={0.25} transparent opacity={0.85} toneMapped={false} />
            </Instanced>
         ))}
      </group>
   );
}

function Clouds({ course }: { course: Course }) {
   const m = centre(course);
   const look = levelLook(course.level);
   return (
      <mesh rotation-x={-Math.PI / 2} position={[m.x, -26, m.z]}>
         <circleGeometry args={[260, 48]} />
         <meshStandardMaterial color={look.skyBottom} emissive={look.skyBottom} emissiveIntensity={0.25} roughness={1} />
      </mesh>
   );
}

function Motes({ course }: { course: Course }) {
   const geo = useMemo(() => {
      const m = centre(course);
      const g = new BufferGeometry();
      const pts: number[] = [];
      for (let k = 0; k < 300; k++) pts.push(m.x + (rnd(k, 1) - 0.5) * (m.span + 40), -4 + rnd(k, 2) * 18, m.z + (rnd(k, 3) - 0.5) * (m.span + 40));
      g.setAttribute("position", new Float32BufferAttribute(pts, 3));
      return g;
   }, [course]);
   useEffect(() => () => geo.dispose(), [geo]);
   return (
      <points geometry={geo}>
         <pointsMaterial color="#f1f5f9" size={0.1} transparent opacity={0.6} />
      </points>
   );
}

export default function World({ course }: { course: Course }) {
   const look = levelLook(course.level);
   return (
      <group>
         <SkyDome top={look.skyTop} bottom={look.skyBottom} />
         <Clouds course={course} />
         <Fortress course={course} />
         <Shards course={course} />
         <Motes course={course} />
      </group>
   );
}
