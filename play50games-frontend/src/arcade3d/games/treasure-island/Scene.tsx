"use client";

// Treasure Island scene: feeds input, dt and the play time into rules.ts every frame and draws the
// result. The reference game of the expansion: the pattern to copy is
// - run state created once per run (GameShell remounts Scene for every run): a seeded island and a
//   plain RunState object; the frame loop mutates them, never calls setState, never allocates;
// - one useRunFrame: input -> rules.stepRun -> the store (addScore / setStat / setScore / end) and
//   the feedback (core/fx bursts and popups, playSfx) on the step's events;
// - visuals (useFrame / useHumanoidPose) only read the run state and animate with useGameTime();
// - the camera: useFittedView keeps a window around the explorer clear of the HUD, the joystick and
//   the cookie banner (looks.ts viewFor), CameraRig follows the explorer fully;
// - models: <HumanoidModel> (auto-rig, a hat on its head anchor), <Model>, <InstancedModel> and
//   <DynamicInstancedModel> with this game's primitives as fallbacks.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CircleGeometry, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Group } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { playSfx } from "@/arcade3d/core/audio";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { Gem } from "@/arcade3d/core/kit";
import { inputToWorld, randomSeed, turnTowards } from "@/arcade3d/core/math";
import { hover, type BodyOffset } from "@/arcade3d/core/motion";
import { BlobShadow, DynamicInstanced, type InstancePart } from "@/arcade3d/core/render";
import { HumanoidModel, bodyLift, createPose, useHumanoidPose } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, EXPLORER_SCALE } from "./assets";
import { DetectorRing } from "./Detector";
import { IslandScene } from "./Island";
import { groundAt, viewFor } from "./looks";
import { advancePhase, explorerPhaseStep, explorerPose, gaitAmount, type ExplorerLook } from "./poses";
import { COLORS, ChestPrimitive, ExplorerHat, ExplorerPrimitive, GullPrimitive, useCoinParts } from "./Primitives";
import {
   HINT,
   POINTS,
   TREASURE_COUNT,
   capScore,
   createRun,
   generateIsland,
   isWon,
   runScore,
   stepRun,
   type Island,
   type RunState,
   type StepInput,
   type TreasureType,
} from "./rules";

/** What the visuals need about each find (play time of the find, its type, its pile or gem slot). */
interface Reveals {
   at: number[];
   kind: Array<TreasureType | null>;
   slot: number[];
   coins: number;
   gems: number;
}

const won = () => {
   const { phase, endReason } = useArcadeStore.getState();
   return phase === "over" && endReason === "win";
};

// ---------- the explorer ----------

function Explorer({ run }: { run: RunState }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const standIn = useRef<Group>(null);
   const [look] = useState<ExplorerLook & { lift: number }>(() => ({ amount: 0, phase: 0, dig: 0, cheer: 0, lift: 0 }));
   const [a] = useState(createPose);
   const [b] = useState(createPose);

   // the GLB runner's limbs (core/rig): walk / run by speed with the phase advanced by the walk's own
   // stride (the planted foot stays put), the dig blended in while a dig is held, the cheer on a win
   const pose = useHumanoidPose((p) => {
      const dt = time.delta;
      const { phase } = useArcadeStore.getState();
      const e = run.explorer;
      const v = phase === "playing" ? Math.hypot(e.vx, e.vz) : 0;
      look.amount += (gaitAmount(v) - look.amount) * (1 - Math.exp(-12 * dt));
      look.phase = advancePhase(look.phase, explorerPhaseStep(look.amount, v, dt));
      look.dig += ((run.dig.active ? 1 : 0) - look.dig) * (1 - Math.exp(-14 * dt));
      look.cheer += ((won() ? 1 : 0) - look.cheer) * (1 - Math.exp(-6 * dt));
      explorerPose(look, time.now, p, a, b);
      look.lift = bodyLift(p, RUNNER_LANDMARKS) * EXPLORER_SCALE;
   });

   useFrame(() => {
      const g = root.current;
      const lift = body.current;
      if (!g || !lift) return;
      const e = run.explorer;
      g.position.set(e.x, groundAt(e.x, e.z), e.z);
      // on the win it turns to the camera for the cheer
      g.rotation.y = won() ? turnTowards(g.rotation.y, 0, 1 - Math.exp(-5 * time.delta)) : e.heading;
      if (standIn.current) {
         const speed = Math.min(1, Math.hypot(e.vx, e.vz) / 5);
         lift.position.y = Math.abs(Math.sin(look.phase)) * 0.05 * speed + (won() ? Math.abs(Math.sin(time.now * 7)) * 0.2 : 0);
         lift.rotation.x = 0.12 * speed + 0.5 * look.dig;
      } else {
         lift.position.y = look.lift;
         lift.rotation.x = 0;
      }
   });

   return (
      <group ref={root} name="explorer">
         <BlobShadow radius={0.42} y={0.03} />
         <group ref={body}>
            {/* the group carries the body's height (look.lift), so the model does not add it again */}
            <HumanoidModel
               asset={ASSETS.explorer}
               pose={pose}
               applyLift={false}
               attach={{ head: <ExplorerHat /> }}
               fallback={
                  <group ref={standIn}>
                     <ExplorerPrimitive />
                  </group>
               }
            />
         </group>
      </group>
   );
}

