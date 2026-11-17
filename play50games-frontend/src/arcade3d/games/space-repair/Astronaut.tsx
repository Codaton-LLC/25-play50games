"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, GreaterDepth, MeshBasicMaterial, type Group, type Mesh } from "three";
import { HumanoidModel, applyHumanoidPose, createPose, useHumanoidPose, type HumanoidPose } from "@/arcade3d/core/rig";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Instanced } from "@/arcade3d/core/render";
import { ModelErrorBoundary, useHumanoidRig } from "@/arcade3d/core/assets";
import { ASSETS, SUIT_SCALE } from "./assets";
import { COLORS } from "./looks";
import { floatPose } from "./poses";
import type { Run } from "./rules";

// Shown only where something in front hides the suit (depthFunc GreaterDepth): an x-ray silhouette.
function SuitOutline({ pose }: { pose: HumanoidPose }) {
   const rig = useHumanoidRig(ASSETS.astronaut);
   const material = useMemo(
      () =>
         new MeshBasicMaterial({
            color: COLORS.rim,
            transparent: true,
            opacity: 0.22,
            depthFunc: GreaterDepth,
            depthWrite: false,
         }),
      [],
   );

   useLayoutEffect(() => {
      rig?.root.traverse((object) => {
         const mesh = object as Mesh;
         if (mesh.isMesh) {
            mesh.material = material;
            mesh.renderOrder = 8;
         }
      });
   }, [rig, material]);

   useEffect(() => () => material.dispose(), [material]);
   useFrame(() => {
      if (rig) applyHumanoidPose(rig, pose, false);
   });

   return rig ? <primitive object={rig.root} scale={SUIT_SCALE} dispose={null} /> : null;
}

/** Deliberate multi-tone orbital repair tool with glowing plasma emitter. */
function Wrench() {
   return (
      <group rotation-z={Math.PI / 2}>
         {/* Titanium ergonomic handle */}
         <mesh>
            <capsuleGeometry args={[0.024, 0.22, 4, 8]} />
            <meshStandardMaterial color={COLORS.hull} metalness={0.7} roughness={0.25} />
         </mesh>
         {/* Grip sleeve */}
         <mesh position={[0, -0.04, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.1, 8]} />
            <meshStandardMaterial color={COLORS.shadow} metalness={0.5} roughness={0.4} />
         </mesh>
         {/* Glowing emitter ring */}
         <mesh position={[0, 0.08, 0]}>
            <torusGeometry args={[0.035, 0.012, 6, 12]} />
            <meshStandardMaterial color={COLORS.neonBlue} emissive={COLORS.neonBlue} emissiveIntensity={0.8} />
         </mesh>
         {/* Plasma clamp head */}
         <mesh position={[0, 0.16, 0]}>
            <torusGeometry args={[0.065, 0.024, 6, 10, Math.PI * 1.6]} />
            <meshStandardMaterial color={COLORS.accent} metalness={0.5} roughness={0.3} />
         </mesh>
      </group>
   );
}

const NOZZLES = [-1, 1].map((side) => ({ x: side * 0.125, y: -0.2, z: -0.13 }));
const FLAMES = NOZZLES.map((p) => ({ ...p, y: 0.48 }));

function Jets({ run, reduced }: { run: Run; reduced: boolean }) {
   const flame = useRef<Group>(null);
   const time = useGameTime();

   useFrame(() => {
      if (!flame.current) return;
      flame.current.visible = run.thrusting && !run.terminal;
      flame.current.scale.y = reduced ? 1 : 1 + 0.12 * Math.sin(time.now * 32);
   });

   return (
      <group>
         <Instanced spots={NOZZLES}>
            <capsuleGeometry args={[0.05, 0.2, 4, 8]} />
            <meshStandardMaterial color={COLORS.panel} metalness={0.5} roughness={0.35} />
         </Instanced>
         <group ref={flame} visible={false}>
            <group rotation-z={Math.PI}>
               <Instanced spots={FLAMES}>
                  <coneGeometry args={[0.045, 0.32, 8]} />
                  <meshBasicMaterial
                     color={COLORS.neonBlue}
                     blending={AdditiveBlending}
                     transparent
                     opacity={0.85}
                     depthWrite={false}
                  />
               </Instanced>
            </group>
         </group>
      </group>
   );
}

