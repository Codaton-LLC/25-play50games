"use client";

// The game HUD: the size pips (Small / Normal / Big, the card's three pips) with the coins eaten towards
// the next size, orbs, the hero power (Zuno's magnet ON / OFF) and the flow meter on the left; the
// title, the level, the run clock, the size misses and the progress down the road at the top centre;
// under it the next obstacle's size sign (BIG / SMALL, 2 s ahead; 3 s on level 1); on level 5 King
// Bonbon's health bar with what to do in each phase. The shell keeps Mute / Pause; its clock chip is off.
// Local multiplayer: the "2-4 players" button, the join screen, per-player chips and the podium.
import { useEffect, useSyncExternalStore } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import ComboMeter from "@/arcade3d/menu2/combo/ComboMeter";
import BossHealthBar from "@/arcade3d/menu2/boss/BossHealthBar";
import { phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import HeroPicker from "@/arcade3d/menu2/heroes/HeroPicker";
import OrbitHud from "@/arcade3d/menu2/camera/OrbitHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import { HEROES, heroById, pickedHero, selectHero, subscribeHero, type HeroId } from "./heroes";
import { STAT, runTimeMs } from "./rules";
import { COINS_PER_SIZE } from "./course";
import type { CandyLevel } from "./levels";
import { COMBO, KING_BONBON } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];
const SIZE_NAMES = ["SMALL", "NORMAL", "BIG"];

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

const PHASE_HINTS = ["Small under the wheels, Big into his jelly drum", "Grab the golden coins, slam his throne at Big", "Small, Big, Small... then Big onto his crown"];

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? KING_BONBON.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const started = useArcadeStore((s) => s.stats[STAT.bossHp] !== undefined);
   if (!started) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={KING_BONBON.name} phaseName={KING_BONBON.phases[phase]?.name ?? ""} hp={hp} maxHp={KING_BONBON.maxHp} marks={phaseMarks(KING_BONBON)} vulnerable={open} flash={flash} accent="#f472b6" />
         <div className={stack.hint}>{hp > 0 ? PHASE_HINTS[phase] ?? "" : "Run for the gate!"}</div>
      </div>
   );
}

/** The three size pips, the size's name and the coins eaten towards the next size. */
function Sizes() {
   const size = useArcadeStore((s) => s.stats[STAT.size] ?? 0);
   const eaten = useArcadeStore((s) => s.stats[STAT.eaten] ?? 0);
   return (
      <div className={styles.sizes} aria-label={`Size ${SIZE_NAMES[size]}, ${eaten} of ${COINS_PER_SIZE} coins to grow`}>
         {[0, 1, 2].map((i) => (
            <span key={i} className={`${styles.pip} ${i <= size ? styles.pipOn : ""}`} style={{ width: 10 + i * 5, height: 10 + i * 5 }} aria-hidden="true" />
         ))}
         <span className={styles.sizeName}>{SIZE_NAMES[size]}</span>
         {size < 2 ? (
            <span className={styles.coins} aria-hidden="true">
               {Array.from({ length: COINS_PER_SIZE }, (_, i) => (
                  <span key={i} className={`${styles.coinDot} ${i < eaten ? styles.coinDotOn : ""}`} />
               ))}
            </span>
         ) : null}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<CandyLevel>();
   const level = config?.id ?? 1;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const power = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const misses = useArcadeStore((s) => s.stats[STAT.misses] ?? 0);
   const sign = useArcadeStore((s) => s.stats[STAT.sign] ?? 0);
   const progress = useArcadeStore((s) => s.stats[STAT.progress] ?? 0);
   const live = useArcadeStore((s) => s.phase === "playing");
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "zuno");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const powerText = hero.id === "zuno" ? (power === -1 ? "Magnet ON" : "Magnet off") : power > 0 ? `${power}s` : hero.powerLabel;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <Sizes />
            <div className={styles.pill} aria-label={`Orbs ${orbs}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name}: ${powerText}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerText}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Candy World Runner</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Candy Lane"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
               {misses > 0 ? <span className={styles.misses}>✕ {misses}</span> : null}
            </div>
            <div className={styles.progress} aria-hidden="true">
               <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            {live && sign > 0 && !playing ? (
               <div className={`${styles.sign} ${sign === 2 ? styles.signBig : styles.signSmall}`} role="status">
                  {sign === 2 ? "BIG ahead: eat the coins" : "SMALL ahead: roll down"}
               </div>
            ) : null}
            {config?.boss && !playing ? <Boss /> : null}
         </div>
      </>
   );
}
