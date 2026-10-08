"use client";

// Penalty Hero scene. rules.ts owns every shot; this file steps it once per frame and draws it.
// The run object is created once per mount (GameShell remounts the Scene on retry). The frame
// loop mutates it and never calls setState. Visuals read it and animate with useGameTime().
// The striker and the keeper GLBs are static T-poses: <HumanoidModel> (core/rig) rigs them in code
// and useHumanoidPose drives their limbs from the same run-up / flight / hold progress the groups
// animate (poses.ts: the kick, the ready stance, the dive). The ball is BallPrimitive, centred in the
// ball's spin group (ball.test.ts): neither Hyper3D ball GLB had black panels (README "Models").
// The other primitives stay as the characters' fallbacks.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   BufferGeometry,
   Color,
   Float32BufferAttribute,
   Plane,
   Raycaster,
   Vector2,
   Vector3,
   type Camera,
   type Group,
   type MeshBasicMaterial,
} from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx } from "@/arcade3d/core/audio";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { BlobShadow } from "@/arcade3d/core/render";
import { HumanoidModel, blendPoses, createPose, useHumanoidPose } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import { CAMERA_FOV, CAMERA_LOOK_AT, PENALTY_VIEW } from "./camera";
import { FEEDBACK } from "./Hud";
import { KEEPER_BOUNCE, KEEPER_HIP, KEEPER_ROOT, SPOT_Z, STRIKER_ROOT, keeperDip, keeperDivePlacement, keeperSway } from "./layout";
import { keeperDivePose, keeperReadyPose } from "./poses";
import { BallPrimitive, Goal, KeeperPrimitive, Stadium, StrikerPrimitive } from "./Primitives";
import { KICK_LEAN, RUNUP_LEAN, createStrikerFrame, drawStrikerPose, strikerFrame, strikerPose } from "./strikerMotion";
import {
   AIM_TIMEOUT_MS,
   BALL_SPOT,
   FLIGHT_MS,
   HOLD_MS,
   RETICLE_AMPLITUDE,
   RETICLE_BAND,
   ZONES,
   ZONE_CENTRE_X,
   ZONE_CENTRE_Y,
   ZONE_WIDTH,
   aimPresses,
   createRun,
   isAccurate,
   reticleOffset,
   step,
   zoneAt,
   zoneIndex,
   type AimPresses,
   type RunState,
   type StepInput,
   type ZoneId,
} from "./rules";
import { ZONE_IDLE_OPACITY, ZONE_PLANE_Z, zoneOpacity } from "./zones";

const ZONE_H = 1.22;
const RING_ON = new Color("#4ade80");
const RING_OFF = new Color("#fbbf24");

interface Scratch {
   ray: Raycaster;
   ndc: Vector2;
   point: Vector3;
   plane: Plane;
   aim: Required<AimPresses>;
   input: StepInput;
}

type ViewRun = RunState & { lastShots: number; aimLeft: number; goalMask: number };

/** Canvas press (pointer coords) -> zone of the goal plane z = 0. Meshes are never hit-tested. */
function tapZone(x: number, y: number, camera: Camera, scratch: Scratch): ZoneId | null {
   scratch.ndc.set(x, y);
   scratch.ray.setFromCamera(scratch.ndc, camera);
   const hit = scratch.ray.ray.intersectPlane(scratch.plane, scratch.point);
   return hit ? zoneAt(hit.x, hit.y) : null;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
   const t = clamp01(v);
   return t * t * (3 - 2 * t);
};

function Simulation({ run, scratch }: { run: ViewRun; scratch: Scratch }) {
   const input = useInput();
   const camera = useThree((state) => state.camera);

   useRunFrame((_state, dt) => {
      const inp = input.current;
      const frame = scratch.input;
      // Keyboard aim: arrow / WASD keydowns, never lost between frames. Swipes do not aim.
      frame.pressed = aimPresses(inp.pressed, inp.swipe, scratch.aim);
      frame.jumpPressed = inp.jumpPressed;
      frame.actionPressed = inp.actionPressed;
      // Touch / click shoots on the press (tapDown), with the reticle that was on screen then.
      // `tap` would wait for the release and judge the shot 100-350 ms late.
      const down = inp.tapDown;
      frame.zoneId = down && run.phase === "aim" ? tapZone(down.x, down.y, camera, scratch) : null;
      const shotIndex = run.shotsDone;
      const ev = step(run, dt * 1000, frame);
      const store = useArcadeStore.getState();
      if (ev.goal) {
         run.goalMask |= 1 << shotIndex;
         store.setScore(run.score);
         store.setStat("goalMask", run.goalMask);
         store.setStat("feedback", FEEDBACK.goal);
         playSfx("pickup");
      } else if (ev.saved || ev.wide || ev.timeout) {
         store.setStat("feedback", ev.timeout ? FEEDBACK.timeout : ev.wide ? FEEDBACK.wide : FEEDBACK.saved);
         playSfx("hit");
      }
      if (ev.goal || ev.saved || ev.wide || ev.timeout) {
         store.setStat("goals", run.goals);
         store.setStat("streak", run.streak);
      }
      if (run.shotsDone !== run.lastShots) {
         run.lastShots = run.shotsDone;
         store.setStat("shots", run.shotsDone);
         if (!ev.ended) store.setStat("feedback", FEEDBACK.none);
      }
      const aimLeft = run.phase === "aim" ? Math.ceil((AIM_TIMEOUT_MS - run.aimMs) / 1000) : 0;
      if (aimLeft !== run.aimLeft) {
         run.aimLeft = aimLeft;
         store.setStat("aimLeft", aimLeft);
      }
      if (ev.ended) store.end("win");
   });

   return null;
}

