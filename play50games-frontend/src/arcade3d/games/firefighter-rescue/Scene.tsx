"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, ConeGeometry, CylinderGeometry, Euler, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Group } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { waddle, type BodyOffset } from "@/arcade3d/core/motion";
import { useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstancePart } from "@/arcade3d/core/render";
import { HumanoidModel, aimArm, cheerPose, idlePose, jumpPose, useHumanoidPose, walkPose, wrapPhase } from "@/arcade3d/core/rig";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS } from "./assets";
import type { FireLevel } from "./levels";
import { COLORS, DAMPING, FOLLOW, FOV, LOOK_AHEAD, buildingBox, lookAtFor, plaqueSpots, viewFor, wallSpots } from "./looks";
import { ExitSignPrimitive, ExtinguisherPrimitive, FirefighterFigure, HoseReelPrimitive, HydrantPrimitive, TruckPrimitive } from "./Primitives";
import {
   FURN_SIZE,
   HOP_H,
   MAX_SPEED,
   createRun,
   debrisPose,
   doorClosed,
   doorMidZ,
   step,
   type FurnKind,
   type Furniture,
   type Run,
} from "./rules";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const AT = { x: 0, y: 0.5, z: 0 };
const WOFF: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };

function spotsOf(items: readonly Furniture[], kind: FurnKind) {
   return items.filter((item) => item.kind === kind).map((item) => ({ x: item.x, y: 0, z: item.z, rotY: item.rotY }));
}

function FurnMeshes({ kind, color, trim, spots, asset }: {
   kind: FurnKind;
   color: string;
   trim: string;
   spots: ReturnType<typeof spotsOf>;
   asset: (typeof ASSETS)[FurnKind] | (typeof ASSETS)["chair"];
}) {
   const size = FURN_SIZE[kind];
   const parts = useMemo(() => {
      const body = new BoxGeometry(size.x, size.y * 0.78, size.z);
      body.translate(0, size.y * 0.39, 0);
      const cap = new BoxGeometry(size.x * 0.9, size.y * 0.24, size.z * 0.9);
      cap.translate(0, size.y * 0.84, 0);
      return {
         body,
         cap,
         bodyMat: new MeshStandardMaterial({ color, roughness: 0.72 }),
         capMat: new MeshStandardMaterial({ color: trim, roughness: 0.6 }),
      };
   }, [size, color, trim]);
   useEffect(() => () => {
      parts.body.dispose();
      parts.cap.dispose();
      parts.bodyMat.dispose();
      parts.capMat.dispose();
   }, [parts]);
   if (spots.length === 0) return null;
   return (
      <InstancedModel
         asset={asset}
         spots={spots}
         fallback={
            <>
               <Instanced spots={spots} name={kind}>
                  <primitive object={parts.body} attach="geometry" />
                  <primitive object={parts.bodyMat} attach="material" />
               </Instanced>
               <Instanced spots={spots} name={`${kind}-trim`}>
                  <primitive object={parts.cap} attach="geometry" />
                  <primitive object={parts.capMat} attach="material" />
               </Instanced>
            </>
         }
      />
   );
}

