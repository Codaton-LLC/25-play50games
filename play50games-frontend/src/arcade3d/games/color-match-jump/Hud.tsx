"use client";

// The HUD: hearts, codes, orbs and flow on the left; the level, the clock, the beacon's code chips, the
// boss bar and a hint at the top; the tag strip of five hero portraits (tap or keys 1-5, T cycles).
import { useSyncExternalStore } from "react";
import { useArcadeStore } from "../../core/useArcadeStore";
import { useLevel } from "../../core/level";
import HeroPicker from "../../menu2/heroes/HeroPicker";
import OrbitHud from "../../menu2/camera/OrbitHud";
import ComboMeter from "../../menu2/combo/ComboMeter";
import BossHealthBar from "../../menu2/boss/BossHealthBar";
import { phaseMarks } from "../../menu2/boss/boss";
import { HEROES, pickedHero, selectHero, subscribeHero } from "./heroes";
import { HINT, STAT } from "./rules";
import { LEVELS, type CmjLevel } from "./levels";
import { COMBO, FROST_GOLEM, STORM } from "./progression";
import { COLOR_NAMES, GLYPH_TEXT, HEX_COLORS } from "./look";
import { requestTag } from "../../menu2/heroTag/tagInput";
import { TAG_ORDER } from "../../menu2/heroTag/rules";
import stack from "../../menu2/hud/HudStack.module.css";
import styles from "./Hud.module.css";

const HINTS: Record<number, string> = {
   [HINT.match]: "Land on your own colour. Red is Riko: hop the red hexes",
   [HINT.tag]: "Blue ahead? Tag Nyla (2) in the air before you land",
   [HINT.code]: "Land the beacon's colours in order to crack its code",
   [HINT.crown]: "Codes cracked: the crown is open. Reach it!",
   [HINT.sink]: "The rear rows are sinking: keep moving",
   [HINT.hues]: "Hexes change colour every 4 s: watch them fade",
   [HINT.glassy]: "Pale glassy hexes skid: a short wait before the next jump",
   [HINT.cores]: "Crack the code; land its last colour on the glowing core behind the golem",
   [HINT.stomp]: "Stomp hex, jump at the golem, double-jump as Nyla, tag the plate colour",
   [HINT.storm]: "Prism storm: take 5 shards on matching hexes and hold out 20 s",
   [HINT.fell]: "Fell! A heart is lost",
};

function decode(value: number, len: number): number[] {
   const out: number[] = [];
   let v = value;
   for (let i = 0; i < len; i++) {
      out.push((v % 8) - 1);
      v = Math.floor(v / 8);
   }
   return out;
}

function TagStrip() {
   const stats = useArcadeStore((s) => s.stats);
   const active = stats[STAT.active] ?? 0;
   const cooling = (stats[STAT.tagReady] ?? 0) > 0;
   const cds = [stats[STAT.cd0], stats[STAT.cd1], stats[STAT.cd2], stats[STAT.cd3], stats[STAT.cd4]];
   return (
      <div className={`${styles.strip} ${cooling ? styles.cooling : ""}`} data-arcade-safe-area="" role="group" aria-label="Tag a hero">
         {HEROES.map((h, i) => (
            <button
               key={h.id}
               type="button"
               tabIndex={-1}
               className={`${styles.portrait} ${i === active ? styles.active : ""}`}
               style={{ ["--hero" as string]: h.color }}
               aria-label={`Tag ${h.name} (${COLOR_NAMES[i]}), key ${i + 1}`}
               aria-pressed={i === active}
               onPointerDown={(e) => {
                  e.preventDefault();
                  requestTag(TAG_ORDER[i]);
               }}
            >
               <span className={styles.glyph}>{GLYPH_TEXT[i]}</span>
               <span className={styles.name}>{h.name}</span>
               <span className={styles.key}>{(cds[i] ?? 0) > 0 ? `${cds[i]}s` : i + 1}</span>
            </button>
         ))}
      </div>
   );
}

