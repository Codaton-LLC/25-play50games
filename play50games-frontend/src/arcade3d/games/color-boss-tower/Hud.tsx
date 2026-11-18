"use client";

// The game HUD: hearts, orbs, the charged cannons waiting for the next opening and the flow meter on
// the left; the title and level, the run clock (the orb and flow bonus taken off), the guardian's
// health bar with a hint per phase in the centre (level 5's Grey Heart: the five glyphs, the lit one
// big); World 6's portrait strip at the bottom: tap a hero (or 1-5, T) to tag them in; each portrait
// shows its key and its power's recharge; the strip dims while the tag cools down and greys out under
// Prism Lock. The shell keeps Mute / Pause; its clock chip is off. Local multiplayer: the "2-4 players"
// button, the join screen, per-player chips, the podium. The hero picker (who starts) shows between
// runs; the orbit camera's recenter button and hint (OrbitHud).
import { useEffect, useSyncExternalStore } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useLevel } from "@/arcade3d/core/level";
import ComboMeter from "@/arcade3d/menu2/combo/ComboMeter";
import BossHealthBar from "@/arcade3d/menu2/boss/BossHealthBar";
import { phaseMarks } from "@/arcade3d/menu2/boss/boss";
import { playersStore, usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import HeroPicker from "@/arcade3d/menu2/heroes/HeroPicker";
import OrbitHud from "@/arcade3d/menu2/camera/OrbitHud";
import { TAG_COLOUR, TAG_ORDER } from "@/arcade3d/menu2/heroTag/rules";
import { requestTag } from "@/arcade3d/menu2/heroTag/tagInput";
import { HEROES, heroById, pickedHero, selectHero, subscribeHero } from "./heroes";
import { HEARTS, STAT, runTimeMs } from "./rules";
import type { TowerSpec } from "./levels";
import { BOSSES, COMBO } from "./progression";
import { TAG_HEX } from "./look";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const CD_STAT = [STAT.cdRiko, STAT.cdNami, STAT.cdKiro, STAT.cdZuno, STAT.cdVexa] as const;

/** The guardian's hint per level and phase (what opens him, what to do). */
export function bossHint(level: number, phase: number, open: boolean, ready: number): string {
   if (level === 5) {
      if (phase === 0) return open ? "Only the lit colour's cannon fires!" : "Charge the claw of the colour his plates show";
      if (phase === 1) return open ? "Two cannons at once!" : "Charge two claws in a row: his beam drains them";
      return open ? "Be the hero of each lit glyph!" : "Prism Lock: pick your hero before the glyphs";
   }
   if (level === 4 && phase === 1) return open ? "Two cannons at once!" : "Chain charge: two claws within 4 s";
   if (open) return ready > 0 ? "Fire!" : "Plate open: no cannon charged!";
   if (ready > 0) return "Charged: wait for his plate to open";
   return "Climb to a claw as the hero of its colour";
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss({ level }: { level: number }) {
   const cfg = level === 5 ? BOSSES.grand : BOSSES[`stone${level + 1}` as "stone2" | "stone3" | "stone4" | "stone5"];
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? cfg.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const on = useArcadeStore((s) => (s.stats[STAT.bossOn] ?? 0) === 1);
   const ready = useArcadeStore((s) => s.stats[STAT.ready] ?? 0);
   const glyph = useArcadeStore((s) => s.stats[STAT.glyph] ?? -1);
   if (!on) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={cfg.name} phaseName={cfg.phases[phase]?.name} hp={hp} maxHp={cfg.maxHp} marks={phaseMarks(cfg)} vulnerable={open} flash={flash} accent="#c084fc" />
         {level === 5 && phase === 2 ? (
            <div className={styles.glyphs} aria-label="Glyphs">
               {TAG_ORDER.map((id, i) => (
                  <span key={id} className={`${styles.glyph} ${i === glyph ? styles.glyphLit : ""}`} style={i === glyph ? { background: TAG_HEX[TAG_COLOUR[id]], color: TAG_HEX[TAG_COLOUR[id]] } : undefined} />
               ))}
            </div>
         ) : null}
         {hp > 0 ? <div className={stack.hint}>{bossHint(level, phase, open, ready)}</div> : null}
      </div>
   );
}

/** World 6's portrait strip (tap or 1-5 to tag; T for the next). */
function Strip() {
   const active = useArcadeStore((s) => s.stats[STAT.hero] ?? -1);
   const cooling = useArcadeStore((s) => (s.stats[STAT.tagCd] ?? 0) === 1);
   const locked = useArcadeStore((s) => (s.stats[STAT.locked] ?? 0) === 1);
   const cds = useArcadeStore((s) => CD_STAT.map((k) => s.stats[k] ?? 0).join(","));
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const activeIndex = active >= 0 ? active : TAG_ORDER.indexOf(pick);
   const cd = cds.split(",").map(Number);
   return (
      <div className={styles.bottom} data-arcade-safe-area="">
         <div className={`${styles.strip} ${cooling ? styles.stripCooling : ""} ${locked ? styles.stripLocked : ""}`} role="group" aria-label="Tag a hero">
            {TAG_ORDER.map((id, i) => {
               const h = heroById(id);
               const left = h.cooldownMs > 0 ? Math.min(1, (cd[i] * 100) / h.cooldownMs) : 0;
               const on = i === activeIndex;
               return (
                  <button
                     key={id}
                     type="button"
                     className={`${styles.portrait} ${on ? styles.portraitActive : ""}`}
                     style={{ background: `radial-gradient(circle at 35% 30%, #ffffff55, ${h.color} 55%, #111827 120%)`, color: h.color }}
                     aria-pressed={on}
                     aria-label={`${h.name}, ${h.powerLabel}${left > 0 ? `, recharging` : ", ready"} (key ${i + 1})`}
                     onPointerDown={(e) => {
                        e.preventDefault();
                        requestTag(id);
                     }}
                     onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") requestTag(id);
                     }}
                  >
                     <span style={{ color: "#fff" }}>{h.name[0]}</span>
                     {left > 0 ? <span className={styles.portraitCd} style={{ background: `conic-gradient(rgba(0,0,0,0.55) ${left * 360}deg, transparent 0)` }} /> : null}
                     <span className={styles.portraitKey}>{i + 1}</span>
                  </button>
               );
            })}
         </div>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<TowerSpec>();
   const level = config?.id ?? 1;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const hearts = useArcadeStore((s) => s.stats[STAT.hearts] ?? HEARTS);
   const ready = useArcadeStore((s) => s.stats[STAT.ready] ?? 0);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const running = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown" || s.phase === "paused");
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const total = config ? config.orbs.length : 5;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`${hearts} of ${HEARTS} hearts`}>
               <span className={styles.hearts} aria-hidden="true">
                  {Array.from({ length: HEARTS }, (_, i) => (
                     <span key={i} className={i < hearts ? styles.heartOn : styles.heartOff}>
                        ♥
                     </span>
                  ))}
               </span>
            </div>
            <div className={styles.pill} aria-label={`Orbs ${orbs} of ${total}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>
                  {orbs}/{total}
               </span>
            </div>
            <div className={styles.pill} aria-label={`${ready} cannons charged`}>
               <span className={styles.swatch} style={{ background: ready > 0 ? "#fef08a" : "#4b5563" }} aria-hidden="true" />
               <span className={styles.value}>{ready}</span>
               <span className={styles.unit}>charged</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Color Boss Tower</span>
               <span className={styles.level}>
                  Level {level} · {config?.name ?? "Training Guardian"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {!playing ? <Boss level={level} /> : null}
         </div>
         {running && !playing ? <Strip /> : null}
      </>
   );
}
