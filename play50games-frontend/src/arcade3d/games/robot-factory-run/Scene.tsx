"use client";

// Robot Factory Run's scene: the run (rules.ts) stepped in useRunFrame, the hall (World), the line
// (Course), the hero (menu2/heroAnim), the free orbit camera (menu2/camera; movement is camera-
// relative through StepInput.yaw), the intro (core/intro), and the juice (menu2/juice): a turntable
// clunk with sparks and a camera micro-kick, the charger's rising tone per cell, a press slam's dust
// and hit-stop, scrap sparks, the klaxon, arm lifts, crate smashes, M-8's punches, hits and its
// slow-mo finish. Remounted for every run (runId). Local multiplayer runs render MultiScene.tsx.
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
import { Course } from "./Course";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FACTORY_ORBIT, FOV, FOV_PORTRAIT, factorySolids, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { ORB, STAT, bossVulnerable, createRun, createStepInput, klaxonOn, step, type FactoryRun, type StepEvents } from "./rules";
import { tileX, tileZ } from "./factory";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { FactoryLevel } from "./levels";
import { COMBO, OVERSEER, SECRETS } from "./progression";
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

const HERO_IDS = ["riko", "nami", "kiro", "zuno", "vexa"] as const;

export function publishRun(run: FactoryRun): void {
   const s = useArcadeStore.getState();
   const b = run.boss;
   const set = (k: string, v: number) => {
      if (s.stats[k] !== v) s.setStat(k, v);
   };
   set(STAT.cells, run.board.charged);
   set(STAT.scrap, run.board.scrapped);
   set(STAT.orbs, run.orbs);
   set(STAT.mainOrbs, run.mainOrbs);
   set(STAT.hero, HERO_IDS.indexOf(run.heroId));
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
   set(STAT.klaxon, klaxonOn(run.floor, run.board.ms) ? 1 : 0);
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10));
   set(STAT.comboMs, run.combo.bonusTotal);
   set(STAT.falls, run.hits);
   if (b) {
      set(STAT.bossHp, b.hp);
      set(STAT.bossPhase, b.phase);
      set(STAT.bossOpen, bossVulnerable(run) ? 1 : 0);
      set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
   }
}

