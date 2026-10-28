"use client";

// The game HUD (after Sky Tower Jump's): orbs, how far the storm tide is under the feet, the hero
// power and the flow meter on the left; the title and the level in a banner at the top centre with
// the run clock (finish time so far, orb and flow bonus taken off), and on level 5 Umbra Roller's
// health bar with what the phase asks for. The air meter is not here: it is the ring round the hero
// (Hero.tsx, the card). The shell keeps Mute / Pause; its clock chip is off (index.tsx clockChip:
// false). The shared Menu 2 hero picker (menu2/heroes) shows on the start card, the pause menu and
// the result; local multiplayer (menu2/multiplayer) adds the "2-4 players" button, the join screen,
// per-player chips and the podium; the orbit camera's recenter button and first-time hint come from
// menu2/camera's OrbitHud.
import { useEffect, useSyncExternalStore } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import ComboMeter from "@/arcade3d/menu2/combo/ComboMeter";
import BossHealthBar from "@/arcade3d/menu2/boss/BossHealthBar";
import { phaseMarks } from "@/arcade3d/menu2/boss/boss";
import HeroPicker from "@/arcade3d/menu2/heroes/HeroPicker";
import OrbitHud from "@/arcade3d/menu2/camera/OrbitHud";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { HEROES, heroById, pickedHero, selectHero, subscribeHero, type HeroId } from "./heroes";
import { STAT, runTimeMs } from "./rules";
import type { RuinLevel } from "./levels";
import { COMBO, UMBRA_ROLLER } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import { BOSS_HINTS, BOSS_STEPS } from "./moments";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/**
 * The shared Menu 2 hero picker (menu2/heroes): on the start card, the result screen and the pause
 * menu. The pick is the next run's option (the solo Scene reads it when a run starts). Hidden while a
 * local multiplayer lobby or race is up (the join screen picks the heroes there).
 */
function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   // the "2-4 players" entry only on the start card
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? UMBRA_ROLLER.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => BOSS_STEPS[s.stats[STAT.bossStep] ?? 0] === "vulnerable");
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   return (
      <div className={styles.boss}>
         <BossHealthBar
            name={UMBRA_ROLLER.name}
            phaseName={UMBRA_ROLLER.phases[phase]?.name}
            hp={hp}
            maxHp={UMBRA_ROLLER.maxHp}
            marks={phaseMarks(UMBRA_ROLLER)}
            vulnerable={open}
            flash={flash}
            accent="#a78bfa"
         />
         {hp > 0 ? <div className={styles.charges}>{BOSS_HINTS[phase] ?? ""}</div> : null}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<RuinLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   // the tide's distance under the feet in dm, -1 before it starts
   const tide = useArcadeStore((s) => s.stats[STAT.tide] ?? -1);
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
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "nami");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   const bossLevel = !!config?.boss;
   // leaving the game (Exit) ends a multiplayer session
   useEffect(() => () => playersStore.getState().endSession(), []);
   const tideM = tide < 0 ? null : tide / 10;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         {/* the orbit camera's recenter button (touch) and first-time hint (menu2/camera) */}
         <OrbitHud />
         <div className={styles.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Orbs ${orbs}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}</span>
            </div>
            <div className={styles.pill} aria-label={tideM === null ? "The storm tide has not started" : `The storm tide is ${tideM.toFixed(0)} metres below`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 15 Q6 11 10 15 T18 15 T24 15 V22 H2 Z" fill="#8b5cf6" />
                  <path d="M2 15 Q6 11 10 15 T18 15 T24 15" fill="none" stroke="#ddd6fe" strokeWidth="2" />
               </svg>
               <span className={`${styles.value} ${tideM !== null && tideM < 3 ? styles.tideNear : styles.tide}`}>{tideM === null ? "calm" : `${tideM.toFixed(tideM < 10 ? 1 : 0)} m`}</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={styles.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Flooded Ruins Escape</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Drain Entry"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {bossLevel ? <Boss /> : null}
         </div>
      </>
   );
}
