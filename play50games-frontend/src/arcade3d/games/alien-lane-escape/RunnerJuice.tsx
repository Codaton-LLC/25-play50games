"use client";

// The input mapping and the juice of one run's events, shared by Scene.tsx (solo) and MultiScene.tsx:
// the scan's rising chirp as it starts and its alarm as it nears, a heartbeat while you hide, the
// "UNSEEN" pop (cyan) as a line passes you hidden, the tractor beam's zap and the hero's spin when it
// catches you, dust and a camera kick as a meteor lands, a glow plant's flare, the goo's splat, the
// Mothership's hits and its fall.
import { useMemo } from "react";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { playSfx } from "@/arcade3d/core/audio";
import { createJuiceEmitter, useJuice } from "@/arcade3d/menu2/juice";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import type { HeroAnim } from "./Hero";
import { laneX } from "./course";
import { ORB, hiddenBy, itemVisualS, scanEtaMs, visualS, type AlienRun, type StepEvents, type StepInput } from "./rules";
import { SECRETS } from "./progression";
import { COLORS } from "./look";

/** The stick pulled down this far slides (keys: S / Down). */
export const SLIDE_STICK = 0.55;
/** A stick flick this far sideways changes lane (once per flick: it must come back under half first). */
export const FLICK = 0.6;

/** A swipe down slides for this many frames (about 0.6 s). */
export const SWIPE_SLIDE_FRAMES = 36;

export interface FlickMemo {
   armed: boolean;
   /** frames of slide left from a swipe down */
   slideFrames: number;
}

export function createFlick(): FlickMemo {
   return { armed: true, slideFrames: 0 };
}

/** The core input -> this game's StepInput: ←/→ presses and swipes (and a stick flick) change lane, Up / a swipe up jumps, down (held, or a swipe down) slides. */
export function mapInput(
   i: { moveX: number; moveY: number; jumpPressed: boolean; actionPressed: boolean; pressed: { left: boolean; right: boolean; up?: boolean; down?: boolean } },
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
   if (i.pressed.down) flick.slideFrames = SWIPE_SLIDE_FRAMES;
   else if (flick.slideFrames > 0) flick.slideFrames -= 1;
   out.slide = i.moveY > SLIDE_STICK || flick.slideFrames > 0;
   out.jumpPressed = i.jumpPressed || !!i.pressed.up;
   out.actionPressed = i.actionPressed;
   return out;
}

