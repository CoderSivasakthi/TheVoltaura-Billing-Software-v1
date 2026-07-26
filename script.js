/* SolarOps ERP — script.js v2 */
'use strict';

const API_BASE = 'http://localhost:5001';

// ── API ───────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('sf_token') || 'demo-token-12345'; }
async function api(method, path, body) {
    const r = await fetch(API_BASE + path, {
        method, headers: { 'x-demo-auth': getToken(), 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
    return r.json();
}

// ── Toast ─────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
    let el = document.getElementById('_toast');
    if (!el) { el = document.createElement('div'); el.id = '_toast'; el.className = 'toast'; document.body.appendChild(el); }
    const cls = { success: 't-s', error: 't-e', info: 't-i', warning: 't-w' };
    el.textContent = (type === 'success' ? '✓ ' : type === 'error' ? '✕ ' : 'ℹ ') + msg;
    el.className = `toast ${cls[type] || 't-i'} show`;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Modals ────────────────────────────────────────────────────────
function showModal(id) {
    document.getElementById(id).classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
}
window.showModal = showModal; window.closeModal = closeModal;
document.getElementById('modalOverlay').addEventListener('click', () => {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    document.getElementById('modalOverlay').classList.remove('active');
});

// ── Helpers ───────────────────────────────────────────────────────
const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function $id(id) { return document.getElementById(id); }
function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }
function setText(id, val) { const el = $id(id); if (el) el.textContent = val ?? '—'; }
function setVal(id, val) { const el = $id(id); if (el) el.value = val ?? ''; }

// Avatar color (consistent per name)
const AV_COLORS = ['avc-0', 'avc-1', 'avc-2', 'avc-3', 'avc-4', 'avc-5', 'avc-6', 'avc-7', 'avc-8', 'avc-9'];
function avColor(name) { const n = typeof name === 'object' ? (name?.name || '') : String(name || ''); let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) & 0xff; return AV_COLORS[h % AV_COLORS.length]; }
function avInitials(name) { const n = typeof name === 'object' ? (name?.name || '') : String(name || ''); const p = n.trim().split(/\s+/); return p.length > 1 ? p[0][0] + p[1][0] : p[0] ? p[0].slice(0, 2) : '??'; }
function avEl(name, cls = '') { return `<div class="av-circle ${avColor(name)} ${cls}">${avInitials(name).toUpperCase()}</div>`; }

// Status tag
function statusTag(s) {
    const map = {
        Paid: 't-paid', Partial: 't-partial', Pending: 't-pending', Draft: 't-draft', Overdue: 't-overdue', Active: 't-active', 'Expiring Soon': 't-expiring', Expired: 't-expired', Converted: 't-converted',
        Registered: 't-registered', Composition: 't-composition', Unregistered: 't-unregistered'
    };
    return `<span class="tag ${map[s] || 't-draft'}">${s || 'Draft'}</span>`;
}

// Date format
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

// ── Navigation ────────────────────────────────────────────────────
let _curPage = 'dashboard';
// Canonical page names that map to URL paths
const URL_PAGES = ['dashboard', 'customers', 'quotations', 'invoices', 'payments', 'products', 'amc', 'reports', 'settings'];

function navigatePage(page, pushState = true) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-it[data-page]').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    const pg = $id(page + '-page');
    if (pg) pg.classList.add('active');
    _curPage = page;
    // Update URL for known top-level pages
    if (pushState && URL_PAGES.includes(page)) {
        const newPath = page === 'dashboard' ? '/' : `/${page}`;
        if (window.location.pathname !== newPath) {
            history.pushState({ page }, '', newPath);
        }
    }
    if (page === 'dashboard') initDashboard();
    if (page === 'customers') loadCustomers();
    if (page === 'products') loadProducts();
    if (page === 'invoices') loadInvoices();
    if (page === 'quotations') loadQuotations();
    if (page === 'payments') loadPayments();
    if (page === 'amc') loadAmc();
    if (page === 'reports') loadReports();
    if (page === 'create-quotation') initCreateQuotation();
    if (page === 'create-invoice') initCreateInvoice();
}
window.navigatePage = navigatePage;

// Handle browser back/forward
window.addEventListener('popstate', e => {
    const page = e.state?.page || pageFromPath(window.location.pathname);
    navigatePage(page, false);
});

document.querySelectorAll('.nav-it[data-page]').forEach(btn => btn.addEventListener('click', () => navigatePage(btn.dataset.page)));

// Sidebar toggle
$id('sidebarToggle').addEventListener('click', () => $id('sidebar').classList.toggle('open'));

// Logout
$id('logoutBtn').addEventListener('click', () => { localStorage.removeItem('sf_token'); window.location.href = 'login.html'; });

// ── USER INIT ─────────────────────────────────────────────────────
function initUser() {
    const name = localStorage.getItem('sf_user') || 'Alex Morgan';
    const initials = avInitials(name).toUpperCase();
    const colorCls = avColor(name);
    const sbAv = $id('sbAvatar'); if (sbAv) { sbAv.textContent = initials; sbAv.className = `av ${colorCls}`; }
    const tbAv = $id('tbAvatar'); if (tbAv) { tbAv.textContent = initials; tbAv.className = `tb-avatar ${colorCls}`; }
    setText('sbUserName', name); setText('tbUserName', name);
}

// ═══════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════
const CAT_ICONS = { Panels: 'sun', Panel: 'sun', Inverters: 'zap', Inverter: 'zap', Batteries: 'battery', Battery: 'battery', Cables: 'plug', Cable: 'plug', Service: 'wrench', Mounting: 'settings', Default: 'package' };
function catIcon(c) { return CAT_ICONS[c] || CAT_ICONS.Default; }

let _products = [];
async function loadProducts() {
    try {
        const d = await api('GET', '/api/products');
        _products = Array.isArray(d) ? d : (d.value || []);
    } catch { _products = []; }
    renderProducts(_products);
    updateProductStats(_products);
}

function updateProductStats(list) {
    const low = list.filter(p => (p.stock || 0) < 10).length;
    const val = list.reduce((s, p) => s + (p.price || 0) * (p.stock || 0), 0);
    const cats = {}; list.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
    const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
    setText('statTotalProducts', list.length);
    setText('statLowStock', low);
    setText('statTotalValue', val >= 100000 ? '₹' + (val / 100000).toFixed(1) + 'L' : fmt(val));
    setText('statTopCategory', top ? top[0] : '—');
    const sub = $id('statTopCatSub'); if (sub) { sub.innerHTML = top ? `<span class="desc txt-muted">${top[1]} items</span>` : ''; }
}

function renderProducts(list) {
    const tb = $id('productsBody');
    const footer = $id('prodFooter');
    if (footer) footer.textContent = `Showing ${list.length} of ${_products.length} items`;
    if (!list.length) { tb.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="ei"><i data-lucide="package"></i></div><p>No products found</p></td></tr>'; refreshIcons(); return; }
    tb.innerHTML = list.map(p => {
        const low = (p.stock || 0) < 10;
        return `<tr data-id="${p.id}" data-type="products">
      <td><div class="prod-cell"><div class="prod-thumb"><i data-lucide="${catIcon(p.category)}"></i></div><div><div class="prod-name">${p.name || '—'}</div><div class="prod-sku">${p.sku || ('SKU-' + p.id)}</div></div></div></td>
      <td>${p.category || '—'}</td><td>${p.brand || '—'}</td>
      <td><div style="display:flex;align-items:center;gap:6px"><span style="font-weight:600">${p.stock || 0}</span>${low ? '<span class="badge b-danger badge-no-dot" style="font-size:11px">Low</span>' : ''}</div></td>
      <td style="font-weight:600">${fmt(p.price)}</td>
      <td>${statusTag(p.status || 'Active')}</td>
      <td><div class="act-menu">
        <button class="act-link primary" data-action="edit" data-entity="products" data-id="${p.id}"><i data-lucide="edit" style="width:14px;height:14px"></i></button>
        <button class="act-link danger" data-action="delete" data-entity="products" data-id="${p.id}"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
      </div></td>
    </tr>`;
    }).join('');
    refreshIcons();
}

// Category filter tabs
document.getElementById('productFilterTabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.ftab[data-cat]'); if (!tab) return;
    document.querySelectorAll('#productFilterTabs .ftab[data-cat]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const cat = tab.dataset.cat;
    renderProducts(cat === 'all' ? _products : _products.filter(p => (p.category || '').toLowerCase().includes(cat.toLowerCase())));
});

// Product search
$id('prodSearch')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    renderProducts(_products.filter(p => (p.name || '').toLowerCase().includes(term) || (p.category || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term)));
});

// Product modal
let _editProdId = null;
function openProductModal(id, data) {
    _editProdId = id || null;
    setText('prodModalTitle', id ? 'Edit Product' : 'Add New Product');
    setText('saveProductBtn', id ? 'Save Changes' : 'Add Product');
    const fields = { prodName: 'name', prodSku: 'sku', prodBrand: 'brand', prodPrice: 'price', prodStock: 'stock' };
    Object.entries(fields).forEach(([fid, key]) => setVal(fid, data?.[key] || ''));
    setVal('prodCategory', data?.category || 'Panels');
    setVal('prodGst', data?.gst_rate || 18);
    showModal('productModal');
}
window.openProductModal = openProductModal;

