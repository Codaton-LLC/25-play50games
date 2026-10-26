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
import { roofGone, strikeLive, supportX, supportZ, type Course as CourseData, type TempleRun, type Support } from "./rules";

/** The visual clock (ms of rules time), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

const DECK_SY = 1.35;
const SCRATCH = new Matrix4();
const SCALE = new Vector3();

function deckY(top: number): number {
   return top - GLB_SIZE.ledge.top * DECK_SY;
}

function deckScale(s: Support, target: Matrix4): void {
   target.makeScale((s.hw * 2) / GLB_SIZE.ledge.x, DECK_SY, (s.hd * 2) / GLB_SIZE.ledge.z);
}

interface LiveDeck {
   s: Support;
   index: number;
}

function useSpots(course: CourseData) {
   return useMemo(() => {
      const decks: InstanceSpot[] = [];
      const lanterns: InstanceSpot[] = [];
      const braziers: InstanceSpot[] = [];
      const posts: InstanceSpot[] = [];
      const beams: InstanceSpot[] = [];
      const live: LiveDeck[] = [];
      const lanternScale = 1.9 / GLB_SIZE.lantern.y;
      const bigLantern = 2.6 / GLB_SIZE.lantern.y;
      const brazierScale = 0.8 / GLB_SIZE.brazier.y;
      const postScale = 1.25 / GLB_SIZE.lanternDeck.y;
      course.supports.forEach((s, i) => {
         if (s.mover || s.vanish) {
            live.push({ s, index: i });
         } else {
            decks.push({ x: s.cx, y: deckY(s.top), z: s.cz, rotY: 0, sx: (s.hw * 2) / GLB_SIZE.ledge.x, sy: DECK_SY, sz: (s.hd * 2) / GLB_SIZE.ledge.z });
         }
         // two beams under the deck: the balcony is carried by the temple's timber
         if (!s.mover && !s.vanish) {
            for (const k of [-0.55, 0.55]) beams.push({ x: s.cx + k * s.hw, y: s.top - 1.15, z: s.cz, rotY: Math.PI / 2, sx: (s.hd * 1.7) / GLB_SIZE.beam.x, sy: 1.1, sz: 1.2 });
         }
         if (s.pad) {
            lanterns.push({ x: s.cx, y: s.top, z: s.cz, scale: bigLantern });
            return;
         }
         if (s.kind === "goal") return;
         if (s.kind === "checkpoint") {
            braziers.push({ x: s.cx + s.hw - 0.8, y: s.top, z: s.cz - s.hd + 0.8, scale: brazierScale });
            return;
         }
         // paper lantern posts on the rim of the balconies, off the landing centre
         const side = s.cx >= 0 ? 1 : -1;
         if (i % 2 === 0) posts.push({ x: s.cx + side * (s.hw - 0.4), y: s.top, z: s.cz - s.hd + 0.45, scale: postScale });
         else lanterns.push({ x: s.cx - side * (s.hw - 0.45), y: s.top, z: s.cz - s.hd + 0.5, scale: lanternScale * 0.55 });
      });
      return { decks, lanterns, braziers, posts, beams, live };
   }, [course]);
}

function CheckpointLamps({ course, run }: { course: CourseData; run: TempleRun }) {
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

/** The golden roof over the goal: three stacked temple roof sections and a lit gate lantern either side. */
function GoldenRoof({ course }: { course: CourseData }) {
   const goal = course.supports[course.goal];
   const roofs = useMemo<InstanceSpot[]>(() => {
      const w = 7.2 / GLB_SIZE.roofSection.x;
      return [
         { x: goal.cx, y: goal.top + 3.4, z: goal.cz - goal.hd - 0.4, sx: w, sy: 1.5, sz: w * 1.3 },
         { x: goal.cx, y: goal.top + 4.5, z: goal.cz - goal.hd - 0.4, sx: w * 0.72, sy: 1.5, sz: w * 0.95 },
         { x: goal.cx, y: goal.top + 5.5, z: goal.cz - goal.hd - 0.4, sx: w * 0.45, sy: 1.5, sz: w * 0.6 },
      ];
   }, [goal]);
   const gates = useMemo<InstanceSpot[]>(() => {
      const s = 3.2 / GLB_SIZE.lantern.y;
      return [
         { x: goal.cx - goal.hw + 0.7, y: goal.top, z: goal.cz + goal.hd - 0.7, scale: s },
         { x: goal.cx + goal.hw - 0.7, y: goal.top, z: goal.cz + goal.hd - 0.7, scale: s },
      ];
   }, [goal]);
   return (
      <>
         <InstancedModel asset={ASSETS.roofSection} spots={roofs} fallback={null} />
         <InstancedModel asset={ASSETS.lantern} spots={gates} fallback={null} />
         <group position={[goal.cx, goal.top + 0.05, goal.cz]}>
            <mesh rotation-x={-Math.PI / 2}>
               <ringGeometry args={[1.15, 1.5, 28]} />
               <meshBasicMaterial color="#fde68a" />
            </mesh>
         </group>
      </>
   );
}

function Sparks({ run, clock }: { run: TempleRun; clock: VisualClock }) {
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

export function Course({ run, clock, won }: { run: TempleRun; clock: VisualClock; won: MutableRefObject<boolean> }) {
   const course = run.course;
   const spots = useSpots(course);
   const time = useGameTime();
   const orbs = course.orbs;

   const liveUpdate = (i: number, m: Matrix4) => {
      const { s, index } = spots.live[i];
      const gripped = run.hero.support === index && clock.ms <= run.hero.gripUntil;
      if (s.vanish && !gripped && roofGone(s, clock.ms)) return false;
      deckScale(s, SCRATCH);
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
         <InstancedModel asset={ASSETS.ledge} spots={spots.decks} fallback={null} />
         <InstancedModel asset={ASSETS.beam} spots={spots.beams} fallback={null} />
         <InstancedModel asset={ASSETS.lantern} spots={spots.lanterns} fallback={null} />
         <InstancedModel asset={ASSETS.lanternDeck} spots={spots.posts} fallback={null} />
         <InstancedModel asset={ASSETS.brazier} spots={spots.braziers} fallback={null} />
         {spots.live.length > 0 ? <DynamicInstancedModel asset={ASSETS.ledge} count={spots.live.length} update={liveUpdate} name="live-decks" /> : null}
         {orbs.length > 0 ? <DynamicInstancedModel asset={ASSETS.coin} count={orbs.length} update={orbUpdate} name="coins" /> : null}
         <CheckpointLamps course={course} run={run} />
         <GoldenRoof course={course} />
         <Ice course={course} />
         <Sparks run={run} clock={clock} />
         <BillboardField spots={halos} map={glow} additive aspect={1} opacity={0.85} live={hideCollected} renderOrder={5} />
      </>
   );
}
