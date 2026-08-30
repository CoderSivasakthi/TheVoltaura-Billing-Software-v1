require('dotenv').config();
const { supa } = require('./backend/repos/supabaseRepo');
// I can't require server.js because it starts the server. I will just copy the listEntities function.

const supabaseOnline = () => true;

async function listEntities(entityName) {
  if (supabaseOnline()) {
    try {
      const res = await require('./backend/repos/supabaseRepo').list(entityName);
      if (res !== null && res !== undefined) return Array.isArray(res) ? res : [];
    } catch (e) {
      console.warn(`[listEntities] ${entityName}:`, e.message);
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Database operation failed: Unable to list ${entityName} from Supabase.`);
    }
  }
  return [];
}

async function run() {
  process.env.NODE_ENV = 'production';
  console.log('Testing listEntities(users)...');
  try {
    const users = await listEntities('users');
    console.log('Users length:', users.length);
  } catch(e) {
    console.log('Error:', e.message);
  }
}
run();
