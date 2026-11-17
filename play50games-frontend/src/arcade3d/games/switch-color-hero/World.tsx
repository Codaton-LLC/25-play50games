"use client";

// The world round the track (no collision): a gradient sky dome that follows the camera, the sci-fi city
// of spires (the game's spire GLB) far below and along both sides, a haze plane under the track, a key
// light. The playable track is TrackView.tsx.
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, Color, ShaderMaterial, type Mesh } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { createRng } from "@/arcade3d/core/math";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE, fit } from "./assets";
import { levelLook } from "./look";
import type { Track } from "./track";

const VERT = /* glsl */ `
   varying vec3 vDir;
   void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FRAG = /* glsl */ `
   varying vec3 vDir;
   uniform vec3 uTop;
   uniform vec3 uBottom;
   void main() { float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0); gl_FragColor = vec4(mix(uBottom, uTop, smoothstep(0.35, 0.95, h)), 1.0); }
`;

export default function World({ track, level }: { track: Track; level: LevelId }) {
   const look = levelLook(level);
   const sky = useRef<Mesh>(null);
   const camera = useThree((s) => s.camera);
   const mat = useMemo(
      () => new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: BackSide, depthWrite: false, fog: false, uniforms: { uTop: { value: new Color(look.skyTop) }, uBottom: { value: new Color(look.skyBottom) } } }),
      [look],
   );
   const end = track.arenaZ !== null ? track.arenaZ - 900 : track.finishZ - 120;
   const spires = useMemo<InstanceSpot[]>(() => {
      const rng = createRng(level * 97);
      const out: InstanceSpot[] = [];
      for (let z = 40; z > end; z -= 14 + rng() * 10) {
         for (const side of [-1, 1]) {
            const h = 14 + rng() * 26;
            out.push({ x: side * (14 + rng() * 22), y: -30, z: z + rng() * 6, sx: fit(GLB_SIZE.spire.x, 3 + rng() * 3), sy: fit(GLB_SIZE.spire.y, h + 30), sz: fit(GLB_SIZE.spire.z, 3 + rng() * 3), rotY: rng() * 6 });
         }
      }
      return out;
   }, [level, end]);
   const lights = useMemo<InstanceSpot[]>(() => {
      const rng = createRng(level * 31 + 5);
      const out: InstanceSpot[] = [];
      for (let z = 30; z > end; z -= 9 + rng() * 8) out.push({ x: (rng() < 0.5 ? -1 : 1) * (8 + rng() * 40), y: -12 - rng() * 30, z, scale: 0.4 + rng() * 0.8 });
      return out;
   }, [level, end]);
   useFrame(() => {
      if (sky.current) sky.current.position.copy(camera.position);
   });
   return (
      <group>
         <mesh ref={sky} material={mat} renderOrder={-1}>
            <sphereGeometry args={[400, 24, 16]} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, -30, (40 + end) / 2]}>
            <planeGeometry args={[400, Math.abs(end) + 200]} />
            <meshStandardMaterial color={look.city} roughness={1} />
         </mesh>
         <InstancedModel asset={ASSETS.spire} spots={spires} fallback={<Instanced spots={spires}><boxGeometry args={[0.8, 1.9, 0.8]} /><meshStandardMaterial color="#64748b" /></Instanced>} />
         <Instanced spots={lights}>
            <sphereGeometry args={[0.6, 8, 6]} />
            <meshBasicMaterial color={look.glow} toneMapped={false} />
         </Instanced>
         <directionalLight position={[6, 14, 8]} intensity={1.1} color="#ffffff" />
      </group>
   );
}
