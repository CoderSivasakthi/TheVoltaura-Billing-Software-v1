import React from 'react';
import { fmt, displayName, numberToWords } from '../services/api';

interface ClassicInvoiceProps {
    inv: any;
    settings: any;
    companyData: any;
    invNo: string;
    invoiceDate: string;
    customerName: string;
    customerAddr: string;
    customerCity?: string;
    customerState?: string;
    customerPincode?: string;
    customerGst: string;
    customerMobile?: string;
    customerEmail?: string;
    consumerNo?: string;
    appRegNo?: string;
    tangedcoNo?: string;
    appSanctionNo?: string;
    projectType?: string;
    systemSizeKw?: string;
    projectLocation?: string;
    paymentMode?: string;
    dueDate?: string;
    paymentTerms?: string;
    items: any[];
    roundOffAmount: number;
    grandTotal: number;
    subtotal: number;
    totalTax: number;
}

export default function ClassicInvoiceTemplate({
    inv, settings, companyData, invNo, invoiceDate, dueDate, paymentTerms,
    customerName, customerAddr, customerCity, customerState, customerPincode, customerGst, customerMobile, customerEmail,
    consumerNo, appRegNo, tangedcoNo, appSanctionNo, projectType, systemSizeKw, projectLocation, paymentMode,
    items, roundOffAmount, grandTotal, subtotal, totalTax
}: ClassicInvoiceProps) {

    const primaryColor = '#1a3f6f'; // Blue accent
    
    // MNRE Split Computations
    const mnreEquipTaxable = subtotal * 0.70;
    const mnreBosTaxable = subtotal * 0.30;
    const mnreEquipCgst = mnreEquipTaxable * 0.025;
    const mnreEquipSgst = mnreEquipTaxable * 0.025;
    const mnreBosCgst = mnreBosTaxable * 0.09;
    const mnreBosSgst = mnreBosTaxable * 0.09;
    const mnreEquipTotalGst = mnreEquipCgst + mnreEquipSgst;
    const mnreBosTotalGst = mnreBosCgst + mnreBosSgst;

    const tdStyle: React.CSSProperties = { border: '1px solid #000', padding: '4px 6px', fontSize: '10px', verticalAlign: 'middle', color: '#000' };
    const thStyle: React.CSSProperties = { ...tdStyle, fontWeight: 700, textAlign: 'center', backgroundColor: '#f4f7fa', color: primaryColor };
    const sectionHdrStyle: React.CSSProperties = { backgroundColor: '#f4f7fa', color: primaryColor, fontWeight: 700, padding: '4px 8px', fontSize: '11px', borderBottom: '1px solid #000' };

    const eoeContent = settings?.invoiceConfig?.eoeContent || '<p>Our responsibility ceases once the goods are handed over to the transporter.<br/>Claims for shortage, leakage, transit damage, or delay in transit will not be entertained. We reserve the right to recover any taxes, duties, or statutory charges applicable to this invoice if omitted due to clerical or system errors.<br/><br/><strong>Subject to Namakkal Jurisdiction only.</strong></p>';
    
    const termsAndConditions = settings?.invoiceConfig?.termsAndConditions || '<ol><li>Goods once sold cannot be returned.</li><li>Warranty as per manufacturer.</li></ol>';

    // --- PAGINATION LOGIC ---
    let pages: any[][] = [];
    let remaining = [...items];
    
    if (remaining.length <= 8) {
        pages.push(remaining);
    } else {
        pages.push(remaining.splice(0, 15));
        while (remaining.length > 12) {
            pages.push(remaining.splice(0, 22));
        }
        pages.push(remaining);
    }

    return (
        <div className="print-layout classic-invoice-wrapper">
            <style>{`
                .classic-invoice-wrapper {
                    padding: 20px 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 100%;
                    background: #d0d0d0;
                    gap: 20px;
                }
                .classic-invoice-wrapper .a4-page {
                    width: 210mm;
                    height: 297mm;
                    padding: 10mm;
                    background: white;
                    margin: 0 auto;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    font-family: 'Inter', Arial, sans-serif;
                    color: #000;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                }
                .classic-invoice-wrapper table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .ql-editor-raw {
                    font-size: 10px;
                    line-height: 1.4;
                }
                .ql-editor-raw p { margin: 0 0 4px 0; }
                .ql-editor-raw ul, .ql-editor-raw ol { margin: 0; padding-left: 16px; }
                
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        background: white;
                    }
                    .classic-invoice-wrapper {
                        padding: 0;
                        background: white;
                        gap: 0;
                    }
                    .classic-invoice-wrapper .a4-page {
                        box-shadow: none !important;
                        margin: 0 !important;
                        padding: 10mm !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        page-break-after: always;
                    }
                }
            `}</style>

            {pages.map((pageItems, pageIndex) => {
                const isFirstPage = pageIndex === 0;
                const isLastPage = pageIndex === pages.length - 1;
                let startSno = 0;
                for (let i = 0; i < pageIndex; i++) {
                    startSno += pages[i].length;
                }

                // Minimum rows logic for table visual consistency
                const fillRowsCount = isLastPage ? Math.max(0, 5 - pageItems.length) : 0;

                return (
                    <div className="a4-page" key={pageIndex}>
                        {/* 1. Header Section */}
                        <div style={{ display: 'flex', border: '1px solid #000', borderBottom: 'none' }}>
                            <div style={{ width: '25%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #000' }}>
                                {companyData.dynamicLogo ? (
                                    <img src={companyData.dynamicLogo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '70px', objectFit: 'contain' }} />
                                ) : (
                                    <div style={{ fontWeight: 800, fontSize: '18px' }}>{companyData.name}</div>
                                )}
                            </div>
                            <div style={{ width: '50%', padding: '12px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: primaryColor, marginBottom: '4px', letterSpacing: '0.5px' }}>
                                    {companyData.name}
                                </div>
                                {companyData.tagline && (
                                    <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '6px', color: '#555' }}>
                                        {companyData.tagline}
                                    </div>
                                )}
                                <div style={{ fontSize: '11px', lineHeight: 1.4, color: '#222' }}>
                                    {companyData.address}<br />
                                    Mobile: {companyData.phone} | Email: {companyData.email}
                                </div>
                            </div>
                            <div style={{ width: '25%', padding: '10px', borderLeft: '1px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ fontSize: '15px', fontWeight: 800, color: primaryColor, marginBottom: '8px', textAlign: 'center', textTransform: 'uppercase' }}>
                                    TAX INVOICE
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>GSTIN:</div>
                                <div style={{ fontSize: '13px', fontWeight: 800 }}>{companyData.gst}</div>
                            </div>
                        </div>

                        {/* 2. Invoice Information Box */}
                        <div style={{ display: 'flex', border: '1px solid #000', borderBottom: 'none', backgroundColor: '#fff' }}>
                            <div style={{ width: '40%', borderRight: '1px solid #000', padding: '6px 10px', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                                <span><strong>Invoice No:</strong> {invNo}</span>
                                <span><strong>Date:</strong> {invoiceDate}</span>
                            </div>
                            <div style={{ width: '60%', padding: '6px 10px', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                                <span><strong>Due Date:</strong> {dueDate || '—'}</span>
                                <span><strong>Terms:</strong> {paymentTerms || '—'}</span>
                                <span><strong>Page:</strong> {pageIndex + 1} of {pages.length}</span>
                            </div>
                        </div>

                        {/* 3. Customer & Project Details (First Page Only) */}
                        {isFirstPage && (
                            <>
                                <div style={{ display: 'flex', border: '1px solid #000', borderBottom: 'none' }}>
                                    <div style={{ width: '50%', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column' }}>
                                        <div style={sectionHdrStyle}>Billed To (Customer Details)</div>
                                        <div style={{ padding: '8px 10px', fontSize: '11px', lineHeight: 1.5 }}>
                                            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>{customerName || '—'}</div>
                                            {customerAddr ? <div style={{ whiteSpace: 'pre-wrap', marginBottom: '2px' }}>{customerAddr}</div> : null}
                                            {(customerCity || customerState || customerPincode) && (
                                                <div style={{ marginBottom: '4px' }}>
                                                    {[customerCity, customerState, customerPincode].filter(Boolean).join(', ')}
                                                </div>
                                            )}
                                            {customerMobile ? <div><strong>Mobile:</strong> {customerMobile}</div> : null}
                                            {customerEmail ? <div><strong>Email:</strong> {customerEmail}</div> : null}
                                            {customerGst ? <div style={{ marginTop: '4px' }}><strong>GSTIN:</strong> {customerGst}</div> : null}
                                        </div>
                                    </div>
                                    <div style={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
                                        <div style={sectionHdrStyle}>Project Details</div>
                                        <div style={{ padding: '8px 10px', fontSize: '11px', lineHeight: 1.6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                                            <div><strong>Consumer No:</strong> {consumerNo || '—'}</div>
                                            <div><strong>App Reg No:</strong> {appRegNo || '—'}</div>
                                            <div><strong>Sanction No:</strong> {appSanctionNo || '—'}</div>
                                            <div><strong>TANGEDCO No:</strong> {tangedcoNo || '—'}</div>
                                            <div><strong>Project Type:</strong> {projectType || '—'}</div>
                                            <div><strong>System Size:</strong> {systemSizeKw ? `${systemSizeKw} kW` : '—'}</div>
                                            <div><strong>Payment Mode:</strong> {paymentMode || '—'}</div>
                                            <div style={{ gridColumn: '1 / -1' }}><strong>Location:</strong> {projectLocation || '—'}</div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', border: '1px solid #000', borderBottom: 'none' }}>
                                    <div style={{ width: '33.3%', borderRight: '1px solid #000', padding: '4px 10px', fontSize: '11px' }}>
                                        <strong>Sent Through:</strong> {inv.dispatchedThrough || inv.sentThrough || '—'}
                                    </div>
                                    <div style={{ width: '33.3%', borderRight: '1px solid #000', padding: '4px 10px', fontSize: '11px' }}>
                                        <strong>L.R. / R.R. No:</strong> {inv.lrRrNo || '—'}
                                    </div>
                                    <div style={{ width: '33.3%', padding: '4px 10px', fontSize: '11px' }}>
                                        <strong>Transport:</strong> {inv.transportDetails || '—'}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* 4. Product Table */}
                        <table style={{ border: '1px solid #000', borderBottom: isLastPage ? 'none' : '1px solid #000', flex: isLastPage ? 'none' : 1 }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: '6%', borderTop: 'none', borderLeft: 'none' }}>S.NO</th>
                                    <th style={{ ...thStyle, width: '60%', borderTop: 'none', textAlign: 'left' }}>DESCRIPTION</th>
                                    <th style={{ ...thStyle, width: '12%', borderTop: 'none' }}>HSN / SAC</th>
                                    <th style={{ ...thStyle, width: '10%', borderTop: 'none' }}>QUANTITY</th>
                                    <th style={{ ...thStyle, width: '12%', borderTop: 'none', borderRight: 'none' }}>UNIT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '20px', borderLeft: 'none', borderRight: 'none' }}>No items on this page</td>
                                    </tr>
                                ) : pageItems.map((it, i) => {
                                    const qty = Number(it.quantity) || Number(it.qty) || 0;
                                    const unit = it.unit || 'Nos';
                                    const hsnCode = String(it.hsnCode || it.hsn || '').trim() || '—';
                                    let prodName = displayName(it.productName || it.name) || '';
                                    prodName = prodName.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
                                    
                                    return (
                                        <tr key={i} style={{ height: '9mm' }}>
                                            <td style={{ ...tdStyle, textAlign: 'center', borderLeft: 'none', fontWeight: 600 }}>{String(startSno + i + 1).padStart(2, '0')}</td>
                                            <td style={{ ...tdStyle, fontWeight: 700 }}>{prodName}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>{hsnCode}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{qty}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center', borderRight: 'none', fontWeight: 600 }}>{unit}</td>
                                        </tr>
                                    );
                                })}
                                {/* Fill empty space ONLY on last page if few items */}
                                {Array.from({ length: fillRowsCount }).map((_, idx) => (
                                    <tr key={'fill-' + idx} style={{ height: '9mm' }}>
                                        <td style={{ ...tdStyle, borderLeft: 'none', borderBottom: idx === fillRowsCount - 1 ? 'none' : '1px solid #000' }}>&nbsp;</td>
                                        <td style={{ ...tdStyle, borderBottom: idx === fillRowsCount - 1 ? 'none' : '1px solid #000' }}></td>
                                        <td style={{ ...tdStyle, borderBottom: idx === fillRowsCount - 1 ? 'none' : '1px solid #000' }}></td>
                                        <td style={{ ...tdStyle, borderBottom: idx === fillRowsCount - 1 ? 'none' : '1px solid #000' }}></td>
                                        <td style={{ ...tdStyle, borderRight: 'none', borderBottom: idx === fillRowsCount - 1 ? 'none' : '1px solid #000' }}></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* 5. Spacer for non-last pages to push footer down */}
                        {!isLastPage && <div style={{ flex: 1 }}></div>}

                        {/* 6. Footer Content (Last Page Only) */}
                        {isLastPage && (
                            <>
                                <div style={{ display: 'flex', border: '1px solid #000', borderBottom: 'none' }}>
                                    <div style={{ width: '65%', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column' }}>
                                        <div style={sectionHdrStyle}>GST Summary (MNRE Split Rate)</div>
                                        <table style={{ width: '100%', margin: 'auto 0' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ ...tdStyle, borderTop: 'none', borderLeft: 'none', borderBottom: 'none', fontWeight: 600, backgroundColor: '#f9f9f9', textAlign: 'center' }}>HSN</th>
                                                    <th style={{ ...tdStyle, borderTop: 'none', borderBottom: 'none', fontWeight: 600, backgroundColor: '#f9f9f9', textAlign: 'right' }}>Taxable</th>
                                                    <th style={{ ...tdStyle, borderTop: 'none', borderBottom: 'none', fontWeight: 600, backgroundColor: '#f9f9f9', textAlign: 'right' }}>CGST</th>
                                                    <th style={{ ...tdStyle, borderTop: 'none', borderBottom: 'none', fontWeight: 600, backgroundColor: '#f9f9f9', textAlign: 'right' }}>SGST</th>
                                                    <th style={{ ...tdStyle, borderTop: 'none', borderRight: 'none', borderBottom: 'none', fontWeight: 600, backgroundColor: '#f9f9f9', textAlign: 'right' }}>Total GST</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td style={{ ...tdStyle, borderLeft: 'none', borderBottom: 'none', textAlign: 'center' }}>
                                                        <div style={{ marginBottom: '4px' }}>8541</div>
                                                        <div>9954</div>
                                                    </td>
                                                    <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right' }}>
                                                        <div style={{ marginBottom: '4px' }}>{fmt(mnreEquipTaxable)}</div>
                                                        <div>{fmt(mnreBosTaxable)}</div>
                                                    </td>
                                                    <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right' }}>
                                                        <div style={{ marginBottom: '4px' }}>{fmt(mnreEquipCgst)}</div>
                                                        <div>{fmt(mnreBosCgst)}</div>
                                                    </td>
                                                    <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right' }}>
                                                        <div style={{ marginBottom: '4px' }}>{fmt(mnreEquipSgst)}</div>
                                                        <div>{fmt(mnreBosSgst)}</div>
                                                    </td>
                                                    <td style={{ ...tdStyle, borderRight: 'none', borderBottom: 'none', textAlign: 'right', fontWeight: 600 }}>
                                                        <div style={{ marginBottom: '4px' }}>{fmt(mnreEquipTotalGst)}</div>
                                                        <div>{fmt(mnreBosTotalGst)}</div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={{ width: '35%', display: 'flex', flexDirection: 'column' }}>
                                        <div style={sectionHdrStyle}>Pricing Summary</div>
                                        <table style={{ width: '100%', flex: 1 }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ ...tdStyle, borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '4px 8px' }}>Sub Total</td>
                                                    <td style={{ ...tdStyle, borderTop: 'none', borderRight: 'none', textAlign: 'right', fontWeight: 600, padding: '4px 8px' }}>{fmt(subtotal)}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ ...tdStyle, borderLeft: 'none', borderRight: 'none', padding: '4px 8px', fontSize: '10px' }}>Equip GST (5%)</td>
                                                    <td style={{ ...tdStyle, borderRight: 'none', textAlign: 'right', fontWeight: 600, padding: '4px 8px' }}>{fmt(mnreEquipTotalGst)}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ ...tdStyle, borderLeft: 'none', borderRight: 'none', padding: '4px 8px', fontSize: '10px' }}>BOS GST (18%)</td>
                                                    <td style={{ ...tdStyle, borderRight: 'none', textAlign: 'right', fontWeight: 600, padding: '4px 8px' }}>{fmt(mnreBosTotalGst)}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ ...tdStyle, borderLeft: 'none', borderRight: 'none', padding: '4px 8px' }}>Total GST</td>
                                                    <td style={{ ...tdStyle, borderRight: 'none', textAlign: 'right', fontWeight: 600, padding: '4px 8px' }}>{fmt(totalTax)}</td>
                                                </tr>
                                                {roundOffAmount !== 0 && (
                                                    <tr>
                                                        <td style={{ ...tdStyle, borderLeft: 'none', borderRight: 'none', padding: '4px 8px' }}>Round Off</td>
                                                        <td style={{ ...tdStyle, borderRight: 'none', textAlign: 'right', fontWeight: 600, padding: '4px 8px' }}>{roundOffAmount > 0 ? '+' : '-'} {fmt(Math.abs(roundOffAmount))}</td>
                                                    </tr>
                                                )}
                                                <tr>
                                                    <td style={{ ...tdStyle, borderLeft: 'none', borderRight: 'none', borderBottom: 'none', padding: '6px 8px', fontWeight: 800, fontSize: '13px', color: primaryColor }}>GRAND TOTAL</td>
                                                    <td style={{ ...tdStyle, borderRight: 'none', borderBottom: 'none', textAlign: 'right', fontWeight: 900, fontSize: '14px', padding: '6px 8px', color: primaryColor }}>{fmt(grandTotal)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div style={{ border: '1px solid #000', borderBottom: 'none', padding: '8px 10px', fontSize: '11px', display: 'flex', alignItems: 'center' }}>
                                    <div style={{ fontWeight: 700, color: primaryColor, marginRight: '8px' }}>Amount Chargeable (In Words):</div>
                                    <div style={{ fontWeight: 700, fontStyle: 'italic', fontSize: '12px' }}>{numberToWords(grandTotal).replace(/Indian Rupees /i, '')}</div>
                                </div>
                                <div style={{ display: 'flex', border: '1px solid #000', borderBottom: 'none', flex: 1 }}>
                                    <div style={{ width: '40%', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column' }}>
                                        <div style={sectionHdrStyle}>Terms &amp; Conditions</div>
                                        <div className="ql-editor-raw" style={{ padding: '8px 12px' }} dangerouslySetInnerHTML={{ __html: termsAndConditions }} />
                                    </div>
                                    <div style={{ width: '30%', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column' }}>
                                        <div style={sectionHdrStyle}>E.&amp;O.E.</div>
                                        <div className="ql-editor-raw" style={{ padding: '12px 14px', fontSize: '9.5px', color: '#333', lineHeight: '1.5', flex: 1 }} dangerouslySetInnerHTML={{ __html: eoeContent }} />
                                    </div>
                                    <div style={{ width: '30%', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ padding: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', fontSize: '11px' }}>
                                            <div style={{ fontWeight: 800, color: primaryColor, fontSize: '12px' }}>For {companyData.name}</div>
                                            <div style={{ flex: 1, minHeight: '50px' }}></div>
                                            <div style={{ fontWeight: 700, color: '#000' }}>Authorised Signatory</div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Global Page Footer (Always at absolute bottom via flex column logic if not pushing from above) */}
                        {/* Wait, if it's not the last page, we have flex: 1 on the table so this is pushed down. If it is the last page, terms are flex: 1 so this is pushed down. */}
                        <div style={{ border: '1px solid #000', padding: '8px 12px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', backgroundColor: '#f4f7fa', color: primaryColor, fontWeight: 700, marginTop: 'auto' }}>
                            <span>{companyData.name}</span>
                            <span>GSTIN: {companyData.gst}</span>
                            <span>Ph: {companyData.phone}</span>
                            <span>Email: {companyData.email}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
