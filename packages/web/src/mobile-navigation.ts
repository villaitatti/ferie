export function splitMobileNavigation<T>(navigation: readonly T[]): { primary: T[]; overflow: T[] } {
  if (navigation.length <= 5) return { primary: [...navigation], overflow: [] };
  return { primary: navigation.slice(0, 4), overflow: navigation.slice(4) };
}
