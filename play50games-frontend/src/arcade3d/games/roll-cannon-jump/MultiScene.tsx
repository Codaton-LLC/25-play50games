"use client";

// Roll Cannon Jump with 2-4 local players (menu2/multiplayer): the same big top as solo (the orbs,
// the smashed boards and the paint jams are shared), one animated Hero per player with a ring in
// the player's colour under it, the solo juice (quieter), the runs stepped together by
// multiplayer.ts with each player's own device (PlayerInputLatch + playerInputFor: the stick turns
// that player's barrel, Jump fires, then dives), and the shared camera framing every hero still in
// the show (the card: one tent, one camera), turnable with the mouse, two fingers or P1's camera keys.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, createJuiceEmitter, useJuice } from "@/arcade3d/menu2/juice";
import { randomSeed } from "@/arcade3d/core/math";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import type { LevelId } from "@/arcade3d/types";
import type { AABB } from "@/arcade3d/core/collision";
import { PLAYER_COLORS, playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "@/arcade3d/menu2/multiplayer/SharedCamera";
import { createOrbit } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import World from "./World";
import { Course, type VisualClock } from "./Course";
import { Hero, createHeroAnim, groundUnder } from "./Hero";
import { FOV, cannonOrbit, courseSolids } from "./camera";
import { STAT, createStepInput, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, progressOf, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { CannonLevel } from "./levels";
import { useShowJuice } from "./Scene";

export const MP_CAMERA = { pitch: 0.42, minSpan: 9, maxSpan: 34, padding: 2.5 } as const;

function MultiSimulation({ multi, anims, clock, orbit }: { multi: MultiRun; anims: ReturnType<typeof createHeroAnim>[]; clock: VisualClock; orbit: ReturnType<typeof createOrbit> }) {
   const juice = useJuice();
   const time = useGameTime();
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   const trails = useMemo(() => multi.runs.map(createJuiceEmitter), [multi]);
   const effects = useShowJuice();
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
         effects(run, ev, anims[i], now, 0.55);
         if (ev.finished) {
            anims[i].winAt = now;
            juice.popup(run.hero, `P${i + 1} through!`, { color: PLAYER_COLORS[i] });
         }
         if (run.hero.mode === "fly") juice.stream("trail", run.hero, 26, trails[i], { color: PLAYER_COLORS[i] });
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
   useFrame(() => {
      clock.ms = multi.simMs;
   }, FRAME_PRIORITY.camera);
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
      m.visible = h.mode !== "lost";
      const inCannon = h.mode === "aim" || h.mode === "catch";
      m.position.set(h.x, inCannon ? h.y + 1.1 : g + 0.05, h.z);
      m.rotation.x = -Math.PI / 2;
      const pulse = 1 + Math.sin(time.now * 4 + index) * 0.06;
      m.scale.setScalar(pulse * (inCannon ? 0.7 : 1));
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
   const { config } = useLevel<CannonLevel>();
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
   const points = useMemo(() => multi.runs.map((r) => r.hero), [multi]);
   const active = useMemo(() => {
      const out: boolean[] = [];
      return () => {
         for (let i = 0; i < multi.runs.length; i++) {
            const r = multi.runs[i];
            out[i] = r.ended === null && r.hero.mode !== "lost";
         }
         return out;
      };
   }, [multi]);
   const anchor = useMemo(() => () => (multi.mode.ranking === "race" ? leaderIndex(multi) : ("centroid" as const)), [multi]);
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   useEffect(() => {
      camera.fov = FOV;
      camera.updateProjectionMatrix();
   }, [camera]);
   const orbit = useMemo(() => createOrbit({ ...cannonOrbit(multi.runs[0].course), pitch: MP_CAMERA.pitch }), [multi]);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         let n = 0;
         for (const r of multi.runs) {
            if (r.ended !== null || r.hero.mode !== "fly") continue;
            out.x += r.hero.vx;
            out.z += r.hero.vz;
            n++;
         }
         if (n > 0) {
            out.x /= n;
            out.z /= n;
         }
      },
      [multi],
   );
   // the leader's show is drawn (level 5: the leader's Ashbag)
   const view = multi.runs[0];
   const solids = useMemo(() => (out: AABB[]) => courseSolids(view, clock.ms, camera.position.x, camera.position.y, camera.position.z, out), [view, clock, camera]);
   return (
      <JuiceLayer>
         <World run={view} />
         <Course run={view} clock={clock} />
         {multi.runs.map((r, i) => (
            <Hero key={i} run={r} anim={anims[i]} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={i} multi={multi} index={i} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} clock={clock} orbit={orbit} />
         <OrbitDriver orbit={orbit} travel={travel} />
         <SharedCamera points={points} active={active} anchor={anchor} pitch={MP_CAMERA.pitch} minSpan={MP_CAMERA.minSpan} maxSpan={MP_CAMERA.maxSpan} padding={MP_CAMERA.padding} fov={FOV} orbit={orbit} solids={solids} />
      </JuiceLayer>
   );
}