export default function Hud() {
   const { config } = useLevel<CmjLevel>();
   const level = config?.id ?? 1;
   const l = LEVELS[level];
   const stats = useArcadeStore((s) => s.stats);
   const phase = useArcadeStore((s) => s.phase);
   const ms = useArcadeStore((s) => Math.floor((s.stats[STAT.finishMs] || s.elapsedMs) / 100) * 100);
   const pick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const shown = phase === "countdown" || phase === "playing" || phase === "over";
   const hearts = stats[STAT.hearts] ?? 3;
   const bossPhase = stats[STAT.bossPhase] ?? 0;
   const codesOn = l.boss ? bossPhase === 0 : (stats[STAT.codes] ?? 0) < l.codes;
   const code = decode(stats[STAT.code] ?? 0, stats[STAT.codeLen] ?? l.codeLen);
   const step = stats[STAT.codeStep] ?? 0;
   const hint = HINTS[stats[STAT.hint] ?? 0];
   const plate = stats[STAT.plate] ?? 1;
   return (
      <>
         <HeroPicker heroes={HEROES} value={pick} onPick={selectHero} />
         <OrbitHud />
         {shown && (
            <>
               <div className={stack.left} data-arcade-safe-area="">
                  <div className={styles.pill}>
                     <span>HEARTS</span>
                     <strong className={styles.hearts}>
                        {"♥".repeat(Math.max(0, hearts))}
                        <em>{"♥".repeat(Math.max(0, 3 - hearts))}</em>
                     </strong>
                  </div>
                  {!l.boss && (
                     <div className={styles.pill}>
                        <span>CODES</span>
                        <strong>
                           {stats[STAT.codes] ?? 0} / {l.codes}
                        </strong>
                     </div>
                  )}
                  <div className={styles.pill}>
                     <span>ORBS</span>
                     <strong>{stats[STAT.orbs] ?? 0}</strong>
                  </div>
                  <ComboMeter chain={stats[STAT.chain] ?? 0} multiplier={(stats[STAT.multiplier] ?? 100) / 100} flow={(stats[STAT.flow] ?? 0) / 100} cap={COMBO.cap} accent={HEX_COLORS[stats[STAT.active] ?? 0]} />
               </div>
               <div className={stack.center} data-arcade-safe-area="">
                  <div className={styles.banner}>
                     <span>COLOR MATCH JUMP</span>
                     <strong>{l.name}</strong>
                  </div>
                  <div className={styles.clock}>
                     {(ms / 1000).toFixed(1)} <small>/ {l.targetMs / 1000} s</small>
                  </div>
                  {codesOn && (
                     <div className={styles.code} aria-label="Beacon code">
                        {code.map((c, i) => (
                           <span key={i} className={`${styles.chip} ${i < step ? styles.done : i === step ? styles.now : ""}`} style={{ background: HEX_COLORS[c] ?? "#64748b" }} title={COLOR_NAMES[c]}>
                              {i < step ? "✓" : GLYPH_TEXT[c]}
                           </span>
                        ))}
                     </div>
                  )}
                  {l.boss && (
                     <div className={stack.boss}>
                        <BossHealthBar
                           name={FROST_GOLEM.name}
                           phaseName={FROST_GOLEM.phases[bossPhase]?.name ?? ""}
                           hp={stats[STAT.bossHp] ?? FROST_GOLEM.maxHp}
                           maxHp={FROST_GOLEM.maxHp}
                           marks={phaseMarks(FROST_GOLEM)}
                           vulnerable={stats[STAT.bossOpen] === 1}
                           flash={stats[STAT.bossFlash] === 1}
                           accent="#f472b6"
                        />
                        {bossPhase === 1 && (
                           <div className={`${stack.hint} ${styles.teach}`}>
                              Plate:{" "}
                              <b style={{ color: HEX_COLORS[plate] }}>
                                 {GLYPH_TEXT[plate]} {COLOR_NAMES[plate]}
                              </b>
                           </div>
                        )}
                        {bossPhase === 2 && (
                           <div className={`${stack.hint} ${styles.teach}`}>
                              Shards {Math.min(STORM.shards, stats[STAT.shards] ?? 0)} / {STORM.shards} · {stats[STAT.storm] ?? 0} / {STORM.surviveMs / 1000} s
                           </div>
                        )}
                     </div>
                  )}
                  {hint && <div className={`${stack.hint} ${styles.teach}`}>{hint}</div>}
               </div>
               {phase !== "over" && <TagStrip />}
            </>
         )}
      </>
   );
}
