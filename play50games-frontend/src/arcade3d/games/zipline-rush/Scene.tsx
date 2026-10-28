"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useRunFrame } from "../../core/useRunFrame";
import { useInput } from "../../core/input";
import { useLevel } from "../../core/level";
import { GameIntro, useShellIntro } from "../../core/intro";
import { playSfx, startLoop } from "../../core/audio";
import { JuiceLayer, useJuice, createJuiceEmitter } from "../../menu2/juice";
import { createOrbit } from "../../menu2/camera/orbit";
import { OrbitCamera, OrbitDriver } from "../../menu2/camera/OrbitCamera";
import { SharedCamera } from "../../menu2/multiplayer/SharedCamera";
import { PlayerInputLatch, playerInputFor } from "../../menu2/multiplayer/MultiplayerInput";
import { playersStore, usePlayers } from "../../menu2/multiplayer/players";
import { useAuth } from "@/contexts/AuthContext";
import { createRun, step, type ZipRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import type { ZipLevel } from "./levels";
import { levelEndStats } from "./levelEnd";
import { Course } from "./Course";
import { Hero } from "./Hero";
import { createMultiRun, stepMulti } from "./multiplayer";
import type { M2HeroId } from "../../menu2/heroModels";
import type { IntroKeyframe } from "../../core/intro/introMachine";

function CourseView({ runs }: { runs: ZipRun[] }) {
   const [focus, setFocus] = useState(0);
   useFrame(() => {
      let next = 0, progress = -1;
      runs.forEach((r, i) => { if (!r.ended && r.section + r.t > progress) { next = i; progress = r.section + r.t; } });
      if (next !== focus) setFocus(next);
   });
   return <Course run={runs[focus]} runs={runs} />;
}

function publish(r: ZipRun) {
   const s = useArcadeStore.getState();
   s.setScore(r.score);
   const stats = { speed: Math.round(r.speed * 10), section: r.section, t: Math.round(r.t * 100), orbs: r.orbs, chain: r.combo.chain, mult: r.combo.multiplier, flow: Math.max(0, 1 - (r.ms - r.combo.lastMs) / 3000), hp: r.boss?.hp ?? 0, bossPhase: r.boss?.phase ?? 0, open: r.boss?.step === "vulnerable" ? 1 : 0, telegraph: r.boss?.step === "telegraph" ? 1 : 0, lane: r.electricLane, mode: ["deck", "ride", "air", "bell"].indexOf(r.mode), cooldown: Math.ceil(r.cooldown / 1000), hits: r.hits };
   for (const [k, v] of Object.entries(stats)) if (s.stats[k] !== v) s.setStat(k, v);
}
function RunScene({ multi }: { multi: boolean }) {
   const { config } = useLevel<ZipLevel>();
   const id = config?.id ?? 1;
   const picked = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const phase = useArcadeStore((s) => s.phase);
   const { user } = useAuth();
   // A paused/result pick applies to the NEXT run; ready changes rebuild the intro hero.
   const heroId = phase === "ready" ? picked : undefined;
   const group = useMemo(() => multi ? createMultiRun(id, playersStore.getState().players.map((p) => p.heroId as M2HeroId), playersStore.getState().mode) : null, [id, multi]);
   const slots = useMemo(() => multi ? playersStore.getState().players.map((p) => p.index) : [], [group, multi]);
   const solo = useMemo(() => createRun(id, heroId ?? pickedHero()), [id, heroId]);
   const r = group?.runs[0] ?? solo;
   const runs = group?.runs ?? [solo];
   const input = useInput();
   const orbit = useMemo(() => createOrbit({ yaw: 0, pitch: 0.36, distance: 10.5, minDistance: 5, maxDistance: 22 }), [id, multi]);
   const aspect = useThree((s) => s.size.width / s.size.height);
   const intro = useShellIntro();
   const juice = useJuice();
   const emitter = useMemo(createJuiceEmitter, []);
   const hum = useMemo(() => ({ handle: null as ReturnType<typeof startLoop> | null, beat: -1 }), []);
   useEffect(() => {
      if (phase === "playing") hum.handle = startLoop("hum", { volume: 0.15 });
      return () => { hum.handle?.stop(); hum.handle = null; };
   }, [phase, hum]);
   useEffect(() => { if (multi) playersStore.getState().beginRun(); }, [multi, group]);
   useRunFrame((_, dt) => {
      if (group) {
         stepMulti(group, dt * 1000, runs.map((_, k) => { const i = playerInputFor(slots[k]); return { x: i.moveX, throttle: i.moveY, yaw: orbit.viewYaw, jump: i.jumpPressed, power: i.action }; }));
         runs.forEach((run, k) => {
            const p = playersStore.getState().players.find((player) => player.index === slots[k]); if (!p) return;
            const s = playersStore.getState(); s.setPosition(p.index, run.hero.x, run.hero.y, run.hero.z);
            s.update(p.index, { score: run.score, progress: Math.round((run.section + run.t) * run.cfg.length), finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs : null });
         });
         if (group.ended) useArcadeStore.getState().end(group.ended);
      } else {
         const i = input.current;
         step(r, dt * 1000, { x: i.moveX, throttle: i.moveY, yaw: orbit.viewYaw, jump: i.jumpPressed, power: i.actionPressed });
         publish(r);
         if (r.ended) {
            const s = useArcadeStore.getState();
            for (const [k, v] of Object.entries(levelEndStats(r, user?.id ?? null))) s.setStat(k, v);
            s.end(r.ended);
         }
      }
      const ev = r.event, at = r.hero;
      if (ev.jump) playSfx(ev.hop ? "whoosh" : "jump", { pitch: 1.2 });
      if (ev.pickup) { juice.burst("pickup", at, 12); playSfx("pickup", { pitch: 1 + Math.min(r.combo.chain, 6) / 10 }); }
      if (ev.landed) { juice.burst("checkpoint", at, 20); juice.kick(0, -1, 0, 0.8); playSfx("thud"); }
      if (ev.hit) { juice.burst("hit", at, 20); juice.shake(0.2); playSfx("zap"); }
      if (ev.bossHit) { juice.burst("hit", at, 32); juice.hitStop(100); juice.shake(0.3); playSfx("boom"); }
      if (ev.secret) { juice.burst("checkpoint", at, 28); juice.popup(at, "Secret found!"); playSfx("chime"); }
      if (ev.bell) { juice.burst("checkpoint", at, 48); juice.hitStop(140); playSfx("win"); }
      if (r.mode === "ride" && input.current.moveY < -0.25) juice.stream("trail", { ...at, y: at.y + 2 }, 45, emitter, { color: "#fde68a" });
      hum.handle?.set({ pitch: 0.5 + r.speed / 16, volume: r.mode === "ride" ? 0.22 : 0 });
      // Original synthesized W2 pentatonic phrase, 112 BPM, through the core mute/pause audio path.
      const beat = Math.floor(r.ms / (60_000 / 112));
      if (beat !== hum.beat) { hum.beat = beat; playSfx("chime", { pitch: [1, 1.122, 1.26, 1.498, 1.26, 1.122, 1, 0.75][beat % 8], volume: r.cfg.boss ? 0.08 : 0.045 }); }
   });
   const playCamera = useMemo<IntroKeyframe>(() => ({ position: [-1.25, 26, 10], lookAt: [-1.25, 22, -2] }), []);
   const shots = useMemo<IntroKeyframe[]>(() => [
      { position: [18, 38, -100], lookAt: [0, 20, -60] },
      { position: [-10, 25, -40], lookAt: [0, 21, -15] },
   ], []);
   const solids = (out: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }[]) => {
      for (let j = 0; j < r.cfg.sections + 1; j++) {
         Object.assign(out[j].min, { x: 3.8, y: 15 - j * 2, z: -j * (r.cfg.length + 8) - 1.6 });
         Object.assign(out[j].max, { x: 7.2, y: 25 - j * 2, z: -j * (r.cfg.length + 8) + 1.6 });
      }
      return r.cfg.sections + 1;
   };
   return <>
      {multi && <PlayerInputLatch />}
      <CourseView key={id} runs={runs} />
      {runs.map((run, k) => <Hero key={k} run={run} intro={intro?.session && !intro.ready && !multi ? intro.hero : undefined} />)}
      {multi ? <><OrbitDriver orbit={orbit} /><SharedCamera points={runs.map((run) => run.hero)} orbit={orbit} minSpan={9} maxSpan={90} padding={3} /></> :
         <OrbitCamera orbit={orbit} pivot={(out) => { Object.assign(out, { x: r.hero.x, y: r.hero.y + 1.2, z: r.hero.z - 1 }); }} travel={(out) => { out.x = r.vx; out.z = r.vz; }} distanceScale={aspect < 1 ? 1.35 : 1} solids={solids} />}
      {intro?.session && !multi && <GameIntro session={intro.session} keyframes={shots} playCamera={playCamera} hero={intro.hero} />}
   </>;
}
export default function Scene() {
   const runId = useArcadeStore((s) => s.runId), level = useArcadeStore((s) => s.levelId);
   const multi = usePlayers((s) => s.phase === "playing");
   return <JuiceLayer><RunScene key={`${runId}-${level}-${multi}`} multi={multi} /></JuiceLayer>;
}
