"use client";

// The input mapping and the juice of one run's events, shared by Scene.tsx (solo) and MultiScene.tsx.
import { useMemo } from "react";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { playSfx } from "@/arcade3d/core/audio";
import { createJuiceEmitter, useJuice } from "@/arcade3d/menu2/juice";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import type { HeroAnim } from "./Hero";
import { ORB, type CaveRun, type StepEvents, type StepInput } from "./rules";
import { CINDERMAW, SECRETS } from "./progression";
import { lanePoint } from "./track";

/** The stick held down this far ducks (the core's moveY: down = +1). */
export const DUCK_STICK = 0.55;

/** The core input -> this game's StepInput: the stick leans (camera-relative), down ducks, a left / right press or swipe swaps lanes. */
export function mapInput(
   i: { moveX: number; moveY: number; jumpPressed: boolean; actionPressed: boolean; pressed: { left: boolean; right: boolean } },
   yaw: number,
   out: StepInput,
): StepInput {
   out.moveX = i.moveX;
   out.moveZ = i.moveY;
   out.yaw = yaw;
   out.duck = i.moveY > DUCK_STICK;
   out.jumpPressed = i.jumpPressed;
   out.actionPressed = i.actionPressed;
   out.swapLeft = i.pressed.left;
   out.swapRight = i.pressed.right;
   return out;
}

