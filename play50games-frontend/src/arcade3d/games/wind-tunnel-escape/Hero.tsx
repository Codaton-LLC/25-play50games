"use client";
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "../../menu2/heroAnim";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import type { WindRun } from "./rules";

export function Hero({ run: r, intro }: { run: WindRun; intro?: MutableRefObject<number> }) {
   const root = useRef<Group>(null);
   const motion = useMemo(createHeroMotion, []);
   const anim = useHeroAnimator(r.heroId, motion, { topSpeed: 7, jumpSpeed: 9, yaw: Math.PI });
   useFrame(() => {
      const h = r.hero;
      const k = intro?.current ?? 1;
      if (root.current) root.current.position.set(h.x, h.y + (1 - k) ** 2 * 14, h.z);
      motion.vx = h.vx; motion.vy = h.vy; motion.vz = h.vz;
      motion.grounded = h.grounded; motion.rolling = k < 0.95 || (r.heroId === "riko" && r.powerUntil > r.ms);
      motion.celebrating = r.end === "win"; motion.defeated = r.end === "lose";
      motion.power = r.powerUntil > r.ms ? ({ riko: "dash", nami: null, kiro: "shield", zuno: "magnet", vexa: "phase" } as const)[r.heroId] : null;
      motion.events.jumped = r.events.jump;
      motion.events.airJumped = r.events.jump && h.jumps > 1;
      motion.events.landed = r.events.land; motion.events.landSpeed = 5;
      motion.events.hurt = r.events.hit;
   }, FRAME_PRIORITY.camera + 0.1);
   return <group ref={root}><AnimatedHero animator={anim} /></group>;
}
