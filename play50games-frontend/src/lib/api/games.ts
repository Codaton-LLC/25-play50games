import { Game } from '@/types/game';

// Get API base URL - check environment variable first, then try to detect from current location
function getApiBase(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use NEXT_PUBLIC_ env var or detect from current origin
    const envUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
    if (envUrl) return envUrl;
    
    // Try to detect WordPress URL from current page
    // If frontend is on play50.games, WordPress might be on cms.play50.games
    const currentOrigin = window.location.origin;
    if (currentOrigin.includes('play50.games')) {
      return 'https://cms.play50.games/wp-json/play50/v1';
    }
    
    // Default fallback
    return 'http://localhost/wp-json/play50/v1';
  }
  
  // Server-side: use server env var
  return process.env.WORDPRESS_API_URL || 'http://localhost/wp-json/play50/v1';
}

const API_BASE = getApiBase();

export async function getAllGames(guestId?: string): Promise<Game[]> {
  const url = guestId 
    ? `${API_BASE}/games?guest_id=${guestId}`
    : `${API_BASE}/games`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch games: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw new Error(`Cannot connect to WordPress API. Please check your API URL: ${API_BASE}`);
  }
}

export async function getGame(gameId: number, guestId?: string): Promise<Game> {
  const url = guestId
    ? `${API_BASE}/games/${gameId}?guest_id=${guestId}`
    : `${API_BASE}/games/${gameId}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to fetch game');
  }
  
  return response.json();
}

