"use client";

// One useRunFrame: the press (locked on tapDown, fired on tap / swipe down / keys), then rules.ts,
// then the store, fx and sound. Everything else only reads the run (Bay, Parts, Robot, board).
import { useEffect, useMemo, useState } from "react";
import { useFrame, useThree, type RootState } from "@react-three/fiber";
import { useLevel } from "@/arcade3d/core/level";
import { Vector3 } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { InstancedModel } from "@/arcade3d/core/assets";
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { useQuality } from "@/arcade3d/core/quality";
import { Instanced } from "@/arcade3d/core/render";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { ASSETS, POWER_CORE_DRAWN, POWER_CORE_FALLBACK, POWER_CORE_SPOTS } from "./assets";
import { Bay } from "./Bay";
import { BlueprintBoard } from "./BlueprintBoard";
import { CAMERA, FOCUS, viewFor } from "./camera";
import { createLook, noteEvent, stepLook, CRADLE_TOP } from "./look";
import { COLORS } from "./looks";
import { Parts } from "./Parts";
import { Robot } from "./Robot";
import { SortBins } from "./SortBins";
import { FactorySets } from "./FactoryBay";
import type { FactoryLevel } from "./levels";
import type { LevelId } from "@/arcade3d/types";
import { CRADLE, SCRAP_BIN, SORTER, beltSpeed, createRun, createShown, inZone, sortBinCenter, sorterSpeed, stepRun, syncStore, type FrameInput, type Run } from "./rules";

export const useFactoryLevel = () => useLevel<FactoryLevel>();

export { CAMERA } from "./camera";

/** A press locks the grab-zone part within this many CSS px of its centre (a 56 px target). */
export const TAP_HIT_RADIUS_PX = 28;
/** The part's centre above its feet, for the press projection. */
const PART_CENTRE = 0.23;

const binAt = { x: 0, y: 0, z: 0 };
const binScreen = [0, 0, 0, 0];

/**
 * The bin whose label is nearest the press, or -1 when the press is closer to neither
 * (further than the gap between two bins). Touch and keys then share the rules' one bin field.
 */
function lockBin(state: RootState, press: { x: number; y: number }, v: Vector3): number {
   const w = state.size.width;
   const h = state.size.height;
   const px = (press.x * 0.5 + 0.5) * w;
   const py = (-press.y * 0.5 + 0.5) * h;
   let best = -1;
   let bestD = Infinity;
   for (let i = 0; i < SORTER.BINS; i++) {
      sortBinCenter(i, binAt);
      v.set(binAt.x, binAt.y, binAt.z).project(state.camera);
      if (!(v.z >= -1 && v.z <= 1)) {
         binScreen[i] = Number.NaN;
         continue;
      }
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      binScreen[i] = sx;
      const d = (sx - px) * (sx - px) + (sy - py) * (sy - py);
      if (d < bestD) {
         best = i;
         bestD = d;
      }
   }
   if (best < 0) return -1;
   const neighbour = best === 0 ? 1 : best - 1;
   const gap = Math.abs(binScreen[best] - binScreen[neighbour]);
   if (!(gap > 0) || bestD > (gap * 0.55) * (gap * 0.55)) return -1;
   return best;
}

/** The grab-zone part nearest the press within TAP_HIT_RADIUS_PX, or -1. */
function lockPart(state: RootState, run: Run, press: { x: number; y: number }, v: Vector3): number {
   const w = state.size.width;
   const h = state.size.height;
   const px = (press.x * 0.5 + 0.5) * w;
   const py = (-press.y * 0.5 + 0.5) * h;
   let best = -1;
   let bestD = TAP_HIT_RADIUS_PX * TAP_HIT_RADIUS_PX;
   for (const p of run.parts) {
      if (!inZone(p)) continue;
      v.set(p.x, p.y + PART_CENTRE, p.z).project(state.camera);
      if (!(v.z >= -1 && v.z <= 1)) continue;
      const dx = (v.x * 0.5 + 0.5) * w - px;
      const dy = (-v.y * 0.5 + 0.5) * h - py;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
         best = p.uid;
         bestD = d;
      }
   }
   return best;
}

