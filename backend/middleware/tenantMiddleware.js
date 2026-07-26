// ═══════════════════════════════════════════════════════════════════════════
// tenantMiddleware.js — Tenant resolution and isolation for Multi-Tenant ERP
// Attaches req.tenant to every authenticated request.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

/**
 * Extracts and validates the tenant context from the JWT payload attached
 * by requireAuth. Must be called AFTER requireAuth in the middleware chain.
 *
 * Attaches to req.tenant:
 *   { id, franchise_id, role, is_super_admin, is_franchise_admin }
 *
 * Also suspends requests if the franchise account is suspended.
 */
async function resolveTenant(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const user = req.user;
  req.tenant = {
    id:                user.tenant_id   || 'admin',
    franchise_id:      user.franchise_id || null,
    role:              user.role         || 'franchise_admin',
    username:          user.username     || 'unknown',
    is_super_admin:    (user.role === 'super_admin' || user.role === 'admin'),
    is_franchise_admin:(user.role === 'franchise_admin'),
    is_franchise_staff:(user.role === 'franchise_staff'),
  };

  // If this is a franchise user, verify the franchise is not suspended
  if (req.tenant.franchise_id && !req.tenant.is_super_admin) {
    try {
      const supa = require('../repos/supabaseRepo');
      const { data: franchise } = await supa.rawClient
        .from('franchises')
        .select('status, name')
        .eq('id', req.tenant.franchise_id)
        .single();

      if (franchise && franchise.status === 'Suspended') {
        return res.status(403).json({
          error: 'Account suspended',
          message: `Your franchise account has been suspended. Please contact TheVoltaura Head Office.`
        });
      }
      req.tenant.franchise_name = franchise?.name || null;
    } catch (e) {
      // Non-fatal — franchise lookup failed, allow request to continue
      console.warn('[tenantMiddleware] franchise lookup failed:', e.message);
    }
  }

  next();
}

/**
 * Middleware: Only Super Admin (role === 'super_admin' or 'admin') may proceed.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.tenant) return res.status(401).json({ error: 'Not authenticated' });
  if (!req.tenant.is_super_admin) {
    return res.status(403).json({ error: 'Access denied. Super Admin only.' });
  }
  next();
}

/**
 * Middleware: Franchise Admin or Super Admin may proceed.
 * Blocks franchise_staff from write operations.
 */
function requireFranchiseAdmin(req, res, next) {
  if (!req.tenant) return res.status(401).json({ error: 'Not authenticated' });
  if (req.tenant.is_franchise_staff) {
    return res.status(403).json({ error: 'Access denied. Franchise Admin or higher required.' });
  }
  next();
}

/**
 * Applies a tenant filter to a Supabase query object.
 * Super Admin: no filter (sees all data).
 * Franchise user: filters by tenant_id AND franchise_id.
 *
 * @param {object} query  - Supabase query builder
 * @param {object} tenant - req.tenant object
 * @returns {object}      - filtered query
 */
function applyTenantFilter(query, tenant) {
  if (tenant.is_super_admin) return query;
  return query
    .eq('tenant_id',   tenant.id)
    .eq('franchise_id', tenant.franchise_id);
}

/**
 * Builds the tenant payload to inject into new records.
 * @param {object} tenant - req.tenant object
 * @returns {object}
 */
function tenantPayload(tenant) {
  return {
    tenant_id:    tenant.id,
    franchise_id: tenant.franchise_id || null,
  };
}

/**
 * Locked settings keys — franchise users cannot modify these.
 */
const LOCKED_SETTINGS_KEYS = [
  'orgName', 'companyName', 'company_name',
  'gstNumber', 'gst_number', 'gstin',
  'logo', 'logoUrl', 'logo_url',
  'directorSignature', 'director_signature',
  'companySeal', 'company_seal',
  'invoiceTemplate', 'invoice_template',
  'quotationTemplate', 'quotation_template',
  'termsConditions', 'terms_conditions', 'terms',
  'paymentTerms', 'payment_terms',
  'documentNumbering', 'document_numbering',
  'branding', 'companyBranding',
];

/**
 * Strips locked fields from a settings payload for franchise users.
 * For Super Admin, returns payload unchanged.
 *
 * @param {object} payload - incoming settings body
 * @param {object} tenant  - req.tenant
 * @returns {{ cleaned: object, blockedKeys: string[] }}
 */
function enforceSettingsLock(payload, tenant) {
  if (tenant.is_super_admin) return { cleaned: payload, blockedKeys: [] };

  const cleaned = { ...payload };
  const blockedKeys = [];

  for (const key of LOCKED_SETTINGS_KEYS) {
    if (key in cleaned) {
      delete cleaned[key];
      blockedKeys.push(key);
    }
  }

  // Also strip nested keys
  if (cleaned.global_settings) {
    const inner = { ...cleaned.global_settings };
    for (const key of LOCKED_SETTINGS_KEYS) {
      if (key in inner) {
        delete inner[key];
        blockedKeys.push(`global_settings.${key}`);
      }
    }
    cleaned.global_settings = inner;
  }

  return { cleaned, blockedKeys };
}

module.exports = {
  resolveTenant,
  requireSuperAdmin,
  requireFranchiseAdmin,
  applyTenantFilter,
  tenantPayload,
  enforceSettingsLock,
  LOCKED_SETTINGS_KEYS,
};
