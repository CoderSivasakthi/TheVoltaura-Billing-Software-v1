import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CreditCard, Printer, Edit3, CheckCircle, XCircle } from 'lucide-react'
import { api, fmt, fmtDate, toast, displayName } from '../services/api'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import ERPDocumentHeader from '../components/ERPDocumentHeader'
import ClassicInvoiceTemplate from '../components/ClassicInvoiceTemplate'
import { BUSINESS_RULES } from '../config/businessRules'

const COMPANY = {
    name: 'THEVOLTAURA PRIVATE LTD',
    tagline: 'Powering Buildings. Empowering Futures.',
    address: '5/244- Milk Diary Street, Villarasampatti 4 Road, Thidal Post-638 012.',
    phone: '9655079555',
    email: 'tnsolarstore@gmail.com',
    gst: '33CHIPS0142Q1Z0',
}

const ITEMS_PER_PAGE = 8

const inr = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function InvoiceHeader({ inv, invNo, invoiceDate, customerName, customerAddr, customerGst, companyData }: any) {
    const td: React.CSSProperties = { border: '2px solid #000', padding: '4px 7px', fontSize: '11px', verticalAlign: 'top', borderColor: '#000' }
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0, border: '2px solid #000', borderBottom: 'none' }}>
            <tbody>
                <tr>
                    <td colSpan={2} style={{ background: '#d1def0', textAlign: 'center', padding: '6px', position: 'relative', borderBottom: '2px solid #000' }}>
                        <div style={{ fontSize: '22px', fontWeight: 900, color: '#000', letterSpacing: 1, marginBottom: '2px' }}>{companyData.name}</div>
                        <div style={{ fontSize: '11px', color: '#000', marginBottom: '2px' }}>{companyData.tagline}</div>
                        <div style={{ fontSize: '11px', color: '#000', marginBottom: '4px' }}>{companyData.address}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#000', padding: '0 40px' }}>
                            <span>Phone : {companyData.phone}</span>
                            <span>mail : {companyData.email}</span>
                        </div>
                        <div style={{ position: 'absolute', top: 6, right: 6, width: '100px', height: '60px' }}>
                            <img src={companyData.dynamicLogo} alt={companyData.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }} />
                        </div>
                    </td>
                </tr>
                <tr>
                    <td colSpan={2} style={{ background: '#d1def0', color: '#000', textAlign: 'center', padding: '4px', fontWeight: 700, fontSize: '13px', borderBottom: '2px solid #000' }}>
                        GST : {companyData.gst}
                    </td>
                </tr>
                <tr>
                    <td style={{ ...td, width: '50%', padding: '0', borderBottom: 'none' }}>
                        <div style={{ padding: '4px 8px' }}>
                            <div style={{ fontWeight: 900, fontSize: '14px', marginBottom: 2 }}>To</div>
                            <div style={{ fontSize: '12px', textTransform: 'uppercase', marginBottom: 2 }}>{customerName}</div>
                            {customerAddr && <div style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>{customerAddr}</div>}
                        </div>
                    </td>
                    <td style={{ ...td, width: '50%', padding: 0, borderBottom: 'none' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', height: '100%' }}>
                            <tbody>
                                <tr>
                                    <td style={{ borderBottom: '2px solid #000', borderRight: '2px solid #000', padding: '4px', background: '#d1facb', fontWeight: 900, fontSize: '16px', textAlign: 'center', width: '35%' }}>
                                        INVOICE
                                    </td>
                                    <td style={{ borderBottom: '2px solid #000', padding: '4px', fontWeight: 900, fontSize: '14px', textAlign: 'center', width: '30%', background: '#d1def0' }}>
                                        {invNo}
                                    </td>
                                    <td style={{ borderBottom: '2px solid #000', borderLeft: '2px solid #000', padding: '4px', background: '#d1def0', fontWeight: 700, fontSize: '12px', textAlign: 'center', width: '15%' }}>
                                        Date :
                                    </td>
                                    <td style={{ borderBottom: '2px solid #000', padding: '4px', fontWeight: 700, fontSize: '12px', textAlign: 'center', width: '20%', background: '#d1def0' }}>
                                        {invoiceDate}
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={{ borderBottom: '1px solid #000', borderRight: '2px solid #000', padding: '3px 6px', background: '#d1def0', fontSize: '11px', textAlign: 'center' }}>Application Reg. No.</td>
                                    <td colSpan={2} style={{ borderBottom: '1px solid #000', padding: '3px 6px', fontSize: '11px', background: '#d1def0' }}>{inv.appRegNo || ''}</td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={{ borderBottom: '1px solid #000', borderRight: '2px solid #000', padding: '3px 6px', background: '#d1def0', fontSize: '11px', textAlign: 'center' }}>Application Sanction. No.</td>
                                    <td colSpan={2} style={{ borderBottom: '1px solid #000', padding: '3px 6px', fontSize: '11px', background: '#d1def0' }}>{inv.appSanctionNo || ''}</td>
                                </tr>
                                <tr>
                                    <td colSpan={2} style={{ borderBottom: '2px solid #000', borderRight: '2px solid #000', padding: '3px 6px', background: '#d1def0', fontSize: '11px', textAlign: 'center' }}>TANGEDCO Service No.</td>
                                    <td colSpan={2} style={{ borderBottom: '2px solid #000', padding: '3px 6px', fontSize: '11px', background: '#d1def0' }}>{inv.tangedcoNo || ''}</td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style={{ ...td, padding: '4px 10px', verticalAlign: 'middle' }}>
                        <span style={{ float: 'left' }}>GST : {customerGst || 'N/A'}</span>
                    </td>
                    <td style={{ ...td, padding: 0 }}>
                        <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '3px 6px', borderBottom: '1px solid #000', borderRight: '2px solid #000', width: '40%', background: '#d1facb', color: '#000', textAlign: 'center' }}>Sent Through</td>
                                    <td style={{ padding: '3px 6px', borderBottom: '1px solid #000', background: '#d1facb' }}>{inv.dispatchedThrough || ''}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '3px 6px', borderRight: '2px solid #000', background: '#d1facb', color: '#000', textAlign: 'center' }}>L.R./R.R. No.</td>
                                    <td style={{ padding: '3px 6px', background: '#d1facb' }}>{inv.lrRrNo || ''}</td>
                                </tr>
                            </tbody>
                        </table>
                    </td>
                </tr>
            </tbody>
        </table>
    )
}

