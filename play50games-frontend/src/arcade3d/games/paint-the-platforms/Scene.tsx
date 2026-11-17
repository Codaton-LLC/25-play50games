"use client";

// Paint the Platforms' scene: the run (rules.ts) stepped in useRunFrame, the fortress backdrop (World),
// the arena (ArenaView: tiles, rims, rafts, blobs, blots, roller), the Paint Blob on level 5, the hero
// (Hero), the free orbit camera (menu2/camera: the stick is camera-relative through StepInput.yaw =
// orbit.viewYaw; left alone it swings behind the run), the intro (core/intro) and the juice
// (menu2/juice): every fresh tile splats in the hero's colour with a pop that climbs with the chain, a set
// row rings a chime and sparkles along its tiles, a paint blob splashes, wiped paint hisses, the roller's
// alarm and rumble, the slam, the splats and the slow-mo finish. Remounted for every run (runId). Local
// multiplayer renders MultiScene.tsx instead.
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
import { Arena } from "./ArenaView";
import { Blob } from "./Boss";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, heroPivot, introKeyframes, orbitLookUp, orbitScale, paintOrbit, playCamera } from "./camera";
import { STAT, bonusMs, createRun, createStepInput, hintFor, step, tileCentre, type PaintRun, type StepEvents } from "./rules";
import { HERO_IDS, pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { PaintLevel } from "./levels";
import { BLOB, COMBO, SECRETS } from "./progression";
import { LIVE } from "./live";
import { levelEndStats } from "./levelEnd";
import MultiScene from "./MultiScene";

function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

export function publishStats(run: PaintRun): void {
   const store = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   set(STAT.painted, run.board.painted);
   set(STAT.need, run.course.need);
   set(STAT.total, run.course.tiles.length);
   set(STAT.rowsSet, run.board.rowsSet);
   set(STAT.blobs, run.board.taken.reduce((n, t) => n + t, 0));
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10));
   set(STAT.bonusMs, bonusMs(run));
   set(STAT.hero, HERO_IDS.indexOf(run.heroId));
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
   set(STAT.hint, hintFor(run));
   const b = run.boss;
   if (b && b.step !== "intro") {
      set(STAT.bossHp, b.hp);
      set(STAT.bossPhase, b.phase);
      set(STAT.bossOpen, b.step === "vulnerable" ? 1 : 0);
      set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
   }
}

const TC = { x: 0, z: 0 };

