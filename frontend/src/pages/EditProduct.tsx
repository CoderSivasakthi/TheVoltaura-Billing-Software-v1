import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, X, Package, Sun, Zap, Image, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { api, toast } from '../services/api'
import DocumentUploader from '../components/DocumentUploader'

const PRODUCT_CATEGORIES = [
    'Solar Panel', 'On-Grid Inverter', 'Hybrid Inverter', 'Off-Grid Inverter',
    'Battery', 'Battery Box', 'ACDB', 'DCDB', 'Lightning Arrester',
    'Earthing Rod', 'Earthing Chemical', 'Mounting Structure', 'DC Cable',
    'AC Cable', 'MC4 Connector', 'PVC Pipe / Conduit', 'Installation Service',
    'Transportation', 'Maintenance', 'Other Accessories'
]

const UNITS = ['Nos', 'Pcs', 'Set', 'Meter', 'Kg', 'Bag', 'Year', 'Service']
const GST_RATES = ['5', '12', '18', '28', 'Custom']

const CollapsibleSection = ({ title, icon: Icon, children, defaultOpen = true }: any) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    return (
        <div style={{ marginBottom: 24, border: '1px solid var(--g200)', borderRadius: 8, overflow: 'hidden' }}>
            <div 
                style={{ padding: '16px 20px', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: isOpen ? '1px solid var(--g200)' : 'none' }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, color: 'var(--g700)' }}>
                    <Icon size={18} /> {title}
                </div>
                {isOpen ? <ChevronUp size={18} color="var(--g400)" /> : <ChevronDown size={18} color="var(--g400)" />}
            </div>
            {isOpen && <div style={{ padding: '24px 24px' }}>{children}</div>}
        </div>
    )
}

