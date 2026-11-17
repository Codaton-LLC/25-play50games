"use client";

// 2-4 heroes on the same track, each on their own run. The shared camera frames everyone from behind
// and leans to the leader. Each player switches colour with their pad's action-free button: Jump jumps,
// Action cycles the colour (local multiplayer has no swatches or taps), the stick's up / down jump and
// slide, left / right change lanes.
import { useEffect, useMemo } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer } from "@/arcade3d/menu2/juice";
import { randomSeed } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "@/arcade3d/menu2/multiplayer/SharedCamera";
import World from "./World";
import TrackView from "./TrackView";
import Golem from "./Golem";
import { Hero, createHeroAnim } from "./Hero";
import { FOV } from "./camera";
import { NONE, createStepInput, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, progressOf, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { SwitchLevel } from "./levels";

export const MP_CAMERA = { yaw: 0, pitch: 0.45, minSpan: 9, maxSpan: 28, padding: 2.6 } as const;

function MultiSimulation({ multi, points }: { multi: MultiRun; points: { x: number; y: number; z: number }[] }) {
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   useEffect(() => {
      playersStore.getState().beginRun();
   }, [multi]);
   useRunFrame((_state, dt) => {
      for (let i = 0; i < multi.runs.length; i++) {
         const p = playerInputFor(i);
         const s = inputs[i];
         s.left = p.pressed.left;
         s.right = p.pressed.right;
         s.jumpPressed = p.jumpPressed || p.pressed.up;
         s.slidePressed = p.pressed.down;
         s.colorPick = NONE;
         s.cycle = p.actionPressed;
         s.actionPressed = false;
         s.yaw = 0;
      }
      stepMulti(multi, dt * 1000, inputs);
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         players.update(i, { score: run.passed, progress: progressOf(run), finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs : null });
         const pnt = points[i];
         if (pnt) {
            pnt.x = run.hero.x;
            pnt.y = run.hero.y + 1;
            pnt.z = run.hero.z;
         }
      }
      if (multi.ended === "win") useArcadeStore.getState().end("win");
      else if (multi.ended === "timeup") useArcadeStore.getState().end("timeup");
   });
   return <PlayerInputLatch />;
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<SwitchLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const seats = usePlayers((s) => s.players);
   const mode = usePlayers((s) => s.mode);
   const multi = useMemo(() => {
      const heroes = seats.map((p) => (p.heroId as HeroId) || "riko");
      return createMultiRun(randomSeed(), levelId, heroes.length ? heroes : ["riko", "nami"], mode);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [runId, levelId, mode, seats.length]);
   const anims = useMemo(() => multi.runs.map(() => createHeroAnim()), [multi]);
   const points = useMemo(() => multi.runs.map(() => ({ x: 0, y: 0, z: 0 })), [multi]);
   return (
      <JuiceLayer>
         <World key={`w${levelId}`} track={multi.runs[0].track} level={levelId} />
         <TrackView key={`t${levelId}`} run={multi.runs[0]} level={levelId} />
         {multi.runs[0].track.arenaZ !== null ? <Golem run={multi.runs[0]} /> : null}
         {multi.runs.map((run, i) => (
            <Hero key={i} run={run} anim={anims[i]} />
         ))}
         <MultiSimulation multi={multi} points={points} />
         <SharedCamera points={points} fov={FOV} yaw={MP_CAMERA.yaw} pitch={MP_CAMERA.pitch} minSpan={MP_CAMERA.minSpan} maxSpan={MP_CAMERA.maxSpan} padding={MP_CAMERA.padding} anchor={() => leaderIndex(multi)} />
      </JuiceLayer>
   );
}
