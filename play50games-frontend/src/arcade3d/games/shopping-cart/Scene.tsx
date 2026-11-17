"use client";

// Crazy Shopping Cart Scene: connects input, rules.stepRun, and the arcade store every frame,
// and renders the supermarket store, cart + runner, shoppers, products, hazards and camera.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DoubleSide, Group, Matrix4, MeshStandardMaterial, RepeatWrapping } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop, type LoopHandle } from "@/arcade3d/core/audio";
import { SkyDome } from "@/arcade3d/core/env";
import { tossAt, useActionPop, useFx, type TossFrame } from "@/arcade3d/core/fx";
import { TargetBeacon, TargetMarkers } from "@/arcade3d/core/hud";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { BlobShadow, DynamicInstanced, Instanced, useCanvasTexture, type CanvasDraw } from "@/arcade3d/core/render";
import { HumanoidModel, createPose, useHumanoidPose } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import type { AABB } from "@/arcade3d/core/collision";
import { SOLID_OBSTACLES } from "./rules";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, MARKET_COLORS, MARKET_DRAWN, MARKET_SPOTS, type MarketKind, BAKERY_DRAWN, BAKERY_FALLBACK_SPOTS, BAKERY_HEIGHT, BAKERY_SPOTS, SCRUBBER_DRAWN, SCRUBBER_FALLBACK_SPOTS, SCRUBBER_HEIGHT, SCRUBBER_SPOTS, SHELF_BAYS } from "./assets";
import { STORE_BOUNDS, viewFor } from "./camera";
import { Decor } from "./Decor";
import StoreSetPieces from "./StoreSetPieces";
import { STORE_LOOKS } from "./storeLooks";
import { COLORS, FLOOR } from "./looks";
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
   type ListItem,
   type RunState,
   type StepInput,
} from "./rules";
import { useLevel } from "@/arcade3d/core/level";
import type { ShoppingCartLevel } from "./levels";
import { CHECKOUT, GUIDE, LIST, cartHint, hintCode, nextItem } from "./guide";

/** A taken product flies into the cart for this long (s), then is hidden. */
const INTO_CART_S = 0.42;

/** Copies `src` into the camera hook's box slots. */
function fillSolids(src: readonly AABB[], out: AABB[]): number {
   let n = 0;
   for (const b of src) {
      if (n >= out.length) break;
      const o = out[n++];
      o.min.x = b.min.x; o.min.y = b.min.y; o.min.z = b.min.z;
      o.max.x = b.max.x; o.max.y = b.max.y; o.max.z = b.max.z;
   }
   return n;
}

