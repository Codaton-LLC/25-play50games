"use client";

// Ring Jump Challenge with 2-4 local players (menu2/multiplayer, after the sky-tower-jump adoption):
// the same canyon and rings as solo (shared: the first to thread a ring takes it), one animated Hero
// per player, the solo juice, the runs stepped together by multiplayer.ts with each player's own device
// (PlayerInputLatch + playerInputFor, Jump held = Dive), and the shared camera framing every hero still
// diving (the card: shared, looking down the shaft, fitted to all heroes, held on the lowest in versus).
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, useJuice } from "@/arcade3d/menu2/juice";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import { playSfx } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import type { LevelId } from "@/arcade3d/types";
import { PLAYER_COLORS, playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "@/arcade3d/menu2/multiplayer/SharedCamera";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import World, { TideBell } from "./World";
import { Course, type VisualClock } from "./Course";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { CycloneRay } from "./Boss";
import { FOV, RING_ORBIT, shaftSolids } from "./camera";
import type { AABB } from "@/arcade3d/core/collision";
import { PTS, createStepInput, ringPos, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { RingLevel } from "./levels";

/** The shared camera: steep (looking down the shaft), and the zoom limit (m) before it holds on the leader. */
export const MP_CAMERA = { pitch: 1.1, minSpan: 8, maxSpan: 14, padding: 2 } as const;

function MultiSimulation({ multi, anims, clock, orbit }: { multi: MultiRun; anims: HeroAnim[]; clock: VisualClock; orbit: OrbitState }) {
   const juice = useJuice();
   const time = useGameTime();
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const p2 = useMemo(() => ({ x: 0, z: 0 }), []);
   const spot = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);

   useEffect(() => {
      playersStore.getState().beginRun();
   }, [multi]);

   useRunFrame((_state, dt) => {
      for (let i = 0; i < multi.runs.length; i++) {
         const p = playerInputFor(i);
         const s = inputs[i];
         s.moveX = p.moveX;
         s.moveZ = p.moveY;
         // every player steers relative to the one shared camera
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
         const anim = anims[i];
         const h = run.hero;
         chest.x = h.x;
         chest.y = h.y;
         chest.z = h.z;
         if (ev.leaped) {
            anim.leapAt = now;
            playSfx("jump", { volume: 0.4 });
         }
         if (ev.powered) {
            if (run.heroId === "nami") anim.flipAt = now;
            juice.burst("aura", chest, 10, { color: heroAccent(run.heroId) });
            playSfx("whoosh", { volume: 0.4, pitch: 1.15 });
         }
         for (let k = 0; k < ev.ringCount; k++) {
            const r = run.course.rings[ev.ringList[k]];
            ringPos(r, run.simMs, p2);
            spot.x = p2.x;
            spot.y = r.y;
            spot.z = p2.z;
            juice.burst("pickup", spot, 14, { color: PLAYER_COLORS[i] });
            juice.popup(spot, `P${i + 1} +${ev.ringCentre[k] ? PTS.centre : PTS.ring}`, { color: PLAYER_COLORS[i] });
            playSfx("whoosh", { pitch: 1 + Math.min(1, run.streak * 0.08), volume: 0.45 });
         }
         for (let k = 0; k < ev.orbCount; k++) {
            const o = run.course.orbs[ev.orbList[k]];
            juice.burst("pickup", o, 10);
            playSfx("pickup", { volume: 0.6 });
         }
         if (ev.bladeHit || ev.laneHit || ev.splashed) {
            anim.hurtAt = now;
            if (ev.splashed) anim.splashAt = now;
            juice.burst("hit", chest, 14);
            juice.shake(0.15);
            playSfx(ev.splashed ? "splash" : "hit", { volume: 0.5 });
         }
         if (ev.respawned) anim.spawnAt = now;
         if (ev.bossHit) {
            juice.burst("hit", chest, 22, { color: "#fef08a" });
            juice.shake(0.2);
         }
         if (ev.finished) {
            anim.landAt = now;
            anim.winAt = now + 0.5;
            juice.burst("checkpoint", chest, 60);
            juice.popup(chest, `P${i + 1} landed!`, { color: PLAYER_COLORS[i] });
            playSfx("chime", { pitch: 1.2 });
         }
         players.setPosition(i, h.x, h.y, h.z);
         const fallen = Math.round(Math.max(0, run.course.top - h.y));
         const p = players.players[i];
         if (p && (p.score !== run.score || p.progress !== fallen || p.finished !== (run.ended === "win"))) {
            players.update(i, { score: run.score, progress: fallen, finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs : null });
         }
      }
      if (multi.ended !== null) useArcadeStore.getState().end(multi.ended);
   });

   useFrame(() => {
      const s = useArcadeStore.getState();
      if (s.phase === "countdown") clock.ms = 0;
      else if (s.phase === "over") clock.ms = multi.simMs + s.overMs;
      else clock.ms = multi.simMs;
   }, FRAME_PRIORITY.camera);
   return null;
}

function PlayerMarker({ multi, index }: { multi: MultiRun; index: number }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const h = multi.runs[index].hero;
      m.visible = h.mode !== "splash";
      m.position.set(h.x, h.y + 1.9, h.z);
      m.rotation.y = time.now * 2;
   });
   return (
      <mesh ref={ref} renderOrder={6}>
         <coneGeometry args={[0.35, 0.6, 4]} />
         <meshBasicMaterial color={PLAYER_COLORS[index]} toneMapped={false} />
      </mesh>
   );
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<RingLevel>();
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
   const ringing = useRef(false);
   const points = useMemo(() => multi.runs.map((r) => r.hero), [multi]);
   const active = useMemo(() => {
      const out: boolean[] = [];
      return () => {
         for (let i = 0; i < multi.runs.length; i++) {
            const r = multi.runs[i];
            out[i] = r.ended === null && r.hero.mode !== "splash";
         }
         return out;
      };
   }, [multi]);
   const anchor = useMemo(() => () => (multi.mode.ranking === "race" ? leaderIndex(multi) : ("centroid" as const)), [multi]);
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   useEffect(() => {
      camera.fov = FOV + 6;
      camera.updateProjectionMatrix();
   }, [camera]);
   const orbit = useMemo(() => createOrbit({ ...RING_ORBIT, pitch: MP_CAMERA.pitch }), [multi]);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         let n = 0;
         for (const r of multi.runs) {
            if (r.ended !== null || r.hero.mode !== "fall") continue;
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
   const solids = useMemo(
      () => (out: AABB[]) => {
         let y = Infinity;
         for (const r of multi.runs) if (r.ended === null) y = Math.min(y, r.hero.y);
         return Number.isFinite(y) ? shaftSolids(multi.view.course, y, out) : 0;
      },
      [multi],
   );
   return (
      <JuiceLayer>
         <World course={multi.view.course} levelId={levelId} />
         <Course run={multi.view} clock={clock} />
         {multi.view.course.boss ? <CycloneRay run={multi.view} clock={clock} /> : null}
         {multi.view.course.boss ? <TideBell course={multi.view.course} ringing={ringing} /> : null}
         {multi.runs.map((r, i) => (
            <Hero key={i} run={r} anim={anims[i]} clock={clock} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerMarker key={i} multi={multi} index={i} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} clock={clock} orbit={orbit} />
         <OrbitDriver orbit={orbit} travel={travel} />
         <SharedCamera points={points} active={active} anchor={anchor} pitch={MP_CAMERA.pitch} minSpan={MP_CAMERA.minSpan} maxSpan={MP_CAMERA.maxSpan} padding={MP_CAMERA.padding} fov={FOV + 6} orbit={orbit} solids={solids} />
      </JuiceLayer>
   );
}
