"use client";

// The HUD (menu2/hud HudStack placement): on the left the orbs (ore found / in the mine), the depth
// gauge down to the lift, the hero power and the flow meter; at the top centre the banner, the run
// clock with the star target, Rockjaw's bar on L5, the rockfall countdown on L4 and a one-line coach
// that teaches L1 by playing. The shared hero picker shows on the start card, pause and result.
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
import { LEVELS, parseLevel, type MineLevel } from "./levels";
import { ROCKJAW } from "./progression";
import { CELL, STAT, orbTotal } from "./rules";
import { COACH } from "./coach";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
}

function Boss() {
   const stats = useArcadeStore((s) => s.stats);
   if (!stats.boss) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar
            name={ROCKJAW.name}
            phaseName={ROCKJAW.phases[stats[STAT.bossPhase] ?? 0]?.name}
            hp={stats[STAT.bossHp] ?? ROCKJAW.maxHp}
            maxHp={ROCKJAW.maxHp}
            marks={phaseMarks(ROCKJAW)}
            vulnerable={stats[STAT.bossOpen] === 1}
            flash={stats[STAT.bossFlash] === 1}
            accent="#fb923c"
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
   const { config } = useLevel<MineLevel>();
   const c = config ?? LEVELS[1];
   useEffect(() => () => playersStore.getState().endSession(), []);
   const info = HEROES.find((h) => h.id === hero) ?? HEROES[0];
   const total = orbTotal(c.id);
   const map = parseLevel(c);
   const liftDepth = Math.round(map.lift.row * CELL);
   const depth = stats[STAT.depth] ?? 0;
   const live = phase === "playing" || phase === "countdown" || phase === "paused" || phase === "over";
   const shownMs = stats[STAT.finishMs] ? stats[STAT.finishMs] : elapsed;
   const rock = stats.rock ?? -1;
   const coach = COACH[stats[STAT.coach] ?? 0] ?? COACH[0];
   return (
      <>
         <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multi} extra={phase === "ready" ? <MultiplayerButton /> : null} />
         <OrbitHud />
         {multi && <MultiplayerHud />}
         {live && !playing && (
            <>
               <div className={stack.left} data-arcade-safe-area="">
                  <div className={styles.pill} aria-label={`Orbs ${stats[STAT.orbs] ?? 0} of ${total}`}>
                     <span className={styles.orb} aria-hidden="true" />
                     <span className={styles.value}>
                        {stats[STAT.orbs] ?? 0}
                        <small>/{total}</small>
                     </span>
                  </div>
                  <div className={styles.depth} aria-label={`Depth ${depth} of ${liftDepth} metres`}>
                     <div className={styles.depthTop}>
                        <span>DEPTH {depth} m</span>
                        <span>LIFT {liftDepth} m</span>
                     </div>
                     <div className={styles.depthBar}>
                        <div className={styles.depthFill} style={{ width: `${Math.min(100, (depth / Math.max(1, liftDepth)) * 100)}%` }} />
                     </div>
                  </div>
                  <div className={styles.pill} aria-label={`${info.name}: ${info.powerLabel}`}>
                     <span className={styles.swatch} style={{ background: info.color }} aria-hidden="true" />
                     <span className={styles.power}>{stats[STAT.power] ? `${stats[STAT.power]}s` : info.powerLabel.split(" · ")[0]}</span>
                  </div>
                  <ComboMeter chain={stats[STAT.comboChain] ?? 0} multiplier={(stats[STAT.comboMult] ?? 100) / 100} flow={(stats[STAT.comboFlow] ?? 0) / 10} cap={2} />
               </div>
               <div className={stack.center} data-arcade-safe-area="">
                  <div className={styles.banner}>
                     <span className={styles.title}>Mine Tunnel Run</span>
                     <span className={styles.level}>
                        Level {c.id} · {c.name}
                     </span>
                  </div>
                  <div className={styles.clock} role="timer" aria-label="Run time">
                     <span className={styles.value}>{clockText(shownMs)}</span>
                     <span className={styles.target}>★ {c.targetMs / 1000}s</span>
                  </div>
                  <Boss />
                  {rock > 0 && <div className={`${stack.hint} ${styles.coach} ${styles.warn}`}>Rockfall in {rock} s</div>}
                  {phase === "playing" && <div className={`${stack.hint} ${styles.coach}`}>{coach}</div>}
               </div>
            </>
         )}
      </>
   );
}
