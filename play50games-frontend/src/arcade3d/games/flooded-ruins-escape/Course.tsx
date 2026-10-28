"use client";

// The drowned temple, drawn from the rules (nothing here decides gameplay). Ledges are m2RuinPlatform
// fitted so the deck sits on the collider top; chamber floors and tall walls are bevel-free stone
// boxes in two tones with a moss cap (one instanced draw call each); cracked brick (m2RuinBrickLedge)
// vanishes once Riko breaks it; ghost panels are see-through violet; floating crates (m2FlyingCrate)
// ride their chamber's water (supportTop). Each chamber's water is a surface plus a body at
// zoneLevel, with a ripple ring when a lever moves it and the card's glowing line on both walls at
// the level it is heading for. The storm tide rises under everything with a violet foam edge. Stone
// levers (m2StoneLever) tilt their handle with the position; bubble spouts (m2RuinWaterSpout) send a
// bubble column up; steam jets hiss while live; whirlpools turn on the water; cave bats (m2CaveBat)
// roost and swoop; orbs, secrets, checkpoint lamps, the exit flood gate (m2RuinFloodGateV2I), the Tide
// Bell (level 5) and Umbra Roller (m2ShadowArmadillo, level 5) from bossPose.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BoxGeometry, Color, DoubleSide, InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useJuice, createJuiceEmitter, type JuiceEmitter } from "@/arcade3d/menu2/juice";
import { ASSETS, BAT_SCALE, BOSS_SCALE, GLB_SIZE, ORB_SIZE } from "./assets";
import { COLORS, glowTexture } from "./look";
import { BillboardField, type Billboard } from "./World";
import {
   BOSS_R,
   NONE,
   batPos,
   jetLive,
   supportTop,
   tideY,
   zoneLevel,
   type Course as CourseData,
   type RuinRun,
   type Support,
} from "./rules";

/** The visual clock (ms of rules time), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

const BLOCK_SY = 1.15;
const SCALE = new Vector3();
const DUMMY = new Object3D();
const V = { x: 0, y: 0, z: 0 };

const deckY = (top: number) => top - GLB_SIZE.platform.top * BLOCK_SY;
const visMs = (clock: VisualClock) => Math.max(0, clock.ms);

/** A block is a thin ledge (drawn with the platform GLB) or a tall mass of stone (a box). */
function isLedge(s: Support): boolean {
   return (s.kind === "ledge" || s.kind === "checkpoint" || s.kind === "start" || s.kind === "goal") && s.top - s.bottom <= 2.2;
}

interface Split {
   ledges: InstanceSpot[];
   stone: number[];
   moss: number[];
   cracked: number[];
   ghosts: number[];
   crates: number[];
   /** cut-away blocks (a roof over a swim, a wall in front of the camera): drawn faint, they still collide */
   faint: number[];
}

function splitBlocks(course: CourseData): Split {
   const out: Split = { ledges: [], stone: [], moss: [], cracked: [], ghosts: [], crates: [], faint: [] };
   course.supports.forEach((s, i) => {
      if (s.float !== NONE) return void out.crates.push(i);
      if (s.hidden) return void out.faint.push(i);
      if (s.ghost) return void out.ghosts.push(i);
      if (s.crack) return void out.cracked.push(i);
      if (isLedge(s)) {
         out.ledges.push({ x: s.cx, y: deckY(s.top), z: s.cz, rotY: (i % 2) * Math.PI, sx: (s.hw * 2) / GLB_SIZE.platform.x, sy: BLOCK_SY, sz: (s.hd * 2) / GLB_SIZE.platform.z });
         // the ledge's body under the deck, down to its bottom
         out.stone.push(i);
         return;
      }
      out.stone.push(i);
      if (s.kind === "wall") out.moss.push(i);
   });
   return out;
}

const UNIT_BOX = new BoxGeometry(1, 1, 1);

