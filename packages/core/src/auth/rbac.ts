/**
 * RBAC (Role-Based Access Control) pour BeInDigital Engine
 * Gère les 7 rôles utilisateur et leurs permissions granulaires
 */

/**
 * Rôles disponibles dans l'application
 */
export enum Role {
  /** Accès total à tous les restaurants et fonctionnalités */
  SUPER_ADMIN = 'super_admin',
  /** Accès complet à son restaurant uniquement */
  CLIENT_ADMIN = 'client_admin',
  /** Gestion opérationnelle du restaurant */
  MANAGER = 'manager',
  /** Accès au Kitchen Display System uniquement */
  KITCHEN = 'kitchen',
  /** Gestion des commandes et tables */
  WAITER = 'waiter',
  /** Accès aux livraisons uniquement */
  DELIVERY = 'delivery',
  /** Accès aux propres commandes uniquement */
  CUSTOMER = 'customer',
}

/**
 * Ressources disponibles dans le système
 */
export enum Resource {
  STORES = 'stores',
  PRODUCTS = 'products',
  ORDERS = 'orders',
  KITCHEN = 'kitchen',
  TEAM = 'team',
  SETTINGS = 'settings',
  ANALYTICS = 'analytics',
  PAYMENTS = 'payments',
  TRANSLATIONS = 'translations',
  GAMES = 'games',
  CUSTOMERS = 'customers',
  DELIVERIES = 'deliveries',
  TABLES = 'tables',
  MENUS = 'menus',
}

/**
 * Actions disponibles sur les ressources
 */
export enum Action {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  UPDATE_STATUS = 'update_status',
  REFUND = 'refund',
  MANAGE = 'manage',
  VIEW_ALL = 'view_all',
  VIEW_OWN = 'view_own',
}

/**
 * Permission au format "resource:action"
 * Exemples: "stores:read", "orders:write", "payments:refund"
 */
export type Permission = `${Resource}:${Action}`;

/**
 * Map des permissions par rôle
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Super Admin : accès complet à tout
  [Role.SUPER_ADMIN]: [
    'stores:read',
    'stores:write',
    'stores:delete',
    'stores:manage',
    'products:read',
    'products:write',
    'products:delete',
    'orders:read',
    'orders:write',
    'orders:update_status',
    'orders:delete',
    'kitchen:read',
    'kitchen:write',
    'kitchen:manage',
    'team:read',
    'team:write',
    'team:delete',
    'settings:read',
    'settings:write',
    'analytics:read',
    'analytics:view_all',
    'payments:read',
    'payments:refund',
    'translations:read',
    'translations:write',
    'games:read',
    'games:write',
    'customers:read',
    'customers:write',
    'deliveries:read',
    'deliveries:write',
    'tables:read',
    'tables:write',
    'menus:read',
    'menus:write',
  ],

  // Client Admin : tout sur son restaurant
  [Role.CLIENT_ADMIN]: [
    'stores:read',
    'stores:write',
    'products:read',
    'products:write',
    'products:delete',
    'orders:read',
    'orders:write',
    'orders:update_status',
    'kitchen:read',
    'kitchen:write',
    'team:read',
    'team:write',
    'team:delete',
    'settings:read',
    'settings:write',
    'analytics:read',
    'payments:read',
    'payments:refund',
    'translations:read',
    'translations:write',
    'games:read',
    'games:write',
    'customers:read',
    'deliveries:read',
    'deliveries:write',
    'tables:read',
    'tables:write',
    'menus:read',
    'menus:write',
  ],

  // Manager : gestion opérationnelle
  [Role.MANAGER]: [
    'stores:read',
    'products:read',
    'products:write',
    'orders:read',
    'orders:write',
    'orders:update_status',
    'kitchen:read',
    'kitchen:write',
    'team:read',
    'settings:read',
    'analytics:read',
    'payments:read',
    'translations:read',
    'games:read',
    'customers:read',
    'deliveries:read',
    'deliveries:write',
    'tables:read',
    'tables:write',
    'menus:read',
  ],

  // Kitchen : KDS uniquement
  [Role.KITCHEN]: [
    'kitchen:read',
    'kitchen:write',
    'orders:read',
    'orders:update_status',
  ],

  // Waiter : commandes et tables
  [Role.WAITER]: [
    'orders:read',
    'orders:write',
    'orders:update_status',
    'tables:read',
    'tables:write',
    'products:read',
    'menus:read',
    'customers:read',
    'payments:read',
  ],

  // Delivery : livraisons uniquement
  [Role.DELIVERY]: [
    'deliveries:read',
    'deliveries:write',
    'orders:read',
    'orders:update_status',
  ],

  // Customer : ses propres commandes
  [Role.CUSTOMER]: [
    'orders:view_own',
    'products:read',
    'menus:read',
    'games:read',
  ],
};

/**
 * Vérifie si un rôle possède une permission donnée
 *
 * @param userRole - Le rôle de l'utilisateur
 * @param permission - La permission à vérifier (format "resource:action")
 * @returns `true` si l'utilisateur a la permission, `false` sinon
 *
 * @example
 * ```ts
 * hasPermission(Role.MANAGER, 'orders:write') // true
 * hasPermission(Role.CUSTOMER, 'products:delete') // false
 * ```
 */
