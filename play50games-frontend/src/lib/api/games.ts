import { Game } from '@/types/game';
import { getApiHeaders } from './apiUtils';

// Get API base URL - check environment variable first, then try to detect from current location
function getApiBase(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use NEXT_PUBLIC_ env var or detect from current origin
    const envUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
    if (envUrl) {
      return envUrl;
    }
    
    // Try to detect WordPress URL from current page
    // If frontend is on play50.games or play50.game, WordPress might be on cms.play50.games or cms.play50.game
    const currentOrigin = window.location.origin;
    
    if (currentOrigin.includes('play50.games')) {
      return 'https://cms.play50.games/wp-json/play50/v1';
    }
    
    if (currentOrigin.includes('play50.game')) {
      return 'https://cms.play50.game/wp-json/play50/v1';
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
  
  const headers = getApiHeaders();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch games: ${response.status} ${response.statusText}. URL: ${url}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    
    // Provide more specific error messages
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      throw new Error(
        `Cannot connect to WordPress API at ${API_BASE}.\n` +
        `Possible causes:\n` +
        `1. CORS issue - check backend CORS settings\n` +
        `2. Network/DNS issue - cannot reach ${API_BASE}\n` +
        `3. SSL/Certificate issue - check browser console\n` +
        `4. Firewall blocking the request\n\n` +
        `To fix: Create .env.local file with:\n` +
        `NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.games/wp-json/play50/v1`
      );
    }
    
    throw error;
  }
}

export async function getGame(gameId: number, guestId?: string): Promise<Game> {
  const url = guestId
    ? `${API_BASE}/games/${gameId}?guest_id=${guestId}`
    : `${API_BASE}/games/${gameId}`;
  
  const response = await fetch(url, {
    headers: getApiHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch game');
  }
  
  return response.json();
}

