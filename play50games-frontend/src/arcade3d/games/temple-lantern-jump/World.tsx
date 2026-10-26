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

/** Far temple towers on the hillside, off to either side of the climb. */
function useTowers(course: Course, seed: number): InstanceSpot[] {
   return useMemo(() => {
      const rnd = createRng(seed ^ 0x70f);
      const goalZ = course.supports[course.goal].cz;
      const goalTop = course.supports[course.goal].top;
      const spots: InstanceSpot[] = [];
      for (let i = 0; i < 12; i++) {
         const side = i % 2 === 0 ? -1 : 1;
         const height = 14 + rnd() * 18 + goalTop * 0.3;
         spots.push({ x: side * (24 + rnd() * 14), y: -2, z: (i / 11) * goalZ - 6, scale: height / GLB_SIZE.towerBg.y, rotY: rnd() * 0.8 });
      }
      return spots;
   }, [course, seed]);
}

/** Big paper lanterns hanging along the climb on both sides, never on a balcony (x is outside the courtyard). */
function useHangingLanterns(course: Course, seed: number): InstanceSpot[] {
   return useMemo(() => {
      const rnd = createRng(seed ^ 0x1a47);
      const top = course.supports[course.goal].top;
      const goalZ = course.supports[course.goal].cz;
      const spots: InstanceSpot[] = [];
      for (let i = 0; i < 18; i++) {
         const side = i % 2 === 0 ? -1 : 1;
         const t = (i + 0.5) / 18;
         spots.push({
            x: side * (9.5 + rnd() * 4),
            y: 2 + t * (top - 3) + rnd() * 2,
            z: t * goalZ + 2 - rnd() * 4,
            scale: (2.2 + rnd() * 1.8) / GLB_SIZE.lantern.y,
            rotY: rnd() * 6.28,
         });
      }
      return spots;
   }, [course, seed]);
}

export default function World({ course, seed, levelId = 1 }: { course: Course; seed: number; levelId?: number }) {
   const towers = useTowers(course, seed);
   const hanging = useHangingLanterns(course, seed);
   const night = isStormLevel(levelId);
   const goal = course.supports[course.goal];
   return (
      <>
         <SkyDome night={night} />
         <InstancedModel asset={ASSETS.towerBg} spots={towers} fallback={null} />
         <InstancedModel asset={ASSETS.lantern} spots={hanging} fallback={null} />
         <hemisphereLight args={night ? ["#e0cfff", "#4a3a66", STORM.hemi] : ["#ffe2c4", "#7a4b3a", 1.3]} />
         <ambientLight intensity={night ? STORM.ambient : 0.45} />
         <pointLight position={[goal.cx, goal.top + 6, goal.cz]} intensity={night ? 20 : 8} distance={70} color="#fbbf24" />
      </>
   );
}
