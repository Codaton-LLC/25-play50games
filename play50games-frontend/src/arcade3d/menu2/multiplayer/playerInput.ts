// Local multiplayer input (Menu 2, phase M1): one keyboard split in two plus up to four gamepads,
// each a DEVICE with its own input state. Pure and DOM-free (tested in playerInput.test.ts); the
// thin wiring (window keys, navigator.getGamepads) lives in MultiplayerInput.tsx.
//
// - Built beside the core input, never instead of it: single-player games keep reading useInput()
//   (core/inputController.ts) and nothing here changes it. A multiplayer scene reads one
//   PlayerInput per player instead (hub.device(player.device)).
// - PlayerInput has the core InputState's move/jump/action fields with the same meaning (moveX/moveY
//   -1..1, up = -1, held jump/action, one-frame jumpPressed/actionPressed/pressed), so a game's step
//   input is filled from it exactly as from useInput().
// - One-frame events are latched, never lost: a key tapped or a button pressed between two frames
//   shows in the next latch(). Gamepad presses are edges between two polls.
// - Hot-plug: pollGamepads() compares the pads it sees with the last poll and reports
//   "connected" / "disconnected"; a pad that goes away releases everything it held.
import type { DirectionPresses, InputState } from "@/arcade3d/core/types";

/** Keyboard halves and gamepad slots. */
export type DeviceId = "kb1" | "kb2" | "pad0" | "pad1" | "pad2" | "pad3";
export type KeyboardDevice = "kb1" | "kb2";
export type PadDevice = "pad0" | "pad1" | "pad2" | "pad3";

export const KEYBOARD_DEVICES: readonly KeyboardDevice[] = ["kb1", "kb2"];
export const PAD_DEVICES: readonly PadDevice[] = ["pad0", "pad1", "pad2", "pad3"];
export const ALL_DEVICES: readonly DeviceId[] = [...KEYBOARD_DEVICES, ...PAD_DEVICES];
/** At most this many gamepads (navigator.getGamepads() indices 0-3). */
export const MAX_PADS = 4;

export interface KeyLayout {
   up: readonly string[];
   down: readonly string[];
   left: readonly string[];
   right: readonly string[];
   jump: readonly string[];
   action: readonly string[];
}

/**
 * The split keyboard (KeyboardEvent.code). P1: WASD, Space jump, E power. P2: the arrows, Enter or
 * Right-Ctrl jump, Right-Shift power. Esc / P stay the shell's pause.
 */
