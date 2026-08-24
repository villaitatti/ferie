import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "ferie-theme";

/** The browser-chrome colour for each theme: forest-800 on light, the dark sidebar surface on dark. */
const THEME_COLOR: Record<Theme, string> = { light: "#174b3a", dark: "#1b221e" };

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Storage can be unavailable (private mode); fall through to the OS preference.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Light/dark theme state. The `.dark` class on <html> drives both the token overrides in index.css
 * and Tailwind's `dark:` variant; public/theme-init.js applies the class before first paint so
 * there is no flash of the wrong theme.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Non-persistent storage still leaves the in-session theme working.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((current) => (current === "dark" ? "light" : "dark")), []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider.");
  return context;
}
