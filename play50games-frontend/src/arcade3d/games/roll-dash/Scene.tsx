"use client";

// Roll Dash's scene: the run (rules.ts) stepped in useRunFrame, the town and the fortress (World), the
// street (StreetView), the Echo Storm Hawk (level 5), the active hero (menu2/heroAnim), the free orbit
// camera (menu2/camera; the lanes stay screen-relative: laneSign), the intro (core/intro) and the juice
// (menu2/juice): every lock shatters into its hero's colour with that hero's chime (a clean chain plays a
// rising melody), a camera kick on a full lock, a prism burst on every tag (a bigger one on a Hand-off),
// a speed-line push during a boost, the Hawk's bursts and its slow-mo shatter. Remounted for every run
// (runId). Local multiplayer runs render MultiScene.tsx instead.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useInput } from "@/arcade3d/core/input";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, useJuice } from "@/arcade3d/menu2/juice";
import { playSfx } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import World from "./World";
import { Street } from "./StreetView";
import Hawk from "./Hawk";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, dashOrbit, heroPivot, introKeyframes, laneSign, orbitLookUp, orbitScale, playCamera } from "./camera";
import { STAT, bossVulnerable, canTag, createRun, createStepInput, flowOf, speedOf, step, type DashRun, type StepEvents } from "./rules";
import { HERO_IDS, pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { DashLevel } from "./levels";
import { HAWK, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import { HERO_COLOURS } from "./look";
import { laneX } from "./course";
import { tagLatch } from "./latch";
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

/** The chime of each hero (a pentatonic step: R C, B D, G E, Y G, P A). */
const CHIME: Record<string, number> = { riko: 1, nami: 1.12, kiro: 1.26, zuno: 1.5, vexa: 1.68 };

export function publishBoss(run: DashRun): void {
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
export function useDashJuice() {
   const juice = useJuice();
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const at = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   return (run: DashRun, ev: StepEvents, anim: HeroAnim, now: number, loud = 1) => {
      const h = run.hero;
      chest.x = feet.x = h.x;
      chest.z = feet.z = -h.d;
      chest.y = h.y + 1.0;
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
      if (ev.landed) anim.landAt = now;
      if (ev.laneChanged) playSfx("whoosh", { pitch: 1.4, volume: 0.25 * loud });
      if (ev.tucked) playSfx("whoosh", { pitch: 0.7, volume: 0.3 * loud });
      if (ev.tagged) {
         const col = HERO_COLOURS[ev.tagged];
         juice.burst("aura", chest, ev.handOff ? 26 : 14, { color: col });
         if (ev.handOff) {
            juice.kick(0, 0.3, 0, 1.4 * loud);
            juice.popup(chest, "Hand-off!", { color: col, size: 0.05 });
         }
         playSfx("chime", { pitch: CHIME[ev.tagged] ?? 1, volume: 0.45 * loud });
      }
      if (ev.tagRefused) playSfx("click", { pitch: 0.5, volume: 0.4 * loud });
      if (ev.powered) {
         juice.burst("aura", chest, 16, { color: HERO_COLOURS[run.active] });
         playSfx("whoosh", { volume: 0.55 * loud, pitch: 1.1 });
      }
      for (let k = 0; k < ev.openCount; k++) {
         const it = run.items.find((x) => x.id === ev.opened[k]);
         if (!it || !it.now) continue;
         at.x = it.lane < 0 ? 0 : laneX(it.lane);
         at.y = 1.2;
         at.z = -(it.d + 0.5);
         const col = HERO_COLOURS[it.now];
         juice.burst("hit", at, it.lane < 0 ? 46 : 26, { color: col });
         juice.burst("pickup", at, 14, { color: "#ffffff" });
         if (it.lane < 0) {
            juice.kick(0, 0, -1, 2.4 * loud);
            juice.hitStop(40);
         }
         juice.popup(chest, ev.clutch ? "Clutch!" : "Open!", { color: col, size: 0.06 });
         // the chain plays a melody: each unlock a step higher
         playSfx("chime", { pitch: (CHIME[it.now] ?? 1) * (1 + Math.min(0.5, run.combo.chain * 0.05)), volume: 0.6 * loud });
      }
      if (ev.fullPrism) {
         juice.burst("checkpoint", chest, 60, { color: "#ffffff" });
         juice.popup(chest, "Full Prism!", { color: "#fde68a", size: 0.08 });
         playSfx("combo", { volume: 0.7 * loud });
      }
      if (ev.orbCount > 0) playSfx("pickup", { pitch: 1 + Math.min(0.6, (run.orbs % 10) * 0.06), volume: 0.5 * loud });
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 30, { color: spec.kind === "shard" ? "#c4b5fd" : "#f9a8d4" });
         juice.popup(chest, `${spec.name}!`, { color: "#f9a8d4", size: 0.07 });
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.shielded) {
         juice.burst("hit", chest, 10, { color: "#86efac" });
         playSfx("click", { pitch: 1.6, volume: 0.5 * loud });
      }
      if (ev.hurt !== "") {
         anim.hurtAt = now;
         juice.burst("hit", chest, 18);
         juice.shake(0.24 * loud);
         juice.hitStop(70);
         juice.popup(chest, ev.bounced ? "Wrong hero!" : "Ouch!", { color: "#fca5a5", size: 0.06 });
         playSfx("hit", { volume: 0.5 * loud });
      }
      if (ev.repainted >= 0) playSfx("whoosh", { pitch: 0.55, volume: 0.35 * loud });
      if (ev.bossTelegraph) playSfx("whoosh", { pitch: 0.5, volume: 0.4 * loud });
      if (ev.bossAttack && run.boss) {
         juice.popup(chest, run.boss.phase === 0 ? "Feather drop!" : run.boss.phase === 1 ? "It swoops!" : "Gust!", { color: "#fecaca", size: 0.07 });
         juice.shake(0.2 * loud);
      }
      if (ev.bossHit) {
         juice.burst("hit", chest, 34, { color: "#e2e8f0" });
         juice.popup(chest, ev.bossDefeated ? "The Hawk shatters!" : "Prism spark!", { color: "#fde68a", size: 0.08 });
         juice.shake(0.3);
         juice.hitStop(90);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossPhase && !ev.bossDefeated && run.boss) juice.popup(chest, HAWK.phases[run.boss.phase]?.name ?? "", { color: "#fde68a", size: 0.06 });
      if (ev.bossDefeated) {
         for (const id of HERO_IDS) juice.burst("checkpoint", chest, 30, { color: HERO_COLOURS[id] });
         juice.shake(0.5);
         juice.hitStop(140);
         playSfx("combo", { pitch: 0.7 });
      }
   };
}

function Simulation({ run, anim, orbit }: { run: DashRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const effects = useDashJuice();
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;

   useRunFrame((_state, dt) => {
      const i = input.current;
      const sign = laneSign(orbit.viewYaw);
      stepInput.lane = i.pressed.left ? -sign : i.pressed.right ? sign : 0;
      stepInput.jumpPressed = i.jumpPressed || i.pressed.up;
      stepInput.downPressed = i.pressed.down;
      stepInput.actionPressed = i.actionPressed;
      const digit = i.digit ?? 0;
      stepInput.tag = digit >= 1 && digit <= 5 ? digit : tagLatch.tag;
      stepInput.tagCycle = 0;
      tagLatch.tag = 0;
      if (bot) {
         bot.frameMs = lastFrame.current;
         botInput(bot, run, stepInput);
      }
      lastFrame.current = dt * 1000;
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const now = time.now;
      effects(run, ev, anim, now);
      const set = (key: string, value: number) => {
         if (store.stats[key] !== value) store.setStat(key, value);
      };
      set(STAT.orbs, run.orbs);
      set(STAT.hearts, run.hearts);
      set(STAT.hits, run.hits);
      set(STAT.distance, Math.floor(run.hero.d));
      set(STAT.active, HERO_IDS.indexOf(run.active));
      set(STAT.comboMs, run.combo.bonusTotal);
      set(STAT.comboChain, run.combo.chain);
      set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
      set(STAT.comboFlow, Math.ceil(flowOf(run) * 10));
      let spectrum = 0;
      HERO_IDS.forEach((id, k) => {
         if (run.chainHeroes.has(id)) spectrum |= 1 << k;
      });
      set(STAT.spectrum, run.combo.chain > 0 ? spectrum : 0);
      set(STAT.tagReady, run.simMs >= run.tagReadyAt ? 1 : 0);
      set(STAT.noTag, !canTag(run) && run.simMs >= run.tagReadyAt ? 1 : 0);
      const cools = [STAT.cool0, STAT.cool1, STAT.cool2, STAT.cool3, STAT.cool4];
      HERO_IDS.forEach((id, k) => set(cools[k], Math.ceil(run.cool[id] / 1000)));
      publishBoss(run);
      if (ev.finished) {
         const h = run.hero;
         anim.winAt = now;
         if (!ev.bossDefeated) {
            juice.burst("checkpoint", { x: h.x, y: 1, z: -h.d }, 110, { color: "#fde68a" });
            juice.popup({ x: h.x, y: 2, z: -h.d }, "At the gate!", { color: "#fde68a", size: 0.09 });
         }
         juice.shake(0.2);
         playSfx("chime", { pitch: 0.75 });
         set(STAT.finishMs, run.finishMs);
         const end = levelEndStats(run, userRef.current);
         for (const key of Object.keys(end) as Array<keyof typeof end>) store.setStat(STAT[key], end[key]);
         store.end("win");
      } else if (ev.lost) {
         anim.loseAt = now;
         levelEndStats(run, userRef.current);
         store.end("lose");
      } else if (ev.timeup) {
         levelEndStats(run, userRef.current);
         store.end("timeup");
      }
   });
   return null;
}

/** The orbit camera behind the roller; a boost pushes the field of view out (speed lines). */
function DashCamera({ run, orbit }: { run: DashRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const base = aspect < 1 ? FOV_PORTRAIT : FOV;
   useEffect(() => {
      camera.fov = base;
      camera.updateProjectionMatrix();
   }, [camera, base]);
   const time = useGameTime();
   useFrame(() => {
      const extra = Math.max(0, speedOf(run) - run.course.cfg.speed) * 0.8;
      const want = base + extra;
      const next = camera.fov + (want - camera.fov) * Math.min(1, time.delta * 6);
      if (Math.abs(next - camera.fov) > 0.01) {
         camera.fov = next;
         camera.updateProjectionMatrix();
      }
   }, FRAME_PRIORITY.camera + 0.05);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         heroPivot(run, out);
         return true;
      },
      [run],
   );
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         out.x = 0;
         out.z = -speedOf(run);
      },
      [run],
   );
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} />;
}

