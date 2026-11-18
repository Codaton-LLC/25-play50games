// Footer of the redesigned pages (DESIGN.md §5). Server component.
import Link from "next/link";
import { ARCADE_ENABLED, ARCADE_LEADERBOARD, SQUAD_TEASER } from "@/arcade3d/flags";
import { BrandMark } from "./icons";
import ui from "./ui.module.css";
import styles from "./SiteFooter.module.css";

interface FooterLink {
   label: string;
   href: string;
}

const PLAY: FooterLink[] = [
   { label: "Classic 50", href: "/classic" },
   ...(ARCADE_ENABLED ? [{ label: "3D Arcade", href: "/3d" }] : []),
   ...(SQUAD_TEASER ? [{ label: "Scale Squad", href: "/scale-squad" }] : []),
   ...(ARCADE_ENABLED && ARCADE_LEADERBOARD ? [{ label: "Leaderboards", href: "/leaderboards" }] : []),
];

const ACCOUNT: FooterLink[] = [
   { label: "My progress", href: "/progress" },
   { label: "Certificate", href: "/certificate" },
   { label: "Verify a certificate", href: "/verify" },
];

const HELP: FooterLink[] = [
   { label: "FAQ", href: "/faq" },
   { label: "Contact", href: "/contact-us" },
   { label: "Privacy", href: "/privacy-policy" },
   { label: "Terms", href: "/terms-and-conditions" },
];

function Column({ title, links }: { title: string; links: FooterLink[] }) {
   return (
      <nav aria-label={title}>
         <p className={`${ui.label} ${styles.title}`}>{title}</p>
         <ul>
            {links.map((link) => (
               <li key={link.href}>
                  <Link href={link.href} className={styles.link}>
                     {link.label}
                  </Link>
               </li>
            ))}
         </ul>
      </nav>
   );
}

export default function SiteFooter() {
   return (
      <footer className={styles.foot}>
         <div className={ui.wrap}>
            <div className={styles.grid}>
               <div className={styles.brandCol}>
                  <Link href="/" className={styles.brand} aria-label="Play50Games home">
                     <BrandMark className={styles.mark} />
                     <span>
                        Play<b>50</b>Games
                     </span>
                  </Link>
                  <p className={styles.about}>
                     Free games in your browser: fifty classic brain games
                     {ARCADE_ENABLED ? " and a 3D arcade" : ""}. Nothing to download.
                  </p>
               </div>
               <Column title="Play" links={PLAY} />
               <Column title="Account" links={ACCOUNT} />
               <Column title="Help" links={HELP} />
            </div>
            <p className={styles.note}>&copy; {new Date().getFullYear()} Play50Games</p>
         </div>
      </footer>
   );
}
