// The humanoid auto-rig: static T-pose character GLBs animated with procedural poses. Owned by
// Claude. core/README.md "Characters: the auto-rig" has the guide.
export {
   BONE,
   BONE_COUNT,
   BONE_MIRROR,
   BONE_PARENT,
   HUMANOID_BONES,
   computeSkinWeights,
   estimateHumanoidLandmarks,
   humanoidJoints,
   type HumanoidBone,
   type HumanoidLandmarks,
   type SkinWeights,
} from "./humanoid";
export {
   POSE_MASK,
   aimArm,
   armsDownPose,
   blendPoses,
   carryPose,
   cheerPose,
   copyPose,
   createPose,
   idlePose,
   jumpPose,
   mirrorPose,
   reachPose,
   resolvePose,
   restPose,
   setBoneEuler,
   walkPose,
   wrapPhase,
   type HumanoidPose,
   type PoseMask,
} from "./poses";
export {
   applyHumanoidPose,
   buildHumanoidTemplate,
   cloneHumanoid,
   disposeHumanoid,
   humanoidTemplate,
   type HumanoidOptions,
   type HumanoidRig,
   type HumanoidTemplate,
} from "./skinning";
export { HumanoidModel, useHumanoidPose, type HumanoidModelProps } from "./HumanoidModel";
