"use client";

// Temple Coin Rush's scene: the run (rules.ts) stepped in useRunFrame, the temple (World.tsx), the gates
// and props (Course.tsx), the hero (Hero.tsx, menu2/heroAnim), the free orbit camera (menu2/camera:
// two fingers / mouse drag / wheel / pinch; lane presses are camera-relative through StepInput.yaw;
// one finger stays a swipe), the intro (core/intro) and the juice (menu2/juice): every coin pings with a
// pitch that climbs through the combo (consecutive coins within 0.4 s); a paid gate sends the coins
// arcing into its offering bowl with a cash-register chime, then grinds open with a camera shake; a
// shut gate thuds; a perfect lane bursts green on the walls and pushes the boulder back; the boulder's
// rumble grows (and the HUD's screen edges darken) as it closes in; a catch flattens the hero. Level 5:
// Coilstone's hiss, lunges, coils, the bells dropping on its head, the plates shattering in slow-mo.
// Remounted for every run (runId). Local multiplayer runs (2-4 heroes) render MultiScene.tsx.
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
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import World, { type RestoreRef } from "./World";
import { Course } from "./Course";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { TEMPLE_ORBIT, FOV, FOV_PORTRAIT, portraitAmount, courseSolids, introKeyframes, orbitLookUp, orbitPivot, orbitScale, orbitTravel, playCamera } from "./camera";
import { LANES, TIER, laneX } from "./temples";
import { GATE, STAT, bossVulnerable, chaserZ, createRun, createStepInput, distanceOf, gateInView, priceOf, scoreOf, step, type StepEvents, type TempleRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { TempleLevel } from "./levels";
import { COILSTONE, COMBO, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import { restoreAmount } from "./look";
import MultiScene from "./MultiScene";

/** Preview builds only: `?autoplay=1` lets the honest bot (bot.ts) run, for screenshots and checks. */
function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

const HERO_STAT = { riko: 0, nami: 1, kiro: 2, zuno: 3, vexa: 4 } as const;

/** The two toll prices of the gate in view: the cheapest and the dearest toll lane (-1: none). */
function gatePrices(run: TempleRun, g: number): [number, number] {
   if (g < 0) return [-1, -1];
   const gate = run.course.gates[g];
   let lo = -1;
   let hi = -1;
   for (let l = 0; l < LANES; l++) {
      if (gate.lanes[l].tier === TIER.slow) continue;
      const p = priceOf(run, g, l);
      if (lo < 0 || p < lo) lo = p;
      if (p > hi) hi = p;
   }
   return [lo, hi === lo ? -1 : hi];
}

/** Publishes the HUD's numbers that change every frame (only when they change), and the score. */
export function publishRun(run: TempleRun): void {
   const store = useArcadeStore.getState();
   const h = run.hero;
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   set(STAT.coins, run.purse.coins);
   set(STAT.orbs, run.orbs);
   set(STAT.distance, Math.round(distanceOf(run)));
   set(STAT.speed, Math.round(h.v * 10));
   set(STAT.hero, HERO_STAT[run.heroId]);
   set(STAT.power, Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000)));
   set(STAT.lives, run.lives);
   set(STAT.gap, Math.round(run.gap * 10));
   const g = gateInView(run);
   const [lo, hi] = gatePrices(run, g);
   set(STAT.gateNext, g);
   set(STAT.gateCheap, lo);
   set(STAT.gateDear, hi);
   set(STAT.gateDist, g >= 0 ? Math.max(0, Math.round(h.z - run.course.gates[g].z)) : -1);
   set(STAT.tolls, run.tolls);
   set(STAT.spent, run.spent);
   set(STAT.perfects, run.perfects);
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
      set(STAT.bells, run.pendingHits);
   }
   const score = scoreOf(run);
   if (store.score !== score) store.setScore(score);
}

const P = { x: 0, y: 0, z: 0 };

