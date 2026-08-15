/**
 * Sentry Configuration for BeYours Engine
 *
 * This module provides Sentry configuration utilities for error tracking
 * and performance monitoring across the BeYours Engine platform.
 *
 * Each app should initialize Sentry with its own DSN and environment-specific settings.
 *
 * @module sentry
 */

export interface SentryConfig {
  /** Sentry DSN (Data Source Name) for the project */
  dsn: string
  /** Environment name */
  environment: 'development' | 'staging' | 'production'
  /** Release version (optional, auto-detected from package.json) */
  release?: string
  /** Percentage of transactions to trace (0.0 to 1.0) */
  tracesSampleRate?: number
  /** Percentage of sessions to replay (0.0 to 1.0) */
  replaysSessionSampleRate?: number
  /** Percentage of errored sessions to replay (0.0 to 1.0) */
  replaysOnErrorSampleRate?: number
}

/**
 * Default Sentry configuration values
 *
 * - Environment: production in prod, development otherwise
 * - Traces: 100% sample rate (adjust in production based on volume)
 * - Session Replays: 10% of all sessions
 * - Error Replays: 100% of sessions with errors
 */
export const defaultSentryConfig: Omit<SentryConfig, 'dsn'> = {
  environment: (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') ? 'production' : 'development',
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
}

/**
 * Creates a Sentry configuration object with defaults
 *
 * @param dsn - Sentry DSN for the project
 * @param overrides - Optional configuration overrides
 * @returns Complete Sentry configuration
 *
 * @example
 * ```typescript
 * const config = createSentryConfig(
 *   process.env.NEXT_PUBLIC_SENTRY_DSN!,
 *   { tracesSampleRate: 0.1 } // Lower sample rate in production
 * )
 *
 * Sentry.init(config)
 * ```
 */
export function createSentryConfig(dsn: string, overrides?: Partial<SentryConfig>): SentryConfig {
  return {
    ...defaultSentryConfig,
    dsn,
    ...overrides,
  }
}

/**
 * Re-export common Sentry utilities for convenience
 * Apps should install @sentry/nextjs and import Breadcrumb, User, Context types from there
 *
 * Note: These types are not re-exported here to avoid peer dependency requirements.
 * Import them directly from @sentry/nextjs or @sentry/types in your app.
 */
