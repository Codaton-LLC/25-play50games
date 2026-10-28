"use client";

// Zoo Escape scene: one useRunFrame feeds input into rules.stepRun, the store (applyToStore: the
// same bridge the bots drive) and the feedback (core fx bursts, popups, shake, sfx); every visual
// only reads the run state and animates with useGameTime(). The camera follows a live aim point
// inside the current stage's bounds; stage 3 fades to dusk (core useStageLighting, C2).
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx, startLoop, useMuted } from "@/arcade3d/core/audio";
import type { AABB } from "@/arcade3d/core/collision";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useStageLighting } from "@/arcade3d/core/lighting";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { hop, type BodyOffset } from "@/arcade3d/core/motion";
import { QuadrupedModel, useQuadrupedPose } from "@/arcade3d/core/rig/QuadrupedModel";
import { blendQuadrupedPoses, createQuadrupedPose, quadrupedCrouch, quadrupedGait, quadrupedIdle, quadrupedPhaseStep } from "@/arcade3d/core/rig/quadrupedPoses";
import { BlobShadow } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";
import { SOLIDS } from "./level";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, PANDA_LANDMARKS, PANDA_SCALE } from "./assets";
import { PANDA_GAIT, PANDA_GAIT_OPTIONS, pandaGait } from "./pandaGait";
import { aimAt, stageBounds, viewFor, windowHalf } from "./camera";
import Keepers, { SLOTS, assignSlots } from "./Keepers";
import { STAGES, STAGE_KEEPERS } from "./level";
import { COLORS, pandaPieces, useMerged } from "./Primitives";
import Stage from "./Stage";
import { CLOCK, STATS, applyToStore, createRun, stepRun, type RunState, type StepInput } from "./rules";
import { useZooLevel } from "./useZooLevel";

/** A footstep click every 0.55 m. */
const STEP_M = 0.55;
const DUSK_SKY = COLORS.fogDusk;

function PandaPrimitive() {
   const geometry = useMerged(pandaPieces);
   return (
      <mesh geometry={geometry}>
         <meshStandardMaterial vertexColors roughness={0.65} />
      </mesh>
   );
}

const smooth01 = (a: number, b: number, x: number) => {
   const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
   return t * t * (3 - 2 * t);
};

/**
 * The panda on the core quadruped rig (pandaGait.ts): a diagonal walk / trot on planted paws (the
 * phase advances by the distance really moved over the stride), idle breathing when still, a low
 * crouched walk while sneaking, the head nodding with the steps and turning into a turn; a hop on a
 * toss and out through the exit, flattened while caught.
 */
