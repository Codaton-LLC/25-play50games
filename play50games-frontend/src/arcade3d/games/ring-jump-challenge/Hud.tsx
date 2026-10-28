"use client";

// The game HUD: rings threaded (centre threads), orbs, the depth left to the sea (a filling bar), the
// fall speed (hot in a dive), the hero power, the ring streak and the flow meter on the left; the
// title and the level in a banner at the top centre with the run clock and one teaching line (leap,
// hold Dive for the closing trio, the boss's moves), and on level 5 Cyclone Ray's health bar with the
// wake-ring charge. The shell keeps Mute / Pause and the Score chip; its clock chip is off (index.tsx
// clockChip: false). Local multiplayer (menu2/multiplayer): a "2-4 players" button on the shared hero
// picker (desktop and tablet), the join screen, per-player chips and the podium. The shared Menu 2
// hero picker (menu2/heroes) shows on the start card, the pause menu and the result; the orbit
// camera's recenter button and first-time hint come from menu2/camera's OrbitHud.
import { useEffect, useSyncExternalStore } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import ComboMeter from "@/arcade3d/menu2/combo/ComboMeter";
import BossHealthBar from "@/arcade3d/menu2/boss/BossHealthBar";
import { phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import HeroPicker from "@/arcade3d/menu2/heroes/HeroPicker";
import OrbitHud from "@/arcade3d/menu2/camera/OrbitHud";
import { HEROES, heroById, pickedHero, selectHero, subscribeHero, type HeroId } from "./heroes";
import { HINT, STAT, V_DIVE, WAKE, courseFor } from "./rules";
import type { RingLevel } from "./levels";
import { COMBO, CYCLONE_RAY } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

const HINT_TEXT: Record<number, string> = {
   [HINT.leap]: "Jump to leap off the column",
   [HINT.dive]: "Hold Dive! The rings below are closing",
   [HINT.wake]: "Thread its wind rings: 5 in a row charges a strike",
   [HINT.fin]: "Charged! Hold Dive into its glowing fin",
   [HINT.lanes]: "Lightning lanes! Steer between them",
   [HINT.belly]: "It's open: Dive into it!",
   [HINT.tail]: "The final drop: land on its tail pad",
};

/** The shared Menu 2 hero picker: on the start card, the result screen and the pause menu. */
function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? CYCLONE_RAY.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const chain = useArcadeStore((s) => s.stats[STAT.wakeChain] ?? 0);
   const charged = useArcadeStore((s) => (s.stats[STAT.charged] ?? 0) === 1);
   const seen = useArcadeStore((s) => s.stats[STAT.bossHp] !== undefined);
   if (!seen) return null;
   return (
      <div className={styles.boss}>
         <BossHealthBar
            name={CYCLONE_RAY.name}
            phaseName={CYCLONE_RAY.phases[phase]?.name}
            hp={hp}
            maxHp={CYCLONE_RAY.maxHp}
            marks={phaseMarks(CYCLONE_RAY)}
            vulnerable={open}
            flash={flash}
            accent="#22d3ee"
         />
         {phase === 0 && hp > 0 ? <div className={styles.charges}>{charged ? "Strike charged!" : `Wind rings ${Math.min(chain, WAKE.chain)} / ${WAKE.chain}`}</div> : null}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<RingLevel>();
   const level = config?.id ?? 1;
   const rings = useArcadeStore((s) => s.stats[STAT.rings] ?? 0);
   const centres = useArcadeStore((s) => s.stats[STAT.centres] ?? 0);
   const orbs = useArcadeStore((s) => s.stats[STAT.mainOrbs] ?? 0);
   const depth = useArcadeStore((s) => s.stats[STAT.depth]);
   const speed = useArcadeStore((s) => s.stats[STAT.speed] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const streak = useArcadeStore((s) => s.stats[STAT.streak] ?? 0);
   const hint = useArcadeStore((s) => (s.phase === "playing" ? s.stats[STAT.hint] ?? 0 : 0));
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "nami");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const course = courseFor(level);
   const drop = course.top - course.pad.y;
   const left = depth === undefined ? drop : depth;
   const depthFrac = Math.max(0, Math.min(1, 1 - left / drop));
   const fast = speed > V_DIVE * 0.8;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={styles.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Rings ${rings}, ${centres} centre threads`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <ellipse cx="12" cy="12" rx="9" ry="5" fill="none" stroke="#e0f2fe" strokeWidth="3" />
                  <ellipse cx="12" cy="12" rx="2.6" ry="1.5" fill="#fff3b0" />
               </svg>
               <span className={styles.value}>
                  {rings}
                  {centres > 0 ? <small style={{ fontSize: "0.7em", opacity: 0.8 }}> ★{centres}</small> : null}
               </span>
            </div>
            <div className={styles.pill} aria-label={`Orbs ${orbs} of ${course.mainOrbs}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>
                  {orbs}/{course.mainOrbs}
               </span>
            </div>
            <div className={styles.pill} aria-label={`${left} metres to the sea`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3 V17 M6 11 L12 17 L18 11" stroke="#7dd3fc" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 21 H20" stroke="#22d3ee" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.depth}>
                  <span className={styles.depthFill} style={{ width: `${depthFrac * 100}%` }} />
               </span>
            </div>
            <div className={`${styles.pill} ${fast ? styles.fast : ""}`} aria-label={`Falling at ${speed} metres per second`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 4 L9 12 L5 20 M12 4 L16 12 L12 20" stroke={fast ? "#ffb26b" : "#fff"} strokeWidth="2.6" fill="none" strokeLinecap="round" transform="rotate(90 12 12)" />
               </svg>
               <span className={styles.value}>{speed} m/s</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            {streak > 1 ? (
               <div className={styles.pill} aria-label={`Ring streak ${streak}`}>
                  <span className={styles.value}>◎ {streak}</span>
               </div>
            ) : null}
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={styles.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Ring Jump Challenge</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Wide Rings"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(tenths * 100)}</span>
            </div>
            {config?.boss && !playing ? <Boss /> : null}
            {hint > 0 && !playing ? (
               <div className={styles.hint} role="status">
                  {HINT_TEXT[hint]}
               </div>
            ) : null}
         </div>
      </>
   );
}
