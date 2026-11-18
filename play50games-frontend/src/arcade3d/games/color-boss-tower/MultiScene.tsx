"use client";

// Color Boss Tower with 2-4 local players (menu2/multiplayer): the same tower as solo, one climber per
// player (its active hero; each player tags their own roster with Down on their stick or keys, i.e.
// the next hero round), a ring in the player's colour under each, the runs stepped together by
// multiplayer.ts with each player's own device, and the shared camera framing every climber still
// going (the orbit turns it). Player 1's tower and guardian are drawn (co-op: the team's; versus: the
// same timings for all). Remounted for every run (runId).
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group, Mesh, PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { JuiceLayer, useJuice } from "@/arcade3d/menu2/juice";
import { playSfx } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { PLAYER_COLORS, playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "@/arcade3d/menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "@/arcade3d/menu2/multiplayer/SharedCamera";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitDriver } from "@/arcade3d/menu2/camera/OrbitCamera";
import { AnimatedHero, createHeroMotion, useHeroAnimator } from "@/arcade3d/menu2/heroAnim";
import { TAG_COLOUR, type TagHeroId } from "@/arcade3d/menu2/heroTag/rules";
import { Tower, ringPoint } from "./Tower";
import { Boss, bossFeetY, type BossView } from "./Boss";
import { createHeroAnim, createMotionMemo, floorUnder, writeHeroMotion, type HeroAnim } from "./Hero";
import { FOV, towerOrbit } from "./camera";
import { ORB_BONUS_MS, STAT, V_JUMP, V_RUN, createStepInput, type CbtRun, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, progressOf, stepMulti, type MultiRun } from "./multiplayer";
import { R_PATH, type TowerSpec } from "./levels";
import { TAG_HEX } from "./look";

/** The shared camera: tilt, and the zoom limit (m) before it holds on the leader. */
export const MP_CAMERA = { pitch: 0.42, minSpan: 7, maxSpan: 22, padding: 2.5 } as const;

function MultiSimulation({ multi, anims, orbit }: { multi: MultiRun; anims: HeroAnim[]; orbit: OrbitState }) {
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
         s.tag = p.pressed.down ? "next" : p.pressed.up ? "prev" : null;
      }
      const events = stepMulti(multi, dt * 1000, inputs);
      const now = time.now;
      const players = playersStore.getState();
      for (let i = 0; i < multi.runs.length; i++) {
         const run = multi.runs[i];
         const ev = events[i];
         const anim = anims[i];
         const h = run.hero;
         ringPoint(h.a / R_PATH, R_PATH, h.y + 1.1, chest);
         if (ev.airJumped) anim.airJumpAt = now;
         else if (ev.jumped) {
            anim.jumpAt = now;
            playSfx("jump", { volume: 0.35 });
         }
         if (ev.landed) anim.landAt = now;
         if (ev.knocked) {
            anim.hurtAt = now;
            anim.hurtDir = Math.sign(h.va) || 1;
         }
         if (ev.tagged) {
            juice.burst("aura", chest, 16, { color: TAG_HEX[TAG_COLOUR[run.tag.active]] });
            playSfx("whoosh", { volume: 0.35, pitch: 1.3 });
         }
         if (ev.charged >= 0) {
            juice.popup(chest, `P${i + 1} charged!`, { color: PLAYER_COLORS[i], size: 0.06 });
            playSfx("chime", { pitch: 1.3, volume: 0.6 });
         }
         if (ev.orb >= 0) {
            juice.popup(chest, `P${i + 1} -${(ORB_BONUS_MS / 1000).toFixed(1)} s`, { color: PLAYER_COLORS[i] });
            playSfx("pickup", { volume: 0.7 });
         }
         if (ev.hit && i === 0) {
            juice.shake(0.25);
            playSfx("thud", { pitch: 1.2 });
         }
         if (ev.ended && run.ended === "win") {
            anim.winAt = now;
            juice.burst("checkpoint", chest, 70, { color: PLAYER_COLORS[i] });
            juice.popup(chest, `P${i + 1} wins the tower!`, { color: PLAYER_COLORS[i] });
            playSfx("chime", { pitch: 1.2 });
         }
         const pt = ringPoint(h.a / R_PATH, R_PATH, h.y, { x: 0, y: 0, z: 0 });
         players.setPosition(i, pt.x, pt.y, pt.z);
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
   return null;
}

/** One player's climber: its active hero (remounted on a tag), placed on the ring. */
function PlayerHero({ run, anim, heroId }: { run: CbtRun; anim: HeroAnim; heroId: TagHeroId }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(heroId, motion, { topSpeed: V_RUN, jumpSpeed: V_JUMP, yaw: Math.PI / 2 });
   useFrame(() => writeHeroMotion(motion, memo, run, anim, time.now), FRAME_PRIORITY.camera + 0.1);
   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      const th = h.a / R_PATH;
      g.position.set(Math.sin(th) * R_PATH, h.y, Math.cos(th) * R_PATH);
   });
   return (
      <group ref={root}>
         <AnimatedHero animator={animator} />
      </group>
   );
}

