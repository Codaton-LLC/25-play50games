"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   ArrowPathIcon,
   ArrowPathRoundedSquareIcon,
   ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";
import {
   HandThumbUpIcon,
   PuzzlePieceIcon,
   GlobeAmericasIcon,
   FunnelIcon,
   CakeIcon,
   LockClosedIcon,
   ChevronDoubleRightIcon,
   ArrowUturnLeftIcon,
   BuildingOffice2Icon,
   HomeIcon,
   StarIcon,
   HeartIcon,
   CameraIcon,
   EyeIcon,
   KeyIcon,
   FingerPrintIcon,
   BellIcon,
   MoonIcon,
   GiftIcon,
   PlusIcon,
   CubeIcon,
   FireIcon,
   BoltIcon,
   SparklesIcon,
   TrophyIcon,
   ShieldCheckIcon,
   FlagIcon,
   BookmarkIcon,
   TagIcon,
   WrenchScrewdriverIcon,
   ScissorsIcon,
   PaintBrushIcon,
   MusicalNoteIcon,
   MicrophoneIcon,
   VideoCameraIcon,
   PhotoIcon,
   FilmIcon,
   DocumentIcon,
   FolderIcon,
   PaperClipIcon,
   MagnifyingGlassIcon,
   AdjustmentsHorizontalIcon,
   Cog6ToothIcon,
} from "@heroicons/react/24/outline";

