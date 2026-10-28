"use client";

// Plate Surf's scene: the run (rules.ts) stepped in useRunFrame, the wave and the bay, the hero on its
// plate (animated by the shared menu2/heroAnim with the surf stance), the free orbit camera
// (menu2/camera: the player turns it; movement is camera-relative through StepInput.yaw), the intro's
// camera (core/intro, opted in by index.tsx `intro: true`) and the juice (menu2/juice JuiceLayer):
// spray fanning off every carve, the pump's thrum (a bass note, the plate's glow, a buzz on phones),
// named trick pops (icons only), the curl's roar as it closes, the light turning teal in the barrel,
// knocks, stings and wipeouts, checkpoints, the boss's hits and its slow-mo finish (visual only), and
// the bell. Remounted for every run (runId). Local multiplayer runs (2-4 heroes) render MultiScene.tsx.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Fog, type PerspectiveCamera } from "three";
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
import { Wave, type VisualClock } from "./Wave";
import { Course } from "./Course";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, SURF_ORBIT, portraitAmount, courseSolids, introKeyframes, orbitLookUp, orbitPivot, orbitScale, orbitTravel, playCamera } from "./camera";
import { ORB, STAT, TRICK_NAMES, bossAlive, bossVulnerable, createRun, createStepInput, curlGap, groundY, step, type SurfRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { SurfLevel } from "./levels";
import { COMBO, KING_BREAKER, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import { LOOKS } from "./look";
import MultiScene from "./MultiScene";

/** Preview builds only: `?autoplay=1` lets the honest bot (bot.ts) ride, for screenshots and checks. */
function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

/** The trick pops: icons only (the card): spin, flip, grab. */
export const TRICK_ICONS = ["", "↻", "⇅", "✋"] as const;

/** A short buzz on phones for a pump (the card's risk fix); never throws. */
function buzz(ms: number): void {
   try {
      // only after the player touched the page (Chrome blocks it before and logs an error)
      const n = typeof navigator !== "undefined" ? (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }) : null;
      if (n && "vibrate" in n && n.userActivation?.hasBeenActive) n.vibrate(ms);
   } catch {
      // no vibration here
   }
}

export function publishBoss(run: SurfRun): void {
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

/** Publishes the HUD's numbers that change every frame (only when they change). */
export function publishRide(run: SurfRun): void {
   const store = useArcadeStore.getState();
   const h = run.hero;
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   set(STAT.distance, Math.round(run.bestDist));
   set(STAT.speed, Math.round(h.v * 10));
   set(STAT.curl, Math.max(0, Math.round(curlGap(run))));
   set(STAT.hearts, run.hearts);
   set(STAT.tricks, run.tricks);
   set(STAT.hero, run.heroId === "nami" ? 1 : run.heroId === "kiro" ? 2 : run.heroId === "zuno" ? 3 : run.heroId === "vexa" ? 4 : 0);
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10));
   publishBoss(run);
}

