import dotenv from 'dotenv';
dotenv.config();
import supa from './backend/repos/supabaseRepo.js';
async function test() {
   try {
     const res = await supa.list('customers');
     console.log(res);
   } catch(e) {
     console.error(e);
   }
}
test();
