"use client";

// Color Bridge Builder's scene: one World (rules.ts) stepped at 120 Hz by useRunFrame for 1 team (solo)
// or 2-4 (local multiplayer: a bridge crew on the same canyon, any player works any switch), drawn by
// Board / TeamHero / Keeper over the abyss. The orbit camera looks down the canyon from high behind the
// hero (the far side is "north"); juice and sound on every switch, prism turn, tag, fall and Keeper hit.
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useThree } from "@react-three/fiber";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useRunFrame } from "../../core/useRunFrame";
import { useInput } from "../../core/input";
import { useLevel } from "../../core/level";
import { inputToWorld } from "../../core/math";
import { GameIntro, useShellIntro } from "../../core/intro";
import { playSfx, startLoop } from "../../core/audio";
import { JuiceLayer, useJuice } from "../../menu2/juice";
import { createOrbit } from "../../menu2/camera/orbit";
import { OrbitCamera, OrbitDriver } from "../../menu2/camera/OrbitCamera";
import { SharedCamera } from "../../menu2/multiplayer/SharedCamera";
import { PlayerInputLatch, playerInputFor } from "../../menu2/multiplayer/MultiplayerInput";
import { playersStore, usePlayers } from "../../menu2/multiplayer/players";
import { M2_HERO_IDS, type M2HeroId } from "../../menu2/heroModels";
import { useAuth } from "@/contexts/AuthContext";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { IntroKeyframe } from "../../core/intro/introMachine";
import type { LevelId } from "../../types";
import { CELL, DC, DR, T } from "./levels";
import { STAT, createWorld, idleInput, plateColor, stepWorld, submittedMs, tileAt, type StepInput, type World as RunWorld } from "./rules";
import { botInput } from "./bot";
import { coachFor } from "./coach";
import { pickedHero, subscribeHero } from "./heroes";
import type { BridgeLevel } from "./levels";
import { levelEndStats } from "./levelEnd";
import { Board, cellPos } from "./Board";
import { TeamHero } from "./Heroes3D";
import { Keeper } from "./Keeper";
import { MASK_COLOR, lookFor } from "./look";

const DEG = Math.PI / 180;

/** Preview builds only: `?autoplay=1` lets the honest bot (bot.ts, the proofs' bot) play, for screenshots. */
function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

const W2 = { x: 0, z: 0 };
/** The core input -> StepInput: the stick / keys (camera-relative) give one of four steps; Jump tags; Action is the power. */
export function mapInput(i: { moveX: number; moveY: number; jumpPressed: boolean; actionPressed: boolean }, yaw: number, out: StepInput): StepInput {
   inputToWorld(i.moveX, i.moveY, yaw, W2);
   out.dr = 0;
   out.dc = 0;
   if (Math.hypot(W2.x, W2.z) > 0.35) {
      if (Math.abs(W2.x) > Math.abs(W2.z)) out.dc = Math.sign(W2.x);
      else out.dr = Math.sign(W2.z);
   }
   out.tag = i.jumpPressed ? -1 : 0;
   out.action = i.actionPressed;
   return out;
}

function publish(w: RunWorld) {
   const t = w.teams[0];
   const k = w.keeper;
   const s = useArcadeStore.getState();
   const under = tileAt(w, t.r, t.c) === T.CHASM ? w.bridge[t.r * w.map.w + t.c] : 0;
   const ar = t.r + DR[t.facing];
   const ac = t.c + DC[t.facing];
   const ahead = tileAt(w, ar, ac) === T.CHASM ? w.bridge[ar * w.map.w + ac] : 0;
   const stats: Record<string, number> = {
      [STAT.orbs]: t.orbs,
      [STAT.comboMs]: Math.round(t.comboMs),
      [STAT.comboChain]: t.combo.chain,
      [STAT.comboMult]: Math.round(t.combo.multiplier * 100),
      [STAT.comboFlow]: Math.round(Math.max(0, 1 - (w.ms - t.combo.lastMs) / 3000) * 10),
      [STAT.hero]: M2_HERO_IDS.indexOf(t.heroId),
      [STAT.under]: under,
      [STAT.ahead]: ahead,
      [STAT.power]: Math.ceil(t.cooldown / 1000),
      [STAT.falls]: t.falls,
      [STAT.coach]: coachFor(w, t),
      [STAT.boss]: k && k.active ? 1 : 0,
      [STAT.bossHp]: k ? k.state.hp : 0,
      [STAT.bossPhase]: k ? k.state.phase : 0,
      [STAT.bossOpen]: k && k.state.step === "vulnerable" ? 1 : 0,
      [STAT.bossFlash]: k && k.state.flashMs > 0 ? 1 : 0,
      [STAT.bossWants]: k ? k.wants : 0,
      [STAT.plate]: k ? plateColor(w) : 0,
   };
   for (const [key, v] of Object.entries(stats)) if (s.stats[key] !== v) s.setStat(key, v);
}

