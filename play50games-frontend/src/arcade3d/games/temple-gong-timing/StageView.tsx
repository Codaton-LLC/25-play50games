"use client";

// The stage (no gameplay here: rules.ts owns it). The round ruin floor (m2GongStage), the bronze gongs in
// their stone frames (m2TempleGong; level 3's ride round the stage) with their striker posts
// (m2StrikerPost), each swinging on a hit; the timing rings (m2TimingRing) shrinking onto the next notes'
// gongs (none for an answer to a call), turning gold inside the Perfect window; the ceremony drums
// (m2CeremonyDrum), the lantern pillars (m2RuinLanternPillar) with Nami's small high gongs on top, Vexa's
// ghost gong as a violet shimmer, the calls (a target glowing orange on its beat), the echo orbs (menu2
// scoreOrb), the off-beat shockwaves (a violet ring running out from the middle) and the card's colour
// return: flowers and moss grow round the rim with every Perfect.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, ConeGeometry, Euler, MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3, type Matrix4, type Mesh, type MeshStandardMaterial as MSM } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, DRUM_W, ECHO_SIZE, GLB_SIZE, GONG_W, STAGE_H } from "./assets";
import { DRUM_R, GHOST_R, GONG_R, PILLAR_H, PILLAR_R, SHOCK_SPEED, STAGE_R, STRIKE_R, gongAngle, type Target } from "./chart";
import { COLORS } from "./look";
import { ECHO_MS, GOOD_MS, PENDING, PERFECT_MS, type GongRun } from "./rules";

const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3();
const GOLD = new Color(COLORS.good);
const WHITE = new Color("#ffffff");
const CALL = new Color(COLORS.call);
const GHOST = new Color(COLORS.ghost);

/** The face centre and facing (towards the middle) of a target, for the rings. */
function face(run: GongRun, t: Target, ms: number, out: { x: number; y: number; z: number; rot: number; flat: boolean; size: number }) {
   const st = run.stage;
   out.flat = false;
   switch (t.kind) {
      case "gong": {
         const a = gongAngle(st, t.i, ms);
         const r = GONG_R - 0.45;
         out.x = r * Math.sin(a);
         out.z = r * Math.cos(a);
         out.y = 1.9;
         out.rot = a + Math.PI;
         out.size = GONG_W * 0.85;
         return out;
      }
      case "drum": {
         const a = st.drumAngles[t.i];
         out.x = DRUM_R * Math.sin(a);
         out.z = DRUM_R * Math.cos(a);
         out.y = 1.5;
         out.rot = 0;
         out.flat = true;
         out.size = DRUM_W;
         return out;
      }
      case "pillar": {
         const a = st.pillarAngles[t.i];
         out.x = (PILLAR_R - 0.4) * Math.sin(a);
         out.z = (PILLAR_R - 0.4) * Math.cos(a);
         out.y = PILLAR_H + 0.6;
         out.rot = a + Math.PI;
         out.size = 1.1;
         return out;
      }
      case "ghost": {
         out.x = GHOST_R * Math.sin(st.ghostAngle);
         out.z = GHOST_R * Math.cos(st.ghostAngle);
         out.y = 1.6;
         out.rot = st.ghostAngle + Math.PI;
         out.size = 1.4;
         return out;
      }
      case "great":
         out.x = 0;
         out.z = 0.4;
         out.y = 2.2;
         out.rot = 0;
         out.size = 2.6;
         return out;
   }
}

