"use client";

// Food Catcher scene. rules.ts owns the catch; this file steps it once per frame and draws it.
// The run object is created once per mount (GameShell remounts the Scene on retry). The frame
// loop mutates it and never calls setState. Visuals read it and animate with useGameTime().
// Only FittedCamera re-renders when the fit changes (resize, cookie banner); everything else is
// memoised and moves in useFrame.
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
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView, type FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import {
   ApplePrimitive,
   BadRing,
   BananaPrimitive,
   BurgerPrimitive,
   ChefPrimitive,
   Kitchen,
   SockPrimitive,
   TinPrimitive,
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

const Chef = memo(function Chef({ run }: { run: RunState }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const bob = useRef<Group>(null);

   useFrame(() => {
      const g = root.current;
      const body = bob.current;
      if (!g || !body) return;
      g.position.x = run.chefX;
      const speed = Math.min(1, Math.abs(run.chefV) / CHEF.maxSpeed);
      g.rotation.z = -run.chefV * 0.03;
      body.position.y = Math.abs(Math.sin(time.now * 10)) * 0.04 * speed;
   });

   return (
      <group ref={root} position={[0, 0, CHEF_Z]} name="chef">
         <group ref={bob}>
            <Model asset={ASSETS.chef} fallback={<ChefPrimitive />} />
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
