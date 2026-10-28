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
   crawlPose,
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
   sitPose,
   swimPose,
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
   createAnchorGroup,
   disposeHumanoid,
   humanoidTemplate,
   type HumanoidOptions,
   type HumanoidRig,
   type HumanoidTemplate,
} from "./skinning";
export { HumanoidModel, useHumanoidPose, type HumanoidAttachments, type HumanoidModelProps } from "./HumanoidModel";
export { ANCHOR_NAMES, anchorOffset, measureAnchors, type AnchorName, type HumanoidAnchor, type HumanoidAnchors } from "./attachments";
// The quadruped auto-rig: static four-legged animal GLBs (a cat, a dog) with procedural gaits.
export {
   QBONE,
   QUADRUPED_BONES,
   QUAD_BONE_COUNT,
   QUAD_BONE_PARENT,
   QUAD_LEGS,
   computeQuadrupedWeights,
   quadrupedJoints,
   type QuadrupedBone,
   type QuadrupedLandmarks,
   type QuadrupedLeg,
} from "./quadruped";
export {
   DIAGONAL_WALK,
   blendQuadrupedPoses,
   copyQuadrupedPose,
   createQuadrupedPose,
   quadrupedAnkles,
   quadrupedCrouch,
   quadrupedGait,
   quadrupedGaitMix,
   quadrupedIdle,
   quadrupedLeap,
   quadrupedLegLength,
   quadrupedPhaseStep,
   quadrupedSit,
   quadrupedStand,
   quadrupedStride,
   type QuadrupedGaitOptions,
   type QuadrupedPose,
} from "./quadrupedPoses";
export { applyQuadrupedPose, buildQuadrupedTemplate, cloneQuadruped, createMouthGroup, disposeQuadruped, quadrupedTemplate, type QuadrupedRig, type QuadrupedTemplate } from "./quadrupedSkinning";
export { QuadrupedModel, useQuadrupedPose, useQuadrupedRig, type QuadrupedModelProps } from "./QuadrupedModel";
