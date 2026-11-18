"use client";

// The game HUD: how far down the room you are, orbs, the hero power (Riko's dash charges) and the
// flow meter on the left; the title and level, the run clock (the orb and flow bonus taken off),
// level 1's coach line for its three beats and each level's twist line, and on level 5 Jack
// Wobble's health bar with its hint in the centre. The shell keeps Mute / Pause; its clock chip is
// off. Local multiplayer: the "2-4 players" button, the join screen, per-player chips, the podium.
// The shared hero picker shows between runs; the orbit camera's recenter button and hint (OrbitHud).
import { useEffect, useSyncExternalStore } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import ComboMeter from "@/arcade3d/menu2/combo/ComboMeter";
import BossHealthBar from "@/arcade3d/menu2/boss/BossHealthBar";
import { phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import HeroPicker from "@/arcade3d/menu2/heroes/HeroPicker";
import OrbitHud from "@/arcade3d/menu2/camera/OrbitHud";
import { HEROES, heroById, pickedHero, selectHero, subscribeHero, type HeroId } from "./heroes";
import { STAT, runTimeMs } from "./rules";
import type { ToySpec } from "./levels";
import { COMBO, JACK } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/** One short line per beat or twist (teach by playing, no text walls); null when nothing to say. */
export function coachLine(level: number, progress: number): string | null {
   if (level === 1) {
      if (progress < 12) return "Walk into the first domino";
      if (progress < 28) return null;
      if (progress < 48) return "Follow the wave: the fallen pieces are your bridge";
      if (progress < 62) return null;
      if (progress < 76) return "Stand on the drum as the wave hits it";
      return null;
   }
   if (level === 2 && progress < 16) return "A gap in the chain? Push the spare piece in";
   if (level === 3 && progress > 25 && progress < 45) return "Race cars! Dodge them, or ride one";
   if (level === 4 && progress < 12) return "Lights out: stay right behind the wave";
   return null;
}

/** The boss's hint per phase (what opens it). */
export function bossHint(phase: number, open: boolean): string {
   if (phase === 0) return open ? "Drop the book on him!" : "A lid rattles: start that box's chain";
   if (phase === 1) return open ? "Push his blocks back at him!" : "He spits a new chain: get ready";
   return open ? "Topple the giant line onto him!" : "He bounces: push the giant line as he takes off";
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? JACK.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const on = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
   if (!on) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={JACK.name} phaseName={JACK.phases[phase]?.name} hp={hp} maxHp={JACK.maxHp} marks={phaseMarks(JACK)} vulnerable={open} flash={flash} accent="#fbbf24" />
         {hp > 0 ? <div className={stack.hint}>{bossHint(phase, open)}</div> : null}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<ToySpec>();
   const level = config?.id ?? 1;
   const boss = !!config?.boss;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const mainOrbs = useArcadeStore((s) => s.stats[STAT.mainOrbs] ?? 0);
   const progress = useArcadeStore((s) => s.stats[STAT.progress] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const dashes = useArcadeStore((s) => s.stats[STAT.dashes] ?? 3);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const playingPhase = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "zuno");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const mainTotal = config ? config.orbs.filter((o) => o.main).length : 0;
   const coach = playingPhase && !boss ? coachLine(level, progress) : null;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            {boss ? null : (
               <div className={styles.pill} aria-label={`${progress} percent of the way to the toy chest`}>
                  <span className={styles.beaconDot} aria-hidden="true" />
                  <span className={styles.value}>{progress}%</span>
               </div>
            )}
            <div className={styles.pill} aria-label={`Orbs ${mainOrbs} of ${mainTotal}, ${orbs} in all`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>
                  {mainOrbs}/{mainTotal}
               </span>
               {orbs > mainOrbs ? <span className={styles.unit}>+{orbs - mainOrbs}</span> : null}
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
               {hero.id === "riko" ? <span className={styles.unit}>x{dashes}</span> : null}
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Toy Room Run</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Desk Start"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {boss && !playing ? <Boss /> : null}
            {coach ? (
               <div className={stack.boss}>
                  <div className={stack.hint}>{coach}</div>
               </div>
            ) : null}
         </div>
      </>
   );
}
