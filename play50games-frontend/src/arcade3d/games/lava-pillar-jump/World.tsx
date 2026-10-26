"use client";

// The cavern around the climb: a warm sky, distant volcano walls (no collision), crystal clusters
// and geyser vents off the route. Fog sells the depth. Levels 4 and 5 use the hotter core palette.
// Playable pillars are Course.tsx. The lava surface is drawn there, from the rules' clock.
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BackSide,
   Color,
   InstancedBufferAttribute,
   InstancedBufferGeometry,
   PlaneGeometry,
   ShaderMaterial,
   type Texture,
} from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { createRng } from "@/arcade3d/core/math";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, GLB_SIZE } from "./assets";
import { COLORS, STORM, billboardMaterial, isStormLevel } from "./look";
import type { Course } from "./rules";

export const FOG = { color: COLORS.fog, near: 42, far: 150 } as const;

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

function SkyDome({ core }: { core: boolean }) {
   const material = useMemo(() => {
      const src = core ? STORM : COLORS;
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
   }, [core]);
   useEffect(() => () => material.dispose(), [material]);
   return (
      <mesh material={material} frustumCulled={false} renderOrder={-20}>
         <sphereGeometry args={[220, 24, 16]} />
      </mesh>
   );
}

/** Volcano walls stand off to either side of the climb, never on a pillar. */
function useWalls(course: Course, seed: number): InstanceSpot[] {
   return useMemo(() => {
      const rnd = createRng(seed ^ 0x1a7a);
      const goalZ = course.supports[course.goal].cz;
      const spots: InstanceSpot[] = [];
      const wallH = 28;
      for (let i = 0; i < 10; i++) {
         const side = i % 2 === 0 ? -1 : 1;
         spots.push({
            x: side * (38 + rnd() * 10),
            y: -2,
            z: (i / 9) * goalZ - 4,
            scale: wallH / GLB_SIZE.volcano.y,
            rotY: rnd() * Math.PI,
         });
      }
      return spots;
   }, [course, seed]);
}

function useVents(course: Course, seed: number): InstanceSpot[] {
   return useMemo(() => {
      const rnd = createRng(seed ^ 0x6e57);
      const goalZ = course.supports[course.goal].cz;
      const spots: InstanceSpot[] = [];
      const scale = 1.6 / GLB_SIZE.geyser.y;
      for (let i = 0; i < 6; i++) {
         const side = i % 2 === 0 ? -1 : 1;
         spots.push({
            x: side * (11 + rnd() * 3),
            y: -1.2,
            z: -8 - (i / 5) * Math.abs(goalZ) * 0.7,
            scale,
            rotY: rnd() * 1.2,
         });
      }
      return spots;
   }, [course, seed]);
}

/** Code crystals: two tones, off the route, no collision. */
function Crystals({ seed }: { seed: number }) {
   const spots = useMemo(() => {
      const rnd = createRng(seed ^ 0xc497);
      const out: { x: number; y: number; z: number; h: number; c: string }[] = [];
      for (let i = 0; i < 8; i++) {
         const side = i % 2 === 0 ? -1 : 1;
         out.push({
            x: side * (8.5 + rnd() * 2),
            y: 1 + rnd() * 6,
            z: -4 - i * 8,
            h: 0.7 + rnd() * 0.8,
            c: i % 2 === 0 ? "#fb7185" : "#fbbf24",
         });
      }
      return out;
   }, [seed]);
   return (
      <>
         {spots.map((s, i) => (
            <mesh key={i} position={[s.x, s.y, s.z]} rotation={[0.2, i, 0.4]}>
               <octahedronGeometry args={[s.h * 0.45, 0]} />
               <meshStandardMaterial color={s.c} emissive={s.c} emissiveIntensity={0.45} roughness={0.35} />
            </mesh>
         ))}
      </>
   );
}

export default function World({ course, seed, levelId = 1 }: { course: Course; seed: number; levelId?: number }) {
   const walls = useWalls(course, seed);
   const vents = useVents(course, seed);
   const core = isStormLevel(levelId);
   const goal = course.supports[course.goal];
   return (
      <>
         <SkyDome core={core} />
         <InstancedModel asset={ASSETS.volcano} spots={walls} fallback={null} />
         <InstancedModel asset={ASSETS.geyser} spots={vents} fallback={null} />
         <Crystals seed={seed} />
         {core ? <hemisphereLight args={["#ffb48a", "#3f1d12", STORM.hemi]} /> : <hemisphereLight args={["#ffd0a8", "#6b3a22", 1.5]} />}
         {core ? <ambientLight intensity={STORM.ambient} /> : <ambientLight intensity={0.55} />}
         {core ? <pointLight position={[0, goal.top + 8, goal.cz]} intensity={22} distance={80} color="#fb923c" /> : null}
      </>
   );
}