/** Instanced boxes for blocks: from `bottom` up to `top - inset` (the ledge GLB sits on the rest), tinted per block. */
function StoneBoxes({ course, ids, color, shade, cap = false }: { course: CourseData; ids: number[]; color: string; shade: string; cap?: boolean }) {
   const ref = useRef<InstancedMesh>(null);
   const material = useMemo(() => new MeshStandardMaterial({ color: "#ffffff", roughness: 0.88, metalness: 0.02 }), []);
   useEffect(() => () => material.dispose(), [material]);
   useEffect(() => {
      const m = ref.current;
      if (!m) return;
      const a = new Color(color);
      const b = new Color(shade);
      const c = new Color();
      ids.forEach((id, k) => {
         const s = course.supports[id];
         const ledge = isLedge(s);
         const top = cap ? s.top + 0.12 : ledge ? deckY(s.top) + 0.05 : s.top;
         const bottom = cap ? s.top : s.bottom;
         const pad = cap ? 0.06 : ledge ? -0.04 : 0;
         DUMMY.position.set(s.cx, (top + bottom) / 2, s.cz);
         DUMMY.scale.set(s.hw * 2 + pad, Math.max(0.05, top - bottom), s.hd * 2 + pad);
         DUMMY.rotation.set(0, 0, 0);
         DUMMY.updateMatrix();
         m.setMatrixAt(k, DUMMY.matrix);
         c.copy(a).lerp(b, ((id * 37) % 10) / 14);
         m.setColorAt(k, c);
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
   }, [course, ids, color, shade, cap]);
   if (ids.length === 0) return null;
   return <instancedMesh ref={ref} args={[UNIT_BOX, material, ids.length]} />;
}

/** Cracked brick: the brick GLB fitted to the block, gone once broken. */
function CrackedBricks({ run, ids }: { run: RuinRun; ids: number[] }) {
   const update = (i: number, m: Matrix4) => {
      const id = ids[i];
      if (run.broken[id]) return false;
      const s = run.course.supports[id];
      const h = s.top - s.bottom;
      m.makeScale((s.hw * 2) / GLB_SIZE.brickLedge.x, h / GLB_SIZE.brickLedge.y, (s.hd * 2) / GLB_SIZE.brickLedge.z);
      m.setPosition(s.cx, s.bottom, s.cz);
   };
   if (ids.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.brickLedge} count={ids.length} update={update} name="cracked-brick" />;
}

/** Ghost panels: see-through violet stone (Vexa phases through them); also the faint cut-away blocks (grey, steady). */
function GhostPanels({ course, ids, color = "#c4b5fd", pulse = true }: { course: CourseData; ids: number[]; color?: string; pulse?: boolean }) {
   const time = useGameTime();
   const mats = useRef<(MeshBasicMaterial | null)[]>([]);
   useFrame(() => {
      for (let i = 0; i < mats.current.length; i++) {
         const m = mats.current[i];
         if (m) m.opacity = pulse ? 0.32 + 0.12 * Math.sin(time.now * 2.4 + i) : 0.16;
      }
   });
   return (
      <>
         {ids.map((id, k) => {
            const s = course.supports[id];
            return (
               <mesh key={id} position={[s.cx, (s.top + s.bottom) / 2, s.cz]} renderOrder={4}>
                  <boxGeometry args={[s.hw * 2, s.top - s.bottom, s.hd * 2]} />
                  <meshBasicMaterial ref={(m) => { mats.current[k] = m; }} color={color} transparent opacity={0.35} depthWrite={false} />
               </mesh>
            );
         })}
      </>
   );
}

/** Floating crates on their chamber's water. */
function Crates({ run, ids, clock }: { run: RuinRun; ids: number[]; clock: VisualClock }) {
   const update = (i: number, m: Matrix4) => {
      const s = run.course.supports[ids[i]];
      const top = supportTop(run.course, run.water, s, visMs(clock));
      m.makeScale((s.hw * 2) / GLB_SIZE.crate.x, 0.9 / GLB_SIZE.crate.y, (s.hd * 2) / GLB_SIZE.crate.z);
      m.setPosition(s.cx, top - 0.9, s.cz);
   };
   if (ids.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.crate} count={ids.length} update={update} name="crates" />;
}

/** One chamber's water: the body, the surface, a ripple ring on a lever change, and the target lines on its walls. */
function Chamber({ run, zi, clock }: { run: RuinRun; zi: number; clock: VisualClock }) {
   const z = run.course.zones[zi];
   const body = useRef<Mesh>(null);
   const surface = useRef<Mesh>(null);
   const ripple = useRef<Mesh>(null);
   const lines = useRef<Group>(null);
   const time = useGameTime();
   const memo = useRef({ target: Number.NaN, at: -9 });
   const w = z.maxX - z.minX;
   const d = z.maxZ - z.minZ;
   const cx = (z.minX + z.maxX) / 2;
   const cz = (z.minZ + z.maxZ) / 2;
   useFrame(() => {
      const ms = visMs(clock);
      const y = zoneLevel(run.water, zi, ms);
      const wet = y > z.floor + 0.02;
      const target = run.water.target[zi];
      if (memo.current.target !== target) {
         if (!Number.isNaN(memo.current.target)) memo.current.at = time.now;
         memo.current.target = target;
      }
      if (body.current) {
         body.current.visible = wet;
         body.current.position.y = (z.floor + y) / 2;
         body.current.scale.y = Math.max(0.01, y - z.floor);
      }
      if (surface.current) {
         surface.current.visible = wet;
         surface.current.position.y = y + 0.01;
      }
      const r = ripple.current;
      if (r) {
         const t = time.now - memo.current.at;
         r.visible = wet && t < 1.4;
         if (r.visible) {
            const k = t / 1.4;
            r.position.y = y + 0.03;
            r.scale.setScalar(0.3 + k * Math.max(w, d) * 0.5);
            (r.material as MeshBasicMaterial).opacity = 0.7 * (1 - k);
         }
      }
      const l = lines.current;
      if (l) {
         // the glowing line on the walls at the level the chamber is heading for (the card's lever readout)
         l.position.y = target + 0.02;
         l.visible = Math.abs(target - y) > 0.05 || time.now - memo.current.at < 3;
      }
   });
   return (
      <group>
         <mesh ref={body} position={[cx, z.floor, cz]} visible={false}>
            <boxGeometry args={[w, 1, d]} />
            <meshStandardMaterial color="#0c4a5a" transparent opacity={0.45} roughness={0.2} depthWrite={false} />
         </mesh>
         <mesh ref={surface} position={[cx, z.floor, cz]} rotation-x={-Math.PI / 2} visible={false} renderOrder={3}>
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial color={COLORS.water} transparent opacity={0.72} roughness={0.08} metalness={0.15} depthWrite={false} />
         </mesh>
         <mesh ref={ripple} position={[cx, z.floor, cz]} rotation-x={-Math.PI / 2} visible={false} renderOrder={4}>
            <ringGeometry args={[0.85, 1, 40]} />
            <meshBasicMaterial color="#e0fbff" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
         </mesh>
         <group ref={lines} position={[0, z.floor, 0]}>
            {[z.minX + 0.03, z.maxX - 0.03].map((x, i) => (
               <mesh key={i} position={[x, 0, cz]}>
                  <boxGeometry args={[0.05, 0.06, d]} />
                  <meshBasicMaterial color="#5eead4" toneMapped={false} />
               </mesh>
            ))}
         </group>
      </group>
   );
}

/** The storm tide: a dark sheet rising under the whole ruin, a violet foam edge that pulses like a heartbeat. */
function Tide({ run, clock }: { run: RuinRun; clock: VisualClock }) {
   const group = useRef<Group>(null);
   const foam = useRef<MeshBasicMaterial>(null);
   const time = useGameTime();
   const box = useMemo(() => {
      let x0 = Infinity;
      let x1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      for (const s of run.course.supports) {
         x0 = Math.min(x0, s.cx - s.hw);
         x1 = Math.max(x1, s.cx + s.hw);
         z0 = Math.min(z0, s.cz - s.hd);
         z1 = Math.max(z1, s.cz + s.hd);
      }
      return { w: x1 - x0 + 60, d: z1 - z0 + 60, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
   }, [run]);
   useFrame(() => {
      const g = group.current;
      if (!g) return;
      const y = tideY(run, visMs(clock));
      // before it starts it waits far below, out of sight
      g.position.y = Number.isFinite(y) ? y : run.course.tide.y0 - 4;
      if (foam.current) {
         const beat = Math.pow(Math.abs(Math.sin(time.now * 2.6)), 6);
         foam.current.opacity = Number.isFinite(y) ? 0.35 + 0.35 * beat : 0.15;
      }
   });
   return (
      <group ref={group} position={[box.cx, run.course.tide.y0, box.cz]}>
         <mesh position={[0, -6, 0]}>
            <boxGeometry args={[box.w, 12, box.d]} />
            <meshStandardMaterial color="#241b4a" transparent opacity={0.6} roughness={0.3} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
            <planeGeometry args={[box.w, box.d]} />
            <meshStandardMaterial color="#3b2f7a" transparent opacity={0.8} roughness={0.12} metalness={0.2} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 0]} renderOrder={5}>
            <planeGeometry args={[box.w, box.d]} />
            <meshBasicMaterial ref={foam} color="#a78bfa" transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
      </group>
   );
}

/** Stone levers: the GLB, and a handle that tilts from back (0) to forward (last) with the position. */
function Levers({ run }: { run: RuinRun }) {
   const levers = run.course.levers;
   const handles = useRef<(Group | null)[]>([]);
   const time = useGameTime();
   const tilt = useRef<number[]>(levers.map(() => 0));
   const spots = useMemo<InstanceSpot[]>(() => levers.map((l, i) => ({ x: l.x, y: l.y, z: l.z, scale: 0.9 / GLB_SIZE.lever.y, rotY: (i % 2) * 0.5 - 0.25 })), [levers]);
   useFrame(() => {
      for (let i = 0; i < levers.length; i++) {
         const g = handles.current[i];
         if (!g) continue;
         const l = levers[i];
         const goal = l.positions > 1 ? run.levers.pos[i] / (l.positions - 1) : 0;
         tilt.current[i] += (goal - tilt.current[i]) * Math.min(1, time.delta * 10);
         g.rotation.x = -0.7 + tilt.current[i] * 1.4;
      }
   });
   return (
      <>
         <InstancedModel asset={ASSETS.lever} spots={spots} fallback={null} />
         {levers.map((l, i) => (
            <group key={i} position={[l.x, l.y + 0.5, l.z]}>
               <group ref={(g) => { handles.current[i] = g; }}>
                  <mesh position={[0, 0.45, 0]}>
                     <cylinderGeometry args={[0.05, 0.06, 0.9, 6]} />
                     <meshStandardMaterial color="#6b5a48" roughness={0.8} />
                  </mesh>
                  <mesh position={[0, 0.92, 0]}>
                     <sphereGeometry args={[0.12, 10, 8]} />
                     <meshStandardMaterial color={l.kind === "pressure" ? "#f87171" : l.kind === "gate" ? "#fbbf24" : "#5eead4"} emissive={l.kind === "pressure" ? "#b91c1c" : l.kind === "gate" ? "#b45309" : "#0f766e"} emissiveIntensity={0.7} />
                  </mesh>
               </group>
            </group>
         ))}
      </>
   );
}

/** Bubble spouts: the GLB at the column's foot, a see-through column and rising bubbles (juice). */
function Spouts({ run }: { run: RuinRun }) {
   const spouts = run.course.spouts;
   const juice = useJuice();
   const emitters = useMemo<JuiceEmitter[]>(() => spouts.map(() => createJuiceEmitter()), [spouts]);
   const spots = useMemo<InstanceSpot[]>(() => spouts.map((s) => ({ x: s.x, y: s.y0, z: s.z, scale: (s.r * 1.6) / GLB_SIZE.spout.x })), [spouts]);
   useFrame(() => {
      for (let i = 0; i < spouts.length; i++) {
         const s = spouts[i];
         V.x = s.x;
         V.y = s.y0 + 0.3;
         V.z = s.z;
         juice.stream("aura", V, 10, emitters[i], { color: "#e0f7ff", vy: 1.4 });
      }
   });
   if (spouts.length === 0) return null;
   return (
      <>
         <InstancedModel asset={ASSETS.spout} spots={spots} fallback={null} />
         {spouts.map((s, i) => (
            <mesh key={i} position={[s.x, (s.y0 + s.y1) / 2, s.z]} renderOrder={4}>
               <cylinderGeometry args={[s.r, s.r, s.y1 - s.y0, 14, 1, true]} />
               <meshBasicMaterial color="#bae6fd" transparent opacity={0.16} depthWrite={false} side={DoubleSide} />
            </mesh>
         ))}
      </>
   );
}

/** Steam jets: a vent ring always, the white column while live. */
function Jets({ run, clock }: { run: RuinRun; clock: VisualClock }) {
   const jets = run.course.jets;
   const cols = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      const ms = visMs(clock);
      for (let i = 0; i < jets.length; i++) {
         const c = cols.current[i];
         if (!c) continue;
         const live = jetLive(jets[i], ms);
         c.visible = live;
         if (live) c.scale.set(1 + 0.08 * Math.sin(time.now * 30 + i), 1, 1 + 0.08 * Math.cos(time.now * 27 + i));
      }
   });
   if (jets.length === 0) return null;
   return (
      <>
         {jets.map((j, i) => (
            <group key={i} position={[j.x, j.y, j.z]}>
               <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
                  <ringGeometry args={[j.r * 0.5, j.r * 0.8, 20]} />
                  <meshBasicMaterial color="#fca5a5" transparent opacity={0.7} toneMapped={false} />
               </mesh>
               <mesh ref={(m) => { cols.current[i] = m; }} position={[0, j.h / 2, 0]} visible={false} renderOrder={5}>
                  <cylinderGeometry args={[j.r * 0.7, j.r, j.h, 14, 1, true]} />
                  <meshBasicMaterial color="#f8fafc" transparent opacity={0.5} depthWrite={false} side={DoubleSide} />
               </mesh>
            </group>
         ))}
      </>
   );
}

