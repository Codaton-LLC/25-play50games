"use client";

// Warehouse Rush scene: one rules.step() per frame, then everything drawn from the run state.
// The outcome lives in rules.ts (pure, tested); the warehouse look in Primitives.tsx.
// - One run object per Scene mount (GameShell remounts the Scene for every run, so every run gets
//   a new seed from randomSeed()). The frame loop mutates it in place: no setState, no allocation.
// - <Simulation> runs in useRunFrame (only while "playing", before the camera and every plain
//   useFrame), so every visual draws this frame's state.
// - Input is screen-relative: inputToWorld(moveX, moveY, view.yaw) turns the stick with the camera
//   (a portrait phone turns it 90°). Action = actionPressed || jumpPressed (E, Enter, Space, the
//   touch Action button), one-frame events from the core.
// - The store is fed from a cache of the values last published: the first order and "carry" in
//   the store update that starts the run (the outgoing Scene prepares the next run, see nextRun,
//   so the order panel is filled from the first countdown frame) and again on mount, then only
//   what changed after a step. Scene never calls addScore, so the HUD never drifts from the rules.
//   Only the clock ends a run (the store's "timeup"; rules report it too and end() is idempotent).
// - Visuals animate with useGameTime() (pause-safe), never with state.clock.elapsedTime.
// - Boxes: 6 slots (4 pallets, the carried one, the one sinking into a zone), each its own clone of
//   the shared crate GLB with one of 4 recoloured materials (Primitives.tsx useBoxLook).
// - The robot GLB is a static T-pose: <HumanoidModel> (core/rig) rigs it in code. Its legs walk
//   with its speed and its arms go up under the carried box (useHumanoidPose in <Robot>).
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Matrix4, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial, type Sprite, type SpriteMaterial } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { useModel } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import type { AABB } from "@/arcade3d/core/collision";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, randomSeed, turnTowards } from "@/arcade3d/core/math";
import { BlobShadow, DynamicInstanced, useCanvasTexture } from "@/arcade3d/core/render";
import {
   HumanoidModel,
   POSE_MASK,
   blendPoses,
   bodyLift,
   carryPose,
   createPose,
   idlePose,
   useHumanoidPose,
   walkPose,
   walkStride,
   wrapPhase,
} from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { useArcadeStore, type ArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView, type FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, BOX } from "./assets";
import {
   COLORS,
   LID_Y,
   POPUP_DRAWS,
   RobotPrimitive,
   Warehouse,
   firstMesh,
   jitter,
   popupKind,
   useBoxLook,
   zoneCentreX,
   zoneCentreZ,
   type BoxLook,
} from "./Primitives";
import {
   COLOURS,
   NONE,
   PALLET_COUNT,
   PALLET_HEIGHT,
   ROBOT,
   ZONE,
   createRun,
   createStepInput,
   step,
   zoneCornerOf,
   type WarehouseRun,
} from "./rules";

// ---------- camera (README "Scene and camera") ----------

/** Camera tilt above the floor: a three-quarter top-down view (as robot-collector). */
const PITCH = (56 * Math.PI) / 180;
const LOOK_AT: [number, number, number] = [0, 0, 0];
/** floor + walls; y up to 1.2 covers the racks (1.1) and the robot (1.2) */
const WAREHOUSE: AABB = { min: { x: -10.4, y: 0, z: -6.4 }, max: { x: 10.4, y: 1.2, z: 6.4 } };
/**
 * Static fitted camera: the whole warehouse on screen for the whole run, clear of the shell HUD,
 * the order panel, the joystick, the Action button and the cookie banner (8 px). A portrait phone
 * turns the camera so the 20 m side runs up the screen; the lens shift lets the floor sit off-centre
 * in the free space.
 */
const VIEW: FittedViewOptions = {
   area: WAREHOUSE,
   pitch: PITCH,
   yaws: [0, Math.PI / 2],
   focus: [{ x: 0, y: 0, z: 0 }],
   margin: { top: 0.02, bottom: 0.03, left: 0.02, right: 0.02 },
   padding: 8,
   shift: true,
};

// ---------- looks (visual only, never read by the rules) ----------

