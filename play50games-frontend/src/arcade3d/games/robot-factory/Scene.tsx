"use client";

// One useRunFrame: the press (locked on tapDown, fired on tap / swipe down / keys), then rules.ts,
// then the store, fx and sound. Everything else only reads the run (Bay, Parts, Robot, board).
import { useEffect, useMemo, useState } from "react";
import { useFrame, useThree, type RootState } from "@react-three/fiber";
import { useLevel } from "@/arcade3d/core/level";
import { Vector3 } from "three";
import CameraRig from "@/arcade3d/core/CameraRig";
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import { useFx } from "@/arcade3d/core/fx";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useInput } from "@/arcade3d/core/input";
import { randomSeed } from "@/arcade3d/core/math";
import { useQuality } from "@/arcade3d/core/quality";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useFittedView } from "@/arcade3d/core/useFittedView";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { Bay } from "./Bay";
import { BlueprintBoard } from "./BlueprintBoard";
import { CAMERA, FOCUS, viewFor } from "./camera";
import { createLook, noteEvent, stepLook, CRADLE_TOP } from "./look";
import { COLORS } from "./palette";
import { Parts } from "./Parts";
import { Robot } from "./Robot";
import type { FactoryLevel } from "./levels";
import { CRADLE, SCRAP_BIN, beltSpeed, createRun, createShown, inZone, stepRun, syncStore, type FrameInput, type Run } from "./rules";

export const useFactoryLevel = () => useLevel<FactoryLevel>();

export { CAMERA } from "./camera";

/** A press locks the grab-zone part within this many CSS px of its centre (a 56 px target). */
export const TAP_HIT_RADIUS_PX = 28;
/** The part's centre above its feet, for the press projection. */
const PART_CENTRE = 0.23;

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

function LevelScene({ config }: { config: FactoryLevel }) {
   const [run] = useState(() => createRun(randomSeed(), config));
   const [look] = useState(createLook);
   const [scratch] = useState(() => ({
      v: new Vector3(),
      at: new Vector3(),
      input: { grab: false, scrap: false, target: -1 } as FrameInput,
      locked: -1,
      shown: createShown(),
      speed: beltSpeed(0, config),
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
      belt.set({ pitch: beltPitch(beltSpeed(run.robot, run.level), run.level) });
      loop.current = belt;
      return () => {
         belt.stop();
         loop.current = null;
      };
   }, [phase, muted, loop, run]);

   useRunFrame((state, dt) => {
      const live = input.current;
      const cmd = scratch.input;
      if (live.tapDown) scratch.locked = lockPart(state, run, live.tapDown, scratch.v);
      cmd.grab = live.jumpPressed || live.actionPressed || live.tap !== null;
      cmd.scrap = live.pressed.down;
      // the tap and the swipe act on the part their press locked; keys on the part nearest the claw
      cmd.target = live.tap !== null || live.swipe === "down" ? scratch.locked : -1;
      if (live.tap !== null || live.swipe === "down") scratch.locked = -1;

      stepRun(run, cmd, dt);
      const store = useArcadeStore.getState();
      syncStore(run, store, scratch.shown);

      for (let i = 0; i < run.eventCount; i++) {
         const e = run.events[i];
         noteEvent(look, e, e.part);
         const at = scratch.at.set(e.x, e.y + 0.45, e.z);
         if (e.kind === "install") {
            fx.burst("sparkle", at, 10);
            fx.score(at, `+${e.points}`, { color: COLORS.parts[e.colour] });
            playSfx("pickup", { pitch: 1 + 0.06 * run.combo });
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
      const v = beltSpeed(run.robot, run.level);
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
      if (look.binnedNow) fx.burst("puff", scratch.at.set(SCRAP_BIN.x, SCRAP_BIN.y + 0.25, SCRAP_BIN.z), 8);
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
         <pointLight position={[0, 2.6, 1.6]} color={COLORS.rim} intensity={6} distance={7} decay={1.6} />
         <Bay run={run} look={look} />
         <BlueprintBoard run={run} />
         <Parts run={run} look={look} />
         <Robot run={run} />
      </>
   );
}

/** Belt-loop pitch from the level's own speed range (level 1: 1.45 → 2.60, the old formula). */
function beltPitch(speed: number, level: FactoryLevel): number {
   return 0.95 + (0.15 * (speed - level.v0)) / (level.vMax - level.v0);
}

export default function Scene() {
   const { id, config } = useFactoryLevel();
   return <LevelScene key={id} config={config} />;
}
