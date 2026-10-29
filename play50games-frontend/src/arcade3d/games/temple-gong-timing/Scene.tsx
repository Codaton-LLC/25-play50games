"use client";

// Temple Gong Timing's scene: the run (rules.ts) stepped in useRunFrame, the temple (World), the stage
// (StageView), Coilstone (level 5), the hero (menu2/heroAnim), the orbit camera on the stage
// (menu2/camera), the intro (core/intro) and the juice (menu2/juice). The song: the beat grid plays as
// log drums from core audio (a deep drum on the downbeat, a click on the other beats; the ninth gong's
// remix adds a rimshot on the off-beats), and every strike rings its gong (a chime pitched per gong).
// The judgement is always the run's clock, never the sound (rules.ts). Each Perfect kicks the camera, holds
// the frame 40 ms, sends a soundwave burst off the gong and grows a flower; the combo chimes at x10, x25
// and x50. Remounted per run; local multiplayer renders MultiScene.tsx.
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
import { playSfx } from "@/arcade3d/core/audio";
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
import { Stage } from "./StageView";
import Coilstone from "./Coilstone";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, introKeyframes, orbitScale, playCamera, stageOrbit, stagePivot } from "./camera";
import { targetBody } from "./chart";
import { GOOD, MISS, PERFECT, STAT, accuracyOf, bossVulnerable, createRun, createStepInput, flowOf, step, type GongRun, type StepEvents } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { GongLevel } from "./levels";
import { COILSTONE, SECRETS, secretIndex } from "./progression";
import { levelEndStats } from "./levelEnd";
import { COLORS } from "./look";
import MultiScene from "./MultiScene";

function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

const HERO_IDS = ["riko", "nami", "kiro", "zuno", "vexa"] as const;

export function publishBoss(run: GongRun): void {
   const b = run.boss;
   if (!b) return;
   const store = useArcadeStore.getState();
   const open = bossVulnerable(run) ? 1 : 0;
   const flash = b.flashMs > 0 ? 1 : 0;
   if (store.stats[STAT.bossHp] !== b.hp) store.setStat(STAT.bossHp, b.hp);
   if (store.stats[STAT.bossPhase] !== b.phase) store.setStat(STAT.bossPhase, b.phase);
   if (store.stats[STAT.bossOpen] !== open) store.setStat(STAT.bossOpen, open);
   if (store.stats[STAT.bossFlash] !== flash) store.setStat(STAT.bossFlash, flash);
}

