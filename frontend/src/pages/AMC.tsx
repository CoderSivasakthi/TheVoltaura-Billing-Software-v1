import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, ClipboardList, AlertTriangle, Banknote, Edit3, RefreshCw, Trash2, AlertCircle } from 'lucide-react'
import { api, fmt, fmtDate, toast } from '../services/api'
import { PaginationFooter, usePagination } from '../components/PaginationFooter'

export default function AMC() {
    const navigate = useNavigate()
    const [amcList, setAmcList] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [page, setPage] = useState(1)

    const loadAmc = useCallback(async () => {
        try {
            const data = await api('GET', '/api/amc')
            const today = new Date().getTime()
            const updatedData = (data || []).map((a: any) => {
                if (!a.amcExpiryDate) return a
                const exp = new Date(a.amcExpiryDate).getTime()
                const daysLeft = Math.ceil((exp - today) / (1000 * 3600 * 24))
                let computedStatus = 'Active'
                if (daysLeft < 0) computedStatus = 'Expired'
                else if (daysLeft <= 30) computedStatus = 'Expiring Soon'
                return { ...a, computedStatus, daysLeft }
            })
            setAmcList(updatedData)
        }
        catch { setAmcList([]) }
    }, [])

    useEffect(() => { loadAmc() }, [loadAmc])

    const filtered = amcList.filter(a => {
        const s = search.toLowerCase()
        const matchSearch = !s ||
            (a.id || '').toLowerCase().includes(s) ||
            (a.vendorName || '').toLowerCase().includes(s) ||
            (a.companyName || '').toLowerCase().includes(s)
        const matchStatus = !statusFilter || (a.computedStatus || a.status || '').toLowerCase() === statusFilter.toLowerCase()
        return matchSearch && matchStatus
    }).sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime())

    // Pagination
    const { totalPages, pageSize: PER_PAGE } = usePagination(filtered.length, 10)
    const safePage = Math.min(page, totalPages)
    const pageStart = (safePage - 1) * PER_PAGE
    const pageEnd = Math.min(pageStart + PER_PAGE, filtered.length)
    const paginated = filtered.slice(pageStart, pageEnd)

    // Reset to page 1 when filter changes
    useEffect(() => { setPage(1) }, [search, statusFilter])

    // Stats
    const activeCount = amcList.filter(a => a.computedStatus === 'Active').length
    const expiringCount = amcList.filter(a => a.computedStatus === 'Expiring Soon').length
    const revenue = amcList.filter(a => a.computedStatus !== 'Expired')
        .reduce((s, a) => s + Number(a.totalContractValue || 0), 0)

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Are you sure you want to delete this AMC contract?')) return
        try {
            await api('DELETE', `/api/amc/${id}`)
            toast('Contract deleted')
            loadAmc()
        }
        catch { toast('Delete failed', 'error') }
    }

    const handleRenew = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Create a renewal draft for this contract?')) return
        try {
            const newAmc = await api('POST', `/api/amc/${id}/renew`, {})
            toast('Renewal draft created!')
            navigate(`/amc/${newAmc.id}/edit`)
        } catch { toast('Failed to renew contract', 'error') }
    }

    const exportCSV = () => {
        if (!amcList.length) { toast('No data to export', 'error'); return }
        const headers = ['AMC ID', 'Vendor/Company', 'Contact', 'Capacity', 'Start Date', 'Expiry Date', 'Status', 'Total Value']
        const escapeCsv = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
        const csv = [
            headers.map(escapeCsv).join(','),
            ...amcList.map(a => [
                escapeCsv(a.id),
                escapeCsv(a.vendorName || a.companyName),
                escapeCsv(a.vendorContact),
                escapeCsv(a.systemCapacity),
                escapeCsv(fmtDate(a.amcStartDate)),
                escapeCsv(fmtDate(a.amcExpiryDate)),
                escapeCsv(a.computedStatus || a.status),
                escapeCsv(a.totalContractValue || 0)
            ].join(','))
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'amc_contracts.csv'
        a.click()
        toast('CSV exported')
    }

    return (
        <div className="page active" id="amc-page">
            <div className="breadcrumb"><a href="#" onClick={e => { e.preventDefault(); navigate('/dashboard') }}>Home</a><span className="bc-sep">›</span><span className="bc-cur">AMC Contracts</span></div>
            <div className="ph">
                <div>
                    <h2>AMC Contracts (Vendor)</h2>
                    <div className="sub">Manage vendor maintenance agreements, equipment coverage, and renewals.</div>
                </div>
                <div className="ph-actions">
                    <button className="btn btn-secondary btn-sm" onClick={exportCSV}>Export</button>
                    <button className="btn btn-primary" onClick={() => navigate('/amc/new')}><Plus size={14} /> New AMC Contract</button>
                </div>
            </div>

            {/* Stat cards */}
            <div className="amc-stat-grid">
                <div className="amc-stat">
                    <div className="amc-stat-label">Total Contract Value</div>
                    <div className="amc-stat-val">{fmt(revenue)}</div>
                    <div className="amc-stat-icon"><Banknote /></div>
                </div>
                <div className="amc-stat">
                    <div className="amc-stat-label">Active Contracts</div>
                    <div className="amc-stat-val">{activeCount}</div>
                    <div className="amc-stat-badge asb-green">Good</div>
                    <div className="amc-stat-icon"><ClipboardList /></div>
                </div>
                <div className="amc-stat">
                    <div className="amc-stat-label">Expiring Soon (&lt;30 Days)</div>
                    <div className="amc-stat-val">{expiringCount}</div>
                    {expiringCount > 0 && <div className="urgent-badge"><AlertCircle style={{ width: 12, height: 12 }} /> Action Req</div>}
                    <div className="amc-stat-icon"><AlertTriangle /></div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px', paddingTop: '16px' }}>
                <div style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--brand-light, #eff6ff)', color: 'var(--brand, #2563eb)', borderRadius: '12px', border: '1px solid var(--brand-lt, #bfdbfe)', fontWeight: 600 }}>
                    Sort: Latest First ↓
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ marginTop: 24, overflow: 'hidden' }}>
                {/* Search + Filter: horizontally aligned in one row */}
                <div className="toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
                    <div className="sbox" style={{ flex: 1 }}>
                        <Search className="si" />
                        <input type="text" placeholder="Search by Vendor / ID..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="filter-sel" style={{ minWidth: 150 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="">All Status</option>
                        <option>Active</option>
                        <option>Expiring Soon</option>
                        <option>Expired</option>
                    </select>
                </div>
                <div className="tw">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>AMC ID</th>
                                <th>Vendor / Company</th>
                                <th>Capacity</th>
                                <th>AMC Timeline</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.length === 0 ? (
                                <tr><td colSpan={6} className="empty-state">No vendor AMC contracts found.</td></tr>
                            ) : paginated.map((a: any) => (
                                <tr
                                    key={a.id}
                                    className="tr-clickable"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/amc/${a.id}`)}
                                    tabIndex={0}
                                    role="button"
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/amc/${a.id}`) } }}
                                >
                                    <td style={{ fontWeight: 600, color: 'var(--p600)' }}>{a.id}</td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{a.vendorName || a.companyName || '—'}</div>
                                        <div style={{ fontSize: 12, color: 'var(--g400)' }}>
                                            {a.vendorContact} {a.companyName && a.vendorName ? `(${a.companyName})` : ''}
                                        </div>
                                    </td>
                                    <td>{a.systemCapacity || '—'}</td>
                                    <td>
                                        <div style={{ fontSize: 13 }}>
                                            {fmtDate(a.amcStartDate)} <span style={{ color: 'var(--g400)' }}>→</span> {fmtDate(a.amcExpiryDate)}
                                        </div>
                                        {a.daysLeft !== undefined && (
                                            <div style={{ fontSize: 12, color: a.daysLeft < 0 ? 'var(--red)' : a.daysLeft <= 30 ? '#F59E0B' : 'var(--g400)' }}>
                                                {a.daysLeft < 0 ? `Expired ${Math.abs(a.daysLeft)} days ago` : `${a.daysLeft} days remaining`}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`badge ${a.computedStatus === 'Active' ? 'badge-green' : a.computedStatus === 'Expired' ? 'badge-red' : 'badge-orange'}`}>
                                            {a.computedStatus || a.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={e => { e.stopPropagation(); navigate(`/amc/${a.id}/edit`) }}
                                                title="Edit"
                                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                            >
                                                <Edit3 size={13} /> Edit
                                            </button>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={e => handleRenew(a.id, e)}
                                                title="Renew"
                                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                            >
                                                <RefreshCw size={13} /> Renew
                                            </button>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={e => handleDelete(a.id, e)}
                                                title="Delete"
                                                style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--red)' }}
                                            >
                                                <Trash2 size={13} /> Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Standard Pagination Footer */}
                <PaginationFooter
                    page={safePage}
                    totalPages={totalPages}
                    totalResults={filtered.length}
                    pageStart={pageStart}
                    pageEnd={pageEnd}
                    onPage={setPage}
                />
            </div>
        </div>
    )
}
