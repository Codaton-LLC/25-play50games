"use client";

// The game HUD: the climb meter (height / goal), the orbs, the spin of the hero's pole (green with you,
// red against, flashing before a flip), the hero power and the flow meter on the left; the title and the
// level in a banner at the top centre with the run clock (finish time so far, orb and flow bonus taken
// off), and on level 5 Coilstone's health bar with a hint for the phase. A hop prompt shows while a hop
// to a neighbour pole would land. The shell keeps Mute / Pause; its clock chip is off (index.tsx). Local
// multiplayer (menu2/multiplayer): a "2-4 players" button on the shared hero picker, the join screen,
// per-player chips and the podium. The shared Menu 2 hero picker shows on the start card, the pause menu
// and the result; the orbit camera's recenter button and first-time hint come from OrbitHud.
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
import { STAT, runTimeMs } from "./rules";
import type { SpinLevel } from "./levels";
import { COILSTONE, COMBO } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

const HINTS = ["Jump the coils sliding down; land on the glowing dark plate", "Run on so the bite misses; then hop onto the side pole holding its crown", "Climb to the gong on top and ring it"];

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? COILSTONE.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   return (
      <div className={stack.boss}>
         <BossHealthBar name={COILSTONE.name} phaseName={COILSTONE.phases[phase]?.name} hp={hp} maxHp={COILSTONE.maxHp} marks={phaseMarks(COILSTONE)} vulnerable={open} flash={flash} accent="#34d399" />
         {hp > 0 ? <div className={stack.hint}>{HINTS[phase] ?? ""}</div> : null}
      </div>
   );
}

/** The climb meter: the hero's height against the goal; amber in the last 15 %. */
function ClimbPill({ goal }: { goal: number }) {
   const height = useArcadeStore((s) => s.stats[STAT.height] ?? 0);
   const frac = Math.max(0, Math.min(1, height / Math.max(1, goal)));
   return (
      <div className={styles.pill} aria-label={`Height ${height} of ${goal} metres`}>
         <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <rect x="10" y="2" width="4" height="20" rx="2" fill="#b7a98a" />
            <path d="M5 19 L19 16 M5 13 L19 10 M5 7 L19 4" stroke="#4ade80" strokeWidth="2.4" strokeLinecap="round" />
         </svg>
         <span className={styles.meter}>
            <span className={`${styles.meterFill} ${frac > 0.85 ? styles.meterHigh : ""}`} style={{ width: `${frac * 100}%` }} />
         </span>
         <span className={styles.value}>{height}m</span>
      </div>
   );
}

/** The spin of the pole the hero stands on: green with you, red against, white flashing before a flip. */
function SpinPill() {
   const spin = useArcadeStore((s) => s.stats[STAT.spin] ?? 0);
   const flip = useArcadeStore((s) => (s.stats[STAT.flip] ?? 0) === 1);
   const label = spin > 0 ? "With you" : spin < 0 ? "Against" : "Still";
   const cls = flip ? styles.spinFlip : spin > 0 ? styles.spinWith : spin < 0 ? styles.spinAgainst : "";
   return (
      <div className={styles.pill} aria-label={`Pole spin: ${label}${flip ? ", about to flip" : ""}`}>
         <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12 A8 8 0 1 1 12 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M12 16 L12 21 L7 21" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
         </svg>
         <span className={`${styles.value} ${cls}`}>{flip ? "Flip!" : label}</span>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<SpinLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const mainOrbs = useArcadeStore((s) => s.stats[STAT.mainOrbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const hopReady = useArcadeStore((s) => (s.stats[STAT.hopReady] ?? 0) === 1);
   const playingPhase = useArcadeStore((s) => s.phase === "playing");
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const level = config?.id ?? 1;
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : (HERO_STAT[heroStat] ?? "kiro"));
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         {!playing && hopReady && playingPhase ? (
            <div className={styles.hop} role="status">
               Jump + push towards the pole to hop across
            </div>
         ) : null}
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <ClimbPill goal={config?.height ?? 18} />
            <div className={styles.pill} aria-label={`Orbs ${mainOrbs} of 5`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{mainOrbs}/5</span>
            </div>
            <SpinPill />
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Spin Pole Climb</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Slow Poles"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Climb time">
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
