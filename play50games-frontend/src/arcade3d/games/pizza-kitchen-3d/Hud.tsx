"use client";
import { TimingRing } from "@/arcade3d/core/hud/TimingRing";
import { useKitchenHud } from "./hudStore";
import { bakeGrade, bakeZones } from "./rules";
import { COLORS } from "./looks";
import styles from "./Kitchen.module.css";
const ICONS = { sauce: "?", cheese: "?", pepperoni: "?", mushroom: "?", olive: "?", tomato: "?", onion: "?" };
export default function Hud() {
   const { run: r } = useKitchenHud();
   if (!r) return null;
   return <aside className={styles.hud} data-arcade-safe-area aria-label="Kitchen tickets">
      <div className={styles.heading}>KITCHEN / {r.served} SERVED</div>
      <div className={styles.tickets}>{r.tickets.filter(t => t.state === "open").map(t => {
         const pizza = [r.prep, r.carried, ...r.ovens.map(o => o?.pizza)].find(p => p?.ticket === t.id);
         const next = pizza?.added ?? -1;
         return <div className={styles.ticket} key={t.id}>
            <strong>#{t.id + 1}</strong> {next < 0 && <span className={styles.next}>Dough ?</span>}
            {t.ingredients.map((ing, i) => <span key={i} title={ing} aria-label={ing} className={next === i ? styles.next : styles.ingredient} style={{ color: COLORS[ing] }}>{ICONS[ing]}<small>{ing}</small></span>)}
            <span className={next === t.ingredients.length ? styles.next : ""}>{r.carried?.ticket === t.id ? (r.level.boxStep && !r.carried.boxed ? "Box ? hatch" : "Hatch") : r.ovens.some(o => o?.pizza.ticket === t.id) ? "Baking" : "Oven"}</span>
            {r.level.patienceS > 0 && <progress aria-label={`Ticket ${t.id + 1} patience`} max={r.level.patienceS} value={Math.max(0, r.level.patienceS - r.time + t.openedAt!)} />}
         </div>;
      })}</div>
      <div className={styles.ovens}>{r.ovens.map((o, i) => <div key={i}><TimingRing size={54} perfectShare={0} value={o ? Math.min(0.9999, (r.time - o.startedAt) / (r.level.bakeS + r.level.goldenS)) : 0} zones={bakeZones(r.level)} label={`${i + 1}`} /><small>{o ? bakeGrade(r.time - o.startedAt, r.level) : "empty"}</small></div>)}<p role="status">{r.message}</p></div>
   </aside>;
}