function Panda({ run }: { run: RunState }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const [m] = useState(() => ({ phase: 0, s01: 0, crouch: 0, turn: 0, facing: run.panda.facing, hop: -1, winAt: -1, lastX: run.panda.x, lastZ: run.panda.z, squash: 1 }));
   const [hopOff] = useState<BodyOffset>(() => ({ y: 0, roll: 0, yaw: 0, squash: 1 }));
   const [poses] = useState(() => ({ gait: createQuadrupedPose(), idle: createQuadrupedPose() }));
   const pose = useQuadrupedPose((out) => {
      const p = run.panda;
      const dt = time.delta;
      const moved = Math.hypot(p.x - m.lastX, p.z - m.lastZ);
      m.lastX = p.x; m.lastZ = p.z;
      // a respawn teleports: no step for it
      const metres = moved < 1 ? moved : 0;
      const playing = useArcadeStore.getState().phase === "playing";
      const speed = playing && !run.card ? p.speed : 0;
      const target = pandaGait(speed, p.sneaking).speed01;
      m.s01 += (target - m.s01) * (1 - Math.exp(-12 * dt));
      m.phase = quadrupedPhaseStep(m.phase, metres, Math.max(0.02, m.s01), PANDA_LANDMARKS, PANDA_SCALE, dt, PANDA_GAIT.maxHz);
      let dyaw = (p.facing - m.facing) % (2 * Math.PI);
      if (dyaw > Math.PI) dyaw -= 2 * Math.PI;
      if (dyaw < -Math.PI) dyaw += 2 * Math.PI;
      m.facing = p.facing;
      const turnRate = dt > 0 ? dyaw / dt : 0;
      m.turn += (Math.max(-1, Math.min(1, turnRate / 6)) - m.turn) * (1 - Math.exp(-8 * dt));
      quadrupedGait(m.phase, m.s01, PANDA_LANDMARKS, poses.gait, m.turn, PANDA_GAIT_OPTIONS);
      quadrupedIdle(time.now, PANDA_LANDMARKS, poses.idle);
      blendQuadrupedPoses(poses.idle, poses.gait, smooth01(0.05, 0.6, speed), out);
      m.crouch += ((p.sneaking && !run.over ? 1 : 0) - m.crouch) * (1 - Math.exp(-dt / 0.08));
      quadrupedCrouch(PANDA_GAIT.crouch * m.crouch, PANDA_GAIT.dip * m.crouch, PANDA_LANDMARKS, out);
   });
   useFrame(() => {
      const g = root.current, b = body.current;
      if (!g || !b) return;
      const p = run.panda;
      const dt = time.delta;
      if (run.events.thrown) m.hop = time.now;
      const x = p.x;
      let z = p.z;
      if (run.over === "win") {
         // the hop out through the gate
         if (m.winAt < 0) m.winAt = time.now;
         const t = time.now - m.winAt;
         z -= Math.min(2.5, t * 2.2);
         hop(t * 9, 0.28, hopOff);
      } else if (m.hop >= 0 && time.now - m.hop < 0.3) hop(((time.now - m.hop) / 0.3) * Math.PI, 0.25, hopOff);
      else { hopOff.y = 0; hopOff.squash = 1; }
      const flat = run.over === "lose" ? 0.55 : run.card > 0 ? 0.7 : 1;
      m.squash += (flat - m.squash) * (1 - Math.exp(-14 * dt));
      g.position.set(x, 0, z);
      g.rotation.y = p.facing;
      b.position.y = hopOff.y;
      const sy = hopOff.squash * m.squash;
      b.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
   });
   return (
      <group ref={root} name="panda">
         <BlobShadow radius={0.5} y={0.03} />
         <group ref={body}>
            <QuadrupedModel asset={ASSETS.panda} pose={pose} fallback={<PandaPrimitive />} />
         </group>
      </group>
   );
}

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

