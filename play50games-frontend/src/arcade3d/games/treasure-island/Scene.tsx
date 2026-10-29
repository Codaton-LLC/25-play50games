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
// - models: <HumanoidModel> (auto-rig, a hat on its head anchor, the shovel on its back and right-hand anchors), <Model>, <InstancedModel> and
//   <DynamicInstancedModel> with this game's primitives as fallbacks.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CircleGeometry, Matrix4, MeshStandardMaterial, Quaternion, RingGeometry, Vector3, type Group } from "three";
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
import { useLevel } from "@/arcade3d/core/level";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import type { AABB } from "@/arcade3d/core/collision";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, EXPLORER_SCALE } from "./assets";
import { DetectorRing } from "./Detector";
import { IslandScene } from "./Island";
import { MapScene } from "./MapScene";
import type { IslandLevel } from "./levels";
import { COLORS, PITCH, groundAt, viewFor } from "./looks";
import { advancePhase, explorerPhaseStep, explorerPose, gaitAmount, type ExplorerLook } from "./poses";
import { ChestPrimitive, ExplorerHat, ExplorerPrimitive, GullPrimitive, MapPiecePrimitive, ScrollPrimitive, XMarkPrimitive, useCoinParts } from "./Primitives";
import { ExplorerShovel } from "./Shovel";
import {
   HINT,
   POINTS,
   PROPOSED_LEVEL_LIMITS,
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
   clues: number;
   maps: number;
}

