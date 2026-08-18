import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuthContext } from "@/features/auth/context/AuthContext";
import { isLocalMode } from "@/features/auth/services/auth-mode";
import { btnPrimary } from "@/styles/buttonStyles";

export default function LoginPage() {
  const { actions } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const localMode = isLocalMode();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUsernameError(null);
    setPasswordError(null);
    setApiError(null);

    if (localMode) {
      setLoading(true);
      try {
        await actions.loginWithApiKey(apiKey);
        navigate(from, { replace: true });
      } catch {
        setApiError("Invalid API key.");
      } finally {
        setLoading(false);
      }
      return;
    }

    let valid = true;
    if (username.length < 3) {
      setUsernameError("Username must be at least 3 characters.");
      valid = false;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      valid = false;
    }
    if (!valid) return;

    setLoading(true);
    try {
      await actions.login(username, password);
      navigate(from, { replace: true });
    } catch {
      setApiError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  }

  if (localMode) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <h1 className="text-3xl font-bold text-primary-dark mb-6">Login</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark focus:border-transparent"
              autoComplete="current-password"
              required
            />
          </div>
          {apiError && <p className="text-red-500 text-sm">{apiError}</p>}
          <button
            type="submit"
            disabled={loading}
            className={`${btnPrimary} w-full font-semibold`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <h1 className="text-3xl font-bold text-primary-dark mb-6">Login</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark focus:border-transparent"
            autoComplete="username"
            minLength={3}
            required
          />
          {usernameError && <p className="text-red-500 text-sm mt-1">{usernameError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark focus:border-transparent"
            autoComplete="current-password"
            minLength={6}
            required
          />
          {passwordError && <p className="text-red-500 text-sm mt-1">{passwordError}</p>}
        </div>
        {apiError && <p className="text-red-500 text-sm">{apiError}</p>}
        <button
          type="submit"
          disabled={loading}
          className={`${btnPrimary} w-full font-semibold`}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Don't have an account?{" "}
        <Link to="/register" className="text-primary-dark hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
