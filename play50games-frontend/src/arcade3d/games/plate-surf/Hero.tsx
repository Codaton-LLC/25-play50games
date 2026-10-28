"use client";

// The Menu 2 hero on its plate: the picked hero's own GLB animated by the shared Menu 2 animator
// (menu2/heroAnim: the state machine, the gait, the body, <AnimatedHero>), with a surf stance blended
// over it while riding (surfStancePose: a low side-on stance, knees bent, arms out, the head turned
// down the line, leaning into each carve) and the trick moves in the air (a spin about the board, a
// flip over it, a grab tuck). The plate is m2SurfPlateI, under the feet, rolled square to the face and
// pointed along the line it carves; it glows on a pump. A swallow tumbles the hero into the shell ball
// (the menu2 ball-roll); the cheer at the finish; the blob shadow on the face.
//
// The card's surfStance / carveL / carveR / trick clips are a shared heroAnim follow-up (README "Open
// issues"): until then this file builds them from the shared pose helpers (core/rig, menu2/heroAnim).
import { useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Model } from "@/arcade3d/core/assets";
import { BONE, POSE_MASK, aimArm, blendPoses, createPose, levelFoot, setBoneEuler, useHumanoidPose, type HumanoidPose } from "@/arcade3d/core/rig";
import {
   AnimatedHero,
   HERO_BALL_RADIUS,
   HS,
   advanceHeroGait,
   composeHeroPose,
   createHeroAnimState,
   createHeroBody,
   createHeroMotion,
   heroAccent,
   heroBallFit,
   stepHeroAnimState,
   stepHeroBody,
   type HeroAnimator,
   type HeroMotion,
   type RunExtras,
} from "@/arcade3d/menu2/heroAnim";
import { HERO_LANDMARKS, HERO_SCALE, type M2HeroId } from "@/arcade3d/menu2/heroModels";
import { useHasJuice, useJuice } from "@/arcade3d/menu2/juice/JuiceLayer";
import { ASSETS, PLATE_DECK, PLATE_SCALE } from "./assets";
import { faceSlope } from "./waves";
import { TRICK_MS, V_AIR, V_MAX, type SurfRun } from "./rules";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   lostAt: number;
   spawnAt: number;
   winAt: number;
   stungAt: number;
   pumpAt: number;
   bailAt: number;
   /** the intro's landing timeline 0..1 (1 = riding), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, jumpAt: -9, airJumpAt: -9, lostAt: -9, spawnAt: -9, winAt: Number.POSITIVE_INFINITY, stungAt: -9, pumpAt: -9, bailAt: -9, intro: Number.NaN };
}

/** The intro's drop: the hero falls this far onto the plate, curled up. */
export const INTRO_DROP = 16;

export interface MotionMemo {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   lostAt: number;
   stungAt: number;
   bailAt: number;
   fallSpeed: number;
}

export function createMotionMemo(): MotionMemo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, lostAt: -9, stungAt: -9, bailAt: -9, fallSpeed: 0 };
}

/**
 * The animator's motion for this frame (pure: no three.js; hero.test.ts drives it). The hero never
 * "runs" on its plate: its own velocity stays 0 (the surf stance is blended over the idle), the
 * vertical speed drives the air states; a swallow rolls it into the ball.
 */