export default function EditProduct() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(!!id)
    const [form, setForm] = useState({ 
        name: '', 
        sku: '', 
        brand: '', 
        manufacturer: '',
        modelNumber: '',
        productStatus: 'Active',
        category: 'Solar Panel', 
        gstRate: '18', 
        hsnCode: '', 
        unit: 'Nos',
        productType: 'Stock Item',
        netPrice: '', 
        sellingPrice: '',
        stock: '', 
        minStock: '',
        reorderLevel: '',
        warehouse: '',
        storageLocation: '',
        supplier: '',
        description: '',
        technicalSpecification: '',
        productImageUrl: null as any,
        datasheetUrl: null as any,
        warrantyUrl: null as any
    })

    const loadProduct = useCallback(async () => {
        if (!id) return
        try {
            const data = await api('GET', `/api/products/${id}`)
            if (data) setForm({
                name: data.name || '',
                sku: data.sku || '',
                brand: data.brand || '',
                manufacturer: data.manufacturer || '',
                modelNumber: data.modelNumber || '',
                productStatus: data.productStatus || 'Active',
                category: data.category || 'Solar Panel',
                gstRate: String(data.gstRate || 18),
                hsnCode: data.hsnCode || '',
                unit: data.unit || 'Nos',
                productType: data.productType || 'Stock Item',
                netPrice: String(data.netPrice || data.price || ''), // fallback to old price
                sellingPrice: String(data.sellingPrice || data.price || ''),
                stock: String(data.stock || ''),
                minStock: String(data.minStock || ''),
                reorderLevel: String(data.reorderLevel || ''),
                warehouse: data.warehouse || '',
                storageLocation: data.storageLocation || '',
                supplier: data.supplier || '',
                description: data.description || '',
                technicalSpecification: data.technicalSpecification || '',
                productImageUrl: data.productImageUrl || null,
                datasheetUrl: data.datasheetUrl || null,
                warrantyUrl: data.warrantyUrl || null
            })
        } catch { toast('Product not found', 'error'); navigate('/products') }
        finally { setLoading(false) }
    }, [id, navigate])

    useEffect(() => { loadProduct() }, [loadProduct])

    const saveProduct = async () => {
        if (!form.name.trim()) { toast('Product name required', 'error'); return }
        if (!form.category) { toast('Category required', 'error'); return }
        if (!form.unit) { toast('Unit required', 'error'); return }
        if (!form.netPrice || Number(form.netPrice) < 0) { toast('Valid Net Price required', 'error'); return }
        if (!form.sellingPrice || Number(form.sellingPrice) < 0) { toast('Valid Selling Price required', 'error'); return }
        if (!form.gstRate) { toast('GST Rate required', 'error'); return }

        if (Number(form.sellingPrice) < Number(form.netPrice)) {
            // Soft warning instead of hard block, as per implementation plan
            toast('Warning: Selling price is less than Net Price!', 'warning')
        }

        const payload = { 
            ...form, 
            price: Number(form.sellingPrice) || 0, // Keep price sync for backwards compatibility
            netPrice: Number(form.netPrice) || 0,
            sellingPrice: Number(form.sellingPrice) || 0,
            stock: Number(form.stock) || 0, 
            minStock: Number(form.minStock) || 0,
            reorderLevel: Number(form.reorderLevel) || 0,
            gstRate: Number(form.gstRate) || 0 
        }
        try {
            if (id) {
                await api('PUT', `/api/products/${id}`, payload)
                toast('Product updated')
            } else {
                await api('POST', '/api/products', payload)
                toast('Product added')
            }
            navigate('/products')
        } catch { toast('Failed to save product', 'error') }
    }

    if (loading) return <div className="page active" style={{ padding: 40, textAlign: 'center', color: 'var(--g400)' }}>Loading product details...</div>

    const netPrice = Number(form.netPrice) || 0
    const sellingPrice = Number(form.sellingPrice) || 0
    const profitMarginRs = sellingPrice - netPrice
    const profitMarginPct = netPrice > 0 ? ((profitMarginRs / netPrice) * 100).toFixed(2) : 0

    return (
        <div className="page active" id="edit-product-page">
            <div className="inv-pg-hdr">
                <div className="breadcrumb">
                    <a href="#" onClick={e => { e.preventDefault(); navigate('/products') }}>← Back to Products</a>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/products')}>
                        <X size={14} /> Cancel
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={saveProduct}>
                        <Save size={14} /> {id ? 'Update Product' : 'Save Product'}
                    </button>
                </div>
            </div>

            <div className="inv-title-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Package size={24} style={{ color: 'var(--blue)' }} />
                    <h2>{id ? `Edit Product: ${form.name}` : 'Add New Product'}</h2>
                </div>
            </div>

            <div style={{ padding: '0 32px 40px', maxWidth: 900, margin: '0 auto' }}>
                <CollapsibleSection title="Section 1 – Basic Product Information" icon={Package}>
                    <div className="fg" style={{ marginBottom: 20 }}>
                        <label className="fl">Product Name *</label>
                        <input className="fi" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Vikram 550Wp DCR Bifacial Panel" />
                    </div>
                    <div className="fr2" style={{ marginBottom: 20 }}>
                        <div className="fg">
                            <label className="fl">Product Code / SKU (Auto-generated if empty)</label>
                            <input className="fi" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="SP-550W-MONO" />
                        </div>
                        <div className="fg">
                            <label className="fl">Brand</label>
                            <input className="fi" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="e.g., Vikram Solar" />
                        </div>
                    </div>
                    <div className="fr2">
                        <div className="fg">
                            <label className="fl">Manufacturer</label>
                            <input className="fi" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} placeholder="Manufacturer Name" />
                        </div>
                        <div className="fg">
                            <label className="fl">Model Number</label>
                            <input className="fi" value={form.modelNumber} onChange={e => setForm({ ...form, modelNumber: e.target.value })} placeholder="Model Number" />
                        </div>
                    </div>
                    <div className="fr2" style={{ marginTop: 20 }}>
                        <div className="fg">
                            <label className="fl">Product Status</label>
                            <select className="fi" value={form.productStatus} onChange={e => setForm({ ...form, productStatus: e.target.value })}>
                                <option>Active</option>
                                <option>Inactive</option>
                            </select>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="Section 2 – Product Classification & Type" icon={Sun}>
                    <div className="fr2">
                        <div className="fg">
                            <label className="fl">Category *</label>
                            <select className="fi" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                {PRODUCT_CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div className="fg">
                            <label className="fl">Product Type</label>
                            <div style={{ display: 'flex', gap: 20, height: '42px', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input type="radio" checked={form.productType === 'Stock Item'} onChange={() => setForm({ ...form, productType: 'Stock Item' })} />
                                    Stock Item
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input type="radio" checked={form.productType === 'Service Item'} onChange={() => setForm({ ...form, productType: 'Service Item' })} />
                                    Service Item
                                </label>
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="Section 3 – Pricing" icon={Zap}>
                    <div className="fr2" style={{ marginBottom: 20 }}>
                        <div className="fg">
                            <label className="fl">Net Price (Purchase Cost) *</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 12, top: 11, color: 'var(--g400)' }}>₹</span>
                                <input className="fi" style={{ paddingLeft: 30 }} value={form.netPrice} onChange={e => setForm({ ...form, netPrice: e.target.value })} type="number" min="0" placeholder="12870" />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--g400)', marginTop: 4, display: 'block' }}>Cost price before profit margin</span>
                        </div>
                        <div className="fg">
                            <label className="fl">Selling Price (Quotation Price) *</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 12, top: 11, color: 'var(--g400)' }}>₹</span>
                                <input className="fi" style={{ paddingLeft: 30 }} value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: e.target.value })} type="number" min="0" placeholder="13475" />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--g400)', marginTop: 4, display: 'block' }}>Selling price used in quotations</span>
                        </div>
                    </div>
                    <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontSize: 12, color: '#166534', fontWeight: 500 }}>Profit Margin (₹)</div>
                            <div style={{ fontSize: 18, color: '#15803d', fontWeight: 600 }}>₹{profitMarginRs.toFixed(2)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, color: '#166534', fontWeight: 500 }}>Profit Margin (%)</div>
                            <div style={{ fontSize: 18, color: '#15803d', fontWeight: 600 }}>{profitMarginPct}%</div>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="Section 4 & 5 – GST, HSN & Unit" icon={FileText}>
                    <div className="fr3">
                        <div className="fg">
                            <label className="fl">HSN / SAC Code</label>
                            <input className="fi" value={form.hsnCode} onChange={e => setForm({ ...form, hsnCode: e.target.value })} placeholder="e.g., 8541" />
                        </div>
                        <div className="fg">
                            <label className="fl">GST Rate % *</label>
                            <select className="fi" value={form.gstRate} onChange={e => setForm({ ...form, gstRate: e.target.value })}>
                                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                            </select>
                        </div>
                        <div className="fg">
                            <label className="fl">Unit *</label>
                            <select className="fi" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="Section 6 – Product Description & Tech Specs" icon={FileText}>
                    <div className="fg" style={{ marginBottom: 20 }}>
                        <label className="fl">Product Description</label>
                        <input className="fi" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short description used in quotations..." />
                    </div>
                    <div className="fg">
                        <label className="fl">Technical Specification</label>
                        <textarea className="fi" style={{ height: '120px', resize: 'vertical' }} value={form.technicalSpecification} onChange={e => setForm({ ...form, technicalSpecification: e.target.value })} placeholder="550 Wp&#10;TopCon Technology&#10;Half Cut&#10;Bifacial&#10;DCR" />
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="Section 7 – Inventory Management" icon={Package}>
                    <div className="fr3" style={{ marginBottom: 20 }}>
                        <div className="fg">
                            <label className="fl">Current Stock</label>
                            <input className="fi" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} type="number" min="0" placeholder="0" disabled={form.productType === 'Service Item'} />
                        </div>
                        <div className="fg">
                            <label className="fl">Minimum Stock</label>
                            <input className="fi" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} type="number" min="0" placeholder="0" disabled={form.productType === 'Service Item'} />
                        </div>
                        <div className="fg">
                            <label className="fl">Reorder Level</label>
                            <input className="fi" value={form.reorderLevel} onChange={e => setForm({ ...form, reorderLevel: e.target.value })} type="number" min="0" placeholder="0" disabled={form.productType === 'Service Item'} />
                        </div>
                    </div>
                    <div className="fr3">
                        <div className="fg">
                            <label className="fl">Warehouse</label>
                            <input className="fi" value={form.warehouse} onChange={e => setForm({ ...form, warehouse: e.target.value })} placeholder="e.g., Main Warehouse" disabled={form.productType === 'Service Item'} />
                        </div>
                        <div className="fg">
                            <label className="fl">Storage Location</label>
                            <input className="fi" value={form.storageLocation} onChange={e => setForm({ ...form, storageLocation: e.target.value })} placeholder="e.g., Rack A3" disabled={form.productType === 'Service Item'} />
                        </div>
                        <div className="fg">
                            <label className="fl">Default Supplier</label>
                            <input className="fi" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier Name" disabled={form.productType === 'Service Item'} />
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="Section 8 – Product Images & Documents" icon={Image} defaultOpen={false}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                        <DocumentUploader
                            title="Product Image"
                            acceptedFormats="JPG, PNG"
                            value={form.productImageUrl}
                            onChange={(doc) => setForm({ ...form, productImageUrl: doc })}
                        />
                        <DocumentUploader
                            title="Datasheet PDF"
                            acceptedFormats="PDF"
                            value={form.datasheetUrl}
                            onChange={(doc) => setForm({ ...form, datasheetUrl: doc })}
                        />
                        <DocumentUploader
                            title="Warranty PDF"
                            acceptedFormats="PDF"
                            value={form.warrantyUrl}
                            onChange={(doc) => setForm({ ...form, warrantyUrl: doc })}
                        />
                    </div>
                </CollapsibleSection>

                <div style={{ paddingTop: 20, borderTop: '1px solid var(--g100)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button className="btn btn-ghost" onClick={() => navigate('/products')}>Cancel</button>
                    <button className="btn btn-primary" style={{ padding: '10px 30px' }} onClick={saveProduct}>
                        <Save size={16} style={{ marginRight: 6 }} /> {id ? 'Update Product' : 'Save Product'}
                    </button>
                </div>
            </div>
        </div>
    )
}