$id('saveProductBtn').addEventListener('click', async () => {
    const name = $id('prodName').value.trim();
    if (!name) { toast('Product name required', 'error'); return; }
    const payload = { name, sku: $id('prodSku').value.trim(), brand: $id('prodBrand').value.trim(), category: $id('prodCategory').value, gst_rate: Number($id('prodGst').value), price: Number($id('prodPrice').value) || 0, stock: Number($id('prodStock').value) || 0, status: 'Active' };
    try {
        if (_editProdId) { await api('PUT', `/api/products/${_editProdId}`, payload); toast('Product updated'); }
        else { await api('POST', '/api/products', payload); toast('Product added'); }
        closeModal('productModal'); loadProducts();
    } catch { toast('Failed to save product', 'error'); }
});

// ═══════════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════════
let _customers = [];
let _custPage = 1; const CUST_PER_PAGE = 8;

async function loadCustomers() {
    try {
        const d = await api('GET', '/api/customers');
        _customers = Array.isArray(d) ? d : (d.value || []);
    } catch { _customers = []; }
    populateCityFilter();
    renderCustomers(filterCustomers());
    populateDropdowns();
}

function filterCustomers() {
    const term = ($id('custSearch')?.value || '').toLowerCase();
    const city = $id('custCityFilter')?.value || '';
    const gstSt = $id('custGstFilter')?.value || '';
    return _customers.filter(c =>
        (!term || (c.name || '').toLowerCase().includes(term) || (c.phone || '').toLowerCase().includes(term) || (c.gstin || c.gst || '').toLowerCase().includes(term)) &&
        (!city || (c.city || '') === city) &&
        (!gstSt || (c.gstStatus || c.gst_status || 'Registered') === gstSt)
    );
}