function Climber({ run, anim }: { run: CbtRun; anim: HeroAnim }) {
   const [hero, setHero] = useState<TagHeroId>(run.tag.active);
   useFrame(() => {
      if (run.tag.active !== hero) setHero(run.tag.active);
   });
   return <PlayerHero key={hero} run={run} anim={anim} heroId={hero} />;
}

/** A ring in the player's colour under each climber, so everyone finds their own. */
function PlayerRing({ multi, index }: { multi: MultiRun; index: number }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const r = multi.runs[index];
      const th = r.hero.a / R_PATH;
      m.position.set(Math.sin(th) * R_PATH, floorUnder(r) + 0.09, Math.cos(th) * R_PATH);
      const pulse = 1 + Math.sin(time.now * 4 + index) * 0.06;
      m.scale.set(pulse, pulse, pulse);
   });
   return (
      <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={2}>
         <ringGeometry args={[0.6, 0.78, 32]} />
         <meshBasicMaterial color={PLAYER_COLORS[index]} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

export default function MultiScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<TowerSpec>();
   const levelId: LevelId = config?.id ?? 1;
   const mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const multi = useMemo(
      () => createMultiRun(randomSeed(), levelId, heroKey.split(",").filter(Boolean) as TagHeroId[], mode),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [runId, levelId, heroKey, mode],
   );
   const anims = useMemo(() => multi.runs.map(createHeroAnim), [multi]);
   // the camera's points: each climber's place on the ring (updated every frame)
   const points = useMemo(() => multi.runs.map(() => ({ x: 0, y: 0, z: 0 })), [multi]);
   useFrame(() => {
      multi.runs.forEach((r, i) => ringPoint(r.hero.a / R_PATH, R_PATH, r.hero.y, points[i]));
   }, FRAME_PRIORITY.camera - 0.01);
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
   const bossView = useMemo<BossView>(() => ({ feet: bossFeetY(view) }), [view]);
   const orbit = useMemo(() => createOrbit({ ...towerOrbit(view), pitch: MP_CAMERA.pitch, autoFollow: true }), [view]);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         // look out at the wall from the shaft: the "travel" is outward from the climbers' centre
         let x = 0;
         let z = 0;
         for (const p of points) {
            x += p.x;
            z += p.z;
         }
         const d = Math.hypot(x, z) || 1;
         out.x = (x / d) * 4;
         out.z = (z / d) * 4;
      },
      [points],
   );
   return (
      <JuiceLayer>
         <Tower key={levelId} run={view} />
         <Boss key={`b${levelId}`} run={view} view={bossView} />
         {multi.runs.map((r, i) => (
            <Climber key={i} run={r} anim={anims[i]} />
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
