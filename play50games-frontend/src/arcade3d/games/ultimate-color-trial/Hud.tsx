"use client";

// The game HUD: the section, the gems, the hero power (Riko's dash charges, the carried colour) and
// the flow meter on the left; the title and level, the run clock (the gem and flow bonus taken off),
// the objective strip (rings passed, the door row and the colour you carry, the round's countdown,
// the core), level 1's coach lines and each level's twist line, and on level 5 the Chroma Sentinel's
// health bar with his beacon's ask in the centre. The shell keeps Mute / Pause; its clock chip is
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
import { PALETTE, type TrialSpec } from "./levels";
import { COMBO, SENTINEL } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

/** The section kinds as the stat codes them (rules.ts STAT.sectionKind). */
export const KIND_NAMES = ["Jump pads", "Trial rings", "Colour doors", "Laser runway", "Survival round", "Energy core", "Chroma Sentinel"] as const;

/** One short line per beat or twist (teach by playing, no text walls); null when nothing to say. */
export function coachLine(level: number, kind: number, objDone: number, charge: number): string | null {
   if (level === 1) {
      if (kind === 0) return "Jump the pads: the gaps are one jump wide";
      if (kind === 1) return objDone === 0 ? "Run through the lit ring, then the next" : null;
      if (kind === 2) return charge < 0 ? "Step on a switch to take its colour, then its door" : "Your colour's door is open";
      return null;
   }
   if (level === 2 && kind === 3) return "Jump the beams as they come";
   if (level === 3 && kind === 4) return "Hold out: the exit opens when the round ends";
   if (level === 3 && kind === 5 && objDone === 0) return "Carry the core to its pedestal";
   if (level === 4 && kind === 1) return "The high rings want a jump";
   return null;
}

/** The Sentinel's hint per phase (what his beacon asks). */
export function bossHint(phase: number, open: boolean, color: number): string {
   if (phase === 0) return open ? `${color >= 0 ? PALETTE[color].name : "The colour"}: take it through its door to him` : "His beacon shows a colour: find its switch";
   if (phase === 1) return open ? "Pass his three rings in order" : "His rings light up next";
   return open ? "Carry the core to his receptor" : "A core drops next: keep clear of the sweep";
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

/** The objective strip: rings or doors as dots, the carried colour, the round's countdown, the core. */
function Goal() {
   const kind = useArcadeStore((s) => s.stats[STAT.sectionKind] ?? -1);
   const done = useArcadeStore((s) => s.stats[STAT.objDone] ?? 0);
   const total = useArcadeStore((s) => s.stats[STAT.objTotal] ?? 0);
   const charge = useArcadeStore((s) => (s.stats[STAT.charge] ?? 0) - 1);
   const left = useArcadeStore((s) => s.stats[STAT.surviveLeft] ?? 0);
   const carrying = useArcadeStore((s) => (s.stats[STAT.carrying] ?? 0) === 1);
   if (kind < 0) return null;
   const dots = [];
   if (kind === 1 || kind === 2) for (let i = 0; i < total; i++) dots.push(<span key={i} className={`${styles.dot} ${i < done ? styles.dotDone : i === done ? styles.dotNext : ""}`} />);
   return (
      <div className={styles.goal} role="status">
         <span className={styles.goalLabel}>{KIND_NAMES[kind] ?? "Trial"}</span>
         {dots.length > 0 ? <span className={styles.dots}>{dots}</span> : null}
         {kind === 2 ? <span className={`${styles.charge} ${charge < 0 ? styles.chargeNone : ""}`} style={charge >= 0 ? { background: PALETTE[charge].hex } : undefined} aria-label={charge >= 0 ? `carrying ${PALETTE[charge].name}` : "no colour"} /> : null}
         {kind === 4 ? <span>{left > 0 ? `${left} s` : total > 0 ? "exit open" : "step in"}</span> : null}
         {kind === 5 ? <span>{done >= 1 ? "delivered" : carrying ? "carrying" : "pick it up"}</span> : null}
         {kind === 6 && charge >= 0 ? <span className={styles.charge} style={{ background: PALETTE[charge].hex }} aria-label={`carrying ${PALETTE[charge].name}`} /> : null}
      </div>
   );
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? SENTINEL.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const on = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
   const color = useArcadeStore((s) => (s.stats[STAT.bossColor] ?? 0) - 1);
   if (!on) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={SENTINEL.name} phaseName={SENTINEL.phases[phase]?.name} hp={hp} maxHp={SENTINEL.maxHp} marks={phaseMarks(SENTINEL)} vulnerable={open} flash={flash} accent="#f472b6" />
         {hp > 0 ? <div className={stack.hint}>{bossHint(phase, open, color)}</div> : null}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<TrialSpec>();
   const level = config?.id ?? 1;
   const boss = !!config?.boss;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const mainOrbs = useArcadeStore((s) => s.stats[STAT.mainOrbs] ?? 0);
   const section = useArcadeStore((s) => s.stats[STAT.section] ?? 0);
   const sections = useArcadeStore((s) => s.stats[STAT.sections] ?? (config ? config.sections.length : 0));
   const kind = useArcadeStore((s) => s.stats[STAT.sectionKind] ?? -1);
   const objDone = useArcadeStore((s) => s.stats[STAT.objDone] ?? 0);
   const charge = useArcadeStore((s) => (s.stats[STAT.charge] ?? 0) - 1);
   const bossOn = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
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
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "riko");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const mainTotal = config ? config.gems.filter((o) => o.main).length : 0;
   const coach = playingPhase && !bossOn ? coachLine(level, kind, objDone, charge) : null;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Section ${Math.min(sections, section + 1)} of ${sections}`}>
               <span className={styles.sectionDot} aria-hidden="true" />
               <span className={styles.value}>
                  {Math.min(sections, section + 1)}/{sections}
               </span>
            </div>
            <div className={styles.pill} aria-label={`Gems ${mainOrbs} of ${mainTotal}, ${orbs} in all`}>
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
               <span className={styles.title}>Ultimate Color Trial</span>
               <span className={styles.level}>
                  Level {level} · {config?.name ?? "Jump Trial"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {playingPhase && !bossOn ? <Goal /> : null}
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