function populateCityFilter() {
    const sel = $id('custCityFilter'); if (!sel) return;
    const cities = [...new Set(_customers.map(c => c.city).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">All Cities</option>' + cities.map(c => `<option>${c}</option>`).join('');
}

function renderCustomers(list) {
    const start = (_custPage - 1) * CUST_PER_PAGE;
    const page = list.slice(start, start + CUST_PER_PAGE);
    const tb = $id('customersBody');
    const footer = $id('custFooter');
    if (footer) footer.innerHTML = `Showing <span>${start + 1}</span> to <span>${Math.min(start + CUST_PER_PAGE, list.length)}</span> of <span>${list.length} results</span>`;
    if (!page.length) { tb.innerHTML = '<tr><td colspan="7" class="empty-state"><p>No customers found</p></td></tr>'; renderCustPag(list, 0); return; }
    tb.innerHTML = page.map((c, i) => {
        const gstSt = c.gstStatus || c.gst_status || (c.gstin || c.gst ? 'Registered' : 'Unregistered');
        const gstNum = (c.gstin || c.gst) ? `<span>${c.gstin || c.gst}</span>` : `<span class="txt-orange">Not Applicable</span>`;
        return `<tr data-id="${c.id}" data-type="customers">
      <td><div class="cust-cell">${avEl(c.name)}<div><div class="cust-name">${c.name}</div><div class="cust-id">ID: #CUST-${String(start + i + 1).padStart(3, '0')}</div></div></div></td>
      <td>${c.phone || '—'}</td>
      <td>${gstNum}</td>
      <td>${c.city || '—'}</td>
      <td style="font-weight:700">₹ ${Number(c.balance || 0).toLocaleString('en-IN')}</td>
      <td>${statusTag(gstSt)}</td>
      <td><div class="act-btn-group">
        <button class="abl abl-edit" data-action="edit" data-entity="customers" data-id="${c.id}"><i data-lucide="pencil" style="width:12px;height:12px"></i> Edit</button>
      </div></td>
    </tr>`;
    }).join('');
    refreshIcons();
    renderCustPag(list, page.length);
}

function renderCustPag(list, showing) {
    const total = Math.ceil(list.length / CUST_PER_PAGE);
    const pag = $id('custPag'); if (!pag) return;
    if (total <= 1) { pag.innerHTML = ''; return; }
    const pages = [];
    for (let i = 1; i <= Math.min(total, 8); i++) pages.push(i);
    pag.innerHTML = `<button class="pag-btn" ${_custPage === 1 ? 'disabled' : ''} onclick="_custPage--;renderCustomers(filterCustomers())">‹</button>`
        + pages.map(p => `<button class="pag-btn ${p === _custPage ? 'active' : ''}" onclick="_custPage=${p};renderCustomers(filterCustomers())">${p}</button>`).join('')
        + (total > 8 ? `<span class="pag-ellipsis">…</span><button class="pag-btn ${total === _custPage ? 'active' : ''}" onclick="_custPage=${total};renderCustomers(filterCustomers())">${total}</button>` : '')
        + `<button class="pag-btn" ${_custPage >= total ? 'disabled' : ''} onclick="_custPage++;renderCustomers(filterCustomers())">›</button>`;
}

['custSearch'].forEach(id => { $id(id)?.addEventListener('input', () => { _custPage = 1; renderCustomers(filterCustomers()); }); });
['custCityFilter', 'custGstFilter'].forEach(id => { $id(id)?.addEventListener('change', () => { _custPage = 1; renderCustomers(filterCustomers()); }); });

function populateDropdowns() {
    ['invoiceCustomerSelect', 'quotationCustomerSelect'].forEach(id => {
        const sel = $id(id); if (!sel) return;
        sel.innerHTML = '<option value="">Select customer...</option>' + _customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    });
}

let _editCustId = null;
function openCustomerModal(id, data) {
    _editCustId = id || null;
    setText('custModalTitle', id ? 'Edit Customer' : 'Add New Customer');
    setText('saveCustomerBtn', id ? 'Save Changes' : 'Add Customer');
    if (data) {
        setVal('custName', data.name); setVal('custPhone', data.phone); setVal('custEmail', data.email);
        setVal('custCity', data.city); setVal('custGstin', data.gstin || data.gst);
        setVal('custGstStatus', data.gstStatus || data.gst_status || 'Registered');
        setVal('custAddress', data.billing_address?.street || data.address || ''); setVal('custStatus', data.status || 'Active');
    } else {
        ['custName', 'custPhone', 'custEmail', 'custCity', 'custGstin', 'custAddress'].forEach(f => setVal(f, ''));
        setVal('custGstStatus', 'Registered'); setVal('custStatus', 'Active');
    }
    showModal('customerModal');
}
window.openCustomerModal = openCustomerModal;

$id('saveCustomerBtn').addEventListener('click', async () => {
    const name = $id('custName').value.trim();
    if (!name) { toast('Customer name required', 'error'); return; }
    const payload = { name, phone: $id('custPhone').value.trim(), email: $id('custEmail').value.trim(), city: $id('custCity').value.trim(), gstin: $id('custGstin').value.trim(), gstStatus: $id('custGstStatus').value, address: $id('custAddress').value.trim(), status: $id('custStatus').value };
    try {
        if (_editCustId) { await api('PUT', `/api/customers/${_editCustId}`, payload); toast('Customer updated'); }
        else { await api('POST', '/api/customers', payload); toast('Customer added'); }
        closeModal('customerModal'); loadCustomers();
    } catch { toast('Failed to save customer', 'error'); }
});

// ═══════════════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════════════
let _invoices = [];
async function loadInvoices() {
    try { const d = await api('GET', '/api/invoices'); _invoices = Array.isArray(d) ? d : (d.value || []); } catch { _invoices = []; }
    renderInvoices(_invoices);
}

function renderInvoices(list) {
    const tb = $id('invoicesBody');
    if (!list.length) { tb.innerHTML = '<tr><td colspan="8" class="empty-state"><p>No invoices found</p></td></tr>'; return; }
    tb.innerHTML = list.map(inv => {
        const cName = typeof inv.customer === 'object' ? (inv.customer?.name || inv.customer?.id || '—') : (inv.customer || '—');
        const gst = inv.gst || (inv.subtotal || 0) * 0.18;
        return `<tr data-id="${inv.id}" data-type="invoices">
      <td><a class="tbl-link" data-action="view" data-entity="invoices" data-id="${inv.id}" href="#">${inv.id}</a></td>
      <td><div class="cust-cell">${avEl(cName, 'av-sm')}<span style="font-size:13px;font-weight:500">${cName}</span></div></td>
      <td>${fmtDate(inv.createdAt)}</td>
      <td>${fmt(inv.subtotal)}</td>
      <td class="txt-muted">${fmt(gst)}</td>
      <td style="font-weight:700">${fmt(inv.total)}</td>
      <td>${statusTag(inv.status || 'Pending')}</td>
      <td><div class="act-btn-group">
        <button class="abl abl-view" data-action="view" data-entity="invoices" data-id="${inv.id}"><i data-lucide="eye" style="width:12px;height:12px"></i> View</button>
        <button class="abl abl-del" data-action="delete" data-entity="invoices" data-id="${inv.id}"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>
      </div></td>
    </tr>`;
    }).join('');
    refreshIcons();
    setText('invFooter', `Showing 1 to ${list.length} of ${list.length} results`);
}

$id('invSearch')?.addEventListener('input', e => {
    const t = e.target.value.toLowerCase();
    renderInvoices(_invoices.filter(i => JSON.stringify(i).toLowerCase().includes(t)));
});
$id('invStatusFilter')?.addEventListener('change', e => {
    const v = e.target.value;
    renderInvoices(v ? _invoices.filter(i => i.status === v) : _invoices);
});

// ═══════════════════════════════════════════════════════════════════
// QUOTATIONS
// ═══════════════════════════════════════════════════════════════════
let _quotations = [];
async function loadQuotations() {
    try { const d = await api('GET', '/api/quotations'); _quotations = Array.isArray(d) ? d : (d.value || []); } catch { _quotations = []; }
    renderQuotations(_quotations);
}

function renderQuotations(list) {
    const tb = $id('quotationsBody');
    if (!list.length) { tb.innerHTML = '<tr><td colspan="6" class="empty-state"><p>No quotations found</p></td></tr>'; return; }
    tb.innerHTML = list.map(q => {
        const cName = typeof q.customer === 'object' ? (q.customer?.name || q.customer?.id || '—') : (q.customer || '—');
        return `<tr data-id="${q.id}" data-type="quotations">
      <td style="font-weight:700">${q.id}</td>
      <td><div class="cust-cell">${avEl(cName, 'av-sm')}<span>${cName}</span></div></td>
      <td>${fmtDate(q.createdAt)}</td>
      <td style="font-weight:700">${fmt(q.total)}</td>
      <td>${statusTag(q.status || 'Draft')}</td>
      <td><div class="act-btn-group">
        <button class="abl abl-view" data-action="view" data-entity="quotations" data-id="${q.id}"><i data-lucide="eye" style="width:12px;height:12px"></i> View</button>
        <button class="abl abl-convert" data-action="convert" data-entity="quotations" data-id="${q.id}" ${q.status === 'Converted' ? 'disabled style="opacity:.4"' : ''}><i data-lucide="arrow-right-circle" style="width:12px;height:12px"></i> Convert</button>
        <button class="abl abl-del" data-action="delete" data-entity="quotations" data-id="${q.id}"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>
      </div></td>
    </tr>`;
    }).join('');
    refreshIcons();
    setText('quotFooter', `${list.length} results`);
}

$id('quotSearch')?.addEventListener('input', e => {
    const t = e.target.value.toLowerCase();
    renderQuotations(_quotations.filter(q => JSON.stringify(q).toLowerCase().includes(t)));
});

// ═══════════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════
let _payments = [];
async function loadPayments() {
    try { const d = await api('GET', '/api/payments'); _payments = Array.isArray(d) ? d : (d.value || []); } catch { _payments = []; }
    const tb = $id('paymentsBody');
    if (!_payments.length) { tb.innerHTML = '<tr><td colspan="7" class="empty-state"><p>No payments found</p></td></tr>'; setText('payFooter', '0 results'); return; }
    tb.innerHTML = _payments.map(p => `<tr data-id="${p.id}" data-type="payments">
    <td style="font-weight:600">${p.id}</td>
    <td>${p.invoiceId || '—'}</td>
    <td style="font-weight:700;color:var(--green)">${fmt(p.amount)}</td>
    <td>${p.method || '—'}</td>
    <td>${fmtDate(p.date || p.createdAt)}</td>
    <td>${p.reference || '—'}</td>
    <td><div class="act-btn-group"><button class="abl abl-del" data-action="delete" data-entity="payments" data-id="${p.id}"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button></div></td>
  </tr>`).join('');
    refreshIcons();
    setText('payFooter', `${_payments.length} results`);
}

$id('paySearch')?.addEventListener('input', e => {
    const t = e.target.value.toLowerCase();
    document.querySelectorAll('#paymentsBody tr').forEach(r => r.style.display = r.textContent.toLowerCase().includes(t) ? '' : 'none');
});

$id('savePaymentBtn')?.addEventListener('click', async () => {
    const amount = Number($id('payAmount').value);
    if (!amount) { toast('Amount required', 'error'); return; }
    const payload = { invoiceId: $id('payInvoiceId').value.trim(), amount, date: $id('payDate').value, method: $id('payMethod').value, reference: $id('payReference').value.trim(), notes: $id('payNotes').value.trim() };
    try {
        await api('POST', '/api/payments', payload);
        toast('Payment recorded!');
        closeModal('recordPaymentModal');
        ['payInvoiceId', 'payAmount', 'payReference', 'payNotes'].forEach(f => setVal(f, ''));
        loadPayments(); loadInvoices();
    } catch { toast('Failed to record payment', 'error'); }
});

// ═══════════════════════════════════════════════════════════════════
// AMC
// ═══════════════════════════════════════════════════════════════════
let _amc = [];
let _selectedAmc = null;
window._selectedAmc = null;

async function loadAmc() {
    try { const d = await api('GET', '/api/amc'); _amc = Array.isArray(d) ? d : (d.value || []); } catch { _amc = []; }
    const active = _amc.filter(a => a.status === 'Active').length;
    const expiring = _amc.filter(a => a.status === 'Expiring Soon').length;
    setText('amcActiveCount', active);
    setText('amcExpiringCount', expiring);
    setText('amcDueCount', _amc.filter(a => { if (!a.nextService) return false; const d = new Date(a.nextService); const diff = (d - new Date()) / 86400000; return diff >= 0 && diff <= 7; }).length);
    setText('amcRevenue', '₹' + (active * 12500).toLocaleString('en-IN'));
    setText('sbAmcBadge', expiring || '');
    if (!expiring) $id('sbAmcBadge')?.style.setProperty('display', 'none');
    renderAmc(filterAmc());
}

function filterAmc() {
    const term = ($id('amcSearch')?.value || '').toLowerCase();
    const st = $id('amcStatusFilter')?.value || '';
    return _amc.filter(a => (!term || (a.customer || '').toLowerCase().includes(term)) && (!st || a.status === st));
}

function renderAmc(list) {
    const tb = $id('amcBody');
    setText('amcFooter', `Showing 1 to ${list.length} of ${list.length} results`);
    if (!list.length) { tb.innerHTML = '<tr><td colspan="5" class="empty-state"><p>No contracts found</p></td></tr>'; return; }
    tb.innerHTML = list.map((a, i) => {
        const overdue = a.nextService && new Date(a.nextService) < new Date();
        const nextTxt = a.nextService ? (overdue ? `<span class="txt-danger">⚠ ${fmtDate(a.nextService)}</span><div style="font-size:11px;color:var(--red)">Overdue by ${Math.floor((new Date() - new Date(a.nextService)) / 86400000)} days</div>` : `<span>${fmtDate(a.nextService)}</span><div style="font-size:11px;color:var(--g400)">Scheduled</div>`) : '<span class="txt-muted">None</span>';
        const isSelected = _selectedAmc?.id === a.id;
        return `<tr class="${isSelected ? 'selected-row' : ''}" data-id="${a.id}" data-type="amc" style="cursor:pointer;${isSelected ? 'background:var(--orange-pale)' : ''}">
      <td><div class="cust-cell">${avEl(a.customer || '?')}<div><div class="cust-name">${a.customer || '—'}</div><div class="cust-id">AMC-${String(2023000 + i + 1).slice(-7)}</div></div></div></td>
      <td><div style="font-size:12px">${a.startDate ? fmtDate(a.startDate) : '—'}</div><div style="font-size:11px;color:var(--g400)">to ${a.endDate ? fmtDate(a.endDate) : '—'}</div></td>
      <td>${nextTxt}</td>
      <td>${a.systemSize || '—'}</td>
      <td>${statusTag(a.status || 'Active')}</td>
    </tr>`;
    }).join('');
    // Row click → update panel
    tb.querySelectorAll('tr[data-id][data-type="amc"]').forEach(row => row.addEventListener('click', () => {
        const a = _amc.find(x => x.id === row.dataset.id);
        if (a) selectAmcContract(a);
    }));
}

function selectAmcContract(a) {
    _selectedAmc = a; window._selectedAmc = a;
    setText('adpName', a.customer || '—');
    setText('adpId', 'AMC-' + (a.id || '').toString().slice(0, 10));
    setText('adpNext', a.nextService ? fmtDate(a.nextService) : '—');
    const statusEl = $id('adpStatus');
    if (statusEl) statusEl.innerHTML = statusTag(a.status || 'Active');
    renderAmc(filterAmc()); // re-render to highlight
}

function openAmcModal(id, data) {
    _editAmcId = id || null;
    setText('amcModalTitle', id ? 'Edit AMC Contract' : 'New AMC Contract');
    setText('saveAmcBtn', id ? 'Save Changes' : 'Save Contract');
    if (data) {
        setVal('amcCustomer', data.customer || '');
        setVal('amcSystemSize', data.systemSize || '');
        setVal('amcStatus', data.status || 'Active');
        setVal('amcStartDate', data.startDate || '');
        setVal('amcEndDate', data.endDate || '');
        setVal('amcNextService', data.nextService || '');
    } else {
        ['amcCustomer', 'amcSystemSize', 'amcStartDate', 'amcEndDate', 'amcNextService'].forEach(f => setVal(f, ''));
        setVal('amcStatus', 'Active');
    }
    showModal('amcModal');
}
window.openAmcModal = openAmcModal;

let _editAmcId = null;
$id('saveAmcBtn')?.addEventListener('click', async () => {
    const customer = $id('amcCustomer').value.trim();
    if (!customer) { toast('Customer name required', 'error'); return; }
    const p = { customer, systemSize: $id('amcSystemSize').value.trim(), status: $id('amcStatus').value, startDate: $id('amcStartDate').value, endDate: $id('amcEndDate').value, nextService: $id('amcNextService').value };
    try {
        if (_editAmcId) { await api('PUT', `/api/amc/${_editAmcId}`, p); toast('Contract updated'); }
        else { await api('POST', '/api/amc', p); toast('Contract created'); }
        closeModal('amcModal'); _editAmcId = null; loadAmc();
    } catch { toast('Failed to save contract', 'error'); }
});

// AMC filter
$id('amcSearch')?.addEventListener('input', () => renderAmc(filterAmc()));
$id('amcStatusFilter')?.addEventListener('change', () => renderAmc(filterAmc()));

// ═══════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════
async function loadReports() {
    try {
        const d = await api('GET', '/api/reports/summary');
        setText('rptRevenue', fmt(d.revenue || 0));
        setText('rptGst', fmt((d.revenue || 0) * 0.15));
        setText('rptNetProfit', fmt((d.revenue || 0) * 0.65));
        setText('rptPending', fmt(d.pending || 0));
    } catch {
        // fallback nums
        const invTotal = _invoices.reduce((s, i) => s + (i.total || 0), 0);
        setText('rptRevenue', fmt(invTotal));
        setText('rptGst', fmt(invTotal * 0.15));
        setText('rptNetProfit', fmt(invTotal * 0.65));
        setText('rptPending', fmt(_invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + (i.total || 0), 0)));
    }
    // Transactions table from invoices
    if (!_invoices.length) await loadInvoices();
    const tb = $id('transBody');
    setText('tranFooter', `Showing 1 to ${_invoices.length} of ${_invoices.length} results`);
    tb.innerHTML = _invoices.slice(0, 10).map(inv => {
        const cName = inv.customer?.name || inv.customer || '—';
        const taxable = inv.subtotal || inv.total * 0.848;
        const gst = inv.gst || taxable * 0.18;
        return `<tr data-id="${inv.id}" data-type="invoices">
      <td><a class="tbl-link" data-action="view" data-entity="invoices" data-id="${inv.id}" href="#">${inv.id}</a></td>
      <td>${fmtDate(inv.createdAt)}</td>
      <td><div class="cust-cell">${avEl(cName, 'av-sm')}<span>${cName}</span></div></td>
      <td>${inv.capacity || '—'}</td>
      <td>${fmt(taxable)}</td>
      <td class="txt-muted">${fmt(gst)}</td>
      <td style="font-weight:700">${fmt(inv.total)}</td>
      <td>${statusTag(inv.status || 'Pending')}</td>
      <td><button class="act-link" title="Download"><i data-lucide="download" style="width:14px;height:14px"></i></button></td>
    </tr>`;
    }).join('') || '<tr><td colspan="9" class="empty-state"><p>No transactions yet</p></td></tr>';
    refreshIcons();
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
let _chartsInited = false;
let _revChart, _donutChart;

// Safely destroy an existing Chart.js instance on a canvas
function destroyChart(canvasId) {
    const canvas = $id(canvasId);
    if (!canvas) return;
    const existing = Chart.getChart(canvas);
    if (existing) { existing.destroy(); }
}

async function initDashboard() {
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setText('dashLastUpdated', `Last updated: Today, ${now}`);

    // Always destroy+rebuild charts on each dashboard visit so data stays fresh
    destroyChart('revenueChart');
    destroyChart('invoiceStatusChart');
    _chartsInited = false;
    _revChart = null;
    _donutChart = null;

    try {
        const [rpt, custs, invs, amcData, prods] = await Promise.allSettled([
            api('GET', '/api/reports/summary'), api('GET', '/api/customers'),
            api('GET', '/api/invoices'), api('GET', '/api/amc'), api('GET', '/api/products')
        ]);
        const r = rpt.value || {};
        const cList = custs.value ? (Array.isArray(custs.value) ? custs.value : custs.value.value || []) : [];
        const iList = invs.value ? (Array.isArray(invs.value) ? invs.value : invs.value.value || []) : [];
        const aList = amcData.value ? (Array.isArray(amcData.value) ? amcData.value : amcData.value.value || []) : [];
        const pList = prods.value ? (Array.isArray(prods.value) ? prods.value : prods.value.value || []) : [];
        const total = iList.reduce((s, i) => s + (i.total || 0), 0);
        const pending = iList.filter(i => i.status !== 'Paid').reduce((s, i) => s + (i.total || 0), 0);
        const lowStock = pList.filter(p => (p.stock || 0) < 10).length;
        const activeAmc = aList.filter(a => a.status === 'Active').length;
        setText('kpiRevenue', fmt(r.revenue || total));
        setText('kpiPending', fmt(r.pending || pending));
        setText('kpiAmc', activeAmc);
        setText('kpiLowStock', lowStock);
        if (!lowStock) {
            const el = $id('kpiLowStockAlert');
            if (el) el.style.color = 'var(--green)';
            setText('kpiLowStockAlert', 'All good ✓');
        }

        // Recent invoices table
        const dash = $id('dashRecentInvoices');
        if (dash) {
            dash.innerHTML = iList.slice(0, 5).map(inv => {
                const cName = inv.customer?.name || inv.customer || '—';
                return `<tr data-id="${inv.id}" data-type="invoices">
          <td><a class="tbl-link" data-action="view" data-entity="invoices" data-id="${inv.id}" href="#">${inv.id}</a></td>
          <td>${cName}</td><td>${fmtDate(inv.createdAt)}</td>
          <td style="font-weight:700">${fmt(inv.total)}</td>
          <td>${statusTag(inv.status || 'Pending')}</td></tr>`;
            }).join('') || '<tr><td colspan="5" class="empty-state"><p>No invoices yet</p></td></tr>';
        }

        // ── CHARTS ──────────────────────────────────────────────
        const paid = iList.filter(i => i.status === 'Paid').length;
        const pend = iList.filter(i => i.status === 'Pending' || i.status === 'Draft').length;
        const over = iList.filter(i => i.status === 'Overdue').length;
        // Use demo data if API returned nothing to avoid empty charts
        const dPaid = paid || 4, dPend = pend || 6, dOver = over || 2;
        const invTotal = dPaid + dPend + dOver;

        // ── Donut chart (Invoice Status) ─────────────────────────
        const ctx2 = $id('invoiceStatusChart');
        if (ctx2) {
            _donutChart = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Paid', 'Pending', 'Overdue'],
                    datasets: [{
                        data: [dPaid, dPend, dOver],
                        backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                        borderWidth: 2,
                        borderColor: '#ffffff',
                        hoverOffset: 6
                    }]
                },
                options: {
                    cutout: '70%',
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => ` ${ctx.label}: ${ctx.raw} invoices (${Math.round(ctx.raw / invTotal * 100)}%)`
                            }
                        }
                    },
                    animation: { animateRotate: true, duration: 800 }
                }
            });
            setText('donutTotal', invTotal);
            setText('dlPaid', Math.round(dPaid / invTotal * 100) + '%');
            setText('dlPending', Math.round(dPend / invTotal * 100) + '%');
            setText('dlOverdue', Math.round(dOver / invTotal * 100) + '%');
        }

        // ── Revenue bar chart ────────────────────────────────────
        const ctx1 = $id('revenueChart');
        if (ctx1) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            // Try to build real monthly data from invoices, fall back to demo numbers
            const monthlyData = Array(12).fill(0);
            iList.forEach(inv => {
                if (inv.createdAt) {
                    const m = new Date(inv.createdAt).getMonth();
                    monthlyData[m] += (inv.total || 0);
                }
            });
            const hasRealData = monthlyData.some(v => v > 0);
            const barData = hasRealData ? monthlyData : [110000, 145000, 92000, 188000, 152000, 220000, 195000, 178000, 240000, 198000, 267000, 310000];
            const curMonth = new Date().getMonth();
            _revChart = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Revenue (₹)',
                        data: barData,
                        backgroundColor: months.map((_, i) => i === curMonth ? '#F59E0B' : 'rgba(245,158,11,0.35)'),
                        borderRadius: 6,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => ' ₹' + Number(ctx.raw).toLocaleString('en-IN')
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0,0,0,0.04)' },
                            border: { display: false },
                            ticks: {
                                font: { size: 11 },
                                color: '#9CA3AF',
                                callback: v => v >= 100000 ? '₹' + (v / 100000).toFixed(0) + 'L' : '₹' + v.toLocaleString('en-IN')
                            }
                        },
                        x: {
                            grid: { display: false },
                            border: { display: false },
                            ticks: { font: { size: 11 }, color: '#9CA3AF' }
                        }
                    },
                    animation: { duration: 800 }
                }
            });
        }

        // Flag success only after both canvases confirmed
        if (ctx1 || ctx2) _chartsInited = true;

        // Cache for reports page
        if (!_invoices.length) _invoices = iList;
        if (!_customers.length) _customers = cList;

    } catch (err) {
        console.error('Dashboard error:', err);
        // Draw charts with demo data anyway so the UI doesn't look broken
        _buildDemoCharts();
    }
}

