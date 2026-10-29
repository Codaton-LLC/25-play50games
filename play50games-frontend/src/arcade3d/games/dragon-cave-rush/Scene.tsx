"use client";

// Dragon Cave Rush's scene: the run (rules.ts) stepped in useRunFrame, the cave (Course.tsx) and its
// light (World.tsx), the cart with the picked hero and Cindermaw (Hero.tsx), the free orbit camera
// (menu2/camera: the player turns it; the lean is camera-relative through StepInput.yaw, and the
// auto-follow swings it back behind the rails), the intro's camera (core/intro), the cart's rumble, and
// the juice (menu2/juice): wheel sparks on a two-wheel tilt, a roar shake and an orange flash for each
// breath, orb pops, crystal shatter, barricade bursts, the boss's hits. Remounted for every run (runId).
// Local multiplayer runs (2-4 carts) render MultiScene.tsx instead.
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
import { Course, type VisualClock } from "./Course";
import { Dragon, Rider, cartPose, createCartPose, createHeroAnim, type CartPose, type HeroAnim } from "./Hero";
import { CAVE_ORBIT, FOV, FOV_PORTRAIT, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera, tubeFraction, yawAt } from "./camera";
import { BREATH, ORB, STAT, bossVulnerable, createRun, createStepInput, step, type CaveRun, type StepEvents, type StepInput } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { CaveLevel } from "./levels";
import { CINDERMAW, COMBO, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import { lanePoint } from "./track";
import MultiScene from "./MultiScene";
import { mapInput, useEventJuice } from "./CartJuice";

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

/** A breath on its way (telegraph or fire): 2 = firing, 1 = telegraph, 0 = none. */
export function breathState(run: CaveRun): number {
   let st = 0;
   for (const b of run.breaths) {
      const t = b.fireAt - run.ms;
      if (t <= 0 && t > -BREATH.fireMs) return 2;
      if (t > 0 && t <= BREATH.telegraphMs) st = 1;
   }
   return st;
}

/** Publishes what the HUD shows (only when a value changes). */
export function publishRun(run: CaveRun): void {
   const s = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (s.stats[k] !== v) s.setStat(k, v);
   };
   const c = run.cart;
   set(STAT.meter, Math.round(run.meter));
   set(STAT.awake, run.awake ? 1 : 0);
   set(STAT.progress, Math.max(0, Math.min(100, Math.round((c.s / Math.max(1, run.course.finishS)) * 100))));
   set(STAT.hero, HERO_STAT[run.heroId]);
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.ms) / 1000)));
   set(STAT.breath, breathState(run));
   set(STAT.tilt, c.tilted ? 1 : 0);
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.ms) * 10));
   const b = run.boss;
   if (b && run.course.loop && c.s >= run.course.loop.s0 - 4) {
      set(STAT.bossHp, b.hp);
      set(STAT.bossPhase, b.phase);
      set(STAT.bossOpen, bossVulnerable(run) || (b.step === "vulnerable" && b.hp > 0) ? 1 : 0);
      set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
   }
}

/** The cart's rumble: a low loop that rises with the speed; louder on a two-wheel tilt. */
function useCartSound(run: CaveRun) {
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const rumble = useRef<LoopHandle | null>(null);
   const last = useRef(-1);
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const bed = startLoop("ambient", { volume: 0.05, pitch: 0.5 });
      const r = startLoop("belt", { volume: 0, pitch: 0.6 });
      rumble.current = r;
      last.current = -1;
      return () => {
         bed.stop();
         r.stop();
         rumble.current = null;
      };
   }, [phase, muted]);
   useFrame(() => {
      const r = rumble.current;
      if (!r) return;
      const c = run.cart;
      const v = c.state === "ride" && c.h <= 0.01 ? Math.min(0.22, 0.08 + c.v * 0.004 + (c.tilted ? 0.08 : 0)) : 0.02;
      if (Math.abs(v - last.current) > 0.015) {
         last.current = v;
         r.set({ volume: v, pitch: 0.45 + c.v * 0.012 + (c.tilted ? 0.2 : 0) });
      }
   });
}

