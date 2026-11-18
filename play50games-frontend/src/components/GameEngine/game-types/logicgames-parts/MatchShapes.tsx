"use client";

import { useState, useEffect, useRef } from "react";
import theme from "./theme.module.css";
import css from "./MatchShapes.module.css";
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

// Helper function to get shape display name from Heroicon name
function getShapeDisplayName(shape: string): string {
   const shapeLower = shape.toLowerCase();

   switch (shapeLower) {
      case "home":
      case "circlestack":
      case "circle":
         return "Home";
      case "fingerprint":
      case "square2stack":
      case "square":
         return "Fingerprint";
      case "key":
      case "arrowup":
      case "triangle":
         return "Key";
      case "star":
         return "Star";
      case "eye":
      case "diamond":
         return "Eye";
      case "heart":
         return "Heart";
      case "camera":
      case "stop":
      case "pentagon":
         return "Camera";
      case "cube":
      case "hexagon":
         return "Cube";
      case "bell":
      case "octagon":
         return "Bell";
      case "plus":
      case "cross":
         return "Plus";
      case "gift":
      case "arrowright":
      case "arrow":
         return "Gift";
      case "moon":
      case "crescent":
         return "Moon";
      default:
         return shape;
   }
}

// Helper function to get Heroicon for each shape
// size and colour come from the parent (CSS module), so icons scale with their tile
function getShapeIcon(shape: string) {
   const iconStyle = {
      width: "100%",
      height: "100%",
   };

   const shapeLower = shape.toLowerCase();

   switch (shapeLower) {
      case "home":
      case "circlestack":
      case "circle":
         return <HomeIcon style={iconStyle} />;
      case "fingerprint":
      case "square2stack":
      case "square":
         return <FingerPrintIcon style={iconStyle} />;
      case "key":
      case "arrowup":
      case "triangle":
         return <KeyIcon style={iconStyle} />;
      case "star":
         return <StarIcon style={iconStyle} />;
      case "eye":
      case "diamond":
         return <EyeIcon style={iconStyle} />;
      case "heart":
         return <HeartIcon style={iconStyle} />;
      case "camera":
      case "stop":
      case "pentagon":
         return <CameraIcon style={iconStyle} />;
      case "cube":
      case "hexagon":
         return <CubeIcon style={iconStyle} />;
      case "bell":
      case "octagon":
         return <BellIcon style={iconStyle} />;
      case "plus":
      case "cross":
         return <PlusIcon style={iconStyle} />;
      case "gift":
      case "arrowright":
      case "arrow":
         return <GiftIcon style={iconStyle} />;
      case "moon":
      case "crescent":
         return <MoonIcon style={iconStyle} />;
      default:
         return <HomeIcon style={iconStyle} />;
   }
}

