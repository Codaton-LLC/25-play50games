"use client";

// The big top around the show (no collision): a striped canvas wall and roof whose stripes are
// drained to ash grey and turn red behind the hero as the show goes on (the world's colour coming
// back), the sawdust ring and its curbs, the safety net, the tiered stands with the crowd (grey
// silhouettes that light up red as the hero passes their band), the king poles, strings of bulbs,
// sweeping spot beams and a few side-show tents (m2BigTopTentBg). Playable things are Course.tsx.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BackSide, CanvasTexture, Color, DoubleSide, Object3D, RepeatWrapping, ShaderMaterial, SRGBColorSpace, type InstancedMesh, type Mesh } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, GLB_SIZE } from "./assets";
import { COLORS, levelLook } from "./look";
import type { CannonRun, Course } from "./rules";

/** The tent's footprint for a course: centred on the show, wide enough for the stands. */
export function tentOf(course: Course): { cx: number; cz: number; r: number } {
   let minZ = 0;
   let maxZ = 0;
   for (const c of course.cannons) {
      minZ = Math.min(minZ, c.z);
      maxZ = Math.max(maxZ, c.z);
   }
   if (course.finish) minZ = Math.min(minZ, course.finish.z);
   const cz = (minZ + maxZ) / 2;
   const r = Math.max(42, (maxZ - minZ) / 2 + 26);
   return { cx: 0, cz, r };
}

const CANVAS_VERT = /* glsl */ `
   varying vec3 vPos;
   varying vec2 vUv;
   void main() {
      vUv = uv;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vPos = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
   }
`;
const CANVAS_FRAG = /* glsl */ `
   varying vec3 vPos;
   varying vec2 vUv;
   uniform float uStripes;
   uniform float uRedZ;
   uniform vec3 uGrey;
   uniform vec3 uCream;
   uniform vec3 uRed;
   uniform vec3 uFog;
   uniform float uDark;
   void main() {
      float s = step(0.5, fract(vUv.x * uStripes));
      // red comes back behind the hero (z above uRedZ), softly
      float lit = smoothstep(uRedZ - 6.0, uRedZ + 6.0, vPos.z);
      vec3 hot = mix(uCream, uRed, s);
      vec3 cold = mix(uCream * 0.62, uGrey, s);
      vec3 c = mix(cold, hot, lit);
      // darker towards the roof's peak and the floor seam
      c *= mix(1.0, 0.55, smoothstep(0.55, 1.0, vUv.y)) * uDark;
      gl_FragColor = vec4(c, 1.0);
   }
`;

function canvasMaterial(look: ReturnType<typeof levelLook>, stripes: number): ShaderMaterial {
   return new ShaderMaterial({
      uniforms: {
         uStripes: { value: stripes },
         uRedZ: { value: 10 },
         uGrey: { value: new Color(COLORS.ash) },
         uCream: { value: new Color(COLORS.cream) },
         uRed: { value: new Color(COLORS.red) },
         uFog: { value: new Color(look.fog) },
         uDark: { value: look.canvas },
      },
      vertexShader: CANVAS_VERT,
      fragmentShader: CANVAS_FRAG,
      side: BackSide,
   });
}

function netTexture(): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = c.height = 64;
   const g = c.getContext("2d")!;
   g.clearRect(0, 0, 64, 64);
   g.strokeStyle = "rgba(235,225,205,0.85)";
   g.lineWidth = 3;
   g.strokeRect(0, 0, 64, 64);
   const t = new CanvasTexture(c);
   t.wrapS = t.wrapT = RepeatWrapping;
   t.colorSpace = SRGBColorSpace;
   return t;
}