/** The music and the juice of one step's events (solo and, quieter, multiplayer). */
export function useGongJuice() {
   const juice = useJuice();
   const spot = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   return (run: GongRun, ev: StepEvents, anim: HeroAnim, now: number, loud = 1, music = true) => {
      const h = run.hero;
      chest.x = h.x;
      chest.y = h.air + 1.1;
      chest.z = h.z;
      if (music && ev.beat) {
         if (ev.downbeat) playSfx("thud", { pitch: 0.55, volume: 0.45 * loud });
         else playSfx("click", { pitch: 0.7, volume: 0.22 * loud });
      }
      if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.3 * loud });
      }
      if (ev.airJumped) {
         anim.airJumpAt = now;
         playSfx("jump", { pitch: 1.25, volume: 0.45 * loud });
      }
      if (ev.landed) anim.landAt = now;
      if (ev.strike !== 0 && ev.note >= 0) {
         const n = run.chart.notes[ev.note];
         targetBody(run.stage, n.target, run.simMs, spot);
         if (ev.strike === PERFECT || ev.strike === GOOD) {
            const perfect = ev.strike === PERFECT;
            const pitch = n.target.kind === "gong" ? 0.6 + n.target.i * 0.09 : n.target.kind === "great" ? 0.4 : n.target.kind === "drum" ? 0.5 : 1.3;
            playSfx("chime", { pitch, volume: (perfect ? 0.8 : 0.55) * loud });
            juice.burst("hit", spot, perfect ? 26 : 14, { color: perfect ? COLORS.perfect : COLORS.good });
            juice.burst("checkpoint", spot, perfect ? 14 : 6, { color: COLORS.bronze });
            juice.popup(spot, perfect ? "PERFECT" : "GOOD", { color: perfect ? "#bbf7d0" : "#fde68a", size: perfect ? 0.08 : 0.06 });
            if (perfect) {
               juice.kick(0, -1, 0, 1.6 * loud);
               juice.hitStop(40);
            }
            const c = run.combo.chain;
            if (c === 10 || c === 25 || c === 50) {
               juice.popup(chest, `Combo x${c}!`, { color: "#fde68a", size: 0.08 });
               playSfx("combo", { volume: 0.6 * loud });
            }
         } else if (ev.strike === MISS) {
            juice.popup(spot, "Too early", { color: "#fca5a5", size: 0.05 });
         }
      }
      for (let k = 0; k < ev.missCount; k++) {
         const n = run.chart.notes[ev.missList[k]];
         targetBody(run.stage, n.target, run.simMs, spot);
         juice.popup(spot, "MISS", { color: "#fca5a5", size: 0.05 });
         playSfx("buzz", { volume: 0.25 * loud, pitch: 0.8 });
      }
      if (ev.whiff) playSfx("whoosh", { pitch: 1.4, volume: 0.25 * loud });
      if (ev.holdDone) {
         juice.burst("pickup", chest, 14, { color: COLORS.flowerGold });
         juice.popup(chest, "Held! +50", { color: "#fde68a", size: 0.05 });
      }
      if (ev.holdBroken) playSfx("click", { pitch: 0.5, volume: 0.4 * loud });
      if (ev.echoCaught > 0) {
         juice.burst("pickup", chest, 10, { color: COLORS.echo });
         playSfx("pickup", { pitch: 1.4, volume: 0.45 * loud });
      }
      if (ev.shielded) {
         juice.burst("aura", chest, 18, { color: heroAccent(run.heroId) });
         juice.popup(chest, "Shield!", { color: "#86efac", size: 0.06 });
      } else if (ev.shockHit) {
         anim.hurtAt = now;
         juice.burst("hit", chest, 16, { color: COLORS.shock });
         juice.shake(0.22 * loud);
         juice.hitStop(60);
         playSfx("hit", { volume: 0.45 * loud });
      }
      if (ev.ninth) {
         juice.burst("checkpoint", chest, 16, { color: COLORS.bronze });
         playSfx("chime", { pitch: 0.45, volume: 0.7 * loud });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 30, { color: spec.kind === "shard" ? "#c4b5fd" : "#f9a8d4" });
         juice.popup(chest, `${spec.name}!`, { color: "#f9a8d4", size: 0.07 });
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.bossHit) {
         juice.shake(0.3);
         juice.hitStop(80);
         juice.popup(chest, ev.bossDefeated ? "Coilstone is free!" : "Plate cracked!", { color: "#a7f3d0", size: 0.08 });
         playSfx("thud", { pitch: 1.1 });
      }
      if (ev.bossPhase && run.boss && !ev.bossDefeated) juice.popup(chest, COILSTONE.phases[run.boss.phase]?.name ?? "", { color: "#fde68a", size: 0.06 });
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 140, { color: COLORS.jade });
         juice.burst("checkpoint", chest, 90, { color: COLORS.flowerGold });
         juice.shake(0.5);
         juice.hitStop(140);
         playSfx("combo", { pitch: 0.7 });
      }
   };
}

