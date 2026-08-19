import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Eye, CheckCircle, Trash2, Download } from 'lucide-react'
import { api, fmt, fmtDate, statusTag, toast, displayName } from '../services/api'
import { t } from '../i18n'
import { PaginationFooter, usePagination } from '../components/PaginationFooter'
export default function Quotations() {
    const navigate = useNavigate()
    const [quotations, setQuotations] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [page, setPage] = useState(1)

    const loadQuotations = useCallback(async () => {
        try { const data = await api('GET', '/api/quotations'); setQuotations(data || []) }
        catch { setQuotations([]) }
    }, [])

    useEffect(() => { loadQuotations() }, [loadQuotations])

    const filtered = quotations
        .filter(q => {
            const s = search.toLowerCase()
            const matchSearch = !s || JSON.stringify(q).toLowerCase().includes(s)
            const matchStatus = !statusFilter || (q.status || '').toLowerCase() === statusFilter.toLowerCase()
            return matchSearch && matchStatus
        })
        // Sort newest → oldest
        .sort((a: any, b: any) => {
            const da = new Date(a.createdAt || a.date || 0).getTime()
            const db = new Date(b.createdAt || b.date || 0).getTime()
            return db - da
        })

    const { totalPages, pageSize: perPage } = usePagination(filtered.length, 10)
    const paginated = filtered.slice((page - 1) * perPage, page * perPage)

    const deleteQuotation = async (id: string) => {
        if (!confirm('Delete this quotation?')) return
        try { await api('DELETE', `/api/quotations/${encodeURIComponent(id)}`, null); toast('Deleted'); loadQuotations() }
        catch { toast('Delete failed', 'error') }
    }

    const convertToInvoice = async (id: string) => {
        try { await api('POST', `/api/quotations/${encodeURIComponent(id)}/convert`, {}); toast('Converted!'); loadQuotations() }
        catch { toast('Conversion failed', 'error') }
    }

    const exportCSV = () => {
        if (!quotations.length) { toast('No data to export', 'error'); return }
        const headers = ['Quotation ID', 'Date', 'Customer', 'Subtotal', 'Tax', 'Discount', 'Total', 'Status']
        const escapeCsv = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
        const csv = [
            headers.map(escapeCsv).join(','),
            ...quotations.map(q => [
                escapeCsv(q.id),
                escapeCsv(fmtDate(q.createdAt || q.date)),
                escapeCsv(displayName(q.customerName || q.customer)),
                escapeCsv(q.subtotal || 0),
                escapeCsv(q.gst || q.totalTax || 0),
                escapeCsv(q.discount || 0),
                escapeCsv(q.total || q.grandTotal || 0),
                escapeCsv(q.status)
            ].join(','))
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'quotations.csv'
        a.click()
        toast('CSV exported')
    }

    return (
        <div className="page active" id="quotations-page">
            <div className="breadcrumb"><a href="#" onClick={e => { e.preventDefault(); navigate('/dashboard') }}>Home</a><span className="bc-sep">›</span><span className="bc-cur">{t('Quotations')}</span></div>
            <div className="ph">
                <div><h2>{t('Quotations')}</h2><div className="sub">Manage proposals and convert them to invoices.</div></div>
                <div className="ph-actions">
                    <button onClick={exportCSV} className="btn btn-secondary btn-sm" style={{ padding: '0 16px' }}>
                        <Download size={14} /> Export CSV
                    </button>
                    <button className="btn btn-primary" onClick={() => navigate('/create-quotation')}><Plus size={14} /> {t('New Quotation')}</button>
                </div>
            </div>
            <div className="toolbar">
                <div className="sbox"><Search className="si" /><input type="text" placeholder="Search quotations..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                <select className="filter-sel" style={{ minWidth: 130 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="Quoted">Quoted</option>
                    <option value="Invoiced">Invoiced</option>
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                </select>
            </div>
            <div className="card" style={{ overflow: 'hidden' }}>
                <div className="tw">
                    <table className="tbl">
                        <thead><tr><th>Quotation #</th><th>{t('Customer')}</th><th>{t('Date')}</th><th>{t('Amount')}</th><th>{t('Status')}</th><th>Approval</th><th>{t('Action')}</th></tr></thead>
                        <tbody id="quotationsBody">
                            {paginated.length === 0 ? (
                                <tr><td colSpan={7} className="empty-state">No quotations found</td></tr>
                            ) : paginated.map((q: any) => (
                                <tr
                                    key={q.id}
                                    className="tr-clickable"
                                    onClick={() => navigate(`/view-quotation/${encodeURIComponent(q.id)}`)}
                                    tabIndex={0}
                                    role="button"
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/view-quotation/${encodeURIComponent(q.id)}`); } }}
                                >
                                    <td><strong>{q.id}</strong></td>
                                    <td>{displayName(q.customerName || q.customer)}</td>
                                    <td>{fmtDate(q.createdAt || q.date)}</td>
                                    <td>{fmt(q.total || q.grandTotal)}</td>
                                    <td dangerouslySetInnerHTML={{ __html: statusTag(q.status) }}></td>
                                    <td dangerouslySetInnerHTML={{ __html: statusTag(q.approval_status || q.approvalStatus) }}></td>
                                    <td onClick={e => e.stopPropagation()}>
                                        {(q.status === 'Invoiced') ? (
                                            <button className="abl" onClick={() => navigate(`/invoices`)}><Eye size={12} /> View Invoice</button>
                                        ) : (
                                            <button className="abl abl-green" onClick={(e) => { e.stopPropagation(); convertToInvoice(q.id); }}><CheckCircle size={12} /> Invoice</button>
                                        )}
                                        <button className="abl abl-red" onClick={() => deleteQuotation(q.id)}><Trash2 size={12} /> Delete</button>
                                    </td>
                                </tr>
                            ))}
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
