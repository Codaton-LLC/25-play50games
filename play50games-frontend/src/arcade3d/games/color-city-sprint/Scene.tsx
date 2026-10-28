"use client";

// Color City Sprint: the run (rules.ts) stepped in useRunFrame, the city, the hero, the free orbit
// camera (movement is camera-relative through StepInput.yaw), the intro and the juice. Local
// multiplayer renders MultiScene instead. Remounted per run (runId).
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
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
import { World } from "./World";
import { Course, type VisualClock } from "./Course";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { CITY_ORBIT, FOV, FOV_PORTRAIT, courseSolids, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { ORB_BONUS_MS, STAT, createRun, createStepInput, guidePoint, runTimeMs, step, type CityRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { CitySpec } from "./levels";
import { COMBO, GREYOUT, SECRETS } from "./progression";
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

const HERO_INDEX = { riko: 0, nami: 1, kiro: 2, zuno: 3, vexa: 4 } as const;

function publishBoss(run: CityRun): void {
   const b = run.boss;
   if (!b) return;
   const store = useArcadeStore.getState();
   const open = b.step === "vulnerable" ? 1 : 0;
   const flash = b.flashMs > 0 ? 1 : 0;
   if (store.stats[STAT.bossHp] !== b.hp) store.setStat(STAT.bossHp, b.hp);
   if (store.stats[STAT.bossPhase] !== b.phase) store.setStat(STAT.bossPhase, b.phase);
   if (store.stats[STAT.bossOpen] !== open) store.setStat(STAT.bossOpen, open);
   if (store.stats[STAT.bossFlash] !== flash) store.setStat(STAT.bossFlash, flash);
}

function Simulation({ run, anim, clock, won, orbit }: { run: CityRun; anim: HeroAnim; clock: VisualClock; won: { current: boolean }; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const bot = useMemo(() => (autoplayRequested() ? createBot(run) : null), [run]);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const guide = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;

   useRunFrame((_state, dt) => {
      const i = input.current;
      stepInput.moveX = i.moveX;
      stepInput.moveZ = i.moveY;
      stepInput.yaw = orbit.viewYaw;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.jumpHeld = i.jump;
      stepInput.actionPressed = i.actionPressed;
      if (bot) {
         stepInput.yaw = 0;
         bot.frameMs = dt * 1000;
         botInput(bot, run, stepInput);
      }
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const h = run.hero;
      const now = time.now;
      chest.x = feet.x = h.x;
      chest.z = feet.z = h.z;
      chest.y = h.y + 0.7;
      feet.y = h.y + 0.05;
      if (ev.airJumped) {
         anim.airJumpAt = now;
         juice.burst("dust", feet, 10, { color: "#ffffff" });
         playSfx("jump", { volume: 0.6, pitch: 1.25 });
      } else if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.55 });
      }
      if (ev.powered) {
         juice.burst("pickup", chest, 16, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.5, pitch: 1.1 });
      }
      if (ev.wallBroken >= 0) {
         juice.burst("hit", chest, 22, { color: "#94a3b8" });
         juice.shake(0.2);
         playSfx("thud");
      }
      if (ev.landed) {
         anim.landAt = now;
         juice.burst("dust", feet, 8, { color: "#e7d5c9" });
      }
      if (ev.redEnter) juice.burst("dust", feet, 6, { color: "#ef4444" });
      if (ev.beacon) {
         juice.burst("checkpoint", chest, 28, { color: "#ef4444" });
         juice.popup(chest, "Beacon", { color: "#fecaca", size: 0.06 });
         playSfx("chime");
      }
      if (ev.lap) {
         juice.popup(chest, `Lap ${run.lap + 1}`, { color: "#ef4444", size: 0.08 });
         juice.hitStop(50);
         playSfx("chime", { pitch: 1.35 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = run.course.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 12, { color: "#fde68a" });
         juice.popup(o, `-${(ORB_BONUS_MS / 1000).toFixed(1)} s`, { color: "#fde68a" });
         playSfx("pickup", { pitch: 1.1 });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spot = run.course.secrets[ev.secretList[k]];
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", spot, 24, { color: "#f9a8d4" });
         juice.popup(spot, `${spec.name}!`, { color: "#f9a8d4", size: 0.06 });
         playSfx("chime", { pitch: 1.5 });
      }
      if (ev.comboLinked && run.combo.chain > 1) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.15, volume: 0.4 });
      if (ev.bossHit) {
         juice.burst("hit", chest, 26, { color: "#e2e8f0" });
         juice.shake(0.28);
         juice.hitStop(70);
         playSfx("thud", { pitch: 0.8 });
      }
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 70, { color: "#ef4444" });
         juice.popup(chest, "The city turns red!", { color: "#fecaca", size: 0.07 });
         juice.shake(0.4);
      }
      if (ev.struck) {
         juice.burst("hit", chest, 14, { color: "#94a3b8" });
         juice.shake(0.2);
         playSfx("thud", { pitch: 0.6, volume: 0.4 });
      }
      publishBoss(run);
      const clockMs = Math.round(runTimeMs(run.simMs, run.orbs, run.combo.bonusTotal));
      if (store.stats[STAT.clock] !== clockMs) store.setStat(STAT.clock, clockMs);
      if (store.stats[STAT.lap] !== run.lap) store.setStat(STAT.lap, run.lap);
      if (store.stats[STAT.beacons] !== run.beaconIndex) store.setStat(STAT.beacons, run.beaconIndex);
      if (store.stats[STAT.orbs] !== run.orbs) store.setStat(STAT.orbs, run.orbs);
      if (store.stats[STAT.mainOrbs] !== run.mainOrbs) store.setStat(STAT.mainOrbs, run.mainOrbs);
      const heroStat = HERO_INDEX[run.heroId];
      if (store.stats[STAT.hero] !== heroStat) store.setStat(STAT.hero, heroStat);
      const powerLeft = Math.max(0, Math.ceil((h.powerReadyAt - run.simMs) / 100));
      if (store.stats[STAT.power] !== powerLeft) store.setStat(STAT.power, powerLeft);
      const flow = Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10);
      if (store.stats[STAT.comboChain] !== run.combo.chain) store.setStat(STAT.comboChain, run.combo.chain);
      const mult = Math.round(run.combo.multiplier * 100);
      if (store.stats[STAT.comboMult] !== mult) store.setStat(STAT.comboMult, mult);
      if (store.stats[STAT.comboFlow] !== flow) store.setStat(STAT.comboFlow, flow);
      if (store.stats[STAT.comboMs] !== run.combo.bonusTotal) store.setStat(STAT.comboMs, run.combo.bonusTotal);
      guidePoint(run, guide);
      const gx = Math.round(guide.x * 10);
      const gz = Math.round(guide.z * 10);
      if (store.stats[STAT.guideX] !== gx) store.setStat(STAT.guideX, gx);
      if (store.stats[STAT.guideZ] !== gz) store.setStat(STAT.guideZ, gz);
      const yawStat = Math.round(orbit.viewYaw * 100);
      if (store.stats[STAT.yaw] !== yawStat) store.setStat(STAT.yaw, yawStat);
      const speed = Math.round(Math.hypot(h.vx, h.vz) * 10);
      if (store.stats[STAT.speed] !== speed) store.setStat(STAT.speed, speed);
      if (ev.finished && !won.current) {
         won.current = true;
         anim.winAt = now;
         juice.burst("checkpoint", chest, 80, { color: "#ef4444" });
         playSfx("chime", { pitch: 0.8 });
         store.setStat(STAT.finishMs, run.finishMs);
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.comboMs, run.combo.bonusTotal);
         const end = levelEndStats(run, userRef.current);
         store.setStat(STAT.stars, end.stars);
         store.setStat(STAT.newStars, end.newStars);
         store.setStat(STAT.noHit, end.noHit);
         store.setStat(STAT.secrets, end.secrets);
         store.setStat(STAT.newSecrets, end.newSecrets);
         store.setStat(STAT.xp, end.xp);
         store.end("win");
      } else if (ev.timeup && !won.current) {
         won.current = true;
         const end = levelEndStats(run, userRef.current);
         store.setStat(STAT.stars, end.stars);
         store.setStat(STAT.noHit, end.noHit);
         store.setStat(STAT.secrets, end.secrets);
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

function CityCamera({ run, orbit }: { run: CityRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   const pivot = useMemo(() => (out: { x: number; y: number; z: number }) => {
      orbitPivot(run, out);
      return true;
   }, [run]);
   const travel = useMemo(() => (out: { x: number; z: number }) => {
      out.x = run.hero.vx;
      out.z = run.hero.vz;
   }, [run]);
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run, camera.position.x, camera.position.z, out), [run, camera]);
   return (
      <OrbitCamera
         orbit={orbit}
         pivot={pivot}
         travel={travel}
         solids={solids}
         lookUp={orbitLookUp(aspect)}
         distanceScale={orbitScale(aspect)}
         collision={{ radius: 0.4, minDistance: 1.8 }}
      />
   );
}

function IntroCamera({ run, anim }: { run: CityRun; anim: HeroAnim }) {
   const intro = useShellIntro();
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const keys = useMemo(() => introKeyframes(run.course), [run.course]);
   const play = useMemo(() => playCamera(run.course, aspect), [run.course, aspect]);
   const running = !!intro?.session && !intro.ready;
   useFrame(() => {
      anim.intro = running && intro ? intro.hero.current : Number.NaN;
   }, FRAME_PRIORITY.pose);
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<CitySpec>();
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
   const orbit = useMemo(() => createOrbit(CITY_ORBIT), [run]);
   const won = useRef(false);
   return (
      <JuiceLayer>
         <World course={run.course} levelId={levelId} />
         <Course key={levelId} run={run} clock={clock} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} clock={clock} won={won} orbit={orbit} />
         <CityCamera run={run} orbit={orbit} />
         <IntroCamera run={run} anim={anim} />
         <BossClock run={run} />
      </JuiceLayer>
   );
}

function BossClock({ run }: { run: CityRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, GREYOUT.slowMo.durationMs));
   });
   return null;
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
