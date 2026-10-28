"use client";

// The playable course: the cables (one merged tube geometry for every line of the level, one draw;
// a hop wobbles the line it leaves, the night levels light them only where a lighthouse beam
// sweeps), the hazards (spark storms, the Volt Eel's charged line, the gull flock), the hero routes
// (Nami's express line, Riko's cracked wall, Vexa's ghost gate, the L4 beam line), the orbs and
// the boss. The stations and the world around them: Stations.tsx, World.tsx.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending,
   BufferGeometry,
   Color,
   Float32BufferAttribute,
   MeshStandardMaterial,
   Vector3,
   type BufferAttribute,
   type Group,
   type LineSegments,
   type Mesh,
   type MeshBasicMaterial,
} from "three";
import { Model, DynamicInstancedModel } from "../../core/assets";
import { useGameTime } from "../../core/gameTime";
import { useJuice, createJuiceEmitter } from "../../menu2/juice";
import { orbNeeded } from "./multiplayer";
import { ASSETS } from "./assets";
import { cablePoint, type ZipRun } from "./rules";
import type { ZipLevel } from "./levels";
import { lookFor } from "./look";
import { HANG, stations } from "./layout";
import { Stations, beamAngle, lighthouseSpots } from "./Stations";
import { Boss } from "./Boss";

const SIDES = 8;
const SEGS = 64;
const RADIUS = 0.06;

/** Which lines exist: every span has lanes 0 and 1 (L1's first two spans only lane 0); span 1 also the three hero lines. */
export function laneList(c: ZipLevel): { s: number; lane: number }[] {
   const out: { s: number; lane: number }[] = [];
   for (let s = 0; s < c.sections; s++)
      for (let lane = 0; lane < (s === 1 ? 5 : 2); lane++) {
         if (c.id === 1 && s < 2 && lane === 1) continue;
         out.push({ s, lane });
      }
   return out;
}

const LANE_TINT = ["#ffffff", "#ffffff", "#ffd36b", "#ff9f8a", "#c8b2ff"];

function tube(points: { x: number; y: number; z: number }[], radius: number, pos: number[], idx: number[], extra?: (k: number) => void) {
   const base = pos.length / 3;
   const t = new Vector3();
   const n = new Vector3();
   const b = new Vector3();
   const up = new Vector3(0, 1, 0);
   for (let k = 0; k < points.length; k++) {
      const p = points[k];
      const q = points[Math.min(points.length - 1, k + 1)];
      const o = points[Math.max(0, k - 1)];
      t.set(q.x - o.x, q.y - o.y, q.z - o.z).normalize();
      n.crossVectors(t, up).normalize();
      b.crossVectors(n, t).normalize();
      for (let j = 0; j < SIDES; j++) {
         const a = (j / SIDES) * Math.PI * 2;
         pos.push(p.x + (n.x * Math.cos(a) + b.x * Math.sin(a)) * radius, p.y + (n.y * Math.cos(a) + b.y * Math.sin(a)) * radius, p.z + (n.z * Math.cos(a) + b.z * Math.sin(a)) * radius);
         extra?.(k);
      }
   }
   for (let k = 0; k < points.length - 1; k++)
      for (let j = 0; j < SIDES; j++) {
         const a = base + k * SIDES + j;
         const c = base + k * SIDES + ((j + 1) % SIDES);
         idx.push(a, a + SIDES, c, c, a + SIDES, c + SIDES);
      }
}

function cableGeometry(c: ZipLevel): BufferGeometry {
   const pos: number[] = [];
   const idx: number[] = [];
   const col: number[] = [];
   const cable: number[] = [];
   const tint = new Color();
   for (const { s, lane } of laneList(c)) {
      const pts = Array.from({ length: SEGS + 1 }, (_, k) => cablePoint(c, s, lane, k / SEGS));
      tint.set(LANE_TINT[lane]);
      tube(pts, lane >= 2 ? RADIUS * 0.85 : RADIUS, pos, idx, (k) => {
         col.push(tint.r, tint.g, tint.b);
         cable.push(s * 8 + lane, k / SEGS);
      });
   }
   const g = new BufferGeometry();
   g.setAttribute("position", new Float32BufferAttribute(pos, 3));
   g.setAttribute("color", new Float32BufferAttribute(col, 3));
   g.setAttribute("aCable", new Float32BufferAttribute(cable, 2));
   g.setIndex(idx);
   g.computeVertexNormals();
   return g;
}

