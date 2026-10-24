// The DOM HUD GameShell mounts over the canvas: the two order bubbles (marked data-arcade-safe-area,
// so the camera fit keeps them clear — portrait stacks them under the HUD chips, landscape keeps them
// in a right-hand column over the empty +x region) and the game-local ◀ ▶ wheel buttons, 72 px like
// the shell's touch buttons. The Scene writes hudOrders and consumes hudButtons every frame; this
// layer re-renders at 10 Hz (patience bars read smoothly through CSS transitions).
import { useEffect, useState } from "react";
import { KindIcon, TYPE_TINT } from "./Primitives";
import { PATIENCE, type Order } from "./rules";
import styles from "./Hud.module.css";

/** Presses of the ◀ ▶ buttons since the Scene last read them (cleared there each frame). */
export const hudButtons = { left: 0, right: 0 };

/** Live refs to the two windows' orders, written by the Scene's useRunFrame every frame. */
export const hudOrders: Array<Order | null> = [null, null];

type Mood = "happy" | "ok" | "worried" | "angry" | "served";

function Face({ mood }: { mood: Mood }) {
   const stroke = mood === "angry" ? "#f87171" : "#fde68a";
   const mouth =
      mood === "served" ? "M7 14 Q12 19 17 14" : mood === "happy" ? "M8 13.5 Q12 17 16 13.5" : mood === "ok" ? "M8.5 14 L15.5 14" : "M8 16 Q12 12 16 16";
   return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
         <circle cx="12" cy="12" r="9" fill="rgba(11,16,32,0.6)" stroke={stroke} strokeWidth="1.6" />
         <circle cx="9" cy="10" r="1.3" fill={stroke} />
         <circle cx="15" cy="10" r="1.3" fill={stroke} />
         <path d={mouth} stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
   );
}

function Bubble({ order }: { order: Order }) {
   const frac = Math.max(0, Math.min(1, order.patience / PATIENCE.max));
   const mood: Mood = order.phase === "served" ? "served" : order.phase === "angry" || order.patience <= 0 ? "angry" : frac > 0.6 ? "happy" : frac > 0.3 ? "ok" : "worried";
   const hue = order.phase !== "ordering" ? "#4ade80" : frac > 0.5 ? "#a3e635" : frac > 0.25 ? "#facc15" : "#f87171";
   return (
      <div className={styles.bubble} data-window={order.window} data-type={order.type}>
         <div className={styles.bubbleHead}>
            <span className={styles.typeDot} style={{ background: TYPE_TINT[order.type] }} />
            <Face mood={mood} />
            <span className={styles.status}>
               {order.phase === "served" ? "Served!" : order.phase === "angry" ? "Storming off!" : order.progress >= order.kinds.length ? "…" : ""}
            </span>
         </div>
         <div className={styles.icons}>
            {order.kinds.map((kind, i) => (
               <span key={i} className={i < order.progress ? styles.done : i === order.progress ? styles.next : styles.pending}>
                  <KindIcon kind={kind} size={26} />
               </span>
            ))}
         </div>
         <div className={styles.patience}>
            <div className={styles.patienceFill} style={{ width: `${Math.round(frac * 100)}%`, background: hue }} />
         </div>
      </div>
   );
}

const press = (dir: -1 | 1) => ({
   onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      if (dir < 0) hudButtons.left += 1;
      else hudButtons.right += 1;
   },
   onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
         e.preventDefault();
         if (dir < 0) hudButtons.left += 1;
         else hudButtons.right += 1;
      }
   },
});

export default function Hud() {
   const [, setTick] = useState(0);
   useEffect(() => {
      const id = setInterval(() => setTick((t) => t + 1), 100);
      return () => clearInterval(id);
   }, []);
   return (
      <div className={styles.hud}>
         <div className={styles.bubbles} data-arcade-safe-area>
            {hudOrders[0] && <Bubble order={hudOrders[0]} />}
            {hudOrders[1] && <Bubble order={hudOrders[1]} />}
         </div>
         <button type="button" className={`${styles.turn} ${styles.turnLeft}`} data-arcade-safe-area aria-label="Turn the wheel left" {...press(-1)}>
            ◀
         </button>
         <button type="button" className={`${styles.turn} ${styles.turnRight}`} data-arcade-safe-area aria-label="Turn the wheel right" {...press(1)}>
            ▶
         </button>
      </div>
   );
}
