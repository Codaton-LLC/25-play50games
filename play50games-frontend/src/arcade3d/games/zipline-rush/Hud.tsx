"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useLevel } from "../../core/level";
import HeroPicker from "../../menu2/heroes/HeroPicker";
import OrbitHud from "../../menu2/camera/OrbitHud";
import ComboMeter from "../../menu2/combo/ComboMeter";
import BossHealthBar from "../../menu2/boss/BossHealthBar";
import { usePlayers, playersStore } from "../../menu2/multiplayer/players";
import { HEROES, pickedHero, subscribeHero, selectHero } from "./heroes";
import { LEVELS, type ZipLevel } from "./levels";
import { VOLT_EEL } from "./progression";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import styles from "./Hud.module.css";
export default function Hud() {
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const multi = usePlayers((s) => s.phase !== "off");
   const stats = useArcadeStore((s) => s.stats), elapsed = useArcadeStore((s) => s.elapsedMs), phase = useArcadeStore((s) => s.phase);
   const { config } = useLevel<ZipLevel>(); const c = config ?? LEVELS[1];
   useEffect(() => () => playersStore.getState().endSession(), []);
   const speed = (stats.speed ?? 70) / 10;
   const mode = stats.mode ?? 0, section = stats.section ?? 0;
   const hint = mode === 3 ? "Ring the Tide Bell · Power" : mode === 0 ? "Jump to grab the cable" : c.boss && section === 2 ? stats.open ? "Head open! Hop from the safe line" : `Cable ${stats.lane === 0 ? "LEFT" : "RIGHT"} charging · switch away` : c.boss && section === 3 ? "Tuck the spiral · release fast into the gill" : c.id === 1 && section === 0 ? "Let speed build · brake near the mat · release" : c.id === 1 && section === 1 ? "Hold DOWN to tuck through the dip" : "Jump + sideways to switch · brake before release";
   return <>
      <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multi} extra={<MultiplayerButton />} />
      <OrbitHud /><MultiplayerHud />
      {!multi && (phase === "playing" || phase === "countdown" || phase === "paused") && <div className={styles.hud} data-arcade-safe-area="">
         <div className={styles.eyebrow}>SKY & SEA / {String(c.id).padStart(2, "0")}</div>
         <div className={styles.title}>{c.name}<span>{(elapsed / 1000).toFixed(1)} s</span></div>
         <div className={styles.stats}><span>LINE {section + 1}/{c.sections}</span><span>◈ {stats.orbs ?? 0}/{c.sections * 4}</span><span>POWER {stats.cooldown ? `${stats.cooldown}s` : "READY"}</span></div>
         <div className={styles.speed} aria-label={`Speed ${speed.toFixed(1)} metres per second`}>
            <div className={styles.band} /><div className={styles.needle} style={{ left: `${Math.min(98, speed / 20 * 100)}%` }} />
         </div>
         <div className={styles.legend}><span>BRAKE ↑</span><strong className={speed >= 6 && speed <= 8 ? styles.green : ""}>{speed.toFixed(1)} m/s</strong><span>↓ TUCK</span></div>
         <p className={styles.hint}>{hint}</p>
         <ComboMeter chain={stats.chain ?? 0} multiplier={stats.mult ?? 1} flow={stats.flow ?? 0} cap={2} />
         {c.boss && section >= 2 && <BossHealthBar name="Volt Eel" phaseName={VOLT_EEL.phases[stats.bossPhase ?? 0].name} hp={stats.hp ?? 5} maxHp={5} marks={[0.4, 0.2]} vulnerable={stats.open === 1} />}
      </div>}
   </>;
}
