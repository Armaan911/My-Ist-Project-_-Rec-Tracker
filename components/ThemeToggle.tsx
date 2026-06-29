"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Toggles the `dark` class on <html> and persists the choice. The initial class is set by
// an inline script in the root layout (before paint) to avoid a flash.
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* ignore */ }
    setDark(next);
  }

  return (
    <button onClick={toggle} aria-label="Toggle dark mode" title={dark ? "Switch to light" : "Switch to dark"}
      className={`grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-canvas hover:text-ink ${className}`}>
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
