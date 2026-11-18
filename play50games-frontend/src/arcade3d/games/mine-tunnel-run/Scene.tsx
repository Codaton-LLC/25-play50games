"use client";

// Mine Tunnel Run's scene: one World (rules.ts) stepped at 120 Hz by useRunFrame for 1 hero (solo) or
// 2-4 (local multiplayer, the same mine), drawn by Grid / Props / Boss / Hero around the World set;
// the free orbit camera (menu2/camera) faces the cross-section; juice and sound on every dig, drop and hit.
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
import { CELL, STAT, T, createWorld, stepWorld, type StepInput, type World as RunWorld } from "./rules";
import { botInput } from "./bot";
import { coachFor } from "./coach";
import { pickedHero, subscribeHero } from "./heroes";
import type { MineLevel } from "./levels";
import { levelEndStats } from "./levelEnd";
import { lookFor } from "./look";
import { Grid } from "./Grid";
import { Props } from "./Props";
import { Boss } from "./Boss";
import { Hero } from "./Hero";
import { World } from "./World";
import { cellX, cellY, floorY } from "./space";

/** Preview builds only: `?autoplay=1` lets the honest bot (bot.ts, the proofs' bot) dig, for screenshots. */
function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

/** The camera's distance on a portrait phone, relative to landscape (the cross-section is wide). */
export const PORTRAIT_DISTANCE = 1.25;

const TILE_DUST: Record<number, string> = { [T.SOFT]: "#b08458", [T.PACKED]: "#7a5a40", [T.ORE]: "#ff5533", [T.GAS]: "#a3e635", [T.CRACKED]: "#ff8a3d" };

function publish(w: RunWorld, k: number) {
   const h = w.heroes[k];
   const s = useArcadeStore.getState();
   const stats: Record<string, number> = {
      [STAT.orbs]: h.orbs,
      [STAT.comboMs]: Math.round(h.comboMs),
      [STAT.comboChain]: h.combo.chain,
      [STAT.comboMult]: Math.round(h.combo.multiplier * 100),
      [STAT.comboFlow]: Math.round(Math.max(0, 1 - (w.ms - h.combo.lastMs) / 2500) * 10),
      [STAT.depth]: Math.max(0, Math.round(h.row * CELL)),
      [STAT.power]: Math.ceil(h.cooldown / 1000),
      [STAT.hits]: h.hits,
      [STAT.coach]: coachFor(w, h),
      [STAT.bossHp]: w.boss ? w.boss.state.hp : 0,
      [STAT.bossPhase]: w.boss ? w.boss.state.phase : 0,
      [STAT.bossOpen]: w.boss && w.boss.state.step === "vulnerable" ? 1 : 0,
      [STAT.bossFlash]: w.boss && w.boss.state.flashMs > 0 ? 1 : 0,
      boss: w.boss && w.boss.active ? 1 : 0,
      rock: w.cfg.rockfall ? Math.max(0, Math.ceil((w.cfg.rockfall.startMs - w.ms) / 1000)) : -1,
   };
   for (const [key, v] of Object.entries(stats)) if (s.stats[key] !== v) s.setStat(key, v);
}

