"use client";

// "Skip to content": the first stop of every page's Tab order (app/layout.tsx). Hidden until it is
// focused; Enter moves the focus to the page's <main> (every page frame renders one: SitePage,
// the hub, /classic, /3d, a game page), so the header and the world switcher are skipped. The
// target is looked up on activation, so no page has to carry an id for it.
import type { MouseEvent } from "react";
import styles from "./SkipLink.module.css";

export const MAIN_ID = "main-content";

/** The page's main region: the first <main>, else the first h1. */
export function findMainTarget(doc: Document): HTMLElement | null {
   return doc.getElementById(MAIN_ID) ?? doc.querySelector<HTMLElement>("main") ?? doc.querySelector<HTMLElement>("h1");
}

export default function SkipLink() {
   const skip = (event: MouseEvent<HTMLAnchorElement>) => {
      const target = findMainTarget(document);
      if (!target) return;
      event.preventDefault();
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start" });
   };
   return (
      <a href={`#${MAIN_ID}`} className={styles.skip} onClick={skip}>
         Skip to content
      </a>
   );
}
