"use client";

// Gem Collector 3D's scene: the run (rules.ts) stepped in useRunFrame, the Ornament Vault (Vault), the
// gems and the trains (Gems + Tethers), the slimes and the Gumdrop Glutton (Creatures), the hero, the
// free orbit camera (menu2/camera: movement is camera-relative through StepInput.yaw), the intro
// (core/intro, index.tsx `intro: true`), a ground arrow toward the next thing to do, and the juice
// (menu2/juice): a pickup chime that climbs with the train, the bank's fountain of sparks and its
// "+400" popup, the cut's shatter, the lasso's flash, the chest's burst, the frost breath, the
// Glutton's hits and his slow-mo finish (visual only). Remounted per run (runId). Local multiplayer
// renders MultiScene.tsx.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group, PerspectiveCamera } from "three";
import { arcadeStore, useArcadeStore } from "@/arcade3d/core/useArcadeStore";
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
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { ORBIT_DRIVER_PRIORITY, OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { Vault, type VisualClock } from "./Vault";
import { Gems, Tethers } from "./Gems";
import { Glutton, Slimes } from "./Creatures";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, VAULT_COLLISION, arenaSolids, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera, steerBossFraming, vaultOrbit } from "./camera";
import { STAT, createRun, createStepInput, guidePoint, levelCleared, step, trainWeight, type GemRun, type StepEvents } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { ArenaSpec } from "./levels";
import { COMBO, GLUTTON, SECRETS } from "./progression";
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

/** The HUD's numbers that change during a run (written only when they change). */
export function publishRun(run: GemRun): void {
   const store = useArcadeStore.getState();
   const h = run.hero;
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   if (store.score !== run.score) store.setScore(run.score);
   set(STAT.links, run.n);
   set(STAT.weight, trainWeight(run));
   set(STAT.banks, run.banks);
   set(STAT.bestBank, run.bestBank);
   set(STAT.orbs, run.orbs);
   set(STAT.cuts, run.cuts);
   set(STAT.hero, HERO_INDEX[run.heroId]);
   set(STAT.power, Math.max(0, Math.ceil((h.powerReadyAt - run.simMs) / 1000)));
   set(STAT.dashes, h.dashes);
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10));
   const b = run.boss;
   if (b) {
      set(STAT.bossHp, b.hp);
      set(STAT.bossPhase, b.phase);
      set(STAT.bossOpen, b.step === "vulnerable" ? 1 : 0);
      set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
      set(STAT.bossOn, b.step === "intro" ? 0 : 1);
      set(STAT.bossStun, run.glutton.stunUntil >= run.simMs ? 1 : 0);
   }
}

function Simulation({ run, anim, won, orbit }: { run: GemRun; anim: HeroAnim; won: { current: boolean }; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;
   const accent = heroAccent(run.heroId);

   const react = (ev: StepEvents) => {
      const store = useArcadeStore.getState();
      const h = run.hero;
      const a = run.arena;
      const now = time.now;
      chest.x = feet.x = h.x;
      chest.z = feet.z = h.z;
      chest.y = h.y + 1.1;
      feet.y = h.y + 0.1;
      if (ev.picked >= 0) {
         const g = a.gems[ev.picked];
         juice.burst("pickup", { x: run.gx[ev.picked], y: 0.5, z: run.gz[ev.picked] }, 8, { color: g.kind === "gold" ? COLORS.gold : g.kind === "frost" ? "#7dd3fc" : "#f0f9ff" });
         playSfx("pickup", { volume: 0.45, pitch: 0.8 + Math.min(1.2, run.n * 0.05) });
      }
      if (ev.bankPoints > 0) {
         const big = ev.bankPoints >= 300;
         const at = ev.banked >= 0 ? { x: a.beacons[ev.banked].x, y: 2.2, z: a.beacons[ev.banked].z } : chest;
         juice.burst("checkpoint", at, big ? 70 : 24, { color: COLORS.beacon, vy: 5 });
         juice.popup(at, `+${ev.bankPoints}`, { color: big ? COLORS.gold : "#fde68a", size: big ? 0.11 : 0.07 });
         if (big) {
            juice.shake(0.2);
            juice.hitStop(70);
         }
         playSfx("chime", { pitch: big ? 0.8 : 1.3 });
      }
      if (ev.cut >= 0 && ev.cutLinks > 0) {
         juice.burst("hit", chest, 10 + ev.cutLinks * 2, { color: COLORS.cut });
         juice.popup(chest, ev.cutLinks > 3 ? `Snap! -${ev.cutLinks}` : "Snap!", { color: COLORS.cut, size: 0.06 });
         playSfx("thud", { volume: 0.4, pitch: 1.4 });
      }
      if (ev.lassoed >= 0) {
         juice.burst("aura", chest, 30, { color: COLORS.lasso });
         juice.popup(chest, ev.lassoKind === "slime" ? "Frozen to gold!" : "Lassoed!", { color: COLORS.lasso, size: 0.08 });
         juice.hitStop(60);
         playSfx("chime", { pitch: 1.6 });
      }
      if (ev.chest >= 0) {
         const c = a.spec.chests[ev.chest];
         juice.burst("pickup", { x: c.x, y: 1, z: c.z }, 34, { color: COLORS.gold, vy: 5 });
         juice.popup({ x: c.x, y: 1.8, z: c.z }, "6 gems!", { color: COLORS.gold, size: 0.07 });
         juice.shake(0.12);
         playSfx("pop", { pitch: 0.8 });
      }
      if (ev.airJumped) {
         anim.airJumpAt = now;
         juice.burst("dust", feet, 12, { color: "#ffffff" });
         playSfx("jump", { volume: 0.6, pitch: 1.25 });
      } else if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.55 });
      }
      if (ev.landed) anim.landAt = now;
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
      if (ev.orb >= 0) {
         const o = a.orbs[ev.orb];
         juice.burst("pickup", o, 16, { color: "#f9a8d4" });
         juice.popup(o, "+25", { color: "#f9a8d4" });
         playSfx("pickup", { pitch: 1.5 });
      }
      if (ev.secret) {
         const idx = SECRETS[run.level].findIndex((s) => s.id === ev.secret);
         const spot = a.secrets[Math.max(0, idx)];
         const spec = SECRETS[run.level][Math.max(0, idx)];
         juice.burst("checkpoint", spot, 30, { color: spec.kind === "shard" ? COLORS.shard : COLORS.sticker });
         juice.popup(spot, `${spec.name}!`, { color: spec.kind === "shard" ? COLORS.shard : COLORS.sticker, size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.5 });
      }
      if (ev.reachedTarget) {
         juice.popup({ x: chest.x, y: chest.y + 0.8, z: chest.z }, "Target!", { color: COLORS.gold, size: 0.1 });
         playSfx("chime", { pitch: 0.9 });
      }
      if (ev.bossAttack) {
         juice.shake(0.15);
         playSfx("jump", { volume: 0.6, pitch: 0.5 });
      }
      if (ev.bossHit) {
         const g = run.glutton;
         const at = { x: g.x, y: 2.4, z: g.z };
         juice.burst("hit", at, 30, { color: "#fecdd3" });
         juice.popup(at, ev.yawn ? "GULP!" : "Hit!", { color: "#fb7185", size: 0.09 });
         juice.shake(0.32);
         juice.hitStop(90);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossDefeat) {
         const g = run.glutton;
         juice.burst("checkpoint", { x: g.x, y: 2, z: g.z }, 110, { color: COLORS.gold });
         juice.popup({ x: g.x, y: 3.5, z: g.z }, "A fountain of gold!", { color: COLORS.gold, size: 0.09 });
         juice.shake(0.45);
      }
      publishRun(run);
      if (ev.ended && !won.current) {
         won.current = true;
         const cleared = levelCleared(run);
         if (cleared) {
            anim.winAt = now;
            juice.burst("checkpoint", chest, 90, { color: COLORS.gold });
            playSfx("chime", { pitch: 0.8 });
         }
         const end = levelEndStats(run, userRef.current);
         for (const key of Object.keys(end) as Array<keyof typeof end>) store.setStat(STAT[key], end[key]);
         store.end(cleared ? "win" : "timeup");
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
   return null;
}

