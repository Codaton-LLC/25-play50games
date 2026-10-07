import { Game } from '@/types/game';
import { getApiBase } from './apiBase';
import { getApiHeaders } from './apiUtils';

export async function getAllGames(guestId?: string): Promise<Game[]> {
  // Get API base dynamically
  const apiBase = getApiBase();
  const url = guestId 
    ? `${apiBase}/games?guest_id=${guestId}`
    : `${apiBase}/games`;
  
  const headers = getApiHeaders();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      // Add cache for server-side
      ...(typeof window === 'undefined' && { next: { revalidate: 3600 } }),
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
        `Cannot connect to WordPress API at ${apiBase}.\n` +
        `Possible causes:\n` +
        `1. CORS issue - check backend CORS settings\n` +
        `2. Network/DNS issue - cannot reach ${apiBase}\n` +
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
  // Get API base dynamically (important for server-side)
  const apiBase = getApiBase();
  const url = guestId
    ? `${apiBase}/games/${gameId}?guest_id=${guestId}`
    : `${apiBase}/games/${gameId}`;
  
  const headers = getApiHeaders();
  
  const response = await fetch(url, {
    headers: headers,
    // Add cache for server-side (metadata generation)
    ...(typeof window === 'undefined' && { next: { revalidate: 3600 } }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch game: ${response.status} ${response.statusText}`);
  }
  
  const game = await response.json();
  
  return game;
}