// ---------- treasures: holes and what comes out of them ----------

const RISE_S = 0.55;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Overshoots a little, then settles: the pop of a find. */
const easeOutBack = (k: number) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;
const GEM_COLORS = ["#34d399", "#f43f5e"];
const COIN_POOL = 10;
const COINS_PER_PILE = 5;
/** Coins in a pile: x, z offsets (m), the level in the stack and the yaw: four stacked, one beside. */
const PILE = [
   [0, 0, 0, 0.1],
   [0.03, -0.02, 1, 1.3],
   [-0.04, 0.03, 2, 2.2],
   [0.02, 0.02, 3, 0.6],
   [0.24, 0.14, 0, 1.8],
] as const;
/** A coin's thickness laid flat (m): COIN_GLB_SIZE.depth x the fit, about 0.08. */
const COIN_STEP = 0.075;

const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3();
const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const YAW = new Quaternion();
const UP = new Vector3(0, 1, 0);

function useHoleParts(): readonly InstancePart[] {
   const parts = useMemo<InstancePart[]>(() => {
      const disc = new Matrix4().makeRotationX(-Math.PI / 2);
      return [
         {
            geometry: new CircleGeometry(0.42, 20),
            material: new MeshStandardMaterial({ color: COLORS.hole, roughness: 1 }),
            locals: [disc],
         },
      ];
   }, []);
   useEffect(
      () => () => {
         for (const p of parts) {
            p.geometry.dispose();
            (p.material as { dispose(): void }).dispose();
         }
      },
      [parts]
   );
   return parts;
}

