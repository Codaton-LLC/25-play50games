"use client";

// Crazy Shopping Cart Scene: connects input, rules.stepRun, and the arcade store every frame,
// and renders the supermarket store, cart + runner, shoppers, products, hazards and camera.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DoubleSide, Group, Matrix4, Vector3 } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop, type LoopHandle } from "@/arcade3d/core/audio";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { BlobShadow, DynamicInstanced, Instanced } from "@/arcade3d/core/render";
import { HumanoidModel, createPose, useHumanoidPose } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import { PITCH, STORE_BOUNDS, viewFor } from "./camera";
import {
   CartPrimitive,
   ProductPrimitive,
   ShopperPrimitive,
} from "./Primitives";
import { advancePhase, gaitAmount, runnerPhaseStep, runnerPose, shopperPose, type RunnerLook } from "./poses";
import {
   CHECKOUT_COUNTERS,
   FREEZER_ROW,
   FRUIT_ISLAND,
   SHELVES,
   SPILLS,
   START_POS,
   STORE,
   createRun,
   stepRun,
   type RunState,
   type StepInput,
} from "./rules";

export default function Scene() {
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const view = useFittedView(viewFor(width, height));
   const time = useGameTime();
   const input = useInput();
   const fx = useFx();

   // Seeded run state created once per run
   const [run] = useState<RunState>(() => createRun(randomSeed()));

   // Live point for camera look-ahead
   const followTarget = useRef<{ x: number; y: number; z: number }>({
      x: START_POS.x,
      y: 0,
      z: START_POS.z,
   });

   // Cart rolling sound loop (P-06)
   const rollLoop = useRef<LoopHandle | null>(null);

   useEffect(() => {
      fx.warm("sparkle", "puff", "confetti", "score");
      const handle = startLoop("engine", { volume: 0, pitch: 0.8 });
      rollLoop.current = handle;
      return () => {
         handle.stop();
      };
   }, [fx]);

   // One useRunFrame driving pure rules and arcade store
   useRunFrame(() => {
      const { phase } = useArcadeStore.getState();
      if (phase !== "playing") {
         rollLoop.current?.set({ volume: 0 });
         return;
      }

      const dt = time.delta;
      const inp = input.current;

      // Screen-relative movement
      const world = inputToWorld(inp.moveX, inp.moveY, view.yaw);
      const stepInp: StepInput = {
         moveX: world.x,
         moveY: -world.z, // up in screen = north (-z in world)
         ride: inp.jump,  // Space or touch Ride button
      };

      const events = stepRun(run, stepInp, dt, time.now);
      const cart = run.cart;

      // Update camera follow target with velocity look-ahead
      followTarget.current.x = cart.x + 0.25 * cart.vx;
      followTarget.current.y = 0;
      followTarget.current.z = cart.z + 0.25 * cart.vz;

      // Modulate cart rolling engine loop sound with velocity
      if (run.won || run.timedOut || cart.stunTimer > 0) {
         rollLoop.current?.set({ volume: 0 });
      } else {
         const speed = cart.speed;
         const vol = Math.min(0.5, (speed / 9.0) * 0.45);
         const pitch = 0.7 + 0.5 * (speed / 9.0);
         rollLoop.current?.set({ volume: vol, pitch });
      }

      // SFX and Visual FX on events
      for (const p of events.pickups) {
         useArcadeStore.getState().addScore(p.score);
         useArcadeStore.getState().setStat("items", run.collectedCount);
         playSfx("pickup");
         if (p.combo > 1) {
            playSfx("chime", { pitch: 1.0 + Math.min(0.5, p.combo * 0.1) });
         }
         fx.burst("sparkle", { x: p.x, y: 0.8, z: p.z }, 16);
         fx.score({ x: p.x, y: 1.2, z: p.z }, `+${p.score}`);
      }

      if (events.listCompleted) {
         useArcadeStore.getState().addScore(300);
         playSfx("chime", { pitch: 1.3 });
         fx.score({ x: cart.x, y: 1.5, z: cart.z }, "+300 Complete!");
      }

      for (const pyr of events.pyramidToppled) {
         playSfx("thud");
         fx.burst("puff", { x: pyr.x, y: 0.4, z: pyr.z }, 16);
      }

      for (const bump of events.shopperBumped) {
         playSfx("thud");
         fx.shake(0.4);
         fx.burst("puff", { x: bump.x, y: 1.2, z: bump.z }, 12);
      }

      if (events.spillSkid) {
         playSfx("splash", { volume: 0.4 });
      }

      if (events.won) {
         rollLoop.current?.set({ volume: 0 });
         playSfx("win");
         fx.burst("confetti", { x: cart.x, y: 1.0, z: cart.z }, 30);
         useArcadeStore.getState().setScore(run.score);
         useArcadeStore.getState().end("win");
      } else if (events.timeup) {
         rollLoop.current?.set({ volume: 0 });
         useArcadeStore.getState().setScore(run.score);
         useArcadeStore.getState().end("timeup");
      }
   });

   return (
      <group>
         <CameraRig
            camera={{ position: view.offset, lookAt: [0, 0, 0] }}
            follow={followTarget.current}
            bounds={STORE_BOUNDS}
            damping={4}
            followFraction={1}
            offset={view.offset}
            shift={view.shift}
         />

         {/* Supermarket Interior Environment (floor, walls, shelves, fixtures) */}
         <StoreEnvironment run={run} />

         {/* Cart + Pusher Runner Coupled Group */}
         <CartRunner cart={run.cart} won={run.won} />

         {/* Shoppers */}
         {run.shoppers.map((shopper) => (
            <ShopperComponent key={shopper.id} shopper={shopper} />
         ))}

         {/* Shelf Items with glowing 0.8m halos and floating badges */}
         <ShelfItems items={run.list} />

         {/* Instanced Can Pyramids */}
         <InstancedCanPyramids pyramids={run.pyramids} />

         {/* Spills */}
         <SpillsComponent playTimeS={run.playTimeS} />
      </group>
   );
}