function Gongs({ run, hitAt }: { run: GongRun; hitAt: number[] }) {
   const st = run.stage;
   const time = useGameTime();
   const s = GONG_W / GLB_SIZE.gong.x;
   const gong = (i: number, m: Matrix4) => {
      if (i >= st.gongAngles.length) return false;
      const a = gongAngle(st, i, run.simMs);
      V.set(GONG_R * Math.sin(a), 0.7, GONG_R * Math.cos(a));
      const tau = time.now - hitAt[i];
      E.set(tau < 2 ? 0.12 * Math.exp(-3 * tau) * Math.sin(14 * tau) : 0, a + Math.PI, 0);
      Q.setFromEuler(E);
      S.set(s, s, s);
      m.compose(V, Q, S);
   };
   const ps = 1.9 / GLB_SIZE.post.y;
   const post = (i: number, m: Matrix4) => {
      if (i >= st.gongAngles.length) return false;
      const a = gongAngle(st, i, run.simMs) + 0.17;
      V.set((GONG_R + 0.2) * Math.sin(a), 0, (GONG_R + 0.2) * Math.cos(a));
      E.set(0, a + Math.PI, 0);
      Q.setFromEuler(E);
      S.set(ps, ps, ps);
      m.compose(V, Q, S);
   };
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.gong} count={st.gongAngles.length} update={gong} />
         <DynamicInstancedModel asset={ASSETS.post} count={st.gongAngles.length} update={post} />
      </>
   );
}

function Props({ run }: { run: GongRun }) {
   const st = run.stage;
   const drums = useMemo<InstanceSpot[]>(() => st.drumAngles.map((a) => ({ x: DRUM_R * Math.sin(a), y: 0, z: DRUM_R * Math.cos(a), rotY: a, scale: DRUM_W / GLB_SIZE.drum.x })), [st]);
   const pillars = useMemo<InstanceSpot[]>(
      () => st.pillarAngles.map((a) => ({ x: PILLAR_R * Math.sin(a), y: -0.5, z: PILLAR_R * Math.cos(a), rotY: a, sx: 1.2 / GLB_SIZE.pillar.x, sy: (PILLAR_H + 0.5) / GLB_SIZE.pillar.y, sz: 1.2 / GLB_SIZE.pillar.z })),
      [st],
   );
   const high = useMemo<InstanceSpot[]>(
      () => st.pillarAngles.map((a) => ({ x: (PILLAR_R - 0.2) * Math.sin(a), y: PILLAR_H, z: (PILLAR_R - 0.2) * Math.cos(a), rotY: a + Math.PI, scale: 1.2 / GLB_SIZE.gong.x })),
      [st],
   );
   const stageScale = (STAGE_R * 2) / GLB_SIZE.stage.x;
   const ghost = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const g = ghost.current;
      if (!g) return;
      (g.material as MSM).opacity = 0.18 + 0.12 * Math.sin(time.now * 2.3);
      g.rotation.z = Math.sin(time.now * 0.7) * 0.08;
   });
   return (
      <>
         <group position={[0, -STAGE_H, 0]} scale={[stageScale, STAGE_H / GLB_SIZE.stage.y, stageScale]}>
            <Model asset={ASSETS.stage} />
         </group>
         <InstancedModel asset={ASSETS.drum} spots={drums} fallback={null} />
         <InstancedModel asset={ASSETS.pillar} spots={pillars} fallback={null} />
         <InstancedModel asset={ASSETS.gong} spots={high} fallback={null} />
         {run.chart.notes.some((n) => n.bonus === "ghost") || run.level !== 5 ? (
            <mesh ref={ghost} position={[GHOST_R * Math.sin(st.ghostAngle), 1.6, GHOST_R * Math.cos(st.ghostAngle)]} rotation-y={st.ghostAngle + Math.PI}>
               <circleGeometry args={[0.8, 32]} />
               <meshStandardMaterial color={COLORS.ghost} emissive={COLORS.ghost} emissiveIntensity={0.6} transparent opacity={0.25} depthWrite={false} side={2} />
            </mesh>
         ) : null}
      </>
   );
}

const RING_POOL = 10;
const SPOT = { x: 0, y: 0, z: 0, rot: 0, flat: false, size: 1 };