// Fallback: render charts with pure demo data (no API needed)
function _buildDemoCharts() {
    destroyChart('revenueChart');
    destroyChart('invoiceStatusChart');
    const ctx1 = $id('revenueChart');
    if (ctx1) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const curMonth = new Date().getMonth();
        _revChart = new Chart(ctx1, { type: 'bar', data: { labels: months, datasets: [{ label: 'Revenue (₹)', data: [110000, 145000, 92000, 188000, 152000, 220000, 195000, 178000, 240000, 198000, 267000, 310000], backgroundColor: months.map((_, i) => i === curMonth ? '#F59E0B' : 'rgba(245,158,11,0.35)'), borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { callback: v => '₹' + (v / 100000).toFixed(0) + 'L', color: '#9CA3AF' } }, x: { grid: { display: false }, border: { display: false }, ticks: { color: '#9CA3AF' } } }, animation: { duration: 600 } } });
    }
    const ctx2 = $id('invoiceStatusChart');
    if (ctx2) {
        _donutChart = new Chart(ctx2, { type: 'doughnut', data: { labels: ['Paid', 'Pending', 'Overdue'], datasets: [{ data: [4, 6, 2], backgroundColor: ['#10B981', '#F59E0B', '#EF4444'], borderWidth: 2, borderColor: '#fff' }] }, options: { cutout: '70%', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, animation: { duration: 600 } } });
        setText('donutTotal', '12'); setText('dlPaid', '33%'); setText('dlPending', '50%'); setText('dlOverdue', '17%');
    }
}

