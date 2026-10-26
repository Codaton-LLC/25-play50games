"use client";

// The layered sky world around the playable route (README "Look"): the sky dome, the cloud sea and
// cloud banks (instanced billboards), the non-colliding background islands and castles (Hyper3D GLBs,
// instanced), waterfalls off the big islands, drifting motes, and the rocky roots under the playable
// islands. Nothing here collides; everything is placed once from the course and the seed. Counts
// follow useQuality().decor / particles (phones get fewer clouds and motes, never another world).
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   BufferAttribute,
   CylinderGeometry,
   Color,
   DoubleSide,
   InstancedBufferAttribute,
   InstancedBufferGeometry,
   MeshStandardMaterial,
   PlaneGeometry,
   ShaderMaterial,
   AdditiveBlending,
   BackSide,
   Matrix4,
   type DirectionalLight,
   type Mesh,
   RepeatWrapping,
   type InstancedMesh,
   type Points,
   BufferGeometry,
   Float32BufferAttribute,
   type Texture,
} from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { createRng } from "@/arcade3d/core/math";
import { useQuality, scaledCount } from "@/arcade3d/core/quality";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, GLB_SIZE } from "./assets";
import { COLORS, STORM, STORM_FOG, billboardMaterial, cloudTexture, glowTexture, isStormLevel, lightningFlash, rockTexture, waterfallTexture } from "./look";
import type { Course } from "./rules";

export const FOG = { color: COLORS.fog, near: 80, far: 300 } as const;

type FogBand = { color: string; near: number; far: number };

// ---------- billboards (clouds, glows) ----------

export interface Billboard {
   x: number;
   y: number;
   z: number;
   size: number;
   /** instance colour (white = the texture's own) */
   r?: number;
   g?: number;
   b?: number;
}

/** One draw call for many camera-facing quads sharing one texture. `live` lets a caller move them. */
export function BillboardField({
   spots,
   map,
   additive = false,
   opacity = 1,
   aspect = 1.6,
   renderOrder = 0,
   live,
   fog = FOG,
   tint = "#ffffff",
}: {
   spots: readonly Billboard[];
   map: Texture;
   additive?: boolean;
   opacity?: number;
   aspect?: number;
   renderOrder?: number;
   /** called every frame with the spot attribute (x, y, z, size per instance) to rewrite in place */
   live?: (data: Float32Array) => boolean;
   fog?: FogBand;
   /** multiplies the texture colour; white leaves the clear sky unchanged */
   tint?: string;
}) {
   const geometry = useMemo(() => {
      const base = new PlaneGeometry(1, 1);
      const g = new InstancedBufferGeometry();
      g.index = base.index;
      g.setAttribute("position", base.getAttribute("position"));
      g.setAttribute("uv", base.getAttribute("uv"));
      const spot = new Float32Array(spots.length * 4);
      const tint = new Float32Array(spots.length * 3);
      spots.forEach((s, i) => {
         spot.set([s.x, s.y, s.z, s.size], i * 4);
         tint.set([s.r ?? 1, s.g ?? 1, s.b ?? 1], i * 3);
      });
      g.setAttribute("aSpot", new InstancedBufferAttribute(spot, 4));
      g.setAttribute("aTint", new InstancedBufferAttribute(tint, 3));
      g.instanceCount = spots.length;
      return g;
   }, [spots]);
   const material = useMemo(() => {
      const m = billboardMaterial(map, additive, fog, opacity);
      (m.uniforms.uTint.value as Color).set(tint);
      return m;
   }, [map, additive, opacity, fog, tint]);
   material.uniforms.uAspect.value = aspect;
   useEffect(
      () => () => {
         geometry.dispose();
         material.dispose();
      },
      [geometry, material],
   );
   useFrame(() => {
      if (!live) return;
      const attr = geometry.getAttribute("aSpot") as InstancedBufferAttribute;
      if (live(attr.array as Float32Array)) attr.needsUpdate = true;
   });
   if (spots.length === 0) return null;
   return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={renderOrder} />;
}

