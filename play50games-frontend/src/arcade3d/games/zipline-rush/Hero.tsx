"use client";

// The rider: the picked hero (shared menu2 animator) hanging under the pulley trolley.
// - Riding: a hang pose (both hands on the T-grip over the head, legs dangling and swinging with the
//   speed changes, a cannonball tuck while Down is held, a lean back while braking) blended over
//   the animator, the whole body swinging about the grip like a pendulum.
// - The trolley rides the cable at the rider's place, pitched to the slope; after a release it runs
//   on down the line and waits at the start of the next one.
// - On the station decks the drawn hero walks from the landing mat to the next launch (the rules
//   place it there at once), hops down the L5 lighthouse, and snaps on retries.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "../../menu2/heroAnim";
import { BONE, blendPoses, createPose, restPose, aimArm, turnBone, POSE_MASK, type HumanoidPose } from "../../core/rig";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { useGameTime } from "../../core/gameTime";
import { Model } from "../../core/assets";
import { ASSETS, TROLLEY_CABLE_Y, TROLLEY_GRIP_Y } from "./assets";
import { cablePoint, type ZipRun } from "./rules";
import { HANG } from "./layout";

/** Hands over the feet point with the arms up on the grip (m, as drawn). */
export const HAND_HEIGHT = 1.36;
/** The drawn rider hangs this much higher than rules.ts's hero point, so the hands meet the grip. */
export const RIDE_LIFT = HANG - TROLLEY_CABLE_Y + TROLLEY_GRIP_Y - HAND_HEIGHT;

/** The hang pose: arms up to the grip, legs dangling (`tuck` 0..1 pulls the knees up, `swing` -1..1). Pure. */
export function hangPose(tuck: number, swing: number, brake: number, out: HumanoidPose): HumanoidPose {
   restPose(out);
   out.ground = 0;
   out.lift = 0;
   // upper arms up and a little out, forearms straight up to the bar: hands about 0.25 m apart
   aimArm(out, 1, 0.34, 1, 0.06, -0.08, 1, 0.04);
   aimArm(out, -1, 0.34, 1, 0.06, -0.08, 1, 0.04);
   const k = Math.max(0, Math.min(1, tuck));
   for (const side of [1, -1]) {
      const thigh = side > 0 ? BONE.upperLegL : BONE.upperLegR;
      const shin = side > 0 ? BONE.lowerLegL : BONE.lowerLegR;
      const sway = swing * 0.35 + (side > 0 ? 0.06 : -0.06) * swing;
      // forward is -x about the thigh; the knee folds +x
      turnBone(out, thigh, -(0.18 + sway + k * 1.25 - brake * 0.3), 0, side * (0.05 + k * 0.12));
      turnBone(out, shin, 0.3 + k * 1.55 + brake * 0.25, 0, 0);
   }
   turnBone(out, BONE.spine, k * 0.28 - brake * 0.12, 0, 0);
   turnBone(out, BONE.head, -0.12 - k * 0.1, 0, 0);
   return out;
}

