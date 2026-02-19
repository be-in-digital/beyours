import { describe, it, expect } from 'vitest'
import {
  inviteTeamMemberSchema,
  createTeamMemberSchema,
  updateTeamMemberSchema,
  TEAM_PERMISSION_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
} from '../validators'

describe('TEAM_PERMISSION_MODULES', () => {
  it('should contain exactly 8 modules', () => {
    expect(TEAM_PERMISSION_MODULES).toHaveLength(8)
  })

  it('should contain all expected module names', () => {
    const expected = [
      'dashboard',
      'orders',
      'products',
      'kitchen',
      'team',
      'settings',
      'integrations',
      'marketing',
    ]

    expected.forEach((module) => {
      expect(TEAM_PERMISSION_MODULES).toContain(module)
    })
  })
})

describe('DEFAULT_ROLE_PERMISSIONS', () => {
  it('should define permissions for all four roles', () => {
    expect(DEFAULT_ROLE_PERMISSIONS).toHaveProperty('manager')
    expect(DEFAULT_ROLE_PERMISSIONS).toHaveProperty('kitchen')
    expect(DEFAULT_ROLE_PERMISSIONS).toHaveProperty('waiter')
    expect(DEFAULT_ROLE_PERMISSIONS).toHaveProperty('delivery')
  })

  it('should give manager all 8 permission modules', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.manager).toHaveLength(8)

    TEAM_PERMISSION_MODULES.forEach((module) => {
      expect(DEFAULT_ROLE_PERMISSIONS.manager).toContain(module)
    })
  })

  it('should give kitchen exactly ["orders", "kitchen"]', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.kitchen).toHaveLength(2)
    expect(DEFAULT_ROLE_PERMISSIONS.kitchen).toContain('orders')
    expect(DEFAULT_ROLE_PERMISSIONS.kitchen).toContain('kitchen')
  })

  it('should give waiter exactly ["dashboard", "orders"]', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.waiter).toHaveLength(2)
    expect(DEFAULT_ROLE_PERMISSIONS.waiter).toContain('dashboard')
    expect(DEFAULT_ROLE_PERMISSIONS.waiter).toContain('orders')
  })

  it('should give delivery exactly ["orders"]', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.delivery).toHaveLength(1)
    expect(DEFAULT_ROLE_PERMISSIONS.delivery).toContain('orders')
  })
})

describe('inviteTeamMemberSchema', () => {
  it('should validate a valid invite payload', () => {
    const validInvite = {
      storeId: 'store123',
      allStores: false,
      name: 'Alice Martin',
      email: 'alice@restaurant.com',
      role: 'manager' as const,
      permissions: ['dashboard', 'orders'],
    }

    const result = inviteTeamMemberSchema.parse(validInvite)
    expect(result.name).toBe('Alice Martin')
    expect(result.email).toBe('alice@restaurant.com')
    expect(result.role).toBe('manager')
  })

  it('should reject when name is missing', () => {
    const missingName = {
      email: 'alice@restaurant.com',
      role: 'manager',
    }

    expect(() => inviteTeamMemberSchema.parse(missingName)).toThrow()
  })

  it('should reject an invalid email address', () => {
    const invalidEmail = {
      name: 'Alice Martin',
      email: 'not-an-email',
      role: 'kitchen',
    }

    expect(() => inviteTeamMemberSchema.parse(invalidEmail)).toThrow()
  })

  it('should reject an invalid role', () => {
    const invalidRole = {
      name: 'Alice Martin',
      email: 'alice@restaurant.com',
      role: 'superadmin', // not a valid role
    }

    expect(() => inviteTeamMemberSchema.parse(invalidRole)).toThrow()
  })

  it('should default permissions to an empty array when omitted', () => {
    const withoutPermissions = {
      name: 'Bob Durand',
      email: 'bob@restaurant.com',
      role: 'waiter' as const,
    }

    const result = inviteTeamMemberSchema.parse(withoutPermissions)
    expect(result.permissions).toEqual([])
  })

  it('should default allStores to false when omitted', () => {
    const withoutAllStores = {
      name: 'Bob Durand',
      email: 'bob@restaurant.com',
      role: 'delivery' as const,
    }

    const result = inviteTeamMemberSchema.parse(withoutAllStores)
    expect(result.allStores).toBe(false)
  })

  it('should accept storeId as optional', () => {
    // storeId absent — no error expected
    const withoutStoreId = {
      allStores: true,
      name: 'Chain Manager',
      email: 'chain@restaurant.com',
      role: 'manager' as const,
    }

    const result = inviteTeamMemberSchema.parse(withoutStoreId)
    expect(result.storeId).toBeUndefined()
  })

  it('should accept all valid role values', () => {
    const roles = ['manager', 'kitchen', 'waiter', 'delivery'] as const

    roles.forEach((role) => {
      const result = inviteTeamMemberSchema.parse({
        name: 'Test User',
        email: 'test@restaurant.com',
        role,
      })
      expect(result.role).toBe(role)
    })
  })
})

