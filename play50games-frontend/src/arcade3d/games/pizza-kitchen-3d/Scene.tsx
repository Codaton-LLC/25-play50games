"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useFrame } from "@react-three/fiber";

import { RoundedBox, Text } from "@react-three/drei";

import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import type { Group } from "three";

import { Model, InstancedModel } from "@/arcade3d/core/assets";

import { Instanced } from "@/arcade3d/core/render";

import { HumanoidModel, useHumanoidPose, walkPose, carryPose, reachPose } from "@/arcade3d/core/rig";

import { useInput } from "@/arcade3d/core/input";

import { useLevel } from "@/arcade3d/core/level";

import { useRunFrame } from "@/arcade3d/core/useRunFrame";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";

import { useFittedView } from "@/arcade3d/core/useFittedView";

import CameraRig from "@/arcade3d/core/CameraRig";

import { inputToWorld, randomSeed } from "@/arcade3d/core/math";

import { useFx } from "@/arcade3d/core/fx";

import { ASSETS } from "./assets";

import { LEVELS, type PizzaLevel } from "./levels";

import { COLORS as C, kitchenWidth } from "./looks";

import { createRun, step, stations, nearestStation, TOPPINGS, type Run, type Pizza as PizzaState } from "./rules";

import { useKitchenHud } from "./hudStore";



function Box({ size, color, position = [0, 0, 0] }: { size: [number, number, number]; color: string; position?: [number, number, number] }) {

   return <RoundedBox args={size} radius={Math.min(...size) * 0.12} smoothness={2} position={position}><meshStandardMaterial color={color} roughness={0.65} /></RoundedBox>;

}

function Disc({ radius, color, y = 0, height = 0.035 }: { radius: number; color: string; y?: number; height?: number }) {

   return <mesh position={[0, y, 0]}><cylinderGeometry args={[radius, radius, height, 24]} /><meshStandardMaterial color={color} roughness={0.75} /></mesh>;

}

function Pizza({ pizza, run }: { pizza: PizzaState; run: Run }) {

   const ingredients = run.tickets[pizza.ticket].ingredients.slice(0, pizza.added);

   const toppingSpots = useMemo(() => Array.from({ length: 5 }, (_, i) => ({ x: Math.cos(i * 2.4) * 0.24, y: 0.115, z: Math.sin(i * 2.4) * 0.24, scale: 0.7 })), []);

   return <group><Model asset={ASSETS.pizzaBase} fallback={<Disc radius={0.47} color={C.dough} height={0.11} />} />

      {ingredients.includes("sauce") && <Disc radius={0.40} color={C.sauce} y={0.065} />}

      {ingredients.includes("cheese") && <Disc radius={0.37} color={C.cheese} y={0.09} />}

      {ingredients.slice(2).map(ing => {
         const fallback = <Instanced spots={toppingSpots}><sphereGeometry args={[0.095, 8, 5]} /><meshStandardMaterial color={C[ing]} /></Instanced>;
         return ing === "mushroom" || ing === "olive" ? <group key={ing}>{fallback}</group> : <InstancedModel key={ing} asset={ASSETS[ing]} spots={toppingSpots} fallback={fallback} />;
      })}
   </group>;

}

