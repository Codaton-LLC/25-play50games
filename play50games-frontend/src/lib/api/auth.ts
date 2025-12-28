import { getApiHeaders } from './apiUtils';

// Get API base URL
function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
    if (envUrl) return envUrl;
    const currentOrigin = window.location.origin;
    if (currentOrigin.includes('play50.games')) {
      return 'https://cms.play50.games/wp-json/play50/v1';
    }
    if (currentOrigin.includes('play50.game')) {
      return 'https://cms.play50.game/wp-json/play50/v1';
    }
    return 'http://localhost/wp-json/play50/v1';
  }
  return process.env.WORDPRESS_API_URL || 'http://localhost/wp-json/play50/v1';
}

const API_BASE = getApiBase();

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  nonce?: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user: User | null;
  nonce?: string;
}

/**
 * Register a new user
 */
export async function register(
  firstName: string,
  lastName: string,
  username: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: getApiHeaders(),
    credentials: 'include', // Important for cookies
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      username: username,
      email: email,
      password: password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Registration failed');
  }

  // Save JWT token if provided
  if (data.token) {
    const { setJwtToken } = await import('./apiUtils');
    setJwtToken(data.token);
  }

  return data;
}

/**
 * Login user
 */
export async function login(emailOrUsername: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: getApiHeaders(),
    credentials: 'include', // Important for cookies
    body: JSON.stringify({
      email_or_username: emailOrUsername,
      password: password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Login failed');
  }

  // Save JWT token if provided
  if (data.token) {
    const { setJwtToken } = await import('./apiUtils');
    setJwtToken(data.token);
  }

  return data;
}

/**
 * Check authentication status
 */
export async function checkAuthStatus(): Promise<AuthStatusResponse> {
  const response = await fetch(`${API_BASE}/auth/status`, {
    method: 'GET',
    headers: getApiHeaders(),
    credentials: 'include', // Important for cookies
  });

  if (!response.ok) {
    return { authenticated: false, user: null };
  }

  return response.json();
}

/**
 * Logout user
 */
export async function logout(): Promise<{ success: boolean; message?: string }> {
  try {
    // Remove JWT token first
    const { removeJwtToken } = await import('./apiUtils');
    removeJwtToken();
    
    const headers = getApiHeaders();
    const url = `${API_BASE}/auth/logout`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      credentials: 'include', // Important for cookies
    });

    if (!response.ok) {
      // Even if API call fails, we should still clear local state
      return { success: true, message: 'Logged out locally' };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    // If fetch fails (network error, CORS, etc.), still return success
    // The important thing is to clear local state
    return { success: true, message: 'Logged out locally (API unavailable)' };
  }
}

