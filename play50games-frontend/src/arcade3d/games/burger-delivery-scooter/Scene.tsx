"use client";
import { useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Model, InstancedModel } from "../../core/assets";
import type { ModelAsset } from "../../core/types";
import { Instanced, type InstanceSpot } from "../../core/render";
import CameraRig from "../../core/CameraRig";
import { useLevel } from "../../core/level";
import { useInput } from "../../core/input";
import { randomSeed } from "../../core/math";
import { useRunFrame } from "../../core/useRunFrame";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useFx } from "../../core/fx";
import { playSfx } from "../../core/audio";
import { HumanoidModel, useHumanoidPose, armsDownPose, turnBone, aimArm, BONE } from "../../core/rig";
import { ASSETS } from "./assets";
import { COLORS as C, CAMERA } from "./looks";
import { createRun, stepRun, target, PAD_SECONDS } from "./rules";
import type { BurgerLevel } from "./levels";
const ROUND = new RoundedBoxGeometry(1, 1, 1, 2, 0.08);
type Part = { offset: [number, number, number]; size: [number, number, number]; color: string };
const BODY: Part[] = [
   { offset: [0, 1.9, 0], size: [12, 3.8, 12], color: C.building },
   { offset: [0, 3.9, 0], size: [12.2, 0.3, 12.2], color: C.shop },
   { offset: [0, 1.8, -6.05], size: [8, 1.6, 0.12], color: C.glass },
];
const BARRIER: Part[] = [
   { offset: [0, 0.5, 0], size: [1.3, 0.55, 1.3], color: C.shop },
   { offset: [0, 0.8, 0], size: [1.35, 0.13, 1.35], color: C.cream },
];
const CAR: Part[] = [
   { offset: [0, 0.5, 0], size: [1.6, 0.7, 3.4], color: C.dark },
   { offset: [0, 1, -0.1], size: [1.4, 0.6, 1.6], color: C.glass },
];
const BOX: Part[] = [
   { offset: [0, 0.3, 0], size: [0.7, 0.6, 0.7], color: C.bag },
   { offset: [0, 0.6, 0], size: [0.74, 0.12, 0.74], color: C.cream },
];
function Parts({ parts }: { parts: Part[] }) {
   return <>{parts.map((p, i) => <mesh key={i} geometry={ROUND} position={p.offset} scale={p.size} castShadow receiveShadow><meshStandardMaterial color={p.color} roughness={0.55} /></mesh>)}</>;
}
function Batch({ asset, spots, parts }: { asset: ModelAsset; spots: InstanceSpot[]; parts: Part[] }) {
   return <InstancedModel asset={asset} spots={spots} fallback={<>{parts.map((p, i) =>
      <Instanced key={i} spots={spots.map((s) => ({ ...s, x: s.x + p.offset[0], y: s.y + p.offset[1], z: s.z + p.offset[2], sx: p.size[0], sy: p.size[1], sz: p.size[2] }))}>
         <primitive object={ROUND} attach="geometry" /><meshStandardMaterial color={p.color} roughness={0.55} />
      </Instanced>)}</>} />;
}
function Rider() {
   const pose = useHumanoidPose((p) => {
      armsDownPose(p);
      turnBone(p, BONE.upperLegL, -1.35, 0, 0); turnBone(p, BONE.upperLegR, -1.35, 0, 0);
      turnBone(p, BONE.lowerLegL, 1.45, 0, 0); turnBone(p, BONE.lowerLegR, 1.45, 0, 0);
      aimArm(p, 1, 0.15, -0.5, 0.85, 0, -0.3, 1);
      aimArm(p, -1, 0.15, -0.5, 0.85, 0, -0.3, 1);
   });
   return <group position={[0, -0.15, 0]}>
      <HumanoidModel asset={ASSETS.rider} pose={pose} applyLift={false} fallback={<Parts parts={[
         { offset: [0, 1.25, 0], size: [0.45, 0.62, 0.35], color: C.shop },
         { offset: [0, 1.75, 0.05], size: [0.36, 0.38, 0.36], color: C.dark },
         { offset: [0, 1.72, 0.23], size: [0.27, 0.15, 0.05], color: C.glass },
         { offset: [-0.23, 0.85, 0.22], size: [0.18, 0.22, 0.65], color: C.dark },
         { offset: [0.23, 0.85, 0.22], size: [0.18, 0.22, 0.65], color: C.dark },
         { offset: [0, 1.25, 0.42], size: [0.7, 0.14, 0.18], color: C.skin },
      ]} />} />
   </group>;
}
export default function Scene() {
   const { id } = useLevel<BurgerLevel>();
   const run = useMemo(() => createRun(randomSeed(), id), [id]);
   const input = useInput(), fx = useFx();
   const rider = useRef<Group>(null), pad = useRef<Mesh>(null), arrow = useRef<Group>(null);
   const focus = useMemo(() => ({ x: run.player.x, y: 0, z: run.player.z }), [run]);
   const layout = useMemo(() => {
      const spots = (items: { x: number; z: number }[]) => items.map((s) => ({ ...s, y: 0 }));
      const roads: InstanceSpot[] = [];
      for (let x = 0; x <= run.config.blocksX; x++) roads.push({ x: run.shop.x + x * 18, y: -0.12, z: 0, sx: 6, sy: 0.2, sz: -run.shop.z * 2 + 6 });
      for (let z = 0; z <= run.config.blocksZ; z++) roads.push({ x: 0, y: -0.11, z: run.shop.z + z * 18, sx: -run.shop.x * 2 + 6, sy: 0.2, sz: 6 });
      return { buildings: spots(run.buildings.slice(1)), barriers: spots(run.barriers), cars: spots(run.cars), roads,
         wet: run.wet.map((w) => ({ ...w, y: 0.015, sx: w.hx * 2, sy: 0.025, sz: w.hz * 2 })),
         lamps: spots(run.doors.slice(0, 4).map((d) => ({ x: d.x + 2.5, z: d.z + 2.5 }))),
         benches: [{ x: run.shop.x + 4, y: 0, z: run.shop.z - 2.2 }],
         cones: [{ x: run.shop.x - 2, y: 0, z: run.shop.z + 2 }, { x: run.shop.x - 2, y: 0, z: run.shop.z + 4 }],
         bags: [{ x: run.shop.x + 1.6, y: 1.1, z: run.shop.z - 2.3 }, { x: run.shop.x + 2.2, y: 1.1, z: run.shop.z - 2.3 }] };
   }, [run]);
   useRunFrame((_, dt) => {
      const score = run.score, misses = run.misses, quality = run.quality, carrying = run.carrying;
      stepRun(run, input.current, dt);
      const store = useArcadeStore.getState();
      if (run.score !== score) { store.setScore(run.score); fx.score(run.player, "+" + (run.score - score)); fx.burst("sparkle", run.player, 14); playSfx("pickup"); }
      for (let i = misses; i < run.misses; i++) store.loseLife();
      if (run.quality < quality - 1) { fx.shake(0.12); playSfx("hit"); }
      if (!carrying && run.carrying) playSfx("chime");
      store.setStat("orders", run.delivered); store.setStat("quality", Math.floor(run.quality));
      store.setStat("carrying", run.carrying ? 1 : 0); store.setStat("required", run.config.qualityMin);
      store.setStat("average", run.delivered ? run.qualitySum / run.delivered : 100); store.setStat("stop", run.dwell / PAD_SECONDS);
      if (run.end) store.end(run.end);
      const p = run.player, goal = target(run);
      if (rider.current) { rider.current.position.set(p.x, p.y, p.z); rider.current.rotation.y = p.yaw; }
      if (pad.current) { pad.current.position.set(goal.x, 0.04, goal.z); pad.current.visible = !run.end; }
      if (arrow.current) { arrow.current.position.set(p.x, 2.7 + p.y, p.z); arrow.current.rotation.y = Math.atan2(goal.x - p.x, goal.z - p.z); }
      focus.x = p.x + Math.sin(p.yaw) * 2.5; focus.z = p.z + Math.cos(p.yaw) * 2.5;
   });
   return <>
      <CameraRig camera={CAMERA} follow={focus} shift={[0, 0.12]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]} receiveShadow><planeGeometry args={[180, 180]} /><meshStandardMaterial color={C.trim} /></mesh>
      <Instanced spots={layout.roads}><boxGeometry /><meshStandardMaterial color={C.road} /></Instanced>
      <Instanced spots={layout.wet}><primitive object={ROUND} attach="geometry" /><meshStandardMaterial color={C.wet} roughness={0.18} metalness={0.25} /></Instanced>
      <Batch asset={ASSETS.shop} spots={layout.buildings} parts={BODY} />
      <group position={[run.buildings[0].x, 0, run.buildings[0].z]}><Model asset={ASSETS.shop} fallback={<Parts parts={BODY} />} /></group>
      <Batch asset={ASSETS.bench} spots={layout.benches} parts={[
         { offset: [0, 0.4, 0], size: [1.4, 0.2, 0.5], color: C.bag },
         { offset: [0, 0.7, -0.2], size: [1.4, 0.6, 0.12], color: C.dark },
      ]} />
      <Batch asset={ASSETS.cone} spots={layout.cones} parts={[
         { offset: [0, 0.1, 0], size: [0.45, 0.18, 0.45], color: C.dark },
         { offset: [0, 0.35, 0], size: [0.23, 0.5, 0.23], color: C.shop },
      ]} />
      <Batch asset={ASSETS.barrier} spots={layout.barriers} parts={BARRIER} />
      <Batch asset={ASSETS.car} spots={layout.cars} parts={CAR} />
      <Batch asset={ASSETS.lamp} spots={layout.lamps} parts={[
         { offset: [0, 1.8, 0], size: [0.13, 3.6, 0.13], color: C.dark },
         { offset: [0, 3.6, 0], size: [0.55, 0.2, 0.55], color: C.bag },
      ]} />
      <group position={[run.shop.x + 2, 0, run.shop.z - 2.3]}><Model asset={ASSETS.counter} fallback={<Parts parts={[
         { offset: [0, 0.5, 0], size: [2.4, 1, 0.75], color: C.shop },
         { offset: [0, 1.03, 0], size: [2.5, 0.12, 0.85], color: C.cream },
      ]} />} /></group>
      <Batch asset={ASSETS.bag} spots={layout.bags} parts={[{ offset: [0, 0.15, 0], size: [0.24, 0.3, 0.22], color: C.bag }]} />
      <Batch asset={ASSETS.food} spots={[{ x: run.shop.x + 2.7, y: 1.1, z: run.shop.z - 2.3 }]} parts={[{ offset: [0, 0.08, 0], size: [0.35, 0.16, 0.25], color: C.cream }]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[run.shop.x, 0.025, run.shop.z]}><ringGeometry args={[1.25, 1.45, 40]} /><meshBasicMaterial color={C.shop} /></mesh>
      <mesh ref={pad} rotation={[-Math.PI / 2, 0, 0]} position={[run.shop.x, 0.04, run.shop.z]}><ringGeometry args={[0.94, 1.1, 40]} /><meshBasicMaterial color={C.target} /></mesh>
      <group ref={rider} position={[run.player.x, 0, run.player.z]} rotation={[0, run.player.yaw, 0]}>
         <Model asset={ASSETS.scooter} fallback={<Parts parts={[
            { offset: [0, 0.38, 0], size: [0.55, 0.35, 1.65], color: C.shop },
            { offset: [0, 0.72, -0.2], size: [0.5, 0.18, 0.7], color: C.dark },
            { offset: [0, 0.22, 0.6], size: [0.3, 0.44, 0.44], color: C.dark },
            { offset: [0, 0.22, -0.6], size: [0.3, 0.44, 0.44], color: C.dark },
            { offset: [0, 0.82, 0.6], size: [0.15, 0.8, 0.15], color: C.cream },
         ]} />} />
         <Rider /><group position={[0, 0.8, -0.75]}><Model asset={ASSETS.box} fallback={<Parts parts={BOX} />} /></group>
      </group>
      <group ref={arrow} position={[run.player.x, 2.7, run.player.z]}><mesh rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.22, 0.6, 3]} /><meshBasicMaterial color={C.target} /></mesh></group>
   </>;
}
