# Kërkesat për një Lojë në Play50Games

Ky dokument përshkruan të gjitha komponentët dhe funksionalitetet që duhet të përmbajë një lojë në platformën Play50Games, bazuar në implementimet e Card Flip Memory dhe Emoji Memory.

## 1. Struktura Bazë e Lojës

### 1.1 Props dhe Interface
Çdo lojë duhet të pranojë këto props:
```typescript
{
  config: Record<string, any>;        // Konfigurimi i lojës nga backend
  onScoreUpdate: (score: number) => void;  // Callback për përditësimin e score
  onComplete: (finalScore?: number) => void; // Callback kur loja përfundon
  passingScore?: number;               // Score minimale për të kaluar (default: 70)
}
```

### 1.2 State Management
Lojët duhet të përdorin React Hooks për menaxhimin e state:
- `useState` për state lokal (round, score, game state, etj.)
- `useEffect` për side effects (start round, check completion, etj.)
- `useCallback` për funksione të memoizuara
- `useMemo` për vlera të memoizuara
- `useRef` për referenca të qëndrueshme

### 1.3 Game States
Lojët duhet të kenë state të qartë për fazat e lojës:
- `"tutorial"` - Ekran udhëzues (opsional, mund të hiqet nëse ka instructions në GameEngine)
- `"playing"` / `"memorizing"` - Faza e lojës
- `"input"` - Faza kur përdoruesi jep përgjigje
- `"correct"` - Përgjigje e saktë
- `"wrong"` - Përgjigje e gabuar

## 2. UI Components

### 2.1 Header Section
Çdo lojë duhet të ketë një header që shfaq:
- **Round**: "Round X / Y" me icon `ArrowPathIcon`
- **Score**: "Score: X / 100" me icon `TrophyIcon`
- **Progress Bar**: Një progress bar që tregon përparimin nëpër rounds

```typescript
<div style={{ /* Header styling */ }}>
  <div style={{ display: "flex", justifyContent: "space-between" }}>
    <span>
      <ArrowPathIcon /> Round {currentRound} / {maxRounds}
    </span>
    <span>
      <TrophyIcon /> Score: {currentScore} / 100
    </span>
  </div>
  <div style={{ /* Progress bar */ }}>
    <div style={{ width: `${(currentRound / maxRounds) * 100}%` }} />
  </div>
</div>
```

### 2.2 Game State Display
Një seksion që tregon gjendjen aktuale të lojës:
- Mesazh për çdo fazë (memorizing, input, correct, wrong)
- Icons përgjegjëse (`CheckCircleIcon` për correct, `XCircleIcon` për wrong)
- Badge me status (Memorizing, Your Turn, Correct, Wrong)

### 2.3 Feedback Messages
Mesazhe feedback si në Match the Shapes:
```typescript
{feedback !== null && (
  <div style={{
    padding: "16px 24px",
    borderRadius: "12px",
    fontSize: "1.1rem",
    fontWeight: 600,
    animation: "slideIn 0.3s ease-out",
    background: feedback === "correct" 
      ? "rgba(134, 239, 172, 0.2)" 
      : "rgba(252, 165, 165, 0.2)",
    border: `1px solid ${feedback === "correct" ? "var(--ok)" : "var(--warn)"}`,
    color: feedback === "correct" ? "var(--ok)" : "var(--warn)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  }}>
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
```

## 3. Scoring System

### 3.1 Round-based Scoring
- Çdo round kontribuon në score total
- Formula: `roundScore = Math.round(100 / maxRounds)`
- Score total = shuma e të gjitha round-eve të përfunduara me sukses

### 3.2 Score Update
- Përditësohet pas çdo round të suksesshëm
- Thirret `onScoreUpdate(newScore)` me `setTimeout(() => {...}, 0)` për të shmangur React warnings

### 3.3 Game Completion
- Kur loja përfundon (të gjitha rounds ose gabim), thirret `onComplete(finalScore)`
- Përdoret `setTimeout(() => {...}, 1000)` për të dhënë kohë për feedback

## 4. Responsive Design

### 4.1 Mobile Detection
```typescript
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };
  checkMobile();
  window.addEventListener("resize", checkMobile);
  return () => window.removeEventListener("resize", checkMobile);
}, []);
```

