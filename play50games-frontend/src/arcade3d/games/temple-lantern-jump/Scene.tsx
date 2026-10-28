"use client";

// Temple Lantern Jump's scene: the run (rules.ts) stepped in useRunFrame, the shaft (World), the climb
// (Course), the Queen, the hero (menu2/heroAnim), the free orbit camera (menu2/camera: the stick is
// camera-relative through StepInput.yaw = orbit.viewYaw), the intro (core/intro) and the juice
// (menu2/juice): every lantern lights with a warm flash, ember sparks, a camera kick and a chime that
// rises with the chain; glyph ledges draw their gold lines (Course); a gust, a snuffed lantern, a
// stunned bat, the Queen's blackout and her hits each have their own burst, sound and popup.
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
import { comboFlow } from "@/arcade3d/menu2/combo/combo";
import { playSfx } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit } from "@/arcade3d/menu2/camera/orbit";
import { OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import World from "./World";
import { Course } from "./CourseView";
import Queen from "./Queen";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, courseSolids, heroPivot, introKeyframes, orbitLookUp, orbitScale, playCamera, templeOrbit } from "./camera";
import { STAT, createRun, createStepInput, flowOf, queenPos, step, bossVulnerable, type StepEvents, type TempleRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { TempleLevel } from "./levels";
import { COMBO, QUEEN, SECRETS } from "./progression";
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
const Q = { x: 0, y: 0, z: 0 };

export function publishBoss(run: TempleRun): void {
   const b = run.boss;
   if (!b) return;
   const store = useArcadeStore.getState();
   const open = bossVulnerable(run) ? 1 : 0;
   const flash = b.flashMs > 0 ? 1 : 0;
   if (store.stats[STAT.bossHp] !== b.hp) store.setStat(STAT.bossHp, b.hp);
   if (store.stats[STAT.bossPhase] !== b.phase) store.setStat(STAT.bossPhase, b.phase);
   if (store.stats[STAT.bossOpen] !== open) store.setStat(STAT.bossOpen, open);
   if (store.stats[STAT.bossFlash] !== flash) store.setStat(STAT.bossFlash, flash);
   if (store.stats[STAT.relights] !== run.relights) store.setStat(STAT.relights, run.relights);
}

/** The juice and sounds of one step's events (solo and, quieter, multiplayer). */
export function useTempleJuice() {
   const juice = useJuice();
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const spot = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   return (run: TempleRun, ev: StepEvents, anim: HeroAnim, now: number, loud = 1) => {
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
      if (ev.landed >= 0 && ev.bounced < 0) {
         anim.landAt = now;
         juice.burst("dust", feet, 8, { color: "#cdbf9a" });
         juice.kick(0, -1, 0, 1.2 * loud);
         playSfx("thud", { volume: 0.4 * loud });
      }
      if (ev.bounced >= 0) {
         anim.landAt = now;
         const p = c.pads[ev.bounced];
         spot.x = p.x;
         spot.y = p.y - 0.3;
         spot.z = p.z;
         juice.burst("pickup", spot, 16, { color: COLORS.lantern });
         juice.burst("hit", spot, 10, { color: COLORS.ember });
         juice.kick(0, 1, 0, 2.6 * loud);
         // the chime rises with the chain (the card): a lit lantern is a pitch-rising chime
         playSfx("chime", { pitch: 0.9 + Math.min(0.9, run.combo.chain * 0.12), volume: 0.6 * loud });
         playSfx("jump", { pitch: 0.7, volume: 0.45 * loud });
      }
      if (ev.ignited >= 0 && ev.bounced < 0) {
         const p = c.pads[ev.ignited];
         spot.x = p.x;
         spot.y = p.y - 0.4;
         spot.z = p.z;
         juice.burst("checkpoint", spot, 22, { color: COLORS.lantern });
         juice.popup(spot, "Lit!", { color: "#ffd9a0", size: 0.06 });
         playSfx("chime", { pitch: 1.5, volume: 0.5 * loud });
      }
      if (ev.comboLinked && ev.comboBonus > 0) juice.popup(chest, `Chain x${run.combo.multiplier.toFixed(2)}`, { color: "#fde68a", size: 0.05 });
      if (ev.threw) {
         juice.burst("hit", chest, 12, { color: COLORS.ember });
         playSfx("whoosh", { pitch: 1.2, volume: 0.5 * loud });
      }
      if (ev.flared) juice.popup(chest, "Flare!", { color: "#ffb347", size: 0.06 });
      if (ev.powered) {
         juice.burst("aura", chest, 16, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.55 * loud, pitch: 1.1 });
      }
      if (ev.emberLow) {
         juice.popup(chest, "Ember low!", { color: "#fca5a5", size: 0.06 });
         playSfx("click", { pitch: 1.8, volume: 0.7 * loud });
      }
      if (ev.emberOut) {
         juice.burst("dust", chest, 14, { color: "#5a4a3a" });
         playSfx("buzz", { volume: 0.35 * loud, pitch: 0.7 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = c.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 14, { color: "#4ade80" });
         juice.popup(o, "-0.1 s", { color: "#bbf7d0" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.08), volume: loud });
      }
      for (let k = 0; k < ev.sparkCount; k++) {
         juice.burst("pickup", chest, 12, { color: COLORS.ember });
         juice.popup(chest, "+2 s ember", { color: "#ffb347", size: 0.06 });
         playSfx("pickup", { pitch: 1.3, volume: 0.5 * loud });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 30, { color: spec.kind === "shard" ? "#c4b5fd" : "#f9a8d4" });
         juice.popup(chest, `${spec.name}!`, { color: "#f9a8d4", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.brazier >= 0) {
         const b = c.braziers[ev.brazier];
         spot.x = b.x;
         spot.y = b.y + 0.8;
         spot.z = b.z;
         juice.burst("checkpoint", spot, 40, { color: COLORS.jet });
         juice.popup(spot, "The shaft is lit! 20 s", { color: "#ffd9a0", size: 0.07 });
         juice.shake(0.2 * loud);
         playSfx("combo", { pitch: 0.9, volume: 0.6 * loud });
      }
      if (ev.gust) {
         juice.popup(chest, "Gust!", { color: "#bbf7d0", size: 0.07 });
         playSfx("whoosh", { pitch: 0.6, volume: 0.6 * loud });
      }
      if (ev.snuffed > 0 && !ev.bossAttack) playSfx("click", { pitch: 0.6, volume: 0.4 * loud });
      if (ev.stunned >= 0) {
         juice.burst("hit", chest, 16, { color: "#c4b5fd" });
         juice.popup(chest, "Stunned!", { color: "#ddd6fe", size: 0.06 });
         juice.hitStop(50);
         playSfx("pop", { pitch: 1.2, volume: 0.6 * loud });
      }
      if (ev.crumbled >= 0) {
         const p = c.pads[ev.crumbled];
         spot.x = p.x;
         spot.y = p.y;
         spot.z = p.z;
         juice.burst("dust", spot, 20, { color: "#8a5a2b" });
         playSfx("thud", { pitch: 0.6, volume: 0.5 * loud });
      }
      if (ev.hurt !== "") {
         anim.hurtAt = now;
         juice.burst("hit", chest, 18, { color: ev.hurt === "jet" ? COLORS.jet : undefined });
         juice.shake(0.22 * loud);
         juice.hitStop(70);
         playSfx("hit", { volume: 0.5 * loud });
      }
      if (ev.respawned) {
         anim.spawnAt = now;
         juice.burst("pickup", chest, 20, { color: heroAccent(run.heroId) });
         juice.popup(chest, ev.hurt === "fall" || ev.hurt === "" ? "Back at the lantern" : "Back at the lantern", { color: "#fca5a5", size: 0.05 });
         playSfx("pop");
      }
      if (ev.bossTelegraph) playSfx("whoosh", { pitch: 0.5, volume: 0.4 * loud });
      if (ev.bossAttack) {
         queenPos(run, Q);
         juice.popup(Q, run.boss?.phase === 0 ? "Blackout!" : "She dives!", { color: "#fecaca", size: 0.08 });
         juice.shake(0.3 * loud);
         playSfx("thud", { pitch: 0.5, volume: 0.7 * loud });
      }
      if (ev.bossHit) {
         queenPos(run, Q);
         juice.burst("hit", Q, 34, { color: "#fef08a" });
         juice.popup(Q, ev.bossDefeated ? "The Queen falls!" : "Hit!", { color: "#fde68a", size: 0.08 });
         juice.shake(0.32);
         juice.hitStop(90);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossPhase && !ev.bossDefeated && run.boss) juice.popup(chest, QUEEN.phases[run.boss.phase]?.name ?? "", { color: "#fde68a", size: 0.07 });
      if (ev.bossDefeated) {
         queenPos(run, Q);
         juice.burst("checkpoint", Q, 120, { color: "#ffd36a" });
         juice.burst("checkpoint", Q, 80, { color: "#4ade80" });
         juice.shake(0.5);
         juice.hitStop(140);
      }
   };
}

function Simulation({ run, anim, orbit }: { run: TempleRun; anim: HeroAnim; orbit: ReturnType<typeof createOrbit> }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const effects = useTempleJuice();
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
      const h = run.hero;
      const now = time.now;
      effects(run, ev, anim, now);
      const set = (key: string, value: number) => {
         if (store.stats[key] !== value) store.setStat(key, value);
      };
      set(STAT.ember, Math.ceil(run.ember / 100));
      set(STAT.emberMax, Math.round(run.course.cfg.emberMs / 100));
      set(STAT.lanterns, run.lanternsLit);
      set(STAT.orbs, run.orbs);
      set(STAT.hits, run.hits);
      set(STAT.comboMs, run.combo.bonusTotal);
      set(STAT.comboChain, run.combo.chain);
      set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
      set(STAT.comboFlow, Math.ceil(flowOf(run) * 10));
      set(STAT.hero, HERO_IDS.indexOf(run.heroId));
      set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
      publishBoss(run);
      void comboFlow;
      void COMBO;
      if (ev.finished) {
         anim.winAt = now;
         if (!ev.bossDefeated) {
            juice.burst("checkpoint", h, 110);
            juice.burst("pickup", h, 40, { color: "#ffd36a" });
            juice.popup(h, "The roof!", { color: "#fde68a", size: 0.09 });
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

/** The orbit camera round the hero, the pivot on his chest led up the climb. */
function TempleCamera({ run, orbit }: { run: TempleRun; orbit: ReturnType<typeof createOrbit> }) {
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

const COLLISION = { radius: 0.35, minDistance: 2 };

/** The Queen's slow-mo finish: the visuals only (menu2/boss through the juice clock). */
function BossSlowMo({ run }: { run: TempleRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, QUEEN.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: TempleRun; anim: HeroAnim }) {
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
   const { config } = useLevel<TempleLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(templeOrbit(run.course)), [run]);
   return (
      <JuiceLayer>
         <World run={run} />
         <Course key={levelId} run={run} />
         <Queen run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <TempleCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
