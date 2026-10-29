"use client";

// The input mapping and the juice of one run's events, shared by Scene.tsx (solo) and MultiScene.tsx:
// a grow chimes up and sparkles, a shrink chimes down, jelly cubes burst into wobbling chunks, a size
// miss flashes red, the sugar-burn roll leaves sprinkles, the king's crown pops in slow motion.
import { useMemo } from "react";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { playSfx } from "@/arcade3d/core/audio";
import { createJuiceEmitter, useJuice } from "@/arcade3d/menu2/juice";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import type { HeroAnim } from "./Hero";
import { BIG, laneX, needOf } from "./course";
import { ORB, itemVisualS, visualS, type CandyRun, type StepEvents, type StepInput } from "./rules";
import { SECRETS } from "./progression";

/** The stick pulled down this far rolls (keys: S / Down). */
export const ROLL_STICK = 0.55;
/** A stick flick this far sideways changes lane (once per flick: it must come back under half first). */
export const FLICK = 0.6;

export interface FlickMemo {
   armed: boolean;
}

export function createFlick(): FlickMemo {
   return { armed: true };
}

/** The core input -> this game's StepInput: ←/→ presses and swipes (and a stick flick) change lane, down rolls. */
export function mapInput(
   i: { moveX: number; moveY: number; jumpPressed: boolean; actionPressed: boolean; pressed: { left: boolean; right: boolean } },
   flick: FlickMemo,
   out: StepInput,
): StepInput {
   let left = i.pressed.left;
   let right = i.pressed.right;
   if (Math.abs(i.moveX) < 0.3) flick.armed = true;
   else if (flick.armed && Math.abs(i.moveX) >= FLICK && !left && !right) {
      flick.armed = false;
      // a key press already counts in `pressed` (a held key also moves the stick): only a touch flick adds one
      if (i.moveX < 0) left = true;
      else right = true;
   }
   if (i.pressed.left || i.pressed.right) flick.armed = false;
   out.left = left;
   out.right = right;
   out.roll = i.moveY > ROLL_STICK;
   out.jumpPressed = i.jumpPressed;
   out.actionPressed = i.actionPressed;
   return out;
}