/** The juice and sounds of one step's events (shared with MultiScene; `tag` prefixes popups there). */
export function juiceEvents(run: TempleRun, ev: StepEvents, anim: HeroAnim, juice: ReturnType<typeof useJuice>, now: number, tag = ""): void {
   const h = run.hero;
   const c = run.course;
   const chest = { x: h.x, y: h.y + 1.1, z: h.z };
   const feet = { x: h.x, y: h.y + 0.2, z: h.z };
   if (ev.airJumped) {
      anim.airJumpAt = now;
      juice.burst("dust", feet, 12, { color: "#fde68a" });
      playSfx("jump", { volume: 0.6, pitch: 1.25 });
   } else if (ev.jumped) {
      anim.jumpAt = now;
      juice.burst("dust", feet, 10, { color: "#d6c4a0" });
      playSfx("jump", { volume: 0.5 });
   }
   if (ev.landed) {
      anim.landAt = now;
      juice.burst("dust", feet, 8, { color: "#d6c4a0" });
   }
   if (ev.rolled) playSfx("whoosh", { volume: 0.4, pitch: 0.8 });
   if (ev.laneChanged) playSfx("whoosh", { volume: 0.22, pitch: 1.5 });
   for (let k = 0; k < Math.min(ev.coinCount, ev.coinList.length); k++) {
      const id = ev.coinList[k];
      const o = id >= 0 ? c.coins[id] : { x: h.x, y: 0.8, z: h.z, value: 1 };
      juice.burst("pickup", o, o.value > 1 ? 16 : 8, { color: "#fcd34d" });
      if (o.value > 1) juice.popup(o, `${tag}+${o.value}`, { color: "#fde68a", size: 0.05 });
      playSfx("pickup", { volume: 0.45, pitch: 1.1 + Math.min(0.8, run.combo.chain * 0.04) });
   }
   if (ev.gate >= 0) {
      const g = c.gates[ev.gate];
      const r = ev.gateResult;
      const at = { x: laneX(h.lane), y: 1.6, z: g.z };
      if (r === GATE.paid) {
         // the coins arc into the gate's offering bowl, a register chime, the gate grinds open
         P.x = laneX(h.lane) + (h.lane === 0 ? -0.95 : 0.95);
         P.y = 1.0;
         P.z = g.z + 1;
         juice.burst("pickup", P, 10 + Math.min(30, ev.paid * 2), { color: "#fcd34d", vy: 4 });
         juice.burst("dust", at, 18, { color: "#c8b48c", vy: 1 });
         juice.popup(chest, `${tag}-${ev.paid}`, { color: "#fde68a", size: 0.08 });
         juice.shake(0.25);
         playSfx("chime", { pitch: 1.6, volume: 0.6 });
         playSfx("thud", { pitch: 0.6, volume: 0.45 });
         if (g.lanes[h.lane].tier === TIER.jackpot) juice.popup({ ...chest, y: chest.y + 0.5 }, `${tag}Jackpot!`, { color: "#facc15", size: 0.1 });
      } else if (r === GATE.shut) {
         anim.hurtAt = now;
         juice.burst("dust", at, 26, { color: "#9ca3af", vy: 2 });
         juice.popup(chest, `${tag}Not enough coins!`, { color: "#e5e7eb", size: 0.07 });
         juice.kick(0, 0, 1, 2);
         juice.shake(0.25);
         playSfx("thud", { volume: 0.7, pitch: 0.7 });
      } else if (r === GATE.free) {
         juice.burst("hit", at, 44, { color: "#fb923c" });
         juice.burst("dust", at, 30, { color: "#d6d3d1" });
         juice.popup(chest, `${tag}Free toll!`, { color: "#fdba74", size: 0.09 });
         juice.shake(0.3);
         juice.hitStop(70);
         playSfx("thud", { pitch: 1.1 });
      } else if (r === GATE.ghost) {
         juice.burst("aura", chest, 30, { color: "#c4b5fd" });
         juice.popup(chest, `${tag}Ghost gate!`, { color: "#ddd6fe", size: 0.08 });
         playSfx("chime", { pitch: 1.9, volume: 0.5 });
      }
   }
   if (ev.perfect) {
      juice.burst("checkpoint", { x: -c.half + 0.3, y: 2, z: h.z }, 30, { color: "#4ade80" });
      juice.burst("checkpoint", { x: c.half - 0.3, y: 2, z: h.z }, 30, { color: "#4ade80" });
      juice.popup(chest, `${tag}Perfect lane!`, { color: "#bbf7d0", size: 0.08 });
      playSfx("chime", { pitch: 1.2, volume: 0.55 });
   }
   if (ev.stumbled) {
      anim.stumbleAt = now;
      juice.burst("dust", feet, 20, { color: "#a8a29e" });
      juice.popup(chest, `${tag}Ouch`, { color: "#fca5a5", size: 0.06 });
      juice.shake(0.2);
      playSfx("thud", { volume: 0.5, pitch: 1.2 });
   }
   if (ev.fell) {
      anim.fallAt = now;
      juice.burst("dust", feet, 34, { color: "#78716c", vy: 3 });
      juice.popup(chest, `${tag}Fell!`, { color: "#fca5a5", size: 0.09 });
      juice.shake(0.4);
      playSfx("thud", { pitch: 0.5 });
   }
   if (ev.caught) {
      anim.hurtAt = now;
      juice.burst("dust", feet, 50, { color: "#a8a29e", vy: 3 });
      juice.popup(chest, `${tag}${c.boss && run.bossOn ? "Bitten!" : "Flattened!"}`, { color: "#fca5a5", size: 0.1 });
      juice.shake(0.55);
      juice.hitStop(120);
      playSfx("boom", { volume: 0.7, pitch: 0.7 });
   }
   if (ev.rumble) playSfx("thud", { volume: 0.25, pitch: 0.4 });
   if (ev.tileFell >= 0) {
      const t = c.hazards[ev.tileFell];
      juice.burst("dust", { x: laneX(t.lane), y: 0.2, z: t.z }, 22, { color: "#a8916c", vy: -1 });
   }
   if (ev.crossStarted >= 0) playSfx("thud", { volume: 0.4, pitch: 0.5 });
   if (ev.powered || ev.dashed) {
      juice.burst("pickup", chest, 18, { color: heroAccent(run.heroId) });
      juice.burst("aura", chest, 12, { color: heroAccent(run.heroId) });
      playSfx("whoosh", { volume: 0.55, pitch: 1.15 });
   }
   for (let k = 0; k < ev.orbCount; k++) {
      const o = c.orbs[ev.orbList[k]];
      juice.burst("checkpoint", o, 30, { color: "#34d399" });
      juice.popup(o, `${tag}Relic!`, { color: "#a7f3d0", size: 0.07 });
      playSfx("chime", { pitch: 1.4 });
   }
   for (let k = 0; k < ev.secretCount; k++) {
      const i = ev.secretList[k];
      const spot = c.secrets[i];
      const spec = SECRETS[run.level][i];
      const at = spot.need === "pauper" ? chest : spot;
      juice.burst("checkpoint", at, 30, { color: spec.kind === "shard" ? "#ddd6fe" : "#f9a8d4" });
      juice.popup(at, `${spec.name}!`, { color: spec.kind === "shard" ? "#ddd6fe" : "#f9a8d4", size: 0.07 });
      juice.hitStop(40);
      playSfx("chime", { pitch: 1.4 });
   }
   // level 5: Coilstone
   const head = { x: h.x, y: 2.2, z: chaserZ(run) + 1 };
   if (ev.bossTelegraph) playSfx("whoosh", { volume: 0.45, pitch: 0.45 });
   if (ev.lunged) {
      juice.burst("dust", { x: laneX(run.hazard.lane), y: 0.3, z: h.z }, 26, { color: "#a8a29e" });
      juice.shake(0.3);
      playSfx("thud", { volume: 0.6, pitch: 0.5 });
   }
   if (ev.bossAttack && !ev.lunged) playSfx("whoosh", { volume: 0.5, pitch: 0.6 });
   if (ev.bellPaid || ev.bowlPaid) {
      juice.burst("pickup", chest, 24, { color: "#fcd34d", vy: 3 });
      juice.popup(chest, `${tag}${ev.bellPaid ? "Bell!" : "Offering!"} -${ev.paid}`, { color: "#fde68a", size: 0.08 });
      playSfx("chime", { pitch: ev.bellPaid ? 0.7 : 1.5, volume: 0.65 });
   }
   if (ev.bossHit) {
      juice.burst("hit", head, 40, { color: "#a78bfa" });
      juice.burst("dust", head, 30, { color: "#d6d3d1" });
      juice.popup(chest, `${tag}${run.boss && run.boss.phase >= 2 ? "Crack!" : "Bong!"}`, { color: "#ede9fe", size: 0.09 });
      juice.shake(0.35);
      juice.hitStop(90);
      playSfx("thud", { pitch: 1.2 });
      playSfx("chime", { pitch: 0.5, volume: 0.7 });
   }
   if (ev.bossDefeated) {
      juice.burst("checkpoint", head, 140, { color: "#4ade80" });
      juice.burst("hit", head, 60, { color: "#a78bfa" });
      juice.popup(chest, `${tag}Coilstone is free!`, { color: "#bbf7d0", size: 0.1 });
      juice.shake(0.5);
      juice.hitStop(Math.min(140, COILSTONE.slowMo.durationMs));
   }
   if (ev.comboLinked && run.combo.chain > 4 && run.combo.chain % 5 === 0) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.4 });
}

