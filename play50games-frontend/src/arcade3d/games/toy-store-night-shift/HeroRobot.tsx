"use client";

// The tidy-up robot: toyRobotHero.glb (a real Hyper3D skeleton with six baked clips), driven by one
// AnimationMixer at FRAME_PRIORITY.pose on the pause-safe game clock. Standing idle when still,
// walk / jog by speed with the playback rate matched to the ground speed (root motion stripped, so
// the planted foot stays put), both arms raised under the carried toy (bone overrides after the
// mixer), PointingForward's arms after a right drop, HappyIdle on a win, a damped wobble on a
// wrong drop or a wind-up hit. Every clip change is a crossfade (weights eased every frame).
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AnimationMixer, Quaternion, Vector3, type AnimationAction, type Bone, type Group, type Object3D } from "three";
import { assetScale, useModel } from "@/arcade3d/core/assets";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, HERO_SCALE } from "./assets";
import { HERO_CLIPS, POINT_SECONDS, POINT_WINDOW, gaitFor, inPlace, strideRate, wobble, type HeroClip } from "./heroAnim";
import { HeroFigure } from "./Primitives";
import type { Run } from "./rules";

/** Moments the scene reports (game seconds, -1 = never): a right drop, a wrong drop or a hit. */
export interface HeroCues {
   pointAt: number;
   stunAt: number;
}

/** Crossfade speed (1/s): about 0.2 s to settle. */
const FADE = 12;
/**
 * The arms' lift under a carried toy (model space: +y up, +z forward, +x the robot's left): upper arms up
 * and out past the big head, forearms straight up, hands on the forearm's line (no wrist bent back),
 * fingertips under the toy's edges, which rests on them just over the head (Scene CARRY_Y).
 */
const UPPER_L = new Vector3(0.45, 1, 0.08).normalize();
const FORE_L = new Vector3(-0.08, 1, 0.06).normalize();
const HAND_L = new Vector3(-0.22, 1, 0.04).normalize();
const UPPER_R = new Vector3(-0.45, 1, 0.08).normalize();
const FORE_R = new Vector3(0.08, 1, 0.06).normalize();
const HAND_R = new Vector3(0.22, 1, 0.04).normalize();
/** Upper-body bones the point overlays (the legs keep walking). */
const POINT_BONES = /^(Spine1|Spine2|Neck|Head|(Left|Right)(Shoulder|Arm|ForeArm|Hand.*))$/;

const PQ = new Quaternion();
const WQ = new Quaternion();
const RQ = new Quaternion();
const TQ = new Quaternion();
const D = new Vector3();
const T = new Vector3();
const UP = new Vector3(0, 1, 0);

/** Turns `bone` so its length axis (+y) points along `dirModel` (in the model's space), by `k`. */
function aimBone(bone: Bone, dirModel: Vector3, root: Object3D, k: number): void {
   const parent = bone.parent;
   if (!parent || k <= 0) return;
   parent.updateWorldMatrix(true, false);
   parent.getWorldQuaternion(PQ);
   WQ.copy(PQ).multiply(bone.quaternion);
   D.copy(UP).applyQuaternion(WQ);
   root.getWorldQuaternion(RQ);
   T.copy(dirModel).applyQuaternion(RQ);
   TQ.setFromUnitVectors(D, T).multiply(WQ);
   TQ.premultiply(PQ.invert());
   bone.quaternion.slerp(TQ, k);
}

