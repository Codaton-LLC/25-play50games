"use client";

// One useRunFrame steps rules.ts (fixed 1/120 s substeps); visuals read the run and animate on useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Group, type Mesh } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DynamicInstancedModel, InstancedModel, Model } from "../../core/assets";
import { playSfx, startLoop, useMuted, type LoopHandle } from "../../core/audio";
import CameraRig from "../../core/CameraRig";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { useFx } from "../../core/fx";
import { useGameTime } from "../../core/gameTime";
import { TargetMarkers, type MarkerTarget } from "../../core/hud";
import { useInput } from "../../core/input";
import { useLevel } from "../../core/level";
import { randomSeed } from "../../core/math";
import { Instanced, type InstancePart, type InstanceSpot } from "../../core/render";
import { BONE, HumanoidModel, aimArm, armsDownPose, turnBone, useHumanoidPose } from "../../core/rig";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useFittedView } from "../../core/useFittedView";
import { useRunFrame } from "../../core/useRunFrame";
import { ASSETS, FIT, GLB_SIZE } from "./assets";
import type { BurgerLevel } from "./levels";
import { CAMERA, CAR_TINTS, COLORS as C, DAMPING, FOV, LOOK_AHEAD, aimBounds, blockSpots, dressing, laneDashes, shopSpot, viewFor, type BlockSpot } from "./looks";
import { PAD_RADIUS, PAD_SECONDS, createRun, stepRun, target, type Run } from "./rules";

// one bevelled unit box for every code-built body (indexed, never merged with anything)
const ROUND = new RoundedBoxGeometry(1, 1, 1, 2, 0.06);
type Part = { offset: [number, number, number]; size: [number, number, number]; color: string };

function Parts({ parts }: { parts: Part[] }) {
   return <>{parts.map((p, i) => <mesh key={i} geometry={ROUND} position={p.offset} scale={p.size}><meshStandardMaterial color={p.color} roughness={0.55} /></mesh>)}</>;
}
/** A stand-in drawn at unit size for instanced dressing: every part's offset and size scale with the spot. */
function UnitBatch({ asset, spots, parts }: { asset: typeof ASSETS[keyof typeof ASSETS]; spots: InstanceSpot[]; parts: Part[] }) {
   const placed = useMemo(() => parts.map((p) => spots.map((s) => {
      const k = s.scale ?? 1;
      return { x: s.x + p.offset[0] * k, y: s.y + p.offset[1] * k, z: s.z + p.offset[2] * k, rotY: s.rotY, sx: p.size[0] * k, sy: p.size[1] * k, sz: p.size[2] * k };
   })), [parts, spots]);
   if (spots.length === 0) return null;
   return <InstancedModel asset={asset} spots={spots} fallback={<>{parts.map((p, i) =>
      <Instanced key={i} spots={placed[i]}><primitive object={ROUND} attach="geometry" /><meshStandardMaterial color={p.color} roughness={0.55} /></Instanced>)}</>} />;
}

const LAMP: Part[] = [{ offset: [0, 0.5, 0], size: [0.04, 1, 0.04], color: C.dark }, { offset: [0, 1, 0], size: [0.16, 0.06, 0.16], color: C.bag }];
const BENCH: Part[] = [{ offset: [0, 0.25, 0], size: [1, 0.12, 0.34], color: C.bag }, { offset: [0, 0.45, -0.15], size: [1, 0.3, 0.06], color: C.dark }];
const CONE: Part[] = [{ offset: [0, 0.05, 0], size: [0.7, 0.1, 0.7], color: C.dark }, { offset: [0, 0.5, 0], size: [0.32, 0.9, 0.32], color: "#f97316" }];
const BAG: Part[] = [{ offset: [0, 0.5, 0], size: [0.6, 1, 0.5], color: C.bag }];
const FOOD: Part[] = [{ offset: [0, 0.35, 0], size: [1, 0.7, 0.9], color: C.cream }];
const BARRIER_PARTS: Part[] = [{ offset: [0, 0.3, 0], size: [1.3, 0.4, 0.6], color: C.shop }, { offset: [0, 0.56, 0], size: [1.32, 0.1, 0.62], color: C.cream }];

const WALLS = [C.wallA, C.wallB, C.wallC, C.wallD] as const;

