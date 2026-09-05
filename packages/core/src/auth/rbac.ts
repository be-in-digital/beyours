/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  🔐 RBAC - Role-Based Access Control                        │
 * │  7 roles with granular permissions per resource              │
 * │  Guards, checks, and permission factories                    │
 * ├─────────────────────────────────────────────────────────────┤
 * │                                                             │
 * │  Usage:                                                     │
 * │  ┌───────────────────────────────────────────────────┐      │
 * │  │ import { Role, hasPermission }                    │      │
 * │  │   from '@repo/core/auth'                          │      │
 * │  │                                                   │      │
 * │  │ if (hasPermission(Role.MANAGER, 'orders:write'))  │      │
 * │  │   processOrder(order)                             │      │
 * │  └───────────────────────────────────────────────────┘      │
 * │                                                             │
 * └─────────────────────────────────────────────────────────────┘
 */

/**
 * Roles available in the application
 */
export enum Role {
  /** Full access to every restaurant and feature */
  SUPER_ADMIN = 'super_admin',
  /** Full access, to their own restaurant only */
  CLIENT_ADMIN = 'client_admin',
  /** Day-to-day running of the restaurant */
  MANAGER = 'manager',
  /** Kitchen Display System only */
  KITCHEN = 'kitchen',
  /** Orders and tables */
  WAITER = 'waiter',
  /** Deliveries only */
  DELIVERY = 'delivery',
  /** Their own orders only */
  CUSTOMER = 'customer',
}

/**
 * Resources the system knows about
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
  MARKETING = 'marketing',
  CONTENT = 'content',
  SYSTEM = 'system',
}

/**
 * Actions that can be taken on a resource
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
  BACKUP = 'backup',
  RESTORE = 'restore',
  MIGRATE = 'migrate',
}

/**
 * A permission, formatted "resource:action"
 * Exemples: "stores:read", "orders:write", "payments:refund"
 */
export type Permission = `${Resource}:${Action}`;

/**
 * Permissions granted to each role
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Super Admin: full access to everything
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
    'payments:write',
    'payments:refund',
    'translations:read',
    'translations:write',
    'games:read',
    'games:write',
    'customers:read',
    'customers:write',
    // Answering a diner's RGPD request: hand them everything the deployment
    // holds on them (art. 15 / 20), or destroy it (art. 17). Deliberately NOT
    // folded into `customers:read` — a waiter holds that one, and a waiter
    // should not be able to print a customer's full dossier or erase them.
    'customers:manage',
    'marketing:read',
    'marketing:write',
    'content:read',
    'content:write',
    'content:delete',
    'deliveries:read',
    'deliveries:write',
    'tables:read',
    'tables:write',
    'menus:read',
    'menus:write',
    'system:read',
    'system:backup',
    'system:restore',
    'system:migrate',
  ],

  // Client Admin: everything, within their own restaurant
  [Role.CLIENT_ADMIN]: [
    'stores:read',
    'stores:write',
    'products:read',
    'products:write',
    'products:delete',
    'orders:read',
    'orders:write',
    'orders:update_status',
    // An owner may delete a product, a team member and a page, but could not
    // delete an order in their own restaurant. The gap was an oversight, not a
    // policy.
    'orders:delete',
    'kitchen:read',
    'kitchen:write',
    'team:read',
    'team:write',
    'team:delete',
    'settings:read',
    'settings:write',
    'analytics:read',
    'payments:read',
    'payments:write',
    'payments:refund',
    'translations:read',
    'translations:write',
    'games:read',
    'games:write',
    'customers:read',
    // Marking a contact message handled needs this. Without it the owner could
    // read their own customers but never act on them.
    'customers:write',
    // The owner IS the data controller under the RGPD: answering an access,
    // erasure or portability request is their obligation, so the permission
    // that carries it stops with them and the super admin.
    'customers:manage',
    'marketing:read',
    'marketing:write',
    'content:read',
    'content:write',
    'content:delete',
    'deliveries:read',
    'deliveries:write',
    'tables:read',
    'tables:write',
    'menus:read',
    'menus:write',
    'system:read',
    'system:backup',
    'system:restore',
    'system:migrate',
  ],

  // Manager: day-to-day running
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
    // The team screen has always offered a manager the "Jeux / Marketing"
    // module by default, while the role table withheld it — the screen
    // promised and the server refused. Resolved in favour of the screen: a
    // manager runs the restaurant day to day, campaigns and in-store games
    // included.
    'games:write',
    'marketing:read',
    'marketing:write',
    'customers:read',
    'content:read',
    'content:write',
    'deliveries:read',
    'deliveries:write',
    'tables:read',
    'tables:write',
    'menus:read',
  ],

  // Kitchen: KDS only
  [Role.KITCHEN]: [
    'kitchen:read',
    'kitchen:write',
    'orders:read',
    'orders:update_status',
  ],

  // Waiter: orders and tables
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

  // Delivery: deliveries only
  [Role.DELIVERY]: [
    'deliveries:read',
    'deliveries:write',
    'orders:read',
    'orders:update_status',
  ],

  // Customer: their own orders
  [Role.CUSTOMER]: [
    'orders:view_own',
    'products:read',
    'menus:read',
    'games:read',
  ],
};

/**
 * Whether a role holds a given permission
 *
 * @param userRole - The user's role
 * @param permission - The permission to check, formatted "resource:action"
 * @returns `true` when the role holds it, `false` otherwise
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

  // Super admin holds every permission
  if (userRole === Role.SUPER_ADMIN) {
    return true;
  }

  return permissions.includes(permission);
}

/**
 * Whether a role holds at least one of the given permissions
 *
 * @param userRole - The user's role
 * @param permissions - The permissions to check
 * @returns `true` when at least one is held, `false` otherwise
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
 * Whether a role holds every one of the given permissions
 *
 * @param userRole - The user's role
 * @param permissions - The permissions to check
 * @returns `true` when all are held, `false` otherwise
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
 * Every permission granted to a role
 *
 * @param role - The role to look up
 * @returns The role's permissions
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
 * Thrown when a user lacks the required permission
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
 * Builds a guard that checks a single permission
 *
 * @param permission - The required permission
 * @returns A guard function checking that permission
 * @throws {PermissionDeniedError} When the permission is not held
 *
 * @example
 * ```ts
 * const requireProductWrite = requirePermission('products:write')
 * requireProductWrite(userRole) // throws when not held
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
 * Builds a guard that checks for any one of several permissions
 *
 * @param permissions - The permissions, at least one of which is required
 * @returns A guard function checking those permissions
 * @throws {PermissionDeniedError} When none of them is held
 *
 * @example
 * ```ts
 * const requireOrderAccess = requireAnyPermission(['orders:read', 'orders:write'])
 * requireOrderAccess(userRole) // throws when none is held
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
 * Builds a guard that checks for every one of several permissions
 *
 * @param permissions - The permissions, all of which are required
 * @returns A guard function checking those permissions
 * @throws {PermissionDeniedError} When any one is missing
 *
 * @example
 * ```ts
 * const requireFullProductAccess = requireAllPermissions(['products:read', 'products:write'])
 * requireFullProductAccess(userRole) // throws when one is missing
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
 * Parses a string into a Role
 *
 * @param roleString - The string to parse
 * @returns The matching role, or undefined
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
 * Whether a string is a valid role
 *
 * @param roleString - The string to check
 * @returns `true` when it names a role, `false` otherwise
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
