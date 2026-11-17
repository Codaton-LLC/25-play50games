"use client";

// The game HUD: the orbs, the speed meter (what you would carry into a portal now), the hero power and
// the flow meter on the left, and the EXIT control: the nearest portal's anchors as numbered dots (a
// filled dot = the exit is there, hollow = an anchor it can move to, a spinning one = moving) with an
// "Exit" button that cycles it (touch) and the 1-4 keys; the title and level in a banner at the top
// centre with the run clock, and on level 5 the Portal Wyrm's health bar with a hint for the phase. The
// shell keeps Mute / Pause; its clock chip is off (index.tsx). Local multiplayer (menu2/multiplayer): a
// "2-4 players" button on the shared hero picker, the join screen, per-player chips and the podium.
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
import { STAT, V_CAP, runTimeMs } from "./rules";
import type { PortalLevel } from "./levels";
import { COMBO, WYRM } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";
import { cycleLatch } from "./latch";


function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

const HINTS = [
   "Before it dives, open the west portal's exit at an intact beacon spike",
   "Up to the plateau, off its edge into the pad: the pillar flings you onto its back",
   "Set both portals on their magenta loop anchors, then touch its knotted head",
];

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? WYRM.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   return (
      <div className={stack.boss}>
         <BossHealthBar name={WYRM.name} phaseName={WYRM.phases[phase]?.name} hp={hp} maxHp={WYRM.maxHp} marks={phaseMarks(WYRM)} vulnerable={open} flash={flash} accent="#a855f7" />
         {hp > 0 ? <div className={stack.hint}>{HINTS[phase] ?? ""}</div> : null}
      </div>
   );
}

/** The speed you would carry into a portal now (m/s), against the cap. */
function SpeedPill() {
   const speed = useArcadeStore((s) => s.stats[STAT.speed] ?? 0);
   const frac = Math.max(0, Math.min(1, speed / V_CAP));
   return (
      <div className={styles.pill} aria-label={`Speed ${speed} metres a second`}>
         <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 17 A9 9 0 0 1 21 17" fill="none" stroke="#c4b5fd" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M12 17 L17 9" stroke="#22d3ee" strokeWidth="2.6" strokeLinecap="round" />
         </svg>
         <span className={styles.meter}>
            <span className={`${styles.meterFill} ${frac > 0.74 ? styles.meterHigh : ""}`} style={{ width: `${frac * 100}%` }} />
         </span>
         <span className={styles.value}>{speed}</span>
      </div>
   );
}

/** The nearest portal's anchors (1-4) and the Exit button that cycles them. */
function ExitPill() {
   const pair = useArcadeStore((s) => s.stats[STAT.pair] ?? -1);
   const at = useArcadeStore((s) => s.stats[STAT.pairAnchor] ?? 0);
   const count = useArcadeStore((s) => s.stats[STAT.pairCount] ?? 0);
   const moving = useArcadeStore((s) => (s.stats[STAT.pairMoving] ?? 0) === 1);
   if (pair < 0 || count < 2) return null;
   return (
      <button
         type="button"
         className={`${styles.pill} ${styles.exitBtn}`}
         aria-label={`Move the exit: now on anchor ${at} of ${count}${moving ? ", moving" : ""}`}
         onPointerDown={(e) => {
            e.preventDefault();
            cycleLatch.pressed = true;
         }}
      >
         <span className={styles.exitLabel}>Exit</span>
         <span className={styles.dots} aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
               <span key={i} className={`${styles.dot} ${i + 1 === at ? (moving ? styles.dotMoving : styles.dotOn) : ""}`}>
                  {i + 1}
               </span>
            ))}
         </span>
      </button>
   );
}

export default function Hud() {
   const { config } = useLevel<PortalLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const mainOrbs = useArcadeStore((s) => s.stats[STAT.mainOrbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const level = config?.id ?? 1;
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : (HERO_STAT[heroStat] ?? "vexa"));
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Orbs ${mainOrbs} of 5`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{mainOrbs}/5</span>
            </div>
            <SpeedPill />
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
            <ExitPill />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Portal Hop</span>
               <span className={styles.level}>
                  <span className={styles.levelLong}>
                     Level {level} — {config?.name ?? "Two Portals"}
                  </span>
                  <span className={styles.levelShort}>{config?.name ?? "Two Portals"}</span>
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {config?.boss && !playing ? <Boss /> : null}
         </div>
      </>
   );
}
