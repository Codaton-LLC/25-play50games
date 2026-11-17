"use client";

// Switch Color Hero: the run stepped in useRunFrame, the world, the track, the hero, Chroma, the orbit
// camera behind the runner and the intro. Juice: a colour switch rings and flashes the hero's shell, a
// true gate bursts in its colour with a surge kick and a chime that climbs with the streak, a wrong gate
// shatters with a shake and a buzz, pickups pop, Riko's dash smashes blocks, Chroma's hits throw his
// colour back at him with a hit-stop. Local multiplayer renders MultiScene.
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
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
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import type { LiveInputState } from "@/arcade3d/core/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import World from "./World";
import TrackView from "./TrackView";
import Golem from "./Golem";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, RUN_ORBIT, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { NONE, ORB, STAT, createRun, createStepInput, step, type StepInput, type SwitchRun } from "./rules";
import { PALETTE } from "./track";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { SwitchLevel } from "./levels";
import { CHROMA, COMBO, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import { takeQueuedColor } from "./colorQueue";
import MultiScene from "./MultiScene";
import { COLORS } from "./look";

function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

/** The shell's input to the rules': lanes, jump, slide, the colour (1-5, a tap / click, a swatch), power. */
export function readInput(i: LiveInputState, yaw: number, queued: number, out: StepInput): StepInput {
   out.left = i.pressed.left;
   out.right = i.pressed.right;
   out.jumpPressed = i.jumpPressed || i.pressed.up;
   out.slidePressed = i.pressed.down;
   out.colorPick = queued >= 0 ? queued : i.digit !== null && i.digit !== undefined && i.digit >= 1 && i.digit <= 5 ? i.digit - 1 : NONE;
   out.cycle = !!i.tap;
   out.actionPressed = i.actionPressed;
   out.yaw = yaw;
   return out;
}

function publishBoss(run: SwitchRun): void {
   const b = run.boss;
   if (!b) return;
   const store = useArcadeStore.getState();
   const open = b.step === "vulnerable" ? 1 : 0;
   const flash = b.flashMs > 0 ? 1 : 0;
   if (store.stats[STAT.bossHp] !== b.hp) store.setStat(STAT.bossHp, b.hp);
   if (store.stats[STAT.bossPhase] !== b.phase) store.setStat(STAT.bossPhase, b.phase);
   if (store.stats[STAT.bossOpen] !== open) store.setStat(STAT.bossOpen, open);
   if (store.stats[STAT.bossFlash] !== flash) store.setStat(STAT.bossFlash, flash);
}

function Simulation({ run, anim, orbit }: { run: SwitchRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useMemo(() => [autoplayRequested() ? createBot(run) : null], [run]);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;

   useRunFrame((_state, dt) => {
      readInput(input.current, orbit.viewYaw, takeQueuedColor(), stepInput);
      if (bot) botInput(bot, run, stepInput);
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const h = run.hero;
      const now = time.now;
      const chest = { x: h.x, y: h.y + 1, z: h.z };
      const hex = PALETTE[h.color].hex;
      if (ev.switched) {
         anim.switchAt = now;
         juice.burst("aura", chest, 10, { color: hex });
         playSfx("click", { volume: 0.4, pitch: 0.9 + h.color * 0.12 });
      }
      if (ev.laned) playSfx("whoosh", { volume: 0.25, pitch: 1.4 });
      if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.45 });
      }
      if (ev.airJumped) {
         anim.airJumpAt = now;
         playSfx("jump", { volume: 0.5, pitch: 1.3 });
      }
      if (ev.slid) playSfx("whoosh", { volume: 0.35, pitch: 0.7 });
      if (ev.wrong) {
         anim.hurtAt = now;
         juice.burst("hit", chest, 26, { color: hex });
         juice.shake(0.35);
         juice.popup(chest, "Wrong colour!", { color: "#fca5a5" });
         playSfx("buzz", { volume: 0.5 });
      }
      if (ev.gatePassed >= 0) {
         juice.burst("checkpoint", chest, 22, { color: hex });
         juice.kick(0, 0, 1, 1.4);
         playSfx("chime", { volume: 0.5, pitch: 0.9 + Math.min(8, run.streak) * 0.06 });
      }
      if (ev.hit) {
         anim.hurtAt = now;
         juice.shake(0.3);
         juice.burst("hit", chest, 18, { color: COLORS.beam });
         playSfx("thud", { volume: 0.5 });
      }
      if (ev.shielded) juice.popup(chest, "Shield!", { color: COLORS.shield });
      if (ev.smashed >= 0) {
         const o = run.track.obstacles[ev.smashed];
         juice.burst("hit", { x: h.x, y: 1.2, z: o.z }, 30, { color: COLORS.block });
         juice.shake(0.2);
         playSfx("boom", { volume: 0.45 });
      }
      for (let k = 0; k < Math.min(ev.pickupCount, ev.pickupList.length); k++) {
         const p = run.track.pickups[ev.pickupList[k]];
         juice.burst("pickup", p, 12, { color: COLORS.pickup });
         juice.popup(p, `-${(ORB.bonusMs / 1000).toFixed(2)} s`, { color: COLORS.pickup });
         playSfx("pickup", { pitch: 1.1 });
      }
      if (ev.pickupCount > 0) {
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 24, { color: "#a7f3d0" });
         juice.popup(chest, spec?.name ?? "Secret", { color: "#a7f3d0" });
         playSfx("chime", { pitch: 1.5 });
      }
      if (ev.checkpoint) {
         juice.burst("checkpoint", chest, 20, { color: COLORS.checkpoint });
         playSfx("chime", { pitch: 1.1, volume: 0.4 });
      }
      if (ev.powered) {
         juice.burst("aura", chest, 16, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.45, pitch: 1.1 });
      }
      if (ev.fell) {
         anim.hurtAt = now;
         playSfx("lose", { volume: 0.45 });
      }
      if (ev.respawned) anim.spawnAt = now;
      if (ev.bossGate) playSfx("whoosh", { volume: 0.5, pitch: 0.6 });
      if (ev.bossHit) {
         const g = { x: 0, y: 3, z: run.golem.z };
         juice.burst("hit", g, 40, { color: hex });
         juice.burst("checkpoint", g, 30, { color: "#ffffff" });
         juice.hitStop(90);
         juice.shake(0.3);
         playSfx("boom", { pitch: 1.2 });
      }
      if (ev.bossDefeated) {
         juice.burst("checkpoint", { x: 0, y: 3, z: run.golem.z }, 90, { color: "#ffffff" });
         juice.hitStop(Math.min(140, CHROMA.slowMo.durationMs));
         playSfx("win", { pitch: 0.9 });
      }
      if (ev.comboBonus > 0) store.setStat(STAT.comboMs, run.combo.bonusTotal);
      const flow = Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10);
      if (store.stats[STAT.comboChain] !== run.combo.chain) store.setStat(STAT.comboChain, run.combo.chain);
      const mult = Math.round(run.combo.multiplier * 100);
      if (store.stats[STAT.comboMult] !== mult) store.setStat(STAT.comboMult, mult);
      if (store.stats[STAT.comboFlow] !== flow) store.setStat(STAT.comboFlow, flow);
      if (store.stats[STAT.hearts] !== run.hearts) store.setStat(STAT.hearts, run.hearts);
      if (store.stats[STAT.passed] !== run.passed) store.setStat(STAT.passed, run.passed);
      if (store.stats[STAT.color] !== h.color) store.setStat(STAT.color, h.color);
      if (store.stats[STAT.streak] !== run.streak) store.setStat(STAT.streak, run.streak);
      const dist = Math.round(-h.z);
      if (store.stats[STAT.distance] !== dist) store.setStat(STAT.distance, dist);
      publishBoss(run);
      const heroStat = run.heroId === "nami" ? 1 : run.heroId === "kiro" ? 2 : run.heroId === "zuno" ? 3 : run.heroId === "vexa" ? 4 : 0;
      if (store.stats[STAT.hero] !== heroStat) store.setStat(STAT.hero, heroStat);
      const powerLeft = Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000));
      if (store.stats[STAT.power] !== powerLeft) store.setStat(STAT.power, powerLeft);
      if (ev.finished) {
         anim.winAt = now;
         juice.burst("checkpoint", chest, 80);
         playSfx("chime", { pitch: 0.75 });
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
         store.setStat(STAT.finishMs, run.finishMs);
         store.setStat(STAT.comboMs, run.combo.bonusTotal);
         const end = levelEndStats(run, userRef.current);
         for (const key of Object.keys(end) as Array<keyof typeof end>) store.setStat(STAT[key], end[key]);
         store.end("win");
      } else if (ev.gameOver) {
         levelEndStats(run, userRef.current);
         store.end("lose");
      } else if (ev.timeup) {
         levelEndStats(run, userRef.current);
         store.end("timeup");
      }
   });
   return null;
}