export default function Scene() {
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const view = useFittedView(viewFor(width, height));
   const input = useInput();
   const fx = useFx();

   // Seeded run state created once per run
   const { config, id: levelId } = useLevel<ShoppingCartLevel>();
   const [run] = useState<RunState>(() => createRun(randomSeed(), config));
   const look = STORE_LOOKS[run.level.store.theme];

   // camera views (core/camera): the rules get the drawn camera's yaw (the fitted yaw in the default view)
   const cam = useCameraViews({
      slug: "shopping-cart",
      subject: "vehicle",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         const c = run.cart;
         o.x = c.x; o.y = 0.7; o.z = c.z; o.heading = c.heading; o.vx = c.vx; o.vz = c.vz;
      },
      // the level's own solids (set pieces, the shut lane) keep the chase / front views out of them too
      solids: (out: AABB[]) => fillSolids(run.solids ?? SOLID_OBSTACLES, out),
      framing: { top: { distance: 12 } },
   });


   // Live point for camera look-ahead
   const followTarget = useRef<{ x: number; y: number; z: number }>({
      x: START_POS.x,
      y: 0,
      z: START_POS.z,
   });

   // clarity (visual only): the beacon on the next item / the checkout, the list panel, the hint, fail pops
   const pop = useActionPop();
   const touch = useCoarsePointer();
   const beacon = useRef({ x: 0, y: 0, z: 0, hidden: true }).current;
   // the same target for the edge arrow when it is off screen or under a HUD panel
   const edgeTargets = useMemo(() => [beacon], [beacon]);
   const guide = useRef({ next: -2, code: -1, combo: 0, checkout: false }).current;
   const kinds = useMemo(() => run.list.map((item) => item.kind), [run]);
   const [atCheckout, setAtCheckout] = useState(false);
   useEffect(() => {
      // the list is up from the countdown on, so the panel's size (a safe-area rect) is settled before play
      guide.next = nextItem(run, -1);
      LIST.set({ kinds, taken: 0, next: guide.next, riding: false });
      guide.code = hintCode(run, guide.next);
      GUIDE.set(cartHint(run, guide.code, touch));
      const first = run.list[guide.next];
      if (first) {
         beacon.x = first.x;
         beacon.y = 0.95;
         beacon.z = first.z;
         beacon.hidden = false;
      }
      return () => {
         GUIDE.reset();
         LIST.reset();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [run, kinds, guide, beacon]);

   // Cart rolling sound loop (P-06) - sync with play/pause phases
   const rollLoop = useRef<LoopHandle | null>(null);

   useEffect(() => {
      fx.warm("sparkle", "puff", "debris", "confetti", "score");
      let handle: LoopHandle | null = null;
      const syncLoop = (phase: string) => {
         if (phase === "playing") {
            if (!handle) {
               handle = startLoop("engine", { volume: 0, pitch: 0.8 });
               rollLoop.current = handle;
            }
         } else {
            if (handle) {
               handle.stop();
               handle = null;
               rollLoop.current = null;
            }
         }
      };

      syncLoop(useArcadeStore.getState().phase);
      const unsub = useArcadeStore.subscribe((state) => {
         syncLoop(state.phase);
      });
      return () => {
         unsub();
         if (handle) handle.stop();
      };
   }, [fx]);

   const WORLD_MOVE = { x: 0, y: 0, z: 0 };
   const STEP_INPUT: StepInput = { moveX: 0, moveY: 0, ride: false };

   // One useRunFrame driving pure rules and arcade store with frame dt and store time
   useRunFrame((_state, dt, time) => {
      const { phase } = useArcadeStore.getState();
      if (phase !== "playing") return;

      const inp = input.current;

      // Screen-relative movement
      inputToWorld(inp.moveX, inp.moveY, cam.yaw(), WORLD_MOVE);
      STEP_INPUT.moveX = WORLD_MOVE.x;
      STEP_INPUT.moveY = -WORLD_MOVE.z; // up in screen = north (-z in world)
      STEP_INPUT.ride = inp.jump;       // Space or touch Ride button

      const events = stepRun(run, STEP_INPUT, dt, time);
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
         fx.burst("sparkle", { x: p.x, y: 0.8, z: p.z }, 18);
         fx.score({ x: p.x, y: 1.2, z: p.z }, `+${p.score}`);
      }

      if (events.listCompleted) {
         useArcadeStore.getState().addScore(300);
         playSfx("chime", { pitch: 1.3 });
         fx.score({ x: cart.x, y: 1.5, z: cart.z }, "+300 Complete!");
         fx.burst("confetti", { x: cart.x, y: 1.2, z: cart.z }, 24);
      }

      for (const pyr of events.pyramidToppled) {
         playSfx("thud");
         fx.burst("puff", { x: pyr.x, y: 0.4, z: pyr.z }, 16);
         fx.burst("debris", { x: pyr.x, y: 0.3, z: pyr.z }, 12);
         fx.shake(0.15);
      }

      for (const bump of events.shopperBumped) {
         playSfx("thud");
         fx.shake(0.4);
         fx.burst("puff", { x: bump.x, y: 1.2, z: bump.z }, 16);
      }

      if (events.spillSkid) {
         playSfx("splash", { volume: 0.4 });
         fx.burst("puff", { x: cart.x, y: 0.1, z: cart.z }, 8);
      }

      // fail pops: a bump, a toppled pyramid, a hard crash that ends the combo streak
      const hadCombo = guide.combo > 0;
      if (events.shopperBumped.length > 0) {
         pop.fail({ x: cart.x, y: 2, z: cart.z }, hadCombo ? "Bumped! Combo lost" : "Bumped! Stunned", { shake: 0 });
      } else if (events.pyramidToppled.length > 0) {
         pop.fail({ x: cart.x, y: 2, z: cart.z }, hadCombo ? "Crash! Combo lost" : "Crash! Slowed", { shake: 0 });
      } else if (hadCombo && run.combo === 0 && events.pickups.length === 0) {
         pop.fail({ x: cart.x, y: 2, z: cart.z }, "Crash! Combo lost");
      }
      guide.combo = run.combo;

      // the next item (or the checkout): beacon, list panel, hint (rebuilt only on a change)
      guide.next = nextItem(run, guide.next);
      const target = guide.next >= 0 ? run.list[guide.next] : null;
      beacon.x = target ? target.x : CHECKOUT.x;
      beacon.y = target ? 0.95 : 0.1;
      beacon.z = target ? target.z : CHECKOUT.z;
      beacon.hidden = run.won;
      if ((guide.next < 0) !== guide.checkout) setAtCheckout((guide.checkout = guide.next < 0));
      let taken = 0;
      for (let i = 0; i < run.list.length; i++) if (run.list[i].collected) taken |= 1 << i;
      LIST.set({ kinds, taken, next: guide.next, riding: cart.riding });
      const code = hintCode(run, guide.next);
      if (code !== guide.code) {
         guide.code = code;
         GUIDE.set(cartHint(run, code, touch));
      }

      if (events.won) {
         rollLoop.current?.set({ volume: 0 });
         playSfx("win");
         fx.burst("confetti", { x: cart.x, y: 1.0, z: cart.z }, 36);
         fx.shake(0.25);
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

         {/* Sky Dome from core env */}
         <SkyDome top={look.skyTop} bottom={look.skyBottom} />

         {/* Instanced Decor strictly outside play area standing on the ground */}
         <Decor />

         {/* Supermarket Interior & Parking Lot Exterior Environment */}
         <StoreEnvironment run={run} banner={look.banner} />

         {/* Floor scrubbers parked on the north apron: the after-hours cleaning crew,
             drawn only on levels 4 (Superstore) and 5 (Closing-Time Rush). */}
         {(levelId === 4 || levelId === 5) && (
            <InstancedModel
               asset={ASSETS.scrubber}
               spots={SCRUBBER_SPOTS}
               fallback={
                  <Instanced spots={SCRUBBER_FALLBACK_SPOTS} name="scrubber-fallback">
                     <boxGeometry args={[SCRUBBER_DRAWN.width, SCRUBBER_HEIGHT, SCRUBBER_DRAWN.depth]} />
                     <meshStandardMaterial color="#14b8a6" roughness={0.5} />
                  </Instanced>
               }
            />
         )}

         {/* Levels 2-5: the level's own floor (set pieces, floor machines, the lane shutter, wet floor) */}
         <StoreSetPieces run={run} />

         {/* Cart + Pusher Runner Coupled Group */}
         <CartRunner run={run} />

         {/* Shoppers */}
         {run.shoppers.map((shopper) => (
            <ShopperComponent key={shopper.id} shopper={shopper} />
         ))}

         {/* Shelf Items with glowing 0.8m halos and floating badges */}
         <ShelfItems items={run.list} cart={run.cart} />
         <TargetBeacon
            target={beacon}
            variant={atCheckout ? "drop-here" : "pick"}
            color={atCheckout ? "#4ade80" : COLORS.halo}
            radius={atCheckout ? 2.4 : 0.5}
            height={atCheckout ? 2 : 0.85}
            label={atCheckout ? "CHECKOUT" : null}
         />
         <TargetMarkers targets={edgeTargets} color={atCheckout ? "#4ade80" : COLORS.halo} />

         {/* Instanced Can Pyramids */}
         <InstancedCanPyramids pyramids={run.pyramids} />

         {/* Spills */}
         <SpillsComponent run={run} />
      </group>
   );
}



// ---------- Cart & Runner Coupled Component ----------

function CartRunner({ run }: { run: RunState }) {
   const time = useGameTime();
   const groupRef = useRef<Group>(null);
   const runnerRef = useRef<Group>(null);
   const [look] = useState<RunnerLook>(() => ({ amount: 0, phase: 0, riding: 0, cheer: 0 }));
   const [a] = useState(createPose);
   const [b] = useState(createPose);

   const pose = useHumanoidPose((p) => {
      const dt = time.delta;
      const cart = run.cart;
      const speed = cart.speed;
      look.amount += (gaitAmount(speed) - look.amount) * (1 - Math.exp(-12 * dt));
      look.phase = advancePhase(look.phase, runnerPhaseStep(look.amount, speed, dt));
      look.riding += ((cart.riding ? 1 : 0) - look.riding) * (1 - Math.exp(-14 * dt));
      look.cheer += ((run.won ? 1 : 0) - look.cheer) * (1 - Math.exp(-6 * dt));
      runnerPose(look, time.now, p, a, b);
   });

   useFrame(() => {
      const g = groupRef.current;
      if (g) {
         g.position.set(run.cart.x, 0, run.cart.z);
         g.rotation.y = -run.cart.heading; // Orient along movement heading
      }
      const r = runnerRef.current;
      if (r) {
         r.position.y = run.cart.riding ? 0.18 : 0;
      }
   });

   return (
      <group ref={groupRef} position={[START_POS.x, 0, START_POS.z]}>
         {/* Cart model: handle is at +z, basket points towards -z */}
         <Model asset={ASSETS.cart} fallback={<CartPrimitive />} />

         {/* Pusher runner standing behind the handle at +z = 0.85, facing forward (-z) */}
         <group ref={runnerRef} position={[0, 0, 0.85]} rotation={[0, Math.PI, 0]}>
            <HumanoidModel
               asset={ASSETS.pusher}
               pose={pose}
               fallback={
                  <mesh position={[0, 0.7, 0]}>
                     <capsuleGeometry args={[0.25, 0.9]} />
                     <meshStandardMaterial color={COLORS.cartRed} />
                  </mesh>
               }
            />
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
      shopper.id === "shopperA" ? COLORS.shopperA : shopper.id === "shopperB" ? COLORS.shopperB : COLORS.shopperC;

   return (
      <group ref={groupRef}>
         <HumanoidModel asset={asset} pose={pose} fallback={<ShopperPrimitive color={fallbackColor} />} />
         <BlobShadow radius={0.45} opacity={0.35} />
      </group>
   );
}

// ---------- Shelf Items with 0.8 m Glow Halo & Bobbing Badges ----------

function ShelfItems({ items, cart }: { items: RunState["list"]; cart: RunState["cart"] }) {
   const time = useGameTime();

   // Dynamic instancing for the 0.8 m floor glow halos (1 draw call)
   const updateHalos = useMemo(
      () => (index: number, matrix: Matrix4) => {
         const item = items[index];
         if (!item || item.collected) return false;
         matrix.makeRotationX(-Math.PI / 2);
         matrix.setPosition(item.x, 0.02, item.z);
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
         {/* 1 draw call for all glowing 0.8 m halo rings lying flat on floor */}
         <DynamicInstanced count={items.length} update={updateHalos}>
            <ringGeometry args={[0.15, 0.4, 32]} />
            <meshBasicMaterial color={COLORS.halo} transparent opacity={0.7} side={DoubleSide} />
         </DynamicInstanced>

         {/* 1 draw call for all floating beacon badges */}
         <DynamicInstanced count={items.length} update={updateBadges}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial color={COLORS.badge} emissive={COLORS.badge} emissiveIntensity={0.6} roughness={0.3} />
         </DynamicInstanced>

         {/* 3D Model items rotating above shelves */}
         {items.map((item, i) => (
            <ShelfItem key={i} item={item} index={i} cart={cart} />
         ))}
      </group>
   );
}

function ShelfItem({ item, index, cart }: { item: ListItem; index: number; cart: RunState["cart"] }) {
   const groupRef = useRef<Group>(null);
   const asset = ASSETS[item.kind as keyof typeof ASSETS] ?? ASSETS.apple;
   const gameTime = useGameTime();
   // a taken product flies on an arc into the basket (visual only), then hides
   const flight = useRef({ t: -1, from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0.9, z: 0 } }).current;
   const pose = useRef<TossFrame>({ x: 0, y: 0, z: 0, scale: 1 }).current;

   useFrame(() => {
      const g = groupRef.current;
      if (!g) return;
      if (item.collected) {
         if (flight.t < 0) {
            flight.t = 0;
            flight.from.x = g.position.x;
            flight.from.y = g.position.y;
            flight.from.z = g.position.z;
         }
         if (flight.t >= 1) {
            if (g.visible) g.visible = false;
            return;
         }
         flight.t = Math.min(1, flight.t + gameTime.delta / INTO_CART_S);
         flight.to.x = cart.x;
         flight.to.z = cart.z;
         tossAt(flight.from, flight.to, flight.t, 0.9, 1, 0.35, pose);
         g.position.set(pose.x, pose.y, pose.z);
         g.scale.setScalar(pose.scale);
         g.rotation.y += gameTime.delta * 9;
         g.visible = flight.t < 1;
         return;
      }
      g.visible = true;
      const t = gameTime.now;
      g.position.y = 0.72 + Math.sin(t * 3 + index) * 0.1;
      g.rotation.y = t * 1.5;
   });

   return (
      <group ref={groupRef} position={[item.x, 0.72, item.z]}>
         <Model asset={asset} fallback={<ProductPrimitive kind={item.kind} />} />
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
            <cylinderGeometry args={[0.08, 0.08, 0.2, 12]} />
            <meshStandardMaterial color={COLORS.canSilver} metalness={0.75} roughness={0.25} />
         </DynamicInstanced>

         <DynamicInstanced count={6} update={updateTopCans}>
            <cylinderGeometry args={[0.08, 0.08, 0.2, 12]} />
            <meshStandardMaterial color={COLORS.canGold} metalness={0.75} roughness={0.25} />
         </DynamicInstanced>
      </group>
   );
}

// ---------- Spills Component ----------

function SpillsComponent({ run }: { run: RunState }) {
   return (
      <group>
         {SPILLS.map((spill, i) => (
            <SpillItem key={i} spill={spill} run={run} />
         ))}
      </group>
   );
}

function SpillItem({ spill, run }: { spill: (typeof SPILLS)[number]; run: RunState }) {
   const groupRef = useRef<Group>(null);
   useFrame(() => {
      if (groupRef.current) {
         groupRef.current.visible = run.playTimeS >= spill.spawnS;
      }
   });
   return (
      <group ref={groupRef} position={[spill.x, 0.01, spill.z]} visible={false}>
         {/* Slippery glossy puddle */}
         <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[spill.radius, 24]} />
            <meshStandardMaterial
               color={COLORS.spillWater}
               roughness={0.12}
               metalness={0.3}
               transparent
               opacity={0.8}
            />
         </mesh>
         {/* Warning Caution cone */}
         <group position={[0.8, 0, 0]}>
            <mesh position={[0, 0.25, 0]}>
               <coneGeometry args={[0.15, 0.5, 8]} />
               <meshStandardMaterial color={COLORS.coneYellow} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.18, 0]}>
               <cylinderGeometry args={[0.1, 0.12, 0.06, 8]} />
               <meshStandardMaterial color={COLORS.coneBlack} roughness={0.6} />
            </mesh>
         </group>
      </group>
   );
}