/** The juice and sounds of one step's events (solo, and quieter in multiplayer). */
export function useFactoryJuice() {
   const juice = useJuice();
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const spot = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   return (run: FactoryRun, ev: StepEvents, loud = 1) => {
      const h = run.hero;
      const f = run.floor;
      chest.x = h.x;
      chest.y = h.y + 0.7;
      chest.z = h.z;
      if (ev.turned >= 0) {
         const [c, r] = f.turnAt[ev.turned];
         spot.x = tileX(c);
         spot.y = 0.4;
         spot.z = tileZ(r);
         juice.burst("hit", spot, 14, { color: "#ffb36b" });
         juice.kick(0, -1, 0, 0.8 * loud);
         playSfx("thud", { pitch: 1.5, volume: 0.6 * loud });
      }
      if (ev.plate >= 0) playSfx("click", { volume: 0.5 * loud });
      if (ev.emitted) {
         const [c, r] = f.dispenser;
         spot.x = tileX(c);
         spot.y = 0.6;
         spot.z = tileZ(r);
         juice.burst("dust", spot, 6, { color: "#ffb3a0" });
         playSfx("pop", { pitch: 0.8, volume: 0.35 * loud });
      }
      if (ev.charged) {
         const [c, r] = f.charger;
         spot.x = tileX(c);
         spot.y = 1.4;
         spot.z = tileZ(r);
         juice.burst("checkpoint", spot, 34, { color: "#ff7a45" });
         juice.popup(spot, `Cell ${run.board.charged}/${f.spec.cells}`, { color: "#ffd2a8", size: 0.07 });
         playSfx("chime", { pitch: 0.8 + run.board.charged * 0.18 });
      }
      if (ev.exitOpen) {
         const [c, r] = f.exit;
         spot.x = tileX(c);
         spot.y = 1.5;
         spot.z = tileZ(r);
         juice.burst("checkpoint", spot, 50);
         juice.popup(spot, "Exit open!", { color: "#fde68a", size: 0.08 });
         playSfx("win", { volume: 0.6 });
      }
      if (ev.secretCharged) playSfx("chime", { pitch: 1.6 });
      if (ev.scrap) {
         juice.shake(0.08 * loud);
         playSfx("buzz", { volume: 0.35 * loud });
      }
      if (ev.armLift >= 0) playSfx("whoosh", { pitch: 0.7, volume: 0.5 * loud });
      if (ev.heroLifted) juice.popup(chest, "Up you go!", { color: "#fde68a", size: 0.06 });
      if (ev.klaxon) playSfx("alarm", { volume: 0.4 * loud });
      if (ev.jumped) playSfx("jump", { volume: 0.5 * loud });
      if (ev.airJumped) {
         juice.burst("dust", chest, 10, { color: "#bfdbfe" });
         playSfx("jump", { pitch: 1.25, volume: 0.6 * loud });
      }
      if (ev.dropped) playSfx("whoosh", { pitch: 0.6, volume: 0.5 * loud });
      if (ev.landed) juice.burst("dust", { x: h.x, y: h.y + 0.1, z: h.z }, 8, { color: "#a8a29e" });
      if (ev.powered) {
         juice.burst("aura", chest, 14, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { pitch: 1.15, volume: 0.55 * loud });
      }
      if (ev.flicked) juice.popup(chest, "Flick!", { color: "#fca5a5", size: 0.06 });
      if (ev.crateBroken) {
         juice.burst("hit", chest, 28, { color: "#a16207" });
         juice.shake(0.25 * loud);
         juice.hitStop(60);
         playSfx("boom", { pitch: 1.3, volume: 0.6 });
      }
      if (ev.unjammed) juice.popup(chest, "Unjammed!", { color: "#fde68a", size: 0.06 });
      for (let k = 0; k < ev.orbCount; k++) {
         const o = f.spec.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 14, { color: o.hero ? heroAccent(run.heroId) : "#ff8a6a" });
         juice.popup(o, `-${(ORB.bonusMs / 1000).toFixed(1)} s`, { color: "#ffe08a" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.04), volume: loud });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const i = ev.secretList[k];
         const [x, y, z] = f.spec.secrets[i];
         const p = { x, y, z };
         juice.burst("checkpoint", p, 30, { color: "#f9a8d4" });
         juice.popup(p, `${SECRETS[run.level][i].name}!`, { color: "#f9a8d4", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.comboLinked && run.combo.chain > 1) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.4 * loud });
      if (ev.hurt) {
         juice.burst("hit", chest, 20);
         juice.shake(0.28 * loud);
         juice.hitStop(80);
         playSfx("lose", { volume: 0.45 * loud });
      }
      if (ev.punched >= 0) {
         const [c, r] = f.turnAt[ev.punched];
         spot.x = tileX(c);
         spot.y = 0.6;
         spot.z = tileZ(r);
         juice.burst("hit", spot, 26, { color: "#9ca3af" });
         juice.popup(spot, "Jammed!", { color: "#cbd5e1", size: 0.07 });
         juice.shake(0.3);
         playSfx("boom", { pitch: 0.7, volume: 0.7 });
      }
      if (ev.bossTelegraph) playSfx("alarm", { pitch: 0.7, volume: 0.3 * loud });
      if (ev.slam) {
         juice.shake(0.45);
         juice.hitStop(110);
         playSfx("boom", { pitch: 0.5 });
      }
      if (ev.bossHit) {
         juice.burst("hit", chest, 34, { color: "#fef08a" });
         juice.popup(chest, "Hit!", { color: "#fde68a", size: 0.08 });
         juice.shake(0.32);
         juice.hitStop(90);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 120, { color: "#ef4444" });
         juice.popup(chest, "M-8 powers down!", { color: "#fecaca", size: 0.09 });
         juice.shake(0.5);
         juice.hitStop(140);
      }
   };
}

function Simulation({ run, anim, orbit }: { run: FactoryRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const effects = useFactoryJuice();
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
      effects(run, ev);
      publishRun(run);
      const store = useArcadeStore.getState();
      if (ev.finished) {
         anim.winAt = time.now;
         if (!ev.bossDefeated) {
            juice.burst("checkpoint", { x: run.hero.x, y: 1, z: run.hero.z }, 100);
            juice.popup({ x: run.hero.x, y: 1.6, z: run.hero.z }, "Line restored!", { color: "#fde68a", size: 0.09 });
         }
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
   return null;
}

function FactoryCamera({ run, orbit }: { run: FactoryRun; orbit: OrbitState }) {
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
         orbitPivot(h.x, h.y, h.z, out);
         return true;
      },
      [run],
   );
   const solids = useMemo(() => (out: AABB[]) => factorySolids(run, camera.position.x, camera.position.y, camera.position.z, out), [run, camera]);
   return <OrbitCamera orbit={orbit} pivot={pivot} solids={solids} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={COLLISION} />;
}

const COLLISION = { radius: 0.35, minDistance: 2.5 };

function BossSlowMo({ run }: { run: FactoryRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, OVERSEER.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: FactoryRun; anim: HeroAnim }) {
   const intro = useShellIntro();
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const keys = useMemo(() => introKeyframes(run.floor), [run.floor]);
   const play = useMemo(() => playCamera(run.floor, aspect), [run.floor, aspect]);
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
      juice.burst("dust", { x: h.x, y: 0.1, z: h.z }, 18, { color: "#a8a29e" });
      juice.burst("pickup", { x: h.x, y: 0.5, z: h.z }, 16, { color: heroAccent(run.heroId) });
      juice.kick(0, -1, 0, 4);
      juice.shake(0.25);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<FactoryLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(FACTORY_ORBIT), [run]);
   return (
      <JuiceLayer>
         <World run={run} />
         <Course key={levelId} run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <FactoryCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
