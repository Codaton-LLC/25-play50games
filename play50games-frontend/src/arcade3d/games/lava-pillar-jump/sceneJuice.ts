"use client";

// The juice of the heartbeat, the vents, crumbling tops and Kalder (shared by Scene.tsx and
// MultiScene.tsx), and the boss numbers the HUD's health bar reads.
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { playSfx } from "@/arcade3d/core/audio";
import type { useJuice } from "@/arcade3d/menu2/juice";
import { NONE, STAT, type LavaRun, type StepEvents } from "./rules";

type Juice = ReturnType<typeof useJuice>;
interface Spot {
   x: number;
   y: number;
   z: number;
}

/**
 * The juice of one step's events (shared by the solo and the multiplayer scene): the heartbeat, vents,
 * crumbles, Kalder. `quiet` lowers the volumes for 2-4 players.
 */
export function heartbeatJuice(juice: Juice, run: LavaRun, ev: StepEvents, chest: Spot, feet: Spot, quiet = false): void {
   const v = quiet ? 0.6 : 1;
   if (ev.telegraph) {
      playSfx("thud", { volume: 0.35 * v, pitch: 0.55 });
      juice.kick(0, -1, 0, 0.8);
   }
   if (ev.beat) {
      playSfx("thud", { volume: 0.7 * v, pitch: 0.45 });
      juice.shake(run.bossStartMs !== NONE ? 0.3 : 0.14);
      juice.kick(0, 1, 0, 1.6);
   }
   if (ev.vented) {
      juice.burst("hit", feet, 26, { color: "#ffb347", vy: 9 });
      juice.burst("trail", feet, 18, { color: "#ff5a1f", vy: 6 });
      juice.kick(0, 1, 0, 3);
      playSfx("whoosh", { volume: 0.8 * v, pitch: 0.8 });
   }
   if (ev.crumbled !== NONE) {
      juice.burst("hit", feet, 22, { color: "#fb923c" });
      juice.burst("dust", feet, 14, { color: "#57534e" });
      juice.shake(0.2);
      playSfx("lose", { volume: 0.4 * v, pitch: 1.4 });
   }
   if (ev.bossStarted) {
      juice.shake(0.35);
      playSfx("thud", { volume: 0.9 * v, pitch: 0.4 });
   }
   if (ev.bossHit) {
      juice.burst("hit", feet, 34, { color: "#ef4444" });
      juice.burst("checkpoint", chest, 24, { color: "#fca5a5" });
      juice.kick(0, -1, 0, 4);
      juice.shake(0.3);
      juice.hitStop(90);
      juice.popup(chest, ev.bossDefeated ? "Crust shattered!" : ev.bossPhase ? "Phase down!" : "Crust hit!", { color: "#fde68a", size: 0.07 });
      playSfx("pop", { volume: v, pitch: 0.7 });
   }
   if (ev.bossDefeated) {
      juice.burst("checkpoint", chest, 120, { color: "#ef4444" });
      juice.shake(0.6);
      juice.hitStop(140);
      playSfx("chime", { volume: v, pitch: 0.8 });
   }
}

/** Kalder's numbers for the HUD's health bar (only when they change). */
export function publishBoss(run: LavaRun): void {
   const b = run.boss;
   if (!b) return;
   const store = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   set(STAT.bossOn, run.bossStartMs !== NONE ? 1 : 0);
   set(STAT.bossHp, b.hp);
   set(STAT.bossPhase, b.phase);
   set(STAT.bossOpen, b.step === "vulnerable" ? 1 : 0);
   set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
}