function LevelScene() {
   const { id, config } = useZooLevel();
   const width = useThree((s) => s.size.width);
   const height = useThree((s) => s.size.height);
   const view = useFittedView(viewFor(width, height));
   const { hx, hz } = windowHalf(width, height);
   const input = useInput();
   const fx = useFx();
   const phase = useArcadeStore((s) => s.phase);
   const level = useArcadeStore((s) => s.level);
   const muted = useMuted();
   const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   const [run] = useState(() => createRun(randomSeed(), undefined, config));

   // camera views (core/camera): the rules get the drawn camera's yaw (the fitted yaw in the default view)
   const cam = useCameraViews({
      slug: "zoo-escape",
      subject: "character",
      steering: "camera",
      defaultYaw: view.yaw,
      target: (o) => {
         const p = run.panda;
         o.x = p.x; o.y = 0.7; o.z = p.z; o.heading = p.facing; o.vx = p.vx; o.vz = p.vz;
      },
      solids: (out: AABB[]) => fillSolids(SOLIDS, out),
   });

   const [scratch] = useState(() => ({
      step: { dirX: 0, dirZ: 0, sneak: false, toss: false } as StepInput,
      dir: { x: 0, z: 0 },
      at: { x: 0, y: 0, z: 0 },
      shown: { time: -1, bamboo: -1 },
      aim: aimAt(run.panda.x, run.panda.z, { x: 0, y: 0, z: 0 }),
      slots: new Array<number>(SLOTS).fill(-1),
      walked: 0,
      lastX: run.panda.x,
      lastZ: run.panda.z,
      stage: -1,
      steps: { pitch: 0.7, volume: 0.15 },
      rustle: { pitch: 1.6, volume: 0.25 },
   }));
   const bounds = useMemo<AABB>(() => stageBounds(0, hx, hz, { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }), [hx, hz]);
   const [markers] = useState<MarkerTarget[]>(() => Array.from({ length: 5 }, () => ({ x: 0, y: 0.5, z: 0, hidden: true })));
   const dusk = level >= 3;
   useStageLighting(dusk ? "sunset" : null, 1.5, DUSK_SKY);

   useEffect(() => {
      fx.warm("sparkle", "puff", "confetti", "score");
      const store = useArcadeStore.getState();
      store.setStat(STATS.time, CLOCK.startS);
      store.setStat(STATS.snacks, 0);
      store.setStat(STATS.catches, 0);
      store.setStat(STATS.bamboo, run.level.bundles);
      store.setStat(STATS.card, 0);
   }, [fx]);
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const loop = startLoop("ambient", { volume: 0.2 });
      return () => loop.stop();
   }, [phase, muted]);

   const track = () => {
      stageBounds(run.stage, hx, hz, bounds);
      aimAt(run.panda.x, run.panda.z, scratch.aim);
      assignSlots(run, scratch.aim, hx, hz, scratch.slots);
      const gate = STAGES[run.stage].gate;
      markers[0].x = (gate.x0 + gate.x1) / 2; markers[0].z = gate.z; markers[0].hidden = run.over !== null; markers[0].color = COLORS.accent;
      const ids = STAGE_KEEPERS[run.stage];
      for (let i = 0; i < 3; i++) {
         const t = markers[1 + i];
         const k = i < ids.length ? run.keepers[ids[i]] : null;
         t.hidden = !k || run.over !== null;
         if (!k) continue;
         t.x = k.agent.x; t.z = k.agent.z; t.color = k.meter > 0 ? COLORS.alert : COLORS.cone;
      }
      const l = markers[4];
      l.x = STAGES[2].bounds.x1; l.z = -31; l.hidden = run.stage !== 2 || run.over !== null; l.color = run.light.meter > 0 ? COLORS.alert : COLORS.cone;
   };
   // before play too: the first frame already shows the right keepers and markers
   useFrame(() => { if (useArcadeStore.getState().phase !== "playing") track(); }, -0.3);

   useRunFrame((_state, dt) => {
      const i = input.current;
      const { step, dir, at } = scratch;
      inputToWorld(i.moveX, i.moveY, cam.yaw(), dir);
      step.dirX = dir.x; step.dirZ = dir.z;
      step.sneak = i.jump;
      step.toss = i.actionPressed;
      stepRun(run, step, dt);
      applyToStore(run, useArcadeStore.getState(), scratch.shown);
      track();

      const e = run.events, p = run.panda;
      at.x = p.x; at.y = 0.6; at.z = p.z;
      const d = Math.hypot(p.x - scratch.lastX, p.z - scratch.lastZ);
      scratch.lastX = p.x; scratch.lastZ = p.z;
      if (d < 1) {
         scratch.walked += d;
         if (scratch.walked >= STEP_M) {
            scratch.walked = 0;
            scratch.steps.volume = p.sneaking ? 0.06 : 0.15;
            playSfx("click", scratch.steps);
         }
      }
      if (e.snack >= 0) {
         const s = run.snacks[e.snack];
         at.x = s.x; at.y = 0.4; at.z = s.z;
         fx.burst("sparkle", at, 16);
         at.y = 1.3;
         fx.score(at, "+50", { color: "#fde68a" });
         playSfx("pickup");
      }
      if (e.rustle) { at.x = p.x; at.y = 0.6; at.z = p.z; fx.burst("puff", at, 10); playSfx("whoosh", scratch.rustle); }
      if (e.alerts) playSfx("pop");
      if (e.thrown) playSfx("whoosh");
      if (e.landed) {
         at.x = run.toss.to.x; at.y = 0.1; at.z = run.toss.to.z;
         fx.burst("puff", at, 6);
         playSfx("thud");
         if (e.lured >= 0) playSfx("pop", scratch.rustle);
      }
      if (e.bar >= 0) playSfx("thud", scratch.steps);
      if (e.stage >= 0) playSfx("chime");
      if (e.caught) {
         at.x = p.x; at.y = 0.5; at.z = p.z;
         fx.burst("puff", at, 18);
         playSfx("hit");
         playSfx("alarm", scratch.steps);
         fx.shake(0.3);
      }
      if (e.end === "win") {
         at.x = p.x; at.y = 1; at.z = p.z - 1;
         fx.burst("confetti", at, 40);
         fx.shake(0.15);
      }
   });

   return (
      <>
         <CameraRig camera={{ position: view.offset, lookAt: [0, 0, 0] }} follow={scratch.aim} followFraction={1} bounds={bounds} offset={view.offset} shift={view.shift} damping={5} />
         <Stage run={run} dusk={dusk} reduced={reduced} levelId={id} />
         <Panda run={run} />
         <Keepers run={run} slots={scratch.slots} />
         <TargetMarkers targets={markers} size={26} />
      </>
   );
}

/** Remounts when another level is picked, so the keepers are that level's. */
export default function Scene() {
   const { id } = useZooLevel();
   return <LevelScene key={id} />;
}
