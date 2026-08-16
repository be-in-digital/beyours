/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  📦 Auth Types                                              │
 * │  Type definitions for Better Auth integration               │
 * │  Users, sessions, credentials, 2FA, and OAuth               │
 * ├─────────────────────────────────────────────────────────────┤
 * │                                                             │
 * │  Usage:                                                     │
 * │  ┌───────────────────────────────────────────────────┐      │
 * │  │ import type { AuthUser, AuthSession }             │      │
 * │  │   from '@repo/core/auth'                          │      │
 * │  │                                                   │      │
 * │  │ function greet(user: AuthUser) {                  │      │
 * │  │   return `Hello ${user.name}`                     │      │
 * │  │ }                                                 │      │
 * │  └───────────────────────────────────────────────────┘      │
 * │                                                             │
 * └─────────────────────────────────────────────────────────────┘
 */

import { type Role } from './rbac';

/**
 * The user, extended with BeYours fields
 */
export interface AuthUser {
  /** ID unique de l'utilisateur */
  id: string;
  /** Email de l'utilisateur */
  email: string;
  /** Nom complet */
  name?: string;
  /** URL de l'avatar */
  image?: string;
  /** Whether the email is verified */
  emailVerified: boolean;
  /** Rôle de l'utilisateur */
  role: Role;
  /** Restaurant id — null for super_admin and customer */
  restaurantId?: string;
  /** Default store id */
  defaultStoreId?: string;
  /** Whether 2FA is enabled */
  twoFactorEnabled: boolean;
  /** Created at */
  createdAt: Date;
  /** Last updated at */
  updatedAt: Date;
}

/**
 * Session utilisateur
 */
export interface AuthSession {
  /** Session id */
  id: string;
  /** ID de l'utilisateur */
  userId: string;
  /** Token de session */
  token: string;
  /** Date d'expiration */
  expiresAt: Date;
  /** IP the session was opened from */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Created at */
  createdAt: Date;
  /** Last activity at */
  lastActivityAt: Date;
}

/**
 * A full session: the session record plus its user
 */
export interface AuthSessionData {
  /** Session active */
  session: AuthSession;
  /** The associated user */
  user: AuthUser;
}

/**
 * Credentials for email/password sign-in
 */
export interface EmailPasswordCredentials {
  /** Email de l'utilisateur */
  email: string;
  /** Mot de passe */
  password: string;
  /** Remember me — issues a long-lived session */
  rememberMe?: boolean;
}

/**
 * Sign-up payload
 */
export interface SignUpData {
  /** Email */
  email: string;
  /** Mot de passe */
  password: string;
  /** Nom complet */
  name: string;
  /** Role, defaults to customer */
  role?: Role;
  /** Restaurant id, for staff roles */
  restaurantId?: string;
}

/**
 * Provider OAuth disponibles
 */
export type OAuthProvider = 'google' | 'facebook' | 'apple';

/**
 * Password reset payload
 */
export interface PasswordResetData {
  /** Email de l'utilisateur */
  email: string;
}

/**
 * Email verification payload
 */
export interface EmailVerificationData {
  /** Verification token */
  token: string;
}

/**
 * Password change payload
 */
export interface ChangePasswordData {
  /** Ancien mot de passe */
  currentPassword: string;
  /** Nouveau mot de passe */
  newPassword: string;
}

/**
 * Configuration 2FA
 */
export interface TwoFactorConfig {
  /** Type de 2FA */
  type: 'totp' | 'email';
  /** TOTP secret, when type is totp */
  secret?: string;
  /** QR code URI, when type is totp */
  qrCodeUri?: string;
}

/**
 * A 2FA code to verify
 */
export interface TwoFactorVerification {
  /** Six-digit code */
  code: string;
}

/**
 * Sign-in result
 */
export interface SignInResult {
  /** Whether sign-in succeeded */
  success: boolean;
  /** The session created, when success is true */
  session?: AuthSessionData;
  /** 2FA requis */
  requiresTwoFactor?: boolean;
  /** Short-lived token for the 2FA step */
  tempToken?: string;
  /** Error message, when success is false */
  error?: string;
}

/**
 * Sign-up result
 */
export interface SignUpResult {
  /** Whether sign-up succeeded */
  success: boolean;
  /** The user created, when success is true */
  user?: AuthUser;
  /** Whether the verification email was sent */
  verificationEmailSent?: boolean;
  /** Error message, when success is false */
  error?: string;
}

/**
 * Better Auth configuration options
 * NOTE: to be typed properly once better-auth is installed
 */
export interface BetterAuthConfig {
  /** URL de base de l'application */
  baseUrl: string;
  /** Secret used to sign tokens */
  secret: string;
  /** Database adapter */
  database: unknown; // ConvexAdapter après installation
  /** Providers OAuth */
  socialProviders?: {
    google?: {
      clientId: string;
      clientSecret: string;
    };
    facebook?: {
      clientId: string;
      clientSecret: string;
    };
    apple?: {
      clientId: string;
      teamId: string;
      keyId: string;
      privateKey: string;
    };
  };
  /** Configuration de session */
  session?: {
    /** Expiry, in seconds. Defaults to 7 days */
    expiresIn?: number;
    /** Delay before automatic refresh, in seconds. Defaults to 1 day */
    refreshAfter?: number;
  };
  /** Configuration email */
  emailAndPassword?: {
    /** Whether email verification is required */
    requireEmailVerification?: boolean;
    /** Minimum password length */
    minPasswordLength?: number;
  };
  /** Enabled plugins */
  plugins?: unknown[]; // Plugins Better Auth
}

/**
 * Authentication context for React
 */
export interface AuthContextValue {
  /** The signed-in user, null when signed out */
  user: AuthUser | null;
  /** The active session, null when signed out */
  session: AuthSession | null;
  /** État de chargement */
  isLoading: boolean;
  /** Connexion email/password */
  signIn: (credentials: EmailPasswordCredentials) => Promise<SignInResult>;
  /** Inscription */
  signUp: (data: SignUpData) => Promise<SignUpResult>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Connexion OAuth */
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  /** Envoi magic link */
  sendMagicLink: (email: string) => Promise<void>;
  /** Request a password reset */
  resetPassword: (data: PasswordResetData) => Promise<void>;
  /** Changement de mot de passe */
  changePassword: (data: ChangePasswordData) => Promise<void>;
  /** Activer 2FA */
  enableTwoFactor: (type: 'totp' | 'email') => Promise<TwoFactorConfig>;
  /** Disable 2FA */
  disableTwoFactor: () => Promise<void>;
  /** Verify a 2FA code */
  verifyTwoFactor: (verification: TwoFactorVerification) => Promise<boolean>;
}
