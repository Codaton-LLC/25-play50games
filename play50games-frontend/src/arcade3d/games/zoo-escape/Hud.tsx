"use client";

// Zoo Escape's own HUD (DOM): the opaque caught card (what happened, the 5 s penalty) and the
// stage toast. Both are transient and never cover the play area while it matters, so they are not
// marked data-arcade-safe-area (the camera fit ignores them).
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { hintFor } from "./guide";
import { CATCH, STATS } from "./rules";
import { useZooLevel } from "./useZooLevel";
import { THEMES } from "./looks";
import styles from "./Hud.module.css";
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";

const REASONS = ["", "Spotted by a keeper!", "Caught in the searchlight!", "Found in your hiding spot!", "Bumped into a keeper!", "Run over by the safari jeep!"];

function GameHud() {
   const card = useArcadeStore((s) => s.stats[STATS.card] ?? 0);
   const catches = useArcadeStore((s) => s.stats[STATS.catches] ?? 0);
   const level = useArcadeStore((s) => s.level);
   const phase = useArcadeStore((s) => s.phase);
   const live = phase === "playing" || phase === "paused";
   const { config } = useZooLevel();
   const bamboo = useArcadeStore((s) => s.stats[STATS.bamboo] ?? 0);
   const hint = hintFor(catches, CATCH.max, bamboo);
   return (
      <>
         <HintLine text={hint.text} tone={hint.tone} />
         {live && level >= 2 && level <= 3 && (
            <div key={level} className={styles.toast} role="status">
               {THEMES[config.map.theme].stageNames[level - 1]}
            </div>
         )}
         {live && card > 0 && (
            <div className={styles.card} role="alert">
               <div className={styles.cardInner}>
                  <div className={styles.bang} aria-hidden="true">!</div>
                  <div className={styles.reason}>{REASONS[card]}</div>
                  <div className={styles.sub}>
                     -{config.penalty} s · back to the stage start · {CATCH.max - catches} {CATCH.max - catches === 1 ? "chance" : "chances"} left
                  </div>
               </div>
            </div>
         )}
      </>
   );
}

/** The game's HUD plus the core 📷 camera-view button (core/camera). */
export default function Hud() {
   return (
      <>
         <CameraViewButton />
         <GameHud />
      </>
   );
}
