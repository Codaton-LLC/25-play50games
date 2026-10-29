"use client";

// Wall Run Temple: the run stepped in useRunFrame, the temple, the hero, Umbra, the orbit camera behind
// the corridor and the intro. Juice: dust from the feet on a wall, a camera kick and a "thunk" whose
// pitch rises through the kick chain, a 0.1 s slow-mo on a column whip, sparks off a crumbling panel,
// confetti on Umbra's hits and the capstone's slow-mo. Walls you have run turn moss green. Local
// multiplayer renders MultiScene.
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
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import World from "./World";
import CourseView, { type VisualClock } from "./CourseView";
import Umbra from "./Umbra";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, WALL_ORBIT, introKeyframes, orbitLookUp, orbitPivot, orbitScale, pivotLead, playCamera } from "./camera";
import { ORB, STAT, RUN_MS, createRun, createStepInput, step, type WallRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { WallLevel } from "./levels";
import { COMBO, SECRETS, UMBRA } from "./progression";
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

function publishBoss(run: WallRun): void {
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

/** The heading the camera follows: the corridor of the leg that starts at the hero's last pad, or the travel in a whip. */
export function travelHeading(run: WallRun, out: { x: number; z: number }): void {
   const h = run.hero;
   if (h.mode === "whip" || (h.mode === "air" && h.colLast >= 0 && run.simMs - h.colLastAt < 900)) {
      const sp = Math.hypot(h.vx, h.vz) || 1;
      out.x = (h.vx / sp) * 6;
      out.z = (h.vz / sp) * 6;
      return;
   }
   const leg = run.course.legs.find((l) => l.from === h.support) ?? run.course.legs.find((l) => l.to === h.support);
   const hd = leg ? (leg.kind === "whip" && leg.to === h.support ? leg.turns[leg.turns.length - 1] : leg.heading) : { x: 1, y: 0, z: 0 };
   out.x = hd.x * 6;
   out.z = hd.z * 6;
}

function Simulation({ run, anim, clock, orbit, visited }: { run: WallRun; anim: HeroAnim; clock: VisualClock; orbit: OrbitState; visited: Uint8Array }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useMemo(() => [autoplayRequested() ? createBot(run) : null], [run]);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const dustAt = useRef(0);
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
      if (bot) botInput(bot, run, stepInput);
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const h = run.hero;
      const now = time.now;
      chest.x = h.x;
      chest.y = h.y + 0.9;
      chest.z = h.z;
      if (ev.caught >= 0) {
         visited[ev.caught] = 1;
         juice.burst("dust", chest, 8, { color: "#e7d6b4" });
         // the catch closes a kick: the thunk climbs with the chain
         const chain = run.combo.chain;
         playSfx("thud", { volume: 0.45, pitch: 0.9 + Math.min(5, chain) * 0.12 });
         if (chain > 0) juice.kick(0, -1, 0, 1.2);
      }
      if (h.mode === "wall" && now - dustAt.current > 0.09) {
         // dust sprays from the feet on the wall
         const w = run.course.walls[h.wall];
         if (w) {
            feet.x = h.x - (w.axis === "x" ? 0 : w.n * 0.3);
            feet.y = h.y + 0.2;
            feet.z = h.z - (w.axis === "x" ? w.n * 0.3 : 0);
            juice.burst("dust", feet, 2, { color: "#d9c7a3" });
         }
         dustAt.current = now;
      }
      if (ev.kicked) {
         anim.jumpAt = now;
         const k = run.hero;
         juice.kick(-k.vx, 0, -k.vz, 2.2);
         playSfx("jump", { volume: 0.5, pitch: 1 + Math.min(5, run.combo.chain) * 0.1 });
      }
      if (ev.whipped >= 0) {
         // the column whip: a 0.1 s slow-mo and a crack of stone
         juice.hitStop(100);
         juice.burst("hit", chest, 10, { color: "#fde68a" });
         playSfx("whoosh", { volume: 0.5, pitch: 1.2 });
      }
      if (ev.rolled) {
         playSfx("whoosh", { volume: 0.35, pitch: 0.8 });
         juice.burst("aura", chest, 8, { color: heroAccent(run.heroId) });
      }
      if (ev.crumbled >= 0) {
         juice.burst("hit", chest, 18, { color: "#b9a27e" });
         juice.shake(0.2);
         playSfx("thud", { volume: 0.5, pitch: 0.6 });
      }
      if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.45 });
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
         juice.burst("hit", chest, 22, { color: "#c2a275" });
         juice.shake(0.25);
         playSfx("thud");
      }
      if (ev.landed) anim.landAt = now;
      for (let k = 0; k < ev.orbCount; k++) {
         const o = run.course.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 12, { color: o.kind === "magnet" ? COLORS.magnet : COLORS.orb });
         juice.popup(o, `-${(ORB.bonusMs / 1000).toFixed(2)} s`, { color: COLORS.orb });
         playSfx("pickup", { pitch: 1.1 });
      }
      if (ev.orbCount > 0) {
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const i2 = ev.secretList[k];
         const spot = run.course.secrets[i2];
         const spec = SECRETS[run.level][i2];
         const at = spot && spot.y > -500 ? spot : chest;
         juice.burst("checkpoint", at, 22, { color: "#a7f3d0" });
         juice.popup(at, spec?.name ?? "Secret", { color: "#a7f3d0" });
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.checkpoint >= 0) {
         const p = run.course.pads[ev.checkpoint];
         juice.burst("checkpoint", { x: p.x, y: p.y + 1, z: p.z }, 24, { color: COLORS.moss });
         playSfx("chime", { pitch: 1.1, volume: 0.5 });
      }
      if (ev.comboBonus > 0) store.setStat(STAT.comboMs, run.combo.bonusTotal);
      const flow = Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10);
      if (store.stats[STAT.comboChain] !== run.combo.chain) store.setStat(STAT.comboChain, run.combo.chain);
      const mult = Math.round(run.combo.multiplier * 100);
      if (store.stats[STAT.comboMult] !== mult) store.setStat(STAT.comboMult, mult);
      if (store.stats[STAT.comboFlow] !== flow) store.setStat(STAT.comboFlow, flow);
      const modeStat = h.mode === "ground" || h.mode === "spawn" ? 0 : h.mode === "air" ? 1 : h.mode === "wall" ? 2 : h.mode === "whip" ? 3 : 4;
      if (store.stats[STAT.mode] !== modeStat) store.setStat(STAT.mode, modeStat);
      const left = h.mode === "wall" ? Math.max(0, Math.round((1 - h.wallT / RUN_MS) * 20)) : 0;
      if (store.stats[STAT.runLeft] !== left) store.setStat(STAT.runLeft, left);
      const dist = Math.round(Math.abs(h.x - run.startX) + Math.abs(h.z - run.startZ));
      if (store.stats[STAT.distance] !== dist) store.setStat(STAT.distance, dist);
      if (ev.bossHit) {
         juice.burst("hit", chest, 26, { color: "#c4b5fd" });
         juice.burst("checkpoint", chest, 36, { color: COLORS.moss });
         juice.shake(0.3);
         juice.hitStop(80);
         playSfx("thud", { pitch: 1.15 });
      }
      if (ev.plateThrown) playSfx("whoosh", { volume: 0.4, pitch: 0.7 });
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 80, { color: COLORS.glyph });
         juice.hitStop(140);
         playSfx("chime", { pitch: 0.7 });
      }
      if (ev.lost) {
         anim.lostAt = now;
         juice.shake(0.3);
         playSfx("lose", { volume: 0.45 });
         store.setStat(STAT.falls, run.hits);
      }
      if (ev.floorReset) playSfx("thud", { volume: 0.4, pitch: 0.8 });
      if (ev.respawned) anim.spawnAt = now;
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

