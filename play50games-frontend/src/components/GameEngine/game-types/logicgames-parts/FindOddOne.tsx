"use client";

import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import theme from "./theme.module.css";
import css from "./FindOddOne.module.css";
import {
   CheckCircleIcon,
   XCircleIcon,
   HomeIcon,
   FingerPrintIcon,
   KeyIcon,
   StarIcon,
   EyeIcon,
   HeartIcon,
   CameraIcon,
   CubeIcon,
   BellIcon,
   PlusIcon,
   GiftIcon,
   MoonIcon,
} from "@heroicons/react/24/outline";

// Helper function to get Heroicon for each shape (sized by its cell through the module class)
function getShapeIcon(shape: string) {
   const iconProps = { className: css.icon, "aria-hidden": true as const };

   const shapeLower = shape.toLowerCase();

   switch (shapeLower) {
      case "home":
      case "circlestack":
      case "circle":
         return <HomeIcon {...iconProps} />;
      case "fingerprint":
      case "square2stack":
      case "square":
         return <FingerPrintIcon {...iconProps} />;
      case "key":
      case "arrowup":
      case "triangle":
         return <KeyIcon {...iconProps} />;
      case "star":
         return <StarIcon {...iconProps} />;
      case "eye":
      case "diamond":
         return <EyeIcon {...iconProps} />;
      case "heart":
         return <HeartIcon {...iconProps} />;
      case "camera":
      case "stop":
      case "pentagon":
         return <CameraIcon {...iconProps} />;
      case "cube":
      case "hexagon":
         return <CubeIcon {...iconProps} />;
      case "bell":
      case "octagon":
         return <BellIcon {...iconProps} />;
      case "plus":
      case "cross":
         return <PlusIcon {...iconProps} />;
      case "gift":
      case "arrowright":
      case "arrow":
         return <GiftIcon {...iconProps} />;
      case "moon":
      case "crescent":
         return <MoonIcon {...iconProps} />;
      default:
         return <HomeIcon {...iconProps} />;
   }
}