// ═══════════════════════════════════════════════════════════════════
// INVOICE VIEW
// ═══════════════════════════════════════════════════════════════════
async function viewInvoice(id) {
    navigatePage('view-invoice');
    try {
        const inv = await api('GET', `/api/invoices/${id}`);
        const cName = inv.customer?.name || inv.customer || '—';
        setText('viewInvTitle', `Invoice ${inv.id}`);
        setText('viewInvDocNum', `#${inv.id}`);
        setText('viewInvIssuedDate', fmtDate(inv.createdAt));
        setText('viewInvDueDate', inv.dueDate ? fmtDate(inv.dueDate) : 'Net 30');
        setText('viewInvBillName', cName);
        setText('viewInvBillAddr', inv.customer?.address || inv.customer?.billing_address?.street || '—');
        setText('viewInvShipName', cName);
        setText('viewInvShipAddr', inv.customer?.site_address || inv.customer?.address || '—');
        setText('viewInvSubtotal', fmt(inv.subtotal || inv.total));
        setText('viewInvTax', fmt(inv.gst || 0));
        setText('viewInvDue', fmt(inv.total));
        const stEl = $id('viewInvStatus');
        if (stEl) { stEl.textContent = inv.status || 'Pending'; stEl.className = `tag t-${(inv.status || 'pending').toLowerCase()}`; }
        const items = inv.items || [];
        $id('viewInvItems').innerHTML = items.length ? items.map(it => `<div class="inv-item">
      <div><div class="inv-item-desc">${it.name || it.description || 'Item'}</div><div class="inv-item-sub">${it.description || ''}</div></div>
      <div class="inv-item-v">${it.qty || 1}</div>
      <div class="inv-item-v">${fmt(it.price)}</div>
      <div class="inv-item-v">${it.gst_rate || 0}%</div>
      <div class="inv-item-t">${fmt(it.total || (it.qty || 1) * (it.price || 0))}</div>
    </div>`).join('') : '<div class="inv-item"><div>No line items</div></div>';
        // Payment history
        const payments = inv.payments || [];
        $id('viewPayHistory').innerHTML = payments.length ? payments.map(p => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--g100)">
      <div><div style="font-size:13px;font-weight:600">${p.method || 'Payment'}</div><div style="font-size:11px;color:var(--g400)">${fmtDate(p.date)} · Ref: ${p.reference || '—'}</div></div>
      <div style="font-weight:700;color:var(--green)">${fmt(p.amount)}</div>
    </div>`).join('') : '<div class="inv-ph-empty">No payments recorded yet</div>';
        $id('viewInvPayBtn').onclick = () => {
            setVal('payInvoiceId', inv.id);
            setVal('payAmount', inv.total - (inv.paid || 0));
            setVal('payDate', new Date().toISOString().split('T')[0]);
            showModal('recordPaymentModal');
        };
    } catch { toast('Failed to load invoice', 'error'); }
}
window.viewInvoice = viewInvoice;

// ═══════════════════════════════════════════════════════════════════
// QUOTATION VIEW
// ═══════════════════════════════════════════════════════════════════
async function viewQuotation(id) {
    navigatePage('view-quotation');
    try {
        const q = await api('GET', `/api/quotations/${id}`);
        const cName = q.customer?.name || q.customer || '—';
        // Get org settings
        const org = JSON.parse(localStorage.getItem('sf_org') || '{"name":"TheVoltaura Private ltd","gst":"33AAAAA0000A1Z5"}');
        setText('viewQtTitle', `Quotation ${q.id}`);
        setText('viewQtDocNum', `#${q.id}`);
        setText('viewQtDate', fmtDate(q.quotationDate || q.createdAt));
        setText('viewQtValidUntil', fmtDate(new Date(Date.now() + 30 * 86400000).toISOString()));
        setText('viewQtBillName', cName);
        setText('viewQtBillAddr', q.customer?.address || q.billingAddress || '—');
        setText('viewQtSiteAddr', q.siteAddress || q.customer?.address || '—');
        setText('viewQtSubtotal', fmt(q.subtotal || 0));
        setText('viewQtDiscount', fmt(q.discount || 0));
        setText('viewQtGst', fmt(q.gst || 0));
        setText('viewQtTotal', fmt(q.total || 0));
        const stEl = $id('viewQtStatus');
        if (stEl) { stEl.textContent = q.status || 'Draft'; stEl.className = `tag t-${(q.status || 'draft').toLowerCase()}`; }
        // Company info in header
        const coName = $id('viewQtCoName'); if (coName) coName.textContent = org.name || 'TheVoltaura Private ltd';
        const coGst = $id('viewQtCoGst'); if (coGst) coGst.textContent = 'GST: ' + (org.gst || '');
        // Line items
        const items = q.items || [];
        const itemsEl = $id('viewQtItems');
        if (itemsEl) {
            itemsEl.innerHTML = items.length ? items.map((it, i) => `<div class="inv-item">
              <div><div class="inv-item-desc">${i + 1}. ${it.name || it.description || 'Item'}</div></div>
              <div class="inv-item-v">${it.qty || 1}</div>
              <div class="inv-item-v">${fmt(it.price)}</div>
              <div class="inv-item-v">${it.gst_rate || 0}%</div>
              <div class="inv-item-t">${fmt(it.total || (it.qty || 1) * (it.price || 0))}</div>
            </div>`).join('') : '<div class="inv-item"><div>No line items</div></div>';
        }
        const notesEl = $id('viewQtNotes');
        if (notesEl) notesEl.textContent = q.notes || '';
        // Convert button
        const convBtn = $id('viewQtConvertBtn');
        if (convBtn) {
            convBtn.disabled = q.status === 'Converted';
            convBtn.style.opacity = q.status === 'Converted' ? '0.4' : '1';
            convBtn.onclick = async () => {
                if (!confirm('Convert this quotation to an invoice?')) return;
                try {
                    const inv = await api('POST', `/api/quotations/${q.id}/convert`, {});
                    toast('Converted to Invoice! ID: ' + inv.id);
                    navigatePage('invoices');
                } catch (err) { toast('Conversion failed: ' + err.message, 'error'); }
            };
        }
        refreshIcons();
    } catch (err) { toast('Failed to load quotation: ' + err.message, 'error'); }
}
window.viewQuotation = viewQuotation;

// ═══════════════════════════════════════════════════════════════════
// LINE ITEMS
// ═══════════════════════════════════════════════════════════════════
function createLineItemRow(prefix) {
    const opts = _products.map(p => `<option value="${p.id}" data-price="${p.price || 0}" data-gst="${p.gst_rate || 18}">${p.name}</option>`).join('');
    const tr = document.createElement('tr');
    tr.innerHTML = `
    <td><select class="fi li-prod" style="min-width:180px"><option value="">Select product...</option>${opts}</select></td>
    <td style="text-align:center"><input type="number" class="fi li-qty" value="1" min="1" style="width:60px;text-align:center;padding:8px 6px"></td>
    <td><div class="fi-pre"><span class="fi-pre-lbl">₹</span><input type="number" class="fi li-price" value="0" min="0" style="padding-left:20px"></div></td>
    <td><select class="fi li-gst"><option value="5">5%</option><option value="12">12%</option><option value="18" selected>18%</option><option value="28">28%</option></select></td>
    <td style="text-align:right;font-weight:600" class="li-sub">₹0.00</td>
    <td><button type="button" class="act-link danger li-rm" title="Remove">✕</button></td>`;
    tr.querySelector('.li-prod').addEventListener('change', e => {
        const opt = e.target.selectedOptions[0];
        tr.querySelector('.li-price').value = opt.dataset.price || 0;
        tr.querySelector('.li-gst').value = opt.dataset.gst || 18;
        calcLineTotals(prefix);
    });
    tr.querySelector('.li-rm').addEventListener('click', () => { tr.remove(); calcLineTotals(prefix); });
    tr.querySelectorAll('.li-qty,.li-price,.li-gst').forEach(el => el.addEventListener('input', () => calcLineTotals(prefix)));
    return tr;
}

