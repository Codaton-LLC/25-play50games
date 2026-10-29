"use client";

// Tightrope Path's scene: the run (rules.ts) stepped in useRunFrame, the gorge (World), the walk
// (Path), Umbra on level 5 (Boss), the hero with his balance pole (Hero), the free orbit camera
// (menu2/camera: the stick is camera-relative through StepInput.yaw = orbit.viewYaw; left alone it
// swings back behind the walk) tilting slowly with the needle, the intro (core/intro), and the juice
// (menu2/juice): a rope creak that grows with the lean, a gasp and a puff on a wobble recovered, the
// fall into the mist, leaves sprouting behind every clean element, orb and coin pops, the sandbag thump,
// Umbra's stomps, hits and his slow-mo glide off. Remounted for every run (runId). Local multiplayer
// renders MultiScene.tsx instead.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useInput } from "@/arcade3d/core/input";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, useJuice } from "@/arcade3d/menu2/juice";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import { comboFlow } from "@/arcade3d/menu2/combo/combo";
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import World from "./World";
import { Path } from "./PathView";
import { Umbra } from "./Boss";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, heroPivot, introKeyframes, orbitLookUp, orbitScale, playCamera, tightOrbit, tiltFor } from "./camera";
import { STAT, bonusMs, createRun, createStepInput, heroPoint, hintFor, step, umbraPoint, type StepEvents, type TightRun } from "./rules";
import { linkPoint } from "./course";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { TightLevel } from "./levels";
import { COMBO, SECRETS, UMBRA } from "./progression";
import { levelEndStats } from "./levelEnd";
import MultiScene from "./MultiScene";

/** Preview builds only: `?autoplay=1` lets the honest bot (bot.ts) play, for screenshots and checks. */
function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

export function publishStats(run: TightRun): void {
   const store = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   const h = run.hero;
   set(STAT.lean, Math.round(h.lean * 100));
   set(STAT.wobble, h.wobbleMs > 0 ? 1 : 0);
   set(STAT.sprint, h.sprint && Math.abs(h.v) > 2 ? 1 : 0);
   set(STAT.crouch, h.crouch ? 1 : 0);
   set(STAT.orbs, run.orbs);
   set(STAT.highs, run.highs);
   set(STAT.coins, run.coins);
   set(STAT.crossed, run.crossed);
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10));
   set(STAT.bonusMs, bonusMs(run));
   set(STAT.hero, ["riko", "nami", "kiro", "zuno", "vexa"].indexOf(run.heroId));
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
   set(STAT.steadyMs, Math.floor(run.steadyMs / 100));
   set(STAT.hint, hintFor(run));
   const b = run.boss;
   if (b && run.bossAwake) {
      set(STAT.bossHp, b.hp);
      set(STAT.bossPhase, b.phase);
      set(STAT.bossOpen, b.step === "vulnerable" ? 1 : 0);
      set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
   }
}

const AT = { x: 0, y: 0, z: 0 };
const UP = { x: 0, y: 0, z: 0 };

