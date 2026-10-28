"use client";

// Color City Sprint's scene: the run (rules.ts) stepped in useRunFrame, the city (World + Course),
// Greyout (Boss), the hero, the free orbit camera (menu2/camera: movement is camera-relative through
// StepInput.yaw), the intro (core/intro, index.tsx `intro: true`), a ground arrow and the HUD feed
// (mini-map, edge arrow) toward the lit beacon, and the juice (menu2/juice): red paint splashing up
// as a leg turns red, a speed ripple into a red lane, the ball's roll, a bus horn and dust on a
// ramp landing, lap-split pops, buildings flashing back to colour, Greyout's hits and its slow-mo
// finish (visual only). Remounted per run (runId). Local multiplayer renders MultiScene.tsx.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Group, type PerspectiveCamera } from "three";
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
import { World } from "./World";
import { Course, type VisualClock } from "./Course";
import { Boss } from "./Boss";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { CITY_COLLISION, FOV, FOV_PORTRAIT, cityOrbit, courseSolids, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { ORB_BONUS_MS, STAT, createRun, createStepInput, guidePoint, step, type CityRun, type StepEvents } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { CitySpec } from "./levels";
import { COMBO, GREYOUT, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import { hudFeed } from "./hudFeed";
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

const HERO_INDEX = { riko: 0, nami: 1, kiro: 2, zuno: 3, vexa: 4 } as const;

export function publishBoss(run: CityRun): void {
   const b = run.boss;
   if (!b) return;
   const store = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   set(STAT.bossHp, b.hp);
   set(STAT.bossPhase, b.phase);
   set(STAT.bossOpen, b.step === "vulnerable" ? 1 : 0);
   set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
   set(STAT.bossOn, b.step === "intro" ? 0 : 1);
}

/** The HUD's numbers that change during a run (written only when they change). */
export function publishRun(run: CityRun): void {
   const store = useArcadeStore.getState();
   const h = run.hero;
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   set(STAT.lap, run.lap);
   set(STAT.beacons, run.beaconIndex);
   set(STAT.orbs, run.orbs);
   set(STAT.mainOrbs, run.mainOrbs);
   set(STAT.hero, HERO_INDEX[run.heroId]);
   set(STAT.power, Math.max(0, Math.ceil((h.powerReadyAt - run.simMs) / 1000)));
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10));
   set(STAT.comboMs, run.combo.bonusTotal);
   set(STAT.red, h.onRed ? 1 : 0);
   set(STAT.speed, Math.round(Math.hypot(h.vx, h.vz) * 10));
   set(STAT.strikes, run.strikes);
   publishBoss(run);
}

