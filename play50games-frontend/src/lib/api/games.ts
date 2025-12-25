import { Game } from '@/types/game';

// Get API base URL - check environment variable first, then try to detect from current location
function getApiBase(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use NEXT_PUBLIC_ env var or detect from current origin
    const envUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
    if (envUrl) {
      // console.log('[API] Using environment variable:', envUrl);
      return envUrl;
    }
    
    // Try to detect WordPress URL from current page
    // If frontend is on play50.games or play50.game, WordPress might be on cms.play50.games or cms.play50.game
    const currentOrigin = window.location.origin;
    // console.log('[API] Current origin:', currentOrigin);
    
    if (currentOrigin.includes('play50.games')) {
      const apiUrl = 'https://cms.play50.games/wp-json/play50/v1';
      // console.log('[API] Detected play50.games domain, using:', apiUrl);
      return apiUrl;
    }
    
    if (currentOrigin.includes('play50.game')) {
      const apiUrl = 'https://cms.play50.game/wp-json/play50/v1';
      // console.log('[API] Detected play50.game domain, using:', apiUrl);
      return apiUrl;
    }
    
    // Default fallback
    const fallbackUrl = 'http://localhost/wp-json/play50/v1';
    console.warn('[API] No environment variable or domain detection, using fallback:', fallbackUrl);
    console.warn('[API] To fix: Create .env.local with NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.games/wp-json/play50/v1');
    return fallbackUrl;
  }
  
  // Server-side: use server env var
  return process.env.WORDPRESS_API_URL || 'http://localhost/wp-json/play50/v1';
}

const API_BASE = getApiBase();

export async function getAllGames(guestId?: string): Promise<Game[]> {
  const url = guestId 
    ? `${API_BASE}/games?guest_id=${guestId}`
    : `${API_BASE}/games`;
  
  // console.log('[API] Fetching games from:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // console.log('[API] Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Error response:', errorText);
      throw new Error(`Failed to fetch games: ${response.status} ${response.statusText}. URL: ${url}`);
    }
    
    const data = await response.json();
    // console.log('[API] Successfully fetched', data.length, 'games');
    return data;
  } catch (error: any) {
    console.error('[API] Fetch error:', error);
    
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
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to fetch game');
  }
  
  return response.json();
}

