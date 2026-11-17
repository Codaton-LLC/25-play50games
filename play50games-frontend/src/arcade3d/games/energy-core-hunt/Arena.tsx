"use client";

// The reactor arena (everything with a rule behind it), drawn from small pools sized once: the floor
// with its glowing grid and rim, the reactor columns round it, the crates (stacks and the closed ring),
// the cores of the wave in play (tinted their colour, dropping in from above, fading and dropping again,
// circling their pylons, sealed in capsules until opened), the flickering decoy cores (a dark ring under
// them), the tesla coils and their arcs, the core gate (sealed, then open and glowing), the orbs and the
// secrets.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, Euler, PlaneGeometry, Quaternion, RepeatWrapping, Vector3, type Color, type Group, type Matrix4, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, useCanvasTexture } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS, CORE_SIZE, GLB_SIZE, ORB_SIZE } from "./assets";
import { CORE_COLORS, COLORS, accentFor } from "./look";
import { CRATE_H, CRATE_R } from "./course";
import { DROP_MS, FADE_MS, corePos, decoyColor, teslaOn, type CoreRun } from "./rules";

const V = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const P = { x: 0, z: 0 };

const drawGlow = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
   g.addColorStop(0, "rgba(255,255,255,1)");
   g.addColorStop(0.35, "rgba(255,255,255,0.55)");
   g.addColorStop(1, "rgba(255,255,255,0)");
   ctx.fillStyle = g;
   ctx.fillRect(0, 0, w, h);
};

const drawPanel = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   ctx.fillStyle = "#1a2232";
   ctx.fillRect(0, 0, w, h);
   ctx.strokeStyle = "rgba(94,234,212,0.5)";
   ctx.lineWidth = 3;
   ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
   ctx.fillStyle = "rgba(148,163,184,0.18)";
   ctx.beginPath();
   ctx.arc(w / 2, h / 2, w * 0.12, 0, Math.PI * 2);
   ctx.fill();
};

/** The floor, its rim, the reactor columns round it. */
function Floor({ run, level }: { run: CoreRun; level: LevelId }) {
   const H = run.course.half;
   const panel = useCanvasTexture(128, 128, drawPanel);
   useEffect(() => {
      panel.wrapS = panel.wrapT = RepeatWrapping;
      panel.repeat.set(H, H);
      panel.needsUpdate = true;
   }, [panel, H]);
   const accent = accentFor(level);
   const cols = useMemo(() => {
      const out: { x: number; z: number; k: number }[] = [];
      const n = 5;
      for (let i = 0; i < n; i++) {
         const t = -H + ((i + 0.5) * 2 * H) / n;
         out.push({ x: t, z: -H - 2.5, k: 1 + (i % 2) * 0.3 }, { x: -H - 2.5, z: t, k: 1 }, { x: H + 2.5, z: t, k: 1 });
      }
      return out;
   }, [H]);
   const gr = GLB_SIZE.reactor;
   const col = (i: number, m: Matrix4) => {
      const c = cols[i];
      if (!c) return false;
      E.set(0, i * 0.9, 0);
      Q.setFromEuler(E);
      const k = (6 * c.k) / gr.y;
      m.compose(V.set(c.x, -0.2, c.z), Q, S.set(k, k, k));
   };
   return (
      <group>
         <mesh position={[0, -0.25, 0]} receiveShadow>
            <boxGeometry args={[H * 2 + 1, 0.5, H * 2 + 1]} />
            <meshStandardMaterial color={COLORS.floor} roughness={0.6} metalness={0.3} />
         </mesh>
         <mesh position={[0, 0.006, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[H * 2, H * 2]} />
            <meshStandardMaterial map={panel} roughness={0.5} metalness={0.4} />
         </mesh>
         {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[k === 0 ? -H : k === 1 ? H : 0, 0.12, k === 2 ? -H : k === 3 ? H : 0]}>
               <boxGeometry args={[k < 2 ? 0.25 : H * 2 + 0.25, 0.24, k < 2 ? H * 2 + 0.25 : 0.25]} />
               <meshBasicMaterial color={accent} toneMapped={false} />
            </mesh>
         ))}
         <DynamicInstancedModel asset={ASSETS.reactor} count={cols.length} update={col} name="reactor-columns" />
      </group>
   );
}

