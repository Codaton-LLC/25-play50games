"use client";

// Color Arena Survival's scene: the run (rules.ts) stepped in useRunFrame, the prism world (World), the
// colour floor and its pieces (ArenaView), the Prism Keeper (level 5), the hero (menu2/heroAnim), the
// orbit camera (menu2/camera: the stick is camera-relative through StepInput.yaw = orbit.viewYaw; high
// behind the hero, its pivot leaned to the floor's middle), the intro (core/intro) and the juice
// (menu2/juice): a chime and a colour burst on each call, a click and a ring when you lock in, the
// floor's rumble as it drops, a ping for each survived round, knocks with a kick and a hit-stop, the
// fall's tumble, and the Keeper's beams and popups. Remounted for every run (runId). Local multiplayer
// runs render MultiScene.tsx instead.
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
import { ArenaView } from "./ArenaView";
import Keeper, { keeperHome } from "./Keeper";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, arenaOrbit, arenaPivot, introKeyframes, orbitLookUp, orbitScale, playCamera } from "./camera";
import { COLOUR_NAMES, LOCK_MS, PHASE_IDS, STAT, bossVulnerable, createRun, createStepInput, flowOf, step, tileCentre, type ArenaRun, type StepEvents } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { ArenaLevel } from "./levels";
import { KEEPER, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import { COLORS, TILE_GLOWS } from "./look";
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

/** The HUD's stats for one run (solo; P1 in multiplayer). */
export function publishRun(run: ArenaRun): void {
   const store = useArcadeStore.getState();
   const set = (key: string, value: number) => {
      if (store.stats[key] !== value) store.setStat(key, value);
   };
   const a = run.arena;
   set(STAT.hero, HERO_IDS.indexOf(run.heroId));
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
   set(STAT.lives, run.lives);
   set(STAT.hits, run.hits);
   set(STAT.orbs, run.orbs);
   set(STAT.survived, run.survived);
   set(STAT.round, a.round);
   set(STAT.called, a.called);
   set(STAT.phase, PHASE_IDS[a.phase]);
   set(STAT.callLeft, a.phase === "call" ? Math.max(0, Math.ceil((a.callLen - a.phaseMs) / 100)) : 0);
   set(STAT.lock, Math.min(100, Math.round((run.lockMs / LOCK_MS) * 100)));
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(flowOf(run) * 10));
   set(STAT.beacon, a.beaconTile >= 0 && (a.phase === "call" || a.phase === "drop") ? 1 : 0);
   const b = a.boss;
   if (b) {
      set(STAT.bossHp, b.hp);
      set(STAT.bossPhase, b.phase);
      set(STAT.bossOpen, bossVulnerable(run) ? 1 : 0);
      set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
   }
}

