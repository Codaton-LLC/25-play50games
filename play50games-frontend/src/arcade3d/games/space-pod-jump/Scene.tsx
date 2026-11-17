"use client";

// Space Pod Jump's scene: the run (rules.ts) stepped in useRunFrame, the void (World.tsx), the system
// (Course.tsx), the hero (Hero.tsx, menu2/heroAnim), the free orbit camera (menu2/camera: two fingers /
// mouse drag / wheel / pinch) looking at the play plane from +z and rolled so the local down is the bottom
// of the screen (25 degrees a second at most; the HUD's switch keeps up fixed), the intro (core/intro) and
// the juice (menu2/juice): a soft whomp and a dust ring entering a body's SOI, a capture's chime (the
// dots lock on), the pod's rising hum and its launch burst, the jets' blue puffs, a "Perfect Orbit" for 3
// captures in a row without jets, knocks, the starfield streaking at speed, and on level 5 the Orbit
// Warden's mines, vents, belt and slow-mo finish. Remounted for every run. 2-4 players: MultiScene.tsx.
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
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import World from "./World";
import { Course } from "./Course";
import { Hero, createHeroAnim, targetUp, type HeroAnim } from "./Hero";
import { POD_ORBIT, FOV, FOV_PORTRAIT, introKeyframes, orbitLookUp, orbitPivot, orbitScale, orbitTravel, playCamera, stepRoll } from "./camera";
import { JETS, NONE, POD, STAT, bodyAt, bossVulnerable, createRun, createStepInput, distanceOf, podUnder, runTimeMs, step, type PodRun, type StepEvents } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { PodLevel } from "./levels";
import { COMBO, SECRETS, WARDEN } from "./progression";
import { levelEndStats } from "./levelEnd";
import { upFixed } from "./upPref";
import MultiScene from "./MultiScene";

function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

const HERO_STAT = { riko: 0, nami: 1, kiro: 2, zuno: 3, vexa: 4 } as const;

/** The camera's roll (shared by the camera, which applies it, and the input, which reads it). */
export interface RollRef {
   roll: number;
}

