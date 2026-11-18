"use client";

// Ring Jump Challenge's scene: the run (rules.ts) stepped in useRunFrame, the canyon (World), the
// course (Course), the hero (animated by the shared menu2/heroAnim), Cyclone Ray on level 5, the free
// orbit camera (menu2/camera: the player turns it; steering is camera-relative through StepInput.yaw)
// with the FOV opening with the fall speed, the intro's camera (core/intro, opted in by index.tsx
// `intro: true`), the air rush (a stereo wind loop that rises with the speed) and the juice (the shared
// menu2/juice JuiceLayer): a whoosh that climbs the scale with the streak on every ring, a one-frame
// freeze and a burst on a centre thread, orb pops, a speed-ring kick, blade hits, the splash and the
// landing's big kick, the boss's hits and its slow-mo finish (visual only) and the Tide Bell.
// Remounted for every run (runId). Local multiplayer runs (2-4 heroes) render MultiScene.tsx instead.
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
import World, { TideBell } from "./World";
import { Course, type VisualClock } from "./Course";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { CycloneRay } from "./Boss";
import { FOV, FOV_PORTRAIT, LOOK_UP, RING_ORBIT, fovFor, introKeyframes, orbitPivot, orbitScale, playCamera, shaftSolids } from "./camera";
import type { AABB } from "@/arcade3d/core/collision";
import { PTS, STAT, createRun, createStepInput, fallSpeed, hintFor, ringPos, step, type RingRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { RingLevel } from "./levels";
import { COMBO, CYCLONE_RAY, SECRETS } from "./progression";
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

/** A major-scale climb for the ring whoosh (the card: rising pitch with the streak). */
const SCALE = [1, 1.122, 1.26, 1.335, 1.498, 1.682, 1.888, 2];

const LANDING_TEXT = { bull: "BULL'S-EYE!", pad: "On the pad!", pool: "Splashdown!" } as const;

export function publishStats(run: RingRun): void {
   const store = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   if (store.score !== run.score) store.setScore(run.score);
   set(STAT.rings, run.rings);
   set(STAT.centres, run.centres);
   set(STAT.misses, run.misses);
   set(STAT.orbs, run.orbs);
   set(STAT.mainOrbs, run.mainOrbs);
   set(STAT.depth, Math.max(0, Math.round(run.hero.y - run.course.pad.y)));
   set(STAT.speed, Math.round(fallSpeed(run)));
   set(STAT.streak, run.streak);
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10));
   const heroStat = run.heroId === "nami" ? 1 : run.heroId === "kiro" ? 2 : run.heroId === "zuno" ? 3 : run.heroId === "vexa" ? 4 : 0;
   set(STAT.hero, heroStat);
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
   set(STAT.hint, hintFor(run));
   const b = run.boss;
   if (b) {
      set(STAT.bossHp, b.hp);
      set(STAT.bossPhase, b.phase);
      set(STAT.bossOpen, b.step === "vulnerable" ? 1 : 0);
      set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
      set(STAT.wakeChain, run.wakeChain);
      set(STAT.charged, run.charged ? 1 : 0);
   }
}

/** The air rush: a wind loop whose level and pitch follow the fall speed, panned by the drift (the card: in stereo). */
function AirRush({ run }: { run: RingRun }) {
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const loop = useRef<LoopHandle | null>(null);
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const l = startLoop("surf", { volume: 0 });
      loop.current = l;
      return () => {
         l.stop();
         loop.current = null;
      };
   }, [phase, muted]);
   const last = useRef({ v: -1, p: -9, q: -1 });
   useFrame(() => {
      const l = loop.current;
      if (!l) return;
      const h = run.hero;
      const falling = h.mode === "fall";
      const fall = falling ? fallSpeed(run) : 0;
      const v = Math.round(Math.min(0.5, (fall / 50) * 0.5) * 50) / 50;
      const p = Math.round(Math.max(-1, Math.min(1, h.vx / 9)) * 10) / 10;
      const q = Math.round((0.7 + fall / 60) * 20) / 20;
      const s = last.current;
      if (v !== s.v || p !== s.p || q !== s.q) {
         l.set({ volume: v, pan: p, pitch: q });
         s.v = v;
         s.p = p;
         s.q = q;
      }
   });
   return null;
}