describe('createTeamMemberSchema', () => {
  it('should validate a valid create payload', () => {
    const validCreate = {
      storeId: 'store123',
      allStores: false,
      userId: 'user456',
      name: 'Caroline Petit',
      email: 'caroline@restaurant.com',
      role: 'kitchen' as const,
      permissions: ['orders', 'kitchen'],
      invitationStatus: 'accepted' as const,
      isActive: true,
    }

    const result = createTeamMemberSchema.parse(validCreate)
    expect(result.name).toBe('Caroline Petit')
    expect(result.role).toBe('kitchen')
    expect(result.isActive).toBe(true)
  })

  it('should accept optional fields being absent', () => {
    // storeId, userId are optional
    const minimal = {
      name: 'David Roy',
      email: 'david@restaurant.com',
      role: 'waiter' as const,
    }

    const result = createTeamMemberSchema.parse(minimal)
    expect(result.storeId).toBeUndefined()
    expect(result.userId).toBeUndefined()
  })

  it('should default invitationStatus to "pending"', () => {
    const withoutStatus = {
      name: 'Emma Blanc',
      email: 'emma@restaurant.com',
      role: 'delivery' as const,
    }

    const result = createTeamMemberSchema.parse(withoutStatus)
    expect(result.invitationStatus).toBe('pending')
  })

  it('should default isActive to true', () => {
    const withoutActive = {
      name: 'Emma Blanc',
      email: 'emma@restaurant.com',
      role: 'delivery' as const,
    }

    const result = createTeamMemberSchema.parse(withoutActive)
    expect(result.isActive).toBe(true)
  })

  it('should default permissions to an empty array', () => {
    const withoutPermissions = {
      name: 'Emma Blanc',
      email: 'emma@restaurant.com',
      role: 'delivery' as const,
    }

    const result = createTeamMemberSchema.parse(withoutPermissions)
    expect(result.permissions).toEqual([])
  })
})

describe('updateTeamMemberSchema', () => {
  it('should validate a valid partial update', () => {
    const validUpdate = {
      id: 'member123',
      name: 'Updated Name',
      role: 'manager' as const,
    }

    const result = updateTeamMemberSchema.parse(validUpdate)
    expect(result.id).toBe('member123')
    expect(result.name).toBe('Updated Name')
    expect(result.role).toBe('manager')
  })

  it('should require the id field', () => {
    const withoutId = {
      name: 'Updated Name',
      role: 'kitchen',
    }

    expect(() => updateTeamMemberSchema.parse(withoutId)).toThrow()
  })

  it('should allow updating only permissions', () => {
    const permissionsOnly = {
      id: 'member123',
      permissions: ['orders', 'kitchen'],
    }

    const result = updateTeamMemberSchema.parse(permissionsOnly)
    expect(result.permissions).toEqual(['orders', 'kitchen'])
    expect(result.name).toBeUndefined()
    expect(result.role).toBeUndefined()
  })

  it('should allow updating only storeId', () => {
    const storeOnly = {
      id: 'member123',
      storeId: 'store456',
    }

    const result = updateTeamMemberSchema.parse(storeOnly)
    expect(result.storeId).toBe('store456')
  })

  it('should allow updating allStores flag', () => {
    const allStoresUpdate = {
      id: 'member123',
      allStores: true,
    }

    const result = updateTeamMemberSchema.parse(allStoresUpdate)
    expect(result.allStores).toBe(true)
  })

  it('should reject an invalid role on update', () => {
    const invalidRole = {
      id: 'member123',
      role: 'owner', // not a valid role
    }

    expect(() => updateTeamMemberSchema.parse(invalidRole)).toThrow()
  })
})
