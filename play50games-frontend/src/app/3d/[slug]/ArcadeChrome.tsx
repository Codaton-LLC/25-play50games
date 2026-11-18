"use client";

// The site header on a 3D game page. The shell (arcade3d/core/GameShell) is a fixed, full-screen
// frame; the header lies over its top edge while no run is on screen (loading, the lobby, the
// result), so the page reads as a page of the site like the hub. It is unmounted for the countdown,
// the run and the pause: the game keeps the whole screen, the canvas never changes size, and the
// header's shortcuts (Ctrl K) stay out of a run.
// Nothing 3D is imported here: the store is plain zustand, so the page bundle stays small.
import type { ReactNode } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { isResultShown } from "@/arcade3d/core/frameLoop";
import styles from "./ArcadeChrome.module.css";

export interface ArcadeChromeProps {
   /** the site header, rendered on the server (page.tsx) */
   header: ReactNode;
   children: ReactNode;
}

export default function ArcadeChrome({ header, children }: ArcadeChromeProps) {
   const inRun = useArcadeStore(
      (s) =>
         s.phase === "countdown" ||
         s.phase === "playing" ||
         s.phase === "paused" ||
         (s.phase === "over" && !isResultShown(s))
   );
   return (
      <>
         {!inRun && <div className={`p50 ${styles.chrome}`}>{header}</div>}
         {/* --site-header-h: the room the shell's sheets keep under the header */}
         <main className={inRun ? undefined : styles.withHeader}>{children}</main>
      </>
   );
}
