"use client";

// Sky Hook Swing: the pendulum run stepped in useRunFrame, the docks, the hero, the orbit camera
// (yaw -π/2 so screen-up walks +x) and the intro. Juice: hook thunk, release whoosh, the green
// peak flash with a short hit-stop. Local multiplayer renders MultiScene.
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";
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
import Docks, { Rope, type AimState, type VisualClock } from "./Docks";
import Galleon from "./Galleon";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, SWING_ORBIT, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { ORB, STAT, createRun, createStepInput, peekAim, step, type SwingRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { SwingLevel } from "./levels";
import { COMBO, GUST_GALLEON, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import MultiScene from "./MultiScene";
import { COLORS, levelLook } from "./look";

function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

function publishBoss(run: SwingRun): void {
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

/** Camera extras the simulation triggers: the peak release's FOV kick, and the pull-back on a big arc. */
export interface CameraFx {
   fov: number;
   pull: number;
}

function Simulation({ run, anim, clock, orbit, aim, fx }: { run: SwingRun; anim: HeroAnim; clock: VisualClock; orbit: OrbitState; aim: AimState; fx: CameraFx }) {
   const lastTheta = useRef(0);
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useMemo(() => [autoplayRequested() ? createBot(run) : null], [run]);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const wasPeak = useRef(false);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;

   useRunFrame((_state, dt) => {
      const i = input.current;
      stepInput.moveX = i.moveX;
      stepInput.moveZ = i.moveY;
      stepInput.yaw = orbit.viewYaw;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.jumpHeld = i.jump;
      stepInput.actionPressed = i.actionPressed;
      if (bot) {
         stepInput.yaw = 0;
         botInput(bot, run, stepInput);
      }
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const h = run.hero;
      const now = time.now;
      chest.x = h.x;
      chest.y = h.y + 1;
      chest.z = h.z;
      if (ev.hooked >= 0) {
         juice.burst("hit", chest, 8, { color: COLORS.rope });
         playSfx("thud", { volume: 0.45, pitch: 1.35 });
      }
      if (ev.released) {
         playSfx("whoosh", { volume: 0.4, pitch: ev.peakRelease ? 1.3 : 0.9 });
         if (ev.peakRelease) {
            juice.burst("pickup", chest, 16, { color: COLORS.peak });
            juice.hitStop(50);
            juice.shake(0.16);
            fx.fov = 7;
         }
      }
      // a whoosh through the bottom of a fast arc
      if (h.mode === "swing") {
         if (Math.sign(h.theta) !== Math.sign(lastTheta.current) && Math.abs(h.omega) * h.L > 9) playSfx("whoosh", { volume: 0.25, pitch: 0.7 + Math.min(0.5, Math.abs(h.omega) * h.L * 0.02) });
         lastTheta.current = h.theta;
      }
      if (ev.snapped) {
         juice.burst("hit", chest, 14, { color: COLORS.cracked });
         juice.shake(0.2);
         playSfx("thud", { volume: 0.5, pitch: 0.7 });
      }
      if (h.peak && !wasPeak.current) {
         juice.burst("aura", chest, 10, { color: COLORS.peak });
      }
      wasPeak.current = h.peak;
      if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.5 });
      }
      if (ev.airJumped) {
         anim.airJumpAt = now;
         playSfx("jump", { volume: 0.5, pitch: 1.25 });
      }
      if (ev.powered) {
         juice.burst("pickup", chest, 16, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.45, pitch: 1.1 });
      }
      if (ev.smashed >= 0) {
         juice.burst("hit", chest, 18, { color: "#94a3b8" });
         playSfx("thud");
      }
      if (ev.landed) anim.landAt = now;
      for (let k = 0; k < ev.orbCount; k++) {
         const o = run.course.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 12, { color: COLORS.orb });
         juice.popup(o, `-${(ORB.bonusMs / 1000).toFixed(1)} s`, { color: COLORS.orb });
         playSfx("pickup", { pitch: 1.1 });
      }
      if (ev.orbCount > 0) {
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spot = run.course.secrets[ev.secretList[k]];
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", spot, 22, { color: "#bae6fd" });
         juice.popup(spot, spec.name, { color: "#bae6fd" });
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.comboBonus > 0) store.setStat(STAT.comboMs, run.combo.bonusTotal);
      const flow = Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10);
      if (store.stats[STAT.comboChain] !== run.combo.chain) store.setStat(STAT.comboChain, run.combo.chain);
      const mult = Math.round(run.combo.multiplier * 100);
      if (store.stats[STAT.comboMult] !== mult) store.setStat(STAT.comboMult, mult);
      if (store.stats[STAT.comboFlow] !== flow) store.setStat(STAT.comboFlow, flow);
      const rope = Math.round(h.L * 10);
      if (store.stats[STAT.rope] !== rope) store.setStat(STAT.rope, rope);
      if (store.stats[STAT.peak] !== (h.peak ? 1 : 0)) store.setStat(STAT.peak, h.peak ? 1 : 0);
      const modeStat = h.mode === "ground" || h.mode === "spawn" ? 0 : h.mode === "air" ? 1 : h.mode === "swing" ? 2 : 3;
      if (store.stats[STAT.mode] !== modeStat) store.setStat(STAT.mode, modeStat);
      const xStat = Math.round(h.x);
      if (store.stats[STAT.distance] !== xStat) store.setStat(STAT.distance, xStat);
      if (ev.bossHit) {
         // a turret knocked off goes up in confetti-blue
         juice.burst("hit", chest, 24, { color: "#93c5fd" });
         juice.burst("checkpoint", chest, 40, { color: "#60a5fa" });
         juice.burst("pickup", chest, 30, { color: "#bfdbfe" });
         juice.shake(0.28);
         juice.hitStop(70);
         playSfx("thud", { pitch: 1.15 });
      }
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 70, { color: COLORS.bell });
         juice.hitStop(120);
         playSfx("chime", { pitch: 0.7 });
      }
      if (ev.lost) {
         anim.lostAt = now;
         juice.shake(0.3);
         playSfx("lose", { volume: 0.45 });
         store.setStat(STAT.falls, run.hits);
      }
      if (ev.respawned) anim.spawnAt = now;
      publishBoss(run);
      // the auto-target highlight: the ring a press would take now (the card's mobile aim fix)
      aim.index = bot ? -1 : peekAim(run, i.moveX, i.moveY, orbit.viewYaw);
      // the camera pulls back on a big, fast arc
      const speed = Math.hypot(h.vx, h.vy, h.vz);
      const wantPull = h.mode === "swing" || h.mode === "air" ? Math.min(1, Math.max(0, (speed - 8) / 14)) * (h.mode === "swing" ? Math.min(1, h.L / 10) : 0.8) : 0;
      fx.pull += (wantPull - fx.pull) * Math.min(1, dt * 1.6);
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
      } else if (ev.timeup) {
         levelEndStats(run, userRef.current);
         store.end("timeup");
      }
   });

   useFrame(() => {
      const s = useArcadeStore.getState();
      if (s.phase === "countdown") clock.ms = 0;
      else if (s.phase === "over") clock.ms = run.simMs + s.overMs;
      else clock.ms = run.simMs;
   }, FRAME_PRIORITY.camera);
   return null;
}

