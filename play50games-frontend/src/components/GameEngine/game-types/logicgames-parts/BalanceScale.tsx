"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import theme from "./theme.module.css";
import css from "./BalanceScale.module.css";
import {
   ScaleIcon,
   ArrowLeftIcon,
   ArrowRightIcon,
   CheckCircleIcon,
   XCircleIcon,
} from "@heroicons/react/24/outline";
import {
   useKeyboardControls,
   createKeyboardMapping,
} from "@/hooks/useKeyboardControls";

function BalanceScale({
   config,
   currentRound = 1,
   maxRounds = 20,
   currentScore = 0,
   onScoreUpdate,
}: {
   config: Record<string, any>;
   currentRound?: number;
   maxRounds?: number;
   currentScore?: number;
   onScoreUpdate: (score: number) => void;
}) {
   const [leftWeight, setLeftWeight] = useState(0);
   const [rightWeight, setRightWeight] = useState(0);
   const [selected, setSelected] = useState<"left" | "right" | "equal" | null>(
      null
   );
   const [correct, setCorrect] = useState<boolean | null>(null);
   const [isAnimating, setIsAnimating] = useState(false);
   // the round-end timer: cleared if the game unmounts mid-delay (it used to fire after leaving)
   const timerRef = useRef<number | null>(null);
   useEffect(
      () => () => {
         if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      },
      []
   );

   // Initialize weights when component mounts or resets
   useEffect(() => {
      const left = Math.floor(Math.random() * 10) + 1;
      const right = Math.floor(Math.random() * 10) + 1;
      setLeftWeight(left);
      setRightWeight(right);
      setSelected(null);
      setCorrect(null);
      setIsAnimating(false);
   }, []);

   const handleSelect = (choice: "left" | "right" | "equal") => {
      if (selected !== null) return; // Prevent multiple clicks

      setSelected(choice);
      setIsAnimating(true);

      let isCorrect = false;
      if (choice === "left") isCorrect = leftWeight > rightWeight;
      else if (choice === "right") isCorrect = rightWeight > leftWeight;
      else isCorrect = leftWeight === rightWeight;

      setCorrect(isCorrect);

      // Faster animation for balance scale (0.5s instead of 1.5s) to allow 20 rounds in 60 seconds
      const animationDelay = 500;

      timerRef.current = window.setTimeout(() => {
         timerRef.current = null;
         setIsAnimating(false);
         // Send score for this round (5 points if correct, 0 if wrong)
         // Using 5 points per round so 20 rounds = 100 points max
         onScoreUpdate(isCorrect ? 5 : 0);

         // Reset for next round (will be triggered by parent component)
         const left = Math.floor(Math.random() * 10) + 1;
         const right = Math.floor(Math.random() * 10) + 1;
         setLeftWeight(left);
         setRightWeight(right);
         setSelected(null);
         setCorrect(null);
      }, animationDelay);
   };

   // Keyboard event handlers using general hook
   useKeyboardControls({
      mappings: createKeyboardMapping([
         { keys: ["ArrowLeft", "a", "A"], action: () => handleSelect("left") },
         {
            keys: ["ArrowRight", "d", "D"],
            action: () => handleSelect("right"),
         },
         {
            keys: ["Enter", " ", "e", "E"],
            action: () => handleSelect("equal"),
         },
      ]),
      enabled: selected === null && !isAnimating,
   });

   const getScaleRotation = () => {
      if (!isAnimating) return 0;
      if (leftWeight > rightWeight) return -8;
      if (rightWeight > leftWeight) return 8;
      return 0;
   };

   const tilt = getScaleRotation();
   const heavier =
      !isAnimating || leftWeight === rightWeight
         ? null
         : leftWeight > rightWeight
         ? "left"
         : "right";
   const progress = Math.min(1, currentRound / maxRounds);

   const choiceBtn = (
      choice: "left" | "right" | "equal",
      label: string,
      icon: JSX.Element
   ) => {
      const isSel = selected === choice;
      const cls = [
         theme.option,
         css.choice,
         isSel && correct === true ? `${css.choiceOk} ${theme.pop}` : "",
         isSel && correct === false ? `${css.choiceWarn} ${theme.shake}` : "",
         selected !== null && !isSel ? css.choiceDim : "",
      ]
         .filter(Boolean)
         .join(" ");
      return (
         <button
            type="button"
            className={cls}
            onClick={() => handleSelect(choice)}
            disabled={selected !== null}
         >
            {icon}
            <span>{label}</span>
         </button>
      );
   };

   return (
      <div className={`balance-scale-game ${theme.game} ${css.root}`}>
         <div className={theme.header}>
            <h3 className={`${theme.title} ${css.title}`}>
               <ScaleIcon className={css.titleIcon} aria-hidden="true" />
               Balance the Scale
            </h3>
            <div className={theme.chips}>
               <span className={theme.chip}>
                  Round <strong>{currentRound} / {maxRounds}</strong>
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
               aria-valuenow={currentRound}
            >
               <div className={css.progressFill} style={{ transform: `scaleX(${progress})` }} />
            </div>
         </div>

         {/* The scale: the beam tilts (transform rotate) to show which side is heavier; the pans
             hang from its ends and counter-rotate so they stay upright */}
         <div
            className={`${theme.panel} ${css.stage}`}
            style={{ "--tilt": `${tilt}deg` } as CSSProperties}
            role="img"
            aria-label={`Left pan ${leftWeight}, right pan ${rightWeight}`}
         >
            <div className={css.base} />
            <div className={css.pole} />
            <div className={css.beam}>
               <div className={css.pivot} />
               <div className={`${css.pan} ${css.panLeft}`}>
                  <div className={css.string} />
                  <div
                     key={`l-${currentRound}-${leftWeight}`}
                     className={`${css.weight} ${heavier === "left" ? css.heavy : ""} ${theme.reveal}`}
                  >
                     {leftWeight}
                  </div>
               </div>
               <div className={`${css.pan} ${css.panRight}`}>
                  <div className={css.string} />
                  <div
                     key={`r-${currentRound}-${rightWeight}`}
                     className={`${css.weight} ${heavier === "right" ? css.heavy : ""} ${theme.reveal}`}
                  >
                     {rightWeight}
                  </div>
               </div>
            </div>
         </div>

         <div className={css.choices} role="group" aria-label="Which side is heavier?">
            {choiceBtn(
               "left",
               "Left is heavier",
               <ArrowLeftIcon className={css.choiceIcon} aria-hidden="true" />
            )}
            {choiceBtn("equal", "Equal", <ScaleIcon className={css.choiceIcon} aria-hidden="true" />)}
            {choiceBtn(
               "right",
               "Right is heavier",
               <ArrowRightIcon className={css.choiceIcon} aria-hidden="true" />
            )}
         </div>

         {/* fixed-height slot: the feedback never pushes anything */}
         <div className={theme.feedbackSlot} aria-live="polite">
            {correct !== null && (
               <div
                  className={`${theme.feedback} ${correct ? theme.feedbackOk : theme.feedbackWarn}`}
               >
                  {correct ? (
                     <CheckCircleIcon className={css.fbIcon} aria-hidden="true" />
                  ) : (
                     <XCircleIcon className={css.fbIcon} aria-hidden="true" />
                  )}
                  <span>{correct ? "Correct" : "Not this time"}</span>
               </div>
            )}
         </div>
      </div>
   );
}

export default BalanceScale;
