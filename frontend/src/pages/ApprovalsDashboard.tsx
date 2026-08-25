import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    CheckSquare, CheckCircle, XCircle, RotateCcw,
    X, RefreshCw, Building2, FileText, Receipt,
    ChevronLeft, Eye
} from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface ApprovalItem {
    id: string
    type: 'quotation' | 'invoice'
    franchise_id: string
    franchise_name: string
    franchise_code: string
    customer_name: string
    project_size?: string
    grand_total: number
    submitted_at: string
    approval_status: string
}

interface PendingData {
    quotations: ApprovalItem[]
    invoices:   ApprovalItem[]
    total:      number
}

type ActionType = 'approve' | 'reject' | 'request-changes' | null

const fmt = (n: number) => {
    if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`
    if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)}L`
    return `₹${n.toLocaleString('en-IN')}`
}

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
    'Submitted':          { bg: 'rgba(234,179,8,0.12)',  color: '#ca8a04', label: 'Pending Review' },
    'Approved':           { bg: 'rgba(16,185,129,0.12)', color: '#065f46', label: 'Approved'       },
    'Rejected':           { bg: 'rgba(239,68,68,0.12)',  color: '#dc2626', label: 'Rejected'       },
    'Revision Requested': { bg: 'rgba(249,115,22,0.12)', color: '#c2410c', label: 'Revision Needed'},
}

