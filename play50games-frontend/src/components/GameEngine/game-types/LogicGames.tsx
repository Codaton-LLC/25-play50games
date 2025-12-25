"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import NumberKeypad from "../NumberKeypad";
import {
   CheckCircleIcon,
   XCircleIcon,
   TrophyIcon,
   ClockIcon,
   SparklesIcon,
   ArrowPathIcon,
   PlayIcon,
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
}

// Map game titles to gameType as fallback
const titleToGameType: Record<string, string> = {
   "balance the scale": "balance-scale",
   "match the shapes": "match-shapes",
   "color sequence": "color-sequence",
   "number order": "number-order",
   "find the odd one": "find-odd-one",
   "tile slider": "tile-slider",
   "light switch puzzle": "light-switch",
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
}: LogicGamesProps) {
   const [currentGame, setCurrentGame] = useState<string>("");
   const [score, setScore] = useState(0);
   const [round, setRound] = useState(0);

   // Determine max rounds based on game type
   // Balance the Scale and Match Shapes should have 20 rounds by default
   const getMaxRounds = () => {
      if (config.rounds) return config.rounds;
      const gameType = config.gameType || currentGame;
      if (
         gameType === "balance-scale" ||
         gameType === "match-shapes" ||
         gameTitle?.toLowerCase().includes("balance") ||
         gameTitle?.toLowerCase().includes("match")
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
   }, [isPlaying, config, gameTitle]);

   useEffect(() => {
      if (round >= maxRounds && isPlaying) {
         // Calculate final score
         // For balance-scale with 20 rounds: score is already 0-100 (5 points per round * 20 = 100 max)
         // For other games: calculate percentage
         const isBalanceScale =
            currentGame === "balance-scale" ||
            gameTitle?.toLowerCase().includes("balance");
         const finalScore =
            isBalanceScale && maxRounds === 20
               ? score // Already 0-100 (5 points per round * 20 rounds = 100 max)
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
               setScore(score + s);
               setRound(round + 1);
            }}
         />
      ),
      "number-order": (
         <NumberOrder
            config={config}
            onScoreUpdate={(s) => {
               setScore(score + s);
               setRound(round + 1);
            }}
         />
      ),
      "find-odd-one": (
         <FindOddOne
            config={config}
            onScoreUpdate={(s) => {
               setScore(score + s);
               setRound(round + 1);
            }}
         />
      ),
      "tile-slider": (
         <TileSlider
            config={config}
            onScoreUpdate={(s) => {
               setScore(score + s);
               setRound(round + 1);
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
         <LightSwitch
            config={config}
            onScoreUpdate={(s) => {
               setScore(score + s);
               setRound(round + 1);
            }}
            onComplete={onComplete}
         />
      ),
      "maze-escape": (
         <MazeEscape
            config={config}
            onScoreUpdate={(s) => {
               setScore(score + s);
               setRound(round + 1);
            }}
            onComplete={onComplete}
         />
      ),
      "pattern-completion": (
         <PatternCompletion
            config={config}
            onScoreUpdate={(s) => {
               setScore(score + s);
               setRound(round + 1);
            }}
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
            onScoreUpdate={(s) => {
               setScore(score + s);
               setRound(round + 1);
            }}
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

// Color Sequence Game
function ColorSequence({
   config,
   onScoreUpdate,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
}) {
   const colors = ["red", "blue", "green", "yellow"];
   const [sequence, setSequence] = useState<string[]>([]);
   const [playerSequence, setPlayerSequence] = useState<string[]>([]);
   const [showingSequence, setShowingSequence] = useState(true);
   const [level, setLevel] = useState(1);

   useEffect(() => {
      startNewLevel();
   }, []);

   const startNewLevel = () => {
      const newSequence = [];
      for (let i = 0; i < level; i++) {
         newSequence.push(colors[Math.floor(Math.random() * colors.length)]);
      }
      setSequence(newSequence);
      setPlayerSequence([]);
      setShowingSequence(true);

      // Show sequence
      setTimeout(() => {
         setShowingSequence(false);
      }, 2000);
   };

   const handleColorClick = (color: string) => {
      if (showingSequence) return;

      const newPlayerSequence = [...playerSequence, color];
      setPlayerSequence(newPlayerSequence);

      // Check if correct
      if (newPlayerSequence.length === sequence.length) {
         const isCorrect = newPlayerSequence.every((c, i) => c === sequence[i]);
         if (isCorrect) {
            onScoreUpdate(20 * level);
            setLevel(level + 1);
            setTimeout(() => startNewLevel(), 1000);
         } else {
            onScoreUpdate(0);
            setLevel(1);
            setTimeout(() => startNewLevel(), 1000);
         }
      }
   };

   return (
      <div className="color-sequence-game">
         <h3>Color Sequence - Level {level}</h3>
         {showingSequence ? (
            <div className="sequence-display">
               {sequence.map((color, index) => (
                  <div
                     key={index}
                     className={`color-box ${color}`}
                     style={{ animationDelay: `${index * 0.5}s` }}
                  ></div>
               ))}
               <p>Watch the sequence...</p>
            </div>
         ) : (
            <div className="color-options">
               {colors.map((color) => (
                  <button
                     key={color}
                     onClick={() => handleColorClick(color)}
                     className={`color-button ${color}`}
                  >
                     {color}
                  </button>
               ))}
               <p>Repeat the sequence</p>
            </div>
         )}
      </div>
   );
}

// Number Order Game (3)
function NumberOrder({
   config,
   onScoreUpdate,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
}) {
   const numbers = config.numbers || 5;
   const [shuffled, setShuffled] = useState<number[]>([]);
   const [selected, setSelected] = useState<number[]>([]);
   const [correct, setCorrect] = useState<boolean | null>(null);

   useEffect(() => {
      const nums = Array.from({ length: numbers }, (_, i) => i + 1);
      setShuffled([...nums].sort(() => Math.random() - 0.5));
      setSelected([]);
   }, []);

   const handleNumberClick = (num: number) => {
      if (selected.includes(num)) return;
      const newSelected = [...selected, num];
      setSelected(newSelected);

      if (newSelected.length === numbers) {
         const isCorrect = newSelected.every((n, i) => n === i + 1);
         setCorrect(isCorrect);
         onScoreUpdate(isCorrect ? 100 : 0);
      }
   };

   return (
      <div className="number-order-game">
         <h3>Number Order</h3>
         <p>Click numbers from smallest to largest</p>
         <div className="number-grid">
            {shuffled.map((num) => (
               <button
                  key={num}
                  onClick={() => handleNumberClick(num)}
                  className={`number-btn ${
                     selected.includes(num) ? "selected" : ""
                  }`}
                  disabled={selected.includes(num)}
               >
                  {num}
               </button>
            ))}
         </div>
         {correct !== null && (
            <p className={correct ? "correct-message" : "incorrect-message"}>
               {correct ? "Correct!" : "Try again!"}
            </p>
         )}
      </div>
   );
}

// Find the Odd One Game (4)
function FindOddOne({
   config,
   onScoreUpdate,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
}) {
   const gridSize = config.gridSize || 3;
   const [items, setItems] = useState<
      Array<{ id: number; type: string; isOdd: boolean }>
   >([]);
   const [selected, setSelected] = useState<number | null>(null);
   const [correct, setCorrect] = useState<boolean | null>(null);

   useEffect(() => {
      const total = gridSize * gridSize;
      const oddIndex = Math.floor(Math.random() * total);
      const baseType = Math.random() > 0.5 ? "circle" : "square";

      const newItems = Array.from({ length: total }, (_, i) => ({
         id: i,
         type:
            i === oddIndex
               ? baseType === "circle"
                  ? "square"
                  : "circle"
               : baseType,
         isOdd: i === oddIndex,
      }));
      setItems(newItems);
   }, []);

   const handleClick = (id: number) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;

      setSelected(id);
      const isCorrect = item.isOdd;
      setCorrect(isCorrect);
      onScoreUpdate(isCorrect ? 100 : 0);
   };

   return (
      <div className="find-odd-one-game">
         <h3>Find the Odd One</h3>
         <div
            className="odd-grid"
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
         >
            {items.map((item) => (
               <button
                  key={item.id}
                  onClick={() => handleClick(item.id)}
                  className={`odd-item ${item.type} ${
                     selected === item.id
                        ? correct
                           ? "correct"
                           : "incorrect"
                        : ""
                  }`}
               >
                  <div className={`shape ${item.type}`}></div>
               </button>
            ))}
         </div>
         {correct !== null && (
            <p className={correct ? "correct-message" : "incorrect-message"}>
               {correct ? "Correct!" : "Wrong! Try again."}
            </p>
         )}
      </div>
   );
}

// Tile Slider Game (5)
function TileSlider({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const gridSize = config.gridSize || 3;
   const total = gridSize * gridSize;
   const [tiles, setTiles] = useState<number[]>([]);
   const [emptyIndex, setEmptyIndex] = useState(total - 1);
   const [moves, setMoves] = useState(0);

   useEffect(() => {
      const nums = Array.from({ length: total - 1 }, (_, i) => i + 1);
      setTiles([...nums].sort(() => Math.random() - 0.5));
      setEmptyIndex(total - 1);
      setMoves(0);
   }, []);

   useEffect(() => {
      const isSolved = tiles.every((tile, i) => tile === i + 1);
      if (isSolved && tiles.length === total - 1) {
         const score = Math.max(0, 100 - moves * 2);
         onScoreUpdate(score);
         setTimeout(() => onComplete(score), 1000);
      }
   }, [tiles, moves, total, onScoreUpdate, onComplete]);

   const canMove = (index: number) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      const emptyRow = Math.floor(emptyIndex / gridSize);
      const emptyCol = emptyIndex % gridSize;
      return (
         (row === emptyRow && Math.abs(col - emptyCol) === 1) ||
         (col === emptyCol && Math.abs(row - emptyRow) === 1)
      );
   };

   const handleTileClick = (index: number) => {
      if (!canMove(index)) return;

      const newTiles = [...tiles];
      newTiles.splice(emptyIndex, 0, tiles[index]);
      newTiles.splice(index, 1);
      setTiles(newTiles);
      setEmptyIndex(index);
      setMoves(moves + 1);
   };

   return (
      <div className="tile-slider-game">
         <h3>Tile Slider Puzzle</h3>
         <p>Moves: {moves}</p>
         <div
            className="slider-grid"
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
         >
            {Array.from({ length: total }).map((_, i) => (
               <div key={i} className="slider-cell">
                  {i === emptyIndex ? (
                     <div className="empty-cell"></div>
                  ) : (
                     <button
                        onClick={() => handleTileClick(i)}
                        className={`slider-tile ${canMove(i) ? "movable" : ""}`}
                     >
                        {tiles[i]}
                     </button>
                  )}
               </div>
            ))}
         </div>
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

// Light Switch Puzzle (7)
function LightSwitch({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const gridSize = config.gridSize || 3;
   const [lights, setLights] = useState<boolean[][]>([]);
   const [moves, setMoves] = useState(0);
   const maxMoves = config.maxMoves || 10;

   useEffect(() => {
      const newLights = Array(gridSize)
         .fill(null)
         .map(() =>
            Array(gridSize)
               .fill(false)
               .map(() => Math.random() > 0.5)
         );
      setLights(newLights);
      setMoves(0);
   }, []);

   useEffect(() => {
      const allOff = lights.every((row) => row.every((light) => !light));
      if (allOff && lights.length > 0) {
         const score = Math.max(0, 100 - moves * 5);
         onScoreUpdate(score);
         setTimeout(() => onComplete(score), 1000);
      }
   }, [lights, moves, onScoreUpdate, onComplete]);

   const toggleLight = (row: number, col: number) => {
      if (moves >= maxMoves) return;

      const newLights = lights.map((r, ri) =>
         r.map((light, ci) => {
            if (ri === row && ci === col) return !light;
            if (
               (ri === row && Math.abs(ci - col) === 1) ||
               (ci === col && Math.abs(ri - row) === 1)
            )
               return !light;
            return light;
         })
      );
      setLights(newLights);
      setMoves(moves + 1);
   };

   return (
      <div className="light-switch-game">
         <h3>Light Switch Puzzle</h3>
         <p>
            Moves: {moves}/{maxMoves}
         </p>
         <div
            className="light-grid"
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
         >
            {lights.map((row, ri) =>
               row.map((light, ci) => (
                  <button
                     key={`${ri}-${ci}`}
                     onClick={() => toggleLight(ri, ci)}
                     className={`light-cell ${light ? "on" : "off"}`}
                     disabled={moves >= maxMoves}
                  >
                     {light ? (
                        <CircleStackIcon
                           style={{
                              width: 24,
                              height: 24,
                              color: "var(--accent)",
                           }}
                        />
                     ) : (
                        <CircleStackIcon
                           style={{
                              width: 24,
                              height: 24,
                              color: "var(--muted)",
                              opacity: 0.3,
                           }}
                        />
                     )}
                  </button>
               ))
            )}
         </div>
         <p>Turn all lights off!</p>
      </div>
   );
}

// Maze Escape (8)
function MazeEscape({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const size = config.size || 5;
   const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
   const [exitPos] = useState({ x: size - 1, y: size - 1 });
   const [walls, setWalls] = useState<Set<string>>(new Set());

   useEffect(() => {
      const newWalls = new Set<string>();
      for (let i = 0; i < size * size * 0.3; i++) {
         const x = Math.floor(Math.random() * size);
         const y = Math.floor(Math.random() * size);
         if (!(x === 0 && y === 0) && !(x === size - 1 && y === size - 1)) {
            newWalls.add(`${x},${y}`);
         }
      }
      setWalls(newWalls);
      setPlayerPos({ x: 0, y: 0 });
   }, []);

   useEffect(() => {
      if (playerPos.x === exitPos.x && playerPos.y === exitPos.y) {
         onScoreUpdate(100);
         setTimeout(() => onComplete(100), 1000);
      }
   }, [playerPos, exitPos, onScoreUpdate, onComplete]);

   const handleKeyPress = (e: React.KeyboardEvent) => {
      let newPos = { ...playerPos };
      if (e.key === "ArrowUp" && playerPos.y > 0) newPos.y--;
      if (e.key === "ArrowDown" && playerPos.y < size - 1) newPos.y++;
      if (e.key === "ArrowLeft" && playerPos.x > 0) newPos.x--;
      if (e.key === "ArrowRight" && playerPos.x < size - 1) newPos.x++;

      if (!walls.has(`${newPos.x},${newPos.y}`)) {
         setPlayerPos(newPos);
      }
   };

   return (
      <div className="maze-escape-game" onKeyDown={handleKeyPress} tabIndex={0}>
         <h3>Maze Escape</h3>
         <p>Use arrow keys to reach the exit (E)</p>
         <div
            className="maze-grid"
            style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
         >
            {Array.from({ length: size * size }).map((_, i) => {
               const x = i % size;
               const y = Math.floor(i / size);
               const isWall = walls.has(`${x},${y}`);
               const isPlayer = playerPos.x === x && playerPos.y === y;
               const isExit = exitPos.x === x && exitPos.y === y;

               return (
                  <div
                     key={i}
                     className={`maze-cell ${isWall ? "wall" : ""} ${
                        isPlayer ? "player" : ""
                     } ${isExit ? "exit" : ""}`}
                  >
                     {isPlayer && "P"}
                     {isExit && !isPlayer && "E"}
                  </div>
               );
            })}
         </div>
      </div>
   );
}

// Pattern Completion (9)
function PatternCompletion({
   config,
   onScoreUpdate,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
}) {
   const [pattern, setPattern] = useState<string[]>([]);
   const [options, setOptions] = useState<string[]>([]);
   const [correctIndex, setCorrectIndex] = useState(0);
   const [selected, setSelected] = useState<number | null>(null);
   const [correct, setCorrect] = useState<boolean | null>(null);

   useEffect(() => {
      const shapes = ["circle", "square", "triangle", "star"];
      const basePattern = Array.from(
         { length: 3 },
         () => shapes[Math.floor(Math.random() * shapes.length)]
      );
      const missing = shapes[Math.floor(Math.random() * shapes.length)];
      const allOptions = [...shapes].sort(() => Math.random() - 0.5);

      setPattern([...basePattern, "?"]);
      setOptions(allOptions);
      setCorrectIndex(allOptions.indexOf(missing));
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
      <div className="pattern-completion-game">
         <h3>Pattern Completion</h3>
         <div className="pattern-display">
            {pattern.map((shape, i) => (
               <div
                  key={i}
                  className={`pattern-shape ${
                     shape === "?" ? "missing" : shape
                  }`}
               >
                  {shape !== "?" && <div className={`shape ${shape}`}></div>}
                  {shape === "?" && "?"}
               </div>
            ))}
         </div>
         <div className="pattern-options">
            {options.map((shape, i) => (
               <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  className={`option-btn ${
                     selected === i ? (correct ? "correct" : "incorrect") : ""
                  }`}
               >
                  <div className={`shape ${shape}`}></div>
               </button>
            ))}
         </div>
         {correct !== null && (
            <p className={correct ? "correct-message" : "incorrect-message"}>
               {correct ? "Correct!" : "Wrong!"}
            </p>
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

// Rotate to Fit (11)
function RotateToFit({
   config,
   onScoreUpdate,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
}) {
   const [rotation, setRotation] = useState(0);
   const [targetRotation] = useState(Math.floor(Math.random() * 4) * 90);
   const [correct, setCorrect] = useState<boolean | null>(null);

   const handleRotate = () => {
      const newRotation = (rotation + 90) % 360;
      setRotation(newRotation);

      if (newRotation === targetRotation) {
         setCorrect(true);
         onScoreUpdate(100);
      } else {
         setCorrect(false);
      }
   };

   return (
      <div className="rotate-to-fit-game">
         <h3>Rotate to Fit</h3>
         <div className="rotation-area">
            <div className="target-outline"></div>
            <div
               className="rotatable-shape"
               style={{ transform: `rotate(${rotation}deg)` }}
            ></div>
         </div>
         <button onClick={handleRotate}>Rotate 90°</button>
         {correct !== null && (
            <p className={correct ? "correct-message" : "incorrect-message"}>
               {correct ? "Perfect fit!" : "Keep rotating..."}
            </p>
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
