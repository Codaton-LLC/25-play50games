"use client";

// Magnet Coin Lab's scene: one World (rules.ts) stepped at 120 Hz by useRunFrame for 1 hero (solo) or
// 2-4 (local multiplayer, the same rooms), drawn by Rooms / Coins / Magnus / Hero in the workshop hall
// (World); the free orbit camera (menu2/camera) faces the room; juice and sound on every flip, launch,
// pull, bank, steal and hit.
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useThree } from "@react-three/fiber";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useRunFrame } from "../../core/useRunFrame";
import { useInput } from "../../core/input";
import { useLevel } from "../../core/level";
import { GameIntro, useShellIntro } from "../../core/intro";
import { playSfx, startLoop } from "../../core/audio";
import { JuiceLayer, useJuice } from "../../menu2/juice";
import { createOrbit } from "../../menu2/camera/orbit";
import { OrbitCamera, OrbitDriver } from "../../menu2/camera/OrbitCamera";
import { SharedCamera } from "../../menu2/multiplayer/SharedCamera";
import { PlayerInputLatch, playerInputFor } from "../../menu2/multiplayer/MultiplayerInput";
import { playersStore, usePlayers } from "../../menu2/multiplayer/players";
import { useAuth } from "@/contexts/AuthContext";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { M2HeroId } from "../../menu2/heroModels";
import type { IntroKeyframe } from "../../core/intro/introMachine";
import type { LevelId } from "../../types";
import { STAT, createWorld, stepWorld, submittedMs, type StepInput, type World as RunWorld } from "./rules";
import { botInput } from "./bot";
import { coachFor } from "./coach";
import { pickedHero, subscribeHero } from "./heroes";
import type { LabLevel } from "./levels";
import { levelEndStats } from "./levelEnd";
import { POLE } from "./look";
import { Rooms } from "./Room";
import { Coins } from "./Coins";
import { Magnus } from "./Magnus";
import { Hero } from "./Hero";
import { World } from "./World";
import { roomX } from "./space";

/** Preview builds only: `?autoplay=1` lets the honest bot (bot.ts, the proofs' bot) play, for screenshots. */
function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

/** The camera's distance on a portrait phone, relative to landscape (a room is wide). */
export const PORTRAIT_DISTANCE = 1.45;

function publish(w: RunWorld, k: number, roomMs: number) {
   const h = w.heroes[k];
   const room = w.rooms[h.room];
   const m = w.magnus;
   const s = useArcadeStore.getState();
   const stats: Record<string, number> = {
      [STAT.orbs]: h.orbs,
      [STAT.comboMs]: Math.round(h.comboMs),
      [STAT.comboChain]: h.combo.chain,
      [STAT.comboMult]: Math.round(h.combo.multiplier * 100),
      [STAT.comboFlow]: Math.round(Math.max(0, 1 - (w.ms - h.combo.lastMs) / 2500) * 10),
      [STAT.room]: h.room,
      [STAT.banked]: room.banked,
      [STAT.need]: room.def.need,
      [STAT.swarm]: h.swarm,
      [STAT.sign]: h.sign,
      [STAT.power]: Math.ceil(h.cooldown / 1000),
      [STAT.lost]: h.lost,
      [STAT.hits]: h.hits,
      [STAT.coach]: coachFor(w, h, roomMs),
      [STAT.bossHp]: m ? m.state.hp : 0,
      [STAT.bossPhase]: m ? m.state.phase : 0,
      [STAT.bossOpen]: m && m.state.step === "vulnerable" ? 1 : 0,
      [STAT.bossFlash]: m && m.state.flashMs > 0 ? 1 : 0,
      [STAT.bossSign]: m ? m.sign : 1,
      [STAT.boss]: m && m.active && room.def.boss ? 1 : 0,
   };
   for (const [key, v] of Object.entries(stats)) if (s.stats[key] !== v) s.setStat(key, v);
}