function RunScene({ multi }: { multi: boolean }) {
   const { config } = useLevel<MineLevel>();
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
   const orbit = useMemo(() => createOrbit({ yaw: 0, pitch: 0.1, distance: 13, minDistance: 6, maxDistance: 28 }), [id, multi]); // eslint-disable-line react-hooks/exhaustive-deps
   const aspect = useThree((s) => s.size.width / s.size.height);
   const intro = useShellIntro();
   const juice = useJuice();
   const focus = useRef(world.map.start.row);
   const look = lookFor(id);
   const audio = useMemo(() => ({ hum: null as ReturnType<typeof startLoop> | null, beat: -1, ended: false }), []);
   useEffect(() => {
      if (phase === "playing") audio.hum = startLoop("rotor", { volume: 0 });
      return () => {
         audio.hum?.stop();
         audio.hum = null;
      };
   }, [phase, audio]);
   useEffect(() => {
      if (multi) playersStore.getState().beginRun();
   }, [multi, world]);
   const inputs = useMemo<StepInput[]>(() => world.heroes.map(() => ({ x: 0, y: 0, yaw: 0, jump: false, power: false })), [world]);
   useRunFrame((_, dt) => {
      if (multi) {
         world.heroes.forEach((_h, k) => {
            const i = playerInputFor(slots[k]);
            Object.assign(inputs[k], { x: i.moveX, y: i.moveY, yaw: orbit.viewYaw, jump: i.jumpPressed, power: i.actionPressed });
         });
      } else if (autoplay) {
         Object.assign(inputs[0], botInput(world, 0));
      } else {
         const i = input.current;
         Object.assign(inputs[0], { x: i.moveX, y: i.moveY, yaw: orbit.viewYaw, jump: i.jumpPressed, power: i.actionPressed });
      }
      stepWorld(world, dt * 1000, inputs);
      // the focus row the cells, props and lights are drawn around
      let fr = 0;
      let n = 0;
      for (const h of world.heroes) if (!h.ended || h.ended === "win") {
         fr += h.py;
         n++;
      }
      focus.current = n ? fr / n : world.map.lift.row;
      const s = useArcadeStore.getState();
      if (multi) {
         world.heroes.forEach((h, k) => {
            const p = playersStore.getState().players.find((pl) => pl.index === slots[k]);
            if (!p) return;
            const ps = playersStore.getState();
            ps.setPosition(p.index, cellX(world.w, h.px), floorY(h.py), 0);
            ps.update(p.index, { score: Math.round(h.row * CELL), progress: Math.round(h.row * CELL), finished: h.ended === "win", finishMs: h.ended === "win" ? h.finishMs : null });
         });
         const finished = world.heroes.filter((h) => h.ended === "win");
         const mode = playersStore.getState().mode;
         const done = mode === "coop" ? world.heroes.every((h) => h.ended) : finished.length > 0 && (finished.length === world.heroes.length || world.ms - Math.min(...finished.map((h) => h.finishMs)) > 20_000);
         if ((done || world.ended) && !audio.ended) {
            audio.ended = true;
            s.end(finished.length ? "win" : "timeup");
         }
      } else {
         publish(world, 0);
         const h = world.heroes[0];
         if (h.ended && !audio.ended) {
            audio.ended = true;
            if (h.ended === "win") {
               s.setStat(STAT.finishMs, h.finishMs);
               for (const [k, v] of Object.entries(levelEndStats(world, h, user?.id ?? null))) s.setStat(k, v);
               s.setScore(Math.max(0, Math.floor((world.cfg.durationMs - Math.max(0, h.finishMs - h.orbs * 400 - h.comboMs)) / 10)));
            }
            s.end(h.ended);
         }
      }
      fx(world, juice, look.dust);
      // the dig drone (the trolley-like hum of the hero's work) and the four-bar riff of W1
      const h0 = world.heroes[0];
      audio.hum?.set({ pitch: 0.6 + (h0.act === "dig" ? 0.25 : 0) + (h0.rolling ? 0.2 : 0), volume: h0.act === "dig" ? 0.12 : 0.03 });
      const beat = Math.floor(world.ms / (60_000 / 128));
      if (beat !== audio.beat) {
         audio.beat = beat;
         const bar = beat % 8;
         playSfx("click", { pitch: [0.55, 0.7, 0.55, 0.82, 0.55, 0.7, 0.62, 0.9][bar], volume: world.boss?.active ? 0.09 : 0.05 });
         if (bar === 0 || bar === 4) playSfx("thud", { pitch: 0.5, volume: 0.06 });
      }
   });
   const start = world.map.start;
   const sx = cellX(world.w, start.col);
   const sy = floorY(start.row);
   const playCamera = useMemo<IntroKeyframe>(() => ({ position: [sx, sy + 1.2 + 13 * Math.sin(0.1) - 1.2, 13 * Math.cos(0.1)], lookAt: [sx, sy, 0] }), [sx, sy]);
   const shots = useMemo<IntroKeyframe[]>(() => {
      const lx = cellX(world.w, world.map.lift.col);
      const ly = cellY(world.map.lift.row);
      return [
         { position: [lx + 4, ly + 2, 16], lookAt: [lx, ly, 0] },
         { position: [0, (ly + sy) / 2, 34], lookAt: [0, (ly + sy) / 2 + 6, 0] },
         { position: [sx + 10, sy + 6, 18], lookAt: [sx, sy + 1, 0] },
      ];
   }, [world, sx, sy]);
   const firstHero = world.heroes[0];
   return (
      <>
         {multi && <PlayerInputLatch />}
         <World world={world} />
         <Grid world={world} focusRow={focus} />
         <Props world={world} focus={focus} />
         <Boss world={world} />
         {world.heroes.map((h, k) => (
            <Hero key={k} world={world} hero={h} intro={intro?.session && !intro.ready && !multi ? intro.hero : undefined} />
         ))}
         {multi ? (
            <>
               <OrbitDriver orbit={orbit} />
               <SharedCamera points={world.heroes.map((h) => ({ x: cellX(world.w, h.px), y: floorY(h.py), z: 0 }))} orbit={orbit} minSpan={10} maxSpan={60} padding={3} />
            </>
         ) : (
            <OrbitCamera
               orbit={orbit}
               pivot={(out) => {
                  // a little below the hero: the way is down
                  Object.assign(out, { x: cellX(world.w, firstHero.px), y: floorY(firstHero.py) - 0.8, z: 0 });
               }}
               // the cross-section is read face-on: the auto-follow (2.5 s after a manual turn) and the
               // recenter button both swing the camera back in front of the slab
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
function fx(w: RunWorld, juice: ReturnType<typeof useJuice>, dust: string) {
   const e = w.ev;
   w.heroes.forEach((h, k) => {
      const at = { x: cellX(w.w, h.px), y: floorY(h.py) + 0.7, z: 0.4 };
      const lead = k === 0;
      const ev = h.ev;
      if (ev.dig) {
         const c = h.dc;
         const r = h.dr;
         const cell = { x: cellX(w.w, c), y: cellY(r), z: 0.6 };
         juice.burst("dust", cell, 14, { color: TILE_DUST[ev.digTile] ?? dust });
         juice.burst("hit", cell, 5, { color: TILE_DUST[ev.digTile] ?? dust, size: 0.6 });
         if (lead) playSfx("thud", { pitch: ev.digTile === T.SOFT ? 1.3 : 0.95, volume: 0.35 });
      }
      if (ev.orb) {
         juice.burst("pickup", at, 16, { color: "#ff6a3d" });
         juice.popup({ x: at.x, y: at.y + 1, z: at.z }, "-0.4 s", { color: "#fca5a5", size: 0.05 });
         if (lead) playSfx("pickup", { pitch: 1 + Math.min(h.combo.chain, 6) / 10 });
      }
      if (ev.hop && lead) playSfx("jump", { volume: 0.6 });
      if (ev.airJump && lead) playSfx("whoosh", { pitch: 1.4 });
      if (ev.land && ev.landSpeed > 10) juice.burst("dust", { x: at.x, y: at.y - 0.6, z: 0 }, 10, { color: dust });
      if (ev.lantern) {
         juice.burst("checkpoint", at, 24, { color: "#ffb347" });
         juice.popup({ x: at.x, y: at.y + 1.3, z: at.z }, "Checkpoint", { color: "#fde68a", size: 0.06 });
         if (lead) playSfx("chime", { pitch: 1.2 });
      }
      if (ev.secret) {
         juice.burst("checkpoint", at, 32);
         juice.popup({ x: at.x, y: at.y + 1.6, z: at.z }, "Secret found!", { color: "#fbbf24", size: 0.07 });
         if (lead) playSfx("chime", { pitch: 1.6 });
      }
      if (ev.hit) {
         juice.burst("hit", at, 22, { color: "#fca5a5" });
         juice.shake(0.3);
         if (lead) playSfx("hit");
      }
      if (ev.died) {
         juice.burst("dust", at, 40, { color: dust });
         juice.hitStop(90);
      }
      if (ev.respawn && lead) playSfx("pop", { pitch: 0.8 });
      if (ev.dash) {
         juice.burst("trail", at, 20, { color: "#f87171" });
         if (lead) playSfx("whoosh", { pitch: 1.1 });
      }
      if (ev.power && !ev.dash && lead) playSfx("pop", { pitch: 1.3 });
      if (ev.crushBeetle) {
         juice.popup({ x: at.x, y: at.y + 1.4, z: at.z }, "Crushed!", { color: "#a7f3d0", size: 0.07 });
         if (lead) playSfx("combo");
      }
      if (ev.ride && lead) playSfx("whoosh", { pitch: 0.8 });
      if (ev.won) {
         juice.burst("checkpoint", at, 50);
         if (lead) playSfx("win");
      }
   });
   if (e.wobble) {
      juice.shake(0.08);
      playSfx("buzz", { pitch: 0.4, volume: 0.3 });
      juice.burst("dust", { x: cellX(w.w, e.wobbleCol), y: cellY(e.wobbleRow) - 0.6, z: 0.5 }, 8, { color: dust });
   }
   if (e.boulderLand) {
      juice.shake(0.32);
      juice.kick(0, -1, 0, 1.4);
      juice.burst("dust", { x: cellX(w.w, e.landCol), y: floorY(e.landRow) + 0.2, z: 0.5 }, 30, { color: dust });
      playSfx("boom", { pitch: 0.7, volume: 0.7 });
   }
   if (e.crack) playSfx("thud", { pitch: 0.6 });
   if (e.flood) playSfx("splash", { volume: 0.4 });
   if (e.rockfall) {
      juice.shake(0.2);
      playSfx("boom", { pitch: 0.45, volume: 0.5 });
   }
   if (e.bossTelegraph) playSfx("alarm", { pitch: 0.6, volume: 0.4 });
   if (e.bossAttack) juice.shake(0.35);
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
