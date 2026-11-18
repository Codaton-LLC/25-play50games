"use client";

// Roll Cannon Jump's scene: the run (rules.ts) stepped in useRunFrame, the big top (World), the show
// (Course), the hero (menu2/heroAnim), the free orbit camera (menu2/camera: it swings in behind each
// barrel; the nudge and the walk are camera-relative through StepInput.yaw, the barrel turns with the
// raw stick), the intro (core/intro), and the juice (menu2/juice): a barrel-recoil camera kick and a
// smoke puff on every shot, a 0.3 s slow-mo feel (hit-stop) on a perfect 100 % shot, a trail ribbon in
// the hero's colour in flight, the catch thump, trampoline boings, balloon pops, the crowd's cheer as a
// band turns red, the drumroll ticks while aiming, Ashbag's hits and its slow-mo finish with confetti.
// Remounted for every run (runId). Local multiplayer runs render MultiScene.tsx instead.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit, orbitRecenter, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import World from "./World";
import { Course, type VisualClock } from "./Course";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, aimPivot, cannonOrbit, courseSolids, flightPivot, introKeyframes, orbitLookUp, orbitScale, playCamera } from "./camera";
import { ORB, STAT, bossVulnerable, createRun, createStepInput, pulseAt, step, type CannonRun, type StepEvents } from "./rules";
import { forwardX, forwardZ } from "./show";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { CannonLevel } from "./levels";
import { ASHBAG, COMBO, SECRETS } from "./progression";
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

const HERO_IDS = ["riko", "nami", "kiro", "zuno", "vexa"] as const;