/** The carried box: centred on the robot, its bottom just above the 1.2 m head. */
const CARRY_Y = 1.25;
/** Box scale while carried, relative to the box on a pallet (0.33 / 0.53: 0.62 x 0.44 x 0.60). */
const CARRY_SCALE = 0.33;
const CARRY_K = CARRY_SCALE / (ASSETS.crate.scale ?? 1);
/** the lift from the pallet to the carry spot (the pick lock is 250 ms of play) */
const LIFT_S = 0.25;
/** the drop: straight down into the zone tile */
const SINK_S = 0.35;
const SINK_DEPTH = CARRY_Y + 0.5;
const POP_S = 0.3;
const SHAKE_S = 0.4;
const SQUASH_S = 0.22;
const POPUP_S = 0.9;
/** A small fixed turn per pallet's box, so the boxes do not look machine-placed. */
const BOX_TURN = Array.from({ length: PALLET_COUNT }, (_v, i) => jitter(i + 7) * 0.09);
/** Chevrons over the boxes of the order colour (while empty-handed): centre height, a lighter tint of the colour. */
const CHEVRON_Y = PALLET_HEIGHT + BOX.height + 0.8;
const CHEVRON_TINT = 0.35;
const WHITE = new Color("#ffffff");
/** The pulsing border of the target zone: a square ring 0.22 m wide on the tile's edge. */
const BORDER_OUT = ZONE.size / 2 - 0.04;
const BORDER_IN = BORDER_OUT - 0.22;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeInOut = (k: number) => k * k * (3 - 2 * k);
/** Overshoots a little, then settles: the refill pop-in. */
const easeOutBack = (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;
/** The refill pop-in of pallet i's box at time t: 0 before it starts, overshoots a little, then 1 (its chevron grows with it). */
const popOf = (fx: Fx, i: number, t: number) => easeOutBack(clamp01((t - fx.refillAt[i]) / POP_S));
/** 0..1 of the robot's top speed (empty-handed). */
const speed01 = (run: WarehouseRun) => Math.min(1, Math.hypot(run.robot.vx, run.robot.vz) / ROBOT.speed);
/**
 * The stand-in robot's bob (while the GLB is missing or broken): twice per stride of the walk
 * cycle (`gait`, see <Robot>), plus a slow breath at time t.
 */
const standInBob = (gait: number, speed: number, t: number) => Math.abs(Math.sin(gait)) * 0.05 * speed + Math.sin(t * 2.2) * 0.012;
/** The robot GLB's joints (core/sharedAssets) and its scale here: its stride and its height over its feet. */
const LEGS = ROBOT_LANDMARKS;
const SCALE = ASSETS.robot.scale ?? 1;
/**
 * The walk's own stride (core/rig walkStride) keeps the planted foot still, but this 1.2 m robot
 * drives at up to 6 m/s: at that stride its legs would beat 6 times a second. It steps at most
 * this often (strides a second); faster, the stride stretches and the feet slide (README).
 */
const MAX_CADENCE = 4;
/** The phase never advances by more than a stride this short (m): standing still, the stride is 0. */
const MIN_STRIDE = 0.1;
/** The arms go up with the box during the pick lock (LIFT_S) and down as it sinks into the zone. */
const ARMS_DOWN_S = 0.25;

/** What only the look needs. Times are useGameTime().now values (-10 = never). */
interface Fx {
   /** the robot's walk cycle (rad) and its eased amount 0..1 (idle -> walk -> run) */
   gaitPhase: number;
   gaitAmount: number;
   /** the robot body's height this frame (m): the GLB's rise over its planted foot (core/rig bodyLift), or the stand-in's bob; the carried box rides it */
   bob: number;
   pickAt: number;
   pickFromX: number;
   pickFromZ: number;
   pickFromTurn: number;
   dropAt: number;
   dropX: number;
   dropZ: number;
   dropHeading: number;
   dropColour: number;
   dropBob: number;
   squashAt: number;
   popupAt: number;
   popupKind: number;
   popupZone: number;
   refusedAt: Float64Array;
   refillAt: Float64Array;
}

function createFx(): Fx {
   return {
      gaitPhase: 0,
      gaitAmount: 0,
      bob: 0,
      pickAt: -10,
      pickFromX: 0,
      pickFromZ: 0,
      pickFromTurn: 0,
      dropAt: -10,
      dropX: 0,
      dropZ: 0,
      dropHeading: 0,
      dropColour: NONE,
      dropBob: 0,
      squashAt: -10,
      popupAt: -10,
      popupKind: 0,
      popupZone: 0,
      refusedAt: new Float64Array(PALLET_COUNT).fill(-10),
      // the starting boxes pop in one after another when the run's Scene mounts
      refillAt: Float64Array.from({ length: PALLET_COUNT }, (_v, i) => 0.1 + i * 0.08),
   };
}

/** The values last sent to the store (README "Publishing to the store"). */
interface Published {
   score: number;
   delivered: number;
   order: number;
   carry: number;
   drops: number;
   delta: number;
}

/** Sends only what changed since the last publish. delta before drops: the HUD keys its flash on drops. */
function publish(run: WarehouseRun, pub: Published): void {
   const store = useArcadeStore.getState();
   if (run.score !== pub.score) {
      pub.score = run.score;
      store.setScore(run.score);
   }
   if (run.delivered !== pub.delivered) {
      pub.delivered = run.delivered;
      store.setStat("delivered", run.delivered);
   }
   if (run.order !== pub.order) {
      pub.order = run.order;
      store.setStat("order", run.order);
   }
   const carry = run.carrying === NONE ? 0 : 1;
   if (carry !== pub.carry) {
      pub.carry = carry;
      store.setStat("carry", carry);
   }
   if (run.lastDelta !== pub.delta) {
      pub.delta = run.lastDelta;
      store.setStat("delta", run.lastDelta);
   }
   if (run.drops !== pub.drops) {
      pub.drops = run.drops;
      store.setStat("drops", run.drops);
   }
}

// ---------- the game ----------

/** Feeds dt and the mapped input into rules.step() and reports what happened. Renders nothing. */
const Simulation = memo(function Simulation({ run, fx, pub, yaw }: { run: WarehouseRun; fx: Fx; pub: Published; yaw: number }) {
   const input = useInput();
   const time = useGameTime();
   const [scratch] = useState(() => ({ dir: { x: 0, z: 0 }, input: createStepInput() }));

   useRunFrame((_state, dt) => {
      const now = input.current;
      // screen-relative: up is away from the camera, whatever the yaw
      inputToWorld(now.moveX, now.moveY, yaw, scratch.dir);
      scratch.input.moveX = scratch.dir.x;
      scratch.input.moveY = scratch.dir.z;
      scratch.input.actionPressed = now.actionPressed || now.jumpPressed;
      const carried = run.carrying;
      const ev = step(run, dt * 1000, scratch.input);
      const t = time.now;

      if (ev.refilled !== 0) {
         for (let i = 0; i < PALLET_COUNT; i++) if (ev.refilled & (1 << i)) fx.refillAt[i] = t;
      }
      if (ev.picked !== NONE) {
         const pallet = run.pallets[ev.picked];
         fx.pickAt = t;
         fx.pickFromX = pallet.x;
         fx.pickFromZ = pallet.z;
         fx.pickFromTurn = BOX_TURN[ev.picked];
         fx.squashAt = t;
         playSfx("pickup");
      }
      if (ev.refused !== NONE) fx.refusedAt[ev.refused] = t;
      if (ev.zone !== NONE) {
         fx.dropAt = t;
         fx.dropX = run.robot.x;
         fx.dropZ = run.robot.z;
         fx.dropHeading = run.robot.heading;
         fx.dropColour = carried;
         fx.dropBob = fx.bob;
         fx.squashAt = t;
         fx.popupAt = t;
         fx.popupKind = popupKind(ev.delta);
         fx.popupZone = ev.zone;
         playSfx(ev.delivered ? "pickup" : "hit");
      }

      publish(run, pub);
      // never reached in the game (the store's clock ends the run first), harmless if it is
      if (ev.ended !== null) useArcadeStore.getState().end("timeup");
   });

   return null;
});

// ---------- the robot ----------

/**
 * Draw order inside the opaque pass: everything else (0), then the robot's ring (no depth test),
 * then the robot and the boxes (depth tested, so they cover the ring but not the racks in front).
 */
const RING_ORDER = 1;
const OVER_RING = 2;

const Robot = memo(function Robot({ run, fx }: { run: WarehouseRun; fx: Fx }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const standIn = useRef<Group>(null);
   const [scratch] = useState(createPose);

   // the GLB robot's limbs (core/rig): idle -> walk -> run with its speed, and both arms up under
   // the box while it carries one (rising with the lift, lowering as the box sinks into a zone).
   // The phase advances by the distance driven over the walk's own stride (at most MAX_CADENCE).
   // FRAME_PRIORITY.pose: after the step, before every visual that reads fx.bob.
   const pose = useHumanoidPose((p) => {
      const dt = time.delta;
      const t = time.now;
      const playing = useArcadeStore.getState().phase === "playing";
      const v = playing ? Math.hypot(run.robot.vx, run.robot.vz) : 0;
      fx.gaitAmount += (Math.min(1, v / ROBOT.speed) - fx.gaitAmount) * (1 - Math.exp(-12 * dt));
      const stride = Math.max(MIN_STRIDE, walkStride(fx.gaitAmount, LEGS) * SCALE, v / MAX_CADENCE);
      fx.gaitPhase = wrapPhase(fx.gaitPhase + ((v * dt) / stride) * Math.PI * 2);
      walkPose(fx.gaitPhase, fx.gaitAmount, p);
      // nearly still: the idle's breath and glance in the upper body (the legs keep the walk's)
      blendPoses(p, idlePose(t, scratch), 1 - Math.min(1, fx.gaitAmount * 5), p, POSE_MASK.upper);
      const arms =
         run.carrying !== NONE
            ? easeInOut(clamp01((t - fx.pickAt) / LIFT_S))
            : 1 - easeInOut(clamp01((t - fx.dropAt) / ARMS_DOWN_S));
      if (arms > 0.001) blendPoses(p, carryPose(1, scratch), arms, p, POSE_MASK.arms);
      // the GLB rises and falls with its planted foot; the stand-in bobs as before
      fx.bob = standIn.current ? standInBob(fx.gaitPhase, speed01(run), t) : bodyLift(p, LEGS) * SCALE;
   });

   // looks only: follows the simulated robot, carries the body's height (fx.bob; the stand-in also
   // leans with its speed, the GLB's walk leans its own spine), squashes on pick and drop
   useFrame(() => {
      const g = root.current;
      const b = body.current;
      if (!g || !b) return;
      const { robot } = run;
      const t = time.now;
      g.position.set(robot.x, 0, robot.z);
      g.rotation.y = robot.heading;
      b.position.y = fx.bob;
      b.rotation.x = standIn.current ? 0.16 * speed01(run) : 0;
      const k = (t - fx.squashAt) / SQUASH_S;
      const sy = k >= 0 && k < 1 ? 1 - 0.1 * Math.sin(k * Math.PI) : 1;
      const sxz = 1 / Math.sqrt(sy);
      b.scale.set(sxz, sy, sxz);
   });

   // the robot draws after the ring (it covers the ring's back half), the racks before it
   useLayoutEffect(() => {
      body.current?.traverse((object) => {
         object.renderOrder = OVER_RING;
      });
   });

   return (
      <group ref={root} name="robot">
         <BlobShadow radius={0.55} />
         {/* player marker: drawn over the floor, the pallets and the racks (no depth test), so the
             robot is easy to find on a phone, also behind a rack; the robot and the boxes draw over it */}
         <mesh rotation-x={-Math.PI / 2} position-y={0.02} renderOrder={RING_ORDER} name="robot-ring">
            <ringGeometry args={[0.6, 0.72, 32]} />
            <meshBasicMaterial color={COLORS.robot} depthTest={false} depthWrite={false} />
         </mesh>
         <group ref={body}>
            {/* the group above carries the body's height (fx.bob, the carried box rides it), so the model does not add it again */}
            <HumanoidModel
               asset={ASSETS.robot}
               pose={pose}
               applyLift={false}
               fallback={
                  <group ref={standIn}>
                     <RobotPrimitive />
                  </group>
               }
            />
         </group>
      </group>
   );
});

// ---------- boxes ----------

/** Slots 0..3: the pallets' boxes; 4: the carried box; 5: the box sinking into a zone. */
const CARRY_SLOT = PALLET_COUNT;
const SINK_SLOT = PALLET_COUNT + 1;
const SLOT_COUNT = PALLET_COUNT + 2;

interface BoxSlotRefs {
   group: Group | null;
   spin: Group | null;
   body: Mesh | null;
   decal: Mesh | null;
   /** the colour its materials show (NONE = not set yet) */
   colour: number;
}

/** One box: its own clone of the crate GLB (or the stand-in box) and a lid letter. Placed by <Boxes>. */
function BoxSlot({ slot, look }: { slot: BoxSlotRefs; look: BoxLook }) {
   const { scene } = useModel(ASSETS.crate);
   const mesh = useMemo(() => (look.glb ? firstMesh(scene) : null), [look.glb, scene]);
   useLayoutEffect(() => {
      if (!mesh) return;
      mesh.renderOrder = OVER_RING;
      slot.body = mesh;
      slot.colour = NONE;
      return () => {
         if (slot.body === mesh) slot.body = null;
      };
   }, [mesh, slot]);

   return (
      <group
         ref={(g) => {
            slot.group = g;
         }}
         visible={false}
      >
         {mesh && scene ? (
            // dispose={null}: the geometry belongs to the loader cache, the materials to useBoxLook
            <primitive object={scene} scale={ASSETS.crate.scale} dispose={null} />
         ) : (
            <mesh
               ref={(m: Mesh | null) => {
                  if (m) {
                     slot.body = m;
                     slot.colour = NONE;
                  }
               }}
               geometry={look.standIn}
               material={look.bodies[0]}
               renderOrder={OVER_RING}
               dispose={null}
            />
         )}
         <group
            ref={(g) => {
               slot.spin = g;
            }}
            position-y={LID_Y}
         >
            <mesh
               ref={(m: Mesh | null) => {
                  slot.decal = m;
                  slot.colour = NONE;
               }}
               geometry={look.decal}
               material={look.letters[0]}
               rotation-x={-Math.PI / 2}
               renderOrder={OVER_RING}
               dispose={null}
            />
         </group>
      </group>
   );
}

const Boxes = memo(function Boxes({ run, fx, yaw }: { run: WarehouseRun; fx: Fx; yaw: number }) {
   const time = useGameTime();
   const look = useBoxLook();
   const [slots] = useState<BoxSlotRefs[]>(() =>
      Array.from({ length: SLOT_COUNT }, () => ({ group: null, spin: null, body: null, decal: null, colour: NONE }))
   );
   const gl = useThree((state) => state.gl);

   // upload all 4 lid letters at mount: a colour that first arrives with a refill uploads nothing mid-run
   useEffect(() => {
      for (const letter of look.letters) if (letter.map) gl.initTexture(letter.map);
   }, [gl, look]);

   const hide = (slot: BoxSlotRefs) => {
      if (slot.group) slot.group.visible = false;
   };
   /** Shows the slot in `colour` at its feet (x, y, z), turned by `turn`, scaled by `scale`. */
   const place = (slot: BoxSlotRefs, colour: number, x: number, y: number, z: number, turn: number, scale: number) => {
      const g = slot.group;
      if (!g) return;
      if (slot.colour !== colour && slot.body && slot.decal) {
         slot.body.material = look.bodies[colour];
         slot.decal.material = look.letters[colour];
         slot.colour = colour;
      }
      g.visible = true;
      g.position.set(x, y, z);
      g.rotation.y = turn;
      g.scale.setScalar(scale);
      // the lid letter reads upright from the camera, whatever the box's turn
      if (slot.spin) slot.spin.rotation.y = yaw - turn;
   };

   useFrame(() => {
      const t = time.now;
      const { robot } = run;

      for (let i = 0; i < PALLET_COUNT; i++) {
         const pallet = run.pallets[i];
         const slot = slots[i];
         if (pallet.box === NONE) {
            hide(slot);
            continue;
         }
         const pop = Math.max(0.001, popOf(fx, i, t));
         const k = (t - fx.refusedAt[i]) / SHAKE_S;
         const shake = k >= 0 && k < 1 ? Math.sin(k * Math.PI * 6) * (1 - k) : 0;
         place(slot, pallet.box, pallet.x + shake * 0.07, PALLET_HEIGHT, pallet.z, BOX_TURN[i] + shake * 0.12, pop);
      }

      // the carried box: lifted from the pallet over the robot's head during the pick lock
      const carry = slots[CARRY_SLOT];
      if (run.carrying === NONE) {
         hide(carry);
      } else {
         const k = easeInOut(clamp01((t - fx.pickAt) / LIFT_S));
         const headY = CARRY_Y + fx.bob;
         const arc = Math.sin(k * Math.PI) * 0.25;
         place(
            carry,
            run.carrying,
            lerp(fx.pickFromX, robot.x, k),
            lerp(PALLET_HEIGHT, headY, k) + arc,
            lerp(fx.pickFromZ, robot.z, k),
            turnTowards(fx.pickFromTurn, robot.heading, k),
            lerp(1, CARRY_K, k)
         );
      }

      // the delivered box sinks straight down into the zone tile
      const sink = slots[SINK_SLOT];
      const ks = (t - fx.dropAt) / SINK_S;
      if (ks >= 0 && ks < 1 && fx.dropColour !== NONE) {
         place(sink, fx.dropColour, fx.dropX, CARRY_Y + fx.dropBob - SINK_DEPTH * ks * ks, fx.dropZ, fx.dropHeading, CARRY_K);
      } else {
         hide(sink);
      }
   });

   return (
      <group name="boxes">
         {slots.map((slot, i) => (
            <BoxSlot key={i} slot={slot} look={look} />
         ))}
      </group>
   );
});

// ---------- chevrons, the target zone, popups ----------

const V = new Vector3();
const Q = new Quaternion();
const S = new Vector3();
const UP = new Vector3(0, 1, 0);
/** The cone points down. */
const FLIP = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);

