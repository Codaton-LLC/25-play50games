"use client";

// The HUD (menu2/hud HudStack placement): on the left the line count, orbs, the hero power and the
// speed gauge (the needle turns green inside the bullseye band 6-8 m/s, BRAKE / TUCK either side)
// with the combo meter; at the top centre the title banner, the run clock, a one-line coach that
// teaches by playing (L1) and calls the hazards, and on L5 the Volt Eel bar. Speed lines rush in at
// the screen edges at top speed. The shared hero picker shows on the start card, pause and result.
import { useEffect, useSyncExternalStore } from "react";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useLevel } from "../../core/level";
import HeroPicker from "../../menu2/heroes/HeroPicker";
import OrbitHud from "../../menu2/camera/OrbitHud";
import ComboMeter from "../../menu2/combo/ComboMeter";
import BossHealthBar from "../../menu2/boss/BossHealthBar";
import { phaseMarks } from "../../menu2/boss/boss";
import { usePlayers, playersStore } from "../../menu2/multiplayer/players";
import stack from "../../menu2/hud/HudStack.module.css";
import { HEROES, pickedHero, subscribeHero, selectHero } from "./heroes";
import { LEVELS, type ZipLevel } from "./levels";
import { VOLT_EEL } from "./progression";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
}

/** The coach line: what to do right now. Pure, so the teaching beats are testable. */
export function coachLine(c: ZipLevel, s: Record<string, number | undefined>): string {
   const mode = s.mode ?? 0;
   const section = s.section ?? 0;
   const t = (s.t ?? 0) / 100;
   const speed = (s.speed ?? 70) / 10;
   if (mode === 3) return c.boss ? "Ring the Tide Bell! Jump or Power" : "Ring the bell! Jump or Power";
   if (mode === 4) return "Missed the mat. Back to the tower";
   if (mode === 0) return section === 0 && c.id === 1 ? "Jump (or hold Down) to grab the trolley" : "Jump to grab the next line";
   if (c.boss && section === 2 && (s.hp ?? 5) > 2) {
      if (s.open) return "Its head is open! Jump from the safe line";
      return s.telegraph ? `${s.lane === 0 ? "LEFT" : "RIGHT"} line charging! Hop across` : "Watch the glowing line";
   }
   if (c.boss && section === 3) return t > 0.7 ? "Gill open at the top: jump fast!" : "Tuck the spiral: keep 11 m/s";
   if (t > 0.78) {
      if (speed > 10) return "Too fast! Brake (Up) before you release";
      if (speed < 4.5) return "Too slow! Tuck (Down)";
      return speed >= 6 && speed <= 8 ? "Green! Jump to release onto the mat" : "Jump near the mat to release";
   }
   if (c.id === 1) {
      if (section === 0) return t < 0.4 ? "Feel the speed build down the sag" : "Brake (Up) into the green band";
      if (section === 1) return t > 0.35 && t < 0.72 ? "Hold DOWN: tuck through the dip!" : "A deep dip ahead: get ready to tuck";
      return "Jump + sideways: hop to the orb line";
   }
   if (c.moving && t > 0.45 && t < 0.62) return "Gulls! Tuck (Down) to duck under";
   if (c.night && t > 0.3 && t < 0.46) return "Spark storm: hop to the dark line";
   if (c.crossing && t > 0.35 && t < 0.65) return "Lines cross here: hop to switch";
   return "Jump + sideways to switch lines";
}

function Boss({ c }: { c: ZipLevel }) {
   const stats = useArcadeStore((s) => s.stats);
   if (!c.boss || (stats.section ?? 0) < 2) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar
            name="Volt Eel"
            phaseName={VOLT_EEL.phases[stats.bossPhase ?? 0]?.name}
            hp={stats.hp ?? VOLT_EEL.maxHp}
            maxHp={VOLT_EEL.maxHp}
            marks={phaseMarks(VOLT_EEL)}
            vulnerable={stats.open === 1}
            accent="#22d3ee"
         />
      </div>
   );
}

