import { beforeEach, describe, expect, it } from "vitest";
import {
   SWIPE_MAX_MS,
   SWIPE_MIN_PX,
   TAP_MAX_MS,
   createCanvasPointers,
   createInputController,
   swipeDirection,
   type CanvasPointerEvent,
   type CanvasPointers,
   type InputController,
} from "./inputController";

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

describe("early swipes (fired while the pointer moves)", () => {
   it("fires as soon as the pointer has travelled SWIPE_MIN_PX, once per gesture", () => {
      input.pointerDown(0, 0, 100, 100, 0);
      input.pointerMove(0.1, 0, 100 + SWIPE_MIN_PX - 1, 100, 40);
      input.latch();
      expect(state().swipe).toBeNull();
      // exactly at the threshold, finger still down
      input.pointerMove(0.2, 0, 100 + SWIPE_MIN_PX, 100, 60);
      expect(state().pointer.down).toBe(true);
      input.latch();
      expect(state().swipe).toBe("right");
      expect(state().pressed.right).toBe(true);
      // the rest of the gesture adds nothing: no second swipe, no tap on release
      input.pointerMove(0.5, 0, 300, 100, 90);
      input.latch();
      expect(state().swipe).toBeNull();
      expect(state().pressed.right).toBe(false);
      input.pointerUp(320, 100, 120);
      input.latch();
      expect(state().swipe).toBeNull();
      expect(state().tap).toBeNull();
      expect(state().pointer.down).toBe(false);
   });

   it("keeps the dominant-axis rule, decided when the swipe fires", () => {
      expect(swipeDirection(40, 10)).toBe("right");
      expect(swipeDirection(-40, 39)).toBe("left");
      expect(swipeDirection(5, -40)).toBe("up");
      expect(swipeDirection(-5, 40)).toBe("down");
      expect(swipeDirection(30, 30)).toBe("down"); // a tie is vertical, as on release
      // up first, then a long drag to the right: still the one "up" swipe
      input.pointerDown(0, 0, 100, 100, 0);
      input.pointerMove(0, 0.1, 104, 100 - SWIPE_MIN_PX, 50);
      input.pointerMove(0.6, 0.1, 400, 70, 120);
      input.pointerUp(420, 70, 160);
      input.latch();
      expect(state().swipe).toBe("up");
      expect(state().pressed).toEqual({ left: false, right: false, up: true, down: false });
   });

   it("a slow drag is not a swipe, mid-gesture or on release", () => {
      input.pointerDown(0, 0, 100, 100, 0);
      input.pointerMove(0, 0, 105, 100, 300);
      input.pointerMove(0, 0, 100 + SWIPE_MIN_PX + 20, 100, SWIPE_MAX_MS + 1);
      input.pointerUp(200, 100, 900);
      input.latch();
      expect(state().swipe).toBeNull();
      expect(state().tap).toBeNull();
   });

   it("a short press without travel stays a tap, small jitter included", () => {
      input.pointerDown(0.3, 0.4, 100, 100, 0);
      input.pointerMove(0.31, 0.4, 104, 101, 40);
      input.pointerUp(105, 102, TAP_MAX_MS - 50);
      input.latch();
      expect(state().tap).toEqual({ x: 0.3, y: 0.4 });
      expect(state().swipe).toBeNull();
   });

   it("still fires on release when no move was seen, and moves without a gesture never swipe", () => {
      // a flick whose pointermove events never arrived (or a caller that passes no pixels)
      input.pointerDown(0, 0, 100, 100, 0);
      input.pointerMove(0.5, 0);
      input.pointerUp(100 - SWIPE_MIN_PX - 5, 100, 100);
      input.latch();
      expect(state().swipe).toBe("left");
      expect(state().pressed.left).toBe(true);
      // mouse hover: no button down, no gesture
      input.pointerMove(0, 0, 500, 500, 200);
      input.pointerMove(0, 0, 900, 500, 210);
      input.latch();
      expect(state().swipe).toBeNull();
   });

   it("a new gesture can swipe again; a cancelled one keeps the swipe it already fired", () => {
      input.pointerDown(0, 0, 100, 100, 0);
      input.pointerMove(0, 0, 100, 100 + SWIPE_MIN_PX, 30);
      input.pointerCancel();
      input.latch();
      expect(state().swipe).toBe("down");
      input.pointerDown(0, 0, 100, 100, 1000);
      input.pointerMove(0, 0, 100 + SWIPE_MIN_PX, 100, 1030);
      input.latch();
      expect(state().swipe).toBe("right");
   });
});

