"use client";

// The open tickets as rows of ingredient icons (shape + colour, the next step outlined) and each oven's
// bake ring (core TimingRing: the zone is the golden window; rules.bakeGrade grades the take-out).
import type { CSSProperties } from "react";
import { TimingRing } from "@/arcade3d/core/hud/TimingRing";
import { useKitchenHud } from "./hudStore";
import { COLORS } from "./looks";
import { bakeGrade, bakeZones, type Ingredient } from "./rules";
import styles from "./Kitchen.module.css";

const ICON: Record<Ingredient, CSSProperties> = {
   sauce: { background: COLORS.sauce, borderRadius: "50%" },
   cheese: { background: COLORS.cheese, borderRadius: 3 },
   pepperoni: { background: COLORS.pepperoni, borderRadius: "50%", borderColor: "#fecaca" },
   mushroom: { background: COLORS.mushroom, borderRadius: "8px 8px 2px 2px" },
   olive: { background: "transparent", borderRadius: "50%", borderColor: COLORS.olive, borderWidth: 4 },
   tomato: { background: COLORS.tomato, borderRadius: "50%", borderColor: "#fde68a" },
   onion: { background: "transparent", borderRadius: "50%", borderColor: COLORS.onion, borderWidth: 3 },
};

export default function Hud() {
   const r = useKitchenHud((s) => s.run);
   useKitchenHud((s) => s.revision);
   if (!r) return null;
   return (
      <aside className={styles.hud} data-arcade-safe-area aria-label="Kitchen tickets">
         <div className={styles.tickets}>
            {r.tickets.map((t) => {
               if (t.state !== "open") return null;
               const pizza = r.prep?.ticket === t.id ? r.prep : r.carried?.ticket === t.id ? r.carried : r.ovens.find((o) => o?.pizza.ticket === t.id)?.pizza;
               const added = pizza ? pizza.added : -1;
               const inOven = r.ovens.some((o) => o?.pizza.ticket === t.id);
               const carried = r.carried?.ticket === t.id;
               const last = carried ? (r.level.boxStep && !r.carried!.boxed ? "Box" : "Hatch") : inOven ? "Baking" : "Oven";
               return (
                  <div className={styles.ticket} key={t.id}>
                     <span className={styles.num}>#{t.id + 1}</span>
                     <span className={`${styles.word} ${added < 0 ? styles.next : ""}`}>Dough</span>
                     {t.ingredients.map((ing, i) => (
                        <span key={i} title={ing} aria-label={ing} className={`${styles.step} ${added > i ? styles.done : ""} ${added === i ? styles.next : ""}`}>
                           <span className={styles.icon} style={ICON[ing]} />
                        </span>
                     ))}
                     <span className={`${styles.word} ${added === t.ingredients.length || carried || inOven ? styles.next : ""}`}>{last}</span>
                     {r.level.patienceS > 0 && <progress aria-label={`Ticket ${t.id + 1} patience`} max={r.level.patienceS} value={Math.max(0, r.level.patienceS - (r.time - t.openedAt))} />}
                  </div>
               );
            })}
         </div>
         <div className={styles.ovens}>
            {r.ovens.map((o, i) => (
               <div key={i}>
                  <TimingRing size={44} perfectShare={0} value={o ? Math.min(0.9999, (r.time - o.startedAt) / (r.level.bakeS + r.level.goldenS)) : 0} zones={bakeZones(r.level)} label={`${i + 1}`} />
                  <small>{o ? bakeGrade(r.time - o.startedAt, r.level) : "empty"}</small>
               </div>
            ))}
            <p role="status">{r.message}</p>
         </div>
      </aside>
   );
}
