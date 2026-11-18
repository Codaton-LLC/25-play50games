"use client";

// The start card's two control illustrations (core/README.md "How to play"), pure CSS + inline SVG:
// - KeyboardDeck: only the keys the game uses, as keycaps, each group captioned with its action.
//   WASD and the arrows are drawn as the inverted-T cluster; the main keys (moving, the main
//   action) wear the game's accent. `lit` (a wizard step's key ids) presses those keys in a slow
//   pulse and dims the rest; with `lit` omitted the main keys breathe one after another.
// - PhoneDeck: a phone with the game's real on-screen controls in their real places (the joystick
//   bottom left, Action then Jump bottom right, as TouchControls lays them out; Pause top right),
//   gestures (tap, swipe, drag) drawn as a moving finger, and a legend that names each control.
// Both are decorative pictures for sighted players: the groups carry text labels for screen readers.
import type { CSSProperties } from "react";
import { capsOf, buttonTexts, keyRole, PAUSE_ID, type HowToKey, type HowToTouch } from "./howTo";
import styles from "./HowTo.module.css";

const ARROW_ROTATION: Record<string, number> = { Up: 0, Right: 90, Down: 180, Left: 270 };
const ARROW_NAMES: Record<string, string> = { Up: "Up arrow", Down: "Down arrow", Left: "Left arrow", Right: "Right arrow" };

function ArrowGlyph({ dir }: { dir: string }) {
   return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" style={{ transform: `rotate(${ARROW_ROTATION[dir] ?? 0}deg)` }}>
         <path d="M8 3.2 3.6 8.4h2.9V13h3V8.4h2.9z" fill="currentColor" />
      </svg>
   );
}

function MouseGlyph() {
   return (
      <svg className={styles.mouse} viewBox="0 0 28 40" aria-hidden="true">
         <rect x="1.5" y="1.5" width="25" height="37" rx="12.5" className={styles.mouseBody} />
         <path d="M14 1.5v13M1.5 14.5h25" className={styles.mouseLine} />
         <path d="M14 1.5A12.5 12.5 0 0 0 1.5 14v.5H14z" className={styles.mouseButton} />
         <rect x="12.6" y="6" width="2.8" height="5.5" rx="1.4" className={styles.mouseWheel} />
      </svg>
   );
}

/** One keycap. */
function Cap({ cap, index }: { cap: string; index: number }) {
   const wide = cap === "Space";
   const word = cap.length > 1 && !ARROW_NAMES[cap];
   return (
      <span
         className={`${styles.cap} ${wide ? styles.capSpace : ""} ${word ? styles.capWord : ""}`}
         style={{ "--i": index } as CSSProperties}
         role="img"
         aria-label={ARROW_NAMES[cap] ?? (cap === "Esc" ? "Escape" : cap)}
      >
         {ARROW_NAMES[cap] ? <ArrowGlyph dir={cap} /> : cap}
      </span>
   );
}

/** A cap spec: the inverted-T cluster for WASD / Arrows, the mouse, or a row of caps. */
function Spec({ spec }: { spec: string }) {
   if (spec === "Mouse") {
      return (
         <span className={styles.specMouse} role="img" aria-label="Mouse">
            <MouseGlyph />
         </span>
      );
   }
   const caps = capsOf(spec);
   if (spec === "WASD" || spec === "Arrows") {
      return (
         <span className={styles.cluster}>
            {caps.map((cap, index) => (
               <span key={cap} className={styles.clusterCell} data-pos={index === 0 ? "top" : undefined}>
                  <Cap cap={cap} index={index} />
               </span>
            ))}
         </span>
      );
   }
   return (
      <span className={styles.row}>
         {caps.map((cap, index) => (
            <Cap key={cap} cap={cap} index={index} />
         ))}
      </span>
   );
}

export interface KeyboardDeckProps {
   keys: HowToKey[];
   /** key ids to press (a wizard step); omitted = the card's resting view */
   lit?: readonly string[];
   /** the wizard's bigger caps */
   large?: boolean;
}

export function KeyboardDeck({ keys, lit, large }: KeyboardDeckProps) {
   const focus = lit !== undefined && lit.length > 0;
   return (
      <ul className={`${styles.deck} ${large ? styles.deckLarge : ""}`} aria-label="Keyboard controls" data-focus={focus ? "" : undefined}>
         {keys.map((key) => {
            const isLit = focus && lit!.includes(key.id);
            const pause = keyRole(key) === "pause" || key.id === PAUSE_ID;
            return (
               <li
                  key={key.id}
                  className={`${styles.group} ${key.main ? styles.groupMain : ""} ${pause ? styles.groupQuiet : ""}`}
                  data-lit={isLit ? "" : undefined}
               >
                  <span className={styles.caps}>
                     {key.keys.map((spec, index) => (
                        <span key={spec} className={styles.alt}>
                           {index > 0 && (
                              <span className={styles.or} aria-hidden="true">
                                 or
                              </span>
                           )}
                           <Spec spec={spec} />
                        </span>
                     ))}
                  </span>
                  <span className={styles.caption}>
                     {key.hold && <span className={styles.hold}>Hold</span>}
                     {key.label}
                  </span>
               </li>
            );
         })}
      </ul>
   );
}

