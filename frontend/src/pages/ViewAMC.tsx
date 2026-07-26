import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Edit3, ClipboardList, RefreshCw } from 'lucide-react'
import { api, fmt, fmtDate, toast } from '../services/api'

export default function ViewAMC() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [amc, setAmc] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const loadAMC = useCallback(async () => {
        try {
            const data = await api('GET', `/api/amc/${id}`)
            setAmc(data)
        } catch { toast('AMC not found', 'error'); navigate('/amc') }
        finally { setLoading(false) }
    }, [id, navigate])

    useEffect(() => { loadAMC() }, [loadAMC])

    const handleRenew = async () => {
        if (!confirm('Create a renewal draft for this contract?')) return
        try {
            const newAmc = await api('POST', `/api/amc/${id}/renew`, {})
            toast('Renewal draft created!')
            navigate(`/amc/${newAmc.id}/edit`)
        } catch { toast('Failed to renew contract', 'error') }
    }

    if (loading) return <div className="page active" style={{ padding: 40, textAlign: 'center' }}>Loading contract...</div>
    if (!amc) return <div className="page active" style={{ padding: 40, textAlign: 'center' }}>Contract not found.</div>

    // Math calculation for days left
    const expDate = new Date(amc.amcExpiryDate).getTime()
    const daysLeft = amc.amcExpiryDate ? Math.ceil((expDate - Date.now()) / 86400000) : null
    let localStatus = 'Active'
    if (daysLeft !== null) {
        if (daysLeft < 0) localStatus = 'Expired'
        else if (daysLeft <= 30) localStatus = 'Expiring Soon'
    }

    const eq = amc.equipment || []

    return (
        <div className="page active" id="view-amc-page">
            <div className="inv-pg-hdr">
                <div className="breadcrumb"><a href="#" onClick={e => { e.preventDefault(); navigate('/amc') }}>← Back to AMCs</a></div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/amc/${id}/edit`)}><Edit3 size={14} /> Edit</button>
                    <button className="btn btn-primary btn-sm" onClick={handleRenew}><RefreshCw size={14} /> Renew</button>
                </div>
            </div>

            <div className="inv-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>AMC / {amc.vendorName}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={`badge ${localStatus === 'Active' ? 'badge-green' : localStatus === 'Expired' ? 'badge-red' : 'badge-orange'}`} style={{ fontSize: 14, padding: '6px 14px' }}>
                        {localStatus}
                    </span>
                    {daysLeft !== null && (
                        <div style={{ fontSize: 13, fontWeight: 600, color: daysLeft < 0 ? 'var(--red)' : 'var(--g400)' }}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)} days expired` : `${daysLeft} days remaining`}
                        </div>
                    )}
                </div>
            </div>

            <div className="card" style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 32 }}>

                {/* Vendor & System Grid */}
                <div className="fr2">
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--g400)', marginBottom: 12, letterSpacing: 0.5 }}>Vendor Information</div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#111' }}>{amc.vendorName}</div>
                        {amc.companyName && <div style={{ fontSize: 14, color: 'var(--p600)', marginBottom: 8 }}>{amc.companyName}</div>}
                        <div style={{ fontSize: 13, lineHeight: 1.6, color: '#444' }}>
                            {amc.vendorContact && <div>📞 {amc.vendorContact}</div>}
                            {amc.vendorEmail && <div>✉️ {amc.vendorEmail}</div>}
                            {amc.vendorAddress && <div style={{ marginTop: 4 }}>📍 {amc.vendorAddress}</div>}
                        </div>
                    </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #eee' }} />

                {/* Dates & Financials */}
                <div className="fr2">
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--g400)', marginBottom: 12, letterSpacing: 0.5 }}>Contract Dates</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 24px', fontSize: 13, color: '#222' }}>
                            <div style={{ color: 'var(--g400)' }}>Agreement Date</div><div>{fmtDate(amc.agreementDate)}</div>
                            <div style={{ color: 'var(--g400)' }}>Contract Period</div><div>{fmtDate(amc.contractStartDate)} &nbsp;—&nbsp; {fmtDate(amc.contractEndDate)}</div>
                            <div style={{ color: 'var(--g400)' }}>AMC Coverage</div><div style={{ fontWeight: 600, color: 'var(--p600)' }}>{fmtDate(amc.amcStartDate)} &nbsp;—&nbsp; {fmtDate(amc.amcExpiryDate)}</div>
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--g400)', marginBottom: 12, letterSpacing: 0.5 }}>Financial Details</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 24px', fontSize: 13, color: '#222' }}>
                            <div style={{ color: 'var(--g400)' }}>Base Value</div><div>{fmt(amc.amcContractValue)}</div>
                            <div style={{ color: 'var(--g400)' }}>GST</div><div>{fmt(amc.gst)}</div>
                            <div style={{ color: 'var(--g400)' }}>Total Value</div><div style={{ fontWeight: 700, color: '#111' }}>{fmt(amc.totalContractValue)}</div>
                            <div style={{ color: 'var(--g400)', marginTop: 8 }}>Terms</div><div style={{ marginTop: 8 }}>{amc.paymentTerms || '—'}</div>
                        </div>
                    </div>
                </div>



                {/* Equipment Table */}
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--g400)', marginBottom: 12, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardList size={14} /> Equipment Covered Under AMC</div>
                    {eq.length === 0 ? (
                        <div style={{ padding: 20, background: '#f9fafb', textAlign: 'center', color: 'var(--g400)', borderRadius: 8, fontSize: 13 }}>No equipment listed.</div>
                    ) : (
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
                            <table className="tbl" style={{ margin: 0, border: 'none', minWidth: '600px' }}>
                                <thead style={{ background: '#f9fafb' }}>
                                    <tr>
                                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Type</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Brand / Name</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>Specification</th>
                                        <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {eq.map((e: any, i: number) => (
                                        <tr key={i} style={{ borderBottom: i === eq.length - 1 ? 'none' : '1px solid #eee' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: 500 }}>{e.equipmentType}</td>
                                            <td style={{ padding: '12px 16px' }}>{e.equipmentName || '—'}</td>
                                            <td style={{ padding: '12px 16px', color: 'var(--p600)' }}>{e.specification || '—'}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{e.quantity || '1'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
