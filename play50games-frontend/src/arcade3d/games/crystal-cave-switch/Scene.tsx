"use client";

// Crystal Cave Switch's scene: the run (rules.ts) stepped in useRunFrame, the cavern (World), the rooms
// (Cave: floors, walls, gates, crystals, beacons), the Hollow Prism on level 5, the hero (Hero), the
// free orbit camera (menu2/camera: the stick is camera-relative through StepInput.yaw = orbit.viewYaw;
// left alone it swings behind the run), the intro (core/intro) and the juice (menu2/juice): a struck
// crystal rings a chime that climbs with the sequence and bursts in its colour, a wrong one buzzes and
// the room's lights die, an opened gate rumbles and sinks, the beam, hits and the slow-mo finish.
// Remounted for every run (runId). Local multiplayer renders MultiScene.tsx instead.
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
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import World from "./World";
import { Cave } from "./CaveView";
import { Prism } from "./Boss";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, caveOrbit, heroPivot, introKeyframes, orbitLookUp, orbitScale, playCamera } from "./camera";
import { STAT, bonusMs, createRun, createStepInput, hintFor, roomAt, step, type CaveRun, type StepEvents } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { CaveLevel } from "./levels";
import { COMBO, PRISM, SECRETS } from "./progression";
import { COLORS } from "./look";
import { levelEndStats } from "./levelEnd";
import MultiScene from "./MultiScene";

function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

export function publishStats(run: CaveRun): void {
   const store = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   const room = roomAt(run);
   set(STAT.room, room);
   set(STAT.progress, room >= 0 ? (run.solved[room] ? run.course.rooms[room].seq.length : run.progress[room]) : 0);
   set(STAT.seqLen, room >= 0 ? run.course.rooms[room].seq.length : 0);
   const left = room >= 0 && Number.isFinite(run.deadline[room]) ? Math.max(0, Math.ceil((run.deadline[room] - run.simMs) / 100)) : -1;
   set(STAT.timer, left);
   set(STAT.orbs, run.orbs);
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10));
   set(STAT.bonusMs, bonusMs(run));
   set(STAT.hero, ["riko", "nami", "kiro", "zuno", "vexa"].indexOf(run.heroId));
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
   set(STAT.hint, hintFor(run));
   const b = run.boss;
   if (b && run.bossAwake) {
      set(STAT.bossHp, b.hp);
      set(STAT.bossPhase, b.phase);
      set(STAT.bossOpen, b.step === "vulnerable" ? 1 : 0);
      set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
   }
}

