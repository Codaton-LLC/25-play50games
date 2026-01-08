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

function EmojiMemory({
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
   const [emojis, setEmojis] = useState<string[]>([]);
   const [selected, setSelected] = useState<number[]>([]);
   const [showing, setShowing] = useState(true);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);

   // Hint functionality (from Card Flip Memory)
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [showHint, setShowHint] = useState(false);
   const [hintPositions, setHintPositions] = useState<number[]>([]);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max hints: 10 for Emoji Memory, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Get grid size based on round (from backend config)
   const getGridSizeForRound = useCallback(
      (round: number): [number, number] => {
         // Rounds 1-5: 4x4, 6-10: 5x5, 11-15: 6x7, 16-20: 8x8
         if (round >= 1 && round <= 5) {
            return [4, 4];
         } else if (round >= 6 && round <= 10) {
            return [5, 5];
         } else if (round >= 11 && round <= 15) {
            return [6, 7];
         } else {
            return [8, 8];
         }
      },
      []
   );

   // Check if mobile device
   useEffect(() => {
      const checkMobile = () => {
         setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
   }, []);

   // Emoji list - using diverse emojis
   const emojiList = useMemo(
      () => [
         "🍎",
         "🚗",
         "🐶",
         "⭐",
         "🎵",
         "🏀",
         "📦",
         "🌙",
         "🔥",
         "🎲",
         "📌",
         "🧩",
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
      ],
      []
   );

   // Get grid size from config or calculate from round
   const gridSizeConfig = useMemo(() => {
      if (config.gridSizes && Array.isArray(config.gridSizes)) {
         const roundIndex = Math.min(currentRound, config.gridSizes.length - 1);
         const size = config.gridSizes[roundIndex];
         if (Array.isArray(size)) {
            return [size[0], size[1]];
         }
         return [size, size];
      }
      return getGridSizeForRound(currentRound + 1);
   }, [config.gridSizes, currentRound, getGridSizeForRound]);

   const [gridWidth, gridHeight] = gridSizeConfig;

   const startRound = useCallback(() => {
      const [currentWidth, currentHeight] = gridSizeConfig;
      const currentTotalCells = currentWidth * currentHeight;
      const emojiCount = Math.min(
         Math.floor(currentTotalCells / 2),
         Math.min(4 + currentRound, 8)
      );

      // Select random emojis
      const shuffled = [...emojiList].sort(() => Math.random() - 0.5);
      const selectedEmojis = shuffled.slice(0, emojiCount);

      // Create grid with emojis at random positions
      const grid: string[] = new Array(currentTotalCells).fill("");
      const positions = [...Array(currentTotalCells).keys()]
         .sort(() => Math.random() - 0.5)
         .slice(0, emojiCount);

      positions.forEach((pos, i) => {
         grid[pos] = selectedEmojis[i];
      });

      setEmojis(grid);
      setSelected([]);
      setShowing(true);
      setGameState("memorizing");
      setFeedback(null);
      setShowHint(false);
      setHintPositions([]);

      // Show emojis for 2-4 seconds based on round
      const showTime = 2000 + currentRound * 200;
      setTimeout(() => {
         setShowing(false);
         setGameState("input");
      }, showTime);
   }, [currentRound, gridSizeConfig, emojiList]);

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

   // Generate shareable link with tracking
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0]; // Remove existing params
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5); // Unique share ID
      return `${currentUrl}?shared=${shareId}`;
   };

   // Register share link in backend (but don't activate hints yet)
   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "emoji-memory");
         // Store share_id to monitor for clicks (but DON'T activate hints yet)
         const gameKey = "play50games_shared_emoji-memory";
         // Only store share_id, don't set hasShared to true yet
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
         // Note: hasShared remains false until someone clicks the link
      } catch (error) {}
   };

   // Share functionality (from Card Flip Memory)
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
            const gameKey = "play50games_shared_emoji-memory";
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
                  const gameKey = "play50games_shared_emoji-memory";
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
                  const gameKey = "play50games_shared_emoji-memory";
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
      const gameKey = "play50games_shared_emoji-memory";
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
      // Use the provided shareId instead of generating a new one
      const currentUrl = window.location.href.split("?")[0]; // Remove existing params
      const shareableLink = `${currentUrl}?shared=${shareId}`;

      try {
         await navigator.clipboard.writeText(shareableLink);
         // Success - show message (hints will activate when someone clicks the link)
         setShareSuccess(true);
         setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
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
            // Success - show message (hints will activate when someone clicks the link)
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
         } catch (err) {}
         document.body.removeChild(textArea);
      }
   };

   // Handle share via Web Share API or fallback
   const handleShare = async () => {
      const shareableLink = getShareableLink();
      const shareId = new URL(shareableLink).searchParams.get("shared") || "";

      if (!shareId) return;

      // Register share link in backend (but don't activate hints yet)
      await registerShareLink(shareId);

      // Try Web Share API first (mobile/desktop)
      if (navigator.share) {
         try {
            await navigator.share({
               title: "Emoji Memory Game",
               text: "Check out this awesome Emoji Memory game!",
               url: shareableLink,
            });
            // Success - show message (hints will activate when someone clicks the link)
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
         } catch (error: any) {
            // User cancelled or error - try copy to clipboard
            if (error.name !== "AbortError") {
               handleCopyLink(shareId);
            }
         }
      } else {
         // Fallback: copy to clipboard
         handleCopyLink(shareId);
      }
   };

   // Handle hint button click (from Card Flip Memory)
   const handleHint = () => {
      if (maxHints > 0 && hintsUsed >= maxHints) return; // No hints left
      if (showing || gameState !== "input") return; // Can't hint during memorizing

      // Find emoji positions that haven't been selected yet
      const emojiPositions = emojis
         .map((emoji, idx) => (emoji !== "" ? idx : -1))
         .filter((idx) => idx !== -1 && !selected.includes(idx));

      if (emojiPositions.length > 0) {
         // Show 1-2 random emoji positions as hint
         const hintCount = Math.min(2, emojiPositions.length);
         const shuffled = [...emojiPositions].sort(() => Math.random() - 0.5);
         const hintPos = shuffled.slice(0, hintCount);

         setHintPositions(hintPos);
         setShowHint(true);
         setHintsUsed(hintsUsed + 1);

         // Hide hint after 2 seconds
         setTimeout(() => {
            setShowHint(false);
            setHintPositions([]);
         }, 2000);
      }
   };

   const handleCellClick = (index: number) => {
      if (showing || gameState !== "input") return;
      if (selected.includes(index)) return;

      const newSelected = [...selected, index];
      setSelected(newSelected);

      // Check if clicked on an emoji position
      const hasEmoji = emojis[index] !== "";
      const allEmojisFound = emojis
         .map((emoji, idx) => (emoji !== "" ? idx : -1))
         .filter((idx) => idx !== -1)
         .every((idx) => newSelected.includes(idx));

      if (allEmojisFound) {
         // All emojis found - check if correct
         const correctPositions = emojis
            .map((emoji, idx) => (emoji !== "" ? idx : -1))
            .filter((idx) => idx !== -1);

         const isCorrect =
            newSelected.length === correctPositions.length &&
            newSelected.every((idx) => correctPositions.includes(idx));

         if (isCorrect) {
            const roundScore = Math.round(100 / maxRounds);
            const newScore = currentScore + roundScore;
            setCurrentScore(newScore);
            setGameState("correct");
            setFeedback("correct");
            setTimeout(() => {
               onScoreUpdate(newScore);
            }, 0);

            setTimeout(() => {
               setFeedback(null);
               setCurrentRound(currentRound + 1);
            }, 1500);
         } else {
            // Wrong answer - show feedback and reset for retry
            setGameState("wrong");
            setFeedback("wrong");

            // After showing feedback, reset selection and allow retry
            setTimeout(() => {
               setFeedback(null);
               setSelected([]);
               setGameState("input");
            }, 2000);
         }
      } else if (!hasEmoji) {
         // Clicked on empty cell - wrong, show feedback and reset for retry
         setGameState("wrong");
         setFeedback("wrong");

         // After showing feedback, reset selection and allow retry
         setTimeout(() => {
            setFeedback(null);
            setSelected([]);
            setGameState("input");
         }, 2000);
      }
   };

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
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "16px" : "20px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
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
                     width: `${((currentRound + 1) / maxRounds) * 100}%`,
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
                  {gameState === "memorizing" &&
                     "Memorize the emoji positions…"}
                  {gameState === "input" &&
                     "Click on the cells where you saw emojis"}
                  {gameState === "correct" && (
                     <>
                        <CheckCircleIcon
                           style={{
                              width: isMobile ? 18 : 20,
                              height: isMobile ? 18 : 20,
                              color: "rgba(54, 211, 153, 0.9)",
                           }}
                        />
                        Correct!
                     </>
                  )}
                  {gameState === "wrong" && (
                     <>
                        <XCircleIcon
                           style={{
                              width: isMobile ? 18 : 20,
                              height: isMobile ? 18 : 20,
                              color: "rgba(251, 113, 133, 0.9)",
                           }}
                        />
                        Wrong!
                     </>
                  )}
               </b>
            </div>
            <div
               style={{
                  display: "inline-block",
                  padding: isMobile ? "5px 10px" : "6px 12px",
                  borderRadius: "999px",
                  fontSize: isMobile ? "0.7rem" : "0.75rem",
                  fontWeight: 700,
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background:
                     gameState === "correct"
                        ? "rgba(54, 211, 153, 0.2)"
                        : gameState === "wrong"
                        ? "rgba(251, 113, 133, 0.2)"
                        : "rgba(15, 27, 51, 0.55)",
                  color:
                     gameState === "correct"
                        ? "var(--ok)"
                        : gameState === "wrong"
                        ? "var(--warn)"
                        : "var(--text)",
               }}
            >
               {gameState === "memorizing" && "Memorizing"}
               {gameState === "input" && "Your Turn"}
               {gameState === "correct" && "Correct"}
               {gameState === "wrong" && "Wrong"}
            </div>
         </div>

         {/* Emoji Grid */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "12px" : "16px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            <div
               style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${gridWidth}, 1fr)`,
                  gap: isMobile ? "8px" : "10px",
                  width: "100%",
                  maxWidth: isMobile ? "100%" : "600px",
                  margin: "0 auto",
               }}
            >
               {emojis.map((emoji, i) => {
                  const isSelected = selected.includes(i);
                  const hasEmoji = emoji !== "";
                  const isCorrect = isSelected && hasEmoji;
                  const isWrong = isSelected && !hasEmoji;
                  const isHinted = showHint && hintPositions.includes(i);

                  return (
                     <button
                        key={i}
                        onClick={() => handleCellClick(i)}
                        disabled={
                           showing || isSelected || gameState !== "input"
                        }
                        style={{
                           aspectRatio: "1",
                           borderRadius: isMobile ? "12px" : "14px",
                           border: isCorrect
                              ? "3px solid var(--ok)"
                              : isWrong
                              ? "3px solid var(--warn)"
                              : isHinted
                              ? "3px solid var(--accent)"
                              : isSelected
                              ? "2px solid var(--accent)"
                              : "2px solid var(--stroke)",
                           background:
                              showing || isSelected || isHinted
                                 ? hasEmoji
                                    ? isHinted
                                       ? "linear-gradient(135deg, rgba(125, 211, 252, 0.4), rgba(125, 211, 252, 0.3))"
                                       : "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))"
                                    : "var(--card)"
                                 : "var(--card)",
                           fontSize: isMobile ? "2rem" : "2.5rem",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           cursor:
                              showing || isSelected || gameState !== "input"
                                 ? "not-allowed"
                                 : "pointer",
                           transition: "all 0.2s ease",
                           opacity:
                              showing || isSelected || gameState !== "input"
                                 ? showing && !hasEmoji
                                    ? 0.3
                                    : 1
                                 : 0.7,
                           transform: isSelected ? "scale(0.95)" : "scale(1)",
                           boxShadow: isCorrect
                              ? "0 0 20px rgba(54, 211, 153, 0.5)"
                              : isWrong
                              ? "0 0 20px rgba(251, 113, 133, 0.5)"
                              : isHinted
                              ? "0 0 20px rgba(125, 211, 252, 0.6)"
                              : isSelected
                              ? "0 4px 12px rgba(125, 211, 252, 0.3)"
                              : "0 2px 8px rgba(0, 0, 0, 0.1)",
                        }}
                        onMouseEnter={(e) => {
                           if (
                              !showing &&
                              !isSelected &&
                              gameState === "input"
                           ) {
                              e.currentTarget.style.transform = "scale(1.05)";
                              e.currentTarget.style.opacity = "1";
                           }
                        }}
                        onMouseLeave={(e) => {
                           if (
                              !showing &&
                              !isSelected &&
                              gameState === "input"
                           ) {
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.opacity = "0.7";
                           }
                        }}
                     >
                        {showing || isSelected || isHinted
                           ? hasEmoji
                              ? emoji
                              : ""
                           : "?"}
                     </button>
                  );
               })}
            </div>
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
                  showing ||
                  gameState !== "input"
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

                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     showing ||
                     gameState !== "input"
                        ? "not-allowed"
                        : "pointer",
                  opacity:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     showing ||
                     gameState !== "input"
                        ? 0.5
                        : 1,
                  transition: "all 0.3s ease",
               }}
               onMouseEnter={(e) => {
                  if (
                     !(maxHints > 0 && hintsUsed >= maxHints) &&
                     !showing &&
                     gameState === "input"
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
                     !showing &&
                     gameState === "input"
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

         {/* Feedback Message (from Match the Shapes) */}
         {feedback !== null && (
            <div
               style={{
                  padding: isMobile ? "12px 20px" : "16px 24px",
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
                  gap: isMobile ? "8px" : "10px",
                  width: "100%",
                  maxWidth: isMobile ? "100%" : "600px",
                  justifyContent: "center",
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

export default EmojiMemory;