/** The juice and sounds of one step's events (solo and, quieter, multiplayer). */
export function usePaintJuice() {
   const juice = useJuice();
   const last = useRef({ splat: -1, wipe: -1 });
   return (run: PaintRun, ev: StepEvents, anim: HeroAnim, now: number, loud = 1) => {
      const h = run.hero;
      const chest = { x: h.x, y: h.y + 1.1, z: h.z };
      const feet = { x: h.x, y: h.y + 0.1, z: h.z };
      const colour = heroAccent(run.heroId);
      if (ev.jumped) playSfx("jump", { volume: 0.4 * loud });
      if (ev.doubled) {
         juice.burst("aura", feet, 12, { color: colour });
         playSfx("jump", { pitch: 1.3, volume: 0.4 * loud });
      }
      if (ev.landed) playSfx("thud", { pitch: 1.4, volume: 0.2 * loud });
      if (ev.painted > 0 && now - last.current.splat > 0.07) {
         last.current.splat = now;
         if (ev.tile >= 0) tileCentre(run, ev.tile, TC);
         juice.burst("pickup", { x: ev.tile >= 0 ? TC.x : h.x, y: 0.15, z: ev.tile >= 0 ? TC.z : h.z }, 8, { color: colour });
         playSfx("pop", { pitch: 0.9 + Math.min(0.8, run.combo.chain * 0.04), volume: 0.28 * loud });
      }
      if (ev.rowSet >= 0) {
         const row = run.course.rows[ev.rowSet];
         row.forEach((t, k) => {
            if (k % 2 !== 0) return;
            tileCentre(run, t, TC);
            juice.burst("checkpoint", { x: TC.x, y: 0.4, z: TC.z }, 10, { color: colour });
         });
         tileCentre(run, row[Math.floor(row.length / 2)], TC);
         juice.popup({ x: TC.x, y: 1.6, z: TC.z }, "Row set!", { color: "#fde68a", size: 0.07 });
         playSfx("chime", { pitch: 1 + Math.min(0.6, run.board.rowsSet * 0.05), volume: 0.6 * loud });
      }
      if (ev.wiped > 0 && now - last.current.wipe > 0.35) {
         last.current.wipe = now;
         playSfx("whoosh", { pitch: 0.6, volume: 0.18 * loud });
      }
      if (ev.pickup >= 0) {
         const o = run.course.pickups[ev.pickup];
         juice.burst("pickup", o, 30, { color: colour });
         juice.popup(o, "Splash!", { color: "#ffffff", size: 0.06 });
         juice.shake(0.08 * loud);
         playSfx("pickup", { pitch: 1.1, volume: loud });
      }
      if (ev.frozen >= 0) {
         juice.popup(chest, "Blot frozen!", { color: "#a5f3fc", size: 0.06 });
         playSfx("chime", { pitch: 1.6, volume: 0.5 * loud });
      }
      if (ev.rollerGlow) playSfx("alarm", { volume: 0.3 * loud });
      if (ev.rollerGo) playSfx("boom", { pitch: 0.5, volume: 0.35 * loud });
      if (ev.rollerStopped) {
         juice.popup(chest, "Roller stopped!", { color: "#86efac", size: 0.07 });
         juice.shake(0.2 * loud);
         playSfx("thud", { volume: 0.7 * loud });
      }
      if (ev.rowSet >= 0 && run.combo.chain > 4) juice.popup(chest, `Flow x${run.combo.chain}`, { color: "#e9d5ff", size: 0.05 });
      if (ev.died) {
         juice.burst("hit", chest, 22, { color: "#cbd5e1" });
         juice.shake(0.2 * loud);
         playSfx("lose", { volume: 0.4 * loud });
      }
      if (ev.respawned) {
         juice.burst("checkpoint", feet, 24, { color: colour });
         playSfx("pop", { volume: 0.5 * loud });
      }
      if (ev.hurt) {
         anim.hurtAt = now;
         juice.burst("hit", chest, 18, { color: "#94a3b8" });
         juice.shake(0.3 * loud);
         juice.hitStop(60);
         playSfx("hit", { volume: 0.5 * loud });
      }
      if (ev.powered) {
         juice.burst("aura", chest, 18, { color: colour });
         playSfx("whoosh", { volume: 0.55 * loud, pitch: 1.2 });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 36, { color: spec.kind === "shard" ? "#c4b5fd" : "#fde68a" });
         juice.popup(chest, `${spec.name}!`, { color: "#f9a8d4", size: 0.075 });
         playSfx("chime", { pitch: 1.4 });
      }
      const spec = run.course.boss;
      if (ev.bossTelegraph && spec) playSfx("alarm", { volume: 0.25 * loud });
      if (ev.bossAttack && spec) {
         juice.burst("hit", { x: run.ring.x, y: 0.3, z: run.ring.z }, 24, { color: "#6b7280" });
         juice.shake(0.35 * loud);
         playSfx("boom", { pitch: 0.7, volume: 0.7 * loud });
      }
      if (ev.bossOpen && spec) juice.popup({ x: spec.x, y: spec.y + 5, z: spec.z }, "Its core is open: splat it!", { color: "#fde68a", size: 0.06 });
      if (ev.bossHit && spec) {
         const at = { x: spec.x, y: spec.y + 2, z: spec.z };
         juice.burst("hit", at, 40, { color: colour });
         juice.popup(at, ev.bossDefeated ? "The Blob bursts!" : "Splat!", { color: "#fde68a", size: 0.08 });
         juice.shake(0.35);
         juice.hitStop(90);
         playSfx("boom", { pitch: 1.1, volume: loud });
      }
      if (ev.bossPhase && !ev.bossDefeated && run.boss) juice.popup(chest, BLOB.phases[run.boss.phase]?.name ?? "", { color: "#fde68a", size: 0.06 });
      if (ev.finished) anim.winAt = now + 0.3;
   };
}

function Simulation({ run, anim, orbit }: { run: PaintRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const effects = usePaintJuice();
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
         const h = run.hero;
         juice.burst("checkpoint", { x: h.x, y: h.y + 1, z: h.z }, 110);
         juice.popup({ x: h.x, y: h.y + 2, z: h.z }, run.boss ? "The court is yours!" : "Mural painted!", { color: "#fde68a", size: 0.09 });
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

const AT = { x: 0, y: 0, z: 0 };

function PaintCamera({ run, orbit }: { run: PaintRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         const h = run.hero;
         if (h.deadMs > 150) return false;
         AT.x = h.x;
         AT.y = Math.max(h.y, -4);
         AT.z = h.z;
         heroPivot(AT, out);
         return true;
      },
      [run],
   );
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         out.x = run.hero.vx;
         out.z = run.hero.vz;
      },
      [run],
   );
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} />;
}

function BossSlowMo({ run }: { run: PaintRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, BLOB.slowMo.durationMs));
      playSfx("chime", { pitch: 0.6, volume: 0.8 });
   });
   return null;
}

function IntroCamera({ run, anim }: { run: PaintRun; anim: HeroAnim }) {
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
      const h = run.hero;
      juice.burst("pickup", { x: h.x, y: h.y + 0.6, z: h.z }, 16, { color: heroAccent(run.heroId) });
      juice.shake(0.2);
      juice.hitStop(60);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<PaintLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(paintOrbit(run.course)), [run]);
   useEffect(() => {
      LIVE.run = run;
      return () => {
         if (LIVE.run === run) LIVE.run = null;
      };
   }, [run]);
   return (
      <JuiceLayer>
         <World course={run.course} />
         <Arena key={levelId} run={run} />
         <Blob run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <PaintCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}

