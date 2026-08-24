// Applies the saved (or OS-preferred) theme before first paint to avoid a flash of the wrong
// theme. Loaded as an external classic script from index.html because helmet's default CSP only
// allows script-src 'self' — an inline bootstrap would be blocked in production.
try {
  const theme = localStorage.getItem("ferie-theme");
  if (theme === "dark" || (!theme && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
} catch {
  /* storage or matchMedia unavailable: keep the light default */
}
