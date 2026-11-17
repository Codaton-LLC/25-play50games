"use client";

// The world round the arena (no collision): a gradient sky dome following the camera, a sea of clouds
// below (soft billboard puffs), distant floating rocks with pillars, and a key light. The arena itself is
// ArenaView.tsx.
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, Color, ShaderMaterial, type Mesh } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { createRng } from "@/arcade3d/core/math";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE, fit } from "./assets";
import { levelLook } from "./look";
import type { Arena } from "./arena";

const VERT = /* glsl */ `
   varying vec3 vDir;
   void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FRAG = /* glsl */ `
   varying vec3 vDir;
   uniform vec3 uTop;
   uniform vec3 uBottom;
   void main() { float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0); gl_FragColor = vec4(mix(uBottom, uTop, smoothstep(0.4, 0.95, h)), 1.0); }
`;

export default function World({ arena, level }: { arena: Arena; level: LevelId }) {
   const look = levelLook(level);
   const sky = useRef<Mesh>(null);
   const camera = useThree((s) => s.camera);
   const mat = useMemo(
      () => new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: BackSide, depthWrite: false, fog: false, uniforms: { uTop: { value: new Color(look.skyTop) }, uBottom: { value: new Color(look.skyBottom) } } }),
      [look],
   );
   const clouds = useMemo<InstanceSpot[]>(() => {
      const rng = createRng(level * 53 + 7);
      const out: InstanceSpot[] = [];
      for (let i = 0; i < 60; i++) {
         const a = rng() * Math.PI * 2;
         const r = 18 + rng() * 60;
         const s = 4 + rng() * 7;
         out.push({ x: Math.cos(a) * r, y: -7 - rng() * 5, z: Math.sin(a) * r, sx: s * 1.6, sy: s * 0.5, sz: s });
      }
      return out;
   }, [level]);
   const towers = useMemo<InstanceSpot[]>(() => {
      const rng = createRng(level * 19 + 3);
      const out: InstanceSpot[] = [];
      for (let i = 0; i < 10; i++) {
         const a = (i / 10) * Math.PI * 2 + rng() * 0.3;
         const r = 34 + rng() * 22;
         out.push({ x: Math.cos(a) * r, y: -6 - rng() * 3, z: Math.sin(a) * r, scale: fit(GLB_SIZE.pillar.y, 10 + rng() * 10) });
      }
      return out;
   }, [level]);
   useFrame(() => {
      if (sky.current) sky.current.position.copy(camera.position);
   });
   void arena;
   return (
      <group>
         <mesh ref={sky} material={mat} renderOrder={-1}>
            <sphereGeometry args={[400, 24, 16]} />
         </mesh>
         <Instanced spots={clouds}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial color={look.clouds} roughness={1} transparent opacity={0.92} />
         </Instanced>
         <InstancedModel asset={ASSETS.pillar} spots={towers} fallback={<Instanced spots={towers}><cylinderGeometry args={[0.4, 0.4, 1.9, 10]} /><meshStandardMaterial color="#cbd5e1" /></Instanced>} />
         <directionalLight position={[8, 16, 6]} intensity={1.1} color="#ffffff" />
      </group>
   );
}
