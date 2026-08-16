/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  ⚙️ Auth Config                                             │
 * │  Better Auth configuration with Convex adapter              │
 * │  Session, OAuth, 2FA, email templates, routes               │
 * ├─────────────────────────────────────────────────────────────┤
 * │                                                             │
 * │  Usage:                                                     │
 * │  ┌───────────────────────────────────────────────────┐      │
 * │  │ import { createAuthConfig } from '@repo/core/auth'│      │
 * │  │                                                   │      │
 * │  │ const config = createAuthConfig({                 │      │
 * │  │   baseUrl: 'https://myrestaurant.com',            │      │
 * │  │   secret: process.env.AUTH_SECRET!,               │      │
 * │  │   convexUrl: process.env.CONVEX_URL!,             │      │
 * │  │ })                                                │      │
 * │  └───────────────────────────────────────────────────┘      │
 * │                                                             │
 * └─────────────────────────────────────────────────────────────┘
 */

import { type BetterAuthConfig } from './types';
import { Role } from './rbac';

/**
 * Default session lifetime, in seconds (7 days)
 */
export const DEFAULT_SESSION_EXPIRY = 7 * 24 * 60 * 60;

/**
 * Delay before automatic refresh, in seconds (1 day)
 */
export const DEFAULT_SESSION_REFRESH = 24 * 60 * 60;

/**
 * Minimum password length
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Base configuration for Better Auth
 *
 * @param options - Options de configuration
 * @returns Configuration Better Auth
 *
 * @example
 * ```ts
 * const config = createAuthConfig({
 *   baseUrl: process.env.NEXT_PUBLIC_APP_URL!,
 *   secret: process.env.AUTH_SECRET!,
 *   convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
 * })
 * ```
 */
export function createAuthConfig(options: {
  /** URL de base de l'application */
  baseUrl: string;
  /** Secret used to sign tokens */
  secret: string;
  /** URL Convex */
  convexUrl: string;
  /** Providers OAuth (optionnel) */
  socialProviders?: BetterAuthConfig['socialProviders'];
}): BetterAuthConfig {
  const { baseUrl, secret, convexUrl, socialProviders } = options;

  return {
    baseUrl,
    secret,

    // Adaptateur Convex
    // NOTE: once installed, use:
    // database: convexAdapter({ convexUrl }),
    database: {
      type: 'convex',
      url: convexUrl,
    },

    // Configuration de session
    session: {
      expiresIn: DEFAULT_SESSION_EXPIRY, // 7 jours
      refreshAfter: DEFAULT_SESSION_REFRESH, // 1 jour
    },

    // Configuration email/password
    emailAndPassword: {
      requireEmailVerification: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },

    // Providers OAuth
    socialProviders,

    // Plugins
    // NOTE: once installed, add:
    // plugins: [
    //   twoFactorPlugin({
    //     methods: ['totp', 'email'],
    //     totpIssuer: 'BeYours',
    //   }),
    // ],
    plugins: [],
  };
}

/**
 * Better Auth lifecycle hooks
 *
 * A place to hang custom logic on auth events
 */
export const authHooks = {
  /**
   * Called after a successful sign-up
   */
  async afterSignUp(user: {
    id: string;
    email: string;
    role?: Role;
    restaurantId?: string;
  }) {
    // Log l'inscription
    console.info(
      `[Auth] Nouvel utilisateur inscrit: ${user.email} (${user.role ?? Role.CUSTOMER})`
    );

    // TODO: Envoyer un email de bienvenue via AWS SES
    // TODO: seed the client's default data
    // TODO: notify the admin when this is a new restaurant

    return user;
  },

  /**
   * Called after a successful sign-in
   */
  async afterSignIn(session: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // Log the sign-in
    console.info(
      `[Auth] Connexion utilisateur: ${session.userId} depuis ${session.ipAddress ?? 'unknown'}`
    );

    // TODO: check for suspicious activity
    // TODO: emit an analytics event

    return session;
  },

  /**
   * Called just before sign-out
   */
  async beforeSignOut(sessionId: string) {
    // Log the sign-out
    console.info(`[Auth] Déconnexion session: ${sessionId}`);

    // TODO: clear client-side session data
    // TODO: invalidate refresh tokens

    return true;
  },

  /**
   * Called on a failed sign-in attempt
   */
  async onSignInFailed(email: string, reason: string) {
    // Log the failure
    console.warn(`[Auth] Échec connexion pour ${email}: ${reason}`);

    // TODO: add rate limiting
    // TODO: lock the account after N attempts
    // TODO: Alerter en cas d'attaque brute force

    return;
  },

  /**
   * Called on a 2FA verification
   */
  async onTwoFactorVerify(userId: string, success: boolean) {
    console.info(
      `[Auth] Vérification 2FA pour ${userId}: ${success ? 'OK' : 'ÉCHEC'}`
    );

    // TODO: emit a security log
    // TODO: alert the user on failure

    return;
  },
};

