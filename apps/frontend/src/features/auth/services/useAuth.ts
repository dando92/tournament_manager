import { useReducer } from "react";
import { authReducer, initialState } from "@/features/auth/services/auth.reducer";
import * as AuthApi from "@/features/auth/services/auth.api";
import { toast } from "react-toastify";

export function useAuth() {
  const [state, dispatch] = useReducer(authReducer, initialState);

  async function login(username: string, password: string) {
    try {
      const { access_token } = await AuthApi.login(username, password);
      localStorage.setItem("access_token", access_token);

      const account = await AuthApi.fetchMe();
      dispatch({ type: "onLogin", payload: { token: access_token, account } });
      return account;
    } catch (error) {
      toast.error("Login failed. Check your credentials.");
      throw error;
    }
  }

  async function register(username: string, email: string, password: string, playerName?: string) {
    try {
      await AuthApi.register(username, email, password, playerName);
      return await login(username, password);
    } catch (error) {
      toast.error("Registration failed.");
      throw error;
    }
  }

  async function loadCurrentUser() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      dispatch({ type: "onSetLoading", payload: false });
      return;
    }
    try {
      const account = await AuthApi.fetchMe();
      dispatch({ type: "onLogin", payload: { token, account } });
    } catch {
      localStorage.removeItem("access_token");
      dispatch({ type: "onSetLoading", payload: false });
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    dispatch({ type: "onLogout" });
  }

  return {
    state,
    actions: { login, logout, register, loadCurrentUser },
  };
}
