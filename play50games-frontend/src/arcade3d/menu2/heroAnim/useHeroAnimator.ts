"use client";

// useHeroAnimator(heroId, motion): the one hook a Menu 2 game needs to animate its hero. Every frame
// (FRAME_PRIORITY.pose, after the game's useRunFrame wrote `motion`) it steps the state machine
// (heroAnimState.ts), advances the stride and the ball's roll, blends the pose (heroAnimPose.ts) for
// <HumanoidModel> and works out the body's transform (heroBody.ts) for <AnimatedHero>.
//
//    const motion = useMemo(createHeroMotion, []);
//    useRunFrame(() => {                                  // the game's simulation
//       motion.vx = hero.vx; motion.vy = hero.vy; motion.vz = hero.vz;
//       motion.grounded = hero.grounded;
//       if (ev.jumped) motion.events.jumped = true;      // the animator clears the events it reads
//    });
//    const animator = useHeroAnimator(heroId, motion, { topSpeed: V_RUN });
//    <group position={...the hero's feet point...}><AnimatedHero animator={animator} /></group>
//
// Time: inside a <JuiceLayer> it runs on the juice's visual dt (hit-stop slows it), else on the
// run's game time (useGameTime: pause-safe). Never on the rules' clock, never feeding it back.
import { useMemo, useState, type MutableRefObject } from "react";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useHumanoidPose, type HumanoidPose } from "@/arcade3d/core/rig";
import { HERO_LANDMARKS, HERO_SCALE, type M2HeroId } from "@/arcade3d/menu2/heroModels";
import { useHasJuice, useJuice } from "@/arcade3d/menu2/juice/JuiceLayer";
import { createHeroAnimState, stepHeroAnimState, type HeroAnimConfig, type HeroAnimState, type HeroMotion } from "./heroAnimState";
import { advanceHeroGait, composeHeroPose } from "./heroAnimPose";
import { createHeroBody, stepHeroBody, type HeroBallFit, type HeroBody } from "./heroBody";
import { HERO_BALL_RADIUS, heroBallFit } from "./heroAnimLandmarks";
import type { RunExtras } from "./heroPoses";

export interface HeroAnimatorOptions extends Partial<HeroAnimConfig> {
   /** the ball's radius (m), default HERO_BALL_RADIUS (0.5) */
   ballRadius?: number;
   /** the facing to start with (rad about y, 0 = +z) */
   yaw?: number;
}

export interface HeroAnimator {
   heroId: M2HeroId;
   /** the pose for <HumanoidModel pose> (rebuilt every frame) */
   pose: HumanoidPose;
   /** the state machine (state, weights, timers) */
   state: HeroAnimState;
   /** the body transform <AnimatedHero> copies onto its groups */
   body: HeroBody;
   /** the hero's ball and curl in metres */
   fit: HeroBallFit;
   motion: HeroMotion;
   /** the visual dt of the last frame (s) */
   dt: number;
}

export function useHeroAnimator(heroId: M2HeroId, motionIn: HeroMotion | MutableRefObject<HeroMotion>, options: HeroAnimatorOptions = {}): HeroAnimator {
   const time = useGameTime();
   const juice = useJuice();
   const hasJuice = useHasJuice();
   const motion = "current" in motionIn ? motionIn.current : motionIn;
   const [state] = useState(() => createHeroAnimState({ topSpeed: options.topSpeed, jumpSpeed: options.jumpSpeed }));
   const [body] = useState(() => createHeroBody(options.yaw ?? 0));
   const fit = useMemo(() => heroBallFit(heroId, options.ballRadius ?? HERO_BALL_RADIUS), [heroId, options.ballRadius]);
   const [extras] = useState<RunExtras>(() => ({ surge: 0 }));
   const animator = useMemo<HeroAnimator>(
      () => ({ heroId, pose: null as unknown as HumanoidPose, state, body, fit, motion, dt: 0 }),
      [heroId, state, body, fit, motion]
   );
   const pose = useHumanoidPose((p) => {
      const dt = hasJuice ? juice.visualDt() : time.delta;
      animator.dt = dt;
      const L = HERO_LANDMARKS[heroId];
      const scale = HERO_SCALE[heroId];
      stepHeroAnimState(state, motion, dt);
      advanceHeroGait(state, L, scale, dt);
      composeHeroPose(state, L, p, extras);
      stepHeroBody(body, state, motion, fit, extras.surge * scale, dt);
   });
   animator.pose = pose;
   return animator;
}
