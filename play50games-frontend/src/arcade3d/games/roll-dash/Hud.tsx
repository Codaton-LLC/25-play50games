"use client";

// The game HUD: the hearts, the street meter (how far to the gate), the colour orbs and the flow meter
// with its five-segment spectrum (each hero that opened a lock in the chain lights one; all five = Full
// Prism) on the left; the hero PORTRAIT STRIP (the W6 card's touch tag: tap a portrait to tag that hero;
// each shows its glyph, its power's cooldown, and greys while tagging is cooling or locked by a Prism
// Lock zone), bottom-left above the joystick area; the title and level banner at the top centre with
// the run clock, and on level 5 the Echo Storm Hawk's health bar with a hint for the phase. The shell
// keeps Mute / Pause; its clock chip is off (index.tsx). Local multiplayer: a "2-4 players" button on
// the hero picker, the join screen, per-player chips and the podium.
import { useEffect, useSyncExternalStore } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import ComboMeter from "@/arcade3d/menu2/combo/ComboMeter";
import BossHealthBar from "@/arcade3d/menu2/boss/BossHealthBar";
import { phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import HeroPicker from "@/arcade3d/menu2/heroes/HeroPicker";
import OrbitHud from "@/arcade3d/menu2/camera/OrbitHud";
import { HEROES, pickedHero, selectHero, subscribeHero } from "./heroes";
import { HEARTS, STAT, runTimeMs } from "./rules";
import type { DashLevel } from "./levels";
import { COMBO, HAWK } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import { tagLatch } from "./latch";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HINTS = ["Open its feather-locks with the right hero", "Dodge its lane shadow, then be the plate's hero and jump into it", "Tag through its five plates, one hero each"];

/** The glyph of each hero, as a small SVG (colour-blind readable). */
export function Glyph({ glyph }: { glyph: string }) {
   const d =
      glyph === "chevron"
         ? "M5 7 L12 13 L19 7 M5 13 L12 19 L19 13"
         : glyph === "wave"
           ? "M3 15 C7 6 11 21 15 11 C17 7 19 9 21 11"
           : glyph === "hexagon"
             ? "M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z"
             : glyph === "horseshoe"
               ? "M6 20 L6 11 A6 6 0 0 1 18 11 L18 20"
               : "M12 12 m0 0 a1.5 1.5 0 1 1 1.5 1.5 a3 3 0 1 1 -3 -3 a4.5 4.5 0 1 1 4.5 4.5 a6 6 0 1 1 -6 -6";
   return (
      <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden="true">
         <path d={d} fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
   );
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? HAWK.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   return (
      <div className={stack.boss}>
         <BossHealthBar name={HAWK.name} phaseName={HAWK.phases[phase]?.name} hp={hp} maxHp={HAWK.maxHp} marks={phaseMarks(HAWK)} vulnerable={open} flash={flash} accent="#94a3b8" />
         {hp > 0 ? <div className={stack.hint}>{HINTS[phase] ?? ""}</div> : null}
      </div>
   );
}

/** The portrait strip: tap to tag (the W6 card's touch direct-select; keys 1-5). */
function Portraits() {
   const active = useArcadeStore((s) => s.stats[STAT.active] ?? -1);
   const ready = useArcadeStore((s) => (s.stats[STAT.tagReady] ?? 1) === 1);
   const locked = useArcadeStore((s) => (s.stats[STAT.noTag] ?? 0) === 1);
   const cools = [
      useArcadeStore((s) => s.stats[STAT.cool0] ?? 0),
      useArcadeStore((s) => s.stats[STAT.cool1] ?? 0),
      useArcadeStore((s) => s.stats[STAT.cool2] ?? 0),
      useArcadeStore((s) => s.stats[STAT.cool3] ?? 0),
      useArcadeStore((s) => s.stats[STAT.cool4] ?? 0),
   ];
   const playing = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   if (!playing || active < 0) return null;
   return (
      <div className={`${styles.strip} ${!ready || locked ? styles.stripWait : ""}`} data-arcade-safe-area="" role="group" aria-label={locked ? "Tagging is locked here" : "Tag a hero"}>
         {HEROES.map((h, i) => (
            <button
               key={h.id}
               type="button"
               className={`${styles.portrait} ${i === active ? styles.portraitOn : ""}`}
               style={{ background: h.color }}
               aria-label={`${h.name} (${i + 1}): ${h.powerLabel}${cools[i] > 0 ? `, ready in ${cools[i]} s` : ""}`}
               aria-pressed={i === active}
               onPointerDown={(e) => {
                  e.preventDefault();
                  tagLatch.tag = i + 1;
               }}
            >
               <Glyph glyph={h.glyph} />
               <span className={styles.key}>{i + 1}</span>
               {cools[i] > 0 ? <span className={styles.cool}>{cools[i]}</span> : null}
               {locked ? <span className={styles.chain} aria-hidden="true" /> : null}
            </button>
         ))}
      </div>
   );
}

/** The street meter: how far down it you are; amber in the last 15 %. */
function StreetPill({ length }: { length: number }) {
   const d = useArcadeStore((s) => s.stats[STAT.distance] ?? 0);
   const frac = length > 0 ? Math.max(0, Math.min(1, d / length)) : 0;
   return (
      <div className={styles.pill} aria-label={length > 0 ? `${d} of ${length} metres` : `${d} metres`}>
         <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 21 L11 3 M16 21 L13 3" stroke="#cbd5e1" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M12 6 L12 8 M12 11 L12 13 M12 16 L12 18" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
         </svg>
         {length > 0 ? (
            <span className={styles.meter}>
               <span className={`${styles.meterFill} ${frac > 0.85 ? styles.meterHigh : ""}`} style={{ width: `${frac * 100}%` }} />
            </span>
         ) : null}
         <span className={styles.value}>{d}m</span>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<DashLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const hearts = useArcadeStore((s) => s.stats[STAT.hearts] ?? HEARTS);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const spectrum = useArcadeStore((s) => s.stats[STAT.spectrum] ?? 0);
   const shown = runTimeMs(tenths * 100, comboMs);
   const level = config?.id ?? 1;
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         {!playing && <Portraits />}
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`${hearts} of ${HEARTS} hearts`}>
               {Array.from({ length: HEARTS }, (_, i) => (
                  <svg key={i} className={`${styles.heart} ${i < hearts ? "" : styles.heartOff}`} viewBox="0 0 24 24" aria-hidden="true">
                     <path d="M12 21 C5 15 2 11.5 2 8 A5 5 0 0 1 12 5.5 A5 5 0 0 1 22 8 C22 11.5 19 15 12 21 Z" />
                  </svg>
               ))}
            </div>
            <StreetPill length={config?.length ?? 0} />
            <div className={styles.pill} aria-label={`${orbs} colour orbs`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
            <div className={styles.spectrum} aria-label={`Spectrum: ${[0, 1, 2, 3, 4].filter((i) => (spectrum >> i) & 1).length} of 5 heroes`}>
               {HEROES.map((h, i) => (
                  <span key={h.id} className={styles.segment} style={{ background: (spectrum >> i) & 1 ? h.color : undefined }} />
               ))}
            </div>
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Roll Dash</span>
               <span className={styles.level}>
                  <span className={styles.levelLong}>
                     Level {level} — {config?.name ?? "Gate Street"}
                  </span>
                  <span className={styles.levelShort}>{config?.name ?? "Gate Street"}</span>
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
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
