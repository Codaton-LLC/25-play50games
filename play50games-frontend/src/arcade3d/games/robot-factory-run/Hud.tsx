"use client";

// The game HUD: orbs, cells charged (x / N), the hero power and the flow meter on the left; the
// title and the level in a banner at the top centre with the shift clock (finish time so far, orb
// and flow bonus taken off), a klaxon warning while the klaxon belts run backwards, and on level 5
// Overseer M-8's health bar with a hint for the phase. The shell keeps Mute / Pause; its clock chip
// is off (index.tsx). Local multiplayer: the "2-4 players" button on the hero picker, the join
// screen, per-player chips and the podium. The orbit camera's touch button and hint: OrbitHud.
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
import { STAT, floorFor, runTimeMs } from "./rules";
import type { FactoryLevel } from "./levels";
import { COMBO, OVERSEER } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];
const HINTS = ["Route a cell into M-8's glowing chest", "Step on the gold plate: drag M-8 into the press", "Up the catwalk: jump, then roll-drop into a vent"];

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? OVERSEER.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   return (
      <div className={stack.boss}>
         <BossHealthBar name={OVERSEER.name} phaseName={OVERSEER.phases[phase]?.name} hp={hp} maxHp={OVERSEER.maxHp} marks={phaseMarks(OVERSEER)} vulnerable={open} flash={flash} accent="#ef4444" />
         {hp > 0 ? <div className={stack.hint}>{HINTS[phase] ?? ""}</div> : null}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<FactoryLevel>();
   const level = config?.id ?? 1;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const cells = useArcadeStore((s) => s.stats[STAT.cells] ?? 0);
   const klaxon = useArcadeStore((s) => (s.stats[STAT.klaxon] ?? 0) === 1);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : (HERO_STAT[heroStat] ?? "riko"));
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const need = floorFor(level).spec.cells;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Orbs ${orbs}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>{orbs}</span>
            </div>
            {!config?.boss ? (
               <div className={styles.pill} aria-label={`Cells charged ${cells} of ${need}`}>
                  <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                     <rect x="7" y="4" width="10" height="17" rx="2" fill="#ef4444" />
                     <rect x="10" y="2" width="4" height="3" rx="1" fill="#fde68a" />
                     <path d="M13 8 L10 13 H13 L11 18" stroke="#fff7d6" strokeWidth="1.6" fill="none" />
                  </svg>
                  <span className={styles.value}>
                     {cells}/{need}
                  </span>
               </div>
            ) : null}
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Robot Factory Run</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Assembly Start"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Shift time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
               {klaxon ? <span className={styles.klaxon}>KLAXON</span> : null}
            </div>
            {config?.boss && !playing ? <Boss /> : null}
         </div>
      </>
   );
}
