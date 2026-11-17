"use client";

// Color Rail Grind's scene: the run (rules.ts) stepped in useRunFrame, the valley (World.tsx), the line
// (Course.tsx), the hero (Hero.tsx, menu2/heroAnim), the free orbit camera (menu2/camera: two fingers /
// mouse drag / wheel / pinch; hops are camera-relative through StepInput.yaw; one finger stays a swipe,
// a tap on the view throws the lit switch), the intro (core/intro) and the juice (menu2/juice): grind
// sparks under the hero (icy blue on frozen rails), a switch's clunk and tick, the hop's whoosh, a buffer
// stop's crash with a camera kick and toy springs flying, the hook's swing, the rings' chime, and on
// level 5 the Express's whistle, its crashes, the wagons, the roof stomps and its slow-mo finish.
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
import { RAIL_ORBIT, FOV, FOV_PORTRAIT, portraitAmount, courseSolids, introKeyframes, orbitLookUp, orbitPivot, orbitScale, orbitTravel, playCamera } from "./camera";
import {
   GRID,
   NONE,
   STAT,
   bossVulnerable,
   branchCode,
   createRun,
   createStepInput,
   distanceOf,
   laneX,
   litArenaSwitch,
   litSwitch,
   relightOf,
   runTimeMs,
   step,
   upcomingSwitches,
   type RailRun,
   type StepEvents,
} from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { RailLevel } from "./levels";
import { CLOCKWORK, COMBO, SECRETS } from "./progression";
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

const HERO_STAT = { riko: 0, nami: 1, kiro: 2, zuno: 3, vexa: 4 } as const;
const MAP = [NONE, NONE];

