"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import theme from "./theme.module.css";
import css from "./RotateToFit.module.css";
import {
   HandThumbUpIcon,
   PuzzlePieceIcon,
   GlobeAmericasIcon,
   LightBulbIcon,
   FunnelIcon,
   CakeIcon,
   LockClosedIcon,
   ChevronDoubleRightIcon,
   ArrowUturnLeftIcon,
   BuildingOffice2Icon,
   ArrowPathRoundedSquareIcon,
   ArrowPathIcon,
   CheckCircleIcon,
   ArrowLeftIcon,
   ArrowRightIcon,
} from "@heroicons/react/24/outline";

function RotateToFit({
   config,
   currentRound = 1,
   maxRounds = 20,
   currentScore = 0,
   onScoreUpdate,
   onComplete,
   onRoundComplete,
}: {
   config: Record<string, any>;
   currentRound?: number;
   maxRounds?: number;
   currentScore?: number;
   onScoreUpdate: (score: number) => void;
   onComplete?: (finalScore?: number) => void;
   onRoundComplete?: () => void;
}) {
   const rounds = config?.rounds || maxRounds;
   // Use currentRound prop directly instead of local state to avoid sync issues
   const round = Math.min(currentRound, rounds);
   const score = currentScore;

   // Object structure: { shape: string, rotation: number, targetRotation: number }
   // spin: look only, the cumulative turn drawn on screen (rotation wraps 270 -> 0, which made the
   // CSS transition spin the shape three quarters backwards); rules read rotation, never spin
   const [objects, setObjects] = useState<
      Array<{ shape: string; rotation: number; targetRotation: number; spin?: number }>
   >([]);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const completionCalledRef = useRef(false);
   const roundCompleteRef = useRef<number | null>(null);
   const roundAdvanceScheduledRef = useRef(false);
   const [roundSolvedTick, setRoundSolvedTick] = useState(0);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);
   const onRoundCompleteRef = useRef(onRoundComplete);
   // the delayed onComplete after the last round; cleared if the game unmounts first
   const completeTimerRef = useRef<number | null>(null);
   useEffect(
      () => () => {
         if (completeTimerRef.current !== null) window.clearTimeout(completeTimerRef.current);
      },
      []
   );

   // Update refs when callbacks change
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
      onRoundCompleteRef.current = onRoundComplete;
   }, [onScoreUpdate, onComplete, onRoundComplete]);

   // Default shapes from Heroicons
   const defaultShapes = [
      "HandThumbUp",
      "PuzzlePiece",
      "GlobeAmericas",
      "LightBulb",
      "Funnel",
      "Cake",
      "LockClosed",
      "ChevronDoubleRight",
      "ArrowUturnLeft",
      "BuildingOffice2",
   ];

   // Get shapes from config or use defaults (memoized to prevent infinite loops)
   const availableShapes = useMemo(() => {
      return config?.shapes || defaultShapes;
   }, [config?.shapes]);

   const getTargetRotation = useCallback((): number => {
      const options = [90, 180, 270];
      return options[Math.floor(Math.random() * options.length)];
   }, []);

   // Get object count based on round (memoized to prevent infinite loops)
   const getObjectCount = useCallback(
      (roundNumber: number): number => {
         if (config?.objectCountRules) {
            // Use custom rules from config
            const rules = config.objectCountRules.sort(
               (a: any, b: any) => b.rounds - a.rounds
            );
            for (const rule of rules) {
               if (roundNumber <= rule.rounds) {
                  return rule.count;
               }
            }
            return rules[rules.length - 1]?.count || 3;
         }
         // Default rules: 1-5: 3, 6-10: 4, 11-15: 5, 16+: 5
         if (roundNumber <= 5) return 3;
         if (roundNumber <= 10) return 4;
         if (roundNumber <= 15) return 5;
         return 5;
      },
      [config?.objectCountRules]
   );

   // Get icon component by name (Heroicons)
   const getShapeIcon = (shapeName: string, size: number = 120) => {
      // colour comes from the module (accent, ok once it fits; gold in final games through --accent)
      const iconStyle = {
         width: size,
         height: size,
      };

      // Map shape names to Heroicon components
      const iconMap: Record<string, React.ComponentType<any>> = {
         HandThumbUp: HandThumbUpIcon,
         PuzzlePiece: PuzzlePieceIcon,
         GlobeAmericas: GlobeAmericasIcon,
         LightBulb: LightBulbIcon,
         Funnel: FunnelIcon,
         Cake: CakeIcon,
         LockClosed: LockClosedIcon,
         ChevronDoubleRight: ChevronDoubleRightIcon,
         ArrowUturnLeft: ArrowUturnLeftIcon,
         BuildingOffice2: BuildingOffice2Icon,
      };

      const IconComponent = iconMap[shapeName];

      if (IconComponent) {
         return <IconComponent style={iconStyle} />;
      }

      // Fallback to ArrowPathRoundedSquareIcon
      return <ArrowPathRoundedSquareIcon style={iconStyle} />;
   };

   // Initialize new round
   const startNewRound = useCallback(() => {
      const objectCount = getObjectCount(round);
      const newObjects: Array<{
         shape: string;
         rotation: number;
         targetRotation: number;
      }> = [];

      // Create objects with random shapes and target rotations
      for (let i = 0; i < objectCount; i++) {
         const randomShape =
            availableShapes[Math.floor(Math.random() * availableShapes.length)];
         const targetRotation = getTargetRotation();
         newObjects.push({
            shape: randomShape,
            rotation: 0,
            targetRotation: targetRotation,
         });
      }

      setObjects(newObjects);
      setFeedback(null);
   }, [round, getObjectCount, availableShapes]);

   // Initialize first round and when round changes
   useEffect(() => {
      // Calculate object count based on round
      let objectCount: number = 3; // Default
      if (config?.objectCountRules && Array.isArray(config.objectCountRules)) {
         // Sort rules by rounds in ascending order
         const rules = [...config.objectCountRules].sort(
            (a: any, b: any) => a.rounds - b.rounds
         );
         // Find the first rule where round <= rule.rounds
         for (const rule of rules) {
            if (round <= rule.rounds) {
               objectCount = rule.count;
               break;
            }
         }
         // If no rule matches, use the last rule's count
         if (objectCount === 3 && rules.length > 0) {
            objectCount = rules[rules.length - 1]?.count || 3;
         }
      } else {
         // Default rules: 1-5: 3, 6-10: 4, 11-15: 5, 16+: 5
         if (round <= 5) objectCount = 3;
         else if (round <= 10) objectCount = 4;
         else if (round <= 15) objectCount = 5;
         else objectCount = 5;
      }

      // Get shapes from config or use defaults
      const shapes = config?.shapes || defaultShapes;

      const newObjects: Array<{
         shape: string;
         rotation: number;
         targetRotation: number;
         spin?: number;
      }> = [];

      // Create objects with random shapes and target rotations
      for (let i = 0; i < objectCount; i++) {
         const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
         const targetRotation = getTargetRotation();
         newObjects.push({
            shape: randomShape,
            rotation: 0,
            targetRotation: targetRotation,
            spin: 0,
         });
      }

      setObjects(newObjects);
      setFeedback(null);
      setSelectedObjectIndex(0); // Reset selection when round changes
      roundCompleteRef.current = null;
      roundAdvanceScheduledRef.current = false;
      completionCalledRef.current = false; // Reset completion flag when round changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [round]);

   // Selected object index for keyboard controls
   const [selectedObjectIndex, setSelectedObjectIndex] = useState<number>(0);

   // Handle rotation for a specific object
   const handleObjectRotate = useCallback(
      (
         objectIndex: number,
         rotationType: "right90" | "left90" | "right180" | "left180"
      ) => {
         setObjects((currentObjects) => {
            const newObjects = [...currentObjects];
            const currentObj = newObjects[objectIndex];

            // Don't rotate if object is already correct (stay correct)
            if (currentObj.rotation === currentObj.targetRotation) {
               return currentObjects; // Return unchanged
            }

            const currentRotation = currentObj.rotation;
            let newRotation = currentRotation;
            let turn = 0; // look only: the drawn turn

            switch (rotationType) {
               case "right90":
                  newRotation = (currentRotation + 90) % 360;
                  turn = 90;
                  break;
               case "left90":
                  newRotation = (currentRotation - 90 + 360) % 360;
                  turn = -90;
                  break;
               case "right180":
                  newRotation = (currentRotation + 180) % 360;
                  turn = 180;
                  break;
               case "left180":
                  newRotation = (currentRotation - 180 + 360) % 360;
                  turn = -180;
                  break;
            }

            newObjects[objectIndex] = {
               ...currentObj,
               rotation: newRotation,
               spin: (currentObj.spin ?? currentObj.rotation) + turn,
            };

            // Check if all objects are correct
            const allCorrect = newObjects.every(
               (obj) => obj.rotation === obj.targetRotation
            );

            if (allCorrect) {
               if (
                  roundCompleteRef.current === round ||
                  roundAdvanceScheduledRef.current
               ) {
                  return newObjects;
               }
               roundCompleteRef.current = round;
               roundAdvanceScheduledRef.current = true;
               setFeedback("correct");
               setRoundSolvedTick((prev) => prev + 1);
            } else {
               setFeedback(null);
            }

            return newObjects;
         });
      },
      [round, rounds, currentRound]
   );

   useEffect(() => {
      if (!roundAdvanceScheduledRef.current || roundSolvedTick === 0) return;

      // Mark as processed to prevent re-execution
      roundAdvanceScheduledRef.current = false;

      const roundScore = 5;
      onScoreUpdateRef.current(roundScore);

      const currentRoundValue = Math.min(currentRound, rounds);

      const timer = setTimeout(() => {
         if (currentRoundValue >= rounds) {
            if (!completionCalledRef.current) {
               completionCalledRef.current = true;
               // Use currentScore from closure, not from dependency
               const finalScore = Math.round(
                  ((score + roundScore) / rounds) * 100
               );
               onScoreUpdateRef.current(finalScore);
               completeTimerRef.current = window.setTimeout(() => {
                  completeTimerRef.current = null;
                  onCompleteRef.current?.(finalScore);
               }, 1000);
            }
         } else {
            setSelectedObjectIndex(0);
            if (onRoundCompleteRef.current) {
               onRoundCompleteRef.current();
            }
         }
         setFeedback(null);
      }, 1500);

      return () => clearTimeout(timer);
      // Only depend on roundSolvedTick - other values are captured in closure
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [roundSolvedTick]);

   // Keyboard controls for rotation
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         // Tab key to cycle through objects
         if (e.key === "Tab") {
            e.preventDefault();
            if (objects.length > 0) {
               setSelectedObjectIndex((prevIndex) => {
                  const nextIndex = (prevIndex + 1) % objects.length;
                  return nextIndex;
               });
            }
            return;
         }

         // Number keys 1-5 to select object directly
         if (e.key >= "1" && e.key <= "5") {
            const objectNum = parseInt(e.key) - 1;
            if (objectNum < objects.length) {
               setSelectedObjectIndex(objectNum);
               e.preventDefault();
            }
            return;
         }

         // Arrow keys or WASD to rotate selected object
         if (selectedObjectIndex < objects.length && objects.length > 0) {
            switch (e.key) {
               case "ArrowLeft":
               case "a":
               case "A":
                  handleObjectRotate(selectedObjectIndex, "left90");
                  e.preventDefault();
                  break;
               case "ArrowRight":
               case "d":
               case "D":
                  handleObjectRotate(selectedObjectIndex, "right90");
                  e.preventDefault();
                  break;
               case "ArrowUp":
               case "w":
               case "W":
                  handleObjectRotate(selectedObjectIndex, "left180");
                  e.preventDefault();
                  break;
               case "ArrowDown":
               case "s":
               case "S":
                  handleObjectRotate(selectedObjectIndex, "right180");
                  e.preventDefault();
                  break;
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [selectedObjectIndex, objects.length, handleObjectRotate]);

   // Progress calculation
   const progress = Math.min(1, round / rounds);

   const rotateButtons: Array<{
      type: "left90" | "right90" | "left180" | "right180";
      label: string;
      keys: string;
      title: string;
      Icon: React.ComponentType<any>;
      mirror?: boolean;
   }> = [
      { type: "left90", label: "Left 90°", keys: "← / A", title: "Rotate left 90°", Icon: ArrowLeftIcon },
      { type: "right90", label: "Right 90°", keys: "→ / D", title: "Rotate right 90°", Icon: ArrowRightIcon },
      { type: "left180", label: "Left 180°", keys: "↑ / W", title: "Rotate left 180°", Icon: ArrowPathIcon, mirror: true },
      { type: "right180", label: "Right 180°", keys: "↓ / S", title: "Rotate right 180°", Icon: ArrowPathIcon },
   ];

   // global class names (rotate-to-fit-game, game-header, header-title h2, stat-item, progress-bar-container,
   // object-item / selected, selected-badge, target-outline, object-rotate-btn, btn-icon, keyboard-hint)
   // stay on their elements: globals.css paints the final games gold through them
   return (
      <div className={`rotate-to-fit-game ${theme.game} ${css.root}`}>
         {/* Header */}
         <div className={`game-header ${css.header}`}>
            <div className={`header-title ${css.headerTitle}`}>
               <h2 className={`${theme.title} ${css.title}`}>Rotate to Fit</h2>
            </div>
            <p className={theme.subtitle}>Turn each shape until it matches its target.</p>
            <div className={theme.chips}>
               <div className={`stat-item ${theme.chip} ${css.stat}`}>
                  <span>
                     Round <strong>{round}</strong> / {rounds}
                  </span>
               </div>
               <div className={`stat-item ${theme.chip} ${css.stat}`}>
                  <span>
                     Score <strong>{score}</strong> / {rounds * 5}
                  </span>
               </div>
               <div className={`stat-item ${theme.chip} ${css.stat}`}>
                  <span>
                     Shapes <strong>{objects.length}</strong>
                  </span>
               </div>
            </div>
            <div
               className={`progress-bar-container ${css.progress}`}
               role="progressbar"
               aria-valuemin={0}
               aria-valuemax={rounds}
               aria-valuenow={round}
               aria-label="Round progress"
            >
               <div className={css.progressFill} style={{ transform: `scaleX(${progress})` }} />
            </div>
         </div>

         {/* Objects: keyed by round, so each round's set staggers in once */}
         <div className={css.objects}>
            {objects.map((obj, index) => {
               const isCorrect = obj.rotation === obj.targetRotation;
               const isSelected = selectedObjectIndex === index;
               return (
                  <div
                     key={`${round}-${index}`}
                     className={[
                        "object-item",
                        isSelected ? "selected" : "",
                        css.item,
                        isSelected ? css.itemSelected : "",
                        isCorrect ? css.itemCorrect : "",
                     ]
                        .filter(Boolean)
                        .join(" ")}
                     style={{ ["--i" as any]: index }}
                  >
                     <div className={css.itemHead}>
                        <span className={css.itemName}>
                           Shape {index + 1}
                           {isSelected && (
                              <span className={`selected-badge ${css.badge}`}>Keys</span>
                           )}
                        </span>
                        {isCorrect ? (
                           <span className={`${css.status} ${css.statusOk} ${theme.pop}`}>
                              <CheckCircleIcon className={css.statusIcon} aria-hidden="true" />
                              Fits
                           </span>
                        ) : (
                           <span className={css.status}>Not yet</span>
                        )}
                     </div>
                     <div className={css.pair}>
                        <div className={css.slot}>
                           <div className={css.label}>Target</div>
                           <div className={`target-outline ${css.box} ${css.boxTarget}`}>
                              <div
                                 className={css.shape}
                                 style={{ transform: `rotate(${obj.targetRotation}deg)` }}
                              >
                                 {getShapeIcon(obj.shape, 100)}
                              </div>
                           </div>
                        </div>
                        <div className={css.slot}>
                           <div className={css.label}>Your shape</div>
                           <div
                              className={`${css.box} ${isCorrect ? `${css.boxOk} ${theme.pop}` : ""}`}
                           >
                              <div
                                 className={`${css.shape} ${css.turning}`}
                                 style={{ transform: `rotate(${obj.spin ?? obj.rotation}deg)` }}
                              >
                                 {getShapeIcon(obj.shape, 100)}
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className={css.controls}>
                        {rotateButtons.map(({ type, label, keys, title, Icon, mirror }) => (
                           <button
                              key={type}
                              type="button"
                              className={`object-rotate-btn ${theme.btn} ${css.rotBtn}`}
                              onClick={() => handleObjectRotate(index, type)}
                              disabled={isCorrect}
                              title={`${title}${isSelected ? ` (${keys})` : ""}`}
                              aria-label={`Shape ${index + 1}: ${title}`}
                           >
                              <Icon
                                 className={`btn-icon ${css.btnIcon} ${mirror ? css.mirrorIcon : ""}`}
                                 aria-hidden="true"
                              />
                              <span>{label}</span>
                              {isSelected && <span className={`keyboard-hint ${css.hint}`}>{keys}</span>}
                           </button>
                        ))}
                     </div>
                  </div>
               );
            })}
         </div>

         {/* Feedback: a fixed slot so nothing jumps when it shows */}
         <div className={theme.feedbackSlot} aria-live="polite">
            {feedback !== null && (
               <div
                  className={`${theme.feedback} ${
                     feedback === "correct"
                        ? `${theme.feedbackOk} ${theme.pop}`
                        : `${theme.feedbackWarn} ${theme.shake}`
                  }`}
               >
                  {feedback === "correct" ? "Every shape fits. +5 points" : "Not quite. Keep turning."}
               </div>
            )}
         </div>
      </div>
   );
}

export default RotateToFit;
