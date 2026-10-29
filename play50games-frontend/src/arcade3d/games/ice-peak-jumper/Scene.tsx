"use client";

// Ice Peak Jumper's scene: the run (rules.ts) stepped in useRunFrame, the peak (World + Peak), the hero
// (the shared menu2/heroAnim animator), the Frost Golem (level 5), the free orbit camera (menu2/camera:
// movement is camera-relative through StepInput.yaw), the intro's camera (core/intro), the slide's hiss
// and the juice (menu2/juice): an ice-spray trail that grows with the speed (a brake throws a fan of
// it), the view widening above 7 m/s, frost on hard landings, a "ting" and a sparkle ring on a perfect
// landing, crystal shatters, the yeti's roar, the golem's slams. Remounted for every run (runId).
// Local multiplayer runs (2-4 heroes) render MultiScene.tsx instead.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useInput } from "@/arcade3d/core/input";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, createJuiceEmitter, useJuice } from "@/arcade3d/menu2/juice";
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
import { Peak } from "./Peak";
import { Golem } from "./Golem";
import { GroundProbe, Hero, createHeroAnim, onIce, type HeroAnim } from "./Hero";
import { PEAK_ORBIT, fovFor, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { ORB, STAT, bossVulnerable, createRun, createStepInput, grips, speedOf, step, type PeakRun, type StepEvents, type StepInput } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { PeakLevel } from "./levels";
import { COMBO, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import MultiScene from "./MultiScene";
import { mapInput, useEventJuice } from "./PeakJuice";

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
export function publishRun(run: PeakRun): void {
   const s = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (s.stats[k] !== v) s.setStat(k, v);
   };
   const h = run.hero;
   set(STAT.speed, Math.round(speedOf(run) * 10));
   set(STAT.height, Math.round(Math.max(0, run.best - run.course.plats[run.course.start].y)));
   set(STAT.grip, h.ground >= 0 ? (grips(run, run.course.plats[h.ground]) ? 1 : 2) : 0);
   set(STAT.hero, HERO_STAT[run.heroId]);
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.ms) / 1000)));
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

/** The slide's hiss: a loop that rises with the speed on ice; a soft wind bed. */
function useSlideSound(run: PeakRun) {
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const hiss = useRef<LoopHandle | null>(null);
   const last = useRef(-1);
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const bed = startLoop("ambient", { volume: 0.06, pitch: 0.8 });
      const r = startLoop("slide", { volume: 0, pitch: 0.8 });
      hiss.current = r;
      last.current = -1;
      return () => {
         bed.stop();
         r.stop();
         hiss.current = null;
      };
   }, [phase, muted]);
   useFrame(() => {
      const r = hiss.current;
      if (!r) return;
      const s = speedOf(run);
      const v = onIce(run) ? Math.min(0.28, 0.04 + s * 0.025 + (run.hero.braking ? 0.08 : 0)) : 0;
      if (Math.abs(v - last.current) > 0.015) {
         last.current = v;
         r.set({ volume: v, pitch: 0.7 + s * 0.05 });
      }
   });
}

function Simulation({ run, anim, orbit }: { run: PeakRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const juiceFor = useEventJuice();
   const juice = useJuice();
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;
   useSlideSound(run);

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
      if (ev.checkpoint >= 0) store.setStat(STAT.checkpoint, ev.checkpoint);
      if (ev.hit) store.setStat(STAT.hits, run.hits);
      if (ev.lost) store.setStat(STAT.falls, run.falls);
      publishRun(run);
      if (ev.finished) {
         anim.winAt = time.now;
         const h = run.hero;
         const p = { x: h.x, y: h.y + 1, z: h.z };
         juice.burst("checkpoint", p, 110);
         juice.burst("pickup", p, 40);
         juice.shake(0.2);
         playSfx("chime", { pitch: 0.75 });
         if (run.course.arena) playSfx("win");
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

/** The shared Menu 2 orbit camera round the hero; the view widens with the slide. */
export function PeakCamera({ run, orbit }: { run: PeakRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const fov = useRef(fovFor(aspect, 0));
   useFrame((_s, delta) => {
      const want = fovFor(aspect, speedOf(run));
      fov.current += (want - fov.current) * (1 - Math.exp(-3 * Math.min(0.1, delta)));
      if (Math.abs(camera.fov - fov.current) > 0.05) {
         camera.fov = fov.current;
         camera.updateProjectionMatrix();
      }
   });
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         const h = run.hero;
         if (h.state === "lost") return false;
         orbitPivot(h.x, h.y, h.z, h.vx, h.vz, out);
         return true;
      },
      [run],
   );
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         const h = run.hero;
         if (h.state !== "play") return;
         out.x = h.vx;
         out.z = h.vz;
      },
      [run],
   );
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} />;
}

function IntroCamera({ run, anim }: { run: PeakRun; anim: HeroAnim }) {
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
      juice.burst("dust", { x: h.x, y: h.y + 0.1, z: h.z }, 18, { color: "#f8fafc" });
      juice.burst("pickup", { x: h.x, y: h.y + 0.5, z: h.z }, 16, { color: heroAccent(run.heroId) });
      juice.kick(0, -1, 0, 4);
      juice.shake(0.25);
      juice.hitStop(70);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

/** Preview builds with ?autoplay=1 only: where the hero lands on screen (window.__ipjView) for the playtest. */
function ViewProbe({ run }: { run: PeakRun }) {
   const camera = useThree((s) => s.camera);
   const on = useMemo(() => autoplayRequested(), []);
   const v = useMemo(() => new Vector3(), []);
   const stats = useMemo(() => ({ frames: 0, out: 0, x: 0, y: 0 }), []);
   useFrame(() => {
      if (!on || run.hero.state !== "play" || useArcadeStore.getState().phase !== "playing") return;
      v.set(run.hero.x, run.hero.y + 0.8, run.hero.z).project(camera);
      stats.frames += 1;
      stats.x = v.x;
      stats.y = v.y;
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1 || v.z > 1) stats.out += 1;
      (window as unknown as { __ipjView?: typeof stats }).__ipjView = stats;
   });
   return null;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<PeakLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(PEAK_ORBIT), [run]);
   const ground = useRef(0);
   return (
      <JuiceLayer>
         <World run={run} course={run.course} />
         {/* keyed by level: the pools below are sized once per mount */}
         <Peak key={levelId} run={run} />
         <Golem key={`golem-${levelId}`} run={run} />
         <Hero run={run} anim={anim} ground={ground} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <GroundProbe run={run} ground={ground} />
         <PeakCamera run={run} orbit={orbit} />
         <IntroCamera run={run} anim={anim} />
         <ViewProbe run={run} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
