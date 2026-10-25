"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import { SkyDome } from "@/arcade3d/core/env";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useLevel } from "@/arcade3d/core/level";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { bank, hover, type BodyOffset } from "@/arcade3d/core/motion";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView, type FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import { LEVELS, type BeeLevel } from "./levels";
import { COLORS, LEVEL_LOOKS } from "./looks";
import {
   BeehivePrimitive,
   BeePrimitive,
   BranchPrimitive,
   FlowerPrimitive,
   PlanterPrimitive,
   WateringCanPrimitive,
   WebPrimitive,
} from "./Primitives";
import { createRun, stepRun, type Flower, type RunState } from "./rules";

export default function Scene() {
   const { id: levelId, config: levelConfig } = useLevel<BeeLevel>();
   const level = levelConfig ?? LEVELS[1];
   const looks = LEVEL_LOOKS[levelId ?? 1] ?? LEVEL_LOOKS[1];
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const input = useInput();
   const fx = useFx();

   // Fresh seeded run state per Scene mount
   const [run] = useState<RunState>(() => createRun(randomSeed(), level, levelId ?? 1));

   const halfX = level.width / 2;
   const halfZ = level.depth / 2;

   const bounds = useMemo(
      () => ({
         min: { x: -halfX, y: 0, z: -halfZ },
         max: { x: halfX, y: 2.5, z: halfZ },
      }),
      [halfX, halfZ]
   );

   const viewOptions = useMemo<FittedViewOptions>(
      () => ({
         area: bounds,
         pitch: 55 * (Math.PI / 180),
         yaws: [0],
         margin: { top: 0.1, bottom: 0.08, left: 0.04, right: 0.04 },
         padding: 4,
         shift: true,
      }),
      [bounds]
   );

   const view = useFittedView(viewOptions);

   const beeGroupRef = useRef<Group>(null);
   const humRef = useRef<LoopHandle | null>(null);
   const bodyOffsetRef = useRef<BodyOffset>({ y: 0, roll: 0, yaw: 0, squash: 1 });
   const dirOutRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

   const markersRef = useRef<MarkerTarget[]>([
      { x: run.hive.x, y: 1.15, z: run.hive.z, hidden: true, color: COLORS.hive },
      { x: 0, y: 1.15, z: 0, hidden: true, color: COLORS.nectar },
   ]);

   // Audio hum loop during play
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      humRef.current = startLoop("hum", { volume: 0.22, pitch: 1.0 });
      return () => {
         humRef.current?.stop();
         humRef.current = null;
      };
   }, [phase, muted]);

   useEffect(() => {
      fx.warm("sparkle", "puff", "confetti", "score");
   }, [fx]);

   // Main gameplay loop (counted in play-time dt)
   useRunFrame((_state, dt) => {
      const { moveX, moveY, jump } = input.current;

      inputToWorld(moveX, moveY, view.yaw, dirOutRef.current);

      stepRun(
         run,
         {
            dirX: dirOutRef.current.x,
            dirZ: dirOutRef.current.z,
            jump,
         },
         dt,
         useArcadeStore
      );

      // Pitch hum with boost
      humRef.current?.set({
         pitch: run.boosting ? 1.45 : 1.0,
         volume: 0.22,
      });

      // Handle event effects
      for (const ev of run.events) {
         if (ev === "pickup") {
            playSfx("pickup", { volume: 0.35 });
            fx.burst("sparkle", { x: run.bee.x, y: run.bee.y, z: run.bee.z }, 14);
         } else if (ev === "deposit") {
            playSfx("chime", { volume: 0.5 });
            fx.burst("sparkle", { x: run.hive.x, y: 1.8, z: run.hive.z }, 20);
            fx.score({ x: run.hive.x, y: 2.2, z: run.hive.z }, `+${run.score}`, {
               color: COLORS.accent,
               size: 0.08,
            });
         } else if (ev === "web_hit") {
            playSfx("hit", { volume: 0.4 });
            fx.shake(0.35);
            fx.burst("puff", { x: run.bee.x, y: run.bee.y, z: run.bee.z }, 16);
         } else if (ev === "win") {
            playSfx("win");
            fx.burst("confetti", { x: run.hive.x, y: 2.5, z: run.hive.z }, 32);
         }
      }
   });

   // Frame animation: bee bob, bank, target markers
   useFrame(() => {
      const { now } = useGameTime();
      hover(now * 3.5, 0.07, bodyOffsetRef.current);
      const roll = bank(run.bee.lateralAccel, 0.35) + bodyOffsetRef.current.roll;

      if (beeGroupRef.current) {
         beeGroupRef.current.position.set(
            run.bee.x,
            run.bee.y + bodyOffsetRef.current.y,
            run.bee.z
         );
         beeGroupRef.current.rotation.set(0, run.bee.heading, roll);
      }

      // Target markers: hive when carrying nectar, nearest flower when empty
      const hiveMarker = markersRef.current[0];
      const flowerMarker = markersRef.current[1];

      if (run.carried.length > 0) {
         hiveMarker.hidden = false;
         flowerMarker.hidden = true;
      } else {
         hiveMarker.hidden = true;
         let nearestFlower: Flower | null = null;
         let nearestDist = Infinity;
         for (const flower of run.flowers) {
            if (flower.hasNectar) {
               const dist = Math.hypot(flower.x - run.bee.x, flower.z - run.bee.z);
               if (dist < nearestDist) {
                  nearestDist = dist;
                  nearestFlower = flower;
               }
            }
         }
         if (nearestFlower) {
            flowerMarker.x = nearestFlower.x;
            flowerMarker.z = nearestFlower.z;
            flowerMarker.hidden = false;
         } else {
            flowerMarker.hidden = true;
         }
      }
   });

   return (
      <>
         {/* Follow camera */}
         <CameraRig
            camera={{ position: view.offset, lookAt: [0, 0, 0], fov: 45 }}
            follow={run.bee}
            damping={4.5}
            offset={view.offset}
            shift={view.shift}
            bounds={bounds}
         />

         {/* Sky */}
         <SkyDome />

         {/* Off-screen destination indicators */}
         <TargetMarkers targets={markersRef.current} />

         {/* Garden lawn floor */}
         <mesh position={[0, -0.05, 0]} receiveShadow>
            <boxGeometry args={[level.width + 4, 0.1, level.depth + 4]} />
            <meshStandardMaterial color={COLORS.lawn} roughness={0.8} />
         </mesh>

         {/* Garden soil beds */}
         <mesh position={[0, 0.005, 0]} receiveShadow>
            <planeGeometry args={[level.width - 2, level.depth - 2]} />
            <meshStandardMaterial color={COLORS.soil} roughness={0.9} />
         </mesh>

         {/* Hive landing ring pad */}
         <mesh position={[run.hive.x, 0.015, run.hive.z]}>
            <ringGeometry args={[1.5, 1.7, 24]} />
            <meshStandardMaterial color={COLORS.accent} roughness={0.4} />
         </mesh>

         {/* Beehive */}
         <group position={[run.hive.x, 0, run.hive.z]}>
            <Model asset={ASSETS.beehive} fallback={<BeehivePrimitive />} />
         </group>

         {/* Bee avatar */}
         <group ref={beeGroupRef} position={[run.bee.x, run.bee.y, run.bee.z]}>
            <Model asset={ASSETS.bee} fallback={<BeePrimitive tint={looks.beeTint} />} />
         </group>

         {/* Flowers */}
         {run.flowers.map((flower) => {
            const asset =
               flower.type === "A"
                  ? ASSETS.flowerA
                  : flower.type === "B"
                  ? ASSETS.flowerB
                  : ASSETS.flowerC;
            return (
               <group key={flower.id} position={[flower.x, 0, flower.z]}>
                  <Model
                     asset={asset}
                     fallback={<FlowerPrimitive type={flower.type} hasNectar={flower.hasNectar} />}
                  />
               </group>
            );
         })}

         {/* Branches (Obstacles) */}
         {run.branches.map((branch) => (
            <group key={branch.id} position={[branch.x, 0, branch.z]}>
               <Model asset={ASSETS.branch} fallback={<BranchPrimitive radius={branch.radius} />} />
            </group>
         ))}

         {/* Spider Webs (Hazards) */}
         {run.webs.map((web) => (
            <group key={web.id} position={[web.x, 0, web.z]}>
               <Model asset={ASSETS.spiderWeb} fallback={<WebPrimitive radius={web.radius} />} />
            </group>
         ))}

         {/* Garden corner decor (Planters & Watering can) */}
         <group position={[-halfX + 1.2, 0, halfZ - 2]}>
            <Model asset={ASSETS.planter} fallback={<PlanterPrimitive />} />
         </group>
         <group position={[halfX - 1.2, 0, halfZ - 2]}>
            <Model asset={ASSETS.wateringCan} fallback={<WateringCanPrimitive />} />
         </group>
      </>
   );
}