function sawdustTexture(): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = c.height = 256;
   const g = c.getContext("2d")!;
   const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
   grd.addColorStop(0, "#a8957a");
   grd.addColorStop(0.7, "#8a7a64");
   grd.addColorStop(1, "#5d5246");
   g.fillStyle = grd;
   g.fillRect(0, 0, 256, 256);
   let s = 7;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(${60 + rnd() * 80},${50 + rnd() * 60},${40 + rnd() * 40},0.35)`;
      g.fillRect(rnd() * 256, rnd() * 256, 2, 2);
   }
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   return t;
}

const DUMMY = new Object3D();
const GREY = new Color(COLORS.crowdGrey);
const RED = new Color(COLORS.crowdRed);

/** The crowd: one instanced mesh of silhouettes on the stands' tiers, coloured red band by band. */
function Crowd({ run, tent }: { run: CannonRun; tent: { cx: number; cz: number; r: number } }) {
   const ref = useRef<InstancedMesh>(null);
   const seats = useMemo(() => {
      const out: { x: number; y: number; z: number; band: number; ph: number }[] = [];
      const bands = run.course.crowd;
      const n = 150;
      for (let i = 0; i < n; i++) {
         const a = (i / n) * Math.PI * 2;
         const tier = i % 3;
         const r = tent.r - 7 + tier * 1.8;
         const x = tent.cx + Math.sin(a) * r;
         const z = tent.cz + Math.cos(a) * r;
         let band = -1;
         bands.forEach((b, k) => {
            if (z <= b.z0 + 6 && z >= b.z1 - 6 && Math.sign(x) === b.side) band = k;
         });
         out.push({ x, y: 1.6 + tier * 1.3, z, band, ph: (i * 0.618) % 1 });
      }
      return out;
   }, [run.course, tent]);
   const colored = useRef<number[]>([]);
   useFrame((state) => {
      const m = ref.current;
      if (!m) return;
      const t = state.clock.elapsedTime;
      for (let i = 0; i < seats.length; i++) {
         const s = seats[i];
         const on = s.band >= 0 && run.crowdLit[s.band] === 1;
         const hop = on ? Math.max(0, Math.sin(t * 7 + s.ph * 6.28)) * 0.25 : 0;
         DUMMY.position.set(s.x, s.y + hop, s.z);
         DUMMY.rotation.set(0, Math.atan2(tent.cx - s.x, tent.cz - s.z), 0);
         DUMMY.scale.set(1.05, 1.35, 0.8);
         DUMMY.updateMatrix();
         m.setMatrixAt(i, DUMMY.matrix);
         const want = on ? 1 : 0;
         if (colored.current[i] !== want) {
            colored.current[i] = want;
            m.setColorAt(i, on ? RED : GREY);
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
         }
      }
      m.instanceMatrix.needsUpdate = true;
   });
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, seats.length]} frustumCulled={false}>
         <capsuleGeometry args={[0.45, 0.8, 3, 8]} />
         <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
   );
}

/** Sweeping spot beams from the roof (additive cones, one draw call). */
function Beams({ tent, count }: { tent: { cx: number; cz: number; r: number }; count: number }) {
   const ref = useRef<InstancedMesh>(null);
   useFrame((state) => {
      const m = ref.current;
      if (!m) return;
      const t = state.clock.elapsedTime;
      for (let i = 0; i < count; i++) {
         const a = (i / count) * Math.PI * 2 + t * 0.15;
         const sx = tent.cx + Math.sin(a) * tent.r * 0.55;
         const sz = tent.cz + Math.cos(a) * tent.r * 0.55;
         DUMMY.position.set(sx, 15, sz);
         DUMMY.rotation.set(Math.sin(t * 0.6 + i) * 0.35, 0, Math.cos(t * 0.5 + i * 2) * 0.35);
         DUMMY.scale.set(1, 1, 1);
         DUMMY.updateMatrix();
         m.setMatrixAt(i, DUMMY.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
   });
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={6}>
         <coneGeometry args={[4.2, 30, 20, 1, true]} />
         <meshBasicMaterial color="#fff1c9" transparent opacity={0.07} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </instancedMesh>
   );
}

/** Strings of bulbs from the king poles to the wall (instanced; warm as the hero passes). */
function Bulbs({ run, tent }: { run: CannonRun; tent: { cx: number; cz: number; r: number } }) {
   const ref = useRef<InstancedMesh>(null);
   const spots = useMemo(() => {
      const out: { x: number; y: number; z: number }[] = [];
      const strings = 14;
      const per = 16;
      for (let s = 0; s < strings; s++) {
         const a = (s / strings) * Math.PI * 2;
         const x0 = tent.cx;
         const z0 = tent.cz;
         const x1 = tent.cx + Math.sin(a) * (tent.r - 2);
         const z1 = tent.cz + Math.cos(a) * (tent.r - 2);
         for (let k = 1; k <= per; k++) {
            const t = k / (per + 1);
            out.push({ x: x0 + (x1 - x0) * t, y: 34 - 16 * t - Math.sin(t * Math.PI) * 3, z: z0 + (z1 - z0) * t });
         }
      }
      return out;
   }, [tent]);
   const lit = useRef<number[]>([]);
   const warm = useMemo(() => new Color("#ffcf6e"), []);
   const dim = useMemo(() => new Color("#5b5650"), []);
   useEffect(() => {
      const m = ref.current;
      if (!m) return;
      spots.forEach((s, i) => {
         DUMMY.position.set(s.x, s.y, s.z);
         DUMMY.rotation.set(0, 0, 0);
         DUMMY.scale.setScalar(1);
         DUMMY.updateMatrix();
         m.setMatrixAt(i, DUMMY.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
   }, [spots]);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const hz = run.hero.z;
      let changed = false;
      for (let i = 0; i < spots.length; i++) {
         const on = spots[i].z > hz - 4 ? 1 : 0;
         if (lit.current[i] !== on) {
            lit.current[i] = on;
            m.setColorAt(i, on ? warm : dim);
            changed = true;
         }
      }
      if (changed && m.instanceColor) m.instanceColor.needsUpdate = true;
   });
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} frustumCulled={false}>
         <sphereGeometry args={[0.18, 8, 6]} />
         <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
   );
}

export default function World({ run }: { run: CannonRun }) {
   const course = run.course;
   const look = levelLook(course.level);
   const tent = useMemo(() => tentOf(course), [course]);
   const wall = useMemo(() => canvasMaterial(look, 36), [look]);
   const roof = useMemo(() => canvasMaterial(look, 24), [look]);
   const net = useMemo(() => netTexture(), []);
   const dust = useMemo(() => sawdustTexture(), []);
   useEffect(
      () => () => {
         wall.dispose();
         roof.dispose();
         net.dispose();
         dust.dispose();
      },
      [wall, roof, net, dust],
   );
   net.repeat.set(tent.r / 1.2, tent.r / 1.2);
   const netRef = useRef<Mesh>(null);
   useFrame(() => {
      // the colour returns behind the hero (L5: once Ashbag is down, everywhere)
      const z = run.boss && (run.boss.step === "defeat" || run.boss.step === "done") ? -999 : run.hero.z + 4;
      const cur = wall.uniforms.uRedZ.value as number;
      const next = Math.min(cur, z);
      wall.uniforms.uRedZ.value = next;
      roof.uniforms.uRedZ.value = next;
   });
   const sideTents = useMemo<InstanceSpot[]>(() => {
      const k = 9 / GLB_SIZE.tent.x;
      return [50, 130, 230, 310].map((deg, i) => {
         const a = (deg * Math.PI) / 180;
         return { x: tent.cx + Math.sin(a) * (tent.r - 15), y: 0, z: tent.cz + Math.cos(a) * (tent.r - 15), scale: k, rotY: a + Math.PI + i };
      });
   }, [tent]);
   const H = 20;
   return (
      <>
         {/* the canvas wall and the conical roof */}
         <mesh position={[tent.cx, H / 2, tent.cz]} material={wall} frustumCulled={false}>
            <cylinderGeometry args={[tent.r, tent.r, H, 72, 1, true]} />
         </mesh>
         <mesh position={[tent.cx, H + 14, tent.cz]} material={roof} frustumCulled={false}>
            <coneGeometry args={[tent.r * 1.02, 28, 72, 1, true]} />
         </mesh>
         {/* the sawdust floor, the ring curbs */}
         <mesh rotation-x={-Math.PI / 2} position={[tent.cx, 0, tent.cz]}>
            <circleGeometry args={[tent.r, 64]} />
            <meshStandardMaterial map={dust} roughness={1} />
         </mesh>
         {[0.32, 0.62].map((f, i) => (
            <mesh key={i} rotation-x={-Math.PI / 2} position={[tent.cx, 0.05, tent.cz]}>
               <ringGeometry args={[tent.r * f, tent.r * f + 0.6, 64]} />
               <meshStandardMaterial color={i === 0 ? COLORS.cream : COLORS.ash} roughness={0.7} />
            </mesh>
         ))}
         {/* the safety net */}
         <mesh ref={netRef} rotation-x={-Math.PI / 2} position={[tent.cx, 0.9, tent.cz]} renderOrder={2}>
            <circleGeometry args={[tent.r - 9, 48]} />
            <meshBasicMaterial map={net} transparent opacity={0.22} depthWrite={false} />
         </mesh>
         {/* the stands: three tiers round the wall */}
         {[0, 1, 2].map((t) => (
            <mesh key={t} position={[tent.cx, 0.4 + t * 1.3, tent.cz]}>
               <cylinderGeometry args={[tent.r - 6.2 + t * 1.8, tent.r - 6.2 + t * 1.8, 0.8 + t * 1.3 * 2, 64, 1, true]} />
               <meshStandardMaterial color={t % 2 ? "#4a4440" : "#57504a"} roughness={0.9} side={DoubleSide} />
            </mesh>
         ))}
         <Crowd run={run} tent={tent} />
         {/* the king poles */}
         {[-1, 1].map((s) => (
            <mesh key={s} position={[tent.cx + s * 13, 22, tent.cz]}>
               <cylinderGeometry args={[0.45, 0.6, 44, 12]} />
               <meshStandardMaterial color={COLORS.pole} metalness={0.3} roughness={0.6} />
            </mesh>
         ))}
         <Bulbs run={run} tent={tent} />
         <Beams tent={tent} count={5} />
         <InstancedModel asset={ASSETS.tent} spots={sideTents} fallback={null} />
         <hemisphereLight args={[look.sky, look.ground, look.hemi]} />
         <ambientLight intensity={look.ambient} />
         <directionalLight position={[10, 40, 18]} intensity={look.key} color="#fff1dc" />
         <pointLight position={[0, 16, tent.cz]} intensity={look.point} distance={tent.r * 1.6} color="#ffd9a0" />
      </>
   );
}
