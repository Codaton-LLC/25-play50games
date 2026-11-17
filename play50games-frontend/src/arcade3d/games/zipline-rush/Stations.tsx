"use client";

// The stations: one merged, flat-shaded sea-stack geometry for every rock pillar of the level
// (terrain stays in code: strata, wet base, grass or guano cap), the watch towers (GLB) carrying a
// steel gantry over each launch, the rear anchor frame each cable ends on, the landing mats with
// their three-zone projection, the moving decks of L3/L5, lighthouses with sweeping beams on the
// night levels and the Tide Bell station at the end. Visual only.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending,
   BoxGeometry,
   BufferGeometry,
   Color,
   CylinderGeometry,
   RingGeometry,
   DoubleSide,
   Float32BufferAttribute,
   Matrix4,
   MeshStandardMaterial,
   type Group,
   type Mesh,
   type MeshBasicMaterial,
   type PointLight,
} from "three";
import { Model } from "../../core/assets";
import { CulledModel } from "./Culled";
import { useGameTime } from "../../core/gameTime";
import { createRng } from "../../core/math";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { LevelId } from "../../types";
import { ASSETS, BOUNDS, MAT_TOP } from "./assets";

/** The mat sinks into the floor so its top sits just over it. */
const MAT_Y = -0.12;
import { lookFor } from "./look";
import { deckPoint, type ZipRun } from "./rules";
import { ANCHOR_DZ, ANCHOR_X, GANTRY_X, HANG, SEA_Y, STACK_POWER, TOWER_DZ, scenery, stations, type Station } from "./layout";
import { LEVELS, type ZipLevel } from "./levels";