export function publishBoss(run: CannonRun): void {
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

/** The juice and sounds of one step's events (solo and, quieter, multiplayer). */
export function useShowJuice() {
   const juice = useJuice();
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   return (run: CannonRun, ev: StepEvents, anim: HeroAnim, now: number, loud = 1) => {
      const h = run.hero;
      chest.x = feet.x = h.x;
      chest.z = feet.z = h.z;
      chest.y = h.y;
      feet.y = h.y - 0.45;
      if (ev.fired) {
         anim.firedAt = now;
         const fx = forwardX(h.facing);
         const fz = forwardZ(h.facing);
         juice.burst("dust", { x: h.x - fx * 0.4, y: h.y, z: h.z - fz * 0.4 }, 16, { color: "#d6cfc4" });
         juice.burst("hit", chest, 10, { color: "#ffcf6e" });
         juice.kick(-fx, 0.2, -fz, 3.2 * loud);
         juice.shake(0.12 * loud);
         if (ev.perfect) {
            juice.hitStop(130);
            juice.popup(chest, "PERFECT!", { color: "#fff3b0", size: 0.08 });
            playSfx("chime", { pitch: 1.6, volume: 0.6 * loud });
         }
         playSfx("boom", { pitch: 0.7 + ev.pulse * 0.4, volume: 0.7 * loud });
         playSfx("whoosh", { pitch: 1.1, volume: 0.45 * loud });
      }
      if (ev.caught >= 0) {
         juice.burst("dust", chest, 10, { color: "#efe3cc" });
         juice.kick(0, -1, 0, 1.4 * loud);
         if (!ev.mounted) juice.hitStop(60);
         playSfx("pop", { pitch: 0.8, volume: 0.6 * loud });
      }
      if (ev.bounced >= 0) {
         juice.burst("dust", feet, 12, { color: "#f6c453" });
         juice.kick(0, 1, 0, 2.4 * loud);
         playSfx("jump", { pitch: 0.75, volume: 0.7 * loud });
      }
      if (ev.balloon >= 0) {
         juice.burst("hit", chest, 26, { color: "#f9a8d4" });
         juice.popup(chest, "Pop! Re-aim", { color: "#fde68a", size: 0.06 });
         juice.hitStop(50);
         playSfx("pop", { pitch: 1.4, volume: 0.8 * loud });
      }
      if (ev.landed >= 0) {
         anim.landAt = now;
         juice.burst("dust", feet, 12, { color: "#d9cdb7" });
         juice.kick(0, -1, 0, 1.6 * loud);
         playSfx("thud", { volume: 0.5 * loud });
      }
      if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.5 * loud });
      }
      if (ev.airJumped) {
         anim.airJumpAt = now;
         juice.burst("dust", feet, 10, { color: "#bfdbfe" });
         playSfx("jump", { pitch: 1.25, volume: 0.6 * loud });
      }
      if (ev.dove) playSfx("whoosh", { pitch: 0.7, volume: 0.5 * loud });
      if (ev.powered) {
         juice.burst("aura", chest, 14, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.55 * loud, pitch: 1.15 });
      }
      if (ev.boardBroken >= 0) {
         const b = run.course.boards[ev.boardBroken];
         juice.burst("hit", b, 30, { color: "#e9dcc2" });
         juice.burst("dust", b, 18, { color: "#b23a30" });
         juice.popup(b, "Smash! Hidden cannon", { color: "#fca5a5", size: 0.06 });
         juice.shake(0.25 * loud);
         juice.hitStop(70);
         playSfx("thud", { pitch: 1.3 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = run.course.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 14, { color: o.kind === "bonus" ? heroAccent(run.heroId) : undefined });
         juice.popup(o, `-${(ORB.bonusMs / 1000).toFixed(1)} s`, { color: "#ffe08a" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.03), volume: loud });
      }
      if (ev.hoop >= 0) {
         const hp = run.course.hoops[ev.hoop];
         juice.burst("pickup", hp, 24, { color: "#ff8a2a" });
         juice.popup(hp, "Fire hoop!", { color: "#ffb347", size: 0.06 });
         playSfx("chime", { pitch: 1.3, volume: 0.6 * loud });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spot = run.course.secrets[ev.secretList[k]];
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", spot, 30, { color: spec.kind === "shard" ? "#fca5a5" : "#f9a8d4" });
         juice.popup(spot, `${spec.name}!`, { color: "#f9a8d4", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.crowd >= 0) playSfx("combo", { pitch: 1.2, volume: 0.25 * loud });
      if (ev.comboLinked && run.combo.chain > 1) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.4 * loud });
      if (ev.jam >= 0) {
         const c = run.course.cannons[ev.jam];
         juice.burst("dust", c, 30, { color: "#6f6a66" });
         juice.popup(c, "Jammed!", { color: "#cbd5e1", size: 0.06 });
         playSfx("thud", { pitch: 0.6 });
      }
      if (ev.bossTelegraph) playSfx("whoosh", { pitch: 0.5, volume: 0.35 * loud });
      if (ev.bossHit) {
         juice.burst("hit", chest, 34, { color: "#fef08a" });
         if (ev.bossPod >= 0) juice.burst("dust", chest, 30, { color: "#9aa0a6" });
         juice.popup(chest, ev.bossPod >= 0 ? "Pod popped!" : "Hit!", { color: "#fde68a", size: 0.07 });
         juice.shake(0.32);
         juice.hitStop(90);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 120, { color: "#ef4444" });
         juice.burst("checkpoint", chest, 80, { color: "#fde68a" });
         juice.popup(chest, "Ashbag deflates!", { color: "#fecaca", size: 0.09 });
         juice.shake(0.5);
         juice.hitStop(140);
      }
      if (ev.lost) {
         anim.lostAt = now;
         juice.burst(run.hero.lostWhy === "smoke" ? "dust" : "hit", chest, 18, { color: run.hero.lostWhy === "smoke" ? "#9aa0a6" : undefined });
         juice.shake(0.22 * loud);
         juice.hitStop(70);
         playSfx("lose", { volume: 0.45 * loud });
      }
      if (ev.respawned) {
         anim.spawnAt = now;
         juice.burst("pickup", chest, 20, { color: heroAccent(run.heroId) });
         juice.popup(chest, "Back in the cannon", { color: "#fca5a5", size: 0.05 });
         playSfx("pop");
      }
   };
}

