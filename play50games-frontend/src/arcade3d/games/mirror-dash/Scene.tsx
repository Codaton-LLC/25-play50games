"use client";

// Mirror Dash's scene: one World (rules.ts) stepped at 120 Hz by useRunFrame for 1 pair (solo) or 2-4
// (local multiplayer: each player's pair runs its own copy of the course, side by side 14 m apart),
// drawn by Track / Bodies / Sentinel in the hall (World). The orbit camera sits high behind the pair,
// between the runways, and swings back behind it after a manual turn; juice and sound on every lane
// change (the wall ripples), crack, Twin Perfect, orb, checkpoint and Sentinel hit.
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useRunFrame } from "../../core/useRunFrame";
import { useInput } from "../../core/input";
import { useLevel } from "../../core/level";
import { GameIntro, useShellIntro } from "../../core/intro";
import { playSfx, startLoop } from "../../core/audio";
import { JuiceLayer, useJuice } from "../../menu2/juice";
import { createOrbit } from "../../menu2/camera/orbit";
import { OrbitCamera, OrbitDriver } from "../../menu2/camera/OrbitCamera";
import { SharedCamera } from "../../menu2/multiplayer/SharedCamera";
import { PlayerInputLatch, playerInputFor } from "../../menu2/multiplayer/MultiplayerInput";
import { playersStore, usePlayers } from "../../menu2/multiplayer/players";
import { useAuth } from "@/contexts/AuthContext";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { M2HeroId } from "../../menu2/heroModels";
import type { IntroKeyframe } from "../../core/intro/introMachine";
import type { LevelId } from "../../types";
import { STAT, ZONE_CODE, bodyX, createWorld, idleInput, stepWorld, submittedMs, type StepInput, type World as RunWorld } from "./rules";
import { botInput } from "./bot";
import { coachFor } from "./coach";
import { pickedHero, subscribeHero } from "./heroes";
import type { MirrorLevel } from "./levels";
import { levelEndStats } from "./levelEnd";
import { Track } from "./Track";
import { Bodies } from "./Bodies";
import { Sentinel } from "./Sentinel";
import { World } from "./World";

const DEG = Math.PI / 180;
export const PAIR_GAP = 14;
const FLICK = 0.6;

/** Preview builds only: `?autoplay=1` lets the honest bot (bot.ts, the proofs' bot) play, for screenshots. */
function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

/** Swipes cut lanes: one finger never turns the camera (two fingers do; the right mouse button drags it). */
export const MIRROR_GESTURES = { oneFinger: false, mouseButtons: [2] } as const;

interface Flick {
   armed: boolean;
}

/** The core input -> StepInput: left / right presses, swipes and a stick flick cut lanes; up jumps; down slides. */
export function mapInput(
   i: { moveX: number; moveY: number; jumpPressed: boolean; actionPressed: boolean; pressed: { left: boolean; right: boolean; up?: boolean; down?: boolean } },
   flick: Flick,
   out: StepInput
): StepInput {
   let left = i.pressed.left;
   let right = i.pressed.right;
   if (Math.abs(i.moveX) < 0.3) flick.armed = true;
   else if (flick.armed && Math.abs(i.moveX) >= FLICK && !left && !right) {
      flick.armed = false;
      if (i.moveX < 0) left = true;
      else right = true;
   }
   if (left || right) flick.armed = false;
   out.left = left;
   out.right = right;
   out.jump = i.jumpPressed || !!i.pressed.up;
   out.slide = !!i.pressed.down;
   out.action = i.actionPressed;
   return out;
}

