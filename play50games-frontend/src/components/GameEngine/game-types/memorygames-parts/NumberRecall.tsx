"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

function NumberRecall({
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
   const maxRounds = config.rounds || 15;
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [sequence, setSequence] = useState<string>("");
   const [input, setInput] = useState("");
   const [showing, setShowing] = useState(true);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);

   // Hint functionality
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [revealedDigits, setRevealedDigits] = useState<number[]>([]); // Array of revealed digit indices
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max hints: 10 for Number Recall, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Check if mobile device
   useEffect(() => {
      const checkMobile = () => {
         setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
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
         await registerShare(shareId, "number-recall");
         const gameKey = "play50games_shared_number-recall";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {}
   };

   // Share functionality
   useEffect(() => {
      if (currentShareId) {
         const gameKey = "play50games_shared_number-recall";
         shareCheckIntervalRef.current = setInterval(async () => {
            try {
               const status = await getShareStatus(currentShareId);
               if (status && status.clicks > 0 && !unlimitedActivated) {
                  setUnlimitedActivated(true);
                  setHasShared(true);
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  setTimeout(() => {
                     setUnlimitedActivated(false);
                     setHasShared(false);
                  }, 15 * 60 * 1000); // 15 minutes
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
               title: "Number Recall Game",
               text: "Check out this awesome Number Recall game!",
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
      if (showing || gameState !== "input") return;

      // Reveal next digit in sequence (one at a time)
      if (sequence.length > 0 && revealedDigits.length < sequence.length) {
         const nextIndex = revealedDigits.length;
         setRevealedDigits([...revealedDigits, nextIndex]);
         setHintsUsed(hintsUsed + 1);
      }
   };

   // Start first round
   useEffect(() => {
      if (currentRound < maxRounds) {
         startRound();
      }
   }, [currentRound]);

   // Check game completion
   useEffect(() => {
      if (currentRound >= maxRounds) {
         setTimeout(() => {
            onComplete(currentScore);
         }, 1000);
      }
   }, [currentRound, maxRounds, currentScore, onComplete]);

   const startRound = useCallback(() => {
      // Sequence length increases with round: 3 + round (min 3, max 10)
      const length = Math.min(3 + currentRound, 10);
      const newSequence = Array.from({ length }, () =>
         Math.floor(Math.random() * 10)
      ).join("");

      setSequence(newSequence);
      setInput("");
      setShowing(true);
      setGameState("memorizing");
      setFeedback(null);
      setRevealedDigits([]);

      // Show time: 1200ms + round * 200ms
      const showTime = 1200 + currentRound * 200;
      setTimeout(() => {
         setShowing(false);
         setGameState("input");
      }, showTime);
   }, [currentRound]);

   const handleSubmit = () => {
      if (showing || gameState !== "input") return;
      if (!input.trim()) return;

      const isCorrect = input === sequence;

      if (isCorrect) {
         // Calculate score based on completed rounds to ensure total is exactly 100
         const completedRounds = currentRound + 1;
         const newScore = Math.round((completedRounds / maxRounds) * 100);
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

         setTimeout(() => {
            setFeedback(null);
            setInput("");
            setGameState("input");
         }, 2000);
      }
   };

   const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
         handleSubmit();
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
                  {gameState === "memorizing" && "Memorize the number…"}
                  {gameState === "input" && "Type the sequence you saw"}
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

         {/* Number Display Box */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "24px" : "32px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            <div
               style={{
                  height: isMobile ? "120px" : "140px",
                  borderRadius: isMobile ? "16px" : "18px",
                  background:
                     showing || revealedDigits.length > 0
                        ? "radial-gradient(220px 140px at 30% 30%, rgba(125, 211, 252, 0.14), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))"
                        : "radial-gradient(220px 140px at 30% 30%, rgba(125, 211, 252, 0.08), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01))",
                  boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isMobile ? "32px" : "42px",
                  fontWeight: 900,
                  letterSpacing: isMobile ? "4px" : "6px",
                  color: "var(--text)",
                  position: "relative",
               }}
            >
               {showing ? (
                  sequence
               ) : revealedDigits.length > 0 ? (
                  <span>
                     {sequence.split("").map((digit, index) => (
                        <span
                           key={index}
                           style={{
                              color: revealedDigits.includes(index)
                                 ? "var(--accent)"
                                 : "var(--text)",
                              opacity: revealedDigits.includes(index) ? 1 : 0.3,
                           }}
                        >
                           {revealedDigits.includes(index) ? digit : "•"}
                        </span>
                     ))}
                  </span>
               ) : (
                  sequence.split("").map((_, index) => (
                     <span key={index} style={{ opacity: 0.3 }}>
                        •
                     </span>
                  ))
               )}
            </div>

            {/* Input Section */}
            {!showing && (
               <div
                  style={{
                     display: "flex",
                     gap: isMobile ? "8px" : "10px",
                     marginTop: isMobile ? "16px" : "20px",
                  }}
               >
                  <input
                     type="text"
                     value={input}
                     onChange={(e) =>
                        setInput(e.target.value.replace(/\D/g, ""))
                     }
                     onKeyPress={handleKeyPress}
                     maxLength={sequence.length}
                     disabled={gameState !== "input"}
                     placeholder="Type the sequence"
                     style={{
                        flex: 1,
                        borderRadius: isMobile ? "12px" : "12px",
                        background: "rgba(15, 27, 51, 0.7)",
                        color: "var(--text)",
                        padding: isMobile ? "12px" : "12px",
                        fontSize: isMobile ? "16px" : "18px",
                        letterSpacing: isMobile ? "3px" : "4px",
                        textAlign: "center",
                        outline: "none",
                        fontFamily: "monospace",
                        fontWeight: 600,
                        opacity: gameState !== "input" ? 0.5 : 1,
                        cursor: gameState !== "input" ? "not-allowed" : "text",
                     }}
                  />
                  <button
                     onClick={handleSubmit}
                     disabled={gameState !== "input" || !input.trim()}
                     style={{
                        padding: isMobile ? "12px 20px" : "12px 24px",
                        borderRadius: isMobile ? "12px" : "12px",
                        background:
                           gameState !== "input" || !input.trim()
                              ? "rgba(100, 100, 100, 0.2)"
                              : "linear-gradient(180deg, rgba(110, 168, 255, 0.9), rgba(110, 168, 255, 0.55))",
                        color:
                           gameState !== "input" || !input.trim()
                              ? "var(--muted)"
                              : "#081126",
                        cursor:
                           gameState !== "input" || !input.trim()
                              ? "not-allowed"
                              : "pointer",
                        fontWeight: 700,
                        fontSize: isMobile ? "14px" : "16px",
                        transition: "all 0.2s ease",
                        opacity:
                           gameState !== "input" || !input.trim() ? 0.5 : 1,
                     }}
                  >
                     OK
                  </button>
               </div>
            )}
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
                  maxWidth: isMobile ? "100%" : "700px",
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

export default NumberRecall;