function Simulation({ run, anim, clock, orbit }: { run: CannonRun; anim: HeroAnim; clock: VisualClock; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const trail = useMemo(createJuiceEmitter, []);
   const effects = useShowJuice();
   const lastAim = useRef(-1);
   const lastTick = useRef(-1);
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
         bot.frameMs = lastFrame.current;
         botInput(bot, run, stepInput);
      }
      lastFrame.current = dt * 1000;
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const h = run.hero;
      const now = time.now;
      effects(run, ev, anim, now);
      if (h.mode === "fly") juice.stream("trail", h, 40, trail, { color: heroAccent(run.heroId) });
      // a new aim: the camera swings in behind the barrel; the drumroll ticks with the ring
      if (h.mode === "aim") {
         if (h.aimFrom !== lastAim.current) {
            lastAim.current = h.aimFrom;
            orbitRecenter(orbit, h.yaw);
         }
         const tick = Math.floor((run.simMs - h.aimFrom) / 150);
         if (tick !== lastTick.current) {
            lastTick.current = tick;
            playSfx("click", { pitch: 0.7 + pulseAt(run.simMs - h.aimFrom) * 0.6, volume: 0.18 });
         }
      }
      if (ev.orbCount > 0) {
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
      }
      if (ev.comboBonus > 0) store.setStat(STAT.comboMs, run.combo.bonusTotal);
      if (ev.lost) store.setStat(STAT.falls, run.hits);
      if (ev.fired) store.setStat(STAT.shots, run.shots);
      const flow = Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10);
      if (store.stats[STAT.comboChain] !== run.combo.chain) store.setStat(STAT.comboChain, run.combo.chain);
      const mult = Math.round(run.combo.multiplier * 100);
      if (store.stats[STAT.comboMult] !== mult) store.setStat(STAT.comboMult, mult);
      if (store.stats[STAT.comboFlow] !== flow) store.setStat(STAT.comboFlow, flow);
      const c = h.cannon >= 0 ? run.course.cannons[h.cannon] : null;
      const aiming = h.mode === "aim" ? 1 : 0;
      const pulse = aiming ? Math.round((!c || c.kind === "aim" ? pulseAt(run.simMs - h.aimFrom) : c.power) * 100) : 0;
      if (store.stats[STAT.aiming] !== aiming) store.setStat(STAT.aiming, aiming);
      if (store.stats[STAT.pulse] !== pulse) store.setStat(STAT.pulse, pulse);
      publishBoss(run);
      const heroStat = HERO_IDS.indexOf(run.heroId);
      if (store.stats[STAT.hero] !== heroStat) store.setStat(STAT.hero, heroStat);
      const powerLeft = Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000));
      if (store.stats[STAT.power] !== powerLeft) store.setStat(STAT.power, powerLeft);
      if (ev.finished) {
         anim.winAt = now;
         if (!ev.bossDefeated) {
            juice.burst("checkpoint", h, 110);
            juice.burst("pickup", h, 40, { color: "#f6c453" });
            juice.popup(h, "Show over!", { color: "#fde68a", size: 0.09 });
         }
         juice.shake(0.2);
         playSfx("chime", { pitch: 0.75 });
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
         store.setStat(STAT.finishMs, run.finishMs);
         store.setStat(STAT.comboMs, run.combo.bonusTotal);
         store.setStat(STAT.shots, run.shots);
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
      if (s.phase === "countdown") clock.ms = 0;
      else if (s.phase === "ready") clock.ms = time.now * 1000;
      else clock.ms = run.simMs;
   }, FRAME_PRIORITY.camera);
   return null;
}

/** The orbit camera round the hero: behind the barrel while aiming, led along the flight. */
function ShowCamera({ run, orbit, clock }: { run: CannonRun; orbit: OrbitState; clock: VisualClock }) {
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
         if (h.mode === "lost" && h.y < run.course.killY + 2) return false;
         if (h.mode === "aim" || h.mode === "catch") aimPivot(h.x, h.y, h.z, h.yaw, out);
         else flightPivot(h.x, h.y, h.z, h.mode === "fly" ? h.vx : 0, h.mode === "fly" ? h.vy : 0, h.mode === "fly" ? h.vz : 0, out);
         return true;
      },
      [run],
   );
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         const h = run.hero;
         if (h.mode === "aim" || h.mode === "catch") {
            out.x = forwardX(h.yaw) * 5;
            out.z = forwardZ(h.yaw) * 5;
         } else if (h.mode === "fly" || h.mode === "walk") {
            out.x = h.vx;
            out.z = h.vz;
         }
      },
      [run],
   );
   const behind = useMemo(() => () => (run.hero.mode === "aim" || run.hero.mode === "catch" ? run.hero.yaw : null), [run]);
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run, clock.ms, camera.position.x, camera.position.y, camera.position.z, out), [run, clock, camera]);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} behind={behind} solids={solids} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={COLLISION} />;
}

const COLLISION = { radius: 0.35, minDistance: 2 };

/** Ashbag's slow-mo finish: the visuals only (menu2/boss through the juice clock). */
function BossSlowMo({ run }: { run: CannonRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, ASHBAG.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: CannonRun; anim: HeroAnim }) {
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
      juice.burst("dust", h, 18, { color: "#efe3cc" });
      juice.burst("pickup", h, 16, { color: heroAccent(run.heroId) });
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
   const { config } = useLevel<CannonLevel>();
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
   const orbit = useMemo(() => createOrbit(cannonOrbit(run.course)), [run]);
   return (
      <JuiceLayer>
         <World run={run} />
         <Course key={levelId} run={run} clock={clock} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} clock={clock} orbit={orbit} />
         <ShowCamera run={run} orbit={orbit} clock={clock} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
