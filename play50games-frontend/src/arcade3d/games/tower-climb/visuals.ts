// Read-only Tower pool/pose writers. All objects used by these callbacks are made at mount.
import { Matrix4, Quaternion, Vector3 } from "three";
import type { RunPhase } from "@/arcade3d/core/types";
import {
   FALLING, INTACT, WARNING, NONE, SPUR, COIN, FLAG, SLAB,
   debrisDrop, lossFall, posedMs, slabX,
   type TowerRun, type SlabSlot, type SpurSlot, type CoinSlot, type FlagSlot, type SectionSlot,
} from "./rules";

const POSITION = new Vector3(), ONE = new Vector3(1, 1, 1), ROTATION = new Quaternion();
const X_AXIS = new Vector3(1, 0, 0), Y_AXIS = new Vector3(0, 1, 0);

export interface VisualState { endNow: number; checkpointMs: number }
export function createVisualState(): VisualState { return { endNow: NONE, checkpointMs: NONE }; }

/** Coins and flags (never stood on) show only once their whole extent is inside the column. */
function fits(run: TowerRun, bottom: number, top: number): boolean {
   return bottom >= run.viewBottomY - 1e-9 && top <= run.maxHeight + 4 + 1e-9;
}

/**
 * Slabs and spurs go by their top, as the rules' collision does: a top at or above the loss line can
 * still be stood on, so it is drawn. The part of its body below the line is clipped by the pools'
 * materials (Primitives.tsx `planes[0]`, moved to viewBottomY every frame).
 */
function topInColumn(run: TowerRun, top: number, rise = 0): boolean {
   return top >= run.viewBottomY - 1e-9 && top + rise <= run.maxHeight + 4 + 1e-9;
}

export function writeSlab(run: TowerRun, slot: SlabSlot, matrix: Matrix4): false | void {
   if (!slot.active || !topInColumn(run, slot.y)) return false;
   matrix.makeTranslation(slabX(slot, run.timeMs), slot.y, 0);
}

export function writeSpur(
   run: TowerRun, slot: SpurSlot, cracked: boolean, visual: VisualState,
   now: number, reduced: boolean, matrix: Matrix4, phase: RunPhase = "playing"
): false | void {
   if (!slot.active || (cracked ? slot.state === INTACT : slot.state !== INTACT)) return false;
   let y = slot.y, rock = 0;
   if (slot.state === FALLING) y -= debrisDrop(posedMs(run, visual, phase, now) - slot.collapseMs);
   else if (slot.state === WARNING && !reduced) {
      const ms = slot.frozenAtMs >= 0 ? slot.frozenAtMs : run.timeMs;
      const age = Math.max(0, ms - slot.warnStartMs);
      rock = Math.sin(age / 1000 * Math.PI * 12) * Math.min(1, age / SPUR.warningMs) * Math.PI / 60;
   }
   // the rock tips the front and back edges up/down by this much; the top under the runner (z = 0) stays at y
   const extra = Math.abs(Math.sin(rock)) * SLAB.depth / 2;
   // A falling spur slides down through the danger line, clipped there, and goes once its top passes it.
   if (!topInColumn(run, y, extra)) return false;
   matrix.compose(POSITION.set(slot.baseX, y, 0), ROTATION.setFromAxisAngle(X_AXIS, rock), ONE);
}

export function writeCoin(run: TowerRun, slot: CoinSlot, now: number, reduced: boolean, matrix: Matrix4): false | void {
   const margin = COIN.radius + (reduced ? 0 : 0.03);
   if (!slot.active || slot.collected || !fits(run, slot.y - margin, slot.y + margin)) return false;
   const bob = reduced ? 0 : Math.sin(now * 3 + slot.id) * 0.03;
   matrix.compose(POSITION.set(slot.x, slot.y + bob, 0), ROTATION.setFromAxisAngle(Y_AXIS, now * 2), ONE);
}

export function writeFlag(run: TowerRun, slot: FlagSlot, matrix: Matrix4): false | void {
   if (!slot.active || !fits(run, slot.y, slot.y + FLAG.height)) return false;
   matrix.makeTranslation(slot.x, slot.y, 0);
}

export function writeSection(run: TowerRun, slot: SectionSlot, matrix: Matrix4): false | void {
   // Tower scenery uses two clipping planes, so only its intersection with the column is drawn.
   if (!slot.active || slot.y + 8 < run.viewBottomY || slot.y > run.maxHeight + 4) return false;
   matrix.makeTranslation(0, slot.y, -0.52);
}

export function runnerFootY(run: TowerRun, visual: VisualState, phase: RunPhase, now: number): number {
   return run.pendingLose ? lossFall(run.loss, posedMs(run, visual, phase, now)) : run.player.y;
}