/**
 * Zone tiles behind the reticle: the highlighted one is bright, the rest faint. The ball in the net is
 * seen through them, so the highlight fades to faint over the end of the flight (zones.ts).
 */
function Zones({ run }: { run: RunState }) {
   const time = useGameTime();
   const mats = useRef<Array<MeshBasicMaterial | null>>([]);
   const dividers = useMemo(() => {
      const half = ZONE_WIDTH / 2;
      const g = new BufferGeometry();
      g.setAttribute(
         "position",
         new Float32BufferAttribute([-half, 0, 0, -half, 2 * ZONE_H, 0, half, 0, 0, half, 2 * ZONE_H, 0, -3 * half, ZONE_H, 0, 3 * half, ZONE_H, 0], 3)
      );
      return g;
   }, []);
   useEffect(() => () => dividers.dispose(), [dividers]);

   useFrame(() => {
      const selected = zoneIndex(run.col, run.row);
      const pulse = run.phase === "aim" ? 0.06 * Math.sin(time.now * 5) : 0;
      for (let i = 0; i < ZONES.length; i++) {
         const mat = mats.current[i];
         if (!mat) continue;
         mat.opacity = zoneOpacity(run.phase, run.phaseMs, i === selected, pulse);
      }
   });

   return (
      <group name="zones" position={[0, 0, ZONE_PLANE_Z]}>
         <lineSegments geometry={dividers}>
            <lineBasicMaterial color="#f8fafc" transparent opacity={0.55} depthWrite={false} />
         </lineSegments>
         {ZONES.map((id, i) => {
            const col = i % 3;
            const row = i < 3 ? 1 : 0;
            return (
               <mesh key={id} position={[ZONE_CENTRE_X[col], ZONE_CENTRE_Y[row], 0]}>
                  <planeGeometry args={[ZONE_WIDTH - 0.08, ZONE_H - 0.08]} />
                  <meshBasicMaterial
                     ref={(m) => {
                        mats.current[i] = m;
                     }}
                     color="#f472b6"
                     transparent
                     opacity={ZONE_IDLE_OPACITY}
                     depthWrite={false}
                  />
               </mesh>
            );
         })}
      </group>
   );
}

/** Wobbling ring over the highlighted zone, with the white accuracy band at the zone centre. */
function Reticle({ run }: { run: RunState }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const ring = useRef<Group>(null);
   const ringMat = useRef<MeshBasicMaterial>(null);
   const halfZone = ZONE_WIDTH / 2;

   useFrame(() => {
      const g = root.current;
      const r = ring.current;
      const mat = ringMat.current;
      if (!g || !r || !mat) return;
      g.visible = run.phase === "aim" && !run.ended;
      if (!g.visible) return;
      g.position.set(ZONE_CENTRE_X[run.col], ZONE_CENTRE_Y[run.row], 0.06);
      const offset = reticleOffset(run.aimMs, run.reticlePhase);
      r.position.x = (offset / RETICLE_AMPLITUDE) * halfZone * 0.85;
      const accurate = isAccurate(offset);
      mat.color.copy(accurate ? RING_ON : RING_OFF);
      r.scale.setScalar(1 + 0.05 * Math.sin(time.now * 9));
   });

   const band = (RETICLE_BAND / RETICLE_AMPLITUDE) * halfZone * 0.85 * 2;
   return (
      <group ref={root} name="reticle">
         <mesh>
            <planeGeometry args={[band, ZONE_H - 0.2]} />
            <meshBasicMaterial color="#f8fafc" transparent opacity={0.4} depthWrite={false} />
         </mesh>
         <group ref={ring}>
            <mesh>
               <ringGeometry args={[0.2, 0.28, 32]} />
               <meshBasicMaterial ref={ringMat} color="#fbbf24" depthWrite={false} transparent opacity={0.95} />
            </mesh>
         </group>
      </group>
   );
}