/** Whirlpools: a turning spiral on the chamber's water (shown while it has water). */
function Whirls({ run, clock }: { run: RuinRun; clock: VisualClock }) {
   const whirls = run.course.whirls;
   const refs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      const ms = visMs(clock);
      for (let i = 0; i < whirls.length; i++) {
         const m = refs.current[i];
         if (!m) continue;
         const w = whirls[i];
         const y = zoneLevel(run.water, w.zone, ms);
         m.visible = y > run.course.zones[w.zone].floor + 0.3;
         m.position.set(w.x, y + 0.04, w.z);
         m.rotation.z = -time.now * 2.2;
      }
   });
   if (whirls.length === 0) return null;
   return (
      <>
         {whirls.map((w, i) => (
            <mesh key={i} ref={(m) => { refs.current[i] = m; }} rotation-x={-Math.PI / 2} renderOrder={5}>
               <ringGeometry args={[w.core, w.r, 32, 1, 0, Math.PI * 1.6]} />
               <meshBasicMaterial color="#e0f2fe" transparent opacity={0.45} depthWrite={false} side={DoubleSide} />
            </mesh>
         ))}
      </>
   );
}

/** Cave bats: roosting (still, wings folded) or swooping (flapping) while their chamber is dry. */
function Bats({ run, clock }: { run: RuinRun; clock: VisualClock }) {
   const bats = run.course.bats;
   const time = useGameTime();
   const update = (i: number, m: Matrix4) => {
      const active = batPos(run.water, bats[i], visMs(clock), V);
      const flap = active ? 0.55 + 0.45 * Math.abs(Math.sin(time.now * 14 + i)) : 0.35;
      m.makeRotationY(active ? time.now * 2 + i : i);
      m.scale(SCALE.set(BAT_SCALE * flap, BAT_SCALE, BAT_SCALE));
      m.setPosition(V.x, V.y - (active ? 0.4 : 0.9), V.z);
   };
   if (bats.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.bat} count={bats.length} update={update} name="bats" />;
}

