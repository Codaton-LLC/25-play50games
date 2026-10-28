"use client";

// Color Door Sprint's scene: the run (rules.ts) stepped in useRunFrame, the hall (World.tsx), the doors
// and props (Course.tsx), the hero (Hero.tsx, menu2/heroAnim), the free orbit camera (menu2/camera:
// two fingers / mouse drag / wheel / pinch; lane presses are camera-relative through StepInput.yaw;
// one finger stays a swipe), the intro (core/intro) and the juice (menu2/juice): each true door bursts
// into red sparks with a chime that climbs through the combo; a wrong door thuds with a camera kick and
// a grey dust puff; every lamp chimes its colour as it comes into view (the sound rule) and swings when
// the rule changes; speed lines at 15 m/s and up; Flicker's hits, his slow-mo finish (visual only).
// Remounted for every run (runId). Local multiplayer runs (2-4 heroes) render MultiScene.tsx.
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
import { DOOR_ORBIT, FOV, FOV_PORTRAIT, courseSolids, introKeyframes, orbitLookUp, orbitPivot, orbitScale, orbitTravel, playCamera } from "./camera";
import { DOOR_COLORS } from "./halls";
import { ORB, STAT, WALL, bossVulnerable, createRun, createStepInput, distanceOf, lampInView, step, type DoorRun, type StepEvents } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { DoorLevel } from "./levels";
import { COMBO, FLICKER, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import MultiScene from "./MultiScene";

/** Preview builds only: `?autoplay=1` lets the honest bot (bot.ts) run, for screenshots and checks. */
function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

const LAMP = { color: -1, mode: 0, echo: false, wall: -1 };
const HERO_STAT = { riko: 0, nami: 1, kiro: 2, zuno: 3, vexa: 4 } as const;

/** Publishes the HUD's numbers that change every frame (only when they change). */
export function publishRun(run: DoorRun): void {
   const store = useArcadeStore.getState();
   const h = run.hero;
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   set(STAT.distance, Math.round(distanceOf(run)));
   set(STAT.speed, Math.round(h.v * 10));
   set(STAT.hero, HERO_STAT[run.heroId]);
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
   set(STAT.walls, run.trueDoors);
   set(STAT.wrong, run.wrong);
   set(STAT.streak, run.streak);
   set(STAT.rush, run.rushReady ? 1 : 0);
   set(STAT.rushStreak, run.rushStreak);
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10));
   lampInView(run, LAMP);
   set(STAT.lampColor, LAMP.color);
   set(STAT.lampMode, LAMP.mode);
   set(STAT.lampEcho, LAMP.echo ? 1 : 0);
   const b = run.boss;
   if (b) {
      set(STAT.bossOn, run.bossOn ? 1 : 0);
      set(STAT.bossHp, b.hp);
      set(STAT.bossPhase, b.phase);
      set(STAT.bossOpen, bossVulnerable(run) ? 1 : 0);
      set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
   }
}

