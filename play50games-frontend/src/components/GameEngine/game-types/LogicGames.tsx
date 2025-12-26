"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import NumberKeypad from "../NumberKeypad";
import * as ReactIcons from "react-icons/fa";
import * as ReactIconsMd from "react-icons/md";
import * as ReactIconsIo from "react-icons/io5";
import {
   CheckCircleIcon,
   XCircleIcon,
   TrophyIcon,
   ClockIcon,
   ArrowPathIcon,
   ArrowPathRoundedSquareIcon,
   ScaleIcon,
   ArrowLeftIcon,
   ArrowRightIcon,
   ArrowUpIcon,
   ArrowDownIcon,
   CircleStackIcon,
   InformationCircleIcon,
   XMarkIcon,
   Square2StackIcon,
   StarIcon,
   HeartIcon,
   PlusIcon,
   MoonIcon,
   CubeIcon,
   StopIcon,
   BellIcon,
   CameraIcon,
   FingerPrintIcon,
   EyeIcon,
   HomeIcon,
   KeyIcon,
   GiftIcon,
   LightBulbIcon,
   ShareIcon,
   ClipboardDocumentIcon,
   BoltIcon,
   SunIcon,
   PuzzlePieceIcon,
   SparklesIcon,
   FireIcon,
   HandThumbUpIcon,
   GlobeAmericasIcon,
   FunnelIcon,
   CakeIcon,
   LockClosedIcon,
   ChevronDoubleRightIcon,
   ArrowUturnLeftIcon,
   BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import {
   useKeyboardControls,
   createKeyboardMapping,
} from "@/hooks/useKeyboardControls";

interface LogicGamesProps {
   config: Record<string, any>;
   gameTitle?: string;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

// Map game titles to gameType as fallback
const titleToGameType: Record<string, string> = {
   "balance the scale": "balance-scale",
   "match the shapes": "match-shapes",
   "color sequence": "color-sequence",
   "number order": "number-order",
   "find the odd one": "find-odd-one",
   "tile slider": "tile-slider",
   "light switch puzzle": "circuit-path",
   "circuit path": "circuit-path",
   "maze escape": "maze-escape",
   "pattern completion": "pattern-completion",
   "sudoku 4x4": "sudoku-4x4",
   "rotate to fit": "rotate-to-fit",
   "mirror match": "mirror-match",
   "logic gates": "logic-gates",
   "sequence arrows": "sequence-arrows",
   "block fill": "block-fill",
};

export default function LogicGames({
   config,
   gameTitle,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: LogicGamesProps) {
   const [currentGame, setCurrentGame] = useState<string>("");
   const [score, setScore] = useState(0);
   const [round, setRound] = useState(0);
   const rotateToFitAdvanceRef = useRef<number | null>(null);

   // Determine max rounds based on game type
   // Balance the Scale, Match Shapes, Maze Escape, and Pattern Completion should have 20 rounds by default
   const getMaxRounds = () => {
      // Check for totalRounds first (new format), then rounds (backward compatibility)
      if (config.totalRounds) return config.totalRounds;
      if (config.rounds) return config.rounds;
      const gameType = config.gameType || currentGame;
      if (
         gameType === "balance-scale" ||
         gameType === "match-shapes" ||
         gameType === "maze-escape" ||
         gameType === "pattern-completion" ||
         gameTitle?.toLowerCase().includes("balance") ||
         gameTitle?.toLowerCase().includes("match") ||
         gameTitle?.toLowerCase().includes("maze") ||
         gameTitle?.toLowerCase().includes("pattern")
      ) {
         return 20;
      }
      return 5;
   };
   const maxRounds = getMaxRounds();

   useEffect(() => {
      if (!isPlaying) return;

      // Determine which logic game to play based on config
      let gameType = config.gameType;

      // Fallback: try to determine from game title if gameType is missing
      if (!gameType && gameTitle) {
         const titleLower = gameTitle.toLowerCase();
         gameType = titleToGameType[titleLower] || "match-shapes";
      }

      // Final fallback
      if (!gameType) {
         gameType = "match-shapes";
      }

      setCurrentGame(gameType);
      setRound(0);
      setScore(0);
      rotateToFitAdvanceRef.current = null;
   }, [isPlaying, config, gameTitle]);

   useEffect(() => {
      if (round >= maxRounds && isPlaying) {
         // Calculate final score
         // For balance-scale with 20 rounds: score is already 0-100 (5 points per round * 20 = 100 max)
         // For other games: calculate percentage
         const isBalanceScale =
            currentGame === "balance-scale" ||
            gameTitle?.toLowerCase().includes("balance");
         const isMazeEscape = currentGame === "maze-escape";
         const finalScore =
            isBalanceScale && maxRounds === 20
               ? score // Already 0-100 (5 points per round * 20 rounds = 100 max)
               : isMazeEscape && maxRounds === 20
               ? Math.round((score / (maxRounds * 100)) * 100) // Maze Escape: score is 0-2000, convert to 0-100
               : Math.round((score / maxRounds) * 100);

         console.log("[LogicGames] Final score calculation:", {
            round,
            maxRounds,
            score,
            finalScore,
            currentGame,
            isBalanceScale,
            gameTitle,
         });

         onScoreUpdate(finalScore);
         // Pass the final score directly to onComplete
         onComplete(finalScore);
      }
   }, [
      round,
      maxRounds,
      score,
      isPlaying,
      onScoreUpdate,
      onComplete,
      currentGame,
      gameTitle,
   ]);

   const gameComponents: Record<string, JSX.Element> = {
      "match-shapes": (
         <MatchShapes
            config={config}
            onScoreUpdate={(s) => {
               // MatchShapes manages its own rounds and score internally
               // This callback is for updating parent score
               setScore(s);
            }}
            onComplete={onComplete}
         />
      ),
      "color-sequence": (
         <ColorSequence
            config={config}
            onScoreUpdate={(s) => {
               // ColorSequence manages its own rounds and score internally
               // This callback is for updating parent score
               setScore(s);
            }}
            onComplete={onComplete}
         />
      ),
      "number-order": (
         <NumberOrder
            config={config}
            onScoreUpdate={(s) => {
               // NumberOrder manages its own rounds and score internally
               // This callback is for updating parent score
               setScore(s);
            }}
            onComplete={onComplete}
         />
      ),
      "find-odd-one": (
         <FindOddOne
            config={config}
            onScoreUpdate={(s) => {
               setScore(s);
            }}
            onComplete={onComplete}
         />
      ),
      "tile-slider": (
         <TileSlider
            config={config}
            passingScore={passingScore}
            onScoreUpdate={(s) => {
               // Tile Slider sends final score directly, not incremental
               setScore(s);
            }}
            onComplete={onComplete}
         />
      ),
      "balance-scale": (
         <BalanceScale
            config={config}
            currentRound={round + 1}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               // Add score and move to next round
               const newScore = score + s;
               const newRound = round + 1;
               setScore(newScore);
               setRound(newRound);
               console.log("[BalanceScale] Round update:", {
                  round: newRound,
                  score: newScore,
                  pointsAdded: s,
                  maxRounds,
               });
            }}
         />
      ),
      "light-switch": (
         <CircuitPath
            config={config}
            currentRound={round + 1}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               // CircuitPath reports the running total score
               setScore(s);
            }}
            onComplete={onComplete}
            onRoundComplete={() => {
               setRound((prev) => prev + 1);
            }}
         />
      ),
      "circuit-path": (
         <CircuitPath
            config={config}
            currentRound={round + 1}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               // CircuitPath reports the running total score
               setScore(s);
            }}
            onComplete={onComplete}
            onRoundComplete={() => {
               setRound((prev) => prev + 1);
            }}
         />
      ),
      "maze-escape": (
         <MazeEscape
            config={config}
            currentRound={round + 1}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               // Add score only - round will be updated by onRoundComplete
               const newScore = score + s;
               setScore(newScore);
               console.log("[MazeEscape] Score update:", {
                  currentRound: round + 1,
                  score: newScore,
                  pointsAdded: s,
                  maxRounds,
               });
            }}
            onComplete={onComplete}
            onRoundComplete={() => {
               // Move to next round
               console.log(
                  "[MazeEscape] onRoundComplete called in LogicGames, current round:",
                  round
               );
               setRound((prev) => {
                  const nextRound = prev + 1;
                  console.log(
                     "[MazeEscape] Updating round from",
                     prev,
                     "to",
                     nextRound
                  );
                  return nextRound;
               });
            }}
         />
      ),
      "pattern-completion": (
         <PatternCompletion
            config={config}
            currentRound={round + 1}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               // Add score and move to next round
               const newScore = score + s;
               setScore(newScore);
               setRound(round + 1);
            }}
            onComplete={onComplete}
         />
      ),
      "sudoku-4x4": (
         <Sudoku4x4
            config={config}
            onScoreUpdate={(s) => {
               setScore(score + s);
               setRound(round + 1);
            }}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "rotate-to-fit": (
         <RotateToFit
            config={config}
            currentRound={Math.min(round + 1, maxRounds)}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               setScore(score + s);
               // Don't increment round here - RotateToFit manages its own round
            }}
            onRoundComplete={() => {
               setRound((prevRound) => {
                  if (rotateToFitAdvanceRef.current === prevRound) {
                     return prevRound;
                  }
                  rotateToFitAdvanceRef.current = prevRound;
                  const nextRound = prevRound + 1;
                  // Don't exceed maxRounds (round starts at 0, so maxRounds = 20 means rounds 0-19 = rounds 1-20)
                  if (nextRound >= maxRounds) {
                     return prevRound;
                  }
                  return nextRound;
               });
            }}
            onComplete={onComplete}
         />
      ),
      "mirror-match": (
         <MirrorMatch
            config={config}
            onScoreUpdate={(s) => {
               setScore(score + s);
               setRound(round + 1);
            }}
         />
      ),
      "logic-gates": (
         <LogicGates
            config={config}
            onScoreUpdate={(s) => {
               setScore(score + s);
               setRound(round + 1);
            }}
         />
      ),
      "sequence-arrows": (
         <SequenceArrows
            config={config}
            onScoreUpdate={(s) => {
               setScore(score + s);
               setRound(round + 1);
            }}
         />
      ),
      "block-fill": (
         <BlockFill
            config={config}
            onScoreUpdate={(s) => {
               setScore(score + s);
               setRound(round + 1);
            }}
            onComplete={onComplete}
         />
      ),
   };

   return (
      gameComponents[currentGame] || (
         <div>Game "{currentGame}" not found. Loading default...</div>
      )
   );
}

// Modern Match the Shapes Game with 20 rounds
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
function getShapeIcon(shape: string, size: number = 80) {
   const iconStyle = {
      width: size,
      height: size,
      color: "var(--accent)",
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

      setTimeout(() => {
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

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            padding: "24px",
            maxWidth: "600px",
            margin: "0 auto",
         }}
      >
         {/* Header with Round and Score */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: "16px",
               padding: "20px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            <div
               style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.875rem",
                  color: "var(--muted)",
                  fontWeight: 500,
                  marginBottom: "12px",
               }}
            >
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <ArrowPathIcon
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                  />
                  Round {currentRound + 1} / {maxRounds}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <TrophyIcon
                     style={{ width: 16, height: 16, color: "var(--ok)" }}
                  />
                  Score: {currentScore} / {maxRounds * 5}
               </span>
            </div>
            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  position: "relative",
               }}
            >
               <div
                  style={{
                     width: `${((currentRound + 1) / maxRounds) * 100}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "4px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Target Shape */}
         <div
            style={{
               background: "var(--card)",
               border: "2px solid var(--stroke)",
               borderRadius: "20px",
               padding: "40px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
               minHeight: "200px",
               display: "flex",
               alignItems: "center",
               justifyContent: "center",
               position: "relative",
            }}
         >
            <div
               style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  background: "rgba(125, 211, 252, 0.2)",
                  borderRadius: "50%",
                  padding: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
               }}
            >
               <SparklesIcon
                  style={{ width: 20, height: 20, color: "var(--accent)" }}
               />
            </div>
            <div
               style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "16px",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     animation: "pulse 2s ease-in-out infinite",
                  }}
               >
                  {getShapeIcon(targetShape, 120)}
               </div>
               <span
                  style={{
                     fontSize: "1.1rem",
                     fontWeight: 700,
                     color: "var(--accent)",
                  }}
               >
                  {getShapeDisplayName(targetShape)}
               </span>
            </div>
         </div>

         {/* Shape Options */}
         <div
            style={{
               display: "grid",
               gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
               gap: "20px",
               width: "100%",
            }}
         >
            {shapes.map((shape: string, index: number) => {
               const isSelected = selectedShape === shape;
               const isCorrectSelection = isSelected && correct === true;
               const isIncorrectSelection = isSelected && correct === false;

               // Get keyboard number for this shape (1-12)
               const getKeyboardNumber = (idx: number): string => {
                  if (idx < 9) return String(idx + 1); // 1-9
                  if (idx === 9) return "0"; // 10th shape
                  if (idx === 10) return "-"; // 11th shape
                  return "="; // 12th shape
               };

               return (
                  <button
                     key={shape}
                     onClick={() => handleShapeClick(shape)}
                     disabled={selectedShape !== ""}
                     style={{
                        background: isCorrectSelection
                           ? "linear-gradient(135deg, rgba(134,239,172,0.3) 0%, rgba(134,239,172,0.1) 100%)"
                           : isIncorrectSelection
                           ? "linear-gradient(135deg, rgba(252,165,165,0.3) 0%, rgba(252,165,165,0.1) 100%)"
                           : "var(--card)",
                        border: isCorrectSelection
                           ? "2px solid var(--ok)"
                           : isIncorrectSelection
                           ? "2px solid var(--warn)"
                           : "2px solid var(--stroke)",
                        borderRadius: "16px",
                        cursor:
                           selectedShape !== "" ? "not-allowed" : "pointer",
                        transition: "all 0.3s ease",
                        transform: isSelected ? "scale(0.95)" : "scale(1)",
                        boxShadow: isSelected
                           ? "0 8px 20px rgba(125, 211, 252, 0.4)"
                           : "0 4px 12px rgba(0, 0, 0, 0.2)",
                        opacity: selectedShape !== "" && !isSelected ? 0.5 : 1,
                     }}
                     onMouseEnter={(e) => {
                        if (selectedShape === "") {
                           e.currentTarget.style.transform = "scale(1.05)";
                           e.currentTarget.style.boxShadow =
                              "0 8px 20px rgba(125, 211, 252, 0.4)";
                        }
                     }}
                     onMouseLeave={(e) => {
                        if (selectedShape === "") {
                           e.currentTarget.style.transform = "scale(1)";
                           e.currentTarget.style.boxShadow =
                              "0 4px 12px rgba(0, 0, 0, 0.2)";
                        }
                     }}
                  >
                     <div
                        style={{
                           display: "flex",
                           flexDirection: "column",
                           alignItems: "center",
                           gap: "12px",
                           position: "relative",
                        }}
                     >
                        {isCorrectSelection && (
                           <div
                              style={{
                                 position: "absolute",
                                 top: "-8px",
                                 right: "-8px",
                                 background: "var(--ok)",
                                 borderRadius: "50%",
                                 padding: "4px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 zIndex: 10,
                                 boxShadow:
                                    "0 4px 12px rgba(134, 239, 172, 0.5)",
                              }}
                           >
                              <CheckCircleIcon
                                 style={{
                                    width: 20,
                                    height: 20,
                                    color: "var(--bg)",
                                 }}
                              />
                           </div>
                        )}
                        {isIncorrectSelection && (
                           <div
                              style={{
                                 position: "absolute",
                                 top: "-8px",
                                 right: "-8px",
                                 background: "var(--warn)",
                                 borderRadius: "50%",
                                 padding: "4px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 zIndex: 10,
                                 boxShadow:
                                    "0 4px 12px rgba(252, 165, 165, 0.5)",
                              }}
                           >
                              <XCircleIcon
                                 style={{
                                    width: 20,
                                    height: 20,
                                    color: "var(--bg)",
                                 }}
                              />
                           </div>
                        )}
                        <div
                           style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                           }}
                        >
                           {getShapeIcon(shape, 80)}
                        </div>
                        <div
                           style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "4px",
                           }}
                        >
                           <span
                              style={{
                                 fontSize: "0.75rem",
                                 fontWeight: 500,
                                 color: "var(--accent)",
                                 background: "rgba(125, 211, 252, 0.1)",
                                 border: "1px solid var(--stroke)",
                                 borderRadius: "4px",
                                 padding: "2px 6px",
                                 fontFamily: "monospace",
                              }}
                           >
                              {(() => {
                                 if (index < 9) return String(index + 1); // 1-9
                                 if (index === 9) return "0"; // 10th shape
                                 if (index === 10) return "-"; // 11th shape
                                 return "="; // 12th shape
                              })()}
                           </span>
                           <span
                              style={{
                                 fontSize: "0.875rem",
                                 fontWeight: 600,
                                 color: "var(--muted)",
                              }}
                           >
                              {getShapeDisplayName(shape)}
                           </span>
                        </div>
                     </div>
                  </button>
               );
            })}
         </div>

         {/* Feedback Message */}
         {correct !== null && (
            <div
               style={{
                  padding: "16px 24px",
                  borderRadius: "12px",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  animation: "slideIn 0.3s ease-out",
                  background: correct
                     ? "rgba(134, 239, 172, 0.2)"
                     : "rgba(252, 165, 165, 0.2)",
                  border: `1px solid ${correct ? "var(--ok)" : "var(--warn)"}`,
                  color: correct ? "var(--ok)" : "var(--warn)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
               }}
            >
               {correct ? (
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

// Modern Color Sequence Game with 20 rounds - Simplified and Clear
function ColorSequence({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const colors = config.colors || ["red", "blue", "green", "yellow"];
   const maxRounds = config.rounds || 20;
   const [sequence, setSequence] = useState<string[]>([]);
   const [playerSequence, setPlayerSequence] = useState<string[]>([]);
   const [showingSequence, setShowingSequence] = useState(true);
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

   useEffect(() => {
      // Start first round
      startNewRound();
   }, []);

   const startNewRound = () => {
      // Sequence length increases gradually: round 1-5 = 2 colors, 6-10 = 3, 11-15 = 4, 16-20 = 5
      const roundNumber = currentRound + 1;
      let sequenceLength = 2;
      if (roundNumber > 15) sequenceLength = 5;
      else if (roundNumber > 10) sequenceLength = 4;
      else if (roundNumber > 5) sequenceLength = 3;

      const newSequence = [];
      for (let i = 0; i < sequenceLength; i++) {
         newSequence.push(colors[Math.floor(Math.random() * colors.length)]);
      }
      setSequence(newSequence);
      setPlayerSequence([]);
      setShowingSequence(true);
      setFeedback(null);

      // Show sequence - each color flashes for 800ms
      setTimeout(() => {
         setShowingSequence(false);
      }, sequenceLength * 800 + 500); // 800ms per color + 500ms buffer
   };

   const handleColorClick = useCallback(
      (color: string) => {
         if (showingSequence) return;

         const newPlayerSequence = [...playerSequence, color];
         setPlayerSequence(newPlayerSequence);

         // Check if sequence is complete
         if (newPlayerSequence.length === sequence.length) {
            const isCorrect = newPlayerSequence.every(
               (c, i) => c === sequence[i]
            );
            setFeedback(isCorrect ? "correct" : "wrong");

            const nextRound = currentRound + 1;
            const points = isCorrect ? 5 : 0; // 5 points per correct round
            const newScore = currentScore + points;

            setCurrentScore(newScore);
            setCurrentRound(nextRound);
            onScoreUpdate(newScore);

            setTimeout(() => {
               if (nextRound >= maxRounds) {
                  // Game complete
                  onComplete(newScore);
               } else {
                  // Continue to next round
                  startNewRound();
               }
            }, 1500);
         }
      },
      [
         showingSequence,
         playerSequence,
         sequence,
         currentRound,
         currentScore,
         maxRounds,
         onScoreUpdate,
         onComplete,
      ]
   );

   // Keyboard controls for Color Sequence
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         if (showingSequence) return;

         const key = e.key;
         let colorIndex = -1;

         if (key >= "1" && key <= "4") {
            colorIndex = parseInt(key) - 1; // 1-4 → 0-3
         }

         if (colorIndex >= 0 && colorIndex < colors.length) {
            e.preventDefault();
            handleColorClick(colors[colorIndex]);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [showingSequence, colors, handleColorClick]);

   const getColorStyle = (color: string) => {
      const colorMap: Record<
         string,
         { bg: string; border: string; shadow: string }
      > = {
         red: {
            bg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            border: "#ef4444",
            shadow: "rgba(239, 68, 68, 0.4)",
         },
         blue: {
            bg: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            border: "#3b82f6",
            shadow: "rgba(59, 130, 246, 0.4)",
         },
         green: {
            bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            border: "#10b981",
            shadow: "rgba(16, 185, 129, 0.4)",
         },
         yellow: {
            bg: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            border: "#f59e0b",
            shadow: "rgba(245, 158, 11, 0.4)",
         },
      };
      return colorMap[color] || colorMap.red;
   };

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            padding: "24px",
            maxWidth: "600px",
            margin: "0 auto",
         }}
      >
         {/* Modern Header */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: "16px",
               padding: "20px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            <h3
               style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  margin: "0 0 16px 0",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
               }}
            >
               <SparklesIcon
                  style={{ width: 28, height: 28, color: "var(--accent)" }}
               />
               Color Sequence
            </h3>

            <div
               style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.875rem",
                  color: "var(--muted)",
                  fontWeight: 500,
                  marginBottom: "12px",
               }}
            >
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <ArrowPathIcon
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                  />
                  Round {currentRound} / {maxRounds}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <TrophyIcon
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                  />
                  Score: {currentScore} / {maxRounds * 5}
               </span>
            </div>

            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  position: "relative",
               }}
            >
               <div
                  style={{
                     width: `${(currentRound / maxRounds) * 100}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "4px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Sequence Display or Color Options */}
         {showingSequence ? (
            <div
               style={{
                  background: "var(--card)",
                  border: "2px solid var(--stroke)",
                  borderRadius: "20px",
                  padding: "40px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                  minHeight: "200px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "24px",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "12px",
                     fontSize: "1.1rem",
                     fontWeight: 600,
                     color: "var(--muted)",
                  }}
               >
                  <ClockIcon style={{ width: 20, height: 20 }} />
                  Watch the sequence carefully...
               </div>
               <div
                  style={{
                     fontSize: "0.875rem",
                     color: "var(--accent)",
                     fontWeight: 600,
                     marginTop: "8px",
                  }}
               >
                  Round {currentRound + 1} - {sequence.length}{" "}
                  {sequence.length === 1 ? "color" : "colors"} to remember
               </div>
               <div
                  style={{
                     display: "flex",
                     gap: "16px",
                     flexWrap: "wrap",
                     justifyContent: "center",
                  }}
               >
                  {sequence.map((color, index) => {
                     const colorStyle = getColorStyle(color);
                     return (
                        <div
                           key={index}
                           style={{
                              width: "80px",
                              height: "80px",
                              borderRadius: "16px",
                              background: colorStyle.bg,
                              border: `3px solid ${colorStyle.border}`,
                              boxShadow: `0 8px 20px ${colorStyle.shadow}`,
                              animation: `pulse 0.6s ease-in-out ${
                                 index * 0.6
                              }s`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "white",
                              textTransform: "uppercase",
                              letterSpacing: "1px",
                           }}
                        >
                           {index + 1}
                        </div>
                     );
                  })}
               </div>
            </div>
         ) : (
            <div
               style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "24px",
                  width: "100%",
               }}
            >
               <div
                  style={{
                     background: "var(--card)",
                     border: "2px solid var(--stroke)",
                     borderRadius: "20px",
                     padding: "24px",
                     boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                     width: "100%",
                  }}
               >
                  <div
                     style={{
                        fontSize: "1rem",
                        fontWeight: 600,
                        color: "var(--muted)",
                        marginBottom: "20px",
                        textAlign: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                     }}
                  >
                     <SparklesIcon style={{ width: 18, height: 18 }} />
                     Repeat the sequence
                  </div>
                  <div
                     style={{
                        fontSize: "0.875rem",
                        color: "var(--accent)",
                        fontWeight: 500,
                     }}
                  >
                     Click colors in the same order
                  </div>
                  <div
                     style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "20px",
                        maxWidth: "400px",
                        margin: "0 auto",
                     }}
                  >
                     {colors.map((color: string, index: number) => {
                        const colorStyle = getColorStyle(color);
                        const isSelected =
                           playerSequence.length > 0 &&
                           playerSequence[playerSequence.length - 1] === color;
                        return (
                           <button
                              key={color}
                              onClick={() => handleColorClick(color)}
                              disabled={showingSequence}
                              style={{
                                 width: "100%",
                                 aspectRatio: "1",
                                 borderRadius: "16px",
                                 background: colorStyle.bg,
                                 border: `3px solid ${colorStyle.border}`,
                                 boxShadow: isSelected
                                    ? `0 12px 30px ${colorStyle.shadow}`
                                    : `0 4px 12px ${colorStyle.shadow}`,
                                 cursor: showingSequence
                                    ? "not-allowed"
                                    : "pointer",
                                 transition: "all 0.3s ease",
                                 transform: isSelected
                                    ? "scale(0.95)"
                                    : "scale(1)",
                                 display: "flex",
                                 flexDirection: "column",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 gap: "8px",
                                 position: "relative",
                              }}
                              onMouseEnter={(e) => {
                                 if (!showingSequence) {
                                    e.currentTarget.style.transform =
                                       "scale(1.05)";
                                    e.currentTarget.style.boxShadow = `0 12px 30px ${colorStyle.shadow}`;
                                 }
                              }}
                              onMouseLeave={(e) => {
                                 if (!showingSequence) {
                                    e.currentTarget.style.transform =
                                       "scale(1)";
                                    e.currentTarget.style.boxShadow = `0 4px 12px ${colorStyle.shadow}`;
                                 }
                              }}
                           >
                              <span
                                 style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 500,
                                    color: "white",
                                    background: "rgba(0, 0, 0, 0.2)",
                                    border:
                                       "1px solid rgba(255, 255, 255, 0.3)",
                                    borderRadius: "4px",
                                    padding: "2px 8px",
                                    fontFamily: "monospace",
                                 }}
                              >
                                 {index + 1}
                              </span>
                              <span
                                 style={{
                                    fontSize: "0.875rem",
                                    fontWeight: 700,
                                    color: "white",
                                    textTransform: "uppercase",
                                    letterSpacing: "1px",
                                 }}
                              >
                                 {color}
                              </span>
                           </button>
                        );
                     })}
                  </div>
                  {playerSequence.length > 0 && (
                     <div
                        style={{
                           marginTop: "20px",
                           display: "flex",
                           gap: "8px",
                           justifyContent: "center",
                           flexWrap: "wrap",
                        }}
                     >
                        {playerSequence.map((color, index) => {
                           const colorStyle = getColorStyle(color);
                           return (
                              <div
                                 key={index}
                                 style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "8px",
                                    background: colorStyle.bg,
                                    border: `2px solid ${colorStyle.border}`,
                                    boxShadow: `0 4px 12px ${colorStyle.shadow}`,
                                 }}
                              />
                           );
                        })}
                     </div>
                  )}
               </div>
            </div>
         )}

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
                     <span>Correct! Great job! +5 points</span>
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

