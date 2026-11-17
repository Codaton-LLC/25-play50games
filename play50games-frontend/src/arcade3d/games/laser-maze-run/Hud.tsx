"use client";

// The game HUD: the room (zone n of N), orbs, the hero power and the flow meter on the left; the title,
// the level, the run clock, the laser touches and the progress down the vault at the top centre; under it
// the switch prompt ("E: switch" / "Action") while a switch pad is in reach, and on level 5 the Vault
// Core's health bar with what to do in each phase. The shell keeps Mute / Pause; its clock chip is off.
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
import { LEVELS, type LaserLevel } from "./levels";
import { COMBO, VAULT_CORE } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

const PHASE_HINTS = ["Jump its sweep, press a pylon while it glows gold", "Shorter windows: be on a pylon before it opens", "Meltdown: fast sweeps, one more overload!"];

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? VAULT_CORE.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const started = useArcadeStore((s) => s.stats[STAT.bossHp] !== undefined);
   if (!started) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={VAULT_CORE.name} phaseName={VAULT_CORE.phases[phase]?.name ?? ""} hp={hp} maxHp={VAULT_CORE.maxHp} marks={phaseMarks(VAULT_CORE)} vulnerable={open} flash={flash} accent="#c084fc" />
         <div className={stack.hint}>{hp > 0 ? PHASE_HINTS[phase] ?? "" : "The exit is open: run!"}</div>
      </div>
   );
}

/** The switch prompt while a switch pad is in reach. */
function SwitchPrompt() {
   const near = useArcadeStore((s) => (s.stats[STAT.near] ?? 0) > 0);
   const live = useArcadeStore((s) => s.phase === "playing");
   const playing = usePlayers((s) => s.phase === "playing");
   if (!near || !live || playing) return null;
   return (
      <div className={`${styles.prompt} ${styles.switchPrompt}`} role="status">
         <span className={styles.key}>E</span> Switch
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<LaserLevel>();
   const level = config?.id ?? 1;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const power = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const hits = useArcadeStore((s) => s.stats[STAT.hits] ?? 0);
   const zone = useArcadeStore((s) => s.stats[STAT.zone] ?? 1);
   const progress = useArcadeStore((s) => s.stats[STAT.progress] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "vexa");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const powerText = hero.id === "nami" ? "Double" : power > 0 ? `${power}s` : hero.powerLabel;
   const zones = LEVELS[level].zones;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Laser zone ${Math.min(zone, zones)} of ${zones}`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 7 H21 M3 12 H21 M3 17 H21" stroke="#ff2d55" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>
                  {Math.min(zone, zones)}/{zones}
               </span>
            </div>
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
               <span className={styles.title}>Laser Maze Run</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Static Lasers"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
               {hits > 0 ? <span className={styles.catches} aria-label={`Zapped ${hits} times`}>⚡ {hits}</span> : null}
            </div>
            <div className={styles.progress} aria-hidden="true">
               <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <SwitchPrompt />
            {config?.boss && !playing ? <Boss /> : null}
         </div>
      </>
   );
}
