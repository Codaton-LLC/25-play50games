"use client";

// Spin Pole Climb's scene: the run (rules.ts) stepped in useRunFrame, the jungle (World), the pole field
// (CourseView), Coilstone (level 5), the hero (menu2/heroAnim), the free orbit camera (menu2/camera: the
// stick is camera-relative through StepInput.yaw = orbit.viewYaw; left alone it swings back out behind
// the hero round his pole), the intro (core/intro) and the juice (menu2/juice): a chime on every lap that
// rises with the chain, a whoosh and a camera swing on every hop, a perfect sweeper hop (a jump that
// clears a bar by a hair) chimes, hits recoil with a kick and a hit-stop, and Coilstone's phases each
// have their own burst, sound and popup. Remounted for every run (runId). Local multiplayer runs render
// MultiScene.tsx instead.
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
import Coilstone from "./Coilstone";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, courseSolids, followPole, heroPivot, introKeyframes, orbitLookUp, orbitScale, playCamera, spinOrbit } from "./camera";
import { STAT, bossVulnerable, createRun, createStepInput, flowOf, floorY, heroAngle, hopTarget, poleOmega, step, type Hop, type SpinRun, type StepEvents } from "./rules";
import { dirTo, msToFlip, neighbours, wrapPi } from "./course";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { SpinLevel } from "./levels";
import { COILSTONE, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import { COLORS } from "./look";
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
const HOP_PROBE: Hop = { active: false, t: 0, fromX: 0, fromY: 0, fromZ: 0, helix: 0, a: 0, cap: false, capA: 0, toX: 0, toY: 0, toZ: 0 };

/** Could the hero hop to a neighbour right now if he pushed towards it? (the HUD prompt) */
export function hopReady(run: SpinRun): boolean {
   const h = run.hero;
   if (h.hop.active || !h.grounded || run.ended !== null) return false;
   const c = run.course;
   const pole = c.poles[c.helices[h.helix].pole];
   const a = heroAngle(run);
   for (const q of neighbours(c, pole.id)) {
      const t = c.poles[q];
      const d = dirTo(pole, t.x, t.z);
      if (Math.abs(wrapPi(a - d)) > 0.5) continue;
      if (hopTarget(run, Math.sin(d), Math.cos(d), HOP_PROBE)) return true;
   }
   return false;
}

export function publishBoss(run: SpinRun): void {
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
export function useSpinJuice() {
   const juice = useJuice();
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   return (run: SpinRun, ev: StepEvents, anim: HeroAnim, now: number, loud = 1) => {
      const h = run.hero;
      const c = run.course;
      chest.x = feet.x = h.x;
      chest.z = feet.z = h.z;
      chest.y = h.y + 1.1;
      feet.y = h.y + 0.05;
      if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.45 * loud });
      }
      if (ev.airJumped) {
         anim.airJumpAt = now;
         juice.burst("dust", feet, 10, { color: "#bfdbfe" });
         playSfx("jump", { pitch: 1.25, volume: 0.6 * loud });
      }
      if (ev.hopped) {
         juice.burst("trail", chest, 14, { color: heroAccent(run.heroId) });
         juice.kick(0, 0.4, 0, 1.6 * loud);
         playSfx("whoosh", { pitch: 0.9, volume: 0.55 * loud });
      }
      if (ev.landed) {
         anim.landAt = now;
         juice.burst("dust", feet, ev.hopLanded ? 14 : 7, { color: "#cdbf9a" });
         if (ev.hopLanded) {
            juice.kick(0, -1, 0, 2.2 * loud);
            juice.hitStop(40);
         }
         playSfx("thud", { volume: (ev.hopLanded ? 0.5 : 0.3) * loud });
      }
      if (ev.laps > 0) {
         juice.burst("pickup", feet, 12, { color: COLORS.moss });
         juice.popup(chest, `Lap! +3 m`, { color: "#bbf7d0", size: 0.05 });
         // the chime rises with the flow chain (the card: the combo counts laps without a hit)
         playSfx("chime", { pitch: 0.9 + Math.min(0.9, run.combo.chain * 0.1), volume: 0.5 * loud });
      }
      if (ev.comboLinked && ev.comboBonus > 0) juice.popup(chest, `Flow x${run.combo.multiplier.toFixed(2)}`, { color: "#fde68a", size: 0.05 });
      if (ev.powered) {
         juice.burst("aura", chest, 16, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.55 * loud, pitch: 1.1 });
      }
      if (ev.shielded) {
         juice.burst("hit", chest, 10, { color: "#86efac" });
         playSfx("click", { pitch: 1.6, volume: 0.5 * loud });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = c.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 14, { color: "#4ade80" });
         juice.popup(o, "-0.1 s", { color: "#bbf7d0" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.08), volume: loud });
      }
      if (ev.urn >= 0) {
         juice.burst("dust", chest, 22, { color: COLORS.urn });
         juice.shake(0.15 * loud);
         playSfx("thud", { pitch: 0.7, volume: 0.6 * loud });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 30, { color: spec.kind === "shard" ? "#c4b5fd" : "#f9a8d4" });
         juice.popup(chest, `${spec.name}!`, { color: "#f9a8d4", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.disc) {
         juice.burst("checkpoint", feet, 40, { color: COLORS.jade });
         juice.popup(chest, "Every pole turns your way! 10 s", { color: "#bbf7d0", size: 0.06 });
         playSfx("combo", { volume: 0.6 * loud });
      }
      if (ev.capReached && !ev.finished) {
         juice.burst("checkpoint", feet, 26, { color: COLORS.gold });
         playSfx("chime", { pitch: 1.2, volume: 0.5 * loud });
      }
      if (ev.hurt !== "") {
         anim.hurtAt = now;
         juice.burst("hit", chest, 18, { color: ev.hurt === "spore" ? COLORS.spore : undefined });
         juice.shake(0.22 * loud);
         juice.hitStop(70);
         if (ev.hurt === "fall") juice.popup(chest, "Fell a lap!", { color: "#fca5a5", size: 0.06 });
         playSfx("hit", { volume: 0.5 * loud });
      }
      if (ev.bossTelegraph) playSfx("whoosh", { pitch: 0.5, volume: 0.4 * loud });
      if (ev.bossAttack && run.boss) {
         juice.popup(chest, run.boss.phase === 0 ? "Coils!" : run.boss.phase === 1 ? "It bites!" : "The pole spins!", { color: "#fecaca", size: 0.07 });
         juice.shake(0.25 * loud);
         playSfx("thud", { pitch: 0.5, volume: 0.7 * loud });
      }
      if (ev.bossHit) {
         juice.burst("hit", chest, 34, { color: "#a78bfa" });
         juice.popup(chest, ev.bossDefeated ? "Coilstone sleeps!" : "Plate cracked!", { color: "#fde68a", size: 0.08 });
         juice.shake(0.32);
         juice.hitStop(90);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossPhase && !ev.bossDefeated && run.boss) juice.popup(chest, COILSTONE.phases[run.boss.phase]?.name ?? "", { color: "#fde68a", size: 0.06 });
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 120, { color: "#34d399" });
         juice.burst("checkpoint", chest, 80, { color: "#ffd36a" });
         juice.shake(0.5);
         juice.hitStop(140);
         playSfx("combo", { pitch: 0.7 });
      }
   };
}

