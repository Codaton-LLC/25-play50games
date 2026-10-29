"use client";

// Color Door Sprint with 2-4 local players (menu2/multiplayer): each hero runs its own corridor, side
// by side (the card), the same seed for everyone (versus) or each hero's own colour as its true door
// (co-op "Door Roulette"). One hall per player (World + Course offset along x), the solo juice, the
// runs stepped together by multiplayer.ts with each player's own device (PlayerInputLatch +
// playerInputFor: left / right change lanes, up / Jump jumps, down rolls), and one shared camera
// behind the pack that frames every hero (menu2 SharedCamera with the orbit). Remounted per run.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, useJuice } from "@/arcade3d/menu2/juice";
import { randomSeed } from "@/arcade3d/core/math";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import type { LevelId } from "@/arcade3d/types";
import type { AABB } from "@/arcade3d/core/collision";
import { PLAYER_COLORS, playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "@/arcade3d/menu2/multiplayer/SharedCamera";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import World from "./World";
import { Course } from "./Course";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { DOOR_ORBIT, FOV, courseSolids, orbitTravel } from "./camera";
import { STAT, createStepInput, distanceOf, type StepInput } from "./rules";
import { createMultiRun, stepMulti, type MultiRun } from "./multiplayer";
import { juiceEvents } from "./Scene";
import type { HeroId } from "./heroes";
import type { DoorLevel } from "./levels";

/** The shared camera: tilt, and the zoom limit (m). */
export const MP_CAMERA = { pitch: 0.4, minSpan: 10, maxSpan: 44, padding: 3 } as const;

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
         s.left = p.pressed.left;
         s.right = p.pressed.right;
         s.up = p.pressed.up;
         s.down = p.pressed.down;
         s.jumpPressed = p.jumpPressed;
         s.actionPressed = p.actionPressed;
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
         pt.x = h.x + multi.offsets[i];
         pt.y = h.y;
         pt.z = h.z;
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

/** A ring in the player's colour on the floor under each hero, so everyone finds their own. */
function PlayerRing({ multi, index }: { multi: MultiRun; index: number }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const h = multi.runs[index].hero;
      m.position.set(h.x + multi.offsets[index], 0.05, h.z);
      const pulse = 1 + Math.sin(time.now * 4 + index) * 0.06;
      m.scale.set(pulse, pulse, pulse);
   });
   return (
      <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={2}>
         <ringGeometry args={[0.75, 0.95, 32]} />
         <meshBasicMaterial color={PLAYER_COLORS[index]} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<DoorLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const multi = useMemo(
      () => createMultiRun(randomSeed(), levelId, heroKey.split(",").filter(Boolean) as HeroId[], mode),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runId, levelId, heroKey, mode],
   );
   const anims = useMemo(() => multi.runs.map(createHeroAnim), [multi]);
   const points = useMemo(() => multi.runs.map((r, i) => ({ x: r.hero.x + multi.offsets[i], y: 0, z: r.hero.z })), [multi]);
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
   const orbit = useMemo(() => createOrbit({ ...DOOR_ORBIT, pitch: MP_CAMERA.pitch }), [multi]);
   const travel = useMemo(() => (out: { x: number; z: number }) => orbitTravel(multi.runs[0].hero.v, out), [multi]);
   const view = useMemo(() => ({ z: 0 }), []);
   useFrame(() => {
      let z = 0;
      for (const r of multi.runs) z += r.hero.z;
      view.z = z / multi.runs.length;
   }, FRAME_PRIORITY.camera);
   const solids = useMemo(() => (out: AABB[]) => courseSolids(multi.runs[0], camera.position.z, out), [multi, camera]);
   return (
      <JuiceLayer>
         {multi.runs.map((r, i) => (
            <group key={i} position-x={multi.offsets[i]}>
               <World course={r.course} view={view} outer={i === 0} />
               <Course run={r} />
            </group>
         ))}
         {multi.runs.map((r, i) => (
            <Hero key={i} run={r} anim={anims[i]} offsetX={multi.offsets[i]} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={i} multi={multi} index={i} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} points={points} orbit={orbit} />
         <OrbitDriver orbit={orbit} travel={travel} input={{ oneFinger: false }} />
         <SharedCamera points={points} active={active} anchor={() => "centroid"} pitch={MP_CAMERA.pitch} minSpan={MP_CAMERA.minSpan} maxSpan={MP_CAMERA.maxSpan} padding={MP_CAMERA.padding} fov={FOV} orbit={orbit} solids={solids} />
      </JuiceLayer>
   );
}
