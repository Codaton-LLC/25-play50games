"use client";

// Cloud Hopper's scene: the run (rules.ts) stepped in useRunFrame, the sky and the cloud sea, the
// hero (animated by the shared menu2/heroAnim), the 3/4 follow camera, the intro's camera (core/intro,
// opted in by index.tsx `intro: true`), and the juice (the shared menu2/juice JuiceLayer): landing
// puffs and a camera thump, a feather trail while gliding, a soft chime that climbs the scale with the
// centre streak, ring and feather glints, a burst of vapour when a cloud goes, thunder crackle, the
// boss's hits, its slow-mo finish (visual only) and the bell. Remounted for every run (runId). Local
// multiplayer runs (2-4 heroes) render MultiScene.tsx instead.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useInput } from "@/arcade3d/core/input";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, createJuiceEmitter, useJuice } from "@/arcade3d/menu2/juice";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import { comboFlow } from "@/arcade3d/menu2/combo/combo";
import { playSfx } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useSafeArea } from "@/arcade3d/core/safeArea";
import { clearLensShift, stepLensShift, type LensState } from "@/arcade3d/core/view";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import World from "./World";
import { Course, type VisualClock } from "./Course";
import { Hero, createHeroAnim, groundUnder, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, cameraGoal, introKeyframes, playCamera, type CameraGoal } from "./camera";
import { ORB, STAT, createRun, createStepInput, step, type CloudRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { CloudLevel } from "./levels";
import { COMBO, GLOOM_NIMBUS, SECRETS } from "./progression";
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

/** The camera's yaw the stick is read against (0 = the fixed follow camera; a future orbit camera writes it). */
export interface CameraYaw {
   current: number;
}

/** A major-scale climb for the centre-landing chime (the card: it climbs with the streak). */
const SCALE = [1, 1.122, 1.26, 1.335, 1.498, 1.682, 1.888, 2];

export function publishBoss(run: CloudRun): void {
   const b = run.boss;
   if (!b) return;
   const store = useArcadeStore.getState();
   const open = b.step === "vulnerable" ? 1 : 0;
   const flash = b.flashMs > 0 ? 1 : 0;
   if (store.stats[STAT.bossHp] !== b.hp) store.setStat(STAT.bossHp, b.hp);
   if (store.stats[STAT.bossPhase] !== b.phase) store.setStat(STAT.bossPhase, b.phase);
   if (store.stats[STAT.bossOpen] !== open) store.setStat(STAT.bossOpen, open);
   if (store.stats[STAT.bossFlash] !== flash) store.setStat(STAT.bossFlash, flash);
   if (store.stats[STAT.charges] !== run.charges) store.setStat(STAT.charges, run.charges);
}

function Simulation({ run, anim, clock, won, yaw }: { run: CloudRun; anim: HeroAnim; clock: VisualClock; won: { current: boolean }; yaw: CameraYaw }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const trail = useMemo(createJuiceEmitter, []);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;

   useRunFrame((_state, dt) => {
      const i = input.current;
      // screen-relative stick: the rules turn it by the camera's yaw (0 today)
      stepInput.moveX = i.moveX;
      stepInput.moveZ = i.moveY;
      stepInput.yaw = yaw.current;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.jumpHeld = i.jump;
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
      if (ev.airJumped) {
         anim.airJumpAt = now;
         juice.burst("dust", feet, 10, { color: "#ffffff" });
         playSfx("jump", { volume: 0.6, pitch: 1.25 });
      } else if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.6 });
      }
      if (ev.glideStarted) playSfx("whoosh", { volume: 0.35, pitch: 0.8 });
      if (h.gliding) juice.stream("trail", chest, 36, trail, { color: "#fff7d6" });
      if (ev.powered) {
         juice.burst("pickup", chest, 20, { color: heroAccent(run.heroId) });
         juice.burst("aura", chest, 14, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.55, pitch: 1.15 });
      }
      if (ev.wallBroken >= 0) {
         juice.burst("hit", chest, 26, { color: "#94a3b8" });
         juice.burst("dust", chest, 16, { color: "#cbd5e1" });
         juice.shake(0.22);
         juice.hitStop(60);
         playSfx("thud");
      }
      if (ev.landed) {
         anim.landAt = now;
         juice.burst("dust", feet, 9, { color: "#ffffff" });
         juice.kick(0, -1, 0, 1.2);
         if (ev.centre) {
            juice.burst("pickup", feet, 10, { color: "#fde68a" });
            playSfx("chime", { pitch: SCALE[Math.min(SCALE.length - 1, (run.streak - 1) % SCALE.length)], volume: 0.4 });
         }
      }
      for (let k = 0; k < ev.featherCount; k++) {
         const f = run.course.feathers[ev.featherList[k]];
         juice.burst("pickup", f, 12, { color: "#fef3c7" });
         juice.popup(f, "+1.5 s glide", { color: "#fef3c7", size: 0.05 });
         playSfx("pickup", { pitch: 1.4, volume: 0.6 });
      }
      if (ev.ring >= 0) {
         const r = run.course.rings[ev.ring];
         juice.burst("pickup", r, 18, { color: "#7dd3fc" });
         juice.popup(r, r.kind === "lift" ? "Updraft!" : "+1 s glide", { color: "#bae6fd", size: 0.06 });
         if (r.kind === "lift") juice.kick(0, 1, 0, 3);
         playSfx("whoosh", { pitch: 1.4 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = run.course.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 14);
         juice.popup(o, `-${(ORB.bonusMs / 1000).toFixed(1)} s`, { color: "#ffe08a" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.03) });
      }
      if (ev.orbCount > 0) {
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spot = run.course.secrets[ev.secretList[k]];
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", spot, 30, { color: spec.kind === "shard" ? "#bae6fd" : "#f9a8d4" });
         juice.popup(spot, `${spec.name}!`, { color: spec.kind === "shard" ? "#bae6fd" : "#f9a8d4", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.comboLinked && run.combo.chain > 1) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.45 });
      if (ev.comboBonus > 0) store.setStat(STAT.comboMs, run.combo.bonusTotal);
      const flow = Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10);
      if (store.stats[STAT.comboChain] !== run.combo.chain) store.setStat(STAT.comboChain, run.combo.chain);
      const mult = Math.round(run.combo.multiplier * 100);
      if (store.stats[STAT.comboMult] !== mult) store.setStat(STAT.comboMult, mult);
      if (store.stats[STAT.comboFlow] !== flow) store.setStat(STAT.comboFlow, flow);
      if (ev.checkpoint > 0) {
         juice.burst("checkpoint", chest, 46);
         juice.popup(chest, "Anchor cloud!", { color: "#ffd257", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime");
         store.setStat(STAT.checkpoint, ev.checkpoint);
      }
      if (ev.charged) {
         juice.burst("hit", chest, 22, { color: "#fde047" });
         juice.popup(chest, "Charged!", { color: "#fde047", size: 0.07 });
         playSfx("chime", { pitch: 1.7 });
      }
      if (ev.bossHit) {
         juice.burst("hit", chest, 30, { color: "#fef08a" });
         juice.shake(0.3);
         juice.hitStop(80);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 90, { color: "#c4b5fd" });
         juice.popup(chest, "Gloom Nimbus bursts!", { color: "#e9d5ff", size: 0.08 });
         juice.shake(0.45);
         juice.hitStop(130);
      }
      if (ev.lost) {
         anim.lostAt = now;
         juice.burst("hit", chest, 16, { color: ev.struck ? "#c4b5fd" : undefined });
         juice.burst("dust", feet, 10, { color: "#ffffff" });
         juice.shake(ev.struck ? 0.35 : 0.28);
         juice.hitStop(90);
         playSfx("lose", { volume: 0.5 });
         store.setStat(STAT.falls, run.hits);
      }
      if (ev.respawned) {
         anim.spawnAt = now;
         juice.burst("pickup", chest, 22, { color: heroAccent(run.heroId) });
         juice.popup(chest, "+fall time", { color: "#fca5a5" });
         playSfx("pop");
      }
      publishBoss(run);
      const dist = Math.round(run.bestDist);
      if (store.stats[STAT.distance] !== dist) store.setStat(STAT.distance, dist);
      const glide = Math.ceil(h.glideMs / 100);
      if (store.stats[STAT.glide] !== glide) store.setStat(STAT.glide, glide);
      if (store.stats[STAT.streak] !== run.streak) store.setStat(STAT.streak, run.streak);
      const heroStat = run.heroId === "nami" ? 1 : run.heroId === "kiro" ? 2 : run.heroId === "zuno" ? 3 : run.heroId === "vexa" ? 4 : 0;
      if (store.stats[STAT.hero] !== heroStat) store.setStat(STAT.hero, heroStat);
      const powerLeft = Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000));
      if (store.stats[STAT.power] !== powerLeft) store.setStat(STAT.power, powerLeft);
      if (ev.finished) {
         won.current = true;
         anim.winAt = now;
         juice.burst("checkpoint", chest, 110);
         juice.burst("pickup", chest, 40);
         juice.shake(0.2);
         playSfx("chime", { pitch: 0.75 });
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
      else if (s.phase === "over") clock.ms = run.simMs + s.overMs;
      else clock.ms = run.simMs;
   }, FRAME_PRIORITY.camera);
   return null;
}

