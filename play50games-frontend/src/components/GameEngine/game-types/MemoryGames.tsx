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
         />
      ),
      "number-recall": (
         <NumberRecall
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
      "image-recall": (
         <ImageRecall
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
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

// Emoji Memory Game (18)
function EmojiMemory({
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
   const [emojis, setEmojis] = useState<string[]>([]);
   const [selected, setSelected] = useState<number[]>([]);
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
      const emojiList = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊"];
      const selectedEmojis = emojiList
         .slice(0, gridSize * gridSize)
         .sort(() => Math.random() - 0.5);
      setEmojis(selectedEmojis);
      setSelected([]);
      setShowing(true);

      setTimeout(() => {
         setShowing(false);
      }, 3000);
   };

   const handleCellClick = (index: number) => {
      if (showing) return;
      if (selected.includes(index)) return;

      const newSelected = [...selected, index];
      setSelected(newSelected);

      if (newSelected.length === emojis.length) {
         const isCorrect = newSelected.every(
            (idx, i) => emojis[idx] === emojis[i]
         );
         if (isCorrect) {
            setScore(score + 33);
         }
         setRound(round + 1);
      }
   };

   return (
      <div className="emoji-memory-game">
         <h3>Emoji Memory - Round {round + 1}</h3>
         <div
            className="emoji-grid"
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
         >
            {emojis.map((emoji, i) => (
               <button
                  key={i}
                  onClick={() => handleCellClick(i)}
                  className={`emoji-cell ${
                     selected.includes(i) ? "selected" : ""
                  }`}
                  disabled={showing || selected.includes(i)}
               >
                  {showing || selected.includes(i) ? emoji : "?"}
               </button>
            ))}
         </div>
      </div>
   );
}

// Number Recall Game (19)
function NumberRecall({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const digits = config.digits || 4;
   const rounds = config.rounds || 3;
   const [sequence, setSequence] = useState<string>("");
   const [input, setInput] = useState("");
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
      const newSequence = Array.from({ length: digits }, () =>
         Math.floor(Math.random() * 10)
      ).join("");
      setSequence(newSequence);
      setInput("");
      setShowing(true);

      setTimeout(() => {
         setShowing(false);
      }, 3000);
   };

   const handleSubmit = () => {
      if (input === sequence) {
         setScore(score + 33);
      }
      setRound(round + 1);
   };

   return (
      <div className="number-recall-game">
         <h3>Number Recall - Round {round + 1}</h3>
         {showing ? (
            <div>
               <p>Remember this number:</p>
               <div className="number-display">{sequence}</div>
            </div>
         ) : (
            <div>
               <p>Type the number you saw:</p>
               <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
                  maxLength={digits}
                  className="number-input"
               />
               <button onClick={handleSubmit}>Submit</button>
            </div>
         )}
      </div>
   );
}

// Image Recall Game (20)
function ImageRecall({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const images = config.images || 5;
   const [imageSequence, setImageSequence] = useState<number[]>([]);
   const [selectedOrder, setSelectedOrder] = useState<number[]>([]);
   const [showing, setShowing] = useState(true);
   const [score, setScore] = useState(0);

   useEffect(() => {
      const sequence = Array.from({ length: images }, (_, i) => i).sort(
         () => Math.random() - 0.5
      );
      setImageSequence(sequence);
      setSelectedOrder([]);
      setShowing(true);

      setTimeout(() => {
         setShowing(false);
      }, 5000);
   }, []);

   useEffect(() => {
      if (!showing && selectedOrder.length === images) {
         const isCorrect = selectedOrder.every(
            (img, i) => img === imageSequence[i]
         );
         const finalScore = isCorrect ? 100 : 0;
         setScore(finalScore);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
      }
   }, [
      selectedOrder,
      imageSequence,
      images,
      showing,
      onScoreUpdate,
      onComplete,
   ]);

   const handleImageSelect = (imgIndex: number) => {
      if (showing || selectedOrder.includes(imgIndex)) return;
      setSelectedOrder([...selectedOrder, imgIndex]);
   };

   return (
      <div className="image-recall-game">
         <h3>Image Recall</h3>
         {showing ? (
            <div>
               <p>Remember the order of these images:</p>
               <div className="image-sequence">
                  {imageSequence.map((img, i) => (
                     <div key={i} className="image-item">
                        Image {img + 1}
                     </div>
                  ))}
               </div>
            </div>
         ) : (
            <div>
               <p>Click images in the order you saw them:</p>
               <div className="image-options">
                  {Array.from({ length: images }).map((_, i) => (
                     <button
                        key={i}
                        onClick={() => handleImageSelect(i)}
                        className={`image-btn ${
                           selectedOrder.includes(i) ? "selected" : ""
                        }`}
                        disabled={selectedOrder.includes(i)}
                     >
                        Image {i + 1}
                     </button>
                  ))}
               </div>
            </div>
         )}
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
