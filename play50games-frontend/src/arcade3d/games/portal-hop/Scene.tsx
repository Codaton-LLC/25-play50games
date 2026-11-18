"use client";

// Rift Hop's scene: the run (rules.ts) stepped in useRunFrame, the void (World), the islands and
// portals (CourseView), the Rift Serpent (level 5), the hero (menu2/heroAnim), the free orbit camera
// (menu2/camera: the stick is camera-relative through StepInput.yaw = orbit.viewYaw; through a portal it
// keeps your facing and turns at most 90 degrees), the intro (core/intro) and the juice (menu2/juice):
// a swirl and a speed-line burst out of every exit with a whoosh whose pitch rises with the speed, a
// chime when an exit finishes moving, a "Perfect Fling" ping on a landing inside the goal ring straight
// out of a fling, hits that recoil with a kick and a hit-stop, and the Wyrm's own bursts and popups.
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
import Wyrm from "./Wyrm";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, afterTeleport, courseSolids, heroPivot, introKeyframes, orbitLookUp, orbitScale, playCamera, portalOrbit } from "./camera";
import { STAT, bossVulnerable, createRun, createStepInput, flowOf, heroSpeed, nearestPair, pairOpen, step, type PortalRun, type StepEvents } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { PortalLevel } from "./levels";
import { SECRETS, WYRM } from "./progression";
import { levelEndStats } from "./levelEnd";
import { COLORS } from "./look";
import { cycleLatch, pickLatch } from "./latch";
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

export function publishBoss(run: PortalRun): void {
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
export function usePortalJuice() {
   const juice = useJuice();
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   return (run: PortalRun, ev: StepEvents, anim: HeroAnim, now: number, loud = 1) => {
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
      if (ev.teleported) {
         // the swirl and the speed-line burst out of the exit; the whoosh rises with the speed
         juice.burst("aura", chest, 22, { color: COLORS.exit });
         juice.burst("trail", chest, 16 + Math.round(ev.exitSpeed), { color: heroAccent(run.heroId) });
         juice.kick(h.vx * 0.04, h.vy * 0.04, h.vz * 0.04, 1.4 * loud);
         if (ev.exitSpeed >= 14) juice.popup(chest, `${Math.round(ev.exitSpeed)} m/s!`, { color: "#a5f3fc", size: 0.06 });
         playSfx("whoosh", { pitch: 0.7 + Math.min(1, ev.exitSpeed / 24) * 0.8, volume: 0.6 * loud });
      }
      if (ev.ghostPass) {
         juice.burst("aura", chest, 18, { color: COLORS.purple });
         juice.popup(chest, "Phased through!", { color: "#e9d5ff", size: 0.05 });
         playSfx("whoosh", { pitch: 1.4, volume: 0.4 * loud });
      }
      if (ev.closedPass) playSfx("click", { pitch: 0.6, volume: 0.4 * loud });
      if (ev.switched >= 0) playSfx("click", { pitch: 1.2, volume: 0.45 * loud });
      if (ev.opened >= 0) playSfx("chime", { pitch: 1.5, volume: 0.3 * loud });
      if (ev.landed) {
         anim.landAt = now;
         const hard = ev.landSpeed > 12;
         juice.burst("dust", feet, hard ? 16 : 7, { color: "#c4b5fd" });
         if (hard) {
            juice.kick(0, -1, 0, 2.2 * loud);
            juice.hitStop(40);
         }
         const g = c.goal;
         if (g && hard && Math.hypot(h.x - g.x, h.z - g.z) <= g.r + 0.5) {
            juice.popup(chest, "Perfect Fling!", { color: "#fde68a", size: 0.08 });
            playSfx("combo", { pitch: 1.3, volume: 0.6 * loud });
         }
         playSfx("thud", { volume: (hard ? 0.55 : 0.3) * loud });
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
         juice.burst("pickup", o, 14, { color: COLORS.orb });
         juice.popup(o, "-0.1 s", { color: "#e9d5ff" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.08), volume: loud });
      }
      if (ev.blockPorted) playSfx("whoosh", { pitch: 0.6, volume: 0.45 * loud });
      if (ev.blockLost) juice.popup(chest, "The crystal fell into the void", { color: "#fca5a5", size: 0.05 });
      if (ev.plate >= 0) {
         const p = c.plates[ev.plate];
         juice.burst("checkpoint", p, 40, { color: COLORS.plate });
         juice.popup(chest, "The bridge rises!", { color: "#fde68a", size: 0.07 });
         playSfx("combo", { volume: 0.6 * loud });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 30, { color: spec.kind === "shard" ? "#c4b5fd" : "#f9a8d4" });
         juice.popup(chest, `${spec.name}!`, { color: "#f9a8d4", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.hurt !== "") {
         anim.hurtAt = now;
         juice.burst("hit", chest, 18);
         juice.shake(0.22 * loud);
         juice.hitStop(70);
         if (ev.hurt === "fall") juice.popup(chest, "Lost in the void!", { color: "#fca5a5", size: 0.06 });
         playSfx("hit", { volume: 0.5 * loud });
      }
      if (ev.bossTelegraph) playSfx("whoosh", { pitch: 0.5, volume: 0.4 * loud });
      if (ev.bossAttack) {
         juice.popup(chest, "Its tail sweeps: jump!", { color: "#fecaca", size: 0.07 });
         juice.shake(0.2 * loud);
         playSfx("thud", { pitch: 0.5, volume: 0.7 * loud });
      }
      if (ev.wyrmDive) {
         juice.popup(chest, "It dives into the west rift!", { color: "#e9d5ff", size: 0.06 });
         playSfx("whoosh", { pitch: 0.45, volume: 0.6 * loud });
      }
      if (ev.wyrmBonk >= 0) {
         const b = c.beacons[ev.wyrmBonk];
         juice.burst("hit", { x: b.x, y: b.y + 2, z: b.z }, 40, { color: COLORS.beacon });
      }
      if (ev.wyrmKnot) {
         juice.popup(chest, "It is tied in a knot! Touch its head!", { color: "#fde68a", size: 0.07 });
         playSfx("combo", { pitch: 0.8 });
      }
      if (ev.bossHit) {
         juice.burst("hit", chest, 34, { color: COLORS.wyrmGlow });
         juice.popup(chest, ev.bossDefeated ? "The Serpent is free of the void!" : "Plate cracked!", { color: "#fde68a", size: 0.08 });
         juice.shake(0.32);
         juice.hitStop(90);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossPhase && !ev.bossDefeated && run.boss) juice.popup(chest, WYRM.phases[run.boss.phase]?.name ?? "", { color: "#fde68a", size: 0.06 });
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 120, { color: COLORS.purple });
         juice.burst("checkpoint", chest, 80, { color: COLORS.cyan });
         juice.shake(0.5);
         juice.hitStop(140);
         playSfx("combo", { pitch: 0.7 });
      }
   };
}

