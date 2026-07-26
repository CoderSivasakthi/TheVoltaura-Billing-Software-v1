import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Download, UserPlus, Pencil, Trash2 } from 'lucide-react'
import { api, fmt, avColor, avInitials, toast, displayName, fmtDate } from '../services/api'
import { t } from '../i18n'
import { PaginationFooter, usePagination } from '../components/PaginationFooter'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { fetchCustomers, selectAllCustomers, removeCustomerLocal } from '../store/slices/customerSlice'

export default function Customers() {
    const navigate = useNavigate()
    const dispatch = useAppDispatch()
    const customers = useAppSelector(selectAllCustomers) || []
    // const status = useAppSelector(selectCustomerStatus)

    const [search, setSearch] = useState('')
    const [cityFilter, setCityFilter] = useState('')
    const [gstFilter, setGstFilter] = useState('')
    const [page, setPage] = useState(1)

    useEffect(() => {
        dispatch(fetchCustomers())
    }, [dispatch])

    const filtered = customers.filter((c: any) => {
        const s = search.toLowerCase()
        const matchSearch = !s || (c.name || '').toLowerCase().includes(s) || (c.phone || '').toLowerCase().includes(s) || (c.gstin || '').toLowerCase().includes(s)
        const matchCity = !cityFilter || c.city === cityFilter
        const matchGst = !gstFilter || c.gstStatus === gstFilter
        return matchSearch && matchCity && matchGst
    }).sort((a: any, b: any) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime())

    const cities = Array.from(new Set<string>(customers.map((c: any) => String(c.city)).filter(Boolean))).sort()
    const { totalPages, pageSize: perPage } = usePagination(filtered.length, 10)
    const paginated = filtered.slice((page - 1) * perPage, page * perPage)

    const deleteCustomer = async (id: string) => {
        if (!confirm('Delete this customer?')) return
        try {
            await api('DELETE', `/api/customers/${id}`, null)
            toast('Deleted')
            dispatch(removeCustomerLocal(id))
        } catch { toast('Delete failed', 'error') }
    }

    const exportCSV = () => {
        if (!customers.length) { toast('No data to export', 'error'); return }
        const headers = ['Name', 'Phone', 'Email', 'GSTIN', 'City', 'Address', 'Total Revenue', 'Status', 'CreatedAt']
        const escapeCsv = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
        const csv = [
            headers.map(escapeCsv).join(','),
            ...customers.map((c: any) => [
                escapeCsv(displayName(c.name)),
                escapeCsv(c.phone),
                escapeCsv(c.email),
                escapeCsv(c.gstin),
                escapeCsv(c.city),
                escapeCsv(c.address),
                escapeCsv(c.totalRevenue || 0),
                escapeCsv(c.status || 'Active'),
                escapeCsv(fmtDate(c.createdAt || c.date))
            ].join(','))
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'customers.csv'
        a.click()
        toast('CSV exported')
    }

    return (
        <div className="page active" id="customers-page">
            <div className="breadcrumb"><a href="#" onClick={e => { e.preventDefault(); navigate('/dashboard') }}>Home</a><span className="bc-sep">›</span><span className="bc-cur">{t('Customers')}</span></div>
            <div className="ph">
                <div>
                    <h2>Customer Directory</h2>
                    <div className="sub">Manage your solar service clients, GST details, and billing history.</div>
                </div>
                <div className="ph-actions">
                    <button className="btn btn-secondary btn-sm" onClick={exportCSV}><Download size={14} /> Export CSV</button>
                    <button className="btn btn-primary" onClick={() => navigate('/customers/new')}><UserPlus size={14} /> {t('Add Customer')}</button>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--brand-light, #eff6ff)', color: 'var(--brand, #2563eb)', borderRadius: '12px', border: '1px solid var(--brand-lt, #bfdbfe)', fontWeight: 600 }}>
                    Sort: Latest First ↓
                </div>
            </div>

            {/* Filter Card */}
            <div className="filter-card">
                <div className="fc-group">
                    <div className="fc-label">Search</div>
                    <div className="sbox"><Search className="si" /><input type="text" id="custSearch" placeholder="Search by name, phone, or GST..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} /></div>
                </div>
                <div className="filter-sep"></div>
                <div className="fc-group">
                    <div className="fc-label">City</div>
                    <select className="filter-sel" id="custCityFilter" value={cityFilter} onChange={e => { setCityFilter(e.target.value); setPage(1) }}>
                        <option value="">All Cities</option>
                        {cities.map((c: string) => <option key={c}>{c}</option>)}
                    </select>
                </div>
                <div className="filter-sep"></div>
                <div className="fc-group">
                    <div className="fc-label">GST Status</div>
                    <select className="filter-sel" id="custGstFilter" value={gstFilter} onChange={e => { setGstFilter(e.target.value); setPage(1) }}>
                        <option value="">All Statuses</option>
                        <option>Registered</option>
                        <option>Composition</option>
                        <option>Unregistered</option>
                    </select>
                </div>
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
                <div className="tw">
                    <table className="tbl" id="customersTable">
                        <thead><tr><th>{t('Customer')} Name</th><th>Phone</th><th>GST Number</th><th>City</th><th>Total Revenue</th><th>{t('Status')}</th><th>{t('Action')}</th></tr></thead>
                        <tbody id="customersBody">
                            {paginated.length === 0 ? (
                                <tr><td colSpan={7} className="empty-state">No customers found</td></tr>
                            ) : paginated.map((c: any) => (
                                <tr
                                    key={c.id}
                                    className="tr-clickable"
                                    onClick={() => navigate(`/customers/${c.id}/ledger`)}
                                    tabIndex={0}
                                    role="button"
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/customers/${c.id}/ledger`); } }}
                                >
                                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className={`av ${avColor(displayName(c.name))} av-sm`}>{avInitials(displayName(c.name))}</div><strong>{displayName(c.name)}</strong></div></td>
                                    <td>{c.phone || '—'}</td>
                                    <td>{c.gstin || '—'}</td>
                                    <td>{c.city || '—'}</td>
                                    <td>{fmt(c.totalRevenue || 0)}</td>
                                    <td><span className={`badge ${c.status === 'Active' ? 'b-green' : 'b-gray'}`}>{c.status || 'Active'}</span></td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <button className="abl abl-orange" onClick={() => navigate(`/customers/${c.id}/edit`)}><Pencil size={12} /> Edit</button>
                                        <button className="abl abl-red" onClick={() => deleteCustomer(c.id)}><Trash2 size={12} /> Delete</button>
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
        </div >
    )
}
