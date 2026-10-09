"use client";

import { useSafeArea } from "@/arcade3d/core/safeArea";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

const CARDS = [
   { icon: "↻", title: "Quick reload", effect: "Reload ×0.8" },
   { icon: "◎", title: "Wide splash", effect: "Radius ×1.3" },
   { icon: "+", title: "Repair gate", effect: "+25 HP / max125" },
   { icon: "●●", title: "Double shot", effect: "2 balls / reload" },
];
export default function Hud() {
   const stats = useArcadeStore((s) => s.stats), phase = useArcadeStore((s) => s.phase), area = useSafeArea();
   const short = area.height > 0 && area.height <= 520;
   const width = short ? 360 : 296, height = short ? 72 : 88;
   let bottom = area.height || 844, top = 0, right = area.width || 390;
   for (const r of area.obstructions) bottom = Math.min(bottom, r.top);
   for (const r of area.controls) { bottom = Math.min(bottom, r.top); if (r.left > area.width / 2) right = Math.min(right, r.left - 8); }
   for (const r of area.hud) top = Math.max(top, r.bottom + 8);
   const left = Math.max(8, (right - width) / 2), y = Math.max(top, bottom - height - 12);
   const choose = (value: number) => {
      const s = useArcadeStore.getState();
      if (s.phase === "playing" && s.stats.offer === 1 && !(s.stats.pick > 0)) s.setStat("pick", value);
   };
   return <>
      <div className={styles.panel} data-arcade-safe-area>
         <strong>Gate {stats.hp ?? 100}/{stats.maxHP ?? 100}</strong><strong>Wave {stats.wave ?? 1}/5</strong>
         <span>Reload {((stats.reload ?? 0) / 10).toFixed(1)}s</span><span>Rock {((stats.rock ?? 0) / 10).toFixed(1)}s</span>
         <span className={styles.hint}>Hit shields from behind</span>
         <span>Ladder {stats.climb ?? 0}%</span>
      </div>
      {phase === "playing" && stats.banner === 1 && <div className={styles.wave}>Wave {stats.wave ?? 1}</div>}
      {phase === "playing" && stats.offer === 1 && <div className={styles.offers} style={{ left, top: y }} aria-label="Choose one upgrade">
         {[0, 1].map((slot) => {
            const card = CARDS[stats[slot ? "card2" : "card1"] ?? slot], selected = stats.chosen === slot + 1;
            return <button key={slot} type="button" className={`${styles.card} ${selected ? styles.selected : ""}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); choose(slot + 1); }} aria-pressed={selected} disabled={(stats.chosen ?? 0) > 0}>
               <strong>{card.icon} {card.title}</strong><small>{card.effect}</small><span>{slot + 1} · {selected ? "Selected" : "Choose"}</span>
            </button>;
         })}
      </div>}
   </>;
}
