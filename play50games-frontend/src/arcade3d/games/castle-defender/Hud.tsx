"use client";

import { useShallow } from "zustand/react/shallow";
import { useSafeArea } from "@/arcade3d/core/safeArea";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";
import { placeCards, type CardPlacement } from "./layout";
import { useCastleLevel } from "./useCastleLevel";
import { comboMultiplier } from "./rules";

const CARDS = [
   { icon: "↻", title: "Quick reload", effect: "Reload ×0.85" },
   { icon: "◎", title: "Wide splash", effect: "Radius ×1.25" },
   { icon: "+", title: "Repair gate", effect: "+25 HP / max125" },
   { icon: "●●", title: "Double shot", effect: "2 balls / reload" },
];
const samePlacement = (a: CardPlacement, b: CardPlacement) =>
   a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height && a.column === b.column;
export default function Hud() {
   const { config } = useCastleLevel();
   const stats = useArcadeStore(useShallow(({ stats: s }) => ({
      hp: s.hp ?? 100, maxHP: s.maxHP ?? 100, wave: s.wave ?? 1,
      reload: s.reload ?? 0, rock: s.rock ?? 0, climb: s.climb ?? 0,
      combo: s.combo ?? 0, comboLost: s.comboLost ?? 0,
      banner: s.banner, offer: s.offer, card1: s.card1 ?? 0, card2: s.card2 ?? 1, chosen: s.chosen ?? 0,
   })));
   const phase = useArcadeStore((s) => s.phase);
   const place = useSafeArea(placeCards, samePlacement);
   const ending = useArcadeStore((s) => (s.phase === "over" ? s.endReason : null));
   const choose = (value: number) => {
      const s = useArcadeStore.getState();
      if (s.phase === "playing" && s.stats.offer === 1 && !(s.stats.pick > 0)) s.setStat("pick", value);
   };
   return <>
      <div className={styles.panel} data-arcade-safe-area>
         <strong>Gate {stats.hp ?? 100}/{stats.maxHP ?? 100}</strong><strong>Wave {stats.wave ?? 1}/{config.counts.length}</strong>
         {comboMultiplier(stats.combo) > 1 && <strong className={styles.combo}>Combo x{comboMultiplier(stats.combo)}</strong>}
         {stats.comboLost === 1 && <span role="status">Combo lost</span>}
         <span>Reload {((stats.reload ?? 0) / 10).toFixed(1)}s</span><span>Rock {((stats.rock ?? 0) / 10).toFixed(1)}s</span>
         <span className={styles.hint}>Hit shields from behind</span>
         <span>Ladder {stats.climb ?? 0}%</span>
      </div>
      {phase === "playing" && stats.banner === 1 && <div className={styles.wave}>Wave {stats.wave ?? 1}</div>}
      {ending === "win" && <div className={styles.victory} role="status">Gate held!</div>}
      {phase === "playing" && stats.offer === 1 && <div className={styles.offers} style={{ left: place.left, top: place.top, flexDirection: place.column ? "column" : "row" }} aria-label="Choose one upgrade">
         {[0, 1].map((slot) => {
            const card = CARDS[stats[slot ? "card2" : "card1"] ?? slot], selected = stats.chosen === slot + 1;
            return <button key={slot} type="button" className={`${styles.card} ${selected ? styles.selected : ""}`} style={{ width: place.width, height: place.height }} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); choose(slot + 1); }} aria-pressed={selected} disabled={(stats.chosen ?? 0) > 0}>
               <strong>{card.icon} {card.title}</strong><small>{card.effect}</small><span>{slot + 1} · {selected ? "Selected" : "Choose"}</span>
            </button>;
         })}
      </div>}
   </>;
}