function Chef({ run }: { run: Run }) {

   const ref = useRef<Group>(null);

   const last = useRef({ x: run.player.x, z: run.player.z, phase: 0, time: 0 });

   const pose = useHumanoidPose(p => {

      const moving = Math.hypot(run.player.x - last.current.x, run.player.z - last.current.z) > 0.001;

      last.current.phase += moving ? (run.time - last.current.time) * 12 : 0;

      last.current.time = run.time;

      if (run.time < run.reachUntil) reachPose(1, 0.55, p);

      else if (run.carried) carryPose(0.15, p);

      else walkPose(last.current.phase, moving ? 0.8 : 0, p);

      if (ref.current) {

         ref.current.position.set(run.player.x, 0, run.player.z);

         if (moving) ref.current.rotation.y = Math.atan2(run.player.x - last.current.x, run.player.z - last.current.z);

         else if (run.time < run.reachUntil) ref.current.rotation.y = Math.PI;

      }

      last.current.x = run.player.x; last.current.z = run.player.z;

   });

   return <group ref={ref}><HumanoidModel asset={ASSETS.chef} pose={pose} fallback={<group>

      <Box size={[0.55, 0.75, 0.36]} position={[0, 0.86, 0]} color={C.tile} />

      <Box size={[0.45, 0.15, 0.38]} position={[0, 0.55, 0]} color={C.accent} />

      <mesh position={[0, 1.43, 0]}><sphereGeometry args={[0.22, 12, 10]} /><meshStandardMaterial color={C.skin} /></mesh>

      <Box size={[0.51, 0.27, 0.42]} position={[0, 1.69, 0]} color={C.tile} />

      <Box size={[0.18, 0.4, 0.22]} position={[-0.16, 0.25, 0]} color={C.oven} />

      <Box size={[0.18, 0.4, 0.22]} position={[0.16, 0.25, 0]} color={C.oven} />

   </group>} />

      {run.carried && <group position={[0, 0.95, 0.65]}><Model asset={ASSETS.peel} fallback={<group><Box size={[0.8, 0.04, 0.75]} color={C.wood} /><Box size={[0.12, 0.05, 0.8]} position={[0, 0, -0.5]} color={C.darkWood} /></group>} />

         {run.carried.boxed ? <Model asset={ASSETS.box} fallback={<Box size={[0.95, 0.14, 0.95]} color={C.tile} />} /> : <Pizza pizza={run.carried} run={run} />}

      </group>}

   </group>;

}

