"use client";

// Space Pod Jump with 2-4 local players (menu2/multiplayer): each hero flies its own copy of the system,
// the copies stacked along y (multiplayer.ts copyY), the same seed for everyone. One system per player
// (World once, Course per copy), the solo juice, the runs stepped together by multiplayer.ts with each
// player's own device (PlayerInputLatch + playerInputFor: the stick walks and aims, Jump jumps / charges
// / fires the jets, Action the power), and one shared camera from +z that frames every hero (menu2
// SharedCamera with the orbit; no roll, the card's "up fixed"). Remounted per run.
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
import { PLAYER_COLORS, playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "@/arcade3d/menu2/multiplayer/SharedCamera";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import World from "./World";
import { Course } from "./Course";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { POD_ORBIT, FOV, orbitTravel } from "./camera";
import { STAT, createStepInput, distanceOf, type StepInput } from "./rules";
import { createMultiRun, stepMulti, type MultiRun } from "./multiplayer";
import { juiceEvents } from "./Scene";
import type { HeroId } from "./heroes";
import type { PodLevel } from "./levels";

export const MP_CAMERA = { pitch: 0.08, minSpan: 16, maxSpan: 120, padding: 6 } as const;

function MultiSimulation({ multi, anims, points, orbit }: { multi: MultiRun; anims: HeroAnim[]; points: { x: number; y: number; z: number }[]; orbit: OrbitState }) {
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
         s.up = p.moveY < -0.5 || p.pressed.up;
         s.jump = p.jump;
         s.jumpPressed = p.jumpPressed;
         s.actionPressed = p.actionPressed;
         s.roll = 0;
         s.yaw = orbit.viewYaw;
      }
      const events = stepMulti(multi, dt * 1000, inputs);
      const now = time.now;
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         const ev = events[i];
         if (!ev) continue;
         juiceEvents(run, ev, anims[i], juice, now, `P${i + 1} `);
         if (ev.finished) anims[i].winAt = now;
         const h = run.hero;
         const pt = points[i];
         pt.x = h.x;
         pt.y = h.y + multi.offsets[i];
         pt.z = 0;
         players.setPosition(i, pt.x, pt.y, pt.z);
         const dist = Math.round(distanceOf(run));
         const p = players.players[i];
         if (p && (p.score !== run.orbs || p.progress !== dist || p.finished !== (run.ended === "win"))) {
            players.update(i, { score: run.orbs, progress: dist, finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs : null });
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

function PlayerRing({ multi, index }: { multi: MultiRun; index: number }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const h = multi.runs[index].hero;
      m.position.set(h.x, h.y + multi.offsets[index], 0.4);
      const pulse = 1 + Math.sin(time.now * 4 + index) * 0.06;
      m.scale.set(pulse, pulse, pulse);
   });
   return (
      <mesh ref={ref} renderOrder={2}>
         <ringGeometry args={[0.9, 1.1, 32]} />
         <meshBasicMaterial color={PLAYER_COLORS[index]} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<PodLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const multi = useMemo(
      () => createMultiRun(randomSeed(), levelId, heroKey.split(",").filter(Boolean) as HeroId[], mode),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runId, levelId, heroKey, mode],
   );
   const anims = useMemo(() => multi.runs.map(createHeroAnim), [multi]);
   const points = useMemo(() => multi.runs.map((r, i) => ({ x: r.hero.x, y: r.hero.y + multi.offsets[i], z: 0 })), [multi]);
   const active = useMemo(() => {
      const out: boolean[] = [];
      return () => {
         for (let i = 0; i < multi.runs.length; i++) out[i] = multi.runs[i].ended === null;
         return out;
      };
   }, [multi]);
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   useEffect(() => {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
   }, [camera]);
   const orbit = useMemo(() => createOrbit({ ...POD_ORBIT, pitch: MP_CAMERA.pitch }), [multi]);
   const travel = useMemo(() => (out: { x: number; z: number }) => orbitTravel(out), []);
   const view = useMemo(() => ({ x: 0, y: 0 }), []);
   useFrame(() => {
      let x = 0;
      let y = 0;
      for (const p of points) {
         x += p.x;
         y += p.y;
      }
      view.x = x / points.length;
      view.y = y / points.length;
   });
   return (
      <JuiceLayer>
         <World course={multi.runs[0].course} view={view} />
         {multi.runs.map((r, i) => (
            <group key={i} position-y={multi.offsets[i]}>
               <Course run={r} />
               <Hero run={r} anim={anims[i]} />
            </group>
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={i} multi={multi} index={i} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} points={points} orbit={orbit} />
         <OrbitDriver orbit={orbit} travel={travel} input={{ oneFinger: false }} />
         <SharedCamera points={points} active={active} anchor={() => "centroid"} pitch={MP_CAMERA.pitch} minSpan={MP_CAMERA.minSpan} maxSpan={MP_CAMERA.maxSpan} padding={MP_CAMERA.padding} fov={FOV} orbit={orbit} />
      </JuiceLayer>
   );
}
