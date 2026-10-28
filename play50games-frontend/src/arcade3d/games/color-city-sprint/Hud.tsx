"use client";

// Lap, orbs, the hero power and the run clock (finish time so far, orb and flow bonus taken off).
// The shell clock chip is off. Level 5 adds Greyout's health. The hero picker and the orbit HUD
// are the shared Menu 2 ones.
import { useSyncExternalStore } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import ComboMeter from "@/arcade3d/menu2/combo/ComboMeter";
import BossHealthBar from "@/arcade3d/menu2/boss/BossHealthBar";
import { phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import HeroPicker from "@/arcade3d/menu2/heroes/HeroPicker";
import OrbitHud from "@/arcade3d/menu2/camera/OrbitHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import { HEROES, heroById, pickedHero, selectHero, subscribeHero, type HeroId } from "./heroes";
import { STAT } from "./rules";
import type { CitySpec } from "./levels";
import { COMBO, GREYOUT } from "./progression";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const safe = Math.max(0, ms);
   const s = Math.floor(safe / 1000);
   const tenths = Math.floor((safe % 1000) / 100);
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
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? GREYOUT.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const name = GREYOUT.phases[phase]?.name ?? "";
   return (
      <div className={stack.boss} data-arcade-safe-area="boss">
         <BossHealthBar
            name="Greyout"
            phaseName={name}
            hp={hp}
            maxHp={GREYOUT.maxHp}
            marks={phaseMarks(GREYOUT)}
            vulnerable={open}
            flash={flash}
            accent="#ef4444"
         />
         <p className={styles.hint}>{phase === 0 ? "Jump the roof brushes" : phase === 1 ? "Roll the valves" : "Lure it into the gate"}</p>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<CitySpec>();
   const level = config?.id ?? 1;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const lap = useArcadeStore((s) => s.stats[STAT.lap] ?? 0);
   const beacons = useArcadeStore((s) => s.stats[STAT.beacons] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const clock = useArcadeStore((s) => s.stats[STAT.clock] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => (s.stats[STAT.comboMult] ?? 100) / 100);
   const flow = useArcadeStore((s) => (s.stats[STAT.comboFlow] ?? 0) / 10);
   const playing = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const hero = heroById(heroStat === undefined ? pickedHero() : HERO_STAT[heroStat] ?? "riko");
   const laps = config?.laps ?? 2;
   const ready = Math.max(0, 1 - powerLeft / ((hero.cooldownMs / 100) || 1));

   return (
      <>
         <HeroPick />
         <OrbitHud />
         <MultiplayerHud />
         {playing ? (
            <>
               <div className={stack.center} data-arcade-safe-area="top">
                  <div className={styles.banner}>
                     <p className={styles.title}>Color City Sprint</p>
                     <p className={styles.level}>{config?.name ?? "Red Block"}</p>
                     <div className={styles.clock}>{clockText(clock)}</div>
                  </div>
               </div>
               <div className={stack.left} data-arcade-safe-area="left">
                  <div className={styles.pills}>
                     <div className={styles.pill}><span>Lap</span><b>{Math.min(laps, lap + 1)}/{laps}</b></div>
                     <div className={styles.pill}><span>Beacons</span><b>{beacons}</b></div>
                     <div className={styles.pill}><span>Gems</span><b>{orbs}</b></div>
                     <div className={styles.pill}><span>{hero.powerLabel}</span><b>{powerLeft <= 0 ? "Ready" : `${(powerLeft / 10).toFixed(1)}s`}</b></div>
                     <div className={styles.power}><span style={{ width: `${Math.round(ready * 100)}%` }} /></div>
                  </div>
                  <ComboMeter chain={chain} multiplier={mult} flow={flow} cap={COMBO.cap} accent={hero.color} />
               </div>
               {level === 5 ? <Boss /> : null}
            </>
         ) : null}
      </>
   );
}
