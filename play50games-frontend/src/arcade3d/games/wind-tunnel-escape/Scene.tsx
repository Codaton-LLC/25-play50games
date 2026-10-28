"use client";

// Wind Tunnel Escape's scene: the run (rules.ts) stepped in useRunFrame, the tunnel (World + Course),
// the hero (the shared menu2/heroAnim animator), the free orbit camera (menu2/camera: the player turns
// it; movement is camera-relative through StepInput.yaw), the intro's camera (core/intro), the wind
// sound (a loop that rises while a current carries you), and the juice (the shared menu2/juice
// JuiceLayer): fans clack as they turn, currents whoosh, a set-up room chimes, orbs pop, the storm zaps,
// covers burst, the Gale Engine shakes the tunnel and its finish slows the visuals. Remounted for every
// run (runId). Local multiplayer runs (2-4 heroes) render MultiScene.tsx instead.
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
import { playSfx, startLoop, useMuted, type LoopHandle } from "@/arcade3d/core/audio";
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
import { Course, type VisualClock } from "./Course";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, WIND_ORBIT, courseSolids, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { ORB, STAT, bossVulnerable, createRun, createStepInput, gateOpen, groundUnder, nearestFan, step, type WindRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { WindLevel } from "./levels";
import { COMBO, ESCAPE, GALE_ENGINE, SECRETS } from "./progression";
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

const HERO_STAT = { riko: 0, nami: 1, kiro: 2, zuno: 3, vexa: 4 } as const;

/** Publishes what the HUD shows (only when a value changes). */
export function publishRun(run: WindRun): void {
   const s = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (s.stats[k] !== v) s.setStat(k, v);
   };
   const h = run.hero;
   const c = run.course;
   set(STAT.hearts, Math.max(0, h.hearts));
   set(STAT.hero, HERO_STAT[run.heroId]);
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.ms) / 1000)));
   set(STAT.room, Math.min(c.rooms.length, run.room + 1));
   set(STAT.rooms, c.rooms.length);
   set(STAT.distance, Math.round(run.bestDist));
   const w = run.world;
   set(STAT.storm, w.storm.active && h.state === "play" ? Math.max(0, Math.round(w.storm.z - h.z)) : -1);
   set(STAT.near, h.state === "play" ? nearestFan(run) : -1);
   set(STAT.hint, run.hint);
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.ms) * 10));
   const b = w.boss;
   if (b) {
      set(STAT.bossHp, b.hp);
      set(STAT.bossPhase, w.escapeAt >= 0 ? 2 : b.phase);
      set(STAT.bossOpen, bossVulnerable(run) ? 1 : 0);
      set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
      set(STAT.escape, w.escapeAt >= 0 ? Math.max(0, Math.ceil((ESCAPE.parMs - (run.ms - w.escapeAt)) / 1000)) : -1);
   }
}

/** The wind's sound: a soft bed, and a rush that rises while a current carries the hero. */
function useWindSound(run: WindRun) {
   const muted = useMuted();
   const phase = useArcadeStore((s) => s.phase);
   const rush = useRef<LoopHandle | null>(null);
   const last = useRef(-1);
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const bed = startLoop("ambient", { volume: 0.06, pitch: 0.7 });
      const r = startLoop("rotor", { volume: 0, pitch: 0.55 });
      rush.current = r;
      last.current = -1;
      return () => {
         bed.stop();
         r.stop();
         rush.current = null;
      };
   }, [phase, muted]);
   useFrame(() => {
      const r = rush.current;
      if (!r) return;
      const v = run.hero.riding > 0 ? Math.min(0.3, 0.12 + Math.hypot(run.hero.vx, run.hero.vy, run.hero.vz) * 0.02) : 0;
      if (Math.abs(v - last.current) > 0.02) {
         last.current = v;
         r.set({ volume: v, pitch: 0.55 + v });
      }
   });
}

