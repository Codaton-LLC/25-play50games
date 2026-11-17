"use client";

// Candy World Runner's scene: the run (rules.ts) stepped in useRunFrame, the candy road (World + Road),
// the runner (the shared menu2/heroAnim animator, drawn at its size), King Bonbon (level 5), the free
// orbit camera (menu2/camera; it pulls back as you grow), the intro's camera (core/intro), the patter
// of the run, and the juice (RunnerJuice.tsx). Remounted for every run (runId). Local multiplayer runs
// (2-4 runners) render MultiScene.tsx instead.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";
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
import { Road } from "./Road";
import { King } from "./King";
import { Runner, createHeroAnim, type HeroAnim } from "./Hero";
import { CANDY_ORBIT, FOV, FOV_PORTRAIT, distanceFor, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { BURN_MS, STAT, bossVulnerable, createRun, createStepInput, speedNow, step, visualS, type CandyRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput, nextBeat } from "./bot";
import type { CandyLevel } from "./levels";
import { COMBO } from "./progression";
import { levelEndStats } from "./levelEnd";
import { createFlick, mapInput, useEventJuice } from "./RunnerJuice";
import MultiScene from "./MultiScene";

/** Preview builds only: `?autoplay=1` lets the honest bot (bot.ts) play, for screenshots and checks. */
export function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

const HERO_STAT = { riko: 0, nami: 1, kiro: 2, zuno: 3, vexa: 4 } as const;

/** Publishes what the HUD shows (only when a value changes). */
export function publishRun(run: CandyRun): void {
   const s = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (s.stats[k] !== v) s.setStat(k, v);
   };
   const r = run.runner;
   set(STAT.size, r.size);
   set(STAT.eaten, r.eaten);
   set(STAT.burn, Math.round((r.burnMs / BURN_MS) * 10));
   set(STAT.progress, Math.max(0, Math.min(100, Math.round((r.s / run.course.finishS) * 100))));
   set(STAT.misses, run.misses);
   set(STAT.hero, HERO_STAT[run.heroId]);
   set(STAT.power, run.heroId === "zuno" ? (run.magnetOn ? -1 : 0) : Math.max(0, Math.ceil((run.powerReadyAt - run.ms) / 1000)));
   // the next obstacle's size sign: 2 = BIG, 1 = SMALL, 0 none near (2 s ahead; 3 s on level 1)
   const beat = nextBeat(run, r.s);
   const near = beat && beat.s - r.s < (run.level === 1 ? 3 : 2) * speedNow(run);
   set(STAT.sign, near && beat ? (beat.need === 2 ? 2 : 1) : 0);
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.ms) * 10));
   const b = run.boss;
   if (b && run.bossAwake) {
      set(STAT.bossHp, b.hp);
      set(STAT.bossPhase, b.phase);
      set(STAT.bossOpen, bossVulnerable(run) ? 1 : 0);
      set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
   }
}

/** The patter of the run: a soft music-box bed and footsteps that follow the speed. */
function useRunSound(run: CandyRun) {
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const steps = useRef<LoopHandle | null>(null);
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const bed = startLoop("ambient", { volume: 0.06, pitch: 1.2 });
      const r = startLoop("belt", { volume: 0.05, pitch: 1.4 });
      steps.current = r;
      return () => {
         bed.stop();
         r.stop();
         steps.current = null;
      };
   }, [phase, muted]);
   useFrame(() => {
      const r = steps.current;
      if (!r) return;
      r.set({ volume: run.runner.h > 0.01 ? 0 : run.runner.rolling ? 0.1 : 0.05, pitch: 1.2 + speedNow(run) * 0.03 });
   });
}

