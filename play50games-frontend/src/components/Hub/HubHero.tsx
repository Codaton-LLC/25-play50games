import Link from "next/link";
import styles from "./HubHero.module.css";

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

export default function HubHero({ title, subtitle, primaryCta, secondaryCta, media }: HubHeroProps) {
   return (
      <section className={styles.hero}>
         {media ? (
            <div className={styles.mediaFrame} aria-hidden="true">
               <img className={styles.poster} src={media.poster} alt="" />
               <video
                  className={styles.media}
                  src={media.src}
                  poster={media.poster}
                  autoPlay
                  muted
                  loop
                  playsInline
               />
               <div className={styles.scrim} />
            </div>
         ) : (
            <div className={styles.backdrop} aria-hidden="true">
               <div className={styles.sky} />
               <div className={styles.glow} />
               <div className={styles.floor}>
                  <div className={styles.plane}>
                     <div className={styles.grid} />
                  </div>
               </div>
               <div className={styles.tiles}>
                  <span className={styles.tile}>
                     <svg viewBox="0 0 32 32" aria-hidden="true">
                        <path d="M6 6h8.5v8.5H6zM17.5 6H26v8.5h-8.5zM6 17.5h8.5V26H6zM17.5 17.5H26V26h-8.5z" />
                     </svg>
                  </span>
                  <span className={styles.tile}>
                     <svg viewBox="0 0 32 32" aria-hidden="true">
                        <circle cx="16" cy="16" r="9" />
                        <circle cx="16" cy="16" r="2.4" fill="currentColor" stroke="none" />
                     </svg>
                  </span>
                  <span className={styles.tile}>
                     <svg viewBox="0 0 32 32" aria-hidden="true">
                        <path d="M16 5.5 26.5 16 16 26.5 5.5 16z" />
                     </svg>
                  </span>
                  <span className={styles.tile}>
                     <svg viewBox="0 0 32 32" aria-hidden="true">
                        <path d="M16 6.5 26 12v10L16 27.5 6 22V12z" />
                        <path d="M16 16.5 26 12M16 16.5 6 12M16 16.5V27.5" />
                     </svg>
                  </span>
                  <span className={styles.tile}>
                     <svg viewBox="0 0 32 32" aria-hidden="true">
                        <path d="M8 8h7v6h-7v10h16" />
                        <path d="M20 20h4v4" />
                     </svg>
                  </span>
                  <span className={styles.tile}>
                     <svg viewBox="0 0 32 32" aria-hidden="true">
                        <path
                           fill="currentColor"
                           stroke="none"
                           d="M16 4.8 19.1 12h7.6l-6.1 4.6 2.3 7.4L16 19.6 9.1 24l2.3-7.4L5.3 12h7.6z"
                        />
                     </svg>
                  </span>
                  <span className={styles.tile}>
                     <svg viewBox="0 0 32 32" aria-hidden="true">
                        <path d="M16 5.5 26.5 11.5v9L16 26.5 5.5 20.5v-9z" />
                     </svg>
                  </span>
                  <span className={styles.tile}>
                     <svg viewBox="0 0 32 32" aria-hidden="true">
                        <path d="M6 13 16 8l10 5-10 5z" />
                        <path d="M6 18.5 16 23.5 26 18.5" />
                        <path d="M6 23.5 16 28.5 26 23.5" />
                     </svg>
                  </span>
               </div>
               <div className={styles.vignette} />
            </div>
         )}
         <div className={styles.content}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
            <div className={styles.actions}>
               <Link className={`${styles.cta} ${styles.ctaPrimary}`} href={primaryCta.href}>
                  {primaryCta.label}
               </Link>
               {secondaryCta ? (
                  secondaryCta.disabled ? (
                     <span className={`${styles.cta} ${styles.ctaDisabled}`} aria-disabled="true">
                        {secondaryCta.label}
                     </span>
                  ) : (
                     <Link className={`${styles.cta} ${styles.ctaSecondary}`} href={secondaryCta.href}>
                        {secondaryCta.label}
                     </Link>
                  )
               ) : null}
            </div>
         </div>
      </section>
   );
}
