// The frame of a plain page (FAQ, contact, legal, certificate): the site header, a main column
// and the footer, plus the page's heading block (docs/design/DESIGN.md §6). Server component.
import type { ReactNode } from "react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import type { SiteSection } from "./siteData";
import ui from "./ui.module.css";
import styles from "./SitePage.module.css";

export interface SitePageProps {
   /** the world the switcher rests on ("other" = none) */
   active?: SiteSection;
   children: ReactNode;
}

export default function SitePage({ active = "other", children }: SitePageProps) {
   return (
      <div className={`p50 ${styles.page}`}>
         <SiteHeader active={active} />
         <main className={`${ui.wrap} ${styles.main}`}>{children}</main>
         <SiteFooter />
      </div>
   );
}

export interface PageHeadProps {
   /** the small label over the title: "Help", "Legal" */
   label: string;
   title: string;
   lead?: ReactNode;
   children?: ReactNode;
}

/** Label, title and one sentence: the left column of a split page, or the top of a document. */
export function PageHead({ label, title, lead, children }: PageHeadProps) {
   return (
      <header className={styles.head}>
         <p className={ui.label}>{label}</p>
         <h1 className={styles.title}>{title}</h1>
         {lead ? <p className={styles.lead}>{lead}</p> : null}
         {children}
      </header>
   );
}
