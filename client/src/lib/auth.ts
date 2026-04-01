import { useState, useCallback } from "react";
import { apiRequest } from "./queryClient";

interface User {
  id: string;
  username: string;
  role: "admin" | "editor" | "viewer";
  email?: string;
}

// Global token storage (in-memory only)
let authToken: string | null = null;

export function getToken(): string | null { return authToken; }
export function setToken(token: string | null) { authToken = token; }

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      const data = await res.json();
      if (data.token) {
        authToken = data.token;
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (e: any) {
      return { success: false, error: e.message || "Lỗi đăng nhập" };
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (username: string, password: string, email?: string) => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", { username, password, email });
      const data = await res.json();
      if (data.success) return { success: true };
      return { success: false, error: data.error };
    } catch (e: any) {
      return { success: false, error: e.message || "Lỗi đăng ký" };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authToken = null;
    setUser(null);
  }, []);

  return {
    user,
    setUser,
    login,
    register,
    logout,
    loading,
    isAdmin: user?.role === "admin",
    isEditor: user?.role === "editor" || user?.role === "admin",
  };
}

// Helper to add auth header to fetch requests
export function authHeaders(): Record<string, string> {
  if (!authToken) return {};
  return { Authorization: `Bearer ${authToken}` };
}

// Helper for authenticated fetch
export async function authFetch(method: string, url: string, body?: any): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}
