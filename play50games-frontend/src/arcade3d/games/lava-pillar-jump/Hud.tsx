"use client";

// The game HUD: embers, height, the power and the flow meter on the left, Kalder's health bar on
// level 5 once the fight starts, the title and the level in a
// banner at the top centre with the run clock (finish time so far, orb bonus taken off) under it.
// The shell keeps Mute / Pause (top right); its own clock chip is off (index.tsx clockChip: false).
// Local multiplayer (menu2/multiplayer): a "2-4 players" button beside the hero row opens the join
// screen (desktop and tablet only); during multiplayer runs the per-player chips replace the solo
// pills, and the podium covers the shell's result card. The hero row is the shared menu2/heroes
// HeroPicker; the orbit camera's recenter button and its first-time hint come from menu2/camera's OrbitHud.
import { useEffect, useSyncExternalStore } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import { HEROES, heroById, pickedHero, selectHero, subscribeHero, type HeroId } from "./heroes";
import HeroPicker from "@/arcade3d/menu2/heroes/HeroPicker";
import OrbitHud from "@/arcade3d/menu2/camera/OrbitHud";
import { STAT, runTimeMs } from "./rules";
import type { LavaLevel } from "./levels";
import BossHealthBar from "@/arcade3d/menu2/boss/BossHealthBar";
import { phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { COMBO, KALDER } from "./progression";
import ComboMeter from "@/arcade3d/menu2/combo/ComboMeter";

import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/**
 * The shared Menu 2 hero picker (menu2/heroes): on the start card, the result screen and the pause
 * menu. The pick is the next run's option (solo Scene reads it when a run starts). Hidden while a
 * local multiplayer lobby or race is up (the join screen picks the heroes there).
 */
function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   // the "2-4 players" entry only on the start card
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

export default function Hud() {
   const { config } = useLevel<LavaLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const height = useArcadeStore((s) => s.stats[STAT.height] ?? 0);
   // undefined until the run's first playing frame sets it: the countdown shows the run's pick
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   // a tenth of a second is enough for the clock: 10 renders a second, not one per frame
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const level = config?.id ?? 1;
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "riko");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   const bossOn = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
   const bossHp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? KALDER.maxHp);
   const bossPhase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const bossOpen = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const bossFlash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   // leaving the game (Exit) ends a multiplayer session
   useEffect(() => () => playersStore.getState().endSession(), []);
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         {/* the orbit camera's recenter button (touch) and first-time hint (menu2/camera) */}
         <OrbitHud />
         <div className={styles.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Embers ${orbs}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}</span>
            </div>
            <div className={styles.pill} aria-label={`Height ${height} metres`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 20 L9 8 L13 14 L16 10 L22 20 Z" fill="#7dd3fc" />
                  <path d="M9 8 L11 11.5 L9.8 12.4 L8.4 11 Z" fill="#fff" />
               </svg>
               <span className={styles.value}>{height} m</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={styles.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Lava Pillar Jump</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Warm Cavern"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {bossOn ? (
               <BossHealthBar
                  name={KALDER.name}
                  phaseName={KALDER.phases[Math.min(KALDER.phases.length - 1, bossPhase)].name}
                  hp={bossHp}
                  maxHp={KALDER.maxHp}
                  marks={phaseMarks(KALDER)}
                  vulnerable={bossOpen}
                  flash={bossFlash}
                  accent="#ef4444"
               />
            ) : null}
         </div>
      </>
   );
}
