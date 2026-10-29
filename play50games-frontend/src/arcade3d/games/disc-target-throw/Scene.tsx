"use client";

// Disc Target Throw's scene: the run (rules.ts) stepped in useRunFrame, the courtyard (World), the
// targets (Course), Mother Snapper on level 5 (Boss), the disc with its aim preview, trail and catch
// ring (Disc), the hero (menu2/heroAnim), the free orbit camera (menu2/camera: the stick is
// camera-relative and the throw flies where the camera looks, through StepInput.yaw = orbit.viewYaw),
// the intro (core/intro) and the juice (menu2/juice): a whoosh whose pitch rises with every bank,
// sparks and a stone clack on each bank, hay and leaves bursting off a broken target, a hit-stop on a
// multi-hit, a thwap and a hand flash on the catch, the boss's hits and its slow-mo finish.
// Remounted for every run (runId). Local multiplayer runs render MultiScene.tsx instead.
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
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import World from "./World";
import { Course } from "./CourseView";
import { Snapper } from "./Boss";
import { DiscView, createAimView, type AimView } from "./Disc";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, courseSolids, discOrbit, heroPivot, introKeyframes, orbitLookUp, orbitScale, playCamera } from "./camera";
import { STAT, createRun, createStepInput, hintFor, step, type DiscRun, type StepEvents } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { DiscLevel } from "./levels";
import { COMBO, SECRETS, SNAPPER } from "./progression";
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

/** A major-scale climb: the disc's whoosh rises with every bank (the card). */
const SCALE = [1, 1.26, 1.5, 1.68];

export function publishStats(run: DiscRun, aim: AimView): void {
   const store = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   if (store.score !== run.score) store.setScore(run.score);
   set(STAT.required, run.required);
   set(STAT.orbs, run.orbs);
   set(STAT.hits, run.hits);
   set(STAT.cleans, run.cleans);
   set(STAT.drops, run.drops);
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10));
   set(STAT.hero, ["riko", "nami", "kiro", "zuno", "vexa"].indexOf(run.heroId));
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
   set(STAT.aiming, aim.active ? 1 : 0);
   set(STAT.hook, Math.round(aim.hook * 10));
   set(STAT.colour, run.course.cfg.colours ? run.nextColour + 1 : 0);
   set(STAT.hint, hintFor(run));
   const b = run.boss;
   if (b) {
      set(STAT.bossHp, b.hp);
      set(STAT.bossPhase, b.phase);
      set(STAT.bossOpen, b.step === "vulnerable" ? 1 : 0);
      set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
   }
}

