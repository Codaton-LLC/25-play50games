"use client";

// The alien sky (no collision): a gradient dome that travels with the camera (the meadow's violet dusk,
// the crystal route's blue, the meteor zone's ember sky, the glow plants' night, the launch's starfield)
// with stars, two moons and a faint aurora; glowing spores drifting up round the camera; the valley floor
// below the track; and the lights.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, BufferAttribute, BufferGeometry, Color, ShaderMaterial, type Group, type Points } from "three";
import { createRng } from "@/arcade3d/core/math";
import { useGameTime } from "@/arcade3d/core/gameTime";
import type { LevelId } from "@/arcade3d/types";
import { alienLight, groundColor, skyColors } from "./look";

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
   uniform float uStars;
   void main() {
      vec3 d = normalize(vPos);
      float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 c = mix(uBottom, uMid, smoothstep(0.35, 0.55, h));
      c = mix(c, uTop, smoothstep(0.55, 1.0, h));
      // stars (a hashed grid on the dome), brighter higher up
      vec3 q = floor(d * 140.0);
      float n = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float star = step(0.9965, n) * smoothstep(0.5, 0.75, h);
      c += vec3(star) * uStars;
      // the aurora: a soft band that ripples
      float au = sin(d.x * 6.0 + d.z * 3.0) * 0.5 + 0.5;
      c += vec3(0.25, 0.9, 0.85) * smoothstep(0.62, 0.7, h) * smoothstep(0.86, 0.7, h) * au * 0.22 * uStars;
      // two moons
      float m1 = smoothstep(0.9975, 0.9985, dot(d, normalize(vec3(-0.5, 0.45, -0.75))));
      float m2 = smoothstep(0.9993, 0.9996, dot(d, normalize(vec3(0.42, 0.32, -0.85))));
      c = mix(c, vec3(0.98, 0.9, 1.0), m1);
      c = mix(c, vec3(0.65, 0.95, 0.9), m2);
      gl_FragColor = vec4(c, 1.0);
   }
`;

function Sky({ level }: { level: LevelId }) {
   const ref = useRef<Group>(null);
   const material = useMemo(() => {
      const [t, m, b] = skyColors(level);
      return new ShaderMaterial({
         uniforms: { uTop: { value: new Color(t) }, uMid: { value: new Color(m) }, uBottom: { value: new Color(b) }, uStars: { value: level === 1 || level === 3 ? 0.6 : 1 } },
         vertexShader: SKY_VERT,
         fragmentShader: SKY_FRAG,
         depthWrite: false,
         toneMapped: false,
         side: BackSide,
         fog: false,
      });
   }, [level]);
   useEffect(() => () => material.dispose(), [material]);
   useFrame((state) => {
      if (ref.current) ref.current.position.copy(state.camera.position);
   });
   return (
      <group ref={ref}>
         <mesh material={material} frustumCulled={false} renderOrder={-20}>
            <sphereGeometry args={[260, 24, 16]} />
         </mesh>
      </group>
   );
}

/** Glowing spores drifting up round the camera (one Points draw). */
function Spores({ level }: { level: LevelId }) {
   const time = useGameTime();
   const ref = useRef<Points>(null);
   const N = 260;
   const geo = useMemo(() => {
      const rnd = createRng(0xa11e);
      const p = new Float32Array(N * 3);
      const c = new Float32Array(N * 3);
      const pal = level === 3 ? [[1, 0.6, 0.3], [1, 0.85, 0.5]] : [[0.75, 0.55, 1], [0.4, 0.95, 0.95], [0.95, 0.6, 1]];
      for (let i = 0; i < N; i++) {
         p[i * 3] = (rnd() - 0.5) * 50;
         p[i * 3 + 1] = rnd() * 18;
         p[i * 3 + 2] = (rnd() - 0.5) * 60;
         const k = pal[i % pal.length];
         c[i * 3] = k[0];
         c[i * 3 + 1] = k[1];
         c[i * 3 + 2] = k[2];
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(p, 3));
      g.setAttribute("color", new BufferAttribute(c, 3));
      return g;
   }, [level]);
   useEffect(() => () => geo.dispose(), [geo]);
   useFrame((state) => {
      const pts = ref.current;
      if (!pts) return;
      const c = state.camera.position;
      pts.position.set(c.x, -2 + ((time.now * 0.8) % 6), c.z - 10);
   });
   return (
      <points ref={ref} geometry={geo} frustumCulled={false}>
         <pointsMaterial vertexColors size={0.12} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
      </points>
   );
}

export default function World({ level, length }: { level: LevelId; length: number }) {
   const light = alienLight(level);
   return (
      <>
         <Sky level={level} />
         {/* the valley floor below the track */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -1.2, -length / 2]}>
            <planeGeometry args={[220, length + 300]} />
            <meshStandardMaterial color={groundColor(level)} roughness={0.95} />
         </mesh>
         <Spores level={level} />
         <hemisphereLight args={["#e9d5ff", groundColor(level), light.hemi]} />
         <ambientLight intensity={light.ambient} />
         <directionalLight position={[-10, 26, 14]} intensity={light.key} color={light.keyColor} />
      </>
   );
}
