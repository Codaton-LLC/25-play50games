"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, BufferAttribute, CapsuleGeometry, Color, DoubleSide, Euler, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Group, type Matrix4 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers } from "@/arcade3d/core/hud/TargetMarkers";
import { useInput } from "@/arcade3d/core/input";
import { Parcel } from "@/arcade3d/core/kit";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { BlobShadow, Instanced, useCanvasTexture, type InstanceSpot, type InstancePart } from "@/arcade3d/core/render";
import { HumanoidModel, POSE_MASK, blendPoses, carryPose, cheerPose, createPose, idlePose, reachPose, useHumanoidPose, walkPose } from "@/arcade3d/core/rig";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import type { PostLevel } from "./levels";
import { CAMERA, COLORS, HOUSE_COLORS, LOOK_AHEAD, VIEW } from "./looks";
import { OFFICE, STREET_GAP, carrying, createRun, nextItem, step, targetFor, type Run } from "./rules";

function Boxes({ spots, color }: { spots: InstanceSpot[]; color: string }) {
   // Always unit-sized. Only the instance spot applies the final dimensions.
   const geometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.045), []);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return spots.length ? <Instanced spots={spots}><primitive object={geometry} attach="geometry" /><meshStandardMaterial color={color} roughness={0.72} /></Instanced> : null;
}
function Props({ asset, spots, size, color, detail }: { asset: ModelAsset; spots: InstanceSpot[]; size: [number, number, number]; color: string; detail?: ReactNode }) {
   const body = useMemo(() => spots.map((s) => ({ ...s, y: s.y + size[1] / 2, sx: size[0], sy: size[1], sz: size[2] })), [spots, size]);
   return spots.length ? <InstancedModel asset={asset} spots={spots} fallback={<><Boxes spots={body} color={color} />{detail}</>} /> : null;
}