/** The crates (a stack is two). */
function Crates({ run }: { run: CoreRun }) {
   const boxes = useMemo(() => {
      const out: { x: number; z: number; y: number }[] = [];
      for (const c of run.course.crates) for (let k = 0; k < c.stack; k++) out.push({ x: c.x, z: c.z, y: k * CRATE_H });
      return out;
   }, [run.course]);
   const g = GLB_SIZE.crate;
   const update = (i: number, m: Matrix4) => {
      const b = boxes[i];
      if (!b) return false;
      E.set(0, (i % 4) * (Math.PI / 2), 0);
      Q.setFromEuler(E);
      m.compose(V.set(b.x, b.y, b.z), Q, S.set((CRATE_R * 2) / g.x, CRATE_H / g.y, (CRATE_R * 2) / g.z));
   };
   if (boxes.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.crate} count={boxes.length} update={update} name="crates" />;
}

/** The cores of the wave in play, tinted their colour; the decoys; the capsules; the pylons. */
function Cores({ run }: { run: CoreRun }) {
   const time = useGameTime();
   const camera = useThree((s) => s.camera);
   const glow = useCanvasTexture(64, 64, drawGlow);
   const g = GLB_SIZE.core;
   const max = 8;
   /** height and size of core i now: falling in, fading out */
   const look = (i: number): { y: number; k: number } | null => {
      const w = run.course.waves[run.wave];
      if (!w || !w.cores[i] || run.taken[i]) return null;
      const t = run.ms - run.dropAt[i];
      if (t < 0) return null;
      const fall = Math.min(1, t / DROP_MS);
      const life = run.course.config.lifeMs;
      const fade = w.cores[i].altX !== w.cores[i].x ? Math.max(0, Math.min(1, (DROP_MS + life - t) / FADE_MS)) : 1;
      return { y: 1 + 8 * (1 - fall) * (1 - fall) + Math.sin(time.now * 3 + i) * 0.12, k: fade };
   };
   const core = (i: number, m: Matrix4, color: Color) => {
      const w = run.course.waves[run.wave];
      const l = look(i);
      if (!w || !l) return false;
      const c = w.cores[i];
      if (c.kind === "capsule" && !run.open[i]) return false;
      corePos(run, i, run.ms, P);
      E.set(0, time.now * 1.6 + i, 0);
      Q.setFromEuler(E);
      const k = (CORE_SIZE / g.y) * l.k;
      m.compose(V.set(P.x, l.y - CORE_SIZE / 2, P.z), Q, S.set(k, k, k));
      color.set(CORE_COLORS[c.color]);
   };
   const halo = (i: number, m: Matrix4, color: Color) => {
      const w = run.course.waves[run.wave];
      const l = look(i);
      if (!w || !l) return false;
      const c = w.cores[i];
      if (c.kind === "capsule" && !run.open[i]) return false;
      corePos(run, i, run.ms, P);
      const sz = 1.6 * l.k * (1 + Math.sin(time.now * 5 + i) * 0.1);
      m.compose(V.set(P.x, l.y, P.z), camera.quaternion, S.set(sz, sz, sz));
      color.set(CORE_COLORS[c.color]);
   };
   // the decoys: a core flickering between two colours over a dark ring
   const decoy = (i: number, m: Matrix4, color: Color) => {
      const w = run.course.waves[run.wave];
      const d = w?.decoys[i];
      if (!d || run.ms < run.dropAt[0] + DROP_MS) return false;
      E.set(0, time.now * 3, 0);
      Q.setFromEuler(E);
      const k = (CORE_SIZE * 0.9) / g.y;
      m.compose(V.set(d.x, 1 - CORE_SIZE / 2 + Math.sin(time.now * 9) * 0.06, d.z), Q, S.set(k, k, k));
      color.set(CORE_COLORS[decoyColor(run, d)]);
   };
   const ring = (i: number, m: Matrix4) => {
      const w = run.course.waves[run.wave];
      const d = w?.decoys[i];
      if (!d || run.ms < run.dropAt[0] + DROP_MS) return false;
      E.set(-Math.PI / 2, 0, 0);
      Q.setFromEuler(E);
      m.compose(V.set(d.x, 0.03, d.z), Q, S.set(1, 1, 1));
   };
   // capsules (closed) and pylons (an orbiting core's centre)
   const gc = GLB_SIZE.capsule;
   const capsule = (i: number, m: Matrix4) => {
      const w = run.course.waves[run.wave];
      const c = w?.cores[i];
      if (!c || c.kind !== "capsule" || run.taken[i] || run.open[i] || run.ms < run.dropAt[i]) return false;
      const t = Math.min(1, (run.ms - run.dropAt[i]) / DROP_MS);
      E.set(0, i, 0);
      Q.setFromEuler(E);
      const k = 1.3 / gc.y;
      m.compose(V.set(run.alt[i] ? c.altX : c.x, 7 * (1 - t) * (1 - t), run.alt[i] ? c.altZ : c.z), Q, S.set(k, k, k));
   };
   const gp = GLB_SIZE.pylon;
   const pylon = (i: number, m: Matrix4) => {
      const w = run.course.waves[run.wave];
      const c = w?.cores[i];
      if (!c || c.kind !== "orbit" || run.taken[i]) return false;
      Q.identity();
      const k = 2.2 / gp.y;
      m.compose(V.set(run.alt[i] ? c.altX : c.x, 0, run.alt[i] ? c.altZ : c.z), Q, S.set(k, k, k));
   };
   const plane = useMemo(() => new PlaneGeometry(1, 1), []);
   useEffect(() => () => plane.dispose(), [plane]);
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.core} count={max} update={core} name="cores" tinted />
         <DynamicInstanced count={max} update={halo} name="core-halos" tinted>
            <primitive object={plane} attach="geometry" />
            <meshBasicMaterial color="#ffffff" map={glow} transparent opacity={0.85} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstancedModel asset={ASSETS.core} count={3} update={decoy} name="decoys" tinted />
         <DynamicInstanced count={3} update={ring} name="decoy-rings">
            <ringGeometry args={[0.7, 1.0, 28]} />
            <meshBasicMaterial color="#0b0b12" transparent opacity={0.85} depthWrite={false} />
         </DynamicInstanced>
         <DynamicInstancedModel asset={ASSETS.capsule} count={max} update={capsule} name="capsules" />
         <DynamicInstancedModel asset={ASSETS.pylon} count={max} update={pylon} name="pylons" />
      </>
   );
}

