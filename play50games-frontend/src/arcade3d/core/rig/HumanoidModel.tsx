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
// - asset.material (a statue look) and `tint` work as on <Model> (core/materials.ts).
// - attach={{ head, chest, handL, handR }}: elements mounted on the bones' anchors
//   (rig/attachments.ts: the top of the head, the middle of the back, the centre of each hand), in
//   this group's units, following the bones through the scene graph (no per-frame work). They are
//   drawn on the rigged GLB only, not on the fallback.
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal, useFrame, type GroupProps } from "@react-three/fiber";
import type { Group } from "three";
import { FallbackPrimitive, ModelErrorBoundary, assetScale, useCloneLook, useHumanoidRig } from "../assets";
import { FRAME_PRIORITY } from "../frameLoop";
import type { ModelAsset } from "../types";
import { armsDownPose, createPose, type HumanoidPose } from "./poses";
import { applyHumanoidPose, createAnchorGroup } from "./skinning";
import { ANCHOR_NAMES, type AnchorName } from "./attachments";

/** <HumanoidModel attach>: an element per anchor (rig/attachments.ts). */
export type HumanoidAttachments = Partial<Record<AnchorName, ReactNode>>;

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
   tint?: string;
   attach?: HumanoidAttachments;
   fallback: ReactNode;
}

function HumanoidContent({ asset, pose, applyLift, tint, attach, fallback }: ContentProps) {
   const rig = useHumanoidRig(asset);
   useCloneLook(rig?.root ?? null, asset.material, tint);
   const [sx, sy, sz] = assetScale(asset);
   // one group per used anchor (built here, parented to this clone's bones in a layout effect so
   // a render React throws away, or a StrictMode effect replay, never leaves an orphan or a gap)
   const wanted = attach ? ANCHOR_NAMES.filter((name) => attach[name] != null).join(",") : "";
   const anchors = useMemo(() => {
      if (!rig || !wanted) return null;
      const groups: Partial<Record<AnchorName, Group>> = {};
      for (const name of wanted.split(",") as AnchorName[]) groups[name] = createAnchorGroup(rig, name, [sx, sy, sz]);
      return groups;
   }, [rig, wanted, sx, sy, sz]);
   useLayoutEffect(() => {
      if (!rig || !anchors) return;
      for (const name of ANCHOR_NAMES) {
         const group = anchors[name];
         if (group) rig.bones[rig.anchors[name].bone].add(group);
      }
      return () => {
         for (const name of ANCHOR_NAMES) anchors[name]?.removeFromParent();
      };
   }, [rig, anchors]);
   // posed before the first frame it is drawn in, then every frame
   useLayoutEffect(() => {
      if (rig) applyHumanoidPose(rig, pose, applyLift);
   }, [rig, pose, applyLift]);
   useFrame(() => {
      if (rig) applyHumanoidPose(rig, pose, applyLift);
   }, FRAME_PRIORITY.visuals);
   if (!rig) return <>{fallback}</>;
   return (
      <>
         <primitive object={rig.root} scale={[sx, sy, sz]} rotation-y={asset.rotationY ?? 0} position-y={asset.yOffset ?? 0} />
         {anchors && attach
            ? ANCHOR_NAMES.map((name) => {
                 const group = anchors[name];
                 return group && attach[name] != null ? <AnchorPortal key={name} group={group} content={attach[name]} /> : null;
              })
            : null}
      </>
   );
}

function AnchorPortal({ group, content }: { group: Group; content: ReactNode }) {
   return <>{createPortal(<>{content}</>, group)}</>;
}

// `attach` here is the anchors (not R3F's attach-to-parent prop, which a model group never needs)
export interface HumanoidModelProps extends Omit<GroupProps, "children" | "attach"> {
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
   /** multiplies the GLB's colours (as <Model tint>; one cached material per GLB material and tint) */
   tint?: string;
   /**
    * Elements on the character's anchors (rig/attachments.ts): `head` (top of the head), `chest`
    * (middle of the back), `handL` / `handR` (centre of the hand). In this group's units, in the
    * bone's T-pose frame; they follow the bones. Drawn on the rigged GLB only.
    */
   attach?: HumanoidAttachments;
   children?: ReactNode;
}

/** An auto-rigged character driven by `pose`, or its fallback. Suspends while a listed GLB loads. */
export const HumanoidModel = forwardRef<Group, HumanoidModelProps>(function HumanoidModel(
   { asset, pose, applyLift = true, fallbackColor, fallback, tint, attach, children, ...group },
   ref
) {
   const stand = fallback ?? <FallbackPrimitive asset={asset} color={fallbackColor} />;
   return (
      <group ref={ref} {...group}>
         <ModelErrorBoundary key={asset.url} fallback={stand}>
            <HumanoidContent asset={asset} pose={pose ?? ARMS_DOWN} applyLift={applyLift} tint={tint} attach={attach} fallback={stand} />
         </ModelErrorBoundary>
         {children}
      </group>
   );
});