// ---------- Store Environment & Floor Tiles ----------

const drawSupermarketFloor: CanvasDraw = (ctx, width, height) => {
   // Base grout tone
   ctx.fillStyle = COLORS.floorGrout;
   ctx.fillRect(0, 0, width, height);

   // 4x4 tile grid on 512x512 canvas -> 128x128 px tiles with 3px clean grout
   const tiles = 4;
   const tileSize = width / tiles;
   const grout = 3;

   for (let ty = 0; ty < tiles; ty++) {
      for (let tx = 0; tx < tiles; tx++) {
         const x = tx * tileSize + grout;
         const y = ty * tileSize + grout;
         const s = tileSize - grout * 2;

         // Subtle tile-to-tile tonal variation
         const isAlt = (tx + ty) % 2 === 0;
         ctx.fillStyle = isAlt ? COLORS.floorTile : COLORS.floorAccent;
         ctx.fillRect(x, y, s, s);

         // Soft diagonal gloss gradient
         const grad = ctx.createLinearGradient(x, y, x + s, y + s);
         grad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
         grad.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
         grad.addColorStop(1, "rgba(241, 245, 249, 0.2)");
         ctx.fillStyle = grad;
         ctx.fillRect(x, y, s, s);

         // Crisp bevel border highlight
         ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
         ctx.lineWidth = 1;
         ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      }
   }
};