function Simulation({ run, anim, orbit, restore }: { run: TempleRun; anim: HeroAnim; orbit: OrbitState; restore: RestoreRef }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const rumbleAt = useRef(0);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;

   useRunFrame((_state, dt) => {
      const i = input.current;
      stepInput.left = i.pressed.left;
      stepInput.right = i.pressed.right;
      stepInput.up = i.pressed.up;
      stepInput.down = i.pressed.down;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.actionPressed = i.actionPressed;
      stepInput.yaw = orbit.viewYaw;
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
      // the colour comes back as the gates are passed (the World 3 restore)
      const cleared = run.nextGate + (run.bossOn && run.boss ? COILSTONE.maxHp - run.boss.hp : 0);
      restore.amount = restoreAmount(cleared, run.course.gates.length + (run.boss ? COILSTONE.maxHp : 0));
      // the boulder's rumble: closer, louder and more often
      if (run.ended === null && now - rumbleAt.current > 0.25 + run.gap * 0.12) {
         rumbleAt.current = now;
         const near = Math.max(0, 1 - run.gap / 7);
         playSfx("thud", { volume: 0.08 + near * 0.3, pitch: 0.35 + near * 0.1 });
         if (near > 0.5) juice.shake(0.05 * near);
      }
      publishRun(run);
      if (ev.finished || ev.lost || ev.timeup) {
         store.setStat(STAT.finishMs, run.finishMs);
         store.setScore(scoreOf(run));
         const end = levelEndStats(run, userRef.current);
         for (const key of Object.keys(end) as Array<keyof typeof end>) store.setStat(STAT[key], end[key]);
         if (ev.finished) {
            anim.winAt = now;
            juice.burst("checkpoint", { x: h.x, y: 1.2, z: h.z }, 110, { color: "#4ade80" });
            juice.shake(0.2);
            playSfx("chime", { pitch: 0.75 });
            store.end("win");
         } else store.end(ev.lost ? "lose" : "timeup");
      }
   });
   return null;
}

