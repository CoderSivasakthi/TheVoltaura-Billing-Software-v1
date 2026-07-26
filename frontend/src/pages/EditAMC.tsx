import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, X, Plus, Trash2 } from 'lucide-react'
import { api, toast } from '../services/api'

const EQUIPMENT_CATEGORIES = [
    'Solar Panels', 'Inverter', 'Battery', 'ACDB', 'DCDB', 'MCB',
    'Earthing Kit', 'Earthing Rod', 'DC Cable', 'Wiring', 'Mounting Structure', 'Lightning Arrester'
]

const EQUIPMENT_OPTIONS: Record<string, string[]> = {
    'Solar Panels': ['350Wp', '400Wp', '450Wp', '500Wp', '550Wp', '600Wp', '650Wp', '700Wp', '730Wp'],
    'Inverter': ['Micro Inverter', 'String Inverter', 'Hybrid Inverter', 'Central Inverter'],
    'Battery': ['Lithium Battery', 'Lead Acid Battery', 'Gel Battery'],
    'ACDB': ['Single Phase ACDB', 'Three Phase ACDB', 'Custom'],
    'DCDB': ['Standard DCDB', 'Custom DCDB'],
    'MCB': ['6A', '10A', '16A', '20A', '32A', '63A'],
    'Earthing Kit': ['Chemical Earthing', 'Pipe Earthing', 'Plate Earthing'],
    'Earthing Rod': ['Copper', 'GI', 'Copper Bonded'],
    'DC Cable': ['4 sqmm', '6 sqmm', '10 sqmm', '16 sqmm'],
    'Wiring': ['Copper Wire', 'Aluminium Wire', 'Solar Cable'],
    'Mounting Structure': ['GI Structure', 'GB Structure', 'Aluminium Structure', 'Hot Dip Galvanized', 'Custom'],
    'Lightning Arrester': ['Type 1', 'Type 2', 'Type 3']
}

