import { ReactNode } from "react";
import axios from "axios";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth/model/AuthContext";
import { PermissionProvider } from "@/features/auth/model/PermissionContext";
import { apiUrl } from "@/shared/runtime-config";

/**
 * Everything the application is wrapped in, and the one place axios is
 * configured.
 *
 * The base URL and the bearer interceptor are set at module scope rather than
 * in an effect: every `*.api.ts` module calls a bare `axios`, so the defaults
 * have to be in place before the first render can issue a request.
 */
axios.defaults.baseURL = apiUrl();

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

/* Remote state is refetched when something says it changed — a mutation or a
   realtime signal — never because a window regained focus or a timer expired. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <PermissionProvider>{children}</PermissionProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
