"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   ArrowPathIcon,
   TrophyIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

function ColorGridMemory({
   config,
   onScoreUpdate,
   onComplete,
   passingScore = 70,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   passingScore?: number;
}) {
   const maxRounds = config.rounds || 20;
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [sequence, setSequence] = useState<number[]>([]);
   const [userInput, setUserInput] = useState<number[]>([]);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);
   const [flashingCellIndex, setFlashingCellIndex] = useState<number | null>(
      null
   );
   const [wrongCellIndex, setWrongCellIndex] = useState<number | null>(null);
   const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(
      null
   );
   const sequenceTimersRef = useRef<NodeJS.Timeout[]>([]);

   // Hint functionality
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [hintRevealed, setHintRevealed] = useState<number[]>([]);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max hints: 10, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Check if mobile/tablet device
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

   // Calculate grid size based on round (3x3, 4x4, 5x5)
   const gridSize = useMemo(() => {
      if (currentRound < 5) return 3; // Rounds 1-5: 3x3
      if (currentRound < 12) return 4; // Rounds 6-12: 4x4
      return 5; // Rounds 13+: 5x5
   }, [currentRound]);

   // Calculate sequence length (starts at 3, increases by 1 per round)
   const sequenceLength = useMemo(() => {
      return 3 + currentRound;
   }, [currentRound]);

   // Color palette for cells
   const colors = useMemo(
      () => [
         "rgba(110, 168, 255, 0.9)", // Blue
         "rgba(54, 211, 153, 0.9)", // Green
         "rgba(251, 191, 36, 0.9)", // Yellow
         "rgba(251, 113, 133, 0.9)", // Pink
         "rgba(168, 85, 247, 0.9)", // Purple
         "rgba(236, 72, 153, 0.9)", // Rose
      ],
      []
   );

   // Generate shareable link with tracking
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   // Register share link in backend
   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "color-grid-memory");
         const gameKey = "play50games_shared_color-grid-memory";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {}
   };

   // Share functionality
   useEffect(() => {
      if (currentShareId) {
         shareCheckIntervalRef.current = setInterval(async () => {
            if (!currentShareId) {
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
               }
               return;
            }

            const gameKey = "play50games_shared_color-grid-memory";
            const stored = localStorage.getItem(gameKey);
            if (stored) {
               try {
                  const data = JSON.parse(stored);
                  if (data.expiry && Date.now() > data.expiry) {
                     localStorage.removeItem(gameKey);
                     if (shareCheckIntervalRef.current) {
                        clearInterval(shareCheckIntervalRef.current);
                     }
                     setCurrentShareId(null);
                     setHasShared(false);
                     setUnlimitedActivated(false);
                     return;
                  }
               } catch (error) {
                  localStorage.removeItem(gameKey);
               }
            }

            try {
               const status = await getShareStatus(currentShareId);
               if (status && status.clicks > 0 && !unlimitedActivated) {
                  setUnlimitedActivated(true);
                  setHasShared(true);
                  const gameKey = "play50games_shared_color-grid-memory";
                  const expiryTime = Date.now() + 15 * 60 * 1000;
                  localStorage.setItem(
                     gameKey,
                     JSON.stringify({
                        share_id: currentShareId,
                        expiry: expiryTime,
                        shared: true,
                     })
                  );
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  // Show message for 15 seconds
                  setTimeout(() => {
                     setUnlimitedActivated(false);
                  }, 15000);
                  // Expire after 15 minutes
                  setTimeout(() => {
                     setUnlimitedActivated(false);
                     setHasShared(false);
                     localStorage.removeItem(gameKey);
                  }, 15 * 60 * 1000);
               }
            } catch (error) {
               const errorMessage =
                  error instanceof Error ? error.message : String(error);
               if (
                  errorMessage.includes("404") ||
                  errorMessage.includes("not found") ||
                  errorMessage.includes("expired")
               ) {
                  const gameKey = "play50games_shared_color-grid-memory";
                  localStorage.removeItem(gameKey);
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  setCurrentShareId(null);
                  setHasShared(false);
                  setUnlimitedActivated(false);
               }
            }
         }, 10000);
      }

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, unlimitedActivated]);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_color-grid-memory";
      const stored = localStorage.getItem(gameKey);
      if (stored) {
         try {
            const data = JSON.parse(stored);
            if (data.expiry && Date.now() > data.expiry) {
               localStorage.removeItem(gameKey);
               return;
            }
            if (data.share_id) {
               setCurrentShareId(data.share_id);
               // Verify with backend before activating unlimited
               const verifyShare = async () => {
                  try {
                     const status = await getShareStatus(data.share_id);
                     if (status && status.clicks > 0) {
                        // Share exists in backend and has clicks - activate unlimited
                        if (
                           data.shared &&
                           data.expiry &&
                           Date.now() < data.expiry
                        ) {
                           // Already activated and not expired
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           setTimeout(() => {
                              setUnlimitedActivated(false);
                              setHasShared(false);
                              localStorage.removeItem(gameKey);
                           }, data.expiry - Date.now());
                        } else {
                           // Has clicks but not activated yet - activate now
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           const expiryTime = Date.now() + 15 * 60 * 1000; // 15 minutes
                           localStorage.setItem(
                              gameKey,
                              JSON.stringify({
                                 share_id: data.share_id,
                                 expiry: expiryTime,
                                 shared: true,
                              })
                           );
                           setTimeout(() => {
                              setUnlimitedActivated(false);
                              setHasShared(false);
                              localStorage.removeItem(gameKey);
                           }, 15 * 60 * 1000);
                        }
                     } else {
                        // Share doesn't exist in backend or has no clicks - clean up
                        localStorage.removeItem(gameKey);
                        setCurrentShareId(null);
                     }
                  } catch (error) {
                     // Error checking share (404 or other) - clean up
                     localStorage.removeItem(gameKey);
                     setCurrentShareId(null);
                  }
               };
               verifyShare();
            }
         } catch (error) {
            localStorage.removeItem(gameKey);
         }
      }

      // Check URL for shared parameter
      const urlParams = new URLSearchParams(window.location.search);
      const sharedId = urlParams.get("shared");
      if (sharedId) {
         trackShareClick(sharedId);
      }
   }, []);

   // Clear all sequence timers
   const clearSequenceTimers = useCallback(() => {
      sequenceTimersRef.current.forEach((timer) => clearTimeout(timer));
      sequenceTimersRef.current = [];
   }, []);

   // Generate random sequence
   const generateSequence = useCallback((): number[] => {
      const totalCells = gridSize * gridSize;
      const sequence: number[] = [];
      const used = new Set<number>();

      while (sequence.length < sequenceLength) {
         const cell = Math.floor(Math.random() * totalCells);
         if (!used.has(cell)) {
            sequence.push(cell);
            used.add(cell);
         }
      }

      return sequence;
   }, [gridSize, sequenceLength]);

   // Start new round
   const startNewRound = useCallback(() => {
      clearSequenceTimers();
      setSequence([]);
      setUserInput([]);
      setHintRevealed([]);
      setWrongCellIndex(null);
      setFlashingCellIndex(null);
      setFeedback(null);
      setGameState("memorizing");

      // Generate new sequence
      const newSequence = generateSequence();
      setSequence(newSequence);

      // Play sequence animation
      newSequence.forEach((cellIndex, stepIndex) => {
         const timer = setTimeout(() => {
            setFlashingCellIndex(cellIndex);
            setTimeout(() => {
               setFlashingCellIndex(null);
            }, 400);
         }, stepIndex * 600);

         sequenceTimersRef.current.push(timer);
      });

      // After sequence finishes, switch to input mode
      const finalTimer = setTimeout(() => {
         setGameState("input");
         setFlashingCellIndex(null);
      }, newSequence.length * 600 + 500);

      sequenceTimersRef.current.push(finalTimer);
   }, [gridSize, sequenceLength, generateSequence, clearSequenceTimers]);

   // Start first round
   useEffect(() => {
      if (currentRound < maxRounds) {
         startNewRound();
      }
   }, [currentRound, maxRounds, startNewRound]);

   // Update score
   useEffect(() => {
      const completedRounds = currentRound;
      const newScore = Math.round((completedRounds / maxRounds) * 100);
      setCurrentScore(newScore);
      if (completedRounds > 0) {
         setTimeout(() => {
            onScoreUpdate(newScore);
         }, 0);
      }
   }, [currentRound, maxRounds, onScoreUpdate]);

   // Check game completion
   useEffect(() => {
      if (currentRound >= maxRounds) {
         setTimeout(() => {
            onComplete(currentScore);
         }, 1000);
      }
   }, [currentRound, maxRounds, currentScore, onComplete]);

   // Handle cell click
   const handleCellClick = useCallback(
      (cellIndex: number) => {
         if (gameState !== "input") return;
         if (userInput.includes(cellIndex)) return; // Already clicked

         const newInput = [...userInput, cellIndex];
         setUserInput(newInput);

         // Check if this click is correct
         const expectedIndex = sequence[newInput.length - 1];
         if (cellIndex !== expectedIndex) {
            // Wrong cell clicked
            setWrongCellIndex(cellIndex);
            setGameState("wrong");
            setFeedback("wrong");

            setTimeout(() => {
               // Reset and repeat the same round
               setUserInput([]);
               setWrongCellIndex(null);
               setFeedback(null);
               setHintRevealed([]);
               startNewRound();
            }, 2000);
            return;
         }

         // Check if sequence is complete
         if (newInput.length === sequence.length) {
            // All cells clicked correctly
            setGameState("correct");
            setFeedback("correct");

            setTimeout(() => {
               setCurrentRound((prev) => prev + 1);
            }, 1500);
         }
      },
      [gameState, userInput, sequence, startNewRound]
   );

   // Handle hint
   const handleHint = useCallback(() => {
      if (gameState !== "input") return;
      if (maxHints > 0 && hintsUsed >= maxHints) return;

      // Find next unrevealed cell in sequence
      const nextPositionIndex = Math.max(
         userInput.length,
         hintRevealed.length > 0 ? Math.max(...hintRevealed) + 1 : 0
      );

      if (nextPositionIndex < sequence.length) {
         const cellIndex = sequence[nextPositionIndex];
         if (!hintRevealed.includes(nextPositionIndex)) {
            setHintRevealed((prev) => [...prev, nextPositionIndex]);
            setHintsUsed((prev) => prev + 1);
         }
      }
   }, [gameState, maxHints, hintsUsed, sequence, userInput, hintRevealed]);

   // Handle share
   const handleShare = useCallback(async () => {
      try {
         const shareLink = getShareableLink();
         const shareId = shareLink.split("shared=")[1];

         if (navigator.share) {
            await navigator.share({
               title: "Color Grid Memory",
               text: "Check out this memory game!",
               url: shareLink,
            });
            await registerShareLink(shareId);
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
         } else {
            await navigator.clipboard.writeText(shareLink);
            await registerShareLink(shareId);
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
         }
      } catch (error) {
         // User cancelled or error occurred
      }
   }, []);

   // Keyboard controls
   useEffect(() => {
      if (gameState !== "input") {
         setSelectedCellIndex(null);
         return;
      }

      const handleKeyPress = (e: KeyboardEvent) => {
         if (gameState !== "input") return;

         const totalCells = gridSize * gridSize;

         // Prevent default for game controls
         if (
            (e.key >= "1" && e.key <= "9") ||
            e.key === "0" ||
            e.key === "-" ||
            e.key === "=" ||
            e.key.startsWith("Arrow") ||
            ["w", "W", "s", "S", "a", "A", "d", "D", "Enter", " "].includes(
               e.key
            )
         ) {
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
               e.preventDefault();
            }
         }

         // Direct selection with number keys (1-9, 0, -, =)
         if (e.key >= "1" && e.key <= "9") {
            const num = parseInt(e.key);
            if (num <= totalCells && !userInput.includes(num - 1)) {
               handleCellClick(num - 1);
            }
            return;
         }

         if (e.key === "0" && totalCells >= 10 && !userInput.includes(9)) {
            handleCellClick(9);
            return;
         }

         if (e.key === "-" && totalCells >= 11 && !userInput.includes(10)) {
            handleCellClick(10);
            return;
         }

         if (e.key === "=" && totalCells >= 12 && !userInput.includes(11)) {
            handleCellClick(11);
            return;
         }

         // Initialize selectedCellIndex if null
         if (selectedCellIndex === null) {
            setSelectedCellIndex(0);
            return;
         }

         // Navigate with arrow keys or WASD
         let newIndex = selectedCellIndex;

         if (
            e.key === "ArrowUp" ||
            e.key === "ArrowLeft" ||
            e.key === "w" ||
            e.key === "W" ||
            e.key === "a" ||
            e.key === "A"
         ) {
            if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
               // Move up
               newIndex = Math.max(0, selectedCellIndex - gridSize);
            } else {
               // Move left
               newIndex = Math.max(0, selectedCellIndex - 1);
            }
            setSelectedCellIndex(newIndex);
            return;
         }

         if (
            e.key === "ArrowDown" ||
            e.key === "ArrowRight" ||
            e.key === "s" ||
            e.key === "S" ||
            e.key === "d" ||
            e.key === "D"
         ) {
            if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
               // Move down
               newIndex = Math.min(
                  totalCells - 1,
                  selectedCellIndex + gridSize
               );
            } else {
               // Move right
               newIndex = Math.min(totalCells - 1, selectedCellIndex + 1);
            }
            setSelectedCellIndex(newIndex);
            return;
         }

         // Select with Enter or Space
         if (e.key === "Enter" || e.key === " ") {
            if (
               selectedCellIndex !== null &&
               !userInput.includes(selectedCellIndex)
            ) {
               handleCellClick(selectedCellIndex);
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [gameState, selectedCellIndex, gridSize, userInput, handleCellClick]);

   // Cleanup on unmount
   useEffect(() => {
      return () => {
         clearSequenceTimers();
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [clearSequenceTimers]);

   const progress = (currentRound / maxRounds) * 100;

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? "16px" : "20px",
            width: "100%",
            maxWidth: "800px",
            margin: "0 auto",
            padding: isMobile ? "16px" : "24px",
         }}
      >
         {/* Header */}
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               gap: isMobile ? "10px" : "12px",
               padding: isMobile ? "14px 18px" : "16px 24px",
               background:
                  "linear-gradient(135deg, rgba(15, 27, 51, 0.8), rgba(15, 27, 51, 0.6))",
               borderRadius: "16px",
               border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
         >
            <div
               style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: isMobile ? "8px" : "12px",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: isMobile ? "6px" : "8px",
                     fontSize: isMobile ? "0.9rem" : "1rem",
                     fontWeight: 600,
                     color: "var(--text)",
                  }}
               >
                  <ArrowPathIcon
                     style={{
                        width: isMobile ? 18 : 20,
                        height: isMobile ? 18 : 20,
                        color: "var(--accent)",
                     }}
                  />
                  Round {currentRound + 1} / {maxRounds}
               </div>
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: isMobile ? "6px" : "8px",
                     fontSize: isMobile ? "0.9rem" : "1rem",
                     fontWeight: 600,
                     color: "var(--text)",
                  }}
               >
                  <TrophyIcon
                     style={{
                        width: isMobile ? 18 : 20,
                        height: isMobile ? 18 : 20,
                        color: "var(--accent)",
                     }}
                  />
                  Score: {currentScore} / 100
               </div>
            </div>
            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: isMobile ? "6px" : "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  overflow: "hidden",
               }}
            >
               <div
                  style={{
                     width: `${progress}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, rgba(110, 168, 255, 0.8), rgba(59, 130, 246, 0.8))",
                     borderRadius: "4px",
                     transition: "width 0.3s ease",
                  }}
               />
            </div>
         </div>

         {/* Game Board */}
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               alignItems: "center",
               gap: isMobile ? "16px" : "20px",
            }}
         >
            {/* Status Message */}
            <div
               style={{
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
               }}
            >
               <b
                  style={{
                     fontSize: isMobile ? "1rem" : "1.1rem",
                     fontWeight: 700,
                     color: "var(--text)",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     gap: "8px",
                  }}
               >
                  {gameState === "memorizing" && "Watch the sequence…"}
                  {gameState === "input" && "Now click in the same order"}
                  {gameState === "correct" && (
                     <>
                        <CheckCircleIcon
                           style={{
                              width: isMobile ? 20 : 24,
                              height: isMobile ? 20 : 24,
                              color: "var(--ok)",
                           }}
                        />
                        Correct!
                     </>
                  )}
                  {gameState === "wrong" && (
                     <>
                        <XCircleIcon
                           style={{
                              width: isMobile ? 20 : 24,
                              height: isMobile ? 20 : 24,
                              color: "var(--warn)",
                           }}
                        />
                        Wrong! Try again
                     </>
                  )}
               </b>
               <div
                  style={{
                     fontSize: isMobile ? "0.75rem" : "0.875rem",
                     color: "var(--muted)",
                  }}
               >
                  {gameState === "memorizing" &&
                     "After it disappears, click in the same order"}
                  {gameState === "input" && "Click the cells in order"}
               </div>
            </div>

            {/* Grid */}
            <div
               style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                  gap: isMobile
                     ? "8px"
                     : gridSize <= 3
                     ? "14px"
                     : gridSize <= 4
                     ? "12px"
                     : "10px",
                  width: "100%",
                  maxWidth: isMobile
                     ? "100%"
                     : gridSize <= 3
                     ? "400px"
                     : gridSize <= 4
                     ? "500px"
                     : "600px",
               }}
            >
               {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
                  const isInSequence = sequence.includes(idx);
                  const sequenceIndex = sequence.indexOf(idx);
                  const isSelected = userInput.includes(idx);
                  const inputIndex = userInput.indexOf(idx);
                  const isHinted = hintRevealed.includes(sequenceIndex);
                  const isFlashing = flashingCellIndex === idx;
                  const isWrong = wrongCellIndex === idx;

                  // Get color for this cell in sequence
                  const colorIndex =
                     sequenceIndex >= 0 ? sequenceIndex % colors.length : -1;
                  const cellColor = colorIndex >= 0 ? colors[colorIndex] : null;

                  return (
                     <button
                        key={idx}
                        onClick={() => handleCellClick(idx)}
                        disabled={gameState !== "input" || isSelected}
                        style={{
                           width: "100%",
                           aspectRatio: "1",
                           minWidth: isMobile ? "44px" : "50px",
                           minHeight: isMobile ? "44px" : "50px",
                           borderRadius: isMobile ? "12px" : "14px",
                           border: `2px solid ${
                              isFlashing
                                 ? "rgba(110, 168, 255, 1)"
                                 : isWrong
                                 ? "rgba(251, 113, 133, 0.8)"
                                 : isSelected
                                 ? "rgba(110, 168, 255, 0.6)"
                                 : isHinted
                                 ? "rgba(251, 191, 36, 0.6)"
                                 : selectedCellIndex === idx && !isSelected
                                 ? "rgba(251, 191, 36, 0.8)"
                                 : "rgba(255, 255, 255, 0.1)"
                           }`,
                           background:
                              isFlashing && cellColor
                                 ? cellColor
                                 : isWrong
                                 ? "linear-gradient(135deg, rgba(251, 113, 133, 0.3), rgba(251, 113, 133, 0.2))"
                                 : isSelected && cellColor
                                 ? cellColor
                                 : isHinted && cellColor
                                 ? cellColor
                                 : selectedCellIndex === idx && !isSelected
                                 ? "linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(251, 191, 36, 0.08))"
                                 : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                           boxShadow: isFlashing
                              ? "0 0 30px rgba(110, 168, 255, 0.6), 0 0 50px rgba(110, 168, 255, 0.4)"
                              : isSelected
                              ? "0 4px 12px rgba(110, 168, 255, 0.3)"
                              : selectedCellIndex === idx && !isSelected
                              ? "0 4px 12px rgba(251, 191, 36, 0.3)"
                              : "0 2px 8px rgba(0, 0, 0, 0.1)",
                           outline:
                              selectedCellIndex === idx && !isSelected
                                 ? "2px solid rgba(251, 191, 36, 0.5)"
                                 : "none",
                           outlineOffset:
                              selectedCellIndex === idx && !isSelected
                                 ? "2px"
                                 : "0",
                           cursor:
                              gameState === "input" && !isSelected
                                 ? "pointer"
                                 : "not-allowed",
                           transition: "all 0.2s ease",
                           transform: isFlashing ? "scale(1.1)" : "scale(1)",
                           position: "relative",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           fontSize: isMobile ? "0.75rem" : "0.875rem",
                           fontWeight: 600,
                           color: "white",
                        }}
                     >
                        {isSelected && (
                           <div
                              style={{
                                 position: "absolute",
                                 top: "4px",
                                 right: "4px",
                                 width: isMobile ? "18px" : "20px",
                                 height: isMobile ? "18px" : "20px",
                                 borderRadius: "50%",
                                 background: "rgba(0, 0, 0, 0.5)",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 fontSize: isMobile ? "0.65rem" : "0.7rem",
                                 fontWeight: 700,
                              }}
                           >
                              {inputIndex + 1}
                           </div>
                        )}
                        {isHinted && !isSelected && (
                           <div
                              style={{
                                 position: "absolute",
                                 top: "4px",
                                 right: "4px",
                                 width: isMobile ? "18px" : "20px",
                                 height: isMobile ? "18px" : "20px",
                                 borderRadius: "50%",
                                 background:
                                    "linear-gradient(135deg, rgba(251, 191, 36, 0.9), rgba(251, 191, 36, 0.7))",
                                 border: "2px solid rgba(255, 255, 255, 0.3)",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 fontSize: isMobile ? "0.65rem" : "0.7rem",
                                 fontWeight: 700,
                                 color: "white",
                              }}
                           >
                              {sequenceIndex + 1}
                           </div>
                        )}
                        {gameState === "input" && !isSelected && !isHinted && (
                           <div
                              style={{
                                 position: "absolute",
                                 top: "4px",
                                 left: "4px",
                                 width: isMobile ? "18px" : "20px",
                                 height: isMobile ? "18px" : "20px",
                                 borderRadius: "50%",
                                 background:
                                    "linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))",
                                 border: "2px solid rgba(255, 255, 255, 0.3)",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 fontSize: isMobile ? "0.65rem" : "0.7rem",
                                 fontWeight: 700,
                                 color: "white",
                                 boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                              }}
                           >
                              {idx < 9
                                 ? idx + 1
                                 : idx === 9
                                 ? "0"
                                 : idx === 10
                                 ? "-"
                                 : idx === 11
                                 ? "="
                                 : ""}
                           </div>
                        )}
                     </button>
                  );
               })}
            </div>
         </div>

         {/* Feedback Messages */}
         {feedback !== null && (
            <div
               style={{
                  padding: isMobile ? "14px 20px" : "16px 24px",
                  borderRadius: "12px",
                  fontSize: isMobile ? "1rem" : "1.1rem",
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
                  width: "100%",
                  justifyContent: "center",
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

         {/* Share Success Messages */}
         {shareSuccess && (
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  padding: isMobile ? "10px 14px" : "8px 16px",
                  background:
                     "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))",
                  border: "2px solid rgba(34, 197, 94, 0.6)",
                  borderRadius: isMobile ? "10px" : "8px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.9rem",
                  fontWeight: 500,
                  width: "100%",
                  justifyContent: "center",
                  textAlign: "center",
                  flexWrap: "wrap",
               }}
            >
               <CheckCircleIcon
                  style={{
                     width: isMobile ? 16 : 18,
                     height: isMobile ? 16 : 18,
                     color: "rgba(34, 197, 94, 0.9)",
                     flexShrink: 0,
                  }}
               />
               <span>
                  {isMobile
                     ? "Link copied! Unlimited hints unlock when someone opens it!"
                     : "Link copied! Unlimited hints will unlock when someone opens your link!"}
               </span>
            </div>
         )}
         {unlimitedActivated && (
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  padding: isMobile ? "10px 14px" : "8px 16px",
                  background:
                     "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                  border: "2px solid rgba(59, 130, 246, 0.6)",
                  borderRadius: isMobile ? "10px" : "8px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.9rem",
                  fontWeight: 500,
                  width: "100%",
                  justifyContent: "center",
                  textAlign: "center",
                  flexWrap: "wrap",
               }}
            >
               <CheckCircleIcon
                  style={{
                     width: isMobile ? 16 : 18,
                     height: isMobile ? 16 : 18,
                     color: "rgba(59, 130, 246, 0.9)",
                     flexShrink: 0,
                  }}
               />
               <span>
                  {isMobile
                     ? "🎉 Unlimited hints active for 15 minutes!"
                     : "🎉 Someone opened your link! Unlimited hints is now active for 15 minutes!"}
               </span>
            </div>
         )}

         {/* Hint and Share Buttons */}
         <div
            style={{
               display: "flex",
               gap: isMobile ? "10px" : "12px",
               width: "100%",
               justifyContent: "center",
               flexWrap: "wrap",
            }}
         >
            {/* Hint Button */}
            <button
               onClick={handleHint}
               disabled={
                  gameState !== "input" ||
                  (maxHints > 0 && hintsUsed >= maxHints) ||
                  hintRevealed.length >= sequence.length
               }
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  padding: isMobile ? "10px 16px" : "10px 20px",
                  width: isMobile ? "100%" : "auto",
                  background:
                     gameState !== "input" ||
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     hintRevealed.length >= sequence.length
                        ? "rgba(255, 255, 255, 0.05)"
                        : "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1))",
                  border: `1px solid ${
                     gameState !== "input" ||
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     hintRevealed.length >= sequence.length
                        ? "rgba(255, 255, 255, 0.1)"
                        : "rgba(251, 191, 36, 0.6)"
                  }`,
                  borderRadius: "12px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor:
                     gameState !== "input" ||
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     hintRevealed.length >= sequence.length
                        ? "not-allowed"
                        : "pointer",
                  transition: "all 0.3s ease",
                  opacity:
                     gameState !== "input" ||
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     hintRevealed.length >= sequence.length
                        ? 0.5
                        : 1,
               }}
            >
               <LightBulbIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color:
                        gameState !== "input" ||
                        (maxHints > 0 && hintsUsed >= maxHints) ||
                        hintRevealed.length >= sequence.length
                           ? "var(--muted)"
                           : "rgba(251, 191, 36, 0.9)",
                  }}
               />
               <span>
                  {hasShared
                     ? "Hint (∞)"
                     : `Hint (${Math.max(0, maxHints - hintsUsed)} left)`}
               </span>
            </button>

            {/* Share Button */}
            <button
               onClick={handleShare}
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  padding: isMobile ? "10px 16px" : "10px 20px",
                  width: isMobile ? "100%" : "auto",
                  background:
                     "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                  border: "1px solid rgba(59, 130, 246, 0.6)",
                  borderRadius: "12px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
               }}
               onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                     "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.2))";
                  e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.8)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                     "0 4px 12px rgba(59, 130, 246, 0.3)";
               }}
               onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                     "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))";
                  e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.6)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
               }}
            >
               <ShareIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color: "rgba(59, 130, 246, 0.9)",
                  }}
               />
               <span>{isMobile ? "Share" : "Share for Unlimited Hints"}</span>
            </button>
         </div>
      </div>
   );
}

export default ColorGridMemory;
