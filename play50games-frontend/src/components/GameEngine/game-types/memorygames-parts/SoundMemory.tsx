"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   ShareIcon,
   ArrowPathRoundedSquareIcon,
   TrophyIcon,
   ArrowPathIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

function SoundMemory({
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
   const [playerSequence, setPlayerSequence] = useState<number[]>([]);
   const [isPlayingSequence, setIsPlayingSequence] = useState(false);
   const [isAcceptingInput, setIsAcceptingInput] = useState(false);
   const [gameState, setGameState] = useState<
      "tutorial" | "playing" | "listening" | "input" | "correct" | "wrong"
   >("tutorial");
   const [activePad, setActivePad] = useState<number | null>(null);
   const audioContextRef = useRef<AudioContext | null>(null);
   const sequenceRef = useRef<number[]>([]);
   const roundRef = useRef(0);
   const inputLockRef = useRef(false);
   const resolvedRoundRef = useRef<number | null>(null);
   const [isMobile, setIsMobile] = useState(false);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max replays: 5 for Sound Memory, unlimited if shared
   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited

   // Audio tones (frequencies) - Each button always has the same sound:
   // Button 1 (padIndex 0) = 220 Hz
   // Button 2 (padIndex 1) = 330 Hz
   // Button 3 (padIndex 2) = 440 Hz
   // Button 4 (padIndex 3) = 550 Hz
   const tones = [220, 330, 440, 550];

   // Color palette for each button (1, 2, 3, 4)
   const getButtonColor = useCallback((padIndex: number) => {
      const colors = [
         {
            bg: "rgba(110, 168, 255, 0.25)",
            border: "rgba(110, 168, 255, 0.6)",
            shadow: "rgba(110, 168, 255, 0.4)",
         }, // Blue - Button 1
         {
            bg: "rgba(54, 211, 153, 0.25)",
            border: "rgba(54, 211, 153, 0.6)",
            shadow: "rgba(54, 211, 153, 0.4)",
         }, // Green - Button 2
         {
            bg: "rgba(251, 113, 133, 0.25)",
            border: "rgba(251, 113, 133, 0.6)",
            shadow: "rgba(251, 113, 133, 0.4)",
         }, // Red/Pink - Button 3
         {
            bg: "rgba(251, 191, 36, 0.25)",
            border: "rgba(251, 191, 36, 0.6)",
            shadow: "rgba(251, 191, 36, 0.4)",
         }, // Yellow - Button 4
      ];
      return colors[padIndex] || colors[0];
   }, []);

   // Check if mobile device
   useEffect(() => {
      const checkMobile = () => {
         setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
   }, []);

   // Initialize audio context
   useEffect(() => {
      const AudioCtx =
         window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
      return () => {
         if (audioContextRef.current) {
            audioContextRef.current.close();
         }
      };
   }, []);

   // Start game automatically on mount
   useEffect(() => {
      if (gameState === "tutorial") {
         setGameState("playing");
         setCurrentRound(0);
         setCurrentScore(0);
         setSequence([]);
         setReplaysUsed(0);
      }
   }, []);

   useEffect(() => {
      roundRef.current = currentRound;
   }, [currentRound]);

   // Start first round when game state is playing
   useEffect(() => {
      if (
         currentRound < maxRounds &&
         gameState === "playing" &&
         sequence.length === 0
      ) {
         startNewRound();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [currentRound, maxRounds, gameState, sequence.length]);

   // Check if game is complete (when all rounds are finished)
   useEffect(() => {
      if (currentRound >= maxRounds && gameState !== "tutorial") {
         // Score is calculated based on rounds completed, not from currentScore
         // Each round is worth (100 / maxRounds) points
         const finalScore = Math.round((currentRound / maxRounds) * 100);
         // Use setTimeout to avoid calling onScoreUpdate/onComplete during render
         setTimeout(() => {
            onScoreUpdate(finalScore);
            setTimeout(() => onComplete(finalScore), 1000);
         }, 0);
      }
   }, [currentRound, maxRounds, gameState, onScoreUpdate, onComplete]);

   // Play tone for a specific pad - each pad always has the same sound
   const playTone = useCallback(
      (freq: number, padIndex: number, volume: number = 0.3) => {
         if (!audioContextRef.current) return;

         // Ensure padIndex is valid (0-3) and use the corresponding frequency
         // Each button always plays its fixed sound: Button 1=220Hz, 2=330Hz, 3=440Hz, 4=550Hz
         const validPadIndex = Math.max(0, Math.min(3, padIndex));
         const toneFreq = tones[validPadIndex]; // Always use the same sound for each button

         const osc = audioContextRef.current.createOscillator();
         const gain = audioContextRef.current.createGain();
         osc.frequency.value = toneFreq; // Use the fixed frequency for this pad
         osc.connect(gain);
         gain.connect(audioContextRef.current.destination);

         gain.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
         gain.gain.exponentialRampToValueAtTime(
            0.01,
            audioContextRef.current.currentTime + 0.35
         );

         setActivePad(padIndex);
         osc.start();
         osc.stop(audioContextRef.current.currentTime + 0.35);

         setTimeout(() => {
            setActivePad(null);
         }, 350);
      },
      [tones]
   );

   const playSequence = useCallback(
      (seq: number[]) => {
         setIsPlayingSequence(true);
         setIsAcceptingInput(false);
         setGameState("listening");
         setPlayerSequence([]);

         seq.forEach((padIndex, i) => {
            setTimeout(() => {
               // Each padIndex (0-3) always plays its fixed sound from tones array
               // Button 1 (padIndex 0) = 220Hz, Button 2 (1) = 330Hz, Button 3 (2) = 440Hz, Button 4 (3) = 550Hz
               // Use higher volume (0.5) for automatic playback to match user click volume
               playTone(tones[padIndex], padIndex, 0.5);
            }, i * 600);
         });

         setTimeout(() => {
            setIsPlayingSequence(false);
            setIsAcceptingInput(true);
            setGameState("input");
         }, seq.length * 600 + 200);
      },
      [tones, playTone]
   );

   const startNewRound = useCallback(
      (round?: number) => {
         // Use provided round or current round
         const roundToUse = round !== undefined ? round : currentRound;

         // Reset player sequence first
         setPlayerSequence([]);
         inputLockRef.current = false;
         resolvedRoundRef.current = null;

         // Check if round sequences are configured in config
         const roundSequences = config.roundSequences;

         if (
            roundSequences &&
            Array.isArray(roundSequences) &&
            roundSequences[roundToUse] !== undefined
         ) {
            // Use configured sequence for this round
            // roundSequences is 0-indexed, so roundSequences[0] is for round 1
            // Convert button numbers (1-4) to padIndex (0-3)
            const configuredSequence = roundSequences[roundToUse].map(
               (btn: number) => {
                  // Ensure button number is valid (1-4) and convert to padIndex (0-3)
                  const buttonNum = Math.max(1, Math.min(4, btn));
                  return buttonNum - 1; // Convert to padIndex (0-3)
               }
            );

            // Reset sequence first, then set the new one
            setSequence([]);
            sequenceRef.current = [];
            setTimeout(() => {
               setSequence(configuredSequence);
               sequenceRef.current = configuredSequence;
               // Play sequence after state update
               setTimeout(() => {
                  playSequence(configuredSequence);
               }, 100);
            }, 50);
         } else {
            // Default behavior: add one random sound to previous sequence
            const newSequence = [
               ...sequenceRef.current,
               Math.floor(Math.random() * 4),
            ];
            setSequence(newSequence);
            sequenceRef.current = newSequence;
            // Play sequence after state update
            setTimeout(() => {
               playSequence(newSequence);
            }, 500);
         }

         setGameState("listening");
      },
      [playSequence, config, currentRound]
   );

   const handlePadClick = useCallback(
      (padIndex: number) => {
         if (!isAcceptingInput || isPlayingSequence) return;
         if (inputLockRef.current) return;

         // Each button (1-4) always plays its fixed sound: Button 1=220Hz, 2=330Hz, 3=440Hz, 4=550Hz
         // Use higher volume (0.6) when user clicks to ensure it's as loud as automatic playback
         playTone(tones[padIndex], padIndex, 0.6);

         setPlayerSequence((prevPlayerSeq) => {
            const newPlayerSequence = [...prevPlayerSeq, padIndex];
            const currentSequence = sequenceRef.current;
            const currentIndex = newPlayerSequence.length - 1;
            const roundIndex = roundRef.current;

            if (resolvedRoundRef.current === roundIndex) {
               return newPlayerSequence;
            }

            if (
               newPlayerSequence[currentIndex] !== currentSequence[currentIndex]
            ) {
               // Wrong answer - keep same round, allow retry without replaying sequence
               resolvedRoundRef.current = roundIndex;
               inputLockRef.current = true;
               setGameState("wrong");
               setIsAcceptingInput(false);
               setPlayerSequence([]);

               const roundScore = Math.round((roundIndex / maxRounds) * 100);
               setCurrentScore(roundScore);
               // Use setTimeout to avoid calling onScoreUpdate during render
               setTimeout(() => {
                  onScoreUpdate(roundScore);
               }, 0);

               // Allow retry without replaying sequence - user can click replay if needed
               setTimeout(() => {
                  setGameState("input");
                  inputLockRef.current = false;
                  resolvedRoundRef.current = null;
                  setPlayerSequence([]);
                  setIsAcceptingInput(true);
               }, 1500);

               return newPlayerSequence;
            }

            if (newPlayerSequence.length === currentSequence.length) {
               // Correct round
               resolvedRoundRef.current = roundIndex;
               inputLockRef.current = true;
               setGameState("correct");
               setIsAcceptingInput(false);

               setTimeout(() => {
                  setCurrentRound((prevRound) => {
                     const nextRound = prevRound + 1;
                     roundRef.current = nextRound;
                     const roundScore = Math.round(
                        (nextRound / maxRounds) * 100
                     );
                     setCurrentScore(roundScore);
                     // Use setTimeout to avoid calling onScoreUpdate during render
                     setTimeout(() => {
                        onScoreUpdate(roundScore);
                     }, 0);

                     if (nextRound < maxRounds) {
                        setSequence([]);
                        sequenceRef.current = [];
                        setTimeout(() => {
                           startNewRound(nextRound);
                        }, 100);
                     } else {
                        const finalScore = Math.round(
                           (nextRound / maxRounds) * 100
                        );
                        // Use setTimeout to avoid calling onScoreUpdate/onComplete during render
                        setTimeout(() => {
                           onScoreUpdate(finalScore);
                           setTimeout(() => onComplete(finalScore), 1000);
                        }, 0);
                     }
                     return nextRound;
                  });
               }, 800);
            }

            return newPlayerSequence;
         });
      },
      [
         isAcceptingInput,
         isPlayingSequence,
         tones,
         playTone,
         maxRounds,
         onScoreUpdate,
         onComplete,
         startNewRound,
      ]
   );

   // Keyboard controls
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         if (!isAcceptingInput || isPlayingSequence || gameState === "tutorial")
            return;

         const key = e.key;
         if (key >= "1" && key <= "4") {
            e.preventDefault();
            const padIndex = parseInt(key) - 1;
            handlePadClick(padIndex);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [isAcceptingInput, isPlayingSequence, gameState, handlePadClick]);

   // Check if user has shared or came from shared link (same as Card Flip)
   useEffect(() => {
      const gameKey = "play50games_shared_sound-memory";
      const EXPIRY_TIME = 15 * 60 * 1000; // 15 minutes

      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
         const expiryTime = Date.now() + EXPIRY_TIME;
         localStorage.setItem(
            gameKey,
            JSON.stringify({ shared: true, expiry: expiryTime })
         );
         setHasShared(true);

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
         const sharedData = localStorage.getItem(gameKey);
         if (sharedData) {
            try {
               const parsed = JSON.parse(sharedData);
               if (parsed.expiry && Date.now() < parsed.expiry) {
                  setHasShared(true);
                  if (parsed.share_id) {
                     setCurrentShareId(parsed.share_id);
                  }
               } else if (parsed.share_id && !parsed.expiry) {
                  // Keep share_id so we can poll for clicks after a refresh
                  setCurrentShareId(parsed.share_id);
               } else {
                  localStorage.removeItem(gameKey);
                  setHasShared(false);
                  setCurrentShareId(null);
               }
            } catch (e) {
               localStorage.removeItem(gameKey);
               setHasShared(false);
               setCurrentShareId(null);
            }
         }
      }

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, []);

   // Check if share has clicks
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         // Check expiry from localStorage before making API call
         const gameKey = "play50games_shared_sound-memory";
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
            if (status.has_clicks && !hasShared) {
               const gameKey = "play50games_shared_sound-memory";
               const EXPIRY_TIME = 15 * 60 * 1000;
               const expiryTime = Date.now() + EXPIRY_TIME;
               localStorage.setItem(
                  gameKey,
                  JSON.stringify({
                     shared: true,
                     expiry: expiryTime,
                     share_id: currentShareId,
                  })
               );
               setHasShared(true);
               setUnlimitedActivated(true);
               setTimeout(() => {
                  setUnlimitedActivated(false);
                  setHasShared(false);
                  localStorage.removeItem(gameKey);
               }, EXPIRY_TIME);

               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
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
               const gameKey = "play50games_shared_sound-memory";
               localStorage.removeItem(gameKey);
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
               }
               setCurrentShareId(null);
               setHasShared(false);
               setUnlimitedActivated(false);
            }
         }
      };

      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000);

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, hasShared]);

   // Replay sequence - with limit of 5 uses (unlimited if shared)
   const handleReplay = () => {
      if (sequence.length === 0 || isPlayingSequence) return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return; // No replays left

      setPlayerSequence([]);
      inputLockRef.current = false;
      resolvedRoundRef.current = null;
      playSequence(sequence);
      setReplaysUsed((prev) => prev + 1);
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
         await registerShare(shareId, "sound-memory");
         const gameKey = "play50games_shared_sound-memory";
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
               title: "Sound Memory Game",
               text: "Check out this awesome Sound Memory game!",
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
         {/* Header with Round and Score - Same as Match the Shapes */}
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
                  Score: {currentScore} / {maxRounds * 10}
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
                  {gameState === "listening" && "Listen carefully…"}
                  {gameState === "input" &&
                     (isMobile
                        ? "Your turn"
                        : "Your turn - Repeat the sequence")}
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
                        Wrong sequence
                     </>
                  )}
               </b>
               {gameState === "listening" && (
                  <p
                     style={{
                        margin: isMobile ? "6px 0 0" : "4px 0 0",
                        color: "var(--muted)",
                        fontSize: isMobile ? "0.8rem" : "0.875rem",
                     }}
                  >
                     Repeat the sounds in the same order
                  </p>
               )}
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
               {gameState === "listening" && "Playing"}
               {gameState === "input" && "Your Turn"}
               {gameState === "correct" && "Correct"}
               {gameState === "wrong" && "Wrong"}
            </div>
         </div>

         {/* Action Buttons: Replay, Share */}
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
                        ? "Link copied! Unlimited replay unlocks when someone opens it!"
                        : "Link copied! Unlimited replay will unlock when someone opens your link!"}
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
                        ? "🎉 Unlimited replay active for 15 minutes!"
                        : "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!"}
                  </span>
               </div>
            )}

            {/* Replay Button */}
            <button
               onClick={handleReplay}
               disabled={
                  sequence.length === 0 ||
                  isPlayingSequence ||
                  (maxReplays > 0 && replaysUsed >= maxReplays)
               }
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  padding: isMobile ? "10px 16px" : "10px 20px",
                  width: isMobile ? "100%" : "auto",
                  background:
                     maxReplays > 0 && replaysUsed >= maxReplays
                        ? "rgba(100, 100, 100, 0.2)"
                        : "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))",
                  border:
                     maxReplays > 0 && replaysUsed >= maxReplays
                        ? "1px solid rgba(100, 100, 100, 0.4)"
                        : "1px solid rgba(125, 211, 252, 0.6)",
                  borderRadius: "12px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor:
                     sequence.length === 0 ||
                     isPlayingSequence ||
                     (maxReplays > 0 && replaysUsed >= maxReplays)
                        ? "not-allowed"
                        : "pointer",
                  opacity:
                     sequence.length === 0 ||
                     isPlayingSequence ||
                     (maxReplays > 0 && replaysUsed >= maxReplays)
                        ? 0.5
                        : 1,
                  transition: "all 0.3s ease",
               }}
               onMouseEnter={(e) => {
                  if (
                     sequence.length > 0 &&
                     !isPlayingSequence &&
                     !(maxReplays > 0 && replaysUsed >= maxReplays)
                  ) {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(125, 211, 252, 0.3), rgba(125, 211, 252, 0.2))";
                     e.currentTarget.style.borderColor =
                        "rgba(125, 211, 252, 0.8)";
                     e.currentTarget.style.transform = "translateY(-2px)";
                     e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(125, 211, 252, 0.3)";
                  }
               }}
               onMouseLeave={(e) => {
                  if (
                     sequence.length > 0 &&
                     !isPlayingSequence &&
                     !(maxReplays > 0 && replaysUsed >= maxReplays)
                  ) {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))";
                     e.currentTarget.style.borderColor =
                        "rgba(125, 211, 252, 0.6)";
                     e.currentTarget.style.transform = "translateY(0)";
                     e.currentTarget.style.boxShadow = "none";
                  }
               }}
            >
               <ArrowPathRoundedSquareIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color:
                        maxReplays > 0 && replaysUsed >= maxReplays
                           ? "var(--muted)"
                           : "var(--accent)",
                  }}
               />
               <span>
                  {isMobile ? "" : "Replay "}
                  {maxReplays === 0
                     ? "(∞)"
                     : `(${maxReplays - replaysUsed}/${maxReplays})`}
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
               <span>{isMobile ? "Share" : "Share for Unlimited Replay"}</span>
            </button>
         </div>

         {/* Sound Pads */}
         <div
            style={{
               display: "grid",
               gridTemplateColumns: isMobile
                  ? "repeat(2, 1fr)"
                  : "repeat(4, 1fr)",
               gap: "5px",
               width: "100%",
               maxWidth: isMobile ? "100%" : "700px",
               margin: "0 auto",
               padding: isMobile ? "0 12px" : "0",
            }}
         >
            {[0, 1, 2, 3].map((padIndex) => {
               const buttonColor = getButtonColor(padIndex);
               return (
                  <button
                     key={padIndex}
                     onClick={() => handlePadClick(padIndex)}
                     disabled={!isAcceptingInput || isPlayingSequence}
                     style={{
                        borderRadius: isMobile ? "18px" : "20px",
                        aspectRatio: "1",
                        width: "100%",
                        height: "100%",
                        border:
                           activePad === padIndex
                              ? isMobile
                                 ? `3px solid ${buttonColor.border}`
                                 : `3px solid ${buttonColor.border}`
                              : isMobile
                              ? `2px solid ${buttonColor.border}`
                              : `2px solid ${buttonColor.border}`,
                        background:
                           activePad === padIndex
                              ? `linear-gradient(135deg, ${buttonColor.bg.replace(
                                   "0.25",
                                   "0.5"
                                )}, ${buttonColor.bg.replace("0.25", "0.4")})`
                              : buttonColor.bg,
                        boxShadow:
                           activePad === padIndex
                              ? isMobile
                                 ? `${buttonColor.shadow} 0px 0px 20px, ${buttonColor.shadow} 0px 0px 12px inset, ${buttonColor.shadow} 0px 0px 30px`
                                 : `${buttonColor.shadow} 0px 0px 25px, ${buttonColor.shadow} 0px 0px 15px inset, ${buttonColor.shadow} 0px 0px 35px`
                              : isMobile
                              ? `0 6px 12px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)`
                              : `0 8px 16px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)`,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: isMobile ? "5px" : "6px",
                        cursor:
                           isAcceptingInput && !isPlayingSequence
                              ? "pointer"
                              : "not-allowed",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        position: "relative",
                        transform:
                           activePad === padIndex
                              ? isMobile
                                 ? "scale(1.05)"
                                 : "scale(1.06)"
                              : "scale(1)",
                        opacity:
                           isAcceptingInput && !isPlayingSequence ? 1 : 0.65,
                        fontWeight: 900,
                        fontSize: isMobile ? "16px" : "20px",
                        color: "var(--text)",
                        zIndex: activePad === padIndex ? 10 : 1,
                        padding: isMobile ? "14px" : "16px",
                        touchAction: "manipulation",
                     }}
                     onMouseEnter={(e) => {
                        if (
                           isAcceptingInput &&
                           !isPlayingSequence &&
                           activePad !== padIndex
                        ) {
                           e.currentTarget.style.transform = "scale(1.03)";
                           e.currentTarget.style.borderColor =
                              buttonColor.border;
                           e.currentTarget.style.boxShadow = `0 12px 24px rgba(0, 0, 0, 0.25), 0 4px 8px rgba(0, 0, 0, 0.15)`;
                        }
                     }}
                     onMouseLeave={(e) => {
                        if (
                           isAcceptingInput &&
                           !isPlayingSequence &&
                           activePad !== padIndex
                        ) {
                           e.currentTarget.style.transform = "scale(1)";
                           e.currentTarget.style.boxShadow = `0 8px 16px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)`;
                        }
                     }}
                  >
                     <span
                        style={{
                           fontSize:
                              activePad === padIndex
                                 ? isMobile
                                    ? "2.4rem"
                                    : "2.8rem"
                                 : isMobile
                                 ? "2rem"
                                 : "2.2rem",
                           color:
                              activePad === padIndex
                                 ? buttonColor.border
                                 : buttonColor.border.replace("0.6", "0.85"),
                           fontWeight: 900,
                           textShadow:
                              activePad === padIndex
                                 ? isMobile
                                    ? `${buttonColor.shadow} 0px 0px 10px, ${buttonColor.shadow} 0px 0px 5px`
                                    : `${buttonColor.shadow} 0px 0px 12px, ${buttonColor.shadow} 0px 0px 6px`
                                 : "none",
                           transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                           lineHeight: "1",
                        }}
                     >
                        {padIndex + 1}
                     </span>
                     <span
                        style={{
                           fontSize: isMobile ? "0.7rem" : "0.8rem",
                           color: "var(--muted)",
                           fontWeight: 600,
                           letterSpacing: "0.5px",
                           textTransform: "uppercase",
                           marginTop: isMobile ? "2px" : "0",
                        }}
                     >
                        Key {padIndex + 1}
                     </span>
                  </button>
               );
            })}
         </div>
      </div>
   );
}

export default SoundMemory;