function RunScene({ multi }: { multi: boolean }) {
   const { config } = useLevel<BridgeLevel>();
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
   const orbit = useMemo(() => createOrbit({ yaw: 0, pitch: 52 * DEG, distance: 17, minDistance: 8, maxDistance: 34 }), [id, multi]); // eslint-disable-line react-hooks/exhaustive-deps
   const aspect = useThree((s) => s.size.width / s.size.height);
   const intro = useShellIntro();
   const juice = useJuice();
   const look = lookFor(id);
   const audio = useMemo(() => ({ hum: null as ReturnType<typeof startLoop> | null, beat: -1, ended: false }), []);
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
   const inputs = useMemo<StepInput[]>(() => world.teams.map(() => idleInput()), [world]);
   useRunFrame((_, dt) => {
      if (multi) world.teams.forEach((_t, k) => mapInput(playerInputFor(slots[k]), orbit.viewYaw, inputs[k]));
      else if (autoplay) Object.assign(inputs[0], botInput(world, 0));
      else mapInput(input.current, orbit.viewYaw, inputs[0]);
      stepWorld(world, dt * 1000, inputs);
      const s = useArcadeStore.getState();
      const t0 = world.teams[0];
      if (multi) {
         world.teams.forEach((t, k) => {
            const p = playersStore.getState().players.find((pl) => pl.index === slots[k]);
            if (!p) return;
            const ps = playersStore.getState();
            const c = cellPos(t.r, t.c);
            ps.setPosition(p.index, c.x, 0, c.z);
            ps.update(p.index, { score: t.orbs, progress: world.map.h - 1 - t.r, finished: t.ended === "win", finishMs: t.ended === "win" ? t.finishMs : null });
         });
         const finished = world.teams.filter((t) => t.ended === "win");
         const mode = playersStore.getState().mode;
         const done = mode === "coop" ? world.teams.every((t) => t.ended) : finished.length > 0 && (finished.length === world.teams.length || world.ms - Math.min(...finished.map((t) => t.finishMs)) > 20_000);
         if ((done || world.ended) && !audio.ended) {
            audio.ended = true;
            s.end(finished.length ? "win" : "timeup");
         }
      } else {
         publish(world);
         if (t0.ended && !audio.ended) {
            audio.ended = true;
            if (t0.ended === "win") {
               s.setStat(STAT.finishMs, t0.finishMs);
               for (const [k, v] of Object.entries(levelEndStats(world, t0, user?.id ?? null))) s.setStat(k, v);
               s.setScore(Math.max(0, Math.floor((world.cfg.durationMs - submittedMs(t0)) / 10)));
            }
            s.end(t0.ended);
         }
      }
      fx(world, juice);
      // the beams hum: one voice per lit colour
      const lit = new Set(world.beams.filter((b) => b.anchored).map((b) => b.colors[b.colors.length - 1])).size;
      audio.hum?.set({ pitch: 0.6 + lit * 0.12, volume: 0.03 + lit * 0.015 });
      const beat = Math.floor(world.ms / (60_000 / 100));
      if (beat !== audio.beat) {
         audio.beat = beat;
         const bar = beat % 8;
         playSfx("click", { pitch: [1.0, 1.19, 1.5, 1.19, 1.33, 1.5, 1.78, 1.5][bar], volume: world.keeper?.active ? 0.07 : 0.04 });
      }
   });
   const start = cellPos(world.map.start[0], world.map.start[1]);
   const playCamera = useMemo<IntroKeyframe>(() => ({ position: [start.x, 17 * Math.sin(52 * DEG) + 1, start.z + 17 * Math.cos(52 * DEG)], lookAt: [start.x, 1, start.z] }), [start.x, start.z]);
   const shots = useMemo<IntroKeyframe[]>(() => {
      const e = cellPos(world.map.exit[0], world.map.exit[1]);
      const mid = (world.map.h * CELL) / 2;
      return [
         { position: [e.x + 6, 10, e.z + 10], lookAt: [e.x, 1, e.z] },
         { position: [world.map.w * CELL + 14, 24, mid], lookAt: [world.map.w, 0, mid] },
         { position: [start.x - 6, 8, start.z + 10], lookAt: [start.x, 1, start.z - 4] },
      ];
   }, [world, start.x, start.z]);
   const lead = world.teams[0];
   void look;
   return (
      <>
         {multi && <PlayerInputLatch />}
         <Board world={world} />
         {world.teams.map((t, k) => (
            <TeamHero key={k} team={t} intro={intro?.session && !intro.ready && !multi ? intro.hero : undefined} />
         ))}
         {world.keeper && <Keeper world={world} />}
         <hemisphereLight args={["#f8fafc", look.abyss, look.ambient]} />
         <directionalLight position={[world.map.w, 30, world.map.h * CELL + 10]} intensity={0.9} />
         <ambientLight intensity={look.ambient * 0.4} />
         {multi ? (
            <>
               <OrbitDriver orbit={orbit} />
               <SharedCamera points={world.teams.map((t) => ({ ...cellPos(t.r, t.c), y: 0 }))} orbit={orbit} minSpan={12} maxSpan={60} padding={4} />
            </>
         ) : (
            <OrbitCamera
               orbit={orbit}
               pivot={(out) => {
                  const p = cellPos(lead.r, lead.c);
                  Object.assign(out, { x: p.x, y: 0.5, z: p.z - 3 });
               }}
               // the canyon is read looking "north": the auto-follow swings back behind the hero
               travel={(out) => {
                  out.x = 0;
                  out.z = -1;
               }}
               behind={() => 0}
               distanceScale={aspect < 1 ? 1.5 : 1}
            />
         )}
         {intro?.session && !multi && <GameIntro session={intro.session} keyframes={shots} playCamera={playCamera} hero={intro.hero} />}
      </>
   );
}