/** The juice and sounds of one step's events (solo and, quieter, multiplayer). */
export function useDiscJuice() {
   const juice = useJuice();
   const spot = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   return (run: DiscRun, ev: StepEvents, anim: HeroAnim, now: number, loud = 1) => {
      const h = run.hero;
      const d = run.disc;
      chest.x = h.x;
      chest.y = 1.2;
      chest.z = h.z;
      spot.x = d.x;
      spot.y = d.y;
      spot.z = d.z;
      if (ev.thrown) {
         anim.throwAt = now;
         juice.burst("aura", chest, 10, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { pitch: 1, volume: 0.6 * loud });
      }
      if (ev.banked > 0) {
         juice.burst("hit", spot, 14, { color: "#ffe2a8" });
         juice.kick(0, 0, 0, 0.8 * loud);
         playSfx("thud", { pitch: 1.6, volume: 0.45 * loud });
         playSfx("whoosh", { pitch: SCALE[Math.min(SCALE.length - 1, ev.banked)], volume: 0.5 * loud });
         if (ev.banked >= 2) juice.popup(spot, `Bank x${ev.banked}`, { color: "#fde68a", size: 0.05 });
      }
      if (ev.bossDeflect) {
         juice.burst("hit", spot, 18, { color: "#c4b5fd" });
         playSfx("thud", { pitch: 0.7, volume: 0.6 * loud });
      }
      if (ev.thunk) {
         juice.burst("dust", spot, 12, { color: "#8a6a42" });
         playSfx("thud", { pitch: 0.8, volume: 0.5 * loud });
      }
      for (let k = 0; k < ev.targetCount; k++) {
         const t = run.course.targets[ev.targetList[k]];
         const pts = ev.targetPts[k];
         const at = { x: d.x, y: 1.2, z: d.z };
         if (t.kind === "orb") {
            juice.burst("pickup", at, 18, { color: "#4ade80" });
            juice.popup(at, `+${pts} orb`, { color: "#bbf7d0" });
            playSfx("pickup", { pitch: 1.2, volume: loud });
         } else if (t.kind === "shard") {
            juice.burst("checkpoint", at, 30, { color: "#c4b5fd" });
         } else {
            juice.burst("dust", at, 26, { color: t.kind === "idol" ? "#d8c79a" : "#e9c46a" });
            juice.burst("pickup", at, 14, { color: "#7ccf6a" });
            juice.popup(at, `+${pts}`, { color: pts >= t.base * 2 ? "#fde68a" : "#fff7d6", size: pts >= t.base * 3 ? 0.08 : 0.06 });
            playSfx("pop", { pitch: 0.9 + k * 0.15, volume: 0.8 * loud });
         }
      }
      if (ev.targetCount > 1 || (ev.targetCount > 0 && d.hits >= 2)) {
         juice.hitStop(45);
         juice.shake(0.12 * loud);
      }
      if (ev.triple) {
         juice.popup(chest, "TRIPLE GLYPH!", { color: "#fde68a", size: 0.09 });
         juice.burst("checkpoint", spot, 60, { color: "#facc15" });
         playSfx("combo", { pitch: 1.2 });
      }
      if (ev.monkeyHit >= 0) {
         juice.burst("hit", spot, 16, { color: "#fcd34d" });
         juice.popup(spot, "Monkey!", { color: "#fcd34d", size: 0.06 });
         playSfx("pop", { pitch: 1.4, volume: 0.7 * loud });
      }
      if (ev.snatched) {
         juice.popup(spot, "Snatched!", { color: "#fca5a5", size: 0.07 });
         playSfx("buzz", { volume: 0.5 * loud });
      }
      if (ev.podPopped >= 0) {
         juice.burst("pickup", spot, 26, { color: "#e8ff6a" });
         playSfx("pop", { pitch: 0.8, volume: loud });
      }
      if (ev.caught === "clean") {
         juice.burst("pickup", chest, 14, { color: "#ffffff" });
         juice.popup(chest, "Clean catch!", { color: "#86efac", size: 0.06 });
         playSfx("thud", { pitch: 1.3, volume: 0.55 * loud });
         playSfx("chime", { pitch: 1 + Math.min(0.8, run.combo.chain * 0.1), volume: 0.4 * loud });
      } else if (ev.caught === "catch") {
         juice.burst("pickup", chest, 8, { color: "#ffffff" });
         playSfx("thud", { pitch: 1.1, volume: 0.45 * loud });
      }
      if (ev.dropped) {
         juice.burst("dust", spot, 14, { color: "#cdbb8c" });
         juice.popup(spot, "Dropped! 1.5 s", { color: "#fca5a5", size: 0.06 });
         playSfx("buzz", { volume: 0.4 * loud, pitch: 0.8 });
      }
      if (ev.powered) {
         juice.burst("aura", chest, 18, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.55 * loud, pitch: 1.2 });
      }
      if (ev.hurt) {
         anim.hurtAt = now;
         juice.burst("hit", chest, 18, { color: "#f97316" });
         juice.shake(0.25 * loud);
         juice.hitStop(60);
         playSfx("hit", { volume: 0.5 * loud });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 36, { color: spec.kind === "shard" ? "#c4b5fd" : "#f9a8d4" });
         juice.popup(chest, `${spec.name}!`, { color: "#f9a8d4", size: 0.075 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.comboLinked && run.combo.chain > 1) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.12, volume: 0.3 * loud });
      if (ev.bossTelegraph && run.boss?.phase === 2) playSfx("alarm", { volume: 0.3 * loud });
      if (ev.bossAttack && run.boss) {
         const b = run.course.boss!;
         const at = { x: b.x, y: 5, z: b.z };
         juice.popup(at, run.boss.phase === 0 ? "SNAP!" : run.boss.phase === 2 ? "Thorns!" : "Seed pods!", { color: "#fecaca", size: 0.07 });
         playSfx("thud", { pitch: 0.5, volume: 0.6 * loud });
      }
      if (ev.bossHit) {
         juice.burst("hit", spot, 34, { color: "#fef08a" });
         juice.popup(spot, ev.bossDefeated ? "Mother Snapper falls!" : "Hit!", { color: "#fde68a", size: 0.08 });
         juice.shake(0.35);
         juice.hitStop(90);
         playSfx("boom", { pitch: 1.1, volume: loud });
      }
      if (ev.bossPhase && !ev.bossDefeated && run.boss) juice.popup(chest, SNAPPER.phases[run.boss.phase]?.name ?? "", { color: "#fde68a", size: 0.065 });
      if (ev.bossDefeated && run.course.boss) {
         const b = run.course.boss;
         const at = { x: b.x, y: 3, z: b.z };
         juice.burst("checkpoint", at, 140, { color: "#86efac" });
         juice.burst("checkpoint", at, 90, { color: "#f9a8d4" });
         juice.shake(0.5);
         juice.hitStop(140);
      }
   };
}

