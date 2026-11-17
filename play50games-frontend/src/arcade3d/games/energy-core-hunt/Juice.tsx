"use client";

// The input mapping and the juice of one run's events, shared by Scene.tsx (solo) and MultiScene.tsx:
// a core of the order bursts in its colour with a rising chime, a wrong pick jolts the hero red with a
// buzz and a shake, a capsule pops open, each wave lands with a thump, a faded core sparkles away, the
// gate opens with a fanfare; tesla zaps, the Core Sprite's slams, hits and its defeat.
import { useMemo } from "react";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { playSfx } from "@/arcade3d/core/audio";
import { useJuice } from "@/arcade3d/menu2/juice";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import type { HeroAnim } from "./Hero";
import { ORB, spritePos, type CoreRun, type StepEvents, type StepInput } from "./rules";
import { SECRETS } from "./progression";
import { CORE_COLORS, COLORS } from "./look";
import { COLOR_NAMES } from "./course";

/** The core input -> this game's StepInput: the stick / WASD (turned by the camera's yaw in the rules), Space jumps, E acts. */
export function mapInput(i: { moveX: number; moveY: number; jumpPressed: boolean; actionPressed: boolean }, yaw: number, out: StepInput): StepInput {
   out.moveX = i.moveX;
   out.moveY = i.moveY;
   out.yaw = yaw;
   out.jumpPressed = i.jumpPressed;
   out.actionPressed = i.actionPressed;
   return out;
}

/** The juice and sound of one run's events (solo = false: quieter, no popups). */
export function useEventJuice() {
   const juice = useJuice();
   const time = useGameTime();
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   return (run: CoreRun, ev: StepEvents, anim: HeroAnim, solo: boolean) => {
      const now = time.now;
      const h = run.hero;
      const co = run.course;
      chest.x = feet.x = h.x;
      chest.z = feet.z = h.z;
      chest.y = h.h + 0.9;
      feet.y = h.h + 0.1;
      const vol = solo ? 1 : 0.6;
      if (ev.airHopped) {
         anim.airHopAt = now;
         juice.burst("trail", chest, 12, { color: "#bfdbfe" });
         playSfx("jump", { volume: 0.5 * vol, pitch: 1.3 });
      } else if (ev.hopped) {
         anim.hopAt = now;
         playSfx("jump", { volume: 0.5 * vol });
      }
      if (ev.landed) {
         anim.landAt = now;
         juice.burst("dust", feet, 5, { color: "#94a3b8" });
      }
      if (ev.took >= 0) {
         const color = CORE_COLORS[ev.took];
         juice.burst("pickup", chest, 22, { color });
         juice.burst("aura", chest, 10, { color });
         const have = run.count[ev.took];
         if (solo) juice.popup(chest, `${COLOR_NAMES[ev.took]} ${have}/${co.order[ev.took]}`, { color, size: 0.065 });
         playSfx("chime", { volume: 0.6 * vol, pitch: 1 + Math.min(0.8, run.count.reduce((a, b) => a + b, 0) * 0.04) });
      }
      if (ev.wrong >= 0) {
         anim.hitAt = now;
         juice.burst("hit", chest, 24, { color: "#ef4444" });
         if (solo) juice.popup(chest, ev.decoy ? "Decoy!" : `No more ${COLOR_NAMES[ev.wrong]}!`, { color: "#fca5a5", size: 0.07 });
         juice.shake(0.35);
         juice.hitStop(80);
         playSfx("buzz", { volume: 0.7 * vol });
      }
      if (ev.zapped || ev.shocked) {
         anim.hitAt = now;
         juice.burst("hit", chest, 20, { color: ev.zapped ? "#a5f3fc" : "#f472b6" });
         if (solo) juice.popup(chest, ev.zapped ? "Zapped!" : "Shocked!", { color: "#fca5a5", size: 0.07 });
         juice.shake(0.3);
         playSfx("zap", { volume: 0.7 * vol, pitch: 0.7 });
      }
      if (ev.soaked) {
         juice.burst("aura", chest, 10, { color: "#4ade80" });
         playSfx("zap", { volume: 0.3 * vol, pitch: 1.6 });
      }
      if (ev.opened) {
         juice.burst("pickup", chest, 16, { color: "#e2e8f0" });
         playSfx("pop", { volume: 0.6 * vol, pitch: 1.2 });
      }
      if (ev.wave >= 0 && ev.wave < co.waves.length && run.ms > 50) {
         juice.shake(0.12);
         playSfx("thud", { volume: 0.5 * vol, pitch: 0.8 });
      }
      if (ev.faded) playSfx("whoosh", { volume: 0.3 * vol, pitch: 0.7 });
      if (ev.gateOpen) {
         juice.burst("checkpoint", { x: co.gate.x, y: 1.5, z: co.gate.z }, 40, { color: COLORS.open });
         if (solo) juice.popup(chest, "Order complete! To the gate", { color: "#86efac", size: 0.075 });
         playSfx("chime", { volume: 0.8, pitch: 0.8 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = co.orbs[ev.orbList[k]];
         const at = { x: o.x, y: o.h, z: o.z };
         juice.burst("pickup", at, 12);
         if (solo) juice.popup(at, `-${(ORB.bonusMs / 1000).toFixed(1)} s`, { color: "#ffe08a" });
         playSfx("pickup", { volume: vol, pitch: 1 + Math.min(0.6, run.orbs * 0.02) });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", chest, 30, { color: "#fde68a" });
         juice.popup(chest, `${spec.name}!`, { color: "#fde68a", size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (solo && ev.comboLinked && run.combo.chain > 2) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.3 });
      if (ev.powered) {
         juice.burst("aura", chest, 14, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.5 * vol, pitch: 1.15 });
      }
      if (ev.bossWoke) {
         juice.shake(0.4);
         juice.popup(chest, "The Core Sprite has the last cores!", { color: "#d8b4fe", size: 0.07 });
         playSfx("boom", { volume: 0.7, pitch: 0.8 });
      }
      if (ev.bossTelegraph) playSfx("alarm", { volume: 0.3 * vol, pitch: 1.3 });
      if (ev.bossAttack) {
         const sp = spritePos(run, { x: 0, z: 0 });
         juice.burst("dust", { x: sp.x, y: 0.2, z: sp.z }, 30, { color: "#f472b6" });
         juice.shake(0.3);
         playSfx("thud", { volume: 0.7 * vol, pitch: 0.6 });
      }
      if (ev.bossHit) {
         juice.shake(0.35);
         juice.hitStop(90);
         playSfx("boom", { volume: 0.6 * vol, pitch: 1.2 });
      }
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 80, { color: "#d8b4fe" });
         juice.shake(0.5);
         juice.hitStop(140);
         if (solo) juice.popup(chest, "Sprite caught!", { color: "#f0abfc", size: 0.08 });
         playSfx("boom", { volume: 0.9, pitch: 0.7 });
      }
      if (ev.bossDone && solo) playSfx("win", { volume: 0.6 });
   };
}