/** Publishes the HUD's numbers that change every frame (only when they change). */
export function publishRun(run: RailRun): void {
   const store = useArcadeStore.getState();
   const h = run.hero;
   const c = run.course;
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   set(STAT.orbs, run.orbs);
   set(STAT.mainOrbs, run.mainOrbs);
   set(STAT.rings, run.rings);
   set(STAT.distance, Math.round(distanceOf(run)));
   set(STAT.speed, Math.round(h.v * 10));
   set(STAT.hero, HERO_STAT[run.heroId]);
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
   set(STAT.relight, Math.round(relightOf(run) * 100));
   set(STAT.bonks, run.bonks + run.falls);
   const j = litSwitch(run);
   const a = litArenaSwitch(run);
   set(STAT.switchLit, j !== NONE || a !== NONE ? 1 : 0);
   set(STAT.switchFrozen, j !== NONE && c.junctions[j].frozen ? 1 : 0);
   set(STAT.switchThrown, j !== NONE ? run.board.thrown[j] : a !== NONE ? run.arenaThrown[a] : 0);
   upcomingSwitches(run, MAP);
   set(STAT.map1, MAP[0] === NONE ? 0 : branchCode(c, MAP[0]));
   set(STAT.map2, MAP[1] === NONE ? 0 : branchCode(c, MAP[1]));
   set(STAT.map1Thrown, MAP[0] === NONE ? 0 : run.board.thrown[MAP[0]]);
   set(STAT.map2Thrown, MAP[1] === NONE ? 0 : run.board.thrown[MAP[1]]);
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10));
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
export function juiceEvents(run: RailRun, ev: StepEvents, anim: HeroAnim, juice: ReturnType<typeof useJuice>, now: number, tag = ""): void {
   const h = run.hero;
   const c = run.course;
   const chest = { x: h.x, y: h.y + 1.1, z: h.z };
   const feet = { x: h.x, y: h.y + 0.1, z: h.z };
   if (ev.airJumped) {
      anim.airJumpAt = now;
      juice.burst("dust", feet, 12, { color: "#e0f2fe" });
      playSfx("jump", { volume: 0.6, pitch: 1.25 });
   } else if (ev.jumped) {
      anim.jumpAt = now;
      juice.burst("hit", feet, 8, { color: "#fde68a" });
      playSfx("jump", { volume: 0.5 });
   }
   if (ev.landed) {
      anim.landAt = now;
      juice.burst("hit", feet, 10, { color: "#fde68a" });
      playSfx("click", { volume: 0.35, pitch: 0.8 });
   }
   if (ev.hopped) playSfx("whoosh", { volume: 0.3, pitch: 1.5 });
   if (ev.hopBlocked) playSfx("click", { volume: 0.25, pitch: 0.6 });
   if (ev.crouched) playSfx("whoosh", { volume: 0.2, pitch: 0.7 });
   if (ev.thrown !== NONE) {
      playSfx("click", { volume: 0.7, pitch: 0.7 });
      playSfx("chime", { volume: 0.3, pitch: 1.6 });
      juice.kick(0, -1, 0, 1);
   }
   if (ev.frozenClunk) {
      juice.popup(chest, `${tag}Frozen! Jump and stomp`, { color: "#bae6fd", size: 0.06 });
      playSfx("thud", { volume: 0.4, pitch: 1.4 });
   }
   if (ev.junction !== NONE && ev.junctionResult === 2) {
      juice.burst("hit", feet, 18, { color: "#fde68a" });
      playSfx("whoosh", { volume: 0.4, pitch: 1.1 });
   }
   if (ev.bonked) {
      anim.hurtAt = now;
      const kind = ev.bonkKind;
      // a buffer stop: toy springs fly, the camera kicks
      juice.burst("dust", chest, 30, { color: "#cbd5e1", vy: 3 });
      juice.burst("hit", chest, kind === 0 ? 30 : 16, { color: "#facc15", vy: 4 });
      juice.popup(chest, `${tag}${kind === 0 ? "Buffer stop! -3 s" : kind === 3 ? "Bump!" : kind === 4 ? "Steam!" : "Blocked!"}`, { color: "#fecaca", size: 0.08 });
      juice.kick(0, 0, 1, 3);
      juice.shake(0.35);
      juice.hitStop(90);
      playSfx("thud", { volume: 0.7, pitch: 0.7 });
   }
   if (ev.hooked) {
      anim.fallAt = now;
      juice.popup(chest, `${tag}Hooked! -2 s`, { color: "#e5e7eb", size: 0.08 });
      playSfx("whoosh", { volume: 0.5, pitch: 0.5 });
   }
   if (ev.stumbled) {
      anim.stumbleAt = now;
      juice.burst("dust", chest, 22, { color: "#e0f2fe" });
      juice.popup(chest, `${tag}Icicles!`, { color: "#bae6fd", size: 0.06 });
      juice.shake(0.2);
      playSfx("thud", { volume: 0.5, pitch: 1.3 });
   }
   if (ev.smashed) {
      juice.burst("hit", chest, 40, { color: "#fb923c" });
      juice.burst("dust", chest, 26, { color: "#a0703f" });
      juice.popup(chest, `${tag}Smash!`, { color: "#fdba74", size: 0.09 });
      juice.shake(0.3);
      playSfx("thud", { pitch: 1.1 });
   }
   if (ev.phased) {
      juice.burst("aura", chest, 30, { color: "#c4b5fd" });
      juice.popup(chest, `${tag}Ghost door!`, { color: "#ddd6fe", size: 0.08 });
      playSfx("chime", { pitch: 1.9, volume: 0.5 });
   }
   if (ev.looped) {
      anim.loopAt = run.simMs;
      juice.burst("aura", chest, 30, { color: "#facc15" });
      juice.popup(chest, `${tag}Loop!`, { color: "#fde68a", size: 0.09 });
      playSfx("whoosh", { volume: 0.7, pitch: 0.9 });
   }
   if (ev.powered || ev.dashed) {
      juice.burst("pickup", chest, 18, { color: heroAccent(run.heroId) });
      juice.burst("aura", chest, 12, { color: heroAccent(run.heroId) });
      playSfx("whoosh", { volume: 0.55, pitch: 1.15 });
   }
   for (let k = 0; k < Math.min(ev.orbCount, ev.orbList.length); k++) {
      const o = c.orbs[ev.orbList[k]];
      juice.burst("pickup", { x: h.x, y: o.y, z: o.z }, 14, { color: o.kind === "main" ? "#ffd257" : "#f9a8d4" });
      juice.popup({ x: h.x, y: o.y + 0.3, z: o.z }, `${tag}-0.15 s`, { color: "#fde68a", size: 0.045 });
      playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.015) });
   }
   if (ev.ringCount > 0) {
      juice.burst("checkpoint", chest, 24, { color: "#ffd257" });
      playSfx("chime", { pitch: 1.3, volume: 0.5 });
   }
   for (let k = 0; k < ev.secretCount; k++) {
      const i = ev.secretList[k];
      const spec = SECRETS[run.level][i];
      juice.burst("checkpoint", chest, 30, { color: spec.kind === "shard" ? "#ddd6fe" : "#fde68a" });
      juice.popup(chest, `${spec.name}!`, { color: spec.kind === "shard" ? "#ddd6fe" : "#fde68a", size: 0.07 });
      juice.hitStop(40);
      playSfx("chime", { pitch: 1.4 });
   }
   if (ev.trainCrashed !== NONE) {
      const t = run.trains[ev.trainCrashed];
      juice.burst("hit", { x: t.x, y: 1, z: t.z }, 40, { color: "#facc15" });
      juice.burst("dust", { x: t.x, y: 1, z: t.z }, 30, { color: "#cbd5e1" });
      playSfx("boom", { volume: 0.5, pitch: 1.2 });
   }
   // level 5: the Express
   const e = run.express;
   const loco = { x: e.x, y: 2.4, z: e.z };
   if (ev.bossTelegraph) playSfx("whoosh", { volume: 0.4, pitch: 0.5 });
   if (ev.expressCrashed) {
      juice.burst("hit", loco, 60, { color: "#facc15", vy: 5 });
      juice.burst("dust", loco, 40, { color: "#cbd5e1" });
      juice.popup(chest, `${tag}Crash!`, { color: "#fde68a", size: 0.1 });
      juice.kick(0, 0, -1, 3);
      juice.shake(0.45);
      juice.hitStop(110);
      playSfx("boom", { volume: 0.8 });
   }
   if (ev.wagonDropped) {
      juice.popup({ x: laneX(run.wagon.lane), y: 2, z: run.wagon.z }, `${tag}Wagon!`, { color: "#fecaca", size: 0.08 });
      playSfx("thud", { volume: 0.5, pitch: 0.6 });
   }
   if (ev.launched) {
      juice.burst("hit", feet, 30, { color: "#fde68a", vy: 4 });
      playSfx("whoosh", { volume: 0.8, pitch: 0.8 });
   }
   if (ev.roofLanded) {
      juice.popup(chest, `${tag}On the roof! Stomp the key`, { color: "#fde68a", size: 0.07 });
      juice.shake(0.25);
   }
   if (ev.stomped) {
      juice.burst("hit", feet, 24, { color: "#facc15" });
      juice.kick(0, -1, 0, 2);
      playSfx("thud", { pitch: 1.2 });
   }
   if (ev.knockedOff) juice.burst("dust", chest, 40, { color: "#f1f5f9", vy: 3 });
   if (ev.bossHit) {
      juice.burst("hit", loco, 40, { color: "#fde047" });
      juice.shake(0.35);
      juice.hitStop(90);
      playSfx("chime", { pitch: 0.6, volume: 0.7 });
   }
   if (ev.bossDefeated) {
      juice.burst("checkpoint", loco, 140, { color: "#facc15" });
      juice.popup(chest, `${tag}The key spins out!`, { color: "#fde68a", size: 0.1 });
      juice.shake(0.5);
      juice.hitStop(Math.min(140, CLOCKWORK.slowMo.durationMs));
   }
   if (ev.comboLinked && run.combo.chain > 2) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.35 });
}