// ---------- clouds ----------

function useCloudSpots(course: Course, seed: number, factor: number) {
   return useMemo(() => {
      const rnd = createRng(seed ^ 0x51ab);
      const goalZ = course.supports[course.goal].cz;
      const sea: Billboard[] = [];
      const banks: Billboard[] = [];
      const far: Billboard[] = [];
      const nSea = scaledCount(150, factor);
      for (let i = 0; i < nSea; i++) {
         const z = 50 - rnd() * (Math.abs(goalZ) + 140);
         const x = (rnd() - 0.5) * 220;
         const shade = 0.92 + rnd() * 0.08;
         sea.push({ x, y: -13 - rnd() * 8 + (-z / Math.abs(goalZ)) * 10, z, size: 18 + rnd() * 26, r: shade, g: shade, b: 1 });
      }
      const nBanks = scaledCount(64, factor);
      for (let i = 0; i < nBanks; i++) {
         const side = rnd() < 0.5 ? -1 : 1;
         const z = 30 - rnd() * (Math.abs(goalZ) + 70);
         const t = -z / Math.abs(goalZ);
         banks.push({ x: side * (16 + rnd() * 60), y: -2 + t * 60 + (rnd() - 0.4) * 22, z, size: 7 + rnd() * 14 });
      }
      for (let i = 0; i < scaledCount(26, factor); i++) {
         const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
         far.push({ x: Math.sin(a) * 165, y: 4 + rnd() * 30, z: -60 + Math.cos(a) * 165, size: 45 + rnd() * 40 });
      }
      return { sea, banks, far };
   }, [course, seed, factor]);
}

/**
 * The far clouds ring the camera (they are inside the sky dome, so they follow it like the dome);
 * the sea and the banks stay in the world.
 */
function Clouds({ course, seed, fog, tint }: { course: Course; seed: number; fog: FogBand; tint: string }) {
   const { decor } = useQuality();
   const spots = useCloudSpots(course, seed, decor);
   const maps = useMemo(() => [cloudTexture(1), cloudTexture(2), cloudTexture(3)], []);
   useEffect(() => () => maps.forEach((m) => m.dispose()), [maps]);
   const camera = useThree((s) => s.camera);
   const base = useMemo(() => spots.far.map((s) => [s.x, s.y, s.z] as const), [spots]);
   const far = (data: Float32Array) => {
      for (let i = 0; i < base.length; i++) {
         data[i * 4] = base[i][0] + camera.position.x;
         data[i * 4 + 1] = base[i][1] + camera.position.y * 0.85;
         data[i * 4 + 2] = base[i][2] + camera.position.z;
      }
      return true;
   };
   const half = Math.ceil(spots.sea.length / 2);
   const seaA = useMemo(() => spots.sea.slice(0, half), [spots, half]);
   const seaB = useMemo(() => spots.sea.slice(half), [spots, half]);
   return (
      <>
         <BillboardField spots={spots.far} map={maps[2]} live={far} renderOrder={-10} fog={fog} tint={tint} />
         <BillboardField spots={seaA} map={maps[0]} renderOrder={-5} fog={fog} tint={tint} />
         <BillboardField spots={seaB} map={maps[1]} renderOrder={-5} fog={fog} tint={tint} />
         <BillboardField spots={spots.banks} map={maps[1]} renderOrder={-4} fog={fog} tint={tint} />
      </>
   );
}

// ---------- background islands, castles, waterfalls ----------

interface Backdrop {
   islands: Record<"islandB" | "islandC" | "islandD", InstanceSpot[]>;
   towers: InstanceSpot[];
   falls: Array<{ x: number; y: number; z: number; width: number; length: number; rotY: number }>;
}