const FWD = new Vector3();

function SwingCamera({ run, orbit, fx }: { run: SwingRun; orbit: OrbitState; fx: CameraFx }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const lead = useRef(0);
   const base = aspect < 1 ? FOV_PORTRAIT : FOV;
   useEffect(() => {
      camera.fov = base;
      camera.updateProjectionMatrix();
   }, [camera, base]);
   // after the orbit placed the camera: the FOV kick eases back, the pull-back eases out
   useFrame((_s, delta) => {
      const dt = Math.min(0.1, delta);
      fx.fov *= Math.exp(-dt * 4);
      const fov = base + fx.fov;
      if (Math.abs(camera.fov - fov) > 0.01) {
         camera.fov = fov;
         camera.updateProjectionMatrix();
      }
      if (fx.pull > 0.001) {
         camera.getWorldDirection(FWD);
         camera.position.addScaledVector(FWD, -fx.pull * 5);
      }
   }, FRAME_PRIORITY.camera + 0.02);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         const h = run.hero;
         const islands = run.course.islands;
         let nx = h.x + 8;
         let ny = h.y;
         let nz = h.z;
         for (let i = 0; i < islands.length; i++) {
            const s = islands[i];
            if (s.cp && s.x > h.x + 1) {
               nx = s.x;
               ny = s.y;
               nz = s.z;
               break;
            }
         }
         if (h.mode === "lost") return false;
         orbitPivot(h.x, h.y, h.z, nx, ny, nz, out);
         lead.current = nx;
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
   return (
      <OrbitCamera
         orbit={orbit}
         pivot={pivot}
         travel={travel}
         lookUp={orbitLookUp(aspect)}
         distanceScale={orbitScale(aspect)}
      />
   );
}

function IntroCamera({ run, anim }: { run: SwingRun; anim: HeroAnim }) {
   const intro = useShellIntro();
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const keys = useMemo(() => introKeyframes(run.course), [run.course]);
   const play = useMemo(() => playCamera(run.course, aspect), [run.course, aspect]);
   const running = !!intro?.session && !intro.ready;
   useFrame(() => {
      anim.intro = running && intro ? intro.hero.current : Number.NaN;
   }, FRAME_PRIORITY.pose);
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SlowMo({ run }: { run: SwingRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, GUST_GALLEON.slowMo?.durationMs ?? 140));
   });
   return null;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<SwingLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [run]);
   const orbit = useMemo(() => createOrbit(SWING_ORBIT), [run]);
   const aim = useMemo<AimState>(() => ({ index: -1 }), [run]);
   const fx = useMemo<CameraFx>(() => ({ fov: 0, pull: 0 }), [run]);
   const hand = useMemo(() => ({ x: 0, y: 0, z: 0 }), [run]);
   const look = levelLook(levelId);
   const fog = useMemo(() => ({ color: look.fog[0], near: look.fog[1], far: look.fog[2] }), [look]);
   return (
      <JuiceLayer>
         <World course={run.course} level={levelId} clock={clock} />
         <Docks run={run} clock={clock} aim={aim} fog={fog} />
         {run.course.boss ? <Galleon run={run} clock={clock} /> : null}
         <Hero run={run} anim={anim} hand={hand} />
         <Rope run={run} clock={clock} hand={hand} />
         <Simulation run={run} anim={anim} clock={clock} orbit={orbit} aim={aim} fx={fx} />
         <SwingCamera run={run} orbit={orbit} fx={fx} />
         <SlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
