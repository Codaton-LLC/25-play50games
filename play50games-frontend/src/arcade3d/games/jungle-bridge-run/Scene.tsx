"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { Water } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { Gem } from "@/arcade3d/core/kit";
import { useLevel } from "@/arcade3d/core/level";
import { randomSeed } from "@/arcade3d/core/math";
import { BlobShadow, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import {
   BONE,
   HumanoidModel,
   cheerPose,
   flailPose,
   jumpPose,
   turnBone,
   useHumanoidPose,
   walkPose,
} from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import { LEVELS, type JungleLevel } from "./levels";
import { CAMERA_OFFSET, COLORS, FOV, LOOK_AHEAD_Z, VIEW_CONFIG } from "./looks";
import {
   ExplorerPrimitive,
   LavaVentPrimitive,
   LogPrimitive,
   PlankLanePrimitive,
   RopeBridgePrimitive,
   RuinGatePrimitive,
   TemplePillarPrimitive,
   VinePrimitive,
   VolcanoBackdropPrimitive,
   WaterfallCliffPrimitive,
} from "./Primitives";
import {
   LANE_X,
   RUN_IN_Z,
   SECTION_LEN,
   createRun,
   isLavaActive,
   logXAt,
   step,
   type GapObstacle,
   type LogObstacle,
   type Obstacle,
   type Run,
   type RunnerInput,
} from "./rules";

export default function Scene() {
   const view = useFittedView(VIEW_CONFIG);
   const levelState = useLevel<JungleLevel>();
   const level = levelState.config ?? LEVELS[1];

   const [run] = useState<Run>(() => createRun(randomSeed(), level));
   const followTarget = useRef({ x: 0, y: 0, z: RUN_IN_Z });
   const time = useGameTime();
   const input = useInput();

   // Sync frame loop
   useRunFrame((_state, dt) => {
      const { pressed, jumpPressed } = input.current;
      const runnerIn: RunnerInput = {
         left: pressed.left,
         right: pressed.right,
         jump: jumpPressed || pressed.up,
         slide: pressed.down,
      };

      const store = useArcadeStore.getState();
      const timeLeftMs = store.timeLeftMs ?? 0;
      const ev = step(run, runnerIn, dt, timeLeftMs);

      // Sound triggers
      if (ev.gemCollected) playSfx("pickup");
      if (ev.jump) playSfx("jump");
      if (ev.slide) playSfx("whoosh");
      if (ev.lifeLost) playSfx("hit");
      if (ev.sectionCleared) playSfx("chime");
      if (ev.won) playSfx("win");
      if (ev.lost) playSfx("lose");

      // Score and store updates
      if (ev.score) store.addScore(ev.score);
      if (ev.lifeLost) store.loseLife();
      store.setStat("section", Math.min(run.level.sections, run.currentSection + 1));
      store.setStat("gems", run.gemsTaken);

      if (ev.won) store.end("win");
      else if (ev.lost) store.end("lose");

      // Follow camera along Z only
      followTarget.current.x = 0;
      followTarget.current.y = 0;
      followTarget.current.z = run.z + LOOK_AHEAD_Z;
   });

   // Character animation pose
   const pose = useHumanoidPose((p) => {
      if (run.over === "win") {
         cheerPose(time.now, p);
         return;
      }
      if (run.respawning || run.over === "lose") {
         flailPose(time.now, p);
         return;
      }
      if (run.jumpTimer > 0) {
         jumpPose(0.3, p);
         return;
      }
      walkPose(run.z / 1.7, 1.0, p);
      if (run.slideTimer > 0) {
         turnBone(p, BONE.spine, 0.8, 0, 0);
      }
   });

   // Canyon scenery spots (rocks, trees on outer margins)
   const totalLength = RUN_IN_Z + level.sections * SECTION_LEN + 30;
   const decorSpots = useMemo(() => {
      const rockSpots: InstanceSpot[] = [];
      const treeSpots: InstanceSpot[] = [];
      for (let z = 0; z < totalLength; z += 12) {
         // Left canyon wall
         rockSpots.push({ x: -7.5, y: -2, z, scale: 3.2, rotY: (z * 0.4) % Math.PI });
         treeSpots.push({ x: -10, y: 1, z: z + 4, scale: 2.8 });
         // Right canyon wall
         rockSpots.push({ x: 7.5, y: -2, z: z + 6, scale: 3.2, rotY: (z * 0.7) % Math.PI });
         treeSpots.push({ x: 10, y: 1, z: z + 2, scale: 2.8 });
      }
      return { rockSpots, treeSpots };
   }, [totalLength]);

   return (
      <>
         {/* Camera follow on Z only, fixed X center */}
         <CameraRig
            camera={{ position: CAMERA_OFFSET, fov: FOV, lookAt: [0, 0, 0] }}
            follow={followTarget.current}
            offset={CAMERA_OFFSET}
            shift={view.shift}
            damping={10}
         />

         {/* River water 12 m below */}
         <Water
            position={[0, -12, totalLength / 2]}
            size={[100, totalLength + 100]}
            color={COLORS.water}
            deep={COLORS.waterDeep}
         />

         {/* Backdrop features */}
         {level.patterns.includes("log") && (
            <group position={[32, -4, totalLength * 0.4]}>
               <WaterfallCliffPrimitive />
            </group>
         )}
         {level.patterns.includes("lava") && (
            <group position={[0, -4, totalLength + 40]}>
               <VolcanoBackdropPrimitive />
            </group>
         )}

         {/* Canyon Edge Decor */}
         <Instanced spots={decorSpots.rockSpots}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial color={COLORS.cliff} roughness={0.9} />
         </Instanced>
         <Instanced spots={decorSpots.treeSpots}>
            <cylinderGeometry args={[1.5, 2.2, 5, 8]} />
            <meshStandardMaterial color={COLORS.foliageDark} roughness={0.8} />
         </Instanced>

         {/* Track sections */}
         {run.sections.map((sec) => (
            <group key={sec.index} position={[0, 0, sec.startZ]}>
               {/* 3 Lane planks */}
               {LANE_X.map((lx, laneIdx) => {
                  const hasGap = sec.obstacles.some(
                     (o) => o.kind === "gap" && (o as GapObstacle).lanes.includes(laneIdx),
                  );
                  const isBridge = sec.obstacles.some((o) => o.kind === "bridge");
                  if (hasGap) {
                     // Draw split planks around 3 m gap
                     return (
                        <group key={laneIdx} position={[lx, 0, 0]}>
                           <PlankLanePrimitive width={1.8} length={7.5} />
                           <group position={[0, 0, 11]}>
                              <PlankLanePrimitive width={1.8} length={13.5} />
                           </group>
                        </group>
                     );
                  }
                  if (isBridge) {
                     const bridge = sec.obstacles.find((o) => o.kind === "bridge") as Obstacle;
                     const isPlankLane = bridge && "plankLane" in bridge && bridge.plankLane === laneIdx;
                     if (isPlankLane) {
                        return (
                           <group key={laneIdx} position={[lx, 0, 12]}>
                              <RopeBridgePrimitive length={8} />
                           </group>
                        );
                     }
                     // Void on non-plank lanes during bridge
                     return (
                        <group key={laneIdx} position={[lx, 0, 0]}>
                           <PlankLanePrimitive width={1.8} length={7.5} />
                           <group position={[0, 0, 16]}>
                              <PlankLanePrimitive width={1.8} length={8} />
                           </group>
                        </group>
                     );
                  }
                  return (
                     <group key={laneIdx} position={[lx, 0, 12]}>
                        <PlankLanePrimitive width={1.8} length={SECTION_LEN} />
                     </group>
                  );
               })}

               {/* Obstacles in this section */}
               {sec.obstacles.map((obs, oIdx) => (
                  <ObstacleRenderer key={oIdx} obstacle={obs} run={run} secStartZ={sec.startZ} />
               ))}

               {/* Section Gate */}
               <group position={[0, 0, SECTION_LEN]}>
                  <RuinGatePrimitive />
               </group>
            </group>
         ))}

         {/* Start Pad Gate */}
         <group position={[0, 0, RUN_IN_Z]}>
            <RuinGatePrimitive />
         </group>

         {/* Gems */}
         {run.gems.map(
            (gem) =>
               !gem.collected && (
                  <group key={gem.id} position={[gem.x, gem.y, gem.z]}>
                     <Gem size={0.32} color={COLORS.gem} />
                  </group>
               ),
         )}

         {/* Explorer Player Character */}
         <group position={[run.x, run.y, run.z]}>
            <BlobShadow radius={0.4} />
            <HumanoidModel asset={ASSETS.explorer} pose={pose} fallback={<ExplorerPrimitive />} />
         </group>
      </>
   );
}

function ObstacleRenderer({ obstacle, run, secStartZ }: { obstacle: Obstacle; run: Run; secStartZ: number }) {
   const logRef = useRef<any>(null);

   useFrame(() => {
      if (obstacle.kind === "log" && logRef.current) {
         logRef.current.position.x = logXAt(obstacle as LogObstacle, run.time);
      }
   });

   const relZ = obstacle.z - secStartZ;

   switch (obstacle.kind) {
      case "vine":
         return (
            <group position={[0, 0, relZ]}>
               <VinePrimitive />
            </group>
         );
      case "pillar":
         return (
            <group position={[LANE_X[obstacle.lane], 0, relZ]}>
               <TemplePillarPrimitive />
            </group>
         );
      case "log":
         return (
            <group ref={logRef} position={[0, 0, relZ]}>
               <LogPrimitive />
            </group>
         );
      case "lava":
         return (
            <group position={[LANE_X[obstacle.lane], 0, relZ]}>
               <LavaVentPrimitive />
            </group>
         );
      default:
         return null;
   }
}
