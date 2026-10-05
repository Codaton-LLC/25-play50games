import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./CollectionPanel.module.css";

export interface CollectionStat {
   label: string;
   value: string;
}

export interface CollectionPanelProps {
   /** anchor id, e.g. "classic" or "arcade" */
   id: string;
   title: string;
   description: string;
   href: string;
   ctaLabel: string;
   stats: CollectionStat[];
   /** extra content, e.g. ClassicProgressBadge or ArcadeTeaserStrip */
   children?: ReactNode;
}

export default function CollectionPanel({
   id,
   title,
   description,
   href,
   ctaLabel,
   stats,
   children,
}: CollectionPanelProps) {
   const headingId = `${id}-title`;

   return (
      <section id={id} className={styles.panel} aria-labelledby={headingId}>
         <h2 id={headingId} className={styles.title}>
            {title}
         </h2>
         <p className={styles.description}>{description}</p>
         <ul className={styles.facts}>
            {stats.map((stat) => (
               <li key={`${stat.value}:${stat.label}`} className={styles.chip}>
                  {stat.value ? <strong>{stat.value}</strong> : null}
                  {stat.label ? <span>{stat.label}</span> : null}
               </li>
            ))}
         </ul>
         {children ? <div className={styles.slot}>{children}</div> : null}
         <Link className={styles.cta} href={href}>
            {ctaLabel}
         </Link>
      </section>
   );
}