function Simulation({ run, anim, orbit }: { run: RailRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const sparks = useMemo(createJuiceEmitter, []);
   const tickAt = useRef(-1);
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
      stepInput.switchPressed = i.tap !== null;
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
      // the grind sparks under the hero (icy blue on frozen rails)
      if (h.grounded && h.v > 1 && run.simMs >= h.bonkUntil) {
         const p = h.piece !== NONE ? run.course.pieces[h.piece] : null;
         juice.stream("hit", { x: h.x, y: h.y + 0.05, z: h.z + 0.3 }, 26 + h.v * 1.5, sparks, { color: p && p.frozen ? "#7dd3fc" : "#fbbf24", vz: h.v * 0.4, vy: 1.5, size: 0.06 });
      }
      // the lit switch ticks (the card: audio ticks so a switch is not missed at speed)
      const lit = litSwitch(run);
      if (lit !== NONE && now - tickAt.current > 0.3) {
         tickAt.current = now;
         playSfx("click", { volume: 0.25, pitch: 1.8 });
      }
      publishRun(run);
      if (ev.finished) {
         anim.winAt = now;
         juice.burst("checkpoint", { x: h.x, y: 1.2, z: h.z }, 110, { color: "#ffd257" });
         juice.shake(0.2);
         playSfx("chime", { pitch: 0.75 });
         store.setStat(STAT.finishMs, run.finishMs);
         store.setStat(STAT.submitted, runTimeMs(run));
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

function RailCamera({ run, orbit }: { run: RailRun; orbit: OrbitState }) {
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
         orbitPivot(h.x, Math.min(h.y, 4), h.z, h.v, out, Math.cos(orbit.viewYaw));
         out.x *= 1 - 0.5 * portraitAmount(aspect);
         return true;
      },
      [run, orbit, aspect],
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
         distanceScale={orbitScale(aspect, GRID)}
         collision={{ radius: 0.4, minDistance: 2.2 }}
      />
   );
}

/** The Express's slow-mo finish: the visuals only (the rules clock never slows). */
function BossSlowMo({ run }: { run: RailRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, CLOCKWORK.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: RailRun; anim: HeroAnim }) {
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
      juice.burst("hit", { x: h.x, y: 0.2, z: h.z }, 26, { color: "#fde68a", vy: 3 });
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
   const { config } = useLevel<RailLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(RAIL_ORBIT), [run]);
   return (
      <JuiceLayer>
         <World course={run.course} view={run.hero} />
         <Course key={levelId} run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <RailCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
