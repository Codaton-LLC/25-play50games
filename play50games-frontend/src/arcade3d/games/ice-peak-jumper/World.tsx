"use client";

// The world round the peak (no collision): a sky that travels with the camera (day blue, or level 4's
// moonlit night), great frozen peaks standing far off on every side (m2IcePeakBg, one big one behind
// the climb: the hidden ledge is "behind the peak"), a frozen sea of snow far below, falling snow that
// follows the camera, and the lights (level 4: a moon and a cold rim; the hero carries a small light).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, BufferAttribute, BufferGeometry, Color, ShaderMaterial, type Group, type PointLight, type Points } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { createRng } from "@/arcade3d/core/math";
import { useGameTime } from "@/arcade3d/core/gameTime";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, GLB_SIZE } from "./assets";
import { COLORS, peakLight } from "./look";
import type { Course } from "./course";
import type { PeakRun } from "./rules";

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
   uniform float uNight;
   void main() {
      vec3 d = normalize(vPos);
      float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 c = mix(uBottom, uMid, smoothstep(0.35, 0.55, h));
      c = mix(c, uTop, smoothstep(0.55, 1.0, h));
      // stars at night
      float s = fract(sin(dot(floor(d.xz * 180.0 + d.y * 37.0), vec2(12.9898, 78.233))) * 43758.5453);
      c += uNight * step(0.9975, s) * smoothstep(0.55, 0.8, h) * 0.9;
      gl_FragColor = vec4(c, 1.0);
   }
`;

function Sky({ night }: { night: boolean }) {
   const ref = useRef<Group>(null);
   const material = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: {
               uTop: { value: new Color(night ? COLORS.nightTop : COLORS.skyTop) },
               uMid: { value: new Color(night ? COLORS.nightMid : COLORS.skyMid) },
               uBottom: { value: new Color(night ? COLORS.nightBottom : COLORS.skyBottom) },
               uNight: { value: night ? 1 : 0 },
            },
            vertexShader: SKY_VERT,
            fragmentShader: SKY_FRAG,
            depthWrite: false,
            toneMapped: false,
            side: BackSide,
            fog: false,
         }),
      [night],
   );
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

/** Falling snow in a box that follows the camera (one Points draw). */
function Snowfall({ night }: { night: boolean }) {
   const time = useGameTime();
   const ref = useRef<Points>(null);
   const N = 500;
   const geo = useMemo(() => {
      const rnd = createRng(0x5eed);
      const p = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
         p[i * 3] = (rnd() - 0.5) * 50;
         p[i * 3 + 1] = rnd() * 30;
         p[i * 3 + 2] = (rnd() - 0.5) * 50;
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(p, 3));
      return g;
   }, []);
   useEffect(() => () => geo.dispose(), [geo]);
   useFrame((state) => {
      const pts = ref.current;
      if (!pts) return;
      const c = state.camera.position;
      // the flakes span 30 m over the camera's feet and drift down through it, wrapping
      pts.position.set(c.x, c.y - 12 - ((time.now * 1.6) % 18), c.z);
      pts.rotation.y = time.now * 0.03;
   });
   return (
      <points ref={ref} geometry={geo} frustumCulled={false}>
         <pointsMaterial color={night ? "#c7d2fe" : "#ffffff"} size={0.12} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
      </points>
   );
}

/** A light that rides with the hero (a little warmth on the ice; brighter at night). */
function HeroLight({ run, night }: { run: PeakRun; night: boolean }) {
   const ref = useRef<PointLight>(null);
   useFrame(() => {
      const l = ref.current;
      if (!l) return;
      l.position.set(run.hero.x, run.hero.y + 3, run.hero.z + 1);
   });
   return <pointLight ref={ref} color={night ? "#fde68a" : "#ffffff"} distance={night ? 14 : 10} decay={1.4} intensity={night ? 14 : 4} />;
}

export default function World({ run, course }: { run: PeakRun; course: Course }) {
   const night = course.config.night;
   const light = peakLight(course.level, night);
   const peaks = useMemo(() => {
      const rnd = createRng(0x1ce + course.level);
      const out: InstanceSpot[] = [];
      // the climb's bounds
      const xs = course.plats.map((p) => p.x);
      const zs = course.plats.map((p) => p.z);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      const top = Math.max(...course.plats.map((p) => p.y));
      // the great peak behind the climb, then a ring of far ones
      out.push({ x: cx - 6, y: -30, z: Math.min(...zs) - 45, sx: 90 / GLB_SIZE.peak.x, sy: (top + 70) / GLB_SIZE.peak.y, sz: 70 / GLB_SIZE.peak.z, rotY: 0.4 });
      for (let i = 0; i < 9; i++) {
         const a = (i / 9) * Math.PI * 2 + rnd() * 0.3;
         const r = 120 + rnd() * 50;
         const h = 50 + rnd() * 60;
         const w = 60 + rnd() * 50;
         out.push({ x: cx + Math.sin(a) * r, y: -40, z: cz + Math.cos(a) * r, sx: w / GLB_SIZE.peak.x, sy: h / GLB_SIZE.peak.y, sz: w / GLB_SIZE.peak.z, rotY: rnd() * 6.28 });
      }
      return { list: out, cx, cz };
   }, [course]);
   return (
      <>
         <Sky night={night} />
         <InstancedModel asset={ASSETS.peak} spots={peaks.list} fallback={null} />
         {/* the snowfield far below */}
         <mesh rotation-x={-Math.PI / 2} position={[peaks.cx, course.floor - 14, peaks.cz]}>
            <circleGeometry args={[260, 48]} />
            <meshStandardMaterial color={night ? "#3b4a7a" : "#eef6ff"} roughness={0.95} />
         </mesh>
         <Snowfall night={night} />
         <hemisphereLight args={[night ? "#8ea2ff" : "#e0f2ff", night ? "#1c2340" : "#9fb7d1", light.hemi]} />
         <ambientLight intensity={light.ambient} color={night ? "#94a3ff" : "#ffffff"} />
         <directionalLight position={[18, 40, 12]} intensity={light.key} color={night ? "#c7d2fe" : "#fff7ec"} />
         <HeroLight run={run} night={night} />
      </>
   );
}
