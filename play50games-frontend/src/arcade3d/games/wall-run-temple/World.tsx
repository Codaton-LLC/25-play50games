"use client";

// The world round the cliff temple (no collision): a gradient sky with the level's sun that follows the
// camera, the jungle canopy hundreds of metres below (billboard puffs of leaves and mist), carved cliff
// temples on both sides, torches on the pads at night, and level 5's storm flashes. The playable walls,
// columns and pads are CourseView.tsx; Umbra is Umbra.tsx.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, ShaderMaterial, Vector3, type DirectionalLight, type Group, type HemisphereLight } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { createRng } from "@/arcade3d/core/math";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE, fit } from "./assets";
import { BillboardField, tintOf, type Billboard, type FogBand } from "./Billboards";
import { cloudTexture, glowTexture } from "./textures";
import { COLORS, lightningFlash, levelLook, type LevelLook } from "./look";
import type { Course } from "./course";

const SKY_VERT = /* glsl */ `
   varying vec3 vDir;
   void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }
`;
const SKY_FRAG = /* glsl */ `
   varying vec3 vDir;
   uniform vec3 uTop;
   uniform vec3 uMid;
   uniform vec3 uBottom;
   uniform vec3 uSun;
   uniform vec3 uSunDir;
   uniform float uFlash;
   void main() {
      float h = vDir.y;
      vec3 c = mix(uBottom, uMid, smoothstep(-0.08, 0.22, h));
      c = mix(c, uTop, smoothstep(0.2, 0.85, h));
      float d = max(0.0, dot(vDir, uSunDir));
      c += uSun * (pow(d, 900.0) * 1.6 + pow(d, 24.0) * 0.35 + pow(d, 4.0) * 0.12);
      c = mix(c, vec3(0.92, 0.9, 1.0), uFlash * 0.55);
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
   }
`;

export function sunDirection(look: LevelLook, out = new Vector3()): Vector3 {
   const ce = Math.cos(look.sunElevation);
   return out.set(Math.cos(look.sunAzimuth) * ce, Math.sin(look.sunElevation), -Math.sin(look.sunAzimuth) * ce).normalize();
}

function Sky({ look, flash }: { look: LevelLook; flash: { v: number } }) {
   const ref = useRef<Group>(null);
   const mat = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: {
               uTop: { value: new Color(look.skyTop) },
               uMid: { value: new Color(look.skyMid) },
               uBottom: { value: new Color(look.skyBottom) },
               uSun: { value: new Color(look.sun) },
               uSunDir: { value: sunDirection(look) },
               uFlash: { value: 0 },
            },
            vertexShader: SKY_VERT,
            fragmentShader: SKY_FRAG,
            side: BackSide,
            depthWrite: false,
            fog: false,
         }),
      [look],
   );
   useEffect(() => () => mat.dispose(), [mat]);
   useFrame((state) => {
      ref.current?.position.copy(state.camera.position);
      mat.uniforms.uFlash.value = flash.v;
   });
   return (
      <group ref={ref}>
         <mesh material={mat} frustumCulled={false} renderOrder={-30}>
            <sphereGeometry args={[400, 32, 20]} />
         </mesh>
      </group>
   );
}

/** The world's scenery spots from the course (pure). */
export function sceneryOf(course: Course, look: LevelLook, seed = 31) {
   const rnd = createRng(seed ^ (course.level * 7919));
   let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity;
   for (const p of course.pads) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); y0 = Math.min(y0, p.y);
   }
   const canopy: Billboard[] = [];
   const tint = tintOf(look.canopy);
   for (let x = x0 - 70; x < x1 + 70; x += 10) {
      for (let z = z0 - 70; z < z1 + 70; z += 10) {
         canopy.push({ x: x + rnd() * 10, y: y0 - 26 - rnd() * 6, z: z + rnd() * 10, size: 14 + rnd() * 10, r: tint.r * (0.8 + rnd() * 0.4), g: tint.g * (0.85 + rnd() * 0.3), b: tint.b * (0.8 + rnd() * 0.3) });
      }
   }
   const mist: Billboard[] = [];
   const white = tintOf("#ffffff");
   for (let k = 0; k < 40; k++) mist.push({ x: x0 - 40 + rnd() * (x1 - x0 + 80), y: y0 - 14 - rnd() * 8, z: z0 - 40 + rnd() * (z1 - z0 + 80), size: 18 + rnd() * 16, ...white });
   // carved cliff temples ringing the course, beyond its walls
   const cliffs: InstanceSpot[] = [];
   const cx = (x0 + x1) / 2;
   const cz = (z0 + z1) / 2;
   const rad = Math.max(x1 - x0, z1 - z0) / 2 + 45;
   for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + rnd() * 0.2;
      const s = 26 + rnd() * 18;
      const px = cx + Math.cos(a) * (rad + rnd() * 25);
      const pz = cz + Math.sin(a) * (rad + rnd() * 25);
      cliffs.push({ x: px, y: y0 - 30, z: pz, scale: fit(GLB_SIZE.cliff.x, s), sy: (fit(GLB_SIZE.cliff.x, s) * (1.6 + rnd() * 0.8)), rotY: Math.atan2(cx - px, cz - pz) });
   }
   for (const c of cliffs) {
      c.sx = c.scale;
      c.sz = c.scale;
      delete c.scale;
   }
   return { canopy, mist, cliffs };
}

