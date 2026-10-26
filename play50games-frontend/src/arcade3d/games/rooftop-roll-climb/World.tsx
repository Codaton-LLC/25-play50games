"use client";

// The city around the climb: a sky gradient, a ring of Hyper3D skyline towers (no collision),
// two construction cranes, and unbranded light boards. Fog sells the depth. Night levels
// (4 and 5) use the darker palette. Playable roofs are Course.tsx.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BackSide,
   CanvasTexture,
   Color,
   InstancedBufferAttribute,
   InstancedBufferGeometry,
   PlaneGeometry,
   SRGBColorSpace,
   ShaderMaterial,
   type Group,
   type Texture,
} from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { createRng } from "@/arcade3d/core/math";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, GLB_SIZE } from "./assets";
import { COLORS, STORM, billboardMaterial, isStormLevel } from "./look";
import type { Course } from "./rules";

export const FOG = { color: COLORS.fog, near: 48, far: 180 } as const;

type FogBand = { color: string; near: number; far: number };

export interface Billboard {
   x: number;
   y: number;
   z: number;
   size: number;
   r?: number;
   g?: number;
   b?: number;
}

/** One draw call for many camera-facing quads sharing one texture. */
export function BillboardField({
   spots,
   map,
   additive = false,
   opacity = 1,
   aspect = 1.6,
   renderOrder = 0,
   live,
   fog = FOG,
   tint = "#ffffff",
}: {
   spots: readonly Billboard[];
   map: Texture;
   additive?: boolean;
   opacity?: number;
   aspect?: number;
   renderOrder?: number;
   live?: (data: Float32Array) => boolean;
   fog?: FogBand;
   tint?: string;
}) {
   const geometry = useMemo(() => {
      const base = new PlaneGeometry(1, 1);
      const g = new InstancedBufferGeometry();
      g.index = base.index;
      g.setAttribute("position", base.getAttribute("position"));
      g.setAttribute("uv", base.getAttribute("uv"));
      const spot = new Float32Array(spots.length * 4);
      const shade = new Float32Array(spots.length * 3);
      spots.forEach((s, i) => {
         spot.set([s.x, s.y, s.z, s.size], i * 4);
         shade.set([s.r ?? 1, s.g ?? 1, s.b ?? 1], i * 3);
      });
      g.setAttribute("aSpot", new InstancedBufferAttribute(spot, 4));
      g.setAttribute("aTint", new InstancedBufferAttribute(shade, 3));
      g.instanceCount = spots.length;
      return g;
   }, [spots]);
   const material = useMemo(() => {
      const m = billboardMaterial(map, additive, fog, opacity);
      (m.uniforms.uTint.value as Color).set(tint);
      return m;
   }, [map, additive, opacity, fog, tint]);
   material.uniforms.uAspect.value = aspect;
   useEffect(
      () => () => {
         geometry.dispose();
         material.dispose();
      },
      [geometry, material],
   );
   useFrame(() => {
      if (!live) return;
      const attr = geometry.getAttribute("aSpot") as InstancedBufferAttribute;
      if (live(attr.array as Float32Array)) attr.needsUpdate = true;
   });
   if (spots.length === 0) return null;
   return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={renderOrder} />;
}

const SKY_VERT = /* glsl */ `
   varying vec3 vPos;
   void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }
`;
const SKY_FRAG = /* glsl */ `
   varying vec3 vPos;
   uniform vec3 uTop;
   uniform vec3 uMid;
   uniform vec3 uBottom;
   void main() {
      float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
      vec3 c = mix(uBottom, uMid, smoothstep(0.05, 0.45, h));
      c = mix(c, uTop, smoothstep(0.42, 1.0, h));
      gl_FragColor = vec4(c, 1.0);
   }
`;

function SkyDome({ night }: { night: boolean }) {
   const material = useMemo(() => {
      const src = night ? STORM : COLORS;
      return new ShaderMaterial({
         uniforms: {
            uTop: { value: new Color(src.skyTop) },
            uMid: { value: new Color(src.skyMid) },
            uBottom: { value: new Color(src.skyBottom) },
         },
         vertexShader: SKY_VERT,
         fragmentShader: SKY_FRAG,
         depthWrite: false,
         toneMapped: false,
         side: BackSide,
      });
   }, [night]);
   useEffect(() => () => material.dispose(), [material]);
   return (
      <mesh material={material} frustumCulled={false} renderOrder={-20}>
         <sphereGeometry args={[220, 24, 16]} />
      </mesh>
   );
}

