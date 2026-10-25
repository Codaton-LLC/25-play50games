"use client";

// One useRunFrame steps rules.ts. Visuals read the run and animate with useGameTime.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Euler, Matrix4, Quaternion, Vector3, type Group } from "three";
import { DynamicInstanced, Instanced } from "@/arcade3d/core/render";
import { Model } from "@/arcade3d/core/assets";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { cheerPose, idlePose, useHumanoidPose, walkPose, wrapPhase } from "@/arcade3d/core/rig";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS } from "./assets";
import type { MansionLevel } from "./levels";
import { COLORS, DAMPING, FOLLOW, FOV, LOOK_AHEAD, buildingBox, lookAtFor, viewFor, wallSpots } from "./looks";
import {
   ArmourStandPrimitive,
   BookshelfPrimitive,
   ChairPrimitive,
   DetectiveFigure,
   DoorPrimitive,
   GrandfatherClockPrimitive,
   KeyPrimitive,
   LeverPrimitive,
   PaintingPrimitive,
   TablePrimitive,
} from "./Primitives";
import {
   HERO_SPEED,
   ROOM_D,
   ROOM_W,
   createRun,
   step,
   type Run,
} from "./rules";

const E = new Euler();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3(1, 1, 1);
const AT = { x: 0, y: 0.6, z: 0 };