export function publishRun(run: PodRun): void {
   const store = useArcadeStore.getState();
   const h = run.hero;
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   set(STAT.orbs, run.orbs);
   set(STAT.mainOrbs, run.mainOrbs);
   set(STAT.gates, run.gates);
   set(STAT.distance, Math.round(distanceOf(run)));
   set(STAT.speed, Math.round(Math.hypot(h.vx, h.vy) * 10));
   set(STAT.hero, HERO_STAT[run.heroId]);
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
   set(STAT.fuel, Math.round((h.fuelMs / JETS.fuelMs) * 100));
   set(STAT.charge, h.pod !== NONE ? Math.round((h.chargeMs / POD.chargeMs) * 100) : -1);
   set(STAT.onPod, podUnder(run) !== NONE && h.pod === NONE ? 1 : 0);
   set(STAT.lost, h.lostMs > 0 ? 1 : 0);
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

const B = { x: 0, y: 0, vx: 0, vy: 0 };

export function juiceEvents(run: PodRun, ev: StepEvents, anim: HeroAnim, juice: ReturnType<typeof useJuice>, now: number, tag = ""): void {
   const h = run.hero;
   const c = run.course;
   const chest = { x: h.x, y: h.y + 0.8, z: 0.3 };
   const feet = { x: h.x, y: h.y, z: 0.3 };
   if (ev.airJumped) {
      anim.airJumpAt = now;
      juice.burst("aura", chest, 14, { color: heroAccent(run.heroId) });
      playSfx("jump", { volume: 0.6, pitch: 1.3 });
   } else if (ev.jumped) {
      anim.jumpAt = now;
      juice.burst("dust", feet, 10, { color: "#c4b5fd" });
      playSfx("jump", { volume: 0.5 });
   }
   if (ev.launched) {
      anim.jumpAt = now;
      juice.burst("hit", feet, 30, { color: "#f5c542", vy: 2 });
      juice.burst("dust", feet, 16, { color: "#c4b5fd" });
      juice.kick(0, -1, 0, 2.5);
      playSfx("whoosh", { volume: 0.8, pitch: 0.7 + ev.launchSpeed * 0.05 });
   }
   if (ev.charging && run.simMs % 160 < 17) playSfx("click", { volume: 0.15, pitch: 0.8 + h.chargeMs / 800 });
   if (ev.landed) {
      anim.landAt = now;
      juice.burst("dust", feet, 14, { color: "#c4b5fd" });
      playSfx("thud", { volume: 0.35, pitch: 1.3 });
   }
   if (ev.soiEnter !== NONE) {
      // a soft whomp and a dust ring entering a body's sphere of influence
      bodyAt(c, ev.soiEnter, run.simMs, B);
      juice.burst("aura", { x: h.x, y: h.y, z: 0 }, 12, { color: "#7ee8ff" });
      playSfx("thud", { volume: 0.22, pitch: 0.5 });
   }
   if (ev.capture) {
      juice.burst("checkpoint", feet, 30, { color: "#c4b5fd" });
      playSfx("chime", { pitch: 1.2, volume: 0.5 });
   }
   if (ev.perfect) {
      juice.popup(chest, `${tag}Perfect Orbit!`, { color: "#c4b5fd", size: 0.09 });
      juice.burst("checkpoint", chest, 50, { color: "#ff7ae6" });
      playSfx("combo", { pitch: 1.3 });
   }
   if (ev.jets && run.simMs % 60 < 17) juice.burst("dust", feet, 3, { color: "#7ee8ff", vx: -h.vx * 0.3, vy: -h.vy * 0.3 });
   if (ev.burned) {
      juice.burst("hit", chest, 26, { color: "#ef4444" });
      playSfx("whoosh", { volume: 0.7, pitch: 1.1 });
   }
   if (ev.knocked) {
      anim.hurtAt = now;
      juice.burst("hit", chest, 24, { color: "#ff6a7a" });
      juice.popup(chest, `${tag}Knocked!`, { color: "#fecaca", size: 0.07 });
      juice.shake(0.3);
      playSfx("thud", { volume: 0.6, pitch: 0.8 });
   }
   if (ev.smashed) {
      juice.burst("hit", chest, 40, { color: "#5c6ad8" });
      juice.popup(chest, `${tag}Smash!`, { color: "#c7d2fe", size: 0.08 });
      playSfx("thud", { pitch: 1.2 });
   }
   if (ev.lost) {
      juice.popup(chest, `${tag}Lost in space...`, { color: "#e5e7eb", size: 0.07 });
      playSfx("whoosh", { volume: 0.4, pitch: 0.4 });
   }
   if (ev.respawned) juice.burst("checkpoint", chest, 30, { color: "#7ee8ff" });
   if (ev.chordStart) {
      juice.burst("aura", chest, 30, { color: "#c4b5fd" });
      playSfx("chime", { pitch: 1.8, volume: 0.5 });
   }
   if (ev.chordEnd) juice.burst("dust", feet, 20, { color: "#c4b5fd" });
   if (ev.pushed !== NONE) {
      juice.burst("hit", chest, 20, { color: "#f5c542" });
      playSfx("thud", { volume: 0.5, pitch: 1.4 });
   }
   if (ev.gatePassed !== NONE) {
      const g = c.gates[ev.gatePassed];
      juice.burst("checkpoint", { x: g.x, y: g.y, z: 0 }, 40, { color: "#7dff9b" });
      juice.popup(chest, `${tag}Slingshot!`, { color: "#bbf7d0", size: 0.08 });
      playSfx("chime", { pitch: 1.5 });
   }
   if (ev.powered) {
      juice.burst("pickup", chest, 16, { color: heroAccent(run.heroId) });
      playSfx("whoosh", { volume: 0.5, pitch: 1.15 });
   }
   for (let k = 0; k < Math.min(ev.orbCount, ev.orbList.length); k++) {
      const o = c.orbs[ev.orbList[k]];
      juice.burst("pickup", { x: o.x, y: o.y, z: 0 }, 14, { color: "#38bdf8" });
      juice.popup({ x: o.x, y: o.y + 0.4, z: 0 }, `${tag}+1`, { color: "#bae6fd", size: 0.045 });
      playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.02) });
   }
   for (let k = 0; k < ev.secretCount; k++) {
      const spec = SECRETS[run.level][ev.secretList[k]];
      juice.burst("checkpoint", chest, 30, { color: spec.kind === "shard" ? "#ddd6fe" : "#f9a8d4" });
      juice.popup(chest, `${spec.name}!`, { color: "#ddd6fe", size: 0.07 });
      juice.hitStop(40);
      playSfx("chime", { pitch: 1.4 });
   }
   // level 5
   const w = c.warden >= 0 ? c.bodies[c.warden] : null;
   const wp = w ? { x: w.x, y: w.y, z: 0 } : chest;
   if (ev.bossTelegraph) playSfx("whoosh", { volume: 0.35, pitch: 0.5 });
   if (ev.mine) {
      juice.popup({ x: run.mineX, y: run.mineY + 1, z: 0 }, `${tag}Gravity mine!`, { color: "#e9d5ff", size: 0.06 });
      playSfx("zap", { volume: 0.4, pitch: 0.6 });
   }
   if (ev.vent || ev.thruster || ev.fastHit) {
      juice.burst("hit", chest, 36, { color: "#ff7ae6" });
      juice.popup(chest, `${tag}${ev.vent ? "Vent!" : ev.thruster ? "Thruster!" : "Full speed!"}`, { color: "#fbcfe8", size: 0.08 });
      playSfx("thud", { pitch: 1.1 });
   }
   if (ev.bossHit) {
      juice.burst("hit", wp, 50, { color: "#ff7ae6" });
      juice.shake(0.35);
      juice.hitStop(90);
      playSfx("boom", { volume: 0.6, pitch: 1.1 });
   }
   if (ev.bossDefeated) {
      juice.burst("checkpoint", wp, 140, { color: "#b26bff" });
      juice.popup(chest, `${tag}The Warden powers down!`, { color: "#e9d5ff", size: 0.1 });
      juice.shake(0.5);
      juice.hitStop(Math.min(140, WARDEN.slowMo.durationMs));
   }
}