export default function EditAMC() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(!!id)

    const [form, setForm] = useState({
        vendorName: '', vendorContact: '', companyName: '', vendorEmail: '', vendorAddress: '',
        contractStartDate: '', amcStartDate: '', contractEndDate: '', amcExpiryDate: '', agreementDate: '',
        amcContractValue: 0, gst: 0, paymentTerms: '',
        equipment: [] as any[]
    })

    const loadAMC = useCallback(async () => {
        if (!id) return
        try {
            const data = await api('GET', `/api/amc/${id}`)
            if (data) setForm(prev => ({ ...prev, ...data, equipment: data.equipment || [] }))
        } catch { toast('AMC contract not found', 'error'); navigate('/amc') }
        finally { setLoading(false) }
    }, [id, navigate])

    useEffect(() => { loadAMC() }, [loadAMC])

    // Math calculation for days left
    const expDate = new Date(form.amcExpiryDate).getTime()
    const daysLeft = form.amcExpiryDate ? Math.ceil((expDate - Date.now()) / 86400000) : null
    let localStatus = 'Active'
    if (daysLeft !== null) {
        if (daysLeft < 0) localStatus = 'Expired'
        else if (daysLeft <= 30) localStatus = 'Expiring Soon'
    }

    const totalContractValue = (Number(form.amcContractValue) || 0) + (Number(form.gst) || 0)

    // Maps AMC equipment type → inventory category
    const AMC_CATEGORY_MAP: Record<string, string> = {
        'ACDB': 'Connectors',
        'DCDB': 'Connectors',
        'MCB': 'Connectors',
        'Solar Panels': 'Panels',
        'Inverter': 'Inverters',
        'Battery': 'Batteries',
        'Earthing Kit': 'Earthing',
        'Earthing Rod': 'Earthing',
        'Mounting Structure': 'Mounting Structures',
        'DC Cable': 'Connectors',
        'Wiring': 'Connectors',
        'Lightning Arrester': 'Others',
    }

    const syncEquipmentToInventory = async (equipmentList: any[]) => {
        try {
            const existingProducts: any[] = await api('GET', '/api/products').catch(() => [])

            for (const eq of equipmentList) {
                if (!eq.equipmentName || !eq.equipmentType) continue

                // Product Name = Brand + Specification
                const productName = [eq.equipmentName, eq.specification].filter(Boolean).join(' ').trim()
                const qty = Number(eq.quantity) || 1

                // Unique key = Type + Brand + Specification
                const uniqueKey = `${eq.equipmentType}|${(eq.equipmentName || '').toLowerCase()}|${(eq.specification || '').toLowerCase()}`
                const existing = (existingProducts || []).find((p: any) =>
                    `${p.equipmentType || p.type || ''}|${(p.brand || '').toLowerCase()}|${(p.description?.match(/Spec: ([^.]+)/) || [])[1]?.trim()?.toLowerCase() || ''}` === uniqueKey ||
                    // Also match by exact product name + brand (simpler fallback)
                    ((p.name || '').toLowerCase() === productName.toLowerCase() &&
                        (p.brand || '').toLowerCase() === (eq.equipmentName || '').toLowerCase())
                )

                const category = AMC_CATEGORY_MAP[eq.equipmentType] || 'Others'

                if (existing) {
                    // Update stock if product already exists
                    await api('PUT', `/api/products/${existing.id}`, {
                        ...existing,
                        stock: Math.max(Number(existing.stock || 0), qty),
                    }).catch(() => { /* silently skip */ })
                } else {
                    // Create new inventory product
                    await api('POST', '/api/products', {
                        name: productName,
                        brand: eq.equipmentName,
                        category,
                        sku: '',
                        gstRate: 18,
                        price: 0,
                        stock: qty,
                        hsnCode: '',
                        description: `Type: ${eq.equipmentType}. Spec: ${eq.specification || '—'}. Source: AMC Contract`,
                        // Store keys for future duplicate detection
                        equipmentType: eq.equipmentType,
                    }).catch(() => { /* silently skip */ })
                }
            }
        } catch { /* silently fail — inventory sync is non-blocking */ }
    }


    const handleSave = async () => {
        if (!form.vendorName.trim()) { toast('Vendor Name is required', 'error'); return }
        if (form.equipment.length === 0) { toast('Add at least one equipment item', 'error'); return }
        for (const eq of form.equipment) {
            if (!eq.equipmentName || !eq.equipmentName.trim()) { toast('Equipment Name is required', 'error'); return }
            if (!eq.quantity || Number(eq.quantity) <= 0) { toast('Invalid equipment quantity', 'error'); return }
        }

        const payload = { ...form, totalContractValue }
        try {
            if (id) {
                await api('PUT', `/api/amc/${id}`, payload)
                toast('AMC updated')
            } else {
                await api('POST', '/api/amc', payload)
                toast('AMC created')
            }
            // Sync equipment → inventory in background (non-blocking)
            syncEquipmentToInventory(form.equipment)
            navigate('/amc')
        } catch { toast('Failed to save AMC', 'error') }
    }

    const addEq = () => setForm({ ...form, equipment: [...form.equipment, { equipmentType: 'Solar Panels', equipmentName: '', specification: '', quantity: 1 }] })
    const rmEq = (i: number) => setForm({ ...form, equipment: form.equipment.filter((_, idx) => idx !== i) })
    const updEq = (i: number, field: string, val: string) => {
        const ne = [...form.equipment]
        ne[i][field] = val
        if (field === 'equipmentType') { ne[i].specification = '' } // Reset spec when type changes
        setForm({ ...form, equipment: ne })
    }

    if (loading) return <div className="page active" style={{ padding: 40, textAlign: 'center' }}>Loading...</div>

    return (
        <div className="page active" id="edit-amc-page">
            <div className="inv-pg-hdr">
                <div className="breadcrumb"><a href="#" onClick={e => { e.preventDefault(); navigate('/amc') }}>← Back to AMCs</a></div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/amc')}><X size={14} /> Cancel</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSave}><Save size={14} /> Save Contract</button>
                </div>
            </div>

            <div className="inv-title-row">
                <h2>{id ? `Edit AMC: ${form.vendorName}` : 'New Vendor AMC Contract'}</h2>
            </div>

            <div className="inv-doc">
                <div className="inv-doc-bar"></div>
                <div className="inv-doc-body" style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 40 }}>

                    {/* Section A */}
                    <section>
                        <h3 style={{ fontSize: 16, borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 16 }}>Section A — Vendor Information</h3>
                        <div className="fr2">
                            <div className="fg"><label className="fl">Vendor Name *</label><input className="fi" value={form.vendorName} onChange={e => setForm({ ...form, vendorName: e.target.value })} /></div>
                            <div className="fg"><label className="fl">Company Name</label><input className="fi" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} /></div>
                        </div>
                        <div className="fr2">
                            <div className="fg"><label className="fl">Contact Number</label><input className="fi" value={form.vendorContact} onChange={e => setForm({ ...form, vendorContact: e.target.value })} /></div>
                            <div className="fg"><label className="fl">Email</label><input className="fi" type="email" value={form.vendorEmail} onChange={e => setForm({ ...form, vendorEmail: e.target.value })} /></div>
                        </div>
                        <div className="fg">
                            <label className="fl">Vendor Address</label>
                            <textarea className="fi" value={form.vendorAddress} onChange={e => setForm({ ...form, vendorAddress: e.target.value })} rows={2}></textarea>
                        </div>
                    </section>


                    {/* Section C */}
                    <section>
                        <h3 style={{ fontSize: 16, borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 16 }}>Section C — Contract Dates</h3>
                        <div className="fr2">
                            <div className="fg"><label className="fl">Agreement Date</label><input className="fi" type="date" value={form.agreementDate} onChange={e => setForm({ ...form, agreementDate: e.target.value })} /></div>
                            <div className="fg"><label className="fl">Remaining Days (Auto)</label><input className="fi" disabled value={daysLeft !== null ? `${daysLeft} days (${localStatus})` : '—'} style={{ background: '#f9fafb', fontWeight: 600, color: daysLeft !== null && daysLeft < 0 ? 'var(--red)' : '' }} /></div>
                        </div>
                        <div className="fr2" style={{ gap: 16 }}>
                            <div className="fg"><label className="fl">Contract Start</label><input className="fi" type="date" value={form.contractStartDate} onChange={e => setForm({ ...form, contractStartDate: e.target.value })} /></div>
                            <div className="fg"><label className="fl">Contract End</label><input className="fi" type="date" value={form.contractEndDate} onChange={e => setForm({ ...form, contractEndDate: e.target.value })} /></div>
                            <div className="fg"><label className="fl">AMC Start</label><input className="fi" type="date" value={form.amcStartDate} onChange={e => setForm({ ...form, amcStartDate: e.target.value })} /></div>
                            <div className="fg"><label className="fl">AMC Expiry</label><input className="fi" type="date" value={form.amcExpiryDate} onChange={e => setForm({ ...form, amcExpiryDate: e.target.value })} /></div>
                        </div>
                    </section>

                    {/* Section D */}
                    <section>
                        <h3 style={{ fontSize: 16, borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Section D — Equipment Covered</span>
                            <button className="btn btn-secondary btn-sm" onClick={addEq}><Plus size={14} /> Add Equipment</button>
                        </h3>
                        {form.equipment.length === 0 && <div style={{ color: 'var(--g400)', fontSize: 13 }}>No equipment added. Click "Add Equipment".</div>}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {form.equipment.map((eq, i) => (
                                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                    <div style={{ flex: '1 1 200px' }}>
                                        <select className="fi" value={eq.equipmentType} onChange={e => updEq(i, 'equipmentType', e.target.value)}>
                                            {EQUIPMENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ flex: '1 1 200px' }}>
                                        <input className="fi" placeholder="Brand / Name *" value={eq.equipmentName} onChange={e => updEq(i, 'equipmentName', e.target.value)} />
                                    </div>
                                    <div style={{ flex: '1 1 200px' }}>
                                        <input className="fi" list={`spec-${i}`} placeholder="Capacity / Spec" value={eq.specification || ''} onChange={e => updEq(i, 'specification', e.target.value)} />
                                        <datalist id={`spec-${i}`}>
                                            {(EQUIPMENT_OPTIONS[eq.equipmentType] || []).map(opt => <option key={opt} value={opt} />)}
                                        </datalist>
                                    </div>
                                    <div style={{ flex: '1 1 100px' }}>
                                        <input className="fi" type="number" min="1" placeholder="Qty *" value={eq.quantity || ''} onChange={e => updEq(i, 'quantity', e.target.value)} />
                                    </div>
                                    <button className="btn btn-secondary" style={{ padding: '8px 12px', border: 'none', background: '#fee2e2', color: '#ef4444', flex: '0 0 auto' }} onClick={() => rmEq(i)}><Trash2 size={16} /></button>
                                </div>
                            ))}
                        </div>
                    </section>


                    {/* Section F */}
                    <section>
                        <h3 style={{ fontSize: 16, borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 16 }}>Section F — Financial Details</h3>
                        <div className="fr2">
                            <div className="fg"><label className="fl">AMC Contract Value</label><input className="fi" type="number" value={form.amcContractValue || ''} onChange={e => setForm({ ...form, amcContractValue: Number(e.target.value) })} /></div>
                            <div className="fg"><label className="fl">GST Amount</label><input className="fi" type="number" value={form.gst || ''} onChange={e => setForm({ ...form, gst: Number(e.target.value) })} /></div>
                        </div>
                        <div className="fr2">
                            <div className="fg"><label className="fl">Total Contract Value (Auto)</label><input className="fi" disabled value={totalContractValue.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} style={{ background: '#f9fafb', fontWeight: 600 }} /></div>
                            <div className="fg"><label className="fl">Payment Terms</label><input className="fi" value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} placeholder="e.g., 100% Advance" /></div>
                        </div>
                    </section>

                    <div style={{ paddingTop: 20, borderTop: '1px solid var(--g100)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <button className="btn btn-ghost" onClick={() => navigate('/amc')}>Cancel</button>
                        <button className="btn btn-primary" style={{ padding: '10px 30px' }} onClick={handleSave}>
                            {id ? 'Update Contract' : 'Create Contract'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    )
}
