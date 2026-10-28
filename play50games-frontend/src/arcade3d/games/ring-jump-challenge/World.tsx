"use client";

// The sea canyon around the course (no collision here: rules.ts owns the walls): a sky dome that
// travels with the camera, the shaft's wall (one mesh: sandstone strata warm at the rim, teal towards
// the sea, weathered bulges, holes where the pockets open), the pockets' dark backs (one mesh), the
// rim plateau with the stone ring monuments (m2StoneRingBg) and the start column (m2ColumnPlatform),
// the sea with its sparkle, the sea stacks (m2SeaRock), the target pad (m2ColumnPlatform with a target
// face) and the marked pool's buoys, and on level 5 the Tide Bell's column. Playable things are Course.tsx.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, type Group, type InstancedMesh, type Mesh, type MeshStandardMaterial, Object3D, ShaderMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { InstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS, COLUMN_TOP_R, GLB_SIZE } from "./assets";
import { COLORS, LOOKS, rockTexture, targetTexture, waterTexture } from "./look";
import { polarX, polarZ, shaftRadius, type Course } from "./canyon";

/** The rim plateau sits this far under the column's top (the start column's drawn height). */
export const PLATEAU_DROP = 3.4;
/** The start column is drawn this wide at its top (m, radius). */
export const START_TOP_R = 1.3;

const SEGMENTS = 72;
const STEP_Y = 2.5;

function hash(a: number, b: number): number {
   const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
   return s - Math.floor(s);
}

/** Smooth value noise on (angle step, y step), periodic round the shaft. */
function noise(i: number, y: number): number {
   const yi = Math.floor(y);
   const fy = y - yi;
   const u = fy * fy * (3 - 2 * fy);
   const ii = ((i % SEGMENTS) + SEGMENTS) % SEGMENTS;
   const a = hash(ii, yi);
   const b = hash(ii, yi + 1);
   return a + (b - a) * u;
}

/** Is the wall open at angle a (deg) and height y (a pocket's mouth)? */
function inMouth(course: Course, aDeg: number, y: number): boolean {
   for (const p of course.pockets) {
      if (y < p.y0 + 0.5 || y > p.y1 - 0.5) continue;
      const R = shaftRadius(course, y);
      const half = (Math.asin(Math.min(0.99, (p.pr * 0.92) / R)) * 180) / Math.PI;
      let d = Math.abs(aDeg - p.a) % 360;
      if (d > 180) d = 360 - d;
      if (d < half) return true;
   }
   return false;
}

/**
 * The shaft's wall: a grid round the axis from under the sea to the rim, the radius from the course's
 * sections (ramped over 3 m) pushed outward by noise (never inward, so the hero never sinks into rock),
 * the strata tint by height in vertex colours, and no faces where a pocket opens.
 */
