"use client";

// The HUD (menu2/hud HudStack placement): on the left the cracks (three glass panes), the zone badge
// (mirror / merge / frosted / echo), the orbs (half sit on the reflection's side), the hero power and the
// flow meter; at the top centre the banner, the run clock with the star target and the course bar, the
// Glass Sentinel's bar (and which runway its shield covers) on L5, and the one-line coach.
// The shared hero picker shows on the start card, pause and result.
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
import { LEVELS, type MirrorLevel, type Zone } from "./levels";
import { SENTINEL } from "./progression";
import { CRACKS, STAT, orbTotal } from "./rules";
import { COACH } from "./coach";
import { ZONE_LABEL } from "./look";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import styles from "./Hud.module.css";

const ZONES: Zone[] = ["mirror", "merge", "frost", "echo"];

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
}

function Boss() {
   const stats = useArcadeStore((s) => s.stats);
   if (!stats[STAT.boss]) return null;
   const phase = stats[STAT.bossPhase] ?? 0;
   return (
      <div className={stack.boss}>
         <BossHealthBar
            name={SENTINEL.name}
            phaseName={SENTINEL.phases[phase]?.name}
            hp={stats[STAT.bossHp] ?? SENTINEL.maxHp}
            maxHp={SENTINEL.maxHp}
            marks={phaseMarks(SENTINEL)}
            vulnerable={stats[STAT.bossOpen] === 1}
            flash={stats[STAT.bossFlash] === 1}
            accent="#c4b5fd"
         />
         {phase === 1 && <span className={`${styles.zone} ${styles.zone_mirror}`}>Shield over the {stats[STAT.bossShield] === 1 ? "reflection" : "hero"}: the {stats[STAT.bossShield] === 1 ? "hero" : "reflection"} jumps</span>}
      </div>
   );
}

export default function Hud() {
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const multi = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   const stats = useArcadeStore((s) => s.stats);
   // tenths are all the clock shows: one render per 100 ms, not per frame
   const elapsed = useArcadeStore((s) => Math.floor(s.elapsedMs / 100) * 100);
   const phase = useArcadeStore((s) => s.phase);
   const { config } = useLevel<MirrorLevel>();
   const c = config ?? LEVELS[1];
   useEffect(() => () => playersStore.getState().endSession(), []);
   const info = HEROES.find((h) => h.id === hero) ?? HEROES[0];
   const total = orbTotal(c.id);
   const live = phase === "playing" || phase === "countdown" || phase === "paused" || phase === "over";
   const shownMs = stats[STAT.finishMs] ? stats[STAT.finishMs] : elapsed;
   const cracks = stats[STAT.cracks] ?? 0;
   const zone = ZONES[stats[STAT.zone] ?? 0] ?? "mirror";
   const coach = COACH[stats[STAT.coach] ?? 0] ?? "";
   return (
      <>
         <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multi} extra={phase === "ready" ? <MultiplayerButton /> : null} />
         <OrbitHud />
         {multi && <MultiplayerHud />}
         {live && !playing && (
            <>
               <div className={stack.left} data-arcade-safe-area="">
                  <div className={styles.panes} aria-label={`Cracks ${cracks} of ${CRACKS}`}>
                     {Array.from({ length: CRACKS }, (_, i) => (
                        <span key={i} className={`${styles.pane} ${i < cracks ? styles.paneCracked : ""}`} aria-hidden="true" />
                     ))}
                  </div>
                  <span className={`${styles.zone} ${styles[`zone_${zone}`]}`}>{ZONE_LABEL[zone]}</span>
                  <div className={styles.pill} aria-label={`Orbs ${stats[STAT.orbs] ?? 0} of ${total}`}>
                     <span className={styles.orb} aria-hidden="true" />
                     <span className={styles.value}>
                        {stats[STAT.orbs] ?? 0}
                        <small>/{total}</small>
                     </span>
                  </div>
                  <div className={styles.pill} aria-label={`${info.name}: ${info.powerLabel}`}>
                     <span className={styles.swatch} style={{ background: info.color }} aria-hidden="true" />
                     <span className={styles.power}>{stats[STAT.power] ? `${stats[STAT.power]}s` : info.powerLabel.split(" · ")[0]}</span>
                  </div>
                  <ComboMeter chain={stats[STAT.comboChain] ?? 0} multiplier={(stats[STAT.comboMult] ?? 100) / 100} flow={(stats[STAT.comboFlow] ?? 0) / 10} cap={2} />
               </div>
               <div className={stack.center} data-arcade-safe-area="">
                  <div className={styles.banner}>
                     <span className={styles.title}>Mirror Dash</span>
                     <span className={styles.level}>
                        Level {c.id} · {c.name}
                     </span>
                  </div>
                  <div className={styles.clock} role="timer" aria-label="Run time">
                     <span className={styles.value}>{clockText(shownMs)}</span>
                     <span className={styles.target}>★ {c.targetMs / 1000}s</span>
                  </div>
                  <div className={styles.progress} aria-hidden="true">
                     <div className={styles.progressFill} style={{ width: `${Math.min(100, stats[STAT.progress] ?? 0)}%` }} />
                  </div>
                  <Boss />
                  {phase === "playing" && coach && <div className={`${stack.hint} ${styles.coach}`}>{coach}</div>}
               </div>
            </>
         )}
      </>
   );
}
