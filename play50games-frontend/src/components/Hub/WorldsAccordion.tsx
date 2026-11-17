"use client";

// The worlds as tall art panels in one row (docs/design/DESIGN.md §6): the open one is wide, the
// others show only their plate and name. Hover, focus or a tap opens a panel. On phones the
// panels stack and all of them are open. Every panel's button is a real link to its world.
import { useState, type ReactNode } from "react";
import Link from "next/link";
import ui from "@/components/Site/ui.module.css";
import styles from "./WorldsAccordion.module.css";

export interface WorldPanel {
   id: string;
   plate: string;
   /** the short name on the closed panel's spine */
   name: string;
   title: string;
   text: string;
   stats: ReactNode[];
   /** omitted = the world has no page yet (no button) */
   href?: string;
   cta: string;
   /** rendered on the server and passed in */
   art: ReactNode;
   soon?: boolean;
}

export interface WorldsAccordionProps {
   worlds: WorldPanel[];
   /** the panel that is open at first */
   initial: string;
}

export default function WorldsAccordion({ worlds, initial }: WorldsAccordionProps) {
   const [open, setOpen] = useState(initial);

   return (
      <div className={styles.acc}>
         {worlds.map((world) => {
            const isOpen = world.id === open;
            return (
               <article
                  key={world.id}
                  className={isOpen ? `${styles.world} ${styles.open}` : styles.world}
                  onMouseEnter={() => {
                     if (window.matchMedia("(hover: hover)").matches) setOpen(world.id);
                  }}
                  onFocus={() => setOpen(world.id)}
                  onClick={() => setOpen(world.id)}
                  // a closed panel has nothing focusable inside (its body is hidden), so the panel
                  // itself takes the focus and opens; the next Tab then reaches its link
                  tabIndex={isOpen ? undefined : 0}
                  aria-label={isOpen ? undefined : world.title}
               >
                  <div className={styles.art}>
                     {world.art}
                     <div className={styles.spine} aria-hidden="true">
                        <span className={ui.plate}>{world.plate}</span>
                        <span className={styles.vname}>{world.name}</span>
                     </div>
                  </div>
                  <div className={styles.body}>
                     <div className={styles.text}>
                        <div className={styles.head}>
                           <span className={`${ui.plate} ${ui.plateLg}`}>{world.plate}</span>
                           <h3 className={styles.title}>{world.title}</h3>
                           {world.soon ? <span className={styles.soon}>Soon</span> : null}
                        </div>
                        <p className={styles.desc}>{world.text}</p>
                        <ul className={styles.stats}>
                           {world.stats.map((stat, index) => (
                              <li key={index}>{stat}</li>
                           ))}
                        </ul>
                     </div>
                     {world.href ? (
                        <Link href={world.href} className={`${ui.btn} ${ui.btnQuiet}`}>
                           {world.cta}
                        </Link>
                     ) : null}
                  </div>
               </article>
            );
         })}
      </div>
   );
}
