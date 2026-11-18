"use client";

// Jungle Vine Jump with 2-4 local players (menu2/multiplayer): the same tree as solo, drawn once
// (the vines, the orbs and the emeralds are shared), one animated Hero per player with a ring in
// the player's colour under it, the solo juice (quieter), the runs stepped together by multiplayer.ts
// with each player's own device (PlayerInputLatch + playerInputFor), and the shared camera framing
// the vertical band that holds every hero (the card: a shared vertical camera), turnable with the mouse, two fingers or P1's
// camera keys.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, useJuice } from "@/arcade3d/menu2/juice";
import { randomSeed } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import type { AABB } from "@/arcade3d/core/collision";
import { PLAYER_COLORS, playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "@/arcade3d/menu2/multiplayer/SharedCamera";
import { createOrbit } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import World from "./World";
import { Course } from "./CourseView";
import Howler from "./Howler";
import { Hero, createHeroAnim, groundUnder } from "./Hero";
import { FOV, courseSolids, vineOrbit } from "./camera";
import { STAT, createStepInput, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, progressOf, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { VineLevel } from "./levels";
import { useVineJuice } from "./Scene";

export const MP_CAMERA = { pitch: 0.3, minSpan: 12, maxSpan: 36, padding: 3 } as const;

function MultiSimulation({ multi, anims, orbit }: { multi: MultiRun; anims: ReturnType<typeof createHeroAnim>[]; orbit: ReturnType<typeof createOrbit> }) {
   const juice = useJuice();
   const time = useGameTime();
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   const effects = useVineJuice();
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
      }
      const events = stepMulti(multi, dt * 1000, inputs);
      const now = time.now;
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         const ev = events[i];
         effects(run, ev, anims[i], now, 0.55);
         if (ev.finished) {
            anims[i].winAt = now;
            juice.popup(run.hero, `P${i + 1} through!`, { color: PLAYER_COLORS[i] });
         }
         const h = run.hero;
         players.setPosition(i, h.x, h.y, h.z);
         const prog = progressOf(run);
         const p = players.players[i];
         if (p && (p.score !== run.orbs || p.progress !== prog || p.finished !== (run.ended === "win"))) {
            players.update(i, { score: run.orbs, progress: prog, finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs : null });
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

/** A ring in the player's colour on whatever is under each hero, so everyone finds their own. */
function PlayerRing({ multi, index }: { multi: MultiRun; index: number }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const r = multi.runs[index];
      const h = r.hero;
      const g = groundUnder(r, h.x, h.z, h.y);
      m.visible = Number.isFinite(g) && h.y - g < 6;
      m.position.set(h.x, g + 0.06, h.z);
      m.rotation.x = -Math.PI / 2;
      m.scale.setScalar(1 + Math.sin(time.now * 4 + index) * 0.06);
   });
   return (
      <mesh ref={ref} renderOrder={2}>
         <ringGeometry args={[0.46, 0.6, 32]} />
         <meshBasicMaterial color={PLAYER_COLORS[index]} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<VineLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const multi = useMemo(
      () => createMultiRun(randomSeed(), levelId, heroKey.split(",").filter(Boolean) as HeroId[], mode),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runId, levelId, heroKey, mode],
   );
   const anims = useMemo(() => multi.runs.map(createHeroAnim), [multi]);
   const points = useMemo(() => multi.runs.map((r) => r.hero), [multi]);
   const active = useMemo(() => {
      const out: boolean[] = [];
      return () => {
         for (let i = 0; i < multi.runs.length; i++) out[i] = multi.runs[i].ended === null;
         return out;
      };
   }, [multi]);
   const anchor = useMemo(() => () => (multi.mode.ranking === "race" ? leaderIndex(multi) : ("centroid" as const)), [multi]);
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   useEffect(() => {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
   }, [camera]);
   const orbit = useMemo(() => createOrbit({ ...vineOrbit(multi.runs[0].course), pitch: MP_CAMERA.pitch, autoFollow: false }), [multi]);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         out.x = 0;
         out.z = 0;
      },
      [],
   );
   // the leader's King is drawn (level 5)
   const view = multi.runs[leaderIndex(multi)] ?? multi.runs[0];
   const solids = useMemo(() => (out: AABB[]) => courseSolids(multi.runs[0], camera.position.x, camera.position.y, camera.position.z, out), [multi, camera]);
   return (
      <JuiceLayer>
         <World run={multi.runs[0]} />
         <Course run={multi.runs[0]} />
         <Howler run={view} />
         {multi.runs.map((r, i) => (
            <Hero key={i} run={r} anim={anims[i]} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={i} multi={multi} index={i} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} orbit={orbit} />
         <OrbitDriver orbit={orbit} travel={travel} />
         <SharedCamera points={points} active={active} anchor={anchor} pitch={MP_CAMERA.pitch} minSpan={MP_CAMERA.minSpan} maxSpan={MP_CAMERA.maxSpan} padding={MP_CAMERA.padding} fov={FOV} orbit={orbit} solids={solids} />
      </JuiceLayer>
   );
}
