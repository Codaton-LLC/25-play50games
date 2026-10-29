"use client";

// The input mapping and the juice of one run's events, shared by Scene.tsx (solo) and MultiScene.tsx.
import { useMemo } from "react";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { playSfx } from "@/arcade3d/core/audio";
import { createJuiceEmitter, useJuice } from "@/arcade3d/menu2/juice";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import { onIce, type HeroAnim } from "./Hero";
import { ORB, speedOf, type PeakRun, type StepEvents, type StepInput } from "./rules";
import { SECRETS } from "./progression";

/** The stick pulled back this far brakes (keys: S / Down). */
export const BRAKE_STICK = 0.55;

/** The core input -> this game's StepInput (the stick camera-relative; pulled back = the brake). */
export function mapInput(i: { moveX: number; moveY: number; jumpPressed: boolean; actionPressed: boolean }, yaw: number, out: StepInput): StepInput {
   out.moveX = i.moveX;
   out.moveZ = i.moveY;
   out.yaw = yaw;
   out.brake = i.moveY > BRAKE_STICK;
   out.jumpPressed = i.jumpPressed;
   out.actionPressed = i.actionPressed;
   return out;
}

/** The juice and sound of one run's events (solo; MultiScene passes solo = false for a quieter mix). */
export function useEventJuice() {
   const juice = useJuice();
   const time = useGameTime();
   const spray = useMemo(createJuiceEmitter, []);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   return (run: PeakRun, ev: StepEvents, anim: HeroAnim, solo: boolean) => {
      const now = time.now;
      const h = run.hero;
      const co = run.course;
      chest.x = feet.x = h.x;
      chest.z = feet.z = h.z;
      chest.y = h.y + 0.8;
      feet.y = h.y + 0.08;
      const vol = solo ? 1 : 0.6;
      // the ice spray: grows with the speed; a brake throws a fan of it
      const s = speedOf(run);
      if (onIce(run) && (s > 2.5 || h.braking)) juice.stream("dust", feet, (h.braking ? 40 : 0) + s * 4, spray, { color: "#e0f2fe" });
      if (ev.airJumped) {
         anim.airJumpAt = now;
         juice.burst("trail", chest, 12, { color: "#bfdbfe" });
         playSfx("jump", { volume: 0.5 * vol, pitch: 1.3 });
      } else if (ev.jumped) {
         anim.jumpAt = now;
         juice.burst("dust", feet, 8, { color: "#f1f5f9" });
         playSfx("jump", { volume: 0.5 * vol });
      }
      if (ev.landed >= 0) {
         anim.landAt = now;
         const hard = ev.landSpeed > 9;
         juice.burst("dust", feet, hard ? 18 : 9, { color: "#f8fafc" });
         if (hard) {
            // frost cracks on a hard landing
            juice.burst("hit", feet, 10, { color: "#bae6fd" });
            if (solo) juice.kick(0, -1, 0, 1.4);
         }
         playSfx("thud", { volume: 0.3 * vol, pitch: hard ? 0.9 : 1.2 });
      }
      if (ev.perfect) {
         juice.burst("checkpoint", feet, 22, { color: "#e0f2fe" });
         if (solo) juice.popup(chest, "Perfect!", { color: "#bae6fd", size: 0.06 });
         playSfx("chime", { volume: 0.5 * vol, pitch: 1.9 });
      }
      if (ev.checkpoint >= 0) {
         juice.burst("checkpoint", chest, 26, { color: "#fde68a" });
         if (solo) juice.popup(chest, "Checkpoint", { color: "#ffd257", size: 0.055 });
         playSfx("chime", { volume: 0.5 * vol });
      }
      if (ev.cracked >= 0) playSfx("click", { volume: 0.6 * vol, pitch: 0.6 });
      if (ev.crumbled >= 0) {
         const p = co.plats[ev.crumbled];
         const at = { x: p.x, y: p.y, z: p.z };
         juice.burst("hit", at, 30, { color: "#bfdbfe" });
         juice.burst("dust", at, 16, { color: "#e0f2fe" });
         playSfx("pop", { volume: 0.6 * vol, pitch: 0.7 });
      }
      for (let k = 0; k < ev.orbCount; k++) {
         const o = co.orbs[ev.orbList[k]];
         juice.burst("pickup", o, 12);
         if (solo) juice.popup(o, `-${(ORB.bonusMs / 1000).toFixed(1)} s`, { color: "#ffe08a" });
         playSfx("pickup", { volume: vol, pitch: 1 + Math.min(0.6, run.orbs * 0.02) });
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         const color = spec.kind === "shard" ? "#bae6fd" : "#fde68a";
         juice.burst("checkpoint", chest, 30, { color });
         juice.popup(chest, `${spec.name}!`, { color, size: 0.07 });
         juice.hitStop(40);
         playSfx("chime", { pitch: 1.4 });
      }
      if (solo && ev.comboLinked && run.combo.chain > 2) playSfx("combo", { pitch: 0.9 + run.combo.multiplier * 0.2, volume: 0.3 });
      if (ev.powered) {
         juice.burst("aura", chest, 14, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.5 * vol, pitch: 1.15 });
      }
      if (ev.broke >= 0) {
         const w = co.walls[ev.broke];
         const at = { x: w.x, y: (w.y0 + w.y1) / 2, z: w.z };
         juice.burst("hit", at, 34, { color: "#bae6fd" });
         juice.shake(0.2);
         juice.hitStop(50);
         playSfx("pop", { volume: 0.8 * vol, pitch: 0.6 });
      }
      if (ev.blocked) {
         juice.burst("aura", chest, 24, { color: "#4ade80" });
         if (solo) juice.popup(chest, "Shielded!", { color: "#86efac", size: 0.06 });
         playSfx("zap", { volume: 0.5 * vol, pitch: 1.3 });
      }
      if (ev.hit) {
         anim.hitAt = now;
         juice.burst("hit", chest, 18, { color: "#e0f2fe" });
         juice.shake(0.3);
         juice.hitStop(70);
         playSfx("hit", { volume: 0.6 * vol });
      }
      if (ev.lost) {
         anim.lostAt = now;
         juice.burst("dust", chest, 16, { color: "#e2e8f0" });
         playSfx("lose", { volume: 0.4 * vol });
      }
      if (ev.respawned) {
         anim.spawnAt = now;
         juice.burst("pickup", chest, 20, { color: heroAccent(run.heroId) });
         playSfx("pop", { volume: vol });
      }
      if (ev.rideStart) {
         if (solo) juice.popup(chest, "Ride!", { color: "#e0f2fe", size: 0.06 });
         playSfx("whoosh", { volume: 0.4 * vol, pitch: 0.8 });
      }
      if (ev.icicleShake >= 0) playSfx("click", { volume: 0.35 * vol, pitch: 1.6 });
      if (ev.icicleDrop >= 0) {
         const c = co.icicles[ev.icicleDrop];
         juice.burst("hit", { x: c.x, y: c.y + 0.2, z: c.z }, 16, { color: "#e0f2fe" });
         playSfx("pop", { volume: 0.5 * vol, pitch: 1.4 });
      }
      if (ev.thrown >= 0) playSfx("whoosh", { volume: 0.4 * vol, pitch: 0.6 });
      if (ev.bossWoke) {
         juice.shake(0.45);
         juice.popup(chest, "The Frost Golem wakes!", { color: "#bae6fd", size: 0.075 });
         playSfx("boom", { volume: 0.8, pitch: 0.45 });
      }
      if (ev.bossTelegraph) playSfx("alarm", { volume: 0.3 * vol, pitch: 0.7 });
      if (ev.bossAttack) {
         juice.shake(0.35);
         playSfx("boom", { volume: 0.6 * vol, pitch: 0.55 });
      }
      if (ev.bossCharge >= 0) {
         juice.burst("checkpoint", chest, 26, { color: "#facc15" });
         if (solo) juice.popup(chest, ev.bossCharge === 0 ? "On his back!" : ev.bossCharge === 1 ? "On his shoulder!" : "At his crystal!", { color: "#fde047", size: 0.065 });
         playSfx("chime", { pitch: 1.6, volume: 0.6 });
      }
      if (ev.bossHit) {
         juice.burst("hit", chest, 40, { color: "#fef08a" });
         juice.shake(0.45);
         juice.hitStop(90);
         playSfx("boom", { volume: 0.7 * vol });
      }
      if (ev.bossDefeated) {
         juice.burst("checkpoint", chest, 90, { color: "#fde68a" });
         juice.shake(0.6);
         juice.hitStop(140);
         if (solo) juice.popup(chest, "The crystal shatters!", { color: "#fde68a", size: 0.08 });
         playSfx("boom", { volume: 0.9, pitch: 0.7 });
      }
      if (ev.bossDone && solo) playSfx("win", { volume: 0.6 });
   };
}