function calcLineTotals(prefix) {
    let sub = 0, gst = 0;
    document.querySelectorAll(`#${prefix}ItemsBody tr`).forEach(row => {
        const qty = Number(row.querySelector('.li-qty')?.value) || 0;
        const price = Number(row.querySelector('.li-price')?.value) || 0;
        const rate = Number(row.querySelector('.li-gst')?.value) || 0;
        const rowSub = qty * price;
        sub += rowSub; gst += rowSub * rate / 100;
        const s = row.querySelector('.li-sub'); if (s) s.textContent = fmt(rowSub);
    });
    if (prefix === 'invoice') updateInvTotals(sub, gst);
    if (prefix === 'quotation') updateQtTotals(sub, gst);
    return { sub, gst };
}

function updateInvTotals(sub, gst) {
    const intra = $id('invoiceSupplyType')?.value !== 'inter';
    $id('invCgstRow').style.display = intra ? '' : 'none';
    $id('invSgstRow').style.display = intra ? '' : 'none';
    $id('invIgstRow').style.display = intra ? 'none' : '';
    if (intra) { setText('invCgst', fmt(gst / 2)); setText('invSgst', fmt(gst / 2)); }
    else setText('invIgst', fmt(gst));
    setText('invSubtotal', fmt(sub));
    setText('invTotal', fmt(sub + gst));
}

function updateQtTotals(sub, gst) {
    const disc = Number($id('qtDiscount')?.value) || 0;
    const total = Math.max(0, sub + gst - disc);
    setText('qtSubtotal', fmt(sub));
    setText('qtGst', fmt(gst));
    setText('qtTotal', fmt(total));
    setText('qtGstNote', `Incl. GST ₹${(gst).toFixed(0)}`);
}

async function initCreateInvoice(prefillData) {
    const today = new Date().toISOString().split('T')[0];
    setVal('invoiceDate', today);
    const d30 = new Date(); d30.setDate(d30.getDate() + 30);
    setVal('invoiceDueDate', d30.toISOString().split('T')[0]);
    if (!_products.length) await loadProducts();
    if (!_customers.length) await loadCustomers();
    const tb = $id('invoiceItemsBody'); tb.innerHTML = '';
    // Pre-fill from quotation conversion if data provided
    if (prefillData && prefillData.items && prefillData.items.length) {
        prefillData.items.forEach(item => {
            const row = createLineItemRow('invoice');
            const prodSel = row.querySelector('.li-prod');
            const qtyIn = row.querySelector('.li-qty');
            const priceIn = row.querySelector('.li-price');
            const gstSel = row.querySelector('.li-gst');
            if (item.productId) prodSel.value = item.productId;
            qtyIn.value = item.qty || 1;
            priceIn.value = item.price || 0;
            gstSel.value = item.gst_rate || 18;
            tb.appendChild(row);
        });
        calcLineTotals('invoice');
    } else {
        tb.appendChild(createLineItemRow('invoice'));
    }
    if (prefillData?.customerId) setVal('invoiceCustomerSelect', prefillData.customerId);
    $id('addInvoiceRow').onclick = () => tb.appendChild(createLineItemRow('invoice'));
    $id('invoiceSupplyType').onchange = () => calcLineTotals('invoice');
    const doSave = async () => {
        const customerId = $id('invoiceCustomerSelect').value;
        if (!customerId) { toast('Select a customer', 'error'); return; }
        const items = [];
        document.querySelectorAll('#invoiceItemsBody tr').forEach(row => {
            const pid = row.querySelector('.li-prod')?.value;
            const qty = Number(row.querySelector('.li-qty')?.value) || 0;
            const price = Number(row.querySelector('.li-price')?.value) || 0;
            const gst_rate = Number(row.querySelector('.li-gst')?.value) || 0;
            if (qty && price) items.push({ productId: pid, name: _products.find(p => p.id === pid)?.name || 'Item', qty, price, gst_rate, total: qty * price * (1 + gst_rate / 100) });
        });
        if (!items.length) { toast('Add at least one line item', 'error'); return; }
        const sub = items.reduce((s, i) => s + i.qty * i.price, 0);
        const g = items.reduce((s, i) => s + i.qty * i.price * i.gst_rate / 100, 0);
        const customer = _customers.find(c => c.id === customerId);
        const dueDate = $id('invoiceDueDate')?.value || '';
        try {
            const inv = await api('POST', '/api/invoices', {
                customer: { id: customerId, name: customer?.name, address: customer?.address, gstin: customer?.gstin },
                items, subtotal: sub, gst: g, total: sub + g,
                status: 'Pending',
                supply_type: $id('invoiceSupplyType').value,
                invoiceDate: $id('invoiceDate')?.value,
                dueDate
            });
            toast('Invoice created! ID: ' + inv.id); navigatePage('invoices');
        } catch (err) { toast('Failed to create invoice: ' + err.message, 'error'); }
    };
    $id('saveInvoiceBtn').onclick = doSave;
    $id('saveInvoiceBtn2').onclick = doSave;
}

async function initCreateQuotation() {
    const today = new Date().toISOString().split('T')[0];
    setVal('quotationDate', today);
    setText('qtRefNum', `${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`);
    if (!_products.length) await loadProducts();
    if (!_customers.length) await loadCustomers();
    const tb = $id('quotationItemsBody'); tb.innerHTML = '';
    tb.appendChild(createLineItemRow('quotation'));
    $id('addQuotationRow').onclick = () => tb.appendChild(createLineItemRow('quotation'));
    $id('qtDiscount').oninput = () => calcLineTotals('quotation');
    const doSave = async (status, convert = false) => {
        const customerId = $id('quotationCustomerSelect').value;
        if (!customerId) { toast('Please select a customer', 'error'); return; }
        const customer = _customers.find(c => String(c.id) === String(customerId)) || {};
        const items = [];
        document.querySelectorAll('#quotationItemsBody tr').forEach(row => {
            const pid = row.querySelector('.li-prod')?.value;
            const qty = Number(row.querySelector('.li-qty')?.value) || 0;
            const price = Number(row.querySelector('.li-price')?.value) || 0;
            const gst_rate = Number(row.querySelector('.li-gst')?.value) || 0;
            if (qty && price) items.push({ productId: pid, name: _products.find(p => String(p.id) === pid)?.name || 'Item', qty, price, gst_rate, total: qty * price * (1 + gst_rate / 100) });
        });
        if (!items.length) { toast('Add at least one line item', 'error'); return; }
        const sub = items.reduce((s, i) => s + i.qty * i.price, 0);
        const g = items.reduce((s, i) => s + i.qty * i.price * i.gst_rate / 100, 0);
        const disc = Number($id('qtDiscount').value) || 0;
        const totalAmt = Math.max(0, sub + g - disc);
        try {
            const q = await api('POST', '/api/quotations', {
                customer: { id: customerId, name: customer.name, address: customer.address, gstin: customer.gstin },
                items,
                subtotal: sub,
                gst: g,
                discount: disc,
                total: totalAmt,
                status: status,
                notes: $id('qtNotes').value,
                quotationDate: $id('quotationDate')?.value,
                billingAddress: $id('qtBillingAddr')?.value,
                siteAddress: $id('qtSiteAddr')?.value
            });
            toast('Quotation saved! ID: ' + q.id);
            if (convert) {
                try {
                    const inv = await api('POST', `/api/quotations/${q.id}/convert`, {});
                    toast('Converted to Invoice! ID: ' + inv.id);
                    navigatePage('invoices');
                } catch (convErr) { toast('Conversion failed: ' + convErr.message, 'error'); }
            } else { navigatePage('quotations'); }
        } catch (err) { toast('Failed to save quotation: ' + err.message, 'error'); }
    };
    $id('createQuotationBtn').onclick = () => doSave('Quoted', false);
    $id('saveQuotationBtn').onclick = () => doSave('Quoted', true);
    $id('saveQuotationDraftBtn').onclick = () => doSave('Draft', false);
}