function Simulation({ run, anim, orbit }: { run: SpinRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const effects = useSpinJuice();
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
      const set = (key: string, value: number) => {
         if (store.stats[key] !== value) store.setStat(key, value);
      };
      const h = run.hero;
      const pole = run.course.helices[h.helix].pole;
      const om = poleOmega(run, pole);
      set(STAT.height, Math.max(0, Math.floor(floorY(run))));
      set(STAT.orbs, run.orbs);
      set(STAT.mainOrbs, run.mainOrbs);
      set(STAT.hits, run.hits);
      set(STAT.comboMs, run.combo.bonusTotal);
      set(STAT.comboChain, run.combo.chain);
      set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
      set(STAT.comboFlow, Math.ceil(flowOf(run) * 10));
      set(STAT.hero, HERO_IDS.indexOf(run.heroId));
      set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
      set(STAT.spin, Math.abs(om) < 0.01 ? 0 : om > 0 ? 1 : -1);
      set(STAT.flip, msToFlip(run.course.poles[pole].spin, run.simMs) < 1000 ? 1 : 0);
      set(STAT.hopReady, hopReady(run) ? 1 : 0);
      publishBoss(run);
      if (ev.finished) {
         anim.winAt = now;
         if (!ev.bossDefeated) {
            juice.burst("checkpoint", h, 110);
            juice.burst("pickup", h, 40, { color: "#ffd36a" });
            juice.popup(h, "On top!", { color: "#fde68a", size: 0.09 });
         }
         juice.shake(0.2);
         playSfx("chime", { pitch: 0.75 });
         set(STAT.finishMs, run.finishMs);
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

/** The orbit camera round the hero; left alone it swings out behind him round his pole (followPole). */
function SpinCamera({ run, orbit }: { run: SpinRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const time = useGameTime();
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   useFrame(() => {
      const h = run.hero;
      if (run.ended !== null) return;
      // the hop: follow the landing pole's side; otherwise the hero's own angle round his pole
      const a = h.hop.active ? (h.hop.cap ? h.hop.capA : h.hop.a) : heroAngle(run);
      followPole(orbit, a, Math.min(0.05, time.delta));
   }, FRAME_PRIORITY.camera - 0.01);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         heroPivot(run.hero, out);
         return true;
      },
      [run],
   );
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run, camera.position.x, camera.position.y, camera.position.z, out), [run, camera]);
   return <OrbitCamera orbit={orbit} pivot={pivot} solids={solids} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={COLLISION} />;
}

const COLLISION = { radius: 0.35, minDistance: 4 };

/** Coilstone's slow-mo finish: the visuals only (menu2/boss through the juice clock). */
function BossSlowMo({ run }: { run: SpinRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, COILSTONE.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: SpinRun; anim: HeroAnim }) {
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
      juice.burst("dust", h, 18, { color: "#cdbf9a" });
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
   const { config } = useLevel<SpinLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(spinOrbit(run.course)), [run]);
   return (
      <JuiceLayer>
         <World run={run} />
         <Course key={levelId} run={run} />
         <Coilstone run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <SpinCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
