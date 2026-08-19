export interface RuntimeConfig {
  apiUrl?: string;
  realtimeUrl?: string;
  authMode?: 'local' | 'web';
}

declare global {
  interface Window {
    __TOURNAMENT_MANAGER_CONFIG__?: RuntimeConfig;
  }
}

function runtimeConfig(): RuntimeConfig {
  return window.__TOURNAMENT_MANAGER_CONFIG__ ?? {};
}

export function apiUrl(): string {
  return runtimeConfig().apiUrl ?? import.meta.env.VITE_PUBLIC_API_URL ?? 'http://localhost:3000/';
}

export function realtimeUrl(): string {
  return runtimeConfig().realtimeUrl ?? import.meta.env.VITE_PUBLIC_REALTIME_URL ?? 'http://localhost:3003/';
}

export function authMode(): 'local' | 'web' {
  const mode = runtimeConfig().authMode ?? import.meta.env.VITE_AUTH_MODE;
  return mode === 'local' ? 'local' : 'web';
}
