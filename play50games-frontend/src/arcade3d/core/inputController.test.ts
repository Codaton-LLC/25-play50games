import { beforeEach, describe, expect, it } from "vitest";
import { SWIPE_MIN_PX, createInputController, type InputController } from "./inputController";

let input: InputController;
const state = () => input.state.current;

beforeEach(() => {
   input = createInputController();
});

describe("movement", () => {
   it("maps WASD and arrows, up is -1", () => {
      input.keyDown("KeyW");
      input.keyDown("ArrowRight");
      input.latch();
      expect(state().moveY).toBeCloseTo(-Math.SQRT1_2);
      expect(state().moveX).toBeCloseTo(Math.SQRT1_2);
      input.keyUp("KeyW");
      input.latch();
      expect(state().moveX).toBe(1);
      expect(state().moveY).toBe(0);
   });

   it("opposite keys cancel out", () => {
      input.keyDown("KeyA");
      input.keyDown("KeyD");
      input.latch();
      expect(state().moveX).toBe(0);
   });

   it("uses the joystick vector and clamps it", () => {
      input.setJoystick(0.5, 2);
      input.latch();
      expect(state().moveX).toBeCloseTo(0.5 / Math.hypot(0.5, 1));
      expect(state().moveY).toBeCloseTo(1 / Math.hypot(0.5, 1));
   });

   it("ignores keys that are not game keys", () => {
      expect(input.keyDown("KeyQ")).toBe(false);
      expect(input.keyDown("Escape")).toBe(false);
      expect(input.keyDown("Space")).toBe(true);
   });
});

describe("one-frame events", () => {
   it("jumpPressed is true for exactly one frame, jump stays while held", () => {
      input.keyDown("Space");
      input.latch();
      expect(state().jumpPressed).toBe(true);
      expect(state().jump).toBe(true);
      input.keyDown("Space", true); // key repeat
      input.latch();
      expect(state().jumpPressed).toBe(false);
      expect(state().jump).toBe(true);
      input.keyUp("Space");
      input.latch();
      expect(state().jump).toBe(false);
   });

   it("touch buttons press once per touch", () => {
      input.setButton("jump", true);
      input.setButton("jump", true);
      input.latch();
      expect(state().jumpPressed).toBe(true);
      input.latch();
      expect(state().jumpPressed).toBe(false);
      input.setButton("action", true);
      input.latch();
      expect(state()).toMatchObject({ action: true, actionPressed: true });
      input.setButton("action", false);
      input.latch();
      expect(state()).toMatchObject({ action: false, actionPressed: false });
   });

   it("E and Enter are action", () => {
      input.keyDown("Enter");
      input.latch();
      expect(state().actionPressed).toBe(true);
   });

   it("detects swipes by the dominant axis", () => {
      input.pointerDown(0, 0, 100, 100, 0);
      input.pointerUp(100 + SWIPE_MIN_PX + 5, 110, 200);
      input.latch();
      expect(state().swipe).toBe("right");
      input.latch();
      expect(state().swipe).toBeNull();

      input.pointerDown(0, 0, 100, 100, 1000);
      input.pointerUp(95, 20, 1200);
      input.latch();
      expect(state().swipe).toBe("up");
   });

   it("slow drags are neither swipes nor taps", () => {
      input.pointerDown(0, 0, 100, 100, 0);
      input.pointerUp(200, 100, 5000);
      input.latch();
      expect(state().swipe).toBeNull();
      expect(state().tap).toBeNull();
   });

   it("short presses are taps at the press position", () => {
      input.pointerDown(0.25, -0.5, 100, 100, 0);
      expect(state().pointer.down).toBe(true);
      input.pointerUp(103, 101, 120);
      expect(state().pointer.down).toBe(false);
      input.latch();
      expect(state().tap).toEqual({ x: 0.25, y: -0.5 });
      input.latch();
      expect(state().tap).toBeNull();
   });

   it("clearEvents drops pending presses", () => {
      input.keyDown("Space");
      input.clearEvents();
      input.latch();
      expect(state().jumpPressed).toBe(false);
      expect(state().jump).toBe(true);
   });
});

describe("release", () => {
   it("lets go of everything that is held", () => {
      input.keyDown("KeyW");
      input.setJoystick(1, 0);
      input.setButton("jump", true);
      input.pointerDown(0, 0, 0, 0, 0);
      input.release();
      input.latch();
      expect(state()).toMatchObject({ moveX: 0, moveY: 0, jump: false, jumpPressed: false, pointer: { down: false } });
   });

   it("keeps the same state object for the whole session", () => {
      const ref = input.state;
      const obj = ref.current;
      input.keyDown("KeyD");
      input.latch();
      input.release();
      expect(input.state).toBe(ref);
      expect(ref.current).toBe(obj);
   });
});
