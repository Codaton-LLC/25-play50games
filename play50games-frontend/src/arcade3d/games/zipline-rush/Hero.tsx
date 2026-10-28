"use client";
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "../../menu2/heroAnim";
import { carryPose, createPose, blendPoses, POSE_MASK } from "../../core/rig";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { Model } from "../../core/assets";
import { ASSETS } from "./assets";
import type { ZipRun } from "./rules";

export function Hero({ run, intro }: { run: ZipRun; intro?: MutableRefObject<number> }) {
   const root = useRef<Group>(null), trolley = useRef<Group>(null);
   const motion = useMemo(createHeroMotion, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: 16, yaw: Math.PI });
   const hanging = useMemo(createPose, []);
   useFrame(() => {
      const riding = run.mode === "ride";
      motion.vx = run.vx; motion.vy = riding ? 0 : run.vy; motion.vz = run.vz;
      motion.grounded = run.mode === "deck" || run.mode === "bell";
      motion.rolling = riding && run.speed > 12;
      motion.celebrating = run.ended === "win"; motion.defeated = run.ended === "timeup";
      motion.power = run.powerMs > 0 ? ({ riko: "dash", nami: null, kiro: "shield", zuno: "magnet", vexa: "phase" } as const)[run.heroId] : null;
      if (run.event.jump) motion.events.jumped = true;
      if (run.event.landed) { motion.events.landed = true; motion.events.landSpeed = 5; }
      if (run.event.hit) motion.events.hurt = true;
   }, FRAME_PRIORITY.pose - 0.01);
   useFrame(() => {
      if (!root.current || !trolley.current) return;
      root.current.position.set(run.hero.x, run.hero.y, run.hero.z);
      if (intro) root.current.position.y += (1 - intro.current) * 7;
      trolley.current.visible = run.mode === "ride";
      // Raised arms grip the trolley; the shared animator still owns jump, hurt, powers and cheer.
      if (run.mode === "ride") {
         carryPose(1, hanging);
         blendPoses(animator.pose, hanging, 0.95, animator.pose, POSE_MASK.arms);
         animator.body.ball = 0; animator.body.shell = 0;
         animator.body.tiltX = run.speed > 12 ? -0.35 : 0;
      }
   }, FRAME_PRIORITY.pose + 0.005);
   return <group ref={root}>
      <AnimatedHero animator={animator} />
      <group ref={trolley} position={[0, 1.75, 0]}><Model asset={ASSETS.trolley} /></group>
   </group>;
}
