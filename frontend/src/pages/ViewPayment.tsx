import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, CheckCircle, CreditCard } from 'lucide-react'
import { api, fmt, fmtDate, statusTag, displayName } from '../services/api'

export default function ViewPayment() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [payment, setPayment] = useState<any>(null)
    const [invoice, setInvoice] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadPaymentAndInvoice = async () => {
            try {
                // Fetch Payment Data
                const p = await api('GET', `/api/payments/${id}`)
                setPayment(p)

                // Fetch linked Invoice if it exists
                if (p.invoiceId) {
                    const inv = await api('GET', `/api/invoices/${encodeURIComponent(p.invoiceId)}`).catch(() => null)
                    setInvoice(inv)
                }
            } catch (err) {
                console.error("Failed to load payment details", err)
            } finally {
                setLoading(false)
            }
        }
        if (id) loadPaymentAndInvoice()
    }, [id])

    if (loading) {
        return <div className="page active" style={{ padding: '40px', textAlign: 'center' }}>Loading payment details...</div>
    }

    if (!payment) {
        return <div className="page active" style={{ padding: '40px', textAlign: 'center' }}>Payment not found.</div>
    }

    const s_card = { background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', marginBottom: '24px' };
    const s_label = { fontSize: '12px', fontWeight: 600, color: 'var(--g500)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: '4px' };
    const s_value = { fontSize: '15px', fontWeight: 600, color: '#111827' };

    const invTotal = invoice ? (invoice.total || invoice.grandTotal || 0) : 0;
    const invPaid = invoice ? (invoice.paid || 0) : 0;
    const invDue = Math.max(0, invTotal - invPaid);

    return (
        <div className="page active" style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh', padding: '32px' }}>
            <div className="breadcrumb" style={{ marginBottom: '24px' }}>
                <a href="#" onClick={e => { e.preventDefault(); navigate('/payments') }}>
                    <ArrowLeft size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    Back to Payments
                </a>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '28px', color: '#111827', margin: 0, fontWeight: 800 }}>Payment Receipt</h2>
                    <div style={{ fontSize: '13px', color: 'var(--g500)', marginTop: '4px' }}>Payment Reference: {payment.id}</div>
                </div>
                <div>
                    <span dangerouslySetInnerHTML={{ __html: statusTag(payment.status || 'Paid') }}></span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Section 1: Payment Summary */}
                    <div style={s_card}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontWeight: 700, fontSize: '16px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--g200)' }}>
                            <CheckCircle size={20} /> Payment Summary
                        </div>
                        <div className="fr2">
                            <div>
                                <div style={s_label}>Payment ID</div>
                                <div style={s_value}>{payment.id}</div>
                            </div>
                            <div>
                                <div style={s_label}>Invoice Ref</div>
                                <div style={s_value}>{payment.invoiceId || '—'}</div>
                            </div>
                            <div>
                                <div style={s_label}>Customer</div>
                                <div style={s_value}>{displayName(payment.customerName || payment.customerId || (invoice ? (invoice.customerName || invoice.customer) : '—'))}</div>
                            </div>
                            <div>
                                <div style={s_label}>Payment Date</div>
                                <div style={s_value}>{fmtDate(payment.date || payment.createdAt)}</div>
                            </div>
                            <div style={{ gridColumn: '1 / -1', marginTop: '8px', padding: '16px', backgroundColor: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
                                <div style={{ fontSize: '13px', color: '#065F46', fontWeight: 600, textTransform: 'uppercase' }}>Amount Received</div>
                                <div style={{ fontSize: '28px', fontWeight: 800, color: '#065F46', marginTop: '4px' }}>{fmt(payment.amount)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Payment Method Details */}
                    <div style={s_card}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3B82F6', fontWeight: 700, fontSize: '16px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--g200)' }}>
                            <CreditCard size={20} /> Transaction Details
                        </div>
                        <div className="fr2">
                            <div>
                                <div style={s_label}>Payment Method</div>
                                <div style={s_value}>{payment.method || '—'}</div>
                            </div>
                            {payment.upiApp && (
                                <div>
                                    <div style={s_label}>UPI App</div>
                                    <div style={s_value}>{payment.upiApp}</div>
                                </div>
                            )}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <div style={s_label}>Transaction Ref / ID</div>
                                <div style={{ ...s_value, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{payment.reference || payment.transactionId || '—'}</div>
                            </div>
                            {payment.notes && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={s_label}>Notes</div>
                                    <div style={{ fontSize: '14px', color: 'var(--g700)', backgroundColor: 'var(--g50)', padding: '12px', borderRadius: '6px', border: '1px solid var(--g200)' }}>
                                        {payment.notes}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                <div style={{ flex: '0 0 350px' }}>
                    {/* Section 2: Invoice Details Linked Component */}
                    <div style={{ ...s_card, position: 'sticky', top: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6366F1', fontWeight: 700, fontSize: '16px', marginBottom: '20px' }}>
                            <FileText size={20} /> Invoice Overview
                        </div>

                        {invoice ? (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--g100)' }}>
                                    <div style={{ color: 'var(--g500)', fontSize: '13px' }}>Invoice Number</div>
                                    <div style={{ fontWeight: 600, color: '#111827' }}><a href="#" onClick={e => { e.preventDefault(); navigate(`/invoices/${invoice.id}`) }} style={{ color: 'var(--brand)', textDecoration: 'none' }}>{invoice.id}</a></div>
                                </div>
                                {invoice.sourceQuotationId && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--g100)' }}>
                                        <div style={{ color: 'var(--g500)', fontSize: '13px' }}>Quotation Ref</div>
                                        <div style={{ fontWeight: 600, color: '#111827' }}>{invoice.sourceQuotationId}</div>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--g100)' }}>
                                    <div style={{ color: 'var(--g500)', fontSize: '13px' }}>Invoice Amount</div>
                                    <div style={{ fontWeight: 600, color: '#111827' }}>{fmt(invTotal)}</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--g100)' }}>
                                    <div style={{ color: 'var(--g500)', fontSize: '13px' }}>Total Paid To Date</div>
                                    <div style={{ fontWeight: 600, color: '#10B981' }}>{fmt(invPaid)}</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', paddingTop: '16px', marginTop: '8px', borderTop: '1px dashed var(--g300)' }}>
                                    <div style={{ color: 'var(--g700)', fontWeight: 600, fontSize: '14px' }}>Outstanding Due</div>
                                    <div style={{ fontWeight: 700, fontSize: '16px', color: invDue > 0 ? '#EF4444' : '#10B981' }}>{fmt(invDue)}</div>
                                </div>

                                <div style={{ marginTop: '24px' }}>
                                    <button onClick={() => navigate(`/invoices/${invoice.id}`)} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                                        View Full Invoice
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--g400)' }}>
                                <div style={{ fontSize: '13px', marginBottom: '8px' }}>This payment is an unlinked transaction.</div>
                                <div style={{ fontSize: '12px' }}>No invoice data found.</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </div>
    )
}
