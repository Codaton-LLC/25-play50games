// The game HUD's one transient message (Hud.tsx). Pure, no React, so hint.test.ts and camera.test.ts
// share it. The slot that shows it is a fixed box marked data-arcade-safe-area, laid out in every
// phase: a message appearing or changing never changes the camera fit (README "HUD").
import type { RunPhase } from "@/arcade3d/core/types";
import { HOLD_MS } from "./rules";

/** How long the checkpoint notice stays up after the runner lands on a new checkpoint (run ms). */
export const CHECKPOINT_NOTICE_MS = 1500;

/**
 * Where the slot sits (CSS px, mirrored by Hud.module.css; hint.test.ts checks the CSS). Fine pointer:
 * under the shell's score chips, left of the centred column. Coarse pointer (touch controls shown):
 * between the joystick (20 + 132 px) and the Jump button (72 + 20 px), on the controls' bottom line.
 */
export const HINT_SLOT = {
   fine: { left: 10, top: 60, width: 220, height: 34 },
   coarse: { left: 160, right: 100, bottom: 20, height: 52 },
} as const;

/** The message due now, or null (the slot then draws nothing). */
export function towerHint(phase: RunPhase, elapsedMs: number, fallen: boolean, checkpoint: number, checkpointAtMs: number): string | null {
   if (fallen) return "You fell! Nice climb.";
   if (phase === "over") return null;
   // countdown and the 350 ms opening hold (paused there too)
   if (elapsedMs < HOLD_MS) return "Left / right, then Jump";
   const age = elapsedMs - checkpointAtMs;
   if (checkpoint > 0 && age >= 0 && age < CHECKPOINT_NOTICE_MS) return `Checkpoint ${checkpoint} · safe ledge`;
   return null;
}
