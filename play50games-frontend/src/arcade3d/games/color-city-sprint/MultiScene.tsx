"use client";

// 2-4 local heroes on the same city. Co-op shares the red paint; versus does not.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, useJuice } from "@/arcade3d/menu2/juice";
import { playSfx } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import type { LevelId } from "@/arcade3d/types";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "@/arcade3d/menu2/multiplayer/SharedCamera";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import { World } from "./World";
import { Course, type VisualClock } from "./Course";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { CITY_ORBIT, FOV } from "./camera";
import { STAT, createStepInput, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { CitySpec } from "./levels";

function MultiSimulation({ multi, anims, clock, won, orbit }: { multi: MultiRun; anims: HeroAnim[]; clock: VisualClock; won: { current: boolean }; orbit: OrbitState }) {
   const juice = useJuice();
   const time = useGameTime();
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
         s.yaw = orbit.viewYaw;
         s.jumpPressed = p.jumpPressed;
         s.jumpHeld = p.jump;
         s.actionPressed = p.actionPressed;
      }
      const events = stepMulti(multi, dt * 1000, inputs);
      const now = time.now;
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         const ev = events[i];
         const h = run.hero;
         if (ev.jumped) {
            anims[i].jumpAt = now;
            playSfx("jump", { volume: 0.35 });
         }
         if (ev.landed) anims[i].landAt = now;
         if (ev.airJumped) anims[i].airJumpAt = now;
         if (ev.finished) {
            won.current = true;
            anims[i].winAt = now;
            juice.burst("checkpoint", { x: h.x, y: h.y + 1, z: h.z }, 40, { color: "#ef4444" });
            playSfx("chime");
         }
         players.setPosition(i, h.x, h.y, h.z);
         const p = players.players[i];
         if (p && (p.score !== run.orbs || p.progress !== run.beaconIndex || p.finished !== (run.ended === "win"))) {
            players.update(i, { score: run.orbs, progress: run.beaconIndex, finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs : null });
         }
      }
      if (multi.ended !== null && !won.current) {
         won.current = true;
         const store = useArcadeStore.getState();
         store.setStat(STAT.finishMs, multi.firstFinishMs ?? 0);
         store.end(multi.ended);
      }
   });

   useFrame(() => {
      const s = useArcadeStore.getState();
      if (s.phase === "countdown") clock.ms = -s.countdownMs;
      else if (s.phase === "over") clock.ms = multi.simMs + s.overMs;
      else clock.ms = multi.simMs;
   }, FRAME_PRIORITY.camera);
   return null;
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<CitySpec>();
   const levelId: LevelId = config?.id ?? 1;
   const mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const multi = useMemo(
      () => createMultiRun(randomSeed(), levelId, heroKey.split(",").filter(Boolean) as HeroId[], mode),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runId, levelId, heroKey, mode],
   );
   const anims = useMemo(() => multi.runs.map(createHeroAnim), [multi]);
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [multi]);
   const won = useRef(false);
   const points = useMemo(() => multi.runs.map((r) => r.hero), [multi]);
   const orbit = useMemo(() => createOrbit(CITY_ORBIT), [multi]);
   const active = useMemo(() => {
      const out: boolean[] = [];
      return () => {
         for (let i = 0; i < multi.runs.length; i++) out[i] = multi.runs[i].ended === null;
         return out;
      };
   }, [multi]);
   const anchor = useMemo(() => () => leaderIndex(multi), [multi]);
   return (
      <JuiceLayer>
         <PlayerInputLatch />
         <World course={multi.view.course} levelId={levelId} />
         <Course run={multi.view} clock={clock} />
         {multi.runs.map((run, i) => (
            <Hero key={i} run={run} anim={anims[i]} />
         ))}
         <MultiSimulation multi={multi} anims={anims} clock={clock} won={won} orbit={orbit} />
         <OrbitDriver orbit={orbit} />
         <SharedCamera points={points} active={active} anchor={anchor} pitch={CITY_ORBIT.pitch} fov={FOV} orbit={orbit} minSpan={8} maxSpan={28} />
      </JuiceLayer>
   );
}