describe("tapDown", () => {
   it("is set on the press, before the release, for exactly one frame", () => {
      input.pointerDown(0.25, -0.5, 100, 100, 0);
      input.latch();
      expect(state().tapDown).toEqual({ x: 0.25, y: -0.5 });
      expect(state().tap).toBeNull();
      expect(state().pointer.down).toBe(true);
      input.latch();
      expect(state().tapDown).toBeNull();
      // the release is the tap, at the same position; no second tapDown
      input.pointerUp(102, 101, 120);
      input.latch();
      expect(state().tap).toEqual({ x: 0.25, y: -0.5 });
      expect(state().tapDown).toBeNull();
   });

   it("a press and release between two frames still reports tapDown, on the same frame as the tap", () => {
      input.pointerDown(-0.4, 0.6, 100, 100, 0);
      input.pointerUp(100, 100, 8);
      expect(state().tapDown).toBeNull();
      input.latch();
      expect(state().tapDown).toEqual({ x: -0.4, y: 0.6 });
      expect(state().tap).toEqual({ x: -0.4, y: 0.6 });
      expect(state().pointer.down).toBe(false);
      input.latch();
      expect(state().tapDown).toBeNull();
      expect(state().tap).toBeNull();
   });

   it("starts every gesture: a swipe and a long hold report it too", () => {
      // a flick inside one frame: tapDown and the swipe on the same frame
      input.pointerDown(0, 0, 100, 100, 0);
      input.pointerMove(0.2, 0, 100 + SWIPE_MIN_PX, 100, 20);
      input.latch();
      expect(state().tapDown).toEqual({ x: 0, y: 0 });
      expect(state().swipe).toBe("right");
      input.pointerUp(100 + SWIPE_MIN_PX, 100, 40);
      input.latch();
      expect(state().tapDown).toBeNull();
      // a hold: tapDown at once, then nothing (too long for a tap)
      input.pointerDown(0.1, 0.1, 200, 200, 1000);
      input.latch();
      expect(state().tapDown).toEqual({ x: 0.1, y: 0.1 });
      input.latch();
      input.pointerUp(200, 200, 1000 + TAP_MAX_MS + 1);
      input.latch();
      expect(state().tapDown).toBeNull();
      expect(state().tap).toBeNull();
   });

   it("two presses inside one frame count once, the latest", () => {
      input.pointerDown(0.1, 0.1, 100, 100, 0);
      input.pointerUp(100, 100, 4);
      input.pointerDown(0.7, -0.2, 300, 300, 9);
      input.latch();
      expect(state().tapDown).toEqual({ x: 0.7, y: -0.2 });
      input.latch();
      expect(state().tapDown).toBeNull();
   });

   it("clearEvents and release drop a pending or published tapDown", () => {
      input.pointerDown(0, 0, 100, 100, 0);
      input.clearEvents();
      input.latch();
      expect(state().tapDown).toBeNull();
      input.pointerUp(100, 100, 50);
      input.pointerDown(0.5, 0.5, 100, 100, 1000);
      input.latch();
      expect(state().tapDown).toEqual({ x: 0.5, y: 0.5 });
      input.release();
      expect(state().tapDown).toBeNull();
   });
});