export function writeHeroMotion(m: HeroMotion, memo: MotionMemo, run: SurfRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   m.vx = 0;
   m.vz = 0;
   m.vy = h.grounded ? 0 : h.vy;
   m.grounded = h.grounded && h.state !== "lost";
   const ms = run.simMs;
   m.power = h.dashUntil >= ms ? "dash" : h.shieldUntil >= ms ? "shield" : h.magnetUntil >= ms ? "magnet" : h.phaseUntil >= ms ? "phase" : null;
   const introDrop = !Number.isNaN(anim.intro) && anim.intro < 0.97;
   m.rolling = h.state === "lost" || introDrop;
   if (introDrop) {
      m.vy = -14 * (1 - anim.intro);
      m.grounded = false;
   }
   m.celebrating = now - anim.winAt >= 0;
   m.defeated = run.ended === "lose";
   if (anim.airJumpAt !== memo.airJumpAt) {
      memo.airJumpAt = anim.airJumpAt;
      m.events.airJumped = true;
      memo.jumpAt = anim.jumpAt;
   } else if (anim.jumpAt !== memo.jumpAt) {
      memo.jumpAt = anim.jumpAt;
      m.events.jumped = true;
   }
   if (anim.landAt !== memo.landAt) {
      memo.landAt = anim.landAt;
      m.events.landed = true;
      m.events.landSpeed = memo.fallSpeed;
   }
   if (anim.stungAt !== memo.stungAt || anim.bailAt !== memo.bailAt || anim.lostAt !== memo.lostAt) {
      memo.stungAt = anim.stungAt;
      memo.bailAt = anim.bailAt;
      memo.lostAt = anim.lostAt;
      m.events.hurt = true;
      m.events.hurtX = 1;
      m.events.hurtZ = 0;
   }
   if (!h.grounded) memo.fallSpeed = Math.max(0, -m.vy);
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The surf stance (pure, allocation-free): side-on to the plate (the Scene turns the body to face the
 * wave), feet wide along the plate, knees bent by `crouch` (0..1), the lead arm (the hero's left,
 * down the line) out in front and the back arm out behind, the head turned down the line; `lean`
 * (-1..1) rocks the body to its toes (a carve up the face) or its heels (a carve down).
 */
export function surfStancePose(crouch: number, lean: number, out: HumanoidPose): HumanoidPose {
   out.q.fill(0);
   for (let i = 3; i < out.q.length; i += 4) out.q[i] = 1;
   out.dropL = 1;
   out.dropR = 1;
   out.lift = 0;
   out.ground = 1;
   const c = clamp01(crouch);
   for (let side = 1; side >= -1; side -= 2) {
      // the thigh forward (a squat) and out (the wide stance); the knee folds back
      setBoneEuler(out.q, side > 0 ? BONE.upperLegL : BONE.upperLegR, -(0.22 + 0.3 * c), 0, side * (0.34 + 0.06 * c));
      setBoneEuler(out.q, side > 0 ? BONE.lowerLegL : BONE.lowerLegR, 0.4 + 0.6 * c, 0, 0);
      levelFoot(out, side);
   }
   // the trunk leans in over the knees, rocked by the carve
   setBoneEuler(out.q, BONE.spine, 0.12 + 0.12 * c + 0.16 * lean, 0.12, 0);
   setBoneEuler(out.q, BONE.chest, 0.06, 0.18, -0.05 * lean);
   // the head looks down the line (the hero's left)
   setBoneEuler(out.q, BONE.neck, -0.12, 0.5, 0);
   setBoneEuler(out.q, BONE.head, -0.18, 0.55, 0);
   // arms out for balance: the lead arm forward-left, the back arm out behind
   aimArm(out, 1, 0.92, -0.18 + 0.12 * lean, 0.34, 0.8, -0.32, 0.5);
   aimArm(out, -1, -0.88, -0.26 - 0.1 * lean, 0.3, -0.72, -0.48, 0.5);
   return out;
}

/** The grab: tucked tight, the lead hand down to the plate's rail. */
export function grabPose(out: HumanoidPose): HumanoidPose {
   surfStancePose(1, 0.2, out);
   setBoneEuler(out.q, BONE.upperLegL, -1.35, 0, 0.3);
   setBoneEuler(out.q, BONE.upperLegR, -1.35, 0, -0.3);
   setBoneEuler(out.q, BONE.lowerLegL, 1.9, 0, 0);
   setBoneEuler(out.q, BONE.lowerLegR, 1.9, 0, 0);
   aimArm(out, 1, 0.2, -0.9, 0.4, 0.1, -0.9, 0.4);
   out.ground = 0;
   return out;
}

interface SurfLook {
   weight: number;
   crouch: number;
   lean: number;
   grab: number;
}

/** The shared animator's pipeline (menu2/heroAnim useHeroAnimator) with the surf stance and the grab blended over it. */
function useSurfAnimator(heroId: M2HeroId, motion: HeroMotion, look: SurfLook): HeroAnimator {
   const time = useGameTime();
   const juice = useJuice();
   const hasJuice = useHasJuice();
   const [state] = useState(() => createHeroAnimState({ topSpeed: V_MAX, jumpSpeed: V_AIR }));
   // facing the wave: the plate's group points along the ride, the hero turns side-on to it
   const [body] = useState(() => createHeroBody(-Math.PI / 2));
   const fit = useMemo(() => heroBallFit(heroId, HERO_BALL_RADIUS), [heroId]);
   const [extras] = useState<RunExtras>(() => ({ surge: 0 }));
   const stance = useMemo(createPose, []);
   const grab = useMemo(createPose, []);
   const animator = useMemo<HeroAnimator>(() => ({ heroId, pose: null as unknown as HumanoidPose, state, body, fit, motion, dt: 0 }), [heroId, state, body, fit, motion]);
   const pose = useHumanoidPose((p) => {
      const dt = hasJuice ? juice.visualDt() : time.delta;
      animator.dt = dt;
      const L = HERO_LANDMARKS[heroId];
      stepHeroAnimState(state, motion, dt);
      advanceHeroGait(state, L, HERO_SCALE[heroId], dt);
      composeHeroPose(state, L, p, extras);
      if (look.weight > 0.001) {
         surfStancePose(look.crouch, look.lean, stance);
         // the hurt recoil and the cheer keep their arms
         const w = state.weights;
         const keep = w[HS.hurt] + w[HS.cheer] + w[HS.defeat] + w[HS.ball];
         blendPoses(p, stance, look.weight * (1 - clamp01(keep)), p);
         if (keep < 0.5) blendPoses(p, stance, look.weight * 0.6, p, POSE_MASK.legs);
      }
      if (look.grab > 0.001) blendPoses(p, grabPose(grab), look.grab, p);
      stepHeroBody(body, state, motion, fit, extras.surge * HERO_SCALE[heroId], dt);
   });
   animator.pose = pose;
   return animator;
}

export function Hero({ run, anim, shadowY }: { run: SurfRun; anim: HeroAnim; shadowY?: MutableRefObject<number> }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const heading = useRef<Group>(null);
   const bank = useRef<Group>(null);
   const trick = useRef<Group>(null);
   const glow = useRef<Mesh>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const look = useMemo<SurfLook>(() => ({ weight: 1, crouch: 0.4, lean: 0, grab: 0 }), []);
   const animator = useSurfAnimator(run.heroId, motion, look);
   const smooth = useRef({ yaw: Math.PI, bank: 0, roll: 0, spin: 0, flip: 0 });

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
   }, FRAME_PRIORITY.camera + 0.1);

   useFrame((_s, delta) => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      const now = time.now;
      const dt = Math.min(0.1, delta);
      const ease = (k: number) => 1 - Math.exp(-k * dt);
      const sm = smooth.current;
      let y = h.y + PLATE_DECK;
      let visible = true;
      let s = 1;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }
      if (h.state === "lost") s = Math.max(0, 1 - (now - anim.lostAt) / 1.0);
      else if (h.state === "spawn") {
         const t = Math.min(1, (now - anim.spawnAt) / 0.45);
         s = t < 1 ? Math.sin(t * Math.PI * 0.5) * (1 + 0.25 * Math.sin(t * Math.PI)) : 1;
      }
      g.visible = visible && s > 0.001;
      g.position.set(h.x, y, h.z);
      g.scale.setScalar(Math.max(0.001, s));
      // the plate points along the line it carves; it rolls square to the face and banks into the carve
      const v = Math.max(1, h.v);
      const wantYaw = Math.PI + Math.atan2(-h.vx, v) * 0.85;
      sm.yaw += (wantYaw - sm.yaw) * ease(10);
      const wantRoll = h.grounded ? -Math.atan(faceSlope(h.x, run.course.H)) : sm.roll * 0.98;
      sm.roll += (wantRoll - sm.roll) * ease(h.grounded ? 14 : 3);
      const wantBank = h.grounded ? Math.max(-0.35, Math.min(0.35, -h.vx * 0.035)) : 0;
      sm.bank += (wantBank - sm.bank) * ease(8);
      if (heading.current) heading.current.rotation.y = sm.yaw;
      if (bank.current) bank.current.rotation.z = sm.roll + sm.bank;
      // the stance: lower at speed and on a pump, the lean by the carve, the grab tuck
      const riding = h.grounded && h.state === "play" && Number.isNaN(anim.intro) ? 1 : !h.grounded && h.state === "play" ? 0.55 : 0;
      look.weight += (riding - look.weight) * ease(8);
      const pump = Math.max(0, 1 - (now - anim.pumpAt) / 0.35);
      look.crouch = 0.12 + 0.3 * (h.v / V_MAX) + 0.45 * pump;
      look.lean += (Math.max(-1, Math.min(1, h.vx / 7)) - look.lean) * ease(9);
      const grabbing = !h.grounded && h.trick === 3 ? 1 : 0;
      look.grab += (grabbing - look.grab) * ease(14);
      // the trick's turn: a spin about the plate's up axis or a flip over it, done when the trick counts
      const k = !h.grounded && h.trick !== 0 ? clamp01(h.trickMs / TRICK_MS) : 0;
      const turn = k * k * (3 - 2 * k) * Math.PI * 2;
      sm.spin = h.trick === 1 && !h.grounded ? turn : sm.spin * (1 - ease(12));
      sm.flip = h.trick === 2 && !h.grounded ? turn : sm.flip * (1 - ease(12));
      if (trick.current) {
         trick.current.rotation.set(sm.flip, sm.spin, 0);
      }
      // the plate glows on a pump (the card's "thrum")
      const gm = glow.current;
      if (gm) {
         gm.visible = pump > 0.02 || h.dashUntil >= run.simMs;
         (gm.material as MeshBasicMaterial).opacity = 0.75 * Math.max(pump, h.dashUntil >= run.simMs ? 0.6 : 0);
      }
      const tw = now - anim.winAt;
      if (tw >= 0 && tw < 2) animator.body.yaw += animator.dt * 5 * (1 - tw / 2);
      const sh = shadow.current;
      if (sh) {
         const top = shadowY ? shadowY.current : h.y;
         const above = y - PLATE_DECK - top;
         sh.visible = g.visible && h.state !== "lost" && above < 10;
         sh.position.set(h.x, top + 0.05, h.z);
         sh.rotation.set(-Math.PI / 2, -Math.atan(faceSlope(h.x, run.course.H)), 0, "YXZ");
         const kk = Math.max(0.35, 1 - above / 6);
         sh.scale.set(kk, kk * 1.6, kk);
         (sh.material as MeshBasicMaterial).opacity = 0.3 * kk;
      }
   });

   const accent = heroAccent(run.heroId);
   return (
      <>
         <group ref={root}>
            <group ref={heading}>
               <group ref={bank}>
                  <group ref={trick} position={[0, 0.6, 0]}>
                     <group position={[0, -0.6, 0]}>
                        <group position={[0, -PLATE_DECK, 0]}>
                           <Model asset={ASSETS.plate} scale={PLATE_SCALE} />
                        </group>
                        <mesh ref={glow} position={[0, -PLATE_DECK + 0.05, 0]} rotation-x={-Math.PI / 2} visible={false}>
                           <planeGeometry args={[0.9, 2.1]} />
                           <meshBasicMaterial color={accent} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
                        </mesh>
                        <AnimatedHero animator={animator} />
                     </group>
                  </group>
               </group>
            </group>
         </group>
         <mesh ref={shadow} renderOrder={1}>
            <circleGeometry args={[0.55, 24]} />
            <meshBasicMaterial color="#04263a" transparent opacity={0.3} depthWrite={false} />
         </mesh>
      </>
   );
}