/**
 * Email template configuration
 *
 * NOTE: to be wired into AWS SES
 */
export const emailTemplates = {
  /**
   * Verification email
   */
  verifyEmail: {
    subject: 'Vérifiez votre email - BeYours',
    templateName: 'verify-email',
  },

  /**
   * Password reset email
   */
  resetPassword: {
    subject: 'Réinitialisation de mot de passe - BeYours',
    templateName: 'reset-password',
  },

  /**
   * Email de code 2FA
   */
  twoFactorCode: {
    subject: 'Code de vérification - BeYours',
    templateName: 'two-factor-code',
  },

  /**
   * Email de bienvenue
   */
  welcome: {
    subject: 'Bienvenue sur BeYours!',
    templateName: 'welcome',
  },

  /**
   * Email de magic link
   */
  magicLink: {
    subject: 'Votre lien de connexion - BeYours',
    templateName: 'magic-link',
  },
};

/**
 * Redirect URL configuration
 */
export const authRoutes = {
  /** Page de connexion */
  signIn: '/auth/signin',
  /** Page d'inscription */
  signUp: '/auth/signup',
  /** Where to land after a successful sign-in */
  afterSignIn: '/dashboard',
  /** Where to land after a successful sign-up */
  afterSignUp: '/onboarding',
  /** Email verification page */
  verifyEmail: '/auth/verify-email',
  /** Password reset page */
  resetPassword: '/auth/reset-password',
  /** Page de configuration 2FA */
  twoFactor: '/settings/security/2fa',
  /** Page d'erreur auth */
  error: '/auth/error',
};

/**
 * Standard error messages.
 * Kept in French: they are written to be shown to the end user.
 */
export const authErrors = {
  INVALID_CREDENTIALS: 'Email ou mot de passe incorrect',
  EMAIL_ALREADY_EXISTS: 'Cet email est déjà utilisé',
  EMAIL_NOT_VERIFIED: 'Veuillez vérifier votre email avant de vous connecter',
  INVALID_TOKEN: 'Token invalide ou expiré',
  WEAK_PASSWORD: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`,
  TWO_FACTOR_REQUIRED: 'Code de vérification requis',
  INVALID_TWO_FACTOR_CODE: 'Code de vérification incorrect',
  SESSION_EXPIRED: 'Votre session a expiré, veuillez vous reconnecter',
  ACCOUNT_LOCKED: 'Compte temporairement verrouillé suite à trop de tentatives',
  UNAUTHORIZED: "Vous n'êtes pas autorisé à effectuer cette action",
  UNKNOWN_ERROR: 'Une erreur est survenue, veuillez réessayer',
} as const;

/**
 * Password validation
 *
 * @param password - The password to validate
 * @returns The result, carrying any errors found
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(authErrors.WEAK_PASSWORD);
  }

  // At least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une majuscule');
  }

  // At least one lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une minuscule');
  }

  // Au moins un chiffre
  if (!/[0-9]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre');
  }

  // At least one special character
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un caractère spécial');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validation de l'email
 *
 * @param email - The email to validate
 * @returns `true` when the email is valid
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
