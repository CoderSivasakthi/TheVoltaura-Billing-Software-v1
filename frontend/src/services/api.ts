// ── API helpers — ported from script.js ──────────────────────────

export const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname || 'localhost'}:5001`;

export function getToken(): string | null {
    return localStorage.getItem('sf_token');
}

let activeReqs = 0;
function toggleLoader(show: boolean) {
    if (show) activeReqs++;
    else activeReqs = Math.max(0, activeReqs - 1);
    window.dispatchEvent(new CustomEvent('global-loader', { detail: activeReqs > 0 }));
}

export async function api(method: string, path: string, body?: unknown, silent: boolean = false): Promise<any> {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['x-demo-auth'] = token;
    const opts: RequestInit = { method, headers };
    if (body !== undefined && body !== null) opts.body = JSON.stringify(body);

    if (!silent) toggleLoader(true);
    try {
        const r = await fetch(`${API_BASE}${path}`, opts);
        if (!r.ok) throw new Error(`${r.status}`);
        return await r.json();
    } finally {
        if (!silent) toggleLoader(false);
    }
}

// ── Toast ─────────────────────────────────────────────────────────
export function toast(msg: string, type: string = 'success') {
    let el = document.getElementById('_toast');
    if (!el) {
        el = document.createElement('div');
        el.id = '_toast';
        el.className = 'toast';
        document.body.appendChild(el);
    }
    const cls: Record<string, string> = { success: 't-s', error: 't-e', info: 't-i', warning: 't-w' };
    el.textContent = (type === 'success' ? '✓ ' : type === 'error' ? '✕ ' : 'ℹ ') + msg;
    el.className = `toast ${cls[type] || 't-i'} show`;
    if ((el as any)._t) clearTimeout((el as any)._t);
    (el as any)._t = setTimeout(() => el!.classList.remove('show'), 3500);
}

// ── Formatters ────────────────────────────────────────────────────
export const fmt = (n: number | string | undefined | null): string =>
    '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtDate(d: string | undefined | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Status Tags ───────────────────────────────────────────────────
export function statusTag(s: string | undefined): string {
    if (!s) return '';
    const map: Record<string, string> = {
        Paid: 't-paid', Partial: 't-partial', Pending: 't-pending',
        Draft: 't-pending', Overdue: 't-overdue', Active: 't-active',
        'Expiring Soon': 't-expiring', Expired: 't-expired',
        Converted: 't-converted', Registered: 't-registered',
        Composition: 't-composition', Unregistered: 't-unregistered',
        Sent: 't-partial', Cancelled: 't-draft', Inactive: 't-draft',
        // Quotation lifecycle statuses
        Quoted: 't-quoted',
        Invoiced: 't-invoiced',
        'Documents Pending': 't-orange',
        Approved: 't-paid',
        Rejected: 't-overdue',
        'Converted to Invoice': 't-invoiced',
        
        // Advance Payment Workflow
        'Quotation Sent': 't-partial',
        'Advance Pending': 't-orange',
        'Advance Received': 't-partial',
        'Confirmed Order': 't-paid',
        'Invoice Generated': 't-invoiced',
        'Installation': 't-active',
        'Completed': 't-paid'
    };
    return `<span class="tag ${map[s] || 't-draft'}">${s || 'Draft'}</span>`;
}

// ── Avatar helpers ─────────────────────────────────────────────────
const AV_COLORS = ['avc-0', 'avc-1', 'avc-2', 'avc-3', 'avc-4', 'avc-5', 'avc-6', 'avc-7', 'avc-8', 'avc-9'];

export function avColor(name: string): string {
    const n = typeof name === 'object' ? ((name as any)?.name || '') : String(name || '');
    let h = 0;
    for (const c of n) h = (h * 31 + c.charCodeAt(0)) & 0xff;
    return AV_COLORS[h % AV_COLORS.length];
}

export function avInitials(name: string): string {
    const n = typeof name === 'object' ? ((name as any)?.name || '') : String(name || '');
    const p = n.trim().split(/\s+/);
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : p[0] ? p[0].slice(0, 2).toUpperCase() : '??';
}

export function avEl(name: string, cls: string = ''): string {
    return `<div class="av ${avColor(name)} ${cls}">${avInitials(name)}</div>`;
}

// ── Safe display name extractor ────────────────────────────────────
// API may return nested objects (e.g. customer: {id, name, ...})
// instead of plain strings. Safely extract a displayable string.
export function displayName(val: unknown): string {
    if (val == null) return '—';
    if (typeof val === 'string') return val || '—';
    if (typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        return String(obj.name || obj.customerName || obj.productName || obj.label || obj.id || '—');
    }
    return String(val);
}

// ── Number to Words (Indian Format) ───────────────────────────────
export function numberToWords(num: number): string {
    if (num === 0) return "Zero";
    const a = ["", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return "";

    let str = "";
    str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0] as any] + " " + a[n[1][1] as any]) + "Crore " : "";
    str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0] as any] + " " + a[n[2][1] as any]) + "Lakh " : "";
    str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0] as any] + " " + a[n[3][1] as any]) + "Thousand " : "";
    str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0] as any] + " " + a[n[4][1] as any]) + "Hundred " : "";
    
    // Add "And" before the final two digits if the number is greater than 100
    const hasHigherDigits = Number(n[1]) !== 0 || Number(n[2]) !== 0 || Number(n[3]) !== 0 || Number(n[4]) !== 0;
    
    if (Number(n[5]) !== 0) {
        if (hasHigherDigits) str += "And ";
        str += (a[Number(n[5])] || b[n[5][0] as any] + " " + a[n[5][1] as any]);
    }
    
    return str.trim() + " Only";
}
