/**
 * Tests for the RBAC (Role-Based Access Control) system
 */

import { describe, it, expect } from 'vitest';
import {
  Role,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  parseRole,
  isValidRole,
  PermissionDeniedError,
  type Permission,
} from '../rbac';

describe('RBAC - permissions per role', () => {
  describe('Super Admin', () => {
    it('grants access to every permission', () => {
      const permissions: Permission[] = [
        'stores:read',
        'stores:write',
        'stores:delete',
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
        'settings:read',
        'settings:write',
        'analytics:read',
        'payments:read',
        'payments:refund',
        'translations:read',
        'translations:write',
        'games:read',
        'games:write',
      ];

      permissions.forEach((permission) => {
        expect(hasPermission(Role.SUPER_ADMIN, permission)).toBe(true);
      });
    });

    it('has all the possible permissions', () => {
      const allPermissions = getRolePermissions(Role.SUPER_ADMIN);
      expect(allPermissions.length).toBeGreaterThan(20);
    });
  });

  describe('Client Admin', () => {
    it('has full access to its own restaurant', () => {
      expect(hasPermission(Role.CLIENT_ADMIN, 'stores:read')).toBe(true);
      expect(hasPermission(Role.CLIENT_ADMIN, 'stores:write')).toBe(true);
      expect(hasPermission(Role.CLIENT_ADMIN, 'products:write')).toBe(true);
      expect(hasPermission(Role.CLIENT_ADMIN, 'products:delete')).toBe(true);
      expect(hasPermission(Role.CLIENT_ADMIN, 'orders:write')).toBe(true);
      expect(hasPermission(Role.CLIENT_ADMIN, 'team:write')).toBe(true);
      expect(hasPermission(Role.CLIENT_ADMIN, 'settings:write')).toBe(true);
      expect(hasPermission(Role.CLIENT_ADMIN, 'payments:refund')).toBe(true);
      expect(hasPermission(Role.CLIENT_ADMIN, 'analytics:read')).toBe(true);
    });

    it('cannot delete stores', () => {
      expect(hasPermission(Role.CLIENT_ADMIN, 'stores:delete')).toBe(false);
    });
  });

  describe('Manager', () => {
    it('has access to operational management', () => {
      expect(hasPermission(Role.MANAGER, 'stores:read')).toBe(true);
      expect(hasPermission(Role.MANAGER, 'products:read')).toBe(true);
      expect(hasPermission(Role.MANAGER, 'products:write')).toBe(true);
      expect(hasPermission(Role.MANAGER, 'orders:read')).toBe(true);
      expect(hasPermission(Role.MANAGER, 'orders:write')).toBe(true);
      expect(hasPermission(Role.MANAGER, 'kitchen:read')).toBe(true);
      expect(hasPermission(Role.MANAGER, 'analytics:read')).toBe(true);
    });

    it('cannot delete products or manage the team', () => {
      expect(hasPermission(Role.MANAGER, 'products:delete')).toBe(false);
      expect(hasPermission(Role.MANAGER, 'team:write')).toBe(false);
      expect(hasPermission(Role.MANAGER, 'settings:write')).toBe(false);
    });
  });

  describe('Kitchen', () => {
    it('has access to the KDS only', () => {
      expect(hasPermission(Role.KITCHEN, 'kitchen:read')).toBe(true);
      expect(hasPermission(Role.KITCHEN, 'kitchen:write')).toBe(true);
      expect(hasPermission(Role.KITCHEN, 'orders:read')).toBe(true);
      expect(hasPermission(Role.KITCHEN, 'orders:update_status')).toBe(true);
    });

    it('has no access to the other resources', () => {
      expect(hasPermission(Role.KITCHEN, 'products:read')).toBe(false);
      expect(hasPermission(Role.KITCHEN, 'products:write')).toBe(false);
      expect(hasPermission(Role.KITCHEN, 'stores:read')).toBe(false);
      expect(hasPermission(Role.KITCHEN, 'team:read')).toBe(false);
      expect(hasPermission(Role.KITCHEN, 'analytics:read')).toBe(false);
      expect(hasPermission(Role.KITCHEN, 'settings:read')).toBe(false);
    });
  });

  describe('Waiter', () => {
    it('has access to orders and tables', () => {
      expect(hasPermission(Role.WAITER, 'orders:read')).toBe(true);
      expect(hasPermission(Role.WAITER, 'orders:write')).toBe(true);
      expect(hasPermission(Role.WAITER, 'orders:update_status')).toBe(true);
      expect(hasPermission(Role.WAITER, 'tables:read')).toBe(true);
      expect(hasPermission(Role.WAITER, 'tables:write')).toBe(true);
      expect(hasPermission(Role.WAITER, 'products:read')).toBe(true);
      expect(hasPermission(Role.WAITER, 'menus:read')).toBe(true);
    });

    it('has no access to the KDS or the settings', () => {
      expect(hasPermission(Role.WAITER, 'kitchen:read')).toBe(false);
      expect(hasPermission(Role.WAITER, 'settings:read')).toBe(false);
      expect(hasPermission(Role.WAITER, 'team:read')).toBe(false);
      expect(hasPermission(Role.WAITER, 'products:write')).toBe(false);
    });
  });

  describe('Delivery', () => {
    it('has access to deliveries only', () => {
      expect(hasPermission(Role.DELIVERY, 'deliveries:read')).toBe(true);
      expect(hasPermission(Role.DELIVERY, 'deliveries:write')).toBe(true);
      expect(hasPermission(Role.DELIVERY, 'orders:read')).toBe(true);
      expect(hasPermission(Role.DELIVERY, 'orders:update_status')).toBe(true);
    });

    it('has no access to the other resources', () => {
      expect(hasPermission(Role.DELIVERY, 'products:read')).toBe(false);
      expect(hasPermission(Role.DELIVERY, 'kitchen:read')).toBe(false);
      expect(hasPermission(Role.DELIVERY, 'settings:read')).toBe(false);
      expect(hasPermission(Role.DELIVERY, 'tables:read')).toBe(false);
    });
  });

  describe('Customer', () => {
    it('has access to its own orders only', () => {
      expect(hasPermission(Role.CUSTOMER, 'orders:view_own')).toBe(true);
      expect(hasPermission(Role.CUSTOMER, 'products:read')).toBe(true);
      expect(hasPermission(Role.CUSTOMER, 'menus:read')).toBe(true);
      expect(hasPermission(Role.CUSTOMER, 'games:read')).toBe(true);
    });

    it('has no access to the admin features', () => {
      expect(hasPermission(Role.CUSTOMER, 'orders:write')).toBe(false);
      expect(hasPermission(Role.CUSTOMER, 'products:write')).toBe(false);
      expect(hasPermission(Role.CUSTOMER, 'stores:read')).toBe(false);
      expect(hasPermission(Role.CUSTOMER, 'kitchen:read')).toBe(false);
      expect(hasPermission(Role.CUSTOMER, 'team:read')).toBe(false);
      expect(hasPermission(Role.CUSTOMER, 'settings:read')).toBe(false);
    });
  });
});