function Simulation({ run, anim, clock, orbit }: { run: WindRun; anim: HeroAnim; clock: VisualClock; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;
   useWindSound(run);

   useRunFrame((_state, dt) => {
      const i = input.current;
      stepInput.moveX = i.moveX;
      stepInput.moveZ = i.moveY;
      stepInput.yaw = orbit.viewYaw;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.jumpHeld = i.jump;
      stepInput.actionPressed = i.actionPressed;
      stepInput.actionHeld = i.action;
      if (bot) {
         bot.frameMs = lastFrame.current;
         botInput(bot, run, stepInput);
      }
      lastFrame.current = dt * 1000;
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const h = run.hero;
      const c = run.course;
      const now = time.now;
      chest.x = feet.x = h.x;
      chest.z = feet.z = h.z;
      chest.y = h.y + 0.7;
      feet.y = h.y + 0.1;
      if (ev.airJumped) {
         anim.airJumpAt = now;
         juice.burst("dust", feet, 10, { color: "#e0f2fe" });
         playSfx("jump", { volume: 0.55, pitch: 1.25 });
      } else if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.55 });
      }
      if (ev.landed) {
         anim.landAt = now;
         juice.burst("dust", feet, ev.landSpeed > 8 ? 14 : 7, { color: "#cbd5e1" });
         if (ev.landSpeed > 8) juice.kick(0, -1, 0, 1.6);
      }
      if (ev.turned >= 0) {
         const f = c.fans[ev.turned];
         const p = { x: f.x, y: f.y + 1.6, z: f.z };
         juice.burst("hit", p, 8, { color: "#e2e8f0" });
         playSfx("click", { pitch: 0.8, volume: 0.7 });
         playSfx("click", { pitch: 1.05, volume: 0.5 });
      }
      if (ev.switched >= 0) {
         const f = c.fans[ev.switched];
         const on = run.world.on[ev.switched] === 1;
         juice.burst("pickup", { x: f.x, y: f.y + 1.2, z: f.z }, 12, { color: on ? "#7dd3fc" : "#64748b" });
         playSfx(on ? "whoosh" : "click", { pitch: on ? 0.9 : 0.6, volume: 0.6 });
      }
      if (ev.rideStart) {
         playSfx("whoosh", { volume: 0.45, pitch: h.ridingUp ? 1.1 : 0.85 });
         juice.burst("trail", chest, 10, { color: "#bae6fd" });
      }
      if (ev.setup >= 0) {
         juice.burst("checkpoint", chest, 24, { color: "#7dd3fc" });
         juice.popup(chest, "Current set!", { color: "#bae6fd", size: 0.065 });
         playSfx("chime", { pitch: 1.2 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = c.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 14);
         juice.popup(o, `-${(ORB.bonusMs / 1000).toFixed(1)} s`, { color: "#ffe08a" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.03) });
      }
      if (ev.orbCount > 0) {
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spot = c.secrets[ev.secretList[k]];
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", spot, 30, { color: spec.kind === "shard" ? "#bae6fd" : "#f9a8d4" });
         juice.popup(spot, `${spec.name}!`, { color: spec.kind === "shard" ? "#bae6fd" : "#f9a8d4", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.comboLinked && run.combo.chain > 1) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.45 });
      if (ev.comboBonus > 0) store.setStat(STAT.comboMs, run.combo.bonusTotal);
      if (ev.checkpoint > 0) {
         juice.burst("checkpoint", chest, 40);
         juice.popup(chest, "Checkpoint!", { color: "#ffd257", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime");
         store.setStat(STAT.checkpoint, ev.checkpoint);
      }
      if (ev.powered && !ev.airJumped) {
         juice.burst("pickup", chest, 18, { color: heroAccent(run.heroId) });
         juice.burst("aura", chest, 12, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.5, pitch: 1.15 });
      }
      if (ev.coverBroken >= 0) {
         const b = c.blocks[ev.coverBroken];
         const p = { x: (b.x0 + b.x1) / 2, y: b.y0 + 0.8, z: (b.z0 + b.z1) / 2 };
         juice.burst("hit", p, 30, { color: "#f59e0b" });
         juice.burst("dust", p, 18, { color: "#a8a29e" });
         juice.shake(0.25);
         juice.hitStop(60);
         playSfx("thud");
         playSfx("whoosh", { pitch: 1.3 });
      }
      if (ev.anemo >= 0) {
         const a = c.anemos[ev.anemo];
         juice.burst("checkpoint", { x: a.x, y: a.y + 2.2, z: a.z }, 24, { color: "#bae6fd" });
         juice.popup({ x: a.x, y: a.y + 2.8, z: a.z }, "A vent opens!", { color: "#bae6fd", size: 0.065 });
         playSfx("chime", { pitch: 1.6 });
      }
      if (ev.stormWoke) {
         juice.popup(chest, "The storm is coming!", { color: "#c4b5fd", size: 0.07 });
         playSfx("alarm", { volume: 0.4, pitch: 0.8 });
      }
      if (ev.hit) {
         anim.hitAt = now;
         juice.burst("hit", chest, ev.stormHit ? 10 : 16, { color: ev.stormHit ? "#a78bfa" : "#4ade80" });
         juice.shake(ev.stormHit ? 0.18 : 0.3);
         juice.hitStop(ev.stormHit ? 30 : 70);
         playSfx(ev.stormHit ? "zap" : "hit", { volume: 0.55 });
         store.setStat(STAT.falls, run.hits);
      }
      if (ev.lost) {
         anim.lostAt = now;
         juice.burst("hit", chest, 16);
         juice.shake(0.28);
         juice.hitStop(90);
         playSfx("lose", { volume: 0.5 });
      }
      if (ev.respawned) {
         anim.spawnAt = now;
         juice.burst("pickup", chest, 22, { color: heroAccent(run.heroId) });
         juice.popup(chest, "+lost time", { color: "#fca5a5" });
         playSfx("pop");
      }
      if (ev.bossWoke) {
         juice.shake(0.35);
         playSfx("boom", { volume: 0.6, pitch: 0.6 });
         juice.popup(chest, "The Gale Engine wakes!", { color: "#fde68a", size: 0.075 });
      }
      if (ev.bossTelegraph) playSfx("alarm", { volume: 0.25, pitch: run.world.boss && run.world.boss.phase === 0 ? 0.7 : 1.1 });
      if (ev.bossAttack) {
         juice.shake(0.22);
         playSfx("whoosh", { volume: 0.8, pitch: 0.5 });
      }
      if (ev.returned >= 0) {
         const f = c.fans[ev.returned];
         juice.burst("hit", { x: f.x, y: f.y + 1.5, z: f.z }, 24, { color: "#fde047" });
         juice.popup({ x: f.x, y: f.y + 2.6, z: f.z }, "Blast returned!", { color: "#fde047", size: 0.07 });
      }
      if (ev.crateIn >= 0 && c.arena) juice.popup({ x: 0, y: c.arena.floor + 4, z: c.arena.z1 + 2 }, "Jammed!", { color: "#fde047", size: 0.08 });
      if (ev.bossHit) {
         juice.burst("hit", { x: 0, y: (c.arena?.floor ?? 0) + 5, z: (c.arena?.z1 ?? 0) + 1 }, 40, { color: "#fef08a" });
         juice.shake(0.4);
         juice.hitStop(90);
         playSfx("boom", { volume: 0.7 });
      }
      if (ev.bossPhase) juice.popup(chest, "It opens its core!", { color: "#c4b5fd", size: 0.075 });
      if (ev.bossDefeated) {
         juice.burst("checkpoint", { x: 0, y: (c.arena?.floor ?? 0) + 5, z: (c.arena?.z1 ?? 0) + 1 }, 90, { color: "#fde68a" });
         juice.shake(0.6);
         juice.hitStop(140);
         playSfx("boom", { volume: 0.9, pitch: 0.7 });
      }
      if (ev.bossDone) {
         juice.popup(chest, `Escape! ${Math.round(ESCAPE.parMs / 1000)} s`, { color: "#f0abfc", size: 0.08 });
         playSfx("alarm", { volume: 0.5 });
      }
      publishRun(run);
      if (ev.finished) {
         anim.winAt = now;
         juice.burst("checkpoint", chest, 110);
         juice.burst("pickup", chest, 40);
         juice.shake(0.2);
         playSfx("chime", { pitch: 0.75 });
         if (c.arena) playSfx("win");
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
      else if (s.phase === "over") clock.ms = run.ms + s.overMs;
      else clock.ms = run.ms;
   }, FRAME_PRIORITY.camera);
   return null;
}

