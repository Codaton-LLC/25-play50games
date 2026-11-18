"use client";

// Jungle Vine Jump's scene: the run (rules.ts) stepped in useRunFrame, the giant tree (World), the climb
// (Course), the Howler King, the hero (menu2/heroAnim), the free orbit camera (menu2/camera: the stick
// is camera-relative through StepInput.yaw = orbit.viewYaw; left alone it eases round to a side view of
// the swing), the intro (core/intro) and the juice (menu2/juice): a whoosh at the bottom of every swing
// that rises in pitch with the speed, a leaf burst on each release and catch, a chime that climbs with
// the catch combo and a green streak from x1.5, birds scattering on a perfect release, a camera roll of
// up to 4 degrees with the swing, a crack when a dry vine snaps, the monkeys' pods and the King's hits.
// Remounted for every run (runId). Local multiplayer runs render MultiScene.tsx instead.
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
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit } from "@/arcade3d/menu2/camera/orbit";
import { OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import World from "./World";
import { Course } from "./CourseView";
import Howler from "./Howler";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, courseSolids, heroPivot, introKeyframes, inwardTravel, orbitLookUp, orbitScale, outsideYaw, playCamera, vineOrbit } from "./camera";
import { MAX_AMP, STAT, bossVulnerable, createRun, createStepInput, flowOf, heroSpeed, kingPos, step, type StepEvents, type VineRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { VineLevel } from "./levels";
import { HOWLER, SECRETS } from "./progression";
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

const HERO_IDS = ["riko", "nami", "kiro", "zuno", "vexa"] as const;
const KP = { x: 0, y: 0, z: 0 };

export function publishBoss(run: VineRun): void {
   const b = run.boss;
   if (!b) return;
   const store = useArcadeStore.getState();
   const open = bossVulnerable(run) ? 1 : 0;
   const flash = b.flashMs > 0 ? 1 : 0;
   if (store.stats[STAT.bossHp] !== b.hp) store.setStat(STAT.bossHp, b.hp);
   if (store.stats[STAT.bossPhase] !== b.phase) store.setStat(STAT.bossPhase, b.phase);
   if (store.stats[STAT.bossOpen] !== open) store.setStat(STAT.bossOpen, open);
   if (store.stats[STAT.bossFlash] !== flash) store.setStat(STAT.bossFlash, flash);
}

/** The juice and sounds of one step's events (solo and, quieter, multiplayer). */
export function useVineJuice() {
   const juice = useJuice();
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const hands = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const memo = useMemo(() => ({ lastTheta: 0 }), []);
   return (run: VineRun, ev: StepEvents, anim: HeroAnim, now: number, loud = 1) => {
      const h = run.hero;
      const c = run.course;
      chest.x = feet.x = hands.x = h.x;
      chest.z = feet.z = hands.z = h.z;
      chest.y = h.y + 0.9;
      feet.y = h.y + 0.05;
      hands.y = h.y + 1.4;
      // the swing's whoosh: once each pass through the bottom, higher and louder the faster it goes
      if (h.vine >= 0) {
         if (Math.sign(h.theta) !== Math.sign(memo.lastTheta) && memo.lastTheta !== 0) {
            const v = heroSpeed(run);
            if (v > 4) playSfx("whoosh", { pitch: 0.6 + Math.min(1, v / 14) * 0.8, volume: Math.min(0.7, 0.2 + v / 25) * loud });
         }
         memo.lastTheta = h.theta;
      } else memo.lastTheta = 0;
      if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.45 * loud });
      }
      if (ev.airJumped) {
         anim.airJumpAt = now;
         juice.burst("dust", feet, 10, { color: "#bfdbfe" });
         playSfx("jump", { pitch: 1.25, volume: 0.6 * loud });
      }
      if (ev.landed >= 0) {
         anim.landAt = now;
         juice.burst("dust", feet, 8, { color: "#9fc28a" });
         juice.kick(0, -1, 0, 1.2 * loud);
         playSfx("thud", { volume: 0.4 * loud });
      }
      if (ev.caught >= 0) {
         juice.burst("pickup", hands, 12, { color: c.vines[ev.caught].kind === "dry" ? COLORS.dry : COLORS.leaf });
         juice.kick(0, -1, 0, 1.6 * loud);
         // the chime climbs with the catch combo
         playSfx("chime", { pitch: 0.85 + Math.min(0.9, run.combo.chain * 0.12), volume: 0.5 * loud });
         // the green streak at a combo of x1.5 and more (three links)
         if (run.combo.chain >= 3) juice.burst("aura", chest, 18, { color: COLORS.orb });
      }
      if (ev.comboLinked) juice.popup(chest, `Catch x${run.combo.multiplier.toFixed(2)}`, { color: "#bbf7d0", size: 0.05 });
      if (ev.released) {
         juice.burst("pickup", hands, 10, { color: COLORS.leaf });
         playSfx("whoosh", { pitch: 1.1, volume: 0.45 * loud });
      }
      if (ev.perfect) {
         // canopy birds scatter on a perfect release
         juice.burst("checkpoint", hands, 16, { color: "#f8fafc" });
         juice.popup(chest, "Perfect release!", { color: "#fef08a", size: 0.06 });
         playSfx("chime", { pitch: 1.6, volume: 0.45 * loud });
      }
      if (ev.snapped >= 0) {
         juice.burst("dust", hands, 18, { color: COLORS.dry });
         juice.popup(hands, "Snap!", { color: "#fcd34d", size: 0.06 });
         juice.shake(0.15 * loud);
         playSfx("thud", { pitch: 1.6, volume: 0.6 * loud });
      }
      if (ev.powered) {
         juice.burst("aura", chest, 16, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.55 * loud, pitch: 1.1 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = c.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 14, { color: COLORS.orb });
         juice.popup(o, "-0.1 s", { color: "#bbf7d0" });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.08), volume: loud });
      }
      if (ev.emeraldCount > 0) {
         juice.burst("pickup", chest, 10, { color: COLORS.emerald });
         playSfx("pickup", { pitch: 1.4, volume: 0.45 * loud });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 30, { color: spec.kind === "shard" ? "#c4b5fd" : "#f9a8d4" });
         juice.popup(chest, `${spec.name}!`, { color: "#f9a8d4", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (ev.thrown > 0) playSfx("whoosh", { pitch: 1.5, volume: 0.3 * loud });
      if (ev.blocked) {
         juice.burst("hit", chest, 12, { color: heroAccent(run.heroId) });
         juice.popup(chest, "Blocked!", { color: "#bbf7d0", size: 0.05 });
         playSfx("pop", { volume: 0.5 * loud });
      }
      if (ev.hurt !== "") {
         anim.hurtAt = now;
         juice.burst("hit", chest, 18, { color: ev.hurt === "pod" ? COLORS.pod : undefined });
         juice.shake(0.22 * loud);
         juice.hitStop(70);
         playSfx("hit", { volume: 0.5 * loud });
         if (ev.knocked) juice.popup(chest, ev.hurt === "pod" ? "Knocked off!" : ev.hurt === "bite" ? "Bitten!" : "Knocked off!", { color: "#fca5a5", size: 0.05 });
      }
      if (ev.respawned) {
         anim.spawnAt = now;
         juice.burst("pickup", chest, 20, { color: heroAccent(run.heroId) });
         juice.popup(chest, "Back on the branch", { color: "#fca5a5", size: 0.05 });
         playSfx("pop");
      }
      if (ev.bossTelegraph) playSfx("buzz", { pitch: 0.6, volume: 0.45 * loud });
      if (ev.bossAttack) {
         kingPos(run, KP);
         const ph = run.boss?.phase ?? 0;
         juice.popup(KP, ph === 0 ? "Fruit volley!" : ph === 1 ? "ROAR! The vine drops!" : "He swings at you!", { color: "#fecaca", size: 0.08 });
         juice.shake(0.3 * loud);
         playSfx("thud", { pitch: 0.5, volume: 0.7 * loud });
      }
      if (ev.bossHit) {
         kingPos(run, KP);
         juice.burst("hit", KP, 34, { color: "#fef08a" });
         juice.popup(KP, ev.bossDefeated ? "The King falls!" : "Hit!", { color: "#fde68a", size: 0.08 });
         juice.shake(0.32);
         juice.hitStop(90);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossPhase && !ev.bossDefeated && run.boss) juice.popup(chest, HOWLER.phases[run.boss.phase]?.name ?? "", { color: "#fde68a", size: 0.07 });
      if (ev.bossDefeated) {
         kingPos(run, KP);
         juice.burst("checkpoint", KP, 120, { color: "#ffd36a" });
         juice.burst("checkpoint", KP, 80, { color: COLORS.orb });
         juice.shake(0.5);
         juice.hitStop(140);
      }
   };
}

