"use client";

// Crazy Shopping Cart Scene: connects input, rules.stepRun, and the arcade store every frame,
// and renders the supermarket store, cart + runner, shoppers, products, hazards and camera.
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Group, Vector3 } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { Model } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { BlobShadow } from "@/arcade3d/core/render";
import { HumanoidModel, createPose, useHumanoidPose } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, type ProductKind } from "./assets";
import {
   CartPrimitive,
   ProductPrimitive,
   ShelfUnitPrimitive,
   ShopperPrimitive,
} from "./Primitives";
import { advancePhase, gaitAmount, runnerPhaseStep, runnerPose, shopperPose, type RunnerLook } from "./poses";
import {
   CHECKOUT_COUNTERS,
   DURATION_MS,
   FREEZER_ROW,
   FRUIT_ISLAND,
   PYRAMID_RADIUS,
   SHELVES,
   SHELF_SLOTS,
   SPILLS,
   START_POS,
   STORE,
   createRun,
   stepRun,
   type RunState,
   type StepInput,
} from "./rules";

const PITCH_RAD = (55 * Math.PI) / 180;

const STORE_BOUNDS = {
   min: { x: -14, y: 0, z: -10 },
   max: { x: 14, y: 2, z: 10 },
};

const WINDOW_BOX = {
   min: { x: -7, y: 0, z: -7 },
   max: { x: 7, y: 2, z: 7 },
};

