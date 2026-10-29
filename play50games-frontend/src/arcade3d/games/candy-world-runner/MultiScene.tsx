"use client";

// Candy World Runner with 2-4 local players (menu2/multiplayer): the same road as solo, one runner per
// player (each on its own device: PlayerInputLatch + playerInputFor, each at its own size), the orbs
// shared, the solo juice (quieter), and the shared camera framing every runner still running (held on
// the leader in versus). The road (its coins and smashed obstacles) and King Bonbon are drawn from the
// leader's run. Remounted for every run (runId).
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, useJuice } from "@/arcade3d/menu2/juice";
import { playSfx } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { PLAYER_COLORS, playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "@/arcade3d/menu2/multiplayer/SharedCamera";
import { createOrbit } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import World from "./World";
import { Road } from "./Road";
import { King } from "./King";
import { Runner, createHeroAnim, type HeroAnim } from "./Hero";
import { CANDY_ORBIT, FOV } from "./camera";
import { STAT, createStepInput, speedNow, visualS, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, runnerProgress, stepMulti, type MultiRun } from "./multiplayer";
import { createFlick, mapInput, useEventJuice } from "./RunnerJuice";
import type { HeroId } from "./heroes";
import type { CandyLevel } from "./levels";

/** The shared camera: tilt and the zoom limit (m) before it holds on the leader. */
export const MP_CAMERA = { pitch: 0.45, minSpan: 9, maxSpan: 26, padding: 2 } as const;

function MultiSimulation({ multi, anims }: { multi: MultiRun; anims: HeroAnim[] }) {
   const juice = useJuice();
   const time = useGameTime();
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   const flicks = useMemo(() => multi.runs.map(createFlick), [multi]);
   const juiceFor = useEventJuice();

   useEffect(() => {
      playersStore.getState().beginRun();
   }, [multi]);

   useRunFrame((_state, dt) => {
      for (let i = 0; i < multi.runs.length; i++) mapInput(playerInputFor(i), flicks[i], inputs[i]);
      const events = stepMulti(multi, dt * 1000, inputs);
      const now = time.now;
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         const ev = events[i];
         juiceFor(run, ev, anims[i], false);
         const r = run.runner;
         if (ev.finished) {
            anims[i].winAt = now;
            const p = { x: r.x, y: 1.2, z: -visualS(run) };
            juice.burst("checkpoint", p, 60);
            juice.popup(p, `P${i + 1} is through!`, { color: PLAYER_COLORS[i] });
            playSfx("chime", { pitch: 1.2 });
         }
         players.setPosition(i, r.x, r.h, -visualS(run));
         const dist = runnerProgress(multi, i);
         const p = players.players[i];
         if (p && (p.score !== run.orbs || p.progress !== dist || p.finished !== (run.ended === "win"))) {
            players.update(i, { score: run.orbs, progress: dist, finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs + multi.startMs[i] : null });
         }
      }
      if (multi.ended !== null) {
         const store = useArcadeStore.getState();
         store.setStat(STAT.finishMs, multi.firstFinishMs ?? 0);
         store.end(multi.ended);
      }
   });
   return null;
}

/** A ring in the player's colour under each runner, so everyone finds their own. */
function PlayerRing({ multi, index }: { multi: MultiRun; index: number }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const run = multi.runs[index];
      m.position.set(run.runner.x, (run.runner.onRail ? 2.4 : 0) + 0.05, -visualS(run));
      const pulse = 1 + Math.sin(time.now * 4 + index) * 0.06;
      m.scale.set(pulse, pulse, pulse);
   });
   return (
      <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={2}>
         <ringGeometry args={[0.6, 0.78, 32]} />
         <meshBasicMaterial color={PLAYER_COLORS[index]} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

/** The leader's road and king, following a change of leader. */
function LeaderRoad({ multi, level }: { multi: MultiRun; level: LevelId }) {
   const [lead, setLead] = useState(0);
   useFrame(() => {
      const l = leaderIndex(multi);
      if (l !== lead) setLead(l);
   });
   const run = multi.runs[lead];
   return (
      <>
         <World level={level} length={run.course.finishS} />
         <Road key={lead} run={run} />
         <King key={`k${lead}`} run={run} />
      </>
   );
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<CandyLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const multi = useMemo(
      () => createMultiRun(randomSeed(), levelId, heroKey.split(",").filter(Boolean) as HeroId[], mode),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runId, levelId, heroKey, mode],
   );
   const anims = useMemo(() => multi.runs.map(createHeroAnim), [multi]);
   const points = useMemo(() => multi.runs.map(() => ({ x: 0, y: 0, z: 0 })), [multi]);
   const active = useMemo(() => {
      const out: boolean[] = [];
      return () => {
         for (let i = 0; i < multi.runs.length; i++) {
            const r = multi.runs[i];
            points[i].x = r.runner.x;
            points[i].y = r.runner.h;
            points[i].z = -visualS(r);
            out[i] = r.ended === null;
         }
         return out;
      };
   }, [multi, points]);
   const anchor = useMemo(() => () => (multi.mode.ranking === "race" ? leaderIndex(multi) : ("centroid" as const)), [multi]);
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   useEffect(() => {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
   }, [camera]);
   const orbit = useMemo(() => createOrbit({ ...CANDY_ORBIT, pitch: MP_CAMERA.pitch }), [multi]);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         const r = multi.runs[leaderIndex(multi)];
         out.x = 0;
         out.z = -speedNow(r);
      },
      [multi],
   );
   return (
      <JuiceLayer>
         <LeaderRoad key={levelId} multi={multi} level={levelId} />
         {multi.runs.map((r, i) => (
            <Runner key={i} run={r} anim={anims[i]} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={`p${i}`} multi={multi} index={i} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} />
         <OrbitDriver orbit={orbit} travel={travel} input={{ oneFinger: false, mouseButtons: [2] }} />
         <SharedCamera points={points} active={active} anchor={anchor} pitch={MP_CAMERA.pitch} minSpan={MP_CAMERA.minSpan} maxSpan={MP_CAMERA.maxSpan} padding={MP_CAMERA.padding} fov={FOV} orbit={orbit} />
      </JuiceLayer>
   );
}