/** Low town blocks: a two-tone body per tone, a slate roof cap and a dark window band, all instanced. */
function Blocks({ spots }: { spots: BlockSpot[] }) {
   const byTone = useMemo(() => WALLS.map((_, t) => spots.filter((s) => s.tone === t)), [spots]);
   const roofs = useMemo(() => spots.map((s) => ({ ...s, y: (s.sy ?? 1) - 0.05, sy: 0.18, sx: (s.sx ?? 1) + 0.25, sz: (s.sz ?? 1) + 0.25 })), [spots]);
   const bands = useMemo(() => spots.map((s) => ({ ...s, y: (s.sy ?? 1) * 0.42, sy: 0.7, sx: (s.sx ?? 1) + 0.04, sz: (s.sz ?? 1) + 0.04 })), [spots]);
   const bodies = useMemo(() => byTone.map((list) => list.map((s) => ({ ...s, y: (s.sy ?? 1) / 2 }))), [byTone]);
   return <>
      {bodies.map((list, t) => list.length > 0 && <Instanced key={t} spots={list}><primitive object={ROUND} attach="geometry" /><meshStandardMaterial color={WALLS[t]} roughness={0.8} /></Instanced>)}
      <Instanced spots={bands}><boxGeometry /><meshStandardMaterial color={C.window} roughness={0.25} metalness={0.3} /></Instanced>
      <Instanced spots={roofs}><primitive object={ROUND} attach="geometry" /><meshStandardMaterial color={C.roof} roughness={0.7} /></Instanced>
   </>;
}

/** Seated on the scooter: hips and knees bent (turnBone), hands forward on the bars (aimArm). */
function Rider() {
   const pose = useHumanoidPose((p) => {
      armsDownPose(p);
      turnBone(p, BONE.upperLegL, -1.35, 0, 0); turnBone(p, BONE.upperLegR, -1.35, 0, 0);
      turnBone(p, BONE.lowerLegL, 1.45, 0, 0); turnBone(p, BONE.lowerLegR, 1.45, 0, 0);
      aimArm(p, 1, 0.15, -0.5, 0.85, 0, -0.3, 1);
      aimArm(p, -1, 0.15, -0.5, 0.85, 0, -0.3, 1);
   });
   return <group position={[0, -0.15, -0.1]}>
      <HumanoidModel asset={ASSETS.rider} pose={pose} applyLift={false} fallback={<Parts parts={[
         { offset: [0, 1.25, 0], size: [0.45, 0.62, 0.35], color: C.shop },
         { offset: [0, 1.75, 0.05], size: [0.36, 0.38, 0.36], color: C.dark },
         { offset: [-0.23, 0.85, 0.22], size: [0.18, 0.22, 0.65], color: C.dark },
         { offset: [0.23, 0.85, 0.22], size: [0.18, 0.22, 0.65], color: C.dark },
      ]} />} />
   </group>;
}

const V = new Vector3(), Q = new Quaternion(), S = new Vector3(), UP = new Vector3(0, 1, 0);
const TINTS = CAR_TINTS.map((c) => new Color(c));
const AT = { x: 0, y: 0, z: 0 };

