import { GameProgress } from '@/types/game';
import { getApiBase } from './apiBase';
import { getApiHeaders } from './apiUtils';

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
  
  const headers = getApiHeaders();
  
  const response = await fetch(`${API_BASE}/progress`, {
    method: 'POST',
    headers: headers,
    credentials: 'include', // Important for cookies/session
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to save progress: ${response.status} ${errorText}`);
  }
  
  const data = await response.json();
  
  // Check if server saved to database or just locally
  if (data && data.success) {
    if (data.message && data.message.includes('saved locally')) {
      throw new Error('Server authentication failed - progress not saved to user account');
    }
  }
  
  return data;
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
  const response = await fetch(url, {
    headers: getApiHeaders(),
    credentials: 'include', // Important for cookies/session
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch progress');
  }
  
  return response.json();
}

export async function getUnlockStatus(guestId?: string): Promise<Record<number, boolean>> {
  const url = guestId
    ? `${API_BASE}/unlock-status?guest_id=${guestId}`
    : `${API_BASE}/unlock-status`;
  
  const response = await fetch(url, {
    headers: getApiHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch unlock status');
  }
  
  return response.json();
}

