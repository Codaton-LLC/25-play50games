"use client";

// The game HUD: the coin purse, the lives, the boulder's gap (a meter that reddens as it closes in), the
// relic orbs, the hero power and the coin combo on the left; the title and the level in a banner at the
// top centre with the score and the run clock, the next gate's card (its cheap and dear prices, and
// whether the purse can pay: "pay or bank?"), level 1's coach line for its three beats, and on level 5
// Coilstone's health bar with its hint. The screen's edges darken as the boulder closes in. The shell
// keeps Mute / Pause; its clock chip is off (index.tsx clockChip: false). Local multiplayer
// (menu2/multiplayer): the "2-4 players" button, the join screen, per-player chips, the podium. The
// shared Menu 2 hero picker (menu2/heroes) shows on the start card, the pause menu and the result; the
// orbit camera's recenter button and first-time hint come from OrbitHud.
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
import { GAP, LIVES, STAT } from "./rules";
import type { TempleLevel } from "./levels";
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

/** Level 1's coach line: one short line per beat (teach by playing, no text walls). */
export function coachLine(level: number, gate: number, coins: number, cheap: number, dist: number): string | null {
   if (level !== 1) return null;
   if (dist < 14) return "Swipe or press ← → to change lane · grab the coins";
   if (gate === 0) return coins >= cheap ? "Run through the toll arch: it costs 5" : "Grab coins to pay the toll";
   if (gate === 1) return coins >= cheap ? "You can pay it, or keep your coins" : "Not enough coins: take a free slow lane";
   if (gate === 2) return "Pay for speed, or bank: unspent coins score x2";
   return null;
}

/** Coilstone's hint per phase. */
export function bossHint(phase: number, open: boolean, bells: number): string {
   if (phase === 0) return bells > 0 ? "A bell is ready: it drops when it recoils" : open ? "It recoils: pay a bell gate (middle lane)" : "Hiss! Leave the dusty lane";
   if (phase === 1) return bells > 0 ? "A bell is ready: it drops when it recoils" : open ? "Pay a bell gate: 30 coins" : "Jump the low coil · roll under the high one";
   return bells > 0 ? "A plate cracks!" : "Pay the offering bowls: every 10 coins cracks a plate";
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const on = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? COILSTONE.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const bells = useArcadeStore((s) => s.stats[STAT.bells] ?? 0);
   if (!on) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name="Coilstone" phaseName={COILSTONE.phases[phase]?.name} hp={hp} maxHp={COILSTONE.maxHp} marks={phaseMarks(COILSTONE)} vulnerable={open} flash={flash} accent="#34d399" />
         {hp > 0 ? <div className={stack.hint}>{bossHint(phase, open, bells)}</div> : <div className={stack.hint}>The plates shatter: run for the grand gate!</div>}
      </div>
   );
}

/** The next gate's card: its prices and whether the purse can pay. */
function GateCard() {
   const g = useArcadeStore((s) => s.stats[STAT.gateNext] ?? -1);
   const cheap = useArcadeStore((s) => s.stats[STAT.gateCheap] ?? -1);
   const dear = useArcadeStore((s) => s.stats[STAT.gateDear] ?? -1);
   const dist = useArcadeStore((s) => s.stats[STAT.gateDist] ?? -1);
   const coins = useArcadeStore((s) => s.stats[STAT.coins] ?? 0);
   const playing = useArcadeStore((s) => s.phase === "playing");
   if (!playing || g < 0 || cheap < 0) return null;
   const can = coins >= cheap;
   const canDear = dear >= 0 && coins >= dear;
   return (
      <div className={`${styles.gate} ${can ? styles.gateCan : styles.gateCannot}`} aria-label={`Toll gate in ${dist} metres: ${cheap}${dear >= 0 ? ` or ${dear}` : ""} coins`}>
         <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 21 V9 Q12 1 21 9 V21 H16 V12 Q12 8 8 12 V21 Z" fill="#c4ad88" stroke="#fff" strokeWidth="1.4" />
         </svg>
         <span className={styles.price}>
            <span className={styles.coinDot} aria-hidden="true" />
            {cheap}
         </span>
         {dear >= 0 ? (
            <span className={`${styles.price} ${canDear ? "" : styles.priceOff}`}>
               <span className={styles.coinDot} aria-hidden="true" />
               {dear}
            </span>
         ) : null}
         <span className={styles.gateText}>{can ? "pay or bank?" : `short by ${cheap - coins}`}</span>
      </div>
   );
}

