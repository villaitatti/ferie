// Applies the saved (or OS-preferred) theme before first paint to avoid a flash of the wrong
// theme. Loaded as an external classic script from index.html because helmet's default CSP only
// allows script-src 'self' — an inline bootstrap would be blocked in production.
// Storage and matchMedia are guarded separately: private-mode browsers can refuse localStorage
// while matchMedia still works, and the OS preference should win in that case rather than
// flashing light and letting ThemeProvider repaint dark after hydration.
var theme = null;
try {
  theme = localStorage.getItem("ferie-theme");
} catch (_storageUnavailable) {
  /* keep theme null and fall through to the OS preference */
}
try {
  if (theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
} catch (_matchMediaUnavailable) {
  /* keep the light default */
}
