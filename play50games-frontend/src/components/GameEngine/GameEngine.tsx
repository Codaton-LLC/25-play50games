"use client";

import { useState, useEffect, useCallback } from "react";
import { Game } from "@/types/game";
import { saveProgress } from "@/lib/storage/progressStorage";
import { getGameInstructions } from "@/lib/utils/gameInstructions";
import { useAuth } from "@/contexts/AuthContext";
import {
   XMarkIcon,
   CheckCircleIcon,
   XCircleIcon,
   ClockIcon,
   TrophyIcon,
   LightBulbIcon,
   PlayIcon,
   ArrowLeftIcon,
   ArrowUpIcon,
   MoonIcon,
   BoltIcon,
   ArrowDownIcon,
   InformationCircleIcon,
   ArrowRightIcon,
   CircleStackIcon,
   HomeIcon,
   StarIcon,
   HeartIcon,
   ScaleIcon,
   ArrowPathIcon,
   PuzzlePieceIcon,
   MusicalNoteIcon,
   KeyIcon,
   SparklesIcon,
   CursorArrowRaysIcon,
} from "@heroicons/react/24/outline";
import LogicGames from "./game-types/LogicGames";
import MemoryGames from "./game-types/MemoryGames";
import SpeedGames from "./game-types/SpeedGames";
import SkillGames from "./game-types/SkillGames";
import FinalGames from "./game-types/FinalGames";
import KeyboardControls, { MouseControls } from "./KeyboardControls";
import { trackShareClick } from "@/lib/api/share";

interface GameEngineProps {
   game: Game;
   onComplete: (score: number) => void;
   onExit: () => void;
}