export default function Scene() {

   const { config } = useLevel<PizzaLevel>();

   const level = config ?? LEVELS[1];

   const [run] = useState(() => createRun(randomSeed(), level));

   const [revision, setRevision] = useState(0);

   const elapsed = useRef(0);

   const input = useInput();

   const fx = useFx();

   const dir = useRef({ x: 0, z: 0 });

   const width = kitchenWidth(level);

   const list = useMemo(() => stations(level), [level]);

   const viewOptions = useMemo(() => ({ area: { min: { x: -width / 2, y: 0, z: -3 }, max: { x: width / 2, y: 2.5, z: 4 } }, pitch: Math.PI / 3, shift: true }), [width]);

   const view = useFittedView(viewOptions);

   const counterSpots = useMemo(() => list.map(s => ({ x: s.x, y: 0, z: -1.9 })), [list]);

   const ovens = useMemo(() => list.filter(s => s.id.startsWith("oven")).map(s => ({ x: s.x, y: 1.05, z: -1.9 })), [list]);

   const tiles = useMemo(() => Array.from({ length: Math.ceil(width) * 6 }, (_, i) => ({ x: i % Math.ceil(width) - (Math.ceil(width) - 1) / 2, y: -0.04, z: Math.floor(i / Math.ceil(width)) - 1.5, sx: 0.97, sy: 0.08, sz: 0.97 })), [width]);

   useEffect(() => { useKitchenHud.getState().publish(run); fx.warm("sparkle", "score"); return () => useKitchenHud.setState({ run: null }); }, [run, fx]);

   useRunFrame((_s, dt) => {

      inputToWorld(input.current.moveX, input.current.moveY, view.yaw, dir.current);

      const before = run.score;

      const oldMessage = run.message;

      step(run, dt, dir.current.x, dir.current.z, input.current.actionPressed);

      const store = useArcadeStore.getState();

      if (run.score !== before) { store.setScore(run.score); store.setStat("served", run.served); fx.burst("sparkle", run.player, 12); fx.score(run.player, `+${run.score - before}`); }

      if (run.message !== oldMessage && (run.message.startsWith("Wrong") || run.message.startsWith("Burnt"))) fx.shake(0.15);

      if (run.end) store.end(run.end);

      elapsed.current += dt;

   });

   // React visual/HUD reconciliation is limited to 12 Hz, outside the simulation callback.

   useFrame(() => { if (elapsed.current >= 1 / 12) { elapsed.current = 0; useKitchenHud.getState().publish(run); setRevision(v => v + 1); } });

   const active = nearestStation(run);

   const rounded = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.08), []);

   useEffect(() => () => rounded.dispose(), [rounded]);

   return <group userData={{ revision }}>

      <CameraRig camera={{ position: view.offset, fov: 42, lookAt: [0, 0, 0.5] }} shift={view.shift} />

      <mesh position={[0, -0.12, 1]}><boxGeometry args={[width, 0.15, 6]} /><meshStandardMaterial color={C.grout} /></mesh>

      <Instanced spots={tiles}><boxGeometry /><meshStandardMaterial color={C.tile} /></Instanced>

      <Box size={[width, 1.8, 0.18]} position={[0, 0.9, -2.8]} color={C.darkWood} />

      <InstancedModel asset={ASSETS.counter} spots={counterSpots} fallback={<>

         <Instanced spots={counterSpots.map(s => ({ ...s, y: 0.48, sx: 1.5, sy: 0.95, sz: 1.3 }))}><primitive object={rounded} attach="geometry" /><meshStandardMaterial color={C.darkWood} /></Instanced>

         <Instanced spots={counterSpots.map(s => ({ ...s, y: 1, sx: 1.57, sy: 0.12, sz: 1.45 }))}><primitive object={rounded} attach="geometry" /><meshStandardMaterial color={C.wood} /></Instanced>

      </>} />

      <InstancedModel asset={ASSETS.oven} spots={ovens} fallback={<>

         <Instanced spots={ovens.map(s => ({ ...s, y: 1.5, sx: 1.35, sy: 0.9, sz: 1.05 }))}><primitive object={rounded} attach="geometry" /><meshStandardMaterial color={C.oven} metalness={0.4} roughness={0.4} /></Instanced>

         <Instanced spots={ovens.map(s => ({ ...s, y: 1.48, z: -1.34, sx: 0.96, sy: 0.48, sz: 0.05 }))}><primitive object={rounded} attach="geometry" /><meshStandardMaterial color={C.glow} emissive={C.glow} emissiveIntensity={1.3} /></Instanced>

      </>} />

      {list.map(s => <group key={s.id} position={[s.x, 1.1, -1.9]}>

         {!s.id.startsWith("oven") && (s.id === "dough" ? <Model asset={ASSETS.pizzaBase} fallback={<Disc radius={0.4} color={C.dough} height={0.12} />} /> : s.id === "serve" ? <Box size={[1.1, 0.12, 0.8]} color={C.green} /> : s.id === "box" ? <Model asset={ASSETS.box} fallback={<Box size={[0.9, 0.14, 0.85]} color={C.tile} />} /> : ["pepperoni", "tomato", "onion"].includes(s.id) ? <group><Disc radius={0.34} color={C.steel} height={0.19} /><Model asset={ASSETS[s.id as "pepperoni" | "tomato" | "onion"]} position={[0, 0.1, 0]} fallback={<Disc radius={0.28} color={C[s.id as keyof typeof C]} y={0.1} />} /></group> : <Model asset={s.id === "sauce" ? ASSETS.sauceBowl : s.id === "cheese" ? ASSETS.cheeseBowl : ASSETS[s.id as "mushroom" | "olive"]} fallback={<group><Disc radius={0.34} color={C.steel} height={0.19} /><Disc radius={0.29} color={C[s.id as keyof typeof C]} y={0.1} /></group>} />)}

         <Text position={[0, s.id.startsWith("oven") ? 1.05 : 0.55, 0]} fontSize={0.17} color={C.tile} anchorY="middle">{s.label.toUpperCase()}</Text>

      </group>)}

      {active && <mesh position={[active.x, 0.015, -0.5]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.42, 0.49, 24]} /><meshBasicMaterial color={C.accent} /></mesh>}

      {run.prep && <group position={[list[0].x, 1.16, -1.25]}><Pizza pizza={run.prep} run={run} /></group>}

      <Model asset={ASSETS.bin} position={[-width / 2 + 0.5, 0, 3]} fallback={<group><Box size={[0.65, 0.7, 0.65]} color={C.oven} position={[0, 0.35, 0]} /><Box size={[0.72, 0.1, 0.72]} color={C.steel} position={[0, 0.75, 0]} /></group>} />

      <Chef run={run} />

   </group>;

}