// One canvas atlas and one mesh for every high-contrast number plate.
function Plates({ run }: { run: Run }) {
   const draw = useCallback((ctx: CanvasRenderingContext2D) => {
      for (const h of run.houses) {
         const i = h.number - 1, x = i % 8 * 128, y = Math.floor(i / 8) * 128;
         ctx.fillStyle = COLORS.ink; ctx.fillRect(x, y, 128, 128);
         ctx.fillStyle = HOUSE_COLORS[h.color]; ctx.fillRect(x + 5, y + 5, 118, 16);
         ctx.fillStyle = COLORS.white; ctx.font = "bold 78px system-ui"; ctx.textAlign = "center";
         ctx.fillText(String(h.number), x + 64, y + 101);
      }
      ctx.fillStyle = COLORS.ink; ctx.fillRect(896, 896, 128, 128);
      ctx.fillStyle = COLORS.white; ctx.font = "bold 32px system-ui"; ctx.textAlign = "center"; ctx.fillText("POST", 960, 970);
   }, [run]);
   const atlas = useCanvasTexture(1024, 1024, draw);
   const geometry = useMemo(() => {
      const vertices: number[] = [], uvs: number[] = [];
      const add = (x: number, y: number, z: number, tile: number, width: number, height: number) => {
         const u = tile % 8 / 8, v = 1 - (Math.floor(tile / 8) + 1) / 8;
         const coords = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, -1, 0, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
         for (const [dx, dy, du, dv] of coords) {
            vertices.push(x + dx * width / 2, y + dy * height / 2, z);
            uvs.push(u + (0.01 + du * 0.98) / 8, v + (0.01 + dv * 0.98) / 8);
         }
      };
      for (const h of run.houses) add(h.x, 1.55, h.mailZ + 0.05, h.number - 1, 1.2, 0.95);
      add(OFFICE.x, 2.0, -5.4, 63, 2.4, 0.8);
      const g = new BoxGeometry();
      // This is a wholly non-indexed plate mesh, never merged with indexed boxes.
      g.setIndex(null); g.clearGroups();
      g.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
      g.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
      g.deleteAttribute("normal"); g.computeVertexNormals(); g.computeBoundingSphere();
      return g;
   }, [run]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return <mesh geometry={geometry}><meshBasicMaterial map={atlas} side={DoubleSide} /></mesh>;
}

function Neighborhood({ run }: { run: Run }) {
   const decor = useMemo(() => {
      const b = run.bounds;
      const width = b.max.x - b.min.x;
      const roads: InstanceSpot[] = [], paths: InstanceSpot[] = [], paving: InstanceSpot[] = [], zebra: InstanceSpot[] = [], lamps: InstanceSpot[] = [], fences: InstanceSpot[] = [], doors: InstanceSpot[] = [], boxes: InstanceSpot[] = [], caps: InstanceSpot[] = [];
      for (let street = 0; street < run.level.streets; street++) {
         const z = street * STREET_GAP;
         roads.push({ x: (b.max.x + b.min.x) / 2, y: 0.015, z, sx: width, sy: 0.03, sz: 5.6 });
         for (const side of [-1, 1]) paving.push({ x: (b.max.x + b.min.x) / 2, y: 0.045, z: z + side * 3.7, sx: width, sy: 0.08, sz: 1.8 });
         for (let j = 0; j < 7; j++) zebra.push({ x: -5, y: 0.04, z: z - 2.4 + j * 0.8, sx: 2.4, sy: 0.015, sz: 0.4 });
         lamps.push({ x: -6.6, y: 0, z: z + 3.2 });
      }
      roads.push({ x: -5, y: 0.02, z: (b.max.z + b.min.z) / 2, sx: 4, sy: 0.04, sz: b.max.z - b.min.z });
      for (const h of run.houses) {
         paths.push({ x: h.x, y: 0.055, z: (h.mailZ + h.doorZ) / 2, sx: 1.3, sy: 0.05, sz: 3.5 });
         doors.push({ x: h.x, y: 0, z: h.doorZ + h.side * 0.1, rotY: h.side > 0 ? Math.PI : 0 });
         boxes.push({ x: h.x, y: 0, z: h.mailZ });
         caps.push({ x: h.x, y: 1.12, z: h.mailZ, sx: 0.64, sy: 0.32, sz: 0.5 });
         for (const side of [-1, 1]) fences.push({ x: h.x + side * 2.9, y: 0, z: h.doorZ + h.side * 1.5, rotY: Math.PI / 2 });
      }
      return { roads, paths, paving, zebra, lamps, fences, doors, boxes, caps };
   }, [run]);
   const groups = useMemo(() => [0, 1, 2].map((kind) => run.houses.filter((h) => h.kind === kind).map((h) => ({ x: h.x, y: 0, z: h.doorZ + h.side * 1.9, rotY: h.side > 0 ? Math.PI : 0 }))), [run]);
   const roofs = useMemo(() => groups.map((spots) => spots.map((s) => ({ ...s, y: 2.2, sx: 5.2, sy: 0.4, sz: 3.4 }))), [groups]);
   const bulbs = useMemo(() => run.houses.flatMap((h) => Array.from({ length: 5 }, (_, i) => ({ x: h.x - 2 + i, y: 2.4, z: h.doorZ + h.side * 0.5, scale: 0.09 }))), [run]);
   return <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[15, -0.03, 20]} receiveShadow><planeGeometry args={[650, 650]} /><meshStandardMaterial color={COLORS.lawn} roughness={1} /></mesh>
      <Boxes spots={decor.roads} color={COLORS.road} /><Boxes spots={decor.paving} color={COLORS.pavement} />
      <Boxes spots={decor.paths} color={COLORS.cream} /><Boxes spots={decor.zebra} color={COLORS.white} />
      {groups.map((spots, i) => <group key={i}>
         <Props asset={[ASSETS.houseA, ASSETS.houseB, ASSETS.houseC][i]} spots={spots} size={[4.8, 2, 3]} color={HOUSE_COLORS[run.houses.find((h) => h.kind === i)!.color]} detail={<Boxes spots={roofs[i]} color={COLORS.roof} />} />
      </group>)}
      <Props asset={ASSETS.door} spots={decor.doors} size={[0.85, 1.65, 0.13]} color={COLORS.bag} />
      <Props asset={ASSETS.mailbox} spots={decor.boxes} size={[0.15, 1.1, 0.15]} color={COLORS.navy} detail={<Boxes spots={decor.caps} color={COLORS.accent} />} />
      <Props asset={ASSETS.fence} spots={decor.fences} size={[2.6, 0.6, 0.08]} color={COLORS.white} />
      <Props asset={ASSETS.lamp} spots={decor.lamps} size={[0.13, 3.1, 0.13]} color={COLORS.navy} />
      <Instanced spots={decor.lamps.map((s) => ({ ...s, y: 3.0, scale: 0.22 }))}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={COLORS.glow} emissive={COLORS.glow} emissiveIntensity={run.level.lighting === "night" ? 3 : 0.2} /></Instanced>
      <group position={[OFFICE.x, 0, -7]}>
         <Model asset={ASSETS.office} fallback={<group><mesh position={[0, 0.8, 0]}><boxGeometry args={[4.2, 1.6, 2.5]} /><meshStandardMaterial color={COLORS.cream} /></mesh><mesh position={[0, 1.65, 0.2]}><boxGeometry args={[4.5, 0.22, 2.8]} /><meshStandardMaterial color={COLORS.accent} /></mesh></group>} />
      </group>
      <group position={[-10, 0, -2]}><Model asset={ASSETS.van} fallback={<group><mesh position={[0, 0.7, 0]}><boxGeometry args={[2.2, 1.4, 3.6]} /><meshStandardMaterial color={COLORS.accent} /></mesh><mesh position={[0, 1, 1.81]}><boxGeometry args={[1.9, 0.5, 0.02]} /><meshStandardMaterial color={COLORS.glass} /></mesh></group>} /></group>
      <Props asset={ASSETS.bench} spots={[{ x: -11, y: 0, z: 5 }]} size={[1.8, 0.6, 0.6]} color={COLORS.bag} />
      <Props asset={ASSETS.bicycle} spots={[{ x: -11, y: 0, z: 7 }]} size={[0.2, 0.8, 1.5]} color={COLORS.navy} />
      {run.level.traffic > 0 && <Props asset={ASSETS.trafficLight} spots={decor.lamps.map((s) => ({ ...s, x: -3.5 }))} size={[0.2, 2.1, 0.25]} color={COLORS.navy} />}
      {run.level.lighting === "night" && <>
         <Instanced spots={bulbs}><sphereGeometry args={[1, 6, 4]} /><meshStandardMaterial color={COLORS.glow} emissive={COLORS.glow} emissiveIntensity={3} /></Instanced>
         <group position={[-17, 0, 10]}><Model asset={ASSETS.holidayTree} fallback={<mesh position={[0, 1.2, 0]}><coneGeometry args={[1, 2.4, 8]} /><meshStandardMaterial color={COLORS.tree} /></mesh>} /></group>
      </>}
      <Plates run={run} />
   </>;
}