/** Torches on the checkpoint pads (night levels): flickering flame glows. */
function Torches({ course, fog }: { course: Course; fog: FogBand }) {
   const map = useMemo(() => glowTexture(), []);
   useEffect(() => () => map.dispose(), [map]);
   const time = useGameTime();
   const spots = useMemo<Billboard[]>(() => {
      const out: Billboard[] = [];
      for (const p of course.pads) {
         if (!p.cp) continue;
         for (const s of [-1, 1]) out.push({ x: p.x + s * (p.r - 0.5), y: p.y + 2.2, z: p.z + s * (p.r - 0.5), size: 1.4, ...tintOf(COLORS.torch) });
      }
      return out;
   }, [course]);
   const base = useMemo(() => spots.map((s) => s.size), [spots]);
   return (
      <BillboardField
         spots={spots}
         map={map}
         fog={fog}
         additive
         aspect={1}
         live={(d) => {
            for (let i = 0; i < base.length; i++) d[i * 4 + 3] = base[i] * (0.85 + Math.sin(time.now * 13 + i * 2.3) * 0.12 + Math.sin(time.now * 7.1 + i) * 0.08);
            return true;
         }}
      />
   );
}

export default function World({ course, level }: { course: Course; level: LevelId }) {
   const look = levelLook(level);
   const time = useGameTime();
   const flash = useMemo(() => ({ v: 0 }), []);
   const hemi = useRef<HemisphereLight>(null);
   const key = useRef<DirectionalLight>(null);
   const fog = useMemo<FogBand>(() => ({ color: look.fog[0], near: look.fog[1], far: look.fog[2] }), [look]);
   const scenery = useMemo(() => sceneryOf(course, look), [course, look]);
   const leafMap = useMemo(() => cloudTexture(level + 11, "#2f4f2f"), [level]);
   const mistMap = useMemo(() => cloudTexture(level + 3, "#c9d3d0"), [level]);
   useEffect(() => () => { leafMap.dispose(); mistMap.dispose(); }, [leafMap, mistMap]);
   const sun = useMemo(() => sunDirection(look).multiplyScalar(60), [look]);
   useFrame(() => {
      flash.v = look.lightning ? lightningFlash(time.now) : 0;
      if (hemi.current) hemi.current.intensity = look.hemi + flash.v * 1.3;
      if (key.current) key.current.intensity = look.keyIntensity + flash.v * 0.8;
   });
   return (
      <group>
         <Sky look={look} flash={flash} />
         <hemisphereLight ref={hemi} args={[look.hemiSky, look.hemiGround, look.hemi]} />
         <directionalLight ref={key} position={[sun.x, Math.max(18, sun.y), sun.z]} intensity={look.keyIntensity} color={look.key} />
         <BillboardField spots={scenery.canopy} map={leafMap} fog={fog} opacity={1} aspect={1.6} renderOrder={-6} />
         <BillboardField spots={scenery.mist} map={mistMap} fog={fog} opacity={0.55} aspect={1.6} renderOrder={-5} />
         <InstancedModel asset={ASSETS.cliff} spots={scenery.cliffs} fallback={null} />
         {look.torches ? <Torches course={course} fog={fog} /> : null}
      </group>
   );
}
