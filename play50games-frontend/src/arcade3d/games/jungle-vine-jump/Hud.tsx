"use client";

// The game HUD: orbs, the climb (height of the top), the grip meter (how far down the vine the hands
// are: short = fast, long = far, with the swing angle), the hero power and the combo meter on the left;
// the title and the level in a banner at the top centre with the run clock (finish time so far, orb and
// combo bonus taken off), and on level 5 the Howler King's health bar with a hint for the phase. A
// one-line hint teaches the vine (on a branch: jump into a vine; on a vine: grip, pump, let go). The
// shell keeps Mute / Pause; its clock chip is off (index.tsx). Local multiplayer (menu2/multiplayer): a
// "2-4 players" button on the shared hero picker, the join screen, per-player chips and the podium. The
// shared Menu 2 hero picker (menu2/heroes) shows on the start card, the pause menu and the result; the
// orbit camera's recenter button and first-time hint come from menu2/camera's OrbitHud.
import { useEffect, useSyncExternalStore } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import ComboMeter from "@/arcade3d/menu2/combo/ComboMeter";
import BossHealthBar from "@/arcade3d/menu2/boss/BossHealthBar";
import { phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import HeroPicker from "@/arcade3d/menu2/heroes/HeroPicker";
import OrbitHud from "@/arcade3d/menu2/camera/OrbitHud";
import { HEROES, heroById, pickedHero, selectHero, subscribeHero, type HeroId } from "./heroes";
import { GRIP_MAX, GRIP_MIN, STAT, runTimeMs } from "./rules";
import type { VineLevel } from "./levels";
import { COMBO, HOWLER } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

const HINTS = ["Pump to a full swing and swing into his perch", "After his roar, release from a big swing straight into him", "Meet him at the bottom faster: pull your grip short"];

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? HOWLER.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   return (
      <div className={stack.boss}>
         <BossHealthBar name={HOWLER.name} phaseName={HOWLER.phases[phase]?.name} hp={hp} maxHp={HOWLER.maxHp} marks={phaseMarks(HOWLER)} vulnerable={open} flash={flash} accent="#8f8a94" />
         {hp > 0 ? <div className={stack.hint}>{HINTS[phase] ?? ""}</div> : null}
      </div>
   );
}

/** The grip meter: where the hands are on the vine (short = fast, long = far) and the swing's angle. */
function GripPill() {
   const hanging = useArcadeStore((s) => (s.stats[STAT.hanging] ?? 0) === 1);
   const grip = useArcadeStore((s) => (s.stats[STAT.grip] ?? 60) / 10);
   const swing = useArcadeStore((s) => s.stats[STAT.swing] ?? 0);
   const frac = (grip - GRIP_MIN) / (GRIP_MAX - GRIP_MIN);
   return (
      <div className={styles.pill} aria-label={hanging ? `Grip ${grip.toFixed(1)} metres, swing ${swing} degrees` : "Not on a vine"} style={hanging ? undefined : { opacity: 0.55 }}>
         <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 1 C10 6 14 10 12 15 C10 19 13 21 12 23" fill="none" stroke="#4ade80" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="12" cy={4 + frac * 16} r="3.2" fill="#fde68a" />
         </svg>
         <span className={styles.ember}>
            <span className={styles.emberFill} style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%`, background: frac > 0.66 ? "#38bdf8" : frac < 0.33 ? "#f97316" : "#4ade80" }} />
         </span>
         <span className={styles.value}>{hanging ? `${swing}°` : "–"}</span>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<VineLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const height = useArcadeStore((s) => s.stats[STAT.height] ?? 0);
   const top = useArcadeStore((s) => s.stats[STAT.top] ?? 0);
   const hanging = useArcadeStore((s) => (s.stats[STAT.hanging] ?? 0) === 1);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const level = config?.id ?? 1;
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : (HERO_STAT[heroStat] ?? "kiro"));
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   const touch = useCoarsePointer();
   useEffect(() => () => playersStore.getState().endSession(), []);
   const hint = hanging
      ? touch
         ? "Stick up / down slides your grip · left / right with the swing pumps · Jump lets go"
         : "Up / Down slides your grip · Left / Right with the swing pumps · Space lets go"
      : "Jump into a vine to grab it";
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         {!playing && (
            <div className={stack.hint} role="status" style={{ position: "absolute", left: "50%", bottom: 96, transform: "translateX(-50%)", textAlign: "center", pointerEvents: "none" }}>
               {hint}
            </div>
         )}
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <GripPill />
            <div className={styles.pill} aria-label={`Orbs ${orbs} of 5`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}/5</span>
            </div>
            <div className={styles.pill} aria-label={`Height ${height} of ${top} metres`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3 L18 11 H14 V21 H10 V11 H6 Z" fill="#a3e635" />
               </svg>
               <span className={styles.value}>
                  {Math.min(height, top)}/{top} m
               </span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Jungle Vine Jump</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Green Start"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Climb time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {config?.boss && !playing ? <Boss /> : null}
         </div>
      </>
   );
}