export const KEYBOARD_LAYOUTS: Record<KeyboardDevice, KeyLayout> = {
   kb1: { up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"], jump: ["Space"], action: ["KeyE"] },
   kb2: {
      up: ["ArrowUp"],
      down: ["ArrowDown"],
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
      jump: ["Enter", "NumpadEnter", "ControlRight"],
      action: ["ShiftRight"],
   },
};

/** Standard Gamepad API mapping (https://w3c.github.io/gamepad/#remapping). */
export const PAD_BUTTON = { a: 0, b: 1, x: 2, y: 3, start: 9, up: 12, down: 13, left: 14, right: 15 } as const;
/** A stick inside this radius is centred. Outside it the stick is rescaled to 0..1. */
export const STICK_DEADZONE = 0.2;
/** A stick pushed past this counts as a direction press (menus, discrete moves). */
export const STICK_PRESS = 0.6;
/** ...and must come back under this before it presses again. */
export const STICK_RELEASE = 0.4;

/** What one player's device gives a game each frame. Same meaning as the core InputState fields. */
export interface PlayerInput extends Pick<InputState, "moveX" | "moveY" | "jump" | "action" | "jumpPressed" | "actionPressed"> {
   pressed: DirectionPresses;
   /** gamepad Start this frame (the keyboard's pause is the shell's Esc / P) */
   pausePressed: boolean;
}

/** The part of a DOM Gamepad the hub reads (a real Gamepad fits as is). */
export interface GamepadLike {
   index: number;
   connected: boolean;
   axes: readonly number[];
   buttons: ReadonlyArray<{ pressed: boolean; value?: number }>;
}

export type HotplugEvent = { type: "connected" | "disconnected"; device: PadDevice };

export interface PlayerInputHub {
   /** returns true when the key belongs to a keyboard half (the caller may preventDefault) */
   keyDown(code: string, repeat?: boolean): boolean;
   keyUp(code: string): void;
   /** reads the pads (navigator.getGamepads()); returns the hot-plug changes since the last poll */
   pollGamepads(pads: ArrayLike<GamepadLike | null | undefined> | null | undefined): HotplugEvent[];
   /** once per frame, before game logic: publishes held input and this frame's one-frame events */
   latch(): void;
   /** the live input of a device (the same object for the session) */
   device(id: DeviceId): Readonly<PlayerInput>;
   /** the gamepads seen by the last poll */
   connectedPads(): readonly PadDevice[];
   /** drops pending one-frame events (phase changes) */
   clearEvents(): void;
   /** releases everything held (blur, tab hidden, unmount) */
   release(): void;
}

export function createPlayerInput(): PlayerInput {
   return {
      moveX: 0,
      moveY: 0,
      jump: false,
      action: false,
      jumpPressed: false,
      actionPressed: false,
      pressed: { left: false, right: false, up: false, down: false },
      pausePressed: false,
   };
}

const clamp1 = (v: number) => (v > 1 ? 1 : v < -1 ? -1 : v);
const finite = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** A raw stick (x, y) with the radial deadzone: 0 inside it, rescaled to 0..1 outside, length ≤ 1. */
export function applyDeadzone(x: number, y: number, deadzone = STICK_DEADZONE, out: { x: number; y: number } = { x: 0, y: 0 }): { x: number; y: number } {
   const fx = finite(x);
   const fy = finite(y);
   const len = Math.hypot(fx, fy);
   if (len <= deadzone) {
      out.x = 0;
      out.y = 0;
      return out;
   }
   const k = Math.min(1, (len - deadzone) / (1 - deadzone)) / len;
   out.x = fx * k;
   out.y = fy * k;
   return out;
}

interface DeviceState {
   input: PlayerInput;
   /** held keys of a keyboard half */
   keys: Set<string>;
   /** held gamepad state from the last poll */
   padX: number;
   padY: number;
   padJump: boolean;
   padAction: boolean;
   padStart: boolean;
   padDir: DirectionPresses;
   /** the stick's direction latch (hysteresis between STICK_PRESS and STICK_RELEASE) */
   stickDir: DirectionPresses;
   pendingJump: boolean;
   pendingAction: boolean;
   pendingPause: boolean;
   pendingPress: DirectionPresses;
}

const noPress = (): DirectionPresses => ({ left: false, right: false, up: false, down: false });
const clearPress = (p: DirectionPresses) => {
   p.left = false;
   p.right = false;
   p.up = false;
   p.down = false;
};

function freshDevice(): DeviceState {
   return {
      input: createPlayerInput(),
      keys: new Set(),
      padX: 0,
      padY: 0,
      padJump: false,
      padAction: false,
      padStart: false,
      padDir: noPress(),
      stickDir: noPress(),
      pendingJump: false,
      pendingAction: false,
      pendingPause: false,
      pendingPress: noPress(),
   };
}

/** Which keyboard half and which control a key code belongs to (null: not a multiplayer key). */
export function keyBinding(code: string): { device: KeyboardDevice; control: keyof KeyLayout } | null {
   for (const device of KEYBOARD_DEVICES) {
      const layout = KEYBOARD_LAYOUTS[device];
      for (const control of Object.keys(layout) as (keyof KeyLayout)[]) {
         if (layout[control].includes(code)) return { device, control };
      }
   }
   return null;
}

const btn = (pad: GamepadLike, i: number) => {
   const b = pad.buttons[i];
   return !!b && (b.pressed || finite(b.value) > 0.5);
};

/** DOM-free multi-device input state machine. MultiplayerInput.tsx feeds it real events and pads. */
export function createPlayerInputHub(): PlayerInputHub {
   const devices = new Map<DeviceId, DeviceState>();
   for (const id of ALL_DEVICES) devices.set(id, freshDevice());
   const get = (id: DeviceId) => devices.get(id)!;
   let pads: PadDevice[] = [];
   const scratch = { x: 0, y: 0 };

   const releaseDevice = (d: DeviceState) => {
      d.keys.clear();
      d.padX = 0;
      d.padY = 0;
      d.padJump = false;
      d.padAction = false;
      d.padStart = false;
      clearPress(d.padDir);
      clearPress(d.stickDir);
      const i = d.input;
      i.moveX = 0;
      i.moveY = 0;
      i.jump = false;
      i.action = false;
   };

   const clearDeviceEvents = (d: DeviceState) => {
      d.pendingJump = false;
      d.pendingAction = false;
      d.pendingPause = false;
      clearPress(d.pendingPress);
      d.input.jumpPressed = false;
      d.input.actionPressed = false;
      d.input.pausePressed = false;
      clearPress(d.input.pressed);
   };

   const held = (d: DeviceState, layout: KeyLayout, control: keyof KeyLayout) => {
      for (const code of layout[control]) if (d.keys.has(code)) return true;
      return false;
   };

   const hub: PlayerInputHub = {
      keyDown(code, repeat = false) {
         const bind = keyBinding(code);
         if (!bind) return false;
         const d = get(bind.device);
         const was = d.keys.has(code);
         d.keys.add(code);
         if (!was && !repeat) {
            if (bind.control === "jump") d.pendingJump = true;
            else if (bind.control === "action") d.pendingAction = true;
            else d.pendingPress[bind.control] = true;
         }
         return true;
      },

      keyUp(code) {
         const bind = keyBinding(code);
         if (bind) get(bind.device).keys.delete(code);
      },

      pollGamepads(list) {
         const events: HotplugEvent[] = [];
         const seen: PadDevice[] = [];
         const count = list ? Math.min(MAX_PADS, list.length) : 0;
         for (let i = 0; i < count; i++) {
            const pad = list![i];
            if (!pad || !pad.connected) continue;
            const id = PAD_DEVICES[i];
            seen.push(id);
            const d = get(id);
            const stick = applyDeadzone(finite(pad.axes[0]), finite(pad.axes[1]), STICK_DEADZONE, scratch);
            d.padX = stick.x;
            d.padY = stick.y;
            const jump = btn(pad, PAD_BUTTON.a);
            const action = btn(pad, PAD_BUTTON.x) || btn(pad, PAD_BUTTON.b);
            const start = btn(pad, PAD_BUTTON.start);
            if (jump && !d.padJump) d.pendingJump = true;
            if (action && !d.padAction) d.pendingAction = true;
            if (start && !d.padStart) d.pendingPause = true;
            d.padJump = jump;
            d.padAction = action;
            d.padStart = start;
            // d-pad: edges per button; the stick: hysteresis, so a resting stick never repeats
            const dir: Record<keyof DirectionPresses, boolean> = {
               up: btn(pad, PAD_BUTTON.up),
               down: btn(pad, PAD_BUTTON.down),
               left: btn(pad, PAD_BUTTON.left),
               right: btn(pad, PAD_BUTTON.right),
            };
            for (const k of ["up", "down", "left", "right"] as const) {
               if (dir[k] && !d.padDir[k]) d.pendingPress[k] = true;
               d.padDir[k] = dir[k];
            }
            const raw = { left: -finite(pad.axes[0]), right: finite(pad.axes[0]), up: -finite(pad.axes[1]), down: finite(pad.axes[1]) };
            for (const k of ["up", "down", "left", "right"] as const) {
               if (!d.stickDir[k] && raw[k] >= STICK_PRESS) {
                  d.stickDir[k] = true;
                  d.pendingPress[k] = true;
               } else if (d.stickDir[k] && raw[k] < STICK_RELEASE) d.stickDir[k] = false;
            }
         }
         for (const id of seen) if (!pads.includes(id)) events.push({ type: "connected", device: id });
         for (const id of pads) {
            if (seen.includes(id)) continue;
            events.push({ type: "disconnected", device: id });
            const d = get(id);
            releaseDevice(d);
            clearDeviceEvents(d);
         }
         pads = seen;
         return events;
      },

      latch() {
         for (const id of ALL_DEVICES) {
            const d = get(id);
            const i = d.input;
            let x = d.padX;
            let y = d.padY;
            let jump = d.padJump;
            let action = d.padAction;
            if (id === "kb1" || id === "kb2") {
               const layout = KEYBOARD_LAYOUTS[id];
               x += (held(d, layout, "right") ? 1 : 0) - (held(d, layout, "left") ? 1 : 0);
               y += (held(d, layout, "down") ? 1 : 0) - (held(d, layout, "up") ? 1 : 0);
               jump = jump || held(d, layout, "jump");
               action = action || held(d, layout, "action");
            } else {
               x += (d.padDir.right ? 1 : 0) - (d.padDir.left ? 1 : 0);
               y += (d.padDir.down ? 1 : 0) - (d.padDir.up ? 1 : 0);
            }
            x = clamp1(x);
            y = clamp1(y);
            // diagonals are never faster than straight moves (as the core input)
            const len = Math.hypot(x, y);
            if (len > 1) {
               x /= len;
               y /= len;
            }
            i.moveX = x;
            i.moveY = y;
            i.jump = jump;
            i.action = action;
            i.jumpPressed = d.pendingJump;
            i.actionPressed = d.pendingAction;
            i.pausePressed = d.pendingPause;
            i.pressed.left = d.pendingPress.left;
            i.pressed.right = d.pendingPress.right;
            i.pressed.up = d.pendingPress.up;
            i.pressed.down = d.pendingPress.down;
            d.pendingJump = false;
            d.pendingAction = false;
            d.pendingPause = false;
            clearPress(d.pendingPress);
         }
      },

      device(id) {
         return get(id).input;
      },

      connectedPads() {
         return pads;
      },

      clearEvents() {
         for (const id of ALL_DEVICES) clearDeviceEvents(get(id));
      },

      release() {
         for (const id of ALL_DEVICES) {
            const d = get(id);
            releaseDevice(d);
            clearDeviceEvents(d);
         }
      },
   };
   return hub;
}

/** Human labels for the join screen. */
export function deviceLabel(id: DeviceId): string {
   if (id === "kb1") return "Keyboard: WASD";
   if (id === "kb2") return "Keyboard: arrows";
   return `Gamepad ${Number(id.slice(3)) + 1}`;
}

/** The controls hint of a device: move, jump, power. */
export function deviceControls(id: DeviceId): string {
   if (id === "kb1") return "WASD move · Space jump · E power";
   if (id === "kb2") return "Arrows move · Enter / R-Ctrl jump · R-Shift power";
   return "Stick move · A jump · X / B power · Start pause";
}
