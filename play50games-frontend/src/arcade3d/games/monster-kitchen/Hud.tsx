// The DOM HUD GameShell mounts over the canvas: the two order bubbles (marked data-arcade-safe-area,
// so the camera fit keeps them clear — portrait stacks them under the HUD chips, landscape keeps them
// in a right-hand column over the empty +x region) and the game-local ◀ ▶ wheel buttons, 72 px like
// the shell's touch buttons. The Scene writes hudOrders and consumes hudButtons every frame; this
// layer re-renders at 10 Hz (patience bars read smoothly through CSS transitions). The hand card
// between the ◀ ▶ buttons names what Space / Enter tosses (the centre front slot, under the selector
// ring on the wheel), whether an order needs it, and what is in the air.
import { useEffect, useState, useSyncExternalStore } from "react";
import { KIND_LABEL, KindIcon, TYPE_TINT } from "./Primitives";
import { PATIENCE, type IngredientKind, type Order } from "./rules";
import { useKitchenLevel } from "./useKitchenLevel";
import styles from "./Hud.module.css";

/** Presses of the ◀ ▶ buttons since the Scene last read them (cleared there each frame). */
export const hudButtons = { left: 0, right: 0 };

/** Live refs to the two windows' orders, written by the Scene's useRunFrame every frame. */
export const hudOrders: Array<Order | null> = [null, null];

/** What the hand card shows. The Scene publishes it every frame; the card re-renders only on a change. */
const hudHand: {
   /** the centre front slot's kind (what Space / Enter tosses), null when it is empty */
   kind: IngredientKind | null;
   /** an ordering monster needs `kind` next and is still waiting when it would land */
   needed: boolean;
   /** the ingredient in the air, or null */
   flying: IngredientKind | null;
   /** the burp lock holds */
   locked: boolean;
} = { kind: null, needed: false, flying: null, locked: false };
let handVersion = 0;
const handListeners = new Set<() => void>();

/** Called by the Scene every frame (and on mount/unmount): notifies the card only when something changed. */
export function publishHand(kind: IngredientKind | null, needed: boolean, flying: IngredientKind | null, locked: boolean): void {
   if (hudHand.kind === kind && hudHand.needed === needed && hudHand.flying === flying && hudHand.locked === locked) return;
   hudHand.kind = kind;
   hudHand.needed = needed;
   hudHand.flying = flying;
   hudHand.locked = locked;
   handVersion += 1;
   for (const listener of handListeners) listener();
}

const subscribeHand = (listener: () => void) => {
   handListeners.add(listener);
   return () => {
      handListeners.delete(listener);
   };
};
const handSnapshot = () => handVersion;

function Hand() {
   useSyncExternalStore(subscribeHand, handSnapshot, handSnapshot);
   const { kind, needed, flying, locked } = hudHand;
   if (flying) {
      return (
         <div className={`${styles.hand} ${styles.handBusy}`}>
            <KindIcon kind={flying} size={30} />
            <span className={styles.handText}>
               <span className={styles.handLabel}>Throwing</span>
               <span className={styles.handName}>{KIND_LABEL[flying]}</span>
            </span>
         </div>
      );
   }
   if (locked) {
      return (
         <div className={`${styles.hand} ${styles.handBusy}`}>
            <span className={styles.handText}>
               <span className={styles.handLabel}>Burp!</span>
               <span className={styles.handName}>Wait…</span>
            </span>
         </div>
      );
   }
   if (!kind) {
      return (
         <div className={`${styles.hand} ${styles.handBusy}`}>
            <span className={styles.handText}>
               <span className={styles.handLabel}>Centre · Space</span>
               <span className={styles.handName}>Empty</span>
            </span>
         </div>
      );
   }
   return (
      <div className={`${styles.hand} ${needed ? styles.handYes : styles.handNo}`}>
         <KindIcon kind={kind} size={34} />
         <span className={styles.handText}>
            <span className={styles.handLabel}>Centre · Space</span>
            <span className={styles.handName}>{KIND_LABEL[kind]}</span>
            <span className={styles.handTag}>{needed ? "✓ Needed" : "✗ Not needed"}</span>
         </span>
      </div>
   );
}

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

/** Level 1 keeps the original hint. Later levels name the mechanic that level adds. */
function hintFor(windowBAtS: number, driftEveryS: number, penalty: number): string {
   if (windowBAtS >= 70) return "Tap a front item to throw it · tap a back item to turn it here";
   if (penalty > 3) return "Patience is short · a wrong toss costs more";
   if (driftEveryS < 6) return "The wheel drifts · keep the next ingredient at the front";
   return "Two monsters can order at once · cook both bubbles";
}

export default function Hud() {
   const { config } = useKitchenLevel();
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
         <div className={styles.handSlot} data-arcade-safe-area>
            <div role="status" aria-atomic="true">
               <Hand />
            </div>
            <p className={styles.handHint}>{hintFor(config.windowBAtS, config.driftEveryS, config.penalty)}</p>
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
