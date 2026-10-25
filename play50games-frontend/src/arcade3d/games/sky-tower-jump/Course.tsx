"use client";

// The playable course, drawn from the rules' data (rules.ts COURSE_ROWS) with the Menu 2 GLBs fitted
// to each collider (assets.ts GLB_SIZE): grass islands, the checkpoint platforms with their beacons
// and light beams, the moving stone blocks, the plank bridges, the bounce pads with a pulsing glow and
// arrow, the sky gate with its portal, the orbs with their halos, and ladders as decor. Static props
// are instanced (one draw call per GLB); the movers and orbs are pools placed every frame from the
// rules' own functions (supportX / supportZ at the visual clock), so what is drawn is what collides.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, Vector3, type Matrix4, type Mesh } from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, ORB_SIZE } from "./assets";
import { COLORS, arrowTexture, glowTexture } from "./look";
import { BillboardField, type Billboard } from "./World";
import { PAD_HALF, supportX, supportZ, type Course as CourseData, type SkyRun } from "./rules";

/** The visual clock (ms of rules time to draw the movers at), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

const SCRATCH_SCALE = new Vector3();
const ISLAND_SY = 1.9;
const CHECKPOINT_SY = 1.6;
const MOVER_SY = 0.75;
const BRIDGE_SY = 1.3;
const PAD_SY = 0.55;
const PAD_SIZE = PAD_HALF * 2 + 0.2;

/** The beacon's spot on a checkpoint platform (back right corner, inside the top). */
export function beaconSpot(s: { cx: number; cz: number; hw: number; hd: number; top: number }): { x: number; y: number; z: number } {
   return { x: s.cx + s.hw - 0.75, y: s.top, z: s.cz - s.hd + 0.75 };
}

function useStaticSpots(course: CourseData) {
   return useMemo(() => {
      const islands: InstanceSpot[] = [];
      const checkpoints: InstanceSpot[] = [];
      const bridges: InstanceSpot[] = [];
      const pads: InstanceSpot[] = [];
      const beacons: InstanceSpot[] = [];
      const ladders: InstanceSpot[] = [];
      course.supports.forEach((s, i) => {
         if (s.mover) return;
         const w = s.hw * 2;
         const d = s.hd * 2;
         if (s.kind === "bridge") {
            const alongX = w >= d;
            bridges.push(
               alongX
                  ? { x: s.cx, y: s.top - GLB_SIZE.plankBridge.top * BRIDGE_SY, z: s.cz, sx: w / GLB_SIZE.plankBridge.x, sy: BRIDGE_SY, sz: d / GLB_SIZE.plankBridge.z }
                  : { x: s.cx, y: s.top - GLB_SIZE.plankBridge.top * BRIDGE_SY, z: s.cz, rotY: Math.PI / 2, sx: d / GLB_SIZE.plankBridge.x, sy: BRIDGE_SY, sz: w / GLB_SIZE.plankBridge.z },
            );
            return;
         }
         if (s.kind === "checkpoint") {
            checkpoints.push({ x: s.cx, y: s.top - GLB_SIZE.skyPlatform.top * CHECKPOINT_SY, z: s.cz, sx: w / GLB_SIZE.skyPlatform.x, sy: CHECKPOINT_SY, sz: d / GLB_SIZE.skyPlatform.z });
            const b = beaconSpot(s);
            beacons.push({ ...b, scale: 2.1 / GLB_SIZE.checkpointBeacon.y, rotY: -0.6 });
            return;
         }
         islands.push({ x: s.cx, y: s.top - GLB_SIZE.islandA.top * ISLAND_SY, z: s.cz, rotY: (i % 2) * Math.PI, sx: w / GLB_SIZE.islandA.x, sy: ISLAND_SY, sz: d / GLB_SIZE.islandA.z });
         if (s.pad) pads.push({ x: s.cx, y: s.top - 0.06, z: s.cz, sx: PAD_SIZE / GLB_SIZE.bouncePad.x, sy: PAD_SY, sz: PAD_SIZE / GLB_SIZE.bouncePad.z });
         // a ladder down the front of every fourth island (decor, as in the concept)
         if (s.kind === "island" && i % 4 === 1) {
            const side = s.cx > 0 ? 1 : -1;
            ladders.push({ x: s.cx + side * (s.hw + 0.12), y: s.top - 2.4, z: s.cz + s.hd * 0.3, scale: 2.6 / GLB_SIZE.woodenLadder.y, rotY: side * Math.PI / 2 });
         }
      });
      const goal = course.supports[course.goal];
      const gate: InstanceSpot[] = [{ x: goal.cx, y: goal.top - 0.02, z: goal.cz - goal.hd + 1.1, scale: 7 / GLB_SIZE.skyFortressGate.x }];
      return { islands, checkpoints, bridges, pads, beacons, ladders, gate };
   }, [course]);
}

