/**
 * Structured error for integration API failures.
 * Separates user-facing message from internal debug details.
 */
export class IntegrationError extends Error {
  readonly statusCode: number
  readonly platform: string
  /** Raw response for internal logging only — never expose to end users */
  readonly internalDetail: string

  constructor(
    userMessage: string,
    statusCode: number,
    platform: string,
    internalDetail: string
  ) {
    super(userMessage)
    this.name = "IntegrationError"
    this.statusCode = statusCode
    this.platform = platform
    this.internalDetail = internalDetail
  }
}
