"use client";

// The player's prefers-reduced-motion setting, live (TargetBeacon stops bobbing and pulsing).
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(listener: () => void): () => void {
   if (typeof window === "undefined" || !window.matchMedia) return () => {};
   const query = window.matchMedia(QUERY);
   query.addEventListener?.("change", listener);
   return () => query.removeEventListener?.("change", listener);
}

function read(): boolean {
   return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
   return useSyncExternalStore(subscribe, read, () => false);
}
