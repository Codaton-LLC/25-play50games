// Shared effects (core/README.md "Effects: core/fx"). Owned by Claude.
export { FxLayer, useCameraShake, useFx, type FxApi, type ScoreOptions } from "./FxLayer";
export { Trail, type TrailProps } from "./Trail";
export { BURST_KINDS, BURST_STYLES, type BurstKind, type BurstStyle } from "./bursts";
export { SHAKE_DECAY, SHAKE_MAX_OFFSET } from "./cameraShake";
export { SCORE_LIFE, SCORE_RISE, SCORE_SLOTS } from "./floatingScores";
export { POP_STYLES, useActionPop, type ActionPop, type PopKind, type PopStyle } from "./actionPop";
export { Toss, type TossHandle, type TossProps } from "./Toss";
export { TOSS_DURATION, TOSS_HEIGHT, createToss, startToss, stepToss, tossAt, type TossFrame, type TossOptions, type TossPoint, type TossState } from "./tossArc";