describe('hasPermission', () => {
  it('returns true for a valid permission', () => {
    expect(hasPermission(Role.MANAGER, 'products:write')).toBe(true);
  });

  it('returns false for a permission that is not granted', () => {
    expect(hasPermission(Role.CUSTOMER, 'products:delete')).toBe(false);
  });

  it('returns false for an unknown role', () => {
    expect(hasPermission('invalid_role' as Role, 'products:read')).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  it('returns true when at least one permission is granted', () => {
    expect(
      hasAnyPermission(Role.WAITER, ['orders:write', 'kitchen:write'])
    ).toBe(true);
  });

  it('returns false when no permission is granted', () => {
    expect(
      hasAnyPermission(Role.CUSTOMER, ['orders:delete', 'products:delete'])
    ).toBe(false);
  });

  it('returns true when every permission is granted', () => {
    expect(
      hasAnyPermission(Role.CLIENT_ADMIN, ['products:read', 'products:write'])
    ).toBe(true);
  });
});

describe('hasAllPermissions', () => {
  it('returns true when every permission is granted', () => {
    expect(
      hasAllPermissions(Role.CLIENT_ADMIN, ['products:read', 'products:write'])
    ).toBe(true);
  });

  it('returns false when at least one permission is missing', () => {
    expect(
      hasAllPermissions(Role.KITCHEN, ['orders:read', 'products:delete'])
    ).toBe(false);
  });

  it('returns true for an empty permission list', () => {
    expect(hasAllPermissions(Role.CUSTOMER, [])).toBe(true);
  });
});

describe('getRolePermissions', () => {
  it('returns every permission for a role', () => {
    const permissions = getRolePermissions(Role.KITCHEN);
    expect(permissions).toContain('kitchen:read');
    expect(permissions).toContain('kitchen:write');
    expect(permissions).toContain('orders:read');
    expect(permissions).toContain('orders:update_status');
  });

  it('returns an empty array for an invalid role', () => {
    const permissions = getRolePermissions('invalid_role' as Role);
    expect(permissions).toEqual([]);
  });

  it('returns the most permissions for super_admin', () => {
    const superAdminPerms = getRolePermissions(Role.SUPER_ADMIN);
    const clientAdminPerms = getRolePermissions(Role.CLIENT_ADMIN);
    const customerPerms = getRolePermissions(Role.CUSTOMER);

    expect(superAdminPerms.length).toBeGreaterThan(clientAdminPerms.length);
    expect(clientAdminPerms.length).toBeGreaterThan(customerPerms.length);
  });
});

describe('requirePermission', () => {
  it('does not throw when the permission is granted', () => {
    const middleware = requirePermission('products:write');
    expect(() => middleware(Role.MANAGER)).not.toThrow();
  });

  it('throws PermissionDeniedError when the permission is denied', () => {
    const middleware = requirePermission('products:delete');
    expect(() => middleware(Role.KITCHEN)).toThrow(PermissionDeniedError);
  });

  it('includes the role in the error', () => {
    const middleware = requirePermission('settings:write');
    try {
      middleware(Role.WAITER);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionDeniedError);
      expect((error as PermissionDeniedError).userRole).toBe(Role.WAITER);
      expect((error as PermissionDeniedError).permission).toBe('settings:write');
    }
  });
});

describe('requireAnyPermission', () => {
  it('does not throw when at least one permission is granted', () => {
    const middleware = requireAnyPermission(['orders:read', 'orders:write']);
    expect(() => middleware(Role.WAITER)).not.toThrow();
  });

  it('throws when no permission is granted', () => {
    const middleware = requireAnyPermission(['kitchen:write', 'settings:write']);
    expect(() => middleware(Role.CUSTOMER)).toThrow(PermissionDeniedError);
  });
});

describe('requireAllPermissions', () => {
  it('does not throw when every permission is granted', () => {
    const middleware = requireAllPermissions(['products:read', 'products:write']);
    expect(() => middleware(Role.MANAGER)).not.toThrow();
  });

  it('throws when at least one permission is missing', () => {
    const middleware = requireAllPermissions(['orders:read', 'products:delete']);
    expect(() => middleware(Role.KITCHEN)).toThrow(PermissionDeniedError);
  });

  it('throws with the first missing permission', () => {
    const middleware = requireAllPermissions(['orders:read', 'products:delete', 'settings:write']);
    try {
      middleware(Role.WAITER);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionDeniedError);
      // Should throw on the first missing permission
      expect((error as PermissionDeniedError).permission).toBe('products:delete');
    }
  });
});

