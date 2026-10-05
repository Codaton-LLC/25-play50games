// Collection tabs shared by "/", "/classic" and "/3d". Server-safe: no hooks, no client-only code.
// Each tab is a real <Link> so every collection has its own crawlable URL.
// Render it as a direct child of a tall container (not inside its own wrapper), or sticky stops working.
import Link from "next/link";
import { ARCADE_ENABLED } from "@/arcade3d/flags";
import styles from "./SectionTabs.module.css";

export type SectionTabId = "home" | "classic" | "arcade";

export interface SectionTabsProps {
   active: SectionTabId;
}

interface SectionTab {
   id: SectionTabId;
   label: string;
   href: string;
}

const TABS: SectionTab[] = [
   { id: "home", label: "Home", href: "/" },
   { id: "classic", label: "Play Classic 50 Games", href: "/classic" },
   { id: "arcade", label: "3D Arcade", href: "/3d" },
];

export default function SectionTabs({ active }: SectionTabsProps) {
   const tabs = TABS.filter((tab) => tab.id !== "arcade" || ARCADE_ENABLED);

   return (
      <nav aria-label="Game collections" className={styles.nav}>
         <ul className={styles.list}>
            {tabs.map((tab) => {
               const isActive = tab.id === active;
               return (
                  <li key={tab.id} className={styles.item}>
                     <Link
                        href={tab.href}
                        className={
                           isActive ? `${styles.tab} ${styles.active}` : styles.tab
                        }
                        aria-current={isActive ? "page" : undefined}
                     >
                        {tab.label}
                     </Link>
                  </li>
               );
            })}
         </ul>
      </nav>
   );
}
