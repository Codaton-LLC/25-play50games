"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   ArrowPathIcon,
   TrophyIcon,
   PhotoIcon,
   SparklesIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

function ImageRecall({
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
   const sequenceRef = useRef<number[]>([]);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Hint functionality
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [hintRevealed, setHintRevealed] = useState<number[]>([]);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max hints: 10 for Image Recall, unlimited if shared
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
         // Use round index, but if array is shorter than rounds, use last element or fallback
         const roundIndex = Math.min(currentRound, config.gridSizes.length - 1);
         const size = config.gridSizes[roundIndex];
         if (typeof size === "number") {
            return size;
         }
         if (Array.isArray(size)) {
            return size[0]; // Use first dimension for square grids
         }
      }
      // Fallback to default grid size calculation
      return getGridSizeForRound(currentRound + 1);
   }, [config.gridSizes, currentRound, getGridSizeForRound]);

   // Image emojis - enough for 6x6 grid (36 total)
   const IMAGES = useMemo(
      () => [
         "🧩",
         "🚀",
         "🌙",
         "🍎",
         "🎵",
         "📦",
         "⭐",
         "🐶",
         "🏀",
         "🔥",
         "🎲",
         "📌",
         "🎨",
         "🎯",
         "🎪",
         "🎭",
         "🎬",
         "🎤",
         "🎧",
         "🎮",
         "🦄",
         "🐱",
         "🐼",
         "🦁",
         "🐯",
         "🐸",
         "🐰",
         "🐻",
         "🐨",
         "🐷",
         "🦊",
         "🐺",
         "🐝",
         "🦋",
         "🐢",
         "🐠",
      ],
      []
   );

   // Get images for current grid size
   const currentImages = useMemo(() => {
      const totalCells = gridSize * gridSize;
      return IMAGES.slice(0, totalCells);
   }, [gridSize, IMAGES]);

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
         await registerShare(shareId, "image-recall");
         const gameKey = "play50games_shared_image-recall";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {}
   };

   // Share functionality
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
            const gameKey = "play50games_shared_image-recall";
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
                  const gameKey = "play50games_shared_image-recall";
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
                  const gameKey = "play50games_shared_image-recall";
                  localStorage.removeItem(gameKey);
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  setCurrentShareId(null);
                  setHasShared(false);
                  setUnlimitedActivated(false);
               }
            }
         }, 10000); // Check every 10 seconds
      }

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, unlimitedActivated]);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_image-recall";
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

   // Handle copy link to clipboard
   const handleCopyLink = async (shareId: string) => {
      const currentUrl = window.location.href.split("?")[0];
      const shareableLink = `${currentUrl}?shared=${shareId}`;

      try {
         await navigator.clipboard.writeText(shareableLink);
         setShareSuccess(true);
         setTimeout(() => setShareSuccess(false), 15000);
      } catch (error) {
         const textArea = document.createElement("textarea");
         textArea.value = shareableLink;
         textArea.style.position = "fixed";
         textArea.style.opacity = "0";
         document.body.appendChild(textArea);
         textArea.select();
         try {
            document.execCommand("copy");
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000);
         } catch (err) {}
         document.body.removeChild(textArea);
      }
   };

   // Handle share via Web Share API or fallback
   const handleShare = async () => {
      const shareableLink = getShareableLink();
      const shareId = new URL(shareableLink).searchParams.get("shared") || "";

      if (!shareId) return;

      await registerShareLink(shareId);

      if (navigator.share) {
         try {
            await navigator.share({
               title: "Image Recall Game",
               text: "Check out this awesome Image Recall game!",
               url: shareableLink,
            });
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000);
         } catch (error: any) {
            if (error.name !== "AbortError") {
               handleCopyLink(shareId);
            }
         }
      } else {
         handleCopyLink(shareId);
      }
   };

   // Handle hint button click
   const handleHint = () => {
      if (maxHints > 0 && hintsUsed >= maxHints) return;
      if (gameState !== "input") return;
      if (sequence.length === 0) return;

      // Find the first position in sequence that hasn't been revealed yet
      const allPositions = sequence.map((_, idx) => idx); // [0, 1, 2, ...]
      const unrevealedPositions = allPositions.filter(
         (pos) => !hintRevealed.includes(pos)
      );

      if (unrevealedPositions.length > 0) {
         // Reveal the first unrevealed position
         const nextPosition = unrevealedPositions[0];
         setHintRevealed([...hintRevealed, nextPosition]);
         setHintsUsed(hintsUsed + 1);
      }
   };

   // Start round
   const startRound = useCallback(() => {
      // Sequence length: scales with grid size and round
      // 3x3: 2-4, 5x5: 3-6, 6x6: 4-8
      const baseLength = Math.max(2, Math.floor(gridSize / 2));
      const maxLength = Math.min(gridSize + 1, 8);
      const sequenceLength = Math.min(
         baseLength + Math.floor((currentRound + 1) / 2),
         maxLength
      );

      // Pick distinct images for sequence (no duplicates)
      const available = [...Array(currentImages.length).keys()].sort(
         () => Math.random() - 0.5
      );
      const newSequence = available.slice(0, sequenceLength);

      setSequence(newSequence);
      setUserInput([]);
      setGameState("memorizing");
      setFeedback(null);
      setHintRevealed([]);
      setSelectedCellIndex(null);

      // Show sequence with flashes
      let flashIndex = 0;
      const flashInterval = setInterval(() => {
         if (flashIndex < newSequence.length) {
            flashIndex++;
         } else {
            clearInterval(flashInterval);
            // Hide after sequence
            setTimeout(() => {
               setGameState("input");
            }, 250);
         }
      }, 650);

      // Cleanup
      return () => clearInterval(flashInterval);
   }, [currentRound, gridSize, currentImages.length]);

   // Start first round
   useEffect(() => {
      if (currentRound < maxRounds) {
         startRound();
      }
   }, [currentRound, maxRounds, startRound]);

   // Check game completion
   useEffect(() => {
      if (currentRound >= maxRounds) {
         setTimeout(() => {
            onComplete(currentScore);
         }, 1000);
      }
   }, [currentRound, maxRounds, currentScore, onComplete]);

   // Selected cell for keyboard navigation
   const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(
      null
   );

   // Handle card click
   const handleCardClick = (idx: number) => {
      if (gameState !== "input") return;
      if (userInput.includes(idx)) return; // Already selected

      const newInput = [...userInput, idx];
      setUserInput(newInput);

      // Check if correct
      const step = newInput.length - 1;
      if (newInput[step] !== sequence[step]) {
         // Wrong answer
         setGameState("wrong");
         setFeedback("wrong");

         // Show correct sequence briefly
         setTimeout(() => {
            setFeedback(null);
            setUserInput([]);
            setGameState("input");
            setSelectedCellIndex(null);
         }, 2000);
         return;
      }

      // Correct step
      if (newInput.length === sequence.length) {
         // All correct - round complete
         const roundScore = Math.round(100 / maxRounds);
         const newScore = Math.min(currentScore + roundScore, 100);
         setCurrentScore(newScore);
         setGameState("correct");
         setFeedback("correct");
         setTimeout(() => {
            onScoreUpdate(newScore);
         }, 0);

         setTimeout(() => {
            setFeedback(null);
            setCurrentRound(currentRound + 1);
            setSelectedCellIndex(null);
         }, 1500);
      }
   };

   // Keyboard controls for Image Recall
   useEffect(() => {
      if (gameState !== "input") {
         setSelectedCellIndex(null);
         return;
      }

      const handleKeyPress = (e: KeyboardEvent) => {
         if (gameState !== "input") return;

         const key = e.key;
         const keyLower = key.toLowerCase();
         const totalCells = currentImages.length;

         // Number keys: Direct selection by position (1-9, 0, -, =)
         let position = -1;
         if (key >= "1" && key <= "9") {
            position = parseInt(key) - 1; // 1-9 → 0-8
         } else if (key === "0" && totalCells > 9) {
            position = 9; // 0 → position 10 (index 9)
         } else if (key === "-" && totalCells > 10) {
            position = 10; // - → position 11 (index 10)
         } else if (key === "=" && totalCells > 11) {
            position = 11; // = → position 12 (index 11)
         }

         // Direct selection with number keys
         if (position >= 0 && position < totalCells) {
            e.preventDefault();
            if (!userInput.includes(position)) {
               handleCardClick(position);
            }
            return;
         }

         // Arrow keys or WASD: Navigate and select
         if (selectedCellIndex === null) {
            // Initialize selection at first available cell
            if (
               key === "ArrowUp" ||
               key === "ArrowDown" ||
               key === "ArrowLeft" ||
               key === "ArrowRight" ||
               keyLower === "w" ||
               keyLower === "s" ||
               keyLower === "a" ||
               keyLower === "d"
            ) {
               e.preventDefault();
               // Find first cell that's not selected
               for (let i = 0; i < totalCells; i++) {
                  if (!userInput.includes(i)) {
                     setSelectedCellIndex(i);
                     return;
                  }
               }
            }
            return;
         }

         // Navigate with arrow keys
         let newIndex = selectedCellIndex;
         const currentRow = Math.floor(selectedCellIndex / gridSize);
         const currentCol = selectedCellIndex % gridSize;

         switch (key) {
            case "ArrowUp":
            case "w":
               e.preventDefault();
               if (currentRow > 0) {
                  newIndex = selectedCellIndex - gridSize;
               }
               break;
            case "ArrowDown":
            case "s":
               e.preventDefault();
               if (currentRow < gridSize - 1) {
                  newIndex = selectedCellIndex + gridSize;
               }
               break;
            case "ArrowLeft":
            case "a":
               e.preventDefault();
               if (currentCol > 0) {
                  newIndex = selectedCellIndex - 1;
               }
               break;
            case "ArrowRight":
            case "d":
               e.preventDefault();
               if (currentCol < gridSize - 1) {
                  newIndex = selectedCellIndex + 1;
               }
               break;
            case "Enter":
            case " ":
               e.preventDefault();
               if (!userInput.includes(selectedCellIndex)) {
                  handleCardClick(selectedCellIndex);
               }
               return;
         }

         // Update selected cell index (wrap around if needed)
         if (newIndex !== selectedCellIndex) {
            if (newIndex < 0) newIndex = totalCells - 1;
            if (newIndex >= totalCells) newIndex = 0;
            setSelectedCellIndex(newIndex);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [
      gameState,
      selectedCellIndex,
      gridSize,
      currentImages.length,
      userInput,
      handleCardClick,
   ]);

   // Flash card animation
   const flashCard = (idx: number) => {
      const card = document.querySelector(
         `.image-card[data-idx="${idx}"]`
      ) as HTMLElement;
      if (card) {
         card.classList.add("flash");
         setTimeout(() => card.classList.remove("flash"), 320);
      }
   };

   // Show sequence with flashes
   useEffect(() => {
      if (gameState === "memorizing" && sequence.length > 0) {
         sequence.forEach((idx, i) => {
            setTimeout(() => flashCard(idx), 600 + i * 650);
         });
      }
   }, [gameState, sequence]);

   const progress = ((currentRound + 1) / maxRounds) * 100;

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: isMobile ? "20px" : "24px",
            padding: isMobile ? "12px" : "24px",
            maxWidth: isMobile ? "100%" : "700px",
            margin: "0 auto",
            width: "100%",
         }}
      >
         {/* Header with Round and Score */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "16px" : "20px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            {/* Game Title - Image Recall */}
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: isMobile ? "8px" : "10px",
                  marginBottom: isMobile ? "12px" : "16px",
                  paddingBottom: isMobile ? "12px" : "16px",
                  borderBottom: "1px solid var(--stroke)",
               }}
            >
               <PhotoIcon
                  style={{
                     width: isMobile ? 24 : 28,
                     height: isMobile ? 24 : 28,
                     color: "var(--accent)",
                  }}
               />
               <h2
                  style={{
                     margin: 0,
                     fontSize: isMobile ? "1.25rem" : "1.5rem",
                     fontWeight: 700,
                     background:
                        "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                     WebkitBackgroundClip: "text",
                     WebkitTextFillColor: "transparent",
                     backgroundClip: "text",
                     textShadow: "0 2px 8px rgba(125, 211, 252, 0.3)",
                  }}
               >
                  Image Recall
               </h2>
               <SparklesIcon
                  style={{
                     width: isMobile ? 20 : 24,
                     height: isMobile ? 20 : 24,
                     color: "var(--ok)",
                  }}
               />
            </div>
            <div
               style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: isMobile ? "0.75rem" : "0.875rem",
                  color: "var(--muted)",
                  fontWeight: 500,
                  marginBottom: isMobile ? "10px" : "12px",
                  flexWrap: isMobile ? "wrap" : "nowrap",
                  gap: isMobile ? "8px" : "0",
               }}
            >
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <ArrowPathIcon
                     style={{
                        width: isMobile ? 14 : 16,
                        height: isMobile ? 14 : 16,
                        color: "var(--accent)",
                     }}
                  />
                  Round {currentRound + 1} / {maxRounds}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <TrophyIcon
                     style={{
                        width: isMobile ? 14 : 16,
                        height: isMobile ? 14 : 16,
                        color: "var(--ok)",
                     }}
                  />
                  Score: {currentScore} / 100
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <LightBulbIcon
                     style={{
                        width: isMobile ? 14 : 16,
                        height: isMobile ? 14 : 16,
                        color: "var(--accent)",
                     }}
                  />
                  Hints:{" "}
                  {maxHints === 0 ? "∞" : `${maxHints - hintsUsed}/${maxHints}`}
               </span>
            </div>
            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: isMobile ? "6px" : "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: isMobile ? "3px" : "4px",
                  overflow: "hidden",
               }}
            >
               <div
                  style={{
                     width: `${progress}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: isMobile ? "3px" : "4px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Game State Display */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "16px" : "20px",
               textAlign: "center",
            }}
         >
            <div style={{ marginBottom: isMobile ? "10px" : "16px" }}>
               <b
                  style={{
                     fontSize: isMobile ? "0.95rem" : "1.125rem",
                     color: "var(--text)",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     gap: isMobile ? "6px" : "8px",
                     flexWrap: "wrap",
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
            </div>
            <div
               style={{
                  fontSize: isMobile ? "0.75rem" : "0.875rem",
                  color: "var(--muted)",
               }}
            >
               {gameState === "memorizing" &&
                  "After it disappears, click in the same order"}
               {gameState === "input" && "Click the images in order"}
            </div>
         </div>

         {/* Feedback Messages */}
         {feedback !== null && (
            <div
               style={{
                  padding: isMobile ? "14px 20px" : "16px 24px",
                  borderRadius: isMobile ? "12px" : "12px",
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

         {/* Image Grid (dynamic size) */}
         <div
            style={{
               display: "grid",
               gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
               gap: isMobile
                  ? "8px"
                  : gridSize <= 3
                  ? "14px"
                  : gridSize <= 5
                  ? "10px"
                  : "8px",
               width: "100%",
               maxWidth: isMobile
                  ? "100%"
                  : gridSize <= 3
                  ? "400px"
                  : gridSize <= 5
                  ? "500px"
                  : "600px",
            }}
         >
            {currentImages.map((emoji, idx) => {
               const isInSequence = sequence.includes(idx);
               const isSelected = userInput.includes(idx);
               const isHinted = hintRevealed.some(
                  (hintIdx) => sequence[hintIdx] === idx
               );
               const isVisible =
                  gameState === "memorizing" ||
                  isSelected ||
                  isHinted ||
                  (gameState === "wrong" && isInSequence);
               const orderInSequence = sequence.indexOf(idx);
               const orderInInput = userInput.indexOf(idx);
               const isCorrect = isSelected && orderInInput === orderInSequence;
               const isWrong = isSelected && orderInInput !== orderInSequence;

               return (
                  <button
                     key={idx}
                     className="image-card"
                     data-idx={idx}
                     onClick={() => handleCardClick(idx)}
                     disabled={gameState !== "input" || isSelected}
                     style={{
                        width: "100%",
                        aspectRatio: "1",
                        borderRadius: isMobile ? "14px" : "18px",
                        border: `${
                           gameState === "memorizing" && isInSequence
                              ? "3px solid rgba(110, 168, 255, 1)"
                              : isCorrect
                              ? "2px solid rgba(54, 211, 153, 0.6)"
                              : isWrong
                              ? "2px solid rgba(251, 113, 133, 0.6)"
                              : isSelected
                              ? "2px solid rgba(110, 168, 255, 0.6)"
                              : selectedCellIndex === idx
                              ? "2px solid rgba(251, 191, 36, 0.8)"
                              : "2px solid rgba(255, 255, 255, 0.1)"
                        }`,
                        outline:
                           selectedCellIndex === idx && !isSelected
                              ? "2px solid rgba(251, 191, 36, 0.5)"
                              : "none",
                        outlineOffset:
                           selectedCellIndex === idx && !isSelected
                              ? "2px"
                              : "0",
                        background:
                           gameState === "memorizing" && isInSequence
                              ? "linear-gradient(135deg, rgba(110, 168, 255, 0.4), rgba(110, 168, 255, 0.25))"
                              : isSelected
                              ? "linear-gradient(135deg, rgba(110, 168, 255, 0.2), rgba(110, 168, 255, 0.1))"
                              : selectedCellIndex === idx && !isSelected
                              ? "linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(251, 191, 36, 0.08))"
                              : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                        boxShadow:
                           gameState === "memorizing" && isInSequence
                              ? "0 0 30px rgba(110, 168, 255, 0.6), 0 0 50px rgba(110, 168, 255, 0.4), inset 0 0 15px rgba(110, 168, 255, 0.2)"
                              : isCorrect || isWrong
                              ? `0 10px 24px ${
                                   isCorrect
                                      ? "rgba(54, 211, 153, 0.18)"
                                      : "rgba(251, 113, 133, 0.18)"
                                }`
                              : "0 10px 18px rgba(0, 0, 0, 0.22)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: isMobile
                           ? gridSize <= 3
                              ? "36px"
                              : gridSize <= 5
                              ? "28px"
                              : "24px"
                           : gridSize <= 3
                           ? "42px"
                           : gridSize <= 5
                           ? "32px"
                           : "28px",
                        cursor:
                           gameState === "input" && !isSelected
                              ? "pointer"
                              : "not-allowed",
                        userSelect: "none",
                        position: "relative",
                        overflow: "hidden",
                        transition: "all 0.15s",
                        opacity: isVisible ? 1 : 0.3,
                        transform:
                           gameState === "memorizing" && isInSequence
                              ? "scale(1.05)"
                              : "scale(1)",
                        zIndex:
                           gameState === "memorizing" && isInSequence ? 5 : 1,
                     }}
                  >
                     {isVisible ? emoji : "?"}
                     {isSelected && (
                        <div
                           style={{
                              position: "absolute",
                              right: isMobile ? "8px" : "10px",
                              top: isMobile ? "8px" : "10px",
                              width: isMobile ? "24px" : "28px",
                              height: isMobile ? "24px" : "28px",
                              borderRadius: "999px",
                              background: "rgba(15, 27, 51, 0.8)",
                              border: "1px solid rgba(255, 255, 255, 0.12)",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 900,
                              fontSize: isMobile ? "11px" : "12px",
                              color: "rgba(232, 238, 252, 0.95)",
                              zIndex: 2,
                           }}
                        >
                           {orderInInput + 1}
                        </div>
                     )}
                  </button>
               );
            })}
         </div>

         {/* Action Buttons: Hint, Share */}
         <div
            style={{
               width: "100%",
               display: "flex",
               gap: isMobile ? "10px" : "12px",
               justifyContent: "center",
               flexWrap: "wrap",
               padding: isMobile ? "0 8px" : "0",
               maxWidth: isMobile ? "100%" : "700px",
               margin: "0 auto",
            }}
         >
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
                        : "🎉 Someone opened your link! Unlimited hints are now active for 15 minutes!"}
                  </span>
               </div>
            )}

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
                  border:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "1px solid rgba(100, 100, 100, 0.4)"
                        : "1px solid rgba(251, 191, 36, 0.6)",
                  borderRadius: "12px",
                  color: "var(--text)",
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

export default ImageRecall;