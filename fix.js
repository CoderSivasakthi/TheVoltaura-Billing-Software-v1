const fs = require('fs');
const path = require('path');

function replaceFile(filePath, search, replacement) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(search, replacement);
    fs.writeFileSync(filePath, content);
}

replaceFile('frontend/src/pages/CreateInvoice.tsx', /import { SolarCalculationEngine, LineItem }/, 'import { SolarCalculationEngine, type LineItem }');
replaceFile('frontend/src/pages/CreateQuotation.tsx', /import { SolarCalculationEngine, LineItem }/, 'import { SolarCalculationEngine, type LineItem }');
replaceFile('frontend/src/pages/EditInvoice.tsx', /import { SolarCalculationEngine, LineItem }/, 'import { SolarCalculationEngine, type LineItem }');

replaceFile('frontend/src/pages/Customers.tsx', /const status = /g, '// const status = '); // If it exists
replaceFile('frontend/src/pages/Customers.tsx', /import \{([^}]*)status([^}]*)\} from 'lucide-react'/g, "import {$1$2} from 'lucide-react'");

replaceFile('frontend/src/pages/EditInvoice.tsx', /import {.*Settings,.*Plus,.*Copy.*} from 'lucide-react'/, (match) => {
    return match.replace('Settings, ', '').replace('Plus, ', '').replace('Copy, ', '');
});
// Also add Save to lucide-react in EditInvoice
replaceFile('frontend/src/pages/EditInvoice.tsx', /import {([^}]*)} from 'lucide-react'/, "import {$1, Save} from 'lucide-react'");

// For EditProduct.tsx unused imports
replaceFile('frontend/src/pages/EditProduct.tsx', /Battery, Plug, Wrench, /, '');

// For Products.tsx unused imports
replaceFile('frontend/src/pages/Products.tsx', /Plug, /, '');

// For Settings.tsx process issue
replaceFile('frontend/src/pages/Settings.tsx', /process\.env\.REACT_APP_/, 'import.meta.env.VITE_');

