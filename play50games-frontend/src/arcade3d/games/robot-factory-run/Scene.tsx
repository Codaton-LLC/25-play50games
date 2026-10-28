"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useThree } from "@react-three/fiber";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useRunFrame } from "../../core/useRunFrame";
import { useInput } from "../../core/input";
import { useLevel } from "../../core/level";
import { playSfx } from "../../core/audio";
import { GameIntro, useShellIntro } from "../../core/intro";
import { JuiceLayer, useJuice } from "../../menu2/juice";
import { createOrbit, type OrbitState } from "../../menu2/camera/orbit";
import { OrbitCamera } from "../../menu2/camera/OrbitCamera";
import { comboFlow } from "../../menu2/combo/combo";
import { usePlayers } from "../../menu2/multiplayer/players";
import { useAuth } from "@/contexts/AuthContext";
import { ARCADE_PREVIEW } from "../../flags";
import type { FactoryLevel } from "./levels";
import { LEVELS } from "./levels";
import { createRun, createStepInput, step, reverseOn, type FactoryRun } from "./rules";
import { pickedHero, subscribeHero, HEROES } from "./heroes";
import { createBot, botInput } from "./bot";
import { rollInput } from "./controls";
import { levelEndStats } from "./levelEnd";
import { COMBO } from "./progression";
import { FACTORY_ORBIT, INTRO_SHOTS, PLAY_CAMERA, factorySolids } from "./camera";
import { Hero } from "./Hero";
import { Course } from "./Course";
import World from "./World";
import FactoryAudio from "./Audio";
import MultiScene from "./MultiScene";
export function publishRun(r: FactoryRun) {
   const s = useArcadeStore.getState();
   const b = r.boss;
   const values = { orbs: r.orbs, cells: r.board.charged, lost: r.board.lost, hearts: r.hearts, power: Math.max(0, Math.ceil((r.hero.powerReady - r.simMs) / 1000)), hero: HEROES.findIndex((v) => v.id === r.heroId), comboMs: r.combo.bonusTotal, chain: r.combo.chain, mult: Math.round(r.combo.multiplier * 100), flow: Math.round(comboFlow(r.combo, COMBO, r.simMs) * 100), hint: r.simMs - r.lastUseful > 10000 ? 1 : 0, reverse: reverseOn(r) ? 1 : 0, bossHp: b?.hp ?? 0, bossPhase: b?.phase ?? 0, bossOpen: b?.step === "vulnerable" ? 1 : 0, bossFlash: (b?.flashMs ?? 0) > 0 ? 1 : 0 };
   for (const [key, value] of Object.entries(values))
      if (s.stats[key] !== value)
         s.setStat(key, value);
}
export function finishRun(r: FactoryRun, userId: number | null) {
   const s = useArcadeStore.getState();
   if (r.ended) {
      s.setStat("finishMs", r.finishMs);
      s.setStat("orbs", r.orbs);
      s.setStat("comboMs", r.combo.bonusTotal);
      for (const [k, v] of Object.entries(levelEndStats(r, userId)))
         s.setStat(k, v);
      s.end(r.ended);
   }
}
export function effects(r: FactoryRun, juice: ReturnType<typeof useJuice>, offset = 0) {
   const e = r.events;
   const pos = { x: r.hero.x + offset, y: r.hero.y + 0.7, z: r.hero.z };
   if (e.turn) {
      juice.burst("hit", pos, 14, { color: "#ffad76" });
      juice.kick(0, -1, 0, 0.5);
      playSfx("thud", { pitch: 1.4 });
   }
   if (e.pickup) {
      juice.burst("pickup", pos, 16, { color: "#ffb457" });
      juice.popup(pos, "-0.3s", { color: "#ffd295" });
      playSfx("pickup");
   }
   if (e.charged) {
      juice.burst("checkpoint", { x: 8 + offset, y: 1, z: 0 }, 25, { color: "#ff784d" });
      playSfx("chime", { pitch: 0.8 + r.board.charged * 0.2 });
   }
   if (e.scrap) {
      juice.burst("dust", { x: -1 + offset, y: 0.5, z: 0 }, 16);
      playSfx("thud", { volume: 0.25 });
   }
   if (e.hit) {
      juice.burst("hit", pos, 22);
      juice.shake(0.25);
      playSfx("lose", { volume: 0.4 });
   }
   if (e.jump)
      playSfx("jump", { volume: 0.5 });
   if (e.land)
      juice.burst("dust", pos, 10);
   if (e.power) {
      juice.burst("aura", pos, 16);
      playSfx("whoosh");
   }
   if (e.arm) {
      juice.burst("pickup", pos, 16);
      playSfx("whoosh", { pitch: 0.7 });
   }
   if (e.secret) {
      juice.burst("checkpoint", pos, 32);
      juice.popup(pos, "Secret!", { color: "#fbcfe8" });
      playSfx("chime");
   }
   if (e.bossHit) {
      juice.burst("hit", { x: 6 + offset, y: 2, z: -2 }, 32);
      juice.shake(0.3);
      juice.hitStop(80);
      playSfx("thud");
   }
   if (e.bossDefeated) {
      juice.hitStop(140);
      juice.burst("checkpoint", pos, 80, { color: "#ff573d" });
      playSfx("chime", { pitch: 0.7 });
   }
}
function Simulation({ run, orbit }: {
   run: FactoryRun;
   orbit: OrbitState;
}) {
   const input = useInput();
   const juice = useJuice();
   const i = useMemo(createStepInput, []);
   const bot = useMemo(createBot, []);
   const { user } = useAuth();
   const autoplay = ARCADE_PREVIEW && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("autoplay") === "1";
   useRunFrame((_, dt) => {
      const p = input.current;
      i.moveX = p.moveX;
      i.moveZ = p.moveY;
      i.yaw = orbit.viewYaw;
      i.jumpPressed = p.jumpPressed;
      i.actionPressed = p.actionPressed;
      i.roll = rollInput.held;
      if (autoplay)
         botInput(bot, run, i);
      step(run, dt * 1000, i);
      effects(run, juice);
      publishRun(run);
      finishRun(run, user?.id ?? null);
   });
   return null;
}
function FactoryCamera({ run, orbit }: {
   run: FactoryRun;
   orbit: OrbitState;
}) {
   const size = useThree((s) => s.size);
   const scale = size.width < size.height ? 1.25 : 1;
   const pivot = useMemo(() => (o: {
      x: number;
      y: number;
      z: number;
   }) => { o.x = run.hero.x; o.y = run.hero.y + 0.8; o.z = run.hero.z; }, [run]);
   const travel = useMemo(() => (o: {
      x: number;
      z: number;
   }) => { o.x = run.hero.vx; o.z = run.hero.vz; }, [run]);
   return <OrbitCamera orbit={orbit} pivot={pivot} travel={travel} solids={factorySolids} distanceScale={scale}/>;
}
function Intro() { const i = useShellIntro(); return i?.session && !i.ready ? <GameIntro session={i.session} hero={i.hero} keyframes={INTRO_SHOTS} playCamera={PLAY_CAMERA}/> : null; }
function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const ready = useArcadeStore((s) => s.phase === "ready");
   const { config } = useLevel<FactoryLevel>();
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(pickedHero, [runId]);
   const hero = ready ? pick : runPick;
   const level = config?.id ?? 1;
   const run = useMemo(() => createRun(20261028, level, hero), [runId, level, hero]);
   const orbit = useMemo(() => createOrbit(FACTORY_ORBIT), [run]);
   return <JuiceLayer><World /><Course key={level} run={run}/><Hero run={run}/><Simulation run={run} orbit={orbit}/><FactoryCamera run={run} orbit={orbit}/><Intro /></JuiceLayer>;
}
export default function Scene() { const mp = usePlayers((s) => s.phase === "playing"); return <><FactoryAudio />{mp ? <MultiScene /> : <SoloScene />}</>; }