/**
 * A bobbing chevron over every box of the order colour while the robot is empty-handed. It pops in
 * with its box (the starting boxes during the countdown, every refill), so it never hangs over an
 * empty pallet.
 */
const Chevrons = memo(function Chevrons({ run, fx }: { run: WarehouseRun; fx: Fx }) {
   const time = useGameTime();
   const material = useRef<MeshBasicMaterial>(null);
   const shown = useRef(NONE);

   const placeChevron = (i: number, m: Matrix4) => {
      if (run.carrying !== NONE) return false;
      const pallet = run.pallets[i];
      if (pallet.box === NONE || pallet.box !== run.order) return false;
      const t = time.now;
      const pop = popOf(fx, i, t);
      if (pop < 0.01) return false;
      Q.setFromAxisAngle(UP, t * 2.4 + i).multiply(FLIP);
      m.compose(V.set(pallet.x, CHEVRON_Y + Math.sin(t * 4.2 + i * 1.3) * 0.09, pallet.z), Q, S.setScalar(pop));
   };

   useFrame(() => {
      const mat = material.current;
      if (mat && shown.current !== run.order && run.order !== NONE) {
         mat.color.set(COLOURS[run.order].hex).lerp(WHITE, CHEVRON_TINT);
         shown.current = run.order;
      }
   });

   return (
      <DynamicInstanced count={PALLET_COUNT} update={placeChevron} name="chevrons">
         <coneGeometry args={[0.3, 0.46, 4]} />
         <meshBasicMaterial ref={material} />
      </DynamicInstanced>
   );
});

