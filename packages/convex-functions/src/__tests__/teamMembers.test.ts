import { describe, it, expect } from 'vitest'
import { DEFAULT_ROLE_PERMISSIONS, TEAM_PERMISSION_MODULES } from '../teamMembers'

describe('TEAM_PERMISSION_MODULES', () => {
  it('should contain exactly 8 modules', () => {
    expect(TEAM_PERMISSION_MODULES).toHaveLength(8)
  })

  it('should include the dashboard module', () => {
    expect(TEAM_PERMISSION_MODULES).toContain('dashboard')
  })

  it('should include the orders module', () => {
    expect(TEAM_PERMISSION_MODULES).toContain('orders')
  })

  it('should include the products module', () => {
    expect(TEAM_PERMISSION_MODULES).toContain('products')
  })

  it('should include the kitchen module', () => {
    expect(TEAM_PERMISSION_MODULES).toContain('kitchen')
  })

  it('should include the team module', () => {
    expect(TEAM_PERMISSION_MODULES).toContain('team')
  })

  it('should include the settings module', () => {
    expect(TEAM_PERMISSION_MODULES).toContain('settings')
  })

  it('should include the integrations module', () => {
    expect(TEAM_PERMISSION_MODULES).toContain('integrations')
  })

  it('should include the marketing module', () => {
    expect(TEAM_PERMISSION_MODULES).toContain('marketing')
  })
})

describe('DEFAULT_ROLE_PERMISSIONS', () => {
  it('should cover all four roles', () => {
    expect(DEFAULT_ROLE_PERMISSIONS).toHaveProperty('manager')
    expect(DEFAULT_ROLE_PERMISSIONS).toHaveProperty('kitchen')
    expect(DEFAULT_ROLE_PERMISSIONS).toHaveProperty('waiter')
    expect(DEFAULT_ROLE_PERMISSIONS).toHaveProperty('delivery')
  })

  describe('manager role', () => {
    it('should have all 8 permission modules', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.manager).toHaveLength(8)
    })

    it('should contain every module defined in TEAM_PERMISSION_MODULES', () => {
      TEAM_PERMISSION_MODULES.forEach((module) => {
        expect(DEFAULT_ROLE_PERMISSIONS.manager).toContain(module)
      })
    })
  })

  describe('kitchen role', () => {
    it('should have exactly 2 permissions', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.kitchen).toHaveLength(2)
    })

    it('should contain orders', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.kitchen).toContain('orders')
    })

    it('should contain kitchen', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.kitchen).toContain('kitchen')
    })

    it('should not contain dashboard', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.kitchen).not.toContain('dashboard')
    })

    it('should not contain team', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.kitchen).not.toContain('team')
    })
  })

  describe('waiter role', () => {
    it('should have exactly 2 permissions', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.waiter).toHaveLength(2)
    })

    it('should contain dashboard', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.waiter).toContain('dashboard')
    })

    it('should contain orders', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.waiter).toContain('orders')
    })

    it('should not contain kitchen', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.waiter).not.toContain('kitchen')
    })

    it('should not contain settings', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.waiter).not.toContain('settings')
    })
  })

  describe('delivery role', () => {
    it('should have exactly 1 permission', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.delivery).toHaveLength(1)
    })

    it('should contain orders', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.delivery).toContain('orders')
    })

    it('should not contain dashboard', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.delivery).not.toContain('dashboard')
    })

    it('should not contain kitchen', () => {
      expect(DEFAULT_ROLE_PERMISSIONS.delivery).not.toContain('kitchen')
    })
  })
})
