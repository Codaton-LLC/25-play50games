"use client";

// The game HUD: orbs, the slide speed (a bar to 9 m/s, gold past 7: a long launch), what is under your
// feet (ICE: you slide / SNOW: grip), the hero power and the flow meter on the left; the title, the level,
// the run clock and the height climbed in a banner at the top centre; on level 5 the Frost Golem's health
// bar with what to do in each phase. The shell keeps Mute / Pause; its clock chip is off. Local
// multiplayer: the "2-4 players" button on the shared hero picker (desktop and tablet), the join screen,
// per-player chips and the podium. The orbit camera's recenter button and first-time hint come from OrbitHud.
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
import { STAT, V_ICE, runTimeMs } from "./rules";
import type { PeakLevel } from "./levels";
import { COMBO, FROST_GOLEM } from "./progression";
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

const PHASE_HINTS = ["Slide up his slam slope, launch onto his back core", "Climb the boulders he throws to his shoulder", "Climb the cairn before it crumbles: his head crystal"];

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? FROST_GOLEM.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const started = useArcadeStore((s) => s.stats[STAT.bossHp] !== undefined);
   if (!started) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={FROST_GOLEM.name} phaseName={FROST_GOLEM.phases[phase]?.name ?? ""} hp={hp} maxHp={FROST_GOLEM.maxHp} marks={phaseMarks(FROST_GOLEM)} vulnerable={open} flash={flash} accent="#38bdf8" />
         <div className={stack.hint}>{hp > 0 ? PHASE_HINTS[phase] ?? "" : "To the summit cairn!"}</div>
      </div>
   );
}

/** The slide speed: a bar to 9 m/s (gold past 7 m/s: far launches). */
function Speed() {
   const tenths = useArcadeStore((s) => s.stats[STAT.speed] ?? 0);
   const grip = useArcadeStore((s) => s.stats[STAT.grip] ?? 0);
   const v = tenths / 10;
   const k = Math.min(1, v / V_ICE);
   return (
      <div className={styles.meter} aria-label={`Speed ${v.toFixed(1)} metres a second, ${grip === 2 ? "on ice" : grip === 1 ? "on snow" : "in the air"}`}>
         <span className={grip === 2 ? styles.ice : grip === 1 ? styles.snowTag : styles.air}>{grip === 2 ? "ICE" : grip === 1 ? "SNOW" : "AIR"}</span>
         <div className={styles.meterBar}>
            <div className={styles.meterFill} style={{ width: `${k * 100}%`, background: v >= 7 ? "linear-gradient(90deg, #38bdf8, #facc15)" : undefined }} />
         </div>
         <span className={styles.value}>{v.toFixed(1)}</span>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<PeakLevel>();
   const level = config?.id ?? 1;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const height = useArcadeStore((s) => s.stats[STAT.height] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "zuno");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <Speed />
            <div className={styles.pill} aria-label={`Orbs ${orbs}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Ice Peak Jumper</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Base Camp"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
               <span className={styles.height}>▲ {height} m</span>
            </div>
            {config?.boss && !playing ? <Boss /> : null}
         </div>
      </>
   );
}
