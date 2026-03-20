/**
 * Structured logger for integration API clients.
 * Only logs when NODE_ENV !== "production" or DEBUG includes the platform name.
 */

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "x-api-key",
  "cookie",
  "set-cookie",
  "x-csrf-token",
])

function isEnabled(platform: string): boolean {
  if (typeof process !== "undefined") {
    if (process.env.NODE_ENV === "production" && !process.env.DEBUG) return false
    if (process.env.DEBUG && !process.env.DEBUG.includes(platform.toLowerCase())) return false
  }
  return true
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = SENSITIVE_HEADERS.has(key.toLowerCase())
      ? `[REDACTED ${value.length} chars]`
      : value
  }
  return redacted
}

export interface IntegrationLogger {
  request(info: { method: string; url: string; hasBody?: boolean; headers?: Record<string, string> }): void
  response(info: { method: string; url: string; status: number; statusText: string }): void
}

export function createLogger(platform: string): IntegrationLogger {
  const prefix = `[${platform}API]`

  return {
    request({ method, url, hasBody, headers }) {
      if (!isEnabled(platform)) return
      const msg = `${prefix} ${method} ${url} body=${hasBody ? "present" : "none"}`
      if (headers) {
        console.debug(msg, { headers: redactHeaders(headers) })
      } else {
        console.debug(msg)
      }
    },
    response({ method, url, status, statusText }) {
      if (!isEnabled(platform)) return
      console.debug(`${prefix} ${method} ${url} → ${status} ${statusText}`)
    },
  }
}