/** A gantry beam right by the camera (a steep or close orbit) is cut away instead of filling the frame. */
function nearFade(m: MeshStandardMaterial, radius: number): MeshStandardMaterial {
   m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
         .replace("#include <common>", "#include <common>\nvarying vec3 vNearWorld;")
         .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvNearWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader
         .replace("#include <common>", "#include <common>\nvarying vec3 vNearWorld;")
         .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\nif (distance(vNearWorld, cameraPosition) < ${radius.toFixed(1)}) discard;`);
   };
   return m;
}

/** One rock column: noisy elliptical rings from under the sea to `top`, a flat cap. */
function stackPart(out: { pos: number[]; col: number[] }, cx: number, cz: number, rx: number, rz: number, top: number, seed: number, palette: { top: Color; mid: Color; base: Color; cap: Color }, flatFront = false) {
   const rnd = createRng(seed);
   const rings = 9;
   const around = 26;
   const bottom = SEA_Y - 3;
   const height = top - bottom;
   const bumps = Array.from({ length: around }, () => 0.9 + rnd() * 0.18);
   const ring: [number, number, number, Color][][] = [];
   const tmp = new Color();
   for (let k = 0; k <= rings; k++) {
      const v = k / rings;
      const y = k === rings ? top : bottom + height * (v + (k > 0 ? (rnd() - 0.5) * 0.03 : 0));
      // wider at the foot, a lip just under the cap
      const flare = 1 + (1 - v) * (1 - v) * 0.35 - (k === rings - 1 ? 0.02 : 0);
      const row: [number, number, number, Color][] = [];
      for (let a = 0; a < around; a++) {
         const ang = (a / around) * Math.PI * 2;
         let f = flare * (k >= rings - 1 ? 1 : bumps[a] * (0.95 + rnd() * 0.08));
         // the launch face stays sheer: nothing juts out under a departing rider
         if (flatFront && Math.sin(ang) < -0.6) f = Math.min(f, 1);
         // a superellipse: a rounded-rectangle top, so the corners carry the towers
         const ca = Math.cos(ang);
         const sa = Math.sin(ang);
         const e = 2 / STACK_POWER;
         const x = cx + Math.sign(ca) * Math.abs(ca) ** e * rx * f;
         const z = cz + Math.sign(sa) * Math.abs(sa) ** e * rz * f;
         const strata = Math.sin(y * 1.7 + seed) * 0.5 + 0.5;
         if (k >= rings - 1) tmp.copy(palette.cap);
         else if (y < SEA_Y + 1.2) tmp.copy(palette.base).multiplyScalar(0.7);
         else tmp.copy(palette.base).lerp(palette.mid, Math.min(1, (y - SEA_Y) / 8)).lerp(palette.top, Math.max(0, v - 0.55) * 1.6 * strata);
         row.push([x, y, z, tmp.clone()]);
      }
      ring.push(row);
   }
   const tri = (a: [number, number, number, Color], b: [number, number, number, Color], c: [number, number, number, Color]) => {
      out.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      // one colour per face: the faceted low-poly look
      const col = a[3];
      for (let i = 0; i < 3; i++) out.col.push(col.r, col.g, col.b);
   };
   for (let k = 0; k < rings; k++) {
      for (let a = 0; a < around; a++) {
         const b = (a + 1) % around;
         const p00 = ring[k][a];
         const p01 = ring[k][b];
         const p10 = ring[k + 1][a];
         const p11 = ring[k + 1][b];
         tri(p00, p10, p11);
         tri(p00, p11, p01);
      }
   }
   // the cap: a fan at the top, slightly domed at the middle
   const centre: [number, number, number, Color] = [cx, top + 0.02, cz, palette.cap];
   for (let a = 0; a < around; a++) tri(centre, ring[rings][(a + 1) % around], ring[rings][a]);
}

function stackGeometry(level: LevelId, sts: Station[], extra: { x: number; z: number; r: number; top: number }[]): BufferGeometry {
   const look = lookFor(level);
   const palette = { top: new Color(look.rock.top), mid: new Color(look.rock.mid), base: new Color(look.rock.base), cap: new Color(look.rock.cap) };
   const out = { pos: [] as number[], col: [] as number[] };
   for (const st of sts) {
      const floor = Math.min(st.startY, st.landY);
      stackPart(out, st.cx, st.cz, st.rx, st.rz, floor - 0.02, 101 + st.index * 13 + level * 7, palette, true);
      if (st.landY > st.startY + 0.5 && st.land) stackPart(out, st.land.x, st.land.z, 4.4, 3.6, st.landY - 0.02, 303 + st.index, palette);
   }
   extra.forEach((e, i) => stackPart(out, e.x, e.z, e.r, e.r * 0.9, e.top, 707 + i * 31 + level, palette));
   const g = new BufferGeometry();
   g.setAttribute("position", new Float32BufferAttribute(out.pos, 3));
   g.setAttribute("color", new Float32BufferAttribute(out.col, 3));
   g.computeVertexNormals();
   return g;
}

/** Steel gantries: a crossbeam over each launch and an anchor frame behind each landing, merged. */
function gantryGeometry(sts: Station[]): BufferGeometry {
   const parts: BufferGeometry[] = [];
   const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const b = new BoxGeometry(w, h, d);
      b.applyMatrix4(new Matrix4().makeTranslation(x, y, z));
      parts.push(b.toNonIndexed());
   };
   const post = (r: number, h: number, x: number, y: number, z: number) => {
      const c = new CylinderGeometry(r, r * 1.15, h, 8);
      c.applyMatrix4(new Matrix4().makeTranslation(x, y + h / 2, z));
      parts.push(c.toNonIndexed());
   };
   for (const st of sts) {
      const beamY = st.startY + HANG + 0.42;
      if (st.start) {
         const z = st.start.z;
         box(2 * GANTRY_X + 0.6, 0.32, 0.36, 0, beamY, z);
         box(2 * GANTRY_X + 0.6, 0.1, 0.5, 0, beamY + 0.2, z);
         // cable hangers over each lane
         for (const x of [-1.25, 1.25]) box(0.12, 0.42, 0.12, x, beamY - 0.3, z);
      }
      if (st.land) {
         const z = st.land.z + ANCHOR_DZ;
         const y = st.landY;
         const top = y + HANG + 0.42;
         for (const x of [-ANCHOR_X, ANCHOR_X]) {
            post(0.16, top - y + 0.3, x, y, z);
            // a diagonal brace back to the stack
            box(0.12, 0.12, 1.4, x, y + 0.7, z - 0.55);
         }
         box(2 * ANCHOR_X + 0.6, 0.3, 0.32, 0, top, z);
         for (const x of [-1.25, 1.25]) box(0.12, 0.42, 0.12, x, top - 0.3, z);
      }
   }
   const merged = mergeGeometries(parts, false)!;
   parts.forEach((p) => p.dispose());
   return merged;
}

/** Lamp posts' glowing heads on every gantry corner (one instanced draw). */
function lampSpots(sts: Station[]) {
   const out: { x: number; y: number; z: number }[] = [];
   for (const st of sts) {
      if (st.start) for (const x of [-GANTRY_X - 0.3, GANTRY_X + 0.3]) out.push({ x, y: st.startY + HANG + 0.85, z: st.start.z });
      if (st.land) for (const x of [-ANCHOR_X, ANCHOR_X]) out.push({ x, y: st.landY + HANG + 0.9, z: st.land.z + ANCHOR_DZ });
   }
   return out;
}

function Lamps({ spots, color, night }: { spots: { x: number; y: number; z: number }[]; color: string; night: boolean }) {
   const ref = useRef<import("three").InstancedMesh>(null);
   useEffect(() => {
      const m = ref.current;
      if (!m) return;
      const mat = new Matrix4();
      spots.forEach((s, i) => m.setMatrixAt(i, mat.makeTranslation(s.x, s.y, s.z)));
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
   }, [spots]);
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} frustumCulled={false}>
         <sphereGeometry args={[night ? 0.22 : 0.16, 10, 8]} />
         <meshBasicMaterial color={color} toneMapped={false} />
      </instancedMesh>
   );
}

/** The three landing zones (outer edge, inner edge, centre) as one flat geometry with vertex colours. */
function zoneGeometry(): BufferGeometry {
   const parts: BufferGeometry[] = [];
   const colors = ["#fb923c", "#fde68a", "#4ade80"];
   [2.25, 1.55, 0.8].forEach((r, i) => {
      const g = new RingGeometry(r - 0.16, r, 48).toNonIndexed();
      g.rotateX(-Math.PI / 2);
      g.translate(0, i * 0.004, 0);
      const c = new Color(colors[i]);
      const n = g.getAttribute("position").count;
      g.setAttribute("color", new Float32BufferAttribute(Array.from({ length: n * 3 }, (_, k) => [c.r, c.g, c.b][k % 3]), 3));
      g.deleteAttribute("normal");
      g.deleteAttribute("uv");
      parts.push(g);
   });
   const merged = mergeGeometries(parts, false)!;
   parts.forEach((p) => p.dispose());
   return merged;
}

/** The landing of span `section`: mat + three-zone projection; on L3/L5 a deck sliding on its rails. */
function Landing({ run, section }: { run: ZipRun; section: number }) {
   const group = useRef<Group>(null);
   const zones = useRef<Mesh>(null);
   const glow = useRef<Mesh>(null);
   const time = useGameTime();
   const moving = run.cfg.moving;
   const geometry = useMemo(zoneGeometry, []);
   useEffect(() => () => geometry.dispose(), [geometry]);
   useFrame(() => {
      const p = deckPoint(run.cfg, section, run.ms);
      if (group.current) group.current.position.set(p.x, p.y, p.z);
      const near = section === run.section && run.mode !== "deck" ? Math.max(0, Math.min(1, (run.t - 0.55) / 0.4)) : 0;
      // the projection grows and brightens as the rider nears the end of the line
      if (zones.current) zones.current.scale.setScalar(1 + near * 0.25 + Math.sin(time.now * 6) * 0.025 * near);
      if (glow.current) {
         (glow.current.material as MeshBasicMaterial).opacity = 0.1 + near * 0.5;
         glow.current.scale.setScalar(1 + near * 0.6);
      }
   });
   return (
      <group ref={group}>
         {moving && <Model asset={ASSETS.deck} position={[0, -BOUNDS.deck.y * ASSETS.deck.scale! * ASSETS.deck.stretch[1] + 0.12, 0]} />}
         <Model asset={ASSETS.mat} position={[0, MAT_Y, 0]} />
         <mesh ref={zones} geometry={geometry} position={[0, MAT_Y + MAT_TOP + 0.015, 0]}>
            <meshBasicMaterial vertexColors toneMapped={false} />
         </mesh>
         <mesh ref={glow} position={[0, MAT_Y + MAT_TOP + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.72, 32]} />
            <meshBasicMaterial color="#86efac" transparent opacity={0.15} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </mesh>
      </group>
   );
}

/** Lighthouses beside the stations on the night levels; the two nearest sweep beams. */
export function lighthouseSpots(c: ZipLevel): { x: number; y: number; z: number; scale: number; rotY: number }[] {
   if (!c.night) return [];
   const sts = stations(c);
   return sts
      .filter((st) => st.index % 2 === 1 || st.final)
      .map((st) => ({ x: 13, y: Math.min(st.startY, st.landY) - 5, z: st.cz - 2, scale: 1, rotY: 0.6 }));
}

/** Beam heading (rad, atan2(-dz, dx) from the lighthouse) at run time `ms`: points along the
 * current span's last third when sin(ms / 1800) peaks, the moment rules.ts opens the beam secret. */
export const beamAngle = (ms: number) => ms / 1800 + 0.32;

function Beams({ run, spots }: { run: ZipRun; spots: { x: number; y: number; z: number }[] }) {
   const a = useRef<Group>(null);
   const b = useRef<Group>(null);
   useFrame((state) => {
      const cz = state.camera.position.z;
      const sorted = [...spots].sort((p, q) => Math.abs(p.z - cz) - Math.abs(q.z - cz));
      [a, b].forEach((ref, i) => {
         const g = ref.current;
         const s = sorted[i];
         if (!g) return;
         g.visible = !!s;
         if (!s) return;
         g.position.set(s.x, s.y + 13.4, s.z);
         // the cone's axis is +x after the z turn; rotation.y turns +x towards (cos, -sin) in xz
         g.rotation.y = beamAngle(run.ms);
      });
   });
   const cone = (
      <mesh rotation={[0, 0, -Math.PI / 2]} position={[30, 0, 0]}>
         <coneGeometry args={[7, 60, 24, 1, true]} />
         <meshBasicMaterial color="#e0f7ff" transparent opacity={0.07} depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
   );
   return (
      <>
         <group ref={a}>
            {cone}
            <pointLight color="#fff7d6" intensity={30} distance={22} />
         </group>
         <group ref={b}>
            {cone}
         </group>
      </>
   );
}

/** The Tide Bell on its post at the last station, the beacon beside it lights when it rings. */
function BellStation({ run, st }: { run: ZipRun; st: Station }) {
   const bell = useRef<Group>(null);
   const time = useGameTime();
   const rung = useRef(-1);
   useFrame(() => {
      if (run.event.bell) rung.current = time.now;
      const k = rung.current < 0 ? 0 : Math.max(0, 1 - (time.now - rung.current) / 1.6);
      if (bell.current) {
         bell.current.rotation.z = Math.sin(time.now * 22) * 0.35 * k + (run.mode === "bell" ? Math.sin(time.now * 3) * 0.05 : 0);
         bell.current.scale.setScalar(1 + (run.mode === "bell" ? 0.08 + Math.sin(time.now * 5) * 0.04 : 0));
      }
   });
   const y = st.landY;
   const z = st.land!.z - 3.2;
   return (
      <group position={[2.6, y, z]}>
         <mesh position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.12, 0.16, 1.8, 10]} />
            <meshStandardMaterial color="#6b4f35" roughness={0.7} />
         </mesh>
         <mesh position={[0, 1.82, 0]}>
            <cylinderGeometry args={[0.55, 0.55, 0.08, 18]} />
            <meshStandardMaterial color="#8a6a48" roughness={0.6} />
         </mesh>
         <group ref={bell} position={[0, 1.86, 0]}>
            <Model asset={ASSETS.bell} />
         </group>
      </group>
   );
}

export function Stations({ run, runs }: { run: ZipRun; runs: readonly ZipRun[] }) {
   const level = run.level;
   const c = LEVELS[level];
   const look = lookFor(level);
   const sts = useMemo(() => stations(c), [c]);
   const lights = useMemo(() => lighthouseSpots(c), [c]);
   const extras = useMemo(() => {
      const sc = scenery(level);
      return [
         ...sc.farStacks.map((s) => ({ x: s.x, z: s.z, r: s.r, top: s.y + s.h })),
         ...lights.map((l) => ({ x: l.x, z: l.z, r: 4.2, top: l.y })),
      ];
   }, [level, lights]);
   const rock = useMemo(() => stackGeometry(level, sts, extras), [level, sts, extras]);
   const steel = useMemo(() => gantryGeometry(sts), [sts]);
   const steelMaterial = useMemo(() => nearFade(new MeshStandardMaterial({ color: c.night ? "#3b4a63" : "#5b6b7c", metalness: 0.5, roughness: 0.38 }), 4.5), [c.night]);
   useEffect(() => () => steelMaterial.dispose(), [steelMaterial]);
   useEffect(
      () => () => {
         rock.dispose();
         steel.dispose();
      },
      [rock, steel]
   );
   const towers = useMemo(
      () =>
         sts.flatMap((st) =>
            st.start ? [-1, 1].map((side) => ({ x: side * GANTRY_X, y: st.startY, z: st.start!.z + TOWER_DZ, rotY: side > 0 ? Math.PI / 2 : 0 })) : []
         ),
      [sts]
   );
   const lamps = useMemo(() => lampSpots(sts), [sts]);
   const lantern = useRef<PointLight>(null);
   useFrame(() => {
      // one warm light over the station the rider is heading to (night levels)
      if (!lantern.current) return;
      const st = sts[Math.min(sts.length - 1, run.section + (run.t > 0.5 ? 1 : 0))];
      lantern.current.position.set(0, Math.max(st.startY, st.landY) + 3.5, st.cz);
   });
   const activeKey = runs.map((r) => r.section).join(",");
   const active = useMemo(() => sts.filter((st) => st.land && runs.some((r) => st.index - 1 === r.section || st.index - 1 === r.section + 1)), [sts, activeKey]); // eslint-disable-line react-hooks/exhaustive-deps
   const idle = useMemo(() => sts.filter((st) => st.land && !c.moving && !active.includes(st)).map((st) => ({ x: 0, y: st.landY + MAT_Y, z: st.land!.z })), [sts, c, active]);
   const last = sts[sts.length - 1];
   return (
      <>
         <mesh geometry={rock}>
            <meshStandardMaterial vertexColors flatShading roughness={0.93} metalness={0.02} />
         </mesh>
         <mesh geometry={steel} material={steelMaterial} />
         <CulledModel asset={ASSETS.tower} spots={towers} />
         <CulledModel asset={ASSETS.lighthouse} spots={lights} ahead={300} behind={80} />
         {lights.length > 0 && <Beams run={run} spots={lights} />}
         <Lamps spots={lamps} color={look.lantern} night={c.night} />
         {active.map((st) => (
            <Landing key={st.index} run={run} section={st.index - 1} />
         ))}
         <BellStation run={run} st={last} />
         {c.night && <pointLight ref={lantern} color={look.lantern} intensity={14} distance={20} />}
         {/* the static mats outside the active window keep the stations readable from afar */}
         <CulledModel asset={ASSETS.mat} spots={idle} />
      </>
   );
}