/** Towers stand off to either side of the climb, never on a roof. */
function useTowers(course: Course, seed: number): InstanceSpot[] {
   return useMemo(() => {
      const rnd = createRng(seed ^ 0x70f);
      const goalZ = course.supports[course.goal].cz;
      const spots: InstanceSpot[] = [];
      for (let i = 0; i < 16; i++) {
         const side = i % 2 === 0 ? -1 : 1;
         const along = (i / 15) * goalZ - 6;
         const height = 16 + rnd() * 26;
         spots.push({
            x: side * (20 + rnd() * 18),
            y: -1.5,
            z: along,
            scale: height / GLB_SIZE.skylineTower.y,
            rotY: rnd() * 0.8,
         });
      }
      return spots;
   }, [course, seed]);
}

function useBoardMap(): CanvasTexture {
   const map = useMemo(() => {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 72;
      const g = c.getContext("2d")!;
      g.fillStyle = "#0f172a";
      g.fillRect(0, 0, 128, 72);
      const blocks = ["#f59e0b", "#38bdf8", "#f8fafc", "#fb7185"];
      for (let i = 0; i < 4; i++) {
         g.fillStyle = blocks[i];
         g.fillRect(8 + i * 30, 16, 22, 40);
      }
      const tex = new CanvasTexture(c);
      tex.colorSpace = SRGBColorSpace;
      return tex;
   }, []);
   useEffect(() => () => map.dispose(), [map]);
   return map;
}

/** Colour-block boards. No letters and no brands. */
function Boards({ seed }: { seed: number }) {
   const map = useBoardMap();
   const spots = useMemo(() => {
      const rnd = createRng(seed ^ 0xb11);
      const out: { x: number; y: number; z: number; ry: number }[] = [];
      for (let i = 0; i < 4; i++) {
         const side = i % 2 === 0 ? -1 : 1;
         out.push({
            x: side * (14 + rnd() * 4),
            y: 7 + rnd() * 8,
            z: -6 - i * 12,
            ry: side > 0 ? -0.5 : 0.5,
         });
      }
      return out;
   }, [seed]);
   return (
      <>
         {spots.map((s, i) => (
            <mesh key={i} position={[s.x, s.y, s.z]} rotation={[0, s.ry, 0]}>
               <planeGeometry args={[4.2, 2.2]} />
               <meshBasicMaterial map={map} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}

function Crane({ x, z, phase }: { x: number; z: number; phase: number }) {
   const time = useGameTime();
   const jib = useRef<Group>(null);
   useFrame(() => {
      if (jib.current) jib.current.rotation.y = phase + time.now * 0.15;
   });
   return (
      <group position={[x, 0, z]}>
         <mesh position={[0, 8, 0]}>
            <boxGeometry args={[0.45, 16, 0.45]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.55} />
         </mesh>
         <group ref={jib} position={[0, 16.2, 0]}>
            <mesh position={[4.2, 0, 0]}>
               <boxGeometry args={[9, 0.28, 0.28]} />
               <meshStandardMaterial color="#fbbf24" roughness={0.5} />
            </mesh>
            <mesh position={[7.6, -2.2, 0]}>
               <cylinderGeometry args={[0.04, 0.04, 4.4, 4]} />
               <meshStandardMaterial color="#334155" />
            </mesh>
         </group>
      </group>
   );
}

export default function World({ course, seed, levelId = 1 }: { course: Course; seed: number; levelId?: number }) {
   const towers = useTowers(course, seed);
   const night = isStormLevel(levelId);
   const goal = course.supports[course.goal];
   return (
      <>
         <SkyDome night={night} />
         <InstancedModel asset={ASSETS.skylineTower} spots={towers} fallback={null} />
         <Crane x={-18} z={-8} phase={0.4} />
         <Crane x={18} z={goal.cz * 0.55} phase={2.1} />
         <Boards seed={seed} />
         {night ? <hemisphereLight args={["#bcd0ff", "#55658a", STORM.hemi]} /> : null}
         {night ? <ambientLight intensity={STORM.ambient} /> : null}
         {night ? <pointLight position={[0, goal.top + 12, goal.cz]} intensity={18} distance={90} color="#93c5fd" /> : null}
      </>
   );
}
