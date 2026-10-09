"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   Color,
   Matrix4,
   Quaternion,
   Vector3,
   type Group,
   type Mesh,
   type MeshStandardMaterial,
} from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { spring, squashStretch, waddle, type BodyOffset, type SpringState } from "@/arcade3d/core/motion";
import { useCanvasTexture } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, DINO_BACK_TOP_ANCHOR } from "./assets";
import { VALLEY_BOUNDS, viewFor } from "./camera";
import { DinoPrimitive, useBoulderParts } from "./Primitives";
import {
   BOULDERS,
   DINO,
   NEST,
   createDinoRun,
   stepDinoRun,
   type DinoRunState,
   type GroundEgg,
   type StepInput,
} from "./rules";
import { Valley } from "./Valley";

const MAX_BOULDERS = 8;
const REGULAR_EGG_POOL = 9;
const MARKER_COUNT = 5;

// Hoisted scratch variables for zero-allocation per-frame transforms
const SCRATCH_POS = new Vector3();
const SCRATCH_QUAT = new Quaternion();
const SCRATCH_AXIS = new Vector3();
const SCRATCH_SCALE = new Vector3(1, 1, 1);
const DINO_SCALE = { x: 1, y: 1, z: 1 };
const DINO_OFFSET: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };
const COLOR_READY = new Color("#38bdf8");
const COLOR_COOLDOWN = new Color("#94a3b8");

