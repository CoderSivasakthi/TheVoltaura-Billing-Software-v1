import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Save, X, CreditCard } from 'lucide-react'
import { api, toast } from '../services/api'

export default function RecordPayment() {
    const navigate = useNavigate()
    const location = useLocation()
    const state = location.state as { invoiceId?: string, amount?: number } || {}

    const [invoices, setInvoices] = useState<any[]>([])

    const [form, setForm] = useState({
        invoiceId: state.invoiceId || '',
        amount: state.amount ? String(state.amount) : '',
        date: new Date().toISOString().split('T')[0],
        method: 'Bank Transfer',
        upiApp: '',
        reference: '',
        notes: ''
    })

    useEffect(() => {
        api('GET', '/api/invoices')
            .then(data => setInvoices(data || []))
            .catch(() => setInvoices([]))
    }, [])

    const savePayment = async () => {
        if (!form.amount || Number(form.amount) <= 0) { toast('Valid amount required', 'error'); return }
        const payload = {
            invoiceId: form.invoiceId,
            amount: Number(form.amount),
            date: form.date,
            method: form.method,
            upiApp: form.method.includes('UPI') ? form.upiApp : '',
            reference: form.reference,
            notes: form.notes
        }
        try {
            await api('POST', '/api/payments', payload)
            toast('Payment recorded')
            if (state.invoiceId) navigate(`/invoices/${encodeURIComponent(state.invoiceId)}`)
            else navigate('/payments')
        } catch { toast('Failed to record payment', 'error') }
    }

    return (
        <div className="page active" id="record-payment-page">
            <div className="inv-pg-hdr">
                <div className="breadcrumb">
                    <a href="#" onClick={e => { e.preventDefault(); navigate(-1) }}>← Back</a>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
                        <X size={14} /> Cancel
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={savePayment}>
                        <Save size={14} /> Record Payment
                    </button>
                </div>
            </div>

            <div className="inv-title-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <CreditCard size={24} style={{ color: 'var(--blue)' }} />
                    <h2>Record Payment</h2>
                </div>
            </div>

            <div className="inv-doc">
                <div className="inv-doc-bar" style={{ background: 'linear-gradient(135deg, #3b82f6, #2dd4bf)' }}></div>
                <div className="inv-doc-body" style={{ padding: '32px 40px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div className="fg" style={{ flex: 1 }}>
                            <label className="fl">Invoice ID</label>
                            <select
                                className="fi"
                                value={form.invoiceId}
                                onChange={e => setForm({ ...form, invoiceId: e.target.value })}
                            >
                                <option value="">Select an Invoice (Optional)</option>
                                {invoices.map(inv => (
                                    <option key={inv.id} value={inv.id}>
                                        {inv.id} - {inv.customerName || inv.customerId} ({inv.status})
                                    </option>
                                ))}
                            </select>
                            <div style={{ fontSize: 12, color: 'var(--g400)', marginTop: 4 }}>The customer will be automatically linked via this Invoice ID.</div>
                        </div>
                    </div>

                    <div className="fr2" style={{ marginTop: 24 }}>
                        <div className="fg">
                            <label className="fl">Amount (₹) *</label>
                            <input className="fi" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} type="number" min="0" placeholder="0.00" />
                        </div>
                        <div className="fg">
                            <label className="fl">Payment Date</label>
                            <input className="fi" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} type="date" />
                        </div>
                    </div>

                    <div className="fr2" style={{ marginTop: 24 }}>
                        <div className="fg">
                            <label className="fl">Payment Method</label>
                            <select className="fi" value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Online Banking">Online Banking</option>
                                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                                <option value="Cash">Cash</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Credit Card">Credit Card</option>
                                <option value="NEFT">NEFT</option>
                                <option value="RTGS">RTGS</option>
                                <option value="IMPS">IMPS</option>
                            </select>
                        </div>
                        {form.method.includes('UPI') && (
                            <div className="fg">
                                <label className="fl">UPI App / Details</label>
                                <input className="fi" value={form.upiApp} onChange={e => setForm({ ...form, upiApp: e.target.value })} placeholder="e.g. Google Pay" />
                            </div>
                        )}
                        <div className="fg">
                            <label className="fl">Reference #</label>
                            <input className="fi" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="UTR / Cheque No." />
                        </div>
                    </div>

                    <div className="fg" style={{ marginTop: 24 }}>
                        <label className="fl">Notes</label>
                        <textarea className="fi" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Optional remarks or internal notes..."></textarea>
                    </div>

                    <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--g100)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <button className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
                        <button className="btn btn-primary" style={{ padding: '10px 30px' }} onClick={savePayment}>
                            Record Payment
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
