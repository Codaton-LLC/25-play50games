"use client";

// Toy Room Run's scene: the run (rules.ts) stepped in useRunFrame, the playroom (World + Course),
// Jack Wobble (Boss), the hero, the free orbit camera (menu2/camera: movement is camera-relative
// through StepInput.yaw), the intro (core/intro, index.tsx `intro: true`), a ground arrow toward the
// next thing to do, and the juice (menu2/juice): a click-clack that rises in pitch along a chain and a
// dust puff under every falling piece, the bounce off a standing piece, the drum's boing with a squash
// and a camera kick, the fall to the carpet, checkpoints, a "Surf!" for crossing right behind the wave,
// Jack's hits and his slow-mo finish (visual only). Remounted per run (runId). Local multiplayer
// renders MultiScene.tsx.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group, PerspectiveCamera } from "three";
import { arcadeStore, useArcadeStore } from "@/arcade3d/core/useArcadeStore";
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
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { ORBIT_DRIVER_PRIORITY, OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { World } from "./World";
import { Course, type VisualClock } from "./Course";
import { Boss } from "./Boss";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { ROOM_COLLISION, FOV, FOV_PORTRAIT, roomOrbit, courseSolids, introKeyframes, steerBossFraming, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { ORB_BONUS_MS, STAT, createRun, createStepInput, guidePoint, step, type ToyRun, type StepEvents } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { ToySpec } from "./levels";
import { COMBO, JACK, SECRETS } from "./progression";
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

const HERO_INDEX = { riko: 0, nami: 1, kiro: 2, zuno: 3, vexa: 4 } as const;

export function publishBoss(run: ToyRun): void {
   const b = run.boss;
   if (!b) return;
   const store = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   set(STAT.bossHp, b.hp);
   set(STAT.bossPhase, b.phase);
   set(STAT.bossOpen, b.step === "vulnerable" ? 1 : 0);
   set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
   set(STAT.bossOn, b.step === "intro" ? 0 : 1);
}

/** The HUD's numbers that change during a run (written only when they change). */
export function publishRun(run: ToyRun): void {
   const store = useArcadeStore.getState();
   const h = run.hero;
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   set(STAT.orbs, run.orbs);
   set(STAT.mainOrbs, run.mainOrbs);
   set(STAT.hero, HERO_INDEX[run.heroId]);
   set(STAT.power, Math.max(0, Math.ceil((h.powerReadyAt - run.simMs) / 1000)));
   set(STAT.dashes, h.dashes);
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10));
   set(STAT.comboMs, run.combo.bonusTotal);
   set(STAT.progress, Math.max(0, Math.min(100, Math.round(((h.z - run.course.startZ) / Math.max(1, run.course.finish.z - run.course.startZ)) * 100))));
   set(STAT.strikes, run.strikes);
   publishBoss(run);
}