function publish(w: RunWorld) {
   const p = w.pairs[0];
   const g = p.boss;
   const s = useArcadeStore.getState();
   const end = g ? Math.max(w.course.endS + 30, Number.isFinite(p.finishS) ? p.finishS : 0) : w.course.endS;
   const stats: Record<string, number> = {
      [STAT.orbs]: p.orbs,
      [STAT.comboMs]: Math.round(p.comboMs),
      [STAT.comboChain]: p.combo.chain,
      [STAT.comboMult]: Math.round(p.combo.multiplier * 100),
      [STAT.comboFlow]: Math.round(Math.max(0, 1 - (w.ms - p.combo.lastMs) / 2500) * 10),
      [STAT.cracks]: p.cracks,
      [STAT.zone]: ZONE_CODE[p.zone],
      [STAT.progress]: Math.round(Math.min(1, p.s / end) * 100),
      [STAT.power]: Math.ceil(p.cooldown / 1000),
      [STAT.hits]: p.hits,
      [STAT.coach]: coachFor(w, p),
      [STAT.boss]: g && g.active ? 1 : 0,
      [STAT.bossHp]: g ? g.state.hp : 0,
      [STAT.bossPhase]: g ? g.state.phase : 0,
      [STAT.bossOpen]: g && g.state.step === "vulnerable" ? 1 : 0,
      [STAT.bossFlash]: g && g.state.flashMs > 0 ? 1 : 0,
      [STAT.bossShield]: g ? g.shield : 0,
   };
   for (const [key, v] of Object.entries(stats)) if (s.stats[key] !== v) s.setStat(key, v);
}