function lapText(ms: number): string {
   const s = ms / 1000;
   return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

function Simulation({ run, anim, clock, won, orbit }: { run: CityRun; anim: HeroAnim; clock: VisualClock; won: { current: boolean }; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const trail = useMemo(createJuiceEmitter, []);
   const lapAt = useRef(0);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;
   const accent = heroAccent(run.heroId);

   const react = (ev: StepEvents) => {
      const store = useArcadeStore.getState();
      const h = run.hero;
      const now = time.now;
      chest.x = feet.x = h.x;
      chest.z = feet.z = h.z;
      chest.y = h.y + 1.1;
      feet.y = h.y + 0.1;
      // red paint splashing up behind a ball rolling on red, dust behind a run
      const speed = Math.hypot(h.vx, h.vz);
      if (h.grounded && speed > 4) {
         juice.stream("dust", feet, h.onRed ? 30 : 8, trail, { color: h.onRed ? COLORS.lane : "#d6d3d1", vx: -h.vx * 0.25, vy: 1.6, vz: -h.vz * 0.25, size: h.onRed ? 0.7 : 0.5 });
      }
      if (ev.redEnter) {
         juice.burst("aura", feet, 14, { color: COLORS.laneGlow });
         juice.kick(-h.vx * 0.05, 0, -h.vz * 0.05, 0.6);
         playSfx("whoosh", { volume: 0.35, pitch: 1.4 });
      }
      if (ev.curled) playSfx("whoosh", { volume: 0.3, pitch: 0.8 });
      if (ev.airJumped) {
         anim.airJumpAt = now;
         juice.burst("dust", feet, 12, { color: "#ffffff" });
         playSfx("jump", { volume: 0.6, pitch: 1.25 });
      } else if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.55 });
      }
      if (ev.kicked) {
         juice.burst("dust", feet, 16, { color: "#fde68a", vy: 3 });
         playSfx("whoosh", { volume: 0.5, pitch: 1.2 });
      }
      if (ev.landed) {
         anim.landAt = now;
         const hard = ev.landSpeed > 9;
         juice.burst("dust", feet, hard ? 22 : 8, { color: "#e7e5e4", vy: hard ? 3 : 1.5 });
         if (hard) juice.kick(0, -1, 0, 1.2);
         // a landing on a bus roof gets the horn
         if (h.onBus >= 0) playSfx("chime", { pitch: 0.55, volume: 0.45 });
      }
      if (ev.railOn) {
         juice.popup(chest, "Rail!", { color: "#fecdd3", size: 0.07 });
         juice.burst("aura", chest, 18, { color: "#fb7185" });
         playSfx("chime", { pitch: 1.6 });
      }
      if (ev.powered) {
         juice.burst("pickup", chest, 18, { color: accent });
         juice.burst("aura", chest, 12, { color: accent });
         playSfx("whoosh", { volume: 0.5, pitch: 1.1 });
      }
      if (ev.siteOpened) {
         juice.burst("hit", chest, 30, { color: "#fb923c" });
         juice.burst("dust", chest, 22, { color: "#e7e5e4" });
         juice.popup(chest, "Smash!", { color: "#fdba74", size: 0.08 });
         juice.shake(0.28);
         juice.hitStop(60);
         playSfx("thud");
      }
      if (ev.ghostIn) {
         juice.burst("aura", chest, 20, { color: COLORS.ghost });
         playSfx("whoosh", { volume: 0.4, pitch: 1.6 });
      }
      if (ev.beacon) {
         juice.burst("checkpoint", chest, 40, { color: COLORS.lane });
         juice.shake(0.12);
         playSfx("chime");
         if (ev.painted > 0) juice.popup(chest, `+${ev.painted} red`, { color: "#fecaca", size: 0.06 });
      }
      if (ev.lap) {
         const split = run.simMs - lapAt.current;
         lapAt.current = run.simMs;
         juice.popup({ x: chest.x, y: chest.y + 0.8, z: chest.z }, `Lap ${run.lap + 1} - ${lapText(split)}`, { color: "#ef4444", size: 0.09 });
         juice.hitStop(50);
         playSfx("chime", { pitch: 1.35 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = run.course.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 14, { color: "#fde68a" });
         juice.popup(o, `-${(ORB_BONUS_MS / 1000).toFixed(1)} s`, { color: "#fde68a" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.03) });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spot = run.course.secrets[ev.secretList[k]];
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", spot, 30, { color: spec.kind === "shard" ? COLORS.shard : COLORS.sticker });
         juice.popup(spot, `${spec.name}!`, { color: spec.kind === "shard" ? COLORS.shard : COLORS.sticker, size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.5 });
      }
      if (ev.comboLinked && run.combo.chain > 1) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.4 });
      if (ev.bumped || ev.vented || ev.struck) {
         anim.hurtAt = now;
         anim.hurtX = h.vx;
         anim.hurtZ = h.vz;
         juice.burst("hit", chest, 16, { color: ev.vented ? "#f1f5f9" : "#94a3b8" });
         juice.shake(ev.struck ? 0.3 : 0.15);
         if (ev.struck) juice.hitStop(70);
         playSfx(ev.bumped ? "chime" : "thud", { volume: 0.5, pitch: ev.bumped ? 0.5 : 0.7 });
         if (ev.bumped) juice.popup(chest, "Honk!", { color: "#e0f2fe", size: 0.06 });
      }
      if (ev.shielded) juice.burst("aura", chest, 10, { color: accent });
      if (ev.erased > 0) playSfx("whoosh", { volume: 0.25, pitch: 0.5 });
      if (ev.bossTelegraph) playSfx("whoosh", { volume: 0.4, pitch: 0.6 });
      if (ev.bossAttack) {
         juice.shake(0.15);
         playSfx("thud", { volume: 0.5, pitch: 0.6 });
      }
      if (ev.sprayed) juice.burst("dust", { x: run.truck.x, y: 1.5, z: run.truck.z }, 30, { color: COLORS.sludge, vy: 4 });
      if (ev.bossHit) {
         juice.burst("hit", chest, 30, { color: "#fef08a" });
         juice.popup(chest, ev.slam ? "SLAM!" : "Hit!", { color: "#fef08a", size: 0.09 });
         juice.shake(0.32);
         juice.hitStop(90);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 110, { color: COLORS.lane });
         juice.popup({ x: chest.x, y: chest.y + 1, z: chest.z }, "City repainted!", { color: "#fecaca", size: 0.09 });
         juice.shake(0.45);
      }
      publishRun(run);
      if (ev.finished && !won.current) {
         won.current = true;
         anim.winAt = now;
         juice.burst("checkpoint", chest, 90, { color: COLORS.lane });
         playSfx("chime", { pitch: 0.8 });
         store.setStat(STAT.finishMs, run.finishMs);
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.comboMs, run.combo.bonusTotal);
         const end = levelEndStats(run, userRef.current);
         for (const key of Object.keys(end) as Array<keyof typeof end>) store.setStat(STAT[key], end[key]);
         store.end("win");
      } else if (ev.timeup && !won.current) {
         won.current = true;
         levelEndStats(run, userRef.current);
         store.end("timeup");
      }
   };

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
      react(step(run, dt * 1000, stepInput));
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
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         orbitPivot(run, out);
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
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run, camera.position.x, camera.position.z, out), [run, camera]);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} solids={solids} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={CITY_COLLISION} />;
}