export default function Scene() {
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const view = useFittedView(viewFor(width, height));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);

   // Pure deterministic run state, a fresh seed per run (the Scene remounts per run)
   const [run] = useState<DinoRunState>(() => createDinoRun(randomSeed()));

   // Hoisted scratch state for frame inputs & spring oscillation
   const [scratch] = useState(() => ({
      stepInp: {
         moveX: 0,
         moveY: 0,
         actionPressed: false,
         jumpPressed: false,
      } as StepInput,
      dir: { x: 0, z: 0 },
      stackSpringX: { x: 0, v: 0 } as SpringState,
      stackSpringZ: { x: 0, v: 0 } as SpringState,
   }));

   // Fallback parts for boulder dynamic instancing
   const boulderParts = useBoulderParts();

   // Fx warming
   useEffect(() => {
      fx.warm("sparkle", "puff", "debris", "score");
   }, [fx]);

   // Ambient rumble loop handle
   const loopRef = useRef<LoopHandle | null>(null);

   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const loop = startLoop("hum", { pitch: 0.6, volume: 0.25 });
      loopRef.current = loop;
      return () => {
         loop.stop();
         loopRef.current = null;
      };
   }, [phase, muted]);

   // Spotted egg canvas texture shared across all regular eggs
   const eggTexture = useCanvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = "#ca8a04";
      const spots = [
         [22, 28, 6],
         [52, 78, 8],
         [92, 38, 6],
         [108, 98, 7],
         [72, 18, 5],
         [32, 108, 6],
         [82, 74, 9],
         [18, 68, 7],
      ];
      for (const [x, y, r] of spots) {
         ctx.beginPath();
         ctx.arc(x, y, r, 0, Math.PI * 2);
         ctx.fill();
      }
   });

   // TargetMarkers fixed targets array
   const markerTargets = useMemo<MarkerTarget[]>(() => {
      const arr: MarkerTarget[] = [];
      for (let i = 0; i < MARKER_COUNT; i++) {
         arr.push({ x: 0, y: 0, z: 0, hidden: true, color: "#a3e635" });
      }
      return arr;
   }, []);

   // Visual object refs
   const dinoGroupRef = useRef<Group>(null);
   const dashRingRef = useRef<Mesh>(null);
   const stunHaloRef = useRef<Group>(null);
   const graceHaloRef = useRef<Mesh>(null);
   const carriedStackRef = useRef<Group>(null);
   const carriedEgg1Ref = useRef<Mesh>(null);
   const carriedEgg2Ref = useRef<Mesh>(null);
   const carriedEgg3Ref = useRef<Mesh>(null);
   const carriedGoldenRef = useRef<Group>(null);

   // Fixed pool of ground egg groups
   const regularEggRefs = useRef<(Group | null)[]>([]);
   const goldenEggRef = useRef<Group | null>(null);

   // 1. ONE useRunFrame driving rules and store updates on the run clock
   useRunFrame((_state, dt) => {
      const { moveX, moveY, jumpPressed, actionPressed } = input.current;
      const { stepInp, dir } = scratch;

      inputToWorld(moveX, moveY, view.yaw, dir);
      stepInp.moveX = dir.x;
      stepInp.moveY = dir.z;
      stepInp.actionPressed = !!actionPressed;
      stepInp.jumpPressed = !!jumpPressed;

      const events = stepDinoRun(run, stepInp, dt);

      // Dispatch store state
      const store = useArcadeStore.getState();
      store.setScore(run.score);
      store.setStat("carried", run.dino.carriedEggs.length);
      store.setStat("golden", run.dino.carriedGolden ? 1 : 0);
      store.setStat("dash", run.dino.dashCooldown <= 0 ? 1 : 0);
      store.setStat(
         "eggs",
         run.deliveredRegularCount + run.deliveredGoldenCount
      );

      // Sound & particle feedback
      if (events.dashStarted) {
         playSfx("whoosh", { pitch: 1.1 });
         SCRATCH_POS.set(run.dino.x, 0.4, run.dino.z);
         fx.burst("puff", SCRATCH_POS, 12);
      }
      if (events.footstep) {
         playSfx("thud", { volume: 0.35, pitch: 1.3 });
      }
      if (events.eggPicked) {
         playSfx("pickup", { pitch: 1.2 });
         SCRATCH_POS.set(run.dino.x, 0.5, run.dino.z);
         fx.burst("sparkle", SCRATCH_POS, 16);
      }
      if (events.goldenPicked) {
         playSfx("chime", { pitch: 1.6 });
         SCRATCH_POS.set(run.dino.x, 0.6, run.dino.z);
         fx.burst("sparkle", SCRATCH_POS, 24);
      }
      if (events.goldenSpawned) {
         playSfx("chime", { pitch: 1.5 });
      }
      if (events.boulderHit) {
         playSfx("hit");
         fx.shake(0.25);
         SCRATCH_POS.set(run.dino.x, 0.5, run.dino.z);
         fx.burst("debris", SCRATCH_POS, 20);
      }
      if (events.eggDelivered) {
         const pts = events.eggDelivered.points;
         const pitch = 1.0 + events.eggDelivered.regularCount * 0.2;
         playSfx("chime", { pitch });
         SCRATCH_POS.set(NEST.x, 1.2, NEST.z);
         fx.score(SCRATCH_POS, `+${pts}`, { color: "#facc15" });
         fx.burst("sparkle", SCRATCH_POS, 26);
      }
   });

   // 2. Dynamic placement for boulder pool
   const placeBoulder = (i: number, m: Matrix4) => {
      const b = run.boulders[i];
      if (!b || !b.active) return false;
      SCRATCH_POS.set(b.x, BOULDERS.radius, b.z);
      SCRATCH_AXIS.set(b.dirZ, 0, -b.dirX);
      const axisLen = SCRATCH_AXIS.length();
      if (axisLen > 1e-6) SCRATCH_AXIS.divideScalar(axisLen);
      SCRATCH_QUAT.setFromAxisAngle(SCRATCH_AXIS, b.rollAngle);
      m.compose(SCRATCH_POS, SCRATCH_QUAT, SCRATCH_SCALE);
      return true;
   };

   // 3. Visual animation frame (waddle, spring, rings, markers, pools)
   useFrame(() => {
      const dt = time.delta;
      const { dino } = run;

      // Dino group transform
      if (dinoGroupRef.current) {
         dinoGroupRef.current.position.set(dino.x, 0, dino.z);
         dinoGroupRef.current.rotation.y = dino.heading;

         // Waddle body motion
         const speed = Math.hypot(dino.vx, dino.vz);
         waddle(dino.waddlePhase, Math.min(0.12, speed * 0.025), DINO_OFFSET);
         if (dino.dashTimer > 0) {
            squashStretch(0.85, DINO_SCALE);
            dinoGroupRef.current.scale.set(DINO_SCALE.x, DINO_SCALE.y, DINO_SCALE.z);
         } else {
            dinoGroupRef.current.scale.set(1, 1, 1);
         }
         dinoGroupRef.current.position.y = DINO_OFFSET.y;
         dinoGroupRef.current.rotation.z = DINO_OFFSET.roll;
      }

      // World dash cooldown ring
      if (dashRingRef.current) {
         dashRingRef.current.position.set(dino.x, 0.03, dino.z);
         const ready = dino.dashCooldown <= 0;
         dashRingRef.current.visible = true;
         const mat = dashRingRef.current.material as MeshStandardMaterial | undefined;
         if (mat) {
            mat.opacity = ready ? 0.75 : 0.25;
            mat.color.copy(ready ? COLOR_READY : COLOR_COOLDOWN);
         }
      }

      // Stun stars halo
      if (stunHaloRef.current) {
         const isStunned = dino.stunTimer > 0;
         stunHaloRef.current.visible = isStunned;
         if (isStunned) {
            stunHaloRef.current.position.set(dino.x, 1.05, dino.z);
            stunHaloRef.current.rotation.y = time.now * 6;
         }
      }

      // Post-stun grace blinking shield halo
      if (graceHaloRef.current) {
         const inGrace = dino.graceTimer > 0;
         const blink = Math.sin(time.now * 16) > 0;
         graceHaloRef.current.visible = inGrace && blink;
         if (inGrace) {
            graceHaloRef.current.position.set(dino.x, 0.45, dino.z);
         }
      }

      // Egg stack spring sway on dino back
      if (carriedStackRef.current) {
         const targetTiltX = -Math.max(-0.25, Math.min(0.25, dino.vx * 0.04));
         const targetTiltZ = -Math.max(-0.25, Math.min(0.25, dino.vz * 0.04));
         spring(scratch.stackSpringX, targetTiltX, 75, 12, dt);
         spring(scratch.stackSpringZ, targetTiltZ, 75, 12, dt);
         carriedStackRef.current.rotation.z = scratch.stackSpringX.x;
         carriedStackRef.current.rotation.x = scratch.stackSpringZ.x;

         const carriedCount = dino.carriedEggs.length;
         if (carriedEgg1Ref.current) carriedEgg1Ref.current.visible = carriedCount >= 1;
         if (carriedEgg2Ref.current) carriedEgg2Ref.current.visible = carriedCount >= 2;
         if (carriedEgg3Ref.current) carriedEgg3Ref.current.visible = carriedCount >= 3;
      }

      // Carried golden egg in mouth
      if (carriedGoldenRef.current) {
         carriedGoldenRef.current.visible = dino.carriedGolden;
      }

      // Update ground eggs pool (instant pick/spawn updates)
      let regSlot = 0;
      let goldenFound = false;
      for (let i = 0; i < run.groundEggs.length; i++) {
         const egg = run.groundEggs[i];
         if (!egg.active) continue;
         if (egg.isGolden) {
            if (goldenEggRef.current) {
               goldenEggRef.current.visible = true;
               goldenEggRef.current.position.set(egg.x, 0, egg.z);
               goldenFound = true;
            }
         } else {
            if (regSlot < REGULAR_EGG_POOL && regularEggRefs.current[regSlot]) {
               const g = regularEggRefs.current[regSlot]!;
               g.visible = true;
               g.position.set(egg.x, 0, egg.z);
               regSlot++;
            }
         }
      }
      if (!goldenFound && goldenEggRef.current) {
         goldenEggRef.current.visible = false;
      }
      for (let i = regSlot; i < REGULAR_EGG_POOL; i++) {
         if (regularEggRefs.current[i]) {
            regularEggRefs.current[i]!.visible = false;
         }
      }

      // Modulate boulder rumble hum loop by distance to nearest boulder
      let minBoulderDist = 999;
      for (let i = 0; i < run.boulders.length; i++) {
         const b = run.boulders[i];
         if (b.active) {
            const d = Math.hypot(b.x - dino.x, b.z - dino.z);
            if (d < minBoulderDist) minBoulderDist = d;
         }
      }
      if (loopRef.current) {
         const prox = Math.max(0, Math.min(1, (12 - minBoulderDist) / 9));
         const volume = 0.15 + 0.35 * prox;
         const pitch = 0.5 + 0.3 * prox;
         loopRef.current.set({ volume, pitch });
      }

      // TargetMarkers: uncollected egg, golden egg, nest, and boulder warning arrows
      // 1. Nearest uncollected egg marker
      let nearestEggDist = 999;
      let nearestEggX = 0;
      let nearestEggZ = 0;
      let foundEgg = false;
      if (dino.carriedEggs.length < 3) {
         for (let i = 0; i < run.groundEggs.length; i++) {
            const e = run.groundEggs[i];
            if (!e.active || e.isGolden) continue;
            const d = Math.hypot(e.x - dino.x, e.z - dino.z);
            if (d < nearestEggDist) {
               nearestEggDist = d;
               nearestEggX = e.x;
               nearestEggZ = e.z;
               foundEgg = true;
            }
         }
      }
      if (foundEgg) {
         markerTargets[0].x = nearestEggX;
         markerTargets[0].y = 0.2;
         markerTargets[0].z = nearestEggZ;
         markerTargets[0].hidden = false;
         markerTargets[0].color = "#a3e635";
      } else {
         markerTargets[0].hidden = true;
      }

      // 2. Golden egg marker
      let goldenTarget: GroundEgg | null = null;
      for (let i = 0; i < run.groundEggs.length; i++) {
         const e = run.groundEggs[i];
         if (e.active && e.isGolden) {
            goldenTarget = e;
            break;
         }
      }
      if (goldenTarget) {
         markerTargets[1].x = goldenTarget.x;
         markerTargets[1].y = 0.25;
         markerTargets[1].z = goldenTarget.z;
         markerTargets[1].hidden = false;
         markerTargets[1].color = "#facc15";
      } else {
         markerTargets[1].hidden = true;
      }

      // 3. Nest marker (when carrying any egg)
      if (dino.carriedEggs.length > 0 || dino.carriedGolden) {
         markerTargets[2].x = NEST.x;
         markerTargets[2].y = 0.3;
         markerTargets[2].z = NEST.z;
         markerTargets[2].hidden = false;
         markerTargets[2].color = "#38bdf8";
      } else {
         markerTargets[2].hidden = true;
      }

      // 4 & 5. Boulder danger markers
      let bMarker = 3;
      for (let i = 0; i < run.boulders.length && bMarker < MARKER_COUNT; i++) {
         const b = run.boulders[i];
         if (b.active) {
            markerTargets[bMarker].x = b.x;
            markerTargets[bMarker].y = BOULDERS.radius;
            markerTargets[bMarker].z = b.z;
            markerTargets[bMarker].hidden = false;
            markerTargets[bMarker].color = "#ef4444";
            bMarker++;
         }
      }
      while (bMarker < MARKER_COUNT) {
         markerTargets[bMarker].hidden = true;
         bMarker++;
      }
   });

   return (
      <group name="dino-egg-rescue-scene">
         {/* CameraRig smoothly follows the baby dino at damping 4 */}
         <CameraRig
            camera={{ position: view.offset, lookAt: [0, 0, 0] }}
            follow={run.dino}
            bounds={VALLEY_BOUNDS}
            damping={4}
            followFraction={1}
            offset={view.offset}
            shift={view.shift}
         />

         {/* Valley Terrain, Mud, Trees, Nest, Volcano, 0.8 s lane telegraph */}
         <Valley telegraphLanes={run.laneTelegraph} />

         {/* Dino Baby Model */}
         <group ref={dinoGroupRef} position={[DINO.startX, 0, DINO.startZ]}>
            <Model asset={ASSETS.dino} fallback={<DinoPrimitive />} />

            {/* Egg stack on back anchored to DINO_BACK_TOP_ANCHOR with spring sway */}
            <group
               ref={carriedStackRef}
               position={[
                  DINO_BACK_TOP_ANCHOR.x,
                  DINO_BACK_TOP_ANCHOR.y,
                  DINO_BACK_TOP_ANCHOR.z,
               ]}
            >
               {/* Egg 1 */}
               <mesh
                  ref={carriedEgg1Ref}
                  position={[0, 0.12, 0]}
                  scale={[1, 1.33, 1]}
                  visible={false}
               >
                  <sphereGeometry args={[0.15, 14, 14]} />
                  <meshStandardMaterial
                     map={eggTexture}
                     color="#ffffff"
                     roughness={0.5}
                  />
               </mesh>
               {/* Egg 2 */}
               <mesh
                  ref={carriedEgg2Ref}
                  position={[0, 0.28, -0.06]}
                  scale={[1, 1.33, 1]}
                  visible={false}
               >
                  <sphereGeometry args={[0.14, 14, 14]} />
                  <meshStandardMaterial
                     map={eggTexture}
                     color="#ffffff"
                     roughness={0.5}
                  />
               </mesh>
               {/* Egg 3 */}
               <mesh
                  ref={carriedEgg3Ref}
                  position={[0, 0.42, -0.03]}
                  scale={[1, 1.33, 1]}
                  visible={false}
               >
                  <sphereGeometry args={[0.13, 14, 14]} />
                  <meshStandardMaterial
                     map={eggTexture}
                     color="#ffffff"
                     roughness={0.5}
                  />
               </mesh>
            </group>

            {/* Carried Golden Egg in mouth */}
            <group
               ref={carriedGoldenRef}
               position={[0, 0.55, 0.48]}
               visible={false}
            >
               <mesh scale={[1, 1.33, 1]}>
                  <sphereGeometry args={[0.16, 14, 14]} />
                  <meshStandardMaterial
                     color="#facc15"
                     emissive="#eab308"
                     emissiveIntensity={1.2}
                     roughness={0.2}
                     metalness={0.6}
                  />
               </mesh>
            </group>
         </group>

         {/* World Dash Cooldown Ring around Dino */}
         <mesh
            ref={dashRingRef}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[DINO.startX, 0.03, DINO.startZ]}
         >
            <ringGeometry args={[0.82, 0.9, 32]} />
            <meshStandardMaterial
               color="#38bdf8"
               emissive="#0284c7"
               emissiveIntensity={0.6}
               transparent
               opacity={0.7}
            />
         </mesh>

         {/* Stun Halo (stars ring above dino) */}
         <group
            ref={stunHaloRef}
            position={[DINO.startX, 1.05, DINO.startZ]}
            visible={false}
         >
            <mesh position={[0.3, 0, 0]}>
               <coneGeometry args={[0.08, 0.16, 6]} />
               <meshStandardMaterial color="#fde047" emissive="#eab308" />
            </mesh>
            <mesh position={[-0.3, 0, 0]}>
               <coneGeometry args={[0.08, 0.16, 6]} />
               <meshStandardMaterial color="#fde047" emissive="#eab308" />
            </mesh>
            <mesh position={[0, 0, 0.3]}>
               <coneGeometry args={[0.08, 0.16, 6]} />
               <meshStandardMaterial color="#fde047" emissive="#eab308" />
            </mesh>
            <mesh position={[0, 0, -0.3]}>
               <coneGeometry args={[0.08, 0.16, 6]} />
               <meshStandardMaterial color="#fde047" emissive="#eab308" />
            </mesh>
         </group>

         {/* Post-Stun Grace Halo (shield wireframe) */}
         <mesh
            ref={graceHaloRef}
            position={[DINO.startX, 0.45, DINO.startZ]}
            visible={false}
         >
            <sphereGeometry args={[0.85, 16, 16]} />
            <meshStandardMaterial
               color="#38bdf8"
               emissive="#38bdf8"
               emissiveIntensity={0.8}
               transparent
               opacity={0.35}
               wireframe
            />
         </mesh>

         {/* Boulders Dynamic Instanced Pool */}
         <DynamicInstancedModel
            asset={ASSETS.rock}
            count={MAX_BOULDERS}
            update={placeBoulder}
            fallbackParts={boulderParts}
            name="boulders"
         />

         {/* Regular Ground Eggs Fixed Pool */}
         {Array.from({ length: REGULAR_EGG_POOL }).map((_, i) => (
            <group
               key={i}
               ref={(el) => {
                  regularEggRefs.current[i] = el;
               }}
               visible={false}
            >
               {/* Ground Glow Disc (>= 24 CSS px) */}
               <mesh
                  position={[0, 0.015, 0]}
                  rotation={[-Math.PI / 2, 0, 0]}
               >
                  <circleGeometry args={[0.5, 20]} />
                  <meshStandardMaterial
                     color="#a3e635"
                     emissive="#65a30d"
                     emissiveIntensity={0.8}
                     transparent
                     opacity={0.55}
                  />
               </mesh>
               {/* 3D Spotted Egg */}
               <mesh position={[0, 0.18, 0]} scale={[1, 1.33, 1]}>
                  <sphereGeometry args={[0.15, 16, 16]} />
                  <meshStandardMaterial
                     map={eggTexture}
                     color="#ffffff"
                     roughness={0.5}
                  />
               </mesh>
            </group>
         ))}

         {/* Dedicated Golden Ground Egg */}
         <group ref={goldenEggRef} visible={false}>
            {/* Golden Ground Glow Disc (>= 24 CSS px) */}
            <mesh
               position={[0, 0.015, 0]}
               rotation={[-Math.PI / 2, 0, 0]}
            >
               <circleGeometry args={[0.6, 24]} />
               <meshStandardMaterial
                  color="#facc15"
                  emissive="#eab308"
                  emissiveIntensity={1.5}
                  transparent
                  opacity={0.65}
               />
            </mesh>
            {/* 3D Golden Egg */}
            <mesh position={[0, 0.22, 0]} scale={[1, 1.33, 1]}>
               <sphereGeometry args={[0.18, 16, 16]} />
               <meshStandardMaterial
                  color="#facc15"
                  emissive="#eab308"
                  emissiveIntensity={1.2}
                  roughness={0.2}
                  metalness={0.6}
               />
            </mesh>
         </group>

         {/* Screen Edge Target Markers */}
         <TargetMarkers targets={markerTargets} color="#a3e635" />
      </group>
   );
}