// ---------- Cart & Runner Coupled Component ----------

function CartRunner({ cart, won }: { cart: RunState["cart"]; won: boolean }) {
   const time = useGameTime();
   const groupRef = useRef<Group>(null);
   const [look] = useState<RunnerLook>(() => ({ amount: 0, phase: 0, riding: 0, cheer: 0 }));
   const [a] = useState(createPose);
   const [b] = useState(createPose);

   const pose = useHumanoidPose((p) => {
      const dt = time.delta;
      const speed = cart.speed;
      look.amount += (gaitAmount(speed) - look.amount) * (1 - Math.exp(-12 * dt));
      look.phase = advancePhase(look.phase, runnerPhaseStep(look.amount, speed, dt));
      look.riding += ((cart.riding ? 1 : 0) - look.riding) * (1 - Math.exp(-14 * dt));
      look.cheer += ((won ? 1 : 0) - look.cheer) * (1 - Math.exp(-6 * dt));
      runnerPose(look, time.now, p, a, b);
   });

   useFrame(() => {
      const g = groupRef.current;
      if (!g) return;
      g.position.set(cart.x, 0, cart.z);
      g.rotation.y = -cart.heading; // Orient along movement heading
   });

   return (
      <group ref={groupRef} position={[START_POS.x, 0, START_POS.z]}>
         {/* Cart model: handle is at +z, basket points towards -z */}
         <Model asset={ASSETS.cart} fallback={<CartPrimitive />} />

         {/* Pusher runner standing behind the handle at +z = 0.85, facing forward (-z) */}
         <group position={[0, cart.riding ? 0.18 : 0, 0.85]} rotation={[0, Math.PI, 0]}>
            <HumanoidModel asset={ASSETS.pusher} pose={pose} fallback={<capsuleGeometry args={[0.25, 0.9]} />} />
         </group>

         <BlobShadow radius={0.65} opacity={0.4} />
      </group>
   );
}

