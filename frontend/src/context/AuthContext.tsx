// ═══════════════════════════════════════════════════════════════════════════
// AuthContext.tsx — Global authentication state for Multi-Tenant Franchise ERP
// Provides role, tenant_id, franchise_id, permissions to all components.
// ═══════════════════════════════════════════════════════════════════════════
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface UserPermissions {
  customers:  PermSet
  quotations: PermSet
  invoices:   PermSet
  payments:   PermSet
  orders:     PermSet
  products:   PermSet
  amc:        PermSet
  reports:    PermSet
  settings:   PermSet
  franchises: PermSet
  approvals:  PermSet
  branding:   PermSet
}
export interface PermSet {
  view: boolean; create: boolean; edit: boolean; delete: boolean; approve: boolean
}

export interface AuthUser {
  username:       string
  role:           string
  tenant_id:      string
  franchise_id:   string | null
  franchise_name: string | null
  franchise_address?: string | null
  franchise_gst?: string | null
}

interface AuthContextValue {
  user:             AuthUser | null
  permissions:      UserPermissions | null
  isSuperAdmin:     () => boolean
  isFranchiseAdmin: () => boolean
  isFranchiseStaff: () => boolean
  can:              (resource: keyof UserPermissions, action: keyof PermSet) => boolean
  login:            (token: string, user: AuthUser, perms: UserPermissions) => void
  logout:           () => void
  isLoggedIn:       boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SUPER_ADMIN_PERMISSIONS: UserPermissions = Object.fromEntries(
  ['customers','quotations','invoices','payments','orders','products','amc','reports','settings','franchises','approvals','branding']
    .map(r => [r, { view: true, create: true, edit: true, delete: true, approve: true }])
) as unknown as UserPermissions

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,        setUser]        = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem('sf_user_obj')
    const permsRaw = localStorage.getItem('sf_permissions')
    if (raw) {
      try {
        const u = JSON.parse(raw) as AuthUser
        setUser(u)
        setPermissions(permsRaw ? JSON.parse(permsRaw) : SUPER_ADMIN_PERMISSIONS)
      } catch {}
    }
  }, [])

  const isSuperAdmin = () => {
    const r = user?.role ? user.role.toLowerCase().replace(/[\s-]/g, '_') : '';
    return r === 'super_admin' || r === 'admin' || r === 'head_office' || r === 'superadmin';
  }
  const isFranchiseAdmin = () => user?.role === 'franchise_admin'
  const isFranchiseStaff = () => user?.role === 'franchise_staff'

  const can = (resource: keyof UserPermissions, action: keyof PermSet): boolean => {
    if (isSuperAdmin()) return true
    return permissions?.[resource]?.[action] ?? false
  }

  const login = (token: string, u: AuthUser, perms: UserPermissions) => {
    localStorage.setItem('sf_token',       token)
    localStorage.setItem('sf_user',        u.username)
    localStorage.setItem('sf_role',        u.role)
    localStorage.setItem('sf_user_obj',    JSON.stringify(u))
    localStorage.setItem('sf_permissions', JSON.stringify(perms))
    if (u.franchise_id)   localStorage.setItem('sf_franchise_id',   u.franchise_id)
    if (u.franchise_name) localStorage.setItem('sf_franchise_name', u.franchise_name)
    setUser(u)
    setPermissions(perms)
  }

  const logout = () => {
    ['sf_token','sf_user','sf_role','sf_user_obj','sf_permissions','sf_franchise_id','sf_franchise_name']
      .forEach(k => localStorage.removeItem(k))
    setUser(null)
    setPermissions(null)
  }

  return (
    <AuthContext.Provider value={{
      user, permissions,
      isSuperAdmin, isFranchiseAdmin, isFranchiseStaff, can,
      login, logout,
      isLoggedIn: !!user && !!localStorage.getItem('sf_token'),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

// ── Standalone helpers (for use outside React components) ──────────────────
export function getCurrentUserRole(): string {
  const raw = localStorage.getItem('sf_user_obj')
  if (!raw) return localStorage.getItem('sf_role') || 'franchise_admin'
  try { return JSON.parse(raw).role || 'franchise_admin' } catch { return 'franchise_admin' }
}

export function getCurrentFranchiseId(): string | null {
  return localStorage.getItem('sf_franchise_id') || null
}

export function isCurrentUserSuperAdmin(): boolean {
  const role = getCurrentUserRole();
  const r = role ? role.toLowerCase().replace(/[\s-]/g, '_') : '';
  return r === 'super_admin' || r === 'admin' || r === 'head_office' || r === 'superadmin';
}