export function buildWallGeometry(course: Course, rock: readonly string[]): BufferGeometry {
   const top = course.top - PLATEAU_DROP;
   const rows: number[] = [];
   for (let y = -8; y < top; y += STEP_Y) rows.push(y);
   rows.push(top);
   const cols = SEGMENTS + 1;
   const pos = new Float32Array(rows.length * cols * 3);
   const uv = new Float32Array(rows.length * cols * 2);
   const col = new Float32Array(rows.length * cols * 3);
   const tints = rock.map((c) => new Color(c));
   const tmp = new Color();
   for (let r = 0; r < rows.length; r++) {
      const y = rows[r];
      // the radius, ramped near section edges
      let R = shaftRadius(course, y);
      R = Math.min(R, shaftRadius(course, y + 1.5), shaftRadius(course, y - 1.5)) * 0.5 + R * 0.5;
      const k = Math.max(0, Math.min(1, y / Math.max(1, course.top)));
      // rim (k = 1) warm, then middle, low, deep at the sea
      const t = 1 - k;
      if (t < 0.4) tmp.copy(tints[0]).lerp(tints[1], t / 0.4);
      else if (t < 0.8) tmp.copy(tints[1]).lerp(tints[2], (t - 0.4) / 0.4);
      else tmp.copy(tints[2]).lerp(tints[3], (t - 0.8) / 0.2);
      for (let i = 0; i < cols; i++) {
         const a = (i / SEGMENTS) * Math.PI * 2;
         const n = noise(i >> 1, y / 9) * 0.6 + noise(i, y / 3.2) * 0.4;
         const bump = 0.15 + n * 1.6 + (Math.sin(y * 0.11 + i * 0.4) > 0.92 ? 0.8 : 0);
         const rr = R + bump;
         const o = (r * cols + i) * 3;
         pos[o] = Math.cos(a) * rr;
         pos[o + 1] = y + (noise(i, y) - 0.5) * 0.6;
         pos[o + 2] = Math.sin(a) * rr;
         const shade = 0.78 + n * 0.32;
         col[o] = tmp.r * shade;
         col[o + 1] = tmp.g * shade;
         col[o + 2] = tmp.b * shade;
         const u = (r * cols + i) * 2;
         uv[u] = (i / SEGMENTS) * 10;
         uv[u + 1] = y / 24;
      }
   }
   const index: number[] = [];
   for (let r = 0; r + 1 < rows.length; r++) {
      const yMid = (rows[r] + rows[r + 1]) / 2;
      for (let i = 0; i < SEGMENTS; i++) {
         const aMid = ((i + 0.5) / SEGMENTS) * 360;
         if (inMouth(course, aMid, yMid)) continue;
         const a = r * cols + i;
         const b = a + 1;
         const c = a + cols;
         const d = c + 1;
         // outward-facing winding; the material draws the back side (seen from inside)
         index.push(a, c, b, b, c, d);
      }
   }
   const g = new BufferGeometry();
   g.setAttribute("position", new BufferAttribute(pos, 3));
   g.setAttribute("uv", new BufferAttribute(uv, 2));
   g.setAttribute("color", new BufferAttribute(col, 3));
   g.setIndex(index);
   g.computeVertexNormals();
   return g;
}

/** The pockets' backs: a dark open cylinder per pocket with a lid and a floor, merged into one mesh. */
export function buildPocketGeometry(course: Course): BufferGeometry | null {
   if (course.pockets.length === 0) return null;
   const parts: BufferGeometry[] = [];
   for (const p of course.pockets) {
      const h = p.y1 - p.y0 + 1;
      const body = new CylinderGeometry(p.pr + 0.25, p.pr + 0.25, h, 20, 1, false).toNonIndexed();
      body.translate(p.x, (p.y0 + p.y1) / 2, p.z);
      body.deleteAttribute("uv");
      parts.push(body);
   }
   const g = mergeGeometries(parts, false);
   for (const p of parts) p.dispose();
   return g;
}

function SkyDome({ top, bottom }: { top: string; bottom: string }) {
   const ref = useRef<Mesh>(null);
   const mat = useMemo(
      () =>
         new ShaderMaterial({
            side: BackSide,
            depthWrite: false,
            fog: false,
            uniforms: { top: { value: new Color(top) }, bottom: { value: new Color(bottom) } },
            vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
            fragmentShader:
               "uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float k = smoothstep(-0.2, 0.75, vP.y); gl_FragColor = vec4(mix(bottom, top, k), 1.0); }",
         }),
      [top, bottom],
   );
   useEffect(() => () => mat.dispose(), [mat]);
   useFrame((state) => {
      if (ref.current) ref.current.position.copy(state.camera.position);
   });
   return (
      <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
         <sphereGeometry args={[600, 24, 12]} />
      </mesh>
   );
}