function LevelScene() {
   const { id, config } = useLevel<FireLevel>();
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const quality = useQuality();
   const [run] = useState<Run>(() => createRun(randomSeed(), config));
   const aim = useRef({ x: run.hero.x, y: 0.9, z: run.hero.z + LOOK_AHEAD }).current;
   const body = useRef<Group>(null);
   const gait = useRef({ phase: 0 });
   const puffAt = useRef(0);
   const bounds = useMemo(() => buildingBox(config), [config]);
   const look = useMemo(() => lookAtFor(config), [config]);
   const walls = useMemo(() => wallSpots(config), [config]);
   const plaques = useMemo(() => plaqueSpots(config).slice(0, Math.max(1, Math.round(config.rooms * quality.decor))), [config, quality.decor]);
   const caps = useMemo(() => walls.map((spot) => ({ ...spot, y: 2.25, sy: 0.08 })), [walls]);
   const sofas = useMemo(() => spotsOf(run.furniture, "sofa"), [run]);
   const beds = useMemo(() => spotsOf(run.furniture, "bed"), [run]);
   const cabinets = useMemo(() => spotsOf(run.furniture, "cabinet"), [run]);
   const chairs = useMemo(() => spotsOf(run.furniture, "chair"), [run]);
   const zEnd = config.rooms * 6;

   const fireParts = useMemo<InstancePart[]>(() => {
      const cone = new ConeGeometry(0.26, 0.62, 8);
      cone.translate(0, 0.34, 0);
      const core = new SphereGeometry(0.1, 8, 6);
      core.translate(0, 0.58, 0);
      return [
         { geometry: cone, material: new MeshStandardMaterial({ color: COLORS.ember, emissive: COLORS.ember, emissiveIntensity: 0.85, roughness: 0.4 }) },
         { geometry: core, material: new MeshStandardMaterial({ color: COLORS.emberCore, emissive: COLORS.emberCore, emissiveIntensity: 1, roughness: 0.35 }) },
      ];
   }, []);
   const debrisParts = useMemo<InstancePart[]>(() => {
      const box = new BoxGeometry(0.68, 0.5, 0.68);
      box.translate(0, 0.28, 0);
      const band = new BoxGeometry(0.72, 0.12, 0.72);
      band.translate(0, 0.34, 0);
      return [
         { geometry: box, material: new MeshStandardMaterial({ color: COLORS.debris, roughness: 0.7 }) },
         { geometry: band, material: new MeshStandardMaterial({ color: COLORS.debrisBand, roughness: 0.55 }) },
      ];
   }, []);
   const civParts = useMemo<InstancePart[]>(() => {
      const legs = new CylinderGeometry(0.1, 0.12, 0.55, 8);
      legs.translate(0, 0.32, 0);
      const torso = new CylinderGeometry(0.16, 0.18, 0.42, 8);
      torso.translate(0, 0.78, 0);
      const head = new SphereGeometry(0.13, 10, 8);
      head.translate(0, 1.12, 0);
      return [
         { geometry: legs, material: new MeshStandardMaterial({ color: COLORS.civTrim, roughness: 0.65 }) },
         { geometry: torso, material: new MeshStandardMaterial({ color: COLORS.civCloth, roughness: 0.6 }) },
         { geometry: head, material: new MeshStandardMaterial({ color: COLORS.skin, roughness: 0.55 }) },
      ];
   }, []);
   useEffect(() => () => {
      for (const part of [...fireParts, ...debrisParts, ...civParts]) {
         part.geometry.dispose();
         const material = part.material;
         if (Array.isArray(material)) material.forEach((m) => m.dispose());
         else material.dispose();
      }
   }, [fireParts, debrisParts, civParts]);

   const pose = useHumanoidPose((p) => {
      const speed = Math.hypot(run.hero.vx, run.hero.vz);
      const amount = Math.min(1, speed / MAX_SPEED);
      gait.current.phase = wrapPhase(gait.current.phase + (speed / 0.72) * Math.PI * 2 * time.delta);
      if (run.over === "win") cheerPose(time.now, p);
      else if (run.hero.hop > 0) jumpPose(Math.min(1, run.hero.y / HOP_H), p);
      else if (amount > 0.08) walkPose(gait.current.phase, Math.max(0.35, amount), p);
      else idlePose(time.now, p);
      if (run.holdKind !== 0) aimArm(p, -1, 0.12, -0.15, 0.95, 0.04, -0.1, 1);
   });

   useEffect(() => {
      fx.warm("smoke", "sparks", "puff", "score");
   }, [fx]);

   useRunFrame((_state, dt) => {
      const { moveX, moveY, action, jumpPressed } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, action, jumpPressed, yaw: view.yaw }, dt, store.timeLeftMs ?? 0);
      if (ev.score) store.addScore(ev.score);
      store.setStat("fires", run.firesOut);
      store.setStat("saved", run.saved);
      store.setStat("breath", Math.round(Math.max(0, run.hero.breath) * 100));
      aim.x = run.hero.x + Math.sin(run.hero.yaw) * LOOK_AHEAD;
      aim.z = run.hero.z + Math.cos(run.hero.yaw) * LOOK_AHEAD;
      aim.y = 0.9 + run.hero.y;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, aim.x));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, aim.z));
      if (ev.hop) playSfx("jump");
      if (ev.fire >= 0) {
         const fire = run.fires[ev.fire];
         AT.x = fire.x; AT.y = 0.6; AT.z = fire.z;
         fx.burst("sparks", AT, 10);
         fx.score(AT, "+100");
         playSfx("whoosh");
      }
      if (ev.save >= 0) {
         AT.x = run.hero.x; AT.y = 1.2; AT.z = run.hero.z;
         fx.burst("sparks", AT, 12);
         fx.score(AT, run.civilians[ev.save]?.clean ? "+200" : "+150");
         playSfx("pickup");
      }
      if (ev.debris) {
         AT.x = run.hero.x; AT.y = 0.6; AT.z = run.hero.z;
         fx.burst("puff", AT, 8);
         fx.shake(0.25);
         playSfx("hit");
      }
      if (ev.breathBreak) {
         fx.shake(0.15);
         playSfx("buzz");
      }
      if (ev.lifeLost) store.loseLife();
      if (ev.won) {
         playSfx("win");
         store.end("win");
      }
      if (run.time - puffAt.current > 0.4) {
         puffAt.current = run.time;
         for (const fire of run.fires) {
            if (fire.out) continue;
            AT.x = fire.x; AT.y = 0.45; AT.z = fire.z;
            fx.burst("smoke", AT, 4);
         }
         for (const disc of run.smoke) {
            AT.x = disc.x; AT.y = 0.35; AT.z = disc.z;
            fx.burst("smoke", AT, 3);
         }
         for (const debris of run.debris) {
            if (debrisPose(debris.phase).moving) continue;
            AT.x = debris.x; AT.y = 0.5; AT.z = debris.z;
            fx.burst("smoke", AT, 4);
         }
      }
   });

   useFrame(() => {
      const group = body.current;
      if (!group) return;
      group.position.set(run.hero.x, run.hero.y, run.hero.z);
      group.rotation.y = run.hero.yaw;
   }, FRAME_PRIORITY.visuals);

   const placeFire = (index: number, matrix: Matrix4) => {
      const fire = run.fires[index];
      if (!fire || fire.out) return false;
      const bob = 1 + Math.sin(run.time * 6 + index) * 0.08;
      V.set(fire.x, 0, fire.z);
      Q.identity();
      S.set(1, bob, 1);
      matrix.compose(V, Q, S);
   };
   const placeDebris = (index: number, matrix: Matrix4) => {
      const debris = run.debris[index];
      if (!debris) return false;
      V.set(debris.x, 0, debris.z);
      Q.identity();
      S.set(1, 1, 1);
      matrix.compose(V, Q, S);
   };
   const placeCiv = (index: number, matrix: Matrix4) => {
      const civ = run.civilians[index];
      if (!civ) return false;
      const moving = Math.hypot(civ.vx, civ.vz);
      waddle(civ.phase, civ.saved ? 0.04 : moving > 0.2 ? 0.32 : 0.08, WOFF);
      E.set(WOFF.roll, civ.yaw + WOFF.yaw, 0);
      Q.setFromEuler(E);
      V.set(civ.x, WOFF.y, civ.z);
      S.set(1, WOFF.squash, 1);
      matrix.compose(V, Q, S);
   };
   const placeDoor = (index: number, matrix: Matrix4) => {
      if (index >= config.rooms) return false;
      const left = index % 2 === 0;
      const closed = doorClosed(run, index);
      const z = doorMidZ(index);
      V.set(left ? -1.55 : 1.55, 0, closed ? z : z - 0.7);
      E.set(0, left ? Math.PI / 2 : -Math.PI / 2, 0);
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      matrix.compose(V, Q, S);
   };

   return (
      <>
         <CameraRig
            camera={{ position: view.offset, fov: FOV, lookAt: look }}
            follow={aim}
            followFraction={FOLLOW}
            bounds={bounds}
            offset={view.offset}
            shift={view.shift}
            damping={DAMPING}
         />
         {/* extra fill so the rooms and the firefighter read clearly (the core indoor/night light is dim; the fire glow keeps the mood) */}
         <hemisphereLight args={["#ffe9cf", "#7a6d62", config.lighting === "night" ? 1.5 : 1.1]} />
         <ambientLight intensity={config.lighting === "night" ? 0.7 : 0.45} />
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, (zEnd - 5.2) / 2]}>
            <planeGeometry args={[16, zEnd + 8]} />
            <meshStandardMaterial color={COLORS.floor} roughness={0.92} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, -4.6]}>
            <planeGeometry args={[8, 3.2]} />
            <meshStandardMaterial color={COLORS.street} roughness={0.88} />
         </mesh>
         <Instanced spots={walls} name="walls">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.86} />
         </Instanced>
         <Instanced spots={caps} name="wall-caps">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wallTrim} roughness={0.7} />
         </Instanced>
         {plaques.length > 0 && (
            <Instanced spots={plaques} name="plaques">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={COLORS.ember} emissive={COLORS.ember} emissiveIntensity={0.15} roughness={0.5} />
            </Instanced>
         )}
         <FurnMeshes kind="sofa" color={COLORS.sofa} trim={COLORS.sofaCushion} spots={sofas} asset={ASSETS.sofa} />
         <FurnMeshes kind="bed" color={COLORS.bedFrame} trim={COLORS.bed} spots={beds} asset={ASSETS.bed} />
         <FurnMeshes kind="cabinet" color={COLORS.cabinet} trim={COLORS.cabinetDoor} spots={cabinets} asset={ASSETS.cabinet} />
         <FurnMeshes kind="chair" color={COLORS.chair} trim={COLORS.chairSeat} spots={chairs} asset={ASSETS.chair} />
         <DynamicInstancedModel asset={ASSETS.door} count={config.rooms} update={placeDoor} fallbackParts={DOOR_PARTS} name="doors" />
         <DynamicInstanced count={run.fires.length} update={placeFire} parts={fireParts} name="fires" />
         {run.smoke.map((disc, i) => (
            <mesh key={i} position={[disc.x, 0.025, disc.z]} rotation-x={-Math.PI / 2}>
               <circleGeometry args={[disc.r, 18]} />
               <meshBasicMaterial color={COLORS.smoke} transparent opacity={0.35} depthWrite={false} />
            </mesh>
         ))}
         {run.debris.length > 0 && (
            <DynamicInstanced count={run.debris.length} update={placeDebris} parts={debrisParts} name="debris" />
         )}
         <DynamicInstancedModel asset={ASSETS.civilian} count={5} update={placeCiv} fallbackParts={civParts} name="civilians" />
         <group ref={body}>
            <HumanoidModel asset={ASSETS.firefighter} pose={pose} fallback={<FirefighterFigure />} attach={{ handR: <Model asset={ASSETS.extinguisher} fallback={<ExtinguisherPrimitive />} /> }} />
         </group>
         <Model asset={ASSETS.truck} position={[0, 0, -5.5]} rotation-y={Math.PI} fallback={<TruckPrimitive />} />
         <Model asset={ASSETS.hydrant} position={[-2.3, 0, -4.3]} fallback={<HydrantPrimitive />} />
         <Model asset={ASSETS.hoseReel} position={[2.35, 0, -4.5]} fallback={<HoseReelPrimitive />} />
         <Model asset={ASSETS.exitSign} position={[0, 0, -1.55]} fallback={<ExitSignPrimitive />} />
      </>
   );
}

const DOOR_SLAB = new BoxGeometry(1.1, 2.05, 0.08);
DOOR_SLAB.translate(0, 1.02, 0);
const DOOR_KNOB = new BoxGeometry(0.08, 0.08, 0.1);
DOOR_KNOB.translate(0.38, 1, 0.06);
const DOOR_PARTS: InstancePart[] = [
   { geometry: DOOR_SLAB, material: new MeshStandardMaterial({ color: "#a16207", roughness: 0.6 }) },
   { geometry: DOOR_KNOB, material: new MeshStandardMaterial({ color: COLORS.emberCore, roughness: 0.35, metalness: 0.2 }) },
];

export default function Scene() {
   return <LevelScene />;
}
