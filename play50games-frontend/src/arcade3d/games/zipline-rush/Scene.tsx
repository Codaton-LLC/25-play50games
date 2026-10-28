"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useRunFrame } from "../../core/useRunFrame";
import { useInput } from "../../core/input";
import { useLevel } from "../../core/level";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { GameIntro, useShellIntro } from "../../core/intro";
import { playSfx, startLoop } from "../../core/audio";
import { JuiceLayer, useJuice, createJuiceEmitter } from "../../menu2/juice";
import { createOrbit } from "../../menu2/camera/orbit";
import { OrbitCamera, OrbitDriver } from "../../menu2/camera/OrbitCamera";
import { SharedCamera } from "../../menu2/multiplayer/SharedCamera";
import { PlayerInputLatch, playerInputFor } from "../../menu2/multiplayer/MultiplayerInput";
import { playersStore, usePlayers } from "../../menu2/multiplayer/players";
import { useAuth } from "@/contexts/AuthContext";
import { cablePoint, createRun, landingZone, step, type ZipRun } from "./rules";
import { pickedHero, subscribeHero } from "./heroes";
import type { ZipLevel } from "./levels";
import { levelEndStats } from "./levelEnd";
import { Course } from "./Course";
import { World } from "./World";
import { Hero } from "./Hero";
import { createMultiRun, stepMulti } from "./multiplayer";
import { GANTRY_X, SEA_Y, TOWER_DZ, stations } from "./layout";
import { BOUNDS, SIZE } from "./assets";
import type { M2HeroId } from "../../menu2/heroModels";
import type { IntroKeyframe } from "../../core/intro/introMachine";
import type { LevelId } from "../../types";

function CourseView({ runs }: { runs: ZipRun[] }) {
   const [focus, setFocus] = useState(0);
   useFrame(() => {
      let next = 0,
         progress = -1;
      runs.forEach((r, i) => {
         if (!r.ended && r.section + r.t > progress) {
            next = i;
            progress = r.section + r.t;
         }
      });
      if (next !== focus) setFocus(next);
   });
   return <Course run={runs[focus]} runs={runs} />;
}

function publish(r: ZipRun) {
   const s = useArcadeStore.getState();
   s.setScore(r.score);
   const stats = {
      speed: Math.round(r.speed * 10),
      section: r.section,
      t: Math.round(r.t * 100),
      orbs: r.orbs,
      chain: r.combo.chain,
      mult: r.combo.multiplier,
      flow: Math.max(0, 1 - (r.ms - r.combo.lastMs) / 3000),
      hp: r.boss?.hp ?? 0,
      bossPhase: r.boss?.phase ?? 0,
      open: r.boss?.step === "vulnerable" ? 1 : 0,
      telegraph: r.boss?.step === "telegraph" ? 1 : 0,
      lane: r.electricLane,
      mode: ["deck", "ride", "air", "bell", "fall"].indexOf(r.mode),
      cooldown: Math.ceil(r.cooldown / 1000),
      hits: r.hits,
      centres: r.centres,
      tuck: r.throttle > 0.25 ? 1 : r.throttle < -0.25 ? -1 : 0,
      finishMs: r.finishMs,
   };
   for (const [k, v] of Object.entries(stats)) if (s.stats[k] !== v) s.setStat(k, v);
}

/** Lens widens with speed: the edge-of-view rush the card asks for (the HUD adds the speed lines). */
function SpeedLens({ run }: { run: ZipRun }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const base = useMemo(() => camera.fov, [camera]);
   useFrame(() => {
      const k = run.mode === "ride" || run.mode === "air" ? Math.max(0, Math.min(1, (run.speed - 9) / 9)) : 0;
      const fov = base + k * 9;
      if (Math.abs(camera.fov - fov) > 0.01) {
         camera.fov += (fov - camera.fov) * 0.08;
         camera.updateProjectionMatrix();
      }
   }, FRAME_PRIORITY.visuals);
   useEffect(
      () => () => {
         camera.fov = base;
         camera.updateProjectionMatrix();
      },
      [camera, base]
   );
   return null;
}