function Wall({ course, levelId }: { course: Course; levelId: LevelId }) {
   const look = LOOKS[levelId];
   const geo = useMemo(() => buildWallGeometry(course, look.rock), [course, look.rock]);
   const pockets = useMemo(() => buildPocketGeometry(course), [course]);
   const map = useMemo(() => rockTexture(), []);
   useEffect(
      () => () => {
         geo.dispose();
         pockets?.dispose();
         map.dispose();
      },
      [geo, pockets, map],
   );
   return (
      <>
         <mesh geometry={geo} frustumCulled={false}>
            <meshStandardMaterial map={map} vertexColors side={BackSide} roughness={0.93} metalness={0} />
         </mesh>
         {pockets ? (
            <mesh geometry={pockets} frustumCulled={false}>
               <meshStandardMaterial color={COLORS.pocket} side={BackSide} roughness={1} emissive="#1f1410" emissiveIntensity={0.4} />
            </mesh>
         ) : null}
      </>
   );
}

/** The rim: a plateau ring round the shaft's mouth, the start column and the monuments on it. */
function Rim({ course, levelId }: { course: Course; levelId: LevelId }) {
   const y = course.top - PLATEAU_DROP;
   const R = course.radius;
   const map = useMemo(() => rockTexture(), []);
   useEffect(() => () => map.dispose(), [map]);
   const colScale = START_TOP_R / COLUMN_TOP_R;
   const monuments = useMemo(
      () =>
         course.monuments.map((m, k) => {
            const rad = R + 10 + (k % 3) * 7;
            const s = m.s / GLB_SIZE.monument.x;
            return { x: polarX(m.a, rad), y, z: polarZ(m.a, rad), scale: s, rotY: Math.PI / 2 - (m.a * Math.PI) / 180 };
         }),
      [course, R, y],
   );
   return (
      <>
         <mesh position={[0, y, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[R + 0.6, R + 120, 48, 1]} />
            <meshStandardMaterial map={map} color={LOOKS[levelId].rock[0]} roughness={0.95} />
         </mesh>
         <InstancedModel asset={ASSETS.column} spots={[{ x: course.startX, y, z: course.startZ, scale: colScale }]} fallback={null} />
         <InstancedModel asset={ASSETS.monument} spots={monuments} fallback={null} />
      </>
   );
}

/** The sea: a sparkling plane, the target pad (a column with a target face), the pool's buoys, the sea stacks. */
function Sea({ course, levelId }: { course: Course; levelId: LevelId }) {
   const look = LOOKS[levelId];
   const sparkle = useMemo(() => waterTexture(), []);
   const target = useMemo(() => targetTexture(), []);
   const mat = useRef<MeshStandardMaterial>(null);
   const time = useGameTime();
   useEffect(
      () => () => {
         sparkle.dispose();
         target.dispose();
      },
      [sparkle, target],
   );
   useEffect(() => {
      sparkle.repeat.set(16, 16);
   }, [sparkle]);
   useFrame(() => {
      sparkle.offset.set((time.now * 0.012) % 1, (time.now * 0.007) % 1);
      if (mat.current) mat.current.emissiveIntensity = 0.2 + 0.06 * Math.sin(time.now * 1.3);
   });
   const pad = course.pad;
   const padScale = pad.r / COLUMN_TOP_R;
   const rocks = useMemo(() => course.rocks.map((r) => ({ x: r.x, y: -0.6, z: r.z, scale: r.s / GLB_SIZE.rock.x * 2, rotY: r.rot })), [course]);
   return (
      <>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
            <circleGeometry args={[course.radius + 6, 48]} />
            <meshStandardMaterial ref={mat} color={look.sea} emissive={look.skyBottom} emissiveMap={sparkle} emissiveIntensity={0.3} roughness={0.25} metalness={0.1} />
         </mesh>
         <InstancedModel asset={ASSETS.rock} spots={rocks} fallback={null} />
         {course.boss ? null : (
            <>
               <InstancedModel asset={ASSETS.column} spots={[{ x: pad.x, y: pad.y - GLB_SIZE.column.y * padScale, z: pad.z, scale: padScale }]} fallback={null} />
               <mesh position={[pad.x, pad.y + 0.05, pad.z]} rotation-x={-Math.PI / 2}>
                  <circleGeometry args={[pad.r * 0.98, 40]} />
                  <meshStandardMaterial map={target} roughness={0.6} emissive="#ffffff" emissiveMap={target} emissiveIntensity={0.25} />
               </mesh>
            </>
         )}
         {course.pool ? <PoolBuoys x={course.pool.x} z={course.pool.z} r={course.pool.r} /> : null}
      </>
   );
}

const DUMMY = new Object3D();

/** The marked pool: a ring of orange and white buoys bobbing on the water, and a soft light ring. */
function PoolBuoys({ x, z, r }: { x: number; z: number; r: number }) {
   const ref = useRef<InstancedMesh>(null);
   const n = 14;
   const time = useGameTime();
   useEffect(() => {
      const m = ref.current;
      if (!m) return;
      const c = new Color();
      for (let i = 0; i < n; i++) m.setColorAt(i, c.set(i % 2 === 0 ? "#fb923c" : "#f8fafc"));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
   }, []);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      for (let i = 0; i < n; i++) {
         const a = (i / n) * Math.PI * 2;
         DUMMY.position.set(x + Math.cos(a) * r, 0.15 + Math.sin(time.now * 2 + i) * 0.12, z + Math.sin(a) * r);
         DUMMY.scale.setScalar(0.42);
         DUMMY.updateMatrix();
         m.setMatrixAt(i, DUMMY.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
   });
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, n]} frustumCulled={false}>
         <sphereGeometry args={[1, 14, 10]} />
         <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
   );
}

