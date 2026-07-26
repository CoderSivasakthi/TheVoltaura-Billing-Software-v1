import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, FileText, IndianRupee, MapPin, Phone, Mail, Building, Download, Eye } from 'lucide-react'
import { api, fmt, toast } from '../services/api'

export default function CustomerLedger() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [customer, setCustomer] = useState<any>(null)
    const [transactions, setTransactions] = useState<any[]>([])

    const loadData = useCallback(async () => {
        if (!id) return
        try {
            const [custData, invData, payData] = await Promise.all([
                api('GET', `/api/customers/${id}`).catch(() => null),
                api('GET', '/api/invoices').catch(() => []),
                api('GET', '/api/payments').catch(() => [])
            ])

            if (!custData) {
                toast('Customer not found', 'error')
                navigate('/customers')
                return
            }
            setCustomer(custData)

            const custInvoices = (invData || []).filter((i: any) => i.customerId === id)
            const custPayments = (payData || []).filter((p: any) => p.customerId === id)

            const txList: any[] = []

            // Add Opening Balance as first transaction if > 0 (or technically regardless, but let's assume > 0)
            const openBal = Number(custData.balance || 0);
            if (openBal > 0) {
                txList.push({
                    date: new Date(custData.createdAt || Date.now()),
                    type: 'Opening Balance',
                    ref: '-',
                    debit: openBal,
                    credit: 0
                })
            }

            custInvoices.forEach((i: any) => {
                txList.push({
                    date: new Date(i.invoiceDate || i.createdAt || Date.now()),
                    type: 'Invoice',
                    ref: i.id,
                    debit: Number(i.total || i.grandTotal || 0),
                    credit: 0,
                    status: i.status
                })
            })

            custPayments.forEach((p: any) => {
                txList.push({
                    date: new Date(p.paymentDate || p.createdAt || Date.now()),
                    type: 'Payment',
                    ref: `Receipt ${p.id.substring(0, 8)}`,
                    debit: 0,
                    credit: Number(p.amount || 0),
                    mode: p.mode
                })
            })

            // Sort chronologically
            txList.sort((a, b) => a.date.getTime() - b.date.getTime())

            let running = 0
            const ledger = txList.map(tx => {
                running = running + tx.debit - tx.credit
                return { ...tx, balance: running }
            })

            // Reverse for display (newest first inside table is optional, but chronological top-down is standard ledger)
            setTransactions(ledger.reverse())

        } catch (err) {
            console.error(err)
            toast('Failed to load ledger data', 'error')
        } finally {
            setLoading(false)
        }
    }, [id, navigate])

    useEffect(() => { loadData() }, [loadData])

    if (loading) return <div className="page active" style={{ padding: 40, textAlign: 'center', color: 'var(--g400)' }}>Loading customer ledger...</div>
    if (!customer) return null

    return (
        <div className="page active" id="customer-ledger-page">
            <div className="inv-pg-hdr">
                <div className="breadcrumb">
                    <a href="#" onClick={e => { e.preventDefault(); navigate('/customers') }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ArrowLeft size={16} /> Back to Directory
                    </a>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/customers/${id}/edit`)}>
                        <Edit size={14} /> Edit Customer
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/create-invoice')}>
                        <FileText size={14} /> New Invoice
                    </button>
                    <button className="btn btn-success btn-sm" onClick={() => navigate('/record-payment')}>
                        <IndianRupee size={14} /> Record Payment
                    </button>
                </div>
            </div>

            <div className="inv-title-row" style={{ alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{ fontSize: 24, marginBottom: 8, color: 'var(--g900)' }}>{customer.name}</h2>
                    <div style={{ display: 'flex', gap: 16, color: 'var(--g500)', fontSize: 13, flexWrap: 'wrap' }}>
                        {customer.email && <span title="Email" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={14} /> {customer.email}</span>}
                        {customer.phone && <span title="Phone" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={14} /> {customer.phone}</span>}
                        {customer.gstin && <span title="GSTIN" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building size={14} /> {customer.gstin} ({customer.gstStatus})</span>}
                    </div>
                </div>
                <div style={{ textAlign: 'right', background: 'var(--g50)', padding: '12px 20px', borderRadius: 8, border: '1px solid var(--g200)' }}>
                    <div style={{ fontSize: 12, color: 'var(--g500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Outstanding</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: transactions.length && transactions[0].balance > 0 ? '#ea580c' : '#16a34a' }}>
                        {fmt(transactions.length ? Math.max(0, transactions[0].balance) : 0)}
                    </div>
                </div>
            </div>

            <div className="charts-row" style={{ display: 'grid', gap: 20, marginBottom: 24, marginTop: 8 }}>
                <div className="card" style={{ padding: 20, display: 'flex', gap: 12 }}>
                    <MapPin size={20} color="var(--g400)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                        <h4 style={{ fontSize: 13, color: 'var(--g500)', marginBottom: 4 }}>Billing Address</h4>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--g800)', lineHeight: '1.5' }}>{customer.address || 'No billing address provided.'}<br />{customer.city}</p>
                    </div>
                </div>
                <div className="card" style={{ padding: 20, display: 'flex', gap: 12 }}>
                    <MapPin size={20} color="var(--g400)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                        <h4 style={{ fontSize: 13, color: 'var(--g500)', marginBottom: 4 }}>Shipping Address</h4>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--g800)', lineHeight: '1.5' }}>{customer.shippingAddress || 'Same as billing address.'}</p>
                    </div>
                </div>
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--g100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Transaction Ledger</h3>
                </div>
                <div className="tw">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description / Ref</th>
                                <th style={{ textAlign: 'right' }}>Debit (Invoiced)</th>
                                <th style={{ textAlign: 'right' }}>Credit (Paid)</th>
                                <th style={{ textAlign: 'right' }}>Running Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 ? (
                                <tr><td colSpan={5} className="empty-state">No transactions found for this customer.</td></tr>
                            ) : transactions.map((t, idx) => (
                                <tr key={idx}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{t.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td>
                                        <div style={{ fontWeight: 500, color: 'var(--g900)' }}>{t.type}</div>
                                        <div style={{ fontSize: 12, color: 'var(--g400)' }}>{t.ref} {t.mode ? `via ${t.mode}` : ''} {t.status ? `(${t.status})` : ''}</div>
                                    </td>
                                    <td style={{ textAlign: 'right', color: t.debit > 0 ? '#ef4444' : 'inherit' }}>
                                        {t.debit > 0 ? fmt(t.debit) : '-'}
                                    </td>
                                    <td style={{ textAlign: 'right', color: t.credit > 0 ? '#10b981' : 'inherit' }}>
                                        {t.credit > 0 ? fmt(t.credit) : '-'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 600, borderLeft: '1px solid var(--g50)', background: 'var(--g0)' }}>
                                        {fmt(t.balance)}
                                        {t.balance > 0 && <span style={{ fontSize: 10, color: 'var(--g400)', marginLeft: 4 }}>Dr</span>}
                                        {t.balance < 0 && <span style={{ fontSize: 10, color: 'var(--g400)', marginLeft: 4 }}>Cr</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Customer Documents Section */}
            {customer && customer.documents && Object.keys(customer.documents).length > 0 && (
                <div className="card" style={{ overflow: 'hidden', marginTop: 24 }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--g100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Uploaded Documents</h3>
                    </div>
                    <div className="tw" style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {Object.entries(customer.documents).map(([type, doc]: [string, any]) => (
                            <div key={doc.id || type} style={{ border: '1px solid var(--g200)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', background: '#fff' }}>
                                {doc.type?.includes('image') ? (
                                    <img src={doc.url} alt={doc.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                ) : (
                                    <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--red-light, #fee2e2)', color: 'var(--red, #dc2626)', borderRadius: '4px' }}>
                                        <FileText size={20} />
                                    </div>
                                )}
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--g900)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                        {doc.name || type}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--g500)' }}>
                                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : 'Uploaded'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <a href={doc.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline" style={{ padding: '4px 8px' }} title="View">
                                        <Eye size={14} />
                                    </a>
                                    <a href={doc.url} download className="btn btn-sm btn-outline" style={{ padding: '4px 8px' }} title="Download">
                                        <Download size={14} />
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    )
}
