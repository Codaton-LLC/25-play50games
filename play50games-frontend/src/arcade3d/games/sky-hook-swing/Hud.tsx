"use client";

// Rope length, orbs, the peak flash, the run clock and, on level 5, the Gust Galleon's health.
import { useSyncExternalStore } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import ComboMeter from "@/arcade3d/menu2/combo/ComboMeter";
import BossHealthBar from "@/arcade3d/menu2/boss/BossHealthBar";
import { phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { HEROES, heroById, pickedHero, selectHero, subscribeHero, type HeroId } from "./heroes";
import HeroPicker from "@/arcade3d/menu2/heroes/HeroPicker";
import OrbitHud from "@/arcade3d/menu2/camera/OrbitHud";
import { STAT, runTimeMs } from "./rules";
import type { SwingLevel } from "./levels";
import { COMBO, GUST_GALLEON } from "./progression";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.max(0, Math.floor(ms / 1000));
   const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? GUST_GALLEON.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   return (
      <div className={styles.boss}>
         <BossHealthBar
            name={GUST_GALLEON.name}
            phaseName={GUST_GALLEON.phases[phase]?.name}
            hp={hp}
            maxHp={GUST_GALLEON.maxHp}
            marks={phaseMarks(GUST_GALLEON)}
            vulnerable={open}
            flash={flash}
            accent="#38bdf8"
         />
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<SwingLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const rope = useArcadeStore((s) => (s.stats[STAT.rope] ?? 0) / 10);
   const peak = useArcadeStore((s) => (s.stats[STAT.peak] ?? 0) === 1);
   const elapsed = useArcadeStore((s) => s.elapsedMs);
   const finishMs = useArcadeStore((s) => s.stats[STAT.finishMs] ?? 0);
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => (s.stats[STAT.comboMult] ?? 100) / 100);
   const flow = useArcadeStore((s) => (s.stats[STAT.comboFlow] ?? 0) / 10);
   const id = HERO_STAT[heroStat ?? 1] ?? "nami";
   const hero = heroById(id);
   const shown = finishMs > 0 ? finishMs : elapsed;
   const clock = runTimeMs(shown, orbs, comboMs);
   return (
      <>
         <HeroPick />
         <OrbitHud />
         <div className={styles.banner}>
            <p className={styles.name}>Sky Hook Swing</p>
            <p className={styles.level}>{config?.name ?? "Single Swing"}</p>
         </div>
         <div className={styles.left}>
            <div className={styles.clock}>{clockText(clock)}</div>
            <div className={styles.pill}><span className={styles.value}>{orbs}</span> orbs</div>
            <div className={`${styles.pill} ${peak ? styles.peak : ""}`}><span className={styles.value}>{rope.toFixed(1)} m</span> rope</div>
            <div className={styles.pill}>{hero.powerLabel}</div>
            <ComboMeter chain={chain} multiplier={mult} flow={flow} cap={COMBO.cap} />
         </div>
         {config?.boss ? <Boss /> : null}
         <MultiplayerHud />
      </>
   );
}
