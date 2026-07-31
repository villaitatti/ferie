import { useEffect, useState } from "react";

/** The breakpoint the layout has always used for its mobile switch. */
const MOBILE_QUERY = "(max-width: 47.99em)";

/** Replaces the Mantine hook: used to swap dropdowns for full-screen sheets. */
export function useIsMobile(): boolean {
  const [matches, setMatches] = useState(() => (typeof window === "undefined" ? false : window.matchMedia(MOBILE_QUERY).matches));

  useEffect(() => {
    const list = window.matchMedia(MOBILE_QUERY);
    setMatches(list.matches);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", listener);
    return () => list.removeEventListener("change", listener);
  }, []);

  return matches;
}
