"use client";

// Zoo Escape scene: one useRunFrame feeds input into rules.stepRun, the store (applyToStore: the
// same bridge the bots drive) and the feedback (core fx bursts, popups, shake, sfx); every visual
// only reads the run state and animates with useGameTime(). The camera follows a live aim point
// inside the current stage's bounds; stage 3 fades to dusk (core useStageLighting, C2).
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { Model } from "@/arcade3d/core/assets";
import { playSfx, startLoop, useMuted } from "@/arcade3d/core/audio";
import type { AABB } from "@/arcade3d/core/collision";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useInput } from "@/arcade3d/core/input";
import { useStageLighting } from "@/arcade3d/core/lighting";
import { inputToWorld, randomSeed } from "@/arcade3d/core/math";
import { hop, squashStretch, waddle, type BodyOffset } from "@/arcade3d/core/motion";
import { BlobShadow } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS } from "./assets";
import { aimAt, stageBounds, viewFor, windowHalf } from "./camera";
import Keepers, { SLOTS, assignSlots } from "./Keepers";
import { STAGES, STAGE_KEEPERS } from "./level";
import { COLORS, pandaPieces, useMerged } from "./Primitives";
import Stage from "./Stage";
import { CLOCK, STATS, applyToStore, createRun, stepRun, type RunState, type StepInput } from "./rules";
import { useZooLevel } from "./useZooLevel";

/** The panda's waddle: one swing per 0.55 m. */
const STEP_M = 0.55;
const CROUCH = 0.82;
const DUSK_SKY = COLORS.fogDusk;

function PandaPrimitive() {
   const geometry = useMerged(pandaPieces);
   return (
      <mesh geometry={geometry}>
         <meshStandardMaterial vertexColors roughness={0.65} />
      </mesh>
   );
}

function Panda({ run }: { run: RunState }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const [m] = useState(() => ({ phase: 0, crouch: 1, hop: -1, winAt: -1, lastX: run.panda.x, lastZ: run.panda.z, squash: 1 }));
   const [off] = useState<BodyOffset>(() => ({ y: 0, roll: 0, yaw: 0, squash: 1 }));
   const [hopOff] = useState<BodyOffset>(() => ({ y: 0, roll: 0, yaw: 0, squash: 1 }));
   const [scale] = useState(() => ({ x: 1, y: 1, z: 1 }));
   useFrame(() => {
      const g = root.current, b = body.current;
      if (!g || !b) return;
      const p = run.panda;
      const dt = time.delta;
      const moved = Math.hypot(p.x - m.lastX, p.z - m.lastZ);
      m.lastX = p.x; m.lastZ = p.z;
      if (moved < 1) m.phase += (moved / STEP_M) * Math.PI;
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
      const amount = Math.min(1, p.speed / 3.2);
      waddle(m.phase, 0.12 * amount, off);
      m.crouch += ((p.sneaking ? CROUCH : 1) - m.crouch) * (1 - Math.exp(-dt / 0.05));
      const flat = run.over === "lose" ? 0.55 : run.card > 0 ? 0.7 : 1;
      m.squash += (flat - m.squash) * (1 - Math.exp(-14 * dt));
      squashStretch(m.crouch * hopOff.squash * m.squash, scale);
      g.position.set(x, 0, z);
      g.rotation.y = p.facing;
      b.position.y = off.y + hopOff.y;
      b.rotation.set(0, off.yaw, off.roll);
      b.scale.set(scale.x, scale.y, scale.z);
   });
   return (
      <group ref={root} name="panda">
         <BlobShadow radius={0.5} y={0.03} />
         <group ref={body}>
            <Model asset={ASSETS.panda} fallback={<PandaPrimitive />} />
         </group>
      </group>
   );
}

function LevelScene() {
   const { config } = useZooLevel();
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
      inputToWorld(i.moveX, i.moveY, view.yaw, dir);
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
         <Stage run={run} dusk={dusk} reduced={reduced} />
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