/** The screen's edges darken as the boulder closes in. */
function Danger() {
   const gap = useArcadeStore((s) => (s.stats[STAT.gap] ?? GAP.base * 10) / 10);
   const playing = useArcadeStore((s) => s.phase === "playing");
   const k = playing ? Math.max(0, Math.min(1, (GAP.base - gap) / (GAP.base - GAP.catch))) : 0;
   if (k <= 0.02) return null;
   return <div className={styles.danger} style={{ opacity: 0.25 + k * 0.6 }} aria-hidden="true" />;
}

export default function Hud() {
   const { config } = useLevel<TempleLevel>();
   const coins = useArcadeStore((s) => s.stats[STAT.coins] ?? 0);
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const lives = useArcadeStore((s) => s.stats[STAT.lives] ?? LIVES);
   const gap = useArcadeStore((s) => (s.stats[STAT.gap] ?? GAP.base * 10) / 10);
   const dist = useArcadeStore((s) => s.stats[STAT.distance] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const gate = useArcadeStore((s) => s.stats[STAT.gateNext] ?? -1);
   const cheap = useArcadeStore((s) => s.stats[STAT.gateCheap] ?? -1);
   const score = useArcadeStore((s) => s.score);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const playingPhase = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const level = config?.id ?? 1;
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "kiro");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const gapFrac = Math.max(0, Math.min(1, (gap - GAP.catch) / (GAP.max - GAP.catch)));
   const coach = playingPhase ? coachLine(level, gate, coins, cheap, dist) : null;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         {!playing ? <Danger /> : null}
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={`${styles.pill} ${styles.purse}`} aria-label={`Coins ${coins}`}>
               <span className={styles.coin} aria-hidden="true" />
               <span className={styles.value}>{coins}</span>
            </div>
            <div className={styles.pill} aria-label={`Lives ${lives} of ${LIVES}`}>
               {Array.from({ length: LIVES }, (_v, i) => (
                  <svg key={i} className={`${styles.heart} ${i < lives ? "" : styles.heartOff}`} viewBox="0 0 24 24" aria-hidden="true">
                     <path d="M12 21 C5 15 2 11.5 2 8 A5 5 0 0 1 12 6 A5 5 0 0 1 22 8 C22 11.5 19 15 12 21 Z" />
                  </svg>
               ))}
            </div>
            <div className={styles.pill} aria-label={`The ${config?.boss ? "serpent" : "boulder"} is ${gap.toFixed(1)} metres behind`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="13" r="8" fill="#8a7f6c" stroke="#fff" strokeWidth="1.6" />
                  <path d="M6 10 L10 12 M12 7 L13 11 M15 15 L11 17" stroke="#4b4438" strokeWidth="1.6" strokeLinecap="round" />
               </svg>
               <span className={styles.meter}>
                  <span className={`${styles.gapFill} ${gap < 3 ? styles.gapDanger : ""}`} style={{ width: `${gapFrac * 100}%` }} />
               </span>
               <span className={styles.unit}>{gap.toFixed(0)} m</span>
            </div>
            <div className={styles.pill} aria-label={`Relic orbs ${orbs} of 3`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}/3</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Temple Coin Rush</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Temple Entry"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label={`Score ${score}, run time`}>
               <span className={styles.value}>{score}</span>
               <span className={styles.unit}>pts</span>
               <span className={styles.sep} aria-hidden="true" />
               <span className={styles.value}>{clockText(tenths * 100)}</span>
            </div>
            {!playing ? <GateCard /> : null}
            {config?.boss && !playing ? <Boss /> : null}
            {coach ? (
               <div className={stack.boss}>
                  <div className={stack.hint}>{coach}</div>
               </div>
            ) : null}
         </div>
      </>
   );
}
