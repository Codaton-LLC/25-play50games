"use client";

// The playable cavern, drawn from the rules. Each GLB is fitted so its walkable top sits on the
// collider. Pillars that can heat, blink, sink or slide are dynamic pools (hidden while crumbled,
// gone or sunk). Also here: the heat glow on hot tops, the geyser vents and their spark columns, the
// rising lava with its heartbeat surge and glow, rocks and their shadow markers, the magma slugs, the
// secrets (with the cracked cap and the ghost obsidian wall), and level 5's Kalder the Magma Golem
// (m2MagmaGolemBoss) with his crust plates, back cracks, heart and the open hit zone's ring.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, type Matrix4, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, type PointLight, Vector3 } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { bossTimeScale, stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, EMBER_HEIGHT, GLB_SIZE, GOLEM_SCALE, GOLEM_SINK } from "./assets";
import { COLORS, glowTexture } from "./look";
import { BillboardField, type Billboard } from "./World";
import { SECRETS } from "./progression";
import {
   COLLAPSE_HOLD,
   HEAT,
   NONE,
   ZONES,
   heatAt,
   lavaAt,
   roofGone,
   sinceBeat,
   strikeLive,
   supportX,
   supportZ,
   surgeTelegraph,
   ventOpen,
   type Course as CourseData,
   type LavaRun,
   type Support,
} from "./rules";

/** The visual clock (ms of rules time), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

const PILLAR_H = 1.45;
const SLAB_H = 0.62;
const BRIDGE_H = 0.7;
const SCALE = new Vector3();

function fit(top: number, glbTop: number, sy: number): number {
   return top - glbTop * sy;
}

interface LivePillar {
   s: Support;
   index: number;
}

function useSpots(course: CourseData) {
   return useMemo(() => {
      const pillars: InstanceSpot[] = [];
      const rocks: InstanceSpot[] = [];
      const slugs: InstanceSpot[] = [];
      const vents: InstanceSpot[] = [];
      const livePillar: LivePillar[] = [];
      const liveCollapse: LivePillar[] = [];
      const liveBridge: LivePillar[] = [];
      const py = PILLAR_H / GLB_SIZE.pillar.y;
      const rockScale = 0.85 / GLB_SIZE.rock.y;
      const slugScale = 0.55 / GLB_SIZE.slug.y;
      const ventScale = 0.5 / GLB_SIZE.geyser.y;
      course.supports.forEach((s, i) => {
         if (s.zone > 0) return;
         if (s.vent) vents.push({ x: s.cx, y: s.top - 0.05, z: s.cz, scale: ventScale, rotY: i });
         if (s.heatRate === 2) slugs.push({ x: s.cx + s.hw * 0.45, y: s.top, z: s.cz - s.hd * 0.3, scale: slugScale, rotY: i * 0.7 });
         if (s.mover) {
            liveBridge.push({ s, index: i });
            return;
         }
         if (s.collapse) {
            liveCollapse.push({ s, index: i });
            return;
         }
         if (s.vanish || s.heat) {
            livePillar.push({ s, index: i });
            return;
         }
         pillars.push({
            x: s.cx,
            y: fit(s.top, GLB_SIZE.pillar.top, py),
            z: s.cz,
            rotY: (i % 2) * 0.4,
            sx: (s.hw * 2) / GLB_SIZE.pillar.x,
            sy: py,
            sz: (s.hd * 2) / GLB_SIZE.pillar.z,
         });
         if (s.kind === "goal" || s.kind === "start" || s.ring) return;
         const side = s.cx >= 0 ? 1 : -1;
         if (i % 3 === 0) rocks.push({ x: s.cx + side * (s.hw + 0.8), y: s.top - 1.1, z: s.cz, scale: rockScale, rotY: i });
      });
      return { pillars, rocks, slugs, vents, livePillar, liveCollapse, liveBridge };
   }, [course]);
}

function place(s: Support, ms: number, glb: { x: number; z: number; top: number }, sy: number, m: Matrix4): void {
   m.makeScale((s.hw * 2) / glb.x, sy, (s.hd * 2) / glb.z);
   m.setPosition(supportX(s, ms), fit(s.top, glb.top, sy), supportZ(s, ms));
}

const crumbled = (run: LavaRun, index: number, ms: number) => ms < run.crumbleUntil[index];

function CheckpointCrystals({ course, run }: { course: CourseData; run: LavaRun }) {
   const lamps = course.checkpoints.slice(1);
   return (
      <>
         {lamps.map((index) => {
            const s = course.supports[index];
            const lit = run.checkpoint >= course.checkpoints.indexOf(index);
            const color = lit ? COLORS.beaconLit : COLORS.beaconIdle;
            return (
               <mesh key={index} position={[s.cx, s.top + 0.55, s.cz]} rotation={[0.2, index, 0]}>
                  <octahedronGeometry args={[0.28, 0]} />
                  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={lit ? 0.9 : 0.35} roughness={0.3} />
               </mesh>
            );
         })}
      </>
   );
}

function GoalRing({ course }: { course: CourseData }) {
   if (course.arena) return null;
   const goal = course.supports[course.goal];
   return (
      <group position={[goal.cx, goal.top + 0.05, goal.cz]}>
         <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.2, 1.55, 24]} />
            <meshBasicMaterial color="#ffedd5" />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.35, 0.55, 16]} />
            <meshBasicMaterial color="#f97316" />
         </mesh>
      </group>
   );
}

/** Rocks shaken loose by the beat, with a dark shadow marker from the telegraph until they land. */
function FallingRocks({ run, clock }: { run: LavaRun; clock: VisualClock }) {
   const strikes = run.course.strikes;
   const rocks = useRef<Array<Mesh | null>>([]);
   const shadows = useRef<Array<Mesh | null>>([]);
   useFrame(() => {
      const ms = clock.ms < 0 ? 0 : clock.ms;
      for (let i = 0; i < strikes.length; i++) {
         const st = strikes[i];
         const s = run.course.supports[st.support];
         const x = supportX(s, ms) + st.ox;
         const z = supportZ(s, ms) + st.oz;
         const r = rocks.current[i];
         const live = strikeLive(st, ms);
         if (r) {
            r.visible = live;
            if (live) {
               const t = (ms / st.periodMs + st.phase) % 1;
               r.position.set(x, s.top + 2.4 - (t / Math.max(0.05, st.duty)) * 2.2, z);
            }
         }
         const sh = shadows.current[i];
         if (sh) {
            // from the beat's telegraph until the rock is down
            const since = sinceBeat(run.course, ms);
            sh.visible = live || surgeTelegraph(run.course, ms) > 0 || (!Number.isNaN(since) && since < 1300);
            sh.position.set(x, s.top + 0.03, z);
         }
      }
   });
   if (strikes.length === 0) return null;
   return (
      <>
         {strikes.map((st, i) => (
            <group key={i}>
               <mesh ref={(m) => void (rocks.current[i] = m)} visible={false}>
                  <dodecahedronGeometry args={[0.28, 0]} />
                  <meshStandardMaterial color="#9a3412" emissive="#ea580c" emissiveIntensity={0.4} roughness={0.6} />
               </mesh>
               <mesh ref={(m) => void (shadows.current[i] = m)} rotation-x={-Math.PI / 2} visible={false} renderOrder={2}>
                  <circleGeometry args={[st.radius + 0.25, 16]} />
                  <meshBasicMaterial color="#1c0a06" transparent opacity={0.55} depthWrite={false} />
               </mesh>
            </group>
         ))}
      </>
   );
}