function useBackdrop(course: Course, seed: number, factor: number): Backdrop {
   return useMemo(() => {
      const rnd = createRng(seed ^ 0x2f17);
      const goal = course.supports[course.goal];
      const span = Math.abs(goal.cz);
      const islands: Backdrop["islands"] = { islandB: [], islandC: [], islandD: [] };
      const towers: InstanceSpot[] = [];
      const falls: Backdrop["falls"] = [];
      const kinds = ["islandB", "islandC", "islandD"] as const;
      const count = scaledCount(30, factor);
      for (let i = 0; i < count; i++) {
         const kind = kinds[i % 3];
         const side = i % 2 === 0 ? -1 : 1;
         const z = 20 - (i / count) * (span + 60) - rnd() * 8;
         const t = Math.max(0, Math.min(1, -z / span));
         const near = rnd() < 0.55;
         const x = side * (near ? 17 + rnd() * 16 : 38 + rnd() * 40);
         const scale = near ? 4.5 + rnd() * 3.5 : 8 + rnd() * 8;
         const y = t * 58 + (rnd() - 0.55) * 26 - scale * 0.4;
         const size = GLB_SIZE[kind];
         islands[kind].push({ x, y, z, rotY: rnd() * Math.PI * 2, scale });
         // a castle on some of the far ones, a waterfall off some of the big ones
         if (!near && rnd() < 0.45) towers.push({ x, y: y + size.y * scale * 0.55, z, rotY: rnd() * Math.PI * 2, scale: scale * 0.55 });
         if (scale > 6 && rnd() < 0.6) {
            const w = scale * 0.22;
            falls.push({ x: x - side * size.x * scale * 0.38, y: y + size.y * scale * 0.55, z: z + size.z * scale * 0.2, width: w, length: 14 + scale * 2.2, rotY: 0 });
         }
      }
      // the Sky Tower: a big island and its castle above and behind the goal gate
      islands.islandD.push({ x: goal.cx + 4, y: goal.top - 14, z: goal.cz - 26, rotY: 0.6, scale: 14 });
      towers.push({ x: goal.cx + 4, y: goal.top + 6, z: goal.cz - 28, rotY: 0.3, scale: 15 });
      falls.push({ x: goal.cx - 8, y: goal.top + 4, z: goal.cz - 17, width: 3.2, length: 46, rotY: 0 });
      return { islands, towers, falls };
   }, [course, seed, factor]);
}

const FALL_VERTEX = /* glsl */ `
   uniform float uTime;
   varying vec2 vUv;
   varying float vFogDepth;
   void main() {
      vUv = uv;
      vec3 p = position;
      p.x += sin(uv.y * 9.0 + uTime * 2.0) * 0.06;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vFogDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
   }
`;
const FALL_FRAGMENT = /* glsl */ `
   uniform sampler2D uMap;
   uniform float uTime;
   uniform vec3 uFogColor;
   uniform float uFogNear;
   uniform float uFogFar;
   varying vec2 vUv;
   varying float vFogDepth;
   void main() {
      vec2 uv = vec2(vUv.x, vUv.y * 3.0 + uTime * 1.4);
      vec4 tex = texture2D(uMap, uv);
      float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
      float top = smoothstep(1.0, 0.94, vUv.y);
      float bottom = smoothstep(0.0, 0.45, vUv.y);
      float fog = smoothstep(uFogNear, uFogFar, vFogDepth);
      vec3 col = mix(tex.rgb, uFogColor, fog * 0.8);
      gl_FragColor = vec4(col, tex.a * edge * top * bottom * 0.95);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
   }
`;

