import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { User, Save, X, Plus, Copy, Building, GripVertical, Trash2, CheckCircle } from 'lucide-react'
import { api, apiUrl, fmt, toast, displayName } from '../services/api'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import DocumentUploader from '../components/DocumentUploader'
import { SolarCalculationEngine, type LineItem } from '../services/SolarCalculationEngine'



export default function CreateQuotation() {
    const navigate = useNavigate()
    const { id } = useParams<{ id?: string }>()
    const isEdit = !!id

    const [customers, setCustomers] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])
    const INVENTORY_CATEGORIES = ['Solar Panels', 'Inverters', 'Batteries', 'Electricals', 'Mounting', 'Earthing', 'Services', 'Accessories']
    const CATEGORY_MAP: Record<string, string[]> = {
        'Solar Panels': ['Solar Panel'],
        'Inverters': ['On-Grid Inverter', 'Hybrid Inverter', 'Off-Grid Inverter'],
        'Batteries': ['Battery', 'Battery Box'],
        'Electricals': ['ACDB', 'DCDB', 'Lightning Arrester', 'DC Cable', 'AC Cable', 'MC4 Connector', 'PVC Pipe / Conduit'],
        'Mounting': ['Mounting Structure'],
        'Earthing': ['Earthing Rod', 'Earthing Chemical'],
        'Services': ['Installation Service', 'Transportation', 'Maintenance'],
        'Accessories': ['Other Accessories']
    }

    const { settings } = useSettings()
    const globalSettings = settings || {} as any
    const { user } = useAuth()

    // Form State - Customer Information & Document Collection (Section 0)
    const [skipCustomerInfo, setSkipCustomerInfo] = useState(false)
    const [customerSectionComplete, setCustomerSectionComplete] = useState(false)
    const [customerSectionDirty, setCustomerSectionDirty] = useState(false)
    const [isCustomerSubmitting, setIsCustomerSubmitting] = useState(false)
    const [consumerNumber, setConsumerNumber] = useState('')
    const [ebName, setEbName] = useState('')
    const [ebMobile, setEbMobile] = useState('')
    const [customerMobile, setCustomerMobile] = useState('')
    const [email, setEmail] = useState('')
    const [paymentMode, setPaymentMode] = useState('Full Payment') // 'Full Payment' | 'Loan'
    
    // Loan Details
    const [loanFinanceCompany, setLoanFinanceCompany] = useState('')
    const [loanAmount, setLoanAmount] = useState('')
    const [loanDownPayment, setLoanDownPayment] = useState('')
    const [loanTenure, setLoanTenure] = useState('')
    const [loanEmi, setLoanEmi] = useState('')
    const [loanStatus, setLoanStatus] = useState('Applied') // 'Applied' | 'Under Process' | 'Approved' | 'Rejected'
    
    // Document Uploads
    const [documents, setDocuments] = useState<Record<string, any>>({})

    // Form State - Company (Section 1)
    const [companyBranch, setCompanyBranch] = useState('')
    const [companyGst, setCompanyGst] = useState('')
    const [companyAddress, setCompanyAddress] = useState('')

    // Form State - Client (Section 2)
    const [customerId, setCustomerId] = useState('')
    const [clientCategory, setClientCategory] = useState('Residential')
    const [projectType, setProjectType] = useState('Grid-Tie')
    const [billingAddr, setBillingAddr] = useState('')
    const [siteAddr, setSiteAddr] = useState('')
    const [sameAsBilling, setSameAsBilling] = useState(true)
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])

    // Form State - Items (Section 3)
    const [items, setItems] = useState<LineItem[]>(() => {
        return Array.from({ length: 12 }).map((_, i) => ({
            id: `row-${i + 1}-${Math.random().toString(36).substring(2,9)}`,
            productId: '', productName: '', qty: 1, price: 0, gstRate: 18, hsnCode: '', description: ''
        }))
    })
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

    // Form State - Calculation options (Section 4)
    const [discount, setDiscount] = useState(0)
    const [splitGst, setSplitGst] = useState(true)
    const [roundOff, setRoundOff] = useState(true)
    

    // Form State - Terms (Section 5)
    const [notes, setNotes] = useState('Standard 10-year warranty on inverter, 30-year on panels.')
    const [exclusions, setExclusions] = useState('Civil work and TNEB approvals excluded.')

    // Load initial customer and product list
    const loadInitialData = useCallback(async () => {
        try {
            const [custData, prodData] = await Promise.all([
                api('GET', '/api/customers'),
                api('GET', '/api/products')
            ])
            setCustomers(custData || [])
            setProducts(prodData || [])

            // If editing, load the quotation data
            if (isEdit) {
                const qData = await api('GET', `/api/quotations/${encodeURIComponent(id || '')}`)
                if (qData) {
                    setCompanyBranch(qData.companyBranchId || '')
                    setCompanyGst(qData.companyGst || '')
                    setCompanyAddress(qData.companyAddress || '')
                    setCustomerId(qData.customerId || '')
                    setBillingAddr(qData.billingAddr || '')
                    setSiteAddr(qData.siteAddr || '')
                    setDate(qData.date?.split('T')[0] || date)
                    setDiscount(qData.discount || 0)

                    // Parse meta from notes
                    let pType = 'Grid-Tie'
                    let cCat = 'Residential'
                    let excl = 'Civil work and TNEB approvals excluded.'
                    if (qData.notes) {
                        const metaMatch = qData.notes.match(/\[Meta\] Project:\s*([^\s|]+)\s*\|\s*Category:\s*([^\s|]+)\s*\|\s*Exclusions:\s*(.*)/i);
                        if (metaMatch) {
                            pType = metaMatch[1];
                            cCat = metaMatch[2];
                            excl = metaMatch[3];
                            setNotes(qData.notes.split('\n\n[Meta]')[0]);
                        } else {
                            setNotes(qData.notes);
                        }
                    }
                    setProjectType(pType)
                    setClientCategory(cCat)
                    setExclusions(excl)

                    if (qData.items && qData.items.length > 0) {
                        setItems(qData.items.map((it: any) => ({
                            id: it.id || Math.random().toString(),
                            productId: it.productId || '',
                            productName: it.productName || it.name || '',
                            qty: Number(it.quantity || it.qty || 1),
                            price: Number(it.price || it.rate || 0),
                            gstRate: Number(it.gstRate || 18),
                            hsnCode: it.hsnCode || '',
                            description: it.description || ''
                        })))
                    }

                    // Load Customer Info & Documents
                    if (qData.customerInfo) {
                        setSkipCustomerInfo(qData.customerInfo.skipped || false)
                        setConsumerNumber(qData.customerInfo.consumerNumber || '')
                        setEbName(qData.customerInfo.ebName || '')
                        setEbMobile(qData.customerInfo.ebMobile || '')
                        setCustomerMobile(qData.customerInfo.customerMobile || '')
                        setEmail(qData.customerInfo.email || '')
                        setPaymentMode(qData.customerInfo.paymentMode || 'Full Payment')
                        
                        setLoanFinanceCompany(qData.customerInfo.loanFinanceCompany || '')
                        setLoanAmount(qData.customerInfo.loanAmount || '')
                        setLoanDownPayment(qData.customerInfo.loanDownPayment || '')
                        setLoanTenure(qData.customerInfo.loanTenure || '')
                        setLoanEmi(qData.customerInfo.loanEmi || '')
                        setLoanStatus(qData.customerInfo.loanStatus || 'Applied')
                    }
                    if (qData.documents) {
                        setDocuments(qData.documents)
                    }
                }
            }
        } catch { }
    }, [id, isEdit])

    useEffect(() => {
        loadInitialData()
    }, [loadInitialData])

    // Load Settings default branch if creating
    useEffect(() => {
        if (!isEdit) {
            if (user?.franchise_id) {
                setCompanyBranch(user.franchise_id)
                setCompanyGst(user.franchise_gst || '')
                setCompanyAddress(user.franchise_address || '')
            } else if (globalSettings && globalSettings.branches && globalSettings.branches.length > 0) {
                setCompanyBranch(globalSettings.branches[0].id)
                setCompanyGst(globalSettings.branches[0].gst)
                setCompanyAddress(globalSettings.branches[0].address)
            }
        }
    }, [globalSettings, isEdit, user])

    // Handle initial client selection and auto-populate data
    useEffect(() => {
        if (isEdit || !customerId) return;
        const cust = customers.find(c => c.id === customerId);
        if (cust) {
            setBillingAddr(cust.address || cust.billingAddr || '');
            if (sameAsBilling) {
                setSiteAddr(cust.address || cust.billingAddr || '');
            } else {
                setSiteAddr(cust.siteAddress || cust.address || '');
            }
            
            // Auto-populate customer info
            if (!customerMobile) setCustomerMobile(cust.mobile || cust.phone || '');
            if (!email) setEmail(cust.email || '');
            
            if (cust.customerInfo) {
                if (!consumerNumber) setConsumerNumber(cust.customerInfo.consumerNumber || '');
                if (!ebName) setEbName(cust.customerInfo.ebName || '');
                if (!ebMobile) setEbMobile(cust.customerInfo.ebMobile || '');
                if (!paymentMode || paymentMode === 'Full Payment') setPaymentMode(cust.customerInfo.paymentMode || 'Full Payment');
                if (!loanFinanceCompany) setLoanFinanceCompany(cust.customerInfo.loanFinanceCompany || '');
                if (!loanAmount) setLoanAmount(cust.customerInfo.loanAmount || '');
                if (!loanDownPayment) setLoanDownPayment(cust.customerInfo.loanDownPayment || '');
                if (!loanTenure) setLoanTenure(cust.customerInfo.loanTenure || '');
                if (!loanEmi) setLoanEmi(cust.customerInfo.loanEmi || '');
                if (!loanStatus || loanStatus === 'Applied') setLoanStatus(cust.customerInfo.loanStatus || 'Applied');
            }
            if (cust.documents && Object.keys(documents).length === 0) {
                setDocuments(cust.documents);
                // Assume complete if some basic docs are present
                if (cust.documents.eb_receipt || cust.documents.pan || cust.documents.aadhaar) {
                    setCustomerSectionComplete(true);
                }
            }
        }
    }, [customerId, sameAsBilling, customers, isEdit]);

    // Save Customer Info function
    const saveCustomerInfoAndDocs = async (e: React.MouseEvent) => {
        e.preventDefault();
        
        // Frontend Validation
        if (!customerMobile) {
            toast('Customer mobile is required.', 'error');
            return;
        }
        if (!paymentMode) {
            toast('Payment mode is required.', 'error');
            return;
        }
        
        setIsCustomerSubmitting(true);
        try {
            const formData = new FormData();
            if (customerId) formData.append('customerId', customerId);
            formData.append('mobile', customerMobile);
            formData.append('email', email);
            
            const info = {
                consumerNumber, ebName, ebMobile, paymentMode, 
                loanFinanceCompany, loanAmount, loanDownPayment, loanTenure, loanEmi, loanStatus
            };
            formData.append('customerInfo', JSON.stringify(info));
            
            // Append files
            Object.entries(documents).forEach(([key, val]) => {
                if (val instanceof File) {
                    formData.append(key, val);
                }
            });

            // Note: If 'id' is undefined (new quotation), we pass 'new' in URL.
            // The backend handles it safely and skips linking to quotation.
            const res = await fetch(apiUrl(`/api/quotations/${encodeURIComponent(id || 'new')}/complete-customer`), {
                method: 'POST',
                headers: {
                    'x-demo-auth': localStorage.getItem('sf_token') || ''
                },
                body: formData
            });
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to complete customer workflow');
            }
            
            const data = await res.json();
            
            // Auto-refresh frontend UI with saved data
            if (data.customer && data.customer.documents) {
                setDocuments(data.customer.documents);
            }
            if (data.customer && !customerId) {
                setCustomerId(data.customer.id);
            }
            
            toast('Customer information and documents have been saved successfully. All files have been uploaded to Supabase Storage and linked to this quotation.', 'success');
            setCustomerSectionComplete(true);
            setCustomerSectionDirty(false);
        } catch (err: any) {
            toast(err.message || 'Unable to save customer information. Please try again.', 'error');
        } finally {
            setIsCustomerSubmitting(false);
        }
    };

    // Handle Branch Selection Change
    const handleBranchChange = (e: any) => {
        const bId = e.target.value;
        setCompanyBranch(bId);
        const branch = globalSettings.branches?.find((b: any) => b.id === bId);
        if (branch) {
            setCompanyGst(branch.gst);
            setCompanyAddress(branch.address);
        }
    }

    // Item Management
    const addItem = () => {
        setItems([...items, { id: `row-${items.length + 1}-${Math.random().toString(36).substring(2,9)}`, productId: '', productName: '', qty: 1, price: 0, gstRate: 18, hsnCode: '', description: '' }])
    }
    const copyItem = (i: number) => {
        const newItems = [...items]
        const itemToCopy = { ...items[i], id: `row-${items.length + 1}-${Math.random().toString(36).substring(2,9)}` }
        newItems.splice(i + 1, 0, itemToCopy)
        setItems(newItems)
    }
    const removeItem = (i: number) => {
        setItems(items.filter((_, idx) => idx !== i))
    }

    const handleDragStart = (e: any, index: number) => {
        setDraggedIndex(index)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', index.toString())
    }
    const handleDrop = (e: any, dropIndex: number) => {
        e.preventDefault()
        if (draggedIndex === null || draggedIndex === dropIndex) return
        const newItems = [...items]
        const draggedItem = newItems[draggedIndex]
        newItems.splice(draggedIndex, 1)
        newItems.splice(dropIndex, 0, draggedItem)
        setItems(newItems)
        setDraggedIndex(null)
    }
    const handleDragOver = (e: any) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const updateItem = (i: number, field: string, val: any) => {
        const newItems = [...items]
        if (field === 'category') {
            newItems[i].category = val;
            newItems[i].productName = '';
            newItems[i].productId = '';
            newItems[i].price = 0;
            newItems[i].description = '';
            newItems[i].technicalSpecification = '';
        } else if (field === 'productId') {
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
                newItems[i] = { 
                    ...newItems[i], 
                    productId: val, 
                    productName: prod.name || '', 
                    price: Number(prod.sellingPrice || prod.price || 0), 
                    gstRate, 
                    hsnCode,
                    description: prod.description || '',
                    technicalSpecification: prod.technicalSpecification || '',
                    unit: prod.unit || 'Nos'
                }
            } else {
                newItems[i] = { ...newItems[i], productId: '', productName: '', price: 0, gstRate: Number(globalSettings.gstRate || 18), hsnCode: '', description: '', technicalSpecification: '', unit: 'Nos' }
            }
        } else if (field === 'productName') {
            newItems[i].productName = val;
            
            const prod = products.find(p => p.name === val)
            if (prod) {
                newItems[i].productId = prod.id;
                newItems[i].price = Number(prod.sellingPrice || prod.price || 0);
                newItems[i].gstRate = Number(prod.gstRate || globalSettings.gstRate || 18);
                newItems[i].description = prod.description || '';
                newItems[i].technicalSpecification = prod.technicalSpecification || '';
                newItems[i].unit = prod.unit || 'Nos';
                
                let hsnCode = prod.hsnCode || prod.hsn || '';
                if (!hsnCode) {
                    for (const hCode of (globalSettings.hsnCodes || [])) {
                        if ((prod.name || '').toLowerCase().includes(hCode.category.toLowerCase())) {
                            hsnCode = hCode.code;
                            break;
                        }
                    }
                }
                newItems[i].hsnCode = hsnCode;
            } else {
                newItems[i].productId = ''; 
                let matchedHsn = ''
                for (const hCode of (globalSettings.hsnCodes || [])) {
                    if (hCode.category && val.toLowerCase().includes(hCode.category.toLowerCase())) {
                        matchedHsn = hCode.code;
                        break;
                    }
                }
                if (matchedHsn) newItems[i].hsnCode = matchedHsn;
            }
        } else {
            (newItems[i] as any)[field] = field === 'qty' || field === 'price' || field === 'gstRate' ? Number(val) : val
        }
        setItems(newItems)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DYNAMIC SYSTEM SIZE & GENERATION CALCULATIONS via SolarCalculationEngine
    // ─────────────────────────────────────────────────────────────────────────
    const calc = SolarCalculationEngine.calculateDocument(items, discount, splitGst, roundOff);
    const {
        systemSizeKw,
        dailyGeneration: dailyGen,
        annualGeneration: annualGen,
        subsidyAmount,
        subtotal,
        totalGst,
        gstBreakdown,
        grandTotal,
        roundOffAmount,
        netCustomerCost
    } = calc;
    
    const saveQuotation = async (convertToInvoice = false) => {
        if (!skipCustomerInfo && !customerMobile) { toast('Customer Mobile Number is required in Section 0', 'error'); return }
        if (!customerId) { toast('Select a client from Client Details', 'error'); return }
        if (items.every(it => !it.productName && !it.productId)) { toast('Add at least one product', 'error'); return }
        const cust = customers.find(c => c.id === customerId)

        const extraMeta = `Project: ${projectType} | Category: ${clientCategory} | Exclusions: ${exclusions}`;

        const payload = {
            companyBranchId: companyBranch,
            companyGst,
            companyAddress,
            customerId,
            customerName: displayName(cust?.name || cust),
            date,
            billingAddr,
            siteAddr,
            notes: `${notes}\n\n[Meta] ${extraMeta}`,
            discount,
            status: convertToInvoice ? 'Invoiced' : (
                ['eb_receipt', 'pan', 'aadhaar', 'bank_passbook', 'rooftop_gps', 'house_front', 'eb_meter'].some(t => !documents[t]) ? 'Documents Pending' : 'Ready for Approval'
            ),
            items: items.filter(it => it.productName || it.productId),
            subtotal,
            totalTax: totalGst,
            grandTotal,
            total: grandTotal,
            
            customerInfo: {
                skipped: skipCustomerInfo,
                consumerNumber,
                ebName,
                ebMobile,
                customerMobile,
                email,
                paymentMode,
                loanFinanceCompany,
                loanAmount,
                loanDownPayment,
                loanTenure,
                loanEmi,
                loanStatus
            },
            documents,
            
            // Storing calculated fields for DB persistent consistency
            systemSizeKw: Number(systemSizeKw.toFixed(2)),
            dailyGeneration: Number(dailyGen.toFixed(2)),
            annualGeneration: Math.round(annualGen),
            gstAmount: totalGst,
            subsidyAmount: subsidyAmount,
            netCustomerCost: netCustomerCost
        }

        try {
            let saved;
            if (isEdit) {
                saved = await api('PUT', `/api/quotations/${encodeURIComponent(id || '')}`, payload)
                toast('Quotation updated successfully!')
            } else {
                saved = await api('POST', '/api/quotations', payload)
                toast('Quotation created successfully!')
            }
            navigate(`/view-quotation/${encodeURIComponent(saved.id || id || '')}`)
        } catch { toast('Failed to save quotation', 'error') }
    }

    const s_card = { background: '#fff', borderRadius: '12px', border: '1px solid var(--g200)', padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', marginBottom: '24px' };
    const s_input = { border: '1px solid var(--g200)', borderRadius: '6px', padding: '10px 14px', width: '100%', fontSize: '13.5px', outline: 'none', backgroundColor: '#fff', color: 'var(--g800)' };
    const s_label = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--g500)', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' };

    return (
        <div className="page active" style={{ backgroundColor: '#F9FAFB', minHeight: '100vh', padding: '32px' }}>
            <div className="breadcrumb">
                <a href="#" onClick={e => { e.preventDefault(); navigate('/quotations') }}>Quotations</a>
                <span className="bc-sep">›</span>
                <span className="bc-cur">{isEdit ? 'Edit Quotation' : 'New Quotation'}</span>
            </div>

            <div className="ph" style={{ marginBottom: '24px' }}>
                <div>
                    <h2>{isEdit ? 'Edit Quotation' : 'Create Solar Quotation'}</h2>
                    <div className="sub">Configure customer options, panel layouts, system capacity and subsidy structures.</div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-secondary" onClick={() => navigate('/quotations')}><X size={16} /> Cancel</button>
                    <button className="btn btn-primary" onClick={() => saveQuotation(false)}><Save size={16} /> {isEdit ? 'Update Quotation' : 'Save Quotation'}</button>
                </div>
            </div>

            
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                


                <div className="doc-layout" style={{ flex: 1, minWidth: 0, margin: 0 }}>

                <div className="doc-main">
                    
                    {/* Section 1: Company Profile Info */}
                    <div style={s_card}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--blue)', fontWeight: 600, fontSize: '16px', marginBottom: '20px' }}>
                            <Building size={18} /> Company Branch Settings
                        </div>
                        <div className="fr3">
                            <div>
                                <label style={s_label}>Company Branch</label>
                                <select style={s_input} value={companyBranch} onChange={handleBranchChange}>
                                    <option value="">Select branch...</option>
                                    {(globalSettings.branches || []).map((b: any) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={s_label}>Branch GSTIN</label>
                                <input style={{ ...s_input, backgroundColor: '#f9fafb' }} value={companyGst} readOnly />
                            </div>
                            <div style={{ gridColumn: '1 / -1', marginTop: '12px' }}>
                                <label style={s_label}>Branch Address</label>
                                <input style={{ ...s_input, backgroundColor: '#f9fafb' }} value={companyAddress} readOnly />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Client details Info */}
                    <div style={s_card}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F59E0B', fontWeight: 600, fontSize: '16px' }}>
                                <User size={18} /> Client Details
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/customers/new')}><Plus size={14} /> New Client</button>
                        </div>
                        <div className="fr3">
                            <div>
                                <label style={s_label}>Client Entity *</label>
                                <select style={s_input} value={customerId} onChange={e => setCustomerId(e.target.value)}>
                                    <option value="">Select client database...</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{displayName(c.name || c)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={s_label}>Client Category</label>
                                <select style={s_input} value={clientCategory} onChange={e => setClientCategory(e.target.value)}>
                                    <option value="Residential">Residential</option>
                                    <option value="Commercial">Commercial</option>
                                    <option value="Institution">Institution</option>
                                    <option value="Industrial">Industrial</option>
                                </select>
                            </div>
                            <div>
                                <label style={s_label}>Project Type</label>
                                <select style={s_input} value={projectType} onChange={e => setProjectType(e.target.value)}>
                                    <option value="Grid-Tie">Grid-Tie (On-Grid)</option>
                                    <option value="Hybrid">Hybrid System</option>
                                    <option value="Off-Grid">Off-Grid</option>
                                </select>
                            </div>
                            <div>
                                <label style={s_label}>Solar PV System Size (kW)</label>
                                <input style={{ ...s_input, backgroundColor: '#f3f4f6', cursor: 'not-allowed', fontWeight: 600 }} readOnly value={systemSizeKw.toFixed(2)} />
                            </div>
                            <div style={{ gridColumn: '2 / 4' }}>
                                <label style={s_label}>Billing Address</label>
                                <input style={s_input} value={billingAddr} onChange={e => setBillingAddr(e.target.value)} placeholder="Full billing address..." />
                            </div>
                            <div>
                                <label style={s_label}>Quotation Date</label>
                                <input type="date" style={s_input} value={date} onChange={e => setDate(e.target.value)} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label style={{ ...s_label, marginBottom: 0 }}>Site / Installation Location</label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--g700)', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={sameAsBilling} onChange={e => {
                                            setSameAsBilling(e.target.checked);
                                            if (e.target.checked) setSiteAddr(billingAddr);
                                        }} />
                                        Address same as Billing Address
                                    </label>
                                </div>
                                <input style={s_input} value={sameAsBilling ? billingAddr : siteAddr} onChange={e => setSiteAddr(e.target.value)} disabled={sameAsBilling} placeholder="Site installation address..." />
                            </div>
                        </div>
                    </div>

                    {/* Section 0: Customer Information & Document Collection */}
                    <div style={s_card} onChange={() => { if (customerSectionComplete) setCustomerSectionDirty(true); }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--blue)', fontWeight: 600, fontSize: '16px' }}>
                                <User size={18} /> Customer Information & Document Collection
                                {customerSectionComplete ? (
                                    <span className="badge badge-success" style={{ marginLeft: '10px' }}>🟢 Completed</span>
                                ) : skipCustomerInfo ? (
                                    <span className="badge badge-warning" style={{ marginLeft: '10px', backgroundColor: '#fff3cd', color: '#856404' }}>🟡 Documents Pending</span>
                                ) : (
                                    <span className="badge badge-info" style={{ marginLeft: '10px', backgroundColor: '#ffedd5', color: '#c2410c' }}>🟠 In Progress</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="button" className={`btn btn-sm ${!skipCustomerInfo ? 'btn-primary' : 'btn-outline'}`} onClick={(e) => { e.preventDefault(); setSkipCustomerInfo(false); }}>Provide Details</button>
                                <button type="button" className={`btn btn-sm ${skipCustomerInfo ? 'btn-primary' : 'btn-outline'}`} onClick={(e) => { e.preventDefault(); setSkipCustomerInfo(true); }}>Skip & Update Later</button>
                            </div>
                        </div>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
                            These details are required for subsidy processing, loan processing, and project execution. You may complete them now or skip and update them later.
                        </div>

                        {!skipCustomerInfo && (
                            <>
                                <div className="fr3">
                                    <div><label style={s_label}>Consumer Number (EB)</label><input style={s_input} placeholder="Optional" value={consumerNumber} onChange={e => setConsumerNumber(e.target.value)} /></div>
                                    <div><label style={s_label}>Name as per EB</label><input style={s_input} placeholder="Optional" value={ebName} onChange={e => setEbName(e.target.value)} /></div>
                                    <div><label style={s_label}>Registered EB Mobile</label><input style={s_input} placeholder="Optional" value={ebMobile} onChange={e => setEbMobile(e.target.value)} /></div>
                                </div>
                                <div className="fr3" style={{ marginTop: '15px' }}>
                                    <div><label style={s_label}>Customer Mobile <span style={{ color: 'red' }}>*</span></label><input style={s_input} placeholder="Required" value={customerMobile} onChange={e => setCustomerMobile(e.target.value)} /></div>
                                    <div><label style={s_label}>Email Address</label><input style={s_input} placeholder="Optional" value={email} onChange={e => setEmail(e.target.value)} /></div>
                                    <div>
                                        <label style={s_label}>Payment Mode</label>
                                        <select style={s_input} value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                                            <option value="Full Payment">Full Payment</option>
                                            <option value="Loan">Loan</option>
                                        </select>
                                    </div>
                                </div>

                                {paymentMode === 'Loan' && (
                                    <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f7ff', borderRadius: '8px', border: '1px solid #cce5ff' }}>
                                        <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#004085' }}>Loan Details</h4>
                                        <div className="fr3">
                                            <div><label style={s_label}>Finance Company / Bank</label><input style={s_input} value={loanFinanceCompany} onChange={e => setLoanFinanceCompany(e.target.value)} /></div>
                                            <div><label style={s_label}>Loan Amount</label><input style={s_input} type="number" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} /></div>
                                            <div><label style={s_label}>Down Payment</label><input style={s_input} type="number" value={loanDownPayment} onChange={e => setLoanDownPayment(e.target.value)} /></div>
                                        </div>
                                        <div className="fr3" style={{ marginTop: '15px' }}>
                                            <div><label style={s_label}>Loan Tenure (Months)</label><input style={s_input} type="number" value={loanTenure} onChange={e => setLoanTenure(e.target.value)} /></div>
                                            <div><label style={s_label}>EMI (Optional)</label><input style={s_input} type="number" value={loanEmi} onChange={e => setLoanEmi(e.target.value)} /></div>
                                            <div>
                                                <label style={s_label}>Loan Status</label>
                                                <select style={s_input} value={loanStatus} onChange={e => setLoanStatus(e.target.value)}>
                                                    <option>Applied</option>
                                                    <option>Under Process</option>
                                                    <option>Approved</option>
                                                    <option>Rejected</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginTop: '30px' }}>
                                    <h4 style={{ margin: '0 0 15px 0', fontSize: '15px', fontWeight: 'bold' }}>Required Documents</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <DocumentUploader id="eb_receipt" title="EB Receipt / Electricity Bill" acceptedFormats="PDF, JPG, PNG" value={documents['eb_receipt']} onChange={val => setDocuments(p => ({...p, eb_receipt: val}))} />
                                        <DocumentUploader id="pan" title="PAN Card" acceptedFormats="PDF, JPG, PNG" value={documents['pan']} onChange={val => setDocuments(p => ({...p, pan: val}))} />
                                        <DocumentUploader id="aadhaar" title="Aadhaar Card" acceptedFormats="PDF, JPG, PNG" value={documents['aadhaar']} onChange={val => setDocuments(p => ({...p, aadhaar: val}))} />
                                        <DocumentUploader id="bank_passbook" title="Bank Passbook (First Page)" acceptedFormats="PDF, JPG, PNG" value={documents['bank_passbook']} onChange={val => setDocuments(p => ({...p, bank_passbook: val}))} />
                                        <DocumentUploader id="rooftop_gps" title="Rooftop GPS Photo" acceptedFormats="JPG, PNG" value={documents['rooftop_gps']} onChange={val => setDocuments(p => ({...p, rooftop_gps: val}))} />
                                        <DocumentUploader id="house_front" title="Front View of House" acceptedFormats="JPG, PNG" value={documents['house_front']} onChange={val => setDocuments(p => ({...p, house_front: val}))} />
                                        <DocumentUploader id="eb_meter" title="EB Meter Photo" acceptedFormats="JPG, PNG" value={documents['eb_meter']} onChange={val => setDocuments(p => ({...p, eb_meter: val}))} />
                                    </div>
                                </div>
                                <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                                    {isCustomerSubmitting ? (
                                        <button type="button" className="btn btn-primary" disabled style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span> Saving...
                                        </button>
                                    ) : customerSectionComplete && !customerSectionDirty ? (
                                        <button type="button" className="btn btn-success" disabled style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#16a34a', color: 'white', opacity: 0.9 }}>
                                            <CheckCircle size={16} /> Customer Information Completed
                                        </button>
                                    ) : customerSectionComplete && customerSectionDirty ? (
                                        <button type="button" className="btn btn-outline" onClick={saveCustomerInfoAndDocs} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Save size={16} /> Update Customer Information
                                        </button>
                                    ) : (
                                        <button type="button" className="btn btn-primary" onClick={saveCustomerInfoAndDocs} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Save size={16} /> Complete Now
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Section 3: Itemized System Configuration */}
                    <div style={{ ...s_card, overflowX: 'auto', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--g900)' }}>Technical Specifications & Items</div>
                        </div>

                        <div className="li-tbl-wrap">
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '780px' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'var(--g100)', color: 'var(--g700)', textAlign: 'left', borderBottom: '1px solid var(--g200)' }}>
                                    <th style={{ padding: '12px 8px', width: '32px' }}></th>
                                    <th style={{ padding: '12px 8px', width: '50px' }}>No.</th>
                                    <th style={{ padding: '12px 8px', minWidth: '350px' }}>Product & Description</th>
                                    <th style={{ padding: '12px 8px', width: '120px' }}>Qty</th>
                                    <th style={{ padding: '12px 8px', width: '160px' }}>Unit Price (₹)</th>
                                    <th style={{ padding: '12px 8px', width: '90px' }}>GST %</th>
                                    <th style={{ padding: '12px 8px', width: '80px', textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr 
                                        key={item.id} 
                                        draggable 
                                        onDragStart={(e) => handleDragStart(e, idx)} 
                                        onDragOver={handleDragOver} 
                                        onDrop={(e) => handleDrop(e, idx)}
                                        style={{ 
                                            borderBottom: '1px solid var(--g200)', 
                                            backgroundColor: draggedIndex === idx ? 'var(--g50)' : '#fff',
                                            transition: 'background-color 0.2s'
                                        }}
                                    >
                                        <td style={{ padding: '12px 8px', cursor: 'grab', color: 'var(--g400)' }} title="Drag to reorder">
                                            <GripVertical size={16} />
                                        </td>
                                        <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--g600)', verticalAlign: 'top' }}>
                                            {String(idx + 1).padStart(2, '0')}
                                        </td>
                                        <td style={{ padding: '12px 8px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <select
                                                    style={{ ...s_input, fontSize: '12px', padding: '5px 10px', color: 'var(--g600)', backgroundColor: 'var(--g50)' }}
                                                    value={item.category || ''}
                                                    onChange={e => updateItem(idx, 'category', e.target.value)}
                                                >
                                                    <option value="">All Categories</option>
                                                    {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                                <div style={{ position: 'relative' }}>
                                                    <input 
                                                        style={{ ...s_input, fontWeight: 600, color: 'var(--g900)', width: '100%' }} 
                                                        value={item.productName} 
                                                        onChange={e => updateItem(idx, 'productName', e.target.value)} 
                                                        placeholder="Search or enter product name..." 
                                                        onFocus={() => setActiveDropdown(item.id || null)}
                                                        onBlur={() => setActiveDropdown(null)}
                                                    />
                                                    {activeDropdown === item.id && (
                                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, backgroundColor: '#fff', border: '1px solid var(--g200)', borderRadius: '6px', maxHeight: '250px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '4px' }}>
                                                            {(() => {
                                                                const filtered = products.filter(p => {
                                                                    if (item.category) {
                                                                        const allowedCats = CATEGORY_MAP[item.category];
                                                                        if (allowedCats && !allowedCats.includes(p.category || '')) return false;
                                                                        if (!allowedCats && p.category !== item.category) return false;
                                                                    }
                                                                    if (item.productName && !(p.name || '').toLowerCase().includes(item.productName.toLowerCase())) return false;
                                                                    return true;
                                                                });
                                                                
                                                                if (filtered.length === 0) {
                                                                    return <div style={{ padding: '8px 12px', fontSize: '13px', color: 'var(--g500)', textAlign: 'center' }}>No matching products found</div>;
                                                                }
                                                                
                                                                return filtered.map(p => (
                                                                    <div 
                                                                        key={p.id} 
                                                                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--g100)', fontSize: '13px', transition: 'background-color 0.1s' }}
                                                                        onMouseDown={(e) => e.preventDefault()}
                                                                        onClick={() => {
                                                                            updateItem(idx, 'productName', p.name);
                                                                            setActiveDropdown(null);
                                                                        }}
                                                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--g50)'}
                                                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                                    >
                                                                        <div style={{ fontWeight: 600, color: 'var(--g900)' }}>{p.name}</div>
                                                                        {p.category && <div style={{ fontSize: '11px', color: 'var(--g500)', marginTop: '2px' }}>{p.category}</div>}
                                                                    </div>
                                                                ));
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                                <textarea 
                                                    style={{ ...s_input, height: '60px', resize: 'vertical', fontSize: '13px', lineHeight: '1.4' }} 
                                                    value={item.description || ''} 
                                                    onChange={e => updateItem(idx, 'description', e.target.value)} 
                                                    placeholder="Short Description..." 
                                                />
                                                <textarea 
                                                    style={{ ...s_input, height: '60px', resize: 'vertical', fontSize: '13px', lineHeight: '1.4' }} 
                                                    value={item.technicalSpecification || ''} 
                                                    onChange={e => updateItem(idx, 'technicalSpecification', e.target.value)} 
                                                    placeholder="Technical specifications..." 
                                                />
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 8px', verticalAlign: 'top' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input type="number" className="no-spinners" style={{ ...s_input, padding: '8px', textAlign: 'center', width: '80px', minWidth: '60px' }} value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} min={1} onWheel={e => e.currentTarget.blur()} />
                                                <span style={{ fontSize: '12px', color: 'var(--g500)' }}>{item.unit || 'Nos'}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 8px', verticalAlign: 'top' }}>
                                            <input type="number" className="no-spinners" style={{ ...s_input, padding: '8px', width: '100%', minWidth: '100px' }} value={item.price} onChange={e => updateItem(idx, 'price', e.target.value)} onWheel={e => e.currentTarget.blur()} />
                                        </td>
                                        <td style={{ padding: '12px 8px', verticalAlign: 'top' }}>
                                            <select style={s_input} value={item.gstRate} onChange={e => updateItem(idx, 'gstRate', e.target.value)}>
                                                <option value="0">0%</option>
                                                <option value="5">5%</option>
                                                <option value="12">12%</option>
                                                <option value="18">18%</option>
                                                <option value="28">28%</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '12px 8px', verticalAlign: 'top', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                                                <button className="btn btn-secondary btn-sm" style={{ padding: '6px', color: 'var(--blue)', border: 'none', background: 'transparent' }} onClick={() => copyItem(idx)} title="Duplicate Row"><Copy size={16} /></button>
                                                <button className="btn btn-secondary btn-sm" style={{ padding: '6px', color: 'var(--red)', border: 'none', background: 'transparent' }} onClick={() => removeItem(idx)} title="Delete Row"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>{/* end li-tbl-wrap */}

                        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-start' }}>
                            <button className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={14} /> Add New Specification Row</button>
                        </div>
                    </div>

                    {/* Section 5: Standard Exclusions & Notes */}
                    <div style={s_card}>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--g900)', marginBottom: '20px' }}>Standard Exclusions & Quotation Details</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={s_label}>Quotation Notes (Included Scope)</label>
                                <textarea style={{ ...s_input, height: '80px', resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} />
                            </div>
                            <div>
                                <label style={s_label}>Work Exclusions (E.g. TNEB approval, Liaison, Structural fabrication)</label>
                                <textarea style={{ ...s_input, height: '80px', resize: 'vertical' }} value={exclusions} onChange={e => setExclusions(e.target.value)} />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Section 4: Auto Calculation Logic (Sidebar Panel) */}
                <div className="doc-sidebar">
                    <div style={{ ...s_card, position: 'sticky', top: '24px', padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '20px', backgroundColor: '#1F2937', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, fontSize: '16px' }}>Quotation Summary</span>
                        </div>
                        <div style={{ padding: '24px' }}>

                            {/* Solar Calculation Meta Section */}
                                <div style={{ backgroundColor: 'var(--blue-pale)', borderRadius: '8px', padding: '12px', marginBottom: '16px', border: '1px solid var(--blue-lt)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--blue)', marginBottom: '8px', textTransform: 'uppercase' }}>Solar PV Size & Generation</div>
                                    <div style={{ display: 'flex', fontSize: '12.5px', marginBottom: '4px', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--g600)' }}>System Capacity:</span>
                                        <span style={{ fontWeight: 700 }}>{systemSizeKw.toFixed(2)} kW</span>
                                    </div>
                                    <div style={{ display: 'flex', fontSize: '12.5px', marginBottom: '4px', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--g600)' }}>Daily Generation:</span>
                                        <span style={{ fontWeight: 600 }}>{dailyGen.toFixed(2)} Units</span>
                                    </div>
                                    <div style={{ display: 'flex', fontSize: '12.5px', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--g600)' }}>Annual Generation:</span>
                                        <span style={{ fontWeight: 600 }}>{annualGen.toLocaleString()} kWh/Yr</span>
                                    </div>
                                </div>

                            {/* Summary Rows */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                                <span style={{ color: 'var(--g600)' }}>Subtotal (Before Tax)</span>
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

                            {/* GST Summary */}
                            {splitGst ? (
                                <div style={{ backgroundColor: 'var(--orange-pale)', borderRadius: '8px', padding: '12px', marginBottom: '16px', border: '1px solid var(--orange-lt)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#D97706', marginBottom: '8px', textTransform: 'uppercase' }}>GST Breakdown (MNRE 8.9%)</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--g700)', marginBottom: '4px' }}>
                                        <span>CGST @ 2.5% + SGST @ 2.5% (70%)</span>
                                        <span>{fmt(gstBreakdown.cgst5 + gstBreakdown.sgst5)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--g700)', marginBottom: '4px' }}>
                                        <span>CGST @ 9% + SGST @ 9% (30%)</span>
                                        <span>{fmt(gstBreakdown.cgst18 + gstBreakdown.sgst18)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#D97706', borderTop: '1px solid var(--orange-lt)', marginTop: '8px', paddingTop: '8px' }}>
                                        <span>Effective GST Amount</span>
                                        <span>{fmt(totalGst)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px', padding: '10px 12px', backgroundColor: 'var(--g50)', borderRadius: '6px', border: '1px solid var(--g200)' }}>
                                    <span style={{ color: 'var(--g600)' }}>GST Amount</span>
                                    <span style={{ fontWeight: 600 }}>{fmt(totalGst)}</span>
                                </div>
                            )}

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

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'flex-end' }}>
                                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--g900)' }}>Grand Total</span>
                                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--g900)' }}>{fmt(grandTotal)}</span>
                            </div>

                            {/* Subsidy Display row */}
                            {subsidyAmount > 0 && (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14.5px', color: '#059669', fontWeight: 600 }}>
                                        <span>MNRE Subsidy</span>
                                        <span>- {fmt(subsidyAmount)}</span>
                                    </div>
                                    <div style={{ padding: '10px 12px', backgroundColor: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0', marginBottom: '16px' }}>
                                        <div style={{ fontSize: '11px', color: '#047857', marginBottom: '4px', fontWeight: 600 }}>After Completion of Project, the MNRE Subsidy will be credited directly to the Beneficiary's Bank Account.</div>
                                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>{fmt(subsidyAmount)}</div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'flex-end', borderTop: '2px solid var(--g200)', paddingTop: '12px' }}>
                                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--g900)' }}>Net Customer Cost</span>
                                        <span style={{ fontSize: '24px', fontWeight: 800, color: '#1E3A8A' }}>{fmt(netCustomerCost)}</span>
                                    </div>
                                </>
                            )}

                            {/* Payment Terms */}
                            <div style={{ backgroundColor: 'var(--g50)', borderRadius: '8px', padding: '16px', border: '1px solid var(--g200)', marginBottom: '24px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g600)', marginBottom: '12px', textTransform: 'uppercase' }}>Payment Terms</div>
                                <div 
                                    style={{ fontSize: '13px', color: 'var(--g700)', lineHeight: '1.6', paddingLeft: '4px' }} 
                                    dangerouslySetInnerHTML={{ __html: globalSettings.quotation?.content?.page1?.paymentTerms || '<ul><li>10% Advance against Confirmed Purchase Order</li><li>70% Procurement of Raw Material</li><li>10% Before Dispatch / Installation</li><li>10% After Successful Installation & Commissioning</li></ul>' }}
                                />
                            </div>

                            <button className="btn btn-primary btn-full" onClick={() => saveQuotation(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Save size={16} /> {isEdit ? 'Update Quotation' : 'Save Quotation'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </div>
    )
}
