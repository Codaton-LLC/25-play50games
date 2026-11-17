"use client";

// The input mapping and the juice of one run's events, shared by Scene.tsx (solo) and MultiScene.tsx:
// a laser touch flashes red with a zap and a shake (the hero blinks back on its checkpoint pad), a
// soaked touch sparks green on Kiro's shield, a switch clicks and its gate powers down, a decoy wakes a
// sweep with an alarm, a room crossed clean chimes, the Vault Core's hits and its meltdown.
import { useMemo } from "react";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { playSfx } from "@/arcade3d/core/audio";
import { useJuice } from "@/arcade3d/menu2/juice";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import type { HeroAnim } from "./Hero";
import { ORB, type LaserRun, type StepEvents, type StepInput } from "./rules";
import { SECRETS } from "./progression";
import { COLORS } from "./look";

/** The core input -> this game's StepInput: the stick / WASD (turned by the camera's yaw in the rules), Space jumps, E acts. */
export function mapInput(i: { moveX: number; moveY: number; jumpPressed: boolean; actionPressed: boolean; pressed?: { up?: boolean } }, yaw: number, out: StepInput): StepInput {
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
   return (run: LaserRun, ev: StepEvents, anim: HeroAnim, solo: boolean) => {
      const now = time.now;
      const r = run.runner;
      const co = run.course;
      chest.x = feet.x = r.x;
      chest.z = feet.z = -r.s;
      chest.y = r.h + 0.9;
      feet.y = r.h + 0.1;
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
      if (ev.hit !== -1) {
         anim.hitAt = now;
         juice.burst("hit", chest, 24, { color: COLORS.beam });
         if (solo) juice.popup(chest, ev.hit === -2 ? "Live floor!" : ev.hit === -3 ? "Crushed!" : "Zapped!", { color: "#fca5a5", size: 0.07 });
         juice.shake(0.35);
         juice.hitStop(80);
         playSfx("zap", { volume: 0.7 * vol, pitch: 0.7 });
      }
      if (ev.respawned) juice.burst("checkpoint", { x: 0, y: 0.6, z: -run.cp }, 20, { color: COLORS.safe });
      if (ev.soaked) {
         juice.burst("aura", chest, 10, { color: "#4ade80" });
         playSfx("zap", { volume: 0.3 * vol, pitch: 1.6 });
      }
      if (ev.pressed >= 0) {
         const sw = co.switches[ev.pressed];
         juice.burst("pickup", { x: sw.x, y: 1, z: -sw.s }, 16, { color: ev.decoy ? COLORS.beam : COLORS.safe });
         if (solo) juice.popup(chest, ev.decoy ? "Decoy! Sweep awake" : co.arena?.pylons.includes(ev.pressed) ? "Pylon!" : "Gate open", { color: ev.decoy ? "#fca5a5" : "#86efac", size: 0.06 });
         playSfx(ev.decoy ? "alarm" : "click", { volume: 0.6 * vol, pitch: ev.decoy ? 1.4 : 1 });
      }
      if (ev.zone >= 0) {
         if (ev.clean) {
            juice.burst("checkpoint", chest, 18, { color: "#7dd3fc" });
            if (solo) juice.popup(chest, "Clean room!", { color: "#7dd3fc", size: 0.07 });
            playSfx("chime", { volume: 0.55 * vol, pitch: 1.2 });
         } else playSfx("chime", { volume: 0.35 * vol, pitch: 0.9 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = co.orbs[ev.orbList[k]];
         const at = { x: o.x, y: o.h, z: -o.s };
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
      const a = co.arena;
      if (ev.bossWoke && a) {
         juice.shake(0.4);
         juice.popup(chest, "The Vault Core!", { color: COLORS.core, size: 0.08 });
         playSfx("boom", { volume: 0.7, pitch: 0.6 });
      }
      if (ev.bossTelegraph) playSfx("alarm", { volume: 0.3 * vol, pitch: 1.2 });
      if (ev.bossAttack) {
         juice.shake(0.15);
         playSfx("zap", { volume: 0.4 * vol, pitch: 0.9 });
      }
      if (ev.bossHit && a) {
         juice.burst("hit", { x: 0, y: 3, z: -a.coreS }, 40, { color: "#fde047" });
         juice.shake(0.4);
         juice.hitStop(90);
         playSfx("boom", { volume: 0.7 * vol });
      }
      if (ev.bossDefeated && a) {
         juice.burst("checkpoint", { x: 0, y: 3, z: -a.coreS }, 100, { color: COLORS.core });
         juice.shake(0.6);
         juice.hitStop(140);
         if (solo) juice.popup(chest, "Core overloaded!", { color: "#f0abfc", size: 0.08 });
         playSfx("boom", { volume: 0.9, pitch: 0.7 });
      }
      if (ev.bossDone && solo) playSfx("win", { volume: 0.6 });
   };
}