/** The juice and sounds of one step's events (solo and, quieter, multiplayer). */
export function useTightJuice() {
   const juice = useJuice();
   return (run: TightRun, ev: StepEvents, anim: HeroAnim, now: number, loud = 1) => {
      heroPoint(run, AT);
      const chest = { x: AT.x, y: AT.y + 1.1, z: AT.z };
      const feet = { x: AT.x, y: AT.y + 0.1, z: AT.z };
      if (ev.jumped) playSfx("jump", { volume: 0.45 * loud });
      if (ev.doubled) {
         juice.burst("aura", feet, 12, { color: heroAccent(run.heroId) });
         playSfx("jump", { pitch: 1.3, volume: 0.45 * loud });
      }
      if (ev.landed) {
         juice.burst("dust", feet, 8, { color: "#cdbb8c" });
         playSfx("thud", { pitch: 1.4, volume: 0.35 * loud });
         if (Math.abs(ev.kick) > 0.01) juice.popup(chest, ev.kick > 0 ? "kick ▶" : "◀ kick", { color: "#fde68a", size: 0.045 });
      }
      if (ev.wobble) {
         juice.popup(chest, "Wobble!", { color: "#fca5a5", size: 0.07 });
         playSfx("buzz", { volume: 0.4 * loud, pitch: 1.2 });
      }
      if (ev.recovered) {
         juice.burst("pickup", chest, 10, { color: "#ffffff" });
         juice.popup(chest, "Phew!", { color: "#bbf7d0", size: 0.06 });
         playSfx("whoosh", { pitch: 1.5, volume: 0.35 * loud });
      }
      if (ev.fell) {
         juice.burst("dust", feet, 16, { color: "#e7f0ea" });
         juice.shake(0.2 * loud);
         playSfx("lose", { volume: 0.4 * loud });
      }
      if (ev.respawned) {
         juice.burst("checkpoint", feet, 24, { color: heroAccent(run.heroId) });
         playSfx("pop", { volume: 0.5 * loud });
      }
      if (ev.checkpoint) {
         juice.burst("checkpoint", feet, 18, { color: "#4ade80" });
         playSfx("chime", { pitch: 1.1, volume: 0.35 * loud });
      }
      if (ev.clean) {
         // green leaves sprout behind a clean element (the card)
         const l = run.course.links[run.hero.link];
         const prev = l.prev >= 0 ? run.course.links[l.prev] : l;
         for (let k = 0; k < 4; k++) {
            linkPoint(prev, prev.len * (0.2 + k * 0.2), UP);
            juice.burst("pickup", { x: UP.x, y: UP.y + 0.1, z: UP.z }, 6, { color: "#4ade80" });
         }
         if (run.combo.chain > 1) juice.popup(chest, `Clean x${run.combo.chain}`, { color: "#86efac", size: 0.055 });
         playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.12, volume: 0.3 * loud });
      }
      if (ev.orb >= 0) {
         const o = run.course.orbs[ev.orb];
         juice.burst("pickup", chest, 18, { color: o.high ? "#93c5fd" : "#4ade80" });
         juice.popup(chest, o.high ? "-0.3 s" : "-0.2 s", { color: "#bbf7d0" });
         playSfx("pickup", { pitch: o.high ? 1.4 : 1.2, volume: loud });
      }
      if (ev.coin >= 0) {
         juice.burst("pickup", { x: AT.x, y: AT.y - 0.5, z: AT.z }, 10, { color: "#facc15" });
         playSfx("chime", { pitch: 1.6, volume: 0.4 * loud });
      }
      if (ev.powered) {
         juice.burst("aura", chest, 18, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.55 * loud, pitch: 1.2 });
      }
      if (ev.bagHit) {
         juice.burst("dust", chest, 14, { color: "#b89a6a" });
         juice.shake(0.18 * loud);
         juice.hitStop(50);
         playSfx("thud", { pitch: 0.7, volume: 0.6 * loud });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 36, { color: spec.kind === "shard" ? "#c4b5fd" : "#f9a8d4" });
         juice.popup(chest, `${spec.name}!`, { color: "#f9a8d4", size: 0.075 });
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.bossWake) juice.popup(chest, "Umbra!", { color: "#c4b5fd", size: 0.09 });
      if (ev.bossTelegraph && run.boss?.phase === 0) playSfx("alarm", { volume: 0.25 * loud });
      if (ev.bossAttack && run.boss) {
         umbraPoint(run, UP);
         const at = { x: UP.x, y: UP.y + 1.8, z: UP.z };
         juice.popup(at, run.boss.phase === 0 ? "STOMP!" : run.boss.phase === 1 ? "Snip!" : "Plate!", { color: "#fecaca", size: 0.07 });
         if (run.boss.phase === 0) juice.shake(0.2 * loud);
         playSfx("thud", { pitch: 0.55, volume: 0.6 * loud });
      }
      if (ev.bossHit) {
         umbraPoint(run, UP);
         const at = { x: UP.x, y: UP.y + 1, z: UP.z };
         juice.burst("hit", at, 30, { color: "#c4b5fd" });
         juice.popup(at, ev.bossDefeated ? "Umbra falls!" : "Hit!", { color: "#fde68a", size: 0.08 });
         juice.shake(0.3);
         juice.hitStop(90);
         playSfx("boom", { pitch: 1.1, volume: loud });
      }
      if (ev.bossPhase && !ev.bossDefeated && run.boss) juice.popup(chest, UMBRA.phases[run.boss.phase]?.name ?? "", { color: "#fde68a", size: 0.06 });
      if (ev.finished) anim.winAt = now + 0.3;
   };
}

