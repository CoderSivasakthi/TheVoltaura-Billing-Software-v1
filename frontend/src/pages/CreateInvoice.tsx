import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Settings, X, Plus, Copy, Save } from 'lucide-react'
import { api, fmt, toast, displayName } from '../services/api'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { SolarCalculationEngine, type LineItem } from '../services/SolarCalculationEngine'



export default function CreateInvoice() {
    const navigate = useNavigate()
    const { settings } = useSettings()
    const globalSettings = settings || {} as any
    const { user } = useAuth()
    const [customers, setCustomers] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])

    // Company Information
    const [companyBranchId, setCompanyBranchId] = useState('')
    const [companyGst, setCompanyGst] = useState('')
    const [companyAddress, setCompanyAddress] = useState('')

    // Form State
    const [customerId, setCustomerId] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [dueDate, setDueDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0]
    })
    const [supplyType, setSupplyType] = useState('intra')
    const [billingAddr, setBillingAddr] = useState('')
    const [appRegNo, setAppRegNo] = useState('')
    const [appSanctionNo, setAppSanctionNo] = useState('')
    const [tangedcoNo, setTangedcoNo] = useState('')
    const [dispatchedThrough, setDispatchedThrough] = useState('')
    const [lrRrNo, setLrRrNo] = useState('')

    // Form State - Items
    const ITEM_CATEGORIES = ['Panels', 'Inverters', 'Batteries', 'Connectors', 'Earthing', 'Mounting Structures', 'Lighting', 'Meters', 'Services', 'Others']
    const [items, setItems] = useState<LineItem[]>([{ id: '1', productId: '', productName: '', qty: 1, price: 0, gstRate: 18, hsnCode: '' }])
    const [itemCategories, setItemCategories] = useState<string[]>(['']) // one per item row, '' = show all

    // Form State - Calculations
    const [discount, setDiscount] = useState(0)
    const [splitGst, setSplitGst] = useState(true)
    const [roundOff, setRoundOff] = useState(true)

    useEffect(() => {
        api('GET', '/api/customers').then(d => setCustomers(d || [])).catch(() => { })
        api('GET', '/api/products').then(d => setProducts(d || [])).catch(() => { })
    }, [])

    useEffect(() => {
        if (user?.franchise_id) {
            setCompanyBranchId(user.franchise_id)
            setCompanyGst(user.franchise_gst || '')
            setCompanyAddress(user.franchise_address || '')
        } else if (globalSettings && globalSettings.branches && globalSettings.branches.length > 0) {
            setCompanyBranchId(globalSettings.branches[0].id)
            setCompanyGst(globalSettings.branches[0].gst)
            setCompanyAddress(globalSettings.branches[0].address)
        }
    }, [globalSettings, user])

    useEffect(() => {
        if (!customerId) return;
        const cust = customers.find(c => c.id === customerId);
        if (cust) {
            setBillingAddr(cust.address || cust.billingAddr || '');
            if (cust.state && cust.state.toLowerCase() !== (globalSettings?.state || 'tamil nadu').toLowerCase()) {
                setSupplyType('inter')
            } else {
                setSupplyType('intra')
            }
        }
    }, [customerId, customers, globalSettings])


    // Item Management
    const addItem = () => {
        setItems([...items, { id: Math.random().toString(), productId: '', productName: '', qty: 1, price: 0, gstRate: 18, hsnCode: '' }])
        setItemCategories([...itemCategories, ''])
    }
    const copyItem = (i: number) => {
        const itemToCopy = items[i];
        setItems([...items, { ...itemToCopy, id: Math.random().toString() }])
        setItemCategories([...itemCategories, itemCategories[i] || ''])
    }
    const removeItem = (i: number) => {
        if (items.length <= 1) return;
        setItems(items.filter((_, idx) => idx !== i))
        setItemCategories(itemCategories.filter((_, idx) => idx !== i))
    }

    const updateItem = (i: number, field: string, val: any) => {
        const newItems = [...items]
        if (field === 'productId') {
            const prod = products.find(p => p.id === val)
            if (prod) {
                let hsnCode = prod.hsnCode || prod.hsn || ''
                if (!hsnCode) {
                    for (const hCode of (globalSettings.hsnCodes || [])) {
                        if ((prod.name || '').toLowerCase().includes(hCode.category.toLowerCase())) {
                            hsnCode = hCode.code;
                            break;
                        }
                    }
                }
                const gstRate = Number(prod.gstRate || globalSettings.gstRate || 18)
                newItems[i] = { ...newItems[i], productId: val, productName: prod.name || '', price: Number(prod.sellingPrice || prod.price || 0), gstRate, hsnCode }
            } else {
                newItems[i] = { ...newItems[i], productId: '', productName: '', price: 0, gstRate: Number(globalSettings.gstRate || 18), hsnCode: '' }
            }
        } else if (field === 'productName') {
            newItems[i].productName = val;
            newItems[i].productId = '';
            let matchedHsn = ''
            for (const hCode of (globalSettings.hsnCodes || [])) {
                if (hCode.category && val.toLowerCase().includes(hCode.category.toLowerCase())) {
                    matchedHsn = hCode.code;
                    break;
                }
            }
            if (matchedHsn) newItems[i].hsnCode = matchedHsn;
        } else {
            (newItems[i] as any)[field] = field === 'qty' || field === 'price' || field === 'gstRate' ? Number(val) : val
        }
        setItems(newItems)
    }

    const calc = SolarCalculationEngine.calculateDocument(items, discount, splitGst, roundOff);
    const {
        subtotal,
        totalGst,
        gstBreakdown,
        grandTotal,
        roundOffAmount
    } = calc;
    
    let blendedRate = 0;
    if (splitGst) {
        blendedRate = calc.taxableAmount > 0 ? (calc.totalGst / calc.taxableAmount) * 100 : 0;
    } else {
        blendedRate = items.length > 0 ? items.reduce((avg, it) => avg + (it.gstRate / items.length), 0) : 0;
    }


    const saveInvoice = async () => {
        if (!customerId) { toast('Select a customer', 'error'); return }
        if (items.every(it => !it.productName && !it.productId)) { toast('Add at least one product', 'error'); return }

        const cust = customers.find(c => c.id === customerId)
        const payload = {
            companyBranchId,
            companyGst,
            companyAddress,
            customerId,
            customerName: displayName(cust?.name || cust),
            date,
            dueDate,
            supplyType,
            status: 'Pending',
            appRegNo,
            appSanctionNo,
            tangedcoNo,
            dispatchedThrough,
            lrRrNo,
            items: items.filter(it => it.productName || it.productId),
            subtotal,
            totalTax: totalGst,
            gst: totalGst,
            discount,
            grandTotal,
            total: grandTotal
        }

        try {
            const saved = await api('POST', '/api/invoices', payload)
            toast('Invoice created successfully!')
            navigate(`/invoices/${saved.id}`)
        } catch { toast('Failed to save invoice', 'error') }
    }

    const s_card = { background: '#fff', borderRadius: '12px', border: '1px solid var(--g200)', padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', marginBottom: '24px' };
    const s_input = { border: '1px solid var(--g200)', borderRadius: '6px', padding: '10px 14px', width: '100%', fontSize: '13.5px', outline: 'none', backgroundColor: '#fff', color: 'var(--g800)' };
    const s_label = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--g500)', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' };

    return (
        <div className="page active" style={{ backgroundColor: '#F9FAFB', minHeight: '100vh', padding: '32px' }}>
            <div className="breadcrumb">
                <a href="#" onClick={e => { e.preventDefault(); navigate('/invoices') }}>Invoices</a>
                <span className="bc-sep">›</span><span className="bc-cur">New Invoice</span>
            </div>

            <div className="ph" style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h2 style={{ fontSize: '28px', color: '#111827', margin: 0 }}>Create Invoice</h2>
                    <span className="badge" style={{ backgroundColor: '#FEF3C7', color: '#D97706', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700 }}>DRAFT</span>
                </div>
            </div>

            <div className="doc-layout">
                <div style={{ flex: 1, minWidth: 0 }}>

                    {/* Section 1: Client Details Panel */}
                    <div style={s_card}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F59E0B', fontWeight: 600, fontSize: '16px' }}>
                                <User size={18} /> Invoice Details
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/customers/new')}><Plus size={14} /> New Client</button>
                        </div>
                        <div className="fr3">
                            <div>
                                <label style={s_label}>Customer *</label>
                                <select style={s_input} value={customerId} onChange={e => setCustomerId(e.target.value)}>
                                    <option value="">Select customer...</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{displayName(c.name || c)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={s_label}>Invoice Date</label>
                                <input type="date" style={s_input} value={date} onChange={e => setDate(e.target.value)} />
                            </div>
                            <div>
                                <label style={s_label}>Due Date</label>
                                <input type="date" style={s_input} value={dueDate} onChange={e => setDueDate(e.target.value)} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={s_label}>Billing Address</label>
                                <input style={s_input} value={billingAddr} onChange={e => setBillingAddr(e.target.value)} placeholder="Full billing address..." />
                            </div>
                            <div>
                                <label style={s_label}>Supply Type</label>
                                <select style={s_input} value={supplyType} onChange={e => setSupplyType(e.target.value)}>
                                    <option value="intra">Intra-State (CGST+SGST)</option>
                                    <option value="inter">Inter-State (IGST)</option>
                                </select>
                            </div>
                            <div>
                                <label style={s_label}>App Reg. No.</label>
                                <input style={s_input} value={appRegNo} onChange={e => setAppRegNo(e.target.value)} placeholder="Registration No..." />
                            </div>
                            <div>
                                <label style={s_label}>App Sanction No.</label>
                                <input style={s_input} value={appSanctionNo} onChange={e => setAppSanctionNo(e.target.value)} placeholder="Sanction No..." />
                            </div>
                            <div>
                                <label style={s_label}>TANGEDCO Service No.</label>
                                <input style={s_input} value={tangedcoNo} onChange={e => setTangedcoNo(e.target.value)} placeholder="Service No..." />
                            </div>
                            <div>
                                <label style={s_label}>Sent Through</label>
                                <input style={s_input} value={dispatchedThrough} onChange={e => setDispatchedThrough(e.target.value)} placeholder="Carrier Name..." />
                            </div>
                            <div>
                                <label style={s_label}>L.R/R.R No.</label>
                                <input style={s_input} value={lrRrNo} onChange={e => setLrRrNo(e.target.value)} placeholder="LR/RR Number..." />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Line Items */}
                    <div style={{ ...s_card, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', backgroundColor: '#fff', borderBottom: '1px solid var(--g200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F59E0B', fontWeight: 600, fontSize: '16px' }}>
                                <Settings size={18} /> Product / Line Items
                            </div>
                        </div>
                        <div className="tw">
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--g50)', borderBottom: '1px solid var(--g200)' }}>
                                        <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--g500)', textTransform: 'uppercase' }}>Description / Item</th>
                                        <th style={{ padding: '12px', fontSize: '12px', fontWeight: 600, color: 'var(--g500)', textTransform: 'uppercase', width: '90px' }}>HSN</th>
                                        <th style={{ padding: '12px', fontSize: '12px', fontWeight: 600, color: 'var(--g500)', textTransform: 'uppercase', width: '90px' }}>Qty</th>
                                        <th style={{ padding: '12px', fontSize: '12px', fontWeight: 600, color: 'var(--g500)', textTransform: 'uppercase', width: '140px' }}>Unit rate (₹)</th>
                                        <th style={{ padding: '12px', fontSize: '12px', fontWeight: 600, color: 'var(--g500)', textTransform: 'uppercase', width: '100px' }}>GST %</th>
                                        <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--g500)', textTransform: 'uppercase', width: '140px', textAlign: 'right' }}>Amount</th>
                                        <th style={{ padding: '12px', width: '80px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((it, i) => (
                                        <tr key={it.id} style={{ borderBottom: '1px solid var(--g100)' }}>
                                            <td style={{ padding: '12px 24px' }}>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <select
                                                        style={{ ...s_input, fontSize: '12px', padding: '5px 10px', color: 'var(--g600)', backgroundColor: 'var(--g50)' }}
                                                        value={itemCategories[i] || ''}
                                                        onChange={e => {
                                                            const cats = [...itemCategories]
                                                            cats[i] = e.target.value
                                                            setItemCategories(cats)
                                                            if (items[i].productId) updateItem(i, 'productId', '')
                                                        }}
                                                    >
                                                        <option value="">All Categories</option>
                                                        {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                    <select style={s_input} value={it.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                                                        <option value="">-- Select from Inventory --</option>
                                                        {products
                                                            .filter((p: any) => !itemCategories[i] || (p.category || '') === itemCategories[i])
                                                            .map((p: any) => <option key={p.id} value={p.id}>{displayName(p.name || p)}</option>)
                                                        }
                                                    </select>
                                                    <input style={{ ...s_input, fontSize: '13px', padding: '6px 10px', backgroundColor: it.productId ? 'var(--g50)' : '#fff', color: 'var(--g700)' }} placeholder={it.productId ? 'Description auto-filled' : 'Or type custom item description...'} value={it.productName} onChange={e => updateItem(i, 'productName', e.target.value)} readOnly={!!it.productId} />
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <input style={{ ...s_input, textAlign: 'center', backgroundColor: 'var(--g50)', color: 'var(--g600)' }} type="text" value={it.hsnCode} readOnly title="Auto-mapped from Product/Settings" placeholder="HSN" />
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <input className="no-spinners" style={{ ...s_input, textAlign: 'center' }} type="number" min="1" value={it.qty} onChange={e => updateItem(i, 'qty', e.target.value)} onWheel={e => e.currentTarget.blur()} />
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <input className="no-spinners" style={s_input} type="number" min="0" value={it.price} onChange={e => updateItem(i, 'price', e.target.value)} onWheel={e => e.currentTarget.blur()} />
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <select style={s_input} value={it.gstRate} onChange={e => updateItem(i, 'gstRate', e.target.value)}>
                                                    {(globalSettings?.taxRates || [{ id: '1', rate: 18, label: '18%' }]).map((t: any) => (
                                                        <option key={t.id} value={t.rate}>{t.rate}%</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ padding: '12px 24px', textAlign: 'right', fontWeight: 600, color: 'var(--g900)' }}>
                                                {fmt(it.qty * it.price)}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button onClick={() => copyItem(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--g500)', padding: '4px' }} title="Duplicate"><Copy size={16} /></button>
                                                    <button onClick={() => removeItem(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', padding: '4px' }} title="Remove"><X size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '16px 24px', backgroundColor: '#fff' }}>
                            <button onClick={addItem} style={{ width: '100%', padding: '12px', border: 'none', color: '#fff', backgroundColor: '#F97316', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(249, 115, 22, 0.2)' }}><Plus size={18} /> Add New Line Item</button>
                        </div>
                    </div>

                </div>

                {/* Section 4: Auto Calculation Logic (Sidebar Panel) */}
                <div className="doc-sidebar">
                    <div style={{ ...s_card, position: 'sticky', top: '24px', padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '20px', backgroundColor: '#1F2937', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, fontSize: '16px' }}>Invoice Summary</span>
                        </div>
                        <div style={{ padding: '24px' }}>

                            {/* Summary Rows */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                                <span style={{ color: 'var(--g600)' }}>Subtotal</span>
                                <span style={{ fontWeight: 600 }}>{fmt(subtotal)}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                                <span style={{ color: 'var(--g600)', fontSize: '14px' }}>Discount (₹)</span>
                                <input type="number" style={{ ...s_input, width: '100px', padding: '6px 10px', textAlign: 'right' }} value={discount} onChange={e => setDiscount(Number(e.target.value) || 0)} min={0} />
                            </div>

                            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--g200)', margin: '16px 0' }}></div>

                            {/* Options */}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '13px', color: 'var(--g700)' }}>
                                <input type="checkbox" checked={splitGst} onChange={e => setSplitGst(e.target.checked)} />
                                Apply MNRE Split GST (70% @ 5%, 30% @ 18%)
                            </label>

                            {/* GST Summary - always visible */}
                            {splitGst ? (
                                <div style={{ backgroundColor: 'var(--orange-pale)', borderRadius: '8px', padding: '12px', marginBottom: '16px', border: '1px solid var(--orange-lt)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#D97706', marginBottom: '8px', textTransform: 'uppercase' }}>GST Breakdown (MNRE Solar Split)</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--g700)', marginBottom: '4px' }}>
                                        <span>CGST @ 2.5% + SGST @ 2.5% (70%)</span>
                                        <span>{fmt(gstBreakdown.cgst5 + gstBreakdown.sgst5)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--g700)', marginBottom: '4px' }}>
                                        <span>CGST @ 9% + SGST @ 9% (30%)</span>
                                        <span>{fmt(gstBreakdown.cgst18 + gstBreakdown.sgst18)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#D97706', borderTop: '1px solid var(--orange-lt)', marginTop: '8px', paddingTop: '8px' }}>
                                        <span>Total GST</span>
                                        <span>{fmt(totalGst)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px', padding: '10px 12px', backgroundColor: 'var(--g50)', borderRadius: '6px', border: '1px solid var(--g200)' }}>
                                    <span style={{ color: 'var(--g600)' }}>GST ({blendedRate.toFixed(1)}% avg)</span>
                                    <span style={{ fontWeight: 600 }}>{fmt(totalGst)}</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '13px', color: 'var(--g500)' }}>
                                <span>Blended Rate</span>
                                <span style={{ fontWeight: 600 }}>{blendedRate.toFixed(2)}%</span>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--g700)' }}>
                                <input type="checkbox" checked={roundOff} onChange={e => setRoundOff(e.target.checked)} />
                                Round off Total
                            </label>

                            {roundOff && roundOffAmount !== 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '13px', color: 'var(--g500)' }}>
                                    <span>Round off</span>
                                    <span>{roundOffAmount > 0 ? '+' : ''}{roundOffAmount.toFixed(2)}</span>
                                </div>
                            )}

                            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--g200)', margin: '16px 0' }}></div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'flex-end' }}>
                                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--g900)' }}>Grand Total</span>
                                <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--g900)' }}>{fmt(grandTotal)}</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button onClick={saveInvoice} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#F59E0B', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}><Save size={16} /> Save Invoice</button>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