/** The timing rings: one per upcoming note in its lead window, shrinking from 2.6x to 1x on its beat. */
function Rings({ run }: { run: GongRun }) {
   const lead = run.stage.cfg.leadBeats * run.stage.beatMs;
   const list = useMemo(() => new Array<number>(RING_POOL).fill(-1), []);
   const time = useGameTime();
   useFrame(() => {
      let k = 0;
      const notes = run.chart.notes;
      const now = run.simMs;
      for (let i = run.cursor; i < notes.length && k < RING_POOL; i++) {
         const n = notes[i];
         if (n.t - now > lead) break;
         if (run.grade[i] !== PENDING || n.silent) continue;
         if (n.bonus === "ghost" && run.heroId !== "vexa") continue;
         list[k++] = i;
      }
      for (; k < RING_POOL; k++) list[k] = -1;
   });
   const ring = (slot: number, m: Matrix4, c: Color) => {
      const i = list[slot];
      if (i < 0) return false;
      const n = run.chart.notes[i];
      const now = run.simMs;
      face(run, n.target, Math.max(now, n.t), SPOT);
      const k = Math.max(0, (n.t - now) / lead);
      const size = SPOT.size * (1 + 1.6 * k);
      const sc = size / GLB_SIZE.ring.x;
      V.set(SPOT.x, SPOT.y, SPOT.z);
      E.set(SPOT.flat ? 0 : Math.PI / 2, SPOT.rot, 0, "YXZ");
      Q.setFromEuler(E);
      S.set(sc, sc * 0.5, sc);
      m.compose(V, Q, S);
      const inPerfect = Math.abs(n.t - now) <= PERFECT_MS;
      c.copy(n.bonus === "ghost" ? GHOST : inPerfect ? GOLD : WHITE);
      if (!inPerfect && Math.abs(n.t - now) <= GOOD_MS) c.lerp(GOLD, 0.5);
      void time;
   };
   return <DynamicInstancedModel asset={ASSETS.ring} count={RING_POOL} update={ring} />;
}

/** The calls: a target glows orange on its beat (a lantern or Coilstone's tail plays it). */
function Calls({ run }: { run: GongRun }) {
   const pool = 4;
   const geo = useMemo(() => new TorusGeometry(1, 0.08, 6, 32), []);
   const update = (slot: number, m: Matrix4, c: Color) => {
      const now = run.simMs;
      let k = -1;
      let found = -1;
      for (let i = 0; i < run.chart.calls.length; i++) {
         const call = run.chart.calls[i];
         if (now < call.t - 60 || now > call.t + 420) continue;
         k++;
         if (k === slot) {
            found = i;
            break;
         }
      }
      if (found < 0) return false;
      const call = run.chart.calls[found];
      face(run, call.target, now, SPOT);
      const age = Math.max(0, (now - call.t) / 420);
      const sc = SPOT.size * 0.55 * (1 + age * 1.2);
      V.set(SPOT.x, SPOT.y, SPOT.z);
      E.set(SPOT.flat ? Math.PI / 2 : 0, SPOT.rot, 0, "YXZ");
      Q.setFromEuler(E);
      S.set(sc, sc, sc);
      m.compose(V, Q, S);
      c.copy(CALL).multiplyScalar(1.4 - age);
   };
   return (
      <DynamicInstanced count={pool} update={update} tinted name="calls">
         <primitive object={geo} attach="geometry" />
         <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </DynamicInstanced>
   );
}

function Echoes({ run }: { run: GongRun }) {
   const time = useGameTime();
   const s = ECHO_SIZE / GLB_SIZE.orb.y;
   const POOL = 12;
   const update = (slot: number, m: Matrix4) => {
      // the last POOL echoes, newest first
      const i = run.echoes.length - 1 - slot;
      if (i < 0) return false;
      const e = run.echoes[i];
      if (!e.alive) return false;
      const age = (run.simMs - e.born) / ECHO_MS;
      m.makeRotationY(time.now * 2 + i);
      const k = s * (age > 0.8 ? (1 - age) * 5 : 1);
      m.scale(S.set(k, k, k));
      m.setPosition(e.x, 0.6 + 0.6 * Math.min(1, age * 3) + 0.08 * Math.sin(time.now * 5 + i), e.z);
   };
   return <DynamicInstancedModel asset={ASSETS.orb} count={POOL} update={update} />;
}

