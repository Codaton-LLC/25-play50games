"use client";

// Lava Pillar Jump's scene: the run (rules.ts) stepped in useRunFrame, the cavern and the pillars, the
// hero (animated by the shared menu2/heroAnim), the free orbit camera (menu2/camera: the player turns
// it; movement is camera-relative through StepInput.yaw) with the heartbeat's FOV breath,
// the intro's camera (core/intro, opted in by index.tsx `intro: true`), and the juice (the shared
// menu2/juice JuiceLayer: pooled particles in at most 3 draw calls, floating time bonuses, camera kicks
// and shake, short hit-stops that only slow the visuals) and sounds: the heartbeat's kick drum and
// camera pulse, geyser launches with a spark column and a short apex hang, steam off a cooling top,
// a crumble, embers, checkpoints, falls, Kalder's slams, hits and his defeat, and the finish.
// Remounted for every run (runId). Local multiplayer runs (2-4 heroes) render MultiScene.tsx instead.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useInput, inputToWorld } from "@/arcade3d/core/input";
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
import { Course, type VisualClock } from "./Course";
import { Hero, createHeroAnim, groundUnder, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, LAVA_ORBIT, courseSolids, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { HEAT, NONE, ORB, STAT, arcVy, createRun, createStepInput, heatAt, lavaAt, lavaBase, step, surgeTelegraph, type LavaRun, type StepEvents } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { LavaLevel } from "./levels";
import { COMBO, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import MultiScene from "./MultiScene";
import { heartbeatJuice, publishBoss } from "./sceneJuice";

/** Preview builds only: `?autoplay=1` lets the honest bot (bot.ts) play, for screenshots and checks. */
function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

function Simulation({ run, anim, clock, won, orbit }: { run: LavaRun; anim: HeroAnim; clock: VisualClock; won: { current: boolean }; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const world = useMemo(() => ({ x: 0, z: 0 }), []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const steam = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;
   const lastOn = useRef(NONE);
   const apexHung = useRef(false);

   useRunFrame((_state, dt) => {
      const i = input.current;
      inputToWorld(i.moveX, i.moveY, 0, world);
      stepInput.moveX = world.x;
      stepInput.moveZ = world.z;
      // camera-relative movement: the rules turn the stick by the orbit camera's drawn yaw (part of
      // the step input, so a replay or a bot with the same inputs gets the same run)
      stepInput.yaw = orbit.viewYaw;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.actionPressed = i.actionPressed;
      if (bot) {
         // the bot steers in world space
         stepInput.yaw = 0;
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
      chest.y = h.y + 0.7;
      feet.y = h.y + 0.1;
      heartbeatJuice(juice, run, ev, chest, feet);
      if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.6 });
      }
      if (ev.powered) {
         juice.burst("pickup", chest, 20, { color: heroAccent(run.heroId) });
         juice.burst("aura", chest, 14, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.55, pitch: 1.15 });
      }
      if (ev.vented) {
         anim.bounceAt = now;
         apexHung.current = false;
      }
      // the vent flight's apex: a short visual hang (hit-stop slows only the visuals)
      if (h.ventFlight && !apexHung.current && !h.grounded && arcVy(h, run.simMs) <= 0) {
         apexHung.current = true;
         juice.hitStop(140);
         juice.burst("pickup", chest, 10, { color: "#ffb347" });
      }
      if (ev.landed) {
         anim.landAt = now;
         juice.burst("dust", feet, 9);
         juice.kick(0, -1, 0, 1.2);
      }
      // steam off a top that was hot when the hero left it
      const on = h.grounded ? h.support : NONE;
      if (on !== lastOn.current) {
         const prev = lastOn.current;
         if (prev !== NONE && run.course.supports[prev].heat && heatAt(run, prev, run.simMs) > HEAT.orangeMs * 0.6) {
            const s = run.course.supports[prev];
            steam.x = s.cx;
            steam.y = s.top + 0.2;
            steam.z = s.cz;
            juice.burst("dust", steam, 16, { color: "#e7e5e4", vy: 2.5 });
            playSfx("whoosh", { volume: 0.25, pitch: 1.8 });
         }
         lastOn.current = on;
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = run.course.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 14, { color: "#ffb347" });
         juice.popup(o, `-${(ORB.bonusMs / 1000).toFixed(1)} s`, { color: "#ffe08a" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.03) });
      }
      if (ev.orbCount > 0) store.setStat(STAT.orbs, run.orbs);
      for (let k = 0; k < ev.secretCount; k++) {
         const spot = run.course.secrets[ev.secretList[k]];
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", spot, 30, { color: spec.kind === "shard" ? "#fecaca" : "#f9a8d4" });
         juice.burst("pickup", spot, 24);
         juice.popup(spot, `${spec.name}!`, { color: spec.kind === "shard" ? "#fecaca" : "#f9a8d4", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      // the flow meter: link sound, and the HUD numbers (chain, multiplier x100, window in tenths)
      if (ev.comboLinked && run.combo.chain > 1) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.45 });
      if (ev.comboBonus > 0) store.setStat(STAT.comboMs, run.combo.bonusTotal);
      const flow = Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10);
      if (store.stats[STAT.comboChain] !== run.combo.chain) store.setStat(STAT.comboChain, run.combo.chain);
      const mult = Math.round(run.combo.multiplier * 100);
      if (store.stats[STAT.comboMult] !== mult) store.setStat(STAT.comboMult, mult);
      if (store.stats[STAT.comboFlow] !== flow) store.setStat(STAT.comboFlow, flow);
      if (ev.checkpoint > 0) {
         juice.burst("checkpoint", chest, 46, { color: "#facc15" });
         juice.burst("pickup", chest, 16);
         juice.popup(chest, "Crystal!", { color: "#ffd257", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime");
         store.setStat(STAT.checkpoint, ev.checkpoint);
      }
      if (ev.lost) {
         anim.lostAt = now;
         juice.burst("hit", chest, 16, { color: "#ff5a1f" });
         juice.burst("dust", feet, 10);
         juice.shake(0.28);
         juice.hitStop(90);
         playSfx("lose", { volume: 0.5 });
         store.setStat(STAT.falls, run.respawns + 1);
      }
      if (ev.respawned) {
         anim.spawnAt = now;
         juice.burst("pickup", chest, 22, { color: heroAccent(run.heroId) });
         juice.popup(chest, "+fall time", { color: "#fca5a5" });
         playSfx("pop");
      }
      if (ev.crumbled !== NONE) store.setStat(STAT.crumbles, run.crumbles);
      const height = Math.round(Math.max(0, run.bestTop));
      if (store.stats[STAT.height] !== height) store.setStat(STAT.height, height);
      const heroStat = run.heroId === "nami" ? 1 : run.heroId === "kiro" ? 2 : run.heroId === "zuno" ? 3 : run.heroId === "vexa" ? 4 : 0;
      if (store.stats[STAT.hero] !== heroStat) store.setStat(STAT.hero, heroStat);
      const powerLeft = Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000));
      if (store.stats[STAT.power] !== powerLeft) store.setStat(STAT.power, powerLeft);
      publishBoss(run);
      if (ev.finished) {
         won.current = true;
         anim.winAt = now;
         juice.burst("checkpoint", chest, 110);
         juice.burst("pickup", chest, 40);
         juice.shake(0.2);
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.finishMs, run.finishMs);
         store.setStat(STAT.comboMs, run.combo.bonusTotal);
         // stars, the no-hit badge and secrets go to Menu 2 progress (menu2/progress, never localStorage here)
         const end = levelEndStats(run, userRef.current);
         for (const key of Object.keys(end) as Array<keyof typeof end>) store.setStat(STAT[key], end[key]);
         store.end("win");
      } else if (ev.lava) {
         levelEndStats(run, userRef.current); // keeps the secrets found; no star without a clear
         store.end("lose");
      } else if (ev.timeup) {
         levelEndStats(run, userRef.current);
         store.end("timeup");
      }
   });

   // the visual clock: the movers at rules time while playing; arriving at 0 on "Go"; moving after the end
   useFrame(() => {
      const s = useArcadeStore.getState();
      if (s.phase === "countdown") clock.ms = -s.countdownMs;
      else if (s.phase === "ready") clock.ms = time.now * 1000;
      else if (s.phase === "over") clock.ms = run.simMs + s.overMs;
      else clock.ms = run.simMs;
   }, FRAME_PRIORITY.camera);
   return null;
}