function CheckpointLamps({ course, run }: { course: CourseData; run: RuinRun }) {
   const lamps = course.checkpoints.slice(1);
   const bulbs = useRef<(MeshStandardMaterial | null)[]>([]);
   const lit = useMemo(() => new Color(COLORS.beaconLit), []);
   const idle = useMemo(() => new Color(COLORS.beaconIdle), []);
   useFrame(() => {
      for (let k = 0; k < lamps.length; k++) {
         const m = bulbs.current[k];
         if (!m) continue;
         const on = run.checkpoint >= k + 1;
         m.color.copy(on ? lit : idle);
         m.emissive.copy(on ? lit : idle);
      }
   });
   return (
      <>
         {lamps.map((index, k) => {
            const s = course.supports[index];
            return (
               <group key={index} position={[s.cx - s.hw + 0.45, s.top, s.cz + s.hd - 0.45]}>
                  <mesh position={[0, 0.7, 0]}>
                     <cylinderGeometry args={[0.05, 0.07, 1.4, 6]} />
                     <meshStandardMaterial color="#334155" />
                  </mesh>
                  <mesh position={[0, 1.5, 0]}>
                     <sphereGeometry args={[0.16, 10, 8]} />
                     <meshStandardMaterial ref={(m) => { bulbs.current[k] = m; }} color={COLORS.beaconIdle} emissive={COLORS.beaconIdle} emissiveIntensity={0.8} />
                  </mesh>
               </group>
            );
         })}
      </>
   );
}

