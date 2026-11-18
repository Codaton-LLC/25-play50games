"use client";

// Dragon Cave Rush with 2-4 local players (menu2/multiplayer): the same cave as solo, one cart per
// player (each with its own hero), the orbs and Riko's shortcuts shared (multiplayer.ts), ONE Cindermaw
// on the leader's tail, the solo juice (quieter), each player's own device (PlayerInputLatch +
// playerInputFor), and the shared camera framing every cart still in (held on the leader in versus).
// Remounted for every run (runId).
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
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import type { LevelId } from "@/arcade3d/types";
import { PLAYER_COLORS, playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "@/arcade3d/menu2/multiplayer/SharedCamera";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import World from "./World";
import { Course, type VisualClock } from "./Course";
import { Dragon, Rider, cartPose, createCartPose, createHeroAnim, type CartPose, type HeroAnim } from "./Hero";
import { CAVE_ORBIT, FOV, yawAt } from "./camera";
import { STAT, createStepInput, type StepInput } from "./rules";
import { cartProgress, createMultiRun, leaderIndex, stepMulti, type MultiRun } from "./multiplayer";
import { mapInput, useEventJuice } from "./CartJuice";
import { lanePoint } from "./track";
import type { HeroId } from "./heroes";
import type { CaveLevel } from "./levels";

/** The shared camera: tilt and the zoom limit (m) before it holds on the leader. */
export const MP_CAMERA = { pitch: 0.42, minSpan: 9, maxSpan: 26, padding: 2 } as const;

function MultiSimulation({ multi, anims, clock, orbit }: { multi: MultiRun; anims: HeroAnim[]; clock: VisualClock; orbit: OrbitState }) {
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
         if (ev.finished) {
            anims[i].winAt = now;
            const p = lanePoint(run.course, run.cart.s, run.cart.d, 1.2, { x: 0, y: 0, z: 0, h: 0 });
            juice.burst("checkpoint", p, 60);
            juice.popup(p, `P${i + 1} is out!`, { color: PLAYER_COLORS[i] });
            playSfx("chime", { pitch: 1.2 });
         }
         const c = run.cart;
         const lp = lanePoint(run.course, c.s, c.d, run.course.lanes[c.lane].y + c.h, { x: 0, y: 0, z: 0, h: 0 });
         players.setPosition(i, lp.x, lp.y, lp.z);
         const dist = cartProgress(multi, i);
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

   useFrame(() => {
      const s = useArcadeStore.getState();
      if (s.phase === "countdown") clock.ms = -s.countdownMs;
      else if (s.phase === "over") clock.ms = multi.ms + s.overMs;
      else clock.ms = multi.ms;
   }, FRAME_PRIORITY.camera);
   return null;
}

/** A ring in the player's colour round each cart, so everyone finds their own. */
function PlayerRing({ pose, index }: { pose: CartPose; index: number }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      m.position.set(pose.x, pose.y + 0.06, pose.z);
      const pulse = 1 + Math.sin(time.now * 4 + index) * 0.06;
      m.scale.set(pulse, pulse, pulse);
   });
   return (
      <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={2}>
         <ringGeometry args={[1.25, 1.45, 32]} />
         <meshBasicMaterial color={PLAYER_COLORS[index]} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

function Poses({ multi, poses }: { multi: MultiRun; poses: CartPose[] }) {
   useFrame(() => {
      for (let i = 0; i < multi.runs.length; i++) cartPose(multi.runs[i], poses[i]);
   }, FRAME_PRIORITY.camera - 0.02);
   return null;
}

/** One Cindermaw (and the cave light) on the leader's tail; follows a change of leader. */
function Leader({ multi, poses }: { multi: MultiRun; poses: CartPose[] }) {
   const [lead, setLead] = useState(0);
   useFrame(() => {
      const l = leaderIndex(multi);
      if (l !== lead) setLead(l);
   });
   const run = multi.runs[lead];
   return (
      <>
         <World run={run} />
         <Dragon key={lead} run={run} cart={poses[lead]} />
      </>
   );
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<CaveLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const multi = useMemo(
      () => createMultiRun(randomSeed(), levelId, heroKey.split(",").filter(Boolean) as HeroId[], mode),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runId, levelId, heroKey, mode],
   );
   const anims = useMemo(() => multi.runs.map(createHeroAnim), [multi]);
   const poses = useMemo(() => multi.runs.map(createCartPose), [multi]);
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [multi]);
   const points = poses;
   const active = useMemo(() => {
      const out: boolean[] = [];
      return () => {
         for (let i = 0; i < multi.runs.length; i++) out[i] = multi.runs[i].ended === null && multi.runs[i].cart.state !== "lost";
         return out;
      };
   }, [multi]);
   const anchor = useMemo(() => () => (multi.mode.ranking === "race" ? leaderIndex(multi) : ("centroid" as const)), [multi]);
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   useEffect(() => {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
   }, [camera]);
   const orbit = useMemo(() => createOrbit({ ...CAVE_ORBIT, yaw: yawAt(multi.runs[0].course, 0), pitch: MP_CAMERA.pitch }), [multi]);
   const dir = useMemo(() => ({ x: 0, y: 0, z: 0, h: 0 }), []);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         const r = multi.runs[leaderIndex(multi)];
         if (r.cart.state !== "ride") return;
         lanePoint(r.course, r.cart.s + 6, 0, 0, dir);
         out.x = -Math.sin(dir.h) * r.cart.v;
         out.z = -Math.cos(dir.h) * r.cart.v;
      },
      [multi, dir],
   );
   return (
      <JuiceLayer>
         <Leader multi={multi} poses={poses} />
         <Course run={multi.runs[0]} clock={clock} />
         {multi.runs.map((r, i) => (
            <Rider key={i} run={r} anim={anims[i]} pose={poses[i]} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={i} pose={poses[i]} index={i} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} clock={clock} orbit={orbit} />
         <Poses multi={multi} poses={poses} />
         <OrbitDriver orbit={orbit} travel={travel} input={{ oneFinger: false, mouseButtons: [2] }} />
         <SharedCamera points={points} active={active} anchor={anchor} pitch={MP_CAMERA.pitch} minSpan={MP_CAMERA.minSpan} maxSpan={MP_CAMERA.maxSpan} padding={MP_CAMERA.padding} fov={FOV} orbit={orbit} />
      </JuiceLayer>
   );
}