function FindOddOne({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const maxRounds = config.rounds || 20;
   const availableIcons = config.icons || [
      "Home",
      "Fingerprint",
      "Key",
      "Star",
      "Eye",
      "Heart",
      "Camera",
      "Cube",
      "Bell",
      "Plus",
      "Gift",
      "Moon",
   ];

   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [items, setItems] = useState<
      Array<{ id: number; icon: string; isOdd: boolean }>
   >([]);
   const [selected, setSelected] = useState<number | null>(null);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   // the round-end timer: cleared if the game unmounts mid-delay (it used to fire after leaving)
   const timerRef = useRef<number | null>(null);
   useEffect(
      () => () => {
         if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      },
      []
   );

   // Determine item count based on round
   const getItemCount = (round: number) => {
      if (round < 5) return 10; // Rounds 1-5: 10 items
      if (round < 10) return 30; // Rounds 6-10: 30 items
      return 50; // Rounds 11+: 50 items
   };

   // Determine grid columns based on item count and screen size
   const getGridColumns = (
      count: number,
      isMobile: boolean,
      isTablet: boolean
   ) => {
      if (isMobile) {
         // phones: wide rows keep the whole board on one screen; every cell stays >= 50 px even at
         // 360 px wide (5 x 2 for 10 items, 5 x 6 for 30, 6 x 9 for 50)
         if (count === 10) return 5;
         if (count === 30) return 5;
         return 6;
      }
      if (isTablet) {
         if (count === 10) return 4; // 4x3 grid for 10 items on tablet
         if (count === 30) return 5; // 5x6 grid for 30 items on tablet
         return 7; // 7x8 grid for 50 items on tablet
      }
      if (count === 10) return 5; // 5x2 grid for 10 items
      if (count === 30) return 6; // 6x5 grid for 30 items
      return 10; // 10x5 grid for 50 items
   };

   // Check screen size (mobile, tablet, desktop)
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   useEffect(() => {
      const checkScreenSize = () => {
         const width = window.innerWidth;
         setIsMobile(width < 768);
         setIsTablet(width >= 768 && width < 1024);
      };
      checkScreenSize();
      window.addEventListener("resize", checkScreenSize);
      return () => window.removeEventListener("resize", checkScreenSize);
   }, []);

   const startNewRound = useCallback(() => {
      const roundNumber = currentRound + 1;
      const itemCount = getItemCount(roundNumber);
      const oddIndex = Math.floor(Math.random() * itemCount);
      const baseIcon =
         availableIcons[Math.floor(Math.random() * availableIcons.length)];
      const oddIcon =
         availableIcons[Math.floor(Math.random() * availableIcons.length)] !==
         baseIcon
            ? availableIcons[
                 availableIcons.findIndex((icon: string) => icon !== baseIcon)
              ]
            : availableIcons[
                 (availableIcons.findIndex(
                    (icon: string) => icon === baseIcon
                 ) +
                    1) %
                    availableIcons.length
              ];

      const newItems = Array.from({ length: itemCount }, (_, i) => ({
         id: i,
         icon: i === oddIndex ? oddIcon : baseIcon,
         isOdd: i === oddIndex,
      }));

      // Shuffle items
      const shuffled = [...newItems].sort(() => Math.random() - 0.5);
      setItems(shuffled);
      setSelected(null);
      setFeedback(null);
   }, [currentRound, availableIcons]);

   useEffect(() => {
      startNewRound();
   }, [startNewRound]);

   const handleClick = useCallback(
      (id: number) => {
         if (selected !== null) return; // Already selected

         const item = items.find((i) => i.id === id);
         if (!item) return;

         setSelected(id);
         const isCorrect = item.isOdd;
         setFeedback(isCorrect ? "correct" : "wrong");

         const nextRound = currentRound + 1;
         const points = isCorrect ? 5 : 0; // 5 points per correct round
         const newScore = currentScore + points;

         setCurrentScore(newScore);
         onScoreUpdate(newScore);

         timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            if (nextRound >= maxRounds) {
               // Game complete
               onComplete(newScore);
            } else {
               setCurrentRound(nextRound);
               startNewRound();
            }
         }, 1500);
      },
      [
         selected,
         items,
         currentRound,
         currentScore,
         maxRounds,
         onScoreUpdate,
         onComplete,
         startNewRound,
      ]
   );

   const itemCount = getItemCount(currentRound + 1);
   const gridColumns = getGridColumns(itemCount, isMobile, isTablet);
   const sizeClass = itemCount >= 50 ? css.board50 : itemCount >= 30 ? css.board30 : css.board10;
   const progress = Math.min(1, (currentRound + 1) / maxRounds);

   return (
      <div className={`${theme.game} ${css.root}`}>
         <div className={theme.header}>
            <h3 className={theme.title}>Find the odd one out</h3>
            <p className={theme.subtitle}>Tap the icon that is different from the others.</p>
            <div className={theme.chips}>
               <span className={theme.chip}>
                  Round <strong>{currentRound + 1} / {maxRounds}</strong>
               </span>
               <span className={theme.chip}>
                  Score <strong>{currentScore} / {maxRounds * 5}</strong>
               </span>
            </div>
            <div
               className={css.progress}
               role="progressbar"
               aria-label="Round progress"
               aria-valuemin={0}
               aria-valuemax={maxRounds}
               aria-valuenow={currentRound + 1}
            >
               <div className={css.progressFill} style={{ transform: `scaleX(${progress})` }} />
            </div>
         </div>

         {/* Grid: equal 1fr tracks, square cells, one gap per board size */}
         <div
            key={`board-${currentRound}`}
            className={`${theme.board} ${css.board} ${sizeClass} ${css.enter}`}
            style={{ "--cols": gridColumns } as CSSProperties}
            role="group"
            aria-label="Icons"
         >
            {items.map((item, idx) => {
               const isSelected = selected === item.id;
               const isCorrect = item.isOdd && isSelected;
               const isWrong = !item.isOdd && isSelected;
               // after a wrong pick the odd one is marked, so the round still teaches
               const showOdd = item.isOdd && selected !== null && !isSelected;
               const cls = [
                  theme.cell,
                  css.item,
                  isCorrect ? `${theme.correct} ${css.fx} ${theme.pop}` : "",
                  isWrong ? `${theme.wrong} ${css.fx} ${theme.shake}` : "",
                  showOdd ? css.oddShown : "",
                  selected !== null && !isSelected && !showOdd ? css.itemDim : "",
               ]
                  .filter(Boolean)
                  .join(" ");

               return (
                  <button
                     key={item.id}
                     type="button"
                     className={cls}
                     style={{ "--i": Math.min(idx, 24) } as CSSProperties}
                     onClick={() => handleClick(item.id)}
                     disabled={selected !== null}
                     aria-label={`${item.icon}${isCorrect ? ", correct" : isWrong ? ", wrong" : ""}`}
                  >
                     {getShapeIcon(item.icon)}
                     {isSelected && (
                        <span className={`${css.badge} ${isCorrect ? css.badgeOk : css.badgeWarn}`}>
                           {isCorrect ? (
                              <CheckCircleIcon className={css.badgeIcon} aria-hidden="true" />
                           ) : (
                              <XCircleIcon className={css.badgeIcon} aria-hidden="true" />
                           )}
                        </span>
                     )}
                  </button>
               );
            })}
         </div>

         {/* Feedback: fixed-height slot, nothing below jumps */}
         <div className={theme.feedbackSlot} aria-live="polite">
            {feedback && (
               <div
                  className={`${theme.feedback} ${
                     feedback === "correct" ? theme.feedbackOk : theme.feedbackWarn
                  }`}
               >
                  {feedback === "correct" ? "Correct, well spotted." : "Not that one. The odd one is marked."}
               </div>
            )}
         </div>
      </div>
   );
}

export default FindOddOne;