/** The exit: the flood gate (v2) at the far edge of the goal ledge, a ring on the deck, and on level 5 the Tide Bell. */
function ExitGate({ run, won }: { run: RuinRun; won: MutableRefObject<boolean> }) {
   const course = run.course;
   const goal = course.supports[course.goal];
   const width = Math.min(goal.hw * 2, 4.2);
   const gateScale = width / GLB_SIZE.floodGate.x;
   const bell = useRef<Group>(null);
   const time = useGameTime();
   const rungAt = useRef(-1);
   useFrame(() => {
      const b = bell.current;
      if (!b) return;
      if (won.current && rungAt.current < 0) rungAt.current = time.now;
      const t = rungAt.current < 0 ? 0 : time.now - rungAt.current;
      b.rotation.z = rungAt.current < 0 ? 0 : Math.sin(t * 9) * 0.5 * Math.exp(-t * 0.8);
   });
   return (
      <group position={[goal.cx, goal.top + 0.04, goal.cz]}>
         <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.0, 1.3, 28]} />
            <meshBasicMaterial color="#d6fff4" toneMapped={false} />
         </mesh>
         <group position={[0, 0, -goal.hd + GLB_SIZE.floodGate.z * gateScale * 0.5]}>
            <Model asset={ASSETS.floodGate} scale={gateScale} fallback={null} />
         </group>
         {course.boss ? (
            <group position={[0, GLB_SIZE.floodGate.y * gateScale + 0.9, -goal.hd + 0.4]}>
               <group ref={bell}>
                  <mesh position={[0, -0.45, 0]}>
                     <cylinderGeometry args={[0.18, 0.5, 0.75, 18, 1, true]} />
                     <meshStandardMaterial color="#facc15" metalness={0.7} roughness={0.3} emissive="#a16207" emissiveIntensity={0.35} side={DoubleSide} />
                  </mesh>
                  <mesh position={[0, -0.85, 0]}>
                     <sphereGeometry args={[0.1, 8, 6]} />
                     <meshStandardMaterial color="#78350f" />
                  </mesh>
               </group>
            </group>
         ) : null}
      </group>
   );
}