/**
 * The shared Menu 2 orbit camera (menu2/camera) round the hero: the pivot leads towards the next pillar
 * (in Kalder's ring, towards the golem) and holds still while the hero falls out of view; pillars pull
 * the camera in. The heartbeat still breathes the FOV (the orbit never sets it).
 */
function LavaCamera({ run, orbit, clock }: { run: LavaRun; orbit: OrbitState; clock: VisualClock }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const lastSupport = useRef(run.course.checkpoints[0]);
   const aspect = size.width / Math.max(1, size.height);
   const baseFov = aspect < 1 ? FOV_PORTRAIT : FOV;
   useEffect(() => {
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
   }, [camera, baseFov]);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         const h = run.hero;
         const course = run.course;
         const a = course.arena;
         // the next pillar after the one last stood on (kept through jumps and launches), for the lead
         if (h.grounded && h.support >= 0) lastSupport.current = h.support;
         else if (h.state !== "play") lastSupport.current = course.checkpoints[run.checkpoint];
         const falling = h.state === "lost" || (!h.grounded && h.y < h.lastTop - 3);
         if (falling) return false;
         const inRing = a && run.bossStartMs !== NONE;
         const next = course.supports[Math.min(course.route - 1, lastSupport.current + 1)];
         const nx = inRing ? a.cx : next.cx;
         const ny = inRing ? a.top + 4 : next.top;
         const nz = inRing ? a.cz : next.cz;
         orbitPivot(h.x, Math.max(h.y, h.lastTop - 1), h.z, nx, ny, nz, out);
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
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run, clock.ms, camera.position.x, camera.position.y, camera.position.z, out), [run, clock, camera]);
   // the heartbeat breathes the FOV: in on the telegraph, out with the surge; +6 deg in a vent's flight
   useFrame((_state, delta) => {
      const h = run.hero;
      const course = run.course;
      const dt = Math.min(0.1, delta);
      const ms = Math.max(0, run.simMs);
      const tele = run.bossStartMs === NONE ? surgeTelegraph(course, ms) : 0;
      const surge = Math.max(0, lavaAt(run, ms) - lavaBase(course, ms)) / 1.2;
      const fov = baseFov - 1.5 * tele + 2.5 * surge + (h.ventFlight && !h.grounded ? 6 : 0);
      if (Math.abs(camera.fov - fov) > 0.05) {
         camera.fov += (fov - camera.fov) * (1 - Math.exp(-8 * dt));
         camera.updateProjectionMatrix();
      }
   }, FRAME_PRIORITY.camera);
   return (
      <OrbitCamera
         orbit={orbit}
         pivot={pivot}
         travel={travel}
         solids={solids}
         lookUp={orbitLookUp(aspect)}
         distanceScale={orbitScale(aspect)}
         collision={LAVA_COLLISION}
      />
   );
}