export function hasPermission(userRole: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) {
    return false;
  }

  // Super admin a tous les droits
  if (userRole === Role.SUPER_ADMIN) {
    return true;
  }

  return permissions.includes(permission);
}

/**
 * Vérifie si un rôle possède au moins une des permissions données
 *
 * @param userRole - Le rôle de l'utilisateur
 * @param permissions - Liste des permissions à vérifier
 * @returns `true` si l'utilisateur a au moins une permission, `false` sinon
 *
 * @example
 * ```ts
 * hasAnyPermission(Role.WAITER, ['orders:write', 'kitchen:write']) // true
 * hasAnyPermission(Role.CUSTOMER, ['orders:delete', 'products:delete']) // false
 * ```
 */
export function hasAnyPermission(
  userRole: Role,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(userRole, permission));
}

/**
 * Vérifie si un rôle possède toutes les permissions données
 *
 * @param userRole - Le rôle de l'utilisateur
 * @param permissions - Liste des permissions à vérifier
 * @returns `true` si l'utilisateur a toutes les permissions, `false` sinon
 *
 * @example
 * ```ts
 * hasAllPermissions(Role.CLIENT_ADMIN, ['products:read', 'products:write']) // true
 * hasAllPermissions(Role.KITCHEN, ['orders:read', 'products:delete']) // false
 * ```
 */
export function hasAllPermissions(
  userRole: Role,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) => hasPermission(userRole, permission));
}

/**
 * Récupère toutes les permissions d'un rôle
 *
 * @param role - Le rôle dont on veut les permissions
 * @returns Tableau des permissions du rôle
 *
 * @example
 * ```ts
 * const permissions = getRolePermissions(Role.MANAGER)
 * console.log(permissions) // ['stores:read', 'products:read', ...]
 * ```
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Erreur levée lorsqu'un utilisateur n'a pas la permission requise
 */
export class PermissionDeniedError extends Error {
  constructor(
    public permission: Permission,
    public userRole?: Role
  ) {
    super(
      userRole
        ? `Le rôle "${userRole}" n'a pas la permission "${permission}"`
        : `Permission "${permission}" requise`
    );
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Factory pour créer un middleware de vérification de permission
 *
 * @param permission - La permission requise
 * @returns Fonction middleware qui vérifie la permission
 * @throws {PermissionDeniedError} Si l'utilisateur n'a pas la permission
 *
 * @example
 * ```ts
 * const requireProductWrite = requirePermission('products:write')
 * requireProductWrite(userRole) // throw si pas la permission
 * ```
 */
export function requirePermission(permission: Permission) {
  return (userRole: Role): void => {
    if (!hasPermission(userRole, permission)) {
      throw new PermissionDeniedError(permission, userRole);
    }
  };
}

/**
 * Factory pour créer un middleware de vérification de permissions multiples (ANY)
 *
 * @param permissions - Liste des permissions (au moins une requise)
 * @returns Fonction middleware qui vérifie les permissions
 * @throws {PermissionDeniedError} Si l'utilisateur n'a aucune des permissions
 *
 * @example
 * ```ts
 * const requireOrderAccess = requireAnyPermission(['orders:read', 'orders:write'])
 * requireOrderAccess(userRole) // throw si aucune des permissions
 * ```
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (userRole: Role): void => {
    if (!hasAnyPermission(userRole, permissions)) {
      const firstPermission = permissions[0] ?? ('stores:read' as Permission);
      throw new PermissionDeniedError(firstPermission, userRole);
    }
  };
}

/**
 * Factory pour créer un middleware de vérification de permissions multiples (ALL)
 *
 * @param permissions - Liste des permissions (toutes requises)
 * @returns Fonction middleware qui vérifie les permissions
 * @throws {PermissionDeniedError} Si l'utilisateur n'a pas toutes les permissions
 *
 * @example
 * ```ts
 * const requireFullProductAccess = requireAllPermissions(['products:read', 'products:write'])
 * requireFullProductAccess(userRole) // throw si manque une permission
 * ```
 */
export function requireAllPermissions(permissions: Permission[]) {
  return (userRole: Role): void => {
    const missingPermission = permissions.find(
      (perm) => !hasPermission(userRole, perm)
    );
    if (missingPermission) {
      throw new PermissionDeniedError(missingPermission, userRole);
    }
  };
}

/**
 * Parse une chaîne de rôle en enum Role
 *
 * @param roleString - La chaîne à parser
 * @returns Le rôle correspondant ou undefined
 *
 * @example
 * ```ts
 * parseRole('client_admin') // Role.CLIENT_ADMIN
 * parseRole('invalid') // undefined
 * ```
 */
export function parseRole(roleString: string): Role | undefined {
  const upperRole = roleString.toUpperCase();
  const found = Object.values(Role).find(
    (role) => role.toUpperCase() === upperRole
  );
  return found ? (found as Role) : undefined;
}

/**
 * Vérifie si une chaîne est un rôle valide
 *
 * @param roleString - La chaîne à vérifier
 * @returns `true` si c'est un rôle valide, `false` sinon
 *
 * @example
 * ```ts
 * isValidRole('manager') // true
 * isValidRole('admin') // false
 * ```
 */
export function isValidRole(roleString: string): roleString is Role {
  return Object.values(Role).includes(roleString as Role);
}
