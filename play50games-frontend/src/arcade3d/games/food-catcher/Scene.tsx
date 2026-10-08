"use client";

// Food Catcher scene. rules.ts owns the catch; this file steps it once per frame and draws it.
// The run object is created once per mount (GameShell remounts the Scene on retry). The frame
// loop mutates it and never calls setState. Visuals read it and animate with useGameTime().
// Only FittedCamera re-renders when the fit changes (resize, cookie banner); everything else is
// memoised and moves in useFrame.
// The chef GLB is a static T-pose: <HumanoidModel> (core/rig) rigs it in code and useHumanoidPose
// drives its limbs (poses.ts: the idle, a walk by its speed with the feet on the ground, the lean
// into the run in its spine, a reach up on a catch). ChefPrimitive stays as the fallback.
import { memo, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Raycaster, Vector2, type Camera, type Group } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { Model } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import type { AABB } from "@/arcade3d/core/collision";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { HumanoidModel, createPose, useHumanoidPose } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView, type FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import { chefPose, chefRootRoll, createChefGait, stepChefGait } from "./poses";
import {
   ApplePrimitive,
   BadRing,
   BananaPrimitive,
   BurgerPrimitive,
   ChefPrimitive,
   Kitchen,
   SockPrimitive,
   TinPrimitive,
   WORKTOP_TOP_Y,
} from "./Primitives";
import {
   CHEF,
   MAX_ALIVE,
   createRun,
   itemY,
   step,
   type ItemKind,
   type RunState,
   type StepInput,
} from "./rules";

const LOOK_AT: [number, number, number] = [0, 3.25, 0];
/** Side-on view: the play rectangle stands in XY and the camera sits on +z. */
const PLAY: AABB = {
   min: { x: -4.2, y: 0, z: -0.9 },
   max: { x: 4.2, y: 6.5, z: 1.05 },
};
const VIEW: FittedViewOptions = {
   area: PLAY,
   pitch: 0,
   yaws: [0],
   focus: [{ x: 0, y: 3.25, z: 0 }],
   fov: 40,
   padding: 8,
   shift: true,
};

const ITEM_Z = 0.2;
const CHEF_Z = 0.55;
const KINDS: readonly ItemKind[] = ["apple", "banana", "burger", "sock", "tinCan"];

interface Scratch {
   ray: Raycaster;
   ndc: Vector2;
   /** this frame's input to step(), rewritten every frame (no per-frame allocation) */
   input: StepInput;
}

type ViewRun = RunState & { flashAt: number; flashX: number };

function projectFingerX(pointerX: number, pointerY: number, camera: Camera, scratch: Scratch): number | null {
   scratch.ndc.set(pointerX, pointerY);
   scratch.ray.setFromCamera(scratch.ndc, camera);
   const origin = scratch.ray.ray.origin;
   const dir = scratch.ray.ray.direction;
   if (!(Math.abs(dir.z) > 1e-5)) return null;
   const t = -origin.z / dir.z;
   if (!(t > 0)) return null;
   return origin.x + dir.x * t;
}

const Simulation = memo(function Simulation({ run, scratch }: { run: ViewRun; scratch: Scratch }) {
   const input = useInput();
   const camera = useThree((state) => state.camera);
   const time = useGameTime();

   useRunFrame((_state, dt) => {
      const pointer = input.current.pointer;
      const moveX = input.current.moveX;
      const stepInput = scratch.input;
      stepInput.targetX = pointer.down ? projectFingerX(pointer.x, pointer.y, camera, scratch) : null;
      stepInput.dir = moveX < -0.5 ? -1 : moveX > 0.5 ? 1 : 0;
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      if (ev.caught > 0 || ev.missed > 0 || ev.badCaught > 0 || ev.lifeLost || ev.ended) {
         store.setScore(run.score);
         store.setStat("combo", run.combo);
      }
      if (ev.caught > 0) {
         run.flashAt = time.now;
         run.flashX = run.chefX;
         playSfx("pickup");
      }
      if (ev.badCaught > 0) {
         run.flashAt = time.now;
         run.flashX = run.chefX;
         playSfx("hit");
      }
      for (let i = 0; i < ev.badCaught; i++) store.loseLife();
      if (ev.ended === "timeup") store.end("timeup");
      else if (ev.ended === "lose" && useArcadeStore.getState().phase !== "over") store.end("lose");
   });

   return null;
});