describe('parseRole', () => {
  it('parses a valid role in lowercase', () => {
    expect(parseRole('super_admin')).toBe(Role.SUPER_ADMIN);
    expect(parseRole('client_admin')).toBe(Role.CLIENT_ADMIN);
    expect(parseRole('manager')).toBe(Role.MANAGER);
    expect(parseRole('kitchen')).toBe(Role.KITCHEN);
    expect(parseRole('waiter')).toBe(Role.WAITER);
    expect(parseRole('delivery')).toBe(Role.DELIVERY);
    expect(parseRole('customer')).toBe(Role.CUSTOMER);
  });

  it('parses a valid role in uppercase', () => {
    expect(parseRole('SUPER_ADMIN')).toBe(Role.SUPER_ADMIN);
    expect(parseRole('CLIENT_ADMIN')).toBe(Role.CLIENT_ADMIN);
  });

  it('parses a valid role in mixed case', () => {
    expect(parseRole('Super_Admin')).toBe(Role.SUPER_ADMIN);
    expect(parseRole('Client_Admin')).toBe(Role.CLIENT_ADMIN);
  });

  it('returns undefined for an invalid role', () => {
    expect(parseRole('invalid')).toBeUndefined();
    expect(parseRole('admin')).toBeUndefined();
    expect(parseRole('')).toBeUndefined();
  });
});