function RunScene({ multi }: { multi: boolean }) {
   const { config } = useLevel<LabLevel>();
   const id = (config?.id ?? 1) as LevelId;
   const picked = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const phase = useArcadeStore((s) => s.phase);
   const { user } = useAuth();
   const heroId = phase === "ready" ? picked : undefined;
   const slots = useMemo(() => (multi ? playersStore.getState().players.map((p) => p.index) : []), [multi]);
   const world = useMemo(
      () => (multi ? createWorld(id, playersStore.getState().players.map((p) => p.heroId as M2HeroId)) : createWorld(id, [heroId ?? pickedHero()])),
      [id, multi, heroId]
   );
   const input = useInput();
   const autoplay = useMemo(autoplayRequested, []);
   const orbit = useMemo(() => createOrbit({ yaw: 0, pitch: 0.12, distance: 14, minDistance: 6, maxDistance: 30 }), [id, multi]); // eslint-disable-line react-hooks/exhaustive-deps
   const aspect = useThree((s) => s.size.width / s.size.height);
   const intro = useShellIntro();
   const juice = useJuice();
   const audio = useMemo(() => ({ hum: null as ReturnType<typeof startLoop> | null, beat: -1, ended: false, room: 0, roomAt: 0 }), []);
   useEffect(() => {
      if (phase === "playing") audio.hum = startLoop("hum", { volume: 0 });
      return () => {
         audio.hum?.stop();
         audio.hum = null;
      };
   }, [phase, audio]);
   useEffect(() => {
      if (multi) playersStore.getState().beginRun();
   }, [multi, world]);
   const inputs = useMemo<StepInput[]>(() => world.heroes.map(() => ({ x: 0, y: 0, yaw: 0, jump: false, action: false })), [world]);
   const lead = useRef({ x: 0, y: 0 });
   useRunFrame((_, dt) => {
      if (multi) {
         world.heroes.forEach((_h, k) => {
            const i = playerInputFor(slots[k]);
            Object.assign(inputs[k], { x: i.moveX, y: i.moveY, yaw: orbit.viewYaw, jump: i.jumpPressed, action: i.action });
         });
      } else if (autoplay) {
         Object.assign(inputs[0], botInput(world, 0));
      } else {
         const i = input.current;
         Object.assign(inputs[0], { x: i.moveX, y: i.moveY, yaw: orbit.viewYaw, jump: i.jumpPressed, action: i.action });
      }
      stepWorld(world, dt * 1000, inputs);
      const s = useArcadeStore.getState();
      const h0 = world.heroes[0];
      if (h0.room !== audio.room) {
         audio.room = h0.room;
         audio.roomAt = world.ms;
      }
      if (multi) {
         world.heroes.forEach((h, k) => {
            const p = playersStore.getState().players.find((pl) => pl.index === slots[k]);
            if (!p) return;
            const ps = playersStore.getState();
            ps.setPosition(p.index, roomX(h.room) + h.x, h.y, 0);
            ps.update(p.index, { score: h.banked, progress: h.room, finished: h.ended === "win", finishMs: h.ended === "win" ? h.finishMs : null });
         });
         const finished = world.heroes.filter((h) => h.ended === "win");
         const mode = playersStore.getState().mode;
         const done = mode === "coop" ? world.heroes.every((h) => h.ended) : finished.length > 0 && (finished.length === world.heroes.length || world.ms - Math.min(...finished.map((h) => h.finishMs)) > 20_000);
         if ((done || world.ended) && !audio.ended) {
            audio.ended = true;
            s.end(finished.length ? "win" : "timeup");
         }
      } else {
         publish(world, 0, world.ms - audio.roomAt);
         if (h0.ended && !audio.ended) {
            audio.ended = true;
            if (h0.ended === "win") {
               s.setStat(STAT.finishMs, h0.finishMs);
               for (const [k, v] of Object.entries(levelEndStats(world, h0, user?.id ?? null))) s.setStat(k, v);
               s.setScore(Math.max(0, Math.floor((world.cfg.durationMs - submittedMs(h0)) / 10)));
            }
            s.end(h0.ended);
         }
      }
      fx(world, juice);
      // the lab hum rises with the swarm; a light four-beat music box under it
      audio.hum?.set({ pitch: 0.7 + Math.min(h0.swarm, 20) * 0.02 + (h0.pulled ? 0.25 : 0), volume: 0.04 + Math.min(h0.swarm, 20) * 0.003 + (h0.pulled ? 0.05 : 0) });
      const beat = Math.floor(world.ms / (60_000 / 116));
      if (beat !== audio.beat) {
         audio.beat = beat;
         const bar = beat % 8;
         playSfx("click", { pitch: [1.0, 1.26, 1.5, 1.26, 1.12, 1.33, 1.68, 1.33][bar], volume: world.magnus?.active && world.rooms[h0.room].def.boss ? 0.08 : 0.045 });
      }
   });
   const start = world.rooms[0].def.start;
   const sx = roomX(0) + start.x;
   const sy = start.y;
   const playCamera = useMemo<IntroKeyframe>(() => ({ position: [sx, sy + 1.2 + 14 * Math.sin(0.12), 14 * Math.cos(0.12)], lookAt: [sx, sy + 1.2, 0] }), [sx, sy]);
   const shots = useMemo<IntroKeyframe[]>(() => {
      const d = world.rooms[0].def;
      const bx = roomX(0) + d.bank.x;
      return [
         { position: [bx + 3, 4, 9], lookAt: [bx, 1.5, 0] },
         { position: [12, 5, 24], lookAt: [12, 5, 0] },
         { position: [sx + 6, 4, 12], lookAt: [sx, 1.5, 0] },
      ];
   }, [world, sx]);
   const firstHero = world.heroes[0];
   return (
      <>
         {multi && <PlayerInputLatch />}
         <World world={world} />
         <Rooms world={world} />
         <Coins world={world} />
         <Magnus world={world} />
         {world.heroes.map((h, k) => (
            <Hero key={k} world={world} hero={h} intro={intro?.session && !intro.ready && !multi ? intro.hero : undefined} />
         ))}
         {multi ? (
            <>
               <OrbitDriver orbit={orbit} />
               <SharedCamera points={world.heroes.map((h) => ({ x: roomX(h.room) + h.x, y: h.y + 1, z: 0 }))} orbit={orbit} minSpan={12} maxSpan={70} padding={3} />
            </>
         ) : (
            <OrbitCamera
               orbit={orbit}
               pivot={(out) => {
                  // the hero, eased a little towards the room's middle so the bank and the door stay in view
                  const h = firstHero;
                  const d = world.rooms[h.room].def;
                  const l = lead.current;
                  l.x += (h.vx * 0.25 - l.x) * 0.05;
                  l.y += (h.vy * 0.08 - l.y) * 0.05;
                  const x = h.x + l.x + (d.w / 2 - h.x) * 0.25;
                  Object.assign(out, { x: roomX(h.room) + Math.max(4, Math.min(d.w - 4, x)), y: Math.max(3, Math.min(d.h - 3, h.y + 1.6 + l.y)), z: 0 });
               }}
               // a room is read face-on: the auto-follow (2.5 s after a manual turn) and the recenter
               // button both swing the camera back in front of it
               travel={(out) => {
                  out.x = 0;
                  out.z = -4;
               }}
               behind={() => 0}
               distanceScale={aspect < 1 ? PORTRAIT_DISTANCE : 1}
            />
         )}
         {intro?.session && !multi && <GameIntro session={intro.session} keyframes={shots} playCamera={playCamera} hero={intro.hero} />}
      </>
   );
}