/** The juice and sound of one run's events (solo = false: quieter, no popups). */
export function useEventJuice() {
   const juice = useJuice();
   const time = useGameTime();
   const sprinkle = useMemo(createJuiceEmitter, []);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   return (run: CandyRun, ev: StepEvents, anim: HeroAnim, solo: boolean) => {
      const now = time.now;
      const r = run.runner;
      const co = run.course;
      chest.x = feet.x = r.x;
      chest.z = feet.z = -visualS(run);
      chest.y = r.h + 0.9;
      feet.y = r.h + 0.1;
      const vol = solo ? 1 : 0.6;
      if (r.rolling) juice.stream("trail", feet, 40, sprinkle, { color: ["#f9a8d4", "#93c5fd", "#fde68a"][Math.floor(now * 10) % 3] });
      if (ev.swapped) playSfx("whoosh", { volume: 0.3 * vol, pitch: 1.4 });
      if (ev.blocked) playSfx("thud", { volume: 0.4 * vol, pitch: 1.2 });
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
         juice.burst("dust", feet, 6, { color: "#fbcfe8" });
      }
      if (ev.railOn) {
         if (solo) juice.popup(chest, "Rail!", { color: "#fda4af", size: 0.06 });
         playSfx("chime", { volume: 0.4 * vol, pitch: 1.5 });
      }
      if (ev.grew) {
         anim.sizeAt = now;
         juice.burst("checkpoint", chest, 22, { color: "#fde68a" });
         if (solo) juice.popup(chest, r.size === BIG ? "BIG!" : "Normal", { color: "#fbbf24", size: 0.07 });
         playSfx("chime", { volume: 0.55 * vol, pitch: 1 + r.size * 0.25 });
      }
      if (ev.shrank) {
         anim.sizeAt = now;
         juice.burst("pickup", chest, 14, { color: "#7dd3fc" });
         if (solo && r.size === 0) juice.popup(chest, "small", { color: "#7dd3fc", size: 0.06 });
         playSfx("chime", { volume: 0.45 * vol, pitch: 0.75 - (1 - r.size) * 0.15 });
      }
      if (ev.cleared >= 0) {
         const o = co.obstacles[ev.cleared];
         const at = { x: laneX(o.lane), y: 1, z: -visualS(run) - 0.5 };
         if (needOf(o.kind) === BIG) {
            // jelly bursts into wobbling chunks
            juice.burst("hit", at, 30, { color: o.kind === "choco" ? "#92400e" : o.kind === "frozenBlock" ? "#bae6fd" : "#f472b6" });
            juice.burst("dust", at, 16, { color: "#fbcfe8" });
            juice.shake(0.22);
            juice.hitStop(45);
            playSfx("pop", { volume: 0.7 * vol, pitch: 0.7 });
         } else {
            juice.burst("trail", at, 10, { color: "#e0f2fe" });
            playSfx("whoosh", { volume: 0.4 * vol, pitch: 1.6 });
         }
      }
      if (ev.miss >= 0 || ev.cracked >= 0) {
         anim.hitAt = now;
         juice.burst("hit", chest, 20, { color: "#ef4444" });
         if (solo) juice.popup(chest, ev.cracked >= 0 ? "Too heavy!" : "Wrong size!", { color: "#fca5a5", size: 0.07 });
         juice.shake(0.35);
         juice.hitStop(70);
         playSfx("hit", { volume: 0.6 * vol });
      }
      for (let k = 0; k < ev.coinCount; k++) {
         const c = co.coins[ev.coinList[k]];
         juice.burst("pickup", { x: laneX(c.lane), y: 0.9, z: -visualS(run) }, 8, { color: "#fde047" });
         playSfx("pop", { volume: 0.4 * vol, pitch: 1.2 + r.eaten * 0.1 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = co.orbs[ev.orbList[k]];
         const at = { x: laneX(o.lane), y: o.h, z: -itemVisualS(run, o.s) };
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
      if (ev.bounced) {
         juice.burst("dust", feet, 14, { color: "#f9a8d4" });
         playSfx("jump", { volume: 0.6 * vol, pitch: 0.7 });
      }
      if (ev.bitten || ev.popped) {
         anim.hitAt = now;
         juice.burst("hit", chest, 16, { color: ev.popped ? "#c084fc" : "#4ade80" });
         if (solo) juice.popup(chest, ev.popped ? "Popping candy!" : "Bitten!", { color: "#fca5a5", size: 0.06 });
         juice.shake(0.25);
         playSfx(ev.popped ? "zap" : "hit", { volume: 0.5 * vol });
      }
      if (ev.stomped) {
         juice.burst("checkpoint", feet, 18, { color: "#86efac" });
         if (solo) juice.popup(chest, "Gummy boost!", { color: "#86efac", size: 0.06 });
         playSfx("pop", { volume: 0.6 * vol, pitch: 1.4 });
      }
      if (ev.absorbed) {
         juice.burst("aura", chest, 20, { color: "#4ade80" });
         playSfx("zap", { volume: 0.4 * vol, pitch: 1.3 });
      }
      if (ev.gateBroken >= 0) {
         const sl = co.sideLanes[ev.gateBroken];
         juice.burst("hit", { x: laneX(sl.lane), y: 1.3, z: -sl.s0 }, 30, { color: sl.gate === "ghost" ? "#c4b5fd" : "#b45309" });
         juice.shake(0.2);
         playSfx(sl.gate === "ghost" ? "whoosh" : "boom", { volume: 0.6 * vol, pitch: 1.1 });
      }
      if (ev.powered) {
         juice.burst("aura", chest, 14, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.5 * vol, pitch: 1.15 });
      }
      if (ev.bossWoke) {
         juice.shake(0.4);
         juice.popup(chest, "King Bonbon!", { color: "#f9a8d4", size: 0.08 });
         playSfx("boom", { volume: 0.7, pitch: 0.6 });
      }
      if (ev.bossTelegraph) playSfx("alarm", { volume: 0.25 * vol, pitch: 1.2 });
      if (ev.bossAttack) juice.shake(0.25);
      if (ev.bossCharge >= 0) {
         juice.burst("checkpoint", chest, 26, { color: "#fde047" });
         if (solo) juice.popup(chest, "Charged!", { color: "#fde047", size: 0.065 });
         playSfx("chime", { pitch: 1.6, volume: 0.6 });
      }
      if (ev.bossHit) {
         juice.burst("hit", { x: 0, y: 3, z: -visualS(run) - 26 }, 40, { color: "#fef08a" });
         juice.shake(0.4);
         juice.hitStop(90);
         playSfx("boom", { volume: 0.7 * vol });
      }
      if (ev.bossDefeated) {
         // the crown pops: a honey-gold burst in slow motion
         juice.burst("checkpoint", { x: 0, y: 5, z: -visualS(run) - 26 }, 100, { color: "#fbbf24" });
         juice.shake(0.6);
         juice.hitStop(140);
         if (solo) juice.popup(chest, "The yellow is free!", { color: "#fde68a", size: 0.08 });
         playSfx("boom", { volume: 0.9, pitch: 0.7 });
      }
      if (ev.bossDone && solo) playSfx("win", { volume: 0.6 });
   };
}
