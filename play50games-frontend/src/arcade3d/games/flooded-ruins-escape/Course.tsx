"use client";

// The playable stone ledges, drawn from the rules. m2RuinPlatform is fitted so its deck sits on the
// collider top. Moving and sinking ledges are one dynamic pool (hidden while gone). Brick lips,
// stone levers and water spouts sit off the landing centre. The flood plane rises with the rules.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, Group, Matrix4, Vector3, type Mesh } from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, ORB_SIZE } from "./assets";
import { COLORS, glowTexture } from "./look";
import { BillboardField, type Billboard } from "./World";
import { roofGone, strikeLive, supportX, supportZ, waterAt, type Course as CourseData, type RoofRun, type Support } from "./rules";

/** The visual clock (ms of rules time), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

const BLOCK_SY = 1.15;
const SCRATCH = new Matrix4();
const SCALE = new Vector3();

function deckY(top: number): number {
   return top - GLB_SIZE.platform.top * BLOCK_SY;
}

function blockScale(s: Support, target: Matrix4): void {
   const w = s.hw * 2;
   const d = s.hd * 2;
   target.makeScale(w / GLB_SIZE.platform.x, BLOCK_SY, d / GLB_SIZE.platform.z);
}

interface LiveRoof {
   s: Support;
   index: number;
}

function useSpots(course: CourseData) {
   return useMemo(() => {
      const ledges: InstanceSpot[] = [];
      const bricks: InstanceSpot[] = [];
      const levers: InstanceSpot[] = [];
      const spouts: InstanceSpot[] = [];
      const live: LiveRoof[] = [];
      const leverScale = 0.85 / GLB_SIZE.lever.y;
      const spoutScale = 1.15 / GLB_SIZE.spout.y;
      const brickSy = 0.42 / GLB_SIZE.brickLedge.y;
      course.supports.forEach((s, i) => {
         if (s.mover || s.vanish) {
            live.push({ s, index: i });
            return;
         }
         ledges.push({
            x: s.cx,
            y: deckY(s.top),
            z: s.cz,
            rotY: (i % 2) * Math.PI,
            sx: (s.hw * 2) / GLB_SIZE.platform.x,
            sy: BLOCK_SY,
            sz: (s.hd * 2) / GLB_SIZE.platform.z,
         });
         if (s.kind === "goal" || s.kind === "start") return;
         const side = s.cx >= 0 ? 1 : -1;
         const ax = s.cx + side * Math.max(0.4, s.hw - 0.85);
         const az = s.cz - Math.max(0.35, s.hd - 0.7);
         if (s.kind === "checkpoint") {
            levers.push({ x: ax, y: s.top, z: az, scale: leverScale, rotY: side > 0 ? 0.6 : -0.6 });
            return;
         }
         bricks.push({
            x: s.cx - side * (s.hw * 0.55),
            y: s.top,
            z: s.cz + s.hd * 0.15,
            rotY: side > 0 ? 0.4 : -0.4,
            sx: 1.5 / GLB_SIZE.brickLedge.x,
            sy: brickSy,
            sz: 1.15 / GLB_SIZE.brickLedge.z,
         });
         if (i % 3 === 1) spouts.push({ x: ax, y: s.top, z: az, scale: spoutScale, rotY: side > 0 ? 0.8 : -0.8 });
      });
      return { ledges, bricks, levers, spouts, live };
   }, [course]);
}

/** The rising flood. A translucent sheet plus a darker body under it. Visual only. */
function Flood({ run, clock }: { run: RoofRun; clock: VisualClock }) {
   const group = useRef<Group>(null);
   // the flood fills the whole shaft: the course's footprint plus a wide margin
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
      return { w: x1 - x0 + 50, d: z1 - z0 + 50, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
   }, [run]);
   const depth = box.d;
   useFrame(() => {
      const ms = clock.ms < 0 ? 0 : clock.ms;
      if (group.current) group.current.position.y = waterAt(run, ms);
   });
   return (
      <group ref={group} position={[box.cx, -3.4, box.cz]}>
         <mesh position={[0, -5, 0]}>
            <boxGeometry args={[box.w, 10, depth]} />
            <meshStandardMaterial color="#0c4a5a" transparent opacity={0.5} roughness={0.25} metalness={0.04} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
            <planeGeometry args={[box.w, depth]} />
            <meshStandardMaterial color={COLORS.water} transparent opacity={0.78} roughness={0.08} metalness={0.12} />
         </mesh>
      </group>
   );
}

function CheckpointLamps({ course, run }: { course: CourseData; run: RoofRun }) {
   const lamps = course.checkpoints.slice(1);
   return (
      <>
         {lamps.map((index) => {
            const s = course.supports[index];
            const lit = run.checkpoint >= course.checkpoints.indexOf(index);
            return (
               <group key={index} position={[s.cx - s.hw + 0.55, s.top, s.cz + s.hd - 0.55]}>
                  <mesh position={[0, 0.7, 0]}>
                     <cylinderGeometry args={[0.05, 0.07, 1.4, 6]} />
                     <meshStandardMaterial color="#334155" />
                  </mesh>
                  <mesh position={[0, 1.5, 0]}>
                     <sphereGeometry args={[0.16, 10, 8]} />
                     <meshStandardMaterial color={lit ? COLORS.beaconLit : COLORS.beaconIdle} emissive={lit ? COLORS.beaconLit : COLORS.beaconIdle} emissiveIntensity={0.8} />
                  </mesh>
               </group>
            );
         })}
      </>
   );
}