function RunScene({ multi }: { multi: boolean }) {
   const { config } = useLevel<MirrorLevel>();
   const id = (config?.id ?? 1) as LevelId;
   const picked = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const phase = useArcadeStore((s) => s.phase);
   const { user } = useAuth();
   const heroId = phase === "ready" ? picked : undefined;
   const slots = useMemo(() => (multi ? playersStore.getState().players.map((p) => p.index) : []), [multi]);
   const world = useMemo(
      () => (multi ? createWorld(id, playersStore.getState().players.map((p) => p.heroId as M2HeroId)) : createWorld(id, [heroId ?? pickedHero()])),
      [id, multi, heroId]
   );
   const input = useInput();
   const autoplay = useMemo(autoplayRequested, []);
   const orbit = useMemo(() => createOrbit({ yaw: 0, pitch: 26 * DEG, distance: 11, minDistance: 5, maxDistance: 24, autoFollow: true, autoFollowDelay: 1.2, autoFollowRate: 2.5, autoFollowMinSpeed: 3, autoFollowFullSpeed: 8 }), [id, multi]); // eslint-disable-line react-hooks/exhaustive-deps
   const size = useThree((s) => s.size);
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? 72 : 58;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   const intro = useShellIntro();
   const juice = useJuice();
   const audio = useMemo(() => ({ hum: null as ReturnType<typeof startLoop> | null, beat: -1, ended: false }), []);
   const flicks = useMemo(() => world.pairs.map(() => ({ armed: true })), [world]);
   useEffect(() => {
      if (phase === "playing") audio.hum = startLoop("hum", { volume: 0 });
      return () => {
         audio.hum?.stop();
         audio.hum = null;
      };
   }, [phase, audio]);
   useEffect(() => {
      if (multi) playersStore.getState().beginRun();
   }, [multi, world]);
   const inputs = useMemo<StepInput[]>(() => world.pairs.map(() => idleInput()), [world]);
   useRunFrame((_, dt) => {
      if (multi) {
         world.pairs.forEach((_p, k) => mapInput(playerInputFor(slots[k]), flicks[k], inputs[k]));
      } else if (autoplay) {
         Object.assign(inputs[0], botInput(world, 0));
      } else mapInput(input.current, flicks[0], inputs[0]);
      stepWorld(world, dt * 1000, inputs);
      const s = useArcadeStore.getState();
      const p0 = world.pairs[0];
      if (multi) {
         world.pairs.forEach((p, k) => {
            const pl = playersStore.getState().players.find((x) => x.index === slots[k]);
            if (!pl) return;
            const ps = playersStore.getState();
            ps.setPosition(pl.index, k * PAIR_GAP, 0, -p.s);
            ps.update(pl.index, { score: p.hits, progress: Math.round(p.s), finished: p.ended === "win", finishMs: p.ended === "win" ? p.finishMs : null });
         });
         const finished = world.pairs.filter((p) => p.ended === "win");
         const mode = playersStore.getState().mode;
         const done = mode === "coop" ? world.pairs.every((p) => p.ended) : finished.length > 0 && (finished.length === world.pairs.length || world.ms - Math.min(...finished.map((p) => p.finishMs)) > 20_000);
         if ((done || world.ended) && !audio.ended) {
            audio.ended = true;
            s.end(finished.length ? "win" : "timeup");
         }
      } else {
         publish(world);
         if (p0.ended && !audio.ended) {
            audio.ended = true;
            if (p0.ended === "win") {
               s.setStat(STAT.finishMs, p0.finishMs);
               for (const [k, v] of Object.entries(levelEndStats(world, p0, user?.id ?? null))) s.setStat(k, v);
               s.setScore(Math.max(0, Math.floor((world.cfg.durationMs - submittedMs(p0)) / 10)));
            }
            s.end(p0.ended);
         }
      }
      fx(world, juice);
      audio.hum?.set({ pitch: 0.7 + p0.speed / 30, volume: 0.05 + (p0.dashMs > 0 ? 0.05 : 0) });
      const beat = Math.floor(world.ms / (60_000 / 132));
      if (beat !== audio.beat) {
         audio.beat = beat;
         const bar = beat % 8;
         playSfx("click", { pitch: [1.0, 1.5, 1.19, 1.5, 0.89, 1.33, 1.12, 1.68][bar], volume: p0.boss?.active ? 0.08 : 0.045 });
      }
   });
   const span = (world.pairs.length - 1) * PAIR_GAP;
   const playCamera = useMemo<IntroKeyframe>(() => ({ position: [0, 1.8 + 11 * Math.sin(26 * DEG), 11 * Math.cos(26 * DEG) - 5], lookAt: [0, 1.8, -5] }), []);
   const shots = useMemo<IntroKeyframe[]>(() => {
      const f = world.course.endS;
      return [
         { position: [12, 16, -f * 0.6], lookAt: [0, 0, -f * 0.6 - 30] },
         { position: [-8, 6, -f * 0.25], lookAt: [0, 1, -f * 0.25 - 20] },
         { position: [6, 4, 8], lookAt: [0, 1, -10] },
      ];
   }, [world]);
   const lead = world.pairs[0];
   return (
      <>
         {multi && <PlayerInputLatch />}
         <World world={world} lead={lead} span={span} />
         {world.pairs.map((p, k) => (
            <group key={k}>
               <Track world={world} pair={p} ox={k * PAIR_GAP} />
               <Bodies pair={p} ox={k * PAIR_GAP} intro={intro?.session && !intro.ready && !multi ? intro.hero : undefined} />
               <Sentinel pair={p} ox={k * PAIR_GAP} />
            </group>
         ))}
         {multi ? (
            <>
               <OrbitDriver orbit={orbit} input={MIRROR_GESTURES} />
               <SharedCamera points={world.pairs.flatMap((p, k) => [0, 1].map((b) => ({ x: k * PAIR_GAP + bodyX(p, b as 0 | 1), y: 1, z: -p.s })))} orbit={orbit} minSpan={10} maxSpan={70} padding={3} />
            </>
         ) : (
            <OrbitCamera
               orbit={orbit}
               input={MIRROR_GESTURES}
               pivot={(out) => {
                  Object.assign(out, { x: (bodyX(lead, 0) + bodyX(lead, 1)) * 0.2, y: 1.8 + Math.min(lead.bodies[0].y, 1.5) * 0.3, z: -lead.s - (aspect < 1 ? 5 : 3) });
                  return true;
               }}
               travel={(out) => {
                  if (lead.ended) return;
                  out.x = 0;
                  out.z = -lead.speed;
               }}
               lookUp={aspect < 1 ? 0.6 : 0.3}
               distanceScale={aspect < 1 ? 1.6 : 1}
               pivotDamping={10}
            />
         )}
         {intro?.session && !multi && <GameIntro session={intro.session} keyframes={shots} playCamera={playCamera} hero={intro.hero} />}
      </>
   );
}

