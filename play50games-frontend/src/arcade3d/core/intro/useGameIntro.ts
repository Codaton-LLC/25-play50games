"use client";

// Opt-in intro for one slug and level. The shell calls this outside the Canvas, renders
// GameIntroOverlay here and <GameIntro> inside the Scene, and starts the run from `onDone`
// (or when `ready` becomes true). Storage and reduced-motion are read in an effect, so the
// first render has no session and server HTML matches the client.
import { useCallback, useEffect, useRef, useState } from "react";
import {
   browserIntroStorage,
   createIntroSession,
   gateIntroKey,
   gateIntroPointer,
   introTargetAllowsSkip,
   loadIntroVariant,
   markIntroSeen,
   readReducedMotion,
   type IntroEventTarget,
   type IntroKeyGate,
   type IntroPointerGate,
   type IntroSession,
   type IntroSnapshot,
   type IntroStorage,
} from "./introMachine";

export interface UseGameIntroOptions {
   slug: string;
   /** Level id. A game without levels passes 1. */
   level: number;
   title: string;
   levelName?: string;
   /** Once, when the intro reaches done (time or skip). The shell starts the run here. */
   onDone?: () => void;
   /** Omit to use localStorage. `null` never remembers (every visit is a first view). */
   storage?: IntroStorage | null;
   /** Omit to read prefers-reduced-motion. */
   reducedMotion?: boolean;
}

export interface GameIntroApi {
   /** True once the intro has finished. The run starts only then. */
   ready: boolean;
   phase: IntroSnapshot["phase"];
   variant: IntroSnapshot["variant"];
   showsTitle: boolean;
   title: string;
   levelName: string;
   /** Skip control. Keys and taps are listened for while the intro runs. */
   skip: () => void;
   /** Null on the first render, then the session <GameIntro> advances. */
   session: IntroSession | null;
}

const PENDING: IntroSnapshot = {
   ready: false,
   phase: "fly-through",
   variant: "full",
   showsTitle: false,
};

function openStorage(storage: IntroStorage | null | undefined): IntroStorage | null {
   try {
      if (storage === null) return null;
      if (storage) return storage;
      return browserIntroStorage();
   } catch {
      return null;
   }
}

function defaultReducedMotion(): boolean {
   try {
      if (typeof window === "undefined" || !window.matchMedia) return false;
      return readReducedMotion((query) => window.matchMedia(query));
   } catch {
      return false;
   }
}

function isEditable(target: EventTarget | null): boolean {
   if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
   const tag = target.tagName;
   return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function describeTarget(target: EventTarget | null): IntroEventTarget {
   const el = typeof Element !== "undefined" && target instanceof Element ? target : null;
   const inIntro = el?.closest("[data-arcade-intro]") != null;
   const onSkipControl = el?.closest("[data-arcade-intro-skip]") != null;
   const outsideControl = el != null && !inIntro && el.closest("button, a, input, textarea, select") != null;
   return { inIntro, onSkipControl, outsideControl, editable: isEditable(target) };
}

function stop(event: Event): void {
   event.preventDefault();
   event.stopPropagation();
}

export function useGameIntro(options: UseGameIntroOptions): GameIntroApi {
   const onDoneRef = useRef(options.onDone);
   onDoneRef.current = options.onDone;
   const optionsRef = useRef(options);
   optionsRef.current = options;

   const [live, setLive] = useState<{ session: IntroSession; snapshot: IntroSnapshot } | null>(null);
   const liveRef = useRef(live);
   liveRef.current = live;

   useEffect(() => {
      const current = optionsRef.current;
      const storage = openStorage(current.storage);
      const reduced = current.reducedMotion ?? defaultReducedMotion();
      const variant = loadIntroVariant(storage, current.slug, current.level, reduced);
      const slug = current.slug;
      const level = current.level;
      const session = createIntroSession(variant, () => {
         markIntroSeen(openStorage(optionsRef.current.storage), slug, level);
         onDoneRef.current?.();
      });
      setLive({ session, snapshot: session.getSnapshot() });

      const keys: IntroKeyGate = { held: new Set() };
      const pointer: IntroPointerGate = { down: false };

      const onKeyDown = (event: KeyboardEvent) => {
         if (!introTargetAllowsSkip("key", describeTarget(event.target))) return;
         const action = gateIntroKey(keys, session.state.phase, {
            type: "down",
            code: event.code,
            repeat: event.repeat,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            altKey: event.altKey,
         });
         if (action === "pass") return;
         stop(event);
         if (action === "skip") session.skip("key");
      };
      const onKeyUp = (event: KeyboardEvent) => {
         const action = gateIntroKey(keys, session.state.phase, { type: "up", code: event.code });
         if (action === "swallow") stop(event);
      };
      const onPointerDown = (event: PointerEvent) => {
         if (!introTargetAllowsSkip("tap", describeTarget(event.target))) return;
         const action = gateIntroPointer(pointer, session.state.phase, { type: "down", button: event.button });
         if (action === "pass") return;
         stop(event);
         if (action === "skip") session.skip("tap");
      };
      const onPointerUp = (event: PointerEvent) => {
         const action = gateIntroPointer(pointer, session.state.phase, { type: "up", button: event.button });
         if (action === "swallow") stop(event);
      };

      window.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("keyup", onKeyUp, true);
      window.addEventListener("pointerdown", onPointerDown, true);
      window.addEventListener("pointerup", onPointerUp, true);
      const unsubscribe = session.subscribe(() => {
         setLive((prev) => (prev && prev.session === session ? { session, snapshot: session.getSnapshot() } : prev));
      });
      return () => {
         unsubscribe();
         window.removeEventListener("keydown", onKeyDown, true);
         window.removeEventListener("keyup", onKeyUp, true);
         window.removeEventListener("pointerdown", onPointerDown, true);
         window.removeEventListener("pointerup", onPointerUp, true);
      };
   }, [options.slug, options.level, options.reducedMotion]);

   const skip = useCallback(() => {
      liveRef.current?.session.skip("button");
   }, []);

   const snapshot = live?.snapshot ?? PENDING;
   return {
      ready: snapshot.ready,
      phase: snapshot.phase,
      variant: snapshot.variant,
      showsTitle: snapshot.showsTitle,
      title: options.title,
      levelName: options.levelName ?? "",
      skip,
      session: live?.session ?? null,
   };
}
