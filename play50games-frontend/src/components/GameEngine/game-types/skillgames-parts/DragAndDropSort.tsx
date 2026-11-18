"use client";

import React, {
   useState,
   useEffect,
   useCallback,
   useRef,
   useMemo,
} from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   ArrowPathIcon,
   TrophyIcon,
   ClockIcon,
   ShareIcon,
   ArrowPathRoundedSquareIcon,
   HandRaisedIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

import touch from "./skillTouch.module.css";
import ui from "./skillUi.module.css";
import s from "./DragAndDropSort.module.css";
import { usePlayAreaInView } from "./usePlayAreaInView";

interface DragAndDropSortProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

interface SortableItem {
   id: string;
   emoji: string;
   categoryId: string;
}

interface Category {
   id: string;
   name: string;
   color: string;
   items: SortableItem[];
}

interface LevelCategory {
   id: string;
   label: string;
   color: string;
}

interface LevelPhase {
   categories: LevelCategory[];
   items: SortableItem[];
}

interface LevelDefinition {
   duration: number;
   minCorrect: number;
   penaltySec: number;
   phases: LevelPhase[];
   switchAt?: number;
}

interface RawCategory {
   id: string;
   label?: string;
   color?: string;
   items?: string[];
}

interface RawLevel {
   duration?: number;
   minCorrect?: number;
   penaltySec?: number;
   switchAt?: number;
   categories?: RawCategory[];
   phases?: Array<{ categories?: RawCategory[] }>;
}

const makeItems = (categoryId: string, emojis: string[]): SortableItem[] => {
   return emojis.map((emoji, index) => ({
      id: `${categoryId}-${index}-${emoji}`,
      emoji,
      categoryId,
   }));
};

const makeLevel = (
   duration: number,
   penaltySec: number,
   phases: LevelPhase[],
   switchAt?: number
): LevelDefinition => {
   const totalItems = phases.reduce(
      (sum, phase) => sum + phase.items.length,
      0
   );
   const minCorrect = Math.max(1, totalItems);
   return { duration, penaltySec, phases, minCorrect, switchAt };
};

const normalizeCategories = (
   categories: RawCategory[] = []
): LevelCategory[] => {
   return categories.map((category) => ({
      id: category.id,
      label: category.label || category.id,
      color: category.color || "rgba(59, 130, 246, 0.2)",
   }));
};

const buildPhaseItems = (categories: RawCategory[] = []): SortableItem[] => {
   const items: SortableItem[] = [];
   categories.forEach((category) => {
      (category.items || []).forEach((emoji, index) => {
         items.push({
            id: `${category.id}-${index}-${emoji}`,
            emoji,
            categoryId: category.id,
         });
      });
   });
   return items;
};

const normalizeLevels = (rawLevels: RawLevel[] = []): LevelDefinition[] => {
   const normalized = rawLevels
      .map((level) => {
         const duration =
            typeof level.duration === "number"
               ? level.duration
               : typeof level.duration === "string" &&
                 !isNaN(Number(level.duration))
               ? Number(level.duration)
               : 45;
         const penaltySec =
            typeof level.penaltySec === "number"
               ? level.penaltySec
               : typeof level.penaltySec === "string" &&
                 !isNaN(Number(level.penaltySec))
               ? Number(level.penaltySec)
               : 0;
         const switchAt =
            typeof level.switchAt === "number"
               ? level.switchAt
               : typeof level.switchAt === "string" &&
                 !isNaN(Number(level.switchAt))
               ? Number(level.switchAt)
               : undefined;

         const phasesSource =
            level.phases && level.phases.length > 0
               ? level.phases
               : [{ categories: level.categories || [] }];

         const phases: LevelPhase[] = phasesSource
            .map((phase) => {
               const phaseCategories = normalizeCategories(
                  phase.categories || []
               );
               const phaseItems = buildPhaseItems(phase.categories || []);
               return {
                  categories: phaseCategories,
                  items: phaseItems,
               };
            })
            .filter(
               (phase) => phase.categories.length > 0 && phase.items.length > 0
            );

         if (phases.length === 0) {
            return null;
         }

         const totalItems = phases.reduce(
            (sum, phase) => sum + phase.items.length,
            0
         );
         const minCorrect =
            typeof level.minCorrect === "number"
               ? level.minCorrect
               : typeof level.minCorrect === "string" &&
                 !isNaN(Number(level.minCorrect))
               ? Number(level.minCorrect)
               : Math.max(1, totalItems);

         return {
            duration,
            penaltySec,
            phases,
            minCorrect,
            switchAt,
         };
      })
      .filter(Boolean) as LevelDefinition[];

   return normalized;
};