// ---------- the phone ----------

function Finger({ kind }: { kind: "tap" | "swipe" | "drag" }) {
   return (
      <span className={styles.gesture} data-kind={kind} aria-hidden="true">
         {kind === "drag" && <span className={styles.dragLine} />}
         {kind === "swipe" && <span className={styles.swipeTrail} />}
         <span className={styles.finger} />
         {kind === "tap" && <span className={styles.ripple} />}
      </span>
   );
}

/** The legend's little picture of a control. */
function Glyph({ control }: { control: HowToTouch["control"] | "pause" }) {
   return <span className={styles.glyph} data-control={control} aria-hidden="true" />;
}

const CONTROL_NAMES: Record<HowToTouch["control"], string> = {
   joystick: "Joystick",
   jump: "Button",
   action: "Button",
   tap: "Tap",
   swipe: "Swipe",
   drag: "Drag",
};

export interface PhoneDeckProps {
   touch: HowToTouch[];
   /** GameDefinition.touchLabels: the button texts */
   labels?: { jump?: string; action?: string };
   lit?: readonly string[];
   portrait?: boolean;
   /** the legend under the phone (off in the wizard's short landscape layout) */
   legend?: boolean;
}

export function PhoneDeck({ touch, labels, lit, portrait, legend = true }: PhoneDeckProps) {
   const texts = buttonTexts(labels);
   const focus = lit !== undefined && lit.length > 0;
   const on = (id: string) => (focus && lit!.includes(id) ? "" : undefined);
   const stick = touch.find((t) => t.control === "joystick");
   const action = touch.find((t) => t.control === "action");
   const jump = touch.find((t) => t.control === "jump");
   const gesture = touch.find((t) => t.control === "tap" || t.control === "swipe" || t.control === "drag");
   return (
      <div className={styles.phoneWrap} data-focus={focus ? "" : undefined}>
         <div className={`${styles.phone} ${portrait ? styles.phonePortrait : ""}`} role="img" aria-label="Touch controls on a phone">
            <div className={styles.screen}>
               <span className={styles.hudMock} aria-hidden="true">
                  <span />
                  <span />
               </span>
               <span className={styles.pauseMock} data-lit={on(PAUSE_ID)} aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="10" height="10">
                     <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" />
                  </svg>
               </span>
               {gesture && (
                  <span className={styles.gestureSpot} data-lit={on(gesture.id)}>
                     <Finger kind={gesture.control as "tap" | "swipe" | "drag"} />
                  </span>
               )}
               {stick && (
                  <span className={styles.stick} data-lit={on(stick.id)} aria-hidden="true">
                     <span className={styles.stickKnob} />
                  </span>
               )}
               {(action || jump) && (
                  <span className={styles.pads} aria-hidden="true">
                     {action && (
                        <span className={styles.pad} data-lit={on(action.id)}>
                           {texts.action}
                        </span>
                     )}
                     {jump && (
                        <span className={styles.pad} data-lit={on(jump.id)}>
                           {texts.jump}
                        </span>
                     )}
                  </span>
               )}
            </div>
         </div>
         {legend && (
            <ul className={styles.legend} aria-label="Touch controls">
               {touch.map((t) => (
                  <li key={t.id} className={styles.legendItem} data-lit={on(t.id)}>
                     <Glyph control={t.control} />
                     {/* "Tap the field to fire" already starts with its name */}
                     {!t.label.toLowerCase().startsWith(CONTROL_NAMES[t.control].toLowerCase()) && (
                        <span className={styles.legendName}>
                           {t.control === "jump" || t.control === "action" ? texts[t.control] : CONTROL_NAMES[t.control]}
                        </span>
                     )}
                     <span className={styles.legendText}>
                        {t.hold && <span className={styles.hold}>Hold</span>}
                        {/* a button whose text already says it ("Ride") gets no caption twice */}
                        {(t.control === "jump" || t.control === "action") && t.label.toLowerCase() === texts[t.control].toLowerCase() ? null : t.label}
                     </span>
                  </li>
               ))}
               <li className={`${styles.legendItem} ${styles.groupQuiet}`} data-lit={on(PAUSE_ID)}>
                  <Glyph control="pause" />
                  <span className={styles.legendName}>Pause</span>
                  <span className={styles.legendText}>Top right</span>
               </li>
            </ul>
         )}
      </div>
   );
}