/** The juice and sound for one run's events (the solo scene; MultiScene uses a quieter subset). */
export function useEventJuice() {
   const juice = useJuice();
   const time = useGameTime();
   const at = useMemo(() => ({ x: 0, y: 0, z: 0, h: 0 }), []);
   const sparks = useMemo(createJuiceEmitter, []);
   return (run: CaveRun, ev: StepEvents, anim: HeroAnim, solo: boolean) => {
      const now = time.now;
      const c = run.cart;
      const co = run.course;
      const lane = co.lanes[c.lane];
      lanePoint(co, c.s, c.d, lane.y + Math.max(0, c.h) + 0.9, at);
      const chest = at;
      const vol = solo ? 1 : 0.6;
      if (ev.airHopped) {
         anim.airHopAt = now;
         juice.burst("dust", chest, 10, { color: "#fed7aa" });
         playSfx("jump", { volume: 0.5 * vol, pitch: 1.25 });
      } else if (ev.hopped) {
         anim.hopAt = now;
         playSfx("jump", { volume: 0.5 * vol, pitch: 0.85 });
      }
      if (ev.landed) {
         anim.landAt = now;
         juice.burst("dust", { x: chest.x, y: chest.y - 0.9, z: chest.z }, 8, { color: "#a8a29e" });
         if (solo) juice.kick(0, -1, 0, 1.2);
         playSfx("thud", { volume: 0.35 * vol, pitch: 1.3 });
      }
      if (ev.swapped) playSfx("whoosh", { volume: 0.35 * vol, pitch: 1.4 });
      if (ev.perfectLean) {
         juice.burst("trail", chest, 10, { color: "#fde68a" });
         if (solo) juice.popup(chest, "Perfect lean!", { color: "#fde68a", size: 0.06 });
         playSfx("combo", { volume: 0.35 * vol, pitch: 1.2 });
      }
      if (ev.tilted) {
         if (solo) juice.popup(chest, "Lean the other way!", { color: "#fca5a5", size: 0.065 });
         playSfx("alarm", { volume: 0.35 * vol, pitch: 1.4 });
      }
      // wheel sparks while it rides on two wheels
      if (c.tilted && c.state === "ride") juice.stream("hit", { x: chest.x, y: chest.y - 0.85, z: chest.z }, 60, sparks, { color: "#fbbf24" });
      for (let k = 0; k < ev.orbCount; k++) {
         const o = co.orbs[ev.orbList[k]];
         const l = co.lanes[o.lane];
         const p = lanePoint(co, o.s, l.d + o.dx, l.y + o.h + ORB.centerY, { x: 0, y: 0, z: 0, h: 0 });
         juice.burst("pickup", p, 12);
         if (solo) juice.popup(p, `-${(ORB.bonusMs / 1000).toFixed(2)} s`, { color: "#ffe08a" });
         playSfx("pickup", { volume: vol, pitch: 1 + Math.min(0.6, run.orbs * 0.02) });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         const color = spec.kind === "shard" ? "#fdba74" : "#f9a8d4";
         juice.burst("checkpoint", chest, 30, { color });
         juice.popup(chest, `${spec.name}!`, { color, size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (solo && ev.comboLinked && run.combo.chain > 2) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.3 });
      if (ev.checkpoint > 0) {
         juice.burst("checkpoint", chest, 30, { color: "#fcd34d" });
         if (solo) juice.popup(chest, "Lantern!", { color: "#ffd257", size: 0.06 });
         playSfx("chime", { volume: 0.6 * vol });
      }
      if (ev.barricade >= 0) {
         juice.burst("hit", chest, 30, { color: "#f59e0b" });
         juice.burst("dust", chest, 18, { color: "#a8a29e" });
         juice.shake(0.25);
         juice.hitStop(60);
         if (solo) juice.popup(chest, "Shortcut! +20", { color: "#fde68a", size: 0.07 });
         playSfx("boom", { volume: 0.6 * vol, pitch: 1.2 });
      }
      if (ev.scaffold) {
         juice.burst("trail", chest, 16, { color: "#93c5fd" });
         if (solo) juice.popup(chest, "Upper track!", { color: "#93c5fd", size: 0.065 });
      }
      if (ev.powered) {
         juice.burst("aura", chest, 14, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.5 * vol, pitch: 1.15 });
      }
      if (ev.cleared >= 0 && co.hazards[ev.cleared]?.kind === "crystal") juice.burst("pickup", chest, 8, { color: "#c4b5fd" });
      if (ev.woke) {
         juice.shake(0.45);
         juice.hitStop(80);
         juice.popup(chest, "Cindermaw wakes!", { color: "#fb923c", size: 0.08 });
         playSfx("boom", { volume: 0.8, pitch: 0.45 });
         playSfx("alarm", { volume: 0.35, pitch: 0.6 });
      }
      if (ev.breathWarn) {
         // the roar: a shake and a low alarm, 1.0 s before the fire
         juice.shake(0.2);
         playSfx("alarm", { volume: 0.45 * vol, pitch: 0.55 });
         playSfx("boom", { volume: 0.3 * vol, pitch: 0.4 });
      }
      if (ev.breathFire) {
         juice.shake(0.3);
         playSfx("whoosh", { volume: 0.8 * vol, pitch: 0.45 });
      }
      if (ev.absorbed) {
         juice.burst("aura", chest, 24, { color: "#4ade80" });
         if (solo) juice.popup(chest, "Shielded!", { color: "#86efac", size: 0.065 });
         playSfx("zap", { volume: 0.5 * vol, pitch: 1.3 });
      }
      if (ev.hit) {
         anim.hitAt = now;
         juice.burst("hit", chest, 18, { color: "#fb923c" });
         juice.shake(0.35);
         juice.hitStop(70);
         playSfx("hit", { volume: 0.6 * vol });
      }
      if (ev.caught) {
         juice.burst("hit", chest, 30, { color: "#ef4444" });
         if (solo) juice.popup(chest, "Caught!", { color: "#fca5a5", size: 0.08 });
         juice.shake(0.5);
         playSfx("boom", { volume: 0.6 * vol, pitch: 0.6 });
      }
      if (ev.lost) {
         anim.lostAt = now;
         juice.burst("dust", chest, 20, { color: "#78716c" });
         juice.hitStop(90);
         playSfx("lose", { volume: 0.5 * vol });
      }
      if (ev.respawned) {
         anim.spawnAt = now;
         juice.burst("pickup", chest, 20, { color: heroAccent(run.heroId) });
         if (solo) juice.popup(chest, "Back at the lantern", { color: "#fca5a5" });
         playSfx("pop", { volume: vol });
      }
      if (ev.bossTelegraph) playSfx("alarm", { volume: 0.25 * vol, pitch: run.boss && run.boss.phase === 1 ? 1.1 : 0.7 });
      if (ev.bossCharge >= 0) {
         const e = co.bossEvents[ev.bossCharge];
         const text = e.kind === "plate" ? "Crystal drops!" : e.kind === "ramp" ? "Ore flung!" : "Lock struck!";
         juice.burst("checkpoint", chest, 22, { color: e.kind === "lock" ? "#a78bfa" : "#fde68a" });
         if (solo) juice.popup(chest, text, { color: "#fde68a", size: 0.065 });
         playSfx("click", { pitch: 0.7 });
         playSfx("chime", { pitch: 1.6, volume: 0.6 });
      }
      if (ev.bossHit) {
         juice.burst("hit", chest, 40, { color: "#fef08a" });
         juice.shake(0.4);
         juice.hitStop(90);
         playSfx("boom", { volume: 0.7 * vol });
      }
      if (ev.bossPhase && run.boss && run.boss.hp > 0 && solo) juice.popup(chest, CINDERMAW.phases[run.boss.phase]?.name ?? "", { color: "#fdba74", size: 0.075 });
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 90, { color: "#f87171" });
         juice.shake(0.6);
         juice.hitStop(140);
         if (solo) juice.popup(chest, "The collar breaks!", { color: "#fecaca", size: 0.08 });
         playSfx("boom", { volume: 0.9, pitch: 0.7 });
      }
      if (ev.bossDone && solo) {
         juice.popup(chest, "She flies you out!", { color: "#fde68a", size: 0.075 });
         playSfx("win", { volume: 0.6 });
      }
   };
}
