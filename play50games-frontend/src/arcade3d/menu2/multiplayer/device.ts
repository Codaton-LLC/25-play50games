// Where local multiplayer is offered. Phones stay single player: multiplayer is hidden under
// 700 CSS px of width, and on a device whose only pointers are coarse (touch) unless a gamepad is
// connected (a touch-only tablet has one set of touch controls, but with pads plugged in 2-4
// players can play). Desktop and tablets with a keyboard or a trackpad get 2-4 players.

export const MULTIPLAYER_MIN_WIDTH = 700;

export interface DeviceInfo {
   /** viewport width, CSS px */
   width: number;
   /** some pointer is fine (mouse, trackpad, pen): matchMedia("(any-pointer: fine)") */
   finePointer: boolean;
   /** gamepads connected right now */
   gamepads: number;
}

export function multiplayerAllowed(info: DeviceInfo): boolean {
   if (!(info.width >= MULTIPLAYER_MIN_WIDTH)) return false;
   return info.finePointer || info.gamepads > 0;
}

/** The live DeviceInfo in a browser (SSR / no window: a phone-like answer, so nothing is offered). */
export function readDeviceInfo(): DeviceInfo {
   if (typeof window === "undefined") return { width: 0, finePointer: false, gamepads: 0 };
   let finePointer = false;
   try {
      finePointer = window.matchMedia("(any-pointer: fine)").matches;
   } catch {
      finePointer = false;
   }
   let gamepads = 0;
   try {
      const list = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of list) if (p && p.connected) gamepads++;
   } catch {
      gamepads = 0;
   }
   return { width: window.innerWidth, finePointer, gamepads };
}
