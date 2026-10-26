"use client";

// Sky Tower Jump's scene: the run (rules.ts) stepped in useRunFrame, the world and the course, the
// hero, the follow camera, the intro's camera (core/intro, opted in by index.tsx `intro: true`), and
// the juice: bursts, floating time bonuses, shake and sounds on jumps, bounces, orbs, checkpoints,
// falls and the finish. Remounted for every run (runId).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useInput, inputToWorld } from "@/arcade3d/core/input";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { useFx } from "@/arcade3d/core/fx";
import { playSfx } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useSafeArea } from "@/arcade3d/core/safeArea";
import { clearLensShift, stepLensShift, type LensState } from "@/arcade3d/core/view";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import World from "./World";
import { Course, type VisualClock } from "./Course";
import { Hero, createHeroAnim, groundUnder, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, cameraGoal, introKeyframes, playCamera, type CameraGoal } from "./camera";
import { ORB, STAT, createRun, createStepInput, step, type SkyRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { SkyLevel } from "./levels";

/** Preview builds only: `?autoplay=1` lets the honest bot (bot.ts) play, for screenshots and checks. */
function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

function Simulation({ run, anim, clock, won }: { run: SkyRun; anim: HeroAnim; clock: VisualClock; won: { current: boolean } }) {
   const input = useInput();
   const fx = useFx();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const world = useMemo(() => ({ x: 0, z: 0 }), []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);

   useEffect(() => fx.warm("sparkle", "puff", "confetti", "sparks", "score"), [fx]);

   useRunFrame((_state, dt) => {
      const i = input.current;
      inputToWorld(i.moveX, i.moveY, 0, world);
      stepInput.moveX = world.x;
      stepInput.moveZ = world.z;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.actionPressed = i.actionPressed;
      if (bot) {
         bot.frameMs = lastFrame.current;
         botInput(bot, run, stepInput);
      }
      lastFrame.current = dt * 1000;
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const h = run.hero;
      const now = time.now;
      chest.x = feet.x = h.x;
      chest.z = feet.z = h.z;
      chest.y = h.y + 0.7;
      feet.y = h.y + 0.1;
      if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.6 });
      }
      if (ev.powered) {
         fx.burst("sparkle", chest, 18);
         playSfx("whoosh", { volume: 0.55, pitch: 1.15 });
      }
      if (ev.landed) {
         anim.landAt = now;
         fx.burst("puff", feet, 7);
      }
      if (ev.bounced) {
         anim.bounceAt = now;
         fx.burst("sparks", feet, 22);
         fx.burst("sparkle", chest, 12);
         fx.shake(0.18);
         playSfx("whoosh", { pitch: 1.3 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = run.course.orbs[ev.orbList[k]];
         fx.burst("sparkle", o, 16);
         fx.score(o, `-${(ORB.bonusMs / 1000).toFixed(1)} s`, { color: "#ffe08a" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.03) });
      }
      if (ev.orbCount > 0) store.setStat(STAT.orbs, run.orbs);
      if (ev.checkpoint > 0) {
         fx.burst("confetti", chest, 40);
         fx.burst("sparkle", chest, 20);
         fx.score(chest, "Checkpoint!", { color: "#ffd257" });
         playSfx("chime");
         store.setStat(STAT.checkpoint, ev.checkpoint);
      }
      if (ev.lost) {
         anim.lostAt = now;
         fx.burst("puff", chest, 14);
         fx.shake(0.25);
         playSfx("lose", { volume: 0.5 });
         store.setStat(STAT.falls, run.respawns + 1);
      }
      if (ev.respawned) {
         anim.spawnAt = now;
         fx.burst("sparkle", chest, 24);
         fx.score(chest, "+fall time", { color: "#fca5a5" });
         playSfx("pop");
      }
      const height = Math.round(Math.max(0, run.bestTop));
      if (store.stats[STAT.height] !== height) store.setStat(STAT.height, height);
      const heroStat = run.heroId === "nami" ? 1 : run.heroId === "kiro" ? 2 : run.heroId === "zuno" ? 3 : run.heroId === "vexa" ? 4 : 0;
      if (store.stats[STAT.hero] !== heroStat) store.setStat(STAT.hero, heroStat);
      const powerLeft = Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000));
      if (store.stats[STAT.power] !== powerLeft) store.setStat(STAT.power, powerLeft);
      if (ev.finished) {
         won.current = true;
         anim.winAt = now;
         fx.burst("confetti", chest, 90);
         fx.burst("sparkle", chest, 40);
         fx.shake(0.2);
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.finishMs, run.finishMs);
         store.end("win");
      } else if (ev.timeup) {
         store.end("timeup");
      }
   });

   // the visual clock: the movers at rules time while playing; arriving at 0 on "Go"; moving after the end
   useFrame(() => {
      const s = useArcadeStore.getState();
      if (s.phase === "countdown") clock.ms = -s.countdownMs;
      else if (s.phase === "ready") clock.ms = time.now * 1000;
      else if (s.phase === "over") clock.ms = run.simMs + s.overMs;
      else clock.ms = run.simMs;
   }, FRAME_PRIORITY.camera);
   return null;
}