/** The visual clock: the rules' ms while playing, the countdown below 0, the result delay after. */
function Clock({ run, clock }: { run: GemRun; clock: VisualClock }) {
   const time = useGameTime();
   useFrame(() => {
      const s = useArcadeStore.getState();
      if (s.phase === "countdown") clock.ms = -s.countdownMs;
      else if (s.phase === "ready") clock.ms = time.now * 1000;
      else if (s.phase === "over") clock.ms = run.simMs + s.overMs;
      else clock.ms = run.simMs;
   }, FRAME_PRIORITY.camera);
   return null;
}

function VaultCamera({ run, orbit }: { run: GemRun; orbit: OrbitState }) {
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
         const fight = run.boss !== null && run.boss.hp > 0;
         out.x = fight ? 0 : run.hero.vx;
         out.z = fight ? 0 : run.hero.vz;
      },
      [run],
   );
   useFrame((_, dt) => {
      if (arcadeStore.getState().phase === "playing") steerBossFraming(orbit, run, dt);
   }, ORBIT_DRIVER_PRIORITY - 0.002);
   const solids = useMemo(() => (out: AABB[]) => arenaSolids(run, camera.position.x, camera.position.z, out), [run, camera]);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} solids={solids} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={VAULT_COLLISION} />;
}

/** A gold chevron on the floor round the hero, pointing at the next thing to do. */
function Guide({ run }: { run: GemRun }) {
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
         grp.position.set(h.x + (dx / Math.max(d, 1e-6)) * 1.4, h.y + 0.06, h.z + (dz / Math.max(d, 1e-6)) * 1.4);
         grp.rotation.y = Math.atan2(dx, dz);
      }
   }, FRAME_PRIORITY.visuals);
   return (
      <group ref={ref}>
         <mesh rotation-x={-Math.PI / 2}>
            <coneGeometry args={[0.32, 0.8, 3]} />
            <meshBasicMaterial color={COLORS.wave} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
         </mesh>
      </group>
   );
}

/** The boss's slow-mo finish: visual only (the hit-stop is its punch; the rules clock never slows). */
function BossSlowMo({ run }: { run: GemRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.step !== "defeat") return;
      fired.current = true;
      juice.hitStop(Math.min(140, GLUTTON.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: GemRun; anim: HeroAnim }) {
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
   const { config } = useLevel<ArenaSpec>();
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
   const orbit = useMemo(() => createOrbit(vaultOrbit(run.arena)), [run]);
   const runs = useMemo(() => [run], [run]);
   const won = useRef(false);
   return (
      <JuiceLayer>
         <Vault run={run} clock={clock} />
         {/* keyed by level: the gem pool is sized once per mount */}
         <Gems key={levelId} runs={runs} clock={clock} />
         <Tethers runs={runs} />
         <Slimes run={run} clock={clock} />
         <Glutton run={run} clock={clock} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} won={won} orbit={orbit} />
         <Clock run={run} clock={clock} />
         <VaultCamera run={run} orbit={orbit} />
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
