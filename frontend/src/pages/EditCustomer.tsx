import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, X, User } from 'lucide-react'
import { api, toast } from '../services/api'

const CUSTOMER_TYPES = ['Residential', 'Commercial', 'Industrial', 'Government']
const CUSTOMER_CATEGORIES = ['New Lead', 'Existing Customer', 'AMC Customer', 'Distributor']
const REFERENCE_SOURCES = ['Website', 'Referral', 'Advertisement', 'Walk-in', 'Dealer']
const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal', 'Chandigarh', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry'
]

const emptyForm = () => ({
    // Basic
    name: '', phone: '', email: '', customerType: 'Residential', gstin: '',
    // Location
    city: '', state: '', pinCode: '', country: 'India',
    // Address
    address: '', installationAddress: '', sameAddress: false,
    // Business
    companyName: '', contactPerson: '', customerCategory: 'New Lead',
    // Additional
    referenceSource: '', notes: '', status: 'Active',
})

export default function EditCustomer() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(!!id)
    const [form, setForm] = useState(emptyForm())

    const loadCustomer = useCallback(async () => {
        if (!id) return
        try {
            const data = await api('GET', `/api/customers/${id}`)
            if (data) setForm({
                name: data.name || '',
                phone: data.phone || '',
                email: data.email || '',
                customerType: data.customerType || 'Residential',
                gstin: data.gstin || '',
                city: data.city || '',
                state: data.state || '',
                pinCode: data.pinCode || '',
                country: data.country || 'India',
                address: data.address || '',
                installationAddress: data.installationAddress || data.shippingAddress || '',
                sameAddress: false,
                companyName: data.companyName || '',
                contactPerson: data.contactPerson || '',
                customerCategory: data.customerCategory || 'New Lead',
                referenceSource: data.referenceSource || '',
                notes: data.notes || '',
                status: data.status || 'Active',
            })
        } catch { toast('Customer not found', 'error'); navigate('/customers') }
        finally { setLoading(false) }
    }, [id, navigate])

    useEffect(() => { loadCustomer() }, [loadCustomer])

    const set = (field: string, val: any) => setForm(f => ({ ...f, [field]: val }))

    const handleSameAddress = (checked: boolean) => {
        setForm(f => ({
            ...f,
            sameAddress: checked,
            installationAddress: checked ? f.address : f.installationAddress
        }))
    }

    // Keep installationAddress in sync while typing billing address when same is checked
    const handleAddressChange = (val: string) => {
        setForm(f => ({
            ...f,
            address: val,
            installationAddress: f.sameAddress ? val : f.installationAddress
        }))
    }

    const saveCustomer = async () => {
        if (!form.name.trim()) { toast('Customer name is required', 'error'); return }
        if (!form.phone.trim()) { toast('Phone number is required', 'error'); return }
        if (!/^\d{10}$/.test(form.phone.replace(/\s/g, ''))) {
            toast('Phone must be a 10-digit number', 'error'); return
        }
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            toast('Please enter a valid email address', 'error'); return
        }
        if (!form.city.trim()) { toast('City is required', 'error'); return }
        if (!form.address.trim()) { toast('Billing address is required', 'error'); return }

        const payload = { ...form }
            // Map installationAddress to shippingAddress for backward compatibility
            ; (payload as any).shippingAddress = form.installationAddress

        try {
            if (id) {
                await api('PUT', `/api/customers/${id}`, payload)
                toast('Customer updated')
            } else {
                await api('POST', '/api/customers', payload)
                toast('Customer added')
            }
            navigate('/customers')
        } catch { toast('Failed to save customer', 'error') }
    }

    if (loading) return <div className="page active" style={{ padding: 40, textAlign: 'center', color: 'var(--g400)' }}>Loading customer details...</div>

    const S: React.CSSProperties = { fontSize: 15, fontWeight: 700, borderBottom: '1px solid var(--g100)', paddingBottom: 10, marginBottom: 18, marginTop: 4, color: 'var(--g800)', display: 'flex', alignItems: 'center', gap: 8 }

    return (
        <div className="page active" id="edit-customer-page">
            <div className="inv-pg-hdr">
                <div className="breadcrumb">
                    <a href="#" onClick={e => { e.preventDefault(); navigate('/customers') }}>← Back to Customers</a>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/customers')}>
                        <X size={14} /> Cancel
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={saveCustomer}>
                        <Save size={14} /> {id ? 'Update Customer' : 'Save Customer'}
                    </button>
                </div>
            </div>

            <div className="inv-title-row">
                <h2>{id ? `Edit Customer: ${form.name}` : 'Add New Customer'}</h2>
            </div>

            <div className="inv-doc">
                <div className="inv-doc-bar" />
                <div className="inv-doc-body" style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 32 }}>

                    {/* Section A — Basic Information */}
                    <section>
                        <div style={S}><User size={15} /> Section A — Basic Information</div>
                        <div className="fr2">
                            <div className="fg">
                                <label className="fl">Customer Name *</label>
                                <input className="fi" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g., Ravi Kumar / Solar Tech Pvt. Ltd." />
                            </div>
                            <div className="fg">
                                <label className="fl">Mobile Number *</label>
                                <input className="fi" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="10-digit mobile number" maxLength={10} />
                            </div>
                        </div>
                        <div className="fr2">
                            <div className="fg">
                                <label className="fl">Email Address</label>
                                <input className="fi" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="customer@example.com" />
                            </div>
                            <div className="fg">
                                <label className="fl">Customer Type</label>
                                <select className="fi" value={form.customerType} onChange={e => set('customerType', e.target.value)}>
                                    {CUSTOMER_TYPES.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        {form.customerType === 'Commercial' && (
                            <div className="fr2">
                                <div className="fg">
                                    <label className="fl">GST Number</label>
                                    <input className="fi" value={form.gstin} onChange={e => set('gstin', e.target.value.toUpperCase())} placeholder="e.g., 22AAAAA0000A1Z5" maxLength={15} />
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Section B — Location Details */}
                    <section>
                        <div style={S}>📍 Section B — Location Details</div>
                        <div className="fr2">
                            <div className="fg">
                                <label className="fl">City *</label>
                                <input className="fi" value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g., Chennai" />
                            </div>
                            <div className="fg">
                                <label className="fl">State</label>
                                <select className="fi" value={form.state} onChange={e => set('state', e.target.value)}>
                                    <option value="">— Select State —</option>
                                    {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="fr2">
                            <div className="fg">
                                <label className="fl">PIN Code</label>
                                <input className="fi" value={form.pinCode} onChange={e => set('pinCode', e.target.value)} placeholder="6-digit PIN" maxLength={6} />
                            </div>
                            <div className="fg">
                                <label className="fl">Country</label>
                                <input className="fi" value={form.country} onChange={e => set('country', e.target.value)} placeholder="India" />
                            </div>
                        </div>
                    </section>

                    {/* Section C — Address Information */}
                    <section>
                        <div style={S}>🏠 Section C — Address Information</div>
                        <div className="fr2">
                            <div className="fg">
                                <label className="fl">Billing Address *</label>
                                <textarea className="fi" rows={3} value={form.address} onChange={e => handleAddressChange(e.target.value)} placeholder="Door No, Street, Area, City, PIN" />
                            </div>
                            <div className="fg">
                                <label className="fl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Installation Address</span>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500, fontSize: 11, color: 'var(--g600)', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={form.sameAddress}
                                            onChange={e => handleSameAddress(e.target.checked)}
                                            style={{ accentColor: 'var(--orange)', width: 13, height: 13 }}
                                        />
                                        Same as billing
                                    </label>
                                </label>
                                <textarea className="fi" rows={3} value={form.installationAddress} onChange={e => set('installationAddress', e.target.value)} placeholder="Solar panel installation site address" disabled={form.sameAddress} style={{ background: form.sameAddress ? 'var(--g50)' : undefined }} />
                            </div>
                        </div>
                    </section>

                    {/* Section D — Business Details */}
                    <section>
                        <div style={S}>🏢 Section D — Business Details</div>
                        <div className="fr2">
                            <div className="fg">
                                <label className="fl">Company Name</label>
                                <input className="fi" value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Optional company / firm name" />
                            </div>
                            <div className="fg">
                                <label className="fl">Contact Person</label>
                                <input className="fi" value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder="Primary point of contact" />
                            </div>
                        </div>
                        <div className="fr2">
                            <div className="fg">
                                <label className="fl">Customer Category</label>
                                <select className="fi" value={form.customerCategory} onChange={e => set('customerCategory', e.target.value)}>
                                    {CUSTOMER_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="fg">
                                <label className="fl">Active Status</label>
                                <select className="fi" value={form.status} onChange={e => set('status', e.target.value)}>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Section E — Additional Details */}
                    <section>
                        <div style={S}>📋 Section E — Additional Details</div>
                        <div className="fr2">
                            <div className="fg">
                                <label className="fl">Reference Source</label>
                                <select className="fi" value={form.referenceSource} onChange={e => set('referenceSource', e.target.value)}>
                                    <option value="">— Select Source —</option>
                                    {REFERENCE_SOURCES.map(r => <option key={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="fg" style={{ gridColumn: '1 / -1' }}>
                                <label className="fl">Notes / Remarks</label>
                                <textarea className="fi" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any special requirements, preferences, or notes about this customer..." />
                            </div>
                        </div>
                    </section>

                    <div style={{ paddingTop: 20, borderTop: '1px solid var(--g100)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <button className="btn btn-ghost" onClick={() => navigate('/customers')}>Cancel</button>
                        <button className="btn btn-primary" style={{ padding: '10px 30px' }} onClick={saveCustomer}>
                            {id ? 'Update Customer' : 'Add Customer'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    )
}