function Simulation({ run, anim, orbit }: { run: VineRun; anim: HeroAnim; orbit: ReturnType<typeof createOrbit> }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const effects = useVineJuice();
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
      const h = run.hero;
      const now = time.now;
      effects(run, ev, anim, now);
      const set = (key: string, value: number) => {
         if (store.stats[key] !== value) store.setStat(key, value);
      };
      set(STAT.hanging, h.vine >= 0 ? 1 : 0);
      set(STAT.grip, Math.round(h.grip * 10));
      set(STAT.swing, h.vine >= 0 ? Math.round((Math.abs(h.theta) * 180) / Math.PI) : 0);
      set(STAT.height, Math.max(0, Math.round(h.y)));
      set(STAT.top, Math.round(run.course.top));
      set(STAT.orbs, run.orbs);
      set(STAT.hits, run.hits);
      set(STAT.comboMs, run.combo.bonusTotal);
      set(STAT.comboChain, run.combo.chain);
      set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
      set(STAT.comboFlow, Math.ceil(flowOf(run) * 10));
      set(STAT.hero, HERO_IDS.indexOf(run.heroId));
      set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
      publishBoss(run);
      if (ev.finished) {
         anim.winAt = now;
         if (!ev.bossDefeated) {
            juice.burst("checkpoint", h, 110);
            juice.burst("pickup", h, 40, { color: COLORS.orb });
            juice.popup(h, "Top of the tree!", { color: "#bbf7d0", size: 0.09 });
         }
         juice.shake(0.2);
         playSfx("chime", { pitch: 0.75 });
         set(STAT.finishMs, run.finishMs);
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

const COLLISION = { radius: 0.35, minDistance: 4.5 };
const ROLL = (4 * Math.PI) / 180;

/** The orbit camera round the hero (a side view of the swing when left alone), with the swing's roll. */
function VineCamera({ run, orbit }: { run: VineRun; orbit: ReturnType<typeof createOrbit> }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         heroPivot(run.hero, out);
         return true;
      },
      [run],
   );
   // the auto-follow is fed the inward direction: the orbit eases round outside the ring, looking in
   const travel = useMemo(() => (out: { x: number; z: number }) => inwardTravel(run.hero.x, run.hero.z, out), [run]);
   const behind = useMemo(() => () => outsideYaw(run.hero.x, run.hero.z), [run]);
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run, camera.position.x, camera.position.y, camera.position.z, out), [run, camera]);
   // a roll of up to 4 degrees with the swing, after the orbit placed the camera
   const roll = useRef(0);
   const time = useGameTime();
   useFrame(() => {
      const h = run.hero;
      const want = h.vine >= 0 ? ROLL * Math.max(-1, Math.min(1, h.theta / MAX_AMP)) : 0;
      roll.current += (want - roll.current) * Math.min(1, time.delta * 5);
      if (Math.abs(roll.current) > 1e-4) camera.rotateZ(roll.current);
   }, FRAME_PRIORITY.camera + 0.05);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} behind={behind} solids={solids} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={COLLISION} />;
}

/** The King's slow-mo finish: the visuals only (menu2/boss through the juice clock). */
function BossSlowMo({ run }: { run: VineRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, HOWLER.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: VineRun; anim: HeroAnim }) {
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
      juice.burst("dust", h, 18, { color: "#9fc28a" });
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
   const { config } = useLevel<VineLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(vineOrbit(run.course)), [run]);
   return (
      <JuiceLayer>
         <World run={run} />
         <Course key={levelId} run={run} />
         <Howler run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} />
         <VineCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
