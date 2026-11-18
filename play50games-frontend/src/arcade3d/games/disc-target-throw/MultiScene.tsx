"use client";

// Disc Target Throw with 2-4 local players (menu2/multiplayer): the same courtyard as solo, drawn once
// (the targets are shared: the first disc to hit one takes it), one animated hero and one disc per
// player with a ring in the player's colour under each hero, the solo juice (quieter), the runs stepped
// together by multiplayer.ts with each player's own device (PlayerInputLatch + playerInputFor), and the
// card's shared courtyard camera framing every hero, turnable with the mouse, two fingers or P1's keys.
// Each player aims along the shared camera's view.
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
import { Snapper } from "./Boss";
import { DiscView, createAimView, type AimView } from "./Disc";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, courseSolids, discOrbit } from "./camera";
import { STAT, createStepInput, type StepInput } from "./rules";
import { createMultiRun, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { DiscLevel } from "./levels";
import { useDiscJuice } from "./Scene";

export const MP_CAMERA = { pitch: 0.62, minSpan: 12, maxSpan: 30, padding: 4 } as const;

function MultiSimulation({ multi, anims, aims, orbit }: { multi: MultiRun; anims: HeroAnim[]; aims: AimView[]; orbit: ReturnType<typeof createOrbit> }) {
   const juice = useJuice();
   const time = useGameTime();
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   const effects = useDiscJuice();
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
         s.throwHeld = p.jump;
         s.actionPressed = p.actionPressed;
         aims[i].active = p.jump && multi.runs[i].disc.mode === "hand";
         aims[i].heading = orbit.viewYaw + Math.PI;
         aims[i].hook = Math.max(-1, Math.min(1, p.moveX));
      }
      const events = stepMulti(multi, dt * 1000, inputs);
      const now = time.now;
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         effects(run, events[i], anims[i], now, 0.55);
         const h = run.hero;
         players.setPosition(i, h.x, 0, h.z);
         const p = players.players[i];
         const done = multi.ended === "win";
         if (p && (p.score !== run.score || p.progress !== run.required || p.finished !== done)) {
            players.update(i, { score: run.score, progress: run.required, finished: done, finishMs: done ? multi.simMs : null });
         }
      }
      if (multi.ended !== null) {
         const store = useArcadeStore.getState();
         store.setStat(STAT.finishMs, multi.simMs);
         if (multi.ended === "win") {
            for (const a of anims) a.winAt = now;
            juice.popup({ x: multi.runs[0].hero.x, y: 2, z: multi.runs[0].hero.z }, "Every target down!", { color: "#fde68a", size: 0.08 });
         }
         store.end(multi.ended);
      }
   });
   return null;
}

/** A ring in the player's colour under each hero, so everyone finds their own. */
function PlayerRing({ multi, index }: { multi: MultiRun; index: number }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const h = multi.runs[index].hero;
      m.position.set(h.x, 0.05, h.z);
      m.rotation.x = -Math.PI / 2;
      m.scale.setScalar(1 + Math.sin(time.now * 4 + index) * 0.06);
   });
   return (
      <mesh ref={ref} renderOrder={2}>
         <ringGeometry args={[0.5, 0.66, 32]} />
         <meshBasicMaterial color={PLAYER_COLORS[index]} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<DiscLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const multi = useMemo(
      () => createMultiRun(randomSeed(), levelId, heroKey.split(",").filter(Boolean) as HeroId[], mode),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runId, levelId, heroKey, mode],
   );
   const anims = useMemo(() => multi.runs.map(createHeroAnim), [multi]);
   const aims = useMemo(() => multi.runs.map(createAimView), [multi]);
   // the shared camera frames every hero's feet (rules heroes have no y: these mirror them each frame)
   const tracked = useMemo(() => multi.runs.map((r) => ({ x: r.hero.x, y: 0, z: r.hero.z })), [multi]);
   useFrame(() => {
      for (let i = 0; i < tracked.length; i++) {
         tracked[i].x = multi.runs[i].hero.x;
         tracked[i].z = multi.runs[i].hero.z;
      }
   }, -0.3);
   const active = useMemo(() => {
      const out: boolean[] = [];
      return () => {
         for (let i = 0; i < multi.runs.length; i++) out[i] = true;
         return out;
      };
   }, [multi]);
   const anchor = useMemo(() => () => "centroid" as const, []);
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   useEffect(() => {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
   }, [camera]);
   const orbit = useMemo(() => createOrbit({ ...discOrbit(multi.runs[0].course), pitch: MP_CAMERA.pitch }), [multi]);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         out.x = 0;
         out.z = 0;
      },
      [],
   );
   const solids = useMemo(() => (out: AABB[]) => courseSolids(multi.runs[0].course, camera.position.x, camera.position.z, out), [multi, camera]);
   return (
      <JuiceLayer>
         <World run={multi.runs[0]} />
         <Course run={multi.runs[0]} />
         <Snapper run={multi.runs[0]} />
         {multi.runs.map((r, i) => (
            <Hero key={`h${i}`} run={r} anim={anims[i]} aim={aims[i]} />
         ))}
         {multi.runs.map((r, i) => (
            <DiscView key={`d${i}`} run={r} aim={aims[i]} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={`r${i}`} multi={multi} index={i} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} aims={aims} orbit={orbit} />
         <OrbitDriver orbit={orbit} travel={travel} />
         <SharedCamera points={tracked} active={active} anchor={anchor} pitch={MP_CAMERA.pitch} minSpan={MP_CAMERA.minSpan} maxSpan={MP_CAMERA.maxSpan} padding={MP_CAMERA.padding} fov={FOV} orbit={orbit} solids={solids} />
      </JuiceLayer>
   );
}