function Simulation({ run, anim }: { run: CandyRun; anim: HeroAnim }) {
   const input = useInput();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const flick = useMemo(createFlick, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const juiceFor = useEventJuice();
   const juice = useJuice();
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;
   useRunSound(run);

   useRunFrame((_state, dt) => {
      mapInput(input.current, flick, stepInput);
      if (bot) {
         bot.frameMs = lastFrame.current;
         botInput(bot, run, stepInput);
      }
      lastFrame.current = dt * 1000;
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      juiceFor(run, ev, anim, true);
      if (ev.orbCount > 0) {
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
      }
      if (ev.comboBonus > 0) store.setStat(STAT.comboMs, run.combo.bonusTotal);
      if (ev.miss >= 0 || ev.bitten || ev.popped || ev.cracked >= 0) store.setStat(STAT.hits, run.hits);
      publishRun(run);
      if (ev.finished) {
         anim.winAt = time.now;
         const r = run.runner;
         const p = { x: r.x, y: 1.2, z: -visualS(run) };
         juice.burst("checkpoint", p, 110);
         juice.burst("pickup", p, 40);
         juice.shake(0.2);
         playSfx("chime", { pitch: 0.75 });
         if (run.course.loop) playSfx("win");
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
         store.setStat(STAT.finishMs, run.finishMs);
         store.setStat(STAT.comboMs, run.combo.bonusTotal);
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

/** The shared Menu 2 orbit camera round the runner; it pulls back as the runner grows. */
export function CandyCamera({ run, orbit }: { run: CandyRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   // the pull-back: the orbit's distance follows the size unless the player zoomed it themselves
   const set = useRef(orbit.distance);
   const eased = useRef(0);
   useFrame((_s, delta) => {
      eased.current += (run.runner.size - eased.current) * (1 - Math.exp(-4 * Math.min(0.1, delta)));
      if (Math.abs(orbit.distance - set.current) < 0.01) {
         orbit.distance = distanceFor(eased.current);
         set.current = orbit.distance;
      }
   }, FRAME_PRIORITY.camera - 0.02);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         const r = run.runner;
         orbitPivot(r.x, r.h, visualS(run), out);
         return true;
      },
      [run],
   );
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         if (run.ended) return;
         out.x = 0;
         out.z = -speedNow(run);
      },
      [run],
   );
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} input={CANDY_GESTURES} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} pivotDamping={10} />;
}

/** Canvas swipes change lanes: one finger never turns the camera (two fingers do; the right mouse button drags it). */
export const CANDY_GESTURES = { oneFinger: false, mouseButtons: [2] } as const;

function IntroCamera({ run, anim }: { run: CandyRun; anim: HeroAnim }) {
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
      juice.burst("dust", { x: 0, y: 0.1, z: 0 }, 18, { color: "#fbcfe8" });
      juice.burst("pickup", { x: 0, y: 0.5, z: 0 }, 16, { color: heroAccent(run.heroId) });
      juice.kick(0, -1, 0, 4);
      juice.shake(0.25);
      juice.hitStop(70);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

/** Preview builds with ?autoplay=1 only: where the runner lands on screen (window.__cwrView) for the playtest. */
function ViewProbe({ run }: { run: CandyRun }) {
   const camera = useThree((s) => s.camera);
   const on = useMemo(() => autoplayRequested(), []);
   const v = useMemo(() => new Vector3(), []);
   const stats = useMemo(() => ({ frames: 0, out: 0, x: 0, y: 0 }), []);
   useFrame(() => {
      if (!on || useArcadeStore.getState().phase !== "playing") return;
      v.set(run.runner.x, run.runner.h + 0.8, -visualS(run)).project(camera);
      stats.frames += 1;
      stats.x = v.x;
      stats.y = v.y;
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1 || v.z > 1) stats.out += 1;
      (window as unknown as { __cwrView?: typeof stats }).__cwrView = stats;
   });
   return null;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<CandyLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(CANDY_ORBIT), [run]);
   return (
      <JuiceLayer>
         <World level={levelId} length={run.course.finishS} />
         {/* keyed by level: the pools below are sized once per mount */}
         <Road key={levelId} run={run} />
         <King key={`king-${levelId}`} run={run} />
         <Runner run={run} anim={anim} />
         <Simulation run={run} anim={anim} />
         <CandyCamera run={run} orbit={orbit} />
         <IntroCamera run={run} anim={anim} />
         <ViewProbe run={run} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