interface CableUniforms {
   uTime: { value: number };
   uWobId: { value: number };
   uWobAmp: { value: number };
   uBeam: { value: number };
   uNight: { value: number };
   uLh: { value: Vector3[] };
   uGlow: { value: Color };
}

function cableMaterial(color: string, uniforms: CableUniforms, night: boolean): MeshStandardMaterial {
   const m = new MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.32, vertexColors: true, emissive: night ? "#0b1830" : "#000000" });
   m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
         .replace(
            "#include <common>",
            "#include <common>\nattribute vec2 aCable;\nuniform float uTime; uniform float uWobId; uniform float uWobAmp;\nvarying vec3 vZipWorld;"
         )
         .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nif (abs(aCable.x - uWobId) < 0.5) { float u = aCable.y; transformed.y += sin(u * 18.85 - uTime * 34.0) * sin(u * 3.1416) * uWobAmp; }"
         )
         .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvZipWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader
         .replace("#include <common>", "#include <common>\nuniform float uBeam; uniform float uNight; uniform vec3 uLh[2]; uniform vec3 uGlow;\nvarying vec3 vZipWorld;")
         .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
if (uNight > 0.5) {
   float lit = 0.0;
   for (int i = 0; i < 2; i++) {
      vec3 l = uLh[i];
      if (l.z < 0.5) continue;
      vec2 d = vZipWorld.xz - vec2(l.x, l.y);
      float a = atan(-d.y, d.x);
      float c = cos(a - uBeam);
      lit = max(lit, pow(max(0.0, c), 70.0) * smoothstep(90.0, 20.0, length(d)));
   }
   totalEmissiveRadiance += uGlow * lit * 3.0;
}`
         );
   };
   return m;
}

function Cables({ run }: { run: ZipRun }) {
   const c = run.cfg;
   const look = lookFor(c.id);
   const time = useGameTime();
   const geometry = useMemo(() => cableGeometry(c), [c]);
   const uniforms = useMemo<CableUniforms>(
      () => ({
         uTime: { value: 0 },
         uWobId: { value: -1 },
         uWobAmp: { value: 0 },
         uBeam: { value: 0 },
         uNight: { value: c.night ? 1 : 0 },
         uLh: { value: [new Vector3(), new Vector3()] },
         uGlow: { value: new Color(look.cable.glow) },
      }),
      [c, look]
   );
   const material = useMemo(() => cableMaterial(look.cable.color, uniforms, c.night), [look, uniforms, c.night]);
   const lights = useMemo(() => lighthouseSpots(c), [c]);
   const wob = useRef({ id: -1, at: -9 });
   useEffect(
      () => () => {
         geometry.dispose();
         material.dispose();
      },
      [geometry, material]
   );
   useFrame((state) => {
      uniforms.uTime.value = time.now;
      if (run.event.hop || run.event.jump) wob.current = { id: run.section * 8 + run.lane, at: time.now };
      const age = time.now - wob.current.at;
      uniforms.uWobId.value = wob.current.id;
      uniforms.uWobAmp.value = age < 1.2 ? 0.22 * Math.exp(-age * 3.2) : 0;
      uniforms.uBeam.value = beamAngle(run.ms);
      const cz = state.camera.position.z;
      const near = [...lights].sort((p, q) => Math.abs(p.z - cz) - Math.abs(q.z - cz));
      uniforms.uLh.value.forEach((v, i) => (near[i] ? v.set(near[i].x, near[i].z, 1) : v.set(0, 0, 0)));
   });
   return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

/** A glowing overlay on part of one line: the Volt Eel's charge, a spark storm, the L4 beam line. */
function LineGlow({ c, section, lane, u0, u1, color, live, bolts = false, offset }: { c: ZipLevel; section: number; lane: number; u0: number; u1: number; color: string; live: (now: number) => number; bolts?: boolean; offset?: { x: number; y: number } }) {
   const mesh = useRef<Mesh>(null);
   const bolt = useRef<LineSegments>(null);
   const time = useGameTime();
   const geometry = useMemo(() => {
      const pts = Array.from({ length: 25 }, (_, k) => {
         const p = cablePoint(c, section, lane, u0 + ((u1 - u0) * k) / 24);
         if (offset) {
            p.x += offset.x;
            p.y += offset.y;
         }
         return p;
      });
      const pos: number[] = [];
      const idx: number[] = [];
      tube(pts, RADIUS * 2.6, pos, idx);
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      return g;
   }, [c, section, lane, u0, u1, offset]);
   const boltGeometry = useMemo(() => {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(new Float32Array(3 * 2 * 18), 3));
      return g;
   }, []);
   useEffect(
      () => () => {
         geometry.dispose();
         boltGeometry.dispose();
      },
      [geometry, boltGeometry]
   );
   useFrame(() => {
      const k = live(time.now);
      if (mesh.current) {
         mesh.current.visible = k > 0.01;
         (mesh.current.material as MeshBasicMaterial).opacity = Math.min(1, k) * (0.55 + 0.45 * Math.sin(time.now * 47) ** 2);
      }
      if (bolt.current) {
         bolt.current.visible = bolts && k > 0.6;
         if (bolt.current.visible) {
            // a zigzag strike from the storm cloud down onto the middle of the charged part
            const attr = boltGeometry.getAttribute("position") as BufferAttribute;
            const m = cablePoint(c, section, lane, (u0 + u1) / 2 + Math.sin(time.now * 9) * 0.03);
            let x = m.x + 3;
            let y = m.y + 16;
            let z = m.z;
            const seed = Math.floor(time.now * 14);
            for (let i = 0; i < 18; i++) {
               const f = (i + 1) / 18;
               const nx = m.x + 3 * (1 - f) + Math.sin(seed * 12.9898 + i * 78.233) * 0.9 * (1 - f * 0.7);
               const ny = m.y + 16 * (1 - f);
               const nz = m.z + Math.cos(seed * 4.1 + i * 3.7) * 0.7 * (1 - f);
               attr.setXYZ(i * 2, x, y, z);
               attr.setXYZ(i * 2 + 1, nx, ny, nz);
               x = nx;
               y = ny;
               z = nz;
            }
            attr.needsUpdate = true;
         }
      }
   });
   return (
      <>
         <mesh ref={mesh} geometry={geometry} visible={false} frustumCulled={false}>
            <meshBasicMaterial color={color} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </mesh>
         <lineSegments ref={bolt} geometry={boltGeometry} visible={false} frustumCulled={false}>
            <lineBasicMaterial color="#f5f3ff" toneMapped={false} />
         </lineSegments>
      </>
   );
}

/** The spark storms of the current span (rules.ts: section > 0, u 0.32..0.46, the lane of the 2.4 s beat). */
function Storms({ run }: { run: ZipRun }) {
   const c = run.cfg;
   const s = run.section;
   const juice = useJuice();
   const emitter = useMemo(createJuiceEmitter, []);
   const at = useMemo(() => new Vector3(), []);
   useFrame(() => {
      if (s === 0 || run.ended) return;
      const lane = Math.floor(run.ms / 2400) % 2;
      if (!(lane === 1 || c.night)) return;
      const p = cablePoint(c, s, lane, 0.39);
      at.set(p.x, p.y, p.z);
      juice.stream("hit", at, 30, emitter, { color: "#c4b5fd" });
   });
   if (s === 0 || (c.boss && s === 2)) return null;
   // storms charge for 2.4 s on alternate lanes; the glow warns 0.5 s ahead of a switch
   const live = (lane: number) => () => {
      if (!(lane === 1 || c.night)) return 0;
      const beat = run.ms / 2400;
      const on = Math.floor(beat) % 2 === lane;
      const toNext = 1 - (beat - Math.floor(beat));
      return on ? 1 : toNext < 0.21 ? 0.35 : 0;
   };
   return (
      <>
         <LineGlow c={c} section={s} lane={0} u0={0.32} u1={0.46} color="#a78bfa" live={live(0)} bolts />
         <LineGlow c={c} section={s} lane={1} u0={0.32} u1={0.46} color="#a78bfa" live={live(1)} bolts />
      </>
   );
}

/** Volt Eel phase 1: the line it charges glows for the 1.5 s telegraph, then burns. */
function EelCharge({ run }: { run: ZipRun }) {
   const c = run.cfg;
   if (!run.boss || run.section !== 2) return null;
   const live = (lane: number) => () => {
      const b = run.boss!;
      if (b.phase !== 0 || run.electricLane !== lane) return 0;
      if (b.step === "telegraph") return 0.3 + 0.7 * Math.min(1, b.stepMs / 1500) * (0.5 + 0.5 * Math.sin(b.stepMs / 40));
      return b.step === "attack" ? 1 : 0;
   };
   return (
      <>
         <LineGlow c={c} section={2} lane={0} u0={0.02} u1={0.98} color="#22d3ee" live={live(0)} bolts />
         <LineGlow c={c} section={2} lane={1} u0={0.02} u1={0.98} color="#22d3ee" live={live(1)} bolts />
      </>
   );
}

/** L4/L5: the hidden line between the two lanes, lit only while the beam crosses it (rules: sin(ms/1800) > 0.9). */
function BeamLine({ run }: { run: ZipRun }) {
   const c = run.cfg;
   const offset = useMemo(() => ({ x: 1.25, y: 0.35 }), []);
   if (!c.night || run.section === 0) return null;
   return <LineGlow c={c} section={run.section} lane={0} u0={0.6} u1={0.86} color="#a5f3fc" offset={offset} live={() => Math.max(0, (Math.sin(run.ms / 1800) - 0.8) * 5)} />;
}

function Orbs({ run, runs }: { run: ZipRun; runs: readonly ZipRun[] }) {
   const time = useGameTime();
   return (
      <DynamicInstancedModel
         asset={ASSETS.orb}
         count={run.cfg.sections * 4}
         update={(index, matrix) => {
            const section = Math.floor(index / 4);
            const k = index % 4;
            if (!orbNeeded(runs, index) || !runs.some((r) => !r.ended && (r.section === section || r.section + 1 === section))) return false;
            const lane = run.level === 1 && section < 2 ? 0 : k < 2 ? 0 : 1;
            const p = cablePoint(run.cfg, section, lane, 0.22 + k * 0.16 + 0.02);
            matrix.makeRotationY(time.now * 2.2 + index);
            matrix.setPosition(p.x, p.y - 1.25 + Math.sin(time.now * 3 + index) * 0.08, p.z);
         }}
      />
   );
}

/** The gull flock of L3/L5 sweeping across the span at u 0.6: tuck under it. */
function Gulls({ run }: { run: ZipRun }) {
   const a = useRef<Group>(null);
   const b = useRef<Group>(null);
   const time = useGameTime();
   useFrame(() => {
      const c = run.cfg;
      [a, b].forEach((ref, i) => {
         const g = ref.current;
         if (!g) return;
         g.visible = c.moving && run.mode !== "deck" && !run.ended;
         if (!g.visible) return;
         const p = cablePoint(c, run.section, run.lane, 0.6);
         // they swing across the line on a 2.6 s loop, right at head height as the rider passes
         const swing = Math.sin(time.now * 2.4 + i * 0.9);
         g.position.set(p.x + swing * 4.5 + (i ? 1.4 : -0.6), p.y - HANG + 1.25 + i * 0.5 + Math.sin(time.now * 7 + i) * 0.12, p.z + (i ? -1.6 : 0.8));
         g.rotation.set(0, swing > 0 ? -Math.PI / 2 : Math.PI / 2, Math.sin(time.now * 9 + i) * 0.25);
         g.rotation.y += Math.cos(time.now * 2.4 + i * 0.9) > 0 ? 0 : Math.PI;
      });
   });
   return (
      <>
         <group ref={a}>
            <Model asset={ASSETS.gull} />
         </group>
         <group ref={b} scale={0.85}>
            <Model asset={ASSETS.gull} />
         </group>
      </>
   );
}

/** Riko's cracked wall on the far line: shatters into chunks when the dash breaks it. */
function CrackedWall({ run }: { run: ZipRun }) {
   const at = useMemo(() => {
      const p = cablePoint(run.cfg, 1, 3, 0.48);
      return { x: p.x, y: p.y - HANG - 0.4, z: p.z };
   }, [run.cfg]);
   const chunks = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   const broke = useRef(-1);
   const juice = useJuice();
   const layout = useMemo(
      () =>
         Array.from({ length: 9 }, (_, i) => ({
            x: ((i % 3) - 1) * 0.95,
            y: Math.floor(i / 3) * 0.95 + 0.5,
            vx: ((i % 3) - 1) * 2 + Math.sin(i * 7.1),
            vy: 3 + Math.cos(i * 3.3) * 2,
            vz: -6 - (i % 4),
         })),
      []
   );
   useFrame(() => {
      if (run.wallBroken && broke.current < 0) {
         broke.current = time.now;
         juice.burst("hit", { x: at.x, y: at.y + 1.4, z: at.z }, 40, { color: "#fb923c" });
         juice.shake(0.35);
      }
      const t = broke.current < 0 ? 0 : time.now - broke.current;
      chunks.current.forEach((m, i) => {
         if (!m) return;
         const l = layout[i];
         m.visible = t < 2.2;
         m.position.set(l.x + l.vx * t, l.y + l.vy * t - 9 * t * t, l.vz * t);
         m.rotation.set(t * (3 + i), t * 2, 0);
      });
   });
   if (run.cfg.id === 1) return null;
   return (
      <group position={[at.x, at.y, at.z]}>
         {layout.map((l, i) => (
            <mesh key={i} ref={(m) => { chunks.current[i] = m; }} position={[l.x, l.y, 0]}>
               <boxGeometry args={[0.9, 0.9, 0.6]} />
               <meshStandardMaterial color={i % 2 ? "#a8a29e" : "#c4b5a4"} roughness={0.9} emissive="#f97316" emissiveIntensity={i === 4 ? 0.6 : 0.12} flatShading />
            </mesh>
         ))}
      </group>
   );
}

/** Vexa's ghost signal gate across the inner line, and Nami's lantern shard over the express line. */
function HeroRoutes({ run }: { run: ZipRun }) {
   const gate = useRef<Group>(null);
   const shard = useRef<Group>(null);
   const time = useGameTime();
   const at = useMemo(() => {
      const g = cablePoint(run.cfg, 1, 4, 0.45);
      const s = cablePoint(run.cfg, 1, 2, 0.52);
      return { gate: { x: g.x, y: g.y - 1.2, z: g.z }, shard: { x: s.x, y: s.y - 1.2, z: s.z } };
   }, [run.cfg]);
   useFrame(() => {
      if (gate.current) {
         const phasing = run.heroId === "vexa" && run.powerMs > 0;
         gate.current.rotation.z = Math.sin(time.now * 2) * 0.06;
         gate.current.scale.setScalar(phasing ? 1.15 : 1);
         gate.current.visible = !run.secrets.found[1];
      }
      if (shard.current) {
         shard.current.rotation.y = time.now * 1.6;
         shard.current.position.y = at.shard.y + Math.sin(time.now * 2.5) * 0.15;
         shard.current.visible = !run.secrets.found[2] && run.section <= 1;
      }
   });
   if (run.cfg.id === 1) return null;
   return (
      <>
         <group ref={gate} position={[at.gate.x, at.gate.y, at.gate.z]}>
            <mesh>
               <torusGeometry args={[1.3, 0.09, 8, 32]} />
               <meshStandardMaterial color="#c4b5fd" emissive="#8b5cf6" emissiveIntensity={1.6} transparent opacity={0.85} />
            </mesh>
            <mesh>
               <circleGeometry args={[1.22, 32]} />
               <meshBasicMaterial color="#a78bfa" transparent opacity={0.22} depthWrite={false} side={2} blending={AdditiveBlending} />
            </mesh>
         </group>
         <group ref={shard} position={[at.shard.x, at.shard.y, at.shard.z]}>
            <mesh>
               <octahedronGeometry args={[0.38, 0]} />
               <meshStandardMaterial color="#fde68a" emissive="#f59e0b" emissiveIntensity={1.4} metalness={0.3} roughness={0.2} />
            </mesh>
         </group>
      </>
   );
}

/** The trolleys of the other lines' last riders stay parked at the line ends (reads as a working line). */
export function Course({ run, runs = [run] }: { run: ZipRun; runs?: readonly ZipRun[] }) {
   const [section, setSection] = useState(run.section);
   useFrame(() => {
      if (section !== run.section) setSection(run.section);
   });
   const sts = useMemo(() => stations(run.cfg), [run.cfg]);
   void sts;
   return (
      <>
         <Cables run={run} />
         <Stations run={run} runs={runs} />
         <Storms run={run} />
         <EelCharge run={run} />
         <BeamLine run={run} />
         <Orbs run={run} runs={runs} />
         <Gulls run={run} />
         <CrackedWall run={run} />
         <HeroRoutes run={run} />
         {runs.map((r, i) => r.boss && <Boss key={i} run={r} owner={i} />)}
      </>
   );
}
