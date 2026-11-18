"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties } from "react";
import m from "./mobile.module.css";
import sm from "./SoundMemory.module.css";
import st from "./memoryStatus.module.css";
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

   // Sound / sequence timers: cleared when the game unmounts so no tone or state change fires after
   // the player leaves (the timing itself is unchanged). Score and completion timers stay plain.
   const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
   const later = useCallback((fn: () => void, ms: number) => {
      const t = setTimeout(() => {
         timersRef.current.delete(t);
         fn();
      }, ms);
      timersRef.current.add(t);
   }, []);
   useEffect(() => {
      const timers = timersRef.current;
      return () => {
         timers.forEach(clearTimeout);
         timers.clear();
      };
   }, []);

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

         later(() => {
            setActivePad(null);
         }, 350);
      },
      [tones, later]
   );

   const playSequence = useCallback(
      (seq: number[]) => {
         setIsPlayingSequence(true);
         setIsAcceptingInput(false);
         setGameState("listening");
         setPlayerSequence([]);

         seq.forEach((padIndex, i) => {
            later(() => {
               // Each padIndex (0-3) always plays its fixed sound from tones array
               // Button 1 (padIndex 0) = 220Hz, Button 2 (1) = 330Hz, Button 3 (2) = 440Hz, Button 4 (3) = 550Hz
               // Use higher volume (0.5) for automatic playback to match user click volume
               playTone(tones[padIndex], padIndex, 0.5);
            }, i * 600);
         });

         later(() => {
            setIsPlayingSequence(false);
            setIsAcceptingInput(true);
            setGameState("input");
         }, seq.length * 600 + 200);
      },
      [tones, playTone, later]
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
            later(() => {
               setSequence(configuredSequence);
               sequenceRef.current = configuredSequence;
               // Play sequence after state update
               later(() => {
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
            later(() => {
               playSequence(newSequence);
            }, 500);
         }

         setGameState("listening");
      },
      [playSequence, config, currentRound, later]
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
               later(() => {
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
         later,
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

   const replaysOut = maxReplays > 0 && replaysUsed >= maxReplays;
   const progress = ((currentRound + 1) / maxRounds) * 100;

   return (
      <div className={`${m.root} ${m.tight}`} style={{ maxWidth: "700px" }}>
         {/* Header with Round and Score */}
         <div className={m.panel}>
            <div className={m.stats}>
               <span className={m.stat}>
                  <ArrowPathIcon className={m.statIcon} />
                  Round <b>{currentRound + 1} / {maxRounds}</b>
               </span>
               <span className={m.stat}>
                  <TrophyIcon className={m.statIcon} />
                  Score <b>{currentScore} / {maxRounds * 10}</b>
               </span>
            </div>
            {/* Progress Bar */}
            <div className={m.progress}>
               <div
                  className={m.progressFill}
                  style={{ transform: `scaleX(${Math.min(1, progress / 100)})` }}
               />
            </div>
         </div>

         {/* Game State Display */}
         <div
            key={gameState}
            role="status"
            className={`${m.panel} ${st.status} ${
               gameState === "correct"
                  ? m.feedbackOk
                  : gameState === "wrong"
                  ? m.feedbackBad
                  : ""
            }`}
         >
            <div
               className={`${st.statusTitle} ${
                  gameState === "correct"
                     ? st.statusOk
                     : gameState === "wrong"
                     ? st.statusBad
                     : ""
               }`}
            >
               {gameState === "listening" && "Listen carefully..."}
               {gameState === "input" &&
                  (isMobile ? "Your turn" : "Your turn: repeat the sequence")}
               {gameState === "correct" && (
                  <>
                     <CheckCircleIcon className={st.statusIcon} />
                     Correct!
                  </>
               )}
               {gameState === "wrong" && (
                  <>
                     <XCircleIcon className={st.statusIcon} />
                     Wrong sequence
                  </>
               )}
            </div>
            {gameState === "listening" && (
               <p className={st.statusText}>Repeat the sounds in the same order</p>
            )}
            <span
               className={`${st.chip} ${
                  gameState === "correct"
                     ? st.chipOk
                     : gameState === "wrong"
                     ? st.chipBad
                     : ""
               }`}
            >
               {gameState === "listening" && "Playing"}
               {gameState === "input" && "Your Turn"}
               {gameState === "correct" && "Correct"}
               {gameState === "wrong" && "Wrong"}
            </span>
         </div>

         {/* Action Buttons: Replay, Share */}
         <div className={st.actions}>
            {/* Share Success Messages */}
            {shareSuccess && (
               <div className={`${m.note} ${m.noteOk} ${st.note}`}>
                  <CheckCircleIcon className={m.noteIcon} />
                  <span>
                     {isMobile
                        ? "Link copied! Unlimited replay unlocks when someone opens it!"
                        : "Link copied! Unlimited replay will unlock when someone opens your link!"}
                  </span>
               </div>
            )}
            {unlimitedActivated && (
               <div className={`${m.note} ${st.note}`}>
                  <CheckCircleIcon className={m.noteIcon} />
                  <span>
                     {isMobile
                        ? "Unlimited replay active for 15 minutes!"
                        : "Someone opened your link! Unlimited replay is now active for 15 minutes!"}
                  </span>
               </div>
            )}

            {/* Replay Button */}
            <button
               onClick={handleReplay}
               className={`${m.btn} ${m.pill}`}
               disabled={sequence.length === 0 || isPlayingSequence || replaysOut}
               aria-label="Replay the sequence"
            >
               <ArrowPathRoundedSquareIcon className={m.pillIcon} />
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
               className={`${m.btn} ${m.pill} ${m.shareBtn}`}
            >
               <ShareIcon className={m.pillIcon} />
               <span>{isMobile ? "Share" : "Share for Unlimited Replay"}</span>
            </button>
         </div>

         {/* Sound Pads */}
         <div
            className={`${m.board} ${sm.pads}`}
            style={{
               gridTemplateColumns: isMobile
                  ? "repeat(2, minmax(0, 1fr))"
                  : "repeat(4, minmax(0, 1fr))",
               maxWidth: isMobile
                  ? "min(100%, calc((100dvh - 140px) * 1), 300px)"
                  : "min(100%, calc((100dvh - 140px) * 4), 640px)",
            }}
         >
            {[0, 1, 2, 3].map((padIndex) => {
               const buttonColor = getButtonColor(padIndex);
               const lit = activePad === padIndex;
               return (
                  <button
                     key={padIndex}
                     onClick={() => handlePadClick(padIndex)}
                     disabled={!isAcceptingInput || isPlayingSequence}
                     aria-label={`Pad ${padIndex + 1}`}
                     className={`${m.card} ${sm.pad} ${lit ? sm.padActive : ""}`}
                     style={
                        {
                           "--pad-bg": buttonColor.bg,
                           "--pad-bg-on": buttonColor.bg.replace("0.25", "0.5"),
                           "--pad-ring": buttonColor.border.replace("0.6", "0.85"),
                           "--pad-glow": buttonColor.shadow,
                        } as CSSProperties
                     }
                  >
                     <span className={sm.padNum}>{padIndex + 1}</span>
                     <span className={sm.padKey}>Key {padIndex + 1}</span>
                  </button>
               );
            })}
         </div>
      </div>
   );
}

export default SoundMemory;