export default function Hud() {
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const multi = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   const stats = useArcadeStore((s) => s.stats);
   const elapsed = useArcadeStore((s) => s.elapsedMs);
   const phase = useArcadeStore((s) => s.phase);
   const startCard = phase === "ready";
   const { config } = useLevel<ZipLevel>();
   const c = config ?? LEVELS[1];
   useEffect(() => () => playersStore.getState().endSession(), []);
   const speed = (stats.speed ?? 70) / 10;
   const section = stats.section ?? 0;
   const mode = stats.mode ?? 0;
   const info = HEROES.find((h) => h.id === hero) ?? HEROES[1];
   const green = speed >= 6 && speed <= 8;
   const live = phase === "playing" || phase === "countdown" || phase === "paused" || phase === "over";
   const rush = mode === 1 || mode === 2 ? Math.max(0, Math.min(1, (speed - 10) / 8)) : 0;
   const shownMs = stats.finishMs ? stats.finishMs : elapsed;
   return (
      <>
         <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multi} extra={startCard ? <MultiplayerButton /> : null} />
         <OrbitHud />
         {multi && <MultiplayerHud />}
         {live && !playing && <div className={styles.rush} style={{ opacity: rush }} aria-hidden="true" />}
         {live && !playing && (
            <>
               <div className={stack.left} data-arcade-safe-area="">
                  <div className={styles.pill} aria-label={`Line ${section + 1} of ${c.sections}`}>
                     <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 5 Q12 14 22 8" stroke="#e2e8f0" strokeWidth="2" fill="none" />
                        <rect x="9" y="9" width="5" height="4" rx="1" fill="#f97316" />
                        <path d="M11.5 13 v5 M9 18 h5" stroke="#fde68a" strokeWidth="2" />
                     </svg>
                     <span className={styles.value}>
                        {Math.min(section + 1, c.sections)}/{c.sections}
                     </span>
                  </div>
                  <div className={styles.pill} aria-label={`Orbs ${stats.orbs ?? 0} of ${c.sections * 4}`}>
                     <span className={styles.orb} aria-hidden="true" />
                     <span className={styles.value}>
                        {stats.orbs ?? 0}
                        <small>/{c.sections * 4}</small>
                     </span>
                  </div>
                  <div className={styles.pill} aria-label={`${info.name}: ${info.powerLabel}`}>
                     <span className={styles.swatch} style={{ background: info.color }} aria-hidden="true" />
                     <span className={styles.power}>{stats.cooldown ? `${stats.cooldown}s` : info.powerLabel.split(" · ")[0]}</span>
                  </div>
                  <div className={styles.gauge} aria-label={`Speed ${speed.toFixed(1)} metres per second`}>
                     <div className={styles.gaugeTop}>
                        <span className={styles.gaugeSide}>BRAKE ↑</span>
                        <strong className={green ? styles.green : speed > 10 ? styles.red : ""}>{speed.toFixed(1)}</strong>
                        <span className={styles.gaugeSide}>↓ TUCK</span>
                     </div>
                     <div className={styles.track}>
                        <div className={styles.short} />
                        <div className={styles.band} />
                        <div className={styles.over} />
                        <div className={`${styles.needle} ${green ? styles.needleGreen : ""}`} style={{ left: `${Math.min(98, (speed / 20) * 100)}%` }} />
                     </div>
                  </div>
                  <ComboMeter chain={stats.chain ?? 0} multiplier={stats.mult ?? 1} flow={stats.flow ?? 0} cap={2} />
               </div>
               <div className={stack.center} data-arcade-safe-area="">
                  <div className={styles.banner}>
                     <span className={styles.title}>Zipline Rush</span>
                     <span className={styles.level}>
                        Level {c.id} · {c.name}
                     </span>
                  </div>
                  <div className={styles.clock} role="timer" aria-label="Run time">
                     <span className={styles.value}>{clockText(shownMs)}</span>
                     <span className={styles.target}>★ {c.targetMs / 1000}s</span>
                  </div>
                  <Boss c={c} />
                  {phase === "playing" && <div className={`${stack.hint} ${styles.coach}`}>{coachLine(c, stats)}</div>}
               </div>
            </>
         )}
      </>
   );
}