function Simulation({ run, anim, clock, won, orbit }: { run: ToyRun; anim: HeroAnim; clock: VisualClock; won: { current: boolean }; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const trail = useMemo(createJuiceEmitter, []);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;
   const accent = heroAccent(run.heroId);

   const clack = useRef({ chain: -1, n: 0 });
   const react = (ev: StepEvents) => {
      const store = useArcadeStore.getState();
      const h = run.hero;
      const now = time.now;
      chest.x = feet.x = h.x;
      chest.z = feet.z = h.z;
      chest.y = h.y + 1.1;
      feet.y = h.y + 0.1;
      if (h.grounded && Math.hypot(h.vx, h.vz) > 4) juice.stream("dust", feet, 6, trail, { color: "#e7d8c3", vx: -h.vx * 0.2, vy: 1.2, vz: -h.vz * 0.2, size: 0.5 });
      if (ev.chainStarted >= 0) {
         clack.current = { chain: ev.chainStarted, n: 0 };
         juice.popup(chest, "Push!", { color: COLORS.wave, size: 0.06 });
         playSfx("thud", { volume: 0.5, pitch: 1.3 });
      }
      if (ev.toppled > 0 && ev.lastToppled >= 0) {
         // click-clack, rising with the chain's length; a puff under the piece
         const p = run.course.pieces[ev.lastToppled];
         clack.current.n += ev.toppled;
         const at = { x: p.x + p.dx * 1.6, y: 0.2, z: p.z + p.dz * 1.6 };
         juice.burst("dust", at, 6, { color: "#f5e6c8", vy: 1.4, size: 0.5 });
         playSfx("pop", { volume: 0.32, pitch: Math.min(2.2, 0.8 + clack.current.n * 0.03) });
         if (clack.current.n === 50) {
            juice.popup(at, "50 chain!", { color: COLORS.wave, size: 0.08 });
            playSfx("chime", { pitch: 1.6 });
         }
      }
      if (ev.airJumped) {
         anim.airJumpAt = now;
         juice.burst("dust", feet, 12, { color: "#ffffff" });
         playSfx("jump", { volume: 0.6, pitch: 1.25 });
      } else if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.55 });
      }
      if (ev.landed) {
         anim.landAt = now;
         const hard = ev.landSpeed > 9;
         juice.burst("dust", feet, hard ? 18 : 6, { color: "#e7d8c3", vy: hard ? 3 : 1.4 });
         if (hard) juice.kick(0, -1, 0, 1.2);
      }
      if (ev.launched) {
         anim.jumpAt = now;
         juice.burst("pickup", feet, 30, { color: COLORS.wave, vy: 6 });
         juice.popup(chest, "Boing!", { color: "#fca5a5", size: 0.09 });
         juice.kick(0, 1, 0, 3);
         juice.shake(0.2);
         playSfx("jump", { volume: 0.8, pitch: 0.6 });
      }
      if (ev.bounced) {
         anim.hurtAt = now;
         anim.hurtX = h.vx;
         anim.hurtZ = h.vz;
         juice.burst("hit", chest, 10, { color: "#fde68a" });
         playSfx("thud", { volume: 0.4, pitch: 1.5 });
      }
      if (ev.spare >= 0) {
         const sp = run.spares[ev.spare];
         juice.burst("checkpoint", { x: sp.x, y: 0.8, z: sp.z }, 20, { color: COLORS.wave });
         juice.popup({ x: sp.x, y: 1.6, z: sp.z }, "Fixed!", { color: COLORS.wave, size: 0.06 });
         playSfx("chime", { pitch: 1.2 });
      }
      if (ev.drum >= 0) {
         const d = run.course.drums[ev.drum];
         juice.burst("hit", { x: d.x, y: 0.9, z: d.z }, 18, { color: "#fca5a5" });
         playSfx("thud", { volume: 0.7, pitch: 0.55 });
      }
      if (ev.carStarted >= 0) playSfx("whoosh", { volume: 0.5, pitch: 1.5 });
      if (ev.powered) {
         juice.burst("pickup", chest, 18, { color: accent });
         juice.burst("aura", chest, 12, { color: accent });
         playSfx("whoosh", { volume: 0.5, pitch: 1.1 });
      }
      if (ev.wallBroken >= 0) {
         juice.burst("hit", chest, 30, { color: "#7dd3fc" });
         juice.popup(chest, "Smash!", { color: "#7dd3fc", size: 0.08 });
         juice.shake(0.28);
         juice.hitStop(60);
         playSfx("thud");
      }
      if (ev.knocked || ev.fell) {
         anim.hurtAt = now;
         anim.hurtX = h.vx;
         anim.hurtZ = h.vz;
         juice.burst("hit", chest, 14, { color: "#94a3b8" });
         juice.shake(ev.fell ? 0.25 : 0.18);
         playSfx(ev.fell ? "lose" : "thud", { volume: 0.5, pitch: 0.8 });
      }
      if (ev.respawned) {
         juice.burst("pickup", chest, 20, { color: accent });
         playSfx("pop");
      }
      if (ev.shielded) juice.burst("aura", chest, 10, { color: accent });
      if (ev.checkpoint >= 0) {
         juice.burst("checkpoint", chest, 36, { color: "#7dd3fc" });
         juice.popup(chest, "Checkpoint", { color: "#bae6fd", size: 0.06 });
         playSfx("chime");
      }
      if (ev.gap) {
         juice.popup({ x: chest.x, y: chest.y + 0.6, z: chest.z }, ev.surf ? "Surf!" : "Across!", { color: ev.surf ? COLORS.wave : "#fde68a", size: ev.surf ? 0.09 : 0.06 });
         if (ev.surf) juice.hitStop(40);
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = run.course.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 12, { color: "#fde68a" });
         juice.popup(o, `-${(ORB_BONUS_MS / 1000).toFixed(2)} s`, { color: "#fde68a" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.03) });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spot = run.course.secrets[ev.secretList[k]];
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", spot, 30, { color: spec.kind === "shard" ? COLORS.shard : COLORS.sticker });
         juice.popup(spot, `${spec.name}!`, { color: spec.kind === "shard" ? COLORS.shard : COLORS.sticker, size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.5 });
      }
      if (ev.comboLinked && run.combo.chain > 1) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.4 });
      if (ev.bossTelegraph) playSfx("whoosh", { volume: 0.4, pitch: 0.7 });
      if (ev.bossAttack) {
         juice.shake(0.15);
         playSfx("jump", { volume: 0.6, pitch: 0.5 });
      }
      if (ev.bossHit) {
         const j = run.jack;
         const at = { x: j.x, y: Math.max(1.5, j.y + 1), z: j.z };
         juice.burst("hit", at, 30, { color: "#fef08a" });
         juice.popup(at, ev.slam ? "BONK!" : "Hit!", { color: "#fef08a", size: 0.09 });
         juice.shake(0.32);
         juice.hitStop(90);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossDefeated) {
         const j = run.jack;
         juice.burst("checkpoint", { x: j.x, y: 2, z: j.z }, 110, { color: "#fde047" });
         juice.popup({ x: j.x, y: 3.5, z: j.z }, "Lid shut!", { color: "#fde047", size: 0.09 });
         juice.shake(0.45);
      }
      publishRun(run);
      if (ev.finished && !won.current) {
         won.current = true;
         anim.winAt = now;
         juice.burst("checkpoint", chest, 90, { color: COLORS.wave });
         playSfx("chime", { pitch: 0.8 });
         store.setStat(STAT.finishMs, run.finishMs);
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.comboMs, run.combo.bonusTotal);
         const end = levelEndStats(run, userRef.current);
         for (const key of Object.keys(end) as Array<keyof typeof end>) store.setStat(STAT[key], end[key]);
         store.end("win");
      } else if (ev.timeup && !won.current) {
         won.current = true;
         levelEndStats(run, userRef.current);
         store.end("timeup");
      }
   };

   useRunFrame((_state, dt) => {
      const i = input.current;
      stepInput.moveX = i.moveX;
      stepInput.moveZ = i.moveY;
      stepInput.yaw = orbit.viewYaw;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.jumpHeld = i.jump;
      stepInput.actionPressed = i.actionPressed;
      if (bot) {
         bot.frameMs = lastFrame.current;
         botInput(bot, run, stepInput);
      }
      lastFrame.current = dt * 1000;
      react(step(run, dt * 1000, stepInput));
   });

   useFrame(() => {
      const s = useArcadeStore.getState();
      if (s.phase === "countdown") clock.ms = -s.countdownMs;
      else if (s.phase === "ready") clock.ms = time.now * 1000;
      else if (s.phase === "over") clock.ms = run.simMs + s.overMs;
      else clock.ms = run.simMs;
   }, FRAME_PRIORITY.camera);
   return null;
}