function Simulation({ run, anim, orbit, aim }: { run: DiscRun; anim: HeroAnim; orbit: OrbitState; aim: AimView }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const effects = useDiscJuice();
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;

   useRunFrame((_state, dt) => {
      const i = input.current;
      stepInput.moveX = i.moveX;
      stepInput.moveZ = i.moveY;
      stepInput.yaw = orbit.viewYaw;
      stepInput.throwHeld = i.jump;
      stepInput.actionPressed = i.actionPressed;
      if (bot) {
         bot.frameMs = lastFrame.current;
         botInput(bot, run, stepInput);
      }
      lastFrame.current = dt * 1000;
      aim.active = stepInput.throwHeld && run.disc.mode === "hand" && run.simMs > run.hero.stunUntil;
      aim.heading = stepInput.yaw + Math.PI;
      aim.hook = Math.max(-1, Math.min(1, stepInput.moveX));
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const now = time.now;
      effects(run, ev, anim, now);
      publishStats(run, aim);
      if (ev.finished) {
         anim.winAt = now + 0.3;
         juice.burst("checkpoint", { x: run.hero.x, y: 1, z: run.hero.z }, 110);
         juice.popup({ x: run.hero.x, y: 2, z: run.hero.z }, run.boss ? "Courtyard saved!" : "Every target down!", { color: "#fde68a", size: 0.09 });
         juice.shake(0.2);
         playSfx("win", { volume: 0.7 });
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

/** The orbit camera round the hero; the aim is its view. */
function DiscCamera({ run, orbit }: { run: DiscRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         heroPivot(run.hero, out);
         return true;
      },
      [run],
   );
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         out.x = 0;
         out.z = 0;
      },
      [],
   );
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run.course, camera.position.x, camera.position.z, out), [run, camera]);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} solids={solids} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={COLLISION} />;
}

const COLLISION = { radius: 0.35, minDistance: 3 };

function BossSlowMo({ run }: { run: DiscRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, SNAPPER.slowMo.durationMs));
      playSfx("chime", { pitch: 0.6, volume: 0.8 });
   });
   return null;
}

function IntroCamera({ run, anim }: { run: DiscRun; anim: HeroAnim }) {
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
      juice.burst("dust", { x: h.x, y: 0.1, z: h.z }, 18, { color: "#cdbb8c" });
      juice.burst("pickup", { x: h.x, y: 0.6, z: h.z }, 16, { color: heroAccent(run.heroId) });
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
   const { config } = useLevel<DiscLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const aim = useMemo(createAimView, [run]);
   const orbit = useMemo(() => createOrbit(discOrbit(run.course)), [run]);
   return (
      <JuiceLayer>
         <World run={run} />
         <Course key={levelId} run={run} />
         <Snapper run={run} />
         <Hero run={run} anim={anim} aim={aim} />
         <DiscView run={run} aim={aim} />
         <Simulation run={run} anim={anim} orbit={orbit} aim={aim} />
         <DiscCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
