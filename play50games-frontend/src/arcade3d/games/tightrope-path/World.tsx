"use client";

// The gorge: a sky dome per level, the jade river 14 m below the walk with drifting rafts
// (m2RaftPlatform, rest spots far below), two cliff walls of rock pillars (m2RockPillarBg, instanced,
// non-colliding) with jungle canopy on top, and layers of mist drifting under the path. Static props
// are instanced; the mist and the river's foam move with the pause-safe game clock.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { SkyDome } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, RAFT_SCALE } from "./assets";
import { mainRoute, linkPoint, type Course } from "./course";
import { COLORS, levelLook } from "./look";

const rnd = (a: number, b: number): number => {
   const h = Math.imul(a * 2654435761 + b * 40503, 2246822519) >>> 0;
   return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

/** Points along the main walk every `step` m, with the walk's direction. */
function walkSamples(c: Course, step: number): { x: number; z: number; dx: number; dz: number }[] {
   const out: { x: number; z: number; dx: number; dz: number }[] = [];
   const p = { x: 0, y: 0, z: 0 };
   for (const i of mainRoute(c)) {
      const l = c.links[i];
      for (let s = 0; s < l.len + l.gap; s += step) {
         linkPoint(l, s, p);
         out.push({ x: p.x, z: p.z, dx: l.dx, dz: l.dz });
      }
   }
   return out;
}

export function bounds(c: Course): { minX: number; maxX: number; minZ: number; maxZ: number } {
   let minX = Infinity;
   let maxX = -Infinity;
   let minZ = Infinity;
   let maxZ = -Infinity;
   for (const l of c.links) {
      minX = Math.min(minX, l.ax, l.bx);
      maxX = Math.max(maxX, l.ax, l.bx);
      minZ = Math.min(minZ, l.az, l.bz);
      maxZ = Math.max(maxZ, l.az, l.bz);
   }
   return { minX, maxX, minZ, maxZ };
}

function cliffSpots(c: Course): { rocks: InstanceSpot[]; canopy: InstanceSpot[] } {
   const rocks: InstanceSpot[] = [];
   const canopy: InstanceSpot[] = [];
   const samples = walkSamples(c, 5);
   samples.forEach((p, i) => {
      for (const side of [-1, 1]) {
         const off = 17 + rnd(i, side + 3) * 7;
         const rx = -p.dz * side;
         const rz = p.dx * side;
         const h = 15 + rnd(i, side + 7) * 9;
         const w = 7 + rnd(i, side + 11) * 5;
         rocks.push({ x: p.x + rx * off, y: -1, z: p.z + rz * off, rotY: rnd(i, side) * 6.28, sx: w / GLB_SIZE.pillar.x, sy: h / GLB_SIZE.pillar.y, sz: w / GLB_SIZE.pillar.z });
         canopy.push({ x: p.x + rx * (off + 1), y: h - 1.5, z: p.z + rz * (off + 1), rotY: rnd(i, side + 5) * 6.28, sx: w * 0.75, sy: 2.4 + rnd(i, 9) * 1.5, sz: w * 0.75 });
      }
   });
   // a few lone stacks in the river (the background's depth)
   samples.forEach((p, i) => {
      if (i % 3 !== 1) return;
      const side = rnd(i, 21) < 0.5 ? -1 : 1;
      const off = 6 + rnd(i, 23) * 7;
      const h = 6 + rnd(i, 25) * 6;
      rocks.push({ x: p.x - p.dz * side * off, y: -0.5, z: p.z + p.dx * side * off, rotY: rnd(i, 27) * 6.28, sx: 2.2 / GLB_SIZE.pillar.x, sy: h / GLB_SIZE.pillar.y, sz: 2.2 / GLB_SIZE.pillar.z });
   });
   return { rocks, canopy };
}

function mistTexture(): CanvasTexture | null {
   if (typeof document === "undefined") return null;
   const c = document.createElement("canvas");
   c.width = 256;
   c.height = 256;
   const g = c.getContext("2d");
   if (!g) return null;
   for (let k = 0; k < 18; k++) {
      const x = rnd(k, 1) * 256;
      const y = rnd(k, 2) * 256;
      const r = 40 + rnd(k, 3) * 70;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(255,255,255,0.55)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
   }
   const t = new CanvasTexture(c);
   t.wrapS = RepeatWrapping;
   t.wrapT = RepeatWrapping;
   t.repeat.set(3, 3);
   t.colorSpace = SRGBColorSpace;
   return t;
}

function riverTexture(): CanvasTexture | null {
   if (typeof document === "undefined") return null;
   const c = document.createElement("canvas");
   c.width = 128;
   c.height = 128;
   const g = c.getContext("2d");
   if (!g) return null;
   g.fillStyle = COLORS.river;
   g.fillRect(0, 0, 128, 128);
   for (let k = 0; k < 60; k++) {
      g.fillStyle = `rgba(220,245,240,${0.08 + rnd(k, 4) * 0.18})`;
      g.fillRect(rnd(k, 5) * 128, rnd(k, 6) * 128, 6 + rnd(k, 7) * 18, 1.5);
   }
   const t = new CanvasTexture(c);
   t.wrapS = RepeatWrapping;
   t.wrapT = RepeatWrapping;
   t.repeat.set(10, 10);
   t.colorSpace = SRGBColorSpace;
   return t;
}

function River({ course }: { course: Course }) {
   const tex = useMemo(riverTexture, []);
   useEffect(() => () => tex?.dispose(), [tex]);
   const time = useGameTime();
   const b = bounds(course);
   const cx = (b.minX + b.maxX) / 2;
   const cz = (b.minZ + b.maxZ) / 2;
   const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + 120;
   useFrame(() => {
      if (tex) tex.offset.y = -time.now * 0.02;
   });
   return (
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0, cz]}>
         <planeGeometry args={[size, size]} />
         <meshStandardMaterial map={tex ?? undefined} color={tex ? "#ffffff" : COLORS.river} roughness={0.25} metalness={0.1} />
      </mesh>
   );
}

