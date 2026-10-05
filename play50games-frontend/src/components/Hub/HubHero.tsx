// STUB (Phase 0). Owner: Cursor (K1). Keep the props exactly as typed; add a .module.css next to this file.
import Link from "next/link";

export interface HubCta {
   label: string;
   href: string;
   /** shown but not clickable, e.g. "3D Arcade coming soon" */
   disabled?: boolean;
}

export interface HubHeroProps {
   title: string;
   subtitle: string;
   primaryCta: HubCta;
   secondaryCta?: HubCta;
   /** Phase 5: a recorded trailer replaces the CSS background */
   media?: { type: "video"; src: string; poster: string };
}

export default function HubHero({ title, subtitle, primaryCta, secondaryCta }: HubHeroProps) {
   return (
      <section>
         <h1>{title}</h1>
         <p>{subtitle}</p>
         <Link href={primaryCta.href}>{primaryCta.label}</Link>
         {secondaryCta &&
            (secondaryCta.disabled ? (
               <span aria-disabled="true">{secondaryCta.label}</span>
            ) : (
               <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
            ))}
      </section>
   );
}