function TempleCamera({ run, orbit }: { run: TempleRun; orbit: OrbitState }) {
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
         orbitPivot(h.x, h.y, h.z, h.v, out, Math.cos(orbit.viewYaw));
         out.x *= 1 - 0.5 * portraitAmount(aspect);
         return true;
      },
      [run, orbit, aspect],
   );
   const travel = useMemo(() => (out: { x: number; z: number }) => orbitTravel(run.hero.v, out), [run]);
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run, camera.position.z, out), [run, camera]);
   return (
      <OrbitCamera
         orbit={orbit}
         pivot={pivot}
         travel={travel}
         solids={solids}
         input={{ oneFinger: false }}
         lookUp={orbitLookUp(aspect)}
         distanceScale={orbitScale(aspect, LANES)}
         collision={{ radius: 0.4, minDistance: 2.2 }}
      />
   );
}

/** Coilstone's slow-mo finish: the visuals only (the rules clock never slows). */
function BossSlowMo({ run }: { run: TempleRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, COILSTONE.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: TempleRun; anim: HeroAnim }) {
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
      juice.burst("dust", { x: h.x, y: 0.2, z: h.z }, 26, { color: "#d6c4a0", vy: 3 });
      juice.burst("pickup", { x: h.x, y: 0.7, z: h.z }, 16, { color: heroAccent(run.heroId) });
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
   const { config } = useLevel<TempleLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(TEMPLE_ORBIT), [run]);
   const restore = useMemo<RestoreRef>(() => ({ amount: restoreAmount(0, 1) }), [run]);
   return (
      <JuiceLayer>
         <World course={run.course} view={run.hero} restore={restore} />
         <Course key={levelId} run={run} />
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} orbit={orbit} restore={restore} />
         <TempleCamera run={run} orbit={orbit} />
         <BossSlowMo run={run} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
