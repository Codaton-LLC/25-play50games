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
import { DynamicInstancedModel, Model, assetScale } from "@/arcade3d/core/assets";
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import { SkyDome } from "@/arcade3d/core/env";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { spring, squashStretch, type SpringState } from "@/arcade3d/core/motion";
import { QuadrupedModel, useQuadrupedPose } from "@/arcade3d/core/rig/QuadrupedModel";
import { blendQuadrupedPoses, createQuadrupedPose, quadrupedCrouch, quadrupedGait, quadrupedIdle, quadrupedPhaseStep } from "@/arcade3d/core/rig/quadrupedPoses";
import { useCanvasTexture } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import type { AABB } from "@/arcade3d/core/collision";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, DINO_BACK_TOP_ANCHOR } from "./assets";
import { VALLEY_BOUNDS, viewFor } from "./camera";
import { Decor } from "./Decor";
import { COLORS, THEME_LOOKS } from "./looks";
import { DINO_GAIT, DINO_GAIT_OPTIONS, DINO_LANDMARKS, DINO_SCALE as DINO_GLB_SCALE, dinoGait } from "./dinoGait";
import { DinoPrimitive, useBoulderParts } from "./Primitives";
import { useDinoLevel } from "./useDinoLevel";
import {
   BOULDERS,
   DINO,
   EGGS,
   createDinoRun,
   obstacleDistance,
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
/** metres per GLB unit up the dino (its fit stretches y): the rig's trunk lift moves the egg stack by this */
const DINO_Y_SCALE = assetScale(ASSETS.dino)[1];
const smooth01 = (a: number, b: number, x: number) => {
   const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
   return t * t * (3 - 2 * t);
};
const COLOR_READY = new Color(COLORS.dashReady);
const COLOR_COOLDOWN = new Color(COLORS.dashCooldown);

export default function Scene() {
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const view = useFittedView(viewFor(width, height));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const { config } = useDinoLevel();

   const [preferences] = useState(() => ({
      coarse: typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
      reduced: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
   }));

   // Pure deterministic run state, a fresh seed per run (the Scene remounts per runId, so the
   // level config captured here is the one the player picked).
   const [run] = useState<DinoRunState>(() => createDinoRun(randomSeed(), config));

   // camera views (core/camera): the rules get the drawn camera's yaw (the fitted yaw in the default view)
   const cam = useCameraViews({
      slug: "dino-egg-rescue",
      subject: "character",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         const d = run.dino;
         o.x = d.x; o.y = 0.5; o.z = d.z; o.heading = d.heading; o.vx = d.vx; o.vz = d.vz;
      },
      // the trees' crowns, the pines and the basalt spires block the chase, front and free cameras
      solids: (out: AABB[]) => {
         let n = 0;
         for (const t of run.map.obstacles) {
            if (n >= out.length) break;
            if (t.kind !== "tree" && t.kind !== "pine" && t.kind !== "spire") continue;
            const half = t.kind === "spire" ? t.r + 0.3 : 1.3;
            const o = out[n++];
            o.min.x = t.ax - half; o.min.y = 0.3; o.min.z = t.az - half;
            o.max.x = t.ax + half; o.max.y = t.kind === "spire" ? 2.6 * (t.r / 0.7) : 4; o.max.z = t.az + half;
         }
         return n;
      },
      framing: { chase: { distance: 5 }, front: { distance: 4 }, free: { distance: 6 } },
   });


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
      vents: [0, 0, 0, 0, 0, 0] as number[],
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
      ctx.fillStyle = COLORS.eggShell;
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = COLORS.eggSpots;
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
         arr.push({ x: 0, y: 0, z: 0, hidden: true, color: COLORS.eggGlow });
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
   const carriedEgg4Ref = useRef<Mesh>(null);
   const carriedGoldenRef = useRef<Group>(null);

   // The dino's gait on the core quadruped rig (dinoGait.ts): a diagonal walk in deep mud, a trot at a
   // jog, a bounding gallop at full speed; the phase advances by the distance really moved over the
   // stride (planted feet), idle breathing when still, the head and tail turning into a turn, a crouch
   // while stunned.
   const [gait] = useState(() => ({ phase: 0, s01: 0, turn: 0, heading: run.map.startFacing, lastX: run.map.nest.x, lastZ: run.map.nest.z, stun: 0, gait: createQuadrupedPose(), idle: createQuadrupedPose() }));
   const pose = useQuadrupedPose((out) => {
      const d = run.dino;
      const dt = time.delta;
      const moved = Math.hypot(d.x - gait.lastX, d.z - gait.lastZ);
      gait.lastX = d.x;
      gait.lastZ = d.z;
      const speed = Math.hypot(d.vx, d.vz);
      gait.s01 += (dinoGait(speed).speed01 - gait.s01) * (1 - Math.exp(-12 * dt));
      gait.phase = quadrupedPhaseStep(gait.phase, moved < 1 ? moved : 0, Math.max(0.02, gait.s01), DINO_LANDMARKS, DINO_GLB_SCALE, dt, DINO_GAIT.maxHz);
      let dyaw = (d.heading - gait.heading) % (2 * Math.PI);
      if (dyaw > Math.PI) dyaw -= 2 * Math.PI;
      if (dyaw < -Math.PI) dyaw += 2 * Math.PI;
      gait.heading = d.heading;
      const turnRate = dt > 0 ? dyaw / dt : 0;
      gait.turn += (Math.max(-1, Math.min(1, turnRate / 6)) - gait.turn) * (1 - Math.exp(-8 * dt));
      quadrupedGait(gait.phase, gait.s01, DINO_LANDMARKS, gait.gait, gait.turn, DINO_GAIT_OPTIONS);
      quadrupedIdle(time.now, DINO_LANDMARKS, gait.idle);
      blendQuadrupedPoses(gait.idle, gait.gait, smooth01(0.05, 0.6, speed), out);
      gait.stun += ((d.stunTimer > 0 ? 1 : 0) - gait.stun) * (1 - Math.exp(-dt / 0.06));
      if (gait.stun > 0.01) quadrupedCrouch(0.06 * gait.stun, 0.3 * gait.stun, DINO_LANDMARKS, out);
   });

   // Fixed pool of ground egg groups
   const regularEggRefs = useRef<(Group | null)[]>([]);
   const goldenEggRef = useRef<Group | null>(null);

   // 1. ONE useRunFrame driving rules and store updates on the run clock
   useRunFrame((_state, dt) => {
      const { moveX, moveY, jumpPressed, actionPressed } = input.current;
      const { stepInp, dir } = scratch;

      inputToWorld(moveX, moveY, cam.yaw(), dir);
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

      // Sound & particle feedback (juicy prehistoric feel)
      if (events.dashStarted) {
         playSfx("whoosh", { pitch: 1.1 });
         SCRATCH_POS.set(run.dino.x, 0.4, run.dino.z);
         fx.burst("puff", SCRATCH_POS, 14);
      }
      if (events.footstep) {
         playSfx("thud", { volume: 0.35, pitch: 1.3 });
         // Cute little dust puff on dino stomp
         SCRATCH_POS.set(run.dino.x, 0.05, run.dino.z);
         fx.burst("puff", SCRATCH_POS, 4);
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
      // a vent bursting into an eruption
      for (let i = 0; i < run.ventStates.length; i++) {
         const now = run.ventStates[i];
         if (now === 2 && scratch.vents[i] !== 2) {
            const v = run.map.vents[i];
            SCRATCH_POS.set(v.x, 0.6, v.z);
            fx.burst(run.map.theme === "volcano" ? "debris" : "puff", SCRATCH_POS, 18);
         }
         scratch.vents[i] = now;
      }
      if (events.eggDelivered) {
         const pts = events.eggDelivered.points;
         const pitch = 1.0 + events.eggDelivered.regularCount * 0.2;
         playSfx("chime", { pitch });
         SCRATCH_POS.set(run.map.nest.x, 1.2, run.map.nest.z);
         fx.score(SCRATCH_POS, `+${pts}`, { color: COLORS.goldenEgg });
         fx.burst("sparkle", SCRATCH_POS, 28);
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
         // a dash over a fallen log is a little hop
         let hop = 0;
         if (dino.dashTimer > 0) {
            for (const o of run.map.obstacles) {
               if (o.low && obstacleDistance(dino.x, dino.z, o) < 0.9) {
                  hop = 0.45 * Math.sin((Math.PI * (DINO.dashDuration - dino.dashTimer)) / DINO.dashDuration);
                  break;
               }
            }
         }
         dinoGroupRef.current.position.set(dino.x, hop, dino.z);
         dinoGroupRef.current.rotation.y = dino.heading;

         // the legs, head and tail walk on the rig (pose above); the dash still squashes the whole body
         if (dino.dashTimer > 0) {
            squashStretch(0.85, DINO_SCALE);
            dinoGroupRef.current.scale.set(DINO_SCALE.x, DINO_SCALE.y, DINO_SCALE.z);
         } else {
            dinoGroupRef.current.scale.set(1, 1, 1);
         }
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
         // the eggs ride the back: it dips and bobs with the rig's trunk
         carriedStackRef.current.position.y = DINO_BACK_TOP_ANCHOR.y + pose.lift * DINO_Y_SCALE;

         const carriedCount = dino.carriedEggs.length;
         if (carriedEgg1Ref.current) carriedEgg1Ref.current.visible = carriedCount >= 1;
         if (carriedEgg2Ref.current) carriedEgg2Ref.current.visible = carriedCount >= 2;
         if (carriedEgg3Ref.current) carriedEgg3Ref.current.visible = carriedCount >= 3;
         if (carriedEgg4Ref.current) carriedEgg4Ref.current.visible = carriedCount >= 4;
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
      if (dino.carriedEggs.length < run.level.maxStack) {
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
         markerTargets[0].color = COLORS.eggGlow;
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
         markerTargets[1].color = COLORS.goldenEgg;
      } else {
         markerTargets[1].hidden = true;
      }

      // 3. Nest marker (when carrying any egg)
      if (dino.carriedEggs.length > 0 || dino.carriedGolden) {
         markerTargets[2].x = run.map.nest.x;
         markerTargets[2].y = 0.3;
         markerTargets[2].z = run.map.nest.z;
         markerTargets[2].hidden = false;
         markerTargets[2].color = COLORS.dashReady;
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
            markerTargets[bMarker].color = COLORS.telegraphWarn;
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
         {/* SkyDome gradient: deep sunset twilight into glowing orange horizon */}
         <SkyDome
            top={THEME_LOOKS[run.map.theme].skyTop}
            bottom={THEME_LOOKS[run.map.theme].skyBottom}
            exponent={0.7}
            offset={0.05}
         />

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
         <Valley telegraphLanes={run.laneTelegraph} ventStates={run.ventStates} />

         {/* Prehistoric Jungle Surroundings Decor outside play bounds */}
         <Decor reduced={preferences.reduced} />

         {/* Dino Baby Model */}
         <group ref={dinoGroupRef} position={[run.map.nest.x, 0, run.map.nest.z]}>
            <QuadrupedModel asset={ASSETS.dino} pose={pose} fallback={<DinoPrimitive />} />

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
               {/* Egg 4 — level 5 only; hidden while the stack is 3 or less */}
               <mesh
                  ref={carriedEgg4Ref}
                  position={[0.1, 0.54, 0.02]}
                  scale={[1, 1.33, 1]}
                  visible={false}
               >
                  <sphereGeometry args={[0.12, 14, 14]} />
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
                     color={COLORS.goldenEgg}
                     emissive={COLORS.goldenEggCore}
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
            position={[run.map.nest.x, 0.03, run.map.nest.z]}
         >
            <ringGeometry args={[0.82, 0.9, 32]} />
            <meshStandardMaterial
               color={COLORS.dashReady}
               emissive={COLORS.dashReady}
               emissiveIntensity={0.6}
               transparent
               opacity={0.7}
            />
         </mesh>

         {/* Stun Halo (stars ring above dino) */}
         <group
            ref={stunHaloRef}
            position={[run.map.nest.x, 1.05, run.map.nest.z]}
            visible={false}
         >
            <mesh position={[0.3, 0, 0]}>
               <coneGeometry args={[0.08, 0.16, 6]} />
               <meshStandardMaterial
                  color={COLORS.stunStar}
                  emissive={COLORS.goldenEggCore}
               />
            </mesh>
            <mesh position={[-0.3, 0, 0]}>
               <coneGeometry args={[0.08, 0.16, 6]} />
               <meshStandardMaterial
                  color={COLORS.stunStar}
                  emissive={COLORS.goldenEggCore}
               />
            </mesh>
            <mesh position={[0, 0, 0.3]}>
               <coneGeometry args={[0.08, 0.16, 6]} />
               <meshStandardMaterial
                  color={COLORS.stunStar}
                  emissive={COLORS.goldenEggCore}
               />
            </mesh>
            <mesh position={[0, 0, -0.3]}>
               <coneGeometry args={[0.08, 0.16, 6]} />
               <meshStandardMaterial
                  color={COLORS.stunStar}
                  emissive={COLORS.goldenEggCore}
               />
            </mesh>
         </group>

         {/* Post-Stun Grace Halo (shield wireframe) */}
         <mesh
            ref={graceHaloRef}
            position={[run.map.nest.x, 0.45, run.map.nest.z]}
            visible={false}
         >
            <sphereGeometry args={[0.85, 16, 16]} />
            <meshStandardMaterial
               color={COLORS.graceShield}
               emissive={COLORS.graceShield}
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
                  <circleGeometry args={[EGGS.pickupRadius, 20]} />
                  <meshStandardMaterial
                     color={COLORS.eggGlow}
                     emissive={COLORS.eggGlowCore}
                     emissiveIntensity={0.8}
                     transparent
                     opacity={0.55}
                  />
               </mesh>
               {/* 3D Spotted Egg (Hyper3D dinoEgg; the code egg is the fallback) */}
               <Model
                  asset={ASSETS.dinoEgg}
                  fallback={
                     <mesh position={[0, 0.18, 0]} scale={[1, 1.33, 1]}>
                        <sphereGeometry args={[0.15, 16, 16]} />
                        <meshStandardMaterial map={eggTexture} color="#ffffff" roughness={0.5} />
                     </mesh>
                  }
               />
            </group>
         ))}

         {/* Dedicated Golden Ground Egg */}
         <group ref={goldenEggRef} visible={false}>
            {/* Golden Ground Glow Disc (>= 24 CSS px) */}
            <mesh
               position={[0, 0.015, 0]}
               rotation={[-Math.PI / 2, 0, 0]}
            >
               <circleGeometry args={[EGGS.goldenPickupRadius, 24]} />
               <meshStandardMaterial
                  color={COLORS.goldenEgg}
                  emissive={COLORS.goldenEggCore}
                  emissiveIntensity={1.5}
                  transparent
                  opacity={0.65}
               />
            </mesh>
            {/* 3D Golden Egg (the dino egg in gold; the code egg is the fallback) */}
            <Model
               asset={ASSETS.goldenEgg}
               fallback={
                  <mesh position={[0, 0.22, 0]} scale={[1, 1.33, 1]}>
                     <sphereGeometry args={[0.18, 16, 16]} />
                     <meshStandardMaterial
                        color={COLORS.goldenEgg}
                        emissive={COLORS.goldenEggCore}
                        emissiveIntensity={1.2}
                        roughness={0.2}
                        metalness={0.6}
                     />
                  </mesh>
               }
            />
         </group>

         {/* Screen Edge Target Markers */}
         <TargetMarkers targets={markerTargets} color={COLORS.eggGlow} />
      </group>
   );
}