function CityCamera({ run, orbit }: { run: ToyRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         orbitPivot(run, out);
         return true;
      },
      [run],
   );
   const travel = useMemo(
      () => (out: { x: number; z: number }) => {
         // in Jack's fight the boss framing turns the camera, not the run direction
         const fight = run.boss !== null && run.boss.hp > 0;
         out.x = fight ? 0 : run.hero.vx;
         out.z = fight ? 0 : run.hero.vz;
      },
      [run],
   );
   // level 5: keep Jack in shot (before the orbit driver eases the view this frame)
   useFrame((_, dt) => {
      if (arcadeStore.getState().phase === "playing") steerBossFraming(orbit, run, dt, aspect);
   }, ORBIT_DRIVER_PRIORITY - 0.002);
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run, camera.position.x, camera.position.z, out), [run, camera]);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} solids={solids} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={ROOM_COLLISION} />;
}

/** A gold chevron on the desk round the hero, pointing at the next thing to do. */
function Guide({ run }: { run: ToyRun }) {
   const ref = useRef<Group>(null);
   const g = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   useFrame(() => {
      const h = run.hero;
      guidePoint(run, g);
      const dx = g.x - h.x;
      const dz = g.z - h.z;
      const d = Math.hypot(dx, dz);
      const grp = ref.current;
      if (grp) {
         grp.visible = d > 3 && run.ended === null && h.grounded;
         grp.position.set(h.x + (dx / Math.max(d, 1e-6)) * 1.4, h.y + 0.08, h.z + (dz / Math.max(d, 1e-6)) * 1.4);
         grp.rotation.y = Math.atan2(dx, dz);
      }
   }, FRAME_PRIORITY.visuals);
   return (
      <group ref={ref}>
         <mesh rotation-x={-Math.PI / 2}>
            <coneGeometry args={[0.36, 0.85, 3]} />
            <meshBasicMaterial color={COLORS.wave} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
         </mesh>
      </group>
   );
}

/** The boss's slow-mo finish: visual only (the hit-stop is its punch; the rules clock never slows). */
function BossSlowMo({ run }: { run: ToyRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, JACK.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: ToyRun; anim: HeroAnim }) {
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
      juice.burst("dust", { x: h.x, y: h.y + 0.2, z: h.z }, 26, { color: "#ffffff", vy: 3 });
      juice.burst("pickup", { x: h.x, y: h.y + 0.7, z: h.z }, 16, { color: heroAccent(run.heroId) });
      juice.kick(0, -1, 0, 4);
      juice.shake(0.25);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<ToySpec>();
   const levelId: LevelId = config?.id ?? 1;
   // the picker changes the hero live on the start card; after that a run keeps its hero
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const clock = useMemo<VisualClock>(() => ({ ms: 0 }), [run]);
   const orbit = useMemo(() => createOrbit(roomOrbit(run.course)), [run]);
   const won = useRef(false);
   return (
      <JuiceLayer>
         <World course={run.course} />
         {/* keyed by level: the pools are sized once per mount */}
         <Course key={levelId} run={run} clock={clock} />
         {run.course.boss ? <Boss run={run} clock={clock} /> : null}
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} clock={clock} won={won} orbit={orbit} />
         <CityCamera run={run} orbit={orbit} />
         <Guide run={run} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