/** The run's secrets: a shard (light blue crystal) or a sticker (pink card), gone once found; a sunken one shows only after its chamber flooded and drained. */
function Secrets({ run }: { run: RuinRun }) {
   const spots = run.course.secrets;
   const refs = useRef<(Group | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      for (let i = 0; i < spots.length; i++) {
         const g = refs.current[i];
         if (!g) continue;
         const s = spots[i];
         g.visible = !run.secrets.found[i] && (s.sunken === NONE || run.water.cycle[s.sunken] === 2);
         g.position.y = s.y + Math.sin(time.now * 2 + i) * 0.1;
         g.rotation.y = time.now * 1.5 + i;
      }
   });
   return (
      <>
         {spots.map((s, i) => (
            <group key={s.id} ref={(g) => { refs.current[i] = g; }} position={[s.x, s.y, s.z]}>
               {s.id.startsWith("ghost") ? (
                  <mesh>
                     <boxGeometry args={[0.42, 0.42, 0.05]} />
                     <meshStandardMaterial color="#f9a8d4" emissive="#db2777" emissiveIntensity={0.5} />
                  </mesh>
               ) : (
                  <mesh>
                     <octahedronGeometry args={[0.28]} />
                     <meshStandardMaterial color="#bae6fd" emissive="#38bdf8" emissiveIntensity={0.8} transparent opacity={0.9} />
                  </mesh>
               )}
            </group>
         ))}
      </>
   );
}

