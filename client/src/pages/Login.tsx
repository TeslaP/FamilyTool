import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Wallet } from "lucide-react";

const welcomeMessages = [
  "Welcome back",
  "Your monthly finance space",
  "A calm moment to reflect",
  "Take a look at where things stand",
  "Small reflections make better months",
  "A quieter way to manage money",
];

export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [welcomeMessage] = useState(
    () => welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Ambient gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-stone-200/60 to-stone-300/40" />

      {/* Decorative blurred shapes */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-stone-300/30 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-stone-200/40 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-stone-100/50 rounded-full blur-3xl" />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-stone-800 rounded-2xl flex items-center justify-center shadow-lg">
            <Wallet size={24} className="text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-light text-stone-800 text-center mb-2">
          Family Finance
        </h1>

        {/* Rotating welcome message */}
        <p className="text-base text-stone-500 text-center mb-8">
          {welcomeMessage}
        </p>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg space-y-5"
        >
          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
          <div>
            <label className="block text-base text-stone-600 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200/80 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-stone-700 bg-white/70"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-base text-stone-600 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200/80 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-stone-700 bg-white/70"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-stone-900 text-white rounded-xl text-base font-medium hover:bg-stone-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
