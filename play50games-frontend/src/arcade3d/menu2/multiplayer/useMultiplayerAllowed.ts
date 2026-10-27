"use client";

// device.ts live: re-checks on resize, pointer changes and gamepad hot-plug.
import { useEffect, useState } from "react";
import { multiplayerAllowed, readDeviceInfo } from "./device";

export function useMultiplayerAllowed(): boolean {
   const [allowed, setAllowed] = useState(false);
   useEffect(() => {
      const check = () => setAllowed(multiplayerAllowed(readDeviceInfo()));
      check();
      let media: MediaQueryList | null = null;
      try {
         media = window.matchMedia("(any-pointer: fine)");
         media.addEventListener?.("change", check);
      } catch {
         media = null;
      }
      window.addEventListener("resize", check);
      window.addEventListener("gamepadconnected", check);
      window.addEventListener("gamepaddisconnected", check);
      return () => {
         media?.removeEventListener?.("change", check);
         window.removeEventListener("resize", check);
         window.removeEventListener("gamepadconnected", check);
         window.removeEventListener("gamepaddisconnected", check);
      };
   }, []);
   return allowed;
}