function Simulation({ run, anim, clock, won, orbit }: { run: SurfRun; anim: HeroAnim; clock: VisualClock; won: { current: boolean }; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const tail = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const spray = useMemo(createJuiceEmitter, []);
   const roarAt = useRef(0);
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
      chest.x = feet.x = h.x;
      chest.z = feet.z = h.z;
      chest.y = h.y + 1.1;
      feet.y = h.y + 0.25;
      // spray fanning off every carve (and harder on a pump)
      if (h.grounded && h.state === "play" && Math.abs(h.vx) > 2.5) {
         tail.x = h.x - Math.sign(h.vx) * 0.3;
         tail.y = h.y + 0.15;
         tail.z = h.z + 0.7;
         juice.stream("trail", tail, 14 + Math.abs(h.vx) * 6, spray, { color: "#f4fdff", vx: -h.vx * 0.45, vy: 2.8, vz: 1.5, size: 1.6 });
      }
      if (ev.pumped) {
         anim.pumpAt = now;
         juice.burst("trail", feet, 22, { color: "#ffffff", vy: 3.5, vx: -h.vx * 0.4, size: 1.8 });
         juice.burst("pickup", feet, 8, { color: heroAccent(run.heroId) });
         juice.popup(chest, `+${(1.5).toFixed(1)}`, { color: "#a5f3fc", size: 0.05 });
         juice.kick(0, -1, 0, 0.8);
         playSfx("thud", { pitch: 0.55 + Math.min(0.5, h.v / 48), volume: 0.55 });
         buzz(18);
      } else if (ev.pumpMissed) {
         juice.popup(chest, "carve harder", { color: "#e2e8f0", size: 0.04 });
      }
      if (ev.airJumped) {
         anim.airJumpAt = now;
         juice.burst("dust", feet, 12, { color: "#ffffff" });
         playSfx("jump", { volume: 0.6, pitch: 1.25 });
      } else if (ev.jumped) {
         anim.jumpAt = now;
         juice.burst("dust", feet, 18, { color: "#ffffff", vy: 4 });
         playSfx("whoosh", { volume: 0.5, pitch: 1.1 });
      }
      if (ev.landed) {
         anim.landAt = now;
         juice.burst("dust", feet, 14, { color: "#ffffff", vy: 2.5 });
         juice.kick(0, -1, 0, 1.4);
      }
      if (ev.trick) {
         juice.popup(chest, `${TRICK_ICONS[ev.trick]} +1s`, { color: "#fde68a", size: 0.08 });
         juice.burst("pickup", chest, 18, { color: "#fde68a" });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.1 + 0.15 * (run.tricks % 4), volume: 0.5 });
      }
      if (ev.bailed) {
         anim.bailAt = now;
         juice.popup(chest, "bail", { color: "#fca5a5", size: 0.06 });
         juice.burst("dust", feet, 18, { color: "#ffffff" });
         juice.shake(0.18);
         playSfx("thud", { volume: 0.5 });
      }
      if (ev.powered) {
         juice.burst("pickup", chest, 20, { color: heroAccent(run.heroId) });
         juice.burst("aura", chest, 14, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.55, pitch: 1.15 });
      }
      if (ev.wallBroken >= 0) {
         juice.burst("hit", chest, 28, { color: "#fb923c" });
         juice.burst("dust", chest, 18, { color: "#cbd5e1" });
         juice.popup(chest, "Lagoon!", { color: "#fdba74", size: 0.07 });
         juice.shake(0.25);
         juice.hitStop(60);
         playSfx("thud");
      } else if (ev.laneEntered >= 0) {
         juice.burst("aura", chest, 16, { color: "#c4b5fd" });
         juice.popup(chest, "Calm lane", { color: "#ddd6fe", size: 0.07 });
         playSfx("chime", { pitch: 1.3 });
      }
      if (ev.bounced) {
         juice.burst("hit", chest, 12, { color: "#cbd5e1" });
         juice.shake(0.15);
         playSfx("thud", { volume: 0.5, pitch: 0.8 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = run.course.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 14, { color: "#a5f3fc" });
         juice.popup(o, `-${(ORB.bonusMs / 1000).toFixed(2)} s`, { color: "#a5f3fc" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.03) });
      }
      if (ev.orbCount > 0) {
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
      }
      if (ev.gate >= 0) {
         const g = run.course.gates[ev.gate];
         juice.burst("checkpoint", g, 26, { color: "#fde68a" });
         juice.popup(g, "Gate!", { color: "#fde68a", size: 0.07 });
         playSfx("chime", { pitch: 1.5 });
      }
      if (ev.buoy >= 0) {
         juice.burst("hit", chest, 12, { color: "#fdba74" });
         juice.shake(0.14);
         playSfx("thud", { volume: 0.45, pitch: 1.3 });
      }
      if (ev.stung) {
         anim.stungAt = now;
         juice.burst("hit", chest, 22, { color: "#c4b5fd" });
         juice.popup(chest, "-5 m/s", { color: "#c4b5fd", size: 0.06 });
         juice.shake(0.28);
         juice.hitStop(70);
         playSfx("lose", { volume: 0.4, pitch: 1.3 });
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
      if (ev.checkpoint > 0) {
         juice.burst("checkpoint", chest, 46);
         juice.popup(chest, "Checkpoint ♥", { color: "#ffd257", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime");
         store.setStat(STAT.checkpoint, ev.checkpoint);
      }
      if (ev.bossTelegraph) playSfx("whoosh", { volume: 0.45, pitch: 0.6 });
      if (ev.bossAttack) {
         juice.shake(0.2);
         playSfx("thud", { volume: 0.6, pitch: 0.6 });
      }
      if (ev.bossHit) {
         juice.burst("hit", chest, 30, { color: "#fef08a" });
         juice.popup(chest, "Hit!", { color: "#fef08a", size: 0.08 });
         juice.shake(0.3);
         juice.hitStop(80);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 90, { color: "#fca5a5" });
         juice.popup(chest, "King Breaker breaks!", { color: "#fecaca", size: 0.08 });
         juice.shake(0.45);
         juice.hitStop(130);
      }
      if (ev.lost) {
         anim.lostAt = now;
         juice.burst("dust", chest, 40, { color: "#ffffff", vy: 3 });
         juice.burst("hit", chest, 16, { color: ev.swallowed ? "#e0f2fe" : "#94a3b8" });
         juice.popup(chest, ev.swallowed ? "Swallowed!" : "Wipeout!", { color: "#fca5a5", size: 0.08 });
         juice.shake(0.4);
         juice.hitStop(90);
         playSfx("lose", { volume: 0.55 });
      }
      if (ev.respawned) {
         anim.spawnAt = now;
         juice.burst("pickup", chest, 22, { color: heroAccent(run.heroId) });
         playSfx("pop");
      }
      // the curl roars louder as it closes
      const gap = curlGap(run);
      if (h.state === "play" && gap < 16 && now - roarAt.current > 0.12 + gap * 0.04) {
         roarAt.current = now;
         playSfx("whoosh", { volume: Math.min(0.6, 0.7 - gap * 0.04), pitch: 0.4 + 0.15 * (0.5 + 0.5 * Math.sin(now * 13)) });
      }
      publishRide(run);
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
      } else if (ev.out) {
         levelEndStats(run, userRef.current);
         store.end("lose");
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

/** The light turns teal in the barrel (the curl right behind you, or level 5's tube). */
function BarrelLight({ run }: { run: SurfRun }) {
   const scene = useThree((s) => s.scene);
   const base = useMemo(() => new Color(LOOKS[run.level].fog), [run.level]);
   const teal = useMemo(() => new Color("#2dd4bf"), []);
   const k = useRef(0);
   useEffect(() => {
      const fog = scene.fog;
      return () => {
         if (fog instanceof Fog) fog.color.copy(base);
      };
   }, [scene, base]);
   useFrame((_s, delta) => {
      const fog = scene.fog;
      if (!(fog instanceof Fog)) return;
      const b = run.boss;
      const tube = (!!b && run.bossOn && b.phase === 2 && bossAlive(run)) || (run.hero.state === "play" && curlGap(run) < 7) ? 1 : 0;
      k.current += (tube - k.current) * (1 - Math.exp(-2.5 * Math.min(0.1, delta)));
      fog.color.copy(base).lerp(teal, k.current * 0.55);
   });
   return null;
}

function SurfCamera({ run, orbit }: { run: SurfRun; orbit: OrbitState }) {
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
         orbitPivot(h.x, Math.max(h.y, groundY(run.course, h.x)), h.z, h.v, out, portraitAmount(aspect));
         return true;
      },
      [run, aspect],
   );
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         const h = run.hero;
         if (h.state !== "play") return;
         orbitTravel(h.v, out);
      },
      [run],
   );
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run, camera.position.x, camera.position.y, camera.position.z, out), [run, camera]);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} solids={solids} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={SURF_COLLISION} />;
}

