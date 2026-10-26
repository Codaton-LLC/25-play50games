"use client";

// The pastel sky around the helix: a soft gradient, distant puff clouds and a cloud castle
// (no collision). Levels 4 and 5 dusk into a deeper blue. Playable clouds are Course.tsx.
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

/** The footprint of the ledges (x0..x1, z0..z1), and the points of a ring `margin` m outside it. */
function footprint(course: Course) {
   let x0 = Infinity;
   let x1 = -Infinity;
   let z0 = Infinity;
   let z1 = -Infinity;
   for (const s of course.supports) {
      x0 = Math.min(x0, s.cx - s.hw);
      x1 = Math.max(x1, s.cx + s.hw);
      z0 = Math.min(z0, s.cz - s.hd);
      z1 = Math.max(z1, s.cz + s.hd);
   }
   return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
}

/** n points round the footprint, `margin` m outside it (an ellipse through the corners' reach). */
function ringAround(course: Course, n: number, margin: number): { x: number; z: number; angle: number }[] {
   const f = footprint(course);
   const rx = (f.x1 - f.x0) / 2 + margin;
   const rz = (f.z1 - f.z0) / 2 + margin;
   const out: { x: number; z: number; angle: number }[] = [];
   for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3;
      out.push({ x: f.cx + Math.sin(a) * rx * 1.15, z: f.cz + Math.cos(a) * rz * 1.15, angle: a });
   }
   return out;
}

export default function World({ course, seed, levelId = 1 }: { course: Course; seed: number; levelId?: number }) {
   const night = isStormLevel(levelId);
   const goal = course.supports[course.goal];
   const foot = footprint(course);
   const puffs = useMemo(() => {
      const rnd = createRng(seed ^ 0xc10d);
      return ringAround(course, 10, 9).map((p) => ({
         x: p.x,
         y: -6 + rnd() * 10,
         z: p.z,
         scale: 4.5 + rnd() * 3.5,
         rotY: p.angle,
      }));
   }, [course, seed]);
   const castleScale = 16 / GLB_SIZE.castle.y;
   return (
      <>
         <SkyDome night={night} />
         <InstancedModel asset={ASSETS.cloud} spots={puffs} fallback={null} />
         <group position={[foot.cx + 18, goal.top * 0.45, foot.cz - 22]} scale={castleScale}>
            <InstancedModel asset={ASSETS.castle} spots={[{ x: 0, y: 0, z: 0, scale: 1 }]} fallback={null} />
         </group>
         <hemisphereLight args={[night ? "#fff1f6" : "#fff4ea", night ? "#f2b0d2" : "#fbcfe8", night ? STORM.hemi : 0.85]} />
         {night ? <ambientLight intensity={STORM.ambient} /> : <ambientLight intensity={0.35} />}
         <directionalLight position={[12, 28, 10]} intensity={night ? 0.7 : 1.15} color={night ? "#dbe7ff" : "#fff7ee"} />
      </>
   );
}
