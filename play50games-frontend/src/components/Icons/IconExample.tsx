/**
 * Example component showing how to use Heroicons
 *
 * Heroicons provides three variants:
 * - Outline: 24x24, 1.5px stroke (default)
 * - Solid: 24x24, filled
 * - Mini: 20x20, 1.5px stroke (smaller)
 *
 * Import from @heroicons/react/24/outline, @heroicons/react/24/solid, or @heroicons/react/20/solid
 */

import {
   // Common icons
   HomeIcon,
   UserIcon,
   TrophyIcon,
   ClockIcon,
   StarIcon,
   CheckCircleIcon,
   XCircleIcon,
   PlayIcon,
   PauseIcon,
   ArrowRightIcon,
   ArrowLeftIcon,
   // Game-related icons
   PuzzlePieceIcon,
   SparklesIcon,
   FireIcon,
   BoltIcon,
   // UI icons
   MagnifyingGlassIcon,
   Bars3Icon,
   XMarkIcon,
   // Status icons
   InformationCircleIcon,
   ExclamationTriangleIcon,
   CheckBadgeIcon,
} from "@heroicons/react/24/outline";

import {
   HomeIcon as HomeIconSolid,
   TrophyIcon as TrophyIconSolid,
   StarIcon as StarIconSolid,
} from "@heroicons/react/24/solid";

// Example usage component
export function IconExamples() {
   return (
      <div style={{ padding: "20px" }}>
         <h2>Heroicons Examples</h2>

         <div
            style={{
               display: "flex",
               gap: "20px",
               flexWrap: "wrap",
               marginTop: "20px",
            }}
         >
            {/* Outline icons */}
            <div>
               <HomeIcon
                  style={{ width: 24, height: 24, color: "var(--accent)" }}
               />
               <span>Home (Outline)</span>
            </div>

            <div>
               <TrophyIcon
                  style={{ width: 24, height: 24, color: "var(--ok)" }}
               />
               <span>Trophy (Outline)</span>
            </div>

            <div>
               <StarIcon
                  style={{ width: 24, height: 24, color: "var(--accent)" }}
               />
               <span>Star (Outline)</span>
            </div>

            {/* Solid icons */}
            <div>
               <HomeIconSolid
                  style={{ width: 24, height: 24, color: "var(--accent)" }}
               />
               <span>Home (Solid)</span>
            </div>

            <div>
               <TrophyIconSolid
                  style={{ width: 24, height: 24, color: "var(--ok)" }}
               />
               <span>Trophy (Solid)</span>
            </div>
         </div>
      </div>
   );
}

// Export commonly used icons for easy import
export {
   HomeIcon,
   UserIcon,
   TrophyIcon,
   ClockIcon,
   StarIcon,
   CheckCircleIcon,
   XCircleIcon,
   PlayIcon,
   PauseIcon,
   ArrowRightIcon,
   ArrowLeftIcon,
   PuzzlePieceIcon,
   SparklesIcon,
   FireIcon,
   BoltIcon,
   MagnifyingGlassIcon,
   Bars3Icon,
   XMarkIcon,
   InformationCircleIcon,
   ExclamationTriangleIcon,
   CheckBadgeIcon,
};
