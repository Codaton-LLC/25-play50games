"use client";

// Mobile and tablet fit for the classic Logic games (shared by LogicGames.tsx; no GameEngine change):
// - When a game starts on a phone or a small tablet, the page scrolls so GameEngine's score bar sits at
//   the top of the screen: the site header and the game title above it fill the whole first screen on
//   a phone, so the board used to start below the fold.
// - Fixed bars anchored to the bottom of the screen (the cookie banner until the player answers it)
//   are measured, and the stage gets that much room under it, so nothing in the game has to sit
//   behind them: the player can always scroll the last row above the banner.
import { useEffect, useState, type RefObject } from "react";

/** A phone or small tablet: narrow, or short in landscape, or a touch screen up to tablet size. */
export function isCompactScreen(w: number, h: number, coarse: boolean): boolean {
   return w < 900 || h < 700 || (coarse && Math.min(w, h) < 1100);
}

/** The height (px) of a fixed bar covering the bottom edge of the screen (0 when none): the element
 *  under the bottom centre, if it sits in a fixed ancestor spanning most of the width. */
export function bottomObstruction(): number {
   if (typeof window === "undefined" || typeof document.elementFromPoint !== "function") return 0;
   const W = window.innerWidth;
   const H = window.innerHeight;
   let el = document.elementFromPoint(W / 2, H - 2) as HTMLElement | null;
   for (let depth = 0; el && el !== document.body && depth < 12; depth++, el = el.parentElement) {
      if (window.getComputedStyle(el).position !== "fixed") continue;
      const r = el.getBoundingClientRect();
      if (r.bottom >= H - 2 && r.width >= W * 0.6 && r.height < H * 0.6) return Math.round(H - r.top);
      return 0;
   }
   return 0;
}

/**
 * While `playing`: scrolls the score bar into view on compact screens when a game starts (once per
 * start), and returns the room (px) to leave under the stage for a bottom bar.
 */
export function useMobileFit(playing: boolean, stage: RefObject<HTMLElement>): number {
   const [room, setRoom] = useState(0);

   useEffect(() => {
      if (!playing || typeof window === "undefined") return;
      const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      if (!isCompactScreen(window.innerWidth, window.innerHeight, coarse)) return;
      const id = window.setTimeout(() => {
         const el = stage.current;
         const content = el?.closest(".game-content");
         const bar = content?.previousElementSibling as HTMLElement | null;
         const target = bar && bar.classList.contains("game-header") ? bar : (content as HTMLElement | null);
         if (!target) return;
         const top = target.getBoundingClientRect().top + window.scrollY - 8;
         window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }, 60);
      return () => window.clearTimeout(id);
   }, [playing, stage]);

   useEffect(() => {
      if (!playing || typeof window === "undefined") return;
      const measure = () => setRoom((r) => {
         const v = bottomObstruction();
         return v === r ? r : v;
      });
      measure();
      // the banner slides in and out; a light poll is enough and stops with the game
      const id = window.setInterval(measure, 700);
      window.addEventListener("resize", measure);
      return () => {
         window.clearInterval(id);
         window.removeEventListener("resize", measure);
      };
   }, [playing]);

   return room;
}