/** Juice and sound from the step's events. */
function fx(w: RunWorld, juice: ReturnType<typeof useJuice>) {
   w.teams.forEach((t, k) => {
      const lead = k === 0;
      const e = t.ev;
      const p = cellPos(t.r, t.c);
      const at = { x: p.x, y: 1, z: p.z };
      if (e.step && lead && t.moving === "walk") playSfx("click", { pitch: 1.6, volume: 0.12 });
      if (e.switched >= 0) {
         const color = MASK_COLOR[w.nodeColor[e.switched]] ?? "#94a3b8";
         juice.burst("pickup", at, 14, { color });
         const n = w.map.nodes[e.switched];
         const np = cellPos(n[0], n[1]);
         juice.burst("checkpoint", { x: np.x, y: 1.3, z: np.z }, 18, { color });
         if (lead) playSfx("chime", { pitch: 0.9 + (w.nodeColor[e.switched] === 1 ? 0 : w.nodeColor[e.switched] === 2 ? 0.25 : 0.5), volume: 0.5 });
      }
      if (e.rotated && lead) playSfx("thud", { pitch: 1.4, volume: 0.45 });
      if (e.slid && lead) playSfx("whoosh", { pitch: 1.2 });
      if (e.tag) {
         juice.burst("aura", at, 22, { color: MASK_COLOR[{ riko: 1, nami: 2, zuno: 4, vexa: 3, kiro: 6 }[t.heroId]] });
         if (lead) playSfx("pop", { pitch: 1.3 });
      }
      if (e.fell) {
         juice.burst("dust", at, 18, { color: "#cbd5e1" });
         juice.shake(0.2);
         if (lead) playSfx("whoosh", { pitch: 0.6 });
      }
      if (e.respawn && lead) playSfx("pop", { pitch: 0.8 });
      if (e.orb) {
         juice.burst("pickup", at, 16, { color: "#f0abfc" });
         juice.popup({ x: at.x, y: at.y + 1.2, z: at.z }, "-0.4 s", { color: "#f5d0fe", size: 0.05 });
         if (lead) playSfx("chime", { pitch: 1 + Math.min(t.combo.chain, 6) / 10 });
      }
      if (e.secret) {
         juice.burst("checkpoint", at, 32);
         juice.popup({ x: at.x, y: at.y + 1.6, z: at.z }, "Secret found!", { color: "#fbbf24", size: 0.07 });
         if (lead) playSfx("chime", { pitch: 1.6 });
      }
      if (e.broke) {
         juice.burst("hit", at, 24, { color: "#fdba74" });
         juice.shake(0.25);
         if (lead) playSfx("boom", { pitch: 1.2, volume: 0.5 });
      }
      if (e.power && lead) playSfx("zap", { pitch: 1.2, volume: 0.4 });
      if (e.stomped) juice.popup({ x: at.x, y: at.y + 1.4, z: at.z }, "Stomped!", { color: "#fca5a5", size: 0.06 });
      if (e.bossHit) {
         juice.popup({ x: at.x, y: at.y + 2, z: at.z - 3 }, "Plate hit!", { color: "#f8fafc", size: 0.08 });
         juice.hitStop(130);
         juice.shake(0.45);
         if (lead) playSfx("boom", { pitch: 0.9 });
      }
      if (e.won) {
         juice.burst("checkpoint", at, 50);
         if (lead) playSfx("win");
      }
   });
   const k = w.keeper;
   if (k) {
      if (k.ev.telegraph) playSfx("alarm", { pitch: 0.7, volume: 0.4 });
      if (k.ev.attack) {
         juice.shake(0.5);
         juice.kick(0, -1, 0, 1.6);
         playSfx("boom", { pitch: 0.6, volume: 0.6 });
      }
      if (k.ev.defeated) {
         juice.shake(0.7);
         playSfx("win");
      }
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