function Glass({ course }: { course: CourseData }) {
   const icy = course.supports.filter((s) => s.slippery);
   if (icy.length === 0) return null;
   return (
      <>
         {icy.map((s, i) => (
            <mesh key={i} position={[s.cx, s.top + 0.04, s.cz]} rotation-x={-Math.PI / 2}>
               <circleGeometry args={[Math.min(s.hw, s.hd) * 0.7, 18]} />
               <meshBasicMaterial color="#fed7aa" transparent opacity={0.28} depthWrite={false} />
            </mesh>
         ))}
      </>
   );
}

const HEAT_SLOTS = 4;
const ORANGE = { r: 1, g: 0.42, b: 0.08 };
const WHITE = { r: 1, g: 0.95, b: 0.82 };

/** The hot-foot glow: the four hottest tops get a disc that goes from dull red through orange to white. */
function HeatGlow({ run, clock }: { run: LavaRun; clock: VisualClock }) {
   const discs = useRef<Array<Mesh | null>>([]);
   const order = useMemo(() => new Int32Array(HEAT_SLOTS), []);
   const heats = useMemo(() => new Float64Array(HEAT_SLOTS), []);
   useFrame(() => {
      const ms = clock.ms < 0 ? 0 : clock.ms;
      order.fill(-1);
      heats.fill(0);
      const sup = run.course.supports;
      for (let i = 0; i < sup.length; i++) {
         if (!sup[i].heat || crumbled(run, i, ms)) continue;
         const h = heatAt(run, i, ms);
         if (h <= 30) continue;
         for (let k = 0; k < HEAT_SLOTS; k++) {
            if (h > heats[k]) {
               for (let j = HEAT_SLOTS - 1; j > k; j--) {
                  heats[j] = heats[j - 1];
                  order[j] = order[j - 1];
               }
               heats[k] = h;
               order[k] = i;
               break;
            }
         }
      }
      for (let k = 0; k < HEAT_SLOTS; k++) {
         const d = discs.current[k];
         if (!d) continue;
         const i = order[k];
         d.visible = i >= 0;
         if (i < 0) continue;
         const s = sup[i];
         d.position.set(supportX(s, ms), s.top + 0.035, supportZ(s, ms));
         d.scale.set(s.hw * 0.95, s.hd * 0.95, 1);
         const h = heats[k];
         const mat = d.material as MeshBasicMaterial;
         const toWhite = Math.max(0, Math.min(1, (h - HEAT.orangeMs) / (HEAT.whiteMs - HEAT.orangeMs)));
         mat.color.setRGB(ORANGE.r + (WHITE.r - ORANGE.r) * toWhite, ORANGE.g + (WHITE.g - ORANGE.g) * toWhite, ORANGE.b + (WHITE.b - ORANGE.b) * toWhite);
         // a flicker once it is white-hot: it is about to go
         const flicker = h >= HEAT.whiteMs ? 0.75 + 0.25 * Math.sin(ms * 0.04) : 1;
         mat.opacity = Math.min(0.85, (h / HEAT.orangeMs) * 0.5) * flicker;
      }
   });
   return (
      <>
         {Array.from({ length: HEAT_SLOTS }, (_, k) => (
            <mesh key={k} ref={(m) => void (discs.current[k] = m)} rotation-x={-Math.PI / 2} visible={false} renderOrder={3}>
               <planeGeometry args={[2, 2]} />
               <meshBasicMaterial color="#ff6a13" transparent opacity={0} depthWrite={false} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}

/** The spark column over each vent: a faint shimmer, bright and tall while the vent is open. */
function VentColumns({ run, clock }: { run: LavaRun; clock: VisualClock }) {
   const list = useMemo(() => run.course.supports.map((s, i) => ({ s, i })).filter((v) => v.s.vent), [run.course]);
   const cols = useRef<Array<Mesh | null>>([]);
   useFrame(() => {
      const ms = clock.ms < 0 ? 0 : clock.ms;
      const tele = surgeTelegraph(run.course, ms);
      for (let k = 0; k < list.length; k++) {
         const c = cols.current[k];
         if (!c) continue;
         const { s, i } = list[k];
         const open = ventOpen(run, i, ms);
         const h = open ? 7 : 0.6 + tele * 1.4;
         c.scale.set(1, h, 1);
         c.position.set(s.cx, s.top + h / 2, s.cz);
         (c.material as MeshBasicMaterial).opacity = open ? 0.55 : 0.18 + tele * 0.25;
      }
   });
   return (
      <>
         {list.map((v, k) => (
            <mesh key={v.i} ref={(m) => void (cols.current[k] = m)} renderOrder={4}>
               <cylinderGeometry args={[0.55, 0.85, 1, 14, 1, true]} />
               <meshBasicMaterial color="#ffb347" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}

function Lava({ run, clock }: { run: LavaRun; clock: VisualClock }) {
   const course = run.course;
   const mesh = useRef<Mesh>(null);
   const light = useRef<PointLight>(null);
   const midZ = course.supports[course.route - 1].cz * 0.5;
   useFrame(() => {
      const m = mesh.current;
      if (!m) return;
      const ms = clock.ms < 0 ? 0 : clock.ms;
      const y = lavaAt(run, ms);
      m.position.y = y;
      // the heartbeat: the lava glows up through the telegraph and on the surge
      const tele = run.bossStartMs === NONE ? surgeTelegraph(course, ms) : 0;
      const surge = Math.max(0, y - Math.min(course.lavaCap, course.lava0 + (course.lavaRate * ms) / 1000));
      const pulse = Math.max(tele * tele, surge / 1.2);
      (m.material as MeshStandardMaterial).emissiveIntensity = 0.75 + 0.6 * pulse;
      const l = light.current;
      if (l) {
         l.position.set(run.hero.x, y + 2.5, run.hero.z);
         l.intensity = 6 + 18 * pulse;
      }
   });
   return (
      <>
         <mesh ref={mesh} rotation-x={-Math.PI / 2} position={[0, course.lava0, midZ]}>
            <circleGeometry args={[90, 40]} />
            <meshStandardMaterial color={COLORS.water} emissive="#ff4a00" emissiveIntensity={0.85} roughness={0.45} metalness={0.05} />
         </mesh>
         <pointLight ref={light} color="#ff5a1f" intensity={6} distance={22} decay={1.6} />
      </>
   );
}

/** The level's secrets: a glowing shard or sticker each (hidden once found), the cracked cap (Riko) and the ghost obsidian wall (Vexa). */
function Secrets({ run }: { run: LavaRun }) {
   const specs = SECRETS[run.level];
   const spots = run.course.secrets;
   const refs = useRef<Array<Mesh | null>>([]);
   const time = useGameTime();
   useFrame(() => {
      const t = time.now;
      for (let i = 0; i < spots.length; i++) {
         const m = refs.current[i];
         if (!m) continue;
         m.visible = !run.secrets.found[i];
         m.rotation.y = t * 1.8 + i;
         m.position.y = spots[i].y + Math.sin(t * 2.2 + i) * 0.12;
      }
   });
   return (
      <>
         {spots.map((p, i) => {
            const spec = specs[i];
            const shard = spec.kind === "shard";
            return (
               <group key={spec.id}>
                  <mesh ref={(m) => void (refs.current[i] = m)} position={[p.x, p.y, p.z]} rotation={[0, 0, shard ? 0 : Math.PI / 2]}>
                     {shard ? <octahedronGeometry args={[0.3, 0]} /> : <cylinderGeometry args={[0.32, 0.32, 0.08, 24]} />}
                     <meshStandardMaterial color={shard ? "#fecaca" : "#f9a8d4"} emissive={shard ? "#ef4444" : "#ec4899"} emissiveIntensity={1.4} roughness={0.25} toneMapped={false} />
                  </mesh>
                  {p.need === "dash" ? (
                     // the cracked basalt cap round the chimney shard
                     <mesh position={[p.x, p.y - 0.15, p.z]}>
                        <dodecahedronGeometry args={[0.62, 0]} />
                        <meshStandardMaterial color="#44403c" emissive="#7c2d12" emissiveIntensity={0.25} roughness={0.9} transparent opacity={0.85} />
                     </mesh>
                  ) : null}
                  {p.need === "phase" ? (
                     // the ghost obsidian wall, purple-outlined: solid-looking, only Vexa's phase takes the shard in it
                     <mesh position={[p.x, p.y, p.z]}>
                        <boxGeometry args={[0.5, 2.2, 2.2]} />
                        <meshStandardMaterial color="#1e1b4b" emissive="#8b5cf6" emissiveIntensity={0.55} transparent opacity={0.55} roughness={0.2} />
                     </mesh>
                  ) : null}
               </group>
            );
         })}
      </>
   );
}

/**
 * Kalder the Magma Golem (level 5): the m2MagmaGolemBoss GLB standing in the lava at the ring's centre.
 * He rears on a telegraph and slams on the attack (P1, P3), hunches forward in P2 (his back's cracks
 * glow), and shows a white-hot heart in P3. Three grey crust plates sit on his shoulders in P1, one
 * breaking per hit. The open zone gets a bright ring. A hit flashes him; on the defeat he sinks back
 * into the lava, which glows true red, on the boss's visual-only slow-mo.
 */
function Golem({ run }: { run: LavaRun }) {
   const a = run.course.arena!;
   const cfg = a.boss;
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const flash = useRef<Mesh>(null);
   const plates = useRef<Array<Mesh | null>>([]);
   const crack = useRef<Mesh>(null);
   const heart = useRef<Mesh>(null);
   const zoneRing = useRef<Mesh>(null);
   const time = useGameTime();
   const anim = useRef({ t: 0 });
   useFrame(() => {
      const g = root.current;
      const b = run.boss;
      const bd = body.current;
      if (!g || !b || !bd) return;
      const scale = bossTimeScale(b, cfg);
      anim.current.t += time.delta * scale;
      const t = anim.current.t;
      const started = run.bossStartMs !== NONE;
      const k = stepProgress(b, cfg);
      let lean = 0;
      let rise = 0;
      if (!started || b.step === "intro") rise = started ? -2.5 * (1 - k) : -2.5;
      else if (b.step === "telegraph") {
         lean = -0.18 * k;
         rise = 0.4 * k;
      } else if (b.step === "attack") {
         lean = 0.3 * (1 - (1 - k) * (1 - k));
         rise = 0.4 - 0.9 * k;
      } else if (b.step === "vulnerable") lean = 0.3 * (1 - k) * 0.5;
      if (b.phase === 1 && started) lean += 0.35;
      if (b.phase === 2 && started && b.step !== "defeat") lean -= 0.12;
      let sink = 0;
      if (b.step === "defeat" || b.step === "done") sink = Math.min(1, b.defeatMs / cfg.defeatMs) * 8;
      g.position.set(a.cx, a.top - GOLEM_SINK + rise - sink + Math.sin(t * 1.3) * 0.08, a.cz);
      bd.rotation.x = lean;
      bd.rotation.z = Math.sin(t * 0.9) * 0.03;
      const f = flash.current;
      if (f) {
         f.visible = b.flashMs > 0;
         (f.material as MeshBasicMaterial).opacity = Math.min(0.7, b.flashMs / cfg.hitFlashMs);
      }
      const p1Left = b.phase === 0 ? b.hp - 3 : 0;
      for (let i = 0; i < 3; i++) {
         const pm = plates.current[i];
         if (pm) pm.visible = started && i < p1Left;
      }
      const c = crack.current;
      if (c) {
         c.visible = started && b.phase === 1 && b.step !== "defeat";
         (c.material as MeshBasicMaterial).opacity = b.step === "vulnerable" ? 0.95 : 0.45;
      }
      const hm = heart.current;
      if (hm) {
         hm.visible = started && (b.phase === 2 || b.step === "defeat");
         const s = b.step === "vulnerable" ? 1 + 0.15 * Math.sin(t * 12) : 0.85;
         hm.scale.setScalar(s);
      }
      const zr = zoneRing.current;
      if (zr) {
         const open = started && b.step === "vulnerable";
         zr.visible = open;
         const z = ZONES[Math.min(2, b.phase)];
         zr.position.set(a.cx, a.top + z.lift + 0.06, a.cz);
         zr.scale.setScalar(z.half * (1 + 0.06 * Math.sin(t * 8)));
      }
   });
   const sy = GOLEM_SINK;
   return (
      <>
         <group ref={root} position={[a.cx, a.top - sy, a.cz]}>
            <group ref={body}>
               <Model asset={ASSETS.golem} scale={GOLEM_SCALE} />
               <mesh ref={flash} position={[0, 5, 0]} visible={false}>
                  <sphereGeometry args={[4.4, 16, 12]} />
                  <meshBasicMaterial color="#fff1e6" transparent opacity={0} depthWrite={false} toneMapped={false} />
               </mesh>
               {[-1, 0, 1].map((side, i) => (
                  <mesh key={i} ref={(m) => void (plates.current[i] = m)} position={[side * 1.2, sy + ZONES[0].lift - 0.1, side === 0 ? -0.4 : 0.2]} rotation={[0.1, side * 0.4, side * 0.3]}>
                     <boxGeometry args={[1.3, 0.35, 1.1]} />
                     <meshStandardMaterial color="#78716c" roughness={0.95} />
                  </mesh>
               ))}
               <mesh ref={crack} position={[0, sy + ZONES[1].lift + 0.05, -0.6]} rotation-x={-Math.PI / 2} visible={false}>
                  <planeGeometry args={[1.6, 2.6]} />
                  <meshBasicMaterial color="#ff7a1a" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
               </mesh>
               <mesh ref={heart} position={[0, sy + ZONES[2].lift - 0.9, 0.9]} visible={false}>
                  <icosahedronGeometry args={[0.9, 1]} />
                  <meshStandardMaterial color="#fecaca" emissive="#ef4444" emissiveIntensity={2.2} toneMapped={false} />
               </mesh>
            </group>
         </group>
         <mesh ref={zoneRing} rotation-x={-Math.PI / 2} visible={false} renderOrder={5}>
            <ringGeometry args={[0.82, 1, 32]} />
            <meshBasicMaterial color="#fde047" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}

export function Course({ run, clock, won }: { run: LavaRun; clock: VisualClock; won: MutableRefObject<boolean> }) {
   const course = run.course;
   const spots = useSpots(course);
   const time = useGameTime();
   const orbs = course.orbs;
   const py = PILLAR_H / GLB_SIZE.pillar.y;
   const cy = SLAB_H / GLB_SIZE.collapse.y;
   const by = BRIDGE_H / GLB_SIZE.bridge.y;

   const livePillar = (i: number, m: Matrix4) => {
      const { s, index } = spots.livePillar[i];
      const ms = clock.ms < 0 ? 0 : clock.ms;
      const gripped = run.hero.support === index && clock.ms <= run.hero.gripUntil;
      if (s.vanish && !gripped && roofGone(s, ms)) return false;
      if (crumbled(run, index, ms)) return false;
      place(s, ms, GLB_SIZE.pillar, py, m);
      return true;
   };
   const liveCollapse = (i: number, m: Matrix4) => {
      const { s, index } = spots.liveCollapse[i];
      const ms = clock.ms < 0 ? 0 : clock.ms;
      if (run.collapsed[index] > 0 && ms >= run.collapsed[index]) return false;
      if (crumbled(run, index, ms)) return false;
      place(s, ms, GLB_SIZE.collapse, cy, m);
      let drop = 0;
      if (run.hero.support === index && run.hero.collapseHold > ms && run.hero.collapseHold > 0) {
         const start = run.hero.collapseHold - COLLAPSE_HOLD;
         drop = Math.max(0, Math.min(1, (ms - start) / COLLAPSE_HOLD)) * 0.85;
      }
      m.elements[13] -= drop;
      return true;
   };
   const liveBridge = (i: number, m: Matrix4) => {
      const { s, index } = spots.liveBridge[i];
      const ms = clock.ms < 0 ? 0 : clock.ms;
      if (crumbled(run, index, ms)) return false;
      place(s, ms, GLB_SIZE.bridge, by, m);
      return true;
   };

   const emberUpdate = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = orbs[i];
      const bob = Math.sin(time.now * 2.2 + i * 0.7) * 0.08;
      const sc = EMBER_HEIGHT / GLB_SIZE.ember.y;
      m.makeRotationY(time.now * 1.6 + i);
      m.scale(SCALE.set(sc, sc, sc));
      m.setPosition(o.x, o.y + bob - EMBER_HEIGHT / 2, o.z);
      return true;
   };

   const glow = useMemo(() => glowTexture(), []);
   useEffect(() => () => glow.dispose(), [glow]);
   const halos = useMemo<Billboard[]>(() => orbs.map((o) => ({ x: o.x, y: o.y, z: o.z, size: 0.9, r: 1, g: 0.45, b: 0.12 })), [orbs]);
   const hideCollected = (data: Float32Array) => {
      let changed = false;
      for (let i = 0; i < orbs.length; i++) {
         const size = run.collected[i] ? 0 : 0.85 + Math.sin(time.now * 3 + i) * 0.12;
         if (data[i * 4 + 3] !== size) {
            data[i * 4 + 3] = size;
            changed = true;
         }
      }
      return changed;
   };

   void won;
   return (
      <>
         <InstancedModel asset={ASSETS.pillar} spots={spots.pillars} fallback={null} />
         <InstancedModel asset={ASSETS.rock} spots={spots.rocks} fallback={null} />
         <InstancedModel asset={ASSETS.slug} spots={spots.slugs} fallback={null} />
         <InstancedModel asset={ASSETS.geyser} spots={spots.vents} fallback={null} />
         {spots.livePillar.length > 0 ? <DynamicInstancedModel asset={ASSETS.pillar} count={spots.livePillar.length} update={livePillar} name="hot-pillars" /> : null}
         {spots.liveCollapse.length > 0 ? <DynamicInstancedModel asset={ASSETS.collapse} count={spots.liveCollapse.length} update={liveCollapse} name="collapse" /> : null}
         {spots.liveBridge.length > 0 ? <DynamicInstancedModel asset={ASSETS.bridge} count={spots.liveBridge.length} update={liveBridge} name="bridges" /> : null}
         {orbs.length > 0 ? <DynamicInstancedModel asset={ASSETS.ember} count={orbs.length} update={emberUpdate} name="embers" /> : null}
         <CheckpointCrystals course={course} run={run} />
         <GoalRing course={course} />
         <Glass course={course} />
         <HeatGlow run={run} clock={clock} />
         <VentColumns run={run} clock={clock} />
         <FallingRocks run={run} clock={clock} />
         <Lava run={run} clock={clock} />
         <Secrets run={run} />
         {course.arena ? <Golem run={run} /> : null}
         <BillboardField spots={halos} map={glow} additive aspect={1} opacity={0.9} live={hideCollected} renderOrder={5} />
      </>
   );
}
