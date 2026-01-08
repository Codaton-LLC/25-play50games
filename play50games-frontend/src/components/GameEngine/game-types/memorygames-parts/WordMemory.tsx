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

function WordMemory({
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
   const maxRounds = config.rounds || 10;
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
   const [flashingWordIndex, setFlashingWordIndex] = useState<number | null>(
      null
   );
   const [flashedWords, setFlashedWords] = useState<Set<number>>(new Set());
   const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(
      null
   );
   const sequenceRef = useRef<number[]>([]);
   const currentScoreRef = useRef<number>(0);
   const startedRoundRef = useRef<number | null>(null);
   const flashTimeoutsRef = useRef<number[]>([]);
   const inputTimeoutRef = useRef<number | null>(null);
   const isRoundCompletingRef = useRef<boolean>(false);

   // Hint functionality
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [hintRevealed, setHintRevealed] = useState<number[]>([]);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max hints: 10 for Word Memory, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Get grid size based on round (from backend config)
   const getGridSizeForRound = useCallback((round: number): number => {
      // Default: rounds 1-4: 3x3, 5-8: 5x5, 9-10: 6x6
      if (round >= 1 && round <= 4) {
         return 3;
      } else if (round >= 5 && round <= 8) {
         return 5;
      } else {
         return 6;
      }
   }, []);

   // Get grid size from config or calculate from round
   const gridSize = useMemo(() => {
      if (
         config.gridSizes &&
         Array.isArray(config.gridSizes) &&
         config.gridSizes.length > 0
      ) {
         const roundIndex = Math.min(currentRound, config.gridSizes.length - 1);
         const size = config.gridSizes[roundIndex];
         if (typeof size === "number") {
            return size;
         }
         if (Array.isArray(size)) {
            return size[0]; // Use first dimension for square grids
         }
      }
      return getGridSizeForRound(currentRound + 1);
   }, [config.gridSizes, currentRound, getGridSizeForRound]);

   // Word pool - enough for 6x6 grid (36 total)
   const WORDS = useMemo(
      () => [
         "Apple",
         "Beach",
         "Cloud",
         "Dance",
         "Earth",
         "Flame",
         "Green",
         "Happy",
         "Image",
         "Jewel",
         "Knife",
         "Light",
         "Magic",
         "Night",
         "Ocean",
         "Peace",
         "Queen",
         "River",
         "Smile",
         "Tiger",
         "Unity",
         "Voice",
         "Water",
         "Xenon",
         "Youth",
         "Zenith",
         "Arrow",
         "Brave",
         "Crown",
         "Dream",
         "Eagle",
         "Frost",
         "Glory",
         "Honey",
         "Ideal",
         "Jolly",
      ],
      []
   );

   // Get words for current grid size
   const currentWords = useMemo(() => {
      const totalCells = gridSize * gridSize;
      // Shuffle and take first totalCells words
      const shuffled = [...WORDS].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, totalCells);
   }, [gridSize, WORDS]);

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
         await registerShare(shareId, "word-memory");
         const gameKey = "play50games_shared_word-memory";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {}
   };

   // Share functionality
   const handleShare = async () => {
      if (navigator.share) {
         try {
            const shareLink = getShareableLink();
            await navigator.share({
               title: "Word Memory - Play50Games",
               text: "Check out this memory game!",
               url: shareLink,
            });
            await registerShareLink(shareLink.split("shared=")[1]);
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000);
         } catch (error) {
            // User cancelled or error
         }
      } else {
         // Fallback to clipboard
         const shareLink = getShareableLink();
         await navigator.clipboard.writeText(shareLink);
         await registerShareLink(shareLink.split("shared=")[1]);
         setShareSuccess(true);
         setTimeout(() => setShareSuccess(false), 15000);
      }
   };

   // Check share status for unlimited hints
   useEffect(() => {
      if (currentShareId) {
         shareCheckIntervalRef.current = setInterval(async () => {
            // Check if currentShareId still exists before making the API call
            if (!currentShareId) {
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
               }
               return;
            }

            // Check expiry from localStorage before making API call
            const gameKey = "play50games_shared_word-memory";
            const stored = localStorage.getItem(gameKey);
            if (stored) {
               try {
                  const data = JSON.parse(stored);
                  // Check if share has expired (15 minutes)
                  if (data.expiry && Date.now() > data.expiry) {
                     // Share expired - clean up
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
                  // Invalid data, clean up
                  localStorage.removeItem(gameKey);
               }
            }

            try {
               const status = await getShareStatus(currentShareId);
               if (status && status.clicks > 0 && !unlimitedActivated) {
                  setUnlimitedActivated(true);
                  setHasShared(true);
                  // Store expiry time (15 minutes from now)
                  const gameKey = "play50games_shared_word-memory";
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
                  setTimeout(() => {
                     setUnlimitedActivated(false);
                     setHasShared(false);
                     localStorage.removeItem(gameKey);
                  }, 15 * 60 * 1000);
               }
            } catch (error) {
               // Handle 404 as expired share
               const errorMessage =
                  error instanceof Error ? error.message : String(error);
               if (
                  errorMessage.includes("404") ||
                  errorMessage.includes("not found") ||
                  errorMessage.includes("expired")
               ) {
                  // Share expired or not found - clean up
                  const gameKey = "play50games_shared_word-memory";
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
      const gameKey = "play50games_shared_word-memory";
      const stored = localStorage.getItem(gameKey);
      if (stored) {
         try {
            const data = JSON.parse(stored);
            // Check if share has expired
            if (data.expiry && Date.now() > data.expiry) {
               // Share expired - clean up
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
            // Invalid data, clean up
            localStorage.removeItem(gameKey);
         }
      }
   }, []);

   // Start new round
   const clearSequenceTimers = useCallback(() => {
      flashTimeoutsRef.current.forEach((timeoutId) =>
         window.clearTimeout(timeoutId)
      );
      flashTimeoutsRef.current = [];
      if (inputTimeoutRef.current !== null) {
         window.clearTimeout(inputTimeoutRef.current);
         inputTimeoutRef.current = null;
      }
   }, []);

   const flashSequence = useCallback(
      (sequenceToFlash: number[]) => {
         clearSequenceTimers();
         setGameState("memorizing");
         setFeedback(null);
         setUserInput([]);
         setHintRevealed([]);
         setFlashingWordIndex(null);
         setSelectedCellIndex(null);
         setFlashedWords(new Set());

         sequenceToFlash.forEach((wordIndex, i) => {
            const startTimeoutId = window.setTimeout(() => {
               setFlashedWords((prev) => new Set([...prev, wordIndex]));
               setFlashingWordIndex(wordIndex);
               const endTimeoutId = window.setTimeout(() => {
                  setFlashingWordIndex(null);
               }, 600);
               flashTimeoutsRef.current.push(endTimeoutId);
            }, 800 + i * 600);
            flashTimeoutsRef.current.push(startTimeoutId);
         });

         inputTimeoutRef.current = window.setTimeout(() => {
            setGameState("input");
         }, 800 + sequenceToFlash.length * 600 + 300);
      },
      [clearSequenceTimers]
   );

   const startNewRound = useCallback(() => {
      if (startedRoundRef.current === currentRound) {
         return;
      }
      startedRoundRef.current = currentRound;
      // Clear any pending timers first to prevent old sequences from playing
      clearSequenceTimers();

      // Reset the completing flag when starting a new round
      isRoundCompletingRef.current = false;

      // Calculate sequence length: 2 + Math.floor(round / 2) (min 2, max 7)
      const sequenceLength = Math.min(
         2 + Math.floor((currentRound + 1) / 2),
         7
      );

      // Generate random sequence of word indices
      const newSequence: number[] = [];
      const usedIndices = new Set<number>();
      while (newSequence.length < sequenceLength) {
         const randomIndex = Math.floor(Math.random() * currentWords.length);
         if (!usedIndices.has(randomIndex)) {
            newSequence.push(randomIndex);
            usedIndices.add(randomIndex);
         }
      }
      setSequence(newSequence);
      sequenceRef.current = newSequence;

      flashSequence(newSequence);
   }, [
      currentRound,
      currentWords,
      flashSequence,
      maxRounds,
      clearSequenceTimers,
   ]);

   const replaySequence = useCallback(() => {
      if (sequenceRef.current.length === 0) return;
      flashSequence(sequenceRef.current);
   }, [flashSequence]);

   useEffect(() => {
      return () => {
         clearSequenceTimers();
      };
   }, [clearSequenceTimers]);

   useEffect(() => {
      currentScoreRef.current = currentScore;
   }, [currentScore]);

   // Start round when currentRound changes (only if not completing a round)
   useEffect(() => {
      if (currentRound < maxRounds && !isRoundCompletingRef.current) {
         // Clear any pending timers first to prevent old sequences from playing
         clearSequenceTimers();
         // Add a small delay to ensure smooth transition after complete notification
         const timer = setTimeout(() => {
            startNewRound();
         }, 500);
         return () => clearTimeout(timer);
      } else if (currentRound >= maxRounds) {
         // Game completed
         clearSequenceTimers();
         setTimeout(() => {
            onComplete(currentScoreRef.current);
         }, 1000);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [currentRound, maxRounds, onComplete, clearSequenceTimers]);

   // Handle word click
   const handleWordClick = useCallback(
      (wordIndex: number) => {
         if (gameState !== "input") return;
         if (userInput.includes(wordIndex)) return; // Already selected

         const newInput = [...userInput, wordIndex];
         setUserInput(newInput);

         // Check if correct
         if (newInput.length <= sequence.length) {
            if (
               newInput[newInput.length - 1] === sequence[newInput.length - 1]
            ) {
               // Correct so far
               if (newInput.length === sequence.length) {
                  // All correct!
                  setGameState("correct");
                  setFeedback("correct");
                  const newScore = Math.round(
                     ((currentRound + 1) / maxRounds) * 100
                  );
                  setCurrentScore(newScore);
                  setTimeout(() => {
                     onScoreUpdate(newScore);
                  }, 0);

                  setTimeout(() => {
                     // Show complete notification for 2 seconds, then clear feedback
                     setFeedback(null);
                     isRoundCompletingRef.current = true; // Mark that round is completing
                     // Clear any pending sequence timers to prevent old sequence from playing
                     clearSequenceTimers();
                     setTimeout(() => {
                        // Wait another 1 second before starting next round
                        if (currentRound + 1 < maxRounds) {
                           // Reset flag just before changing round so useEffect can trigger startNewRound
                           isRoundCompletingRef.current = false;
                           setCurrentRound(currentRound + 1);
                        } else {
                           // Last round completed
                           isRoundCompletingRef.current = false;
                           setTimeout(() => {
                              onComplete(newScore);
                           }, 1000);
                        }
                     }, 1500);
                  }, 2000);
               }
            } else {
               // Wrong - allow retry without replaying sequence
               setGameState("wrong");
               setFeedback("wrong");
               setTimeout(() => {
                  // Reset for retry - don't replay sequence, just allow input again
                  setFeedback(null);
                  setUserInput([]);
                  setGameState("input");
                  setHintRevealed([]);
               }, 1500);
            }
         }
      },
      [
         gameState,
         userInput,
         sequence,
         currentRound,
         maxRounds,
         onScoreUpdate,
         onComplete,
      ]
   );

   // Handle hint button click
   const handleHint = () => {
      if (maxHints > 0 && hintsUsed >= maxHints) return;
      if (gameState !== "input") return;
      if (sequence.length === 0) return;

      // Find the next position in sequence that needs to be revealed
      // Consider both: positions already revealed by hints AND positions already clicked by user
      const lastClickedIndex = userInput.length - 1; // Last clicked position in sequence
      const lastRevealedHint =
         hintRevealed.length > 0 ? Math.max(...hintRevealed) : -1; // Last revealed hint position

      // Next position should be after both the last clicked and last revealed hint
      const nextPositionIndex = Math.max(
         lastClickedIndex + 1,
         lastRevealedHint + 1
      );

      if (nextPositionIndex < sequence.length) {
         // Check if this position hasn't been revealed yet
         if (!hintRevealed.includes(nextPositionIndex)) {
            setHintRevealed([...hintRevealed, nextPositionIndex]);
            setHintsUsed(hintsUsed + 1);
         }
      }
   };

   // Keyboard controls
   useEffect(() => {
      if (gameState !== "input") return;

      const handleKeyPress = (e: KeyboardEvent) => {
         const totalCells = gridSize * gridSize;

         // Direct selection with number keys (1-9, 0, -, =)
         if (e.key >= "1" && e.key <= "9") {
            const num = parseInt(e.key);
            if (num <= totalCells) {
               e.preventDefault();
               const wordIndex = num - 1;
               if (!userInput.includes(wordIndex)) {
                  handleWordClick(wordIndex);
               }
            }
            return;
         }

         if (e.key === "0" && totalCells >= 10) {
            e.preventDefault();
            const wordIndex = 9;
            if (!userInput.includes(wordIndex)) {
               handleWordClick(wordIndex);
            }
            return;
         }

         if (e.key === "-" && totalCells >= 11) {
            e.preventDefault();
            const wordIndex = 10;
            if (!userInput.includes(wordIndex)) {
               handleWordClick(wordIndex);
            }
            return;
         }

         if (e.key === "=" && totalCells >= 12) {
            e.preventDefault();
            const wordIndex = 11;
            if (!userInput.includes(wordIndex)) {
               handleWordClick(wordIndex);
            }
            return;
         }

         // Navigation with arrow keys or WASD
         if (selectedCellIndex === null) {
            setSelectedCellIndex(0);
            return;
         }

         const idxToRC = (idx: number) => ({
            r: Math.floor(idx / gridSize),
            c: idx % gridSize,
         });
         const rcToIdx = (r: number, c: number) => r * gridSize + c;

         const { r, c } = idxToRC(selectedCellIndex);
         let newIndex = selectedCellIndex;

         switch (e.key) {
            case "ArrowUp":
            case "w":
               e.preventDefault();
               if (r > 0) {
                  newIndex = rcToIdx(r - 1, c);
               }
               break;
            case "ArrowDown":
            case "s":
               e.preventDefault();
               if (r < gridSize - 1) {
                  newIndex = rcToIdx(r + 1, c);
               }
               break;
            case "ArrowLeft":
            case "a":
               e.preventDefault();
               if (c > 0) {
                  newIndex = rcToIdx(r, c - 1);
               }
               break;
            case "ArrowRight":
            case "d":
               e.preventDefault();
               if (c < gridSize - 1) {
                  newIndex = rcToIdx(r, c + 1);
               }
               break;
            case "Enter":
            case " ":
               e.preventDefault();
               if (!userInput.includes(selectedCellIndex)) {
                  handleWordClick(selectedCellIndex);
               }
               return;
         }

         if (
            newIndex !== selectedCellIndex &&
            newIndex >= 0 &&
            newIndex < totalCells
         ) {
            if (!userInput.includes(newIndex)) {
               setSelectedCellIndex(newIndex);
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [gameState, selectedCellIndex, gridSize, userInput, handleWordClick]);

   const completedRounds = currentRound;
   const sequenceLength = sequence.length;

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? "16px" : "20px",
            padding: isMobile ? "16px" : "24px",
            maxWidth: "1200px",
            margin: "0 auto",
         }}
      >
         {/* Header */}
         <div
            style={{
               display: "flex",
               justifyContent: "space-between",
               alignItems: "center",
               flexWrap: "wrap",
               gap: isMobile ? "12px" : "16px",
               padding: isMobile ? "12px 16px" : "16px 20px",
               background:
                  "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))",
               borderRadius: "16px",
               border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
         >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
               <ArrowPathIcon
                  style={{
                     width: isMobile ? 20 : 24,
                     height: isMobile ? 20 : 24,
                     color: "var(--accent)",
                  }}
               />
               <span style={{ fontSize: isMobile ? "0.9rem" : "1rem" }}>
                  Round {currentRound + 1} / {maxRounds}
               </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
               <TrophyIcon
                  style={{
                     width: isMobile ? 20 : 24,
                     height: isMobile ? 20 : 24,
                     color: "var(--ok)",
                  }}
               />
               <span style={{ fontSize: isMobile ? "0.9rem" : "1rem" }}>
                  Score: {currentScore} / 100
               </span>
            </div>
         </div>

         {/* Progress Bar */}
         <div
            style={{
               width: "100%",
               height: isMobile ? "6px" : "8px",
               background: "rgba(255, 255, 255, 0.1)",
               borderRadius: "999px",
               overflow: "hidden",
            }}
         >
            <div
               style={{
                  width: `${((currentRound + 1) / maxRounds) * 100}%`,
                  height: "100%",
                  background:
                     "linear-gradient(90deg, var(--accent), var(--ok))",
                  transition: "width 0.3s ease",
               }}
            />
         </div>

         {/* Game State Display */}
         <div
            style={{
               padding: isMobile ? "14px 18px" : "16px 24px",

               background: "rgba(15, 27, 51, 0.5)",
               border: "1px solid rgba(255, 255, 255, 0.1)",
               display: "flex",
               justifyContent: "space-between",
               alignItems: "center",
               flexWrap: "wrap",
               gap: "12px",
            }}
         >
            <div>
               <div
                  style={{
                     fontSize: isMobile ? "1rem" : "1.1rem",
                     fontWeight: 600,
                     marginBottom: "4px",
                  }}
               >
                  {gameState === "memorizing" && "Watch the words flash…"}
                  {gameState === "input" && "Your turn: Click words in order"}
                  {gameState === "correct" && "Correct! Great job!"}
                  {gameState === "wrong" && "Try again! You can do it!"}
               </div>
               <div
                  style={{
                     fontSize: isMobile ? "0.85rem" : "0.9rem",
                     color: "var(--muted)",
                  }}
               >
                  {gameState === "memorizing" &&
                     `Sequence length: ${sequenceLength}`}
                  {gameState === "input" &&
                     `Click ${sequenceLength} words in the order they appeared`}
               </div>
            </div>
            <div
               style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  background:
                     gameState === "correct"
                        ? "rgba(134, 239, 172, 0.2)"
                        : gameState === "wrong"
                        ? "rgba(252, 165, 165, 0.2)"
                        : "rgba(59, 130, 246, 0.2)",
                  border: `1px solid ${
                     gameState === "correct"
                        ? "var(--ok)"
                        : gameState === "wrong"
                        ? "var(--warn)"
                        : "var(--accent)"
                  }`,
                  color:
                     gameState === "correct"
                        ? "var(--ok)"
                        : gameState === "wrong"
                        ? "var(--warn)"
                        : "var(--accent)",
                  fontSize: isMobile ? "0.8rem" : "0.85rem",
                  fontWeight: 600,
               }}
            >
               {gameState === "memorizing" && "Memorizing"}
               {gameState === "input" && "Your Turn"}
               {gameState === "correct" && "Correct"}
               {gameState === "wrong" && "Wrong"}
            </div>
         </div>

         {/* Word Grid */}
         <div
            style={{
               display: "grid",
               gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
               gap: isMobile ? "10px" : "12px",
               maxWidth: isMobile ? "100%" : "700px",
               margin: "0 auto",
               width: "100%",
            }}
         >
            {currentWords.map((word, index) => {
               const isFlashing = flashingWordIndex === index;
               const isSelected = userInput.includes(index);
               // Check if this word index is revealed by any hint position
               // hintRevealed contains positions in sequence array (0, 1, 2, ...)
               // sequence[hintPos] gives the word index at that position
               const isHintRevealed = hintRevealed.some(
                  (hintPos) => sequence[hintPos] === index
               );
               const isHighlighted = selectedCellIndex === index;
               const orderInSequence = sequence.indexOf(index);
               const showOrder = isSelected && orderInSequence !== -1;
               // In memorizing phase, show all words that have been flashed so far
               const isInSequence = sequence.includes(index);
               // A word has been flashed if it's in the sequence AND in the flashedWords set
               const hasBeenFlashed =
                  gameState === "memorizing" &&
                  isInSequence &&
                  flashedWords.has(index);
               const showMemorizeOrder =
                  gameState === "memorizing" &&
                  hasBeenFlashed &&
                  orderInSequence !== -1;
               // Find which hint position revealed this word (to show order number)
               // hintRevealed contains positions in sequence (0, 1, 2, ...)
               // We need to find which position in hintRevealed corresponds to this word
               // Then use that position to get the order in sequence
               const hintRevealedPosition = hintRevealed.findIndex(
                  (hintPos) => sequence[hintPos] === index
               );
               // The order in sequence is the actual position in hintRevealed
               const hintOrder =
                  hintRevealedPosition !== -1
                     ? hintRevealed[hintRevealedPosition]
                     : -1;

               return (
                  <div
                     key={index}
                     onClick={() => handleWordClick(index)}
                     style={{
                        padding: isMobile ? "16px 12px" : "20px 16px",

                        border: `2px solid ${
                           isFlashing
                              ? "rgba(59, 130, 246, 0.8)"
                              : hasBeenFlashed && !isFlashing
                              ? "rgba(59, 130, 246, 0.6)"
                              : isSelected
                              ? "rgba(134, 239, 172, 0.6)"
                              : isHintRevealed
                              ? "rgba(147, 51, 234, 0.6)"
                              : isHighlighted
                              ? "rgba(59, 130, 246, 0.5)"
                              : "rgba(255, 255, 255, 0.1)"
                        }`,
                        background: isFlashing
                           ? "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.2))"
                           : hasBeenFlashed && !isFlashing
                           ? "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))"
                           : isSelected
                           ? "linear-gradient(135deg, rgba(134, 239, 172, 0.2), rgba(134, 239, 172, 0.1))"
                           : isHintRevealed
                           ? "linear-gradient(135deg, rgba(147, 51, 234, 0.2), rgba(147, 51, 234, 0.1))"
                           : isHighlighted
                           ? "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))"
                           : "rgba(15, 27, 51, 0.5)",
                        boxShadow: isFlashing
                           ? "0 0 20px rgba(59, 130, 246, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)"
                           : hasBeenFlashed && !isFlashing
                           ? "0 0 10px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)"
                           : isSelected
                           ? "0 4px 12px rgba(134, 239, 172, 0.3)"
                           : "none",
                        cursor: gameState === "input" ? "pointer" : "default",
                        transition: "all 0.2s ease",
                        position: "relative",
                        transform: isFlashing
                           ? "scale(1.05)"
                           : hasBeenFlashed
                           ? "scale(1.02)"
                           : "scale(1)",
                        textAlign: "center",
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                        userSelect: "none",
                     }}
                     onMouseEnter={(e) => {
                        if (gameState === "input" && !isSelected) {
                           e.currentTarget.style.background =
                              "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))";
                           e.currentTarget.style.borderColor =
                              "rgba(59, 130, 246, 0.6)";
                        }
                     }}
                     onMouseLeave={(e) => {
                        if (gameState === "input" && !isSelected) {
                           e.currentTarget.style.background =
                              "rgba(15, 27, 51, 0.5)";
                           e.currentTarget.style.borderColor =
                              "rgba(255, 255, 255, 0.1)";
                        }
                     }}
                  >
                     {word}
                     {showMemorizeOrder && (
                        <div
                           style={{
                              position: "absolute",
                              top: "4px",
                              left: "4px",
                              width: isMobile ? "22px" : "24px",
                              height: isMobile ? "22px" : "24px",
                              borderRadius: "50%",
                              background: "rgba(59, 130, 246, 0.9)",
                              border: "1px solid rgba(59, 130, 246, 1)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: isMobile ? "0.7rem" : "0.75rem",
                              fontWeight: 700,
                              color: "#ffffff",
                              boxShadow: "0 2px 8px rgba(59, 130, 246, 0.4)",
                           }}
                        >
                           {orderInSequence + 1}
                        </div>
                     )}
                     {showOrder && (
                        <div
                           style={{
                              position: "absolute",
                              top: "4px",
                              right: "4px",
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              background: "var(--ok)",
                              color: "#0b1220",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                           }}
                        >
                           {userInput.indexOf(index) + 1}
                        </div>
                     )}
                     {isHintRevealed && !isSelected && hintOrder !== -1 && (
                        <div
                           style={{
                              position: "absolute",
                              top: "4px",
                              left: "4px",
                              width: isMobile ? "22px" : "24px",
                              height: isMobile ? "22px" : "24px",
                              borderRadius: "50%",
                              background: "rgba(147, 51, 234, 0.9)",
                              border: "1px solid rgba(147, 51, 234, 1)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: isMobile ? "0.7rem" : "0.75rem",
                              fontWeight: 700,
                              color: "#ffffff",
                              boxShadow: "0 2px 8px rgba(147, 51, 234, 0.4)",
                           }}
                        >
                           {hintOrder + 1}
                        </div>
                     )}
                  </div>
               );
            })}
         </div>

         {/* Hint and Share Buttons */}
         <div
            style={{
               display: "flex",
               gap: isMobile ? "10px" : "12px",
               justifyContent: "center",
               flexWrap: "wrap",
               width: "100%",
            }}
         >
            {/* Hint Button */}
            <button
               onClick={handleHint}
               disabled={
                  (maxHints > 0 && hintsUsed >= maxHints) ||
                  gameState !== "input" ||
                  hintRevealed.length >= sequence.length
               }
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  padding: isMobile ? "10px 16px" : "10px 20px",
                  width: isMobile ? "100%" : "auto",
                  background:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "rgba(100, 100, 100, 0.2)"
                        : "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1))",
                  border: `1px solid ${
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "rgba(100, 100, 100, 0.3)"
                        : "rgba(251, 191, 36, 0.6)"
                  }`,

                  color:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "rgba(255, 255, 255, 0.4)"
                        : "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     gameState !== "input" ||
                     hintRevealed.length >= sequence.length
                        ? "not-allowed"
                        : "pointer",
                  opacity:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     gameState !== "input" ||
                     hintRevealed.length >= sequence.length
                        ? 0.5
                        : 1,
                  transition: "all 0.3s ease",
               }}
               onMouseEnter={(e) => {
                  if (
                     !(maxHints > 0 && hintsUsed >= maxHints) &&
                     gameState === "input" &&
                     hintRevealed.length < sequence.length
                  ) {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(251, 191, 36, 0.2))";
                     e.currentTarget.style.borderColor =
                        "rgba(251, 191, 36, 0.8)";
                     e.currentTarget.style.transform = "translateY(-2px)";
                     e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(251, 191, 36, 0.3)";
                  }
               }}
               onMouseLeave={(e) => {
                  if (
                     !(maxHints > 0 && hintsUsed >= maxHints) &&
                     gameState === "input" &&
                     hintRevealed.length < sequence.length
                  ) {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1))";
                     e.currentTarget.style.borderColor =
                        "rgba(251, 191, 36, 0.6)";
                     e.currentTarget.style.transform = "translateY(0)";
                     e.currentTarget.style.boxShadow = "none";
                  }
               }}
            >
               <LightBulbIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color:
                        maxHints > 0 && hintsUsed >= maxHints
                           ? "var(--muted)"
                           : "rgba(251, 191, 36, 0.9)",
                  }}
               />
               <span>
                  Hint{" "}
                  {maxHints === 0 ? "(∞)" : `(${maxHints - hintsUsed} left)`}
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
                  animation: "slideIn 0.3s ease",
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
                  animation: "slideIn 0.3s ease",
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
                     : "🎉 Someone opened your link! Unlimited hints are now active for 15 minutes!"}
               </span>
            </div>
         )}

         {/* Feedback Message */}
         {feedback !== null && (
            <div
               style={{
                  padding: isMobile ? "12px 20px" : "16px 24px",

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
                  gap: isMobile ? "8px" : "10px",
                  width: "100%",
                  maxWidth: isMobile ? "100%" : "700px",
                  justifyContent: "center",
                  margin: "0 auto",
               }}
            >
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon
                        style={{
                           width: isMobile ? 20 : 24,
                           height: isMobile ? 20 : 24,
                        }}
                     />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon
                        style={{
                           width: isMobile ? 20 : 24,
                           height: isMobile ? 20 : 24,
                        }}
                     />
                     <span>Try again! You can do it!</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
}

export default WordMemory;
