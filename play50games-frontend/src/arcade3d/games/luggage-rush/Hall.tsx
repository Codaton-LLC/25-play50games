"use client";

// The hall: floor, north window, the toy plane and the waving handler. Decor hides on the low tier.
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useQuality } from "@/arcade3d/core/quality";
import { HumanoidModel, blendPoses, bodyLift, createPose, idlePose, reachPose, useHumanoidPose } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, HANDLER_SCALE } from "./assets";
import { HandlerPrimitive, PlanePrimitive } from "./Primitives";
import { HALL } from "./rules";

export function Hall() {
   const quality = useQuality();
   const showDecor = quality.tier !== "low";
   return (
      <group name="hall">
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(HALL.minX + HALL.maxX) / 2, 0, (HALL.minZ + HALL.maxZ) / 2]} receiveShadow>
            <planeGeometry args={[HALL.maxX - HALL.minX, HALL.maxZ - HALL.minZ]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
         </mesh>
         <mesh position={[8.2, 1.7, HALL.minZ + 0.15]}>
            <boxGeometry args={[4.2, 2.2, 0.12]} />
            <meshStandardMaterial color="#94a3b8" />
         </mesh>
         <mesh position={[8.2, 1.7, HALL.minZ + 0.28]}>
            <planeGeometry args={[3.2, 1.5]} />
            <meshStandardMaterial color="#bae6fd" emissive="#7dd3fc" emissiveIntensity={0.35} />
         </mesh>
         {showDecor && <WindowPlane />}
         {showDecor && <Handler />}
      </group>
   );
}

function WindowPlane() {
   const time = useGameTime();
   const ref = useRef<Group>(null);
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      g.position.x = 8.2 + Math.sin(time.now * 0.35) * 0.6;
   });
   return (
      <group ref={ref} position={[8.2, 1.55, HALL.minZ + 0.55]} rotation={[0, Math.PI, 0]}>
         <Model asset={ASSETS.plane} fallback={<PlanePrimitive />} />
      </group>
   );
}

function Handler() {
   const time = useGameTime();
   const [a] = useState(createPose);
   const [b] = useState(createPose);
   const lift = useRef(0);
   const pose = useHumanoidPose((p) => {
      idlePose(time.now, a);
      reachPose(1, 0.65, b);
      blendPoses(a, b, 0.8, p);
      lift.current = bodyLift(p, RUNNER_LANDMARKS) * HANDLER_SCALE;
   });
   const root = useRef<Group>(null);
   useFrame(() => {
      const g = root.current;
      if (g) g.position.y = lift.current;
   });
   return (
      <group ref={root} position={[8.6, 0, 6.2]} rotation={[0, Math.PI * 0.85, 0]}>
         <HumanoidModel asset={ASSETS.handler} pose={pose} applyLift={false} fallback={<HandlerPrimitive />} />
      </group>
   );
}
