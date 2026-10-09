"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
   Group,
   Matrix4,
   Mesh,
   Quaternion,
   Vector3,
} from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop, useMuted } from "@/arcade3d/core/audio";
import CameraRig from "@/arcade3d/core/CameraRig";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud/TargetMarkers";
import { inputToWorld } from "@/arcade3d/core/math";
import { squashStretch, waddle, type BodyOffset } from "@/arcade3d/core/motion";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useInput } from "@/arcade3d/core/input";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { randomSeed } from "@/arcade3d/core/math";
import { ASSETS, DINO_BACK_TOP_ANCHOR } from "./assets";
import {
   FOV,
   FOLLOW_FOCUS_POINTS,
   PITCH,
   PLAY_AREA,
   VALLEY_BOUNDS,
   YAWS,
} from "./camera";
import { BoulderPrimitive, DinoPrimitive, useBoulderParts } from "./Primitives";
import {
   BOULDERS,
   DINO,
   NEST,
   createDinoRun,
   stepDinoRun,
   type StepInput,
} from "./rules";
import { Valley } from "./Valley";

const MAX_BOULDERS = 12;
const MAX_GROUND_EGGS = 16;
const MARKER_COUNT = 10;

// Module-level reusable scratch objects (zero frame allocation)
const SCRATCH_POS = new Vector3();
const SCRATCH_AXIS = new Vector3();
const SCRATCH_QUAT = new Quaternion();
const SCRATCH_SCALE = new Vector3(1, 1, 1);
const SCRATCH_INPUT = { x: 0, z: 0 };
const DINO_OFFSET: BodyOffset = { y: 0, roll: 0, yaw: 0, squash: 1 };
const DINO_SCALE = { x: 1, y: 1, z: 1 };