const drawParkingLot: CanvasDraw = (ctx, width, height) => {
   // Asphalt base
   ctx.fillStyle = COLORS.parkingAsphalt;
   ctx.fillRect(0, 0, width, height);

   // Tarmac grain texture
   ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
   for (let i = 0; i < 400; i++) {
      const rx = (i * 97) % width;
      const ry = (i * 131) % height;
      ctx.fillRect(rx, ry, 2, 2);
   }

   // Painted white parking stall lines
   ctx.strokeStyle = COLORS.parkingLine;
   ctx.lineWidth = 4;

   const row1Y = height * 0.25;
   const row2Y = height * 0.75;
   const stallWidth = width / 4;

   for (let i = 0; i <= 4; i++) {
      const x = i * stallWidth;
      // Stall dividers
      ctx.beginPath();
      ctx.moveTo(x, row1Y - 45);
      ctx.lineTo(x, row1Y + 45);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, row2Y - 45);
      ctx.lineTo(x, row2Y + 45);
      ctx.stroke();
   }

   // Stall back lines
   ctx.beginPath();
   ctx.moveTo(0, row1Y + 45);
   ctx.lineTo(width, row1Y + 45);
   ctx.stroke();

   ctx.beginPath();
   ctx.moveTo(0, row2Y - 45);
   ctx.lineTo(width, row2Y - 45);
   ctx.stroke();

   // Accent yellow stall marking
   ctx.strokeStyle = COLORS.parkingLineYellow;
   ctx.lineWidth = 3;
   ctx.beginPath();
   ctx.moveTo(stallWidth, row1Y - 40);
   ctx.lineTo(stallWidth * 2, row1Y - 40);
   ctx.stroke();
};

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

