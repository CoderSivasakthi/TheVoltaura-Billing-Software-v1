import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { User, X, Package , Save} from 'lucide-react'
import { api, fmt, toast, displayName } from '../services/api'
import { SolarCalculationEngine, type LineItem } from '../services/SolarCalculationEngine'

export default function EditInvoice() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [customers, setCustomers] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [customerId, setCustomerId] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [dueDate, setDueDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0]
    })
    const [supplyType, setSupplyType] = useState('intra')
    const [appRegNo, setAppRegNo] = useState('')
    const [appSanctionNo, setAppSanctionNo] = useState('')
    const [tangedcoNo, setTangedcoNo] = useState('')
    const [dispatchedThrough, setDispatchedThrough] = useState('')
    const [lrRrNo, setLrRrNo] = useState('')
    const [items, setItems] = useState<LineItem[]>([{ productId: '', productName: '', qty: 1, price: 0, gstRate: 18 }])

    const loadInvoiceData = useCallback(async () => {
        try {
            const [custData, prodData, invData] = await Promise.all([
                api('GET', '/api/customers'),
                api('GET', '/api/products'),
                api('GET', `/api/invoices/${encodeURIComponent(id || '')}`)
            ])
            setCustomers(custData || [])
            setProducts(prodData || [])

            if (invData) {
                if (invData.status === 'Paid') {
                    toast('Cannot edit a fully paid invoice.', 'error')
                    navigate(`/invoices/${id}`)
                    return
                }

                setCustomerId(invData.customerId || '')
                setDate(invData.date?.split('T')[0] || invData.createdAt?.split('T')[0] || date)
                setDueDate(invData.dueDate?.split('T')[0] || dueDate)
                setSupplyType(invData.supplyType || 'intra')
                setAppRegNo(invData.appRegNo || '')
                setAppSanctionNo(invData.appSanctionNo || '')
                setTangedcoNo(invData.tangedcoNo || '')
                setDispatchedThrough(invData.dispatchedThrough || '')
                setLrRrNo(invData.lrRrNo || '')

                if (invData.items && invData.items.length > 0) {
                    setItems(invData.items.map((it: any) => ({
                        productId: it.productId || '',
                        productName: it.productName || it.name || '',
                        qty: Number(it.qty || 1),
                        price: Number(it.price || 0),
                        gstRate: Number(it.gstRate || 18)
                    })))
                }
            }
        } catch {
            toast('Failed to load invoice', 'error')
            navigate('/invoices')
        }
    }, [id, navigate])

    useEffect(() => {
        loadInvoiceData()
    }, [loadInvoiceData])

    const addItem = () => setItems([...items, { productId: '', productName: '', qty: 1, price: 0, gstRate: 18 }])
    const removeItem = (i: number) => items.length > 1 && setItems(items.filter((_, idx) => idx !== i))

    const updateItem = (i: number, field: string, val: any) => {
        const newItems = [...items]
        if (field === 'productId') {
            const prod = products.find(p => p.id === val)
            newItems[i] = { ...newItems[i], productId: val, productName: prod?.name || '', price: Number(prod?.price || 0), gstRate: Number(prod?.gstRate || 18) }
        } else {
            (newItems[i] as any)[field] = field === 'qty' || field === 'price' || field === 'gstRate' ? Number(val) : val
        }
        setItems(newItems)
    }

    const calc = SolarCalculationEngine.calculateDocument(items, 0, false, false);
    const { subtotal, totalGst, grandTotal } = calc;
    const halfGst = totalGst / 2;

    const updateInvoice = async () => {
        if (!customerId) { toast('Select a customer', 'error'); return }
        if (items.every(it => !it.productName && !it.productId)) { toast('Add at least one product', 'error'); return }
        const cust = customers.find(c => c.id === customerId)
        const payload = {
            customerId, customerName: displayName(cust?.name || cust), date, dueDate, supplyType, status: 'Pending',
            appRegNo, appSanctionNo, tangedcoNo, dispatchedThrough, lrRrNo,
            items: items.filter(it => it.productName || it.productId),
            subtotal, totalTax: totalGst, gst: totalGst, grandTotal, total: grandTotal
        }
        try {
            await api('PUT', `/api/invoices/${encodeURIComponent(id || '')}`, payload)
            toast('Invoice updated successfully')
            navigate(`/invoices/${id}`)
        } catch { toast('Failed to update invoice', 'error') }
    }

    return (
        <div className="page active" id="edit-invoice-page">
            <div className="breadcrumb">
                <a href="#" onClick={e => { e.preventDefault(); navigate('/invoices') }}>Invoices</a>
                <span className="bc-sep">›</span>
                <a href="#" onClick={e => { e.preventDefault(); navigate(`/invoices/${id}`) }}>{id}</a>
                <span className="bc-sep">›</span><span className="bc-cur">Edit</span>
            </div>
            <div className="ph">
                <div><h2>Edit Invoice #{id}</h2></div>
                <div className="ph-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/invoices/${id}`)}>Cancel</button>
                    <button className="btn btn-primary" onClick={updateInvoice}>Update Invoice</button>
                </div>
            </div>

            <div className="qt-layout">
                <div>
                    {/* Invoice Details Card */}
                    <div className="qc">
                        <div className="qch"><div className="ct"><User style={{ width: 16, marginRight: 6 }} /> Invoice Details</div></div>
                        <div className="qcb">
                            <div className="fr2">
                                <div className="fg"><label className="fl">Customer *</label>
                                    <select className="fi" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                                        <option value="">Select customer...</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{displayName(c.name || c)}</option>)}
                                    </select>
                                </div>
                                <div className="fg"><label className="fl">Invoice Date</label>
                                    <input className="fi" type="date" value={date} onChange={e => setDate(e.target.value)} />
                                </div>
                            </div>
                            <div className="fr2">
                                <div className="fg"><label className="fl">Supply Type</label>
                                    <select className="fi" value={supplyType} onChange={e => setSupplyType(e.target.value)}>
                                        <option value="intra">Intra-State (CGST+SGST)</option>
                                        <option value="inter">Inter-State (IGST)</option>
                                    </select>
                                </div>
                                <div className="fg"><label className="fl">Due Date</label>
                                    <input className="fi" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                                </div>
                            </div>
                            <div className="fr3" style={{ marginBottom: 16 }}>
                                <div className="fg" style={{ marginBottom: 0 }}><label className="fl">App Reg. No.</label>
                                    <input className="fi" value={appRegNo} onChange={e => setAppRegNo(e.target.value)} placeholder="Registration No..." />
                                </div>
                                <div className="fg" style={{ marginBottom: 0 }}><label className="fl">App Sanction No.</label>
                                    <input className="fi" value={appSanctionNo} onChange={e => setAppSanctionNo(e.target.value)} placeholder="Sanction No..." />
                                </div>
                                <div className="fg" style={{ marginBottom: 0 }}><label className="fl">TANGEDCO Service No.</label>
                                    <input className="fi" value={tangedcoNo} onChange={e => setTangedcoNo(e.target.value)} placeholder="Service No..." />
                                </div>
                            </div>
                            <div className="fr2" style={{ marginBottom: 0 }}>
                                <div className="fg" style={{ marginBottom: 0 }}><label className="fl">Sent Through</label>
                                    <input className="fi" value={dispatchedThrough} onChange={e => setDispatchedThrough(e.target.value)} placeholder="Carrier Name..." />
                                </div>
                                <div className="fg" style={{ marginBottom: 0 }}><label className="fl">L.R/R.R No.</label>
                                    <input className="fi" value={lrRrNo} onChange={e => setLrRrNo(e.target.value)} placeholder="LR/RR Number..." />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Line Items Card */}
                    <div className="qc">
                        <div className="qch"><div className="ct"><Package style={{ width: 16, marginRight: 6 }} /> Line Items</div></div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="li-tbl" style={{ minWidth: 650 }}>
                                <thead><tr>
                                    <th style={{ minWidth: 200 }}>Product</th>
                                    <th style={{ width: 70, textAlign: 'center' }}>Qty</th>
                                    <th style={{ width: 130 }}>Unit Price</th>
                                    <th style={{ width: 90 }}>GST %</th>
                                    <th style={{ width: 100, textAlign: 'right' }}>Amount</th>
                                    <th style={{ width: 40 }}></th>
                                </tr></thead>
                                <tbody>
                                    {items.map((it, i) => (
                                        <tr key={i}>
                                            <td>
                                                <select className="fi" value={it.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                                                    <option value="">Select product...</option>
                                                    {products.map(p => <option key={p.id} value={p.id}>{displayName(p.name || p)}</option>)}
                                                </select>
                                            </td>
                                            <td><input className="fi" type="number" min="1" style={{ width: 60, textAlign: 'center' }} value={it.qty} onChange={e => updateItem(i, 'qty', e.target.value)} /></td>
                                            <td><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span>₹</span><input className="fi" type="number" min="0" style={{ flex: 1 }} value={it.price} onChange={e => updateItem(i, 'price', e.target.value)} /></div></td>
                                            <td>
                                                <select className="fi" value={it.gstRate} onChange={e => updateItem(i, 'gstRate', e.target.value)}>
                                                    <option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
                                                </select>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(it.qty * it.price)}</td>
                                            <td><button className="li-del" onClick={() => removeItem(i)}><X style={{ width: 14, height: 14, color: 'var(--red)' }} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button className="add-li-btn" onClick={addItem}>+ Add Line Item</button>
                        </div>
                    </div>
                </div>

                {/* Totals Panel */}
                <div className="totals-panel">
                    <div className="card-title"><Save style={{ width: 16, marginRight: 6 }} /> Invoice Summary</div>
                    <div className="tot-row"><span className="txt-muted">Subtotal</span><strong>{fmt(subtotal)}</strong></div>
                    {supplyType === 'intra' ? (
                        <>
                            <div className="tot-row"><span className="txt-muted">CGST</span><strong>{fmt(halfGst)}</strong></div>
                            <div className="tot-row"><span className="txt-muted">SGST</span><strong>{fmt(halfGst)}</strong></div>
                        </>
                    ) : (
                        <div className="tot-row"><span className="txt-muted">IGST</span><strong>{fmt(totalGst)}</strong></div>
                    )}
                    <div className="tot-row divider"><span className="fw7">Grand Total</span></div>
                    <div className="tot-grand-val">{fmt(grandTotal)}</div>
                    <div style={{ marginTop: 20 }}>
                        <button className="btn-convert" onClick={updateInvoice}><Save style={{ width: 14, height: 14, marginRight: 6 }} /> Update Invoice</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
