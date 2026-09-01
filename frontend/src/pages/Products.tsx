import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Package, AlertTriangle, Banknote, Star, Sun, Zap, Battery, Wrench, Pencil, Trash2 } from 'lucide-react'
import { api, fmt, toast } from '../services/api'
import { PaginationFooter, usePagination } from '../components/PaginationFooter'
import { useAuth } from '../context/AuthContext'

// Map the new categories to group them by top-level UI filters
const FILTER_TABS = [
    { cat: 'all', label: 'All Items', icon: null },
    { cat: 'Solar', label: 'Solar & Inverters', icon: Sun, matches: ['Solar Panel', 'On-Grid Inverter', 'Hybrid Inverter', 'Off-Grid Inverter'] },
    { cat: 'Battery', label: 'Batteries', icon: Battery, matches: ['Battery', 'Battery Box'] },
    { cat: 'Electrical', label: 'Electricals', icon: Zap, matches: ['ACDB', 'DCDB', 'Lightning Arrester', 'DC Cable', 'AC Cable', 'MC4 Connector', 'PVC Pipe / Conduit'] },
    { cat: 'Mounting', label: 'Mounting', icon: Wrench, matches: ['Mounting Structure'] },
    { cat: 'Earthing', label: 'Earthing', icon: Wrench, matches: ['Earthing Rod', 'Earthing Chemical'] },
    { cat: 'Services', label: 'Services', icon: Wrench, matches: ['Installation Service', 'Transportation', 'Maintenance'] },
    { cat: 'Others', label: 'Accessories', icon: Package, matches: ['Other Accessories'] }
]

const getCatIcon = (cat: string) => {
    if (cat.includes('Solar') || cat.includes('Inverter')) return Sun
    if (cat.includes('Battery')) return Battery
    if (cat.includes('Electrical') || cat.includes('Cable') || cat.includes('DB')) return Zap
    if (cat.includes('Earthing') || cat.includes('Mounting') || cat.includes('Service')) return Wrench
    return Package
}

