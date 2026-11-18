"use client";

// <AnimatedHero animator={useHeroAnimator(...)}>: the rigged hero GLB (core <HumanoidModel>) posed by
// the animator, inside the groups that carry its body transform (heroBody.ts), plus its ball shell
// (HeroBall) and, inside a <JuiceLayer>, its dash streak and power aura in the hero's colour.
// Place it on the hero's feet point (the game's own group); it faces +z at yaw 0 and turns itself.
//
// Groups, outside in: facing + hop -> squash/stretch -> surge (the run's planted foot) -> the pivot
// (the somersault, the ball's roll, the knockback's tilt; at the curled body's centre, rising to the
// ball's centre as it closes) -> the body's scale inside the shell -> back by the curl centre and
// the sole -> the model. The shell sits on the pivot.
import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { HumanoidModel } from "@/arcade3d/core/rig";
import { HERO_SCALE, HERO_SOLE_Z, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { createJuiceEmitter, useJuice } from "@/arcade3d/menu2/juice/JuiceLayer";
import { HeroBall } from "./HeroBall";
import { HERO_LOOK } from "./heroAnimLandmarks";
import type { HeroAnimator } from "./useHeroAnimator";

/** Right after the animator's drive (FRAME_PRIORITY.pose), before the visuals. */
const BODY_PRIORITY = FRAME_PRIORITY.pose + 0.01;

export interface AnimatedHeroProps {
   animator: HeroAnimator;
   /** drawn while the GLB is missing or broken (an element, as for <Model>) */
   fallback?: ReactNode;
   /** the dash streak and the power aura (default on; needs a <JuiceLayer>) */
   effects?: boolean;
   /** hide the hero (an intro before it lands, a respawn) */
   visible?: boolean;
}

export function AnimatedHero({ animator, fallback, effects = true, visible = true }: AnimatedHeroProps) {
   const juice = useJuice();
   const facing = useRef<Group>(null);
   const squash = useRef<Group>(null);
   const surge = useRef<Group>(null);
   const pivot = useRef<Group>(null);
   const inner = useRef<Group>(null);
   const offset = useRef<Group>(null);
   const shell = useRef<Group>(null);
   const id = animator.heroId;
   const asset = useMemo(() => heroModelAsset(id), [id]);
   const look = HERO_LOOK[id];
   const fx = useMemo(
      () => ({ trail: createJuiceEmitter(), aura: createJuiceEmitter(), at: new Vector3(), color: { color: look.glow }, auraColor: { color: look.plate } }),
      [look]
   );

   useFrame(() => {
      const b = animator.body;
      const f = animator.fit;
      const g = facing.current;
      if (!g || !squash.current || !surge.current || !pivot.current || !inner.current || !offset.current || !shell.current) return;
      g.visible = visible;
      g.rotation.y = b.yaw;
      g.position.y = b.hop;
      squash.current.scale.set(b.scale.x, b.scale.y, b.scale.z);
      surge.current.position.z = b.surge;
      pivot.current.position.set(0, b.pivotY, b.pivotZ);
      pivot.current.rotation.set(b.roll + b.tiltX, 0, b.tiltZ);
      inner.current.scale.setScalar(Math.max(1e-3, b.bodyScale));
      inner.current.visible = b.ball < 0.97;
      offset.current.position.set(0, -f.curlCenterY, -f.curlCenterZ);
      const sh = shell.current;
      sh.visible = b.shell > 0;
      sh.scale.setScalar(Math.max(1e-3, f.radius * b.shell));

      if (!effects || !visible) return;
      // the streak and the aura, in world space at the hero's middle
      if (b.streak > 0.3 || b.aura > 0.2) {
         g.getWorldPosition(fx.at);
         fx.at.y += f.curlCenterY;
         if (b.streak > 0.3) juice.stream("trail", fx.at, 90 * b.streak, fx.trail, fx.color);
         if (b.aura > 0.2) juice.stream("aura", fx.at, 26 * b.aura, fx.aura, fx.auraColor);
      }
   }, BODY_PRIORITY);

   return (
      <group ref={facing}>
         <group ref={squash}>
            <group ref={surge}>
               <group ref={pivot}>
                  <group ref={inner}>
                     <group ref={offset}>
                        <group position-z={-HERO_SOLE_Z[id] * HERO_SCALE[id]}>
                           <HumanoidModel asset={asset} pose={animator.pose} fallback={fallback} />
                        </group>
                     </group>
                  </group>
                  <group ref={shell} visible={false}>
                     <HeroBall look={look} />
                  </group>
               </group>
            </group>
         </group>
      </group>
   );
}