const SHELF_SIGN_SPOTS = SHELVES.map((s) => ({
   x: (s.min.x + s.max.x) / 2,
   y: 2.25,
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
   { x: 0, y: 2.0, z: -12, sx: 32, sy: 4.0, sz: 0.4 },
   { x: 0, y: 2.0, z: 12, sx: 32, sy: 4.0, sz: 0.4 },
   { x: -16, y: 2.0, z: 0, sx: 0.4, sy: 4.0, sz: 24 },
   { x: 16, y: 2.0, z: 0, sx: 0.4, sy: 4.0, sz: 24 },
];

const WALL_FASCIA_SPOTS = [
   { x: 0, y: 3.75, z: -11.95, sx: 32, sy: 0.5, sz: 0.45 },
   { x: 0, y: 3.75, z: 11.95, sx: 32, sy: 0.5, sz: 0.45 },
   { x: -15.95, y: 3.75, z: 0, sx: 0.45, sy: 0.5, sz: 24 },
   { x: 15.95, y: 3.75, z: 0, sx: 0.45, sy: 0.5, sz: 24 },
];

function FinishMat({ run }: { run: RunState }) {
   const matRef = useRef<MeshStandardMaterial>(null);
   const prevListCompleteRef = useRef<boolean | null>(null);

   useFrame(() => {
      if (!matRef.current) return;
      if (prevListCompleteRef.current !== run.listComplete) {
         prevListCompleteRef.current = run.listComplete;
         matRef.current.color.set(run.listComplete ? COLORS.finishGreen : COLORS.finishInactive);
         matRef.current.emissive.set(run.listComplete ? COLORS.finishGreenGlow : "#000000");
      }
   });

   return (
      <mesh position={[0, 0.015, 11.0]} rotation={[-Math.PI / 2, 0, 0]}>
         <planeGeometry args={[9.0, 1.6]} />
         <meshStandardMaterial
            ref={matRef}
            color={run.listComplete ? COLORS.finishGreen : COLORS.finishInactive}
            emissive={run.listComplete ? COLORS.finishGreenGlow : "#000000"}
            roughness={0.3}
         />
      </mesh>
   );
}

function StoreEnvironment({ run, banner }: { run: RunState; banner: string | null }) {
   const floorTexture = useCanvasTexture(512, 512, drawSupermarketFloor);
   const parkingTexture = useCanvasTexture(512, 512, drawParkingLot);

   useEffect(() => {
      floorTexture.wrapS = floorTexture.wrapT = RepeatWrapping;
      floorTexture.repeat.set(16, 12);
      floorTexture.needsUpdate = true;
   }, [floorTexture]);

   useEffect(() => {
      parkingTexture.wrapS = parkingTexture.wrapT = RepeatWrapping;
      parkingTexture.repeat.set(14, 14);
      parkingTexture.needsUpdate = true;
   }, [parkingTexture]);

   return (
      <group name="supermarket-environment">
         {/* Extended asphalt parking lot plane covering full viewport at all screen sizes */}
         <mesh position={[0, FLOOR.concourseY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[FLOOR.concourseWidth, FLOOR.concourseDepth]} />
            <meshStandardMaterial
               map={parkingTexture}
               roughness={0.88}
               metalness={0.08}
            />
         </mesh>

         {/* Exterior concrete sidewalk / pavement apron surrounding the store building */}
         <mesh position={[0, FLOOR.pavementY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[FLOOR.pavementWidth, FLOOR.pavementDepth]} />
            <meshStandardMaterial color={COLORS.pavementConcrete} roughness={0.7} />
         </mesh>

         {/* Raised kerbs around the perimeter of the sidewalk apron */}
         <mesh position={[0, 0.04, -FLOOR.pavementDepth / 2]}>
            <boxGeometry args={[FLOOR.pavementWidth + 0.3, 0.1, 0.3]} />
            <meshStandardMaterial color={COLORS.kerbStone} roughness={0.8} />
         </mesh>
         <mesh position={[0, 0.04, FLOOR.pavementDepth / 2]}>
            <boxGeometry args={[FLOOR.pavementWidth + 0.3, 0.1, 0.3]} />
            <meshStandardMaterial color={COLORS.kerbStone} roughness={0.8} />
         </mesh>
         <mesh position={[-FLOOR.pavementWidth / 2, 0.04, 0]}>
            <boxGeometry args={[0.3, 0.1, FLOOR.pavementDepth]} />
            <meshStandardMaterial color={COLORS.kerbStone} roughness={0.8} />
         </mesh>
         <mesh position={[FLOOR.pavementWidth / 2, 0.04, 0]}>
            <boxGeometry args={[0.3, 0.1, FLOOR.pavementDepth]} />
            <meshStandardMaterial color={COLORS.kerbStone} roughness={0.8} />
         </mesh>

         {/* Pedestrian Zebra Crossing in front of South Entrance */}
         <group position={[0, 0.005, 17.5]} rotation={[-Math.PI / 2, 0, 0]}>
            {[-3.0, -1.5, 0, 1.5, 3.0].map((zx, idx) => (
               <mesh key={idx} position={[zx, 0, 0]}>
                  <planeGeometry args={[0.8, 3.6]} />
                  <meshStandardMaterial color={COLORS.parkingLine} roughness={0.4} />
               </mesh>
            ))}
         </group>

         {/* Exterior Store Entrance Canopy Overhang */}
         <group position={[0, 3.85, 13.0]}>
            <mesh>
               <boxGeometry args={[18.0, 0.25, 2.4]} />
               <meshStandardMaterial color={COLORS.wall} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0, 1.22]}>
               <boxGeometry args={[18.05, 0.3, 0.06]} />
               <meshStandardMaterial color={COLORS.wallBanner} roughness={0.4} />
            </mesh>
            {/* Canopy support pillars */}
            <mesh position={[-8.5, -1.9, 0.9]}>
               <cylinderGeometry args={[0.12, 0.12, 3.8, 8]} />
               <meshStandardMaterial color={COLORS.wallTrim} roughness={0.5} metalness={0.1} />
            </mesh>
            <mesh position={[8.5, -1.9, 0.9]}>
               <cylinderGeometry args={[0.12, 0.12, 3.8, 8]} />
               <meshStandardMaterial color={COLORS.wallTrim} roughness={0.5} metalness={0.1} />
            </mesh>
         </group>

         {/* Supermarket glossy tiled floor plane */}
         <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[STORE.width, STORE.depth]} />
            <meshStandardMaterial
               map={floorTexture}
               roughness={0.18}
               metalness={0.06}
            />
         </mesh>

         {/* Aisle shelves: one instanced GLB bay, six copies along each of the four islands. */}
         <InstancedModel
            asset={ASSETS.shelf}
            spots={SHELF_BAYS}
            fallback={
               <>
                  <Instanced spots={SHELF_SPOTS} name="shelves-body">
                     <boxGeometry args={[1.2, 1.8, 12.0]} />
                     <meshStandardMaterial color={COLORS.shelfBody} roughness={0.4} metalness={0.15} />
                  </Instanced>
                  <Instanced spots={SHELF_TRIM_SPOTS} name="shelves-base">
                     <boxGeometry args={[1.25, 0.2, 12.05]} />
                     <meshStandardMaterial color={COLORS.shelfBase} roughness={0.7} />
                  </Instanced>
               </>
            }
         />

         {/* The aisle banners and blue category signs stay on top of the GLB bays (the look pass's readable signs). */}
         <Instanced spots={SHELF_BANNER_SPOTS} name="shelves-banner">
            <boxGeometry args={[1.22, 0.12, 12.0]} />
            <meshStandardMaterial color={banner ?? COLORS.shelfBanner} roughness={0.35} emissive={banner ?? "#000000"} emissiveIntensity={banner ? 0.25 : 0} />
         </Instanced>
         <Instanced spots={SHELF_SIGN_SPOTS} name="shelves-signs">
            <boxGeometry args={[1.15, 0.25, 2.4]} />
            <meshStandardMaterial color={COLORS.categoryBlue} emissive={COLORS.categoryBlue} emissiveIntensity={0.25} roughness={0.4} />
         </Instanced>

         {/* Bakery stalls on the north apron, outside the play box. */}
         <InstancedModel
            asset={ASSETS.bakery}
            spots={BAKERY_SPOTS}
            fallback={
               <Instanced spots={BAKERY_FALLBACK_SPOTS} name="bakery-fallback">
                  <boxGeometry args={[BAKERY_DRAWN.width, BAKERY_HEIGHT, BAKERY_DRAWN.depth]} />
                  <meshStandardMaterial color="#fde68a" roughness={0.6} />
               </Instanced>
            }
         />

         {/* Checkout counters, freezers, a fruit stand and wet-floor cones on the north apron, outside the play box. */}
         {(Object.keys(MARKET_SPOTS) as MarketKind[]).map((kind) => (
            <InstancedModel
               key={kind}
               asset={ASSETS[kind]}
               spots={MARKET_SPOTS[kind]}
               fallback={
                  <Instanced spots={MARKET_SPOTS[kind].map((p) => ({ ...p, y: MARKET_DRAWN[kind].height / 2 }))} name={`${kind}-fallback`}>
                     <boxGeometry args={[MARKET_DRAWN[kind].width, MARKET_DRAWN[kind].height, MARKET_DRAWN[kind].depth]} />
                     <meshStandardMaterial color={MARKET_COLORS[kind]} roughness={0.6} />
                  </Instanced>
               }
            />
         ))}

         {/* Fruit Island Produce Display */}
         <group
            position={[
               (FRUIT_ISLAND.min.x + FRUIT_ISLAND.max.x) / 2,
               0,
               (FRUIT_ISLAND.min.z + FRUIT_ISLAND.max.z) / 2,
            ]}
         >
            {/* Timber display island stand */}
            <mesh position={[0, 0.45, 0]}>
               <boxGeometry args={[3.0, 0.9, 6.0]} />
               <meshStandardMaterial color={COLORS.produceWood} roughness={0.7} />
            </mesh>
            {/* Fresh leafy display bed */}
            <mesh position={[0, 0.92, 0]}>
               <boxGeometry args={[2.85, 0.1, 5.85]} />
               <meshStandardMaterial color={COLORS.produceGreen} roughness={0.6} />
            </mesh>
            {/* Produce crates */}
            <mesh position={[0, 1.02, 0]}>
               <boxGeometry args={[2.7, 0.12, 5.7]} />
               <meshStandardMaterial color={COLORS.produceCrate} roughness={0.6} />
            </mesh>
         </group>

         {/* Freezer Row along North wall */}
         <group position={[0, 0, (FREEZER_ROW.min.z + FREEZER_ROW.max.z) / 2]}>
            {/* Commercial freezer cabinet body */}
            <mesh position={[0, 1.0, 0]}>
               <boxGeometry args={[24.0, 2.0, 1.2]} />
               <meshStandardMaterial color={COLORS.freezerBody} roughness={0.3} metalness={0.4} />
            </mesh>
            {/* Glass reach-in doors with cyan tint */}
            <mesh position={[0, 1.0, 0.58]}>
               <boxGeometry args={[23.8, 1.6, 0.05]} />
               <meshStandardMaterial
                  color={COLORS.freezerGlass}
                  roughness={0.12}
                  transparent
                  opacity={0.85}
               />
            </mesh>
            {/* Cyan LED interior illumination banner */}
            <mesh position={[0, 1.9, 0.5]}>
               <boxGeometry args={[24.0, 0.15, 0.2]} />
               <meshStandardMaterial
                  color={COLORS.freezerGlow}
                  emissive={COLORS.freezerGlow}
                  emissiveIntensity={0.8}
                  roughness={0.3}
               />
            </mesh>
         </group>

         {/* Instanced Checkout Counters: 2 draw calls total */}
         <Instanced spots={COUNTER_SPOTS} name="checkout-counters">
            <boxGeometry args={[0.8, 1.0, 1.8]} />
            <meshStandardMaterial color={COLORS.checkoutBody} roughness={0.5} />
         </Instanced>

         <Instanced spots={REGISTER_SPOTS} name="checkout-registers">
            <boxGeometry args={[0.3, 0.25, 0.1]} />
            <meshStandardMaterial
               color={COLORS.registerScreen}
               emissive={COLORS.registerScreen}
               emissiveIntensity={0.6}
               roughness={0.3}
            />
         </Instanced>

         {/* Finish Zone Line Mat */}
         <FinishMat run={run} />

         {/* Instanced Outer Walls (4.0 m tall) and Upper Fascia: 2 draw calls */}
         <Instanced spots={WALL_SPOTS} name="outer-walls">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.65} />
         </Instanced>

         <Instanced spots={WALL_FASCIA_SPOTS} name="outer-walls-fascia">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wallBanner} roughness={0.4} />
         </Instanced>
      </group>
   );
}