function LevelScene() {
   const { id, config } = useLevel<BurgerLevel>();
   const [run] = useState<Run>(() => createRun(randomSeed(), id, config));
   const view = useFittedView(viewFor());
   const input = useInput(), fx = useFx(), time = useGameTime(), muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const body = useRef<Group>(null), pad = useRef<Mesh>(null), shopRing = useRef<Mesh>(null);
   const engine = useRef<LoopHandle | null>(null);
   const aim = useRef({ x: run.player.x, y: 0.6, z: run.player.z }).current;
   const bounds = useMemo(() => aimBounds(config), [config]);
   const markers = useRef<MarkerTarget[]>([{ x: run.shop.x, y: 1, z: run.shop.z, color: C.target }]).current;
   const synced = useRef({ score: -1, orders: -1, quality: -1, carrying: -1, average: -1, stop: -1 }).current;
   const layout = useMemo(() => {
      const shopAt = shopSpot(run, FIT.shopWidth, GLB_SIZE.burgerShopI.depth * (FIT.shopWidth / GLB_SIZE.burgerShopI.width));
      const counter = { x: run.buildings[0].x - 6 + 0.78, z: shopAt.z };
      const roads: InstanceSpot[] = [];
      const hx = config.blocksX * 9, hz = config.blocksZ * 9;
      for (let x = -hx; x <= hx + 0.1; x += 18) roads.push({ x, y: 0.005, z: 0, sx: 6, sy: 0.01, sz: hz * 2 + 6 });
      for (let z = -hz; z <= hz + 0.1; z += 18) roads.push({ x: 0, y: 0.006, z, sx: hx * 2 + 6, sy: 0.01, sz: 6 });
      return {
         shopAt, counter, roads, dashes: laneDashes(config), blocks: blockSpots(run), ...dressing(run),
         barriers: run.barriers.map((b): InstanceSpot => ({ x: b.x, y: 0, z: b.z })),
         wet: run.wet.map((w): InstanceSpot => ({ x: w.x, y: 0.014, z: w.z, sx: w.hx * 2, sy: 0.01, sz: w.hz * 2 })),
         doorRings: run.doors.map((d): InstanceSpot => ({ x: d.x, y: 0.02, z: d.z })),
         bags: [{ x: counter.x, y: FIT.counterHeight, z: counter.z - 0.5, scale: 0.28 }, { x: counter.x, y: FIT.counterHeight, z: counter.z + 0.1, scale: 0.26 }],
         food: [{ x: counter.x, y: FIT.counterHeight, z: counter.z + 0.6, rotY: 0.4, scale: 0.3 }],
      };
   }, [run, config]);
   const carParts = useMemo<InstancePart[]>(() => [
      { geometry: ROUND.clone().scale(1.6, 0.75, 3.4).translate(0, 0.45, 0), material: new MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.5 }) },
      { geometry: ROUND.clone().scale(1.4, 0.55, 1.7).translate(0, 1.05, -0.15), material: new MeshStandardMaterial({ color: C.glass, roughness: 0.2, metalness: 0.2 }) },
   ], []);
   useEffect(() => () => carParts.forEach((p) => { p.geometry.dispose(); (p.material as { dispose(): void }).dispose(); }), [carParts]);

   useEffect(() => { fx.warm("sparkle", "puff", "splash", "score", "confetti"); }, [fx]);
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      engine.current = startLoop("engine", { volume: 0.25 });
      return () => { engine.current?.stop(); engine.current = null; };
   }, [phase, muted]);

   useRunFrame((_, dt) => {
      const score = run.score, misses = run.misses, quality = run.quality, carrying = run.carrying, delivered = run.delivered;
      stepRun(run, input.current, dt);
      const store = useArcadeStore.getState();
      const p = run.player;
      engine.current?.set({ pitch: 0.8 + Math.abs(p.speed) / 11, volume: 0.15 + Math.abs(p.speed) / 40 });
      if (run.score !== score) {
         AT.x = p.x; AT.y = 1.8; AT.z = p.z;
         fx.score(AT, "+" + (run.score - score), { color: C.bag }); fx.burst("sparkle", AT, 16);
         playSfx(run.delivered > delivered && run.end === "win" ? "win" : "chime");
      }
      for (let i = misses; i < run.misses; i++) { store.loseLife(); playSfx("lose"); fx.shake(0.3); }
      if (run.quality < quality - 1) { AT.x = p.x; AT.y = 0.8; AT.z = p.z; fx.shake(0.15); fx.burst("puff", AT, 10); playSfx("hit"); }
      if (!carrying && run.carrying) playSfx("pickup");
      if (run.end === "win") { AT.x = p.x; AT.y = 2; AT.z = p.z; fx.burst("confetti", AT, 36); }
      // the HUD only when a value changes
      const q = Math.floor(run.quality), avg = run.delivered ? Math.round(run.qualitySum / run.delivered) : 100, stop = Math.round((run.dwell / PAD_SECONDS) * 20) / 20;
      if (synced.score !== run.score) store.setScore((synced.score = run.score));
      if (synced.orders !== run.delivered) store.setStat("orders", (synced.orders = run.delivered));
      if (synced.quality !== q) store.setStat("quality", (synced.quality = q));
      if (synced.carrying !== +run.carrying) store.setStat("carrying", (synced.carrying = +run.carrying));
      if (synced.average !== avg) store.setStat("average", (synced.average = avg));
      if (synced.stop !== stop) store.setStat("stop", (synced.stop = stop));
      if (run.end) store.end(run.end);
      const sp = Math.max(0, p.speed) / 11;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, p.x + Math.sin(p.yaw) * LOOK_AHEAD * sp));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, p.z + Math.cos(p.yaw) * LOOK_AHEAD * sp));
   });

   useFrame(() => {
      const p = run.player, goal = target(run);
      if (body.current) { body.current.position.set(p.x, p.y, p.z); body.current.rotation.set(0, p.yaw, -Math.max(-0.25, Math.min(0.25, p.speed * 0.02 * (input.current.moveX || 0)))); }
      const pulse = 1 + Math.sin(time.now * 5) * 0.06;
      if (pad.current) { pad.current.position.set(goal.x, 0.03, goal.z); pad.current.visible = !run.end && run.carrying; pad.current.scale.setScalar(pulse); }
      if (shopRing.current) shopRing.current.scale.setScalar(run.carrying ? 1 : pulse);
      markers[0].x = goal.x; markers[0].z = goal.z; markers[0].hidden = !!run.end;
   }, FRAME_PRIORITY.visuals);

   const placeCar = (i: number, m: Matrix4, color: Color) => {
      const c = run.cars[i];
      if (!c) return false;
      V.set(c.x, 0, c.z); Q.setFromAxisAngle(UP, i % 2 ? Math.PI : 0); S.set(1, 1, 1);
      m.compose(V, Q, S);
      color.copy(TINTS[i % TINTS.length]);
   };
   const shopScale = FIT.shopWidth / GLB_SIZE.burgerShopI.width;

   return <>
      <CameraRig camera={{ position: view.offset, fov: FOV, lookAt: [aim.x, aim.y, aim.z] }} follow={aim} bounds={bounds} offset={view.offset} shift={view.shift} damping={DAMPING} />
      <TargetMarkers targets={markers} color={C.target} />
      {/* sidewalk ground to the fog, asphalt streets, lane dashes */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}><circleGeometry args={[170, 48]} /><meshStandardMaterial color={C.sidewalk} roughness={0.95} /></mesh>
      <Instanced spots={layout.roads}><boxGeometry /><meshStandardMaterial color={C.road} roughness={0.9} /></Instanced>
      <Instanced spots={layout.dashes}><boxGeometry /><meshBasicMaterial color={C.roadLine} /></Instanced>
      {layout.wet.length > 0 && <Instanced spots={layout.wet}><boxGeometry /><meshStandardMaterial color={C.wet} roughness={0.08} metalness={0.4} transparent opacity={0.85} /></Instanced>}
      <Blocks spots={layout.blocks} />
      <group position={[layout.shopAt.x, 0, layout.shopAt.z]}><Model asset={ASSETS.shop} fallback={<Parts parts={[
         { offset: [0, 1.8, 0], size: [FIT.shopWidth, 3.6, GLB_SIZE.burgerShopI.depth * shopScale], color: C.cream },
         { offset: [0, 3.7, 0], size: [FIT.shopWidth + 0.3, 0.3, GLB_SIZE.burgerShopI.depth * shopScale + 0.3], color: C.shop },
      ]} />} /></group>
      <group position={[layout.counter.x, 0, layout.counter.z]} rotation-y={-Math.PI / 2}><Model asset={ASSETS.counter} fallback={<Parts parts={[
         { offset: [0, 0.5, 0], size: [2.2, 1, 0.7], color: C.shop }, { offset: [0, 1.04, 0], size: [2.3, 0.1, 0.8], color: C.cream },
      ]} />} /></group>
      <UnitBatch asset={ASSETS.bag} spots={layout.bags} parts={BAG} />
      <UnitBatch asset={ASSETS.food} spots={layout.food} parts={FOOD} />
      <UnitBatch asset={ASSETS.lamp} spots={layout.lamps} parts={LAMP} />
      <UnitBatch asset={ASSETS.bench} spots={layout.benches} parts={BENCH} />
      <UnitBatch asset={ASSETS.cone} spots={layout.cones} parts={CONE} />
      {layout.barriers.length > 0 && <InstancedModel asset={ASSETS.barrier} spots={layout.barriers} fallback={<UnitBatch asset={ASSETS.barrier} spots={layout.barriers} parts={BARRIER_PARTS} />} />}
      {run.cars.length > 0 && <DynamicInstancedModel asset={ASSETS.car} count={run.cars.length} update={placeCar} fallbackParts={carParts} tinted name="cars" />}
      {/* pads: the shop ring (pink) and the active door (green, pulsing) */}
      <mesh ref={shopRing} rotation-x={-Math.PI / 2} position={[run.shop.x, 0.025, run.shop.z]}><ringGeometry args={[PAD_RADIUS - 0.18, PAD_RADIUS + 0.05, 40]} /><meshBasicMaterial color={C.shop} /></mesh>
      <Instanced spots={layout.doorRings}><cylinderGeometry args={[PAD_RADIUS * 0.35, PAD_RADIUS * 0.35, 0.02, 20]} /><meshBasicMaterial color={C.target} transparent opacity={0.35} /></Instanced>
      <mesh ref={pad} rotation-x={-Math.PI / 2} position={[run.shop.x, 0.03, run.shop.z]}><ringGeometry args={[PAD_RADIUS - 0.16, PAD_RADIUS, 40]} /><meshBasicMaterial color={C.target} /></mesh>
      <group ref={body} position={[run.player.x, 0, run.player.z]}>
         <Model asset={ASSETS.scooter} fallback={<Parts parts={[
            { offset: [0, 0.38, 0], size: [0.55, 0.35, 1.65], color: C.shop }, { offset: [0, 0.72, -0.2], size: [0.5, 0.18, 0.7], color: C.dark },
            { offset: [0, 0.22, 0.6], size: [0.3, 0.44, 0.44], color: C.dark }, { offset: [0, 0.22, -0.6], size: [0.3, 0.44, 0.44], color: C.dark },
            { offset: [0, 0.82, 0.6], size: [0.15, 0.8, 0.15], color: C.cream },
         ]} />} />
         <Rider />
         <group position={[0, 0.82, -0.72]}><Model asset={ASSETS.box} fallback={<Parts parts={[{ offset: [0, 0.25, 0], size: [0.5, 0.5, 0.5], color: C.bag }]} />} /></group>
      </group>
   </>;
}

export default function Scene() {
   return <LevelScene />;
}
