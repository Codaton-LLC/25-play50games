"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, CircleGeometry, Euler, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Group } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import type { AABB } from "@/arcade3d/core/collision";
import { playSfx, startLoop, type LoopHandle } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { hop as hopOffset, type BodyOffset } from "@/arcade3d/core/motion";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud/TargetMarkers";
import { BlobShadow } from "@/arcade3d/core/render";
import { QuadrupedModel, useQuadrupedPose } from "@/arcade3d/core/rig/QuadrupedModel";
import { blendQuadrupedPoses, createQuadrupedPose, quadrupedGait, quadrupedIdle, quadrupedLeap, quadrupedPhaseStep, quadrupedSit } from "@/arcade3d/core/rig/quadrupedPoses";
import { DynamicInstanced, Instanced, type InstancePart } from "@/arcade3d/core/render";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, CAT_LANDMARKS } from "./assets";
import type { CatLevel } from "./levels";
import { COLORS, DAMPING, FOV, LOOK_AHEAD, ZOOM, aimBounds, decorSpots, lookAtFor, outerWallSpots, viewFor, wallSpots } from "./looks";
import { useCameraZoom } from "@/arcade3d/core/useCameraZoom";
import { House } from "./House";
import { CatFigure, disposeParts, toyParts, treatParts, vacuumParts } from "./Primitives";
import {
   CLUTTER_H,
   CLUTTER_HALF,
   FURN_SIZE,
   HOME_R,
   HOP_H,
   HOP_S,
   MAX_SPEED,
   createRun,
   step,
   syncStore,
   VAC_R,
   type Furniture,
   type FurnKind,
   type Run,
} from "./rules";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const BODY: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };
const FLOAT = new Vector3();
const CAT_SCALE = ASSETS.cat.scale ?? 1;
/** the bed's mattress top (m): the cat hops up there to sit on a win */
const BED_TOP = FURN_SIZE.bed.y * 0.72;
const WIN_LEAP_S = 0.5;
const smooth01 = (a: number, b: number, x: number) => {
   const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
   return t * t * (3 - 2 * t);
};
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** One kind of furniture: the GLB at each centre, or two bevelled boxes (body and top) per piece. */
function FurnMeshes({ kind, items, color, trim }: { kind: FurnKind; items: readonly Furniture[]; color: string; trim: string }) {
   const size = FURN_SIZE[kind];
   const spots = useMemo(() => items.map((f) => ({ x: f.x, y: 0, z: f.z, rotY: f.rotY })), [items]);
   const body = useMemo(() => items.map((f) => ({ x: f.x, y: size.y * 0.39, z: f.z, sx: size.x, sy: size.y * 0.78, sz: size.z })), [items, size]);
   const cap = useMemo(() => items.map((f) => ({ x: f.x, y: size.y * 0.84, z: f.z, sx: size.x * 0.9, sy: size.y * 0.24, sz: size.z * 0.9 })), [items, size]);
   const geometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.06), []);
   const bodyMat = useMemo(() => new MeshStandardMaterial({ color, roughness: 0.7 }), [color]);
   const capMat = useMemo(() => new MeshStandardMaterial({ color: trim, roughness: 0.6 }), [trim]);
   useEffect(() => () => {
      geometry.dispose();
      bodyMat.dispose();
      capMat.dispose();
   }, [geometry, bodyMat, capMat]);
   if (items.length === 0) return null;
   return (
      <InstancedModel
         asset={ASSETS[kind]}
         spots={spots}
         fallback={
            <>
               <Instanced spots={body} name={kind}>
                  <primitive object={geometry} attach="geometry" />
                  <primitive object={bodyMat} attach="material" />
               </Instanced>
               <Instanced spots={cap} name={`${kind}-top`}>
                  <primitive object={geometry} attach="geometry" />
                  <primitive object={capMat} attach="material" />
               </Instanced>
            </>
         }
      />
   );
}

