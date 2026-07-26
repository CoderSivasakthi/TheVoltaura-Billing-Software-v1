import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowRightCircle, Printer, Edit3, Share2, FileText, CheckCircle } from 'lucide-react'
import { api, toast } from '../services/api'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import ERPDocumentHeader from '../components/ERPDocumentHeader'
import AdvancePaymentModal from '../components/AdvancePaymentModal'
import { SolarCalculationEngine } from '../services/SolarCalculationEngine'

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY DEFAULTS (TheVoltaura – overridden by Settings if configured)
// ─────────────────────────────────────────────────────────────────────────────
const TV = {
    name: 'THEVOLTAURA PRIVATE LIMITED',
    tagline: 'Powering Buildings. Empowering Futures.',
    gstin: '33AAMCT8847M1ZI',
    address: '334/13 Rajiv Gandhi Nagar, Pallipalayam,\nNamakkal, Tamilnadu – 638008',
    email: 'contact@thevoltaura.com',
    phone: '+91 90255 96481',
    website: 'www.thevoltaura.com',
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES & SANITIZATION
// ─────────────────────────────────────────────────────────────────────────────
const inr = (n: number) => {
    const val = Math.round(Number(n) || 0);
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

// Amount-in-words (Indian numbering system)
function numberToWords(num: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen']
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

    const val = Math.round(Number(num) || 0);
    if (val === 0) return 'Zero';

    function twoDigits(n: number): string {
        if (n < 20) return ones[n]
        return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '')
    }
    function threeDigits(n: number): string {
        if (n >= 100) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + twoDigits(n % 100) : '')
        return twoDigits(n)
    }

    const crore = Math.floor(val / 10000000)
    const lakh = Math.floor((val % 10000000) / 100000)
    const thou = Math.floor((val % 100000) / 1000)
    const rest = Math.floor(val % 1000)

    let result = ''
    if (crore) result += threeDigits(crore) + ' Crore '
    if (lakh) result += threeDigits(lakh) + ' Lakh '
    if (thou) result += threeDigits(thou) + ' Thousand '
    if (rest) result += threeDigits(rest)

    return result.trim() + ' Only'
}

