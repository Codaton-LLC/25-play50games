"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useRunFrame } from "../../core/useRunFrame";
import { useInput } from "../../core/input";
import { useLevel } from "../../core/level";
import { playSfx, startLoop, useMuted } from "../../core/audio";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { randomSeed } from "../../core/math";
import { ARCADE_PREVIEW } from "../../flags";
import { JuiceLayer, useJuice, createJuiceEmitter } from "../../menu2/juice";
import { comboFlow } from "../../menu2/combo/combo";
import { bossTimeScale } from "../../menu2/boss/boss";
import { createOrbit, orbitDirection, type OrbitState } from "../../menu2/camera/orbit";
import { OrbitCamera, OrbitDriver } from "../../menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "../../core/intro";
import { playersStore, usePlayers } from "../../menu2/multiplayer/players";
import { PlayerInputLatch, playerInputFor } from "../../menu2/multiplayer/MultiplayerInput";
import { SharedCamera } from "../../menu2/multiplayer/SharedCamera";
import { SplitScreen } from "../../menu2/multiplayer/SplitScreen";
import { useAuth } from "@/contexts/AuthContext";
import { Course } from "./Course";
import { Hero } from "./Hero";
import { createRun, step, idleInput, STAT, surfaceAt, type SnowRun, type StepInput, type Events } from "./rules";
import { pickedHero, subscribeHero, type HeroId, HEROES } from "./heroes";
import { SNOW_ORBIT, FOV, playCamera, introKeyframes, orbitScale, cameraSolids } from "./camera";
import { COMBO, BIG_DRIFT } from "./progression";
import { botInput } from "./bot";
import { levelEndStats } from "./levelEnd";
import { createMultiRun, stepMulti, leaderIndex, needsSplit, type MultiRun } from "./multiplayer";
import type { SnowLevel } from "./levels";

