import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Download } from 'lucide-react'
import { api, fmt, fmtDate, statusTag, toast } from '../services/api'
import { PaginationFooter, usePagination } from '../components/PaginationFooter'
export default function Payments() {
    const navigate = useNavigate()
    const [payments, setPayments] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)

    const loadPayments = useCallback(async () => {
        try {
            const [payData, invData] = await Promise.all([
                api('GET', '/api/payments').catch(() => []),
                api('GET', '/api/invoices').catch(() => [])
            ])
            // Build payments list from both sources
            const payList = [...(payData || [])]
                ; (invData || []).forEach((inv: any) => {
                    if (inv.payments) {
                        inv.payments.forEach((p: any) => {
                            if (!payList.find((x: any) => x.id === p.id)) {
                                payList.push({ ...p, invoiceId: inv.id })
                            }
                        })
                    }
                })
            setPayments(payList)
        } catch { setPayments([]) }
    }, [])

    useEffect(() => { loadPayments() }, [loadPayments])

    const filtered = payments.filter(p => {
        if (!search) return true
        return JSON.stringify(p).toLowerCase().includes(search.toLowerCase())
    }).sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime())

    const { totalPages, pageSize: perPage } = usePagination(filtered.length, 10)
    const paginated = filtered.slice((page - 1) * perPage, page * perPage)

    const exportCSV = () => {
        if (!payments.length) { toast('No data to export', 'error'); return }
        const headers = ['Payment ID', 'Invoice ID', 'Customer', 'Amount', 'Method', 'Date', 'Status']
        const escapeCsv = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
        const csv = [
            headers.map(escapeCsv).join(','),
            ...payments.map((p, i) => [
                escapeCsv(p.id || `PAY-${i + 1}`),
                escapeCsv(p.invoiceId || ''),
                escapeCsv(p.customerName || p.customerId || ''),
                escapeCsv(p.amount || 0),
                escapeCsv(p.method || ''),
                escapeCsv(fmtDate(p.date || p.createdAt)),
                escapeCsv(p.status || 'Paid')
            ].join(','))
        ].join('\n')
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'payments.csv'
        a.click()
        toast('CSV exported')
    }

    return (
        <div className="page active" id="payments-page">
            <div className="breadcrumb"><a href="#" onClick={e => { e.preventDefault(); navigate('/dashboard') }}>Home</a><span className="bc-sep">›</span><span className="bc-cur">Payments</span></div>
            <div className="ph">
                <div><h2>Payments</h2><div className="sub">Payment receipts and transaction history.</div></div>
                <div className="ph-actions">
                    <button onClick={exportCSV} className="btn btn-secondary btn-sm" style={{ padding: '0 16px' }}>
                        <Download size={14} /> Export CSV
                    </button>
                    <button className="btn btn-primary" onClick={() => navigate('/payments/new')}><Plus size={14} /> Record Payment</button>
                </div>
            </div>
            <div className="toolbar">
                <div className="sbox">
                    <Search className="si" />
                    <input type="text" placeholder="Search payments..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--brand-light, #eff6ff)', color: 'var(--brand, #2563eb)', borderRadius: '12px', border: '1px solid var(--brand-lt, #bfdbfe)', fontWeight: 600, marginLeft: 'auto' }}>
                    Sort: Latest First ↓
                </div>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
                <div className="tw">
                    <table className="tbl">
                        <thead><tr><th>Payment #</th><th>Invoice</th><th>Customer</th><th>Amount</th><th>Method</th><th>Date</th><th>Status</th></tr></thead>
                        <tbody id="paymentsBody">
                            {paginated.length === 0 ? (
                                <tr><td colSpan={7} className="empty-state">No payments found</td></tr>
                            ) : paginated.map((p: any, i: number) => {
                                const pid = p.id || `PAY-${i + 1}`;
                                const custName = p.customerName || p.customerId || '—';
                                return (
                                    <tr
                                        key={pid}
                                        className="tr-clickable"
                                        onClick={() => navigate(`/view-payment/${p.id}`)}
                                        tabIndex={0}
                                        role="button"
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/view-payment/${p.id}`); } }}
                                    >
                                        <td><strong>{pid}</strong></td>
                                        <td>{p.invoiceId || '—'}</td>
                                        <td>{custName}</td>
                                        <td>{fmt(p.amount)}</td>
                                        <td>{p.method || '—'}</td>
                                        <td>{fmtDate(p.date || p.createdAt)}</td>
                                        <td><span dangerouslySetInnerHTML={{ __html: statusTag(p.status || 'Paid') }}></span></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <PaginationFooter
                    page={page}
                    totalPages={totalPages}
                    totalResults={filtered.length}
                    pageStart={(page - 1) * perPage}
                    pageEnd={Math.min(page * perPage, filtered.length)}
                    onPage={setPage}
                />
            </div>
        </div>
    )
}
