import ReactDOM from "react-dom/client";
import AppRouter from "@/app/router";
import "./index.css";
import axios from "axios";
import { AuthProvider } from "@/features/auth/model/AuthContext";
import { PermissionProvider } from "@/features/auth/model/PermissionContext";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiUrl } from "@/shared/runtime-config";

axios.defaults.baseURL = apiUrl();

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <PermissionProvider>
          <AppRouter />
        </PermissionProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>,
);