function FloodGateMark({ course }: { course: CourseData }) {
   const goal = course.supports[course.goal];
   const gateScale = 3.4 / GLB_SIZE.floodGate.y;
   return (
      <group position={[goal.cx, goal.top + 0.04, goal.cz]}>
         <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.15, 1.45, 24]} />
            <meshBasicMaterial color="#d6fff4" />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
            <circleGeometry args={[0.35, 16]} />
            <meshBasicMaterial color="#5eead4" />
         </mesh>
         <group position={[0, 0, -goal.hd + 0.35]} scale={gateScale}>
            <InstancedModel
               asset={ASSETS.floodGate}
               spots={[{ x: 0, y: 0, z: 0, scale: 1 }]}
               fallback={null}
            />
         </group>
      </group>
   );
}

function Sparks({ run, clock }: { run: RoofRun; clock: VisualClock }) {
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
         m.position.set(supportX(s, ms) + st.ox, s.top + 1.6, supportZ(s, ms) + st.oz);
         show = true;
         break;
      }
      m.visible = show;
   });
   if (strikes.length === 0) return null;
   return (
      <mesh ref={mesh} visible={false}>
         <sphereGeometry args={[0.28, 8, 6]} />
         <meshBasicMaterial color="#67e8f9" transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
      </mesh>
   );
}

function Ice({ course }: { course: CourseData }) {
   const icy = course.supports.filter((s) => s.slippery);
   if (icy.length === 0) return null;
   return (
      <>
         {icy.map((s, i) => (
            <mesh key={i} position={[s.cx, s.top + 0.03, s.cz]} rotation-x={-Math.PI / 2}>
               <planeGeometry args={[s.hw * 1.6, s.hd * 1.6]} />
               <meshBasicMaterial color="#99f6e4" transparent opacity={0.28} depthWrite={false} />
            </mesh>
         ))}
      </>
   );
}

export function Course({ run, clock, won }: { run: RoofRun; clock: VisualClock; won: MutableRefObject<boolean> }) {
   const course = run.course;
   const spots = useSpots(course);
   const time = useGameTime();
   const orbs = course.orbs;

   const liveUpdate = (i: number, m: Matrix4) => {
      const { s, index } = spots.live[i];
      const gripped = run.hero.support === index && clock.ms <= run.hero.gripUntil;
      if (s.vanish && !gripped && roofGone(s, clock.ms)) return false;
      blockScale(s, SCRATCH);
      m.copy(SCRATCH);
      m.setPosition(supportX(s, clock.ms), deckY(s.top), supportZ(s, clock.ms));
   };

   const orbUpdate = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = orbs[i];
      m.makeRotationY(time.now * 2.4 + i);
      m.scale(SCALE.set(1, 1, 1));
      m.setPosition(o.x, o.y + Math.sin(time.now * 2 + i * 0.7) * 0.1, o.z);
   };

   const glow = useMemo(() => glowTexture(), []);
   useEffect(() => () => glow.dispose(), [glow]);
   const halos = useMemo<Billboard[]>(() => orbs.map((o) => ({ x: o.x, y: o.y, z: o.z, size: ORB_SIZE * 2.2, r: 1, g: 0.86, b: 0.42 })), [orbs]);
   const hideCollected = (data: Float32Array) => {
      let changed = false;
      for (let i = 0; i < orbs.length; i++) {
         const size = run.collected[i] ? 0 : ORB_SIZE * (2.1 + Math.sin(time.now * 3 + i) * 0.2);
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
         <InstancedModel asset={ASSETS.platform} spots={spots.ledges} fallback={null} />
         <InstancedModel asset={ASSETS.brickLedge} spots={spots.bricks} fallback={null} />
         <InstancedModel asset={ASSETS.lever} spots={spots.levers} fallback={null} />
         <InstancedModel asset={ASSETS.spout} spots={spots.spouts} fallback={null} />
         {spots.live.length > 0 ? (
            <DynamicInstancedModel asset={ASSETS.platform} count={spots.live.length} update={liveUpdate} name="live-ledges" />
         ) : null}
         {orbs.length > 0 ? <DynamicInstancedModel asset={ASSETS.coin} count={orbs.length} update={orbUpdate} name="coins" /> : null}
         <CheckpointLamps course={course} run={run} />
         <FloodGateMark course={course} />
         <Flood run={run} clock={clock} />
         <Ice course={course} />
         <Sparks run={run} clock={clock} />
         <BillboardField spots={halos} map={glow} additive aspect={1} opacity={0.85} live={hideCollected} renderOrder={5} />
      </>
   );
}