/** The juice and sounds of one step's events (shared with MultiScene; `tag` prefixes popups there). */
export function juiceEvents(run: DoorRun, ev: StepEvents, anim: HeroAnim, juice: ReturnType<typeof useJuice>, now: number, tag = ""): void {
   const h = run.hero;
   const chest = { x: h.x, y: h.y + 1.1, z: h.z };
   const feet = { x: h.x, y: h.y + 0.2, z: h.z };
   if (ev.airJumped) {
      anim.airJumpAt = now;
      juice.burst("dust", feet, 12, { color: "#fde68a" });
      playSfx("jump", { volume: 0.6, pitch: 1.25 });
   } else if (ev.jumped) {
      anim.jumpAt = now;
      juice.burst("dust", feet, 10, { color: "#d6c4b4" });
      playSfx("jump", { volume: 0.5 });
   }
   if (ev.landed) {
      anim.landAt = now;
      juice.burst("dust", feet, 8, { color: "#d6c4b4" });
   }
   if (ev.rolled) playSfx("whoosh", { volume: 0.4, pitch: 0.8 });
   if (ev.laneChanged) playSfx("whoosh", { volume: 0.22, pitch: 1.5 });
   if (ev.slid >= 0) {
      const w = ev.slid;
      juice.popup({ x: 0, y: 3.2, z: run.wallZ[w] + 1 }, `${tag}Sliding!`, { color: "#fde68a", size: 0.07 });
      playSfx("whoosh", { volume: 0.5, pitch: 0.6 });
   }
   if (ev.wall >= 0) {
      const w = ev.wall;
      const r = ev.wallResult;
      const at = { x: h.x, y: 1.6, z: run.wallZ[w] };
      if (r === WALL.truePass || r === WALL.ghost || r === WALL.upper) {
         const col = DOOR_COLORS[run.ruleColor[w]];
         juice.burst("hit", at, 30, { color: "#f87171" });
         juice.burst("pickup", at, 18, { color: col.glow });
         juice.kick(0, 0, -1, 0.6);
         playSfx("chime", { pitch: col.chime * (1 + Math.min(0.5, run.streak * 0.05)), volume: 0.6 });
         if (r === WALL.ghost) juice.popup(chest, `${tag}Ghost door!`, { color: "#ddd6fe", size: 0.08 });
         else if (r === WALL.upper) juice.popup(chest, `${tag}Upper row!`, { color: "#fde68a", size: 0.08 });
         else if (run.streak >= 3) juice.popup(chest, `${tag}x${run.streak}`, { color: "#fecaca", size: 0.07 });
      } else if (r === WALL.wrong) {
         anim.hurtAt = now;
         juice.burst("dust", at, 34, { color: "#9ca3af", vy: 2 });
         juice.popup(chest, `${tag}Wrong door!`, { color: "#e5e7eb", size: 0.08 });
         juice.kick(0, 0, 1, 3);
         juice.shake(0.35);
         juice.hitStop(90);
         playSfx("thud", { volume: 0.7, pitch: 0.7 });
      } else if (r === WALL.absorbed) {
         juice.burst("aura", chest, 26, { color: "#86efac" });
         juice.popup(chest, `${tag}Shielded!`, { color: "#bbf7d0", size: 0.07 });
         playSfx("thud", { volume: 0.4, pitch: 1.3 });
      } else if (r === WALL.smashed) {
         juice.burst("hit", at, 44, { color: "#fb923c" });
         juice.burst("dust", at, 30, { color: "#d6d3d1" });
         juice.popup(chest, `${tag}Smash!`, { color: "#fdba74", size: 0.09 });
         juice.shake(0.3);
         juice.hitStop(70);
         playSfx("thud", { pitch: 1.1 });
      }
   }
   if (ev.sideEntered) playSfx("chime", { pitch: 1.3 });
   if (ev.stumbled) {
      anim.stumbleAt = now;
      juice.burst("dust", feet, 20, { color: "#a8a29e" });
      juice.popup(chest, `${tag}Ouch`, { color: "#fca5a5", size: 0.06 });
      juice.shake(0.2);
      playSfx("thud", { volume: 0.5, pitch: 1.2 });
   }
   if (ev.padded) {
      juice.burst("pickup", feet, 16, { color: "#fbbf24" });
      playSfx("whoosh", { volume: 0.5, pitch: 1.3 });
   }
   if (ev.powered || ev.dashed) {
      juice.burst("pickup", chest, 18, { color: heroAccent(run.heroId) });
      juice.burst("aura", chest, 12, { color: heroAccent(run.heroId) });
      playSfx("whoosh", { volume: 0.55, pitch: 1.15 });
   }
   for (let k = 0; k < ev.orbCount; k++) {
      const o = run.course.orbs[ev.orbList[k]];
      juice.burst("pickup", o, 14, { color: "#7dd3fc" });
      juice.popup(o, `${tag}-${(ORB.bonusMs / 1000).toFixed(2)} s`, { color: "#bae6fd" });
      playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.02) });
   }
   for (let k = 0; k < ev.secretCount; k++) {
      const i = ev.secretList[k];
      const spot = run.course.secrets[i];
      const spec = SECRETS[run.level][i];
      juice.burst("checkpoint", spot, 30, { color: spec.kind === "shard" ? "#fecaca" : "#f9a8d4" });
      juice.popup(spot, `${spec.name}!`, { color: spec.kind === "shard" ? "#fecaca" : "#f9a8d4", size: 0.07 });
      juice.hitStop(40);
      playSfx("chime", { pitch: 1.4 });
   }
   if (ev.rushCharged) {
      juice.burst("aura", chest, 30, { color: "#ef4444" });
      juice.popup(chest, `${tag}Red rush ready!`, { color: "#fca5a5", size: 0.08 });
      playSfx("chime", { pitch: 0.7 });
   }
   if (ev.rushFired) {
      juice.burst("hit", chest, 40, { color: "#ef4444" });
      juice.kick(0, 0, -1, 2);
      playSfx("whoosh", { volume: 0.7, pitch: 0.7 });
   }
   if (ev.bossTelegraph) playSfx("whoosh", { volume: 0.4, pitch: 0.5 });
   if (ev.bossAttack) {
      juice.shake(0.15);
      playSfx("thud", { volume: 0.5, pitch: 0.55 });
   }
   if (ev.bossHit) {
      const at = { x: 0, y: 3, z: run.flick.z };
      juice.burst("hit", at, 40, { color: "#fde047" });
      juice.popup(chest, `${tag}Hit!`, { color: "#fef08a", size: 0.09 });
      juice.shake(0.35);
      juice.hitStop(90);
      playSfx("thud", { pitch: 1.2 });
   }
   if (ev.bossDefeated) {
      juice.burst("checkpoint", { x: 0, y: 3, z: run.flick.z }, 120, { color: "#fca5a5" });
      juice.popup(chest, `${tag}Flicker is out!`, { color: "#fecaca", size: 0.09 });
      juice.shake(0.5);
      juice.hitStop(Math.min(140, FLICKER.slowMo.durationMs));
   }
   if (ev.comboLinked && run.combo.chain > 1) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.4 });
}