export default function GameEngine({
   game,
   onComplete,
   onExit,
}: GameEngineProps) {
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Check if mobile or tablet device
   useEffect(() => {
      const checkDevice = () => {
         const width = window.innerWidth;
         setIsMobile(width < 768);
         setIsTablet(width >= 768 && width < 1024);
      };
      checkDevice();
      window.addEventListener("resize", checkDevice);
      return () => window.removeEventListener("resize", checkDevice);
   }, []);
   const { isAuthenticated } = useAuth();
   const [score, setScore] = useState(0);
   const [timeLeft, setTimeLeft] = useState(game.time_limit);
   const [isPlaying, setIsPlaying] = useState(false);
   const [isCompleted, setIsCompleted] = useState(false);

   // Track share click immediately when page loads (before game starts)
   useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
         // Track click immediately when page loads
         trackShareClick(sharedBy).catch(() => {
            // Failed to track share click
         });
      }
   }, []); // Run once on mount

   useEffect(() => {
      if (!isPlaying || isCompleted) return;

      const timer = setInterval(() => {
         setTimeLeft((prev) => {
            if (prev <= 1) {
               handleGameEnd();
               return 0;
            }
            return prev - 1;
         });
      }, 1000);

      return () => clearInterval(timer);
   }, [isPlaying, isCompleted]);

   const handleGameEnd = useCallback(
      async (finalScore?: number) => {
         if (isCompleted) return;

         setIsCompleted(true);
         setIsPlaying(false);

         // Use provided finalScore or fall back to current score state
         const actualScore = finalScore !== undefined ? finalScore : score;

         const completed = actualScore >= game.passing_score;

         // Update score state if finalScore was provided
         if (finalScore !== undefined) {
            setScore(finalScore);
         }

         // Save progress
         try {
            await saveProgress(
               game.id,
               actualScore,
               completed,
               isAuthenticated
            );
         } catch (error) {
            // Don't block game completion if save fails
         }

         // Call completion callback
         onComplete(actualScore);
      },
      [score, game, isCompleted, onComplete, isAuthenticated]
   );

   const startGame = () => {
      setIsPlaying(true);
      setTimeLeft(game.time_limit);
      setScore(0);
      setIsCompleted(false);
   };

   const updateScore = (newScore: number) => {
      setScore(newScore);
   };

   const renderGame = () => {
      // Ensure game_config is parsed correctly (it should already be an object from API)
      let gameConfig = game.game_config || {};

      // If game_config is a string, parse it
      if (typeof gameConfig === "string") {
         try {
            gameConfig = JSON.parse(gameConfig);
         } catch (e) {
            gameConfig = {};
         }
      }

      // If game_config is null or undefined, set to empty object
      if (
         !gameConfig ||
         (typeof gameConfig === "object" &&
            Object.keys(gameConfig).length === 0 &&
            gameConfig.constructor === Object)
      ) {
         gameConfig = {};
      }

      // Debug logging removed to reduce console noise.

      switch (game.game_type) {
         case "logic":
            return (
               <LogicGames
                  config={gameConfig}
                  gameTitle={game.title}
                  onScoreUpdate={updateScore}
                  onComplete={handleGameEnd}
                  isPlaying={isPlaying}
                  passingScore={game.passing_score}
               />
            );
         case "memory":
            return (
               <MemoryGames
                  config={gameConfig}
                  onScoreUpdate={updateScore}
                  onComplete={handleGameEnd}
                  isPlaying={isPlaying}
                  passingScore={game.passing_score}
               />
            );
         case "speed":
            return (
               <SpeedGames
                  config={gameConfig}
                  onScoreUpdate={updateScore}
                  onComplete={handleGameEnd}
                  isPlaying={isPlaying}
               />
            );
         case "skill":
            return (
               <SkillGames
                  config={gameConfig}
                  onScoreUpdate={updateScore}
                  onComplete={handleGameEnd}
                  isPlaying={isPlaying}
               />
            );
         case "final":
            return (
               <FinalGames
                  config={gameConfig}
                  onScoreUpdate={updateScore}
                  onComplete={handleGameEnd}
                  isPlaying={isPlaying}
               />
            );
         default:
            return <div>Unknown game type</div>;
      }
   };

   if (!isPlaying && !isCompleted) {
      const gameType = game.game_config?.gameType || "";
      const instructions = getGameInstructions(gameType, game.title);
      const displayDescription = game.description || instructions.description;
      const gridSize = game.game_config?.gridSize || 3;

      return (
         <div className="game-start-screen">
            <h2>{game.title}</h2>
            <p className="game-description">{displayDescription}</p>

            <div className="game-instructions-section">
               <h3>How to Play</h3>
               <p className="instructions-text">{instructions.instructions}</p>

               {/* Interactive Example for Emoji Memory */}
               {gameType === "emoji-memory" && (
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(125, 211, 252, 0.1) 0%, rgba(54, 211, 153, 0.1) 100%)",
                        border: "2px solid var(--stroke)",
                        borderRadius: "20px",
                        padding: "32px",
                        marginTop: "24px",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                     }}
                  >
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           gap: "12px",
                           marginBottom: "24px",
                        }}
                     >
                        <SparklesIcon
                           style={{
                              width: 28,
                              height: 28,
                              color: "var(--accent)",
                           }}
                        />
                        <h3
                           style={{
                              fontSize: "24px",
                              fontWeight: 700,
                              margin: 0,
                              background:
                                 "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              backgroundClip: "text",
                           }}
                        >
                           Example Round
                        </h3>
                     </div>

                     <div
                        style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "16px",
                           padding: "24px",
                           marginBottom: "20px",
                        }}
                     >
                        <p
                           style={{
                              margin: "0 0 16px",
                              color: "var(--text)",
                              fontSize: "16px",
                              fontWeight: 600,
                              textAlign: "center",
                           }}
                        >
                           Memorize the emoji positions, then click them in
                           order:
                        </p>
                        <div
                           style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(4, 1fr)",
                              gap: "12px",
                              maxWidth: "300px",
                              margin: "0 auto",
                           }}
                        >
                           {[
                              "🍎",
                              "?",
                              "?",
                              "⭐",
                              "?",
                              "🎵",
                              "?",
                              "?",
                              "?",
                              "🏀",
                              "?",
                              "?",
                              "?",
                              "?",
                              "?",
                              "?",
                           ].map((emoji, i) => (
                              <div
                                 key={i}
                                 style={{
                                    aspectRatio: "1",
                                    borderRadius: "12px",
                                    border: "2px solid var(--stroke)",
                                    background:
                                       emoji !== "?"
                                          ? "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))"
                                          : "var(--card)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "1.5rem",
                                    opacity: emoji === "?" ? 0.3 : 1,
                                 }}
                              >
                                 {emoji}
                              </div>
                           ))}
                        </div>
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "14px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           Click on cells 0, 3, 4, 5, and 9 (where emojis
                           appeared)
                        </p>
                     </div>

                     {isMobile && (
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "13px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           <span
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                                 justifyContent: "center",
                              }}
                           >
                              <CursorArrowRaysIcon
                                 style={{
                                    width: 16,
                                    height: 16,
                                    color: "var(--accent)",
                                 }}
                              />
                              Tap cells to select them
                           </span>
                        </p>
                     )}
                     {!isMobile && (
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "13px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           <span
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                                 justifyContent: "center",
                              }}
                           >
                              <CursorArrowRaysIcon
                                 style={{
                                    width: 16,
                                    height: 16,
                                    color: "var(--accent)",
                                 }}
                              />
                              Click cells to select them
                           </span>
                        </p>
                     )}
                  </div>
               )}

               {/* Interactive Example for Number Recall */}
               {gameType === "number-recall" && (
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(125, 211, 252, 0.1) 0%, rgba(54, 211, 153, 0.1) 100%)",
                        border: "2px solid var(--stroke)",
                        borderRadius: "20px",
                        padding: "32px",
                        marginTop: "24px",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                     }}
                  >
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           gap: "12px",
                           marginBottom: "24px",
                        }}
                     >
                        <SparklesIcon
                           style={{
                              width: 28,
                              height: 28,
                              color: "var(--accent)",
                           }}
                        />
                        <h3
                           style={{
                              fontSize: "24px",
                              fontWeight: 700,
                              margin: 0,
                              background:
                                 "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              backgroundClip: "text",
                           }}
                        >
                           Example Round
                        </h3>
                     </div>

                     <div
                        style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "16px",
                           padding: "24px",
                           marginBottom: "20px",
                        }}
                     >
                        <p
                           style={{
                              margin: "0 0 16px",
                              color: "var(--text)",
                              fontSize: "16px",
                              fontWeight: 600,
                              textAlign: "center",
                           }}
                        >
                           Watch the number appear, then type it:
                        </p>
                        <div
                           style={{
                              height: "140px",
                              borderRadius: "18px",
                              border: "1px solid var(--stroke)",
                              background:
                                 "radial-gradient(220px 140px at 30% 30%, rgba(125, 211, 252, 0.14), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                              boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "42px",
                              fontWeight: 900,
                              letterSpacing: "6px",
                              color: "var(--text)",
                              marginBottom: "20px",
                           }}
                        >
                           4729
                        </div>
                        <div
                           style={{
                              display: "flex",
                              gap: "10px",
                              alignItems: "center",
                           }}
                        >
                           <input
                              type="text"
                              value="4729"
                              readOnly
                              style={{
                                 flex: 1,
                                 borderRadius: "12px",
                                 border: "1px solid var(--stroke)",
                                 background: "rgba(15, 27, 51, 0.7)",
                                 color: "var(--text)",
                                 padding: "12px",
                                 fontSize: "18px",
                                 letterSpacing: "4px",
                                 textAlign: "center",
                                 fontFamily: "monospace",
                                 fontWeight: 600,
                              }}
                           />
                           <button
                              style={{
                                 padding: "12px 24px",
                                 borderRadius: "12px",
                                 border: "1px solid var(--stroke)",
                                 background:
                                    "linear-gradient(180deg, rgba(110, 168, 255, 0.9), rgba(110, 168, 255, 0.55))",
                                 color: "#081126",
                                 fontWeight: 700,
                                 fontSize: "16px",
                                 cursor: "default",
                              }}
                           >
                              OK
                           </button>
                        </div>
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "14px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           Type the sequence: <strong>4729</strong>
                        </p>
                     </div>

                     {isMobile && (
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "13px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           <span
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                                 justifyContent: "center",
                              }}
                           >
                              <CursorArrowRaysIcon
                                 style={{
                                    width: 16,
                                    height: 16,
                                    color: "var(--accent)",
                                 }}
                              />
                              Tap to type numbers
                           </span>
                        </p>
                     )}
                     {!isMobile && (
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "13px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           <span
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                                 justifyContent: "center",
                              }}
                           >
                              <KeyIcon
                                 style={{
                                    width: 16,
                                    height: 16,
                                    color: "var(--accent)",
                                 }}
                              />
                              Type numbers or press Enter to submit
                           </span>
                        </p>
                     )}
                  </div>
               )}

               {/* Interactive Example for Sound Memory */}
               {gameType === "sound-memory" && (
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(125, 211, 252, 0.1) 0%, rgba(54, 211, 153, 0.1) 100%)",
                        border: "2px solid var(--stroke)",
                        borderRadius: "20px",
                        padding: "32px",
                        marginTop: "24px",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                     }}
                  >
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           gap: "12px",
                           marginBottom: "24px",
                        }}
                     >
                        <MusicalNoteIcon
                           style={{
                              width: 28,
                              height: 28,
                              color: "var(--accent)",
                           }}
                        />
                        <h3
                           style={{
                              fontSize: "24px",
                              fontWeight: 700,
                              margin: 0,
                              background:
                                 "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              backgroundClip: "text",
                           }}
                        >
                           Example Sequence
                        </h3>
                     </div>

                     <div
                        style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "16px",
                           padding: "24px",
                           marginBottom: "20px",
                        }}
                     >
                        <p
                           style={{
                              margin: "0 0 16px",
                              color: "var(--text)",
                              fontSize: "16px",
                              fontWeight: 600,
                              textAlign: "center",
                           }}
                        >
                           Listen to this example:{" "}
                           <strong>
                              <span
                                 style={{ color: "rgba(54, 211, 153, 0.9)" }}
                              >
                                 2
                              </span>
                              {" → "}
                              <span
                                 style={{ color: "rgba(110, 168, 255, 0.9)" }}
                              >
                                 1
                              </span>
                              {" → "}
                              <span
                                 style={{ color: "rgba(251, 113, 133, 0.9)" }}
                              >
                                 3
                              </span>
                           </strong>
                        </p>
                        <div
                           style={{
                              display: "flex",
                              gap: isMobile ? "8px" : "12px",
                              justifyContent: "center",
                              marginBottom: isMobile ? "16px" : "20px",
                              flexWrap: "wrap",
                           }}
                        >
                           {[2, 1, 3].map((num, i) => {
                              // Color mapping: 1=Blue, 2=Green, 3=Red/Pink, 4=Yellow
                              const colors: Record<
                                 number,
                                 {
                                    bg: string;
                                    border: string;
                                    shadow: string;
                                    text: string;
                                 }
                              > = {
                                 1: {
                                    bg: "linear-gradient(135deg, rgba(110, 168, 255, 0.25), rgba(110, 168, 255, 0.15))",
                                    border: "rgba(110, 168, 255, 0.6)",
                                    shadow: "rgba(110, 168, 255, 0.4)",
                                    text: "rgba(110, 168, 255, 0.9)",
                                 },
                                 2: {
                                    bg: "linear-gradient(135deg, rgba(54, 211, 153, 0.25), rgba(54, 211, 153, 0.15))",
                                    border: "rgba(54, 211, 153, 0.6)",
                                    shadow: "rgba(54, 211, 153, 0.4)",
                                    text: "rgba(54, 211, 153, 0.9)",
                                 },
                                 3: {
                                    bg: "linear-gradient(135deg, rgba(251, 113, 133, 0.25), rgba(251, 113, 133, 0.15))",
                                    border: "rgba(251, 113, 133, 0.6)",
                                    shadow: "rgba(251, 113, 133, 0.4)",
                                    text: "rgba(251, 113, 133, 0.9)",
                                 },
                                 4: {
                                    bg: "linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(251, 191, 36, 0.15))",
                                    border: "rgba(251, 191, 36, 0.6)",
                                    shadow: "rgba(251, 191, 36, 0.4)",
                                    text: "rgba(251, 191, 36, 0.9)",
                                 },
                              };
                              const color = colors[num] || colors[1];
                              return (
                                 <div
                                    key={i}
                                    style={{
                                       width: isMobile ? "60px" : "80px",
                                       height: isMobile ? "60px" : "80px",
                                       borderRadius: isMobile ? "12px" : "16px",
                                       background: color.bg,
                                       border: `2px solid ${color.border}`,
                                       display: "flex",
                                       alignItems: "center",
                                       justifyContent: "center",
                                       fontSize: isMobile ? "1.5rem" : "2rem",
                                       fontWeight: "bold",
                                       color: color.text,
                                       boxShadow: `0 4px 12px ${color.shadow}`,
                                    }}
                                 >
                                    {num}
                                 </div>
                              );
                           })}
                        </div>
                        <p
                           style={{
                              margin: "0",
                              color: "var(--muted)",
                              fontSize: "14px",
                              textAlign: "center",
                              lineHeight: "1.6",
                           }}
                        >
                           Click the sound pads in the same order:{" "}
                           <strong>
                              <span
                                 style={{ color: "rgba(54, 211, 153, 0.9)" }}
                              >
                                 2
                              </span>
                              {", then "}
                              <span
                                 style={{ color: "rgba(110, 168, 255, 0.9)" }}
                              >
                                 1
                              </span>
                              {", then "}
                              <span
                                 style={{ color: "rgba(251, 113, 133, 0.9)" }}
                              >
                                 3
                              </span>
                           </strong>
                        </p>
                     </div>

                     <div
                        style={{
                           display: "grid",
                           gridTemplateColumns: "repeat(4, 1fr)",
                           gap: "12px",
                           marginTop: "20px",
                        }}
                     >
                        {[1, 2, 3, 4].map((padNum) => (
                           <div
                              key={padNum}
                              style={{
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                                 padding: "16px",
                                 textAlign: "center",
                                 transition: "all 0.2s",
                              }}
                           >
                              <div
                                 style={{
                                    fontSize: "1.5rem",
                                    fontWeight: "bold",
                                    color: "var(--accent)",
                                    marginBottom: "8px",
                                 }}
                              >
                                 {padNum}
                              </div>
                              <div
                                 style={{
                                    fontSize: "0.75rem",
                                    color: "var(--muted)",
                                    fontWeight: 600,
                                 }}
                              >
                                 Key {padNum}
                              </div>
                           </div>
                        ))}
                     </div>
                     <p
                        style={{
                           margin: "16px 0 0",
                           color: "var(--muted)",
                           fontSize: "13px",
                           textAlign: "center",
                           fontStyle: "italic",
                        }}
                     >
                        <span
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              justifyContent: "center",
                           }}
                        >
                           <LightBulbIcon
                              style={{
                                 width: 16,
                                 height: 16,
                                 color: "var(--accent)",
                              }}
                           />
                           Tip: Use keyboard keys 1-4 for faster gameplay!
                        </span>
                     </p>
                  </div>
               )}

               {/* Interactive Example for Image Recall */}
               {gameType === "image-recall" && (
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(125, 211, 252, 0.1) 0%, rgba(54, 211, 153, 0.1) 100%)",
                        border: "2px solid var(--stroke)",
                        borderRadius: "20px",
                        padding: "32px",
                        marginTop: "24px",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                     }}
                  >
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           gap: "12px",
                           marginBottom: "24px",
                        }}
                     >
                        <SparklesIcon
                           style={{
                              width: 28,
                              height: 28,
                              color: "var(--accent)",
                           }}
                        />
                        <h3
                           style={{
                              fontSize: "24px",
                              fontWeight: 700,
                              margin: 0,
                              background:
                                 "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              backgroundClip: "text",
                           }}
                        >
                           Example Round
                        </h3>
                     </div>

                     <div
                        style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "16px",
                           padding: "24px",
                           marginBottom: "20px",
                        }}
                     >
                        <p
                           style={{
                              margin: "0 0 16px",
                              color: "var(--text)",
                              fontSize: "16px",
                              fontWeight: 600,
                              textAlign: "center",
                           }}
                        >
                           Watch the sequence flash, then click in the same
                           order:
                        </p>
                        <div
                           style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(3, 1fr)",
                              gap: "14px",
                              maxWidth: "300px",
                              margin: "0 auto",
                           }}
                        >
                           {[
                              "🧩",
                              "🚀",
                              "🌙",
                              "🍎",
                              "🎵",
                              "📦",
                              "⭐",
                              "🐶",
                              "🏀",
                           ].map((emoji, i) => {
                              const isInSequence = [1, 0, 2].includes(i); // Example sequence: 2 → 1 → 3
                              const orderInSequence = [1, 0, 2].indexOf(i);
                              return (
                                 <div
                                    key={i}
                                    style={{
                                       aspectRatio: "1",
                                       borderRadius: "18px",
                                       border: isInSequence
                                          ? "2px solid rgba(110, 168, 255, 0.6)"
                                          : "2px solid rgba(255, 255, 255, 0.1)",
                                       background: isInSequence
                                          ? "linear-gradient(135deg, rgba(110, 168, 255, 0.3), rgba(110, 168, 255, 0.1))"
                                          : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                                       boxShadow: isInSequence
                                          ? "0 10px 24px rgba(110, 168, 255, 0.18)"
                                          : "0 10px 18px rgba(0, 0, 0, 0.22)",
                                       display: "flex",
                                       alignItems: "center",
                                       justifyContent: "center",
                                       fontSize: "2.5rem",
                                       position: "relative",
                                       opacity: isInSequence ? 1 : 0.3,
                                    }}
                                 >
                                    {isInSequence ? emoji : "?"}
                                    {isInSequence && (
                                       <div
                                          style={{
                                             position: "absolute",
                                             right: "10px",
                                             top: "10px",
                                             width: "28px",
                                             height: "28px",
                                             borderRadius: "999px",
                                             background:
                                                "rgba(15, 27, 51, 0.8)",
                                             border:
                                                "1px solid rgba(255, 255, 255, 0.12)",
                                             display: "grid",
                                             placeItems: "center",
                                             fontWeight: 900,
                                             fontSize: "12px",
                                             color: "rgba(232, 238, 252, 0.95)",
                                             zIndex: 2,
                                          }}
                                       >
                                          {orderInSequence + 1}
                                       </div>
                                    )}
                                 </div>
                              );
                           })}
                        </div>
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "14px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           Sequence: <strong>🚀 → 🧩 → 🌙</strong> (positions 2
                           → 1 → 3)
                        </p>
                     </div>

                     {isMobile && (
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "13px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           <span
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                                 justifyContent: "center",
                              }}
                           >
                              <CursorArrowRaysIcon
                                 style={{
                                    width: 16,
                                    height: 16,
                                    color: "var(--accent)",
                                 }}
                              />
                              Tap images to select them in order
                           </span>
                        </p>
                     )}
                     {!isMobile && (
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "13px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           <span
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                                 justifyContent: "center",
                              }}
                           >
                              <CursorArrowRaysIcon
                                 style={{
                                    width: 16,
                                    height: 16,
                                    color: "var(--accent)",
                                 }}
                              />
                              Click images to select them in order
                           </span>
                        </p>
                     )}
                  </div>
               )}

               {/* Interactive Example for Path Memory */}
               {gameType === "path-memory" && (
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(125, 211, 252, 0.1) 0%, rgba(54, 211, 153, 0.1) 100%)",
                        border: "2px solid var(--stroke)",
                        borderRadius: isMobile
                           ? "16px"
                           : isTablet
                           ? "18px"
                           : "20px",
                        padding: isMobile ? "20px" : isTablet ? "24px" : "32px",
                        marginTop: isMobile ? "16px" : "24px",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                     }}
                  >
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           gap: isMobile ? "8px" : "12px",
                           marginBottom: isMobile
                              ? "16px"
                              : isTablet
                              ? "20px"
                              : "24px",
                        }}
                     >
                        <SparklesIcon
                           style={{
                              width: isMobile ? 20 : isTablet ? 24 : 28,
                              height: isMobile ? 20 : isTablet ? 24 : 28,
                              color: "var(--accent)",
                           }}
                        />
                        <h3
                           style={{
                              fontSize: isMobile
                                 ? "18px"
                                 : isTablet
                                 ? "20px"
                                 : "24px",
                              fontWeight: 700,
                              margin: 0,
                              background:
                                 "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              backgroundClip: "text",
                           }}
                        >
                           Example Path
                        </h3>
                     </div>

                     <div
                        style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: isMobile
                              ? "14px"
                              : isTablet
                              ? "15px"
                              : "16px",
                           padding: isMobile
                              ? "16px"
                              : isTablet
                              ? "20px"
                              : "24px",
                           marginBottom: isMobile
                              ? "16px"
                              : isTablet
                              ? "20px"
                              : "24px",
                        }}
                     >
                        <p
                           style={{
                              margin: "0 0 16px",
                              color: "var(--text)",
                              fontSize: isMobile
                                 ? "14px"
                                 : isTablet
                                 ? "15px"
                                 : "16px",
                              fontWeight: 600,
                              textAlign: "center",
                           }}
                        >
                           Watch the path flash, then click cells in the same
                           order:
                        </p>
                        <div
                           style={{
                              display: "grid",
                              gridTemplateColumns: `repeat(5, ${
                                 isMobile ? "36px" : isTablet ? "40px" : "44px"
                              })`,
                              gap: isMobile ? "6px" : isTablet ? "8px" : "10px",
                              maxWidth: "fit-content",
                              margin: "0 auto",
                           }}
                        >
                           {Array.from({ length: 25 }).map((_, i) => {
                              // Example path: 0 → 1 → 6 → 7 → 12 (top-left to bottom-right diagonal pattern)
                              const examplePath = [0, 1, 6, 7, 12];
                              const isInPath = examplePath.includes(i);
                              const orderInPath = examplePath.indexOf(i);
                              return (
                                 <div
                                    key={i}
                                    style={{
                                       width: isMobile
                                          ? "36px"
                                          : isTablet
                                          ? "40px"
                                          : "44px",
                                       height: isMobile
                                          ? "36px"
                                          : isTablet
                                          ? "40px"
                                          : "44px",
                                       borderRadius: "16px",
                                       border: isInPath
                                          ? "2px solid rgba(110, 168, 255, 0.75)"
                                          : "1px solid rgba(255, 255, 255, 0.1)",
                                       background: isInPath
                                          ? "rgba(110, 168, 255, 0.18)"
                                          : "rgba(15, 27, 51, 0.45)",
                                       boxShadow: isInPath
                                          ? "0 0 26px rgba(110, 168, 255, 0.55)"
                                          : "0 10px 18px rgba(0, 0, 0, 0.16)",
                                       display: "flex",
                                       alignItems: "center",
                                       justifyContent: "center",
                                       position: "relative",
                                       transition: "all 0.2s ease",
                                    }}
                                 >
                                    {isInPath && (
                                       <div
                                          style={{
                                             position: "absolute",
                                             inset: "auto 8px 8px auto",
                                             width: isMobile
                                                ? "20px"
                                                : isTablet
                                                ? "22px"
                                                : "24px",
                                             height: isMobile
                                                ? "20px"
                                                : isTablet
                                                ? "22px"
                                                : "24px",
                                             borderRadius: "999px",
                                             background:
                                                "rgba(15, 27, 51, 0.62)",
                                             border:
                                                "1px solid rgba(255, 255, 255, 0.12)",
                                             display: "grid",
                                             placeItems: "center",
                                             fontWeight: 900,
                                             fontSize: isMobile
                                                ? "10px"
                                                : isTablet
                                                ? "11px"
                                                : "12px",
                                             color: "rgba(232, 238, 252, 0.95)",
                                             zIndex: 2,
                                          }}
                                       >
                                          {orderInPath + 1}
                                       </div>
                                    )}
                                 </div>
                              );
                           })}
                        </div>
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: isMobile
                                 ? "12px"
                                 : isTablet
                                 ? "13px"
                                 : "14px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           Path: <strong>1 → 2 → 7 → 8 → 13</strong> (click
                           cells in this order)
                        </p>
                     </div>

                     {isMobile && (
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "13px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           <span
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                                 justifyContent: "center",
                              }}
                           >
                              <CursorArrowRaysIcon
                                 style={{
                                    width: 16,
                                    height: 16,
                                    color: "var(--accent)",
                                 }}
                              />
                              Tap cells to recreate the path
                           </span>
                        </p>
                     )}
                     {!isMobile && (
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "13px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           <span
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                                 justifyContent: "center",
                              }}
                           >
                              <CursorArrowRaysIcon
                                 style={{
                                    width: 16,
                                    height: 16,
                                    color: "var(--accent)",
                                 }}
                              />
                              Click cells to recreate the path
                           </span>
                        </p>
                     )}
                  </div>
               )}

               {/* Interactive Example for Word Memory */}
               {gameType === "word-memory" && (
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(125, 211, 252, 0.1) 0%, rgba(54, 211, 153, 0.1) 100%)",
                        border: "2px solid var(--stroke)",
                        borderRadius: isMobile
                           ? "16px"
                           : isTablet
                           ? "18px"
                           : "20px",
                        padding: isMobile ? "20px" : isTablet ? "24px" : "32px",
                        marginTop: isMobile ? "16px" : "24px",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                     }}
                  >
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           gap: isMobile ? "8px" : "12px",
                           marginBottom: isMobile
                              ? "16px"
                              : isTablet
                              ? "20px"
                              : "24px",
                        }}
                     >
                        <SparklesIcon
                           style={{
                              width: isMobile ? 20 : isTablet ? 24 : 28,
                              height: isMobile ? 20 : isTablet ? 24 : 28,
                              color: "var(--accent)",
                           }}
                        />
                        <h3
                           style={{
                              fontSize: isMobile
                                 ? "18px"
                                 : isTablet
                                 ? "20px"
                                 : "24px",
                              fontWeight: 700,
                              margin: 0,
                              background:
                                 "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              backgroundClip: "text",
                           }}
                        >
                           Example Round
                        </h3>
                     </div>

                     <div
                        style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: isMobile
                              ? "14px"
                              : isTablet
                              ? "15px"
                              : "16px",
                           padding: isMobile
                              ? "16px"
                              : isTablet
                              ? "20px"
                              : "24px",
                           marginBottom: isMobile
                              ? "16px"
                              : isTablet
                              ? "20px"
                              : "24px",
                        }}
                     >
                        <p
                           style={{
                              margin: "0 0 16px",
                              color: "var(--text)",
                              fontSize: isMobile
                                 ? "14px"
                                 : isTablet
                                 ? "15px"
                                 : "16px",
                              fontWeight: 600,
                              textAlign: "center",
                           }}
                        >
                           Watch the words flash, then click in the same order:
                        </p>
                        <div
                           style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(3, 1fr)",
                              gap: isMobile
                                 ? "10px"
                                 : isTablet
                                 ? "12px"
                                 : "14px",
                              maxWidth: isMobile
                                 ? "280px"
                                 : isTablet
                                 ? "320px"
                                 : "360px",
                              margin: "0 auto",
                           }}
                        >
                           {[
                              "Apple",
                              "Beach",
                              "Cloud",
                              "Dance",
                              "Earth",
                              "Flame",
                              "Green",
                              "Happy",
                              "Image",
                           ].map((word, i) => {
                              // Example sequence: 1 → 0 → 2 (Beach → Apple → Cloud)
                              const exampleSequence = [1, 0, 2];
                              const isInSequence = exampleSequence.includes(i);
                              const orderInSequence =
                                 exampleSequence.indexOf(i);
                              return (
                                 <div
                                    key={i}
                                    style={{
                                       padding: isMobile
                                          ? "14px 10px"
                                          : isTablet
                                          ? "16px 12px"
                                          : "18px 14px",
                                       borderRadius: "12px",
                                       border: isInSequence
                                          ? "2px solid rgba(110, 168, 255, 0.8)"
                                          : "2px solid rgba(255, 255, 255, 0.1)",
                                       background: isInSequence
                                          ? "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.2))"
                                          : "rgba(15, 27, 51, 0.5)",
                                       boxShadow: isInSequence
                                          ? "0 0 20px rgba(59, 130, 246, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)"
                                          : "none",
                                       display: "flex",
                                       alignItems: "center",
                                       justifyContent: "center",
                                       fontSize: isMobile
                                          ? "0.85rem"
                                          : isTablet
                                          ? "0.9rem"
                                          : "1rem",
                                       fontWeight: 600,
                                       color: "var(--text)",
                                       position: "relative",
                                       textAlign: "center",
                                       transition: "all 0.2s ease",
                                       opacity: isInSequence ? 1 : 0.5,
                                    }}
                                 >
                                    {isInSequence ? word : word}
                                    {isInSequence && (
                                       <div
                                          style={{
                                             position: "absolute",
                                             top: "4px",
                                             right: "4px",
                                             width: isMobile
                                                ? "20px"
                                                : isTablet
                                                ? "22px"
                                                : "24px",
                                             height: isMobile
                                                ? "20px"
                                                : isTablet
                                                ? "22px"
                                                : "24px",
                                             borderRadius: "50%",
                                             background: "var(--ok)",
                                             color: "#0b1220",
                                             display: "flex",
                                             alignItems: "center",
                                             justifyContent: "center",
                                             fontSize: isMobile
                                                ? "0.7rem"
                                                : isTablet
                                                ? "0.75rem"
                                                : "0.75rem",
                                             fontWeight: 700,
                                             zIndex: 2,
                                          }}
                                       >
                                          {orderInSequence + 1}
                                       </div>
                                    )}
                                 </div>
                              );
                           })}
                        </div>
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: isMobile
                                 ? "12px"
                                 : isTablet
                                 ? "13px"
                                 : "14px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           Sequence: <strong>Beach → Apple → Cloud</strong>{" "}
                           (positions 2 → 1 → 3)
                        </p>
                     </div>

                     {isMobile && (
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "13px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           <span
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                                 justifyContent: "center",
                              }}
                           >
                              <CursorArrowRaysIcon
                                 style={{
                                    width: 16,
                                    height: 16,
                                    color: "var(--accent)",
                                 }}
                              />
                              Tap words to select them in order
                           </span>
                        </p>
                     )}
                     {!isMobile && (
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "13px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           <span
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                                 justifyContent: "center",
                              }}
                           >
                              <CursorArrowRaysIcon
                                 style={{
                                    width: 16,
                                    height: 16,
                                    color: "var(--accent)",
                                 }}
                              />
                              Click words to select them in order
                           </span>
                        </p>
                     )}
                  </div>
               )}

               {/* Interactive Example for Face Memory */}
               {gameType === "face-memory" && (
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(125, 211, 252, 0.1) 0%, rgba(54, 211, 153, 0.1) 100%)",
                        border: "2px solid var(--stroke)",
                        borderRadius: isMobile
                           ? "16px"
                           : isTablet
                           ? "18px"
                           : "20px",
                        padding: isMobile ? "20px" : isTablet ? "24px" : "32px",
                        marginTop: isMobile ? "16px" : "24px",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                     }}
                  >
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           gap: isMobile ? "8px" : "12px",
                           marginBottom: isMobile
                              ? "16px"
                              : isTablet
                              ? "20px"
                              : "24px",
                        }}
                     >
                        <SparklesIcon
                           style={{
                              width: isMobile ? 20 : isTablet ? 24 : 28,
                              height: isMobile ? 20 : isTablet ? 24 : 28,
                              color: "var(--accent)",
                           }}
                        />
                        <h3
                           style={{
                              fontSize: isMobile
                                 ? "18px"
                                 : isTablet
                                 ? "20px"
                                 : "24px",
                              fontWeight: 700,
                              margin: 0,
                              background:
                                 "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              backgroundClip: "text",
                           }}
                        >
                           Example Round
                        </h3>
                     </div>

                     <div
                        style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: isMobile
                              ? "14px"
                              : isTablet
                              ? "15px"
                              : "16px",
                           padding: isMobile
                              ? "16px"
                              : isTablet
                              ? "20px"
                              : "24px",
                           marginBottom: isMobile
                              ? "16px"
                              : isTablet
                              ? "20px"
                              : "24px",
                        }}
                     >
                        <p
                           style={{
                              margin: "0 0 16px",
                              color: "var(--text)",
                              fontSize: isMobile
                                 ? "14px"
                                 : isTablet
                                 ? "15px"
                                 : "16px",
                              fontWeight: 600,
                              textAlign: "center",
                           }}
                        >
                           Study the faces and their names, then match them:
                        </p>

                        {/* Memorizing Phase - Faces with Names */}
                        <div
                           style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(3, 1fr)",
                              gap: isMobile
                                 ? "12px"
                                 : isTablet
                                 ? "14px"
                                 : "16px",
                              maxWidth: isMobile
                                 ? "280px"
                                 : isTablet
                                 ? "320px"
                                 : "360px",
                              margin: "0 auto 20px",
                           }}
                        >
                           {[
                              { face: "😀", name: "Alex" },
                              { face: "😎", name: "Sam" },
                              { face: "🧑‍🦱", name: "Jordan" },
                           ].map((pair, i) => (
                              <div
                                 key={i}
                                 style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: isMobile ? "8px" : "10px",
                                    padding: isMobile
                                       ? "12px"
                                       : isTablet
                                       ? "14px"
                                       : "16px",
                                    borderRadius: "12px",
                                    border:
                                       "2px solid rgba(110, 168, 255, 0.5)",
                                    background:
                                       "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                                    boxShadow:
                                       "0 4px 12px rgba(59, 130, 246, 0.3)",
                                 }}
                              >
                                 <div
                                    style={{
                                       fontSize: isMobile
                                          ? "32px"
                                          : isTablet
                                          ? "36px"
                                          : "40px",
                                       lineHeight: 1,
                                    }}
                                 >
                                    {pair.face}
                                 </div>
                                 <div
                                    style={{
                                       fontSize: isMobile
                                          ? "0.85rem"
                                          : isTablet
                                          ? "0.9rem"
                                          : "1rem",
                                       fontWeight: 600,
                                       color: "var(--text)",
                                    }}
                                 >
                                    {pair.name}
                                 </div>
                              </div>
                           ))}
                        </div>

                        {/* Input Phase - Faces without Names */}
                        <div
                           style={{
                              borderTop: "2px solid var(--stroke)",
                              paddingTop: "20px",
                              marginTop: "20px",
                           }}
                        >
                           <p
                              style={{
                                 margin: "0 0 16px",
                                 color: "var(--text)",
                                 fontSize: isMobile
                                    ? "14px"
                                    : isTablet
                                    ? "15px"
                                    : "16px",
                                 fontWeight: 600,
                                 textAlign: "center",
                              }}
                           >
                              Now match each face with its name:
                           </p>
                           <div
                              style={{
                                 display: "grid",
                                 gridTemplateColumns: "repeat(3, 1fr)",
                                 gap: isMobile
                                    ? "12px"
                                    : isTablet
                                    ? "14px"
                                    : "16px",
                                 maxWidth: isMobile
                                    ? "280px"
                                    : isTablet
                                    ? "320px"
                                    : "360px",
                                 margin: "0 auto 16px",
                              }}
                           >
                              {[
                                 { face: "😀", name: "Alex" },
                                 { face: "😎", name: "Sam" },
                                 { face: "🧑‍🦱", name: "Jordan" },
                              ].map((pair, i) => (
                                 <div
                                    key={i}
                                    style={{
                                       display: "flex",
                                       flexDirection: "column",
                                       alignItems: "center",
                                       gap: isMobile ? "8px" : "10px",
                                       padding: isMobile
                                          ? "12px"
                                          : isTablet
                                          ? "14px"
                                          : "16px",
                                       borderRadius: "12px",
                                       border:
                                          "2px solid rgba(255, 255, 255, 0.2)",
                                       background: "rgba(15, 27, 51, 0.5)",
                                       position: "relative",
                                    }}
                                 >
                                    <div
                                       style={{
                                          fontSize: isMobile
                                             ? "32px"
                                             : isTablet
                                             ? "36px"
                                             : "40px",
                                          lineHeight: 1,
                                       }}
                                    >
                                       {pair.face}
                                    </div>
                                    <div
                                       style={{
                                          fontSize: isMobile
                                             ? "0.85rem"
                                             : isTablet
                                             ? "0.9rem"
                                             : "1rem",
                                          fontWeight: 600,
                                          color: "var(--ok)",
                                          padding: "4px 8px",
                                          borderRadius: "6px",
                                          background: "rgba(34, 197, 94, 0.2)",
                                       }}
                                    >
                                       {pair.name}
                                    </div>
                                 </div>
                              ))}
                           </div>
                           <p
                              style={{
                                 margin: "16px 0 0",
                                 color: "var(--muted)",
                                 fontSize: isMobile
                                    ? "12px"
                                    : isTablet
                                    ? "13px"
                                    : "14px",
                                 textAlign: "center",
                                 fontStyle: "italic",
                              }}
                           >
                              Click a face, then select its name from the list
                           </p>
                        </div>
                     </div>

                     {isMobile && (
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "13px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           <span
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                                 justifyContent: "center",
                              }}
                           >
                              <CursorArrowRaysIcon
                                 style={{
                                    width: 16,
                                    height: 16,
                                    color: "var(--accent)",
                                 }}
                              />
                              Tap a face, then tap its name
                           </span>
                        </p>
                     )}
                     {!isMobile && (
                        <p
                           style={{
                              margin: "16px 0 0",
                              color: "var(--muted)",
                              fontSize: "13px",
                              textAlign: "center",
                              fontStyle: "italic",
                           }}
                        >
                           <span
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                                 justifyContent: "center",
                              }}
                           >
                              <CursorArrowRaysIcon
                                 style={{
                                    width: 16,
                                    height: 16,
                                    color: "var(--accent)",
                                 }}
                              />
                              Click a face, then click its name
                           </span>
                        </p>
                     )}
                  </div>
               )}

               {/* Interactive Example for Color Grid Memory */}
               {gameType === "color-grid-memory" && (
                  <div
                     style={{
                        background: "var(--card)",
                        border: "2px solid var(--stroke)",
                        borderRadius: isMobile
                           ? "14px"
                           : isTablet
                           ? "15px"
                           : "16px",
                        padding: isMobile ? "16px" : isTablet ? "20px" : "24px",
                        marginBottom: isMobile
                           ? "16px"
                           : isTablet
                           ? "20px"
                           : "24px",
                     }}
                  >
                     <p
                        style={{
                           margin: "0 0 16px",
                           color: "var(--text)",
                           fontSize: isMobile
                              ? "14px"
                              : isTablet
                              ? "15px"
                              : "16px",
                           fontWeight: 600,
                           textAlign: "center",
                        }}
                     >
                        Watch the colored cells flash, then click them in order:
                     </p>

                     {/* Example Grid */}
                     <div
                        style={{
                           display: "grid",
                           gridTemplateColumns: "repeat(3, 1fr)",
                           gap: isMobile ? "8px" : "10px",
                           maxWidth: isMobile ? "200px" : "240px",
                           margin: "0 auto",
                        }}
                     >
                        {Array.from({ length: 9 }).map((_, idx) => {
                           const exampleSequence = [1, 4, 7];
                           const isInSequence = exampleSequence.includes(idx);
                           const sequenceIndex = exampleSequence.indexOf(idx);
                           const colors = [
                              "rgba(110, 168, 255, 0.9)",
                              "rgba(54, 211, 153, 0.9)",
                              "rgba(251, 191, 36, 0.9)",
                           ];

                           return (
                              <div
                                 key={idx}
                                 style={{
                                    width: "100%",
                                    aspectRatio: "1",
                                    minWidth: isMobile ? "50px" : "60px",
                                    minHeight: isMobile ? "50px" : "60px",
                                    borderRadius: "12px",
                                    border:
                                       "2px solid rgba(255, 255, 255, 0.1)",
                                    background:
                                       isInSequence && sequenceIndex >= 0
                                          ? colors[sequenceIndex]
                                          : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                                    boxShadow: isInSequence
                                       ? "0 4px 12px rgba(110, 168, 255, 0.3)"
                                       : "0 2px 8px rgba(0, 0, 0, 0.1)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: isMobile ? "0.7rem" : "0.75rem",
                                    fontWeight: 600,
                                    color: "white",
                                    transition: "all 0.2s ease",
                                 }}
                              >
                                 {isInSequence && sequenceIndex >= 0
                                    ? sequenceIndex + 1
                                    : ""}
                              </div>
                           );
                        })}
                     </div>

                     <p
                        style={{
                           margin: "16px 0 0",
                           color: "var(--muted)",
                           fontSize: "13px",
                           textAlign: "center",
                           fontStyle: "italic",
                        }}
                     >
                        <span
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              justifyContent: "center",
                           }}
                        >
                           <CursorArrowRaysIcon
                              style={{
                                 width: 16,
                                 height: 16,
                                 color: "var(--accent)",
                              }}
                           />
                           {isMobile
                              ? "Tap cells in the order they appeared"
                              : "Click cells in the order they appeared"}
                        </span>
                     </p>
                  </div>
               )}

               {/* Interactive Example for Symbol Stack */}
               {gameType === "symbol-stack" && (
                  <div
                     style={{
                        background: "var(--card)",
                        border: "2px solid var(--stroke)",
                        borderRadius: isMobile
                           ? "14px"
                           : isTablet
                           ? "15px"
                           : "16px",
                        padding: isMobile ? "16px" : isTablet ? "20px" : "24px",
                        marginBottom: isMobile
                           ? "16px"
                           : isTablet
                           ? "20px"
                           : "24px",
                     }}
                  >
                     <p
                        style={{
                           margin: "0 0 16px",
                           color: "var(--text)",
                           fontSize: isMobile
                              ? "14px"
                              : isTablet
                              ? "15px"
                              : "16px",
                           fontWeight: 600,
                           textAlign: "center",
                        }}
                     >
                        Watch the symbols stack up, then rebuild from bottom to
                        top:
                     </p>

                     {/* Example Stack */}
                     <div
                        style={{
                           display: "flex",
                           flexDirection: "column-reverse",
                           alignItems: "center",
                           gap: "10px",
                           minHeight: "180px",
                           padding: "20px",
                           background: "var(--panel)",
                           borderRadius: "12px",
                           border: "1px solid var(--border)",
                           marginBottom: "16px",
                        }}
                     >
                        {[
                           { Icon: StarIcon, name: "Star" },
                           { Icon: HeartIcon, name: "Heart" },
                           { Icon: HomeIcon, name: "Home" },
                        ].map(({ Icon, name }, idx) => (
                           <div
                              key={idx}
                              style={{
                                 width: "100px",
                                 height: "38px",
                                 borderRadius: "10px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 fontSize: "22px",
                                 fontWeight: 900,
                                 background: "rgba(59, 130, 246, 0.9)",
                                 border: "2px solid rgba(59, 130, 246, 0.9)",
                                 color: "white",
                                 transition: "all 0.2s ease",
                              }}
                           >
                              <Icon style={{ width: 22, height: 22 }} />
                           </div>
                        ))}
                     </div>

                     <p
                        style={{
                           margin: "0",
                           color: "var(--muted)",
                           fontSize: isMobile
                              ? "12px"
                              : isTablet
                              ? "13px"
                              : "14px",
                           textAlign: "center",
                        }}
                     >
                        Click symbols in the same order (bottom to top) to
                        rebuild the stack.
                     </p>
                  </div>
               )}

               {/* Interactive Example for Click the Green */}
               {gameType === "click-green" && (
                  <div
                     style={{
                        background: "var(--card)",
                        border: "2px solid var(--stroke)",
                        borderRadius: isMobile
                           ? "14px"
                           : isTablet
                           ? "15px"
                           : "16px",
                        padding: isMobile ? "16px" : isTablet ? "20px" : "24px",
                        marginBottom: isMobile
                           ? "16px"
                           : isTablet
                           ? "20px"
                           : "24px",
                     }}
                  >
                     <p
                        style={{
                           margin: "0 0 16px",
                           color: "var(--text)",
                           fontSize: isMobile
                              ? "14px"
                              : isTablet
                              ? "15px"
                              : "16px",
                           fontWeight: 600,
                           textAlign: "center",
                        }}
                     >
                        Click ONLY on green items (✓). Avoid red items (✕)!
                     </p>

                     {/* Example Arena */}
                     <div
                        style={{
                           position: "relative",
                           width: "100%",
                           minHeight: isMobile ? "300px" : "380px",
                           maxHeight: isMobile ? "300px" : "380px",
                           borderRadius: "var(--radius)",
                           border: "1px solid var(--border)",
                           background:
                              "radial-gradient(320px 220px at 30% 30%, rgba(59, 130, 246, 0.1), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                           boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
                           marginBottom: "16px",
                           overflow: "hidden",
                        }}
                     >
                        {/* Green Item Example */}
                        <div
                           style={{
                              position: "absolute",
                              top: "30%",
                              left: "25%",
                              transform: "translate(-50%, -50%)",
                              width: isMobile ? "48px" : "54px",
                              height: isMobile ? "48px" : "54px",
                              borderRadius: "16px",
                              border: "2px solid rgba(54, 211, 153, 0.55)",
                              background: "rgba(54, 211, 153, 0.18)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontSize: isMobile ? "20px" : "24px",
                              fontWeight: 900,
                              boxShadow: "0 4px 12px rgba(54, 211, 153, 0.3)",
                              animation: "pulse 2s ease-in-out infinite",
                           }}
                        >
                           ✓
                        </div>

                        {/* Red Item Example */}
                        <div
                           style={{
                              position: "absolute",
                              top: "50%",
                              right: "30%",
                              transform: "translate(50%, -50%)",
                              width: isMobile ? "48px" : "54px",
                              height: isMobile ? "48px" : "54px",
                              borderRadius: "16px",
                              border: "2px solid rgba(251, 113, 133, 0.55)",
                              background: "rgba(251, 113, 133, 0.16)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontSize: isMobile ? "20px" : "24px",
                              fontWeight: 900,
                              boxShadow: "0 4px 12px rgba(251, 113, 133, 0.3)",
                              animation: "pulse 2s ease-in-out infinite",
                           }}
                        >
                           ✕
                        </div>

                        {/* Another Green Item */}
                        <div
                           style={{
                              position: "absolute",
                              bottom: "25%",
                              left: "50%",
                              transform: "translate(-50%, 50%)",
                              width: isMobile ? "48px" : "54px",
                              height: isMobile ? "48px" : "54px",
                              borderRadius: "16px",
                              border: "2px solid rgba(54, 211, 153, 0.55)",
                              background: "rgba(54, 211, 153, 0.18)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontSize: isMobile ? "20px" : "24px",
                              fontWeight: 900,
                              boxShadow: "0 4px 12px rgba(54, 211, 153, 0.3)",
                              animation: "pulse 2s ease-in-out infinite",
                              animationDelay: "0.5s",
                           }}
                        >
                           ✓
                        </div>
                     </div>

                     <div
                        style={{
                           display: "flex",
                           gap: "12px",
                           justifyContent: "center",
                           marginBottom: "12px",
                           flexWrap: "wrap",
                        }}
                     >
                        <div
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 12px",
                              background: "rgba(54, 211, 153, 0.1)",
                              borderRadius: "8px",
                              border: "1px solid rgba(54, 211, 153, 0.3)",
                           }}
                        >
                           <div
                              style={{
                                 width: "20px",
                                 height: "20px",
                                 borderRadius: "8px",
                                 background: "rgba(54, 211, 153, 0.18)",
                                 border: "2px solid rgba(54, 211, 153, 0.55)",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 color: "white",
                                 fontSize: "12px",
                                 fontWeight: 900,
                              }}
                           >
                              ✓
                           </div>
                           <span
                              style={{
                                 fontSize: isMobile ? "12px" : "13px",
                                 color: "var(--text)",
                                 fontWeight: 600,
                              }}
                           >
                              Click = +10 points
                           </span>
                        </div>
                        <div
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 12px",
                              background: "rgba(251, 113, 133, 0.1)",
                              borderRadius: "8px",
                              border: "1px solid rgba(251, 113, 133, 0.3)",
                           }}
                        >
                           <div
                              style={{
                                 width: "20px",
                                 height: "20px",
                                 borderRadius: "8px",
                                 background: "rgba(251, 113, 133, 0.16)",
                                 border: "2px solid rgba(251, 113, 133, 0.55)",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 color: "white",
                                 fontSize: "12px",
                                 fontWeight: 900,
                              }}
                           >
                              ✕
                           </div>
                           <span
                              style={{
                                 fontSize: isMobile ? "12px" : "13px",
                                 color: "var(--text)",
                                 fontWeight: 600,
                              }}
                           >
                              Click = -5 points
                           </span>
                        </div>
                     </div>

                     <p
                        style={{
                           margin: "0",
                           color: "var(--muted)",
                           fontSize: isMobile
                              ? "12px"
                              : isTablet
                              ? "13px"
                              : "14px",
                           textAlign: "center",
                        }}
                     >
                        Items appear and disappear quickly. Click green items as
                        fast as you can to score points!
                     </p>
                  </div>
               )}

               {/* Interactive Example for Avoid the Red */}
               {gameType === "avoid-red" && (
                  <div
                     style={{
                        background: "var(--card)",
                        border: "2px solid var(--stroke)",
                        borderRadius: isMobile
                           ? "14px"
                           : isTablet
                           ? "15px"
                           : "16px",
                        padding: isMobile ? "16px" : isTablet ? "20px" : "24px",
                        marginBottom: isMobile
                           ? "16px"
                           : isTablet
                           ? "20px"
                           : "24px",
                     }}
                  >
                     <p
                        style={{
                           margin: "0 0 16px",
                           color: "var(--text)",
                           fontSize: isMobile
                              ? "14px"
                              : isTablet
                              ? "15px"
                              : "16px",
                           fontWeight: 600,
                           textAlign: "center",
                        }}
                     >
                        Move your cursor to control the blue dot. Avoid red
                        obstacles!
                     </p>

                     {/* Example Arena */}
                     <div
                        style={{
                           position: "relative",
                           width: "100%",
                           minHeight: isMobile ? "300px" : "380px",
                           maxHeight: isMobile ? "300px" : "380px",
                           borderRadius: "var(--radius)",
                           border: "1px solid var(--border)",
                           background:
                              "radial-gradient(320px 220px at 30% 30%, rgba(59, 130, 246, 0.1), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                           boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
                           marginBottom: "16px",
                           overflow: "hidden",
                        }}
                     >
                        {/* Player Example */}
                        <div
                           style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              width: "14px",
                              height: "14px",
                              borderRadius: "999px",
                              background: "rgba(110, 168, 255, 0.95)",
                              boxShadow: "0 0 18px rgba(110, 168, 255, 0.45)",
                              animation: "pulse 2s ease-in-out infinite",
                           }}
                        />

                        {/* Red Obstacle Example 1 */}
                        <div
                           style={{
                              position: "absolute",
                              top: "20%",
                              left: "20%",
                              transform: "translate(-50%, -50%)",
                              width: "24px",
                              height: "24px",
                              borderRadius: "12px",
                              background: "rgba(251, 113, 133, 0.9)",
                              boxShadow: "0 0 16px rgba(251, 113, 133, 0.35)",
                              animation: "pulse 2s ease-in-out infinite",
                           }}
                        />

                        {/* Red Obstacle Example 2 */}
                        <div
                           style={{
                              position: "absolute",
                              top: "70%",
                              right: "25%",
                              transform: "translate(50%, -50%)",
                              width: "28px",
                              height: "28px",
                              borderRadius: "14px",
                              background: "rgba(251, 113, 133, 0.9)",
                              boxShadow: "0 0 16px rgba(251, 113, 133, 0.35)",
                              animation: "pulse 2s ease-in-out infinite",
                              animationDelay: "0.5s",
                           }}
                        />

                        {/* Red Obstacle Example 3 */}
                        <div
                           style={{
                              position: "absolute",
                              bottom: "15%",
                              left: "60%",
                              transform: "translate(-50%, 50%)",
                              width: "22px",
                              height: "22px",
                              borderRadius: "11px",
                              background: "rgba(251, 113, 133, 0.9)",
                              boxShadow: "0 0 16px rgba(251, 113, 133, 0.35)",
                              animation: "pulse 2s ease-in-out infinite",
                              animationDelay: "1s",
                           }}
                        />
                     </div>

                     <div
                        style={{
                           display: "flex",
                           gap: "12px",
                           justifyContent: "center",
                           marginBottom: "12px",
                           flexWrap: "wrap",
                        }}
                     >
                        <div
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 12px",
                              background: "rgba(110, 168, 255, 0.1)",
                              borderRadius: "8px",
                              border: "1px solid rgba(110, 168, 255, 0.3)",
                           }}
                        >
                           <div
                              style={{
                                 width: "14px",
                                 height: "14px",
                                 borderRadius: "999px",
                                 background: "rgba(110, 168, 255, 0.95)",
                                 boxShadow: "0 0 18px rgba(110, 168, 255, 0.45)",
                              }}
                           />
                           <span
                              style={{
                                 fontSize: isMobile ? "12px" : "13px",
                                 color: "var(--text)",
                                 fontWeight: 600,
                              }}
                           >
                              Player (you)
                           </span>
                        </div>
                        <div
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 12px",
                              background: "rgba(251, 113, 133, 0.1)",
                              borderRadius: "8px",
                              border: "1px solid rgba(251, 113, 133, 0.3)",
                           }}
                        >
                           <div
                              style={{
                                 width: "20px",
                                 height: "20px",
                                 borderRadius: "10px",
                                 background: "rgba(251, 113, 133, 0.9)",
                                 boxShadow: "0 0 16px rgba(251, 113, 133, 0.35)",
                              }}
                           />
                           <span
                              style={{
                                 fontSize: isMobile ? "12px" : "13px",
                                 color: "var(--text)",
                                 fontWeight: 600,
                              }}
                           >
                              Avoid these!
                           </span>
                        </div>
                     </div>
                  </div>
               )}

               {/* Enhanced Start Screen for Mirror Match */}
               {gameType === "mirror-match" && (
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(125, 211, 252, 0.1) 0%, rgba(54, 211, 153, 0.1) 100%)",
                        border: "2px solid var(--stroke)",
                        borderRadius: isMobile
                           ? "16px"
                           : isTablet
                           ? "18px"
                           : "20px",
                        padding: isMobile ? "20px" : isTablet ? "24px" : "32px",
                        marginTop: isMobile ? "16px" : "24px",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                     }}
                  >
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           gap: isMobile ? "8px" : "12px",
                           marginBottom: isMobile
                              ? "16px"
                              : isTablet
                              ? "20px"
                              : "24px",
                        }}
                     >
                        <ScaleIcon
                           style={{
                              width: isMobile ? 20 : isTablet ? 24 : 28,
                              height: isMobile ? 20 : isTablet ? 24 : 28,
                              color: "var(--accent)",
                           }}
                        />
                        <h3
                           style={{
                              fontSize: isMobile
                                 ? "18px"
                                 : isTablet
                                 ? "20px"
                                 : "24px",
                              fontWeight: 700,
                              margin: 0,
                              background:
                                 "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              backgroundClip: "text",
                           }}
                        >
                           Mirror Types Explained
                        </h3>
                     </div>

                     <div
                        style={{
                           display: "grid",
                           gridTemplateColumns: isMobile
                              ? "1fr"
                              : isTablet
                              ? "repeat(2, 1fr)"
                              : "repeat(3, 1fr)",
                           gap: isMobile ? "16px" : isTablet ? "18px" : "20px",
                           marginBottom: isMobile
                              ? "16px"
                              : isTablet
                              ? "20px"
                              : "24px",
                        }}
                     >
                        {/* Horizontal Mirror */}
                        <div
                           style={{
                              background: "var(--card)",
                              border: "2px solid var(--stroke)",
                              borderRadius: isMobile
                                 ? "14px"
                                 : isTablet
                                 ? "15px"
                                 : "16px",
                              padding: isMobile
                                 ? "16px"
                                 : isTablet
                                 ? "20px"
                                 : "24px",
                              textAlign: "center",
                              transition: "all 0.3s ease",
                              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: isMobile
                                    ? "14px"
                                    : isTablet
                                    ? "15px"
                                    : "16px",
                                 fontWeight: 700,
                                 color: "var(--accent)",
                                 marginBottom: isMobile
                                    ? "12px"
                                    : isTablet
                                    ? "14px"
                                    : "16px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 gap: isMobile ? "6px" : "8px",
                              }}
                           >
                              <ArrowPathIcon
                                 style={{
                                    width: isMobile ? 16 : isTablet ? 17 : 18,
                                    height: isMobile ? 16 : isTablet ? 17 : 18,
                                 }}
                              />
                              Horizontal
                           </div>
                           <div
                              style={{
                                 display: "flex",
                                 flexDirection: "column",
                                 alignItems: "center",
                                 gap: isMobile
                                    ? "8px"
                                    : isTablet
                                    ? "10px"
                                    : "12px",
                                 minHeight: isMobile
                                    ? "140px"
                                    : isTablet
                                    ? "160px"
                                    : "180px",
                              }}
                           >
                              <div
                                 style={{
                                    background: "rgba(125, 211, 252, 0.1)",
                                    borderRadius: isMobile ? "10px" : "12px",
                                    padding: isMobile
                                       ? "12px"
                                       : isTablet
                                       ? "14px"
                                       : "16px",
                                    border: "1px solid var(--stroke)",
                                 }}
                              >
                                 <svg
                                    viewBox="0 0 100 100"
                                    width={
                                       isMobile ? "60" : isTablet ? "70" : "80"
                                    }
                                    height={
                                       isMobile ? "60" : isTablet ? "70" : "80"
                                    }
                                    style={{
                                       stroke: "rgba(232, 238, 252, 0.92)",
                                       strokeWidth: "10",
                                       fill: "none",
                                       strokeLinecap: "round",
                                       strokeLinejoin: "round",
                                    }}
                                 >
                                    <path d="M20 60 L52 28" />
                                    <path d="M52 28 L66 42" />
                                    <path d="M66 42 L60 48" />
                                    <circle
                                       cx="22"
                                       cy="62"
                                       r="4"
                                       fill="rgba(232, 238, 252, 0.92)"
                                    />
                                 </svg>
                              </div>
                              <div
                                 style={{
                                    fontSize: isMobile
                                       ? "16px"
                                       : isTablet
                                       ? "18px"
                                       : "20px",
                                    color: "var(--accent)",
                                    fontWeight: 600,
                                 }}
                              >
                                 →
                              </div>
                              <div
                                 style={{
                                    background: "rgba(125, 211, 252, 0.1)",
                                    borderRadius: isMobile ? "10px" : "12px",
                                    padding: isMobile
                                       ? "12px"
                                       : isTablet
                                       ? "14px"
                                       : "16px",
                                    border: "1px solid var(--stroke)",
                                    transform: "scaleX(-1)",
                                 }}
                              >
                                 <svg
                                    viewBox="0 0 100 100"
                                    width={
                                       isMobile ? "60" : isTablet ? "70" : "80"
                                    }
                                    height={
                                       isMobile ? "60" : isTablet ? "70" : "80"
                                    }
                                    style={{
                                       stroke: "rgba(232, 238, 252, 0.92)",
                                       strokeWidth: "10",
                                       fill: "none",
                                       strokeLinecap: "round",
                                       strokeLinejoin: "round",
                                    }}
                                 >
                                    <path d="M20 60 L52 28" />
                                    <path d="M52 28 L66 42" />
                                    <path d="M66 42 L60 48" />
                                    <circle
                                       cx="22"
                                       cy="62"
                                       r="4"
                                       fill="rgba(232, 238, 252, 0.92)"
                                    />
                                 </svg>
                              </div>
                              <div
                                 style={{
                                    fontSize: isMobile
                                       ? "11px"
                                       : isTablet
                                       ? "12px"
                                       : "13px",
                                    color: "var(--muted)",
                                    marginTop: isMobile ? "4px" : "8px",
                                    fontWeight: 600,
                                 }}
                              >
                                 Flips left ↔ right
                              </div>
                           </div>
                        </div>

                        {/* Vertical Mirror */}
                        <div
                           style={{
                              background: "var(--card)",
                              border: "2px solid var(--stroke)",
                              borderRadius: isMobile
                                 ? "14px"
                                 : isTablet
                                 ? "15px"
                                 : "16px",
                              padding: isMobile
                                 ? "16px"
                                 : isTablet
                                 ? "20px"
                                 : "24px",
                              textAlign: "center",
                              transition: "all 0.3s ease",
                              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: isMobile
                                    ? "14px"
                                    : isTablet
                                    ? "15px"
                                    : "16px",
                                 fontWeight: 700,
                                 color: "var(--accent)",
                                 marginBottom: isMobile
                                    ? "12px"
                                    : isTablet
                                    ? "14px"
                                    : "16px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 gap: isMobile ? "6px" : "8px",
                              }}
                           >
                              <ArrowPathIcon
                                 style={{
                                    width: isMobile ? 16 : isTablet ? 17 : 18,
                                    height: isMobile ? 16 : isTablet ? 17 : 18,
                                    transform: "rotate(90deg)",
                                 }}
                              />
                              Vertical
                           </div>
                           <div
                              style={{
                                 display: "flex",
                                 flexDirection: "column",
                                 alignItems: "center",
                                 gap: isMobile
                                    ? "8px"
                                    : isTablet
                                    ? "10px"
                                    : "12px",
                                 minHeight: isMobile
                                    ? "140px"
                                    : isTablet
                                    ? "160px"
                                    : "180px",
                              }}
                           >
                              <div
                                 style={{
                                    background: "rgba(54, 211, 153, 0.1)",
                                    borderRadius: isMobile ? "10px" : "12px",
                                    padding: isMobile
                                       ? "12px"
                                       : isTablet
                                       ? "14px"
                                       : "16px",
                                    border: "1px solid var(--stroke)",
                                 }}
                              >
                                 <svg
                                    viewBox="0 0 100 100"
                                    width={
                                       isMobile ? "60" : isTablet ? "70" : "80"
                                    }
                                    height={
                                       isMobile ? "60" : isTablet ? "70" : "80"
                                    }
                                    style={{
                                       stroke: "rgba(232, 238, 252, 0.92)",
                                       strokeWidth: "10",
                                       fill: "none",
                                       strokeLinecap: "round",
                                       strokeLinejoin: "round",
                                    }}
                                 >
                                    <path d="M20 60 L52 28" />
                                    <path d="M52 28 L66 42" />
                                    <path d="M66 42 L60 48" />
                                    <circle
                                       cx="22"
                                       cy="62"
                                       r="4"
                                       fill="rgba(232, 238, 252, 0.92)"
                                    />
                                 </svg>
                              </div>
                              <div
                                 style={{
                                    fontSize: isMobile
                                       ? "16px"
                                       : isTablet
                                       ? "18px"
                                       : "20px",
                                    color: "var(--ok)",
                                    fontWeight: 600,
                                 }}
                              >
                                 ↓
                              </div>
                              <div
                                 style={{
                                    background: "rgba(54, 211, 153, 0.1)",
                                    borderRadius: isMobile ? "10px" : "12px",
                                    padding: isMobile
                                       ? "12px"
                                       : isTablet
                                       ? "14px"
                                       : "16px",
                                    border: "1px solid var(--stroke)",
                                    transform: "scaleY(-1)",
                                 }}
                              >
                                 <svg
                                    viewBox="0 0 100 100"
                                    width={
                                       isMobile ? "60" : isTablet ? "70" : "80"
                                    }
                                    height={
                                       isMobile ? "60" : isTablet ? "70" : "80"
                                    }
                                    style={{
                                       stroke: "rgba(232, 238, 252, 0.92)",
                                       strokeWidth: "10",
                                       fill: "none",
                                       strokeLinecap: "round",
                                       strokeLinejoin: "round",
                                    }}
                                 >
                                    <path d="M20 60 L52 28" />
                                    <path d="M52 28 L66 42" />
                                    <path d="M66 42 L60 48" />
                                    <circle
                                       cx="22"
                                       cy="62"
                                       r="4"
                                       fill="rgba(232, 238, 252, 0.92)"
                                    />
                                 </svg>
                              </div>
                              <div
                                 style={{
                                    fontSize: isMobile
                                       ? "11px"
                                       : isTablet
                                       ? "12px"
                                       : "13px",
                                    color: "var(--muted)",
                                    marginTop: isMobile ? "4px" : "8px",
                                    fontWeight: 600,
                                 }}
                              >
                                 Flips top ↔ bottom
                              </div>
                           </div>
                        </div>

                        {/* Diagonal Mirror */}
                        <div
                           style={{
                              background: "var(--card)",
                              border: "2px solid var(--stroke)",
                              borderRadius: isMobile
                                 ? "14px"
                                 : isTablet
                                 ? "15px"
                                 : "16px",
                              padding: isMobile
                                 ? "16px"
                                 : isTablet
                                 ? "20px"
                                 : "24px",
                              textAlign: "center",
                              transition: "all 0.3s ease",
                              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: isMobile
                                    ? "14px"
                                    : isTablet
                                    ? "15px"
                                    : "16px",
                                 fontWeight: 700,
                                 color: "var(--accent)",
                                 marginBottom: isMobile
                                    ? "12px"
                                    : isTablet
                                    ? "14px"
                                    : "16px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 gap: isMobile ? "6px" : "8px",
                              }}
                           >
                              <ArrowPathIcon
                                 style={{
                                    width: isMobile ? 16 : isTablet ? 17 : 18,
                                    height: isMobile ? 16 : isTablet ? 17 : 18,
                                    transform: "rotate(45deg)",
                                 }}
                              />
                              Diagonal
                           </div>
                           <div
                              style={{
                                 display: "flex",
                                 flexDirection: "column",
                                 alignItems: "center",
                                 gap: isMobile
                                    ? "8px"
                                    : isTablet
                                    ? "10px"
                                    : "12px",
                                 minHeight: isMobile
                                    ? "140px"
                                    : isTablet
                                    ? "160px"
                                    : "180px",
                              }}
                           >
                              <div
                                 style={{
                                    background: "rgba(168, 85, 247, 0.1)",
                                    borderRadius: isMobile ? "10px" : "12px",
                                    padding: isMobile
                                       ? "12px"
                                       : isTablet
                                       ? "14px"
                                       : "16px",
                                    border: "1px solid var(--stroke)",
                                 }}
                              >
                                 <svg
                                    viewBox="0 0 100 100"
                                    width={
                                       isMobile ? "60" : isTablet ? "70" : "80"
                                    }
                                    height={
                                       isMobile ? "60" : isTablet ? "70" : "80"
                                    }
                                    style={{
                                       stroke: "rgba(232, 238, 252, 0.92)",
                                       strokeWidth: "10",
                                       fill: "none",
                                       strokeLinecap: "round",
                                       strokeLinejoin: "round",
                                    }}
                                 >
                                    <path d="M20 60 L52 28" />
                                    <path d="M52 28 L66 42" />
                                    <path d="M66 42 L60 48" />
                                    <circle
                                       cx="22"
                                       cy="62"
                                       r="4"
                                       fill="rgba(232, 238, 252, 0.92)"
                                    />
                                 </svg>
                              </div>
                              <div
                                 style={{
                                    fontSize: isMobile
                                       ? "16px"
                                       : isTablet
                                       ? "18px"
                                       : "20px",
                                    color: "#a855f7",
                                    fontWeight: 600,
                                 }}
                              >
                                 ↻
                              </div>
                              <div
                                 style={{
                                    background: "rgba(168, 85, 247, 0.1)",
                                    borderRadius: isMobile ? "10px" : "12px",
                                    padding: isMobile
                                       ? "12px"
                                       : isTablet
                                       ? "14px"
                                       : "16px",
                                    border: "1px solid var(--stroke)",
                                    transform: "scale(-1, -1)",
                                 }}
                              >
                                 <svg
                                    viewBox="0 0 100 100"
                                    width={
                                       isMobile ? "60" : isTablet ? "70" : "80"
                                    }
                                    height={
                                       isMobile ? "60" : isTablet ? "70" : "80"
                                    }
                                    style={{
                                       stroke: "rgba(232, 238, 252, 0.92)",
                                       strokeWidth: "10",
                                       fill: "none",
                                       strokeLinecap: "round",
                                       strokeLinejoin: "round",
                                    }}
                                 >
                                    <path d="M20 60 L52 28" />
                                    <path d="M52 28 L66 42" />
                                    <path d="M66 42 L60 48" />
                                    <circle
                                       cx="22"
                                       cy="62"
                                       r="4"
                                       fill="rgba(232, 238, 252, 0.92)"
                                    />
                                 </svg>
                              </div>
                              <div
                                 style={{
                                    fontSize: isMobile
                                       ? "11px"
                                       : isTablet
                                       ? "12px"
                                       : "13px",
                                    color: "var(--muted)",
                                    marginTop: isMobile ? "4px" : "8px",
                                    fontWeight: 600,
                                 }}
                              >
                                 Flips both ways
                              </div>
                           </div>
                        </div>
                     </div>

                     <div
                        style={{
                           background: "rgba(11, 22, 48, 0.4)",
                           border: "1px solid var(--stroke)",
                           borderRadius: "12px",
                           padding: "20px",
                           marginTop: "24px",
                        }}
                     >
                        <div
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              marginBottom: "12px",
                           }}
                        >
                           <LightBulbIcon
                              style={{
                                 width: 20,
                                 height: 20,
                                 color: "var(--accent)",
                              }}
                           />
                           <h4
                              style={{
                                 fontSize: "16px",
                                 fontWeight: 600,
                                 margin: 0,
                                 color: "var(--text)",
                              }}
                           >
                              How to Play
                           </h4>
                        </div>
                        <ul
                           style={{
                              margin: 0,
                              paddingLeft: "24px",
                              color: "var(--muted)",
                              fontSize: "14px",
                              lineHeight: "1.8",
                           }}
                        >
                           <li>Look at the main shape at the top</li>
                           <li>
                              Read the mirror type (Horizontal, Vertical, or
                              Diagonal)
                           </li>
                           <li>
                              Select the option that shows the correct mirror
                              transformation
                           </li>
                           <li>You have 3 options - only one is correct!</li>
                           <li>
                              Use number keys{" "}
                              <strong style={{ color: "var(--accent)" }}>
                                 1, 2, 3
                              </strong>{" "}
                              for quick selection
                           </li>
                        </ul>
                     </div>
                  </div>
               )}

               {/* Sequence Arrows Start Screen Preview */}
               {gameType === "sequence-arrows" && (
                  <div className="solution-preview">
                     <h4
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "8px",
                           marginBottom: "12px",
                        }}
                     >
                        <InformationCircleIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                        How Sequence Arrows Works
                     </h4>
                     <div style={{ marginBottom: "20px" }}>
                        <p
                           style={{
                              fontSize: "0.9rem",
                              color: "var(--muted)",
                              marginBottom: "16px",
                           }}
                        >
                           You will see a sequence of arrows (↑ ↓ ← →) with one
                           missing arrow shown as{" "}
                           <strong style={{ color: "var(--accent)" }}>?</strong>
                           . Your task is to predict which arrow should come
                           next in the sequence.
                        </p>
                        <div
                           style={{
                              background: "var(--card)",
                              border: "2px solid var(--stroke)",
                              borderRadius: "16px",
                              padding: "24px",
                              marginBottom: "16px",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: "16px",
                                 fontWeight: 700,
                                 color: "var(--accent)",
                                 marginBottom: "16px",
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "8px",
                              }}
                           >
                              <ArrowPathIcon
                                 style={{ width: 18, height: 18 }}
                              />
                              Example Sequence
                           </div>
                           <div
                              style={{
                                 display: "flex",
                                 gap: "16px",
                                 justifyContent: "center",
                                 alignItems: "center",
                                 marginBottom: "16px",
                                 flexWrap: "wrap",
                              }}
                           >
                              <div
                                 style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "64px",
                                    height: "64px",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "2px solid var(--stroke)",
                                    borderRadius: "12px",
                                 }}
                              >
                                 <ArrowUpIcon
                                    style={{
                                       width: 40,
                                       height: 40,
                                       color: "var(--accent)",
                                    }}
                                 />
                              </div>
                              <div
                                 style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "64px",
                                    height: "64px",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "2px solid var(--stroke)",
                                    borderRadius: "12px",
                                 }}
                              >
                                 <ArrowRightIcon
                                    style={{
                                       width: 40,
                                       height: 40,
                                       color: "var(--accent)",
                                    }}
                                 />
                              </div>
                              <div
                                 style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "64px",
                                    height: "64px",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "2px solid var(--stroke)",
                                    borderRadius: "12px",
                                 }}
                              >
                                 <ArrowDownIcon
                                    style={{
                                       width: 40,
                                       height: 40,
                                       color: "var(--accent)",
                                    }}
                                 />
                              </div>
                              <div
                                 style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "64px",
                                    height: "64px",
                                    background: "rgba(125, 211, 252, 0.2)",
                                    border: "2px solid var(--accent)",
                                    borderRadius: "12px",
                                    fontSize: "1.5rem",
                                    fontWeight: 700,
                                    color: "var(--accent)",
                                 }}
                              >
                                 ?
                              </div>
                              <div
                                 style={{
                                    fontSize: "24px",
                                    color: "var(--muted)",
                                    fontWeight: 600,
                                    margin: "0 8px",
                                 }}
                              >
                                 →
                              </div>
                              <div
                                 style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "64px",
                                    height: "64px",
                                    background: "rgba(134, 239, 172, 0.2)",
                                    border: "2px solid var(--ok)",
                                    borderRadius: "12px",
                                    position: "relative",
                                 }}
                              >
                                 <ArrowLeftIcon
                                    style={{
                                       width: 40,
                                       height: 40,
                                       color: "var(--ok)",
                                    }}
                                 />
                                 <CheckCircleIcon
                                    style={{
                                       position: "absolute",
                                       top: "-8px",
                                       right: "-8px",
                                       width: "20px",
                                       height: "20px",
                                       color: "var(--ok)",
                                       background: "var(--card)",
                                       borderRadius: "50%",
                                    }}
                                 />
                              </div>
                           </div>
                           <div
                              style={{
                                 display: "flex",
                                 flexDirection: "column",
                                 gap: "8px",
                                 marginTop: "12px",
                              }}
                           >
                              <p
                                 style={{
                                    fontSize: "0.85rem",
                                    color: "var(--muted)",
                                    textAlign: "center",
                                    fontStyle: "italic",
                                 }}
                              >
                                 Pattern: Clockwise rotation (↑ → ↓ ←)
                              </p>
                              <p
                                 style={{
                                    fontSize: "0.9rem",
                                    color: "var(--ok)",
                                    textAlign: "center",
                                    fontWeight: 600,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px",
                                 }}
                              >
                                 <CheckCircleIcon
                                    style={{ width: 16, height: 16 }}
                                 />
                                 Answer: ← (Left Arrow)
                              </p>
                           </div>
                        </div>
                        <div
                           style={{
                              background: "rgba(125, 211, 252, 0.1)",
                              border: "1px solid var(--stroke)",
                              borderRadius: "12px",
                              padding: "16px",
                              fontSize: "0.9rem",
                              color: "var(--text)",
                              marginBottom: "16px",
                           }}
                        >
                           <strong style={{ color: "var(--accent)" }}>
                              Tip:
                           </strong>{" "}
                           The sequence length increases as you progress. Pay
                           attention to the pattern direction and repetition!
                        </div>

                        {/* Patterns to Look For */}
                        <div
                           style={{
                              background: "var(--card)",
                              border: "2px solid var(--stroke)",
                              borderRadius: "16px",
                              padding: "24px",
                              marginTop: "16px",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: "16px",
                                 fontWeight: 700,
                                 color: "var(--accent)",
                                 marginBottom: "16px",
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "8px",
                              }}
                           >
                              <LightBulbIcon
                                 style={{ width: 18, height: 18 }}
                              />
                              What Patterns to Look For
                           </div>
                           <div
                              style={{
                                 display: "flex",
                                 flexDirection: "column",
                                 gap: "12px",
                                 fontSize: "0.9rem",
                              }}
                           >
                              <div
                                 style={{
                                    padding: "12px",
                                    background: "rgba(125, 211, 252, 0.1)",
                                    borderRadius: "8px",
                                    border: "1px solid var(--stroke)",
                                 }}
                              >
                                 <strong style={{ color: "var(--accent)" }}>
                                    Clockwise rotation:
                                 </strong>
                                 <span
                                    style={{
                                       color: "var(--text)",
                                       marginLeft: "8px",
                                    }}
                                 >
                                    ↑ → ↓ ← (then repeats)
                                 </span>
                              </div>
                              <div
                                 style={{
                                    padding: "12px",
                                    background: "rgba(125, 211, 252, 0.1)",
                                    borderRadius: "8px",
                                    border: "1px solid var(--stroke)",
                                 }}
                              >
                                 <strong style={{ color: "var(--accent)" }}>
                                    Counter-clockwise rotation:
                                 </strong>
                                 <span
                                    style={{
                                       color: "var(--text)",
                                       marginLeft: "8px",
                                    }}
                                 >
                                    ↑ ← ↓ → (then repeats)
                                 </span>
                              </div>
                              <div
                                 style={{
                                    padding: "12px",
                                    background: "rgba(125, 211, 252, 0.1)",
                                    borderRadius: "8px",
                                    border: "1px solid var(--stroke)",
                                 }}
                              >
                                 <strong style={{ color: "var(--accent)" }}>
                                    Repeating loops:
                                 </strong>
                                 <span
                                    style={{
                                       color: "var(--text)",
                                       marginLeft: "8px",
                                    }}
                                 >
                                    e.g., ↑ ↑ → → ↓ ↓ ← ←
                                 </span>
                              </div>
                              <div
                                 style={{
                                    padding: "12px",
                                    background: "rgba(125, 211, 252, 0.1)",
                                    borderRadius: "8px",
                                    border: "1px solid var(--stroke)",
                                 }}
                              >
                                 <strong style={{ color: "var(--accent)" }}>
                                    Alternating directions:
                                 </strong>
                                 <span
                                    style={{
                                       color: "var(--text)",
                                       marginLeft: "8px",
                                    }}
                                 >
                                    e.g., ↑ → ↑ → …
                                 </span>
                              </div>
                              <div
                                 style={{
                                    padding: "12px",
                                    background: "rgba(125, 211, 252, 0.1)",
                                    borderRadius: "8px",
                                    border: "1px solid var(--stroke)",
                                 }}
                              >
                                 <strong style={{ color: "var(--accent)" }}>
                                    Step jumps:
                                 </strong>
                                 <span
                                    style={{
                                       color: "var(--text)",
                                       marginLeft: "8px",
                                    }}
                                 >
                                    skipping one direction each time
                                 </span>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {/* Block Fill Start Screen Explanation */}
               {gameType === "block-fill" && (
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(125, 211, 252, 0.1) 0%, rgba(54, 211, 153, 0.1) 100%)",
                        border: "2px solid var(--stroke)",
                        borderRadius: "20px",
                        padding: "32px",
                        marginTop: "24px",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                     }}
                  >
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           gap: "12px",
                           marginBottom: "24px",
                        }}
                     >
                        <PuzzlePieceIcon
                           style={{
                              width: 28,
                              height: 28,
                              color: "var(--accent)",
                           }}
                        />
                        <h3
                           style={{
                              fontSize: "24px",
                              fontWeight: 700,
                              margin: 0,
                              background:
                                 "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              backgroundClip: "text",
                           }}
                        >
                           Block Fill - Polyomino Puzzle
                        </h3>
                     </div>

                     <div
                        style={{
                           background: "rgba(11, 22, 48, 0.4)",
                           border: "1px solid var(--stroke)",
                           borderRadius: "12px",
                           padding: "20px",
                           marginBottom: "24px",
                        }}
                     >
                        <div
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              marginBottom: "12px",
                           }}
                        >
                           <LightBulbIcon
                              style={{
                                 width: 20,
                                 height: 20,
                                 color: "var(--accent)",
                              }}
                           />
                           <h4
                              style={{
                                 fontSize: "16px",
                                 fontWeight: 600,
                                 margin: 0,
                                 color: "var(--text)",
                              }}
                           >
                              How to Play
                           </h4>
                        </div>
                        <ul
                           style={{
                              margin: 0,
                              paddingLeft: "24px",
                              color: "var(--muted)",
                              fontSize: "14px",
                              lineHeight: "1.8",
                           }}
                        >
                           <li>
                              <strong style={{ color: "var(--accent)" }}>
                                 Goal:
                              </strong>{" "}
                              Fill the entire grid by placing all available
                              pieces
                           </li>
                           <li>
                              <strong style={{ color: "var(--accent)" }}>
                                 Select a piece:
                              </strong>{" "}
                              Click on a piece from the right panel to select it
                           </li>
                           <li>
                              <strong style={{ color: "var(--accent)" }}>
                                 Rotate:
                              </strong>{" "}
                              Press{" "}
                              <strong style={{ color: "var(--accent)" }}>
                                 R
                              </strong>{" "}
                              key or click "Rotate" button to rotate the
                              selected piece
                           </li>
                           <li>
                              <strong style={{ color: "var(--accent)" }}>
                                 Place:
                              </strong>{" "}
                              Click on an empty cell on the grid to place the
                              selected piece
                           </li>
                           <li>
                              <strong style={{ color: "var(--accent)" }}>
                                 Remove:
                              </strong>{" "}
                              Click on a filled cell to remove that piece and
                              try again
                           </li>
                           <li>
                              <strong style={{ color: "var(--accent)" }}>
                                 Undo:
                              </strong>{" "}
                              Press{" "}
                              <strong style={{ color: "var(--accent)" }}>
                                 U
                              </strong>{" "}
                              key or click "Undo" to remove the last placed
                              piece
                           </li>
                           <li>
                              <strong style={{ color: "var(--accent)" }}>
                                 Ghost Preview:
                              </strong>{" "}
                              Hover over the grid to see where the piece will be
                              placed (blue = valid, red = invalid)
                           </li>
                        </ul>
                     </div>

                     <div
                        style={{
                           display: "grid",
                           gridTemplateColumns: "repeat(2, 1fr)",
                           gap: "16px",
                           marginBottom: "24px",
                        }}
                     >
                        <div
                           style={{
                              background: "var(--card)",
                              border: "1px solid var(--stroke)",
                              borderRadius: "12px",
                              padding: "16px",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: "14px",
                                 fontWeight: 600,
                                 color: "var(--accent)",
                                 marginBottom: "8px",
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                              }}
                           >
                              <LightBulbIcon
                                 style={{ width: 16, height: 16 }}
                              />
                              Tips
                           </div>
                           <ul
                              style={{
                                 margin: 0,
                                 paddingLeft: "20px",
                                 color: "var(--muted)",
                                 fontSize: "13px",
                                 lineHeight: "1.6",
                              }}
                           >
                              <li>
                                 Start with <strong>larger pieces</strong> first
                              </li>
                              <li>
                                 Build from <strong>corners and edges</strong>
                              </li>
                              <li>Use rotation to fit pieces better</li>
                              <li>
                                 If stuck, remove pieces and try different
                                 placements
                              </li>
                           </ul>
                        </div>
                        <div
                           style={{
                              background: "var(--card)",
                              border: "1px solid var(--stroke)",
                              borderRadius: "12px",
                              padding: "16px",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: "14px",
                                 fontWeight: 600,
                                 color: "var(--accent)",
                                 marginBottom: "8px",
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                              }}
                           >
                              <KeyIcon style={{ width: 18, height: 18 }} />
                              Keyboard Shortcuts
                           </div>
                           <ul
                              style={{
                                 margin: 0,
                                 paddingLeft: "20px",
                                 color: "var(--muted)",
                                 fontSize: "13px",
                                 lineHeight: "1.6",
                              }}
                           >
                              <li>
                                 <strong style={{ color: "var(--accent)" }}>
                                    R
                                 </strong>{" "}
                                 - Rotate selected piece
                              </li>
                              <li>
                                 <strong style={{ color: "var(--accent)" }}>
                                    U
                                 </strong>{" "}
                                 - Undo last placement
                              </li>
                              <li>
                                 <strong style={{ color: "var(--accent)" }}>
                                    ESC
                                 </strong>{" "}
                                 - Deselect piece
                              </li>
                           </ul>
                        </div>
                     </div>

                     <div
                        style={{
                           background: "rgba(54, 211, 153, 0.1)",
                           border: "1px solid rgba(54, 211, 153, 0.3)",
                           borderRadius: "12px",
                           padding: "16px",
                           display: "flex",
                           alignItems: "center",
                           gap: "12px",
                        }}
                     >
                        <CheckCircleIcon
                           style={{ width: 20, height: 20, color: "var(--ok)" }}
                        />
                        <div
                           style={{
                              fontSize: "14px",
                              color: "var(--text)",
                           }}
                        >
                           <strong>Complete the puzzle:</strong> Fill all cells
                           using every piece exactly once. Each round is a new
                           puzzle!
                        </div>
                     </div>
                  </div>
               )}

               {/* Interactive Example for Card Flip Memory */}
               {gameType === "card-flip" && (
                  <div
                     style={{
                        background:
                           "linear-gradient(135deg, rgba(125, 211, 252, 0.1) 0%, rgba(54, 211, 153, 0.1) 100%)",
                        border: "2px solid var(--stroke)",
                        borderRadius: "20px",
                        padding: "32px",
                        marginTop: "24px",
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                     }}
                  >
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           gap: "12px",
                           marginBottom: "24px",
                        }}
                     >
                        <svg
                           style={{
                              width: 28,
                              height: 28,
                              color: "var(--accent)",
                           }}
                           fill="none"
                           viewBox="0 0 24 24"
                           stroke="currentColor"
                        >
                           <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 6h16M4 12h16M4 18h16"
                           />
                        </svg>
                        <h3
                           style={{
                              fontSize: "24px",
                              fontWeight: 700,
                              margin: 0,
                              background:
                                 "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              backgroundClip: "text",
                           }}
                        >
                           Card Flip Memory - Example
                        </h3>
                     </div>

                     <div
                        style={{
                           background: "rgba(11, 22, 48, 0.4)",
                           border: "1px solid var(--stroke)",
                           borderRadius: "12px",
                           padding: "20px",
                           marginBottom: "24px",
                        }}
                     >
                        <div
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              marginBottom: "12px",
                           }}
                        >
                           <LightBulbIcon
                              style={{
                                 width: 20,
                                 height: 20,
                                 color: "var(--accent)",
                              }}
                           />
                           <h4
                              style={{
                                 fontSize: "16px",
                                 fontWeight: 600,
                                 margin: 0,
                                 color: "var(--text)",
                              }}
                           >
                              How to Play
                           </h4>
                        </div>
                        <ul
                           style={{
                              margin: 0,
                              paddingLeft: "24px",
                              color: "var(--muted)",
                              fontSize: "14px",
                              lineHeight: "1.8",
                           }}
                        >
                           <li>
                              <strong style={{ color: "var(--accent)" }}>
                                 Goal:
                              </strong>{" "}
                              Match pairs of cards by remembering their
                              positions
                           </li>
                           <li>
                              <strong style={{ color: "var(--accent)" }}>
                                 Click cards:
                              </strong>{" "}
                              Click on a card to flip it and reveal its content
                           </li>
                           <li>
                              <strong style={{ color: "var(--accent)" }}>
                                 Match pairs:
                              </strong>{" "}
                              Click on two cards with the same value to match
                              them
                           </li>
                           <li>
                              <strong style={{ color: "var(--accent)" }}>
                                 Remember:
                              </strong>{" "}
                              Try to remember where each card is located
                           </li>
                           <li>
                              <strong style={{ color: "var(--accent)" }}>
                                 Rounds:
                              </strong>{" "}
                              Round 1 = 2x2 (numbers), Rounds 2-5 = larger grids
                              (heroicons)
                           </li>
                           <li>
                              <strong style={{ color: "var(--accent)" }}>
                                 Hints:
                              </strong>{" "}
                              Use hint button to reveal a matching pair (10
                              hints max, unlimited if shared)
                           </li>
                        </ul>
                     </div>

                     <div
                        style={{
                           display: "flex",
                           flexDirection: "column",
                           alignItems: "center",
                           gap: "16px",
                           marginBottom: "24px",
                        }}
                     >
                        <div
                           style={{
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "var(--accent)",
                              marginBottom: "8px",
                           }}
                        >
                           Example: 2x2 Grid (Round 1)
                        </div>
                        <div
                           style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, 1fr)",
                              gap: "8px",
                              width: "200px",
                              padding: "16px",
                              background: "var(--card)",
                              border: "1px solid var(--stroke)",
                              borderRadius: "12px",
                           }}
                        >
                           {[
                              { id: 0, value: 1, flipped: true },
                              { id: 1, value: 2, flipped: false },
                              { id: 2, value: 2, flipped: true },
                              { id: 3, value: 1, flipped: false },
                           ].map((card) => (
                              <div
                                 key={card.id}
                                 style={{
                                    width: "100%",
                                    aspectRatio: "1",
                                    borderRadius: "8px",
                                    border: "2px solid var(--stroke)",
                                    background: card.flipped
                                       ? "rgba(125, 211, 252, 0.2)"
                                       : "rgba(15, 27, 51, 0.6)",
                                    color: "var(--text)",
                                    fontSize: "1.5rem",
                                    fontWeight: 700,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    boxShadow: card.flipped
                                       ? "0 0 10px rgba(125, 211, 252, 0.3)"
                                       : "0 2px 4px rgba(0, 0, 0, 0.2)",
                                 }}
                              >
                                 {card.flipped ? card.value : "?"}
                              </div>
                           ))}
                        </div>
                        <div
                           style={{
                              fontSize: "13px",
                              color: "var(--muted)",
                              textAlign: "center",
                              fontStyle: "italic",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                           }}
                        >
                           Cards 0 and 3 both show "1" - they match!{" "}
                           <CheckCircleIcon
                              style={{
                                 width: 16,
                                 height: 16,
                                 color: "var(--ok)",
                              }}
                           />
                        </div>
                     </div>

                     <div
                        style={{
                           display: "grid",
                           gridTemplateColumns: "repeat(2, 1fr)",
                           gap: "16px",
                           marginBottom: "24px",
                        }}
                     >
                        <div
                           style={{
                              background: "var(--card)",
                              border: "1px solid var(--stroke)",
                              borderRadius: "12px",
                              padding: "16px",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: "14px",
                                 fontWeight: 600,
                                 color: "var(--accent)",
                                 marginBottom: "8px",
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                              }}
                           >
                              <LightBulbIcon
                                 style={{ width: 16, height: 16 }}
                              />
                              Tips
                           </div>
                           <ul
                              style={{
                                 margin: 0,
                                 paddingLeft: "20px",
                                 color: "var(--muted)",
                                 fontSize: "13px",
                                 lineHeight: "1.6",
                              }}
                           >
                              <li>Start with corners and edges</li>
                              <li>Remember positions you've seen</li>
                              <li>Work systematically</li>
                              <li>Use hints when stuck</li>
                           </ul>
                        </div>
                        <div
                           style={{
                              background: "var(--card)",
                              border: "1px solid var(--stroke)",
                              borderRadius: "12px",
                              padding: "16px",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: "14px",
                                 fontWeight: 600,
                                 color: "var(--accent)",
                                 marginBottom: "8px",
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                              }}
                           >
                              <TrophyIcon style={{ width: 18, height: 18 }} />
                              Scoring
                           </div>
                           <ul
                              style={{
                                 margin: 0,
                                 paddingLeft: "20px",
                                 color: "var(--muted)",
                                 fontSize: "13px",
                                 lineHeight: "1.6",
                              }}
                           >
                              <li>20 points per round</li>
                              <li>5 rounds total</li>
                              <li>Max score: 100</li>
                              <li>Passing: 80 points</li>
                           </ul>
                        </div>
                     </div>

                     <div
                        style={{
                           background: "rgba(54, 211, 153, 0.1)",
                           border: "1px solid rgba(54, 211, 153, 0.3)",
                           borderRadius: "12px",
                           padding: "16px",
                           display: "flex",
                           alignItems: "center",
                           gap: "12px",
                        }}
                     >
                        <CheckCircleIcon
                           style={{ width: 20, height: 20, color: "var(--ok)" }}
                        />
                        <div
                           style={{
                              fontSize: "14px",
                              color: "var(--text)",
                           }}
                        >
                           <strong>Complete all rounds:</strong> Match all pairs
                           in each round. Grid size increases each round, making
                           it more challenging!
                        </div>
                     </div>
                  </div>
               )}

               {/* Interactive Example for Logic Gates */}
               {gameType === "logic-gates" && (
                  <div className="solution-preview">
                     <h4
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "8px",
                           marginBottom: "12px",
                        }}
                     >
                        <InformationCircleIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                        Logic Gates Explained
                     </h4>

                     <div
                        style={{
                           display: "grid",
                           gridTemplateColumns: "repeat(3, 1fr)",
                           gap: "20px",
                           marginBottom: "20px",
                        }}
                     >
                        {/* AND Gate */}
                        <div
                           style={{
                              background: "var(--card)",
                              border: "2px solid var(--stroke)",
                              borderRadius: "16px",
                              padding: "24px",
                              textAlign: "center",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: "16px",
                                 fontWeight: 700,
                                 color: "var(--accent)",
                                 marginBottom: "16px",
                              }}
                           >
                              AND Gate
                           </div>
                           <div
                              style={{
                                 display: "flex",
                                 flexDirection: "column",
                                 gap: "12px",
                                 fontSize: "14px",
                                 color: "var(--muted)",
                              }}
                           >
                              <div
                                 style={{
                                    fontWeight: 600,
                                    color: "var(--text)",
                                 }}
                              >
                                 Truth Table:
                              </div>
                              <table
                                 style={{ width: "100%", fontSize: "12px" }}
                              >
                                 <thead>
                                    <tr>
                                       <th style={{ padding: "4px" }}>A</th>
                                       <th style={{ padding: "4px" }}>B</th>
                                       <th style={{ padding: "4px" }}>
                                          Output
                                       </th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    <tr>
                                       <td>0</td>
                                       <td>0</td>
                                       <td>0</td>
                                    </tr>
                                    <tr>
                                       <td>0</td>
                                       <td>1</td>
                                       <td>0</td>
                                    </tr>
                                    <tr>
                                       <td>1</td>
                                       <td>0</td>
                                       <td>0</td>
                                    </tr>
                                    <tr>
                                       <td
                                          style={{
                                             color: "var(--ok)",
                                             fontWeight: 700,
                                          }}
                                       >
                                          1
                                       </td>
                                       <td
                                          style={{
                                             color: "var(--ok)",
                                             fontWeight: 700,
                                          }}
                                       >
                                          1
                                       </td>
                                       <td
                                          style={{
                                             color: "var(--ok)",
                                             fontWeight: 700,
                                          }}
                                       >
                                          1
                                       </td>
                                    </tr>
                                 </tbody>
                              </table>
                              <div
                                 style={{
                                    fontSize: "12px",
                                    marginTop: "8px",
                                    fontStyle: "italic",
                                 }}
                              >
                                 Output is 1 only when both inputs are 1
                              </div>
                           </div>
                        </div>

                        {/* OR Gate */}
                        <div
                           style={{
                              background: "var(--card)",
                              border: "2px solid var(--stroke)",
                              borderRadius: "16px",
                              padding: "24px",
                              textAlign: "center",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: "16px",
                                 fontWeight: 700,
                                 color: "var(--accent)",
                                 marginBottom: "16px",
                              }}
                           >
                              OR Gate
                           </div>
                           <div
                              style={{
                                 display: "flex",
                                 flexDirection: "column",
                                 gap: "12px",
                                 fontSize: "14px",
                                 color: "var(--muted)",
                              }}
                           >
                              <div
                                 style={{
                                    fontWeight: 600,
                                    color: "var(--text)",
                                 }}
                              >
                                 Truth Table:
                              </div>
                              <table
                                 style={{ width: "100%", fontSize: "12px" }}
                              >
                                 <thead>
                                    <tr>
                                       <th style={{ padding: "4px" }}>A</th>
                                       <th style={{ padding: "4px" }}>B</th>
                                       <th style={{ padding: "4px" }}>
                                          Output
                                       </th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    <tr>
                                       <td>0</td>
                                       <td>0</td>
                                       <td>0</td>
                                    </tr>
                                    <tr>
                                       <td
                                          style={{
                                             color: "var(--ok)",
                                             fontWeight: 700,
                                          }}
                                       >
                                          0
                                       </td>
                                       <td
                                          style={{
                                             color: "var(--ok)",
                                             fontWeight: 700,
                                          }}
                                       >
                                          1
                                       </td>
                                       <td
                                          style={{
                                             color: "var(--ok)",
                                             fontWeight: 700,
                                          }}
                                       >
                                          1
                                       </td>
                                    </tr>
                                    <tr>
                                       <td
                                          style={{
                                             color: "var(--ok)",
                                             fontWeight: 700,
                                          }}
                                       >
                                          1
                                       </td>
                                       <td>0</td>
                                       <td
                                          style={{
                                             color: "var(--ok)",
                                             fontWeight: 700,
                                          }}
                                       >
                                          1
                                       </td>
                                    </tr>
                                    <tr>
                                       <td
                                          style={{
                                             color: "var(--ok)",
                                             fontWeight: 700,
                                          }}
                                       >
                                          1
                                       </td>
                                       <td
                                          style={{
                                             color: "var(--ok)",
                                             fontWeight: 700,
                                          }}
                                       >
                                          1
                                       </td>
                                       <td
                                          style={{
                                             color: "var(--ok)",
                                             fontWeight: 700,
                                          }}
                                       >
                                          1
                                       </td>
                                    </tr>
                                 </tbody>
                              </table>
                              <div
                                 style={{
                                    fontSize: "12px",
                                    marginTop: "8px",
                                    fontStyle: "italic",
                                 }}
                              >
                                 Output is 1 if at least one input is 1
                              </div>
                           </div>
                        </div>

                        {/* NOT Gate */}
                        <div
                           style={{
                              background: "var(--card)",
                              border: "2px solid var(--stroke)",
                              borderRadius: "16px",
                              padding: "24px",
                              textAlign: "center",
                           }}
                        >
                           <div
                              style={{
                                 fontSize: "16px",
                                 fontWeight: 700,
                                 color: "var(--accent)",
                                 marginBottom: "16px",
                              }}
                           >
                              NOT Gate
                           </div>
                           <div
                              style={{
                                 display: "flex",
                                 flexDirection: "column",
                                 gap: "12px",
                                 fontSize: "14px",
                                 color: "var(--muted)",
                              }}
                           >
                              <div
                                 style={{
                                    fontWeight: 600,
                                    color: "var(--text)",
                                 }}
                              >
                                 Truth Table:
                              </div>
                              <table
                                 style={{ width: "100%", fontSize: "12px" }}
                              >
                                 <thead>
                                    <tr>
                                       <th style={{ padding: "4px" }}>A</th>
                                       <th style={{ padding: "4px" }}>
                                          Output
                                       </th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    <tr>
                                       <td>0</td>
                                       <td
                                          style={{
                                             color: "var(--ok)",
                                             fontWeight: 700,
                                          }}
                                       >
                                          1
                                       </td>
                                    </tr>
                                    <tr>
                                       <td>1</td>
                                       <td>0</td>
                                    </tr>
                                 </tbody>
                              </table>
                              <div
                                 style={{
                                    fontSize: "12px",
                                    marginTop: "8px",
                                    fontStyle: "italic",
                                 }}
                              >
                                 Output is the opposite of input
                              </div>
                           </div>
                        </div>
                     </div>

                     <div
                        style={{
                           background: "rgba(11, 22, 48, 0.4)",
                           border: "1px solid var(--stroke)",
                           borderRadius: "12px",
                           padding: "20px",
                           marginTop: "24px",
                        }}
                     >
                        <div
                           style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              marginBottom: "12px",
                           }}
                        >
                           <LightBulbIcon
                              style={{
                                 width: 20,
                                 height: 20,
                                 color: "var(--accent)",
                              }}
                           />
                           <h4
                              style={{
                                 fontSize: "16px",
                                 fontWeight: 600,
                                 margin: 0,
                                 color: "var(--text)",
                              }}
                           >
                              How to Play
                           </h4>
                        </div>
                        <ul
                           style={{
                              margin: 0,
                              paddingLeft: "24px",
                              color: "var(--muted)",
                              fontSize: "14px",
                              lineHeight: "1.8",
                           }}
                        >
                           <li>
                              Look at the inputs (A and B) - they are either 0
                              or 1
                           </li>
                           <li>Check the gate type (AND, OR, or NOT)</li>
                           <li>
                              Calculate the output based on the gate's logic
                           </li>
                           <li>Select the correct output (0 or 1)</li>
                           <li
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 gap: "6px",
                              }}
                           >
                              When output is 1, the lamp lights up!{" "}
                              <LightBulbIcon
                                 style={{
                                    width: 16,
                                    height: 16,
                                    color: "var(--warn)",
                                 }}
                              />
                           </li>
                           <li>
                              Use number keys{" "}
                              <strong style={{ color: "var(--accent)" }}>
                                 0
                              </strong>{" "}
                              or{" "}
                              <strong style={{ color: "var(--accent)" }}>
                                 1
                              </strong>{" "}
                              for quick selection
                           </li>
                        </ul>
                     </div>
                  </div>
               )}

               {/* Interactive Example for Pattern Completion */}
               {gameType === "pattern-completion" && (
                  <div className="solution-preview">
                     <h4
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "8px",
                           marginBottom: "12px",
                        }}
                     >
                        <InformationCircleIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                        How It Works
                     </h4>

                     {/* Example: Pattern Completion */}
                     <div style={{ marginBottom: "20px" }}>
                        <p
                           style={{
                              fontSize: "0.9rem",
                              color: "var(--muted)",
                              marginBottom: "12px",
                              fontWeight: 600,
                           }}
                        >
                           Look at the pattern and find the missing shape
                        </p>

                        {/* Example Pattern */}
                        <div
                           style={{
                              display: "flex",
                              gap: "12px",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "16px",
                              background: "rgba(255, 255, 255, 0.02)",
                              borderRadius: "12px",
                              border: "2px solid var(--stroke)",
                              marginBottom: "16px",
                              flexWrap: "nowrap",
                              overflowX: "auto",
                           }}
                        >
                           {/* Pattern: Home, Star, Home, ?, Star */}
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 minWidth: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                              }}
                           >
                              <HomeIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--accent)",
                                 }}
                              />
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 minWidth: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                              }}
                           >
                              <StarIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--accent)",
                                 }}
                              />
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 minWidth: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                              }}
                           >
                              <HomeIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--accent)",
                                 }}
                              />
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 minWidth: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background:
                                    "linear-gradient(135deg, rgba(125, 211, 252, 0.2) 0%, rgba(125, 211, 252, 0.1) 100%)",
                                 border: "2px dashed var(--accent)",
                                 borderRadius: "12px",
                                 position: "relative",
                              }}
                           >
                              <span
                                 style={{
                                    fontSize: "1.5rem",
                                    fontWeight: 700,
                                    color: "var(--accent)",
                                 }}
                              >
                                 ?
                              </span>
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 minWidth: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                              }}
                           >
                              <StarIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--accent)",
                                 }}
                              />
                           </div>
                        </div>

                        {/* Options */}
                        <p
                           style={{
                              fontSize: "0.85rem",
                              color: "var(--muted)",
                              marginBottom: "8px",
                              fontWeight: 600,
                           }}
                        >
                           Choose the correct shape:
                        </p>
                        <div
                           style={{
                              display: "flex",
                              gap: "12px",
                              alignItems: "center",
                              justifyContent: "center",
                              marginBottom: "12px",
                           }}
                        >
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background:
                                    "linear-gradient(135deg, rgba(134, 239, 172, 0.2) 0%, rgba(134, 239, 172, 0.1) 100%)",
                                 border: "2px solid #86efac",
                                 borderRadius: "12px",
                                 position: "relative",
                              }}
                           >
                              <HomeIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "#86efac",
                                 }}
                              />
                              <CheckCircleIcon
                                 style={{
                                    position: "absolute",
                                    top: "-4px",
                                    right: "-4px",
                                    width: 20,
                                    height: 20,
                                    color: "#86efac",
                                    background: "var(--bg)",
                                    borderRadius: "50%",
                                 }}
                              />
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                                 opacity: 0.5,
                              }}
                           >
                              <StarIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--muted)",
                                 }}
                              />
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                                 opacity: 0.5,
                              }}
                           >
                              <HeartIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--muted)",
                                 }}
                              />
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                                 opacity: 0.5,
                              }}
                           >
                              <CircleStackIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--muted)",
                                 }}
                              />
                           </div>
                        </div>

                        {/* Explanation */}
                        <div
                           style={{
                              marginTop: "16px",
                              padding: "12px",
                              background: "rgba(134, 239, 172, 0.1)",
                              borderRadius: "12px",
                              border: "2px solid rgba(134, 239, 172, 0.3)",
                           }}
                        >
                           <p
                              style={{
                                 fontSize: "0.85rem",
                                 color: "#86efac",
                                 margin: 0,
                                 fontWeight: 600,
                              }}
                           >
                              Pattern: Home → Star → Home → ? → Star
                           </p>
                           <p
                              style={{
                                 fontSize: "0.8rem",
                                 color: "var(--muted)",
                                 margin: "4px 0 0 0",
                              }}
                           >
                              The pattern repeats: Home, Star, Home, Star... So
                              the missing shape is{" "}
                              <strong style={{ color: "#86efac" }}>Home</strong>{" "}
                              ✓
                           </p>
                        </div>
                     </div>
                  </div>
               )}

               {/* Interactive Example for Circuit Path */}
               {(gameType === "light-switch" ||
                  gameType === "circuit-path") && (
                  <div className="solution-preview">
                     <h4
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "8px",
                           marginBottom: "12px",
                        }}
                     >
                        <InformationCircleIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                        How It Works
                     </h4>

                     {/* Example: Circuit Path */}
                     <div style={{ marginBottom: "20px" }}>
                        <p
                           style={{
                              fontSize: "0.9rem",
                              color: "var(--muted)",
                              marginBottom: "8px",
                              fontWeight: 600,
                           }}
                        >
                           Click nodes to create a path from Start (green) to
                           End (red)
                        </p>
                        <div
                           className="light-grid-preview"
                           style={{
                              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                              display: "grid",
                              gap: "8px",
                              padding: "12px",
                              background: "rgba(255, 255, 255, 0.02)",
                              borderRadius: "12px",
                              border: "2px solid var(--stroke)",
                              maxWidth: "300px",
                              margin: "0 auto",
                           }}
                        >
                           {Array(gridSize * gridSize)
                              .fill(null)
                              .map((_, i) => {
                                 const row = Math.floor(i / gridSize);
                                 const col = i % gridSize;
                                 const isStart = row === 0 && col === 0;
                                 const isEnd =
                                    row === gridSize - 1 &&
                                    col === gridSize - 1;
                                 const inPath =
                                    (row === 0 && col === 1) ||
                                    (row === 1 && col === 1) ||
                                    (row === 1 && col === 2) ||
                                    (row === 2 && col === 2);

                                 return (
                                    <div
                                       key={i}
                                       className={`light-cell-preview ${
                                          isStart ? "start" : ""
                                       } ${isEnd ? "end" : ""} ${
                                          inPath ? "in-path" : ""
                                       }`}
                                       style={{
                                          aspectRatio: "1",
                                          minWidth: "60px",
                                          minHeight: "60px",
                                          display: "flex",
                                          flexDirection: "column",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          border: `2px solid ${
                                             isStart
                                                ? "rgba(34, 197, 94, 0.6)"
                                                : isEnd
                                                ? "rgba(239, 68, 68, 0.6)"
                                                : inPath
                                                ? "var(--accent)"
                                                : "var(--stroke)"
                                          }`,
                                          borderRadius: "12px",
                                          background: isStart
                                             ? "linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.15) 100%)"
                                             : isEnd
                                             ? "linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.15) 100%)"
                                             : inPath
                                             ? "linear-gradient(135deg, rgba(125, 211, 252, 0.3) 0%, rgba(125, 211, 252, 0.15) 100%)"
                                             : "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)",
                                       }}
                                    >
                                       {isStart ? (
                                          <span
                                             style={{
                                                fontSize: "0.6rem",
                                                color: "#22c55e",
                                                fontWeight: 600,
                                             }}
                                          >
                                             Start
                                          </span>
                                       ) : isEnd ? (
                                          <>
                                             <TrophyIcon
                                                style={{
                                                   width: 24,
                                                   height: 24,
                                                   color: "#ef4444",
                                                }}
                                             />
                                             <span
                                                style={{
                                                   fontSize: "0.6rem",
                                                   color: "#ef4444",
                                                   marginTop: "2px",
                                                   fontWeight: 600,
                                                }}
                                             >
                                                End
                                             </span>
                                          </>
                                       ) : inPath ? (
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
                                    </div>
                                 );
                              })}
                        </div>
                     </div>

                     {/* Goal */}
                     <div
                        style={{
                           marginTop: "20px",
                           padding: "12px",
                           background: "rgba(134, 239, 172, 0.1)",
                           borderRadius: "12px",
                           border: "2px solid rgba(134, 239, 172, 0.3)",
                        }}
                     >
                        <p
                           style={{
                              fontSize: "0.9rem",
                              color: "var(--ok)",
                              textAlign: "center",
                              fontWeight: 600,
                              margin: 0,
                           }}
                        >
                           Goal: Create a continuous path from Start (green) to
                           End (red) by clicking adjacent nodes!
                        </p>
                     </div>
                  </div>
               )}

               {instructions.tips && (
                  <div className="game-tips">
                     <h4
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "8px",
                        }}
                     >
                        <LightBulbIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--secondary)",
                           }}
                        />
                        Tips
                     </h4>
                     <p className="tips-text">{instructions.tips}</p>

                     {/* Mouse Controls - General Component */}
                     {instructions.mouseControls && (
                        <MouseControls controls={instructions.mouseControls} />
                     )}

                     {/* Keyboard Controls - General Component */}
                     {instructions.keyboardControls && (
                        <KeyboardControls
                           controls={instructions.keyboardControls}
                        />
                     )}
                  </div>
               )}
            </div>

            <div className="game-info">
               <div className="info-item">
                  <span
                     className="info-label"
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                     }}
                  >
                     <ClockIcon style={{ width: 18, height: 18 }} />
                     Time Limit:
                  </span>
                  <span className="info-value">{game.time_limit} seconds</span>
               </div>
               <div className="info-item">
                  <span
                     className="info-label"
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                     }}
                  >
                     <TrophyIcon style={{ width: 18, height: 18 }} />
                     Passing Score:
                  </span>
                  <span className="info-value">{game.passing_score}</span>
               </div>
            </div>

            <div className="game-start-actions">
               <button
                  onClick={startGame}
                  className="start-button"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
               >
                  <PlayIcon style={{ width: 20, height: 20 }} />
                  Start Game
               </button>
               <button
                  onClick={onExit}
                  className="exit-button"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
               >
                  <ArrowLeftIcon style={{ width: 18, height: 18 }} />
                  Exit
               </button>
            </div>
         </div>
      );
   }

   return (
      <div className="game-engine">
         <div className="game-header">
            <div className="game-title">{game.title}</div>
            <div className="game-stats">
               <div className="stat">
                  <span>Score:</span>
                  <strong>{score}</strong>
               </div>
               <div className="stat">
                  <span>Time:</span>
                  <strong>{timeLeft}s</strong>
               </div>
               <div className="stat">
                  <span>Target:</span>
                  <strong>{game.passing_score}</strong>
               </div>
            </div>
            <button onClick={onExit} className="exit-button-small">
               <XMarkIcon style={{ width: 20, height: 20 }} />
            </button>
         </div>

         <div className="game-content">{renderGame()}</div>

         {isCompleted && (
            <div className="game-complete-overlay">
               <div className="completion-message">
                  <h2>Game Complete!</h2>
                  <p>Final Score: {score}</p>
                  <div
                     className={
                        score >= game.passing_score ? "success" : "failure"
                     }
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                     }}
                  >
                     {score >= game.passing_score ? (
                        <>
                           <CheckCircleIcon style={{ width: 20, height: 20 }} />
                           <span>Passed!</span>
                        </>
                     ) : (
                        <>
                           <XCircleIcon style={{ width: 20, height: 20 }} />
                           <span>Try Again</span>
                        </>
                     )}
                  </div>
                  <button
                     onClick={onExit}
                     className="continue-button"
                     style={{
                        marginTop: "20px",
                        padding: "12px 24px",
                        fontSize: "16px",
                        fontWeight: "600",
                        cursor: "pointer",
                     }}
                  >
                     Continue
                  </button>
               </div>
            </div>
         )}
      </div>
   );
}
