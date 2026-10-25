"use client";

// The finished robot: the shared robot GLB on the auto-rig, stepping off the cradle with a wave and
// walking out through the exit door (poses.ts); on a win it cheers beside the door. Its
// group carries the walk's bodyLift (applyLift false), so the feet stay on the floor.
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { BlobShadow } from "@/arcade3d/core/render";
import { HumanoidModel, bodyLift, createPose, useHumanoidPose } from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS, ROBOT_HEIGHT, ROBOT_SCALE } from "./assets";
import { CRADLE_TOP } from "./look";
import { COLORS } from "./looks";
import { robotCheerPose, robotWalkOffPose, walkOffX } from "./poses";
import { CRADLE, type Run } from "./rules";

/** On a win the robot cheers on the floor between the cradle and the door. */
const CHEER_X = 2.05;

function RobotPrimitive() {
   const h = ROBOT_HEIGHT;
   return (
      <group>
         {/* Bevelled lower torso and pelvis */}
         <mesh position={[0, h * 0.28, 0]}>
            <primitive object={new RoundedBoxGeometry(0.26, h * 0.48, 0.2, 1, 0.02)} attach="geometry" />
            <meshStandardMaterial color={COLORS.steelDark} roughness={0.45} metalness={0.4} />
         </mesh>
         {/* Upper chest chassis */}
         <mesh position={[0, h * 0.62, 0]}>
            <primitive object={new RoundedBoxGeometry(0.42, h * 0.3, 0.26, 2, 0.035)} attach="geometry" />
            <meshStandardMaterial color={COLORS.white} roughness={0.32} metalness={0.2} />
         </mesh>
         {/* Chest reactor core */}
         <mesh position={[0, h * 0.62, 0.135]}>
            <circleGeometry args={[0.065, 16]} />
            <meshBasicMaterial color={COLORS.rim} toneMapped={false} />
         </mesh>
         {/* Spherical head dome */}
         <mesh position={[0, h * 0.88, 0]}>
            <sphereGeometry args={[0.165, 20, 14]} />
            <meshStandardMaterial color={COLORS.white} roughness={0.28} metalness={0.25} />
         </mesh>
         {/* Visor sensor band */}
         <mesh position={[0, h * 0.88, 0.125]}>
            <primitive object={new RoundedBoxGeometry(0.24, 0.065, 0.06, 1, 0.015)} attach="geometry" />
            <meshBasicMaterial color={COLORS.rim} toneMapped={false} />
         </mesh>
         {/* Shoulder joints */}
         <mesh position={[-0.24, h * 0.68, 0]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial color={COLORS.steelMid} roughness={0.4} metalness={0.5} />
         </mesh>
         <mesh position={[0.24, h * 0.68, 0]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshStandardMaterial color={COLORS.steelMid} roughness={0.4} metalness={0.5} />
         </mesh>
      </group>
   );
}

export function Robot({ run }: { run: Run }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const [scratch] = useState(createPose);
   const live = useRef({ lift: 0, x: 0, mode: 0 as 0 | 1 | 2 });
   const won = useArcadeStore((state) => state.phase === "over" && state.endReason === "win");

   const pose = useHumanoidPose((p) => {
      const l = live.current;
      const x = walkOffX(run.walkT);
      if (won) {
         l.mode = 2;
         robotCheerPose(time.now, p);
      } else if (x !== null) {
         l.mode = 1;
         l.x = x;
         robotWalkOffPose(run.walkT, scratch, p);
      } else {
         l.mode = 0;
      }
      l.lift = l.mode === 0 ? 0 : bodyLift(p, ROBOT_LANDMARKS) * ROBOT_SCALE;
   });

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const l = live.current;
      g.visible = l.mode !== 0;
      if (l.mode === 1) {
         // it starts on the turntable and steps down past its rim
         const onCradle = Math.min(1, Math.max(0, (CRADLE.x + 0.45 - l.x) / 0.12));
         g.position.set(l.x, l.lift + CRADLE_TOP * onCradle, CRADLE.z);
         g.rotation.y = Math.PI / 2;
      } else if (l.mode === 2) {
         g.position.set(CHEER_X, l.lift, CRADLE.z);
         // turn from the door towards the camera over the first half second
         g.rotation.y += (0 - g.rotation.y) * Math.min(1, time.delta * 6);
      }
   });

   return (
      <group ref={root} visible={false} name="finished-robot">
         <BlobShadow radius={0.32} />
         <HumanoidModel asset={ASSETS.robot} pose={pose} applyLift={false} fallback={<RobotPrimitive />} />
      </group>
   );
}
