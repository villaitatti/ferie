const protectedPrefixes = [
  "/api/requests",
  "/api/request-calendar",
  "/api/approvals",
  "/api/calendars",
  "/api/admin",
] as const;

interface LoggableRequest {
  [key: string]: unknown;
  id?: unknown;
  method?: unknown;
  originalUrl?: unknown;
  url?: unknown;
}

interface LoggableResponse {
  [key: string]: unknown;
  statusCode?: unknown;
}

function pathname(value: string): string {
  return value.split("?", 1)[0] || "/";
}

export function protectedLogPrefix(url: string): string | null {
  const path = pathname(url);
  return protectedPrefixes.find((prefix) => path === prefix || path.startsWith(`${prefix}/`)) ?? null;
}

export function sanitizeLogUrl(url: string): string {
  return protectedLogPrefix(url) ?? pathname(url);
}

export function serializeHttpRequest(request: LoggableRequest) {
  const rawUrl = typeof request.originalUrl === "string" ? request.originalUrl : typeof request.url === "string" ? request.url : "/";
  return {
    id: typeof request.id === "string" || typeof request.id === "number" ? request.id : undefined,
    method: typeof request.method === "string" ? request.method : undefined,
    url: sanitizeLogUrl(rawUrl),
  };
}

export function serializeHttpResponse(response: LoggableResponse) {
  return { statusCode: typeof response.statusCode === "number" ? response.statusCode : undefined };
}

export function technicalErrorDescriptor(error: unknown) {
  if (typeof error !== "object" || error === null) return { name: "UnknownError" };
  const name = "name" in error && typeof error.name === "string" ? error.name : "Error";
  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  return { name, code };
}
