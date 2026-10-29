"use client";

// The game HUD: the accuracy (against the level's clear target), the echo orbs, the hero's perk (Kiro's
// shield ready or charging), the combo meter on the left; the title, the level, the song's progress and a
// beat light at the top centre, the judgement of the last strike under it, and on level 5 Coilstone's
// health bar with the phase's hint. The shell keeps Mute / Pause and the Score chip; its clock chip is off
// (the song is the clock). Local multiplayer: the "2-4 players" button, the join screen, per-player chips
// and the podium. The shared hero picker on the start card, pause and result; the orbit camera's
// recenter button and first-time hint (OrbitHud).
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
import { STAT } from "./rules";
import type { GongLevel } from "./levels";
import { COILSTONE, COMBO } from "./progression";
import { MultiplayerHud, MultiplayerButton } from "./MultiplayerHud";
import stack from "@/arcade3d/menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

const HERO_STAT: HeroId[] = ["riko", "nami", "kiro", "zuno", "vexa"];
const HINTS = ["Watch the gongs it calls, then strike them back: a Perfect cracks a plate", "Jump its shockwaves; 80 % in a phrase cracks a plate", "Strike the Great Gong on the last beat: Perfect frees it"];
const JUDGE = ["", "PERFECT", "GOOD", "MISS"];

function HeroPick() {
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   return <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multiplayer} extra={startCard ? <MultiplayerButton /> : null} />;
}

function Boss() {
   const hp = useArcadeStore((s) => s.stats[STAT.bossHp] ?? COILSTONE.maxHp);
   const phase = useArcadeStore((s) => s.stats[STAT.bossPhase] ?? 0);
   const open = useArcadeStore((s) => (s.stats[STAT.bossOpen] ?? 0) === 1);
   const flash = useArcadeStore((s) => (s.stats[STAT.bossFlash] ?? 0) === 1);
   return (
      <div className={stack.boss}>
         <BossHealthBar name={COILSTONE.name} phaseName={COILSTONE.phases[phase]?.name} hp={hp} maxHp={COILSTONE.maxHp} marks={phaseMarks(COILSTONE)} vulnerable={open} flash={flash} accent="#34d399" />
         {hp > 0 ? <div className={stack.hint}>{HINTS[phase] ?? ""}</div> : null}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<GongLevel>();
   const accuracy = useArcadeStore((s) => s.stats[STAT.accuracy] ?? 100);
   const echoes = useArcadeStore((s) => s.stats[STAT.echoes] ?? 0);
   const heroStat = useArcadeStore((s) => s.stats[STAT.hero]);
   const shield = useArcadeStore((s) => s.stats[STAT.shield] ?? 0);
   const chain = useArcadeStore((s) => s.stats[STAT.comboChain] ?? 0);
   const mult = useArcadeStore((s) => s.stats[STAT.comboMult] ?? 100);
   const flow = useArcadeStore((s) => s.stats[STAT.comboFlow] ?? 0);
   const song = useArcadeStore((s) => s.stats[STAT.song] ?? 0);
   const judge = useArcadeStore((s) => s.stats.judge ?? 0);
   const beatOn = useArcadeStore((s) => (s.stats.beat ?? 0) > 0);
   const level = config?.id ?? 1;
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const hero = heroById(heroStat === undefined ? pick : (HERO_STAT[heroStat] ?? "kiro"));
   const multiplayer = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   useEffect(() => () => playersStore.getState().endSession(), []);
   const target = Math.round((config?.accuracy ?? 0.7) * 100);
   const perk = hero.id === "kiro" ? (shield > 0 ? `${shield}s` : "Shield") : hero.powerLabel;
   return (
      <>
         <HeroPick />
         {multiplayer && <MultiplayerHud />}
         <OrbitHud />
         <div className={stack.left} data-arcade-safe-area="" style={playing ? { display: "none" } : undefined}>
            <div className={styles.pill} aria-label={`Accuracy ${accuracy} percent${config?.boss ? "" : `, target ${target}`}`}>
               <span className={`${styles.beat} ${beatOn ? styles.beatOn : ""}`} aria-hidden="true" />
               <span className={styles.meter}>
                  <span className={`${styles.meterFill} ${!config?.boss && accuracy < target ? styles.meterHigh : ""}`} style={{ width: `${accuracy}%` }} />
               </span>
               <span className={styles.value}>{accuracy}%</span>
            </div>
            <div className={styles.pill} aria-label={`Echo orbs ${echoes} of ${config?.echoTarget ?? 0}`}>
               <span className={styles.orb} aria-hidden="true" />
               <span className={styles.value}>
                  {echoes}/{config?.echoTarget ?? 0}
               </span>
            </div>
            <div className={styles.pill} aria-label={`${hero.name}: ${hero.powerLabel}${hero.id === "kiro" && shield > 0 ? `, ready in ${shield} seconds` : ""}`}>
               <span className={styles.swatch} style={{ background: hero.color }} aria-hidden="true" />
               <span className={styles.value}>{perk}</span>
            </div>
            <ComboMeter chain={chain} multiplier={mult / 100} flow={flow / 10} cap={COMBO.cap} />
         </div>
         <div className={stack.center} data-arcade-safe-area="">
            <div className={styles.banner}>
               <span className={styles.title}>Temple Gong Timing</span>
               <span className={styles.level}>
                  <span className={styles.levelLong}>
                     Level {level} — {config?.name ?? "Slow Beat"}
                  </span>
                  <span className={styles.levelShort}>{config?.name ?? "Slow Beat"}</span>
               </span>
            </div>
            {!config?.boss ? (
               <div className={styles.clock} role="progressbar" aria-label="Song" aria-valuenow={song} aria-valuemin={0} aria-valuemax={100}>
                  <span className={styles.meter}>
                     <span className={styles.meterFill} style={{ width: `${song}%` }} />
                  </span>
               </div>
            ) : null}
            <div className={`${styles.judge} ${judge === 1 ? styles.perfect : judge === 2 ? styles.good : judge === 3 ? styles.miss : ""}`} aria-live="polite">
               {JUDGE[judge] ?? ""}
            </div>
            {config?.boss && !playing ? <Boss /> : null}
         </div>
      </>
   );
}
