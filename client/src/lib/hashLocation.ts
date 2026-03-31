import { useSyncExternalStore, useCallback } from "react";

// Custom hash location hook that properly separates path from query string
// Wouter's built-in useHashLocation doesn't handle ?query in hash fragments
function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getHashPath(): string {
  const hash = window.location.hash.replace("#", "") || "/";
  // Strip query string for route matching
  const qIndex = hash.indexOf("?");
  return qIndex >= 0 ? hash.substring(0, qIndex) : hash;
}

export function useHashLocation(): [string, (to: string) => void] {
  const path = useSyncExternalStore(subscribe, getHashPath);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  return [path, navigate];
}

// Helper to get query params from hash
export function getHashParams(): URLSearchParams {
  const hash = window.location.hash.replace("#", "") || "/";
  const qIndex = hash.indexOf("?");
  const queryString = qIndex >= 0 ? hash.substring(qIndex + 1) : "";
  return new URLSearchParams(queryString);
}