/** Level 5: the Tide Bell on its column by the sea (rings once Cyclone Ray is down). */
export function TideBell({ course, ringing }: { course: Course; ringing: { current: boolean } }) {
   const swing = useRef<Group>(null);
   const mat = useRef<MeshStandardMaterial>(null);
   const time = useGameTime();
   const a = 90;
   const rad = course.radius - 3.2;
   const x = polarX(a, rad);
   const z = polarZ(a, rad);
   const colScale = 1.6 / COLUMN_TOP_R;
   const topY = 13;
   useFrame(() => {
      if (swing.current) swing.current.rotation.x = ringing.current ? Math.sin(time.now * 9) * 0.5 : Math.sin(time.now * 1.1) * 0.04;
      if (mat.current) mat.current.emissiveIntensity = ringing.current ? 0.9 + 0.3 * Math.sin(time.now * 6) : 0.15;
   });
   return (
      <group>
         <InstancedModel asset={ASSETS.column} spots={[{ x, y: topY - GLB_SIZE.column.y * colScale, z, scale: colScale }]} fallback={null} />
         <InstancedModel asset={ASSETS.beacon} spots={[{ x, y: topY, z, scale: 2.6 / GLB_SIZE.beacon.y }]} fallback={null} />
         <group position={[x, topY + 3.6, z]}>
            <group ref={swing}>
               <mesh position={[0, -0.9, 0]}>
                  <cylinderGeometry args={[0.35, 1.05, 1.5, 20, 1, true]} />
                  <meshStandardMaterial ref={mat} color="#fbbf24" metalness={0.75} roughness={0.3} emissive="#f59e0b" emissiveIntensity={0.15} side={DoubleSide} />
               </mesh>
            </group>
         </group>
      </group>
   );
}

export default function World({ course, levelId }: { course: Course; levelId: LevelId }) {
   const look = LOOKS[levelId];
   return (
      <>
         <SkyDome top={look.skyTop} bottom={look.skyBottom} />
         <Wall course={course} levelId={levelId} />
         <Rim course={course} levelId={levelId} />
         <Sea course={course} levelId={levelId} />
      </>
   );
}

