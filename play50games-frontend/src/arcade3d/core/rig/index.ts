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
   CLAVICLE_SHARE,
   POSE_MASK,
   REACH_TOP,
   SHRUG_TOP,
   aimArm,
   armsDownPose,
   blendPoses,
   carryPose,
   cheerPose,
   copyPose,
   createPose,
   flailPose,
   idlePose,
   jumpPose,
   levelFoot,
   mirrorPose,
   reachPose,
   resolvePose,
   restPose,
   setBoneEuler,
   turnBone,
   walkPose,
   wrapPhase,
   type HumanoidPose,
   type PoseMask,
} from "./poses";
export { MIN_GAIT_STRIDE, bodyLift, footPoint, gaitPhaseStep, groundLift, soleHeight, walkStride } from "./gait";
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
