"use client";

// The alien farmer: the Hyper3D alien through the core auto-rig (walk by distance over its own
// stride, the basket on the left arm, the lean-and-pluck during a pick, a cheer or a shrug after
// time-up), with the basket and a blob shadow. Reads the run state; never writes it.
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { turnTowards } from "@/arcade3d/core/math";
import { BlobShadow } from "@/arcade3d/core/render";
import { HumanoidModel, bodyLift, useHumanoidPose } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ALIEN_SCALE, ASSETS } from "./assets";
import {
   ALIEN_LANDMARKS,
   BASKET_LOCAL_POS,
   BONE,
   POSE_MASK,
   alienPhaseStep,
   alienWalkPose,
   applyLeftBasketCarry,
   blendPoses,
   cheerPose,
   createPose,
   harvestPose,
   idlePose,
   turnBone,
   wrapPhase,
} from "./poses";
import { groundAt } from "./looks";
import { AlienPrimitive, Basket } from "./Primitives";
import { FARMER, growthAt, type RunState } from "./rules";

const ease = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt));

export function Farmer({ run }: { run: RunState }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const standIn = useRef<Group>(null);
   const [look] = useState(() => ({ amount: 0, phase: 0, pick: 0, end: 0, lift: 0, ground: 0 }));
   const [a] = useState(createPose);
   const [b] = useState(createPose);

   const pose = useHumanoidPose((p) => {
      const dt = time.delta;
      const { phase, score } = useArcadeStore.getState();
      const f = run.farmer;
      const v = phase === "playing" ? Math.hypot(f.vx, f.vz) : 0;
      look.amount = ease(look.amount, Math.min(1, v / FARMER.speeds[0]) * 0.85, 12, dt);
      look.phase = wrapPhase(look.phase + alienPhaseStep(look.amount, v, dt));
      look.pick = ease(look.pick, run.channel.active ? 1 : 0, 30, dt);
      look.end = ease(look.end, phase === "over" ? 1 : 0, 6, dt);
      alienWalkPose(look.phase, look.amount, p);
      blendPoses(p, idlePose(time.now, a), 1 - Math.min(1, look.amount * 5), p, POSE_MASK.upper);
      applyLeftBasketCarry(p);
      if (look.pick > 0.01) {
         const c = run.channel;
         const plot = run.plots[Math.max(0, c.plot)];
         const d = Math.hypot(plot.x - f.x, plot.z - f.z);
         harvestPose(c.active ? run.time - c.start : 0, d, 0.5 + 0.5 * growthAt(plot, run.time), b);
         blendPoses(p, b, look.pick, p);
      }
      if (look.end > 0.01) {
         if (score > 0) blendPoses(p, cheerPose(time.now, b), look.end, p, POSE_MASK.arms);
         else turnBone(p, BONE.chest, 0.25 * look.end, 0, 0);
      }
      look.lift = bodyLift(p, ALIEN_LANDMARKS) * ALIEN_SCALE;
   });

   useFrame(() => {
      const g = root.current, lift = body.current;
      if (!g || !lift) return;
      const f = run.farmer;
      // step up onto a bed's soil quickly, so the soles never sink into it
      look.ground = ease(look.ground, groundAt(f.x, f.z), 25, time.delta);
      g.position.set(f.x, look.ground, f.z);
      // after time-up it turns to the camera for the cheer
      g.rotation.y = look.end > 0.01 ? turnTowards(g.rotation.y, 0, 1 - Math.exp(-5 * time.delta)) : f.yaw;
      if (standIn.current) {
         lift.position.y = Math.abs(Math.sin(look.phase)) * 0.04 * look.amount + (look.end > 0.5 && useArcadeStore.getState().score > 0 ? Math.abs(Math.sin(time.now * 7)) * 0.15 : 0);
         lift.rotation.x = 0.1 * look.amount + 0.35 * look.pick;
      } else {
         lift.position.y = look.lift;
         lift.rotation.x = 0;
      }
   });

   return (
      <group ref={root} name="farmer">
         <BlobShadow radius={0.42} y={0.03} />
         <group ref={body}>
            <HumanoidModel
               asset={ASSETS.alien}
               pose={pose}
               applyLift={false}
               fallback={
                  <group ref={standIn}>
                     <AlienPrimitive />
                  </group>
               }
            />
         </group>
         <group position={[BASKET_LOCAL_POS.x, BASKET_LOCAL_POS.y - 0.07, BASKET_LOCAL_POS.z]}>
            <Basket />
         </group>
      </group>
   );
}