/** The border of the target zone pulses while the robot carries a box. */
const TargetZone = memo(function TargetZone({ run }: { run: WarehouseRun }) {
   const time = useGameTime();
   const mesh = useRef<Mesh>(null);
   const material = useRef<MeshBasicMaterial>(null);
   const warm = useRef(true);

   useFrame(() => {
      const m = mesh.current;
      const mat = material.current;
      if (!m || !mat) return;
      if (warm.current) {
         // drawn once, invisible, on the first frame: its geometry is uploaded now, not mid-run
         warm.current = false;
         m.visible = true;
         mat.opacity = 0;
         return;
      }
      m.visible = run.carrying !== NONE;
      if (!m.visible) return;
      const corner = zoneCornerOf(run.layout, run.order);
      m.position.set(zoneCentreX(corner), 0.025, zoneCentreZ(corner));
      mat.opacity = 0.6 + 0.38 * Math.sin(time.now * 7);
   });

   return (
      <mesh ref={mesh} rotation-x={-Math.PI / 2} visible={false} renderOrder={2} name="target-zone">
         {/* 4 segments starting at 45°: an axis-aligned square ring */}
         <ringGeometry args={[BORDER_IN * Math.SQRT2, BORDER_OUT * Math.SQRT2, 4, 1, Math.PI / 4]} />
         <meshBasicMaterial ref={material} color="#ffffff" transparent depthWrite={false} />
      </mesh>
   );
});