// Safely sanitize and validate strings to prevent undefined/null/NaN displays
function cleanStr(val: any): string {
    if (val === null || val === undefined || Number.isNaN(val) || val === 'undefined' || val === 'null' || val === 'NaN') {
        return '';
    }
    // Convert WYSIWYG injected non-breaking spaces to regular spaces to allow natural wrapping
    return String(val).replace(/&nbsp;/gi, ' ').replace(/\u00A0/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE HTML SAFE RENDERER
// ─────────────────────────────────────────────────────────────────────────────
function RichText({ html, className, style }: { html?: string; className?: string; style?: React.CSSProperties }) {
    const cleaned = cleanStr(html);
    if (!cleaned) return null;

    // Check if it looks like HTML (contains brackets)
    const hasTags = /<[a-z][\s\S]*>/i.test(cleaned);
    if (!hasTags) {
        return (
            <div className={`plain-text-block ${className || ''}`} style={style}>
                {cleaned}
            </div>
        );
    }
    return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: cleaned }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_STYLE: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm',
    maxHeight: '297mm',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '"Times New Roman", Times, serif',
    color: '#111',
    fontSize: '12.5px',
    lineHeight: '1.55',
    padding: '18mm 18mm 12mm 18mm',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
}

const NAVY = '#1a3f6f'

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE PAGE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function PageHeader({ co }: { co: any }) {
    return (
        <div style={{ marginBottom: '5mm', width: '100%', flexShrink: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                    <tr>
                        {/* Left Block – Logo only */}
                        <td style={{ verticalAlign: 'middle', width: '35%', padding: 0 }}>
                            {co.logo ? (
                                <img
                                    src={co.logo}
                                    alt="Company Logo"
                                    style={{ height: '52px', width: 'auto', objectFit: 'contain', display: 'block' }}
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                                />
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg width="40" height="40" viewBox="0 0 52 52" style={{ flexShrink: 0 }}>
                                        <rect width="52" height="52" rx="4" fill="#fff" stroke={NAVY} strokeWidth="2" />
                                        <text x="26" y="32" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="20" fill={NAVY}>VA</text>
                                    </svg>
                                    <span style={{ fontFamily: 'Georgia, serif', fontWeight: 900, fontSize: '18px', color: NAVY }}>{co.name}</span>
                                </div>
                            )}
                        </td>
                        {/* Right Block – Company details */}
                        <td style={{ verticalAlign: 'middle', width: '65%', textAlign: 'right', fontSize: '10px', lineHeight: '1.5', color: '#333', padding: 0 }}>
                            {co.name && <div style={{ fontWeight: 700, color: '#111', fontSize: '11.5px', marginBottom: '1px', letterSpacing: '0.3px' }}>{co.name.toUpperCase()}</div>}
                            {co.gstin && <div style={{ fontWeight: 600, color: '#222' }}>GSTIN: {co.gstin}</div>}
                            {co.address && <div style={{ whiteSpace: 'pre-wrap', marginTop: '1px' }}>{co.address}</div>}
                            <div style={{ marginTop: '1px', color: '#555' }}>
                                {co.email}&nbsp;|&nbsp;{co.phone}
                            </div>
                            {co.website && <div style={{ color: '#555' }}>{co.website}</div>}
                        </td>
                    </tr>
                </tbody>
            </table>
            <div style={{ borderBottom: `2px solid ${NAVY}`, marginTop: '5px' }} />
        </div>
    )
}

function PageFooter({ co, pageNum, sigImage, sealImage }: { co: any, pageNum: number, sigImage?: string, sealImage?: string }) {
    const hasSig = cleanStr(sigImage) !== '';
    const hasSeal = cleanStr(sealImage) !== '';

    return (
        <div style={{ marginTop: 'auto', paddingTop: '4mm', width: '100%', flexShrink: 0 }}>
            {/* Signature & Seal row */}
            {(hasSig || hasSeal) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '5mm', width: '100%' }}>
                    <div style={{ width: '180px', textAlign: 'center' }}>
                        {hasSig && (
                            <img
                                src={sigImage}
                                alt="Director Signature"
                                style={{ width: '100%', maxHeight: '50px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                        )}
                        <div style={{ fontSize: '9px', borderTop: '1px solid #bbb', marginTop: '3px', paddingTop: '2px', color: '#444', fontWeight: 600 }}>Director Signature</div>
                    </div>
                    <div style={{ width: '180px', textAlign: 'center' }}>
                        {hasSeal && (
                            <img
                                src={sealImage}
                                alt="Company Office Seal"
                                style={{ width: '100%', maxHeight: '50px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                        )}
                        <div style={{ fontSize: '9px', borderTop: '1px solid #bbb', marginTop: '3px', paddingTop: '2px', color: '#444', fontWeight: 600 }}>Company Office Seal</div>
                    </div>
                </div>
            )}

            <div style={{ borderTop: '1px solid #ddd', paddingTop: '3px', fontSize: '9px', color: '#666', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>{co.name}&nbsp;|&nbsp;GST: {co.gstin}&nbsp;|&nbsp;{co.email}&nbsp;|&nbsp;{co.phone}</span>
                <span style={{ color: '#999', fontWeight: 600 }}>Page {pageNum}</span>
            </div>
        </div>
    )
}

function QuotationPage({
    co,
    pageNum,
    sigImage,
    sealImage,
    children
}: {
    co: any;
    pageNum: number;
    sigImage?: string;
    sealImage?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="a4-page" style={PAGE_STYLE}>
            <PageHeader co={co} />
            <div className="page-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
                {children}
            </div>
            <PageFooter co={co} pageNum={pageNum} sigImage={sigImage} sealImage={sealImage} />
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN VIEW COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ViewQuotation() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { settings } = useSettings()
    const auth = useAuth()

    const [doc, setDoc] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [showAdvanceModal, setShowAdvanceModal] = useState(false)
    const [activeTab, setActiveTab] = useState('document')

    // Merge General and Quotation Settings
    const co = {
        name: cleanStr(settings?.orgName || TV.name),
        email: cleanStr(settings?.email || TV.email),
        phone: cleanStr(settings?.phone || TV.phone),
        gstin: cleanStr(settings?.branches?.[0]?.gst || TV.gstin),
        address: cleanStr(settings?.branches?.[0]?.address || TV.address),
        logo: settings?.quotation?.images?.companyLogo || settings?.logo || undefined,
        tagline: cleanStr(settings?.tagline || TV.tagline),
        website: cleanStr(settings?.website || TV.website),
    }

    const qs = settings?.quotation

    const fetchDoc = useCallback(async () => {
        try {
            const data = await api('GET', `/api/quotations/${encodeURIComponent(id || '')}`)
            setDoc(data)
        } catch (e: any) {
            toast(e.message || 'Error loading quotation', 'error')
            navigate('/quotations')
        } finally {
            setLoading(false)
        }
    }, [id, navigate])

    useEffect(() => {
        fetchDoc()
    }, [fetchDoc])

    const handlePrint = () => {
        window.print()
    }

    const handleShare = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url)
            .then(() => toast('Quotation link copied to clipboard!'))
            .catch(() => toast('Failed to copy link', 'error'));
    }

    const handleConvert = async () => {
        try {
            const invoice = await api('POST', `/api/quotations/${encodeURIComponent(id || '')}/convert`);
            toast('Quotation converted to Invoice successfully!');
            navigate(`/invoices/${encodeURIComponent(invoice.id)}`);
        } catch (e: any) {
            toast(e.message || 'Failed to convert quotation', 'error');
        }
    }

    const handleSubmitApproval = async () => {
        try {
            await api('POST', `/api/quotations/${encodeURIComponent(id || '')}/submit`);
            toast('Quotation submitted for approval!');
            fetchDoc();
        } catch (e: any) {
            toast(e.message || 'Failed to submit quotation', 'error');
        }
    }

    if (loading) {
        return <div className="page active" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>
    }

    if (!doc) return null

    // Date formatting (avoids NaN.NaN.NaN)
    let dateStr = ''
    if (doc.date) {
        const dt = new Date(doc.date)
        if (!isNaN(dt.getTime())) {
            const pad = (n: number) => String(n).padStart(2, '0')
            dateStr = `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()}`
        }
    }

    // Determine Project Type from Notes Meta
    let projectType = 'Grid-Tie';
    if (doc.notes) {
        const match = doc.notes.match(/Project:\s*(Grid-Tie|Hybrid|Off-Grid)/i);
        if (match) {
            projectType = match[1];
        }
    }

    // Choose diagram image dynamically based on selected system type
    let solarDiagramImage = qs?.images?.onGridDiagram;
    if (projectType.toLowerCase().includes('hybrid')) {
        solarDiagramImage = qs?.images?.hybridDiagram;
    } else if (projectType.toLowerCase().includes('off-grid')) {
        solarDiagramImage = qs?.images?.offGridDiagram;
    }

    // Dynamic solar panel calculations fallback for old documents
    const fallbackSizeKw = SolarCalculationEngine.calculateSystemSize(doc.items || []);

    const systemSizeKw = doc.systemSizeKw !== undefined ? Number(doc.systemSizeKw) : fallbackSizeKw;
    const annualGen = doc.annualGeneration !== undefined ? Number(doc.annualGeneration) : SolarCalculationEngine.calculateAnnualGeneration(SolarCalculationEngine.calculateDailyGeneration(systemSizeKw));

    // Financial calculations
    const subtotal = Number(doc.subtotal) || 0;
    const gstAmount = Number(doc.gstAmount || doc.tax_amount) || 0;
    const discount = Number(doc.discount) || 0;
    const grandTotal = Number(doc.grandTotal || doc.total) || 0;
    const subsidyAmount = doc.subsidyAmount !== undefined ? Number(doc.subsidyAmount) : SolarCalculationEngine.calculateSubsidy(systemSizeKw);
    
    // Exact rounding reconciliation
    let displayGrandTotal = grandTotal;

    const customerAddress = cleanStr(doc.customer?.address || doc.billingAddr || '');
    const customerName = cleanStr(doc.customer?.name || doc.billingName || doc.customerName || '');

    return (
        <div className="page active" style={{ backgroundColor: '#f0f2f5', padding: '20px', overflowY: 'auto' }}>
            <style>{`
                /* ── SCREEN RESPONSIVE SCALING ── */
                @media screen {
                    .print-container {
                        background: #e2e8f0;
                        padding: 40px 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 24px;
                        width: 100%;
                    }
                    .a4-page {
                        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
                        border: 1px solid #d1d5db;
                    }
                }
                
                @media screen and (max-width: 1024px) {
                    .a4-page { zoom: 0.85; }
                }
                @media screen and (max-width: 768px) {
                    .a4-page { zoom: 0.65; }
                }
                @media screen and (max-width: 480px) {
                    .a4-page { zoom: 0.45; }
                }

                /* ── PRINT & FLAT A4 OVERRIDES ── */
                @media print {
                    html, body {
                        background: #fff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        overflow: initial !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .sidebar, .topbar, header, aside, .sb-overlay, .sd-overlay, .settings-drawer, .no-print {
                        display: none !important;
                        height: 0 !important;
                        width: 0 !important;
                    }
                    .app {
                        display: block !important;
                        height: auto !important;
                        min-height: initial !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .main {
                        display: block !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        min-height: initial !important;
                    }
                    .page-area {
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                    }
                    .page.active {
                        padding: 0 !important;
                        margin: 0 !important;
                        background: transparent !important;
                    }
                    .print-container {
                        display: block !important;
                        width: 210mm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        box-shadow: none !important;
                    }
                    .a4-page {
                        page-break-after: always;
                        box-shadow: none !important;
                        border: none !important;
                        margin: 0 !important;
                    }
                    .a4-page:last-child {
                        page-break-after: auto;
                    }
                    @page { 
                        margin: 0; 
                        size: A4 portrait; 
                    }
                    .tech-table tr {
                        page-break-inside: avoid;
                    }
                    .tech-table thead {
                        display: table-header-group;
                    }
                    img {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }

                /* ── GLOBAL TYPOGRAPHY – anti word-break ── */
                .a4-page, .a4-page * {
                    word-break: normal !important;
                    overflow-wrap: normal !important;
                    white-space: normal !important;
                    hyphens: none !important;
                    -webkit-hyphens: none !important;
                }
                .plain-text-block {
                    white-space: pre-line !important;
                }

                .page-body {
                    overflow: visible !important;
                }

                /* ── TYPOGRAPHY AND CONTENT STYLE RULES ── */
                .pdf-section {
                    margin-bottom: 10px;
                }
                .pdf-h2 {
                    font-size: 13px;
                    font-weight: 700;
                    margin: 12px 0 5px 0;
                    color: #111;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }
                .pdf-p, .pdf-p p, .pdf-p div {
                    margin: 0 0 8px 0;
                    line-height: 1.55;
                    text-align: left;
                    word-break: normal !important;
                    overflow-wrap: normal !important;
                    white-space: normal !important;
                    hyphens: none !important;
                    -webkit-hyphens: none !important;
                    max-width: 100%;
                }
                .pdf-p ul, .pdf-p ol {
                    margin: 0 0 8px 22px;
                    padding: 0;
                    text-align: left;
                }
                .pdf-p li {
                    margin-bottom: 3px;
                    text-align: left;
                    line-height: 1.5;
                }

                /* ── TABLES ── */
                .tech-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 10px;
                }
                .tech-table th, .tech-table td {
                    border: 1px solid #555;
                    padding: 7px 8px;
                    font-size: 11.5px;
                    vertical-align: top;
                    word-break: normal !important;
                    overflow-wrap: normal !important;
                }
                .tech-table th {
                    background-color: #1a1a1a;
                    color: #fff;
                    font-weight: 700;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            `}</style>

            {/* CONTROL PANEL HEADER */}
            <ERPDocumentHeader
                title={`Quotation ${cleanStr(doc.id)}`}
                status={doc.status || 'Draft'}
                approvalStatus={doc.approval_status}
                backLabel="← Back"
                onBack={() => navigate('/quotations')}
            >
                {!auth.isSuperAdmin() && doc.approval_status !== 'Submitted' && doc.approval_status !== 'Approved' && (
                    <button className="btn btn-warning btn-sm" onClick={handleSubmitApproval} style={{ color: '#d97706', borderColor: '#d97706', background: '#fffbeb' }}>
                        Submit for Approval
                    </button>
                )}
                {doc.status !== 'Confirmed Order' && doc.status !== 'Invoiced' && doc.status !== 'Completed' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowAdvanceModal(true)} style={{ color: '#10B981', borderColor: '#10B981', background: '#F0FDF4' }}>
                        <CheckCircle size={14} /> Confirm Advance Payment
                    </button>
                )}
                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/quotation/edit/${doc.id}`)} disabled={doc.status === 'Confirmed Order' || doc.status === 'Invoiced' || doc.status === 'Completed'}>
                    <Edit3 size={14} /> Edit
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
                    <Printer size={14} /> Print / Save PDF
                </button>
                {doc.status === 'Invoiced' && (doc.invoiceId || doc.invoice_id) && (
                    <button className="btn btn-success btn-sm" onClick={() => navigate(`/invoices/${encodeURIComponent(doc.invoiceId || doc.invoice_id)}`)}>
                        <FileText size={14} /> View Invoice
                    </button>
                )}
                {doc.status !== 'Invoiced' && (
                    <button 
                        className="btn btn-success btn-sm" 
                        onClick={handleConvert}
                        disabled={doc.status !== 'Confirmed Order' && doc.status !== 'Completed' && doc.status !== 'Installation'}
                        title={doc.status !== 'Confirmed Order' ? 'Order must be confirmed before generating invoice' : ''}
                    >
                        <ArrowRightCircle size={14} /> Convert to Invoice
                    </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={handleShare}>
                    <Share2 size={14} /> Share
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
                    <Printer size={14} /> Download PDF
                </button>
            </ERPDocumentHeader>

            {showAdvanceModal && (
                <AdvancePaymentModal 
                    quotation={doc} 
                    onClose={() => setShowAdvanceModal(false)} 
                    onConfirm={() => {
                        setShowAdvanceModal(false);
                        fetchDoc();
                    }} 
                />
            )}

            <div className="no-print" style={{ display: 'flex', gap: '20px', padding: '0 20px', borderBottom: '1px solid #ccc', marginBottom: '20px' }}>
                <button 
                    style={{ background: 'transparent', border: 'none', borderBottom: activeTab === 'document' ? '2px solid #1a3f6f' : '2px solid transparent', padding: '10px 5px', fontWeight: activeTab === 'document' ? 700 : 500, color: activeTab === 'document' ? '#1a3f6f' : '#555', cursor: 'pointer' }}
                    onClick={() => setActiveTab('document')}
                >Quotation Document</button>
                <button 
                    style={{ background: 'transparent', border: 'none', borderBottom: activeTab === 'payments' ? '2px solid #1a3f6f' : '2px solid transparent', padding: '10px 5px', fontWeight: activeTab === 'payments' ? 700 : 500, color: activeTab === 'payments' ? '#1a3f6f' : '#555', cursor: 'pointer' }}
                    onClick={() => setActiveTab('payments')}
                >Payment History</button>
            </div>

            {activeTab === 'payments' && (
                <div className="no-print" style={{ padding: '0 20px' }}>
                    <div className="card shadow-sm border-0">
                        <div className="card-body">
                            <h5 className="mb-3">Payment History</h5>
                            <table className="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Amount</th>
                                        <th>Mode</th>
                                        <th>UTR / Txn No</th>
                                        <th>Received By</th>
                                        <th>Remarks</th>
                                        <th>Payment Proof</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(doc.payments || []).length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-4 text-muted">No payments recorded yet.</td>
                                        </tr>
                                    ) : (doc.payments || []).map((p: any, i: number) => (
                                        <tr key={i}>
                                            <td>{p.date}</td>
                                            <td style={{ fontWeight: 600, color: '#059669' }}>₹ {inr(p.amount)}</td>
                                            <td>{p.mode}</td>
                                            <td>{p.utr || '—'}</td>
                                            <td>{p.receivedBy || '—'}</td>
                                            <td>{p.remarks || '—'}</td>
                                            <td>
                                                {p.proofUrl ? (
                                                    <a href={p.proofUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        📄 View
                                                    </a>
                                                ) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'document' && (
            <div className="print-container">

                {/* ════════════════════ PAGE 1 ════════════════════ */}
                <QuotationPage co={co} pageNum={1} sigImage={qs?.images?.directorSignature} sealImage={qs?.images?.companySeal}>

                    {/* Customer and Project Details */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5mm', fontSize: '12px', lineHeight: '1.6' }}>
                        <tbody>
                            <tr>
                                <td style={{ verticalAlign: 'top', width: '55%', paddingRight: '10px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '3px' }}>To,</div>
                                    {customerName && customerName !== '—' && (
                                        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>{customerName}</div>
                                    )}
                                    {doc.customer?.company && <div style={{ fontWeight: 600, marginBottom: '2px' }}>{cleanStr(doc.customer.company)}</div>}
                                    {customerAddress && <div style={{ color: '#333', lineHeight: '1.5' }}>{customerAddress}</div>}
                                    {cleanStr(doc.customer?.phone) && <div style={{ marginTop: '2px' }}>Phone: {cleanStr(doc.customer.phone)}</div>}
                                    {cleanStr(doc.customer?.email) && <div>Email: {cleanStr(doc.customer.email)}</div>}
                                </td>
                                <td style={{ verticalAlign: 'top', width: '45%', textAlign: 'right' }}>
                                    <div style={{ marginBottom: '3px' }}><strong>Date:</strong> {cleanStr(dateStr)}</div>
                                    <div style={{ marginBottom: '3px' }}><strong>Quotation No:</strong> {cleanStr(doc.id)}</div>
                                    <div><strong>Project Type:</strong> {cleanStr(projectType)}</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{ fontWeight: 700, marginBottom: '3mm', fontSize: '12.5px' }}>
                        Sub: {qs?.content?.page1?.subject || 'Proposal for Residential Grid Tie Solar Power Plant – Budgetary Quotation'}
                    </div>

                    <div style={{ borderBottom: '1px solid #333', marginBottom: '3mm' }} />

                    <RichText className="pdf-p" html={qs?.content?.page1?.intro} />
                    <RichText className="pdf-p" html={qs?.content?.page1?.proposalLetter} />

                    <div style={{ paddingLeft: '18px' }}>
                        <RichText className="pdf-p" html={qs?.content?.page1?.documentsIncluded} />
                    </div>

                    <div style={{ marginTop: '3mm' }}>
                        <RichText className="pdf-p" html={qs?.content?.page1?.thankYouMessage} />
                    </div>

                    <div style={{ marginTop: '3mm' }}>
                        <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '2px', textTransform: 'uppercase' }}>Bank Details / Payment Information</div>
                        <RichText className="pdf-p" html={qs?.content?.page1?.bankDetails} />
                    </div>

                    <div style={{ marginTop: '2mm' }}>
                        <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '2px' }}>Payment Terms:</div>
                        <RichText className="pdf-p" html={qs?.content?.page1?.paymentTerms} />
                    </div>
                </QuotationPage>

                {/* ════════════════════ PAGE 2 ════════════════════ */}
                <QuotationPage co={co} pageNum={2}>
                    <div className="pdf-h2" style={{ marginTop: 0 }}>Why TheVoltaura Solar?</div>
                    <div style={{ marginLeft: '10px' }}>
                        <RichText className="pdf-p" html={qs?.content?.page2?.whyChooseUs} />
                    </div>

                    <div className="pdf-h2">Solar Power Plant – Smart Energy for Modern Spaces</div>
                    <RichText className="pdf-p" html={qs?.content?.page2?.solarPowerExplanation} />

                    <div className="pdf-h2">How It Works</div>
                    <RichText className="pdf-p" html={qs?.content?.page2?.howItWorks} />

                    <div className="pdf-h2">High-Efficiency PV Modules</div>
                    <div style={{ marginLeft: '10px' }}>
                        <RichText className="pdf-p" html={qs?.content?.page2?.panelDescription} />
                    </div>

                    <div className="pdf-h2">Advanced Grid-Tied Inverter</div>
                    <RichText className="pdf-p" html={qs?.content?.page2?.inverterDescription} />

                    <div className="pdf-h2">Robust Mechanical & Electrical Infrastructure</div>
                    <div style={{ marginLeft: '10px' }}>
                        <RichText className="pdf-p" html={qs?.content?.page2?.mechanicalInfrastructure} />
                    </div>

                    <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '8mm' }}>
                        <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TheVoltaura Promise</div>
                        <div style={{ maxWidth: '85%', margin: '0 auto', lineHeight: 1.6, fontStyle: 'italic', fontSize: '12px', color: '#333' }}>
                            <RichText html={qs?.content?.page2?.companyPromise} />
                        </div>
                    </div>
                </QuotationPage>

                {/* ════════════════════ PAGE 3 ════════════════════ */}
                <QuotationPage co={co} pageNum={3}>
                    <div className="pdf-h2" style={{ marginTop: 0 }}>
                        {qs?.content?.page3?.solarGenerationHeading || 'Solar Generation Short View'}
                    </div>

                    {qs?.images?.solarGenerationImage && (
                        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                            <img
                                src={qs.images.solarGenerationImage}
                                alt="Solar Generation"
                                style={{ maxWidth: '100%', maxHeight: '100px', objectFit: 'contain' }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                        </div>
                    )}

                    {/* DYNAMIC SOLAR GENERATION TABLE */}
                    <table className="tech-table" style={{ textAlign: 'center', marginBottom: '12px' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'center', padding: '8px 10px' }}>Project Size</th>
                                <th style={{ textAlign: 'center', padding: '8px 10px' }}>Estimated Project Generation [kWh / Year]</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ fontWeight: 700, padding: '8px 10px' }}>{systemSizeKw.toFixed(2)} kW</td>
                                <td style={{ fontWeight: 700, padding: '8px 10px' }}>{annualGen.toLocaleString('en-IN')}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{ textAlign: 'center', fontWeight: 700, color: '#444', letterSpacing: '0.8px', margin: '12px 0 6px 0', textTransform: 'uppercase', fontSize: '12px' }}>
                        {projectType} Solar Panels Working Diagram
                    </div>
                    {solarDiagramImage && (
                        <div style={{ textAlign: 'center', margin: '8px 0 15px 0' }}>
                            <img
                                src={solarDiagramImage}
                                alt={`${projectType} Solar Working Diagram`}
                                style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', display: 'inline-block' }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                        </div>
                    )}

                            <div style={{ textAlign: 'center', fontWeight: 700, color: '#333', margin: '12px 0 6px 0', fontSize: '13px' }}>
                                MNRE Government Subsidy
                            </div>
                            <table className="tech-table" style={{ textAlign: 'center', marginBottom: '8px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'center', padding: '8px 10px' }}>System Capacity</th>
                                        <th style={{ textAlign: 'center', padding: '8px 10px' }}>MNRE Subsidy (CFA)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {systemSizeKw >= 3 ? (
                                        <tr>
                                            <td style={{ fontWeight: 700, padding: '8px 10px' }}>3 kW and Above</td>
                                            <td style={{ fontWeight: 700, padding: '8px 10px' }}>₹ 78,000/-</td>
                                        </tr>
                                    ) : systemSizeKw >= 2 ? (
                                        <tr>
                                            <td style={{ fontWeight: 700, padding: '8px 10px' }}>2 kW</td>
                                            <td style={{ fontWeight: 700, padding: '8px 10px' }}>₹ 60,000/-</td>
                                        </tr>
                                    ) : (
                                        <tr>
                                            <td style={{ fontWeight: 700, padding: '8px 10px' }}>1 kW</td>
                                            <td style={{ fontWeight: 700, padding: '8px 10px' }}>₹ 30,000/-</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            <div style={{ fontSize: '10.5px', lineHeight: 1.6, color: '#444', marginBottom: '15px', textAlign: 'left' }}>
                                The MNRE Central Financial Assistance (CFA) subsidy shown above is applicable based on the installed Solar PV System capacity. The subsidy amount will be credited directly to the consumer's registered bank account after successful installation, inspection, and net-meter approval as per the latest MNRE guidelines.
                            </div>

                    <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '13px', marginBottom: '6px', marginTop: '8px' }}>
                        Brands We Use
                    </div>
                    <div style={{ textAlign: 'center', marginBottom: '6px', fontSize: '12px' }}>
                        <RichText html={qs?.content?.page3?.brandsIntroText} />
                    </div>
                    {qs?.images?.brandsWeUseImage && (
                        <div style={{ textAlign: 'center' }}>
                            <img
                                src={qs.images.brandsWeUseImage}
                                alt="Brands We Use"
                                style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', display: 'inline-block' }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                        </div>
                    )}
                </QuotationPage>

                {/* ════════════════════ PAGE 4 ════════════════════ */}
                <QuotationPage co={co} pageNum={4}>
                    <div className="pdf-h2" style={{ marginTop: 0 }}>
                        {qs?.content?.page4?.techSpecHeading || 'TECHNICAL SPECIFICATIONS'}
                    </div>

                    {/* SPECIFICATION TABLE */}
                    <table className="tech-table">
                        <thead>
                            <tr style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>
                                <th style={{ width: '8%', textAlign: 'center', padding: '10px' }}>NO.</th>
                                <th style={{ width: '78%', textAlign: 'left', padding: '10px' }}>DESCRIPTION</th>
                                <th style={{ width: '14%', textAlign: 'center', padding: '10px' }}>QTY</th>
                            </tr>
                        </thead>
                        <tbody>
                            {doc.items && doc.items.map((item: any, i: number) => {
                                const qty = Number(item.quantity) || Number(item.qty) || 0;
                                const unit = cleanStr(item.unit) || 'Nos';
                                
                                const productName = cleanStr(item.productName || item.name || '');
                                const techSpec = cleanStr(item.technicalSpecification || item.description || '');
                                
                                let descText = productName;
                                if (techSpec && techSpec !== productName) {
                                    descText += descText ? `\n${techSpec}` : techSpec;
                                }

                                return (
                                    <tr key={item.id || i}>
                                        <td style={{ textAlign: 'center', fontWeight: 600, verticalAlign: 'top', padding: '10px' }}>{String(i + 1).padStart(2, '0')}</td>
                                        <td style={{ textAlign: 'left', fontWeight: 700, fontSize: '11.5px', padding: '10px', whiteSpace: 'pre-wrap' }}>
                                            {descText}
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 700, verticalAlign: 'top', padding: '10px' }}>{qty} {unit}</td>
                                    </tr>
                                );
                            })}
                            
                            <tr>
                                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, padding: '10px' }}>Sub Total (Before GST)</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, padding: '10px' }}>₹ {inr(subtotal)}</td>
                            </tr>
                            {discount > 0 && (
                                <tr>
                                    <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, padding: '10px' }}>Discount</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, padding: '10px', color: '#c00' }}>- ₹ {inr(discount)}</td>
                                </tr>
                            )}
                            <tr>
                                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, padding: '10px' }}>
                                    GST {gstAmount > 0 && subtotal > 0 ? `@ ${+((gstAmount / subtotal) * 100).toFixed(2)}%` : ''}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, padding: '10px' }}>₹ {inr(gstAmount)}</td>
                            </tr>
                            <tr style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>
                                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, padding: '12px', fontSize: '13.5px' }}>TOTAL (INR)</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '13.5px', padding: '12px' }}>₹ {inr(displayGrandTotal)}</td>
                            </tr>
                            <tr>
                                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, color: '#059669', padding: '12px' }}>MNRE Government Subsidy (Approx.)</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669', padding: '12px' }}>₹ {inr(subsidyAmount)}</td>
                            </tr>
                            <tr>
                                <td colSpan={3} style={{ padding: '12px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', color: '#047857', marginBottom: '4px', fontWeight: 600 }}>After Completion of Project, the MNRE Subsidy will be credited directly to the Beneficiary's Bank Account.</div>
                                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>₹ {inr(subsidyAmount)}</div>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={3} style={{ padding: '10px', fontSize: '10px', color: '#666', fontStyle: 'italic', textAlign: 'left' }}>
                                    Note: The MNRE Government Subsidy shown above is an estimated value calculated based on the selected Solar PV System capacity (kW). The actual subsidy is subject to the latest MNRE (Government of India) guidelines, eligibility criteria, inspection, approval, and applicable Government terms and conditions.
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '11.5px', fontStyle: 'italic', color: '#333' }}>
                        {qs?.content?.page4?.amountInWordsLabel || 'Amount in words:'} <span style={{ fontWeight: 700 }}>{numberToWords(displayGrandTotal)}</span>
                    </div>
                </QuotationPage>

                {/* ════════════════════ PAGE 5 ════════════════════ */}
                <QuotationPage co={co} pageNum={5} sigImage={qs?.images?.directorSignature} sealImage={qs?.images?.companySeal}>
                    <div className="pdf-h2" style={{ marginTop: 0 }}>
                        {qs?.content?.page5?.termsAndConditions || 'TERMS AND CONDITIONS'}
                    </div>
                    <div style={{ borderBottom: '1px solid #bbb', marginBottom: '10px' }} />

                    <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '3px', marginTop: '6px' }}>Taxes</div>
                    <RichText className="pdf-p" html={qs?.content?.page5?.taxes} />

                    <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '3px', marginTop: '6px' }}>Payment Terms</div>
                    <RichText className="pdf-p" html={qs?.content?.page5?.paymentTerms} />

                    <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '3px', marginTop: '6px' }}>Warranty</div>
                    <RichText className="pdf-p" html={qs?.content?.page5?.warranty} />

                    <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '3px', marginTop: '6px' }}>Delivery</div>
                    <RichText className="pdf-p" html={qs?.content?.page5?.delivery} />

                    <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '3px', marginTop: '6px' }}>Exclusions</div>
                    <div style={{ marginLeft: '10px' }}>
                        <RichText className="pdf-p" html={qs?.content?.page5?.exclusions} />
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px', color: '#c00', marginTop: '12px' }}>Quotation Validity & Terms</div>
                    <div style={{ color: '#c00' }}>
                        <RichText className="pdf-p" html={qs?.content?.page5?.validity} />
                    </div>

                    <div style={{ marginTop: '15px' }}>
                        <RichText className="pdf-p" html={qs?.content?.page5?.closingMessage} />
                    </div>
                </QuotationPage>
            </div>
            )}
        </div>
    )
}
