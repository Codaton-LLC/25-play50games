// STUB (Phase 0). Owner: Cursor (K1). Keep the props exactly as typed; add a .module.css next to this file.
import Link from "next/link";
import type { ReactNode } from "react";

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

export default function CollectionPanel({ id, title, description, href, ctaLabel, stats, children }: CollectionPanelProps) {
   return (
      <section id={id}>
         <h2>{title}</h2>
         <p>{description}</p>
         <ul>
            {stats.map((stat) => (
               <li key={stat.label}>
                  <strong>{stat.value}</strong> {stat.label}
               </li>
            ))}
         </ul>
         {children}
         <Link href={href}>{ctaLabel}</Link>
      </section>
   );
}
