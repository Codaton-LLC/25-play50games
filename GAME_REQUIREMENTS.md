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

#### Struktura Standarde:

-  **Title** me icon majtas dhe djathtas (opsional)
-  **Round**: "Round X / Y" me icon `ArrowPathIcon`
-  **Score**: "Score: X / 100" me icon `TrophyIcon`
-  **Progress Bar**: Një progress bar që tregon përparimin nëpër rounds

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

### 2.5 Share Feature (OPSIONAL)

Nëse loja ka nevojë për share:

-  **Share Button**: Me icon `ShareIcon`
-  **Pozicionim**: Gjithmonë në fund të lojës (pas feedback messages), jo në top
-  **Tekst**: Gjithmonë "Share for Unlimited Hints" (edhe në mobile dhe desktop, jo "Share")
-  **Web Share API**: Përdor nëse disponohet
-  **Clipboard Fallback**: Nëse Web Share API nuk disponohet
-  **Share Status Check**: Kontrollon nëse dikush ka klikuar link-un
-  **Unlimited Hints**: Aktivizohet kur dikush hap link-un (15 min expiry)
-  **Share Success Message**: Shfaqet pasi të kopjohet link-u
-  Mesazh: "Link copied! Unlimited hints will unlock when someone opens your link!"
-  Styling: background i gjelbër, border i gjelbër, CheckCircleIcon
-  Kohëzgjatja: 15 sekonda
-  **Unlimited Hints Activated Message**: Shfaqet kur dikush klikon link-un
-  Mesazh: "🎉 Someone opened your link! Unlimited hints is now active for 15 minutes!"
-  Styling: background blu, border blu, CheckCircleIcon
-  Kohëzgjatja: 15 sekonda (mesazhi), por unlimited hints aktivizohen për 15 minuta

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

---

## 7. Checklist

Para se të konsiderohet e kompletuar, një lojë duhet të ketë:

### Komponentet Bazë:

-  [ ] Header me round, score, dhe progress bar
-  [ ] Game board / play area
-  [ ] Feedback messages (correct/wrong) si në Match the Shapes
-  [ ] Nuk shfaqet feedback negativ gjatë lojës
-  [ ] Feedback negativ shfaqet vetëm pas përfundimit
-  [ ] Visual feedback menjëherë për elemente të zgjedhura gabimisht (të kuqe)
-  [ ] Responsive design për mobile, tablet, dhe desktop

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
-  [ ] Interactive example në GameEngine (opsional por i rekomanduar)

### Features Opsionale:

-  [ ] Hint system (nëse ka nevojë)
-  [ ] Share feature (nëse ka nevojë)
-  [ ] Share button në fund (jo në top)
-  [ ] Tekst: "Share for Unlimited Hints" (gjithmonë i njëjtë)
-  [ ] Share success message (15 sekonda) - "Link copied! Unlimited hints will unlock when someone opens your link!"
-  [ ] Unlimited hints activated message (15 sekonda) - "🎉 Someone opened your link! Unlimited hints is now active for 15 minutes!"
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
  "levels": 10,              // Numri total i levels
  "levelDuration": 20,        // Koha në sekonda për çdo level
  "levelRequirements": [      // Opsional: kërkesat specifike për çdo level
    {"minCorrectClicks": 3},  // Level 1: minimum 3 correct clicks
    {"minCorrectClicks": 4},  // Level 2: minimum 4 correct clicks
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

1.  **Immediately freeze**: Loja duhet të ngrihet menjëherë
2.  **Stop spawning**: Të gjitha timers për spawning duhen fshirë
3.  **Clear items**: Të gjitha item-et ekzistuese duhen fshirë për të parandaluar ndërveprime të mëtejshme
4.  **Disable interactions**: Arena dhe items duhen bërë `pointer-events: none`
5.  **Set state**: `gameState = "paused"` dhe `requirementsMet = true`
6.  **Wait for timer**: Loja pret deri sa koha të skadojë
7.  **Show completion**: Pas skadimit, shfaqet mesazhi "Level Complete" me buton "Next Round"

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

#### 9.3.6 Best Practices për Speed Games

1.  **Performance**: Përdor `useRef` për timers dhe state që nuk duhen në dependency arrays
2.  **Cleanup**: Gjithmonë fshi timers në cleanup functions
3.  **State management**: Përdor `useRef` për state që duhet të jetë e aksesueshme në callbacks por nuk duhet të shkaktojë re-renders
4.  **Freezing logic**: Kur loja ngrihet, sigurohu që të gjitha ndërveprimet janë disabled
5.  **Score calculation**: Llogarit score-in bazuar në levels të kompletuara, jo në score-in aktual
6.  **Passing score**: Kontrollo në fund nëse score-i >= passingScore, por mos e ndërpre lojën

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