function Simulation({ run, anim, clock, won, orbit }: { run: RingRun; anim: HeroAnim; clock: VisualClock; won: { current: boolean }; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const spot = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const p2 = useMemo(() => ({ x: 0, z: 0 }), []);
   const trail = useMemo(createJuiceEmitter, []);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;

   useRunFrame((_state, dt) => {
      const i = input.current;
      // camera-relative steering: the rules turn the stick by the orbit camera's drawn yaw
      stepInput.moveX = i.moveX;
      stepInput.moveZ = i.moveY;
      stepInput.yaw = orbit.viewYaw;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.jumpHeld = i.jump;
      stepInput.actionPressed = i.actionPressed;
      if (bot) {
         stepInput.yaw = 0;
         bot.frameMs = lastFrame.current;
         botInput(bot, run, stepInput);
      }
      lastFrame.current = dt * 1000;
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const h = run.hero;
      const now = time.now;
      chest.x = h.x;
      chest.y = h.y + (h.mode === "fall" ? 0 : 0.7);
      chest.z = h.z;
      if (ev.leaped) {
         anim.leapAt = now;
         juice.burst("dust", { x: h.x, y: run.course.top + 0.1, z: h.z }, 12, { color: "#e7d3b0" });
         playSfx("jump", { volume: 0.7 });
         playSfx("whoosh", { volume: 0.5, pitch: 0.8 });
      }
      if (h.mode === "fall" && h.diving) juice.stream("trail", chest, 50, trail, { color: "#e0f7ff" });
      if (ev.powered) {
         const color = heroAccent(run.heroId);
         juice.burst("aura", chest, 16, { color });
         juice.burst("pickup", chest, 14, { color });
         if (run.heroId === "nami") {
            anim.flipAt = now;
            juice.burst("dust", chest, 14, { color: "#ffffff" });
            playSfx("jump", { volume: 0.6, pitch: 1.3 });
         } else playSfx("whoosh", { volume: 0.6, pitch: 1.2 });
      }
      for (let k = 0; k < ev.ringCount; k++) {
         const r = run.course.rings[ev.ringList[k]];
         ringPos(r, run.simMs, p2);
         spot.x = p2.x;
         spot.y = r.y;
         spot.z = p2.z;
         const centre = ev.ringCentre[k];
         const pitch = SCALE[Math.min(SCALE.length - 1, Math.max(0, run.streak - 1) % SCALE.length)] * (centre ? 1.1 : 1);
         playSfx("whoosh", { pitch, volume: 0.65 });
         if (r.kind === "gold") {
            juice.burst("checkpoint", spot, 50, { color: "#ffd34d" });
            playSfx("chime", { pitch: 1.5 });
         } else if (centre) {
            juice.burst("checkpoint", spot, 30, { color: "#fff3b0" });
            juice.popup(spot, `+${PTS.centre} CENTRE`, { color: "#fff3b0", size: 0.07 });
            juice.hitStop(17);
            playSfx("chime", { pitch: pitch * 1.2, volume: 0.45 });
         } else {
            juice.burst("pickup", spot, 18, { color: r.kind === "speed" ? "#ffb26b" : "#e0f2fe" });
            juice.popup(spot, `+${PTS.ring}`, { color: "#e0f2fe", size: 0.055 });
         }
      }
      if (ev.speedBoost) {
         juice.kick(0, -1, 0, 4);
         juice.popup(chest, "SPEED!", { color: "#ffb26b", size: 0.07 });
      }
      if (ev.missCount > 0) {
         juice.popup(chest, "Miss", { color: "#94a3b8", size: 0.05 });
         playSfx("buzz", { volume: 0.25, pitch: 0.8 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = run.course.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 14, { color: "#ffe27a" });
         juice.popup(o, `+${PTS.orb}`, { color: "#ffe08a" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.025) });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const s = ev.secretList[k];
         const spec = SECRETS[run.level][s];
         juice.burst("checkpoint", chest, 40, { color: spec.kind === "shard" ? "#bae6fd" : "#f9a8d4" });
         juice.popup(chest, `${spec.name}!`, { color: spec.kind === "shard" ? "#bae6fd" : "#f9a8d4", size: 0.075 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.comboLinked && run.combo.chain > 1) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.15, volume: 0.35 });
      if (ev.sealBroken >= 0) {
         juice.burst("hit", chest, 30, { color: "#d6b98c" });
         juice.burst("dust", chest, 18, { color: "#cbb79a" });
         juice.shake(0.25);
         juice.hitStop(60);
         playSfx("thud");
      }
      if (ev.stormPushed) {
         juice.burst("aura", chest, 18, { color: "#a78bfa" });
         juice.shake(0.15);
         playSfx("zap", { volume: 0.4 });
      }
      if (ev.bladeHit || ev.laneHit) {
         anim.hurtAt = now;
         anim.hurtX = h.vx;
         anim.hurtZ = h.vz;
         juice.burst("hit", chest, 26, { color: ev.laneHit ? "#e9d5ff" : undefined });
         juice.shake(0.35);
         juice.hitStop(70);
         playSfx(ev.laneHit ? "zap" : "hit");
      }
      if (ev.splashed) {
         anim.splashAt = now;
         anim.hurtAt = now;
         spot.x = h.x;
         spot.y = 0.2;
         spot.z = h.z;
         juice.burst("dust", spot, 34, { color: "#e0f7ff" });
         juice.burst("pickup", spot, 20, { color: "#7dd3fc" });
         juice.shake(0.4);
         juice.hitStop(80);
         playSfx("splash");
      }
      if (ev.respawned) {
         anim.spawnAt = now;
         juice.burst("pickup", chest, 22, { color: heroAccent(run.heroId) });
         juice.popup(chest, "Again!", { color: "#fca5a5" });
         playSfx("pop");
      }
      if (ev.charged) {
         juice.burst("checkpoint", chest, 36, { color: "#ffe066" });
         juice.popup(chest, "Charged! Dive into its fin", { color: "#ffe066", size: 0.06 });
         playSfx("chime", { pitch: 1.7 });
      }
      if (ev.wakeThreaded) playSfx("whoosh", { pitch: 1 + run.wakeChain * 0.12, volume: 0.5 });
      if (ev.bossTelegraph && run.boss?.phase === 1) playSfx("alarm", { volume: 0.3 });
      if (ev.bossHit) {
         juice.burst("hit", chest, 34, { color: "#fef08a" });
         juice.shake(0.4);
         juice.hitStop(90);
         playSfx("boom", { pitch: 1.1 });
      }
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 100, { color: "#a5f3fc" });
         juice.popup(chest, "Cyclone Ray falls!", { color: "#a5f3fc", size: 0.08 });
         juice.shake(0.5);
         juice.hitStop(140);
      }
      if (ev.landed) {
         anim.landAt = now;
         spot.x = h.x;
         spot.y = h.y + 0.2;
         spot.z = h.z;
         juice.burst("dust", spot, ev.landed === "pool" ? 40 : 24, { color: ev.landed === "pool" ? "#e0f7ff" : "#fde68a" });
         juice.burst("checkpoint", spot, ev.landed === "bull" ? 90 : 50);
         juice.kick(0, -1, 0, 6);
         juice.shake(0.45);
         juice.hitStop(100);
         juice.popup(spot, LANDING_TEXT[ev.landed], { color: ev.landed === "bull" ? "#fb923c" : "#fef3c7", size: 0.09 });
         playSfx(ev.landed === "pool" ? "splash" : "thud");
         playSfx("win", { volume: 0.7 });
      }
      publishStats(run);
      if (ev.finished) {
         won.current = true;
         anim.winAt = now + 0.5;
         store.setStat(STAT.finishMs, run.finishMs);
         store.setStat(STAT.landing, ev.landed === "bull" ? 3 : ev.landed === "pad" ? 2 : 1);
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
      else if (s.phase === "ready") clock.ms = (time.now * 1000) % 60_000;
      else if (s.phase === "over") clock.ms = run.simMs + s.overMs;
      else clock.ms = run.simMs;
   }, FRAME_PRIORITY.camera);
   return null;
}