function LevelScene() {
   const { id, config } = useLevel<MansionLevel>();
   const view = useFittedView(viewFor(id));
   const fx = useFx();
   const time = useGameTime();
   const input = useInput();

   const [run, setRun] = useState<Run>(() => createRun(randomSeed(), config));
   const body = useRef<Group | null>(null);
   const armourBody = useRef<Group | null>(null);
   const gait = useRef({ phase: 0 });

   const bounds = useMemo(() => buildingBox(config), [config]);
   const look = useMemo(() => lookAtFor(config), [config]);
   const walls = useMemo(() => wallSpots(run.solids), [run.solids]);

   const aim = useRef({ x: run.hero.x, y: 0.9, z: run.hero.z }).current;

   useEffect(() => {
      fx.warm("sparks", "puff", "score");
   }, [fx]);

   const pose = useHumanoidPose((p) => {
      const speed = Math.hypot(run.hero.vx, run.hero.vz);
      const amount = Math.min(1, speed / HERO_SPEED);
      gait.current.phase = wrapPhase(gait.current.phase + (speed / 0.7) * Math.PI * 2 * time.delta);
      if (run.over === "win") {
         cheerPose(time.now, p);
      } else if (amount > 0.08) {
         walkPose(gait.current.phase, Math.max(0.35, amount), p);
      } else {
         idlePose(time.now, p);
      }
   });

   useRunFrame((_state, dt) => {
      const { moveX, moveY, action, actionPressed } = input.current;
      const store = useArcadeStore.getState();
      const ev = step(run, { moveX, moveY, action, actionPressed, yaw: view.yaw }, dt, store.timeLeftMs ?? 0);

      // Encode held keys mask
      let mask = 0;
      for (let i = 0; i < run.heldKeys.length; i++) {
         if (run.heldKeys[i]) mask |= 1 << i;
      }
      store.setStat("keys", run.keysCount);
      store.setStat("keyMask", mask);

      aim.x = run.hero.x + Math.sin(run.hero.yaw) * LOOK_AHEAD;
      aim.z = run.hero.z + Math.cos(run.hero.yaw) * LOOK_AHEAD;
      aim.y = 0.9;
      aim.x = Math.min(bounds.max.x, Math.max(bounds.min.x, aim.x));
      aim.z = Math.min(bounds.max.z, Math.max(bounds.min.z, aim.z));

      if (ev.keyPickup >= 0) {
         const k = run.keys[ev.keyPickup];
         AT.x = k.x; AT.y = 0.7; AT.z = k.z;
         fx.burst("sparks", AT, 12);
         fx.score(AT, "+KEY");
         playSfx("pickup");
      }
      if (ev.doorOpen >= 0) {
         const d = run.doors.find((dr) => dr.id === ev.doorOpen);
         if (d) {
            AT.x = d.x; AT.y = 1.0; AT.z = d.z;
            fx.burst("sparks", AT, 8);
         }
         playSfx("whoosh");
      }
      if (ev.leverPulled) {
         if (run.lever) {
            AT.x = run.lever.x; AT.y = run.lever.y; AT.z = run.lever.z;
            fx.burst("puff", AT, 8);
            fx.shake(0.2);
         }
         playSfx("hit");
      }
      if (ev.hitArmour) {
         AT.x = run.hero.x; AT.y = 0.9; AT.z = run.hero.z;
         fx.burst("puff", AT, 10);
         fx.shake(0.3);
         playSfx("buzz");
      }
      if (ev.lifeLost) {
         store.loseLife();
      }
      if (ev.won) {
         store.setScore(run.score);
         playSfx("win");
         store.end("win");
      }
      if (run.over === "lose") {
         store.end("lose");
      } else if (run.over === "timeup") {
         store.end("timeup");
      }
   });

   useFrame(() => {
      if (body.current) {
         body.current.position.set(run.hero.x, run.hero.y, run.hero.z);
         body.current.rotation.y = run.hero.yaw;
      }
      if (armourBody.current && run.armour) {
         const bob = Math.sin(time.now * 6) * 0.04;
         armourBody.current.position.set(run.armour.agent.x, run.armour.agent.y + bob, run.armour.agent.z);
         armourBody.current.rotation.y = run.armour.agent.yaw;
      }
   }, FRAME_PRIORITY.visuals);

   const totalW = config.cols * ROOM_W;
   const totalD = config.rows * ROOM_D;

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

         {/* Mansion Floor */}
         <mesh rotation-x={-Math.PI / 2} position={[totalW / 2, 0, totalD / 2]}>
            <planeGeometry args={[totalW + 2, totalD + 2]} />
            <meshStandardMaterial color={COLORS.floor} roughness={0.9} />
         </mesh>

         {/* Floor grid trim */}
         <mesh rotation-x={-Math.PI / 2} position={[totalW / 2, 0.005, totalD / 2]}>
            <planeGeometry args={[totalW, totalD]} />
            <meshStandardMaterial color={COLORS.floorTrim} roughness={0.85} />
         </mesh>

         {/* Solid Walls */}
         <Instanced spots={walls} name="walls">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.88} />
         </Instanced>

         {/* Doors */}
         {run.doors.map((door) => {
            if (door.open) {
               // Render open doorway with recessed frame
               return (
                  <group key={door.id} position={[door.x, 0, door.z]} rotation-y={door.rotY}>
                     <mesh position={[-0.65, 1.1, 0]}>
                        <boxGeometry args={[0.1, 2.2, 0.2]} />
                        <meshStandardMaterial color={COLORS.doorTrim} roughness={0.7} />
                     </mesh>
                     <mesh position={[0.65, 1.1, 0]}>
                        <boxGeometry args={[0.1, 2.2, 0.2]} />
                        <meshStandardMaterial color={COLORS.doorTrim} roughness={0.7} />
                     </mesh>
                     <mesh position={[0, 2.15, 0]}>
                        <boxGeometry args={[1.4, 0.1, 0.2]} />
                        <meshStandardMaterial color={COLORS.doorTrim} roughness={0.7} />
                     </mesh>
                  </group>
               );
            }
            return (
               <group key={door.id} position={[door.x, 0, door.z]} rotation-y={door.rotY}>
                  <DoorPrimitive color={door.color} shape={door.shape} />
               </group>
            );
         })}

         {/* Keys on props */}
         {run.keys.map((key) => {
            if (key.collected) return null;
            const bob = Math.sin(time.now * 3 + key.id) * 0.06;
            return (
               <group key={key.id} position={[key.x, key.y + bob, key.z]}>
                  {/* Prop underneath key: Chest or Small Pedestal */}
                  <mesh position={[0, -0.4, 0]}>
                     <cylinderGeometry args={[0.28, 0.32, 0.4, 12]} />
                     <meshStandardMaterial color={COLORS.table} roughness={0.7} />
                  </mesh>
                  {/* Floating rotating key */}
                  <group rotation-y={time.now * 2}>
                     <KeyPrimitive color={key.color} shape={key.shape} />
                  </group>
               </group>
            );
         })}

         {/* Lever */}
         {run.lever && (
            <group position={[run.lever.x, run.lever.y, run.lever.z]} rotation-y={run.lever.rotY}>
               <LeverPrimitive pulled={run.leverPulled} />
            </group>
         )}

         {/* Armour Stand */}
         {run.armour && (
            <group ref={armourBody}>
               <Model asset={ASSETS.armour} fallback={<ArmourStandPrimitive />} />
            </group>
         )}

         {/* Exit marker banner in exit room */}
         <group position={[run.rooms[run.rooms.length - 1].cx, 0.02, run.rooms[run.rooms.length - 1].cz]}>
            <mesh rotation-x={-Math.PI / 2}>
               <circleGeometry args={[1.0, 24]} />
               <meshStandardMaterial
                  color={COLORS.exitGlow}
                  emissive={COLORS.exitGlow}
                  emissiveIntensity={run.exitDoorOpen ? 0.45 : 0.1}
                  transparent
                  opacity={0.35}
               />
            </mesh>
         </group>

         {/* Room Decor props (Grandfather clock, bookshelf, painting) */}
         {run.rooms.map((room) => {
            const hasClock = (room.col + room.row) % 3 === 1;
            const hasShelf = (room.col + room.row) % 3 === 2;
            const hasPainting = (room.col * 2 + room.row) % 3 === 0;
            return (
               <group key={room.index}>
                  {hasClock && (
                     <group position={[room.cx - 2.4, 0, room.cz - 2.0]} rotation-y={0}>
                        <GrandfatherClockPrimitive />
                     </group>
                  )}
                  {hasShelf && (
                     <group position={[room.cx + 2.4, 0, room.cz - 2.0]} rotation-y={0}>
                        <BookshelfPrimitive />
                     </group>
                  )}
                  {hasPainting && (
                     <group position={[room.cx, 1.6, room.cz + 2.38]} rotation-y={Math.PI}>
                        <PaintingPrimitive />
                     </group>
                  )}
               </group>
            );
         })}

         {/* Hero Detective */}
         <group ref={body}>
            <DetectiveFigure />
         </group>
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
