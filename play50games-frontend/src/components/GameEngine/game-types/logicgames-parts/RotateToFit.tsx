"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
   TrophyIcon,
   SparklesIcon,
   CheckCircleIcon,
   ArrowLeftIcon,
   ArrowRightIcon,
   XCircleIcon,
   FireIcon,
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
   const [objects, setObjects] = useState<
      Array<{ shape: string; rotation: number; targetRotation: number }>
   >([]);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const completionCalledRef = useRef(false);
   const roundCompleteRef = useRef<number | null>(null);
   const roundAdvanceScheduledRef = useRef(false);
   const [roundSolvedTick, setRoundSolvedTick] = useState(0);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);
   const onRoundCompleteRef = useRef(onRoundComplete);

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
      const iconStyle = {
         width: size,
         height: size,
         color: "var(--accent)",
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
      }> = [];

      // Create objects with random shapes and target rotations
      for (let i = 0; i < objectCount; i++) {
         const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
         const targetRotation = getTargetRotation();
         newObjects.push({
            shape: randomShape,
            rotation: 0,
            targetRotation: targetRotation,
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

            switch (rotationType) {
               case "right90":
                  newRotation = (currentRotation + 90) % 360;
                  break;
               case "left90":
                  newRotation = (currentRotation - 90 + 360) % 360;
                  break;
               case "right180":
                  newRotation = (currentRotation + 180) % 360;
                  break;
               case "left180":
                  newRotation = (currentRotation - 180 + 360) % 360;
                  break;
            }

            newObjects[objectIndex] = {
               ...currentObj,
               rotation: newRotation,
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
               setTimeout(() => {
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
   const progress = (round / rounds) * 100;

   return (
      <div className="rotate-to-fit-game">
         {/* Header */}
         <div className="game-header">
            <div className="header-title">
               <PuzzlePieceIcon className="title-icon" />
               <h2>Rotate to Fit</h2>
               <FireIcon className="title-icon-secondary" />
            </div>
            <div className="header-stats">
               <div className="stat-item">
                  <ArrowPathIcon className="stat-icon" />
                  <span>
                     Round {round} / {rounds}
                  </span>
               </div>
               <div className="stat-item">
                  <TrophyIcon className="stat-icon" />
                  <span>
                     Score: {score} / {rounds * 5}
                  </span>
               </div>
               <div className="stat-item">
                  <SparklesIcon className="stat-icon" />
                  <span>Objects: {objects.length}</span>
               </div>
            </div>
            <div className="progress-bar-container">
               <div
                  style={{
                     width: `${progress}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "4px",
                     transition: "width 0.3s",
                     boxShadow: "rgba(125, 211, 252, 0.5) 0px 0px 10px",
                  }}
               />
            </div>
         </div>

         {/* Objects Container */}
         <div className="objects-container">
            {objects.map((obj, index) => {
               const isCorrect = obj.rotation === obj.targetRotation;
               const isSelected = selectedObjectIndex === index;
               return (
                  <div
                     key={index}
                     className={`object-item ${isSelected ? "selected" : ""} ${
                        isCorrect ? "correct" : ""
                     }`}
                  >
                     <div className="object-header">
                        <span className="object-number">
                           Object {index + 1}
                           {isSelected && (
                              <span className="selected-badge">⌂</span>
                           )}
                        </span>
                        {isCorrect && (
                           <CheckCircleIcon className="object-check-icon" />
                        )}
                     </div>
                     <div className="object-display">
                        <div className="object-target">
                           <div className="object-label">Target</div>
                           <div className="target-outline">
                              <div
                                 className="target-shape"
                                 style={{
                                    transform: `rotate(${obj.targetRotation}deg)`,
                                 }}
                              >
                                 {getShapeIcon(obj.shape, 100)}
                              </div>
                           </div>
                        </div>
                        <div className="object-rotation">
                           <div className="object-label">Your Shape</div>
                           <div className="rotation-area">
                              <div
                                 className={`rotatable-shape ${
                                    isCorrect ? "correct" : ""
                                 }`}
                                 style={{
                                    ["--rotation" as any]: `${obj.rotation}deg`,
                                 }}
                              >
                                 {getShapeIcon(obj.shape, 100)}
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className="object-controls">
                        <button
                           className="object-rotate-btn"
                           onClick={() => handleObjectRotate(index, "left90")}
                           disabled={isCorrect}
                           title={`Rotate Left 90°${
                              isSelected ? " (← or A)" : ""
                           }`}
                        >
                           <ArrowLeftIcon className="btn-icon" />
                           <span>Left 90°</span>
                           {isSelected && (
                              <span className="keyboard-hint">← / A</span>
                           )}
                        </button>
                        <button
                           className="object-rotate-btn"
                           onClick={() => handleObjectRotate(index, "right90")}
                           disabled={isCorrect}
                           title={`Rotate Right 90°${
                              isSelected ? " (→ or D)" : ""
                           }`}
                        >
                           <ArrowRightIcon className="btn-icon" />
                           <span>Right 90°</span>
                           {isSelected && (
                              <span className="keyboard-hint">→ / D</span>
                           )}
                        </button>
                        <button
                           className="object-rotate-btn"
                           onClick={() => handleObjectRotate(index, "left180")}
                           disabled={isCorrect}
                           title={`Rotate Left 180°${
                              isSelected ? " (↑ or W)" : ""
                           }`}
                        >
                           <ArrowPathIcon className="btn-icon" />
                           <span>Left 180°</span>
                           {isSelected && (
                              <span className="keyboard-hint">↑ / W</span>
                           )}
                        </button>
                        <button
                           className="object-rotate-btn"
                           onClick={() => handleObjectRotate(index, "right180")}
                           disabled={isCorrect}
                           title={`Rotate Right 180°${
                              isSelected ? " (↓ or S)" : ""
                           }`}
                        >
                           <ArrowPathIcon className="btn-icon" />
                           <span>Right 180°</span>
                           {isSelected && (
                              <span className="keyboard-hint">↓ / S</span>
                           )}
                        </button>
                     </div>
                  </div>
               );
            })}
         </div>

         {/* Feedback Message */}
         {feedback !== null && (
            <div
               style={{
                  padding: "16px 24px",
                  borderRadius: "12px",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  animation: "slideIn 0.3s ease-out",
                  background:
                     feedback === "correct"
                        ? "rgba(134, 239, 172, 0.2)"
                        : "rgba(252, 165, 165, 0.2)",
                  border: `1px solid ${
                     feedback === "correct" ? "var(--ok)" : "var(--warn)"
                  }`,
                  color: feedback === "correct" ? "var(--ok)" : "var(--warn)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
               }}
            >
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon style={{ width: 24, height: 24 }} />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon style={{ width: 24, height: 24 }} />
                     <span>Try again! You can do it!</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
}

export default RotateToFit;
