"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "../../menu2/heroAnim";
import { useArcadeStore } from "../../core/useArcadeStore";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { heightAt } from "./slope";
import { powerActive, type SnowRun } from "./rules";

export function Hero({ run: r, intro }: { run: SnowRun; intro?: { current: number } }) {
   const group = useRef<Group>(null);
   const spin = useRef<Group>(null);
   const motion = useMemo(createHeroMotion, [r]);
   const animator = useHeroAnimator(r.heroId, motion, { topSpeed: 44, jumpSpeed: 9, ballRadius: 0.56, yaw: Math.PI });
   const seen = useRef({ jumped: false, hit: false, landed: false });
   useFrame(() => {
      const h = r.hero, ev = r.events, playing = useArcadeStore.getState().phase === "playing";
      motion.vx = playing ? h.vx : 0;
      motion.vy = h.vy; motion.vz = playing ? h.vz : 0;
      motion.grounded = r.airMs <= 0;
      motion.rolling = playing && r.ended === null;
      motion.celebrating = r.ended === "win";
      motion.defeated = r.ended === "lose" || r.ended === "timeup";
      motion.power = powerActive(r, "riko") ? "dash" : powerActive(r, "kiro") ? "shield" : powerActive(r, "zuno") ? "magnet" : powerActive(r, "vexa") ? "phase" : null;
      if (playing && ev.jumped && !seen.current.jumped) motion.events.jumped = true;
      if (playing && ev.landed && !seen.current.landed) { motion.events.landed = true; motion.events.landSpeed = 7; }
      if (playing && ev.hit && !seen.current.hit) { motion.events.hurt = true; motion.events.hurtX = h.vx; motion.events.hurtZ = 1; }
      if (playing && ev.airJump) motion.events.airJumped = true;
      seen.current = { jumped: ev.jumped, hit: ev.hit, landed: ev.landed };
      if (group.current) group.current.position.set(h.x, h.y + (intro && !playing ? (1 - intro.current) * 5 : 0), h.z);
      if (spin.current) spin.current.rotation.set(r.airMs > 0 ? r.flip : 0, r.airMs > 0 ? r.spin : 0, 0);
   }, FRAME_PRIORITY.camera + 0.05);
   return <>
      <group ref={group}><group ref={spin}><AnimatedHero animator={animator} /></group></group>
      <Shadow run={r} />
   </>;
}
function Shadow({ run: r }: { run: SnowRun }) {
   const ref = useRef<Group>(null);
   useFrame(() => { if (ref.current) ref.current.position.set(r.hero.x, heightAt(r.distance) + 0.02, r.hero.z); });
   return <group ref={ref}><mesh rotation-x={-Math.PI / 2}><circleGeometry args={[0.65, 20]} /><meshBasicMaterial color="#2d5261" transparent opacity={0.22} depthWrite={false} /></mesh></group>;
}