function Simulation({ run, anim, orbit }: { run: PortalRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const effects = usePortalJuice();
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
      stepInput.digit = i.digit ?? 0;
      stepInput.cyclePressed = cycleLatch.pressed;
      stepInput.pick = pickLatch.anchor;
      cycleLatch.pressed = false;
      pickLatch.anchor = -1;
      if (bot) {
         bot.frameMs = lastFrame.current;
         botInput(bot, run, stepInput);
      }
      lastFrame.current = dt * 1000;
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const now = time.now;
      effects(run, ev, anim, now);
      if (ev.teleported) afterTeleport(orbit, run.hero.vx, run.hero.vz);
      const set = (key: string, value: number) => {
         if (store.stats[key] !== value) store.setStat(key, value);
      };
      const pair = nearestPair(run);
      set(STAT.orbs, run.orbs);
      set(STAT.mainOrbs, run.mainOrbs);
      set(STAT.hits, run.hits);
      set(STAT.speed, Math.round(heroSpeed(run)));
      set(STAT.switches, run.switches);
      set(STAT.pair, pair);
      set(STAT.pairAnchor, pair >= 0 ? run.sel[pair] + 1 : 0);
      set(STAT.pairCount, pair >= 0 ? run.course.pairs[pair].anchors.length : 0);
      set(STAT.pairMoving, pair >= 0 && !pairOpen(run, pair) ? 1 : 0);
      set(STAT.comboMs, run.combo.bonusTotal);
      set(STAT.comboChain, run.combo.chain);
      set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
      set(STAT.comboFlow, Math.ceil(flowOf(run) * 10));
      set(STAT.hero, HERO_IDS.indexOf(run.heroId));
      set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
      publishBoss(run);
      if (ev.finished) {
         const h = run.hero;
         anim.winAt = now;
         if (!ev.bossDefeated) {
            juice.burst("checkpoint", h, 110, { color: COLORS.cyan });
            juice.burst("pickup", h, 40, { color: COLORS.gold });
            juice.popup(h, "Through!", { color: "#fde68a", size: 0.09 });
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

/** The orbit camera round the hero; left alone it swings in behind his travel. */
function PortalCamera({ run, orbit }: { run: PortalRun; orbit: OrbitState }) {
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
         out.x = run.hero.vx;
         out.z = run.hero.vz;
      },
      [run],
   );
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run, camera.position.x, camera.position.y, camera.position.z, out), [run, camera]);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} solids={solids} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={COLLISION} />;
}

const COLLISION = { radius: 0.35, minDistance: 3.5 };

/** The Wyrm's slow-mo finish: the visuals only (menu2/boss through the juice clock). */
function BossSlowMo({ run }: { run: PortalRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, WYRM.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: PortalRun; anim: HeroAnim }) {
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
      juice.burst("dust", h, 18, { color: "#c4b5fd" });
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
   const { config } = useLevel<PortalLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(portalOrbit(run.course)), [run]);
   return (
      <JuiceLayer>
         <World run={run} />
         <Course key={levelId} run={run} />
         <Wyrm run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <PortalCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
