"use client";

// Color Match Jump's scene: the simulation (rules.ts step on the run clock), the field, the squad of
// five heroes (only the active one drawn), the orbit camera and the intro.
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useRunFrame } from "../../core/useRunFrame";
import { useInput } from "../../core/input";
import { useLevel } from "../../core/level";
import { playSfx } from "../../core/audio";
import { FRAME_PRIORITY } from "../../core/frameLoop";
import { randomSeed } from "../../core/math";
import { ARCADE_PREVIEW } from "../../flags";
import { GameIntro, useShellIntro } from "../../core/intro";
import { JuiceLayer, useJuice } from "../../menu2/juice";
import { comboFlow } from "../../menu2/combo/combo";
import { createOrbit, type OrbitState } from "../../menu2/camera/orbit";
import { OrbitCamera } from "../../menu2/camera/OrbitCamera";
import { useAuth } from "@/contexts/AuthContext";
import { Field } from "./Field";
import { Squad } from "./Squad";
import { createRun, step, idleInput, STAT, hintFor, sunkRows, type CmjRun, type StepInput, type Events } from "./rules";
import { HEROES, pickedHero, subscribeHero } from "./heroes";
import { CMJ_ORBIT, FOV, introKeyframes, orbitScale, playCamera } from "./camera";
import { COMBO, STORM } from "./progression";
import { HEX_COLORS } from "./look";
import { botInput } from "./bot";
import { levelEndStats } from "./levelEnd";
import { listenTagKeys, takeTag } from "./tagLatch";
import type { CmjLevel } from "./levels";

function codeValue(code: number[]): number {
   let v = 0;
   for (let i = code.length - 1; i >= 0; i--) v = v * 8 + code[i] + 1;
   return v;
}

export function publish(r: CmjRun): void {
   const s = useArcadeStore.getState();
   const b = r.boss;
   const values: Partial<Record<keyof typeof STAT, number>> = {
      level: r.level, codes: r.codes, codeStep: r.codeStep, code: codeValue(r.code), codeLen: r.code.length,
      hearts: r.hearts, orbs: r.orbs, active: r.active, tagReady: Math.max(0, Math.ceil((r.tagReadyAt - r.simMs) / 100)),
      cd0: Math.ceil(r.cooldown[0] / 1000), cd1: Math.ceil(r.cooldown[1] / 1000), cd2: Math.ceil(r.cooldown[2] / 1000), cd3: Math.ceil(r.cooldown[3] / 1000), cd4: Math.ceil(r.cooldown[4] / 1000),
      chain: r.combo.chain, multiplier: Math.round(r.combo.multiplier * 100), flow: Math.round(comboFlow(r.combo, COMBO, r.simMs) * 100),
      hint: hintFor(r), sink: sunkRows(r),
      bossHp: b?.hp ?? 0, bossPhase: b?.phase ?? 0, bossOpen: b?.step === "vulnerable" ? 1 : 0, bossFlash: b && b.flashMs > 0 ? 1 : 0,
      plate: r.plate, shards: r.shards, storm: r.p3Start >= 0 ? Math.min(STORM.surviveMs / 1000, Math.floor((r.simMs - r.p3Start) / 1000)) : 0,
   };
   for (const key of Object.keys(values) as (keyof typeof STAT)[]) if (s.stats[STAT[key]] !== values[key]) s.setStat(STAT[key], values[key]!);
}

