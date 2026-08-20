export interface RuntimeConfig {
  apiUrl?: string;
  realtimeUrl?: string;
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
