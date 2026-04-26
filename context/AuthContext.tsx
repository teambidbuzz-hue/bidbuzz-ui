"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { getMe, logout as apiLogout, ApiError } from "@/lib/api";

interface Organizer {
  id: number;
  email: string;
  name: string | null;
}

interface AuthContextType {
  organizer: Organizer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, organizer: Organizer) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate auth state from stored token on mount
  useEffect(() => {
    const token = localStorage.getItem("bidbuzz_token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    getMe()
      .then((data) => {
        setOrganizer(data.organizer);
      })
      .catch((err) => {
        // Token invalid or expired - clear it
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem("bidbuzz_token");
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback((token: string, org: Organizer) => {
    localStorage.setItem("bidbuzz_token", token);
    setOrganizer(org);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Silently handle logout API errors
    } finally {
      localStorage.removeItem("bidbuzz_token");
      setOrganizer(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        organizer,
        isAuthenticated: !!organizer,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
