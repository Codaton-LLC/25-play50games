"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, CircleGeometry, Euler, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Group } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx, startLoop, type LoopHandle } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { hop as hopOffset, waddle, type BodyOffset } from "@/arcade3d/core/motion";
import { DynamicInstanced, Instanced, type InstancePart } from "@/arcade3d/core/render";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS } from "./assets";
import type { CatLevel } from "./levels";
import { COLORS, DAMPING, FOV, LOOK_AHEAD, aimBounds, baySpots, decorSpots, lookAtFor, rugSpot, viewFor, wallSpots } from "./looks";
import { CatFigure, disposeParts, toyParts, treatParts, vacuumParts } from "./Primitives";
import {
   CLUTTER_H,
   CLUTTER_HALF,
   FURN_SIZE,
   HALL_HALF,
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
   const figure = useRef<Group>(null);
   const gait = useRef({ phase: 0 });
   const loop = useRef<LoopHandle | null>(null);
   const loopAt = useRef(0);
   const bounds = useMemo(() => aimBounds(config), [config]);
   const decor = useMemo(() => decorSpots(id), [id]);
   const phase = useArcadeStore((s) => s.phase);
   const look = useMemo(() => lookAtFor(config), [config]);
   const walls = useMemo(() => wallSpots(config), [config]);
   const bays = useMemo(() => baySpots(config), [config]);
   const rug = useMemo(() => [rugSpot(config)], [config]);
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
   const padMaterial = useMemo(() => new MeshStandardMaterial({ color: COLORS.pad, emissive: COLORS.pad, emissiveIntensity: 0.35, transparent: true, opacity: 0.35, depthWrite: false }), []);
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
      const ev = step(run, { moveX, moveY, jumpPressed, yaw: view.yaw }, dt, store.timeLeftMs ?? 0);
      // score, lives (the shell ends "lose" at 0), the win and the HUD stats, written only on a change
      syncStore(run, ev, useArcadeStore);
      aim.x = run.cat.x + Math.sin(run.cat.yaw) * LOOK_AHEAD;
      aim.z = run.cat.z + Math.cos(run.cat.yaw) * LOOK_AHEAD;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, aim.x));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, aim.z));
      gait.current.phase += (Math.hypot(run.cat.vx, run.cat.vz) / 0.9) * Math.PI * 2 * dt;
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

   useFrame(() => {
      const group = body.current;
      const cat = run.cat;
      if (!group) return;
      const moving = Math.hypot(cat.vx, cat.vz) > 0.3;
      if (cat.hop > 0) hopOffset(Math.PI * (1 - cat.hop / HOP_S), HOP_H, BODY);
      else if (moving) waddle(gait.current.phase, Math.min(1, Math.hypot(cat.vx, cat.vz) / MAX_SPEED) * 0.35, BODY);
      else {
         BODY.y = 0; BODY.roll = 0; BODY.yaw = 0; BODY.squash = 1;
      }
      group.position.set(cat.x, BODY.y, cat.z);
      group.rotation.set(0, cat.yaw + BODY.yaw, BODY.roll);
      group.visible = !(cat.mercy > 0 && Math.floor(time.now * 12) % 2 === 0);
   }, FRAME_PRIORITY.visuals);

   const placeTreat = (index: number, matrix: Matrix4) => {
      const treat = run.treats[index];
      if (!treat || treat.got) return false;
      E.set(0, time.now * 2 + index, 0);
      Q.setFromEuler(E);
      V.set(treat.x, 0.05 + Math.sin(time.now * 4 + index) * 0.03, treat.z);
      matrix.compose(V, Q, S);
   };
   const placeToy = (index: number, matrix: Matrix4) => {
      const toy = run.toys[index];
      if (!toy || toy.got) return false;
      E.set(0, 0, 0);
      Q.setFromEuler(E);
      V.set(toy.x, 0, toy.z);
      matrix.compose(V, Q, S);
   };
   const placeGlow = (index: number, matrix: Matrix4) => {
      const vacuum = run.vacuums[index];
      if (!vacuum || vacuum.mode === "return") return false;
      E.set(Math.PI / 2, 0, 0);
      Q.setFromEuler(E);
      V.set(vacuum.agent.x, 0.19, vacuum.agent.z);
      const pulse = vacuum.mode === "chase" ? 1.08 + Math.sin(time.now * 14) * 0.06 : 1;
      FLOAT.set(pulse, pulse, pulse);
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
         />
         {/* the rest of the house floor reaches past the fog: no void at any edge */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, zEnd / 2]}>
            <circleGeometry args={[120, 48]} />
            <meshStandardMaterial color={COLORS.outerFloor} roughness={0.95} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, zEnd / 2]}>
            <planeGeometry args={[HALL_HALF * 2 + 0.4, zEnd + 0.4]} />
            <meshStandardMaterial color={COLORS.floor} roughness={0.9} />
         </mesh>
         <InstancedModel asset={ASSETS.catTree} spots={decor.catTrees} fallback={null} />
         <InstancedModel asset={ASSETS.chair} spots={decor.chairs} fallback={null} />
         <Instanced spots={bays} name="bays">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.bay} roughness={0.85} />
         </Instanced>
         <Instanced spots={rug} name="rug">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.rug} roughness={0.95} />
         </Instanced>
         <Instanced spots={walls} name="walls">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.85} />
         </Instanced>
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
         <DynamicInstancedModel asset={ASSETS.treat} count={run.treats.length} update={placeTreat} fallbackParts={treatPool} name="treats" />
         <DynamicInstancedModel asset={ASSETS.toy} count={run.toys.length} update={placeToy} fallbackParts={toyPool} name="toys" />
         <DynamicInstancedModel asset={ASSETS.vacuum} count={run.vacuums.length} update={placeVacuum} fallbackParts={vacuumPool} name="vacuums" />
         {/* the vacuum's glowing strip: bright while it patrols or chases, off while it drives back harmless */}
         <DynamicInstanced count={run.vacuums.length} update={placeGlow} name="vacuum-glow">
            <torusGeometry args={[VAC_R * 0.92, 0.025, 6, 28]} />
            <meshBasicMaterial color={COLORS.glow} toneMapped={false} />
         </DynamicInstanced>
         <group ref={body}>
            <group ref={figure}>
               <Model asset={ASSETS.cat} tint={config.tint} fallback={<CatFigure />} />
            </group>
         </group>
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