/** The real change of the score rises and fades over the zone: +50, -20, -10 or ✗. */
const Popup = memo(function Popup({ fx }: { fx: Fx }) {
   const time = useGameTime();
   const maps = [
      useCanvasTexture(256, 128, POPUP_DRAWS[0]),
      useCanvasTexture(256, 128, POPUP_DRAWS[1]),
      useCanvasTexture(256, 128, POPUP_DRAWS[2]),
      useCanvasTexture(256, 128, POPUP_DRAWS[3]),
   ];
   const sprite = useRef<Sprite>(null);
   const material = useRef<SpriteMaterial>(null);
   const warm = useRef(true);
   const gl = useThree((state) => state.gl);
   const [m0, m1, m2, m3] = maps;

   // upload every popup texture at mount, so the first -20 does not upload (or hitch) mid-run
   useEffect(() => {
      for (const map of [m0, m1, m2, m3]) gl.initTexture(map);
   }, [gl, m0, m1, m2, m3]);

   useFrame(() => {
      const s = sprite.current;
      const mat = material.current;
      if (!s || !mat) return;
      if (warm.current) {
         // drawn once, invisible, on the first frame: the sprite shader and geometry are ready before the first popup
         warm.current = false;
         s.visible = true;
         mat.opacity = 0;
         return;
      }
      const k = (time.now - fx.popupAt) / POPUP_S;
      s.visible = k >= 0 && k < 1;
      if (!s.visible) return;
      const map = maps[fx.popupKind];
      if (mat.map !== map) mat.map = map;
      const grow = Math.min(1, k / 0.15);
      s.position.set(zoneCentreX(fx.popupZone), 1.5 + 1.2 * k, zoneCentreZ(fx.popupZone));
      s.scale.set(2.2 * grow, 1.1 * grow, 1);
      mat.opacity = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
   });

   return (
      <sprite ref={sprite} visible={false} renderOrder={10} name="popup">
         <spriteMaterial ref={material} map={maps[0]} transparent depthTest={false} depthWrite={false} />
      </sprite>
   );
});