/** The Hawk's slow-mo finish: the visuals only (menu2/boss through the juice clock). */
function BossSlowMo({ run }: { run: DashRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, HAWK.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: DashRun; anim: HeroAnim }) {
   const intro = useShellIntro();
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const keys = useMemo(() => introKeyframes(run.course.length || 600), [run.course.length]);
   const play = useMemo(() => playCamera(run.course.cfg.boss, aspect), [run.course.cfg.boss, aspect]);
   const running = !!intro?.session && !intro.ready;
   useFrame(() => {
      anim.intro = running && intro ? intro.hero.current : Number.NaN;
   }, FRAME_PRIORITY.pose);
   const juice = useJuice();
   const landed = useRef(false);
   useFrame(() => {
      if (!running || landed.current || anim.intro < 0.985) return;
      landed.current = true;
      juice.burst("dust", { x: 0, y: 0.1, z: 0 }, 18, { color: "#cbd5e1" });
      juice.burst("pickup", { x: 0, y: 0.6, z: 0 }, 16, { color: HERO_COLOURS[run.active] });
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
   const { config } = useLevel<DashLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const lead = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, lead), [runId, levelId, lead]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(dashOrbit(run.course.cfg.boss)), [run]);
   return (
      <JuiceLayer>
         <World run={run} />
         <Street key={levelId} run={run} />
         <Hawk run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <DashCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