// ═══════════════════════════════════════════════════════════════════
// GLOBAL ACTION DELEGATION
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('click', async e => {
    // 1. Check for Action Buttons/Links (Existing logic)
    const btn = e.target.closest('[data-action][data-entity]');
    if (btn) {
        const { action, entity, id } = btn.dataset;
        e.preventDefault(); e.stopPropagation(); // Stop row click from triggering

        if (action === 'view' && entity === 'invoices') { viewInvoice(id); return; }
        if (action === 'view' && entity === 'quotations') { viewQuotation(id); return; }

        if (action === 'edit' && entity === 'products') {
            const p = await api('GET', `/api/products/${id}`).catch(() => null);
            if (p) openProductModal(id, p); return;
        }
        if (action === 'edit' && entity === 'customers') {
            const c = await api('GET', `/api/customers/${id}`).catch(() => null);
            if (c) openCustomerModal(id, c); return;
        }
        if (action === 'edit' && entity === 'amc') {
            const a = _amc.find(x => x.id === id);
            if (a) openAmcModal(id, a); return;
        }
        if (action === 'convert' && entity === 'quotations') {
            if (!confirm('Convert this quotation to an invoice?')) return;
            try { await api('POST', `/api/quotations/${id}/convert`, {}); toast('Converted!'); loadQuotations(); }
            catch { toast('Conversion failed', 'error'); }
            return;
        }
        if (action === 'delete') {
            if (!confirm(`Delete this ${entity.slice(0, -1)}?`)) return;
            try {
                await api('DELETE', `/api/${entity}/${id}`, null);
                toast('Deleted');
                if (entity === 'customers') loadCustomers();
                if (entity === 'products') loadProducts();
                if (entity === 'invoices') loadInvoices();
                if (entity === 'payments') loadPayments();
                if (entity === 'quotations') loadQuotations();
                if (entity === 'amc') loadAmc();
            } catch { toast('Delete failed', 'error'); }
        }
        return;
    }

    // 2. Check for Table Row Clicks (New Row Click Behavior)
    const row = e.target.closest('tr[data-id][data-type]');
    // Ignore if clicking a button, link, or input within the row
    if (row && !e.target.closest('button, a, input, select, .no-row-click')) {
        const { id, type } = row.dataset;
        if (type === 'invoices') viewInvoice(id);
        else if (type === 'quotations') viewQuotation(id);
        else if (type === 'customers') {
            const c = await api('GET', `/api/customers/${id}`).catch(() => null);
            if (c) openCustomerModal(id, c);
        }
        else if (type === 'products') {
            const p = await api('GET', `/api/products/${id}`).catch(() => null);
            if (p) openProductModal(id, p);
        }
        else if (type === 'amc') {
            const a = _amc.find(x => x.id === id);
            if (a) selectAmcContract(a);
        }
        else if (type === 'payments') {
            // No specific view for payments yet, maybe show a toast or ignore
            toast(`Payment #${id} selected`, 'info');
        }
    }
});