function Waterfalls({ falls, fog }: { falls: Backdrop["falls"]; fog: FogBand }) {
   const time = useGameTime();
   const map = useMemo(() => {
      const t = waterfallTexture();
      t.wrapS = t.wrapT = RepeatWrapping;
      return t;
   }, []);
   const material = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: {
               uMap: { value: map },
               uTime: { value: 0 },
               uFogColor: { value: new Color(FOG.color) },
               uFogNear: { value: FOG.near },
               uFogFar: { value: FOG.far },
            },
            vertexShader: FALL_VERTEX,
            fragmentShader: FALL_FRAGMENT,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
         }),
      [map],
   );
   const glow = useMemo(() => glowTexture(), []);
   useEffect(
      () => () => {
         map.dispose();
         material.dispose();
         glow.dispose();
      },
      [map, material, glow],
   );
   useLayoutEffect(() => {
      (material.uniforms.uFogColor.value as Color).set(fog.color);
      material.uniforms.uFogNear.value = fog.near;
      material.uniforms.uFogFar.value = fog.far;
   }, [material, fog]);
   useFrame(() => {
      material.uniforms.uTime.value = time.now;
   });
   const mist = useMemo<Billboard[]>(() => falls.map((f) => ({ x: f.x, y: f.y - f.length * 0.55, z: f.z + 0.5, size: f.width * 3.2 })), [falls]);
   return (
      <>
         {falls.map((f, i) => (
            <mesh key={i} position={[f.x, f.y - f.length / 2, f.z]} rotation-y={f.rotY} material={material} renderOrder={-3}>
               <planeGeometry args={[f.width, f.length, 1, 12]} />
            </mesh>
         ))}
         <BillboardField spots={mist} map={glow} opacity={0.5} aspect={1} renderOrder={-2} fog={fog} />
      </>
   );
}

function BackgroundIslands({ course, seed, fog }: { course: Course; seed: number; fog: FogBand }) {
   const { decor } = useQuality();
   const backdrop = useBackdrop(course, seed, decor);
   return (
      <>
         <InstancedModel asset={ASSETS.islandB} spots={backdrop.islands.islandB} fallback={null} />
         <InstancedModel asset={ASSETS.islandC} spots={backdrop.islands.islandC} fallback={null} />
         <InstancedModel asset={ASSETS.islandD} spots={backdrop.islands.islandD} fallback={null} />
         <InstancedModel asset={ASSETS.stoneTower} spots={backdrop.towers} fallback={null} />
         <Waterfalls falls={backdrop.falls} fog={fog} />
      </>
   );
}

// ---------- rocky roots under the playable islands (terrain: code) ----------

/** A jagged inverted cone of rock, vertex-coloured (earth at the top, pale rock at the tip), flat-shaded. */
function rockRootGeometry(): BufferGeometry {
   const g = new CylinderGeometry(0.5, 0.08, 1, 12, 5, false).toNonIndexed();
   const pos = g.getAttribute("position") as BufferAttribute;
   const top = new Color(COLORS.rockTop);
   const mid = new Color(COLORS.rockMid);
   const bottom = new Color(COLORS.rockBottom);
   const colors = new Float32Array(pos.count * 3);
   const c = new Color();
   // a deterministic wobble per original vertex position (so shared corners stay shared)
   const wobble = (x: number, y: number, z: number) => {
      const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
      return h - Math.floor(h);
   };
   for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const k = y < 0.49 ? 0.7 + wobble(x, y, z) * 0.55 : 1;
      pos.setXYZ(i, x * k, y - 0.5, z * k);
      const t = 0.5 - y; // 0 at the top, 1 at the tip
      // strata: tan under the grass, pale bands in the middle, darker towards the tip
      const band = Math.floor(t * 5) % 2 === 0 ? 1 : 0.9;
      if (t < 0.5) c.copy(top).lerp(mid, t * 2);
      else c.copy(mid).lerp(bottom, (t - 0.5) * 2);
      const shade = (0.88 + wobble(z, x, y) * 0.2) * band;
      colors.set([c.r * shade, c.g * shade, c.b * shade], i * 3);
   }
   g.setAttribute("color", new Float32BufferAttribute(colors, 3));
   g.computeVertexNormals();
   return g;
}