### 4.2 Conditional Styling
- Font sizes: më të vogla në mobile (`isMobile ? "0.85rem" : "1rem"`)
- Padding: më pak në mobile (`isMobile ? "12px" : "24px"`)
- Gaps: më të vogla në mobile (`isMobile ? "8px" : "12px"`)
- Button sizes: më të vogla në mobile

### 4.3 Touch Optimization
- Buttons duhet të jenë mjaftueshëm të mëdha për touch (min 44x44px)
- Spacing më i madh midis elementeve në mobile

## 5. Hint System (Opsional)

### 5.1 Hint State
```typescript
const [hintsUsed, setHintsUsed] = useState(0);
const [hasShared, setHasShared] = useState(false);
const [showHint, setShowHint] = useState(false);
const maxHints = hasShared ? 0 : 10; // 0 = unlimited
```

### 5.2 Hint Button
- Button me icon `LightBulbIcon`
- Disabled kur nuk ka më hints ose në fazë të gabuar
- Shfaq numrin e hints të mbetura: `Hint (X left)` ose `Hint (∞)`

### 5.3 Hint Logic
- Tregon informacion që ndihmon përdoruesin
- Fshihet pas 2 sekondash
- Rrit `hintsUsed` me 1

## 6. Share Feature (Opsional)

### 6.1 Share Functionality
```typescript
// Generate shareable link
const getShareableLink = (): string => {
  const currentUrl = window.location.href.split("?")[0];
  const shareId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  return `${currentUrl}?shared=${shareId}`;
};

// Register share link in backend
const registerShareLink = async (shareId: string) => {
  try {
    await registerShare(shareId, "game-type");
    const gameKey = "play50games_shared_game-type";
    localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
    setCurrentShareId(shareId);
  } catch (error) {}
};
```

### 6.2 Share Status Check
```typescript
useEffect(() => {
  if (currentShareId) {
    shareCheckIntervalRef.current = setInterval(async () => {
      try {
        const status = await getShareStatus(currentShareId);
        if (status && status.clicks > 0 && !unlimitedActivated) {
          setUnlimitedActivated(true);
          setHasShared(true);
          // Stop checking
          if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
          }
          // Expire after 15 minutes
          setTimeout(() => {
            setUnlimitedActivated(false);
            setHasShared(false);
          }, 15 * 60 * 1000);
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
```

### 6.3 Share Button
- Button me icon `ShareIcon`
- Përdor Web Share API nëse disponohet
- Fallback në clipboard copy
- Mesazh suksesi për 15 sekonda

## 7. Game Configuration (Backend)

### 7.1 games.php Structure
```php
'game-id': {
    title: 'Game Title',
    gameType: 'memory', // ose 'logic', 'speed', 'skill', 'final'
    gameOrder: 18,
    difficulty: 2, // 1-5
    timeLimit: 60, // sekonda
    passingScore: 75, // 0-100
    unlockRequirement: '', // ose ID e lojës paraardhëse
    description: 'Game description',
    gameConfig: '{"gameType": "game-id", "rounds": 20, ...}'
}
```

### 7.2 gameConfig JSON
```json
{
  "gameType": "game-id",
  "rounds": 20,
  "gridSizes": [[4, 4], [5, 5], [6, 7], [8, 8]], // Opsional
  // Ose çdo konfigurim tjetër specifik për lojën
}
```

## 8. Game Instructions

### 8.1 gameInstructions.ts
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

### 8.2 Interactive Example (Opsional)
Në `GameEngine.tsx`, mund të shtohet një shembull interaktiv:
```typescript
{gameType === "game-id" && (
  <div style={{ /* Example container */ }}>
    {/* Interactive example UI */}
  </div>
)}
```

## 9. Visual Feedback

### 9.1 Correct/Wrong States
- Borders me ngjyra: `var(--ok)` për correct, `var(--warn)` për wrong
- Background gradients me opacity
- Box shadows për theksim
- Scale animations: `transform: scale(1.05)` në hover

### 9.2 Active States
- Elementet aktive duhet të kenë:
  - Border më të trashë
  - Background më të ndritur
  - Box shadow më të fortë
  - Scale animation
  - z-index më të lartë

### 9.3 Transitions
- Të gjitha ndryshimet duhet të kenë `transition: "all 0.2s ease"` ose të ngjashme

## 10. Error Handling

### 10.1 React Warnings
- Përdor `setTimeout(() => {...}, 0)` për state updates që mund të shkaktojnë "Cannot update component while rendering" warnings
- Përdor `useRef` për vlera që nuk duhen në dependency arrays

