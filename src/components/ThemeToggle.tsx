import { useLayoutEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const themeKey = "suprimentos:theme:v1";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return localStorage.getItem(themeKey) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      /* Theme still works when browser storage is unavailable. */
    }
  }, [theme]);
  const label = theme === "dark" ? "Ativar modo claro" : "Ativar modo noturno";
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() =>
        setTheme((current) => (current === "dark" ? "light" : "dark"))
      }
    >
      {theme === "dark" ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </button>
  );
}
