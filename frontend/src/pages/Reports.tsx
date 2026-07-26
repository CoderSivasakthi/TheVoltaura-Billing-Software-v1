import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Briefcase, Landmark, Heart, Receipt } from 'lucide-react'
import { api, fmt, fmtDate, statusTag, toast, displayName } from '../services/api'
import { PaginationFooter, usePagination } from '../components/PaginationFooter'
export default function Reports() {
    const navigate = useNavigate()
    const [invoices, setInvoices] = useState<any[]>([])
    const [page, setPage] = useState(1)

    const loadReports = useCallback(async () => {
        try {
            const inv = await api('GET', '/api/invoices').catch(() => [])
            setInvoices(inv || [])
        } catch { /* Demo mode */ }
    }, [])

    useEffect(() => { loadReports() }, [loadReports])

    // KPI calculations
    const totalRevenue = invoices.reduce((s, i) => s + Number(i.total || i.grandTotal || 0), 0)
    const gstCollected = invoices.reduce((s, i) => s + Number(i.gst || i.totalTax || 0), 0)
    const netProfit = totalRevenue - gstCollected
    const pendingPayments = invoices.filter(i => (i.status || '').toLowerCase() === 'pending').reduce((s, i) => s + Number(i.total || i.grandTotal || 0), 0)

    const sortedInvoices = [...invoices].sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime())

    const { totalPages, pageSize: PER_PAGE } = usePagination(sortedInvoices.length, 10)
    const paginated = sortedInvoices.slice((page - 1) * PER_PAGE, page * PER_PAGE)

    const exportReport = () => {
        const escapeCsv = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
        const lines = [
            escapeCsv('TheVoltaura — Financial Report'),
            escapeCsv(`Generated: ${new Date().toLocaleString('en-IN')}`),
            '',
            'Invoice ID,Date,Customer,Taxable Amt,GST,Total,Status',
            ...invoices.map(i => [
                escapeCsv(i.id),
                escapeCsv(fmtDate(i.createdAt || i.date)),
                escapeCsv(displayName(i.customerName || i.customer)),
                escapeCsv(i.subtotal || 0),
                escapeCsv(i.gst || i.totalTax || 0),
                escapeCsv(i.total || i.grandTotal || 0),
                escapeCsv(i.status || '')
            ].join(','))
        ]
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'financial_report.csv'; a.click()
        toast('Report exported')
    }

    return (
        <div className="page active" id="reports-page">
            <div className="breadcrumb"><a href="#" onClick={e => { e.preventDefault(); navigate('/dashboard') }}>Home</a><span className="bc-sep">›</span><span className="bc-cur">Reports</span></div>
            <div className="ph">
                <div>
                    <h2>Financial Performance &amp; GST Compliance</h2>
                    <div className="sub">Track revenue, tax liabilities, and operational costs in real-time.</div>
                </div>
            </div>

            {/* Controls */}
            <div className="rpt-controls">
                <button className="rpt-ctrl-btn">📅 This Month <span className="arrow">▾</span></button>
                <button className="rpt-ctrl-btn">👥 All Customers <span className="arrow">▾</span></button>
                <button className="rpt-ctrl-btn export" onClick={exportReport}><Download style={{ width: 14, height: 14 }} /> Export Report</button>
            </div>

            {/* KPI Cards */}
            <div className="rpt-kpi">
                <div className="rpt-kpi-card">
                    <div className="rkt-icon-row"><div className="rkt-ico ki-blue" style={{ background: 'var(--blue-lt)' }}><Briefcase /></div><span className="rkt-delta up">↑ 12%</span></div>
                    <div className="rkt-label">Total Revenue</div>
                    <div className="rkt-val">{fmt(totalRevenue)}</div>
                </div>
                <div className="rpt-kpi-card">
                    <div className="rkt-icon-row"><div className="rkt-ico ki-purple" style={{ background: 'var(--purple-lt, #f3e8ff)' }}><Landmark /></div><span className="rkt-delta up">↑ 5%</span></div>
                    <div className="rkt-label">GST Collected</div>
                    <div className="rkt-val">{fmt(gstCollected)}</div>
                </div>
                <div className="rpt-kpi-card">
                    <div className="rkt-icon-row"><div className="rkt-ico ki-green" style={{ background: 'var(--green-lt)' }}><Heart /></div><span className="rkt-delta up">↑ 8%</span></div>
                    <div className="rkt-label">Net Profit</div>
                    <div className="rkt-val">{fmt(netProfit)}</div>
                </div>
                <div className="rpt-kpi-card">
                    <div className="rkt-icon-row"><div className="rkt-ico ki-orange" style={{ background: 'var(--orange-lt)' }}><Receipt /></div><span className="rkt-delta down">↓ 2%</span></div>
                    <div className="rkt-label">Pending Payments</div>
                    <div className="rkt-val">{fmt(pendingPayments)}</div>
                </div>
            </div>

            {/* Transaction table */}
            <div className="trans-card">
                <div className="trans-hdr">
                    <h3>Transaction Details</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--brand-light, #eff6ff)', color: 'var(--brand, #2563eb)', borderRadius: '12px', border: '1px solid var(--brand-lt, #bfdbfe)', fontWeight: 600 }}>
                            Sort: Latest First ↓
                        </div>
                        <div className="sbox" style={{ maxWidth: 200 }}><span className="si">🔍</span><input type="text" placeholder="Filter transactions..." /></div>
                        <button className="tb-icon-btn" style={{ fontSize: 13 }}>⊞</button>
                    </div>
                </div>
                <div className="tw">
                    <table className="tbl">
                        <thead><tr>
                            <th>Invoice ID</th><th>Date</th><th>Customer</th><th>Capacity</th><th>Taxable Amt</th><th>GST (18%)</th><th>Total</th><th>Status</th><th>Action</th>
                        </tr></thead>
                        <tbody id="transBody">
                            {paginated.length === 0 ? (
                                <tr><td colSpan={9} className="empty-state">No transactions found</td></tr>
                            ) : paginated.map((inv: any) => (
                                <tr
                                    key={inv.id}
                                    className="tr-clickable"
                                    onClick={() => navigate(`/view-invoice/${inv.id}`)}
                                    tabIndex={0}
                                    role="button"
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/view-invoice/${inv.id}`); } }}
                                >
                                    <td><span style={{ color: 'var(--blue)', fontWeight: 600 }}>{inv.id}</span></td>
                                    <td>{fmtDate(inv.createdAt || inv.date)}</td>
                                    <td>{displayName(inv.customerName || inv.customer)}</td>
                                    <td>—</td>
                                    <td>{fmt(inv.subtotal)}</td>
                                    <td>{fmt(inv.gst || inv.totalTax)}</td>
                                    <td><strong>{fmt(inv.total || inv.grandTotal)}</strong></td>
                                    <td dangerouslySetInnerHTML={{ __html: statusTag(inv.status) }}></td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <Download style={{ width: 14, height: 14, cursor: 'pointer', color: 'var(--g400)' }} onClick={() => toast('Exporting...', 'info')} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <PaginationFooter
                    page={page}
                    totalPages={totalPages}
                    totalResults={invoices.length}
                    pageStart={(page - 1) * PER_PAGE}
                    pageEnd={Math.min(page * PER_PAGE, invoices.length)}
                    onPage={setPage}
                />
            </div>
        </div>
    )
}
