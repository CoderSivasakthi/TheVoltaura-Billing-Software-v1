import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api, toast } from '../services/api';

interface AdvancePaymentModalProps {
    quotation: any;
    onClose: () => void;
    onConfirm: () => void;
}

export default function AdvancePaymentModal({ quotation, onClose, onConfirm }: AdvancePaymentModalProps) {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [mode, setMode] = useState('Bank Transfer');
    const [utr, setUtr] = useState('');
    
    // Auto-populate with a default name, or fetch from local storage if available
    const [receivedBy, setReceivedBy] = useState(() => {
        try {
            const userStr = localStorage.getItem('sf_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                return user.name || 'TheVoltaura Admin';
            }
        } catch(e) {}
        return 'TheVoltaura Admin';
    });
    
    const [remarks, setRemarks] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofUrl, setProofUrl] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const grandTotal = Number(quotation.grandTotal || quotation.total || 0);
    const requiredAdvance = grandTotal * 0.10;
    const projectSize = quotation.systemSizeKw ? `${quotation.systemSizeKw} kW` : 'N/A';
    const customerName = quotation.customerName || quotation.customer?.name || 'N/A';
    const inr = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

    const currentAmountNum = Number(amount) || 0;
    const isCash = mode === 'Cash';
    const requiresUtr = !isCash;

    // Disable page scrolling while modal is open
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    // Close on Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                toast('File size must be less than 5MB', 'error');
                return;
            }
            setProofFile(file);
            setProofUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        
        if (currentAmountNum <= 0) {
            toast('Please enter a valid Amount Received.', 'error');
            return;
        }
        
        if (!date) {
            toast('Please select a Payment Date.', 'error');
            return;
        }
        
        if (requiresUtr && !utr.trim()) {
            toast(`Transaction / UTR Number is required for ${mode}.`, 'error');
            return;
        }

        setSubmitting(true);
        try {
            let uploadedProofUrl = '';
            
            // Handle file upload if present
            if (proofFile) {
                const formData = new FormData();
                formData.append('document', proofFile);
                try {
                    const uploadRes = await fetch('http://localhost:5001/api/upload', {
                        method: 'POST',
                        body: formData
                    });
                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json();
                        uploadedProofUrl = uploadData.url || uploadData.fileUrl;
                    }
                } catch(e) {
                    console.error('Upload failed', e);
                    toast('Failed to upload payment proof. Saving without proof.', 'warning');
                }
            }

            const paymentRecord = { 
                amount: currentAmountNum, 
                date, 
                mode, 
                utr: isCash ? '' : utr, 
                receivedBy, 
                remarks,
                proofUrl: uploadedProofUrl
            };
            
            const payments = [...(quotation.payments || []), paymentRecord];
            const totalReceived = payments.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);

            let newStatus = quotation.status;
            let shouldConfirmOrder = false;

            if (totalReceived >= requiredAdvance) {
                newStatus = 'Confirmed Order';
                shouldConfirmOrder = true;
            } else if (totalReceived > 0) {
                newStatus = 'Advance Pending';
            }

            await api('PUT', `/api/quotations/${encodeURIComponent(quotation.id)}`, { payments, status: newStatus });

            if (shouldConfirmOrder) {
                await api('POST', `/api/orders`, {
                    quotationId: quotation.id,
                    quotationNumber: quotation.id,
                    customerName: quotation.customerName || quotation.customer?.name || '',
                    customerMobile: quotation.customer?.phone || quotation.phone || '',
                    projectSize: quotation.systemSizeKw || '',
                    projectType: quotation.notes?.match(/Project:\s*(Grid-Tie|Hybrid|Off-Grid)/i)?.[1] || 'Grid-Tie',
                    advanceAmount: totalReceived,
                    advancePaymentDate: date,
                    grandTotal,
                    orderStatus: 'Confirmed Order'
                });
                toast('Advance payment recorded. Quotation converted to Confirmed Order.', 'success');
            } else {
                toast('Payment recorded. Quotation moved to Advance Pending status.', 'warning');
            }

            onConfirm();
        } catch (err: any) {
            toast(err.message || 'Failed to record payment', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const fieldStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 14px',
        borderRadius: '6px',
        border: '1px solid #cbd5e1',
        fontSize: '14px',
        color: '#0f172a',
        backgroundColor: '#fff',
        boxSizing: 'border-box',
        outline: 'none',
        fontFamily: 'inherit',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '13px',
        fontWeight: 600,
        color: '#475569',
        marginBottom: '6px',
        letterSpacing: '0.01em',
    };

    const modal = (
        <>
            {/* BACKDROP */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.70)',
                    backdropFilter: 'blur(3px)',
                    WebkitBackdropFilter: 'blur(3px)',
                    zIndex: 1000,
                }}
            />

            {/* MODAL PANEL */}
            <div
                style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1001,
                    width: '90vw',
                    maxWidth: '780px',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                    overflow: 'hidden',
                    padding: 0,
                    margin: 0,
                    fontFamily: "'Inter', 'Segoe UI', sans-serif",
                    fontSize: '14px',
                    lineHeight: 1.5,
                    color: '#0f172a',
                    boxSizing: 'border-box',
                }}
            >
                {/* ── HEADER ── */}
                <div style={{ padding: '20px 28px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Confirm Advance Payment</h3>
                        <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>Record advance payment to confirm this order</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '20px', flexShrink: 0 }}
                    >
                        ✕
                    </button>
                </div>

                {/* ── SCROLLABLE BODY ── */}
                <div style={{ overflowY: 'auto', flex: 1 }}>

                    {/* Quotation Summary */}
                    <div style={{ padding: '20px 28px 0' }}>
                        <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '16px 20px' }}>
                            <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quotation Summary</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 32px' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                                    <span style={{ color: '#64748b', fontSize: '13px', whiteSpace: 'nowrap', minWidth: '130px' }}>Quotation No:</span>
                                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>{quotation.id}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                                    <span style={{ color: '#64748b', fontSize: '13px', whiteSpace: 'nowrap', minWidth: '130px' }}>Customer:</span>
                                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>{customerName}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                                    <span style={{ color: '#64748b', fontSize: '13px', whiteSpace: 'nowrap', minWidth: '130px' }}>Project Size:</span>
                                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>{projectSize}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                                    <span style={{ color: '#64748b', fontSize: '13px', whiteSpace: 'nowrap', minWidth: '130px' }}>Project Value:</span>
                                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>₹{inr(grandTotal)}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                                    <span style={{ color: '#64748b', fontSize: '13px', whiteSpace: 'nowrap', minWidth: '130px' }}>Required Advance:</span>
                                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>10%</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                                    <span style={{ color: '#64748b', fontSize: '13px', whiteSpace: 'nowrap', minWidth: '130px' }}>Advance Amount:</span>
                                    <span style={{ fontWeight: 600, color: '#15803d', fontSize: '15px' }}>₹{inr(requiredAdvance)}</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Advance Validation Box */}
                        {currentAmountNum > 0 && (
                            <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '8px', border: `1px solid ${currentAmountNum >= requiredAdvance ? '#bbf7d0' : '#fecdd3'}`, backgroundColor: currentAmountNum >= requiredAdvance ? '#f0fdf4' : '#fff1f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 600, color: currentAmountNum >= requiredAdvance ? '#166534' : '#9f1239', fontSize: '14px' }}>
                                        {currentAmountNum >= requiredAdvance ? 'Advance Requirement Completed' : 'Advance payment is insufficient.'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: currentAmountNum >= requiredAdvance ? '#15803d' : '#be123c', marginTop: '2px' }}>
                                        Received: ₹{inr(currentAmountNum)} / Required: ₹{inr(requiredAdvance)}
                                    </div>
                                </div>
                                {currentAmountNum < requiredAdvance && (
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '12px', color: '#be123c' }}>Balance</div>
                                        <div style={{ fontWeight: 700, color: '#9f1239', fontSize: '15px' }}>₹{inr(requiredAdvance - currentAmountNum)}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Payment Form */}
                    <form id="adv-pay-form" onSubmit={handleSubmit} style={{ padding: '20px 28px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Details</p>

                        {/* Row 1 — Amount + Date */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Amount Received <span style={{ color: '#ef4444' }}>*</span></label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#64748b', fontWeight: 500 }}>₹</span>
                                    <input
                                        type="number"
                                        style={{ ...fieldStyle, paddingLeft: '28px' }}
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        placeholder="0"
                                        required
                                        min="1"
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Payment Date <span style={{ color: '#ef4444' }}>*</span></label>
                                <input
                                    type="date"
                                    style={fieldStyle}
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Row 2 — Mode + UTR */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Payment Mode <span style={{ color: '#ef4444' }}>*</span></label>
                                <select style={fieldStyle} value={mode} onChange={e => setMode(e.target.value)} required>
                                    <option value="Cash">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="Demand Draft (DD)">Demand Draft (DD)</option>
                                    <option value="NEFT">NEFT</option>
                                    <option value="RTGS">RTGS</option>
                                    <option value="IMPS">IMPS</option>
                                </select>
                            </div>
                            {!isCash && (
                                <div>
                                    <label style={labelStyle}>Transaction / UTR Number <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input 
                                        type="text" 
                                        style={fieldStyle} 
                                        value={utr} 
                                        onChange={e => setUtr(e.target.value)} 
                                        placeholder="e.g. UTR123456789"
                                        required={requiresUtr}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Received By */}
                        <div>
                            <label style={labelStyle}>Received By</label>
                            <input 
                                type="text" 
                                style={fieldStyle} 
                                value={receivedBy} 
                                onChange={e => setReceivedBy(e.target.value)} 
                                placeholder="Name of the person who received the payment" 
                            />
                        </div>

                        {/* Remarks */}
                        <div>
                            <label style={labelStyle}>Remarks</label>
                            <textarea
                                style={{ ...fieldStyle, resize: 'vertical', minHeight: '68px' }}
                                value={remarks}
                                onChange={e => setRemarks(e.target.value)}
                                placeholder="Any notes about this payment…"
                                rows={2}
                            />
                        </div>

                        {/* File upload */}
                        <div>
                            <label style={labelStyle}>Upload Payment Proof (Optional)</label>
                            {proofFile ? (
                                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 14px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                        {proofUrl && proofFile.type.startsWith('image/') ? (
                                            <img src={proofUrl} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                        ) : (
                                            <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📄</div>
                                        )}
                                        <div style={{ overflow: 'hidden' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proofFile.name}</div>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>{(proofFile.size / 1024).toFixed(1)} KB</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>Replace</button>
                                        <button type="button" onClick={() => { setProofFile(null); setProofUrl(null); }} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>Remove</button>
                                    </div>
                                    <input type="file" ref={fileInputRef} accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} style={{ display: 'none' }} />
                                </div>
                            ) : (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{ border: '1.5px dashed #cbd5e1', borderRadius: '6px', padding: '16px 18px', backgroundColor: '#f8fafc', textAlign: 'center', color: '#64748b', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
                                >
                                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>📎</div>
                                    <div>Click to attach JPG, PNG, or PDF</div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Max file size: 5MB</div>
                                    <input type="file" ref={fileInputRef} accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} style={{ display: 'none' }} />
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                {/* ── FOOTER ── */}
                <div style={{ padding: '16px 28px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc', flexShrink: 0 }}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        style={{ padding: '9px 22px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#334155', fontWeight: 500, cursor: 'pointer', fontSize: '14px' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="adv-pay-form"
                        disabled={submitting}
                        style={{ padding: '9px 24px', borderRadius: '6px', border: 'none', backgroundColor: submitting ? '#93c5fd' : '#2563eb', color: '#fff', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '14px', minWidth: '140px' }}
                    >
                        {submitting ? 'Processing…' : 'Record Payment'}
                    </button>
                </div>
            </div>
        </>
    );

    return createPortal(modal, document.body);
}