/** Light beams over the beacons: blue until reached, gold once activated (run.checkpoint). */
function BeaconBeams({ course, run }: { course: CourseData; run: SkyRun }) {
   const time = useGameTime();
   const cps = useMemo(() => course.checkpoints.slice(1).map((i) => course.supports[i]), [course]);
   const meshes = useRef<Array<Mesh | null>>([]);
   const materials = useMemo(
      () => cps.map(() => new MeshBasicMaterial({ color: COLORS.beaconIdle, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })),
      [cps],
   );
   useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
   const lit = useMemo(() => new Color(COLORS.beaconLit), []);
   const idle = useMemo(() => new Color(COLORS.beaconIdle), []);
   useFrame(() => {
      cps.forEach((_s, k) => {
         const m = materials[k];
         const on = run.checkpoint >= k + 1;
         m.color.copy(on ? lit : idle);
         m.opacity = (on ? 0.32 : 0.16) + Math.sin(time.now * 3 + k) * 0.04;
         const mesh = meshes.current[k];
         if (mesh) mesh.scale.set(on ? 1.25 : 1, 1, on ? 1.25 : 1);
      });
   });
   return (
      <>
         {cps.map((s, k) => {
            const b = beaconSpot(s);
            return (
               <mesh key={k} ref={(m) => void (meshes.current[k] = m)} position={[b.x, b.y + 2 + 4, b.z]} material={materials[k]} renderOrder={2}>
                  <cylinderGeometry args={[0.1, 0.3, 8, 12, 1, true]} />
               </mesh>
            );
         })}
      </>
   );
}

