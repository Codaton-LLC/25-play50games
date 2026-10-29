"use client";

// The game HUD: targets down of the set, orbs, the hero power, clean catches, the colour that pays
// double next (level 3) and the flow meter on the left; the title and the level in a banner at the top
// centre with the run clock, the hook meter while Throw is held and one teaching line (aim and let go,
// be on the ring for the catch, the boss's moves), and on level 5 Mother Snapper's health bar. The
// shell keeps Mute / Pause and the Score chip; its clock chip is off (index.tsx clockChip: false).
// Local multiplayer (menu2/multiplayer): a "2-4 players" button on the shared hero picker (desktop and
// tablet), the join screen, per-player chips and the podium. The shared Menu 2 hero picker
// (menu2/heroes) shows on the start card, the pause menu and the result; the orbit camera's recenter
// button and first-time hint come from menu2/camera's OrbitHud.
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
import { HINT, STAT, courseFor } from "./rules";
import type { DiscLevel } from "./levels";
import { COMBO, SNAPPER } from "./progression";
import { COLORS } from "./look";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   const tenths = Math.floor((ms % 1000) / 100);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${tenths}`;
}

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];
const COLOUR_NAME = ["green", "gold", "jade"];

const HINT_TEXT: Record<number, string> = {
   [HINT.aim]: "Hold Throw, turn the camera to aim, push sideways to hook, let go",
   [HINT.catch]: "Stand on the gold ring to catch it",
   [HINT.raft]: "The raft drifts: walk back onto the gold ring to catch",
   [HINT.fetch]: "Dropped! Fetching the disc…",
   [HINT.mouth]: "Throw into her open mouth",
   [HINT.pods]: "Bank the disc into a glowing seed pod",
   [HINT.crown]: "Two banks off the columns, then into her crown",
   [HINT.volley]: "Thorn volley! Step out of the red lane",
};

/** The shared Menu 2 hero picker: on the start card, the result screen and the pause menu. */
function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? SNAPPER.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const seen = useArcadeStore((s) => s.stats[STAT.bossHp] !== undefined);
   if (!seen) return null;
   return (
      <div className={styles.boss}>
         <BossHealthBar name={SNAPPER.name} phaseName={SNAPPER.phases[phase]?.name} hp={hp} maxHp={SNAPPER.maxHp} marks={phaseMarks(SNAPPER)} vulnerable={open} flash={flash} accent="#4ade80" />
      </div>
   );
}

/** While Throw is held: the hook the stick sets, left to right. */
function HookMeter() {
   const aiming = useArcadeStore((s) => (s.stats[STAT.aiming] ?? 0) === 1);
   const hook = useArcadeStore((s) => s.stats[STAT.hook] ?? 0);
   if (!aiming) return null;
   const k = Math.max(-1, Math.min(1, hook / 10));
   return (
      <div className={`${styles.pill} ${styles.wide}`} aria-label={k === 0 ? "Straight throw" : `Hook ${k < 0 ? "left" : "right"}`}>
         <span className={styles.value} style={{ fontSize: "0.85rem", minWidth: 36 }}>
            {k < -0.05 ? "◀ Hook" : k > 0.05 ? "Hook ▶" : "Straight"}
         </span>
         <span className={styles.depth}>
            <span className={styles.depthFill} style={{ width: "8%", marginLeft: `${(k + 1) * 46}%`, background: "#fde68a" }} />
         </span>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<DiscLevel>();
   const level = config?.id ?? 1;
   const required = useArcadeStore((s) => s.stats[STAT.required] ?? 0);
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const cleans = useArcadeStore((s) => s.stats[STAT.cleans] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const colour = useArcadeStore((s) => s.stats[STAT.colour] ?? 0);
   const hint = useArcadeStore((s) => (s.phase === "playing" ? s.stats[STAT.hint] ?? 0 : 0));
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined || heroStat < 0 ? pick : HERO_STAT[heroStat] ?? "kiro");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const course = courseFor(level);
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={styles.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            {course.boss ? null : (
               <div className={styles.pill} aria-label={`Targets ${required} of ${course.required}`}>
                  <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                     <circle cx="12" cy="12" r="9" fill="none" stroke="#e9c46a" strokeWidth="2.6" />
                     <circle cx="12" cy="12" r="4.5" fill="none" stroke="#e9c46a" strokeWidth="2.4" />
                     <circle cx="12" cy="12" r="1.6" fill="#fde68a" />
                  </svg>
                  <span className={styles.value}>
                     {required}/{course.required}
                  </span>
               </div>
            )}
            <div className={styles.pill} aria-label={`Orbs ${orbs} of ${course.orbCount}`}>
               <span className={styles.orb} aria-hidden="true" style={{ background: "radial-gradient(circle at 35% 30%, #eafff1 0, #6ee7a8 35%, #22a15a 70%, #0f5f33 100%)" }} />
               <span className={styles.value}>
                  {orbs}/{course.orbCount}
               </span>
            </div>
            <div className={styles.pill} aria-label={`${cleans} clean catches`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <ellipse cx="12" cy="13" rx="9" ry="4" fill="#2e9a7a" stroke="#c49a50" strokeWidth="1.8" />
                  <path d="M6 7 Q12 2 18 7" stroke="#86efac" strokeWidth="2.2" fill="none" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{cleans}</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            {colour > 0 ? (
               <div className={`${styles.pill} ${styles.wide}`} aria-label={`Next colour ${COLOUR_NAME[colour - 1]}: double points`}>
                  <span className={styles.swatch} style={{ background: COLORS.idol[colour - 1] }} aria-hidden="true" />
                  <span className={styles.value} style={{ fontSize: "0.95rem" }}>
                     ×2 {COLOUR_NAME[colour - 1]}
                  </span>
               </div>
            ) : null}
            <HookMeter />
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={styles.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Disc Target Throw</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Static Targets"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(tenths * 100)}</span>
            </div>
            {config?.boss && !playing ? (
               <div className={styles.bossCenter}>
                  <Boss />
               </div>
            ) : null}
            {hint > 0 && !playing ? (
               <div className={styles.hint} role="status">
                  {HINT_TEXT[hint]}
               </div>
            ) : null}
         </div>
         {config?.boss && !playing ? (
            <div className={styles.bossDock} data-arcade-safe-area="">
               <Boss />
            </div>
         ) : null}
      </>
   );
}
