import { GameProgress } from '@/types/game';

// Get API base URL
function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
    if (envUrl) return envUrl;
    const currentOrigin = window.location.origin;
    if (currentOrigin.includes('play50.games')) {
      return 'https://cms.play50.games/wp-json/play50/v1';
    }
    return 'http://localhost/wp-json/play50/v1';
  }
  return process.env.WORDPRESS_API_URL || 'http://localhost/wp-json/play50/v1';
}

const API_BASE = getApiBase();

export async function saveProgress(
  gameId: number,
  score: number,
  completed: boolean,
  guestId?: string
): Promise<{ success: boolean; data?: GameProgress }> {
  const body: any = {
    game_id: gameId,
    score,
    completed: completed.toString(),
  };
  
  if (guestId) {
    body.guest_id = guestId;
  }
  
  const response = await fetch(`${API_BASE}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    throw new Error('Failed to save progress');
  }
  
  return response.json();
}

export async function getProgress(gameId?: number, guestId?: string): Promise<GameProgress | Record<number, GameProgress>> {
  const params = new URLSearchParams();
  if (gameId) {
    params.append('game_id', gameId.toString());
  }
  if (guestId) {
    params.append('guest_id', guestId);
  }
  
  const url = `${API_BASE}/progress${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to fetch progress');
  }
  
  return response.json();
}

export async function getUnlockStatus(guestId?: string): Promise<Record<number, boolean>> {
  const url = guestId
    ? `${API_BASE}/unlock-status?guest_id=${guestId}`
    : `${API_BASE}/unlock-status`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to fetch unlock status');
  }
  
  return response.json();
}