function Treasures({ run, island, reveals }: { run: RunState; island: Island; reveals: Reveals }) {
   const time = useGameTime();
   const holeParts = useHoleParts();
   const coinParts = useCoinParts();
   const gems = useRef<Array<Group | null>>([]);
   const chest = useRef<Group>(null);

   const rise = (i: number) => clamp01((time.play - reveals.at[i]) / RISE_S);

   const placeHole = (i: number, m: Matrix4) => {
      if (!run.dug[i]) return false;
      const t = island.treasures[i];
      const k = Math.max(0.01, clamp01((time.play - reveals.at[i]) / 0.25));
      m.makeScale(k, 1, k).setPosition(t.x, 0.012, t.z);
   };

   const placeCoin = (c: number, m: Matrix4) => {
      const pile = Math.floor(c / COINS_PER_PILE);
      const i = coinPileTreasure(reveals, pile);
      if (i < 0) return false;
      const [ox, oz, level, yaw] = PILE[c % COINS_PER_PILE];
      const t = island.treasures[i];
      const k = easeOutBack(rise(i));
      YAW.setFromAxisAngle(UP, yaw + i);
      Q.copy(YAW).multiply(FLAT);
      // the pile rises out of the hole and settles on its rim, the side towards the camera
      V.set(t.x + ox, -0.3 + k * (0.34 + level * COIN_STEP), t.z + oz + 0.1);
      m.compose(V, Q, S.set(1, 1, 1));
   };

   useFrame(() => {
      for (let i = 0; i < TREASURE_COUNT; i++) {
         const kind = reveals.kind[i];
         if (kind === "gem") {
            const g = gems.current[reveals.slot[i]];
            if (!g) continue;
            const t = island.treasures[i];
            g.visible = true;
            g.position.set(t.x, -0.2 + easeOutBack(rise(i)) * 0.85, t.z);
         } else if (kind === "chest" && chest.current) {
            const t = island.treasures[i];
            const k = easeOutBack(rise(i));
            chest.current.visible = true;
            chest.current.position.set(t.x, -0.5 + 0.5 * Math.min(1, k), t.z + 0.05);
            chest.current.scale.setScalar(Math.max(0.01, k));
         }
      }
   });

   return (
      <group name="treasures">
         <DynamicInstanced count={TREASURE_COUNT} update={placeHole} parts={holeParts} name="holes" />
         <DynamicInstancedModel asset={ASSETS.coin} count={COIN_POOL} update={placeCoin} fallbackParts={coinParts} name="coins" />
         {GEM_COLORS.map((color, k) => (
            <group
               key={color}
               visible={false}
               ref={(el) => {
                  gems.current[k] = el;
               }}
            >
               <Gem size={0.26} color={color} glow={0.5} phase={k * 1.7} />
            </group>
         ))}
         <group ref={chest} visible={false}>
            <Model asset={ASSETS.chest} fallback={<ChestPrimitive />} />
         </group>
      </group>
   );
}

/** The treasure index of the p-th coin pile, or -1 while it is still buried. */
function coinPileTreasure(reveals: Reveals, pile: number): number {
   for (let i = 0; i < TREASURE_COUNT; i++) if (reveals.kind[i] === "coins" && reveals.slot[i] === pile) return i;
   return -1;
}

// ---------- the seagull hint ----------

function Gull({ run, island, marker }: { run: RunState; island: Island; marker: MarkerTarget[] }) {
   const time = useGameTime();
   const g = useRef<Group>(null);
   const [state] = useState(() => ({ k: 0, x: 0, z: 0 }));
   const [bob] = useState<BodyOffset>(() => ({ y: 0, roll: 0, yaw: 0, squash: 1 }));
   useFrame(() => {
      const target = run.hint.target;
      if (target >= 0) {
         state.x = island.treasures[target].x;
         state.z = island.treasures[target].z;
      }
      state.k += ((target >= 0 ? 1 : 0) - state.k) * (1 - Math.exp(-1.6 * time.delta));
      marker[0].x = state.x;
      marker[0].z = state.z;
      marker[0].hidden = target < 0;
      const node = g.current;
      if (!node) return;
      node.visible = state.k > 0.02;
      if (!node.visible) return;
      const angle = (time.now / HINT.lapS) * Math.PI * 2;
      hover(time.now, 0.15, bob);
      // it circles counter-clockwise seen from above, banked into the turn; it glides down to it
      node.position.set(
         state.x + Math.cos(angle) * HINT.radius,
         HINT.height + (1 - state.k) * 9 + bob.y,
         state.z - Math.sin(angle) * HINT.radius
      );
      node.rotation.set(0, angle + Math.PI, -0.45 + bob.roll);
   });
   return (
      <group ref={g} visible={false} name="seagull">
         <Model asset={ASSETS.gull} fallback={<GullPrimitive />} />
      </group>
   );
}

// ---------- the scene ----------