// ---------- Shopper NPC Component ----------

function ShopperComponent({ shopper }: { shopper: RunState["shoppers"][0] }) {
   const time = useGameTime();
   const groupRef = useRef<Group>(null);
   const [phaseRef] = useState({ phase: 0 });
   const [scratch] = useState(createPose);

   const asset =
      shopper.id === "shopperA" || shopper.id === "shopperD"
         ? ASSETS.shopperA
         : shopper.id === "shopperB"
         ? ASSETS.shopperB
         : ASSETS.shopperC;

   const pose = useHumanoidPose((p) => {
      const dt = time.delta;
      const speed = Math.hypot(shopper.agent.vx, shopper.agent.vz);
      phaseRef.phase = advancePhase(phaseRef.phase, 4 * dt * Math.min(1, speed / 1.8));
      shopperPose(phaseRef.phase, speed, time.now, p, scratch);
   });

   useFrame(() => {
      const g = groupRef.current;
      if (!g) return;
      g.visible = shopper.active;
      if (shopper.active) {
         g.position.set(shopper.agent.x, 0, shopper.agent.z);
         g.rotation.y = shopper.agent.yaw;
      }
   });

   const fallbackColor =
      shopper.id === "shopperA" ? "#c084fc" : shopper.id === "shopperB" ? "#86efac" : "#fb923c";

   return (
      <group ref={groupRef}>
         <HumanoidModel asset={asset} pose={pose} fallback={<ShopperPrimitive color={fallbackColor} />} />
         <BlobShadow radius={0.45} opacity={0.35} />
      </group>
   );
}

// ---------- Shelf Items with 0.8 m Glow Halo & Bobbing Badges ----------

function ShelfItems({ items }: { items: RunState["list"] }) {
   const time = useGameTime();

   // Dynamic instancing for the 0.8 m floor glow halos (1 draw call)
   const updateHalos = useMemo(
      () => (index: number, matrix: Matrix4) => {
         const item = items[index];
         if (!item || item.collected) return false;
         matrix.makeTranslation(item.x, 0.02, item.z);
      },
      [items]
   );

   // Dynamic instancing for floating bobbing beacon badges (1 draw call)
   const updateBadges = useMemo(
      () => (index: number, matrix: Matrix4) => {
         const item = items[index];
         if (!item || item.collected) return false;
         const bob = Math.sin(time.now * 3 + index) * 0.1;
         matrix.makeTranslation(item.x, 1.25 + bob, item.z);
      },
      [items, time]
   );

   return (
      <group>
         {/* 1 draw call for all glowing 0.8 m halo rings */}
         <DynamicInstanced count={items.length} update={updateHalos}>
            <ringGeometry args={[0.2, 0.8, 32]} />
            <meshBasicMaterial color="#fb923c" transparent opacity={0.7} side={DoubleSide} />
         </DynamicInstanced>

         {/* 1 draw call for all floating beacon badges */}
         <DynamicInstanced count={items.length} update={updateBadges}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.6} roughness={0.3} />
         </DynamicInstanced>

         {/* 3D Model items rotating above shelves */}
         {items.map((item, i) => {
            if (item.collected) return null;
            const bob = Math.sin(time.now * 3 + i) * 0.1;
            const asset = ASSETS[item.kind as keyof typeof ASSETS] ?? ASSETS.apple;

            return (
               <group key={i} position={[item.x, 0.72 + bob, item.z]} rotation={[0, time.now * 1.5, 0]}>
                  <Model asset={asset} fallback={<ProductPrimitive kind={item.kind} />} />
               </group>
            );
         })}
      </group>
   );
}

// ---------- Instanced Can Pyramids Component (2 draw calls total) ----------

