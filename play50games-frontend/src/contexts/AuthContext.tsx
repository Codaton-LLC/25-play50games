'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, checkAuthStatus, login, register, logout as logoutAPI } from '@/lib/api/auth';
import { getJwtToken, removeJwtToken } from '@/lib/api/apiUtils';
import { syncProgressToAPI, setAuthStatus, clearLocalProgress, loadProgressFromServer } from '@/lib/storage/progressStorage';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, lastName: string, username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      // Token sent with this status check (read before the request goes out)
      const jwtToken = getJwtToken();
      const status = await checkAuthStatus();
      const wasAuthenticated = !!user;
      const isNowAuthenticated = status.authenticated && !!status.user;

      setUser(status.user);
      setAuthStatus(status.authenticated);

      // Stale or forged JWT: the server definitively said "not authenticated" (HTTP 200 + JSON)
      // although we sent a token, so drop it. Errors, 5xx and non-JSON replies are never
      // definitive and never remove the token. Skip if a login stored a new token meanwhile.
      if (
        jwtToken &&
        status.definitive === true &&
        status.authenticated === false &&
        getJwtToken() === jwtToken
      ) {
        removeJwtToken();
        setAuthStatus(false);
      }

      // If user is authenticated, sync/load progress from server
      if (isNowAuthenticated) {
        try {
          // If user just logged in (wasn't authenticated before), sync local progress to server
          if (!wasAuthenticated) {
            await syncProgressToAPI();
            // Clear localStorage progress after syncing
            clearLocalProgress();
            // Load fresh progress from server
            await loadProgressFromServer();
          } else {
            // User was already logged in, just refresh progress from server
            // Import dynamically to avoid circular dependency
            const progressStorage = await import('@/lib/storage/progressStorage');
            await progressStorage.loadProgressFromServer();
          }
        } catch (error) {
          // Failed to sync/load progress
        }
      }
    } catch (error) {
      // Failed to check auth status
      setUser(null);
      setAuthStatus(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    // Perform login first (keep localStorage data intact)
    const response = await login(email, password);
    if (response.user) {
      setUser(response.user);
      setAuthStatus(true);
      
      // After successful login, sync any local progress to server
      try {
        await syncProgressToAPI();
      } catch (error) {
        // Failed to sync local progress
      }
      
      // NOW clear ALL localStorage data (progress, guest ID, auth status)
      // This prevents new user from seeing previous user's data
      clearLocalProgress();
      
      // Set auth status again (it was cleared)
      setAuthStatus(true);
      
      // Load progress from server and dispatch event so UI components can update
      try {
        const serverProgress = await loadProgressFromServer();
        
        // Dispatch event to notify UI components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('play50games_progress_loaded', {
            detail: { progress: serverProgress }
          }));
        }
      } catch (error) {
        // Failed to load progress from server
      }
    }
  };

  const handleRegister = async (firstName: string, lastName: string, username: string, email: string, password: string) => {
    // Perform registration first (keep localStorage data intact)
    const response = await register(firstName, lastName, username, email, password);
    if (response.user) {
      setUser(response.user);
      setAuthStatus(true);
      
      // After successful registration, sync any local progress to server
      try {
        await syncProgressToAPI();
      } catch (error) {
        // Failed to sync local progress
      }
      
      // NOW clear ALL localStorage data (progress, guest ID, auth status)
      // This prevents new user from seeing previous user's data
      clearLocalProgress();
      
      // Set auth status again (it was cleared)
      setAuthStatus(true);
      
      // Load progress from server and dispatch event so UI components can update
      try {
        const serverProgress = await loadProgressFromServer();
        
        // Dispatch event to notify UI components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('play50games_progress_loaded', {
            detail: { progress: serverProgress }
          }));
        }
      } catch (error) {
        // Failed to load progress from server
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logoutAPI();
    } catch (error) {
      // Even if logout API fails, clear local state
    } finally {
      // Always clear local state, even if API call fails
      setUser(null);
      setAuthStatus(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

