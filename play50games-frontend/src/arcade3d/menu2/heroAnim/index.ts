// Menu 2 hero animation (menu2/heroAnim/README.md). Pure modules first, then the hook and the component.
export {
   HERO_ANIM_STATES,
   HERO_FADE,
   HERO_STATE_COUNT,
   HERO_TIMING,
   HS,
   RUN_FROM,
   clearHeroEvents,
   createHeroAnimState,
   createHeroMotion,
   heroStateName,
   pickHeroState,
   stepHeroAnimState,
   type HeroAnimConfig,
   type HeroAnimState,
   type HeroAnimStateId,
   type HeroMotion,
   type HeroMotionEvents,
   type HeroPowerKind,
} from "./heroAnimState";
export {
   RUN_DUTY,
   clearFloor,
   curlPose,
   dashPose,
   defeatPose,
   fallPose,
   flipPose,
   heroCheerPose,
   heroIdlePose,
   heroRunPose,
   heroStride,
   hurtPose,
   landPose,
   lookAround,
   risePose,
   runDuty,
   takeoffPose,
   type RunExtras,
} from "./heroPoses";
export { advanceHeroGait, composeHeroPose, landDepth } from "./heroAnimPose";
export { createHeroBody, stepHeroBody, type HeroBallFit, type HeroBody } from "./heroBody";
export { CURL_FILL, HERO_BALL_RADIUS, HERO_CURL, HERO_LOOK, heroAccent, heroBallFit, type HeroBallLook } from "./heroAnimLandmarks";
export { useHeroAnimator, type HeroAnimator, type HeroAnimatorOptions } from "./useHeroAnimator";
export { AnimatedHero, type AnimatedHeroProps } from "./AnimatedHero";
export { BALL_PLATES, HeroBall, buildHeroBallGeometry } from "./HeroBall";