/** Juice and sound from the step's events. */
function fx(w: RunWorld, juice: ReturnType<typeof useJuice>) {
   w.pairs.forEach((p, k) => {
      const ox = k * PAIR_GAP;
      const lead = k === 0;
      const e = p.ev;
      const at = (b: 0 | 1, dy = 0.8) => ({ x: ox + bodyX(p, b), y: p.bodies[b].y + dy, z: -p.s });
      if (e.laneChange) {
         juice.burst("aura", { x: ox, y: 1.2, z: -p.s - 2 }, 8, { color: "#c4b5fd" });
         if (lead) playSfx("whoosh", { pitch: 1.5, volume: 0.25 });
      }
      if (e.jump && lead) playSfx("jump", { volume: 0.5 });
      if (e.slide && lead) playSfx("whoosh", { pitch: 0.8, volume: 0.35 });
      if (e.crack) {
         const b = e.crackBody as 0 | 1;
         juice.burst("hit", at(b), 24, { color: "#e9d5ff" });
         juice.shake(0.3);
         juice.hitStop(70);
         if (lead) playSfx("splash", { pitch: 2, volume: 0.6 });
         if (e.bump) juice.popup(at(1, 1.8), "Bump!", { color: "#fca5a5", size: 0.06 });
      }
      if (e.shatter) {
         juice.burst("hit", at(0), 40, { color: "#ddd6fe" });
         juice.burst("hit", at(1), 40, { color: "#ddd6fe" });
         juice.shake(0.55);
         if (lead) playSfx("boom", { pitch: 1.4 });
      }
      if (e.orb) {
         const b = e.orbBody as 0 | 1;
         juice.burst("pickup", at(b, 1), 16, { color: "#f0abfc" });
         juice.popup(at(b, 1.8), "-0.4 s", { color: "#f5d0fe", size: 0.05 });
         if (lead) playSfx("chime", { pitch: 1 + Math.min(p.combo.chain, 6) / 10 });
      }
      if (e.twin) {
         juice.popup({ x: ox, y: 2.6, z: -p.s - 3 }, "Twin Perfect!", { color: "#ddd6fe", size: 0.07 });
         if (lead) playSfx("combo", { pitch: 1.2, volume: 0.5 });
      }
      if (e.checkpoint) {
         juice.burst("checkpoint", { x: ox, y: 1.5, z: -p.s - 1 }, 28, { color: "#c4b5fd" });
         if (lead) playSfx("chime", { pitch: 1.3 });
      }
      if (e.secret) {
         juice.burst("checkpoint", at(0), 32);
         juice.popup(at(0, 2), "Secret found!", { color: "#fbbf24", size: 0.07 });
         if (lead) playSfx("chime", { pitch: 1.6 });
      }
      if (e.broke) {
         juice.burst("hit", at(0), 20, { color: "#fdba74" });
         if (lead) playSfx("thud", { pitch: 0.8 });
      }
      if (e.power) {
         juice.burst("aura", at(0), 20, { color: p.heroId === "vexa" ? "#c4b5fd" : p.heroId === "kiro" ? "#86efac" : p.heroId === "zuno" ? "#fde047" : "#fca5a5" });
         juice.burst("aura", at(1), 20, { color: "#c4b5fd" });
         if (lead) playSfx("zap", { pitch: 1.3, volume: 0.45 });
      }
      if (e.zone && lead && p.zone !== "mirror") playSfx("chime", { pitch: p.zone === "frost" ? 0.8 : p.zone === "echo" ? 1.1 : 0.95, volume: 0.35 });
      if (e.bossHit) {
         juice.popup({ x: ox, y: 3, z: -p.s - 4 }, "Gem hit!", { color: "#f0abfc", size: 0.08 });
         juice.hitStop(130);
         juice.shake(0.5);
         if (lead) playSfx("boom", { pitch: 1.1 });
      }
      const g = p.boss;
      if (g && lead) {
         if (g.ev.telegraph) playSfx("alarm", { pitch: 0.8, volume: 0.35 });
         if (g.ev.attack) juice.shake(0.25);
         if (g.ev.defeated) {
            juice.shake(0.7);
            playSfx("splash", { pitch: 1.6 });
            playSfx("win");
         }
      }
      if (e.won) {
         juice.burst("checkpoint", at(0), 50);
         if (lead) playSfx("win");
      }
   });
}

export default function Scene() {
   const runId = useArcadeStore((s) => s.runId);
   const level = useArcadeStore((s) => s.levelId);
   const multi = usePlayers((s) => s.phase === "playing");
   return (
      <JuiceLayer>
         <RunScene key={`${runId}-${level}-${multi}`} multi={multi} />
      </JuiceLayer>
   );
}
