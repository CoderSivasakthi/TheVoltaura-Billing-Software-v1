// ═══════════════════════════════════════════════════════════════════════════
// rbacMiddleware.js — Role-Based Access Control permission factory
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

// Static permission matrix — mirrors what's in the DB for fast in-memory checks
const ROLE_PERMISSIONS = {
  super_admin: {
    customers:  { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    quotations: { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    invoices:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    payments:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    orders:     { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    products:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    amc:        { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    reports:    { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    settings:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    franchises: { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    approvals:  { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    branding:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
  },
  // Alias so legacy 'admin' and 'head_office' roles also get full access
  admin: {
    customers:  { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    quotations: { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    invoices:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    payments:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    orders:     { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    products:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    amc:        { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    reports:    { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    settings:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    franchises: { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    approvals:  { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    branding:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
  },
  head_office: {
    customers:  { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    quotations: { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    invoices:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    payments:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    orders:     { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    products:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    amc:        { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    reports:    { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    settings:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    franchises: { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    approvals:  { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
    branding:   { view: true,  create: true,  edit: true,  delete: true,  approve: true  },
  },
  franchise_admin: {
    customers:  { view: true,  create: true,  edit: true,  delete: true,  approve: false },
    quotations: { view: true,  create: true,  edit: true,  delete: false, approve: false },
    invoices:   { view: true,  create: true,  edit: true,  delete: false, approve: false },
    payments:   { view: true,  create: true,  edit: true,  delete: false, approve: false },
    orders:     { view: true,  create: true,  edit: true,  delete: false, approve: false },
    products:   { view: true,  create: false, edit: false, delete: false, approve: false },
    amc:        { view: true,  create: true,  edit: true,  delete: false, approve: false },
    reports:    { view: true,  create: false, edit: false, delete: false, approve: false },
    settings:   { view: true,  create: false, edit: true,  delete: false, approve: false },
    franchises: { view: false, create: false, edit: false, delete: false, approve: false },
    approvals:  { view: false, create: false, edit: false, delete: false, approve: false },
    branding:   { view: false, create: false, edit: false, delete: false, approve: false },
  },
  franchise_staff: {
    customers:  { view: true,  create: true,  edit: false, delete: false, approve: false },
    quotations: { view: true,  create: true,  edit: false, delete: false, approve: false },
    invoices:   { view: true,  create: false, edit: false, delete: false, approve: false },
    payments:   { view: true,  create: false, edit: false, delete: false, approve: false },
    orders:     { view: true,  create: false, edit: false, delete: false, approve: false },
    products:   { view: true,  create: false, edit: false, delete: false, approve: false },
    amc:        { view: true,  create: false, edit: false, delete: false, approve: false },
    reports:    { view: true,  create: false, edit: false, delete: false, approve: false },
    settings:   { view: false, create: false, edit: false, delete: false, approve: false },
    franchises: { view: false, create: false, edit: false, delete: false, approve: false },
    approvals:  { view: false, create: false, edit: false, delete: false, approve: false },
    branding:   { view: false, create: false, edit: false, delete: false, approve: false },
  },
};

/**
 * Check if a role has a specific permission on a resource.
 * @param {string} role     - user role
 * @param {string} resource - e.g. 'quotations'
 * @param {string} action   - 'view' | 'create' | 'edit' | 'delete' | 'approve'
 * @returns {boolean}
 */
function hasPermission(role, resource, action) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  const res = perms[resource];
  if (!res) return false;
  return !!res[action];
}

/**
 * Returns the full permission set for a role.
 * Used by frontend to build role-aware UI.
 * @param {string} role
 * @returns {object}
 */
function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['franchise_staff'];
}

/**
 * Express middleware factory.
 * Usage: router.post('/approve', requirePermission('quotations', 'approve'), handler)
 *
 * @param {string} resource
 * @param {string} action
 */
function requirePermission(resource, action) {
  return (req, res, next) => {
    if (!req.tenant) return res.status(401).json({ error: 'Not authenticated' });
    const role = req.tenant.role;
    if (!hasPermission(role, resource, action)) {
      return res.status(403).json({
        error: `Access denied. Your role (${role}) does not have ${action} permission on ${resource}.`
      });
    }
    next();
  };
}

module.exports = {
  hasPermission,
  getPermissionsForRole,
  requirePermission,
  ROLE_PERMISSIONS,
};
