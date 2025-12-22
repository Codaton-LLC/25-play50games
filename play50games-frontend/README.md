# Play50Games Frontend

Next.js frontend for the Play50Games platform - a browser-based game platform with 50 games, progress tracking, and certificate generation.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file:
```env
NEXT_PUBLIC_WORDPRESS_API_URL=http://localhost/wp-json/play50/v1
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Home page (games list)
│   ├── games/[id]/        # Individual game pages
│   ├── progress/          # Progress dashboard
│   └── certificate/       # Certificate generation/view
├── components/
│   ├── GameEngine/        # Main game engine
│   │   └── game-types/    # Game type implementations
│   └── UnlockSystem/      # Game unlock logic
├── lib/
│   ├── api/              # WordPress REST API clients
│   ├── storage/           # Progress storage (localStorage + API)
│   └── utils/             # Utility functions
└── types/                 # TypeScript type definitions
```

## Features

- **5 Games** (MVP): Match Shapes, Color Sequence, Card Memory, Click Green, Ball Balance
- **Progress Tracking**: localStorage for guests, WordPress API for logged-in users
- **Unlock System**: Sequential game unlocking based on completion
- **Certificate Generation**: PDF certificate after completing all games
- **Responsive Design**: Works on desktop and mobile

## Game Types

- **Logic Games**: Match Shapes, Color Sequence
- **Memory Games**: Card Flip Memory
- **Speed Games**: Click the Green
- **Skill Games**: Ball Balance

## WordPress Backend

The frontend connects to a WordPress backend with REST API endpoints:
- `/wp-json/play50/v1/games` - Get all games
- `/wp-json/play50/v1/progress` - Save/get progress
- `/wp-json/play50/v1/certificate/generate` - Generate certificate

See the backend README for WordPress setup instructions.