const SURF_COLLISION = { radius: 0.4, minDistance: 2.2 };

/** The shadow's floor under the rider (the face). */
function GroundProbe({ run, ground }: { run: SurfRun; ground: { current: number } }) {
   useFrame(() => {
      ground.current = groundY(run.course, run.hero.x);
   }, FRAME_PRIORITY.camera);
   return null;
}

/** The boss's slow-mo finish: the visuals only (the hit-stop is its punch; the rules clock never slows). */
function BossSlowMo({ run }: { run: SurfRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, KING_BREAKER.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: SurfRun; anim: HeroAnim }) {
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
      juice.burst("dust", { x: h.x, y: h.y + 0.2, z: h.z }, 26, { color: "#ffffff", vy: 3 });
      juice.burst("pickup", { x: h.x, y: h.y + 0.7, z: h.z }, 16, { color: heroAccent(run.heroId) });
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
   const { config } = useLevel<SurfLevel>();
   const levelId: LevelId = config?.id ?? 1;
   // the picker changes the hero live on the start card (the intro shows the pick); after that a run keeps its hero
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [run]);
   const orbit = useMemo(() => createOrbit(SURF_ORBIT), [run]);
   const won = useRef(false);
   const ground = useRef(0);
   return (
      <JuiceLayer>
         <Wave run={run} clock={clock} />
         <World course={run.course} seed={20261028} view={run.hero} />
         {/* keyed by level: the pools are sized once per mount */}
         <Course key={levelId} run={run} clock={clock} won={won} />
         <Hero run={run} anim={anim} shadowY={ground} />
         <Simulation run={run} anim={anim} clock={clock} won={won} orbit={orbit} />
         <GroundProbe run={run} ground={ground} />
         <SurfCamera run={run} orbit={orbit} />
         <BarrelLight run={run} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}

export { TRICK_NAMES };
