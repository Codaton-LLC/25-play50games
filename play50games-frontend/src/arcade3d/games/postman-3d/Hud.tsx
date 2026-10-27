"use client";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ADDRESS_COLORS } from "./rules";
import { HOUSE_COLORS } from "./looks";
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import styles from "./Hud.module.css";

export default function Hud() {
   const stats = useArcadeStore((s) => s.stats);
   return <><CameraViewButton /><aside className={styles.route} data-arcade-safe-area aria-label="Delivery list">
      <div className={styles.heading}>TODAY’S ROUTE <span>{stats.refill ? "Return to POST" : "Number + colour"}</span></div>
      <div className={styles.items}>
         {[0, 1, 2].map((slot) => {
            const number = stats[`next${slot}`];
            const color = stats[`color${slot}`] ?? 0;
            return number ? <div className={styles.item} key={slot}>
               <span className={styles.swatch} style={{ background: HOUSE_COLORS[color] }} />
               <strong>{number}</strong><span className={styles.colorName}>{ADDRESS_COLORS[color]}</span>
               <span aria-label={stats[`parcel${slot}`] ? "Parcel: front door" : "Letter: mailbox"}>{stats[`parcel${slot}`] ? "Door" : "Box"}</span>
            </div> : <div className={styles.item} key={slot}>—</div>;
         })}
      </div>
      <div className={styles.hint}>{stats.message === 1 ? "Wrong address or item type — check the list" : stats.message === 2 ? "Mailbag refilled" : "Letters → mailbox · Parcels → front door"}</div>
   </aside></>;
}