const LAVA_COLLISION = { radius: 0.35, minDistance: 1.6 };

/** The shadow's floor under the hero, written before the visuals draw. */
function GroundProbe({ run, clock, ground }: { run: LavaRun; clock: VisualClock; ground: { current: number } }) {
   useFrame(() => {
      const h = run.hero;
      ground.current = groundUnder(run, h.x, h.z, h.y, clock.ms);
   }, FRAME_PRIORITY.camera);
   return null;
}

/** The core intro's camera and the hero's drop (only while the shell plays the intro). */
function IntroCamera({ run, anim }: { run: LavaRun; anim: HeroAnim }) {
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
      juice.burst("dust", { x: h.x, y: h.y + 0.1, z: h.z }, 18);
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
   const { config } = useLevel<LavaLevel>();
   const levelId: LevelId = config?.id ?? 1;
   // runId remounts the Scene; the seed only places decor (the course is the same race for everyone)
   // the picker changes the hero live: the start card and the intro show the picked hero before Play
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   // on the start card the pick shows at once; after that it is the next run's option (the picker
   // also opens in the pause menu and on the result screen): a run keeps the hero it started with
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const decorSeed = 20261025;
   const anim = useMemo(createHeroAnim, [run]);
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [run]);
   const won = useRef(false);
   const ground = useRef(0);
   // one orbit per run: it starts (like the intro's last shot) behind the hero
   const orbit = useMemo(() => createOrbit(LAVA_ORBIT), [run]);
   return (
      <JuiceLayer>
         <World course={run.course} seed={decorSeed} levelId={levelId} />
         <Course run={run} clock={clock} won={won} />
         <Hero run={run} anim={anim} ground={ground} />
         <Simulation run={run} anim={anim} clock={clock} won={won} orbit={orbit} />
         <GroundProbe run={run} clock={clock} ground={ground} />
         <LavaCamera run={run} orbit={orbit} clock={clock} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

/** Local multiplayer runs (menu2/multiplayer) get their own scene; everything else is the solo one. */
export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