function Simulation({ run, anim, roll }: { run: PodRun; anim: HeroAnim; roll: RollRef }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const streak = useMemo(createJuiceEmitter, []);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;
   const orbitRef = useRef<OrbitState | null>(null);
   void orbitRef;

   useRunFrame((_state, dt) => {
      const i = input.current;
      stepInput.moveX = i.moveX;
      stepInput.up = i.moveY < -0.5 || i.pressed.up;
      stepInput.jump = i.jump;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.actionPressed = i.actionPressed;
      stepInput.roll = roll.roll;
      stepInput.yaw = 0;
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
      // the starfield streak at speed
      const sp = Math.hypot(h.vx, h.vy);
      if (!h.grounded && sp > 8) juice.stream("dust", { x: h.x - h.vx * 0.3, y: h.y - h.vy * 0.3, z: -1 }, (sp - 8) * 12, streak, { color: "#e9ddff", vx: -h.vx * 0.5, vy: -h.vy * 0.5, size: 0.08 });
      publishRun(run);
      if (ev.finished) {
         anim.winAt = now;
         juice.burst("checkpoint", { x: h.x, y: h.y + 1, z: 0 }, 110, { color: "#b26bff" });
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

function PodCamera({ run, orbit, anim, roll }: { run: PodRun; orbit: OrbitState; anim: HeroAnim; roll: RollRef }) {
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
         orbitPivot(h.x, h.y, h.grounded ? 0 : h.vx, h.grounded ? 0 : h.vy, out);
         return true;
      },
      [run],
   );
   const travel = useMemo(() => (out: { x: number; z: number }) => orbitTravel(out), []);
   // the roll: towards the local down at most 25 degrees a second, after the orbit placed the camera
   useFrame((_s, delta) => {
      const want = upFixed() ? 0 : targetUp(run);
      if (Number.isFinite(want)) roll.roll = stepRoll(roll.roll, upFixed() ? 0 : want - Math.PI / 2, Math.min(0.1, delta));
      camera.rotateZ(roll.roll);
      void anim;
   }, FRAME_PRIORITY.camera + 0.05);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} input={{ oneFinger: false }} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} bottomCover={false} />;
}

function BossSlowMo({ run }: { run: PodRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, WARDEN.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: PodRun; anim: HeroAnim }) {
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
      juice.burst("dust", { x: h.x, y: h.y, z: 0.3 }, 26, { color: "#c4b5fd", vy: 3 });
      juice.burst("pickup", { x: h.x, y: h.y + 0.7, z: 0.3 }, 16, { color: heroAccent(run.heroId) });
      juice.shake(0.25);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<PodLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(POD_ORBIT), [run]);
   const roll = useMemo<RollRef>(() => ({ roll: 0 }), [run]);
   const speed = useMemo(() => ({ v: 0 }), [run]);
   useFrame(() => {
      speed.v = Math.hypot(run.hero.vx, run.hero.vy);
   });
   return (
      <JuiceLayer>
         <World course={run.course} view={run.hero} speed={speed} />
         <Course key={levelId} run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} roll={roll} />
         <PodCamera run={run} orbit={orbit} anim={anim} roll={roll} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