function RunScene({ multi }: { multi: boolean }) {
   const { config } = useLevel<ZipLevel>();
   const id = (config?.id ?? 1) as LevelId;
   const picked = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const phase = useArcadeStore((s) => s.phase);
   const { user } = useAuth();
   // A paused/result pick applies to the NEXT run; ready changes rebuild the intro hero.
   const heroId = phase === "ready" ? picked : undefined;
   const group = useMemo(
      () => (multi ? createMultiRun(id, playersStore.getState().players.map((p) => p.heroId as M2HeroId), playersStore.getState().mode) : null),
      [id, multi]
   );
   const slots = useMemo(() => (multi ? playersStore.getState().players.map((p) => p.index) : []), [group, multi]); // eslint-disable-line react-hooks/exhaustive-deps
   const solo = useMemo(() => createRun(id, heroId ?? pickedHero()), [id, heroId]);
   const r = group?.runs[0] ?? solo;
   const runs = group?.runs ?? [solo];
   const input = useInput();
   const orbit = useMemo(() => createOrbit({ yaw: 0, pitch: 0.34, distance: 10.5, minDistance: 5, maxDistance: 24 }), [id, multi]); // eslint-disable-line react-hooks/exhaustive-deps
   const aspect = useThree((s) => s.size.width / s.size.height);
   const intro = useShellIntro();
   const juice = useJuice();
   const fx = useMemo(() => ({ brake: createJuiceEmitter(), wind: createJuiceEmitter(), tuck: createJuiceEmitter() }), []);
   const hum = useMemo(() => ({ handle: null as ReturnType<typeof startLoop> | null, wind: null as ReturnType<typeof startLoop> | null, beat: -1 }), []);
   const sts = useMemo(() => stations(runs[0].cfg), [runs]);
   useEffect(() => {
      if (phase === "playing") {
         hum.handle = startLoop("hum", { volume: 0 });
         hum.wind = startLoop("slide", { volume: 0 });
      }
      return () => {
         hum.handle?.stop();
         hum.wind?.stop();
         hum.handle = null;
         hum.wind = null;
      };
   }, [phase, hum]);
   useEffect(() => {
      if (multi) playersStore.getState().beginRun();
   }, [multi, group]);
   useRunFrame((_, dt) => {
      if (group) {
         stepMulti(
            group,
            dt * 1000,
            runs.map((_, k) => {
               const i = playerInputFor(slots[k]);
               return { x: i.moveX, throttle: i.moveY, yaw: orbit.viewYaw, jump: i.jumpPressed, power: i.action };
            })
         );
         runs.forEach((run, k) => {
            const p = playersStore.getState().players.find((player) => player.index === slots[k]);
            if (!p) return;
            const s = playersStore.getState();
            s.setPosition(p.index, run.hero.x, run.hero.y, run.hero.z);
            s.update(p.index, { score: run.score, progress: Math.round((run.section + run.t) * run.cfg.length), finished: run.ended === "win", finishMs: run.ended === "win" ? run.finishMs : null });
         });
         if (group.ended) useArcadeStore.getState().end(group.ended);
      } else {
         const i = input.current;
         // the stick's up is brake, down is tuck (rules.ts: throttle > 0 tucks)
         step(r, dt * 1000, { x: i.moveX, throttle: i.moveY, yaw: orbit.viewYaw, jump: i.jumpPressed, power: i.actionPressed });
         publish(r);
         if (r.ended) {
            const s = useArcadeStore.getState();
            for (const [k, v] of Object.entries(levelEndStats(r, user?.id ?? null))) s.setStat(k, v);
            s.end(r.ended);
         }
      }
      for (const run of runs) {
         const ev = run.event;
         const at = run.hero;
         const lead = run === r;
         const cable = { x: at.x, y: at.y + 2.15, z: at.z };
         if (ev.jump && lead) playSfx(ev.hop ? "whoosh" : "jump", { pitch: ev.hop ? 1.35 : 1.15, volume: 0.8 });
         if (ev.hop) {
            juice.burst("trail", cable, 14, { color: "#e0f2fe" });
            juice.kick(-run.vx, 0, 0, 1.2);
         }
         if (ev.pickup) {
            juice.burst("pickup", { x: at.x, y: at.y + 0.9, z: at.z }, 14);
            juice.popup({ x: at.x, y: at.y + 1.9, z: at.z }, `+${30}`, { color: "#a5f3fc", size: 0.05 });
            if (lead) playSfx("pickup", { pitch: 1 + Math.min(run.combo.chain, 6) / 10 });
         }
         if (ev.landed) {
            const zone = landingZone(run.speed);
            juice.burst("dust", at, 26, { vz: run.vz * 0.4 });
            juice.burst("checkpoint", { x: at.x, y: at.y + 0.3, z: at.z }, zone === "centre" ? 30 : 10);
            juice.kick(0, -1, 0, zone === "centre" ? 1.6 : 1);
            juice.hitStop(zone === "centre" ? 70 : 40);
            juice.popup({ x: at.x, y: at.y + 2.3, z: at.z }, zone === "centre" ? "BULLSEYE!" : "Landed", { color: zone === "centre" ? "#86efac" : "#fde68a", size: 0.07 });
            if (lead) playSfx(zone === "centre" ? "combo" : "thud");
         }
         if (ev.hit) {
            juice.burst("hit", { x: at.x, y: at.y + 1, z: at.z }, 24, { color: "#c4b5fd" });
            juice.shake(0.28);
            if (lead) playSfx("zap");
         }
         if (ev.bossHit) {
            juice.burst("hit", at, 40, { color: "#67e8f9" });
            juice.hitStop(120);
            juice.shake(0.4);
            juice.popup({ x: at.x, y: at.y + 2.5, z: at.z }, "HIT!", { color: "#67e8f9", size: 0.09 });
            if (lead) playSfx("boom");
         }
         if (ev.secret) {
            juice.burst("checkpoint", at, 30);
            juice.popup({ x: at.x, y: at.y + 2.6, z: at.z }, "Secret found!", { color: "#fbbf24", size: 0.07 });
            if (lead) playSfx("chime", { pitch: 1.5 });
         }
         if (ev.bell) {
            juice.burst("checkpoint", { x: at.x + 2.6, y: at.y + 2, z: at.z - 3.2 }, 60);
            juice.hitStop(140);
            if (lead) playSfx("win");
         }
         if (ev.power && lead) playSfx("pop", { pitch: 1.3 });
         if (run.mode === "ride") {
            // brake sparks off the pulley, wind streaks at speed, a slipstream while tucked
            if (run.throttle < -0.25 && run.speed > 3) juice.stream("hit", cable, 70, fx.brake, { color: "#fdba74" });
            if (run.speed > 12 && lead) juice.stream("trail", { x: at.x + (Math.random() - 0.5) * 3, y: at.y + 1 + (Math.random() - 0.5) * 2, z: at.z - 4 }, (run.speed - 12) * 7, fx.wind, { color: "#f0f9ff", vz: -run.speed * 0.4 });
            if (run.throttle > 0.25 && lead) juice.stream("trail", { x: at.x, y: at.y + 1.6, z: at.z }, 30, fx.tuck, { color: "#bae6fd" });
         }
      }
      // the trolley hum rises with speed; the wind roars at the top
      const riding = r.mode === "ride";
      hum.handle?.set({ pitch: 0.55 + r.speed / 15, volume: riding ? 0.18 + (r.throttle < -0.25 ? 0.1 : 0) : 0 });
      hum.wind?.set({ pitch: 0.7 + r.speed / 30, volume: riding || r.mode === "air" ? Math.min(0.3, Math.max(0, (r.speed - 6) / 30)) : 0 });
      // original synthesized W2 pentatonic phrase, 112 BPM, through the core mute/pause audio path
      const beat = Math.floor(r.ms / (60_000 / 112));
      if (beat !== hum.beat) {
         hum.beat = beat;
         playSfx("chime", { pitch: [1, 1.122, 1.26, 1.498, 1.26, 1.122, 1, 0.75][beat % 8], volume: r.cfg.boss ? 0.07 : 0.04 });
      }
   });
   const start = sts[0].start!;
   const end = sts[sts.length - 1];
   const playCamera = useMemo<IntroKeyframe>(() => ({ position: [start.x, start.y + 4.9, start.z + 8.8], lookAt: [start.x, start.y + 1.2, start.z - 1] }), [start]);
   const shots = useMemo<IntroKeyframe[]>(() => {
      const mid = sts[Math.floor(sts.length / 2)];
      return [
         { position: [26, end.landY + 18, end.cz - 30], lookAt: [0, end.landY, end.cz] },
         { position: [-24, mid.startY + 10, mid.cz + 10], lookAt: [0, mid.startY - 2, mid.cz - 20] },
         { position: [14, start.y + 6, start.z - 14], lookAt: [start.x, start.y + 1, start.z] },
      ];
   }, [sts, start, end]);
   const solids = (out: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }[]) => {
      let n = 0;
      const towerH = SIZE.tower;
      const half = (BOUNDS.tower.x * SIZE.tower) / BOUNDS.tower.y / 2;
      for (const st of sts) {
         if (n + 3 > out.length) break;
         // the rock stack (to the floor) and the two gantry towers
         Object.assign(out[n].min, { x: st.cx - st.rx * 0.85, y: SEA_Y, z: st.cz - st.rz * 0.85 });
         Object.assign(out[n].max, { x: st.cx + st.rx * 0.85, y: Math.min(st.startY, st.landY) - 0.3, z: st.cz + st.rz * 0.85 });
         n++;
         if (!st.start) continue;
         for (const side of [-1, 1]) {
            Object.assign(out[n].min, { x: side * GANTRY_X - half, y: st.startY, z: st.start.z + TOWER_DZ - half });
            Object.assign(out[n].max, { x: side * GANTRY_X + half, y: st.startY + towerH, z: st.start.z + TOWER_DZ + half });
            n++;
         }
      }
      return n;
   };
   return (
      <>
         {multi && <PlayerInputLatch />}
         <World level={id} />
         <CourseView key={id} runs={runs} />
         {runs.map((run, k) => (
            <Hero key={k} run={run} intro={intro?.session && !intro.ready && !multi ? intro.hero : undefined} />
         ))}
         <SpeedLens run={r} />
         {multi ? (
            <>
               <OrbitDriver orbit={orbit} />
               <SharedCamera points={runs.map((run) => run.hero)} orbit={orbit} minSpan={9} maxSpan={90} padding={3} />
            </>
         ) : (
            <OrbitCamera
               orbit={orbit}
               pivot={(out) => {
                  // look a little down the line, so the next landing reads early
                  const ahead = r.mode === "ride" ? cablePoint(r.cfg, r.section, r.lane, Math.min(1, r.t + 0.06)) : null;
                  Object.assign(out, { x: ahead ? (r.hero.x * 2 + ahead.x) / 3 : r.hero.x, y: r.hero.y + 1.2, z: ahead ? (r.hero.z * 2 + ahead.z) / 3 : r.hero.z - 1 });
               }}
               travel={(out) => {
                  out.x = r.vx;
                  out.z = r.vz;
               }}
               distanceScale={aspect < 1 ? 1.4 : 1}
               solids={solids}
            />
         )}
         {intro?.session && !multi && <GameIntro session={intro.session} keyframes={shots} playCamera={playCamera} hero={intro.hero} />}
      </>
   );
}
export default function Scene() {
   const runId = useArcadeStore((s) => s.runId),
      level = useArcadeStore((s) => s.levelId);
   const multi = usePlayers((s) => s.phase === "playing");
   return (
      <JuiceLayer>
         <RunScene key={`${runId}-${level}-${multi}`} multi={multi} />
      </JuiceLayer>
   );
}