function InstancedCanPyramids({ pyramids }: { pyramids: RunState["pyramids"] }) {
   // 18 base cans (3 per pyramid * 6 pyramids) in 1 draw call
   const updateBaseCans = useMemo(
      () => (index: number, matrix: Matrix4) => {
         const pyrIndex = Math.floor(index / 3);
         const canSub = index % 3;
         const pyr = pyramids[pyrIndex];
         if (!pyr) return false;

         if (pyr.toppled) {
            // Scattered cans on the floor
            if (canSub === 0) matrix.makeTranslation(pyr.x - 0.25, 0.05, pyr.z + 0.15);
            else if (canSub === 1) matrix.makeTranslation(pyr.x + 0.25, 0.05, pyr.z - 0.15);
            else matrix.makeTranslation(pyr.x + 0.08, 0.05, pyr.z - 0.25);
         } else {
            // Standing pyramid bottom layer
            if (canSub === 0) matrix.makeTranslation(pyr.x - 0.15, 0.1, pyr.z - 0.1);
            else if (canSub === 1) matrix.makeTranslation(pyr.x + 0.15, 0.1, pyr.z - 0.1);
            else matrix.makeTranslation(pyr.x, 0.1, pyr.z + 0.15);
         }
      },
      [pyramids]
   );

   // 6 top cans in 1 draw call
   const updateTopCans = useMemo(
      () => (index: number, matrix: Matrix4) => {
         const pyr = pyramids[index];
         if (!pyr) return false;

         if (pyr.toppled) {
            matrix.makeTranslation(pyr.x - 0.05, 0.05, pyr.z + 0.3);
         } else {
            matrix.makeTranslation(pyr.x, 0.3, pyr.z);
         }
      },
      [pyramids]
   );

   return (
      <group>
         <DynamicInstanced count={18} update={updateBaseCans}>
            <cylinderGeometry args={[0.08, 0.08, 0.2, 10]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} />
         </DynamicInstanced>

         <DynamicInstanced count={6} update={updateTopCans}>
            <cylinderGeometry args={[0.08, 0.08, 0.2, 10]} />
            <meshStandardMaterial color="#fb923c" metalness={0.7} />
         </DynamicInstanced>
      </group>
   );
}

// ---------- Spills Component ----------

function SpillsComponent({ playTimeS }: { playTimeS: number }) {
   return (
      <group>
         {SPILLS.map((spill, i) => {
            if (playTimeS < spill.spawnS) return null;
            return (
               <group key={i} position={[spill.x, 0.01, spill.z]}>
                  {/* Slippery puddle */}
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                     <circleGeometry args={[spill.radius, 24]} />
                     <meshStandardMaterial
                        color="#38bdf8"
                        roughness={0.1}
                        metalness={0.4}
                        transparent
                        opacity={0.75}
                     />
                  </mesh>
                  {/* Warning Caution cone */}
                  <mesh position={[0.8, 0.25, 0]}>
                     <coneGeometry args={[0.15, 0.5, 8]} />
                     <meshStandardMaterial color="#facc15" roughness={0.4} />
                  </mesh>
               </group>
            );
         })}
      </group>
   );
}

// ---------- Store Environment (Instanced Shelves, Counters, Outer Bounds) ----------

const SHELF_SPOTS = SHELVES.map((s) => ({
   x: (s.min.x + s.max.x) / 2,
   y: 1.0,
   z: (s.min.z + s.max.z) / 2,
}));

const SHELF_TRIM_SPOTS = SHELVES.map((s) => ({
   x: (s.min.x + s.max.x) / 2,
   y: 0.1,
   z: (s.min.z + s.max.z) / 2,
}));

const SHELF_BANNER_SPOTS = SHELVES.map((s) => ({
   x: (s.min.x + s.max.x) / 2,
   y: 2.05,
   z: (s.min.z + s.max.z) / 2,
}));

const COUNTER_SPOTS = CHECKOUT_COUNTERS.map((c) => ({
   x: (c.min.x + c.max.x) / 2,
   y: 0.5,
   z: (c.min.z + c.max.z) / 2,
}));