/** Umbra Roller (level 5) from bossPose: rolls (spinning) down the spiral and up the switchbacks, floats, sits in the drain, spins up the geyser, shrinks away when beaten. */
function Boss({ run }: { run: RuinRun }) {
   const arena = run.course.boss;
   const root = useRef<Group>(null);
   const spin = useRef<Group>(null);
   const geyser = useRef<Mesh>(null);
   const slab = useRef<Group>(null);
   const time = useGameTime();
   const state = useRef({ roll: 0, beatenAt: -1, last: { x: 0, z: 0 }, yaw: 0 });
   useFrame(() => {
      const g = root.current;
      const sp = spin.current;
      if (!g || !sp || !arena) return;
      const p = run.bossPose;
      const st = state.current;
      const dt = time.delta;
      const dx = p.x - st.last.x;
      const dz = p.z - st.last.z;
      const moved = Math.sqrt(dx * dx + dz * dz);
      if (moved > 1e-4 && moved < 2) st.yaw = Math.atan2(dx, dz);
      st.last.x = p.x;
      st.last.z = p.z;
      const rolling = p.mode === "roll" || p.mode === "chase";
      if (rolling) st.roll += (moved / BOSS_R) * (moved < 2 ? 1 : 0);
      if (p.mode === "geyser") st.roll += dt * 9;
      let y = p.y;
      let s = 1;
      if (p.mode === "float") y += Math.sin(time.now * 2.5) * 0.12;
      if (p.mode === "telegraph") {
         g.position.x = p.x + Math.sin(time.now * 40) * 0.06;
      } else g.position.x = p.x;
      if (p.mode === "beaten") {
         if (st.beatenAt < 0) st.beatenAt = time.now;
         s = Math.max(0, 1 - (time.now - st.beatenAt) / 1.6);
      }
      g.visible = s > 0.001;
      g.position.y = y;
      g.position.z = p.z;
      g.rotation.y = st.yaw;
      g.scale.setScalar(Math.max(0.001, s));
      // the GLB curls about its middle: spin about x round the ball's centre while rolling
      sp.rotation.x = rolling || p.mode === "geyser" ? st.roll : 0;
      const gy = geyser.current;
      if (gy) {
         gy.visible = p.mode === "geyser";
         if (gy.visible) {
            const h = Math.max(0.5, arena.geyserTop - arena.drain[1] + BOSS_R);
            gy.position.set(arena.drain[0], arena.drain[1] + h / 2, arena.drain[2]);
            gy.scale.set(1 + 0.06 * Math.sin(time.now * 25), h, 1 + 0.06 * Math.cos(time.now * 22));
         }
      }
      // the floodgate drops onto the gate once the boss is beaten (or while it sits there in the last phase)
      const sl = slab.current;
      if (sl) {
         const end = arena.chasePath[arena.chasePath.length - 1];
         const drop = p.mode === "beaten" ? Math.min(1, (time.now - st.beatenAt) / 0.35) : 0;
         sl.position.set(end[0], end[1] + 4.2 - 4.2 * drop, end[2]);
      }
   });
   if (!arena) return null;
   const end = arena.chasePath[arena.chasePath.length - 1];
   return (
      <>
         <group ref={root}>
            <group position={[0, BOSS_R, 0]}>
               <group ref={spin}>
                  <group position={[0, -GLB_SIZE.boss.y * BOSS_SCALE * 0.5, 0]}>
                     <Model asset={ASSETS.boss} scale={BOSS_SCALE} fallback={null} />
                  </group>
               </group>
            </group>
            <pointLight position={[0, BOSS_R * 2, 0]} intensity={4} distance={7} color="#a78bfa" />
         </group>
         <mesh ref={geyser} visible={false} renderOrder={5}>
            <cylinderGeometry args={[0.9, 1.2, 1, 16, 1, true]} />
            <meshBasicMaterial color="#e0f7ff" transparent opacity={0.45} depthWrite={false} side={DoubleSide} />
         </mesh>
         <group ref={slab} position={[end[0], end[1] + 4.2, end[2]]}>
            <Model asset={ASSETS.floodGate} scale={3.6 / GLB_SIZE.floodGate.x} fallback={null} />
         </group>
      </>
   );
}