function Simulation({ run, anim, orbit }: { run: DoorRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const lines = useMemo(createJuiceEmitter, []);
   const chimedLamp = useRef(-1);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;

   useRunFrame((_state, dt) => {
      const i = input.current;
      stepInput.left = i.pressed.left;
      stepInput.right = i.pressed.right;
      stepInput.up = i.pressed.up;
      stepInput.down = i.pressed.down;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.actionPressed = i.actionPressed;
      stepInput.yaw = orbit.viewYaw;
      if (bot) {
         bot.frameMs = lastFrame.current;
         botInput(bot, run, stepInput);
      }
      lastFrame.current = dt * 1000;
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const h = run.hero;
      const now = time.now;
      juiceEvents(run, ev, anim, juice, now);
      // the next lamp chimes its colour as it comes into view (the sound rule: hear it)
      const c = run.course;
      const w = run.nextWall;
      if (w < run.wallCount && w !== chimedLamp.current) {
         const lampZ = w < c.walls.length ? c.lamps[w].z : run.wallZ[w] + 15;
         if (h.z - lampZ < 40 && run.result[w] === WALL.pending) {
            chimedLamp.current = w;
            const col = DOOR_COLORS[run.ruleColor[w]];
            playSfx("chime", { pitch: col.chime, volume: 0.55 });
         }
      }
      // speed lines at 15 m/s and up
      if (h.v >= 15 && h.state === "play") {
         const p = { x: h.x + (Math.random() - 0.5) * 6, y: 0.4 + Math.random() * 2.6, z: h.z - 6 };
         juice.stream("dust", p, (h.v - 13) * 9, lines, { color: "#fde68a", vz: h.v * 0.9, size: 0.4 });
      }
      if (ev.orbCount > 0) {
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
      }
      if (ev.comboBonus > 0) store.setStat(STAT.comboMs, run.combo.bonusTotal);
      publishRun(run);
      if (ev.finished) {
         anim.winAt = now;
         juice.burst("checkpoint", { x: h.x, y: 1.2, z: h.z }, 110);
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
   return null;
}

function DoorCamera({ run, orbit }: { run: DoorRun; orbit: OrbitState }) {
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
         orbitPivot(h.x, h.y, h.z, h.v, out);
         return true;
      },
      [run],
   );
   const travel = useMemo(() => (out: { x: number; z: number }) => orbitTravel(run.hero.v, out), [run]);
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run, camera.position.z, out), [run, camera]);
   return (
      <OrbitCamera
         orbit={orbit}
         pivot={pivot}
         travel={travel}
         solids={solids}
         input={{ oneFinger: false }}
         lookUp={orbitLookUp(aspect)}
         distanceScale={orbitScale(aspect, run.course.lanes)}
         collision={{ radius: 0.4, minDistance: 2.2 }}
      />
   );
}

/** Flicker's slow-mo finish: the visuals only (the rules clock never slows). */
function BossSlowMo({ run }: { run: DoorRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, FLICKER.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: DoorRun; anim: HeroAnim }) {
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
      juice.burst("dust", { x: h.x, y: 0.2, z: h.z }, 26, { color: "#d6c4b4", vy: 3 });
      juice.burst("pickup", { x: h.x, y: 0.7, z: h.z }, 16, { color: heroAccent(run.heroId) });
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
   const { config } = useLevel<DoorLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(DOOR_ORBIT), [run]);
   return (
      <JuiceLayer>
         <World course={run.course} view={run.hero} />
         <Course key={levelId} run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <DoorCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
