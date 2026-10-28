"use client";

// 2-4 heroes on the same docks. Each has their own rope. The camera frames whoever is furthest along.
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
import Docks, { Rope, type AimState, type VisualClock } from "./Docks";
import Galleon from "./Galleon";
import { Hero, createHeroAnim } from "./Hero";
import { FOV, MP_YAW } from "./camera";
import { levelLook } from "./look";
import { createStepInput, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { SwingLevel } from "./levels";

export const MP_CAMERA = { pitch: 0.42, minSpan: 8, maxSpan: 28, padding: 2.2 } as const;

function MultiSimulation({ multi, clock, points }: { multi: MultiRun; clock: VisualClock; points: { x: number; y: number; z: number }[] }) {
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   useEffect(() => {
      playersStore.getState().beginRun();
   }, [multi]);
   useRunFrame((_state, dt) => {
      for (let i = 0; i < multi.runs.length; i++) {
         const p = playerInputFor(i);
         const s = inputs[i];
         s.moveX = p.moveX;
         s.moveZ = p.moveY;
         s.yaw = MP_YAW;
         s.jumpPressed = p.jumpPressed;
         s.jumpHeld = p.jump;
         s.actionPressed = p.actionPressed;
      }
      stepMulti(multi, dt * 1000, inputs);
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         players.update(i, {
            score: run.orbs,
            progress: Math.round(run.hero.x),
            finished: run.ended === "win",
            finishMs: run.ended === "win" ? run.finishMs : null,
         });
         const pnt = points[i];
         if (pnt) {
            pnt.x = run.hero.x;
            pnt.y = run.hero.y + 1;
            pnt.z = run.hero.z;
         }
      }
      clock.ms = multi.simMs;
      if (multi.ended === "win") useArcadeStore.getState().end("win");
      else if (multi.ended === "timeup") useArcadeStore.getState().end("timeup");
   });
   return <PlayerInputLatch />;
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<SwingLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const seats = usePlayers((s) => s.players);
   const mode = usePlayers((s) => s.mode);
   const multi = useMemo(() => {
      const heroes = seats.map((p) => (p.heroId as HeroId) || "nami");
      return createMultiRun(randomSeed(), levelId, heroes.length ? heroes : ["nami", "riko"], mode);
      // a new shell run rebuilds the group
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [runId, levelId, mode, seats.length]);
   const anims = useMemo(() => multi.runs.map(() => createHeroAnim()), [multi]);
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [multi]);
   const points = useMemo(() => multi.runs.map(() => ({ x: 0, y: 0, z: 0 })), [multi]);
   const hands = useMemo(() => multi.runs.map(() => ({ x: 0, y: 0, z: 0 })), [multi]);
   const aim = useMemo<AimState>(() => ({ index: -1 }), []);
   const look = levelLook(levelId);
   const fog = useMemo(() => ({ color: look.fog[0], near: look.fog[1], far: look.fog[2] }), [look]);
   return (
      <JuiceLayer>
         <World course={multi.runs[0].course} level={levelId} clock={clock} />
         <Docks run={multi.runs[0]} clock={clock} aim={aim} fog={fog} />
         {multi.runs[0].course.boss ? <Galleon run={multi.runs[0]} clock={clock} /> : null}
         {multi.runs.map((run, i) => (
            <Rope key={`r${i}`} run={run} clock={clock} hand={hands[i]} />
         ))}
         {multi.runs.map((run, i) => (
            <Hero key={i} run={run} anim={anims[i]} hand={hands[i]} />
         ))}
         <MultiSimulation multi={multi} clock={clock} points={points} />
         <SharedCamera
            points={points}
            fov={FOV}
            yaw={MP_YAW}
            pitch={MP_CAMERA.pitch}
            minSpan={MP_CAMERA.minSpan}
            maxSpan={MP_CAMERA.maxSpan}
            padding={MP_CAMERA.padding}
            anchor={() => leaderIndex(multi)}
         />
      </JuiceLayer>
   );
}