function WallCamera({ run, orbit }: { run: WallRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const lead = useRef(2);
   lead.current = pivotLead(aspect);
   const base = aspect < 1 ? FOV_PORTRAIT : FOV;
   useEffect(() => {
      camera.fov = base;
      camera.updateProjectionMatrix();
   }, [camera, base]);
   const head = useMemo(() => ({ x: 1, z: 0 }), []);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         const h = run.hero;
         if (h.mode === "lost") return false;
         travelHeading(run, head);
         orbitPivot(h.x, h.y, h.z, head.x / 6, head.z / 6, out, lead.current);
         return true;
      },
      [run, head],
   );
   const travel = useMemo(() => (out: { x: number; z: number }) => travelHeading(run, out), [run]);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} />;
}

function IntroCamera({ run, anim }: { run: WallRun; anim: HeroAnim }) {
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

function SlowMo({ run }: { run: WallRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, UMBRA.slowMo?.durationMs ?? 140));
   });
   return null;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<WallLevel>();
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
   const firstYaw = useMemo(() => {
      const h = run.course.legs[0]?.heading ?? { x: 1, z: 0 };
      return Math.atan2(-h.x, -h.z);
   }, [run]);
   const orbit = useMemo(() => createOrbit({ ...WALL_ORBIT, yaw: firstYaw }), [run, firstYaw]);
   const visited = useMemo(() => new Uint8Array(run.course.walls.length), [run]);
   const look = levelLook(levelId);
   const fog = useMemo(() => ({ color: look.fog[0], near: look.fog[1], far: look.fog[2] }), [look]);
   return (
      <JuiceLayer>
         <World key={`w${levelId}`} course={run.course} level={levelId} />
         <CourseView key={`c${levelId}`} run={run} clock={clock} fog={fog} visited={visited} />
         {run.course.boss ? <Umbra key={`u${levelId}`} run={run} /> : null}
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} clock={clock} orbit={orbit} visited={visited} />
         <WallCamera run={run} orbit={orbit} />
         <SlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