const Chef = memo(function Chef({ run }: { run: ViewRun }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const turn = useRef<Group>(null);
   const bob = useRef<Group>(null);
   const standIn = useRef<Group>(null);
   const [gait] = useState(createChefGait);
   const [scratch] = useState(createPose);

   // the GLB chef's limbs (core/rig, poses.ts), FRAME_PRIORITY.pose: after the step, before the
   // useFrame below. Idle (a breath and a glance) when still; a walk whose amount eases with |chefV|
   // and whose phase advances by the distance run over the contact stride, so the planted foot
   // stays put (the chef turns to face the way it runs and leans its spine into the speed); on a
   // catch (run.flashAt, set by the simulation on a good or a bad catch) both arms reach up towards
   // the item for REACH_S and drop again.
   const pose = useHumanoidPose((p) => {
      const playing = useArcadeStore.getState().phase === "playing";
      stepChefGait(gait, playing ? run.chefV : 0, time.delta);
      chefPose(gait, time.now, time.now - run.flashAt, p, scratch);
   });

   // looks only: follows the simulated chef; the stand-in leans into its speed about its feet and
   // bobs with it as before, the GLB turns the way it runs (its spine leans: poses.ts) and rises and
   // falls with its planted foot
   useFrame(() => {
      const g = root.current;
      const facing = turn.current;
      const body = bob.current;
      if (!g || !facing || !body) return;
      const fallback = standIn.current !== null;
      g.position.x = run.chefX;
      const speed = Math.min(1, Math.abs(run.chefV) / CHEF.maxSpeed);
      g.rotation.z = chefRootRoll(run.chefV, !fallback);
      facing.rotation.y = fallback ? 0 : gait.yaw;
      body.position.y = fallback ? Math.abs(Math.sin(time.now * 10)) * 0.04 * speed : gait.lift;
   });

   // the root stands on the worktop's top face (y 0.05), so the soles are on the board, not inside it
   return (
      <group ref={root} position={[0, WORKTOP_TOP_Y, CHEF_Z]} name="chef">
         <group ref={turn}>
            <group ref={bob}>
               {/* the group above carries the body's height (gait.lift), so the model does not add it again */}
               <HumanoidModel
                  asset={ASSETS.chef}
                  pose={pose}
                  applyLift={false}
                  fallback={
                     <group ref={standIn}>
                        <ChefPrimitive />
                     </group>
                  }
               />
            </group>
         </group>
      </group>
   );
});

const FallingItem = memo(function FallingItem({ index, run }: { index: number; run: RunState }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const shown = useRef<Array<Group | null>>([]);
   const ring = useRef<Group>(null);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const item = run.items[index];
      if (!item.active) {
         g.visible = false;
         return;
      }
      g.visible = true;
      const y = itemY(item.bornMs, run.elapsedMs, item.speed);
      g.position.set(item.x, y, ITEM_Z);
      g.rotation.z = Math.sin(time.now * 1.4 + index) * 0.15;
      for (let k = 0; k < KINDS.length; k++) {
         const child = shown.current[k];
         if (child) child.visible = KINDS[k] === item.kind;
      }
      if (ring.current) ring.current.visible = item.bad;
   });

   return (
      <group ref={root} visible={false} name={`item-${index}`}>
         {KINDS.map((kind, k) => (
            <group
               key={kind}
               ref={(el) => {
                  shown.current[k] = el;
               }}
               visible={false}
            >
               <Model
                  asset={ASSETS[kind]}
                  fallback={
                     kind === "apple" ? (
                        <ApplePrimitive />
                     ) : kind === "banana" ? (
                        <BananaPrimitive />
                     ) : kind === "burger" ? (
                        <BurgerPrimitive />
                     ) : kind === "sock" ? (
                        <SockPrimitive />
                     ) : (
                        <TinPrimitive />
                     )
                  }
               />
            </group>
         ))}
         <group ref={ring} visible={false}>
            <BadRing />
         </group>
      </group>
   );
});

const CatchFlash = memo(function CatchFlash({ run }: { run: ViewRun }) {
   const time = useGameTime();
   const ring = useRef<Group>(null);

   useFrame(() => {
      const g = ring.current;
      if (!g) return;
      const k = (time.now - run.flashAt) / 0.35;
      g.visible = k >= 0 && k < 1;
      if (!g.visible) return;
      g.position.set(run.flashX, 1.55, ITEM_Z);
      const scale = 0.4 + k * 1.4;
      g.scale.setScalar(scale);
   });

   return (
      <group ref={ring} visible={false}>
         <mesh>
            <ringGeometry args={[0.35, 0.48, 24]} />
            <meshBasicMaterial color="#86efac" transparent opacity={0.85} depthWrite={false} />
         </mesh>
      </group>
   );
});

/** The static camera: the only component that re-renders when the fit changes. */
function FittedCamera() {
   const view = useFittedView(VIEW);
   return (
      <CameraRig
         camera={{
            position: [LOOK_AT[0] + view.offset[0], LOOK_AT[1] + view.offset[1], LOOK_AT[2] + view.offset[2]],
            fov: VIEW.fov,
            lookAt: LOOK_AT,
         }}
         offset={view.offset}
         shift={view.shift}
         damping={6}
      />
   );
}

export default function Scene() {
   const [run] = useState<ViewRun>(() => Object.assign(createRun(randomSeed()), { flashAt: -10, flashX: 0 }));
   const scratch = useMemo<Scratch>(
      () => ({ ray: new Raycaster(), ndc: new Vector2(), input: { targetX: null, dir: 0 } }),
      []
   );
   const slots = useMemo(() => Array.from({ length: MAX_ALIVE }, (_v, i) => i), []);

   return (
      <>
         <Simulation run={run} scratch={scratch} />
         <FittedCamera />
         <Kitchen />
         <Chef run={run} />
         {slots.map((index) => (
            <FallingItem key={index} index={index} run={run} />
         ))}
         <CatchFlash run={run} />
      </>
   );
}
