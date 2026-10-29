"use client";

// The game HUD: orbs, hearts, the room, the hero power and the flow meter on the left; the title, the
// level and the run clock in a banner at the top centre, under it the storm's distance, a prompt next
// to a fan ("tap: turn, hold: switch"), the ghost hint after 20 s, and on level 5 the Gale Engine's
// health bar and the escape countdown. The shell keeps Mute / Pause; its clock chip is off. Local
// multiplayer: the "2-4 players" button on the shared hero picker (desktop and tablet), the join screen,
// per-player chips and the podium. The shared Menu 2 hero picker shows on the start card, the pause
// menu and the result; the orbit camera's recenter button and first-time hint come from OrbitHud.
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
import { HEARTS, STAT, courseFor, runTimeMs } from "./rules";
import type { WindLevel } from "./levels";
import { COMBO, GALE_ENGINE } from "./progression";
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

const PHASES = [...GALE_ENGINE.phases.map((p) => p.name), "Escape"];

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? GALE_ENGINE.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const escape = useArcadeStore((s) => s.stats[STAT.escape] ?? -1);
   const started = useArcadeStore((s) => s.stats[STAT.bossHp] !== undefined);
   if (!started) return null;
   if (escape >= 0) {
      return (
         <div className={stack.boss}>
            <div className={styles.escape} role="status">
               Escape! <span className={styles.value}>{escape} s</span>
            </div>
         </div>
      );
   }
   return (
      <div className={stack.boss}>
         <BossHealthBar name={GALE_ENGINE.name} phaseName={PHASES[phase]} hp={hp} maxHp={GALE_ENGINE.maxHp} marks={phaseMarks(GALE_ENGINE)} vulnerable={open} flash={flash} accent="#facc15" />
         {hp > 0 ? <div className={stack.hint}>{phase === 0 ? "Turn the three side fans onto its intake" : "Lift each crate on its vent, then fan it into the core"}</div> : null}
      </div>
   );
}

/** Next to a fan: what Action does there (tap turns, hold switches; vents switch on a tap). */
function FanPrompt() {
   const near = useArcadeStore((s) => s.stats[STAT.near] ?? -1);
   const { config } = useLevel<WindLevel>();
   const playing = useArcadeStore((s) => s.phase === "playing");
   if (!playing || near < 0) return null;
   const f = courseFor(config?.id ?? 1).fans[near];
   if (!f) return null;
   const text = f.kind === "vent" ? "E / Fan: switch the vent" : f.toggle ? "E / Fan: tap to turn · hold to switch" : "E / Fan: turn";
   return (
      <div className={styles.prompt} role="status">
         {text}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<WindLevel>();
   const level = config?.id ?? 1;
   const orbs = useArcadeStore((s) => s.stats[STAT.orbs] ?? 0);
   const hearts = useArcadeStore((s) => s.stats[STAT.hearts] ?? HEARTS);
   const room = useArcadeStore((s) => s.stats[STAT.room] ?? 1);
   const rooms = useArcadeStore((s) => s.stats[STAT.rooms] ?? courseFor(level).rooms.length);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const storm = useArcadeStore((s) => s.stats[STAT.storm] ?? -1);
   const hint = useArcadeStore((s) => s.stats[STAT.hint] ?? -1);
   const tenths = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100));
   const comboMs = useArcadeStore((s) => s.stats[STAT.comboMs] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const shown = runTimeMs(tenths * 100, orbs, comboMs);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "nami");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
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
            <div className={styles.pill} aria-label={`Hearts ${hearts} of ${HEARTS}`}>
               {Array.from({ length: HEARTS }, (_, i) => (
                  <svg key={i} className={styles.heart} viewBox="0 0 24 24" aria-hidden="true" style={{ opacity: i < hearts ? 1 : 0.22 }}>
                     <path d="M12 21 C5 15 2 12 2 8 C2 5 4.5 3 7 3 C9 3 11 4.5 12 6 C13 4.5 15 3 17 3 C19.5 3 22 5 22 8 C22 12 19 15 12 21 Z" fill="#f472b6" />
                  </svg>
               ))}
            </div>
            <div className={styles.pill} aria-label={`Room ${room} of ${rooms}`}>
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="#7dd3fc" strokeWidth="2.2" />
                  <path d="M12 12 L12 4 M12 12 L19 15 M12 12 L5 15" stroke="#e0f2fe" strokeWidth="2.2" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>
                  {room}/{rooms}
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
               <span className={styles.title}>Wind Tunnel Escape</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Gentle Wind"}
               </span>
            </div>
            <div className={styles.clock} role="timer" aria-label="Run time">
               <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="13" r="8" fill="none" stroke="#fff" strokeWidth="2.4" />
                  <path d="M12 13 L12 8.5 M9.5 3 H14.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
               </svg>
               <span className={styles.value}>{clockText(shown)}</span>
            </div>
            {!playing && storm >= 0 && storm < 30 ? (
               <div className={storm < 8 ? styles.stormNear : styles.storm} role="status">
                  Storm {storm} m behind
               </div>
            ) : null}
            {!playing && hint >= 0 ? <div className={styles.hintBox}>Stuck? The gold ghost shows the setup.</div> : null}
            {config?.boss && !playing ? <Boss /> : null}
         </div>
         {!playing ? <FanPrompt /> : null}
      </>
   );
}
