const supaRepo = require('./backend/repos/supabaseRepo');
const docNum = require('./backend/services/DocumentNumberService');

async function list(name) {
    if (name === 'settings') return await supaRepo.list('settings');
    return [];
}

async function run() {
    try {
        const id = await docNum.generateNextId('quotation', list, async () => {});
        console.log("GENERATED ID:", id);
    } catch (e) {
        console.error(e);
    }
}
run();