describe("canvas pointers (multi-touch, touch controls)", () => {
   /** a PointerEvent as createCanvasPointers reads it, plus test-only canvas coords and target */
   interface FakePointer extends CanvasPointerEvent {
      x: number;
      y: number;
      controls: boolean;
   }
   type Extra = Partial<Pick<FakePointer, "pointerType" | "button" | "controls">>;
   /** pointer `id` at canvas (x, y) at time t; screen px follow the canvas coords (400 x 800 canvas) */
   const at = (id: number, x: number, y: number, t: number, extra: Extra = {}): FakePointer => ({
      pointerId: id,
      pointerType: "touch",
      button: 0,
      clientX: 200 + x * 200,
      clientY: 400 - y * 400,
      timeStamp: t,
      x,
      y,
      controls: false,
      ...extra,
   });
   let canvas: CanvasPointers<FakePointer>;

   beforeEach(() => {
      canvas = createCanvasPointers<FakePointer>(input, {
         toCanvas: (event) => [event.x, event.y],
         onControls: (event) => event.controls,
      });
   });

   it("a press and release between two frames still reports tapDown and the tap", () => {
      canvas.down(at(1, 0.3, -0.2, 0));
      canvas.up(at(1, 0.3, -0.2, 10));
      input.latch();
      expect(state().tapDown).toEqual({ x: 0.3, y: -0.2 });
      expect(state().tap).toEqual({ x: 0.3, y: -0.2 });
   });

   it("only the first finger on the canvas reports tapDown; others report nothing until it lifts", () => {
      canvas.down(at(1, -0.5, 0, 0));
      input.latch();
      expect(state().tapDown).toEqual({ x: -0.5, y: 0 });
      // a second finger lands, moves fast and lifts while the first is down: no tapDown, no swipe
      canvas.down(at(2, 0.5, 0, 20));
      canvas.move(at(2, 0.9, 0, 40));
      canvas.up(at(2, 0.9, 0, 60));
      input.latch();
      expect(state()).toMatchObject({ tapDown: null, swipe: null, tap: null, pointer: { x: -0.5, down: true } });
      // the first finger's gesture is intact: its short release is the tap
      canvas.up(at(1, -0.5, 0, 100));
      input.latch();
      expect(state().tap).toEqual({ x: -0.5, y: 0 });
      // two fingers landing inside one frame: one tapDown, the first finger's
      canvas.down(at(3, 0.2, 0.2, 1000));
      canvas.down(at(4, -0.2, -0.2, 1004));
      input.latch();
      expect(state().tapDown).toEqual({ x: 0.2, y: 0.2 });
      // once the followed finger lifts, the next finger to land reports again
      canvas.up(at(3, 0.2, 0.2, 1500));
      canvas.up(at(4, -0.2, -0.2, 1510));
      canvas.down(at(5, 0.6, 0.6, 2000));
      input.latch();
      expect(state().tapDown).toEqual({ x: 0.6, y: 0.6 });
   });

   it("never reports tapDown from the touch controls; a tap beside a held joystick still counts", () => {
      // finger 1 holds the joystick: no tapDown, its moves and release reach no gesture
      canvas.down(at(1, -0.8, -0.8, 0, { controls: true }));
      input.setJoystick(1, 0);
      canvas.move(at(1, -0.6, -0.8, 30, { controls: true }));
      input.latch();
      expect(state()).toMatchObject({ tapDown: null, swipe: null, moveX: 1, pointer: { down: false } });
      // finger 2 taps the canvas while the joystick is held
      canvas.down(at(2, 0.4, 0.3, 100));
      input.latch();
      expect(state().tapDown).toEqual({ x: 0.4, y: 0.3 });
      canvas.up(at(1, -0.6, -0.8, 120, { controls: true })); // not the canvas pointer: ignored
      expect(state().pointer.down).toBe(true);
      canvas.up(at(2, 0.4, 0.3, 150));
      input.latch();
      expect(state().tap).toEqual({ x: 0.4, y: 0.3 });
      // a Jump button press is jumpPressed only
      canvas.down(at(3, 0.8, -0.8, 1000, { controls: true }));
      input.setButton("jump", true);
      input.latch();
      expect(state()).toMatchObject({ jumpPressed: true, tapDown: null });
      canvas.up(at(3, 0.8, -0.8, 1050, { controls: true }));
      input.setButton("jump", false);
      input.latch();
      expect(state()).toMatchObject({ tapDown: null, tap: null });
   });

   it("a mouse reports tapDown for the main button only; pens and touch always", () => {
      canvas.down(at(1, 0, 0, 0, { pointerType: "mouse", button: 2 }));
      input.latch();
      expect(state().tapDown).toBeNull();
      expect(state().pointer.down).toBe(false);
      canvas.up(at(1, 0, 0, 50, { pointerType: "mouse", button: 2 }));
      canvas.down(at(1, 0.1, 0, 100, { pointerType: "mouse" }));
      input.latch();
      expect(state().tapDown).toEqual({ x: 0.1, y: 0 });
      canvas.up(at(1, 0.1, 0, 150, { pointerType: "mouse" }));
      canvas.down(at(7, -0.1, 0, 300, { pointerType: "pen" }));
      input.latch();
      expect(state().tapDown).toEqual({ x: -0.1, y: 0 });
   });

   it("a cancelled canvas pointer frees the canvas for the next one", () => {
      canvas.down(at(1, 0, 0, 0));
      input.latch();
      canvas.cancel(at(2, 0, 0, 10)); // another pointer's cancel: ignored
      expect(state().pointer.down).toBe(true);
      canvas.cancel(at(1, 0, 0, 20));
      expect(state().pointer.down).toBe(false);
      canvas.down(at(2, 0.5, 0, 30));
      input.latch();
      expect(state().tapDown).toEqual({ x: 0.5, y: 0 });
   });
});

