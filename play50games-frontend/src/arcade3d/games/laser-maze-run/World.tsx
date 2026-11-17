"use client";

// The vault's surroundings (no collision): a dark gradient dome that travels with the camera, with a
// faint grid of light on it; dust motes glinting in the beams round the camera; the deep floor below
// the corridor; and the lights.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, BufferAttribute, BufferGeometry, Color, ShaderMaterial, type Group, type Points } from "three";
import { createRng } from "@/arcade3d/core/math";
import { useGameTime } from "@/arcade3d/core/gameTime";
import type { LevelId } from "@/arcade3d/types";
import { COLORS, accentFor, laserLight } from "./look";

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
   uniform vec3 uBottom;
   uniform vec3 uGrid;
   void main() {
      vec3 d = normalize(vPos);
      float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 c = mix(uBottom, uTop, smoothstep(0.3, 0.9, h));
      // a faint grid of light panels on the vault's far walls
      vec2 uv = vec2(atan(d.x, d.z) * 6.0, d.y * 12.0);
      vec2 g = abs(fract(uv) - 0.5);
      float line = 1.0 - smoothstep(0.0, 0.03, min(g.x, g.y));
      c += uGrid * line * 0.12 * smoothstep(0.2, 0.5, h);
      gl_FragColor = vec4(c, 1.0);
   }
`;

function Dome({ level }: { level: LevelId }) {
   const ref = useRef<Group>(null);
   const material = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: { uTop: { value: new Color("#0f172a") }, uBottom: { value: new Color(laserLight(level).fog.color) }, uGrid: { value: new Color(accentFor(level)) } },
            vertexShader: SKY_VERT,
            fragmentShader: SKY_FRAG,
            depthWrite: false,
            toneMapped: false,
            side: BackSide,
            fog: false,
         }),
      [level],
   );
   useEffect(() => () => material.dispose(), [material]);
   useFrame((state) => {
      if (ref.current) ref.current.position.copy(state.camera.position);
   });
   return (
      <group ref={ref}>
         <mesh material={material} frustumCulled={false} renderOrder={-20}>
            <sphereGeometry args={[240, 24, 16]} />
         </mesh>
      </group>
   );
}

/** Dust motes drifting round the camera (one Points draw). */
function Motes({ level }: { level: LevelId }) {
   const time = useGameTime();
   const ref = useRef<Points>(null);
   const N = 220;
   const geo = useMemo(() => {
      const rnd = createRng(0x1a5e + level);
      const p = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
         p[i * 3] = (rnd() - 0.5) * 30;
         p[i * 3 + 1] = rnd() * 8;
         p[i * 3 + 2] = (rnd() - 0.5) * 40;
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(p, 3));
      return g;
   }, [level]);
   useEffect(() => () => geo.dispose(), [geo]);
   useFrame((state) => {
      const pts = ref.current;
      if (!pts) return;
      const c = state.camera.position;
      pts.position.set(c.x, (time.now * 0.15) % 2, c.z - 8);
   });
   return (
      <points ref={ref} geometry={geo} frustumCulled={false}>
         <pointsMaterial color="#cbd5e1" size={0.05} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
      </points>
   );
}

export default function World({ level, length }: { level: LevelId; length: number }) {
   const light = laserLight(level);
   return (
      <>
         <Dome level={level} />
         {/* the deep floor below the corridor */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -3, -length / 2]}>
            <planeGeometry args={[160, length + 200]} />
            <meshStandardMaterial color={COLORS.background} roughness={0.9} />
         </mesh>
         <Motes level={level} />
         <hemisphereLight args={["#e2e8f0", "#0f172a", light.hemi]} />
         <ambientLight intensity={light.ambient} />
         <directionalLight position={[8, 20, 10]} intensity={light.key} color="#e0f2fe" />
      </>
   );
}
