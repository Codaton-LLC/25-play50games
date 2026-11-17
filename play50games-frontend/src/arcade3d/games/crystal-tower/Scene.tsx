"use client";

// Crystal Tower's scene: the run (rules.ts) stepped in useRunFrame, the cosmos (World), the tower
// (Tower), Prism Shade (Boss), the hero, the free orbit camera (menu2/camera: movement is
// camera-relative through StepInput.yaw, the level 5 framing leans toward the boss), the intro
// (core/intro, index.tsx `intro: true`), a ground arrow toward the armed beacon or the summit, and
// the juice (menu2/juice): a tone per colour as the beacon shows it, a burst in the crystal's colour
// and a count on a right touch, a red shove on a wrong one, the round's fanfare, the beacon lighting
// up, storms, drones, falls, checkpoints, Prism Shade's shuffle, hits and slow-mo finish (visual
// only). Remounted per run (runId). Local multiplayer renders MultiScene.tsx.
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
import { Tower, createTowerFx, type TowerFx, type VisualClock } from "./TowerView";
import { Boss } from "./Boss";
import { Hero, createHeroAnim, type HeroAnim } from "./Hero";
import { TOWER_COLLISION, FOV, FOV_PORTRAIT, towerOrbit, courseSolids, introKeyframes, steerBossFraming, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { ORB_BONUS_MS, STAT, createRun, createStepInput, guidePoint, step, type TowerRun, type StepEvents } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import { PALETTE, type TowerSpec } from "./levels";
import { crystalAt } from "./tower";
import { COMBO, PRISM, SECRETS } from "./progression";
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

/** A tone per colour (the show, a right touch). */
export function colorPitch(color: number): number {
   return 0.8 + color * 0.17;
}

/** The colours of the running show revealed so far, packed base 8 (colour + 1, step 0 lowest); 0 = none. */
export function packShown(run: TowerRun): number {
   const ts = run.tiers[run.tier];
   const tier = run.course.tiers[run.tier];
   if (!ts || !tier || ts.showStart < 0) return 0;
   const steps = Math.min(tier.seqLen, Math.floor((run.simMs - ts.showStart) / 650) + 1);
   let v = 0;
   for (let i = steps - 1; i >= 0; i--) v = v * 8 + ts.seq[i] + 1;
   return v;
}

function packBossShown(run: TowerRun): number {
   const b = run.boss;
   if (!b || b.step !== "telegraph") return 0;
   const steps = Math.min(run.bossLen, Math.floor(b.stepMs / 650) + 1);
   let v = 0;
   for (let i = steps - 1; i >= 0; i--) v = v * 8 + run.bossSeq[i] + 1;
   return v;
}

export function publishBoss(run: TowerRun): void {
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
   set(STAT.bossOn, run.bossAwake && b.step !== "intro" ? 1 : 0);
   set(STAT.bossTrick, run.bossDark ? 1 : run.bossMirror ? 2 : 0);
}

/** The HUD's numbers that change during a run (written only when they change). */
export function publishRun(run: TowerRun): void {
   const store = useArcadeStore.getState();
   const h = run.hero;
   const c = run.course;
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
   set(STAT.tier, Math.min(run.tier, c.tiers.length - 1));
   set(STAT.tiers, c.tiers.filter((t) => t.seqLen > 0).length);
   set(STAT.strikes, run.strikes);
   set(STAT.wrongs, run.wrongs);
   if (run.bossAwake && run.boss) {
      const b = run.boss;
      set(STAT.seqLen, run.bossLen);
      set(STAT.seqProgress, run.bossProgress);
      set(STAT.seqShown, packBossShown(run));
      set(STAT.seqState, b.step === "telegraph" ? 1 : b.step === "vulnerable" ? 2 : 0);
   } else {
      const ts = run.tiers[run.tier];
      const tier = c.tiers[run.tier];
      set(STAT.seqLen, tier ? tier.seqLen : 0);
      set(STAT.seqProgress, ts ? ts.progress : 0);
      set(STAT.seqShown, packShown(run));
      set(STAT.seqState, ts && ts.showStart >= 0 ? 1 : ts && ts.shown && !ts.done ? 2 : 0);
   }
   set(STAT.progress, Math.max(0, Math.min(100, Math.round(((h.y - c.startY) / Math.max(1, c.maxY - c.startY)) * 100))));
   publishBoss(run);
}

function Simulation({ run, anim, clock, fx, won, orbit }: { run: TowerRun; anim: HeroAnim; clock: VisualClock; fx: TowerFx; won: { current: boolean }; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const at = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const trail = useMemo(createJuiceEmitter, []);
   const lastSlot = useMemo(() => new Uint8Array(5), []);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;
   const accent = heroAccent(run.heroId);

   const react = (ev: StepEvents) => {
      const store = useArcadeStore.getState();
      const h = run.hero;
      const c = run.course;
      const now = time.now;
      chest.x = feet.x = h.x;
      chest.z = feet.z = h.z;
      chest.y = h.y + 1.1;
      feet.y = h.y + 0.1;
      if (h.grounded && Math.hypot(h.vx, h.vz) > 4) juice.stream("dust", feet, 6, trail, { color: "#c4b5fd", vx: -h.vx * 0.2, vy: 1.2, vz: -h.vz * 0.2, size: 0.45 });
      if (ev.showStart >= 0) {
         juice.popup(chest, "Watch!", { color: COLORS.beacon, size: 0.07 });
         playSfx("chime", { volume: 0.5, pitch: 1.1 });
      }
      if (ev.showStep >= 0 && ev.showColor >= 0) {
         const b = c.tiers[run.tier].beacon;
         at.x = b.x;
         at.y = b.y + 2.9;
         at.z = b.z;
         juice.burst("pickup", at, 14, { color: PALETTE[ev.showColor].hex, vy: 1.5 });
         playSfx("pop", { volume: 0.55, pitch: colorPitch(ev.showColor) });
      }
      if (ev.showDone >= 0) {
         juice.popup({ x: chest.x, y: chest.y + 0.6, z: chest.z }, "Go!", { color: COLORS.glow, size: 0.09 });
         playSfx("chime", { pitch: 1.5 });
      }
      if (ev.showCancel >= 0) {
         juice.popup(chest, "Stay in the ring!", { color: COLORS.wrong, size: 0.06 });
         playSfx("thud", { volume: 0.35, pitch: 1.4 });
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
         juice.burst("dust", feet, hard ? 18 : 6, { color: "#c4b5fd", vy: hard ? 3 : 1.4 });
         if (hard) juice.kick(0, -1, 0, 1.2);
      }
      if (ev.pick !== -1) {
         let color = 0;
         let len = 0;
         let prog = 0;
         if (ev.pick >= 0) {
            const cr = c.crystals[ev.pick];
            crystalAt(cr, run.simMs, at);
            color = cr.color;
            const ts = run.tiers[cr.tier];
            len = c.tiers[cr.tier].seqLen;
            prog = ts.done ? len : ts.progress;
         } else {
            color = -2 - ev.pick;
            at.x = chest.x;
            at.y = chest.y + 0.6;
            at.z = chest.z;
            len = run.bossLen;
            prog = run.bossProgress;
         }
         juice.burst("pickup", at, 22, { color: PALETTE[color].hex, vy: 3 });
         juice.popup(at, `${prog}/${len}`, { color: PALETTE[color].hex, size: 0.07 });
         playSfx("pickup", { pitch: colorPitch(color) });
      }
      if (ev.wrong !== -1) {
         anim.hurtAt = now;
         anim.hurtX = h.vx;
         anim.hurtZ = h.vz;
         juice.burst("hit", chest, 18, { color: COLORS.wrong });
         juice.popup({ x: chest.x, y: chest.y + 0.5, z: chest.z }, "Wrong! Start over", { color: COLORS.wrong, size: 0.07 });
         juice.shake(0.22);
         playSfx("thud", { volume: 0.6, pitch: 0.7 });
      }
      if (ev.roundDone >= 0) {
         juice.burst("checkpoint", chest, 50, { color: COLORS.glow });
         juice.popup({ x: chest.x, y: chest.y + 0.8, z: chest.z }, "Sequence!", { color: COLORS.glow, size: 0.1 });
         juice.hitStop(50);
         playSfx("chime", { pitch: 1.3 });
      }
      if (ev.beaconArmed >= 0) {
         const b = c.tiers[ev.beaconArmed].beacon;
         at.x = b.x;
         at.y = b.y + 1.5;
         at.z = b.z;
         juice.burst("checkpoint", at, 30, { color: COLORS.beacon });
         juice.popup(at, "Beacon lit!", { color: COLORS.beacon, size: 0.07 });
         playSfx("chime", { pitch: 1.6, volume: 0.6 });
      }
      if (ev.crumble >= 0) {
         const p = c.pads[ev.crumble];
         juice.burst("dust", { x: p.x, y: p.y + 0.1, z: p.z }, 16, { color: "#9a3412", vy: 1 });
         playSfx("thud", { volume: 0.35, pitch: 1.1 });
      }
      if (ev.powered) {
         juice.burst("pickup", chest, 18, { color: accent });
         juice.burst("aura", chest, 12, { color: accent });
         playSfx("whoosh", { volume: 0.5, pitch: 1.1 });
      }
      if (ev.wallBroken >= 0) {
         juice.burst("hit", chest, 30, { color: "#c4b5fd" });
         juice.popup(chest, "Shatter!", { color: "#c4b5fd", size: 0.08 });
         juice.shake(0.28);
         juice.hitStop(60);
         playSfx("thud");
      }
      if (ev.knocked || ev.fell) {
         anim.hurtAt = now;
         anim.hurtX = h.vx;
         anim.hurtZ = h.vz;
         if (ev.wrong === -1) juice.burst("hit", chest, 14, { color: "#94a3b8" });
         juice.shake(ev.fell ? 0.25 : 0.18);
         playSfx(ev.fell ? "lose" : "thud", { volume: 0.5, pitch: 0.8 });
      }
      if (ev.respawned) {
         juice.burst("pickup", chest, 20, { color: accent });
         playSfx("pop");
      }
      if (ev.shielded) juice.burst("aura", chest, 10, { color: accent });
      if (ev.checkpoint >= 0) {
         juice.burst("checkpoint", chest, 30, { color: "#c4b5fd" });
         playSfx("chime", { volume: 0.5 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = c.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 12, { color: COLORS.gem });
         juice.popup(o, `-${(ORB_BONUS_MS / 1000).toFixed(2)} s`, { color: COLORS.gem });
         playSfx("pickup", { pitch: 1 + Math.min(0.6, run.orbs * 0.03) });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spot = c.secrets[ev.secretList[k]];
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", spot, 30, { color: spec.kind === "shard" ? COLORS.shard : COLORS.sticker });
         juice.popup(spot, `${spec.name}!`, { color: spec.kind === "shard" ? COLORS.shard : COLORS.sticker, size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.5 });
      }
      if (ev.comboLinked && run.combo.chain > 1) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.4 });
      if (ev.bossWake) {
         juice.popup({ x: c.arena!.x, y: c.arena!.y + 4, z: c.arena!.z }, "Prism Shade!", { color: COLORS.glow, size: 0.11 });
         juice.shake(0.3);
         playSfx("whoosh", { volume: 0.7, pitch: 0.5 });
      }
      if (ev.bossTelegraph) playSfx("whoosh", { volume: 0.4, pitch: 0.7 });
      if (ev.bossShowStep >= 0 && ev.showColor >= 0 && run.bossAwake) {
         at.x = c.arena!.x;
         at.y = c.arena!.y + 5.5;
         at.z = c.arena!.z;
         juice.burst("pickup", at, 16, { color: PALETTE[ev.showColor].hex, vy: 1.5 });
         playSfx("pop", { volume: 0.55, pitch: colorPitch(ev.showColor) });
      }
      if (ev.bossAttack) {
         juice.shake(0.2);
         playSfx("jump", { volume: 0.6, pitch: 0.5 });
         if (ev.bossShuffle) {
            fx.prevSlot.set(lastSlot);
            fx.shuffleAt = run.simMs;
            juice.popup({ x: c.arena!.x, y: c.arena!.y + 3.5, z: c.arena!.z }, "Shuffled!", { color: COLORS.glow, size: 0.09 });
         } else if (run.bossDark) juice.popup({ x: c.arena!.x, y: c.arena!.y + 3.5, z: c.arena!.z }, "Blackout!", { color: "#cbd5e1", size: 0.09 });
         else if (run.bossMirror) juice.popup({ x: c.arena!.x, y: c.arena!.y + 3.5, z: c.arena!.z }, "Reversed!", { color: COLORS.glow, size: 0.09 });
      }
      if (ev.bossOpen) playSfx("chime", { pitch: 1.5, volume: 0.5 });
      if (ev.bossMiss) {
         juice.popup(chest, "Too slow", { color: "#cbd5e1", size: 0.07 });
         playSfx("thud", { volume: 0.4, pitch: 0.6 });
      }
      if (ev.bossHit) {
         at.x = c.arena!.x;
         at.y = c.arena!.y + 3;
         at.z = c.arena!.z;
         juice.burst("hit", at, 30, { color: "#f5d0fe" });
         juice.popup(at, "Hit!", { color: "#f5d0fe", size: 0.09 });
         juice.shake(0.32);
         juice.hitStop(90);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.bossDefeated) {
         at.x = c.arena!.x;
         at.y = c.arena!.y + 3;
         at.z = c.arena!.z;
         juice.burst("checkpoint", at, 110, { color: COLORS.glow });
         juice.popup({ x: at.x, y: at.y + 1.5, z: at.z }, "Shattered!", { color: COLORS.glow, size: 0.1 });
         juice.shake(0.45);
      }
      lastSlot.set(run.bossSlot);
      publishRun(run);
      if (ev.finished && !won.current) {
         won.current = true;
         anim.winAt = now;
         juice.burst("checkpoint", chest, 90, { color: COLORS.glow });
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

function TowerCamera({ run, orbit }: { run: TowerRun; orbit: OrbitState }) {
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
         // in Prism Shade's fight the boss framing turns the camera, not the run direction
         const fight = run.bossAwake && run.boss !== null && run.boss.hp > 0;
         out.x = fight ? 0 : run.hero.vx;
         out.z = fight ? 0 : run.hero.vz;
      },
      [run],
   );
   // level 5: keep Prism Shade in shot (before the orbit driver eases the view this frame)
   useFrame((_, dt) => {
      if (arcadeStore.getState().phase === "playing") steerBossFraming(orbit, run, dt, aspect);
   }, ORBIT_DRIVER_PRIORITY - 0.002);
   const solids = useMemo(() => (out: AABB[]) => courseSolids(run, camera.position.x, camera.position.z, out), [run, camera]);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} solids={solids} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={TOWER_COLLISION} />;
}

/** A violet chevron on the pad round the hero, pointing at the armed beacon or the summit (never at a crystal). */
function Guide({ run }: { run: TowerRun }) {
   const ref = useRef<Group>(null);
   const g = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   useFrame(() => {
      const h = run.hero;
      const grp = ref.current;
      if (!grp) return;
      const has = guidePoint(run, g);
      const dx = g.x - h.x;
      const dz = g.z - h.z;
      const d = Math.hypot(dx, dz);
      grp.visible = has && d > 3 && run.ended === null && h.grounded;
      grp.position.set(h.x + (dx / Math.max(d, 1e-6)) * 1.4, h.y + 0.08, h.z + (dz / Math.max(d, 1e-6)) * 1.4);
      grp.rotation.y = Math.atan2(dx, dz);
   }, FRAME_PRIORITY.visuals);
   return (
      <group ref={ref}>
         <mesh rotation-x={-Math.PI / 2}>
            <coneGeometry args={[0.36, 0.85, 3]} />
            <meshBasicMaterial color={COLORS.beacon} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
         </mesh>
      </group>
   );
}

/** The boss's slow-mo finish: visual only (the hit-stop is its punch; the rules clock never slows). */
function BossSlowMo({ run }: { run: TowerRun }) {
   const juice = useJuice();
   const fired = useRef(false);
   useFrame(() => {
      const b = run.boss;
      if (!b || fired.current || b.defeatMs < 0) return;
      fired.current = true;
      juice.hitStop(Math.min(140, PRISM.slowMo.durationMs));
   });
   return null;
}

function IntroCamera({ run, anim }: { run: TowerRun; anim: HeroAnim }) {
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
   const { config } = useLevel<TowerSpec>();
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
   const fx = useMemo(createTowerFx, [run]);
   const orbit = useMemo(() => createOrbit(towerOrbit(run.course)), [run]);
   const won = useRef(false);
   return (
      <JuiceLayer>
         <World course={run.course} />
         {/* keyed by level: the pools are sized once per mount */}
         <Tower key={levelId} run={run} clock={clock} fx={fx} />
         {run.course.boss ? <Boss run={run} clock={clock} /> : null}
         <Hero run={run} anim={anim} />
         <Simulation run={run} anim={anim} clock={clock} fx={fx} won={won} orbit={orbit} />
         <TowerCamera run={run} orbit={orbit} />
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