function MatchShapes({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const [shapes] = useState(
      config.shapes || [
         "Home", // HomeIcon → "Home" (was CircleStack)
         "Fingerprint", // FingerPrintIcon → "Fingerprint" (was Square2Stack)
         "Key", // KeyIcon → "Key" (was ArrowUp)
         "Star", // StarIcon → "Star"
         "Eye", // EyeIcon → "Eye" (was Diamond)
         "Heart", // HeartIcon → "Heart"
         "Camera", // CameraIcon → "Camera" (was Stop)
         "Cube", // CubeIcon → "Cube"
         "Bell", // BellIcon → "Bell" (was Octagon)
         "Plus", // PlusIcon → "Plus"
         "Gift", // GiftIcon → "Gift" (was ArrowRight)
         "Moon", // MoonIcon → "Moon"
      ]
   );
   const [targetShape, setTargetShape] = useState("");
   const [selectedShape, setSelectedShape] = useState("");
   const [correct, setCorrect] = useState<boolean | null>(null);
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const maxRounds = config.rounds || 20;
   // the next-round timer, cleared on unmount
   const roundTimerRef = useRef<number | null>(null);
   useEffect(
      () => () => {
         if (roundTimerRef.current !== null) window.clearTimeout(roundTimerRef.current);
      },
      []
   );

   useEffect(() => {
      // Start first round
      startNewRound();
   }, []);

   const startNewRound = () => {
      const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
      setTargetShape(randomShape);
      setSelectedShape("");
      setCorrect(null);
   };

   const handleShapeClick = (shape: string) => {
      if (selectedShape !== "") return; // Prevent multiple clicks

      setSelectedShape(shape);
      const isCorrect = shape === targetShape;
      setCorrect(isCorrect);

      const nextRound = currentRound + 1;
      const newScore = isCorrect ? currentScore + 5 : currentScore; // 5 points per correct round

      setCurrentScore(newScore);
      onScoreUpdate(newScore);

      roundTimerRef.current = window.setTimeout(() => {
         roundTimerRef.current = null;
         setCurrentRound(nextRound);

         if (nextRound >= maxRounds) {
            // Game complete - use the updated score
            onComplete(newScore);
         } else {
            // Continue to next round
            startNewRound();
         }
      }, 500); // Faster transition like Balance Scale
   };

   // Keyboard controls for Match the Shapes
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         if (selectedShape !== "") return; // Prevent input after selection

         // Numbers 1-9 and 0, -, = for 10, 11, 12
         const key = e.key;
         let index = -1;

         if (key >= "1" && key <= "9") {
            index = parseInt(key) - 1; // 1-9 → 0-8
         } else if (key === "0") {
            index = 9; // 0 → 10th shape
         } else if (key === "-" || key === "_") {
            index = 10; // - → 11th shape
         } else if (key === "=" || key === "+") {
            index = 11; // = → 12th shape
         }

         if (index >= 0 && index < shapes.length) {
            e.preventDefault();
            handleShapeClick(shapes[index]);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [selectedShape, shapes]);

   const keyFor = (idx: number): string => {
      if (idx < 9) return String(idx + 1); // 1-9
      if (idx === 9) return "0"; // 10th shape
      if (idx === 10) return "-"; // 11th shape
      return "="; // 12th shape
   };
   const progress = Math.min(1, Math.max(0, (currentRound + 1) / maxRounds));

   return (
      <div className={`${theme.game} ${css.root}`}>
         <div className={`${theme.header} ${css.head}`}>
            <div className={theme.chips}>
               <span className={theme.chip}>
                  Round <strong>{Math.min(currentRound + 1, maxRounds)} / {maxRounds}</strong>
               </span>
               <span className={theme.chip}>
                  Score <strong>{currentScore} / {maxRounds * 5}</strong>
               </span>
            </div>
            <div
               className={css.progress}
               role="progressbar"
               aria-valuemin={0}
               aria-valuemax={100}
               aria-valuenow={Math.round(progress * 100)}
               aria-label="Rounds played"
            >
               <div
                  className={css.progressFill}
                  style={{ transform: `scaleX(${progress})` }}
               />
            </div>
         </div>

         <div className={`${theme.panel} ${css.target}`}>
            <span className={css.targetLabel}>Find this shape</span>
            {/* keyed by round: each new target reveals once, then stays still */}
            <div key={currentRound} className={`${css.targetBody} ${theme.reveal}`}>
               <div className={css.shape} aria-hidden>
                  {getShapeIcon(targetShape)}
               </div>
               <span className={css.targetName}>
                  {getShapeDisplayName(targetShape)}
               </span>
            </div>
         </div>

         <div className={`${theme.feedbackSlot} ${css.feedback}`} role="status" aria-live="polite">
            {correct !== null && (
               <div
                  className={`${theme.feedback} ${
                     correct ? `${theme.feedbackOk} ${theme.pop}` : `${theme.feedbackWarn} ${theme.shake}`
                  }`}
               >
                  {correct ? (
                     <>
                        <CheckCircleIcon className={css.feedbackIcon} aria-hidden />
                        <span>Correct, that is a match.</span>
                     </>
                  ) : (
                     <>
                        <XCircleIcon className={css.feedbackIcon} aria-hidden />
                        <span>Not a match. Next shape.</span>
                     </>
                  )}
               </div>
            )}
         </div>

         <div className={css.options}>
            {shapes.map((shape: string, index: number) => {
               const isSelected = selectedShape === shape;
               const isCorrectSelection = isSelected && correct === true;
               const isIncorrectSelection = isSelected && correct === false;
               const state = isCorrectSelection
                  ? `${css.optCorrect} ${theme.pop}`
                  : isIncorrectSelection
                  ? `${css.optWrong} ${theme.shake}`
                  : selectedShape !== ""
                  ? css.optIdle
                  : "";

               return (
                  <button
                     key={shape}
                     type="button"
                     className={`${css.option} ${state}`}
                     onClick={() => handleShapeClick(shape)}
                     disabled={selectedShape !== ""}
                     aria-label={getShapeDisplayName(shape)}
                  >
                     {(isCorrectSelection || isIncorrectSelection) && (
                        <span
                           className={`${css.badge} ${
                              isCorrectSelection ? css.badgeOk : css.badgeWarn
                           }`}
                           aria-hidden
                        >
                           {isCorrectSelection ? <CheckCircleIcon /> : <XCircleIcon />}
                        </span>
                     )}
                     <span className={css.key} aria-hidden>
                        {keyFor(index)}
                     </span>
                     <span className={css.optIcon} aria-hidden>
                        {getShapeIcon(shape)}
                     </span>
                     <span className={css.name}>{getShapeDisplayName(shape)}</span>
                  </button>
               );
            })}
         </div>
      </div>
   );
}

export default MatchShapes;