const LEVEL_DEFS: LevelDefinition[] = [
   makeLevel(45, 0, [
      {
         categories: [
            { id: "red", label: "Red", color: "rgba(239, 68, 68, 0.25)" },
            { id: "blue", label: "Blue", color: "rgba(59, 130, 246, 0.25)" },
         ],
         items: [
            ...makeItems("red", ["🔴", "🟥", "❤️", "🍎"]),
            ...makeItems("blue", ["🔵", "🟦", "💙", "🧊"]),
         ],
      },
   ]),
   makeLevel(45, 0, [
      {
         categories: [
            {
               id: "circle",
               label: "Circle",
               color: "rgba(148, 163, 184, 0.25)",
            },
            {
               id: "square",
               label: "Square",
               color: "rgba(203, 213, 225, 0.25)",
            },
         ],
         items: [
            ...makeItems("circle", ["⚪", "⚫", "🔘", "⭕"]),
            ...makeItems("square", ["⬜", "⬛", "◻️", "◼️"]),
         ],
      },
   ]),
   makeLevel(40, 0, [
      {
         categories: [
            { id: "big", label: "Big", color: "rgba(34, 197, 94, 0.22)" },
            { id: "small", label: "Small", color: "rgba(168, 85, 247, 0.22)" },
         ],
         items: [
            ...makeItems("big", ["🐘", "🚌", "🏠", "🐋"]),
            ...makeItems("small", ["🐭", "🐜", "🍬", "🧸"]),
         ],
      },
   ]),
   makeLevel(40, 0, [
      {
         categories: [
            { id: "fruits", label: "Fruits", color: "rgba(234, 88, 12, 0.25)" },
            {
               id: "animals",
               label: "Animals",
               color: "rgba(59, 130, 246, 0.25)",
            },
         ],
         items: [
            ...makeItems("fruits", ["🍎", "🍌", "🍇", "🍉"]),
            ...makeItems("animals", ["🐶", "🐱", "🐵", "🐯"]),
         ],
      },
   ]),
   makeLevel(35, 0, [
      {
         categories: [
            { id: "tools", label: "Tools", color: "rgba(148, 163, 184, 0.25)" },
            {
               id: "vehicles",
               label: "Vehicles",
               color: "rgba(59, 130, 246, 0.25)",
            },
         ],
         items: [
            ...makeItems("tools", ["🔧", "🔨", "🧰", "🪛"]),
            ...makeItems("vehicles", ["🚗", "🚕", "🚲", "🚁"]),
         ],
      },
   ]),
   makeLevel(35, 0, [
      {
         categories: [
            { id: "food", label: "Food", color: "rgba(245, 158, 11, 0.25)" },
            {
               id: "drinks",
               label: "Drinks",
               color: "rgba(14, 165, 233, 0.25)",
            },
         ],
         items: [
            ...makeItems("food", ["🍔", "🍕", "🍟", "🌮"]),
            ...makeItems("drinks", ["🥤", "🧃", "☕", "🥛"]),
         ],
      },
   ]),
   makeLevel(35, 0, [
      {
         categories: [
            { id: "living", label: "Living", color: "rgba(34, 197, 94, 0.2)" },
            {
               id: "nonliving",
               label: "Non-living",
               color: "rgba(100, 116, 139, 0.25)",
            },
         ],
         items: [
            ...makeItems("living", ["🐶", "🐦", "🌳", "🐟"]),
            ...makeItems("nonliving", ["🪑", "📱", "🚗", "🧱"]),
         ],
      },
   ]),
   makeLevel(30, 0, [
      {
         categories: [
            { id: "indoor", label: "Indoor", color: "rgba(59, 130, 246, 0.2)" },
            {
               id: "outdoor",
               label: "Outdoor",
               color: "rgba(234, 179, 8, 0.2)",
            },
         ],
         items: [
            ...makeItems("indoor", ["🛋️", "🛏️", "🚿", "🧴"]),
            ...makeItems("outdoor", ["🌳", "🏕️", "🏔️", "🏖️"]),
         ],
      },
   ]),
   makeLevel(30, 0, [
      {
         categories: [
            {
               id: "natural",
               label: "Natural",
               color: "rgba(34, 197, 94, 0.2)",
            },
            {
               id: "manmade",
               label: "Man-made",
               color: "rgba(94, 234, 212, 0.2)",
            },
         ],
         items: [
            ...makeItems("natural", ["🌋", "🌊", "🌲", "🪨"]),
            ...makeItems("manmade", ["🏭", "🏢", "🛣️", "🧱"]),
         ],
      },
   ]),
   makeLevel(28, 2, [
      {
         categories: [
            { id: "safe", label: "Safe", color: "rgba(34, 197, 94, 0.2)" },
            {
               id: "danger",
               label: "Dangerous",
               color: "rgba(239, 68, 68, 0.2)",
            },
         ],
         items: [
            ...makeItems("safe", ["🪖", "🧯", "🦺", "🛟"]),
            ...makeItems("danger", ["🔥", "⚡", "🗡️", "☣️"]),
         ],
      },
   ]),
   makeLevel(26, 2, [
      {
         categories: [
            { id: "before", label: "Before", color: "rgba(59, 130, 246, 0.2)" },
            { id: "after", label: "After", color: "rgba(234, 179, 8, 0.2)" },
         ],
         items: [
            ...makeItems("before", ["🥚", "🌱", "🧊", "🌙"]),
            ...makeItems("after", ["🐣", "🌳", "💧", "🌞"]),
         ],
      },
   ]),
   makeLevel(24, 3, [
      {
         categories: [
            { id: "cause", label: "Cause", color: "rgba(248, 113, 113, 0.2)" },
            { id: "effect", label: "Effect", color: "rgba(59, 130, 246, 0.2)" },
         ],
         items: [
            ...makeItems("cause", ["⚡", "🌧️", "🔥", "🥶"]),
            ...makeItems("effect", ["💡", "🌈", "💧", "🧊"]),
         ],
      },
   ]),
   makeLevel(
      24,
      3,
      [
         {
            categories: [
               { id: "true", label: "True", color: "rgba(34, 197, 94, 0.2)" },
               { id: "false", label: "False", color: "rgba(239, 68, 68, 0.2)" },
            ],
            items: [
               ...makeItems("true", ["🐟💧", "🕊️🌤️", "🌞☀️", "🌳🌿"]),
               ...makeItems("false", ["🐟🔥", "☂️🔥", "🌙☀️", "🌵❄️"]),
            ],
         },
         {
            categories: [
               {
                  id: "problem",
                  label: "Problem",
                  color: "rgba(251, 191, 36, 0.2)",
               },
               {
                  id: "solution",
                  label: "Solution",
                  color: "rgba(59, 130, 246, 0.2)",
               },
            ],
            items: [
               ...makeItems("problem", ["🔌❌", "💡❌", "🚪🔒", "🌧️"]),
               ...makeItems("solution", ["🔌✅", "💡", "🔑", "☂️"]),
            ],
         },
      ],
      0.5
   ),
   makeLevel(
      22,
      3,
      [
         {
            categories: [
               {
                  id: "cause",
                  label: "Cause",
                  color: "rgba(248, 113, 113, 0.2)",
               },
               {
                  id: "effect",
                  label: "Effect",
                  color: "rgba(59, 130, 246, 0.2)",
               },
            ],
            items: [
               ...makeItems("cause", ["🌧️", "🏃", "😴", "🔥"]),
               ...makeItems("effect", ["💧", "💦", "😪", "💨"]),
            ],
         },
         {
            categories: [
               {
                  id: "before",
                  label: "Before",
                  color: "rgba(59, 130, 246, 0.2)",
               },
               { id: "after", label: "After", color: "rgba(234, 179, 8, 0.2)" },
            ],
            items: [
               ...makeItems("before", ["🥚", "🧊", "🌑", "🌱"]),
               ...makeItems("after", ["🐣", "💧", "🌕", "🌳"]),
            ],
         },
      ],
      0.5
   ),
   makeLevel(
      20,
      4,
      [
         {
            categories: [
               {
                  id: "fruits",
                  label: "Fruits",
                  color: "rgba(234, 88, 12, 0.25)",
               },
               {
                  id: "animals",
                  label: "Animals",
                  color: "rgba(59, 130, 246, 0.25)",
               },
               {
                  id: "vehicles",
                  label: "Vehicles",
                  color: "rgba(14, 165, 233, 0.25)",
               },
               {
                  id: "tools",
                  label: "Tools",
                  color: "rgba(100, 116, 139, 0.25)",
               },
            ],
            items: [
               ...makeItems("fruits", ["🍎", "🍌", "🍇"]),
               ...makeItems("animals", ["🐶", "🐱", "🐵"]),
               ...makeItems("vehicles", ["🚗", "🚌", "🚲"]),
               ...makeItems("tools", ["🔧", "🔨", "🪛"]),
            ],
         },
         {
            categories: [
               { id: "red", label: "Red", color: "rgba(239, 68, 68, 0.25)" },
               { id: "blue", label: "Blue", color: "rgba(59, 130, 246, 0.25)" },
               {
                  id: "circle",
                  label: "Circle",
                  color: "rgba(148, 163, 184, 0.25)",
               },
               {
                  id: "square",
                  label: "Square",
                  color: "rgba(203, 213, 225, 0.25)",
               },
            ],
            items: [
               ...makeItems("red", ["🔴", "🟥", "❤️"]),
               ...makeItems("blue", ["🔵", "🟦", "💙"]),
               ...makeItems("circle", ["⚪", "⚫", "⭕"]),
               ...makeItems("square", ["⬜", "⬛", "◻️"]),
            ],
         },
      ],
      0.5
   ),
];

