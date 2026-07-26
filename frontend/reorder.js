const fs = require('fs');
const file = '/Users/sivas_mac/projects/thevoltaura-billing-software/frontend/src/pages/CreateQuotation.tsx';
let content = fs.readFileSync(file, 'utf8');

const sec0 = content.match(/\{\/\* Section 0: Customer Information.*?<\/div>/s);
const sec1 = content.match(/\{\/\* Section 1: Company Profile Info.*?<\/div>/s);
const sec2 = content.match(/\{\/\* Section 2: Client details Info.*?<\/div>/s);

const fullOld = sec0[0] + "\n\n                    " + sec1[0] + "\n\n                    " + sec2[0];
const fullNew = sec1[0] + "\n\n                    " + sec2[0] + "\n\n                    " + sec0[0];

content = content.replace(fullOld, fullNew);

const advanceUI = content.match(/\{\/\* Advance Calculator \*\/.*?Advance Amount to Collect.*?<\/span>\n.*?<\/div>\n.*?<\/div>/s);
if(advanceUI) {
const paymentTermsUI = `{/* Payment Terms */}
                            <div style={{ backgroundColor: 'var(--g50)', borderRadius: '8px', padding: '16px', border: '1px solid var(--g200)', marginBottom: '24px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g600)', marginBottom: '12px', textTransform: 'uppercase' }}>Payment Terms</div>
                                <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '13px', color: 'var(--g700)', lineHeight: '1.6' }}>
                                    {(globalSettings.quotation?.paymentTerms || '10% Advance against Confirmed Purchase Order\\n70% Procurement of Raw Material\\n10% Before Dispatch / Installation\\n10% After Successful Installation & Commissioning').split('\\n').map((term: string, idx: number) => (
                                        <li key={idx} style={{ marginBottom: '6px' }}>{term}</li>
                                    ))}
                                </ul>
                            </div>`;
    content = content.replace(advanceUI[0], paymentTermsUI);
}

// Remove advancePercent states
content = content.replace(/const \[advancePercent, setAdvancePercent\] = useState\(50\);\n    const \[advanceManual, setAdvanceManual\] = useState\(''\);\n/, '');

// Remove advanceAmount from saveQuotation payload and derivation
content = content.replace(/advanceAmount,\n            advancePercent,/, '');

fs.writeFileSync(file, content);
console.log("Done");
