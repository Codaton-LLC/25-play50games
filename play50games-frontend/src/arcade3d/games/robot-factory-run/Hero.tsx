"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "../../menu2/heroAnim";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { useShellIntro } from "../../core/intro";
import type { FactoryRun } from "./rules";
export function Hero({ run }: {
   run: FactoryRun;
}) {
   const root = useRef<Group>(null);
   const motion = useMemo(createHeroMotion, []);
   const anim = useHeroAnimator(run.heroId, motion, { topSpeed: 6.4, jumpSpeed: 8 });
   const intro = useShellIntro();
   useFrame(() => {
      const h = run.hero;
      const e = run.events;
      const landing = intro?.session && !intro.ready ? intro.hero.current : 1;
      motion.vx = h.vx;
      motion.vz = h.vz;
      motion.vy = h.vy;
      motion.grounded = h.grounded && landing >= 0.97;
      motion.rolling = h.roll || landing < 0.97;
      motion.celebrating = run.ended === "win";
      motion.defeated = run.ended === "lose";
      motion.power = h.powerUntil > run.simMs ? ({ riko: "dash", nami: "doubleJump", kiro: "shield", zuno: "magnet", vexa: "phase" } as const)[run.heroId] : null;
      motion.events.jumped = e.jump;
      motion.events.airJumped = e.jump && !h.airJump;
      motion.events.landed = e.land;
      motion.events.landSpeed = 8;
      motion.events.hurt = e.hit;
      if (root.current) {
         root.current.position.set(h.x, h.y + 8 * (1 - landing) ** 2, h.z);
         root.current.visible = landing > 0.001;
      }
   }, FRAME_PRIORITY.camera + 0.1);
   return <group ref={root}><AnimatedHero animator={anim}/></group>;
}
