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
 * │  │   from '@be-in-digital/core'                          │      │
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
  /** Unique user id */
  id: string;
  /** User email address */
  email: string;
  /** Full name */
  name?: string;
  /** Avatar URL */
  image?: string;
  /** Whether the email is verified */
  emailVerified: boolean;
  /** User role */
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
 * User session
 */
export interface AuthSession {
  /** Session id */
  id: string;
  /** Owning user id */
  userId: string;
  /** Session token */
  token: string;
  /** Expiry date */
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
  /** The active session */
  session: AuthSession;
  /** The associated user */
  user: AuthUser;
}

/**
 * Credentials for email/password sign-in
 */
export interface EmailPasswordCredentials {
  /** User email address */
  email: string;
  /** Password */
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
  /** Password */
  password: string;
  /** Full name */
  name: string;
  /** Role, defaults to customer */
  role?: Role;
  /** Restaurant id, for staff roles */
  restaurantId?: string;
}

/**
 * Supported OAuth providers
 */
export type OAuthProvider = 'google' | 'facebook' | 'apple';

/**
 * Password reset payload
 */
export interface PasswordResetData {
  /** User email address */
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
  /** Current password */
  currentPassword: string;
  /** New password */
  newPassword: string;
}

/**
 * 2FA configuration
 */
export interface TwoFactorConfig {
  /** 2FA type */
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
  /** Whether 2FA is required */
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
  /** Base URL of the application */
  baseUrl: string;
  /** Secret used to sign tokens */
  secret: string;
  /** Database adapter */
  database: unknown; // ConvexAdapter once installed
  /** OAuth providers */
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
  /** Session configuration */
  session?: {
    /** Expiry, in seconds. Defaults to 7 days */
    expiresIn?: number;
    /** Delay before automatic refresh, in seconds. Defaults to 1 day */
    refreshAfter?: number;
  };
  /** Email configuration */
  emailAndPassword?: {
    /** Whether email verification is required */
    requireEmailVerification?: boolean;
    /** Minimum password length */
    minPasswordLength?: number;
  };
  /** Enabled plugins */
  plugins?: unknown[]; // Better Auth plugins
}

/**
 * Authentication context for React
 */
export interface AuthContextValue {
  /** The signed-in user, null when signed out */
  user: AuthUser | null;
  /** The active session, null when signed out */
  session: AuthSession | null;
  /** Loading state */
  isLoading: boolean;
  /** Email/password sign-in */
  signIn: (credentials: EmailPasswordCredentials) => Promise<SignInResult>;
  /** Sign up */
  signUp: (data: SignUpData) => Promise<SignUpResult>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** OAuth sign-in */
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  /** Send a magic link */
  sendMagicLink: (email: string) => Promise<void>;
  /** Request a password reset */
  resetPassword: (data: PasswordResetData) => Promise<void>;
  /** Change the password */
  changePassword: (data: ChangePasswordData) => Promise<void>;
  /** Enable 2FA */
  enableTwoFactor: (type: 'totp' | 'email') => Promise<TwoFactorConfig>;
  /** Disable 2FA */
  disableTwoFactor: () => Promise<void>;
  /** Verify a 2FA code */
  verifyTwoFactor: (verification: TwoFactorVerification) => Promise<boolean>;
}