export default function Products() {
    const { isSuperAdmin } = useAuth()

    const [products, setProducts] = useState<any[]>([])
    const [catFilter, setCatFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const navigate = useNavigate()

    const loadProducts = useCallback(async (silent = false) => {
        try {
            const data = await api('GET', '/api/products', undefined, silent)
            setProducts(data || [])
        } catch { setProducts([]) }
    }, [])

    useEffect(() => {
        loadProducts()
        const intv = setInterval(() => loadProducts(true), 300000)
        return () => clearInterval(intv)
    }, [loadProducts])

    const filtered = products
        .filter(p => {
            let matchCat = false
            if (catFilter === 'all') matchCat = true
            else {
                const tab = FILTER_TABS.find(t => t.cat === catFilter)
                if (tab && tab.matches && tab.matches.includes(p.category)) matchCat = true
            }
            
            const s = search.toLowerCase()
            const matchSearch = !s || (p.name || '').toLowerCase().includes(s) || (p.category || '').toLowerCase().includes(s) || (p.sku || '').toLowerCase().includes(s) || (p.manufacturer || '').toLowerCase().includes(s)
            return matchCat && matchSearch
        })
        .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))

    const { totalPages, pageSize: perPage } = usePagination(filtered.length, 10)
    const paginated = filtered.slice((page - 1) * perPage, page * perPage)

    const stats = {
        total: products.length,
        lowStock: products.filter(p => p.productType !== 'Service Item' && Number(p.stock || 0) < Number(p.minStock || 10)).length,
        totalValue: products.reduce((s, p) => s + Number(p.netPrice || p.price || 0) * Number(p.stock || 0), 0),
        topCategory: (() => {
            const cats: Record<string, number> = {}
            products.forEach(p => { cats[p.category || 'Other'] = (cats[p.category || 'Other'] || 0) + 1 })
            return Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
        })()
    }

    const deleteProduct = async (id: string) => {
        if (!confirm('Delete this product?')) return
        try { await api('DELETE', `/api/products/${id}`, null); toast('Deleted'); loadProducts() }
        catch { toast('Delete failed', 'error') }
    }

    return (
        <div className="page active" id="products-page">
            <div className="breadcrumb"><a href="#" onClick={e => { e.preventDefault(); navigate('/dashboard') }}>Home</a><span className="bc-sep">›</span><span className="bc-cur">Products</span></div>
            <div className="ph">
                <div><h2>Product Master</h2><div className="sub">Manage inventory, services, components and technical specifications.</div></div>
                <div className="ph-actions">{isSuperAdmin() && <button className="btn btn-primary" onClick={() => navigate('/products/new')}><Plus size={14} /> Add Product</button>}</div>
            </div>

            {/* Stats */}
            <div className="kpi-grid" style={{ marginBottom: 20 }}>
                <div className="kpi-card"><div className="kpi-top"><div className="kpi-label">Total Items</div><div className="kpi-icon ki-blue"><Package /></div></div><div className="kpi-val">{stats.total}</div><div className="kpi-delta"><span className="desc txt-muted">items in catalog</span></div></div>
                <div className="kpi-card"><div className="kpi-top"><div className="kpi-label">Low Stock</div><div className="kpi-icon ki-red"><AlertTriangle /></div></div><div className="kpi-val">{stats.lowStock}</div><div className="kpi-delta"><span className="kpi-alert">items need restock</span></div></div>
                <div className="kpi-card"><div className="kpi-top"><div className="kpi-label">Inventory Value</div><div className="kpi-icon ki-green"><Banknote /></div></div><div className="kpi-val">{fmt(stats.totalValue)}</div><div className="kpi-delta"><span className="desc txt-muted">total net cost</span></div></div>
                <div className="kpi-card"><div className="kpi-top"><div className="kpi-label">Top Category</div><div className="kpi-icon ki-orange"><Star /></div></div><div className="kpi-val" style={{ fontSize: 18 }}>{stats.topCategory}</div><div className="kpi-delta"></div></div>
            </div>

            {/* Filter tabs */}
            <div className="ftabs" id="productFilterTabs" style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: '4px' }}>
                {FILTER_TABS.map(t => (
                    <button key={t.cat} className={`ftab ${catFilter === t.cat ? 'active' : ''}`} onClick={() => setCatFilter(t.cat)}>
                        {t.icon && <t.icon className="ftab-icon" />} {t.label}
                    </button>
                ))}
                <div className="ftab-actions lm-auto">
                    <div className="sbox"><Search className="si" /><input type="text" id="prodSearch" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                </div>
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
                <div className="tw">
                    <table className="tbl" id="productsTable">
                        <thead>
                            <tr>
                                <th>Product Details</th>
                                <th>Category / Type</th>
                                <th>Stock & Unit</th>
                                {isSuperAdmin() && <th>Net Price</th>}
                                <th>Selling Price</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="productsBody">
                            {paginated.length === 0 ? (
                                <tr><td colSpan={isSuperAdmin() ? 7 : 6} className="empty-state">No products found</td></tr>
                            ) : paginated.map((p: any) => {
                                const Icon = getCatIcon(p.category || '')
                                const isService = p.productType === 'Service Item'
                                const low = !isService && Number(p.stock || 0) <= Number(p.reorderLevel || p.minStock || 0)
                                return (
                                    <tr
                                        key={p.id}
                                        className={isSuperAdmin() ? "tr-clickable" : ""}
                                        onClick={() => isSuperAdmin() && navigate(`/products/${p.id}/edit`)}
                                        tabIndex={isSuperAdmin() ? 0 : undefined}
                                        role={isSuperAdmin() ? "button" : undefined}
                                        onKeyDown={(e) => { if (isSuperAdmin() && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); navigate(`/products/${p.id}/edit`); } }}
                                    >
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <Icon size={16} color="var(--g500)" />
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <strong>{p.name}</strong>
                                                    <span style={{ fontSize: 11, color: 'var(--g400)' }}>
                                                        {p.sku || p.id.split('-')[0]} {p.manufacturer ? `• ${p.manufacturer}` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span>{p.category || '—'}</span>
                                                <span style={{ fontSize: 11, color: 'var(--g500)' }}>{p.productType || 'Stock Item'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            {isService ? (
                                                <span style={{ color: 'var(--g400)' }}>N/A</span>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span className={low ? 'text-danger' : ''} style={{ fontWeight: 600 }}>{p.stock ?? 0}</span>
                                                    <span style={{ fontSize: 11, color: 'var(--g500)' }}>{p.unit || 'Nos'}</span>
                                                </div>
                                            )}
                                        </td>
                                        {isSuperAdmin() && <td>{fmt(p.netPrice || 0)}</td>}
                                        <td><strong style={{ color: 'var(--g800)' }}>{fmt(p.sellingPrice || p.price || 0)}</strong></td>
                                        <td>
                                            {p.productStatus === 'Inactive' ? (
                                                <span className="badge" style={{ backgroundColor: 'var(--g200)', color: 'var(--g700)' }}>Inactive</span>
                                            ) : isService ? (
                                                <span className="badge b-blue">Service</span>
                                            ) : (
                                                <span className={`badge ${low ? 'b-red' : 'b-green'}`}>{low ? 'Reorder' : 'In Stock'}</span>
                                            )}
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            {isSuperAdmin() && <button className="abl abl-orange" onClick={() => navigate(`/products/${p.id}/edit`)}><Pencil size={12} /> Edit</button>}
                                            <button className="abl abl-red" onClick={() => deleteProduct(p.id)}><Trash2 size={12} /> Delete</button>
                                        </td>
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
