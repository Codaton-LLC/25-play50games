"use client";

// The squad: all five heroes are loaded and animated (World 6), only the active one is drawn, at the
// run's position. A tag swaps the drawn hero in place (the burst comes from Scene's juice).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "../../menu2/heroAnim";
import { useArcadeStore } from "../../core/useArcadeStore";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import type { M2HeroId } from "../../menu2/heroModels";
import { HEROES } from "./heroes";
import { powerUp, type CmjRun } from "./rules";

function Member({ index, motion }: { index: number; motion: HeroMotion }) {
   const animator = useHeroAnimator(HEROES[index].id as M2HeroId, motion, { topSpeed: 8, jumpSpeed: 8, ballRadius: 0.5, yaw: Math.PI });
   return <AnimatedHero animator={animator} />;
}

export function Squad({ run: r, intro }: { run: CmjRun; intro?: { current: number } }) {
   const group = useRef<Group>(null);
   const motions = useMemo(() => HEROES.map(() => createHeroMotion()), [r]);
   const seen = useRef({ hop: false, landed: false, hurt: false, active: r.active });
   const shown = useRef<(Group | null)[]>([]);
   useFrame(() => {
      const playing = useArcadeStore.getState().phase === "playing";
      const ev = r.events;
      motions.forEach((m, i) => {
         const active = i === r.active;
         m.vx = playing && active ? r.vx : 0;
         m.vy = r.vy;
         m.vz = playing && active ? r.vz : 0;
         m.grounded = !r.hop && r.fallUntil < 0;
         m.rolling = !!r.hop && r.hop.cells >= 3;
         m.celebrating = r.ended === "win";
         m.defeated = r.ended === "lose" || r.ended === "timeup";
         m.power = powerUp(r, 2) ? "shield" : powerUp(r, 3) ? "magnet" : powerUp(r, 4) ? "phase" : null;
         if (!active || !playing) return;
         if (ev.hop && !seen.current.hop) m.events.jumped = true;
         if (ev.airJump) m.events.airJumped = true;
         if (ev.landed && !seen.current.landed) {
            m.events.landed = true;
            m.events.landSpeed = 6;
         }
         if (ev.hurt && !seen.current.hurt) {
            m.events.hurt = true;
            m.events.hurtX = 0;
            m.events.hurtZ = 1;
         }
      });
      seen.current = { hop: ev.hop, landed: ev.landed, hurt: ev.hurt, active: r.active };
      if (group.current) group.current.position.set(r.x, r.y + (intro && !playing ? (1 - intro.current) * 6 : 0), r.z);
      shown.current.forEach((g, i) => {
         if (g) g.visible = i === r.active;
      });
   }, FRAME_PRIORITY.camera + 0.05);
   return (
      <group ref={group}>
         {HEROES.map((h, i) => (
            <group key={h.id} ref={(g) => { shown.current[i] = g; }} visible={i === r.active}>
               <Member index={i} motion={motions[i]} />
            </group>
         ))}
      </group>
   );
}