// Modern Number Order Game with 20 rounds
function NumberOrder({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const maxRounds = config.rounds || 20;
   const [shuffled, setShuffled] = useState<number[]>([]);
   const [selected, setSelected] = useState<number[]>([]);
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [currentNumbers, setCurrentNumbers] = useState(3); // Start with 3 numbers
   const [isLoading, setIsLoading] = useState(true); // Prevent showing old numbers during transition

   const startNewRound = useCallback(
      (roundNumber: number) => {
         // Hide numbers during transition - clear immediately
         setIsLoading(true);
         setShuffled([]); // Clear old numbers immediately
         setSelected([]);
         setFeedback(null);

         // Determine number count based on round
         let numCount = 3; // Rounds 1-5: 3 numbers
         if (roundNumber > 10) {
            numCount = 10; // Rounds 11-20: 10 numbers
         } else if (roundNumber > 5) {
            numCount = 5; // Rounds 6-10: 5 numbers
         }

         // Update currentNumbers and shuffle in the same batch
         const nums = Array.from({ length: numCount }, (_, i) => i + 1);
         // Create shuffled array once and store it
         const newShuffled = [...nums].sort(() => Math.random() - 0.5);

         // Set everything in one batch to prevent double update
         setTimeout(() => {
            setCurrentNumbers(numCount);
            setShuffled(newShuffled);
            setIsLoading(false);
         }, 100);
      },
      [] // Empty dependencies - function never changes
   );

   useEffect(() => {
      // Start first round only once
      startNewRound(1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []); // Empty dependency array - only run once on mount

   const handleNumberClick = useCallback(
      (num: number) => {
         if (selected.includes(num)) return;
         const newSelected = [...selected, num];
         setSelected(newSelected);

         if (newSelected.length === currentNumbers) {
            const isCorrect = newSelected.every((n, i) => n === i + 1);
            setFeedback(isCorrect ? "correct" : "wrong");

            const nextRound = currentRound + 1;
            const points = isCorrect ? 5 : 0; // 5 points per correct round
            const newScore = currentScore + points;

            setCurrentScore(newScore);
            setCurrentRound(nextRound);
            onScoreUpdate(newScore);

            setTimeout(() => {
               if (nextRound >= maxRounds) {
                  // Game complete
                  onComplete(newScore);
               } else {
                  // Continue to next round - pass nextRound to calculate correct number count
                  startNewRound(nextRound);
               }
            }, 800); // Faster transition
         }
      },
      [
         selected,
         currentNumbers,
         currentRound,
         currentScore,
         maxRounds,
         onScoreUpdate,
         onComplete,
         startNewRound,
      ]
   );

   // Remove last selected number (undo)
   const handleUndo = useCallback(() => {
      if (selected.length > 0) {
         setSelected((prev) => prev.slice(0, -1));
         setFeedback(null);
      }
   }, [selected.length]);

   // Keyboard controls for Number Order
   // Note: Keyboard selects by POSITION in grid, not value (e.g., press "1" to select first number in grid, press "2" to select second number in grid)
   // For positions 1-9: press 1-9
   // For position 10: press 0
   // Backspace/Delete: Remove last selected number
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         const key = e.key;

         // Backspace or Delete: Remove last selected number
         if (key === "Backspace" || key === "Delete") {
            if (selected.length > 0) {
               e.preventDefault();
               handleUndo();
            }
            return;
         }

         let position = -1;

         // Positions 1-9: press 1-9
         if (key >= "1" && key <= "9") {
            position = parseInt(key) - 1; // Convert to 0-based index
         }
         // Position 10: press 0
         else if (key === "0" && currentNumbers >= 10) {
            position = 9; // 10th position is index 9
         }

         // Select the number by its POSITION in the grid, not value
         if (
            position >= 0 &&
            position < shuffled.length &&
            !selected.includes(shuffled[position])
         ) {
            e.preventDefault();
            handleNumberClick(shuffled[position]);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [selected, currentNumbers, shuffled, handleNumberClick, handleUndo]);

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            padding: "24px",
            maxWidth: "600px",
            margin: "0 auto",
         }}
      >
         {/* Modern Header */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: "16px",
               padding: "20px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            <h3
               style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  margin: "0 0 16px 0",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
               }}
            >
               <SparklesIcon
                  style={{ width: 28, height: 28, color: "var(--accent)" }}
               />
               Number Order
            </h3>

            <div
               style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.875rem",
                  color: "var(--muted)",
                  fontWeight: 500,
                  marginBottom: "12px",
               }}
            >
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <ArrowPathIcon
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                  />
                  Round {currentRound + 1} / {maxRounds}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <TrophyIcon
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                  />
                  Score: {currentScore} / {maxRounds * 5}
               </span>
            </div>

            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  position: "relative",
               }}
            >
               <div
                  style={{
                     width: `${((currentRound + 1) / maxRounds) * 100}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "4px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Instructions */}
         <div
            style={{
               background: "var(--card)",
               border: "2px solid var(--stroke)",
               borderRadius: "16px",
               padding: "20px",
               boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
               width: "100%",
               textAlign: "center",
            }}
         >
            <div
               style={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "var(--muted)",
                  marginBottom: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
               }}
            >
               <SparklesIcon style={{ width: 18, height: 18 }} />
               Click numbers from smallest to largest
            </div>
            <div
               style={{
                  fontSize: "0.875rem",
                  color: "var(--accent)",
                  fontWeight: 500,
               }}
            >
               Select {currentNumbers} numbers in order (1, 2, 3...)
            </div>
         </div>

         {/* Number Grid */}
         {isLoading || shuffled.length === 0 ? (
            <div
               style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "16px",
                  width: "100%",
                  maxWidth: "500px",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: "100px",
               }}
            >
               <div
                  style={{
                     fontSize: "0.875rem",
                     color: "var(--muted)",
                     fontWeight: 500,
                  }}
               >
                  Loading next round...
               </div>
            </div>
         ) : (
            <div
               style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "16px",
                  width: "100%",
                  maxWidth: "500px",
                  justifyContent: "center",
                  alignItems: "center",
               }}
            >
               {shuffled.map((num) => {
                  const isSelected = selected.includes(num);
                  const selectionIndex = selected.indexOf(num);
                  const isCorrectOrder =
                     selectionIndex >= 0 &&
                     selected[selectionIndex] === selectionIndex + 1;

                  return (
                     <button
                        key={num}
                        onClick={() => handleNumberClick(num)}
                        disabled={isSelected}
                        style={{
                           width: "60px",
                           height: "60px",
                           borderRadius: "12px",
                           background: isSelected
                              ? isCorrectOrder
                                 ? "linear-gradient(135deg, rgba(134,239,172,0.4) 0%, rgba(134,239,172,0.2) 100%)"
                                 : "linear-gradient(135deg, rgba(252,165,165,0.4) 0%, rgba(252,165,165,0.2) 100%)"
                              : "linear-gradient(135deg, rgba(125, 211, 252, 0.4) 0%, rgba(125, 211, 252, 0.2) 100%)",
                           border: isSelected
                              ? isCorrectOrder
                                 ? "2px solid var(--ok)"
                                 : "2px solid var(--warn)"
                              : "2px solid var(--accent)",
                           boxShadow: isSelected
                              ? isCorrectOrder
                                 ? "rgba(134, 239, 172, 0.3) 0px 6px 20px"
                                 : "rgba(252, 165, 165, 0.3) 0px 6px 20px"
                              : "rgba(125, 211, 252, 0.3) 0px 6px 20px",
                           cursor: isSelected ? "not-allowed" : "pointer",
                           transition: "0.3s",
                           transform: isSelected ? "scale(0.95)" : "scale(1)",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           position: "relative",
                           fontSize: "1.8rem",
                           fontWeight: 700,
                           color: isSelected
                              ? isCorrectOrder
                                 ? "var(--ok)"
                                 : "var(--warn)"
                              : "var(--accent)",
                        }}
                        onMouseEnter={(e) => {
                           if (!isSelected) {
                              e.currentTarget.style.transform = "scale(1.05)";
                              e.currentTarget.style.boxShadow =
                                 "rgba(125, 211, 252, 0.5) 0px 8px 24px";
                           }
                        }}
                        onMouseLeave={(e) => {
                           if (!isSelected) {
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.boxShadow =
                                 "rgba(125, 211, 252, 0.3) 0px 6px 20px";
                           }
                        }}
                     >
                        {num}
                     </button>
                  );
               })}
            </div>
         )}

         {/* Selected Numbers Preview */}
         {selected.length > 0 && (
            <div
               style={{
                  background: "var(--card)",
                  border: "2px solid var(--stroke)",
                  borderRadius: "16px",
                  padding: "16px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                  width: "100%",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     justifyContent: "space-between",
                     alignItems: "center",
                     marginBottom: "12px",
                  }}
               >
                  <div
                     style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--muted)",
                     }}
                  >
                     Your selection:
                  </div>
                  <button
                     onClick={handleUndo}
                     style={{
                        background: "var(--warn)",
                        border: "1px solid var(--warn)",
                        borderRadius: "8px",
                        padding: "6px 12px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "white",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                     }}
                     onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--warn)";
                        e.currentTarget.style.opacity = "0.9";
                        e.currentTarget.style.transform = "scale(1.05)";
                     }}
                     onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--warn)";
                        e.currentTarget.style.opacity = "1";
                        e.currentTarget.style.transform = "scale(1)";
                     }}
                  >
                     <XMarkIcon style={{ width: 14, height: 14 }} />
                     Undo
                  </button>
               </div>
               <div
                  style={{
                     display: "flex",
                     gap: "8px",
                     justifyContent: "center",
                     flexWrap: "wrap",
                  }}
               >
                  {selected.map((num, index) => {
                     const isCorrect = num === index + 1;
                     return (
                        <div
                           key={index}
                           style={{
                              width: "50px",
                              height: "50px",
                              borderRadius: "12px",
                              background: isCorrect
                                 ? "linear-gradient(135deg, var(--ok) 0%, #10b981 100%)"
                                 : "linear-gradient(135deg, var(--warn) 0%, #ef4444 100%)",
                              border: `2px solid ${
                                 isCorrect ? "var(--ok)" : "var(--warn)"
                              }`,
                              boxShadow: isCorrect
                                 ? "0 4px 12px rgba(134, 239, 172, 0.4)"
                                 : "0 4px 12px rgba(252, 165, 165, 0.4)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "1.25rem",
                              fontWeight: 700,
                              color: "white",
                           }}
                        >
                           {num}
                        </div>
                     );
                  })}
               </div>
            </div>
         )}

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
                     <span>Correct! Great job! +5 points</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon style={{ width: 24, height: 24 }} />
                     <span>Wrong order! Try again next round!</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
}

// Modern Find the Odd One Game with Heroicons
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

   // Determine item count based on round
   const getItemCount = (round: number) => {
      if (round < 5) return 10; // Rounds 1-5: 10 items
      if (round < 10) return 30; // Rounds 6-10: 30 items
      return 50; // Rounds 11+: 50 items
   };

   // Determine icon size based on item count and screen size
   const getIconSize = (
      count: number,
      isMobile: boolean,
      isTablet: boolean
   ) => {
      if (isMobile) {
         if (count >= 50) return 24; // Very small for 50 items on mobile
         if (count >= 30) return 28; // Small for 30 items on mobile
         return 40; // Normal for 10 items on mobile
      }
      if (isTablet) {
         if (count >= 50) return 28; // Small for 50 items on tablet
         if (count >= 30) return 36; // Medium for 30 items on tablet
         return 50; // Normal for 10 items on tablet
      }
      if (count >= 50) return 32; // Very small for 50 items
      if (count >= 30) return 40; // Small for 30 items
      return 60; // Normal for 10 items
   };

   // Determine grid columns based on item count and screen size
   const getGridColumns = (
      count: number,
      isMobile: boolean,
      isTablet: boolean
   ) => {
      if (isMobile) {
         if (count === 10) return 3; // 3x4 grid for 10 items on mobile
         if (count === 30) return 4; // 4x8 grid for 30 items on mobile
         return 5; // 5x10 grid for 50 items on mobile
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

         setTimeout(() => {
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
   const iconSize = getIconSize(itemCount, isMobile, isTablet);
   const gridColumns = getGridColumns(itemCount, isMobile, isTablet);

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: isMobile ? "12px" : isTablet ? "16px" : "24px",
            width: "100%",
            maxWidth: "1200px",
            margin: "0 auto",
            padding: isMobile ? "12px" : isTablet ? "16px" : "20px",
         }}
      >
         {/* Header */}
         <div
            style={{
               display: "flex",
               flexDirection: isMobile ? "column" : "row",
               justifyContent: "space-between",
               alignItems: "center",
               gap: isMobile ? "8px" : isTablet ? "12px" : "0",
               width: "100%",
               background: "var(--card)",
               border: "2px solid var(--stroke)",
               borderRadius: isMobile ? "12px" : isTablet ? "14px" : "16px",
               padding: isMobile
                  ? "12px 16px"
                  : isTablet
                  ? "14px 20px"
                  : "16px 24px",
               boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
         >
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: isMobile
                     ? "0.875rem"
                     : isTablet
                     ? "0.9375rem"
                     : "1rem",
                  fontWeight: 600,
                  color: "var(--text)",
               }}
            >
               <ArrowPathIcon
                  style={{
                     width: isMobile ? 16 : isTablet ? 18 : 20,
                     height: isMobile ? 16 : isTablet ? 18 : 20,
                  }}
               />
               Round {currentRound + 1} / {maxRounds}
            </div>
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: isMobile
                     ? "0.875rem"
                     : isTablet
                     ? "0.9375rem"
                     : "1rem",
                  fontWeight: 600,
                  color: "var(--accent)",
               }}
            >
               <TrophyIcon
                  style={{
                     width: isMobile ? 16 : isTablet ? 18 : 20,
                     height: isMobile ? 16 : isTablet ? 18 : 20,
                  }}
               />
               Score: {currentScore} / {maxRounds * 5}
            </div>
         </div>

         {/* Progress Bar */}
         <div
            style={{
               width: "100%",
               height: "8px",
               background: "var(--stroke)",
               borderRadius: "4px",
               overflow: "hidden",
            }}
         >
            <div
               style={{
                  width: `${((currentRound + 1) / maxRounds) * 100}%`,
                  height: "100%",
                  background:
                     "linear-gradient(90deg, var(--accent) 0%, var(--secondary) 100%)",
                  transition: "width 0.3s ease",
               }}
            />
         </div>

         {/* Instructions */}
         <div
            style={{
               background: "var(--card)",
               border: "2px solid var(--stroke)",
               borderRadius: isMobile ? "12px" : isTablet ? "14px" : "16px",
               padding: isMobile ? "12px" : isTablet ? "14px" : "16px",
               boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
               width: "100%",
               textAlign: "center",
            }}
         >
            <div
               style={{
                  fontSize: isMobile
                     ? "0.875rem"
                     : isTablet
                     ? "0.9375rem"
                     : "1rem",
                  fontWeight: 600,
                  color: "var(--muted)",
                  marginBottom: isMobile ? "4px" : isTablet ? "6px" : "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
               }}
            >
               <SparklesIcon
                  style={{
                     width: isMobile ? 16 : isTablet ? 17 : 18,
                     height: isMobile ? 16 : isTablet ? 17 : 18,
                  }}
               />
               Find the odd one out
            </div>
            <div
               style={{
                  fontSize: isMobile
                     ? "0.75rem"
                     : isTablet
                     ? "0.8125rem"
                     : "0.875rem",
                  color: "var(--accent)",
                  fontWeight: 500,
               }}
            >
               Click on the icon that is different from the others
            </div>
         </div>

         {/* Grid */}
         <div
            style={{
               display: "grid",
               gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
               gap: isMobile
                  ? itemCount >= 50
                     ? "4px"
                     : itemCount >= 30
                     ? "6px"
                     : "8px"
                  : isTablet
                  ? itemCount >= 50
                     ? "6px"
                     : itemCount >= 30
                     ? "10px"
                     : "12px"
                  : itemCount >= 50
                  ? "8px"
                  : itemCount >= 30
                  ? "12px"
                  : "16px",
               width: "100%",
               maxWidth: isMobile
                  ? "100%"
                  : isTablet
                  ? itemCount >= 50
                     ? "700px"
                     : itemCount >= 30
                     ? "800px"
                     : "500px"
                  : itemCount >= 50
                  ? "800px"
                  : itemCount >= 30
                  ? "900px"
                  : "600px",
            }}
         >
            {items.map((item) => {
               const isSelected = selected === item.id;
               const isCorrect = item.isOdd && isSelected;
               const isWrong = !item.isOdd && isSelected;

               return (
                  <button
                     key={item.id}
                     onClick={() => handleClick(item.id)}
                     disabled={selected !== null}
                     style={{
                        aspectRatio: "1",
                        background: isSelected
                           ? isCorrect
                              ? "linear-gradient(135deg, rgba(134,239,172,0.4) 0%, rgba(134,239,172,0.2) 100%)"
                              : "linear-gradient(135deg, rgba(252,165,165,0.4) 0%, rgba(252,165,165,0.2) 100%)"
                           : "linear-gradient(135deg, rgba(125, 211, 252, 0.1) 0%, rgba(125, 211, 252, 0.05) 100%)",
                        border: isSelected
                           ? isCorrect
                              ? isMobile
                                 ? "2px solid var(--ok)"
                                 : isTablet
                                 ? "2.5px solid var(--ok)"
                                 : "3px solid var(--ok)"
                              : isMobile
                              ? "2px solid var(--warn)"
                              : isTablet
                              ? "2.5px solid var(--warn)"
                              : "3px solid var(--warn)"
                           : isMobile
                           ? "1px solid var(--stroke)"
                           : isTablet
                           ? "1.5px solid var(--stroke)"
                           : "2px solid var(--stroke)",
                        borderRadius: isMobile
                           ? "8px"
                           : isTablet
                           ? "10px"
                           : "12px",
                        cursor: selected !== null ? "not-allowed" : "pointer",
                        transition: "all 0.3s ease",
                        transform: isSelected ? "scale(0.95)" : "scale(1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        boxShadow: isSelected
                           ? isCorrect
                              ? "rgba(134, 239, 172, 0.3) 0px 6px 20px"
                              : "rgba(252, 165, 165, 0.3) 0px 6px 20px"
                           : "0 2px 8px rgba(0, 0, 0, 0.1)",
                     }}
                     onMouseEnter={(e) => {
                        if (selected === null) {
                           e.currentTarget.style.transform = "scale(1.05)";
                           e.currentTarget.style.boxShadow =
                              "rgba(125, 211, 252, 0.3) 0px 8px 24px";
                        }
                     }}
                     onMouseLeave={(e) => {
                        if (selected === null) {
                           e.currentTarget.style.transform = "scale(1)";
                           e.currentTarget.style.boxShadow =
                              "0 2px 8px rgba(0, 0, 0, 0.1)";
                        }
                     }}
                  >
                     {getShapeIcon(item.icon, iconSize)}
                     {isSelected && (
                        <div
                           style={{
                              position: "absolute",
                              top: isMobile ? "2px" : isTablet ? "3px" : "4px",
                              right: isMobile
                                 ? "2px"
                                 : isTablet
                                 ? "3px"
                                 : "4px",
                              background: isCorrect
                                 ? "var(--ok)"
                                 : "var(--warn)",
                              borderRadius: "50%",
                              width: isMobile
                                 ? "18px"
                                 : isTablet
                                 ? "21px"
                                 : "24px",
                              height: isMobile
                                 ? "18px"
                                 : isTablet
                                 ? "21px"
                                 : "24px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                           }}
                        >
                           {isCorrect ? (
                              <CheckCircleIcon
                                 style={{
                                    width: isMobile ? 12 : isTablet ? 14 : 16,
                                    height: isMobile ? 12 : isTablet ? 14 : 16,
                                    color: "white",
                                 }}
                              />
                           ) : (
                              <XCircleIcon
                                 style={{
                                    width: isMobile ? 12 : isTablet ? 14 : 16,
                                    height: isMobile ? 12 : isTablet ? 14 : 16,
                                    color: "white",
                                 }}
                              />
                           )}
                        </div>
                     )}
                  </button>
               );
            })}
         </div>

         {/* Feedback */}
         {feedback && (
            <div
               style={{
                  background:
                     feedback === "correct" ? "var(--ok)" : "var(--warn)",
                  color: "white",
                  padding: isMobile
                     ? "10px 16px"
                     : isTablet
                     ? "11px 20px"
                     : "12px 24px",
                  borderRadius: isMobile ? "10px" : isTablet ? "11px" : "12px",
                  fontSize: isMobile
                     ? "0.875rem"
                     : isTablet
                     ? "0.9375rem"
                     : "1rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : isTablet ? "7px" : "8px",
                  animation: "slideUp 0.3s ease",
                  textAlign: "center",
               }}
            >
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon
                        style={{
                           width: isMobile ? 18 : isTablet ? 19 : 20,
                           height: isMobile ? 18 : isTablet ? 19 : 20,
                        }}
                     />
                     {isMobile
                        ? "Correct!"
                        : isTablet
                        ? "Correct!"
                        : "Correct! Great job!"}
                  </>
               ) : (
                  <>
                     <XCircleIcon
                        style={{
                           width: isMobile ? 18 : isTablet ? 19 : 20,
                           height: isMobile ? 18 : isTablet ? 19 : 20,
                        }}
                     />
                     {isMobile
                        ? "Wrong!"
                        : isTablet
                        ? "Wrong!"
                        : "Wrong! Try again next round."}
                  </>
               )}
            </div>
         )}
      </div>
   );
}

// Modern Tile Slider Game (5)
function TileSlider({
   config,
   onScoreUpdate,
   onComplete,
   passingScore = 70, // Default passing score
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   passingScore?: number;
}) {
   const gridSize = config.gridSize || 3;
   const showHints = config.showHints !== false; // Default: true
   const total = gridSize * gridSize;
   // Use array with total elements, where null represents empty space
   const [tiles, setTiles] = useState<(number | null)[]>([]);
   const [emptyIndex, setEmptyIndex] = useState(total - 1);
   const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
   const [moves, setMoves] = useState(0);
   const [isAnimating, setIsAnimating] = useState(false);
   const [feedback, setFeedback] = useState<"correct" | null>(null);
   const [showHint, setShowHint] = useState(false);
   const [hintTileIndex, setHintTileIndex] = useState<number | null>(null);
   const [hintSequence, setHintSequence] = useState<number[]>([]); // Track all tiles in sequence
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const completionCalledRef = useRef(false);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);

   // Update refs when callbacks change
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
   }, [onScoreUpdate, onComplete]);

   // Check if user has shared or came from shared link
   useEffect(() => {
      // Check if came from shared link (has tracking parameter)
      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
         // User came from shared link - grant unlimited hints
         setHasShared(true);
         localStorage.setItem("play50games_shared", "true");
         // Remove tracking parameter from URL (clean URL)
         const newUrl =
            window.location.pathname +
            window.location.search
               .replace(/[?&]shared=[^&]*/, "")
               .replace(/^\?/, "");
         window.history.replaceState(
            {},
            "",
            newUrl || window.location.pathname
         );
      } else {
         // Check if user has shared before
         const shared = localStorage.getItem("play50games_shared");
         if (shared === "true") {
            setHasShared(true);
         }
      }
   }, []);

   // Get maxHints from config, handle both number and string, default to 5 if not specified
   const maxHintsConfig =
      config.maxHints !== undefined && config.maxHints !== null
         ? typeof config.maxHints === "string"
            ? parseInt(config.maxHints, 10)
            : config.maxHints
         : 5;
   const maxHints = hasShared ? 0 : maxHintsConfig; // Unlimited if shared, otherwise use config or default: 5 hints

   // Generate shareable link with tracking
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0]; // Remove existing params
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5); // Unique share ID
      return `${currentUrl}?shared=${shareId}`;
   };

   // Handle share via Web Share API or fallback
   const handleShare = async () => {
      const shareableLink = getShareableLink();

      // Try Web Share API first (mobile/desktop)
      if (navigator.share) {
         try {
            await navigator.share({
               title: "Tile Slider Puzzle Game",
               text: "Check out this awesome Tile Slider puzzle game!",
               url: shareableLink,
            });
            // Success - grant unlimited hints
            setHasShared(true);
            setShareSuccess(true);
            localStorage.setItem("play50games_shared", "true");
            setTimeout(() => setShareSuccess(false), 3000);
         } catch (error: any) {
            // User cancelled or error - try copy to clipboard
            if (error.name !== "AbortError") {
               handleCopyLink();
            }
         }
      } else {
         // Fallback: copy to clipboard
         handleCopyLink();
      }
   };

   // Handle copy link to clipboard
   const handleCopyLink = async () => {
      const shareableLink = getShareableLink();
      try {
         await navigator.clipboard.writeText(shareableLink);
         // Success - grant unlimited hints
         setHasShared(true);
         setShareSuccess(true);
         localStorage.setItem("play50games_shared", "true");
         setTimeout(() => setShareSuccess(false), 3000);
      } catch (error) {
         // Fallback for older browsers
         const textArea = document.createElement("textarea");
         textArea.value = shareableLink;
         textArea.style.position = "fixed";
         textArea.style.opacity = "0";
         document.body.appendChild(textArea);
         textArea.select();
         try {
            document.execCommand("copy");
            setHasShared(true);
            setShareSuccess(true);
            localStorage.setItem("play50games_shared", "true");
            setTimeout(() => setShareSuccess(false), 3000);
         } catch (err) {
            console.error("Failed to copy link:", err);
         }
         document.body.removeChild(textArea);
      }
   };

   // Initialize puzzle
   useEffect(() => {
      const generateSolvableTiles = (): {
         tiles: (number | null)[];
         emptyIndex: number;
      } => {
         const solvedTiles: (number | null)[] = [
            ...Array.from({ length: total - 1 }, (_, i) => i + 1),
            null,
         ];
         let currentTiles = [...solvedTiles];
         let currentEmpty = total - 1;
         let lastEmpty = -1;

         const steps = Math.max(20, gridSize * gridSize * 10);
         for (let step = 0; step < steps; step++) {
            const emptyRow = Math.floor(currentEmpty / gridSize);
            const emptyCol = currentEmpty % gridSize;
            const neighbors: number[] = [];

            if (emptyRow > 0)
               neighbors.push((emptyRow - 1) * gridSize + emptyCol);
            if (emptyRow < gridSize - 1)
               neighbors.push((emptyRow + 1) * gridSize + emptyCol);
            if (emptyCol > 0)
               neighbors.push(emptyRow * gridSize + (emptyCol - 1));
            if (emptyCol < gridSize - 1)
               neighbors.push(emptyRow * gridSize + (emptyCol + 1));

            const filtered = neighbors.filter((idx) => idx !== lastEmpty);
            const moveIndex =
               filtered.length > 0
                  ? filtered[Math.floor(Math.random() * filtered.length)]
                  : neighbors[Math.floor(Math.random() * neighbors.length)];

            const tileValue = currentTiles[moveIndex];
            currentTiles[moveIndex] = null;
            currentTiles[currentEmpty] = tileValue ?? null;
            lastEmpty = currentEmpty;
            currentEmpty = moveIndex;
         }

         const isSolved = currentTiles.every((tile, i) => {
            if (i === total - 1) return tile === null;
            return tile === i + 1;
         });
         if (isSolved) {
            const emptyRow = Math.floor(currentEmpty / gridSize);
            const emptyCol = currentEmpty % gridSize;
            const neighbors: number[] = [];
            if (emptyRow > 0)
               neighbors.push((emptyRow - 1) * gridSize + emptyCol);
            if (emptyRow < gridSize - 1)
               neighbors.push((emptyRow + 1) * gridSize + emptyCol);
            if (emptyCol > 0)
               neighbors.push(emptyRow * gridSize + (emptyCol - 1));
            if (emptyCol < gridSize - 1)
               neighbors.push(emptyRow * gridSize + (emptyCol + 1));
            const moveIndex =
               neighbors[Math.floor(Math.random() * neighbors.length)];
            const tileValue = currentTiles[moveIndex];
            currentTiles[moveIndex] = null;
            currentTiles[currentEmpty] = tileValue ?? null;
            currentEmpty = moveIndex;
         }

         return { tiles: currentTiles, emptyIndex: currentEmpty };
      };

      const { tiles: initialTiles, emptyIndex: initialEmpty } =
         generateSolvableTiles();
      setTiles(initialTiles);
      setEmptyIndex(initialEmpty);
      setSelectedIndex(null);
      setMoves(0);
      setFeedback(null);
      setShowHint(false);
      setHintTileIndex(null);
      setHintsUsed(0);
   }, [total]);

   // Check if puzzle is solved
   useEffect(() => {
      if (tiles.length !== total) return;
      if (completionCalledRef.current) return; // Already completed

      // Check if all tiles are in correct position (empty space should be at the end)
      const isSolved = tiles.every((tile, i) => {
         if (i === total - 1) return tile === null; // Last position should be empty
         return tile === i + 1; // Other positions should have correct number
      });

      if (isSolved && moves > 0 && !completionCalledRef.current) {
         completionCalledRef.current = true;

         // Calculate score: 100 points for solving, minus 1 point per move
         // Minimum score: passingScore points for completing (even with many moves)
         // This ensures puzzle completion always gives enough points to pass
         const minScore = Math.max(passingScore, 20); // At least passing score, but minimum 20
         const baseScore = Math.max(minScore, 100 - moves);
         const score = Math.min(100, baseScore); // Cap at 100

         // Show feedback immediately
         setFeedback("correct");

         // Update score immediately (this will trigger progress save)
         // Use a small delay to ensure state is updated before onComplete
         onScoreUpdateRef.current(score);

         // Call onComplete after delay to show feedback and trigger completion modal
         // Pass score explicitly to ensure it's received correctly
         setTimeout(() => {
            // Ensure score is passed correctly
            onCompleteRef.current(score);
         }, 2000); // Increased delay to ensure feedback is visible
      }
   }, [tiles, moves, total]);

   // Reset completion flag when puzzle is reset
   useEffect(() => {
      completionCalledRef.current = false;
   }, [total]);

   const canMove = (index: number) => {
      if (index === emptyIndex) return false; // Can't move empty space
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      const emptyRow = Math.floor(emptyIndex / gridSize);
      const emptyCol = emptyIndex % gridSize;
      return (
         (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
         (col === emptyCol && Math.abs(row - emptyRow) === 1)
      );
   };

   const handleTileClick = useCallback(
      (index: number) => {
         if (isAnimating || tiles.length !== total) return;

         // Check if can move inline
         const row = Math.floor(index / gridSize);
         const col = index % gridSize;
         const emptyRow = Math.floor(emptyIndex / gridSize);
         const emptyCol = emptyIndex % gridSize;
         const canMoveTile =
            (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
            (col === emptyCol && Math.abs(row - emptyRow) === 1);

         if (!canMoveTile || index === emptyIndex) return;

         setIsAnimating(true);
         const newTiles = [...tiles];
         // Swap tile with empty space
         const tileValue = newTiles[index];
         newTiles[index] = null; // Move empty space here
         newTiles[emptyIndex] = tileValue; // Move tile to empty space
         setTiles(newTiles);
         setEmptyIndex(index);
         setMoves((prev) => prev + 1);

         setTimeout(() => {
            setIsAnimating(false);
         }, 300);
      },
      [tiles, emptyIndex, gridSize, total, isAnimating]
   );

   // Keyboard controls: Tab to select, Arrow keys to move selected tile
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         if (isAnimating || feedback || tiles.length !== total) return;

         // Tab key: Cycle through tiles to select
         if (e.key === "Tab") {
            e.preventDefault();
            const nonEmptyTiles = tiles
               .map((tile, index) => ({ tile, index }))
               .filter(({ tile }) => tile !== null)
               .map(({ index }) => index);

            if (nonEmptyTiles.length === 0) return;

            if (selectedIndex === null) {
               // Select first tile
               setSelectedIndex(nonEmptyTiles[0]);
            } else {
               // Find next tile
               const currentPos = nonEmptyTiles.indexOf(selectedIndex);
               const nextPos = (currentPos + 1) % nonEmptyTiles.length;
               setSelectedIndex(nonEmptyTiles[nextPos]);
            }
            return;
         }

         // Arrow keys: Move selected tile if it's adjacent to empty space
         if (selectedIndex !== null && tiles[selectedIndex] !== null) {
            const selectedRow = Math.floor(selectedIndex / gridSize);
            const selectedCol = selectedIndex % gridSize;
            const emptyRow = Math.floor(emptyIndex / gridSize);
            const emptyCol = emptyIndex % gridSize;

            // Check if selected tile is adjacent to empty space
            const isAdjacent =
               (selectedRow === emptyRow &&
                  Math.abs(selectedCol - emptyCol) === 1) ||
               (selectedCol === emptyCol &&
                  Math.abs(selectedRow - emptyRow) === 1);

            if (isAdjacent) {
               let shouldMove = false;

               switch (e.key) {
                  case "ArrowUp":
                  case "w":
                  case "W":
                     // Move up: selected tile must be below empty space
                     shouldMove = selectedRow > emptyRow;
                     break;
                  case "ArrowDown":
                  case "s":
                  case "S":
                     // Move down: selected tile must be above empty space
                     shouldMove = selectedRow < emptyRow;
                     break;
                  case "ArrowLeft":
                  case "a":
                  case "A":
                     // Move left: selected tile must be to the right of empty space
                     shouldMove = selectedCol > emptyCol;
                     break;
                  case "ArrowRight":
                  case "d":
                  case "D":
                     // Move right: selected tile must be to the left of empty space
                     shouldMove = selectedCol < emptyCol;
                     break;
               }

               if (shouldMove) {
                  e.preventDefault();
                  handleTileClick(selectedIndex);
                  setSelectedIndex(null); // Deselect after moving
               }
            }
         } else {
            // If no tile selected, use old behavior: move tiles adjacent to empty space
            const emptyRow = Math.floor(emptyIndex / gridSize);
            const emptyCol = emptyIndex % gridSize;
            let targetIndex = -1;

            switch (e.key) {
               case "ArrowUp":
               case "w":
               case "W":
                  if (emptyRow < gridSize - 1) {
                     targetIndex = (emptyRow + 1) * gridSize + emptyCol;
                  }
                  break;
               case "ArrowDown":
               case "s":
               case "S":
                  if (emptyRow > 0) {
                     targetIndex = (emptyRow - 1) * gridSize + emptyCol;
                  }
                  break;
               case "ArrowLeft":
               case "a":
               case "A":
                  if (emptyCol < gridSize - 1) {
                     targetIndex = emptyRow * gridSize + (emptyCol + 1);
                  }
                  break;
               case "ArrowRight":
               case "d":
               case "D":
                  if (emptyCol > 0) {
                     targetIndex = emptyRow * gridSize + (emptyCol - 1);
                  }
                  break;
            }

            if (
               targetIndex >= 0 &&
               targetIndex < total &&
               tiles[targetIndex] !== null
            ) {
               const row = Math.floor(targetIndex / gridSize);
               const col = targetIndex % gridSize;
               const canMoveTile =
                  (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
                  (col === emptyCol && Math.abs(row - emptyRow) === 1);

               if (canMoveTile) {
                  e.preventDefault();
                  handleTileClick(targetIndex);
               }
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [
      emptyIndex,
      gridSize,
      total,
      isAnimating,
      feedback,
      tiles,
      selectedIndex,
      handleTileClick,
   ]);

   // Calculate progress (how many tiles are in correct position)
   const getProgress = () => {
      if (tiles.length !== total) return 0;
      let correct = 0;
      tiles.forEach((tile, i) => {
         if (i === total - 1) {
            // Empty space should be at the end
            if (tile === null) correct++;
         } else {
            // Other tiles should have correct number
            if (tile === i + 1) correct++;
         }
      });
      return (correct / total) * 100;
   };

   // Calculate puzzle score (lower is better, 0 = solved)
   const calculatePuzzleScore = (
      currentTiles: (number | null)[],
      currentEmpty: number
   ) => {
      let score = 0;
      for (let i = 0; i < total; i++) {
         if (i === currentEmpty) continue;
         const tileValue = currentTiles[i];
         if (tileValue === null) continue;
         const correctPos = tileValue - 1;
         if (i !== correctPos) {
            const currentRow = Math.floor(i / gridSize);
            const currentCol = i % gridSize;
            const correctRow = Math.floor(correctPos / gridSize);
            const correctCol = correctPos % gridSize;
            // Manhattan distance
            score +=
               Math.abs(currentRow - correctRow) +
               Math.abs(currentCol - correctCol);
         }
      }
      return score;
   };

   // Simulate a move and return new state
   const simulateMove = (
      currentTiles: (number | null)[],
      currentEmpty: number,
      tileIndex: number
   ): { tiles: (number | null)[]; emptyIndex: number } | null => {
      if (tileIndex === currentEmpty) return null;
      if (currentTiles[tileIndex] === null) return null; // Can't move empty space

      const row = Math.floor(tileIndex / gridSize);
      const col = tileIndex % gridSize;
      const emptyRow = Math.floor(currentEmpty / gridSize);
      const emptyCol = currentEmpty % gridSize;
      const canMoveTile =
         (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
         (col === emptyCol && Math.abs(row - emptyRow) === 1);

      if (!canMoveTile) return null;

      const newTiles = [...currentTiles];
      const tileValue = newTiles[tileIndex];
      newTiles[tileIndex] = null;
      newTiles[currentEmpty] = tileValue;

      return { tiles: newTiles, emptyIndex: tileIndex };
   };

   // Check if puzzle is solved
   const isPuzzleSolved = (
      currentTiles: (number | null)[],
      currentEmpty: number
   ): boolean => {
      if (currentEmpty !== total - 1) return false;
      for (let i = 0; i < total - 1; i++) {
         if (currentTiles[i] !== i + 1) return false;
      }
      return true;
   };

   // Convert state to string for comparison
   const stateToString = (
      currentTiles: (number | null)[],
      currentEmpty: number
   ): string => {
      return JSON.stringify({ tiles: currentTiles, empty: currentEmpty });
   };

   // Optimized state string (faster than JSON.stringify)
   const stateToStringFast = (
      currentTiles: (number | null)[],
      currentEmpty: number
   ): string => {
      // Create a compact string representation
      let str = `${currentEmpty}:`;
      for (let i = 0; i < total; i++) {
         str += currentTiles[i] === null ? "x" : currentTiles[i];
         if (i < total - 1) str += ",";
      }
      return str;
   };

   // Calculate heuristic (Manhattan distance) for A* algorithm
   const calculateHeuristic = (
      currentTiles: (number | null)[],
      currentEmpty: number
   ): number => {
      let h = 0;
      for (let i = 0; i < total; i++) {
         if (i === currentEmpty) continue;
         const tileValue = currentTiles[i];
         if (tileValue === null) continue;
         const correctPos = tileValue - 1;
         if (i !== correctPos) {
            const currentRow = Math.floor(i / gridSize);
            const currentCol = i % gridSize;
            const correctRow = Math.floor(correctPos / gridSize);
            const correctCol = correctPos % gridSize;
            // Manhattan distance
            h +=
               Math.abs(currentRow - correctRow) +
               Math.abs(currentCol - correctCol);
         }
      }
      return h;
   };

   // Find complete solution using A* algorithm (optimized for speed)
   const findCompleteSolution = (): number[] => {
      if (tiles.length !== total) return [];
      if (isPuzzleSolved(tiles, emptyIndex)) return [];

      const visited = new Set<string>();
      // Priority queue: [f_score, g_score, tiles, emptyIndex, moves]
      const openSet: Array<{
         f: number; // f = g + h (total estimated cost)
         g: number; // g = actual cost (number of moves)
         h: number; // h = heuristic (estimated cost to goal)
         tiles: (number | null)[];
         emptyIndex: number;
         moves: number[];
      }> = [];

      const initialH = calculateHeuristic(tiles, emptyIndex);
      openSet.push({
         f: initialH,
         g: 0,
         h: initialH,
         tiles: [...tiles],
         emptyIndex,
         moves: [],
      });
      visited.add(stateToStringFast(tiles, emptyIndex));

      // Use A* with optimized priority queue
      while (openSet.length > 0) {
         // Find node with lowest f-score (most promising path)
         let bestIndex = 0;
         let bestF = openSet[0].f;
         for (let i = 1; i < openSet.length; i++) {
            if (openSet[i].f < bestF) {
               bestF = openSet[i].f;
               bestIndex = i;
            }
         }
         const current = openSet.splice(bestIndex, 1)[0];

         // Check if solved
         if (isPuzzleSolved(current.tiles, current.emptyIndex)) {
            return current.moves;
         }

         // Try all possible moves
         const possibleMoves: number[] = [];
         for (let i = 0; i < total; i++) {
            if (i === current.emptyIndex || current.tiles[i] === null) continue;

            const row = Math.floor(i / gridSize);
            const col = i % gridSize;
            const emptyRow = Math.floor(current.emptyIndex / gridSize);
            const emptyCol = current.emptyIndex % gridSize;
            const canMoveTile =
               (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
               (col === emptyCol && Math.abs(row - emptyRow) === 1);

            if (canMoveTile) {
               possibleMoves.push(i);
            }
         }

         // Process moves in order (prioritize moves that improve heuristic)
         for (const moveIndex of possibleMoves) {
            const newState = simulateMove(
               current.tiles,
               current.emptyIndex,
               moveIndex
            );
            if (!newState) continue;

            const stateKey = stateToStringFast(
               newState.tiles,
               newState.emptyIndex
            );
            if (visited.has(stateKey)) continue;

            visited.add(stateKey);

            const newG = current.g + 1;
            const newH = calculateHeuristic(
               newState.tiles,
               newState.emptyIndex
            );
            const newF = newG + newH;

            openSet.push({
               f: newF,
               g: newG,
               h: newH,
               tiles: newState.tiles,
               emptyIndex: newState.emptyIndex,
               moves: [...current.moves, moveIndex],
            });
         }

         // Limit search depth for very large puzzles (safety check)
         if (current.g > 200) {
            console.warn(
               "Solution depth exceeded 200 moves, returning partial solution"
            );
            return current.moves;
         }
      }

      return []; // No solution found (shouldn't happen for solvable puzzles)
   };

   // Enhanced heuristic: prioritize tiles that are far from correct position
   const calculateEnhancedScore = (
      currentTiles: (number | null)[],
      currentEmpty: number
   ) => {
      let score = 0;
      let misplacedCount = 0;

      for (let i = 0; i < total; i++) {
         if (i === currentEmpty) continue;
         const tileValue = currentTiles[i];
         if (tileValue === null) continue;
         const correctPos = tileValue - 1;

         if (i !== correctPos) {
            misplacedCount++;
            const currentRow = Math.floor(i / gridSize);
            const currentCol = i % gridSize;
            const correctRow = Math.floor(correctPos / gridSize);
            const correctCol = correctPos % gridSize;

            // Manhattan distance (weighted)
            const distance =
               Math.abs(currentRow - correctRow) +
               Math.abs(currentCol - correctCol);
            score += distance * 2; // Weight distance more

            // Bonus penalty if tile is blocking correct position
            const correctTileAtPos = currentTiles[correctPos];
            if (correctTileAtPos !== null && correctTileAtPos !== tileValue) {
               score += 3; // Extra penalty for blocking
            }
         }
      }

      // Add penalty for misplaced count
      score += misplacedCount * 1.5;

      return score;
   };

   // Get hint: Find a sequence of 4-5 moves that significantly improves the puzzle
   const getHintSequence = (): number[] => {
      if (tiles.length !== total) return [];

      const currentScore = calculateEnhancedScore(tiles, emptyIndex);
      if (currentScore === 0) return []; // Already solved

      let bestSequence: number[] = [];
      let bestImprovement = -Infinity;

      // Try sequences of 4-5 moves for better hints
      const maxMoves = 5;

      // Get all possible first moves
      const possibleFirstMoves: number[] = [];
      for (let i = 0; i < total; i++) {
         if (i !== emptyIndex && canMove(i)) {
            possibleFirstMoves.push(i);
         }
      }

      // Try each first move
      for (const firstMove of possibleFirstMoves) {
         const firstState = simulateMove(tiles, emptyIndex, firstMove);
         if (!firstState) continue;

         const firstScore = calculateEnhancedScore(
            firstState.tiles,
            firstState.emptyIndex
         );
         const firstImprovement = currentScore - firstScore;

         // Try second move
         const possibleSecondMoves: number[] = [];
         for (let i = 0; i < total; i++) {
            if (i !== firstState.emptyIndex && firstState.tiles[i] !== null) {
               const row = Math.floor(i / gridSize);
               const col = i % gridSize;
               const emptyRow = Math.floor(firstState.emptyIndex / gridSize);
               const emptyCol = firstState.emptyIndex % gridSize;
               const canMoveTile =
                  (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
                  (col === emptyCol && Math.abs(row - emptyRow) === 1);
               if (canMoveTile) {
                  possibleSecondMoves.push(i);
               }
            }
         }

         for (const secondMove of possibleSecondMoves) {
            const secondState = simulateMove(
               firstState.tiles,
               firstState.emptyIndex,
               secondMove
            );
            if (!secondState) continue;

            const secondScore = calculateEnhancedScore(
               secondState.tiles,
               secondState.emptyIndex
            );
            const secondImprovement = currentScore - secondScore;

            // Try third move
            const possibleThirdMoves: number[] = [];
            for (let i = 0; i < total; i++) {
               if (
                  i !== secondState.emptyIndex &&
                  secondState.tiles[i] !== null
               ) {
                  const row = Math.floor(i / gridSize);
                  const col = i % gridSize;
                  const emptyRow = Math.floor(
                     secondState.emptyIndex / gridSize
                  );
                  const emptyCol = secondState.emptyIndex % gridSize;
                  const canMoveTile =
                     (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
                     (col === emptyCol && Math.abs(row - emptyRow) === 1);
                  if (canMoveTile) {
                     possibleThirdMoves.push(i);
                  }
               }
            }

            // Check 2-move sequence
            if (secondImprovement > bestImprovement) {
               bestImprovement = secondImprovement;
               bestSequence = [firstMove, secondMove];
            }

            // Check 3-move sequence
            for (const thirdMove of possibleThirdMoves) {
               const thirdState = simulateMove(
                  secondState.tiles,
                  secondState.emptyIndex,
                  thirdMove
               );
               if (!thirdState) continue;

               const thirdScore = calculateEnhancedScore(
                  thirdState.tiles,
                  thirdState.emptyIndex
               );
               const thirdImprovement = currentScore - thirdScore;

               // Try fourth move
               const possibleFourthMoves: number[] = [];
               for (let i = 0; i < total; i++) {
                  if (
                     i !== thirdState.emptyIndex &&
                     thirdState.tiles[i] !== null
                  ) {
                     const row = Math.floor(i / gridSize);
                     const col = i % gridSize;
                     const emptyRow = Math.floor(
                        thirdState.emptyIndex / gridSize
                     );
                     const emptyCol = thirdState.emptyIndex % gridSize;
                     const canMoveTile =
                        (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
                        (col === emptyCol && Math.abs(row - emptyRow) === 1);
                     if (canMoveTile) {
                        possibleFourthMoves.push(i);
                     }
                  }
               }

               // Check 3-move sequence
               if (thirdImprovement > bestImprovement) {
                  bestImprovement = thirdImprovement;
                  bestSequence = [firstMove, secondMove, thirdMove];
               }

               // Check 4-move sequence
               for (const fourthMove of possibleFourthMoves) {
                  const fourthState = simulateMove(
                     thirdState.tiles,
                     thirdState.emptyIndex,
                     fourthMove
                  );
                  if (!fourthState) continue;

                  const fourthScore = calculateEnhancedScore(
                     fourthState.tiles,
                     fourthState.emptyIndex
                  );
                  const fourthImprovement = currentScore - fourthScore;

                  // Try fifth move
                  const possibleFifthMoves: number[] = [];
                  for (let i = 0; i < total; i++) {
                     if (
                        i !== fourthState.emptyIndex &&
                        fourthState.tiles[i] !== null
                     ) {
                        const row = Math.floor(i / gridSize);
                        const col = i % gridSize;
                        const emptyRow = Math.floor(
                           fourthState.emptyIndex / gridSize
                        );
                        const emptyCol = fourthState.emptyIndex % gridSize;
                        const canMoveTile =
                           (row === emptyRow &&
                              Math.abs(col - emptyCol) === 1) ||
                           (col === emptyCol && Math.abs(row - emptyRow) === 1);
                        if (canMoveTile) {
                           possibleFifthMoves.push(i);
                        }
                     }
                  }

                  // Check 4-move sequence
                  if (fourthImprovement > bestImprovement) {
                     bestImprovement = fourthImprovement;
                     bestSequence = [
                        firstMove,
                        secondMove,
                        thirdMove,
                        fourthMove,
                     ];
                  }

                  // Check 5-move sequence
                  for (const fifthMove of possibleFifthMoves) {
                     const fifthState = simulateMove(
                        fourthState.tiles,
                        fourthState.emptyIndex,
                        fifthMove
                     );
                     if (!fifthState) continue;

                     const fifthScore = calculateEnhancedScore(
                        fifthState.tiles,
                        fifthState.emptyIndex
                     );
                     const fifthImprovement = currentScore - fifthScore;

                     if (fifthImprovement > bestImprovement) {
                        bestImprovement = fifthImprovement;
                        bestSequence = [
                           firstMove,
                           secondMove,
                           thirdMove,
                           fourthMove,
                           fifthMove,
                        ];
                     }
                  }
               }
            }
         }

         // Also check single move
         if (firstImprovement > bestImprovement) {
            bestImprovement = firstImprovement;
            bestSequence = [firstMove];
         }
      }

      // Return best sequence (prefer 2-3 moves, but ensure it improves the puzzle)
      if (bestSequence.length === 0 && possibleFirstMoves.length > 0) {
         // Fallback: return first available move only if it improves
         const fallbackMove = possibleFirstMoves[0];
         const fallbackState = simulateMove(tiles, emptyIndex, fallbackMove);
         if (fallbackState) {
            const fallbackScore = calculateEnhancedScore(
               fallbackState.tiles,
               fallbackState.emptyIndex
            );
            if (fallbackScore < currentScore) {
               return [fallbackMove];
            }
         }
      }

      // Ensure sequence improves the puzzle (prevents getting stuck)
      if (bestImprovement <= 0 && bestSequence.length > 0) {
         // If no improvement found, try to find at least one move that doesn't worsen
         for (const firstMove of possibleFirstMoves) {
            const firstState = simulateMove(tiles, emptyIndex, firstMove);
            if (!firstState) continue;
            const firstScore = calculateEnhancedScore(
               firstState.tiles,
               firstState.emptyIndex
            );
            if (firstScore <= currentScore) {
               // Try to extend to 2 moves
               const possibleSecondMoves: number[] = [];
               for (let i = 0; i < total; i++) {
                  if (
                     i !== firstState.emptyIndex &&
                     firstState.tiles[i] !== null
                  ) {
                     const row = Math.floor(i / gridSize);
                     const col = i % gridSize;
                     const emptyRow = Math.floor(
                        firstState.emptyIndex / gridSize
                     );
                     const emptyCol = firstState.emptyIndex % gridSize;
                     const canMoveTile =
                        (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
                        (col === emptyCol && Math.abs(row - emptyRow) === 1);
                     if (canMoveTile) {
                        possibleSecondMoves.push(i);
                     }
                  }
               }

               for (const secondMove of possibleSecondMoves) {
                  const secondState = simulateMove(
                     firstState.tiles,
                     firstState.emptyIndex,
                     secondMove
                  );
                  if (!secondState) continue;
                  const secondScore = calculateEnhancedScore(
                     secondState.tiles,
                     secondState.emptyIndex
                  );
                  if (secondScore < currentScore) {
                     return [firstMove, secondMove];
                  }
               }

               // If single move doesn't worsen, return it
               if (firstScore < currentScore) {
                  return [firstMove];
               }
            }
         }
      }

      // Return best sequence (prefer 4-5 moves for better hints, ensure improvement)
      if (bestImprovement > 0) {
         // Prefer longer sequences (4-5 moves) for more helpful hints
         return bestSequence.length >= 4
            ? bestSequence.slice(0, 5)
            : bestSequence.length >= 2
            ? bestSequence.slice(0, 4)
            : bestSequence;
      }

      return []; // No good sequence found
   };

   const handleShowHint = () => {
      if (!showHints || isAnimating || feedback) return;

      // Check if unlimited hints (maxHints <= 0 or very large number)
      const isUnlimited = maxHints <= 0 || maxHints >= 1000;

      if (!isUnlimited && hintsUsed >= maxHints) return;

      let sequence: number[] = [];

      // If unlimited hints, find complete solution
      if (isUnlimited) {
         sequence = findCompleteSolution();
      }
      if (!isUnlimited || sequence.length === 0) {
         // Otherwise, use normal hint sequence (2-3 moves)
         sequence = getHintSequence();
      }

      if (sequence.length === 0) return;

      if (!isUnlimited) {
         setHintsUsed((prev) => prev + 1);
      }

      // Set all tiles in sequence for highlighting
      setHintSequence(sequence);
      setShowHint(true);

      // Execute moves sequentially with delays
      sequence.forEach((tileIndex, moveIndex) => {
         setTimeout(() => {
            // Highlight current tile
            setHintTileIndex(tileIndex);

            // Move tile after brief delay
            setTimeout(() => {
               handleTileClick(tileIndex);

               // Remove current tile from sequence highlight
               if (moveIndex === sequence.length - 1) {
                  // Last move - clear all highlights
                  setShowHint(false);
                  setHintTileIndex(null);
                  setHintSequence([]);
               } else {
                  // Update sequence to remove moved tile
                  setHintSequence((prev) => prev.slice(1));
               }
            }, 300);
         }, moveIndex * 600); // 600ms delay between moves
      });
   };

   return (
      <div className="tile-slider-game">
         {/* Header */}
         <div className="game-header">
            <div className="header-stats">
               <div className="stat-item">
                  <ArrowPathIcon className="stat-icon" />
                  <span>Moves: {moves}</span>
               </div>
               <div className="stat-item">
                  <TrophyIcon className="stat-icon" />
                  <span>Score: {Math.max(0, 100 - moves)} / 100</span>
               </div>
            </div>
         </div>

         {/* Instructions */}
         <div className="game-instructions">
            <div className="instructions-content">
               <p className="instructions-title">
                  <InformationCircleIcon className="info-icon" />
                  How to Play:
               </p>
               <ol className="instructions-steps">
                  <li>
                     <strong>Goal:</strong> Arrange numbers 1-{total - 1} in
                     order from left to right, top to bottom
                  </li>
                  <li>
                     <strong>Empty Space:</strong> The space with the sparkle
                     icon is where tiles can move
                  </li>
                  <li>
                     <strong>Move Tiles:</strong> Click on tiles that are{" "}
                     <strong>next to</strong> the empty space (they glow green)
                  </li>
                  <li>
                     <strong>Tip:</strong> Tiles can only move if they are
                     directly above, below, left, or right of the empty space
                  </li>
               </ol>
            </div>
         </div>

         {/* Share & Hint Section */}
         <div className="hint-share-section">
            {/* Share Button */}
            {!hasShared && (
               <div className="share-section">
                  <button
                     onClick={handleShare}
                     className="share-button"
                     title="Share this game to get unlimited hints!"
                  >
                     <ShareIcon className="share-icon" />
                     <span>Share for Unlimited Hints</span>
                  </button>
                  {shareSuccess && (
                     <div className="share-success">
                        <CheckCircleIcon className="success-icon" />
                        <span>Link copied! Unlimited hints unlocked!</span>
                     </div>
                  )}
               </div>
            )}

            {/* Hint Button */}
            {showHints && (
               <div className="hint-section">
                  <div className="hint-info">
                     <span className="hint-counter">
                        {maxHints <= 0 || maxHints >= 1000
                           ? "Hints: Unlimited"
                           : `Hints: ${hintsUsed} / ${maxHints}`}
                     </span>
                  </div>
                  <button
                     onClick={handleShowHint}
                     className="hint-button"
                     disabled={
                        showHint ||
                        feedback !== null ||
                        (maxHints > 0 &&
                           maxHints < 1000 &&
                           hintsUsed >= maxHints)
                     }
                     title={
                        maxHints > 0 && maxHints < 1000 && hintsUsed >= maxHints
                           ? "Maximum hints reached"
                           : maxHints <= 0 || maxHints >= 1000
                           ? "Solve puzzle automatically (unlimited hints)"
                           : "Get a hint on which tile to move next"
                     }
                  >
                     <LightBulbIcon className="hint-icon" />
                     <span>
                        {maxHints > 0 &&
                        maxHints < 1000 &&
                        hintsUsed >= maxHints
                           ? "No Hints Left"
                           : maxHints <= 0 || maxHints >= 1000
                           ? "Solve Puzzle"
                           : "Show Hint"}
                     </span>
                  </button>
               </div>
            )}
         </div>

         {/* Game Grid */}
         <div className="tile-slider-container">
            <div
               className="slider-grid"
               style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
            >
               {Array.from({ length: total }).map((_, i) => {
                  const isMovable = canMove(i);
                  const tileValue = tiles[i];
                  const isCorrect = tileValue !== null && tileValue === i + 1;
                  const isEmpty = tileValue === null;
                  const isSelected = selectedIndex === i;
                  const isHinted =
                     showHint &&
                     (hintSequence.includes(i) || hintTileIndex === i);
                  const isCurrentHint = showHint && hintTileIndex === i;

                  return (
                     <div key={i} className="slider-cell">
                        {isEmpty ? (
                           <div className="empty-cell">
                              <SparklesIcon className="empty-icon" />
                           </div>
                        ) : (
                           <button
                              onClick={() => {
                                 handleTileClick(i);
                                 setSelectedIndex(null); // Deselect after clicking
                                 setShowHint(false); // Hide hint after clicking
                                 setHintTileIndex(null);
                              }}
                              className={`slider-tile ${
                                 isMovable ? "movable" : ""
                              } ${isCorrect ? "correct" : ""} ${
                                 isSelected ? "selected" : ""
                              } ${isHinted ? "hinted" : ""} ${
                                 isCurrentHint ? "hint-current" : ""
                              }`}
                              disabled={!isMovable || isAnimating}
                              title={
                                 isHinted
                                    ? `💡 Hint: Move this tile (${tileValue}) next!`
                                    : isSelected
                                    ? `Selected! Use Arrow keys to move this tile (${tileValue})`
                                    : isCorrect
                                    ? `Tile ${tileValue} is in correct position, but can still be moved if needed`
                                    : undefined
                              }
                           >
                              <span className="tile-number">{tileValue}</span>
                              {isCorrect && (
                                 <span
                                    className="correct-badge"
                                    title="In correct position"
                                 >
                                    ✓
                                 </span>
                              )}
                              {isSelected && (
                                 <span
                                    className="selected-badge"
                                    title="Selected - Press Arrow keys to move"
                                 >
                                    ⌂
                                 </span>
                              )}
                              {isHinted && (
                                 <span
                                    className="hint-badge"
                                    title="Hint: Move this tile!"
                                 >
                                    💡
                                 </span>
                              )}
                           </button>
                        )}
                     </div>
                  );
               })}
            </div>
         </div>

         {/* Feedback */}
         {feedback === "correct" && (
            <div className="game-feedback correct">
               <CheckCircleIcon className="feedback-icon" />
               <span>Puzzle Solved! Great job!</span>
            </div>
         )}
      </div>
   );
}

// Balance the Scale Game (6)
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

      setTimeout(() => {
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

   const getLeftPosition = () => {
      if (!isAnimating) return 0;
      if (leftWeight > rightWeight) return -15;
      if (rightWeight > leftWeight) return 15;
      return 0;
   };

   const getRightPosition = () => {
      if (!isAnimating) return 0;
      if (leftWeight > rightWeight) return 15;
      if (rightWeight > leftWeight) return -15;
      return 0;
   };

   return (
      <div
         className="balance-scale-game"
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem",
            padding: "2rem",
            minHeight: "400px",
            justifyContent: "center",
         }}
      >
         {/* Modern Header with Round Info */}
         <div
            style={{
               width: "100%",
               maxWidth: "600px",
               display: "flex",
               flexDirection: "column",
               alignItems: "center",
               gap: "0.75rem",
               marginBottom: "0.5rem",
            }}
         >
            <h3
               style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  margin: 0,
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
               }}
            >
               <ScaleIcon
                  style={{ width: 28, height: 28, color: "var(--accent)" }}
               />
               Balance the Scale
            </h3>

            {/* Round Progress Bar */}
            <div
               style={{
                  width: "100%",
                  maxWidth: "400px",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "0.75rem 1.25rem",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid var(--stroke)",
                  borderRadius: "16px",
                  backdropFilter: "blur(10px)",
               }}
            >
               <div
                  style={{
                     flex: 1,
                     display: "flex",
                     flexDirection: "column",
                     gap: "0.5rem",
                  }}
               >
                  <div
                     style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.875rem",
                        color: "var(--muted)",
                        fontWeight: 500,
                     }}
                  >
                     <span
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "6px",
                        }}
                     >
                        <ArrowPathIcon
                           style={{
                              width: 16,
                              height: 16,
                              color: "var(--accent)",
                           }}
                        />
                        Round {currentRound} / {maxRounds}
                     </span>
                     <span
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "6px",
                        }}
                     >
                        <TrophyIcon
                           style={{ width: 16, height: 16, color: "var(--ok)" }}
                        />
                        Score: {currentScore} / {maxRounds * 5}
                     </span>
                  </div>
                  {/* Progress Bar */}
                  <div
                     style={{
                        width: "100%",
                        height: "8px",
                        background: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "4px",
                        overflow: "hidden",
                        position: "relative",
                     }}
                  >
                     <div
                        style={{
                           width: `${(currentRound / maxRounds) * 100}%`,
                           height: "100%",
                           background:
                              "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                           borderRadius: "4px",
                           transition: "width 0.3s ease",
                           boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                        }}
                     />
                  </div>
               </div>
            </div>
         </div>

         <div
            style={{
               position: "relative",
               width: "100%",
               maxWidth: "500px",
               height: "250px",
               display: "flex",
               alignItems: "center",
               justifyContent: "center",
            }}
         >
            {/* Scale Base */}
            <div
               style={{
                  position: "absolute",
                  bottom: "0",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "80px",
                  height: "20px",
                  background:
                     "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
                  borderRadius: "4px",
                  border: "1px solid var(--stroke)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
               }}
            />

            {/* Scale Pole */}
            <div
               style={{
                  position: "absolute",
                  bottom: "20px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "6px",
                  height: "120px",
                  background:
                     "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)",
                  borderRadius: "3px",
                  border: "1px solid var(--stroke)",
                  zIndex: 1,
               }}
            />

            {/* Scale Beam */}
            <div
               style={{
                  position: "absolute",
                  top: "60px",
                  left: "50%",
                  transform: `translateX(-50%) rotate(${getScaleRotation()}deg)`,
                  transformOrigin: "center center",
                  width: "400px",
                  height: "8px",
                  background:
                     "linear-gradient(90deg, rgba(125,211,252,0.3) 0%, rgba(134,239,172,0.3) 50%, rgba(125,211,252,0.3) 100%)",
                  borderRadius: "4px",
                  border: "2px solid var(--stroke)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                  zIndex: 2,
               }}
            />

            {/* Left Weight */}
            <div
               style={{
                  position: "absolute",
                  top: "40px",
                  left: "50%",
                  transform: `translate(calc(-50% - 200px + ${getLeftPosition()}px), 0)`,
                  transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  zIndex: 3,
               }}
            >
               <div
                  style={{
                     width: "60px",
                     height: "60px",
                     background: `linear-gradient(135deg, rgba(125,211,252,0.4) 0%, rgba(125,211,252,0.2) 100%)`,
                     border: "2px solid var(--accent)",
                     borderRadius: "12px",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     fontSize: "1.8rem",
                     fontWeight: 700,
                     color: "var(--accent)",
                     boxShadow: "0 6px 20px rgba(125,211,252,0.3)",
                     transition: "all 0.3s ease",
                  }}
               >
                  {leftWeight}
               </div>
               <div
                  style={{
                     width: "4px",
                     height: "30px",
                     background: "var(--accent)",
                     borderRadius: "2px",
                     boxShadow: "0 2px 8px rgba(125,211,252,0.4)",
                  }}
               />
            </div>

            {/* Right Weight */}
            <div
               style={{
                  position: "absolute",
                  top: "40px",
                  left: "50%",
                  transform: `translate(calc(-50% + 200px + ${getRightPosition()}px), 0)`,
                  transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  zIndex: 3,
               }}
            >
               <div
                  style={{
                     width: "60px",
                     height: "60px",
                     background: `linear-gradient(135deg, rgba(134,239,172,0.4) 0%, rgba(134,239,172,0.2) 100%)`,
                     border: "2px solid var(--ok)",
                     borderRadius: "12px",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     fontSize: "1.8rem",
                     fontWeight: 700,
                     color: "var(--ok)",
                     boxShadow: "0 6px 20px rgba(134,239,172,0.3)",
                     transition: "all 0.3s ease",
                  }}
               >
                  {rightWeight}
               </div>
               <div
                  style={{
                     width: "4px",
                     height: "30px",
                     background: "var(--ok)",
                     borderRadius: "2px",
                     boxShadow: "0 2px 8px rgba(134,239,172,0.4)",
                  }}
               />
            </div>
         </div>

         <div
            style={{
               display: "flex",
               gap: "1rem",
               flexWrap: "wrap",
               justifyContent: "center",
               marginTop: "1rem",
               width: "100%",
               maxWidth: "600px",
            }}
         >
            <button
               onClick={() => handleSelect("left")}
               disabled={selected !== null}
               style={{
                  padding: "14px 28px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  borderRadius: "14px",
                  border: "2px solid",
                  cursor: selected === null ? "pointer" : "not-allowed",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  background:
                     selected === "left"
                        ? correct
                           ? "linear-gradient(135deg, rgba(134,239,172,0.25) 0%, rgba(134,239,172,0.15) 100%)"
                           : "linear-gradient(135deg, rgba(252,165,165,0.25) 0%, rgba(252,165,165,0.15) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
                  borderColor:
                     selected === "left"
                        ? correct
                           ? "var(--ok)"
                           : "var(--warn)"
                        : "var(--stroke)",
                  color:
                     selected === "left"
                        ? correct
                           ? "var(--ok)"
                           : "var(--warn)"
                        : "var(--text)",
                  opacity: selected !== null && selected !== "left" ? 0.4 : 1,
                  transform: selected === "left" ? "scale(1.05)" : "scale(1)",
                  boxShadow:
                     selected === "left"
                        ? correct
                           ? "0 6px 20px rgba(134,239,172,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                           : "0 6px 20px rgba(252,165,165,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                        : "0 2px 8px rgba(0,0,0,0.2)",
                  backdropFilter: "blur(10px)",
               }}
               onMouseEnter={(e) => {
                  if (selected === null) {
                     e.currentTarget.style.transform = "scale(1.02)";
                     e.currentTarget.style.borderColor = "var(--accent)";
                  }
               }}
               onMouseLeave={(e) => {
                  if (selected === null) {
                     e.currentTarget.style.transform = "scale(1)";
                     e.currentTarget.style.borderColor = "var(--stroke)";
                  }
               }}
            >
               <ArrowLeftIcon
                  style={{ width: 20, height: 20, marginRight: 8 }}
               />
               Left is Heavier
            </button>
            <button
               onClick={() => handleSelect("equal")}
               disabled={selected !== null}
               style={{
                  padding: "14px 28px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  borderRadius: "14px",
                  border: "2px solid",
                  cursor: selected === null ? "pointer" : "not-allowed",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  background:
                     selected === "equal"
                        ? correct
                           ? "linear-gradient(135deg, rgba(134,239,172,0.25) 0%, rgba(134,239,172,0.15) 100%)"
                           : "linear-gradient(135deg, rgba(252,165,165,0.25) 0%, rgba(252,165,165,0.15) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
                  borderColor:
                     selected === "equal"
                        ? correct
                           ? "var(--ok)"
                           : "var(--warn)"
                        : "var(--stroke)",
                  color:
                     selected === "equal"
                        ? correct
                           ? "var(--ok)"
                           : "var(--warn)"
                        : "var(--text)",
                  opacity: selected !== null && selected !== "equal" ? 0.4 : 1,
                  transform: selected === "equal" ? "scale(1.05)" : "scale(1)",
                  boxShadow:
                     selected === "equal"
                        ? correct
                           ? "0 6px 20px rgba(134,239,172,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                           : "0 6px 20px rgba(252,165,165,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                        : "0 2px 8px rgba(0,0,0,0.2)",
                  backdropFilter: "blur(10px)",
               }}
               onMouseEnter={(e) => {
                  if (selected === null) {
                     e.currentTarget.style.transform = "scale(1.02)";
                     e.currentTarget.style.borderColor = "var(--accent)";
                  }
               }}
               onMouseLeave={(e) => {
                  if (selected === null) {
                     e.currentTarget.style.transform = "scale(1)";
                     e.currentTarget.style.borderColor = "var(--stroke)";
                  }
               }}
            >
               <ScaleIcon style={{ width: 20, height: 20, marginRight: 8 }} />
               Equal
            </button>
            <button
               onClick={() => handleSelect("right")}
               disabled={selected !== null}
               style={{
                  padding: "14px 28px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  borderRadius: "14px",
                  border: "2px solid",
                  cursor: selected === null ? "pointer" : "not-allowed",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  background:
                     selected === "right"
                        ? correct
                           ? "linear-gradient(135deg, rgba(134,239,172,0.25) 0%, rgba(134,239,172,0.15) 100%)"
                           : "linear-gradient(135deg, rgba(252,165,165,0.25) 0%, rgba(252,165,165,0.15) 100%)"
                        : "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)",
                  borderColor:
                     selected === "right"
                        ? correct
                           ? "var(--ok)"
                           : "var(--warn)"
                        : "var(--stroke)",
                  color:
                     selected === "right"
                        ? correct
                           ? "var(--ok)"
                           : "var(--warn)"
                        : "var(--text)",
                  opacity: selected !== null && selected !== "right" ? 0.4 : 1,
                  transform: selected === "right" ? "scale(1.05)" : "scale(1)",
                  boxShadow:
                     selected === "right"
                        ? correct
                           ? "0 6px 20px rgba(134,239,172,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                           : "0 6px 20px rgba(252,165,165,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                        : "0 2px 8px rgba(0,0,0,0.2)",
                  backdropFilter: "blur(10px)",
               }}
               onMouseEnter={(e) => {
                  if (selected === null) {
                     e.currentTarget.style.transform = "scale(1.02)";
                     e.currentTarget.style.borderColor = "var(--accent)";
                  }
               }}
               onMouseLeave={(e) => {
                  if (selected === null) {
                     e.currentTarget.style.transform = "scale(1)";
                     e.currentTarget.style.borderColor = "var(--stroke)";
                  }
               }}
            >
               Right is Heavier
               <ArrowRightIcon
                  style={{ width: 20, height: 20, marginLeft: 8 }}
               />
            </button>
         </div>

         {correct !== null && (
            <div
               style={{
                  padding: "1rem 2rem",
                  borderRadius: "16px",
                  fontSize: "1.2rem",
                  fontWeight: 600,
                  background: correct
                     ? "linear-gradient(135deg, rgba(134,239,172,0.2) 0%, rgba(134,239,172,0.1) 100%)"
                     : "linear-gradient(135deg, rgba(252,165,165,0.2) 0%, rgba(252,165,165,0.1) 100%)",
                  border: `2px solid ${correct ? "#86efac" : "#fca5a5"}`,
                  color: correct ? "#86efac" : "#fca5a5",
                  boxShadow: correct
                     ? "0 6px 24px rgba(134,239,172,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                     : "0 6px 24px rgba(252,165,165,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
                  animation: "fadeIn 0.3s ease",
                  animationFillMode: "forwards",
                  backdropFilter: "blur(10px)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
               }}
            >
               {correct ? (
                  <>
                     <CheckCircleIcon style={{ width: 28, height: 28 }} />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon style={{ width: 28, height: 28 }} />
                     <span>Wrong! Try again.</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
}

// Modern Circuit Path Game (7)
function CircuitPath({
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
   onComplete: (finalScore?: number) => void;
   onRoundComplete?: () => void;
}) {
   // Dynamic grid size based on round
   const getGridSize = (roundNum: number) => {
      if (roundNum <= 5) return 3; // Rounds 1-5: 3x3
      if (roundNum <= 10) return 5; // Rounds 6-10: 5x5
      return 10; // Rounds 11+: 10x10
   };

   const [gridSize, setGridSize] = useState(getGridSize(1));
   const rounds = config.rounds || maxRounds;

   const [startNode, setStartNode] = useState<{
      row: number;
      col: number;
   } | null>(null);
   const [endNode, setEndNode] = useState<{ row: number; col: number } | null>(
      null
   );
   const [obstacles, setObstacles] = useState<Set<string>>(new Set());
   const [path, setPath] = useState<Array<{ row: number; col: number }>>([]);
   const round = currentRound;
   const score = currentScore;
   const [selectedRow, setSelectedRow] = useState<number | null>(null);
   const [selectedCol, setSelectedCol] = useState<number | null>(null);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isAnimating, setIsAnimating] = useState(false);
   const completionCalledRef = useRef(false);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);
   const onRoundCompleteRef = useRef(onRoundComplete);

   // Update refs when callbacks change
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
      onRoundCompleteRef.current = onRoundComplete;
   }, [onScoreUpdate, onComplete, onRoundComplete]);

   // Initialize new round with random start and end nodes
   const startNewRound = useCallback((roundNum: number) => {
      const currentGridSize = getGridSize(roundNum);
      setGridSize(currentGridSize);

      const total = currentGridSize * currentGridSize;

      // Helper function to get adjacent positions
      const getAdjacentPositions = (row: number, col: number): number[] => {
         const positions: number[] = [];
         if (row > 0) positions.push((row - 1) * currentGridSize + col);
         if (row < currentGridSize - 1)
            positions.push((row + 1) * currentGridSize + col);
         if (col > 0) positions.push(row * currentGridSize + (col - 1));
         if (col < currentGridSize - 1)
            positions.push(row * currentGridSize + (col + 1));
         return positions;
      };

      // Helper function to check if position is too close to another
      const isTooClose = (
         row1: number,
         col1: number,
         row2: number,
         col2: number
      ): boolean => {
         const rowDiff = Math.abs(row1 - row2);
         const colDiff = Math.abs(col1 - col2);
         return rowDiff <= 1 && colDiff <= 1; // Within 1 cell distance
      };

      // Generate random start position
      let startIndex = Math.floor(Math.random() * total);
      let startRow = Math.floor(startIndex / currentGridSize);
      let startCol = startIndex % currentGridSize;

      // Generate end position that is not too close to start (at least 2 cells away)
      let endIndex: number;
      let endRow: number;
      let endCol: number;
      let endAttempts = 0;
      do {
         endIndex = Math.floor(Math.random() * total);
         endRow = Math.floor(endIndex / currentGridSize);
         endCol = endIndex % currentGridSize;
         endAttempts++;
         // Prevent infinite loop
         if (endAttempts > 100) break;
      } while (
         endIndex === startIndex ||
         isTooClose(startRow, startCol, endRow, endCol)
      );

      setStartNode({ row: startRow, col: startCol });
      setEndNode({ row: endRow, col: endCol });

      // Get positions that must be free (adjacent to start - at least 2 free)
      const startAdjacent = getAdjacentPositions(startRow, startCol);
      const endAdjacent = getAdjacentPositions(endRow, endCol);
      const protectedPositions = new Set<number>([
         startIndex,
         endIndex,
         ...startAdjacent,
         ...endAdjacent,
      ]);

      // Generate obstacles (more for larger grids)
      // 3x3: 10-15%, 5x5: 15-25%, 10x10: 20-30%
      let obstaclePercentage = 0.1;
      if (currentGridSize >= 10)
         obstaclePercentage = 0.2 + (roundNum - 1) * 0.01;
      else if (currentGridSize >= 5)
         obstaclePercentage = 0.15 + (roundNum - 1) * 0.01;
      else obstaclePercentage = 0.1 + (roundNum - 1) * 0.005;

      const obstacleCount = Math.max(1, Math.floor(total * obstaclePercentage));

      // Helper function to check if path exists using BFS
      const pathExists = (obstaclesSet: Set<string>): boolean => {
         const visited = new Set<string>();
         const queue: Array<{ row: number; col: number }> = [
            { row: startRow, col: startCol },
         ];
         visited.add(`${startRow},${startCol}`);

         while (queue.length > 0) {
            const current = queue.shift()!;

            // Check if we reached the end
            if (current.row === endRow && current.col === endCol) {
               return true;
            }

            // Check all adjacent cells
            const directions = [
               { row: -1, col: 0 }, // up
               { row: 1, col: 0 }, // down
               { row: 0, col: -1 }, // left
               { row: 0, col: 1 }, // right
            ];

            for (const dir of directions) {
               const newRow = current.row + dir.row;
               const newCol = current.col + dir.col;

               if (
                  newRow >= 0 &&
                  newRow < currentGridSize &&
                  newCol >= 0 &&
                  newCol < currentGridSize
               ) {
                  const key = `${newRow},${newCol}`;

                  if (!visited.has(key) && !obstaclesSet.has(key)) {
                     visited.add(key);
                     queue.push({ row: newRow, col: newCol });
                  }
               }
            }
         }

         return false;
      };

      // Generate obstacles with path validation
      let newObstacles = new Set<string>();
      const availablePositions = new Set<number>();

      // Create set of available positions (excluding protected positions)
      for (let i = 0; i < total; i++) {
         if (!protectedPositions.has(i)) {
            availablePositions.add(i);
         }
      }

      // Try multiple times to generate valid obstacles
      let attempts = 0;
      const maxAttempts = 50;

      while (attempts < maxAttempts) {
         newObstacles = new Set<string>();
         const positionsArray = Array.from(availablePositions);

         // Randomly select obstacle positions
         for (
            let i = 0;
            i < Math.min(obstacleCount, positionsArray.length);
            i++
         ) {
            const randomIndex = Math.floor(
               Math.random() * positionsArray.length
            );
            const pos = positionsArray[randomIndex];
            positionsArray.splice(randomIndex, 1);

            const row = Math.floor(pos / currentGridSize);
            const col = pos % currentGridSize;
            newObstacles.add(`${row},${col}`);
         }

         // Check if path exists with these obstacles
         if (pathExists(newObstacles)) {
            break; // Valid configuration found
         }

         attempts++;
      }

      // If still no valid path after max attempts, reduce obstacles
      if (attempts >= maxAttempts) {
         // Try with fewer obstacles
         for (
            let reducedCount = obstacleCount - 1;
            reducedCount >= 1;
            reducedCount--
         ) {
            newObstacles = new Set<string>();
            const positionsArray = Array.from(availablePositions);

            for (
               let i = 0;
               i < Math.min(reducedCount, positionsArray.length);
               i++
            ) {
               const randomIndex = Math.floor(
                  Math.random() * positionsArray.length
               );
               const pos = positionsArray[randomIndex];
               positionsArray.splice(randomIndex, 1);

               const row = Math.floor(pos / currentGridSize);
               const col = pos % currentGridSize;
               newObstacles.add(`${row},${col}`);
            }

            if (pathExists(newObstacles)) {
               break;
            }
         }
      }

      setObstacles(newObstacles);
      setPath([]);
      setSelectedRow(null);
      setSelectedCol(null);
      setFeedback(null);
      completionCalledRef.current = false;
   }, []);

   // Initialize first round
   useEffect(() => {
      startNewRound(currentRound);
   }, [startNewRound, currentRound]);

   // Check if path is complete (connects start to end)
   useEffect(() => {
      if (!startNode || !endNode || path.length === 0) return;
      if (completionCalledRef.current) return;

      const firstNode = path[0];
      const lastNode = path[path.length - 1];

      // Check if path starts at start node and ends at end node
      const startsCorrectly =
         firstNode.row === startNode.row && firstNode.col === startNode.col;
      const endsCorrectly =
         lastNode.row === endNode.row && lastNode.col === endNode.col;

      // Check if path is continuous (each node is adjacent to previous)
      let isContinuous = true;
      for (let i = 1; i < path.length; i++) {
         const prev = path[i - 1];
         const curr = path[i];
         const rowDiff = Math.abs(curr.row - prev.row);
         const colDiff = Math.abs(curr.col - prev.col);
         if (
            !(
               (rowDiff === 1 && colDiff === 0) ||
               (rowDiff === 0 && colDiff === 1)
            )
         ) {
            isContinuous = false;
            break;
         }
      }

      if (startsCorrectly && endsCorrectly && isContinuous && path.length > 1) {
         completionCalledRef.current = true;

         // Calculate round score: 5 points per round (max 100 for 20 rounds)
         const roundScore = 5;
         const newScore = score + roundScore;
         setFeedback("correct");

         // Update parent score
         onScoreUpdateRef.current(newScore);

         // Move to next round or complete
         if (round < rounds) {
            setTimeout(() => {
               if (onRoundCompleteRef.current) {
                  onRoundCompleteRef.current();
               }
            }, 1500);
         } else {
            // All rounds completed
            setTimeout(() => {
               onCompleteRef.current(newScore);
            }, 1500);
         }
      } else if (path.length > 0 && !isContinuous) {
         setFeedback("wrong");
         setTimeout(() => {
            setFeedback(null);
            setPath([]);
         }, 1000);
      }
   }, [path, startNode, endNode, round, rounds, score]);

   // Reset completion flag when round changes
   useEffect(() => {
      completionCalledRef.current = false;
   }, [round]);

   const handleNodeClick = useCallback(
      (row: number, col: number) => {
         if (isAnimating || completionCalledRef.current) return;

         // Check if node is an obstacle
         if (obstacles.has(`${row},${col}`)) {
            setFeedback("wrong");
            setTimeout(() => {
               setFeedback(null);
            }, 1000);
            return;
         }

         setIsAnimating(true);

         // If path is empty, must start from start node
         if (path.length === 0) {
            if (row === startNode?.row && col === startNode?.col) {
               setPath([{ row, col }]);
               setFeedback(null);
            } else {
               setFeedback("wrong");
               setTimeout(() => {
                  setFeedback(null);
               }, 1000);
            }
         } else {
            const lastNode = path[path.length - 1];
            const rowDiff = Math.abs(row - lastNode.row);
            const colDiff = Math.abs(col - lastNode.col);

            // Check if clicked node is adjacent to last node in path
            if (
               (rowDiff === 1 && colDiff === 0) ||
               (rowDiff === 0 && colDiff === 1)
            ) {
               // Check if node is already in path (allow backtracking by removing from path)
               const nodeIndex = path.findIndex(
                  (n) => n.row === row && n.col === col
               );
               if (nodeIndex >= 0) {
                  // Remove from this point onwards (backtracking)
                  setPath(path.slice(0, nodeIndex + 1));
               } else {
                  // Add to path
                  setPath([...path, { row, col }]);
               }
               setFeedback(null);
            } else {
               setFeedback("wrong");
               setTimeout(() => {
                  setFeedback(null);
               }, 1000);
            }
         }

         setTimeout(() => {
            setIsAnimating(false);
         }, 200);
      },
      [path, startNode, obstacles, isAnimating]
   );

   // Calculate progress based on rounds (like other games)
   // Use useMemo to recalculate when round changes
   const progress = useMemo(() => {
      // Progress based on rounds completed, same as Match Shapes and Balance Scale
      // round starts at 1, so for round 1, progress should be 1/20 = 5%
      return rounds > 0
         ? Math.min(100, Math.max(0, (round / rounds) * 100))
         : 0;
   }, [round, rounds]);

   // Check if node is in path
   const isInPath = (row: number, col: number) => {
      return path.some((node) => node.row === row && node.col === col);
   };

   // Get path index for visual ordering
   const getPathIndex = (row: number, col: number) => {
      return path.findIndex((node) => node.row === row && node.col === col);
   };

   // Keyboard controls
   useEffect(() => {
      if (!startNode || !endNode) return;

      const handleKeyPress = (e: KeyboardEvent) => {
         if (isAnimating || completionCalledRef.current) return;

         // Arrow keys for navigation
         if (selectedRow === null || selectedCol === null) {
            // Initialize selection at start node
            if (
               e.key === "ArrowUp" ||
               e.key === "ArrowDown" ||
               e.key === "ArrowLeft" ||
               e.key === "ArrowRight"
            ) {
               setSelectedRow(startNode.row);
               setSelectedCol(startNode.col);
               return;
            }
         }

         let newRow = selectedRow ?? startNode.row;
         let newCol = selectedCol ?? startNode.col;

         switch (e.key) {
            case "ArrowUp":
            case "w":
            case "W":
               e.preventDefault();
               newRow = Math.max(0, (selectedRow ?? startNode.row) - 1);
               setSelectedRow(newRow);
               setSelectedCol(selectedCol ?? startNode.col);
               break;
            case "ArrowDown":
            case "s":
            case "S":
               e.preventDefault();
               newRow = Math.min(
                  gridSize - 1,
                  (selectedRow ?? startNode.row) + 1
               );
               setSelectedRow(newRow);
               setSelectedCol(selectedCol ?? startNode.col);
               break;
            case "ArrowLeft":
            case "a":
            case "A":
               e.preventDefault();
               newCol = Math.max(0, (selectedCol ?? startNode.col) - 1);
               setSelectedRow(selectedRow ?? startNode.row);
               setSelectedCol(newCol);
               break;
            case "ArrowRight":
            case "d":
            case "D":
               e.preventDefault();
               newCol = Math.min(
                  gridSize - 1,
                  (selectedCol ?? startNode.col) + 1
               );
               setSelectedRow(selectedRow ?? startNode.row);
               setSelectedCol(newCol);
               break;
            case "Enter":
            case " ":
            case "e":
            case "E":
               e.preventDefault();
               if (selectedRow !== null && selectedCol !== null) {
                  handleNodeClick(selectedRow, selectedCol);
               }
               break;
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [
      startNode,
      endNode,
      isAnimating,
      selectedRow,
      selectedCol,
      gridSize,
      handleNodeClick,
   ]);

   return (
      <div className="circuit-path-game">
         {/* Header */}
         <div className="game-header">
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
                  <BoltIcon className="stat-icon" />
                  <span>Path: {path.length}</span>
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
               ></div>
            </div>
         </div>

         {/* Game Grid */}
         <div className="circuit-path-container">
            <div
               className="circuit-grid"
               style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
            >
               {Array(gridSize)
                  .fill(null)
                  .map((_, ri) =>
                     Array(gridSize)
                        .fill(null)
                        .map((_, ci) => {
                           const isStart =
                              startNode?.row === ri && startNode?.col === ci;
                           const isEnd =
                              endNode?.row === ri && endNode?.col === ci;
                           const isObstacle = obstacles.has(`${ri},${ci}`);
                           const isSelected =
                              selectedRow === ri && selectedCol === ci;
                           const inPath = isInPath(ri, ci);
                           const pathIndex = getPathIndex(ri, ci);

                           // Determine arrow direction for path nodes
                           let arrowDirection:
                              | "up"
                              | "down"
                              | "left"
                              | "right"
                              | null = null;
                           if (inPath && pathIndex > 0) {
                              const prevNode = path[pathIndex - 1];
                              const rowDiff = ri - prevNode.row;
                              const colDiff = ci - prevNode.col;

                              if (rowDiff < 0) arrowDirection = "up";
                              else if (rowDiff > 0) arrowDirection = "down";
                              else if (colDiff < 0) arrowDirection = "left";
                              else if (colDiff > 0) arrowDirection = "right";
                           }

                           return (
                              <button
                                 key={`${ri}-${ci}`}
                                 onClick={() => {
                                    if (!isObstacle) {
                                       handleNodeClick(ri, ci);
                                       setSelectedRow(ri);
                                       setSelectedCol(ci);
                                    }
                                 }}
                                 className={`circuit-node ${
                                    isStart ? "start" : ""
                                 } ${isEnd ? "end" : ""} ${
                                    isObstacle ? "obstacle" : ""
                                 } ${inPath ? "in-path" : ""} ${
                                    isSelected ? "selected" : ""
                                 } ${
                                    arrowDirection
                                       ? `path-${arrowDirection}`
                                       : ""
                                 }`}
                                 disabled={isAnimating || isObstacle}
                                 title={
                                    isStart
                                       ? "Start Node"
                                       : isEnd
                                       ? "End Node"
                                       : isObstacle
                                       ? "Obstacle (Cannot be used)"
                                       : `Node (${ri + 1}, ${ci + 1})`
                                 }
                                 style={{
                                    position: "relative",
                                 }}
                              >
                                 {isStart && (
                                    <span className="node-label">Start</span>
                                 )}
                                 {isEnd && !isStart && (
                                    <>
                                       <TrophyIcon className="circuit-icon end-icon" />
                                       <span className="node-label">End</span>
                                    </>
                                 )}
                                 {!isStart &&
                                    !isEnd &&
                                    inPath &&
                                    arrowDirection && (
                                       <>
                                          {arrowDirection === "up" && (
                                             <ArrowUpIcon className="circuit-icon path-arrow" />
                                          )}
                                          {arrowDirection === "down" && (
                                             <ArrowDownIcon className="circuit-icon path-arrow" />
                                          )}
                                          {arrowDirection === "left" && (
                                             <ArrowLeftIcon className="circuit-icon path-arrow" />
                                          )}
                                          {arrowDirection === "right" && (
                                             <ArrowRightIcon className="circuit-icon path-arrow" />
                                          )}
                                          <span className="path-number">
                                             {pathIndex + 1}
                                          </span>
                                       </>
                                    )}
                                 {!isStart &&
                                    !isEnd &&
                                    !inPath &&
                                    !isObstacle && (
                                       <CircleStackIcon className="circuit-icon node-icon" />
                                    )}
                                 {isObstacle && (
                                    <XMarkIcon className="circuit-icon obstacle-icon" />
                                 )}
                                 {isSelected && !isObstacle && (
                                    <span className="selected-badge">⌂</span>
                                 )}
                              </button>
                           );
                        })
                  )}
            </div>
         </div>

         {/* Path Lines - rendered inline with nodes */}

         {/* Feedback */}
         {feedback === "correct" && (
            <div className="game-feedback correct">
               <CheckCircleIcon className="feedback-icon" />
               <span>Circuit complete! Great job!</span>
            </div>
         )}

         {feedback === "wrong" && (
            <div className="game-feedback wrong">
               <XCircleIcon className="feedback-icon" />
               <span>Invalid path! Try again.</span>
            </div>
         )}
      </div>
   );
}

// Maze Escape (8) - Modernized
function MazeEscape({
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
   onComplete: (finalScore?: number) => void;
   onRoundComplete?: () => void;
}) {
   // Dynamic grid size based on rounds (fallback if not in config)
   const getGridSize = () => {
      // Check if grid sizes are configured in config
      if (config.gridSizes && Array.isArray(config.gridSizes)) {
         // Sort by rounds to ensure correct order (ascending)
         const sortedGridSizes = [...config.gridSizes].sort(
            (a, b) => a.rounds - b.rounds
         );

         // Find the appropriate size based on current round
         // Find the first entry where currentRound <= rounds
         for (let i = 0; i < sortedGridSizes.length; i++) {
            const { rounds, size } = sortedGridSizes[i];
            if (currentRound <= rounds) {
               console.log(
                  "[MazeEscape] Grid size for round",
                  currentRound,
                  ":",
                  size,
                  "x",
                  size,
                  "(from config)"
               );
               return size;
            }
         }
         // If no match (currentRound > all configured rounds), use the last configured size
         const lastSize = sortedGridSizes[sortedGridSizes.length - 1].size;
         console.log(
            "[MazeEscape] Grid size for round",
            currentRound,
            ":",
            lastSize,
            "x",
            lastSize,
            "(last config, round > all)"
         );
         return lastSize;
      }

      // Fallback to default progression
      let size;
      if (currentRound <= 5) {
         size = 10; // 10x10 for rounds 1-5
      } else if (currentRound <= 15) {
         size = 20; // 20x20 for rounds 6-15
      } else {
         size = 45; // 45x45 for rounds 16-20
      }
      console.log(
         "[MazeEscape] Grid size for round",
         currentRound,
         ":",
         size,
         "x",
         size,
         "(default)"
      );
      return size;
   };

   // Grid size from config or dynamic based on rounds - recalculate when currentRound changes
   const gridSize = useMemo(() => {
      if (config.size) {
         // Fixed size from config
         return config.size;
      }
      // Dynamic size based on current round
      return getGridSize();
   }, [config.size, currentRound, config.gridSizes]);
   const [maze, setMaze] = useState<number[][]>([]);
   const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
   const [exitPos, setExitPos] = useState({ x: 0, y: 0 });
   const [moves, setMoves] = useState(0);
   const [trail, setTrail] = useState<Set<string>>(new Set());
   const [isCompleted, setIsCompleted] = useState(false);
   const [showSuccess, setShowSuccess] = useState(false);
   const [roundScore, setRoundScore] = useState(0);
   const completionCalledRef = useRef(false);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);
   const onRoundCompleteRef = useRef(onRoundComplete);
   const roundTimeoutRef = useRef<NodeJS.Timeout | null>(null);

   // Keep refs updated
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
      onRoundCompleteRef.current = onRoundComplete;
   }, [onScoreUpdate, onComplete, onRoundComplete]);

   // Generate maze using Recursive Backtracker algorithm
   const generateMaze = useCallback((size: number): number[][] => {
      // Initialize maze: 0 = wall, 1 = path
      const maze: number[][] = Array(size)
         .fill(null)
         .map(() => Array(size).fill(0));

      // Start from top-left
      const start = { x: 0, y: 0 };
      const stack: { x: number; y: number }[] = [start];
      maze[start.y][start.x] = 1;

      const directions = [
         { dx: 0, dy: -1 }, // up
         { dx: 1, dy: 0 }, // right
         { dx: 0, dy: 1 }, // down
         { dx: -1, dy: 0 }, // left
      ];

      while (stack.length > 0) {
         const current = stack[stack.length - 1];
         const neighbors: {
            x: number;
            y: number;
            dir: { dx: number; dy: number };
         }[] = [];

         for (const dir of directions) {
            const nx = current.x + dir.dx * 2;
            const ny = current.y + dir.dy * 2;

            if (
               nx >= 0 &&
               nx < size &&
               ny >= 0 &&
               ny < size &&
               maze[ny][nx] === 0
            ) {
               neighbors.push({ x: nx, y: ny, dir });
            }
         }

         if (neighbors.length > 0) {
            const next =
               neighbors[Math.floor(Math.random() * neighbors.length)];
            const wallX = current.x + next.dir.dx;
            const wallY = current.y + next.dir.dy;

            maze[wallY][wallX] = 1; // Carve wall
            maze[next.y][next.x] = 1; // Carve cell
            stack.push({ x: next.x, y: next.y });
         } else {
            stack.pop();
         }
      }

      // Ensure exit is reachable (bottom-right or far corner)
      const exitCandidates = [
         { x: size - 1, y: size - 1 },
         { x: size - 1, y: size - 2 },
         { x: size - 2, y: size - 1 },
      ];

      for (const exit of exitCandidates) {
         if (maze[exit.y] && maze[exit.y][exit.x] === 1) {
            return maze;
         }
      }

      // If exit not reachable, create path to bottom-right
      maze[size - 1][size - 1] = 1;
      if (size > 1) {
         maze[size - 2][size - 1] = 1;
         maze[size - 1][size - 2] = 1;
      }

      return maze;
   }, []);

   // Initialize maze for new round - only when round changes
   useEffect(() => {
      // Reset everything for new round
      console.log(
         "[MazeEscape] Initializing new round:",
         currentRound,
         "gridSize:",
         gridSize
      );
      const newMaze = generateMaze(gridSize);
      setMaze(newMaze);
      setPlayerPos({ x: 0, y: 0 });
      setExitPos({ x: gridSize - 1, y: gridSize - 1 });
      setMoves(0);
      setTrail(new Set(["0,0"])); // Start position is always in trail
      setIsCompleted(false);
      setShowSuccess(false);
      setRoundScore(0);
      completionCalledRef.current = false;
      // Clear any pending timeout when starting new round
      if (roundTimeoutRef.current) {
         clearTimeout(roundTimeoutRef.current);
         roundTimeoutRef.current = null;
      }
      console.log(
         "[MazeEscape] Round",
         currentRound,
         "initialized successfully"
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [currentRound, gridSize]); // Depend on currentRound and gridSize

   // Check win condition
   useEffect(() => {
      // Only check if maze is initialized and player reached exit
      if (
         maze.length === 0 ||
         !maze[playerPos.y] ||
         !maze[playerPos.y][playerPos.x]
      ) {
         return; // Maze not ready
      }

      if (
         !isCompleted &&
         playerPos.x === exitPos.x &&
         playerPos.y === exitPos.y &&
         !completionCalledRef.current
      ) {
         setIsCompleted(true);
         completionCalledRef.current = true;

         // Calculate score: 100 points minus 1 point per move (min 0)
         const baseScore = 100;
         const movePenalty = Math.min(moves, 100);
         const calculatedRoundScore = Math.max(0, baseScore - movePenalty);

         setRoundScore(calculatedRoundScore);
         setShowSuccess(true);
         onScoreUpdateRef.current(calculatedRoundScore);

         // Move to next round after delay
         // Clear any existing timeout first
         if (roundTimeoutRef.current) {
            clearTimeout(roundTimeoutRef.current);
         }

         roundTimeoutRef.current = setTimeout(() => {
            setShowSuccess(false);
            if (currentRound >= maxRounds) {
               const finalScore = currentScore + calculatedRoundScore;
               onCompleteRef.current(finalScore);
            } else {
               // Trigger next round only once
               console.log(
                  "[MazeEscape] Triggering next round, currentRound:",
                  currentRound,
                  "maxRounds:",
                  maxRounds
               );
               if (onRoundCompleteRef.current) {
                  console.log("[MazeEscape] Calling onRoundComplete callback");
                  try {
                     onRoundCompleteRef.current();
                     console.log(
                        "[MazeEscape] onRoundComplete callback called successfully"
                     );
                  } catch (error) {
                     console.error(
                        "[MazeEscape] Error calling onRoundComplete:",
                        error
                     );
                  }
               } else {
                  console.warn(
                     "[MazeEscape] onRoundCompleteRef.current is null!"
                  );
               }
            }
            roundTimeoutRef.current = null;
         }, 2000);
      }
   }, [
      playerPos,
      exitPos,
      isCompleted,
      moves,
      currentRound,
      maxRounds,
      currentScore,
      maze,
   ]); // Removed callbacks from dependencies - using refs instead

   const handleKeyPress = useCallback(
      (e: KeyboardEvent) => {
         if (isCompleted) return;

         let newPos = { ...playerPos };
         let moved = false;

         if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
            if (playerPos.y > 0) {
               newPos.y--;
               moved = true;
            }
         } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
            if (playerPos.y < gridSize - 1) {
               newPos.y++;
               moved = true;
            }
         } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
            if (playerPos.x > 0) {
               newPos.x--;
               moved = true;
            }
         } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
            if (playerPos.x < gridSize - 1) {
               newPos.x++;
               moved = true;
            }
         }

         if (moved) {
            // Check if new position is valid (not a wall)
            if (
               newPos.x >= 0 &&
               newPos.x < gridSize &&
               newPos.y >= 0 &&
               newPos.y < gridSize &&
               maze[newPos.y] &&
               maze[newPos.y][newPos.x] === 1
            ) {
               setPlayerPos(newPos);
               setMoves((prev) => prev + 1);
               // Add to trail
               setTrail((prev) => {
                  const newTrail = new Set(prev);
                  newTrail.add(`${newPos.x},${newPos.y}`);
                  return newTrail;
               });
            }
         }
      },
      [playerPos, gridSize, maze, isCompleted]
   );

   // Handle mouse click on maze cell
   const handleCellClick = useCallback(
      (x: number, y: number) => {
         if (isCompleted) return;

         // Check if clicked cell is adjacent to player (up, down, left, right)
         const dx = Math.abs(x - playerPos.x);
         const dy = Math.abs(y - playerPos.y);
         const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);

         if (!isAdjacent) return; // Only allow adjacent cells

         // Check if clicked cell is valid (not a wall)
         if (
            x >= 0 &&
            x < gridSize &&
            y >= 0 &&
            y < gridSize &&
            maze[y] &&
            maze[y][x] === 1
         ) {
            setPlayerPos({ x, y });
            setMoves((prev) => prev + 1);
            // Add to trail
            setTrail((prev) => {
               const newTrail = new Set(prev);
               newTrail.add(`${x},${y}`);
               return newTrail;
            });
         }
      },
      [playerPos, gridSize, maze, isCompleted]
   );

   // Handle mouse hover on maze cell - auto-move to valid adjacent cells
   const handleCellHover = useCallback(
      (x: number, y: number) => {
         if (isCompleted) return;

         // Check if hovered cell is adjacent to player (up, down, left, right)
         const dx = Math.abs(x - playerPos.x);
         const dy = Math.abs(y - playerPos.y);
         const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);

         if (!isAdjacent) return; // Only allow adjacent cells

         // Check if hovered cell is valid (not a wall) and not already in trail
         if (
            x >= 0 &&
            x < gridSize &&
            y >= 0 &&
            y < gridSize &&
            maze[y] &&
            maze[y][x] === 1 &&
            !trail.has(`${x},${y}`) // Don't move to cells already visited
         ) {
            setPlayerPos({ x, y });
            setMoves((prev) => prev + 1);
            // Add to trail
            setTrail((prev) => {
               const newTrail = new Set(prev);
               newTrail.add(`${x},${y}`);
               return newTrail;
            });
         }
      },
      [playerPos, gridSize, maze, isCompleted, trail]
   );

   useEffect(() => {
      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [handleKeyPress]);

   // Calculate progress based on rounds (like other games - Balance Scale uses currentRound / maxRounds)
   // Calculate progress based on rounds - use useMemo to update when currentRound changes
   const progress = useMemo(() => {
      return maxRounds > 0
         ? Math.min(100, Math.max(0, (currentRound / maxRounds) * 100))
         : 0;
   }, [currentRound, maxRounds]);
   const maxScore = maxRounds * 100;
   const displayScore = currentScore;

   return (
      <div className="maze-escape-game">
         {/* Header */}
         <div className="game-header">
            <div className="header-stats">
               <div className="stat-item">
                  <ArrowPathIcon className="stat-icon" />
                  <span>
                     Round {currentRound} / {maxRounds}
                  </span>
               </div>
               <div className="stat-item">
                  <TrophyIcon className="stat-icon" />
                  <span>
                     Score: {displayScore} / {maxScore}
                  </span>
               </div>
               <div className="stat-item">
                  <BoltIcon className="stat-icon" />
                  <span>Path: {trail.size}</span>
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

         {/* Maze Grid */}
         <div className="maze-container">
            <div
               className="maze-grid"
               style={{
                  gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                  gridTemplateRows: `repeat(${gridSize}, 1fr)`,
               }}
            >
               {Array.from({ length: gridSize * gridSize }).map((_, i) => {
                  const x = i % gridSize;
                  const y = Math.floor(i / gridSize);
                  const isWall = !maze[y] || maze[y][x] === 0;
                  const isPlayer = playerPos.x === x && playerPos.y === y;
                  const isExit =
                     exitPos.x === x && exitPos.y === y && !isPlayer;
                  const isStart = x === 0 && y === 0 && !isPlayer && !isExit;
                  const isTrail =
                     trail.has(`${x},${y}`) && !isPlayer && !isExit && !isStart;
                  const isPath =
                     !isWall && !isPlayer && !isExit && !isTrail && !isStart;

                  // Check if cell is adjacent to player (for mouse click)
                  const dx = Math.abs(x - playerPos.x);
                  const dy = Math.abs(y - playerPos.y);
                  const isAdjacent =
                     !isWall &&
                     !isPlayer &&
                     ((dx === 1 && dy === 0) || (dx === 0 && dy === 1));
                  const isClickable = isAdjacent && !isCompleted;

                  return (
                     <div
                        key={i}
                        className={`maze-cell ${isWall ? "wall" : ""} ${
                           isPlayer ? "player" : ""
                        } ${isExit ? "exit" : ""} ${isStart ? "start" : ""} ${
                           isTrail ? "trail" : ""
                        } ${isPath ? "path" : ""} ${
                           isClickable ? "clickable" : ""
                        }`}
                        onClick={() => handleCellClick(x, y)}
                        onMouseEnter={() => handleCellHover(x, y)}
                        style={{ cursor: isClickable ? "pointer" : "default" }}
                     >
                        {isPlayer && (
                           <div className="player-marker">
                              <BoltIcon className="player-icon" />
                           </div>
                        )}
                        {isExit && (
                           <div className="exit-marker">
                              <TrophyIcon className="exit-icon" />
                           </div>
                        )}
                        {isStart && <div className="start-marker" />}
                        {isTrail && <div className="trail-dot" />}
                     </div>
                  );
               })}
            </div>
         </div>

         {/* Success Message - positioned below the maze like Circuit Path */}
         {showSuccess && (
            <div className="game-feedback correct">
               <CheckCircleIcon className="feedback-icon" />
               <span>
                  Round {currentRound} Complete! Score: {roundScore} points
               </span>
            </div>
         )}
      </div>
   );
}

// Pattern Completion (9) - Modernized
function PatternCompletion({
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
   // Debug: Log config to see what we're receiving
   useEffect(() => {
      console.log("[PatternCompletion] Config received:", config);
      console.log("[PatternCompletion] Config.rounds:", config?.rounds);
      console.log(
         "[PatternCompletion] Config.totalRounds:",
         config?.totalRounds
      );
      console.log("[PatternCompletion] Config.shapes:", config?.shapes);
      console.log(
         "[PatternCompletion] Config.patternRules:",
         config?.patternRules
      );
   }, [config]);

   const rounds = config?.totalRounds || config?.rounds || maxRounds;
   const [pattern, setPattern] = useState<string[]>([]);
   const [options, setOptions] = useState<string[]>([]);
   const [correctIndex, setCorrectIndex] = useState(0);
   const [selected, setSelected] = useState<number | null>(null);
   const [correct, setCorrect] = useState<boolean | null>(null);
   const [round, setRound] = useState(1);
   const [score, setScore] = useState(0);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const completionCalledRef = useRef(false);
   const roundCompleteRef = useRef<number | null>(null);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);
   const onRoundCompleteRef = useRef(onRoundComplete);

   // Update refs when callbacks change
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
      onRoundCompleteRef.current = onRoundComplete;
   }, [onScoreUpdate, onComplete, onRoundComplete]);

   // Heroicons mapping
   const getShapeIcon = (shapeName: string, size: number = 80) => {
      const iconProps = {
         width: size,
         height: size,
         className: "pattern-icon",
      };
      switch (shapeName) {
         case "Home":
            return <HomeIcon {...iconProps} />;
         case "Star":
            return <StarIcon {...iconProps} />;
         case "Heart":
            return <HeartIcon {...iconProps} />;
         case "Circle":
         case "circle":
            return <CircleStackIcon {...iconProps} />;
         case "Square":
         case "square":
            return <CubeIcon {...iconProps} />;
         case "Triangle":
         case "triangle":
            return (
               <PlusIcon
                  {...iconProps}
                  style={{ transform: "rotate(45deg)" }}
               />
            );
         default:
            return <SparklesIcon {...iconProps} />;
      }
   };

   // Get pattern rules based on round
   const getPatternRules = useCallback(
      (roundNum: number): { patternLength: number; repeatSize: number } => {
         // Check if patternRules is configured in game_config
         if (config?.patternRules && Array.isArray(config.patternRules)) {
            // Sort by rounds ascending to find the first match
            const sorted = [...config.patternRules].sort(
               (a, b) => a.rounds - b.rounds
            );

            // Find the matching pattern rules based on rounds
            for (let i = 0; i < sorted.length; i++) {
               const {
                  rounds: maxRounds,
                  patternLength,
                  repeatSize,
               } = sorted[i];
               if (roundNum <= maxRounds) {
                  console.log(
                     "[PatternCompletion] Round",
                     roundNum,
                     "matches patternLength",
                     patternLength,
                     "repeatSize",
                     repeatSize,
                     "for rounds up to",
                     maxRounds
                  );
                  return { patternLength, repeatSize };
               }
            }
            // Default to last configured rules if round exceeds all
            const lastRule = sorted[sorted.length - 1];
            console.log(
               "[PatternCompletion] Round",
               roundNum,
               "exceeds all configured rounds, using last rule:",
               lastRule
            );
            return {
               patternLength: lastRule.patternLength,
               repeatSize: lastRule.repeatSize,
            };
         }
         // Default pattern rules based on rounds
         console.log(
            "[PatternCompletion] Using default pattern rules for round",
            roundNum
         );
         if (roundNum <= 5) {
            return { patternLength: 6, repeatSize: 3 }; // Rounds 1-5: 6 shapes, 3 repeat
         }
         if (roundNum <= 10) {
            return { patternLength: 9, repeatSize: 3 }; // Rounds 6-10: 9 shapes, 3 repeat
         }
         return { patternLength: 13, repeatSize: 4 }; // Rounds 11+: 13 shapes, 4 repeat
      },
      [config?.patternRules]
   );

   // Initialize new round
   const startNewRound = useCallback(() => {
      // Use Heroicons instead of CSS shapes
      const shapes = config?.shapes || ["Home", "Star", "Heart", "Circle"];
      const { patternLength, repeatSize } = getPatternRules(round);
      console.log(
         "[PatternCompletion] Starting round",
         round,
         "with patternLength",
         patternLength,
         "repeatSize",
         repeatSize,
         "and shapes",
         shapes
      );

      const repeatLength = repeatSize;

      // Generate repeating sequence
      // Select random shapes for the repeating sequence
      const availableShapes = [...shapes];
      const repeatingSequence: string[] = [];

      // Ensure we have enough unique shapes for the repeating sequence
      for (let i = 0; i < repeatLength; i++) {
         if (availableShapes.length > 0) {
            const randomIndex = Math.floor(
               Math.random() * availableShapes.length
            );
            repeatingSequence.push(availableShapes[randomIndex]);
            // Remove the selected shape to avoid duplicates if possible
            availableShapes.splice(randomIndex, 1);
         } else {
            // If we run out of unique shapes, reuse from the sequence
            repeatingSequence.push(
               repeatingSequence[i % repeatingSequence.length]
            );
         }
      }

      console.log("[PatternCompletion] Repeating sequence:", repeatingSequence);

      // Generate full pattern by repeating the sequence
      // First, generate the complete pattern with all shapes
      const fullPattern: string[] = [];
      for (let i = 0; i < patternLength; i++) {
         fullPattern.push(repeatingSequence[i % repeatLength]);
      }

      console.log(
         "[PatternCompletion] Full pattern before missing:",
         fullPattern
      );

      // Determine which position should be the missing one (random position)
      const missingPosition = Math.floor(Math.random() * patternLength);
      console.log(
         "[PatternCompletion] Missing position:",
         missingPosition,
         "out of",
         patternLength
      );

      // Calculate what the missing shape should be based on the repeating pattern
      const missingShape = repeatingSequence[missingPosition % repeatLength];
      console.log("[PatternCompletion] Missing shape should be:", missingShape);

      // Create pattern with "?" at the missing position
      const patternWithMissing: string[] = [...fullPattern];
      patternWithMissing[missingPosition] = "?";

      console.log(
         "[PatternCompletion] Final pattern with missing:",
         patternWithMissing
      );

      const allOptions = [...shapes].sort(() => Math.random() - 0.5);

      setPattern(patternWithMissing);
      setOptions(allOptions);
      setCorrectIndex(allOptions.indexOf(missingShape));
      setSelected(null);
      setCorrect(null);
      setFeedback(null);
   }, [config?.shapes, round, getPatternRules]);

   // Initialize first round
   useEffect(() => {
      startNewRound();
   }, [startNewRound]);

   // Calculate progress
   const progress = useMemo(() => {
      return rounds > 0
         ? Math.min(100, Math.max(0, (round / rounds) * 100))
         : 0;
   }, [round, rounds]);

   const handleSelect = (index: number) => {
      if (selected !== null) return; // Prevent multiple selections

      setSelected(index);
      const isCorrect = index === correctIndex;
      setCorrect(isCorrect);
      setFeedback(isCorrect ? "correct" : "wrong");

      if (isCorrect) {
         const roundScore = 5;
         const newScore = score + roundScore;
         setScore(newScore);
         onScoreUpdateRef.current(newScore);

         // Move to next round or complete
         if (round < rounds) {
            setTimeout(() => {
               setRound(round + 1);
               startNewRound();
            }, 1500);
         } else {
            // All rounds completed
            setTimeout(() => {
               if (onCompleteRef.current && !completionCalledRef.current) {
                  completionCalledRef.current = true;
                  onCompleteRef.current(newScore);
               }
            }, 1500);
         }
      } else {
         // Wrong answer - allow retry after feedback
         setTimeout(() => {
            setSelected(null);
            setCorrect(null);
            setFeedback(null);
         }, 1000);
      }
   };

   // Keyboard controls (1-4 for options)
   const handleKeyPress = useCallback(
      (e: KeyboardEvent) => {
         if (selected !== null) return; // Don't allow keyboard input if already selected

         const key = e.key;
         if (key >= "1" && key <= "4") {
            const index = parseInt(key) - 1;
            if (index < options.length) {
               handleSelect(index);
            }
         }
      },
      [options.length, selected]
   );

   useEffect(() => {
      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [handleKeyPress]);

   return (
      <div className="pattern-completion-game">
         {/* Header */}
         <div className="game-header">
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

         {/* Pattern Display */}
         <div
            className={`pattern-display ${pattern.length > 6 ? "compact" : ""}`}
         >
            {pattern.map((shape, i) => {
               // Reduce icon size if pattern has more than 6 elements
               const iconSize = pattern.length > 6 ? 60 : 100;
               return (
                  <div
                     key={i}
                     className={`pattern-shape ${
                        shape === "?" ? "missing" : ""
                     } ${pattern.length > 6 ? "small" : ""}`}
                  >
                     {shape !== "?" ? (
                        getShapeIcon(shape, iconSize)
                     ) : (
                        <div className="missing-shape">
                           <SparklesIcon
                              width={iconSize}
                              height={iconSize}
                              className="pattern-icon"
                           />
                           <span className="question-mark">?</span>
                        </div>
                     )}
                  </div>
               );
            })}
         </div>

         {/* Options */}
         <div className="pattern-options">
            {options.map((shape, i) => (
               <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  className={`option-btn ${
                     selected === i ? (correct ? "correct" : "incorrect") : ""
                  }`}
                  disabled={selected !== null}
               >
                  {getShapeIcon(shape, 80)}
                  <span className="option-number">{i + 1}</span>
               </button>
            ))}
         </div>

         {/* Feedback */}
         {feedback && (
            <div className={`game-feedback ${feedback}`}>
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon className="feedback-icon" />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon className="feedback-icon" />
                     <span>Wrong! Try again.</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
}

// Modern Sudoku 4x4 (10)
function Sudoku4x4({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}) {
   const [grid, setGrid] = useState<(number | null)[][]>([]);
   const [initialGrid, setInitialGrid] = useState<(number | null)[][]>([]);
   const [selected, setSelected] = useState<{
      row: number;
      col: number;
   } | null>(null);
   const [errors, setErrors] = useState<Set<string>>(new Set());
   const [isComplete, setIsComplete] = useState(false);
   const [feedback, setFeedback] = useState<string>("");
   const completionCalledRef = useRef(false);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);

   // Update refs when callbacks change
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
   }, [onScoreUpdate, onComplete]);

   // Generate a random valid 4x4 Sudoku puzzle
   const generateSudokuPuzzle = (): (number | null)[][] => {
      // Helper function to check if a number can be placed
      const isValid = (
         grid: (number | null)[][],
         row: number,
         col: number,
         num: number
      ): boolean => {
         // Check row
         for (let c = 0; c < 4; c++) {
            if (grid[row][c] === num) return false;
         }

         // Check column
         for (let r = 0; r < 4; r++) {
            if (grid[r][col] === num) return false;
         }

         // Check 2x2 box
         const boxRow = Math.floor(row / 2) * 2;
         const boxCol = Math.floor(col / 2) * 2;
         for (let r = boxRow; r < boxRow + 2; r++) {
            for (let c = boxCol; c < boxCol + 2; c++) {
               if (grid[r][c] === num) return false;
            }
         }

         return true;
      };

      // Helper function to solve Sudoku using backtracking
      const solveSudoku = (grid: (number | null)[][]): boolean => {
         for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
               if (grid[r][c] === null) {
                  // Try numbers 1-4 in random order
                  const numbers = [1, 2, 3, 4];
                  for (let i = numbers.length - 1; i > 0; i--) {
                     const j = Math.floor(Math.random() * (i + 1));
                     [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
                  }

                  for (const num of numbers) {
                     if (isValid(grid, r, c, num)) {
                        grid[r][c] = num;
                        if (solveSudoku(grid)) {
                           return true;
                        }
                        grid[r][c] = null;
                     }
                  }
                  return false;
               }
            }
         }
         return true;
      };

      // Start with empty grid
      const solution: (number | null)[][] = Array(4)
         .fill(null)
         .map(() => Array(4).fill(null));

      // Generate a random valid solution
      solveSudoku(solution);

      // Create puzzle by removing some cells
      const puzzle: (number | null)[][] = solution.map((row) => [...row]);

      // Remove 6-8 cells randomly (keeping 8-10 clues for a solvable puzzle)
      const cellsToRemove = 6 + Math.floor(Math.random() * 3); // 6, 7, or 8
      const positions: Array<[number, number]> = [];
      for (let r = 0; r < 4; r++) {
         for (let c = 0; c < 4; c++) {
            positions.push([r, c]);
         }
      }

      // Shuffle positions
      for (let i = positions.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [positions[i], positions[j]] = [positions[j], positions[i]];
      }

      // Remove cells
      for (let i = 0; i < cellsToRemove && i < positions.length; i++) {
         const [r, c] = positions[i];
         puzzle[r][c] = null;
      }

      return puzzle;
   };

   // Generate a new puzzle when game starts
   useEffect(() => {
      if (isPlaying) {
         const newPuzzle = generateSudokuPuzzle();
         setGrid(newPuzzle);
         setInitialGrid(newPuzzle.map((row) => [...row]));
         setIsComplete(false);
         setFeedback("");
         setSelected(null);
         setErrors(new Set());
         completionCalledRef.current = false; // Reset completion flag
      }
   }, [isPlaying]);

   // Keyboard navigation for Sudoku
   useEffect(() => {
      if (!isPlaying) return;

      const handleKeyPress = (e: KeyboardEvent) => {
         // Arrow keys to navigate
         if (selected) {
            let newRow = selected.row;
            let newCol = selected.col;

            if (e.key === "ArrowUp" && newRow > 0) {
               e.preventDefault();
               newRow--;
            } else if (e.key === "ArrowDown" && newRow < 3) {
               e.preventDefault();
               newRow++;
            } else if (e.key === "ArrowLeft" && newCol > 0) {
               e.preventDefault();
               newCol--;
            } else if (e.key === "ArrowRight" && newCol < 3) {
               e.preventDefault();
               newCol++;
            }

            // Move to the new cell if it's not an initial clue
            // Allow navigation to any cell (empty or filled) as long as it's not an initial clue
            if (
               (newRow !== selected.row || newCol !== selected.col) &&
               initialGrid[newRow]?.[newCol] === null
            ) {
               setSelected({ row: newRow, col: newCol });
            } else if (
               (newRow !== selected.row || newCol !== selected.col) &&
               initialGrid[newRow]?.[newCol] !== null
            ) {
               // If target cell is an initial clue, try to find next available cell in that direction
               let found = false;
               if (e.key === "ArrowUp") {
                  for (let r = newRow - 1; r >= 0; r--) {
                     if (initialGrid[r]?.[newCol] === null) {
                        setSelected({ row: r, col: newCol });
                        found = true;
                        break;
                     }
                  }
               } else if (e.key === "ArrowDown") {
                  for (let r = newRow + 1; r < 4; r++) {
                     if (initialGrid[r]?.[newCol] === null) {
                        setSelected({ row: r, col: newCol });
                        found = true;
                        break;
                     }
                  }
               } else if (e.key === "ArrowLeft") {
                  for (let c = newCol - 1; c >= 0; c--) {
                     if (initialGrid[newRow]?.[c] === null) {
                        setSelected({ row: newRow, col: c });
                        found = true;
                        break;
                     }
                  }
               } else if (e.key === "ArrowRight") {
                  for (let c = newCol + 1; c < 4; c++) {
                     if (initialGrid[newRow]?.[c] === null) {
                        setSelected({ row: newRow, col: c });
                        found = true;
                        break;
                     }
                  }
               }
            }
         } else {
            // If no cell selected, select first available cell
            if (e.key.startsWith("Arrow")) {
               e.preventDefault();
               for (let r = 0; r < 4; r++) {
                  for (let c = 0; c < 4; c++) {
                     if (initialGrid[r]?.[c] === null) {
                        setSelected({ row: r, col: c });
                        return;
                     }
                  }
               }
            }
         }

         // Backspace/Delete to clear selected cell
         if (
            (e.key === "Backspace" || e.key === "Delete") &&
            selected &&
            initialGrid[selected.row]?.[selected.col] === null
         ) {
            e.preventDefault();
            // Clear the selected cell
            const newGrid = grid.map((r, ri) =>
               r.map((c, ci) =>
                  ri === selected.row && ci === selected.col ? null : c
               )
            );
            setGrid(newGrid);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [isPlaying, selected, initialGrid, grid]);

   // Check for errors and update error set
   useEffect(() => {
      if (grid.length === 0) return;

      const validateCell = (
         row: number,
         col: number,
         value: number | null
      ): boolean => {
         if (value === null) return true;

         // Check row
         for (let c = 0; c < 4; c++) {
            if (c !== col && grid[row] && grid[row][c] === value) return false;
         }

         // Check column
         for (let r = 0; r < 4; r++) {
            if (r !== row && grid[r] && grid[r][col] === value) return false;
         }

         // Check 2x2 box
         const boxRow = Math.floor(row / 2) * 2;
         const boxCol = Math.floor(col / 2) * 2;
         for (let r = boxRow; r < boxRow + 2; r++) {
            for (let c = boxCol; c < boxCol + 2; c++) {
               if (r !== row && c !== col && grid[r] && grid[r][c] === value)
                  return false;
            }
         }

         return true;
      };

      const newErrors = new Set<string>();
      for (let r = 0; r < 4; r++) {
         for (let c = 0; c < 4; c++) {
            if (
               grid[r] &&
               grid[r][c] !== null &&
               !validateCell(r, c, grid[r][c])
            ) {
               newErrors.add(`${r}-${c}`);
            }
         }
      }
      setErrors(newErrors);
   }, [grid]);

   // Check if puzzle is complete and valid
   useEffect(() => {
      if (grid.length === 0) return;

      const allFilled = grid.every((row) => row.every((cell) => cell !== null));
      if (allFilled && errors.size === 0 && !completionCalledRef.current) {
         setIsComplete(true);
         setFeedback("🎉 Perfect! Puzzle solved!");
         const score = 100;
         completionCalledRef.current = true; // Prevent multiple calls
         onScoreUpdateRef.current(score);
         setTimeout(() => {
            onCompleteRef.current(score);
         }, 1500);
      } else if (allFilled && errors.size > 0) {
         setFeedback("❌ Some cells have errors. Check your solution!");
      } else if (!allFilled) {
         setFeedback("");
      }
   }, [grid, errors]);

   const handleCellClick = (row: number, col: number) => {
      // Can't edit initial clues
      if (initialGrid[row]?.[col] !== null) return;

      // Allow clicking on any cell (including cells with errors)
      // If clicking on the same cell, deselect it
      if (selected?.row === row && selected?.col === col) {
         setSelected(null);
      } else {
         setSelected({ row, col });
      }
   };

   const handleNumberSelect = (num: number) => {
      if (!selected) return;
      if (initialGrid[selected.row]?.[selected.col] !== null) return;

      const newGrid = grid.map((r, ri) =>
         r.map((c, ci) =>
            ri === selected.row && ci === selected.col ? num : c
         )
      );
      setGrid(newGrid);
      // Keep selection active so user can continue editing or move to next cell
      // User can click another cell or press a number to change it
   };

   const handleClear = () => {
      if (!selected) return;
      if (initialGrid[selected.row]?.[selected.col] !== null) return;

      const newGrid = grid.map((r, ri) =>
         r.map((c, ci) =>
            ri === selected.row && ci === selected.col ? null : c
         )
      );
      setGrid(newGrid);
      // Keep selection active so user can continue editing
   };

   const isInitialCell = (row: number, col: number) => {
      return initialGrid[row]?.[col] !== null;
   };

   const getBoxClass = (row: number, col: number) => {
      const boxRow = Math.floor(row / 2);
      const boxCol = Math.floor(col / 2);
      return `box-${boxRow}-${boxCol}`;
   };

   return (
      <div className="sudoku-game-modern">
         <div className="sudoku-header">
            <h3>Sudoku 4x4</h3>
            {feedback && (
               <div
                  className={`sudoku-feedback ${
                     isComplete ? "success" : "error"
                  }`}
               >
                  {feedback}
               </div>
            )}
         </div>

         <div className="sudoku-container">
            <div className="sudoku-grid-modern">
               {grid.map((row, ri) =>
                  row.map((cell, ci) => {
                     const cellKey = `${ri}-${ci}`;
                     const isError = errors.has(cellKey);
                     const isInitial = isInitialCell(ri, ci);
                     const isSelected =
                        selected?.row === ri && selected?.col === ci;

                     return (
                        <button
                           key={cellKey}
                           onClick={() => handleCellClick(ri, ci)}
                           className={`sudoku-cell-modern ${getBoxClass(
                              ri,
                              ci
                           )} ${isInitial ? "initial" : ""} ${
                              isSelected ? "selected" : ""
                           } ${isError ? "error" : ""}`}
                           disabled={isInitial}
                           title={
                              isError
                                 ? "This cell has an error. Click to select and fix it."
                                 : isInitial
                                 ? "This is a clue and cannot be changed"
                                 : "Click to select this cell"
                           }
                        >
                           {cell || ""}
                        </button>
                     );
                  })
               )}
            </div>

            {selected && (
               <div className="sudoku-controls">
                  <NumberKeypad
                     onNumberSelect={handleNumberSelect}
                     onClear={handleClear}
                     minNumber={1}
                     maxNumber={4}
                     showClear={true}
                     className="sudoku-keypad"
                  />
               </div>
            )}
         </div>
      </div>
   );
}

// Rotate to Fit (11) - Modernized with Multiple Objects
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

         {/* Success Notification */}
         {feedback === "correct" && (
            <div className="success-notification">
               <CheckCircleIcon className="success-icon" />
               <div className="success-content">
                  <div className="success-title">Perfect Fit!</div>
                  <div className="success-message">
                     Great job! Moving to next round...
                  </div>
               </div>
            </div>
         )}

         {/* Feedback */}
         {feedback && feedback !== "correct" && (
            <div className={`game-feedback ${feedback}`}>
               <XCircleIcon className="feedback-icon" />
               <span>Keep rotating...</span>
            </div>
         )}
      </div>
   );
}

// Mirror Match (12)
function MirrorMatch({
   config,
   onScoreUpdate,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
}) {
   const [pairs, setPairs] = useState<
      Array<{ left: string; right: string; isMirror: boolean }>
   >([]);
   const [selected, setSelected] = useState<number | null>(null);
   const [correct, setCorrect] = useState<boolean | null>(null);

   useEffect(() => {
      const shapes = ["circle", "square", "triangle"];
      const newPairs = Array.from({ length: 3 }, () => {
         const shape = shapes[Math.floor(Math.random() * shapes.length)];
         const isMirror = Math.random() > 0.5;
         return {
            left: shape,
            right: isMirror
               ? shape
               : shapes[Math.floor(Math.random() * shapes.length)],
            isMirror,
         };
      });
      setPairs(newPairs);
      setSelected(null);
      setCorrect(null);
   }, []);

   const handleSelect = (index: number, isMirror: boolean) => {
      setSelected(index);
      const isCorrect = pairs[index].isMirror === isMirror;
      setCorrect(isCorrect);
      onScoreUpdate(isCorrect ? 100 : 0);
   };

   return (
      <div className="mirror-match-game">
         <h3>Mirror Match</h3>
         {pairs.map((pair, i) => (
            <div key={i} className="mirror-pair">
               <div className={`shape ${pair.left}`}></div>
               <div className={`shape ${pair.right}`}></div>
               <div className="mirror-options">
                  <button
                     onClick={() => handleSelect(i, true)}
                     className={
                        selected === i ? (correct ? "correct" : "") : ""
                     }
                  >
                     Mirror
                  </button>
                  <button
                     onClick={() => handleSelect(i, false)}
                     className={
                        selected === i ? (!correct ? "incorrect" : "") : ""
                     }
                  >
                     Different
                  </button>
               </div>
            </div>
         ))}
      </div>
   );
}

// Logic Gates Lite (13)
function LogicGates({
   config,
   onScoreUpdate,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
}) {
   const [gate, setGate] = useState<"AND" | "OR">("AND");
   const [input1, setInput1] = useState(0);
   const [input2, setInput2] = useState(0);
   const [selected, setSelected] = useState<number | null>(null);
   const [correct, setCorrect] = useState<boolean | null>(null);

   useEffect(() => {
      const gates: ("AND" | "OR")[] = ["AND", "OR"];
      setGate(gates[Math.floor(Math.random() * gates.length)]);
      setInput1(Math.floor(Math.random() * 2));
      setInput2(Math.floor(Math.random() * 2));
      setSelected(null);
      setCorrect(null);
   }, []);

   const getOutput = () => {
      if (gate === "AND") return input1 && input2 ? 1 : 0;
      return input1 || input2 ? 1 : 0;
   };

   const handleSelect = (output: number) => {
      setSelected(output);
      const isCorrect = output === getOutput();
      setCorrect(isCorrect);
      onScoreUpdate(isCorrect ? 100 : 0);
   };

   return (
      <div className="logic-gates-game">
         <h3>Logic Gates</h3>
         <div className="gate-display">
            <div>Input 1: {input1}</div>
            <div>Gate: {gate}</div>
            <div>Input 2: {input2}</div>
            <div>Output: ?</div>
         </div>
         <div className="output-options">
            <button
               onClick={() => handleSelect(0)}
               className={
                  selected === 0 ? (correct ? "correct" : "incorrect") : ""
               }
            >
               0
            </button>
            <button
               onClick={() => handleSelect(1)}
               className={
                  selected === 1 ? (correct ? "correct" : "incorrect") : ""
               }
            >
               1
            </button>
         </div>
         {correct !== null && (
            <p className={correct ? "correct-message" : "incorrect-message"}>
               {correct ? "Correct!" : "Wrong!"}
            </p>
         )}
      </div>
   );
}

// Sequence Arrows (14)
function SequenceArrows({
   config,
   onScoreUpdate,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
}) {
   const [sequence, setSequence] = useState<string[]>([]);
   const [options, setOptions] = useState<string[]>([]);
   const [correctIndex, setCorrectIndex] = useState(0);
   const [selected, setSelected] = useState<number | null>(null);
   const [correct, setCorrect] = useState<boolean | null>(null);

   const arrowMap: Record<string, JSX.Element> = {
      up: <ArrowUpIcon style={{ width: 32, height: 32 }} />,
      down: <ArrowDownIcon style={{ width: 32, height: 32 }} />,
      left: <ArrowLeftIcon style={{ width: 32, height: 32 }} />,
      right: <ArrowRightIcon style={{ width: 32, height: 32 }} />,
   };

   useEffect(() => {
      const arrowKeys = ["up", "down", "left", "right"];
      const pattern = Array.from(
         { length: 3 },
         () => arrowKeys[Math.floor(Math.random() * arrowKeys.length)]
      );
      const next = arrowKeys[Math.floor(Math.random() * arrowKeys.length)];
      const allOptions = [...arrowKeys].sort(() => Math.random() - 0.5);

      setSequence([...pattern, "?"]);
      setOptions(allOptions);
      setCorrectIndex(allOptions.indexOf(next));
      setSelected(null);
      setCorrect(null);
   }, []);

   const handleSelect = (index: number) => {
      setSelected(index);
      const isCorrect = index === correctIndex;
      setCorrect(isCorrect);
      onScoreUpdate(isCorrect ? 100 : 0);
   };

   return (
      <div className="sequence-arrows-game">
         <h3>Sequence Arrows</h3>
         <div
            className="arrow-sequence"
            style={{
               display: "flex",
               gap: "12px",
               justifyContent: "center",
               alignItems: "center",
            }}
         >
            {sequence.map((arrow, i) => (
               <span
                  key={i}
                  className="arrow"
                  style={{
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     width: "48px",
                     height: "48px",
                  }}
               >
                  {arrow === "?" ? "?" : arrowMap[arrow]}
               </span>
            ))}
         </div>
         <div
            className="arrow-options"
            style={{
               display: "flex",
               gap: "12px",
               justifyContent: "center",
               marginTop: "20px",
            }}
         >
            {options.map((arrow, i) => (
               <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  className={`arrow-btn ${
                     selected === i ? (correct ? "correct" : "incorrect") : ""
                  }`}
                  style={{
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     width: "64px",
                     height: "64px",
                     padding: "12px",
                  }}
               >
                  {arrowMap[arrow]}
               </button>
            ))}
         </div>
         {correct !== null && (
            <p
               className={correct ? "correct-message" : "incorrect-message"}
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  justifyContent: "center",
                  marginTop: "16px",
               }}
            >
               {correct ? (
                  <>
                     <CheckCircleIcon style={{ width: 20, height: 20 }} />
                     <span>Correct!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon style={{ width: 20, height: 20 }} />
                     <span>Wrong!</span>
                  </>
               )}
            </p>
         )}
      </div>
   );
}

// Block Fill (15)
function BlockFill({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const gridSize = config.gridSize || 4;
   const [grid, setGrid] = useState<boolean[][]>([]);
   const [blocks, setBlocks] = useState<
      Array<{ id: number; shape: number[][] }>
   >([]);
   const [selectedBlock, setSelectedBlock] = useState<number | null>(null);

   useEffect(() => {
      const newGrid = Array(gridSize)
         .fill(null)
         .map(() => Array(gridSize).fill(false));
      setGrid(newGrid);

      const blockShapes = [
         [
            [1, 1],
            [1, 1],
         ],
         [[1, 1, 1]],
         [[1], [1], [1]],
         [
            [1, 1],
            [1, 0],
         ],
      ];
      setBlocks(blockShapes.map((shape, i) => ({ id: i, shape })));
   }, []);

   useEffect(() => {
      const isFilled = grid.every((row) => row.every((cell) => cell));
      if (isFilled && grid.length > 0 && blocks.length === 0) {
         onScoreUpdate(100);
         setTimeout(() => onComplete(100), 1000);
      }
   }, [grid, blocks, onScoreUpdate, onComplete]);

   const canPlace = (block: number[][], row: number, col: number) => {
      for (let r = 0; r < block.length; r++) {
         for (let c = 0; c < block[r].length; c++) {
            if (
               block[r][c] &&
               (row + r >= gridSize ||
                  col + c >= gridSize ||
                  grid[row + r][col + c])
            ) {
               return false;
            }
         }
      }
      return true;
   };

   const placeBlock = (blockId: number, row: number, col: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block || !canPlace(block.shape, row, col)) return;

      const newGrid = grid.map((r) => [...r]);
      for (let r = 0; r < block.shape.length; r++) {
         for (let c = 0; c < block.shape[r].length; c++) {
            if (block.shape[r][c]) {
               newGrid[row + r][col + c] = true;
            }
         }
      }
      setGrid(newGrid);
      setBlocks(blocks.filter((b) => b.id !== blockId));
      setSelectedBlock(null);
   };

   return (
      <div className="block-fill-game">
         <h3>Block Fill</h3>
         <div className="blocks-available">
            {blocks.map((block) => (
               <button
                  key={block.id}
                  onClick={() => setSelectedBlock(block.id)}
                  className={`block-btn ${
                     selectedBlock === block.id ? "selected" : ""
                  }`}
               >
                  Block {block.id + 1}
               </button>
            ))}
         </div>
         <div
            className="fill-grid"
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
         >
            {grid.map((row, ri) =>
               row.map((cell, ci) => (
                  <div
                     key={`${ri}-${ci}`}
                     onClick={() =>
                        selectedBlock !== null &&
                        placeBlock(selectedBlock, ri, ci)
                     }
                     className={`fill-cell ${cell ? "filled" : ""} ${
                        selectedBlock !== null ? "selectable" : ""
                     }`}
                  ></div>
               ))
            )}
         </div>
      </div>
   );
}