function Simulation({ run, anim, orbit }: { run: GongRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const effects = useGongJuice();
   const judgeAt = useRef(-9);
   const beatAt = useRef(-9);
   const halfBeat = useRef(-1);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;

   useRunFrame((_state, dt) => {
      const i = input.current;
      stepInput.moveX = i.moveX;
      stepInput.moveZ = i.moveY;
      stepInput.yaw = orbit.viewYaw;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.actionPressed = i.actionPressed;
      stepInput.action = i.action;
      if (bot) {
         bot.frameMs = lastFrame.current;
         botInput(bot, run, stepInput);
      }
      lastFrame.current = dt * 1000;
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const now = time.now;
      effects(run, ev, anim, now);
      // the ninth gong's remix: a rimshot on the off-beats once it is found
      const ninth = secretIndex(run.level, "ninth-gong");
      const half = Math.floor((run.simMs / run.stage.beatMs) * 2);
      if (ninth >= 0 && run.secrets.found[ninth] && half !== halfBeat.current && half % 2 === 1) playSfx("pop", { pitch: 1.6, volume: 0.2 });
      halfBeat.current = half;
      const set = (key: string, value: number) => {
         if (store.stats[key] !== value) store.setStat(key, value);
      };
      if (ev.points > 0) store.addScore(ev.points);
      if (ev.strike !== 0 || ev.missCount > 0) {
         judgeAt.current = now;
         set("judge", ev.missCount > 0 && ev.strike === 0 ? MISS : ev.strike);
      } else if (now - judgeAt.current > 0.6) set("judge", 0);
      if (ev.beat) beatAt.current = now;
      set("beat", now - beatAt.current < 0.12 ? (ev.downbeat ? 2 : 1) : 0);
      set(STAT.accuracy, Math.round(accuracyOf(run) * 100));
      set(STAT.echoes, run.echoCount);
      set(STAT.hero, HERO_IDS.indexOf(run.heroId));
      set(STAT.shield, run.heroId === "kiro" ? Math.max(0, Math.ceil((run.shieldReadyAt - run.simMs) / 1000)) : 0);
      set(STAT.comboChain, run.combo.chain);
      set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
      set(STAT.comboFlow, Math.ceil(flowOf(run) * 10));
      if (!run.boss) set(STAT.song, Math.min(100, Math.floor((run.simMs / Math.max(1, run.chart.endMs)) * 100)));
      publishBoss(run);
      if (ev.finished) {
         if (run.ended === "win") anim.winAt = now;
         else anim.loseAt = now;
         store.setScore(run.score);
         const end = levelEndStats(run, userRef.current);
         for (const key of Object.keys(end) as Array<keyof typeof end>) store.setStat(STAT[key], end[key]);
         store.end(run.ended ?? "lose");
      }
   });
   return null;
}

function StageCamera({ run, orbit }: { run: GongRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         stagePivot(run.hero, out);
         return true;
      },
      [run],
   );
   return <OrbitCamera orbit={orbit} pivot={pivot} lookUp={0} distanceScale={orbitScale(aspect)} />;
}

function BossSlowMo({ run }: { run: GongRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, COILSTONE.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: GongRun; anim: HeroAnim }) {
   const intro = useShellIntro();
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const keys = useMemo(introKeyframes, []);
   const play = useMemo(() => playCamera(run.stage, aspect), [run.stage, aspect]);
   const running = !!intro?.session && !intro.ready;
   useFrame(() => {
      anim.intro = running && intro ? intro.hero.current : Number.NaN;
   }, FRAME_PRIORITY.pose);
   const juice = useJuice();
   const landed = useRef(false);
   useFrame(() => {
      if (!running || landed.current || anim.intro < 0.985) return;
      landed.current = true;
      const h = run.hero;
      const p = { x: h.x, y: 0.1, z: h.z };
      juice.burst("dust", p, 18, { color: "#cdbf9a" });
      juice.burst("pickup", p, 16, { color: heroAccent(run.heroId) });
      juice.kick(0, -1, 0, 4);
      juice.shake(0.25);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<GongLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(stageOrbit(run.stage)), [run]);
   return (
      <JuiceLayer>
         <World run={run} />
         <Stage key={levelId} run={run} />
         <Coilstone run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <StageCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
