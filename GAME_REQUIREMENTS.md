# Kërkesat për një Lojë në Play50Games

Ky dokument përshkruan të gjitha komponentët dhe funksionalitetet që duhet të përmbajë një lojë në platformën Play50Games.

## 📋 Përmbajtja

1. [Struktura Bazë](#1-struktura-bazë-e-lojës)
2. [Komponentet UI](#2-komponentet-ui)
3. [Sistemet e Lojës](#3-sistemet-e-lojës)
4. [Konfigurimi](#4-konfigurimi)
5. [Udhëzimet](#5-udhëzimet)
6. [Best Practices](#6-best-practices)
7. [Checklist](#7-checklist)

---

## 1. Struktura Bazë e Lojës

### 1.1 Props dhe Interface

Çdo lojë duhet të pranojë këto props:

```typescript
{
  config: Record<string, any>;              // Konfigurimi i lojës nga backend
  onScoreUpdate: (score: number) => void;   // Callback për përditësimin e score
  onComplete: (finalScore?: number) => void; // Callback kur loja përfundon
  passingScore?: number;                    // Score minimale për të kaluar (default: 70)
}
```

### 1.2 State Management

Lojët duhet të përdorin React Hooks për menaxhimin e state:

-  **`useState`** - për state lokal (round, score, game state, user input, etj.)
-  **`useEffect`** - për side effects (start round, check completion, cleanup, etj.)
-  **`useCallback`** - për funksione të memoizuara që kalojnë si props ose dependencies
-  **`useMemo`** - për vlera të memoizuara (llogaritje të rënda, filtered arrays, etj.)
-  **`useRef`** - për referenca të qëndrueshme që nuk duhen në dependency arrays

### 1.3 Game States

Lojët duhet të kenë state të qartë për fazat e lojës:

-  **`"memorizing"`** / **`"playing"`** - Faza aktive e lojës (shfaq informacion, animacione, etj.)
-  **`"input"`** - Faza kur përdoruesi jep përgjigje ose kryen veprime
-  **`"correct"`** - Përgjigje e saktë (feedback pozitiv)
-  **`"wrong"`** - Përgjigje e gabuar (feedback negativ)
-  **`"tutorial"`** - Ekran udhëzues (opsional, mund të hiqet nëse ka instructions në GameEngine)

---

## 2. Komponentet UI

### 2.1 Header Section (OBLIGATIVE)

Çdo lojë duhet të ketë një header që shfaq:

#### Struktura Standarde (për Skill Games dhe Speed Games):

**OBLIGATIVE:** Header-i duhet të ketë design të njëjtë për të gjitha lojërat:

```typescript
<div
   style={{
      width: "100%",
      maxWidth: "800px",
      background: "var(--card)",
      border: "1px solid var(--stroke)",
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
            }}
         />
         Level {currentLevel + 1}/{maxLevels}
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
         Score: {currentLevel + 1 >= maxLevels && gameState === "ready"
            ? 100
            : currentScore} / 100
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
         <ClockIcon
            style={{
               width: isMobile ? 14 : 16,
               height: isMobile ? 14 : 16,
               color: "var(--accent)",
            }}
         />
         {timeLeft}s
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
            boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
         }}
      />
   </div>
</div>
```

**Rregulla të rëndësishme për Header:**

1. **Container**: Duhet të ketë `background: "var(--card)"`, `border: "1px solid var(--stroke)"`, `borderRadius: isMobile ? "16px" : "20px"`, `padding: isMobile ? "16px" : "20px"`, `boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)"`
2. **Icons**: Të gjitha icons duhet të kenë madhësi `isMobile ? 14 : 16` (jo 18, 20, ose më të mëdha)
3. **Font Size**: Të gjitha tekstet duhet të kenë `fontSize: isMobile ? "0.875rem" : "1rem"` (jo 0.9rem, 1.05rem, ose më të mëdha)
4. **Gap**: Gap midis elementeve duhet të jetë `gap: "6px"` (jo 8px, 10px, ose më të mëdha)
5. **Progress Bar**: Duhet të ketë `height: isMobile ? "6px" : "8px"`, `background: "rgba(255, 255, 255, 0.1)"`, `borderRadius: "999px"`, dhe gradient me `boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)"`
6. **TrophyIcon Color**: Duhet të ketë `color: "var(--ok)"`
7. **ClockIcon Color**: Duhet të ketë `color: "var(--accent)"`
8. **Score Display**: Duhet të shfaqë `Score: {currentLevel + 1 >= maxLevels && gameState === "ready" ? 100 : currentScore} / 100`

#### Struktura Alternative (si Rotate to Fit / Face Memory):

-  **Title Section**: Me icons majtas/djathtas dhe gradient text
-  **Stats Section**: Round, Score, dhe stats specifike të lojës
-  **Progress Bar**: Në fund të header-it

```typescript
// Struktura Standarde
<div
   style={
      {
         /* Header container */
      }
   }
>
   <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>
         <ArrowPathIcon /> Round {currentRound + 1} / {maxRounds}
      </span>
      <span>
         <TrophyIcon /> Score: {currentScore} / 100
      </span>
   </div>
   <div
      style={
         {
            /* Progress bar container */
         }
      }
   >
      <div style={{ width: `${progress}%` }} />
   </div>
</div>
```

### 2.2 Game Board / Play Area (OBLIGATIVE)

Zona kryesore e lojës ku shfaqet:

-  Elementet e lojës (cards, cells, shapes, etj.)
-  Input controls (buttons, inputs, etj.)
-  Visual feedback për veprimet e përdoruesit

### 2.3 Feedback Messages (OBLIGATIVE)

Mesazhe feedback që shfaqen pas veprimeve:

**Rregulla të rëndësishme:**

-  **Gjatë lojës**: Nuk shfaqet feedback negativ (të kuqe) gjatë veprimeve
-  **Pas përfundimit**: Feedback negativ shfaqet vetëm pasi të gjitha zgjedhjet janë bërë dhe kontrollohet korrektësia
-  **Visual feedback menjëherë**: Elementet që janë zgjedhur gabimisht shfaqen me të kuqe menjëherë (border dhe background të kuq)
-  **Përsëritja e round-it**: Nëse ka gabime pas përfundimit, round-i përsëritet (jo kalon në round tjetër)

```typescript
{
   feedback !== null && (
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
            color: feedback === "correct" ? "var(--ok)" : "var(--warn)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            width: "100%",
            maxWidth: "600px",
            justifyContent: "center",
            margin: "0 auto",
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
   );
}
```

### 2.4 Hint System (OPSIONAL)

Nëse loja ka nevojë për hints:

-  **Hint Button**: Me icon `LightBulbIcon`
-  **Hint Counter**: Shfaq numrin e hints të mbetura: `Hint (X left)` ose `Hint (∞)`
-  **Hint Logic**: Tregon informacion që ndihmon përdoruesin
-  **Disabled State**: Disabled kur nuk ka më hints ose në fazë të gabuar

### 2.5 Share Feature (OBLIGATIVE)

**Share functionality është OBLIGATIVE për të gjitha lojërat.** Çdo lojë duhet të implementojë share functionality për unlimited replays/hints.

#### 2.5.1 Struktura Bazë

Çdo lojë duhet të ketë:

```typescript
// State variables
const [hasShared, setHasShared] = useState(false);
const [shareSuccess, setShareSuccess] = useState(false);
const [unlimitedActivated, setUnlimitedActivated] = useState(false);
const [currentShareId, setCurrentShareId] = useState<string | null>(null);
const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

// Max replays/hints: unlimited nëse shared
const maxReplays = hasShared ? 0 : 5; // 0 = unlimited
// Ose për hints:
const maxHints = hasShared ? 0 : 10; // 0 = unlimited
```

#### 2.5.2 Share Functions (OBLIGATIVE)

Çdo lojë duhet të implementojë këto funksione:

```typescript
// 1. Generate shareable link
const getShareableLink = (): string => {
   const currentUrl = window.location.href.split("?")[0];
   const shareId =
      Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
   return `${currentUrl}?shared=${shareId}`;
};

// 2. Register share link në backend
const registerShareLink = async (shareId: string) => {
   try {
      await registerShare(shareId, "game-id"); // Zëvendëso "game-id" me ID e lojës
      const gameKey = "play50games_shared_game-id"; // Zëvendëso "game-id"
      localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
      setCurrentShareId(shareId);
   } catch (error) {
      // Error registering share
   }
};

// 3. Handle share (Web Share API ose clipboard)
const handleShare = async () => {
   const shareableLink = getShareableLink();
   const shareId = new URL(shareableLink).searchParams.get("shared") || "";

   if (!shareId) return;

   await registerShareLink(shareId);

   if (navigator.share) {
      try {
         await navigator.share({
            title: "Game Title",
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

// 4. Copy link to clipboard (fallback)
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
```

#### 2.5.3 Share Status Checking (OBLIGATIVE)

Çdo lojë duhet të kontrollojë share status çdo 10 sekonda:

```typescript
// Check if share has clicks
useEffect(() => {
   if (!currentShareId) return;

   const checkShareStatus = async () => {
      const gameKey = "play50games_shared_game-id"; // Zëvendëso "game-id"
      try {
         const status = await getShareStatus(currentShareId);
         const hasClicks = status.has_clicks || status.clicks > 0;
         if (hasClicks && !hasShared) {
            // Share has clicks - activate unlimited replays/hints with expiry
            setHasShared(true);
            setUnlimitedActivated(true);
            setReplaysUsed(0); // Ose setHintsUsed(0) për hints

            const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes
            localStorage.setItem(
               gameKey,
               JSON.stringify({
                  share_id: currentShareId,
                  shared: true,
                  expiry: expiry,
               })
            );

            // Set timeout to expire after 15 minutes
            setTimeout(() => {
               setUnlimitedActivated(false);
               setHasShared(false);
               localStorage.removeItem(gameKey);
            }, 15 * 60 * 1000);

            // Stop checking once activated
            if (shareCheckIntervalRef.current) {
               clearInterval(shareCheckIntervalRef.current);
               shareCheckIntervalRef.current = null;
            }
         }
      } catch (error) {
         // Error checking share status - share doesn't exist, deactivate unlimited
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
```

#### 2.5.4 Mount Check për Existing Share (OBLIGATIVE)

Çdo lojë duhet të kontrollojë localStorage dhe URL në mount:

```typescript
// Check for existing share on mount
useEffect(() => {
   const gameKey = "play50games_shared_game-id"; // Zëvendëso "game-id"
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
                  const hasClicks = status.has_clicks || status.clicks > 0;
                  if (hasClicks) {
                     // Share exists in backend and has clicks - activate unlimited
                     if (
                        data.shared &&
                        data.expiry &&
                        Date.now() < data.expiry
                     ) {
                        // Already activated and not expired
                        setHasShared(true);
                        setUnlimitedActivated(true);
                        setReplaysUsed(0); // Ose setHintsUsed(0)

                        // Set timeout to expire after remaining time
                        const remainingTime = data.expiry - Date.now();
                        if (remainingTime > 0) {
                           setTimeout(() => {
                              setUnlimitedActivated(false);
                              setHasShared(false);
                              localStorage.removeItem(gameKey);
                           }, remainingTime);
                        }
                     } else {
                        // Has clicks but not activated yet - activate now
                        setHasShared(true);
                        setUnlimitedActivated(true);
                        setReplaysUsed(0); // Ose setHintsUsed(0)
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
         // Error parsing stored data - clean up
         localStorage.removeItem(gameKey);
      }
   }

   // Check URL for shared parameter
   const urlParams = new URLSearchParams(window.location.search);
   const sharedBy = urlParams.get("shared");
   if (sharedBy) {
      // Track the share click when someone opens the link
      trackShareClick(sharedBy);
      setCurrentShareId(sharedBy);
   }
}, []);
```

#### 2.5.5 Share Button UI (OBLIGATIVE)

Share button dhe Replay button duhet të kenë design të njëjtë për të gjitha lojërat:

**OBLIGATIVE:** Të gjitha butonat (Share dhe Replay) duhet të kenë styling të njëjtë:

```typescript
{
   /* Replay Button (vetëm kur gameState === "failed") */
}
{
   gameState === "failed" && (
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
               maxReplays > 0 && replaysUsed >= maxReplays
                  ? "not-allowed"
                  : "pointer",
            opacity: maxReplays > 0 && replaysUsed >= maxReplays ? 0.5 : 1,
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
   );
}

{
   /* Share Button */
}
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
>
   <ShareIcon
      style={{
         width: isMobile ? 18 : 20,
         height: isMobile ? 18 : 20,
         color: "var(--accent)",
      }}
   />
   <span>Share for unlimited</span>
</button>;
```

**Rregulla të rëndësishme për Butonat:**

1. **Pozicionim**: Gjithmonë në fund të lojës (pas feedback messages), jo në top
2. **Container**: Butonat duhet të jenë në një `div` me `display: "flex"`, `gap: "12px"`, `flexWrap: "wrap"`, `justifyContent: "center"`, `width: "100%"`, `maxWidth: "800px"`
3. **Padding**: `padding: isMobile ? "10px 16px" : "10px 20px"` (jo 12px 24px, 14px 28px, ose më të mëdha)
4. **Font Size**: `fontSize: isMobile ? "0.85rem" : "0.95rem"` (jo 0.9rem, 1rem, 1.05rem, ose më të mëdha)
5. **Font Weight**: `fontWeight: 600` (jo 700)
6. **Icons**: Të gjitha icons duhet të kenë madhësi `isMobile ? 18 : 20` (jo 16, 22, ose më të mëdha)
7. **Gap**: Gap midis icon dhe tekstit duhet të jetë `gap: isMobile ? "6px" : "8px"` (jo 10px ose më të mëdha)
8. **ShareIcon Color**: Duhet të ketë `color: "var(--accent)"`
9. **Share Button Text**: Duhet të jetë "Share for unlimited" (jo "Share for Unlimited Replays" ose "Share for Unlimited Hints")
10.   **Replay Button Background**: Duhet të përdorë `rgba(125, 211, 252, 0.2)` dhe `rgba(125, 211, 252, 0.1)` për gradient (jo `rgba(59, 130, 246, ...)`)
11.   **Replay Button Border**: Duhet të përdorë `rgba(125, 211, 252, 0.6)` (jo `rgba(59, 130, 246, 0.6)`)
12.   **Disabled State**: Replay button duhet të ketë `background: "rgba(100, 100, 100, 0.2)"`, `border: "1px solid rgba(100, 100, 100, 0.4)"`, `opacity: 0.5`, dhe `cursor: "not-allowed"` kur është disabled

#### 2.5.6 Share Messages (OBLIGATIVE)

Çdo lojë duhet të shfaqë këto mesazhe:

**1. Share Success Message** (kur link-u kopjohet):

```typescript
{
   shareSuccess && !unlimitedActivated && (
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
         Link copied! Unlimited replay will unlock when someone opens your link!
         {/* Ose "Unlimited hints will unlock..." për hints */}
      </div>
   );
}
```

**2. Unlimited Activated Message** (kur dikush klikon link-un):

```typescript
{
   unlimitedActivated && (
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
            marginBottom: "8px",
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
            🎉 Someone opened your link! Unlimited replay is now active for 15
            minutes!
            {/* Ose "Unlimited hints is now active..." për hints */}
         </span>
      </div>
   );
}
```

#### 2.5.7 Rregulla të Rëndësishme

1. **Game Key**: Përdor format `"play50games_shared_game-id"` ku `game-id` është ID e lojës (p.sh. `"click-green"`, `"ball-balance"`, `"symbol-stack"`)
2. **Share ID Format**: Përdor format `Date.now().toString(36) + Math.random().toString(36).substr(2, 5)` për shareId
3. **Expiry Time**: 15 minuta (15 _ 60 _ 1000 ms) pasi dikush klikon link-un
4. **Check Interval**: Kontrollo share status çdo 10 sekonda (10000 ms)
5. **Message Duration**: Share success message shfaqet për 15 sekonda
6. **Unlimited Duration**: Unlimited replays/hints aktivizohen për 15 minuta
7. **URL Tracking**: Kur dikush hap link-un me `?shared=shareId`, thirr `trackShareClick(shareId)` për të regjistruar click-in
8. **Personal Share ID**: Secila person ka shareId të vet personal që ruhet në localStorage. Kur dikush hap link-un, kontrollo nëse `sharedBy` ekziston në localStorage. Nëse ekziston dhe `data.share_id === sharedBy`, atëherë vendos `setCurrentShareId(sharedBy)` për të kontrolluar share status për shareId e vet. Nëse nuk ekziston (d.m.th. është shareId e personit që ka share-uar), mos vendos `setCurrentShareId` - kjo parandalon që personi që hap link-un të aktivizojë unlimited për vete.
9. **localStorage Cleanup**: Fshi localStorage kur share skadon ose kur ka error (404, not found, expired)
10.   **Interval Cleanup**: Fshi interval-in kur share aktivizohet ose kur komponenti unmount
11.   **Error Handling**: Handle 404, not found, expired errors dhe clean up state dhe localStorage

**Rregull i Rëndësishëm për URL Tracking:**

Kur dikush hap link-un me `?shared=shareId`, logjika duhet të jetë:

```typescript
// Check URL for shared parameter
const urlParams = new URLSearchParams(window.location.search);
const sharedBy = urlParams.get("shared");
if (sharedBy) {
   // Track the share click when someone opens the link
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
```

**Kjo siguron që:**

-  Personi që share-on kontrollon share status për shareId e vet dhe aktivizon unlimited kur dikush klikon link-un
-  Personi që hap link-un nuk aktivizon unlimited për vete, vetëm regjistron click-in për personin që ka share-uar
-  Secila person ka shareId të vet personal që ruhet në localStorage të tij

#### 2.5.8 Imports (OBLIGATIVE)

Çdo lojë duhet të importojë:

```typescript
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";
```

#### 2.5.9 Checklist për Share Feature

-  [ ] State variables të definuara (`hasShared`, `shareSuccess`, `unlimitedActivated`, `currentShareId`, `shareCheckIntervalRef`)
-  [ ] `getShareableLink()` function
-  [ ] `registerShareLink()` function me gameKey të saktë
-  [ ] `handleShare()` function me Web Share API dhe clipboard fallback
-  [ ] `handleCopyLink()` function me textarea fallback
-  [ ] useEffect për share status checking (çdo 10 sekonda)
-  [ ] useEffect për mount check (localStorage + URL)
-  [ ] Share button me tekst të saktë ("Share for Unlimited Replays" ose "Share for Unlimited Hints")
-  [ ] Share success message me styling të saktë
-  [ ] Unlimited activated message me styling të saktë
-  [ ] Cleanup në useEffect return functions
-  [ ] Error handling për 404, not found, expired
-  [ ] localStorage cleanup kur share skadon
-  [ ] Game key format i saktë (`play50games_shared_game-id`)
-  [ ] Share ID format i saktë
-  [ ] Expiry time: 15 minuta
-  [ ] Check interval: 10 sekonda
-  [ ] Message duration: 15 sekonda
-  [ ] URL tracking me `trackShareClick()`

---

## 3. Sistemet e Lojës

### 3.1 Scoring System (OBLIGATIVE)

#### Round-based Scoring (për lojëra me rounds):

-  Çdo round kontribuon në score total
-  Formula: `roundScore = Math.round(100 / maxRounds)`
-  Score total = shuma e të gjitha round-eve të përfunduara me sukses

#### Time-based Scoring (për lojëra me kohë):

-  Score bazuar në kohën e përfunduar
-  Formula: `score = Math.max(0, 100 - (timeUsed / timeLimit) * 100)`

#### Accuracy-based Scoring (për lojëra me accuracy):

-  Score bazuar në saktësinë e përgjigjeve
-  Formula: `score = (correctAnswers / totalAnswers) * 100`

#### Score Update:

-  Përditësohet pas çdo veprimi të suksesshëm
-  Thirret `onScoreUpdate(newScore)` me `setTimeout(() => {...}, 0)` për të shmangur React warnings

### 3.2 Round Management (për lojëra me rounds)

#### Round Progression:

-  Rounds fillojnë nga 1 (ose 0 nëse përdoret si index)
-  Përdor `useEffect` për të startuar round të ri kur `currentRound` ndryshon
-  Validim që round nuk kalon `maxRounds`

#### Round Completion:

-  **Sukses**: Update score → Set feedback "correct" → Pas 1-1.5 sekondash, advance në round tjetër
-  **Gabim**: Set feedback "wrong" → Pas 1-1.5 sekondash, **përsërit round-in e njëjtë** (jo call `onComplete`)
-  Reset të gjitha states (selected, hints, wrong indicators)
-  Shfaq përsëri memorizing phase me të njëjtat elemente
-  Pastaj fillon input phase përsëri
-  `onComplete` thirret vetëm kur loja përfundon plotësisht (të gjitha rounds ose koha skadon)

### 3.3 Game Completion (OBLIGATIVE)

-  Kur loja përfundon (të gjitha rounds, koha skadon, ose gabim), thirret `onComplete(finalScore)`
-  Përdoret `setTimeout(() => {...}, 1000)` për të dhënë kohë për feedback
-  `finalScore` duhet të jetë numri i plotë 0-100

---

## 4. Konfigurimi

### 4.1 Backend Configuration (OBLIGATIVE)

Në `games.php`, çdo lojë duhet të ketë:

```php
'game-id': {
    title: 'Game Title',
    gameType: 'memory', // 'memory', 'logic', 'speed', 'skill', 'final'
    gameOrder: 18,
    difficulty: 2, // 1-5
    timeLimit: 60, // sekonda (0 për lojëra pa kohë)
    passingScore: 75, // 0-100
    unlockRequirement: '', // ose ID e lojës paraardhëse
    description: 'Game description',
    gameConfig: '{"gameType": "game-id", "rounds": 20, ...}'
}
```

### 4.2 gameConfig JSON (OBLIGATIVE)

```json
{
   "gameType": "game-id",
   "rounds": 20 // për lojëra me rounds
   // Ose çdo konfigurim tjetër specifik për lojën
}
```

### 4.3 Game Instructions (OBLIGATIVE)

Në `gameInstructions.ts`:

```typescript
'game-id': {
  description: 'Game description',
  instructions: 'Detailed instructions on how to play',
  tips: 'Helpful tips for players',
  mouseControls: [
    { action: 'Click', label: 'Description of mouse action' }
  ],
  keyboardControls: [ // Opsional
    { keys: ['1', '2', '3'], label: 'Description of keyboard action' }
  ]
}
```

### 4.4 Interactive Example (OPSIONAL por i rekomanduar)

Në `GameEngine.tsx`, mund të shtohet një shembull interaktiv:

```typescript
{
   gameType === "game-id" && (
      <div
         style={
            {
               /* Example container */
            }
         }
      >
         {/* Interactive example UI */}
      </div>
   );
}
```

### 4.5 Shuffle dhe Renditje (për lojëra me selection)

#### Shuffle i Elementeve:

-  Nëse loja ka elemente që duhen zgjedhur (names, options, etj.), ato duhet të jenë të shuffle-tuara
-  **Shuffle vetëm një herë**: Shuffle ndodh vetëm kur fillon round-i, jo çdo herë që komponenti re-render
-  Përdor `useState` për të ruajtur shuffled array, jo `useMemo` me `Math.random()`
-  Rillogarit shuffle vetëm kur fillon round i ri (kur `facePairs` ose elementet bazë ndryshojnë)

```typescript
// ✅ E saktë - Shuffle vetëm një herë
const [shuffledNames, setShuffledNames] = useState<string[]>([]);

useEffect(() => {
   if (facePairs.length > 0) {
      const names = facePairs.map((p) => p.name);
      const shuffled = [...names].sort(() => Math.random() - 0.5);
      setShuffledNames(shuffled);
   }
}, [facePairs]); // Vetëm kur facePairs ndryshon

// ❌ E gabuar - Shuffle nonstop
const shuffledNames = useMemo(() => {
   return [...availableNames].sort(() => Math.random() - 0.5);
}, [availableNames]); // Rillogaritet çdo herë
```

---

## 5. Udhëzimet

### 5.1 Responsive Design (OBLIGATIVE)

#### Mobile Detection:

```typescript
const [isMobile, setIsMobile] = useState(false);
const [isTablet, setIsTablet] = useState(false);

useEffect(() => {
   const checkSize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
   };
   checkSize();
   window.addEventListener("resize", checkSize);
   return () => window.removeEventListener("resize", checkSize);
}, []);
```

#### Conditional Styling:

-  Font sizes: `isMobile ? "0.85rem" : "1rem"`
-  Padding: `isMobile ? "12px" : "24px"`
-  Gaps: `isMobile ? "8px" : "12px"`
-  Button sizes: më të vogla në mobile

#### Touch Optimization:

-  Buttons duhet të jenë mjaftueshëm të mëdha për touch (min 44x44px)
-  Spacing më i madh midis elementeve në mobile

### 5.2 Visual Feedback (OBLIGATIVE)

#### Correct/Wrong States:

-  Borders me ngjyra: `var(--ok)` për correct, `var(--warn)` për wrong
-  Background gradients me opacity
-  Box shadows për theksim
-  Scale animations: `transform: scale(1.05)` në hover

#### Active States:

-  Border më i trashë
-  Background më i ndritur
-  Box shadow më i fortë
-  Scale animation
-  z-index më i lartë

#### Transitions:

-  Të gjitha ndryshimet duhet të kenë `transition: "all 0.2s ease"`

#### Feedback Pas Përfundimit:

-  Feedback message shfaqet vetëm pasi të gjitha zgjedhjet janë bërë
-  Nëse ka gabime, shfaqet "Try again! You can do it!" dhe round-i përsëritet
-  Nëse është korrekt, shfaqet "Correct! Great job!" dhe kalon në round tjetër

### 5.3 Icons dhe Styling (OBLIGATIVE)

#### Heroicons:

-  Përdor Heroicons në vend të emojis
-  Import nga `@heroicons/react/24/outline`
-  Konsistencë në madhësi dhe ngjyra

#### CSS Variables:

-  Përdor CSS variables për ngjyra: `var(--card)`, `var(--stroke)`, `var(--text)`, `var(--accent)`, `var(--ok)`, `var(--warn)`
-  Gradient backgrounds për theksim
-  Border radius konsistente: `12px`, `14px`, `16px`, `20px`

### 5.4 Error Handling (OBLIGATIVE)

#### React Warnings:

-  Përdor `setTimeout(() => {...}, 0)` për state updates që mund të shkaktojnë warnings
-  Përdor `useRef` për vlera që nuk duhen në dependency arrays

#### Game Logic Errors:

-  Validim i input-it para se të ekzekutohet logjika
-  Try-catch blocks për API calls
-  Fallback values për config që mungon

### 5.5 Performance (OBLIGATIVE)

#### Memoization:

-  Përdor `useMemo` për llogaritje të rënda
-  Përdor `useCallback` për funksione që kalojnë si props

#### Cleanup:

-  Cleanup në `useEffect` return functions
-  Clear intervals/timeouts kur komponenti unmount

### 5.6 Auto Start (OBLIGATIVE)

-  Lojët duhet të fillojnë automatikisht kur `isPlaying` bëhet `true`
-  Hiq `showTutorial` state dhe "Start Game" button
-  Set `gameState` direkt në `"playing"` ose `"memorizing"` në mount

### 5.7 Keyboard Controls (OPSIONAL por i rekomanduar)

Nëse loja ka nevojë për keyboard controls:

#### Implementimi:

-  Përdor `useEffect` me `addEventListener("keydown")`
-  **Prevent default**: Përdor `e.preventDefault()` për të shmangur veprimet e paracaktuara të browser-it
-  **Cleanup**: Hiq event listener në return function të `useEffect`

#### Kontrollet Standarde:

-  **Numrat 1-9**: Për selection (zgjedhje direkte)
-  **Arrow keys**: Për navigim (lart, poshtë, majtas, djathtas)
-  **WASD**: Për navigim (W=up, S=down, A=left, D=right)
-  **Enter/Space**: Për cycle ose confirm

#### Shembull:

```typescript
useEffect(() => {
   if (gameState !== "input") return;

   const handleKeyPress = (e: KeyboardEvent) => {
      // Prevent default për game controls
      if (
         (e.key >= "1" && e.key <= "9") ||
         e.key.startsWith("Arrow") ||
         ["w", "W", "s", "S", "a", "A", "d", "D", "Enter", " "].includes(e.key)
      ) {
         if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
         }
      }

      // Keyboard logic këtu
   };

   window.addEventListener("keydown", handleKeyPress);
   return () => window.removeEventListener("keydown", handleKeyPress);
}, [gameState /* dependencies */]);
```

#### Numrat në Cells (për lojëra me grid):

-  Nëse loja ka grid me cells, shto numra të vogla në çdo cell për keyboard controls
-  Numrat shfaqen në këndin e sipërm majtas (ose djathtas) të çdo cell
-  Numrat: 1-9 për pozicionet 1-9, "0" për pozicionin 10, "-" për pozicionin 11, "=" për pozicionin 12
-  Styling: Badge me gradient blu, border dhe shadow për theksim
-  Shfaqet vetëm në input mode, jo në memorizing mode
-  Nuk shfaqet nëse cell është e zgjedhur ose ka hint

```typescript
{
   gameState === "input" && !isSelected && !isHinted && (
      <div
         style={{
            position: "absolute",
            top: "4px",
            left: "4px", // ose "right" për këndin e djathtë
            width: isMobile ? "18px" : "20px",
            height: isMobile ? "18px" : "20px",
            borderRadius: "50%",
            background:
               "linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: isMobile ? "0.65rem" : "0.7rem",
            fontWeight: 700,
            color: "white",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
         }}
      >
         {idx < 9
            ? idx + 1
            : idx === 9
            ? "0"
            : idx === 10
            ? "-"
            : idx === 11
            ? "="
            : ""}
      </div>
   );
}
```

#### Dokumentim:

-  Të gjitha keyboard controls duhet të dokumentohen në `gameInstructions.ts` në `keyboardControls` array

---

## 6. Best Practices

1. **Konsistencë**: Përdor të njëjtat patterns si lojët e tjera
2. **Performance**: Memoize llogaritjet e rënda
3. **Accessibility**: Labels dhe ARIA attributes ku nevojitet
4. **Code Reusability**: Përdor komponente të përbashkëta ku është e mundur
5. **Documentation**: Komente në kod për logjikë komplekse
6. **Type Safety**: Përdor TypeScript types për props dhe state
7. **Error Handling**: Validim dhe fallback për edge cases
8. **Responsive Design**: Testo në mobile, tablet, dhe desktop
9. **Heroicons Integration**: Përdor Heroicons për të gjitha ikonat në lojë (në UI, shembuj, feedback, etj.)
   -  Import ikonat nga `@heroicons/react/24/outline`
   -  Përdor ikona konsistente për të njëjtat funksione (p.sh. `CheckCircleIcon` për correct, `XCircleIcon` për wrong, `TrophyIcon` për score, etj.)
   -  Përdor Heroicons edhe në shembujt GUI interaktivë në seksionin "How to Play"
10.   **Interactive GUI Example**: Shto një shembull GUI interaktiv në seksionin "How to Play" që tregon vizualisht si luhet loja

-  Shembulli duhet të jetë në `GameEngine.tsx` në seksionin `game-instructions-section`
-  Duhet të përdorë Heroicons për ikona
-  Duhet të ketë një strukturë të qartë me hapa të numëruar që shpjegojnë si luhet loja
-  Duhet të jetë responsive (mobile, tablet, desktop)
-  Duhet të përmbajë një "Example Round" që demonstron vizualisht mekanikën e lojës

11.   **Consistent Design**: Të gjitha lojërat duhet të kenë të njëjtin design si lojërat e tjera për konsistencë vizuale

-  **Header Section**: Përdor të njëjtin header design me card, level indicator (me ArrowPathIcon), score (me TrophyIcon), time (me ClockIcon), dhe progress bar me gradient
-  **Stats Display**: Përdor të njëjtin stil për stats badges (gradient backgrounds, borders, padding, font sizes)
-  **Level Complete State**: Përdor badge me "Level X Complete" (me CheckCircleIcon) dhe buton "Next Round" me të njëjtin stil gradient
-  **Level Failed State**: Përdor badge me "Level X Failed" (me XCircleIcon) dhe mesazh me të njëjtin stil
-  **Replay & Share Buttons**: Përdor të njëjtin design për butonat (gradient backgrounds, borders, padding, gap, responsive widths)
-  **Share Messages**: Përdor të njëjtat mesazhe për share success ("Link copied! Unlimited replay will unlock when someone opens your link!") dhe unlimited activated ("🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!")
-  **Game Complete State**: Përdor badge me "Game Complete!" (me TrophyIcon) me të njëjtin stil
-  **Layout Structure**: Përdor të njëjtën strukturë layout (flexbox, padding, gaps, max-width: 800px, etj.)
-  **Color Scheme**: Përdor të njëjtat ngjyra CSS variables (var(--card), var(--stroke), var(--accent), var(--ok), var(--warn), var(--muted), etj.)
-  **Responsive Design**: Përdor të njëjtat breakpoints dhe responsive styles (isMobile: <640px, isTablet: 640-1024px)
-  **Shiko FallingObjects.tsx si referencë** për design-in standard të Speed Games

---

## 8. Checklist

Para se të konsiderohet e kompletuar, një lojë duhet të ketë:

### Komponentet Bazë:

-  [ ] Header me round, score, dhe progress bar
-  [ ] Game board / play area
-  [ ] Feedback messages (correct/wrong) si në Match the Shapes
-  [ ] Nuk shfaqet feedback negativ gjatë lojës
-  [ ] Feedback negativ shfaqet vetëm pas përfundimit
-  [ ] Visual feedback menjëherë për elemente të zgjedhura gabimisht (të kuqe)
-  [ ] Responsive design për mobile, tablet, dhe desktop
-  [ ] **Heroicons Integration**: Të gjitha ikonat përdorin Heroicons nga `@heroicons/react/24/outline`
-  [ ] **Interactive GUI Example**: Shembull GUI interaktiv në "How to Play" që tregon vizualisht si luhet loja
-  [ ] **Consistent Design**: Design-i është i njëjtë si lojërat e tjera (header, stats, level complete/failed states, replay/share buttons, layout, colors, responsive)

### Sistemet:

-  [ ] Scoring system që llogarit saktë
-  [ ] Round progression që funksionon saktë (nëse ka rounds)
-  [ ] Game completion që thirr `onComplete` me score të saktë
-  [ ] Visual feedback për correct/wrong states
-  [ ] Transitions dhe animations të qetë

### Konfigurimi:

-  [ ] Game config në `games.php` me të gjitha detajet
-  [ ] Game instructions në `gameInstructions.ts`
-  [ ] Mouse controls në instructions (nëse ka)
-  [ ] Keyboard controls në instructions (nëse ka)
-  [ ] **Interactive GUI Example në GameEngine**: OBLIGATIVE - Shembull GUI interaktiv që tregon vizualisht si luhet loja me Heroicons

### Features Opsionale:

-  [ ] Hint system (nëse ka nevojë)

### Share Feature (OBLIGATIVE):

-  [ ] Share functionality e implementuar plotësisht (shiko seksionin 2.5)
-  [ ] State variables të definuara (`hasShared`, `shareSuccess`, `unlimitedActivated`, `currentShareId`, `shareCheckIntervalRef`)
-  [ ] `getShareableLink()`, `registerShareLink()`, `handleShare()`, `handleCopyLink()` functions
-  [ ] useEffect për share status checking (çdo 10 sekonda)
-  [ ] useEffect për mount check (localStorage + URL)
-  [ ] Share button në fund (jo në top) me tekst të saktë ("Share for Unlimited Replays" ose "Share for Unlimited Hints")
-  [ ] Share success message (15 sekonda) - "Link copied! Unlimited replay will unlock when someone opens your link!"
-  [ ] Unlimited activated message - "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!"
-  [ ] Game key format i saktë (`play50games_shared_game-id`)
-  [ ] Expiry time: 15 minuta
-  [ ] Check interval: 10 sekonda
-  [ ] **Personal Share ID**: Kur dikush hap link-un, kontrollo nëse `sharedBy` ekziston në localStorage. Nëse ekziston dhe `data.share_id === sharedBy`, atëherë vendos `setCurrentShareId(sharedBy)`. Nëse nuk ekziston, mos vendos `setCurrentShareId` - kjo parandalon që personi që hap link-un të aktivizojë unlimited për vete
-  [ ] Error handling dhe cleanup
-  [ ] Keyboard controls (nëse ka nevojë)
-  [ ] Prevent default për game controls
-  [ ] Dokumentuar në gameInstructions.ts
-  [ ] Numrat në cells (për lojëra me grid)
-  [ ] Shfaqen në input mode
-  [ ] Styling konsistent (badge blu me gradient)
-  [ ] Nuk shfaqen nëse cell është e zgjedhur ose ka hint
-  [ ] Shuffle i elementeve (nëse ka nevojë)
-  [ ] Shuffle vetëm një herë në fillim të round-it
-  [ ] Përdor useState, jo useMemo me Math.random()

### Quality Assurance:

-  [ ] Error handling për edge cases
-  [ ] Cleanup në useEffect hooks
-  [ ] Auto start pa tutorial screen
-  [ ] Nuk ka React warnings në console
-  [ ] Nuk ka linter errors
-  [ ] Testuar në mobile, tablet, dhe desktop

---

## 8. Shembuj të Plotë

Për shembuj të plotë, shiko:

-  **Memory Games**: `CardFlipMemory`, `EmojiMemory`, `WordMemory`, `PathMemory`, `FaceMemory` në `MemoryGames.tsx`
-  **Logic Games**: Shiko lojërat e tjera në `LogicGames.tsx`
-  **Speed Games**: Shiko lojërat e tjera në `SpeedGames.tsx`

Këto lojëra përmbajnë të gjitha elementet e listuara më sipër dhe shërbejnë si template për lojëra të reja.

---

## 9. Veçori Specifike për Lloje të Ndryshme Lojërash

### 9.1 Memory Games

-  Rounds me memorizim dhe input
-  Hint system për të zbuluar informacion
-  Share feature për unlimited hints

### 9.2 Logic Games

-  Puzzle solving
-  Pattern recognition
-  Logical reasoning

### 9.3 Speed Games

Speed Games janë lojëra që kërkojnë reagim të shpejtë dhe veprime në kohë reale. Ato kanë karakteristika të veçanta që i dallojnë nga lojërat e tjera.

#### 9.3.1 Karakteristikat Bazë

-  **Time-based challenges**: Lojërat bazohen në kohë dhe reagim të shpejtë
-  **Quick reactions**: Përdoruesi duhet të reagojë shpejt për të arritur rezultate të mira
-  **Time limits**: Ka kufizime kohore për çdo round ose level
-  **Real-time gameplay**: Elementet shfaqen dhe zhduken në kohë reale
-  **Progressive difficulty**: Vështirësia rritet me kalimin e kohës ose levels

#### 9.3.2 Level-based Structure (për lojëra me levels)

Nëse loja ka levels (si "Click the Green"):

##### Konfigurimi:

```json
{
   "gameType": "click-green",
   "levels": 10, // Numri total i levels
   "levelDuration": 20, // Koha në sekonda për çdo level
   "levelRequirements": [
      // Opsional: kërkesat specifike për çdo level
      { "minCorrectClicks": 3 }, // Level 1: minimum 3 correct clicks
      { "minCorrectClicks": 4 } // Level 2: minimum 4 correct clicks
      // ...
   ]
}
```

##### Scoring System:

-  **Score per level**: `Math.round(100 / maxLevels)` pikë për çdo level të kompletuar
-  **Level 1**: 10 pikë, **Level 2**: 20 pikë, **Level 3**: 30 pikë, etj.
-  **Final score**: 100 pikë kur të gjitha levels janë kompletuara
-  **Formula**: `score = completedLevels * (100 / maxLevels)`

##### Level Progression:

-  Levels fillojnë nga 0 (index) por shfaqen si 1, 2, 3, etj.
-  Kur përfundon një level, loja kalon automatikisht në level tjetër
-  Nëse level-i dështon, loja përsërit level-in e njëjtë (jo kalon në tjetrin)

##### Level Requirements:

-  **minCorrectClicks**: Numri minimal i klikimeve korrekte për të kaluar level-in
-  **minScore**: Opsional - score minimal për level (nëse nuk përdoret, kontrollohet vetëm minCorrectClicks)
-  Nëse kërkesat arrihen para se koha të skadojë, loja ngrihet dhe pret deri sa koha të skadojë
-  Pas skadimit të kohës, shfaqet mesazhi "Level Complete" me buton "Next Round"

##### Game States për Level-based Games:

-  **`"playing"`**: Loja është aktive, elementet shfaqen dhe përdoruesi mund të klikojë
-  **`"paused"`**: Kërkesat janë arritur, loja është ngritur dhe pret skadimin e kohës
-  **`"ready"`**: Level-i është kompletuar, shfaqet mesazhi "Level Complete" me buton "Next Round"
-  **`"failed"`**: Level-i dështoi, shfaqet mesazhi "Level Failed" me buton "Repeat the Round"

##### Freezing Game Logic:

Kur kërkesat arrihen (p.sh. `minCorrectClicks`):

1. **Immediately freeze**: Loja duhet të ngrihet menjëherë
2. **Stop spawning**: Të gjitha timers për spawning duhen fshirë
3. **Clear items**: Të gjitha item-et ekzistuese duhen fshirë për të parandaluar ndërveprime të mëtejshme
4. **Disable interactions**: Arena dhe items duhen bërë `pointer-events: none`
5. **Set state**: `gameState = "paused"` dhe `requirementsMet = true`
6. **Wait for timer**: Loja pret deri sa koha të skadojë
7. **Show completion**: Pas skadimit, shfaqet mesazhi "Level Complete" me buton "Next Round"

##### Implementation Example:

```typescript
// Check if requirements are met
useEffect(() => {
   if (gameState !== "playing" || requirementsMet) return;

   const minCorrectClicks = getMinCorrectClicks();
   const minScore = getMinScore();

   if (correctClicks >= minCorrectClicks && levelScore >= minScore) {
      // IMMEDIATELY freeze game
      clearAll(); // Stop spawning, clear items
      setTimeLeft(0); // Stop timer

      requirementsMetRef.current = true;
      setRequirementsMet(true);
      setGameState("paused");
      setFeedback(null);
   }
}, [correctClicks, levelScore, gameState, requirementsMet]);

// When timer reaches 0 and requirements are met
useEffect(() => {
   if (timeLeft === 0 && requirementsMet && gameState === "paused") {
      setGameState("ready");
   }
}, [timeLeft, requirementsMet, gameState]);
```

##### Level Completion dhe Game Completion:

-  **Level Complete**: Kur një level përfundon me sukses, shfaqet mesazhi "Level X Complete" me buton "Next Round"
-  **Game Complete**: Kur të gjitha levels përfundojnë, shfaqet mesazhi "Game Complete!" me "All X levels completed!" dhe "Final Score: 100"
-  **onComplete call**: `onComplete(100)` thirret për të shfaqur modalin dhe për të ruajtur progressin
-  **Passing Score**: Nëse score-i arrin `passingScore` (p.sh. 70) edhe nëse nuk ka përfunduar të gjitha levels, loja konsiderohet e kompletuar

##### Score Display:

-  **Header**: "Score: X / 100" - kur loja përfundon, duhet të shfaqë 100
-  **Final Score**: Në mesazhin e përfundimit, duhet të shfaqë 100 kur të gjitha levels janë kompletuara
-  **Conditional display**: `{currentLevel + 1 >= maxLevels && gameState === "ready" ? 100 : currentScore}`

##### Repeat Round Functionality:

-  Nëse level-i dështon, shfaqet mesazhi "Level X Failed" me "Need: X correct clicks"
-  Butoni "Repeat the Round" rinis level-in e njëjtë
-  Funksioni `handleRepeatRound` thërret `startLevel()` për të rinisur level-in

#### 9.3.3 Progressive Difficulty

Për lojëra me progressive difficulty:

-  **Spawn interval**: Rritet me level (p.sh. Level 1: 600ms, Level 10: 250ms)
-  **Item TTL**: Zvogëlohet me level (p.sh. Level 1: 2000ms, Level 10: 800ms)
-  **Spawn probability**: Rritet probabiliteti për të spawnuar më shumë items në levels më të larta

#### 9.3.4 Real-time Item Management

Për lojëra me items që shfaqen dhe zhduken:

-  **Spawn timer**: Përdor `setInterval` për të spawnuar items në intervale të rregullta
-  **Item TTL**: Çdo item ka një timeout që e fshin pas një kohe të caktuar
-  **Cleanup**: Të gjitha timers duhen fshirë kur loja ngrihet ose përfundon
-  **Item state**: Items duhen ruajtur në state me informacion për pozicion, color, clicked status, etj.

#### 9.3.5 Game Completion dhe Progress Saving

-  **onComplete call**: Duhet të thirret me `finalScore` eksplicit (p.sh. `onComplete(100)`)
-  **completionCalledRef**: Përdor `useRef` për të parandaluar thirrjet e shumta të `onComplete`
-  **Timeout**: Përdor `setTimeout` prej 1 sekonde për të dhënë kohë për feedback para se të thirret `onComplete`
-  **Progress saving**: `GameEngine` merr kujdesin për ruajtjen e progressit kur `onComplete` thirret
-  **Modal display**: Modali "Game Complete!" shfaqet automatikisht në `GameEngine` kur `isCompleted` bëhet `true`

#### 9.3.6 Replay/Repeat Functionality (për lojëra me levels)

Nëse loja ka levels dhe mund të dështojë:

##### Konfigurimi:

-  **Max replays**: 5 replays by default, unlimited nëse loja është shared
-  **Replay button**: Shfaqet kur level-i dështon ose gjatë lojës
-  **Replay counter**: Shfaq numrin e replays të mbetura: `Replay (X/5)` ose `Replay (∞)` për unlimited

##### Implementation:

```typescript
const [replaysUsed, setReplaysUsed] = useState(0);
const [hasShared, setHasShared] = useState(false);
const maxReplays = hasShared ? 0 : 5; // 0 = unlimited

const handleReplay = useCallback(() => {
   if (gameState !== "playing" && gameState !== "failed") return;
   if (maxReplays > 0 && replaysUsed >= maxReplays) return;

   // Reset level state
   setRequirementsMet(false);
   setGameState("playing");
   setFeedback(null);
   setCorrectAnswers(0);
   setWrongAnswers(0);
   setTimeLeft(levelDuration);
   clearAll();
   startLevel();
   setReplaysUsed((prev) => prev + 1);
}, [gameState, maxReplays, replaysUsed, startLevel, levelDuration, clearAll]);
```

##### UI Display:

-  **Button text**: "Replay (X/5)" ose "Replay (∞)" për unlimited
-  **Disabled state**: Disabled kur nuk ka më replays (nëse nuk është shared)
-  **Position**: Shfaqet në fund të lojës, bashkë me Share button

#### 9.3.7 Share Feature për Unlimited Replays

Nëse loja ka replay functionality:

##### Konfigurimi:

-  **Share button**: "Share for unlimited" (gjithmonë i njëjtë tekst)
-  **Share success message**: "Link copied! Unlimited replay will unlock when someone opens your link!" (15 sekonda)
-  **Unlimited activated message**: "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!" (15 sekonda)
-  **Expiry**: 15 minuta pasi dikush klikon link-un

##### Implementation:

```typescript
const [hasShared, setHasShared] = useState(false);
const [shareSuccess, setShareSuccess] = useState(false);
const [unlimitedActivated, setUnlimitedActivated] = useState(false);
const [currentShareId, setCurrentShareId] = useState<string | null>(null);

// Share functionality
const handleShare = async () => {
   const shareableLink = getShareableLink();
   const shareId = new URL(shareableLink).searchParams.get("shared") || "";
   await registerShareLink(shareId);
   // ... copy to clipboard or use Web Share API
   setShareSuccess(true);
   setTimeout(() => setShareSuccess(false), 15000);
};

// Check share status every 10 seconds
useEffect(() => {
   if (!currentShareId) return;
   const checkShareStatus = async () => {
      const status = await getShareStatus(currentShareId);
      if (status.has_clicks && !hasShared) {
         setHasShared(true);
         setUnlimitedActivated(true);
         setReplaysUsed(0);
         // Set expiry for 15 minutes
      }
   };
   checkShareStatus();
   const interval = setInterval(checkShareStatus, 10000);
   return () => clearInterval(interval);
}, [currentShareId, hasShared]);
```

#### 9.3.8 Keyboard Controls për Answer Selection

Për lojëra me multiple choice answers (si Fast Math):

##### Konfigurimi:

-  **Number keys (1-4)**: Për të zgjedhur direkt përgjigjen
-  **Number indicators**: Çdo button duhet të ketë një badge me numrin (1-4) në këndin e sipërm majtas
-  **Prevent default**: Përdor `e.preventDefault()` për të shmangur veprimet e paracaktuara

##### Implementation:

```typescript
// Keyboard support for 1, 2, 3, 4
useEffect(() => {
   if (
      !isPlaying ||
      gameState !== "playing" ||
      requirementsMet ||
      !problem ||
      !options.length
   ) {
      return;
   }

   const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if not typing in an input field
      if (
         e.target instanceof HTMLInputElement ||
         e.target instanceof HTMLTextAreaElement
      ) {
         return;
      }

      const key = e.key;
      if (key === "1" || key === "2" || key === "3" || key === "4") {
         const index = parseInt(key) - 1;
         if (index >= 0 && index < options.length) {
            e.preventDefault();
            handleAnswerClick(options[index]);
         }
      }
   };

   window.addEventListener("keydown", handleKeyPress);
   return () => {
      window.removeEventListener("keydown", handleKeyPress);
   };
}, [
   isPlaying,
   gameState,
   requirementsMet,
   problem,
   options,
   handleAnswerClick,
]);
```

##### Number Indicators në Buttons:

```typescript
<button>
   {/* Number indicator badge */}
   <div
      style={{
         position: "absolute",
         top: "4px",
         left: "4px",
         width: "24px",
         height: "24px",
         background: "rgba(59, 130, 246, 0.8)",
         borderRadius: "6px",
         display: "flex",
         alignItems: "center",
         justifyContent: "center",
         fontSize: "0.8rem",
         fontWeight: 800,
         color: "white",
         boxShadow: "0 2px 6px rgba(59, 130, 246, 0.4)",
      }}
   >
      {index + 1}
   </div>
   {/* Answer value */}
   <span>{option.toString()}</span>
</button>
```

#### 9.3.9 Progressive Difficulty për Math Games

Për lojëra me matematikë (si Fast Math):

##### Level-based Difficulty:

-  **Levels 1-5**: Operacione të thjeshta (addition/subtraction me numra të vegjël)
-  **Levels 6-10**: Operacione më komplekse (introduce multiplication, numra më të mëdhenj)
-  **Levels 11-15**: Të gjitha operacionet (addition, subtraction, multiplication), numra më të mëdhenj
-  **Levels 16-20**: Të gjitha operacionet përfshirë division, numra kompleks

##### Implementation:

```typescript
const generateProblem = useCallback(() => {
   const level = currentLevel;
   let a: number, b: number, op: string, answer: number;

   if (level < 5) {
      // Levels 1-5: Simple addition/subtraction (1-20)
      a = Math.floor(Math.random() * 20) + 1;
      b = Math.floor(Math.random() * 20) + 1;
      op = Math.random() > 0.5 ? "+" : "-";
   } else if (level < 10) {
      // Levels 6-10: Addition/subtraction (1-50), introduce multiplication
      // ...
   } else if (level < 15) {
      // Levels 11-15: All operations, larger numbers
      // ...
   } else {
      // Levels 16-20: All operations including division
      // ...
   }
   // ... calculate answer and generate options
}, [currentLevel]);
```

##### Negative Numbers Support:

-  Për subtraction, lejo rezultate negative (p.sh. 5 - 15 = -10)
-  Mos përdor `Math.max(0, a - b)` - lejo rezultate negative
-  Shfaq negative numbers siç duhet në buttons

##### Decimal Answers për Division:

-  Për division, përdor `option.toFixed(1)` për të shfaqur me 1 decimal place
-  Për kontrollin e korrektësisë, përdor tolerance: `Math.abs(selectedAnswer - problem.answer) < 0.01`

#### 9.3.10 Typing Games (si Typing Sprint)

Për lojëra me typing (si Typing Sprint):

##### Konfigurimi:

```json
{
   "gameType": "typing-sprint",
   "levels": 15,
   "levelRequirements": [
      {
         "minCorrectWords": 3,
         "duration": 30,
         "words": ["cat", "dog", "sun", "moon", "star"]
      },
      {
         "minCorrectWords": 4,
         "duration": 30,
         "words": ["apple", "banana", "orange"]
      }
      // ... më shumë levels
   ]
}
```

##### Karakteristikat e Rëndësishme:

1. **Level Requirements Structure**:

   -  **`minCorrectWords`**: Numri minimal i fjalëve/fjalive të sakta për të kaluar level-in
   -  **`duration`**: Koha në sekonda për çdo level (duhet të jetë në `levelRequirements`, jo në top level)
   -  **`words`**: Array i fjalëve/fjalive për level-in (mund të jetë array ose string me presje)

2. **Character Highlighting**:

   -  **Real-time feedback**: Shfaq karaktere të sakta në të gjelbër dhe të gabuara në të kuq
   -  **Character-by-character comparison**: Krahaso input-in me tekstin e duhur karakter pas karakteri
   -  **Visual feedback**: Përdor `var(--ok)` për të gjelbër dhe `var(--warn)` për të kuq
   -  **Background colors**: Përdor `rgba(134, 239, 172, 0.2)` për të gjelbër dhe `rgba(252, 165, 165, 0.2)` për të kuq

3. **Auto-submit Logic**:

   -  Kur input-i përputhet plotësisht me tekstin e duhur, auto-submit
   -  Përdor `useEffect` për të kontrolluar nëse `input === wordToCompare`
   -  Pas auto-submit, reset input dhe gjenero fjalë të re pas 300ms

4. **Wrong Character Tracking**:

   -  **Count wrong characters**: Për çdo karakter të gabuar, rrit `wrongWords` me +1
   -  **Track previous count**: Përdor `useRef` për të mbajtur numrin e karaktereve të gabuara të numëruara
   -  **Increment only new wrongs**: Rrit `wrongWords` vetëm për karakteret e reja të gabuara, jo për ato që janë numëruar tashmë
   -  **Reset on word completion**: Reset counter-in kur fjala përfundon saktë ose kur gjenerohet fjalë e re

5. **Input Handling**:

   -  **Space key**: Lejo hapësira për fjalitë (mos përdor `e.preventDefault()` për space)
   -  **Enter key**: Reset input nëse është i gabuar dhe rrit `wrongWords` me +1
   -  **Normal typing**: Të gjitha karakteret e tjera shkruhen normalisht

6. **Special Level Handling**:

   -  **Reverse typing (Level 9)**: Shfaq tekstin e kthyer, por përdoruesi shkruan normalisht
   -  **Character highlighting**: Krahaso input-in normal me tekstin e kthyer për highlighting
   -  **Comparison logic**: Për reverse level, kthe tekstin përsëri për krahasim

7. **Level Duration per Level**:

   -  **Per-level duration**: Çdo level mund të ketë kohë të ndryshme (përcaktohet në `levelRequirements[level].duration`)
   -  **Fallback**: Nëse nuk përcaktohet, përdor `defaultLevelDuration` (p.sh. 30 sekonda)
   -  **Timer reset**: Reset timer-in kur fillon level i ri

8. **Word Generation**:
   -  **Config words first**: Lexo fjalët nga `levelRequirements[level].words` nëse ekzistojnë
   -  **Fallback words**: Nëse nuk ka fjalë në config, përdor hardcoded default words
   -  **Random selection**: Zgjidh një fjalë të rastësishme nga lista për çdo level
   -  **Support both formats**: Mbështet si array ashtu edhe string me presje për `words`

##### Implementation Example:

```typescript
// Character highlighting
const renderHighlightedText = useCallback(() => {
   if (!currentText) return null;

   return currentText.split("").map((char, index) => {
      let status: "correct" | "wrong" | "pending" = "pending";

      if (input && input.length > 0 && index < input.length) {
         status = input[index] === currentText[index] ? "correct" : "wrong";
      }

      const color =
         status === "correct"
            ? "var(--ok)"
            : status === "wrong"
            ? "var(--warn)"
            : "var(--text)";
      const backgroundColor =
         status === "correct"
            ? "rgba(134, 239, 172, 0.2)"
            : status === "wrong"
            ? "rgba(252, 165, 165, 0.2)"
            : "transparent";

      return (
         <span
            key={index}
            style={{
               color,
               backgroundColor,
               padding: "2px 1px",
               borderRadius: "3px",
            }}
         >
            {char === " " ? "\u00A0" : char}
         </span>
      );
   });
}, [currentText, input]);

// Wrong character tracking
const prevWrongCountRef = useRef(0);

useEffect(() => {
   if (gameState !== "playing" || requirementsMet || !currentText) return;

   let wordToCompare = currentText;
   if (currentLevel === 8) {
      // Reverse level
      wordToCompare = currentText.split("").reverse().join("");
   }

   // Count wrong characters
   if (input.length > 0) {
      let wrongCount = 0;
      for (let i = 0; i < input.length && i < wordToCompare.length; i++) {
         if (input[i] !== wordToCompare[i]) {
            wrongCount++;
         }
      }
      if (input.length > wordToCompare.length) {
         wrongCount += input.length - wordToCompare.length;
      }

      if (wrongCount > prevWrongCountRef.current) {
         const newWrongChars = wrongCount - prevWrongCountRef.current;
         setWrongWords((prev) => prev + newWrongChars);
         prevWrongCountRef.current = wrongCount;
      } else if (wrongCount < prevWrongCountRef.current) {
         prevWrongCountRef.current = wrongCount;
      }
   }

   // Auto-submit on correct
   if (input === wordToCompare) {
      setCorrectWords((prev) => prev + 1);
      setInput("");
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
```

##### Checklist për Typing Games:

-  [ ] Character highlighting me ngjyra të gjelbër/të kuq
-  [ ] Auto-submit kur fjala është e saktë
-  [ ] Wrong character tracking (+1 për çdo karakter të gabuar)
-  [ ] Space key lejohet për fjalitë
-  [ ] Enter key reset input dhe rrit wrong words
-  [ ] Level duration konfigurohet për çdo level
-  [ ] Words/sentences konfigurohen për çdo level
-  [ ] Fallback words nëse nuk ka në config
-  [ ] Special level handling (reverse typing, etj.)
-  [ ] Timer reset kur fillon level i ri
-  [ ] Wrong count reset kur fjala përfundon ose gjenerohet fjalë e re

#### 9.3.11 Best Practices për Speed Games

1. **Performance**: Përdor `useRef` për timers dhe state që nuk duhen në dependency arrays
2. **Cleanup**: Gjithmonë fshi timers në cleanup functions
3. **State management**: Përdor `useRef` për state që duhet të jetë e aksesueshme në callbacks por nuk duhet të shkaktojë re-renders
4. **Freezing logic**: Kur loja ngrihet, sigurohu që të gjitha ndërveprimet janë disabled
5. **Score calculation**: Llogarit score-in bazuar në levels të kompletuara, jo në score-in aktual

   -  **Formula**: `roundScore = Math.round(100 / maxLevels)`
   -  **Per level**: Për çdo level të kompletuar, shto `roundScore` pikë
   -  **Total score**: `newScore = Math.min(100, completedLevels * roundScore)`
   -  **Final score**: Kur kompleton të gjitha levels, `finalScore = 100`
   -  **Example**: Për 15 levels:
      -  Level 1 kompletuar: `Math.round(100 / 15) = 7` pikë
      -  Level 2 kompletuar: `2 * 7 = 14` pikë
      -  Level 3 kompletuar: `3 * 7 = 21` pikë
      -  ...
      -  Level 15 kompletuar: `Math.min(100, 15 * 7) = 100` pikë
   -  **Implementation**:

      ```typescript
      // Kur requirements janë plotësuar
      const roundScore = Math.round(100 / maxLevels);
      const completedLevels = currentLevel + 1;
      const newScore = Math.min(100, completedLevels * roundScore);
      setCurrentScore(newScore);
      onScoreUpdate(newScore);

      // Kur kompleton të gjitha levels
      if (completedLevels >= maxLevels) {
         const finalScore = 100;
         onComplete(finalScore);
      }
      ```

   -  **Mos përdor**: Score bazuar në performancë (p.sh. taps vs minTaps, correct answers vs total, etj.) - kjo mund të shkojë mbi 100
   -  **Përdor**: Score bazuar vetëm në numrin e leveleve të kompletuara

6. **Passing score**: Kontrollo në fund nëse score-i >= passingScore, por mos e ndërpre lojën
7. **Config parsing**: Sigurohu që `config.levels` dhe `config.levelDuration` merren siç duhet nga backend

-  Përdor `config?.levels ? Number(config.levels) : 20` për të siguruar që vlera është numër
-  Kontrollo nëse `config` përmban vlerat e saktë nga `gameConfig`

8. **Keyboard controls**: Përdor `e.preventDefault()` për të shmangur veprimet e paracaktuara
9. **Number indicators**: Shto badge me numra (1-4) në buttons për keyboard shortcuts
10.   **Negative numbers**: Lejo rezultate negative për subtraction
11.   **Decimal answers**: Përdor tolerance për kontrollin e korrektësisë së division answers
12.   **Character highlighting**: Për typing games, shfaq feedback real-time për karaktere të sakta/gabuara
13.   **Wrong character tracking**: Për typing games, rrit wrong words për çdo karakter të gabuar
14.   **Level-specific config**: Përdor `levelRequirements` për konfigurim specifik për çdo level (duration, words, etj.)
15.   **Auto-submit**: Për typing games, auto-submit kur input-i përputhet plotësisht
16.   **Input handling**: Lejo hapësira për fjalitë, përdor Enter për reset nëse është i gabuar
17.   **Time management**: Për lojëra me timer, kontrollo kur koha përfundon dhe shfaq "failed" nëse kërkesat nuk janë plotësuar
18.   **Progress tracking**: Për lojëra me levels, përdor progress bar bazuar në nivelet e përfunduara, jo për secilin correct answer
19.   **Number comparison**: Për lojëra me krahasim numrash, sigurohu që logjika e krahasimit është e saktë për të gjitha llojet e numrave (integers, decimals, negative)
20.   **Number formatting**: Për lojëra me numra, përdor `toLocaleString()` për numra të mëdhenj (1000+) dhe `toFixed(precision)` për numra decimal. Përdor `displayLeft`/`displayRight` për formatim të veçantë nga vlerat aktuale
21.   **Prevent equal values**: Për lojëra me krahasim, sigurohu që vlerat e gjeneruara nuk janë të barabarta (p.sh. `while (left === right) { regenerate }`)
22.   **Feedback timing**: Për lojëra me feedback, përdor delay (300ms) pas feedback përpara se të gjenerosh element të ri, për të lejuar përdoruesit të shohë rezultatin
23.   **Level description**: Për lojëra me levels, shfaq përshkrim të level-it aktual që tregon llojin e challenge (p.sh. "Simple Integers (1-50)", "Decimals (0.1-10)")
24.   **Consistent Design**: Të gjitha lojërat duhet të kenë të njëjtin design si lojërat e tjera për konsistencë vizuale


    -  **Header Section**: Përdor të njëjtin header design me card, level indicator, score, time, dhe progress bar
    -  **Stats Display**: Përdor të njëjtin stil për stats (badges me gradient backgrounds dhe borders)
    -  **Level Complete State**: Përdor badge me "Level X Complete" dhe buton "Next Round" me të njëjtin stil
    -  **Level Failed State**: Përdor badge me "Level X Failed" dhe mesazh me të njëjtin stil
    -  **Replay & Share Buttons**: Përdor të njëjtin design për butonat e replay dhe share (gradient backgrounds, borders, padding, etj.)
    -  **Share Messages**: Përdor të njëjtat mesazhe për share success dhe unlimited activated
    -  **Game Complete State**: Përdor badge me "Game Complete!" dhe TrophyIcon me të njëjtin stil
    -  **Layout Structure**: Përdor të njëjtën strukturë layout (flexbox, padding, gaps, max-width, etj.)
    -  **Color Scheme**: Përdor të njëjtat ngjyra CSS variables (var(--card), var(--stroke), var(--accent), var(--ok), var(--warn), etj.)
    -  **Responsive Design**: Përdor të njëjtat breakpoints dhe responsive styles (isMobile, isTablet)
    -  **Shiko FallingObjects.tsx si referencë** për design-in standard të Speed Games

### 9.4 Skill Games

-  Precision required
-  Hand-eye coordination
-  Skill-based challenges

### 9.5 Final Games

-  Special mechanics
-  Unique features
-  Final challenges

---

**Shënim**: Ky dokument është i përgjithshëm dhe duhet të përshtatet sipas nevojave specifike të çdo loje. Për detaje më specifike, shiko implementimet e lojërave ekzistuese.