/** A red chevron on the ground round the hero, pointing at the lit beacon; and the HUD's edge arrow. */
function Guide({ run, orbit }: { run: CityRun; orbit: OrbitState }) {
   const ref = useRef<Group>(null);
   const camera = useThree((s) => s.camera);
   const g = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const v = useMemo(() => new Vector3(), []);
   useEffect(() => {
      hudFeed.run = run;
      return () => {
         if (hudFeed.run === run) hudFeed.run = null;
         hudFeed.edge = false;
      };
   }, [run]);
   useFrame(() => {
      const h = run.hero;
      guidePoint(run, g);
      const dx = g.x - h.x;
      const dz = g.z - h.z;
      const d = Math.hypot(dx, dz);
      const grp = ref.current;
      if (grp) {
         grp.visible = d > 3.5 && run.ended === null;
         grp.position.set(h.x + (dx / Math.max(d, 1e-6)) * 1.5, h.y + 0.08, h.z + (dz / Math.max(d, 1e-6)) * 1.5);
         grp.rotation.y = Math.atan2(dx, dz);
      }
      hudFeed.yaw = orbit.viewYaw;
      // the edge arrow: the guide point off screen (or behind the camera)
      v.set(g.x, g.y + 1.5, g.z).project(camera);
      const behind = v.z > 1;
      const off = behind || Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.92;
      hudFeed.edge = off && run.ended === null;
      const ax = behind ? -v.x : v.x;
      const ay = behind ? -v.y : v.y;
      hudFeed.angle = Math.atan2(ay, ax);
   }, FRAME_PRIORITY.visuals);
   return (
      <group ref={ref}>
         <mesh rotation-x={-Math.PI / 2}>
            <coneGeometry args={[0.38, 0.9, 3]} />
            <meshBasicMaterial color={COLORS.laneGlow} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
         </mesh>
      </group>
   );
}

/** The boss's slow-mo finish: visual only (the hit-stop is its punch; the rules clock never slows). */
function BossSlowMo({ run }: { run: CityRun }) {
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
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<CitySpec>();
   const levelId: LevelId = config?.id ?? 1;
   // the picker changes the hero live on the start card; after that a run keeps its hero
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [run]);
   const orbit = useMemo(() => createOrbit(cityOrbit(run.course)), [run]);
   const won = useRef(false);
   return (
      <JuiceLayer>
         <World course={run.course} />
         {/* keyed by level: the pools are sized once per mount */}
         <Course key={levelId} run={run} clock={clock} />
         {run.course.boss ? <Boss run={run} clock={clock} /> : null}
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} clock={clock} won={won} orbit={orbit} />
         <CityCamera run={run} orbit={orbit} />
         <Guide run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
