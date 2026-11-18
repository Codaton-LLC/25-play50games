"use client";

// Neon Cube Jump's scene: the run (rules.ts) stepped in useRunFrame, the void (World), the cube field
// (Field), Flipframe on level 5, the hero (Hero), the free orbit camera (menu2/camera: the stick is
// camera-relative through StepInput.yaw = orbit.viewYaw; left alone it swings behind the run), the
// intro (core/intro) and the juice (menu2/juice): every flip ripples a ring outward from the hero across
// the field with a glass chime that rises on alternate flips, orb and coin pops, the fall's dissolve,
// the stomp's camera kick, hits and the slow-mo finish. Remounted for every run (runId). Local
// multiplayer renders MultiScene.tsx instead.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh, MeshBasicMaterial, PerspectiveCamera } from "three";
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
import { Field } from "./FieldView";
import { Flipframe } from "./Boss";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, heroPivot, introKeyframes, neonOrbit, orbitLookUp, orbitScale, playCamera } from "./camera";
import { STAT, bonusMs, createRun, createStepInput, hintFor, step, type NeonRun, type StepEvents } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { NeonLevel } from "./levels";
import { COMBO, FLIPFRAME, SECRETS } from "./progression";
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

export function publishStats(run: NeonRun): void {
   const store = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   set(STAT.solid, run.solid === "A" ? 0 : 1);
   set(STAT.parity, run.parity % 2);
   set(STAT.orbs, run.orbs);
   set(STAT.coins, run.coins);
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

/** The flip ripple: a ring that runs outward from the hero over the field on every flip. */
export interface Ripple {
   at: number;
   x: number;
   y: number;
   z: number;
   set: "A" | "B";
}

export function createRipple(): Ripple {
   return { at: -9, x: 0, y: 0, z: 0, set: "A" };
}

function RippleView({ ripple }: { ripple: Ripple }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const t = time.now - ripple.at;
      m.visible = t >= 0 && t < 0.7;
      if (!m.visible) return;
      m.position.set(ripple.x, ripple.y + 0.08, ripple.z);
      m.scale.setScalar(0.5 + t * 26);
      const mat = m.material as MeshBasicMaterial;
      mat.opacity = 0.7 * (1 - t / 0.7);
      mat.color.set(ripple.set === "A" ? COLORS.a : COLORS.b);
   });
   return (
      <mesh ref={ref} rotation-x={-Math.PI / 2} visible={false} renderOrder={4}>
         <ringGeometry args={[0.9, 1, 64]} />
         <meshBasicMaterial transparent opacity={0.7} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

/** The juice and sounds of one step's events (solo and, quieter, multiplayer). */
export function useNeonJuice() {
   const juice = useJuice();
   return (run: NeonRun, ev: StepEvents, anim: HeroAnim, ripple: Ripple, now: number, loud = 1) => {
      const h = run.hero;
      const chest = { x: h.x, y: h.y + 1.1, z: h.z };
      const feet = { x: h.x, y: h.y + 0.1, z: h.z };
      if (ev.flipped) {
         ripple.at = now;
         ripple.x = h.x;
         ripple.y = h.y;
         ripple.z = h.z;
         ripple.set = run.solid;
         playSfx("chime", { pitch: run.flips % 2 === 0 ? 1.25 : 1, volume: (ev.autoFlip ? 0.25 : 0.4) * loud });
      }
      if (ev.jumped) playSfx("jump", { volume: 0.4 * loud });
      if (ev.doubled) {
         juice.burst("aura", feet, 12, { color: heroAccent(run.heroId) });
         playSfx("jump", { pitch: 1.3, volume: 0.4 * loud });
      }
      if (ev.landed) {
         juice.burst("dust", feet, 6, { color: run.solid === "A" ? COLORS.a : COLORS.b });
         playSfx("thud", { pitch: 1.5, volume: 0.3 * loud });
      }
      if (ev.comboBonus > 0 && run.combo.chain > 2) juice.popup(chest, `Chain x${run.combo.chain}`, { color: "#e9d5ff", size: 0.05 });
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
         juice.burst("hit", chest, 18, { color: "#f97316" });
         juice.shake(0.3 * loud);
         juice.hitStop(60);
         playSfx("hit", { volume: 0.5 * loud });
      }
      if (ev.checkpoint) {
         juice.burst("checkpoint", feet, 18, { color: "#4ade80" });
         playSfx("chime", { pitch: 1.5, volume: 0.35 * loud });
      }
      if (ev.orb >= 0) {
         const o = run.course.orbs[ev.orb];
         juice.burst("pickup", o, 18, { color: "#4ade80" });
         juice.popup(o, "-0.15 s", { color: "#bbf7d0" });
         playSfx("pickup", { pitch: 1.2, volume: loud });
      }
      if (ev.coin >= 0) {
         const o = run.course.coins[ev.coin];
         juice.burst("pickup", o, 10, { color: "#facc15" });
         playSfx("chime", { pitch: 1.7, volume: 0.35 * loud });
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
      if (ev.bossWake && spec) juice.popup({ x: spec.x, y: 8, z: spec.z }, "Flipframe!", { color: "#f0abfc", size: 0.09 });
      if (ev.bossTelegraph && run.boss?.phase === 0) playSfx("alarm", { volume: 0.25 * loud });
      if (ev.bossAttack && run.boss?.phase === 0 && spec) {
         juice.kick(0, -1, 0, 6);
         juice.shake(0.35 * loud);
         playSfx("boom", { pitch: 0.6, volume: 0.6 * loud });
      }
      if (ev.dodged) juice.popup(chest, "Dodged!", { color: "#86efac", size: 0.06 });
      if (ev.bossHit && spec) {
         const at = { x: h.x, y: h.y + 1.5, z: h.z };
         juice.burst("hit", at, 30, { color: "#f0abfc" });
         juice.popup(at, ev.bossDefeated ? "Flipframe shatters!" : "Crack!", { color: "#fde68a", size: 0.08 });
         juice.shake(0.3);
         juice.hitStop(90);
         playSfx("boom", { pitch: 1.1, volume: loud });
      }
      if (ev.bossPhase && !ev.bossDefeated && run.boss) juice.popup(chest, FLIPFRAME.phases[run.boss.phase]?.name ?? "", { color: "#fde68a", size: 0.06 });
      if (ev.finished) anim.winAt = now + 0.3;
   };
}

function Simulation({ run, anim, orbit, ripple }: { run: NeonRun; anim: HeroAnim; orbit: OrbitState; ripple: Ripple }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const effects = useNeonJuice();
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
      effects(run, ev, anim, ripple, now);
      publishStats(run);
      if (ev.finished) {
         const h = run.hero;
         juice.burst("checkpoint", { x: h.x, y: h.y + 1, z: h.z }, 110);
         juice.popup({ x: h.x, y: h.y + 2, z: h.z }, run.boss ? "Colour restored!" : "Field cleared!", { color: "#fde68a", size: 0.09 });
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

function NeonCamera({ run, orbit }: { run: NeonRun; orbit: OrbitState }) {
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

function BossSlowMo({ run }: { run: NeonRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, FLIPFRAME.slowMo.durationMs));
      playSfx("chime", { pitch: 0.6, volume: 0.8 });
   });
   return null;
}

function IntroCamera({ run, anim }: { run: NeonRun; anim: HeroAnim }) {
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
   const { config } = useLevel<NeonLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const ripple = useMemo(createRipple, [run]);
   const orbit = useMemo(() => createOrbit(neonOrbit(run.course)), [run]);
   return (
      <JuiceLayer>
         <World course={run.course} />
         <Field key={levelId} run={run} />
         <Flipframe run={run} />
         <Hero run={run} anim={anim} />
         <RippleView ripple={ripple} />
         <Simulation run={run} anim={anim} orbit={orbit} ripple={ripple} />
         <NeonCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}

export { RippleView };
