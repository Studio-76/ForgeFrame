import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const THEME_STORAGE_KEY = "forgeframe_theme_mode";
const LEGACY_THEME_STORAGE_KEY = "forgegate_theme_mode";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (saved === "dark" || saved === "light") {
    return saved;
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.classList.toggle("dark", mode === "dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
  }, [mode]);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    setMode,
    toggleMode: () => setMode((prev) => (prev === "dark" ? "light" : "dark")),
  }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }
  return context;
}
