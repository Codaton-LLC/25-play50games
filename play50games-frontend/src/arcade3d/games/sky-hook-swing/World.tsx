"use client";

// The sky the docks hang in (no collision): a gradient dome with the level's sun that follows the
// camera, the cloud sea under the run (billboard puffs and cloud banks), far floating islands and
// windmills, airships drifting past, level 4's wind streaks and level 5's storm flashes. The
// playable decks, rings and props are Docks.tsx; the galleon is Galleon.tsx.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, ShaderMaterial, Vector3, type DirectionalLight, type Group, type HemisphereLight } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { createRng } from "@/arcade3d/core/math";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE, fit } from "./assets";
import { BillboardField, tintOf, type Billboard, type FogBand } from "./Billboards";
import { cloudTexture, streakTexture } from "./textures";
import { lightningFlash, levelLook, type LevelLook } from "./look";
import { gustAt, type Course } from "./course";
import type { VisualClock } from "./Docks";

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

/** The world's scenery spots, from the course and a seed (pure). */
export function sceneryOf(course: Course, look: LevelLook, seed = 7) {
   const rnd = createRng(seed ^ (course.level * 7919));
   const start = course.islands[0].x - 60;
   const end = course.islands[course.finish].x + 90;
   const puffs: Billboard[] = [];
   const far: Billboard[] = [];
   const shade = tintOf(look.cloud);
   for (let x = start; x < end; x += 9) {
      for (let k = 0; k < 3; k++) {
         const z = (rnd() - 0.5) * 120;
         puffs.push({ x: x + rnd() * 9, y: -9 - rnd() * 5 - Math.abs(z) * 0.04, z, size: 12 + rnd() * 10, ...shade });
      }
   }
   for (let x = start - 60; x < end + 60; x += 26) {
      for (const side of [-1, 1]) {
         far.push({ x: x + rnd() * 20, y: 4 + rnd() * 22, z: side * (95 + rnd() * 70), size: 30 + rnd() * 26, ...shade });
      }
   }
   const banks: InstanceSpot[] = [];
   for (let x = start; x < end; x += 48) {
      for (const side of [-1, 1]) {
         const w = 22 + rnd() * 16;
         banks.push({ x: x + rnd() * 14, y: -24 - rnd() * 4, z: side * (22 + rnd() * 26), sx: w / GLB_SIZE.bank.x, sy: 7 / GLB_SIZE.bank.y, sz: w / GLB_SIZE.bank.z, rotY: Math.PI / 2 + (rnd() - 0.5) * 0.5 });
      }
   }
   // far islands (the set's own swing islands and windmills), off the run on both sides
   const islands: InstanceSpot[] = [];
   const mills: InstanceSpot[] = [];
   for (let x = start + 20; x < end; x += 38) {
      const side = rnd() < 0.5 ? -1 : 1;
      const s = 7 + rnd() * 9;
      const spot = { x: x + rnd() * 20, y: -6 + rnd() * 14, z: side * (34 + rnd() * 40), scale: s, rotY: rnd() * Math.PI * 2 };
      (rnd() < 0.3 ? mills : islands).push(spot);
   }
   // airships drifting by
   const ships: Array<{ x: number; y: number; z: number; size: number; speed: number; span: number }> = [];
   for (let x = start + 40; x < end; x += 55) {
      const side = rnd() < 0.5 ? -1 : 1;
      ships.push({ x: x + rnd() * 30, y: 10 + rnd() * 18, z: side * (40 + rnd() * 50), size: 8 + rnd() * 10, speed: 0.6 + rnd() * 1.2, span: end - start + 120 });
   }
   return { puffs, far, banks, islands, mills, ships, start: start - 60 };
}

