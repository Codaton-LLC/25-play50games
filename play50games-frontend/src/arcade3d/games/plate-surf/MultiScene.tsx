"use client";

// Plate Surf with 2-4 local players (menu2/multiplayer, after the cloud-hopper adoption): the same wave,
// bay and props as solo (the orbs and the reef walls are shared), one hero on its plate per player
// (Hero.tsx like solo), the solo juice, the runs stepped together by multiplayer.ts with each player's
// own device (PlayerInputLatch + playerInputFor), and the shared camera behind and above the pack
// (the card): it frames every rider still riding (30 m zoom limit, held on the leader in versus).
// The wave draws the trailing rider's curl (each rider has its own). Remounted for every run (runId).
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, createJuiceEmitter, useJuice } from "@/arcade3d/menu2/juice";
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
import { Wave, type VisualClock } from "./Wave";
import { Course } from "./Course";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, SURF_ORBIT, courseSolids, orbitTravel } from "./camera";
import { ORB, STAT, createStepInput, groundY, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, stepMulti, type MultiRun } from "./multiplayer";
import type { HeroId } from "./heroes";
import type { SurfLevel } from "./levels";

/** The shared camera: tilt, and the zoom limit (m) before it holds on the leader. */
export const MP_CAMERA = { pitch: 0.42, minSpan: 9, maxSpan: 30, padding: 2.5 } as const;

function MultiSimulation({ multi, anims, clock, won, orbit }: { multi: MultiRun; anims: HeroAnim[]; clock: VisualClock; won: { current: boolean }; orbit: OrbitState }) {
   const juice = useJuice();
   const time = useGameTime();
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   const sprays = useMemo(() => multi.runs.map(createJuiceEmitter), [multi]);
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
      }
      const events = stepMulti(multi, dt * 1000, inputs);
      const now = time.now;
      const players = playersStore.getState();
      let trail = -Infinity;
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         const ev = events[i];
         const anim = anims[i];
         const h = run.hero;
         if (run.ended === null && run.curlZ > trail) trail = run.curlZ;
         chest.x = feet.x = h.x;
         chest.z = feet.z = h.z;
         chest.y = h.y + 1.1;
         feet.y = h.y + 0.25;
         if (h.grounded && h.state === "play" && Math.abs(h.vx) > 2.5) juice.stream("dust", feet, 8 + Math.abs(h.vx) * 3, sprays[i], { color: "#ffffff", vy: 2.4 });
         if (ev.pumped) {
            anim.pumpAt = now;
            playSfx("thud", { pitch: 0.6, volume: 0.35 });
         }
         if (ev.airJumped) anim.airJumpAt = now;
         else if (ev.jumped) {
            anim.jumpAt = now;
            playSfx("whoosh", { volume: 0.35 });
         }
         if (ev.landed) anim.landAt = now;
         if (ev.trick) {
            juice.popup(chest, `P${i + 1} ↻`, { color: PLAYER_COLORS[i], size: 0.06 });
            playSfx("chime", { pitch: 1.2, volume: 0.4 });
         }
         if (ev.bailed) anim.bailAt = now;
         if (ev.stung) anim.stungAt = now;
         if (ev.powered) {
            juice.burst("pickup", chest, 16, { color: heroAccent(run.heroId) });
            playSfx("whoosh", { volume: 0.4, pitch: 1.15 });
         }
         for (let k = 0; k < ev.orbCount; k++) {
            const o = run.course.orbs[ev.orbList[k]];
            juice.burst("pickup", o, 12, { color: "#a5f3fc" });
            juice.popup(o, `P${i + 1} -${(ORB.bonusMs / 1000).toFixed(2)} s`, { color: PLAYER_COLORS[i] });
            playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.03), volume: 0.7 });
         }
         if (ev.checkpoint > 0) {
            juice.burst("checkpoint", chest, 36);
            juice.popup(chest, multi.mode.sharedCheckpoints ? "Team checkpoint!" : `P${i + 1} checkpoint`, { color: "#ffd257" });
            playSfx("chime");
         }
         if (ev.lost) {
            anim.lostAt = now;
            juice.burst("dust", chest, 26, { color: "#ffffff" });
            juice.shake(0.2);
            playSfx("lose", { volume: 0.35 });
         }
         if (ev.respawned) anim.spawnAt = now;
         if (ev.finished) {
            won.current = true;
            anim.winAt = now;
            juice.burst("checkpoint", chest, 80);
            juice.popup(chest, `P${i + 1} in the lagoon!`, { color: PLAYER_COLORS[i] });
            playSfx("chime", { pitch: 1.2 });
         }
         players.setPosition(i, h.x, h.y, h.z);
         const dist = Math.round(Math.max(0, run.bestDist));
         const p = players.players[i];
         if (p && (p.score !== run.orbs || p.progress !== dist || p.finished !== (run.ended === "win"))) {
            players.update(i, { score: run.orbs, progress: dist, finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs : null });
         }
      }
      if (Number.isFinite(trail)) multi.view.curlZ = trail;
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

/** A ring in the player's colour on the water under each rider, so everyone finds their own. */
function PlayerRing({ multi, index }: { multi: MultiRun; index: number }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const r = multi.runs[index];
      const h = r.hero;
      m.visible = h.state !== "lost";
      m.position.set(h.x, groundY(r.course, h.x) + 0.08, h.z);
      const pulse = 1 + Math.sin(time.now * 4 + index) * 0.06;
      m.scale.set(pulse, pulse, pulse);
   });
   return (
      <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={2}>
         <ringGeometry args={[0.9, 1.1, 32]} />
         <meshBasicMaterial color={PLAYER_COLORS[index]} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<SurfLevel>();
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
   const won = useRef(false);
   const points = useMemo(() => multi.runs.map((r) => r.hero), [multi]);
   const active = useMemo(() => {
      const out: boolean[] = [];
      return () => {
         for (let i = 0; i < multi.runs.length; i++) {
            const r = multi.runs[i];
            out[i] = r.ended === null && r.hero.state !== "lost";
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
   const orbit = useMemo(() => createOrbit({ ...SURF_ORBIT, pitch: MP_CAMERA.pitch }), [multi]);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         let v = 0;
         let n = 0;
         for (const r of multi.runs) {
            if (r.ended !== null || r.hero.state !== "play") continue;
            v += r.hero.v;
            n++;
         }
         if (n > 0) orbitTravel(v / n, out);
      },
      [multi],
   );
   const centre = useMemo(() => ({ z: 0 }), []);
   useFrame(() => {
      let z = 0;
      let n = 0;
      for (const r of multi.runs) {
         if (r.ended !== null) continue;
         z += r.hero.z;
         n++;
      }
      centre.z = n > 0 ? z / n : multi.runs[0].hero.z;
   }, FRAME_PRIORITY.camera);
   const solids = useMemo(() => (out: AABB[]) => courseSolids(multi.view, camera.position.x, camera.position.y, camera.position.z, out), [multi, camera]);
   return (
      <JuiceLayer>
         <Wave run={multi.view} clock={clock} view={centre} />
         <World course={multi.view.course} seed={20261028} view={centre} />
         <Course run={multi.view} clock={clock} won={won} />
         {multi.runs.map((r, i) => (
            <Hero key={i} run={r} anim={anims[i]} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={i} multi={multi} index={i} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} clock={clock} won={won} orbit={orbit} />
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