/** The tesla coils and their arcs (a crackling ring while they zap). */
function Teslas({ run }: { run: CoreRun }) {
   const c = run.course;
   const time = useGameTime();
   const gt = GLB_SIZE.tesla;
   const coil = (i: number, m: Matrix4) => {
      const t = c.teslas[i];
      if (!t) return false;
      Q.identity();
      const k = 2.6 / gt.y;
      m.compose(V.set(t.x, 0, t.z), Q, S.set(k, k, k));
   };
   const arc = (i: number, m: Matrix4, color: Color) => {
      const t = c.teslas[i];
      if (!t) return false;
      const on = teslaOn(run, i);
      const soon = teslaOn(run, i, run.ms + 500);
      if (!on && !soon) return false;
      E.set(-Math.PI / 2, 0, time.now * 6);
      Q.setFromEuler(E);
      const r = t.radius * (on ? 1 + Math.sin(time.now * 40) * 0.04 : 1);
      m.compose(V.set(t.x, on ? 0.6 : 0.04, t.z), Q, S.set(r, r, 1));
      color.set(on ? "#a5f3fc" : "#334155");
   };
   if (c.teslas.length === 0) return null;
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.tesla} count={c.teslas.length} update={coil} name="tesla-coils" />
         <DynamicInstanced count={c.teslas.length} update={arc} name="tesla-arcs" tinted>
            <ringGeometry args={[0.85, 1, 40]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

/** The core gate: sealed until the order is complete, then open and glowing. */
function Gate({ run }: { run: CoreRun }) {
   const c = run.course;
   const time = useGameTime();
   const seal = useRef<Mesh>(null);
   const glowRing = useRef<Mesh>(null);
   const g = useRef<Group>(null);
   useFrame(() => {
      const s = seal.current;
      if (s) {
         s.visible = !run.gateOpen;
         (s.material as MeshBasicMaterial).opacity = 0.45 + Math.sin(time.now * 4) * 0.1;
      }
      const r = glowRing.current;
      if (r) {
         r.visible = run.gateOpen;
         r.rotation.z = time.now * 1.5;
      }
      if (g.current) g.current.position.y = run.gateOpen ? Math.sin(time.now * 2) * 0.05 : 0;
   });
   const kg = 3.4 / GLB_SIZE.gate.y;
   const kb = 2.4 / GLB_SIZE.beacon.y;
   return (
      <group position={[c.gate.x, 0, c.gate.z]}>
         <group ref={g} scale={kg}>
            <Model asset={ASSETS.gate} />
         </group>
         <mesh ref={seal} position={[0, 1.4, 0.1]}>
            <planeGeometry args={[1.8, 2.6]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={glowRing} position={[0, 0.04, 1.2]} rotation-x={-Math.PI / 2} visible={false}>
            <ringGeometry args={[1.0, 1.5, 6]} />
            <meshBasicMaterial color={COLORS.open} toneMapped={false} />
         </mesh>
         {[-1, 1].map((side) => (
            <group key={side} position={[side * 2.4, 0, 0.3]} scale={kb}>
               <Model asset={ASSETS.beacon} />
            </group>
         ))}
      </group>
   );
}

/** The golden orbs (each wave's appear with it) with a halo tinted by whose route they are on. */
function Orbs({ run }: { run: CoreRun }) {
   const c = run.course;
   const time = useGameTime();
   const camera = useThree((s) => s.camera);
   const glow = useCanvasTexture(64, 64, drawGlow);
   const k = ORB_SIZE / GLB_SIZE.orb.x;
   const orb = (i: number, m: Matrix4) => {
      const o = c.orbs[i];
      if (run.collected[i] || o.wave > run.wave) return false;
      E.set(0, time.now * 2.2 + i, 0);
      Q.setFromEuler(E);
      m.compose(V.set(o.x, o.h - (GLB_SIZE.orb.y * k) / 2 + Math.sin(time.now * 2 + i) * 0.1, o.z), Q, S.set(k, k, k));
   };
   const halo = (i: number, m: Matrix4, color: Color) => {
      const o = c.orbs[i];
      if (run.collected[i] || o.wave > run.wave) return false;
      const sz = ORB_SIZE * (2.3 + Math.sin(time.now * 3 + i) * 0.2);
      m.compose(V.set(o.x, o.h + Math.sin(time.now * 2 + i) * 0.1, o.z), camera.quaternion, S.set(sz, sz, sz));
      color.set(o.bonus === "ring" ? "#c4b5fd" : o.bonus === "high" ? "#93c5fd" : o.bonus === "tesla" ? "#86efac" : "#ffe08a");
   };
   const plane = useMemo(() => new PlaneGeometry(1, 1), []);
   useEffect(() => () => plane.dispose(), [plane]);
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.orb} count={c.orbs.length} update={orb} name="orbs" />
         <DynamicInstanced count={c.orbs.length} update={halo} name="orb-halos" tinted>
            <primitive object={plane} attach="geometry" />
            <meshBasicMaterial color="#ffffff" map={glow} transparent opacity={0.7} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

/** The secrets: a spinning shard / sticker. */
function Secrets({ run }: { run: CoreRun }) {
   const c = run.course;
   const time = useGameTime();
   const refs = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      c.secrets.forEach((_sp, i) => {
         const m = refs.current[i];
         if (!m) return;
         m.visible = !run.secrets.found[i];
         m.rotation.y = time.now * 1.6;
      });
   });
   return (
      <>
         {c.secrets.map((sp, i) => (
            <mesh key={i} ref={(m) => { refs.current[i] = m; }} position={[sp.x, sp.h, sp.z]}>
               <octahedronGeometry args={[0.35, 0]} />
               <meshStandardMaterial color="#fef3c7" emissive="#f59e0b" emissiveIntensity={1} roughness={0.3} />
            </mesh>
         ))}
      </>
   );
}

export function Arena({ run, level }: { run: CoreRun; level: LevelId }) {
   return (
      <>
         <Floor run={run} level={level} />
         <Crates run={run} />
         <Cores run={run} />
         <Teslas run={run} />
         <Gate run={run} />
         <Orbs run={run} />
         <Secrets run={run} />
      </>
   );
}
