/**
 * Configuration Better Auth avec adaptateur Convex
 *
 * NOTE: Après installation de better-auth, importer:
 * - import { betterAuth } from 'better-auth'
 * - import { convexAdapter } from '@better-auth/convex'
 * - import { twoFactorPlugin } from '@better-auth/two-factor'
 *
 * Puis remplacer les placeholders par les vrais imports
 */

import { type BetterAuthConfig } from './types';
import { Role } from './rbac';

/**
 * Durée de session par défaut (7 jours en secondes)
 */
export const DEFAULT_SESSION_EXPIRY = 7 * 24 * 60 * 60;

/**
 * Durée avant refresh automatique (1 jour en secondes)
 */
export const DEFAULT_SESSION_REFRESH = 24 * 60 * 60;

/**
 * Longueur minimale du mot de passe
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Configuration de base pour Better Auth
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
  /** Secret pour signer les tokens */
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
    // NOTE: Après installation, utiliser:
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
    // NOTE: Après installation, ajouter:
    // plugins: [
    //   twoFactorPlugin({
    //     methods: ['totp', 'email'],
    //     totpIssuer: 'BeInDigital',
    //   }),
    // ],
    plugins: [],
  };
}

/**
 * Hooks de cycle de vie pour Better Auth
 *
 * Permet d'ajouter de la logique custom lors des événements auth
 */
export const authHooks = {
  /**
   * Hook appelé après une inscription réussie
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
    // TODO: Créer les données par défaut pour le client
    // TODO: Notifier l'admin si c'est un nouveau restaurant

    return user;
  },

  /**
   * Hook appelé après une connexion réussie
   */
  async afterSignIn(session: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // Log la connexion
    console.info(
      `[Auth] Connexion utilisateur: ${session.userId} depuis ${session.ipAddress ?? 'unknown'}`
    );

    // TODO: Vérifier activité suspecte
    // TODO: Logger pour analytics

    return session;
  },

  /**
   * Hook appelé avant déconnexion
   */
  async beforeSignOut(sessionId: string) {
    // Log la déconnexion
    console.info(`[Auth] Déconnexion session: ${sessionId}`);

    // TODO: Nettoyer les données de session côté client
    // TODO: Invalider les tokens refresh

    return true;
  },

  /**
   * Hook appelé lors d'une tentative de connexion échouée
   */
  async onSignInFailed(email: string, reason: string) {
    // Log l'échec
    console.warn(`[Auth] Échec connexion pour ${email}: ${reason}`);

    // TODO: Implémenter rate limiting
    // TODO: Bloquer après X tentatives
    // TODO: Alerter en cas d'attaque brute force

    return;
  },

  /**
   * Hook appelé lors d'une vérification 2FA
   */
  async onTwoFactorVerify(userId: string, success: boolean) {
    console.info(
      `[Auth] Vérification 2FA pour ${userId}: ${success ? 'OK' : 'ÉCHEC'}`
    );

    // TODO: Logger pour sécurité
    // TODO: Alerter l'utilisateur si échec

    return;
  },
};

/**
 * Configuration des templates d'emails
 *
 * NOTE: À intégrer avec AWS SES
 */
export const emailTemplates = {
  /**
   * Email de vérification
   */
  verifyEmail: {
    subject: 'Vérifiez votre email - BeInDigital',
    templateName: 'verify-email',
  },

  /**
   * Email de réinitialisation de mot de passe
   */
  resetPassword: {
    subject: 'Réinitialisation de mot de passe - BeInDigital',
    templateName: 'reset-password',
  },

  /**
   * Email de code 2FA
   */
  twoFactorCode: {
    subject: 'Code de vérification - BeInDigital',
    templateName: 'two-factor-code',
  },

  /**
   * Email de bienvenue
   */
  welcome: {
    subject: 'Bienvenue sur BeInDigital!',
    templateName: 'welcome',
  },

  /**
   * Email de magic link
   */
  magicLink: {
    subject: 'Votre lien de connexion - BeInDigital',
    templateName: 'magic-link',
  },
};

/**
 * Configuration des URLs de redirection
 */
export const authRoutes = {
  /** Page de connexion */
  signIn: '/auth/signin',
  /** Page d'inscription */
  signUp: '/auth/signup',
  /** Page après connexion réussie */
  afterSignIn: '/dashboard',
  /** Page après inscription réussie */
  afterSignUp: '/onboarding',
  /** Page de vérification email */
  verifyEmail: '/auth/verify-email',
  /** Page de réinitialisation mot de passe */
  resetPassword: '/auth/reset-password',
  /** Page de configuration 2FA */
  twoFactor: '/settings/security/2fa',
  /** Page d'erreur auth */
  error: '/auth/error',
};

/**
 * Messages d'erreur standardisés
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
 * Validation du mot de passe
 *
 * @param password - Mot de passe à valider
 * @returns Résultat de validation avec erreurs éventuelles
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(authErrors.WEAK_PASSWORD);
  }

  // Au moins une majuscule
  if (!/[A-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une majuscule');
  }

  // Au moins une minuscule
  if (!/[a-z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une minuscule');
  }

  // Au moins un chiffre
  if (!/[0-9]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre');
  }

  // Au moins un caractère spécial
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
 * @param email - Email à valider
 * @returns `true` si l'email est valide
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
