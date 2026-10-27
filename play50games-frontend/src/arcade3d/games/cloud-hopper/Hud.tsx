"use client";

// The game HUD: orbs, the distance, the hero power, the glide meter (feather gold, max 4.5 s), the
// centre streak and the flow meter on the left; the title and the level in a banner at the top centre
// with the run clock (the sunset; finish time so far, orb and flow bonus taken off), and on level 5
// Gloom Nimbus's health bar with the shocks charged. The shell keeps Mute / Pause; its clock chip is
// off (index.tsx clockChip: false). Local multiplayer (menu2/multiplayer): a "2-4 players" button on
// the hero row (desktop and tablet), the join screen, per-player chips and the podium.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import ComboMeter from "@/arcade3d/menu2/combo/ComboMeter";
import BossHealthBar from "@/arcade3d/menu2/boss/BossHealthBar";
import { phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { HEROES, heroById, pickedHero, selectHero, type HeroId } from "./heroes";
import { GLIDE_MAX_MS, STAT, runTimeMs } from "./rules";
import type { CloudLevel } from "./levels";
import { COMBO, GLOOM_NIMBUS } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

function HeroPick() {
   const phase = useArcadeStore((s) => s.phase);
   const lobby = usePlayers((s) => s.phase === "lobby");
   const [hero, setHero] = useState<HeroId>(pickedHero);
   if (phase !== "ready" || lobby || typeof document === "undefined") return null;
   return createPortal(
      <div className={styles.pick} role="group" aria-label="Choose your hero">
         <span className={styles.pickLabel}>Hero</span>
         {HEROES.map((h) => (
            <button
               key={h.id}
               type="button"
               className={hero === h.id ? styles.pickOn : styles.pickBtn}
               aria-label={`${h.name}, ${h.powerLabel}`}
               aria-pressed={hero === h.id}
               onClick={() => {
                  selectHero(h.id);
                  setHero(h.id);
               }}
            >
               <span className={styles.swatch} style={{ background: h.color }} aria-hidden="true" />
               <span className={styles.pickName}>{h.name}</span>
               <span className={styles.pickPower}>{h.powerLabel}</span>
            </button>
         ))}
         <MultiplayerButton />
      </div>,
      document.body,
   );
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? GLOOM_NIMBUS.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const charges = useArcadeStore((s) => s.stats[STAT.charges] ?? 0);
   return (
      <div className={styles.boss}>
         <BossHealthBar
            name={GLOOM_NIMBUS.name}
            phaseName={GLOOM_NIMBUS.phases[phase]?.name}
            hp={hp}
            maxHp={GLOOM_NIMBUS.maxHp}
            marks={phaseMarks(GLOOM_NIMBUS)}
            vulnerable={open}
            flash={flash}
            accent="#a78bfa"
         />
         {phase === 0 && hp > 0 ? <div className={styles.charges}>{charges > 0 ? `Shock charged x${charges}` : "Glide past the lightning rods"}</div> : null}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<CloudLevel>();
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const dist = useArcadeStore((s) => s.stats[STAT.distance] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero] ?? 0);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const glide = useArcadeStore((s) => s.stats[STAT.glide] ?? 0);
   const streak = useArcadeStore((s) => s.stats[STAT.streak] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const level = config?.id ?? 1;
   const hero = heroById(HERO_STAT[heroStat] ?? "riko");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const glideFrac = Math.max(0, Math.min(1, (glide * 100) / GLIDE_MAX_MS));
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <div className={styles.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Orbs ${orbs}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}</span>
            </div>
            <div className={styles.pill} aria-label={`Distance ${dist} metres`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 15 C6 10 10 10 12 13 C14 9 19 9 21 14 Z" fill="#fff" />
                  <path d="M4 19 H20" stroke="#7dd3fc" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{dist} m</span>
            </div>
            <div className={styles.pill} aria-label={`Glide ${(glide / 10).toFixed(1)} seconds`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 20 C8 10 14 5 20 4 C18 10 13 16 4 20 Z" fill="#fde68a" />
                  <path d="M6 18 L16 8" stroke="#b45309" strokeWidth="1.4" />
               </svg>
               <span className={styles.glide}>
                  <span className={styles.glideFill} style={{ width: `${glideFrac * 100}%` }} />
               </span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            {streak > 1 ? (
               <div className={styles.pill} aria-label={`Centre streak ${streak}`}>
                  <span className={styles.value}>★ {streak}</span>
               </div>
            ) : null}
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={styles.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Cloud Hopper</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Soft Clouds"}
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