/** Juice and sound from the step's events. */
function fx(w: RunWorld, juice: ReturnType<typeof useJuice>) {
   const e = w.ev;
   w.heroes.forEach((h, k) => {
      const at = { x: roomX(h.room) + h.x, y: h.y + 0.7, z: 0.4 };
      const lead = k === 0;
      const ev = h.ev;
      if (ev.flip) {
         juice.burst("aura", at, 14, { color: h.sign > 0 ? POLE.plusGlow : POLE.minusGlow });
         if (lead) playSfx("zap", { pitch: h.sign > 0 ? 1.25 : 0.85, volume: 0.45 });
      }
      if (ev.pickup && lead) playSfx("pickup", { pitch: 1 + Math.min(h.swarm, 24) * 0.035, volume: 0.35 });
      if (ev.launch) {
         juice.burst("dust", { x: at.x, y: h.y, z: 0.3 }, 18, { color: "#e7e5e4" });
         juice.burst("checkpoint", { x: at.x, y: h.y + 0.1, z: 0.3 }, 16, { color: h.sign > 0 ? POLE.plusGlow : POLE.minusGlow });
         juice.kick(0, -1, 0, 2.2);
         juice.shake(0.18);
         if (lead) playSfx("boom", { pitch: 1.3, volume: 0.55 });
      }
      if (ev.latch && lead) playSfx("thud", { pitch: 1.4, volume: 0.4 });
      if (ev.jump && lead) playSfx("jump", { volume: 0.55 });
      if (ev.land && ev.landSpeed > 12) juice.burst("dust", { x: at.x, y: h.y, z: 0.2 }, 10, { color: "#e7e5e4" });
      if (ev.orb) {
         juice.burst("pickup", at, 16, { color: "#f9a8d4" });
         juice.popup({ x: at.x, y: at.y + 1, z: at.z }, "-0.4 s", { color: "#fbcfe8", size: 0.05 });
         if (lead) playSfx("chime", { pitch: 1 + Math.min(h.combo.chain, 6) / 10 });
      }
      if (ev.bank) {
         juice.burst("pickup", { x: roomX(h.room) + w.rooms[h.room].def.bank.x, y: w.rooms[h.room].def.bank.y + 1.4, z: 0.4 }, 6 + ev.bank * 2, { color: "#fde68a" });
         if (lead) playSfx("pickup", { pitch: 1.6 + Math.min(w.rooms[h.room].banked, 12) * 0.04, volume: 0.5 });
      }
      if (ev.secret) {
         juice.burst("checkpoint", at, 32);
         juice.popup({ x: at.x, y: at.y + 1.6, z: at.z }, "Secret found!", { color: "#fbbf24", size: 0.07 });
         if (lead) playSfx("chime", { pitch: 1.6 });
      }
      if (ev.scatter) juice.burst("hit", at, 16, { color: "#e2e8f0" });
      if (ev.hit) {
         juice.burst("hit", at, 22, { color: "#fde047" });
         juice.shake(0.3);
         if (lead) playSfx("hit");
      }
      if (ev.fell) {
         juice.burst("dust", at, 30, { color: "#cbd5e1" });
         if (lead) playSfx("pop", { pitch: 0.7 });
      }
      if (ev.power) {
         juice.burst("aura", at, 24, { color: h.heroId === "zuno" ? "#fde047" : h.heroId === "kiro" ? "#86efac" : h.heroId === "vexa" ? "#c4b5fd" : "#fca5a5" });
         if (lead) playSfx("whoosh", { pitch: 1.2 });
      }
      if (ev.room) {
         juice.burst("checkpoint", at, 30, { color: "#fde68a" });
         if (lead) playSfx("chime", { pitch: 1.3 });
      }
      if (ev.bossHit) juice.popup({ x: at.x, y: at.y + 1.6, z: at.z }, "Core hit!", { color: "#fde047", size: 0.07 });
      if (ev.won) {
         juice.burst("checkpoint", at, 50);
         if (lead) playSfx("win");
      }
   });
   if (e.door) playSfx("combo", { pitch: 1.1, volume: 0.6 });
   if (e.lost) playSfx("buzz", { pitch: 0.6, volume: 0.25 });
   if (e.vent) {
      juice.shake(0.2);
      playSfx("boom", { pitch: 0.7, volume: 0.5 });
   }
   if (e.crack) playSfx("splash", { pitch: 1.8, volume: 0.5 });
   if (e.droneSteal) playSfx("buzz", { pitch: 1.4, volume: 0.35 });
   if (e.droneRepel) {
      juice.shake(0.12);
      playSfx("zap", { pitch: 1.5, volume: 0.5 });
   }
   if (e.bossFlip) playSfx("zap", { pitch: 0.6, volume: 0.35 });
   if (e.bossTelegraph) playSfx("alarm", { pitch: 0.7, volume: 0.4 });
   if (e.bossAttack) juice.shake(0.35);
   if (e.throwBlock) playSfx("whoosh", { pitch: 0.7 });
   if (e.bossHit) {
      juice.hitStop(130);
      juice.shake(0.5);
      playSfx("boom", { pitch: 0.9 });
   }
   if (e.bossDefeated) {
      juice.shake(0.6);
      playSfx("win");
   }
}

export default function Scene() {
   const runId = useArcadeStore((s) => s.runId);
   const level = useArcadeStore((s) => s.levelId);
   const multi = usePlayers((s) => s.phase === "playing");
   return (
      <JuiceLayer>
         <RunScene key={`${runId}-${level}-${multi}`} multi={multi} />
      </JuiceLayer>
   );
}