function LevelScene() {
   const { config } = useLevel<PostLevel>();
   const [run] = useState(() => createRun(randomSeed(), config));
   const input = useInput();
   const controls = useRef({ moveX: 0, moveY: 0, yaw: 0, actionPressed: false }).current;
   const time = useGameTime();
   const fx = useFx();
   const view = useFittedView(VIEW);
   const hero = useRef<Group>(null), parcel = useRef<Group>(null), hand = useRef<Group>(null), ring = useRef<Group>(null);
   const aim = useRef({ ...OFFICE, y: 0.7 }).current;
   const target = useRef([{ ...OFFICE, y: 1.2, hidden: false, color: COLORS.accent }]).current;
   const anim = useRef({ reachUntil: 0, messageUntil: 0 });
   const scratch = useMemo(() => ({ position: new Vector3(), scale: new Vector3(1, 1, 1), rotation: new Quaternion(), euler: new Euler(), at: { x: 0, y: 1, z: 0 } }), []);
   const pools = useMemo(() => {
      const make = (geometry: InstancePart["geometry"], color: string): InstancePart => ({ geometry, material: new MeshStandardMaterial({ color, roughness: 0.65 }) });
      const car = new RoundedBoxGeometry(2.8, 0.8, 1.3, 2, 0.1); car.translate(0, 0.6, 0);
      const roof = new RoundedBoxGeometry(1.5, 0.55, 1.15, 2, 0.08); roof.translate(-0.2, 1.17, 0);
      const dog = new CapsuleGeometry(0.22, 0.3, 4, 8); dog.rotateX(Math.PI / 2); dog.translate(0, 0.4, 0);
      const head = new SphereGeometry(0.23, 8, 6); head.translate(0, 0.64, 0.32);
      return { cars: [make(car, COLORS.accent), make(roof, COLORS.glass)], dogs: [make(dog, COLORS.dog), make(head, COLORS.bag)] };
   }, []);
   useEffect(() => () => {
      for (const part of [...pools.cars, ...pools.dogs]) { part.geometry.dispose(); (part.material as MeshStandardMaterial).dispose(); }
   }, [pools]);
   const gait = useRef(0);
   const armPose = useMemo(() => createPose(), []);
   const pose = useHumanoidPose((p) => {
      const amount = Math.min(1, Math.hypot(run.hero.vx, run.hero.vz) / 4.6);
      gait.current += amount * time.delta * 10;
      if (run.over === "win") { cheerPose(time.now, p); return; }
      if (amount > 0.05) walkPose(gait.current, amount, p);
      else idlePose(time.now, p);
      if (anim.current.reachUntil > time.now) { reachPose(1, 0.6, armPose); blendPoses(p, armPose, 1, p, POSE_MASK.arms); }
      else if (carrying(run)) { carryPose(0.25, armPose); blendPoses(p, armPose, 1, p, POSE_MASK.arms); }
   });
   const publish = useCallback(() => {
      const s = useArcadeStore.getState();
      s.setStat("delivered", run.delivered);
      s.setStat("bag", run.items.filter((i) => i.loaded && i.kind === "letter").length);
      let slot = 0;
      for (const item of run.items) {
         if (item.delivered || slot >= 3) continue;
         s.setStat(`next${slot}`, item.house); s.setStat(`color${slot}`, item.color); s.setStat(`parcel${slot}`, item.kind === "parcel" ? 1 : 0); slot++;
      }
      for (; slot < 3; slot++) s.setStat(`next${slot}`, 0);
      const next = nextItem(run);
      s.setStat("refill", next && !next.loaded ? 1 : 0);
   }, [run]);
   useEffect(() => { publish(); fx.warm("puff", "sparks", "score"); }, [publish, fx]);
   useRunFrame((_s, dt) => {
      const s = useArcadeStore.getState();
      controls.moveX = input.current.moveX; controls.moveY = input.current.moveY; controls.yaw = view.yaw; controls.actionPressed = input.current.actionPressed;
      const e = step(run, controls, dt);
      if (e.score) s.addScore(e.score);
      if (e.delivered >= 0 || e.refill) publish();
      const item = nextItem(run);
      const at = item && item.loaded ? targetFor(run, item, target[0]) : OFFICE;
      target[0].x = at.x; target[0].z = at.z; target[0].hidden = !item;
      aim.x = run.hero.x + Math.sin(run.hero.yaw) * LOOK_AHEAD;
      aim.z = run.hero.z + Math.cos(run.hero.yaw) * LOOK_AHEAD;
      scratch.at.x = run.hero.x; scratch.at.z = run.hero.z;
      if (e.delivered >= 0) {
         fx.burst("puff", scratch.at, 10); fx.score(scratch.at, `+${e.score}`); playSfx("chime");
         anim.current.reachUntil = time.now + 0.35;
      }
      if (e.wrong || e.refill) { s.setStat("message", e.wrong ? 1 : 2); anim.current.messageUntil = time.now + 1.5; playSfx(e.wrong ? "buzz" : "pickup"); }
      if (time.now > anim.current.messageUntil && s.stats.message) s.setStat("message", 0);
      if (e.hit) { playSfx("hit"); fx.shake(0.2); fx.burst("sparks", scratch.at, 8); }
      if (e.lifeLost) s.loseLife();
      if (run.over) { if (run.over === "win") playSfx("win"); s.end(run.over); }
   });
   useFrame(() => {
      const h = run.hero;
      if (hero.current) {
         hero.current.position.set(h.x, Math.sin(time.play * 12) * Math.min(0.035, Math.hypot(h.vx, h.vz) * 0.01), h.z);
         hero.current.rotation.y = h.yaw;
         hero.current.visible = h.mercy === 0 || Math.floor(time.now * 12) % 2 === 0;
      }
      if (parcel.current) parcel.current.visible = carrying(run);
      if (hand.current) hand.current.rotation.x = anim.current.reachUntil > time.now ? -1.1 : Math.sin(time.play * 9) * Math.min(0.4, Math.hypot(h.vx, h.vz) / 10);
      if (ring.current) { ring.current.position.set(target[0].x, 0.12, target[0].z); ring.current.visible = !target[0].hidden; }
   });
   const updateCar = useCallback((i: number, m: Matrix4) => {
      const c = run.cars[i];
      scratch.position.set(c.x, 0, c.z); scratch.rotation.setFromEuler(scratch.euler.set(0, c.direction < 0 ? Math.PI : 0, 0));
      m.compose(scratch.position, scratch.rotation, scratch.scale);
   }, [run, scratch]);
   const dogTints = useMemo(() => [new Color(COLORS.white), new Color(COLORS.cream), new Color(COLORS.trim)], []);
   const updateDog = useCallback((i: number, m: Matrix4, color: Color) => {
      color.copy(dogTints[i % dogTints.length]);
      const d = run.dogs[i];
      scratch.position.set(d.x, Math.abs(Math.sin(time.now * 12)) * d.active * 0.15, d.z);
      scratch.rotation.setFromEuler(scratch.euler.set(0, 0, 0)); m.compose(scratch.position, scratch.rotation, scratch.scale);
   }, [run, scratch, time, dogTints]);
   return <>
      <CameraRig camera={CAMERA} follow={aim} followFraction={1} bounds={run.bounds} offset={view.offset} shift={view.shift} damping={5} />
      <Neighborhood run={run} />
      <group ref={hero}>
         <BlobShadow radius={0.42} opacity={0.25} />
         <HumanoidModel asset={ASSETS.postman} pose={pose}
            attach={{ chest: <group position={[-0.35, -0.35, 0.08]}><Model asset={ASSETS.mailbag} fallback={<mesh><boxGeometry args={[0.35, 0.4, 0.3]} /><meshStandardMaterial color={COLORS.bag} /></mesh>} /></group> }}
            fallback={<group>
         <mesh position={[0, 0.37, 0]}><capsuleGeometry args={[0.2, 0.42, 4, 8]} /><meshStandardMaterial color={COLORS.navy} /></mesh>
         <mesh position={[0, 1.02, 0]}><capsuleGeometry args={[0.28, 0.45, 4, 10]} /><meshStandardMaterial color={COLORS.blue} /></mesh>
         <mesh position={[0, 1.48, 0]}><sphereGeometry args={[0.24, 12, 8]} /><meshStandardMaterial color={COLORS.skin} /></mesh>
         <mesh position={[0, 1.71, 0.02]}><cylinderGeometry args={[0.28, 0.28, 0.14, 12]} /><meshStandardMaterial color={COLORS.navy} /></mesh>
         <group ref={hand} position={[0.3, 1.15, 0]}><mesh position={[0, -0.2, 0]}><capsuleGeometry args={[0.09, 0.3, 4, 8]} /><meshStandardMaterial color={COLORS.blue} /></mesh></group>
         <group position={[-0.37, 0.8, 0]}><Model asset={ASSETS.mailbag} fallback={<mesh><boxGeometry args={[0.35, 0.4, 0.3]} /><meshStandardMaterial color={COLORS.bag} /></mesh>} /></group>
         <group position={[-0.36, 1.04, 0]}><Model asset={ASSETS.letter} fallback={<mesh><boxGeometry args={[0.22, 0.16, 0.02]} /><meshStandardMaterial color={COLORS.white} /></mesh>} /></group>
            </group>}
         />
         <group ref={parcel} position={[0, 1, 0.4]}><Parcel size={[0.5, 0.35, 0.4]} /></group>
      </group>
      {run.cars.length > 0 && <DynamicInstancedModel asset={ASSETS.car} count={run.cars.length} update={updateCar} fallbackParts={pools.cars} />}
      {run.dogs.length > 0 && <DynamicInstancedModel asset={ASSETS.dog} count={run.dogs.length} update={updateDog} tinted fallbackParts={pools.dogs} />}
      {config.markers && <><TargetMarkers targets={target} color={COLORS.accent} /><group ref={ring}><mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.7, 0.85, 32]} /><meshBasicMaterial color={COLORS.accent} transparent opacity={0.75} side={DoubleSide} /></mesh></group></>}
   </>;
}
export default function Scene() {
   const runId = useArcadeStore((s) => s.runId);
   return <LevelScene key={runId} />;
}
