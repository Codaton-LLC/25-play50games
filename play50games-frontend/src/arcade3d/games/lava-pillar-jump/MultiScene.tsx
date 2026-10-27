"use client";

// Lava Pillar Jump with 2-4 local players (menu2/multiplayer, reference adoption): the same world and
// course as solo, one animated Hero per player (each its own GLB, menu2/heroAnim like solo), the
// solo juice (menu2/juice JuiceLayer), the runs stepped together by
// multiplayer.ts with each player's own device (PlayerInputLatch + playerInputFor), and the shared
// camera framing every hero still climbing. The players store gets each player's orbs, height and
// finish for the HUD chips and the podium. Remounted for every run (runId), like the solo scene.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { inputToWorld } from "@/arcade3d/core/input";
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
import World from "./World";
import { Course, type VisualClock } from "./Course";
import { Hero, createHeroAnim, groundUnder, type HeroAnim } from "./Hero";
import { FOV } from "./camera";
import { ORB, STAT, createStepInput, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, stepMulti, type MultiRun } from "./multiplayer";
import { heartbeatJuice, publishBoss } from "./sceneJuice";
import type { HeroId } from "./heroes";
import type { LavaLevel } from "./levels";

/** The yaw the players' sticks are mapped with (the shared camera looks along -z). */
const CAMERA_YAW = 0;

/** The shared camera: tilt (the solo follow camera's), and the zoom limit (m) before it holds on the leader. */
export const MP_CAMERA = { pitch: 0.5, minSpan: 8, maxSpan: 28, padding: 2 } as const;

function MultiSimulation({ multi, anims, clock, won }: { multi: MultiRun; anims: HeroAnim[]; clock: VisualClock; won: { current: boolean } }) {
   const juice = useJuice();
   const time = useGameTime();
   const inputs = useMemo<StepInput[]>(() => multi.runs.map(() => createStepInput()), [multi]);
   const world = useMemo(() => ({ x: 0, z: 0 }), []);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);

   // a new run (Play again, Restart from pause) resets every player's run fields
   useEffect(() => {
      playersStore.getState().beginRun();
   }, [multi]);

   useRunFrame((_state, dt) => {
      for (let i = 0; i < multi.runs.length; i++) {
         const p = playerInputFor(i);
         const s = inputs[i];
         // camera-relative: the shared camera's yaw (fixed at 0 today)
         inputToWorld(p.moveX, p.moveY, CAMERA_YAW, world);
         s.moveX = world.x;
         s.moveZ = world.z;
         s.jumpPressed = p.jumpPressed;
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
         chest.x = feet.x = h.x;
         chest.z = feet.z = h.z;
         chest.y = h.y + 0.7;
         feet.y = h.y + 0.1;
         // the heartbeat is the same for every run: its drum and camera pulse once (player 1's events);
         // each hero's own vents, crumbles and boss hits for everyone
         if (i > 0) {
            ev.telegraph = false;
            ev.beat = false;
         }
         heartbeatJuice(juice, run, ev, chest, feet, true);
         if (ev.vented) anim.bounceAt = now;
         if (ev.jumped) {
            anim.jumpAt = now;
            playSfx("jump", { volume: 0.35 });
         }
         if (ev.powered) {
            juice.burst("pickup", chest, 16, { color: heroAccent(run.heroId) });
            juice.burst("aura", chest, 10, { color: heroAccent(run.heroId) });
            playSfx("whoosh", { volume: 0.4, pitch: 1.15 });
         }
         if (ev.landed) {
            anim.landAt = now;
            juice.burst("dust", feet, 7);
         }
         if (ev.bounced) {
            anim.bounceAt = now;
            juice.burst("hit", feet, 14, { color: "#7dd3fc" });
            juice.burst("pickup", chest, 8);
            juice.shake(0.1);
            playSfx("whoosh", { pitch: 1.3, volume: 0.6 });
         }
         for (let k = 0; k < ev.orbCount; k++) {
            const o = run.course.orbs[ev.orbList[k]];
            juice.burst("pickup", o, 12);
            juice.popup(o, `P${i + 1} -${(ORB.bonusMs / 1000).toFixed(1)} s`, { color: PLAYER_COLORS[i] });
            playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.03), volume: 0.7 });
         }
         if (ev.checkpoint > 0) {
            juice.burst("checkpoint", chest, 36);
            juice.popup(chest, multi.mode.sharedCheckpoints ? "Team checkpoint!" : `P${i + 1} checkpoint`, { color: "#ffd257" });
            playSfx("chime");
         }
         if (ev.lost) {
            anim.lostAt = now;
            juice.burst("hit", chest, 12);
            juice.burst("dust", feet, 8);
            juice.shake(0.18);
            playSfx("lose", { volume: 0.35 });
         }
         if (ev.respawned) {
            anim.spawnAt = now;
            juice.burst("pickup", chest, 18, { color: heroAccent(run.heroId) });
            playSfx("pop");
         }
         if (ev.finished) {
            won.current = true;
            anim.winAt = now;
            juice.burst("checkpoint", chest, 80);
            juice.burst("pickup", chest, 30);
            juice.popup(chest, `P${i + 1} on top!`, { color: PLAYER_COLORS[i] });
            juice.shake(0.15);
            playSfx("chime", { pitch: 1.2 });
         }
         players.setPosition(i, h.x, h.y, h.z);
         const height = Math.round(Math.max(0, run.bestTop));
         const p = players.players[i];
         if (p && (p.score !== run.orbs || p.progress !== height || p.finished !== (run.ended === "win"))) {
            players.update(i, { score: run.orbs, progress: height, finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs : null });
         }
      }
      // Kalder's bar follows player 1's fight (each hero fights its own golem)
      publishBoss(multi.runs[0]);
      if (multi.ended !== null) {
         const store = useArcadeStore.getState();
         // the clock chip and finalScore read these; a multiplayer run is never submitted (runPlayers)
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

function GroundProbes({ multi, clock, grounds }: { multi: MultiRun; clock: VisualClock; grounds: { current: number }[] }) {
   useFrame(() => {
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         const h = run.hero;
         grounds[i].current = groundUnder(run, h.x, h.z, h.y, clock.ms);
      }
   }, FRAME_PRIORITY.camera);
   return null;
}

