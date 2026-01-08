"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
   ArrowLeftIcon,
   ArrowRightIcon,
   ArrowUpIcon,
   ArrowDownIcon,
   StarIcon,
   HeartIcon,
   HomeIcon,
   KeyIcon,
   EyeIcon,
   CameraIcon,
   CubeIcon,
   BellIcon,
   PlusIcon,
   GiftIcon,
   MoonIcon,
   FingerPrintIcon,
   CheckCircleIcon,
   XCircleIcon,
   ArrowPathIcon,
   TrophyIcon,
   SparklesIcon,
   ScaleIcon,
} from "@heroicons/react/24/outline";

function MirrorMatch({
   config,
   currentRound = 1,
   maxRounds = 20,
   currentScore = 0,
   onScoreUpdate,
   onComplete,
   onRoundComplete,
}: {
   config: Record<string, any>;
   currentRound?: number;
   maxRounds?: number;
   currentScore?: number;
   onScoreUpdate: (score: number) => void;
   onComplete?: (finalScore?: number) => void;
   onRoundComplete?: () => void;
}) {
   const rounds = config?.rounds || maxRounds;
   const round = Math.min(currentRound, rounds);
   const score = currentScore;

   // Default shapes - SVG shapes with asymmetric details (from mirror-match/index.html)
   // All shapes have asymmetric details to make mirror transformations clearly visible
   const defaultShapes = [
      "WrenchWithJaw", // Wrench with asymmetric jaw and dot
      "LightningBolt", // Lightning bolt with offset cut and dot
      "CameraOffCenter", // Camera with lens off-center and dot
      "FlagOnPole", // Flag on pole (flag only one side) with dot
      "SpiralCurl", // Spiral with asymmetric curl and dot
      "GearAsymmetric", // Gear with extra tooth only on one side and notch
      "CircuitBranch", // Circuit with asymmetric branch and offset nodes
      "KeyAsymmetric", // Key with asymmetric teeth lengths
      "ShieldOffCenter", // Shield with emblem shifted off center
      "BirdAsymmetric", // Bird with asymmetric wing and eye
      "AnchorOffset", // Anchor with offset fluke and dot
      "PaperclipUneven", // Paperclip with uneven loop and dot
      "RocketOneFin", // Rocket with fin only one side
      "PuzzleMissingTab", // Puzzle piece with missing tab and dot
   ];

   // Get shapes from config or use defaults
   const availableShapes = useMemo(() => {
      return config?.shapes || defaultShapes;
   }, [config?.shapes]);

   // Get mirror types from config
   const mirrorTypes = useMemo(() => {
      return config?.mirrorTypes || ["horizontal", "vertical"];
   }, [config?.mirrorTypes]);

   // Time limit comes from GameEngine (game.time_limit from backend), not from config
   // Timer is managed by GameEngine, we just display it
   // No local timer needed - GameEngine handles it

   // Get number of options from config (should be 3 for mirror types)
   const optionsCount = config?.optionsCount || 3;

   const [mainShape, setMainShape] = useState<string>("");
   const [mirrorType, setMirrorType] = useState<string>("horizontal");
   const [options, setOptions] = useState<
      Array<{
         shape: string;
         isMirror: boolean;
         mirrorType: string;
         optionKey: string;
      }>
   >([]);
   const [selected, setSelected] = useState<number | null>(null);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isRoundComplete, setIsRoundComplete] = useState(false);
   const completionCalledRef = useRef(false);
   const onScoreUpdateRef = useRef(onScoreUpdate);
   const onCompleteRef = useRef(onComplete);
   const onRoundCompleteRef = useRef(onRoundComplete);
   const handleSelectRef = useRef<(index: number) => void>();

   // Update refs when callbacks change
   useEffect(() => {
      onScoreUpdateRef.current = onScoreUpdate;
      onCompleteRef.current = onComplete;
      onRoundCompleteRef.current = onRoundComplete;
   }, [onScoreUpdate, onComplete, onRoundComplete]);

   // Timer is managed by GameEngine (same as match the shapes)
   // No local timer needed - GameEngine handles time_limit from backend

   // SVG shapes with asymmetric details (inspired by mirror-match/index.html)
   const getSVGShape = useCallback((shapeName: string, size: number = 80) => {
      const strokeColor = "rgba(232, 238, 252, 0.92)";
      const strokeWidth = size / 8;
      const viewBox = "0 0 100 100";

      const shapes: Record<string, JSX.Element> = {
         ArrowWithNotch: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M20 50 H62"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M62 50 L50 38"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M62 50 L50 62"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M28 42 L20 50 L28 58"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
            </svg>
         ),
         LShapeWithDot: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M28 20 V72 H72"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="62" cy="32" r="6" fill={strokeColor} />
            </svg>
         ),
         ZigzagWithTail: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M22 30 L50 30 L30 55 L78 55"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M78 55 L70 70"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
            </svg>
         ),
         TriangleWithCut: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M22 72 L52 22 L78 72 Z"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M38 66 L30 58"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
            </svg>
         ),
         HookWithCircle: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M65 22 V52 C65 70 50 78 38 70 C28 63 28 50 40 46"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="68" cy="24" r="5" fill={strokeColor} />
            </svg>
         ),
         GearWithNotch: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <circle
                  cx="50"
                  cy="50"
                  r="28"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle
                  cx="50"
                  cy="50"
                  r="10"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M50 10 V22"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M50 78 V90"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M10 50 H22"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M78 50 H90"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M68 18 L60 26"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
            </svg>
         ),
         CircuitWithNodes: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M18 18 H52 V52 H82"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="18" cy="18" r="5" fill={strokeColor} />
               <circle cx="52" cy="52" r="5" fill={strokeColor} />
               <circle cx="82" cy="52" r="5" fill={strokeColor} />
            </svg>
         ),
         KeyWithTeeth: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <circle
                  cx="32"
                  cy="40"
                  r="14"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M46 40 H78 V48 H70 V56 H62"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="32" cy="40" r="4" fill={strokeColor} />
            </svg>
         ),
         ShieldWithEmblem: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M22 22 L50 14 L78 22 V54 C78 68 60 80 50 86 C40 80 22 68 22 54 Z"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M50 30 V64"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
            </svg>
         ),
         AbstractBird: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M20 60 C40 20 70 20 80 40"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M20 60 L50 50 L42 72"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="72" cy="38" r="4" fill={strokeColor} />
            </svg>
         ),
         WrenchWithJaw: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M20 60 L52 28"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M52 28 L66 42"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M66 42 L60 48"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="22" cy="62" r="4" fill={strokeColor} />
            </svg>
         ),
         LightningBolt: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M48 10 L28 54 H48 L34 90 L72 42 H52"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="60" cy="36" r="3" fill={strokeColor} />
            </svg>
         ),
         CameraOffCenter: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <rect
                  x="20"
                  y="34"
                  width="60"
                  height="36"
                  rx="6"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
               />
               <circle
                  cx="56"
                  cy="52"
                  r="10"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
               />
               <circle cx="32" cy="40" r="4" fill={strokeColor} />
            </svg>
         ),
         FlagOnPole: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M28 18 V82"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M28 20 H66 L58 36 L66 52 H28"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="28" cy="18" r="3" fill={strokeColor} />
            </svg>
         ),
         SpiralCurl: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M50 20 C70 20 78 36 70 50 C62 64 40 64 40 48 C40 34 58 34 58 46"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="58" cy="46" r="3" fill={strokeColor} />
            </svg>
         ),
         GearAsymmetric: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <circle
                  cx="50"
                  cy="50"
                  r="26"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
               />
               <circle
                  cx="50"
                  cy="50"
                  r="9"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
               />
               <path
                  d="M50 8 V20"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M80 50 H92"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M50 80 V92"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M8 50 H20"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M66 16 L58 26"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="60" cy="64" r="3" fill={strokeColor} />
            </svg>
         ),
         CircuitBranch: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M18 22 H56 V46 H82"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M56 46 V70"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="18" cy="22" r="5" fill={strokeColor} />
               <circle cx="56" cy="70" r="4" fill={strokeColor} />
               <circle cx="82" cy="46" r="6" fill={strokeColor} />
            </svg>
         ),
         KeyAsymmetric: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <circle
                  cx="30"
                  cy="42"
                  r="14"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
               />
               <circle cx="30" cy="42" r="4" fill={strokeColor} />
               <path
                  d="M44 42 H78 V50 H70 V60 H58"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M58 60 H52"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
            </svg>
         ),
         ShieldOffCenter: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M22 22 L50 14 L78 22 V54 C78 68 60 82 50 88 C40 82 22 68 22 54 Z"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M56 32 V66"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="46" cy="38" r="3" fill={strokeColor} />
            </svg>
         ),
         BirdAsymmetric: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M18 62 C42 22 72 26 82 44"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M18 62 L54 50 L40 78"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="74" cy="40" r="4" fill={strokeColor} />
            </svg>
         ),
         AnchorOffset: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M50 10 V64"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M26 58 C30 72 40 80 50 80"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M74 58 C70 72 58 78 52 78"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle
                  cx="50"
                  cy="20"
                  r="6"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
               />
               <circle cx="44" cy="76" r="3" fill={strokeColor} />
            </svg>
         ),
         PaperclipUneven: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M36 26 C22 26 22 44 36 44 H64 C78 44 78 64 64 64 H42"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="60" cy="60" r="3" fill={strokeColor} />
            </svg>
         ),
         RocketOneFin: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M50 14 C66 28 66 60 50 86 C34 60 34 28 50 14 Z"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <path
                  d="M50 56 L64 64"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle
                  cx="50"
                  cy="38"
                  r="6"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
               />
            </svg>
         ),
         PuzzleMissingTab: (
            <svg
               viewBox={viewBox}
               width={size}
               height={size}
               aria-hidden="true"
            >
               <path
                  d="M24 24 H44 C44 18 56 18 56 24 H76 V44 C82 44 82 56 76 56 V76 H56 C56 82 44 82 44 76 H24 Z"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
               />
               <circle cx="64" cy="64" r="3" fill={strokeColor} />
            </svg>
         ),
      };

      // Fallback to Heroicons for other shapes
      const iconMap: Record<string, any> = {
         ArrowLeft: ArrowLeftIcon,
         ArrowRight: ArrowRightIcon,
         ArrowUp: ArrowUpIcon,
         ArrowDown: ArrowDownIcon,
         Star: StarIcon,
         Heart: HeartIcon,
         Home: HomeIcon,
         Key: KeyIcon,
         Eye: EyeIcon,
         Camera: CameraIcon,
         Cube: CubeIcon,
         Bell: BellIcon,
         Plus: PlusIcon,
         Gift: GiftIcon,
         Moon: MoonIcon,
         FingerPrint: FingerPrintIcon,
      };

      // Return SVG shape if available, otherwise Heroicon
      if (shapes[shapeName]) {
         return shapes[shapeName];
      }

      const IconComponent = iconMap[shapeName];
      if (IconComponent) {
         return <IconComponent style={{ width: size, height: size }} />;
      }

      return null;
   }, []);

   // Apply mirror transformation
   const applyMirror = useCallback(
      (
         shapeName: string,
         mirrorType: string
      ): { shape: string; transform: string } => {
         let transform = "";
         if (mirrorType === "horizontal") {
            transform = "scaleX(-1)";
         } else if (mirrorType === "vertical") {
            transform = "scaleY(-1)";
         } else if (mirrorType === "diagonal") {
            transform = "scaleX(-1) scaleY(-1)";
         }
         return { shape: shapeName, transform };
      },
      []
   );

   // Initialize round
   useEffect(() => {
      // Reset state
      setSelected(null);
      setFeedback(null);
      setIsRoundComplete(false);
      completionCalledRef.current = false;

      // Select random shape
      const randomShape =
         availableShapes[Math.floor(Math.random() * availableShapes.length)];

      // Select random mirror type
      const randomMirrorType =
         mirrorTypes[Math.floor(Math.random() * mirrorTypes.length)];

      setMainShape(randomShape);
      setMirrorType(randomMirrorType);

      // Create options - only 3 mirror types (no original decoy)
      // Build 3 options: horizontal, vertical, diagonal
      const newOptions: Array<{
         shape: string;
         isMirror: boolean;
         mirrorType: string;
         optionKey: string; // 'horizontal', 'vertical', or 'diagonal'
      }> = [];

      // Add all mirror types (horizontal, vertical, diagonal)
      mirrorTypes.forEach((mirrorType: string) => {
         newOptions.push({
            shape: randomShape,
            isMirror: true,
            mirrorType: mirrorType,
            optionKey: mirrorType,
         });
      });

      // Shuffle options (same as index.html)
      for (let i = newOptions.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [newOptions[i], newOptions[j]] = [newOptions[j], newOptions[i]];
      }

      setOptions(newOptions);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [round, availableShapes, mirrorTypes, optionsCount]);

   const handleSelect = useCallback(
      (index: number, isMirror?: boolean) => {
         if (isRoundComplete) return;

         // If index is -1, it means time's up (wrong answer)
         if (index === -1) {
            setSelected(null);
            setFeedback("wrong");
            setIsRoundComplete(true);

            // Wrong answer - move to next round after 1 second
            setTimeout(() => {
               if (round >= rounds) {
                  // Game complete
                  if (!completionCalledRef.current) {
                     completionCalledRef.current = true;
                     const finalScore = Math.round((score / rounds) * 100);
                     onScoreUpdateRef.current(finalScore);
                     setTimeout(() => {
                        onCompleteRef.current?.(finalScore);
                     }, 1000);
                  }
               } else {
                  if (onRoundCompleteRef.current) {
                     onRoundCompleteRef.current();
                  }
               }
               setFeedback(null);
            }, 1000);
            return;
         }

         setSelected(index);
         const selectedOption = options[index];
         if (!selectedOption) return;

         // Check if selected option matches the requested mirror type (same logic as index.html)
         // The correct answer is the one where optionKey matches the requested mirrorType
         const isCorrect = selectedOption.optionKey === mirrorType;

         setFeedback(isCorrect ? "correct" : "wrong");
         setIsRoundComplete(true);

         if (isCorrect) {
            const roundScore = 5;
            const newScore = score + roundScore;
            onScoreUpdateRef.current(roundScore);

            // Move to next round after 1.5 seconds
            setTimeout(() => {
               if (round >= rounds) {
                  // Game complete
                  if (!completionCalledRef.current) {
                     completionCalledRef.current = true;
                     const finalScore = Math.round((newScore / rounds) * 100);
                     onScoreUpdateRef.current(finalScore);
                     setTimeout(() => {
                        onCompleteRef.current?.(finalScore);
                     }, 1000);
                  }
               } else {
                  if (onRoundCompleteRef.current) {
                     onRoundCompleteRef.current();
                  }
               }
               setFeedback(null);
            }, 1500);
         } else {
            // Wrong answer - move to next round after 1 second
            setTimeout(() => {
               if (round >= rounds) {
                  // Game complete
                  if (!completionCalledRef.current) {
                     completionCalledRef.current = true;
                     const finalScore = Math.round((score / rounds) * 100);
                     onScoreUpdateRef.current(finalScore);
                     setTimeout(() => {
                        onCompleteRef.current?.(finalScore);
                     }, 1000);
                  }
               } else {
                  if (onRoundCompleteRef.current) {
                     onRoundCompleteRef.current();
                  }
               }
               setFeedback(null);
            }, 1000);
         }
      },
      [round, rounds, score, options, isRoundComplete]
   );

   // Update handleSelect ref
   useEffect(() => {
      handleSelectRef.current = handleSelect;
   }, [handleSelect]);

   // Progress calculation
   const progress = (round / rounds) * 100;

   // Keyboard controls
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         if (isRoundComplete) return;

         // Number keys 1-3 to select option directly
         if (e.key >= "1" && e.key <= "3") {
            const optionNum = parseInt(e.key) - 1;
            if (
               optionNum < options.length &&
               optionNum >= 0 &&
               handleSelectRef.current
            ) {
               handleSelectRef.current(optionNum);
               e.preventDefault();
            }
            return;
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [options.length, isRoundComplete]);

   return (
      <div className="mirror-match-game">
         {/* Header */}
         <div className="game-header">
            <div className="header-title">
               <ScaleIcon className="title-icon" />
               <h2>Mirror Match</h2>
               <EyeIcon className="title-icon-secondary" />
            </div>
            <div className="header-stats">
               <div className="stat-item">
                  <ArrowPathIcon className="stat-icon" />
                  <span>
                     Round {round} / {rounds}
                  </span>
               </div>
               <div className="stat-item">
                  <TrophyIcon className="stat-icon" />
                  <span>
                     Score: {score} / {rounds * 5}
                  </span>
               </div>
            </div>
            <div className="progress-bar-container">
               <div
                  style={{
                     width: `${progress}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "4px",
                     transition: "width 0.3s",
                     boxShadow: "rgba(125, 211, 252, 0.5) 0px 0px 10px",
                  }}
               />
            </div>
         </div>

         {/* Main Content */}
         <div className="mirror-match-content">
            {/* Main Shape */}
            <div
               style={{
                  background: "var(--card)",
                  borderRadius: "20px",
                  padding: "40px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                  minHeight: "200px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  width: "100%",
                  maxWidth: "600px",
               }}
            >
               <div
                  style={{
                     position: "absolute",
                     top: "12px",
                     right: "12px",
                     background: "rgba(125, 211, 252, 0.2)",
                     borderRadius: "50%",
                     padding: "8px",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                  }}
               >
                  <SparklesIcon
                     style={{ width: 20, height: 20, color: "var(--accent)" }}
                  />
               </div>
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     gap: "16px",
                  }}
               >
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        animation: "pulse 2s ease-in-out infinite",
                     }}
                  >
                     {getSVGShape(mainShape, 120)}
                  </div>
                  <div
                     style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                     }}
                  >
                     <span
                        style={{
                           fontSize: "1.1rem",
                           fontWeight: 700,
                           color: "var(--accent)",
                        }}
                     >
                        Find the Mirror
                     </span>
                     <span
                        style={{
                           fontSize: "0.9rem",
                           color: "var(--muted)",
                           display: "flex",
                           alignItems: "center",
                           gap: "8px",
                        }}
                     >
                        Mirror Type:{" "}
                        <span
                           style={{
                              padding: "4px 12px",
                              background: "rgba(125, 211, 252, 0.15)",
                              border: "1px solid var(--accent)",
                              borderRadius: "8px",
                              color: "var(--accent)",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                           }}
                        >
                           {mirrorType.charAt(0).toUpperCase() +
                              mirrorType.slice(1)}
                        </span>
                     </span>
                  </div>
               </div>
            </div>

            {/* Options */}
            <div
               style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: "20px",
                  width: "100%",
                  maxWidth: "800px",
               }}
            >
               {options.map((option, index) => {
                  const isSelectedOption = selected === index;
                  const isCorrectSelection =
                     isSelectedOption && feedback === "correct";
                  const isIncorrectSelection =
                     isSelectedOption && feedback === "wrong";

                  return (
                     <button
                        key={index}
                        onClick={() => handleSelect(index)}
                        disabled={isRoundComplete}
                        style={{
                           background: isCorrectSelection
                              ? "linear-gradient(135deg, rgba(134,239,172,0.3) 0%, rgba(134,239,172,0.1) 100%)"
                              : isIncorrectSelection
                              ? "linear-gradient(135deg, rgba(252,165,165,0.3) 0%, rgba(252,165,165,0.1) 100%)"
                              : "var(--card)",
                           border: isCorrectSelection
                              ? "2px solid var(--ok)"
                              : isIncorrectSelection
                              ? "2px solid var(--warn)"
                              : "2px solid var(--stroke)",
                           borderRadius: "16px",
                           cursor: isRoundComplete ? "not-allowed" : "pointer",
                           transition: "all 0.3s ease",
                           transform: isSelectedOption
                              ? "scale(0.95)"
                              : "scale(1)",
                           boxShadow: isSelectedOption
                              ? "0 8px 20px rgba(125, 211, 252, 0.4)"
                              : "0 4px 12px rgba(0, 0, 0, 0.2)",
                           opacity:
                              isRoundComplete && !isSelectedOption ? 0.5 : 1,
                           padding: "20px",
                           position: "relative",
                        }}
                        onMouseEnter={(e) => {
                           if (!isRoundComplete) {
                              e.currentTarget.style.transform = "scale(1.05)";
                              e.currentTarget.style.boxShadow =
                                 "0 8px 20px rgba(125, 211, 252, 0.4)";
                           }
                        }}
                        onMouseLeave={(e) => {
                           if (!isRoundComplete) {
                              e.currentTarget.style.transform = isSelectedOption
                                 ? "scale(0.95)"
                                 : "scale(1)";
                              e.currentTarget.style.boxShadow = isSelectedOption
                                 ? "0 8px 20px rgba(125, 211, 252, 0.4)"
                                 : "0 4px 12px rgba(0, 0, 0, 0.2)";
                           }
                        }}
                     >
                        <div
                           style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "12px",
                              position: "relative",
                           }}
                        >
                           {isCorrectSelection && (
                              <div
                                 style={{
                                    position: "absolute",
                                    top: "-8px",
                                    right: "-8px",
                                    background: "var(--ok)",
                                    borderRadius: "50%",
                                    padding: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    zIndex: 10,
                                    boxShadow:
                                       "0 4px 12px rgba(134, 239, 172, 0.5)",
                                 }}
                              >
                                 <CheckCircleIcon
                                    style={{
                                       width: 20,
                                       height: 20,
                                       color: "var(--bg)",
                                    }}
                                 />
                              </div>
                           )}
                           {isIncorrectSelection && (
                              <div
                                 style={{
                                    position: "absolute",
                                    top: "-8px",
                                    right: "-8px",
                                    background: "var(--warn)",
                                    borderRadius: "50%",
                                    padding: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    zIndex: 10,
                                    boxShadow:
                                       "0 4px 12px rgba(252, 165, 165, 0.5)",
                                 }}
                              >
                                 <XCircleIcon
                                    style={{
                                       width: 20,
                                       height: 20,
                                       color: "var(--bg)",
                                    }}
                                 />
                              </div>
                           )}
                           <div
                              style={{
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 position: "relative",
                              }}
                           >
                              <div
                                 style={{
                                    transform: option.isMirror
                                       ? applyMirror(
                                            option.shape,
                                            option.mirrorType
                                         ).transform
                                       : "none",
                                    transformOrigin: "center",
                                    transition: "transform 0.3s ease",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                 }}
                              >
                                 {getSVGShape(option.shape, 80)}
                              </div>
                           </div>
                           <div
                              style={{
                                 display: "flex",
                                 flexDirection: "column",
                                 alignItems: "center",
                                 gap: "4px",
                              }}
                           >
                              <span
                                 style={{
                                    fontSize: "0.75rem",
                                    fontWeight: 500,
                                    color: "var(--accent)",
                                    background: "rgba(125, 211, 252, 0.1)",
                                    borderRadius: "4px",
                                    padding: "2px 6px",
                                    fontFamily: "monospace",
                                 }}
                              >
                                 {index + 1}
                              </span>
                           </div>
                        </div>
                     </button>
                  );
               })}
            </div>
         </div>

         {/* Feedback Message */}
         {feedback !== null && (
            <div
               style={{
                  padding: "16px 24px",

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
                  color: feedback === "correct" ? "var(--ok)" : "var(--warn)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
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
   );
}

export default MirrorMatch;