/** The juice and sound of one run's events (solo = false: quieter, no popups). */
export function useEventJuice() {
   const juice = useJuice();
   const time = useGameTime();
   const dust = useMemo(createJuiceEmitter, []);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const beat = useMemo(() => ({ at: -9 }), []);
   return (run: AlienRun, ev: StepEvents, anim: HeroAnim, solo: boolean) => {
      const now = time.now;
      const r = run.runner;
      const co = run.course;
      chest.x = feet.x = r.x;
      chest.z = feet.z = -visualS(run);
      chest.y = r.h + 0.9;
      feet.y = r.h + 0.1;
      const vol = solo ? 1 : 0.6;
      if (r.sliding) juice.stream("trail", feet, 30, dust, { color: "#c4b5fd" });
      if (ev.swapped) playSfx("whoosh", { volume: 0.3 * vol, pitch: 1.4 });
      if (ev.blocked) playSfx("thud", { volume: 0.4 * vol, pitch: 1.2 });
      if (ev.slid) playSfx("whoosh", { volume: 0.35 * vol, pitch: 0.8 });
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
         juice.burst("dust", feet, 6, { color: "#c4b5fd" });
      }
      if (ev.mesaOn) {
         if (solo) juice.popup(chest, "Mesa!", { color: "#93c5fd", size: 0.06 });
         playSfx("chime", { volume: 0.4 * vol, pitch: 1.5 });
      }
      // the scan: a rising chirp as it starts, the alarm 1.5 s out, a heartbeat while you hide
      if (ev.scanStart >= 0) playSfx("zap", { volume: 0.35 * vol, pitch: 1.6 });
      if (ev.scanWarn >= 0) playSfx("alarm", { volume: 0.3 * vol, pitch: 1.4 });
      if (solo && scanEtaMs(run) < 1500 && hiddenBy(run) !== null && now - beat.at > 0.45) {
         beat.at = now;
         playSfx("thud", { volume: 0.35, pitch: 0.55 });
      }
      if (ev.unseen >= 0) {
         juice.burst("pickup", chest, 16, { color: COLORS.unseen });
         if (solo) juice.popup(chest, "UNSEEN", { color: COLORS.unseen, size: 0.08 });
         playSfx("chime", { volume: 0.6 * vol, pitch: 1.2 });
      }
      // caught by a scan (its index) or a lure's beam (-2)
      if (ev.caught !== -1) {
         anim.hitAt = now;
         juice.burst("aura", chest, 30, { color: COLORS.caught });
         if (solo) juice.popup(chest, "Caught!", { color: COLORS.caught, size: 0.08 });
         juice.shake(0.3);
         playSfx("zap", { volume: 0.7 * vol, pitch: 0.6 });
      }
      if (ev.released) juice.burst("dust", feet, 10, { color: "#f5d0fe" });
      if (ev.cleared >= 0) {
         const o = co.obstacles[ev.cleared];
         juice.burst("trail", { x: laneX(o.lane), y: 1, z: -visualS(run) - 0.5 }, 10, { color: "#e9d5ff" });
         playSfx("whoosh", { volume: 0.35 * vol, pitch: 1.6 });
      }
      if (ev.miss >= 0) {
         anim.hitAt = now;
         juice.burst("hit", chest, 20, { color: COLORS.miss });
         if (solo) juice.popup(chest, co.obstacles[ev.miss].kind === "arch" ? "Slide!" : "Jump!", { color: "#fca5a5", size: 0.07 });
         juice.shake(0.35);
         juice.hitStop(70);
         playSfx("hit", { volume: 0.6 * vol });
      }
      if (ev.meteorLand >= 0) {
         const m = co.meteors[ev.meteorLand];
         const at = { x: laneX(m.lane), y: 0.3, z: -itemVisualS(run, m.s) };
         juice.burst("dust", at, 30, { color: "#fdba74" });
         juice.burst("hit", at, 14, { color: "#fb923c" });
         juice.kick(0, -1, 0, 3);
         juice.shake(0.3);
         playSfx("boom", { volume: 0.55 * vol, pitch: 0.8 });
      }
      if (ev.plantLit >= 0) {
         const p = co.plants[ev.plantLit];
         juice.burst("aura", { x: laneX(p.lane), y: 1.2, z: -itemVisualS(run, p.s) }, 24, { color: COLORS.plantLit });
         if (solo) juice.popup(chest, "Lit up!", { color: COLORS.plantLit, size: 0.06 });
         playSfx("zap", { volume: 0.45 * vol, pitch: 1.8 });
      }
      if (ev.gooIn) {
         juice.burst("dust", feet, 14, { color: COLORS.goo });
         playSfx("pop", { volume: 0.4 * vol, pitch: 0.6 });
      }
      if (ev.caveOpen) {
         juice.burst("hit", chest, 26, { color: COLORS.ghost });
         playSfx("whoosh", { volume: 0.6 * vol, pitch: 1.1 });
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
      if (ev.powered) {
         juice.burst("aura", chest, 14, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.5 * vol, pitch: 1.15 });
      }
      if (ev.bossWoke) {
         juice.shake(0.4);
         juice.popup(chest, "The Mothership!", { color: "#f0abfc", size: 0.08 });
         playSfx("boom", { volume: 0.7, pitch: 0.6 });
      }
      if (ev.lureLock >= 0) {
         if (solo) juice.popup(chest, "Locked on! Dodge!", { color: "#f0abfc", size: 0.06 });
         playSfx("alarm", { volume: 0.35 * vol, pitch: 1.6 });
      }
      if (ev.bossTelegraph) playSfx("alarm", { volume: 0.2 * vol, pitch: 1.2 });
      if (ev.bossAttack) juice.shake(0.2);
      if (ev.bossCharge >= 0) {
         juice.burst("checkpoint", chest, 26, { color: "#fde047" });
         if (solo) juice.popup(chest, "Charged!", { color: "#fde047", size: 0.065 });
         playSfx("chime", { pitch: 1.6, volume: 0.6 });
      }
      if (ev.bossHit) {
         juice.burst("hit", { x: 0, y: 7, z: -visualS(run) - 20 }, 40, { color: "#f0abfc" });
         juice.shake(0.4);
         juice.hitStop(90);
         playSfx("boom", { volume: 0.7 * vol });
      }
      if (ev.bossDefeated) {
         juice.burst("checkpoint", { x: 0, y: 8, z: -visualS(run) - 40 }, 100, { color: "#e879f9" });
         juice.shake(0.6);
         juice.hitStop(140);
         if (solo) juice.popup(chest, "Mothership down!", { color: "#f0abfc", size: 0.08 });
         playSfx("boom", { volume: 0.9, pitch: 0.7 });
      }
      if (ev.bossDone && solo) playSfx("win", { volume: 0.6 });
   };
}