function RockRoots({ course }: { course: Course }) {
   const mesh = useRef<InstancedMesh>(null);
   const geometry = useMemo(rockRootGeometry, []);
   const map = useMemo(() => rockTexture(), []);
   const material = useMemo(() => new MeshStandardMaterial({ map, vertexColors: true, roughness: 0.95, flatShading: true }), [map]);
   const spots = useMemo(
      () =>
         course.supports
            .filter((s) => !s.mover && s.kind !== "bridge")
            .map((s) => {
               const w = s.hw * 2 * 1.02;
               const d = s.hd * 2 * 1.02;
               const depth = 1.4 + (w + d) * 0.32;
               return { x: s.cx, y: s.top - 0.7, z: s.cz, sx: w * 1.12, sy: depth, sz: d * 1.12 };
            }),
      [course],
   );
   useEffect(() => {
      const m = mesh.current;
      if (!m) return;
      const mat = new Matrix4();
      spots.forEach((s, i) => {
         mat.makeScale(s.sx, s.sy, s.sz).setPosition(s.x, s.y, s.z);
         m.setMatrixAt(i, mat);
      });
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
   }, [spots]);
   useEffect(
      () => () => {
         geometry.dispose();
         material.dispose();
         map.dispose();
      },
      [geometry, material, map],
   );
   return <instancedMesh ref={mesh} args={[geometry, material, spots.length]} />;
}

// ---------- motes: drifting sparkles around the camera ----------

function Motes() {
   const { particles } = useQuality();
   const count = scaledCount(260, particles);
   const ref = useRef<Points>(null);
   const time = useGameTime();
   const camera = useThree((s) => s.camera);
   const geometry = useMemo(() => {
      const rnd = createRng(77);
      const p = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) p.set([rnd() * 40, rnd() * 26, rnd() * 40], i * 3);
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(p, 3));
      return g;
   }, [count]);
   const map = useMemo(() => glowTexture(), []);
   const material = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: { uCam: { value: camera.position }, uTime: { value: 0 }, uMap: { value: map }, uSize: { value: 26 } },
            vertexShader: /* glsl */ `
               uniform vec3 uCam;
               uniform float uTime;
               uniform float uSize;
               varying float vFade;
               void main() {
                  vec3 box = vec3(40.0, 26.0, 40.0);
                  vec3 drift = vec3(sin(position.y + uTime * 0.3) * 0.8, uTime * 0.35, cos(position.x + uTime * 0.2) * 0.8);
                  vec3 p = mod(position + drift - uCam, box) - box * 0.5 + uCam;
                  vec4 mv = viewMatrix * vec4(p, 1.0);
                  vFade = smoothstep(26.0, 6.0, -mv.z) * smoothstep(1.0, 4.0, -mv.z);
                  gl_PointSize = uSize / -mv.z;
                  gl_Position = projectionMatrix * mv;
               }
            `,
            fragmentShader: /* glsl */ `
               uniform sampler2D uMap;
               varying float vFade;
               void main() {
                  float a = texture2D(uMap, gl_PointCoord).a * vFade * 0.75;
                  if (a < 0.01) discard;
                  gl_FragColor = vec4(1.0, 0.96, 0.85, a);
               }
            `,
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
         }),
      [camera, map],
   );
   useEffect(
      () => () => {
         geometry.dispose();
         material.dispose();
         map.dispose();
      },
      [geometry, material, map],
   );
   useFrame((state) => {
      material.uniforms.uTime.value = time.now;
      material.uniforms.uSize.value = 34 * state.viewport.dpr * (state.size.height / 800);
   });
   return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}

// ---------- the sky: three stops, not tone-mapped (the blue stays vivid), following the camera ----------

