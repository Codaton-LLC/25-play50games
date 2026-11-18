"use client";

// Temple Gong Timing with 2-4 local players (menu2/multiplayer): one stage, one song, one animated hero
// per player with a ring in the player's colour, the solo juice (quieter; the drum track plays once), the
// runs stepped together by multiplayer.ts with each player's own device, and the card's "one fixed
// elevated stage camera for everyone" (the shared camera on the stage, turnable by mouse, two fingers or
// P1's keys).
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer } from "@/arcade3d/menu2/juice";
import { randomSeed } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { PLAYER_COLORS, playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "@/arcade3d/menu2/multiplayer/SharedCamera";
import { createOrbit } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import World from "./World";
import { Stage } from "./StageView";
import Coilstone from "./Coilstone";
import { Hero, createHeroAnim } from "./Hero";
import { FOV, stageOrbit } from "./camera";
import { createStepInput, type StepInput } from "./rules";
import { createMultiRun, progressOf, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { GongLevel } from "./levels";
import { useGongJuice } from "./Scene";

export const MP_CAMERA = { pitch: 0.62, minSpan: 14, maxSpan: 22, padding: 3 } as const;

function MultiSimulation({ multi, anims, orbit }: { multi: MultiRun; anims: ReturnType<typeof createHeroAnim>[]; orbit: ReturnType<typeof createOrbit> }) {
   const time = useGameTime();
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   const effects = useGongJuice();
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
         s.actionPressed = p.actionPressed;
         s.action = p.action;
      }
      const events = stepMulti(multi, dt * 1000, inputs);
      const now = time.now;
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         effects(run, events[i], anims[i], now, 0.55, i === 0);
         if (events[i].finished && run.ended === "win") anims[i].winAt = now;
         const h = run.hero;
         players.setPosition(i, h.x, h.air, h.z);
         const prog = progressOf(run);
         const p = players.players[i];
         if (p && (p.score !== run.score || p.progress !== prog || p.finished !== (run.ended === "win"))) {
            players.update(i, { score: run.score, progress: prog, finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs : null });
         }
      }
      if (multi.ended !== null) useArcadeStore.getState().end(multi.ended);
   });
   return null;
}

function PlayerRing({ multi, index }: { multi: MultiRun; index: number }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const h = multi.runs[index].hero;
      m.position.set(h.x, 0.04, h.z);
      m.rotation.x = -Math.PI / 2;
      m.scale.setScalar(1 + Math.sin(time.now * 4 + index) * 0.06);
   });
   return (
      <mesh ref={ref} renderOrder={2}>
         <ringGeometry args={[0.42, 0.56, 32]} />
         <meshBasicMaterial color={PLAYER_COLORS[index]} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<GongLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const multi = useMemo(
      () => createMultiRun(randomSeed(), levelId, heroKey.split(",").filter(Boolean) as HeroId[], mode),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runId, levelId, heroKey, mode],
   );
   const anims = useMemo(() => multi.runs.map(createHeroAnim), [multi]);
   const points = useMemo(() => multi.runs.map((r) => ({ x: r.hero.x, y: 0, z: r.hero.z, src: r.hero })), [multi]);
   useFrame(() => {
      for (const p of points) {
         p.x = p.src.x;
         p.z = p.src.z;
      }
   }, -0.3);
   const active = useMemo(() => {
      const out: boolean[] = [];
      return () => {
         for (let i = 0; i < multi.runs.length; i++) out[i] = multi.runs[i].ended === null;
         return out;
      };
   }, [multi]);
   const anchor = useMemo(() => () => "centroid" as const, []);
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   useEffect(() => {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
   }, [camera]);
   const orbit = useMemo(() => createOrbit({ ...stageOrbit(multi.runs[0].stage), pitch: MP_CAMERA.pitch }), [multi]);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         out.x = 0;
         out.z = 0;
      },
      [],
   );
   return (
      <JuiceLayer>
         <World run={multi.runs[0]} />
         <Stage run={multi.runs[0]} />
         <Coilstone run={multi.runs[0]} />
         {multi.runs.map((r, i) => (
            <Hero key={i} run={r} anim={anims[i]} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={i} multi={multi} index={i} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} orbit={orbit} />
         <OrbitDriver orbit={orbit} travel={travel} />
         <SharedCamera points={points} active={active} anchor={anchor} pitch={MP_CAMERA.pitch} minSpan={MP_CAMERA.minSpan} maxSpan={MP_CAMERA.maxSpan} padding={MP_CAMERA.padding} fov={FOV} orbit={orbit} />
      </JuiceLayer>
   );
}