/** The follow camera: eased towards cameraGoal; it holds still while the hero falls out of view. */
function FollowCamera({ run }: { run: SkyRun }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const goal = useMemo<CameraGoal>(() => ({ px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 }), []);
   const look = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const placed = useRef(false);
   const lastSupport = useRef(run.course.checkpoints[0]);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   // the cookie banner (or the home indicator) covers the bottom: move the picture up by half of it
   // with a lens shift (the camera does not turn), so the hero stays in the free area
   const cover = useSafeArea((a) => {
      let c = 0;
      for (const r of a.obstructions) c = Math.max(c, a.height - r.top);
      return Math.round(Math.max(0, Math.min(a.height * 0.5, c)));
   });
   const lens = useMemo<LensState>(() => ({ x: 0, y: 0, set: false }), []);
   useLayoutEffect(() => () => clearLensShift(camera, lens), [camera, lens]);
   useFrame((state, delta) => {
      stepLensShift(camera, lens, 0, cover / Math.max(1, state.size.height), state.size.width, state.size.height, 1 - Math.exp(-6 * Math.min(0.1, delta)));
      const h = run.hero;
      const supports = run.course.supports;
      // the next platform after the one last stood on (kept through jumps and bounces), for the look-ahead
      if (h.grounded && h.support >= 0) lastSupport.current = h.support;
      else if (h.state !== "play") lastSupport.current = run.course.checkpoints[run.checkpoint];
      const here = lastSupport.current;
      const next = supports[Math.min(supports.length - 1, here + 1)];
      const falling = h.state === "lost" || (!h.grounded && h.y < h.lastTop - 3);
      if (!falling) cameraGoal(h.x, h.state === "lost" ? h.lastTop : Math.max(h.y, h.lastTop - 1), h.z, next.cx, next.top, next.cz, aspect, goal);
      const dt = Math.min(0.1, delta);
      const kp = placed.current ? 1 - Math.exp(-4.2 * dt) : 1;
      const kl = placed.current ? 1 - Math.exp(-6 * dt) : 1;
      placed.current = true;
      camera.position.x += (goal.px - camera.position.x) * kp;
      camera.position.y += (goal.py - camera.position.y) * kp;
      camera.position.z += (goal.pz - camera.position.z) * kp;
      look.x += (goal.lx - look.x) * kl;
      look.y += (goal.ly - look.y) * kl;
      look.z += (goal.lz - look.z) * kl;
      camera.lookAt(look.x, look.y, look.z);
   }, FRAME_PRIORITY.camera);
   return null;
}

/** The shadow's floor under the hero, written before the visuals draw. */
function GroundProbe({ run, clock, ground }: { run: SkyRun; clock: VisualClock; ground: { current: number } }) {
   useFrame(() => {
      const h = run.hero;
      ground.current = groundUnder(run, h.x, h.z, h.y, clock.ms);
   }, FRAME_PRIORITY.camera);
   return null;
}

/** The core intro's camera and the hero's drop (only while the shell plays the intro). */
function IntroCamera({ run, anim }: { run: SkyRun; anim: HeroAnim }) {
   const intro = useShellIntro();
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const keys = useMemo(() => introKeyframes(run.course), [run.course]);
   const play = useMemo(() => playCamera(run.course, aspect), [run.course, aspect]);
   const running = !!intro?.session && !intro.ready;
   useFrame(() => {
      anim.intro = running && intro ? intro.hero.current : Number.NaN;
   }, FRAME_PRIORITY.pose);
   const fx = useFx();
   const landed = useRef(false);
   useFrame(() => {
      if (!running || landed.current || anim.intro < 0.985) return;
      landed.current = true;
      const h = run.hero;
      fx.burst("puff", { x: h.x, y: h.y + 0.1, z: h.z }, 18);
      fx.burst("sparkle", { x: h.x, y: h.y + 0.5, z: h.z }, 16);
      fx.shake(0.25);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

export default function Scene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<SkyLevel>();
   const levelId: LevelId = config?.id ?? 1;
   // runId remounts the Scene; the seed only places decor (the course is the same race for everyone)
   // the picker changes the hero live: the start card and the intro show the picked hero before Play
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const decorSeed = 20261025;
   const anim = useMemo(createHeroAnim, [run]);
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [run]);
   const won = useRef(false);
   const ground = useRef(0);
   return (
      <>
         <World course={run.course} seed={decorSeed} levelId={levelId} />
         <Course run={run} clock={clock} won={won} />
         <Hero run={run} anim={anim} ground={ground} />
         <Simulation run={run} anim={anim} clock={clock} won={won} />
         <GroundProbe run={run} clock={clock} ground={ground} />
         <FollowCamera run={run} />
         <IntroCamera run={run} anim={anim} />
      </>
   );
}