function Ball({ run }: { run: RunState }) {
   const root = useRef<Group>(null);
   const spin = useRef<Group>(null);
   const shadow = useRef<Group>(null);

   useFrame(() => {
      const g = root.current;
      const s = spin.current;
      const sh = shadow.current;
      if (!g || !s || !sh) return;
      let x: number = BALL_SPOT.x;
      let y: number = BALL_SPOT.y;
      let z = SPOT_Z;
      const shot = run.pending.kind === "shot";
      if (shot && run.phase === "flight") {
         const p = run.phaseMs / FLIGHT_MS;
         x = run.targetX * p;
         y = BALL_SPOT.y + (run.targetY - BALL_SPOT.y) * p + Math.sin(Math.PI * p) * 0.45;
         z = SPOT_Z * (1 - p);
         s.rotation.x = -p * 14;
      } else if (shot && run.phase === "hold") {
         const q = run.phaseMs / HOLD_MS;
         if (run.lastResult === "goal") {
            x = run.targetX * (1 - 0.1 * q);
            y = Math.max(BALL_SPOT.y, run.targetY - run.targetY * q * q);
            z = -1.25 * smooth(q * 2);
         } else if (run.lastResult === "saved") {
            x = run.targetX * (1 - 0.5 * q);
            y = Math.max(BALL_SPOT.y, run.targetY * (1 - q) + Math.sin(Math.PI * q) * 0.6);
            z = 0.3 + 3.2 * q;
         } else {
            x = run.targetX + Math.sign(run.targetX) * 0.8 * q;
            y = Math.max(BALL_SPOT.y, run.targetY * (1 - q));
            z = -3.5 * q;
         }
         s.rotation.x = -14 - q * 4;
      } else {
         s.rotation.x = 0;
      }
      g.position.set(x, y, z);
      sh.position.set(x, 0, z);
      sh.scale.setScalar(1 / (1 + y * 0.6));
   });

   return (
      <>
         <group ref={root} name="ball-root">
            <group ref={spin}>
               <BallPrimitive />
            </group>
         </group>
         <group ref={shadow}>
            <BlobShadow radius={0.16} />
         </group>
      </>
   );
}

function Striker({ run }: { run: RunState }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const standIn = useRef<Group>(null);
   const [target] = useState(createPose);
   const [scratch] = useState(createPose);
   const [frame] = useState(createStrikerFrame);

   // the GLB striker's limbs (core/rig), FRAME_PRIORITY.pose, from strikerMotion.ts: the idle while
   // aiming, the run-up's stride and the kick's backswing, the follow-through over the flight, and
   // the walk back through the hold into the next aim, every foot planted where it lands. The target
   // is eased into, so a phase change never pops; planted legs are drawn exactly (an eased leg would
   // lag its spot and slide the boot).
   const pose = useHumanoidPose((p) => {
      strikerFrame(run, frame);
      drawStrikerPose(p, target, strikerPose(run, frame, time.now, target, scratch), time.delta);
   });

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      // the run-up towards the ball and the walk back (strikerMotion.ts, layout.ts): the kicking foot ends beside the ball
      strikerFrame(run, frame);
      const fallback = standIn.current !== null;
      // the stand-in's stride and step bob, idle bob and whole-body lean; the GLB walks and leans in its own joints
      const bob = fallback ? frame.bob * 0.05 : 0;
      const idle = fallback && run.phase === "aim" && frame.mode === "idle" ? Math.sin(time.now * 2.4) * 0.01 : 0;
      g.position.set(frame.x, bob + idle, frame.z);
      g.rotation.x = fallback ? -RUNUP_LEAN * frame.lean - KICK_LEAN * frame.kick : 0;
      g.rotation.y = frame.yaw;
   });

   return (
      <group ref={root} position={STRIKER_ROOT} name="striker">
         <HumanoidModel
            asset={ASSETS.striker}
            pose={pose}
            fallback={
               <group ref={standIn}>
                  <StrikerPrimitive />
               </group>
            }
         />
         <BlobShadow radius={0.4} />
      </group>
   );
}