function Streaks({ course, clock, fog }: { course: Course; clock: VisualClock; fog: FogBand }) {
   const map = useMemo(() => streakTexture(), []);
   useEffect(() => () => map.dispose(), [map]);
   const spots = useMemo(() => {
      const rnd = createRng(4242);
      const out: Billboard[] = [];
      const end = course.islands[course.finish].x + 30;
      for (let i = 0; i < 90; i++) out.push({ x: rnd() * end, y: -2 + rnd() * 20, z: (rnd() - 0.5) * 34, size: 0.5 + rnd() * 0.4 });
      return out;
   }, [course]);
   const base = useMemo(() => spots.map((s) => s.x), [spots]);
   const size = useMemo(() => spots.map((s) => s.size), [spots]);
   const end = course.islands[course.finish].x + 30;
   return (
      <BillboardField
         spots={spots}
         map={map}
         fog={fog}
         additive
         opacity={0.55}
         aspect={9}
         stretch
         live={(data) => {
            const t = clock.ms / 1000;
            const g = gustAt(course, clock.ms);
            const k = Math.min(1, Math.abs(g) / course.gust);
            for (let i = 0; i < base.length; i++) {
               let x = base[i] + t * (14 + (i % 5) * 3) * Math.sign(g || 1);
               x = ((x % end) + end) % end;
               data[i * 4] = x;
               data[i * 4 + 3] = size[i] * (0.25 + 0.75 * k);
            }
            return true;
         }}
      />
   );
}

export default function World({ course, level, clock }: { course: Course; level: LevelId; clock: VisualClock }) {
   const look = levelLook(level);
   const time = useGameTime();
   const flash = useMemo(() => ({ v: 0 }), []);
   const hemi = useRef<HemisphereLight>(null);
   const key = useRef<DirectionalLight>(null);
   const fog = useMemo<FogBand>(() => ({ color: look.fog[0], near: look.fog[1], far: look.fog[2] }), [look]);
   const scenery = useMemo(() => sceneryOf(course, look), [course, look]);
   const puffMap = useMemo(() => cloudTexture(level, look.cloudShade), [level, look]);
   useEffect(() => () => puffMap.dispose(), [puffMap]);
   const sun = useMemo(() => sunDirection(look).multiplyScalar(60), [look]);
   const shipScale = (size: number) => fit(GLB_SIZE.airship.y, size);
   useFrame(() => {
      flash.v = look.lightning ? lightningFlash(time.now) : 0;
      if (hemi.current) hemi.current.intensity = look.hemi + flash.v * 1.4;
      if (key.current) key.current.intensity = look.keyIntensity + flash.v * 0.8;
   });
   return (
      <group>
         <Sky look={look} flash={flash} />
         <hemisphereLight ref={hemi} args={[look.hemiSky, look.hemiGround, look.hemi]} />
         <directionalLight ref={key} position={[sun.x, Math.max(18, sun.y), sun.z]} intensity={look.keyIntensity} color={look.key} />
         <BillboardField spots={scenery.puffs} map={puffMap} fog={fog} opacity={0.96} aspect={1.6} renderOrder={-5} />
         <BillboardField spots={scenery.far} map={puffMap} fog={fog} opacity={0.85} aspect={1.6} renderOrder={-6} />
         <InstancedModel asset={ASSETS.bank} spots={scenery.banks} fallback={null} />
         <InstancedModel asset={ASSETS.island} spots={scenery.islands} fallback={null} />
         <InstancedModel asset={ASSETS.windmill} spots={scenery.mills} fallback={null} />
         <DynamicInstancedModel
            asset={ASSETS.airship}
            count={scenery.ships.length}
            update={(i, m) => {
               const s = scenery.ships[i];
               if (!s) return false;
               const t = clock.ms / 1000;
               let x = s.x + t * s.speed;
               x = scenery.start + ((((x - scenery.start) % s.span) + s.span) % s.span);
               const k = shipScale(s.size);
               m.makeScale(k, k, k);
               m.setPosition(x, s.y + Math.sin(t * 0.5 + i) * 0.6, s.z);
            }}
         />
         {course.gust !== 0 ? <Streaks course={course} clock={clock} fog={fog} /> : null}
      </group>
   );
}
