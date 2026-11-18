// Line icons of the redesign: one stroke width, drawn on a 24px grid. Server-safe.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Line({ children, ...props }: IconProps) {
   return (
      <svg
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         strokeWidth={1.75}
         strokeLinecap="round"
         strokeLinejoin="round"
         aria-hidden="true"
         {...props}
      >
         {children}
      </svg>
   );
}

export const SearchIcon = (props: IconProps) => (
   <Line {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
   </Line>
);

export const CloseIcon = (props: IconProps) => (
   <Line {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
   </Line>
);

export const ChevronIcon = (props: IconProps) => (
   <Line {...props}>
      <path d="m9 6 6 6-6 6" />
   </Line>
);

/** half-filled circle: the theme button */
export const ThemeIcon = (props: IconProps) => (
   <Line {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" stroke="none" />
   </Line>
);

export const ClockIcon = (props: IconProps) => (
   <Line {...props}>
      <circle cx="12" cy="13.5" r="6.5" />
      <path d="M12 13.5V10M10 3.5h4" />
   </Line>
);

export const LockIcon = (props: IconProps) => (
   <Line {...props}>
      <rect x="6" y="11" width="12" height="9" rx="2" />
      <path d="M9 11V8a3 3 0 0 1 6 0v3" />
   </Line>
);

export const CheckIcon = (props: IconProps) => (
   <Line {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
   </Line>
);

/** a medal on its ribbon: the certificate */
export const AwardIcon = (props: IconProps) => (
   <Line {...props}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7" />
   </Line>
);

export const ArrowLeftIcon = (props: IconProps) => (
   <Line {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
   </Line>
);

export const HomeIcon = (props: IconProps) => (
   <Line {...props}>
      <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
   </Line>
);

export const GridIcon = (props: IconProps) => (
   <Line {...props}>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
   </Line>
);

export const CubeIcon = (props: IconProps) => (
   <Line {...props}>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
   </Line>
);

/** a rolled-up ball with two bands of scales: Pangoroll Worlds */
export const RollIcon = (props: IconProps) => (
   <Line {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M6 8.5c2 1.6 4 1.6 6 0s4-1.6 6 0M5 14c2.3 1.8 4.7 1.8 7 0s4.7-1.8 7 0" />
   </Line>
);

export const PodiumIcon = (props: IconProps) => (
   <Line {...props}>
      <path d="M9 20V9h6v11M3 20v-6h6M15 20v-8h6v8M2 20h20" />
   </Line>
);

export const PlayIcon = (props: IconProps) => (
   <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8 5.5v13l11-6.5z" />
   </svg>
);

/** The brand mark: the logo's shield, reduced to one shape with the "50". */
export function BrandMark(props: IconProps) {
   return (
      <svg viewBox="0 0 32 36" aria-hidden="true" {...props}>
         <path
            d="M16 1.5 29.5 8v12.2c0 6.6-5.6 11.6-13.5 14.3C8.1 31.8 2.5 26.8 2.5 20.2V8z"
            fill="var(--p50-coral)"
         />
         <text
            x="16"
            y="23"
            textAnchor="middle"
            fontFamily="var(--p50-font-display)"
            fontWeight={700}
            fontSize="13.5"
            fill="#0B0F1A"
         >
            50
         </text>
      </svg>
   );
}

/** A leaderboard rank inside the logo's shield shape (ranks 1 to 3). */
export function RankShield({ rank, className }: { rank: number; className?: string }) {
   return (
      <svg viewBox="0 0 30 34" role="img" aria-label={`Rank ${rank}`} className={className}>
         <path d="M15 1.5 27.5 7.4v11.4c0 6.2-5.2 10.9-12.5 13.5C7.7 29.7 2.5 25 2.5 18.8V7.4z" data-part="shape" />
         <text x="15" y="21.5" textAnchor="middle" data-part="number">
            {rank}
         </text>
      </svg>
   );
}