// ---------- the next run ----------

/**
 * The run GameShell has just started, made before its Scene mounts. The R3F root remounts the
 * Scene (key = runId) a task or more after the store update that starts a run, so a publish from
 * the new Scene's mount alone lands 1-2 frames into the countdown ("Get ready" first, measured).
 * The outgoing Scene therefore makes the next run the moment the store starts it (start, retry,
 * restart: a new runId in "countdown") and publishes its first order inside that same store
 * update, before React renders the countdown; the new Scene takes this run over. One game is on
 * screen at a time, so a module-level hand-off is enough.
 */
const nextRun: { runId: number; run: WarehouseRun | null } = { runId: -1, run: null };

function prepareNextRun(state: ArcadeStore, prev: ArcadeStore): void {
   if (state.runId === prev.runId || state.phase !== "countdown") return;
   const run = createRun(randomSeed());
   nextRun.runId = state.runId;
   nextRun.run = run;
   state.setStat("order", run.order);
   state.setStat("carry", 0);
}

/** This Scene's run: the one prepared for its runId, or a new one (a new seed every run). */
function takeRun(): WarehouseRun {
   const { runId } = useArcadeStore.getState();
   return nextRun.run && nextRun.runId === runId ? nextRun.run : createRun(randomSeed());
}

// ---------- the scene ----------

