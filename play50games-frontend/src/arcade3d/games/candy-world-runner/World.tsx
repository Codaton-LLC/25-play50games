"use client";

// The candy sky (no collision): a gradient dome that travels with the camera (pink candy day, level 3's
// frosty blue, level 5's golden palace dusk), soft cotton-candy clouds, falling sprinkles that follow
// the camera, a meadow of candy floss far below the road, and the lights.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, BufferAttribute, BufferGeometry, Color, ShaderMaterial, type Group, type Points } from "three";
import { createRng } from "@/arcade3d/core/math";
import { useGameTime } from "@/arcade3d/core/gameTime";
import type { LevelId } from "@/arcade3d/types";
import { candyLight, skyColors } from "./look";

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
      vec3 d = normalize(vPos);
      float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 c = mix(uBottom, uMid, smoothstep(0.35, 0.55, h));
      c = mix(c, uTop, smoothstep(0.55, 1.0, h));
      // cotton-candy clouds
      float cl = sin(d.x * 9.0 + d.z * 4.0) * sin(d.z * 7.0 - d.x * 3.0);
      c = mix(c, vec3(1.0, 0.95, 0.98), smoothstep(0.55, 0.95, cl) * smoothstep(0.52, 0.7, h) * 0.6);
      gl_FragColor = vec4(c, 1.0);
   }
`;

function Sky({ level }: { level: LevelId }) {
   const ref = useRef<Group>(null);
   const material = useMemo(() => {
      const [t, m, b] = skyColors(level);
      return new ShaderMaterial({
         uniforms: { uTop: { value: new Color(t) }, uMid: { value: new Color(m) }, uBottom: { value: new Color(b) } },
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

/** Sprinkles drifting down round the camera (one Points draw). */
function Sprinkles() {
   const time = useGameTime();
   const ref = useRef<Points>(null);
   const N = 360;
   const geo = useMemo(() => {
      const rnd = createRng(0xca7d);
      const p = new Float32Array(N * 3);
      const c = new Float32Array(N * 3);
      const pal = [[1, 0.6, 0.8], [0.6, 0.9, 1], [1, 0.95, 0.5], [0.7, 1, 0.7]];
      for (let i = 0; i < N; i++) {
         p[i * 3] = (rnd() - 0.5) * 50;
         p[i * 3 + 1] = rnd() * 24;
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
   }, []);
   useEffect(() => () => geo.dispose(), [geo]);
   useFrame((state) => {
      const pts = ref.current;
      if (!pts) return;
      const c = state.camera.position;
      pts.position.set(c.x, c.y - 8 - ((time.now * 1.2) % 12), c.z - 10);
   });
   return (
      <points ref={ref} geometry={geo} frustumCulled={false}>
         <pointsMaterial vertexColors size={0.14} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
      </points>
   );
}

export default function World({ level, length }: { level: LevelId; length: number }) {
   const light = candyLight(level);
   return (
      <>
         <Sky level={level} />
         {/* the candy-floss meadow below the road */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -1.2, -length / 2]}>
            <planeGeometry args={[220, length + 300]} />
            <meshStandardMaterial color={level === 3 ? "#bfdbfe" : level === 5 ? "#fcd34d" : "#fbcfe8"} roughness={0.95} />
         </mesh>
         <Sprinkles />
         <hemisphereLight args={["#fff1f2", level === 3 ? "#bfdbfe" : "#fbcfe8", light.hemi]} />
         <ambientLight intensity={light.ambient} />
         <directionalLight position={[12, 30, 10]} intensity={light.key} color={level === 5 ? "#fde68a" : "#fff7ed"} />
      </>
   );
}