/** The pads' glow over the pool and their bobbing up arrows (two additive quads per pad). */
function PadGlows({ course }: { course: CourseData }) {
   const time = useGameTime();
   const pads = useMemo(() => course.supports.filter((s) => s.pad), [course]);
   const glow = useMemo(() => glowTexture(), []);
   const arrow = useMemo(() => arrowTexture(), []);
   const glowMat = useMemo(() => new MeshBasicMaterial({ map: glow, color: COLORS.padGlow, transparent: true, blending: AdditiveBlending, depthWrite: false }), [glow]);
   const arrowMat = useMemo(() => new MeshBasicMaterial({ map: arrow, color: COLORS.padGlow, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }), [arrow]);
   useEffect(
      () => () => {
         glow.dispose();
         arrow.dispose();
         glowMat.dispose();
         arrowMat.dispose();
      },
      [glow, arrow, glowMat, arrowMat],
   );
   const arrows = useRef<Array<Mesh | null>>([]);
   useFrame(() => {
      const t = time.now;
      glowMat.opacity = 0.75 + Math.sin(t * 5) * 0.2;
      arrows.current.forEach((m, i) => {
         if (!m) return;
         const k = (t * 0.9 + i * 0.3) % 1;
         m.position.y = pads[i].top + 0.35 + k * 1.4;
         (m.material as MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.9;
      });
   });
   return (
      <>
         {pads.map((s, i) => (
            <group key={i}>
               <mesh position={[s.cx, s.top + 0.2, s.cz]} rotation-x={-Math.PI / 2} material={glowMat} renderOrder={3}>
                  <planeGeometry args={[PAD_SIZE * 1.5, PAD_SIZE * 1.5]} />
               </mesh>
               <mesh ref={(m) => void (arrows.current[i] = m)} position={[s.cx, s.top + 0.6, s.cz]} rotation-x={-0.25} material={arrowMat} renderOrder={4}>
                  <planeGeometry args={[1.1, 1.1]} />
               </mesh>
            </group>
         ))}
      </>
   );
}

/** The sky gate's portal: a soft swirl of light inside the arch. */
function Portal({ course, won }: { course: CourseData; won: MutableRefObject<boolean> }) {
   const time = useGameTime();
   const goal = course.supports[course.goal];
   const glow = useMemo(() => glowTexture(), []);
   const mat = useMemo(() => new MeshBasicMaterial({ map: glow, color: COLORS.portal, transparent: true, blending: AdditiveBlending, depthWrite: false }), [glow]);
   useEffect(
      () => () => {
         glow.dispose();
         mat.dispose();
      },
      [glow, mat],
   );
   const ref = useRef<Mesh>(null);
   useFrame(() => {
      mat.opacity = (won.current ? 1 : 0.7) + Math.sin(time.now * 2.4) * 0.15;
      if (ref.current) ref.current.rotation.z = time.now * 0.4;
   });
   const gateScale = 7 / GLB_SIZE.skyFortressGate.x;
   return (
      <mesh ref={ref} position={[goal.cx, goal.top + GLB_SIZE.skyFortressGate.y * gateScale * 0.42, goal.cz - goal.hd + 1.2]} material={mat} renderOrder={3}>
         <planeGeometry args={[3.4, 3.8]} />
      </mesh>
   );
}

export function Course({ run, clock, won }: { run: SkyRun; clock: VisualClock; won: MutableRefObject<boolean> }) {
   const course = run.course;
   const spots = useStaticSpots(course);
   const movers = useMemo(() => course.supports.filter((s) => s.mover), [course]);
   const time = useGameTime();

   const moverUpdate = (i: number, m: Matrix4) => {
      const s = movers[i];
      const w = s.hw * 2;
      const d = s.hd * 2;
      m.makeScale(w / GLB_SIZE.movingBlock.x, MOVER_SY, d / GLB_SIZE.movingBlock.z);
      m.setPosition(supportX(s, clock.ms), s.top - GLB_SIZE.movingBlock.top * MOVER_SY, supportZ(s, clock.ms));
   };

   const orbs = course.orbs;
   const orbScale = 1;
   const orbUpdate = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = orbs[i];
      const t = time.now;
      m.makeRotationY(t * 2.2 + i);
      m.scale(SCRATCH_SCALE.set(orbScale, orbScale, orbScale));
      m.setPosition(o.x, o.y + Math.sin(t * 2 + i * 0.7) * 0.12, o.z);
   };
   const glow = useMemo(() => glowTexture(), []);
   useEffect(() => () => glow.dispose(), [glow]);
   const halos = useMemo<Billboard[]>(() => orbs.map((o) => ({ x: o.x, y: o.y, z: o.z, size: ORB_SIZE * 2.4, r: 1, g: 0.86, b: 0.45 })), [orbs]);
   const hideCollected = (data: Float32Array) => {
      let changed = false;
      for (let i = 0; i < orbs.length; i++) {
         const size = run.collected[i] ? 0 : ORB_SIZE * (2.3 + Math.sin(time.now * 3 + i) * 0.25);
         if (data[i * 4 + 3] !== size) {
            data[i * 4 + 3] = size;
            changed = true;
         }
      }
      return changed;
   };

   return (
      <>
         <InstancedModel asset={ASSETS.islandA} spots={spots.islands} fallback={null} />
         <InstancedModel asset={ASSETS.skyPlatform} spots={spots.checkpoints} fallback={null} />
         <InstancedModel asset={ASSETS.plankBridge} spots={spots.bridges} fallback={null} />
         <InstancedModel asset={ASSETS.bouncePad} spots={spots.pads} fallback={null} />
         <InstancedModel asset={ASSETS.checkpointBeacon} spots={spots.beacons} fallback={null} />
         <InstancedModel asset={ASSETS.woodenLadder} spots={spots.ladders} fallback={null} />
         <InstancedModel asset={ASSETS.skyFortressGate} spots={spots.gate} fallback={null} />
         <DynamicInstancedModel asset={ASSETS.movingBlock} count={movers.length} update={moverUpdate} name="movers" />
         <DynamicInstancedModel asset={ASSETS.scoreOrb} count={orbs.length} update={orbUpdate} name="orbs" />
         <BillboardField spots={halos} map={glow} additive aspect={1} opacity={0.85} live={hideCollected} renderOrder={5} />
         <BeaconBeams course={course} run={run} />
         <PadGlows course={course} />
         <Portal course={course} won={won} />
      </>
   );
}