/** Deliberate code-made stand-in astronaut for fallback when GLB is unavailable. */
function SuitFallback({ run, reduced }: { run: Run; reduced: boolean }) {
   return (
      <group>
         {/* Torso */}
         <mesh position-y={0.92}>
            <capsuleGeometry args={[0.28, 0.45, 6, 12]} />
            <meshStandardMaterial color={COLORS.hull} roughness={0.3} metalness={0.3} />
         </mesh>
         {/* Helmet */}
         <mesh position-y={1.47}>
            <sphereGeometry args={[0.29, 16, 14]} />
            <meshStandardMaterial color={COLORS.hullBright} roughness={0.25} metalness={0.4} />
         </mesh>
         {/* Polished Gold/Dark Visor */}
         <mesh position={[0, 1.49, 0.17]} scale={[1, 0.72, 0.55]}>
            <sphereGeometry args={[0.24, 16, 12]} />
            <meshStandardMaterial
               color={COLORS.visor}
               metalness={0.7}
               roughness={0.15}
               emissive={COLORS.panel}
               emissiveIntensity={0.35}
            />
         </mesh>
         {/* Legs */}
         <mesh position={[0.18, 0.34, 0.02]} rotation-x={-0.12}>
            <capsuleGeometry args={[0.12, 0.43, 4, 8]} />
            <meshStandardMaterial color={COLORS.hull} roughness={0.35} />
         </mesh>
         <mesh position={[-0.18, 0.34, 0.02]} rotation-x={0.12}>
            <capsuleGeometry args={[0.12, 0.43, 4, 8]} />
            <meshStandardMaterial color={COLORS.hull} roughness={0.35} />
         </mesh>
         {/* Arms */}
         <mesh position={[0.34, 0.92, 0.08]} rotation-x={-0.4}>
            <capsuleGeometry args={[0.1, 0.35, 4, 8]} />
            <meshStandardMaterial color={COLORS.hull} roughness={0.35} />
         </mesh>
         <group position={[-0.34, 1.04, 0.11]} rotation-x={-0.8}>
            <mesh>
               <capsuleGeometry args={[0.1, 0.34, 4, 8]} />
               <meshStandardMaterial color={COLORS.hull} roughness={0.35} />
            </mesh>
            <group position={[0, -0.19, 0]}>
               <Wrench />
            </group>
         </group>
         {/* Backpack & Thrusters */}
         <mesh position={[0, 1.05, -0.22]}>
            <boxGeometry args={[0.4, 0.48, 0.2]} />
            <meshStandardMaterial color={COLORS.panel} roughness={0.35} metalness={0.5} />
         </mesh>
         <group position={[0, 1.1, -0.25]}>
            <Jets run={run} reduced={reduced} />
         </group>
      </group>
   );
}

export default function Astronaut({ run, reduced }: { run: Run; reduced: boolean }) {
   const root = useRef<Group>(null);
   const time = useGameTime();
   const [scratch] = useState(createPose);
   const [motion] = useState(() => ({ thrust: 0, reach: 0 }));

   const pose = useHumanoidPose((p) => {
      const k = 1 - Math.exp(-10 * time.delta);
      motion.thrust += ((run.thrusting ? 1 : 0) - motion.thrust) * k;
      motion.reach += ((run.docked >= 0 ? 1 : 0) - motion.reach) * k;
      floatPose(
         time.now,
         motion.thrust,
         motion.reach,
         run.time < run.wobbleUntil ? 1 : 0,
         run.terminal === "win",
         reduced,
         p,
         scratch,
      );
   });

   useFrame(() => {
      if (root.current) {
         root.current.position.set(
            run.body.x,
            0.25 + (reduced || run.terminal ? 0 : 0.025 * Math.sin(time.now * 1.8)),
            run.body.z,
         );
         root.current.rotation.y = run.yaw;
         root.current.rotation.z = run.terminal === "lose" ? 0.22 : 0;
      }
   });

   return (
      <group ref={root}>
         <HumanoidModel
            asset={ASSETS.astronaut}
            pose={pose}
            applyLift={false}
            fallback={<SuitFallback run={run} reduced={reduced} />}
            attach={{ chest: <Jets run={run} reduced={reduced} />, handR: <Wrench /> }}
         />
         <ModelErrorBoundary fallback={null}>
            <SuitOutline pose={pose} />
         </ModelErrorBoundary>
      </group>
   );
}
