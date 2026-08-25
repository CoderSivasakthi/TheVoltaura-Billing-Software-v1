'use strict';

function toSnakeKey(key) {
  if (!key || key.includes('_')) return key;
  return key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

const DROP_KEYS = new Set([
  'documents',
  'customer',
  'quotation',
  'payments',
  'type',
  'franchise_name',
  'franchise_code',
  'project_size',
  'balance',
]);

function mapToDb(payload) {
  const out = {};
  if (!payload || typeof payload !== 'object') return out;
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || typeof value === 'function') continue;
    if (DROP_KEYS.has(key)) continue;
    const mapped = toSnakeKey(key);
    if (mapped === 'date') {
      out.document_date = value;
      continue;
    }
    out[mapped] = isPlainObject(value) ? value : value;
  }
  return out;
}

function enrichRecord(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  const extra = { ...row };
  extra.customerName = row.customerName || row.customer_name;
  extra.customerId = row.customerId || row.customer_id;
  extra.grandTotal = row.grandTotal ?? row.grand_total;
  extra.approval_status = row.approval_status || row.approvalStatus || extra.approval_status;
  extra.createdAt = row.createdAt || row.created_at;
  extra.date = row.date || row.document_date;
  extra.billingAddr = row.billingAddr || row.billing_addr;
  extra.siteAddr = row.siteAddr || row.site_addr;
  extra.systemSizeKw = row.systemSizeKw ?? row.system_size_kw;
  extra.invoiceId = row.invoiceId || row.invoice_id;
  extra.quotationId = row.quotationId || row.quotation_id;
  extra.totalTax = row.totalTax ?? row.total_tax ?? row.gstAmount ?? row.gst_amount;
  extra.gstAmount = row.gstAmount ?? row.gst_amount;
  extra.customerInfo = row.customerInfo || row.customer_info;
  extra.total = row.total ?? row.grand_total ?? row.grandTotal;
  extra.companyGst = row.companyGst || row.company_gst;
  extra.companyAddress = row.companyAddress || row.company_address;
  extra.companyBranchId = row.companyBranchId || row.company_branch_id;
  extra.dailyGeneration = row.dailyGeneration ?? row.daily_generation;
  extra.annualGeneration = row.annualGeneration ?? row.annual_generation;
  extra.subsidyAmount = row.subsidyAmount ?? row.subsidy_amount;
  extra.netCustomerCost = row.netCustomerCost ?? row.net_customer_cost;
  extra.submitted_at = row.submitted_at || row.submittedAt;
  extra.approved_by = row.approved_by || row.approvedBy;
  extra.approved_at = row.approved_at || row.approvedAt;
  extra.rejection_reason = row.rejection_reason || row.rejectionReason;
  extra.franchise_id = row.franchise_id || row.franchiseId;
  extra.tenant_id = row.tenant_id || row.tenantId;
  extra.read = row.read ?? row.is_read ?? false;
  extra.desc = row.desc || row.description;
  extra.title = row.title;
  extra.global_settings = row.global_settings || extra.global_settings;
  return extra;
}

function extractUnknownColumn(error) {
  const msg = String(error?.message || error?.details || '');
  const quoted = msg.match(/Could not find the '([^']+)' column/i);
  if (quoted) return quoted[1];
  const schema = msg.match(/column [.\w]*"?([A-Za-z0-9_]+)"? does not exist/i);
  if (schema) return schema[1];
  return null;
}

module.exports = { mapToDb, enrichRecord, extractUnknownColumn, toSnakeKey };