function Mist({ course }: { course: Course }) {
   const texs = useMemo(() => {
      const t = mistTexture();
      return t ? [t, t.clone(), t.clone()] : [];
   }, []);
   useEffect(() => () => texs.forEach((t) => t.dispose()), [texs]);
   const look = levelLook(course.level);
   const time = useGameTime();
   const layers = useRef<(Mesh | null)[]>([]);
   const b = bounds(course);
   const cx = (b.minX + b.maxX) / 2;
   const cz = (b.minZ + b.maxZ) / 2;
   const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + 60;
   useFrame(() => {
      layers.current.forEach((m, i) => {
         if (!m) return;
         const mat = m.material as MeshBasicMaterial;
         if (mat.map) {
            mat.map.offset.x = time.now * (0.004 + i * 0.002);
            mat.map.offset.y = time.now * 0.003 * (i % 2 ? -1 : 1);
         }
      });
   });
   if (!texs.length) return null;
   return (
      <group>
         {[3.5, 7, 10.5].map((y, i) => (
            <mesh
               key={y}
               ref={(m) => {
                  layers.current[i] = m;
               }}
               rotation-x={-Math.PI / 2}
               position={[cx, y, cz]}
               renderOrder={3}
            >
               <planeGeometry args={[size, size]} />
               <meshBasicMaterial map={texs[i]} color={COLORS.mist} transparent opacity={look.mist * (1 - i * 0.2)} depthWrite={false} fog />
            </mesh>
         ))}
      </group>
   );
}

function Rafts({ course }: { course: Course }) {
   const time = useGameTime();
   const ref = useRef<(Group | null)[]>([]);
   const samples = useMemo(() => walkSamples(course, 14), [course]);
   useFrame(() => {
      ref.current.forEach((g, i) => {
         if (!g) return;
         const p = samples[i];
         const drift = ((time.now * 0.6 + i * 9) % 30) - 15;
         g.position.set(p.x - p.dz * (drift * 0.3 + (i % 2 ? 5 : -5)) + p.dx * drift, 0.05 + Math.sin(time.now * 1.3 + i) * 0.05, p.z + p.dx * (drift * 0.3 + (i % 2 ? 5 : -5)) + p.dz * drift);
         g.rotation.y = time.now * 0.05 + i;
      });
   });
   return (
      <>
         {samples.map((_p, i) => (
            <group
               key={i}
               ref={(g) => {
                  ref.current[i] = g;
               }}
            >
               <Model asset={ASSETS.raft} scale={RAFT_SCALE} />
            </group>
         ))}
      </>
   );
}

export default function World({ course }: { course: Course }) {
   const look = levelLook(course.level);
   const { rocks, canopy } = useMemo(() => cliffSpots(course), [course]);
   return (
      <group>
         <SkyDome top={look.skyTop} bottom={look.skyBottom} />
         <River course={course} />
         <InstancedModel
            asset={ASSETS.pillar}
            spots={rocks}
            fallback={
               <Instanced spots={rocks}>
                  <boxGeometry args={[GLB_SIZE.pillar.x, GLB_SIZE.pillar.y, GLB_SIZE.pillar.z]} />
                  <meshStandardMaterial color={COLORS.rock} roughness={0.95} />
               </Instanced>
            }
         />
         <Instanced spots={canopy}>
            <icosahedronGeometry args={[0.5, 1]} />
            <meshStandardMaterial color={COLORS.leaf} roughness={0.9} flatShading />
         </Instanced>
         <Rafts course={course} />
         <Mist course={course} />
      </group>
   );
}