export default function Scene() {
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const view = useFittedView(viewFor(width, height));
   const input = useInput();
   const fx = useFx();
   // a new island every run: GameShell remounts the Scene (and its game time) on start and retry
   const [island] = useState(() => generateIsland(randomSeed()));
   const [run] = useState(() => createRun(island));
   const [scratch] = useState(() => ({
      step: { dirX: 0, dirZ: 0, digHeld: false, digPressed: false } as StepInput,
      dir: { x: 0, z: 0 },
      at: { x: 0, y: 0, z: 0 },
   }));
   const [reveals] = useState<Reveals>(() => ({
      at: new Array<number>(TREASURE_COUNT).fill(-1),
      kind: new Array<TreasureType | null>(TREASURE_COUNT).fill(null),
      slot: new Array<number>(TREASURE_COUNT).fill(0),
      coins: 0,
      gems: 0,
   }));
   const [marker] = useState<MarkerTarget[]>(() => [{ x: 0, y: 0.3, z: 0, hidden: true }]);

   useEffect(() => fx.warm("sparkle", "puff", "confetti", "score"), [fx]);

   // the game: move or dig, detector, tide, hint, score, end. Only while "playing", before every visual.
   useRunFrame((_state, dt, time) => {
      const { moveX, moveY, action, jump, actionPressed, jumpPressed } = input.current;
      const { step, dir, at } = scratch;
      inputToWorld(moveX, moveY, view.yaw, dir);
      step.dirX = dir.x;
      step.dirZ = dir.z;
      step.digHeld = action || jump;
      step.digPressed = actionPressed || jumpPressed;
      stepRun(run, island, step, dt, time);

      const ev = run.events;
      const e = run.explorer;
      at.x = e.x;
      at.y = groundAt(e.x, e.z) + 0.1;
      at.z = e.z;
      // TODO(P-06): one detector beep per pulse: if (ev.beep) playSfx("click", { pitch: 0.8 + 0.8 * s, volume: 0.3 + 0.4 * s })
      // TODO(P-06): a "thud" every 0.2 s of a held dig; ev.tide: playSfx("whoosh") and the surf loop to 0.5
      if (ev.digStarted) fx.burst("puff", at, 5);
      if (ev.falseDig) {
         fx.burst("puff", at, 14);
         playSfx("hit"); // TODO(P-06): at a low volume
      }
      if (ev.found < 0) return;

      const i = ev.found;
      const t = island.treasures[i];
      reveals.at[i] = time;
      reveals.kind[i] = ev.foundType;
      reveals.slot[i] = ev.foundType === "coins" ? reveals.coins++ : ev.foundType === "gem" ? reveals.gems++ : 0;
      at.x = t.x;
      at.y = 0.4;
      at.z = t.z;
      fx.burst("sparkle", at, ev.foundType === "chest" ? 30 : 18);
      at.y = 1.3;
      fx.score(at, ev.foundClean ? `+${POINTS.find + POINTS.clean} clean` : `+${POINTS.find}`, { color: ev.foundClean ? "#fde68a" : "#fff7d6" });
      if (ev.foundType === "chest") fx.shake(0.18);
      playSfx("pickup"); // TODO(P-06): + "chime" when clean
      const store = useArcadeStore.getState();
      store.addScore(POINTS.find + (ev.foundClean ? POINTS.clean : 0));
      store.setStat("treasures", run.found);
      if (isWon(run)) {
         // the run clock ticked before this callback: timeLeftMs / elapsedMs are this frame's
         const { timeLeftMs, elapsedMs } = useArcadeStore.getState();
         store.setScore(capScore(runScore(run.found, run.cleanFinds, true, timeLeftMs ?? 0), elapsedMs));
         at.y = 1;
         fx.burst("confetti", at, 40);
         store.end("win");
      }
   });

   return (
      <>
         {/* the camera reads run.explorer, which useRunFrame already moved this frame */}
         <CameraRig
            camera={{ position: view.offset, lookAt: [0, 0, 0] }}
            follow={run.explorer}
            followFraction={1}
            offset={view.offset}
            shift={view.shift}
            damping={4}
         />
         <IslandScene island={island} run={run} />
         <Treasures run={run} island={island} reveals={reveals} />
         <Explorer run={run} />
         <DetectorRing run={run} />
         <Gull run={run} island={island} marker={marker} />
         <TargetMarkers targets={marker} color="#f8fafc" />
      </>
   );
}