export function Hero({ run, intro }: { run: ZipRun; intro?: MutableRefObject<number> }) {
   const grip = useRef<Group>(null);
   const swingGroup = useRef<Group>(null);
   const trolley = useRef<Group>(null);
   const time = useGameTime();
   const motion = useMemo(createHeroMotion, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: 6, yaw: Math.PI });
   const hanging = useMemo(createPose, []);
   const v = useMemo(
      () => ({
         shown: new Vector3(run.hero.x, run.hero.y, run.hero.z),
         vel: new Vector3(),
         hang: 0,
         swing: 0,
         swingV: 0,
         lastSpeed: run.speed,
         tuck: 0,
         brake: 0,
         trolleyT: 0,
         trolleySection: 0,
         trolleyLane: 0,
         hop: 0,
      }),
      [run]
   );
   const tmp = useMemo(() => new Vector3(), []);
   // what the animator sees (before the pose stage)
   useFrame(() => {
      const riding = run.mode === "ride";
      const walking = run.mode === "deck" || run.mode === "bell";
      motion.vx = walking ? v.vel.x : run.vx;
      motion.vy = riding || walking ? 0 : run.vy;
      motion.vz = walking ? v.vel.z : run.vz;
      motion.grounded = walking && v.hop <= 0;
      motion.rolling = run.mode === "fall";
      motion.celebrating = run.ended === "win";
      motion.defeated = run.ended === "timeup";
      motion.power = run.powerMs > 0 ? ({ riko: "dash", nami: null, kiro: "shield", zuno: "magnet", vexa: "phase" } as const)[run.heroId] : null;
      if (run.event.jump && run.mode === "air") motion.events.jumped = true;
      if (run.event.landed) {
         motion.events.landed = true;
         motion.events.landSpeed = 4 + run.speed * 0.3;
      }
      if (run.event.hit) motion.events.hurt = true;
   }, FRAME_PRIORITY.pose - 0.01);
   // the drawn place, the hang blend and the swing (after the animator's pose)
   useFrame(() => {
      const g = grip.current;
      const sw = swingGroup.current;
      if (!g || !sw) return;
      const dt = Math.min(0.05, time.delta);
      const riding = run.mode === "ride";
      const walking = run.mode === "deck" || run.mode === "bell";
      // the hang: blend in on the grab, out on the release
      v.hang += ((riding ? 1 : 0) - v.hang) * Math.min(1, dt * (riding ? 14 : 8));
      // the displayed feet point
      const target = tmp.set(run.hero.x, run.hero.y + RIDE_LIFT * v.hang, run.hero.z);
      const gap = v.shown.distanceTo(target);
      if (gap > 16 || !walking) {
         v.vel.set(0, 0, 0);
         v.hop = 0;
         v.shown.copy(target);
      } else if (gap > 0.02) {
         // walk (or hop down) to the launch at up to 6.5 m/s
         const dy = target.y - v.shown.y;
         if (Math.abs(dy) > 0.6 && v.hop <= 0) v.hop = 0.75;
         const step = Math.min(gap, 6.5 * dt);
         const before = v.shown.clone();
         v.shown.lerp(target, step / gap);
         v.vel.subVectors(v.shown, before).divideScalar(Math.max(1e-4, dt));
         v.vel.y = 0;
      } else v.vel.set(0, 0, 0);
      if (v.hop > 0) v.hop = Math.max(0, v.hop - dt);
      const hopY = v.hop > 0 ? Math.sin((v.hop / 0.75) * Math.PI) * 1.2 : 0;
      const want = run.throttle > 0.25 ? 1 : 0;
      v.tuck += (want - v.tuck) * Math.min(1, dt * 9);
      v.brake += ((run.throttle < -0.25 ? 1 : 0) - v.brake) * Math.min(1, dt * 7);
      // pendulum: speeding up swings the legs back, braking swings them forward
      const accel = (run.speed - v.lastSpeed) / Math.max(1e-3, dt);
      v.lastSpeed = run.speed;
      if (riding) v.swingV += (-accel * 0.012 - v.swing * 9) * dt;
      v.swingV *= Math.exp(-dt * 1.6);
      v.swing = Math.max(-0.5, Math.min(0.5, v.swing + v.swingV * dt));
      if (run.event.hop) v.swingV += 1.6;
      // the group: grip point, then the pendulum, then the body hanging under the hands
      g.position.set(v.shown.x, v.shown.y + hopY + HAND_HEIGHT * v.hang, v.shown.z);
      if (intro) g.position.y += (1 - intro.current) * 7;
      sw.rotation.x = v.swing * v.hang;
      sw.position.y = -HAND_HEIGHT * v.hang;
      if (v.hang > 0.01) {
         hangPose(v.tuck, v.swing * 2, v.brake, hanging);
         blendPoses(animator.pose, hanging, v.hang * 0.97, animator.pose, POSE_MASK.all);
         animator.body.ball = 0;
         animator.body.shell = 0;
         animator.body.tiltX = 0;
         animator.body.hop = 0;
      }
      // the trolley: on the rider's line at its place; it runs on after a release
      const tr = trolley.current;
      if (tr) {
         if (riding) {
            v.trolleyT = run.t;
            v.trolleySection = run.section;
            v.trolleyLane = run.lane;
         } else if (run.mode === "air" || run.mode === "fall") {
            v.trolleyT = Math.min(1, v.trolleyT + (run.speed * dt) / run.cfg.length);
         } else {
            v.trolleySection = run.section;
            v.trolleyLane = 0;
            v.trolleyT = 0.012;
         }
         tr.visible = run.mode !== "bell";
         const p = cablePoint(run.cfg, v.trolleySection, v.trolleyLane, v.trolleyT);
         const q = cablePoint(run.cfg, v.trolleySection, v.trolleyLane, Math.min(1, v.trolleyT + 0.01));
         tr.position.set(p.x, p.y - TROLLEY_CABLE_Y, p.z);
         // pitched to the cable, swinging a little with the rider
         tr.rotation.set(Math.atan2(q.y - p.y, Math.hypot(q.x - p.x, q.z - p.z)) * -1 + v.swing * 0.4 * v.hang, Math.atan2(q.x - p.x, q.z - p.z) + Math.PI, 0);
      }
   }, FRAME_PRIORITY.pose + 0.005);
   return (
      <>
         <group ref={grip}>
            <group ref={swingGroup}>
               <AnimatedHero animator={animator} />
            </group>
         </group>
         <group ref={trolley}>
            <Model asset={ASSETS.trolley} />
         </group>
      </>
   );
}
