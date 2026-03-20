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
 * Utilisateur étendu avec les champs BeInDigital
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
  /** Email vérifié */
  emailVerified: boolean;
  /** Rôle de l'utilisateur */
  role: Role;
  /** ID du restaurant (null pour super_admin et customer) */
  restaurantId?: string;
  /** ID du store par défaut */
  defaultStoreId?: string;
  /** 2FA activé */
  twoFactorEnabled: boolean;
  /** Date de création */
  createdAt: Date;
  /** Date de dernière mise à jour */
  updatedAt: Date;
}

/**
 * Session utilisateur
 */
export interface AuthSession {
  /** ID de la session */
  id: string;
  /** ID de l'utilisateur */
  userId: string;
  /** Token de session */
  token: string;
  /** Date d'expiration */
  expiresAt: Date;
  /** IP de la session */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Date de création */
  createdAt: Date;
  /** Date de dernière activité */
  lastActivityAt: Date;
}

/**
 * Données complètes de session (session + user)
 */
export interface AuthSessionData {
  /** Session active */
  session: AuthSession;
  /** Utilisateur associé */
  user: AuthUser;
}

/**
 * Credentials pour connexion email/password
 */
export interface EmailPasswordCredentials {
  /** Email de l'utilisateur */
  email: string;
  /** Mot de passe */
  password: string;
  /** Se souvenir de moi (session longue durée) */
  rememberMe?: boolean;
}

/**
 * Données d'inscription
 */
export interface SignUpData {
  /** Email */
  email: string;
  /** Mot de passe */
  password: string;
  /** Nom complet */
  name: string;
  /** Rôle (par défaut: customer) */
  role?: Role;
  /** ID du restaurant (pour les rôles staff) */
  restaurantId?: string;
}

/**
 * Provider OAuth disponibles
 */
export type OAuthProvider = 'google' | 'facebook' | 'apple';

/**
 * Données de réinitialisation de mot de passe
 */
export interface PasswordResetData {
  /** Email de l'utilisateur */
  email: string;
}

/**
 * Données de vérification email
 */
export interface EmailVerificationData {
  /** Token de vérification */
  token: string;
}

/**
 * Données de changement de mot de passe
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
  /** Secret TOTP (si type = totp) */
  secret?: string;
  /** URI pour QR code (si type = totp) */
  qrCodeUri?: string;
}

/**
 * Code 2FA pour vérification
 */
export interface TwoFactorVerification {
  /** Code à 6 chiffres */
  code: string;
}

/**
 * Résultat de connexion
 */
export interface SignInResult {
  /** Succès de la connexion */
  success: boolean;
  /** Session créée (si success = true) */
  session?: AuthSessionData;
  /** 2FA requis */
  requiresTwoFactor?: boolean;
  /** Token temporaire pour 2FA */
  tempToken?: string;
  /** Message d'erreur (si success = false) */
  error?: string;
}

/**
 * Résultat d'inscription
 */
export interface SignUpResult {
  /** Succès de l'inscription */
  success: boolean;
  /** Utilisateur créé (si success = true) */
  user?: AuthUser;
  /** Email de vérification envoyé */
  verificationEmailSent?: boolean;
  /** Message d'erreur (si success = false) */
  error?: string;
}

/**
 * Options pour la configuration Better Auth
 * NOTE: À typer correctement après installation de better-auth
 */
export interface BetterAuthConfig {
  /** URL de base de l'application */
  baseUrl: string;
  /** Secret pour signer les tokens */
  secret: string;
  /** Adaptateur de base de données */
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
    /** Durée d'expiration en secondes (défaut: 7 jours) */
    expiresIn?: number;
    /** Durée avant refresh automatique en secondes (défaut: 1 jour) */
    refreshAfter?: number;
  };
  /** Configuration email */
  emailAndPassword?: {
    /** Vérification email requise */
    requireEmailVerification?: boolean;
    /** Longueur minimale du mot de passe */
    minPasswordLength?: number;
  };
  /** Plugins activés */
  plugins?: unknown[]; // Plugins Better Auth
}

/**
 * Contexte d'authentification pour React
 */
export interface AuthContextValue {
  /** Utilisateur connecté (null si non connecté) */
  user: AuthUser | null;
  /** Session active (null si non connecté) */
  session: AuthSession | null;
  /** État de chargement */
  isLoading: boolean;
  /** Connexion email/password */
  signIn: (credentials: EmailPasswordCredentials) => Promise<SignInResult>;
  /** Inscription */
  signUp: (data: SignUpData) => Promise<SignUpResult>;
  /** Déconnexion */
  signOut: () => Promise<void>;
  /** Connexion OAuth */
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  /** Envoi magic link */
  sendMagicLink: (email: string) => Promise<void>;
  /** Réinitialisation mot de passe */
  resetPassword: (data: PasswordResetData) => Promise<void>;
  /** Changement de mot de passe */
  changePassword: (data: ChangePasswordData) => Promise<void>;
  /** Activer 2FA */
  enableTwoFactor: (type: 'totp' | 'email') => Promise<TwoFactorConfig>;
  /** Désactiver 2FA */
  disableTwoFactor: () => Promise<void>;
  /** Vérifier code 2FA */
  verifyTwoFactor: (verification: TwoFactorVerification) => Promise<boolean>;
}
