"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   ArrowPathIcon,
   ArrowPathRoundedSquareIcon,
   TrophyIcon,
   ClockIcon,
   ShareIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";
import { TOUCH_SURFACE, useInstantPress, useRevealOnPlay, useViewport } from "./touch";
import { keyboardInset, playAreaMaxHeight } from "./TypingSprint.layout";
import fx from "./speedFx.module.css";
import styles from "./TypingSprint.module.css";

/** A pointerdown-activated button (Replay, Next Round): instant on touch, the follow-up click swallowed. */
function InstantButton({
   onPress,
   disabled = false,
   className,
   children,
}: {
   onPress: () => void;
   disabled?: boolean;
   className: string;
   children: React.ReactNode;
}) {
   const press = useInstantPress<HTMLButtonElement>(onPress, !disabled);
   return (
      <button type="button" className={className} disabled={disabled} {...press}>
         {children}
      </button>
   );
}

interface TypingSprintProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function TypingSprint({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: TypingSprintProps) {
   const maxLevels = config?.levels ? Number(config.levels) : 15;
   const defaultLevelDuration = 30; // Fallback duration if not specified in levelRequirements
   const levelRequirements = config?.levelRequirements || null;

   // Get duration for current level
   const getLevelDuration = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].duration || defaultLevelDuration;
         }
         return defaultLevelDuration;
      },
      [levelRequirements, defaultLevelDuration]
   );

   const [currentLevel, setCurrentLevel] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "playing" | "ready" | "failed" | "paused"
   >("playing");
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [timeLeft, setTimeLeft] = useState(() => {
      // Initialize with first level duration
      return getLevelDuration(0);
   });
   const [correctWords, setCorrectWords] = useState(0);
   const [wrongWords, setWrongWords] = useState(0);
   const [currentText, setCurrentText] = useState("");
   const [input, setInput] = useState("");
   const [wordIndex, setWordIndex] = useState(0);
   const viewport = useViewport();
   const isMobile = viewport.isMobile;
   // phones and tablets: the typing card leads, the OS keyboard is expected
   const isCompact = isMobile || viewport.isTablet;
   const rootRef = useRef<HTMLDivElement>(null);
   const typingCardRef = useRef<HTMLDivElement>(null);
   useRevealOnPlay(rootRef, isPlaying);
   // feedback animation beat (display only: replays the pop / shake per word or wrong character)
   const [fxBeat, setFxBeat] = useState<{ kind: "ok" | "bad"; n: number } | null>(null);
   // the on-screen keyboard band (px) and the visible height, from window.visualViewport
   const [keyboard, setKeyboard] = useState<{ inset: number; height: number }>({ inset: 0, height: 0 });

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   // the 15 s "link copied" timeouts, cleared on unmount so none fires on an unmounted game
   const shareMsgTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
   useEffect(() => {
      const timers = shareMsgTimersRef.current;
      return () => {
         timers.forEach((id) => clearTimeout(id));
         timers.clear();
      };
   }, []);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5;

   const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
   const levelScoreRef = useRef(0);
   const gameStateRef = useRef<"playing" | "ready" | "failed" | "paused">(
      "playing"
   );
   const prevWrongCountRef = useRef(0);
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<() => void>(() => {});
   const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   const inputRef = useRef<HTMLInputElement>(null);

   // Focus input when game is playing
   useEffect(() => {
      if (
         isPlaying &&
         gameState === "playing" &&
         !requirementsMet &&
         inputRef.current
      ) {
         // Small delay to ensure input is rendered
         const timer = setTimeout(() => {
            inputRef.current?.focus();
         }, 100);
         return () => clearTimeout(timer);
      }
   }, [isPlaying, gameState, requirementsMet]);

   // The on-screen keyboard: window.visualViewport shrinks when it opens. Cap the play area to the visible
   // height and bring the prompt + field back into the visible band on every resize (open, close, rotate).
   useEffect(() => {
      if (typeof window === "undefined" || !window.visualViewport) return;
      const vv = window.visualViewport;
      let raf = 0;
      const read = () => {
         const inset = keyboardInset(window.innerHeight, vv.height, vv.offsetTop);
         setKeyboard((prev) => {
            const height = Math.round(vv.height);
            return prev.inset === inset && prev.height === height ? prev : { inset, height };
         });
         return inset;
      };
      const onResize = () => {
         const inset = read();
         if (inset <= 0 || window.innerWidth >= 1024) return;
         const card = typingCardRef.current;
         if (!card || document.activeElement !== inputRef.current) return;
         window.cancelAnimationFrame(raf);
         raf = window.requestAnimationFrame(() => {
            try {
               card.scrollIntoView({ block: "start", behavior: "smooth" });
            } catch {
               card.scrollIntoView();
            }
         });
      };
      read();
      vv.addEventListener("resize", onResize);
      vv.addEventListener("scroll", read);
      return () => {
         window.cancelAnimationFrame(raf);
         vv.removeEventListener("resize", onResize);
         vv.removeEventListener("scroll", read);
      };
   }, []);

   useEffect(() => {
      if (!isPlaying) return;
      prevLevelRef.current = null;
      forceStartLevelRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      completionCalledRef.current = false;
      setCurrentLevel(0);
      setCurrentScore(0);
      setRequirementsMet(false);
      setGameState("playing");
   }, [isPlaying]);

   // Default word lists for different levels (fallback if not in config)
   const getDefaultWordsForLevel = useCallback((level: number): string[] => {
      switch (level) {
         case 0: // Level 1: Simple words (3-4 letters)
            return [
               "cat",
               "dog",
               "sun",
               "moon",
               "star",
               "tree",
               "bird",
               "fish",
               "book",
               "pen",
               "cup",
               "hat",
               "car",
               "bus",
               "key",
               "door",
            ];
         case 1: // Level 2: Medium words (5-6 letters)
            return [
               "apple",
               "banana",
               "orange",
               "purple",
               "yellow",
               "green",
               "computer",
               "keyboard",
               "window",
               "garden",
               "forest",
               "ocean",
               "planet",
               "camera",
               "guitar",
               "pencil",
            ];
         case 2: // Level 3: Longer words (7-8 letters)
            return [
               "beautiful",
               "wonderful",
               "adventure",
               "mountain",
               "elephant",
               "butterfly",
               "chocolate",
               "dinosaur",
               "hospital",
               "university",
               "keyboard",
               "computer",
               "internet",
               "software",
               "hardware",
            ];
         case 3: // Level 4: Words with special characters
            return [
               "don't",
               "can't",
               "won't",
               "it's",
               "we're",
               "they're",
               "you're",
               "I'm",
               "he's",
               "she's",
               "let's",
               "that's",
            ];
         case 4: // Level 5: Sentences
            return [
               "The quick brown fox jumps over the lazy dog",
               "Practice makes perfect in everything you do",
               "Learning new skills takes time and dedication",
               "Success comes to those who never give up",
            ];
         case 5: // Level 6: Numbers
            return [
               "12345",
               "67890",
               "246813579",
               "9876543210",
               "314159265",
               "271828182",
               "1000000",
               "9999999",
            ];
         case 6: // Level 7: Mixed case
            return [
               "BlueSky",
               "GreenTree",
               "HappyDay",
               "SunFlower",
               "MoonLight",
               "StarFish",
               "RainBow",
               "SnowBall",
               "FireWork",
               "WaterFall",
            ];
         case 7: // Level 8: No spaces (concatenated)
            return [
               "helloworld",
               "goodmorning",
               "thankyou",
               "welcomeback",
               "seeyoulater",
               "haveaniceday",
               "goodluck",
               "congratulations",
            ];
         case 8: // Level 9: Reverse typing (display reversed, type normal)
            return [
               "racecar",
               "level",
               "radar",
               "civic",
               "rotor",
               "deified",
               "repaper",
               "redder",
            ];
         case 9: // Level 10: Speed typing (very short words)
            return [
               "go",
               "hi",
               "ok",
               "no",
               "yes",
               "run",
               "fly",
               "jump",
               "fast",
               "quick",
               "rapid",
               "swift",
               "speed",
               "haste",
            ];
         case 10: // Level 11: Long sentences
            return [
               "The early bird catches the worm in the morning",
               "A picture is worth a thousand words they say",
               "Actions speak louder than words in real life",
               "Better late than never is a common saying",
            ];
         case 11: // Level 12: Special characters and symbols
            return [
               "hello@world.com",
               "user_name",
               "price$99",
               "score#1",
               "item&item",
               "test+test",
               "value=100",
               "key:value",
            ];
         case 12: // Level 13: Mixed numbers and letters
            return [
               "abc123",
               "test456",
               "user789",
               "code2024",
               "game50",
               "level15",
               "score100",
               "time60",
            ];
         case 13: // Level 14: Complex sentences
            return [
               "The quick brown fox jumps over the lazy dog in the park",
               "She sells seashells by the seashore every single day",
               "How much wood would a woodchuck chuck if he could",
               "Peter Piper picked a peck of pickled peppers today",
            ];
         case 14: // Level 15: Master challenge (very difficult)
            return [
               "Antidisestablishmentarianism",
               "Pneumonoultramicroscopicsilicovolcanoconiosis",
               "The quick brown fox jumps over the lazy dog quickly",
               "Bright Green Mountains Reflect Under Calm Blue Skies",
            ];
         default:
            return ["default", "word", "list"];
      }
   }, []);

   // Word lists for different levels - reads from config or uses defaults
   const getWordsForLevel = useCallback(
      (level: number): string[] => {
         // First check if words are provided in levelRequirements
         if (
            levelRequirements &&
            levelRequirements[level] &&
            levelRequirements[level].words
         ) {
            const words = levelRequirements[level].words;
            // Support both array and comma-separated string
            if (Array.isArray(words)) {
               return words;
            } else if (typeof words === "string") {
               return words
                  .split(",")
                  .map((w) => w.trim())
                  .filter((w) => w.length > 0);
            }
         }

         // Fallback to default words
         return getDefaultWordsForLevel(level);
      },
      [levelRequirements, getDefaultWordsForLevel]
   );

   // Get minimum required words for level
   const getMinCorrectWords = useCallback(() => {
      if (levelRequirements && levelRequirements[currentLevel]) {
         return (
            levelRequirements[currentLevel].minCorrectWords || 3 + currentLevel
         );
      }
      return 3 + currentLevel;
   }, [currentLevel, levelRequirements]);

   // Generate next word for current level
   const generateNextWord = useCallback(() => {
      const words = getWordsForLevel(currentLevel);
      const randomIndex = Math.floor(Math.random() * words.length);
      const word = words[randomIndex];

      // Special handling for level 9 (reverse typing)
      if (currentLevel === 8) {
         setCurrentText(word.split("").reverse().join(""));
      } else {
         setCurrentText(word);
      }

      setInput("");
      setWordIndex((prev) => prev + 1);
      prevWrongCountRef.current = 0;

      // Focus input
      setTimeout(() => {
         inputRef.current?.focus();
      }, 100);
   }, [currentLevel, getWordsForLevel]);

   // Start level
   const startLevel = useCallback(() => {
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }

      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      setCorrectWords(0);
      setWrongWords(0);
      setWordIndex(0);
      levelScoreRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      setGameState("playing");
      prevWrongCountRef.current = 0;
      setRequirementsMet(false);
      generateNextWord();

      // Start countdown
      countdownTimerRef.current = setInterval(() => {
         setTimeLeft((prev: number) => {
            if (requirementsMetRef.current) {
               return prev;
            }
            if (prev <= 1) {
               if (
                  gameStateRef.current !== "paused" &&
                  gameStateRef.current !== "ready"
               ) {
                  endLevel();
               }
               return 0;
            }
            return prev - 1;
         });
      }, 1000);
   }, [currentLevel, getLevelDuration, generateNextWord]);

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   const finalizeGame = useCallback(() => {
      if (completionCalledRef.current) return;
      completionCalledRef.current = true;

      const finalScore = 100;
      setCurrentScore(finalScore);
      setGameState("ready");
      onScoreUpdate(finalScore);

      setTimeout(() => {
         onComplete(finalScore);
      }, 1000);
   }, [onComplete, onScoreUpdate]);

   // Handle next round button click
   const handleNextRound = useCallback(() => {
      const completedLevels = currentLevel + 1;

      if (completedLevels >= maxLevels) {
         finalizeGame();
      } else {
         if (!requirementsMetRef.current) {
            const roundScore = Math.round(100 / maxLevels);
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            onScoreUpdate(newScore);
         }

         forceStartLevelRef.current = currentLevel + 1;
         setCurrentLevel((prev) => prev + 1);
         setRequirementsMet(false);
      }
   }, [currentLevel, maxLevels, onScoreUpdate, finalizeGame]);

   // Handle repeat round button click
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setRequirementsMet(false);
      requirementsMetRef.current = false;
      setGameState("playing");
      gameStateRef.current = "playing";
      setCorrectWords(0);
      setWrongWords(0);
      setWordIndex(0);
      prevWrongCountRef.current = 0;
      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }
      startLevel();
      setReplaysUsed((prev) => prev + 1);
   }, [
      gameState,
      maxReplays,
      replaysUsed,
      startLevel,
      currentLevel,
      getLevelDuration,
   ]);

   // Share functionality
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "typing-sprint");
         const gameKey = "play50games_shared_typing-sprint";
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
               title: "Typing Sprint Game",
               text: "Check out this awesome Typing Sprint game!",
               url: shareableLink,
            });
            setShareSuccess(true);
            shareMsgTimersRef.current.add(setTimeout(() => setShareSuccess(false), 15000));
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
         shareMsgTimersRef.current.add(setTimeout(() => setShareSuccess(false), 15000));
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
            shareMsgTimersRef.current.add(setTimeout(() => setShareSuccess(false), 15000));
         } catch (err) {
            // Failed to copy
         }
         document.body.removeChild(textArea);
      }
   };

   // Check if share has clicks
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         const gameKey = "play50games_shared_typing-sprint";
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
               }
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

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_typing-sprint";
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
         // Only set currentShareId if this is the share we created (exists in localStorage)
         // This prevents the person opening the link from activating unlimited for themselves
         const stored = localStorage.getItem(gameKey);
         if (stored) {
            try {
               const data = JSON.parse(stored);
               if (data.share_id === sharedBy) {
                  // This is our share - set it to check for clicks
                  setCurrentShareId(sharedBy);
               }
            } catch (error) {
               // Error parsing stored data
            }
         }
      }
   }, []);

   // End level
   const endLevel = useCallback(() => {
      if (requirementsMetRef.current) {
         return;
      }
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }

      const minCorrectWords = getMinCorrectWords();
      const levelPassed = correctWords >= minCorrectWords;

      if (levelPassed && !requirementsMet) {
         handleNextRound();
      } else if (!levelPassed) {
         setGameState("failed");
      }
   }, [correctWords, requirementsMet, getMinCorrectWords, handleNextRound]);

   useEffect(() => {
      if (!isPlaying || currentLevel >= maxLevels) {
         prevLevelRef.current = null;
         if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
         }
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         return;
      }

      if (prevLevelRef.current === currentLevel) {
         return;
      }

      prevLevelRef.current = currentLevel;
      const isForcedStart = forceStartLevelRef.current === currentLevel;
      if (isForcedStart) {
         forceStartLevelRef.current = null;
      }
      const delay = isForcedStart || currentLevel === 0 ? 0 : 1200;

      if (startTimeoutRef.current) {
         clearTimeout(startTimeoutRef.current);
      }

      if (delay === 0) {
         startLevelRef.current();
      } else {
         startTimeoutRef.current = setTimeout(() => {
            startLevelRef.current();
            startTimeoutRef.current = null;
         }, delay);
      }
   }, [isPlaying, currentLevel, maxLevels]);

   // Check if level requirements are met during gameplay
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const minCorrectWords = getMinCorrectWords();

      if (correctWords >= minCorrectWords) {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         setTimeLeft(0);

         requirementsMetRef.current = true;
         setRequirementsMet(true);
         setGameState("ready");
         setCurrentText("");

         if (currentLevel + 1 >= maxLevels) {
            finalizeGame();
         } else {
            const roundScore = Math.round(100 / maxLevels);
            const completedLevels = currentLevel + 1;
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            onScoreUpdate(newScore);
         }
      }
   }, [
      correctWords,
      gameState,
      requirementsMet,
      getMinCorrectWords,
      currentLevel,
      maxLevels,
      onScoreUpdate,
      finalizeGame,
   ]);

   useEffect(() => {
      requirementsMetRef.current = requirementsMet;
   }, [requirementsMet]);

   useEffect(() => {
      gameStateRef.current = gameState;
   }, [gameState]);

   // Handle input change and check for correct word
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet || !currentText) return;

      // Get the actual word to compare (for level 9, we need to reverse it back)
      let wordToCompare = currentText;
      if (currentLevel === 8) {
         // Level 9: Display is reversed, but input should be normal
         wordToCompare = currentText.split("").reverse().join("");
      }

      // Count wrong characters in current input
      if (input.length > 0) {
         let wrongCount = 0;
         for (let i = 0; i < input.length && i < wordToCompare.length; i++) {
            if (input[i] !== wordToCompare[i]) {
               wrongCount++;
            }
         }
         // If input is longer than expected, count extra characters as wrong
         if (input.length > wordToCompare.length) {
            wrongCount += input.length - wordToCompare.length;
         }

         // Update wrong words based on wrong characters
         // We track the previous wrong count to only increment new wrong characters
         if (wrongCount > prevWrongCountRef.current) {
            const newWrongChars = wrongCount - prevWrongCountRef.current;
            setWrongWords((prev) => prev + newWrongChars);
            prevWrongCountRef.current = wrongCount;
            setFxBeat((prev) => ({ kind: "bad", n: (prev?.n ?? 0) + 1 }));
         } else if (wrongCount < prevWrongCountRef.current) {
            // Input was reset or corrected, reset the counter
            prevWrongCountRef.current = wrongCount;
         }
      }

      if (input === wordToCompare) {
         setCorrectWords((prev) => prev + 1);
         setInput("");
         setFxBeat((prev) => ({ kind: "ok", n: (prev?.n ?? 0) + 1 }));
         // Reset wrong count when word is completed
         prevWrongCountRef.current = 0;
         setTimeout(() => {
            if (
               gameStateRef.current === "playing" &&
               !requirementsMetRef.current
            ) {
               generateNextWord();
            }
         }, 300);
      }
   }, [
      input,
      currentText,
      gameState,
      requirementsMet,
      currentLevel,
      generateNextWord,
   ]);

   // Handle Enter key for manual submit (space is allowed for typing sentences)
   const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (gameState !== "playing" || requirementsMet) return;

      if (e.key === "Enter") {
         e.preventDefault();

         let wordToCompare = currentText;
         if (currentLevel === 8) {
            wordToCompare = currentText.split("").reverse().join("");
         }

         // If input matches, it will be handled by the useEffect automatically
         // If input doesn't match and user presses Enter, count as wrong
         if (input !== wordToCompare && input.length > 0) {
            setWrongWords((prev) => prev + 1);
            setInput("");
         }
      }
      // Allow space to be typed normally (don't preventDefault for space)
   };

   const progress = ((currentLevel + 1) / maxLevels) * 100;

   // Render text with character highlighting
   const renderHighlightedText = useCallback(() => {
      if (!currentText) return null;

      let displayText = currentText;
      let isReverseLevel = currentLevel === 8;

      // For reverse level: currentText is already reversed for display
      // We need to compare with the normal word
      let normalText = isReverseLevel
         ? currentText.split("").reverse().join("")
         : currentText;

      return displayText.split("").map((char, index) => {
         let status: "correct" | "wrong" | "pending" = "pending";

         if (input && input.length > 0) {
            if (isReverseLevel) {
               // For reverse level: display is reversed, input is normal
               // Map display position to input position
               const inputIndex = displayText.length - 1 - index;
               if (
                  inputIndex >= 0 &&
                  inputIndex < input.length &&
                  inputIndex < normalText.length
               ) {
                  status =
                     input[inputIndex] === normalText[inputIndex]
                        ? "correct"
                        : "wrong";
               } else if (inputIndex < input.length) {
                  status = "wrong";
               }
            } else {
               // Normal level: compare directly
               if (index < input.length && index < normalText.length) {
                  status =
                     input[index] === normalText[index] ? "correct" : "wrong";
               } else if (index < input.length) {
                  status = "wrong";
               }
            }
         }

         // the character the player types next (display only; the reverse level types from the right)
         const typed = input ? input.length : 0;
         const isNext = isReverseLevel
            ? displayText.length - 1 - index === typed
            : index === typed;

         const className = [
            styles.char,
            status === "correct" ? styles.charOk : "",
            status === "wrong" ? styles.charBad : "",
            isNext && typed < normalText.length ? styles.charNext : "",
         ]
            .filter(Boolean)
            .join(" ");

         return (
            <span key={index} className={className}>
               {char === " " ? "\u00A0" : char}
            </span>
         );
      });
   }, [currentText, input, currentLevel]);

   // Get level description
   const getLevelDescription = (level: number): string => {
      const descriptions = [
         "Simple Words (3-4 letters)",
         "Medium Words (5-6 letters)",
         "Longer Words (7-8 letters)",
         "Words with Special Characters",
         "Sentences",
         "Numbers",
         "Mixed Case",
         "No Spaces (Concatenated)",
         "Reverse Typing",
         "Speed Typing (Short words)",
         "Long Sentences",
         "Special Characters & Symbols",
         "Mixed Numbers & Letters",
         "Complex Sentences",
         "Master Challenge (Very Difficult)",
      ];
      return descriptions[level] || "Typing Challenge";
   };

   const typingLocked = gameState !== "playing" || requirementsMet;
   const replayLocked = maxReplays > 0 && replaysUsed >= maxReplays;
   const cardFx =
      fxBeat && gameState === "playing"
         ? fxBeat.kind === "ok"
            ? `${fx.hitPop} ${fx.flashOk}`
            : `${fx.missShake} ${fx.flashBad}`
         : "";
   // while the keyboard is up on a phone / tablet, the play area is capped to the visible height
   const capped = isCompact ? playAreaMaxHeight(keyboard.height, keyboard.inset) : null;
   const hudIconSize = isMobile ? 14 : 16;

   // Focus the field from a tap anywhere on the typing card. The click (after touchend) is the gesture
   // Chrome / Safari accept for opening the keyboard; the mouse path keeps the old mousedown focus.
   const focusField = (e: React.MouseEvent<HTMLElement>) => {
      // The engine's .game-content wrapper focuses itself on every bubbled click (GameEngine
      // handleGameClick), which would close the keyboard right after it opened: stop the bubble here.
      e.stopPropagation();
      if (gameStateRef.current === "playing") {
         inputRef.current?.focus();
      }
   };
   const onCardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (gameStateRef.current !== "playing") return;
      if (e.target === inputRef.current) return;
      // No compatibility mousedown: the tap must not move focus to the engine's focusable wrapper or
      // start a selection. The click still follows and focuses the field (touch); mouse focuses now.
      e.preventDefault();
      if (e.pointerType === "mouse") {
         inputRef.current?.focus();
      }
   };

   return (
      <>
         <div
            ref={rootRef}
            className={`${styles.root} ${capped ? styles.rootCapped : ""}`}
            style={{
               ...TOUCH_SURFACE,
               maxHeight: capped ? `${capped}px` : undefined,
            }}
         >
            {/* Header Section: level, score, time, the counters, the level kind and progress in one card */}
            <div className={styles.hudCard}>
               <div className={styles.hudRow}>
                  <span className={styles.hudItem}>
                     <ArrowPathIcon
                        style={{
                           width: hudIconSize,
                           height: hudIconSize,
                           color: "var(--accent)",
                        }}
                     />
                     Level {currentLevel + 1} / {maxLevels}
                  </span>
                  <span className={styles.hudItem}>
                     <TrophyIcon
                        style={{
                           width: hudIconSize,
                           height: hudIconSize,
                           color: "var(--ok)",
                        }}
                     />
                     Score:{" "}
                     {currentLevel + 1 >= maxLevels && gameState === "ready"
                        ? 100
                        : currentScore}{" "}
                     / 100
                  </span>
                  <span className={styles.hudItem}>
                     <ClockIcon
                        style={{
                           width: hudIconSize,
                           height: hudIconSize,
                           color: "var(--accent)",
                        }}
                     />
                     Time: {timeLeft}s
                  </span>
               </div>
               <div className={styles.chipRow}>
                  <span className={`${styles.chip} ${styles.chipOk}`}>
                     Correct: {correctWords} / {getMinCorrectWords()}
                  </span>
                  <span className={`${styles.chip} ${styles.chipBad}`}>
                     Wrong: {wrongWords}
                  </span>
                  <span className={`${styles.chip} ${styles.chipLevel}`}>
                     {getLevelDescription(currentLevel)}
                  </span>
               </div>
               <div className={styles.progressTrack}>
                  <div
                     className={styles.progressFill}
                     style={{
                        transform: `scaleX(${Math.max(0, Math.min(1, progress / 100))})`,
                     }}
                  />
               </div>
            </div>

            {/* Typing Area: the prompt with the field right under it (first in the play area on touch) */}
            {gameState === "playing" && currentText && (
               <div
                  ref={typingCardRef}
                  key={fxBeat ? `fx-${fxBeat.n}` : "fx-0"}
                  className={`${styles.typingCard} ${cardFx}`}
                  onPointerDown={onCardPointerDown}
                  onClick={focusField}
               >
                  {fxBeat?.kind === "ok" && (
                     <span
                        className={`${fx.floatScore} ${styles.floatPlus}`}
                        aria-hidden="true"
                     >
                        +1
                     </span>
                  )}
                  <div className={styles.prompt} aria-live="off">
                     {renderHighlightedText()}
                  </div>
                  <input
                     ref={inputRef}
                     type="text"
                     value={input}
                     onChange={(e) => setInput(e.target.value)}
                     onKeyDown={handleKeyDown}
                     onClick={(e) => {
                        e.stopPropagation();
                        e.currentTarget.focus();
                     }}
                     onFocus={(e) => {
                        e.currentTarget.select();
                     }}
                     onBlur={() => {
                        // Desktop keeps the caret in the field. On touch the player may close the keyboard
                        // (or tap Replay / Share): a tap on the typing card brings it back.
                        if (gameStateRef.current === "playing" && !viewport.isTouch) {
                           setTimeout(() => inputRef.current?.focus(), 0);
                        }
                     }}
                     disabled={typingLocked}
                     className={styles.field}
                     style={{ cursor: typingLocked ? "not-allowed" : "text" }}
                     autoFocus
                     autoCapitalize="off"
                     autoCorrect="off"
                     spellCheck={false}
                     autoComplete="off"
                     enterKeyHint="go"
                     inputMode="text"
                     aria-label="Type the text shown above"
                     placeholder="Type here..."
                  />
                  <p className={styles.hint}>
                     Type the text above. It will auto-submit when correct,
                     or press Enter to reset if wrong.
                  </p>
               </div>
            )}

            {/* Ready for Next Round Message */}
            {gameState === "ready" && currentLevel + 1 < maxLevels && (
               <div className={`${styles.notice} ${fx.staggerIn}`}>
                  <div className={`${styles.noticeBadge} ${styles.noticeBadgeOk}`}>
                     <CheckCircleIcon style={{ width: 20, height: 20 }} />
                     Level {currentLevel + 1} Complete
                  </div>
                  <div className={styles.noticeText}>
                     Are you ready for next round?
                  </div>
                  <InstantButton
                     onPress={handleNextRound}
                     className={`${styles.noticeBtn} ${fx.pressable}`}
                  >
                     Next Round
                  </InstantButton>
               </div>
            )}

            {/* Game Complete Message */}
            {gameState === "ready" && currentLevel + 1 >= maxLevels && (
               <div className={`${styles.notice} ${fx.staggerIn}`}>
                  <div className={`${styles.noticeBadge} ${styles.noticeBadgeOk}`}>
                     <TrophyIcon style={{ width: 20, height: 20 }} />
                     Game Complete!
                  </div>
                  <div className={styles.noticeText} style={{ marginBottom: 0 }}>
                     All {maxLevels} levels completed!
                  </div>
               </div>
            )}

            {/* Level Failed Message */}
            {gameState === "failed" && (
               <div className={`${styles.notice} ${fx.staggerIn}`}>
                  <div className={`${styles.noticeBadge} ${styles.noticeBadgeBad}`}>
                     <XCircleIcon style={{ width: 20, height: 20 }} />
                     Level {currentLevel + 1} Failed
                  </div>
                  <div className={styles.noticeText} style={{ marginBottom: 0 }}>
                     Need: {getMinCorrectWords()} correct words
                  </div>
               </div>
            )}

            {/* Action Buttons: Replay, Share */}
            {(gameState === "playing" || gameState === "failed") && (
               <div className={styles.actionRow}>
                  {/* Share Success Message */}
                  {shareSuccess && !unlimitedActivated && (
                     <div className={`${styles.actionNote} ${styles.actionNoteOk} ${fx.fadeUp}`}>
                        Link copied! Unlimited replay will unlock when
                        someone opens your link!
                     </div>
                  )}

                  {/* Unlimited Activated Message */}
                  {unlimitedActivated && (
                     <div className={`${styles.actionNote} ${styles.actionNoteInfo} ${fx.fadeUp}`}>
                        <CheckCircleIcon
                           style={{
                              width: isMobile ? 16 : 18,
                              height: isMobile ? 16 : 18,
                           }}
                        />
                        <span>
                           🎉 Someone opened your link! Unlimited replay is
                           now active for 15 minutes!
                        </span>
                     </div>
                  )}

                  <InstantButton
                     onPress={handleReplay}
                     disabled={replayLocked}
                     className={`${styles.actionBtn} ${styles.actionReplay} ${fx.pressable}`}
                  >
                     <ArrowPathRoundedSquareIcon
                        style={{
                           width: isMobile ? 18 : 20,
                           height: isMobile ? 18 : 20,
                           color: replayLocked ? "var(--muted)" : "var(--accent)",
                        }}
                     />
                     <span>
                        {isMobile ? "Replay " : "Replay "}
                        {maxReplays === 0
                           ? "(∞)"
                           : `(${maxReplays - replaysUsed}/${maxReplays})`}
                     </span>
                  </InstantButton>

                  {/* Share stays on click: navigator.share and the clipboard need the activation a
                      touch pointerdown does not give (only touchend / click do). */}
                  <button
                     type="button"
                     onClick={handleShare}
                     className={`${styles.actionBtn} ${styles.actionShare} ${fx.pressable}`}
                  >
                     <ShareIcon
                        style={{
                           width: isMobile ? 18 : 20,
                           height: isMobile ? 18 : 20,
                        }}
                     />
                     <span>{isMobile ? "Share" : "Share for unlimited"}</span>
                  </button>
               </div>
            )}
         </div>
      </>
   );
}