function LevelScene() {
   const { id, config } = useLevel<CatLevel>();
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const [run] = useState<Run>(() => createRun(randomSeed(), config));
   const aim = useRef({ x: run.cat.x, y: 0.4, z: run.cat.z + LOOK_AHEAD }).current;
   const body = useRef<Group>(null);
   const floor = useRef<Group>(null);
   const anim = useRef({ phase: 0, yaw: run.cat.yaw, turn: 0, winAt: -1, fromX: 0, fromZ: 0, fromYaw: 0, goal: -1 });
   const idlePose = useMemo(createQuadrupedPose, []);
   const gaitPose = useMemo(createQuadrupedPose, []);
   const targets = useMemo<MarkerTarget[]>(() => [{ x: 0, y: 0.3, z: 0, hidden: true }], []);
   // a portrait phone fits the hall's width: start a little closer so the cat is a clear size
   const portrait = useThree((state) => state.size.width < state.size.height);
   const zoom = useCameraZoom({ min: ZOOM.min, max: ZOOM.max, initial: portrait ? ZOOM.portrait : 1 });
   const loop = useRef<LoopHandle | null>(null);
   const loopAt = useRef(0);
   const bounds = useMemo(() => aimBounds(config), [config]);
   const decor = useMemo(() => decorSpots(id), [id]);
   const phase = useArcadeStore((s) => s.phase);
   const look = useMemo(() => lookAtFor(config), [config]);
   const walls = useMemo(() => wallSpots(config).body, [config]);
   const outerWalls = useMemo(() => outerWallSpots(config).body, [config]);
   // camera views (core/camera): the rules get the drawn camera's yaw; furniture, clutter and the
   // house walls pull the chase / front / free camera in front of them (the top view looks over them)
   const cam = useCameraViews({
      slug: "cat-vs-robot-vacuum",
      subject: "character",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         const c = run.cat;
         o.x = c.x;
         o.y = 0.3;
         o.z = c.z;
         o.heading = c.yaw;
         o.vx = c.vx;
         o.vz = c.vz;
      },
      solids: (out: AABB[]) => {
         let n = 0;
         const put = (x: number, z: number, hx: number, hz: number, h: number) => {
            if (n >= out.length) return;
            const b = out[n++];
            b.min.x = x - hx;
            b.max.x = x + hx;
            b.min.y = 0;
            b.max.y = h;
            b.min.z = z - hz;
            b.max.z = z + hz;
         };
         const putBox = (box: AABB) => {
            put((box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2, (box.max.x - box.min.x) / 2, (box.max.z - box.min.z) / 2, box.max.y);
         };
         for (const f of run.furniture) putBox(f.box);
         for (const c of run.clutter) putBox(c);
         for (const w of walls) put(w.x, w.z, (w.sx ?? 1) / 2, (w.sz ?? 1) / 2, w.sy ?? 1);
         for (const w of outerWalls) put(w.x, w.z, (w.sx ?? 1) / 2, (w.sz ?? 1) / 2, w.sy ?? 1);
         return n;
      },
      framing: { top: { distance: 12 } },
   });
   const clutter = useMemo(() => run.clutter.map((box) => ({
      x: (box.min.x + box.max.x) / 2,
      y: CLUTTER_H / 2,
      z: (box.min.z + box.max.z) / 2,
      sx: CLUTTER_HALF * 2,
      sy: CLUTTER_H,
      sz: CLUTTER_HALF * 2,
   })), [run]);
   const clutterGlb = useMemo(() => run.clutter.map((box) => ({ x: (box.min.x + box.max.x) / 2, y: 0, z: (box.min.z + box.max.z) / 2 })), [run]);
   const furn = (kind: FurnKind) => run.furniture.filter((f) => f.kind === kind);
   const sofas = useMemo(() => furn("sofa"), [run]);
   const beds = useMemo(() => furn("bed"), [run]);
   const tables = useMemo(() => furn("table"), [run]);
   const shelves = useMemo(() => furn("bookshelf"), [run]);
   const zEnd = config.rooms * 6;

   const treatPool = useMemo<InstancePart[]>(() => treatParts(), []);
   const toyPool = useMemo<InstancePart[]>(() => toyParts(), []);
   const vacuumPool = useMemo<InstancePart[]>(() => vacuumParts(), []);
   useEffect(() => () => {
      disposeParts(treatPool);
      disposeParts(toyPool);
      disposeParts(vacuumPool);
   }, [treatPool, toyPool, vacuumPool]);
   const padGeometry = useMemo(() => new CircleGeometry(HOME_R * 0.9, 24), []);
   const padMaterial = useMemo(() => new MeshStandardMaterial({ color: COLORS.pad, emissive: COLORS.pad, emissiveIntensity: 0.35, transparent: true, opacity: 0.3, depthWrite: false }), []);
   useEffect(() => () => {
      padGeometry.dispose();
      padMaterial.dispose();
   }, [padGeometry, padMaterial]);
   const clutterMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.clutter, roughness: 0.8 }), []);
   const clutterGeo = useMemo(() => new BoxGeometry(1, 1, 1), []);
   useEffect(() => () => {
      clutterMat.dispose();
      clutterGeo.dispose();
   }, [clutterMat, clutterGeo]);

   useEffect(() => {
      fx.warm("sparkle", "puff", "score");
   }, [fx]);

   useEffect(() => {
      if (phase !== "playing") return;
      const handle = startLoop("vacuum", { volume: 0.05 });
      loop.current = handle;
      return () => {
         handle.stop();
         loop.current = null;
      };
   }, [phase]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, jumpPressed } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, jumpPressed, yaw: cam.yaw() }, dt, store.timeLeftMs ?? 0);
      // score, lives (the shell ends "lose" at 0), the win and the HUD stats, written only on a change
      syncStore(run, ev, useArcadeStore);
      aim.x = run.cat.x + Math.sin(run.cat.yaw) * LOOK_AHEAD;
      aim.z = run.cat.z + Math.cos(run.cat.yaw) * LOOK_AHEAD;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, aim.x));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, aim.z));
      const speed = Math.hypot(run.cat.vx, run.cat.vz);
      if (loop.current && run.time - loopAt.current > 0.25) {
         loopAt.current = run.time;
         loop.current.set({ pitch: 0.8 + Math.min(1, speed / 2) * 0.4 });
      }
      if (ev.hop) {
         playSfx("jump");
         FLOAT.set(run.cat.x, 0.1, run.cat.z);
         fx.burst("puff", FLOAT, 6);
      }
      if (ev.treat >= 0) {
         const t = run.treats[ev.treat];
         FLOAT.set(t.x, 0.4, t.z);
         fx.burst("sparkle", FLOAT, 10);
         fx.score(FLOAT, `+${ev.score}`);
         playSfx("pickup");
      }
      if (ev.toy >= 0) {
         const t = run.toys[ev.toy];
         FLOAT.set(t.x, 0.4, t.z);
         fx.burst("sparkle", FLOAT, 12);
         playSfx("chime");
      }
      if (ev.lifeLost) {
         FLOAT.set(run.cat.x, 0.5, run.cat.z);
         fx.burst("puff", FLOAT, 10);
         fx.shake(0.3);
         playSfx("hit");
      }
      if (ev.won) playSfx("win");
   });

   // the cat's pose: walk -> trot -> gallop by speed with planted paws (core quadruped rig), idle
   // when still, a leap for the hop, and on a win a hop onto the bed to sit there
   const pose = useQuadrupedPose((p) => {
      const cat = run.cat;
      const a = anim.current;
      const dt = time.delta;
      const speed = Math.hypot(cat.vx, cat.vz);
      const rate = dt > 0 ? wrapAngle(cat.yaw - a.yaw) / dt : 0;
      a.yaw = cat.yaw;
      a.turn += (Math.max(-1, Math.min(1, rate / 5)) - a.turn) * Math.min(1, dt * 8);
      if (run.over === "win") {
         if (a.winAt < 0) {
            a.winAt = time.now;
            a.fromX = cat.x;
            a.fromZ = cat.z;
            a.fromYaw = cat.yaw;
         }
         const t = (time.now - a.winAt) / WIN_LEAP_S;
         if (t < 1) quadrupedLeap(t, CAT_LANDMARKS, p);
         else quadrupedSit(Math.min(1, (t - 1) * 3), time.now, CAT_LANDMARKS, p);
         return;
      }
      if (cat.hop > 0) {
         quadrupedLeap(1 - cat.hop / HOP_S, CAT_LANDMARKS, p);
         return;
      }
      const s01 = Math.min(1, speed / MAX_SPEED);
      a.phase = quadrupedPhaseStep(a.phase, speed * dt, s01, CAT_LANDMARKS, CAT_SCALE, dt, 5.5);
      quadrupedGait(a.phase, s01, CAT_LANDMARKS, gaitPose, a.turn);
      quadrupedIdle(time.now, CAT_LANDMARKS, idlePose);
      blendQuadrupedPoses(idlePose, gaitPose, smooth01(0.05, 0.5, speed), p);
   });

   useFrame(({ camera: drawn }) => {
      const group = body.current;
      const cat = run.cat;
      const a = anim.current;
      if (!group) return;
      let x = cat.x;
      let z = cat.z;
      let y = 0;
      let yaw = cat.yaw;
      if (run.over === "win" && a.winAt >= 0) {
         // a hop from where it stood onto the middle of the bed, turning to face the camera
         const t = Math.min(1, (time.now - a.winAt) / WIN_LEAP_S);
         const e = t * t * (3 - 2 * t);
         x = a.fromX + (run.home.x - a.fromX) * e;
         z = a.fromZ + (run.home.z - a.fromZ) * e;
         y = BED_TOP * e + Math.sin(Math.PI * t) * 0.35;
         const face = Math.atan2(drawn.position.x - x, drawn.position.z - z);
         yaw = a.fromYaw + wrapAngle(face - a.fromYaw) * e;
      } else if (cat.hop > 0) {
         y = hopOffset(Math.PI * (1 - cat.hop / HOP_S), HOP_H, BODY).y;
      }
      group.position.set(x, y, z);
      group.rotation.set(0, yaw, 0);
      group.visible = !(cat.mercy > 0 && Math.floor(time.now * 12) % 2 === 0);
      const ring = floor.current;
      if (ring) {
         const onBed = run.over === "win" && a.winAt >= 0 && time.now - a.winAt > WIN_LEAP_S * 0.6;
         ring.position.set(x, onBed ? BED_TOP : 0, z);
         ring.scale.setScalar(onBed ? 1 : 1 - Math.min(0.4, y));
      }
      // the arrow: to the nearest treat left, then to the bed
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < run.treats.length; i++) {
         const t = run.treats[i];
         if (t.got) continue;
         const d = (t.x - cat.x) ** 2 + (t.z - cat.z) ** 2;
         if (d < bestD) {
            bestD = d;
            best = i;
         }
      }
      const mark = targets[0];
      mark.hidden = run.over !== null;
      if (best >= 0) {
         mark.x = run.treats[best].x;
         mark.z = run.treats[best].z;
         mark.color = COLORS.treatHalo;
      } else {
         mark.x = run.home.x;
         mark.z = run.home.z;
         mark.color = COLORS.padReady;
      }
      const goal = best >= 0 ? 0 : 1;
      if (goal !== a.goal) {
         a.goal = goal;
         if (run.over === null) useArcadeStore.getState().setStat("goal", goal);
      }
      // the bed's ring: calm while treats are left, bright and pulsing once it is the goal
      const ready = best < 0;
      padMaterial.opacity = ready ? 0.55 + 0.25 * Math.sin(time.now * 6) : 0.3;
      padMaterial.emissiveIntensity = ready ? 0.9 : 0.35;
      padMaterial.color.set(ready ? COLORS.padReady : COLORS.pad);
      padMaterial.emissive.set(ready ? COLORS.padReady : COLORS.pad);
   }, FRAME_PRIORITY.visuals);

   const placeTreat = (index: number, matrix: Matrix4) => {
      const treat = run.treats[index];
      if (!treat || treat.got) return false;
      E.set(0, time.now * 2 + index, 0);
      Q.setFromEuler(E);
      V.set(treat.x, 0.08 + Math.sin(time.now * 4 + index) * 0.04, treat.z);
      matrix.compose(V, Q, S);
   };
   const placeToy = (index: number, matrix: Matrix4) => {
      const toy = run.toys[index];
      if (!toy || toy.got) return false;
      E.set(0, Math.sin(time.now * 1.5 + index) * 0.6, 0);
      Q.setFromEuler(E);
      V.set(toy.x, Math.abs(Math.sin(time.now * 3 + index)) * 0.06, toy.z);
      matrix.compose(V, Q, S);
   };
   // a glowing disc under every pickup: gold for treats, pink for toys
   const halo = (x: number, z: number, index: number, size: number, matrix: Matrix4) => {
      E.set(-Math.PI / 2, 0, 0);
      Q.setFromEuler(E);
      V.set(x, 0.015, z);
      const k = size * (1 + 0.12 * Math.sin(time.now * 5 + index));
      FLOAT.set(k, k, k);
      matrix.compose(V, Q, FLOAT);
   };
   const placeTreatHalo = (index: number, matrix: Matrix4) => {
      const treat = run.treats[index];
      if (!treat || treat.got) return false;
      halo(treat.x, treat.z, index, 0.24, matrix);
   };
   const placeToyHalo = (index: number, matrix: Matrix4) => {
      const toy = run.toys[index];
      if (!toy || toy.got) return false;
      halo(toy.x, toy.z, index, 0.3, matrix);
   };
   const placeGlow = (index: number, matrix: Matrix4) => {
      const vacuum = run.vacuums[index];
      if (!vacuum || vacuum.mode === "return" || vacuum.docked) return false;
      E.set(Math.PI / 2, 0, 0);
      Q.setFromEuler(E);
      V.set(vacuum.agent.x, 0.19, vacuum.agent.z);
      const pulse = vacuum.mode === "chase" ? 1.08 + Math.sin(time.now * 14) * 0.06 : 1;
      FLOAT.set(pulse, pulse, pulse);
      matrix.compose(V, Q, FLOAT);
   };
   // a red danger zone on the floor round a vacuum that can hurt (none while it drives back harmless)
   const placeAura = (index: number, matrix: Matrix4) => {
      const vacuum = run.vacuums[index];
      if (!vacuum || vacuum.mode === "return" || vacuum.docked) return false;
      E.set(-Math.PI / 2, 0, 0);
      Q.setFromEuler(E);
      V.set(vacuum.agent.x, 0.012, vacuum.agent.z);
      const k = vacuum.mode === "chase" ? 1.15 + Math.sin(time.now * 12) * 0.08 : 1 + Math.sin(time.now * 3 + index) * 0.04;
      FLOAT.set(k, k, k);
      matrix.compose(V, Q, FLOAT);
   };
   const placeVacuum = (index: number, matrix: Matrix4) => {
      const vacuum = run.vacuums[index];
      if (!vacuum) return false;
      E.set(0, vacuum.agent.yaw, 0);
      Q.setFromEuler(E);
      V.set(vacuum.agent.x, 0, vacuum.agent.z);
      matrix.compose(V, Q, S);
   };

   return (
      <>
         <CameraRig
            camera={{ position: view.offset, fov: FOV, lookAt: look }}
            follow={aim}
            bounds={bounds}
            offset={view.offset}
            shift={view.shift}
            damping={DAMPING}
            zoom={zoom}
         />
         {/* room floors, rugs, the hall's walls and the rest of the house (House.tsx): no void at any edge */}
         <House id={id} />
         <InstancedModel asset={ASSETS.catTree} spots={decor.catTrees} fallback={null} />
         <InstancedModel asset={ASSETS.chair} spots={decor.chairs} fallback={null} />
         <mesh rotation-x={-Math.PI / 2} position={[run.home.x, 0.02, run.home.z]}>
            <primitive object={padGeometry} attach="geometry" />
            <primitive object={padMaterial} attach="material" />
         </mesh>
         <FurnMeshes kind="sofa" items={sofas} color={COLORS.sofa} trim={COLORS.sofaCushion} />
         <FurnMeshes kind="bed" items={beds} color={COLORS.bedFrame} trim={COLORS.bed} />
         <FurnMeshes kind="table" items={tables} color={COLORS.table} trim={COLORS.tableTop} />
         <FurnMeshes kind="bookshelf" items={shelves} color={COLORS.shelf} trim={COLORS.shelfBoard} />
         {run.clutter.length > 0 && (
            <InstancedModel
               asset={ASSETS.clutter}
               spots={clutterGlb}
               fallback={
                  <Instanced spots={clutter} name="clutter">
                     <primitive object={clutterGeo} attach="geometry" />
                     <primitive object={clutterMat} attach="material" />
                  </Instanced>
               }
            />
         )}
         {/* a cool rim light from the far end: every object gets a bright edge against the floor */}
         <directionalLight position={[0, 5, -8]} intensity={0.7} color={COLORS.rim} />
         <DynamicInstanced count={run.treats.length} update={placeTreatHalo} name="treat-halo">
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color={COLORS.treatHalo} transparent opacity={0.45} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={run.toys.length} update={placeToyHalo} name="toy-halo">
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color={COLORS.toyHalo} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={run.vacuums.length} update={placeAura} name="vacuum-aura">
            <ringGeometry args={[VAC_R * 1.05, VAC_R * 1.75, 32]} />
            <meshBasicMaterial color={COLORS.danger} transparent opacity={0.38} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstancedModel asset={ASSETS.treat} count={run.treats.length} update={placeTreat} fallbackParts={treatPool} name="treats" />
         <DynamicInstancedModel asset={ASSETS.toy} count={run.toys.length} update={placeToy} fallbackParts={toyPool} name="toys" />
         <DynamicInstancedModel asset={ASSETS.vacuum} count={run.vacuums.length} update={placeVacuum} fallbackParts={vacuumPool} name="vacuums" />
         {/* the vacuum's glowing strip: bright while it patrols or chases, off while it drives back harmless */}
         <DynamicInstanced count={run.vacuums.length} update={placeGlow} name="vacuum-glow">
            <torusGeometry args={[VAC_R * 0.92, 0.025, 6, 28]} />
            <meshBasicMaterial color={COLORS.glow} toneMapped={false} />
         </DynamicInstanced>
         {/* the player's ring and contact shadow on the floor under the cat */}
         <group ref={floor}>
            <BlobShadow radius={0.32} opacity={0.4} />
            <mesh rotation-x={-Math.PI / 2} position-y={0.016} renderOrder={2}>
               <ringGeometry args={[0.34, 0.4, 40]} />
               <meshBasicMaterial color={COLORS.catRing} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
            </mesh>
         </group>
         <group ref={body}>
            <QuadrupedModel asset={ASSETS.cat} pose={pose} tint={config.tint} fallback={<CatFigure />} />
         </group>
         <TargetMarkers targets={targets} color={COLORS.treatHalo} />
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
