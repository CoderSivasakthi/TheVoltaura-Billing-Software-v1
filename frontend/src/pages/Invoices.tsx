import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Trash2, IndianRupee, Clock, AlertTriangle, CheckCircle, FileCheck, Download } from 'lucide-react'
import { api, fmt, fmtDate, statusTag, toast, displayName } from '../services/api'
import { t } from '../i18n'
import { PaginationFooter, usePagination } from '../components/PaginationFooter'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchInvoices, selectAllInvoices, selectInvoiceStatus, selectInvoiceError, removeInvoiceLocal } from '../store/slices/invoiceSlice'

export default function Invoices() {
    const navigate = useNavigate()
    const dispatch = useAppDispatch()
    const invoices = useAppSelector(selectAllInvoices) || []
    const status = useAppSelector(selectInvoiceStatus)
    const error = useAppSelector(selectInvoiceError)
    const loading = status === 'loading'

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [dateFilter, setDateFilter] = useState('')
    const [page, setPage] = useState(1)

    useEffect(() => {
        dispatch(fetchInvoices())
    }, [dispatch])

    const loadInvoices = () => {
        dispatch(fetchInvoices())
    }

    const filtered = invoices.filter((i: any) => {

        const s = search.toLowerCase()
        const matchSearch = !s || JSON.stringify(i).toLowerCase().includes(s)
        const matchStatus = !statusFilter || (i.status || '').toLowerCase() === statusFilter.toLowerCase()
        return matchSearch && matchStatus
    })

    const { totalPages, pageSize: PAGE_SIZE } = usePagination(filtered.length, 8)
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    const deleteInvoice = async (id: string, e?: any) => {
        if (e) e.stopPropagation();
        if (!confirm('Are you sure you want to delete this invoice?')) return
        try {
            await api('DELETE', `/api/invoices/${encodeURIComponent(id)}`, null);
            toast('Invoice Deleted');
            dispatch(removeInvoiceLocal(id))
        }
        catch { toast('Delete failed', 'error') }
    }

    const exportCSV = () => {
        if (!invoices.length) { toast('No data to export', 'error'); return }
        const headers = ['Invoice ID', 'Date', 'Customer', 'Subtotal', 'Tax', 'Discount', 'Total', 'Paid', 'Status']
        const escapeCsv = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
        const csv = [
            headers.map(escapeCsv).join(','),
            ...invoices.map((i: any) => [
                escapeCsv(i.id),
                escapeCsv(fmtDate(i.createdAt || i.date)),
                escapeCsv(displayName(i.customerName || i.customer)),
                escapeCsv(i.subtotal || 0),
                escapeCsv(i.gst || i.totalTax || 0),
                escapeCsv(i.discount || 0),
                escapeCsv(i.total || i.grandTotal || 0),
                escapeCsv(i.paid || 0),
                escapeCsv(i.status)
            ].join(','))
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'invoices.csv'
        a.click()
        toast('CSV exported')
    }

    // KPI Calculations
    const totalRevenue = invoices.filter((i: any) => i.status !== 'Draft' && i.status !== 'Cancelled').reduce((s: any, i: any) => s + (i.total || i.grandTotal || 0), 0);
    const paidAmount = invoices.filter((i: any) => (i.status || '').toLowerCase() === 'paid').reduce((s: any, i: any) => s + (i.total || i.grandTotal || 0), 0);
    const pendingAmount = invoices.filter((i: any) => (i.status || '').toLowerCase() === 'pending' || (i.status || '').toLowerCase() === 'partial').reduce((s: any, i: any) => s + ((i.total || i.grandTotal || 0) - (i.paid || 0)), 0);
    const overdueCount = invoices.filter((i: any) => (i.status || '').toLowerCase() === 'overdue').length;

    const s_card = { background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' };

    return (
        <div className="page active" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh', padding: '32px' }}>
            <div className="breadcrumb" style={{ marginBottom: '24px' }}><a href="#" onClick={e => { e.preventDefault(); navigate('/dashboard') }}>Home</a><span className="bc-sep">›</span><span className="bc-cur">Invoices</span></div>

            {/* Error Boundary Alternative */}
            {error && (
                <div style={{ padding: '16px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={20} />
                    <strong>Error:</strong> {error}
                    <button onClick={loadInvoices} style={{ background: 'none', border: 'none', color: '#B91C1C', textDecoration: 'underline', cursor: 'pointer', marginLeft: 'auto' }}>Retry</button>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '28px', color: '#111827', margin: 0, fontWeight: 800 }}>{t('Invoices')}</h2>
                    <div style={{ fontSize: '13px', color: 'var(--g500)', marginTop: '4px' }}>Manage billing, warranty trackers, and compliance checks.</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={exportCSV} className="btn btn-secondary btn-sm" style={{ height: '38px', padding: '0 16px' }}>
                        <Download size={14} /> Export CSV
                    </button>
                    <button onClick={() => navigate('/invoices/new')} className="new-invoice-btn" style={{ height: '38px' }}>
                        <Plus size={16} /> {t('Create Invoice')}
                    </button>
                </div>
            </div>

            {/* KPI Section */}
            {!loading && invoices.length > 0 && (
                <div className="kpi-grid" style={{ marginBottom: '32px' }}>
                    <div style={{ ...s_card, padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g500)', textTransform: 'uppercase' }}>Total Revenue</div>
                            <div style={{ padding: '8px', backgroundColor: '#EFF6FF', borderRadius: '8px', color: '#3B82F6' }}><IndianRupee size={20} /></div>
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827' }}>{fmt(totalRevenue)}</div>
                    </div>
                    <div style={{ ...s_card, padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g500)', textTransform: 'uppercase' }}>Paid Invoices</div>
                            <div style={{ padding: '8px', backgroundColor: '#F0FDF4', borderRadius: '8px', color: '#10B981' }}><CheckCircle size={20} /></div>
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827' }}>{fmt(paidAmount)}</div>
                    </div>
                    <div style={{ ...s_card, padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g500)', textTransform: 'uppercase' }}>Pending Dues</div>
                            <div style={{ padding: '8px', backgroundColor: '#FEF3C7', borderRadius: '8px', color: '#F59E0B' }}><Clock size={20} /></div>
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827' }}>{fmt(pendingAmount)}</div>
                    </div>
                    <div style={{ ...s_card, padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g500)', textTransform: 'uppercase' }}>Overdue Alerts</div>
                            <div style={{ padding: '8px', backgroundColor: '#FEF2F2', borderRadius: '8px', color: '#EF4444' }}><AlertTriangle size={20} /></div>
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#EF4444' }}>{overdueCount} Alerts</div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                {/* Main Invoices Area */}
                <div style={{ flex: 1, minWidth: 0 }}>

                    {/* Filters Module */}
                    <div className="toolbar" style={{ ...s_card, padding: '20px 24px', marginBottom: '24px' }}>
                        <div className="sbox">
                            <Search className="si" />
                            <input type="text" placeholder="Search invoices by client or ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
                        </div>
                        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
                            <option value="">All Statuses</option>
                            <option value="Paid">Paid</option>
                            <option value="Pending">Pending</option>
                            <option value="Partial">Partial</option>
                            <option value="Overdue">Overdue</option>
                            <option value="Converted">Converted</option>
                        </select>
                        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', outline: 'none', backgroundColor: '#fff', color: 'var(--g700)' }} />
                    </div>

                    {/* Stacked Invoice Cards Component */}
                    {loading ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--g400)', background: '#fff', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div className="spinner" style={{ border: '3px solid var(--g200)', borderTop: '3px solid var(--brand)', borderRadius: '50%', width: 24, height: 24, animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
                            Loading invoices...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '80px 40px', textAlign: 'center', color: 'var(--g500)', background: '#fff', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                            <FileCheck size={48} color="var(--g300)" style={{ margin: '0 auto 16px' }} />
                            <h3 style={{ fontSize: '18px', color: '#111827', marginBottom: '8px' }}>No invoices found</h3>
                            <p style={{ fontSize: '14px', margin: 0 }}>Try adjusting your search criteria or create a new invoice to get started.</p>
                        </div>
                    ) : (
                        <div>
                            {paginated.map((inv: any, index: number) => {
                                const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
                                const total = inv.total || inv.grandTotal || 0;
                                const tax = inv.gst || inv.totalTax || 0;
                                const due = total - paid;
                                return (
                                    <div key={`inv-${inv.id}-${index}`} className="inv-list-card">
                                        {/* Card Header (Visible Always) */}
                                        <div onClick={() => navigate(`/invoices/${encodeURIComponent(inv.id)}`)} className="ilc-row">
                                            <div className="ilc-col-id">
                                                <div style={{ fontSize: '12px', color: 'var(--g500)', textTransform: 'uppercase', marginBottom: '4px' }}>Invoice ID</div>
                                                <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>#{inv.id}</div>
                                            </div>
                                            <div className="ilc-col-main">
                                                <div style={{ fontSize: '12px', color: 'var(--g500)', textTransform: 'uppercase', marginBottom: '4px' }}>{t('Customer')} & {t('Date')}</div>
                                                <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>{displayName(inv.customerName || inv.customer)}</div>
                                                <div style={{ fontSize: '13px', color: 'var(--g500)', marginTop: '2px' }}>Created on {fmtDate(inv.createdAt || inv.date)}</div>
                                            </div>
                                            <div className="ilc-col-amt">
                                                <div style={{ fontSize: '12px', color: 'var(--g500)', textTransform: 'uppercase', marginBottom: '4px' }}>{t('Amount')} & Tax</div>
                                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{fmt(total)}</div>
                                                {tax > 0 && <div style={{ fontSize: '12px', color: 'var(--g500)', marginTop: '2px' }}>Tax: {fmt(tax)}</div>}
                                            </div>
                                            <div className="ilc-col-status">
                                                <div style={{ fontSize: '12px', color: 'var(--g500)', textTransform: 'uppercase', marginBottom: '4px' }}>{t('Status')}</div>
                                                <span dangerouslySetInnerHTML={{ __html: statusTag(inv.status) }}></span>
                                            </div>
                                            <div className="ilc-col-due">
                                                <div style={{ fontSize: '12px', color: 'var(--g500)', textTransform: 'uppercase', marginBottom: '4px' }}>{t('Amount')} Due</div>
                                                <div style={{ fontSize: '18px', fontWeight: 800, color: due > 0 ? 'var(--brand)' : '#10B981' }}>{fmt(due)}</div>
                                            </div>
                                            <div className="ilc-col-acts">
                                                <button onClick={(e) => deleteInvoice(inv.id, e)} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#EF4444', borderColor: '#FCA5A5' }} title="Delete Invoice">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="card" style={{ marginTop: '16px' }}>
                            <PaginationFooter
                                page={page}
                                totalPages={totalPages}
                                totalResults={filtered.length}
                                pageStart={(page - 1) * PAGE_SIZE}
                                pageEnd={Math.min(page * PAGE_SIZE, filtered.length)}
                                onPage={setPage}
                            />
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
                
                .new-invoice-btn {
                    padding: 10px 16px;
                    background-color: #F59E0B;
                    color: #ffffff;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 13px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);
                    transition: all 0.2s ease-in-out;
                    opacity: 1 !important;
                }
                .new-invoice-btn:hover {
                    background-color: #D97706;
                }
                .new-invoice-btn:active {
                    transform: translateY(1px);
                }
            `}</style>
        </div >
    )
}