export function publish(r: SnowRun): void {
   const s = useArcadeStore.getState();
   const values: Partial<Record<keyof typeof STAT, number>> = {
      level: r.level, orbs: r.orbs, distance: Math.round(r.distance), speed: Math.round(r.speed * 10), streak: r.streak,
      hits: r.hits, hero: HEROES.findIndex((h) => h.id === r.heroId), power: Math.max(0, Math.ceil((r.powerReadyAt - r.simMs) / 1000)),
      surface: ["powder", "packed", "ice"].indexOf(surfaceAt(r.config, r.distance, r.hero.x)),
      chain: r.combo.chain, multiplier: Math.round(r.combo.multiplier * 100), flow: Math.round(comboFlow(r.combo, COMBO, r.simMs) * 100),
      bossHp: r.boss?.hp ?? 0, bossPhase: r.boss?.phase ?? 0, bossOpen: r.boss?.step === "vulnerable" ? 1 : 0,
      bossFlash: r.boss && r.boss.flashMs > 0 ? 1 : 0, charges: r.charges, gap: Math.round(r.gap),
   };
   for (const key of Object.keys(values) as (keyof typeof STAT)[]) if (s.stats[STAT[key]] !== values[key]) s.setStat(STAT[key], values[key]!);
}
function useEffects() {
   const juice = useJuice();
   return (r: SnowRun, e: Events) => {
      const p = r.hero;
      if (e.gate) {
         juice.burst("pickup", p, 18, { color: "#facc15" });
         juice.popup(p, r.streak + " GATES", { color: "#fff0a5" });
         playSfx("whoosh", { volume: 0.45, pitch: 1 + r.streak * 0.1 });
         playSfx("chime", { volume: 0.4, pitch: 1 + r.streak * 0.13 });
      }
      if (e.jumped || e.airJump) playSfx("jump", { pitch: e.airJump ? 1.4 : 1 });
      if (e.landed) {
         juice.burst("dust", p, 16, { color: "#edfaff" });
         juice.kick(0, -1, 0, 1.3);
         playSfx(e.perfect ? "chime" : "thud", { volume: 0.6 });
         if (e.perfect) { juice.burst("pickup", p, 18, { color: "#ffe180" }); juice.popup(p, "CLEAN AIR!", { color: "#ffe180" }); }
      }
      if (e.powered) { juice.burst("aura", p, 25, { color: HEROES.find((h) => h.id === r.heroId)!.color }); playSfx("whoosh"); }
      if (e.route >= 0) {
         const hero = r.course.routes[e.route].hero;
         juice.burst(hero === "riko" ? "hit" : "pickup", p, 32, { color: HEROES.find((h) => h.id === hero)!.color });
         juice.popup(p, hero === "zuno" ? "+12 CREEK COINS" : hero === "nami" ? "HIGH RIDGE!" : hero === "kiro" ? "SNOW SHIELD!" : hero === "riko" ? "POND SHORTCUT!" : "HIDDEN GULLY!", { color: "#fce68a" });
         playSfx(hero === "riko" ? "thud" : "pickup");
         if (hero === "riko") { juice.shake(0.2); juice.hitStop(60); }
      }
      if (e.hit) { juice.burst("hit", p, 24); juice.shake(0.22); juice.hitStop(65); playSfx("hit"); }
      if (e.secret) { juice.burst("checkpoint", p, 35, { color: "#fce68a" }); juice.popup(p, "SECRET!", { color: "#fce68a" }); playSfx("chime", { pitch: 1.5 }); }
      if (e.checkpoint) { juice.burst("checkpoint", p, 16); playSfx("pop", { volume: 0.25 }); }
      if (e.bossHit) { juice.burst("hit", p, 45, { color: "#fff1a3" }); juice.shake(0.35); juice.hitStop(100); playSfx("boom"); }
      if (e.bossDefeated) { juice.burst("checkpoint", p, 110, { color: "#ffdc65" }); juice.popup(p, "GOLD SNOW!", { color: "#ffdc65", size: 0.08 }); juice.hitStop(140); }
      if (e.finished) { juice.burst("checkpoint", p, 90, { color: "#facc15" }); playSfx("win"); }
   };
}
function useSlideSound(r: SnowRun) {
   const phase = useArcadeStore((s) => s.phase), muted = useMuted();
   const handles = useRef<ReturnType<typeof startLoop>[]>([]), lastBeat = useRef(-1);
   useEffect(() => {
      if (phase !== "playing" || muted) return;
      const hiss = startLoop("slide", { volume: 0.13, pitch: 0.9 });
      const bed = startLoop("ambient", { volume: 0.035, pitch: 1.35 });
      handles.current = [hiss, bed]; lastBeat.current = -1;
      return () => { hiss.stop(); bed.stop(); handles.current = []; };
   }, [phase, muted]);
   useFrame(() => {
      if (phase !== "playing" || muted) return;
      handles.current[0]?.set({ pitch: 0.65 + r.speed / 38, volume: 0.05 + r.speed / 220 });
      // Original 132 BPM celesta-like ostinato, synthesized by core audio; no downloaded music.
      const beat = Math.floor(r.simMs / (60_000 / 132));
      if (beat !== lastBeat.current) {
         lastBeat.current = beat;
         playSfx("chime", { volume: 0.045, pitch: [1, 1.26, 1.5, 1.12, 1.5, 1.26, 1.68, 1.5][beat % 8] });
      }
   });
}
function Simulation({ run: r, orbit }: { run: SnowRun; orbit: OrbitState }) {
   const input = useInput(), effects = useEffects(), juice = useJuice();
   const stepInput = useMemo(idleInput, []), spray = useMemo(createJuiceEmitter, []);
   const finishBoss = useMemo(() => r.boss ? { ...r.boss } : null, [r]);
   const { user } = useAuth();
   const autoplay = useMemo(() => ARCADE_PREVIEW && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("autoplay") === "1", []);
   useSlideSound(r);
   useFrame(() => {
      const s = useArcadeStore.getState();
      if (!finishBoss || !r.boss || s.phase !== "over" || r.ended !== "win") return;
      finishBoss.step = "defeat";
      finishBoss.defeatMs = s.overMs;
      // The shared boss owns the finish interval; shared juice slows only the visual clock.
      if (bossTimeScale(finishBoss, BIG_DRIFT) < 1) juice.hitStop(24);
   }, FRAME_PRIORITY.camera + 0.04);
   useRunFrame((_, dt) => {
      const i = input.current;
      stepInput.moveX = i.moveX; stepInput.moveY = i.moveY;
      stepInput.jumpPressed = i.jumpPressed; stepInput.actionPressed = i.actionPressed;
      stepInput.carve = i.moveY > 0.35; stepInput.yaw = orbit.viewYaw;
      if (autoplay) botInput(r, stepInput);
      const ev = step(r, dt * 1000, stepInput);
      effects(r, ev); publish(r);
      if (stepInput.carve && r.airMs <= 0) juice.stream("dust", r.hero, 70, spray, { color: "#f3fbff", vx: -r.hero.vx, vz: r.speed * 0.2 });
      if (r.level === 5 && r.gap < 50) juice.shake(Math.max(0, (50 - r.gap) / 160));
      if (r.ended) {
         const s = useArcadeStore.getState();
         s.setStat(STAT.finishMs, r.finishMs);
         const end = levelEndStats(r, user?.id ?? null);
         for (const key of Object.keys(end) as (keyof typeof end)[]) s.setStat(STAT[key], end[key]);
         s.end(r.ended);
      }
   });
   return null;
}
function SoloScene() {
   const { config } = useLevel<SnowLevel>();
   const runId = useArcadeStore((s) => s.runId), ready = useArcadeStore((s) => s.phase === "ready");
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero), held = useRef(pick);
   if (ready) held.current = pick;
   const hero = held.current;
   const r = useMemo(() => createRun(randomSeed(), config?.id ?? 1, hero), [runId, config?.id, hero]);
   const orbit = useMemo(() => createOrbit(SNOW_ORBIT), [r]);
   const intro = useShellIntro(), size = useThree((s) => s.size);
   const play = useMemo(() => playCamera(size.width / size.height), [size.width, size.height]);
   const shots = useMemo(() => introKeyframes(r), [r]);
   return <JuiceLayer>
      <Course run={r} />
      <Hero run={r} intro={intro && !intro.ready ? intro.hero : undefined} />
      <Simulation run={r} orbit={orbit} />
      <Lens run={r} />
      <OrbitCamera orbit={orbit} lookUp={0.8} distanceScale={orbitScale(size.width / size.height)}
         pivot={(out) => { out.x = r.hero.x; out.y = r.hero.y + 1.3; out.z = r.hero.z - 3; }}
         travel={(out) => { out.x = r.hero.vx; out.z = r.hero.vz; }} solids={(out) => cameraSolids(r, out)} />
      {intro?.session && !intro.ready && <GameIntro session={intro.session} keyframes={shots} playCamera={play} hero={intro.hero} />}
   </JuiceLayer>;
}
function Lens({ run: r }: { run: SnowRun }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   useFrame(() => {
      const fov = FOV + (size.width < size.height ? 8 : 0) + Math.max(0, Math.min(10, (r.speed - 28) / 16 * 10));
      if (Math.abs(camera.fov - fov) > 0.1) { camera.fov = fov; camera.updateProjectionMatrix(); }
   }, FRAME_PRIORITY.camera - 0.01);
   return null;
}
function MultiSimulation({ multi: m, orbit }: { multi: MultiRun; orbit: OrbitState }) {
   const inputs = useMemo(() => m.runs.map(idleInput), [m]), effects = useEffects();
   useSlideSound(m.runs[0]);
   useEffect(() => { playersStore.getState().beginRun(); }, [m]);
   useRunFrame((_, dt) => {
      inputs.forEach((i, k) => {
         const p = playerInputFor(k);
         i.moveX = p.moveX; i.moveY = p.moveY; i.jumpPressed = p.jumpPressed; i.actionPressed = p.actionPressed;
         i.carve = p.moveY > 0.35; i.yaw = orbit.viewYaw;
      });
      const events = stepMulti(m, dt * 1000, inputs), ps = playersStore.getState();
      m.runs.forEach((r, i) => {
         effects(r, events[i]);
         ps.setPosition(i, r.hero.x, r.hero.y, r.hero.z);
         const p = ps.players[i], progress = Math.round(r.distance);
         if (p && (p.score !== r.orbs || p.progress !== progress || p.finished !== (r.ended === "win"))) ps.update(i, { score: r.orbs, progress, finished: r.ended === "win", finishMs: r.ended === "win" ? r.finishMs : null });
      });
      publish(m.runs[leaderIndex(m)]);
      if (m.ended) useArcadeStore.getState().end(m.ended);
   });
   return null;
}
function MultiCamera({ multi: m, orbit }: { multi: MultiRun; orbit: OrbitState }) {
   const points = useMemo(() => m.runs.map((r) => r.hero), [m]);
   const [split, setSplit] = useState(false), current = useRef(false);
   const offset = useMemo<[number, number, number]>(() => [0, 8, 14], []);
   const dir = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   useFrame(() => {
      const next = needsSplit(m);
      if (next !== current.current) { current.current = next; setSplit(next); }
      orbitDirection(orbit.viewYaw, orbit.viewPitch, dir);
      offset[0] = dir.x * orbit.viewDistance; offset[1] = dir.y * orbit.viewDistance + 1.3; offset[2] = dir.z * orbit.viewDistance;
   }, FRAME_PRIORITY.camera + 0.01);
   return <>
      <OrbitDriver orbit={orbit} travel={(out) => { const h = m.runs[leaderIndex(m)].hero; out.x = h.vx; out.z = h.vz; }} />
      {split ? <SplitScreen targets={points} offset={offset} lookAhead={[0, 1, -4]} fov={64} /> : <SharedCamera points={points} active={() => m.runs.map((r) => !r.ended)} anchor={() => leaderIndex(m)} orbit={orbit} minSpan={10} maxSpan={42} padding={3} pitch={0.53} fov={FOV} />}
   </>;
}
function MultiScene() {
   const { config } = useLevel<SnowLevel>();
   const runId = useArcadeStore((s) => s.runId), mode = usePlayers((s) => s.mode);
   const heroKey = usePlayers((s) => s.players.map((p) => p.heroId).join(","));
   const m = useMemo(() => createMultiRun(randomSeed(), config?.id ?? 1, heroKey.split(",") as HeroId[], mode), [runId, config?.id, heroKey, mode]);
   const orbit = useMemo(() => createOrbit(SNOW_ORBIT), [m]);
   return <JuiceLayer>
      <Course run={m.runs[0]} runs={m.runs} />
      {m.runs.map((r, i) => <Hero key={i} run={r} />)}
      <PlayerInputLatch /><MultiSimulation multi={m} orbit={orbit} /><MultiCamera multi={m} orbit={orbit} />
   </JuiceLayer>;
}
export default function Scene() {
   const multi = usePlayers((s) => s.phase === "playing");
   return multi ? <MultiScene /> : <SoloScene />;
}