interface MemoryGamesProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function MemoryGames({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: MemoryGamesProps) {
   const [currentGame, setCurrentGame] = useState<string>("");

   useEffect(() => {
      if (!isPlaying) return;

      // Get gameType from config
      // config should already contain gameType from gameConfig that was passed from GameEngine
      const gameType = config.gameType || "";

      // Debug: Log config to see what we're receiving
      if (!gameType) {
         console.warn("MemoryGames: No gameType found in config:", config);
      }

      if (gameType) {
         setCurrentGame(gameType);
      } else {
         // If no gameType found, default to card-flip for backward compatibility
         console.warn(
            "MemoryGames: Defaulting to card-flip because gameType is missing"
         );
         setCurrentGame("card-flip");
      }
   }, [isPlaying, config]);

   const gameComponents: Record<string, JSX.Element> = {
      "card-flip": (
         <CardFlipMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "sound-memory": (
         <SoundMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "emoji-memory": (
         <EmojiMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "number-recall": (
         <NumberRecall
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "image-recall": (
         <ImageRecall
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "path-memory": (
         <PathMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
      "word-memory": (
         <WordMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
      "face-memory": (
         <FaceMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
      "color-grid-memory": (
         <ColorGridMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
      "symbol-stack": (
         <SymbolStack
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
   };

   return (
      gameComponents[currentGame] || (
         <div>Memory game "{currentGame}" not found.</div>
      )
   );
}

// Card Flip Memory Game
function CardFlipMemory({
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
   const maxRounds = config.rounds || 5;
   // Grid sizes: round 1=2x2, 2=4x4, 3=6x6, 4=7x6, 5=8x8
   // Format: [width, height] or number (for square grids)
   const gridSizes = config.gridSizes || [
      [2, 2], // Round 1: 2x2
      [4, 4], // Round 2: 4x4
      [6, 6], // Round 3: 6x6
      [7, 6], // Round 4: 7x6
      [8, 8], // Round 5: 8x8
   ];

   const [currentRound, setCurrentRound] = useState(1);
   const [currentScore, setCurrentScore] = useState(0);
   const [gridWidth, setGridWidth] = useState(2);
   const [gridHeight, setGridHeight] = useState(2);
   const [cards, setCards] = useState<
      Array<{
         id: number;
         value: number | string;
         flipped: boolean;
         matched: boolean;
         icon?: string;
      }>
   >([]);
   const [flippedCards, setFlippedCards] = useState<number[]>([]);
   const [matches, setMatches] = useState(0);
   const [moves, setMoves] = useState(0);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [completionCalled, setCompletionCalled] = useState(false);
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [showHint, setShowHint] = useState(false);
   const [hintPair, setHintPair] = useState<[number, number] | null>(null);

   // Heroicons for rounds 2-5
   // Round 2: 4x4 = 8 pairs (8 icons), Round 3: 6x6 = 18 pairs (18 icons),
   // Round 4: 7x6 = 21 pairs (21 icons), Round 5: 8x8 = 32 pairs (32 icons)
   // Need at least 32 unique icons
   const heroicons = useMemo(
      () => [
         "HandThumbUp",
         "PuzzlePiece",
         "GlobeAmericas",
         "LightBulb",
         "Funnel",
         "Cake",
         "LockClosed",
         "ChevronDoubleRight",
         "ArrowUturnLeft",
         "BuildingOffice2",
         "Home",
         "Star",
         "Heart",
         "Camera",
         "Eye",
         "Key",
         "Fingerprint",
         "Bell",
         "Moon",
         "Gift",
         "Plus",
         "Cube",
         "Fire",
         "Bolt",
         "Sparkles",
         "Trophy",
         "ShieldCheck",
         "Flag",
         "Bookmark",
         "Tag",
         "WrenchScrewdriver",
         "Scissors",
         "PaintBrush",
         "MusicalNote",
         "Microphone",
         "VideoCamera",
         "Photo",
         "Film",
         "Document",
         "Folder",
         "PaperClip",
         "MagnifyingGlass",
         "AdjustmentsHorizontal",
         "Cog6Tooth",
      ],
      []
   );

   // Get grid size for current round
   const getGridSizeForRound = (round: number): [number, number] => {
      const index = Math.min(round - 1, gridSizes.length - 1);
      const size = gridSizes[index];
      if (Array.isArray(size)) {
         return [size[0], size[1]];
      }
      return [size, size]; // Square grid
   };

   // Get icon component by name
   const getIconComponent = (iconName: string, size: number = 40) => {
      const iconMap: Record<string, React.ComponentType<any>> = {
         HandThumbUp: HandThumbUpIcon,
         PuzzlePiece: PuzzlePieceIcon,
         GlobeAmericas: GlobeAmericasIcon,
         LightBulb: LightBulbIcon,
         Funnel: FunnelIcon,
         Cake: CakeIcon,
         LockClosed: LockClosedIcon,
         ChevronDoubleRight: ChevronDoubleRightIcon,
         ArrowUturnLeft: ArrowUturnLeftIcon,
         BuildingOffice2: BuildingOffice2Icon,
         Home: HomeIcon,
         Star: StarIcon,
         Heart: HeartIcon,
         Camera: CameraIcon,
         Eye: EyeIcon,
         Key: KeyIcon,
         Fingerprint: FingerPrintIcon,
         Bell: BellIcon,
         Moon: MoonIcon,
         Gift: GiftIcon,
         Plus: PlusIcon,
         Cube: CubeIcon,
         Fire: FireIcon,
         Bolt: BoltIcon,
         Sparkles: SparklesIcon,
         Trophy: TrophyIcon,
         ShieldCheck: ShieldCheckIcon,
         Flag: FlagIcon,
         Bookmark: BookmarkIcon,
         Tag: TagIcon,
         WrenchScrewdriver: WrenchScrewdriverIcon,
         Scissors: ScissorsIcon,
         PaintBrush: PaintBrushIcon,
         MusicalNote: MusicalNoteIcon,
         Microphone: MicrophoneIcon,
         VideoCamera: VideoCameraIcon,
         Photo: PhotoIcon,
         Film: FilmIcon,
         Document: DocumentIcon,
         Folder: FolderIcon,
         PaperClip: PaperClipIcon,
         MagnifyingGlass: MagnifyingGlassIcon,
         AdjustmentsHorizontal: AdjustmentsHorizontalIcon,
         Cog6Tooth: Cog6ToothIcon,
      };
      const IconComponent = iconMap[iconName];
      if (!IconComponent) return null;
      return (
         <IconComponent
            style={{ width: size, height: size, color: "var(--accent)" }}
         />
      );
   };

   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Check if user has shared or came from shared link (individual per game, 15 min expiry)
   useEffect(() => {
      const gameKey = "play50games_shared_card-flip";
      const EXPIRY_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

      // Check if came from shared link (has tracking parameter)
      // Note: Tracking is done in GameEngine.tsx immediately on page load
      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
         // Grant unlimited hints to the person who opened the link (with expiry)
         const expiryTime = Date.now() + EXPIRY_TIME;
         localStorage.setItem(
            gameKey,
            JSON.stringify({ shared: true, expiry: expiryTime })
         );
         setHasShared(true);

         // Remove tracking parameter from URL (clean URL)
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
         // Check if user has shared before (with expiry check)
         const sharedData = localStorage.getItem(gameKey);
         if (sharedData) {
            try {
               const parsed = JSON.parse(sharedData);
               if (parsed.expiry && Date.now() < parsed.expiry) {
                  // Still valid
                  setHasShared(true);
                  // Check if we have a share_id to monitor
                  if (parsed.share_id) {
                     setCurrentShareId(parsed.share_id);
                  }
               } else {
                  // Expired - remove it
                  localStorage.removeItem(gameKey);
                  setHasShared(false);
                  setCurrentShareId(null);
               }
            } catch (e) {
               // Invalid data - remove it
               localStorage.removeItem(gameKey);
               setHasShared(false);
               setCurrentShareId(null);
            }
         }
      }

      // Cleanup interval on unmount
      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, []);

   // Periodically check if share has clicks (every 5 seconds)
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         try {
            const status = await getShareStatus(currentShareId);
            if (status.has_clicks && !hasShared) {
               // Share has clicks - activate unlimited hints with expiry
               const gameKey = "play50games_shared_card-flip";
               const EXPIRY_TIME = 15 * 60 * 1000; // 15 minutes
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

               // Show success message that unlimited hints are now active
               setUnlimitedActivated(true);
               setTimeout(() => {
                  setUnlimitedActivated(false);
               }, 10000); // Show for 10 seconds

               // Stop checking once activated
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
            }
         } catch (error) {}
      };

      // Check immediately, then every 10 seconds (heartbeat)
      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000); // 10 seconds heartbeat

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, hasShared]);

   // Periodically check if expiry has passed and reset hints to normal
   useEffect(() => {
      const gameKey = "play50games_shared_card-flip";
      const checkExpiry = () => {
         const sharedData = localStorage.getItem(gameKey);
         if (sharedData) {
            try {
               const parsed = JSON.parse(sharedData);
               if (parsed.expiry && Date.now() >= parsed.expiry) {
                  // Expired - remove it and reset hints to normal
                  localStorage.removeItem(gameKey);
                  setHasShared(false);
                  setCurrentShareId(null);
               }
            } catch (e) {
               // Invalid data - remove it
               localStorage.removeItem(gameKey);
               setHasShared(false);
               setCurrentShareId(null);
            }
         }
      };

      // Check immediately and then every minute
      checkExpiry();
      const expiryCheckInterval = setInterval(checkExpiry, 60 * 1000); // Check every minute

      return () => {
         clearInterval(expiryCheckInterval);
      };
   }, [hasShared]);

   // Initialize cards for current round
   useEffect(() => {
      const [width, height] = getGridSizeForRound(currentRound);
      setGridWidth(width);
      setGridHeight(height);
      const totalCells = width * height;
      const pairs = totalCells / 2;
      initializeCards(width, height, pairs, currentRound);
      setCompletionCalled(false);
      setHintsUsed(0);
      setShowHint(false);
      setHintPair(null);
   }, [currentRound, heroicons]);

   const initializeCards = (
      width: number,
      height: number,
      pairs: number,
      round: number
   ) => {
      let cardValues: Array<number | string> = [];

      if (round === 1) {
         // Round 1: Use numbers
         for (let i = 1; i <= pairs; i++) {
            cardValues.push(i, i); // Each pair appears twice
         }
      } else {
         // Rounds 2-5: Use heroicons
         // Select random heroicons for this round
         const shuffledIcons = [...heroicons].sort(() => Math.random() - 0.5);
         const selectedIcons = shuffledIcons.slice(0, pairs);

         // Each icon appears twice
         for (const icon of selectedIcons) {
            cardValues.push(icon, icon);
         }
      }

      // Shuffle
      for (let i = cardValues.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [cardValues[i], cardValues[j]] = [cardValues[j], cardValues[i]];
      }

      const newCards = cardValues.map((value, index) => ({
         id: index,
         value,
         flipped: false,
         matched: false,
         icon: typeof value === "string" ? value : undefined,
      }));

      setCards(newCards);
      setMatches(0);
      setMoves(0);
      setFlippedCards([]);
      setFeedback(null);
   };

   // Check if round is complete
   useEffect(() => {
      const totalCells = gridWidth * gridHeight;
      const pairs = totalCells / 2;
      if (matches === pairs && pairs > 0 && !completionCalled) {
         setCompletionCalled(true);

         // Calculate round score: 20 points per round (5 rounds = 100 max)
         const roundScore = 20;
         const newScore = currentScore + roundScore;
         setCurrentScore(newScore);
         setFeedback("correct");

         onScoreUpdate(newScore);

         setTimeout(() => {
            setFeedback(null);
            if (currentRound >= maxRounds) {
               // Game complete
               onComplete(newScore);
            } else {
               // Next round
               setCurrentRound(currentRound + 1);
            }
         }, 1500);
      }
   }, [
      matches,
      gridWidth,
      gridHeight,
      currentRound,
      maxRounds,
      currentScore,
      completionCalled,
      onScoreUpdate,
      onComplete,
   ]);

   const handleCardClick = (cardId: number) => {
      const card = cards[cardId];
      if (
         card.flipped ||
         card.matched ||
         flippedCards.length >= 2 ||
         completionCalled
      )
         return;

      const newCards = [...cards];
      newCards[cardId].flipped = true;
      setCards(newCards);

      const newFlipped = [...flippedCards, cardId];
      setFlippedCards(newFlipped);

      if (newFlipped.length === 2) {
         setMoves(moves + 1);
         const [firstId, secondId] = newFlipped;
         const firstCard = newCards[firstId];
         const secondCard = newCards[secondId];

         if (firstCard.value === secondCard.value) {
            // Match!
            newCards[firstId].matched = true;
            newCards[secondId].matched = true;
            setCards(newCards);
            setMatches(matches + 1);
            setFlippedCards([]);
         } else {
            // No match, flip back (no error message, just close cards)
            setTimeout(() => {
               const resetCards = [...newCards];
               resetCards[firstId].flipped = false;
               resetCards[secondId].flipped = false;
               setCards(resetCards);
               setFlippedCards([]);
            }, 1000);
         }
      }
   };

   const totalCards = gridWidth * gridHeight;
   const pairs = totalCards / 2;
   const progress = (currentRound / maxRounds) * 100;

   // Max hints: 10 for Card Flip Memory, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

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
         await registerShare(shareId, "card-flip");
         // Store share_id to monitor for clicks (but DON'T activate hints yet)
         const gameKey = "play50games_shared_card-flip";
         // Only store share_id, don't set hasShared to true yet
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
         // Note: hasShared remains false until someone clicks the link
      } catch (error) {}
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
               title: "Card Flip Memory Game",
               text: "Check out this awesome Card Flip Memory game!",
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

   // Handle hint button click
   const handleHint = () => {
      if (maxHints > 0 && hintsUsed >= maxHints) return; // No hints left

      // Find an unmatched pair
      const unmatchedPairs: Array<[number, number]> = [];
      const valueMap = new Map<number | string, number[]>();

      cards.forEach((card, index) => {
         if (!card.matched) {
            if (!valueMap.has(card.value)) {
               valueMap.set(card.value, []);
            }
            valueMap.get(card.value)!.push(index);
         }
      });

      // Find pairs
      valueMap.forEach((indices) => {
         if (indices.length >= 2) {
            unmatchedPairs.push([indices[0], indices[1]]);
         }
      });

      if (unmatchedPairs.length > 0) {
         const randomPair =
            unmatchedPairs[Math.floor(Math.random() * unmatchedPairs.length)];
         setHintPair(randomPair);
         setShowHint(true);
         setHintsUsed(hintsUsed + 1);

         // Hide hint after 2 seconds
         setTimeout(() => {
            setShowHint(false);
            setHintPair(null);
         }, 2000);
      }
   };

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            padding: "24px",
            maxWidth: "1200px",
            margin: "0 auto",
         }}
      >
         {/* Header */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: "16px",
               padding: "20px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            {/* Share Section */}
            <div
               style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginBottom: "16px",
                  alignItems: "center",
               }}
            >
               {shareSuccess && (
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 16px",
                        background:
                           "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))",
                        border: "2px solid rgba(34, 197, 94, 0.6)",
                        borderRadius: "8px",
                        color: "var(--text)",
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        animation: "slideIn 0.3s ease",
                     }}
                  >
                     <CheckCircleIcon
                        style={{
                           width: 18,
                           height: 18,
                           color: "rgba(34, 197, 94, 0.9)",
                        }}
                     />
                     <span>
                        Link copied! Unlimited hints will unlock when someone
                        opens your link!
                     </span>
                  </div>
               )}
               {unlimitedActivated && (
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 16px",
                        background:
                           "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                        border: "2px solid rgba(59, 130, 246, 0.6)",
                        borderRadius: "8px",
                        color: "var(--text)",
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        animation: "slideIn 0.3s ease",
                     }}
                  >
                     <CheckCircleIcon
                        style={{
                           width: 18,
                           height: 18,
                           color: "rgba(59, 130, 246, 0.9)",
                        }}
                     />
                     <span>
                        🎉 Someone opened your link! Unlimited hints are now
                        active for 15 minutes!
                     </span>
                  </div>
               )}
               <button
                  onClick={handleShare}
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "8px",
                     padding: "10px 20px",
                     background:
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                     border: "2px solid rgba(59, 130, 246, 0.6)",
                     borderRadius: "12px",
                     color: "var(--text)",
                     fontSize: "0.95rem",
                     fontWeight: 600,
                     cursor: "pointer",
                     transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.2))";
                     e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.8)";
                     e.currentTarget.style.transform = "translateY(-2px)";
                     e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(59, 130, 246, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))";
                     e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.6)";
                     e.currentTarget.style.transform = "translateY(0)";
                     e.currentTarget.style.boxShadow = "none";
                  }}
               >
                  <ShareIcon
                     style={{
                        width: 20,
                        height: 20,
                        color: "rgba(59, 130, 246, 0.9)",
                     }}
                  />
                  <span>Share for Unlimited Replay</span>
               </button>
            </div>
            <div
               style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.875rem",
                  color: "var(--muted)",
                  fontWeight: 500,
                  marginBottom: "12px",
                  flexWrap: "wrap",
                  gap: "12px",
               }}
            >
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <svg
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                     fill="none"
                     viewBox="0 0 24 24"
                     stroke="currentColor"
                  >
                     <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                     />
                  </svg>
                  Round {currentRound} / {maxRounds}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <svg
                     style={{ width: 16, height: 16, color: "var(--ok)" }}
                     fill="none"
                     viewBox="0 0 24 24"
                     stroke="currentColor"
                  >
                     <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                     />
                  </svg>
                  Score: {currentScore} / {maxRounds * 20}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <svg
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
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
                  Grid: {gridWidth}x{gridHeight} | Matches: {matches}/{pairs} |
                  Moves: {moves}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <LightBulbIcon
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                  />
                  Hints:{" "}
                  {maxHints === 0 ? "∞" : `${maxHints - hintsUsed}/${maxHints}`}
               </span>
            </div>
            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: "8px",
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
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "4px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Game Board */}
         <div
            style={{
               width: "100%",
               display: "flex",
               flexDirection: "column",
               alignItems: "center",
               gap: "24px",
            }}
         >
            {/* Hint Button */}
            <button
               onClick={handleHint}
               disabled={maxHints > 0 && hintsUsed >= maxHints}
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 24px",
                  background:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "rgba(255, 255, 255, 0.05)"
                        : "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1))",
                  border: `2px solid ${
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "rgba(255, 255, 255, 0.1)"
                        : "rgba(251, 191, 36, 0.6)"
                  }`,
                  borderRadius: "12px",
                  color: "var(--text)",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  cursor:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "not-allowed"
                        : "pointer",
                  transition: "all 0.3s ease",
                  opacity: maxHints > 0 && hintsUsed >= maxHints ? 0.5 : 1,
               }}
               onMouseEnter={(e) => {
                  if (!(maxHints > 0 && hintsUsed >= maxHints)) {
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
                  if (!(maxHints > 0 && hintsUsed >= maxHints)) {
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
                     width: 20,
                     height: 20,
                     color: "rgba(251, 191, 36, 0.9)",
                  }}
               />
               <span>
                  Hint{" "}
                  {maxHints === 0
                     ? "(Unlimited)"
                     : `(${maxHints - hintsUsed} left)`}
               </span>
            </button>

            <div
               style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${gridWidth}, 1fr)`,
                  gap: "5px",
                  width: "100%",
                  padding: "20px",
                  background: "var(--card)",
                  border: "1px solid var(--stroke)",
                  borderRadius: "20px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
               }}
            >
               {cards.slice(0, totalCards).map((card) => {
                  const maxSize = Math.max(gridWidth, gridHeight);
                  const isNumber = typeof card.value === "number";
                  return (
                     <button
                        key={card.id}
                        onClick={() => handleCardClick(card.id)}
                        disabled={
                           card.flipped ||
                           card.matched ||
                           flippedCards.length >= 2 ||
                           completionCalled
                        }
                        style={{
                           width: "100%",
                           aspectRatio: "1",
                           borderRadius: "12px",
                           border:
                              showHint &&
                              hintPair &&
                              (card.id === hintPair[0] ||
                                 card.id === hintPair[1])
                                 ? "3px solid rgba(251, 191, 36, 0.8)"
                                 : "2px solid var(--stroke)",
                           background: card.matched
                              ? "rgba(134, 239, 172, 0.3)"
                              : showHint &&
                                hintPair &&
                                (card.id === hintPair[0] ||
                                   card.id === hintPair[1])
                              ? "rgba(251, 191, 36, 0.2)"
                              : card.flipped
                              ? "rgba(125, 211, 252, 0.2)"
                              : "rgba(15, 27, 51, 0.6)",
                           color: "var(--text)",
                           fontSize: isNumber
                              ? maxSize <= 4
                                 ? "2rem"
                                 : maxSize <= 6
                                 ? "1.5rem"
                                 : "1.25rem"
                              : undefined,
                           fontWeight: 700,
                           cursor:
                              card.flipped ||
                              card.matched ||
                              flippedCards.length >= 2 ||
                              completionCalled
                                 ? "not-allowed"
                                 : "pointer",
                           transition: "all 0.3s ease",
                           transform:
                              card.flipped || card.matched
                                 ? "scale(1)"
                                 : "scale(1)",
                           boxShadow:
                              showHint &&
                              hintPair &&
                              (card.id === hintPair[0] ||
                                 card.id === hintPair[1])
                                 ? "0 0 20px rgba(251, 191, 36, 0.6)"
                                 : card.matched
                                 ? "0 0 20px rgba(134, 239, 172, 0.5)"
                                 : card.flipped
                                 ? "0 0 15px rgba(125, 211, 252, 0.3)"
                                 : "0 4px 8px rgba(0, 0, 0, 0.2)",
                           position: "relative",
                           overflow: "hidden",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                        }}
                     >
                        {card.flipped || card.matched ? (
                           isNumber ? (
                              <span>{card.value}</span>
                           ) : (
                              getIconComponent(
                                 card.value as string,
                                 maxSize <= 4 ? 50 : maxSize <= 6 ? 40 : 35
                              )
                           )
                        ) : (
                           <span
                              style={{
                                 opacity: 0.6,
                                 fontSize:
                                    maxSize <= 4
                                       ? "2rem"
                                       : maxSize <= 6
                                       ? "1.5rem"
                                       : "1.25rem",
                              }}
                           >
                              ?
                           </span>
                        )}
                        {card.matched && (
                           <CheckCircleIcon
                              style={{
                                 position: "absolute",
                                 top: "4px",
                                 right: "4px",
                                 width: "20px",
                                 height: "20px",
                                 color: "var(--ok)",
                              }}
                           />
                        )}
                     </button>
                  );
               })}
            </div>

            {/* Feedback Message */}
            {feedback && (
               <div
                  style={{
                     padding: "16px 24px",
                     borderRadius: "12px",
                     fontSize: "1.1rem",
                     fontWeight: 600,
                     animation: "slideIn 0.3s ease-out",
                     background:
                        feedback === "correct"
                           ? "rgba(134, 239, 172, 0.2)"
                           : "rgba(252, 165, 165, 0.2)",
                     border: `1px solid ${
                        feedback === "correct" ? "var(--ok)" : "var(--warn)"
                     }`,
                     color:
                        feedback === "correct" ? "var(--ok)" : "var(--warn)",
                     display: "flex",
                     alignItems: "center",
                     gap: "10px",
                     width: "100%",
                     maxWidth: "600px",
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
         </div>
      </div>
   );
}

// Sound Memory Game (17) - Modern version with 10 levels
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
               // Wrong answer - keep same round and replay
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
               setTimeout(() => setUnlimitedActivated(false), 10000);

               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
            }
         } catch (error) {
            // Error checking share status
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

// Emoji Memory Game (18) - Modern version
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
               console.error("Error checking share status:", error);
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
               border: "1px solid var(--stroke)",
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
                  borderRadius: "12px",
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

// Number Recall Game (19) - Modern version
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
               console.error("Error checking share status:", error);
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
               border: "1px solid var(--stroke)",
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "24px" : "32px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            <div
               style={{
                  height: isMobile ? "120px" : "140px",
                  borderRadius: isMobile ? "16px" : "18px",
                  border: "1px solid var(--stroke)",
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
                        border: "1px solid var(--stroke)",
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
                        border: "1px solid var(--stroke)",
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
                  borderRadius: "12px",
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

// Image Recall Game (20)
// Image Recall Game (20) - Modern version
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
   const getGridSizeForRound = useCallback(
      (round: number): number => {
         // Default: rounds 1-4: 3x3, 5-8: 5x5, 9-10: 6x6
         if (round >= 1 && round <= 4) {
            return 3;
         } else if (round >= 5 && round <= 8) {
            return 5;
         } else {
            return 6;
         }
      },
      []
   );

   // Get grid size from config or calculate from round
   const gridSize = useMemo(() => {
      if (config.gridSizes && Array.isArray(config.gridSizes) && config.gridSizes.length > 0) {
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
         "🧩", "🚀", "🌙", "🍎", "🎵", "📦", "⭐", "🐶", "🏀",
         "🔥", "🎲", "📌", "🎨", "🎯", "🎪", "🎭", "🎬", "🎤",
         "🎧", "🎮", "🦄", "🐱", "🐼", "🦁", "🐯", "🐸", "🐰",
         "🐻", "🐨", "🐷", "🦊", "🐺", "🐝", "🦋", "🐢", "🐠"
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
               console.error("Error checking share status:", error);
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
   const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(null);

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
   }, [gameState, selectedCellIndex, gridSize, currentImages.length, userInput, handleCardClick]);

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
               gap: isMobile ? "8px" : gridSize <= 3 ? "14px" : gridSize <= 5 ? "10px" : "8px",
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
                        outlineOffset: selectedCellIndex === idx ? "2px" : "0",
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
                           ? gridSize <= 3 ? "36px" : gridSize <= 5 ? "28px" : "24px"
                           : gridSize <= 3 ? "42px" : gridSize <= 5 ? "32px" : "28px",
                        cursor: gameState === "input" && !isSelected ? "pointer" : "not-allowed",
                        userSelect: "none",
                        position: "relative",
                        overflow: "hidden",
                        transition: "all 0.15s",
                        opacity: isVisible ? 1 : 0.3,
                        transform:
                           gameState === "memorizing" && isInSequence
                              ? "scale(1.05)"
                              : "scale(1)",
                        zIndex: gameState === "memorizing" && isInSequence ? 5 : 1,
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

// Path Memory Game (21)
function PathMemory({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const rounds = config.rounds || 3;
   const [path, setPath] = useState<number[]>([]);
   const [playerPath, setPlayerPath] = useState<number[]>([]);
   const [showing, setShowing] = useState(true);
   const [round, setRound] = useState(0);
   const [score, setScore] = useState(0);
   const gridSize = 3;

   useEffect(() => {
      if (round >= rounds) {
         const finalScore = Math.round((score / rounds) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }
      startRound();
   }, [round, rounds, score, onScoreUpdate, onComplete]);

   const startRound = () => {
      const newPath = Array.from({ length: round + 3 }, () =>
         Math.floor(Math.random() * gridSize * gridSize)
      );
      setPath(newPath);
      setPlayerPath([]);
      setShowing(true);

      setTimeout(() => {
         setShowing(false);
      }, 3000);
   };

   useEffect(() => {
      if (!showing && playerPath.length === path.length) {
         const isCorrect = playerPath.every((cell, i) => cell === path[i]);
         if (isCorrect) {
            setScore(score + 33);
         }
         setRound(round + 1);
      }
   }, [playerPath, path, showing, round, score]);

   const handleCellClick = (index: number) => {
      if (showing) return;
      setPlayerPath([...playerPath, index]);
   };

   return (
      <div className="path-memory-game">
         <h3>Path Memory - Round {round + 1}</h3>
         {showing ? (
            <div>
               <p>Watch the path:</p>
               <div
                  className="path-grid"
                  style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
               >
                  {Array.from({ length: gridSize * gridSize }).map((_, i) => (
                     <div
                        key={i}
                        className={`path-cell ${
                           path.includes(i) ? "highlighted" : ""
                        }`}
                     >
                        {path.includes(i) && "●"}
                     </div>
                  ))}
               </div>
            </div>
         ) : (
            <div>
               <p>Recreate the path:</p>
               <div
                  className="path-grid"
                  style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
               >
                  {Array.from({ length: gridSize * gridSize }).map((_, i) => (
                     <button
                        key={i}
                        onClick={() => handleCellClick(i)}
                        className={`path-cell ${
                           playerPath.includes(i) ? "selected" : ""
                        }`}
                     >
                        {playerPath.includes(i) && "●"}
                     </button>
                  ))}
               </div>
            </div>
         )}
      </div>
   );
}

// Word Memory Game (22)
function WordMemory({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const words = config.words || 5;
   const [wordList, setWordList] = useState<string[]>([]);
   const [selectedWords, setSelectedWords] = useState<string[]>([]);
   const [showing, setShowing] = useState(true);
   const [score, setScore] = useState(0);

   useEffect(() => {
      const allWords = [
         "apple",
         "banana",
         "cherry",
         "date",
         "elderberry",
         "fig",
         "grape",
         "honeydew",
      ];
      const selected = allWords.slice(0, words).sort(() => Math.random() - 0.5);
      setWordList(selected);
      setSelectedWords([]);
      setShowing(true);

      setTimeout(() => {
         setShowing(false);
      }, 5000);
   }, []);

   useEffect(() => {
      if (!showing && selectedWords.length === words) {
         const isCorrect =
            selectedWords.every((word) => wordList.includes(word)) &&
            selectedWords.length === wordList.length;
         const finalScore = isCorrect ? 100 : 0;
         setScore(finalScore);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
      }
   }, [selectedWords, wordList, words, showing, onScoreUpdate, onComplete]);

   const handleWordClick = (word: string) => {
      if (showing || selectedWords.includes(word)) return;
      setSelectedWords([...selectedWords, word]);
   };

   return (
      <div className="word-memory-game">
         <h3>Word Memory</h3>
         {showing ? (
            <div>
               <p>Remember these words:</p>
               <div className="word-list">
                  {wordList.map((word, i) => (
                     <div key={i} className="word-item">
                        {word}
                     </div>
                  ))}
               </div>
            </div>
         ) : (
            <div>
               <p>Select the words you saw:</p>
               <div className="word-options">
                  {[
                     "apple",
                     "banana",
                     "cherry",
                     "date",
                     "elderberry",
                     "fig",
                     "grape",
                     "honeydew",
                  ].map((word) => (
                     <button
                        key={word}
                        onClick={() => handleWordClick(word)}
                        className={`word-btn ${
                           selectedWords.includes(word) ? "selected" : ""
                        }`}
                        disabled={selectedWords.includes(word)}
                     >
                        {word}
                     </button>
                  ))}
               </div>
            </div>
         )}
      </div>
   );
}

// Face Memory Game (23)
function FaceMemory({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const faces = config.faces || 4;
   const [facePairs, setFacePairs] = useState<
      Array<{ face: string; name: string }>
   >([]);
   const [selectedFaces, setSelectedFaces] = useState<string[]>([]);
   const [showing, setShowing] = useState(true);
   const [score, setScore] = useState(0);

   useEffect(() => {
      const names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank"];
      const faceEmojis = ["😀", "😃", "😄", "😁", "😆", "😅"];
      const pairs = Array.from({ length: faces }, (_, i) => ({
         face: faceEmojis[i],
         name: names[i],
      }));
      setFacePairs(pairs);
      setSelectedFaces([]);
      setShowing(true);

      setTimeout(() => {
         setShowing(false);
      }, 5000);
   }, []);

   useEffect(() => {
      if (!showing && selectedFaces.length === faces) {
         const isCorrect = selectedFaces.every(
            (name, i) => name === facePairs[i].name
         );
         const finalScore = isCorrect ? 100 : 0;
         setScore(finalScore);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
      }
   }, [selectedFaces, facePairs, faces, showing, onScoreUpdate, onComplete]);

   const handleNameSelect = (name: string, faceIndex: number) => {
      if (showing) return;
      const newSelected = [...selectedFaces];
      newSelected[faceIndex] = name;
      setSelectedFaces(newSelected);
   };

   return (
      <div className="face-memory-game">
         <h3>Face Memory</h3>
         {showing ? (
            <div>
               <p>Remember the faces and names:</p>
               <div className="face-list">
                  {facePairs.map((pair, i) => (
                     <div key={i} className="face-item">
                        <span className="face-emoji">{pair.face}</span>
                        <span className="face-name">{pair.name}</span>
                     </div>
                  ))}
               </div>
            </div>
         ) : (
            <div>
               <p>Match names to faces:</p>
               <div className="face-matching">
                  {facePairs.map((pair, i) => (
                     <div key={i} className="face-match-item">
                        <span className="face-emoji">{pair.face}</span>
                        <select
                           value={selectedFaces[i] || ""}
                           onChange={(e) => handleNameSelect(e.target.value, i)}
                        >
                           <option value="">Select name</option>
                           {facePairs.map((p, idx) => (
                              <option key={idx} value={p.name}>
                                 {p.name}
                              </option>
                           ))}
                        </select>
                     </div>
                  ))}
               </div>
            </div>
         )}
      </div>
   );
}

// Color Grid Memory Game (24)
function ColorGridMemory({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const gridSize = config.gridSize || 3;
   const rounds = config.rounds || 3;
   const [highlighted, setHighlighted] = useState<Set<number>>(new Set());
   const [selected, setSelected] = useState<Set<number>>(new Set());
   const [round, setRound] = useState(0);
   const [score, setScore] = useState(0);
   const [showing, setShowing] = useState(true);

   useEffect(() => {
      if (round >= rounds) {
         const finalScore = Math.round((score / rounds) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }
      startRound();
   }, [round, rounds, score, onScoreUpdate, onComplete]);

   const startRound = () => {
      const total = gridSize * gridSize;
      const highlightCount = Math.floor(total * 0.4);
      const newHighlighted = new Set<number>();
      while (newHighlighted.size < highlightCount) {
         newHighlighted.add(Math.floor(Math.random() * total));
      }
      setHighlighted(newHighlighted);
      setSelected(new Set());
      setShowing(true);

      setTimeout(() => {
         setShowing(false);
      }, 3000);
   };

   useEffect(() => {
      if (!showing && selected.size === highlighted.size) {
         const isCorrect = Array.from(selected).every((cell) =>
            highlighted.has(cell)
         );
         if (isCorrect) {
            setScore(score + 33);
         }
         setRound(round + 1);
      }
   }, [selected, highlighted, showing, round, score]);

   const handleCellClick = (index: number) => {
      if (showing) return;
      const newSelected = new Set(selected);
      if (newSelected.has(index)) {
         newSelected.delete(index);
      } else {
         newSelected.add(index);
      }
      setSelected(newSelected);
   };

   return (
      <div className="color-grid-memory-game">
         <h3>Color Grid Memory - Round {round + 1}</h3>
         <div
            className="color-grid"
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
         >
            {Array.from({ length: gridSize * gridSize }).map((_, i) => (
               <button
                  key={i}
                  onClick={() => handleCellClick(i)}
                  className={`color-cell ${
                     highlighted.has(i) && showing ? "highlighted" : ""
                  } ${selected.has(i) ? "selected" : ""}`}
                  disabled={showing}
               >
                  {selected.has(i) && (
                     <CheckCircleIcon style={{ width: 20, height: 20 }} />
                  )}
               </button>
            ))}
         </div>
      </div>
   );
}

// Symbol Stack Game (25)
function SymbolStack({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const rounds = config.rounds || 3;
   const [stack, setStack] = useState<string[]>([]);
   const [playerStack, setPlayerStack] = useState<string[]>([]);
   const [round, setRound] = useState(0);
   const [score, setScore] = useState(0);
   const [showing, setShowing] = useState(true);
   const symbols = ["★", "◆", "●", "▲", "■"];

   useEffect(() => {
      if (round >= rounds) {
         const finalScore = Math.round((score / rounds) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }
      startRound();
   }, [round, rounds, score, onScoreUpdate, onComplete]);

   const startRound = () => {
      const newStack = Array.from(
         { length: round + 3 },
         () => symbols[Math.floor(Math.random() * symbols.length)]
      );
      setStack(newStack);
      setPlayerStack([]);
      setShowing(true);

      setTimeout(() => {
         setShowing(false);
      }, 3000);
   };

   useEffect(() => {
      if (!showing && playerStack.length === stack.length) {
         const isCorrect = playerStack.every((sym, i) => sym === stack[i]);
         if (isCorrect) {
            setScore(score + 33);
         }
         setRound(round + 1);
      }
   }, [playerStack, stack, showing, round, score]);

   const handleSymbolClick = (symbol: string) => {
      if (showing) return;
      setPlayerStack([...playerStack, symbol]);
   };

   return (
      <div className="symbol-stack-game">
         <h3>Symbol Stack - Round {round + 1}</h3>
         {showing ? (
            <div>
               <p>Remember the stack order:</p>
               <div className="stack-display">
                  {stack.map((sym, i) => (
                     <div key={i} className="stack-item">
                        {sym}
                     </div>
                  ))}
               </div>
            </div>
         ) : (
            <div>
               <p>Rebuild the stack:</p>
               <div className="stack-display">
                  {playerStack.map((sym, i) => (
                     <div key={i} className="stack-item">
                        {sym}
                     </div>
                  ))}
               </div>
               <div className="symbol-options">
                  {symbols.map((sym) => (
                     <button
                        key={sym}
                        onClick={() => handleSymbolClick(sym)}
                        className="symbol-btn"
                     >
                        {sym}
                     </button>
                  ))}
               </div>
            </div>
         )}
      </div>
   );
}