export default function DinoEggRescueScene() {
   const [seed] = useState(randomSeed);
   const [run] = useState(() => createDinoRun(seed));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();

   const phase = useArcadeStore((s) => s.phase);
   const muted = useMuted();

   // Camera fit
   const view = useFittedView({
      area: PLAY_AREA,
      pitch: PITCH,
      yaws: YAWS,
      focus: FOLLOW_FOCUS_POINTS,
      shift: true,
      fov: FOV,
   });

   // Fallback parts for boulder dynamic instancing
   const boulderParts = useBoulderParts();

   // Fx warming
   useEffect(() => {
      fx.warm("sparkle", "puff", "debris", "score");
   }, [fx]);

   // Boulder rumble ambient loop
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const loop = startLoop("hum", { pitch: 0.6, volume: 0.25 });
      return () => {
         loop.stop();
      };
   }, [phase, muted]);

   // TargetMarkers fixed targets array
   const markerTargets = useMemo<MarkerTarget[]>(() => {
      const arr: MarkerTarget[] = [];
      for (let i = 0; i < MARKER_COUNT; i++) {
         arr.push({ x: 0, y: 0, z: 0, hidden: true, color: "#a3e635" });
      }
      return arr;
   }, []);

   // Refs for live visual groups
   const dinoGroupRef = useRef<Group>(null);
   const dashRingRef = useRef<Mesh>(null);
   const stunHaloRef = useRef<Group>(null);
   const graceHaloRef = useRef<Mesh>(null);
   const carriedStackRef = useRef<Group>(null);
   const carriedGoldenRef = useRef<Group>(null);

   // 1. One useRunFrame driving rules and store updates
   useFrame((_state, delta) => {
      if (phase !== "playing") return;
      // Cap timestep
      const dt = Math.min(1 / 20, Math.max(0.001, delta));

      const { moveX, moveY, jumpPressed, actionPressed } = input.current;
      inputToWorld(moveX, moveY, view.yaw, SCRATCH_INPUT);

      const stepInp: StepInput = {
         moveX: SCRATCH_INPUT.x,
         moveY: SCRATCH_INPUT.z,
         actionPressed: !!actionPressed,
         jumpPressed: !!jumpPressed,
      };

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
         playSfx("hit", { pitch: 0.85 });
         SCRATCH_POS.set(run.dino.x, 0.6, run.dino.z);
         fx.burst("debris", SCRATCH_POS, 20);
         fx.shake(0.2);
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

   // 3. Visual animation frame (waddle, spring, rings, markers)
   useFrame(() => {
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
         const mat = dashRingRef.current.material as any;
         if (mat) {
            mat.opacity = ready ? 0.75 : 0.25;
            mat.color.set(ready ? "#38bdf8" : "#94a3b8");
         }
      }

      // Stun halo
      if (stunHaloRef.current) {
         const stunned = dino.stunTimer > 0;
         stunHaloRef.current.visible = stunned;
         if (stunned) {
            stunHaloRef.current.position.set(dino.x, 1.05, dino.z);
            stunHaloRef.current.rotation.y = time.now * 6;
         }
      }

      // Grace halo
      if (graceHaloRef.current) {
         const inGrace = dino.graceTimer > 0;
         graceHaloRef.current.visible = inGrace;
         if (inGrace) {
            graceHaloRef.current.position.set(dino.x, 0.45, dino.z);
            const blink = Math.sin(time.now * 16) > 0;
            graceHaloRef.current.visible = blink;
         }
      }

      // Carried regular eggs stack visibility
      if (carriedStackRef.current) {
         const count = dino.carriedEggs.length;
         for (let i = 0; i < 3; i++) {
            const child = carriedStackRef.current.children[i];
            if (child) child.visible = i < count;
         }
      }

      // Carried golden egg visibility
      if (carriedGoldenRef.current) {
         carriedGoldenRef.current.visible = dino.carriedGolden;
      }

      // Update TargetMarkers
      // Marker 0: Nest (shows when carrying eggs)
      const nestMarker = markerTargets[0];
      if (nestMarker) {
         nestMarker.x = NEST.x;
         nestMarker.y = 0.5;
         nestMarker.z = NEST.z;
         nestMarker.color = "#facc15";
         nestMarker.hidden =
            dino.carriedEggs.length === 0 && !dino.carriedGolden;
      }

      // Markers 1..4: Nearest eggs when space available
      let markerIdx = 1;
      const canCarry = dino.carriedEggs.length < 3;
      for (const egg of run.groundEggs) {
         if (markerIdx >= MARKER_COUNT - 3) break;
         const target = markerTargets[markerIdx];
         if (target) {
            target.x = egg.x;
            target.y = 0.3;
            target.z = egg.z;
            target.color = egg.isGolden ? "#fbbf24" : "#a3e635";
            target.hidden = !egg.active || (!canCarry && !egg.isGolden);
            markerIdx++;
         }
      }

      // Hide remaining markers
      for (let i = markerIdx; i < MARKER_COUNT; i++) {
         const target = markerTargets[i];
         if (target) target.hidden = true;
      }
   });

   return (
      <group name="dino-egg-rescue-scene">
         {/* Follow Camera */}
         <CameraRig
            camera={{ position: [0, 16, 13.4], fov: FOV }}
            follow={{ x: run.dino.x, y: 0, z: run.dino.z }}
            bounds={VALLEY_BOUNDS}
            damping={4}
            followFraction={1}
            offset={view.offset}
            shift={view.shift}
         />

         {/* Valley Terrain, Mud, Trees, Nest, Volcano */}
         <Valley />

         {/* Dino Baby Model */}
         <group ref={dinoGroupRef} position={[DINO.startX, 0, DINO.startZ]}>
            <Model asset={ASSETS.dino} fallback={<DinoPrimitive />} />

            {/* Egg stack on back anchored to DINO_BACK_TOP_ANCHOR */}
            <group
               ref={carriedStackRef}
               position={[
                  DINO_BACK_TOP_ANCHOR.x,
                  DINO_BACK_TOP_ANCHOR.y,
                  DINO_BACK_TOP_ANCHOR.z,
               ]}
            >
               {/* Egg 1 */}
               <mesh position={[0, 0.12, 0]}>
                  <sphereGeometry args={[0.18, 12, 12]} />
                  <meshStandardMaterial color="#fef08a" roughness={0.5} />
               </mesh>
               {/* Egg 2 */}
               <mesh position={[0, 0.28, -0.06]}>
                  <sphereGeometry args={[0.16, 12, 12]} />
                  <meshStandardMaterial color="#fef08a" roughness={0.5} />
               </mesh>
               {/* Egg 3 */}
               <mesh position={[0, 0.42, -0.03]}>
                  <sphereGeometry args={[0.14, 12, 12]} />
                  <meshStandardMaterial color="#fef08a" roughness={0.5} />
               </mesh>
            </group>

            {/* Carried Golden Egg in mouth/front */}
            <group
               ref={carriedGoldenRef}
               position={[0, 0.55, 0.48]}
               visible={false}
            >
               <mesh>
                  <sphereGeometry args={[0.18, 14, 14]} />
                  <meshStandardMaterial
                     color="#facc15"
                     emissive="#eab308"
                     emissiveIntensity={1.2}
                     roughness={0.2}
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

         {/* Post-Stun Grace Halo (shield ring) */}
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
               opacity={0.3}
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

         {/* Ground Eggs with >= 24 px readability discs */}
         {run.groundEggs.map((egg) => {
            if (!egg.active) return null;
            return (
               <group key={egg.id} position={[egg.x, 0, egg.z]}>
                  {/* Ground Glow Disc */}
                  <mesh
                     position={[0, 0.015, 0]}
                     rotation={[-Math.PI / 2, 0, 0]}
                  >
                     <circleGeometry
                        args={[egg.isGolden ? 0.6 : 0.5, 20]}
                     />
                     <meshStandardMaterial
                        color={egg.isGolden ? "#facc15" : "#a3e635"}
                        emissive={egg.isGolden ? "#eab308" : "#65a30d"}
                        emissiveIntensity={egg.isGolden ? 1.5 : 0.8}
                        transparent
                        opacity={0.55}
                     />
                  </mesh>

                  {/* 3D Egg Geometry */}
                  <mesh position={[0, egg.isGolden ? 0.2 : 0.16, 0]}>
                     <sphereGeometry
                        args={[
                           egg.isGolden ? 0.2 : 0.16,
                           14,
                           14,
                        ]}
                     />
                     <meshStandardMaterial
                        color={egg.isGolden ? "#facc15" : "#fef08a"}
                        emissive={egg.isGolden ? "#ca8a04" : "#000000"}
                        emissiveIntensity={egg.isGolden ? 1.0 : 0}
                        roughness={egg.isGolden ? 0.2 : 0.6}
                     />
                  </mesh>
               </group>
            );
         })}

         {/* Screen Edge Target Markers */}
         <TargetMarkers targets={markerTargets} color="#a3e635" />
      </group>
   );
}
