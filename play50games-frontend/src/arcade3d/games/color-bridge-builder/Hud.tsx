"use client";

// The HUD (menu2/hud HudStack placement): on the left the active hero (and the colour it walks), the
// light under you and ahead of you, the orbs, the power and the flow meter, and the mix table (red +
// blue = purple ...); at the top centre the banner, the run clock with the star target, the Bridge
// Keeper's bar with the colour its plate wants (and what the plate gets) on L5, and the one-line coach.
// The shared hero picker (the hero you start as) shows on the start card, pause and result.
import { useEffect, useSyncExternalStore } from "react";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useLevel } from "../../core/level";
import HeroPicker from "../../menu2/heroes/HeroPicker";
import OrbitHud from "../../menu2/camera/OrbitHud";
import ComboMeter from "../../menu2/combo/ComboMeter";
import BossHealthBar from "../../menu2/boss/BossHealthBar";
import { phaseMarks } from "../../menu2/boss/boss";
import { M2_HERO_IDS } from "../../menu2/heroModels";
import { usePlayers, playersStore } from "../../menu2/multiplayer/players";
import stack from "../../menu2/hud/HudStack.module.css";
import { HEROES, pickedHero, subscribeHero, selectHero } from "./heroes";
import { LEVELS, type BridgeLevel } from "./levels";
import { KEEPER } from "./progression";
import { HERO_MASK, MASK_NAME, STAT, orbTotal } from "./rules";
import { COACH } from "./coach";
import { MASK_COLOR } from "./look";
import { MultiplayerButton, MultiplayerHud } from "./MultiplayerHud";
import styles from "./Hud.module.css";

function clockText(ms: number): string {
   const s = Math.floor(ms / 1000);
   return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
}

const Dot = ({ mask }: { mask: number }) => <span className={styles.dot} style={{ background: MASK_COLOR[mask] }} aria-hidden="true" />;

function Boss() {
   const stats = useArcadeStore((s) => s.stats);
   if (!stats[STAT.boss]) return null;
   const wants = stats[STAT.bossWants] ?? 1;
   const plate = stats[STAT.plate] ?? 0;
   return (
      <div className={stack.boss}>
         <BossHealthBar
            name={KEEPER.name}
            phaseName={KEEPER.phases[stats[STAT.bossPhase] ?? 0]?.name}
            hp={stats[STAT.bossHp] ?? KEEPER.maxHp}
            maxHp={KEEPER.maxHp}
            marks={phaseMarks(KEEPER)}
            vulnerable={stats[STAT.bossOpen] === 1}
            flash={stats[STAT.bossFlash] === 1}
            accent="#e2e8f0"
         />
         <span className={styles.colorChip}>
            Plate wants <Dot mask={wants} /> {MASK_NAME[wants]} · gets <Dot mask={plate} /> <span className={plate === wants ? styles.ok : styles.warn}>{MASK_NAME[plate]}</span>
         </span>
      </div>
   );
}

export default function Hud() {
   const hero = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const multi = usePlayers((s) => s.phase !== "off");
   const playing = usePlayers((s) => s.phase === "playing");
   const stats = useArcadeStore((s) => s.stats);
   // tenths are all the clock shows: one render per 100 ms, not per frame
   const elapsed = useArcadeStore((s) => Math.floor(s.elapsedMs / 100) * 100);
   const phase = useArcadeStore((s) => s.phase);
   const { config } = useLevel<BridgeLevel>();
   const c = config ?? LEVELS[1];
   useEffect(() => () => playersStore.getState().endSession(), []);
   const live = phase === "playing" || phase === "countdown" || phase === "paused" || phase === "over";
   const activeId = live ? M2_HERO_IDS[stats[STAT.hero] ?? M2_HERO_IDS.indexOf(hero)] ?? hero : hero;
   const info = HEROES.find((h) => h.id === activeId) ?? HEROES[0];
   const total = orbTotal(c.id);
   const shownMs = stats[STAT.finishMs] ? stats[STAT.finishMs] : elapsed;
   const under = stats[STAT.under] ?? 0;
   const ahead = stats[STAT.ahead] ?? 0;
   const coach = COACH[stats[STAT.coach] ?? 0] ?? "";
   return (
      <>
         <HeroPicker heroes={HEROES} value={hero} onPick={selectHero} hidden={multi} extra={phase === "ready" ? <MultiplayerButton /> : null} />
         <OrbitHud />
         {multi && <MultiplayerHud />}
         {live && !playing && (
            <>
               <div className={stack.left} data-arcade-safe-area="">
                  <div className={styles.pill} aria-label={`Active hero ${info.name}, walks ${MASK_NAME[HERO_MASK[info.id]]}`}>
                     <span className={styles.swatch} style={{ background: info.color }} aria-hidden="true" />
                     <span className={styles.power}>
                        {info.name} · {MASK_NAME[HERO_MASK[info.id]]}
                     </span>
                  </div>
                  <span className={styles.colorChip}>
                     <Dot mask={under} /> here {MASK_NAME[under] === "dark" ? "rock" : MASK_NAME[under]} · <Dot mask={ahead} /> ahead {MASK_NAME[ahead] === "dark" ? "-" : MASK_NAME[ahead]}
                  </span>
                  <div className={styles.pill} aria-label={`Orbs ${stats[STAT.orbs] ?? 0} of ${total}`}>
                     <span className={styles.orb} aria-hidden="true" />
                     <span className={styles.value}>
                        {stats[STAT.orbs] ?? 0}
                        <small>/{total}</small>
                     </span>
                  </div>
                  <div className={styles.pill} aria-label={`Power: ${info.powerLabel}`}>
                     <span className={styles.power}>{stats[STAT.power] ? `${stats[STAT.power]}s` : info.powerLabel.split(" · ")[0]}</span>
                  </div>
                  <ComboMeter chain={stats[STAT.comboChain] ?? 0} multiplier={(stats[STAT.comboMult] ?? 100) / 100} flow={(stats[STAT.comboFlow] ?? 0) / 10} cap={2} />
                  <div className={styles.mix} aria-label="Mixing: red and blue make purple, blue and yellow green, red and yellow orange, all three white">
                     {[
                        [1, 2, 3],
                        [2, 4, 6],
                        [1, 4, 5],
                     ].map(([a, b, m]) => (
                        <span key={m} className={styles.mixRow}>
                           <Dot mask={a} /> + <Dot mask={b} /> = <Dot mask={m} />
                        </span>
                     ))}
                     <span className={styles.mixRow}>
                        all three = <Dot mask={7} />
                     </span>
                  </div>
               </div>
               <div className={stack.center} data-arcade-safe-area="">
                  <div className={styles.banner}>
                     <span className={styles.title}>Color Bridge Builder</span>
                     <span className={styles.level}>
                        Level {c.id} · {c.name}
                     </span>
                  </div>
                  <div className={styles.clock} role="timer" aria-label="Run time">
                     <span className={styles.value}>{clockText(shownMs)}</span>
                     <span className={styles.target}>★ {c.targetMs / 1000}s</span>
                  </div>
                  <Boss />
                  {phase === "playing" && coach && <div className={`${stack.hint} ${styles.coach}`}>{coach}</div>}
               </div>
            </>
         )}
      </>
   );
}
