"use client";

// The playable roofs, drawn from the rules. m2RooftopBlock is fitted so its deck sits on the
// collider top. Moving and blinking roofs are one dynamic pool (hidden while gone). AC units
// (exhaust fans), solar racks, water tanks, chimneys and antennas are decor off the landing centre.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, Matrix4, Vector3, type Mesh } from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, ORB_SIZE } from "./assets";
import { COLORS, glowTexture } from "./look";
import { BillboardField, type Billboard } from "./World";
import { roofGone, strikeLive, supportX, supportZ, type Course as CourseData, type RoofRun, type Support } from "./rules";

/** The visual clock (ms of rules time), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

const BLOCK_SY = 1.15;
const SCRATCH = new Matrix4();
const SCALE = new Vector3();

function deckY(top: number): number {
   return top - GLB_SIZE.rooftopBlock.top * BLOCK_SY;
}

function blockScale(s: Support, target: Matrix4): void {
   const w = s.hw * 2;
   const d = s.hd * 2;
   target.makeScale(w / GLB_SIZE.rooftopBlock.x, BLOCK_SY, d / GLB_SIZE.rooftopBlock.z);
}

interface LiveRoof {
   s: Support;
   index: number;
}

function useSpots(course: CourseData) {
   return useMemo(() => {
      const roofs: InstanceSpot[] = [];
      const fans: InstanceSpot[] = [];
      const solar: InstanceSpot[] = [];
      const tanks: InstanceSpot[] = [];
      const chimneys: InstanceSpot[] = [];
      const antennas: InstanceSpot[] = [];
      const live: LiveRoof[] = [];
      const fanScale = 1.15 / GLB_SIZE.exhaustFan.y;
      const solarScale = 0.85 / GLB_SIZE.solarRack.y;
      course.supports.forEach((s, i) => {
         if (s.mover || s.vanish) {
            live.push({ s, index: i });
            return;
         }
         const spot: InstanceSpot = {
            x: s.cx,
            y: deckY(s.top),
            z: s.cz,
            rotY: (i % 2) * Math.PI,
            sx: (s.hw * 2) / GLB_SIZE.rooftopBlock.x,
            sy: BLOCK_SY,
            sz: (s.hd * 2) / GLB_SIZE.rooftopBlock.z,
         };
         roofs.push(spot);
         if (s.kind === "goal" || s.kind === "start") return;
         const side = s.cx >= 0 ? 1 : -1;
         const ax = s.cx + side * Math.max(0.4, s.hw - 0.85);
         const az = s.cz - Math.max(0.35, s.hd - 0.7);
         if (s.kind === "checkpoint") {
            chimneys.push({ x: ax, y: s.top, z: az, scale: 1 });
            return;
         }
         if (i % 3 === 1) fans.push({ x: ax, y: s.top, z: az, scale: fanScale, rotY: side > 0 ? 0.4 : -0.4 });
         else if (i % 3 === 2) solar.push({ x: s.cx - side * 0.4, y: s.top, z: s.cz + 0.2, scale: solarScale, rotY: 0.3 });
         else tanks.push({ x: ax, y: s.top, z: az + 0.35, scale: 1 });
         if (i % 5 === 2) antennas.push({ x: s.cx - side * (s.hw - 0.45), y: s.top, z: s.cz + s.hd * 0.35, scale: 1 });
      });
      return { roofs, fans, solar, tanks, chimneys, antennas, live };
   }, [course]);
}

/** Code water tanks: a drum and a cap, two tones, off the landing centre. */
function Tanks({ spots }: { spots: InstanceSpot[] }) {
   if (spots.length === 0) return null;
   return (
      <>
         {spots.map((p, i) => (
            <group key={i} position={[p.x, p.y, p.z]}>
               <mesh position={[0, 0.55, 0]}>
                  <cylinderGeometry args={[0.42, 0.46, 1.1, 12]} />
                  <meshStandardMaterial color="#94a3b8" roughness={0.45} metalness={0.35} />
               </mesh>
               <mesh position={[0, 1.16, 0]}>
                  <sphereGeometry args={[0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.4} />
               </mesh>
            </group>
         ))}
      </>
   );
}

function Chimneys({ spots }: { spots: InstanceSpot[] }) {
   if (spots.length === 0) return null;
   return (
      <>
         {spots.map((p, i) => (
            <group key={i} position={[p.x, p.y, p.z]}>
               <mesh position={[0, 0.85, 0]}>
                  <boxGeometry args={[0.42, 1.7, 0.42]} />
                  <meshStandardMaterial color="#7f1d1d" roughness={0.7} />
               </mesh>
               <mesh position={[0, 1.78, 0]}>
                  <boxGeometry args={[0.56, 0.16, 0.56]} />
                  <meshStandardMaterial color="#44403c" roughness={0.6} />
               </mesh>
            </group>
         ))}
      </>
   );
}

function Antennas({ spots }: { spots: InstanceSpot[] }) {
   if (spots.length === 0) return null;
   return (
      <>
         {spots.map((p, i) => (
            <group key={i} position={[p.x, p.y, p.z]}>
               <mesh position={[0, 1.15, 0]}>
                  <cylinderGeometry args={[0.04, 0.06, 2.3, 6]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.35} />
               </mesh>
               <mesh position={[0, 2.15, 0]} rotation={[0.4, 0, 0]}>
                  <cylinderGeometry args={[0.28, 0.28, 0.06, 10]} />
                  <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.3} />
               </mesh>
            </group>
         ))}
      </>
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

function Helipad({ course }: { course: CourseData }) {
   const goal = course.supports[course.goal];
   return (
      <group position={[goal.cx, goal.top + 0.04, goal.cz]}>
         <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.15, 1.45, 24]} />
            <meshBasicMaterial color="#f8fafc" />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
            <circleGeometry args={[0.35, 16]} />
            <meshBasicMaterial color="#facc15" />
         </mesh>
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
         <meshBasicMaterial color="#fef3c7" transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
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
               <meshBasicMaterial color="#e0f2fe" transparent opacity={0.35} depthWrite={false} />
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
         <InstancedModel asset={ASSETS.rooftopBlock} spots={spots.roofs} fallback={null} />
         <InstancedModel asset={ASSETS.exhaustFan} spots={spots.fans} fallback={null} />
         <InstancedModel asset={ASSETS.solarRack} spots={spots.solar} fallback={null} />
         {spots.live.length > 0 ? (
            <DynamicInstancedModel asset={ASSETS.rooftopBlock} count={spots.live.length} update={liveUpdate} name="live-roofs" />
         ) : null}
         {orbs.length > 0 ? <DynamicInstancedModel asset={ASSETS.coin} count={orbs.length} update={orbUpdate} name="coins" /> : null}
         <Tanks spots={spots.tanks} />
         <Chimneys spots={spots.chimneys} />
         <Antennas spots={spots.antennas} />
         <CheckpointLamps course={course} run={run} />
         <Helipad course={course} />
         <Ice course={course} />
         <Sparks run={run} clock={clock} />
         <BillboardField spots={halos} map={glow} additive aspect={1} opacity={0.85} live={hideCollected} renderOrder={5} />
      </>
   );
}