export default function ApprovalsDashboard() {
    const navigate = useNavigate()
    const { isSuperAdmin } = useAuth()
    const [activeTab, setActiveTab] = useState<'quotations' | 'invoices'>('quotations')
    const [data, setData]           = useState<PendingData | null>(null)
    const [loading, setLoading]     = useState(true)
    const [action, setAction]       = useState<{ item: ApprovalItem; type: ActionType } | null>(null)
    const [comment, setComment]     = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [toast, setToast]         = useState('')

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(''), 3500)
    }

    const load = useCallback(async () => {
        if (!isSuperAdmin()) return
        setLoading(true)
        try {
            const d = await api('GET', '/api/approvals/pending', undefined, true)
            setData(d)
        } catch {} finally { setLoading(false) }
    }, [isSuperAdmin])

    useEffect(() => { load() }, [load])
    useEffect(() => {
        if (!isSuperAdmin()) return
        const iv = setInterval(load, 30000)
        return () => clearInterval(iv)
    }, [load, isSuperAdmin])

    if (!isSuperAdmin()) return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>Access denied. Super Admin only.</div>
    )

    const handleAction = async () => {
        if (!action) return
        if ((action.type === 'reject' || action.type === 'request-changes') && !comment.trim()) return
        setSubmitting(true)
        try {
            const entity = action.item.type === 'quotation' ? 'quotations' : 'invoices'
            const endpoint = `/api/${entity}/${encodeURIComponent(action.item.id)}/${action.type}`
            await api('POST', endpoint, {
                reason:  action.type === 'reject' ? comment : undefined,
                comment: action.type === 'request-changes' ? comment : undefined,
            }, true)
            showToast(`${action.item.type === 'quotation' ? 'Quotation' : 'Invoice'} ${action.item.id} — ${action.type === 'approve' ? 'Approved ✅' : action.type === 'reject' ? 'Rejected ❌' : 'Revision Requested 🔁'}`)
            setAction(null)
            setComment('')
            load()
        } catch (e: any) {
            showToast('Error: ' + (e.message || 'Action failed'))
        } finally { setSubmitting(false) }
    }

    const items = activeTab === 'quotations' ? (data?.quotations || []) : (data?.invoices || [])

    return (
        <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif" }}>
            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#1e293b', color: '#fff', borderRadius: '10px', padding: '12px 20px', fontSize: '13px', zIndex: 2000, boxShadow: '0 8px 30px rgba(0,0,0,0.3)', maxWidth: '380px' }}>
                    {toast}
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                        <ChevronLeft size={16} /> Dashboard
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <CheckSquare size={22} color="#6366f1" />
                            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>
                                Approvals
                                {(data?.total || 0) > 0 && (
                                    <span style={{ marginLeft: '10px', background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '12px', padding: '2px 8px', fontWeight: 600 }}>
                                        {data!.total}
                                    </span>
                                )}
                            </h1>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Review and action all franchise submissions</div>
                    </div>
                </div>
                <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary, #1e293b)' }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--bg, #f8fafc)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
                {(['quotations', 'invoices'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: '13px', transition: 'all 0.15s',
                            background: activeTab === tab ? 'var(--card, #fff)' : 'transparent',
                            color: activeTab === tab ? '#6366f1' : '#64748b',
                            boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                        }}
                    >
                        {tab === 'quotations' ? <FileText size={14} /> : <Receipt size={14} />}
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {tab === 'quotations' && (data?.quotations?.length || 0) > 0 && (
                            <span style={{ background: '#fde68a', color: '#92400e', borderRadius: '999px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>
                                {data!.quotations.length}
                            </span>
                        )}
                        {tab === 'invoices' && (data?.invoices?.length || 0) > 0 && (
                            <span style={{ background: '#fde68a', color: '#92400e', borderRadius: '999px', padding: '1px 6px', fontSize: '10px', fontWeight: 700 }}>
                                {data!.invoices.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Items Table */}
            <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
                ) : items.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                        <CheckCircle size={40} color="#d1fae5" />
                        <div style={{ marginTop: '16px', fontSize: '16px', fontWeight: 600, color: '#10b981' }}>All clear!</div>
                        <div style={{ marginTop: '4px', fontSize: '13px' }}>No pending {activeTab} at this time.</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg, #f8fafc)' }}>
                                {['Franchise', 'ID', 'Customer', 'Amount', 'Submitted', 'Status', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => {
                                const sc = STATUS_CONFIG[item.approval_status] || STATUS_CONFIG['Submitted']
                                return (
                                    <tr key={item.id} style={{ borderTop: '1px solid var(--border, #f1f5f9)' }}>
                                        <td style={{ padding: '12px 14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Building2 size={12} color="#6366f1" />
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary, #1e293b)', fontSize: '12px' }}>{item.franchise_name}</div>
                                                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{item.franchise_code}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6366f1', fontWeight: 600 }}>{item.id}</span>
                                        </td>
                                        <td style={{ padding: '12px 14px', color: '#1e293b', fontWeight: 500, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.customer_name || '—'}
                                        </td>
                                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#10b981' }}>
                                            {fmt(item.grand_total || 0)}
                                        </td>
                                        <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                            {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <span style={{ background: sc.bg, color: sc.color, borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600 }}>{sc.label}</span>
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    onClick={() => navigate(item.type === 'quotation' ? `/view-quotation/${encodeURIComponent(item.id)}` : `/view-invoice/${encodeURIComponent(item.id)}`)}
                                                    title={item.type === 'quotation' ? "View Quotation" : "View Invoice"}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: 'var(--bg, #f8fafc)', color: '#64748b', border: '1px solid var(--border, #e2e8f0)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                                                >
                                                    <Eye size={12} /> View
                                                </button>
                                                <button
                                                    onClick={() => setAction({ item, type: 'approve' })}
                                                    title="Approve"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid #6ee7b7', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                                                >
                                                    <CheckCircle size={12} /> Approve
                                                </button>
                                                <button
                                                    onClick={() => { setAction({ item, type: 'reject' }); setComment('') }}
                                                    title="Reject"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                                                >
                                                    <XCircle size={12} /> Reject
                                                </button>
                                                <button
                                                    onClick={() => { setAction({ item, type: 'request-changes' }); setComment('') }}
                                                    title="Request Changes"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: 'rgba(249,115,22,0.08)', color: '#ea580c', border: '1px solid #fdba74', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                                                >
                                                    <RotateCcw size={12} /> Revise
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Action Confirmation Modal */}
            {action && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: 'var(--card, #fff)', borderRadius: '14px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary, #1e293b)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {action.type === 'approve' && <CheckCircle size={18} color="#10b981" />}
                                {action.type === 'reject'  && <XCircle size={18} color="#ef4444" />}
                                {action.type === 'request-changes' && <RotateCcw size={18} color="#ea580c" />}
                                {action.type === 'approve' ? 'Approve' : action.type === 'reject' ? 'Reject' : 'Request Changes'}
                            </div>
                            <button onClick={() => setAction(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
                        </div>

                        <div style={{ padding: '20px 24px' }}>
                            <div style={{ background: 'var(--bg, #f8fafc)', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '13px', color: '#64748b' }}>
                                <div><strong style={{ color: 'var(--text-primary, #1e293b)' }}>{action.item.type === 'quotation' ? 'Quotation' : 'Invoice'}</strong>: {action.item.id}</div>
                                <div><strong>Franchise</strong>: {action.item.franchise_name}</div>
                                <div><strong>Customer</strong>: {action.item.customer_name || '—'}</div>
                                <div><strong>Amount</strong>: {fmt(action.item.grand_total || 0)}</div>
                            </div>

                            {action.type !== 'approve' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                                        {action.type === 'reject' ? 'Rejection Reason *' : 'Revision Instructions *'}
                                    </label>
                                    <textarea
                                        value={comment}
                                        onChange={e => setComment(e.target.value)}
                                        placeholder={action.type === 'reject' ? 'Explain why this is being rejected…' : 'Describe what changes are needed…'}
                                        style={{ width: '100%', padding: '10px', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'vertical', minHeight: '90px', background: 'var(--card, #fff)', color: 'var(--text-primary, #1e293b)', boxSizing: 'border-box' }}
                                    />
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setAction(null)} style={{ padding: '8px 16px', background: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                                Cancel
                            </button>
                            <button
                                onClick={handleAction}
                                disabled={submitting || (action.type !== 'approve' && !comment.trim())}
                                style={{
                                    padding: '8px 18px',
                                    background: action.type === 'approve' ? '#10b981' : action.type === 'reject' ? '#ef4444' : '#ea580c',
                                    color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer',
                                    fontSize: '13px', fontWeight: 600,
                                    opacity: (submitting || (action.type !== 'approve' && !comment.trim())) ? 0.6 : 1
                                }}
                            >
                                {submitting ? 'Processing…' : action.type === 'approve' ? 'Confirm Approve' : action.type === 'reject' ? 'Confirm Reject' : 'Send to Franchise'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