// Helper to determine page from URL pathname
function pageFromPath(pathname) {
    const seg = (pathname || '/').replace(/^\//, '').split('/')[0].toLowerCase().replace('.html', '');
    const valid = ['dashboard', 'customers', 'quotations', 'invoices', 'payments', 'products', 'amc', 'reports', 'settings'];
    return valid.includes(seg) ? seg : 'dashboard';
}

window.addEventListener('DOMContentLoaded', () => {
    // Auto demo token
    if (!localStorage.getItem('sf_token')) localStorage.setItem('sf_token', 'demo-token-12345');
    initUser();
    const today = new Date().toISOString().split('T')[0];
    [$id('invoiceDate'), $id('payDate')].forEach(el => { if (el) el.value = today; });

    // Init Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Determine starting page from URL
    const startPage = pageFromPath(window.location.pathname);
    navigatePage(startPage, false); // false = don't pushState on initial load

    // Replace initial history state so popstate works
    history.replaceState({ page: startPage }, '', window.location.pathname);

    // Apply saved preferences
    applyFontSize(localStorage.getItem('sf_fontSize') || 'md');
    applyLang(localStorage.getItem('sf_lang') || 'en');

    // WebSocket realtime
    try {
        const ws = new WebSocket(`ws://localhost:5001?token=${getToken()}`);
        ws.onmessage = ev => {
            try {
                const m = JSON.parse(ev.data);
                if (m.type?.includes('invoice') && _curPage === 'invoices') loadInvoices();
                if (m.type?.includes('customer') && _curPage === 'customers') loadCustomers();
                if (m.type?.includes('payment') && _curPage === 'payments') loadPayments();
                if (m.type?.includes('quotation') && _curPage === 'quotations') loadQuotations();
            } catch { }
        };
    } catch { }

    initSidebar();
    initNotifications();
    initSettingsDrawer();
    initHeaderDropdowns();
    initSupportModal();
    initKeyboardShortcuts();
});

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR TOGGLE (mobile)
// ═══════════════════════════════════════════════════════════════════
function initSidebar() {
    const toggle = $id('sidebarToggle');
    const sidebar = $id('sidebar');
    const overlay = $id('sbOverlay');
    if (!toggle || !sidebar) return;
    const open = () => { sidebar.classList.add('open'); overlay?.classList.add('active'); };
    const close = () => { sidebar.classList.remove('open'); overlay?.classList.remove('active'); };
    toggle.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
    overlay?.addEventListener('click', close);
    // Close on nav item click (mobile)
    sidebar.querySelectorAll('.nav-it[data-page]').forEach(btn => btn.addEventListener('click', () => {
        if (window.innerWidth < 768) close();
    }));
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════
let _notifications = [];

async function initNotifications() {
    const btn = $id('notifBtn');
    const panel = $id('notifPanel');
    if (!btn || !panel) return;

    // Build smart notifications from live data
    await buildNotifications();

    btn.addEventListener('click', e => {
        e.stopPropagation();
        panel.classList.toggle('open');
    });
    document.addEventListener('click', e => {
        if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open');
    });
    $id('clearNotifBtn')?.addEventListener('click', () => {
        _notifications = [];
        renderNotifications();
        panel.classList.remove('open');
    });
}

async function buildNotifications() {
    _notifications = [];
    try {
        const [invData, prodData, amcData] = await Promise.allSettled([
            api('GET', '/api/invoices'), api('GET', '/api/products'), api('GET', '/api/amc')
        ]);
        const invs = invData.value ? (Array.isArray(invData.value) ? invData.value : invData.value.value || []) : [];
        const prods = prodData.value ? (Array.isArray(prodData.value) ? prodData.value : prodData.value.value || []) : [];
        const amcs = amcData.value ? (Array.isArray(amcData.value) ? amcData.value : amcData.value.value || []) : [];

        // Overdue invoices
        const overdue = invs.filter(i => i.status === 'Overdue');
        if (overdue.length) _notifications.push({ type: 'error', icon: 'alert-circle', title: `${overdue.length} Overdue Invoice${overdue.length > 1 ? 's' : ''}`, desc: `Total ₹${overdue.reduce((s, i) => s + (i.total || 0), 0).toLocaleString('en-IN')} pending`, time: 'Now' });

        // Low stock
        const low = prods.filter(p => (p.stock || 0) < 10);
        if (low.length) _notifications.push({ type: 'warning', icon: 'alert-triangle', title: `${low.length} Low Stock Item${low.length > 1 ? 's' : ''}`, desc: low.slice(0, 2).map(p => p.name).join(', '), time: 'Today' });

        // AMC expiring in 30 days
        const soon = new Date(); soon.setDate(soon.getDate() + 30);
        const expiring = amcs.filter(a => a.status === 'Active' && a.expiry && new Date(a.expiry) <= soon);
        if (expiring.length) _notifications.push({ type: 'warning', icon: 'clock', title: `${expiring.length} AMC Contract${expiring.length > 1 ? 's' : ''} Expiring`, desc: 'Within 30 days — action needed', time: 'This week' });

        // Default if nothing
        if (!_notifications.length) _notifications.push({ type: 'info', icon: 'check-circle', title: 'All caught up!', desc: 'No pending alerts at the moment.', time: 'Now' });
    } catch {
        _notifications.push({ type: 'info', icon: 'info', title: 'Notifications unavailable', desc: 'Could not load live data.', time: '' });
    }
    renderNotifications();
}

function renderNotifications() {
    const list = $id('notifList');
    const dot = $id('notifDot');
    if (!list) return;
    const unread = _notifications.filter(n => n.type !== 'info' || n.title !== 'All caught up!').length;
    if (dot) { dot.style.display = unread ? '' : 'none'; }

    if (!_notifications.length) {
        list.innerHTML = '<div class="notif-empty"><i data-lucide="bell-off" style="width:32px;height:32px;color:var(--g300)"></i><p>No notifications</p></div>';
    } else {
        list.innerHTML = _notifications.map((n, i) => `
      <div class="notif-item notif-${n.type}">
        <div class="notif-icon-wrap"><i data-lucide="${n.icon}" style="width:16px;height:16px"></i></div>
        <div class="notif-content"><div class="notif-item-title">${n.title}</div><div class="notif-item-desc">${n.desc}</div></div>
        <div class="notif-time">${n.time}</div>
      </div>`).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS DRAWER
// ═══════════════════════════════════════════════════════════════════
function initSettingsDrawer() {
    const btn = $id('settingsBtn');
    const drawer = $id('settingsDrawer');
    const overlay = $id('sdOverlay');
    const closeBtn = $id('settingsClose');
    if (!btn || !drawer) return;

    const openDrawer = () => { drawer.classList.add('open'); overlay?.classList.add('active'); if (typeof lucide !== 'undefined') lucide.createIcons(); };
    const closeDrawer = () => { drawer.classList.remove('open'); overlay?.classList.remove('active'); };

    btn.addEventListener('click', openDrawer);
    closeBtn?.addEventListener('click', closeDrawer);
    overlay?.addEventListener('click', closeDrawer);

    // Also wire Settings nav item
    document.querySelector('.nav-it[data-page="settings"]')?.addEventListener('click', e => {
        e.stopPropagation();
        // Remove data-page so it doesn't navigate
        openDrawer();
    });

    // Font size buttons
    document.querySelectorAll('.fs-btn').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('.fs-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            applyFontSize(b.dataset.fs);
        });
    });

    // Language select
    const langSel = $id('langSelect');
    if (langSel) {
        langSel.value = localStorage.getItem('sf_lang') || 'en';
        langSel.addEventListener('change', () => applyLang(langSel.value));
    }

    // Load saved font size
    const saved = localStorage.getItem('sf_fontSize') || 'md';
    document.querySelectorAll('.fs-btn').forEach(b => b.classList.toggle('active', b.dataset.fs === saved));
}

function applyFontSize(size) {
    const map = { sm: '0.9', md: '1', lg: '1.1', xl: '1.2' };
    document.body.style.zoom = map[size] || '1';
    document.documentElement.setAttribute('data-font-size', size);
    localStorage.setItem('sf_fontSize', size);
    // Sync active state on font buttons
    document.querySelectorAll('.fs-btn[data-fs]').forEach(b => b.classList.toggle('active', b.dataset.fs === size));
}

// Language strings (key UI labels)
const LANG = {
    en: { dashboard: 'Dashboard', customers: 'Customers', invoices: 'Invoices', quotations: 'Quotations', payments: 'Payments', products: 'Products', amc: 'AMC Contracts', reports: 'Reports', settings: 'Settings', logout: 'Log Out', support: 'Help & Support' },
    ta: { dashboard: 'டாஷ்போர்டு', customers: 'வாடிக்கையாளர்கள்', invoices: 'விலைப்பட்டியல்', quotations: 'மேற்கோள்', payments: 'கட்டணங்கள்', products: 'பொருட்கள்', amc: 'AMC ஒப்பந்தங்கள்', reports: 'அறிக்கைகள்', settings: 'அமைப்புகள்', logout: 'வெளியேறு', support: 'உதவி' },
    hi: { dashboard: 'डैशबोर्ड', customers: 'ग्राहक', invoices: 'बीजक', quotations: 'उद्धरण', payments: 'भुगतान', products: 'उत्पाद', amc: 'AMC अनुबंध', reports: 'रिपोर्ट', settings: 'सेटिंग्स', logout: 'लॉग आउट', support: 'सहायता' }
};

function applyLang(lang) {
    localStorage.setItem('sf_lang', lang);
    document.documentElement.setAttribute('data-lang', lang);
    const L = LANG[lang] || LANG.en;
    const map = { dashboard: 'Dashboard', customers: 'Customers', quotations: 'Quotations', invoices: 'Invoices', payments: 'Payments', products: 'Products', amc: 'AMC Contracts', reports: 'Reports', settings: 'Settings' };
    document.querySelectorAll('.nav-it[data-page]').forEach(btn => {
        const page = btn.dataset.page;
        if (L[page]) {
            // Update text node (last text child)
            const textNodes = Array.from(btn.childNodes).filter(n => n.nodeType === 3);
            if (textNodes.length) textNodes[textNodes.length - 1].textContent = L[page];
        }
    });
    const logoutBtn = $id('logoutBtn');
    if (logoutBtn) { const t = Array.from(logoutBtn.childNodes).filter(n => n.nodeType === 3); if (t.length) t[t.length - 1].textContent = L.logout; }
    const suppBtn = $id('supportBtn');
    if (suppBtn) { const t = Array.from(suppBtn.childNodes).filter(n => n.nodeType === 3); if (t.length) t[t.length - 1].textContent = L.support; }
    // Sync language dropdown button label
    const langMap = { en: 'English ▼', ta: 'Tamil ▼', hi: 'Hindi ▼' };
    const langBtn = $id('langDropBtn');
    if (langBtn) langBtn.textContent = langMap[lang] || 'English ▼';
    // Sync language dropdown active state
    document.querySelectorAll('.fs-btn[data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
}

// ═══════════════════════════════════════════════════════════════════
// HEADER DROPDOWNS (Font Size & Language)
// ═══════════════════════════════════════════════════════════════════
function initHeaderDropdowns() {
    const fontBtn = $id('fontSizeBtn');
    const fontPanel = $id('fontPanel');
    const langBtn = $id('langDropBtn');
    const langPanel = $id('langPanel');

    if (fontBtn && fontPanel) {
        fontBtn.addEventListener('click', e => {
            e.stopPropagation();
            fontPanel.classList.toggle('open');
            langPanel?.classList.remove('open');
            $id('notifPanel')?.classList.remove('open');
        });
    }

    if (langBtn && langPanel) {
        langBtn.addEventListener('click', e => {
            e.stopPropagation();
            langPanel.classList.toggle('open');
            fontPanel?.classList.remove('open');
            $id('notifPanel')?.classList.remove('open');
        });
    }

    // Close all header dropdowns on outside click
    document.addEventListener('click', () => {
        fontPanel?.classList.remove('open');
        langPanel?.classList.remove('open');
    });

    // Apply saved preferences on load
    const savedLang = localStorage.getItem('sf_lang') || 'en';
    const langMap = { en: 'English ▼', ta: 'Tamil ▼', hi: 'Hindi ▼' };
    if (langBtn) langBtn.textContent = langMap[savedLang] || 'English ▼';
    document.querySelectorAll('.fs-btn[data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang === savedLang));
}

window.saveSettings = function () {
    // Save company info
    const org = { name: $id('sdOrgName')?.value, gst: $id('sdOrgGst')?.value, email: $id('sdOrgEmail')?.value, phone: $id('sdOrgPhone')?.value };
    localStorage.setItem('sf_org', JSON.stringify(org));
    // Save notification prefs
    localStorage.setItem('sf_notifLowStock', $id('notifLowStock')?.checked ? '1' : '0');
    localStorage.setItem('sf_notifOverdue', $id('notifOverdue')?.checked ? '1' : '0');
    localStorage.setItem('sf_notifAmc', $id('notifAmc')?.checked ? '1' : '0');
    // Close drawer
    $id('settingsDrawer')?.classList.remove('open');
    $id('sdOverlay')?.classList.remove('active');
    toast('Settings saved!', 'success');
};

// ═══════════════════════════════════════════════════════════════════
// SUPPORT MODAL
// ═══════════════════════════════════════════════════════════════════
function initSupportModal() {
    $id('supportBtn')?.addEventListener('click', () => {
        showModal('supportModal');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    // Tab switching
    document.querySelectorAll('.supp-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.supp-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const which = tab.dataset.tab;
            $id('suppFaq').style.display = which === 'faq' ? '' : 'none';
            $id('suppContact').style.display = which === 'contact' ? '' : 'none';
            $id('suppShortcuts').style.display = which === 'shortcuts' ? '' : 'none';
        });
    });
}

// ═══════════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════════
function initKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        // Ctrl+K → focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            $id('globalSearch')?.focus();
        }
        // Esc → close any open modal/panel/drawer
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
            $id('modalOverlay')?.classList.remove('active');
            $id('notifPanel')?.classList.remove('open');
            $id('settingsDrawer')?.classList.remove('open');
            $id('sdOverlay')?.classList.remove('active');
        }
        // Alt+I → new invoice
        if (e.altKey && e.key.toLowerCase() === 'i') { e.preventDefault(); navigatePage('create-invoice'); }
        // Alt+Q → new quotation
        if (e.altKey && e.key.toLowerCase() === 'q') { e.preventDefault(); navigatePage('create-quotation'); }
        // Alt+D → dashboard
        if (e.altKey && e.key.toLowerCase() === 'd') { e.preventDefault(); navigatePage('dashboard'); }
        // Alt+C → customers
        if (e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); navigatePage('customers'); }
    });
}

// ═══════════════════════════════════════════════════════════════════
// CSV EXPORT
// ═══════════════════════════════════════════════════════════════════
window.exportCSV = function (entity) {
    let rows = [], headers = [];
    if (entity === 'customers') {
        headers = ['Name', 'Email', 'Phone', 'GSTIN', 'City', 'Status', 'Balance'];
        rows = _customers.map(c => [c.name, c.email, c.phone, c.gstin || c.gst, c.city, c.status || 'Active', c.balance || 0]);
    } else if (entity === 'invoices') {
        headers = ['Invoice ID', 'Customer', 'Date', 'Total', 'Status'];
        rows = _invoices.map(i => [i.id, i.customer?.name || i.customer, i.createdAt?.split('T')[0], i.total, i.status]);
    } else if (entity === 'quotations') {
        headers = ['Quote ID', 'Customer', 'Date', 'Total', 'Status'];
        rows = _quotations.map(q => [q.id, q.customer?.name || q.customer, q.createdAt?.split('T')[0], q.total, q.status]);
    }
    if (!rows.length) { toast('No data to export', 'info'); return; }
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `${entity}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast(`${entity} exported!`, 'success');
};

// ═══════════════════════════════════════════════════════════════════
// RE-INIT LUCIDE after any dynamic render (integrated into navigatePage)
// ═══════════════════════════════════════════════════════════════════
// Lucide icon refresh is handled via refreshIcons() in each render function.