function Simulation({ run, anim, clock, orbit }: { run: CaveRun; anim: HeroAnim; clock: VisualClock; orbit: OrbitState }) {
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
   useCartSound(run);

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
      if (ev.checkpoint > 0) store.setStat(STAT.checkpoint, ev.checkpoint);
      if (ev.hit || ev.caught) store.setStat(STAT.falls, run.hits);
      publishRun(run);
      if (ev.finished) {
         anim.winAt = time.now;
         const c = run.cart;
         const p = lanePoint(run.course, c.s, c.d, 1.2, { x: 0, y: 0, z: 0, h: 0 });
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

   useFrame(() => {
      const s = useArcadeStore.getState();
      if (s.phase === "countdown") clock.ms = -s.countdownMs;
      else if (s.phase === "ready") clock.ms = time.now * 1000;
      else if (s.phase === "over") clock.ms = run.ms + s.overMs;
      else clock.ms = run.ms;
   }, FRAME_PRIORITY.camera);
   return null;
}

/** The shared Menu 2 orbit camera round the cart; the auto-follow swings it behind the rails. */
export function CaveCamera({ run, orbit }: { run: CaveRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         const c = run.cart;
         const lane = run.course.lanes[c.lane];
         orbitPivot(run.course, c.s, c.d, lane.y + Math.max(0, c.h) * 0.6, out);
         return true;
      },
      [run],
   );
   const dir = useMemo(() => ({ x: 0, y: 0, z: 0, h: 0 }), []);
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         const c = run.cart;
         if (c.state !== "ride") return;
         // the rails' direction a little ahead (the follow anticipates a curve)
         lanePoint(run.course, c.s + 6, 0, 0, dir);
         out.x = -Math.sin(dir.h) * c.v;
         out.z = -Math.cos(dir.h) * c.v;
      },
      [run, dir],
   );
   const behind = useMemo(() => () => yawAt(run.course, run.cart.s + 4), [run]);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} behind={behind} input={CAVE_GESTURES} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} pivotDamping={10} />;
}

/** After the orbit placed the camera: pull it in along its ray to the pivot until it is inside the cave. */
function TubeClamp({ run }: { run: CaveRun }) {
   const camera = useThree((s) => s.camera);
   const size = useThree((s) => s.size);
   const at = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const cam = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const k = useRef(1);
   useFrame((_s, delta) => {
      const c = run.cart;
      const lane = run.course.lanes[c.lane];
      orbitPivot(run.course, c.s, c.d, lane.y + Math.max(0, c.h) * 0.6, at);
      cam.x = camera.position.x;
      cam.y = camera.position.y;
      cam.z = camera.position.z;
      const want = tubeFraction(run.course, c.s - 6, at, cam);
      // in at once (never through the wall), back out smoothly
      k.current = want < k.current ? want : k.current + (want - k.current) * (1 - Math.exp(-4 * Math.min(0.1, delta)));
      if (k.current >= 0.999) return;
      camera.position.set(at.x + (cam.x - at.x) * k.current, at.y + (cam.y - at.y) * k.current, at.z + (cam.z - at.z) * k.current);
      camera.lookAt(at.x, at.y + orbitLookUp(size.width / Math.max(1, size.height)), at.z);
   }, FRAME_PRIORITY.camera + 0.01);
   return null;
}

/** Canvas swipes swap lanes: one finger never turns the camera (two fingers do; the right mouse button drags it). */
export const CAVE_GESTURES = { oneFinger: false, mouseButtons: [2] } as const;

function IntroCamera({ run, anim }: { run: CaveRun; anim: HeroAnim }) {
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
      const p = lanePoint(run.course, 0, 0, 0.8, { x: 0, y: 0, z: 0, h: 0 });
      juice.burst("dust", p, 18, { color: "#d6d3d1" });
      juice.burst("pickup", p, 16, { color: heroAccent(run.heroId) });
      juice.kick(0, -1, 0, 4);
      juice.shake(0.25);
      juice.hitStop(70);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

/**
 * Preview builds with ?autoplay=1 only: publishes where the hero's chest lands on screen (window.__dcrView:
 * NDC x / y, and how many frames it was out of view), so the headless playtest checks it is never hidden.
 */
function ViewProbe({ pose }: { pose: CartPose }) {
   const camera = useThree((s) => s.camera);
   const on = useMemo(() => autoplayRequested(), []);
   const v = useMemo(() => new Vector3(), []);
   const stats = useMemo(() => ({ frames: 0, out: 0, x: 0, y: 0 }), []);
   useFrame(() => {
      if (!on || useArcadeStore.getState().phase !== "playing") return;
      v.set(pose.x, pose.y + 1.2, pose.z).project(camera);
      stats.frames += 1;
      stats.x = v.x;
      stats.y = v.y;
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1 || v.z > 1) stats.out += 1;
      (window as unknown as { __dcrView?: typeof stats }).__dcrView = stats;
   });
   return null;
}

/** Writes the cart pose before the camera reads it (Rider writes it again for drawing). */
function PoseProbe({ run, pose }: { run: CaveRun; pose: CartPose }) {
   useFrame(() => {
      cartPose(run, pose);
   }, FRAME_PRIORITY.camera - 0.02);
   return null;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<CaveLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [run]);
   const orbit = useMemo(() => createOrbit({ ...CAVE_ORBIT, yaw: yawAt(run.course, 0) }), [run]);
   const pose = useMemo(createCartPose, [run]);
   return (
      <JuiceLayer>
         <World run={run} />
         {/* keyed by level: the pools below are sized once per mount */}
         <Course key={levelId} run={run} clock={clock} />
         <Rider run={run} anim={anim} pose={pose} />
         <Dragon run={run} cart={pose} />
         <Simulation run={run} anim={anim} clock={clock} orbit={orbit} />
         <PoseProbe run={run} pose={pose} />
         <CaveCamera run={run} orbit={orbit} />
         <TubeClamp run={run} />
         <IntroCamera run={run} anim={anim} />
         <ViewProbe pose={pose} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