export function Course({ run, clock, won }: { run: RuinRun; clock: VisualClock; won: MutableRefObject<boolean> }) {
   const course = run.course;
   const split = useMemo(() => splitBlocks(course), [course]);
   const time = useGameTime();
   const orbs = course.orbs;

   const orbUpdate = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = orbs[i];
      // a buried orb sits half sunk in its floor (only Zuno's magnet pulls it out of a drained floor)
      const buried = o.buried !== NONE;
      m.makeRotationY(time.now * (buried ? 0.8 : 2.4) + i);
      m.scale(SCALE.set(buried ? 0.75 : 1, buried ? 0.75 : 1, buried ? 0.75 : 1));
      m.setPosition(o.x, o.y + (buried ? -0.2 : Math.sin(time.now * 2 + i * 0.7) * 0.1), o.z);
   };

   const glow = useMemo(() => glowTexture(), []);
   useEffect(() => () => glow.dispose(), [glow]);
   const halos = useMemo<Billboard[]>(() => orbs.map((o) => ({ x: o.x, y: o.y, z: o.z, size: ORB_SIZE * 2.2, r: o.bonus ? 0.6 : 1, g: o.bonus ? 0.9 : 0.86, b: o.bonus ? 1 : 0.42 })), [orbs]);
   const hideCollected = (data: Float32Array) => {
      let changed = false;
      for (let i = 0; i < orbs.length; i++) {
         const size = run.collected[i] ? 0 : ORB_SIZE * (orbs[i].buried !== NONE ? 1.2 : 2.1 + Math.sin(time.now * 3 + i) * 0.2);
         if (data[i * 4 + 3] !== size) {
            data[i * 4 + 3] = size;
            changed = true;
         }
      }
      return changed;
   };

   return (
      <>
         <InstancedModel asset={ASSETS.platform} spots={split.ledges} fallback={null} />
         <StoneBoxes course={course} ids={split.stone} color={COLORS.rockMid} shade={COLORS.rockBottom} />
         <StoneBoxes course={course} ids={split.moss} color={COLORS.moss} shade="#2f5238" cap />
         <CrackedBricks run={run} ids={split.cracked} />
         <GhostPanels course={course} ids={split.ghosts} />
         <GhostPanels course={course} ids={split.faint} color="#94a3b8" pulse={false} />
         <Crates run={run} ids={split.crates} clock={clock} />
         {course.zones.map((_, zi) => (
            <Chamber key={zi} run={run} zi={zi} clock={clock} />
         ))}
         <Tide run={run} clock={clock} />
         <Levers run={run} />
         <Spouts run={run} />
         <Jets run={run} clock={clock} />
         <Whirls run={run} clock={clock} />
         <Bats run={run} clock={clock} />
         {orbs.length > 0 ? <DynamicInstancedModel asset={ASSETS.coin} count={orbs.length} update={orbUpdate} name="coins" /> : null}
         <CheckpointLamps course={course} run={run} />
         <ExitGate run={run} won={won} />
         <Secrets run={run} />
         <Boss run={run} />
         <BillboardField spots={halos} map={glow} additive aspect={1} opacity={0.85} live={hideCollected} renderOrder={5} />
      </>
   );
}
