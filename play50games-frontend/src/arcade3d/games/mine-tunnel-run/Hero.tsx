"use client";

// A hero in the mine: the picked hero's GLB on the shared menu2 animator. The run's cell moves become
// the animator's motion (walk / run, the roll into a ball at speed and in a roll-drop, hops, falls,
// the hurt recoil, the cheer in the lift). A dig lunges the body into the cell; dust and grit come
// from the Scene's juice. The intro drops the hero in from the surface.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "../../menu2/heroAnim";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { CELL, type Hero as RunHero, type World } from "./rules";
import { cellX, floorY } from "./space";

export function Hero({ world, hero, intro }: { world: World; hero: RunHero; intro?: MutableRefObject<number> }) {
   const root = useRef<Group>(null);
   const motion = useMemo(createHeroMotion, []);
   const animator = useHeroAnimator(hero.heroId, motion, { topSpeed: 9, yaw: Math.PI / 2 });
   const seen = useRef({ dig: 0 });
   useFrame(() => {
      const h = hero;
      const moving = h.act === "walk" || h.act === "fall" || h.act === "rise" || h.act === "climb" || h.act === "dash" || h.act === "ride";
      const vx = moving && h.dur > 0 ? ((h.tc - h.fc) * CELL) / h.dur : 0;
      const vy = moving && h.dur > 0 ? (-(h.tr - h.fr) * CELL) / h.dur : 0;
      motion.vx = vx !== 0 ? vx : h.act === "dig" ? h.facing * 0.2 : 0;
      motion.vz = 0;
      motion.vy = h.act === "fall" || h.act === "rise" ? vy : 0;
      motion.grounded = h.act === "idle" || h.act === "walk" || h.act === "dig" || h.act === "climb" || h.act === "ride" || h.act === "won";
      motion.rolling = (h.rolling && h.act === "walk") || (h.act === "fall" && h.rollDrop) || h.act === "dash";
      motion.celebrating = h.ended === "win";
      motion.defeated = h.ended === "timeup";
      motion.power = h.powerMs > 0 ? ({ riko: "dash", nami: null, kiro: "shield", zuno: "magnet", vexa: "phase" } as const)[h.heroId] : null;
      const e = h.ev;
      if (e.hop) motion.events.jumped = true;
      if (e.airJump) motion.events.airJumped = true;
      if (e.land) {
         motion.events.landed = true;
         motion.events.landSpeed = e.landSpeed;
      }
      if (e.hit) {
         motion.events.hurt = true;
         motion.events.hurtX = -h.facing;
         motion.events.hurtZ = 0;
      }
      void world;
   }, FRAME_PRIORITY.pose - 0.01);
   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = hero;
      // a dig lunges into the cell and back
      let lx = 0;
      let ly = 0;
      if (h.act === "dig" && h.digDur > 0) {
         const k = Math.sin(Math.min(1, h.digT / h.digDur) * Math.PI) * 0.22;
         lx = (h.dc - h.col) * k;
         ly = -(h.dr - h.row) * k * 0.6;
      }
      g.position.set(cellX(world.w, h.px) + lx, floorY(h.py) + ly, 0);
      if (intro) g.position.y += (1 - intro.current) * 9;
      g.visible = h.act !== "dead" || Math.floor(h.deadMs / 90) % 2 === 0;
      if (h.ev.dig !== seen.current.dig) seen.current.dig = h.ev.dig;
   });
   return (
      <group ref={root}>
         <AnimatedHero animator={animator} />
      </group>
   );
}
