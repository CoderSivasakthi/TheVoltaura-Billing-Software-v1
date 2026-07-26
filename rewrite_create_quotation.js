const fs = require('fs');
const file = 'frontend/src/pages/CreateQuotation.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add `customerSectionComplete` state
content = content.replace(
    /const \[skipCustomerInfo, setSkipCustomerInfo\] = useState\(false\)/,
    `const [skipCustomerInfo, setSkipCustomerInfo] = useState(false)\n    const [customerSectionComplete, setCustomerSectionComplete] = useState(false)`
);

// 2. Auto-populate from selected customer
const populateLogic = `
    // Auto-populate when customer changes
    useEffect(() => {
        const cust = customers.find(c => c.id === customerId);
        if (cust) {
            setBillingAddr(cust.billing_address || cust.address || '');
            if (sameAsBilling) setSiteAddr(cust.billing_address || cust.address || '');
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
    }, [customerId, sameAsBilling, customers]);

    // Save Customer Info function
    const saveCustomerInfoAndDocs = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!customerId) {
            toast('Please select a client first.', 'error');
            return;
        }
        if (!customerMobile) {
            toast('Customer mobile is required.', 'error');
            return;
        }
        
        try {
            const customerPayload = {
                mobile: customerMobile,
                email: email,
                customerInfo: {
                    consumerNumber, ebName, ebMobile, paymentMode, 
                    loanFinanceCompany, loanAmount, loanDownPayment, loanTenure, loanEmi, loanStatus
                },
                documents: documents
            };
            
            await api('PUT', \`/api/customers/\${customerId}\`, customerPayload);
            toast('Customer info and documents saved directly to profile!', 'success');
            setCustomerSectionComplete(true);
        } catch (err) {
            toast('Failed to save customer details.', 'error');
        }
    };
`;

content = content.replace(
    /useEffect\(\(\) => \{\n\s+loadData\(\)\n\s+\}, \[loadData\]\)/,
    `useEffect(() => {\n        loadData()\n    }, [loadData])\n${populateLogic}`
);


// 3. Replace the Save & Complete button action in Section 0
content = content.replace(
    /<button type="button" className="btn btn-primary" onClick=\{\(e\) => \{ e\.preventDefault\(\); saveQuotation\(false\); \}\} style=\{\{ display: 'flex', alignItems: 'center', gap: '8px' \}\}>\n\s+<Save size=\{16\} \/> \{isEdit \? 'Save & Update Details' : 'Save & Complete'\}\n\s+<\/button>/,
    `<button type="button" className="btn btn-primary" onClick={saveCustomerInfoAndDocs} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Save size={16} /> Save Details to Customer Profile
                                    </button>`
);

// Update section header to include completion badge
content = content.replace(
    /<User size=\{18\} \/> Customer Information & Document Collection\n\s+<\/div>/,
    `<User size={18} /> Customer Information & Document Collection
                                {customerSectionComplete ? (
                                    <span className="badge badge-success" style={{ marginLeft: '10px' }}>Completed</span>
                                ) : (
                                    <span className="badge badge-warning" style={{ marginLeft: '10px', backgroundColor: '#fff3cd', color: '#856404' }}>Documents Pending</span>
                                )}
                            </div>`
);

// 4. Progress Tracker and Layout
const mainLayoutStart = `<div className="doc-layout">`;
const newMainLayoutStart = `
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                
                {/* Progress Tracker Sidebar */}
                <div style={{ width: '240px', backgroundColor: '#fff', borderRadius: '8px', padding: '20px', border: '1px solid var(--g200)', position: 'sticky', top: '24px', flexShrink: 0 }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--g800)', marginBottom: '16px' }}>Quotation Progress</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: companyBranch ? 'var(--g800)' : 'var(--g500)' }}>Company Branch</span>
                            {companyBranch ? <span style={{color: '#16a34a'}}>✅</span> : <span style={{color: '#dc2626'}}>❌</span>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: customerId ? 'var(--g800)' : 'var(--g500)' }}>Client Details</span>
                            {customerId ? <span style={{color: '#16a34a'}}>✅</span> : <span style={{color: '#dc2626'}}>❌</span>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: customerSectionComplete ? 'var(--g800)' : 'var(--g500)' }}>Customer Info</span>
                            {customerSectionComplete ? <span style={{color: '#16a34a'}}>✅</span> : <span>⏳</span>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: Object.keys(documents).length >= 4 ? 'var(--g800)' : 'var(--g500)' }}>Documents</span>
                            {Object.keys(documents).length >= 4 ? <span style={{color: '#16a34a'}}>✅</span> : <span>⏳</span>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: items.length > 0 ? 'var(--g800)' : 'var(--g500)' }}>Technical Specs</span>
                            {items.length > 0 ? <span style={{color: '#16a34a'}}>✅</span> : <span>⏳</span>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: grandTotal > 0 ? 'var(--g800)' : 'var(--g500)' }}>Pricing</span>
                            {grandTotal > 0 ? <span style={{color: '#16a34a'}}>✅</span> : <span>⏳</span>}
                        </div>
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                            <span style={{ color: (companyBranch && customerId && items.length > 0 && grandTotal > 0) ? 'var(--blue)' : 'var(--g500)' }}>Quotation Ready</span>
                            {(companyBranch && customerId && items.length > 0 && grandTotal > 0) ? <span style={{color: '#16a34a'}}>✅</span> : <span style={{color: '#dc2626'}}>❌</span>}
                        </div>
                    </div>
                </div>

                <div className="doc-layout" style={{ flex: 1, minWidth: 0, margin: 0 }}>
`;

content = content.replace(mainLayoutStart, newMainLayoutStart);

// Close the flex container at the very end
content = content.replace(
    /<\/div>\n\s+<\/div>\n\s+<\/div>\n\s+\)\n\}/,
    `</div>\n            </div>\n        </div>\n    )\n}`
);

// Prevent final save if branch/client is missing
const originalSaveCheck = `        if (items.length === 0) return toast('Add at least one item', 'error')`;
const newSaveCheck = `        if (!companyBranch) return toast('Please select a company branch', 'error')\n        if (!customerId) return toast('Please select a client', 'error')\n        if (items.length === 0) return toast('Add at least one item', 'error')`;
content = content.replace(originalSaveCheck, newSaveCheck);


fs.writeFileSync(file, content);
console.log("CreateQuotation.tsx patched successfully.");