### 10.2 Game Logic Errors
- Validim i input-it para se të ekzekutohet logjika
- Try-catch blocks për API calls
- Fallback values për config që mungon

## 11. Performance

### 11.1 Memoization
- Përdor `useMemo` për llogaritje të rënda
- Përdor `useCallback` për funksione që kalojnë si props

### 11.2 Cleanup
- Cleanup në `useEffect` return functions
- Clear intervals/timeouts kur komponenti unmount

## 12. Auto Start

### 12.1 No Tutorial Screen
- Lojët duhet të fillojnë automatikisht kur `isPlaying` bëhet `true`
- Hiq `showTutorial` state dhe "Start Game" button
- Set `gameState` direkt në `"playing"` ose `"memorizing"` në mount

## 13. Round Management

### 13.1 Round Progression
- Rounds duhet të fillojnë nga 1 (ose 0 nëse përdoret si index)
- Përdor `useEffect` për të startuar round të ri kur `currentRound` ndryshon
- Validim që round nuk kalon `maxRounds`

### 13.2 Round Completion
- Kur round përfundon me sukses:
  - Update score
  - Set feedback "correct"
  - Pas 1-1.5 sekondash, advance në round tjetër
- Kur round përfundon me gabim:
  - Set feedback "wrong"
  - Pas 1-1.5 sekondash, call `onComplete(currentScore)`

## 14. Grid Configuration

### 14.1 Dynamic Grid Sizes
```typescript
// Nga config ose llogaritje automatikisht
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
```

### 14.2 Grid Rendering
- Përdor CSS Grid: `gridTemplateColumns: repeat(${width}, 1fr)`
- Gap midis elementeve: `gap: isMobile ? "8px" : "10px"`
- Responsive maxWidth

## 15. Icons dhe Styling

### 15.1 Heroicons
- Përdor Heroicons në vend të emojis
- Import nga `@heroicons/react/24/outline`
- Konsistencë në madhësi dhe ngjyra

### 15.2 CSS Variables
- Përdor CSS variables për ngjyra: `var(--card)`, `var(--stroke)`, `var(--text)`, `var(--accent)`, `var(--ok)`, `var(--warn)`
- Gradient backgrounds për theksim
- Border radius konsistente: `12px`, `14px`, `16px`, `20px`

## 16. Testing Checklist

Para se të konsiderohet e kompletuar, një lojë duhet të ketë:

- [ ] Header me round, score, dhe progress bar
- [ ] Game state display me mesazhe të qarta
- [ ] Feedback messages (correct/wrong) si në Match the Shapes
- [ ] Responsive design për mobile, tablet, dhe desktop
- [ ] Scoring system që llogarit saktë
- [ ] Round progression që funksionon saktë
- [ ] Game completion që thirr `onComplete` me score të saktë
- [ ] Visual feedback për correct/wrong states
- [ ] Transitions dhe animations të qetë
- [ ] Error handling për edge cases
- [ ] Cleanup në useEffect hooks
- [ ] Auto start pa tutorial screen
- [ ] Game config në `games.php` me të gjitha detajet
- [ ] Game instructions në `gameInstructions.ts`
- [ ] Mouse controls në instructions (nëse ka)
- [ ] Keyboard controls në instructions (nëse ka)
- [ ] Interactive example në GameEngine (opsional por i rekomanduar)
- [ ] Hint system (nëse ka nevojë)
- [ ] Share feature (nëse ka nevojë)
- [ ] Nuk ka React warnings në console
- [ ] Nuk ka linter errors

## 17. Best Practices

1. **Konsistencë**: Përdor të njëjtat patterns si lojët e tjera
2. **Performance**: Memoize llogaritjet e rënda
3. **Accessibility**: Labels dhe ARIA attributes ku nevojitet
4. **Code Reusability**: Përdor komponente të përbashkëta ku është e mundur
5. **Documentation**: Komente në kod për logjikë komplekse
6. **Type Safety**: Përdor TypeScript types për props dhe state

## 18. Shembull i Plotë

Për një shembull të plotë, shiko:
- `CardFlipMemory` në `MemoryGames.tsx` (rreshtat 188-1200)
- `EmojiMemory` në `MemoryGames.tsx` (rreshtat 2369-3000+)

Këto lojëra përmbajnë të gjitha elementet e listuara më sipër dhe shërbejnë si template për lojëra të reja.