describe("direction presses", () => {
   const none = { left: false, right: false, up: false, down: false };

   it("every arrow and WASD keydown presses its direction for exactly one frame", () => {
      const cases: Array<[string, keyof typeof none]> = [
         ["ArrowLeft", "left"],
         ["KeyA", "left"],
         ["ArrowRight", "right"],
         ["KeyD", "right"],
         ["ArrowUp", "up"],
         ["KeyW", "up"],
         ["ArrowDown", "down"],
         ["KeyS", "down"],
      ];
      for (const [code, direction] of cases) {
         input.keyDown(code);
         input.latch();
         expect(state().pressed).toEqual({ ...none, [direction]: true });
         input.latch();
         expect(state().pressed).toEqual(none);
         input.keyUp(code);
      }
   });

   it("a key tapped between two frames is never lost (moveX never saw it)", () => {
      input.keyDown("ArrowLeft");
      input.keyUp("ArrowLeft");
      input.latch();
      expect(state().moveX).toBe(0);
      expect(state().pressed.left).toBe(true);
      input.latch();
      expect(state().pressed.left).toBe(false);
   });

   it("release and press again between two frames is a new press, though moveX stays -1", () => {
      input.keyDown("KeyA");
      input.latch();
      expect(state()).toMatchObject({ moveX: -1, pressed: { left: true } });
      input.latch();
      expect(state()).toMatchObject({ moveX: -1, pressed: { left: false } });
      input.keyUp("KeyA");
      input.keyDown("KeyA");
      input.latch();
      expect(state()).toMatchObject({ moveX: -1, pressed: { left: true } });
   });

   it("auto-repeat and a key that is still down do not press again", () => {
      input.keyDown("ArrowRight");
      input.latch();
      input.keyDown("ArrowRight", true);
      input.latch();
      expect(state().pressed.right).toBe(false);
      input.keyDown("ArrowRight"); // no keyup in between (e.g. a lost keyup event)
      input.latch();
      expect(state().pressed.right).toBe(false);
      expect(state().moveX).toBe(1);
   });

   it("several directions in one frame are all pressed; other keys press none", () => {
      input.keyDown("ArrowUp");
      input.keyDown("KeyD");
      input.keyDown("Space");
      input.keyDown("Enter");
      input.latch();
      expect(state().pressed).toEqual({ left: false, right: true, up: true, down: false });
      expect(state()).toMatchObject({ jumpPressed: true, actionPressed: true });
   });

   it("one swipe is exactly one press of its direction for the whole gesture (pressed already includes swipes)", () => {
      /** Latches one frame and returns the directions pressed in it. */
      const frame = () => {
         input.latch();
         return (Object.keys(none) as Array<keyof typeof none>).filter((key) => state().pressed[key]);
      };
      // mid-gesture swipe: the move, the rest of the drag and the release
      const seen: string[] = [];
      input.pointerDown(0, 0, 100, 100, 0);
      seen.push(...frame());
      input.pointerMove(0, 0, 100 - SWIPE_MIN_PX, 100, 40);
      expect(state().swipe).toBeNull();
      seen.push(...frame());
      expect(state().swipe).toBe("left");
      input.pointerMove(0, 0, 0, 100, 80);
      seen.push(...frame());
      input.pointerUp(-20, 100, 120);
      seen.push(...frame(), ...frame());
      expect(seen).toEqual(["left"]);
      // a flick seen only on release: still one press
      input.pointerDown(0, 0, 100, 100, 1000);
      input.pointerUp(100, 100 + SWIPE_MIN_PX + 5, 1050);
      expect(frame()).toEqual(["down"]);
      expect(state().swipe).toBe("down");
      expect(frame()).toEqual([]);
      // a game that moves on `pressed` alone moves once per swipe; adding `swipe` would move twice
      let lane = 1;
      input.pointerDown(0, 0, 100, 100, 2000);
      input.pointerMove(0, 0, 100 + SWIPE_MIN_PX, 100, 2030);
      for (let i = 0; i < 3; i++) {
         input.latch();
         if (state().pressed.right) lane += 1;
         if (state().pressed.left) lane -= 1;
      }
      input.pointerUp(100 + SWIPE_MIN_PX, 100, 2060);
      input.latch();
      if (state().pressed.right) lane += 1;
      expect(lane).toBe(2);
   });

   it("clearEvents and release drop pending and published presses; the object is never replaced", () => {
      const pressed = state().pressed;
      input.keyDown("KeyS");
      input.clearEvents();
      input.latch();
      expect(state().pressed).toEqual(none);
      input.keyUp("KeyS");
      input.keyDown("KeyW");
      input.latch();
      expect(state().pressed.up).toBe(true);
      input.release();
      expect(state().pressed).toEqual(none);
      expect(state().pressed).toBe(pressed);
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