function RunCamera({ run, orbit }: { run: SwitchRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const base = aspect < 1 ? FOV_PORTRAIT : FOV;
   useEffect(() => {
      camera.fov = base;
      camera.updateProjectionMatrix();
   }, [camera, base]);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         const h = run.hero;
         orbitPivot(h.x, h.y, h.z, out);
         return h.mode !== "fall";
      },
      [run],
   );
   const travel = useMemo(() => (out: { x: number; z: number }) => {
      out.x = 0;
      out.z = -6;
   }, []);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} behind={() => 0} input={{ oneFinger: false, mouseButtons: [2] }} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} />;
}

function IntroCamera({ run, anim }: { run: SwitchRun; anim: HeroAnim }) {
   const intro = useShellIntro();
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const keys = useMemo(() => introKeyframes(run.track), [run.track]);
   const play = useMemo(() => playCamera(run.track, aspect), [run.track, aspect]);
   const running = !!intro?.session && !intro.ready;
   useFrame(() => {
      anim.intro = running && intro ? intro.hero.current : Number.NaN;
   }, FRAME_PRIORITY.pose);
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<SwitchLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit({ ...RUN_ORBIT }), [run]);
   return (
      <JuiceLayer>
         <World key={`w${levelId}`} track={run.track} level={levelId} />
         <TrackView key={`t${levelId}`} run={run} level={levelId} />
         {run.track.arenaZ !== null ? <Golem key={`g${levelId}`} run={run} /> : null}
         <Hero key={`h${run.heroId}`} run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <RunCamera run={run} orbit={orbit} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