function FittedCamera() {
   const width = useThree((state) => state.size.width);
   const height = useThree((state) => state.size.height);
   const view = useFittedView(viewFor(width, height));
   const position = useMemo<[number, number, number]>(
      () => [FOCUS.x + view.offset[0], FOCUS.y + view.offset[1], FOCUS.z + view.offset[2]],
      [view.offset]
   );
   return <CameraRig camera={{ position, fov: CAMERA.fov, lookAt: CAMERA.lookAt }} offset={view.offset} shift={view.shift} damping={5} />;
}

function PowerCores() {
   return (
      <InstancedModel
         asset={ASSETS.powerCore}
         spots={POWER_CORE_SPOTS}
         fallback={
            <Instanced spots={POWER_CORE_FALLBACK} name="power-cores-fallback">
               <cylinderGeometry args={[POWER_CORE_DRAWN.width / 2, POWER_CORE_DRAWN.width / 2, POWER_CORE_DRAWN.height, 16]} />
               <meshStandardMaterial color={COLORS.rim} roughness={0.4} metalness={0.5} />
            </Instanced>
         }
      />
   );
}

function LevelScene({ config, levelId }: { config: FactoryLevel; levelId: LevelId }) {
   const [run] = useState(() => createRun(randomSeed(), config));
   const [look] = useState(createLook);
   const [scratch] = useState(() => ({
      v: new Vector3(),
      at: new Vector3(),
      input: { grab: false, scrap: false, target: -1, bin: -1 } as FrameInput,
      locked: -1,
      shown: createShown(),
      speed: config.sorter ? sorterSpeed(0, config) : beltSpeed(0, config),
      sparkClock: 0,
      cheered: false,
   }));
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const quality = useQuality();
   const phase = useArcadeStore((s) => s.phase);
   const muted = useMuted();
   const [loop] = useState<{ current: LoopHandle | null }>(() => ({ current: null }));

   useEffect(() => fx.warm("sparks", "sparkle", "puff", "confetti", "score"), [fx]);

   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const belt = startLoop("belt", { volume: 0.22 });
      const speed = run.level.sorter ? sorterSpeed(0, run.level) : beltSpeed(run.robot, run.level);
      belt.set({ pitch: beltPitch(speed, run.level) });
      loop.current = belt;
      return () => {
         belt.stop();
         loop.current = null;
      };
   }, [phase, muted, loop, run]);

   useRunFrame((state, dt) => {
      const live = input.current;
      const cmd = scratch.input;
      cmd.bin = -1;
      if (run.level.sorter) {
         // one action, the frame it arrives: digit 1-4 or a tap on that bin. No second step, so the dwell is the same.
         cmd.grab = false;
         cmd.scrap = false;
         cmd.target = -1;
         const digit = live.digit;
         if (digit !== null && digit >= 1 && digit <= SORTER.BINS) cmd.bin = digit - 1;
         else if (live.tap) cmd.bin = lockBin(state, live.tap, scratch.v);
      } else {
         if (live.tapDown) scratch.locked = lockPart(state, run, live.tapDown, scratch.v);
         cmd.grab = live.jumpPressed || live.actionPressed || live.tap !== null;
         cmd.scrap = live.pressed.down;
         // the tap and the swipe act on the part their press locked; keys on the part nearest the claw
         cmd.target = live.tap !== null || live.swipe === "down" ? scratch.locked : -1;
         if (live.tap !== null || live.swipe === "down") scratch.locked = -1;
      }

      stepRun(run, cmd, dt);
      const store = useArcadeStore.getState();
      syncStore(run, store, scratch.shown);

      for (let i = 0; i < run.eventCount; i++) {
         const e = run.events[i];
         noteEvent(look, e, e.part);
         const at = scratch.at.set(e.x, e.y + 0.45, e.z);
         if (e.kind === "install" || e.kind === "sort") {
            fx.burst("sparkle", at, 10);
            fx.score(at, `+${e.points}`, { color: COLORS.parts[e.colour] });
            playSfx("pickup", { pitch: 1 + 0.06 * run.combo });
         } else if (e.kind === "misbin") {
            fx.burst("puff", at, 6);
            fx.shake(0.1);
            if (e.points < 0) fx.score(at, `${e.points}`, { color: COLORS.bad });
            playSfx("buzz");
            playSfx("thud", { volume: 0.45 });
         } else if (e.kind === "robot") {
            at.set(CRADLE.x, CRADLE_TOP + 0.8, CRADLE.z);
            fx.burst("confetti", at, 42);
            fx.score(at, "+200 ROBOT!", { color: COLORS.gold, size: 0.075 });
            fx.shake(0.12);
            playSfx("chime");
            playSfx("combo", { pitch: 1.1 });
         } else if (e.kind === "wrong") {
            fx.burst("puff", at, 6);
            fx.shake(0.1);
            playSfx("buzz");
            playSfx("thud", { volume: 0.45 });
         } else if (e.kind === "strike") {
            fx.burst("sparks", at, 14);
            fx.shake(0.3);
            playSfx("zap");
            playSfx("hit");
         } else if (e.kind === "scrapFault") {
            playSfx("whoosh");
            playSfx("thud");
         } else if (e.kind === "scrapClean") {
            playSfx("whoosh");
            playSfx("buzz", { volume: 0.6 });
         } else if (e.kind === "zap") {
            fx.burst("sparks", at, 8);
            playSfx("zap", { volume: 0.35 });
         } else if (e.kind === "missed") {
            playSfx("thud", { volume: 0.25, pitch: 0.7 });
         }
      }
      const v = run.level.sorter ? sorterSpeed(run.t, run.level) : beltSpeed(run.robot, run.level);
      if (v !== scratch.speed) {
         scratch.speed = v;
         loop.current?.set({ pitch: beltPitch(v, run.level) });
      }
      if (run.over && run.outcome === "win" && !scratch.cheered) {
         scratch.cheered = true;
         fx.burst("confetti", scratch.at.set(2.05, 1.4, CRADLE.z), 60);
      }
   });

   // looks between events: flyers land (sparks on the cradle), parts drop in the bin, faulty parts fizz
   useFrame(() => {
      const dt = time.delta;
      if (dt <= 0) return;
      stepLook(look, dt);
      if (look.landedNow >= 0) {
         fx.burst("sparks", scratch.at.set(CRADLE.x, CRADLE_TOP + 0.3 + 0.12 * look.landedNow, CRADLE.z), 9);
         playSfx("click", { volume: 0.6 });
      }
      if (look.binnedNow) {
         const drop = run.level.sorter ? look.claw.drop : SCRAP_BIN;
         fx.burst("puff", scratch.at.set(drop.x, drop.y + 0.25, drop.z), 8);
      }
      scratch.sparkClock += dt;
      const every = quality.tier === "low" ? 0.36 : 0.18;
      if (scratch.sparkClock >= every && phase === "playing") {
         scratch.sparkClock = 0;
         for (const p of run.parts) {
            if (!p.active || !p.faulty) continue;
            fx.burst("sparks", scratch.at.set(p.x, p.y + 0.4, p.z), 4);
         }
      }
   });

   return (
      <>
         <FittedCamera />
         {/* Cool blue key light over the grab zone & belt */}
         <pointLight position={[0, 3.2, 1.8]} color={COLORS.rim} intensity={5.5} distance={8} decay={1.5} />
         {/* Warm amber accent light highlighting the cradle, robot, and exit door */}
         <pointLight position={[2.6, 2.8, -0.2]} color={COLORS.warn} intensity={3.5} distance={7.5} decay={1.6} />
         {/* Cool accent light over the feeder conveyor and parts stream */}
         <pointLight position={[-2.6, 2.6, 0.4]} color={COLORS.rim} intensity={2.8} distance={7} decay={1.6} />
         <Bay run={run} look={look} />
         {run.level.sorter ? <SortBins /> : <BlueprintBoard run={run} />}
         <Parts run={run} look={look} />
         <Robot run={run} />
         {run.level.sorter && <PowerCores />}
         <FactorySets levelId={levelId} />
      </>
   );
}

/** Belt-loop pitch from the level's own speed range (level 1: 1.45 → 2.60, the old formula). */
function beltPitch(speed: number, level: FactoryLevel): number {
   const from = level.sorter ? level.sortV0 : level.v0;
   const to = level.sorter ? level.sortV1 : level.vMax;
   return 0.95 + (0.15 * (speed - from)) / (to - from);
}

export default function Scene() {
   const { id, config } = useFactoryLevel();
   return <LevelScene key={id} config={config} levelId={id} />;
}
