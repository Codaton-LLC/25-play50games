"use client";

// Color City Sprint with 2-4 local players (menu2/multiplayer): the same city as solo, one hero per
// player (Hero.tsx), each player's red lanes in their own colour (versus) or one shared red network
// (co-op relay, with the lit beacon ringed in the colour of the player whose turn it is), the runs
// stepped together by multiplayer.ts with each player's own device, and the shared camera framing
// every hero still running (the orbit turns it). Remounted for every run (runId).
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, MeshBasicMaterial, PerspectiveCamera } from "three";
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
import { World } from "./World";
import { Course, Lanes, type VisualClock } from "./Course";
import { Boss } from "./Boss";
import { Hero, createHeroAnim, floorUnder, type HeroAnim } from "./Hero";
import { FOV, cityOrbit, courseSolids } from "./camera";
import { ORB_BONUS_MS, STAT, beaconPoint, litBeacon, createStepInput, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, progressOf, relayOwner, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { CitySpec } from "./levels";
import { LOOKS } from "./look";

/** The shared camera: tilt, and the zoom limit (m) before it holds on the leader. */
export const MP_CAMERA = { pitch: 0.62, minSpan: 10, maxSpan: 34, padding: 3 } as const;

function MultiSimulation({ multi, anims, clock, orbit }: { multi: MultiRun; anims: HeroAnim[]; clock: VisualClock; orbit: OrbitState }) {
   const juice = useJuice();
   const time = useGameTime();
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);

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
         const anim = anims[i];
         const h = run.hero;
         chest.x = h.x;
         chest.y = h.y + 1.1;
         chest.z = h.z;
         if (ev.airJumped) anim.airJumpAt = now;
         else if (ev.jumped) {
            anim.jumpAt = now;
            playSfx("jump", { volume: 0.35 });
         }
         if (ev.landed) anim.landAt = now;
         if (ev.bumped || ev.vented || ev.struck) {
            anim.hurtAt = now;
            anim.hurtX = h.vx;
            anim.hurtZ = h.vz;
         }
         if (ev.powered) {
            juice.burst("pickup", chest, 16, { color: heroAccent(run.heroId) });
            playSfx("whoosh", { volume: 0.4, pitch: 1.15 });
         }
         if (ev.beacon) {
            juice.burst("checkpoint", chest, 34, { color: PLAYER_COLORS[i] });
            juice.popup(chest, `P${i + 1} beacon`, { color: PLAYER_COLORS[i], size: 0.06 });
            playSfx("chime");
         }
         for (let k = 0; k < ev.orbCount; k++) {
            const o = run.course.orbs[ev.orbList[k]];
            juice.burst("pickup", o, 12, { color: "#fde68a" });
            juice.popup(o, `P${i + 1} -${(ORB_BONUS_MS / 1000).toFixed(1)} s`, { color: PLAYER_COLORS[i] });
            playSfx("pickup", { volume: 0.7 });
         }
         if (ev.bossHit) {
            juice.popup(chest, `P${i + 1} hit!`, { color: PLAYER_COLORS[i], size: 0.07 });
            juice.shake(0.2);
         }
         if (ev.finished) {
            anim.winAt = now;
            juice.burst("checkpoint", chest, 70, { color: PLAYER_COLORS[i] });
            juice.popup(chest, `P${i + 1} finished!`, { color: PLAYER_COLORS[i] });
            playSfx("chime", { pitch: 1.2 });
         }
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
      const s = useArcadeStore.getState();
      if (s.phase === "countdown") clock.ms = -s.countdownMs;
      else if (s.phase === "over") clock.ms = multi.simMs + s.overMs;
      else clock.ms = multi.simMs;
   }, FRAME_PRIORITY.camera);
   return null;
}

/** A ring in the player's colour under each hero, so everyone finds their own. */
function PlayerRing({ multi, index }: { multi: MultiRun; index: number }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const r = multi.runs[index];
      const h = r.hero;
      m.position.set(h.x, floorUnder(r) + 0.09, h.z);
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

/** Co-op relay: a ring at the lit beacon in the colour of the player whose turn it is. */
function RelayRing({ multi, clock }: { multi: MultiRun; clock: VisualClock }) {
   const ref = useRef<Mesh>(null);
   const p = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const owner = relayOwner(multi);
      m.visible = owner >= 0 && multi.ended === null;
      if (!m.visible) return;
      const r = multi.runs[0];
      beaconPoint(r, litBeacon(r), p);
      m.position.set(p.x, p.y + 0.12, p.z);
      (m.material as MeshBasicMaterial).color.set(PLAYER_COLORS[owner]);
      const s = 1 + 0.1 * Math.sin(clock.ms / 150);
      m.scale.set(s, s, s);
   });
   return (
      <mesh ref={ref} rotation-x={-Math.PI / 2}>
         <ringGeometry args={[1.9, 2.3, 40]} />
         <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<CitySpec>();
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
   const view = multi.runs[0];
   const orbit = useMemo(() => createOrbit({ ...cityOrbit(view.course), pitch: MP_CAMERA.pitch }), [multi, view]);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         let vx = 0;
         let vz = 0;
         let n = 0;
         for (const r of multi.runs) {
            if (r.ended !== null) continue;
            vx += r.hero.vx;
            vz += r.hero.vz;
            n++;
         }
         out.x = n > 0 ? vx / n : 0;
         out.z = n > 0 ? vz / n : 0;
      },
      [multi],
   );
   const solids = useMemo(() => (out: AABB[]) => courseSolids(view, camera.position.x, camera.position.z, out), [view, camera]);
   const glow = LOOKS[levelId].laneGlow;
   const team = multi.mode.ranking === "team";
   return (
      <JuiceLayer>
         <World course={view.course} />
         <Course key={levelId} run={view} clock={clock} lanes={false} />
         {team ? (
            <Lanes run={view} glow={glow} />
         ) : (
            multi.runs.map((r, i) => <Lanes key={i} run={r} glow={glow} color={PLAYER_COLORS[i]} offset={(i - (multi.runs.length - 1) / 2) * 0.9} width={0.45} />)
         )}
         {view.course.boss ? <Boss run={view} clock={clock} /> : null}
         {multi.runs.map((r, i) => (
            <Hero key={i} run={r} anim={anims[i]} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={i} multi={multi} index={i} />
         ))}
         <RelayRing multi={multi} clock={clock} />
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} clock={clock} orbit={orbit} />
         <OrbitDriver orbit={orbit} travel={travel} />
         <SharedCamera
            points={points}
            active={active}
            anchor={anchor}
            pitch={MP_CAMERA.pitch}
            minSpan={MP_CAMERA.minSpan}
            maxSpan={MP_CAMERA.maxSpan}
            padding={MP_CAMERA.padding}
            fov={FOV}
            orbit={orbit}
            solids={solids}
         />
      </JuiceLayer>
   );
}
