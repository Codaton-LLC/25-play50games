"use client";

// The juice of slope momentum, the updrafts, the skylights and Ashback (shared by Scene.tsx and
// MultiScene.tsx), the ember trail behind a fast ball, and the numbers the HUD's boss bar and speed
// meter read.
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { playSfx } from "@/arcade3d/core/audio";
import type { JuiceEmitter, useJuice } from "@/arcade3d/menu2/juice";
import { BANK_SPEED, NONE, STAT, heroSpeed, type RoofRun, type StepEvents } from "./rules";

type Juice = ReturnType<typeof useJuice>;
interface Spot {
   x: number;
   y: number;
   z: number;
}

/** The ember trail starts at this speed (m/s): the card's "speed lines at 10 m/s or more". */
export const TRAIL_SPEED = 10;

/**
 * The juice of one step's events (shared by the solo and the multiplayer scene): updrafts, banked
 * leaps, smashed skylights, Ashback. `quiet` lowers the volumes for 2-4 players.
 */
export function roofJuice(juice: Juice, run: RoofRun, ev: StepEvents, chest: Spot, feet: Spot, quiet = false): void {
   const v = quiet ? 0.6 : 1;
   if (ev.bounced) {
      juice.burst("trail", feet, 26, { color: "#fde68a", vy: 8 });
      juice.burst("dust", feet, 12, { color: "#e7e5e4", vy: 4 });
      juice.kick(0, 1, 0, 2.5);
      playSfx("whoosh", { volume: 0.7 * v, pitch: 1.3 });
   }
   if (ev.banked) {
      // a banked leap off a slope's lip: sparks off the gutter, the camera thrown forward
      juice.burst("hit", feet, 18, { color: "#fb923c" });
      juice.burst("trail", chest, 14, { color: "#ef4444", vx: -run.hero.vx * 0.2, vz: -run.hero.vz * 0.2 });
      juice.kick(run.hero.vx / Math.max(1, heroSpeed(run.hero)), 0, run.hero.vz / Math.max(1, heroSpeed(run.hero)), 1.8);
      juice.popup(chest, `${ev.bankSpeed.toFixed(1)} m/s!`, { color: "#fdba74" });
      playSfx("whoosh", { volume: 0.6 * v, pitch: 0.9 + Math.min(0.6, (ev.bankSpeed - BANK_SPEED) * 0.12) });
   }
   if (ev.broke !== NONE) {
      const b = run.course.blocks[ev.broke];
      const p = { x: b.cx, y: b.y1, z: b.cz };
      juice.burst("hit", p, 30, { color: "#bae6fd" });
      juice.burst("dust", p, 14, { color: "#94a3b8" });
      juice.shake(0.22);
      juice.hitStop(60);
      juice.popup(p, "Smash!", { color: "#e0f2fe", size: 0.07 });
      playSfx("pop", { volume: v, pitch: 1.5 });
   }
   if (ev.bossWoke) {
      juice.shake(0.3);
      juice.popup(chest, "Ashback!", { color: "#cbd5e1", size: 0.08 });
      playSfx("thud", { volume: 0.9 * v, pitch: 0.6 });
   }
   if (ev.bossTelegraph) playSfx("thud", { volume: 0.4 * v, pitch: 0.9 });
   if (ev.bossAttack) {
      juice.shake(0.18);
      playSfx("whoosh", { volume: 0.7 * v, pitch: 0.7 });
   }
   if (ev.bossHit) {
      const b = run.boss;
      const p = b ? { x: b.x, y: b.y + 1, z: b.z } : chest;
      juice.burst("hit", p, 34, { color: "#ef4444" });
      juice.burst("checkpoint", p, 22, { color: "#fca5a5" });
      juice.kick(0, -1, 0, 4);
      juice.shake(0.3);
      juice.hitStop(110);
      juice.popup(p, ev.bossDefeated ? "Ashback flees!" : ev.bossPhase ? "Phase down!" : "Hit!", { color: "#fde68a", size: 0.07 });
      playSfx("pop", { volume: v, pitch: 0.75 });
   }
   if (ev.bossDefeated) {
      // the slow-mo finish: the longest hit-stop the juice allows
      juice.burst("checkpoint", chest, 120, { color: "#ef4444" });
      juice.shake(0.55);
      juice.hitStop(140);
      playSfx("chime", { volume: v, pitch: 0.8 });
   }
}

/** The ember trail behind a ball rolling or flying at TRAIL_SPEED or more (call every frame). */
export function emberTrail(juice: Juice, run: RoofRun, at: Spot, emitter: JuiceEmitter): void {
   const h = run.hero;
   if (h.state !== "play") return;
   const sp = heroSpeed(h);
   if (sp < TRAIL_SPEED) return;
   juice.stream("trail", at, 30 + (sp - TRAIL_SPEED) * 18, emitter, { color: sp > 12 ? "#ef4444" : "#fb923c", vx: -h.vx * 0.25, vz: -h.vz * 0.25 });
}

/** Ashback's numbers and the speed for the HUD (only when they change). */
export function publishRoof(run: RoofRun): void {
   const store = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   set(STAT.speed, Math.round(heroSpeed(run.hero) * 10));
   const b = run.boss;
   if (!b) return;
   set(STAT.bossAwake, b.wokeMs !== NONE ? 1 : 0);
   set(STAT.bossHp, b.state.hp);
   set(STAT.bossPhase, b.state.phase);
   set(STAT.bossOpen, b.state.step === "vulnerable" ? 1 : 0);
   set(STAT.bossFlash, b.state.flashMs > 0 ? 1 : 0);
}
