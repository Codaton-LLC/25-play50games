# Heroicons - Udhëzime për Përdorim

## Instalimi

Heroicons është tashmë i instaluar në projekt:
```bash
npm install @heroicons/react
```

## Si të Përdorim

### Import

Heroicons ofron tre variante:

1. **Outline** (24x24, 1.5px stroke) - default
2. **Solid** (24x24, filled)
3. **Mini** (20x20, 1.5px stroke) - më të vogla

```tsx
// Outline icons (default)
import { HomeIcon, TrophyIcon, StarIcon } from '@heroicons/react/24/outline';

// Solid icons
import { HomeIcon as HomeIconSolid } from '@heroicons/react/24/solid';

// Mini icons
import { HomeIcon as HomeIconMini } from '@heroicons/react/20/solid';
```

### Përdorim në Komponente

```tsx
import { TrophyIcon, ClockIcon, StarIcon } from '@heroicons/react/24/outline';

function MyComponent() {
  return (
    <div>
      {/* Basic usage */}
      <TrophyIcon className="icon" />
      
      {/* With inline styles */}
      <ClockIcon style={{ width: 20, height: 20, color: 'var(--accent)' }} />
      
      {/* With custom size and color */}
      <StarIcon 
        style={{ 
          width: 16, 
          height: 16, 
          color: 'var(--ok)',
          marginRight: 8 
        }} 
      />
    </div>
  );
}
```

## Ikonat e Përdorura Aktualisht

Në `src/app/page.tsx`:
- `TrophyIcon` - për "View Progress"
- `CheckBadgeIcon` - për "Certificate" dhe "Complete" badge
- `InformationCircleIcon` - për "Diagnostics"
- `ClockIcon` - për kohën e lojës
- `StarIcon` - për difficulty rating

## Ikonat e Rekomanduara për Lojëra

- `PuzzlePieceIcon` - për lojëra puzzle
- `SparklesIcon` - për lojëra speciale
- `FireIcon` - për lojëra të vështira
- `BoltIcon` - për lojëra speed
- `PlayIcon` / `PauseIcon` - për kontrollin e lojës
- `CheckCircleIcon` / `XCircleIcon` - për feedback

## Dokumentacion i Plotë

Shiko të gjitha ikonat në: https://heroicons.com/

## Shembull Komponent

Shiko `src/components/Icons/IconExample.tsx` për shembuj të plotë.

