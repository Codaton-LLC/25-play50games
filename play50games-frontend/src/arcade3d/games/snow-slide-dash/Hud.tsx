"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useLevel } from "../../core/level";
import HeroPicker from "../../menu2/heroes/HeroPicker";
import OrbitHud from "../../menu2/camera/OrbitHud";
import ComboMeter from "../../menu2/combo/ComboMeter";
import BossHealthBar from "../../menu2/boss/BossHealthBar";
import { phaseMarks } from "../../menu2/boss/boss";
import { playersStore, usePlayers } from "../../menu2/multiplayer/players";
import { HEROES, pickedHero, selectHero, subscribeHero } from "./heroes";
import { STAT } from "./rules";
import { LEVELS, type SnowLevel } from "./levels";
import { BIG_DRIFT, COMBO } from "./progression";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import stack from "../../menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

export default function Hud() {
   const { config } = useLevel<SnowLevel>();
   const level = config?.id ?? 1, l = LEVELS[level];
   const stats = useArcadeStore((s) => s.stats), phase = useArcadeStore((s) => s.phase);
   const ms = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100) * 100);
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   useEffect(() => () => playersStore.getState().endSession(), []);
   const shown = phase === "countdown" || phase === "playing" || phase === "over";
   const hero = HEROES[stats[STAT.hero] ?? HEROES.findIndex((h) => h.id === pick)];
   const d = stats[STAT.distance] ?? 0;
   const hint = level === 1 ? d < 85 ? "Steer through the pines" : d < 180 ? "Thread three ice gates" : "Ramps launch you · hold left/right to spin, release aligned"
      : level === 2 ? "Packed snow is fast · powder grips" : level === 3 ? "Pre-aim before blue ice · no steering on ice" : level === 4 ? "Carve through hats · link both ramps" : "Chain gates to keep the avalanche behind";
   return <>
      <HeroPicker heroes={HEROES} value={pick} onPick={selectHero} hidden={multiplayer} extra={phase === "ready" ? <MultiplayerButton /> : null} />
      <OrbitHud />
      <MultiplayerHud />
      {shown && !multiplayer && <>
         <div className={stack.left} data-arcade-safe-area="">
            <div className={styles.pill}><span>GATE STARS</span><strong>{stats[STAT.orbs] ?? 0} / {l.orbs}</strong></div>
            <div className={styles.pill}><span>SPEED</span><strong>{((stats[STAT.speed] ?? l.baseSpeed * 10) / 10).toFixed(1)} m/s</strong></div>
            <div className={styles.pill}><span>STREAK</span><strong>{stats[STAT.streak] ?? 0} / 6</strong></div>
            <div className={styles.pill}><span>{hero.name.toUpperCase()}</span><strong>{stats[STAT.power] ? `${stats[STAT.power]} s` : hero.powerLabel}</strong></div>
            <div className={styles.surface}>{["POWDER · GRIP", "PACKED · FAST", "ICE · PRE-AIM"][stats[STAT.surface] ?? 1]}</div>
            <ComboMeter chain={stats[STAT.chain] ?? 0} multiplier={(stats[STAT.multiplier] ?? 100) / 100} flow={(stats[STAT.flow] ?? 0) / 100} cap={COMBO.cap} accent="#facc15" />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}><span>SNOW SLIDE DASH</span><strong>{l.name}</strong></div>
            <div className={styles.clock}>{(ms / 1000).toFixed(1)} <small>/ {l.starTargetMs / 1000} s</small></div>
            {level === 5 && <div className={stack.boss}>
               <BossHealthBar name="Big Drift" phaseName={BIG_DRIFT.phases[stats[STAT.bossPhase] ?? 0].name} hp={stats[STAT.bossHp] ?? 5} maxHp={5} marks={phaseMarks(BIG_DRIFT)} vulnerable={stats[STAT.bossOpen] === 1} flash={stats[STAT.bossFlash] === 1} accent="#facc15" />
               <div className={stack.hint}>Gap {stats[STAT.gap] ?? 110} m · Frost stars {stats[STAT.charges] ?? 0}</div>
            </div>}
            <div className={`${stack.hint} ${styles.teach}`}>{hint}</div>
         </div>
      </>}
   </>;
}