/** The follow camera: a 3/4 view eased towards cameraGoal; it holds still while the hero falls out of view. */
function FollowCamera({ run }: { run: CloudRun }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const goal = useMemo<CameraGoal>(() => ({ px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0 }), []);
   const look = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const placed = useRef(false);
   const lastPos = useRef(0);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   const cover = useSafeArea((a) => {
      let c = 0;
      for (const r of a.obstructions) c = Math.max(c, a.height - r.top);
      return Math.round(Math.max(0, Math.min(a.height * 0.5, c)));
   });
   const lens = useMemo<LensState>(() => ({ x: 0, y: 0, set: false }), []);
   useLayoutEffect(() => () => clearLensShift(camera, lens), [camera, lens]);
   const routePos = useMemo(() => {
      const p = new Array<number>(run.course.clouds.length).fill(-1);
      run.course.route.forEach((ci, k) => (p[ci] = k));
      return p;
   }, [run.course]);
   useFrame((state, delta) => {
      stepLensShift(camera, lens, 0, cover / Math.max(1, state.size.height), state.size.width, state.size.height, 1 - Math.exp(-6 * Math.min(0.1, delta)));
      const h = run.hero;
      const c = run.course;
      if (h.grounded && h.support >= 0 && routePos[h.support] >= 0) lastPos.current = routePos[h.support];
      else if (h.state !== "play") lastPos.current = routePos[c.checkpoints[run.checkpoint]];
      const next = c.clouds[c.route[Math.min(c.route.length - 1, lastPos.current + 1)]];
      const falling = h.state === "lost" || (!h.grounded && h.y < h.lastTop - 3);
      if (!falling) cameraGoal(h.x, Math.max(h.y, h.lastTop - 1), h.z, next.cx, next.top, next.cz, aspect, goal);
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

function GroundProbe({ run, clock, ground }: { run: CloudRun; clock: VisualClock; ground: { current: number } }) {
   useFrame(() => {
      const h = run.hero;
      ground.current = groundUnder(run, h.x, h.z, h.y, clock.ms);
   }, FRAME_PRIORITY.camera);
   return null;
}

/** The boss's slow-mo finish: the visuals only (menu2/boss bossTimeScale through the juice clock). */
function BossSlowMo({ run }: { run: CloudRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      // the hit-stop is the visual slow-mo's punch; the rules clock never slows
      juice.hitStop(Math.min(140, GLOOM_NIMBUS.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: CloudRun; anim: HeroAnim }) {
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
      juice.burst("dust", { x: h.x, y: h.y + 0.1, z: h.z }, 18, { color: "#ffffff" });
      juice.burst("pickup", { x: h.x, y: h.y + 0.5, z: h.z }, 16, { color: heroAccent(run.heroId) });
      juice.kick(0, -1, 0, 4);
      juice.shake(0.25);
      juice.hitStop(70);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<CloudLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const decorSeed = 20261027;
   const anim = useMemo(createHeroAnim, [run]);
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [run]);
   const yaw = useMemo<CameraYaw>(() => ({ current: 0 }), []);
   const won = useRef(false);
   const ground = useRef(0);
   return (
      <JuiceLayer>
         <World course={run.course} seed={decorSeed} levelId={levelId} />
         <Course run={run} clock={clock} won={won} />
         <Hero run={run} anim={anim} ground={ground} />
         <Simulation run={run} anim={anim} clock={clock} won={won} yaw={yaw} />
         <GroundProbe run={run} clock={clock} ground={ground} />
         <FollowCamera run={run} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
