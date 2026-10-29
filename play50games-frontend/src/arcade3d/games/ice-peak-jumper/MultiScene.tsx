"use client";

// Ice Peak Jumper with 2-4 local players (menu2/multiplayer): the same peak as solo, one animated hero
// per player (each on its own device: PlayerInputLatch + playerInputFor), the orbs shared, the solo juice
// (quieter), and the shared camera framing every hero still climbing (held on the highest in versus).
// The peak's cracked ice and the golem are drawn from the leader's run. Remounted for every run (runId).
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
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import World from "./World";
import { Peak } from "./Peak";
import { Golem } from "./Golem";
import { GroundProbe, Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, PEAK_ORBIT } from "./camera";
import { STAT, createStepInput, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, stepMulti, type MultiRun } from "./multiplayer";
import { mapInput, useEventJuice } from "./PeakJuice";
import type { HeroId } from "./heroes";
import type { PeakLevel } from "./levels";

/** The shared camera: tilt and the zoom limit (m) before it holds on the leader. */
export const MP_CAMERA = { pitch: 0.5, minSpan: 9, maxSpan: 26, padding: 2 } as const;

function MultiSimulation({ multi, anims, orbit }: { multi: MultiRun; anims: HeroAnim[]; orbit: OrbitState }) {
   const juice = useJuice();
   const time = useGameTime();
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   const juiceFor = useEventJuice();

   useEffect(() => {
      playersStore.getState().beginRun();
   }, [multi]);

   useRunFrame((_state, dt) => {
      for (let i = 0; i < multi.runs.length; i++) mapInput(playerInputFor(i), orbit.viewYaw, inputs[i]);
      const events = stepMulti(multi, dt * 1000, inputs);
      const now = time.now;
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         const ev = events[i];
         juiceFor(run, ev, anims[i], false);
         const h = run.hero;
         if (ev.finished) {
            anims[i].winAt = now;
            const p = { x: h.x, y: h.y + 1, z: h.z };
            juice.burst("checkpoint", p, 60);
            juice.popup(p, `P${i + 1} on the summit!`, { color: PLAYER_COLORS[i] });
            playSfx("chime", { pitch: 1.2 });
         }
         players.setPosition(i, h.x, h.y, h.z);
         const climbed = Math.round(Math.max(0, run.best - run.course.plats[run.course.start].y));
         const p = players.players[i];
         if (p && (p.score !== run.orbs || p.progress !== climbed || p.finished !== (run.ended === "win"))) {
            players.update(i, { score: run.orbs, progress: climbed, finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs : null });
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

/** A ring in the player's colour under each hero, so everyone finds their own. */
function PlayerRing({ multi, index, ground }: { multi: MultiRun; index: number; ground: { current: number } }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const h = multi.runs[index].hero;
      const g = ground.current;
      m.visible = h.state !== "lost" && Number.isFinite(g);
      m.position.set(h.x, (Number.isFinite(g) ? g : h.y) + 0.05, h.z);
      const pulse = 1 + Math.sin(time.now * 4 + index) * 0.06;
      m.scale.set(pulse, pulse, pulse);
   });
   return (
      <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={2}>
         <ringGeometry args={[0.46, 0.6, 32]} />
         <meshBasicMaterial color={PLAYER_COLORS[index]} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

/** The leader's peak (its cracked ice, its golem), following a change of leader. */
function LeaderPeak({ multi }: { multi: MultiRun }) {
   const [lead, setLead] = useState(0);
   useFrame(() => {
      const l = leaderIndex(multi);
      if (l !== lead) setLead(l);
   });
   const run = multi.runs[lead];
   return (
      <>
         <World run={run} course={run.course} />
         <Peak key={lead} run={run} />
         <Golem key={`g${lead}`} run={run} />
      </>
   );
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<PeakLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const multi = useMemo(
      () => createMultiRun(randomSeed(), levelId, heroKey.split(",").filter(Boolean) as HeroId[], mode),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runId, levelId, heroKey, mode],
   );
   const anims = useMemo(() => multi.runs.map(createHeroAnim), [multi]);
   const grounds = useMemo(() => multi.runs.map(() => ({ current: 0 })), [multi]);
   const points = useMemo(() => multi.runs.map((r) => r.hero), [multi]);
   const active = useMemo(() => {
      const out: boolean[] = [];
      return () => {
         for (let i = 0; i < multi.runs.length; i++) out[i] = multi.runs[i].ended === null && multi.runs[i].hero.state !== "lost";
         return out;
      };
   }, [multi]);
   const anchor = useMemo(() => () => (multi.mode.ranking === "race" ? leaderIndex(multi) : ("centroid" as const)), [multi]);
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   useEffect(() => {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
   }, [camera]);
   const orbit = useMemo(() => createOrbit({ ...PEAK_ORBIT, pitch: MP_CAMERA.pitch }), [multi]);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         const r = multi.runs[leaderIndex(multi)];
         if (r.hero.state !== "play") return;
         out.x = r.hero.vx;
         out.z = r.hero.vz;
      },
      [multi],
   );
   return (
      <JuiceLayer>
         <LeaderPeak multi={multi} />
         {multi.runs.map((r, i) => (
            <Hero key={i} run={r} anim={anims[i]} ground={grounds[i]} />
         ))}
         {multi.runs.map((r, i) => (
            <GroundProbe key={`g${i}`} run={r} ground={grounds[i]} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={`p${i}`} multi={multi} index={i} ground={grounds[i]} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} orbit={orbit} />
         <OrbitDriver orbit={orbit} travel={travel} />
         <SharedCamera points={points} active={active} anchor={anchor} pitch={MP_CAMERA.pitch} minSpan={MP_CAMERA.minSpan} maxSpan={MP_CAMERA.maxSpan} padding={MP_CAMERA.padding} fov={FOV} orbit={orbit} />
      </JuiceLayer>
   );
}