function useEffects() {
   const juice = useJuice();
   return (r: CmjRun, e: Events) => {
      const p = { x: r.x, y: r.y + 0.3, z: r.z };
      const me = HEX_COLORS[r.active];
      if (e.hop) playSfx("jump", { volume: 0.5, pitch: 1 + r.active * 0.06 });
      if (e.airJump) { playSfx("jump", { pitch: 1.45 }); juice.burst("aura", p, 14, { color: me }); }
      if (e.tagged) { juice.burst("pickup", p, 22, { color: me }); playSfx("chime", { volume: 0.35, pitch: [1, 1.12, 1.26, 1.5, 1.68][r.active] }); }
      if (e.matched) { juice.burst("pickup", p, 16, { color: me }); playSfx("pop", { volume: 0.45, pitch: 1 + Math.min(0.6, r.combo.chain * 0.05) }); }
      if (e.codeStep) playSfx("chime", { volume: 0.5, pitch: 1 + r.codeStep * 0.15 });
      if (e.codeCracked) { juice.burst("checkpoint", p, 40, { color: "#fde68a" }); juice.popup(p, "CODE!", { color: "#fde68a" }); playSfx("chime", { pitch: 1.6 }); }
      if (e.cracked) { juice.burst("hit", p, 18, { color: "#e2e8f0" }); juice.shake(0.18); juice.popup(p, "WRONG COLOUR", { color: "#fca5a5" }); playSfx("thud"); }
      if (e.fell) { juice.shake(0.3); playSfx("hit"); }
      if (e.zap) { juice.burst("hit", p, 26, { color: "#a7f3d0" }); juice.shake(0.25); playSfx("hit"); }
      if (e.bonk) playSfx("thud", { volume: 0.4, pitch: 1.3 });
      if (e.power) { juice.burst("aura", p, 24, { color: me }); playSfx("whoosh"); }
      if (e.orb) { juice.burst("pickup", p, 18, { color: "#fde68a" }); playSfx("pickup"); }
      if (e.secret) { juice.burst("checkpoint", p, 36, { color: "#f9a8d4" }); juice.popup(p, "SECRET!", { color: "#f9a8d4" }); playSfx("chime", { pitch: 1.8 }); }
      if (e.crownLocked) juice.popup(p, "CRACK MORE CODES", { color: "#fde68a" });
      if (e.shard) { juice.burst("checkpoint", p, 30, { color: "#f9a8d4" }); juice.popup(p, "PRISM SHARD", { color: "#f9a8d4" }); playSfx("chime", { pitch: 1.4 }); }
      if (e.stomp) { juice.burst("hit", p, 40, { color: me }); juice.shake(0.35); juice.hitStop(90); playSfx("boom"); }
      if (e.bossAttack && r.boss?.phase !== 2) { juice.shake(0.2); playSfx("thud", { pitch: 0.7 }); }
      if (e.bossHit) { juice.burst("hit", { x: 0, y: 5, z: 0 }, 50, { color: "#e0f2fe" }); juice.shake(0.35); juice.hitStop(100); playSfx("boom"); }
      if (e.bossDefeated) { juice.burst("checkpoint", { x: 0, y: 5, z: 0 }, 120, { color: "#f472b6" }); juice.popup({ x: 0, y: 7, z: 0 }, "COLOUR RESTORED!", { color: "#f9a8d4", size: 0.08 }); juice.hitStop(140); }
      if (e.finished) { juice.burst("checkpoint", p, 80, { color: "#fde68a" }); playSfx("win"); }
   };
}

function Simulation({ run: r, orbit }: { run: CmjRun; orbit: OrbitState }) {
   const input = useInput();
   const effects = useEffects();
   const stepInput = useMemo<StepInput>(idleInput, []);
   const { user } = useAuth();
   const autoplay = useMemo(() => ARCADE_PREVIEW && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("autoplay") === "1", []);
   useEffect(() => listenTagKeys(), []);
   useEffect(() => publish(r), [r]);
   useRunFrame((_, dt) => {
      const i = input.current;
      stepInput.moveX = i.moveX;
      stepInput.moveY = i.moveY;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.jumpHeld = i.jump;
      stepInput.actionPressed = i.actionPressed;
      stepInput.tag = takeTag();
      stepInput.yaw = orbit.viewYaw;
      if (autoplay) botInput(r, stepInput);
      const ev = step(r, dt * 1000, stepInput);
      effects(r, ev);
      publish(r);
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

function Lens() {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   useFrame(() => {
      const fov = FOV + (size.width < size.height ? 10 : 0);
      if (Math.abs(camera.fov - fov) > 0.1) {
         camera.fov = fov;
         camera.updateProjectionMatrix();
      }
   }, FRAME_PRIORITY.camera - 0.01);
   return null;
}

export default function Scene() {
   const { config } = useLevel<CmjLevel>();
   const runId = useArcadeStore((s) => s.runId);
   const ready = useArcadeStore((s) => s.phase === "ready");
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const held = useRef(pick);
   if (ready) held.current = pick;
   const lead = held.current;
   const r = useMemo(() => createRun(randomSeed(), config?.id ?? 1, lead), [runId, config?.id, lead]);
   const orbit = useMemo(() => createOrbit(CMJ_ORBIT), [r]);
   const intro = useShellIntro();
   const size = useThree((s) => s.size);
   const aspect = size.width / size.height;
   const play = useMemo(() => playCamera(r.course, aspect), [r, aspect]);
   const shots = useMemo(() => introKeyframes(r.course), [r]);
   return (
      <JuiceLayer>
         <Field run={r} />
         <Squad run={r} intro={intro && !intro.ready ? intro.hero : undefined} />
         <Simulation run={r} orbit={orbit} />
         <Lens />
         <OrbitCamera
            orbit={orbit}
            lookUp={0.6}
            distanceScale={orbitScale(aspect)}
            pivot={(out) => {
               out.x = r.x;
               out.y = r.y + 1.2;
               out.z = r.z;
            }}
            travel={(out) => {
               out.x = r.vx;
               out.z = r.vz;
            }}
         />
         {intro?.session && !intro.ready && <GameIntro session={intro.session} keyframes={shots} playCamera={play} hero={intro.hero} />}
      </JuiceLayer>
   );
}

export const HERO_IDS = HEROES.map((h) => h.id);