function RobotRig({ run, cues, scene, animations }: { run: Run; cues: MutableRefObject<HeroCues>; scene: Object3D; animations: ReturnType<typeof useModel>["animations"] }) {
   const time = useGameTime();
   const rig = useMemo(() => {
      const mixer = new AnimationMixer(scene);
      // the point plays on its own mixer and is laid over the arms by a manual blend
      const pointMixer = new AnimationMixer(scene);
      const actions = {} as Record<HeroClip, AnimationAction | null>;
      const speeds = {} as Record<HeroClip, number>;
      for (const key of Object.keys(HERO_CLIPS) as HeroClip[]) {
         const source = animations.find((c) => c.name === HERO_CLIPS[key]);
         if (!source || key === "point") {
            actions[key] = null;
            speeds[key] = 0;
            continue;
         }
         const { clip, speed } = inPlace(source);
         const action = mixer.clipAction(clip);
         action.play();
         action.setEffectiveWeight(key === "idle" ? 1 : 0);
         actions[key] = action;
         speeds[key] = speed;
      }
      const pointSource = animations.find((c) => c.name === HERO_CLIPS.point);
      let point: AnimationAction | null = null;
      if (pointSource) {
         const clip = inPlace(pointSource).clip;
         clip.tracks = clip.tracks.filter((t) => POINT_BONES.test(t.name.split(".")[0]));
         point = pointMixer.clipAction(clip);
         point.play();
      }
      const bone = (name: string) => (scene.getObjectByName(name) as Bone | undefined) ?? null;
      const arms = { lArm: bone("LeftArm"), lFore: bone("LeftForeArm"), lHand: bone("LeftHand"), rArm: bone("RightArm"), rFore: bone("RightForeArm"), rHand: bone("RightHand") };
      const pointBones: Bone[] = [];
      scene.traverse((o) => {
         if ((o as Bone).isBone && POINT_BONES.test(o.name)) pointBones.push(o as Bone);
      });
      const saved = pointBones.map(() => new Quaternion());
      const weights = { idle: 1, walk: 0, jog: 0, crouch: 0, happy: 0, point: 0 } as Record<HeroClip, number>;
      return { mixer, pointMixer, actions, speeds, point, arms, pointBones, saved, weights, gait: "idle" as HeroClip, carry: 0, pointK: 0 };
   }, [scene, animations]);

   useEffect(() => () => {
      rig.mixer.stopAllAction();
      rig.pointMixer.stopAllAction();
      rig.mixer.uncacheRoot(scene);
      rig.pointMixer.uncacheRoot(scene);
   }, [rig, scene]);

   useEffect(() => {
      // skinned bounds are the bind pose: never cull the moving robot
      scene.traverse((o) => { o.frustumCulled = false; });
   }, [scene]);

   useFrame(() => {
      const dt = time.delta;
      const speed = Math.hypot(run.hero.vx, run.hero.vz);
      const won = run.over === "win";
      const gait = won ? "happy" : gaitFor(speed, rig.gait);
      rig.gait = gait;
      const ease = 1 - Math.exp(-FADE * dt);
      for (const key of Object.keys(rig.weights) as HeroClip[]) {
         const action = rig.actions[key];
         if (!action) continue;
         rig.weights[key] += ((key === gait ? 1 : 0) - rig.weights[key]) * ease;
         action.setEffectiveWeight(rig.weights[key]);
         if (key === "walk" || key === "jog") action.setEffectiveTimeScale(strideRate(speed, rig.speeds[key], HERO_SCALE));
      }
      rig.mixer.update(dt);

      // a right drop with empty hands: the point's arms over the legs' clip, faded in and out
      const sincePoint = time.now - cues.current.pointAt;
      const pointing = cues.current.pointAt >= 0 && sincePoint >= 0 && sincePoint < POINT_SECONDS && run.carried.length === 0 && !won;
      rig.pointK += ((pointing ? 1 : 0) - rig.pointK) * ease;
      if (rig.point && rig.pointK > 0.01) {
         const span = POINT_WINDOW.to - POINT_WINDOW.from;
         rig.point.time = POINT_WINDOW.from + Math.min(span, Math.max(0, sincePoint) * (span / POINT_SECONDS));
         rig.pointBones.forEach((b, i) => rig.saved[i].copy(b.quaternion));
         rig.pointMixer.update(0);
         rig.pointBones.forEach((b, i) => b.quaternion.copy(rig.saved[i].slerp(b.quaternion, rig.pointK)));
      }

      // carrying: both arms up under the toy over the head
      rig.carry += ((run.carried.length > 0 && !won ? 1 : 0) - rig.carry) * ease;
      const { lArm, lFore, lHand, rArm, rFore, rHand } = rig.arms;
      if (rig.carry > 0.01 && lArm && lFore && rArm && rFore) {
         aimBone(lArm, UPPER_L, scene, rig.carry);
         aimBone(lFore, FORE_L, scene, rig.carry);
         if (lHand) aimBone(lHand, HAND_L, scene, rig.carry);
         aimBone(rArm, UPPER_R, scene, rig.carry);
         aimBone(rFore, FORE_R, scene, rig.carry);
         if (rHand) aimBone(rHand, HAND_R, scene, rig.carry);
      }
   }, FRAME_PRIORITY.pose);

   return <primitive object={scene} scale={assetScale(ASSETS.hero)} />;
}

/** The hero in its own group: the scene places the group, this wobbles it on a stun. */
export default function HeroRobot({ run, cues }: { run: Run; cues: MutableRefObject<HeroCues> }) {
   const { scene, animations } = useModel(ASSETS.hero);
   const time = useGameTime();
   const wob = useRef<Group>(null);
   useFrame(() => {
      const g = wob.current;
      if (!g) return;
      const roll = cues.current.stunAt >= 0 ? wobble(time.now - cues.current.stunAt) : 0;
      g.rotation.z = roll;
      g.rotation.x = roll * 0.35;
   }, FRAME_PRIORITY.pose);
   return <group ref={wob}>{scene ? <RobotRig run={run} cues={cues} scene={scene} animations={animations} /> : <HeroFigure />}</group>;
}
