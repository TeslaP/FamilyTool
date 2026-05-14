import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { HorizonLogo } from "../components/HorizonLogo";

const seasonalBackgrounds: Record<string, string[]> = {
  winter: [
    "/backgrounds/04-snow-peaks.jpg",
    "/backgrounds/09-winter-field.jpg",
    "/backgrounds/01-mountain-fog.jpg",
  ],
  spring: [
    "/backgrounds/06-morning-valley.jpg",
    "/backgrounds/03-misty-forest.jpg",
    "/backgrounds/10-calm-water.jpg",
  ],
  summer: [
    "/backgrounds/02-autumn-lake.jpg",
    "/backgrounds/05-clouds-mountain.jpg",
    "/backgrounds/07-peaks-dawn.jpg",
  ],
  autumn: [
    "/backgrounds/02-autumn-lake.jpg",
    "/backgrounds/01-mountain-fog.jpg",
    "/backgrounds/03-misty-forest.jpg",
  ],
};

function getSeason(): string {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

function getSeasonalBackground(): string {
  const season = getSeason();
  const images = seasonalBackgrounds[season];
  return images[Math.floor(Math.random() * images.length)];
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Quiet hours";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Late reflection";
}

const welcomeMessages = [
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
  const [bgImage] = useState(() => getSeasonalBackground());
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
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-entrance { opacity: 0; animation-fill-mode: forwards; animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94); }
      `}</style>

      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={bgImage}
          alt=""
          className="w-full h-full object-cover animate-entrance"
          style={{ animationName: "fadeIn", animationDuration: "1.2s", animationDelay: "0s" }}
        />
        {/* Soft overlay for readability — no blur, just darken slightly */}
        <div className="absolute inset-0 bg-stone-900/20" />
        {/* Additional warm tint */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-100/10 via-transparent to-stone-900/30" />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div
          className="flex justify-center mb-6 animate-entrance"
          style={{ animationName: "fadeInScale", animationDuration: "0.8s", animationDelay: "0.2s" }}
        >
          <HorizonLogo size={56} variant="light" className="backdrop-blur-sm shadow-lg border border-white/30" />
        </div>

        {/* Time-aware greeting */}
        <h1
          className="text-3xl font-light text-white text-center mb-2 animate-entrance"
          style={{ animationName: "fadeIn", animationDuration: "0.8s", animationDelay: "0.4s" }}
        >
          {getTimeGreeting()}
        </h1>

        {/* Rotating welcome message */}
        <p
          className="text-base text-white/70 text-center mb-8 animate-entrance"
          style={{ animationName: "fadeIn", animationDuration: "0.8s", animationDelay: "0.6s" }}
        >
          {welcomeMessage}
        </p>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/60 backdrop-blur-md p-8 rounded-2xl shadow-lg border border-white/40 space-y-5 animate-entrance"
          style={{ animationName: "fadeInUp", animationDuration: "0.8s", animationDelay: "0.8s" }}
        >
          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
          <div>
            <label className="block text-base text-stone-500 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-white/60 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-white/50 bg-white/50 text-stone-800 placeholder:text-stone-400"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-base text-stone-500 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-white/60 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-white/50 bg-white/50 text-stone-800 placeholder:text-stone-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-stone-700/80 backdrop-blur-sm text-white/90 rounded-xl text-base font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
