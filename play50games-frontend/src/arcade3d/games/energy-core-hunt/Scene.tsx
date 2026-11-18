"use client";

// Energy Core Hunt's scene: the run (rules.ts) stepped in useRunFrame, the reactor arena (World +
// Arena), the hero (the shared menu2/heroAnim animator), the Core Sprite (level 5), the free orbit camera
// (menu2/camera; the stick moves the hero relative to it), the intro's camera (core/intro), the hum of
// the reactor, and the juice (Juice.tsx). Remounted for every run (runId). Local multiplayer runs (2-4
// heroes) render MultiScene.tsx instead.
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
import { Arena } from "./Arena";
import { Sprite } from "./Sprite";
import { Runner, createHeroAnim, type HeroAnim } from "./Hero";
import { CORE_ORBIT, FOV, FOV_PORTRAIT, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { STAT, bossOpen, capsuleNear, createRun, createStepInput, step, type CoreRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { CoreLevel } from "./levels";
import { COMBO } from "./progression";
import { levelEndStats } from "./levelEnd";
import { mapInput, useEventJuice } from "./Juice";
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

const NEED = [STAT.need0, STAT.need1, STAT.need2, STAT.need3, STAT.need4] as const;

/** Publishes what the HUD shows (only when a value changes). */
export function publishRun(run: CoreRun): void {
   const s = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (s.stats[k] !== v) s.setStat(k, v);
   };
   // per colour: still needed for the whole order (the HUD's chips), and the cores in hand
   for (let c = 0; c < 5; c++) set(NEED[c], Math.max(0, run.course.order[c] - run.count[c]));
   set(STAT.cores, run.count.reduce((a, b) => a + b, 0));
   set(STAT.wave, Math.min(run.wave + 1, run.course.waves.length));
   set(STAT.gate, run.gateOpen ? 1 : 0);
   set(STAT.hits, run.hits);
   set(STAT.hero, HERO_STAT[run.heroId]);
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.ms) / 1000)));
   set(STAT.near, capsuleNear(run) + 1);
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.ms) * 10));
   const b = run.boss;
   if (b && run.bossAwake) {
      set(STAT.bossHp, b.hp);
      set(STAT.bossPhase, b.phase);
      set(STAT.bossOpen, bossOpen(run) ? 1 : 0);
      set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
   }
}

/** The hum of the run: a low space bed and footsteps that follow the speed. */
function useRunSound(run: CoreRun) {
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const steps = useRef<LoopHandle | null>(null);
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const bed = startLoop("ambient", { volume: 0.07, pitch: 0.7 });
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
      const v = Math.hypot(run.hero.vx, run.hero.vz);
      r.set({ volume: run.hero.h > 0.01 || v < 0.5 ? 0 : 0.05, pitch: 1.0 + v * 0.04 });
   });
}

function Simulation({ run, anim, orbit }: { run: CoreRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run, 1000 / 60, false) : null));
   const lastFrame = useRef(1000 / 60);
   const juiceFor = useEventJuice();
   const juice = useJuice();
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;
   useRunSound(run);

   useRunFrame((_state, dt) => {
      mapInput(input.current, orbit.viewYaw, stepInput);
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
      publishRun(run);
      if (ev.finished) {
         anim.winAt = time.now;
         const r = run.hero;
         const p = { x: r.x, y: 1.2, z: r.z };
         juice.burst("checkpoint", p, 110);
         juice.burst("pickup", p, 40);
         juice.shake(0.2);
         playSfx("chime", { pitch: 0.75 });
         if (run.course.boss) playSfx("win");
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

/** The shared Menu 2 orbit camera round the runner. */
export function CoreCamera({ run, orbit }: { run: CoreRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         const r = run.hero;
         orbitPivot(r.x, r.h, r.z, out);
         return true;
      },
      [run],
   );
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         // the auto-follow keeps the camera looking north over the arena (towards the gate) while the hero moves
         if (run.ended) return;
         out.x = 0;
         out.z = -Math.max(Math.abs(run.hero.vz), Math.abs(run.hero.vx));
      },
      [run],
   );
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} pivotDamping={10} />;
}

function IntroCamera({ run, anim }: { run: CoreRun; anim: HeroAnim }) {
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
      juice.burst("dust", { x: 0, y: 0.1, z: 0 }, 18, { color: "#94a3b8" });
      juice.burst("pickup", { x: 0, y: 0.5, z: 0 }, 16, { color: heroAccent(run.heroId) });
      juice.kick(0, -1, 0, 4);
      juice.shake(0.25);
      juice.hitStop(70);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

/** Preview builds with ?autoplay=1 only: where the runner lands on screen (window.__echView) for the playtest. */
function ViewProbe({ run }: { run: CoreRun }) {
   const camera = useThree((s) => s.camera);
   const on = useMemo(() => autoplayRequested(), []);
   const v = useMemo(() => new Vector3(), []);
   const stats = useMemo(() => ({ frames: 0, out: 0, x: 0, y: 0 }), []);
   useFrame(() => {
      if (!on || useArcadeStore.getState().phase !== "playing") return;
      v.set(run.hero.x, run.hero.h + 0.8, run.hero.z).project(camera);
      stats.frames += 1;
      stats.x = v.x;
      stats.y = v.y;
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1 || v.z > 1) stats.out += 1;
      (window as unknown as { __echView?: typeof stats }).__echView = stats;
   });
   return null;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<CoreLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(CORE_ORBIT), [run]);
   return (
      <JuiceLayer>
         <World level={levelId} length={run.course.half} />
         {/* keyed by level: the pools below are sized once per mount */}
         <Arena key={levelId} run={run} level={levelId} />
         <Sprite key={`sprite-${levelId}`} run={run} />
         <Runner run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <CoreCamera run={run} orbit={orbit} />
         <IntroCamera run={run} anim={anim} />
         <ViewProbe run={run} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