/** The rope creak under the hero, louder and higher with the lean (the card). */
function useCreak(run: TightRun) {
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const loop = useRef<LoopHandle | null>(null);
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const ambient = startLoop("ambient", { volume: 0.08 });
      const l = startLoop("slide", { volume: 0, pitch: 0.5 });
      loop.current = l;
      return () => {
         ambient.stop();
         l.stop();
         loop.current = null;
      };
   }, [phase, muted]);
   const last = useRef({ v: -1, p: -1 });
   useFrame(() => {
      const l = loop.current;
      if (!l) return;
      const h = run.hero;
      const link = run.course.links[h.link];
      const a = link.kind === "pillar" || h.air ? 0 : Math.min(1, Math.abs(h.lean));
      const v = Math.round(a * a * 0.5 * 100) / 100;
      const p = Math.round((0.45 + a * 0.4) * 100) / 100;
      if (v !== last.current.v || p !== last.current.p) {
         last.current = { v, p };
         l.set({ volume: v, pitch: p });
      }
   });
}

function Simulation({ run, anim, orbit }: { run: TightRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const effects = useTightJuice();
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;
   useCreak(run);

   useRunFrame((_state, dt) => {
      const i = input.current;
      stepInput.moveX = i.moveX;
      stepInput.moveZ = i.moveY;
      stepInput.yaw = orbit.viewYaw;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.actionPressed = i.actionPressed;
      stepInput.actionHeld = i.action;
      if (bot) {
         bot.frameMs = lastFrame.current;
         botInput(bot, run, stepInput);
      }
      lastFrame.current = dt * 1000;
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const now = time.now;
      effects(run, ev, anim, now);
      publishStats(run);
      if (ev.finished) {
         heroPoint(run, AT);
         juice.burst("checkpoint", { x: AT.x, y: AT.y + 1, z: AT.z }, 110);
         juice.popup({ x: AT.x, y: AT.y + 2, z: AT.z }, run.boss ? "Balance Master!" : "Across the gorge!", { color: "#fde68a", size: 0.09 });
         juice.shake(0.2);
         playSfx("win", { volume: 0.7 });
         store.setStat(STAT.bonusMs, bonusMs(run));
         store.setStat(STAT.finishMs, run.finishMs);
         const end = levelEndStats(run, userRef.current);
         for (const key of Object.keys(end) as Array<keyof typeof end>) store.setStat(STAT[key], end[key]);
         store.end("win");
      } else if (ev.timeup) {
         levelEndStats(run, userRef.current);
         store.end("timeup");
      }
   });
   return null;
}

/** The orbit camera round the hero, swinging behind the walk when left alone, tilting with the needle. */
function TightCamera({ run, orbit }: { run: TightRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         if (run.hero.fallMs > 200) return false;
         heroPoint(run, AT);
         heroPivot(AT, out);
         return true;
      },
      [run],
   );
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         const h = run.hero;
         const l = run.course.links[h.link];
         const v = h.air ? h.airV : h.v;
         out.x = l.dx * Math.max(0, v);
         out.z = l.dz * Math.max(0, v);
      },
      [run],
   );
   const roll = useRef(0);
   useFrame((_s, dt) => {
      roll.current += (tiltFor(run.hero.lean) - roll.current) * Math.min(1, dt * 2.5);
      camera.rotateZ(roll.current);
   }, FRAME_PRIORITY.camera + 0.05);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} />;
}

function BossSlowMo({ run }: { run: TightRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, UMBRA.slowMo.durationMs));
      playSfx("chime", { pitch: 0.6, volume: 0.8 });
   });
   return null;
}

function IntroCamera({ run, anim }: { run: TightRun; anim: HeroAnim }) {
   const intro = useShellIntro();
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const keys = useMemo(() => introKeyframes(run.course), [run.course]);
   const play = useMemo(() => playCamera(run.course, aspect), [run.course, aspect]);
   const running = !!intro?.session && !intro.ready;
   useFrame(() => {
      anim.intro = running && intro ? intro.hero.current : Number.NaN;
   }, FRAME_PRIORITY.pose);
   const juice = useJuice();
   const landed = useRef(false);
   useFrame(() => {
      if (!running || landed.current || anim.intro < 0.985) return;
      landed.current = true;
      heroPoint(run, AT);
      juice.burst("dust", { x: AT.x, y: AT.y + 0.1, z: AT.z }, 18, { color: "#cdbb8c" });
      juice.burst("pickup", { x: AT.x, y: AT.y + 0.6, z: AT.z }, 16, { color: heroAccent(run.heroId) });
      juice.shake(0.2);
      juice.hitStop(60);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<TightLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(tightOrbit(run.course)), [run]);
   return (
      <JuiceLayer>
         <World course={run.course} />
         <Path key={levelId} run={run} />
         <Umbra run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <TightCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
