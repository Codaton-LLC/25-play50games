"use client";

// The game HUD: orbs, lanterns lit, the ember meter (the card's 8 s timer, red and pulsing under 2 s),
// the hero power and the flow meter on the left; the title and the level in a banner at the top centre
// with the run clock (finish time so far, orb and flow bonus taken off), and on level 5 the Soot Bat
// Queen's health bar with a hint for the phase. A one-line hint teaches the lantern bounce and the dark.
// The shell keeps Mute / Pause; its clock chip is off (index.tsx). Local multiplayer (menu2/multiplayer):
// a "2-4 players" button on the shared hero picker, the join screen, per-player chips and the podium.
// The shared Menu 2 hero picker (menu2/heroes) shows on the start card, the pause menu and the result;
// the orbit camera's recenter button and first-time hint come from menu2/camera's OrbitHud.
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
import { EMBER_LOW_MS, STAT, runTimeMs } from "./rules";
import type { TempleLevel } from "./levels";
import { COMBO, QUEEN } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

const HINTS = ["Relight three lanterns while she is open", "Bounce up into her dive over the glowing lantern", "Throw the ember into the roof brazier (Ember, in the air)"];

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? QUEEN.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const relights = useArcadeStore((s) => s.stats[STAT.relights] ?? 0);
   return (
      <div className={stack.boss}>
         <BossHealthBar name={QUEEN.name} phaseName={QUEEN.phases[phase]?.name} hp={hp} maxHp={QUEEN.maxHp} marks={phaseMarks(QUEEN)} vulnerable={open} flash={flash} accent="#8d8498" />
         {hp > 0 ? (
            <div className={stack.hint}>
               {HINTS[phase] ?? ""}
               {phase === 0 ? (
                  <span className={styles.relights} aria-label={`${relights} of 3 relit`}>
                     {[0, 1, 2].map((i) => (
                        <span key={i} className={`${styles.relight} ${i < relights ? styles.relightOn : ""}`} />
                     ))}
                  </span>
               ) : null}
            </div>
         ) : null}
      </div>
   );
}

/** The ember meter pill: the bar burns down; under 2 s it goes red and pulses (and beeps). */
function EmberPill() {
   const ember = useArcadeStore((s) => s.stats[STAT.ember] ?? 80);
   const max = useArcadeStore((s) => s.stats[STAT.emberMax] ?? 80);
   const low = ember * 100 <= EMBER_LOW_MS;
   const frac = Math.max(0, Math.min(1, ember / Math.max(1, max)));
   return (
      <div className={styles.pill} aria-label={`Ember ${(ember / 10).toFixed(1)} seconds`}>
         <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2 C13 6 18 8 18 14 C18 18 15 21 12 21 C9 21 6 18 6 14 C6 11 8 10 9 7 C10 9 11 9 12 2 Z" fill={low ? "#ef4444" : "#fb923c"} />
            <path d="M12 21 C10 21 9 19 9 17 C9 15 11 14 12 12 C13 14 15 15 15 17 C15 19 14 21 12 21 Z" fill="#fde68a" />
         </svg>
         <span className={styles.ember}>
            <span className={`${styles.emberFill} ${low ? styles.emberLow : ""}`} style={{ width: `${frac * 100}%` }} />
         </span>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<TempleLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const lit = useArcadeStore((s) => s.stats[STAT.lanterns] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const emberLow = useArcadeStore((s) => (s.stats[STAT.ember] ?? 80) * 100 <= EMBER_LOW_MS);
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const level = config?.id ?? 1;
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : (HERO_STAT[heroStat] ?? "kiro"));
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const hint = emberLow ? { text: "The ember is dying: land on a lantern to refill it", tone: "warn" as const } : { text: "Land on a lantern to bounce, refill the ember and light the gold ledges", tone: "info" as const };
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         {!playing && (
            <div className={stack.hint} role="status" style={{ position: "absolute", left: "50%", bottom: 96, transform: "translateX(-50%)", textAlign: "center", pointerEvents: "none", color: hint.tone === "warn" ? "#fca5a5" : undefined }}>
               {hint.text}
            </div>
         )}
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <EmberPill />
            <div className={styles.pill} aria-label={`Orbs ${orbs} of 5`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}/5</span>
            </div>
            <div className={styles.pill} aria-label={`Lanterns lit ${lit} of ${config?.lanterns ?? 9}`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="7" y="5" width="10" height="14" rx="3" fill="#c08a3c" />
                  <rect x="9" y="8" width="6" height="8" rx="2" fill="#ffd36a" />
                  <rect x="9" y="2" width="6" height="3" fill="#6b4a22" />
               </svg>
               <span className={styles.value}>
                  {lit}/{config?.lanterns ?? 9}
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
               <span className={styles.title}>Temple Lantern Jump</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Temple Gate"}
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