/** The juice and sounds of one step's events (solo and, quieter, multiplayer); `arenaToo` plays the floor's own. */
export function useArenaJuice() {
   const juice = useJuice();
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const at = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const c = useMemo(() => ({ x: 0, z: 0 }), []);
   return (run: ArenaRun, ev: StepEvents, anim: HeroAnim, now: number, loud = 1, arenaToo = true) => {
      const h = run.hero;
      const a = run.arena;
      chest.x = feet.x = h.x;
      chest.z = feet.z = h.z;
      chest.y = h.y + 1.1;
      feet.y = h.y + 0.05;
      if (arenaToo) {
         const ae = a.ev;
         if (ae.called) {
            at.x = 0;
            at.y = 5.5;
            at.z = -a.half - 2.6;
            juice.burst("aura", at, 26, { color: TILE_GLOWS[a.called] });
            playSfx("chime", { pitch: 0.9 + a.called * 0.08, volume: 0.45 * loud });
         }
         if (ae.warned) playSfx("click", { pitch: 0.7, volume: 0.35 * loud });
         if (ae.dropped) {
            juice.shake(0.12 * loud);
            playSfx("thud", { pitch: 0.55, volume: 0.5 * loud });
         }
         if (ae.locked) juice.popup(chest, "Locked in!", { color: "#a5f3fc", size: 0.06 });
         if (ae.swapWarn) playSfx("click", { pitch: 1.5, volume: 0.35 * loud });
         if (ae.swapped) juice.popup(chest, "Tiles swapped!", { color: "#fde68a", size: 0.05 });
         if (ae.repaintWarn) juice.popup(chest, "The Keeper repaints the floor!", { color: "#f9a8d4", size: 0.06 });
         if (ae.repainted) {
            juice.popup(chest, `Now ${COLOUR_NAMES[a.called]}!`, { color: TILE_GLOWS[a.called], size: 0.08 });
            playSfx("whoosh", { pitch: 0.7, volume: 0.5 * loud });
         }
         if (ae.shock) {
            juice.popup(chest, "Shock ring: jump!", { color: "#fbcfe8", size: 0.06 });
            juice.shake(0.2 * loud);
            playSfx("thud", { pitch: 0.4, volume: 0.7 * loud });
         }
         if (ae.bossAttack) playSfx("whoosh", { pitch: 0.5, volume: 0.45 * loud });
      }
      if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.45 * loud });
      }
      if (ev.airJumped) {
         anim.airJumpAt = now;
         juice.burst("dust", feet, 10, { color: "#bfdbfe" });
         playSfx("jump", { pitch: 1.25, volume: 0.6 * loud });
      }
      if (ev.landed) {
         anim.landAt = now;
         juice.burst("dust", feet, 6, { color: "#e9d5ff" });
         playSfx("thud", { volume: 0.25 * loud });
      }
      if (ev.locked) {
         juice.burst("pickup", feet, 16, { color: TILE_GLOWS[a.called] });
         playSfx("click", { pitch: 1.3, volume: 0.5 * loud });
      }
      if (ev.survived) {
         juice.burst("checkpoint", feet, 18, { color: TILE_GLOWS[a.called] });
         playSfx("combo", { pitch: 1 + Math.min(0.8, run.survived * 0.04), volume: 0.35 * loud });
      }
      if (ev.powered) {
         juice.burst("aura", chest, 16, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.55 * loud, pitch: 1.1 });
      }
      if (ev.blocked || ev.saved) {
         juice.burst("hit", chest, 12, { color: "#86efac" });
         juice.popup(chest, ev.saved ? "The shield saved you!" : "Blocked!", { color: "#bbf7d0", size: 0.05 });
         playSfx("click", { pitch: 1.6, volume: 0.5 * loud });
      }
      if (ev.orb && a.orbTile >= 0) {
         tileCentre(a, a.orbTile, c);
         at.x = c.x;
         at.y = 1;
         at.z = c.z;
         juice.burst("pickup", at, 16, { color: COLORS.orb });
         juice.popup(at, `Orb ${run.orbs}/5`, { color: "#e9d5ff" });
         playSfx("pickup", { pitch: 1 + run.orbs * 0.08, volume: loud });
      }
      if (ev.hop) juice.popup(chest, `Hop ${run.hops}`, { color: "#fde68a", size: 0.04 });
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 30, { color: spec.kind === "shard" ? "#c4b5fd" : "#f9a8d4" });
         juice.popup(chest, `${spec.name}!`, { color: "#f9a8d4", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.knocked) {
         anim.hurtAt = now;
         juice.burst("hit", chest, 18);
         juice.kick(h.vx * 0.05, 0.1, h.vz * 0.05, 1.6 * loud);
         juice.shake(0.2 * loud);
         juice.hitStop(60);
         playSfx("hit", { volume: 0.5 * loud });
      }
      if (ev.fell) {
         juice.popup(chest, run.lives > 0 ? `Into the pit! ${run.lives} left` : "Out of hearts", { color: "#fca5a5", size: 0.06 });
         juice.shake(0.25 * loud);
         playSfx("hit", { pitch: 0.7, volume: 0.6 * loud });
      }
      if (ev.respawned) juice.burst("aura", feet, 18, { color: COLORS.safe });
      if (ev.bossHit) {
         const home = keeperHome(a);
         at.x = home.x;
         at.y = home.y + 1.5;
         at.z = home.z;
         juice.burst("hit", at, 40, { color: COLORS.keeperGlow });
         juice.popup(at, ev.bossDefeated ? "The Keeper shatters!" : "Prism strike!", { color: "#fde68a", size: 0.09 });
         juice.shake(0.3);
         juice.hitStop(90);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossPhase && !ev.bossDefeated && a.boss) juice.popup(chest, KEEPER.phases[a.boss.phase]?.name ?? "", { color: "#fde68a", size: 0.07 });
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 120, { color: COLORS.keeper });
         juice.burst("checkpoint", chest, 80, { color: COLORS.keeperGlow });
         juice.shake(0.5);
         juice.hitStop(140);
         playSfx("combo", { pitch: 0.7 });
      }
   };
}

function Simulation({ run, anim, orbit }: { run: ArenaRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const effects = useArenaJuice();
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
      const now = time.now;
      effects(run, ev, anim, now);
      publishRun(run);
      if (ev.finished) {
         const h = run.hero;
         anim.winAt = now;
         if (!ev.bossDefeated) {
            juice.burst("checkpoint", h, 110, { color: COLORS.prism });
            juice.burst("pickup", h, 40, { color: COLORS.gold });
            juice.popup(h, "Survived!", { color: "#fde68a", size: 0.09 });
         }
         juice.shake(0.2);
         playSfx("chime", { pitch: 0.75 });
         store.setStat(STAT.finishMs, run.finishMs);
         const end = levelEndStats(run, userRef.current);
         for (const key of Object.keys(end) as Array<keyof typeof end>) store.setStat(STAT[key], end[key]);
         store.end("win");
      } else if (ev.lost) {
         levelEndStats(run, userRef.current);
         store.end("lose");
      } else if (ev.timeup) {
         levelEndStats(run, userRef.current);
         store.end("timeup");
      }
   });
   return null;
}

/** The orbit camera round the hero (high behind, the pivot leaned to the floor's middle; no auto-follow). */
function ArenaCamera({ run, orbit }: { run: ArenaRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         arenaPivot(run.hero, out);
         return true;
      },
      [run],
   );
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         out.x = 0;
         out.z = 0;
      },
      [],
   );
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={COLLISION} />;
}

const COLLISION = { radius: 0.35, minDistance: 4 };

/** The Keeper's slow-mo finish: the visuals only (menu2/boss through the juice clock). */
function BossSlowMo({ run }: { run: ArenaRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.arena.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, KEEPER.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: ArenaRun; anim: HeroAnim }) {
   const intro = useShellIntro();
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const keys = useMemo(() => introKeyframes(run.arena), [run.arena]);
   const play = useMemo(() => playCamera(run.arena, aspect), [run.arena, aspect]);
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
      juice.burst("dust", h, 18, { color: "#e9d5ff" });
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
   const { config } = useLevel<ArenaLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(arenaOrbit(run.arena)), [run]);
   return (
      <JuiceLayer>
         <World arena={run.arena} />
         <ArenaView run={run} />
         <Keeper arena={run.arena} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <ArenaCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
