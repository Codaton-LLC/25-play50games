// The input fields a skip must clear so the same key or tap cannot also act in the game.
// Structural on purpose: the intro does not import the store or the input controller.

export interface IntroInputLatch {
   moveX: number;
   moveY: number;
   jump: boolean;
   action: boolean;
   jumpPressed: boolean;
   actionPressed: boolean;
   pressed: { left: boolean; right: boolean; up: boolean; down: boolean };
   swipe: "up" | "down" | "left" | "right" | null;
   tap: { x: number; y: number } | null;
   tapDown: { x: number; y: number } | null;
   pointer: { x: number; y: number; down: boolean };
   digit?: number | null;
   drag?: { active: boolean; released: boolean; cancelled: boolean; power: number };
}

/** Drop held axes and every one-frame event. Pointer position is kept; `down` is released. */
export function swallowIntroInput(input: IntroInputLatch): void {
   input.moveX = 0;
   input.moveY = 0;
   input.jump = false;
   input.action = false;
   input.jumpPressed = false;
   input.actionPressed = false;
   input.pressed.left = false;
   input.pressed.right = false;
   input.pressed.up = false;
   input.pressed.down = false;
   input.swipe = null;
   input.tap = null;
   input.tapDown = null;
   input.pointer.down = false;
   if (input.digit !== undefined) input.digit = null;
   if (input.drag) {
      input.drag.active = false;
      input.drag.released = false;
      input.drag.cancelled = true;
      input.drag.power = 0;
   }
}
