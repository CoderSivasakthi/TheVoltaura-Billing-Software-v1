import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Building2, TrendingUp, TrendingDown, Users, FileText,
    IndianRupee, Activity, Crown, RefreshCw, Clock,
    Eye, ChevronRight
} from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface FranchiseSummary {
    franchise_id: string
    franchise_code: string
    franchise_name: string
    city: string
    status: string
    total_customers: number
    total_quotations: number
    total_invoices: number
    total_revenue: number
    outstanding: number
    pending_quotation_approvals: number
    pending_invoice_approvals: number
}

interface DashboardData {
    total_franchises: number
    total_revenue: number
    total_customers: number
    total_quotations: number
    pending_approvals: number
    pending_quotations: number
    pending_invoices: number
    top_franchise: FranchiseSummary | null
    bottom_franchise: FranchiseSummary | null
    franchise_summaries: FranchiseSummary[]
}

const fmt = (n: number) => {
    if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`
    if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)}L`
    return `₹${n.toLocaleString('en-IN')}`
}

export default function SuperAdminDashboard() {
    const navigate = useNavigate()
    const { isSuperAdmin } = useAuth()
    const [data, setData]       = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState('')
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const d = await api('GET', '/api/super-admin/dashboard', undefined, true)
            setData(d)
            setLastUpdated(new Date())
        } catch (e: any) {
            setError(e.message || 'Failed to load dashboard')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    if (!isSuperAdmin()) return null

    const kpis = [
        { label: 'Total Franchises',    value: data?.total_franchises ?? '—',         icon: Building2,   color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
        { label: 'Total Revenue',       value: data ? fmt(data.total_revenue) : '—',  icon: IndianRupee, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
        { label: 'Total Customers',     value: data?.total_customers ?? '—',          icon: Users,       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
        { label: 'Total Quotations',    value: data?.total_quotations ?? '—',         icon: FileText,    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
        { label: 'Pending Approvals',   value: data?.pending_approvals ?? '—',        icon: Clock,       color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   alert: (data?.pending_approvals || 0) > 0 },
    ]

    return (
        <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Crown size={24} color="#f59e0b" />
                        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>
                            Head Office Dashboard
                        </h1>
                    </div>
                    {lastUpdated && (
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                            Last updated: {lastUpdated.toLocaleTimeString()}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => navigate('/approvals')}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                    >
                        <Clock size={14} /> Approvals {(data?.pending_approvals || 0) > 0 && `(${data!.pending_approvals})`}
                    </button>
                    <button
                        onClick={load}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary, #1e293b)' }}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#dc2626', fontSize: '14px' }}>
                    {error}
                </div>
            )}

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {kpis.map(k => (
                    <div key={k.label} style={{
                        background: 'var(--card, #fff)', border: `1px solid ${k.alert ? '#fca5a5' : 'var(--border, #e2e8f0)'}`,
                        borderRadius: '12px', padding: '20px', boxShadow: k.alert ? '0 0 0 2px rgba(239,68,68,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
                        cursor: k.label === 'Pending Approvals' ? 'pointer' : 'default', transition: 'transform 0.15s'
                    }} onClick={k.label === 'Pending Approvals' ? () => navigate('/approvals') : undefined}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginBottom: '6px' }}>{k.label}</div>
                                <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>{k.value}</div>
                            </div>
                            <div style={{ width: 42, height: 42, borderRadius: '10px', background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <k.icon size={20} color={k.color} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Top / Bottom franchise */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: '🏆 Top Performing Franchise', fr: data?.top_franchise, icon: TrendingUp, color: '#10b981' },
                    { label: '⚠️ Lowest Performing Franchise', fr: data?.bottom_franchise, icon: TrendingDown, color: '#f59e0b' }
                ].map(({ label, fr, icon: Icon, color }) => (
                    <div key={label} style={{ background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '12px' }}>{label}</div>
                        {fr ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary, #1e293b)' }}>{fr.franchise_name}</div>
                                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{fr.franchise_code} · {fr.city || '—'}</div>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color, marginTop: '8px' }}>{fmt(fr.total_revenue)}</div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{fr.total_customers} customers</div>
                                </div>
                                <Icon size={36} color={color} opacity={0.3} />
                            </div>
                        ) : (
                            <div style={{ color: '#94a3b8', fontSize: '14px' }}>No franchise data yet</div>
                        )}
                    </div>
                ))}
            </div>

            {/* Franchise Table */}
            <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary, #1e293b)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={16} color="#6366f1" /> All Franchises
                    </div>
                    <button onClick={() => navigate('/administration/franchises')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontWeight: 600, fontSize: '13px' }}>
                        Manage <ChevronRight size={14} />
                    </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg, #f8fafc)' }}>
                                {['Franchise', 'City', 'Customers', 'Quotations', 'Revenue', 'Outstanding', 'Pending', 'Status', ''].map(h => (
                                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
                            )}
                            {!loading && (!data?.franchise_summaries?.length) && (
                                <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No franchises yet. <button onClick={() => navigate('/administration/franchises')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontWeight: 600 }}>Create one →</button></td></tr>
                            )}
                            {(data?.franchise_summaries || []).map(fr => {
                                const pending = (fr.pending_quotation_approvals || 0) + (fr.pending_invoice_approvals || 0)
                                return (
                                    <tr key={fr.franchise_id} style={{ borderTop: '1px solid var(--border, #f1f5f9)' }}>
                                        <td style={{ padding: '12px 14px' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>{fr.franchise_name}</div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{fr.franchise_code}</div>
                                        </td>
                                        <td style={{ padding: '12px 14px', color: '#64748b' }}>{fr.city || '—'}</td>
                                        <td style={{ padding: '12px 14px' }}>{fr.total_customers}</td>
                                        <td style={{ padding: '12px 14px' }}>{fr.total_quotations}</td>
                                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#10b981' }}>{fmt(fr.total_revenue)}</td>
                                        <td style={{ padding: '12px 14px', color: '#f59e0b' }}>{fmt(fr.outstanding)}</td>
                                        <td style={{ padding: '12px 14px' }}>
                                            {pending > 0 ? (
                                                <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 600 }}>
                                                    {pending} pending
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <span style={{
                                                background: fr.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                                color: fr.status === 'Active' ? '#10b981' : '#ef4444',
                                                borderRadius: '999px', padding: '2px 10px', fontSize: '11px', fontWeight: 600
                                            }}>{fr.status}</span>
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <button onClick={() => navigate(`/administration/franchises?id=${fr.franchise_id}`)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontWeight: 600, fontSize: '12px' }}>
                                                <Eye size={13} /> View
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