function SkyGradient({ storm }: { storm: boolean }) {
   const ref = useRef<Mesh>(null);
   const camera = useThree((s) => s.camera);
   const time = useGameTime();
   const material = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: {
               uTop: { value: new Color(COLORS.skyTop) },
               uMid: { value: new Color(COLORS.skyMid) },
               uBottom: { value: new Color(COLORS.skyBottom) },
               uFlash: { value: 0 },
            },
            vertexShader: /* glsl */ `
               varying vec3 vDir;
               void main() {
                  vDir = normalize(position);
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
               }
            `,
            fragmentShader: /* glsl */ `
               uniform vec3 uTop;
               uniform vec3 uMid;
               uniform vec3 uBottom;
               uniform float uFlash;
               varying vec3 vDir;
               void main() {
                  float h = vDir.y;
                  vec3 col = h > 0.12 ? mix(uMid, uTop, smoothstep(0.12, 0.75, h)) : mix(uBottom, uMid, smoothstep(-0.25, 0.12, h));
                  col = mix(col, vec3(0.82, 0.88, 0.95), clamp(uFlash, 0.0, 1.0) * 0.92);
                  gl_FragColor = vec4(col, 1.0);
                  #include <colorspace_fragment>
               }
            `,
            side: BackSide,
            depthWrite: false,
            fog: false,
         }),
      [],
   );
   useLayoutEffect(() => {
      const top = storm ? STORM.skyTop : COLORS.skyTop;
      const mid = storm ? STORM.skyMid : COLORS.skyMid;
      const bottom = storm ? STORM.skyBottom : COLORS.skyBottom;
      (material.uniforms.uTop.value as Color).set(top);
      (material.uniforms.uMid.value as Color).set(mid);
      (material.uniforms.uBottom.value as Color).set(bottom);
      if (!storm) material.uniforms.uFlash.value = 0;
   }, [material, storm]);
   useEffect(() => () => material.dispose(), [material]);
   useFrame(() => {
      ref.current?.position.copy(camera.position);
      const k = storm ? lightningFlash(time.now) : 0;
      if (material.uniforms.uFlash.value !== k) material.uniforms.uFlash.value = k;
   }, FRAME_PRIORITY.visuals);
   return (
      <mesh ref={ref} material={material} renderOrder={-1000} frustumCulled={false}>
         <sphereGeometry args={[190, 32, 16]} />
      </mesh>
   );
}

/** A cool flash on the islands. Mounted only in a storm, so levels 1-3 keep their light count. */
function Lightning({ storm }: { storm: boolean }) {
   const ref = useRef<DirectionalLight>(null);
   const time = useGameTime();
   useFrame(() => {
      const light = ref.current;
      if (!light) return;
      light.intensity = storm ? lightningFlash(time.now) * 5.5 : 0;
   }, FRAME_PRIORITY.visuals);
   if (!storm) return null;
   return <directionalLight ref={ref} position={[12, 48, 18]} color="#d5e6ff" intensity={0} />;
}

// ---------- the world ----------

export default function World({ course, seed, levelId = 1 }: { course: Course; seed: number; levelId?: number }) {
   const storm = isStormLevel(levelId);
   const fog: FogBand = isStormLevel(levelId) ? STORM_FOG[levelId] : FOG;
   const tint = storm ? STORM.cloud : "#ffffff";
   const fill = storm ? STORM.fill : 1;
   return (
      <>
         <SkyGradient storm={storm} />
         <Lightning storm={storm} />
         {/* a warm low key from the front right (on top of the preset's sun), a cool rim from behind.
             Storm levels keep the same lights, dimmer and cooler. */}
         <directionalLight position={[50, 30, 40]} intensity={0.9 * fill} color={storm ? "#d5dee8" : "#ffd29a"} />
         <directionalLight position={[-30, 25, -60]} intensity={1.3 * fill} color={storm ? "#9eb4c8" : COLORS.rim} />
         <Clouds course={course} seed={seed} fog={fog} tint={tint} />
         <BackgroundIslands course={course} seed={seed} fog={fog} />
         <RockRoots course={course} />
         <Motes />
      </>
   );
}