export default function DragAndDropSort({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: DragAndDropSortProps) {
   // Use a ref to store the initial levelDefs to prevent reset during gameplay
   const initialLevelDefsRef = useRef<LevelDefinition[] | null>(null);
   const levelDefsInitializedRef = useRef(false);

   // Calculate levelDefs from config
   const levelDefsFromConfig = useMemo(() => {
      const rawLevels = config?.levelDefinitions as RawLevel[] | undefined;
      const normalized = Array.isArray(rawLevels)
         ? normalizeLevels(rawLevels)
         : [];
      return normalized.length > 0 ? normalized : LEVEL_DEFS;
   }, [config]);

   // Initialize levelDefs ref only once when game starts playing
   // Only update when isPlaying changes, not when levelDefsFromConfig changes during gameplay
   useEffect(() => {
      if (isPlaying && !levelDefsInitializedRef.current) {
         // Only initialize once when game starts
         initialLevelDefsRef.current = levelDefsFromConfig;
         levelDefsInitializedRef.current = true;
      } else if (!isPlaying) {
         // Reset only when game stops
         levelDefsInitializedRef.current = false;
         initialLevelDefsRef.current = null;
      }
      // Intentionally not including levelDefsFromConfig in dependencies
      // to prevent re-initialization when config changes during gameplay
   }, [isPlaying]);

   // Use the initial levelDefs if game is playing, otherwise use current levelDefs
   // Use useMemo to ensure stable reference when game is playing
   const levelDefs = useMemo(() => {
      return isPlaying && initialLevelDefsRef.current
         ? initialLevelDefsRef.current
         : levelDefsFromConfig;
   }, [isPlaying, levelDefsFromConfig]);

   const configuredLevels = config?.levels ? Number(config.levels) : 0;
   const maxLevels =
      configuredLevels > 0
         ? Math.min(configuredLevels, levelDefs.length)
         : levelDefs.length;

   const getLevelConfig = useCallback(
      (level: number) => {
         return levelDefs[Math.min(level, levelDefs.length - 1)];
      },
      [levelDefs]
   );

   const [currentLevel, setCurrentLevel] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "playing" | "ready" | "failed" | "paused"
   >("playing");
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [timeLeft, setTimeLeft] = useState(() => {
      return getLevelConfig(0).duration;
   });
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Game state
   const [itemList, setItemList] = useState<SortableItem[]>([]);
   const [categories, setCategories] = useState<Category[]>([]);
   const [draggedItem, setDraggedItem] = useState<string | null>(null);
   const [correctlySorted, setCorrectlySorted] = useState(0);
   const [incorrectlySorted, setIncorrectlySorted] = useState(0);
   const [phaseIndex, setPhaseIndex] = useState(0);
   const [totalItemsCount, setTotalItemsCount] = useState(0);
   const [phaseSwitchAt, setPhaseSwitchAt] = useState<number | null>(null);
   const [placedCount, setPlacedCount] = useState(0);
   const [touchDragItemId, setTouchDragItemId] = useState<string | null>(null);
   const [touchDragPos, setTouchDragPos] = useState<{
      x: number;
      y: number;
   } | null>(null);
   const [touchDragOffset, setTouchDragOffset] = useState<{
      x: number;
      y: number;
   } | null>(null);

   // Refs
   const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
   const gameStateRef = useRef<"playing" | "ready" | "failed" | "paused">(
      "playing"
   );
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<((level: number) => void) | null>(null);
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   const lastCompletedLevelRef = useRef<number | null>(null);
   const nextRoundClickedRef = useRef(false);
   const [nextRoundLocked, setNextRoundLocked] = useState(false);
   const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
         setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024);
      };
      checkResponsive();
      window.addEventListener("resize", checkResponsive);
      return () => window.removeEventListener("resize", checkResponsive);
   }, []);

   const sortRef = useRef<HTMLDivElement>(null);
   const [wrongDrop, setWrongDrop] = useState<string | null>(null); // feedback only: the zone that shakes
   const [dragOverCat, setDragOverCat] = useState<string | null>(null); // mouse drag-over highlight only
   // the drop zone under the finger while a touch drag is on (highlight only; the drop test is unchanged)
   const hoverCategory = (() => {
      if (!touchDragItemId || !touchDragPos) return null;
      const hit = Object.entries(categoryRefs.current).find(([, node]) => {
         if (!node) return false;
         const rc = node.getBoundingClientRect();
         return touchDragPos.x >= rc.left && touchDragPos.x <= rc.right && touchDragPos.y >= rc.top && touchDragPos.y <= rc.bottom;
      });
      return hit ? hit[0] : null;
   })();
   // Mobile/tablet: bring the panel and the play area on screen when a round starts
   const rootRef = useRef<HTMLDivElement>(null);
   const pad = usePlayAreaInView(rootRef, sortRef, true, `${gameState}-${currentLevel}`);

   const getPhase = useCallback(
      (level: number, phase: number) => {
         const levelConfig = getLevelConfig(level);
         return levelConfig.phases[
            Math.min(phase, levelConfig.phases.length - 1)
         ];
      },
      [getLevelConfig]
   );

   const generateItems = useCallback(
      (level: number, phase: number): SortableItem[] => {
         const phaseConfig = getPhase(level, phase);
         return [...phaseConfig.items].sort(() => Math.random() - 0.5);
      },
      [getPhase]
   );

   const generateCategories = useCallback(
      (level: number, phase: number): Category[] => {
         const phaseConfig = getPhase(level, phase);
         return phaseConfig.categories.map((category) => ({
            id: category.id,
            name: category.label,
            color: category.color,
            items: [],
         }));
      },
      [getPhase]
   );

   // Check if item is correctly sorted
   const isItemCorrect = useCallback(
      (item: SortableItem, categoryId: string): boolean => {
         return item.categoryId === categoryId;
      },
      []
   );

   // Clear all timers (defined before useEffect that uses it)
   const clearAll = useCallback(() => {
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }
   }, []);

   // Stop the countdown when the game unmounts (it kept running before)
   useEffect(() => () => clearAll(), [clearAll]);

   useEffect(() => {
      if (gameState !== "playing") return;
      const levelConfig = getLevelConfig(currentLevel);

      if (incorrectlySorted > 5) {
         gameStateRef.current = "failed";
         setGameState("failed");
         clearAll();
         return;
      }

      if (
         levelConfig.switchAt &&
         levelConfig.phases.length > 1 &&
         phaseIndex === 0 &&
         phaseSwitchAt !== null &&
         placedCount >= phaseSwitchAt
      ) {
         setPhaseIndex(1);
         setItemList(generateItems(currentLevel, 1));
         setCategories(generateCategories(currentLevel, 1));
         setDraggedItem(null);
         return;
      }

      if (
         itemList.length === 0 &&
         phaseIndex === levelConfig.phases.length - 1
      ) {
         const minCorrect =
            typeof levelConfig.minCorrect === "number"
               ? levelConfig.minCorrect
               : Number(levelConfig.minCorrect) || 0;
         if (correctlySorted >= minCorrect) {
            requirementsMetRef.current = true;
            setRequirementsMet(true);
            gameStateRef.current = "ready";
            setGameState("ready");
            clearAll();
            lastCompletedLevelRef.current = currentLevel;
         } else {
            gameStateRef.current = "failed";
            setGameState("failed");
            clearAll();
         }
      }
   }, [
      gameState,
      currentLevel,
      itemList.length,
      phaseIndex,
      phaseSwitchAt,
      placedCount,
      correctlySorted,
      incorrectlySorted,
      getLevelConfig,
      generateItems,
      generateCategories,
      clearAll,
   ]);

   // Track if game was already initialized to prevent reset on config changes
   const gameInitializedRef = useRef(false);

   useEffect(() => {
      if (!isPlaying) {
         clearAll();
         gameInitializedRef.current = false;
         return;
      }

      // Only reset if game wasn't already initialized
      if (gameInitializedRef.current) {
         return;
      }

      // Game started - reset state
      prevLevelRef.current = -1;
      forceStartLevelRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      completionCalledRef.current = false;
      setCurrentLevel(0);
      setCurrentScore(0);
      setRequirementsMet(false);
      lastCompletedLevelRef.current = null;
      setGameState("playing");
      setItemList([]);
      setCategories([]);
      setCorrectlySorted(0);
      setIncorrectlySorted(0);
      setPhaseIndex(0);
      setPlacedCount(0);
      setPhaseSwitchAt(null);
      setTotalItemsCount(0);
      gameInitializedRef.current = true;
   }, [isPlaying, clearAll]);

   // Start level
   const startLevel = useCallback(
      (level: number) => {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }

         // Reset state
         setItemList([]);
         setCategories([]);
         setDraggedItem(null);
         setCorrectlySorted(0);
         setIncorrectlySorted(0);
         setPhaseIndex(0);
         setPlacedCount(0);
         setRequirementsMet(false);
         requirementsMetRef.current = false;
         lastCompletedLevelRef.current = null;
         nextRoundClickedRef.current = false;
         setNextRoundLocked(false);

         const levelConfig = getLevelConfig(level);
         const levelDur = levelConfig.duration;
         setTimeLeft(levelDur);

         const totalItems = levelConfig.phases.reduce(
            (sum, phase) => sum + phase.items.length,
            0
         );
         setTotalItemsCount(totalItems);
         setPhaseSwitchAt(
            levelConfig.switchAt && levelConfig.phases.length > 1
               ? Math.ceil(totalItems * levelConfig.switchAt)
               : null
         );

         // Generate items and categories for phase 0
         const newItems = generateItems(level, 0);
         const newCategories = generateCategories(level, 0);

         setItemList(newItems);
         setCategories(newCategories);

         // Set game state to playing
         gameStateRef.current = "playing";
         setGameState("playing");

         // Start countdown timer
         countdownTimerRef.current = setInterval(() => {
            setTimeLeft((prev: number) => {
               if (prev <= 1) {
                  if (countdownTimerRef.current) {
                     clearInterval(countdownTimerRef.current);
                     countdownTimerRef.current = null;
                  }
                  return 0;
               }
               return prev - 1;
            });
         }, 1000);
      },
      [getLevelConfig, generateItems, generateCategories]
   );

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   // Handle drag start
   const handleDragStart = useCallback(
      (itemId: string) => {
         if (gameState !== "playing") return;
         setDraggedItem(itemId);
      },
      [gameState]
   );

   // Handle drag over
   const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
   }, []);

   const processDrop = useCallback(
      (itemId: string, categoryId: string) => {
         if (gameState !== "playing") return;

         const item = itemList.find((i) => i.id === itemId);
         if (!item) return;

         const isCorrect = isItemCorrect(item, categoryId);
         const levelConfig = getLevelConfig(currentLevel);

         if (isCorrect) {
            setItemList((prev) => prev.filter((i) => i.id !== itemId));
            setPlacedCount((prev) => prev + 1);
            setCorrectlySorted((prev) => prev + 1);

            setCategories((prev) =>
               prev.map((cat) => {
                  if (cat.id === categoryId) {
                     return {
                        ...cat,
                        items: [...cat.items, item],
                     };
                  }
                  return cat;
               })
            );
         } else {
            setWrongDrop(categoryId);
            window.setTimeout(() => setWrongDrop(null), 400);
            setIncorrectlySorted((prev) => prev + 1);
            if (levelConfig.penaltySec > 0) {
               setTimeLeft((prev) =>
                  Math.max(0, prev - levelConfig.penaltySec)
               );
            }
         }
      },
      [gameState, itemList, isItemCorrect, currentLevel, getLevelConfig]
   );

   // Handle drop
   const handleDrop = useCallback(
      (categoryId: string) => {
         if (!draggedItem) return;
         processDrop(draggedItem, categoryId);
         setDraggedItem(null);
      },
      [draggedItem, processDrop]
   );

   const handleTouchStart = useCallback(
      (itemId: string, e: React.TouchEvent) => {
         const touch = e.touches[0];
         if (!touch) return;
         const target = e.currentTarget as HTMLDivElement;
         const rect = target.getBoundingClientRect();
         setTouchDragItemId(itemId);
         setTouchDragOffset({
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top,
         });
         setTouchDragPos({ x: touch.clientX, y: touch.clientY });
      },
      []
   );

   const handleTouchMove = useCallback((e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();
      setTouchDragPos({ x: touch.clientX, y: touch.clientY });
   }, []);

   const handleTouchEnd = useCallback(() => {
      if (!touchDragItemId || !touchDragPos) {
         setTouchDragItemId(null);
         setTouchDragPos(null);
         setTouchDragOffset(null);
         return;
      }

      const { x, y } = touchDragPos;
      const categoryEntries = Object.entries(categoryRefs.current);
      const hitCategory = categoryEntries.find(([, node]) => {
         if (!node) return false;
         const rect = node.getBoundingClientRect();
         return (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
         );
      });

      if (hitCategory) {
         processDrop(touchDragItemId, hitCategory[0]);
      }

      setTouchDragItemId(null);
      setTouchDragPos(null);
      setTouchDragOffset(null);
   }, [touchDragItemId, touchDragPos, processDrop]);

   // End level when time runs out
   useEffect(() => {
      if (
         timeLeft === 0 &&
         gameState === "playing" &&
         !requirementsMetRef.current
      ) {
         const levelConfig = getLevelConfig(currentLevel);
         const minCorrect =
            typeof levelConfig.minCorrect === "number"
               ? levelConfig.minCorrect
               : Number(levelConfig.minCorrect) || 0;

         if (
            correctlySorted >= minCorrect &&
            itemList.length === 0 &&
            phaseIndex === levelConfig.phases.length - 1
         ) {
            requirementsMetRef.current = true;
            setRequirementsMet(true);
            gameStateRef.current = "ready";
            setGameState("ready");
            clearAll();
         } else {
            gameStateRef.current = "failed";
            setGameState("failed");
            clearAll();
         }
      }
   }, [
      timeLeft,
      gameState,
      currentLevel,
      correctlySorted,
      itemList,
      phaseIndex,
      getLevelConfig,
      clearAll,
   ]);

   // Handle level completion
   useEffect(() => {
      if (prevLevelRef.current === null) return;

      if (gameState === "ready" && !requirementsMetRef.current) {
         return;
      }
      if (
         gameState === "ready" &&
         lastCompletedLevelRef.current !== currentLevel
      ) {
         return;
      }

      if (gameState === "ready" && currentLevel < maxLevels - 1) {
         const newScore = Math.round(((currentLevel + 1) / maxLevels) * 100);
         setCurrentScore(newScore);
         onScoreUpdate(newScore);
      } else if (gameState === "ready" && currentLevel === maxLevels - 1) {
         const finalScore = 100;
         setCurrentScore(finalScore);
         onScoreUpdate(finalScore);
         if (!completionCalledRef.current) {
            completionCalledRef.current = true;
            setTimeout(() => {
               onComplete(finalScore);
            }, 1500);
         }
      }
   }, [gameState, currentLevel, maxLevels, onScoreUpdate, onComplete]);

   // Handle next round
   const handleNextRound = useCallback(() => {
      if (gameState !== "ready") return;
      if (nextRoundClickedRef.current || nextRoundLocked) return;
      if (currentLevel < maxLevels - 1) {
         nextRoundClickedRef.current = true;
         setNextRoundLocked(true);
         setCurrentLevel((prev) => prev + 1);
      }
   }, [gameState, currentLevel, maxLevels, nextRoundLocked]);

   // Handle replay
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setRequirementsMet(false);
      requirementsMetRef.current = false;
      lastCompletedLevelRef.current = null;
      setGameState("playing");
      gameStateRef.current = "playing";
      setItemList([]);
      setCategories([]);
      setDraggedItem(null);
      setCorrectlySorted(0);
      setIncorrectlySorted(0);
      setPhaseIndex(0);
      setPlacedCount(0);
      setPhaseSwitchAt(null);
      setTotalItemsCount(0);
      const levelDur = getLevelConfig(currentLevel).duration;
      setTimeLeft(levelDur);
      clearAll();
      setTimeout(() => {
         if (startLevelRef.current) {
            startLevelRef.current(currentLevel);
         }
      }, 100);
      if (maxReplays > 0) {
         setReplaysUsed((prev) => prev + 1);
      }
   }, [
      gameState,
      maxReplays,
      replaysUsed,
      currentLevel,
      getLevelConfig,
      clearAll,
   ]);

   // Share functionality
   const getShareableLink = useCallback((): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   }, []);

   const registerShareLink = useCallback(async (shareId: string) => {
      try {
         await registerShare(shareId, "drag-sort");
         const gameKey = "play50games_shared_drag-sort";
         const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes
         localStorage.setItem(
            gameKey,
            JSON.stringify({
               share_id: shareId,
               shared: false,
               expiry: expiry,
            })
         );
         setCurrentShareId(shareId);
      } catch (error) {
         // Error registering share
      }
   }, []);

   const handleShare = useCallback(async () => {
      const shareableLink = getShareableLink();
      const shareId = new URL(shareableLink).searchParams.get("shared") || "";

      if (!shareId) return;

      await registerShareLink(shareId);

      if (navigator.share) {
         try {
            await navigator.share({
               title: "Drag & Drop Sort - Play50Games",
               text: "Check out this sorting challenge!",
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
   }, [getShareableLink, registerShareLink]);

   const handleCopyLink = useCallback(async (shareId: string) => {
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
   }, []);

   // Check if share has clicks
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         const gameKey = "play50games_shared_drag-sort";
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
      const gameKey = "play50games_shared_drag-sort";
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
               // Error parsing stored data
            }
         }
      }
   }, []);

   // Start level when currentLevel changes
   useEffect(() => {
      if (!isPlaying) return;

      if (
         prevLevelRef.current === currentLevel &&
         forceStartLevelRef.current !== currentLevel
      ) {
         return;
      }

      prevLevelRef.current = currentLevel;
      if (forceStartLevelRef.current === currentLevel) {
         forceStartLevelRef.current = null;
      }

      // Reset state
      setItemList([]);
      setCategories([]);
      setDraggedItem(null);
      setCorrectlySorted(0);
      setIncorrectlySorted(0);
      setRequirementsMet(false);
      requirementsMetRef.current = false;
      nextRoundClickedRef.current = false;

      gameStateRef.current = "ready";
      setGameState("ready");

      if (currentLevel === 0) {
         setTimeout(() => {
            if (startLevelRef.current) {
               startLevelRef.current(0);
            }
         }, 0);
      } else {
         setTimeout(() => {
            if (startLevelRef.current) {
               startLevelRef.current(currentLevel);
            }
         }, 1200);
      }
   }, [currentLevel, isPlaying, startLevel]);

   // Progress percentage for header
   const progressPercentage = ((currentLevel + 1) / maxLevels) * 100;

   const levelConfig = getLevelConfig(currentLevel);
   const minCorrect =
      typeof levelConfig.minCorrect === "number"
         ? levelConfig.minCorrect
         : Number(levelConfig.minCorrect) || 0;

   const replayLocked = maxReplays > 0 && replaysUsed >= maxReplays;
   const binColumns = isMobile
      ? categories.length === 1
         ? "minmax(0, 1fr)"
         : "repeat(2, minmax(0, 1fr))"
      : categories.length <= 3
        ? `repeat(${Math.max(1, categories.length)}, minmax(0, 1fr))`
        : "repeat(2, minmax(0, 1fr))";
   const ghostItem =
      touchDragItemId && touchDragPos && touchDragOffset
         ? itemList.find((i) => i.id === touchDragItemId) ?? null
         : null;

   return (
      <>
         <div ref={rootRef} className={ui.root}>
            {/* Header Section */}
            <div className={ui.hud}>
               <div className={ui.hudRow}>
                  <span className={ui.hudStat}>
                     <ArrowPathIcon className={ui.hudIcon} />
                     Level {currentLevel + 1}/{maxLevels}
                  </span>
                  <span className={ui.hudStat}>
                     <TrophyIcon className={ui.hudIconOk} />
                     Score:{" "}
                     {requirementsMet &&
                     lastCompletedLevelRef.current === currentLevel &&
                     currentLevel + 1 >= maxLevels
                        ? 100
                        : currentScore}{" "}
                     / 100
                  </span>
                  <span
                     className={`${ui.hudStat} ${gameState === "playing" && timeLeft <= 5 ? ui.hudLow : ""}`}
                  >
                     <ClockIcon className={ui.hudIconAccent} />
                     {timeLeft}s
                  </span>
               </div>
               {/* Progress Bar */}
               <div className={ui.progressTrack}>
                  <div
                     className={ui.progressFill}
                     style={{ transform: `scaleX(${progressPercentage / 100})` }}
                  />
               </div>
            </div>

            {/* Stats Display */}
            {gameState === "playing" && (
               <div className={ui.statRow}>
                  <div className={ui.statOk}>
                     <CheckCircleIcon className={ui.statIconOk} />
                     <span>
                        Correct:{" "}
                        <span key={correctlySorted} className={ui.bump}>
                           {correctlySorted}
                        </span>
                        /{minCorrect}
                     </span>
                  </div>
                  {incorrectlySorted > 0 && (
                     <div className={ui.statWarn}>
                        <XCircleIcon className={ui.statIconWarn} />
                        <span>
                           Incorrect:{" "}
                           <span key={incorrectlySorted} className={ui.bump}>
                              {incorrectlySorted}
                           </span>
                        </span>
                     </div>
                  )}
               </div>
            )}

            {/* Game Arena */}
            {gameState === "playing" ? (
               <div ref={sortRef} data-play-area="" className={s.board}>
                  {/* Items to Sort */}
                  {itemList.length > 0 && (
                     <div className={s.pool}>
                        <div className={s.poolHead}>
                           <HandRaisedIcon className={s.poolIcon} />
                           <h3 className={s.poolTitle}>Drag & drop</h3>
                        </div>
                        <div className={s.items}>
                           {itemList.map((item) => (
                              <div
                                 key={item.id}
                                 data-item-id={item.id}
                                 draggable
                                 onDragStart={() => handleDragStart(item.id)}
                                 onDragEnd={() => setDragOverCat(null)}
                                 onTouchStart={(e) =>
                                    handleTouchStart(item.id, e)
                                 }
                                 onTouchMove={handleTouchMove}
                                 onTouchEnd={handleTouchEnd}
                                 onTouchCancel={handleTouchEnd}
                                 className={`${s.item} ${touchDragItemId === item.id ? s.itemPlaceholder : ""}`}
                              >
                                 {item.emoji}
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  <div className={s.bins} style={{ gridTemplateColumns: binColumns }}>
                     {categories.map((category) => {
                        const over =
                           hoverCategory === category.id ||
                           dragOverCat === category.id;
                        return (
                           <div
                              key={category.id}
                              ref={(node) => {
                                 categoryRefs.current[category.id] = node;
                              }}
                              onDragOver={handleDragOver}
                              onDragEnter={() => setDragOverCat(category.id)}
                              onDragLeave={(e) => {
                                 const next = e.relatedTarget as Node | null;
                                 if (!next || !e.currentTarget.contains(next)) {
                                    setDragOverCat((cur) =>
                                       cur === category.id ? null : cur
                                    );
                                 }
                              }}
                              onDrop={() => {
                                 setDragOverCat(null);
                                 handleDrop(category.id);
                              }}
                              className={`${s.bin} ${
                                 wrongDrop === category.id
                                    ? `${s.binWrong} ${touch.shake}`
                                    : over
                                      ? s.binOver
                                      : ""
                              }`}
                              // the bin's own colour is content (and globals.css matches it in the final games)
                              style={{
                                 background: over
                                    ? category.color.replace("0.2", "0.35")
                                    : category.color,
                              }}
                           >
                              <h4 className={s.binTitle}>{category.name}</h4>
                              <div className={s.binItems}>
                                 {category.items.map((item, index) => {
                                    const isCorrect = isItemCorrect(
                                       item,
                                       category.id
                                    );
                                    return (
                                       <div
                                          key={`${item.id}-${index}`}
                                          className={
                                             isCorrect ? s.placedOk : s.placedWarn
                                          }
                                       >
                                          {item.emoji}
                                          {isCorrect ? (
                                             <CheckCircleIcon className={s.placedIconOk} />
                                          ) : (
                                             <XCircleIcon className={s.placedIconWarn} />
                                          )}
                                       </div>
                                    );
                                 })}
                              </div>
                           </div>
                        );
                     })}
                  </div>

                  {/* the tile that follows a finger drag (moved by transform only) */}
                  {ghostItem && touchDragPos && touchDragOffset && (
                     <div
                        aria-hidden="true"
                        className={`${s.item} ${s.ghost}`}
                        style={{
                           transform: `translate3d(${touchDragPos.x - touchDragOffset.x}px, ${
                              touchDragPos.y - touchDragOffset.y
                           }px, 0) scale(1.06)`,
                           transition: "none",
                        }}
                     >
                        {ghostItem.emoji}
                     </div>
                  )}
               </div>
            ) : null}

            {/* Ready for Next Round Message */}
            {gameState === "ready" && currentLevel + 1 < maxLevels && (
               <div className={ui.card}>
                  <div className={ui.cardTitle}>Level {currentLevel + 1} Complete!</div>
                  <div className={ui.cardBody}>
                     Correctly sorted: <strong>{correctlySorted}/{minCorrect}</strong>
                     <br />
                     All items sorted!
                  </div>
                  <button
                     className={ui.buttonPrimary}
                     onClick={handleNextRound}
                     disabled={nextRoundLocked}
                  >
                     Next Round
                  </button>
               </div>
            )}

            {/* Level Failed Message */}
            {gameState === "failed" &&
               (() => {
                  const levelConfig = getLevelConfig(currentLevel);
                  const minCorrect =
                     typeof levelConfig.minCorrect === "number"
                        ? levelConfig.minCorrect
                        : Number(levelConfig.minCorrect) || 0;
                  const correctMet = correctlySorted >= minCorrect;

                  let failureReason = "";
                  if (!correctMet) {
                     failureReason = "Not enough items correctly sorted";
                  } else if (itemList.length > 0) {
                     failureReason =
                        "Time ran out before all items were sorted";
                  }

                  return (
                     <div className={ui.card}>
                        <div className={ui.cardTitleWarn}>Level {currentLevel + 1} Failed</div>
                        {failureReason && (
                           <div className={ui.cardBody} style={{ color: "var(--warn)", fontWeight: 600 }}>
                              {failureReason}
                           </div>
                        )}
                        <div className={ui.cardBody}>
                           <span className={s.reasons}>
                              <span>
                                 Correct: Need {minCorrect} | You got{" "}
                                 {correctlySorted}
                              </span>
                              {correctMet ? (
                                 <CheckCircleIcon className={ui.statIconOk} />
                              ) : (
                                 <XCircleIcon className={ui.statIconWarn} />
                              )}
                           </span>
                           {itemList.length > 0 && (
                              <div style={{ marginTop: "8px" }}>
                                 Items remaining: {itemList.length}
                                 {totalItemsCount > 0
                                    ? ` / ${totalItemsCount}`
                                    : ""}
                              </div>
                           )}
                        </div>
                     </div>
                  );
               })()}

            {/* Game Complete Message */}
            {gameState === "ready" &&
               currentLevel === maxLevels - 1 &&
               requirementsMet &&
               lastCompletedLevelRef.current === currentLevel && (
                  <div className={ui.card}>
                     <div className={ui.cardTitleOk}>Game Complete!</div>
                     <div className={ui.cardBody}>
                        All {maxLevels} levels completed!
                        <br />
                        Final Score: <strong>{currentScore}</strong>
                     </div>
                  </div>
               )}

            {/* Action Buttons: Replay, Share */}
            <div className={ui.actions}>
               {/* Share Success Message */}
               {shareSuccess && !unlimitedActivated && (
                  <div className={ui.notice}>
                     Link copied! Unlimited replay will unlock when someone
                     opens your link!
                  </div>
               )}

               {/* Unlimited Activated Message */}
               {unlimitedActivated && (
                  <div className={ui.notice}>
                     <CheckCircleIcon className={ui.noticeIcon} />
                     <span>
                        Someone opened your link! Unlimited replay is now
                        active for 15 minutes!
                     </span>
                  </div>
               )}

               <button className={ui.button} onClick={handleReplay} disabled={replayLocked}>
                  <ArrowPathRoundedSquareIcon className={ui.buttonIcon} />
                  <span>
                     {"Replay "}
                     {maxReplays === 0
                        ? "(∞)"
                        : `(${maxReplays - replaysUsed}/${maxReplays})`}
                  </span>
               </button>

               <button className={ui.button} onClick={handleShare}>
                  <ShareIcon className={ui.buttonIcon} />
                  <span>Share for unlimited</span>
               </button>
            </div>
            {pad > 0 && <div aria-hidden="true" style={{ height: pad, flexShrink: 0 }} />}
         </div>
      </>
   );
}
