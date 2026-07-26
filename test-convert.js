const { generateNextId } = require('./backend/services/DocumentNumberService');
const { listEntities, updateEntity } = require('./backend/repos/supabaseRepo');

async function check() {
  try {
    const id = await generateNextId('invoice', listEntities, updateEntity);
    console.log("Success! Generated ID:", id);
  } catch (e) {
    console.error("Error:", e);
  }
}
check();
