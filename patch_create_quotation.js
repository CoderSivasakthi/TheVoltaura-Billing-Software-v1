const fs = require('fs');
const file = 'frontend/src/pages/CreateQuotation.tsx';
let content = fs.readFileSync(file, 'utf8');

// Rename the buttons and add type="button"
content = content.replace(
    /<button className=\{\`btn btn-sm \$\{([^>]+)\}\`\} onClick=\{([^>]+)\}>Complete Now<\/button>/,
    `<button type="button" className={\`btn btn-sm \$\{$1}\`} onClick={(e) => { e.preventDefault(); setSkipCustomerInfo(false); }}>Provide Details</button>`
);

content = content.replace(
    /<button className=\{\`btn btn-sm \$\{([^>]+)\}\`\} onClick=\{([^>]+)\}>Skip & Update Later<\/button>/,
    `<button type="button" className={\`btn btn-sm \$\{$1}\`} onClick={(e) => { e.preventDefault(); setSkipCustomerInfo(true); }}>Skip & Update Later</button>`
);

// Add the Save & Complete button at the end of the customer info section
const endOfSection = `                                    </div>\n                                </div>\n                            </>\n                        )}`;
const newEndOfSection = `                                    </div>\n                                </div>\n                                <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: '20px' }}>\n                                    <button type="button" className="btn btn-primary" onClick={(e) => { e.preventDefault(); saveQuotation(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>\n                                        <Save size={16} /> {isEdit ? 'Save & Update Details' : 'Save & Complete'}\n                                    </button>\n                                </div>\n                            </>\n                        )}`;

content = content.replace(endOfSection, newEndOfSection);

fs.writeFileSync(file, content);
console.log("Patched successfully!");
