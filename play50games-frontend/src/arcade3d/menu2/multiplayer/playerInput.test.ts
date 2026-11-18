import { describe, expect, it } from "vitest";
import { createInputController } from "@/arcade3d/core/inputController";
import {
   PAD_BUTTON,
   applyDeadzone,
   createPlayerInputHub,
   keyBinding,
   type GamepadLike,
} from "./playerInput";

function pad(index: number, over: { axes?: number[]; down?: number[] } = {}): GamepadLike {
   const buttons = Array.from({ length: 17 }, (_v, i) => ({ pressed: (over.down ?? []).includes(i), value: (over.down ?? []).includes(i) ? 1 : 0 }));
   return { index, connected: true, axes: over.axes ?? [0, 0, 0, 0], buttons };
}

describe("keyboard split", () => {
   it("maps WASD + Space + E to P1 and the arrows + Enter / R-Ctrl + R-Shift to P2", () => {
      expect(keyBinding("KeyW")).toEqual({ device: "kb1", control: "up" });
      expect(keyBinding("Space")).toEqual({ device: "kb1", control: "jump" });
      expect(keyBinding("KeyE")).toEqual({ device: "kb1", control: "action" });
      expect(keyBinding("ArrowLeft")).toEqual({ device: "kb2", control: "left" });
      expect(keyBinding("Enter")).toEqual({ device: "kb2", control: "jump" });
      expect(keyBinding("ControlRight")).toEqual({ device: "kb2", control: "jump" });
      expect(keyBinding("ShiftRight")).toEqual({ device: "kb2", control: "action" });
      expect(keyBinding("KeyP")).toBeNull();
      expect(keyBinding("Escape")).toBeNull();
      expect(keyBinding("ShiftLeft")).toBeNull();
   });

   it("keeps the two halves apart", () => {
      const hub = createPlayerInputHub();
      hub.keyDown("KeyD");
      hub.keyDown("ArrowUp");
      hub.keyDown("Space");
      hub.latch();
      expect(hub.device("kb1")).toMatchObject({ moveX: 1, moveY: 0, jump: true, jumpPressed: true });
      expect(hub.device("kb2")).toMatchObject({ moveX: 0, moveY: -1, jump: false, jumpPressed: false });
      expect(hub.device("kb2").pressed.up).toBe(true);
   });

   it("latches a tap between two frames for exactly one frame, never on auto-repeat", () => {
      const hub = createPlayerInputHub();
      hub.keyDown("Enter");
      hub.keyUp("Enter");
      hub.latch();
      expect(hub.device("kb2").jumpPressed).toBe(true);
      expect(hub.device("kb2").jump).toBe(false);
      hub.latch();
      expect(hub.device("kb2").jumpPressed).toBe(false);
      hub.keyDown("ShiftRight");
      hub.latch();
      hub.keyDown("ShiftRight", true);
      hub.latch();
      expect(hub.device("kb2").actionPressed).toBe(false);
      expect(hub.device("kb2").action).toBe(true);
   });

   it("normalises diagonals like the core input", () => {
      const hub = createPlayerInputHub();
      hub.keyDown("KeyW");
      hub.keyDown("KeyD");
      hub.latch();
      const i = hub.device("kb1");
      expect(Math.hypot(i.moveX, i.moveY)).toBeCloseTo(1, 9);
   });

   it("release() drops everything held and pending", () => {
      const hub = createPlayerInputHub();
      hub.keyDown("KeyA");
      hub.keyDown("Space");
      hub.release();
      hub.latch();
      expect(hub.device("kb1")).toMatchObject({ moveX: 0, jump: false, jumpPressed: false });
   });

   it("does not touch the single-player core input", () => {
      const core = createInputController();
      const hub = createPlayerInputHub();
      hub.keyDown("ArrowRight");
      hub.latch();
      core.latch();
      expect(core.state.current.moveX).toBe(0);
      core.keyDown("ArrowRight");
      core.latch();
      expect(core.state.current.moveX).toBe(1);
   });
});

