"use client";

// The game HUD: hidden / exposed, orbs, the hero power and the flow meter on the left; the title, the
// level, the run clock, the catches and the progress down the track at the top centre; under it the
// SCAN telegraph bar (1.5 s ahead: violet while you are exposed, cyan once you are in a shadow), a
// violet glow along the bottom edge as it nears (the card: the bar at the top as well, clear of thumbs)
// and the world drained of colour while a line passes you hidden; on level 5 the Mothership's health
// bar with what to do in each phase. The shell keeps Mute / Pause; its clock chip is off.
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
import type { AlienLevel } from "./levels";
import { COMBO, MOTHERSHIP } from "./progression";
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

const PHASE_HINTS = ["Stand in a beam's lane as it locks, dodge before it lands", "Jump off the saucers into its glowing underside", "Cover to cover to the pad, then jump!"];

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? MOTHERSHIP.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const started = useArcadeStore((s) => s.stats[STAT.bossHp] !== undefined);
   if (!started) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={MOTHERSHIP.name} phaseName={MOTHERSHIP.phases[phase]?.name ?? ""} hp={hp} maxHp={MOTHERSHIP.maxHp} marks={phaseMarks(MOTHERSHIP)} vulnerable={open} flash={flash} accent="#c084fc" />
         <div className={stack.hint}>{hp > 0 ? PHASE_HINTS[phase] ?? "" : "Run for the launch pad!"}</div>
      </div>
   );
}

/** The scan telegraph: the top bar, the bottom-edge glow, the colour drained while a line passes you hidden. */
function ScanWarning() {
   const eta = useArcadeStore((s) => s.stats[STAT.scanEta] ?? -1);
   const hidden = useArcadeStore((s) => (s.stats[STAT.hidden] ?? 0) === 1);
   const live = useArcadeStore((s) => s.phase === "playing");
   const playing = usePlayers((s) => s.phase === "playing");
   if (!live || playing || eta < 0 || eta > 15) return null;
   const k = Math.max(0, Math.min(1, 1 - eta / 15));
   return (
      <>
         <div className={`${styles.scan} ${hidden ? styles.scanSafe : ""}`} role="status" aria-label={hidden ? "Scan coming: you are hidden" : "Scan coming: get into a shadow"}>
            <div className={styles.scanFill} style={{ width: `${Math.round(k * 100)}%` }} />
            <span className={styles.scanText}>{hidden ? "SCAN: HIDDEN" : "SCAN! Get in a shadow"}</span>
         </div>
         {!hidden ? <div className={styles.edge} aria-hidden="true" /> : null}
         {hidden && eta <= 3 ? <div className={styles.desat} aria-hidden="true" /> : null}
      </>
   );
}

export default function Hud() {
   const { config } = useLevel<AlienLevel>();
   const level = config?.id ?? 1;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const power = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const catches = useArcadeStore((s) => s.stats[STAT.catches] ?? 0);
   const hidden = useArcadeStore((s) => (s.stats[STAT.hidden] ?? 0) === 1);
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
   const powerText = power > 0 ? `${power}s` : hero.powerLabel;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={hidden ? "Hidden" : "In the open"}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12 C6 5 18 5 22 12 C18 19 6 19 2 12 Z" fill="none" stroke={hidden ? "#67e8f9" : "#f9a8d4"} strokeWidth="2.2" />
                  <circle cx="12" cy="12" r="3.2" fill={hidden ? "#67e8f9" : "#f9a8d4"} />
                  {hidden ? <path d="M4 20 L20 4" stroke="#67e8f9" strokeWidth="2.4" strokeLinecap="round" /> : null}
               </svg>
               <span className={hidden ? styles.hidden : styles.exposed}>{hidden ? "HIDDEN" : "OPEN"}</span>
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
               <span className={styles.title}>Alien Lane Escape</span>
               <span className={styles.level}>
                  Level {level} · {config?.name ?? "Alien Meadow"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
               {catches > 0 ? <span className={styles.catches} aria-label={`Caught ${catches} times`}>◉ {catches}</span> : null}
            </div>
            <div className={styles.progress} aria-hidden="true">
               <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <ScanWarning />
            {config?.boss && !playing ? <Boss /> : null}
         </div>
      </>
   );
}