export default function Scene() {
   const view = useFittedView(VIEW);
   // GameShell remounts the Scene (and its game time) on start, retry and restart
   const [run] = useState(() => {
      const r = takeRun();
      r.robot.heading = view.yaw; // face the camera on the start pad (heading is looks only)
      return r;
   });
   const [fx] = useState(createFx);
   const [pub] = useState<Published>(() => ({ score: 0, delivered: 0, order: NONE, carry: 0, drops: 0, delta: 0 }));

   // mount: publish this run's first order (a no-op when prepareNextRun already did; it also covers
   // the Scene of the loading and ready screens) and seed the publish cache
   useEffect(() => {
      if (nextRun.run === run) nextRun.run = null;
      const store = useArcadeStore.getState();
      store.setStat("order", run.order);
      store.setStat("carry", 0);
      Object.assign(pub, { score: 0, delivered: 0, order: run.order, carry: 0, drops: 0, delta: 0 });
   }, [run, pub]);

   // the next start, retry or restart: make that run now (see nextRun)
   useEffect(() => useArcadeStore.subscribe(prepareNextRun), []);

   return (
      <>
         <Simulation run={run} fx={fx} pub={pub} yaw={view.yaw} />
         <CameraRig camera={{ position: view.offset, lookAt: LOOK_AT }} offset={view.offset} shift={view.shift} />
         <Warehouse layout={run.layout} yaw={view.yaw} />
         <Robot run={run} fx={fx} />
         <Boxes run={run} fx={fx} yaw={view.yaw} />
         <Chevrons run={run} fx={fx} />
         <TargetZone run={run} />
         <Popup fx={fx} />
      </>
   );
}
