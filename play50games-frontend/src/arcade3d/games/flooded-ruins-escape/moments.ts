// The moments solo (Scene.tsx) and multiplayer (MultiScene.tsx) share: the world's one-off juice
// (lever rumbles, broken brick, bubbles, the tide starting, the boss's hits, phases and defeat) and
// the boss's HUD stats (Hud.tsx reads them). No three.js: the juice API and the store only.
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { playSfx } from "@/arcade3d/core/audio";
import type { JuiceApi } from "@/arcade3d/menu2/juice";
import { STAT, type RuinRun, type StepEvents } from "./rules";

/** STAT.bossStep: the boss's step as an index (Scene.tsx publishes it). */
export const BOSS_STEPS = ["intro", "telegraph", "attack", "vulnerable", "transition", "defeat", "done"] as const;

/** What each phase asks of the player (under the health bar). */
export const BOSS_HINTS = ["Flood the ring basin, then land on its back", "Hold all three pressure levers: the geyser throws it up", "Drop the floodgate on it: pull the lever while it sits on the gate"] as const;

/** The boss's HUD stats (level 5): hp, phase, step index, hit flash. */
export function publishBoss(run: RuinRun): void {
   const b = run.boss;
   if (!b) return;
   const store = useArcadeStore.getState();
   const stepIndex = Math.max(0, BOSS_STEPS.indexOf(b.step as (typeof BOSS_STEPS)[number]));
   const flash = b.flashMs > 0 ? 1 : 0;
   if (store.stats[STAT.bossHp] !== b.hp) store.setStat(STAT.bossHp, b.hp);
   if (store.stats[STAT.bossPhase] !== b.phase) store.setStat(STAT.bossPhase, b.phase);
   if (store.stats[STAT.bossStep] !== stepIndex) store.setStat(STAT.bossStep, stepIndex);
   if (store.stats[STAT.bossFlash] !== flash) store.setStat(STAT.bossFlash, flash);
}

/** The world's one-off moments shared by solo and multiplayer: levers, bricks, bubbles, the tide, the boss. */
export function worldJuice(run: RuinRun, ev: StepEvents, juice: JuiceApi, chest: { x: number; y: number; z: number }, volume = 1): void {
   if (ev.lever >= 0) {
      const l = run.course.levers[ev.lever];
      // the lever's rumble, and the water starts to move
      juice.burst("dust", { x: l.x, y: l.y + 0.2, z: l.z }, 12);
      juice.shake(0.12);
      playSfx("thud", { volume: 0.7 * volume, pitch: 0.7 });
   }
   if (ev.broke >= 0) {
      const s = run.course.supports[ev.broke];
      const p = { x: s.cx, y: s.top - 0.3, z: s.cz };
      juice.burst("dust", p, 26, { color: "#b8a089" });
      juice.burst("hit", p, 14, { color: "#fde68a" });
      juice.shake(0.2);
      juice.hitStop(50);
      playSfx("boom", { volume: 0.55 * volume, pitch: 1.3 });
   }
   if (ev.bubbles) {
      juice.burst("aura", chest, 14, { color: "#e0f7ff" });
      playSfx("pop", { volume: 0.4 * volume, pitch: 1.4 });
   }
   if (ev.tideStarted) {
      juice.popup(chest, "The storm tide is rising!", { color: "#c4b5fd", size: 0.07 });
      playSfx("alarm", { volume: 0.35 * volume });
   }
   if (ev.bossHit) {
      const p = run.bossPose;
      const at = { x: p.x, y: p.y + 1.6, z: p.z };
      juice.burst("hit", at, 30, { color: "#c4b5fd" });
      juice.burst("checkpoint", at, 24);
      juice.shake(0.3);
      juice.hitStop(90);
      playSfx("boom", { volume: 0.8 * volume });
   }
   if (ev.bossPhase && !ev.bossDefeated) {
      juice.popup(chest, "Umbra Roller is angry!", { color: "#c4b5fd", size: 0.07 });
      playSfx("buzz", { volume: 0.5 * volume });
   }
   if (ev.bossDefeated) {
      const p = run.bossPose;
      juice.burst("checkpoint", { x: p.x, y: p.y + 1.2, z: p.z }, 90);
      juice.popup(chest, "Umbra Roller is beaten! Ring the Tide Bell!", { color: "#fde68a", size: 0.07 });
      playSfx("win", { volume: 0.7 * volume });
   }
   if (ev.boss.telegraph) playSfx("buzz", { volume: 0.3 * volume, pitch: 0.6 });
}

