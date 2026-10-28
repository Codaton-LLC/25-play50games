"use client";

// Everything around the course that never collides: the sky (gradient, sun or moon, stars), the
// open sea (world-space waves, foam round the stacks, sun glitter), cloud banks, the far cliff
// islands, lighthouses and buoys, the extra key / rim light of the level's palette, and on L5 the
// storm (lightning flashes and rain). Palette: look.ts. Layout: stations.ts. Visual only.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   BackSide,
   BufferAttribute,
   BufferGeometry,
   CanvasTexture,
   Color,
   InstancedBufferAttribute,
   InstancedBufferGeometry,
   PlaneGeometry,
   ShaderMaterial,
   SRGBColorSpace,
   UniformsLib,
   UniformsUtils,
   Vector3,
   Vector4,
   type AmbientLight,
   type Mesh,
} from "three";
import { CulledModel } from "./Culled";
import { Starfield } from "../../core/env";
import { useGameTime } from "../../core/gameTime";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { useQuality } from "../../core/quality";
import { createRng } from "../../core/math";
import type { LevelId } from "../../types";
import { ASSETS, BOUNDS } from "./assets";
import { lightningFlash, lookFor, type ZipLook } from "./look";
import { SEA_Y, scenery, stations, type Station } from "./layout";
import { LEVELS } from "./levels";

// ---------- sky ----------

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
   vDir = normalize(position);
   gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uSun; uniform vec3 uSunColor;