/** The picked level (level 1 when the levels flag is off). Scene reads it once per run. */
export const useIslandLevel = () => useLevel<IslandLevel>();

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
      g.position.set(e.x, groundAt(e.x, e.z, run.shape), e.z);
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
               attach={{
                  head: <ExplorerHat />,
                  chest: <ExplorerShovel mode="back" run={run} look={look} />,
                  handR: <ExplorerShovel mode="hand" run={run} look={look} />,
               }}
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
const GEM_COLORS = [COLORS.gemEmerald, COLORS.gemRuby];
/** Three coin piles (level 5) × five coins. Level 1 uses two piles; the rest of the pool stays hidden. */
const COIN_POOL = 15;
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
      const inner = new CircleGeometry(0.38, 20);
      const outer = new RingGeometry(0.36, 0.54, 24);
      return [
         {
            geometry: inner,
            material: new MeshStandardMaterial({ color: COLORS.hole, roughness: 1 }),
            locals: [disc],
         },
         {
            geometry: outer,
            material: new MeshStandardMaterial({ color: COLORS.wetSand, roughness: 0.95 }),
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

/** Two clue scrolls and three map pieces at most (maps.ts chains). */
const CLUE_POOL = 2;
const MAP_POOL = 3;

function Treasures({ run, island, reveals }: { run: RunState; island: Island; reveals: Reveals }) {
   const time = useGameTime();
   const holeParts = useHoleParts();
   const coinParts = useCoinParts();
   const gems = useRef<Array<Group | null>>([]);
   const clues = useRef<Array<Group | null>>([]);
   const maps = useRef<Array<Group | null>>([]);
   const chest = useRef<Group>(null);
   const xMark = useRef<Group>(null);
   // the drawn ground under each spot (0 on level 1's flat sand; the hill and the slopes on a map)
   const ground = useMemo(() => island.treasures.map((t) => groundAt(t.x, t.z, run.shape)), [island, run.shape]);

   const rise = (i: number) => clamp01((time.play - reveals.at[i]) / RISE_S);

   const placeHole = (i: number, m: Matrix4) => {
      if (!run.dug[i]) return false;
      const t = island.treasures[i];
      const k = Math.max(0.01, clamp01((time.play - reveals.at[i]) / 0.25));
      m.makeScale(k, 1, k).setPosition(t.x, ground[i] + 0.012, t.z);
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
      V.set(t.x + ox, ground[i] - 0.3 + k * (0.34 + level * COIN_STEP), t.z + oz + 0.1);
      m.compose(V, Q, S.set(1, 1, 1));
   };

   useFrame(() => {
      const n = island.treasures.length;
      for (let i = 0; i < n; i++) {
         const kind = reveals.kind[i];
         const t = island.treasures[i];
         if (kind === "gem") {
            const g = gems.current[reveals.slot[i]];
            if (!g) continue;
            g.visible = true;
            g.position.set(t.x, ground[i] - 0.2 + easeOutBack(rise(i)) * 0.85, t.z);
         } else if (kind === "chest" && chest.current) {
            const k = easeOutBack(rise(i));
            chest.current.visible = true;
            chest.current.position.set(t.x, ground[i] - 0.5 + 0.5 * Math.min(1, k), t.z + 0.05);
            chest.current.scale.setScalar(Math.max(0.01, k));
         } else if (kind === "clue" || kind === "map") {
            // the scroll / map piece pops out, floats, turning, over its hole
            const g = (kind === "clue" ? clues : maps).current[reveals.slot[i]];
            if (!g) continue;
            const k = easeOutBack(rise(i));
            g.visible = true;
            g.position.set(t.x, ground[i] - 0.25 + k * 0.85 + Math.sin(time.now * 2 + i) * 0.05, t.z);
            g.rotation.set(kind === "map" ? -0.5 : 0, time.now * 0.9 + i, 0);
            g.scale.setScalar(Math.max(0.01, Math.min(1, k)) * 1.25);
         }
      }
      // the complete map marks the locked chest with an X (until it is dug)
      const x = xMark.current;
      const last = island.finalChest;
      if (x && last !== undefined) {
         const on = run.found >= island.treasures.length - 1 && !run.dug[last];
         x.visible = on;
         if (on) {
            const t = island.treasures[last];
            const pulse = 1 + 0.08 * Math.sin(time.now * 4);
            x.position.set(t.x, ground[last] + 0.03, t.z);
            x.scale.set(pulse, 1, pulse);
         }
      }
   });

   return (
      <group name="treasures">
         <DynamicInstanced count={island.treasures.length} update={placeHole} parts={holeParts} name="holes" />
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
         {island.finalChest !== undefined && (
            <>
               {Array.from({ length: CLUE_POOL }, (_v, k) => (
                  <group key={`clue${k}`} visible={false} ref={(el) => { clues.current[k] = el; }}>
                     <ScrollPrimitive />
                  </group>
               ))}
               {Array.from({ length: MAP_POOL }, (_v, k) => (
                  <group key={`map${k}`} visible={false} ref={(el) => { maps.current[k] = el; }}>
                     <MapPiecePrimitive />
                  </group>
               ))}
               <group ref={xMark} visible={false}>
                  <XMarkPrimitive />
               </group>
            </>
         )}
      </group>
   );
}

/** The treasure index of the p-th coin pile, or -1 while it is still buried. */
function coinPileTreasure(reveals: Reveals, pile: number): number {
   for (let i = 0; i < reveals.kind.length; i++) if (reveals.kind[i] === "coins" && reveals.slot[i] === pile) return i;
   return -1;
}

// ---------- the seagull hint ----------

function Gull({ run, island, marker }: { run: RunState; island: Island; marker: MarkerTarget[] }) {
   const time = useGameTime();
   const g = useRef<Group>(null);
   const [state] = useState(() => ({ k: 0, x: 0, y: 0, z: 0 }));
   const [bob] = useState<BodyOffset>(() => ({ y: 0, roll: 0, yaw: 0, squash: 1 }));
   useFrame(() => {
      const target = run.hint.target;
      if (target >= 0) {
         state.x = island.treasures[target].x;
         state.z = island.treasures[target].z;
         state.y = groundAt(state.x, state.z, run.shape);
      }
      state.k += ((target >= 0 ? 1 : 0) - state.k) * (1 - Math.exp(-1.6 * time.delta));
      marker[0].x = state.x;
      marker[0].y = state.y + 0.3;
      marker[0].z = state.z;
      marker[0].hidden = target < 0;
      // the X of the complete map gets an arrow too when it is off screen
      const last = island.finalChest;
      if (marker[1] && last !== undefined) {
         const t = island.treasures[last];
         marker[1].x = t.x;
         marker[1].y = groundAt(t.x, t.z, run.shape) + 0.3;
         marker[1].z = t.z;
         marker[1].hidden = !(run.found >= island.treasures.length - 1 && !run.dug[last]) || target === last;
      }
      const node = g.current;
      if (!node) return;
      node.visible = state.k > 0.02;
      if (!node.visible) return;
      const angle = (time.now / HINT.lapS) * Math.PI * 2;
      hover(time.now, 0.15, bob);
      // it circles counter-clockwise seen from above, banked into the turn, glides down to it, and
      // circles on the camera's line of sight through the spot (moved towards the camera by its
      // height over tan(pitch)), so on screen it is right over the treasure, never off the top
      const height = HINT.height + (1 - state.k) * 9;
      node.position.set(
         state.x + Math.cos(angle) * HINT.radius,
         state.y + height + bob.y,
         state.z + height / Math.tan(PITCH) - Math.sin(angle) * HINT.radius
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

/** Every box footprint plus each tall map prop's drawn box (the free camera views stop at them). */
function solidsFor(island: Island, level: IslandLevel | undefined): AABB[] {
   const out = island.boxes.map((b) => ({ min: { ...b.min, y: 0 }, max: { ...b.max, y: 2.5 } }));
   for (const p of level?.map?.props ?? []) {
      if (p.h < 1.4 || p.hx !== undefined) continue;
      const e = Math.max(p.w, p.d) / 2;
      out.push({ min: { x: p.x - e, y: 0, z: p.z - e }, max: { x: p.x + e, y: p.h, z: p.z + e } });
   }
   return out;
}

export default function Scene() {
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const view = useFittedView(viewFor(width, height));
   const input = useInput();
   const fx = useFx();
   // a new island every run: GameShell remounts the Scene (and its game time) on start and retry
   const { id, config } = useIslandLevel();
   const [island] = useState(() => generateIsland(randomSeed(), config));
   const [run] = useState(() => createRun(island, config));
   // the camera follows the explorer where it is drawn (on the hill, on a bridge)
   const [follow] = useState(() => ({ x: run.explorer.x, y: groundAt(run.explorer.x, run.explorer.z, run.shape), z: run.explorer.z }));

   // camera views (core/camera): the rules get the drawn camera's yaw (the fitted yaw in the default view)
   const cam = useCameraViews({
      slug: "treasure-island",
      subject: "character",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         const e = run.explorer;
         o.x = e.x; o.y = follow.y + 1.0; o.z = e.z; o.heading = e.heading; o.vx = e.vx; o.vz = e.vz;
      },
      solids: (out: AABB[]) => fillSolids(solids, out),
   });

   // the camera views' solids: every box footprint plus the tall round props (cliffs, huts, hedges) as boxes
   const [solids] = useState<AABB[]>(() => solidsFor(island, config));
   const [scratch] = useState(() => ({
      step: { dirX: 0, dirZ: 0, digHeld: false, digPressed: false } as StepInput,
      dir: { x: 0, z: 0 },
      at: { x: 0, y: 0, z: 0 },
      lastDigPuff: 0,
   }));
   const [reveals] = useState<Reveals>(() => {
      const n = island.treasures.length;
      return {
         at: new Array<number>(n).fill(-1),
         kind: new Array<TreasureType | null>(n).fill(null),
         slot: new Array<number>(n).fill(0),
         coins: 0,
         gems: 0,
         clues: 0,
         maps: 0,
      };
   });
   const [marker] = useState<MarkerTarget[]>(() =>
      island.finalChest === undefined ? [{ x: 0, y: 0.3, z: 0, hidden: true }] : [{ x: 0, y: 0.3, z: 0, hidden: true }, { x: 0, y: 0.3, z: 0, hidden: true }]
   );

   useEffect(() => fx.warm("sparkle", "puff", "confetti", "debris", "sparks", "score"), [fx]);

   // the game: move or dig, detector, tide, hint, score, end. Only while "playing", before every visual.
   useRunFrame((_state, dt, time) => {
      const { moveX, moveY, action, jump, actionPressed, jumpPressed } = input.current;
      const { step, dir, at } = scratch;
      inputToWorld(moveX, moveY, cam.yaw(), dir);
      step.dirX = dir.x;
      step.dirZ = dir.z;
      step.digHeld = action || jump;
      step.digPressed = actionPressed || jumpPressed;
      stepRun(run, island, step, dt, time);

      const ev = run.events;
      const e = run.explorer;
      follow.x = e.x;
      follow.y = groundAt(e.x, e.z, run.shape);
      follow.z = e.z;
      at.x = e.x;
      at.y = follow.y + 0.1;
      at.z = e.z;
      // TODO(P-06): one detector beep per pulse: if (ev.beep) playSfx("click", { pitch: 0.8 + 0.8 * s, volume: 0.3 + 0.4 * s })
      // TODO(P-06): a "thud" every 0.2 s of a held dig; ev.tide: playSfx("whoosh") and the surf loop to 0.5
      if (ev.digStarted) {
         fx.burst("puff", at, 6);
         scratch.lastDigPuff = time;
      } else if (run.dig.active && time - scratch.lastDigPuff >= 0.22) {
         fx.burst("puff", at, 3);
         scratch.lastDigPuff = time;
      }
      if (ev.falseDig) {
         fx.burst("puff", at, 16);
         fx.burst("debris", at, 8);
         playSfx("hit"); // TODO(P-06): at a low volume
      }
      if (ev.gateOpened >= 0 && island.gates) {
         // the blocked path clears: dust, debris and a word over it
         const g = island.gates[ev.gateOpened];
         at.x = g.x;
         at.y = groundAt(g.x, g.z, run.shape) + 0.6;
         at.z = g.z;
         fx.burst("puff", at, 26);
         fx.burst("debris", at, 14);
         at.y += 1.2;
         fx.score(at, "Path open!", { color: "#bbf7d0" });
         fx.shake(0.12);
      }
      if (ev.found < 0) return;

      const i = ev.found;
      const t = island.treasures[i];
      const kind = ev.foundType;
      reveals.at[i] = time;
      reveals.kind[i] = kind;
      reveals.slot[i] = kind === "coins" ? reveals.coins++ : kind === "gem" ? reveals.gems++ : kind === "clue" ? reveals.clues++ : kind === "map" ? reveals.maps++ : 0;
      at.x = t.x;
      at.y = groundAt(t.x, t.z, run.shape) + 0.4;
      at.z = t.z;
      fx.burst("sparkle", at, ev.foundType === "chest" ? 36 : 22);
      if (ev.foundClean) fx.burst("sparks", at, 10);
      at.y += 0.9;
      fx.score(at, ev.foundClean ? `+${POINTS.find + POINTS.clean} clean` : `+${POINTS.find}`, { color: ev.foundClean ? "#fde68a" : "#fff7d6" });
      if (kind === "clue" || kind === "map" || ev.chestUnlocked) {
         at.y += 0.7;
         fx.score(at, ev.chestUnlocked ? "Map complete!" : kind === "clue" ? "A clue!" : `Map piece ${reveals.maps}`, { color: "#fecaca" });
      }
      fx.shake(ev.foundType === "chest" ? 0.22 : 0.08);
      playSfx("pickup"); // TODO(P-06): + "chime" when clean
      const store = useArcadeStore.getState();
      store.addScore(POINTS.find + (ev.foundClean ? POINTS.clean : 0));
      store.setStat("treasures", run.found);
      if (island.finalChest !== undefined) store.setStat("map", reveals.maps);
      if (isWon(run)) {
         // the run clock ticked before this callback: timeLeftMs / elapsedMs are this frame's
         const { timeLeftMs, elapsedMs } = useArcadeStore.getState();
         store.setScore(capScore(runScore(run.found, run.cleanFinds, true, timeLeftMs ?? 0), elapsedMs, PROPOSED_LEVEL_LIMITS[id]));
         at.y = 1;
         fx.burst("confetti", at, 45);
         fx.burst("sparkle", at, 30);
         fx.shake(0.24);
         store.end("win");
      }
   });

   return (
      <>
         {/* the camera reads run.explorer, which useRunFrame already moved this frame */}
         <CameraRig
            camera={{ position: view.offset, lookAt: [0, 0, 0] }}
            follow={follow}
            followFraction={1}
            offset={view.offset}
            shift={view.shift}
            damping={4}
         />
         {run.shape.map ? <MapScene island={island} run={run} levelId={id} /> : <IslandScene island={island} run={run} levelId={id} />}
         <Treasures run={run} island={island} reveals={reveals} />
         <Explorer run={run} />
         <DetectorRing run={run} />
         <Gull run={run} island={island} marker={marker} />
         <TargetMarkers targets={marker} color="#f8fafc" />
      </>
   );
}