describe('isValidRole', () => {
  it('returns true for a valid role', () => {
    expect(isValidRole('super_admin')).toBe(true);
    expect(isValidRole('client_admin')).toBe(true);
    expect(isValidRole('manager')).toBe(true);
    expect(isValidRole('kitchen')).toBe(true);
    expect(isValidRole('waiter')).toBe(true);
    expect(isValidRole('delivery')).toBe(true);
    expect(isValidRole('customer')).toBe(true);
  });

  it('returns false for an invalid role', () => {
    expect(isValidRole('invalid')).toBe(false);
    expect(isValidRole('admin')).toBe(false);
    expect(isValidRole('')).toBe(false);
    expect(isValidRole('SUPER_ADMIN')).toBe(false); // Case sensitive
  });
});

describe('PermissionDeniedError', () => {
  it('builds a message with the permission and the role', () => {
    const error = new PermissionDeniedError('products:delete', Role.WAITER);
    expect(error.message).toContain('products:delete');
    expect(error.message).toContain('waiter');
    expect(error.name).toBe('PermissionDeniedError');
  });

  it('builds a message with the permission only', () => {
    const error = new PermissionDeniedError('settings:write');
    expect(error.message).toContain('settings:write');
    expect(error.name).toBe('PermissionDeniedError');
  });
});

describe('Real-world usage scenarios', () => {
  it('a manager can create products but not delete them', () => {
    expect(hasPermission(Role.MANAGER, 'products:write')).toBe(true);
    expect(hasPermission(Role.MANAGER, 'products:delete')).toBe(false);
  });

  it('a waiter can take orders but cannot access the kitchen', () => {
    expect(hasPermission(Role.WAITER, 'orders:write')).toBe(true);
    expect(hasPermission(Role.WAITER, 'kitchen:read')).toBe(false);
  });

  it('a kitchen user can see and process orders', () => {
    expect(hasPermission(Role.KITCHEN, 'orders:read')).toBe(true);
    expect(hasPermission(Role.KITCHEN, 'orders:update_status')).toBe(true);
    expect(hasPermission(Role.KITCHEN, 'kitchen:write')).toBe(true);
  });

  it('a client admin can do everything except delete the store', () => {
    expect(hasPermission(Role.CLIENT_ADMIN, 'products:write')).toBe(true);
    expect(hasPermission(Role.CLIENT_ADMIN, 'products:delete')).toBe(true);
    expect(hasPermission(Role.CLIENT_ADMIN, 'team:write')).toBe(true);
    expect(hasPermission(Role.CLIENT_ADMIN, 'stores:delete')).toBe(false);
  });

  it('a customer can only read', () => {
    expect(hasPermission(Role.CUSTOMER, 'products:read')).toBe(true);
    expect(hasPermission(Role.CUSTOMER, 'orders:view_own')).toBe(true);
    expect(hasPermission(Role.CUSTOMER, 'products:write')).toBe(false);
    expect(hasPermission(Role.CUSTOMER, 'orders:write')).toBe(false);
  });
});