const WIND_COLLISION = { radius: 0.35, minDistance: 1.8 };

/** The shared Menu 2 orbit camera round the hero; the tunnel's walls and ledges pull it in. */
export function WindCamera({ run, orbit }: { run: WindRun; orbit: OrbitState }) {
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
         if (h.state === "lost") return false;
         orbitPivot(h.x, h.y, h.z, h.vx, h.vz, h.ridingUp, out);
         // in the Gale Engine's arena the view leans towards the engine (and up), so it stays in frame
         if (run.world.bossAwake && !gateOpen(run)) {
            out.z -= 0.8;
            out.y += 1.4;
         }
         return true;
      },
      [run],
   );
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         const h = run.hero;
         if (h.state !== "play") return;
         out.x = h.vx;
         out.z = h.vz;
      },
      [run],
   );
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run, camera.position.x, camera.position.y, camera.position.z, out), [run, camera]);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} solids={solids} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={WIND_COLLISION} />;
}

export function GroundProbe({ run, ground }: { run: WindRun; ground: { current: number } }) {
   useFrame(() => {
      const h = run.hero;
      ground.current = groundUnder(run, h.x, h.z, h.y);
   }, FRAME_PRIORITY.camera);
   return null;
}

/** The boss's slow-mo finish: the visuals only (the juice's hit-stop); the rules clock never slows. */
function BossSlowMo({ run }: { run: WindRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.world.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, GALE_ENGINE.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: WindRun; anim: HeroAnim }) {
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
      juice.burst("dust", { x: h.x, y: h.y + 0.1, z: h.z }, 18, { color: "#e2e8f0" });
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
   const { config } = useLevel<WindLevel>();
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
   const orbit = useMemo(() => createOrbit(WIND_ORBIT), [run]);
   const ground = useRef(0);
   return (
      <JuiceLayer>
         <World course={run.course} levelId={levelId} />
         {/* keyed by level: the pools below are sized once per mount */}
         <Course key={levelId} run={run} clock={clock} />
         <Hero run={run} anim={anim} ground={ground} />
         <Simulation run={run} anim={anim} clock={clock} orbit={orbit} />
         <GroundProbe run={run} ground={ground} />
         <WindCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
