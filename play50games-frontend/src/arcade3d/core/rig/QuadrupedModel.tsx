"use client";

// <QuadrupedModel>: a static four-legged animal GLB, auto-rigged in code (core/rig/quadruped.ts)
// and posed every frame. Owned by Claude. Usage inside a Scene:
//
//    const gait = useRef({ phase: 0 });
//    const pose = useQuadrupedPose((p) => {                          // FRAME_PRIORITY.pose
//       gait.current.phase = quadrupedPhaseStep(gait.current.phase, speed * time.delta, speed01, LM, scale, time.delta);
//       quadrupedGait(gait.current.phase, speed01, LM, p, turn);
//    });
//    <QuadrupedModel asset={ASSETS.dog} pose={pose} attach={{ mouth: <Toy /> }} />
//
// - Loads through the same path as <Model> (manifest, suspense, error fallback); a missing, unlisted
//   or broken GLB draws `fallback` (or the asset's primitive). The asset needs `quadruped.landmarks`
//   (without them it is drawn static, like <Model>).
// - The skinned template is built once per GLB; every <QuadrupedModel> has its own bones.
// - The asset transform is <Model>'s (scale, stretch, rotationY, yOffset).
// - The pose is copied into the bones every frame at FRAME_PRIORITY.visuals; write it before that
//   (useQuadrupedPose runs at FRAME_PRIORITY.pose).
// - attach={{ mouth }}: an element held in the mouth (landmarks.mouth), in this group's units,
//   following the head bone. Drawn on the rigged GLB only.
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal, useFrame, type GroupProps } from "@react-three/fiber";
import type { Group } from "three";
import { FallbackPrimitive, Model, ModelErrorBoundary, assetScale, loadGltf, useCloneLook } from "../assets";
import { FRAME_PRIORITY } from "../frameLoop";
import type { ModelAsset } from "../types";
import { QBONE } from "./quadruped";
import { createQuadrupedPose, type QuadrupedPose } from "./quadrupedPoses";
import { applyQuadrupedPose, cloneQuadruped, createMouthGroup, disposeQuadruped, quadrupedTemplate, type QuadrupedRig } from "./quadrupedSkinning";

/**
 * A pose object for <QuadrupedModel pose>, made once per component. With `drive`, it is called
 * every frame at FRAME_PRIORITY.pose to rebuild the pose; it may be a new function every render.
 */
export function useQuadrupedPose(drive?: (pose: QuadrupedPose) => void): QuadrupedPose {
   const [pose] = useState(createQuadrupedPose);
   const driveRef = useRef(drive);
   driveRef.current = drive;
   useFrame(() => {
      driveRef.current?.(pose);
   }, FRAME_PRIORITY.pose);
   return pose;
}

/** The asset's private skinned copy, or null (missing / broken GLB, no landmarks). Suspends while loading. */
export function useQuadrupedRig(asset: ModelAsset): QuadrupedRig | null {
   const gltf = loadGltf(asset.url);
   const source = gltf?.scene ?? null;
   const landmarks = asset.quadruped?.landmarks ?? null;
   const template = useMemo(() => (source && landmarks ? quadrupedTemplate(source, landmarks) : null), [source, landmarks]);
   const rig = useMemo(() => (template ? cloneQuadruped(template) : null), [template]);
   useEffect(() => (rig ? () => disposeQuadruped(rig) : undefined), [rig]);
   return rig;
}

interface ContentProps {
   asset: ModelAsset;
   pose: QuadrupedPose | null;
   tint?: string;
   mouth?: ReactNode;
   fallback: ReactNode;
}

function QuadrupedContent({ asset, pose, tint, mouth, fallback }: ContentProps) {
   const rig = useQuadrupedRig(asset);
   useCloneLook(rig?.root ?? null, asset.material, tint);
   const [sx, sy, sz] = assetScale(asset);
   const group = useMemo(() => (rig && mouth != null ? createMouthGroup(rig, [sx, sy, sz]) : null), [rig, mouth != null, sx, sy, sz]); // eslint-disable-line react-hooks/exhaustive-deps
   useLayoutEffect(() => {
      if (!rig || !group) return;
      rig.bones[QBONE.head].add(group);
      return () => {
         group.removeFromParent();
      };
   }, [rig, group]);
   useLayoutEffect(() => {
      if (rig && pose) applyQuadrupedPose(rig, pose);
   }, [rig, pose]);
   useFrame(() => {
      if (rig && pose) applyQuadrupedPose(rig, pose);
   }, FRAME_PRIORITY.visuals);
   if (!rig) return <>{fallback}</>;
   return (
      <>
         <primitive object={rig.root} scale={[sx, sy, sz]} rotation-y={asset.rotationY ?? 0} position-y={asset.yOffset ?? 0} />
         {group && mouth != null ? createPortal(<>{mouth}</>, group) : null}
      </>
   );
}

export interface QuadrupedModelProps extends Omit<GroupProps, "children" | "attach"> {
   /** a static animal GLB with `quadruped.landmarks` */
   asset: ModelAsset;
   /** read every frame (mutate it, e.g. from useQuadrupedPose); default: standing */
   pose?: QuadrupedPose;
   fallbackColor?: string;
   /** what to draw while the GLB is missing or broken (an element) */
   fallback?: ReactNode;
   /** multiplies the GLB's colours (as <Model tint>) */
   tint?: string;
   /** elements on the rig: `mouth` (held in the mouth, follows the head) */
   attach?: { mouth?: ReactNode };
   children?: ReactNode;
}

/** An auto-rigged animal driven by `pose`, or its fallback. Suspends while a listed GLB loads. */
export const QuadrupedModel = forwardRef<Group, QuadrupedModelProps>(function QuadrupedModel({ asset, pose, fallbackColor, fallback, tint, attach, children, ...group }, ref) {
   const stand = fallback ?? <FallbackPrimitive asset={asset} color={fallbackColor} />;
   if (!asset.quadruped) {
      return (
         <Model ref={ref} asset={asset} fallback={stand} tint={tint} {...group}>
            {children}
         </Model>
      );
   }
   return (
      <group ref={ref} {...group}>
         <ModelErrorBoundary key={asset.url} fallback={stand}>
            <QuadrupedContent asset={asset} pose={pose ?? null} tint={tint} mouth={attach?.mouth} fallback={stand} />
         </ModelErrorBoundary>
         {children}
      </group>
   );
});
