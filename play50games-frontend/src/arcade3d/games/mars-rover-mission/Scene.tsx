"use client";

// Mars Rover Mission Scene.
// Integrates rover physics, instanced decor, beacons, rocks, and rolling boulders.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BoxGeometry,
   CylinderGeometry,
   DodecahedronGeometry,
   Euler,
   Matrix4,
   MeshStandardMaterial,
   Quaternion,
   SphereGeometry,
   Vector3,
   type Group,
   type Mesh,
} from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop } from "@/arcade3d/core/audio";
import CameraRig from "@/arcade3d/core/CameraRig";
import { SkyDome, Starfield } from "@/arcade3d/core/env";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { spring } from "@/arcade3d/core/motion";
import { DynamicInstanced, Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { HumanoidModel, cheerPose, idlePose, useHumanoidPose } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import type { MarsLevel } from "./levels";
import {
   COLORS,
   DAMPING,
   FOLLOW,
   FOV,
   LOOK_AHEAD,
   lookAtFor,
   perimeterWallSpots,
   plainBounds,
   viewFor,
} from "./looks";
import {
   AntennaPrimitive,
   AstronautFigure,
   BasePrimitive,
   BeaconPrimitive,
   CapsulePrimitive,
   ChargerPrimitive,
   CratePrimitive,
   RoverPrimitive,
   SampleRockPrimitive,
   SolarPanelPrimitive,
} from "./Primitives";
import {
   BASE_PAD_RADIUS,
   CHARGER_PAD_RADIUS,
   SITE_RING_RADIUS,
   createRun,
   step,
   type Run,
} from "./rules";

const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3(1, 1, 1);
const AT = { x: 0, y: 0.5, z: 0 };

function LevelScene() {
   const { id, config } = useLevel<MarsLevel>();
   const view = useFittedView(viewFor(id));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const [run] = useState<Run>(() => createRun(randomSeed(), config));

   const aim = useRef({ x: run.rover.x, y: 0.8, z: run.rover.z - LOOK_AHEAD }).current;
   const roverGroup = useRef<Group>(null);
   const roverBody = useRef<Group>(null);
   const engineSound = useRef<ReturnType<typeof startLoop> | null>(null);
   const puffAt = useRef(0);

   const bounds = useMemo(() => plainBounds(config), [config]);
   const look = useMemo(() => lookAtFor(config), [config]);
   const walls = useMemo(() => perimeterWallSpots(config), [config]);

   // Target markers (nearest unscanned site or base; plus charger when battery < 30)
   const markers = useMemo<MarkerTarget[]>(() => {
      return [
         { x: 0, y: 1.5, z: 0, color: COLORS.accent },
         { x: 0, y: 1.5, z: 0, color: "rgba(34, 197, 94, 0.75)", hidden: true },
      ];
   }, []);

   // Static spots for rocks
   const rockSpots = useMemo<InstanceSpot[]>(() => {
      return run.rocks.map((rock) => ({
         x: rock.x,
         y: 0,
         z: rock.z,
         sx: 1.5,
         sy: 1.5,
         sz: 1.5,
      }));
   }, [run.rocks]);

   // Static spots for beacons
   const beaconSpots = useMemo<InstanceSpot[]>(() => {
      return run.sites.map((site) => ({
         x: site.x,
         y: 0,
         z: site.z,
      }));
   }, [run.sites]);

   // Boulders dynamic instance parts (unit sphere)
   const boulderParts = useMemo<InstancePart[]>(() => {
      const geo = new SphereGeometry(0.85, 14, 10);
      geo.translate(0, 0.85, 0);
      const mat = new MeshStandardMaterial({ color: COLORS.boulder, roughness: 0.8 });
      return [{ geometry: geo, material: mat }];
   }, []);

   useEffect(() => () => {
      for (const p of boulderParts) {
         p.geometry.dispose();
         if (Array.isArray(p.material)) p.material.forEach((m) => m.dispose());
         else p.material.dispose();
      }
   }, [boulderParts]);

   // Warm up visual effects
   useEffect(() => {
      fx.warm("sparks", "smoke", "score");
   }, [fx]);

   // Engine audio loop
   useEffect(() => {
      const loop = startLoop("engine", { volume: 0 });
      engineSound.current = loop;
      return () => {
         loop.stop();
         engineSound.current = null;
      };
   }, []);

   // Astronaut pose: cheers on win, idle otherwise
   const astronautPose = useHumanoidPose((p) => {
      if (run.over === "win") cheerPose(time.now, p);
      else idlePose(time.now, p);
   });

   // Main simulation frame
   useRunFrame((_state, dt) => {
      const { moveX, moveY } = input.current;
      const store = useArcadeStore.getState();

      const ev = step(run, { moveX, moveY }, dt, store.timeLeftMs ?? 0);

      if (ev.score) store.addScore(ev.score);
      store.setStat("samples", run.samplesScanned);
      store.setStat("battery", Math.round(run.rover.battery));

      // Aim follow position along velocity/heading
      const forwardFactor = run.rover.speed >= -0.5 ? 1 : -0.5;
      aim.x = run.rover.x + Math.sin(run.rover.yaw) * LOOK_AHEAD * forwardFactor;
      aim.z = run.rover.z - Math.cos(run.rover.yaw) * LOOK_AHEAD * forwardFactor;
      aim.y = 0.8;
      aim.x = Math.min(bounds.max.x - 2, Math.max(bounds.min.x + 2, aim.x));
      aim.z = Math.min(bounds.max.z - 2, Math.max(bounds.min.z + 2, aim.z));

      // Sound and particle effects
      if (ev.lifeLost) store.loseLife();
      if (ev.won) store.end("win");
      if (ev.lost) store.end("lose");

      if (ev.rockHit) {
         playSfx("hit");
         AT.x = run.rover.x; AT.y = 0.5; AT.z = run.rover.z;
         fx.burst("smoke", AT, 8);
      }
      if (ev.boulderHit) {
         playSfx("boom");
         AT.x = run.rover.x; AT.y = 0.8; AT.z = run.rover.z;
         fx.burst("smoke", AT, 14);
      }
      if (ev.siteScanned >= 0) {
         playSfx("pickup");
         const site = run.sites[ev.siteScanned];
         AT.x = site.x; AT.y = 1.0; AT.z = site.z;
         fx.score(AT, ev.centerBonus ? "+180" : "+120");
         fx.burst("sparks", AT, 16);
      }
      if (ev.won) {
         playSfx("win");
         AT.x = run.basePad.x; AT.y = 1.0; AT.z = run.basePad.z;
         fx.burst("sparks", AT, 25);
      }
      if (ev.lost) {
         playSfx("lose");
      }

      // Wheel dust puffs when moving
      const speedAbs = Math.abs(run.rover.speed);
      if (speedAbs > 1.2 && time.now > puffAt.current + 0.15) {
         puffAt.current = time.now;
         AT.x = run.rover.x - Math.sin(run.rover.yaw) * 0.9;
         AT.y = 0.1;
         AT.z = run.rover.z + Math.cos(run.rover.yaw) * 0.9;
         fx.burst("smoke", AT, 3);
      }

      // Update engine audio pitch and volume
      if (engineSound.current) {
         const speedFraction = Math.min(1, speedAbs / 7);
         engineSound.current.set({
            volume: 0.15 + speedFraction * 0.35,
            pitch: 0.7 + speedFraction * 0.6,
         });
      }

      // Update TargetMarkers DOM pointers
      // Marker 0: nearest unscanned site or base pad
      let nearestDist = Infinity;
      let targetX = run.basePad.x;
      let targetZ = run.basePad.z;
      let targetColor: string = COLORS.basePadActive;

      if (run.samplesScanned < run.level.sites) {
         targetColor = COLORS.siteRing;
         for (const s of run.sites) {
            if (s.scanned) continue;
            const d = Math.hypot(run.rover.x - s.x, run.rover.z - s.z);
            if (d < nearestDist) {
               nearestDist = d;
               targetX = s.x;
               targetZ = s.z;
            }
         }
      }
      markers[0].x = targetX;
      markers[0].y = 1.5;
      markers[0].z = targetZ;
      markers[0].color = targetColor;
      markers[0].hidden = false;

      // Marker 1: nearest charger if battery < 30
      if (run.rover.battery < 30 && run.chargers.length > 0) {
         let nearestChDist = Infinity;
         let chX = run.chargers[0].x;
         let chZ = run.chargers[0].z;
         for (const ch of run.chargers) {
            const d = Math.hypot(run.rover.x - ch.x, run.rover.z - ch.z);
            if (d < nearestChDist) {
               nearestChDist = d;
               chX = ch.x;
               chZ = ch.z;
            }
         }
         markers[1].x = chX;
         markers[1].y = 1.5;
         markers[1].z = chZ;
         markers[1].hidden = false;
      } else {
         markers[1].hidden = true;
      }
   });

   // Visual updates (rover bobbing, suspension spring)
   useFrame(() => {
      if (roverGroup.current) {
         roverGroup.current.position.set(run.rover.x, 0, run.rover.z);
         roverGroup.current.rotation.y = run.rover.yaw;
      }
      if (roverBody.current) {
         const speed = Math.abs(run.rover.speed);
         // Spring suspension bob
         const bob = Math.sin(time.now * 12) * 0.02 * (speed / 7);
         roverBody.current.position.y = bob;
         // Slight pitch tilt when accelerating or braking
         roverBody.current.rotation.x = -run.rover.speed * 0.015;
      }
   });

   // Dynamic instance placement for boulders
   const placeBoulder = (i: number, matrix: Matrix4) => {
      const boulder = run.boulders[i];
      if (!boulder) {
         matrix.makeScale(0, 0, 0);
         return;
      }
      V.set(boulder.x, 0, boulder.z);
      // Roll rotation around X based on travelled Z
      const rollAngle = boulder.z / 0.85;
      E.set(rollAngle, 0, 0);
      Q.setFromEuler(E);
      matrix.compose(V, Q, S);
   };

   const isSpace = config.lighting === "space";

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

         {/* Sky and atmosphere */}
         {isSpace ? (
            <Starfield count={750} seed={43} />
         ) : (
            <SkyDome top={COLORS.skyTop} bottom={COLORS.skyBottom} />
         )}

         {/* Screen edge indicators */}
         <TargetMarkers targets={markers} />

         {/* Vast ground plain (no void at screen edges) */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
            <planeGeometry args={[config.width * 2.8, config.depth * 2.8]} />
            <meshStandardMaterial color={COLORS.ground} roughness={0.94} />
         </mesh>

         {/* Rover vehicle */}
         <group ref={roverGroup}>
            <group ref={roverBody}>
               <Model asset={ASSETS.rover} fallback={<RoverPrimitive />} />
               {/* Lifted sample rocks in rover tray */}
               {run.samplesScanned > 0 && (
                  <mesh position={[0, 0.9, 0.7]}>
                     <dodecahedronGeometry args={[0.22, 0]} />
                     <meshStandardMaterial color={COLORS.sampleGlow} emissive={COLORS.sampleGlow} emissiveIntensity={0.8} />
                  </mesh>
               )}
            </group>
         </group>

         {/* Base station pad and habitat */}
         <mesh rotation-x={-Math.PI / 2} position={[run.basePad.x, 0.015, run.basePad.z]}>
            <ringGeometry args={[BASE_PAD_RADIUS * 0.85, BASE_PAD_RADIUS, 32]} />
            <meshStandardMaterial
               color={run.samplesScanned === config.sites ? COLORS.basePadActive : COLORS.basePad}
               emissive={run.samplesScanned === config.sites ? COLORS.basePadActive : "#000000"}
               emissiveIntensity={run.samplesScanned === config.sites ? 0.8 : 0}
            />
         </mesh>
         <Model asset={ASSETS.base} position={[0, 0, run.basePad.z + 4.5]} fallback={<BasePrimitive />} />
         <Model asset={ASSETS.antenna} position={[-4.5, 0, run.basePad.z + 3.0]} fallback={<AntennaPrimitive />} />
         <Model asset={ASSETS.crate} position={[3.5, 0, run.basePad.z + 2.5]} fallback={<CratePrimitive />} />
         {id === 1 && (
            <Model asset={ASSETS.capsule} position={[5.5, 0, run.basePad.z - 2.5]} fallback={<CapsulePrimitive />} />
         )}

         {/* Astronaut standing near the base */}
         <group position={[2.2, 0, run.basePad.z + 1.2]} rotation-y={-Math.PI * 0.8}>
            <HumanoidModel asset={ASSETS.astronaut} pose={astronautPose} fallback={<AstronautFigure />} />
         </group>

         {/* Scan site rings and floating sample rocks */}
         {run.sites.map((site) => {
            const isScanned = site.scanned;
            return (
               <group key={`site-${site.index}`} position={[site.x, 0, site.z]}>
                  {/* Ground scan ring */}
                  <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
                     <ringGeometry args={[SITE_RING_RADIUS - 0.25, SITE_RING_RADIUS, 32]} />
                     <meshStandardMaterial
                        color={isScanned ? COLORS.siteRingScanned : site.holdTime > 0 ? COLORS.siteRingActive : COLORS.siteRing}
                        emissive={isScanned ? COLORS.siteRingScanned : COLORS.siteRing}
                        emissiveIntensity={site.holdTime > 0 ? 0.9 : 0.4}
                     />
                  </mesh>
                  {/* Unscanned sample rock floating in ring */}
                  {!isScanned && (
                     <mesh position={[0, 0.4 + Math.sin(time.now * 3 + site.index) * 0.08, 0]}>
                        <dodecahedronGeometry args={[0.3, 0]} />
                        <meshStandardMaterial color={COLORS.sampleGlow} emissive={COLORS.sampleGlow} emissiveIntensity={0.8} />
                     </mesh>
                  )}
               </group>
            );
         })}

         {/* Beacons instanced at sites */}
         <Instanced spots={beaconSpots} name="site-beacons">
            <cylinderGeometry args={[0.08, 0.1, 4.0, 8]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.4} />
         </Instanced>

         {/* Chargers: pad + solar panel dressing */}
         {run.chargers.map((ch) => (
            <group key={`charger-${ch.index}`} position={[ch.x, 0, ch.z]}>
               <mesh rotation-x={-Math.PI / 2} position-y={0.018}>
                  <ringGeometry args={[CHARGER_PAD_RADIUS - 0.3, CHARGER_PAD_RADIUS, 28]} />
                  <meshStandardMaterial
                     color={COLORS.chargerPad}
                     emissive={COLORS.chargerPad}
                     emissiveIntensity={run.charging ? 0.9 : 0.4}
                  />
               </mesh>
               <Model asset={ASSETS.charger} position={[0, 0, 0]} fallback={<ChargerPrimitive />} />
               <Model asset={ASSETS.solarPanel} position={[2.8, 0, 0]} fallback={<SolarPanelPrimitive />} />
            </group>
         ))}

         {/* Instanced rocks */}
         <InstancedModel
            asset={ASSETS.sampleRock}
            spots={rockSpots}
            fallback={
               <Instanced spots={rockSpots} name="rocks">
                  <dodecahedronGeometry args={[0.95, 1]} />
                  <meshStandardMaterial color={COLORS.rock} roughness={0.85} />
               </Instanced>
            }
         />

         {/* Rolling boulders (L3+) */}
         {run.boulders.length > 0 && (
            <DynamicInstanced count={run.boulders.length} update={placeBoulder} parts={boulderParts} name="boulders" />
         )}

         {/* Perimeter boundary mesa wall */}
         <Instanced spots={walls} name="boundary-walls">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.mesa} roughness={0.88} />
         </Instanced>
      </>
   );
}

export default function Scene() {
   return <LevelScene />;
}