/** The keeper's dive progress 0..1 (the leap, the roll) from the shot's phases. */
function diveProgress(run: RunState): number {
   if (run.keeperIndex >= 0 && run.phase === "flight") return smooth((run.phaseMs / FLIGHT_MS) * 1.3);
   if (run.keeperIndex >= 0 && run.phase === "hold") return 1 - smooth((run.phaseMs - HOLD_MS * 0.4) / (HOLD_MS * 0.6));
   return 0;
}

/** The side of the zone the keeper dives to: -1 / 0 / 1 along x (the middle while it does not dive). */
function diveSide(run: RunState): -1 | 0 | 1 {
   const k = run.keeperIndex;
   const col = k >= 0 ? k % 3 : 1;
   return col === 0 ? -1 : col === 2 ? 1 : 0;
}

/** The row of the zone the keeper dives to: 1 high, 0 low. */
function diveRow(run: RunState): 0 | 1 {
   const k = run.keeperIndex;
   return k >= 0 && k < 3 ? 1 : 0;
}

function Keeper({ run }: { run: RunState }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const hip = useRef<Group>(null);
   const standIn = useRef<Group>(null);
   const [scratch] = useState(createPose);
   const [place] = useState(() => ({ x: 0, y: 0, roll: 0 }));
   const scale = ASSETS.keeper.scale ?? 1;

   // the GLB keeper's limbs (core/rig): the ready stance (knees bent, gloves out, breathing, its
   // weight shifting with the group's sway over planted feet and a bounce in its knees: poses.ts),
   // blended into the dive towards the ball's zone by the same dive progress that moves and rolls
   // the group (which also fades the sway out). The keeper faces +z, so the zone's side is its own
   // (+1 = its left = +x).
   const pose = useHumanoidPose((p) => {
      const dive = diveProgress(run);
      keeperReadyPose(time.now, p, (keeperSway(time.now, true) * (1 - dive)) / scale, keeperDip(time.now));
      if (dive > 0.001) blendPoses(p, keeperDivePose(diveSide(run), diveRow(run), scratch), dive, p);
   });

   useFrame(() => {
      const g = root.current;
      const h = hip.current;
      if (!g || !h) return;
      const fallback = standIn.current !== null;
      const dive = diveProgress(run);
      const side = diveSide(run);
      const row = diveRow(run);
      // the sway fades out into the dive and back in after it (it never jumps); the stand-in slides
      // and hops, the GLB shifts its weight over its planted feet and bounces in its knees (the pose)
      const sway = keeperSway(time.now, !fallback);
      const hop = fallback && run.phase === "aim" ? Math.abs(Math.sin(time.now * KEEPER_BOUNCE.rate)) * KEEPER_BOUNCE.standIn : 0;
      // the leap and the roll about the hip (layout.ts: the GLB's low side dive stays above the grass)
      keeperDivePlacement(dive, side, row, !fallback, place);
      g.position.set(KEEPER_ROOT[0] + sway * (1 - dive) + place.x, hop + place.y, KEEPER_ROOT[2]);
      h.rotation.z = place.roll;
   });

   return (
      <group ref={root} position={KEEPER_ROOT} name="keeper">
         <group ref={hip} position={[0, KEEPER_HIP, 0]}>
            <group position={[0, -KEEPER_HIP, 0]}>
               <HumanoidModel
                  asset={ASSETS.keeper}
                  pose={pose}
                  fallback={
                     <group ref={standIn}>
                        <KeeperPrimitive />
                     </group>
                  }
               />
            </group>
         </group>
         <BlobShadow radius={0.45} />
      </group>
   );
}

export default function Scene() {
   const view = useFittedView(PENALTY_VIEW);
   const [run] = useState<ViewRun>(() =>
      Object.assign(createRun(randomSeed()), { lastShots: 0, aimLeft: 0, goalMask: 0 })
   );
   const scratch = useMemo<Scratch>(
      () => ({
         ray: new Raycaster(),
         ndc: new Vector2(),
         point: new Vector3(),
         plane: new Plane(new Vector3(0, 0, 1), 0),
         aim: { left: false, right: false, up: false, down: false },
         input: {},
      }),
      []
   );

   return (
      <>
         <Simulation run={run} scratch={scratch} />
         <CameraRig
            camera={{
               position: [CAMERA_LOOK_AT[0] + view.offset[0], CAMERA_LOOK_AT[1] + view.offset[1], CAMERA_LOOK_AT[2] + view.offset[2]],
               fov: CAMERA_FOV,
               lookAt: CAMERA_LOOK_AT,
            }}
            offset={view.offset}
            shift={view.shift}
            damping={6}
         />
         <Stadium />
         <Goal />
         <Zones run={run} />
         <Reticle run={run} />
         <Keeper run={run} />
         <Striker run={run} />
         <Ball run={run} />
      </>
   );
}
