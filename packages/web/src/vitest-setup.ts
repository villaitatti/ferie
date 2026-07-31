import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

/**
 * Without an explicit cleanup the rendered trees stack up in the same document, so a second test in a
 * file finds two of every label. Only the jsdom suites have a document to clean.
 */
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
