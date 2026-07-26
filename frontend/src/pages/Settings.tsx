import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Building, Scan, X, ShieldCheck, Loader2, Settings as SettingsIcon, FileText, HardDrive, CheckCircle, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react'
import { toast, api } from '../services/api'
import { useSettings } from '../context/SettingsContext'
import { useNavigate } from 'react-router-dom'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'

function parseFormat(format: string) {
    if (!format) return null;
    const match = format.match(/^(.*?)(\d+)$/);
    if (!match) return null;
    return {
        prefix: match[1],
        counterStr: match[2],
        counterVal: parseInt(match[2], 10),
        padding: match[2].length
    };
}

export default function Settings() {
    const { settings, loading, updateSettings } = useSettings()
    const navigate = useNavigate()

    const [activeTab, setActiveTab] = useState<'general' | 'quotation' | 'invoice' | 'storage'>('general')

    // Storage status state
    const [storageStatus, setStorageStatus] = useState<any>(null)
    const [storageLoading, setStorageLoading] = useState(false)

    const fetchStorageStatus = useCallback(async () => {
        setStorageLoading(true)
        try {
            const data = await api('GET', '/api/storage/status')
            setStorageStatus(data)
        } catch (e) {
            setStorageStatus({ supabase: { ok: false, message: 'Failed to reach server' }, googleDrive: { ok: false, message: 'Failed to reach server' } })
        } finally {
            setStorageLoading(false)
        }
    }, [])

    const [orgName, setOrgName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [invPrefix, setInvPrefix] = useState('')
    const [quotPrefix, setQuotPrefix] = useState('')
    const [gstRate, setGstRate] = useState('18')
    const [logo, setLogo] = useState('')
    const [branches, setBranches] = useState<any[]>([])
    const [hsnCodes, setHsnCodes] = useState<any[]>([])
    const [taxRates, setTaxRates] = useState<any[]>([])
    
    const [quotation, setQuotation] = useState<any>({ content: {}, images: {} })
    const [invoiceConfig, setInvoiceConfig] = useState<any>({ eoeContent: '', termsAndConditions: '' })
    const [lowStock, setLowStock] = useState(true)
    const [overdueAlert, setOverdueAlert] = useState(true)
    const [amcAlert, setAmcAlert] = useState(true)

    const invParsed = parseFormat(invPrefix);
    const quotParsed = parseFormat(quotPrefix);
    const invPreview = invParsed ? (invParsed.prefix + String(invParsed.counterVal).padStart(invParsed.padding, '0')) : 'Invalid format (must end with numbers)';
    const quotPreview = quotParsed ? (quotParsed.prefix + String(quotParsed.counterVal).padStart(quotParsed.padding, '0')) : 'Invalid format (must end with numbers)';

    // Sync from context when loaded
    useEffect(() => {
        if (settings) {
            setOrgName(settings.orgName)
            setEmail(settings.email)
            setPhone(settings.phone)
            if (settings.invoicePrefix !== undefined && settings.invoiceCounter !== undefined && settings.invoicePadding !== undefined) {
                setInvPrefix(settings.invoicePrefix + String(settings.invoiceCounter).padStart(settings.invoicePadding, '0'))
            } else {
                setInvPrefix(settings.invPrefix || '')
            }

            if (settings.quotationPrefix !== undefined && settings.quotationCounter !== undefined && settings.quotationPadding !== undefined) {
                setQuotPrefix(settings.quotationPrefix + String(settings.quotationCounter).padStart(settings.quotationPadding, '0'))
            } else {
                setQuotPrefix(settings.quotPrefix || '')
            }
            setGstRate(settings.gstRate)
            setLogo(settings.logo)
            setBranches(settings.branches || [])
            setHsnCodes(settings.hsnCodes || [])
            setTaxRates(settings.taxRates || [])
            
            setQuotation(settings.quotation || { content: {}, images: {} })
            setInvoiceConfig(settings.invoiceConfig || { 
                eoeContent: '<p>Our responsibility ceases after the goods are handed over to the transporter. Claims for leakage, shortage, damage, or delay in transit will not be entertained. We reserve the right to recover any taxes, duties, or statutory charges applicable to this invoice if omitted due to clerical or system errors.</p><p><br></p><p><strong>Subject to Namakkal Jurisdiction only.</strong></p>', 
                termsAndConditions: '' 
            })
            setLowStock(settings.lowStock)
            setOverdueAlert(settings.overdueAlert)
            setAmcAlert(settings.amcAlert)
        }
    }, [settings])

    const handleLogoUpload = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => setLogo(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    }

    const handleQuotationImage = (field: string, e: any) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => setQuotation({ ...quotation, images: { ...quotation.images, [field]: ev.target?.result as string } });
            reader.readAsDataURL(file);
        }
    }

    const removeQuotationImage = (field: string) => {
        const newImages = { ...quotation.images }
        delete newImages[field]
        setQuotation({ ...quotation, images: newImages })
    }

    const updateQContent = (page: string, field: string, value: string) => {
        if (quotation.content[page]?.[field] === value) return;
        setQuotation({
            ...quotation,
            content: {
                ...quotation.content,
                [page]: {
                    ...quotation.content[page],
                    [field]: value
                }
            }
        })
    }

    const addBranch = () => setBranches([...branches, { id: Math.random().toString(), name: '', gst: '', address: '', code: '' }])
    const updateBranch = (id: string, field: string, val: string) => setBranches(branches.map(b => b.id === id ? { ...b, [field]: val } : b))
    const removeBranch = (id: string) => setBranches(branches.filter(b => b.id !== id))

    const addHsn = () => setHsnCodes([...hsnCodes, { id: Math.random().toString(), category: '', code: '' }])
    const updateHsn = (id: string, field: string, val: string) => setHsnCodes(hsnCodes.map(h => h.id === id ? { ...h, [field]: val } : h))
    const removeHsn = (id: string) => setHsnCodes(hsnCodes.filter(h => h.id !== id))

    const addTaxRate = () => setTaxRates([...taxRates, { id: Math.random().toString(), label: '', rate: 18 }])
    const updateTaxRate = (id: string, field: string, val: string) => setTaxRates(taxRates.map(t => t.id === id ? { ...t, [field]: field === 'rate' ? Number(val) : val } : t))
    const removeTaxRate = (id: string) => setTaxRates(taxRates.filter(t => t.id !== id))

    const [saving, setSaving] = useState(false)
    const saveSettings = async () => {
        const invParsed = parseFormat(invPrefix);
        const quotParsed = parseFormat(quotPrefix);

        if (!invParsed) {
            toast('Invalid Invoice Prefix format. It must end with a numeric sequence (e.g. INV/TVA/202627001).', 'error');
            return;
        }
        if (!quotParsed) {
            toast('Invalid Quotation Prefix format. It must end with a numeric sequence (e.g. QT/TVA/202627001).', 'error');
            return;
        }
        if (invPrefix.trim() === quotPrefix.trim()) {
            toast('Invoice Prefix and Quotation Prefix cannot be identical.', 'error');
            return;
        }

        setSaving(true)
        try {
            await updateSettings({
                orgName, email, phone, 
                invPrefix, quotPrefix, 
                gstRate, logo, branches, hsnCodes, taxRates, lowStock, overdueAlert, amcAlert,
                quotation, invoiceConfig,
                invoicePrefix: invParsed.prefix,
                invoiceCounter: invParsed.counterVal,
                invoicePadding: invParsed.padding,
                quotationPrefix: quotParsed.prefix,
                quotationCounter: quotParsed.counterVal,
                quotationPadding: quotParsed.padding
            })
            toast('Configuration saved successfully!')
        } catch (e) {
            toast('Failed to save settings', 'error')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="page active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="spinner" /></div>
    }

    const rteModules = {
        toolbar: [
            [{ 'header': [1, 2, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['clean']
        ],
    }

    return (
        <div className="page active" id="settings-page">
            <style>{`
                .ql-editor {
                    min-height: 100px;
                    font-size: 13px;
                    font-family: inherit;
                }
                .ql-container { border-bottom-left-radius: 6px; border-bottom-right-radius: 6px; }
                .ql-toolbar { border-top-left-radius: 6px; border-top-right-radius: 6px; }
            `}</style>
            
            <div className="breadcrumb"><a href="#" onClick={e => { e.preventDefault(); navigate('/dashboard') }}>Home</a><span className="bc-sep">›</span><span className="bc-cur">Settings</span></div>
            <div className="ph" style={{ marginBottom: 16 }}>
                <div><h2>Settings</h2><div className="sub">Configure your organization profile, invoice preferences, and quotation content.</div></div>
            </div>

            {/* TABS */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--g200)' }}>
                <button 
                    onClick={() => setActiveTab('general')} 
                    style={{ padding: '12px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'general' ? '2px solid var(--blue)' : '2px solid transparent', color: activeTab === 'general' ? 'var(--blue)' : 'var(--g500)', fontWeight: activeTab === 'general' ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <SettingsIcon size={16} /> General Settings
                </button>
                <button 
                    onClick={() => setActiveTab('quotation')} 
                    style={{ padding: '12px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'quotation' ? '2px solid var(--blue)' : '2px solid transparent', color: activeTab === 'quotation' ? 'var(--blue)' : 'var(--g500)', fontWeight: activeTab === 'quotation' ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <FileText size={16} /> Quotation Content & Details
                </button>
                <button 
                    onClick={() => setActiveTab('invoice')} 
                    style={{ padding: '12px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'invoice' ? '2px solid var(--blue)' : '2px solid transparent', color: activeTab === 'invoice' ? 'var(--blue)' : 'var(--g500)', fontWeight: activeTab === 'invoice' ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <FileText size={16} /> Invoice Content
                </button>
                <button 
                    onClick={() => { setActiveTab('storage'); fetchStorageStatus(); }} 
                    style={{ padding: '12px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'storage' ? '2px solid #7C3AED' : '2px solid transparent', color: activeTab === 'storage' ? '#7C3AED' : 'var(--g500)', fontWeight: activeTab === 'storage' ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <HardDrive size={16} /> Storage
                </button>
            </div>

            {activeTab === 'general' && (
                <div className="settings-grid">
                            <div className="card cp" style={{ gridColumn: '1 / -1' }}>
                                <div className="section-hdr"><h3>Company Profile</h3></div>
                                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                    <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ width: '140px', height: '140px', backgroundColor: 'var(--g50)', border: '2px dashed var(--g300)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                                            {logo ? <img src={logo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Logo" /> : <Building size={32} color="var(--g400)" />}
                                            <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} title="Upload company logo" />
                                        </div>
                                        <div style={{ fontSize: '11px', textAlign: 'center', color: 'var(--g500)' }}>Click to Upload App Logo</div>
                                    </div>
                                    <div className="fr2" style={{ flex: '1 1 300px', gap: '16px' }}>
                                        <div className="fg"><label className="fl">Company Name</label><input className="fi" value={orgName} onChange={e => setOrgName(e.target.value)} /></div>
                                        <div className="fg"><label className="fl">Support Email</label><input className="fi" value={email} onChange={e => setEmail(e.target.value)} type="email" /></div>
                                        <div className="fg"><label className="fl">Support Phone</label><input className="fi" value={phone} onChange={e => setPhone(e.target.value)} /></div>
                                    </div>
                                </div>
                            </div>

                            <div className="card cp" style={{ gridColumn: '1 / -1' }}>
                                <div className="section-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Building size={18} /> Company Branches</h3>
                                    <button onClick={addBranch} className="btn btn-secondary btn-sm"><Plus size={14} /> Add Branch</button>
                                </div>
                                {branches.length === 0 && <div style={{ fontSize: '13px', color: 'var(--g500)', padding: '12px 0' }}>No branches defined. Add at least one to be used in Quotations.</div>}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                                    {branches.map((b, i) => (
                                        <div key={b.id} className="fr2" style={{ gap: '12px', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: i < branches.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                                            <div><label className="fl">Branch Name</label><input className="fi" value={b.name} onChange={e => updateBranch(b.id, 'name', e.target.value)} placeholder="E.g., HO (Chennai)" /></div>
                                            <div><label className="fl">GST Number</label><input className="fi" value={b.gst} onChange={e => updateBranch(b.id, 'gst', e.target.value)} placeholder="Branch GST" /></div>
                                            <div><label className="fl">Registered Address</label><input className="fi" value={b.address} onChange={e => updateBranch(b.id, 'address', e.target.value)} placeholder="Full address..." /></div>
                                            <div><label className="fl">Branch Code</label><input className="fi" value={b.code} onChange={e => updateBranch(b.id, 'code', e.target.value)} placeholder="Optional" /></div>
                                            <div><label className="fl">&nbsp;</label><button onClick={() => removeBranch(b.id)} style={{ padding: '8px', color: '#EF4444', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', cursor: 'pointer' }} title="Remove Branch"><Trash2 size={16} /></button></div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="card cp" style={{ gridColumn: '1 / -1' }}>
                                <div className="section-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Scan size={18} /> HSN / SAC Codes Mapping</h3>
                                    <button onClick={addHsn} className="btn btn-secondary btn-sm"><Plus size={14} /> Add HSN Rule</button>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--g500)', marginBottom: '16px' }}>These codes will auto-populate when matching keywords are selected in Quotations or Invoices.</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {hsnCodes.map((hCode) => (
                                        <div key={hCode.id} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <input className="fi" style={{ flex: 1 }} value={hCode.category} onChange={e => updateHsn(hCode.id, 'category', e.target.value)} placeholder="Product Category / Keyword (e.g., Solar Panels)" />
                                            <input className="fi" style={{ width: '140px', textAlign: 'center' }} value={hCode.code} onChange={e => updateHsn(hCode.id, 'code', e.target.value)} placeholder="HSN/SAC Code" />
                                            <button onClick={() => removeHsn(hCode.id)} style={{ padding: '8px', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="card cp" style={{ gridColumn: '1 / -1' }}>
                                <div className="section-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={18} /> Tax Configuration</h3>
                                    <button onClick={addTaxRate} className="btn btn-secondary btn-sm"><Plus size={14} /> Add Tax Type</button>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--g500)', marginBottom: '16px' }}>GST rates defined here are auto-applied on Quotation items.</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 40px', gap: '12px', padding: '6px 0', borderBottom: '1px solid var(--g200)' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--g500)', textTransform: 'uppercase' }}>Tax Type Label</span>
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--g500)', textTransform: 'uppercase', textAlign: 'center' }}>Rate (%)</span>
                                        <span />
                                    </div>
                                    {taxRates.map((t) => (
                                        <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 40px', gap: '12px', alignItems: 'center' }}>
                                            <input className="fi" value={t.label} onChange={e => updateTaxRate(t.id, 'label', e.target.value)} placeholder="E.g. Standard GST" />
                                            <input className="fi" type="number" min="0" max="100" value={t.rate} onChange={e => updateTaxRate(t.id, 'rate', e.target.value)} style={{ textAlign: 'center' }} />
                                            <button onClick={() => removeTaxRate(t.id)} style={{ padding: '8px', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="card cp" style={{ gridColumn: '1 / -1' }}>
                                <div className="section-hdr"><h3>Document Numbering</h3></div>
                                <div style={{ fontSize: '12px', color: 'var(--g500)', marginBottom: '16px' }}>
                                    Configure the starting prefix and format for newly generated Invoice and Quotation numbers. The prefix must end with a numeric sequence (e.g., INV/TVA/202627001).
                                </div>
                                <div className="fr2" style={{ gap: '20px' }}>
                                    <div className="fg">
                                        <label className="fl">Invoice Prefix Format</label>
                                        <input 
                                            className="fi" 
                                            value={invPrefix} 
                                            onChange={e => setInvPrefix(e.target.value)} 
                                            placeholder="E.g., INV/TVA/202627001"
                                        />
                                        <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--g500)' }}>
                                            Next Invoice Number: <strong style={{ color: 'var(--blue)' }}>{invPreview}</strong>
                                        </div>
                                    </div>
                                    <div className="fg">
                                        <label className="fl">Quotation Prefix Format</label>
                                        <input 
                                            className="fi" 
                                            value={quotPrefix} 
                                            onChange={e => setQuotPrefix(e.target.value)} 
                                            placeholder="E.g., QT/TVA/202627001"
                                        />
                                        <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--g500)' }}>
                                            Next Quotation Number: <strong style={{ color: 'var(--blue)' }}>{quotPreview}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="card cp">
                                <div className="section-hdr"><h3>Tax &amp; Billing Defaults</h3></div>
                                <div className="fg"><label className="fl">Default GST Rate (%)</label>
                                    <select className="fi" value={gstRate} onChange={e => setGstRate(e.target.value)} style={{ maxWidth: 160 }}>
                                        <option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
                                    </select>
                                </div>
                            </div>

                    <div className="card cp">
                        <div className="section-hdr"><h3>Notifications</h3></div>
                        <label className="fcheck" style={{ marginBottom: 12 }}><input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)} /><span className="fcheck-label">Low stock alerts</span></label>
                        <label className="fcheck" style={{ marginBottom: 12 }}><input type="checkbox" checked={overdueAlert} onChange={e => setOverdueAlert(e.target.checked)} /><span className="fcheck-label">Overdue invoice alerts</span></label>
                        <label className="fcheck" style={{ marginBottom: 12 }}><input type="checkbox" checked={amcAlert} onChange={e => setAmcAlert(e.target.checked)} /><span className="fcheck-label">AMC expiry alerts</span></label>
                    </div>
                </div>
            )}

            {activeTab === 'quotation' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="card cp">
                        <div className="section-hdr"><h3>Branding & Images</h3></div>
                        <div style={{ fontSize: '12px', color: 'var(--g500)', marginBottom: '16px' }}>Upload images to customize the generated quotation PDF. Supported formats: PNG, JPG.</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                            {[
                                { k: 'companyLogo', l: 'Company Logo (Header)' },
                                { k: 'companySeal', l: 'Company Office Seal' },
                                { k: 'directorSignature', l: 'Director Signature' },
                                { k: 'solarGenerationImage', l: 'Solar Generation Short View' },
                                { k: 'onGridDiagram', l: 'On-Grid Solar Working Diagram' },
                                { k: 'hybridDiagram', l: 'Hybrid Solar Working Diagram' },
                                { k: 'offGridDiagram', l: 'Off-Grid Solar Working Diagram' },
                                { k: 'brandsWeUseImage', l: 'Brands We Use' },
                            ].map(ast => (
                                <div key={ast.k} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label className="fl">{ast.l}</label>
                                    <div style={{ height: '140px', backgroundColor: 'var(--g50)', border: '2px dashed var(--g300)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                                        {quotation.images[ast.k] ? (
                                            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                                <img src={quotation.images[ast.k]} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt={ast.l} />
                                                <div style={{ position: 'absolute', bottom: 4, right: 4, display: 'flex', gap: 4 }}>
                                                    <label style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: 4, fontSize: '10px', cursor: 'pointer' }}>
                                                        Replace
                                                        <input type="file" accept="image/*" onChange={(e) => handleQuotationImage(ast.k, e)} style={{ display: 'none' }} />
                                                    </label>
                                                    <button onClick={() => removeQuotationImage(ast.k)} style={{ backgroundColor: '#EF4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, fontSize: '10px', cursor: 'pointer' }}>Delete</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <span style={{ fontSize: '11px', color: 'var(--g400)' }}>Click to upload</span>
                                                <input type="file" accept="image/*" onChange={(e) => handleQuotationImage(ast.k, e)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card cp">
                        <div className="section-hdr"><h3>Page 1 Content Management</h3></div>
                        <div className="fr2" style={{ gap: '16px' }}>
                            <div className="fg"><label className="fl">Subject</label><input className="fi" value={quotation.content.page1?.subject || ''} onChange={e => updateQContent('page1', 'subject', e.target.value)} /></div>
                            <div className="fg"><label className="fl">Introduction Letter</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page1?.intro || ''} onChange={v => updateQContent('page1', 'intro', v)} /></div>
                            <div className="fg" style={{ gridColumn: '1 / -1' }}><label className="fl">Proposal Letter</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page1?.proposalLetter || ''} onChange={v => updateQContent('page1', 'proposalLetter', v)} /></div>
                            <div className="fg"><label className="fl">Documents Included</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page1?.documentsIncluded || ''} onChange={v => updateQContent('page1', 'documentsIncluded', v)} /></div>
                            <div className="fg"><label className="fl">Thank You Message</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page1?.thankYouMessage || ''} onChange={v => updateQContent('page1', 'thankYouMessage', v)} /></div>
                            <div className="fg"><label className="fl">Bank Details</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page1?.bankDetails || ''} onChange={v => updateQContent('page1', 'bankDetails', v)} /></div>
                            <div className="fg"><label className="fl">Payment Terms</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page1?.paymentTerms || ''} onChange={v => updateQContent('page1', 'paymentTerms', v)} /></div>
                        </div>
                    </div>

                    <div className="card cp">
                        <div className="section-hdr"><h3>Page 2 Content Management</h3></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="fg"><label className="fl">Why Choose Us</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page2?.whyChooseUs || ''} onChange={v => updateQContent('page2', 'whyChooseUs', v)} /></div>
                            <div className="fg"><label className="fl">Solar Power Plant Description</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page2?.solarPowerExplanation || ''} onChange={v => updateQContent('page2', 'solarPowerExplanation', v)} /></div>
                            <div className="fg"><label className="fl">How It Works</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page2?.howItWorks || ''} onChange={v => updateQContent('page2', 'howItWorks', v)} /></div>
                            <div className="fg"><label className="fl">High-Efficiency PV Modules</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page2?.panelDescription || ''} onChange={v => updateQContent('page2', 'panelDescription', v)} /></div>
                            <div className="fg"><label className="fl">Advanced Grid-Tied Inverter</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page2?.inverterDescription || ''} onChange={v => updateQContent('page2', 'inverterDescription', v)} /></div>
                            <div className="fg"><label className="fl">Mechanical & Electrical Infrastructure</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page2?.mechanicalInfrastructure || ''} onChange={v => updateQContent('page2', 'mechanicalInfrastructure', v)} /></div>
                            <div className="fg"><label className="fl">Company Promise</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page2?.companyPromise || ''} onChange={v => updateQContent('page2', 'companyPromise', v)} /></div>
                        </div>
                    </div>

                    <div className="card cp">
                        <div className="section-hdr"><h3>Page 3 & 4 Content Management</h3></div>
                        <div className="fr2" style={{ gap: '16px' }}>
                            <div className="fg"><label className="fl">Solar Generation Heading</label><input className="fi" value={quotation.content.page3?.solarGenerationHeading || ''} onChange={e => updateQContent('page3', 'solarGenerationHeading', e.target.value)} /></div>
                            <div className="fg"><label className="fl">Subsidy Note</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page3?.subsidyNote || ''} onChange={v => updateQContent('page3', 'subsidyNote', v)} /></div>
                            <div className="fg" style={{ gridColumn: '1 / -1' }}><label className="fl">Brands Intro Text</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page3?.brandsIntroText || ''} onChange={v => updateQContent('page3', 'brandsIntroText', v)} /></div>
                            
                            <div className="fg"><label className="fl">Tech Specification Heading</label><input className="fi" value={quotation.content.page4?.techSpecHeading || ''} onChange={e => updateQContent('page4', 'techSpecHeading', e.target.value)} /></div>
                            <div className="fg"><label className="fl">Amount in Words Label</label><input className="fi" value={quotation.content.page4?.amountInWordsLabel || ''} onChange={e => updateQContent('page4', 'amountInWordsLabel', e.target.value)} /></div>
                        </div>
                    </div>

                    <div className="card cp">
                        <div className="section-hdr"><h3>Page 5 Content Management (Terms & Conditions)</h3></div>
                        <div className="fr2" style={{ gap: '16px' }}>
                            <div className="fg"><label className="fl">Terms and Conditions Heading</label><input className="fi" value={quotation.content.page5?.termsAndConditions || ''} onChange={e => updateQContent('page5', 'termsAndConditions', e.target.value)} /></div>
                            <div className="fg"><label className="fl">Taxes</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page5?.taxes || ''} onChange={v => updateQContent('page5', 'taxes', v)} /></div>
                            <div className="fg"><label className="fl">Payment Terms</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page5?.paymentTerms || ''} onChange={v => updateQContent('page5', 'paymentTerms', v)} /></div>
                            <div className="fg"><label className="fl">Warranty</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page5?.warranty || ''} onChange={v => updateQContent('page5', 'warranty', v)} /></div>
                            <div className="fg"><label className="fl">Delivery</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page5?.delivery || ''} onChange={v => updateQContent('page5', 'delivery', v)} /></div>
                            <div className="fg"><label className="fl">Exclusions</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page5?.exclusions || ''} onChange={v => updateQContent('page5', 'exclusions', v)} /></div>
                            <div className="fg"><label className="fl">Quotation Validity & Terms</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page5?.validity || ''} onChange={v => updateQContent('page5', 'validity', v)} /></div>
                            <div className="fg"><label className="fl">Closing Message</label><ReactQuill theme="snow" modules={rteModules} value={quotation.content.page5?.closingMessage || ''} onChange={v => updateQContent('page5', 'closingMessage', v)} /></div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'invoice' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="card cp">
                        <div className="section-hdr"><h3>Invoice Specific Content</h3></div>
                        <div style={{ fontSize: '12px', color: 'var(--g500)', marginBottom: '16px' }}>Manage the E.&amp;O.E. content and terms & conditions that appear exclusively on the Classic Invoice Template.</div>
                        <div className="fr2" style={{ gap: '16px' }}>
                            <div className="fg" style={{ gridColumn: '1 / -1' }}>
                                <label className="fl">E.&amp;O.E. / Jurisdiction Content</label>
                                <ReactQuill theme="snow" modules={rteModules} value={invoiceConfig.eoeContent || ''} onChange={v => { if (invoiceConfig.eoeContent !== v) setInvoiceConfig({ ...invoiceConfig, eoeContent: v }) }} />
                            </div>
                            <div className="fg" style={{ gridColumn: '1 / -1' }}>
                                <label className="fl">Terms and Conditions</label>
                                <ReactQuill theme="snow" modules={rteModules} value={invoiceConfig.termsAndConditions || ''} onChange={v => { if (invoiceConfig.termsAndConditions !== v) setInvoiceConfig({ ...invoiceConfig, termsAndConditions: v }) }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Storage Tab */}
            {activeTab === 'storage' && (
                <div style={{ maxWidth: '800px' }}>

                    {/* Connection Status Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
                        {/* Supabase Status */}
                        <div style={{ border: '1px solid var(--g200)', borderRadius: '12px', padding: '24px', background: '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <ShieldCheck size={20} color="#2E7D32" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--g900)' }}>Supabase</div>
                                        <div style={{ fontSize: '11px', color: 'var(--g500)' }}>Primary Database</div>
                                    </div>
                                </div>
                                {storageLoading ? (
                                    <Loader2 size={18} className="spinner" />
                                ) : storageStatus?.supabase?.ok ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#2E7D32', background: '#E8F5E9', borderRadius: '20px', padding: '4px 10px' }}>
                                        <CheckCircle size={12} /> Connected
                                    </span>
                                ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#C62828', background: '#FFEBEE', borderRadius: '20px', padding: '4px 10px' }}>
                                        <AlertCircle size={12} /> {storageStatus ? 'Error' : 'Not Tested'}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--g500)' }}>
                                {storageStatus?.supabase?.message || 'Click "Test Connection" to check status'}
                            </div>
                            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--g400)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                {import.meta.env.VITE_SUPABASE_URL || 'osrxhtcgtlmjghgkdkte.supabase.co'}
                            </div>
                        </div>

                        {/* Supabase Storage Status */}
                        <div style={{ border: '1px solid var(--g200)', borderRadius: '12px', padding: '24px', background: '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#E8EAF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <HardDrive size={20} color="#3949AB" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--g900)' }}>Supabase Storage</div>
                                        <div style={{ fontSize: '11px', color: 'var(--g500)' }}>Document Repository</div>
                                    </div>
                                </div>
                                {storageLoading ? (
                                    <Loader2 size={18} className="spinner" />
                                ) : storageStatus?.supabaseStorage?.ok ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#2E7D32', background: '#E8F5E9', borderRadius: '20px', padding: '4px 10px' }}>
                                        <CheckCircle size={12} /> Connected
                                    </span>
                                ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#C62828', background: '#FFEBEE', borderRadius: '20px', padding: '4px 10px' }}>
                                        <AlertCircle size={12} /> {storageStatus?.storageConfigured === false ? 'Not Configured' : (storageStatus ? 'Error' : 'Not Tested')}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--g500)' }}>
                                {storageStatus?.supabaseStorage?.message || 'Click "Test Connection" to check status'}
                            </div>
                            {storageStatus?.supabaseStorage?.bucket && (
                                <div style={{ marginTop: '12px', fontSize: '11px', color: '#3949AB', fontWeight: 600 }}>
                                    📂 Bucket: {storageStatus.supabaseStorage.bucket}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Test Connection Button */}
                    <div style={{ marginBottom: '28px' }}>
                        <button
                            className="btn btn-primary"
                            onClick={fetchStorageStatus}
                            disabled={storageLoading}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {storageLoading ? <><Loader2 size={14} className="spinner" /> Testing...</> : <><RefreshCw size={14} /> Test Connection</>}
                        </button>
                    </div>

                    {/* Architecture Info */}
                    <div style={{ border: '1px solid var(--g200)', borderRadius: '12px', padding: '24px', background: '#fff', marginBottom: '24px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--g900)', marginBottom: '16px' }}>Storage Architecture</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[
                                { icon: '🗄️', label: 'Structured Data', desc: 'Customers, Quotations, Invoices, Payments, Orders → Supabase PostgreSQL' },
                                { icon: '📁', label: 'Customer Documents', desc: 'PAN, Aadhaar, EB Bills, GPS Photos, Contracts → Supabase Storage (erp-documents bucket)' },
                                { icon: '📄', label: 'Generated PDFs', desc: 'Quotation & Invoice PDFs auto-archived with version control (v1, v2, v3...)' },
                                { icon: '💳', label: 'Payment Proofs', desc: 'UTR screenshots, cheque photos → Supabase Storage Payments folder' },
                                { icon: '🔒', label: 'Security', desc: 'All uploads via backend API only — credentials never exposed to browser' },
                                { icon: '📝', label: 'Audit Trail', desc: 'Every upload, download, and delete is logged with user, IP, and timestamp' },
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 0', borderBottom: i < 5 ? '1px solid var(--g100)' : 'none' }}>
                                    <span style={{ fontSize: '18px', width: '28px', flexShrink: 0 }}>{item.icon}</span>
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--g800)', marginBottom: '2px' }}>{item.label}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--g500)' }}>{item.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Drive Folder Structure */}
                    <div style={{ border: '1px solid var(--g200)', borderRadius: '12px', padding: '24px', background: '#fff', marginBottom: '24px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--g900)', marginBottom: '16px' }}>Supabase Storage Structure</div>
                        <pre style={{ fontSize: '12px', color: 'var(--g700)', fontFamily: 'monospace', lineHeight: '1.8', margin: 0, background: 'var(--g50)', padding: '16px', borderRadius: '8px', overflowX: 'auto' }}>
{`erp-documents/ (Bucket)
├── CUST-000001/
│   ├── Documents/    (PAN, Aadhaar, Bank Passbook)
│   ├── Quotations/   (QTVA202627001_v1.pdf, _v2.pdf)
│   ├── Invoices/     (INVTVA202627001_v1.pdf)
│   ├── Payments/     (Payment proof screenshots)
│   ├── Images/       (House front, EB Meter photos)
│   ├── EB Documents/ (EB Receipt / Electricity Bills)
│   ├── GPS Photos/   (Rooftop GPS coordinates)
│   ├── Contracts/    (Signed agreements)
│   └── Installation/ (Site photos, completion reports)
└── CUST-000002/ ...`}
                        </pre>
                    </div>

                    {/* Setup Instructions */}
                    {!storageStatus?.storageConfigured && (
                        <div style={{ border: '1px solid #FFA000', borderRadius: '12px', padding: '24px', background: '#FFFDE7' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#E65100', marginBottom: '12px' }}>⚠️ Supabase Storage Setup Required</div>
                            <ol style={{ fontSize: '13px', color: 'var(--g700)', lineHeight: '2', paddingLeft: '20px', margin: 0 }}>
                                <li>Go to your <a href="https://app.supabase.com" target="_blank" rel="noreferrer" style={{ color: '#3949AB' }}>Supabase Dashboard <ExternalLink size={11} /></a></li>
                                <li>Navigate to <strong>Storage</strong></li>
                                <li>Create a new bucket named <strong>erp-documents</strong></li>
                                <li>Make sure it is set as <strong>Public</strong> (or configure appropriate RLS policies)</li>
                                <li>Ensure these are set in your <code>.env</code> file:<br/>
                                    <code style={{ background: '#F5F5F5', padding: '4px 8px', borderRadius: '4px', display: 'block', marginTop: '6px', fontSize: '11px' }}>
                                        SUPABASE_URL=https://...<br/>
                                        SUPABASE_SERVICE_KEY=...<br/>
                                        SUPABASE_BUCKET_NAME=erp-documents
                                    </code>
                                </li>
                                <li>Restart the backend server: <code>npm start</code></li>
                            </ol>
                        </div>
                    )}
                </div>
            )}

            <div style={{ marginTop: 20 }}>
                {activeTab !== 'storage' && (
                    <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
                        {saving ? <><Loader2 size={14} className="spinner" /> Saving...</> : 'Save Settings'}
                    </button>
                )}
            </div>
        </div>
    )
}
