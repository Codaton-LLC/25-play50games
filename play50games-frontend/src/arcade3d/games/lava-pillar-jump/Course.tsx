"use client";

// The playable pillars, drawn from the rules. Each GLB is fitted so its walkable top sits on the
// collider. Moving, blinking and collapsing pillars are dynamic pools (hidden while gone or dropped).
// Embers, falling rocks, magma slugs and the rising lava are drawn here too.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { type Matrix4, Vector3, type Mesh } from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, EMBER_HEIGHT, GLB_SIZE } from "./assets";
import { COLORS, glowTexture } from "./look";
import { BillboardField, type Billboard } from "./World";
import {
   COLLAPSE_HOLD,
   lavaY,
   roofGone,
   strikeLive,
   supportX,
   supportZ,
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
      const livePillar: LivePillar[] = [];
      const liveCollapse: LivePillar[] = [];
      const liveBridge: LivePillar[] = [];
      const py = PILLAR_H / GLB_SIZE.pillar.y;
      const rockScale = 0.85 / GLB_SIZE.rock.y;
      const slugScale = 0.55 / GLB_SIZE.slug.y;
      course.supports.forEach((s, i) => {
         if (s.mover) {
            liveBridge.push({ s, index: i });
            return;
         }
         if (s.collapse || s.vanish) {
            (s.collapse ? liveCollapse : livePillar).push({ s, index: i });
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
         if (s.kind === "goal" || s.kind === "start") return;
         const side = s.cx >= 0 ? 1 : -1;
         if (i % 3 === 0) {
            rocks.push({
               x: s.cx + side * (s.hw + 0.8),
               y: s.top - 1.1,
               z: s.cz,
               scale: rockScale,
               rotY: i,
            });
         }
      });
      for (const st of course.strikes) {
         const s = course.supports[st.support];
         slugs.push({
            x: s.cx + st.ox,
            y: s.top,
            z: s.cz + st.oz,
            scale: slugScale,
            rotY: st.ox >= 0 ? 0.6 : -0.6,
         });
      }
      return { pillars, rocks, slugs, livePillar, liveCollapse, liveBridge };
   }, [course]);
}

function place(s: Support, index: number, ms: number, glb: { x: number; z: number; top: number }, sy: number, m: Matrix4): void {
   m.makeScale((s.hw * 2) / glb.x, sy, (s.hd * 2) / glb.z);
   m.setPosition(supportX(s, ms), fit(s.top, glb.top, sy), supportZ(s, ms));
   void index;
}

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

function FallingRocks({ run, clock }: { run: LavaRun; clock: VisualClock }) {
   const strikes = run.course.strikes;
   const mesh = useRef<Mesh>(null);
   useFrame(() => {
      const m = mesh.current;
      if (!m) return;
      let show = false;
      const ms = clock.ms < 0 ? 0 : clock.ms;
      for (let i = 0; i < strikes.length; i++) {
         const st = strikes[i];
         if (!strikeLive(st, ms)) continue;
         const s = run.course.supports[st.support];
         const t = (ms / st.periodMs + st.phase) % 1;
         const drop = (t / Math.max(0.05, st.duty)) * 2.2;
         m.position.set(supportX(s, ms) + st.ox, s.top + 2.4 - drop, supportZ(s, ms) + st.oz);
         show = true;
         break;
      }
      m.visible = show;
   });
   if (strikes.length === 0) return null;
   return (
      <mesh ref={mesh} visible={false}>
         <dodecahedronGeometry args={[0.28, 0]} />
         <meshStandardMaterial color="#9a3412" emissive="#ea580c" emissiveIntensity={0.4} roughness={0.6} />
      </mesh>
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

function Lava({ course, clock }: { course: CourseData; clock: VisualClock }) {
   const mesh = useRef<Mesh>(null);
   const midZ = course.supports[course.goal].cz * 0.5;
   useFrame(() => {
      const m = mesh.current;
      if (!m) return;
      const ms = clock.ms < 0 ? 0 : clock.ms;
      m.position.y = lavaY(course, ms);
   });
   return (
      <mesh ref={mesh} rotation-x={-Math.PI / 2} position={[0, course.lava0, midZ]}>
         <circleGeometry args={[90, 40]} />
         <meshStandardMaterial color={COLORS.water} emissive="#ff3d00" emissiveIntensity={1.15} roughness={0.45} metalness={0.05} />
      </mesh>
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
      const gripped = run.hero.support === index && clock.ms <= run.hero.gripUntil;
      const ms = clock.ms < 0 ? 0 : clock.ms;
      if (s.vanish && !gripped && roofGone(s, ms)) return false;
      place(s, index, ms, GLB_SIZE.pillar, py, m);
      return true;
   };
   const liveCollapse = (i: number, m: Matrix4) => {
      const { s, index } = spots.liveCollapse[i];
      const ms = clock.ms < 0 ? 0 : clock.ms;
      if (run.collapsed[index] > 0 && ms >= run.collapsed[index]) return false;
      place(s, index, ms, GLB_SIZE.collapse, cy, m);
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
      place(s, index, ms, GLB_SIZE.bridge, by, m);
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
         {spots.livePillar.length > 0 ? <DynamicInstancedModel asset={ASSETS.pillar} count={spots.livePillar.length} update={livePillar} name="blink-pillars" /> : null}
         {spots.liveCollapse.length > 0 ? <DynamicInstancedModel asset={ASSETS.collapse} count={spots.liveCollapse.length} update={liveCollapse} name="collapse" /> : null}
         {spots.liveBridge.length > 0 ? <DynamicInstancedModel asset={ASSETS.bridge} count={spots.liveBridge.length} update={liveBridge} name="bridges" /> : null}
         {orbs.length > 0 ? <DynamicInstancedModel asset={ASSETS.ember} count={orbs.length} update={emberUpdate} name="embers" /> : null}
         <CheckpointCrystals course={course} run={run} />
         <GoalRing course={course} />
         <Glass course={course} />
         <FallingRocks run={run} clock={clock} />
         <Lava course={course} clock={clock} />
         <BillboardField spots={halos} map={glow} additive aspect={1} opacity={0.9} live={hideCollected} renderOrder={5} />
      </>
   );
}
