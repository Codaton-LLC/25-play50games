"use client";

// <HumanoidModel>: a static T-pose character GLB, auto-rigged in code (core/rig) and posed every
// frame. Owned by Claude. Usage inside a Scene:
//
//    const walk = useRef({ phase: 0 });
//    const pose = useHumanoidPose((p) => {                       // FRAME_PRIORITY.pose, every frame
//       const stride = Math.max(0.2, walkStride(speed01, LANDMARKS) * scale);   // core/rig/gait.ts
//       walk.current.phase += (speed / stride) * Math.PI * 2 * time.delta;
//       walkPose(walk.current.phase, speed01, p);              // core/rig/poses.ts builders
//    });
//    <HumanoidModel asset={ASSETS.robot} pose={pose} fallback={<RobotPrimitive />} />
//
// - Loads through the same path as <Model> (manifest, suspense, error fallback, GameShell's cache
//   clearing). A missing, unlisted or broken GLB draws `fallback` (or the asset's primitive).
// - The skinned template is built once per GLB; every <HumanoidModel> has its own bones.
// - The asset transform is <Model>'s (scale, stretch, rotationY, yOffset): the bind pose draws
//   exactly where <Model> draws the static GLB.
// - Every frame at FRAME_PRIORITY.visuals the pose is copied into the bones (no allocation) and the
//   hips are raised by bodyLift(pose, landmarks) (the lower sole on the floor; applyLift={false}
//   leaves that to the game's own group). Write the pose before that: in a useHumanoidPose driver
//   (FRAME_PRIORITY.pose, after the camera) or in useRunFrame. A plain useFrame may run after the
//   copy (same priority) and show one frame late.
import { forwardRef, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFrame, type GroupProps } from "@react-three/fiber";
import type { Group } from "three";
import { FallbackPrimitive, ModelErrorBoundary, assetScale, useHumanoidRig } from "../assets";
import { FRAME_PRIORITY } from "../frameLoop";
import type { ModelAsset } from "../types";
import { armsDownPose, createPose, type HumanoidPose } from "./poses";
import { applyHumanoidPose } from "./skinning";

/** Drawn when a <HumanoidModel> gets no pose. */
const ARMS_DOWN = armsDownPose(createPose());

/**
 * A pose object for <HumanoidModel pose>, made once per component (arms down to start). With
 * `drive`, it is called every frame at FRAME_PRIORITY.pose (after useRunFrame and the camera,
 * before every visual) to rebuild the pose; it may be a new function every render.
 */
export function useHumanoidPose(drive?: (pose: HumanoidPose) => void): HumanoidPose {
   const [pose] = useState(() => armsDownPose(createPose()));
   const driveRef = useRef(drive);
   driveRef.current = drive;
   useFrame(() => {
      driveRef.current?.(pose);
   }, FRAME_PRIORITY.pose);
   return pose;
}

interface ContentProps {
   asset: ModelAsset;
   pose: HumanoidPose;
   applyLift: boolean;
   fallback: ReactNode;
}

function HumanoidContent({ asset, pose, applyLift, fallback }: ContentProps) {
   const rig = useHumanoidRig(asset);
   // posed before the first frame it is drawn in, then every frame
   useLayoutEffect(() => {
      if (rig) applyHumanoidPose(rig, pose, applyLift);
   }, [rig, pose, applyLift]);
   useFrame(() => {
      if (rig) applyHumanoidPose(rig, pose, applyLift);
   }, FRAME_PRIORITY.visuals);
   if (!rig) return <>{fallback}</>;
   return (
      <primitive
         object={rig.root}
         scale={assetScale(asset)}
         rotation-y={asset.rotationY ?? 0}
         position-y={asset.yOffset ?? 0}
      />
   );
}

export interface HumanoidModelProps extends Omit<GroupProps, "children"> {
   /** a static T-pose character; `asset.humanoid.landmarks` pins its joints (else all estimated) */
   asset: ModelAsset;
   /** read every frame (mutate it, e.g. from useHumanoidPose); default: arms down */
   pose?: HumanoidPose;
   /** raise the body by bodyLift(pose) (default true); false when the game moves this group by it itself */
   applyLift?: boolean;
   /** colour of the default fallback primitive (defaults to asset.fallbackColor) */
   fallbackColor?: string;
   /** what to draw while the GLB is missing or broken: an element, as for <Model> */
   fallback?: ReactNode;
   children?: ReactNode;
}

/** An auto-rigged character driven by `pose`, or its fallback. Suspends while a listed GLB loads. */
export const HumanoidModel = forwardRef<Group, HumanoidModelProps>(function HumanoidModel(
   { asset, pose, applyLift = true, fallbackColor, fallback, children, ...group },
   ref
) {
   const stand = fallback ?? <FallbackPrimitive asset={asset} color={fallbackColor} />;
   return (
      <group ref={ref} {...group}>
         <ModelErrorBoundary key={asset.url} fallback={stand}>
            <HumanoidContent asset={asset} pose={pose ?? ARMS_DOWN} applyLift={applyLift} fallback={stand} />
         </ModelErrorBoundary>
         {children}
      </group>
   );
});