/** The orbit camera round the falling hero, the FOV opening with the speed. */
function RingCamera({ run, orbit }: { run: RingRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const base = aspect < 1 ? FOV_PORTRAIT : FOV;
   const fov = useRef(base);
   useFrame(
      () => {
         const want = fovFor(base, run.hero.mode === "fall" ? fallSpeed(run) : 0);
         fov.current += (want - fov.current) * 0.08;
         if (Math.abs(camera.fov - fov.current) > 0.05) {
            camera.fov = fov.current;
            camera.updateProjectionMatrix();
         }
      },
      FRAME_PRIORITY.camera + 0.05,
   );
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         const h = run.hero;
         if (h.mode === "splash") return false;
         orbitPivot(h.x, h.y, h.z, h.mode === "perch", out);
         return true;
      },
      [run],
   );
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         const h = run.hero;
         if (h.mode !== "fall") return;
         out.x = h.vx;
         out.z = h.vz;
      },
      [run],
   );
   const solids = useMemo(() => (out: AABB[]) => (run.hero.mode === "perch" || run.hero.y > run.course.top - 25 ? 0 : shaftSolids(run.course, run.hero.y, out)), [run]);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} solids={solids} lookUp={LOOK_UP} distanceScale={orbitScale(aspect)} pivotDamping={28} collision={WALL_CLIP} />;
}

const WALL_CLIP = { radius: 0.4, minDistance: 3 };

/** The boss's slow-mo finish: the visuals only (the hit-stop is its punch; the rules clock never slows). */
function BossSlowMo({ run, ringing }: { run: RingRun; ringing: { current: boolean } }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (run.ended === "win") ringing.current = true;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, CYCLONE_RAY.slowMo.durationMs));
      playSfx("chime", { pitch: 0.6, volume: 0.8 });
   });
   return null;
}

function IntroCamera({ run, anim }: { run: RingRun; anim: HeroAnim }) {
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
      juice.burst("dust", { x: h.x, y: h.y + 0.1, z: h.z }, 18, { color: "#e7d3b0" });
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
   const { config } = useLevel<RingLevel>();
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
   const orbit = useMemo(() => createOrbit(RING_ORBIT), [run]);
   const won = useRef(false);
   const ringing = useRef(false);
   return (
      <JuiceLayer>
         <World course={run.course} levelId={levelId} />
         {/* keyed by level: the pools below are sized once per mount */}
         <Course key={levelId} run={run} clock={clock} />
         {run.course.boss ? <CycloneRay run={run} clock={clock} /> : null}
         {run.course.boss ? <TideBell course={run.course} ringing={ringing} /> : null}
         <Hero run={run} anim={anim} clock={clock} />
         <Simulation run={run} anim={anim} clock={clock} won={won} orbit={orbit} />
         <RingCamera run={run} orbit={orbit} />
         <AirRush run={run} />
         <BossSlowMo run={run} ringing={ringing} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