/** A ring in the player's colour on the floor under each hero, so everyone finds their own. */
function PlayerRing({ multi, index, ground }: { multi: MultiRun; index: number; ground: { current: number } }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const h = multi.runs[index].hero;
      const g = ground.current;
      m.visible = h.state !== "lost" && Number.isFinite(g);
      m.position.set(h.x, (Number.isFinite(g) ? g : h.y) + 0.04, h.z);
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
   const { config } = useLevel<LavaLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const multi = useMemo(
      () => createMultiRun(randomSeed(), levelId, heroKey.split(",").filter(Boolean) as HeroId[], mode),
      // runId: a fresh race for every run
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runId, levelId, heroKey, mode],
   );
   const anims = useMemo(() => multi.runs.map(createHeroAnim), [multi]);
   const grounds = useMemo(() => multi.runs.map(() => ({ current: 0 })), [multi]);
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [multi]);
   const won = useRef(false);
   const points = useMemo(() => multi.runs.map((r) => r.hero), [multi]);
   const active = useMemo(() => {
      const out: boolean[] = [];
      return () => {
         for (let i = 0; i < multi.runs.length; i++) {
            const r = multi.runs[i];
            // a finisher parks at the gate and a falling hero drops away: neither drags the frame
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
   const decorSeed = 20261025;
   return (
      <JuiceLayer>
         <World course={multi.view.course} seed={decorSeed} levelId={levelId} />
         <Course run={multi.view} clock={clock} won={won} />
         {multi.runs.map((r, i) => (
            <Hero key={i} run={r} anim={anims[i]} ground={grounds[i]} />
         ))}
         {multi.runs.map((_r, i) => (
            <PlayerRing key={i} multi={multi} index={i} ground={grounds[i]} />
         ))}
         <PlayerInputLatch />
         <MultiSimulation multi={multi} anims={anims} clock={clock} won={won} />
         <GroundProbes multi={multi} clock={clock} grounds={grounds} />
         <SharedCamera
            points={points}
            active={active}
            anchor={anchor}
            pitch={MP_CAMERA.pitch}
            minSpan={MP_CAMERA.minSpan}
            maxSpan={MP_CAMERA.maxSpan}
            padding={MP_CAMERA.padding}
            fov={FOV}
         />
      </JuiceLayer>
   );
}
