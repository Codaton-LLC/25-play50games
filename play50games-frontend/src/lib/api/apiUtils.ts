/**
 * Get API Key from environment variable
 */
export function getApiKey(): string | null {
  if (typeof window !== 'undefined') {
    // Client-side: use NEXT_PUBLIC_ env var
    const apiKey = process.env.NEXT_PUBLIC_PLAY50_API_KEY || null;
    return apiKey;
  }
  // Server-side: use server env var
  return process.env.PLAY50_API_KEY || null;
}

/**
 * Get JWT token from localStorage
 */
export function getJwtToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('play50games_jwt_token');
}

/**
 * Save JWT token to localStorage
 */
export function setJwtToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('play50games_jwt_token', token);
}

/**
 * Remove JWT token from localStorage
 */
export function removeJwtToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('play50games_jwt_token');
}

/**
 * Get headers with API key and JWT token if available
 */
export function getApiHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };

  const apiKey = getApiKey();
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
    // Also add alternative header name
    headers['X-Play50-API-Key'] = apiKey;
  }

  // Add JWT token if available
  const jwtToken = getJwtToken();
  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }

  return headers;
}

