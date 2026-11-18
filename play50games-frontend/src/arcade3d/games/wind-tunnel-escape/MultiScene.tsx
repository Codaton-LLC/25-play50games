"use client";

// Wind Tunnel Escape with 2-4 local players (menu2/multiplayer): the same tunnel as solo with ONE shared
// world (a fan one player turns is turned for all: one turns, another rides), one animated Hero per
// player, the solo juice, the runs stepped together by multiplayer.ts with each player's own device
// (PlayerInputLatch + playerInputFor; Action held switches a fan), and the shared camera framing every
// hero still in (24 m zoom limit, held on the leader in versus). Remounted for every run (runId).
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
import type { AABB } from "@/arcade3d/core/collision";
import { PLAYER_COLORS, playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "@/arcade3d/menu2/multiplayer/SharedCamera";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import World from "./World";
import { Course, type VisualClock } from "./Course";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, WIND_ORBIT, courseSolids } from "./camera";
import { ORB, STAT, createStepInput, groundUnder, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { WindLevel } from "./levels";

/** The shared camera: tilt and the zoom limit (m) before it holds on the leader. */
export const MP_CAMERA = { pitch: 0.55, minSpan: 8, maxSpan: 24, padding: 2 } as const;

function MultiSimulation({ multi, anims, clock, orbit }: { multi: MultiRun; anims: HeroAnim[]; clock: VisualClock; orbit: OrbitState }) {
   const juice = useJuice();
   const time = useGameTime();
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);

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
         s.actionHeld = p.action;
      }
      const events = stepMulti(multi, dt * 1000, inputs);
      const now = time.now;
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         const ev = events[i];
         const anim = anims[i];
         const h = run.hero;
         chest.x = feet.x = h.x;
         chest.z = feet.z = h.z;
         chest.y = h.y + 0.7;
         feet.y = h.y + 0.1;
         if (ev.airJumped) anim.airJumpAt = now;
         else if (ev.jumped) {
            anim.jumpAt = now;
            playSfx("jump", { volume: 0.35 });
         }
         if (ev.landed) anim.landAt = now;
         if (ev.turned >= 0 || ev.switched >= 0) playSfx("click", { pitch: 0.8, volume: 0.6 });
         if (ev.rideStart) playSfx("whoosh", { volume: 0.3 });
         if (ev.powered) {
            juice.burst("aura", chest, 10, { color: heroAccent(run.heroId) });
            playSfx("whoosh", { volume: 0.35, pitch: 1.15 });
         }
         for (let k = 0; k < ev.orbCount; k++) {
            const o = run.course.orbs[ev.orbList[k]];
            juice.burst("pickup", o, 12);
            juice.popup(o, `P${i + 1} -${(ORB.bonusMs / 1000).toFixed(1)} s`, { color: PLAYER_COLORS[i] });
            playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.03), volume: 0.7 });
         }
         if (ev.setup >= 0) juice.popup(chest, "Current set!", { color: "#bae6fd" });
         if (ev.checkpoint > 0) {
            juice.burst("checkpoint", chest, 30);
            juice.popup(chest, multi.mode.sharedCheckpoints ? "Team checkpoint!" : `P${i + 1} checkpoint`, { color: "#ffd257" });
            playSfx("chime");
         }
         if (ev.hit) {
            anim.hitAt = now;
            juice.burst("hit", chest, 12);
            juice.shake(0.15);
            playSfx(ev.stormHit ? "zap" : "hit", { volume: 0.35 });
         }
         if (ev.bossHit) juice.shake(0.3);
         if (ev.lost) anim.lostAt = now;
         if (ev.respawned) {
            anim.spawnAt = now;
            playSfx("pop");
         }
         if (ev.finished) {
            anim.winAt = now;
            juice.burst("checkpoint", chest, 60);
            juice.popup(chest, `P${i + 1} is out!`, { color: PLAYER_COLORS[i] });
            playSfx("chime", { pitch: 1.2 });
         }
         players.setPosition(i, h.x, h.y, h.z);
         const dist = Math.round(Math.max(0, run.bestDist));
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

   useFrame(() => {
      const s = useArcadeStore.getState();
      if (s.phase === "countdown") clock.ms = -s.countdownMs;
      else if (s.phase === "over") clock.ms = multi.ms + s.overMs;
      else clock.ms = multi.ms;
   }, FRAME_PRIORITY.camera);
   return null;
}

function GroundProbes({ multi, grounds }: { multi: MultiRun; grounds: { current: number }[] }) {
   useFrame(() => {
      for (let i = 0; i < multi.runs.length; i++) {
         const r = multi.runs[i];
         grounds[i].current = groundUnder(r, r.hero.x, r.hero.z, r.hero.y);
      }
   }, FRAME_PRIORITY.camera);
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

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<WindLevel>();
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
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [multi]);
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
   const orbit = useMemo(() => createOrbit({ ...WIND_ORBIT, pitch: MP_CAMERA.pitch }), [multi]);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         let n = 0;
         for (const r of multi.runs) {
            if (r.ended !== null || r.hero.state !== "play") continue;
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
   const solids = useMemo(() => (out: AABB[]) => courseSolids(multi.runs[0], camera.position.x, camera.position.y, camera.position.z, out), [multi, camera]);
   return (
      <JuiceLayer>
         <World course={multi.runs[0].course} levelId={levelId} />
         <Course run={multi.runs[0]} clock={clock} />
         {multi.runs.map((r, i) => (
            <Hero key={i} run={r} anim={anims[i]} ground={grounds[i]} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={i} multi={multi} index={i} ground={grounds[i]} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} clock={clock} orbit={orbit} />
         <OrbitDriver orbit={orbit} travel={travel} />
         <GroundProbes multi={multi} grounds={grounds} />
         <SharedCamera points={points} active={active} anchor={anchor} pitch={MP_CAMERA.pitch} minSpan={MP_CAMERA.minSpan} maxSpan={MP_CAMERA.maxSpan} padding={MP_CAMERA.padding} fov={FOV} orbit={orbit} solids={solids} />
      </JuiceLayer>
   );
}
