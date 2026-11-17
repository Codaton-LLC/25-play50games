"use client";

// Draws toss.ts flights: a few copies of `children` (the item's model) that fly on an arc and are
// hidden between flights. Render it inside the Scene and start a flight from the frame loop:
//
//    const toss = useRef<TossHandle>(null);
//    <Toss ref={toss} slots={2}><Model asset={ASSETS.key} /></Toss>
//    if (ev.keyPickup >= 0) toss.current?.play(key, heroHand, { duration: 0.4 });
//
// - `to` is a live point read every frame (it can move: the hero, the cart).
// - It runs on the run's pause-safe clock (frozen while paused); `slots` flights at once, the oldest
//   is reused beyond that. No allocation per frame. `onLand(slot)` runs when a flight ends.
import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { FRAME_PRIORITY } from "../frameLoop";
import { useGameTime } from "../gameTime";
import { createToss, startToss, stepToss, type TossFrame, type TossOptions, type TossPoint, type TossState } from "./tossArc";

export interface TossHandle {
   /** starts a flight; returns the slot used */
   play(from: TossPoint, to: TossPoint, options?: TossOptions): number;
}

export interface TossProps {
   children: ReactNode;
   /** flights at once (default 1) */
   slots?: number;
   /** spin about y while flying, rad/s (default 6; 0 = none) */
   spin?: number;
   onLand?: (slot: number) => void;
}

export const Toss = forwardRef<TossHandle, TossProps>(function Toss({ children, slots = 1, spin = 6, onLand }, ref) {
   const time = useGameTime();
   const count = Math.max(1, slots);
   const states = useRef<TossState[]>([]);
   if (states.current.length !== count) states.current = Array.from({ length: count }, createToss);
   const order = useRef<number[]>([]);
   const groups = useRef<(Group | null)[]>([]);
   const frame = useRef<TossFrame>({ x: 0, y: 0, z: 0, scale: 1 }).current;
   const landed = useRef(onLand);
   landed.current = onLand;
   const serial = useRef(0);

   useImperativeHandle(ref, () => ({
      play(from, to, options) {
         let slot = states.current.findIndex((s) => !s.active);
         if (slot < 0) {
            // the oldest flight
            let oldest = Infinity;
            for (let i = 0; i < count; i++) {
               if ((order.current[i] ?? 0) < oldest) {
                  oldest = order.current[i] ?? 0;
                  slot = i;
               }
            }
         }
         serial.current += 1;
         order.current[slot] = serial.current;
         startToss(states.current[slot], from, to, options);
         return slot;
      },
   }), [count]);

   useFrame(() => {
      for (let i = 0; i < count; i++) {
         const g = groups.current[i];
         const s = states.current[i];
         if (!g || !s) continue;
         const wasOn = s.active;
         const on = stepToss(s, time.delta, frame);
         if (!on) {
            if (g.visible) g.visible = false;
            continue;
         }
         g.visible = true;
         g.position.set(frame.x, frame.y, frame.z);
         g.scale.setScalar(frame.scale);
         if (spin) g.rotation.y += spin * time.delta;
         if (wasOn && !s.active) {
            g.visible = false;
            landed.current?.(i);
         }
      }
   }, FRAME_PRIORITY.visuals);

   return (
      <>
         {Array.from({ length: count }, (_, i) => (
            <group key={i} ref={(g) => { groups.current[i] = g; }} visible={false}>
               {children}
            </group>
         ))}
      </>
   );
});
