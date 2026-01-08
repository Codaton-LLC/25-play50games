"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   ArrowPathIcon,
   TrophyIcon,
   ArrowPathRoundedSquareIcon,
   ShareIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

interface FinalMemoryGameProps {
   config: Record<string, any>;
   onComplete: (score: number) => void;
   isPlaying: boolean;
}

export default function FinalMemoryGame({
   config,
   onComplete,
   isPlaying,
}: FinalMemoryGameProps) {
   const maxRounds = config.rounds || 5;
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "ready" | "failed"
   >("memorizing");
   const [sequence, setSequence] = useState<string[]>([]);
   const [userInput, setUserInput] = useState("");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [currentLetterIndex, setCurrentLetterIndex] = useState(0);
   const [isMobile, setIsMobile] = useState(false);
   const inputRef = useRef<HTMLInputElement>(null);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited

   // Responsive design
   useEffect(() => {
      const checkResponsive = () => {
         setIsMobile(window.innerWidth < 640);
      };
      checkResponsive();
      window.addEventListener("resize", checkResponsive);
      return () => window.removeEventListener("resize", checkResponsive);
   }, []);

   // Letters pool
   const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

   // Generate sequence based on round
   const generateSequence = useCallback(() => {
      const length = 4 + currentRound; // 4, 5, 6, 7, 8
      const seq: string[] = [];
      for (let i = 0; i < length; i++) {
         seq.push(letters[Math.floor(Math.random() * letters.length)]);
      }
      return seq;
   }, [currentRound]);

   // Initialize round
   useEffect(() => {
      if (isPlaying && currentRound < maxRounds) {
         const seq = generateSequence();
         setSequence(seq);
         setUserInput("");
         setFeedback(null);
         setCurrentLetterIndex(0);
         setGameState("memorizing");
      }
   }, [isPlaying, currentRound, maxRounds, generateSequence]);

   // Flash sequence
   useEffect(() => {
      if (gameState !== "memorizing" || !sequence.length) return;

      const flashInterval = setInterval(() => {
         setCurrentLetterIndex((prev) => {
            if (prev >= sequence.length - 1) {
               clearInterval(flashInterval);
               setTimeout(() => {
                  setGameState("input");
                  setCurrentLetterIndex(0);
                  // Focus input when entering input state
                  setTimeout(() => {
                     inputRef.current?.focus();
                  }, 100);
               }, 500);
               return prev;
            }
            return prev + 1;
         });
      }, 1000); // Increased from 500ms to 1000ms (1 second) so letters are more visible

      return () => clearInterval(flashInterval);
   }, [gameState, sequence]);

   // Handle input
   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (gameState !== "input") return;
      const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
      setUserInput(value);
   };

   // Check answer
   const handleSubmit = () => {
      if (gameState !== "input" || !userInput) return;

      const isCorrect = userInput === sequence.join("");
      setFeedback(isCorrect ? "correct" : "wrong");

      if (isCorrect) {
         const roundScore = Math.round(100 / maxRounds);
         const newScore = Math.min(100, currentScore + roundScore);
         setCurrentScore(newScore);

         setTimeout(() => {
            if (currentRound + 1 >= maxRounds) {
               setGameState("ready");
               setTimeout(() => onComplete(100), 1000);
            } else {
               setCurrentRound((prev) => prev + 1);
            }
         }, 1500);
      } else {
         setTimeout(() => {
            setUserInput("");
            setFeedback(null);
         }, 1500);
      }
   };

   // Handle Enter key
   const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && gameState === "input") {
         handleSubmit();
      }
   };

   // Share functionality
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "final-memory-game");
         const gameKey = "play50games_shared_final-memory-game";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {
         // Error registering share
      }
   };

   const handleShare = async () => {
      const shareableLink = getShareableLink();
      const shareId = new URL(shareableLink).searchParams.get("shared") || "";

      if (!shareId) return;

      await registerShareLink(shareId);

      if (navigator.share) {
         try {
            await navigator.share({
               title: "Final Memory Game",
               text: "Check out this awesome game!",
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
         } catch (err) {
            // Failed to copy
         }
         document.body.removeChild(textArea);
      }
   };

   // Check share status
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         const gameKey = "play50games_shared_final-memory-game";
         try {
            const status = await getShareStatus(currentShareId);
            const hasClicks = status.has_clicks || status.clicks > 0;
            if (hasClicks && !hasShared) {
               setHasShared(true);
               setUnlimitedActivated(true);
               setReplaysUsed(0);

               const expiry = Date.now() + 15 * 60 * 1000;
               localStorage.setItem(
                  gameKey,
                  JSON.stringify({
                     share_id: currentShareId,
                     shared: true,
                     expiry: expiry,
                  })
               );

               setTimeout(() => {
                  setUnlimitedActivated(false);
                  setHasShared(false);
                  localStorage.removeItem(gameKey);
               }, 15 * 60 * 1000);

               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
            }
         } catch (error) {
            const errorMessage =
               error instanceof Error ? error.message : String(error);
            if (
               errorMessage.includes("404") ||
               errorMessage.includes("not found") ||
               errorMessage.includes("expired")
            ) {
               setUnlimitedActivated(false);
               setHasShared(false);
               localStorage.removeItem(gameKey);
               setCurrentShareId(null);
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
            }
         }
      };

      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000);

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
            shareCheckIntervalRef.current = null;
         }
      };
   }, [currentShareId, hasShared]);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_final-memory-game";
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
               const verifyShare = async () => {
                  try {
                     const status = await getShareStatus(data.share_id);
                     const hasClicks = status.has_clicks || status.clicks > 0;
                     if (hasClicks) {
                        if (
                           data.shared &&
                           data.expiry &&
                           Date.now() < data.expiry
                        ) {
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           setReplaysUsed(0);
                           const remainingTime = data.expiry - Date.now();
                           if (remainingTime > 0) {
                              setTimeout(() => {
                                 setUnlimitedActivated(false);
                                 setHasShared(false);
                                 localStorage.removeItem(gameKey);
                              }, remainingTime);
                           }
                        } else {
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           setReplaysUsed(0);
                           const expiryTime = Date.now() + 15 * 60 * 1000;
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
                     }
                  } catch (error) {
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

      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
         trackShareClick(sharedBy);
         const stored = localStorage.getItem(gameKey);
         if (stored) {
            try {
               const data = JSON.parse(stored);
               if (data.share_id === sharedBy) {
                  setCurrentShareId(sharedBy);
               }
            } catch (error) {
               // Error parsing
            }
         }
      }
   }, []);

   // Handle replay
   const handleReplay = useCallback(() => {
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setCurrentRound(0);
      setCurrentScore(0);
      setUserInput("");
      setFeedback(null);
      setCurrentLetterIndex(0);
      setReplaysUsed((prev) => prev + 1);

      // Force re-initialize by setting sequence first, then gameState
      // This ensures useEffect triggers properly
      setTimeout(() => {
         const seq = generateSequence();
         setSequence(seq);
         setGameState("memorizing");
      }, 0);
   }, [maxReplays, replaysUsed, generateSequence]);

   const progress =
      maxRounds > 0 ? Math.round(((currentRound + 1) / maxRounds) * 100) : 0;

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: isMobile ? "16px" : "20px",
            width: "100%",
            maxWidth: "800px",
            margin: "0 auto",
            padding: isMobile ? "12px" : "16px",
         }}
      >
         {/* Header */}
         <div
            style={{
               width: "100%",
               maxWidth: "800px",
               background: "var(--card)",
               borderRadius: isMobile ? "16px" : "20px",
               padding: isMobile ? "16px" : "20px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
               display: "flex",
               flexDirection: "column",
               gap: isMobile ? "12px" : "16px",
            }}
         >
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: isMobile ? "8px" : "12px",
               }}
            >
               <span
                  style={{
                     fontSize: isMobile ? "0.875rem" : "1rem",
                     fontWeight: 600,
                     color: "var(--text)",
                     display: "flex",
                     alignItems: "center",
                     gap: "6px",
                  }}
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
                  style={{
                     fontSize: isMobile ? "0.875rem" : "1rem",
                     fontWeight: 600,
                     color: "var(--text)",
                     display: "flex",
                     alignItems: "center",
                     gap: "6px",
                  }}
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
                  borderRadius: "999px",
                  overflow: "hidden",
               }}
            >
               <div
                  style={{
                     width: `${progress}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "999px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(250, 204, 21, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Game Area */}
         {gameState === "memorizing" && (
            <div
               style={{
                  width: "100%",
                  maxWidth: "800px",
                  background: "var(--card)",
                  borderRadius: "var(--radius)",
                  padding: isMobile ? "40px 20px" : "60px 32px",
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: isMobile ? "20px" : "24px",
                  minHeight: "300px",
                  justifyContent: "center",
               }}
            >
               <div
                  style={{
                     fontSize: isMobile ? "1rem" : "1.1rem",
                     fontWeight: 600,
                     color: "var(--muted)",
                     marginBottom: "20px",
                  }}
               >
                  Memorize the sequence:
               </div>
               <div
                  style={{
                     fontSize: isMobile ? "4rem" : "6rem",
                     fontWeight: 800,
                     color: "var(--accent)",
                     textAlign: "center",
                     minHeight: isMobile ? "80px" : "120px",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                  }}
               >
                  {sequence[currentLetterIndex] || ""}
               </div>
            </div>
         )}

         {gameState === "input" && (
            <div
               style={{
                  width: "100%",
                  maxWidth: "800px",
                  background: "var(--card)",
                  borderRadius: "var(--radius)",
                  padding: isMobile ? "20px" : "32px",
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: isMobile ? "20px" : "24px",
               }}
            >
               <div
                  style={{
                     fontSize: isMobile ? "1.1rem" : "1.3rem",
                     fontWeight: 700,
                     color: "var(--text)",
                     textAlign: "center",
                     marginBottom: "10px",
                  }}
               >
                  Type the sequence you saw:
               </div>
               <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  onClick={(e) => {
                     e.currentTarget.focus();
                  }}
                  onFocus={(e) => {
                     e.currentTarget.select();
                  }}
                  onBlur={() => {
                     if (gameState === "input") {
                        setTimeout(() => inputRef.current?.focus(), 0);
                     }
                  }}
                  placeholder="Enter sequence..."
                  style={{
                     width: "100%",
                     maxWidth: "400px",
                     padding: isMobile ? "16px" : "20px",
                     fontSize: isMobile ? "1.5rem" : "2rem",
                     fontWeight: 700,
                     textAlign: "center" as const,
                     background: "var(--background)",

                     color: "var(--text)",
                     textTransform: "uppercase",
                     letterSpacing: "0.2em",
                     outline: "none",
                     cursor: gameState === "input" ? "text" : "not-allowed",
                  }}
               />
               <button
                  onClick={handleSubmit}
                  disabled={!userInput || userInput.length !== sequence.length}
                  style={{
                     padding: isMobile ? "12px 24px" : "14px 28px",
                     background:
                        !userInput || userInput.length !== sequence.length
                           ? "rgba(100, 100, 100, 0.2)"
                           : "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.12))",
                     border:
                        !userInput || userInput.length !== sequence.length
                           ? "1px solid rgba(100, 100, 100, 0.4)"
                           : "2px solid rgba(134, 239, 172, 0.6)",

                     color: "var(--text)",
                     fontSize: isMobile ? "1rem" : "1.05rem",
                     fontWeight: 700,
                     cursor:
                        !userInput || userInput.length !== sequence.length
                           ? "not-allowed"
                           : "pointer",
                     transition: "all 0.3s ease",
                     opacity:
                        !userInput || userInput.length !== sequence.length
                           ? 0.5
                           : 1,
                  }}
               >
                  Submit
               </button>

               {/* Feedback */}
               {feedback && (
                  <div
                     style={{
                        padding: isMobile ? "16px 20px" : "20px 24px",

                        fontSize: isMobile ? "1rem" : "1.1rem",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        justifyContent: "center",
                        background:
                           feedback === "correct"
                              ? "rgba(134, 239, 172, 0.2)"
                              : "rgba(252, 165, 165, 0.2)",
                        border: `1px solid ${
                           feedback === "correct" ? "var(--ok)" : "var(--warn)"
                        }`,
                        color:
                           feedback === "correct" ? "var(--ok)" : "var(--warn)",
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
                           <span>
                              Try again! The sequence was: {sequence.join("")}
                           </span>
                        </>
                     )}
                  </div>
               )}
            </div>
         )}

         {/* Game Complete */}
         {gameState === "ready" && (
            <div
               style={{
                  padding: isMobile ? "24px" : "32px",
                  background: "var(--card)",
                  borderRadius: "var(--radius)",
                  color: "var(--text)",
                  fontSize: isMobile ? "1rem" : "1.1rem",
                  fontWeight: 700,
                  textAlign: "center" as const,
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                  width: "100%",
                  maxWidth: "800px",
               }}
            >
               <div
                  style={{
                     display: "inline-flex",
                     alignItems: "center",
                     gap: "8px",
                     padding: "8px 14px",
                     borderRadius: "999px",
                     fontWeight: 800,
                     fontSize: isMobile ? "0.95rem" : "1.05rem",
                     background:
                        "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.1))",
                     border: "2px solid rgba(134, 239, 172, 0.6)",
                     color: "var(--text)",
                     marginBottom: "16px",
                  }}
               >
                  <TrophyIcon style={{ width: 20, height: 20 }} />
                  Game Complete!
               </div>
               <div
                  style={{
                     fontSize: isMobile ? "1.05rem" : "1.1rem",
                     fontWeight: 600,
                     marginTop: "16px",
                  }}
               >
                  All {maxRounds} rounds completed!
               </div>
            </div>
         )}

         {/* Replay and Share Buttons */}
         {(gameState === "input" ||
            gameState === "ready" ||
            feedback === "wrong") && (
            <div
               style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  padding: isMobile ? "12px" : "16px",
                  background: "var(--card)",

                  width: "100%",
                  maxWidth: "800px",
               }}
            >
               {/* Share Success Message */}
               {shareSuccess && !unlimitedActivated && (
                  <div
                     style={{
                        width: "100%",
                        padding: "12px",
                        background: "rgba(134, 239, 172, 0.2)",
                        border: "2px solid rgba(134, 239, 172, 0.6)",
                        borderRadius: "8px",
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--ok)",
                        textAlign: "center",
                        marginBottom: "8px",
                     }}
                  >
                     Link copied! Unlimited replay will unlock when someone
                     opens your link!
                  </div>
               )}

               {/* Unlimited Activated Message */}
               {unlimitedActivated && (
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: isMobile ? "6px" : "8px",
                        padding: isMobile ? "10px 14px" : "8px 16px",
                        background:
                           "linear-gradient(135deg, rgba(250, 204, 21, 0.2), rgba(250, 204, 21, 0.1))",
                        border: "2px solid rgba(250, 204, 21, 0.6)",
                        borderRadius: isMobile ? "10px" : "8px",
                        color: "var(--text)",
                        fontSize: isMobile ? "0.85rem" : "0.9rem",
                        fontWeight: 500,
                        width: "100%",
                        justifyContent: "center",
                        textAlign: "center",
                        flexWrap: "wrap",
                        marginBottom: "8px",
                     }}
                  >
                     <CheckCircleIcon
                        style={{
                           width: isMobile ? 16 : 18,
                           height: isMobile ? 16 : 18,
                           color: "rgba(250, 204, 21, 0.9)",
                           flexShrink: 0,
                        }}
                     />
                     <span>
                        🎉 Someone opened your link! Unlimited replay is now
                        active for 15 minutes!
                     </span>
                  </div>
               )}

               {/* Replay Button */}
               <button
                  onClick={handleReplay}
                  disabled={maxReplays > 0 && replaysUsed >= maxReplays}
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: isMobile ? "6px" : "8px",
                     padding: isMobile ? "10px 16px" : "10px 20px",
                     width: isMobile ? "100%" : "auto",
                     background:
                        maxReplays > 0 && replaysUsed >= maxReplays
                           ? "rgba(100, 100, 100, 0.2)"
                           : "linear-gradient(135deg, rgba(250, 204, 21, 0.2), rgba(250, 204, 21, 0.1))",
                     border:
                        maxReplays > 0 && replaysUsed >= maxReplays
                           ? "1px solid rgba(100, 100, 100, 0.4)"
                           : "1px solid rgba(250, 204, 21, 0.6)",

                     color: "var(--text)",
                     fontSize: isMobile ? "0.85rem" : "0.95rem",
                     fontWeight: 600,
                     cursor:
                        maxReplays > 0 && replaysUsed >= maxReplays
                           ? "not-allowed"
                           : "pointer",
                     opacity:
                        maxReplays > 0 && replaysUsed >= maxReplays ? 0.5 : 1,
                     transition: "all 0.3s ease",
                  }}
               >
                  <ArrowPathRoundedSquareIcon
                     style={{
                        width: isMobile ? 18 : 20,
                        height: isMobile ? 18 : 20,
                     }}
                  />
                  Replay
                  {maxReplays > 0 && ` (${maxReplays - replaysUsed} left)`}
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
                        "linear-gradient(135deg, rgba(250, 204, 21, 0.2), rgba(250, 204, 21, 0.1))",
                     border: "1px solid rgba(250, 204, 21, 0.6)",

                     color: "var(--text)",
                     fontSize: isMobile ? "0.85rem" : "0.95rem",
                     fontWeight: 600,
                     cursor: "pointer",
                     transition: "all 0.3s ease",
                  }}
               >
                  <ShareIcon
                     style={{
                        width: isMobile ? 18 : 20,
                        height: isMobile ? 18 : 20,
                        color: "var(--accent)",
                     }}
                  />
                  <span>Share for unlimited</span>
               </button>
            </div>
         )}
      </div>
   );
}