uniform float uSunSize; uniform float uGlow; uniform float uFlash;
varying vec3 vDir;
void main() {
   vec3 d = normalize(vDir);
   float h = d.y;
   vec3 c = mix(uHorizon, uMid, smoothstep(-0.02, 0.22, h));
   c = mix(c, uTop, smoothstep(0.2, 0.85, h));
   float s = max(0.0, dot(d, normalize(uSun)));
   float disc = smoothstep(cos(uSunSize), cos(uSunSize * 0.82), s);
   float glow = pow(s, 18.0) * uGlow + pow(s, 3.0) * uGlow * 0.18;
   c += uSunColor * (glow + disc * 1.4);
   c = mix(c, vec3(0.85, 0.82, 1.0), uFlash * 0.55 * smoothstep(-0.1, 0.4, h));
   gl_FragColor = vec4(c, 1.0);
}`;

function Sky({ look, flash }: { look: ZipLook; flash: { value: number } }) {
   const ref = useRef<Mesh>(null);
   const material = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: {
               uTop: { value: new Color(look.sky.top) },
               uMid: { value: new Color(look.sky.mid) },
               uHorizon: { value: new Color(look.sky.horizon) },
               uSun: { value: new Vector3(...look.sun.dir) },
               uSunColor: { value: new Color(look.sun.color) },
               uSunSize: { value: look.sun.size },
               uGlow: { value: look.sun.glow },
               uFlash: flash,
            },
            vertexShader: SKY_VERT,
            fragmentShader: SKY_FRAG,
            side: BackSide,
            depthWrite: false,
            fog: false,
            toneMapped: false,
         }),
      [look, flash]
   );
   useEffect(() => () => material.dispose(), [material]);
   useFrame((state) => ref.current?.position.copy(state.camera.position), FRAME_PRIORITY.visuals);
   return (
      <mesh ref={ref} material={material} frustumCulled={false} renderOrder={-20}>
         <sphereGeometry args={[360, 32, 16]} />
      </mesh>
   );
}

// ---------- sea ----------

const MAX_STACKS = 10;
const SEA_VERT = /* glsl */ `
#include <fog_pars_vertex>
uniform float uTime; uniform float uAmp;
varying vec3 vWorld;
float waves(vec2 p) {
   return sin(dot(p, vec2(0.11, 0.05)) + uTime * 0.9) * 0.55
        + sin(dot(p, vec2(-0.07, 0.16)) + uTime * 1.3) * 0.3
        + sin(dot(p, vec2(0.23, -0.19)) + uTime * 1.9) * 0.15;
}
void main() {
   vec4 world = modelMatrix * vec4(position, 1.0);
   world.y += waves(world.xz) * uAmp;
   vWorld = world.xyz;
   vec4 mvPosition = viewMatrix * world;
   gl_Position = projectionMatrix * mvPosition;
   #include <fog_vertex>
}`;
const SEA_FRAG = /* glsl */ `
#include <fog_pars_fragment>
uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam; uniform vec3 uSun; uniform vec3 uSunColor;
uniform float uGlitter; uniform vec4 uStacks[${MAX_STACKS}]; uniform float uFlash;
varying vec3 vWorld;
vec2 grad(vec2 p) {
   vec2 g = vec2(0.0);
   g += vec2(0.11, 0.05) * cos(dot(p, vec2(0.11, 0.05)) + uTime * 0.9) * 0.55;
   g += vec2(-0.07, 0.16) * cos(dot(p, vec2(-0.07, 0.16)) + uTime * 1.3) * 0.3;
   g += vec2(0.23, -0.19) * cos(dot(p, vec2(0.23, -0.19)) + uTime * 1.9) * 0.15;
   g += vec2(0.83, 0.47) * cos(dot(p, vec2(0.83, 0.47)) + uTime * 2.7) * 0.035;
   g += vec2(-0.61, 0.97) * cos(dot(p, vec2(-0.61, 0.97)) + uTime * 3.1) * 0.03;
   g += vec2(1.37, -0.29) * cos(dot(p, vec2(1.37, -0.29)) + uTime * 3.7) * 0.02;
   g += vec2(0.19, -1.53) * cos(dot(p, vec2(0.19, -1.53)) + uTime * 4.3) * 0.018;
   return g;
}
void main() {
   vec3 n = normalize(vec3(-grad(vWorld.xz).x * 2.2, 1.0, -grad(vWorld.xz).y * 2.2));
   vec3 v = normalize(cameraPosition - vWorld);
   float fres = pow(1.0 - max(0.0, dot(n, v)), 3.0);
   vec3 c = mix(uShallow, uDeep, clamp(fres * 1.2 + 0.15, 0.0, 1.0));
   // the sun's (moon's) path on the water: a soft streak, glinting where the small waves face it
   vec3 r = reflect(-v, n);
   float path = pow(max(0.0, dot(r, normalize(uSun))), 40.0);
   float glint = pow(max(0.0, dot(r, normalize(uSun))), 400.0);
   float dist = length(cameraPosition.xz - vWorld.xz);
   c += uSunColor * (path * 0.35 + glint * 1.2) * uGlitter * smoothstep(320.0, 40.0, dist);
   float foam = 0.0;
   for (int i = 0; i < ${MAX_STACKS}; i++) {
      vec4 s = uStacks[i];
      if (s.z <= 0.0) continue;
      vec2 q = (vWorld.xz - s.xy) / s.zw;
      float d = (length(q) - 1.0) * min(s.z, s.w);
      float wob = sin(atan(q.y, q.x) * 9.0 + uTime * 1.7) * 0.5 + sin(d * 2.2 - uTime * 2.4) * 0.5;
      foam = max(foam, smoothstep(3.2, 0.0, d) * (0.55 + 0.45 * wob));
   }
   c = mix(c, uFoam, clamp(foam, 0.0, 1.0) * 0.85);
   c += vec3(0.8, 0.8, 1.0) * uFlash * 0.25;
   gl_FragColor = vec4(c, 1.0);
   #include <fog_fragment>
}`;

function Sea({ look, sts, flash }: { look: ZipLook; sts: Station[]; flash: { value: number } }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   const quality = useQuality();
   const segments = quality.water === "full" ? 72 : quality.water === "reduced" ? 40 : 1;
   const geometry = useMemo(() => {
      const g = new PlaneGeometry(900, 900, segments, segments);
      g.rotateX(-Math.PI / 2);
      return g;
   }, [segments]);
   const material = useMemo(() => {
      const stacks = Array.from({ length: MAX_STACKS }, () => new Vector4(0, 0, 0, 0));
      return new ShaderMaterial({
         uniforms: UniformsUtils.merge([
            UniformsLib.fog,
            {
               uTime: { value: 0 },
               uAmp: { value: quality.water === "flat" ? 0 : 0.45 },
               uShallow: { value: new Color(look.sea.shallow) },
               uDeep: { value: new Color(look.sea.deep) },
               uFoam: { value: new Color(look.sea.foam) },
               uSun: { value: new Vector3(...look.sun.dir) },
               uSunColor: { value: new Color(look.sun.color) },
               uGlitter: { value: look.sea.glitter },
               uStacks: { value: stacks },
               uFlash: { value: 0 },
            },
         ]),
         vertexShader: SEA_VERT,
         fragmentShader: SEA_FRAG,
         fog: true,
      });
   }, [look, quality.water]);
   useEffect(
      () => () => {
         geometry.dispose();
         material.dispose();
      },
      [geometry, material]
   );
   const step = 900 / Math.max(1, segments);
   useFrame((state) => {
      const m = ref.current;
      if (!m) return;
      const cam = state.camera.position;
      // snapped to the grid, so the waves (world space) never swim with the camera
      m.position.set(Math.round(cam.x / step) * step, SEA_Y, Math.round(cam.z / step) * step);
      material.uniforms.uTime.value = time.now;
      material.uniforms.uFlash.value = flash.value;
      // foam round the stacks nearest the camera
      const list = material.uniforms.uStacks.value as Vector4[];
      let n = 0;
      for (const st of sts) {
         if (n >= MAX_STACKS) break;
         if (Math.abs(st.cz - cam.z) > 160) continue;
         list[n++].set(st.cx, st.cz, st.rx * 1.18, st.rz * 1.12);
      }
      for (; n < MAX_STACKS; n++) list[n].set(0, 0, 0, 0);
   }, FRAME_PRIORITY.visuals);
   return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={-5} />;
}

// ---------- clouds ----------

function cloudTexture(): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 256;
   c.height = 128;
   const g = c.getContext("2d")!;
   let s = 4242;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   for (let i = 0; i < 14; i++) {
      const x = 50 + rnd() * 156;
      const y = 74 + (rnd() - 0.5) * 18 - Math.sin(((x - 50) / 156) * Math.PI) * 20;
      const r = 18 + rnd() * 22;
      const grad = g.createRadialGradient(x, y + 6, r * 0.2, x, y + 6, r);
      grad.addColorStop(0, "rgba(200,212,232,0.9)");
      grad.addColorStop(1, "rgba(200,212,232,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 128);
      const top = g.createRadialGradient(x, y - 4, r * 0.1, x, y - 4, r * 0.85);
      top.addColorStop(0, "rgba(255,255,255,0.95)");
      top.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = top;
      g.fillRect(0, 0, 256, 128);
   }
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   return t;
}

const CLOUD_VERT = /* glsl */ `
#include <fog_pars_vertex>
attribute vec4 aSpot;
varying vec2 vUv;
void main() {
   vUv = uv;
   vec4 mv = viewMatrix * vec4(aSpot.xyz, 1.0);
   mv.xy += position.xy * vec2(aSpot.w, aSpot.w * 0.5);
   vec4 mvPosition = mv;
   gl_Position = projectionMatrix * mv;
   #include <fog_vertex>
}`;
const CLOUD_FRAG = /* glsl */ `
#include <fog_pars_fragment>
uniform sampler2D uMap; uniform vec3 uTint; uniform float uOpacity; uniform float uFlash;
varying vec2 vUv;
void main() {
   vec4 t = texture2D(uMap, vUv);
   gl_FragColor = vec4(t.rgb * uTint + uFlash * 0.4, t.a * uOpacity);
   #include <fog_fragment>
}`;

function Clouds({ look, level, zFrom, zTo, flash }: { look: ZipLook; level: LevelId; zFrom: number; zTo: number; flash: { value: number } }) {
   const { geometry, material } = useMemo(() => {
      const rnd = createRng(0xc10d + level);
      const n = look.clouds.count;
      const base = new PlaneGeometry(1, 1);
      const g = new InstancedBufferGeometry();
      g.index = base.index;
      g.setAttribute("position", base.getAttribute("position"));
      g.setAttribute("uv", base.getAttribute("uv"));
      const spot = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
         const side = i % 2 ? -1 : 1;
         spot.set([side * (40 + rnd() * 150), 40 + rnd() * 50, zFrom - rnd() * (zFrom - zTo + 200), 50 + rnd() * 70], i * 4);
      }
      g.setAttribute("aSpot", new InstancedBufferAttribute(spot, 4));
      g.instanceCount = n;
      const m = new ShaderMaterial({
         uniforms: UniformsUtils.merge([UniformsLib.fog, { uMap: { value: null }, uTint: { value: new Color(look.clouds.tint) }, uOpacity: { value: look.clouds.opacity }, uFlash: { value: 0 } }]),
         vertexShader: CLOUD_VERT,
         fragmentShader: CLOUD_FRAG,
         transparent: true,
         depthWrite: false,
         fog: true,
      });
      m.uniforms.uMap.value = cloudTexture();
      return { geometry: g, material: m };
   }, [look, level, zFrom, zTo]);
   useEffect(
      () => () => {
         (material.uniforms.uMap.value as CanvasTexture | null)?.dispose();
         geometry.dispose();
         material.dispose();
      },
      [geometry, material]
   );
   useFrame(() => {
      material.uniforms.uFlash.value = flash.value;
   });
   return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-10} />;
}

// ---------- rain (L5) ----------

const RAIN_VERT = /* glsl */ `
uniform float uTime; uniform vec3 uCenter;
attribute float aSeed;
void main() {
   vec3 p = position;
   float fall = mod(p.y - uTime * 26.0 - uCenter.y, 40.0);
   vec3 w = vec3(uCenter.x + mod(p.x - uCenter.x + 30.0, 60.0) - 30.0, uCenter.y - 20.0 + fall + aSeed * 1.4, uCenter.z + mod(p.z - uCenter.z + 30.0, 60.0) - 30.0);
   w.x += aSeed * 0.35;
   gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const RAIN_FRAG = /* glsl */ `
uniform float uFlash;
void main() { gl_FragColor = vec4(0.72, 0.8, 1.0, 0.28 + uFlash * 0.4); }`;

function Rain({ flash }: { flash: { value: number } }) {
   const time = useGameTime();
   const quality = useQuality();
   const count = quality.particles >= 1 ? 1400 : 700;
   const { geometry, material } = useMemo(() => {
      const rnd = createRng(0x7a1);
      const pos = new Float32Array(count * 6);
      const seed = new Float32Array(count * 2);
      for (let i = 0; i < count; i++) {
         const x = rnd() * 60;
         const y = rnd() * 40;
         const z = rnd() * 60;
         pos.set([x, y, z, x - 0.12, y + 0, z], i * 6);
         seed[i * 2] = 0;
         seed[i * 2 + 1] = 1;
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(pos, 3));
      g.setAttribute("aSeed", new BufferAttribute(seed, 1));
      const m = new ShaderMaterial({
         uniforms: { uTime: { value: 0 }, uCenter: { value: new Vector3() }, uFlash: { value: 0 } },
         vertexShader: RAIN_VERT,
         fragmentShader: RAIN_FRAG,
         transparent: true,
         depthWrite: false,
      });
      return { geometry: g, material: m };
   }, [count]);
   useEffect(
      () => () => {
         geometry.dispose();
         material.dispose();
      },
      [geometry, material]
   );
   useFrame((state) => {
      material.uniforms.uTime.value = time.now;
      material.uniforms.uFlash.value = flash.value;
      (material.uniforms.uCenter.value as Vector3).copy(state.camera.position);
   });
   return <lineSegments geometry={geometry} material={material} frustumCulled={false} />;
}

// ---------- the world ----------

const PINE_UNIT = 4.2;

export function World({ level }: { level: LevelId }) {
   const look = lookFor(level);
   const c = LEVELS[level];
   const sts = useMemo(() => stations(c), [c]);
   const scene = useMemo(() => scenery(level), [level]);
   const flash = useMemo(() => ({ value: 0 }), []);
   const time = useGameTime();
   const storm = useRef<AmbientLight>(null);
   useFrame(() => {
      flash.value = look.lightning ? lightningFlash(time.now) : 0;
      if (storm.current) storm.current.intensity = flash.value * 1.6;
   }, FRAME_PRIORITY.visuals - 0.01);
   const zFrom = sts[0].cz + 60;
   const zTo = sts[sts.length - 1].cz - 80;
   const cliffs = useMemo(() => scene.cliffs.map((s) => ({ x: s.x, y: s.y, z: s.z, scale: s.scale / BOUNDS.cliff.x, rotY: s.rotY })), [scene]);
   const boulders = useMemo(() => scene.boulders.map((s) => ({ x: s.x, y: s.y, z: s.z, scale: s.scale / BOUNDS.rock.x, rotY: s.rotY })), [scene]);
   const pines = useMemo(() => scene.pines.map((s) => ({ x: s.x, y: s.y, z: s.z, scale: (s.scale * PINE_UNIT) / BOUNDS.canopy.y, rotY: s.rotY })), [scene]);
   const lighthouses = useMemo(() => scene.lighthouses.map((s) => ({ x: s.x, y: s.y, z: s.z, scale: s.scale, rotY: s.rotY })), [scene]);
   const buoys = useMemo(() => scene.buoys.map((s) => ({ x: s.x, y: SEA_Y - 0.5, z: s.z, scale: s.scale, rotY: s.rotY, bob: 0.25 })), [scene]);
   return (
      <>
         <Sky look={look} flash={flash} />
         {look.stars > 0 && <Starfield count={look.stars} seed={level * 31} radius={300} size={1.6} upperOnly />}
         <Sea look={look} sts={sts} flash={flash} />
         <Clouds look={look} level={level} zFrom={zFrom} zTo={zTo} flash={flash} />
         {look.rain && <Rain flash={flash} />}
         <CulledModel asset={ASSETS.cliff} spots={cliffs} ahead={420} behind={140} />
         <CulledModel asset={ASSETS.rock} spots={boulders} />
         <CulledModel asset={ASSETS.canopy} spots={pines} />
         <CulledModel asset={ASSETS.lighthouse} spots={lighthouses} ahead={300} behind={80} />
         <CulledModel asset={ASSETS.buoy} spots={buoys} ahead={160} behind={40} />
         <directionalLight position={[look.sun.dir[0] * 50, Math.max(10, look.sun.dir[1] * 50), look.sun.dir[2] * 50]} color={look.key.color} intensity={look.key.intensity} />
         <directionalLight position={[-look.sun.dir[0] * 40, 18, -look.sun.dir[2] * 40]} color={look.rim.color} intensity={look.rim.intensity} />
         {look.lightning && <ambientLight ref={storm} color="#d9d4ff" intensity={0} />}
      </>
   );
}

