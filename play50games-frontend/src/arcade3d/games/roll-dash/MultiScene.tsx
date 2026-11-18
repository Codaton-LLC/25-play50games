"use client";

// Roll Dash with 2-4 local players (menu2/multiplayer): the same street as solo (drawn once from the
// leader's run: its items and orbs), one animated active hero per player with a ring in the player's
// slot colour under it, the solo juice (quieter), the runs stepped together by multiplayer.ts with each
// player's own device (PlayerInputLatch + playerInputFor: left / right change lane, up jumps, down
// tucks; P1 also tags with the portrait strip), and the shared camera framing every roller down the
// street, turnable with the mouse, two fingers or P1's camera keys.
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
import { createOrbit } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import World from "./World";
import { Street } from "./StreetView";
import Hawk from "./Hawk";
import { Hero, createHeroAnim } from "./Hero";
import { FOV, dashOrbit, laneSign } from "./camera";
import { STAT, createStepInput, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, progressOf, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { DashLevel } from "./levels";
import { useDashJuice } from "./Scene";
import { takeTag, tagIndexOf } from "@/arcade3d/menu2/heroTag/tagInput";

export const MP_CAMERA = { pitch: 0.42, minSpan: 9, maxSpan: 40, padding: 3 } as const;

function MultiSimulation({ multi, anims, orbit }: { multi: MultiRun; anims: ReturnType<typeof createHeroAnim>[]; orbit: ReturnType<typeof createOrbit> }) {
   const juice = useJuice();
   const time = useGameTime();
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   const effects = useDashJuice();
   useEffect(() => {
      playersStore.getState().beginRun();
   }, [multi]);
   useRunFrame((_state, dt) => {
      const sign = laneSign(orbit.viewYaw);
      // the portrait strip tags for player 1
      const req = takeTag();
      const q = req ? tagIndexOf(req) : null;
      for (let i = 0; i < multi.runs.length; i++) {
         const p = playerInputFor(i);
         const s = inputs[i];
         s.lane = p.pressed.left ? -sign : p.pressed.right ? sign : 0;
         s.jumpPressed = p.jumpPressed || p.pressed.up;
         s.downPressed = p.pressed.down;
         s.actionPressed = p.actionPressed;
         s.tag = i === 0 && q && q.hero >= 0 ? q.hero + 1 : 0;
         s.tagCycle = i === 0 && q ? q.cycle : 0;
      }
      const events = stepMulti(multi, dt * 1000, inputs);
      const now = time.now;
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         const ev = events[i];
         effects(run, ev, anims[i], now, 0.55);
         const h = run.hero;
         if (ev.finished) {
            anims[i].winAt = now;
            juice.popup({ x: h.x, y: h.y + 1.6, z: -h.d }, `P${i + 1} at the gate!`, { color: PLAYER_COLORS[i] });
         }
         players.setPosition(i, h.x, h.y, -h.d);
         const prog = progressOf(run);
         const p = players.players[i];
         if (p && (p.score !== run.orbs || p.progress !== prog || p.finished !== (run.ended === "win"))) {
            players.update(i, { score: run.orbs, progress: prog, finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs : null });
         }
      }
      if (multi.ended !== null) {
         const store = useArcadeStore.getState();
         store.setStat(STAT.finishMs, multi.firstFinishMs ?? 0);
         store.end(multi.ended === "lose" ? "timeup" : multi.ended);
      }
   });
   return null;
}

/** A ring in the player's colour under each roller. */
function PlayerRing({ multi, index }: { multi: MultiRun; index: number }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const h = multi.runs[index].hero;
      m.position.set(h.x, 0.05, -h.d);
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
   const { config } = useLevel<DashLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const multi = useMemo(
      () => createMultiRun(randomSeed(), levelId, heroKey.split(",").filter(Boolean) as HeroId[], mode),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runId, levelId, heroKey, mode],
   );
   const anims = useMemo(() => multi.runs.map(createHeroAnim), [multi]);
   const points = useMemo(
      () =>
         multi.runs.map((r) => ({
            get x() {
               return r.hero.x;
            },
            get y() {
               return r.hero.y;
            },
            get z() {
               return -r.hero.d;
            },
         })),
      [multi],
   );
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
   const orbit = useMemo(() => createOrbit({ ...dashOrbit(multi.runs[0].course.cfg.boss), autoFollow: false, pitch: MP_CAMERA.pitch }), [multi]);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         out.x = 0;
         out.z = -1;
      },
      [],
   );
   const view = multi.runs[leaderIndex(multi)] ?? multi.runs[0];
   return (
      <JuiceLayer>
         <World run={view} />
         <Street run={view} />
         <Hawk run={view} />
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