export default function Scene() {
   const time = useGameTime();
   const input = useInput();
   const fx = useFx();

   // Seeded run state created once per run
   const [run] = useState<RunState>(() => createRun(randomSeed()));

   // Live point for camera look-ahead
   const followTarget = useRef<{ x: number; y: number; z: number }>({ x: START_POS.x, y: 0, z: START_POS.z });

   // Camera fitting a 14 m window around the cart
   const view = useFittedView({
      area: WINDOW_BOX,
      pitch: PITCH_RAD,
      yaws: [0, Math.PI / 2],
      focus: followFocus({
         lookAt: [0, 0, 0],
         reach: WINDOW_BOX,
         fraction: 1,
         bounds: STORE_BOUNDS,
      }),
      margin: { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 },
      padding: 4,
      shift: true,
   });

   // One useRunFrame driving pure rules and arcade store
   useRunFrame(() => {
      const { phase } = useArcadeStore.getState();
      if (phase !== "playing") return;

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

      // SFX and Visual FX on events
      for (const p of events.pickups) {
         useArcadeStore.getState().addScore(p.score);
         useArcadeStore.getState().setStat("items", run.collectedCount);
         playSfx("pickup");
         fx.burst("sparkle", { x: p.x, y: 0.8, z: p.z }, 14);
         fx.score({ x: p.x, y: 1.2, z: p.z }, `+${p.score}`);
      }

      if (events.listCompleted) {
         useArcadeStore.getState().addScore(300);
         playSfx("win");
         fx.score({ x: cart.x, y: 1.5, z: cart.z }, "+300 Complete!");
      }

      for (const pyr of events.pyramidToppled) {
         playSfx("hit");
         fx.burst("puff", { x: pyr.x, y: 0.4, z: pyr.z }, 16);
      }

      for (const bump of events.shopperBumped) {
         playSfx("hit");
         fx.shake(0.4);
         fx.burst("puff", { x: bump.x, y: 1.2, z: bump.z }, 12);
      }

      if (events.won) {
         playSfx("win");
         fx.burst("confetti", { x: cart.x, y: 1.0, z: cart.z }, 30);
         useArcadeStore.getState().setScore(run.score);
         useArcadeStore.getState().end("win");
      } else if (events.timeup) {
         useArcadeStore.getState().setScore(run.score);
         useArcadeStore.getState().end("timeup");
      }
   });

   return (
      <group>
         <CameraRig
            camera={{ position: [0, 16, 18], fov: 45, lookAt: [0, 0, 0] }}
            follow={followTarget.current}
            bounds={STORE_BOUNDS}
            damping={4}
            followFraction={1}
            offset={view.offset}
            shift={view.shift}
         />

         {/* Supermarket Interior Environment */}
         <StoreEnvironment run={run} />

         {/* Cart + Pusher Runner Coupled Group */}
         <CartRunner cart={run.cart} won={run.won} />

         {/* Shoppers */}
         {run.shoppers.map((shopper) => (
            <ShopperComponent key={shopper.id} shopper={shopper} />
         ))}

         {/* Shelf Items */}
         <ShelfItems items={run.list} />

         {/* Can Pyramids */}
         {run.pyramids.map((pyr, i) => (
            <CanPyramidComponent key={i} pyramid={pyr} />
         ))}

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

// ---------- Shelf Items with Beacons & Badges ----------

function ShelfItems({ items }: { items: RunState["list"] }) {
   const time = useGameTime();

   return (
      <group>
         {items.map((item, i) => {
            if (item.collected) return null;
            const bob = Math.sin(time.now * 3 + i) * 0.1;
            const pulse = 0.8 + 0.2 * Math.sin(time.now * 5 + i);

            const asset = ASSETS[item.kind as keyof typeof ASSETS] ?? ASSETS.apple;

            return (
               <group key={i} position={[item.x, 0.7 + bob, item.z]}>
                  {/* Glowing emissive halo disk on floor */}
                  <mesh position={[0, -0.65 - bob, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                     <ringGeometry args={[0.2, 0.5 * pulse, 24]} />
                     <meshBasicMaterial color="#fb923c" transparent opacity={0.6 * pulse} side={DoubleSide} />
                  </mesh>

                  {/* 3D Model item */}
                  <group rotation={[0, time.now * 1.5, 0]}>
                     <Model asset={asset} fallback={<ProductPrimitive kind={item.kind} />} />
                  </group>
               </group>
            );
         })}
      </group>
   );
}

// ---------- Can Pyramid Component ----------

function CanPyramidComponent({ pyramid }: { pyramid: RunState["pyramids"][0] }) {
   if (pyramid.toppled) {
      // Scattered cans on the floor
      return (
         <group position={[pyramid.x, 0.05, pyramid.z]}>
            <mesh position={[-0.2, 0, 0.1]} rotation={[Math.PI / 2, 0, 0.5]}>
               <cylinderGeometry args={[0.07, 0.07, 0.16, 8]} />
               <meshStandardMaterial color="#94a3b8" metalness={0.8} />
            </mesh>
            <mesh position={[0.2, 0, -0.1]} rotation={[Math.PI / 2, 0, -0.8]}>
               <cylinderGeometry args={[0.07, 0.07, 0.16, 8]} />
               <meshStandardMaterial color="#94a3b8" metalness={0.8} />
            </mesh>
            <mesh position={[0.05, 0, -0.2]} rotation={[Math.PI / 2, 0, 1.2]}>
               <cylinderGeometry args={[0.07, 0.07, 0.16, 8]} />
               <meshStandardMaterial color="#94a3b8" metalness={0.8} />
            </mesh>
         </group>
      );
   }

   // Standing pyramid
   return (
      <group position={[pyramid.x, 0, pyramid.z]}>
         {/* Bottom layer of 3 cans */}
         <mesh position={[-0.15, 0.1, -0.1]}>
            <cylinderGeometry args={[0.08, 0.08, 0.2, 10]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} />
         </mesh>
         <mesh position={[0.15, 0.1, -0.1]}>
            <cylinderGeometry args={[0.08, 0.08, 0.2, 10]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} />
         </mesh>
         <mesh position={[0, 0.1, 0.15]}>
            <cylinderGeometry args={[0.08, 0.08, 0.2, 10]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} />
         </mesh>
         {/* Top can */}
         <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.2, 10]} />
            <meshStandardMaterial color="#fb923c" metalness={0.7} />
         </mesh>
         <BlobShadow radius={0.4} opacity={0.3} />
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
                  {/* Warning Caution sign cone */}
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

// ---------- Store Environment Component ----------

function StoreEnvironment({ run }: { run: RunState }) {
   return (
      <group>
         {/* Floor plane with supermarket tiles */}
         <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[STORE.width, STORE.depth]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.1} />
         </mesh>

         {/* 4 Shelf Island Blocks */}
         {SHELVES.map((shelf, i) => {
            const w = shelf.max.x - shelf.min.x;
            const l = shelf.max.z - shelf.min.z;
            const cx = (shelf.min.x + shelf.max.x) / 2;
            const cz = (shelf.min.z + shelf.max.z) / 2;
            return (
               <group key={i} position={[cx, 0, cz]}>
                  <ShelfUnitPrimitive width={w} length={l} />
               </group>
            );
         })}

         {/* Fruit Island Display */}
         <group position={[(FRUIT_ISLAND.min.x + FRUIT_ISLAND.max.x) / 2, 0, (FRUIT_ISLAND.min.z + FRUIT_ISLAND.max.z) / 2]}>
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
               <meshStandardMaterial color="#bae6fd" roughness={0.2} metalness={0.5} transparent opacity={0.9} />
            </mesh>
         </group>

         {/* Checkout Counters */}
         {CHECKOUT_COUNTERS.map((counter, i) => {
            const w = counter.max.x - counter.min.x;
            const l = counter.max.z - counter.min.z;
            const cx = (counter.min.x + counter.max.x) / 2;
            const cz = (counter.min.z + counter.max.z) / 2;
            return (
               <group key={i} position={[cx, 0, cz]}>
                  <mesh position={[0, 0.5, 0]}>
                     <boxGeometry args={[w, 1.0, l]} />
                     <meshStandardMaterial color="#334155" roughness={0.5} />
                  </mesh>
                  {/* Register screen */}
                  <mesh position={[0, 1.15, -0.3]}>
                     <boxGeometry args={[0.3, 0.25, 0.1]} />
                     <meshStandardMaterial color="#22c55e" emissive="#15803d" roughness={0.3} />
                  </mesh>
               </group>
            );
         })}

         {/* Finish Zone Line Mat */}
         <mesh position={[0, 0.015, 11.0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[9.0, 1.6]} />
            <meshStandardMaterial
               color={run.listComplete ? "#22c55e" : "#e2e8f0"}
               emissive={run.listComplete ? "#16a34a" : "#000000"}
               roughness={0.4}
            />
         </mesh>

         {/* Outer walls */}
         <mesh position={[0, 1.5, -12]}>
            <boxGeometry args={[32, 3, 0.4]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
         </mesh>
         <mesh position={[0, 1.5, 12]}>
            <boxGeometry args={[32, 3, 0.4]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
         </mesh>
         <mesh position={[-16, 1.5, 0]}>
            <boxGeometry args={[0.4, 3, 24]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
         </mesh>
         <mesh position={[16, 1.5, 0]}>
            <boxGeometry args={[0.4, 3, 24]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
         </mesh>
      </group>
   );
}
