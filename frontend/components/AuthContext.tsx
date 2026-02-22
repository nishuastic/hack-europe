"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in on mount
    const initAuth = async () => {
      const currentUser = api.getUser();
      if (currentUser) {
        setUser(currentUser);
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    setUser(result.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const result = await api.register(email, password, name);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