function ItemsHead({ th }: { th: React.CSSProperties }) {
    return (
        <thead>
            <tr>
                <th style={{ ...th, width: '6%', borderTop: 'none' }}>S.No.</th>
                <th style={{ ...th, width: '25%', borderTop: 'none', textAlign: 'left' }}>Product Name</th>
                <th style={{ ...th, width: '45%', borderTop: 'none', textAlign: 'left' }}>Technical Specification / Description</th>
                <th style={{ ...th, width: '12%', borderTop: 'none' }}>HSN/SAC</th>
                <th style={{ ...th, width: '6%', borderTop: 'none' }}>Quantity</th>
                <th style={{ ...th, width: '6%', borderTop: 'none', borderRight: 'none' }}>Unit</th>
            </tr>
        </thead>
    )
}

export default function ViewInvoice() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { settings } = useSettings()
    const auth = useAuth()
    const [inv, setInv] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [template, setTemplate] = useState<'modern' | 'classic'>('classic')

    const loadInvoice = useCallback(async () => {
        try {
            const data = await api('GET', `/api/invoices/${encodeURIComponent(id || '')}`)
            setInv(data)
        } catch {
            toast('Invoice not found', 'error')
            navigate('/invoices')
        } finally { setLoading(false) }
    }, [id, navigate])

    useEffect(() => { loadInvoice() }, [loadInvoice])

    const companyData = {
        name: settings?.orgName || COMPANY.name,
        tagline: COMPANY.tagline,
        address: inv?.companyAddress || inv?.company_address || settings?.branches?.[0]?.address || COMPANY.address,
        phone: settings?.phone || COMPANY.phone,
        email: settings?.email || COMPANY.email,
        gst: inv?.companyGst || inv?.company_gst || settings?.branches?.[0]?.gst || COMPANY.gst,
        dynamicLogo: settings?.logo || '/assets/company-logo.png'
    }

    if (loading) return <div className="page active" style={{ padding: 40, textAlign: 'center', color: 'var(--g400)' }}>Loading invoice...</div>
    if (!inv) return <div className="page active" style={{ padding: 40, textAlign: 'center' }}>Invoice not found.</div>

    const updatePaymentStatus = async (newStatus: 'Paid' | 'Pending') => {
        if (!inv) return
        try {
            await api('PUT', `/api/invoices/${encodeURIComponent(id || '')}`, { ...inv, status: newStatus })
            if (newStatus === 'Paid') {
                const due = grandTotal
                    - (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
                if (due > 0) {
                    await api('POST', `/api/payments`, {
                        invoiceId: id, amount: due, method: 'Bank Transfer',
                        date: new Date().toISOString().split('T')[0], reference: 'Auto-marked as Paid'
                    }).catch(() => { })
                }
            }
            toast(`Invoice marked as ${newStatus}`)
            loadInvoice()
        } catch { toast('Failed to update payment status', 'error') }
    }

    const handleSubmitApproval = async () => {
        try {
            await api('POST', `/api/invoices/${encodeURIComponent(id || '')}/submit`);
            toast('Invoice submitted for approval!');
            loadInvoice();
        } catch (e: any) {
            toast(e.message || 'Failed to submit invoice', 'error');
        }
    }

    const handleApprove = async () => {
        try {
            await api('POST', `/api/invoices/${encodeURIComponent(id || '')}/approve`);
            toast('Invoice approved');
            loadInvoice();
        } catch (e: any) {
            toast(e.message || 'Failed to approve invoice', 'error');
        }
    }

    const handleReject = async () => {
        const reason = window.prompt('Rejection reason');
        if (!reason || !reason.trim()) return;
        try {
            await api('POST', `/api/invoices/${encodeURIComponent(id || '')}/reject`, { reason: reason.trim() });
            toast('Invoice rejected');
            loadInvoice();
        } catch (e: any) {
            toast(e.message || 'Failed to reject invoice', 'error');
        }
    }

    const items: any[] = inv.items || []
    
    // Prefer database subtotal, fallback to robust item calculation checking rate/price
    const subtotal = Number(inv.subtotal) || items.reduce((s, it) => s + (Number(it.qty || it.quantity || 1) * Number(it.price || it.rate || 0)), 0)

    // HSN Breakdown Logic
    const hsnMap: Record<string, { taxable: number; rate: number }> = {}
    let totalTaxCalculated = 0;

    items.forEach((it) => {
        const hsn = String(it.hsn || it.hsnCode || '').trim() || BUSINESS_RULES.GST.hsnPanelCode
        const lineAmt = Number(it.qty || 1) * Number(it.price || 0)
        let rate = Number(it.gstRate || 0);

        // Fallback or custom splits based on requirements
        if (rate === 0 && hsn === BUSINESS_RULES.GST.hsnPanelCode) rate = BUSINESS_RULES.GST.hsnPanelFallbackRate;
        if (rate === 0 && hsn !== BUSINESS_RULES.GST.hsnPanelCode) rate = BUSINESS_RULES.GST.hsnOtherFallbackRate;

        if (!hsnMap[hsn]) hsnMap[hsn] = { taxable: 0, rate }
        hsnMap[hsn].taxable += lineAmt
    })
    let hsnRows = Object.entries(hsnMap)

    let sgst = 0;
    let cgst = 0;

    hsnRows.forEach(([_hsn, data]) => {
        const taxAmt = data.taxable * (data.rate / 100);
        sgst += taxAmt / 2;
        cgst += taxAmt / 2;
        totalTaxCalculated += taxAmt;
    });

    const discount = Number(inv.discount) || 0;
    
    // Use backend-calculated values if available, check snake_case properties as well
    const totalTax = Number(inv.total_tax) || Number(inv.totalTax) || Number(inv.gst) || 0;
    const computedGrandTotal = subtotal + totalTax - discount;
    const roundOffAmount = inv.roundOffAmount ?? (Math.round(computedGrandTotal) - computedGrandTotal);
    
    // Prefer database grandTotal, checking snake_case property
    const grandTotal = Number(inv.grand_total) || Number(inv.grandTotal) || Math.round(computedGrandTotal);

    const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
    const amountDue = grandTotal - paid

    const invNo = inv.id || '—'
    
    // Customer Info
    const customerName = displayName(inv.customerName || inv.customer_name || inv.quotation?.customerName || inv.quotation?.customer_name || inv.customer?.name || inv.customer)
    const customerAddr = inv.customerAddress || inv.billingAddr || inv.billing_addr || inv.quotation?.billingAddr || inv.quotation?.billing_addr || inv.customer?.address || inv.customer?.billingAddr || ''
    const customerCity = inv.customer?.city || inv.quotation?.customerInfo?.city || ''
    const customerState = inv.customer?.state || inv.quotation?.customerInfo?.state || ''
    const customerPincode = inv.customer?.pincode || inv.customer?.pin || inv.quotation?.customerInfo?.pincode || ''
    const customerGst = inv.customerGst || inv.customer_gst || inv.quotation?.customerInfo?.gst || inv.customer?.gst || inv.customer?.gstin || inv.customer?.gstNumber || ''
    const customerMobile = inv.customerMobile || inv.customer_mobile || inv.quotation?.customerInfo?.customerMobile || inv.quotation?.customerInfo?.mobile || inv.customer?.phone || inv.customer?.mobile || ''
    const customerEmail = inv.customerEmail || inv.customer_email || inv.quotation?.customerInfo?.email || inv.customer?.email || ''
    
    // Project Info
    const consumerNo = inv.consumerNo || inv.consumer_no || inv.quotation?.customerInfo?.consumerNumber || inv.quotation?.customerInfo?.consumerNo || inv.customer?.consumerNo || ''
    const appRegNo = inv.appRegNo || inv.app_reg_no || inv.quotation?.appRegNo || inv.quotation?.app_reg_no || ''
    const tangedcoNo = inv.tangedcoNo || inv.tangedco_no || inv.quotation?.tangedcoNo || inv.quotation?.tangedco_no || ''
    const appSanctionNo = inv.appSanctionNo || inv.app_sanction_no || inv.quotation?.appSanctionNo || inv.quotation?.app_sanction_no || ''
    
    let extractedProjectType = ''
    if (inv.quotation?.notes && inv.quotation.notes.includes('[Meta] Project:')) {
        extractedProjectType = inv.quotation.notes.split('[Meta] Project: ')[1]?.split(' |')[0] || '';
    }
    const projectType = inv.projectType || inv.project_type || inv.quotation?.projectType || inv.quotation?.project_type || extractedProjectType || ''
    const systemSizeKw = inv.systemSizeKw || inv.systemSize || inv.quotation?.systemSizeKw || inv.quotation?.system_size || ''
    const projectLocation = inv.projectLocation || inv.location || inv.quotation?.location || inv.siteAddr || inv.site_addr || inv.quotation?.siteAddr || inv.quotation?.site_addr || ''
    const paymentMode = inv.quotation?.customerInfo?.paymentMode || inv.paymentMode || ''

    const invoiceDate = fmtDate(inv.createdAt || inv.date)
    const dueDate = inv.dueDate || inv.due_date || inv.quotation?.valid_until || inv.quotation?.validUntil || ''
    const paymentTerms = inv.paymentTerms || inv.payment_terms || inv.quotation?.paymentTerms || ''

    const pages: any[][] = []
    for (let i = 0; i < Math.max(items.length, 1); i += ITEMS_PER_PAGE) {
        pages.push(items.slice(i, i + ITEMS_PER_PAGE))
    }

    const td: React.CSSProperties = { border: '2px solid #000', padding: '5px 7px', fontSize: '11px', verticalAlign: 'top', borderColor: '#000' }
    const th: React.CSSProperties = { ...td, background: '#d1facb', fontWeight: 700, textAlign: 'center', fontSize: '11px' }

    return (
        <div className="page active" style={{ padding: 0, background: '#d0d0d0', minHeight: '100vh' }}>

            {/* ── Action Bar ── */}
            <ERPDocumentHeader
                title={`Invoice ${invNo}`}
                status={inv.status || 'Pending'}
                approvalStatus={inv.approval_status}
                backLabel="← Invoices"
                onBack={() => navigate('/invoices')}
            >
                {!auth.isSuperAdmin() && inv.approval_status !== 'Submitted' && inv.approval_status !== 'Approved' && (
                    <button className="btn btn-warning btn-sm" onClick={handleSubmitApproval} style={{ color: '#d97706', borderColor: '#d97706', background: '#fffbeb' }}>
                        Submit for Approval
                    </button>
                )}
                {auth.isSuperAdmin() && inv.approval_status === 'Submitted' && (
                    <>
                        <button className="btn btn-success btn-sm" onClick={handleApprove}>
                            <CheckCircle size={14} /> Approve
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={handleReject} style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fef2f2' }}>
                            <XCircle size={14} /> Reject
                        </button>
                    </>
                )}
                {inv.status !== 'Paid' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => updatePaymentStatus('Paid')} style={{ color: '#10B981', borderColor: '#10B981', background: '#F0FDF4' }}>
                        <CheckCircle size={14} /> Mark as Paid
                    </button>
                )}
                {inv.status !== 'Paid' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/payments/new', { state: { invoiceId: inv.id, amount: amountDue > 0 ? amountDue : grandTotal } })}>
                        <CreditCard size={14} /> Record Payment
                    </button>
                )}
                <div style={{ display: 'flex', border: '1px solid var(--g300)', borderRadius: '6px', overflow: 'hidden' }}>
                    <button
                        style={{ padding: '4px 12px', fontSize: '13px', background: template === 'modern' ? 'var(--blue)' : '#fff', color: template === 'modern' ? '#fff' : 'var(--g500)', border: 'none', cursor: 'pointer' }}
                        onClick={() => setTemplate('modern')}
                    >Modern</button>
                    <button
                        style={{ padding: '4px 12px', fontSize: '13px', background: template === 'classic' ? 'var(--blue)' : '#fff', color: template === 'classic' ? '#fff' : 'var(--g500)', border: 'none', borderLeft: '1px solid var(--g300)', cursor: 'pointer' }}
                        onClick={() => setTemplate('classic')}
                    >Classic</button>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                    const orig = document.title;
                    document.title = `Invoice_${invNo}_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    window.print();
                    document.title = orig;
                }}>
                    <Printer size={14} /> Print / PDF
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/invoices/${id}/edit`)}
                    disabled={inv.status === 'Paid'} style={{ opacity: inv.status === 'Paid' ? 0.5 : 1 }}>
                    <Edit3 size={14} /> Edit Invoice
                </button>
            </ERPDocumentHeader>

            {/* ── Pages ── */}
            {template === 'classic' ? (
                <ClassicInvoiceTemplate
                    inv={inv}
                    settings={settings}
                    companyData={companyData}
                    invNo={invNo}
                    invoiceDate={invoiceDate}
                    dueDate={dueDate}
                    paymentTerms={paymentTerms}
                    customerName={customerName}
                    customerAddr={customerAddr}
                    customerCity={customerCity}
                    customerState={customerState}
                    customerPincode={customerPincode}
                    customerGst={customerGst}
                    customerMobile={customerMobile}
                    customerEmail={customerEmail}
                    consumerNo={consumerNo}
                    appRegNo={appRegNo}
                    tangedcoNo={tangedcoNo}
                    appSanctionNo={appSanctionNo}
                    projectType={projectType}
                    systemSizeKw={systemSizeKw}
                    projectLocation={projectLocation}
                    paymentMode={paymentMode}
                    items={items}
                    roundOffAmount={roundOffAmount}
                    grandTotal={grandTotal}
                    subtotal={subtotal}
                    totalTax={totalTax}
                />
            ) : (
                <div className="print-layout" style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, overflowX: 'auto', width: '100%' }}>
                    {pages.map((pageItems, pageIndex) => {
                        const isLast = pageIndex === pages.length - 1
                        const startIdx = pageIndex * ITEMS_PER_PAGE

                        return (
                            <div key={pageIndex} className={`a4-page ${pageIndex < pages.length - 1 ? 'page-break' : ''}`} style={{
                                padding: '10mm',
                                fontFamily: '"Arial", sans-serif', color: '#000', fontSize: '12px'
                            }}>

                                <InvoiceHeader
                                    inv={inv} invNo={invNo} invoiceDate={invoiceDate}
                                    customerName={customerName} customerAddr={customerAddr}
                                    customerGst={customerGst} pageNum={pageIndex + 1}
                                    companyData={companyData}
                                />

                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', borderTop: 'none' }}>
                                    <ItemsHead th={th} />
                                    <tbody>
                                        {pageItems.length === 0 ? (
                                            <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#999', padding: '20px' }}>No items</td></tr>
                                        ) : pageItems.map((it: any, i: number) => {
                                            const globalIdx = startIdx + i
                                            const hsnCode = String(it.hsn || it.hsnCode || '').trim() || '—'
                                            return (
                                                <tr key={globalIdx} style={{ pageBreakInside: 'avoid' }}>
                                                    <td style={{ ...td, textAlign: 'center', fontWeight: 600 }}>{String(globalIdx + 1).padStart(2, '0')}</td>
                                                    <td style={{ ...td, borderRight: '2px solid #000', fontWeight: 700 }}>
                                                        {displayName(it.productName || it.name)}
                                                    </td>
                                                    <td style={{ ...td, borderRight: '2px solid #000', color: '#333', fontSize: '10.5px', whiteSpace: 'pre-wrap' }}>
                                                        {it.description}
                                                    </td>
                                                    <td style={{ ...td, textAlign: 'center', borderRight: '2px solid #000' }}>{hsnCode}</td>
                                                    <td style={{ ...td, textAlign: 'center', borderRight: '2px solid #000', fontWeight: 600 }}>{it.qty || 1}</td>
                                                    <td style={{ ...td, textAlign: 'center', borderRight: 'none', fontWeight: 600 }}>{it.unit || 'Nos'}</td>
                                                </tr>
                                            )
                                        })}

                                        {/* Empty filler rows to make it look nicer */}
                                        {!isLast && Array.from({ length: Math.max(0, ITEMS_PER_PAGE - pageItems.length) }).map((_, idx) => (
                                            <tr key={'fill-' + idx} style={{ pageBreakInside: 'avoid' }}>
                                                <td style={{ ...td, borderRight: '2px solid #000' }}>&nbsp;</td>
                                                <td style={{ ...td, borderRight: '2px solid #000' }}>&nbsp;</td>
                                                <td style={{ ...td, borderRight: '2px solid #000' }}>&nbsp;</td>
                                                <td style={{ ...td, borderRight: '2px solid #000' }}>&nbsp;</td>
                                                <td style={{ ...td, borderRight: '2px solid #000' }}>&nbsp;</td>
                                                <td style={{ ...td, borderRight: 'none' }}>&nbsp;</td>
                                            </tr>
                                        ))}

                                        {/* Only on the last page: totals block */}
                                        {isLast && (<>
                                            <tr style={{ pageBreakInside: 'avoid' }}>
                                                <td colSpan={5} style={{ ...td, height: 2, borderRight: '2px solid #000', borderBottom: 'none' }} />
                                                <td style={{ ...td, height: 2, borderBottom: 'none', borderRight: 'none' }} />
                                            </tr>
                                            {[
                                                { label: 'SGST', val: sgst, bold: true },
                                                { label: 'CGST', val: cgst, bold: true },
                                                { label: 'Round Off', val: roundOffAmount, bold: true },
                                                { label: 'Total Amount', val: grandTotal, bold: true },
                                                { label: 'Total Project Cost', val: grandTotal, bold: true },
                                            ].map((r, ri) => (
                                                <tr key={ri} style={{ pageBreakInside: 'avoid' }}>
                                                    <td colSpan={5} style={{ ...td, textAlign: 'right', fontWeight: r.bold ? 700 : 500, borderRight: '2px solid #000', borderBottom: 'none', borderTop: 'none', padding: '2px 7px' }}>{r.label}</td>
                                                    <td style={{ ...td, textAlign: 'right', fontWeight: r.bold ? 700 : 400, borderBottom: 'none', borderTop: 'none', padding: '2px 7px', borderRight: 'none' }}>{r.val === 0 ? '' : inr(r.val)}</td>
                                                </tr>
                                            ))}
                                            <tr style={{ pageBreakInside: 'avoid' }}>
                                                <td colSpan={5} style={{ ...td, height: 2, borderRight: '2px solid #000', borderTop: 'none' }} />
                                                <td style={{ ...td, height: 2, borderTop: 'none', borderRight: 'none' }} />
                                            </tr>
                                        </>)}
                                    </tbody>
                                </table>

                                {/* Last page only: HSN table + total row + footer */}
                                {isLast && (<div style={{ marginTop: '0', pageBreakInside: 'avoid' }}>

                                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', borderTop: 'none', fontSize: '10.5px' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ ...th, width: '12%', borderTop: 'none' }}>HSN/SAC</th>
                                                <th style={{ ...th, width: '20%', borderTop: 'none' }}>Taxable Value</th>
                                                <th colSpan={2} style={{ ...th, borderTop: 'none' }}>Central Tax</th>
                                                <th colSpan={2} style={{ ...th, borderTop: 'none' }}>State Tax</th>
                                            </tr>
                                            <tr style={{ background: '#d1def0' }}>
                                                <th style={{ ...th, background: 'none', borderTop: 'none' }} />
                                                <th style={{ ...th, background: 'none', borderTop: 'none' }} />
                                                <th style={{ ...th, background: 'none', width: '15%', borderTop: 'none' }}>Rate</th>
                                                <th style={{ ...th, background: 'none', width: '19%', borderTop: 'none' }}>Amount</th>
                                                <th style={{ ...th, background: 'none', width: '15%', borderTop: 'none' }}>Rate</th>
                                                <th style={{ ...th, background: 'none', width: '19%', borderTop: 'none' }}>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {hsnRows.map(([hsn, { taxable, rate }]) => {
                                                const halfRate = rate / 2
                                                const halfTax = taxable * (rate / 100) / 2
                                                return (
                                                    <tr key={hsn}>
                                                        <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{hsn}</td>
                                                        <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{inr(taxable)}</td>
                                                        <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{halfRate.toFixed(2)}%</td>
                                                        <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{inr(halfTax)}</td>
                                                        <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{halfRate.toFixed(2)}%</td>
                                                        <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{inr(halfTax)}</td>
                                                    </tr>
                                                )
                                            })}
                                            <tr style={{ background: '#d1def0', fontWeight: 700 }}>
                                                <td colSpan={2} style={{ ...th, textAlign: 'center', background: 'none', fontSize: '12px' }}>TOTAL</td>
                                                <td style={{ ...th, background: 'none' }} /><td style={{ ...th, textAlign: 'right', background: 'none', fontSize: '12px' }}>{inr(cgst)}</td>
                                                <td style={{ ...th, background: 'none' }} /><td style={{ ...th, textAlign: 'right', background: 'none', fontSize: '12px' }}>{inr(sgst)}</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* Grand total row */}
                                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', borderTop: 'none' }}>
                                        <tbody>
                                            <tr style={{ background: '#fff' }}>
                                                <td colSpan={2} style={{ ...td, border: 'none', borderRight: '2px solid #000', borderBottom: '2px solid #000', padding: 0, width: '60%' }}>
                                                    {/* Left empty as per the image */}
                                                </td>
                                                <td style={{ ...td, textAlign: 'center', fontSize: '12px', color: '#000', borderBottom: '2px solid #000', borderRight: '2px solid #000', width: '20%' }}>Customer Payable</td>
                                                <td style={{ ...td, textAlign: 'center', fontWeight: 900, fontSize: '14px', width: '20%', color: '#000', borderBottom: '2px solid #000' }}>{fmt(grandTotal)}</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* E&OE footer */}
                                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', borderTop: 'none' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ ...td, width: '65%', fontSize: '10px', color: '#000', lineHeight: 1.4, verticalAlign: 'top', padding: '6px 10px', borderRight: '2px solid #000' }}>
                                                    <strong>E.&amp;O.E.</strong><br />
                                                    Our responsibility ceases after the goods handed over to the carriers. Claims for leakage or shortage<br />
                                                    during transit will not be entertained. We reserve the right to recover from you any tax, duty or any other<br />
                                                    levy applicable to this transaction under any Government enactment and not charged to in this Bill.<br />
                                                    Interest will be charged at 25% if the bill is not paid within due date.
                                                    <br /><br />
                                                    Subject to Erode jurisdiction only.
                                                </td>
                                                <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontSize: '12px', verticalAlign: 'bottom', padding: '12px 14px' }}>
                                                    For {COMPANY.name}
                                                    <br /><br /><br /><br />
                                                    <span style={{ fontSize: '12px', fontWeight: 400 }}>Authorised Signatory</span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>)}

                                {!isLast && (
                                    <div style={{ marginTop: 'auto', paddingTop: 12, textAlign: 'right', fontSize: '10px', color: '#888', fontStyle: 'italic' }}>
                                        Continued on next page…
                                    </div>
                                )}

                            </div>
                        )
                    })}
                </div>
            )}

            <style>{`
                @media print {
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    body > * { visibility: hidden; }
                    .print-layout, .print-layout * { visibility: visible !important; }
                    .print-layout {
                        position: relative !important; top: 0; left: 0; width: 100%;
                        padding: 0 !important; margin: 0 !important;
                        background: white !important; display: block !important;
                    }
                    .print-layout > div {
                        box-shadow: none !important;
                        width: 210mm !important;
                        min-height: auto !important;
                        margin: 0 auto !important;
                        padding: 8mm 10mm !important;
                        gap: 0 !important;
                    }
                    tr { page-break-inside: avoid !important; }
                    .page-break { page-break-after: always !important; break-after: page !important; }
                    .no-print, .sidebar, nav { display: none !important; }
                    @page { size: A4 portrait; margin: 0; }
                }
            `}</style>
        </div>
    )
}
