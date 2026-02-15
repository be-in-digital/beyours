/**
 * Tests pour le système RBAC (Role-Based Access Control)
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

describe('RBAC - Permissions par rôle', () => {
  describe('Super Admin', () => {
    it('devrait avoir accès à toutes les permissions', () => {
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

    it('devrait avoir toutes les permissions possibles', () => {
      const allPermissions = getRolePermissions(Role.SUPER_ADMIN);
      expect(allPermissions.length).toBeGreaterThan(20);
    });
  });

  describe('Client Admin', () => {
    it('devrait avoir accès complet à son restaurant', () => {
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

    it('ne devrait pas pouvoir supprimer des stores', () => {
      expect(hasPermission(Role.CLIENT_ADMIN, 'stores:delete')).toBe(false);
    });
  });

  describe('Manager', () => {
    it('devrait avoir accès à la gestion opérationnelle', () => {
      expect(hasPermission(Role.MANAGER, 'stores:read')).toBe(true);
      expect(hasPermission(Role.MANAGER, 'products:read')).toBe(true);
      expect(hasPermission(Role.MANAGER, 'products:write')).toBe(true);
      expect(hasPermission(Role.MANAGER, 'orders:read')).toBe(true);
      expect(hasPermission(Role.MANAGER, 'orders:write')).toBe(true);
      expect(hasPermission(Role.MANAGER, 'kitchen:read')).toBe(true);
      expect(hasPermission(Role.MANAGER, 'analytics:read')).toBe(true);
    });

    it('ne devrait pas pouvoir supprimer des produits ou gérer l\'équipe', () => {
      expect(hasPermission(Role.MANAGER, 'products:delete')).toBe(false);
      expect(hasPermission(Role.MANAGER, 'team:write')).toBe(false);
      expect(hasPermission(Role.MANAGER, 'settings:write')).toBe(false);
    });
  });

  describe('Kitchen', () => {
    it('devrait avoir accès uniquement au KDS', () => {
      expect(hasPermission(Role.KITCHEN, 'kitchen:read')).toBe(true);
      expect(hasPermission(Role.KITCHEN, 'kitchen:write')).toBe(true);
      expect(hasPermission(Role.KITCHEN, 'orders:read')).toBe(true);
      expect(hasPermission(Role.KITCHEN, 'orders:update_status')).toBe(true);
    });

    it('ne devrait pas avoir accès aux autres ressources', () => {
      expect(hasPermission(Role.KITCHEN, 'products:read')).toBe(false);
      expect(hasPermission(Role.KITCHEN, 'products:write')).toBe(false);
      expect(hasPermission(Role.KITCHEN, 'stores:read')).toBe(false);
      expect(hasPermission(Role.KITCHEN, 'team:read')).toBe(false);
      expect(hasPermission(Role.KITCHEN, 'analytics:read')).toBe(false);
      expect(hasPermission(Role.KITCHEN, 'settings:read')).toBe(false);
    });
  });

  describe('Waiter', () => {
    it('devrait avoir accès aux commandes et tables', () => {
      expect(hasPermission(Role.WAITER, 'orders:read')).toBe(true);
      expect(hasPermission(Role.WAITER, 'orders:write')).toBe(true);
      expect(hasPermission(Role.WAITER, 'orders:update_status')).toBe(true);
      expect(hasPermission(Role.WAITER, 'tables:read')).toBe(true);
      expect(hasPermission(Role.WAITER, 'tables:write')).toBe(true);
      expect(hasPermission(Role.WAITER, 'products:read')).toBe(true);
      expect(hasPermission(Role.WAITER, 'menus:read')).toBe(true);
    });

    it('ne devrait pas avoir accès au KDS ou aux settings', () => {
      expect(hasPermission(Role.WAITER, 'kitchen:read')).toBe(false);
      expect(hasPermission(Role.WAITER, 'settings:read')).toBe(false);
      expect(hasPermission(Role.WAITER, 'team:read')).toBe(false);
      expect(hasPermission(Role.WAITER, 'products:write')).toBe(false);
    });
  });

  describe('Delivery', () => {
    it('devrait avoir accès uniquement aux livraisons', () => {
      expect(hasPermission(Role.DELIVERY, 'deliveries:read')).toBe(true);
      expect(hasPermission(Role.DELIVERY, 'deliveries:write')).toBe(true);
      expect(hasPermission(Role.DELIVERY, 'orders:read')).toBe(true);
      expect(hasPermission(Role.DELIVERY, 'orders:update_status')).toBe(true);
    });

    it('ne devrait pas avoir accès aux autres ressources', () => {
      expect(hasPermission(Role.DELIVERY, 'products:read')).toBe(false);
      expect(hasPermission(Role.DELIVERY, 'kitchen:read')).toBe(false);
      expect(hasPermission(Role.DELIVERY, 'settings:read')).toBe(false);
      expect(hasPermission(Role.DELIVERY, 'tables:read')).toBe(false);
    });
  });

  describe('Customer', () => {
    it('devrait avoir accès uniquement à ses propres commandes', () => {
      expect(hasPermission(Role.CUSTOMER, 'orders:view_own')).toBe(true);
      expect(hasPermission(Role.CUSTOMER, 'products:read')).toBe(true);
      expect(hasPermission(Role.CUSTOMER, 'menus:read')).toBe(true);
      expect(hasPermission(Role.CUSTOMER, 'games:read')).toBe(true);
    });

    it('ne devrait pas avoir accès aux fonctionnalités admin', () => {
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
  it('devrait retourner true pour une permission valide', () => {
    expect(hasPermission(Role.MANAGER, 'products:write')).toBe(true);
  });

  it('devrait retourner false pour une permission non autorisée', () => {
    expect(hasPermission(Role.CUSTOMER, 'products:delete')).toBe(false);
  });

  it('devrait retourner false pour un rôle inconnu', () => {
    expect(hasPermission('invalid_role' as Role, 'products:read')).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  it('devrait retourner true si au moins une permission est accordée', () => {
    expect(
      hasAnyPermission(Role.WAITER, ['orders:write', 'kitchen:write'])
    ).toBe(true);
  });

  it('devrait retourner false si aucune permission n\'est accordée', () => {
    expect(
      hasAnyPermission(Role.CUSTOMER, ['orders:delete', 'products:delete'])
    ).toBe(false);
  });

  it('devrait retourner true si toutes les permissions sont accordées', () => {
    expect(
      hasAnyPermission(Role.CLIENT_ADMIN, ['products:read', 'products:write'])
    ).toBe(true);
  });
});

describe('hasAllPermissions', () => {
  it('devrait retourner true si toutes les permissions sont accordées', () => {
    expect(
      hasAllPermissions(Role.CLIENT_ADMIN, ['products:read', 'products:write'])
    ).toBe(true);
  });

  it('devrait retourner false si au moins une permission manque', () => {
    expect(
      hasAllPermissions(Role.KITCHEN, ['orders:read', 'products:delete'])
    ).toBe(false);
  });

  it('devrait retourner true pour une liste vide de permissions', () => {
    expect(hasAllPermissions(Role.CUSTOMER, [])).toBe(true);
  });
});

describe('getRolePermissions', () => {
  it('devrait retourner toutes les permissions pour un rôle', () => {
    const permissions = getRolePermissions(Role.KITCHEN);
    expect(permissions).toContain('kitchen:read');
    expect(permissions).toContain('kitchen:write');
    expect(permissions).toContain('orders:read');
    expect(permissions).toContain('orders:update_status');
  });

  it('devrait retourner un tableau vide pour un rôle invalide', () => {
    const permissions = getRolePermissions('invalid_role' as Role);
    expect(permissions).toEqual([]);
  });

  it('devrait retourner le plus de permissions pour super_admin', () => {
    const superAdminPerms = getRolePermissions(Role.SUPER_ADMIN);
    const clientAdminPerms = getRolePermissions(Role.CLIENT_ADMIN);
    const customerPerms = getRolePermissions(Role.CUSTOMER);

    expect(superAdminPerms.length).toBeGreaterThan(clientAdminPerms.length);
    expect(clientAdminPerms.length).toBeGreaterThan(customerPerms.length);
  });
});

describe('requirePermission', () => {
  it('ne devrait pas throw si la permission est accordée', () => {
    const middleware = requirePermission('products:write');
    expect(() => middleware(Role.MANAGER)).not.toThrow();
  });

  it('devrait throw PermissionDeniedError si la permission est refusée', () => {
    const middleware = requirePermission('products:delete');
    expect(() => middleware(Role.KITCHEN)).toThrow(PermissionDeniedError);
  });

  it('devrait inclure le rôle dans l\'erreur', () => {
    const middleware = requirePermission('settings:write');
    try {
      middleware(Role.WAITER);
      expect.fail('Devrait throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionDeniedError);
      expect((error as PermissionDeniedError).userRole).toBe(Role.WAITER);
      expect((error as PermissionDeniedError).permission).toBe('settings:write');
    }
  });
});

describe('requireAnyPermission', () => {
  it('ne devrait pas throw si au moins une permission est accordée', () => {
    const middleware = requireAnyPermission(['orders:read', 'orders:write']);
    expect(() => middleware(Role.WAITER)).not.toThrow();
  });

  it('devrait throw si aucune permission n\'est accordée', () => {
    const middleware = requireAnyPermission(['kitchen:write', 'settings:write']);
    expect(() => middleware(Role.CUSTOMER)).toThrow(PermissionDeniedError);
  });
});

describe('requireAllPermissions', () => {
  it('ne devrait pas throw si toutes les permissions sont accordées', () => {
    const middleware = requireAllPermissions(['products:read', 'products:write']);
    expect(() => middleware(Role.MANAGER)).not.toThrow();
  });

  it('devrait throw si au moins une permission manque', () => {
    const middleware = requireAllPermissions(['orders:read', 'products:delete']);
    expect(() => middleware(Role.KITCHEN)).toThrow(PermissionDeniedError);
  });

  it('devrait throw avec la première permission manquante', () => {
    const middleware = requireAllPermissions(['orders:read', 'products:delete', 'settings:write']);
    try {
      middleware(Role.WAITER);
      expect.fail('Devrait throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionDeniedError);
      // Devrait throw pour la première permission manquante
      expect((error as PermissionDeniedError).permission).toBe('products:delete');
    }
  });
});

describe('parseRole', () => {
  it('devrait parser un rôle valide en minuscules', () => {
    expect(parseRole('super_admin')).toBe(Role.SUPER_ADMIN);
    expect(parseRole('client_admin')).toBe(Role.CLIENT_ADMIN);
    expect(parseRole('manager')).toBe(Role.MANAGER);
    expect(parseRole('kitchen')).toBe(Role.KITCHEN);
    expect(parseRole('waiter')).toBe(Role.WAITER);
    expect(parseRole('delivery')).toBe(Role.DELIVERY);
    expect(parseRole('customer')).toBe(Role.CUSTOMER);
  });

  it('devrait parser un rôle valide en majuscules', () => {
    expect(parseRole('SUPER_ADMIN')).toBe(Role.SUPER_ADMIN);
    expect(parseRole('CLIENT_ADMIN')).toBe(Role.CLIENT_ADMIN);
  });

  it('devrait parser un rôle valide en casse mixte', () => {
    expect(parseRole('Super_Admin')).toBe(Role.SUPER_ADMIN);
    expect(parseRole('Client_Admin')).toBe(Role.CLIENT_ADMIN);
  });

  it('devrait retourner undefined pour un rôle invalide', () => {
    expect(parseRole('invalid')).toBeUndefined();
    expect(parseRole('admin')).toBeUndefined();
    expect(parseRole('')).toBeUndefined();
  });
});

describe('isValidRole', () => {
  it('devrait retourner true pour un rôle valide', () => {
    expect(isValidRole('super_admin')).toBe(true);
    expect(isValidRole('client_admin')).toBe(true);
    expect(isValidRole('manager')).toBe(true);
    expect(isValidRole('kitchen')).toBe(true);
    expect(isValidRole('waiter')).toBe(true);
    expect(isValidRole('delivery')).toBe(true);
    expect(isValidRole('customer')).toBe(true);
  });

  it('devrait retourner false pour un rôle invalide', () => {
    expect(isValidRole('invalid')).toBe(false);
    expect(isValidRole('admin')).toBe(false);
    expect(isValidRole('')).toBe(false);
    expect(isValidRole('SUPER_ADMIN')).toBe(false); // Case sensitive
  });
});

describe('PermissionDeniedError', () => {
  it('devrait avoir un message avec permission et rôle', () => {
    const error = new PermissionDeniedError('products:delete', Role.WAITER);
    expect(error.message).toContain('products:delete');
    expect(error.message).toContain('waiter');
    expect(error.name).toBe('PermissionDeniedError');
  });

  it('devrait avoir un message avec permission uniquement', () => {
    const error = new PermissionDeniedError('settings:write');
    expect(error.message).toContain('settings:write');
    expect(error.name).toBe('PermissionDeniedError');
  });
});

describe('Scénarios d\'usage réels', () => {
  it('Un manager peut créer des produits mais pas les supprimer', () => {
    expect(hasPermission(Role.MANAGER, 'products:write')).toBe(true);
    expect(hasPermission(Role.MANAGER, 'products:delete')).toBe(false);
  });

  it('Un waiter peut prendre des commandes mais pas accéder à la cuisine', () => {
    expect(hasPermission(Role.WAITER, 'orders:write')).toBe(true);
    expect(hasPermission(Role.WAITER, 'kitchen:read')).toBe(false);
  });

  it('Un kitchen peut voir et traiter les commandes', () => {
    expect(hasPermission(Role.KITCHEN, 'orders:read')).toBe(true);
    expect(hasPermission(Role.KITCHEN, 'orders:update_status')).toBe(true);
    expect(hasPermission(Role.KITCHEN, 'kitchen:write')).toBe(true);
  });

  it('Un client admin peut tout faire sauf supprimer le store', () => {
    expect(hasPermission(Role.CLIENT_ADMIN, 'products:write')).toBe(true);
    expect(hasPermission(Role.CLIENT_ADMIN, 'products:delete')).toBe(true);
    expect(hasPermission(Role.CLIENT_ADMIN, 'team:write')).toBe(true);
    expect(hasPermission(Role.CLIENT_ADMIN, 'stores:delete')).toBe(false);
  });

  it('Un customer ne peut que consulter', () => {
    expect(hasPermission(Role.CUSTOMER, 'products:read')).toBe(true);
    expect(hasPermission(Role.CUSTOMER, 'orders:view_own')).toBe(true);
    expect(hasPermission(Role.CUSTOMER, 'products:write')).toBe(false);
    expect(hasPermission(Role.CUSTOMER, 'orders:write')).toBe(false);
  });
});