/** The juice and sounds of one step's events (solo and, quieter, multiplayer). */
export function useCaveJuice() {
   const juice = useJuice();
   return (run: CaveRun, ev: StepEvents, anim: HeroAnim, now: number, loud = 1) => {
      const h = run.hero;
      const chest = { x: h.x, y: h.y + 1.1, z: h.z };
      const feet = { x: h.x, y: h.y + 0.1, z: h.z };
      if (ev.jumped) playSfx("jump", { volume: 0.4 * loud });
      if (ev.doubled) {
         juice.burst("aura", feet, 12, { color: heroAccent(run.heroId) });
         playSfx("jump", { pitch: 1.3, volume: 0.4 * loud });
      }
      if (ev.landed) playSfx("thud", { pitch: 1.4, volume: 0.25 * loud });
      if (ev.struck >= 0) {
         const s = run.course.switches[ev.struck];
         const at = { x: s.x, y: s.base + 1.2, z: s.z };
         if (ev.right) {
            const k = s.room >= 0 ? run.progress[s.room] : run.codeAt;
            juice.burst("pickup", at, 22, { color: COLORS.gem[s.color] });
            playSfx("chime", { pitch: 1 + Math.min(1, k * 0.18), volume: 0.6 * loud });
         } else if (ev.wrong) {
            juice.burst("hit", at, 16, { color: "#f87171" });
            juice.popup(at, "Wrong order!", { color: "#fca5a5", size: 0.065 });
            juice.shake(0.12 * loud);
            playSfx("buzz", { volume: 0.5 * loud });
         }
      }
      if (ev.opened >= 0) {
         const g = run.course.boxes[run.course.rooms[ev.opened].gate];
         const at = { x: (g.minX + g.maxX) / 2, y: 2, z: (g.minZ + g.maxZ) / 2 };
         juice.burst("checkpoint", at, 40, { color: "#c4b5fd" });
         juice.popup(at, "Gate open!", { color: "#fde68a", size: 0.08 });
         juice.shake(0.25 * loud);
         playSfx("boom", { pitch: 0.8, volume: 0.6 * loud });
      }
      if (ev.timeout >= 0) {
         juice.popup(chest, "Too slow: the lights fade", { color: "#fca5a5", size: 0.06 });
         playSfx("buzz", { pitch: 0.7, volume: 0.45 * loud });
      }
      if (ev.comboBonus > 0 && run.combo.chain > 1) juice.popup(chest, `Flow x${run.combo.chain}`, { color: "#e9d5ff", size: 0.05 });
      if (ev.died) {
         juice.burst("hit", chest, 22, { color: "#f0abfc" });
         juice.shake(0.2 * loud);
         playSfx("lose", { volume: 0.4 * loud });
      }
      if (ev.respawned) {
         juice.burst("checkpoint", feet, 24, { color: heroAccent(run.heroId) });
         playSfx("pop", { volume: 0.5 * loud });
      }
      if (ev.hurt) {
         anim.hurtAt = now;
         juice.burst("hit", chest, 18, { color: "#f472b6" });
         juice.shake(0.3 * loud);
         juice.hitStop(60);
         playSfx("hit", { volume: 0.5 * loud });
      }
      if (ev.orb >= 0) {
         const o = run.course.orbs[ev.orb];
         juice.burst("pickup", o, 18, { color: "#4ade80" });
         juice.popup(o, "-0.15 s", { color: "#bbf7d0" });
         playSfx("pickup", { pitch: 1.2, volume: loud });
      }
      if (ev.powered) {
         juice.burst("aura", chest, 18, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.55 * loud, pitch: 1.2 });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 36, { color: spec.kind === "shard" ? "#c4b5fd" : "#f9a8d4" });
         juice.popup(chest, `${spec.name}!`, { color: "#f9a8d4", size: 0.075 });
         playSfx("chime", { pitch: 1.4 });
      }
      const spec = run.course.boss;
      if (ev.bossWake && spec) juice.popup({ x: spec.x, y: spec.y + 4, z: spec.z }, "The Hollow Prism!", { color: "#f0abfc", size: 0.09 });
      if (ev.bossTelegraph) playSfx("alarm", { volume: 0.25 * loud });
      if (ev.bossAttack && spec) {
         juice.shake(0.2 * loud);
         playSfx("zap", { pitch: 0.7, volume: 0.6 * loud });
      }
      if (ev.bossOpen && spec) juice.popup({ x: spec.x, y: spec.y + 6, z: spec.z }, "Its core is open: strike the code!", { color: "#fde68a", size: 0.06 });
      if (ev.bossHit && spec) {
         const at = { x: spec.x, y: spec.y + 2, z: spec.z };
         juice.burst("hit", at, 40, { color: "#f0abfc" });
         juice.popup(at, ev.bossDefeated ? "The Prism shatters!" : "Crack!", { color: "#fde68a", size: 0.08 });
         juice.shake(0.35);
         juice.hitStop(90);
         playSfx("boom", { pitch: 1.1, volume: loud });
      }
      if (ev.bossPhase && !ev.bossDefeated && run.boss) juice.popup(chest, PRISM.phases[run.boss.phase]?.name ?? "", { color: "#fde68a", size: 0.06 });
      if (ev.finished) anim.winAt = now + 0.3;
   };
}

function Simulation({ run, anim, orbit }: { run: CaveRun; anim: HeroAnim; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const effects = useCaveJuice();
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
      publishStats(run);
      if (ev.finished) {
         const h = run.hero;
         juice.burst("checkpoint", { x: h.x, y: h.y + 1, z: h.z }, 110);
         juice.popup({ x: h.x, y: h.y + 2, z: h.z }, run.boss ? "The cave is yours!" : "Every gate open!", { color: "#fde68a", size: 0.09 });
         juice.shake(0.2);
         playSfx("win", { volume: 0.7 });
         store.setStat(STAT.bonusMs, bonusMs(run));
         store.setStat(STAT.finishMs, run.finishMs);
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

const AT = { x: 0, y: 0, z: 0 };

function CaveCamera({ run, orbit }: { run: CaveRun; orbit: OrbitState }) {
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
         if (h.deadMs > 150) return false;
         AT.x = h.x;
         AT.y = Math.max(h.y, -4);
         AT.z = h.z;
         heroPivot(AT, out);
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
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} />;
}

function BossSlowMo({ run }: { run: CaveRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, PRISM.slowMo.durationMs));
      playSfx("chime", { pitch: 0.6, volume: 0.8 });
   });
   return null;
}

function IntroCamera({ run, anim }: { run: CaveRun; anim: HeroAnim }) {
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
      juice.burst("pickup", { x: h.x, y: h.y + 0.6, z: h.z }, 16, { color: heroAccent(run.heroId) });
      juice.shake(0.2);
      juice.hitStop(60);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<CaveLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(caveOrbit(run.course)), [run]);
   return (
      <JuiceLayer>
         <World course={run.course} />
         <Cave key={levelId} run={run} />
         <Prism run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <CaveCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}

