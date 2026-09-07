/**
 * Transactional and campaign email: which transport carries it.
 *
 * Deliberately free of `@aws-sdk/client-sesv2` — the SES operations are
 * injected — so a Convex isolate can import this without pulling the SDK in.
 * See `./providers` for why the switch had to leave `apps/site` (#212).
 */
export {
  EMAIL_PROVIDERS,
  isEmailProviderName,
  createResendOperations,
  createTransport,
  resolveEmailProvider,
} from './providers'
export type {
  EmailProviderName,
  EmailMessage,
  EmailSendOutcome,
  EmailTransport,
  EmailTransportResolution,
  EmailProviderEnv,
  ResendConfig,
} from './providers'
