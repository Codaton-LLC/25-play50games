"use client";

// The game HUD (menu2/hud HudStack placement, the Menu 2 HUD look): the beacon's hit points, the score,
// blocks and the hero power with the combo (x1-x5) on the left; the title and level in a banner with the
// wave counter, the colour of the zone the hero stands on, level 1's coach line, and on level 5 the Orb
// Mortar's bar with its hint. The shell keeps Mute / Pause; its clock chip is off. Local multiplayer: the
// "2-4 players" button, the join screen, per-player chips and the podium. The hero picker and the orbit
// camera's recenter button / hint are the shared ones.
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
import { STAT } from "./rules";
import { PALETTE } from "./arena";
import { LEVELS, type DefenseLevel } from "./levels";
import { COMBO, CORE_HP, MORTAR } from "./progression";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import styles from "./Hud.module.css";

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];

export function coachLine(level: number, blocks: number, wave: number): string | null {
   if (level !== 1 || wave > 1) return null;
   if (blocks === 0) return "Run to the zone of the orb's colour on its lane";
   if (blocks < 4) return "The outer zone scores more: block early!";
   return null;
}

export function bossHint(phase: number, open: boolean): string {
   if (phase === 0) return open ? "Block his golden orb in its colour!" : "He is loading a core orb";
   if (phase === 1) return open ? "Two core orbs: block either one!" : "He lobs two at once now";
   return open ? "The core orb blinks: match it as it arrives!" : "The drone is faster: jump it";
}

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? MORTAR.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   const wave = useArcadeStore((s) => s.stats[STAT.wave] ?? 0);
   if (wave < LEVELS[5].waves - 3) return null;
   return (
      <div className={stack.boss}>
         <BossHealthBar name={MORTAR.name} phaseName={MORTAR.phases[phase]?.name} hp={hp} maxHp={MORTAR.maxHp} marks={phaseMarks(MORTAR)} vulnerable={open} flash={flash} accent="#facc15" />
         <div className={stack.hint}>{hp > 0 ? bossHint(phase, open) : "The Mortar falls!"}</div>
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<DefenseLevel>();
   const level = config?.id ?? 1;
   const score = useArcadeStore((s) => s.score);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const powerLeft = useArcadeStore((s) => s.stats[STAT.power] ?? 0);
   const coreHp = useArcadeStore((s) => s.stats[STAT.coreHp] ?? CORE_HP);
   const blocks = useArcadeStore((s) => s.stats[STAT.blocks] ?? 0);
   const wave = useArcadeStore((s) => s.stats[STAT.wave] ?? 0);
   const zone = useArcadeStore((s) => s.stats[STAT.zoneColor] ?? -1);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => (s.stats[STAT.comboMult] ?? 100) / 100);
   const flow = useArcadeStore((s) => (s.stats[STAT.comboFlow] ?? 0) / 10);
   const playingPhase = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : HERO_STAT[heroStat] ?? "riko");
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const waves = config?.waves ?? LEVELS[1].waves;
   const coach = playingPhase ? coachLine(level, blocks, wave) : null;
   const zc = zone >= 0 ? PALETTE[zone] : null;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Beacon ${coreHp} of ${CORE_HP}`}>
               <span className={styles.beacon} aria-hidden="true" />
               <span className={styles.meter}>
                  <span className={`${styles.meterFill} ${coreHp <= 3 ? styles.meterLow : ""}`} style={{ width: `${(coreHp / CORE_HP) * 100}%` }} />
               </span>
            </div>
            <div className={styles.pill} aria-label={`${score} points`}>
               <span className={styles.points}>{score.toLocaleString("en-US")}</span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name} ${hero.powerLabel}${powerLeft > 0 ? `, ready in ${powerLeft} seconds` : ", ready"}`}>
               <span className={styles.heroDot} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{powerLeft > 0 ? `${powerLeft}s` : hero.powerLabel}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult} flow={flow} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Color Orb Defense</span>
               <span className={styles.level}>
                  Level {level} — {config?.name ?? "Two Colors"}
               </span>
            </div>
            <div className={styles.row}>
               <div className={styles.clock} aria-label={`Wave ${Math.min(waves, wave + 1)} of ${waves}`}>
                  <span className={styles.value}>
                     Wave {Math.min(waves, wave + 1)}/{waves}
                  </span>
               </div>
               <div className={styles.clock} aria-label={zc ? `On a ${zc.name} zone` : "Off the zones"}>
                  <span className={styles.zoneDot} style={{ background: zc ? zc.hex : "transparent" }} aria-hidden="true" />
                  <span className={styles.value}>{zc ? zc.name : "—"}</span>
               </div>
            </div>
            {config?.boss && !playing ? <Boss /> : null}
            {coach ? (
               <div className={stack.boss}>
                  <div className={`${stack.hint} ${styles.coach}`}>{coach}</div>
               </div>
            ) : null}
         </div>
      </>
   );
}