function Shocks({ run }: { run: GongRun }) {
   const geo = useMemo(() => new TorusGeometry(1, 0.12, 6, 48).rotateX(Math.PI / 2), []);
   const update = (slot: number, m: Matrix4) => {
      const now = run.simMs;
      let k = -1;
      for (const s of run.chart.shocks) {
         const r = SHOCK_SPEED * ((now - s.t) / 1000) + STRIKE_R;
         if (r < 0.3 || r > STAGE_R + 0.5) continue;
         k++;
         if (k === slot) {
            m.makeScale(r, 1.6, r);
            m.setPosition(0, 0.12, 0);
            return;
         }
      }
      return false;
   };
   if (run.chart.shocks.length === 0 && !run.boss) return null;
   return (
      <DynamicInstanced count={3} update={update} name="shocks">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial color={COLORS.shock} emissive={COLORS.shock} emissiveIntensity={1.1} transparent opacity={0.75} />
      </DynamicInstanced>
   );
}

/** The colour returning: flowers round the rim, one more with every Perfect (60 in all). */
function Bloom({ run }: { run: GongRun }) {
   const N = 60;
   const parts = useMemo<InstancePart[]>(() => {
      const petals = mergeGeometries([0, 1, 2, 3, 4].map((k) => new ConeGeometry(0.09, 0.22, 5).rotateZ(Math.PI / 2.4).rotateY((k * Math.PI * 2) / 5).translate(0, 0.3, 0)))!;
      const stem = new ConeGeometry(0.05, 0.3, 5).translate(0, 0.15, 0);
      const bud = new SphereGeometry(0.06, 8, 6).translate(0, 0.32, 0);
      return [
         { geometry: petals, material: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 }) },
         { geometry: mergeGeometries([stem, bud])!, material: new MeshStandardMaterial({ color: COLORS.moss, roughness: 0.7 }) },
      ];
   }, []);
   const time = useGameTime();
   const grown = useRef(0);
   const pink = useMemo(() => new Color(COLORS.flower), []);
   const gold = useMemo(() => new Color(COLORS.flowerGold), []);
   useFrame(() => {
      const want = Math.min(N, run.perfects * 1.2);
      grown.current += (want - grown.current) * Math.min(1, time.delta * 3);
   });
   const update = (i: number, m: Matrix4, c: Color) => {
      if (i >= grown.current) return false;
      const a = i * 2.39996 + 0.3;
      const r = STAGE_R - 0.25 - (i % 3) * 0.25;
      const pop = Math.min(1, grown.current - i);
      const sc = 0.4 + 0.9 * pop;
      m.makeScale(sc, sc, sc);
      m.setPosition(r * Math.sin(a), 0.02, r * Math.cos(a));
      c.copy(i % 2 ? pink : gold);
   };
   return <DynamicInstanced count={N} update={update} parts={parts} tinted name="bloom" />;
}

export function Stage({ run }: { run: GongRun }) {
   // each gong's last hit (game time): it swings and settles after a strike
   const hitAt = useMemo(() => run.stage.gongAngles.map(() => -9), [run]);
   const time = useGameTime();
   useFrame(() => {
      const ev = run.ev;
      if (ev.note >= 0 && ev.strike !== PENDING) {
         const t = run.chart.notes[ev.note].target;
         if (t.kind === "gong") hitAt[t.i] = time.now;
      }
   });
   return (
      <>
         <Props run={run} />
         <Gongs run={run} hitAt={hitAt} />
         <Rings run={run} />
         <Calls run={run} />
         <Echoes run={run} />
         <Shocks run={run} />
         <Bloom run={run} />
      </>
   );
}
