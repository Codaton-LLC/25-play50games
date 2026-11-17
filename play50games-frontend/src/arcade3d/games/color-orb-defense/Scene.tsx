"use client";

// Color Orb Defense: the run stepped in useRunFrame, the world, the arena, the hero, the Orb Mortar, the
// orbit camera on the arena and the intro. Juice: a block bursts the orb in its colour with a pop that
// climbs with the combo (an early block flashes gold), a wrong colour clinks, a leak shakes the beacon,
// a perfect wave throws confetti, the drone's knock staggers the hero, the Mortar's hits flash him with a
// hit-stop. Local multiplayer renders MultiScene.
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
import ArenaView from "./ArenaView";
import Mortar from "./Mortar";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { ARENA_ORBIT, FOV, FOV_PORTRAIT, introKeyframes, orbitPivot, orbitScale, playCamera } from "./camera";
import { STAT, createRun, createStepInput, currentWave, step, type DefenseRun, type StepInput } from "./rules";
import { ORB_Y, PALETTE } from "./arena";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { DefenseLevel } from "./levels";
import { COMBO, MORTAR, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
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

export function readInput(i: LiveInputState, yaw: number, out: StepInput): StepInput {
   out.moveX = i.moveX;
   out.moveZ = i.moveY;
   out.yaw = yaw;
   out.jumpPressed = i.jumpPressed;
   out.actionPressed = i.actionPressed;
   return out;
}

function publishBoss(run: DefenseRun): void {
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

function Simulation({ run, anim, orbit }: { run: DefenseRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useMemo(() => [autoplayRequested() ? createBot(run) : null], [run]);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;
   // where each orb was last frame (a block's burst happens there)
   const last = useMemo(() => new Map<number, { x: number; z: number; c: number }>(), [run]);

   useRunFrame((_state, dt) => {
      // remember the orbs before the step: the blocked ones are gone after it
      last.clear();
      run.orbs.forEach((o, i) => {
         if (!o.live) return;
         const l = run.arena.lanes[o.lane];
         last.set(i, { x: l.dx * o.r, z: l.dz * o.r, c: o.color });
      });
      readInput(input.current, orbit.viewYaw, stepInput);
      if (bot) botInput(bot, run, stepInput);
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const h = run.hero;
      const now = time.now;
      const chest = { x: h.x, y: h.y + 1, z: h.z };
      for (let k = 0; k < Math.min(ev.blocked, ev.blockList.length); k++) {
         const p = last.get(ev.blockList[k]);
         const at = p ? { x: p.x, y: ORB_Y, z: p.z } : chest;
         juice.burst("hit", at, 18, { color: p ? PALETTE[p.c].hex : "#ffffff" });
         playSfx("pop", { volume: 0.55, pitch: 1 + Math.min(5, run.combo.chain) * 0.1 });
      }
      if (ev.early > 0) juice.popup(chest, "EARLY!", { color: COLORS.golden });
      if (ev.wrong > 0) playSfx("click", { volume: 0.4, pitch: 0.6 });
      if (ev.leaked > 0) {
         juice.shake(0.25);
         juice.burst("hit", { x: 0, y: 3.4, z: 0 }, 20, { color: ev.shielded ? COLORS.shield : COLORS.coreHurt });
         playSfx(ev.shielded ? "zap" : "thud", { volume: 0.5 });
      }
      if (ev.perfect) {
         juice.burst("checkpoint", { x: 0, y: 4, z: 0 }, 50, { color: COLORS.golden });
         juice.popup({ x: 0, y: 5, z: 0 }, "PERFECT WAVE", { color: COLORS.golden });
         playSfx("combo", { pitch: 1.1 });
      } else if (ev.waveDone >= 0) {
         juice.popup({ x: 0, y: 5, z: 0 }, `WAVE ${ev.waveDone + 1} HELD`, { color: "#e0f2fe" });
         playSfx("chime", { pitch: 1 });
      }
      if (ev.knocked) {
         anim.hurtAt = now;
         juice.shake(0.2);
         juice.burst("hit", chest, 14, { color: COLORS.drone });
         playSfx("thud", { volume: 0.45, pitch: 1.2 });
      }
      if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.4 });
      }
      if (ev.airJumped) {
         anim.airJumpAt = now;
         playSfx("jump", { volume: 0.45, pitch: 1.3 });
      }
      if (ev.zoneIn >= 0) playSfx("click", { volume: 0.25, pitch: 1.4 + run.arena.zones[ev.zoneIn].color * 0.1 });
      if (ev.powered) {
         juice.burst("aura", chest, 16, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.45, pitch: 1.1 });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 24, { color: "#a7f3d0" });
         juice.popup(chest, spec?.name ?? "Secret", { color: "#a7f3d0" });
         playSfx("chime", { pitch: 1.5 });
      }
      if (ev.coreOrb) playSfx("whoosh", { volume: 0.5, pitch: 0.6 });
      if (ev.bossHit) {
         juice.burst("hit", { x: 0, y: 4, z: -18 }, 40, { color: COLORS.golden });
         juice.hitStop(90);
         juice.shake(0.3);
         playSfx("boom", { pitch: 1.2 });
      }
      if (ev.bossDefeated) {
         juice.burst("checkpoint", { x: 0, y: 4, z: -18 }, 90, { color: "#ffffff" });
         juice.hitStop(Math.min(140, MORTAR.slowMo.durationMs));
         playSfx("win", { pitch: 0.9 });
      }
      if (store.score !== run.score) store.setScore(run.score);
      const flow = Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10);
      if (store.stats[STAT.comboChain] !== run.combo.chain) store.setStat(STAT.comboChain, run.combo.chain);
      const mult = Math.round(run.combo.multiplier * 100);
      if (store.stats[STAT.comboMult] !== mult) store.setStat(STAT.comboMult, mult);
      if (store.stats[STAT.comboFlow] !== flow) store.setStat(STAT.comboFlow, flow);
      if (store.stats[STAT.coreHp] !== run.shared.coreHp) store.setStat(STAT.coreHp, run.shared.coreHp);
      if (store.stats[STAT.blocks] !== run.blocks) store.setStat(STAT.blocks, run.blocks);
      if (store.stats[STAT.leaks] !== run.leaks) store.setStat(STAT.leaks, run.leaks);
      const wave = currentWave(run);
      if (store.stats[STAT.wave] !== wave) store.setStat(STAT.wave, wave);
      const zc = h.color;
      if (store.stats[STAT.zoneColor] !== zc) store.setStat(STAT.zoneColor, zc);
      publishBoss(run);
      const heroStat = run.heroId === "nami" ? 1 : run.heroId === "kiro" ? 2 : run.heroId === "zuno" ? 3 : run.heroId === "vexa" ? 4 : 0;
      if (store.stats[STAT.hero] !== heroStat) store.setStat(STAT.hero, heroStat);
      const powerLeft = Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000));
      if (store.stats[STAT.power] !== powerLeft) store.setStat(STAT.power, powerLeft);
      if (ev.finished) {
         anim.winAt = now;
         juice.burst("checkpoint", chest, 80);
         playSfx("chime", { pitch: 0.75 });
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

function ArenaCamera({ run, orbit }: { run: DefenseRun; orbit: OrbitState }) {
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
         orbitPivot(run.hero.x, run.hero.z, out);
         return true;
      },
      [run],
   );
   return <OrbitCamera orbit={orbit} pivot={pivot} behind={() => 0} input={{ oneFinger: false, mouseButtons: [0, 2] }} distanceScale={orbitScale(aspect)} pivotDamping={3} />;
}

function IntroCamera({ run, anim }: { run: DefenseRun; anim: HeroAnim }) {
   const intro = useShellIntro();
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const keys = useMemo(() => introKeyframes(run.arena), [run.arena]);
   const play = useMemo(() => playCamera(run.arena, aspect), [run.arena, aspect]);
   const running = !!intro?.session && !intro.ready;
   useFrame(() => {
      anim.intro = running && intro ? intro.hero.current : Number.NaN;
   }, FRAME_PRIORITY.pose);
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<DefenseLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit({ ...ARENA_ORBIT }), [run]);
   return (
      <JuiceLayer>
         <World key={`w${levelId}`} arena={run.arena} level={levelId} />
         <ArenaView key={`a${levelId}`} run={run} level={levelId} />
         {run.arena.boss ? <Mortar key={`m${levelId}`} run={run} /> : null}
         <Hero key={`h${run.heroId}`} run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <ArenaCamera run={run} orbit={orbit} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
