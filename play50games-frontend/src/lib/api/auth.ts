import { getApiBase } from './apiBase';
import { getApiHeaders } from './apiUtils';

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
  token?: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user: User | null;
  nonce?: string;
  /**
   * true only when the server answered HTTP 200 with parseable JSON, i.e. the
   * authenticated flag is the server's real verdict. false for non-OK statuses
   * (5xx, 401/403 from the API key check), non-JSON bodies and parse errors.
   */
  definitive?: boolean;
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

  // Check if response has content before parsing JSON
  const contentType = response.headers.get('content-type');
  const text = await response.text();
  
  let data: AuthResponse;
  
  if (!text || !contentType?.includes('application/json')) {
    // If response is not JSON, create error response
    if (!response.ok) {
      throw new Error('Registration failed: Invalid server response');
    }
    throw new Error('Registration failed: Unexpected response format');
  }

  try {
    data = JSON.parse(text);
  } catch (error) {
    // If JSON parsing fails, throw error
    if (!response.ok) {
      throw new Error('Registration failed: Invalid server response');
    }
    throw new Error('Registration failed: Could not parse server response');
  }

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

  // Check if response has content before parsing JSON
  const contentType = response.headers.get('content-type');
  const text = await response.text();
  
  let data: AuthResponse;
  
  if (!text || !contentType?.includes('application/json')) {
    // If response is not JSON, create error response
    if (!response.ok) {
      throw new Error('Login failed: Invalid server response');
    }
    throw new Error('Login failed: Unexpected response format');
  }

  try {
    data = JSON.parse(text);
  } catch (error) {
    // If JSON parsing fails, throw error
    if (!response.ok) {
      throw new Error('Login failed: Invalid server response');
    }
    throw new Error('Login failed: Could not parse server response');
  }

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
    return { authenticated: false, user: null, definitive: false };
  }

  // Check if response has content before parsing JSON
  const contentType = response.headers.get('content-type');
  const text = await response.text();

  if (!text || !contentType?.includes('application/json')) {
    return { authenticated: false, user: null, definitive: false };
  }

  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object') {
      return { authenticated: false, user: null, definitive: false };
    }
    return { ...data, definitive: response.status === 200 };
  } catch (error) {
    return { authenticated: false, user: null, definitive: false };
  }
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

    // Check if response has content before parsing JSON
    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    if (!text || !contentType?.includes('application/json')) {
      return { success: true, message: 'Logged out successfully' };
    }

    try {
      const data = await JSON.parse(text);
      return data;
    } catch (error) {
      return { success: true, message: 'Logged out successfully' };
    }
  } catch (error: any) {
    // If fetch fails (network error, CORS, etc.), still return success
    // The important thing is to clear local state
    return { success: true, message: 'Logged out locally (API unavailable)' };
  }
}

