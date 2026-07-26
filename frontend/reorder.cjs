const fs = require('fs');
const file = '/Users/sivas_mac/projects/thevoltaura-billing-software/frontend/src/pages/CreateQuotation.tsx';
let content = fs.readFileSync(file, 'utf8');

const s0_start = content.indexOf('{/* Section 0: Customer Information & Document Collection */}');
const s1_start = content.indexOf('{/* Section 1: Company Profile Info */}');
const s2_start = content.indexOf('{/* Section 2: Client details Info */}');
const s3_start = content.indexOf('{/* Section 3: Itemized System Configuration */}');

if (s0_start !== -1 && s1_start !== -1 && s2_start !== -1 && s3_start !== -1) {
    const s0_block = content.substring(s0_start, s1_start);
    const s1_block = content.substring(s1_start, s2_start);
    const s2_block = content.substring(s2_start, s3_start);

    const prefix = content.substring(0, s0_start);
    const suffix = content.substring(s3_start);

    const newContent = prefix + s1_block + s2_block + s0_block + suffix;
    fs.writeFileSync(file, newContent);
    console.log("Sections reordered successfully.");
} else {
    console.log("Could not find all sections.");
}