const REGISTER_SPOTS = CHECKOUT_COUNTERS.map((c) => ({
   x: (c.min.x + c.max.x) / 2,
   y: 1.15,
   z: (c.min.z + c.max.z) / 2 - 0.3,
}));

const WALL_SPOTS = [
   { x: 0, y: 1.9, z: -12, sx: 32, sy: 3.8, sz: 0.4 },
   { x: 0, y: 1.9, z: 12, sx: 32, sy: 3.8, sz: 0.4 },
   { x: -16, y: 1.9, z: 0, sx: 0.4, sy: 3.8, sz: 24 },
   { x: 16, y: 1.9, z: 0, sx: 0.4, sy: 3.8, sz: 24 },
];

function StoreEnvironment({ run }: { run: RunState }) {
   return (
      <group>
         {/* Extended dark perimeter floor to prevent any white edge beyond the store */}
         <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[70, 70]} />
            <meshStandardMaterial color="#0b1220" roughness={0.9} />
         </mesh>

         {/* Store floor plane with supermarket tiles */}
         <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[STORE.width, STORE.depth]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.3} metalness={0.1} />
         </mesh>

         {/* Instanced 4 Shelf Island Blocks: 3 draw calls total */}
         <Instanced spots={SHELF_SPOTS}>
            <boxGeometry args={[1.2, 2.0, 12.0]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} metalness={0.2} />
         </Instanced>

         <Instanced spots={SHELF_TRIM_SPOTS}>
            <boxGeometry args={[1.25, 0.2, 12.05]} />
            <meshStandardMaterial color="#64748b" roughness={0.8} />
         </Instanced>

         <Instanced spots={SHELF_BANNER_SPOTS}>
            <boxGeometry args={[1.22, 0.1, 12.0]} />
            <meshStandardMaterial color="#fb923c" roughness={0.4} />
         </Instanced>

         {/* Fruit Island Display */}
         <group
            position={[
               (FRUIT_ISLAND.min.x + FRUIT_ISLAND.max.x) / 2,
               0,
               (FRUIT_ISLAND.min.z + FRUIT_ISLAND.max.z) / 2,
            ]}
         >
            <mesh position={[0, 0.45, 0]}>
               <boxGeometry args={[3.0, 0.9, 6.0]} />
               <meshStandardMaterial color="#a16207" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.95, 0]}>
               <boxGeometry args={[2.8, 0.1, 5.8]} />
               <meshStandardMaterial color="#84cc16" roughness={0.6} />
            </mesh>
         </group>

         {/* Freezer Row along North wall */}
         <group position={[0, 0, (FREEZER_ROW.min.z + FREEZER_ROW.max.z) / 2]}>
            <mesh position={[0, 1.0, 0]}>
               <boxGeometry args={[24.0, 2.0, 1.2]} />
               <meshStandardMaterial
                  color="#bae6fd"
                  roughness={0.2}
                  metalness={0.5}
                  transparent
                  opacity={0.9}
               />
            </mesh>
         </group>

         {/* Instanced Checkout Counters: 2 draw calls total */}
         <Instanced spots={COUNTER_SPOTS}>
            <boxGeometry args={[0.8, 1.0, 1.8]} />
            <meshStandardMaterial color="#334155" roughness={0.5} />
         </Instanced>

         <Instanced spots={REGISTER_SPOTS}>
            <boxGeometry args={[0.3, 0.25, 0.1]} />
            <meshStandardMaterial color="#22c55e" emissive="#15803d" roughness={0.3} />
         </Instanced>

         {/* Finish Zone Line Mat */}
         <mesh position={[0, 0.015, 11.0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[9.0, 1.6]} />
            <meshStandardMaterial
               color={run.listComplete ? "#22c55e" : "#cbd5e1"}
               emissive={run.listComplete ? "#16a34a" : "#000000"}
               roughness={0.4}
            />
         </mesh>

         {/* Instanced Outer Walls (3.8 m tall): 1 draw call */}
         <Instanced spots={WALL_SPOTS}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} />
         </Instanced>
      </group>
   );
}