describe("gamepads", () => {
   it("applies a radial deadzone and rescales to 0..1", () => {
      expect(applyDeadzone(0.1, 0.1)).toEqual({ x: 0, y: 0 });
      const full = applyDeadzone(1, 0);
      expect(full.x).toBeCloseTo(1, 9);
      const mid = applyDeadzone(0.6, 0);
      expect(mid.x).toBeCloseTo(0.5, 9);
      expect(applyDeadzone(Number.NaN, 0.1)).toEqual({ x: 0, y: 0 });
   });

   it("reads the stick, A jump, X or B power, Start pause as edges", () => {
      const hub = createPlayerInputHub();
      hub.pollGamepads([pad(0, { axes: [1, 0], down: [PAD_BUTTON.a] })]);
      hub.latch();
      expect(hub.device("pad0")).toMatchObject({ jump: true, jumpPressed: true });
      expect(hub.device("pad0").moveX).toBeCloseTo(1, 9);
      // held: no new press
      hub.pollGamepads([pad(0, { axes: [1, 0], down: [PAD_BUTTON.a] })]);
      hub.latch();
      expect(hub.device("pad0").jumpPressed).toBe(false);
      hub.pollGamepads([pad(0, { down: [PAD_BUTTON.b] })]);
      hub.latch();
      expect(hub.device("pad0").actionPressed).toBe(true);
      hub.pollGamepads([pad(0, { down: [PAD_BUTTON.x, PAD_BUTTON.start] })]);
      hub.latch();
      // X while B was held is the same "action" control: no second press
      expect(hub.device("pad0").actionPressed).toBe(false);
      expect(hub.device("pad0").pausePressed).toBe(true);
   });

   it("gives stick and d-pad direction presses with hysteresis", () => {
      const hub = createPlayerInputHub();
      hub.pollGamepads([pad(0, { axes: [0.7, 0] })]);
      hub.latch();
      expect(hub.device("pad0").pressed.right).toBe(true);
      hub.pollGamepads([pad(0, { axes: [0.5, 0] })]);
      hub.latch();
      expect(hub.device("pad0").pressed.right).toBe(false);
      hub.pollGamepads([pad(0, { axes: [0.7, 0] })]);
      hub.latch();
      // never came back under STICK_RELEASE: no second press
      expect(hub.device("pad0").pressed.right).toBe(false);
      hub.pollGamepads([pad(0, { axes: [0.1, 0] })]);
      hub.pollGamepads([pad(0, { axes: [0.9, 0] })]);
      hub.latch();
      expect(hub.device("pad0").pressed.right).toBe(true);
      hub.pollGamepads([pad(0, { down: [PAD_BUTTON.left] })]);
      hub.latch();
      expect(hub.device("pad0").pressed.left).toBe(true);
      expect(hub.device("pad0").moveX).toBe(-1);
   });

   it("keeps up to four pads apart and ignores a fifth", () => {
      const hub = createPlayerInputHub();
      const list = [0, 1, 2, 3, 4].map((i) => pad(i, { down: i === 2 ? [PAD_BUTTON.a] : [] }));
      const events = hub.pollGamepads(list);
      expect(events.map((e) => e.device)).toEqual(["pad0", "pad1", "pad2", "pad3"]);
      hub.latch();
      expect(hub.device("pad2").jumpPressed).toBe(true);
      expect(hub.device("pad1").jumpPressed).toBe(false);
      expect(hub.connectedPads()).toHaveLength(4);
   });

   it("reports hot-plug and releases a pad that went away", () => {
      const hub = createPlayerInputHub();
      expect(hub.pollGamepads([null, pad(1, { axes: [0, -1], down: [PAD_BUTTON.a] })])).toEqual([{ type: "connected", device: "pad1" }]);
      hub.latch();
      expect(hub.device("pad1").jump).toBe(true);
      expect(hub.pollGamepads([null, null])).toEqual([{ type: "disconnected", device: "pad1" }]);
      hub.latch();
      expect(hub.device("pad1")).toMatchObject({ moveY: 0, jump: false, jumpPressed: false });
      expect(hub.pollGamepads(null)).toEqual([]);
      expect(hub.connectedPads()).toEqual([]);
      // a disconnected entry counts as gone
      hub.pollGamepads([pad(0)]);
      expect(hub.pollGamepads([{ ...pad(0), connected: false }])).toEqual([{ type: "disconnected", device: "pad0" }]);
   });
});
